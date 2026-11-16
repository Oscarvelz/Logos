import { createStore } from './store.ts'
import { VOICE_BY_ID, type Lang } from './voices.ts'

export type Theme = 'dark' | 'light' | 'system' | 'tron' | 'cyberpunk'
/** The original family — the electric themes are guests beside it. */
export type LegacyTheme = 'dark' | 'light' | 'system'

export type Settings = {
  theme: Theme
  /** The Legacy mode he last chose — returning to Legacy restores it (1.4.165). */
  lastLegacy: LegacyTheme
  /** The app's own language — every word of the interface. */
  uiLang: 'en' | 'es'
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
  /** The bubble's panel shows the words being read. */
  bubbleText: boolean
  /** The floating window's look (1.4.157): the bubble's resting opacity, percent. */
  bubbleAlpha: number
  /** The panel card's opacity, percent. */
  panelAlpha: number
  /** The bubble dims to a whisper when idle. */
  bubbleFade: boolean
  /** The bubble's size: 's' | 'm' | 'l'. */
  bubbleSize: string
  highlight: boolean
  /** Word highlight timing nudge in ms (+ = earlier). For Bluetooth delay. */
  wordLeadMs: number
  /** Listen reader text size, as a multiplier of the base size. */
  readerScale: number
  /** Time jumps (1.4.163, Oscar): the rewind key leaps this many seconds back… */
  jumpBackSec: number
  /** …and the forward key this many ahead. His defaults: 15 and 30. */
  jumpFwdSec: number
}

const KEY = 'logos.settings.v1'
// Oscar's favorite Phonon voices: Noa, Marcos, Zoey, Teddy, Spencer, Freya.
const PHONON_FAVORITES = ['ph_b6FvJAiokjdqIti4', 'ph_jvPx8j8zLGQ3utZz', 'ph_NbpkqMVS3CJeq2j8', 'ph_Zn7g6NxLqXlJb7Qi', 'ph_JOW0vchyswkQUMDS', 'ph_GgfEkEJtxZR7gnpy']

/** The starting favorites (gold star). Anything Oscar stars later gets the violet star. */
export const ORIGINAL_FAVORITES = [...PHONON_FAVORITES, 'pk_alba', 'pk_lola']
export const isOriginalFavorite = (id: string) => ORIGINAL_FAVORITES.includes(id)

const DEFAULTS: Settings = {
  theme: 'dark',
  lastLegacy: 'dark',
  uiLang: 'en',
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
  bubbleText: true,
  bubbleAlpha: 100,
  panelAlpha: 100,
  bubbleFade: true,
  bubbleSize: 'm',
  highlight: true,
  wordLeadMs: 90,
  readerScale: 1,
  jumpBackSec: 15,
  jumpFwdSec: 30,
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
    // defaultVoice merges only from a real object — a string/array
    // stored there must not smear its indices over the defaults.
    const dvRaw = parsed.defaultVoice && typeof parsed.defaultVoice === 'object' && !Array.isArray(parsed.defaultVoice) ? parsed.defaultVoice : {}
    const out = { ...DEFAULTS, ...parsed, defaultVoice: { ...DEFAULTS.defaultVoice, ...dvRaw } }
    // Sanitisation (H-32 cure, 2026-11-15): load used to trust every
    // field but theme/lastLegacy, so a wrong-typed value was carried
    // into the store and mangled by use — a string `favorites` made
    // favoriteVoices() throw on voice surfaces, and toggleFavorite
    // then spread it into a per-character array and PERSISTED the
    // corruption. Now every field load reads is repaired here, at
    // the door, with the same instinct as backup.ts's settingsPatch:
    // enums against their whitelists, numbers finite, booleans
    // boolean, favorites an array of strings. A stored 0 stays 0 —
    // only a value of the wrong kind falls back to its default.
    // Unknown top-level fields still survive the spread untouched:
    // that honesty was attacked and held, and stays held.
    if (!['dark', 'light', 'system', 'tron', 'cyberpunk'].includes(out.theme)) out.theme = DEFAULTS.theme
    if (!['dark', 'light', 'system'].includes(out.lastLegacy)) out.lastLegacy = DEFAULTS.lastLegacy
    if (!['en', 'es'].includes(out.uiLang)) out.uiLang = DEFAULTS.uiLang
    if (!['en', 'es', 'auto'].includes(out.langMode)) out.langMode = DEFAULTS.langMode
    if (!['mp3', 'wav'].includes(out.format)) out.format = DEFAULTS.format
    if (!['s', 'm', 'l'].includes(out.bubbleSize)) out.bubbleSize = DEFAULTS.bubbleSize
    for (const k of ['autoDownload', 'deviceFallback', 'bubbleOn', 'bubbleAuto', 'bubbleText', 'bubbleFade', 'highlight'] as const) {
      if (typeof out[k] !== 'boolean') out[k] = DEFAULTS[k]
    }
    for (const k of ['listenSpeed', 'exportSpeed', 'sentencePauseMs', 'bubbleAlpha', 'panelAlpha', 'wordLeadMs', 'readerScale', 'jumpBackSec', 'jumpFwdSec'] as const) {
      if (typeof out[k] !== 'number' || !Number.isFinite(out[k])) out[k] = DEFAULTS[k]
    }
    if (Array.isArray(out.favorites)) out.favorites = out.favorites.filter((f) => typeof f === 'string')
    else out.favorites = [...DEFAULTS.favorites]
    if (out.voiceOverride !== null && typeof out.voiceOverride !== 'string') out.voiceOverride = null
    if (typeof out.defaultVoice.en !== 'string') out.defaultVoice.en = DEFAULTS.defaultVoice.en
    if (typeof out.defaultVoice.es !== 'string') out.defaultVoice.es = DEFAULTS.defaultVoice.es
    return out
  } catch {
    return DEFAULTS
  }
}

