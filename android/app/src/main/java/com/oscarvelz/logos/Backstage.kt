package com.oscarvelz.logos

import android.content.Context
import android.graphics.PixelFormat
import android.provider.Settings
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.WebView
import android.widget.FrameLayout

/**
 * The backstage (1.4.111): while the bubble is on and Logos is out of sight, the
 * page's WebView is not left in a stopped activity, where Chromium counts it
 * hidden and throttles it (no frames, timers slowed) — the reason a copy caught
 * by the bubble could not start the voice until a ghost visit brought the app
 * forward, with its black flash. Instead the very same WebView moves into an
 * invisible overlay window (window alpha 0, never touchable, never focusable),
 * where it stays visible to Chromium and keeps working at full speed. When the
 * activity comes back to the front it takes the WebView home again.
 *
 * One page, one engine, one model in memory: nothing is duplicated.
 */
object Backstage {
    private var host: FrameLayout? = null
    private var wm: WindowManager? = null
    private var tenant: WebView? = null
    @Volatile var active = false
        private set

    fun adopt(c: Context, web: WebView, w: Int, h: Int): Boolean {
        if (active) return true
        val app = c.applicationContext
        if (!Settings.canDrawOverlays(app)) return false
        return runCatching {
            val m = app.getSystemService(Context.WINDOW_SERVICE) as WindowManager
            val frame = FrameLayout(app)
            (web.parent as? ViewGroup)?.removeView(web)
            frame.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            val p = WindowManager.LayoutParams(
                if (w > 0) w else WindowManager.LayoutParams.MATCH_PARENT,
                if (h > 0) h else WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                    WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.TOP or Gravity.START
                alpha = 0f
                title = "Logos backstage"
            }
            m.addView(frame, p)
            host = frame; wm = m; active = true; tenant = web
            true
        }.getOrElse {
            // Could not open the window: hand the WebView back untouched.
            runCatching { host?.removeAllViews() }
            host = null; wm = null; active = false
            false
        }
    }

    /** Close the backstage window; the WebView is left without a parent for its activity to take back. */
    fun release() {
        val h = host ?: run { active = false; tenant = null; return }
        runCatching { h.removeAllViews() }
        runCatching { wm?.removeViewImmediate(h) }
        host = null; wm = null; active = false; tenant = null
    }

    /** End the backstage tenancy for good (1.4.128): the window closes
     *  AND the page is destroyed. release() only ever parked the
     *  WebView parentless — and a parentless page keeps its renderer,
     *  its audio and its voice, with no switch left anywhere that can
     *  reach it. Whoever calls this has decided the page dies here. */
    fun evictAndDestroy() {
        val t = tenant
        release()
        if (t != null) runCatching { t.destroy() }
    }
}
