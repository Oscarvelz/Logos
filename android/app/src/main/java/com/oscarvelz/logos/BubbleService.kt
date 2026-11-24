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
import android.os.PowerManager
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.ScrollView
import android.widget.SeekBar
import android.graphics.drawable.ClipDrawable
import android.graphics.drawable.LayerDrawable
import android.view.animation.DecelerateInterpolator
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.Switch
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
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
        /** A stored press (T2-14): its verb, its moment, and its
         *  context stamp (M-9) travel together as one entry. */
        private data class PendingPress(val id: Long, val cmd: String, val at: Long, val ctx: String)
        /** The stored presses, oldest first (T2-14). The single slot
         *  this replaces silently overwrote an undelivered press with
         *  any later store — a stored "next" erased without a trace
         *  by a following "pause" — and its take (read → null →
         *  expiry-check) was unsynchronized while its callers run on
         *  the main thread and the WebView JavaBridge thread, so two
         *  takers could both read the same press before either
         *  cleared it: one press, delivered twice. Now every store
         *  and every take is one synchronized step on [pendingLock],
         *  and presses queue in the order he made them. A repeat of
         *  the press at the queue's tail coalesces (a double-tap
         *  stored twice would step twice — the old slot's one honest
         *  behaviour, kept) — but only while that tail is a live
         *  press: a stale or foreign tail is replaced by the fresh
         *  press, never merged with it (R3-T2-3, at the store
         *  below); the queue is capped so a pathological burst
         *  cannot grow it without bound, and a press crowded out at
         *  the cap leaves its receipt among the drop notes. */
        private val pendingLock = Any()
        /** Every stored press carries its own number (T2-10
         *  completion): a drain or an escalation may only ever name
         *  the press that was actually poked — never a newer press
         *  that happens to share its verb. */
        private var nextPressId = 0L
        private val pendingQueue = ArrayDeque<PendingPress>()
        private const val PENDING_CAP = 16
        /** The oldest stored press's verb, read-only: the heads the
         *  house's pause laws look at (deliver, NativeSpeaker). */
        val pendingCmd: String? get() = synchronized(pendingLock) { pendingQueue.firstOrNull()?.cmd }
        /** The stamp of the press most recently collected, for the page
         *  to read alongside the command (Bridge.bubblePendingCtx). */
        @Volatile var lastTakenCtx: String = ""
        /** Why stored presses were dropped at collection, if any
         *  were: the receipts the Bridge writes to the Settings
         *  line. They ACCUMULATE until surfaced (R3-T2-5): drops
         *  cluster exactly when the machinery is busiest — a peek
         *  condemning two heads in one loop, a crowding-out followed
         *  by a stale take — and the single slot this replaces let
         *  each new death overwrite the previous one, so all but the
         *  last reason were the silences T2-21 outlawed. A small
         *  queue keeps the first reasons verbatim; past its cap a
         *  count stands for the rest, so no drop is ever invisible. */
        private val dropNotes = ArrayDeque<String>()
        private var dropNotesOverflow = 0
        private const val DROP_NOTES_CAP = 4

        /** Leave a drop's reason for the Settings line (T2-21). */
        fun recordDropNote(reason: String) {
            synchronized(pendingLock) {
                if (dropNotes.size >= DROP_NOTES_CAP) dropNotesOverflow++
                else dropNotes.addLast(reason)
            }
        }

        /** Take every accumulated drop reason, folded into the one
         *  line the Settings surface shows, and clear the queue —
         *  the Bridge's surfacing door (MainActivity.bubblePendingCmd).
         *  Null when nothing has dropped since the last surfacing. */
        fun takeDropNote(): String? {
            synchronized(pendingLock) {
                if (dropNotes.isEmpty() && dropNotesOverflow == 0) return null
                val line = dropNotes.joinToString("; ")
                val extra = dropNotesOverflow
                dropNotes.clear()
                dropNotesOverflow = 0
                return if (extra > 0) "$line; and $extra more" else line
            }
        }

        /** Store a press for a sleeping page, stamped with its moment
         *  AND its context (M-9): the session the press was made
         *  against — title + sentence total of the state the panel
         *  was showing — so that at collection time the stamp can be
         *  checked against the context that is current THEN, not
         *  merely trusted from queue time. */
        fun storePendingCmd(cmd: String) {
            synchronized(pendingLock) {
                // Coalescing judges the tail it merges into (R3-T2-3):
                // a repeat of the tail's verb is a double-tap only
                // while the tail is a LIVE press — inside its twenty
                // seconds and stamped against the context that is
                // current now (the take's own audits, applied at the
                // store). A stale tail or a foreign one is a corpse
                // of the verb, not the verb itself: the fresh press
                // REPLACES it, carrying its own moment and its own
                // stamp. The blind coalescing this replaces swallowed
                // a second "next" pressed 25 s after the first,
                // whole — the woken page then collected the FIRST
                // press and dropped it as stale, so two presses
                // executed zero times between them; the single slot
                // the queue replaced would have executed the fresh
                // one. The context variant needed no clock: a press
                // against session B coalesced into session A's tail
                // and died at the take wearing A's stamp.
                val tail = pendingQueue.lastOrNull()
                if (tail != null && tail.cmd == cmd) {
                    val now = System.currentTimeMillis()
                    val cur = currentContext()
                    val stale = now - tail.at > 20_000
                    val foreign = tail.ctx.isNotEmpty() && cur.isNotEmpty() && tail.ctx != cur
                    if (!stale && !foreign) return
                    pendingQueue.removeLast()
                }
                if (pendingQueue.size >= PENDING_CAP) {
                    pendingQueue.removeFirst()
                    recordDropNote("a stored press was crowded out")
                }
                pendingQueue.addLast(PendingPress(++nextPressId, cmd, System.currentTimeMillis(), currentContext()))
            }
        }

        /** Whether any stored press is a pause (the 1.4.120 laws ask
         *  this of the queue, as they asked it of the slot). */
        fun hasPendingPause(): Boolean = synchronized(pendingLock) { pendingQueue.any { it.cmd == "pause" } }

        /** Remove every stored pause (a fresh catch, or his own play
         *  press, supersedes a stored stop — 1.4.120). Other stored
         *  presses keep their order and their stamps. */
        fun clearPendingPause() {
            synchronized(pendingLock) { pendingQueue.removeAll { it.cmd == "pause" } }
        }

        /** The context a stored press belongs to: the identity of the
         *  session in the latest pushed state ("" when that state
         *  holds no session — a press stored then belongs to no
         *  session and is governed by the age audit alone). */
        fun currentContext(): String {
            val j = runCatching { JSONObject(nowJson) }.getOrNull() ?: return ""
            val ct = j.optInt("ct", 0)
            if (ct <= 0) return ""
            return j.optString("title") + "|" + ct
        }

        /** Collect the stored press — within twenty seconds it means
         *  what it meant; older, it is a stranger's order and is
         *  dropped, never obeyed (1.4.153). Only "pause" was ever
         *  audited for staleness (1.4.89's law); the audit now covers
         *  every kind, because a stale "play" collected at some later
         *  reload is an autoplay nobody ordered.
         *
         *  The context audit (M-9) runs HERE, at execution time — this
         *  take is the door both execution roads pass through (the
         *  page's pull, and backstageServe's poke). If the page has a
         *  living context and it is NOT the context the press was
         *  stored against, the press is dropped, never released to be
         *  executed against whatever the page happens to show now.
         *  Two honest exceptions: "pause" is exempt (its page-side
         *  door can only silence, and its lifecycle is already
         *  governed by 1.4.120/1.4.125 — a fresh catch or a play
         *  intent clears it), and an EMPTY current context releases
         *  the press: a page that has pushed no session yet is the
         *  recovery case the stored press exists for, and there the
         *  stamp travels with the command (see lastTakenCtx) for the
         *  page's own execution-time check. Every drop leaves its
         *  reason among the drop notes, so the death is a receipt,
         *  not a silence (T2-21).
         *
         *  The take LOOPS (R3-T2-2): a condemned head is dropped
         *  with its receipt and the press standing behind it is
         *  judged in the same call — the peek below has always done
         *  this, and the take's old stop-at-the-corpse shape let a
         *  stale head eat a surfacing's only take whole, stranding
         *  a fresh, valid press behind it until some later door.
         *  The Bridge's answer is now the first press that PASSES
         *  the audits, or nothing when the queue has drained. */
        fun takePendingCmd(): String? {
            // Pop and audit in ONE synchronized step (T2-14): each
            // head press is removed as it is judged, so no second
            // taker — main thread or JavaBridge thread — can ever
            // read the same press and deliver it twice.
            synchronized(pendingLock) {
                while (true) {
                    val press = pendingQueue.removeFirstOrNull() ?: return null
                    if (System.currentTimeMillis() - press.at > 20_000) {
                        recordDropNote("a stored press went stale")
                        continue
                    }
                    if (press.cmd != "pause" && press.ctx.isNotEmpty()) {
                        val cur = currentContext()
                        if (cur.isNotEmpty() && cur != press.ctx) {
                            recordDropNote("a stored press's session had moved on")
                            continue
                        }
                    }
                    lastTakenCtx = press.ctx
                    return press.cmd
                }
            }
        }

        /** Look at the head press WITHOUT spending it (T2-10): the
         *  expiry and context audits run exactly as in the take —
         *  a press they condemn is dropped here, with its receipt —
         *  but a press they pass stays stored. backstageServe pokes
         *  the verb it peeks; only a poke the page proves it heard
         *  (a state push landing inside the watch window) earns the
         *  drain below. The old road took first and poked second:
         *  the stored press was the only copy, and a poke fired into
         *  a backstage window whose JS context had died in a reload
         *  spent it on a channel that did not exist. */
        private fun peekPendingPress(): PendingPress? {
            synchronized(pendingLock) {
                while (true) {
                    val press = pendingQueue.firstOrNull() ?: return null
                    if (System.currentTimeMillis() - press.at > 20_000) {
                        pendingQueue.removeFirst()
                        recordDropNote("a stored press went stale")
                        continue
                    }
                    if (press.cmd != "pause" && press.ctx.isNotEmpty()) {
                        val cur = currentContext()
                        if (cur.isNotEmpty() && cur != press.ctx) {
                            pendingQueue.removeFirst()
                            recordDropNote("a stored press's session had moved on")
                            continue
                        }
                    }
                    return press
                }
            }
        }

        fun peekPendingCmd(): String? = peekPendingPress()?.cmd

        /** The head press's own number, or null when the queue is
         *  empty — how a watcher names the press it poked without
         *  spending it (T2-10 completion). */
        fun pendingHeadId(): Long? = synchronized(pendingLock) { pendingQueue.firstOrNull()?.id }

        /** Consume the head press after a VERIFIED poke (T2-10): the
         *  page pushed state inside the watch window, so the poked
         *  verb was heard and the stored copy must not be collected
         *  a second time by a later pull. Only the very press that
         *  was poked is drained — if the head has moved on (the page
         *  collected it itself through the Bridge, or a newer press
         *  leads now), this is a no-op. The drained press's stamp
         *  does NOT travel to lastTakenCtx (R2-T2-5): the Bridge
         *  take is that slot's only writer, so the page never judges
         *  its own press against a drained press's context. */
        fun drainPokedCmd(id: Long) {
            synchronized(pendingLock) {
                val head = pendingQueue.firstOrNull() ?: return
                if (head.id != id) return
                pendingQueue.removeFirst()
            }
        }

        // ── The tap-time truth (M-6) ────────────────────────────────
        // The panel's state is a SNAPSHOT: the page pushes it on its
        // own cadence, and between the page's real transition and the
        // push landing here, the snapshot is one state behind. A
        // transport press judged against the snapshot in that window
        // computes the inverse of his intent — the 1.4.89 inversion,
        // alive on the live-poke road even after the stored road was
        // cured. The transitions that make the snapshot lie are known:
        // above all the house's OWN definite presses. So every
        // definite play/pause the shell issues is remembered here as
        // the commanded truth, and until a push CONFIRMS it (or it
        // ages out past the toggle watchdog's last rung) a tap is
        // judged against the commanded state — the state that is true
        // when tapped, because his last press made it so.
        @Volatile private var cmdPlaying: Boolean? = null
        @Volatile private var cmdPlayingAt = 0L

        /** Remember a definite play/pause the shell just issued. */
        fun noteCommanded(playing: Boolean) {
            cmdPlaying = playing; cmdPlayingAt = System.currentTimeMillis()
        }

        /** Forget the commanded truth: a fresh catch voids it (the
         *  session it described is gone), and a push that agrees with
         *  it confirms it — either way the snapshot rules again. */
        fun clearCommanded() { cmdPlaying = null }
        fun confirmPush() {
            val c = cmdPlaying ?: return
            val j = runCatching { JSONObject(nowJson) }.getOrNull() ?: return
            if (j.optBoolean("playing") == c) cmdPlaying = null
        }

        // ── The stored pause's witness (R4-T2-1) ───────────────────
        // notePagePaused stores its "pause" unconditionally — the
        // store IS the 1.4.120 handover: a page that never heard the
        // poke must find the stop waiting when it is resurrected.
        // But nothing retired the stored copy when the page HAD
        // heard: the poke paused it, Oscar resumed the session by
        // hand in the app, and any collection door firing inside the
        // twenty seconds executed the stored echo against the
        // session he had just restarted — his newest word was play,
        // and the queue answered with his older pause. The witness
        // below is the retirement door. It arms when a pause is
        // stored; a push reporting silence marks the pause ANSWERED
        // (the page heard and obeyed — its own belief is now
        // "paused"); a later push reporting playing, with the
        // witness answered, can only be his hand resuming (a page
        // that answered cannot resurrect itself playing — recovery
        // restores the paused session it saved), so the stored
        // pause is retired on the spot. A page that never answered —
        // dead, hung, still believing "playing" — never triggers the
        // retirement: its resurrection collects the pause and is
        // silenced, exactly the handover the store exists for.
        @Volatile private var pauseWitnessArmed = false
        @Volatile private var pauseWitnessAnswered = false

        /** Arm the witness: a pause was just stored (notePagePaused,
         *  or wakeForPending's store road). */
        fun armPauseWitness() {
            pauseWitnessAnswered = false
            pauseWitnessArmed = true
        }

        /** Judge the push that just landed (bubbleNow calls this
         *  for every push): silence answers a standing pause; sound
         *  after an answer retires it. The witness disarms itself
         *  once no pause stands — a fresh catch (deliver) or his own
         *  play press (NativeSpeaker.resume) clears the queue by
         *  their own doors, and the next judge call tidies up. */
        fun judgePushForPause() {
            if (!pauseWitnessArmed) return
            if (!hasPendingPause()) { pauseWitnessArmed = false; pauseWitnessAnswered = false; return }
            val playing = runCatching { JSONObject(nowJson).optBoolean("playing") }.getOrDefault(false)
            if (!playing) { pauseWitnessAnswered = true; return }
            if (pauseWitnessAnswered) {
                clearPendingPause()
                pauseWitnessArmed = false; pauseWitnessAnswered = false
            }
        }

        /** Whether sound is flowing, judged at THIS moment: the
         *  device voice answers for itself while it drives; else a
         *  still-unconfirmed commanded state outranks the snapshot;
         *  else the snapshot — the page's latest word — stands. */
        fun livePlaying(): Boolean {
            if (NativeSpeaker.active) return NativeSpeaker.playing
            val c = cmdPlaying
            if (c != null && System.currentTimeMillis() - cmdPlayingAt <= 3_000) return c
            return runCatching { JSONObject(nowJson).optBoolean("playing") }.getOrDefault(false)
        }
        @Volatile private var wakeLock: PowerManager.WakeLock? = null

        /** Oscar's law: one tap, then the icon does the work — even with the
         *  screen off. The vulnerable stretch is the render: no audio is
         *  playing yet, so nothing else keeps the processor awake, and the
         *  device sleeps mid-synthesis. While the pushed state says the engine
         *  is working or playing, hold a partial wakelock; release it the
         *  moment the state rests. Bounded at ten minutes per hold, refreshed
         *  by every state push, so a dead page can never drain the battery. */
        fun syncWakeLock(c: Context) {
            val j = runCatching { JSONObject(nowJson) }.getOrNull()
            val fresh = System.currentTimeMillis() - nowAt < 90_000
            val active = j != null && (j.optBoolean("playing") || j.optBoolean("busy")) && fresh
            if (active) {
                val pm = c.getSystemService(Context.POWER_SERVICE) as PowerManager
                val wl = wakeLock ?: pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "logos:stage").apply { setReferenceCounted(false) }
                wakeLock = wl
                @Suppress("WakelockTimeout") wl.acquire(10 * 60 * 1000L)
            } else {
                wakeLock?.let { if (it.isHeld) it.release() }
                wakeLock = null
            }
            retireHoldFile(c)
        }

        /** The native stage hold is GONE (1.4.90, Oscar's subtraction):
         *  a near-silent loop the shell played while the page rendered —
         *  and it was never silent: its samples were written {255, 0, 1}
         *  instead of {-1, 0, 1} (the -1 lost its high byte), a crackle
         *  he could hear behind every Processing…. Even written right it
         *  earned nothing the wakelock above doesn't already give, so
         *  the mechanism is deleted, not turned down — nothing in the
         *  shell makes sound anymore except his books. This just sweeps
         *  the old file away, once. */
        private var holdRetired = false
        private fun retireHoldFile(c: Context) {
            if (holdRetired) return
            holdRetired = true
            runCatching { java.io.File(c.filesDir, "stage-hold.wav").delete() }
        }

        fun releaseWakeLock() {
            wakeLock?.let { if (it.isHeld) it.release() }
            wakeLock = null
        }

        /** The stage lock (Oscar): while on, a fresh copy cannot evict what's playing. */
        fun isLocked(c: Context) = prefs(c).getBoolean("lock", false)
        fun setLocked(c: Context, on: Boolean) { prefs(c).edit().putBoolean("lock", on).apply(); lockHoldTold = false }
        /** The lock has spoken about a hold since it was last set
         *  (1.4.243): the first copy it holds back is announced
         *  aloud; later holds stay silent until the lock is set
         *  anew — Oscar's ruling after an evening of silent holds:
         *  the user must be told the lock is on and what it does,
         *  at the moment it does it. */
        @Volatile var lockHoldTold = false

        /** The one lock over a catch's three facts — its text, its
         *  manual flag and its uncommitted dedupe key (R3-T2-4):
         *  deliver() writes the three under it, the Bridge's pull
         *  (takeClip, below) snapshots and clears them under it, and
         *  the key's commit and the catch's expiry take it too, so
         *  no road ever sees the three mid-handover from the other. */
        private val clipLock = Any()

        /** A clipboard text waiting for the page to pull it through the bridge. */
        /** When the waiting catch was stored (T2-13): the setter
         *  stamps every non-null store, so the Bridge can enforce
         *  the same twenty-second expiry law on this channel that
         *  pendingCmd has always had — a catch that survives its
         *  delivery watch no longer sits here indefinitely, waiting
         *  to ambush the next unrelated opening of Logos hours
         *  later and evict whatever is then on the stage. */
        @Volatile var clipTextAt = 0L
        var clipText: String? = null
            set(value) {
                field = value
                if (value != null) clipTextAt = System.currentTimeMillis()
            }
        var clipManual = false
        /** The copy-queue mode as the page last reported it (its
         *  pushes carry it; refreshPanel mirrors it here, 1.4.241).
         *  deliver() reads it at the lock's door: the stage lock
         *  holds a catch back only when the catch would REPLACE
         *  what is playing — with the queue on, a catch only lines
         *  up and waits its turn, and the lock's own card has only
         *  ever promised the replacement hold. Before the first
         *  push of a fresh service this reads off. */
        @Volatile var queueModeSeen = false
        /** The dedupe key of the catch currently waiting, and of the
         *  last catch the page CONFIRMED it pulled (T2-7). The key
         *  used to be committed in deliver(), before any
         *  confirmation: a delivery whose pull ultimately failed was
         *  deduped forever — re-copying the identical text was
         *  swallowed as a repeat of a delivery nobody ever heard —
         *  while the in-memory key died with the process, so a text
         *  copied once and already heard delivered AGAIN after a
         *  restart. Now the key waits here, uncommitted, until the
         *  page pulls the text through Bridge.bubbleClip (the one
         *  road that proves delivery); only then is it committed —
         *  to memory AND to prefs, so the dedupe survives the
         *  process reaper and an already-heard text stays heard. */
        @Volatile private var pendingKey: String? = null
        fun confirmClipPulled(c: Context) {
            synchronized(clipLock) {
                val k = pendingKey ?: return
                pendingKey = null
                lastKey = k
                // commit(), not apply(): the whole point is surviving a
                // process death that may come a breath after the pull.
                prefs(c).edit().putString("lastClipKey", k).commit()
            }
        }
        /** The committed dedupe key, from memory or — after a
         *  restart — from prefs (T2-7). */
        fun committedClipKey(c: Context): String? =
            lastKey ?: prefs(c).getString("lastClipKey", null)?.also { lastKey = it }
        /** A waiting catch died unconfirmed (its twenty seconds ran
         *  out at the Bridge): its uncommitted key dies with it, so
         *  the text can be copied and delivered fresh (T2-7/T2-13). */
        fun expireClip() {
            synchronized(clipLock) {
                clipText = null
                pendingKey = null
            }
        }

        /** Pull the waiting catch, whole (R3-T2-4) — the Bridge's
         *  bubbleClip door lives here now. The snapshot, the clear
         *  and the key's commit are ONE step under clipLock, the
         *  same lock deliver() writes the catch's three facts under,
         *  so the key committed is always the key of the text that
         *  was actually pulled. The race this replaces ran the pull
         *  on the JavaBridge thread as separate statements against
         *  deliver()'s main-thread writes: a deliver(B) landing
         *  mid-pull of catch A lost B's text in place (the pull
         *  nulled it) and committed B's key unheard — B never
         *  played, its delivery watch read the null as "confirmed"
         *  and stood down, and B was deduped forever: T2-7's harm,
         *  re-homed into its own cure's commit door. The expiry law
         *  (T2-13) is judged inside the same step, from the catch's
         *  own birth stamp. */
        fun takeClip(c: Context): String {
            synchronized(clipLock) {
                val t = clipText ?: return ""
                if (System.currentTimeMillis() - clipTextAt > 20_000) {
                    expireClip()
                    noteTry(c, s("a stored catch went stale", "una captura guardada caducó"))
                    return ""
                }
                val m = clipManual
                clipText = null
                confirmClipPulled(c)
                return JSONObject().put("t", t).put("m", m).toString()
            }
        }
        /** Latest player state pushed by the page (JSON: playing, active, title, sub). */
        var nowJson = ""
            set(value) {
                field = value
                if (value.isNotEmpty()) {
                    val l = runCatching { JSONObject(value).optString("lang", "") }.getOrDefault("")
                    if (l == "en" || l == "es") uiLang = l
                }
            }
        /** The app's chosen language, learned from the page's pushes — the
         *  panel speaks it too (1.4.104). */
        @Volatile var uiLang = "en"
        fun s(en: String, es: String): String = if (uiLang == "es") es else en
        /** When the page last pushed state — the watchdog's pulse. */
        @Volatile var nowAt = 0L

        /** The page generation (R2-T2-1): how many times a page has
         *  finished loading in this process. backstageServe's drain
         *  watch compares the generation at poke time against the
         *  generation at verdict time — a load that finished inside
         *  the window means the answering push came from a NEW page
         *  that never received the poked event, however faithfully
         *  its restore push matches the press's session stamp, so
         *  the drain stands down and the press travels the recovery
         *  road (the page collects it through the Bridge) instead of
         *  being spent unheard.
         *
         *  The stamp's source is the activity's page-load boundary:
         *  MainActivity's onPageFinished calls notePageLoaded()
         *  (landed in 187 — the wiring debt this comment once
         *  carried is paid). An over-eager stamp can only ever stand
         *  a watch down (the safe direction — collection, not loss);
         *  it can never earn one. Since R3-T2-1 the panel road
         *  consults the same counter: pokeOrWake's liveness watch
         *  and the toggle's pageAnswered() both demand an unchanged
         *  generation before any push may be read as receipt. */
        @Volatile var pageEpoch = 0L
            private set
        fun notePageLoaded() { pageEpoch++ }

        /** The page incarnation (R4-T2-2): bumped at every load
         *  START (MainActivity's onPageStarted), where pageEpoch
         *  moves at load FINISH. A push is recorded under the
         *  incarnation current when it lands, so the latch below can
         *  answer the question the epoch alone could not: did a push
         *  land while the page that was poked was still the page —
         *  even if a reload has since replaced it? The old verdict
         *  sampled only at +1200 ms (epoch unchanged AND a push
         *  landed), so a press the poked page genuinely heard and
         *  answered was stored anyway whenever a house reload
         *  completed inside the window, and the fresh page collected
         *  and executed it a second time — one press, two leaps, on
         *  every non-idempotent verb the watch serves. A new page's
         *  pushes can never satisfy an old incarnation's watch: its
         *  first push already records under the new number, because
         *  the number moved when its load STARTED, before any of its
         *  script ran. R3-T2-1's counterfeit stays dead; the hearing
         *  is now remembered instead of re-derived at verdict time. */
        @Volatile var pageIncarnation = 0L
            private set
        fun notePageLoading() { pageIncarnation++ }

        /** When the latest push landed, by incarnation (R4-T2-2).
         *  Only the newest few incarnations are kept: a watch
         *  verdicts 1.2 s after its poke, and incarnations turn
         *  over on page loads, not on breaths. */
        private val pushLatchLock = Any()
        private val pushTimesByIncarnation = HashMap<Long, Long>()

        /** Record a push (MainActivity's bubbleNow, the only push
         *  door): it landed now, under the incarnation that sent it. */
        fun notePushTime() {
            synchronized(pushLatchLock) {
                pushTimesByIncarnation[pageIncarnation] = System.currentTimeMillis()
                val floor = pageIncarnation - 3
                val it = pushTimesByIncarnation.keys.iterator()
                while (it.hasNext()) { if (it.next() < floor) it.remove() }
            }
        }

        /** Did a push land under THIS incarnation after `after` —
         *  the poked page's own answer, remembered across any
         *  reload that followed it? */
        fun pushedUnder(incarnation: Long, after: Long): Boolean =
            synchronized(pushLatchLock) { (pushTimesByIncarnation[incarnation] ?: 0L) > after }

        /** True until the page pushes its first state in this process.
         *  The honest never-pushed test (T2-5): nowJson is a non-null
         *  String initialised "", so comparing it to null can never
         *  fire — a first load still in flight was judged a corpse by
         *  that dead guard. nowAt starts at 0L and is stamped on every
         *  push (MainActivity's bubbleNow bridge), so 0L means exactly
         *  "never pushed". Once the page HAS pushed, this is false and
         *  every corpse check downstream runs unchanged. */
        fun pageNeverPushed(): Boolean = nowAt == 0L
        var onNow: (() -> Unit)? = null
        /** Set by the service: a fresh catch arms its delivery watch. */
        var onDelivery: (() -> Unit)? = null
        /** The last rung of the delivery ladder: the activity reloads its
         *  page when this is standing as it comes forward. */
        /** When the reload was asked for (T2-13): the setter stamps
         *  every raising, and the activity honours the flag only
         *  inside the same twenty-second law as every other stored
         *  order — a reload asked for and never consumed used to
         *  wait indefinitely and fire at some much later arrival,
         *  reloading a healthy page nobody had asked to reload. */
        @Volatile var wantReloadAt = 0L
        var wantReload = false
            set(value) {
                field = value
                if (value) wantReloadAt = System.currentTimeMillis()
            }
        var running = false
        /** Set when Paste & play could not read from the bubble: the page reads it itself as Logos opens. */
        var wantClip = false
        var deliveries = 0
        @Volatile var lastDeliveryAt = 0L
        /** A seek chosen on the panel's bar, pulled once by the page. */
        /** When the seek was chosen, and against which session
         *  (T2-13 + T2-19): the setter stamps every real store, so
         *  the Bridge can drop a seek that outlives the twenty-
         *  second law — a fraction set while the page could not
         *  hear it used to survive until some later session pulled
         *  it and jumped mid-book — and can refuse a seek whose
         *  session has moved on, exactly as a stored press is
         *  refused. The stamp travels with a taken seek in
         *  lastTakenSeekCtx (Bridge.bubbleSeekCtx), for the page's
         *  own check against a session its recovery restored. */
        @Volatile var seekFracAt = 0L
        @Volatile var seekCtx: String = ""
        @Volatile var lastTakenSeekCtx: String = ""
        @Volatile var seekFrac = -1.0
            set(value) {
                field = value
                if (value >= 0) { seekFracAt = System.currentTimeMillis(); seekCtx = currentContext() }
            }
        /** An absolute rate chosen on the panel's speed list
         *  (1.4.205), pulled once by the page through the Bridge —
         *  twenty seconds of life at that door, like the seek's.
         *  No session context travels with it: the rate is a global
         *  setting, and belongs to whichever reading stands when
         *  it lands. */
        @Volatile var ratePickAt = 0L
        @Volatile var ratePick = -1.0
            set(value) {
                field = value
                if (value > 0) ratePickAt = System.currentTimeMillis()
            }
        /** The confirmed front paste's stamp (1.4.206): Paste now,
         *  behind its card, flags the delivery it is about to make —
         *  the page pulls it once through the Bridge and judges the
         *  arrival by the front road instead of the tail's. Twenty
         *  seconds of life at that door, like the rate's. */
        @Volatile var pasteFrontAt = 0L
        @Volatile var pasteFront = false
            set(value) {
                field = value
                if (value) pasteFrontAt = System.currentTimeMillis()
            }
        /** The media session's seek target (1.4.193): an absolute
         *  book-millisecond count, stamped by PlaybackService's
         *  onSeekTo exactly the way seekFrac is stamped — the same
         *  twenty-second law and the same session-context judgment
         *  apply at its pull door (Bridge.bubbleSeekTo), and its
         *  stamp travels in lastTakenSeekToCtx for the page's own
         *  check, the seek twin of the panel fraction's road. */
        @Volatile var seekToMs = -1L
        @Volatile var seekToAt = 0L
        @Volatile var seekToCtx: String = ""
        @Volatile var lastTakenSeekToCtx: String = ""
        /** A copy-queue row chosen on the panel (1.4.198): which
         *  lined-up text to play, or to drop — pulled once by the
         *  page under the same laws as the seek's (twenty seconds of
         *  life, and the session it was chosen against must still
         *  stand). Each verb carries its own taken-stamp. */
        @Volatile var queuePlayIdx = -1
        @Volatile var queuePlayAt = 0L
        @Volatile var queuePlayCtx: String = ""
        @Volatile var lastTakenQueuePlayCtx: String = ""
        @Volatile var queueDropIdx = -1
        @Volatile var queueDropAt = 0L
        @Volatile var queueDropCtx: String = ""
        @Volatile var lastTakenQueueDropCtx: String = ""
        @Volatile var queueSaveIdx = -1
        @Volatile var queueSaveAt = 0L
        @Volatile var queueSaveCtx: String = ""
        @Volatile var lastTakenQueueSaveCtx: String = ""
        fun storeQueuePlay(idx: Int) { queuePlayIdx = idx; queuePlayAt = System.currentTimeMillis(); queuePlayCtx = currentContext() }
        fun storeQueueDrop(idx: Int) { queueDropIdx = idx; queueDropAt = System.currentTimeMillis(); queueDropCtx = currentContext() }
        fun storeQueueSave(idx: Int) { queueSaveIdx = idx; queueSaveAt = System.currentTimeMillis(); queueSaveCtx = currentContext() }
        /** Set by the service: wave the bubble (leaving-Logos trigger). */
        var inviteHook: (() -> Unit)? = null
        private var lastKey: String? = null

        /** The clipboard dedupe key (T2-2): a strong digest of the
         *  FULL text, with its length. The old key — length * 31 +
         *  the 32-bit String.hashCode() — collides by construction:
         *  "Aa…" and "BB…" (likewise "FB…"/"Ea…") share length and
         *  hash, so the second, different copy was swallowed as a
         *  repeat before any receipt was written. SHA-256 over the
         *  text's UTF-8 bytes makes the key a fingerprint of the
         *  whole text: different texts yield different keys,
         *  identical text yields the same key, deterministically. */
        private fun clipKey(text: String): String {
            val digest = java.security.MessageDigest.getInstance("SHA-256")
                .digest(text.toByteArray(Charsets.UTF_8))
            val hex = digest.joinToString("") { "%02x".format(it.toInt() and 0xff) }
            return "${text.length}:$hex"
        }

        private var pendingManual = false
        /** The one blink in flight (T2-18): pendingManual used to be
         *  a single shared flag that every readClip overwrote before
         *  launching its ClipActivity blink, and deliverFromClip
         *  delivered with whatever the flag held when A blink
         *  returned — so an automatic read landing between a manual
         *  Paste-now and its blink downgraded the manual delivery
         *  (the stage lock and the dedupe could swallow the one read
         *  promised a guaranteed floor), and the reverse upgraded an
         *  automatic read past the lock he set. ClipActivity carries
         *  no token identifying which ask it answers, so the shell
         *  now allows exactly ONE blink in flight: a read that would
         *  blink while one is outstanding JOINS it instead of
         *  overwriting its flag — a manual join may only UPGRADE the
         *  outstanding ask (the blink reads the same clipboard for
         *  both), never downgrade it — and deliverFromClip consumes
         *  the flag as it clears the flight. A flight older than
         *  five seconds is a blink that died without delivering;
         *  the next read may launch a fresh one. */
        @Volatile private var blinkInFlight = false
        @Volatile private var blinkAt = 0L
        private var lastTrampoline = 0L
        private var trySource = "panel"

        /** The panel lever's authority (T2-17): a lever flip made on
         *  the panel writes the native pref and pokes the page — and
         *  if that poke is lost (the dead or zombie page the native
         *  mirror exists for), the page's next init used to push its
         *  own stale setting DOWN over the pref, silently reverting
         *  his flip. Now a panel flip stands as the native truth
         *  until the page proves it heard: it either pulls the value
         *  itself (Bridge.bubbleAuto — the lever listener's road,
         *  which clears this mark) or pushes a value that AGREES.
         *  A page push that disagrees while the mark stands is
         *  refused, and the page is poked "lever" again so it pulls
         *  the truth. A push with no mark standing — the Settings
         *  switch's own road — is accepted as always.
         *  (T2-17 completion: the mark originally stood only while
         *  FRESH — 60 seconds — so a flip whose poke was lost to a
         *  page dead or asleep longer than a minute was still
         *  silently reverted by that page's next init push. The mark
         *  now stands until it is CONSUMED — by the page's own pull
         *  or by an agreeing push — however long the page was gone;
         *  leverNativeAt keeps the moment for the record, no longer
         *  as a gate.) */
        @Volatile private var leverNativePending = false
        @Volatile private var leverNativeAt = 0L
        fun notePanelLever() {
            leverNativePending = true
            leverNativeAt = System.currentTimeMillis()
        }
        /** The page pushes its lever value down (Bridge.bubblePrefs):
         *  returns true when the push was accepted. */
        fun pageLeverPush(c: Context, auto: Boolean): Boolean {
            if (leverNativePending) {
                val native = lever(c)
                if (auto != native) {
                    runCatching { poke?.invoke("lever") }
                    return false
                }
                leverNativePending = false
            }
            prefs(c).edit().putBoolean("auto", auto).apply()
            return true
        }
        /** The page pulls the lever value (Bridge.bubbleAuto): the
         *  pull itself is the acknowledgement — the mark clears. */
        fun pageLeverPull(c: Context): Boolean {
            leverNativePending = false
            return lever(c)
        }

        /** A line for the Settings card, so a failed read is evidence, not a mystery. */
        fun noteTry(c: Context, what: String) {
            val t = java.text.SimpleDateFormat("h:mm a", java.util.Locale.US).format(java.util.Date())
            prefs(c).edit().putString("lastTry", "$what · $t").apply()
        }

        fun prefs(c: Context) = c.getSharedPreferences("bubble", Context.MODE_PRIVATE)
        fun lever(c: Context) = prefs(c).getBoolean("auto", true)

        /** The floating window's look (1.4.157), set from Settings via
         *  the page: the bubble's opacity, the panel's opacity, the
         *  bubble's size. Kept here so a service reborn mid-session
         *  dresses the same way. (The idle fade that once rode along
         *  was retired in 1.4.224 — Oscar's law: the opacity he sets
         *  by hand is the only one; no second, hidden amount may
         *  contradict it.) */
        @Volatile var lookHook: (() -> Unit)? = null
        fun lookBa(c: Context) = prefs(c).getInt("look_ba", 100).coerceIn(0, 100) / 100f
        fun lookPa(c: Context) = prefs(c).getInt("look_pa", 100).coerceIn(0, 100) / 100f
        fun lookSize(c: Context) = prefs(c).getString("look_size", "m") ?: "m"
        fun setLook(c: Context, ba: Int, pa: Int, size: String) {
            prefs(c).edit().putInt("look_ba", ba).putInt("look_pa", pa).putString("look_size", size).apply()
            lookHook?.invoke()
        }

        /** The time-jump seconds (1.4.163): the page's Settings keep
         *  them; the panel's jump keys and the shade's icons read
         *  them from here, so every surface leaps the same distance. */
        fun setJump(c: Context, jb: Int, jf: Int) {
            val b = jb.coerceIn(1, 600); val f = jf.coerceIn(1, 600)
            val p = prefs(c)
            if (p.getInt("jump_b", 15) == b && p.getInt("jump_f", 30) == f) return
            p.edit().putInt("jump_b", b).putInt("jump_f", f).apply()
            // The deed changes the moment these prefs move — the
            // page jumps by its live settings and NativeSpeaker.jump
            // reads these prefs live — but the media card used to
            // keep naming and picturing the OLD seconds until some
            // unrelated state change happened to republish it,
            // because its build ran only on a publish and the page's
            // publish dedupe key excludes the jump seconds (T2-15).
            // A changed value now rebuilds the standing card from
            // its own last publish, so name, icon and deed agree.
            PlaybackService.refreshCard(c)
        }

        /** The theme family (1.4.165): 'dark' | 'light' | 'tron' |
         *  'cyberpunk', kept in prefs so the bubble wears its theme
         *  even before the page wakes; a change repaints in place. */
        fun themeFam(c: Context) = prefs(c).getString("theme_fam", "dark") ?: "dark"
        fun setTheme(c: Context, fam: String) {
            if (themeFam(c) == fam) return
            prefs(c).edit().putString("theme_fam", fam).apply()
            lookHook?.invoke()
        }

        fun readClipboard(c: Context): String = runCatching {
            val cm = c.getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
            val clip = cm.primaryClip ?: return@runCatching ""
            if (clip.itemCount == 0) return@runCatching ""
            clip.getItemAt(0).coerceToText(c)?.toString()?.trim().orEmpty()
        }.getOrDefault("")

        /** A clipboard text takes the stage: stored for the page to pull, and the page is poked.
         *  The same text twice in a row does not restart itself (unless Oscar asked by hand). */
        /** A press that arrived with no activity to hear it (the media
         *  notification's buttons, audit E-3): remember it where the page
         *  collects pending commands on waking, and pay the page a ghost
         *  visit — the same net the panel's transport keys already have. */
        /** A stop spoken to the device voice is a stop for the whole
         *  house (1.4.120). The device voice is a shell creature; the page
         *  — which owns the session — never heard the pause, and its
         *  session still said "playing". Every later resurrection of the
         *  page (a visit, a reload, a renderer recovery) then did what a
         *  playing session does: it started the audio BY ITSELF, long
         *  after Oscar had stopped it and gone to other things. So a
         *  native pause now also pauses the page: directly when a page
         *  can hear it, and as a stored command when it cannot — the
         *  page's own collection honours a stored pause as silence and
         *  never as a summon (1.4.89's law). Play-side intents clear the
         *  stored pause again: the newest word is his. */
        fun notePagePaused() {
            nativeGen++ // his stop also ends the delivery chain (1.4.125)
            noteCommanded(false) // the tap-time truth (M-6): silence was commanded
            // The store's witness (R4-T2-1): if the page hears this
            // poke and later reports playing again by his hand, the
            // stored copy retires instead of ambushing his resume.
            armPauseWitness()
            storePendingCmd("pause")
            runCatching { poke?.invoke("pause") }
        }

        fun titleFromText(text: String): String {
            val line = text.lineSequence().firstOrNull { it.isNotBlank() }?.trim() ?: "Logos"
            val words = line.split(Regex("\\s+")).take(7).joinToString(" ")
            return if (words.length < line.length) "$words…" else words
        }

        // The native-fallback chain's memory lives in the companion
        // (1.4.122): the page's handover arrives here, while the chain
        // itself runs on the service instance — one memory for both.
        var nativeGen = 0
        var nativeText: String? = null
        var nativeSig = ""

        /** The page hands its session to the shell's device voice
         *  (1.4.122): its own WebView speech bridge can run a sentence
         *  to "completion" in total silence, and a wedged or silent
         *  render must end in a voice that exists. The shell's Android
         *  TTS takes the text from the sentence where the page stopped
         *  and switches language sentence by sentence. */
        /** The page ends a session it handed over (1.4.124): its
         *  sleep timer fired, or a new text replaced the old one.
         *  The shell's voice stops — a stop is a stop for the whole
         *  house, in both directions. */
        fun stopNativeFromPage() {
            if (NativeSpeaker.active) NativeSpeaker.stop()
        }

        fun handToNative(c: Context, text: String, title: String, idx: Int) {
            if (text.isBlank()) return
            if (NativeSpeaker.active && nativeText == text) return
            nativeText = text
            noteTry(c, s("the device voice took over", "la voz del dispositivo tomó el relevo"))
            NativeSpeaker.takeOver(c, text, title.ifBlank { titleFromText(text) }, idx)
        }

        fun wakeForPending(c: Context, cmd: String) {
            if (cmd == "pause") nativeGen++ // a stored stop ends the chain too (1.4.125)
            if (NativeSpeaker.active) { NativeSpeaker.handle(cmd); return }
            if (cmd == "pause") armPauseWitness() // the stored stop's witness (R4-T2-1)
            storePendingCmd(cmd)
            if (backstageServe(c)) return
            runCatching { c.startActivity(Intent(c, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK).putExtra("logos.ghost", true), android.app.ActivityOptions.makeCustomAnimation(c, 0, 0).toBundle()) }
        }

        /** The page lives backstage (1.4.111): it is awake, so a wake is a
         *  direct poke — no ghost visit, no black flash, Oscar stays put. */
        /** Served backstage, with the poke VERIFIED (T2-10): the
         *  stored press is only PEEKED at, never taken, before the
         *  poke — a backstage window survives a page reload while
         *  its JS context does not, so Backstage.active alone is no
         *  proof the page can receive. After the poke, the same
         *  1.2-second liveness watch the toggle's escalation uses:
         *  a state push landing inside the window proves the page
         *  heard, and only then is the stored press drained (so a
         *  later Bridge pull cannot deliver it a second time). On
         *  silence the press was never spent — it stays stored,
         *  and the wake escalates to a ghost visit, whose arriving
         *  page collects the press through the Bridge as it wakes.
         *  The clip poke needs no such guard: clipText is not spent
         *  by poking, only by the page's pull.
         *
         *  The return tells the truth about the serve (R2-T2-4):
         *  true only when something was actually served — a poked
         *  press or a poked clip. An empty queue with no catch
         *  standing returns false, so callers who asked for a wake
         *  (ghostWake and its watches) get their ghost visit instead
         *  of a success reported for work not done. */
        fun backstageServe(c: Context? = null): Boolean {
            val p = poke ?: return false
            if (!Backstage.active) return false
            val press = peekPendingPress()
            if (press != null) {
                val pokedAt = nowAt
                val beforePush = nowJson
                val epochAtPoke = pageEpoch
                p(press.cmd)
                Handler(Looper.getMainLooper()).postDelayed({
                    // The drain is earned by THIS press's own evidence
                    // (T2-10 completion): a push landed, its content
                    // MOVED from the poke-time snapshot, and it speaks
                    // for the press's own session — the context stamp
                    // still matches. A bare nowAt advance used to pass,
                    // so a reloading page's routine init push could
                    // satisfy the watch for a poke that died with the
                    // old JS context, and the stored press — the only
                    // copy — was drained unheard. The drain also names
                    // the press by its number, never its verb: a newer
                    // same-verb press at the head is not the press that
                    // was poked and is never eaten for it.
                    //
                    // The generation conjunct (R2-T2-1): the three
                    // witnesses above are still not receipt — a page
                    // that RELOADED inside the window restores the
                    // same session and its restore push moves content
                    // (playing bit, sub, fraction all reset) while its
                    // context stamp EQUALS the press's, so all three
                    // pass for a page that never received the event,
                    // and its own Bridge collectors — timed from its
                    // script's start — may land after this watch and
                    // find the press already spent. So the drain also
                    // requires that no page load finished inside the
                    // window: the generation at verdict time must be
                    // the generation at poke time. A stood-down drain
                    // loses nothing — the press stays stored and the
                    // escalation below (or the page's own collectors)
                    // delivers it through the Bridge, stamp-checked.
                    val heard = pageEpoch == epochAtPoke && nowAt > pokedAt && nowJson != beforePush &&
                        (press.ctx.isEmpty() || currentContext() == press.ctx)
                    if (heard) {
                        drainPokedCmd(press.id)
                    } else if (pendingHeadId() == press.id && c != null) {
                        runCatching { c.startActivity(Intent(c, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK).putExtra("logos.ghost", true), android.app.ActivityOptions.makeCustomAnimation(c, 0, 0).toBundle()) }
                    }
                }, 1200)
                return true
            }
            if (clipText != null) { p("clip"); return true }
            // Nothing was served (R2-T2-4): an empty queue and no
            // catch standing means this call poked nothing and woke
            // nothing, and it must not report otherwise. The old
            // unconditional true stood ghostWake's unforced callers
            // down — above all the stall watch, whose whole medicine
            // is the visit and the reload it earns — in exactly the
            // regime that watch exists for: a backstage page frozen
            // busy-not-playing, with nobody's press stored and no
            // catch standing. Success now means a serve: a poked
            // press or a poked clip. Anything less, the visit is
            // the caller's.
            return false
        }

        fun deliver(c: Context, text: String, manual: Boolean) {
            if (text.isEmpty()) return
            // A fresh catch is meant to be heard: it supersedes a stored
            // stop (1.4.120), which would otherwise pause the new text.
            if (hasPendingPause()) clearPendingPause()
            // …and it voids the commanded truth (M-6): the session the
            // last definite press described is being replaced, so no
            // tap may be judged against its ghost.
            clearCommanded()
            if (!manual && isLocked(c) && !queueModeSeen) {
                noteTry(c, s("the lock held a copy back", "el candado retuvo una copia"))
                // The hold speaks (1.4.243): a silent hold cost
                // Oscar an evening of «the queue doesn't work» —
                // the lock held every copy and said nothing. The
                // first hold after each setting of the lock is
                // announced where he stands; the rest stay silent.
                if (!lockHoldTold) {
                    lockHoldTold = true
                    Toast.makeText(c, s("The stage is locked — a copy was held back", "La escena está bloqueada — una copia fue retenida"), Toast.LENGTH_LONG).show()
                }
                return
            }
            val key = clipKey(text)
            // The dedupe judges against the COMMITTED key — the last
            // catch the page confirmed it pulled, in this process or
            // a previous one (T2-7) — and against the key of the
            // catch still waiting for its pull, so a repeat copy
            // arriving while the first is in flight is still a
            // repeat. This catch's own key is NOT committed here:
            // it waits in pendingKey until Bridge.bubbleClip proves
            // the page took the text (confirmClipPulled). A delivery
            // whose pull fails therefore dedupes nothing — copying
            // the text again is a new delivery, as it should be.
            //
            // The pending leg carries the twenty-second law too
            // (R2-T2-2): the promise above held only while a pull
            // could still land — pendingKey was retired solely by a
            // successful pull or by expireClip, and expireClip ran
            // only at the pull door, so a catch whose page could not
            // pull for a long stretch (offline, an evicted service-
            // worker cache: no pull, no visit) left its key standing
            // for hours, and a fresh copy of the same text died at
            // this door in silence — no delivery, no receipt, and
            // when the page finally did pull, the original catch was
            // stale and expired into nothing. The law the pull door
            // enforces is now enforced here as well: the pending key
            // is honoured only while its catch is inside its twenty
            // seconds (clipTextAt is the catch's birth stamp — the
            // setter lays it in the same breath that stores the
            // catch, and the pair is retired together everywhere).
            // Past the law, the stale catch and its uncommitted key
            // are retired through the same door and with the same
            // receipt the Bridge's stale branch uses, and the fresh
            // copy falls through as the new delivery it is.
            if (!manual) {
                if (key == committedClipKey(c)) return
                if (key == pendingKey) {
                    if (System.currentTimeMillis() - clipTextAt <= 20_000) return
                    expireClip()
                    noteTry(c, s("a stored catch went stale", "una captura guardada caducó"))
                }
            }
            // The catch's three facts land as ONE step (R3-T2-4):
            // its uncommitted key, its text and its manual flag are
            // written under clipLock — the lock the Bridge's pull
            // snapshots and clears them under — so a pull can never
            // pair one catch's text with another's key or flag.
            synchronized(clipLock) {
                pendingKey = key
                clipText = text
                clipManual = manual
            }
            deliveries++
            lastDeliveryAt = System.currentTimeMillis()
            noteTry(c, s("read ${text.length} chars via $trySource", "leídos ${text.length} caracteres vía ${if (trySource == "the blink") "el parpadeo" else "el panel"}"))
            onDelivery?.invoke()
            val p = poke
            if (p != null) p("clip")
            else if (manual) {
                // The page is gone: a ghost visit revives it; the page
                // pulls the clip as it wakes, and Oscar stays where he is.
                runCatching {
                    c.startActivity(Intent(c, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK).putExtra("logos.ghost", true), android.app.ActivityOptions.makeCustomAnimation(c, 0, 0).toBundle())
                }
            }
        }

        /** ClipActivity read the clipboard under its brief focus: hand it over. */
        fun deliverFromClip(c: Context, text: String) {
            // Consume the flight and its flag together (T2-18): the
            // manual/auto character of THIS blink was settled when
            // it was launched (or upgraded by a manual join) and is
            // read exactly once, here — no later read can reach back
            // and change what this delivery is.
            blinkInFlight = false
            val manual = pendingManual
            pendingManual = false
            if (text.isEmpty()) {
                noteTry(c, s("the blink found the clipboard empty", "el parpadeo vio el portapapeles vacío"))
                if (manual) Toast.makeText(c, s("Clipboard is empty", "El portapapeles está vacío"), Toast.LENGTH_SHORT).show()
                return
            }
            trySource = "the blink"
            deliver(c, text, manual)
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
    private var bubbleFaceV: FrameLayout? = null
    private var bubbleLambdaV: LambdaView? = null
    private var bubbleRingV: RingView? = null
    private var bubbleShadowV: View? = null
    // The ring's seat (1.4.225): the pushed fraction arrives in steps
    // — a word at a time from the page's voices, a whole sentence at
    // a time from the device voice — so between seats the ring
    // EXTRAPOLATES at the pace the seats themselves teach it, capped
    // at the end of the sentence being read: the shade card's recipe
    // (1.4.196) brought to the bubble. Before this, the ring drew
    // the raw steps — long frozen stretches, then a jump: «a
    // tropezón», and whole sentences where it seemed not to run.
    private var ringSeatFrac = -1f
    private var ringSeatAt = 0L
    private var ringVel = 0f
    private var ringCi = -1
    private var ringCt = 0
    private var ringPlayingNow = false
    private var ringTicking = false
    private fun ringCap(): Float =
        if (ringCt > 0 && ringCi >= 0) ((ringCi + 1).toFloat() / ringCt - 0.0005f).coerceAtLeast(ringSeatFrac) else 1f
    private fun ringDrawnFrac(): Float {
        if (!ringPlayingNow || ringVel <= 0f || ringSeatFrac < 0f) return ringSeatFrac
        val dt = (System.currentTimeMillis() - ringSeatAt).coerceAtLeast(0)
        return (ringSeatFrac + ringVel * dt).coerceAtMost(ringCap()).coerceAtMost(1f)
    }
    private val ringTick = object : Runnable {
        override fun run() {
            val v = bubbleRingV
            if (v == null || v.visibility != View.VISIBLE || ringSeatFrac < 0f) { ringTicking = false; return }
            val drawn = ringDrawnFrac()
            if (Math.abs(drawn - v.frac) > 0.0004f) { v.frac = drawn; v.invalidate() }
            if (ringPlayingNow && drawn < ringCap() - 0.0004f) handler.postDelayed(this, 33) else ringTicking = false
        }
    }
    // The copy queue's panel face (1.4.198): what the last page push
    // said about the line, the footer's queue key, and the list the
    // key opens over the panel's card.
    @Volatile private var panelQueueCount = 0
    @Volatile private var panelQueueCur = -1
    @Volatile private var panelQueueMode = false
    @Volatile private var panelQueueTitles: List<String> = emptyList()
    @Volatile private var panelQueueKinds: List<Boolean> = emptyList()
    private var queueBtnV: View? = null
    private var queueBadgeV: TextView? = null
    private var queueListV: FrameLayout? = null
    private var queueRowsV: LinearLayout? = null
    private var queueHeadV: TextView? = null
    private var queueClearV: TextView? = null
    private var queueListOpen = false
    // The queue sheet's own lever (1.4.206) and the moment IT was
    // flipped by hand: a push already in flight must not revert a
    // flip younger than a breath — the page's next push carries
    // the new truth and the sync below follows it from then on.
    private var queueLeverV: Switch? = null
    private var queueLeverFlipAt = 0L
    private var haloAnim: ObjectAnimator? = null
    private var breathAnim: android.animation.AnimatorSet? = null
    private var seekBar: SeekBar? = null
    private var saveHint: View? = null
    private var saveHintScrim: View? = null
    private var saveHintRun: Runnable? = null
    private var nameTag: View? = null
    private var nameTagRun: Runnable? = null
    private var lockBtn: View? = null
    private var spectrum: SpectrumView? = null
    private var seekHeld = false
    // The sentence scrub (1.4.119): the reading-along text is a handle.
    private var scrubX0 = 0f
    private var scrubY0 = 0f
    private var scrubMode = 0 // 0 undecided, 1 scrubbing, 2 the words keep their scroll
    private var scrubFrom = -1
    private var scrubTarget = -1
    private var lastCi = -1
    private var lastCt = 0
    // The panel's own session belief (M-8): the identity of the session
    // whose sentence coordinates it has accepted (title + total), the
    // sentence window that came with them, and the sessions it has
    // replaced — a straggler push from any of them, arriving just
    // after the panel moved on, is recognised and its index refused.
    // These are session truth, not view state: they survive the
    // panel closing and reopening, like lastCi/lastCt do.
    //
    // One seat per DRIVER (R4-T2-4): the page and the device voice
    // segment the same text differently, so one session wears two
    // coordinate sets — and a single crown let each displace the
    // other. While the device voice held the stage, its pushes
    // crowned the native key and displaced the page's key into the
    // replaced set; when a short native stint ended, the page's own
    // pushes were refused as stragglers in their own session, and
    // the scrub divided by whichever total had been crowned last.
    // Now each driver keeps its own seat — its own key, index,
    // total, sentence window and replaced set — and the working
    // fields (lastCi/lastCt and the sess* mirror) wear the seat of
    // the driver that holds the stage: refreshPanel feeds the
    // device voice's panelJson only while it drives, the page's
    // pushes otherwise. A takeover changes which seat is crowned;
    // it never displaces the other seat, and no index is ever
    // paired with the other segmentation's total.
    private class SessSeat {
        var key = ""
        var ci = -1
        var ct = 0
        var tp = ""
        var tc = ""
        var tn = ""
        /** The sessions this seat has replaced, oldest first, each
         *  with the moment it was displaced (R3-T2-6; per seat since
         *  R4-T2-4). The memory this replaces was ONE session deep:
         *  after two quick changes (A → B → C inside the window) a
         *  straggler from A matched neither the live session nor the
         *  remembered B, so it was accepted AS a session change and
         *  crowned over C — and C's own next push, now matching the
         *  "previous" slot, was refused as the straggler, so for up
         *  to ten seconds the panel believed the dead session and
         *  disbelieved the living one, scrub arithmetic included.
         *  The set is bounded at eight: sessions change on human
         *  timescales, and entries leave as they age out anyway. */
        val replaced = LinkedHashMap<String, Long>()
    }
    private val pageSeat = SessSeat()
    private val nativeSeat = SessSeat()
    private val replacedSessCap = 8
    private var sessKey = ""
    private var sessTp = ""
    private var sessTc = ""
    private var sessTn = ""
    private var playingNow = false
    private var lastInvite = 0L
    private var lastDeliverySeen = 0
    private var rippleAnims: List<ObjectAnimator> = emptyList()
    private var panel: View? = null
    private var panelParams: WindowManager.LayoutParams? = null
    private var titleV: TextView? = null
    private var subV: TextView? = null
    private var toggleB: ImageButton? = null
    // What the panel already shows (M-7): refreshPanel diffs every
    // incoming state against these and touches only the views whose
    // value actually changed — a same-state push mutates nothing.
    // They describe VIEWS, so they die with them in collapsePanel.
    private var shownTitle: String? = null
    private var shownSub: String? = null
    private var shownPlaying: Boolean? = null
    private var shownSeek = -1
    private var shownBarsKey: String? = null
    private var shownLock: Boolean? = null
    private var ctlSlow: View? = null
    private var ctlPrev: View? = null
    private var ctlNext: View? = null
    private var ctlFast: View? = null
    // The queue transport's extra seats (1.4.205): the track keys
    // exist from the panel's birth but only take the row while a
    // copy queue stands; transportQueueMode is the shape the row
    // currently wears, and shownSubMode the shape the sub-line was
    // last painted for (both die with the panel's views in spirit —
    // the next birth re-arranges by force).
    private var ctlTrackPrev: View? = null
    private var ctlTrackNext: View? = null
    private var controlsV: LinearLayout? = null
    private var transportQueueMode = false
    private var shownSubMode = false
    // THE SPEED WHEEL (1.4.207, Oscar's combination lock): in the
    // queue shape the rate leaves the counter's writing and stands
    // as its own drum at the line's end — rateV. A vertical drag
    // rolls it through wheelSteps in a loop, gear-detent by gear-
    // detent, each step applied live through the absolute-rate
    // door; a tap nudges one step up. wheelIdx is the step the
    // drum currently shows; wheelLive stands while a hand is on
    // the drum, so pushes never repaint it mid-roll.
    private var rateV: TextView? = null
    private val wheelSteps = listOf(0.75, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0)
    private var wheelIdx = -1
    private var wheelLive = false
    private var wheelDownY = 0f
    private var wheelStepsApplied = 0
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

    private fun invite(times: Int = 3, force: Boolean = false) {
        val root = bubble ?: return
        if (panel != null || dragTargets.isNotEmpty() || playingNow) return
        val now = System.currentTimeMillis()
        if (!force && now - lastInvite < 12000) return
        lastInvite = now
        val h = halo ?: return
        rippleAnims.forEach { it.cancel() }
        stopBreath()
        if (root.alpha < awakeAlpha()) root.animate().alpha(awakeAlpha()).setDuration(220).start()
        h.visibility = View.VISIBLE
        val sx = ObjectAnimator.ofFloat(h, "scaleX", 1f, 1.55f).apply { duration = 780; repeatCount = times - 1 }
        val sy = ObjectAnimator.ofFloat(h, "scaleY", 1f, 1.55f).apply { duration = 780; repeatCount = times - 1 }
        val al = ObjectAnimator.ofFloat(h, "alpha", 0.7f, 0f).apply {
            duration = 780; repeatCount = times - 1
            addListener(object : android.animation.AnimatorListenerAdapter() {
                override fun onAnimationEnd(a: android.animation.Animator) {
                    if (!playingNow) h.visibility = View.INVISIBLE
                    h.scaleX = 1f; h.scaleY = 1f
                    if (!playingNow) startBreath()
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
        stopBreath()
        if (root.alpha < awakeAlpha()) root.animate().alpha(awakeAlpha()).setDuration(200).start()
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

    /** The delivery watch (Oscar's frozen stretch: copy → open the panel →
     *  tap outside to close it → nothing ever plays, and the reopened panel
     *  is a photograph, its play key dead). A catch is only caught when the
     *  page CONFIRMS it — pulls the text, or pushes a living state. If no
     *  confirmation lands, the shell climbs the same ladder as the keys:
     *  first bring Logos forward so the page collects the text in the open;
     *  if even that page proves dead, ask for a reload as it comes forward.
     *  The text itself sits stored the whole time; nothing is ever lost. */
    // ── The native floor (1.4.112): progress, not pulse ──────────────
    // The watches above measure the page's pulse (its state pushes).
    // Oscar's stuck panel had a living pulse and a frozen render: the
    // pushes flowed every 120 ms while the reading position never moved.
    // So this chain watches the POSITION SIGNATURE (sentence, word,
    // fraction, title). A caught text gets the page, then one real visit,
    // then a fair deadline — and if the signature still has not moved,
    // the shell reads the text itself (NativeSpeaker). If the page ever
    // starts flowing, the native voice yields the stage back to it.

    private fun sigOf(j: JSONObject?): String =
        if (j == null) "" else listOf(
            j.optString("title"), j.optString("tc"), j.optInt("wi", -1),
            (j.optDouble("frac", 0.0) * 200).toInt().toString()
        ).joinToString("|")

    /** "Flowing" judged against a MOVING baseline (1.4.121). The old
     *  test compared the page against its state at ARM time — before it
     *  had even pulled the text. A page that took the text, pushed one
     *  busy state and then froze forever therefore read as "flowing"
     *  at every check (its signature differed from the pre-delivery
     *  state), and the native floor stood down while the panel sat on
     *  "Processing…" with the audio never beginning — Oscar's report.
     *  Now every check re-baselines: flowing means the signature moved
     *  SINCE THE PREVIOUS CHECK, while the page claims to be playing. */
    private fun flowNow(): Boolean {
        val j = runCatching { JSONObject(nowJson) }.getOrNull() ?: return false
        val cur = sigOf(j)
        val moved = cur != nativeSig
        nativeSig = cur
        return j.optBoolean("playing") == true && moved
    }

    private var nativeMoved = false
    private var yieldFlow = 0

    private fun armNativeFallback() {
        val text = clipText ?: return
        if (NativeSpeaker.active) NativeSpeaker.stop()
        val my = ++nativeGen
        nativeText = text
        nativeMoved = false
        nativeSig = sigOf(runCatching { JSONObject(nowJson) }.getOrNull())
        handler.postDelayed({ nativeCheck1(my) }, 30_000)
    }

    /** At rest by his word (1.4.125): a page that is neither playing
     *  nor busy is not frozen — it is PAUSED, most of all when HE
     *  paused it. The chain's whole jurisdiction is sessions that
     *  CLAIM to be working; a quiet page ends the chain where it
     *  stands — no visit, no takeover, no voice from nowhere. This
     *  was the self-firing audio's main door: copy, listen, press
     *  stop, and thirty seconds later the chain — which knew nothing
     *  of his stop — first visited, then read the stopped text aloud
     *  in the device voice. */
    private fun pageAtRest(): Boolean {
        val j = runCatching { JSONObject(nowJson) }.getOrNull() ?: return false
        // An ERRORED session is quiet too, but it is not at rest by his
        // word — it is a failure asking for the floor, and the page
        // says so in its pushes (err, 1.4.125). Quiet + no error = his.
        return !j.optBoolean("playing") && !j.optBoolean("busy") && j.optInt("err", 0) == 0
    }

    private fun nativeCheck1(my: Int) {
        if (my != nativeGen || NativeSpeaker.active) return
        if (pageAtRest()) return
        if (flowNow()) {
            // It moved since the last look. One move earns one more
            // window — a single push followed by stone is the classic
            // freeze, not flow; movement in BOTH windows is real flow,
            // and the standing progress watch guards the session then.
            if (!nativeMoved) {
                nativeMoved = true
                handler.postDelayed({ nativeCheck1(my) }, 20_000)
            }
            return
        }
        noteTry(this, s("the voice needed a visit", "la voz necesitó una visita"))
        ghostWake(force = true)
        handler.postDelayed({ nativeCheck2(my) }, 15_000)
    }

    private fun nativeCheck2(my: Int) {
        if (my != nativeGen || NativeSpeaker.active) return
        if (pageAtRest()) return // he stopped it during the visit's grace
        if (flowNow()) return // the visit revived it
        val text = nativeText ?: return
        noteTry(this, s("the device voice took over", "la voz del dispositivo tomó el relevo"))
        yieldFlow = 0
        // The catch is being heard — in the device voice, but
        // heard: its dedupe key commits as if the page had pulled
        // it, so a restart cannot deliver it a second time (T2-7).
        confirmClipPulled(this)
        NativeSpeaker.takeOver(this, text, titleFromText(text))
        handler.postDelayed({ nativeYield(my) }, 6_000)
    }

    private fun nativeYield(my: Int) {
        if (my != nativeGen) return
        if (!NativeSpeaker.active) return
        // The stage returns only on SUSTAINED flow (1.4.121): the page
        // must move at two consecutive looks. One twitch used to hand
        // the stage back to a page that froze again a sentence later,
        // with nobody left armed to rescue it a second time.
        if (flowNow()) {
            if (++yieldFlow >= 2) {
                noteTry(this, s("the app voice took over", "la voz de la app tomó el relevo"))
                NativeSpeaker.stop()
                return
            }
        } else yieldFlow = 0
        handler.postDelayed({ nativeYield(my) }, 6_000)
    }


    // The standing form of the same watch, for a freeze mid-session (the
    // delivery chain only guards a catch's first minute): while the page
    // claims to be playing AND busy, 25 s without the signature moving
    // earns one real visit; a still-frozen page after that hands its text
    // to the native voice, when the shell holds the text.
    private var progSig = ""
    private var progSigAt = 0L
    private var progVisitAt = 0L

    private fun progressWatch(j: JSONObject?) {
        if (NativeSpeaker.active) return
        if (j?.optBoolean("playing") != true || j.optBoolean("busy") != true) { progSig = ""; return }
        val sig = sigOf(j)
        val now = System.currentTimeMillis()
        if (sig != progSig) { progSig = sig; progSigAt = now; return }
        if (progSigAt == 0L) { progSigAt = now; return }
        if (now - progSigAt < 25_000) return
        if (now - progVisitAt > 60_000) {
            progVisitAt = now
            noteTry(this, s("the render needed a visit", "el render necesitó una visita"))
            ghostWake(force = true)
            return
        }
        val text = nativeText ?: return
        // The shell only holds the text of a CATCH. If the frozen
        // session is a different one (started inside the app), the
        // native voice has nothing of ITS to speak — visits are its
        // only medicine, never another text's voice (1.4.121).
        val held = titleFromText(text)
        val showing = j?.optString("title") ?: ""
        val same = showing == held || showing.startsWith(held.take(12)) || held.startsWith(showing.take(12))
        if (!same) { progVisitAt = now; return }
        noteTry(this, s("the device voice took over", "la voz del dispositivo tomó el relevo"))
        yieldFlow = 0
        confirmClipPulled(this) // heard in the device voice: the catch's key commits (T2-7)
        NativeSpeaker.takeOver(this, text, titleFromText(text))
        handler.postDelayed({ nativeYield(nativeGen) }, 6_000)
    }

    private fun armDeliveryWatch() {
        val n = deliveries
        val at = lastDeliveryAt
        handler.postDelayed({ deliveryCheck(n, at, 1) }, 2500)
    }

    private var watchNowAt = 0L
    private var lastPrewarm = 0L

    private fun deliveryCheck(n: Int, at: Long, rung: Int) {
        if (n != deliveries) return // a newer catch superseded this one
        val j = runCatching { JSONObject(nowJson) }.getOrNull()
        val alive = j?.optBoolean("playing") == true || j?.optBoolean("busy") == true
        if (rung == 2) {
            // After the wake: a page that is pushing again is alive and
            // working, however long its render takes — stand down. A page
            // whose pulse has not advanced since the wake, still claiming
            // to be busy, froze mid-work: climb to the reload.
            if (clipText == null && nowAt > watchNowAt) return
            if (clipText == null && j?.optBoolean("busy") != true) return
            noteTry(this, s("the catch needed a reload", "la captura necesitó recargar"))
            wantReload = true
            ghostWake()
            return
        }
        if (clipText == null || (alive && nowAt >= at)) return // confirmed
        noteTry(this, s("the catch needed a visit", "la captura necesitó una visita"))
        watchNowAt = nowAt
        ghostWake()
        handler.postDelayed({ deliveryCheck(n, at, 2) }, 3500)
    }

    /** The stall watch (Oscar, 2026-11-08): press play, close the window
     *  or lock the phone, and the render froze mid-work — the panel
     *  confessing 'Waiting for Logos…'. A hidden page's workers can still
     *  be frozen by the browser, and a
     *  frozen page sends no pushes. So the watch is pulse-based: while the
     *  state says the page is WORKING (rendering a sentence, or building
     *  its head start), eight seconds without a single new push is a
     *  stall — bring Logos forward, where the same render takes seconds;
     *  six more silent seconds after that, and the page is reloaded as it
     *  arrives. A page whose pulse advances is working, however slowly,
     *  and is left alone. */
    private var stallPulse = 0L
    private val stallRung2 = Runnable {
        val j = runCatching { JSONObject(nowJson) }.getOrNull()
        if (!workingNow(j)) return@Runnable
        if (nowAt > stallPulse) return@Runnable // the wake worked; it breathes again
        noteTry(this, s("the render needed a reload", "el render necesitó recargar"))
        wantReload = true
        ghostWake()
    }
    private val stallRung1 = Runnable {
        val j = runCatching { JSONObject(nowJson) }.getOrNull()
        if (!workingNow(j)) return@Runnable
        if (nowAt > stallPulse) { armStallWatch(); return@Runnable } // alive — keep watching
        noteTry(this, s("the render needed a visit", "el render necesitó una visita"))
        stallPulse = nowAt
        ghostWake()
        handler.postDelayed(stallRung2, 6000)
    }
    private fun workingNow(j: JSONObject?): Boolean =
        j?.optBoolean("busy") == true || (j?.optString("sub")?.startsWith("Preparing") == true)
    private fun armStallWatch() {
        handler.removeCallbacks(stallRung1)
        stallPulse = nowAt
        handler.postDelayed(stallRung1, 8000)
    }
    private fun disarmStallWatch() {
        handler.removeCallbacks(stallRung1)
        handler.removeCallbacks(stallRung2)
    }

    /** A panel transport key: hand it to the page — or, when Android has
     *  retired the activity behind the service (the keys go silent), remember
     *  the press and bring Logos forward so the page collects it as it wakes. */
    // The poke watch's generation (T2-11): every live poke bumps
    // it. It owns only the WAKE now (R2-T2-3): the newest press's
    // watch speaks for the burst, but every watch keeps its own
    // store duty — a generation mismatch no longer retires a press.
    private var pokeWatchSeq = 0

    private fun pokeOrWake(cmd: String, force: Boolean = false) {
        if (cmd == "pause") nativeGen++ // a definite stop ends the delivery chain (1.4.125)
        // A definite play/pause through this door is the tap-time
        // truth until the page's push confirms it (M-6).
        if (cmd == "play") noteCommanded(true) else if (cmd == "pause") noteCommanded(false)
        if (NativeSpeaker.active) { NativeSpeaker.handle(cmd); return }
        val p = poke
        if (p != null && !force) {
            p(cmd)
            // Every key gets the toggle's liveness discipline
            // (T2-11): a non-null poke used to be treated as proof
            // of life for every key except the toggle, but poke is
            // nulled only when the activity dies with the bubble
            // off — a HUNG renderer (activity alive, pushes stopped,
            // evaluateJavascript speaking into nothing) leaves it
            // non-null forever, and prev, next, the jumps, slower,
            // faster, mark, save and voice were all fired into the
            // corpse with no store, no wake, no receipt. Now the
            // poke is watched: if the page pushes no new state
            // within the same 1.2-second window the toggle's first
            // rung uses, the press is treated as never delivered —
            // it is STORED (never fired twice into the corpse) and
            // the page is woken to collect it, exactly as the
            // toggle's escalation already fell back to store + wake.
            val myWatch = ++pokeWatchSeq
            val pokedAt = nowAt
            val incarnationAtPoke = pageIncarnation
            handler.postDelayed({
                if (NativeSpeaker.active) return@postDelayed
                // Receipt is judged by incarnation (R4-T2-2): a
                // push counts only if it landed while the poked
                // page was still the page — the latch remembers the
                // hearing even when a house reload has since
                // replaced that page. The epoch verdict this
                // replaces (R3-T2-1) sampled only at verdict time —
                // generation unchanged AND a push landed — so a
                // press the poked page genuinely heard, answered
                // and acted on was stored anyway whenever a reload
                // completed inside the window, and the fresh page
                // collected it and executed it a SECOND time: a
                // jump leapt twice, a rate stepped twice, a mark
                // landed twice. The counterfeit R3-T2-1 killed stays
                // dead: a NEW page's pushes record under the new
                // incarnation from its load's first breath, so a
                // restore push can never satisfy this watch — only
                // the poked page's own answer can. On silence from
                // the poked incarnation the watch falls through:
                // the press is stored below, and the wake brings a
                // page that collects it through the Bridge,
                // stamp-checked.
                if (pushedUnder(incarnationAtPoke, pokedAt)) return@postDelayed // the poked page pushed after my poke: it heard
                // My poke went unheard, and my press is owed to the
                // store even if a newer press has taken over the
                // watch (R2-T2-3): the supersede check used to retire
                // the whole watch at this door — no store, no wake,
                // no receipt — so a burst of presses against a hung
                // renderer (he taps again, as a dead panel invites)
                // stored only the LAST press, and the rest, poked
                // into the corpse, evaporated. Now every watch whose
                // poke went unheard hands its own press to the store;
                // the watches fire in the order they were armed, so
                // the queue receives the burst in the order he made
                // it (T2-14's law), and only the newest watch owns
                // the wake and its receipt — one visit per burst,
                // every press replayed.
                storePendingCmd(cmd)
                if (myWatch != pokeWatchSeq) return@postDelayed // a newer press owns the wake now
                noteTry(this, s("panel key visited Logos", "la tecla del panel visitó Logos"))
                ghostWake()
            }, 1200)
            return
        }
        storePendingCmd(cmd)
        noteTry(this, s("panel key visited Logos", "la tecla del panel visitó Logos"))
        ghostWake()
    }

    private var seekWatchSeq = 0

    /** The seek door (T2-11 completion): the seek bar and the sentence
     *  scrub used to fire a bare poke — no watch, no wake — so against
     *  a hung renderer the fraction sat in seekFrac until the pull-time
     *  expiry discarded it, unheard. The fraction is already the stored
     *  copy (stamped with its session, expiring at its pull door —
     *  T2-13/T2-19); what the seek lacked is the keys' liveness
     *  discipline: poke, watch for a push, and on silence wake the
     *  page so it comes and pulls the fraction itself.
     *
     *  The watch's receipt is the poked page's OWN push (R4-T2-3):
     *  the pulse alone used to satisfy it, so a reload completing
     *  inside the window answered the watch with the new page's
     *  restore push — while the poke itself had died with the old
     *  context, and the fresh page pulls bubbleSeek only inside its
     *  seek listener, which never fired: one scrub, silently lost.
     *  Now a reload inside the window earns a re-poke into the NEW
     *  page, whose listener pulls the fraction and lands it under
     *  the Bridge's own stamp audits. */
    private fun pokeSeekOrWake() {
        if (poke == null) { ghostWake(); return }
        poke?.invoke("seek")
        val myWatch = ++seekWatchSeq
        val pokedAt = nowAt
        val incarnationAtPoke = pageIncarnation
        handler.postDelayed({
            if (myWatch != seekWatchSeq) return@postDelayed // a newer seek owns the watch now
            if (NativeSpeaker.active) return@postDelayed
            if (pushedUnder(incarnationAtPoke, pokedAt)) return@postDelayed // the poked page pushed after my poke: it heard
            if (pageIncarnation != incarnationAtPoke) {
                // A new page answered — a restore push, not a
                // hearing: the poke died with the old context.
                // Poke the NEW page: its seek listener pulls the
                // fraction, judged there by the Bridge's stamp
                // audits (T2-13/T2-19). One re-poke; if this page
                // dies too, the fraction dies at its pull door with
                // its receipt — never swallowed in silence.
                poke?.invoke("seek")
                return@postDelayed
            }
            noteTry(this, s("panel seek visited Logos", "la búsqueda del panel visitó Logos"))
            ghostWake()
        }, 1200)
    }

    /** Bring Logos forward WITHOUT taking Oscar anywhere (1.4.88): the
     *  activity resumes as a ghost — transparent, touch-through — only
     *  until the page breathes again, then leaves on its own. The bubble
     *  is a shortcut; a rescue that lands him inside the app is no rescue. */
    private fun ghostWake(force: Boolean = false) {
        if (!force && backstageServe(this)) { noteTry(this, s("served backstage, no visit", "atendido tras bastidores, sin visita")); return }
        runCatching { startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK).putExtra("logos.ghost", true), android.app.ActivityOptions.makeCustomAnimation(this, 0, 0).toBundle()) }
    }

    private fun wakeBubble(schedule: Boolean = true) {
        val b = bubble ?: return
        if (b.alpha < awakeAlpha()) b.animate().alpha(awakeAlpha()).setDuration(140).start()
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    // One bubble size on phones, a little more on tablets (Oscar: 'un
    // poquito, un poquito más' — a little, only a little).
    private fun isTablet() = resources.configuration.smallestScreenWidthDp >= 600
    /** Channel-wise blend of two colours: f of the way from a to b. */
    private fun mixCol(a: Int, b: Int, f: Float): Int {
        fun ch(x: Int, y: Int) = (x + ((y - x) * f)).toInt().coerceIn(0, 255)
        return android.graphics.Color.argb(
            ch(android.graphics.Color.alpha(a), android.graphics.Color.alpha(b)),
            ch(android.graphics.Color.red(a), android.graphics.Color.red(b)),
            ch(android.graphics.Color.green(a), android.graphics.Color.green(b)),
            ch(android.graphics.Color.blue(a), android.graphics.Color.blue(b))
        )
    }
    private fun sizeFactor() = when (lookSize(this)) { "s" -> 0.85f; "l" -> 1.18f; else -> 1f }
    private fun bubbleSize() = ((if (isTablet()) dp(76) else dp(58)) * sizeFactor()).toInt()
    private fun bubbleFace() = ((if (isTablet()) dp(60) else dp(46)) * sizeFactor()).toInt()
    private fun bubbleHalo() = ((if (isTablet()) dp(66) else dp(52)) * sizeFactor()).toInt()
    // The window is wider than the bubble (1.4.234): the shadow is
    // DRAWN, and a drawn shadow needs room to fall and fade inside
    // its own window. While the window was the bubble's own size,
    // the face's elevation shadow ran past it and the window's
    // square bounds clipped it — the cut showed against light
    // walls («se ve el cuadrado de la sombra… no se ve terminado
    // o premium», Oscar, 2026-11-22).
    // WHILE THE PANEL STANDS, the window wears the visual size
    // (1.4.238): the re-raised bubble window lies OVER the panel's
    // corner (1.4.227), and its 14dp of breathing room reached
    // ~16dp into that corner's touch territory — the taps aimed at
    // the controls seated there (the queue sheet's lever, the
    // title row's lock) landed on the bubble instead, and the tap
    // shut the panel: «la toco y simplemente me saca de la lista»
    // (Oscar, 2026-11-22). At the visual size the window's bounds
    // end where the jewel ends, as they did before 234; the shadow
    // hugs the jewel for the panel's stay, and collapsePanel
    // restores the room the moment the panel closes.
    private fun bubbleWindow() = if (panel != null) bubbleSize() else bubbleSize() + dp(28)
    private fun bubbleShadow() = bubbleFace() + if (panel != null) dp(6) else dp(18)

    /** The look's alphas (1.4.157): the bubble wears the opacity
     *  Oscar set — at rest, at work, always (1.4.224: the automatic
     *  idle whisper that used to multiply it down to 15%/45% is
     *  retired; a second amount he never set contradicted the one
     *  he did — «sin datos contradictorios»). The one other hand on
     *  it is his own order of 1.4.197: while the panel stands open,
     *  the bubble wears the PANEL's set opacity. */
    private fun awakeAlpha() = lookBa(this)
    private fun panelAlpha() = lookPa(this)

    /** Repaint the floating window with the look as it now stands:
     *  sizes relaid out in place, alphas set, the fade re-armed. */
    private fun applyLook() {
        handler.post {
            val b = bubble
            if (b != null) {
                val bp = bubbleParams
                if (bp != null) {
                    bp.width = bubbleWindow(); bp.height = bubbleWindow()
                    runCatching { wm?.updateViewLayout(b, bp) }
                }
                halo?.layoutParams = FrameLayout.LayoutParams(bubbleHalo(), bubbleHalo(), Gravity.CENTER)
                bubbleShadowV?.layoutParams = FrameLayout.LayoutParams(bubbleShadow(), bubbleShadow(), Gravity.CENTER)
                bubbleRingV?.layoutParams = FrameLayout.LayoutParams(bubbleSize(), bubbleSize(), Gravity.CENTER)
                repaintFace()
                bubbleFaceV?.layoutParams = FrameLayout.LayoutParams(bubbleFace(), bubbleFace(), Gravity.CENTER)
                bubbleLambdaV?.invalidate()
                b.animate().cancel(); b.alpha = if (panel != null) panelAlpha() else awakeAlpha()
            }
            panel?.let { it.alpha = panelAlpha() }
        }
    }
    private fun bubbleHalf() = bubbleWindow() / 2
    // The panel's width: the words (1.4.102) earn the tablet a wider window.
    private fun panelWidth(): Int {
        val base = if (wordsOn && isTablet()) dp(360) else dp(302)
        if (!wordsOn) return base
        val sw2 = resources.displayMetrics.widthPixels
        return (base * curScaleW()).toInt().coerceIn(dp(240), (sw2 - dp(20)).coerceAtLeast(dp(240)))
    }

    /** The transport row fits the panel it lives in (1.4.113, Oscar:
     *  'No quiero botones cortados'). The five keys were born at a fixed
     *  262 dp — an exact fit only for the default 302 dp panel — while
     *  the reader can be dragged down to 240 dp, so at Oscar's own scale
     *  the − and + keys hung off both edges, cropped in half. Now the
     *  row is seated from the panel's real inner width: first the gaps
     *  give (10 → 6 → 4 dp), then the keys themselves scale together,
     *  the toggle always the largest. Nothing is ever cropped. */
    private fun fitControls() {
        val tog = toggleB ?: return
        val inner = panelWidth() - dp(36) // the card's own side padding
        // Proportions (1.4.179, Oscar): the jump keys shrink toward
        // their proper rank under the toggle — 34 / 42 / 54 / 42 / 34
        // (they were 38 / 46 / 54 / 46 / 38, the jumps nearly the
        // toggle's peers). The row stays symmetric, so the toggle
        // keeps the exact center fitControls always gave it.
        // (1.4.205: the queue shape keeps the SAME five numbers —
        // the jumps take the 34 seats at the ends, the track keys
        // the 42 seats beside the toggle — so the row's footprint
        // never changes when the line arrives or leaves.)
        val design = dp(34 + 42 + 54 + 42 + 34)
        var gap = dp(10)
        var avail = inner - gap * 4
        if (avail < design) { gap = dp(6); avail = inner - gap * 4 }
        if (avail < design) { gap = dp(4); avail = inner - gap * 4 }
        val k = if (avail >= design) 1f else (avail.toFloat() / design).coerceAtLeast(0.7f)
        fun seat(v: View?, designDp: Int, last: Boolean) {
            val view = v ?: return
            val lp = view.layoutParams as? LinearLayout.LayoutParams ?: return
            val s = (dp(designDp) * k).toInt()
            lp.width = s; lp.height = s; lp.marginEnd = if (last) 0 else gap
            view.layoutParams = lp
        }
        if (transportQueueMode) {
            seat(ctlPrev, 34, false); seat(ctlTrackPrev, 42, false); seat(tog, 54, false); seat(ctlTrackNext, 42, false); seat(ctlNext, 34, true)
        } else {
            seat(ctlSlow, 34, false); seat(ctlPrev, 42, false); seat(tog, 54, false); seat(ctlNext, 42, false); seat(ctlFast, 34, true)
        }
    }

    /** The transport's two shapes (Oscar, 1.4.205): as it stands, and —
     *  while a copy queue stands — the queue shape, where the time
     *  jumps move OUT to the speed keys' seats at the speed keys'
     *  size, the inner seats go to previous/next AUDIO (the line is
     *  a playlist, travelled like songs), and the −/+ keys leave the
     *  row (the rate lives on the sentence counter's tap instead).
     *  Nothing is destroyed: when the line empties, the row rebuilds
     *  itself exactly as it was. Sizing stays fitControls' deed. */
    private fun arrangeTransport(force: Boolean = false) {
        val q = panelQueueCount > 0
        if (panel == null && !force) { transportQueueMode = q; return }
        val row = controlsV ?: return
        val tog = toggleB ?: return
        if (!force && q == transportQueueMode) return
        transportQueueMode = q
        row.removeAllViews()
        if (q) {
            ctlPrev?.let { row.addView(it) }
            ctlTrackPrev?.let { row.addView(it) }
            row.addView(tog)
            ctlTrackNext?.let { row.addView(it) }
            ctlNext?.let { row.addView(it) }
        } else {
            ctlSlow?.let { row.addView(it) }
            ctlPrev?.let { row.addView(it) }
            row.addView(tog)
            ctlNext?.let { row.addView(it) }
            ctlFast?.let { row.addView(it) }
        }
        fitControls()
    }

    // THE STRETCHABLE READER (1.4.105, Oscar: 'redimensionar el tamaño del
    // lector'): drag the panel's free corner and the words window grows —
    // more sentences in view, letters growing with the window — while the
    // corner that grazes the bubble never moves. The size is remembered
    // per device kind (phone / tablet), like the bubble's own spot.
    // A WINDOW, IN BOTH DIRECTIONS (1.4.106, Oscar: 'redimensionarlo en
    // ambas direcciones'): width and height are independent axes — pull
    // sideways and the reader widens without growing tall, pull up or
    // down and it grows tall without widening, diagonally for both. The
    // letters follow the average of the two. The 1.4.105 single size
    // seeds both axes the first time.
    private var panelScaleW = -1f
    private var panelScaleH = -1f
    private fun scaleKeyW() = if (isTablet()) "rscaleWTab" else "rscaleWPhone"
    private fun scaleKeyH() = if (isTablet()) "rscaleHTab" else "rscaleHPhone"
    private fun savedScale(key: String): Float {
        val pr = prefs(this)
        if (pr.contains(key)) return pr.getFloat(key, 1f)
        return pr.getFloat(if (isTablet()) "rscaleTab" else "rscalePhone", 1f)
    }
    private fun curScaleW(): Float = if (panelScaleW > 0) panelScaleW else savedScale(scaleKeyW())
    private fun curScaleH(): Float = if (panelScaleH > 0) panelScaleH else savedScale(scaleKeyH())
    private fun wordsHeight() = ((if (isTablet()) dp(106) else dp(60)) * curScaleH()).toInt()
    private fun wordsTextSize() = (if (isTablet()) 15.5f else 14f) * (0.7f + 0.3f * (curScaleW() + curScaleH()) / 2f)

    private fun applyReaderScale(final: Boolean) {
        val p = panelParams ?: return
        p.width = panelWidth()
        fitControls()
        wordsV?.let { wv ->
            val lp = wv.layoutParams as? LinearLayout.LayoutParams
            if (lp != null && lp.height != wordsHeight()) { lp.height = wordsHeight(); wv.layoutParams = lp }
            wv.textSize = wordsTextSize()
        }
        panel?.let { st ->
            runCatching { wm?.updateViewLayout(st, p) }
            st.post { positionPanel() }
        }
        if (final) {
            prefs(this).edit().putFloat(scaleKeyW(), curScaleW()).putFloat(scaleKeyH(), curScaleH()).apply()
            lastWordsKey = ""; lastWi = -2
            refreshPanel()
        }
    }

    override fun onBind(i: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel("bubble", "Floating bubble", NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) })
        onNow = {
            updateBubbleRing()
            refreshPanel()
            // The shade card follows the stage's owner too (T2-20):
            // every page push tells PlaybackService whether a
            // recording or a reading holds the stage, so its card
            // can stop wearing a book's face over a recording.
            PlaybackService.noteBubblePush(nowJson)
        }
        lookHook = { applyLook() }
        onDelivery = { armDeliveryWatch(); armNativeFallback() }
        NativeSpeaker.listener = {
            refreshPanel()
            // The page half of H-12 (WR-1): every native transition
            // also pokes the page, bare — no payload, house style,
            // exactly as notePagePaused() pokes "pause". The page
            // pulls the position through bubbleNativePos() (the
            // poke+pull pattern of bubbleSeek / bubblePendingCmd).
            // refreshPanel runs first, unchanged; the poke is
            // wrapped so a dead page door can never break the panel
            // or the speaker's own notify chain.
            runCatching { poke?.invoke("nativepos") }
        }
        inviteHook = { invite(3) }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(2, note(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        if (intent?.action == "hide") { stopBubble(); return START_NOT_STICKY }
        if (!Settings.canDrawOverlays(this)) { stopSelf(); return START_NOT_STICKY }
        if (bubble == null) showBubble()
        running = true
        // The pre-warm visit belongs to starts HIS hand asked for
        // (1.4.125): a sticky system restart after the process died —
        // overnight hibernation, Samsung's reaper — passes a null
        // intent, and a visit summoned by nobody is how the app
        // "asked to appear again" while he was doing something else.
        if (intent != null && poke == null && !Backstage.active && System.currentTimeMillis() - lastPrewarm > 60_000) {
            lastPrewarm = System.currentTimeMillis()
            ghostWake()
        }
        return START_STICKY
    }

    private fun note(): Notification {
        val open = PendingIntent.getActivity(this, 21, Intent(this, MainActivity::class.java).setAction(Intent.ACTION_MAIN).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)
        val hide = PendingIntent.getService(this, 22, Intent(this, BubbleService::class.java).setAction("hide"), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        return Notification.Builder(this, "bubble")
            .setSmallIcon(R.drawable.ic_note)
            .setColor(Color.rgb(23, 19, 16))
            .setContentTitle(s("Logos bubble", "Burbuja de Logos"))
            .setContentText(s("Floating over your apps · tap the λ to listen", "Flotando sobre tus apps · toca la λ para escuchar"))
            .setContentIntent(open)
            .setOngoing(true)
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .addAction(Notification.Action.Builder(null, s("Hide bubble", "Ocultar burbuja"), hide).build())
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

    /** The bubble face's paint per theme family (1.4.165): top tone,
     *  deep tone, ring + λ colour. Legacy keeps its charcoal jewel. */
    private fun facePaint(): Triple<Int, Int, Int> = when (themeFam(this)) {
        "tron" -> Triple(Color.rgb(10, 42, 64), Color.rgb(2, 6, 12), Color.rgb(0, 229, 255))
        "cyberpunk" -> Triple(Color.rgb(43, 37, 27), Color.rgb(11, 10, 8), Color.rgb(252, 238, 10))
        else -> Triple(Color.rgb(58, 49, 35), Color.rgb(21, 17, 13), gold)
    }

    /** THE LOGO ITSELF, AS VECTORS (1.4.223, Oscar's order): the
     *  bubble's face no longer wears a stencil lifted from the
     *  raster artwork. Two stencil waves (219, 222) could not win:
     *  an alpha mask read from luminance reads the letter's
     *  SHADING as coverage — the leg the artwork lights up came
     *  out a slab and the shadowed leg a thread («una de sus
     *  piernas más gruesa… la otra demasiado delgada»). Oscar's
     *  ruling: the Splash already solved this — implement THAT
     *  logo in the bubble exactly as it stands there, waves and
     *  all. The paths below are transcribed 1:1 from public/
     *  logo.svg (the same vector the splash draws): the λ in two
     *  filled subpaths (the group's translate(−26,−6) folded into
     *  the numbers) and the two sound arcs as round-capped strokes
     *  (each SVG arc re-expressed as an arcTo on its true centre:
     *  r146 about (270.3,268), r190 about (281.4,268)). The 512
     *  canvas maps onto the face, so the composition keeps the
     *  icon's own proportions. The gold families (Legacy, and
     *  Light — the bubble's jewel is dark in both) wear the logo's
     *  own gold gradient (#fbe3b0 → #e9bd72 → #b9843a, the SVG's
     *  stops); Tron and Cyberpunk wear their accent flat — the
     *  GEOMETRY is the logo's in all of them. */
    private val logoLambdaPath = android.graphics.Path().apply {
        moveTo(124f, 118f)
        cubicTo(150f, 98f, 188f, 98f, 206f, 130f)
        lineTo(314f, 354f)
        cubicTo(322f, 371f, 332f, 378f, 348f, 374f)
        lineTo(354f, 390f)
        cubicTo(322f, 408f, 292f, 398f, 276f, 366f)
        lineTo(172f, 150f)
        cubicTo(162f, 130f, 146f, 124f, 130f, 132f)
        close()
        moveTo(212f, 226f)
        lineTo(230f, 260f)
        lineTo(160f, 392f)
        cubicTo(156f, 400f, 148f, 402f, 140f, 398f)
        lineTo(134f, 394f)
        cubicTo(130f, 390f, 130f, 384f, 134f, 378f)
        close()
    }
    private val logoArc1Path = android.graphics.Path().apply {
        moveTo(364f, 156f)
        arcTo(android.graphics.RectF(124.3f, 122f, 416.3f, 414f), -50.09f, 100.18f, false)
    }
    private val logoArc2Path = android.graphics.Path().apply {
        moveTo(398f, 118f)
        arcTo(android.graphics.RectF(91.4f, 78f, 471.4f, 458f), -52.13f, 104.26f, false)
    }

    /** The bubble's face (1.4.223): the logo drawn from its own
     *  vectors — see the paths above. The ring, the ground and the
     *  colours around it are untouched; only the letter changed —
     *  for the last time, because it is no longer an approximation. */
    private inner class LambdaView : View(this) {
        private val fillP = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
        private val arcP = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND
        }
        override fun onDraw(c: Canvas) {
            val fam = themeFam(this@BubbleService)
            val col = facePaint().third
            val grad = if (fam != "tron" && fam != "cyberpunk") android.graphics.LinearGradient(
                124f, 98f, 405f, 412f,
                intArrayOf(Color.rgb(251, 227, 176), Color.rgb(233, 189, 114), Color.rgb(185, 132, 58)),
                floatArrayOf(0f, 0.45f, 1f), android.graphics.Shader.TileMode.CLAMP
            ) else null
            c.save()
            c.translate(width / 2f, height / 2f)
            // 1.4.225 (Oscar): the composition at 92% — «al menos un
            // seis por ciento» smaller, so it centres in the sphere;
            // the geometry itself is untouched, by his word.
            c.scale(width * 0.92f / 512f, width * 0.92f / 512f)
            c.translate(-256f, -256f)
            fillP.shader = grad; if (grad == null) fillP.color = col
            c.drawPath(logoLambdaPath, fillP)
            arcP.shader = grad; if (grad == null) arcP.color = col
            arcP.strokeWidth = 7f; arcP.alpha = 140
            c.drawPath(logoArc1Path, arcP)
            arcP.strokeWidth = 5f; arcP.alpha = 71
            c.drawPath(logoArc2Path, arcP)
            c.restore()
        }
    }

    /** Repaint the living bubble in the current family (a theme
     *  change lands while it floats — Oscar sees it turn). */
    /** The bubble's own Ring (Oscar, 1.4.197): the reading's
     *  progress around the λ's face — the same instrument as the
     *  shade card's artwork, at bubble scale: a fine track, the
     *  theme's accent filling clockwise from the top, a bead at the
     *  frontier. Tron is the exception: the ring is the program's
     *  amber (#f5c20a), yellow not orange, and the λ stays
     *  cyan. It exists only while a session stands; with none,
     *  the bubble is exactly the jewel it always was. */
    private inner class RingView : View(this) {
        var frac = -1f
        private val track = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
        private val arcP = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND }
        private val bead = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
        private val beadHalo = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
        override fun onDraw(c: Canvas) {
            val f = frac
            if (f < 0f) return
            val fam = themeFam(this@BubbleService)
            val accent = if (fam == "tron") Color.rgb(245, 194, 10) else facePaint().third
            val dens = resources.displayMetrics.density
            val cx = width / 2f; val cy = height / 2f
            val r = bubbleFace() / 2f + 3f * dens
            track.color = accent; track.alpha = 48; track.strokeWidth = 2f * dens
            c.drawCircle(cx, cy, r, track)
            if (f > 0f) {
                arcP.color = accent; arcP.strokeWidth = 2.6f * dens
                c.drawArc(android.graphics.RectF(cx - r, cy - r, cx + r, cy + r), -90f, f * 360f, false, arcP)
                val a = Math.toRadians((-90f + f * 360f).toDouble())
                val bx = cx + (r * Math.cos(a)).toFloat(); val by = cy + (r * Math.sin(a)).toFloat()
                beadHalo.color = accent; beadHalo.alpha = 70
                c.drawCircle(bx, by, 4.4f * dens, beadHalo)
                bead.color = accent
                c.drawCircle(bx, by, 2.4f * dens, bead)
            }
        }
    }

    /** Feed the bubble's Ring from the standing push (1.4.197):
     *  the fraction the page publishes for the stage — a reading's
     *  sentence fraction, a recording's clock fraction. No active
     *  session, no ring. */
    private fun updateBubbleRing() {
        val v = bubbleRingV ?: return
        // The ring eats from the same table as the panel (1.4.226):
        // while the device voice speaks, the page's own session is
        // not the driver and its pushes stop feeding the ring — the
        // panel lived (it reads panelJson on this road) while the
        // ring starved and never showed at all. panelJson carries
        // the same seat fields (frac with word progress, ci, ct,
        // playing), so the ring takes its seat from there too.
        val native = NativeSpeaker.active
        val j: JSONObject
        if (native) {
            j = NativeSpeaker.panelJson()
        } else {
            val pj = runCatching { JSONObject(nowJson) }.getOrNull()
            if (pj?.optBoolean("active") != true) {
                if (v.visibility != View.INVISIBLE) v.visibility = View.INVISIBLE
                v.frac = -1f; ringSeatFrac = -1f; ringSeatAt = 0L; ringVel = 0f; ringCi = -1; ringCt = 0; ringPlayingNow = false
                return
            }
            j = pj
        }
        if (v.visibility != View.VISIBLE) v.visibility = View.VISIBLE
        val f = j.optDouble("frac", 0.0).toFloat().coerceIn(0f, 1f)
        val ci = j.optInt("ci", -1)
        ringCt = j.optInt("ct", 0)
        ringPlayingNow = j.optBoolean("playing")
        // THE RING RETIRES AT THE END (1.4.237, Oscar's principle):
        // «cuando el aro termina de llenarse porque el audio terminó
        // de reproducirse, desaparece… Como ya terminó, no es
        // necesario.» A complete ring resting on a finished reading
        // is a leftover, not information. The end carries honest
        // signals: the page's `fin` (its session's finished flag —
        // set only at a natural end, cleared by any seek or new
        // play), the device voice's `done`, or the seat itself
        // standing at the very end. A PAUSED reading carries none
        // of them and keeps its ring resting on its seat; the next
        // reading seats the ring afresh from the reset below.
        if (!ringPlayingNow && (j.optInt("fin", 0) == 1 || j.optBoolean("done") || f >= 0.999f)) {
            if (v.visibility != View.INVISIBLE) v.visibility = View.INVISIBLE
            v.frac = -1f; ringSeatFrac = -1f; ringSeatAt = 0L; ringVel = 0f; ringCi = -1; ringCt = 0
            return
        }
        val now = System.currentTimeMillis()
        // A seek (or a new text) re-seats the ring exactly; a step
        // forward teaches it its pace; anything else leaves the
        // extrapolation to carry the motion between seats.
        val seeked = ringSeatFrac >= 0f && (f < ringSeatFrac - 0.002f || (ringCi >= 0 && ci != ringCi && ci != ringCi + 1))
        when {
            seeked -> { ringSeatFrac = f; ringSeatAt = now; ringVel = 0f; v.frac = f; v.invalidate() }
            f > ringSeatFrac + 0.0004f -> {
                if (ringSeatAt > 0L && ringSeatFrac >= 0f) {
                    val inst = (f - ringSeatFrac) / (now - ringSeatAt).coerceAtLeast(1).toFloat()
                    ringVel = if (ringVel <= 0f) inst else ringVel * 0.6f + inst * 0.4f
                }
                ringSeatFrac = f; ringSeatAt = now
            }
            ringSeatFrac < 0f -> { ringSeatFrac = f; ringSeatAt = now; v.frac = f; v.invalidate() }
        }
        ringCi = ci
        if (!ringPlayingNow) {
            if (Math.abs(v.frac - ringSeatFrac) > 0.0004f) { v.frac = ringSeatFrac; v.invalidate() }
        } else if (!ringTicking) {
            ringTicking = true; handler.post(ringTick)
        }
    }

    private fun repaintFace() {
        val face = bubbleFaceV ?: return
        val (top, deep, ring) = facePaint()
        face.background = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            gradientType = GradientDrawable.RADIAL_GRADIENT
            gradientRadius = dp(30).toFloat()
            setGradientCenter(0.35f, 0.3f)
            colors = intArrayOf(top, deep)
            setStroke(dp(2), ring)
        }
        bubbleLambdaV?.invalidate()
        halo?.background = oval(ring, 0, 0, -1f).apply { alpha = 70 }
    }

    /** The bubble BREATHES (1.4.220, Oscar's yes): while the jewel
     *  floats idle — nothing playing, no ripple running — its halo
     *  swells and settles on a slow lung (3.4 s each way: alpha and
     *  a breath of scale), the living presence he imagined behind
     *  the system's player, on a surface that is ours to animate.
     *  The playing pulse (1.1 s) outranks it, the ripples borrow
     *  the halo and hand it back, and a system asking for no motion
     *  (animator scale 0) gets none. */
    private fun startBreath() {
        if (breathAnim != null || haloAnim != null) return
        if (rippleAnims.any { it.isRunning }) return
        val h = halo ?: return
        val scale = runCatching { Settings.Global.getFloat(contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) }.getOrDefault(1f)
        if (scale == 0f) return
        h.visibility = View.VISIBLE
        val al = ObjectAnimator.ofFloat(h, "alpha", 0.16f, 0.40f)
        val sx = ObjectAnimator.ofFloat(h, "scaleX", 1f, 1.13f)
        val sy = ObjectAnimator.ofFloat(h, "scaleY", 1f, 1.13f)
        listOf(al, sx, sy).forEach { it.repeatMode = ValueAnimator.REVERSE; it.repeatCount = ValueAnimator.INFINITE }
        breathAnim = android.animation.AnimatorSet().apply {
            playTogether(al, sx, sy)
            duration = 3400
            interpolator = android.view.animation.AccelerateDecelerateInterpolator()
            start()
        }
    }

    private fun stopBreath() {
        breathAnim?.cancel(); breathAnim = null
        halo?.let { it.scaleX = 1f; it.scaleY = 1f }
    }

    private fun showBubble() {
        val w = getSystemService(WindowManager::class.java)
        wm = w
        val size = bubbleWindow() // the window carries the drawn shadow's breathing room (1.4.234)
        val root = FrameLayout(this)
        val faceCols = facePaint()
        val haloV = View(this).apply {
            background = oval(faceCols.third, 0, 0, -1f).apply { alpha = 70 }
            layoutParams = FrameLayout.LayoutParams(bubbleHalo(), bubbleHalo(), Gravity.CENTER)
            visibility = View.INVISIBLE
        }
        // The shadow, drawn (1.4.234): a soft black oval that fades
        // to nothing well inside the window — no elevation, so no
        // square cut can ever show. It sits a breath below centre,
        // where a real shadow falls.
        val shadowV = View(this).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                gradientType = GradientDrawable.RADIAL_GRADIENT
                gradientRadius = bubbleShadow() / 2f
                colors = intArrayOf(Color.argb(105, 0, 0, 0), Color.argb(42, 0, 0, 0), Color.argb(0, 0, 0, 0))
            }
            layoutParams = FrameLayout.LayoutParams(bubbleShadow(), bubbleShadow(), Gravity.CENTER)
            translationY = dp(3).toFloat()
        }
        bubbleShadowV = shadowV
        val face = FrameLayout(this).apply {
            // A small jewel, not a coin (Oscar: smaller and prettier): a warm
            // radial sheen falling from the top-left, the gold ring, a soft shadow.
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                gradientType = GradientDrawable.RADIAL_GRADIENT
                gradientRadius = dp(30).toFloat()
                setGradientCenter(0.35f, 0.3f)
                colors = intArrayOf(faceCols.first, faceCols.second)
                setStroke(dp(2), faceCols.third)
            }
            // No elevation (1.4.234): its shadow was the one the
            // window clipped into a square. The drawn shadowV below
            // carries the depth now.
            layoutParams = FrameLayout.LayoutParams(bubbleFace(), bubbleFace(), Gravity.CENTER)
        }
        val lambda = LambdaView().apply {
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        }
        face.addView(lambda)
        bubbleFaceV = face
        bubbleLambdaV = lambda
        root.addView(haloV)
        root.addView(shadowV)
        root.addView(face)
        halo = haloV
        val ringV = RingView()
        ringV.layoutParams = FrameLayout.LayoutParams(bubbleSize(), bubbleSize(), Gravity.CENTER)
        ringV.visibility = View.INVISIBLE
        root.addView(ringV)
        bubbleRingV = ringV
        val p = WindowManager.LayoutParams(
            size, size, WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            val seat = cornerSeat(bubbleCorner())
            x = seat.first
            y = seat.second
        }
        bubbleParams = p
        attachDrag(root, p)
        runCatching { w.addView(root, p) }
        bubble = root
        root.alpha = 0f; root.scaleX = 0.5f; root.scaleY = 0.5f
        root.animate().alpha(awakeAlpha()).scaleX(1f).scaleY(1f).setDuration(240).setInterpolator(DecelerateInterpolator()).start()
        handler.postDelayed({ invite(2, force = true) }, 420)
    }

    private fun attachDrag(v: View, p: WindowManager.LayoutParams) {
        var downX = 0f; var downY = 0f; var startX = 0; var startY = 0; var moved = false
        var longHit = false
        val longRun = Runnable {
            if (!moved && panel == null) {
                longHit = true
                pokeOrWake("voice")
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
                    // THE SEPARATION (1.4.236, Oscar): the gates and
                    // the gesture are two different intentions, and
                    // only one may take the release. A gate takes it
                    // only when the hand MEANT the gate — the bubble
                    // rested on it for a beat (400 ms of hover). A
                    // gesture that merely crosses a gate on its way
                    // somewhere (his left flick from the top-right
                    // corner, bound for the top-left, swept the
                    // Remove gate and removed the bubble by error)
                    // never arms it: the release falls through to
                    // the gesture/drag judge below.
                    val target = if (hoverTarget >= 0 && System.currentTimeMillis() - hoverSince >= 400) hoverTarget else -1
                    hideTargets()
                    when {
                        longHit -> { longHit = false }
                        !moved -> togglePanel()
                        target == 0 -> stopBubble()
                        target == 1 -> {
                            settleBubble(v, p)
                            runCatching { startActivity(Intent(this, MainActivity::class.java).setAction(Intent.ACTION_MAIN).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)) }
                        }
                        else -> {
                            // A short, quick swipe is read as a gesture
                            // (1.4.235) before the release point is
                            // judged: it names a direction, not a place.
                            val fdx = e.rawX - downX; val fdy = e.rawY - downY
                            val dist = Math.hypot(fdx.toDouble(), fdy.toDouble())
                            val dur = e.eventTime - e.downTime
                            val flick = if (dist >= dp(24) && dur in 1..400 && dist / dur >= 0.45) flickTarget(fdx, fdy, far = dist >= dp(130)) else null
                            if (flick != null) {
                                getSharedPreferences("bubble", MODE_PRIVATE).edit().putInt("corner", flick).apply()
                                seatBubbleInCorner(true)
                            } else settleBubble(v, p)
                        }
                    }
                    true
                }
                MotionEvent.ACTION_CANCEL -> { handler.removeCallbacks(longRun); hideTargets(); if (moved) settleBubble(v, p); true }
                else -> false
            }
        }
    }

    // --- The drag gates: two pills at the top of the screen while the bubble is held ---
    private class DragTarget(val view: View, val rect: Rect, val idle: GradientDrawable, val hot: GradientDrawable)

    private var dragTargets: List<DragTarget> = emptyList()
    private var hoverTarget = -1
    private var hoverSince = 0L

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
            target(0, "✕", ink, s("Remove", "Quitar"), Color.rgb(128, 36, 26), Color.rgb(214, 102, 82), Color.WHITE),
            target(1, "λ", gold, s("Open Logos", "Abrir Logos"), gold, gold, charcoal)
        )
        hoverTarget = -1
    }

    private fun updateHover(p: WindowManager.LayoutParams) {
        val cx = p.x + bubbleHalf(); val cy = p.y + bubbleHalf()
        val idx = dragTargets.indexOfFirst { it.rect.contains(cx, cy) }
        if (idx == hoverTarget) return
        hoverTarget = idx
        // The gate's clock (1.4.236): a gate is only ARMED once the
        // bubble has rested on it a beat — see the ACTION_UP judge.
        hoverSince = if (idx >= 0) System.currentTimeMillis() else 0L
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
        hoverSince = 0L
    }

    // THE CORNER IS ITS HOME (Oscar, 2026-11-22): the bubble always
    // rests in one of SIX predetermined places — the one his hand
    // last chose. Its memory NAMES the place, never fractions of a
    // screen measured another day: the seat is re-measured against
    // the real screen every time, so it cannot drift or land
    // "random". The mid-room rule (the panel unfolding below a
    // mid-screen bubble) is retired by his word — he introduced it
    // in 2026-11-10 and withdrew it as his own error. The four
    // corners came first (1.4.231); the two edge middles are his
    // order of 2026-11-22 (1.4.233): «serían seis lugares
    // predeterminados».
    // Seats: 0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right,
    // 4 middle-left, 5 middle-right. (The prefs key stays "corner" —
    // it is the same memory, widened.)
    private fun bubbleCorner(): Int {
        val prefs = getSharedPreferences("bubble", MODE_PRIVATE)
        if (prefs.contains("corner")) return prefs.getInt("corner", 3).coerceIn(0, 5)
        // First run of the law: the old fraction memory names its
        // nearest of the six places; no memory at all seats
        // bottom-right.
        val fx = prefs.getFloat("posFx", -1f); val fy = prefs.getFloat("posFy", -1f)
        val c = if (fx < 0f) 3 else when {
            fy < 0.25f -> (if (fx >= 0.5f) 1 else 0)
            fy > 0.75f -> 2 + (if (fx >= 0.5f) 1 else 0)
            else -> 4 + (if (fx >= 0.5f) 1 else 0)
        }
        prefs.edit().putInt("corner", c).apply()
        return c
    }

    private fun cornerSeat(corner: Int): Pair<Int, Int> {
        val sw2 = resources.displayMetrics.widthPixels
        val sh2 = resources.displayMetrics.heightPixels
        // The seat is computed for the bubble's visible span, as it
        // has been since 1.4.231 — then shifted by the shadow's
        // breathing room (1.4.234), so the jewel itself lands in
        // exactly the same place while its window reaches further.
        val bw = bubbleSize()
        val m = (bubbleWindow() - bw) / 2
        val x = if (corner % 2 == 1) sw2 - bw - dp(4) else dp(4)
        val y = when {
            corner >= 4 -> (sh2 - bw) / 2
            corner >= 2 -> sh2 - bw - dp(24)
            else -> dp(28)
        }
        return Pair(x - m, y - m)
    }

    private fun seatBubbleInCorner(animate: Boolean) {
        val bp = bubbleParams ?: return
        val bv = bubble ?: return
        val (tx, ty) = cornerSeat(bubbleCorner())
        if (bp.x == tx && bp.y == ty) { if (panel != null) positionPanel(); return }
        if (!animate) {
            bp.x = tx; bp.y = ty
            runCatching { wm?.updateViewLayout(bv, bp) }
            if (panel != null) positionPanel()
            return
        }
        val sx = bp.x; val sy = bp.y
        ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 220
            addUpdateListener {
                val f = it.animatedValue as Float
                bp.x = sx + ((tx - sx) * f).toInt(); bp.y = sy + ((ty - sy) * f).toInt()
                runCatching { wm?.updateViewLayout(bv, bp) }
                if (panel != null) positionPanel()
            }
            start()
        }
    }

    private fun placeFromMemory() {
        seatBubbleInCorner(false)
    }

    override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
        super.onConfigurationChanged(newConfig)
        placeFromMemory()
        handler.postDelayed({ placeFromMemory() }, 300)
    }

    private fun settleBubble(v: View, p: WindowManager.LayoutParams) {
        // The hand may carry the bubble anywhere; where it RESTS is
        // the nearest of the six predetermined places (Oscar,
        // 2026-11-22), and that place is what the bubble remembers.
        val hw = bubbleHalf()
        val cx = p.x + hw; val cy = p.y + hw
        var best = 3; var bestD = Long.MAX_VALUE
        for (s in 0..5) {
            val (sx, sy) = cornerSeat(s)
            val dx = (sx + hw - cx).toLong(); val dy = (sy + hw - cy).toLong()
            val dd = dx * dx + dy * dy
            if (dd < bestD) { bestD = dd; best = s }
        }
        getSharedPreferences("bubble", MODE_PRIVATE).edit().putInt("corner", best).apply()
        seatBubbleInCorner(true)
    }

    // THE GESTURE (1.4.235, Oscar, 2026-11-22): «Haz que la esfera
    // reconozca el tipo de gesto. Si hago un gesto hacia abajo…
    // se va a su posición más cerca.» A flick names a DIRECTION:
    // the sphere answers with a predetermined place that lies in
    // that direction from its current home. And it has a MEASURE
    // (1.4.236, his correction the same day): a SHORT gesture
    // stops at the NEAR place in that direction — down from a top
    // corner rests at the edge's middle — and a LONG gesture
    // travels to the FAR one — all the way to the bottom corner.
    // THE LINE DECIDES (1.4.240, his tuning the same afternoon:
    // «donde falta afinar todavía son los gestos diagonales que te
    // llevan a la mitad de la pantalla»): 236 judged every place
    // within ~45° of the gesture by projection alone, so a SHORT
    // diagonal from a top corner landed on the FAR top corner —
    // the nearest place along the line, though the diagonal does
    // not point at it; the place a 45° diagonal from a top corner
    // actually points at is the opposite edge's MIDDLE (it stands
    // ~3° off the line; the far corner ~21°; the near top corner
    // ~45°). Now the places ON the gesture's own line (within
    // ~23°) are judged first, by the measure as always — short
    // takes the nearest of them, long the farthest — and only
    // when no place stands on the line does the wider field
    // (~45°) answer, with its single best-aligned place (from the
    // left middle, a down-left diagonal still finds the bottom-
    // left corner, his original example). A gesture aimed where
    // no place lies wins nothing and the release is judged as a
    // plain drag.
    private fun flickTarget(dx: Float, dy: Float, far: Boolean): Int? {
        val len = Math.hypot(dx.toDouble(), dy.toDouble())
        if (len < 1.0) return null
        val ux = dx / len; val uy = dy / len
        val home = bubbleCorner()
        val (hx, hy) = cornerSeat(home)
        var lineBest: Int? = null
        var lineProj = if (far) Double.NEGATIVE_INFINITY else Double.POSITIVE_INFINITY
        var wideBest: Int? = null
        var wideDot = 0.0
        var wideProj = Double.POSITIVE_INFINITY
        for (s in 0..5) {
            if (s == home) continue
            val (sx, sy) = cornerSeat(s)
            val vx = (sx - hx).toDouble(); val vy = (sy - hy).toDouble()
            val vl = Math.hypot(vx, vy); if (vl < 1.0) continue
            val dot = ux * (vx / vl) + uy * (vy / vl)
            if (dot < 0.70) continue
            val proj = vx * ux + vy * uy
            if (dot >= 0.92 && (if (far) proj > lineProj else proj < lineProj)) { lineProj = proj; lineBest = s }
            if (wideBest == null || dot > wideDot || (dot == wideDot && proj < wideProj)) { wideDot = dot; wideProj = proj; wideBest = s }
        }
        return lineBest ?: wideBest
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
    /** The theme family the panel dresses in (1.4.165). */
    private var panelFam = "dark"
    private var wordsV: TextView? = null
    private var gripV: View? = null
    private var gripFreeR = true
    private var gripFreeB = true
    private var wordsOn = true
    private var lastWordsKey = ""
    private var lastWi = -2
    private var wordsScrollAnim: ObjectAnimator? = null
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
    // Tron (1.4.165): the fleet's tokens carried to the panel — cyan
    // is the light and the accent seat, ice text, deep blue-black.
    private val tronPal = mapOf(
        "bg1" to Color.rgb(6, 18, 32), "bg2" to Color.rgb(2, 6, 12),
        "line" to Color.rgb(0, 110, 135), "ink" to Color.rgb(230, 250, 255),
        "muted" to Color.rgb(143, 182, 200), "disc" to Color.rgb(8, 26, 42),
        "discLine" to Color.rgb(0, 90, 112), "gold" to Color.rgb(0, 229, 255),
        "glow" to Color.argb(64, 0, 229, 255), "div" to Color.rgb(10, 30, 48)
    )
    // Cyberpunk (1.4.165): signal yellow print on warm black — the
    // accent seat carries the yellow; everything else stays warm.
    private val cyberPal = mapOf(
        "bg1" to Color.rgb(22, 19, 16), "bg2" to Color.rgb(11, 10, 8),
        "line" to Color.rgb(58, 51, 42), "ink" to Color.rgb(242, 238, 227),
        "muted" to Color.rgb(172, 162, 148), "disc" to Color.rgb(32, 27, 22),
        "discLine" to Color.rgb(70, 62, 50), "gold" to Color.rgb(252, 238, 10),
        "glow" to Color.argb(56, 252, 238, 10), "div" to Color.rgb(40, 35, 29)
    )
    private fun pal(): Map<String, Int> = when (panelFam) {
        "tron" -> tronPal
        "cyberpunk" -> cyberPal
        else -> if (panelLight) lightPal else darkPal
    }
    /** The explainer cards step ONE tone away from the player (Oscar, refined):
     *  a warm charcoal — a dark gray that never nears pure black — on the dark
     *  player, a deeper parchment on the light one. The full pole-swap was too
     *  stark; the player's own tone was invisible. Never Android gray.
     *  (1.4.205, Oscar's verdict on his phone: the dark step was still
     *  «demasiado blanco» — the same Vela diagnosis. The dark face now
     *  sits a WHISPER above the panel itself, and the separation is
     *  carried by the rim and the edge stack, never by luminance.) */
    private fun cardPal(): Map<String, Int> = when (panelFam) {
        "tron" -> mapOf(
            "bg1" to Color.rgb(12, 40, 62), "bg2" to Color.rgb(7, 24, 40),
            "line" to Color.rgb(0, 140, 170), "ink" to Color.rgb(230, 250, 255),
            "muted" to Color.rgb(178, 216, 230), "disc" to Color.rgb(16, 48, 72),
            "discLine" to Color.rgb(0, 110, 140), "gold" to Color.rgb(0, 229, 255),
            "glow" to Color.argb(64, 0, 229, 255), "div" to Color.rgb(20, 56, 82)
        )
        "cyberpunk" -> mapOf(
            "bg1" to Color.rgb(44, 39, 32), "bg2" to Color.rgb(34, 30, 25),
            "line" to Color.rgb(96, 86, 70), "ink" to Color.rgb(244, 240, 230),
            "muted" to Color.rgb(216, 208, 192), "disc" to Color.rgb(56, 50, 42),
            "discLine" to Color.rgb(96, 86, 68), "gold" to Color.rgb(252, 238, 10),
            "glow" to Color.argb(56, 252, 238, 10), "div" to Color.rgb(66, 59, 50)
        )
        else -> if (panelLight) mapOf(
        "bg1" to Color.rgb(238, 227, 199), "bg2" to Color.rgb(226, 210, 172),
        "line" to Color.rgb(178, 152, 100), "ink" to Color.rgb(34, 28, 18),
        "muted" to Color.rgb(84, 72, 50), "disc" to Color.rgb(255, 255, 255),
        "discLine" to Color.rgb(200, 180, 140), "gold" to Color.rgb(154, 102, 20),
        "glow" to Color.argb(46, 233, 189, 114), "div" to Color.rgb(200, 184, 148)
    ) else mapOf(
        "bg1" to Color.rgb(44, 38, 30), "bg2" to Color.rgb(30, 26, 21),
        "line" to Color.rgb(158, 132, 84), "ink" to Color.rgb(246, 240, 228),
        "muted" to Color.rgb(226, 216, 196), "disc" to Color.rgb(52, 45, 36),
        "discLine" to Color.rgb(86, 74, 58), "gold" to gold,
        "glow" to Color.argb(64, 233, 189, 114), "div" to Color.rgb(58, 50, 40)
    )
    }

    private fun openPanel() {
        val w = wm ?: return
        // The bubble stands in its corner before the panel is born,
        // so the panel's seat is judged from the corner, always.
        seatBubbleInCorner(false)
        panelLight = runCatching { JSONObject(nowJson).optBoolean("light") }.getOrDefault(false)
        panelFam = runCatching { JSONObject(nowJson).optString("fam", "") }.getOrDefault("").ifEmpty { themeFam(this) }
        wordsOn = runCatching { JSONObject(nowJson).optBoolean("words", true) }.getOrDefault(true)
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
            // 1.4.201 (Oscar's law): no ellipses — the title shrinks
            // its type until it stands COMPLETE on its line instead
            // of arriving cut with dots ("Sobre Escu…").
            maxLines = 1
            setAutoSizeTextTypeUniformWithConfiguration(11, 17, 1, android.util.TypedValue.COMPLEX_UNIT_SP)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        subV = TextView(this).apply {
            setTextColor(c["muted"]!!); textSize = 12f
            // 1.4.216 (Oscar's pick, «Cerca»): the counter hugs its own
            // words — no weight — so the drum stands right after it
            // instead of exiled at the line's far end.
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        }
        // The speed drum (1.4.207): born hidden beside the counter;
        // refreshPanel seats it whenever the counter's writing
        // carries a rate to roll, in either shape (1.4.242).
        rateV = TextView(this).apply {
            setTextColor(c["gold"]!!); textSize = 12f
            setTypeface(typeface, Typeface.BOLD)
            gravity = Gravity.CENTER
            visibility = View.GONE
            contentDescription = s("Speed — drag up or down to roll it", "Velocidad — arrastra arriba o abajo para rodarla")
            setPadding(dp(10), dp(5), dp(2), dp(5))
            // «Cerca» (1.4.216): the margin plus the drum's own left
            // padding seat the rate ~14dp after the counter's last
            // digit — close, with air, so the numbers never blur.
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { marginStart = dp(4) }
            setOnTouchListener { v, e -> judgeWheelTouch(v, e) }
        }
        val subRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        subRow.addView(subV)
        subRow.addView(rateV)
        val titleRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        titleRow.addView(titleV)
        // 1.4.212 (Oscar): the mark key wears the app's own face — the
        // bookmark from Listen — drawn on the grid, not the ⚑ glyph:
        // one button, one face, on both surfaces.
        val markB = glyphDiscKey("Mark this moment", c["disc"]!!, c["discLine"]!!, { cv, cx, cy, u ->
            val p = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
                color = c["gold"]!!; style = android.graphics.Paint.Style.STROKE
                strokeWidth = dp(3) / 2f; strokeCap = android.graphics.Paint.Cap.ROUND; strokeJoin = android.graphics.Paint.Join.ROUND
            }
            fun px(x: Float) = cx + (x - 12f) * u
            fun py(y: Float) = cy + (y - 12f) * u
            val path = android.graphics.Path()
            path.moveTo(px(17f), py(3f))
            path.quadTo(px(19f), py(3f), px(19f), py(5f))
            path.lineTo(px(19f), py(20.2f))
            path.lineTo(px(12f), py(17f))
            path.lineTo(px(5f), py(20.2f))
            path.lineTo(px(5f), py(5f))
            path.quadTo(px(5f), py(3f), px(7f), py(3f))
            path.close()
            cv.drawPath(path, p)
        }) { showMarkHint() }
        markB.layoutParams = LinearLayout.LayoutParams(dp(24), dp(24)).apply { marginStart = dp(6) }
        titleRow.addView(markB)
        // The save key (Oscar's scenario): a copied text is playing temporarily
        // and the wish strikes — one tap turns the temporary into a permanent
        // Library resident. It sits by the title, where the text is named.
        // 1.4.212 (Oscar): the save key wears the design he chose for
        // Save everywhere — the book that receives, an arrow entering
        // a book — drawn on the grid, replacing the bare "+".
        val saveB = glyphDiscKey(s("Save this text to the Library", "Guardar este texto en la Biblioteca"), c["disc"]!!, c["discLine"]!!, { cv, cx, cy, u ->
            val p = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
                color = c["gold"]!!; style = android.graphics.Paint.Style.STROKE
                strokeWidth = dp(3) / 2f; strokeCap = android.graphics.Paint.Cap.ROUND; strokeJoin = android.graphics.Paint.Join.ROUND
            }
            fun px(x: Float) = cx + (x - 12f) * u
            fun py(y: Float) = cy + (y - 12f) * u
            val path = android.graphics.Path()
            path.moveTo(px(4f), py(19.5f))
            path.lineTo(px(4f), py(4.5f))
            path.quadTo(px(4f), py(2f), px(6.5f), py(2f))
            path.lineTo(px(19f), py(2f))
            path.quadTo(px(20f), py(2f), px(20f), py(3f))
            path.lineTo(px(20f), py(21f))
            path.quadTo(px(20f), py(22f), px(19f), py(22f))
            path.lineTo(px(6.5f), py(22f))
            path.lineTo(px(6.5f), py(17f))
            path.lineTo(px(20f), py(17f))
            cv.drawPath(path, p)
            val arrow = android.graphics.Path()
            arrow.moveTo(px(12f), py(7f)); arrow.lineTo(px(12f), py(13f))
            arrow.moveTo(px(9f), py(10f)); arrow.lineTo(px(12f), py(13f)); arrow.lineTo(px(15f), py(10f))
            cv.drawPath(arrow, p)
        }) {
            // With a copy queue standing, the save asks its
            // question first (1.4.198): this text, or the line?
            if (panelQueueCount > 0) { showQueueSaveCard(); return@glyphDiscKey }
            showHintCard(s("Save to Library", "Guardar en Biblioteca"), s("Save what's playing to your Library, to hear it again anytime.", "Guarda lo que suena en tu Biblioteca, para oírlo cuando quieras."), s("Save", "Guardar"), s("Not now", "Ahora no")) {
                val wasSaved = runCatching { JSONObject(nowJson).optBoolean("saved") }.getOrDefault(false)
                pokeOrWake("save")
                toastSavedWhenTrue(wasSaved)
            }
        }
        saveB.layoutParams = LinearLayout.LayoutParams(dp(24), dp(24)).apply { marginStart = dp(6) }
        titleRow.addView(saveB)
        // The stage lock: while it holds, a fresh copy cannot evict what's
        // playing — the audiobook keeps the stage (Oscar's scenario).
        // 1.4.216 (Oscar): the lock leaves the emoji behind and is
        // DRAWN like its neighbours — the Lucide lock in gold line on
        // the same disc, «por fin el mismo tema» — and drawn a touch
        // larger than them (its grid unit runs 1.07× — born 1.15× in
        // 216, and Oscar's phone judged that a shade too much: «un
        // poquito más pequeño, pero un poquito», 1.4.217), because
        // beside the bookmark and the book the emoji read small. The
        // shackle stands open while the stage is unlocked; a state
        // change repaints.
        val lockB = glyphDiscKey("Lock the stage", c["disc"]!!, c["discLine"]!!, { cv, cx, cy, u ->
            val p = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
                color = c["gold"]!!; style = android.graphics.Paint.Style.STROKE
                strokeWidth = dp(3) / 2f; strokeCap = android.graphics.Paint.Cap.ROUND; strokeJoin = android.graphics.Paint.Join.ROUND
            }
            val uu = u * 1.07f
            fun px(x: Float) = cx + (x - 12f) * uu
            fun py(y: Float) = cy + (y - 12f) * uu
            val locked = isLocked(this@BubbleService)
            val shackle = android.graphics.Path()
            shackle.moveTo(px(7f), py(11f))
            shackle.lineTo(px(7f), py(7f))
            if (locked) {
                shackle.arcTo(android.graphics.RectF(px(7f), py(2f), px(17f), py(12f)), 180f, 180f)
                shackle.lineTo(px(17f), py(11f))
            } else {
                shackle.arcTo(android.graphics.RectF(px(7f), py(2f), px(17f), py(12f)), 180f, 140f)
            }
            cv.drawPath(shackle, p)
            cv.drawRoundRect(android.graphics.RectF(px(3f), py(11f), px(21f), py(22f)), 2f * uu, 2f * uu, p)
        }) { showLockHint() }
        lockB.layoutParams = LinearLayout.LayoutParams(dp(24), dp(24)).apply { marginStart = dp(6) }
        lockBtn = lockB
        titleRow.addView(lockB)
        card.addView(titleRow)
        card.addView(subRow)
        // THE WORDS (1.4.102): the panel reads along. A serif zone under the
        // status line — on the tablet, the sentence before and after ride
        // dimmed beside the one sounding; on the phone, the sounding
        // sentence alone. Hidden whenever there are no words to show.
        val wv = TextView(this).apply {
            setTextColor(c["ink"]!!)
            textSize = wordsTextSize()
            typeface = Typeface.SERIF
            setLineSpacing(0f, 1.3f)
            movementMethod = android.text.method.ScrollingMovementMethod.getInstance()
            isVerticalScrollBarEnabled = false
            setFadingEdgeLength(dp(16))
            setVerticalFadingEdgeEnabled(true)
            visibility = View.GONE
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, wordsHeight()).apply { topMargin = dp(10) }
        }
        wordsV = wv
        attachSentenceScrub(wv)
        card.addView(wv)
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
        controlsV = controls
        fun speedBtn(glyph: String, label: String, cmd: String): TextView = TextView(this).apply {
            text = glyph; textSize = 18f; gravity = Gravity.CENTER
            setTypeface(typeface, Typeface.BOLD)
            // Touch feedback (Oscar, 2026-11-10): the speed keys changed
            // the rate in silence — the tap landed nowhere his eye could
            // see. Now the key answers the finger: while pressed, the
            // disc warms toward gold, its ring turns gold and the glyph
            // lights; the whole key gives a little (0.9) and springs
            // back on release. The deed itself is untouched.
            fun disc(fill: Int, ringC: Int) = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(fill)
                setStroke(dp(1), ringC)
            }
            background = android.graphics.drawable.StateListDrawable().apply {
                addState(intArrayOf(android.R.attr.state_pressed), disc(mixCol(c["disc"]!!, c["gold"]!!, 0.28f), c["gold"]!!))
                addState(intArrayOf(), disc(c["disc"]!!, c["discLine"]!!))
            }
            setTextColor(android.content.res.ColorStateList(
                arrayOf(intArrayOf(android.R.attr.state_pressed), intArrayOf()),
                intArrayOf(c["gold"]!!, c["muted"]!!)
            ))
            setOnTouchListener { v, e ->
                when (e.action) {
                    MotionEvent.ACTION_DOWN -> v.animate().scaleX(0.9f).scaleY(0.9f).setDuration(90).start()
                    MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> v.animate().scaleX(1f).scaleY(1f).setDuration(150).setInterpolator(DecelerateInterpolator()).start()
                }
                false
            }
            contentDescription = label
            layoutParams = LinearLayout.LayoutParams(dp(34), dp(34)).apply { marginEnd = dp(10) }
            setOnClickListener { pokeOrWake(cmd); handler.postDelayed({ refreshPanel() }, 350) }
        }
        // The time-jump key (1.4.163, Oscar): a circular arrow wearing
        // its seconds, drawn on the disc — the double triangles retire
        // from the panel, because these keys no longer step a sentence:
        // they leap the seconds Settings names. The number is read
        // from the prefs at every draw, so a changed setting shows
        // itself the next time the panel opens. Same disc, same press
        // answer as the keys around it.
        fun jumpBtn(label: String, cmd: String, dir: Int): View {
            val v = object : View(this) {
                override fun onDraw(cv: android.graphics.Canvas) {
                    super.onDraw(cv)
                    val ink = if (isPressed) c["gold"]!! else c["ink"]!!
                    val p = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
                        color = ink; style = android.graphics.Paint.Style.STROKE
                        strokeWidth = dp(2).toFloat(); strokeCap = android.graphics.Paint.Cap.ROUND
                    }
                    val cx = width / 2f; val cy = height / 2f
                    // The arrow itself a breath smaller (1.4.180,
                    // Oscar: «just a little bit, perhaps 8% or
                    // 10%»): the arc's radius and the head scale by
                    // 0.9; the disc and the number keep their size.
                    val r = dp(9).toFloat()
                    val sec = prefs(this@BubbleService).getInt(if (dir < 0) "jump_b" else "jump_f", if (dir < 0) 15 else 30)
                    // The glyph as Oscar's reference draws it
                    // (1.4.173, correcting 172 at his verdict — «las
                    // puntas están invertidas»): the arc runs nearly
                    // the whole circle and ARRIVES at the head — the
                    // head straddles the arc's END, its tip pointing
                    // along the travel into the small gap at the top,
                    // toward the arc's free tail. In 172 the head
                    // straddled the arc's START with the shaft in
                    // front of the tip, and the arrows read backward.
                    // Forward: the arc starts at the upper right
                    // (-55°) and sweeps 310° clockwise into a head
                    // just left of the top; backward mirrors it.
                    val startA = if (dir > 0) -55f else 235f
                    val sweepA = if (dir > 0) 310f else -310f
                    cv.drawArc(android.graphics.RectF(cx - r, cy - r, cx + r, cy + r), startA, sweepA, false, p)
                    val a0 = Math.toRadians((startA + sweepA).toDouble())
                    val hx = (cx + r * Math.cos(a0)).toFloat(); val hy = (cy + r * Math.sin(a0)).toFloat()
                    val tang = a0 + if (dir > 0) Math.PI / 2 else -Math.PI / 2
                    // The head straddles the arc's end: the tip
                    // leads past it along the tangent, the base
                    // trails behind it, and the arc flows into the
                    // triangle — one closed shape.
                    val txv = Math.cos(tang).toFloat(); val tyv = Math.sin(tang).toFloat()
                    val dens = resources.displayMetrics.density
                    val tipX = hx + txv * 4.1f * dens; val tipY = hy + tyv * 4.1f * dens
                    // The base is CENTERED on the arc's end (1.4.174,
                    // Oscar: «la cabeza está demasiado arriba… el
                    // círculo no se centra en el centro de la base»):
                    // the ring's line passes through the middle of
                    // the base edge, neither trailing inside it nor
                    // riding above it.
                    val bcx = hx; val bcy = hy
                    val pxv = -tyv; val pyv = txv
                    val hw = 3.8f * dens
                    val head = android.graphics.Path()
                    head.moveTo(tipX, tipY)
                    head.lineTo(bcx + pxv * hw, bcy + pyv * hw)
                    head.lineTo(bcx - pxv * hw, bcy - pyv * hw)
                    head.close()
                    val pf = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply { color = ink; style = android.graphics.Paint.Style.FILL }
                    cv.drawPath(head, pf)
                    p.style = android.graphics.Paint.Style.FILL
                    // The number a little smaller too (1.4.181,
                    // Oscar, following the arrow's own reduction in
                    // 180): 11 → 10 dp, its baseline lift shrinking
                    // in step so it stays centered in the ring.
                    // (1.4.182, Oscar: «Again, make the numbers
                    // smaller» — one more step of the same size:
                    // 10 → 9 dp, the lift in step again.)
                    p.textSize = 9f * dens; p.textAlign = android.graphics.Paint.Align.CENTER
                    p.typeface = android.graphics.Typeface.create(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD)
                    cv.drawText(sec.toString(), cx, cy + 3.2f * dens, p)
                }
                override fun drawableStateChanged() { super.drawableStateChanged(); invalidate() }
            }
            v.background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(c["disc"]!!)
                setStroke(dp(1), c["discLine"]!!)
            }
            v.contentDescription = label
            v.setOnTouchListener { view, e ->
                when (e.action) {
                    MotionEvent.ACTION_DOWN -> view.animate().scaleX(0.9f).scaleY(0.9f).setDuration(90).start()
                    MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> view.animate().scaleX(1f).scaleY(1f).setDuration(150).setInterpolator(DecelerateInterpolator()).start()
                }
                false
            }
            v.setOnClickListener { pokeOrWake(cmd); handler.postDelayed({ refreshPanel() }, 350) }
            v.layoutParams = LinearLayout.LayoutParams(dp(42), dp(42)).apply { marginEnd = dp(10) }
            return v
        }
        val slowB = speedBtn("−", "Slower", "slower")
        // Seek glyphs, not track glyphs (1.4.118, Oscar): the bar promised
        // another audio; these keys step one sentence — a few seconds — so
        // they wear the double triangle of rew/ff, kin to play/pause.
        // (Superseded 1.4.163, Oscar's browser-player photo: the keys
        // leap by TIME now and wear the circular arrow with its
        // seconds — jumpBtn above. The sentence step keeps the media
        // session's SKIP keys, the book-to-book seat.)
        val prevB = jumpBtn("Jump back", "jumpback", -1)
        toggleB = mediaBtn(android.R.drawable.ic_media_play, "Play or pause", "toggle", 54, c["gold"]!!)
        val nextB = jumpBtn("Jump forward", "jumpfwd", 1)
        val fastB = speedBtn("+", "Faster", "faster")
        fastB.layoutParams = (fastB.layoutParams as LinearLayout.LayoutParams).apply { marginEnd = 0 }
        // The watchdog (Oscar: 'no responde al tacto'): a landed toggle always
        // flips the playing bit in the pushed state. If a breath later it has
        // not moved, the bridge is a zombie — escalate to the full wake, with
        // the session recovery behind it.
        toggleB?.setOnClickListener {
            // A press is a definite intent, never a bare toggle (1.4.89):
            // the pushed state says what is true NOW, so his finger means
            // PAUSE when it says playing and PLAY when it says paused. A
            // stored press keeps that meaning across any wake — before
            // this, a pause stored against a dead page was 'fulfilled' by
            // the recovery PLAYING the session: the pause became a play,
            // and every fresh press re-ran the same inversion.
            // The truth belongs to whoever is DRIVING (1.4.116): while the
            // device voice holds the stage, the page's last push is a dead
            // letter — a takeover that began from a page that never got to
            // say "playing" leaves it false forever, and every press then
            // computes "play": the pause key could not pause. Ever. Oscar
            // met exactly that: tapping pause while the device voice read
            // re-issued play, and the reading would not stop.
            // And the truth is judged at TAP time (M-6): livePlaying()
            // is the 1.4.116 driver rule plus the commanded truth — a
            // press he made a breath ago, still unconfirmed by any
            // push, counts as the state it commanded, so a quick
            // second tap means the opposite of the first instead of
            // repeating it off a snapshot that is one state behind.
            val before = livePlaying()
            val intent = if (before) "pause" else "play"
            val intended = intent == "play"
            // The watchdog's evidence (T2-12): the press is judged
            // not by the playing bit alone but by whether the page
            // SHOWED anything at all in answer. The old test compared
            // only the bit before/after 1 200 ms — and a play that
            // legitimately started AND finished inside the window (a
            // very short copied text, an errored start) reads
            // after == before, so it was judged a zombie and the
            // watchdog force-stored the play and ghost-woke the
            // page: a replay nobody ordered. M-6's commanded truth
            // does not cover this — it judges TAPS, and a corpse
            // leaves it standing too — so the rungs below look for a
            // TRANSITION: a push landing at all (nowAt advancing),
            // whose content differs from the press-time snapshot
            // (position, sentence, busy/err/active bits, subtitle).
            // A session that ran and finished moves that evidence; a
            // corpse moves none of it.
            val beforeAt = nowAt
            val beforePush = nowJson
            val epochAtPress = pageEpoch
            fun pageAnswered(): Boolean {
                // A load finishing since the press retires every
                // witness below (R3-T2-1): the pushes since then are
                // a NEW page's restore pushes, whose reset playing
                // bit and changed content counterfeit both tests for
                // a poke that died with the old JS context. The rungs
                // then do their honest work — the intent is stored,
                // the page is woken — and the fresh page collects
                // the intent through the Bridge, stamp-checked.
                if (pageEpoch != epochAtPress) return false
                if (nowAt <= beforeAt) return false // no push landed: silence
                if (runCatching { JSONObject(nowJson).optBoolean("playing") }.getOrDefault(before) == intended) return true
                return nowJson != beforePush // it pushed SOMETHING different: it heard, and acted
            }
            pokeOrWake(intent)
            handler.postDelayed({ refreshPanel() }, 350)
            handler.postDelayed({
                if (!NativeSpeaker.active && !pageAnswered()) pokeOrWake(intent, force = true)
            }, 1200)
            // The last rung: even the wake changed nothing — the page itself
            // is a corpse. Reload it in place; the fresh page collects the
            // stored INTENT (a pause stays a pause — silence needs no
            // resurrection), and any waiting catch is recovered on its own.
            // The rung itself is cured too (T2-12): it used to be a
            // safe-call on poke — a no-op in exactly the case it
            // exists for, when poke is null because the activity is
            // gone. Now the null case takes the road that needs no
            // poke: the intent is stored (pokeOrWake force, above,
            // already stored it; storing again coalesces at the
            // queue's tail), wantReload is raised, and a ghost visit
            // brings a NEW activity whose arrival honours the flag
            // and reloads its fresh page — which then collects the
            // stored intent through the Bridge.
            handler.postDelayed({
                if (!NativeSpeaker.active && !pageAnswered()) {
                    if (poke != null) poke?.invoke("reload")
                    else { wantReload = true; ghostWake(force = true) }
                }
            }, 2600)
        }
        // The track keys (1.4.205): born with the panel, seated only
        // while a copy queue stands — arrangeTransport owns the row.
        val trackPrevB = mediaBtn(android.R.drawable.ic_media_previous, "Previous audio", "prev", 42, c["discLine"]!!)
        val trackNextB = mediaBtn(android.R.drawable.ic_media_next, "Next audio", "next", 42, c["discLine"]!!)
        ctlSlow = slowB; ctlPrev = prevB; ctlNext = nextB; ctlFast = fastB
        ctlTrackPrev = trackPrevB; ctlTrackNext = trackNextB
        arrangeTransport(force = true)
        card.addView(controls)
        val seekW = SeekBar(this).apply {
            max = 1000
            // The line's height is DECLARED in the drawables (1.4.107): it
            // used to exist only as the insets' arithmetic (24 − 10 − 10),
            // and some Androids (Oscar's phone) size the track from the
            // layers' own height — none declared, no line, only the thumb
            // (which always had its size) survived. The tablet stretched
            // it anyway; now both read the same 4dp from the same place.
            val trackD = GradientDrawable().apply { setColor(c["div"]!!); cornerRadius = dp(2).toFloat(); setSize(-1, dp(4)) }
            val fillD = ClipDrawable(GradientDrawable().apply { setColor(c["gold"]!!); cornerRadius = dp(2).toFloat(); setSize(-1, dp(4)) }, Gravity.START, ClipDrawable.HORIZONTAL)
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
                override fun onStopTrackingTouch(sb: SeekBar?) { seekHeld = false; seekFrac = (sb?.progress ?: 0) / 1000.0; if (NativeSpeaker.active) NativeSpeaker.seekTo(seekFrac) else pokeSeekOrWake() }
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
            // 1.4.201 (Oscar's word): the Auto lever reads smaller —
            // a little on the tablet, more on the phone.
            val ls = if (isTablet()) 0.9f else 0.78f
            scaleX = ls; scaleY = ls
            isChecked = lever(this@BubbleService)
            val goldStates = android.content.res.ColorStateList(
                arrayOf(intArrayOf(android.R.attr.state_checked), intArrayOf()),
                intArrayOf(c["gold"]!!, Color.rgb(140, 130, 115))
            )
            thumbTintList = goldStates
            trackTintList = goldStates
            setOnCheckedChangeListener { _, on ->
                prefs(this@BubbleService).edit().putBoolean("auto", on).apply()
                // The flip stands as the native truth until the page
                // proves it heard (T2-17): if this poke is lost, the
                // page's next init push of its stale setting is
                // refused at the Bridge instead of silently
                // reverting the switch he just flipped.
                notePanelLever()
                poke?.invoke("lever")
                if (on) readClip(false)
            }
        }
        clipRow.addView(leverS)
        val spacer2 = View(this).apply { layoutParams = LinearLayout.LayoutParams(0, 1, 1f) }
        clipRow.addView(spacer2)
        fun footBtn(desc: String, name: String, glyph: (cv: android.graphics.Canvas, ink: Int, cx: Float, cy: Float, r: Float) -> Unit, act: () -> Unit): View {
            val v = object : View(this) {
                override fun onDraw(cv: android.graphics.Canvas) {
                    super.onDraw(cv)
                    glyph(cv, if (isPressed) c["gold"]!! else c["muted"]!!, width / 2f, height / 2f, dp(8).toFloat())
                }
                override fun drawableStateChanged() { super.drawableStateChanged(); invalidate() }
            }
            fun disc(fill: Int, ringC: Int) = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(fill)
                setStroke(dp(1), ringC)
            }
            v.background = android.graphics.drawable.StateListDrawable().apply {
                addState(intArrayOf(android.R.attr.state_pressed), disc(mixCol(c["disc"]!!, c["gold"]!!, 0.28f), c["gold"]!!))
                addState(intArrayOf(), disc(c["disc"]!!, c["discLine"]!!))
            }
            v.contentDescription = desc
            // Kept under the finger, the disc names itself (Oscar):
            // after a short hold a small pill floats above it with
            // its name, and that release does NOT run the deed — a
            // plain tap still does, exactly as before.
            var longed = false
            var lpRun: Runnable? = null
            v.setOnTouchListener { view, e ->
                when (e.action) {
                    MotionEvent.ACTION_DOWN -> {
                        view.animate().scaleX(0.9f).scaleY(0.9f).setDuration(90).start()
                        longed = false
                        val r = Runnable {
                            longed = true
                            view.performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS)
                            showNameTag(view, name)
                        }
                        lpRun = r
                        handler.postDelayed(r, 480)
                    }
                    MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                        view.animate().scaleX(1f).scaleY(1f).setDuration(150).setInterpolator(DecelerateInterpolator()).start()
                        lpRun?.let { handler.removeCallbacks(it) }; lpRun = null
                        if (longed) hideNameTag()
                    }
                }
                false
            }
            v.setOnClickListener { if (!longed) act() else longed = false }
            return v
        }
        fun inkPaint(ink: Int) = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
            color = ink; style = android.graphics.Paint.Style.STROKE
            strokeWidth = dp(2).toFloat(); strokeCap = android.graphics.Paint.Cap.ROUND
        }
        // Paste now left the footer as a WORD in 1.4.117 (Oscar): a
        // copied text arrives on its own, so the key repeated what
        // already happened. It returns in 1.4.162 at his word, as an
        // ICON in the corner at the same 30 dp — for the catch the
        // automatic road cannot see: re-copying the SAME text. The
        // automatic dedupe reads a repeated copy as no news; a hand
        // ask is news by definition (deliver() has always bypassed
        // lock and hash for manual reads), so this disc runs the old
        // guaranteed-floor read: panel, blink, then Logos itself.
        // 1.4.201 (Oscar's word): on the PHONE the footer's discs
        // step down once more (25 → 22 dp, margins with them); on
        // the tablet they keep the 1.4.200 size. The Auto lever
        // shrinks on both — a little on the tablet, more on the
        // phone (see leverS below).
        val footDp = if (isTablet()) 25 else 22
        val footM1 = if (isTablet()) 10 else 9
        val footM = if (isTablet()) 6 else 5
        val pasteB = footBtn(s("Paste now", "Pegar ahora"), s("Paste", "Pegar"), { cv, ink, cx, cy, r ->
            val p = inkPaint(ink)
            // The wheel, not reinvented (Oscar, 2026-11-14, with the
            // glyph in hand): the standard paste symbol — two pages,
            // the back one peeking out at the top-left, the front one
            // clean before it. The 162 drawing (a board, a clip, an
            // arrow of my own) is retired. The front page is first
            // filled with the disc's own colour so the back page's
            // lines stop at its edge, exactly as the symbol is drawn
            // everywhere else; pressed, ink runs gold and the fill
            // warms with the disc, as the disc itself does.
            val rad = r * 0.30f
            cv.drawRoundRect(android.graphics.RectF(cx - r * 0.82f, cy - r * 0.98f, cx + r * 0.30f, cy + r * 0.14f), rad, rad, p)
            val fill = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
                style = android.graphics.Paint.Style.FILL
                color = if (ink == c["gold"]!!) mixCol(c["disc"]!!, c["gold"]!!, 0.28f) else c["disc"]!!
            }
            val front = android.graphics.RectF(cx - r * 0.30f, cy - r * 0.14f, cx + r * 0.82f, cy + r * 0.98f)
            cv.drawRoundRect(front, rad, rad, fill)
            cv.drawRoundRect(front, rad, rad, p)
        }) {
            // Paste now (Oscar's law, 1.4.239): the key reads the
            // clipboard, with the queue on or off alike. The card
            // that stood here (1.4.206 — «Put the last copy
            // first?», the confirmed copy jumping the line and
            // ejecting the standing current) is retired by his
            // ruling that the line's order is the COPY order: with
            // the mode on, the page lines the delivery up at the
            // tail in its turn, like every arrival; with the mode
            // off, the key is exactly the key it has always been.
            readClip(true)
        }
        pasteB.layoutParams = LinearLayout.LayoutParams(dp(footDp), dp(footDp)).apply { leftMargin = dp(footM1) }
        clipRow.addView(pasteB)
        val listenB = footBtn(s("Go to the listening area", "Ir a la zona de escucha"), s("Listen", "Escuchar"), { cv, ink, cx, cy, r ->
            // 1.4.200 retired the headphones (they read as a headset
            // key) for the sound wave; 1.4.201 (Oscar's word, same
            // day): the wave describes the area but not the DEED —
            // this key takes him INTO the application. It wears the
            // enter sign: an arrow going into the app's frame, the
            // frame open where the arrow enters.
            val p = inkPaint(ink).apply { strokeJoin = android.graphics.Paint.Join.ROUND }
            val fx = cx + r * 0.88f
            val frame = android.graphics.Path()
            frame.moveTo(cx - r * 0.02f, cy - r * 0.82f)
            frame.lineTo(fx, cy - r * 0.82f)
            frame.lineTo(fx, cy + r * 0.82f)
            frame.lineTo(cx - r * 0.02f, cy + r * 0.82f)
            cv.drawPath(frame, p)
            cv.drawLine(cx - r * 0.90f, cy, cx + r * 0.28f, cy, p)
            val head = android.graphics.Path()
            head.moveTo(cx - r * 0.04f, cy - r * 0.36f)
            head.lineTo(cx + r * 0.32f, cy)
            head.lineTo(cx - r * 0.04f, cy + r * 0.36f)
            cv.drawPath(head, p)
        }) {
            collapsePanel()
            runCatching { startActivity(Intent(this, MainActivity::class.java).setAction(Intent.ACTION_MAIN).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("logos.listen", true)) }
        }
        listenB.layoutParams = LinearLayout.LayoutParams(dp(footDp), dp(footDp)).apply { leftMargin = dp(footM) }
        val eyeB = footBtn(s("Hide bubble", "Ocultar burbuja"), s("Hide", "Ocultar"), { cv, ink, cx, cy, r ->
            val p = inkPaint(ink)
            val eye = android.graphics.Path()
            eye.moveTo(cx - r, cy)
            eye.quadTo(cx, cy - r * 1.3f, cx + r, cy)
            eye.quadTo(cx, cy + r * 1.3f, cx - r, cy)
            cv.drawPath(eye, p)
            cv.drawCircle(cx, cy, r * 0.46f, p)
            p.style = android.graphics.Paint.Style.FILL
            cv.drawCircle(cx, cy, r * 0.18f, p)
        }) { showHideHint() }
        eyeB.layoutParams = LinearLayout.LayoutParams(dp(footDp), dp(footDp)).apply { leftMargin = dp(footM) }
        clipRow.addView(eyeB)
        // The copy queue's key (1.4.198): a playlist glyph wearing
        // the line's count; its tap opens the line itself over the
        // panel, where any text can be played or dropped.
        val queueWrap = FrameLayout(this)
        val queueB = footBtn(s("Copy queue", "Cola de copiado"), s("Queue", "Cola"), { cv, ink, cx, cy, r ->
            val dens = resources.displayMetrics.density
            val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = ink; style = Paint.Style.STROKE; strokeWidth = 1.4f * dens; strokeCap = Paint.Cap.ROUND }
            val dot = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = ink }
            val left = cx - r * 0.78f
            val right = cx + r * 0.78f
            for (k in -1..1) {
                val y = cy + k * r * 0.52f
                cv.drawLine(left, y, right, y, p)
                cv.drawCircle(left - r * 0.02f, y, 1.1f * dens, dot)
            }
        }) { toggleQueueList() }
        queueWrap.addView(queueB, FrameLayout.LayoutParams(dp(footDp), dp(footDp)))
        val queueBadge = TextView(this).apply {
            text = ""
            visibility = View.INVISIBLE
            setTextColor(c["gold"]!!); textSize = 9.5f; gravity = Gravity.CENTER
            setTypeface(typeface, Typeface.BOLD)
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(c["disc"]!!); setStroke(dp(1), c["discLine"]!!) }
            layoutParams = FrameLayout.LayoutParams(dp(14), dp(14), Gravity.BOTTOM or Gravity.END)
        }
        queueWrap.addView(queueBadge)
        queueBtnV = queueWrap
        queueBadgeV = queueBadge
        queueWrap.layoutParams = LinearLayout.LayoutParams(dp(footDp), dp(footDp)).apply { leftMargin = dp(footM) }
        clipRow.addView(queueWrap)
        // The enter key takes the RIGHT END (Oscar, 1.4.205, by
        // symmetry): the key that takes him into the app sits where
        // the queue's key sat, and the rest of the row steps one
        // seat left — [paste][eye][queue][enter].
        clipRow.addView(listenB)
        card.addView(clipRow)
        // The reader's grip: two small gold ticks hugging the panel's free
        // corner. Drag it and the reader stretches (see applyReaderScale).
        val grip = object : View(this) {
            override fun onDraw(cv: android.graphics.Canvas) {
                super.onDraw(cv)
                val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
                    color = c["gold"]!!; alpha = 150; style = android.graphics.Paint.Style.STROKE
                    strokeWidth = dp(2).toFloat(); strokeCap = android.graphics.Paint.Cap.ROUND
                }
                val cxp = if (gripFreeR) width.toFloat() else 0f
                val cyp = if (gripFreeB) height.toFloat() else 0f
                val ix = if (gripFreeR) -1f else 1f
                val iy = if (gripFreeB) -1f else 1f
                val arm = dp(12).toFloat()
                for (inset in intArrayOf(dp(6), dp(12))) {
                    val path = android.graphics.Path()
                    path.moveTo(cxp + ix * inset, cyp + iy * arm)
                    path.lineTo(cxp + ix * inset, cyp + iy * inset)
                    path.lineTo(cxp + ix * arm, cyp + iy * inset)
                    cv.drawPath(path, paint)
                }
            }
        }
        grip.contentDescription = s("Resize the reader", "Cambiar el tamaño del lector")
        grip.visibility = View.GONE
        grip.layoutParams = FrameLayout.LayoutParams(dp(30), dp(30), Gravity.BOTTOM or Gravity.END)
        var dragX0 = 0f; var dragY0 = 0f; var dragW0 = 1f; var dragH0 = 1f
        grip.setOnTouchListener { v, e ->
            when (e.action) {
                MotionEvent.ACTION_DOWN -> {
                    dragX0 = e.rawX; dragY0 = e.rawY; dragW0 = curScaleW(); dragH0 = curScaleH()
                    v.parent?.requestDisallowInterceptTouchEvent(true)
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val gx = if (gripFreeR) e.rawX - dragX0 else -(e.rawX - dragX0)
                    val gy = if (gripFreeB) e.rawY - dragY0 else -(e.rawY - dragY0)
                    val nsW = (dragW0 + gx / dp(240)).coerceIn(0.75f, 1.9f)
                    val nsH = (dragH0 + gy / dp(240)).coerceIn(0.75f, 1.9f)
                    if (kotlin.math.abs(nsW - curScaleW()) > 0.005f || kotlin.math.abs(nsH - curScaleH()) > 0.005f) {
                        panelScaleW = nsW; panelScaleH = nsH; applyReaderScale(false)
                    }
                    true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> { applyReaderScale(true); true }
                else -> false
            }
        }
        gripV = grip
        stage.addView(grip)
        // The copy queue's list (1.4.198): a sheet over the panel's
        // own card, born hidden; the footer's queue key opens it,
        // and any lined-up text can be played or dropped from it.
        // 1.4.201 (Oscar's word): the sheet gets a DESIGNED face —
        // not a black slab. It wears the panel card's own
        // furniture: the rim around its gradient, the gold glow
        // lying on its top like the player's, a hairline under its
        // head, and a foot of its own for the universal key.
        val qList = FrameLayout(this).apply {
            // The glow rides IN the background now (1.4.209): as a
            // MATCH_PARENT child (1.4.205) it claimed the whole
            // screen height for itself and dragged the sheet — and
            // the window — up with it, so three texts stood in a
            // full-screen sheet. A background drawable never takes
            // part in measurement; the light it paints is identical
            // (the 205 one-piece radial, centered on the top edge,
            // dying inside the sheet — the colours Oscar praised
            // are untouched, only the size is cured).
            background = android.graphics.drawable.LayerDrawable(arrayOf(
                GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, intArrayOf(c["bg1"]!!, c["bg2"]!!)).apply { cornerRadius = dp(24).toFloat(); setStroke(dp(1), c["line"]!!) },
                GradientDrawable().apply {
                    gradientType = GradientDrawable.RADIAL_GRADIENT
                    setGradientCenter(0.5f, 0.0f)
                    gradientRadius = dp(240).toFloat()
                    colors = intArrayOf(c["glow"]!!, Color.TRANSPARENT)
                }
            ))
            visibility = View.GONE
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        }
        val qContent = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(12), dp(16), dp(12))
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        }
        val qHeadRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        val qHead = TextView(this).apply {
            setTextColor(c["ink"]!!); textSize = 14.5f; typeface = Typeface.SERIF; setTypeface(typeface, Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        qHeadRow.addView(qHead)
        // The mode's own lever (Oscar, 1.4.206; seated 1.4.209):
        // the queue can be turned on or off from its own sheet,
        // wearing the Auto lever's face, so he never has to go to
        // Settings for it. It takes the head row's right end — the
        // seat the back arrow held until 209, when Oscar retired
        // the arrow: the way back is a tap outside the sheet (or
        // the queue key again), and the arrow was furniture. A tap
        // does NOT flip it: the lever steps back and a card asks
        // first, short and direct, what the flip means; only the
        // card's answer moves the lever and pokes the page.
        val qLever = Switch(this).apply {
            val ls = if (isTablet()) 0.9f else 0.78f
            scaleX = ls; scaleY = ls
            isChecked = panelQueueMode
            val goldStates = android.content.res.ColorStateList(
                arrayOf(intArrayOf(android.R.attr.state_checked), intArrayOf()),
                intArrayOf(c["gold"]!!, Color.rgb(140, 130, 115))
            )
            thumbTintList = goldStates
            trackTintList = goldStates
            contentDescription = s("Copy queue", "Cola de copiado")
            setOnClickListener {
                isChecked = panelQueueMode
                if (panelQueueMode) {
                    showHintCard(s("Turn off the copy queue?", "¿Apagar la cola de copiado?"), s("The line will be erased, and copies will stop lining up — a copy will take the stage as it did before.", "La fila se borrará y las copias dejarán de alinearse: una copia tomará la escena como antes."), s("Turn it off", "Apagarla"), s("Not now", "Ahora no")) {
                        queueLeverFlipAt = System.currentTimeMillis()
                        queueLeverV?.isChecked = false
                        pokeOrWake("queueoff")
                    }
                } else {
                    showHintCard(s("Turn on the copy queue?", "¿Encender la cola de copiado?"), s("What you copy will line up and play one text after the next, instead of replacing what is playing.", "Lo que copies se pondrá en fila y sonará un texto tras otro, en lugar de reemplazar lo que está sonando."), s("Turn it on", "Encenderla"), s("Not now", "Ahora no")) {
                        queueLeverFlipAt = System.currentTimeMillis()
                        queueLeverV?.isChecked = true
                        pokeOrWake("queueon")
                    }
                }
            }
        }
        qHeadRow.addView(qLever)
        queueLeverV = qLever
        qContent.addView(qHeadRow)
        val qDiv = View(this).apply {
            setBackgroundColor(c["div"]!!)
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1)).apply { topMargin = dp(8); bottomMargin = dp(6) }
        }
        qContent.addView(qDiv)
        val qScroll = ScrollView(this).apply { layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f) }
        val qRows = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        qScroll.addView(qRows)
        qContent.addView(qScroll)
        // The universal key (Oscar, 1.4.201): empties the WHOLE
        // line, behind its own confirmation, which says so.
        val qClear = TextView(this).apply {
            text = s("Empty the whole list", "Vaciar toda la lista")
            // (1.4.205, Oscar: the words stay; the size steps down
            // «un poquitín» — 13 → 12.)
            setTextColor(c["gold"]!!); textSize = 12f; gravity = Gravity.CENTER
            setPadding(0, dp(10), 0, dp(2))
            contentDescription = s("Empty the whole list", "Vaciar toda la lista")
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            setOnClickListener {
                showHintCard(s("Empty the queue", "Vaciar la cola"), s("Every text in the line will be removed. What is playing keeps playing.", "Se quitarán todos los textos de la fila. Lo que está sonando seguirá sonando."), s("Empty it", "Vaciarla"), s("Not now", "Ahora no")) {
                    pokeOrWake("clearqueue")
                }
            }
        }
        qContent.addView(qClear)
        qList.addView(qContent)
        stage.addView(qList)
        queueListV = qList; queueRowsV = qRows; queueHeadV = qHead; queueClearV = qClear
        val p = WindowManager.LayoutParams(
            panelWidth(), WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
            PixelFormat.TRANSLUCENT
        ).apply { gravity = Gravity.TOP or Gravity.START }
        panelParams = p
        stage.setOnTouchListener { _, e -> if (e.action == MotionEvent.ACTION_OUTSIDE) { outsideClosedAt = System.currentTimeMillis(); if (queueListOpen) toggleQueueList() else collapsePanel(); true } else false }
        runCatching { w.addView(stage, p) }
        panel = stage
        // The bubble outranks its window (1.4.227, Oscar): the
        // panel's window is born after the bubble's, so the card
        // painted OVER the jewel's lower cap — in photo after photo
        // the bubble showed «detrás de la ventana», however well
        // its corner seated. The bubble is re-raised the moment the
        // panel is born: the graze stays exactly as settled, but
        // the λ now sits ON its window, whole, in every territory
        // of the phone — and a later window (a hint card, a drag
        // target) still rises above them both, as it should.
        bubble?.let { b -> runCatching { wm?.removeView(b); wm?.addView(b, bubbleParams) } }
        // The window shrinks to the jewel for the panel's stay
        // (1.4.238, see bubbleWindow()): reseated in the same act,
        // so the jewel itself does not move a hair — only its
        // window's touch bounds step back off the panel's corner.
        applyLook()
        seatBubbleInCorner(false)
        positionPanel()
        // While the window is open, the bubble wears the WINDOW's
        // opacity (Oscar, 1.4.197): it does not look right for the λ
        // to stay at its own transparency beside a panel at another
        // level — the bubble copies the panel's, and takes its own
        // back when the panel closes (collapsePanel).
        bubble?.let { it.animate().cancel(); it.animate().alpha(panelAlpha()).setDuration(190).start() }
        // A short, smooth birth: the panel grows out of the λ's own position.
        val bp2 = bubbleParams
        stage.pivotX = panelPivotX ?: if (seatRight) panelWidth().toFloat() else 0f
        // It grows out of the very corner that grazes the λ.
        stage.pivotY = if (seatBottom) dp(320).toFloat() else 0f
        stage.scaleX = 0.86f; stage.scaleY = 0.86f; stage.alpha = 0f
        stage.animate().scaleX(1f).scaleY(1f).alpha(panelAlpha()).setDuration(190).setInterpolator(DecelerateInterpolator()).start()
        // Once laid out, its real height gets the final word on the spot.
        stage.post { positionPanel() }
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

    // THE BUBBLE SITS ON THE PANEL'S CORNER (Oscar, correcting 1.4.94):
    // the bubble never moves on its own. The panel deploys so that one
    // of its own corners lands exactly under the bubble's centre — the
    // λ ends up pinned ON the corner of the rectangle, at the end of
    // the arrow from the rectangle's centre to its corner — wherever
    // on the screen the pair happens to be. Top-left corner when the
    // bubble lives on the left, top-right on the right; the matching
    // bottom corner when the panel must deploy upward instead.
    // Which corner of the panel grazes the bubble, from the last seating.
    private var seatRight = false
    private var seatBottom = false
    // In the middle of the room (phone), the panel is born from the
    // point beneath the bubble instead of from a corner: its pivot x
    // inside the panel, set by positionPanel; null = corner birth.
    private var panelPivotX: Float? = null

    // THE CORNER GRAZES THE CIRCLE (Oscar, refining 1.4.95): the panel
    // and the bubble must NOT overlap. The rectangle's corner point
    // travels the diagonal from the bubble's centre until it just
    // touches the bubble's circle — the corner rests on the circle's
    // edge, in that direction, and no further.
    private fun positionPanel() {
        val p = panelParams ?: return
        val bp = bubbleParams ?: return
        val sw2 = resources.displayMetrics.widthPixels
        val sh2 = resources.displayMetrics.heightPixels
        val pw = panelWidth()
        val margin = dp(10)
        val cx = bp.x + bubbleHalf()
        val cy = bp.y + bubbleHalf()
        val phNow = panel?.height?.takeIf { it > 0 } ?: dp(320)
        // The panel's height with the words window at its NATURAL
        // height (1.4.222): a past seating may have shrunk the words
        // (seatBelow), and every seat is judged against the honest
        // size — the words take their height back whenever the room
        // allows, below.
        val wv = wordsV
        val wvOn = wv != null && wv.visibility == View.VISIBLE
        val wvNat = if (wvOn) wordsHeight() else 0
        var wvH = if (wvOn) wv!!.layoutParams.height else 0
        val ph = phNow - wvH + wvNat
        if (wvOn && wvH != wvNat) { wv!!.layoutParams.height = wvNat; wv.requestLayout(); wvH = wvNat }
        // The corner travels the diagonal toward the circle — but the
        // panel's corners are rounded (24dp), which pulls the DRAWN
        // edge back along that same diagonal by R·(√2−1) ≈ 10dp. The
        // geometric corner aims inside the circle by that much, so
        // the drawn corner ends ~2dp from the circle: a short graze,
        // never an overlap.
        val r = bubbleFace() / 2
        val dist = r + dp(2) - (dp(24) * 0.4142f).toInt()
        val d = (dist * 0.7071f).toInt()
        // THE SEAT DECIDES (1.4.231; six places since 1.4.233): the
        // bubble rests in a predetermined place, so the panel's seat
        // is read off that place — the same place gives the same
        // arrangement every time.
        val homeCorner = bubbleCorner()
        seatRight = homeCorner % 2 == 1
        val bottomCorner = homeCorner in 2..3
        p.x = (if (seatRight) cx - d - pw else cx + d).coerceIn(margin, (sw2 - pw - margin).coerceAtLeast(margin))
        // (The mid-room branch that stood here — the panel unfolding
        // straight below a mid-screen bubble — is retired, 1.4.231:
        // the bubble is never mid-screen now, it rests in a corner.)
        // THE GRAZE OUTRANKS THE FIT (1.4.222, Oscar's photo): the
        // bottom-fit clamp in the seat below used to drag a tall
        // panel UP over the bubble — the λ left half-buried behind
        // the panel's top edge, mid-edge («se queda ahí abajo»),
        // instead of enthroned on its corner with the whole room
        // free beneath. The seat is sacred now: when the room below
        // runs short, the WORDS window gives up the overflow — it
        // scrolls inside itself and the amber word stays centred —
        // down to a floor of 36dp; only a panel too tall for even
        // that falls back to the old clamp, saving its footer as a
        // last resort.
        fun seatBelow(topSeat: Int): Int {
            var target = wvNat
            if (wvOn && topSeat + ph > sh2 - margin) target = (wvNat - (topSeat + ph - (sh2 - margin))).coerceAtLeast(dp(36))
            if (wvOn && target != wvH) { wv!!.layoutParams.height = target; wv.requestLayout(); wvH = target }
            val phF = ph - (wvNat - target)
            return if (topSeat + phF <= sh2 - margin) topSeat else (sh2 - phF - margin).coerceAtLeast(margin)
        }
        // The mirror for a bottom corner (1.4.231): the panel rises
        // above the bubble, and the words window yields the overflow
        // toward the top exactly as seatBelow yields it toward the
        // bottom — the graze outranks the fit in both directions.
        fun seatAbove(topSeat: Int): Int {
            var target = wvNat
            if (wvOn && topSeat < margin) target = (wvNat - (margin - topSeat)).coerceAtLeast(dp(36))
            if (wvOn && target != wvH) { wv!!.layoutParams.height = target; wv.requestLayout(); wvH = target }
            val phF = ph - (wvNat - target)
            return (cy - d - phF).coerceAtLeast(margin)
        }
        // A middle seat (1.4.233) has no up or down of its own: the
        // panel unfolds BELOW when its natural height fits below
        // the graze, else ABOVE when it fits there, else below with
        // the words yielding (seatBelow's own law) — judged against
        // the same screen every time, so a middle seat also gives
        // the same arrangement every time.
        seatBottom = when {
            bottomCorner -> true
            homeCorner >= 4 -> (cy + d) + ph > sh2 - margin && (cy - d - ph) >= margin
            else -> false
        }
        p.y = if (seatBottom) seatAbove(cy - d - ph) else seatBelow(cy + d)
        panelPivotX = null
        // The grip rides the corner opposite the seated one — the free one.
        val nfr = !seatRight; val nfb = !seatBottom
        gripV?.let { g ->
            val lp = g.layoutParams as? FrameLayout.LayoutParams
            val ng = (if (nfb) Gravity.BOTTOM else Gravity.TOP) or (if (nfr) Gravity.END else Gravity.START)
            if (lp != null && lp.gravity != ng) { lp.gravity = ng; g.layoutParams = lp }
            if (nfr != gripFreeR || nfb != gripFreeB) { gripFreeR = nfr; gripFreeB = nfb; g.invalidate() }
        }
        panel?.let { v -> runCatching { wm?.updateViewLayout(v, p) } }
    }

    /** A footer disc kept under the finger names itself (Oscar): a
     *  small pill floats above the disc with its name — Paste,
     *  Listen, Hide — while a plain tap keeps doing the deed. The
     *  pill wears the panel's own family (pal()), flat-faced with
     *  the calibrated edge — hairline, a whisper of top light, a
     *  short shadow. It takes no touches and dies with the finger. */
    private fun showNameTag(anchor: View, name: String) {
        hideNameTag()
        val w = wm ?: return
        val c = pal()
        val tag = TextView(this).apply {
            text = name
            setTextColor(c["ink"]!!); textSize = 12.5f
            setTypeface(typeface, Typeface.BOLD)
            setPadding(dp(12), dp(6), dp(12), dp(6))
            background = GradientDrawable().apply {
                setColor(mixCol(c["bg1"]!!, c["bg2"]!!, 0.3f))
                cornerRadius = dp(14).toFloat()
                setStroke(dp(1), mixCol(c["gold"]!!, c["bg2"]!!, 0.45f))
            }
            elevation = dp(8).toFloat()
            alpha = 0f
        }
        val loc = IntArray(2); anchor.getLocationOnScreen(loc)
        val p = WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE, PixelFormat.TRANSLUCENT).apply {
            gravity = Gravity.TOP or Gravity.START
            x = loc[0]; y = (loc[1] - dp(44)).coerceAtLeast(dp(4))
        }
        runCatching { w.addView(tag, p) }.onFailure { return }
        nameTag = tag
        // Centre the pill over the disc once it has been measured.
        tag.post {
            if (nameTag === tag) {
                p.x = (loc[0] + anchor.width / 2 - tag.width / 2).coerceAtLeast(dp(4))
                runCatching { w.updateViewLayout(tag, p) }
            }
        }
        tag.animate().alpha(1f).setDuration(140).start()
        val r = Runnable { hideNameTag() }
        nameTagRun = r
        handler.postDelayed(r, 2200)
    }

    private fun hideNameTag() {
        nameTagRun?.let { handler.removeCallbacks(it) }; nameTagRun = null
        val v = nameTag; nameTag = null
        if (v != null) runCatching { wm?.removeView(v) }
    }

    /** The panel's buttons explain themselves first (Oscar): a small floating
     *  card naming what the button does, the deed one clear tap away. */
    /** The copy queue's list over the panel (1.4.198): open it, and
     *  the line stands in order — the one sounding wears the gold —
     *  each row a door (tap: play it) with its own ✕ (drop it). The
     *  rows are rebuilt from the latest push whenever it opens and
     *  whenever a push lands while it stands open. */
    private fun toggleQueueList() {
        val v = queueListV ?: return
        queueListOpen = !queueListOpen
        val p = panelParams; val st = panel
        if (queueListOpen) {
            // The window is pinned to the card's own height BEFORE
            // the sheet shows (1.4.209): the sheet is a sheet OVER
            // THE CARD, and with its height capped at the card's,
            // no measurement inside it can stretch the window to
            // the screen again. The cap is the card's height as it
            // stands now, the sheet still hidden.
            if (p != null && st != null && st.height > 0 && p.height != st.height) {
                p.height = st.height
                runCatching { wm?.updateViewLayout(st, p) }
            }
            buildQueueRows(); v.visibility = View.VISIBLE
        } else {
            v.visibility = View.GONE
            if (p != null && st != null && p.height != WindowManager.LayoutParams.WRAP_CONTENT) {
                p.height = WindowManager.LayoutParams.WRAP_CONTENT
                runCatching { wm?.updateViewLayout(st, p) }
            }
        }
    }

    private fun buildQueueRows() {
        val rows = queueRowsV ?: return
        rows.removeAllViews()
        val c = cardPal()
        queueHeadV?.text = s("Copy queue", "Cola de copiado") + if (panelQueueCount > 0) " · $panelQueueCount" else ""
        if (panelQueueTitles.isEmpty()) {
            rows.addView(TextView(this).apply {
                text = if (panelQueueMode) s("The line is empty — copy a text and it will stand here.", "La fila está vacía: copia un texto y aparecerá aquí.") else s("The queue is off. Turn it on with the lever above, and copies will line up here.", "La cola está desactivada. Enciéndela con la palanca de arriba y las copias se pondrán en fila aquí.")
                setTextColor(c["muted"]!!); textSize = 12.5f
                setPadding(0, dp(10), 0, dp(6))
            })
            queueClearV?.visibility = View.GONE
            return
        }
        panelQueueTitles.forEachIndexed { i, title ->
            val isCur = i == panelQueueCur
            val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(0, dp(3), 0, dp(3)) }
            row.addView(TextView(this).apply {
                text = (if (isCur) "▶ " else "${i + 1} · ") + title
                setTextColor(if (isCur) c["gold"]!! else c["ink"]!!); textSize = 13.5f
                if (isCur) setTypeface(typeface, Typeface.BOLD)
                maxLines = 1; ellipsize = android.text.TextUtils.TruncateAt.END
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                setOnClickListener { storeQueuePlay(i); pokeOrWake("queueplay"); toggleQueueList() }
            })
            // The row's own little book (1.4.232, Oscar): the app
            // sheet has one per copy since 1.4.229, so the panel's
            // list wears it too — same deed, same face, and the
            // same quick question before it saves. Copies only:
            // books and recordings already live in the Library.
            if (panelQueueKinds.getOrNull(i) == true) {
                row.addView(object : View(this) {
                    override fun onDraw(cv: android.graphics.Canvas) {
                        super.onDraw(cv)
                        val p = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
                            color = c["muted"]!!; style = android.graphics.Paint.Style.STROKE
                            strokeWidth = dp(3) / 2f; strokeCap = android.graphics.Paint.Cap.ROUND; strokeJoin = android.graphics.Paint.Join.ROUND
                        }
                        val cx = width / 2f; val cy = height / 2f; val u = dp(15) / 24f
                        fun px(x: Float) = cx + (x - 12f) * u
                        fun py(y: Float) = cy + (y - 12f) * u
                        val path = android.graphics.Path()
                        path.moveTo(px(4f), py(19.5f))
                        path.lineTo(px(4f), py(4.5f))
                        path.quadTo(px(4f), py(2f), px(6.5f), py(2f))
                        path.lineTo(px(19f), py(2f))
                        path.quadTo(px(20f), py(2f), px(20f), py(3f))
                        path.lineTo(px(20f), py(21f))
                        path.quadTo(px(20f), py(22f), px(19f), py(22f))
                        path.lineTo(px(6.5f), py(22f))
                        path.lineTo(px(6.5f), py(17f))
                        path.lineTo(px(20f), py(17f))
                        cv.drawPath(path, p)
                        val arrow = android.graphics.Path()
                        arrow.moveTo(px(12f), py(7f)); arrow.lineTo(px(12f), py(13f))
                        arrow.moveTo(px(9f), py(10f)); arrow.lineTo(px(12f), py(13f)); arrow.lineTo(px(15f), py(10f))
                        cv.drawPath(arrow, p)
                    }
                }.apply {
                    layoutParams = LinearLayout.LayoutParams(dp(26), dp(26))
                    contentDescription = s("Save to Listen later", "Guardar en Escuchar después")
                    setOnClickListener {
                        showHintCard(s("Save to Listen later", "Guardar en Escuchar después"), s("“$title” will be saved in the Library to hear later.", "«$title» se guardará en la Biblioteca para escucharlo luego."), s("Save", "Guardar"), s("Not now", "Ahora no")) {
                            storeQueueSave(i); pokeOrWake("queuesaveitem")
                        }
                    }
                })
            }
            row.addView(TextView(this).apply {
                text = "✕"; setTextColor(c["muted"]!!); textSize = 12f; gravity = Gravity.CENTER
                layoutParams = LinearLayout.LayoutParams(dp(26), dp(26))
                // A drop ASKS first (Oscar, 1.4.201): the card
                // names the text, and only its answer drops it.
                setOnClickListener {
                    showHintCard(s("Remove from the queue", "Quitar de la cola"), s("“$title” will leave the line.", "«$title» saldrá de la fila."), s("Remove", "Quitar"), s("Not now", "Ahora no")) {
                        storeQueueDrop(i); pokeOrWake("queuedrop")
                    }
                }
            })
            rows.addView(row)
        }
        queueClearV?.visibility = View.VISIBLE
    }

    private fun syncQueueUi() {
        queueBadgeV?.text = if (panelQueueCount > 0) panelQueueCount.toString() else ""
        queueBadgeV?.visibility = if (panelQueueCount > 0) View.VISIBLE else View.INVISIBLE
        // The sheet's lever follows the page's truth (1.4.206) —
        // except across the breath after a hand flip, whose own
        // poke is still travelling: a stale push must not revert
        // what his finger just decided on the card.
        val lv = queueLeverV
        if (lv != null && lv.isChecked != panelQueueMode && System.currentTimeMillis() - queueLeverFlipAt > 3000) {
            lv.isChecked = panelQueueMode
        }
        if (queueListOpen) buildQueueRows()
    }

    /** The save key's question when a line stands (Oscar, 1.4.198):
     *  this text alone, or the whole line to Listen later? The card
     *  is the hint card's sibling — same veil, same face — with the
     *  two answers stacked, and Not now beneath them. */
    private fun showQueueSaveCard() {
        dismissSaveHint()
        val w = wm ?: return
        val c = cardPal()
        val scrim = View(this).apply {
            setBackgroundColor(if (panelLight) Color.argb(90, 62, 48, 28) else Color.argb(118, 10, 8, 5))
            alpha = 0f
        }
        runCatching {
            w.addView(scrim, WindowManager.LayoutParams(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE, PixelFormat.TRANSLUCENT))
        }
        saveHintScrim = scrim
        scrim.animate().alpha(1f).setDuration(220).start()
        val rim = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, intArrayOf(mixCol(c["gold"]!!, c["ink"]!!, 0.18f), mixCol(c["gold"]!!, c["bg2"]!!, 0.50f), mixCol(c["gold"]!!, c["bg2"]!!, 0.68f))).apply {
            cornerRadius = dp(21).toFloat()
        }
        val face = GradientDrawable().apply {
            setColor(mixCol(c["bg1"]!!, c["bg2"]!!, 0.3f))
            cornerRadius = dp(20).toFloat()
        }
        val stage = FrameLayout(this).apply {
            background = android.graphics.drawable.LayerDrawable(arrayOf(rim, face)).apply { setLayerInset(1, dp(1), dp(1), dp(1), dp(1)) }
            elevation = dp(10).toFloat()
        }
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(16), dp(18), dp(14))
        }
        card.addView(TextView(this).apply {
            text = s("Save", "Guardar")
            setTextColor(c["ink"]!!); textSize = 15f; typeface = Typeface.SERIF
            setTypeface(typeface, Typeface.BOLD)
        })
        card.addView(TextView(this).apply {
            text = s("A line of copied texts is standing. Save just what is playing, or send the whole line to Listen later?", "Hay una fila de textos copiados en pie. ¿Guardar solo lo que suena, o enviar toda la fila a Escuchar después?")
            setTextColor(c["muted"]!!); textSize = 12.5f
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(6) }
        })
        fun answerRow(label: String, deed: () -> Unit) = TextView(this).apply {
            text = label; setTextColor(c["gold"]!!); textSize = 13.5f; gravity = Gravity.CENTER_VERTICAL
            setTypeface(typeface, Typeface.BOLD)
            setPadding(dp(4), dp(10), dp(4), dp(10))
            setOnClickListener { dismissSaveHint(); deed() }
        }
        card.addView(answerRow(s("Just this text", "Solo este texto")) {
            val wasSaved = runCatching { JSONObject(nowJson).optBoolean("saved") }.getOrDefault(false)
            pokeOrWake("save")
            toastSavedWhenTrue(wasSaved)
        })
        card.addView(answerRow(s("The whole line, to Listen later", "Toda la fila, a Escuchar después")) {
            pokeOrWake("savequeue")
        })
        card.addView(TextView(this).apply {
            text = s("Not now", "Ahora no"); setTextColor(c["muted"]!!); textSize = 13f; gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(4), dp(8), dp(4), dp(2))
            setOnClickListener { dismissSaveHint() }
        })
        stage.addView(card, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT))
        val p = WindowManager.LayoutParams(dp(300), WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT).apply { gravity = Gravity.CENTER }
        runCatching { w.addView(stage, p) }
        saveHint = stage
        stage.scaleX = 0.90f; stage.scaleY = 0.90f; stage.alpha = 0f
        stage.animate().scaleX(1f).scaleY(1f).alpha(1f).setDuration(230).setInterpolator(DecelerateInterpolator()).start()
        val r = Runnable { dismissSaveHint() }
        saveHintRun = r
        handler.postDelayed(r, 9000)
    }

    /** A title-row disc key whose face is a DRAWN glyph (1.4.212): the
     * mark and save keys wear the same faces as the app — the bookmark
     * and the book-that-receives — drawn on the 24-grid the app's own
     * icons use, in the disc's gold, instead of text glyphs. The glyph
     * lambda receives the centre and the grid unit (the face spans
     * 56% of the disc). */
    private fun glyphDiscKey(desc: String, disc: Int, discLine: Int, glyph: (cv: android.graphics.Canvas, cx: Float, cy: Float, u: Float) -> Unit, act: () -> Unit): View {
        val v = object : View(this) {
            override fun onDraw(cv: android.graphics.Canvas) {
                super.onDraw(cv)
                glyph(cv, width / 2f, height / 2f, width * 0.56f / 24f)
            }
        }
        v.background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(disc); setStroke(dp(1), discLine) }
        v.contentDescription = desc
        v.setOnClickListener { act() }
        return v
    }

    private fun showHintCard(title: String, body: String, confirmLabel: String, cancelLabel: String, cancelAction: (() -> Unit)? = null, action: () -> Unit) {
        dismissSaveHint()
        val w = wm ?: return
        val c = cardPal()
        // The dimmed world (1.4.152, the direction Oscar picked): a warm
        // veil settles over everything behind the card, so the question
        // is asked in a hushed room. The veil takes no touches
        // (NOT_TOUCHABLE) — the panel beneath answers the finger exactly
        // as it did before the veil existed. Company, not a lock.
        val scrim = View(this).apply {
            setBackgroundColor(if (panelLight) Color.argb(90, 62, 48, 28) else Color.argb(118, 10, 8, 5))
            alpha = 0f
        }
        runCatching {
            w.addView(scrim, WindowManager.LayoutParams(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE, PixelFormat.TRANSLUCENT))
        }
        saveHintScrim = scrim
        scrim.animate().alpha(1f).setDuration(220).start()
        // The card under the Calibration Law (Oscar's Vela recipe,
        // 2.2.15, applied here at his word): separation is a band,
        // not a direction — the face is ONE family tone, flat; the
        // edge is a 1px stack (a hairline rim whose light lives only
        // at the top and dies down the sides, a whisper of top light
        // that dies inside the top band, a short shadow). What this
        // replaces: a diagonal rim blazing from the top-left corner
        // and a radial gold glow breathing over the top 96 dp — the
        // white wash across the card's top half that he diagnosed
        // in Vela («es la parte alta que tiene mucho blanco, el
        // difuminado») wearing this house's gold.
        val rim = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, intArrayOf(mixCol(c["gold"]!!, c["ink"]!!, 0.18f), mixCol(c["gold"]!!, c["bg2"]!!, 0.50f), mixCol(c["gold"]!!, c["bg2"]!!, 0.68f))).apply {
            cornerRadius = dp(21).toFloat()
        }
        val face = GradientDrawable().apply {
            setColor(mixCol(c["bg1"]!!, c["bg2"]!!, 0.3f))
            cornerRadius = dp(20).toFloat()
        }
        val stage = FrameLayout(this).apply {
            background = android.graphics.drawable.LayerDrawable(arrayOf(rim, face)).apply { setLayerInset(1, dp(1), dp(1), dp(1), dp(1)) }
            elevation = dp(10).toFloat()
        }
        val gold = c["gold"]!!
        val sheenV = View(this).apply {
            background = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, intArrayOf(Color.argb(26, Color.red(gold), Color.green(gold), Color.blue(gold)), Color.TRANSPARENT))
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, dp(30), Gravity.TOP)
        }
        stage.addView(sheenV)
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(16), dp(18), dp(14))
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
            setOnClickListener { dismissSaveHint(); cancelAction?.invoke() }
        })
        row.addView(TextView(this).apply {
            text = confirmLabel; setTextColor(c["gold"]!!); textSize = 13f; gravity = Gravity.CENTER
            setTypeface(typeface, Typeface.BOLD)
            setPadding(dp(12), dp(8), dp(4), dp(8))
            setOnClickListener { dismissSaveHint(); action() }
        })
        card.addView(row)
        stage.addView(card, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT))
        val p = WindowManager.LayoutParams(dp(300), WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT).apply { gravity = Gravity.CENTER }
        runCatching { w.addView(stage, p) }
        saveHint = stage
        // The arrival is one beat now: the object settles (a grow and
        // a fade on the house's decelerate). The lamp beat that used
        // to follow it died with the wash it lit.
        stage.scaleX = 0.90f; stage.scaleY = 0.90f; stage.alpha = 0f
        stage.animate().scaleX(1f).scaleY(1f).alpha(1f).setDuration(230).setInterpolator(DecelerateInterpolator()).start()
        val r = Runnable { dismissSaveHint() }
        saveHintRun = r
        handler.postDelayed(r, 9000)
    }

    /** The drum's judgment (1.4.207, Oscar's combination lock —
     *  the 205 speed card is retired: «¿Por qué no hacerlo de forma
     *  que se pueda correr como se corre los números en un candado
     *  con clave?»). DOWN takes the drum, seeding its step from the
     *  counter's witness when it stands unset; MOVE rolls it — each
     *  dp(26) of travel is one gear detent, up raising the rate and
     *  down lowering it, the loop unbroken (past 2× comes 0.75×);
     *  UP with no detent turned is a tap and nudges one step up. */
    private fun judgeWheelTouch(v: View, e: MotionEvent): Boolean {
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                wheelLive = true
                wheelDownY = e.y
                wheelStepsApplied = 0
                if (wheelIdx < 0) wheelIdx = wheelIndexFor(currentRateFromSub())
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                val want = ((wheelDownY - e.y) / dp(26).toFloat()).toInt()
                while (wheelStepsApplied < want) { wheelStepsApplied++; rollWheel(1) }
                while (wheelStepsApplied > want) { wheelStepsApplied--; rollWheel(-1) }
                return true
            }
            MotionEvent.ACTION_UP -> {
                if (wheelStepsApplied == 0) rollWheel(1)
                wheelLive = false
                return true
            }
            MotionEvent.ACTION_CANCEL -> { wheelLive = false; return true }
        }
        return false
    }

    /** One detent of the drum: the step turns (wrapping the loop),
     *  the new writing rolls into its window from the side it came,
     *  a tick sounds under the finger, and the rate applies live
     *  through the Bridge's absolute-rate door. */
    private fun rollWheel(dir: Int) {
        if (wheelIdx < 0) wheelIdx = wheelIndexFor(currentRateFromSub())
        wheelIdx = (wheelIdx + dir + wheelSteps.size) % wheelSteps.size
        val v = wheelSteps[wheelIdx]
        rateV?.let { rv ->
            rv.animate().cancel()
            rv.text = rateLabel(v)
            rv.translationY = dir * dp(7).toFloat()
            rv.alpha = 0.25f
            rv.animate().translationY(0f).alpha(1f).setDuration(110).start()
            rv.performHapticFeedback(android.view.HapticFeedbackConstants.CLOCK_TICK)
        }
        ratePick = v
        pokeOrWake("rate")
    }

    /** The wheel step nearest a rate the counter witnesses. */
    private fun wheelIndexFor(v: Double): Int {
        var best = 2; var bd = Double.MAX_VALUE
        for (i in wheelSteps.indices) { val d = kotlin.math.abs(wheelSteps[i] - v); if (d < bd) { bd = d; best = i } }
        return best
    }

    private fun rateLabel(v: Double): String = if (v == v.toInt().toDouble()) "${v.toInt()}×" else "$v×"

    /** The standing rate, read off the pushed sub-line's own writing
     *  («Sentence 5 of 10 · 1.1×») — the counter is the rate's home,
     *  so it is also its witness. -1 when the writing names none. */
    private fun currentRateFromSub(): Double {
        val sub = runCatching { JSONObject(nowJson).optString("sub") }.getOrDefault("")
        val m = Regex("""([0-9]+(?:\.[0-9]+)?)×""").find(sub) ?: return -1.0
        return m.groupValues[1].toDoubleOrNull() ?: -1.0
    }

    /** The lock explains itself, like every panel button: what it holds, and
     *  what letting go restores. (A hand paste inside the app itself was
     *  never the lock's business; the panel's Paste now key is gone since
     *  1.4.117 — catches arrive on their own.) */
    private fun showLockHint() {
        if (isLocked(this)) {
            showHintCard(s("Unlock the stage", "Desbloquear la escena"), s("Unlocked: a fresh copy will replace what is playing.", "Desbloqueada: una copia nueva reemplazará lo que suena."), s("Unlock", "Desbloquear"), s("Keep locked", "Dejar bloqueado")) {
                setLocked(this@BubbleService, false)
                lockBtn?.invalidate()
            }
        } else {
            showHintCard(s("Lock the stage", "Bloquear la escena"), s("Locked: a copied text won't replace what you're hearing. With the copy queue on, copies still line up and wait their turn.", "Bloqueada: un texto copiado no reemplazará lo que estás oyendo. Con la cola de copias encendida, las copias sí se forman y esperan su turno."), s("Lock", "Bloquear"), s("Not now", "Ahora no")) {
                setLocked(this@BubbleService, true)
                lockBtn?.invalidate()
            }
        }
    }

    /** The mark key asks where its mark would live (Oscar): on saved content it marks
     *  at once (a moment cannot wait for a card) and teaches itself a single
     *  time; on a text that is not in the Library it asks for the save
     *  first — and if he goes on anyway, he is advised first that the
     *  mark lasts only while this text is open or playing, and dies
     *  when the text is replaced (his ruling, 1.4.204 in the app,
     *  mirrored here in 1.4.205). */
    /** "Saved" is claimed only once the page's own state says so (1.4.108,
     *  audit E-1): the shell used to toast «Saved to Library» in the same
     *  tap that SENT the save poke — before the page had saved anything,
     *  and even when there was nothing to save. Now the confirm captures
     *  whether the text was already saved, and the toast fires only if
     *  the page's pushed state flips to saved afterwards. When it does
     *  not, silence — the page's own toast tells the reason in the app. */
    private fun toastSavedWhenTrue(wasSaved: Boolean) {
        if (wasSaved) return
        var fired = false
        for (delay in longArrayOf(900, 2200)) {
            handler.postDelayed({
                if (!fired && runCatching { JSONObject(nowJson).optBoolean("saved") }.getOrDefault(false)) {
                    fired = true
                    Toast.makeText(this, s("Saved to Library", "Guardado en Biblioteca"), Toast.LENGTH_SHORT).show()
                }
            }, delay)
        }
    }

    private fun showMarkHint() {
        val saved = runCatching { JSONObject(nowJson).optBoolean("saved") }.getOrDefault(false)
        if (saved) {
            pokeOrWake("mark")
            if (!prefs(this).getBoolean("markTaught", false)) {
                prefs(this).edit().putBoolean("markTaught", true).apply()
                showHintCard(s("The mark", "La marca"), s("It marks this moment. Find it in Library, under Saved Marks.", "Marca este momento. La encuentras en Biblioteca, en Marcas guardadas."), s("Got it", "Entendido"), "") { }
            }
        } else {
            showHintCard(s("Not in your Library yet", "Aún no está en tu Biblioteca"), s("Marks live with their text. Save this text to your Library first, and the mark stays with it.", "Las marcas viven con su texto. Guarda primero este texto en tu Biblioteca, y la marca se queda con él."), s("Save to Library", "Guardar en Biblioteca"), s("Not now", "Ahora no"), cancelAction = {
                showHintCard(s("Mark anyway?", "¿Marcar de todos modos?"), s("Without saving, this mark lasts only while this text is open or playing. When the text is replaced, the mark is lost.", "Sin guardar, esta marca dura solo mientras este texto esté abierto o sonando. Cuando el texto se reemplace, la marca se pierde."), s("Mark anyway", "Marcar de todos modos"), s("Cancel", "Cancelar")) {
                    pokeOrWake("mark")
                }
            }) {
                val wasSaved = runCatching { JSONObject(nowJson).optBoolean("saved") }.getOrDefault(false)
                pokeOrWake("save")
                toastSavedWhenTrue(wasSaved)
            }
        }
    }

    /** Removing the bubble asks first (1.4.117, Oscar): a small card, the
     *  deed one tap away, and the way back named — Settings always holds it. */
    private fun showHideHint() {
        showHintCard(s("Remove the bubble?", "¿Quitar la burbuja?"), s("You can always turn it back on in Settings.", "Puedes volver a activarla en Ajustes."), s("Remove", "Quitar"), s("Not now", "Ahora no")) {
            collapsePanel(); stopBubble()
        }
    }

    private fun dismissSaveHint() {
        saveHintRun?.let { handler.removeCallbacks(it) }; saveHintRun = null
        val v = saveHint; saveHint = null
        val veil = saveHintScrim; saveHintScrim = null
        // Leaving is quicker than arriving, and the two layers leave
        // together (1.4.152): the card folds a breath faster than the
        // veil lifts. The views are captured before the fields clear,
        // so a new card can be born while the old one is still fading.
        if (v != null) v.animate().alpha(0f).scaleX(0.96f).scaleY(0.96f).setDuration(130)
            .withEndAction { runCatching { wm?.removeView(v) } }.start()
        if (veil != null) veil.animate().alpha(0f).setDuration(160)
            .withEndAction { runCatching { wm?.removeView(veil) } }.start()
    }

    private fun collapsePanel(now: Boolean = false) {
        dismissSaveHint()
        hideNameTag()
        val v = panel
        panel = null; panelParams = null; titleV = null; subV = null; rateV = null; wheelIdx = -1; wheelLive = false; wheelStepsApplied = 0; toggleB = null; seekBar = null; seekHeld = false; spectrum = null; wordsV = null; gripV = null; lastWordsKey = ""; lastWi = -2; wordsScrollAnim?.cancel(); wordsScrollAnim = null; scrubTarget = -1; scrubMode = 0
        queueBtnV = null; queueBadgeV = null; queueListV = null; queueRowsV = null; queueHeadV = null; queueClearV = null; queueListOpen = false; queueLeverV = null
        // The shown-* diff memory describes these views (M-7): the
        // next panel is born blank, so its first refresh must paint
        // everything — the memory dies with the views it described.
        shownTitle = null; shownSub = null; shownPlaying = null; shownSeek = -1; shownBarsKey = null; shownLock = null; shownSubMode = false
        // The window is gone: the bubble takes its OWN opacity back
        // (1.4.197 — while the panel stood, it wore the panel's).
        bubble?.let { it.animate().cancel(); it.animate().alpha(awakeAlpha()).setDuration(160).start() }
        // The window takes its breathing room back (1.4.238): the
        // wide window and the full shadow return, reseated so the
        // jewel does not move. (A drag that collapsed the panel on
        // its first MOVE overwrites the seat with its own math in
        // the same event, so the drag never feels this.)
        applyLook()
        if (bubble != null) seatBubbleInCorner(false)
        if (!now && deliveries != lastDeliverySeen) {
            lastDeliverySeen = deliveries
            if (System.currentTimeMillis() - lastDeliveryAt < 20000) handler.postDelayed({ invite(2, force = true) }, 250)
        }
        if (v == null) return
        if (now) { runCatching { wm?.removeView(v) }; return }
        v.animate().alpha(0f).scaleX(0.93f).scaleY(0.93f).setDuration(120)
            .withEndAction { runCatching { wm?.removeView(v) } }.start()
    }

    /** The sentence is a handle (1.4.119, Oscar): slide the reading-along
     *  text sideways and the reading scrubs with it — right goes forward,
     *  left goes back — the progress bar following the finger live, one
     *  sentence per short step of travel, the seek landing when the finger
     *  lifts. Vertical drags keep their old job (the words still scroll);
     *  only a clearly horizontal slide is claimed, and the words themselves
     *  lean with the finger while it travels. */
    private fun attachSentenceScrub(wv: TextView) {
        wv.setOnTouchListener { v, ev ->
            when (ev.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    scrubX0 = ev.x; scrubY0 = ev.y; scrubMode = 0
                    false // the scroll method still anchors on the way in
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = ev.x - scrubX0; val dy = ev.y - scrubY0
                    if (scrubMode == 0) {
                        if (kotlin.math.abs(dx) > dp(10) && kotlin.math.abs(dx) > 1.5f * kotlin.math.abs(dy) && lastCt > 1 && lastCi >= 0) {
                            scrubMode = 1; scrubFrom = lastCi; scrubTarget = lastCi
                            seekHeld = true
                            wordsScrollAnim?.cancel()
                        } else if (kotlin.math.abs(dy) > dp(10)) scrubMode = 2
                    }
                    if (scrubMode == 1) {
                        val step = dp(26).coerceAtLeast(1)
                        val t = (scrubFrom + Math.round(dx / step)).coerceIn(0, lastCt - 1)
                        if (t != scrubTarget) {
                            scrubTarget = t
                            seekBar?.progress = (((t + 0.5) / lastCt) * 1000).toInt()
                            subV?.text = s("Sentence", "Oración") + " ${t + 1} " + s("of", "de") + " $lastCt"
                        }
                        v.translationX = (dx * 0.4f).coerceIn(-dp(60).toFloat(), dp(60).toFloat())
                        true
                    } else false
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    val was = scrubMode == 1
                    if (was) scrubCommit(v)
                    scrubMode = 0
                    was
                }
                else -> false
            }
        }
    }

    /** Land the sentence scrub through the same door the seek bar uses. */
    private fun scrubCommit(v: View) {
        val t = scrubTarget; val ct = lastCt
        scrubTarget = -1
        v.animate().translationX(0f).setDuration(140).start()
        seekHeld = false
        if (t >= 0 && ct > 0 && t != scrubFrom) {
            seekFrac = t.toDouble() / ct
            if (NativeSpeaker.active) NativeSpeaker.seekTo(seekFrac) else pokeSeekOrWake()
        }
        handler.postDelayed({ refreshPanel() }, 60)
    }

    /** The words zone: the neighbours dimmed, the sounding sentence alive —
     *  its said words in full ink, the word being spoken wearing the amber,
     *  the words still to come in muted — and the little window keeps that
     *  amber word centred, the way the reader does, so the reading is
     *  never out of sight while it sounds. */
    private fun updateWords(j: JSONObject?) {
        val wv = wordsV ?: return
        val tc = j?.optString("tc")?.trim().orEmpty()
        if (!wordsOn || tc.isEmpty()) {
            gripV?.visibility = View.GONE
            if (wv.visibility != View.GONE) { wv.visibility = View.GONE; wordsScrollAnim?.cancel(); panel?.post { positionPanel() } }
            lastWordsKey = ""; lastWi = -2
            return
        }
        val tp = j?.optString("tp")?.trim().orEmpty()
        val tn = j?.optString("tn")?.trim().orEmpty()
        val sentKey = tp + "" + tc + "" + tn
        val wi = j?.optInt("wi", -1) ?: -1
        val sentChanged = sentKey != lastWordsKey
        if (!sentChanged && wi == lastWi && wv.visibility == View.VISIBLE) return
        lastWordsKey = sentKey; lastWi = wi
        val c = pal()
        val ink = c["ink"]!!; val muted = c["muted"]!!; val goldC = c["gold"]!!
        val wordBg = if (panelFam == "tron") Color.argb(82, 245, 194, 10) else goldC
        val onGold = if (panelFam == "tron") ink else Color.rgb(26, 20, 12)
        val sb = SpannableStringBuilder()
        var wordOff = -1
        if (isTablet() && tp.isNotEmpty()) { val st = sb.length; sb.append(tp).append(" "); sb.setSpan(ForegroundColorSpan(muted), st, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE) }
        val words = tc.split(' ')
        // The word index is validated against the sentence the panel
        // itself is showing (M-8): a pushed wi that cannot belong to
        // this tc — counted by another segmentation, or arrived with
        // a foreign push — paints no amber rather than a wrong word.
        val wiE = if (wi >= words.size) -1 else wi
        var first = true
        for ((i, w) in words.withIndex()) {
            if (!first) sb.append(" ")
            first = false
            val st = sb.length
            sb.append(w)
            when {
                wiE < 0 || i < wiE -> sb.setSpan(ForegroundColorSpan(ink), st, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                i == wiE -> {
                    sb.setSpan(ForegroundColorSpan(onGold), st, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    sb.setSpan(android.text.style.BackgroundColorSpan(wordBg), st, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    wordOff = st
                }
                else -> sb.setSpan(ForegroundColorSpan(muted), st, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
        }
        if (isTablet() && tn.isNotEmpty()) { val s2 = sb.length; sb.append(" ").append(tn); sb.setSpan(ForegroundColorSpan(muted), s2, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE) }
        val wasGone = wv.visibility != View.VISIBLE
        wv.text = sb
        wv.visibility = View.VISIBLE
        // A panel that GROWS re-seats under the same law (1.4.222):
        // the words arriving can push a seated panel past the
        // screen's foot — the GONE road already re-seated; the
        // appearing road now does too.
        if (wasGone) panel?.post { positionPanel() }
        gripV?.visibility = View.VISIBLE
        if (sentChanged) {
            wv.animate().cancel()
            // The new sentence enters SQUARE (Oscar, 2026-11-11): the
            // cancel above also killed the scrub's lean-return, so a
            // scrubbed sentence stayed displaced — cut off by the
            // panel's edge, never centring. The lean belongs to the
            // gesture and dies with its sentence; the horizontal
            // scroll is pinned home in the same breath.
            wv.translationX = 0f
            if (wv.scrollX != 0) wv.scrollTo(0, wv.scrollY)
            wv.alpha = if (wasGone) 0f else 0.45f
            wv.animate().alpha(1f).setDuration(if (wasGone) 240 else 180).start()
        }
        val off = wordOff
        wv.post { if (off >= 0) centerWords(off) else if (sentChanged) centerWords(sb.length / 2) }
    }

    /** Keep the amber word in the middle of the little window. */
    private fun centerWords(offset: Int) {
        val wv = wordsV ?: return
        val lay = wv.layout ?: return
        if (offset < 0 || offset > (wv.text?.length ?: 0)) return
        val line = lay.getLineForOffset(offset)
        val top = lay.getLineTop(line); val bottom = lay.getLineBottom(line)
        val maxY = maxOf(0, lay.height - wv.height)
        val target = (top - (wv.height - (bottom - top)) / 2).coerceIn(0, maxY)
        wordsScrollAnim?.cancel()
        if (kotlin.math.abs(target - wv.scrollY) < 2) return
        wordsScrollAnim = ObjectAnimator.ofInt(wv, "scrollY", wv.scrollY, target).apply {
            duration = 220; interpolator = DecelerateInterpolator(); start()
        }
    }

    /** Honour a push's sentence coordinates only if they can belong
     *  to the panel's own session (M-8). The old adoption was absolute:
     *  any push's (ci, ct) became the scrub's arithmetic, so a stale or
     *  foreign push — the previous text's index, delivered late by a
     *  dying page or an in-flight bridge call — silently re-based the
     *  scrub onto a text the panel was no longer showing, and the seek
     *  it committed landed in the live session at a fraction computed
     *  from another text's counts. Now the index is validated before
     *  it is obeyed:
     *  · bounds — an index outside its own total cannot belong;
     *  · identity — a push claiming a different session (title or
     *  total changed) is a session change and is accepted as one,
     *  EXCEPT a push from any session this panel recently replaced,
     *  arriving within seconds of its displacement: that is a
     *  straggler, and its index is refused (the rest of the push —
     *  its playing bit, its title — still lands; only the
     *  coordinates are disbelieved);
     *  · same session, same index, different sentence — the push's
     *  index and its own text disagree with the sentence the panel
     *  holds at that index: foreign, refused;
     *  · a scrub in flight owns the counts until it commits — a push
     *  landing mid-gesture never re-bases the gesture's arithmetic;
     *  · one seat per driver (R4-T2-4): the judgement runs against
     *  the pushing driver's own seat, and the crown copies that seat
     *  whole — a takeover is not a displacement in either seat, and
     *  an index is never paired with the other segmentation's total.
     *  A refused index leaves the panel's last accepted coordinates
     *  standing: ignored, never obeyed. */
    private fun acceptIndex(j: JSONObject?, native: Boolean) {
        if (j == null) return
        if (scrubMode == 1 || scrubTarget >= 0) return
        val ct = j.optInt("ct", 0)
        val ci = j.optInt("ci", -1)
        if (ct <= 0 || ci < 0 || ci >= ct) return
        val seat = if (native) nativeSeat else pageSeat
        val key = j.optString("title") + "|" + ct
        val tc = j.optString("tc")
        if (key == seat.key) {
            if (ci == seat.ci && seat.tc.isNotEmpty() && tc.isNotEmpty() && tc != seat.tc) return
            seat.ci = ci
            seat.tp = j.optString("tp"); seat.tc = tc; seat.tn = j.optString("tn")
        } else {
            // Straggler judgement consults EVERY session this seat
            // recently replaced (R3-T2-6): an unrecognised key is
            // not crowned merely for being unrecognised — if this
            // seat displaced that session inside the window, the
            // push is a straggler from it, however many changes
            // stand between. Entries older than the window are
            // pruned as they are consulted. The judgement is the
            // seat's own (R4-T2-4): a takeover by the other driver
            // never enters this seat's replaced set, so neither
            // driver's pushes are stragglers for having been
            // interrupted by the other's stint.
            val nowMs = System.currentTimeMillis()
            val rit = seat.replaced.entries.iterator()
            while (rit.hasNext()) { if (nowMs - rit.next().value >= 10_000) rit.remove() }
            if (seat.replaced.containsKey(key)) return
            if (seat.key.isNotEmpty()) {
                // The displaced session joins the seat's replaced
                // set, most recent last; the set stays bounded (see
                // its declaration).
                seat.replaced.remove(seat.key)
                seat.replaced[seat.key] = nowMs
                while (seat.replaced.size > replacedSessCap) seat.replaced.remove(seat.replaced.keys.first())
            }
            seat.key = key
            seat.ct = ct; seat.ci = ci
            seat.tp = j.optString("tp"); seat.tc = tc; seat.tn = j.optString("tn")
        }
        // Crown the seat: this push's driver holds the stage
        // (refreshPanel feeds the device voice's panelJson only
        // while it drives, the page's pushes otherwise), so its
        // coordinates become the panel's working ones — index and
        // total always from the same segmentation.
        sessKey = seat.key
        lastCt = seat.ct; lastCi = seat.ci
        sessTp = seat.tp; sessTc = seat.tc; sessTn = seat.tn
    }

    private fun refreshPanel() {
        val rawJ = runCatching { JSONObject(nowJson) }.getOrNull()
        progressWatch(rawJ)
        // The copy queue's face (1.4.198) rides the page's push: the
        // count on the footer's key, the titles in its list.
        if (rawJ != null && rawJ.has("queue")) {
            panelQueueCount = rawJ.optInt("queue", 0)
            panelQueueCur = rawJ.optInt("qcur", -1)
            panelQueueMode = rawJ.optInt("qmode", 0) == 1
            queueModeSeen = panelQueueMode
            val arr = rawJ.optJSONArray("qt")
            panelQueueTitles = if (arr != null) (0 until arr.length()).map { arr.optString(it) } else emptyList()
            val karr = rawJ.optJSONArray("qk")
            panelQueueKinds = if (karr != null) (0 until karr.length()).map { karr.optInt(it) == 1 } else emptyList()
            handler.post { syncQueueUi() }
        }
        val native = NativeSpeaker.active
        val j = if (native) NativeSpeaker.panelJson() else rawJ
        // The scrub counts in sentences: remember where the reading stands,
        // in the driver's own numbers (page push or device voice alike) —
        // validated against the pushing driver's own seat first (M-8,
        // R4-T2-4).
        acceptIndex(j, native)
        val playing = j?.optBoolean("playing") ?: false
        handler.post {
            // Update in place, and only what changed (M-7): pushes
            // arrive several times a second while the voice sounds,
            // and the old refresh re-set every view on every one —
            // the toggle's image reloaded (its pressed answer reset
            // under his finger), the title and status re-laid-out,
            // the seek thumb re-seated — a full panel pass per
            // sentence and per word, most of it writing the values
            // already on screen. Now each display value is computed
            // and compared with what the panel already shows; only a
            // difference touches a view, and a push that changes
            // nothing mutates nothing. (updateWords has always kept
            // its own diff — lastWordsKey/lastWi — and keeps it.)
            val title = j?.optString("title")?.ifBlank { "Logos" } ?: "Logos"
            // (A value is only remembered as shown when a living view
            // actually received it — refreshes also run with the
            // panel closed, and a newborn panel must paint in full.)
            if (title != shownTitle) titleV?.let { it.text = title; shownTitle = title }
            if (!native && workingNow(j)) armStallWatch() else disarmStallWatch()
            var sub = if (native) j?.optString("sub")
                else if (workingNow(j) && System.currentTimeMillis() - nowAt > 20_000) s("Waiting for Logos…", "Esperando a Logos…")
                else if (j?.optBoolean("busy") == true) s("Processing…", "Procesando…")
                else j?.optString("sub")?.ifBlank { s("Ready", "Listo") } ?: s("Ready", "Listo")
            if (scrubTarget >= 0 && lastCt > 0) sub = s("Sentence", "Oración") + " ${scrubTarget + 1} " + s("of", "de") + " $lastCt"
            arrangeTransport()
            // The sub-line's two shapes (1.4.207): as the row stands,
            // the counter carries the page's whole writing, rate and
            // all. In the queue shape the rate leaves the writing and
            // stands on the drum at the line's end — subV keeps the
            // counting half, rateV the rate. shownSub keeps the page's
            // own writing, so the diff stays honest; while a hand is
            // on the drum (wheelLive) pushes never repaint it — the
            // drum is showing the hand's own rolling.
            // 1.4.242 (Oscar, the same night the lock starved his
            // queue): the rate stands on the drum in BOTH shapes —
            // the «1×» was dead text in the normal shape, at the
            // very seat where the drum lives in the queue shape,
            // and the rate is the rate in either. His word: make it
            // work from there too, WITHOUT removing the − and +
            // keys — they stay, both roads stepping the same rate.
            // 1.4.221 (Oscar's find): the line is remembered as shown
            // ONLY when a living view received it — the title's own
            // discipline, which this block alone had skipped. It used
            // to record shownSub on every push even with the panel
            // closed, so a panel born mid-reading stood with its
            // counter line empty until the sentence changed; only
            // dragging the seek bar painted it, the scrub writing the
            // line by hand. Now a closed panel remembers nothing, and
            // the newborn panel paints in full at its first refresh.
            if (sub != shownSub || transportQueueMode != shownSubMode) {
                val sv = subV
                if (sv != null) {
                    shownSub = sub; shownSubMode = transportQueueMode
                    val subW = sub ?: ""
                    val sep = subW.lastIndexOf(" · ")
                    val rateTxt = if (sep >= 0) subW.substring(sep + 3) else ""
                    val rateVal = rateTxt.dropLast(1).toDoubleOrNull()
                    val hasRate = rateTxt.endsWith("×") && rateVal != null
                    sv.text = if (hasRate) subW.substring(0, sep) else sub
                    rateV?.let { rv ->
                        rv.visibility = if (hasRate) View.VISIBLE else View.GONE
                        if (hasRate && !wheelLive) {
                            rv.text = rateTxt
                            wheelIdx = wheelIndexFor(rateVal!!)
                        }
                    }
                }
            }
            val locked = isLocked(this@BubbleService)
            if (locked != shownLock) lockBtn?.let { it.invalidate(); shownLock = locked }
            if (playing != shownPlaying && toggleB != null) {
                shownPlaying = playing
                if (playing) {
                    toggleB?.setImageResource(android.R.drawable.ic_media_pause)
                    toggleB?.setPadding(0, 0, 0, 0)
                } else {
                    toggleB?.setImageResource(android.R.drawable.ic_media_play)
                    // The play triangle leans left inside its disc
                    // (1.4.179, Oscar: «biased towards the left, not
                    // totally centered»). Measured on his own
                    // screenshot: the disc sits dead center of the
                    // panel — it is the glyph whose mass hangs left of
                    // the disc's middle, as a right-pointing triangle's
                    // does. The image is nudged right inside the disc
                    // (paddingStart 6dp shifts it 3dp); the pause bars
                    // are symmetric and take no nudge.
                    toggleB?.setPadding(dp(6), 0, 0, 0)
                }
            }
            playingNow = playing
            val prog = ((j?.optDouble("frac", 0.0) ?: 0.0) * 1000).toInt()
            if (!seekHeld && prog != shownSeek) seekBar?.let { it.progress = prog; shownSeek = prog }
            spectrum?.let { sp ->
                val arr = j?.optJSONArray("bars")
                val barsKey = arr?.toString() ?: "∅"
                if (barsKey != shownBarsKey) {
                    shownBarsKey = barsKey
                    if (arr == null) sp.rest()
                    else {
                        val t = FloatArray(arr.length())
                        for (i in 0 until arr.length()) t[i] = (arr.optDouble(i, 0.0) / 100.0).toFloat()
                        sp.setTargets(t)
                    }
                }
            }
            wordsOn = j?.optBoolean("words", true) ?: true
            updateWords(j)
            val h = halo
            if (playing && h != null) {
                stopBreath()
                if (haloAnim == null) {
                    h.visibility = View.VISIBLE
                    haloAnim = ObjectAnimator.ofFloat(h, "alpha", 0.25f, 0.85f).apply {
                        duration = 1100; repeatMode = ValueAnimator.REVERSE; repeatCount = ValueAnimator.INFINITE; start()
                    }
                }
            } else if (h != null) {
                // Idle no longer means invisible (1.4.220): the pulse
                // rests and the breath takes the halo.
                if (haloAnim != null) { haloAnim?.cancel(); haloAnim = null }
                startBreath()
            }
        }
    }

    /** The guaranteed floor of a hand ask (1.4.162): if neither the
     *  panel nor the blink could read within a second, open Logos —
     *  the page, in front and focused, reads the clipboard itself
     *  (wantClip tells it this was asked by hand). Armed per manual
     *  ask, including one that joins a blink already in flight
     *  (T2-18). */
    private fun armManualFloor() {
        val before = deliveries
        handler.postDelayed({
            if (deliveries == before) {
                wantClip = true
                noteTry(this, s("opened Logos to read it", "abrió Logos para leerlo"))
                runCatching { startActivity(Intent(this, MainActivity::class.java).setAction(Intent.ACTION_MAIN).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
            }
        }, 1000)
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
        if (!manual && now - lastTrampoline < 2500) { noteTry(this, s("the panel saw the clipboard empty", "el panel vio el portapapeles vacío")); return }
        // One blink in flight (T2-18): a read that arrives while a
        // blink is outstanding does not launch a second one and
        // does not overwrite the outstanding ask's character. A
        // manual ask JOINS the flight and upgrades it — the blink
        // reads the same clipboard for both asks, and his hand ask
        // must keep its guaranteed floor; an automatic ask joins
        // silently and can never downgrade a manual flight.
        if (blinkInFlight && now - blinkAt < 5_000) {
            if (manual) { pendingManual = true; armManualFloor() }
            return
        }
        lastTrampoline = now
        blinkInFlight = true
        blinkAt = now
        pendingManual = manual
        if (manual) armManualFloor()
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
            blinkInFlight = false // no blink is coming; the next read may launch one (T2-18)
            if (manual) Toast.makeText(this, s("Couldn't read the clipboard here", "No se pudo leer el portapapeles aquí"), Toast.LENGTH_SHORT).show()
        }
    }

    override fun onDestroy() {
        NativeSpeaker.shutdown()
        // The house is gone; its page dies with it (1.4.128) — a
        // parentless page would keep speaking with no switch left.
        Backstage.evictAndDestroy()
        releaseWakeLock()
        retireHoldFile(this)
        hideTargets()
        // The hint card and its veil die with the house, instantly —
        // a dimmed world must never outlive the bubble (1.4.152).
        saveHint?.let { runCatching { wm?.removeView(it) } }; saveHint = null
        hideNameTag()
        saveHintScrim?.let { runCatching { wm?.removeView(it) } }; saveHintScrim = null
        collapsePanel(now = true)
        bubble?.let { runCatching { wm?.removeView(it) } }
        bubble = null
        bubbleFaceV = null
        bubbleLambdaV = null
        haloAnim?.cancel()
        breathAnim?.cancel(); breathAnim = null
        if (onNow != null) onNow = null
        if (lookHook != null) lookHook = null
        running = false
        super.onDestroy()
    }
}
