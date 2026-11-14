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
                override fun onRewind() { act("prev") }
                override fun onFastForward() { act("next") }
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
            "toggle", "next", "prev" -> { act(if (intent.action == "toggle") (if (if (NativeSpeaker.active) NativeSpeaker.playing else lastPlaying) "pause" else "play") else intent.action!!); return START_NOT_STICKY }
            "stop" -> { cardUp = false; stopForeground(STOP_FOREGROUND_REMOVE); wake?.let { if (it.isHeld) it.release() }; stopSelf(); return START_NOT_STICKY }
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
            cardUp = false
            startForeground(1, build(false, "", artist, ""), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            stopForeground(STOP_FOREGROUND_REMOVE); wake?.let { if (it.isHeld) it.release() }; stopSelf()
            return START_NOT_STICKY
        }
        // Stay a foreground service while paused too, so play from the lock screen always works.
        cardUp = true
        startForeground(1, build(playing, book, artist, text), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
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
        s.isActive = playing
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
            .addAction(Notification.Action.Builder(Icon.createWithResource(this, android.R.drawable.ic_media_rew), "Previous", pi("prev", 1)).build())
            .addAction(Notification.Action.Builder(Icon.createWithResource(this, if (playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play), if (playing) "Pause" else "Play", pi("toggle", 2)).build())
            .addAction(Notification.Action.Builder(Icon.createWithResource(this, android.R.drawable.ic_media_ff), "Next", pi("next", 3)).build())
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
