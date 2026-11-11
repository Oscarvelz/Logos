// Kokoro manager: one worker, one model (the full Kokoro 82M at fp16,
// English). Mirrors the PocketTTS manager's shape — priority queue,
// watchdogs, progress — because Listen's contract with engine.ts is the
// same. The model is NOT fetched from Hugging Face: Logos hosts it in
// parts under models/kokoro82/ (the service worker bypasses that path),
// this module assembles the parts and seeds the Transformers browser
// cache under this origin's hub-mirror URLs, and the worker's loader
// reads them from there. Voices are seeded the same way into the
// 'kokoro-voices' cache kokoro-js checks before it ever fetches.
import { createStore } from '../lib/store.ts'
import type { KokoroRequest, KokoroResponse } from './kokoro.worker.ts'
import type { PocketLang } from './pocket.ts'

export const KOKORO_SIZE_MB = 170
const MODEL_ID_PATH = 'onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/'
const MODEL_BYTES = 163_234_740
const PART_COUNT = 7
const VOICE_BYTES = 522_240
export const KOKORO_VOICE_IDS = [
  'af_heart', 'af_bella', 'af_alloy', 'af_aoede', 'af_jessica', 'af_kore', 'af_nicole', 'af_nova', 'af_river', 'af_sarah', 'af_sky',
  'am_adam', 'am_michael', 'am_echo', 'am_eric', 'am_fenrir', 'am_liam', 'am_onyx', 'am_puck', 'am_santa',
  'bf_alice', 'bf_emma', 'bf_isabella', 'bf_lily', 'bm_daniel', 'bm_fable', 'bm_george', 'bm_lewis',
]
const TOTAL_BYTES = MODEL_BYTES + VOICE_BYTES * KOKORO_VOICE_IDS.length

type LangState = { status: 'idle' | 'loading' | 'ready' | 'error'; loaded: number; total: number; fromCache: boolean; error: string | null; loadMs: number | null }
export type KokoroState = { langs: Record<PocketLang, LangState>; active: PocketLang | null; lastRtf: number | null; threads: number | null }
const blank = (): LangState => ({ status: 'idle', loaded: 0, total: 0, fromCache: false, error: null, loadMs: null })
export const kokoro = createStore<KokoroState>({ langs: { en: blank(), es: blank() }, active: null, lastRtf: null, threads: null })

const hubUrl = (path: string) => `${location.origin}${import.meta.env.BASE_URL}${MODEL_ID_PATH}${path}`
const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`

type Job = {
  id: number; text: string; voice: string; priority: number
  resolve: (r: { samples: Float32Array; sampleRate: number; ms: number }) => void
  reject: (e: Error) => void
  signal?: AbortSignal
}

let worker: Worker | null = null
let waiters: { resolve: () => void; reject: (e: Error) => void }[] = []
const queue: Job[] = []
let inFlight: Job | null = null
let inFlightTimer: ReturnType<typeof setTimeout> | null = null
let loadSince = 0
let seeding: Promise<void> | null = null
// Kokoro sentences render slower than Pocket's on weak cores; the
// watchdogs keep Pocket's philosophy (silence = death) with more room.
const JOB_TIMEOUT_MS = 90_000
const LOAD_TIMEOUT_MS = 240_000
const clearFlightTimer = () => { if (inFlightTimer) { clearTimeout(inFlightTimer); inFlightTimer = null } }
let nextId = 1

function setLang(patch: Partial<LangState>) {
  // One model, English only: 'es' mirrors 'en' so engine.ts's per-lang
  // reads stay truthful whichever language the UI is browsing in.
  kokoro.set((s) => {
    const en = { ...s.langs.en, ...patch }
    return { langs: { en, es: { ...en } } }
  })
}

function threads() {
  if (!self.crossOriginIsolated) return 1
  const forced = Number(localStorage.getItem('logos.threads'))
  if (forced) return forced
  return Math.max(1, Math.min(4, (navigator.hardwareConcurrency ?? 2) - 2))
}

/** Download (once) and seed every file the worker's loader will ask for. */
async function seedFiles(): Promise<void> {
  const cache = await caches.open('transformers-cache')
  const modelUrl = hubUrl('onnx/model_fp16.onnx')
  let loaded = 0
  const tick = (n: number, fromCache: boolean) => { loaded += n; loadSince = Date.now(); setLang({ loaded, total: TOTAL_BYTES, fromCache }) }
  if (await cache.match(modelUrl)) {
    tick(MODEL_BYTES, true)
  } else {
    for (const f of ['config.json', 'tokenizer.json', 'tokenizer_config.json']) {
      const res = await fetch(assetUrl(`models/kokoro82/meta/${f}`))
      if (!res.ok) throw new Error(`Failed to fetch Kokoro ${f}`)
      await cache.put(hubUrl(f), new Response(await res.arrayBuffer(), { headers: { 'content-type': 'application/octet-stream' } }))
    }
    const parts: BlobPart[] = []
    for (let i = 0; i < PART_COUNT; i++) {
      const res = await fetch(assetUrl(`models/kokoro82/parts/model_fp16.onnx.part0${i}`))
      if (!res.ok) throw new Error('Failed to fetch the Kokoro model')
      const buf = await res.arrayBuffer()
      parts.push(buf)
      tick(buf.byteLength, false)
    }
    await cache.put(modelUrl, new Response(new Blob(parts), { headers: { 'content-type': 'application/octet-stream' } }))
  }
  const voices = await caches.open('kokoro-voices')
  for (const kid of KOKORO_VOICE_IDS) {
    const key = `https://huggingface.co/${MODEL_ID_PATH}voices/${kid}.bin`
    if (await voices.match(key)) { tick(VOICE_BYTES, true); continue }
    const res = await fetch(assetUrl(`models/kokoro82/voices/${kid}.bin`))
    if (!res.ok) throw new Error(`Failed to fetch the Kokoro voice ${kid}`)
    const buf = await res.arrayBuffer()
    await voices.put(key, new Response(buf, { headers: { 'content-type': 'application/octet-stream' } }))
    tick(buf.byteLength, false)
  }
}

