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
import android.graphics.Color
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
        /** A clipboard text waiting for the page to pull it through the bridge. */
        var clipText: String? = null
        var clipManual = false
        /** Latest player state pushed by the page (JSON: playing, active, title, sub). */
        var nowJson = ""
        var onNow: (() -> Unit)? = null
        var running = false
        /** Set when Paste & play could not read from the bubble: the page reads it itself as Logos opens. */
        var wantClip = false
        var deliveries = 0
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
            val key = text.length * 31 + text.hashCode()
            if (!manual && key == lastKey) return
            lastKey = key
            deliveries++
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
    private var panel: View? = null
    private var panelParams: WindowManager.LayoutParams? = null
    private var titleV: TextView? = null
    private var subV: TextView? = null
    private var toggleB: ImageButton? = null
    private val handler = Handler(Looper.getMainLooper())

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    override fun onBind(i: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel("bubble", "Floating bubble", NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) })
        onNow = { refreshPanel() }
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
    }

    private fun attachDrag(v: View, p: WindowManager.LayoutParams) {
        var downX = 0f; var downY = 0f; var startX = 0; var startY = 0; var moved = false
        v.setOnTouchListener { _, e ->
            when (e.action) {
                MotionEvent.ACTION_DOWN -> { downX = e.rawX; downY = e.rawY; startX = p.x; startY = p.y; moved = false; true }
                MotionEvent.ACTION_MOVE -> {
                    val dx = e.rawX - downX; val dy = e.rawY - downY
                    if (Math.abs(dx) + Math.abs(dy) > dp(9)) moved = true
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
                    val target = hoverTarget
                    hideTargets()
                    when {
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
                MotionEvent.ACTION_CANCEL -> { hideTargets(); if (moved) snapEdge(v, p); true }
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

    private fun pal(): Map<String, Int> = if (panelLight) mapOf(
        "bg1" to Color.rgb(251, 247, 238), "bg2" to Color.rgb(240, 232, 214),
        "line" to Color.rgb(206, 188, 148), "ink" to Color.rgb(34, 28, 18),
        "muted" to Color.rgb(122, 108, 85), "disc" to Color.rgb(255, 255, 255),
        "discLine" to Color.rgb(216, 201, 168), "gold" to Color.rgb(154, 102, 20),
        "glow" to Color.argb(46, 233, 189, 114), "div" to Color.rgb(224, 211, 182)
    ) else mapOf(
        "bg1" to Color.rgb(34, 29, 23), "bg2" to Color.rgb(19, 16, 13),
        "line" to Color.rgb(96, 80, 54), "ink" to Color.rgb(245, 239, 227),
        "muted" to Color.rgb(173, 161, 141), "disc" to Color.rgb(46, 40, 32),
        "discLine" to Color.rgb(74, 64, 51), "gold" to gold,
        "glow" to Color.argb(64, 233, 189, 114), "div" to Color.rgb(58, 50, 40)
    )

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
        }
        subV = TextView(this).apply { setTextColor(c["muted"]!!); textSize = 12f }
        card.addView(titleV)
        card.addView(subV)
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
            setOnClickListener { poke?.invoke(cmd); handler.postDelayed({ refreshPanel() }, 350) }
        }
        controls.gravity = Gravity.CENTER
        val prevB = mediaBtn(android.R.drawable.ic_media_previous, "Previous sentence", "prev", 50, c["discLine"]!!)
        toggleB = mediaBtn(android.R.drawable.ic_media_play, "Play or pause", "toggle", 58, c["gold"]!!)
        val nextB = mediaBtn(android.R.drawable.ic_media_next, "Next sentence", "next", 50, c["discLine"]!!)
        nextB.layoutParams = (nextB.layoutParams as LinearLayout.LayoutParams).apply { marginEnd = 0 }
        controls.addView(prevB); controls.addView(toggleB); controls.addView(nextB)
        card.addView(controls)
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
        refreshPanel()
        // The tap that opened the panel is the moment Android allows: with the
        // lever on, what was just copied takes the stage.
        if (lever(this)) handler.postDelayed({ readClip(false) }, 260)
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
        p.y = (bp.y + dp(64)).coerceAtMost(sh2 - dp(240))
        panel?.let { v -> runCatching { wm?.updateViewLayout(v, p) } }
    }

    private fun collapsePanel() {
        panel?.let { runCatching { wm?.removeView(it) } }
        panel = null; panelParams = null; titleV = null; subV = null; toggleB = null
    }

    private fun refreshPanel() {
        val j = runCatching { JSONObject(nowJson) }.getOrNull()
        val playing = j?.optBoolean("playing") ?: false
        handler.post {
            titleV?.text = j?.optString("title")?.ifBlank { "Logos" } ?: "Logos"
            subV?.text = j?.optString("sub")?.ifBlank { "Ready" } ?: "Ready"
            toggleB?.setImageResource(if (playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play)
            val h = halo
            if (playing && h != null) {
                if (h.visibility != View.VISIBLE) {
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
        hideTargets()
        collapsePanel()
        bubble?.let { runCatching { wm?.removeView(it) } }
        bubble = null
        haloAnim?.cancel()
        if (onNow != null) onNow = null
        running = false
        super.onDestroy()
    }
}
