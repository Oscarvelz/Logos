// Logos voice engine: PocketTTS (Kyutai), running on the phone's processor.
// This module is the one door the rest of the app uses: model status for the
// UI, loading, and a prioritised synthesis queue (Listen jumps the line).
import { createStore } from '../lib/store.ts'
import { settings } from '../lib/settings.ts'
import { voiceById } from '../lib/voices.ts'
import { timeStretch } from '../lib/audio.ts'
import { pocket, pocketEnsure, pocketSynth, pocketPromote, pocketClear, pocketDelete, pocketCached, pocketCacheBytes, POCKET_SIZE_MB, type PocketLang } from './pocket.ts'

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error'
export type SynthResult = { samples: Float32Array; sampleRate: number; ms: number }

export type EngineState = {
  status: ModelStatus
  /** 0..1 download progress (bytes) */
  progress: number
  loaded: number
  total: number
  error: string | null
  /** the model is saved on this device */
  cached: boolean
  /** render seconds per second of audio, last measured */
  lastRtf: number | null
  loadMs: number | null
  /** while loading: 'download' = fetching from the internet, 'warm' = already on the phone, loading into memory */
  phase: 'download' | 'warm' | null
  /** language model being shown */
  lang: PocketLang | null
}

export { POCKET_SIZE_MB, pocketCacheBytes }

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* blocked */ } },
  del: (k: string) => { try { localStorage.removeItem(k) } catch { /* blocked */ } },
}

let cachedFlag = false
const wantedLang = (): PocketLang => (settings.get().langMode === 'es' ? 'es' : 'en')

function compute(): EngineState {
  const p = pocket.get()
  const lang: PocketLang = p.active ?? wantedLang()
  const l = p.langs[lang]
  const anyReady = (['en', 'es'] as PocketLang[]).some((x) => p.langs[x].status === 'ready')
  const status: ModelStatus = l.status === 'loading' ? 'loading' : l.status === 'ready' || anyReady ? 'ready' : l.status === 'error' ? 'error' : 'idle'
  return {
    status,
    progress: l.total ? l.loaded / l.total : 0,
    loaded: l.loaded,
    total: l.total,
    error: l.error,
    cached: cachedFlag || anyReady,
    lastRtf: p.lastRtf,
    loadMs: l.loadMs,
    phase: l.status === 'loading' ? (l.fromCache || (cachedFlag && !l.total) ? 'warm' : 'download') : null,
    lang,
  }
}

export const engine = createStore<EngineState>(compute())
pocket.subscribe(() => engine.set(compute()))

// Crash guard: if the app closed while loading last time, don't auto-load on
// start (play still loads it on demand), so a bad load can't become a loop.
const LOADING_KEY = 'logos.loadingSince'
let crashedLastTime: boolean | null = null
export function lastLoadCrashed(): boolean {
  if (crashedLastTime !== null) return crashedLastTime
  const t = Number(ls.get(LOADING_KEY) ?? 0)
  ls.del(LOADING_KEY)
  crashedLastTime = t > 0 && Date.now() - t < 10 * 60_000
  return crashedLastTime
}
pocket.subscribe(() => {
  const busy = (['en', 'es'] as PocketLang[]).some((x) => pocket.get().langs[x].status === 'loading')
  if (busy) { if (!ls.get(LOADING_KEY)) ls.set(LOADING_KEY, String(Date.now())) } else ls.del(LOADING_KEY)
})

/** Load the voice (from the phone after the first download). */
export function ensureModel(): Promise<void> {
  return pocketEnsure(pocket.get().active ?? wantedLang())
}

export function synthesize(text: string, voice: string, speed: number, opts: { priority?: number; signal?: AbortSignal } = {}): Promise<SynthResult> {
  const v = voiceById(voice)
  const lang: PocketLang = v?.lang === 'es' ? 'es' : 'en'
  return pocketSynth(text, lang, voice.replace(/^pk_/, ''), opts).then((r) =>
    speed && Math.abs(speed - 1) > 0.01 ? { ...r, samples: timeStretch(r.samples, r.sampleRate, speed) } : r)
}

export const promote = pocketPromote
export const clearQueue = pocketClear

export async function isModelCached(): Promise<boolean> {
  cachedFlag = await pocketCached(wantedLang())
  engine.set(compute())
  return cachedFlag
}

/** Remove the downloaded voice models from this device. */
export async function deleteModel() {
  await pocketDelete()
  cachedFlag = false
  engine.set(compute())
}

export async function storageEstimate(): Promise<{ quota: number; usage: number }> {
  try { const e = await navigator.storage?.estimate?.(); return { quota: e?.quota ?? 0, usage: e?.usage ?? 0 } } catch { return { quota: 0, usage: 0 } }
}

/**
 * Older versions of Logos used another voice engine. Clear the model caches and
 * settings it left on the phone. Runs once per device.
 */
export async function removeLegacyEngine() {
  if (ls.get('logos.legacyRemoved') === '1') return
  for (const name of ['transformers-cache', 'kokoro-voices']) { try { await caches.delete(name) } catch { /* ignore */ } }
  for (const k of ['logos.gpuBroken', 'logos.gpuFp16Broken', 'logos.gpuWhy', 'logos.mig110', 'logos.mig123', 'logos.spin']) ls.del(k)
  ls.set('logos.legacyRemoved', '1')
}
