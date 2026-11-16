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
const PHONON_CACHE = 'phonon-tts-v1'
/** This engine's model identity as the probes know it (M-21): the
 *  pinned commit base every model file is fetched and probed under.
 *  keep.ts binds its Phonon stamps to it, so a stamp names the exact
 *  model it certifies. */
export const phononModelIdentity = (): string => MODEL
/** Every file PhononTTS.load needs out of the bucket — the exact set
 *  named in phononEnsure's load spec below. */
const PHONON_MODEL_FILES = ['model.q8.gguf', 'tokenizer.json', 'config.json', 'default-voice.safetensors']

/**
 * Cache-integrity pass (T4-4), mirroring Pocket's 1.4.147 rule. The
 * vendored loader (phonon-tts/fetch.js, which this app may not edit)
 * returns cache hits with no validation at all, so a Phonon entry
 * whose body was truncated mid-write was handed to the GGUF parser on
 * every load, failed every load identically, and was never evicted.
 * This pass runs at the seams this file controls — the cached probe
 * and before every load: any entry whose stored content-length
 * disagrees with its actual body is evicted, so the loader downloads
 * it fresh instead of serving the same damaged bytes forever.
 */
async function phononEvictDamaged(): Promise<void> {
  try {
    const c = await caches.open(PHONON_CACHE)
    for (const req of await c.keys()) {
      const res = await c.match(req)
      if (!res) continue
      const declared = Number(res.headers.get('content-length') ?? 0)
      if (!(declared > 0)) continue
      const actual = (await res.blob()).size
      if (actual !== declared) { try { await c.delete(req) } catch { /* ignore */ } }
    }
  } catch { /* ignore */ }
}

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
// Generation stamps for loads (T4-9): PhononTTS.load has no cancel
// handle, so a load that times out keeps running physically — a
// zombie. Each ensure stamps its load with a generation; timing a
// load out deletes its generation, and a late completion whose
// generation is gone is dead on arrival: the instance it built is
// disposed and it touches neither instances nor status. The load's
// caller-facing promise is a deferred settled through loadSettlers,
// so a timeout can fail ensure callers honestly at the moment of the
// timeout instead of leaving them holding a promise the zombie later
// "succeeds" (and a fresh ensure after a timeout starts a new load
// whose predecessor's completion is guaranteed inert).
const loadGen = new Map<PhononLang, number>()
const loadSettlers = new Map<PhononLang, { resolve: () => void; reject: (e: Error) => void }>()
let genSeq = 0

/** Fail a load that has gone silent past the timeout — the one door
 *  both pump()'s witnessed check and the watchdog use, so an
 *  ensure-only load dies exactly like a pump-witnessed one (T4-7). */
function failStaleLoad(lang: PhononLang) {
  const msg = 'The voice model stopped loading.'
  loadGen.delete(lang)
  loadSince.delete(lang)
  const settle = loadSettlers.get(lang)
  loadSettlers.delete(lang)
  loads.delete(lang)
  setLang(lang, { status: 'error', error: msg })
  failQueued(lang, msg)
  settle?.reject(new Error(msg))
  stopWatchdogIfIdle()
}

