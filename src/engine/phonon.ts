// Phonon manager (Gradium, 40m multilingual, CC BY-NC 4.0). One 75 MB model
// speaks English and Spanish; numbers and dates are read per language, so each
// language gets its own instance (both load the same cached weights).
// Same shape as pocket.ts: per-language status, a priority queue, cancel.
import { createStore } from '../lib/store.ts'
import { voiceById } from '../lib/voices.ts'

export type PhononLang = 'en' | 'es'
export const PHONON_SIZE_MB = 75
const MODEL = 'https://huggingface.co/empyrealworks/Phonon-40M-multilingual/resolve/1191d231388bc97330225a2cece698c074eaa3ca/'
const VOICES = 'https://huggingface.co/gradium/phonon-voices/resolve/0ee17205f254b5abc43b266c8a0f215565c352f7/'

type LangState = { status: 'idle' | 'loading' | 'ready' | 'error'; loaded: number; total: number; fromCache: boolean; error: string | null; loadMs: number | null }
export type PhononState = { langs: Record<PhononLang, LangState>; active: PhononLang | null; lastRtf: number | null; threads: number | null }
const blank = (): LangState => ({ status: 'idle', loaded: 0, total: 0, fromCache: false, error: null, loadMs: null })
export const phonon = createStore<PhononState>({ langs: { en: blank(), es: blank() }, active: null, lastRtf: null, threads: null })

type Tts = {
  synth(text: string, o?: { voice?: string; signal?: AbortSignal }): Promise<Float32Array>
  addVoice(name: string, src: string): Promise<void>
  voices: string[]
  sampleRate: number
  threads: number
  dispose(): void
}
type Job = {
  id: number; text: string; lang: PhononLang; voice: string; priority: number
  resolve: (r: { samples: Float32Array; sampleRate: number; ms: number }) => void
  reject: (e: Error) => void
  signal?: AbortSignal
}

const instances = new Map<PhononLang, Tts>()
const loads = new Map<PhononLang, Promise<void>>()
const queue: Job[] = []
let inFlight: Job | null = null
const loadSince = new Map<PhononLang, number>()
// The same law as the pocket engine: a synthesis or a load that goes silent
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
/** Called before a model loads, so the other engine can free memory. */
let beforeLoad: (lang: PhononLang) => void = () => {}
export function onPhononBeforeLoad(fn: (lang: PhononLang) => void) { beforeLoad = fn }

function setLang(lang: PhononLang, patch: Partial<LangState>) {
  phonon.set((s) => ({ langs: { ...s.langs, [lang]: { ...s.langs[lang], ...patch } } }))
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
  const forced = Number(localStorage.getItem('logos.phononThreads'))
  if (forced) return forced
  return Math.max(1, Math.min(3, (navigator.hardwareConcurrency ?? 2) - 1))
}

export function phononEnsure(lang: PhononLang): Promise<void> {
  if (instances.has(lang) && phonon.get().langs[lang].status === 'ready') return Promise.resolve()
  const running = loads.get(lang)
  if (running) return running
  beforeLoad(lang)
  setLang(lang, { status: 'loading', loaded: 0, total: 0, error: null })
  loadSince.set(lang, Date.now())
  phonon.set({ active: lang })
  const t0 = performance.now()
  const files: Record<string, [number, number, boolean]> = {}
  const p = (async () => {
    const { PhononTTS } = await import('phonon-tts')
    const tts = (await PhononTTS.load({
      lang,
      quant: 'q8',
      threads: threads(),
      model: {
        weights: { q8: MODEL + 'model.q8.gguf' },
        tokenizer: MODEL + 'tokenizer.json',
        config: MODEL + 'config.json',
        voices: { default: MODEL + 'default-voice.safetensors' },
        defaultVoice: 'default',
      },
      onProgress: ({ file, loaded, total, cached }: { file: string; loaded: number; total?: number | null; cached?: boolean }) => {
        loadSince.set(lang, Date.now())
        files[file] = [loaded, total || loaded, Boolean(cached)]
        const v = Object.values(files)
        setLang(lang, { loaded: v.reduce((a, b) => a + b[0], 0), total: v.reduce((a, b) => a + b[1], 0), fromCache: v.every((x) => x[2]) })
      },
    })) as unknown as Tts
    instances.set(lang, tts)
    setLang(lang, { status: 'ready', loadMs: performance.now() - t0, fromCache: true })
    phonon.set({ active: lang, threads: tts.threads })
    pump()
  })()
    .catch((err: Error) => {
      setLang(lang, { status: 'error', error: err.message || 'Phonon could not start.' })
      failQueued(lang, err.message)
      throw err
    })
    .finally(() => { loads.delete(lang); loadSince.delete(lang) })
  loads.set(lang, p)
  return p
}

