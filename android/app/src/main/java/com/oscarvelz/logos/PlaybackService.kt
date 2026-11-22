package com.oscarvelz.logos

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.view.KeyEvent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
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
        /** The session's progress truth (1.4.193, Road 1): the page
         *  publisher measures the reading — position and duration in
         *  BOOK seconds (rendered lengths where they exist, honest
         *  estimates where they do not, re-anchored at every
         *  sentence), a recording's real clock for a clip — and sends
         *  it over the mediaP bridge. Until this seat existed the
         *  session published position UNKNOWN at a hard-coded 1f, so
         *  the system's card drew its furniture with nothing inside:
         *  no bar, no clock, no seek. With the truth seated, build()
         *  publishes duration + position + the true speed and
         *  declares ACTION_SEEK_TO; the panel extrapolates locally
         *  from that triple, so the page publishes on sentence
         *  boundaries, never per second. */
        @Volatile var progPosMs = -1L
        @Volatile var progDurMs = 0L
        @Volatile var progSpd = 1f
        @Volatile var progCi = -1
        @Volatile var progCt = 0
        // The seat's stamp (1.4.196): when the truth was seated, on
        // the monotonic clock. faceSession extrapolates the seat to
        // the moment it anchors the state, so a re-anchor — a
        // refresh, a rebuild, a percent step — states the position
        // as of NOW instead of dragging the panel's bar back to the
        // seat (Oscar's phone, 1.4.193: the bar started, climbed a
        // little and snapped back to the start, in a loop).
        @Volatile var progAtMs = 0L
        fun noteProgress(posMs: Long, durMs: Long, spd: Float, ci: Int, ct: Int) {
            progPosMs = posMs
            progDurMs = durMs
            progSpd = spd
            progCi = ci
            progCt = ct
            progAtMs = android.os.SystemClock.elapsedRealtime()
            // The Ring's fraction is THIS seat's fraction (1.4.196):
            // one truth for the bar and the artwork. It was the
            // bubble push's sentence fraction before — a different
            // clock that could leave a finished reading's 100% on a
            // fresh reading's card (Oscar's phone, same morning).
            val pct = if (durMs > 0 && posMs >= 0) Math.round(posMs.toDouble() / durMs.toDouble() * 100.0).toInt() else -1
            val pctMoved = pct != ringPct
            ringPct = pct
            ringFrac = if (pct >= 0) posMs.toDouble() / durMs.toDouble() else -1.0
            // A session-only refresh: the metadata and state move,
            // the standing notification is not re-posted for this —
            // the artwork steps by its percent rule, just below.
            instance?.refreshSessionFace()
            if (pctMoved && cardUp) instance?.republish()
        }

        /** The Ring's seats (1.4.193, Road 2; the fraction re-seated
         *  in 1.4.196): ringFrac and ringPct are derived in
         *  noteProgress from the progress seat itself — one truth
         *  for the bar and the artwork. The bubble push still brings
         *  the theme FAMILY: when it moves, the card is rebuilt
         *  wearing ringArt()'s new face. A percent is the finest
         *  step — a long reading costs at most a hundred rebuilds,
         *  most far fewer. */
        @Volatile var ringFrac = -1.0
        @Volatile var ringFam = ""
        @Volatile var ringPct = -1
        /** How many texts stand in the copy queue (1.4.198),
         *  harvested from the page's push: while it stands above
         *  zero the session declares SKIP and headset track keys
         *  travel the line instead of leaping. */
        @Volatile var queueCount = 0
        fun noteBubblePush(json: String) {
            val j = runCatching { org.json.JSONObject(json) }.getOrNull() ?: return
            // The copy queue's count (1.4.198): while a line stands,
            // the session declares SKIP and the track keys travel
            // the line — the face is re-faced when the count's
            // truth changes, like the ring's percent.
            val qn = j.optInt("queue", 0)
            if (qn != queueCount) {
                queueCount = qn
                if (cardUp) instance?.refreshSessionFace()
            }
            if (j.optBoolean("active")) {
                val fam = j.optString("fam")
                if (fam.isNotEmpty() && fam != ringFam) {
                    ringFam = fam
                    if (cardUp) instance?.republish()
                }
            }
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

    /** Re-face the session — metadata and playback state — from
     *  the last publish and the progress seats, WITHOUT re-posting
     *  the notification (1.4.193): the panel reads the session, so
     *  the bar, the clock and the seek target stay true on every
     *  sentence boundary, while the artwork — the only part that
     *  needs a re-post — steps by its own percent rule. */
    fun refreshSessionFace() {
        val s = session ?: return
        if (!cardUp) return
        val clip = clipStage
        val heading = clip ?: lastBook.ifBlank { lastText }
        faceSession(s, lastPlaying, heading, lastArtist, clip == null && lastBook.isNotBlank())
    }

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
        dropFocus()
        runCatching { stopForeground(STOP_FOREGROUND_REMOVE) }
        wake?.let { if (it.isHeld) it.release() }
        stopSelf()
    }
    private var session: MediaSession? = null
    private var wake: PowerManager.WakeLock? = null

    // Audio focus (1.4.194): Logos never asked for it, so the system's
    // media router had no reason to crown this session — headset keys
    // went to whichever app last held focus, or nowhere. Focus now
    // follows the sound, the same law as the wake lock and the
    // session's own sleep: claimed while a reading sounds, let go
    // when it stops or the card retires. It is held for ROUTING —
    // ducking and loss manners stay with the voices themselves.
    private var focusHeld = false
    private var focusReq: AudioFocusRequest? = null

    private fun claimFocus() {
        if (focusHeld) return
        val am = getSystemService(AudioManager::class.java) ?: return
        val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build())
            .setOnAudioFocusChangeListener { }
            .build()
        focusReq = req
        focusHeld = am.requestAudioFocus(req) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }

    private fun dropFocus() {
        if (!focusHeld) return
        focusHeld = false
        val am = getSystemService(AudioManager::class.java) ?: return
        focusReq?.let { runCatching { am.abandonAudioFocusRequest(it) } }
        focusReq = null
    }

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
                // The system's seek bar (1.4.193): declared in
                // faceSession now that the session carries a true
                // duration. The target is a book-millisecond count.
                // While the shell's own voice holds the stage it
                // takes the fraction directly, the way the panel's
                // seek bar does; otherwise the seat is stamped in
                // BubbleService (with its session context, judged at
                // the pull door like the panel's fraction) and the
                // press travels the standing action road — a live
                // poke, or a stored order behind a wake.
                override fun onSeekTo(pos: Long) {
                    if (NativeSpeaker.active) {
                        val d = progDurMs
                        if (d > 0) NativeSpeaker.seekTo((pos.toDouble() / d.toDouble()).coerceIn(0.0, 1.0))
                        return
                    }
                    BubbleService.seekToMs = pos
                    BubbleService.seekToAt = System.currentTimeMillis()
                    BubbleService.seekToCtx = BubbleService.currentContext()
                    val a = onAction
                    if (a != null) a("seekto") else BubbleService.wakeForPending(this@PlaybackService, "seekto")
                }
                // Headset keys, read ourselves (1.4.194). The
                // framework's default mapping only honours NEXT and
                // PREVIOUS when the session declares SKIP — over a
                // pasted text it does not (the card's own law), so the
                // double/triple press every headset sends for
                // adelantar/atrasar died on the floor. On a headset,
                // next/previous IS the leap gesture: it takes the
                // Settings seconds, like the card's arrow buttons.
                // The card's SKIP buttons keep their own law — this
                // door is only for keys that arrive as key events.
                override fun onMediaButtonEvent(mediaButtonIntent: Intent): Boolean {
                    val ev = mediaButtonIntent.getParcelableExtra<KeyEvent>(Intent.EXTRA_KEY_EVENT)
                    if (ev != null && ev.action == KeyEvent.ACTION_DOWN) {
                        when (ev.keyCode) {
                            // The track keys (1.4.198): with a copy
                            // queue standing they travel the line —
                            // Oscar's headset speaks only these (its
                            // double press is NEXT, its triple is
                            // PREVIOUS, and it has no seek keys at
                            // all). Without a line, the 194 law
                            // stands: the leap, by the Settings
                            // seconds. The seek keys always leap.
                            KeyEvent.KEYCODE_MEDIA_NEXT -> { if (queueCount > 0) act("next") else act("jumpfwd"); return true }
                            KeyEvent.KEYCODE_MEDIA_PREVIOUS -> { if (queueCount > 0) act("prev") else act("jumpback"); return true }
                            KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> { act("jumpfwd"); return true }
                            KeyEvent.KEYCODE_MEDIA_REWIND -> { act("jumpback"); return true }
                        }
                    }
                    return super.onMediaButtonEvent(mediaButtonIntent)
                }
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
            "stop" -> { cardUp = false; dropFocus(); stopForeground(STOP_FOREGROUND_REMOVE); wake?.let { if (it.isHeld) it.release() }; stopSelf(); return START_NOT_STICKY }
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
            dropFocus()
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
        if (playing) { wake?.acquire(3 * 60 * 60 * 1000L); claimFocus() } else { wake?.let { if (it.isHeld) it.release() }; dropFocus() }
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
        // The copy queue's exception (1.4.198): next/previous belong
        // to the page while a line stands — the line lives there,
        // whichever voice is speaking it. The page judges the press
        // (queue first, then the book deed, then the sentence).
        if ((kind == "next" || kind == "prev") && queueCount > 0) {
            val a = onAction
            if (a != null) { a(kind); return }
            BubbleService.wakeForPending(this, kind)
            return
        }
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

    /** The session's face (1.4.193): metadata and playback state,
     *  set together — called by build() for the standing card and
     *  by refreshSessionFace() when the progress truth moves. The
     *  vocabulary history lives at build()'s call site; this is
     *  only its current shape. With a true duration seated, the
     *  state carries position + the session's own speed (the panel
     *  extrapolates from that triple between publishes) and the
     *  actions gain SEEK_TO; without one, the seat publishes
     *  exactly what it published before this version — position
     *  UNKNOWN at 1f, no seek — so an old page against this shell
     *  loses nothing. */
    private fun faceSession(s: MediaSession, playing: Boolean, heading: String, artist: String, bookish: Boolean) {
        val bmp = paletteFace()
        val md = MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, heading)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
            .putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, bmp)
            .putBitmap(MediaMetadata.METADATA_KEY_ART, bmp)
        if (progDurMs > 0) md.putLong(MediaMetadata.METADATA_KEY_DURATION, progDurMs)
        s.setMetadata(md.build())
        var actions = PlaybackState.ACTION_PLAY_PAUSE or PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_REWIND or PlaybackState.ACTION_FAST_FORWARD
        // SKIP is declared for books (172) and, since 1.4.198, for a
        // standing copy queue: both are lines of tracks, and the
        // press travels the line that stands.
        if (bookish || queueCount > 0) actions = actions or PlaybackState.ACTION_SKIP_TO_NEXT or PlaybackState.ACTION_SKIP_TO_PREVIOUS
        if (progDurMs > 0) actions = actions or PlaybackState.ACTION_SEEK_TO
        val jbSec = getSharedPreferences("bubble", MODE_PRIVATE).getInt("jump_b", 15)
        val jfSec = getSharedPreferences("bubble", MODE_PRIVATE).getInt("jump_f", 30)
        // The anchor speaks for THIS moment (1.4.196): while the
        // reading sounds, the seat is extrapolated by the time
        // since it was stamped, at the seat's own speed, capped at
        // the duration — so any re-anchor (a refresh, a rebuild, a
        // percent step) agrees with the position the panel itself
        // had extrapolated to, and the bar never snaps back to the
        // seat. Paused, the seat stands exactly as published.
        val anchorPos = if (progDurMs > 0 && progPosMs >= 0) {
            if (playing) minOf(progDurMs, progPosMs + ((android.os.SystemClock.elapsedRealtime() - progAtMs) * progSpd.toDouble()).toLong())
            else progPosMs
        } else PlaybackState.PLAYBACK_POSITION_UNKNOWN
        s.setPlaybackState(PlaybackState.Builder()
            .setActions(actions)
            .addCustomAction("jumpback", "Jump back $jbSec seconds", jumpActionIcon(jbSec, -1))
            .addCustomAction("jumpfwd", "Jump forward $jfSec seconds", jumpActionIcon(jfSec, 1))
            .setState(if (playing) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED,
                anchorPos,
                if (progDurMs > 0) progSpd else 1f)
            .build())
    }

    /** The card's face (1.4.193): the Ring while a stage fraction
     *  is seated, the bundled artwork before the first push brings
     *  one. A drawing failure falls back to the artwork — the face
     *  never breaks the card. */
    private fun cardFace(): Bitmap {
        val f = ringFrac
        if (f < 0) return artBmp()
        return runCatching { ringArt(f, ringFam) }.getOrElse { artBmp() }
    }

    private var paletteBmp: Bitmap? = null
    private var paletteFam: String? = null
    /** The session metadata's own face (1.4.215): the SYSTEM's media
     *  panel (the «This phone» player) does not take its scrubber
     *  colour from the notification's setColor — it extracts a
     *  palette from the session's ARTWORK, and the Ring's artwork is
     *  nine-tenths dark ground with the accent in fine strokes, so
     *  Samsung's extraction saturated Legacy's pale gold into a
     *  burnt orange (Oscar's photo, 2026-11-21). The metadata
     *  therefore carries a face built for the extraction: the
     *  medallion — a full disc of the theme's pure accent with the λ
     *  standing in the ground's colour — so the palette's dominant
     *  vibrant colour IS the accent in every family. The
     *  notification's large icon keeps the Ring exactly as designed;
     *  only the metadata's art keys change seats. Cached per family;
     *  any failure falls back to the card's face. */
    private fun paletteFace(): Bitmap {
        val fam = ringFam
        paletteBmp?.let { if (paletteFam == fam) return it }
        val bmp = runCatching { paletteArt(fam) }.getOrElse { return cardFace() }
        paletteBmp = bmp
        paletteFam = fam
        return bmp
    }

    private fun paletteArt(fam: String): Bitmap {
        val size = 512
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val cv = Canvas(bmp)
        val ground: Int
        val accent: Int
        val glow: Boolean
        when (fam) {
            "light" -> { ground = Color.rgb(245, 241, 232); accent = Color.rgb(154, 102, 20); glow = false }
            "tron" -> { ground = Color.rgb(2, 10, 16); accent = Color.rgb(0, 229, 255); glow = true }
            "cyberpunk" -> { ground = Color.rgb(11, 10, 8); accent = Color.rgb(255, 42, 109); glow = false }
            else -> { ground = Color.rgb(23, 19, 16); accent = Color.rgb(233, 189, 114); glow = false }
        }
        cv.drawColor(ground)
        val cx = size / 2f
        val cy = size / 2f
        val haloPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        haloPaint.shader = RadialGradient(cx, cy, 250f,
            intArrayOf(Color.argb(if (glow) 120 else 64, Color.red(accent), Color.green(accent), Color.blue(accent)), Color.TRANSPARENT),
            null, Shader.TileMode.CLAMP)
        cv.drawCircle(cx, cy, 250f, haloPaint)
        val discPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        discPaint.color = accent
        if (glow) discPaint.setShadowLayer(22f, 0f, 0f, accent)
        cv.drawCircle(cx, cy, 158f, discPaint)
        val lam = lambdaBitmap()
        val lw = 218f
        val lh = lw * lam.height.toFloat() / lam.width.toFloat()
        val lamPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        lamPaint.colorFilter = PorterDuffColorFilter(ground, PorterDuff.Mode.SRC_IN)
        lamPaint.isFilterBitmap = true
        cv.drawBitmap(lam, null, RectF(cx - lw / 2, cy - lh / 2, cx + lw / 2, cy + lh / 2), lamPaint)
        return bmp
    }

    private var lambdaStencil: Bitmap? = null
    /** The λ lifted from the bundled artwork, as an alpha stencil:
     *  its gold bounds in the 512 file were measured from the file
     *  itself (x 188..375, y 122..279), cropped with a breath of
     *  margin, and each pixel's alpha is its brightness above the
     *  art's dark ground — so ringArt can tint the letter by its
     *  own shape and every theme wears the same λ in its colour. */
    private fun lambdaBitmap(): Bitmap {
        lambdaStencil?.let { return it }
        val src = Bitmap.createBitmap(artBmp(), 184, 118, 196, 166)
        val w = src.width
        val h = src.height
        val px = IntArray(w * h)
        src.getPixels(px, 0, w, 0, 0, w, h)
        val op = IntArray(w * h)
        for (i in px.indices) {
            val p = px[i]
            val lum = (Color.red(p) * 299 + Color.green(p) * 587 + Color.blue(p) * 114) / 1000
            val a = ((lum - 70) * 255 / 120).coerceIn(0, 255)
            op[i] = Color.argb(a, 255, 255, 255)
        }
        val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        out.setPixels(op, 0, w, 0, 0, w, h)
        lambdaStencil = out
        return out
    }

    /** THE RING (1.4.193 — Oscar chose it «por mucho» over the
     *  thread and the sentences): the artwork itself becomes the
     *  instrument, because the system's card gives a session no
     *  custom view — the art is the only surface it honours. A
     *  fine ring around the medallion fills clockwise over a dim
     *  hairline as the reading advances, a luminous bead rides the
     *  frontier, and the percent stands beneath the λ in the
     *  house serif; at the end the ring closes and the bead
     *  crowns the top. Geometry and palettes are the design
     *  sheet's own (~/workspace/logos-progress/): ring r = 0.365
     *  of the canvas, λ centred high, percent beneath it; Legacy
     *  and Light print flat, Tron glows, Cyberpunk prints its
     *  diamond bead in yellow. Drawn at runtime — a hundred
     *  percents times four themes is no set of faces to ship. */
    private fun ringArt(fracIn: Double, fam: String): Bitmap {
        val size = 512
        val frac = fracIn.coerceIn(0.0, 1.0)
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val cv = Canvas(bmp)
        val ground: Int
        val accent: Int
        val dim: Int
        val ink: Int
        val glow: Boolean
        when (fam) {
            "light" -> { ground = Color.rgb(245, 241, 232); accent = Color.rgb(154, 102, 20); dim = Color.argb(56, 60, 50, 30); ink = accent; glow = false }
            "tron" -> { ground = Color.rgb(2, 10, 16); accent = Color.rgb(0, 229, 255); dim = Color.argb(64, 0, 229, 255); ink = Color.rgb(207, 250, 254); glow = true }
            "cyberpunk" -> { ground = Color.rgb(11, 10, 8); accent = Color.rgb(255, 42, 109); dim = Color.argb(64, 255, 42, 109); ink = Color.rgb(255, 214, 64); glow = false }
            else -> { ground = Color.rgb(23, 19, 16); accent = Color.rgb(233, 189, 114); dim = Color.argb(54, 233, 189, 114); ink = accent; glow = false }
        }
        cv.drawColor(ground)
        val cx = size / 2f
        val cy = size / 2f
        // The halo: the accent, breathed out from the centre.
        val haloPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        haloPaint.shader = RadialGradient(cx, cy, 205f,
            intArrayOf(Color.argb(if (glow) 110 else 56, Color.red(accent), Color.green(accent), Color.blue(accent)), Color.TRANSPARENT),
            null, Shader.TileMode.CLAMP)
        cv.drawCircle(cx, cy, 205f, haloPaint)
        // The λ, tinted by its own alpha.
        val lam = lambdaBitmap()
        val lw = 150f
        val lh = lw * lam.height.toFloat() / lam.width.toFloat()
        val lamPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        lamPaint.colorFilter = PorterDuffColorFilter(accent, PorterDuff.Mode.SRC_IN)
        lamPaint.isFilterBitmap = true
        cv.drawBitmap(lam, null, RectF(cx - lw / 2, 205f - lh / 2, cx + lw / 2, 205f + lh / 2), lamPaint)
        // The ring: a dim hairline whole, the accent over what is read.
        val r = 187f
        val ringRect = RectF(cx - r, cy - r, cx + r, cy + r)
        val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        trackPaint.style = Paint.Style.STROKE
        trackPaint.strokeWidth = 3f
        trackPaint.color = dim
        cv.drawCircle(cx, cy, r, trackPaint)
        val arcPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        arcPaint.style = Paint.Style.STROKE
        arcPaint.strokeWidth = 7f
        arcPaint.strokeCap = Paint.Cap.ROUND
        arcPaint.color = accent
        if (glow) arcPaint.setShadowLayer(18f, 0f, 0f, accent)
        cv.drawArc(ringRect, -90f, (frac * 360).toFloat(), false, arcPaint)
        // The bead at the frontier, haloed in the accent.
        val ang = Math.toRadians(-90.0 + frac * 360.0)
        val bx = cx + (r * Math.cos(ang)).toFloat()
        val by = cy + (r * Math.sin(ang)).toFloat()
        val beadHalo = Paint(Paint.ANTI_ALIAS_FLAG)
        beadHalo.color = Color.argb(70, Color.red(accent), Color.green(accent), Color.blue(accent))
        cv.drawCircle(bx, by, 15f, beadHalo)
        val beadPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        beadPaint.color = ink
        if (glow) beadPaint.setShadowLayer(16f, 0f, 0f, accent)
        cv.drawCircle(bx, by, 8f, beadPaint)
        // The percent, beneath the λ.
        val pctPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        pctPaint.color = ink
        pctPaint.typeface = Typeface.create(Typeface.SERIF, Typeface.NORMAL)
        pctPaint.textSize = 54f
        pctPaint.textAlign = Paint.Align.CENTER
        cv.drawText("${Math.round(frac * 100)}%", cx, 357f, pctPaint)
        return bmp
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
        val bmp = cardFace()
        faceSession(s, playing, heading, artist, effBook.isNotBlank())
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
        // (Amended 1.4.193: the metadata and the state are set by
        // faceSession above — one shape for the standing card and
        // for the progress refresh alike. The vocabulary stands as
        // the history above settled it; SEEK_TO joins it when a
        // true duration is seated, and the state finally carries
        // the position and speed it always should have.)
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
            // The notification's tint is the theme's ACCENT (1.4.196):
            // the colour the system paints the card's own furniture
            // with — the seek bar above all. 1.4.193 handed it the
            // family's GROUND colour and Samsung's card came out
            // red-orange on Oscar's phone; the accent is the colour
            // that is Logos in each family — Legacy's gold first.
            .setColor(when (ringFam) {
                "light" -> Color.rgb(154, 102, 20)
                "tron" -> Color.rgb(0, 229, 255)
                "cyberpunk" -> Color.rgb(255, 42, 109)
                else -> Color.rgb(233, 189, 114)
            })
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
        dropFocus()
        if (instance === this) instance = null
        wake?.let { if (it.isHeld) it.release() }
        session?.release()
        super.onDestroy()
    }
}
