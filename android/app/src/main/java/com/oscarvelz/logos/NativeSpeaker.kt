package com.oscarvelz.logos

import android.content.Context
import android.media.AudioAttributes
import android.os.Bundle
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

    private var appCtx: Context? = null
    private var tts: TextToSpeech? = null
    private var ready = false
    private var failed = false
    private var gen = 0

    private var sentences: List<String> = emptyList()
    private var title = "Logos"
    @Volatile private var idx = 0
    @Volatile private var wordIdx = -1
    @Volatile private var wordFrac = 0.0
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

    private fun looksSpanish(text: String): Boolean {
        val t = " " + text.lowercase().take(4000) + " "
        if (t.contains('ñ') || t.contains('¿') || t.contains('¡')) return true
        val es = listOf(" el ", " la ", " de ", " que ", " en ", " un ", " una ", " con ", " para ", " por ", " los ", " las ", " del ", " es ", " se ", " su ", " al ")
        val en = listOf(" the ", " of ", " and ", " to ", " in ", " is ", " you ", " that ", " it ", " was ", " for ", " on ", " are ", " with ", " his ", " they ")
        val esHits = es.sumOf { w -> t.split(w).size - 1 }
        val enHits = en.sumOf { w -> t.split(w).size - 1 }
        return esHits > enHits
    }

    /** Take over a text the page could not get flowing. Idempotent per call:
     *  a fresh takeover always restarts from the first sentence. */
    fun takeOver(c: Context, text: String, titleHint: String) {
        val parts = splitSentences(text)
        if (parts.isEmpty()) return
        if (BubbleService.pendingCmd == "pause") BubbleService.pendingCmd = null
        sentences = parts
        title = titleHint.ifBlank { "Logos" }
        idx = 0; wordIdx = -1; wordFrac = 0.0
        active = true
        playing = true
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
        if (failed) { done(false); return }
        var called = false
        val engine = TextToSpeech(ctx) { status ->
            if (called) return@TextToSpeech
            called = true
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
                    override fun onDone(id: String?) { advance() }
                    @Deprecated("deprecated in API 21")
                    override fun onError(id: String?) { advance() }
                    override fun onError(id: String?, code: Int) { advance() }
                    override fun onRangeStart(id: String?, start: Int, end: Int, frame: Int) {
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
    }

    private fun applyVoice(engine: TextToSpeech, sample: String) {
        runCatching {
            val loc = if (looksSpanish(sample)) Locale("es") else Locale.US
            if (engine.isLanguageAvailable(loc) >= TextToSpeech.LANG_AVAILABLE) engine.language = loc
            engine.setSpeechRate(RATES[ratePos])
        }
    }

    private fun speakCurrent() {
        val engine = tts ?: return
        if (!active || !playing) return
        val s = sentences.getOrNull(idx) ?: run { stop(); return }
        wordIdx = -1; wordFrac = 0.0
        runCatching {
            engine.setSpeechRate(RATES[ratePos])
            engine.speak(s, TextToSpeech.QUEUE_FLUSH, Bundle(), "logos-native-$idx")
        }
        notifyUi()
    }

    private fun advance() {
        if (!active) return
        idx++
        if (idx >= sentences.size) { stop(); return }
        if (playing) speakCurrent() else notifyUi()
    }

    fun pause() {
        if (!active) return
        playing = false
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
        if (BubbleService.pendingCmd == "pause") BubbleService.pendingCmd = null
        playing = true
        speakCurrent()
    }

    fun toggle() = if (playing) pause() else resume()

    fun next() {
        if (!active) return
        idx = min(idx + 1, sentences.size - 1)
        if (playing) speakCurrent() else notifyUi()
    }

    fun prev() {
        if (!active) return
        idx = max(idx - 1, 0)
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
            "faster" -> faster()
            "slower" -> slower()
        }
    }

    /** Yield the stage: the page is flowing, the bubble stopped, or a new
     *  text took over. The engine itself stays warm for the next takeover. */
    fun stop() {
        if (!active) return
        active = false
        playing = false
        gen++
        runCatching { tts?.stop() }
        notifyUi()
    }

    fun shutdown() {
        stop()
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
