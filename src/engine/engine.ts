// Main-thread client for the Kokoro worker: model lifecycle, download progress,
// and a prioritised synthesis queue (one job in flight; Listen jumps the line).
import { createStore } from '../lib/store.ts'
import { settings, type EngineChoice } from '../lib/settings.ts'
import { voiceById } from '../lib/voices.ts'
import type { Device, Dtype, ProgressInfo, WorkerRequest, WorkerResponse } from './tts.worker.ts'

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
  lastRtf: number | null
  loadMs: number | null
  /** while loading: 'download' = fetching from the internet, 'warm' = model is on the phone, starting it up */
  phase: 'download' | 'warm' | null
}

export const engine = createStore<EngineState>({
  status: 'idle', progress: 0, loaded: 0, total: 0, device: null, dtype: null,
  error: null, cached: false, webgpu: null, lastRtf: null, loadMs: null, phase: null,
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
export const gpuBroken = () => ls.get(GPU_BROKEN_KEY) === '1'
function markGpuBroken() { ls.set(GPU_BROKEN_KEY, '1') }
let crashedLastTime: boolean | null = null
/** True when the previous visit started loading the model and never finished (the tab crashed). Checked once per page load. */
export function lastLoadCrashed(): boolean {
  if (crashedLastTime !== null) return crashedLastTime
  const raw = ls.get(LOADING_KEY)
  crashedLastTime = false
  if (raw) {
    ls.del(LOADING_KEY)
    try {
      const info = JSON.parse(raw) as { device?: string; t?: number }
      if (Date.now() - (info.t ?? 0) < 10 * 60_000) {
        crashedLastTime = true
        if (info.device === 'webgpu') markGpuBroken()
      }
    } catch { /* ignore */ }
  }
  return crashedLastTime
}
let retriedOnWasm = false
let requestedDevice: Device | null = null
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
    const message = e.message || 'The speech engine crashed.'
    ls.del(LOADING_KEY)
    worker = null
    engine.set({ status: 'error', error: message })
    loadWaiters.forEach((w) => w.reject(new Error(message)))
    loadWaiters = []
    inFlight?.reject(new Error(message))
    inFlight = null
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
      if (requestedDevice === 'webgpu' && msg.device !== 'webgpu') markGpuBroken()
      engine.set({ status: 'ready', progress: 1, device: msg.device, dtype: msg.dtype, error: null, cached: true, loadMs: msg.ms, phase: null })
      keepStorage()
      loadWaiters.forEach((w) => w.resolve())
      loadWaiters = []
      pump()
      break
    case 'loadError':
      ls.del(LOADING_KEY)
      engine.set({ status: 'error', error: msg.message })
      loadWaiters.forEach((w) => w.reject(new Error(msg.message)))
      loadWaiters = []
      break
    case 'generated':
    case 'generateError': {
      const job = inFlight
      inFlight = null
      if (msg.type === 'generateError' && job && job.id === msg.id && engine.get().device === 'webgpu' && !retriedOnWasm) {
        // The GPU path broke mid-use: switch to WASM for good and retry this sentence.
        retriedOnWasm = true
        markGpuBroken()
        queue.unshift(job)
        worker?.terminate()
        worker = null
        engine.set({ status: 'idle', device: null, dtype: null })
        void startLoad()
        break
      }
      if (job && job.id === msg.id) {
        if (msg.type === 'generated') {
          const dur = msg.samples.length / msg.sampleRate
          if (dur > 0.5) engine.set({ lastRtf: msg.ms / 1000 / dur })
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
  engine.set({ loaded, total, progress, ...(progress >= 0.999 && engine.get().phase === 'download' ? { phase: 'warm' as const } : {}) })
}

export function isMobileDevice(): boolean {
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData
  return uaData?.mobile ?? /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
}

export async function probeWebGpu(): Promise<boolean> {
  const cached = engine.get().webgpu
  if (cached !== null) return cached
  let ok = false
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
    ok = Boolean(gpu && (await gpu.requestAdapter()))
  } catch { ok = false }
  engine.set({ webgpu: ok })
  return ok
}

/** Auto = WebGPU on capable desktops/tablets in desktop mode; WASM (q8, 92 MB) on phones. */
export async function resolveEngine(choice: EngineChoice = settings.get().engine): Promise<{ device: Device; dtype: Dtype }> {
  if (choice === 'wasm' || isMobileDevice() || gpuBroken()) return { device: 'wasm', dtype: 'q8' }
  const gpu = await probeWebGpu()
  if (choice === 'webgpu') return gpu ? { device: 'webgpu', dtype: 'fp32' } : { device: 'wasm', dtype: 'q8' }
  return gpu && !isMobileDevice() ? { device: 'webgpu', dtype: 'fp32' } : { device: 'wasm', dtype: 'q8' }
}

export async function isModelCached(): Promise<boolean> {
  try {
    const { dtype } = await resolveEngine()
    const cache = await caches.open('transformers-cache')
    const keys = await cache.keys()
    const hit = keys.some((k) => k.url.includes('Kokoro-82M') && k.url.endsWith(MODEL_FILES[dtype]))
    engine.set({ cached: hit })
    return hit
  } catch {
    return false
  }
}

export function ensureModel(): Promise<void> {
  const s = engine.get()
  if (s.status === 'ready') return Promise.resolve()
  const p = new Promise<void>((resolve, reject) => loadWaiters.push({ resolve, reject }))
  if (s.status !== 'loading') void startLoad()
  return p
}

async function startLoad() {
  files.clear()
  engine.set({ status: 'loading', progress: 0, loaded: 0, total: 0, error: null, phase: null })
  // Transformers.js reports "progress" even when it reads the model from the
  // phone's cache, so check first and show "Starting voice" instead of a download.
  const onPhone = await isModelCached()
  engine.set({ phase: onPhone ? 'warm' : 'download' })
  const { device, dtype } = await resolveEngine()
  requestedDevice = device
  ls.set(LOADING_KEY, JSON.stringify({ device, t: Date.now() }))
  getWorker().postMessage({ type: 'load', device, dtype } satisfies WorkerRequest)
}

export function synthesize(text: string, voice: string, speed: number, opts: { priority?: number; signal?: AbortSignal } = {}): Promise<SynthResult> {
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
    ensureModel().then(pump, (e) => { const i = queue.indexOf(job); if (i >= 0) queue.splice(i, 1); reject(e) })
  })
}

function pump() {
  if (inFlight || engine.get().status !== 'ready') return
  const job = queue.shift()
  if (!job) return
  inFlight = job
  const v = voiceById(job.voice)
  getWorker().postMessage({
    type: 'generate', id: job.id, text: job.text, voice: job.voice,
    phonemeLang: v?.phonemeLang ?? 'en-us', speed: job.speed,
  } satisfies WorkerRequest)
}

/** Raise the priority of a queued job (identified by its AbortSignal). */
export function promote(signal: AbortSignal, priority: number) {
  const job = queue.find((j) => j.signal === signal)
  if (!job || job.priority >= priority) return
  job.priority = priority
  queue.sort((a, b) => b.priority - a.priority || a.id - b.id)
}

/** Drop every queued (not yet running) job at or below a priority. */
export function clearQueue(maxPriority = Infinity) {
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i].priority <= maxPriority) {
      queue[i].reject(new DOMException('Aborted', 'AbortError'))
      queue.splice(i, 1)
    }
  }
}

export async function deleteModel() {
  worker?.terminate()
  worker = null
  clearQueue()
  inFlight = null
  for (const name of ['transformers-cache', 'kokoro-voices']) {
    try { await caches.delete(name) } catch { /* ignore */ }
  }
  engine.set({ status: 'idle', progress: 0, loaded: 0, total: 0, device: null, dtype: null, cached: false, error: null })
}

/** Restart with a different engine choice (worker reload). */
export function resetEngine() {
  worker?.terminate()
  worker = null
  clearQueue()
  inFlight = null
  engine.set({ status: 'idle', device: null, dtype: null, progress: 0 })
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

/** Phones never use the full-precision (WebGPU) model: free the space it takes. */
export async function purgeUnusedModels() {
  if (!isMobileDevice()) return
  try {
    const cache = await caches.open('transformers-cache')
    for (const k of await cache.keys()) {
      if (k.url.includes('Kokoro-82M') && (k.url.endsWith(MODEL_FILES.fp32) || k.url.endsWith(MODEL_FILES.fp16))) await cache.delete(k)
    }
  } catch { /* ignore */ }
}