const initial = load()
// Settings migrations.
//
// H-4 cure (2026-11-15): a migration's done-flag used to be written
// BEFORE the migrated settings were persisted, and the persist
// swallowed its own failure — one quota failure burned all three
// flags while the stored JSON stayed pre-migration, and the
// migrations never ran again. Now flags wait in `pendingFlags` and
// are flushed only after the migrated settings are durably written
// (see persistSettings below; the subscriber flushes them too if a
// later set is the first write that lands). A failed write sets no
// flag, so the migration retries on the next launch.
//
// Already-burned flags on real devices get a one-time healing pass:
// while only the legacy flag is set and the cure's verified flag
// (`<flag>.v2`) is not, the migration re-checks the data's shape and
// re-applies — idempotently — if it still shows the pre-migration
// shape. The verified flag then closes the pass for good, so a value
// the user deliberately chooses afterwards is never touched again.
let migrateEngine = false
const pendingFlags: string[] = []
const flagIs = (k: string) => localStorage.getItem(k) === '1'
const queueFlag = (k: string) => { if (!pendingFlags.includes(k)) pendingFlags.push(k) }
// 1.0.5: the built-in device voice is off by default (Oscar finds it ugly).
try {
  if (!flagIs('logos.mig105.v2')) {
    if (initial.deviceFallback) { initial.deviceFallback = false; migrateEngine = true }
    queueFlag('logos.mig105')
  }
} catch { /* storage blocked */ }
// Voices are Phonon (ph_) or PocketTTS (pk_). Anything else saved by
// an older version of Logos is dropped here — including Pocket Fast
// (ds_), removed in 1.4.142, and Kokoro (kk_), removed in 1.4.146,
// both by Oscar's verdict: a saved removed-engine default lands on
// Pocket Alba/Lola, an override clears, favorites filter out.
// H-29 cure (2026-11-15, T7-01 = T4-13): the prefix was the whole
// gate, so a Phonon voice REMOVED or renamed in a later catalogue —
// or restored from a backup made by another version — kept its
// passing ph_ shape and survived as a ghost: no default flag in
// Voices, the raw id in the picker, and a nonexistent .safetensors
// fetched for every sentence of that language. The prefix stays as
// the first filter (kk_/ds_ still die there); the id must now also
// EXIST in the real catalogue (voices.ts imports nothing from here,
// so this value import closes no cycle).
try {
  const ok = (id: string | null | undefined) => Boolean(id && (id.startsWith('pk_') || id.startsWith('ph_')) && VOICE_BY_ID.has(id as string))
  const d = initial.defaultVoice
  // Repaired per key, in place: rebuilding the object would drop
  // any other keys a newer version stored inside defaultVoice.
  if (!ok(d.en)) { d.en = 'pk_alba'; migrateEngine = true }
  if (!ok(d.es)) { d.es = 'pk_lola'; migrateEngine = true }
  if (initial.voiceOverride && !ok(initial.voiceOverride)) { initial.voiceOverride = null; migrateEngine = true }
  const favs = initial.favorites.filter(ok)
  if (favs.length !== initial.favorites.length) { initial.favorites = favs.length ? favs : ['pk_alba', 'pk_lola']; migrateEngine = true }
  if ('engine' in initial) { delete (initial as Partial<Settings> & { engine?: unknown }).engine; migrateEngine = true }
  localStorage.removeItem('logos.mig120')
} catch { /* storage blocked */ }
// 1.4.0: Phonon arrives. Its favorites go to the top and become the defaults once;
// Pocket voices and choices stay.
try {
  if (!flagIs('logos.mig140.v2')) {
    // The healing pass re-applies this migration ONLY on proof, not
    // on a resemblance (M-29 cure, 2026-11-15): favorites must be
    // EXACTLY the pre-1.4.0 shipped defaults — the Pocket pair, in
    // shipped order — with Pocket defaults in both languages. The
    // old fingerprint (Pocket defaults + no Phonon favorite) also
    // matches a settled user who deliberately un-starred every
    // Phonon voice and re-chose the Pocket defaults: their favorites
    // are THEIRS, and the old gate re-ran on them, prepending the
    // Phonon six and overwriting their defaults. Anything that is
    // not provably the shipped state is the user's and stays —
    // a burned-flag device whose owner had customised even one
    // favorite keeps its Pocket defaults un-migrated rather than
    // lose a real choice; the .v2 flag then closes the pass for
    // good, exactly as on a healed device. A fresh install (no
    // legacy flag) always applies — that is the migration itself,
    // not the healing.
    const SHIPPED_PRE140_FAVORITES = ['pk_alba', 'pk_lola']
    const provenPre140 = Array.isArray(initial.favorites)
      && initial.favorites.length === SHIPPED_PRE140_FAVORITES.length
      && initial.favorites.every((f, i) => f === SHIPPED_PRE140_FAVORITES[i])
      && initial.defaultVoice.en === 'pk_alba' && initial.defaultVoice.es === 'pk_lola'
    if (!flagIs('logos.mig140') || provenPre140) {
      initial.favorites = [...PHONON_FAVORITES, ...initial.favorites.filter((f) => !PHONON_FAVORITES.includes(f))]
      // Per key, in place (M-26 residue): rebuilding defaultVoice as
      // a fresh two-key object would drop any other keys a newer
      // version stored inside it — the same disease the engine-voice
      // cleanup above was cured of.
      initial.defaultVoice.en = 'ph_NbpkqMVS3CJeq2j8'
      initial.defaultVoice.es = 'ph_b6FvJAiokjdqIti4'
      initial.voiceOverride = null
      migrateEngine = true
    }
    queueFlag('logos.mig140')
  }
} catch { /* storage blocked */ }
// 1.4.172 (Oscar): the bubble's preselected size is Standard — «a
// better place for it to have as a pre-selection». A stored Small
// from before this word becomes Standard once; a Small chosen after
// this migration is his and stays.
try {
  if (!flagIs('logos.mig172.v2')) {
    if (initial.bubbleSize === 's') { initial.bubbleSize = 'm'; migrateEngine = true }
    queueFlag('logos.mig172')
  }
} catch { /* storage blocked */ }
export const settings = createStore<Settings>(initial)
/** Flush the pending migration flags — called only once the settings
 *  they belong to are durably written, so a flag can never again get
 *  ahead of its payload (H-4). Sets the legacy flag and its verified
 *  twin together. */
function flushFlags() {
  for (const k of pendingFlags.splice(0)) {
    try { localStorage.setItem(k, '1') } catch { /* storage blocked */ }
    try { localStorage.setItem(`${k}.v2`, '1') } catch { /* storage blocked */ }
  }
}
function persistSettings(): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(settings.get())); return true } catch { return false }
}
settings.subscribe(() => {
  if (persistSettings() && pendingFlags.length) flushFlags()
})
if (migrateEngine) { if (persistSettings()) flushFlags() }
else if (pendingFlags.length) flushFlags()

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
  const meta = document.querySelector('meta[name="theme-color"]')
  if (theme === 'tron') {
    document.documentElement.dataset.theme = 'tron'
    meta?.setAttribute('content', '#02060c')
    return
  }
  if (theme === 'cyberpunk') {
    document.documentElement.dataset.theme = 'cyberpunk'
    meta?.setAttribute('content', '#0b0a08')
    return
  }
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  meta?.setAttribute('content', dark ? '#0a0a0f' : '#f6f2ea')
}
