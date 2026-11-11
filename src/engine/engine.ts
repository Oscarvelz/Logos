// Logos voice engines: Phonon (Gradium), PocketTTS (Kyutai) and Kokoro
// (hexgrad), all running on the phone's processor. This module is the
// one door the rest of the app uses: model status for the UI, loading,
// and a prioritised synthesis queue (Listen jumps the line). Each voice
// belongs to one engine.
import { createStore } from '../lib/store.ts'
import { settings } from '../lib/settings.ts'
import { voiceById, type EngineKind } from '../lib/voices.ts'
import { timeStretch } from '../lib/audio.ts'
import { t } from '../lib/i18n.ts'
import { pocket, pocketEnsure, pocketSynth, pocketPromote, pocketClear, pocketDelete, pocketCached, pocketCacheBytes, pocketRelease, onPocketBeforeLoad, POCKET_SIZE_MB, type PocketLang } from './pocket.ts'
import { phonon, phononEnsure, phononSynth, phononPromote, phononClear, phononDelete, phononCached, phononCacheBytes, phononRelease, phononLoaded, onPhononBeforeLoad, PHONON_SIZE_MB } from './phonon.ts'
import { kokoro, kokoroEnsure, kokoroSynth, kokoroPromote, kokoroClear, kokoroDelete, kokoroCached, kokoroCacheBytes, kokoroRelease, onKokoroBeforeLoad, KOKORO_SIZE_MB } from './kokoro.ts'

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
  /** engine of the voice in use */
  kind: EngineKind
  /** CPU threads Phonon runs on */
  threads: number | null
}

export { POCKET_SIZE_MB, PHONON_SIZE_MB, KOKORO_SIZE_MB, pocketCacheBytes }
export async function modelCacheBytes(): Promise<number> {
  const [a, b, c] = await Promise.all([pocketCacheBytes(), phononCacheBytes(), kokoroCacheBytes()])
  return a + b + c
}

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* blocked */ } },
  del: (k: string) => { try { localStorage.removeItem(k) } catch { /* blocked */ } },
}

let cachedFlag = false
const wantedLang = (): PocketLang => (settings.get().langMode === 'es' ? 'es' : 'en')
/** The engine of the voice Listen will use. */
let lastKind: EngineKind | null = null
function activeKind(): EngineKind {
  if (lastKind) return lastKind
  const st = settings.get()
  const id = st.voiceOverride ?? st.defaultVoice[wantedLang()]
  return voiceById(id)?.engine ?? 'phonon'
}
const kindOf = (voice: string): EngineKind => voiceById(voice)?.engine ?? (voice.startsWith('pk_') ? 'pocket' : voice.startsWith('kk_') ? 'kokoro' : 'phonon')

// Phones run out of memory with several models loaded: loading one engine
// frees the other unless the device has plenty of memory.
const roomy = () => ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4) >= 8
onPhononBeforeLoad((lang) => {
  if (!roomy()) { pocketRelease(); kokoroRelease(); for (const l of phononLoaded()) if (l !== lang) phononRelease(l) }
})
onPocketBeforeLoad(() => { if (!roomy()) { kokoroRelease(); for (const l of phononLoaded()) phononRelease(l) } })
onKokoroBeforeLoad(() => { pocketRelease(); for (const l of phononLoaded()) phononRelease(l) })

function compute(): EngineState {
  const k = activeKind()
  return k === 'phonon' ? computeFrom(phonon.get(), 'phonon') : k === 'kokoro' ? computeFrom(kokoro.get(), 'kokoro') : computeFrom(pocket.get(), 'pocket')
}

/** A download that died on the network says so in human words, never the
 *  browser's raw «Failed to fetch» (audit D-S2); anything else passes
 *  through untouched. */
const friendlyError = (e: string | null): string | null =>
  e && /failed to fetch|network|load failed|fetch/i.test(e) ? t('Could not download the voice model — check your connection and try again') : e

