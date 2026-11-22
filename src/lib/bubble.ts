// The floating bubble (Logos app, shell android-18+): a small λ that hovers over
// other apps with play / previous / next, and — when its lever is on — plays what
// Oscar just copied. Android only lets an app read the clipboard while one of its
// windows holds the focus, so the reading happens at the tap on the bubble (or on
// arriving in Logos, when the app is in front). What it plays replaces what was
// playing, always with an Undo, so no text is ever lost to it.
import { settings, saveLastText } from './settings.ts'
import { drafts } from './drafts.ts'
import { listen, loadText, play, pauseFromShell, endSession, stepRate, setRate, seek, seekFraction, seekToMs, refreshVoices, voiceFor, sentenceProgress, wordClock, levels, registerTrackSkip } from '../player/listen.ts'
import { queue, queueItems, currentItem, currentIndex, enqueue, enqueueFront, enqueueRef, noteStagedKey, setCurrent, removeItem as queueRemove, clearQueue, type QueueItem } from './queue.ts'
import { alignWords, wordAtTime } from '../player/wordsync.ts'
import { cancelDevice } from '../engine/device-voice.ts'
import { readClipboard } from './clipboard.ts'
import { describeText } from './describe.ts'
import { detectLang } from './text.ts'
import { VOICES, favoriteVoices } from './voices.ts'
import { nowReadingFor } from './book/nowreading.ts'
import { markAndToast, marksEpoch, textKey } from './marks.ts'
import { saveForLater, library, getClipBlob, getClip, kindOf, updateClip, type ClipMeta } from './library.ts'
import { books, getBook, getContent } from './books.ts'
import { playBook } from './book/playbook.ts'
import { t } from './i18n.ts'
import { playClip, clipPlayer, pauseClip, resumeClip, seekClip, onClipEnded } from '../player/clip.ts'
import { loadSessionResume } from './resume.ts'
import { estimateSeconds } from './text.ts'
import { toast, confirmAsk } from '../components/ui.tsx'

type DroidBubble = {
  bubbleState?: () => string
  bubble?: (on: boolean) => void
  bubblePermission?: () => void
  bubblePrefs?: (auto: boolean) => void
  bubbleLook?: (json: string) => void
  bubbleAuto?: () => boolean
  bubbleNow?: (json: string) => void
  bubbleClip?: () => string
  bubbleWantClip?: () => boolean
  bubbleSeek?: () => string
  bubbleRate?: () => string
  bubblePasteFront?: () => string
  bubbleSeekCtx?: () => string
  bubbleSeekTo?: () => string
  bubbleSeekToCtx?: () => string
  bubbleQueuePlay?: () => string
  bubbleQueuePlayCtx?: () => string
  bubbleQueueDrop?: () => string
  bubbleQueueDropCtx?: () => string
  bubbleQueueSave?: () => string
  bubbleQueueSaveCtx?: () => string
  bubblePendingCmd?: () => string
  bubblePendingCtx?: () => string
  bubbleNative?: (text: string, title: string, idx: number) => void
  bubbleNativeStop?: () => void
  bubbleLock?: () => boolean
}
const droid = () => (window as unknown as { LogosAndroid?: DroidBubble }).LogosAndroid

/** True only in the Logos app with a shell new enough to carry the bubble. */
export const bubbleSupported = () => typeof droid()?.bubbleState === 'function'


export type BubbleNativeState = { permission: boolean; running: boolean; last?: string }
export function bubbleNativeState(): BubbleNativeState | null {
  try {
    const raw = droid()?.bubbleState?.()
    return raw ? (JSON.parse(raw) as BubbleNativeState) : null
  } catch { return null }
}
export function setBubble(on: boolean) {
  try { droid()?.bubble?.(on) } catch { /* old shell */ }
  settings.set({ bubbleOn: on })
}
export function openBubblePermission() {
  try { droid()?.bubblePermission?.() } catch { /* old shell */ }
}

// Clipboard dedupe fingerprint (cure F8-1/T2-1): the old key was
// length + first 48 + last 48 chars, so two same-length texts sharing
// head and tail but edited in the middle collided — a corrected re-copy
// was judged "already seen" and never played, and its resume card was
// lost with it. This key fingerprints the WHOLE text: length plus two
// independent full-string hashes (cyrb53 under two seeds), so any
// middle edit changes the key while identical texts keep the same one.
// Persisted state: `logos.bubble.lastClip` may still hold an old-format
// key after upgrade; it simply never matches a new key, so the standing
// clip may be delivered at most once more — accepted, no migration.
const clipHash = (t: string, seed: number) => {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < t.length; i++) {
    const ch = t.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}
export const clipKey = (t: string) => `${t.length}:${clipHash(t, 0)}:${clipHash(t, 1)}`
const fmtRate = (r: number) => `${Math.round(r * 100) / 100}×`
const fmtClock = (sec: number) => { const v = isFinite(sec) && sec > 0 ? sec : 0; return `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}` }
let lastClip = (() => { try { return localStorage.getItem('logos.bubble.lastClip') ?? '' } catch { return '' } })()
// The replace question (Oscar, 1.4.192): while it stands open, later
// arrivals wait outside — the question names the copy that opened it,
// and the next arrival after his answer reads the clipboard afresh.
let clipAskOpen = false
function seenClip(t: string) {
  lastClip = clipKey(t)
  try { localStorage.setItem('logos.bubble.lastClip', lastClip) } catch { /* ignore */ }
}

// Return-to-book (Oscar's ask): a clip that interrupts a session leaves a card
// behind; when the clip ENDS, what was interrupted resumes where it was — the
// interruption heals itself. A second clip keeps the original card; anything
// Oscar loads by hand cancels it.
type ResumeCard = { text: string; idx: number; title: string; draftOnly?: boolean; stage?: string }
let resumeCard: ResumeCard | null = (() => { try { return JSON.parse(localStorage.getItem('logos.bubble.resume') ?? 'null') as ResumeCard | null } catch { return null } })()
let stageKey = ''
function saveResume() {
  try {
    if (resumeCard) localStorage.setItem('logos.bubble.resume', JSON.stringify(resumeCard))
    else localStorage.removeItem('logos.bubble.resume')
  } catch { /* ignore */ }
}
// The card is persisted; its trigger must survive the same night
// (cure R2-T1-5). The card carries the key of the text that took the
// stage (`stage`, stamped in playClipboardText below); on load the
// stage is real only while the box still holds that text — the clip
// session dies with the page, and a card whose stage is gone would
// otherwise squat on the slot forever: its watcher could never fire
// (stageKey was memory-only, '' after every reload) and its standing
// presence blocked the F8-8 draft leg from ever leaving a card again.
// A card persisted before the stamp existed is judged by the same
// witness: a box holding a text that is not the card's own is its
// stage; a box holding the card's own text — or nothing — means the
// interruption is over or unknowable, and the card retires.
if (resumeCard) {
  const box = drafts.get().listen
  const boxKey = box.trim() ? clipKey(box) : ''
  if (resumeCard.stage) {
    if (boxKey === resumeCard.stage) stageKey = resumeCard.stage
    else { resumeCard = null; saveResume() }
  } else if (boxKey && boxKey !== clipKey(resumeCard.text)) {
    resumeCard.stage = boxKey
    stageKey = boxKey
    saveResume()
  } else {
    resumeCard = null
    saveResume()
  }
}
const sessionTitle = (text: string) => nowReadingFor(text)?.title || describeText(text.slice(0, 12000), detectLang(text.slice(0, 2000)).lang).title || 'your text'

