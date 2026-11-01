// Main-thread client for the Kokoro worker: model lifecycle, download progress,
// and a prioritised synthesis queue (one job in flight; Listen jumps the line).
import { createStore } from '../lib/store.ts'
import { settings, type EngineChoice } from '../lib/settings.ts'
import { voiceById } from '../lib/voices.ts'
import type { Device, Dtype, ProgressInfo, WorkerRequest, WorkerResponse } from './tts.worker.ts'
import { pocket, pocketEnsure, pocketSynth, pocketPromote, pocketClear, pocketDelete, pocketCached, pocketCacheBytes, POCKET_SIZE_MB, type PocketLang } from './pocket.ts'
import { timeStretch } from '../lib/audio.ts'

export type ModelStatus = 'idle' | 'checking' | 'loading' | 'ready' | 'error'

export type EngineState = {
  status: ModelStatus
  /** 0..1 download progress (bytes) */
  progress: number
  loaded: number
  total: number
  device: Device | null
  dtype: Dtype | null
  error: string | null
  cached: boolean
  webgpu: boolean | null
  /** The GPU supports half-precision shaders (needed for the fp16 model). */
  f16: boolean | null
  lastRtf: number | null
  loadMs: number | null
  /** while loading: 'download' = fetching from the internet, 'warm' = model is on the phone, starting it up */
  phase: 'download' | 'warm' | null
}

/** Kokoro's own state. The UI reads `engine`, which shows whichever engine your voices use. */
export const kokoro = createStore<EngineState>({
  status: 'idle', progress: 0, loaded: 0, total: 0, device: null, dtype: null,
  error: null, cached: false, webgpu: null, f16: null, lastRtf: null, loadMs: null, phase: null,
})

const MODEL_FILES: Record<Dtype, string> = {
  q8: 'onnx/model_quantized.onnx',
  fp16: 'onnx/model_fp16.onnx',
  fp32: 'onnx/model.onnx',
}
export const MODEL_SIZE_MB: Record<Dtype, number> = { q8: 92, fp16: 163, fp32: 326 }

let worker: Worker | null = null

// ── Crash / GPU guards ──
// Phones: WebGPU + the 326 MB fp32 model either fails on the GPU driver
// ("createBuffer … too large") or runs the tab out of memory, which makes
// Android reload the page and start the load again — the "installs itself
// over and over" loop. So: phones always use WASM q8, a WebGPU failure is
// remembered, and a load that never finished (crash) is not retried on startup.
const GPU_BROKEN_KEY = 'logos.gpuBroken'
const LOADING_KEY = 'logos.loadingSince'
const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* blocked */ } },
  del: (k: string) => { try { localStorage.removeItem(k) } catch { /* blocked */ } },
}
// 1.1.0 moved to ONNX Runtime 1.31 (the runtime BetterTTS ships), whose WebGPU
// works on phones where the old one failed, so forget failures recorded before.
if (ls.get('logos.mig110') !== '1') { ls.set('logos.mig110', '1'); ls.del(GPU_BROKEN_KEY); ls.del('logos.gpuFp16Broken') }
// 1.2.3: Kokoro is WebGPU-only now (no CPU fallback), so give both GPU model sizes a fresh try.
if (ls.get('logos.mig123') !== '1') { ls.set('logos.mig123', '1'); ls.del(GPU_BROKEN_KEY); ls.del('logos.gpuFp16Broken') }
// fp32 (326 MB) can run a phone's GPU out of memory; the half-size fp16 model
// (163 MB) often fits, so it gets its own chance before WASM.
const GPU_FP16_BROKEN_KEY = 'logos.gpuFp16Broken'
const fp32Broken = () => ls.get(GPU_BROKEN_KEY) === '1'
const fp16Broken = () => ls.get(GPU_FP16_BROKEN_KEY) === '1'
/** True when no WebGPU model works on this device any more. */
export const gpuBroken = () => fp32Broken() && (fp16Broken() || kokoro.get().f16 === false)
function markGpuBroken(dtype: Dtype | null = requestedDtype) {
  ls.set(dtype === 'fp16' ? GPU_FP16_BROKEN_KEY : GPU_BROKEN_KEY, '1')
}
let crashedLastTime: boolean | null = null
/** True when the previous visit started loading the model and never finished (the tab crashed). Checked once per page load. */
export function lastLoadCrashed(): boolean {
  if (crashedLastTime !== null) return crashedLastTime
  const raw = ls.get(LOADING_KEY)
  crashedLastTime = false
  if (raw) {
    ls.del(LOADING_KEY)
    try {
      const info = JSON.parse(raw) as { device?: string; dtype?: Dtype; t?: number }
      if (Date.now() - (info.t ?? 0) < 10 * 60_000) {
        crashedLastTime = true
        if (info.device === 'webgpu') markGpuBroken(info.dtype ?? 'fp32')
      }
    } catch { /* ignore */ }
  }
  return crashedLastTime
}
let gpuRetries = 0
let requestedDevice: Device | null = null
let requestedDtype: Dtype | null = null
let loadWaiters: { resolve: () => void; reject: (e: Error) => void }[] = []
const files = new Map<string, { loaded: number; total: number }>()