export function phononSynth(text: string, lang: PhononLang, voiceId: string, opts: { priority?: number; signal?: AbortSignal } = {}) {
  return new Promise<{ samples: Float32Array; sampleRate: number; ms: number }>((resolve, reject) => {
    if (opts.signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return }
    const job: Job = { id: nextId++, text, lang, voice: voiceId, priority: opts.priority ?? 0, resolve, reject, signal: opts.signal }
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
  const tts = instances.get(job.lang)
  if (!tts || phonon.get().langs[job.lang].status !== 'ready') {
    if (phonon.get().langs[job.lang].status === 'loading') {
      const since = loadSince.get(job.lang)
      if (since && Date.now() - since > LOAD_TIMEOUT_MS) {
        const msg = 'The voice model stopped loading.'
        loads.delete(job.lang); loadSince.delete(job.lang)
        setLang(job.lang, { status: 'error', error: msg })
        failQueued(job.lang, msg)
        return
      }
    }
    if (!loads.has(job.lang) && phonon.get().langs[job.lang].status !== 'error') phononEnsure(job.lang).catch(() => {})
    return
  }
  queue.shift()
  inFlight = job
  void run(job, tts)
}

async function run(job: Job, tts: Tts) {
  const t0 = performance.now()
  try {
    const v = voiceById(job.voice)
    const name = job.voice.replace(/^ph_/, '')
    const samples = await withTimeout((async () => {
      if (!tts.voices.includes(name)) await tts.addVoice(name, VOICES + (v?.file ?? `voices/${name}.safetensors`))
      return tts.synth(job.text, { voice: name, signal: job.signal })
    })(), JOB_TIMEOUT_MS)
    const ms = performance.now() - t0
    const dur = samples.length / tts.sampleRate
    if (dur > 0.5) phonon.set({ lastRtf: ms / 1000 / dur })
    job.resolve({ samples, sampleRate: tts.sampleRate, ms })
  } catch (err) {
    const e = err as Error
    // A timed-out instance is wedged, not tired: bury it so the next job
    // raises a fresh one instead of queueing behind the corpse.
    if (e?.name === 'TimeoutError') {
      try { instances.get(job.lang)?.dispose() } catch { /* ignore */ }
      instances.delete(job.lang)
      setLang(job.lang, { status: 'idle' })
    }
    job.reject(e?.name === 'AbortError' || job.signal?.aborted ? new DOMException('Aborted', 'AbortError') : e)
  } finally {
    inFlight = null
    pump()
  }
}

function failQueued(lang: PhononLang, message: string) {
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].lang === lang) { queue[i].reject(new Error(message)); queue.splice(i, 1) }
}

export function phononPromote(signal: AbortSignal, priority: number) {
  const job = queue.find((j) => j.signal === signal)
  if (!job || job.priority >= priority) return
  job.priority = priority
  queue.sort((a, b) => b.priority - a.priority || a.id - b.id)
}

export function phononClear(maxPriority = Infinity) {
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i].priority <= maxPriority) { queue[i].reject(new DOMException('Aborted', 'AbortError')); queue.splice(i, 1) }
  }
}

/** Free a language's model from memory (it stays saved on the phone). */
export function phononRelease(lang: PhononLang) {
  if (inFlight?.lang === lang) return
  instances.get(lang)?.dispose()
  instances.delete(lang)
  setLang(lang, { status: 'idle' })
}
export const phononLoaded = (): PhononLang[] => [...instances.keys()]
export const phononBusy = (lang: PhononLang) => inFlight?.lang === lang

export async function phononDelete() {
  phononClear()
  for (const l of [...instances.keys()]) phononRelease(l)
  phonon.set({ langs: { en: blank(), es: blank() }, active: null })
  try { const { clearCache } = await import('phonon-tts'); await clearCache() } catch { /* ignore */ }
}

/** Whether the model is already saved on this phone. */
export async function phononCached(): Promise<boolean> {
  try {
    const c = await caches.open('phonon-tts-v1')
    if (await c.match(MODEL + 'model.q8.gguf')) return true
  } catch { /* ignore */ }
  return false
}

export async function phononCacheBytes(): Promise<number> {
  let bytes = 0
  try {
    const cache = await caches.open('phonon-tts-v1')
    for (const req of await cache.keys()) {
      const res = await cache.match(req)
      const len = Number(res?.headers.get('content-length') ?? 0)
      bytes += len || (res ? (await res.blob()).size : 0)
    }
  } catch { /* ignore */ }
  return bytes
}
