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
import android.graphics.Color
import android.graphics.drawable.Icon
import android.os.IBinder
import android.os.PowerManager

/**
 * Keeps Logos reading with the screen off: a media notification (also on the lock screen) with
 * previous / play-pause / next, and the CPU awake while the voice is being made.
 */
class PlaybackService : Service() {
    companion object {
        /** Set by the activity: "toggle", "next" or "prev" from the notification. */
        var onAction: ((String) -> Unit)? = null
        const val CH = "reading"
    }
    private var session: MediaSession? = null
    private var wake: PowerManager.WakeLock? = null

    override fun onBind(i: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CH, "Reading aloud", NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) })
        session = MediaSession(this, "Logos").apply {
            setCallback(object : MediaSession.Callback() {
                override fun onPlay() { act("play") }
                override fun onPause() { act("pause") }
                override fun onSkipToNext() { act("next") }
                override fun onSkipToPrevious() { act("prev") }
            })
            isActive = true
        }
        wake = (getSystemService(POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Logos:reading").apply { setReferenceCounted(false) }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            // The toggle's truth is the driver's (1.4.116): while the
            // shell's own device voice holds the stage, the page's last
            // published state is a dead letter — ask the speaker.
            "toggle", "next", "prev" -> { act(if (intent.action == "toggle") (if (if (NativeSpeaker.active) NativeSpeaker.playing else lastPlaying) "pause" else "play") else intent.action!!); return START_NOT_STICKY }
            "stop" -> { stopForeground(STOP_FOREGROUND_REMOVE); wake?.let { if (it.isHeld) it.release() }; stopSelf(); return START_NOT_STICKY }
        }
        val playing = intent?.getBooleanExtra("playing", false) ?: false
        lastPlaying = playing
        // Shell 17's page sends book + artist separately; the older playing() call folded the
        // artist line into "title" and the current sentence into "text".
        val artist = intent?.getStringExtra("artist") ?: intent?.getStringExtra("title") ?: "Logos"
        val book = intent?.getStringExtra("book") ?: ""
        val text = intent?.getStringExtra("text") ?: ""
        if (!playing && text.isBlank()) {
            // Nothing loaded any more: put the notification away (after the start Android requires).
            startForeground(1, build(false, "", artist, ""), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            stopForeground(STOP_FOREGROUND_REMOVE); wake?.let { if (it.isHeld) it.release() }; stopSelf()
            return START_NOT_STICKY
        }
        // Stay a foreground service while paused too, so play from the lock screen always works.
        startForeground(1, build(playing, book, artist, text), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        if (playing) wake?.acquire(3 * 60 * 60 * 1000L) else wake?.let { if (it.isHeld) it.release() }
        return START_NOT_STICKY
    }

    /** The last playing state this service published — the notification's
     *  toggle button means pause while playing, play while paused. */
    private var lastPlaying = false

    /** Route a button press. While the activity lives it hears the press
     *  exactly as before (play/pause travel as its "toggle"). When Android
     *  has retired the activity and revived this service alone, the press
     *  used to fall on a null lambda and die with a visible notification
     *  and dead buttons (audit E-3): now it is stored as a DEFINITE play
     *  or pause where the page collects pending commands, and the page
     *  gets a ghost visit — the panel keys' safety net, extended here. */
    private fun act(kind: String) {
        // While the shell's own voice holds the stage, the media keys are
        // its (1.4.112) — the page is the one that failed to flow.
        if (NativeSpeaker.active) { NativeSpeaker.handle(kind); return }
        val a = onAction
        if (a != null) { a(if (kind == "play" || kind == "pause") "toggle" else kind); return }
        BubbleService.wakeForPending(this, kind)
    }

    private fun pi(action: String, rq: Int): PendingIntent =
        PendingIntent.getService(this, rq, Intent(this, PlaybackService::class.java).setAction(action), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    private var artBmp: Bitmap? = null
    /** The card's face: the app's warm-charcoal-and-gold artwork, bundled in the APK. Without a
     *  bitmap anywhere, Android paints the media card a stock system colour (a plain blue pill)
     *  that has nothing to do with Logos — Oscar's complaint, shell 17. */
    private fun artBmp(): Bitmap {
        if (artBmp == null) artBmp = BitmapFactory.decodeResource(resources, R.drawable.media_art)
        return artBmp!!
    }

    private fun build(playing: Boolean, book: String, artist: String, text: String): Notification {
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
        s.setPlaybackState(PlaybackState.Builder()
            .setActions(PlaybackState.ACTION_PLAY_PAUSE or PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_SKIP_TO_NEXT or PlaybackState.ACTION_SKIP_TO_PREVIOUS)
            .setState(if (playing) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 1f).build())
        val open = PendingIntent.getActivity(this, 9, Intent(this, MainActivity::class.java).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)
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
            .addAction(Notification.Action.Builder(Icon.createWithResource(this, android.R.drawable.ic_media_previous), "Previous", pi("prev", 1)).build())
            .addAction(Notification.Action.Builder(Icon.createWithResource(this, if (playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play), if (playing) "Pause" else "Play", pi("toggle", 2)).build())
            .addAction(Notification.Action.Builder(Icon.createWithResource(this, android.R.drawable.ic_media_next), "Next", pi("next", 3)).build())
            .setStyle(Notification.MediaStyle().setMediaSession(s.sessionToken).setShowActionsInCompactView(0, 1, 2))
            .build()
    }

    override fun onDestroy() {
        wake?.let { if (it.isHeld) it.release() }
        session?.release()
        super.onDestroy()
    }
}
