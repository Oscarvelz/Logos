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
  defaultVoice: { en: 'pk_alba', es: 'pk_lola' },
  favorites: ['pk_alba', 'pk_lola', 'af_heart'],
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
// WebGPU is not offered on phones any more (it crashed or failed there).
let migrateEngine = false
// 1.0.5: the built-in device voice is off by default (Oscar finds it ugly).
try {
  if (localStorage.getItem('logos.mig105') !== '1') {
    localStorage.setItem('logos.mig105', '1')
    if (initial.deviceFallback) { initial.deviceFallback = false; migrateEngine = true }
  }
} catch { /* storage blocked */ }
// 1.2.0: PocketTTS voices become the defaults (much faster on phones; Oscar
// preferred them to Kokoro). Kokoro voices stay one tap away.
try {
  if (localStorage.getItem('logos.mig120') !== '1') {
    localStorage.setItem('logos.mig120', '1')
    initial.defaultVoice = { en: 'pk_alba', es: 'pk_lola' }
    if (initial.voiceOverride && !initial.voiceOverride.startsWith('pk_')) initial.voiceOverride = null
    for (const f of ['pk_alba', 'pk_lola']) if (!initial.favorites.includes(f)) initial.favorites = [f, ...initial.favorites]
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