type Job = {
  id: number
  text: string
  voice: string
  speed: number
  priority: number
  resolve: (r: SynthResult) => void
  reject: (e: Error) => void
  signal?: AbortSignal
}
export type SynthResult = { samples: Float32Array; sampleRate: number; ms: number }

let nextId = 1
const queue: Job[] = []
let inFlight: Job | null = null

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./tts.worker.ts', import.meta.url), { type: 'module' })
  worker.addEventListener('message', (e: MessageEvent<WorkerResponse>) => onMessage(e.data))
  worker.addEventListener('error', (e) => {
    e.preventDefault?.()
    const message = e.message || 'The speech engine crashed.'
    ls.del(LOADING_KEY)
    worker?.terminate()
    worker = null
    // The GPU took the engine down (out of graphics memory): try the other model size.
    gpuFailed(kokoro.get().dtype ?? requestedDtype, message)
  })
  return worker
}

function onMessage(msg: WorkerResponse) {
  switch (msg.type) {
    case 'progress':
      onProgress(msg.info)
      break
    case 'loaded':
      ls.del(LOADING_KEY)
      kokoro.set({ status: 'ready', progress: 1, device: msg.device, dtype: msg.dtype, error: null, cached: true, loadMs: msg.ms, phase: null })
      keepStorage()
      loadWaiters.forEach((w) => w.resolve())
      loadWaiters = []
      pump()
      break
    case 'loadError':
      ls.del(LOADING_KEY)
      if (requestedDevice === 'webgpu' && !/fetch|network|Failed to load/i.test(msg.message)) { gpuFailed(requestedDtype, msg.message); break }
      kokoro.set({ status: 'error', error: msg.message })
      loadWaiters.forEach((w) => w.reject(new Error(msg.message)))
      loadWaiters = []
      break
    case 'generated':
    case 'generateError': {
      ls.del(LOADING_KEY)
      const job = inFlight
      inFlight = null
      if (msg.type === 'generateError' && job && job.id === msg.id && kokoro.get().device === 'webgpu' && /GPU|NaN|silent|WebGPU|buffer/i.test(msg.message)) {
        // The GPU path broke mid-use (or made blank audio): try the other model size, then stop.
        inFlight = job
        gpuFailed(kokoro.get().dtype, msg.message)
        break
      }
      if (job && job.id === msg.id) {
        if (msg.type === 'generated') {
          const dur = msg.samples.length / msg.sampleRate
          if (dur > 0.5) kokoro.set({ lastRtf: msg.ms / 1000 / dur })
          job.resolve({ samples: msg.samples, sampleRate: msg.sampleRate, ms: msg.ms })
        } else job.reject(new Error(msg.message))
      }
      pump()
      break
    }
  }
}

function onProgress(info: ProgressInfo) {
  if (!info.file) return
  if (info.status === 'progress' || info.status === 'download' || info.status === 'initiate') {
    const prev = files.get(info.file) ?? { loaded: 0, total: 0 }
    files.set(info.file, { loaded: info.loaded ?? prev.loaded, total: info.total ?? prev.total })
  } else if (info.status === 'done') {
    const prev = files.get(info.file)
    if (prev) files.set(info.file, { loaded: prev.total || prev.loaded, total: prev.total || prev.loaded })
  }
  let loaded = 0
  let total = 0
  files.forEach((f) => { loaded += f.loaded; total += f.total })
  const progress = total > 0 ? Math.min(1, loaded / total) : 0
  kokoro.set({ loaded, total, progress, ...(progress >= 0.999 && kokoro.get().phase === 'download' ? { phase: 'warm' as const } : {}) })
}

