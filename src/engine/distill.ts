// Pocket Fast manager: Kyutai's distilled PocketTTS (english_18m_2026-10,
// 18.2M parameters) running on Gradium's xn-ptts runtime — the same
// phonon-tts package the Phonon engine uses, pointed at our own hosted
// copy of the distilled checkpoint (q8+bf16 GGUF, ~25 MB, English only).
// Same shape as phonon.ts: status store, a priority queue, timeouts, cancel.
// The big Pocket engine (pocket.ts) is untouched; this is a third door.
import { createStore } from '../lib/store.ts'

export type DistillLang = 'en' | 'es'
export const DISTILL_SIZE_MB = 25
const DEFAULT_BASE = 'https://oscarvelz.github.io/Logos/models/en18m/'
/** Bench hook: serve the model files from a local address instead. */
const base = (): string => { try { return localStorage.getItem('logos.distillBase') || DEFAULT_BASE } catch { return DEFAULT_BASE } }

type LangState = { status: 'idle' | 'loading' | 'ready' | 'error'; loaded: number; total: number; fromCache: boolean; error: string | null; loadMs: number | null }
export type DistillState = { langs: Record<DistillLang, LangState>; active: DistillLang | null; lastRtf: number | null; threads: number | null }
const blank = (): LangState => ({ status: 'idle', loaded: 0, total: 0, fromCache: false, error: null, loadMs: null })
export const distill = createStore<DistillState>({ langs: { en: blank(), es: blank() }, active: null, lastRtf: null, threads: null })

type Tts = {
  synth(text: string, o?: { voice?: string; signal?: AbortSignal }): Promise<Float32Array>
  addVoice(name: string, src: string): Promise<void>
  voices: string[]
  sampleRate: number
  threads: number
  dispose(): void
}
type Job = {
  id: number; text: string; voice: string; priority: number
  resolve: (r: { samples: Float32Array; sampleRate: number; ms: number }) => void
  reject: (e: Error) => void
  signal?: AbortSignal
}

let instance: Tts | null = null
let load: Promise<void> | null = null
const queue: Job[] = []
let inFlight: Job | null = null
let loadSince = 0
// The same law as the other engines: a synthesis or a load that goes silent
// is dead, not slow — and it must never jam the queue into eternal Processing.
const JOB_TIMEOUT_MS = 45_000
const LOAD_TIMEOUT_MS = 120_000
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new DOMException('The voice engine stopped answering.', 'TimeoutError')), ms)
    promise.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}
let nextId = 1
/** Called before the model loads, so the other engines can free memory. */
let beforeLoad: () => void = () => {}
export function onDistillBeforeLoad(fn: () => void) { beforeLoad = fn }

function setEn(patch: Partial<LangState>) {
  distill.set((s) => ({ langs: { ...s.langs, en: { ...s.langs.en, ...patch } } }))
}

/** Android's WebView can share memory with workers without cross-origin isolation. */
function sharedMemoryWorks(): boolean {
  try {
    if (typeof SharedArrayBuffer === 'undefined') return false
    const m = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true })
    const ch = new MessageChannel(); ch.port1.postMessage(m); ch.port1.close(); ch.port2.close()
    return true
  } catch { return false }
}

function threads(): number {
  if (!self.crossOriginIsolated && !sharedMemoryWorks()) return 1
  const forced = Number(localStorage.getItem('logos.distillThreads'))
  if (forced) return forced
  return Math.max(1, Math.min(4, (navigator.hardwareConcurrency ?? 2) - 1))
}

export function distillEnsure(): Promise<void> {
  if (instance && distill.get().langs.en.status === 'ready') return Promise.resolve()
  if (load) return load
  beforeLoad()
  setEn({ status: 'loading', loaded: 0, total: 0, error: null })
  loadSince = Date.now()
  distill.set({ active: 'en' })
  const t0 = performance.now()
  const B = base()
  const files: Record<string, [number, number, boolean]> = {}
  const p = (async () => {
    const { PhononTTS } = await import('phonon-tts')
    const tts = (await PhononTTS.load({
      lang: 'en',
      quant: 'q8',
      threads: threads(),
      model: {
        weights: { q8: B + 'model.q8bf16.gguf' },
        tokenizer: B + 'tokenizer.json',
        config: B + 'config.json',
        voices: { jane: B + 'embeddings/jane.safetensors' },
        defaultVoice: 'jane',
      },
      onProgress: ({ file, loaded, total, cached }: { file: string; loaded: number; total?: number | null; cached?: boolean }) => {
        loadSince = Date.now()
        files[file] = [loaded, total || loaded, Boolean(cached)]
        const v = Object.values(files)
        setEn({ loaded: v.reduce((a, b) => a + b[0], 0), total: v.reduce((a, b) => a + b[1], 0), fromCache: v.every((x) => x[2]) })
      },
    })) as unknown as Tts
    instance = tts
    setEn({ status: 'ready', loadMs: performance.now() - t0, fromCache: true })
    distill.set({ active: 'en', threads: tts.threads })
    pump()
  })()
    .catch((err: Error) => {
      setEn({ status: 'error', error: err.message || 'Pocket Fast could not start.' })
      failQueued(err.message)
      throw err
    })
    .finally(() => { load = null; loadSince = 0 })
  load = p
  return p
}

