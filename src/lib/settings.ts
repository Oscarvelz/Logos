import { createStore } from './store.ts'
import type { Lang } from './voices.ts'

export type Theme = 'dark' | 'light' | 'system'
export type EngineChoice = 'auto' | 'webgpu' | 'wasm'

export type Settings = {
  theme: Theme
  engine: EngineChoice
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
  engine: 'auto',
  listenSpeed: 1,
  exportSpeed: 1,
  defaultVoice: { en: 'af_heart', es: 'ef_dora' },
  favorites: ['af_heart', 'bf_emma', 'ef_dora'],
  langMode: 'auto',
  voiceOverride: null,
  format: 'mp3',
  sentencePauseMs: 220,
  autoDownload: true,
  deviceFallback: true,
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

const isPhone = () => {
  try {
    const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData
    return uaData?.mobile ?? /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
  } catch { return false }
}

const initial = load()
// WebGPU is not offered on phones any more (it crashed or failed there).
const migrateEngine = initial.engine === 'webgpu' && isPhone()
if (migrateEngine) initial.engine = 'auto'
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