function computeFrom(p: { langs: Record<PocketLang, { status: string; loaded: number; total: number; error: string | null; loadMs: number | null; fromCache: boolean }>; active: PocketLang | null; lastRtf: number | null; threads?: number | null }, kind: EngineKind): EngineState {
  const lang: PocketLang = p.active ?? wantedLang()
  const l = p.langs[lang]
  const anyReady = (['en', 'es'] as PocketLang[]).some((x) => p.langs[x].status === 'ready')
  const status: ModelStatus = l.status === 'loading' ? 'loading' : l.status === 'ready' || anyReady ? 'ready' : l.status === 'error' ? 'error' : 'idle'
  return {
    status,
    progress: l.total ? l.loaded / l.total : 0,
    loaded: l.loaded,
    total: l.total,
    error: friendlyError(l.error),
    cached: cachedFlag || anyReady,
    lastRtf: p.lastRtf,
    loadMs: l.loadMs,
    phase: l.status === 'loading' ? (l.fromCache || (cachedFlag && !l.total) ? 'warm' : 'download') : null,
    lang,
    kind,
    threads: p.threads ?? null,
  }
}

export const engine = createStore<EngineState>(compute())
pocket.subscribe(() => engine.set(compute()))
phonon.subscribe(() => engine.set(compute()))
kokoro.subscribe(() => engine.set(compute()))
settings.subscribe(() => { lastKind = null; engine.set(compute()) })

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
const watchLoading = () => {
  const busy = (['en', 'es'] as PocketLang[]).some((x) => pocket.get().langs[x].status === 'loading' || phonon.get().langs[x].status === 'loading') || kokoro.get().langs.en.status === 'loading'
  if (busy) { if (!ls.get(LOADING_KEY)) ls.set(LOADING_KEY, String(Date.now())) } else ls.del(LOADING_KEY)
}
pocket.subscribe(watchLoading)
phonon.subscribe(watchLoading)
kokoro.subscribe(watchLoading)

/** Load the voice (from the phone after the first download). */
export function ensureModel(): Promise<void> {
  const k = activeKind()
  if (k === 'phonon') return phononEnsure(phonon.get().active ?? wantedLang())
  if (k === 'kokoro') return kokoroEnsure()
  return pocketEnsure(pocket.get().active ?? wantedLang())
}

export function synthesize(text: string, voice: string, speed: number, opts: { priority?: number; signal?: AbortSignal } = {}): Promise<SynthResult> {
  const v = voiceById(voice)
  const lang: PocketLang = v?.lang === 'es' ? 'es' : 'en'
  const kind = kindOf(voice)
  if (opts.priority && opts.priority >= 1000 && kind !== lastKind) { lastKind = kind; engine.set(compute()) }
  const job = kind === 'phonon' ? phononSynth(text, lang, voice, opts) : kind === 'kokoro' ? kokoroSynth(text, v?.kid ?? 'af_heart', opts) : pocketSynth(text, lang, voice.replace(/^pk_/, ''), opts)
  return job.then((r) =>
    speed && Math.abs(speed - 1) > 0.01 ? { ...r, samples: timeStretch(r.samples, r.sampleRate, speed) } : r)
}

export function promote(signal: AbortSignal, priority: number) { pocketPromote(signal, priority); phononPromote(signal, priority); kokoroPromote(signal, priority) }
export function clearQueue(maxPriority?: number) { pocketClear(maxPriority); phononClear(maxPriority); kokoroClear(maxPriority) }

export async function isModelCached(): Promise<boolean> {
  const k = activeKind()
  cachedFlag = k === 'phonon' ? await phononCached() : k === 'kokoro' ? await kokoroCached() : await pocketCached(wantedLang())
  engine.set(compute())
  return cachedFlag
}

/** Remove the downloaded voice models from this device. */
export async function deleteModel() {
  await pocketDelete()
  await phononDelete()
  await kokoroDelete()
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
  // The 'transformers-cache' and 'kokoro-voices' caches are NOT purged:
  // they belonged to the old engine this cleanup was written for, and
  // since 1.4.143 they belong to Kokoro again, a first-class engine.
  for (const k of ['logos.gpuBroken', 'logos.gpuFp16Broken', 'logos.gpuWhy', 'logos.mig110', 'logos.mig123', 'logos.spin']) ls.del(k)
  ls.set('logos.legacyRemoved', '1')
}
