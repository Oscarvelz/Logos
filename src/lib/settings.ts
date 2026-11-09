import { createStore } from './store.ts'
import type { Lang } from './voices.ts'

export type Theme = 'dark' | 'light' | 'system'

export type Settings = {
  theme: Theme
  listenSpeed: number
  exportSpeed: number
  defaultVoice: Record<Lang, string>
  favorites: string[]
  langMode: Lang | 'auto'
  /** manual voice override for Listen; null = default voice per language */
  voiceOverride: string | null
  format: 'mp3' | 'wav'
  sentencePauseMs: number
  autoDownload: boolean
  deviceFallback: boolean
  /** Floating bubble over other apps (Logos app, shell android-18+). */
  bubbleOn: boolean
  /** The bubble's lever: ON = the bubble plays what's copied; OFF = it only controls playback. */
  bubbleAuto: boolean
  highlight: boolean
  /** Word highlight timing nudge in ms (+ = earlier). For Bluetooth delay. */
  wordLeadMs: number
  /** Listen reader text size, as a multiplier of the base size. */
  readerScale: number
}

const KEY = 'logos.settings.v1'
// Oscar's favorite Phonon voices: Noa, Marcos, Zoey, Teddy, Spencer, Freya.
const PHONON_FAVORITES = ['ph_b6FvJAiokjdqIti4', 'ph_jvPx8j8zLGQ3utZz', 'ph_NbpkqMVS3CJeq2j8', 'ph_Zn7g6NxLqXlJb7Qi', 'ph_JOW0vchyswkQUMDS', 'ph_GgfEkEJtxZR7gnpy']

/** The starting favorites (gold star). Anything Oscar stars later gets the violet star. */
export const ORIGINAL_FAVORITES = [...PHONON_FAVORITES, 'pk_alba', 'pk_lola']
export const isOriginalFavorite = (id: string) => ORIGINAL_FAVORITES.includes(id)

const DEFAULTS: Settings = {
  theme: 'dark',
  listenSpeed: 1,
  exportSpeed: 1,
  defaultVoice: { en: 'ph_NbpkqMVS3CJeq2j8', es: 'ph_b6FvJAiokjdqIti4' },
  favorites: [...ORIGINAL_FAVORITES],
  langMode: 'auto',
  voiceOverride: null,
  format: 'mp3',
  sentencePauseMs: 220,
  autoDownload: true,
  deviceFallback: false,
  bubbleOn: false,
  bubbleAuto: true,
  highlight: true,
  wordLeadMs: 90,
  readerScale: 1,
}

/** The reader's size ladder — A− and A+ walk it one rung at a time. */
export const READER_SCALES = [0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2]
export function stepReaderScale(current: number, dir: 1 | -1): number {
  let i = READER_SCALES.indexOf(current)
  if (i < 0) { let best = 0; READER_SCALES.forEach((v, j) => { if (Math.abs(v - current) < Math.abs(READER_SCALES[best] - current)) best = j }); i = best }
  return READER_SCALES[Math.min(READER_SCALES.length - 1, Math.max(0, i + dir))]
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULTS, ...parsed, defaultVoice: { ...DEFAULTS.defaultVoice, ...(parsed.defaultVoice ?? {}) } }
  } catch {
    return DEFAULTS
  }
}

const initial = load()
// Settings migrations.
let migrateEngine = false
// 1.0.5: the built-in device voice is off by default (Oscar finds it ugly).
try {
  if (localStorage.getItem('logos.mig105') !== '1') {
    localStorage.setItem('logos.mig105', '1')
    if (initial.deviceFallback) { initial.deviceFallback = false; migrateEngine = true }
  }
} catch { /* storage blocked */ }
// Voices are Phonon (ph_) or PocketTTS (pk_). Anything else saved by an older
// version of Logos is dropped here.
try {
  const ok = (id: string | null | undefined) => Boolean(id && (id.startsWith('pk_') || id.startsWith('ph_')))
  const d = initial.defaultVoice
  if (!ok(d.en) || !ok(d.es)) { initial.defaultVoice = { en: ok(d.en) ? d.en : 'pk_alba', es: ok(d.es) ? d.es : 'pk_lola' }; migrateEngine = true }
  if (initial.voiceOverride && !ok(initial.voiceOverride)) { initial.voiceOverride = null; migrateEngine = true }
  const favs = initial.favorites.filter(ok)
  if (favs.length !== initial.favorites.length) { initial.favorites = favs.length ? favs : ['pk_alba', 'pk_lola']; migrateEngine = true }
  if ('engine' in initial) { delete (initial as Partial<Settings> & { engine?: unknown }).engine; migrateEngine = true }
  localStorage.removeItem('logos.mig120')
} catch { /* storage blocked */ }
// 1.4.0: Phonon arrives. Its favorites go to the top and become the defaults once;
// Pocket voices and choices stay.
try {
  if (localStorage.getItem('logos.mig140') !== '1') {
    localStorage.setItem('logos.mig140', '1')
    initial.favorites = [...PHONON_FAVORITES, ...initial.favorites.filter((f) => !PHONON_FAVORITES.includes(f))]
    initial.defaultVoice = { en: 'ph_NbpkqMVS3CJeq2j8', es: 'ph_b6FvJAiokjdqIti4' }
    initial.voiceOverride = null
    migrateEngine = true
  }
} catch { /* storage blocked */ }
export const settings = createStore<Settings>(initial)
settings.subscribe(() => {
  try { localStorage.setItem(KEY, JSON.stringify(settings.get())) } catch { /* storage blocked */ }
})
if (migrateEngine) { try { localStorage.setItem(KEY, JSON.stringify(settings.get())) } catch { /* storage blocked */ } }

export function toggleFavorite(id: string) {
  settings.set((s) => ({ favorites: s.favorites.includes(id) ? s.favorites.filter((f) => f !== id) : [...s.favorites, id] }))
}

// ── Last text (kept separately: can be large) ──
const TEXT_KEY = 'logos.lastText'
export function loadLastText(): string {
  try { return localStorage.getItem(TEXT_KEY) ?? '' } catch { return '' }
}
let saveTimer: number | undefined
export function saveLastText(text: string) {
  clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    try { localStorage.setItem(TEXT_KEY, text) } catch { /* quota */ }
  }, 300)
}

export function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a0a0f' : '#f6f2ea')
}
