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
        private var lastKey = 0
        private var pendingManual = false
        private var lastTrampoline = 0L

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
                if (pendingManual) Toast.makeText(c, "Clipboard is empty", Toast.LENGTH_SHORT).show()
                return
            }
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
    private var panel: LinearLayout? = null
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
        val size = dp(68) // the window carries a halo ring around the 56dp face
        val root = FrameLayout(this)
        val haloV = View(this).apply {
            background = oval(gold, 0, 0, -1f).apply { alpha = 70 }
            layoutParams = FrameLayout.LayoutParams(dp(64), dp(64), Gravity.CENTER)
            visibility = View.INVISIBLE
        }
        val face = FrameLayout(this).apply {
            background = oval(charcoal, gold, dp(2), -1f)
            layoutParams = FrameLayout.LayoutParams(dp(56), dp(56), Gravity.CENTER)
        }
        val lambda = TextView(this).apply {
            text = "λ"
            setTextColor(gold)
            textSize = 27f
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
                        p.x = (startX + dx).toInt(); p.y = (startY + dy).toInt()
                        runCatching { wm?.updateViewLayout(v, p) }
                        if (panel != null) positionPanel()
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (moved) snapEdge(v, p) else togglePanel()
                    true
                }
                else -> false
            }
        }
    }

    private fun snapEdge(v: View, p: WindowManager.LayoutParams) {
        val sw2 = resources.displayMetrics.widthPixels
        val target = if (p.x + dp(34) < sw2 / 2) dp(4) else sw2 - dp(68) - dp(4)
        val anim = ValueAnimator.ofInt(p.x, target).apply {
            duration = 180
            addUpdateListener { p.x = it.animatedValue as Int; runCatching { wm?.updateViewLayout(v, p) }; if (panel != null) positionPanel() }
        }
        anim.start()
    }

    private fun togglePanel() {
        if (panel != null) { collapsePanel(); return }
        openPanel()
    }

    private fun panelCard(): GradientDrawable = GradientDrawable().apply {
        cornerRadius = dp(20).toFloat()
        setColor(Color.rgb(16, 14, 12))
        setStroke(dp(1), Color.rgb(84, 70, 48))
    }

    private fun openPanel() {
        val w = wm ?: return
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = panelCard()
            setPadding(dp(16), dp(14), dp(16), dp(14))
        }
        titleV = TextView(this).apply {
            setTextColor(ink); textSize = 15.5f; setTypeface(typeface, Typeface.BOLD)
            maxLines = 1; ellipsize = android.text.TextUtils.TruncateAt.END
        }
        subV = TextView(this).apply { setTextColor(muted); textSize = 12f }
        card.addView(titleV)
        card.addView(subV)
        val controls = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(10), 0, dp(4))
        }
        fun mediaBtn(res: Int, label: String, cmd: String): ImageButton = ImageButton(this).apply {
            setImageResource(res)
            setColorFilter(if (cmd == "toggle") gold else ink)
            background = null
            contentDescription = label
            layoutParams = LinearLayout.LayoutParams(dp(52), dp(48))
            setOnClickListener { poke?.invoke(cmd); handler.postDelayed({ refreshPanel() }, 350) }
        }
        val prevB = mediaBtn(android.R.drawable.ic_media_previous, "Previous sentence", "prev")
        toggleB = mediaBtn(android.R.drawable.ic_media_play, "Play or pause", "toggle")
        val nextB = mediaBtn(android.R.drawable.ic_media_next, "Next sentence", "next")
        controls.addView(prevB); controls.addView(toggleB); controls.addView(nextB)
        val spacer = View(this).apply { layoutParams = LinearLayout.LayoutParams(0, 1, 1f) }
        controls.addView(spacer)
        val closeB = TextView(this).apply {
            text = "✕"; setTextColor(muted); textSize = 17f; gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(dp(40), dp(48))
            setOnClickListener { collapsePanel() }
        }
        controls.addView(closeB)
        card.addView(controls)
        val div = View(this).apply {
            setBackgroundColor(Color.rgb(52, 45, 36))
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1)).apply { topMargin = dp(6); bottomMargin = dp(10) }
        }
        card.addView(div)
        val clipRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val pasteB = Button(this).apply {
            text = "Paste & play"
            setTextColor(charcoal)
            textSize = 13.5f
            setTypeface(typeface, Typeface.BOLD)
            background = GradientDrawable().apply { cornerRadius = dp(99).toFloat(); setColor(gold) }
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(40))
            setOnClickListener { readClip(true) }
        }
        clipRow.addView(pasteB)
        val leverLabel = TextView(this).apply {
            text = "Auto"
            setTextColor(muted); textSize = 12.5f
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { leftMargin = dp(14) }
        }
        clipRow.addView(leverLabel)
        val leverS = Switch(this).apply {
            isChecked = lever(this@BubbleService)
            setOnCheckedChangeListener { _, on ->
                prefs(this@BubbleService).edit().putBoolean("auto", on).apply()
                poke?.invoke("lever")
                if (on) readClip(false)
            }
        }
        clipRow.addView(leverS)
        val spacer2 = View(this).apply { layoutParams = LinearLayout.LayoutParams(0, 1, 1f) }
        clipRow.addView(spacer2)
        val hideB = TextView(this).apply {
            text = "Hide bubble"
            setTextColor(muted); textSize = 12.5f
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
        card.setOnTouchListener { _, e -> if (e.action == MotionEvent.ACTION_OUTSIDE) { collapsePanel(); true } else false }
        runCatching { w.addView(card, p) }
        panel = card
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
            bp.x + dp(28) < sw2 / 2 -> dp(10)
            else -> (sw2 - pw - dp(10)).coerceAtLeast(dp(10))
        }
        p.y = (bp.y + dp(74)).coerceAtMost(sh2 - dp(240))
        runCatching { wm?.updateViewLayout(panel, p) }
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

    private fun readClip(manual: Boolean) {
        val direct = readClipboard(this)
        if (direct.isNotEmpty()) {
            deliver(this, direct, manual)
            if (manual) collapsePanel()
            return
        }
        val now = System.currentTimeMillis()
        if (!manual && now - lastTrampoline < 2500) return
        lastTrampoline = now
        pendingManual = manual
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
        collapsePanel()
        bubble?.let { runCatching { wm?.removeView(it) } }
        bubble = null
        haloAnim?.cancel()
        if (onNow != null) onNow = null
        running = false
        super.onDestroy()
    }
}
