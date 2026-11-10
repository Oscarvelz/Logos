package com.oscarvelz.logos

import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.app.ActivityOptions
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.SeekBar
import android.graphics.drawable.ClipDrawable
import android.graphics.drawable.LayerDrawable
import android.view.animation.DecelerateInterpolator
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.Switch
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.widget.TextView
import android.widget.Toast
import org.json.JSONObject

/**
 * The floating bubble (shell android-18, Oscar's dream of 2026-11-08): a small λ
 * that hovers over other apps. Tap it and a mini-player opens — previous, play /
 * pause, next — and, when the lever ("Play the clipboard") is on, it reads what
 * was just copied and hands it to the page to be read aloud, replacing what was
 * playing. Android only lets an app read the clipboard while one of its windows
 * holds the focus, so the reading happens at that tap: directly through the
 * panel's focused window when the phone allows it, otherwise through a
 * transparent blink of ClipActivity. The bubble never reads in secret.
 */
class BubbleService : Service() {
    companion object {
        /** Set by MainActivity: an event name for the page ("toggle", "prev", "next", "clip", "lever", "bubbleoff"). */
        var poke: ((String) -> Unit)? = null
        /** A transport press that found the page asleep; the page collects it as it wakes. */
        @Volatile var pendingCmd: String? = null
        @Volatile private var wakeLock: PowerManager.WakeLock? = null

        /** Oscar's law: one tap, then the icon does the work — even with the
         *  screen off. The vulnerable stretch is the render: no audio is
         *  playing yet, so nothing else keeps the processor awake, and the
         *  device sleeps mid-synthesis. While the pushed state says the engine
         *  is working or playing, hold a partial wakelock; release it the
         *  moment the state rests. Bounded at ten minutes per hold, refreshed
         *  by every state push, so a dead page can never drain the battery. */
        fun syncWakeLock(c: Context) {
            val j = runCatching { JSONObject(nowJson) }.getOrNull()
            val fresh = System.currentTimeMillis() - nowAt < 90_000
            val active = j != null && (j.optBoolean("playing") || j.optBoolean("busy")) && fresh
            if (active) {
                val pm = c.getSystemService(Context.POWER_SERVICE) as PowerManager
                val wl = wakeLock ?: pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "logos:stage").apply { setReferenceCounted(false) }
                wakeLock = wl
                @Suppress("WakelockTimeout") wl.acquire(10 * 60 * 1000L)
            } else {
                wakeLock?.let { if (it.isHeld) it.release() }
                wakeLock = null
            }
            retireHoldFile(c)
        }

        /** The native stage hold is GONE (1.4.90, Oscar's subtraction):
         *  a near-silent loop the shell played while the page rendered —
         *  and it was never silent: its samples were written {255, 0, 1}
         *  instead of {-1, 0, 1} (the -1 lost its high byte), a crackle
         *  he could hear behind every Processing…. Even written right it
         *  earned nothing the wakelock above doesn't already give, so
         *  the mechanism is deleted, not turned down — nothing in the
         *  shell makes sound anymore except his books. This just sweeps
         *  the old file away, once. */
        private var holdRetired = false
        private fun retireHoldFile(c: Context) {
            if (holdRetired) return
            holdRetired = true
            runCatching { java.io.File(c.filesDir, "stage-hold.wav").delete() }
        }

        fun releaseWakeLock() {
            wakeLock?.let { if (it.isHeld) it.release() }
            wakeLock = null
        }

        /** The stage lock (Oscar): while on, a fresh copy cannot evict what's playing. */
        fun isLocked(c: Context) = prefs(c).getBoolean("lock", false)
        fun setLocked(c: Context, on: Boolean) { prefs(c).edit().putBoolean("lock", on).apply() }

        /** A clipboard text waiting for the page to pull it through the bridge. */
        var clipText: String? = null
        var clipManual = false
        /** Latest player state pushed by the page (JSON: playing, active, title, sub). */
        var nowJson = ""
            set(value) {
                field = value
                if (value.isNotEmpty()) {
                    val l = runCatching { JSONObject(value).optString("lang", "") }.getOrDefault("")
                    if (l == "en" || l == "es") uiLang = l
                }
            }
        /** The app's chosen language, learned from the page's pushes — the
         *  panel speaks it too (1.4.104). */
        @Volatile var uiLang = "en"
        fun s(en: String, es: String): String = if (uiLang == "es") es else en
        /** When the page last pushed state — the watchdog's pulse. */
        @Volatile var nowAt = 0L
        var onNow: (() -> Unit)? = null
        /** Set by the service: a fresh catch arms its delivery watch. */
        var onDelivery: (() -> Unit)? = null
        /** The last rung of the delivery ladder: the activity reloads its
         *  page when this is standing as it comes forward. */
        var wantReload = false
        var running = false
        /** Set when Paste & play could not read from the bubble: the page reads it itself as Logos opens. */
        var wantClip = false
        var deliveries = 0
        @Volatile var lastDeliveryAt = 0L
        /** A seek chosen on the panel's bar, pulled once by the page. */
        @Volatile var seekFrac = -1.0
        /** Set by the service: wave the bubble (leaving-Logos trigger). */
        var inviteHook: (() -> Unit)? = null
        private var lastKey = 0
        private var pendingManual = false
        private var lastTrampoline = 0L
        private var trySource = "panel"

        /** A line for the Settings card, so a failed read is evidence, not a mystery. */
        fun noteTry(c: Context, what: String) {
            val t = java.text.SimpleDateFormat("h:mm a", java.util.Locale.US).format(java.util.Date())
            prefs(c).edit().putString("lastTry", "$what · $t").apply()
        }

        fun prefs(c: Context) = c.getSharedPreferences("bubble", Context.MODE_PRIVATE)
        fun lever(c: Context) = prefs(c).getBoolean("auto", true)

        fun readClipboard(c: Context): String = runCatching {
            val cm = c.getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
            val clip = cm.primaryClip ?: return@runCatching ""
            if (clip.itemCount == 0) return@runCatching ""
            clip.getItemAt(0).coerceToText(c)?.toString()?.trim().orEmpty()
        }.getOrDefault("")

        /** A clipboard text takes the stage: stored for the page to pull, and the page is poked.
         *  The same text twice in a row does not restart itself (unless Oscar asked by hand). */
        /** A press that arrived with no activity to hear it (the media
         *  notification's buttons, audit E-3): remember it where the page
         *  collects pending commands on waking, and pay the page a ghost
         *  visit — the same net the panel's transport keys already have. */
        /** A stop spoken to the device voice is a stop for the whole
         *  house (1.4.120). The device voice is a shell creature; the page
         *  — which owns the session — never heard the pause, and its
         *  session still said "playing". Every later resurrection of the
         *  page (a visit, a reload, a renderer recovery) then did what a
         *  playing session does: it started the audio BY ITSELF, long
         *  after Oscar had stopped it and gone to other things. So a
         *  native pause now also pauses the page: directly when a page
         *  can hear it, and as a stored command when it cannot — the
         *  page's own collection honours a stored pause as silence and
         *  never as a summon (1.4.89's law). Play-side intents clear the
         *  stored pause again: the newest word is his. */
        fun notePagePaused() {
            nativeGen++ // his stop also ends the delivery chain (1.4.125)
            pendingCmd = "pause"
            runCatching { poke?.invoke("pause") }
        }

        fun titleFromText(text: String): String {
            val line = text.lineSequence().firstOrNull { it.isNotBlank() }?.trim() ?: "Logos"
            val words = line.split(Regex("\\s+")).take(7).joinToString(" ")
            return if (words.length < line.length) "$words…" else words
        }

        // The native-fallback chain's memory lives in the companion
        // (1.4.122): the page's handover arrives here, while the chain
        // itself runs on the service instance — one memory for both.
        var nativeGen = 0
        var nativeText: String? = null
        var nativeSig = ""

        /** The page hands its session to the shell's device voice
         *  (1.4.122): its own WebView speech bridge can run a sentence
         *  to "completion" in total silence, and a wedged or silent
         *  render must end in a voice that exists. The shell's Android
         *  TTS takes the text from the sentence where the page stopped
         *  and switches language sentence by sentence. */
        /** The page ends a session it handed over (1.4.124): its
         *  sleep timer fired, or a new text replaced the old one.
         *  The shell's voice stops — a stop is a stop for the whole
         *  house, in both directions. */
        fun stopNativeFromPage() {
            if (NativeSpeaker.active) NativeSpeaker.stop()
        }

        fun handToNative(c: Context, text: String, title: String, idx: Int) {
            if (text.isBlank()) return
            if (NativeSpeaker.active && nativeText == text) return
            nativeText = text
            noteTry(c, s("the device voice took over", "la voz del dispositivo tomó el relevo"))
            NativeSpeaker.takeOver(c, text, title.ifBlank { titleFromText(text) }, idx)
        }

        fun wakeForPending(c: Context, cmd: String) {
            if (cmd == "pause") nativeGen++ // a stored stop ends the chain too (1.4.125)
            if (NativeSpeaker.active) { NativeSpeaker.handle(cmd); return }
            pendingCmd = cmd
            if (backstageServe()) return
            runCatching { c.startActivity(Intent(c, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK).putExtra("logos.ghost", true), android.app.ActivityOptions.makeCustomAnimation(c, 0, 0).toBundle()) }
        }

        /** The page lives backstage (1.4.111): it is awake, so a wake is a
         *  direct poke — no ghost visit, no black flash, Oscar stays put. */
        fun backstageServe(): Boolean {
            val p = poke ?: return false
            if (!Backstage.active) return false
            val cmd = pendingCmd
            if (cmd != null) { pendingCmd = null; p(cmd) }
            else if (clipText != null) p("clip")
            return true
        }

        fun deliver(c: Context, text: String, manual: Boolean) {
            if (text.isEmpty()) return
            // A fresh catch is meant to be heard: it supersedes a stored
            // stop (1.4.120), which would otherwise pause the new text.
            if (pendingCmd == "pause") pendingCmd = null
            if (!manual && isLocked(c)) { noteTry(c, s("the lock held a copy back", "el candado retuvo una copia")); return }
            val key = text.length * 31 + text.hashCode()
            if (!manual && key == lastKey) return
            lastKey = key
            deliveries++
            lastDeliveryAt = System.currentTimeMillis()
            noteTry(c, s("read ${text.length} chars via $trySource", "leídos ${text.length} caracteres vía ${if (trySource == "the blink") "el parpadeo" else "el panel"}"))
            clipText = text
            clipManual = manual
            onDelivery?.invoke()
            val p = poke
            if (p != null) p("clip")
            else if (manual) {
                // The page is gone: a ghost visit revives it; the page
                // pulls the clip as it wakes, and Oscar stays where he is.
                runCatching {
                    c.startActivity(Intent(c, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK).putExtra("logos.ghost", true), android.app.ActivityOptions.makeCustomAnimation(c, 0, 0).toBundle())
                }
            }
        }

