package com.oscarvelz.logos

import android.content.Context
import android.media.AudioAttributes
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import org.json.JSONObject
import java.util.Locale
import kotlin.math.max
import kotlin.math.min

/**
 * The shell's own voice (1.4.112) — the floor under the bubble's promise.
 *
 * Oscar's law: one tap on the bubble, then the icon does the work — the
 * text gets READ, without a trip into the app. The page's neural voice is
 * the voice of choice, but a page can stall in ways the shell's watches
 * historically could not see: its state pushes keep flowing (a living
 * pulse) while its render worker makes no progress at all — the panel
 * sits on "Processing…" forever and every watch stands down, because
 * every watch measured the pulse, never the progress.
 *
 * So the shell learned to speak for itself. When a caught text has been
 * given the page, a real ghost visit, and a fair deadline — and the
 * reading position still has not moved — BubbleService hands the text
 * to this speaker: the device's own text-to-speech, driven from the
 * foreground service, sentence by sentence. No WebView, no activity, no
 * engine download: it works with the page stone dead. If the page later
 * starts flowing on its own, BubbleService stops this speaker and the
 * neural voice takes over.
 *
 * The panel is driven through [panelJson], shaped exactly like the
 * page's own state pushes, so the bubble's face needs no second design.
 */
object NativeSpeaker {
    @Volatile var active = false
        private set
    @Volatile var playing = false
        private set

    /** BubbleService listens here: any visible change wants a panel refresh. */
    var listener: (() -> Unit)? = null

    /** The natural-completion mark (H-12 / WR-1): true ONLY when
     *  advance() stepped past the last sentence. Every other stop —
     *  page stop, takeover yield, init failure, shutdown — leaves it
     *  false. It survives the stop that sets it, so the page can still
     *  pull it after the session goes inactive; the next takeOver
     *  clears it. Named apart from ensureEngine's `done` callback so
     *  the two can never be mistaken for each other. */
    @Volatile private var naturalDone = false
    /** Whether any native session has ever run in this process:
     *  the page's getter answers "" until the first takeOver, so no
     *  caller ever invents a position for a session that never was. */
    @Volatile private var everRan = false

    /** The live native position for the page (H-12 / WR-1): a pure
     *  read of the session's own fields — no engine call, no callback
     *  registered, nothing that can step the queue — so it cannot
     *  reopen the flight scoping (T2-3/H-9): utterance callbacks still
     *  step only through utteranceFinished's inFlightId/inFlightGen
     *  gate, exactly as before. `total` is THIS speaker's own
     *  sentence count (its own splitter), so the page can map a
     *  foreign segmentation proportionally. On natural completion
     *  idx == total — the position past the end — and the page
     *  clamps/maps it onto its own final sentence. Empty string
     *  when no native session has ever run. */
    fun snapshotJson(): String {
        if (!everRan) return ""
        return JSONObject()
            .put("idx", idx)
            .put("total", sentences.size)
            .put("playing", playing)
            .put("active", active)
            .put("done", naturalDone)
            .toString()
    }

    private var appCtx: Context? = null
    private var tts: TextToSpeech? = null
    private var ready = false
    private var failed = false
    private var gen = 0

    /** The init watchdog (T2-4): a TextToSpeech whose service never
     *  calls back used to wedge this floor forever — active and
     *  "playing" claimed before the engine existed, every transport
     *  routed to the corpse, and play speaking into an unready engine.
     *  A healthy engine binds in well under a second or two; ten
     *  seconds is a generous bound in the house's own scale (the
     *  ghost visit allows itself ten, the stall watch eight). Past
     *  it, the wait is declared failed — honestly, through the same
     *  done(false) door the 1.4.121 failed-init path already uses. */
    private const val INIT_TIMEOUT_MS = 10_000L
    private val mainHandler = Handler(Looper.getMainLooper())
    private var initWatchdog: Runnable? = null
    /** Stamp of the latest init attempt: a retired attempt's late
     *  callback (or its watchdog) can never speak for a newer one. */
    private var initSeq = 0

