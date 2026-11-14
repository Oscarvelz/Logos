// The floating bubble (Logos app, shell android-18+): a small λ that hovers over
// other apps with play / previous / next, and — when its lever is on — plays what
// Oscar just copied. Android only lets an app read the clipboard while one of its
// windows holds the focus, so the reading happens at the tap on the bubble (or on
// arriving in Logos, when the app is in front). What it plays replaces what was
// playing, always with an Undo, so no text is ever lost to it.
import { settings, saveLastText } from './settings.ts'
import { drafts } from './drafts.ts'
import { listen, loadText, play, pauseFromShell, endSession, stepRate, seek, seekFraction, refreshVoices, voiceFor, sentenceProgress, wordClock, levels } from '../player/listen.ts'
import { alignWords, wordAtTime } from '../player/wordsync.ts'
import { cancelDevice } from '../engine/device-voice.ts'
import { readClipboard } from './clipboard.ts'
import { describeText } from './describe.ts'
import { detectLang } from './text.ts'
import { VOICES, favoriteVoices } from './voices.ts'
import { nowReadingFor } from './book/nowreading.ts'
import { markAndToast, textKey } from './marks.ts'
import { saveForLater, library, getClipBlob } from './library.ts'
import { books } from './books.ts'
import { playBook } from './book/playbook.ts'
import { t } from './i18n.ts'
import { playClip, clipPlayer, pauseClip, resumeClip, seekClip } from '../player/clip.ts'
import { loadSessionResume } from './resume.ts'
import { estimateSeconds } from './text.ts'
import { toast } from '../components/ui.tsx'

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
  bubblePendingCmd?: () => string
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

const clipKey = (t: string) => `${t.length}:${t.slice(0, 48)}:${t.slice(-48)}`
const fmtRate = (r: number) => `${Math.round(r * 100) / 100}×`
const fmtClock = (sec: number) => { const v = isFinite(sec) && sec > 0 ? sec : 0; return `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}` }
let lastClip = (() => { try { return localStorage.getItem('logos.bubble.lastClip') ?? '' } catch { return '' } })()
function seenClip(t: string) {
  lastClip = clipKey(t)
  try { localStorage.setItem('logos.bubble.lastClip', lastClip) } catch { /* ignore */ }
}