function flushWaiters(err?: Error) {
  const list = waiters
  waiters = []
  list.forEach((w) => (err ? w.reject(err) : w.resolve()))
}

function failQueued(message: string) {
  for (let i = queue.length - 1; i >= 0; i--) { queue[i].reject(new Error(message)); queue.splice(i, 1) }
}

function dropWorker() {
  worker?.terminate()
  worker = null
  setLang({ status: 'idle' })
  if (inFlight) { clearFlightTimer(); queue.unshift(inFlight); inFlight = null }
}

function spawn(): Worker {
  if (worker) return worker
  beforeSpawn()
  const w = new Worker(new URL('./kokoro.worker.ts', import.meta.url), { type: 'module' })
  worker = w
  w.addEventListener('message', (e: MessageEvent<KokoroResponse>) => onMessage(e.data))
  w.addEventListener('error', (e) => {
    e.preventDefault?.()
    const msg = e.message || 'The Kokoro engine crashed.'
    worker = null
    setLang({ status: 'error', error: msg })
    flushWaiters(new Error(msg))
    if (inFlight) { clearFlightTimer(); inFlight.reject(new Error(msg)); inFlight = null }
    pump()
  })
  return w
}

function onMessage(m: KokoroResponse) {
  switch (m.type) {
    case 'progress':
      loadSince = Date.now()
      break
    case 'ready':
      loadSince = 0
      setLang({ status: 'ready', error: null, loadMs: m.ms, loaded: TOTAL_BYTES, total: TOTAL_BYTES, fromCache: true })
      kokoro.set({ active: 'en' })
      keepStorage()
      flushWaiters()
      pump()
      break
    case 'loadError':
      loadSince = 0
      worker?.terminate()
      worker = null
      setLang({ status: 'error', error: m.message })
      flushWaiters(new Error(m.message))
      failQueued(m.message)
      break
    case 'spoken':
    case 'speakError': {
      const job = inFlight
      if (!job || job.id !== m.id) break
      inFlight = null
      clearFlightTimer()
      if (m.type === 'spoken') {
        const dur = m.samples.length / m.sampleRate
        if (dur > 0.5) kokoro.set({ lastRtf: m.ms / 1000 / dur })
        job.resolve({ samples: m.samples, sampleRate: m.sampleRate, ms: m.ms })
      } else job.reject(m.message === 'Aborted' ? new DOMException('Aborted', 'AbortError') : new Error(m.message))
      pump()
      break
    }
  }
}

/** Load the model (from the phone's cache after the first download). */
export function kokoroEnsure(): Promise<void> {
  if (kokoro.get().langs.en.status === 'ready' && worker) return Promise.resolve()
  const p = new Promise<void>((resolve, reject) => { waiters.push({ resolve, reject }) })
  if (kokoro.get().langs.en.status !== 'loading' || !worker) {
    setLang({ status: 'loading', loaded: 0, total: 0, error: null })
    loadSince = Date.now()
    kokoro.set({ active: 'en' })
    const t = threads()
    kokoro.set({ threads: t })
    seeding ??= seedFiles().catch((err) => { seeding = null; throw err })
    seeding.then(() => {
      if (kokoro.get().langs.en.status !== 'loading') return
      spawn().postMessage({ type: 'load', remoteHost: `${location.origin}${import.meta.env.BASE_URL}`, ortBase: `${location.origin}${import.meta.env.BASE_URL}ort/`, threads: t } satisfies KokoroRequest)
    }, (err) => {
      setLang({ status: 'error', error: err instanceof Error ? err.message : String(err) })
      flushWaiters(err instanceof Error ? err : new Error(String(err)))
      failQueued(err instanceof Error ? err.message : String(err))
    })
  }
  return p
}