    private fun cancelInitWatchdog() {
        initWatchdog?.let { mainHandler.removeCallbacks(it) }
        initWatchdog = null
    }

    private var sentences: List<String> = emptyList()
    private var title = "Logos"
    @Volatile private var idx = 0
    @Volatile private var wordIdx = -1
    @Volatile private var wordFrac = 0.0
    /** The utterance actually in flight (T2-3): the id it was spoken
     *  under and the session generation that spoke it. The engine's
     *  callbacks used to advance the queue blind — the id argument
     *  was never read — so an utterance interrupted by pause, flushed
     *  by a transport press, or orphaned by a stop stepped whatever
     *  session was live when its callback landed. Now a callback may
     *  step the queue only for the utterance named here, and only
     *  while its generation is still the session's. The id keeps the
     *  "logos-native-$idx" scheme and gains a per-utterance sequence:
     *  the same sentence re-spoken at a new rate carries the same idx,
     *  and its flushed predecessor must not be mistaken for it. */
    @Volatile private var inFlightId: String? = null
    @Volatile private var inFlightGen = -1
    private var speakSeq = 0

    private fun clearInFlight() { inFlightId = null; inFlightGen = -1 }
    private var ratePos = 2 // index into RATES — 1.0×
    private val RATES = floatArrayOf(0.75f, 0.9f, 1.0f, 1.1f, 1.25f, 1.5f, 1.75f, 2.0f)

    private fun notifyUi() { listener?.invoke() }

    /** Split into speakable sentences: punctuation-bounded, newlines
     *  honoured, fragments merged, monsters split at commas. */
    fun splitSentences(text: String): List<String> {
        val out = mutableListOf<String>()
        val raw = text.replace("\r\n", "\n").split(Regex("(?<=[.!?…])\\s+|\n+"))
        var buf = ""
        fun flush() { if (buf.isNotBlank()) { out += buf.trim(); buf = "" } }
        for (piece in raw) {
            val p = piece.trim()
            if (p.isEmpty()) continue
            buf = if (buf.isEmpty()) p else "$buf $p"
            if (buf.split(Regex("\\s+")).size >= 3 || buf.length > 220) flush()
        }
        flush()
        // Split any sentence still too long for one utterance.
        val capped = mutableListOf<String>()
        for (s in out) {
            var rest = s
            while (rest.length > 420) {
                val cut = rest.lastIndexOf(", ", 420).takeIf { it > 120 }
                    ?: rest.lastIndexOf(' ', 420).takeIf { it > 120 } ?: 420
                capped += rest.substring(0, cut).trim()
                rest = rest.substring(cut).trim()
            }
            if (rest.isNotEmpty()) capped += rest
        }
        return capped
    }

    private fun looksSpanish(text: String): Boolean = spanishVote(text) == true

    /** The language vote, with an honest abstention (T2-8): true
     *  for Spanish, false for English, null when the sample carries
     *  no signal at all — no ñ/¿/¡ and no function-word hits on
     *  either side. A one-word sentence ("Yes.", "Continue.") must
     *  not flip the engine's voice on a coin toss: applyVoice
     *  leaves the current language standing on an abstention, so a
     *  signal-less sentence is read in the language its neighbours
     *  established. */
    private fun spanishVote(text: String): Boolean? {
        val t = " " + text.lowercase().take(4000) + " "
        if (t.contains('ñ') || t.contains('¿') || t.contains('¡')) return true
        val es = listOf(" el ", " la ", " de ", " que ", " en ", " un ", " una ", " con ", " para ", " por ", " los ", " las ", " del ", " es ", " se ", " su ", " al ")
        val en = listOf(" the ", " of ", " and ", " to ", " in ", " is ", " you ", " that ", " it ", " was ", " for ", " on ", " are ", " with ", " his ", " they ")
        val esHits = es.sumOf { w -> t.split(w).size - 1 }
        val enHits = en.sumOf { w -> t.split(w).size - 1 }
        if (esHits == 0 && enHits == 0) return null
        return esHits > enHits
    }

