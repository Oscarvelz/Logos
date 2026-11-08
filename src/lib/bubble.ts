// The floating bubble (Logos app, shell android-18+): a small λ that hovers over
// other apps with play / previous / next, and — when its lever is on — plays what
// Oscar just copied. Android only lets an app read the clipboard while one of its
// windows holds the focus, so the reading happens at the tap on the bubble (or on
// arriving in Logos, when the app is in front). What it plays replaces what was
// playing, always with an Undo, so no text is ever lost to it.
import { settings, saveLastText } from './settings.ts'
import { drafts } from './drafts.ts'
import { listen, loadText, play, endSession, stepRate, seek, seekFraction, refreshVoices, voiceFor, sentenceProgress, levels } from '../player/listen.ts'
import { readClipboard } from './clipboard.ts'
import { describeText } from './describe.ts'
import { detectLang } from './text.ts'
import { VOICES, favoriteVoices } from './voices.ts'
import { nowReadingFor } from './book/nowreading.ts'
import { markAndToast } from './marks.ts'
import { toast } from '../components/ui.tsx'

type DroidBubble = {
  bubbleState?: () => string
  bubble?: (on: boolean) => void
  bubblePermission?: () => void
  bubblePrefs?: (auto: boolean) => void
  bubbleAuto?: () => boolean
  bubbleNow?: (json: string) => void
  bubbleClip?: () => string
  bubbleWantClip?: () => boolean
  bubbleSeek?: () => string
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
    toast('Playing what you copied', {
      label: 'Undo',
      run: () => {
        drafts.set({ listen: prevText })
        saveLastText(prevText)
        if (listen.get().active) endSession()
        loadText(prevText)
      },
    }, 6000)
  } else {
    toast('Playing what you copied', undefined, 3000)
  }
}

let inited = false
export function initBubble() {
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
  // …and theirs is pulled up when the bubble's switch moves.
  addEventListener('logosandroid-lever', () => {
    try {
      const a = d.bubbleAuto?.()
      if (typeof a === 'boolean') { pushedAuto = a; if (a !== settings.get().bubbleAuto) settings.set({ bubbleAuto: a }) }
    } catch { /* ignore */ }
  })
  addEventListener('logosandroid-bubbleoff', () => settings.set({ bubbleOn: false }))
  // The panel's − / + keys: one step along the same ladder the Listen sheet uses.
  addEventListener('logosandroid-slower', () => stepRate(-1))
  addEventListener('logosandroid-faster', () => stepRate(1))
  // The panel's seek bar: the shell holds the fraction, the page pulls it.
  addEventListener('logosandroid-seek', () => {
    try { const f = parseFloat(d.bubbleSeek?.() ?? ''); if (Number.isFinite(f)) seekFraction(f) } catch { /* ignore */ }
  })
  // The panel's bookmark key, and the bubble's long-press voice wheel.
  addEventListener('logosandroid-mark', () => void markAndToast())
  addEventListener('logosandroid-voice', () => {
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
        toast(`Back to ${r.title}`, undefined, 3500)
      }
    } else {
      stageKey = ''; resumeCard = null; saveResume()
    }
  })
  addEventListener('logosandroid-clip', () => {
    try {
      const raw = d.bubbleClip?.() ?? ''
      if (!raw) return
      const { t } = JSON.parse(raw) as { t?: string }
      if (t?.trim()) playClipboardText(t)
    } catch { /* ignore */ }
  })

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
  const barTmp = new Float32Array(18)
  const push = () => {
    const s = listen.get()
    const text = s.active ? s.text : drafts.get().listen
    const th = settings.get().theme
    const light = th === 'light' || (th === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches)
    const info = {
      playing: s.playing || s.buffering,
      active: s.active,
      frac: s.active && s.segments.length ? Math.min(1, (s.current + sentenceProgress()) / s.segments.length) : 0,
      bars: s.active && levels(18, barTmp) ? Array.from(barTmp, (v) => Math.round(Math.max(0, Math.min(1, v)) * 100)) : null,
      light,
      title: titleOf(s.active, text) || 'Logos',
      sub: s.active ? `Sentence ${s.current + 1} of ${s.segments.length} · ${fmtRate(settings.get().listenSpeed)}` : 'Ready',
    }
    const key = JSON.stringify(info)
    if (key === last) return
    last = key
    try { d.bubbleNow?.(key) } catch { /* ignore */ }
  }
  listen.subscribe(push)
  // While playing, feed the panel's spectrum a few times a second — push()
  // dedupes unchanged states, so this costs nothing at rest.
  setInterval(() => { if (listen.get().playing) push() }, 250)
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
    void readClipboard().then((t) => {
      const text = t.trim()
      if (!text) return
      if (!want && clipKey(text) === lastClip) return
      if (text === drafts.get().listen.trim()) { seenClip(text); return }
      playClipboardText(text)
    }).catch(() => { /* clipboard blocked */ })
  })
}
