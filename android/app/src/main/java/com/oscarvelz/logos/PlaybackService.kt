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
import android.os.Bundle
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

        /** Rebuild the standing card from its own last publish
         *  (T2-15): the jump seconds changed in Settings, so the
         *  card's action names and numbered icons — baked at build
         *  time from the prefs — are rebuilt NOW, not whenever some
         *  unrelated state change happens to republish. No card
         *  standing, nothing to rebuild; the next publish reads the
         *  live prefs anyway. */
        fun refreshCard(c: android.content.Context) {
            val svc = instance ?: return
            if (!cardUp) return
            svc.republish()
        }

        /** The stage's owner, learned from the page's bubble pushes
         *  (T2-20): the title of the Library recording that owns the
         *  stage, or null while a reading owns it. The finished-
         *  audio player never publishes to this service, so the
         *  standing card used to keep the last READING's face — book
         *  heading and SKIP buttons — over a recording, and its
         *  "next" stepped the recording by 15 seconds under a track
         *  skip's promise. The bubble push tells the two players
         *  apart by shape (1.4.156): a recording's push is active
         *  with no sentences (ct 0, ci −1) and saved true, its sub
         *  a clock; a reading's push carries sentences (ct > 0). An
         *  idle push (nothing active) changes nothing here — the
         *  last owner's card stands until a player takes the stage.
         *  A change of owner rebuilds the card in the new owner's
         *  shape. */
        @Volatile var clipStage: String? = null
        @Volatile var clipStageSub: String = ""
        fun noteBubblePush(json: String) {
            val j = runCatching { org.json.JSONObject(json) }.getOrNull() ?: return
            val next: String? = when {
                j.optBoolean("active") && j.optInt("ct", 0) == 0 && j.optInt("ci", -1) == -1 && j.optBoolean("saved") ->
                    j.optString("title").ifBlank { "Logos" }
                j.optInt("ct", 0) > 0 -> null
                else -> return
            }
            val sub = if (next != null) j.optString("sub") else ""
            if (next == clipStage && sub == clipStageSub) return
            clipStage = next
            clipStageSub = sub
            if (cardUp) instance?.republish()
        }
    }

    /** The last publish this service built a card from, kept so the
     *  card can be rebuilt in place (T2-15/T2-20) without waiting
     *  for the page to publish again. */
    private var lastBook = ""
    private var lastArtist = "Logos"
    private var lastText = ""
    private var lastFinished = false

    /** Rebuild the standing card from the last publish, in the
     *  stage owner's current shape. The wake lock's state is the
     *  publish's own business and is not touched here. */
    fun republish() {
        if (!cardUp || session == null) return
        runCatching {
            startForeground(1, build(lastPlaying, lastBook, lastArtist, lastText, lastFinished), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        }
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
                // The session's own jump actions (1.4.176): the card
                // buttons that wear the arrow face — see build().
                override fun onCustomAction(action: String, extras: Bundle?) {
                    when (action) {
                        "jumpback" -> act("jumpback")
                        "jumpfwd" -> act("jumpfwd")
                    }
                }
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
            // And it is judged at TAP time (M-6): BubbleService's
            // livePlaying() is that driver rule plus the commanded
            // truth — a definite press either surface issued a breath
            // ago, still unconfirmed by any publish, counts as the
            // state it commanded, so the card and the panel can never
            // judge the same moment from snapshots one state apart.
            // Only when the page has never pushed in this process is
            // there no snapshot to judge from: this service's own
            // last publish (lastPlaying) is the truth of record then.
            "toggle", "next", "prev", "jumpback", "jumpfwd" -> {
                if (intent.action == "toggle") {
                    val before = if (!NativeSpeaker.active && BubbleService.pageNeverPushed()) lastPlaying else BubbleService.livePlaying()
                    val kind = if (before) "pause" else "play"
                    BubbleService.noteCommanded(kind == "play")
                    act(kind)
                } else act(intent.action!!)
                return START_NOT_STICKY
            }
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
        lastBook = book; lastArtist = artist; lastText = text; lastFinished = finished
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

    private val jumpIconCache = HashMap<Int, Int>()

    /** The card face for a jump (1.4.179): the shipped numbered
     *  picture for the seconds the prefs name, or the plain arrow
     *  when the value stands outside the drawn set. Cached —
     *  getIdentifier is not free and build() runs on every publish. */
    private fun jumpActionIcon(sec: Int, dir: Int): Int {
        val key = sec * 2 + (if (dir > 0) 1 else 0)
        jumpIconCache[key]?.let { return it }
        val named = resources.getIdentifier(if (dir > 0) "ic_jump_fwd_$sec" else "ic_jump_back_$sec", "drawable", packageName)
        val id = if (named != 0) named else if (dir > 0) R.drawable.ic_jump_fwd else R.drawable.ic_jump_back
        jumpIconCache[key] = id
        return id
    }

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
        // The glyph as Oscar's reference draws it (1.4.173): the
        // arc sweeps 310° and arrives INTO the head, which straddles
        // the arc's END — tip along the travel, into the gap at the
        // top. (172 put the head at the arc's start; Oscar's verdict:
        // «las puntas están invertidas».) Same recipe as the panel's.
        val startA = if (dir > 0) -55f else 235f
        val sweepA = if (dir > 0) 310f else -310f
        cv.drawArc(RectF(cx - r, cy - r, cx + r, cy + r), startA, sweepA, false, p)
        val a0 = Math.toRadians((startA + sweepA).toDouble())
        val hx = (cx + r * Math.cos(a0)).toFloat(); val hy = (cy + r * Math.sin(a0)).toFloat()
        val tang = a0 + if (dir > 0) Math.PI / 2 else -Math.PI / 2
        // The head straddles the arc's end: tip leading along the
        // tangent, base trailing — one closed filled triangle.
        val txv = Math.cos(tang).toFloat(); val tyv = Math.sin(tang).toFloat()
        val tipX = hx + txv * 14f; val tipY = hy + tyv * 14f
        // The base is centered on the arc's end (1.4.174, Oscar):
        // the ring passes through the middle of the base edge.
        val bcx = hx; val bcy = hy
        val pxv = -tyv; val pyv = txv
        val hw = 13f
        val head = android.graphics.Path()
        head.moveTo(tipX, tipY)
        head.lineTo(bcx + pxv * hw, bcy + pyv * hw)
        head.lineTo(bcx - pxv * hw, bcy - pyv * hw)
        head.close()
        val pf = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; style = Paint.Style.FILL }
        cv.drawPath(head, pf)
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
        // A recording owns the stage (T2-20): the card wears the
        // RECORDING's face — its title, its clock — and declares no
        // SKIP, because there is no track to skip to; the session's
        // jump actions stay, and they stay honest, since the page
        // steps a recording by the same configured seconds it steps
        // a reading (listen.ts's jump handlers). The reading's book
        // returns as the heading the moment a reading retakes the
        // stage (noteBubblePush rebuilds the card then).
        val clip = clipStage
        val effBook = if (clip != null) "" else book
        // The card heads with the book's title (the current sentence scrolling across it was the
        // 1.4.49 complaint); pasted text without a book falls back to the sentence itself.
        val heading = clip ?: book.ifBlank { text }
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
        //
        // (Amended 1.4.172, Oscar, with his screenshot of the card
        // wearing track glyphs over a pasted text): the card's
        // buttons TRANSFORM with what is playing. Between BOOKS the
        // track seat is the truth, and SKIP stands as above. Over a
        // TEXT there is no next track to skip to — the side buttons
        // must be the jumps — so a text session does not declare
        // SKIP at all: the card's side slots fall to REWIND and
        // FAST_FORWARD, which ARE the jumps (his configured seconds,
        // the same commands the shade's numbered buttons send), and
        // no surface can offer him a track skip that does not exist.
        // The page's publish carries the distinction: `book` holds a
        // title only when a book is playing.
        //
        // (Corrected 1.4.176, Oscar, with his screenshot of the
        // finished card wearing a lone play button): the prediction
        // above failed on his phone — the system's media card does
        // NOT fall back to REWIND/FAST_FORWARD for its side slots;
        // with no SKIP declared it showed no side buttons at all,
        // and the 173 sleep left the finished card the same. «The
        // latest update removed the two buttons… Bring them back
        // with a new design.» The jumps now ride as the session's
        // OWN custom actions on every reading — book, text and
        // finished alike: their face is the corrected arrow (a
        // vector resource; the platform takes only resource icons
        // for session actions, so the drawn number cannot ride
        // here — it lives in the action's NAME, read live from the
        // same prefs the shade's numbered bitmap buttons draw
        // from, and the shade notification keeps the numbered
        // faces themselves). SKIP's seat is unchanged: books keep
        // it, texts never declare it.
        //
        // (Amended 1.4.179, Oscar, over the card still wearing
        // empty arrows: «the notification player still doesn't
        // have the numbers there. Fix that.») The number rides
        // now — as a shipped picture. A set of numbered faces is
        // drawn for the round values (5–60 by fives, then 75, 90,
        // 120, 180, 240, 300) and jumpActionIcon picks the one
        // the live prefs name; outside the set the plain arrow
        // stands, and the action's name still tells the seconds
        // truly. A frozen lie was the price he accepted knowingly:
        // the set is wide, and a value outside it shows no number
        // rather than a wrong one.
        val cardActions = if (effBook.isNotBlank())
            PlaybackState.ACTION_PLAY_PAUSE or PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_SKIP_TO_NEXT or PlaybackState.ACTION_SKIP_TO_PREVIOUS or PlaybackState.ACTION_REWIND or PlaybackState.ACTION_FAST_FORWARD
        else
            PlaybackState.ACTION_PLAY_PAUSE or PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_REWIND or PlaybackState.ACTION_FAST_FORWARD
        val jbSec = getSharedPreferences("bubble", MODE_PRIVATE).getInt("jump_b", 15)
        val jfSec = getSharedPreferences("bubble", MODE_PRIVATE).getInt("jump_f", 30)
        s.setPlaybackState(PlaybackState.Builder()
            .setActions(cardActions)
            .addCustomAction("jumpback", "Jump back $jbSec seconds", jumpActionIcon(jbSec, -1))
            .addCustomAction("jumpfwd", "Jump forward $jfSec seconds", jumpActionIcon(jfSec, 1))
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
        // The 1.4.160 exception is CLOSED (1.4.173, Oscar's dictation
        // verdict): a finished reading used to park AWAKE so his
        // headphone button could replay it — but a parked session
        // holds the media-button router, and the stray PLAY a
        // dictation stop shakes loose landed on it and restarted the
        // reading from the first sentence, uninvited. Once, exactly:
        // his corrective pause was a mid-reading pause, which sleeps,
        // so the next dictation found no door — «perhaps it does it
        // only one time» was the park's signature. The card and the
        // session are separate things again: the CARD stands (it is
        // this service's own notification, and its buttons travel the
        // service road, which reaches the callback awake or asleep —
        // a tap on the finished card still replays from 0), while the
        // SESSION sleeps whenever no sound is flowing, finished or
        // paused alike. The headphone button's replay of a finished
        // reading is the price, and it is named here so nobody reopens
        // the exception without knowing what it cost last time.
        s.isActive = playing
        val open = PendingIntent.getActivity(this, 9, Intent(this, MainActivity::class.java).setAction(Intent.ACTION_MAIN).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)
        return Notification.Builder(this, CH)
            .setSmallIcon(R.drawable.ic_note)
            .setLargeIcon(bmp)
            .setColor(Color.rgb(23, 19, 16))
            .setContentTitle(heading)
            .setContentText(if (clip != null) clipStageSub else if (book.isNotBlank()) text else artist)
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