/** A clipboard text takes the stage: it replaces what was playing, with an Undo. */
export function playClipboardText(raw: string) {
  const text = raw.trim()
  if (!text) return
  const s0 = listen.get()
  if (s0.active && clipKey(s0.text) !== clipKey(text) && clipKey(s0.text) !== stageKey) {
    resumeCard = { text: s0.text, idx: s0.current, title: sessionTitle(s0.text) }
    saveResume()
  }
  // F8-8 completion: a typed-but-never-played draft had no card — the
  // Undo toast was its only way back, and a missed toast lost it for
  // good. An evicted draft that is not the live session leaves the
  // same persisted card, marked draftOnly: when the clip finishes, the
  // draft is restored (loaded, not played — it was never playing).
  // A card already standing is never overwritten (the standing rule).
  if (!resumeCard && !s0.active) {
    const prev = drafts.get().listen
    if (prev.trim() && prev.trim() !== text) {
      resumeCard = { text: prev, idx: 0, title: sessionTitle(prev), draftOnly: true }
      saveResume()
    }
  }
  stageKey = clipKey(text)
  // The standing card's trigger is the stage's current occupant
  // (cure R2-T1-5): stamp it onto the card, so the card and its
  // trigger persist — and are judged — together after a reload.
  if (resumeCard && resumeCard.stage !== stageKey) { resumeCard.stage = stageKey; saveResume() }
  seenClip(text)
  const prevText = drafts.get().listen
  // Cure F8-8: the Undo used to restore only the draft TEXT — the
  // interrupted session and its place in it were gone, so "recovery"
  // meant starting the old text over from the top. Snapshot the live
  // session before the clip takes the stage; Undo puts back the draft
  // AND that session, at its sentence, playing if it was playing. The
  // return-to-book card is retired by an Undo: the interruption it
  // was healing has been undone by hand.
  const snap = s0.active ? { text: s0.text, idx: s0.current, playing: s0.playing } : null
  drafts.set({ listen: text })
  saveLastText(text)
  if (listen.get().active) endSession()
  loadText(text)
  dispatchEvent(new Event('logos-bubble-clip'))
  void play()
  if ((prevText.trim() && prevText.trim() !== text) || snap) {
    toast(t('Playing what you copied'), {
      label: t('Undo'),
      run: () => {
        drafts.set({ listen: prevText })
        saveLastText(prevText)
        stageKey = ''; resumeCard = null; saveResume()
        if (listen.get().active) endSession()
        const back = snap && snap.text !== text ? snap.text : prevText
        if (back.trim()) {
          loadText(back)
          if (snap && back === snap.text) {
            if (snap.idx > 0) seek(snap.idx)
            if (snap.playing) void play(snap.idx)
          }
        }
      },
    }, 10000) // F8-8: the recovery window is ten seconds now, and the
    // persisted draft card stands behind it — a missed toast is no
    // longer a permanent loss.
  } else {
    toast(t('Playing what you copied'), undefined, 3000)
  }
}

/* ── The copy queue (Oscar, 1.4.198) ─────────────────────────────
 * With the mode on, a copied text lines up instead of taking the
 * stage: the first one plays, each next one starts when the one
 * before it ends, and next/previous travel the line. The record
 * lives in queue.ts; everything that ACTS on it lives here, beside
 * the clipboard roads it extends. */

/** A queued text takes the stage — quietly: no Undo toast, no
 *  resume card. The line itself is the memory of where it came
 *  from and where it goes next. */
export function playQueuedText(raw: string) {
  const text = raw.trim()
  if (!text) return
  seenClip(text)
  drafts.set({ listen: text })
  saveLastText(text)
  if (listen.get().active) endSession()
  loadText(text)
  dispatchEvent(new Event('logos-bubble-clip'))
  void play()
}

function playQueueItem(item: QueueItem) {
  setCurrent(item.id)
  if (item.kind === 'book') { void playQueuedBook(item); return }
  if (item.kind === 'audio') { void playQueuedClip(item); return }
  playQueuedText(item.text)
}

/**
 * A queued book takes the stage (1.4.229): the book road itself —
 * the whole book as one session, opening at its own saved place
 * (a finished book starts over), its progress writing back to the
 * shelf as it plays. Once the session stands, the item's key is
 * re-noted with the staged text's key, so the finish judge below
 * steps the line when the book ends. A book that has vanished
 * from the shelf, or holds no words, is stepped over — the line
 * never stalls on a ghost.
 */
async function playQueuedBook(item: QueueItem) {
  const meta = await getBook(item.ref)
  const content = meta ? await getContent(item.ref) : null
  const hasText = !!content?.chapters.some((c) => c.blocks.some((b) => b.t.trim()))
  if (!meta || !hasText) { stepQueue(1, true); return }
  if (clipPlayer.get().playing) pauseClip()
  await playBook(meta, { pos: meta.done ? { ch: 0, b: 0 } : meta.pos })
  const staged = listen.get().text
  if (staged) noteStagedKey(item.id, textKey(staged))
}

/**
 * A queued recording takes the stage (1.4.229): the Library's own
 * play road — from where it was left, a finished one from the
 * top, its done flag cleared as the Library clears it. The
 * session yields the stage first. A recording whose file has
 * vanished is stepped over.
 */
async function playQueuedClip(item: QueueItem) {
  const full = await getClip(item.ref)
  if (!full?.blob) { stepQueue(1, true); return }
  if (listen.get().active) endSession()
  void playClip(`clip:${item.ref}`, full.blob, { title: item.title, artist: `Logos · ${t('Library')}` }, full.done ? 0 : full.pos ?? 0)
  if (full.done) void updateClip(item.ref, { done: false }, false)
}

/** One step along the line. Past the end a hand press is claimed
 *  but does nothing — the press was for the line, not for a
 *  sentence — while the finish judge clears the stage's claim and
 *  lets the last item park, as any finished reading does. */
