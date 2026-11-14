package com.oscarvelz.logos

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.Icon
import android.os.IBinder
import android.os.PowerManager

/**
 * Keeps Logos reading with the screen off: a media notification (also on the lock screen) with
 * previous / play-pause / next, and the CPU awake while the voice is being made.
 */
class PlaybackService : Service() {
    companion object {
        /** Set by the activity: the press's own name for the page ("play", "pause", "prev", "next"). */
        var onAction: ((String) -> Unit)? = null
        const val CH = "reading"

        /** True while this service holds a media card in the shade. */
        @Volatile var cardUp = false

        /** The living service (1.4.155), so the house can put the card
         *  away in-process: an intent sent to a backgrounded, dying
         *  activity can die undelivered, and a card that outlives its
         *  page is a lie that cannot be swiped away. */
        var instance: PlaybackService? = null
    }

    /** Put the card away now (1.4.155): foreground ended, card gone.
     *  The session itself is released in onDestroy, as before. */
    fun forceStop() {
        cardUp = false
        runCatching { stopForeground(STOP_FOREGROUND_REMOVE) }
        wake?.let { if (it.isHeld) it.release() }
        stopSelf()
    }
    private var session: MediaSession? = null
    private var wake: PowerManager.WakeLock? = null

    override fun onBind(i: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CH, "Reading aloud", NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) })
        session = MediaSession(this, "Logos").apply {
            setCallback(object : MediaSession.Callback() {
                override fun onPlay() { act("play") }
                override fun onPause() { act("pause") }
                override fun onSkipToNext() { act("next") }
                override fun onSkipToPrevious() { act("prev") }
                // The seek vocabulary means TIME now (1.4.163, Oscar):
                // rewind and fast-forward leap the seconds Settings
                // names, the way a podcast player leaps. SKIP keeps
                // the step it has — today a sentence, the book-to-book
                // seat when a queue exists.
                override fun onRewind() { act("jumpback") }
                override fun onFastForward() { act("jumpfwd") }
            })
            // Born asleep (1.4.154): the session wakes only while the
            // voice is playing — see build(), where each published
            // state sets this. A paused session that stays active
            // keeps holding the system's media-button router, and
            // orders that were never Oscar's land on it.
            isActive = false
        }
        wake = (getSystemService(POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Logos:reading").apply { setReferenceCounted(false) }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            // The toggle's truth is the driver's (1.4.116): while the
            // shell's own device voice holds the stage, the page's last
            // published state is a dead letter — ask the speaker.
            "toggle", "next", "prev", "jumpback", "jumpfwd" -> { act(if (intent.action == "toggle") (if (if (NativeSpeaker.active) NativeSpeaker.playing else lastPlaying) "pause" else "play") else intent.action!!); return START_NOT_STICKY }
            "stop" -> { cardUp = false; stopForeground(STOP_FOREGROUND_REMOVE); wake?.let { if (it.isHeld) it.release() }; stopSelf(); return START_NOT_STICKY }
        }
        val playing = intent?.getBooleanExtra("playing", false) ?: false
        val finished = intent?.getBooleanExtra("finished", false) ?: false
        lastPlaying = playing
        // Shell 17's page sends book + artist separately; the older playing() call folded the
        // artist line into "title" and the current sentence into "text".
        val artist = intent?.getStringExtra("artist") ?: intent?.getStringExtra("title") ?: "Logos"
        val book = intent?.getStringExtra("book") ?: ""
        val text = intent?.getStringExtra("text") ?: ""
        if (!playing && text.isBlank()) {
            // Nothing loaded any more: put the notification away (after the start Android requires).
            cardUp = false
            startForeground(1, build(false, "", artist, ""), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            stopForeground(STOP_FOREGROUND_REMOVE); wake?.let { if (it.isHeld) it.release() }; stopSelf()
            return START_NOT_STICKY
        }
        // Stay a foreground service while paused too, so play from the lock screen always works.
        // A finished reading parks here as well (1.4.160): the card
        // stands saying Finished, and it is the headphone's door back.
        cardUp = true
        startForeground(1, build(playing, book, artist, text, finished), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        if (playing) wake?.acquire(3 * 60 * 60 * 1000L) else wake?.let { if (it.isHeld) it.release() }
        return START_NOT_STICKY
    }

    /** The last playing state this service published — the notification's
     *  toggle button means pause while playing, play while paused. */
    private var lastPlaying = false

    /** Route a button press. While the activity lives it hears the press
     *  exactly as before. When Android has retired the activity and
     *  revived this service alone, the press used to fall on a null
     *  lambda and die with a visible notification and dead buttons
     *  (audit E-3): now it is stored as a DEFINITE play or pause where
     *  the page collects pending commands, and the page gets a ghost
     *  visit — the panel keys' safety net, extended here.
     *
     *  A press keeps its meaning on this road too (1.4.153): play and
     *  pause used to be flattened into a bare "toggle" for the page —
     *  a flip judged against the page's own bit, which is precisely
     *  the bit a desynchronised session gets wrong. Oscar's card
     *  "refused to cooperate": his definite pause, flipped, resumed.
     *  The page has definite doors (logosandroid-play/pause); the
     *  press now travels under its own name the whole way. */
    private fun act(kind: String) {
        // While the shell's own voice holds the stage, the media keys are
        // its (1.4.112) — the page is the one that failed to flow.
        if (NativeSpeaker.active) { NativeSpeaker.handle(kind); return }
        val a = onAction
        if (a != null) { a(kind); return }
        BubbleService.wakeForPending(this, kind)
    }

    private fun pi(action: String, rq: Int): PendingIntent =
        PendingIntent.getService(this, rq, Intent(this, PlaybackService::class.java).setAction(action), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    /**
     * The jump key's face for the shade (1.4.163, Oscar): a circular
     * arrow wearing its seconds — the look he brought from a browser
     * player — drawn fresh each build so the number is always the
     * setting's current truth (the page keeps the seconds in the
     * bubble prefs through the look bridge).
     */
    private fun jumpIcon(sec: Int, dir: Int): Icon {
        val size = 96
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val cv = Canvas(bmp)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE; style = Paint.Style.STROKE
            strokeWidth = 7f; strokeCap = Paint.Cap.ROUND
        }
        val cx = size / 2f; val cy = size / 2f; val r = 30f
        val a0 = Math.toRadians(if (dir > 0) -55.0 else 235.0)
        cv.drawArc(RectF(cx - r, cy - r, cx + r, cy + r), if (dir > 0) -55f else 235f, if (dir > 0) 290f else -290f, false, p)
        val hx = (cx + r * Math.cos(a0)).toFloat(); val hy = (cy + r * Math.sin(a0)).toFloat()
        val tang = a0 + if (dir > 0) Math.PI / 2 else -Math.PI / 2
        for (w in doubleArrayOf(0.65, -0.65)) {
            val wa = tang + Math.PI + w
            cv.drawLine(hx, hy, (hx + 15 * Math.cos(wa)).toFloat(), (hy + 15 * Math.sin(wa)).toFloat(), p)
        }
        p.style = Paint.Style.FILL; p.textSize = 30f; p.textAlign = Paint.Align.CENTER
        p.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        cv.drawText(sec.toString(), cx, cy + 11f, p)
        return Icon.createWithBitmap(bmp)
    }

    private var artBmp: Bitmap? = null
    /** The card's face: the app's warm-charcoal-and-gold artwork, bundled in the APK. Without a
     *  bitmap anywhere, Android paints the media card a stock system colour (a plain blue pill)
     *  that has nothing to do with Logos — Oscar's complaint, shell 17. */
    private fun artBmp(): Bitmap {
        if (artBmp == null) artBmp = BitmapFactory.decodeResource(resources, R.drawable.media_art)
        return artBmp!!
    }

    private fun build(playing: Boolean, book: String, artist: String, text: String, finished: Boolean = false): Notification {
        val s = session!!
        // The card heads with the book's title (the current sentence scrolling across it was the
        // 1.4.49 complaint); pasted text without a book falls back to the sentence itself.
        val heading = book.ifBlank { text }
        val bmp = artBmp()
        s.setMetadata(MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, heading)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
            .putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, bmp)
            .putBitmap(MediaMetadata.METADATA_KEY_ART, bmp)
            .build())
        // Both vocabularies are declared (1.4.154, correcting 153):
        // the keys step one sentence — they have never skipped a
        // recording or a book — but the system's media card only
        // OFFERS previous/next buttons to a session that declares
        // SKIP, and it draws those two buttons itself, in its own
        // glyphs; no session can lend that surface its icons. (153
        // declared only REWIND/FAST_FORWARD and the card dropped the
        // buttons entirely — worse than the wrong glyphs.) So SKIP
        // stands for the card's sake, REWIND/FAST_FORWARD for the
        // surfaces that speak seek, and every word of either
        // vocabulary lands on the same one-sentence step. The shade's
        // own buttons wear the app's double triangles, as they have
        // since the beginning — that surface takes the app's icons.
        // (Amended 1.4.163, Oscar: REWIND/FAST_FORWARD now leap by
        // TIME — his configured seconds — on every surface that
        // speaks seek, shade buttons included; SKIP alone keeps the
        // step, the book-to-book seat. The session still declares
        // both vocabularies, for the card's sake as 154 established.)
        s.setPlaybackState(PlaybackState.Builder()
            .setActions(PlaybackState.ACTION_PLAY_PAUSE or PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_SKIP_TO_NEXT or PlaybackState.ACTION_SKIP_TO_PREVIOUS or PlaybackState.ACTION_REWIND or PlaybackState.ACTION_FAST_FORWARD)
            .setState(if (playing) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 1f).build())
        // The session is awake only while the voice is (1.4.154):
        // while paused-but-active it held the media-button router,
        // and a PLAY nobody pressed — the kind a dictation session's
        // start or stop shakes loose on this phone — resumed the
        // reading in the middle of his typing elsewhere. Asleep, the
        // router has no Logos to hand stray orders to. His own taps
        // keep their roads: the card's buttons travel the controller
        // road, which reaches the callback awake or asleep, and the
        // shade's buttons are this service's own intents.
        //
        // The one exception is Oscar's own word (1.4.160): a FINISHED
        // reading parks awake. He asked to restart a finished audio
        // from his headphone button, and a sleeping session is a door
        // that button cannot open — so the parked session stays the
        // router's target, and its play replays the reading from the
        // first sentence (the page has always restarted a finished
        // session at 0). The trade is his to close: dismiss the
        // finished card and the door shuts with it. A mid-book pause
        // still sleeps — that protection stands untouched.
        s.isActive = playing || finished
        val open = PendingIntent.getActivity(this, 9, Intent(this, MainActivity::class.java).setAction(Intent.ACTION_MAIN).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)
        return Notification.Builder(this, CH)
            .setSmallIcon(R.drawable.ic_note)
            .setLargeIcon(bmp)
            .setColor(Color.rgb(23, 19, 16))
            .setContentTitle(heading)
            .setContentText(if (book.isNotBlank()) text else artist)
            .setContentIntent(open)
            .setDeleteIntent(pi("stop", 4))
            .setOngoing(playing)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .addAction(Notification.Action.Builder(jumpIcon(getSharedPreferences("bubble", MODE_PRIVATE).getInt("jump_b", 15), -1), "Jump back", pi("jumpback", 1)).build())
            .addAction(Notification.Action.Builder(Icon.createWithResource(this, if (playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play), if (playing) "Pause" else "Play", pi("toggle", 2)).build())
            .addAction(Notification.Action.Builder(jumpIcon(getSharedPreferences("bubble", MODE_PRIVATE).getInt("jump_f", 30), 1), "Jump forward", pi("jumpfwd", 3)).build())
            .setStyle(Notification.MediaStyle().setMediaSession(s.sessionToken).setShowActionsInCompactView(0, 1, 2))
            .build()
    }

    override fun onDestroy() {
        cardUp = false
        if (instance === this) instance = null
        wake?.let { if (it.isHeld) it.release() }
        session?.release()
        super.onDestroy()
    }
}