    /** Take over a text the page could not get flowing. A takeover
     *  starts at the first sentence, or at the sentence the page hands
     *  over (1.4.122) when it surrenders a session mid-way. */
    fun takeOver(c: Context, text: String, titleHint: String, startIdx: Int = 0) {
        val parts = splitSentences(text)
        if (parts.isEmpty()) return
        // A stored pause is HIS word, not the shell's (T2-9): a
        // takeover is the shell's own decision (the fallback chain,
        // or the page's handover), and it used to begin by erasing
        // a stored "pause" and speaking over his explicit stop.
        // Now the pause survives the takeover and governs it: the
        // session takes the stage PAUSED, and only his own play
        // press — resume(), whose identical clear IS his word —
        // lifts it. (A fresh catch clears a stored pause in
        // deliver() before this chain ever runs, so a pause that
        // reaches this line belongs to the current text, not a
        // superseded one.)
        val pausedByUser = BubbleService.hasPendingPause()
        sentences = parts
        title = titleHint.ifBlank { "Logos" }
        idx = startIdx.coerceIn(0, parts.size - 1); wordIdx = -1; wordFrac = 0.0
        // A new session owns no utterance yet (T2-3): any callback
        // still travelling from the previous session finds no flight
        // to step, and the gen stamp below makes it doubly stale.
        clearInFlight()
        active = true
        playing = !pausedByUser
        // A new session is a new truth for the page (H-12 / WR-1):
        // it has run, and it has not finished — the previous
        // session's completion mark must never stain this one.
        everRan = true
        naturalDone = false
        val my = ++gen
        ensureEngine(c.applicationContext, text) { ok ->
            if (my != gen || !active) return@ensureEngine
            if (!ok) { stop(); return@ensureEngine }
            speakCurrent()
        }
        notifyUi()
    }