export function isMobileDevice(): boolean {
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData
  return uaData?.mobile ?? /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
}

export async function probeWebGpu(): Promise<boolean> {
  const cached = kokoro.get().webgpu
  if (cached !== null) return cached
  let ok = false
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features?: Set<string> } | null> } }).gpu
    const adapter = gpu ? await gpu.requestAdapter() : null
    ok = Boolean(adapter)
    kokoro.set({ f16: Boolean(adapter?.features?.has('shader-f16')) })
  } catch { ok = false }
  kokoro.set({ webgpu: ok })
  return ok
}

/**
 * Kokoro runs only on the graphics chip (WebGPU) since 1.2.3: on Oscar's phone
 * the CPU (WASM) path made everything slow, and PocketTTS covers CPU speech much
 * better. Half-precision first (163 MB, less GPU memory), then full precision.
 * Returns null when no GPU option is left on this device.
 */
export async function resolveEngine(_choice: EngineChoice = settings.get().engine): Promise<{ device: Device; dtype: Dtype } | null> {
  const gpu = await probeWebGpu()
  if (!gpu) return null
  if (!fp16Broken() && kokoro.get().f16) return { device: 'webgpu', dtype: 'fp16' }
  if (!fp32Broken()) return { device: 'webgpu', dtype: 'fp32' }
  return null
}
export const GPU_UNAVAILABLE = 'Kokoro needs your phone’s graphics chip (WebGPU), and it didn’t work on this device. PocketTTS voices work great here.'

async function kokoroCached(): Promise<boolean> {
  try {
    const plan = await resolveEngine()
    if (!plan) { kokoro.set({ cached: false }); return false }
    const { dtype } = plan
    const cache = await caches.open('transformers-cache')
    const keys = await cache.keys()
    const hit = keys.some((k) => k.url.includes('Kokoro-82M') && k.url.endsWith(MODEL_FILES[dtype]))
    kokoro.set({ cached: hit })
    return hit
  } catch {
    return false
  }
}

function kokoroEnsure(): Promise<void> {
  const s = kokoro.get()
  if (s.status === 'ready') return Promise.resolve()
  const p = new Promise<void>((resolve, reject) => loadWaiters.push({ resolve, reject }))
  if (s.status !== 'loading') void startLoad()
  return p
}

async function startLoad() {
  files.clear()
  kokoro.set({ status: 'loading', progress: 0, loaded: 0, total: 0, error: null, phase: null })
  // Transformers.js reports "progress" even when it reads the model from the
  // phone's cache, so check first and show "Starting voice" instead of a download.
  const onPhone = await kokoroCached()
  kokoro.set({ phase: onPhone ? 'warm' : 'download' })
  const plan = await resolveEngine()
  if (!plan) { failKokoro(GPU_UNAVAILABLE); return }
  const { device, dtype } = plan
  requestedDevice = device
  requestedDtype = dtype
  ls.set(LOADING_KEY, JSON.stringify({ device, dtype, t: Date.now() }))
  // Tuning knobs (tests / diagnostics): logos.spin=1 lets ORT threads busy-wait, logos.threads=N.
  const spin = ls.get('logos.spin') === '1'
  const threads = Number(ls.get('logos.threads')) || undefined
  getWorker().postMessage({ type: 'load', device, dtype, spin, threads } satisfies WorkerRequest)
}

function failKokoro(message: string) {
  ls.del(LOADING_KEY)
  kokoro.set({ status: 'error', error: message, device: null, dtype: null })
  loadWaiters.forEach((w) => w.reject(new Error(message)))
  loadWaiters = []
  inFlight?.reject(new Error(message))
  inFlight = null
  for (const j of queue.splice(0)) j.reject(new Error(message))
}

/** A GPU attempt failed: remember it for this model size and try the next one (or stop). */
function gpuFailed(dtype: Dtype | null, why: string) {
  console.warn('[logos] WebGPU Kokoro failed:', dtype, why)
  markGpuBroken(dtype ?? requestedDtype)
  worker?.terminate()
  worker = null
  if (inFlight) { queue.unshift(inFlight); inFlight = null }
  if (gpuRetries++ < 2) { kokoro.set({ status: 'idle', device: null, dtype: null, error: null }); void startLoad(); return }
  failKokoro(GPU_UNAVAILABLE)
}

