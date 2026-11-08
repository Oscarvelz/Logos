// The floating bubble (Logos app, shell android-18+): a small λ that hovers over
// other apps with play / previous / next, and — when its lever is on — plays what
// Oscar just copied. Android only lets an app read the clipboard while one of its
// windows holds the focus, so the reading happens at the tap on the bubble (or on
// arriving in Logos, when the app is in front). What it plays replaces what was
// playing, always with an Undo, so no text is ever lost to it.
import { settings, saveLastText } from './settings.ts'
import { drafts } from './drafts.ts'
import { listen, loadText, play, endSession } from '../player/listen.ts'
import { readClipboard } from './clipboard.ts'
import { describeText } from './describe.ts'
import { detectLang } from './text.ts'
import { nowReadingFor } from './book/nowreading.ts'
import { toast } from '../components/ui.tsx'

type DroidBubble = {
  bubbleState?: () => string
  bubble?: (on: boolean) => void
  bubblePermission?: () => void
  bubblePrefs?: (auto: boolean) => void
  bubbleAuto?: () => boolean
  bubbleNow?: (json: string) => void
  bubbleClip?: () => string
}
const droid = () => (window as unknown as { LogosAndroid?: DroidBubble }).LogosAndroid

/** True only in the Logos app with a shell new enough to carry the bubble. */
export const bubbleSupported = () => typeof droid()?.bubbleState === 'function'

export type BubbleNativeState = { permission: boolean; running: boolean }
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
let lastClip = (() => { try { return localStorage.getItem('logos.bubble.lastClip') ?? '' } catch { return '' } })()
function seenClip(t: string) {
  lastClip = clipKey(t)
  try { localStorage.setItem('logos.bubble.lastClip', lastClip) } catch { /* ignore */ }
}

/** A clipboard text takes the stage: it replaces what was playing, with an Undo. */
export function playClipboardText(raw: string) {
  const text = raw.trim()
  if (!text) return
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
  const push = () => {
    const s = listen.get()
    const text = s.active ? s.text : drafts.get().listen
    const info = {
      playing: s.playing || s.buffering,
      active: s.active,
      title: titleOf(s.active, text) || 'Logos',
      sub: s.active ? `Sentence ${s.current + 1} of ${s.segments.length}` : 'Ready',
    }
    const key = JSON.stringify(info)
    if (key === last) return
    last = key
    try { d.bubbleNow?.(key) } catch { /* ignore */ }
  }
  listen.subscribe(push)
  drafts.subscribe(push)
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

  // Arriving in Logos with the lever on: a new clipboard plays itself — the app
  // is in front now, so it is allowed to look.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !settings.get().bubbleAuto) return
    void readClipboard().then((t) => {
      const text = t.trim()
      if (!text || clipKey(text) === lastClip) return
      if (text === drafts.get().listen.trim()) { seenClip(text); return }
      playClipboardText(text)
    }).catch(() => { /* clipboard blocked */ })
  })
}