    private fun ensureEngine(ctx: Context, sample: String, done: (Boolean) -> Unit) {
        appCtx = ctx
        val existing = tts
        if (existing != null && ready) {
            applyVoice(existing, sample)
            done(true)
            return
        }
        // A failed engine must not brick the floor for the life of the
        // process (1.4.121): one transient init failure — the speech
        // service mid-rebind — used to latch `failed` forever, and
        // every later takeover surrendered on the spot. Retire the
        // corpse; each takeover may try a fresh engine.
        if (existing != null) { runCatching { existing.shutdown() }; tts = null; ready = false }
        failed = false
        // A new attempt retires any watch still standing over the old
        // one, and stamps itself: only this attempt's callback — or
        // this attempt's watchdog — may settle this attempt.
        cancelInitWatchdog()
        val myInit = ++initSeq
        var called = false
        val engine = TextToSpeech(ctx) { status ->
            if (called || myInit != initSeq) return@TextToSpeech
            called = true
            cancelInitWatchdog()
            if (status == TextToSpeech.SUCCESS) {
                ready = true
                tts?.setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(id: String?) {}
                    override fun onDone(id: String?) { utteranceFinished(id) }
                    @Deprecated("deprecated in API 21")
                    override fun onError(id: String?) { utteranceFinished(id) }
                    override fun onError(id: String?, code: Int) { utteranceFinished(id) }
                    override fun onRangeStart(id: String?, start: Int, end: Int, frame: Int) {
                        // Word progress belongs to the utterance in
                        // flight, in this session (T2-3): a corpse's
                        // ranges must not move the new session's words.
                        if (id == null || id != inFlightId || inFlightGen != gen) return
                        val s = sentences.getOrNull(idx) ?: return
                        if (s.isEmpty()) return
                        val w = s.substring(0, min(start, s.length)).split(Regex("\\s+")).count { it.isNotEmpty() }
                        val f = start.toDouble() / s.length
                        if (w != wordIdx || kotlin.math.abs(f - wordFrac) > 0.02) {
                            wordIdx = w; wordFrac = f
                            notifyUi()
                        }
                    }
                })
                tts?.let { applyVoice(it, sample) }
                done(true)
            } else {
                failed = true
                done(false)
            }
        }
        tts = engine
        // Arm the watchdog (T2-4) — unless the callback already fired
        // during construction, in which case there is nothing to watch.
        if (!called) {
            val wd = Runnable {
                if (called || myInit != initSeq) return@Runnable
                called = true
                initWatchdog = null
                // Fail honestly: tear the half-built engine down so
                // no corpse is kept warm, leave a receipt on the
                // Settings card, and settle through done(false) — the
                // caller's stop() clears the active/playing claim and
                // notifies the panel truthfully. tts is null and
                // ready is false, so the next takeover (or a play
                // press routed through speakCurrent) builds a FRESH
                // engine and tries again.
                if (tts === engine) tts = null
                ready = false
                failed = true
                runCatching { engine.shutdown() }
                runCatching {
                    BubbleService.noteTry(ctx, BubbleService.s(
                        "the device voice timed out starting",
                        "la voz del dispositivo tardó demasiado en iniciar"
                    ))
                }
                done(false)
            }
            initWatchdog = wd
            mainHandler.postDelayed(wd, INIT_TIMEOUT_MS)
        }
    }

    private fun applyVoice(engine: TextToSpeech, sample: String) {
        runCatching {
            // An abstaining sample keeps the voice it has (T2-8).
            val spanish = spanishVote(sample)
            if (spanish != null) {
                val loc = if (spanish) Locale("es") else Locale.US
                if (engine.isLanguageAvailable(loc) >= TextToSpeech.LANG_AVAILABLE) engine.language = loc
            }
            engine.setSpeechRate(RATES[ratePos])
        }
    }

    private fun speakCurrent() {
        if (!active || !playing) return
        val engine = tts
        if (engine == null || !ready) {
            // No living engine (T2-4): it is still initializing, was
            // torn down by the init watchdog, or never existed. The
            // old code spoke into the unready engine inside
            // runCatching and ignored the result — a play press could
            // never retry init. Now the press DOES retry: a fresh
            // ensureEngine (which retires any half-built engine and
            // arms a fresh watchdog), speaking only once it reports
            // ready. The gen stamp keeps a superseded attempt's
            // callback from speaking for a newer session.
            clearInFlight() // nothing is sounding while the engine is (re)built
            val ctx = appCtx ?: return
            val my = gen
            ensureEngine(ctx, sentences.joinToString(" ")) { ok ->
                if (my != gen || !active) return@ensureEngine
                if (!ok) { stop(); return@ensureEngine }
                if (playing) speakCurrent() else notifyUi()
            }
            notifyUi()
            return
        }
        val s = sentences.getOrNull(idx) ?: run { stop(); return }
        // The voice is judged per SENTENCE (T2-8): applyVoice used
        // to run only at engine init, voting on the whole takeover
        // text's first 4 000 characters, so a bilingual text — a
        // Spanish introduction over an English body, Oscar's
        // everyday material — was read end-to-end in whichever
        // single language won that one vote, and the handToNative
        // promise of sentence-by-sentence switching was false in
        // code. Now every utterance re-judges its own sentence
        // (a sentence is far under the 4 000-char window, so the
        // vote is the sentence's own) and sets the engine's
        // language before it speaks. The page/neural road learned
        // the same lesson as sentenceLang in Wave 3; this is the
        // native road's own cure.
        applyVoice(engine, s)
        wordIdx = -1; wordFrac = 0.0
        // Stamp the utterance BEFORE it is spoken (T2-3): speaking
        // with QUEUE_FLUSH interrupts whatever was in flight, and
        // that utterance's callback can land at any moment from here
        // on — from the flush onward it must already find a different
        // id named as the flight, so it steps nothing.
        val uttId = "logos-native-$idx-${++speakSeq}"
        inFlightId = uttId
        inFlightGen = gen
        runCatching {
            engine.setSpeechRate(RATES[ratePos])
            if (engine.speak(s, TextToSpeech.QUEUE_FLUSH, Bundle(), uttId) != TextToSpeech.SUCCESS &&
                inFlightId == uttId) clearInFlight()
        }.onFailure { if (inFlightId == uttId) clearInFlight() }
        notifyUi()
    }

    /** An utterance's end may step the queue ONLY if that utterance
     *  is the one currently in flight, spoken by the current session
     *  (T2-3). Everything else is a corpse — interrupted by pause,
     *  flushed by next/prev/jump/rate, orphaned by a stop before a
     *  new takeover — and steps nothing. The flight is consumed
     *  before advancing, so a duplicated report (done racing error,
     *  an engine that reports twice) cannot step twice either. */
    private fun utteranceFinished(id: String?) {
        if (!active || id == null) return
        if (id != inFlightId || inFlightGen != gen) return
        clearInFlight()
        advance()
    }

    private fun advance() {
        if (!active) return
        idx++
        if (idx >= sentences.size) { stop(natural = true); return }
        if (playing) speakCurrent() else notifyUi()
    }

    fun pause() {
        if (!active) return
        playing = false
        // Retire the flight BEFORE the stop (T2-3): stop() interrupts
        // the in-flight utterance and the engine reports it — that
        // report must step nothing, so resume() lands on the very
        // sentence he paused on.
        clearInFlight()
        runCatching { tts?.stop() }
        // The whole house hears the stop (1.4.120): the page owns the
        // session, and a session it still believes is playing will start
        // the audio by itself the next time the page is resurrected.
        BubbleService.notePagePaused()
        notifyUi()
    }

    fun resume() {
        if (!active) return
        // His newest word is play: a stored pause must not ambush a
        // later, legitimate recovery (1.4.120).
        BubbleService.clearPendingPause()
        playing = true
        speakCurrent()
    }

    fun toggle() = if (playing) pause() else resume()

    fun next() {
        if (!active) return
        // At the last sentence, SKIP takes the completion road
        // (R3-T2-7): advance() stepping PAST the end is the
        // session's natural completion — the speaker stops with
        // natural = true, the page's nativepos witness reports the
        // reading done, and the book can be marked finished. The
        // clamp this replaces re-spoke the final sentence forever,
        // so a book the device voice was driving could never be
        // finished or moved past from the card's or the
        // headphones' SKIP — the step dead-ended at the book's
        // edge. (prev() at the first sentence keeps its clamp by
        // design: a player's prev at the start restarts the
        // sentence; only the end was a dead end. The sentence-step
        // itself, rather than a book-to-book skip, remains the
        // declared residual of the shell road.)
        if (idx >= sentences.size - 1) { advance(); return }
        idx++
        if (playing) speakCurrent() else notifyUi()
    }

    fun prev() {
        if (!active) return
        idx = max(idx - 1, 0)
        if (playing) speakCurrent() else notifyUi()
    }

    /**
     * Leap by time (1.4.163): the device voice speaks whole
     * sentences, so the leap becomes a count of sentences — the
     * configured seconds divided by the text's own average sentence
     * length at this rate (~13.5 chars per second at 1.0×). The
     * landing sentence is the honest approximation of the moment.
     */
    fun jump(dir: Int) {
        if (!active || sentences.isEmpty()) return
        val sec = runCatching {
            appCtx?.getSharedPreferences("bubble", Context.MODE_PRIVATE)
                ?.getInt(if (dir < 0) "jump_b" else "jump_f", if (dir < 0) 15 else 30) ?: if (dir < 0) 15 else 30
        }.getOrDefault(if (dir < 0) 15 else 30)
        val avgChars = max(1, sentences.sumOf { it.length } / sentences.size)
        val cps = 13.5f * RATES[ratePos]
        val steps = max(1, Math.round(sec * cps / avgChars))
        // A forward leap that lands past the last sentence takes
        // the completion road (R4-T2-5): the clamp this replaces
        // re-spoke the final sentence forever, so the leap verb
        // dead-ended at the book's edge — the very dead end next()
        // was cured of at the same seat (R3-T2-7). Seat advance()
        // on the last sentence and let it step past the end: the
        // session completes naturally, exactly as next() completes
        // there. (A backward leap keeps its clamp at sentence 0,
        // mirroring prev(), by design.)
        if (dir > 0 && idx + steps >= sentences.size) {
            idx = sentences.size - 1
            advance()
            return
        }
        idx = (idx + dir * steps).coerceIn(0, sentences.size - 1)
        if (playing) speakCurrent() else notifyUi()
    }

    fun faster() {
        if (!active) return
        ratePos = min(ratePos + 1, RATES.size - 1)
        if (playing) speakCurrent()
    }

    fun slower() {
        if (!active) return
        ratePos = max(ratePos - 1, 0)
        if (playing) speakCurrent()
    }

    fun seekTo(frac: Double) {
        if (!active || sentences.isEmpty()) return
        idx = (frac.coerceIn(0.0, 0.999) * sentences.size).toInt()
        if (playing) speakCurrent() else notifyUi()
    }

    /** Route a transport command (panel keys, media notification). */
    fun handle(cmd: String) {
        when (cmd) {
            "play" -> resume()
            "pause" -> pause()
            "toggle" -> toggle()
            "next" -> next()
            "prev" -> prev()
            "jumpback" -> jump(-1)
            "jumpfwd" -> jump(1)
            "faster" -> faster()
            "slower" -> slower()
        }
    }

    /** Yield the stage: the page is flowing, the bubble stopped, or a new
     *  text took over. The engine itself stays warm for the next takeover.
     *  `natural` is true only from advance() past the last sentence
     *  (H-12 / WR-1): every other caller — page stop, takeover yield,
     *  init failure (takeOver's and speakCurrent's done(false) doors
     *  both land here), shutdown — takes the default and reports
     *  done:false. The early return on an already-inactive speaker
     *  protects a natural mark already set: a late page stop arriving
     *  after completion can neither clear it nor fire it twice. */
    fun stop(natural: Boolean = false) {
        if (!active) return
        naturalDone = natural
        active = false
        playing = false
        // Retire the flight BEFORE the engine is stopped (T2-3): its
        // late callback must step nothing — above all not a NEW
        // session that takes over after this stop. The gen++ below
        // is the second fence: the corpse's session stamp is stale.
        clearInFlight()
        gen++
        runCatching { tts?.stop() }
        notifyUi()
    }

    fun shutdown() {
        stop()
        // No watchdog outlives the speaker, and a still-pending init
        // attempt is invalidated with it (T2-4).
        cancelInitWatchdog()
        initSeq++
        listener = null
        runCatching { tts?.shutdown() }
        tts = null; ready = false; failed = false
    }

    /** The panel's state while this speaker holds the stage, in the exact
     *  shape of the page's pushes (BubbleService.refreshPanel reads it the
     *  same way). sub names the voice honestly: Oscar always knows which
     *  voice he is hearing. */
    fun panelJson(): JSONObject {
        val total = max(sentences.size, 1)
        val sub = BubbleService.s("Device voice", "Voz del dispositivo") + " · " +
            BubbleService.s("Sentence", "Frase") + " ${idx + 1} " +
            BubbleService.s("of", "de") + " $total"
        return JSONObject()
            .put("title", title)
            .put("playing", playing)
            .put("done", naturalDone)
            .put("busy", false)
            .put("sub", sub)
            .put("frac", (idx + wordFrac) / total)
            .put("ci", idx)
            .put("ct", sentences.size)
            .put("words", true)
            .put("saved", true)
            .put("tc", sentences.getOrNull(idx) ?: "")
            .put("tp", sentences.getOrNull(idx - 1) ?: "")
            .put("tn", sentences.getOrNull(idx + 1) ?: "")
            .put("wi", wordIdx)
    }
}
