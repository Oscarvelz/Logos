package com.oscarvelz.logos

import android.app.Activity
import android.os.Bundle

/**
 * A transparent blink of an activity. Android only lets an app read the
 * clipboard while one of its windows holds the focus; when the bubble's own
 * window cannot, this activity takes the focus for a moment, reads, hands the
 * text to the bubble service, and is gone — it never draws anything.
 */
class ClipActivity : Activity() {
    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        overridePendingTransition(0, 0)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (!hasFocus) return
        BubbleService.deliverFromClip(this, BubbleService.readClipboard(this))
        finish()
        overridePendingTransition(0, 0)
    }
}