export function distillSynth(text: string, voiceName: string, opts: { priority?: number; signal?: AbortSignal } = {}) {
  return new Promise<{ samples: Float32Array; sampleRate: number; ms: number }>((resolve, reject) => {
    if (opts.signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return }
    const job: Job = { id: nextId++, text, voice: voiceName, priority: opts.priority ?? 0, resolve, reject, signal: opts.signal }
    opts.signal?.addEventListener('abort', () => {
      const i = queue.indexOf(job)
      if (i >= 0) { queue.splice(i, 1); reject(new DOMException('Aborted', 'AbortError')) }
    }, { once: true })
    queue.push(job)
    queue.sort((a, b) => b.priority - a.priority || a.id - b.id)
    pump()
  })
}

function pump() {
  if (inFlight) return
  const job = queue[0]
  if (!job) return
  if (!instance || distill.get().langs.en.status !== 'ready') {
    if (distill.get().langs.en.status === 'loading') {
      if (loadSince && Date.now() - loadSince > LOAD_TIMEOUT_MS) {
        const msg = 'The voice model stopped loading.'
        load = null; loadSince = 0
        setEn({ status: 'error', error: msg })
        failQueued(msg)
        return
      }
    }
    if (!load && distill.get().langs.en.status !== 'error') distillEnsure().catch(() => {})
    return
  }
  queue.shift()
  inFlight = job
  void run(job, instance)
}

async function run(job: Job, tts: Tts) {
  const t0 = performance.now()
  try {
    const samples = await withTimeout((async () => {
      if (!tts.voices.includes(job.voice)) await tts.addVoice(job.voice, base() + `embeddings/${job.voice}.safetensors`)
      return tts.synth(job.text, { voice: job.voice, signal: job.signal })
    })(), JOB_TIMEOUT_MS)
    const ms = performance.now() - t0
    const dur = samples.length / tts.sampleRate
    if (dur > 0.5) distill.set({ lastRtf: ms / 1000 / dur })
    job.resolve({ samples, sampleRate: tts.sampleRate, ms })
  } catch (err) {
    const e = err as Error
    // A timed-out instance is wedged, not tired: bury it so the next job
    // raises a fresh one instead of queueing behind the corpse.
    if (e?.name === 'TimeoutError') {
      try { instance?.dispose() } catch { /* ignore */ }
      instance = null
      setEn({ status: 'idle' })
    }
    job.reject(e?.name === 'AbortError' || job.signal?.aborted ? new DOMException('Aborted', 'AbortError') : e)
  } finally {
    inFlight = null
    pump()
  }
}

function failQueued(message: string) {
  for (let i = queue.length - 1; i >= 0; i--) { queue[i].reject(new Error(message)); queue.splice(i, 1) }
}

export function distillPromote(signal: AbortSignal, priority: number) {
  const job = queue.find((j) => j.signal === signal)
  if (!job || job.priority >= priority) return
  job.priority = priority
  queue.sort((a, b) => b.priority - a.priority || a.id - b.id)
}

export function distillClear(maxPriority = Infinity) {
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i].priority <= maxPriority) { queue[i].reject(new DOMException('Aborted', 'AbortError')); queue.splice(i, 1) }
  }
}

/** Free the model from memory (it stays saved on the phone). */
export function distillRelease() {
  if (inFlight) return
  try { instance?.dispose() } catch { /* ignore */ }
  instance = null
  setEn({ status: 'idle' })
}
export const distillLoaded = (): boolean => instance !== null

export async function distillDelete() {
  distillClear()
  distillRelease()
  distill.set({ langs: { en: blank(), es: blank() }, active: null })
  // The files live in the phonon-tts cache, which phononDelete() clears for
  // every engine that rides this runtime; nothing else to remove here.
}

/** Whether the model is already saved on this phone. */
export async function distillCached(): Promise<boolean> {
  try {
    const c = await caches.open('phonon-tts-v1')
    if (await c.match(base() + 'model.q8bf16.gguf')) return true
  } catch { /* ignore */ }
  return false
}
