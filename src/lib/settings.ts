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
  highlight: boolean
}

const KEY = 'logos.settings.v1'

const DEFAULTS: Settings = {
  theme: 'dark',
  listenSpeed: 1,
  exportSpeed: 1,
  defaultVoice: { en: 'pk_alba', es: 'pk_lola' },
  favorites: ['pk_alba', 'pk_lola'],
  langMode: 'auto',
  voiceOverride: null,
  format: 'mp3',
  sentencePauseMs: 220,
  autoDownload: true,
  deviceFallback: false,
  highlight: true,
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
// Every voice is a PocketTTS voice (ids start with pk_). Anything else saved by
// an older version of Logos is dropped here.
try {
  const ok = (id: string | null | undefined) => Boolean(id && id.startsWith('pk_'))
  const d = initial.defaultVoice
  if (!ok(d.en) || !ok(d.es)) { initial.defaultVoice = { en: ok(d.en) ? d.en : 'pk_alba', es: ok(d.es) ? d.es : 'pk_lola' }; migrateEngine = true }
  if (initial.voiceOverride && !ok(initial.voiceOverride)) { initial.voiceOverride = null; migrateEngine = true }
  const favs = initial.favorites.filter(ok)
  if (favs.length !== initial.favorites.length) { initial.favorites = favs.length ? favs : ['pk_alba', 'pk_lola']; migrateEngine = true }
  if ('engine' in initial) { delete (initial as Partial<Settings> & { engine?: unknown }).engine; migrateEngine = true }
  localStorage.removeItem('logos.mig120')
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
