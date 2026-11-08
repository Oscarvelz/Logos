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
        /** The stage lock (Oscar): while on, a fresh copy cannot evict what's playing. */
        fun isLocked(c: Context) = prefs(c).getBoolean("lock", false)
        fun setLocked(c: Context, on: Boolean) { prefs(c).edit().putBoolean("lock", on).apply() }

        /** A clipboard text waiting for the page to pull it through the bridge. */
        var clipText: String? = null
        var clipManual = false
        /** Latest player state pushed by the page (JSON: playing, active, title, sub). */
        var nowJson = ""
        /** When the page last pushed state — the watchdog's pulse. */
        @Volatile var nowAt = 0L
        var onNow: (() -> Unit)? = null
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
        fun deliver(c: Context, text: String, manual: Boolean) {
            if (text.isEmpty()) return
            if (!manual && isLocked(c)) { noteTry(c, "the lock held a copy back"); return }
            val key = text.length * 31 + text.hashCode()
            if (!manual && key == lastKey) return
            lastKey = key
            deliveries++
            lastDeliveryAt = System.currentTimeMillis()
            noteTry(c, "read ${text.length} chars via $trySource")
            clipText = text
            clipManual = manual
            val p = poke
            if (p != null) p("clip")
            else if (manual) {
                // The page is gone: bring Logos forward; the page pulls the clip as it opens.
                runCatching {
                    c.startActivity(Intent(c, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                }
            }
        }

        /** ClipActivity read the clipboard under its brief focus: hand it over. */
        fun deliverFromClip(c: Context, text: String) {
            if (text.isEmpty()) {
                noteTry(c, "the blink found the clipboard empty")
                if (pendingManual) Toast.makeText(c, "Clipboard is empty", Toast.LENGTH_SHORT).show()
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
    private var playingNow = false
    private var lastInvite = 0L
    private var lastDeliverySeen = 0
    private var rippleAnims: List<ObjectAnimator> = emptyList()
    private var panel: View? = null
    private var panelParams: WindowManager.LayoutParams? = null
    private var titleV: TextView? = null
    private var subV: TextView? = null
    private var toggleB: ImageButton? = null
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

    // The ghost rest: four seconds untouched and the bubble fades to a whisper.
    private val fadeRun = Runnable {
        val b = bubble ?: return@Runnable
        if (panel != null || dragTargets.isNotEmpty()) return@Runnable
        b.animate().alpha(0.15f).setDuration(700).start()
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

    /** A panel transport key: hand it to the page — or, when Android has
     *  retired the activity behind the service (the keys go silent), remember
     *  the press and bring Logos forward so the page collects it as it wakes. */
    private fun pokeOrWake(cmd: String, force: Boolean = false) {
        val p = poke
        if (p != null && !force) { p(cmd); return }
        pendingCmd = cmd
        noteTry(this, "panel key woke Logos")
        runCatching { startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    }

    private fun wakeBubble(schedule: Boolean = true) {
        handler.removeCallbacks(fadeRun)
        val b = bubble ?: return
        if (b.alpha < 1f) b.animate().alpha(1f).setDuration(140).start()
        if (schedule) handler.postDelayed(fadeRun, 4000)
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    override fun onBind(i: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel("bubble", "Floating bubble", NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) })
        onNow = { refreshPanel() }
        inviteHook = { invite(3) }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(2, note(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        if (intent?.action == "hide") { stopBubble(); return START_NOT_STICKY }
        if (!Settings.canDrawOverlays(this)) { stopSelf(); return START_NOT_STICKY }
        if (bubble == null) showBubble()
        running = true
        return START_STICKY
    }

    private fun note(): Notification {
        val open = PendingIntent.getActivity(this, 21, Intent(this, MainActivity::class.java).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)
        val hide = PendingIntent.getService(this, 22, Intent(this, BubbleService::class.java).setAction("hide"), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        return Notification.Builder(this, "bubble")
            .setSmallIcon(R.drawable.ic_note)
            .setColor(Color.rgb(23, 19, 16))
            .setContentTitle("Logos bubble")
            .setContentText("Floating over your apps · tap the λ to listen")
            .setContentIntent(open)
            .setOngoing(true)
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .addAction(Notification.Action.Builder(null, "Hide bubble", hide).build())
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
        val size = dp(58) // the window carries a halo ring around the 46dp face
        val root = FrameLayout(this)
        val haloV = View(this).apply {
            background = oval(gold, 0, 0, -1f).apply { alpha = 70 }
            layoutParams = FrameLayout.LayoutParams(dp(52), dp(52), Gravity.CENTER)
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
            layoutParams = FrameLayout.LayoutParams(dp(46), dp(46), Gravity.CENTER)
        }
        val lambda = TextView(this).apply {
            text = "λ"
            setTextColor(gold)
            textSize = 22f
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
            x = sw2 - size - dp(10)
            y = (sh2 * 0.38f).toInt()
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
                poke?.invoke("voice")
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
                            snapEdge(v, p)
                            runCatching { startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)) }
                        }
                        else -> snapEdge(v, p)
                    }
                    true
                }
                MotionEvent.ACTION_CANCEL -> { handler.removeCallbacks(longRun); hideTargets(); if (moved) snapEdge(v, p); true }
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
            target(0, "✕", ink, "Remove", Color.rgb(128, 36, 26), Color.rgb(214, 102, 82), Color.WHITE),
            target(1, "λ", gold, "Open Logos", gold, gold, charcoal)
        )
        hoverTarget = -1
    }

    private fun updateHover(p: WindowManager.LayoutParams) {
        val cx = p.x + dp(29); val cy = p.y + dp(29)
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

    private fun snapEdge(v: View, p: WindowManager.LayoutParams) {
        val sw2 = resources.displayMetrics.widthPixels
        val target = if (p.x + dp(29) < sw2 / 2) dp(4) else sw2 - dp(58) - dp(4)
        val anim = ValueAnimator.ofInt(p.x, target).apply {
            duration = 180
            addUpdateListener { p.x = it.animatedValue as Int; runCatching { wm?.updateViewLayout(v, p) }; if (panel != null) positionPanel() }
        }
        anim.start()
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
    /** The explainer cards wear the family's OTHER pole (Oscar): a cream card
     *  laid on the dark player, a dark note on the light one — never the
     *  player's own tone, so a pop-up can never be mistaken for the player. */
    private fun cardPal(): Map<String, Int> = if (panelLight) darkPal else lightPal

    private fun openPanel() {
        val w = wm ?: return
        panelLight = runCatching { JSONObject(nowJson).optBoolean("light") }.getOrDefault(false)
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
            contentDescription = "Save this text to the Library"
            layoutParams = LinearLayout.LayoutParams(dp(32), dp(32)).apply { marginStart = dp(8) }
            setOnClickListener {
                showHintCard("Save to Library", "Keeps the text playing now in your Library, so you can hear it again whenever you like.", "Save", "Not now") {
                    poke?.invoke("save")
                    Toast.makeText(this@BubbleService, "Saved to Library", Toast.LENGTH_SHORT).show()
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
        val prevB = mediaBtn(android.R.drawable.ic_media_previous, "Previous sentence", "prev", 46, c["discLine"]!!)
        toggleB = mediaBtn(android.R.drawable.ic_media_play, "Play or pause", "toggle", 54, c["gold"]!!)
        val nextB = mediaBtn(android.R.drawable.ic_media_next, "Next sentence", "next", 46, c["discLine"]!!)
        val fastB = speedBtn("+", "Faster", "faster")
        fastB.layoutParams = (fastB.layoutParams as LinearLayout.LayoutParams).apply { marginEnd = 0 }
        // The watchdog (Oscar: 'no responde al tacto'): a landed toggle always
        // flips the playing bit in the pushed state. If a breath later it has
        // not moved, the bridge is a zombie — escalate to the full wake, with
        // the session recovery behind it.
        toggleB?.setOnClickListener {
            val before = runCatching { JSONObject(nowJson).optBoolean("playing") }.getOrDefault(false)
            pokeOrWake("toggle")
            handler.postDelayed({ refreshPanel() }, 350)
            handler.postDelayed({
                val after = runCatching { JSONObject(nowJson).optBoolean("playing") }.getOrDefault(before)
                if (after == before) pokeOrWake("toggle", force = true)
            }, 1200)
        }
        controls.addView(slowB); controls.addView(prevB); controls.addView(toggleB); controls.addView(nextB); controls.addView(fastB)
        card.addView(controls)
        val seekW = SeekBar(this).apply {
            max = 1000
            val trackD = GradientDrawable().apply { setColor(c["div"]!!); cornerRadius = dp(2).toFloat() }
            val fillD = ClipDrawable(GradientDrawable().apply { setColor(c["gold"]!!); cornerRadius = dp(2).toFloat() }, Gravity.START, ClipDrawable.HORIZONTAL)
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
                override fun onStopTrackingTouch(sb: SeekBar?) { seekHeld = false; seekFrac = (sb?.progress ?: 0) / 1000.0; poke?.invoke("seek") }
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
        val pasteNow = TextView(this).apply {
            text = "Paste now"
            setTextColor(c["gold"]!!); textSize = 12.5f
            setTypeface(typeface, Typeface.BOLD)
            setOnClickListener { readClip(true) }
        }
        clipRow.addView(pasteNow)
        val hideB = TextView(this).apply {
            text = "Hide bubble"
            setTextColor(c["muted"]!!); textSize = 12.5f
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { leftMargin = dp(16) }
            setOnClickListener { collapsePanel(); stopBubble() }
        }
        clipRow.addView(hideB)
        card.addView(clipRow)
        val p = WindowManager.LayoutParams(
            dp(302), WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
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
        if (bp2 != null) stage.pivotX = (bp2.x + dp(29) - p.x).coerceIn(0, dp(302)).toFloat()
        stage.pivotY = 0f
        stage.scaleX = 0.86f; stage.scaleY = 0.86f; stage.alpha = 0f
        stage.animate().scaleX(1f).scaleY(1f).alpha(1f).setDuration(190).setInterpolator(DecelerateInterpolator()).start()
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

    private fun positionPanel() {
        val p = panelParams ?: return
        val bp = bubbleParams ?: return
        val sw2 = resources.displayMetrics.widthPixels
        val sh2 = resources.displayMetrics.heightPixels
        val pw = dp(302)
        p.x = when {
            bp.x + dp(29) < sw2 / 2 -> dp(10)
            else -> (sw2 - pw - dp(10)).coerceAtLeast(dp(10))
        }
        p.y = (bp.y + dp(64)).coerceAtMost(sh2 - dp(330))
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
     *  what letting go restores. Paste now (a hand ask) is never locked out. */
    private fun showLockHint() {
        if (isLocked(this)) {
            showHintCard("Unlock the stage", "Copies can take the stage again — a fresh copy will replace what is playing, as before.", "Unlock", "Keep locked") {
                setLocked(this@BubbleService, false)
                lockBtn?.text = "🔓"
            }
        } else {
            showHintCard("Lock the stage", "While locked, copying a text will not replace what you are hearing — your book keeps the stage. Paste now still works when you ask for it.", "Lock", "Not now") {
                setLocked(this@BubbleService, true)
                lockBtn?.text = "🔒"
            }
        }
    }

    /** The ⚑ asks where its mark would live (Oscar): on saved content it marks
     *  at once (a moment cannot wait for a card) and teaches itself a single
     *  time; on a text that is not in the Library it refuses kindly and offers
     *  the save first — marks on unsaved audio would be lost in the dark. */
    private fun showMarkHint() {
        val saved = runCatching { JSONObject(nowJson).optBoolean("saved") }.getOrDefault(false)
        if (saved) {
            poke?.invoke("mark")
            if (!prefs(this).getBoolean("markTaught", false)) {
                prefs(this).edit().putBoolean("markTaught", true).apply()
                showHintCard("Marked", "The ⚑ keeps a mark on what you are hearing — you will find it in Library, under Saved Marks.", "Got it", "") { }
            }
        } else {
            showHintCard("Not in your Library yet", "Marks live with their audio — on an unsaved text, its marks would be hard to find later. Save it to your Library first, and the ⚑ is yours.", "Save to Library", "Not now") {
                poke?.invoke("save")
                Toast.makeText(this@BubbleService, "Saved to Library", Toast.LENGTH_SHORT).show()
            }
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
        panel = null; panelParams = null; titleV = null; subV = null; toggleB = null; seekBar = null; seekHeld = false; spectrum = null
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

    private fun refreshPanel() {
        val j = runCatching { JSONObject(nowJson) }.getOrNull()
        val playing = j?.optBoolean("playing") ?: false
        handler.post {
            titleV?.text = j?.optString("title")?.ifBlank { "Logos" } ?: "Logos"
            subV?.text = if (j?.optBoolean("busy") == true) "Processing…" else j?.optString("sub")?.ifBlank { "Ready" } ?: "Ready"
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
        if (!manual && now - lastTrampoline < 2500) { noteTry(this, "the panel saw the clipboard empty"); return }
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
                    noteTry(this, "opened Logos to read it")
                    runCatching { startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
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
            if (manual) Toast.makeText(this, "Couldn't read the clipboard here", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onDestroy() {
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