        /** ClipActivity read the clipboard under its brief focus: hand it over. */
        fun deliverFromClip(c: Context, text: String) {
            if (text.isEmpty()) {
                noteTry(c, s("the blink found the clipboard empty", "el parpadeo vio el portapapeles vacío"))
                if (pendingManual) Toast.makeText(c, s("Clipboard is empty", "El portapapeles está vacío"), Toast.LENGTH_SHORT).show()
                return
            }
            trySource = "the blink"
            deliver(c, text, pendingManual)
        }
    }

    private val gold = Color.rgb(233, 189, 114)
    private val charcoal = Color.rgb(20, 17, 14)
    private val ink = Color.rgb(240, 234, 222)
    private val muted = Color.rgb(168, 158, 142)

    private var wm: WindowManager? = null
    private var bubble: FrameLayout? = null
    private var bubbleParams: WindowManager.LayoutParams? = null
    private var halo: View? = null
    private var haloAnim: ObjectAnimator? = null
    private var seekBar: SeekBar? = null
    private var saveHint: View? = null
    private var saveHintRun: Runnable? = null
    private var lockBtn: TextView? = null
    private var spectrum: SpectrumView? = null
    private var seekHeld = false
    // The sentence scrub (1.4.119): the reading-along text is a handle.
    private var scrubX0 = 0f
    private var scrubY0 = 0f
    private var scrubMode = 0 // 0 undecided, 1 scrubbing, 2 the words keep their scroll
    private var scrubFrom = -1
    private var scrubTarget = -1
    private var lastCi = -1
    private var lastCt = 0
    private var playingNow = false
    private var lastInvite = 0L
    private var lastDeliverySeen = 0
    private var rippleAnims: List<ObjectAnimator> = emptyList()
    private var panel: View? = null
    private var panelParams: WindowManager.LayoutParams? = null
    private var titleV: TextView? = null
    private var subV: TextView? = null
    private var toggleB: ImageButton? = null
    private var ctlSlow: View? = null
    private var ctlPrev: View? = null
    private var ctlNext: View? = null
    private var ctlFast: View? = null
    private val handler = Handler(Looper.getMainLooper())

    /** The player's mirrored spectrum, drawn the way Listen draws it: bars ease
     *  toward the levels the page pushes (the real envelope around the playhead),
     *  so a few pushes a second still move like water. */
    private class SpectrumView(ctx: android.content.Context, gold: Int) : View(ctx) {
        private val targets = FloatArray(18)
        private val shown = FloatArray(18) { 0.05f }
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = gold }
        private var ticking = false
        private val tick = object : Runnable {
            override fun run() {
                var moving = false
                for (i in shown.indices) {
                    val d = targets[i] - shown[i]
                    shown[i] += d * 0.35f
                    if (Math.abs(d) > 0.008f) moving = true
                }
                invalidate()
                if (moving) postDelayed(this, 33) else ticking = false
            }
        }
        fun setTargets(t: FloatArray) {
            for (i in targets.indices) targets[i] = if (i < t.size) t[i] else 0.05f
            if (!ticking) { ticking = true; post(tick) }
        }
        fun rest() { setTargets(FloatArray(18) { 0.05f }) }
        override fun onDetachedFromWindow() { ticking = false; removeCallbacks(tick); super.onDetachedFromWindow() }
        override fun onDraw(canvas: Canvas) {
            val w = width.toFloat(); val h = height.toFloat()
            if (w == 0f || h == 0f) return
            val n = shown.size; val gap = w / n; val bw = Math.max(2f, gap * 0.52f)
            for (i in 0 until n) {
                val center = 1f - Math.abs(i - n / 2f) / (n / 2f)
                val amp = Math.max(0.05f, shown[i]) * (0.55f + 0.45f * center)
                val bh = Math.max(3f, amp * (h - 4f))
                paint.alpha = (70 + 185 * Math.min(1f, shown[i])).toInt()
                val x = i * gap + (gap - bw) / 2f
                canvas.drawRoundRect(x, (h - bh) / 2f, x + bw, (h + bh) / 2f, bw / 2f, bw / 2f, paint)
            }
        }
    }

    // The ghost rest: four seconds untouched and the bubble fades to a
    // whisper. On tablets the whisper is shallower (Oscar): a longer
    // screen makes a 15% ghost genuinely hard to find, so the tablet's
    // rest keeps 45% of the bubble — still resting, still findable.
    private val fadeRun = Runnable {
        val b = bubble ?: return@Runnable
        if (panel != null || dragTargets.isNotEmpty()) return@Runnable
        b.animate().alpha(if (isTablet()) 0.45f else 0.15f).setDuration(700).start()
    }

    private fun invite(times: Int = 3, force: Boolean = false) {
        val root = bubble ?: return
        if (panel != null || dragTargets.isNotEmpty() || playingNow) return
        val now = System.currentTimeMillis()
        if (!force && now - lastInvite < 12000) return
        lastInvite = now
        val h = halo ?: return
        rippleAnims.forEach { it.cancel() }
        if (root.alpha < 1f) root.animate().alpha(1f).setDuration(220).start()
        h.visibility = View.VISIBLE
        val sx = ObjectAnimator.ofFloat(h, "scaleX", 1f, 1.55f).apply { duration = 780; repeatCount = times - 1 }
        val sy = ObjectAnimator.ofFloat(h, "scaleY", 1f, 1.55f).apply { duration = 780; repeatCount = times - 1 }
        val al = ObjectAnimator.ofFloat(h, "alpha", 0.7f, 0f).apply {
            duration = 780; repeatCount = times - 1
            addListener(object : android.animation.AnimatorListenerAdapter() {
                override fun onAnimationEnd(a: android.animation.Animator) {
                    if (!playingNow) h.visibility = View.INVISIBLE
                    h.scaleX = 1f; h.scaleY = 1f
                    handler.removeCallbacks(fadeRun); handler.postDelayed(fadeRun, 900)
                }
            })
        }
        rippleAnims = listOf(sx, sy, al)
        rippleAnims.forEach { it.start() }
    }

    private var lastCheer = 0L
    private fun cheer() {
        val root = bubble ?: return
        val h = halo ?: return
        val now = System.currentTimeMillis()
        if (now - lastCheer < 1500) return
        lastCheer = now
        rippleAnims.forEach { it.cancel() }
        haloAnim?.cancel(); haloAnim = null
        if (root.alpha < 1f) root.animate().alpha(1f).setDuration(200).start()
        h.visibility = View.VISIBLE
        val sx = ObjectAnimator.ofFloat(h, "scaleX", 1f, 1.55f).apply { duration = 620; repeatCount = 1 }
        val sy = ObjectAnimator.ofFloat(h, "scaleY", 1f, 1.55f).apply { duration = 620; repeatCount = 1 }
        val al = ObjectAnimator.ofFloat(h, "alpha", 0.7f, 0f).apply {
            duration = 620; repeatCount = 1
            addListener(object : android.animation.AnimatorListenerAdapter() {
                override fun onAnimationEnd(a: android.animation.Animator) {
                    if (!playingNow) h.visibility = View.INVISIBLE
                    h.scaleX = 1f; h.scaleY = 1f
                    refreshPanel()
                }
            })
        }
        rippleAnims = listOf(sx, sy, al)
        rippleAnims.forEach { it.start() }
    }

    /** The delivery watch (Oscar's frozen stretch: copy → open the panel →
     *  tap outside to close it → nothing ever plays, and the reopened panel
     *  is a photograph, its play key dead). A catch is only caught when the
     *  page CONFIRMS it — pulls the text, or pushes a living state. If no
     *  confirmation lands, the shell climbs the same ladder as the keys:
     *  first bring Logos forward so the page collects the text in the open;
     *  if even that page proves dead, ask for a reload as it comes forward.
     *  The text itself sits stored the whole time; nothing is ever lost. */
    // ── The native floor (1.4.112): progress, not pulse ──────────────
    // The watches above measure the page's pulse (its state pushes).
    // Oscar's stuck panel had a living pulse and a frozen render: the
    // pushes flowed every 120 ms while the reading position never moved.
    // So this chain watches the POSITION SIGNATURE (sentence, word,
    // fraction, title). A caught text gets the page, then one real visit,
    // then a fair deadline — and if the signature still has not moved,
    // the shell reads the text itself (NativeSpeaker). If the page ever
    // starts flowing, the native voice yields the stage back to it.

    private fun sigOf(j: JSONObject?): String =
        if (j == null) "" else listOf(
            j.optString("title"), j.optString("tc"), j.optInt("wi", -1),
            (j.optDouble("frac", 0.0) * 200).toInt().toString()
        ).joinToString("|")

    /** "Flowing" judged against a MOVING baseline (1.4.121). The old
     *  test compared the page against its state at ARM time — before it
     *  had even pulled the text. A page that took the text, pushed one
     *  busy state and then froze forever therefore read as "flowing"
     *  at every check (its signature differed from the pre-delivery
     *  state), and the native floor stood down while the panel sat on
     *  "Processing…" with the audio never beginning — Oscar's report.
     *  Now every check re-baselines: flowing means the signature moved
     *  SINCE THE PREVIOUS CHECK, while the page claims to be playing. */
    private fun flowNow(): Boolean {
        val j = runCatching { JSONObject(nowJson) }.getOrNull() ?: return false
        val cur = sigOf(j)
        val moved = cur != nativeSig
        nativeSig = cur
        return j.optBoolean("playing") == true && moved
    }

    private var nativeMoved = false
    private var yieldFlow = 0

    private fun armNativeFallback() {
        val text = clipText ?: return
        if (NativeSpeaker.active) NativeSpeaker.stop()
        val my = ++nativeGen
        nativeText = text
        nativeMoved = false
        nativeSig = sigOf(runCatching { JSONObject(nowJson) }.getOrNull())
        handler.postDelayed({ nativeCheck1(my) }, 30_000)
    }

    /** At rest by his word (1.4.125): a page that is neither playing
     *  nor busy is not frozen — it is PAUSED, most of all when HE
     *  paused it. The chain's whole jurisdiction is sessions that
     *  CLAIM to be working; a quiet page ends the chain where it
     *  stands — no visit, no takeover, no voice from nowhere. This
     *  was the self-firing audio's main door: copy, listen, press
     *  stop, and thirty seconds later the chain — which knew nothing
     *  of his stop — first visited, then read the stopped text aloud
     *  in the device voice. */
    private fun pageAtRest(): Boolean {
        val j = runCatching { JSONObject(nowJson) }.getOrNull() ?: return false
        // An ERRORED session is quiet too, but it is not at rest by his
        // word — it is a failure asking for the floor, and the page
        // says so in its pushes (err, 1.4.125). Quiet + no error = his.
        return !j.optBoolean("playing") && !j.optBoolean("busy") && j.optInt("err", 0) == 0
    }

    private fun nativeCheck1(my: Int) {
        if (my != nativeGen || NativeSpeaker.active) return
        if (pageAtRest()) return
        if (flowNow()) {
            // It moved since the last look. One move earns one more
            // window — a single push followed by stone is the classic
            // freeze, not flow; movement in BOTH windows is real flow,
            // and the standing progress watch guards the session then.
            if (!nativeMoved) {
                nativeMoved = true
                handler.postDelayed({ nativeCheck1(my) }, 20_000)
            }
            return
        }
        noteTry(this, s("the voice needed a visit", "la voz necesitó una visita"))
        ghostWake(force = true)
        handler.postDelayed({ nativeCheck2(my) }, 15_000)
    }

    private fun nativeCheck2(my: Int) {
        if (my != nativeGen || NativeSpeaker.active) return
        if (pageAtRest()) return // he stopped it during the visit's grace
        if (flowNow()) return // the visit revived it
        val text = nativeText ?: return
        noteTry(this, s("the device voice took over", "la voz del dispositivo tomó el relevo"))
        yieldFlow = 0
        NativeSpeaker.takeOver(this, text, titleFromText(text))
        handler.postDelayed({ nativeYield(my) }, 6_000)
    }

    private fun nativeYield(my: Int) {
        if (my != nativeGen) return
        if (!NativeSpeaker.active) return
        // The stage returns only on SUSTAINED flow (1.4.121): the page
        // must move at two consecutive looks. One twitch used to hand
        // the stage back to a page that froze again a sentence later,
        // with nobody left armed to rescue it a second time.
        if (flowNow()) {
            if (++yieldFlow >= 2) {
                noteTry(this, s("the app voice took over", "la voz de la app tomó el relevo"))
                NativeSpeaker.stop()
                return
            }
        } else yieldFlow = 0
        handler.postDelayed({ nativeYield(my) }, 6_000)
    }


    // The standing form of the same watch, for a freeze mid-session (the
    // delivery chain only guards a catch's first minute): while the page
    // claims to be playing AND busy, 25 s without the signature moving
    // earns one real visit; a still-frozen page after that hands its text
    // to the native voice, when the shell holds the text.
    private var progSig = ""
    private var progSigAt = 0L
    private var progVisitAt = 0L

    private fun progressWatch(j: JSONObject?) {
        if (NativeSpeaker.active) return
        if (j?.optBoolean("playing") != true || j.optBoolean("busy") != true) { progSig = ""; return }
        val sig = sigOf(j)
        val now = System.currentTimeMillis()
        if (sig != progSig) { progSig = sig; progSigAt = now; return }
        if (progSigAt == 0L) { progSigAt = now; return }
        if (now - progSigAt < 25_000) return
        if (now - progVisitAt > 60_000) {
            progVisitAt = now
            noteTry(this, s("the render needed a visit", "el render necesitó una visita"))
            ghostWake(force = true)
            return
        }
        val text = nativeText ?: return
        // The shell only holds the text of a CATCH. If the frozen
        // session is a different one (started inside the app), the
        // native voice has nothing of ITS to speak — visits are its
        // only medicine, never another text's voice (1.4.121).
        val held = titleFromText(text)
        val showing = j?.optString("title") ?: ""
        val same = showing == held || showing.startsWith(held.take(12)) || held.startsWith(showing.take(12))
        if (!same) { progVisitAt = now; return }
        noteTry(this, s("the device voice took over", "la voz del dispositivo tomó el relevo"))
        yieldFlow = 0
        NativeSpeaker.takeOver(this, text, titleFromText(text))
        handler.postDelayed({ nativeYield(nativeGen) }, 6_000)
    }

    private fun armDeliveryWatch() {
        val n = deliveries
        val at = lastDeliveryAt
        handler.postDelayed({ deliveryCheck(n, at, 1) }, 2500)
    }

    private var watchNowAt = 0L
    private var lastPrewarm = 0L

    private fun deliveryCheck(n: Int, at: Long, rung: Int) {
        if (n != deliveries) return // a newer catch superseded this one
        val j = runCatching { JSONObject(nowJson) }.getOrNull()
        val alive = j?.optBoolean("playing") == true || j?.optBoolean("busy") == true
        if (rung == 2) {
            // After the wake: a page that is pushing again is alive and
            // working, however long its render takes — stand down. A page
            // whose pulse has not advanced since the wake, still claiming
            // to be busy, froze mid-work: climb to the reload.
            if (clipText == null && nowAt > watchNowAt) return
            if (clipText == null && j?.optBoolean("busy") != true) return
            noteTry(this, s("the catch needed a reload", "la captura necesitó recargar"))
            wantReload = true
            ghostWake()
            return
        }
        if (clipText == null || (alive && nowAt >= at)) return // confirmed
        noteTry(this, s("the catch needed a visit", "la captura necesitó una visita"))
        watchNowAt = nowAt
        ghostWake()
        handler.postDelayed({ deliveryCheck(n, at, 2) }, 3500)
    }

    /** The stall watch (Oscar, 2026-11-08): press play, close the window
     *  or lock the phone, and the render froze mid-work — the panel
     *  confessing 'Waiting for Logos…'. A hidden page's workers can still
     *  be frozen by the browser, and a
     *  frozen page sends no pushes. So the watch is pulse-based: while the
     *  state says the page is WORKING (rendering a sentence, or building
     *  its head start), eight seconds without a single new push is a
     *  stall — bring Logos forward, where the same render takes seconds;
     *  six more silent seconds after that, and the page is reloaded as it
     *  arrives. A page whose pulse advances is working, however slowly,
     *  and is left alone. */
    private var stallPulse = 0L
    private val stallRung2 = Runnable {
        val j = runCatching { JSONObject(nowJson) }.getOrNull()
        if (!workingNow(j)) return@Runnable
        if (nowAt > stallPulse) return@Runnable // the wake worked; it breathes again
        noteTry(this, s("the render needed a reload", "el render necesitó recargar"))
        wantReload = true
        ghostWake()
    }
    private val stallRung1 = Runnable {
        val j = runCatching { JSONObject(nowJson) }.getOrNull()
        if (!workingNow(j)) return@Runnable
        if (nowAt > stallPulse) { armStallWatch(); return@Runnable } // alive — keep watching
        noteTry(this, s("the render needed a visit", "el render necesitó una visita"))
        stallPulse = nowAt
        ghostWake()
        handler.postDelayed(stallRung2, 6000)
    }
    private fun workingNow(j: JSONObject?): Boolean =
        j?.optBoolean("busy") == true || (j?.optString("sub")?.startsWith("Preparing") == true)
    private fun armStallWatch() {
        handler.removeCallbacks(stallRung1)
        stallPulse = nowAt
        handler.postDelayed(stallRung1, 8000)
    }
    private fun disarmStallWatch() {
        handler.removeCallbacks(stallRung1)
        handler.removeCallbacks(stallRung2)
    }

    /** A panel transport key: hand it to the page — or, when Android has
     *  retired the activity behind the service (the keys go silent), remember
     *  the press and bring Logos forward so the page collects it as it wakes. */
    private fun pokeOrWake(cmd: String, force: Boolean = false) {
        if (cmd == "pause") nativeGen++ // a definite stop ends the delivery chain (1.4.125)
        if (NativeSpeaker.active) { NativeSpeaker.handle(cmd); return }
        val p = poke
        if (p != null && !force) { p(cmd); return }
        pendingCmd = cmd
        noteTry(this, s("panel key visited Logos", "la tecla del panel visitó Logos"))
        ghostWake()
    }

    /** Bring Logos forward WITHOUT taking Oscar anywhere (1.4.88): the
     *  activity resumes as a ghost — transparent, touch-through — only
     *  until the page breathes again, then leaves on its own. The bubble
     *  is a shortcut; a rescue that lands him inside the app is no rescue. */
    private fun ghostWake(force: Boolean = false) {
        if (!force && backstageServe()) { noteTry(this, s("served backstage, no visit", "atendido tras bastidores, sin visita")); return }
        runCatching { startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK).putExtra("logos.ghost", true), android.app.ActivityOptions.makeCustomAnimation(this, 0, 0).toBundle()) }
    }

    private fun wakeBubble(schedule: Boolean = true) {
        handler.removeCallbacks(fadeRun)
        val b = bubble ?: return
        if (b.alpha < 1f) b.animate().alpha(1f).setDuration(140).start()
        if (schedule) handler.postDelayed(fadeRun, 4000)
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    // One bubble size on phones, a little more on tablets (Oscar: 'un
    // poquito, un poquito más' — a little, only a little).
    private fun isTablet() = resources.configuration.smallestScreenWidthDp >= 600
    private fun bubbleSize() = if (isTablet()) dp(76) else dp(58)
    private fun bubbleFace() = if (isTablet()) dp(60) else dp(46)
    private fun bubbleHalo() = if (isTablet()) dp(66) else dp(52)
    private fun bubbleHalf() = bubbleSize() / 2
    // The panel's width: the words (1.4.102) earn the tablet a wider window.
    private fun panelWidth(): Int {
        val base = if (wordsOn && isTablet()) dp(360) else dp(302)
        if (!wordsOn) return base
        val sw2 = resources.displayMetrics.widthPixels
        return (base * curScaleW()).toInt().coerceIn(dp(240), (sw2 - dp(20)).coerceAtLeast(dp(240)))
    }

    /** The transport row fits the panel it lives in (1.4.113, Oscar:
     *  'No quiero botones cortados'). The five keys were born at a fixed
     *  262 dp — an exact fit only for the default 302 dp panel — while
     *  the reader can be dragged down to 240 dp, so at Oscar's own scale
     *  the − and + keys hung off both edges, cropped in half. Now the
     *  row is seated from the panel's real inner width: first the gaps
     *  give (10 → 6 → 4 dp), then the keys themselves scale together,
     *  the toggle always the largest. Nothing is ever cropped. */
    private fun fitControls() {
        val slow = ctlSlow ?: return
        val prev = ctlPrev ?: return
        val tog = toggleB ?: return
        val next = ctlNext ?: return
        val fast = ctlFast ?: return
        val inner = panelWidth() - dp(36) // the card's own side padding
        val design = dp(38 + 46 + 54 + 46 + 38)
        var gap = dp(10)
        var avail = inner - gap * 4
        if (avail < design) { gap = dp(6); avail = inner - gap * 4 }
        if (avail < design) { gap = dp(4); avail = inner - gap * 4 }
        val k = if (avail >= design) 1f else (avail.toFloat() / design).coerceAtLeast(0.7f)
        fun seat(v: View, designDp: Int, last: Boolean) {
            val lp = v.layoutParams as? LinearLayout.LayoutParams ?: return
            val s = (dp(designDp) * k).toInt()
            lp.width = s; lp.height = s; lp.marginEnd = if (last) 0 else gap
            v.layoutParams = lp
        }
        seat(slow, 38, false); seat(prev, 46, false); seat(tog, 54, false); seat(next, 46, false); seat(fast, 38, true)
    }

    // THE STRETCHABLE READER (1.4.105, Oscar: 'redimensionar el tamaño del
    // lector'): drag the panel's free corner and the words window grows —
    // more sentences in view, letters growing with the window — while the
    // corner that grazes the bubble never moves. The size is remembered
    // per device kind (phone / tablet), like the bubble's own spot.
    // A WINDOW, IN BOTH DIRECTIONS (1.4.106, Oscar: 'redimensionarlo en
    // ambas direcciones'): width and height are independent axes — pull
    // sideways and the reader widens without growing tall, pull up or
    // down and it grows tall without widening, diagonally for both. The
    // letters follow the average of the two. The 1.4.105 single size
    // seeds both axes the first time.
    private var panelScaleW = -1f
    private var panelScaleH = -1f
    private fun scaleKeyW() = if (isTablet()) "rscaleWTab" else "rscaleWPhone"
    private fun scaleKeyH() = if (isTablet()) "rscaleHTab" else "rscaleHPhone"
    private fun savedScale(key: String): Float {
        val pr = prefs(this)
        if (pr.contains(key)) return pr.getFloat(key, 1f)
        return pr.getFloat(if (isTablet()) "rscaleTab" else "rscalePhone", 1f)
    }
    private fun curScaleW(): Float = if (panelScaleW > 0) panelScaleW else savedScale(scaleKeyW())
    private fun curScaleH(): Float = if (panelScaleH > 0) panelScaleH else savedScale(scaleKeyH())
    private fun wordsHeight() = ((if (isTablet()) dp(106) else dp(60)) * curScaleH()).toInt()
    private fun wordsTextSize() = (if (isTablet()) 15.5f else 14f) * (0.7f + 0.3f * (curScaleW() + curScaleH()) / 2f)

    private fun applyReaderScale(final: Boolean) {
        val p = panelParams ?: return
        p.width = panelWidth()
        fitControls()
        wordsV?.let { wv ->
            val lp = wv.layoutParams as? LinearLayout.LayoutParams
            if (lp != null && lp.height != wordsHeight()) { lp.height = wordsHeight(); wv.layoutParams = lp }
            wv.textSize = wordsTextSize()
        }
        panel?.let { st ->
            runCatching { wm?.updateViewLayout(st, p) }
            st.post { positionPanel() }
        }
        if (final) {
            prefs(this).edit().putFloat(scaleKeyW(), curScaleW()).putFloat(scaleKeyH(), curScaleH()).apply()
            lastWordsKey = ""; lastWi = -2
            refreshPanel()
        }
    }

    override fun onBind(i: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel("bubble", "Floating bubble", NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) })
        onNow = { refreshPanel() }
        onDelivery = { armDeliveryWatch(); armNativeFallback() }
        NativeSpeaker.listener = { refreshPanel() }
        inviteHook = { invite(3) }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(2, note(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        if (intent?.action == "hide") { stopBubble(); return START_NOT_STICKY }
        if (!Settings.canDrawOverlays(this)) { stopSelf(); return START_NOT_STICKY }
        if (bubble == null) showBubble()
        running = true
        // The pre-warm visit belongs to starts HIS hand asked for
        // (1.4.125): a sticky system restart after the process died —
        // overnight hibernation, Samsung's reaper — passes a null
        // intent, and a visit summoned by nobody is how the app
        // "asked to appear again" while he was doing something else.
        if (intent != null && poke == null && !Backstage.active && System.currentTimeMillis() - lastPrewarm > 60_000) {
            lastPrewarm = System.currentTimeMillis()
            ghostWake()
        }
        return START_STICKY
    }

    private fun note(): Notification {
        val open = PendingIntent.getActivity(this, 21, Intent(this, MainActivity::class.java).setAction(Intent.ACTION_MAIN).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)
        val hide = PendingIntent.getService(this, 22, Intent(this, BubbleService::class.java).setAction("hide"), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        return Notification.Builder(this, "bubble")
            .setSmallIcon(R.drawable.ic_note)
            .setColor(Color.rgb(23, 19, 16))
            .setContentTitle(s("Logos bubble", "Burbuja de Logos"))
            .setContentText(s("Floating over your apps · tap the λ to listen", "Flotando sobre tus apps · toca la λ para escuchar"))
            .setContentIntent(open)
            .setOngoing(true)
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .addAction(Notification.Action.Builder(null, s("Hide bubble", "Ocultar burbuja"), hide).build())
            .build()
    }

    private fun stopBubble() {
        prefs(this).edit().putBoolean("on", false).apply()
        poke?.invoke("bubbleoff")
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun oval(bg: Int, stroke: Int, sw: Int, radius: Float) = GradientDrawable().apply {
        shape = GradientDrawable.OVAL.takeIf { radius < 0 } ?: GradientDrawable.RECTANGLE
        if (radius >= 0) cornerRadius = radius
        setColor(bg)
        if (sw > 0) setStroke(sw, stroke)
    }

    private fun showBubble() {
        val w = getSystemService(WindowManager::class.java)
        wm = w
        val size = bubbleSize() // the window carries a halo ring around the face
        val root = FrameLayout(this)
        val haloV = View(this).apply {
            background = oval(gold, 0, 0, -1f).apply { alpha = 70 }
            layoutParams = FrameLayout.LayoutParams(bubbleHalo(), bubbleHalo(), Gravity.CENTER)
            visibility = View.INVISIBLE
        }
        val face = FrameLayout(this).apply {
            // A small jewel, not a coin (Oscar: smaller and prettier): a warm
            // radial sheen falling from the top-left, the gold ring, a soft shadow.
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                gradientType = GradientDrawable.RADIAL_GRADIENT
                gradientRadius = dp(30).toFloat()
                setGradientCenter(0.35f, 0.3f)
                colors = intArrayOf(Color.rgb(58, 49, 35), Color.rgb(21, 17, 13))
                setStroke(dp(2), gold)
            }
            elevation = dp(5).toFloat()
            layoutParams = FrameLayout.LayoutParams(bubbleFace(), bubbleFace(), Gravity.CENTER)
        }
        val lambda = TextView(this).apply {
            text = "λ"
            setTextColor(gold)
            textSize = if (isTablet()) 28f else 22f
            typeface = Typeface.SERIF
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        }
        face.addView(lambda)
        root.addView(haloV)
        root.addView(face)
        halo = haloV
        val p = WindowManager.LayoutParams(
            size, size, WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            val sw2 = resources.displayMetrics.widthPixels
            val sh2 = resources.displayMetrics.heightPixels
            val fx = getSharedPreferences("bubble", MODE_PRIVATE).getFloat("posFx", -1f)
            val fy = getSharedPreferences("bubble", MODE_PRIVATE).getFloat("posFy", -1f)
            if (fx >= 0f) {
                x = (fx * (sw2 - size)).toInt()
                y = (fy * (sh2 - size)).toInt()
            } else {
                x = sw2 - size - dp(10)
                y = (sh2 * 0.38f).toInt()
            }
        }
        bubbleParams = p
        attachDrag(root, p)
        runCatching { w.addView(root, p) }
        bubble = root
        root.alpha = 0f; root.scaleX = 0.5f; root.scaleY = 0.5f
        root.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(240).setInterpolator(DecelerateInterpolator()).start()
        handler.postDelayed(fadeRun, 4000)
        handler.postDelayed({ invite(2, force = true) }, 420)
    }

    private fun attachDrag(v: View, p: WindowManager.LayoutParams) {
        var downX = 0f; var downY = 0f; var startX = 0; var startY = 0; var moved = false
        var longHit = false
        val longRun = Runnable {
            if (!moved && panel == null) {
                longHit = true
                pokeOrWake("voice")
                v.animate().scaleX(1.13f).scaleY(1.13f).setDuration(90)
                    .withEndAction { v.animate().scaleX(1f).scaleY(1f).setDuration(160).start() }.start()
            }
        }
        v.setOnTouchListener { _, e ->
            when (e.action) {
                MotionEvent.ACTION_DOWN -> { wakeBubble(); longHit = false; handler.postDelayed(longRun, 500); downX = e.rawX; downY = e.rawY; startX = p.x; startY = p.y; moved = false; true }
                MotionEvent.ACTION_MOVE -> {
                    val dx = e.rawX - downX; val dy = e.rawY - downY
                    if (Math.abs(dx) + Math.abs(dy) > dp(9)) moved = true
                    if (moved) handler.removeCallbacks(longRun)
                    if (moved) {
                        // Holding the bubble raises the two top gates (Oscar's other
                        // app does this, and now so does Logos): Remove, or Open.
                        if (dragTargets.isEmpty()) { collapsePanel(); showTargets() }
                        p.x = (startX + dx).toInt(); p.y = (startY + dy).toInt()
                        runCatching { wm?.updateViewLayout(v, p) }
                        updateHover(p)
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    handler.removeCallbacks(longRun)
                    val target = hoverTarget
                    hideTargets()
                    when {
                        longHit -> { longHit = false }
                        !moved -> togglePanel()
                        target == 0 -> stopBubble()
                        target == 1 -> {
                            settleBubble(v, p)
                            runCatching { startActivity(Intent(this, MainActivity::class.java).setAction(Intent.ACTION_MAIN).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)) }
                        }
                        else -> settleBubble(v, p)
                    }
                    true
                }
                MotionEvent.ACTION_CANCEL -> { handler.removeCallbacks(longRun); hideTargets(); if (moved) settleBubble(v, p); true }
                else -> false
            }
        }
    }

    // --- The drag gates: two pills at the top of the screen while the bubble is held ---
    private class DragTarget(val view: View, val rect: Rect, val idle: GradientDrawable, val hot: GradientDrawable)

    private var dragTargets: List<DragTarget> = emptyList()
    private var hoverTarget = -1

    private fun pill(fill: Int, stroke: Int) = GradientDrawable().apply {
        cornerRadius = dp(99).toFloat(); setColor(fill); setStroke(dp(1), stroke)
    }

    private fun showTargets() {
        val w = wm ?: return
        val sw2 = resources.displayMetrics.widthPixels
        val tw = dp(134); val th = dp(52); val gap = dp(12)
        val x0 = (sw2 - (tw * 2 + gap)) / 2
        val y0 = dp(40)
        fun target(idx: Int, glyph: String, glyphInk: Int, label: String, hotFill: Int, hotStroke: Int, hotInk: Int): DragTarget {
            val idle = pill(Color.argb(238, 26, 22, 18), Color.rgb(96, 80, 54))
            val hot = pill(hotFill, hotStroke)
            val g = TextView(this).apply { text = glyph; textSize = 16f; setTextColor(glyphInk); setTypeface(typeface, Typeface.BOLD) }
            val t = TextView(this).apply {
                text = label; textSize = 13.5f; setTextColor(ink); setTypeface(typeface, Typeface.BOLD)
                layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { leftMargin = dp(7) }
            }
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER
                background = idle
                elevation = dp(10).toFloat()
                tag = arrayOf<Any>(g, t, glyphInk, hotInk)
            }
            row.addView(g); row.addView(t)
            val lp = WindowManager.LayoutParams(tw, th, WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE, PixelFormat.TRANSLUCENT
            ).apply { gravity = Gravity.TOP or Gravity.START; x = x0 + idx * (tw + gap); y = y0 }
            runCatching { w.addView(row, lp) }
            row.alpha = 0f; row.translationY = -dp(12).toFloat()
            row.animate().alpha(1f).translationY(0f).setDuration(160).start()
            return DragTarget(row, Rect(lp.x, lp.y, lp.x + tw, lp.y + th), idle, hot)
        }
        dragTargets = listOf(
            target(0, "✕", ink, s("Remove", "Quitar"), Color.rgb(128, 36, 26), Color.rgb(214, 102, 82), Color.WHITE),
            target(1, "λ", gold, s("Open Logos", "Abrir Logos"), gold, gold, charcoal)
        )
        hoverTarget = -1
    }

    private fun updateHover(p: WindowManager.LayoutParams) {
        val cx = p.x + bubbleHalf(); val cy = p.y + bubbleHalf()
        val idx = dragTargets.indexOfFirst { it.rect.contains(cx, cy) }
        if (idx == hoverTarget) return
        hoverTarget = idx
        dragTargets.forEachIndexed { i, t ->
            val hot = i == idx
            t.view.background = if (hot) t.hot else t.idle
            t.view.scaleX = if (hot) 1.1f else 1f
            t.view.scaleY = if (hot) 1.1f else 1f
            val parts = t.view.tag as Array<*>
            val gInk = if (hot) parts[3] as Int else parts[2] as Int
            (parts[0] as TextView).setTextColor(gInk)
            (parts[1] as TextView).setTextColor(if (hot) parts[3] as Int else ink)
        }
    }

    private fun hideTargets() {
        dragTargets.forEach { t -> runCatching { wm?.removeView(t.view) } }
        dragTargets = emptyList()
        hoverTarget = -1
    }

    // FREE PLACEMENT (Oscar): the bubble lives where his hand leaves it —
    // mid-screen included. It docks only when dropped near an edge, and it
    // remembers its spot as screen fractions, so a rotation, a restart or
    // a bigger screen keeps the same relative place.
    private fun saveBubblePos(x: Int, y: Int) {
        val sw2 = resources.displayMetrics.widthPixels
        val sh2 = resources.displayMetrics.heightPixels
        val bw = bubbleSize()
        getSharedPreferences("bubble", MODE_PRIVATE).edit()
            .putFloat("posFx", if (sw2 > bw) x.toFloat() / (sw2 - bw) else 0f)
            .putFloat("posFy", if (sh2 > bw) y.toFloat() / (sh2 - bw) else 0f)
            .apply()
    }

    private fun placeFromMemory() {
        val bp = bubbleParams ?: return
        val bv = bubble ?: return
        val prefs = getSharedPreferences("bubble", MODE_PRIVATE)
        val fx = prefs.getFloat("posFx", -1f); val fy = prefs.getFloat("posFy", -1f)
        if (fx < 0f) return
        val sw2 = resources.displayMetrics.widthPixels
        val sh2 = resources.displayMetrics.heightPixels
        val bw = bubbleSize()
        bp.x = (fx * (sw2 - bw)).toInt().coerceIn(dp(2), (sw2 - bw - dp(2)).coerceAtLeast(dp(2)))
        bp.y = (fy * (sh2 - bw)).toInt().coerceIn(dp(2), (sh2 - bw - dp(24)).coerceAtLeast(dp(2)))
        runCatching { wm?.updateViewLayout(bv, bp) }
        if (panel != null) positionPanel()
    }

    override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
        super.onConfigurationChanged(newConfig)
        placeFromMemory()
        handler.postDelayed({ placeFromMemory() }, 300)
    }

    private fun settleBubble(v: View, p: WindowManager.LayoutParams) {
        val sw2 = resources.displayMetrics.widthPixels
        val sh2 = resources.displayMetrics.heightPixels
        val bw = bubbleSize()
        p.x = p.x.coerceIn(dp(2), (sw2 - bw - dp(2)).coerceAtLeast(dp(2)))
        p.y = p.y.coerceIn(dp(2), (sh2 - bw - dp(24)).coerceAtLeast(dp(2)))
        val near = dp(30)
        val target = when {
            p.x <= near -> dp(4)
            p.x >= sw2 - bw - near -> sw2 - bw - dp(4)
            else -> p.x
        }
        saveBubblePos(target, p.y)
        if (target != p.x) {
            val anim = ValueAnimator.ofInt(p.x, target).apply {
                duration = 150
                addUpdateListener { p.x = it.animatedValue as Int; runCatching { wm?.updateViewLayout(v, p) }; if (panel != null) positionPanel() }
            }
            anim.start()
        } else {
            runCatching { wm?.updateViewLayout(v, p) }
            if (panel != null) positionPanel()
        }
    }

    private var outsideClosedAt = 0L

    private fun togglePanel() {
        if (panel != null) { collapsePanel(); return }
        // The tap that just closed the panel from outside was a close, not an open.
        if (System.currentTimeMillis() - outsideClosedAt < 450) return
        openPanel()
    }

    // The panel wears the app's own spectrum (Oscar: "que el panel siga la app.
    // No true black. El acabado premium con el spectrum del reproductor"): the
    // player's warm charcoal gradient with its soft gold glow on top — or, when
    // Logos itself is in its light theme, the warm paper of that room.
    private var panelLight = false
    private var wordsV: TextView? = null
    private var gripV: View? = null
    private var gripFreeR = true
    private var gripFreeB = true
    private var wordsOn = true
    private var lastWordsKey = ""
    private var lastWi = -2
    private var wordsScrollAnim: ObjectAnimator? = null
    private var lastFocusTry = 0L

    private val lightPal = mapOf(
        "bg1" to Color.rgb(251, 247, 238), "bg2" to Color.rgb(240, 232, 214),
        "line" to Color.rgb(206, 188, 148), "ink" to Color.rgb(34, 28, 18),
        "muted" to Color.rgb(122, 108, 85), "disc" to Color.rgb(255, 255, 255),
        "discLine" to Color.rgb(216, 201, 168), "gold" to Color.rgb(154, 102, 20),
        "glow" to Color.argb(46, 233, 189, 114), "div" to Color.rgb(224, 211, 182)
    )
    private val darkPal = mapOf(
        "bg1" to Color.rgb(34, 29, 23), "bg2" to Color.rgb(19, 16, 13),
        "line" to Color.rgb(96, 80, 54), "ink" to Color.rgb(245, 239, 227),
        "muted" to Color.rgb(173, 161, 141), "disc" to Color.rgb(46, 40, 32),
        "discLine" to Color.rgb(74, 64, 51), "gold" to gold,
        "glow" to Color.argb(64, 233, 189, 114), "div" to Color.rgb(58, 50, 40)
    )
    private fun pal(): Map<String, Int> = if (panelLight) lightPal else darkPal
    /** The explainer cards step ONE tone away from the player (Oscar, refined):
     *  a warm charcoal — a dark gray that never nears pure black — on the dark
     *  player, a deeper parchment on the light one. The full pole-swap was too
     *  stark; the player's own tone was invisible. Never Android gray. */
    private fun cardPal(): Map<String, Int> = if (panelLight) mapOf(
        "bg1" to Color.rgb(238, 227, 199), "bg2" to Color.rgb(226, 210, 172),
        "line" to Color.rgb(178, 152, 100), "ink" to Color.rgb(34, 28, 18),
        "muted" to Color.rgb(84, 72, 50), "disc" to Color.rgb(255, 255, 255),
        "discLine" to Color.rgb(200, 180, 140), "gold" to Color.rgb(154, 102, 20),
        "glow" to Color.argb(46, 233, 189, 114), "div" to Color.rgb(200, 184, 148)
    ) else mapOf(
        "bg1" to Color.rgb(79, 70, 58), "bg2" to Color.rgb(60, 53, 44),
        "line" to Color.rgb(158, 132, 84), "ink" to Color.rgb(246, 240, 228),
        "muted" to Color.rgb(226, 216, 196), "disc" to Color.rgb(90, 81, 68),
        "discLine" to Color.rgb(120, 106, 82), "gold" to gold,
        "glow" to Color.argb(64, 233, 189, 114), "div" to Color.rgb(96, 86, 70)
    )

    private fun openPanel() {
        val w = wm ?: return
        panelLight = runCatching { JSONObject(nowJson).optBoolean("light") }.getOrDefault(false)
        wordsOn = runCatching { JSONObject(nowJson).optBoolean("words", true) }.getOrDefault(true)
        val c = pal()
        // The panel is a small stage: gradient card, a gold glow lying on its top
        // like the player's, then the content.
        val stage = FrameLayout(this)
        val cardBg = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, intArrayOf(c["bg1"]!!, c["bg2"]!!)).apply {
            cornerRadius = dp(24).toFloat()
            setStroke(dp(1), c["line"]!!)
        }
        stage.background = cardBg
        stage.elevation = dp(14).toFloat()
        val glow = View(this).apply {
            background = GradientDrawable().apply {
                gradientType = GradientDrawable.RADIAL_GRADIENT
                gradientRadius = dp(190).toFloat()
                colors = intArrayOf(c["glow"]!!, Color.TRANSPARENT)
            }
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, dp(120), Gravity.TOP)
        }
        stage.addView(glow)
        val card = object : LinearLayout(this) {
            override fun onWindowFocusChanged(hasWindowFocus: Boolean) {
                super.onWindowFocusChanged(hasWindowFocus)
                // The panel holding the window's focus is one of the moments
                // Android lets an app look at the clipboard: with the lever on,
                // gaining focus re-reads (debounced), so copying and then
                // touching the bubble is never a missed chance.
                if (hasWindowFocus && lever(this@BubbleService)) {
                    val now = System.currentTimeMillis()
                    if (now - lastFocusTry > 1200) { lastFocusTry = now; handler.postDelayed({ readClip(false, allowBlink = false) }, 120) }
                }
            }
        }.apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(16), dp(18), dp(16))
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT)
        }
        stage.addView(card)
        titleV = TextView(this).apply {
            setTextColor(c["ink"]!!); textSize = 17f; typeface = Typeface.SERIF
            setTypeface(typeface, Typeface.BOLD)
            maxLines = 1; ellipsize = android.text.TextUtils.TruncateAt.END
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        subV = TextView(this).apply { setTextColor(c["muted"]!!); textSize = 12f }
        val titleRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        titleRow.addView(titleV)
        val markB = TextView(this).apply {
            text = "⚑"; setTextColor(c["gold"]!!); textSize = 14f; gravity = Gravity.CENTER
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(c["disc"]!!); setStroke(dp(1), c["discLine"]!!) }
            contentDescription = "Mark this moment"
            layoutParams = LinearLayout.LayoutParams(dp(32), dp(32)).apply { marginStart = dp(8) }
            setOnClickListener { showMarkHint() }
        }
        titleRow.addView(markB)
        // The save key (Oscar's scenario): a copied text is playing temporarily
        // and the wish strikes — one tap turns the temporary into a permanent
        // Library resident. It sits by the title, where the text is named.
        val saveB = TextView(this).apply {
            text = "+"; setTextColor(c["gold"]!!); textSize = 18f; gravity = Gravity.CENTER
            setTypeface(typeface, Typeface.BOLD)
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(c["disc"]!!); setStroke(dp(1), c["discLine"]!!) }
            contentDescription = s("Save this text to the Library", "Guardar este texto en la Biblioteca")
            layoutParams = LinearLayout.LayoutParams(dp(32), dp(32)).apply { marginStart = dp(8) }
            setOnClickListener {
                showHintCard(s("Save to Library", "Guardar en Biblioteca"), s("Save what's playing to your Library, to hear it again anytime.", "Guarda lo que suena en tu Biblioteca, para oírlo cuando quieras."), s("Save", "Guardar"), s("Not now", "Ahora no")) {
                    val wasSaved = runCatching { JSONObject(nowJson).optBoolean("saved") }.getOrDefault(false)
                    pokeOrWake("save")
                    toastSavedWhenTrue(wasSaved)
                }
            }
        }
        titleRow.addView(saveB)
        // The stage lock: while it holds, a fresh copy cannot evict what's
        // playing — the audiobook keeps the stage (Oscar's scenario).
        val lockB = TextView(this).apply {
            text = if (isLocked(this@BubbleService)) "🔒" else "🔓"
            setTextColor(c["gold"]!!); textSize = 13f; gravity = Gravity.CENTER
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(c["disc"]!!); setStroke(dp(1), c["discLine"]!!) }
            contentDescription = "Lock the stage"
            layoutParams = LinearLayout.LayoutParams(dp(32), dp(32)).apply { marginStart = dp(8) }
            setOnClickListener { showLockHint() }
        }
        lockBtn = lockB
        titleRow.addView(lockB)
        card.addView(titleRow)
        card.addView(subV)
        // THE WORDS (1.4.102): the panel reads along. A serif zone under the
        // status line — on the tablet, the sentence before and after ride
        // dimmed beside the one sounding; on the phone, the sounding
        // sentence alone. Hidden whenever there are no words to show.
        val wv = TextView(this).apply {
            setTextColor(c["ink"]!!)
            textSize = wordsTextSize()
            typeface = Typeface.SERIF
            setLineSpacing(0f, 1.3f)
            movementMethod = android.text.method.ScrollingMovementMethod.getInstance()
            isVerticalScrollBarEnabled = false
            setFadingEdgeLength(dp(16))
            setVerticalFadingEdgeEnabled(true)
            visibility = View.GONE
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, wordsHeight()).apply { topMargin = dp(10) }
        }
        wordsV = wv
        attachSentenceScrub(wv)
        card.addView(wv)
        val spec = SpectrumView(this, c["gold"]!!)
        spec.layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(30)).apply { topMargin = dp(8) }
        spectrum = spec
        card.addView(spec)
        val controls = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(12), 0, dp(4))
        }
        fun mediaBtn(res: Int, label: String, cmd: String, size: Int, ring: Int): ImageButton = ImageButton(this).apply {
            setImageResource(res)
            setColorFilter(if (cmd == "toggle") c["gold"]!! else c["ink"]!!)
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(c["disc"]!!)
                setStroke(dp(if (cmd == "toggle") 2 else 1), ring)
            }
            contentDescription = label
            layoutParams = LinearLayout.LayoutParams(dp(size), dp(size)).apply { marginEnd = dp(10) }
            setOnClickListener { pokeOrWake(cmd); handler.postDelayed({ refreshPanel() }, 350) }
        }
        controls.gravity = Gravity.CENTER
        fun speedBtn(glyph: String, label: String, cmd: String): TextView = TextView(this).apply {
            text = glyph; setTextColor(c["muted"]!!); textSize = 18f; gravity = Gravity.CENTER
            setTypeface(typeface, Typeface.BOLD)
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(c["disc"]!!)
                setStroke(dp(1), c["discLine"]!!)
            }
            contentDescription = label
            layoutParams = LinearLayout.LayoutParams(dp(38), dp(38)).apply { marginEnd = dp(10) }
            setOnClickListener { pokeOrWake(cmd); handler.postDelayed({ refreshPanel() }, 350) }
        }
        val slowB = speedBtn("−", "Slower", "slower")
        // Seek glyphs, not track glyphs (1.4.118, Oscar): the bar promised
        // another audio; these keys step one sentence — a few seconds — so
        // they wear the double triangle of rew/ff, kin to play/pause.
        val prevB = mediaBtn(android.R.drawable.ic_media_rew, "Previous sentence", "prev", 46, c["discLine"]!!)
        toggleB = mediaBtn(android.R.drawable.ic_media_play, "Play or pause", "toggle", 54, c["gold"]!!)
        val nextB = mediaBtn(android.R.drawable.ic_media_ff, "Next sentence", "next", 46, c["discLine"]!!)
        val fastB = speedBtn("+", "Faster", "faster")
        fastB.layoutParams = (fastB.layoutParams as LinearLayout.LayoutParams).apply { marginEnd = 0 }
        // The watchdog (Oscar: 'no responde al tacto'): a landed toggle always
        // flips the playing bit in the pushed state. If a breath later it has
        // not moved, the bridge is a zombie — escalate to the full wake, with
        // the session recovery behind it.
        toggleB?.setOnClickListener {
            // A press is a definite intent, never a bare toggle (1.4.89):
            // the pushed state says what is true NOW, so his finger means
            // PAUSE when it says playing and PLAY when it says paused. A
            // stored press keeps that meaning across any wake — before
            // this, a pause stored against a dead page was 'fulfilled' by
            // the recovery PLAYING the session: the pause became a play,
            // and every fresh press re-ran the same inversion.
            // The truth belongs to whoever is DRIVING (1.4.116): while the
            // device voice holds the stage, the page's last push is a dead
            // letter — a takeover that began from a page that never got to
            // say "playing" leaves it false forever, and every press then
            // computes "play": the pause key could not pause. Ever. Oscar
            // met exactly that: tapping pause while the device voice read
            // re-issued play, and the reading would not stop.
            val before = if (NativeSpeaker.active) NativeSpeaker.playing
                else runCatching { JSONObject(nowJson).optBoolean("playing") }.getOrDefault(false)
            val intent = if (before) "pause" else "play"
            pokeOrWake(intent)
            handler.postDelayed({ refreshPanel() }, 350)
            handler.postDelayed({
                val after = runCatching { JSONObject(nowJson).optBoolean("playing") }.getOrDefault(before)
                if (!NativeSpeaker.active && after == before) pokeOrWake(intent, force = true)
            }, 1200)
            // The last rung: even the wake changed nothing — the page itself
            // is a corpse. Reload it in place; the fresh page collects the
            // stored INTENT (a pause stays a pause — silence needs no
            // resurrection), and any waiting catch is recovered on its own.
            handler.postDelayed({
                val after2 = runCatching { JSONObject(nowJson).optBoolean("playing") }.getOrDefault(before)
                if (!NativeSpeaker.active && after2 == before) poke?.invoke("reload")
            }, 2600)
        }
        controls.addView(slowB); controls.addView(prevB); controls.addView(toggleB); controls.addView(nextB); controls.addView(fastB)
        ctlSlow = slowB; ctlPrev = prevB; ctlNext = nextB; ctlFast = fastB
        fitControls()
        card.addView(controls)
        val seekW = SeekBar(this).apply {
            max = 1000
            // The line's height is DECLARED in the drawables (1.4.107): it
            // used to exist only as the insets' arithmetic (24 − 10 − 10),
            // and some Androids (Oscar's phone) size the track from the
            // layers' own height — none declared, no line, only the thumb
            // (which always had its size) survived. The tablet stretched
            // it anyway; now both read the same 4dp from the same place.
            val trackD = GradientDrawable().apply { setColor(c["div"]!!); cornerRadius = dp(2).toFloat(); setSize(-1, dp(4)) }
            val fillD = ClipDrawable(GradientDrawable().apply { setColor(c["gold"]!!); cornerRadius = dp(2).toFloat(); setSize(-1, dp(4)) }, Gravity.START, ClipDrawable.HORIZONTAL)
            val ld = LayerDrawable(arrayOf(trackD, fillD))
            ld.setId(0, android.R.id.background); ld.setId(1, android.R.id.progress)
            ld.setLayerInset(0, 0, dp(10), 0, dp(10)); ld.setLayerInset(1, 0, dp(10), 0, dp(10))
            progressDrawable = ld
            thumb = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(c["gold"]!!); setSize(dp(12), dp(12)) }
            setPadding(dp(2), 0, dp(2), 0)
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(24)).apply { topMargin = dp(4) }
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(sb: SeekBar?, pr: Int, fromUser: Boolean) {}
                override fun onStartTrackingTouch(sb: SeekBar?) { seekHeld = true }
                override fun onStopTrackingTouch(sb: SeekBar?) { seekHeld = false; seekFrac = (sb?.progress ?: 0) / 1000.0; if (NativeSpeaker.active) NativeSpeaker.seekTo(seekFrac) else poke?.invoke("seek") }
            })
        }
        seekBar = seekW
        card.addView(seekW)
        val div = View(this).apply {
            setBackgroundColor(c["div"]!!)
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1)).apply { topMargin = dp(8); bottomMargin = dp(12) }
        }
        card.addView(div)
        val clipRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val leverLabel = TextView(this).apply {
            text = "Auto"
            setTextColor(c["muted"]!!); textSize = 12.5f
        }
        clipRow.addView(leverLabel)
        val leverS = Switch(this).apply {
            isChecked = lever(this@BubbleService)
            val goldStates = android.content.res.ColorStateList(
                arrayOf(intArrayOf(android.R.attr.state_checked), intArrayOf()),
                intArrayOf(c["gold"]!!, Color.rgb(140, 130, 115))
            )
            thumbTintList = goldStates
            trackTintList = goldStates
            setOnCheckedChangeListener { _, on ->
                prefs(this@BubbleService).edit().putBoolean("auto", on).apply()
                poke?.invoke("lever")
                if (on) readClip(false)
            }
        }
        clipRow.addView(leverS)
        val spacer2 = View(this).apply { layoutParams = LinearLayout.LayoutParams(0, 1, 1f) }
        clipRow.addView(spacer2)
        // Paste now is gone (1.4.117, Oscar): a copied text arrives on its
        // own now — the catch delivers it without being asked — so a manual
        // paste key in the footer only repeated what already happened.
        val hideB = TextView(this).apply {
            text = s("Hide bubble", "Ocultar")
            setTextColor(c["muted"]!!); textSize = 12.5f
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { leftMargin = dp(16) }
            setOnClickListener { showHideHint() }
        }
        clipRow.addView(hideB)
        card.addView(clipRow)
        // The reader's grip: two small gold ticks hugging the panel's free
        // corner. Drag it and the reader stretches (see applyReaderScale).
        val grip = object : View(this) {
            override fun onDraw(cv: android.graphics.Canvas) {
                super.onDraw(cv)
                val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
                    color = c["gold"]!!; alpha = 150; style = android.graphics.Paint.Style.STROKE
                    strokeWidth = dp(2).toFloat(); strokeCap = android.graphics.Paint.Cap.ROUND
                }
                val cxp = if (gripFreeR) width.toFloat() else 0f
                val cyp = if (gripFreeB) height.toFloat() else 0f
                val ix = if (gripFreeR) -1f else 1f
                val iy = if (gripFreeB) -1f else 1f
                val arm = dp(12).toFloat()
                for (inset in intArrayOf(dp(6), dp(12))) {
                    val path = android.graphics.Path()
                    path.moveTo(cxp + ix * inset, cyp + iy * arm)
                    path.lineTo(cxp + ix * inset, cyp + iy * inset)
                    path.lineTo(cxp + ix * arm, cyp + iy * inset)
                    cv.drawPath(path, paint)
                }
            }
        }
        grip.contentDescription = s("Resize the reader", "Cambiar el tamaño del lector")
        grip.visibility = View.GONE
        grip.layoutParams = FrameLayout.LayoutParams(dp(30), dp(30), Gravity.BOTTOM or Gravity.END)
        var dragX0 = 0f; var dragY0 = 0f; var dragW0 = 1f; var dragH0 = 1f
        grip.setOnTouchListener { v, e ->
            when (e.action) {
                MotionEvent.ACTION_DOWN -> {
                    dragX0 = e.rawX; dragY0 = e.rawY; dragW0 = curScaleW(); dragH0 = curScaleH()
                    v.parent?.requestDisallowInterceptTouchEvent(true)
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val gx = if (gripFreeR) e.rawX - dragX0 else -(e.rawX - dragX0)
                    val gy = if (gripFreeB) e.rawY - dragY0 else -(e.rawY - dragY0)
                    val nsW = (dragW0 + gx / dp(240)).coerceIn(0.75f, 1.9f)
                    val nsH = (dragH0 + gy / dp(240)).coerceIn(0.75f, 1.9f)
                    if (kotlin.math.abs(nsW - curScaleW()) > 0.005f || kotlin.math.abs(nsH - curScaleH()) > 0.005f) {
                        panelScaleW = nsW; panelScaleH = nsH; applyReaderScale(false)
                    }
                    true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> { applyReaderScale(true); true }
                else -> false
            }
        }
        gripV = grip
        stage.addView(grip)
        val p = WindowManager.LayoutParams(
            panelWidth(), WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
            PixelFormat.TRANSLUCENT
        ).apply { gravity = Gravity.TOP or Gravity.START }
        panelParams = p
        stage.setOnTouchListener { _, e -> if (e.action == MotionEvent.ACTION_OUTSIDE) { outsideClosedAt = System.currentTimeMillis(); collapsePanel(); true } else false }
        runCatching { w.addView(stage, p) }
        panel = stage
        positionPanel()
        handler.removeCallbacks(fadeRun)
        bubble?.let { if (it.alpha < 1f) { it.animate().cancel(); it.alpha = 1f } }
        // A short, smooth birth: the panel grows out of the λ's own position.
        val bp2 = bubbleParams
        stage.pivotX = if (seatRight) panelWidth().toFloat() else 0f
        // It grows out of the very corner that grazes the λ.
        stage.pivotY = if (seatBottom) dp(320).toFloat() else 0f
        stage.scaleX = 0.86f; stage.scaleY = 0.86f; stage.alpha = 0f
        stage.animate().scaleX(1f).scaleY(1f).alpha(1f).setDuration(190).setInterpolator(DecelerateInterpolator()).start()
        // Once laid out, its real height gets the final word on the spot.
        stage.post { positionPanel() }
        refreshPanel()
        // The tap that opened the panel is the moment Android allows: with the
        // lever on, what was just copied takes the stage.
        if (lever(this)) handler.postDelayed({ readClip(false) }, 260)
        // And when the catch lands, the bubble itself answers with its rings —
        // "¡lo tengo!" — the wave at the one moment Android lets it know.
        val deliveriesBefore = deliveries
        handler.postDelayed({ if (deliveries != deliveriesBefore) cheer() }, 900)
        handler.postDelayed({ if (deliveries != deliveriesBefore) cheer() }, 1900)
    }

    // THE BUBBLE SITS ON THE PANEL'S CORNER (Oscar, correcting 1.4.94):
    // the bubble never moves on its own. The panel deploys so that one
    // of its own corners lands exactly under the bubble's centre — the
    // λ ends up pinned ON the corner of the rectangle, at the end of
    // the arrow from the rectangle's centre to its corner — wherever
    // on the screen the pair happens to be. Top-left corner when the
    // bubble lives on the left, top-right on the right; the matching
    // bottom corner when the panel must deploy upward instead.
    // Which corner of the panel grazes the bubble, from the last seating.
    private var seatRight = false
    private var seatBottom = false

    // THE CORNER GRAZES THE CIRCLE (Oscar, refining 1.4.95): the panel
    // and the bubble must NOT overlap. The rectangle's corner point
    // travels the diagonal from the bubble's centre until it just
    // touches the bubble's circle — the corner rests on the circle's
    // edge, in that direction, and no further.
    private fun positionPanel() {
        val p = panelParams ?: return
        val bp = bubbleParams ?: return
        val sw2 = resources.displayMetrics.widthPixels
        val sh2 = resources.displayMetrics.heightPixels
        val pw = panelWidth()
        val margin = dp(10)
        val cx = bp.x + bubbleHalf()
        val cy = bp.y + bubbleHalf()
        val ph = panel?.height?.takeIf { it > 0 } ?: dp(320)
        // The corner travels the diagonal toward the circle — but the
        // panel's corners are rounded (24dp), which pulls the DRAWN
        // edge back along that same diagonal by R·(√2−1) ≈ 10dp. The
        // geometric corner aims inside the circle by that much, so
        // the drawn corner ends ~2dp from the circle: a short graze,
        // never an overlap.
        val r = bubbleFace() / 2
        val dist = r + dp(2) - (dp(24) * 0.4142f).toInt()
        val d = (dist * 0.7071f).toInt()
        seatRight = cx >= sw2 / 2
        seatBottom = !(cy + d + ph <= sh2 - margin) && (cy - d - ph >= margin)
        // The grip rides the corner opposite the seated one — the free one.
        val nfr = !seatRight; val nfb = !seatBottom
        gripV?.let { g ->
            val lp = g.layoutParams as? FrameLayout.LayoutParams
            val ng = (if (nfb) Gravity.BOTTOM else Gravity.TOP) or (if (nfr) Gravity.END else Gravity.START)
            if (lp != null && lp.gravity != ng) { lp.gravity = ng; g.layoutParams = lp }
            if (nfr != gripFreeR || nfb != gripFreeB) { gripFreeR = nfr; gripFreeB = nfb; g.invalidate() }
        }
        p.x = (if (seatRight) cx - d - pw else cx + d).coerceIn(margin, (sw2 - pw - margin).coerceAtLeast(margin))
        p.y = if (seatBottom) cy - d - ph else (cy + d).coerceAtMost((sh2 - ph - margin).coerceAtLeast(margin))
        panel?.let { v -> runCatching { wm?.updateViewLayout(v, p) } }
    }

    /** The panel's buttons explain themselves first (Oscar): a small floating
     *  card naming what the button does, the deed one clear tap away. */
    private fun showHintCard(title: String, body: String, confirmLabel: String, cancelLabel: String, action: () -> Unit) {
        dismissSaveHint()
        val w = wm ?: return
        val c = cardPal()
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(16), dp(18), dp(14))
            background = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, intArrayOf(c["bg1"]!!, c["bg2"]!!)).apply {
                cornerRadius = dp(20).toFloat()
                setStroke(dp(1), c["line"]!!)
            }
            elevation = dp(16).toFloat()
        }
        card.addView(TextView(this).apply {
            text = title
            setTextColor(c["ink"]!!); textSize = 15f; typeface = Typeface.SERIF
            setTypeface(typeface, Typeface.BOLD)
        })
        card.addView(TextView(this).apply {
            text = body
            setTextColor(c["muted"]!!); textSize = 12.5f
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(6) }
        })
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.END
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(12) }
        }
        if (cancelLabel.isNotEmpty()) row.addView(TextView(this).apply {
            text = cancelLabel; setTextColor(c["muted"]!!); textSize = 13f; gravity = Gravity.CENTER
            setPadding(dp(12), dp(8), dp(12), dp(8))
            setOnClickListener { dismissSaveHint() }
        })
        row.addView(TextView(this).apply {
            text = confirmLabel; setTextColor(c["gold"]!!); textSize = 13f; gravity = Gravity.CENTER
            setTypeface(typeface, Typeface.BOLD)
            setPadding(dp(12), dp(8), dp(4), dp(8))
            setOnClickListener { dismissSaveHint(); action() }
        })
        card.addView(row)
        val p = WindowManager.LayoutParams(dp(300), WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT).apply { gravity = Gravity.CENTER }
        runCatching { w.addView(card, p) }
        saveHint = card
        card.alpha = 0f; card.animate().alpha(1f).setDuration(160).start()
        val r = Runnable { dismissSaveHint() }
        saveHintRun = r
        handler.postDelayed(r, 9000)
    }

    /** The lock explains itself, like every panel button: what it holds, and
     *  what letting go restores. (A hand paste inside the app itself was
     *  never the lock's business; the panel's Paste now key is gone since
     *  1.4.117 — catches arrive on their own.) */
    private fun showLockHint() {
        if (isLocked(this)) {
            showHintCard(s("Unlock the stage", "Desbloquear la escena"), s("Unlocked: a fresh copy will replace what is playing.", "Desbloqueada: una copia nueva reemplazará lo que suena."), s("Unlock", "Desbloquear"), s("Keep locked", "Dejar bloqueado")) {
                setLocked(this@BubbleService, false)
                lockBtn?.text = "🔓"
            }
        } else {
            showHintCard(s("Lock the stage", "Bloquear la escena"), s("Locked: a copied text won't replace what you're hearing.", "Bloqueada: un texto copiado no reemplazará lo que estás oyendo."), s("Lock", "Bloquear"), s("Not now", "Ahora no")) {
                setLocked(this@BubbleService, true)
                lockBtn?.text = "🔒"
            }
        }
    }

    /** The ⚑ asks where its mark would live (Oscar): on saved content it marks
     *  at once (a moment cannot wait for a card) and teaches itself a single
     *  time; on a text that is not in the Library it refuses kindly and offers
     *  the save first — marks on unsaved audio would be lost in the dark. */
    /** "Saved" is claimed only once the page's own state says so (1.4.108,
     *  audit E-1): the shell used to toast «Saved to Library» in the same
     *  tap that SENT the save poke — before the page had saved anything,
     *  and even when there was nothing to save. Now the confirm captures
     *  whether the text was already saved, and the toast fires only if
     *  the page's pushed state flips to saved afterwards. When it does
     *  not, silence — the page's own toast tells the reason in the app. */
    private fun toastSavedWhenTrue(wasSaved: Boolean) {
        if (wasSaved) return
        var fired = false
        for (delay in longArrayOf(900, 2200)) {
            handler.postDelayed({
                if (!fired && runCatching { JSONObject(nowJson).optBoolean("saved") }.getOrDefault(false)) {
                    fired = true
                    Toast.makeText(this, s("Saved to Library", "Guardado en Biblioteca"), Toast.LENGTH_SHORT).show()
                }
            }, delay)
        }
    }

    private fun showMarkHint() {
        val saved = runCatching { JSONObject(nowJson).optBoolean("saved") }.getOrDefault(false)
        if (saved) {
            pokeOrWake("mark")
            if (!prefs(this).getBoolean("markTaught", false)) {
                prefs(this).edit().putBoolean("markTaught", true).apply()
                showHintCard(s("The ⚑ mark", "La marca ⚑"), s("The ⚑ marks this moment. Find it in Library, under Saved Marks.", "La ⚑ marca este momento. La encuentras en Biblioteca, en Marcas guardadas."), s("Got it", "Entendido"), "") { }
            }
        } else {
            showHintCard(s("Not in your Library yet", "Aún no está en tu Biblioteca"), s("Marks live with their audio. Save this text to your Library first.", "Las marcas viven con su audio. Guarda primero este texto en tu Biblioteca."), s("Save to Library", "Guardar en Biblioteca"), s("Not now", "Ahora no")) {
                val wasSaved = runCatching { JSONObject(nowJson).optBoolean("saved") }.getOrDefault(false)
                pokeOrWake("save")
                toastSavedWhenTrue(wasSaved)
            }
        }
    }

    /** Removing the bubble asks first (1.4.117, Oscar): a small card, the
     *  deed one tap away, and the way back named — Settings always holds it. */
    private fun showHideHint() {
        showHintCard(s("Remove the bubble?", "¿Quitar la burbuja?"), s("You can always turn it back on in Settings.", "Puedes volver a activarla en Ajustes."), s("Remove", "Quitar"), s("Not now", "Ahora no")) {
            collapsePanel(); stopBubble()
        }
    }

    private fun dismissSaveHint() {
        saveHintRun?.let { handler.removeCallbacks(it) }; saveHintRun = null
        saveHint?.let { v -> runCatching { wm?.removeView(v) } }
        saveHint = null
    }

    private fun collapsePanel(now: Boolean = false) {
        dismissSaveHint()
        val v = panel
        panel = null; panelParams = null; titleV = null; subV = null; toggleB = null; seekBar = null; seekHeld = false; spectrum = null; wordsV = null; gripV = null; lastWordsKey = ""; lastWi = -2; wordsScrollAnim?.cancel(); wordsScrollAnim = null; scrubTarget = -1; scrubMode = 0
        if (!now) { handler.removeCallbacks(fadeRun); handler.postDelayed(fadeRun, 4000) }
        if (!now && deliveries != lastDeliverySeen) {
            lastDeliverySeen = deliveries
            if (System.currentTimeMillis() - lastDeliveryAt < 20000) handler.postDelayed({ invite(2, force = true) }, 250)
        }
        if (v == null) return
        if (now) { runCatching { wm?.removeView(v) }; return }
        v.animate().alpha(0f).scaleX(0.93f).scaleY(0.93f).setDuration(120)
            .withEndAction { runCatching { wm?.removeView(v) } }.start()
    }

    /** The sentence is a handle (1.4.119, Oscar): slide the reading-along
     *  text sideways and the reading scrubs with it — right goes forward,
     *  left goes back — the progress bar following the finger live, one
     *  sentence per short step of travel, the seek landing when the finger
     *  lifts. Vertical drags keep their old job (the words still scroll);
     *  only a clearly horizontal slide is claimed, and the words themselves
     *  lean with the finger while it travels. */
    private fun attachSentenceScrub(wv: TextView) {
        wv.setOnTouchListener { v, ev ->
            when (ev.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    scrubX0 = ev.x; scrubY0 = ev.y; scrubMode = 0
                    false // the scroll method still anchors on the way in
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = ev.x - scrubX0; val dy = ev.y - scrubY0
                    if (scrubMode == 0) {
                        if (kotlin.math.abs(dx) > dp(10) && kotlin.math.abs(dx) > 1.5f * kotlin.math.abs(dy) && lastCt > 1 && lastCi >= 0) {
                            scrubMode = 1; scrubFrom = lastCi; scrubTarget = lastCi
                            seekHeld = true
                            wordsScrollAnim?.cancel()
                        } else if (kotlin.math.abs(dy) > dp(10)) scrubMode = 2
                    }
                    if (scrubMode == 1) {
                        val step = dp(26).coerceAtLeast(1)
                        val t = (scrubFrom + Math.round(dx / step)).coerceIn(0, lastCt - 1)
                        if (t != scrubTarget) {
                            scrubTarget = t
                            seekBar?.progress = (((t + 0.5) / lastCt) * 1000).toInt()
                            subV?.text = s("Sentence", "Oración") + " ${t + 1} " + s("of", "de") + " $lastCt"
                        }
                        v.translationX = (dx * 0.4f).coerceIn(-dp(60).toFloat(), dp(60).toFloat())
                        true
                    } else false
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    val was = scrubMode == 1
                    if (was) scrubCommit(v)
                    scrubMode = 0
                    was
                }
                else -> false
            }
        }
    }

    /** Land the sentence scrub through the same door the seek bar uses. */
    private fun scrubCommit(v: View) {
        val t = scrubTarget; val ct = lastCt
        scrubTarget = -1
        v.animate().translationX(0f).setDuration(140).start()
        seekHeld = false
        if (t >= 0 && ct > 0 && t != scrubFrom) {
            seekFrac = t.toDouble() / ct
            if (NativeSpeaker.active) NativeSpeaker.seekTo(seekFrac) else poke?.invoke("seek")
        }
        handler.postDelayed({ refreshPanel() }, 60)
    }

    /** The words zone: the neighbours dimmed, the sounding sentence alive —
     *  its said words in full ink, the word being spoken wearing the amber,
     *  the words still to come in muted — and the little window keeps that
     *  amber word centred, the way the reader does, so the reading is
     *  never out of sight while it sounds. */
    private fun updateWords(j: JSONObject?) {
        val wv = wordsV ?: return
        val tc = j?.optString("tc")?.trim().orEmpty()
        if (!wordsOn || tc.isEmpty()) {
            gripV?.visibility = View.GONE
            if (wv.visibility != View.GONE) { wv.visibility = View.GONE; wordsScrollAnim?.cancel(); panel?.post { positionPanel() } }
            lastWordsKey = ""; lastWi = -2
            return
        }
        val tp = j?.optString("tp")?.trim().orEmpty()
        val tn = j?.optString("tn")?.trim().orEmpty()
        val sentKey = tp + "" + tc + "" + tn
        val wi = j?.optInt("wi", -1) ?: -1
        val sentChanged = sentKey != lastWordsKey
        if (!sentChanged && wi == lastWi && wv.visibility == View.VISIBLE) return
        lastWordsKey = sentKey; lastWi = wi
        val c = pal()
        val ink = c["ink"]!!; val muted = c["muted"]!!; val goldC = c["gold"]!!
        val onGold = Color.rgb(26, 20, 12)
        val sb = SpannableStringBuilder()
        var wordOff = -1
        if (isTablet() && tp.isNotEmpty()) { val st = sb.length; sb.append(tp).append(" "); sb.setSpan(ForegroundColorSpan(muted), st, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE) }
        val words = tc.split(' ')
        var first = true
        for ((i, w) in words.withIndex()) {
            if (!first) sb.append(" ")
            first = false
            val st = sb.length
            sb.append(w)
            when {
                wi < 0 || i < wi -> sb.setSpan(ForegroundColorSpan(ink), st, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                i == wi -> {
                    sb.setSpan(ForegroundColorSpan(onGold), st, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    sb.setSpan(android.text.style.BackgroundColorSpan(goldC), st, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    wordOff = st
                }
                else -> sb.setSpan(ForegroundColorSpan(muted), st, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
        }
        if (isTablet() && tn.isNotEmpty()) { val s2 = sb.length; sb.append(" ").append(tn); sb.setSpan(ForegroundColorSpan(muted), s2, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE) }
        val wasGone = wv.visibility != View.VISIBLE
        wv.text = sb
        wv.visibility = View.VISIBLE
        gripV?.visibility = View.VISIBLE
        if (sentChanged) {
            wv.animate().cancel()
            wv.alpha = if (wasGone) 0f else 0.45f
            wv.animate().alpha(1f).setDuration(if (wasGone) 240 else 180).start()
        }
        val off = wordOff
        wv.post { if (off >= 0) centerWords(off) else if (sentChanged) centerWords(sb.length / 2) }
    }

    /** Keep the amber word in the middle of the little window. */
    private fun centerWords(offset: Int) {
        val wv = wordsV ?: return
        val lay = wv.layout ?: return
        if (offset < 0 || offset > (wv.text?.length ?: 0)) return
        val line = lay.getLineForOffset(offset)
        val top = lay.getLineTop(line); val bottom = lay.getLineBottom(line)
        val maxY = maxOf(0, lay.height - wv.height)
        val target = (top - (wv.height - (bottom - top)) / 2).coerceIn(0, maxY)
        wordsScrollAnim?.cancel()
        if (kotlin.math.abs(target - wv.scrollY) < 2) return
        wordsScrollAnim = ObjectAnimator.ofInt(wv, "scrollY", wv.scrollY, target).apply {
            duration = 220; interpolator = DecelerateInterpolator(); start()
        }
    }

    private fun refreshPanel() {
        val rawJ = runCatching { JSONObject(nowJson) }.getOrNull()
        progressWatch(rawJ)
        val native = NativeSpeaker.active
        val j = if (native) NativeSpeaker.panelJson() else rawJ
        // The scrub counts in sentences: remember where the reading stands,
        // in the driver's own numbers (page push or device voice alike).
        val jCt = j?.optInt("ct", 0) ?: 0
        if (jCt > 0) { lastCt = jCt; lastCi = j?.optInt("ci", -1) ?: -1 }
        val playing = j?.optBoolean("playing") ?: false
        handler.post {
            titleV?.text = j?.optString("title")?.ifBlank { "Logos" } ?: "Logos"
            if (!native && workingNow(j)) armStallWatch() else disarmStallWatch()
            subV?.text = if (native) j?.optString("sub")
                else if (workingNow(j) && System.currentTimeMillis() - nowAt > 20_000) s("Waiting for Logos…", "Esperando a Logos…")
                else if (j?.optBoolean("busy") == true) s("Processing…", "Procesando…")
                else j?.optString("sub")?.ifBlank { s("Ready", "Listo") } ?: s("Ready", "Listo")
            if (scrubTarget >= 0 && lastCt > 0) subV?.text = s("Sentence", "Oración") + " ${scrubTarget + 1} " + s("of", "de") + " $lastCt"
            lockBtn?.text = if (isLocked(this@BubbleService)) "🔒" else "🔓"
            toggleB?.setImageResource(if (playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play)
            playingNow = playing
            seekBar?.let { if (!seekHeld) it.progress = ((j?.optDouble("frac", 0.0) ?: 0.0) * 1000).toInt() }
            spectrum?.let { sp ->
                val arr = j?.optJSONArray("bars")
                if (arr == null) sp.rest()
                else {
                    val t = FloatArray(arr.length())
                    for (i in 0 until arr.length()) t[i] = (arr.optDouble(i, 0.0) / 100.0).toFloat()
                    sp.setTargets(t)
                }
            }
            wordsOn = j?.optBoolean("words", true) ?: true
            updateWords(j)
            val h = halo
            if (playing && h != null) {
                if (haloAnim == null) {
                    h.visibility = View.VISIBLE
                    haloAnim = ObjectAnimator.ofFloat(h, "alpha", 0.25f, 0.85f).apply {
                        duration = 1100; repeatMode = ValueAnimator.REVERSE; repeatCount = ValueAnimator.INFINITE; start()
                    }
                }
            } else if (h != null) {
                haloAnim?.cancel(); haloAnim = null; h.visibility = View.INVISIBLE
            }
        }
    }

    private fun readClip(manual: Boolean, allowBlink: Boolean = true) {
        trySource = "the panel"
        val direct = readClipboard(this)
        if (direct.isNotEmpty()) {
            deliver(this, direct, manual)
            if (manual) collapsePanel()
            return
        }
        if (!allowBlink) return // focus retries read directly only — never a blink loop
        val now = System.currentTimeMillis()
        if (!manual && now - lastTrampoline < 2500) { noteTry(this, s("the panel saw the clipboard empty", "el panel vio el portapapeles vacío")); return }
        lastTrampoline = now
        pendingManual = manual
        if (manual) {
            // The guaranteed floor: if neither the panel nor the blink could read
            // within a second, open Logos — the page, in front and focused, reads
            // the clipboard itself (wantClip tells it this was asked by hand).
            val before = deliveries
            handler.postDelayed({
                if (deliveries == before) {
                    wantClip = true
                    noteTry(this, s("opened Logos to read it", "abrió Logos para leerlo"))
                    runCatching { startActivity(Intent(this, MainActivity::class.java).setAction(Intent.ACTION_MAIN).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                }
            }, 1000)
        }
        // Android 14's sanctioned route for a background start: a pending intent
        // that explicitly allows it. ClipActivity blinks, reads under its brief
        // focus, and is gone.
        runCatching {
            val intent = Intent(this, ClipActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NO_ANIMATION)
            val pi = if (android.os.Build.VERSION.SDK_INT >= 34) {
                val opts = ActivityOptions.makeBasic()
                    .setPendingIntentBackgroundActivityStartMode(ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED)
                    .toBundle()
                PendingIntent.getActivity(this, 31, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT, opts)
            } else {
                PendingIntent.getActivity(this, 31, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            }
            pi.send()
        }.onFailure {
            if (manual) Toast.makeText(this, s("Couldn't read the clipboard here", "No se pudo leer el portapapeles aquí"), Toast.LENGTH_SHORT).show()
        }
    }

    override fun onDestroy() {
        NativeSpeaker.shutdown()
        // The house is gone; its page dies with it (1.4.128) — a
        // parentless page would keep speaking with no switch left.
        Backstage.evictAndDestroy()
        releaseWakeLock()
        retireHoldFile(this)
        handler.removeCallbacks(fadeRun)
        hideTargets()
        collapsePanel(now = true)
        bubble?.let { runCatching { wm?.removeView(it) } }
        bubble = null
        haloAnim?.cancel()
        if (onNow != null) onNow = null
        running = false
        super.onDestroy()
    }
}