// Return-to-book (Oscar's ask): a clip that interrupts a session leaves a card
// behind; when the clip ENDS, what was interrupted resumes where it was — the
// interruption heals itself. A second clip keeps the original card; anything
// Oscar loads by hand cancels it.
type ResumeCard = { text: string; idx: number; title: string }
let resumeCard: ResumeCard | null = (() => { try { return JSON.parse(localStorage.getItem('logos.bubble.resume') ?? 'null') as ResumeCard | null } catch { return null } })()
let stageKey = ''
function saveResume() {
  try {
    if (resumeCard) localStorage.setItem('logos.bubble.resume', JSON.stringify(resumeCard))
    else localStorage.removeItem('logos.bubble.resume')
  } catch { /* ignore */ }
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
  stageKey = clipKey(text)
  seenClip(text)
  const prevText = drafts.get().listen
  drafts.set({ listen: text })
  saveLastText(text)
  if (listen.get().active) endSession()
  loadText(text)
  dispatchEvent(new Event('logos-bubble-clip'))
  void play()
  if (prevText.trim() && prevText.trim() !== text) {
    toast(t('Playing what you copied'), {
      label: t('Undo'),
      run: () => {
        drafts.set({ listen: prevText })
        saveLastText(prevText)
        if (listen.get().active) endSession()
        loadText(prevText)
      },
    }, 6000)
  } else {
    toast(t('Playing what you copied'), undefined, 3000)
  }
}

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
    const key = `${st.bubbleAlpha}|${st.panelAlpha}|${st.bubbleFade}|${st.bubbleSize}|${st.jumpBackSec}|${st.jumpFwdSec}`
    if (key === pushedLook) return
    pushedLook = key
    try { d.bubbleLook?.(JSON.stringify({ ba: st.bubbleAlpha, pa: st.panelAlpha, fade: st.bubbleFade, size: st.bubbleSize, jb: st.jumpBackSec, jf: st.jumpFwdSec })) } catch { /* ignore */ }
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
  const collectPending = () => {
    try {
      const cmd = d.bubblePendingCmd?.()
      if (!cmd) return
      // A stored PAUSE (1.4.89): against a dead page, silence is already
      // the truth. The one thing it must never do is summon playback —
      // the recovery used to 'fulfil' it by playing the session, and his
      // pause became a play, visit after visit.
      if (cmd === 'pause') { if (listen.get().playing) pauseFromShell(); return }
      if (cmd === 'play') { dispatchEvent(new Event('logosandroid-play')); return }
      if (cmd === 'slower' || cmd === 'faster' || listen.get().active || clipOwns()) {
        dispatchEvent(new Event(`logosandroid-${cmd}`))
        return
      }
      void recoverSession().then((ok) => {
        // prev/next re-fire at the recovered session; so do mark, save and
        // voice (1.4.109, audit E-2): they act on the session the recovery
        // just restored — the very one the panel was showing when the
        // press was stored.
        if (ok && (cmd === 'prev' || cmd === 'next' || cmd === 'mark' || cmd === 'save' || cmd === 'voice')) {
          setTimeout(() => dispatchEvent(new Event(`logosandroid-${cmd}`)), 900)
        }
      })
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
  // The panel's seek bar: the shell holds the fraction, the page pulls it.
  addEventListener('logosandroid-seek', () => {
    try { const f = parseFloat(d.bubbleSeek?.() ?? ''); if (Number.isFinite(f)) { if (clipOwns()) { seekClip(f) } else { seekFraction(f) } } } catch { /* ignore */ }
  })
  // The panel's bookmark key, and the bubble's long-press voice wheel.
  addEventListener('logosandroid-mark', () => { if (clipOwns()) { toast(t('That key belongs to readings')); return } void markAndToast() })
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
        if (r.idx > 0) seek(r.idx)
        void play(r.idx)
        toast(t('Back to {title}', { title: r.title }), undefined, 3500)
      }
    } else {
      stageKey = ''; resumeCard = null; saveResume()
    }
  })
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
      if (t?.trim()) playClipboardText(t)
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
  let titleForText = ''
  let titleCached = ''
  const titleOf = (active: boolean, text: string): string => {
    const k = `${text.length}:${text.slice(0, 64)}`
    if (k === titleForText) return titleCached
    titleForText = k
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
    const cp = clipOwns() ? clipView() : null
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
        lang: settings.get().uiLang,
        words: settings.get().bubbleText,
        tp: '', tc: '', tn: '', wi: -1,
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
      playing: s.playing || s.buffering,
      busy: s.buffering && !s.cushion,
      // The session's error, as a flag (1.4.125): quiet-with-error is a
      // failure asking for the rescue floor; quiet-without is his pause.
      err: s.error ? 1 : 0,
      // Whether what is playing already lives in the Library — the ⚑ asks this
      // before it marks, so no mark is ever left on unsaved audio.
      saved: s.active && (!!nowReadingFor(s.text) || library.get().clips.some((c) => c.kind === 'text' && !!c.text && c.text.trim() === s.text.trim())),
      active: s.active,
      frac: s.active && s.segments.length ? Math.min(1, (s.current + sentenceProgress()) / s.segments.length) : 0,
      // Sentence coordinates (1.4.119): the panel's sentence scrub counts
      // in sentences, so it needs the driver's own numbers, not a guess
      // from the fraction.
      ci: s.active ? s.current : -1,
      ct: s.active ? s.segments.length : 0,
      bars: s.active && levels(18, barTmp) ? Array.from(barTmp, (v) => Math.round(Math.max(0, Math.min(1, v)) * 100)) : null,
      light,
      lang: settings.get().uiLang,
      words: settings.get().bubbleText,
      tp: s.active ? capSent(cleanSent(s.segments[s.current - 1]?.text ?? ''), 160) : '',
      tc: s.active ? capSent(cleanSent(s.segments[s.current]?.text ?? ''), 520) : '',
      tn: s.active ? capSent(cleanSent(s.segments[s.current + 1]?.text ?? ''), 160) : '',
      wi: settings.get().bubbleText ? wordIndexOf(s.active, s.current, s.active ? cleanSent(s.segments[s.current]?.text ?? '') : '') : -1,
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
      if (t?.trim() && clipKey(t.trim()) !== lastClip) playClipboardText(t)
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
    void readClipboard().then((t) => {
      const text = t.trim()
      if (!text) return
      if (!want && clipKey(text) === lastClip) return
      // The draft gate keeps the automatic road from re-playing what
      // a delivery itself put there — but a hand paste (want) of the
      // very same words is a restart ask, not a loop (1.4.162):
      // Oscar re-copies a text the dedupe reads as no news, and only
      // his finger on the paste icon can say "again".
      if (!want && text === drafts.get().listen.trim()) { seenClip(text); return }
      playClipboardText(text)
    }).catch(() => { /* clipboard blocked */ })
  })
}