function kokoroSynth(text: string, voice: string, speed: number, opts: { priority?: number; signal?: AbortSignal } = {}): Promise<SynthResult> {
  return new Promise<SynthResult>((resolve, reject) => {
    if (opts.signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return }
    const job: Job = { id: nextId++, text, voice, speed, priority: opts.priority ?? 0, resolve, reject, signal: opts.signal }
    opts.signal?.addEventListener('abort', () => {
      const i = queue.indexOf(job)
      if (i >= 0) queue.splice(i, 1)
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
    queue.push(job)
    // stable sort: higher priority first, then FIFO
    queue.sort((a, b) => b.priority - a.priority || a.id - b.id)
    kokoroEnsure().then(pump, (e) => { const i = queue.indexOf(job); if (i >= 0) queue.splice(i, 1); reject(e) })
  })
}

function pump() {
  if (inFlight || kokoro.get().status !== 'ready') return
  const job = queue.shift()
  if (!job) return
  inFlight = job
  // If the GPU takes the whole tab down mid-sentence, the next visit sees this and uses WASM.
  if (kokoro.get().device === 'webgpu') ls.set(LOADING_KEY, JSON.stringify({ device: 'webgpu', dtype: kokoro.get().dtype, t: Date.now() }))
  const v = voiceById(job.voice)
  getWorker().postMessage({
    type: 'generate', id: job.id, text: job.text, voice: job.voice,
    phonemeLang: v?.phonemeLang ?? 'en-us', speed: job.speed,
  } satisfies WorkerRequest)
}

/** Raise the priority of a queued job (identified by its AbortSignal). */
function kokoroPromote(signal: AbortSignal, priority: number) {
  const job = queue.find((j) => j.signal === signal)
  if (!job || job.priority >= priority) return
  job.priority = priority
  queue.sort((a, b) => b.priority - a.priority || a.id - b.id)
}

/** Drop every queued (not yet running) job at or below a priority. */
function kokoroClear(maxPriority = Infinity) {
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i].priority <= maxPriority) {
      queue[i].reject(new DOMException('Aborted', 'AbortError'))
      queue.splice(i, 1)
    }
  }
}

async function kokoroDelete() {
  worker?.terminate()
  worker = null
  kokoroClear()
  inFlight = null
  for (const name of ['transformers-cache', 'kokoro-voices']) {
    try { await caches.delete(name) } catch { /* ignore */ }
  }
  kokoro.set({ status: 'idle', progress: 0, loaded: 0, total: 0, device: null, dtype: null, cached: false, error: null })
}

/** Restart with a different engine choice (worker reload). */
function kokoroReset() {
  worker?.terminate()
  worker = null
  kokoroClear()
  inFlight = null
  kokoro.set({ status: 'idle', device: null, dtype: null, progress: 0 })
}

export async function cacheUsage(): Promise<{ model: number; voices: number; quota: number; usage: number }> {
  const sum = async (name: string) => {
    let bytes = 0
    try {
      const cache = await caches.open(name)
      for (const req of await cache.keys()) {
        const res = await cache.match(req)
        const len = Number(res?.headers.get('content-length') ?? 0)
        bytes += len || (res ? (await res.clone().blob()).size : 0)
      }
    } catch { /* ignore */ }
    return bytes
  }
  const [model, voices, est] = await Promise.all([
    sum('transformers-cache'),
    sum('kokoro-voices'),
    navigator.storage?.estimate?.() ?? Promise.resolve({ quota: 0, usage: 0 }),
  ])
  return { model, voices, quota: est.quota ?? 0, usage: est.usage ?? 0 }
}

/** Ask the browser to keep the 92 MB model (Android may otherwise evict it under storage pressure). */
function keepStorage() {
  try {
    void navigator.storage?.persisted?.().then((p) => { if (!p) void navigator.storage.persist?.() })
  } catch { /* unsupported */ }
}