export function stepQueue(dir: 1 | -1, auto = false): boolean {
  const items = queueItems()
  const idx = currentIndex()
  if (idx < 0) return false
  const nextIdx = idx + dir
  if (nextIdx < 0) { playQueueItem(items[idx]); return true }
  if (nextIdx >= items.length) {
    if (auto) setCurrent(null)
    return true
  }
  playQueueItem(items[nextIdx])
  return true
}

registerTrackSkip((dir) => {
  if (!settings.get().copyQueue) return false
  if (currentIndex() < 0) return false
  return stepQueue(dir)
})

/** A copy arrives while the mode is on: it joins the line. It
 *  starts at once only when the stage is free — nothing loaded, the
 *  last thing finished, no recording sounding. Copying what is
 *  already playing, or the line's own tail, adds nothing. Returns
 *  true when the queue took the arrival (the mode is on). */
export function queueArrival(raw: string): boolean {
  if (!settings.get().copyQueue) return false
  const text = raw.trim()
  if (!text) return true
  seenClip(text)
  const key = textKey(text)
  const s = listen.get()
  if (s.active && textKey(s.text) === key) return true
  if (currentItem()?.key === key) return true
  const item = enqueue(text, sessionTitle(text), estimateSeconds(text, 1))
  if (!item) { toast(t('Already in the queue'), undefined, 2500); return true }
  const cp = clipPlayer.get()
  const clipBusy = !!cp.key && !cp.key.startsWith('preview:') && cp.playing
  const idle = !clipBusy && (!s.active || s.finished)
  if (!currentItem() && idle) playQueueItem(item)
  else toast(t('Added to the queue · {n} in line', { n: queueItems().length }), undefined, 2500)
  return true
}

/** The hand paste's second deed (Oscar, 1.4.206): with the mode on,
 *  Paste now no longer lines a copy up at the tail — behind its
 *  confirmation card in the panel, the fresh copy takes the FRONT
 *  of the line and the stage with it, substituting the line's
 *  standing current (it leaves the line; the rest keep their order
 *  behind the new head). Re-pasting the very text on stage simply
 *  plays it again from the top. A lone session on stage — not the
 *  line's — is replaced by the play, as any hand paste replaces.
 *  Returns true when the front road took the arrival. */
export function queueFrontArrival(raw: string): boolean {
  if (!settings.get().copyQueue) return false
  const text = raw.trim()
  if (!text) return true
  seenClip(text)
  const key = textKey(text)
  const cur = currentItem()
  if (cur && cur.key === key) { playQueueItem(cur); return true }
  const item = enqueueFront(text, sessionTitle(text), estimateSeconds(text, 1))
  if (cur) queueRemove(cur.id)
  playQueueItem(item)
  return true
}

/** The Library doors into the line (Oscar, 1.4.229): «Add to the
 *  queue» in a book's or a file's menu. The deed turns the queue
 *  mode on when it stands off — a line that is not registering is
 *  no line to join — then lines the resident up behind whatever
 *  waits, and starts it at once only when the stage is free, the
 *  same courtesy a copy receives. */
function ensureLineMode() {
  if (!settings.get().copyQueue) settings.set({ copyQueue: true })
}

function lineUp(item: QueueItem | null) {
  if (!item) { toast(t('Already in the queue'), undefined, 2500); return }
  const cp = clipPlayer.get()
  const clipBusy = !!cp.key && !cp.key.startsWith('preview:') && cp.playing
  const s = listen.get()
  const idle = !clipBusy && (!s.active || s.finished)
  if (!currentItem() && idle) playQueueItem(item)
  else toast(t('Added to the queue · {n} in line', { n: queueItems().length }), undefined, 2500)
}

export async function queueBookById(id: string) {
  ensureLineMode()
  const meta = await getBook(id)
  if (!meta) return
  const content = await getContent(id)
  const chapters = content?.chapters ?? []
  if (!chapters.length) return
  // The estimate covers what will actually play: from the book's
  // saved place to its end — a finished book, from its start.
  const from = meta.done ? { ch: 0, b: 0 } : meta.pos
  const parts: string[] = []
  for (let c = Math.min(from.ch, chapters.length - 1); c < chapters.length; c++) {
    const blocks = chapters[c].blocks
    for (let i = c === from.ch ? Math.min(from.b, blocks.length) : 0; i < blocks.length; i++) parts.push(blocks[i].t)
  }
  lineUp(enqueueRef('book', id, meta.title, estimateSeconds(parts.join('\n\n'), 1), `book:${id}`))
}

export function queueClipItem(clip: ClipMeta) {
  ensureLineMode()
  if (kindOf(clip) === 'text' && clip.text) {
    lineUp(enqueue(clip.text, clip.title, estimateSeconds(clip.text, 1)))
  } else {
    lineUp(enqueueRef('audio', clip.id, clip.title, clip.duration ?? 0, `clip:${clip.id}`))
  }
}

/** Send the whole line to the Library's Listen later, in order —
 *  and the line empties: its texts live there now. */
export async function sendQueueToLater() {
  const items = queueItems()
  if (!items.length) return
  // Only the copies move house (1.4.229): books and recordings in
  // the line already live in the Library — sending them to Listen
  // later would duplicate them as homeless texts. The line still
  // empties whole; the residents simply go home.
  const copies = items.filter((it) => it.kind === 'copy')
  for (const it of copies) {
    const lang = detectLang(it.text.slice(0, 2000)).lang
    const info = describeText(it.text.slice(0, 12000), lang)
    await saveForLater(it.text, { title: info.title || it.title || t('Copied text'), summary: info.summary, lang, voice: '', duration: it.secs })
  }
  clearQueue()
  if (copies.length) toast(t('{n} texts are waiting in Listen later', { n: copies.length }), undefined, 3500)
}

/** Save one lined-up text to Listen later; it keeps its place in
 *  the line — saving was never a removal. */
export async function saveQueueItemToLater(item: QueueItem) {
  if (item.kind !== 'copy') return
  const lang = detectLang(item.text.slice(0, 2000)).lang
  const info = describeText(item.text.slice(0, 12000), lang)
  await saveForLater(item.text, { title: info.title || item.title || t('Copied text'), summary: info.summary, lang, voice: '', duration: item.secs })
  toast(t('Saved to Listen later'), undefined, 2500)
}

export function playQueueAt(idx: number) {
  const item = queueItems()[idx]
  if (item) playQueueItem(item)
}
export function dropQueueAt(idx: number) {
  const item = queueItems()[idx]
  if (item) queueRemove(item.id)
}

/* The Listen-later chain: the Library's saved texts, played in
 * order like a playlist. The chain is a visit, not a record — it
 * lives in memory and ends when the list does. */