// The load watchdog (T4-7): pump()'s timeout check only ticks when a
// synthesis job is queued, so an ensure-only load (Settings download,
// auto-warm) that wedged hung forever. This interval is a real time
// source behind every outstanding load; it runs while any load is
// outstanding and stops when none is.
let loadWatchdog: ReturnType<typeof setInterval> | null = null
function armLoadWatchdog() {
  if (loadWatchdog) return
  loadWatchdog = setInterval(() => {
    for (const [lang, since] of [...loadSince]) {
      if (phonon.get().langs[lang].status !== 'loading') { loadSince.delete(lang); continue }
      if (Date.now() - since > LOAD_TIMEOUT_MS) failStaleLoad(lang)
    }
    stopWatchdogIfIdle()
  }, 1000)
}
function stopWatchdogIfIdle() {
  if (loadSince.size === 0 && loadWatchdog) { clearInterval(loadWatchdog); loadWatchdog = null }
}
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
  armLoadWatchdog()
  const gen = ++genSeq
  loadGen.set(lang, gen)
  let settle!: { resolve: () => void; reject: (e: Error) => void }
  const p = new Promise<void>((resolve, reject) => { settle = { resolve, reject }; loadSettlers.set(lang, settle) })
  loads.set(lang, p)
  const t0 = performance.now()
  const files: Record<string, [number, number, boolean]> = {}
  // This load's published progress (M-23): monotonic within the load,
  // reset by construction every time a load starts.
  let shownLoaded = 0
  let shownTotal = 0
  void (async () => {
    let tts: Tts
    try {
      // The integrity pass runs before the loader can serve a damaged
      // cache entry as if it were the model (T4-4).
      await phononEvictDamaged()
      const { PhononTTS } = await import('phonon-tts')
      tts = (await PhononTTS.load({
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
          // A timed-out (dead-generation) load reports nothing: its
          // progress must not refresh the watchdog's clock or the
          // status of whatever load replaced it.
          if (loadGen.get(lang) !== gen) return
          loadSince.set(lang, Date.now())
          // Progress never runs backwards and never passes its own
          // total (M-23): a file that restarts reports a small loaded
          // against the same total, and a server that under-reports
          // content-length lets loaded pass total — the raw sums did
          // both, so the bar stepped back mid-load and engine's
          // loaded/total could exceed 1. Each file's loaded is
          // clamped to its own total first; then the aggregate shown
          // for THIS load is monotonic — shownLoaded and shownTotal
          // only ever grow within the load — and shownLoaded is
          // clamped to shownTotal. Both live in this closure, so a
          // new load starts its own honest zero.
          const t = total || loaded
          files[file] = [t > 0 ? Math.min(loaded, t) : loaded, t, Boolean(cached)]
          const v = Object.values(files)
          const rawLoaded = v.reduce((a, b) => a + b[0], 0)
          const rawTotal = v.reduce((a, b) => a + b[1], 0)
          shownTotal = Math.max(shownTotal, rawTotal)
          shownLoaded = shownTotal > 0 ? Math.min(Math.max(shownLoaded, rawLoaded), shownTotal) : Math.max(shownLoaded, rawLoaded)
          setLang(lang, { loaded: shownLoaded, total: shownTotal, fromCache: v.every((x) => x[2]) })
        },
      })) as unknown as Tts
    } catch (err) {
      // A dead generation failing late is inert: no status, no queued
      // jobs, no settler — the timeout already told the truth.
      if (loadGen.get(lang) !== gen) return
      const e = err as Error
      if (loads.get(lang) === p) { loads.delete(lang); loadSettlers.delete(lang) }
      loadSince.delete(lang)
      stopWatchdogIfIdle()
      setLang(lang, { status: 'error', error: e.message || 'Phonon could not start.' })
      failQueued(lang, e.message)
      settle.reject(e)
      return
    }
    if (loadGen.get(lang) !== gen) {
      // Dead on arrival (T4-9): this load was timed out while in
      // flight. Dispose the instance it built and touch nothing —
      // no instance is filed, no status is resurrected, no pump.
      try { tts.dispose() } catch { /* ignore */ }
      return
    }
    // Saved means saved (T4-11): the vendored loader's cache writes
    // are fire-and-forget — the worker hands each downloaded file to
    // the page (storeBytes) and load() resolves without ever learning
    // whether the bytes landed, so a quota-full phone claimed "ready"
    // and "cached" with nothing kept. That claim is now earned here,
    // at the seam this file controls: a load that downloaded anything
    // (any progress report with cached === false — or no progress at
    // all to prove a cache hit) must find the whole model in the
    // bucket, probed by the cured phononCached (all four files,
    // integrity-checked), before any instance is filed or 'ready' is
    // set. The page-side write is an asynchronous handoff of up to
    // ~75 MB, so the probe polls — 500 ms apart for up to ~12 s, the
    // same patience keep.ts's stamp gives it — refreshing this load's
    // watchdog clock as it waits. A load served entirely from cache
    // skips the wait: its files demonstrably came out of the bucket.
    const progressSeen = Object.values(files)
    const allFromCache = progressSeen.length > 0 && progressSeen.every((f) => f[2])
    if (!allFromCache) {
      let saved = false
      for (let i = 0; i < 24 && !saved; i++) {
        loadSince.set(lang, Date.now())
        saved = await phononCached()
        if (!saved) await new Promise((r) => setTimeout(r, 500))
      }
      if (!saved) {
        // Fail honestly through the load's own error channel — the
        // same settlement a load error takes: no instance filed, the
        // built instance disposed, status 'error' carrying the
        // reason, queued jobs and ensure callers failed with it.
        // Nothing claims ready or cached, because nothing was kept;
        // a later load whose save lands certifies exactly as before.
        const msg = 'The voice model could not be saved on this device — storage may be full. Nothing was kept, so it is not marked as downloaded.'
        try { tts.dispose() } catch { /* ignore */ }
        if (loadGen.get(lang) !== gen) return
        if (loads.get(lang) === p) { loads.delete(lang); loadSettlers.delete(lang) }
        loadSince.delete(lang)
        stopWatchdogIfIdle()
        setLang(lang, { status: 'error', error: msg })
        failQueued(lang, msg)
        settle.reject(new Error(msg))
        return
      }
    }
    if (loadGen.get(lang) !== gen) {
      // Timed out while the save was being verified: dead on arrival,
      // exactly as above (T4-9).
      try { tts.dispose() } catch { /* ignore */ }
      return
    }
    if (loads.get(lang) === p) { loads.delete(lang); loadSettlers.delete(lang) }
    loadSince.delete(lang)
    stopWatchdogIfIdle()
    instances.set(lang, tts)
    setLang(lang, { status: 'ready', loadMs: performance.now() - t0, fromCache: allFromCache })
    phonon.set({ active: lang, threads: tts.threads })
    settle.resolve()
    pump()
  })()
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
        failStaleLoad(job.lang)
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
  // The integrity pass first (T4-4): an entry this probe is about to
  // certify must not be one whose body disagrees with its own header.
  await phononEvictDamaged()
  try {
    const c = await caches.open(PHONON_CACHE)
    // The whole model, not just its weights (T4-5): PhononTTS.load
    // also needs the tokenizer, the config and the default voice, and
    // certifying from model.q8.gguf alone reported "Downloaded" for
    // a model that could only fail — offline, at play time.
    for (const name of PHONON_MODEL_FILES) if (!(await c.match(MODEL + name))) return false
    return true
  } catch { /* ignore */ }
  return false
}

export async function phononCacheBytes(): Promise<number> {
  let bytes = 0
  try {
    const cache = await caches.open(PHONON_CACHE)
    for (const req of await cache.keys()) {
      const res = await cache.match(req)
      const len = Number(res?.headers.get('content-length') ?? 0)
      bytes += len || (res ? (await res.blob()).size : 0)
    }
  } catch { /* ignore */ }
  return bytes
}