/** When WebGPU failed on this device, free the space the full-precision model takes. */
export async function purgeUnusedModels() {
  if (!fp32Broken() && !fp16Broken()) return
  try {
    const cache = await caches.open('transformers-cache')
    for (const k of await cache.keys()) {
      if (k.url.includes('Kokoro-82M') && ((fp32Broken() && k.url.endsWith(MODEL_FILES.fp32)) || (fp16Broken() && k.url.endsWith(MODEL_FILES.fp16)))) await cache.delete(k)
    }
  } catch { /* ignore */ }
}

// ── Facade: Kokoro + PocketTTS ──
// Each voice belongs to one engine. Your English default decides the "primary"
// engine: the one Logos loads at start and shows in the status pill.

export type Family = 'kokoro' | 'pocket'
export type ActiveEngineState = EngineState & { family: Family; pocketLang: PocketLang | null }

export function familyOf(voice: string | undefined | null): Family {
  return voice && voice.startsWith('pk_') ? 'pocket' : 'kokoro'
}
export function primaryFamily(): Family {
  return familyOf(settings.get().defaultVoice.en)
}
function pocketLangWanted(): PocketLang {
  const m = settings.get().langMode
  return m === 'es' ? 'es' : 'en'
}

function computeActive(): ActiveEngineState {
  const fam = primaryFamily()
  const k = kokoro.get()
  if (fam === 'kokoro') return { ...k, family: 'kokoro', pocketLang: null }
  const p = pocket.get()
  const lang: PocketLang = p.active ?? pocketLangWanted()
  const l = p.langs[lang]
  const anyReady = (['en', 'es'] as PocketLang[]).some((x) => p.langs[x].status === 'ready')
  const status: ModelStatus = l.status === 'loading' ? 'loading' : l.status === 'ready' || anyReady ? 'ready' : l.status === 'error' ? 'error' : 'idle'
  return {
    ...k,
    status,
    progress: l.total ? l.loaded / l.total : 0,
    loaded: l.loaded, total: l.total,
    device: 'wasm', dtype: null,
    error: l.error,
    cached: pocketCachedFlag,
    lastRtf: p.lastRtf, loadMs: l.loadMs,
    phase: l.status === 'loading' ? (l.fromCache ? 'warm' : 'download') : null,
    family: 'pocket', pocketLang: lang,
  }
}
let pocketCachedFlag = false
export const engine = createStore<ActiveEngineState>(computeActive())
const refresh = () => engine.set(computeActive())
kokoro.subscribe(refresh)
pocket.subscribe(refresh)
let lastPrimary = primaryFamily()
settings.subscribe(() => { const f = primaryFamily(); if (f !== lastPrimary) { lastPrimary = f; refresh() } })

export function ensureModel(): Promise<void> {
  if (primaryFamily() === 'pocket') return pocketEnsure(pocket.get().active ?? pocketLangWanted())
  return kokoroEnsure()
}

export function synthesize(text: string, voice: string, speed: number, opts: { priority?: number; signal?: AbortSignal } = {}): Promise<SynthResult> {
  if (familyOf(voice) === 'kokoro') return kokoroSynth(text, voice, speed, opts)
  const v = voiceById(voice)
  const lang: PocketLang = v?.lang === 'es' ? 'es' : 'en'
  return pocketSynth(text, lang, voice.replace(/^pk_/, ''), opts).then((r) =>
    speed && Math.abs(speed - 1) > 0.01 ? { ...r, samples: timeStretch(r.samples, r.sampleRate, speed) } : r)
}

export function promote(signal: AbortSignal, priority: number) { kokoroPromote(signal, priority); pocketPromote(signal, priority) }
export function clearQueue(maxPriority = Infinity) { kokoroClear(maxPriority); pocketClear(maxPriority) }

export async function isModelCached(): Promise<boolean> {
  if (primaryFamily() === 'pocket') {
    pocketCachedFlag = await pocketCached(pocketLangWanted())
    refresh()
    return pocketCachedFlag
  }
  return kokoroCached()
}

/** Delete the primary engine's downloaded model. */
export async function deleteModel() {
  if (primaryFamily() === 'pocket') { await pocketDelete(); pocketCachedFlag = false; refresh(); return }
  await kokoroDelete()
}

/** Restart the engines (e.g. after changing the Kokoro engine choice). */
export function resetEngine() {
  kokoroReset()
}

export { pocketCacheBytes, POCKET_SIZE_MB }