let laterChain: { ids: string[]; idx: number } | null = null
let laterKey = ''
export function playLaterChain(ids: string[], startId: string) {
  if (!ids.length) return
  laterChain = { ids, idx: Math.max(0, ids.indexOf(startId)) }
  playLaterAt(laterChain.idx)
}
function playLaterAt(idx: number) {
  const chain = laterChain
  if (!chain) return
  const clip = library.get().clips.find((c) => c.id === chain.ids[idx])
  if (!clip?.text) { laterChain = null; laterKey = ''; return }
  chain.idx = idx
  laterKey = textKey(clip.text)
  playQueuedText(clip.text)
}
function advanceLater() {
  const chain = laterChain
  if (!chain) return
  if (chain.idx + 1 < chain.ids.length) playLaterAt(chain.idx + 1)
  else { laterChain = null; laterKey = '' }
}

/* One finish judge for both lines (1.4.198): when a session ends,
 * who speaks next? The later chain first (it is a visit Oscar
 * started by hand), then the copy queue — unless a resume card
 * stands, whose promise outranks the line, or the mode has been
 * turned off since. A queue that waited behind a lone session
 * starts when that session ends: the copies were made to be heard. */
let finPrev = false
listen.subscribe(() => {
  const s = listen.get()
  const fin = !!(s.active && s.finished)
  const was = finPrev
  finPrev = fin
  if (!fin || was) return
  const key = textKey(s.text)
  if (laterChain && laterKey === key) { advanceLater(); return }
  if (!settings.get().copyQueue) return
  if (resumeCard) return
  const st = queue.get()
  const cur = currentItem()
  if (cur && cur.key === key) { stepQueue(1, true); return }
  if (st.orphanKey && st.orphanKey === key) {
    if (cur) playQueueItem(cur)
    else setCurrent(null)
    return
  }
  if (!cur && st.items.length) playQueueItem(st.items[0])
})

/* The line's second finish judge (1.4.229): a recording's end is
 * heard here, as a reading's end is heard above. When the clip
 * that ends is the line's standing recording, the line steps; when
 * it is an orphan — the current recording removed mid-play — the
 * successor takes the stage, the same judgment the text road makes. */
onClipEnded((key) => {
  if (!key || !settings.get().copyQueue) return
  const st = queue.get()
  const cur = currentItem()
  if (cur && cur.kind === 'audio' && key === `clip:${cur.ref}`) { stepQueue(1, true); return }
  if (st.orphanKey && st.orphanKey === key) {
    if (cur) playQueueItem(cur)
    else setCurrent(null)
  }
})

/* The mode's own law (Oscar): turning it off erases the record. */
let queueModeWas = settings.get().copyQueue
settings.subscribe(() => {
  const on = settings.get().copyQueue
  if (queueModeWas && !on) clearQueue()
  queueModeWas = on
})