export function kokoroSynth(text: string, voice: string, opts: { priority?: number; signal?: AbortSignal } = {}) {
  return new Promise<{ samples: Float32Array; sampleRate: number; ms: number }>((resolve, reject) => {
    if (opts.signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return }
    const job: Job = { id: nextId++, text, voice, priority: opts.priority ?? 0, resolve, reject, signal: opts.signal }
    opts.signal?.addEventListener('abort', () => {
      const i = queue.indexOf(job)
      if (i >= 0) { queue.splice(i, 1); reject(new DOMException('Aborted', 'AbortError')) }
      else if (inFlight === job) worker?.postMessage({ type: 'cancel', id: job.id } satisfies KokoroRequest)
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
  const st = kokoro.get().langs.en
  if (st.status !== 'ready' || !worker) {
    if (st.status === 'loading') {
      if (loadSince && Date.now() - loadSince > LOAD_TIMEOUT_MS) {
        const msg = 'The voice model stopped loading.'
        loadSince = 0
        dropWorker()
        setLang({ status: 'error', error: msg })
        flushWaiters(new Error(msg))
        failQueued(msg)
      }
    } else kokoroEnsure().catch(() => {})
    return
  }
  queue.shift()
  inFlight = job
  clearFlightTimer()
  const dispatched = job
  inFlightTimer = setTimeout(() => {
    if (inFlight !== dispatched) return
    inFlight = null
    inFlightTimer = null
    dispatched.reject(new DOMException('The voice engine stopped answering.', 'TimeoutError'))
    dropWorker()
    pump()
  }, JOB_TIMEOUT_MS)
  worker.postMessage({ type: 'speak', id: job.id, text: job.text, voice: job.voice } satisfies KokoroRequest)
}

export function kokoroPromote(signal: AbortSignal, priority: number) {
  const job = queue.find((j) => j.signal === signal)
  if (!job || job.priority >= priority) return
  job.priority = priority
  queue.sort((a, b) => b.priority - a.priority || a.id - b.id)
}

export function kokoroClear(maxPriority = Infinity) {
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i].priority <= maxPriority) { queue[i].reject(new DOMException('Aborted', 'AbortError')); queue.splice(i, 1) }
  }
}

/** Free the model from memory (it stays saved on the phone). */
export function kokoroRelease() {
  if (!inFlight) dropWorker()
}
let beforeSpawn: () => void = () => {}
export function onKokoroBeforeLoad(fn: () => void) { beforeSpawn = fn }

export function kokoroReset() {
  kokoroClear()
  if (worker) { worker.terminate(); worker = null }
  inFlight = null
  queue.length = 0
  kokoro.set({ langs: { en: blank(), es: blank() }, active: null })
}

export async function kokoroDelete() {
  kokoroReset()
  seeding = null
  try {
    const cache = await caches.open('transformers-cache')
    for (const f of ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model_fp16.onnx']) await cache.delete(hubUrl(f))
  } catch { /* ignore */ }
  try { await caches.delete('kokoro-voices') } catch { /* ignore */ }
}

/** Whether the model is already on this phone. */
export async function kokoroCached(): Promise<boolean> {
  try {
    const cache = await caches.open('transformers-cache')
    return Boolean(await cache.match(hubUrl('onnx/model_fp16.onnx')))
  } catch { return false }
}

export async function kokoroCacheBytes(): Promise<number> {
  let bytes = 0
  try {
    const cache = await caches.open('transformers-cache')
    for (const req of await cache.keys()) {
      if (!req.url.includes('Kokoro-82M')) continue
      const res = await cache.match(req)
      bytes += res ? (await res.blob()).size : 0
    }
    const voices = await caches.open('kokoro-voices')
    for (const req of await voices.keys()) {
      const res = await voices.match(req)
      bytes += res ? (await res.blob()).size : 0
    }
  } catch { /* ignore */ }
  return bytes
}

function keepStorage() {
  try { void navigator.storage?.persisted?.().then((p) => { if (!p) void navigator.storage.persist?.() }) } catch { /* unsupported */ }
}