let inited = false
export function initBubble() {
  // The stage journal: every move the playhead makes, with the clock and the
  // mode, kept in a small ring. If the panel and the app ever disagree
  // again, Settings shows exactly how the position travelled.
  let jPrev = -1
  listen.subscribe(() => {
    const s = listen.get()
    if (s.current === jPrev) return
    const from = jPrev
    jPrev = s.current
    if (from < 0 || !s.active) return
    try {
      const key = 'logos.stage.journal'
      const arr = JSON.parse(localStorage.getItem(key) ?? '[]') as string[]
      arr.push(`${new Date().toLocaleTimeString('en-GB')} ${from}→${s.current}${s.mode === 'device' ? ' · device' : ''}`)
      localStorage.setItem(key, JSON.stringify(arr.slice(-24)))
    } catch { /* ignore */ }
  })
  // A page being torn down (a watchdog reload, a destroyed activity) must
  // not leave its device voice behind: system speech outlives a dead page
  // in the speech service's queue and speaks on with no stop switch, while
  // the fresh page starts the same session in the neural voice — two
  // different audios at once, one of them unstoppable. Neural audio dies
  // with the page on its own; the device voice is dismissed by hand.
  window.addEventListener('pagehide', () => { try { cancelDevice() } catch { /* dying anyway */ } })
  if (inited) return
  inited = true
  const d = droid()
  if (!d?.bubbleState) return

  // The lever lives in two homes (the Settings switch and the bubble's own):
  // keep them one fact. Ours is pushed down whenever it changes…
  let pushedAuto: boolean | null = null
  const pushPrefs = () => {
    const a = settings.get().bubbleAuto
    if (a === pushedAuto) return
    pushedAuto = a
    try { d.bubblePrefs?.(a) } catch { /* ignore */ }
  }
  pushPrefs()
  settings.subscribe(pushPrefs)
  // The floating window's look (1.4.157) rides the same road: pushed
  // down whenever it changes, the shell keeps it in its own prefs and
  // repaints the bubble and the panel in place.
  let pushedLook = ''
  const pushLook = () => {
    const st = settings.get()
    const th = st.theme
    const light = th === 'light' || (th === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches)
    const fam = th === 'tron' ? 'tron' : th === 'cyberpunk' ? 'cyberpunk' : light ? 'light' : 'dark'
    const key = `${st.bubbleAlpha}|${st.panelAlpha}|${st.bubbleSize}|${st.jumpBackSec}|${st.jumpFwdSec}|${fam}`
    if (key === pushedLook) return
    pushedLook = key
    try { d.bubbleLook?.(JSON.stringify({ ba: st.bubbleAlpha, pa: st.panelAlpha, size: st.bubbleSize, jb: st.jumpBackSec, jf: st.jumpFwdSec, th: fam })) } catch { /* ignore */ }
  }
  pushLook()
  settings.subscribe(pushLook)
  // A panel key pressed while this page was asleep is remembered natively and
  // collected now, as the page wakes — the press is never silently lost. And
  // when the page died outright, the session died with it: rebuild what was
  // playing from its own tracks (the same three legs Continue listening uses,
  // newest first) and let the press land on the restored session.
  const recoverSession = async (): Promise<boolean> => {
    try {
      const cands: { at: number; run: () => void }[] = []
      const book = [...books.get().list]
        .filter((b) => !b.done && b.progress > 0.01 && b.progress < 0.985 && (b.openedAt ?? 0) > 0)
        .sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0))[0]
      if (book) cands.push({ at: book.openedAt ?? 0, run: () => { void playBook(book, { pos: book.pos }) } })
      const clip = [...library.get().clips]
        .filter((c) => !c.done && (c.pos ?? 0) > 5 && (c.playedAt ?? 0) > 0)
        .sort((a, b) => (b.playedAt ?? 0) - (a.playedAt ?? 0))[0]
      if (clip) cands.push({ at: clip.playedAt ?? 0, run: () => {
        if (clip.kind === 'text' || !clip.format) { loadText(clip.text); void play(); return }
        void getClipBlob(clip.id).then((blob) => { if (blob) void playClip(`clip:${clip.id}`, blob, { title: clip.title, artist: clip.voice }, clip.pos ?? 0) })
      } })
      const r = loadSessionResume()
      const draft = drafts.get().listen
      if (r && r.idx > 0 && draft.trim() && textKey(draft) === r.key) {
        cands.push({ at: r.at, run: () => { loadText(draft); void play(r.idx) } })
      }
      const top = cands.sort((a, b) => b.at - a.at)[0]
      if (!top) return false
      top.run()
      return true
    } catch { return false }
  }
  // The session identity the shell stamps its stored presses with
  // (T2-19): title + sentence total — the very pair this page pushes
  // in bubbleNow, computed here from the same seats push() reads.
  const pageCtx = (): string => {
    const s = listen.get()
    if (!s.active || !s.segments.length) return ''
    return `${titleOf(true, s.text) || 'Logos'}|${s.segments.length}`
  }
  // Execute ONE collected press against its stamp. Returns true
  // when the press had to go down the recovery road (its verb
  // re-fires ~900 ms later, once the session is restored), false
  // when it was fully handled in this breath.
  const runCollected = (cmd: string, stamp: string): boolean => {
    const forThisSession = () => {
      if (!stamp) return true
      if (clipOwns()) return false // a stamped press names a reading; a clip stage is never its session
      const here = pageCtx()
      return !here || here === stamp
    }
    // CLEARQUEUE (1.4.201) acts on the queue record, never on a
    // session — like pause, it is judged before every session road.
    if (cmd === 'clearqueue') { clearQueue(); return false }
    // QUEUEON / QUEUEOFF (1.4.206) act on the setting itself — the
    // panel sheet's lever, behind its confirmation card. The mode's
    // own watcher in this module judges the erasure when it turns
    // off; no session is involved, so they too are judged here.
    if (cmd === 'queueon') { settings.set({ copyQueue: true }); return false }
    if (cmd === 'queueoff') { settings.set({ copyQueue: false }); return false }
    // A stored PAUSE (1.4.89): against a dead page, silence is already
    // the truth. The one thing it must never do is summon playback —
    // the recovery used to 'fulfil' it by playing the session, and his
    // pause became a play, visit after visit. (Pause stays exempt
    // from the stamp check, as shell-side: its door can only silence.)
    if (cmd === 'pause') { if (listen.get().playing) pauseFromShell(); return false }
    if (cmd === 'play') {
      if (listen.get().active || clipOwns()) { if (forThisSession()) dispatchEvent(new Event('logosandroid-play')); return false }
      void recoverSession().then((ok) => {
        if (ok) setTimeout(() => { if (forThisSession()) dispatchEvent(new Event('logosandroid-play')) }, 900)
      })
      return true
    }
    if (cmd === 'slower' || cmd === 'faster' || cmd === 'rate' || listen.get().active || clipOwns()) {
      if (forThisSession()) dispatchEvent(new Event(`logosandroid-${cmd}`))
      return false
    }
    void recoverSession().then((ok) => {
      // prev/next re-fire at the recovered session; so do mark, save and
      // voice (1.4.109, audit E-2): they act on the session the recovery
      // just restored — the very one the panel was showing when the
      // press was stored. T2-19: that identity is now CHECKED at the
      // moment of the re-fire, not assumed — the recovery ranks its
      // candidates by recency and can restore a different book, clip
      // or draft than the stamped one, and a verb fired into the
      // wrong session is worse than a verb dropped.
      if (ok && (cmd === 'prev' || cmd === 'next' || cmd === 'mark' || cmd === 'save' || cmd === 'voice')) {
        setTimeout(() => { if (forThisSession()) dispatchEvent(new Event(`logosandroid-${cmd}`)) }, 900)
      }
    })
    return true
  }
  const collectPending = () => {
    try {
      const cmd = d.bubblePendingCmd?.()
      if (!cmd) return
      // The press's session stamp, read alongside the command (T2-19,
      // the page half the shell's stamps always assumed): the press
      // was stored against the session the panel was showing, and it
      // may only be executed against THAT session. Empty when the
      // press was stored with no session or against an older shell —
      // then there is nothing to judge and the shell-side audit at
      // the take stands alone, as it did before.
      const stamp = d.bubblePendingCtx?.() ?? ''
      const deferred = runCollected(cmd, stamp)
      // One surfacing drains the queue (R3-T2-2): the collector
      // used to take exactly one press per door — a ghost resume
      // offers only focus + visibility, so a burst of three
      // stranded its tail in the shell queue past the twenty-second
      // law, to die unexecuted at some much later take. Now the
      // door re-opens itself until the Bridge answers empty: a
      // press handled in this breath chains at once; a press that
      // went down the recovery road chains just after its own
      // re-fire, so the next press is judged against the session
      // the recovery restored (and finds it active, taking the
      // direct road instead of recovering twice). Presses still
      // queued shell-side stay unspent until their take — the
      // audits run at the take, as they always have.
      setTimeout(collectPending, deferred ? 950 : 60)
    } catch { /* ignore */ }
  }
  setTimeout(collectPending, 700)
  setTimeout(collectPending, 2200)
  // …and on every surfacing after that (1.4.153): a press stored while
  // this page merely slept — a ghost resume that never re-ran the
  // script — used to wait for the next full reload to be collected,
  // landing minutes later on whatever session was current by then.
  // The clip pull below learned this lesson first (a poke can fall
  // into a sleeping page); the pending command collects at the same
  // doors. The shell stamps each stored press and drops it after
  // twenty seconds, so a late collection can never obey a stale one.
  addEventListener('focus', collectPending)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) collectPending() })
  // …and theirs is pulled up when the bubble's switch moves.
  addEventListener('logosandroid-lever', () => {
    try {
      const a = d.bubbleAuto?.()
      if (typeof a === 'boolean') { pushedAuto = a; if (a !== settings.get().bubbleAuto) settings.set({ bubbleAuto: a }) }
    } catch { /* ignore */ }
  })
  addEventListener('logosandroid-bubbleoff', () => settings.set({ bubbleOn: false }))
  // The panel's definite transport intents (1.4.89): the shell reads the
  // pushed state at press time and sends PLAY or PAUSE, never a bare
  // toggle, so a press keeps its meaning however it travels.
  addEventListener('logosandroid-pause', () => { if (clipOwns()) { pauseClip(); return } if (listen.get().playing) pauseFromShell() })
  addEventListener('logosandroid-play', () => {
    if (clipOwns()) { resumeClip(); return }
    const s = listen.get()
    if (s.active) { if (!s.playing) void play() }
    else void recoverSession()
  })
  // The panel's − / + keys: one step along the same ladder the Listen sheet uses.
  // While a recording holds the stage, the reading-only keys say so
  // instead of landing nowhere (1.4.156).
  addEventListener('logosandroid-slower', () => { if (clipOwns()) { toast(t('That key belongs to readings')); return } stepRate(-1) })
  addEventListener('logosandroid-faster', () => { if (clipOwns()) { toast(t('That key belongs to readings')); return } stepRate(1) })
  // 1.4.204: an absolute rate from the shell (the panel's speed list,
  // 1.4.205) — pulled through the Bridge like bubbleSeek, never pushed.
  addEventListener('logosandroid-rate', () => { if (clipOwns()) { toast(t('That key belongs to readings')); return } const v = parseFloat(d.bubbleRate?.() ?? ''); if (Number.isFinite(v) && v > 0) setRate(v) })
  // The panel's seek bar: the shell holds the fraction, the page pulls it.
  addEventListener('logosandroid-seek', () => {
    try {
      const f = parseFloat(d.bubbleSeek?.() ?? '')
      if (!Number.isFinite(f)) return
      // The seek's own stamp (T2-19): the fraction was chosen against
      // the session the panel was showing; if the live session is a
      // different one, the fraction belongs to a stranger and is
      // dropped, never obeyed against whatever is showing now. (A
      // clip-stage seek is stamped empty shell-side and takes the
      // clip road as always.)
      const sctx = d.bubbleSeekCtx?.() ?? ''
      if (sctx && !clipOwns()) { const here = pageCtx(); if (here && here !== sctx) return }
      if (clipOwns()) { seekClip(f) } else { seekFraction(f) }
    } catch { /* ignore */ }
  })
  // The media session's seek bar (1.4.193): the shell holds an
  // absolute millisecond target, the page pulls it — judged by
  // the same stamp law as the panel's fraction above. A recording
  // takes it as a fraction of its real clock; a reading walks its
  // durations to the same millisecond.
  addEventListener('logosandroid-seekto', () => {
    try {
      const ms = parseFloat(d.bubbleSeekTo?.() ?? '')
      if (!Number.isFinite(ms)) return
      const sctx = d.bubbleSeekToCtx?.() ?? ''
      if (sctx && !clipOwns()) { const here = pageCtx(); if (here && here !== sctx) return }
      if (clipOwns()) { const cp = clipView(); if (cp && cp.duration > 0) seekClip(Math.min(1, Math.max(0, ms / 1000 / cp.duration))) }
      else seekToMs(ms)
    } catch { /* ignore */ }
  })
  // The panel's queue keys (1.4.198): a row tap plays that item, a
  // row's ✕ drops it, and the save choice can send the whole line
  // to Listen later. The seats are pulled and judged by context
  // exactly like the seek's (a stale pull from a dead panel dies).
  const pullQueueIdx = (raw: string | undefined, ctxRaw: string | undefined): number => {
    try {
      const i = parseInt(raw ?? '', 10)
      if (!Number.isFinite(i) || i < 0) return -1
      const sctx = ctxRaw ?? ''
      if (sctx) { const here = pageCtx(); if (here && here !== sctx) return -1 }
      return i
    } catch { return -1 }
  }
  addEventListener('logosandroid-queueplay', () => {
    const idx = pullQueueIdx(d.bubbleQueuePlay?.(), d.bubbleQueuePlayCtx?.())
    if (idx >= 0) playQueueAt(idx)
  })
  addEventListener('logosandroid-queuedrop', () => {
    const idx = pullQueueIdx(d.bubbleQueueDrop?.(), d.bubbleQueueDropCtx?.())
    if (idx >= 0) dropQueueAt(idx)
  })
  // 1.4.232: the panel list's own little book — one row's text to
  // Listen later, behind the panel's quick confirmation card.
  addEventListener('logosandroid-queuesaveitem', () => {
    const idx = pullQueueIdx(d.bubbleQueueSave?.(), d.bubbleQueueSaveCtx?.())
    const item = idx >= 0 ? queueItems()[idx] : undefined
    if (item) void saveQueueItemToLater(item)
  })
  addEventListener('logosandroid-savequeue', () => { void sendQueueToLater() })
  // 1.4.201: the panel list's Empty-the-whole-list key (behind its
  // confirmation card) — the queue record clears; what is playing
  // keeps playing, as the card says.
  addEventListener('logosandroid-clearqueue', () => clearQueue())
  // 1.4.206: the queue sheet's own lever — the mode turned on or off
  // from the panel, behind its confirmation cards. The erasure when
  // it turns off is the settings watcher's deed, here as everywhere.
  addEventListener('logosandroid-queueon', () => settings.set({ copyQueue: true }))
  addEventListener('logosandroid-queueoff', () => settings.set({ copyQueue: false }))
  // The panel's bookmark key, and the bubble's long-press voice wheel.
  addEventListener('logosandroid-mark', () => { if (clipOwns()) { toast(t('That key belongs to readings')); return } void markAndToast().then(() => push()) })
  // The panel's save key: the copied text that is only visiting becomes a
  // permanent Library resident (a Listen-later text; audio is made on demand).
  addEventListener('logosandroid-save', () => {
    if (clipOwns()) { toast(t('That key belongs to readings')); return }
    const s = listen.get()
    const text = (s.active ? s.text : drafts.get().listen).trim()
    if (!text) { toast(t('Nothing to save yet')); return }
    if (nowReadingFor(text)) { toast(t('Already in your library — it’s a book')); return }
    const lang = detectLang(text.slice(0, 2000)).lang
    const info = describeText(text.slice(0, 12000), lang)
    void saveForLater(text, {
      title: info.title || t('Copied text'),
      summary: info.summary,
      lang,
      voice: s.active ? (s.voices[s.current] ?? '') : '',
      duration: estimateSeconds(text, 1),
    }).then(() => toast(t('Saved to Library — it stays now')))
  })
  addEventListener('logosandroid-voice', () => {
    if (clipOwns()) { toast(t('That key belongs to readings')); return }
    const s = listen.get()
    const lang = s.active ? (s.segments[s.current]?.lang ?? detectLang(s.text.slice(0, 2000)).lang) : detectLang(drafts.get().listen.slice(0, 2000)).lang
    const favs = favoriteVoices(settings.get().favorites).filter((v) => v.lang === lang)
    const pool = favs.length ? favs : VOICES.filter((v) => v.lang === lang)
    if (!pool.length) return
    const cur = s.active ? s.voices[s.current] : voiceFor(lang)
    const nextV = pool[(pool.findIndex((v) => v.id === cur) + 1) % pool.length]
    settings.set({ voiceOverride: nextV.id })
    refreshVoices()
  })
  // Return-to-book: watch the stage. The clip finishing restores its card;
  // Oscar loading anything else by hand retires it.
  listen.subscribe(() => {
    if (!stageKey) return
    const s = listen.get()
    if (!s.active) return
    if (clipKey(s.text) === stageKey) {
      if (s.finished && resumeCard) {
        const r = resumeCard
        stageKey = ''; resumeCard = null; saveResume()
        loadText(r.text)
        if (r.draftOnly) {
          // A draft card restores the draft itself — the text back in
          // the box and in its persisted copy — and does NOT play it:
          // it was typed, never played, and its owner never asked to
          // hear it (F8-8 completion).
          drafts.set({ listen: r.text })
          saveLastText(r.text)
          toast(t('Your earlier draft is back'), undefined, 3500)
        } else {
          if (r.idx > 0) seek(r.idx)
          void play(r.idx)
          toast(t('Back to {title}', { title: r.title }), undefined, 3500)
        }
      }
    } else {
      stageKey = ''; resumeCard = null; saveResume()
    }
  })
  // The confirmed front paste's stamp (1.4.206): the panel's Paste
  // now, behind its card, flags the delivery it is about to make —
  // pulled once at the Bridge, twenty seconds of life. Only a hand
  // paste carries it; an automatic catch never sets it.
  const takeFrontFlag = (): boolean => {
    try { return d.bubblePasteFront?.() === '1' } catch { return false }
  }
  // Every shell delivery is judged here: a stamped one takes the
  // front road; the rest join the line's tail as they always have.
  const judgeArrival = (text: string): boolean => {
    if (takeFrontFlag() && queueFrontArrival(text)) return true
    return queueArrival(text)
  }
  // A stored catch is pulled once (the shell clears it on the pull), so
  // pulling on every return is safe — and necessary: the 'clip' poke can
  // fall into a sleeping page and be lost, and a catch that only a poke
  // can collect dies with that poke (Oscar's frozen stretch: copy, panel,
  // tap outside, silence). Focus, visibility and a fresh start all pull.
  const pullClip = () => {
    try {
      const raw = d.bubbleClip?.() ?? ''
      if (!raw) return
      const { t } = JSON.parse(raw) as { t?: string }
      if (t?.trim() && !judgeArrival(t)) playClipboardText(t)
    } catch { /* ignore */ }
  }
  addEventListener('logosandroid-clip', pullClip)
  addEventListener('focus', pullClip)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pullClip() })
  pullClip()

  // What the bubble's panel shows: the title, the sentence, the play state.
  // 1.4.64: the title is computed ONCE per text and cached — the first version
  // re-analysed the whole text (keywords, names) on every player tick, and the
  // main thread paid for it everywhere: switches and the nav felt drunk.
  let last = ''
  let titleForText: string | null = null
  let titleForActive = false
  let titleCached = ''
  const titleOf = (active: boolean, text: string): string => {
    // The cache is keyed by the text ITSELF, compared whole (cure
    // R4-T1-2). The old key — length + first 64 chars — collided
    // across two texts that share a head and a length but earn
    // different true titles deeper in (describeText reads names
    // and keywords across the whole text): the panel then named
    // session B with session A's title — and pageCtx stamps its
    // stored presses with this very title, so a press stored
    // against A passed the identity check against B and its verb
    // ('next', 'save', 'mark') landed on the wrong reading. A
    // whole-string comparison is exact: two texts share a cached
    // title only when they are the same text, so the T2-19 stamp
    // now judges by the true title on both of its sides.
    if (text === titleForText && active === titleForActive) return titleCached
    titleForText = text
    titleForActive = active
    const book = active ? nowReadingFor(text) : null
    titleCached = book?.title ?? (text.trim() ? describeText(text.slice(0, 12000), detectLang(text.slice(0, 2000)).lang).title : '')
    return titleCached
  }
  // The words for the panel: the sentence sounding now, and — for the
  // tablet's wider window — the one before and the one after. Cleaned of
  // markdown like the reader cleans them, and capped so a monster
  // sentence can never flood the little window.
  const cleanSent = (t: string) => t.replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim()
  const capSent = (t: string, n: number) => { if (t.length <= n) return t; const cut = t.lastIndexOf(' ', n); return `${t.slice(0, cut > 40 ? cut : n)}…` }
  // The word sounding right now, for the panel's amber: timed from the
  // sentence's own audio while the envelope clock is alive (the reader's
  // own method), else dealt out by characters over the sentence's progress.
  const wordIndexOf = (active: boolean, idx: number, clean: string): number => {
    if (!active || !clean) return -1
    const words = clean.split(' ')
    const clk = wordClock()
    if (clk && clk.idx === idx) return wordAtTime(alignWords(clk.env, 60, words), clk.t + settings.get().wordLeadMs / 1000)
    const total = words.reduce((a, w) => a + w.length + 1, 0)
    const target = sentenceProgress() * total
    let acc = 0
    for (let i = 0; i < words.length; i++) { acc += words[i].length + 1; if (acc > target) return i }
    return words.length - 1
  }
  // The house has TWO players (1.4.156): the reading voice (the listen
  // store — the only one this panel has ever mirrored) and the
  // finished-audio player (clip.ts: Library recordings, Create
  // results), which never wrote to the listen store. A recording
  // started in the app therefore played invisibly to the bubble —
  // the disconnection Oscar reported: bubble-started readings showed
  // in the app, app-started recordings never showed in the bubble.
  // The panel now follows whichever player holds the stage. Voice
  // samples (preview: keys) are not sessions and never take it.
  const clipView = () => {
    const cp = clipPlayer.get()
    return cp.key && !cp.key.startsWith('preview:') ? cp : null
  }
  const clipOwns = () => {
    const cp = clipView()
    return !!cp && (cp.playing || !listen.get().active)
  }
  const barTmp = new Float32Array(18)
  const push = () => {
    const s = listen.get()
    const text = s.active ? s.text : drafts.get().listen
    const th = settings.get().theme
    const light = th === 'light' || (th === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches)
    // The theme family rides along (1.4.165): the shell dresses the
    // bubble, the panel and the hint cards in the same palette.
    const fam = th === 'tron' ? 'tron' : th === 'cyberpunk' ? 'cyberpunk' : light ? 'light' : 'dark'
    const cp = clipOwns() ? clipView() : null
    // The copy queue rides every push (1.4.198): the panel's queue
    // key wears the count, its list reads the titles, and the shell
    // knows whether the line's mode stands at all.
    const qInfo = { queue: queueItems().length, qcur: currentIndex(), qmode: settings.get().copyQueue ? 1 : 0, qt: queueItems().map((i) => i.title.slice(0, 60)), qk: queueItems().map((i) => (i.kind === 'copy' ? 1 : 0)) }
    if (cp) {
      // The recording's face: its title, its clock, its fraction. No
      // sentences, no words — it is a recording, and the panel says so
      // by what it shows. `saved` is true (it already lives in the
      // Library); the reading-only keys are gated page-side below.
      const info = {
        playing: cp.playing,
        busy: false,
        err: 0,
        saved: true,
        active: true,
        frac: cp.duration > 0 ? Math.min(1, cp.time / cp.duration) : 0,
        ci: -1,
        ct: 0,
        bars: null,
        light,
        fam,
        lang: settings.get().uiLang,
        words: settings.get().bubbleText,
        tp: '', tc: '', tn: '', wi: -1,
        ...qInfo,
        title: cp.title || 'Logos',
        sub: t('{a} of {b}', { a: fmtClock(cp.time), b: fmtClock(cp.duration) }),
      }
      const key = JSON.stringify(info)
      if (key === last) return
      last = key
      try { d.bubbleNow?.(key) } catch { /* ignore */ }
      return
    }
    const info = {
      // Sound only (1.4.173): buffering rides its own `busy` flag
      // below; counting it as playing kept the shell's watches and
      // guards believing a paused-during-Preparing session was
      // sounding — the same conflation that fed the dictation
      // autoplay on the card's side.
      playing: s.playing,
      busy: s.buffering && !s.cushion,
      // The session's error, as a flag (1.4.125): quiet-with-error is a
      // failure asking for the rescue floor; quiet-without is his pause.
      err: s.error ? 1 : 0,
      // Whether what is playing already lives in the Library — the ⚑ asks this
      // before it marks, so no mark is ever left on unsaved audio.
      saved: s.active && (!!nowReadingFor(s.text) || library.get().clips.some((c) => c.kind === 'text' && !!c.text && c.text.trim() === s.text.trim())),
      // The marks witness (1.4.204): a landed mark moves this counter,
      // so the shell's poke watch sees the ⚑ press it caused.
      marks: marksEpoch(),
      active: s.active,
      frac: s.active && s.segments.length ? Math.min(1, (s.current + sentenceProgress()) / s.segments.length) : 0,
      // Sentence coordinates (1.4.119): the panel's sentence scrub counts
      // in sentences, so it needs the driver's own numbers, not a guess
      // from the fraction.
      ci: s.active ? s.current : -1,
      ct: s.active ? s.segments.length : 0,
      bars: s.active && levels(18, barTmp) ? Array.from(barTmp, (v) => Math.round(Math.max(0, Math.min(1, v)) * 100)) : null,
      light,
      fam,
      lang: settings.get().uiLang,
      words: settings.get().bubbleText,
      tp: s.active ? capSent(cleanSent(s.segments[s.current - 1]?.text ?? ''), 160) : '',
      tc: s.active ? capSent(cleanSent(s.segments[s.current]?.text ?? ''), 520) : '',
      tn: s.active ? capSent(cleanSent(s.segments[s.current + 1]?.text ?? ''), 160) : '',
      wi: settings.get().bubbleText ? wordIndexOf(s.active, s.current, s.active ? cleanSent(s.segments[s.current]?.text ?? '') : '') : -1,
      ...qInfo,
      title: titleOf(s.active, text) || 'Logos',
      sub: s.active ? (s.cushion ? t('Preparing… {d} of {t} to start', { d: s.cushion.done, t: s.cushion.total }) : t('Sentence {a} of {b} · {r}', { a: s.current + 1, b: s.segments.length, r: fmtRate(settings.get().listenSpeed) })) : t('Ready'),
    }
    const key = JSON.stringify(info)
    if (key === last) return
    last = key
    try { d.bubbleNow?.(key) } catch { /* ignore */ }
  }
  listen.subscribe(push)
  clipPlayer.subscribe(push)
  queue.subscribe(push)
  // While playing, feed the panel's spectrum and its amber word — push()
  // dedupes unchanged states, so this costs nothing at rest.
  setInterval(() => { if (listen.get().playing || clipPlayer.get().playing) push() }, 120)
  drafts.subscribe(push)
  settings.subscribe(push)
  push()

  // A clip the bubble caught before this page existed (Paste & play opened the app).
  setTimeout(() => {
    try {
      const raw = d.bubbleClip?.() ?? ''
      if (!raw) return
      const { t } = JSON.parse(raw) as { t?: string }
      if (t?.trim() && clipKey(t.trim()) !== lastClip && !judgeArrival(t)) playClipboardText(t)
    } catch { /* ignore */ }
  }, 1200)

  // Arriving in Logos: with the lever on, a new clipboard plays itself — the app
  // is in front now, so it is allowed to look. And when Paste & play was pressed
  // by hand and the bubble could not read, the shell flags it (bubbleWantClip)
  // and the page reads it here regardless of the lever: a hand ask always lands.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    let want = false
    try { want = d.bubbleWantClip?.() === true } catch { /* old shell */ }
    if (!want && !settings.get().bubbleAuto) return
    // The stage lock: an automatic arrival read honours it; a hand ask (want) lands.
    if (!want) { try { if (d.bubbleLock?.()) return } catch { /* old shell */ } }
    void readClipboard().then((rawClip) => {
      const text = rawClip.trim()
      if (!text) return
      if (!want && clipKey(text) === lastClip) return
      // The draft gate keeps the automatic road from re-playing what
      // a delivery itself put there — but a hand paste (want) of the
      // very same words is a restart ask, not a loop (1.4.162):
      // Oscar re-copies a text the dedupe reads as no news, and only
      // his finger on the paste icon can say "again".
      if (!want && text === drafts.get().listen.trim()) { seenClip(text); return }
      // The front paste (1.4.206): when the shell could not read
      // the clipboard itself, the hand ask lands here instead —
      // its stamp still names it, and the front road takes it
      // before the tail can.
      if (want && takeFrontFlag() && queueFrontArrival(text)) return
      // The queue mode (1.4.198): an arrival joins the line instead
      // of taking the stage, so there is nothing to ask permission
      // for — nothing is displaced. Hand asks line up too.
      if (queueArrival(text)) return
      if (!want) {
        // Oscar (1.4.192): arriving in the main app with a fresh copy
        // used to take the stage silently — and what it displaced could
        // be something important, mid-listen. The automatic road now
        // ASKS before it replaces, whenever something is at stake: a
        // live session whose text differs, or a draft in the box that
        // differs. A hand ask (want) still lands at once — his finger
        // asked — and an empty stage has nothing to lose, so nothing
        // is asked there either. "No" marks the copy seen, so the same
        // text does not ask again at every arrival; a new copy asks
        // anew.
        const s = listen.get()
        const draft = drafts.get().listen.trim()
        const atStake = (s.active && clipKey(s.text) !== clipKey(text)) || (!s.active && !!draft && draft !== text)
        if (atStake) {
          if (clipAskOpen) return
          clipAskOpen = true
          void confirmAsk(
            t('Replace with the copied text?'),
            t('You copied a new text. If you replace, what is loaded now is set aside — its card will bring it back where you left it.'),
            t('Replace'),
          ).then((ok) => {
            clipAskOpen = false
            if (ok) playClipboardText(text)
            else seenClip(text)
          })
          return
        }
      }
      playClipboardText(text)
    }).catch(() => { /* clipboard blocked */ })
  })
}
