// PocketTTS manager: one worker per language (each model is its own 177 MB
// download), a priority queue shared with the rest of Logos, and progress
// reported to the rest of the app through engine.ts.
import { createStore } from '../lib/store.ts'
import type { PocketRequest, PocketResponse } from './pocket.worker.ts'

export type PocketLang = 'en' | 'es'
export const POCKET_LANGUAGE: Record<PocketLang, string> = { en: 'english', es: 'spanish' }
export const POCKET_SIZE_MB = 179
const CACHE = 'pocket-tts-models-v2'

type LangState = { status: 'idle' | 'loading' | 'ready' | 'error'; loaded: number; total: number; fromCache: boolean; error: string | null; loadMs: number | null }
export type PocketState = { langs: Record<PocketLang, LangState>; active: PocketLang | null; lastRtf: number | null }
const blank = (): LangState => ({ status: 'idle', loaded: 0, total: 0, fromCache: false, error: null, loadMs: null })
export const pocket = createStore<PocketState>({ langs: { en: blank(), es: blank() }, active: null, lastRtf: null })

type Job = {
  id: number; text: string; lang: PocketLang; voice: string; priority: number
  resolve: (r: { samples: Float32Array; sampleRate: number; ms: number }) => void
  reject: (e: Error) => void
  signal?: AbortSignal
}

const workers = new Map<PocketLang, Worker>()
const waiters = new Map<PocketLang, { resolve: () => void; reject: (e: Error) => void }[]>()
const queue: Job[] = []
let inFlight: Job | null = null
let inFlightTimer: ReturnType<typeof setTimeout> | null = null
const loadSince = new Map<PocketLang, number>()
// One sentence's synthesis takes seconds on this phone; forty-five seconds of
// silence from the worker is not slowness, it is death — and a model load that
// stops reporting even progress is the same corpse. Both used to jam the
// single-file queue forever: the eternal 'Processing…' (Oscar, in front of
// the panel, the app untouched).
const JOB_TIMEOUT_MS = 45_000
const LOAD_TIMEOUT_MS = 120_000
const clearFlightTimer = () => { if (inFlightTimer) { clearTimeout(inFlightTimer); inFlightTimer = null } }
let nextId = 1

function setLang(lang: PocketLang, patch: Partial<LangState>) {
  pocket.set((s) => ({ langs: { ...s.langs, [lang]: { ...s.langs[lang], ...patch } } }))
}

/** Phones run out of memory with two 177 MB models; keep one unless the device has plenty. */
const maxWorkers = () => (((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4) >= 8 ? 2 : 1)

function threads() {
  if (!self.crossOriginIsolated) return 1
  const forced = Number(localStorage.getItem('logos.threads'))
  if (forced) return forced
  // Kyutai built PocketTTS around two cores; a third helps phones a little.
  return Math.max(1, Math.min(3, (navigator.hardwareConcurrency ?? 2) - 2))
}

function dropWorker(lang: PocketLang) {
  workers.get(lang)?.terminate()
  workers.delete(lang)
  setLang(lang, { status: 'idle' })
  if (inFlight?.lang === lang) { clearFlightTimer(); queue.unshift(inFlight); inFlight = null }
}

function spawn(lang: PocketLang): Worker {
  const existing = workers.get(lang)
  if (existing) return existing
  while (workers.size >= maxWorkers()) {
    const other = [...workers.keys()].find((l) => l !== lang && inFlight?.lang !== l) ?? [...workers.keys()][0]
    dropWorker(other)
  }
  beforeSpawn()
  const w = new Worker(new URL('./pocket.worker.ts', import.meta.url), { type: 'module' })
  workers.set(lang, w)
  w.addEventListener('message', (e: MessageEvent<PocketResponse>) => onMessage(lang, e.data))
  w.addEventListener('error', (e) => {
    e.preventDefault?.()
    const msg = e.message || 'The PocketTTS engine crashed.'
    workers.delete(lang)
    setLang(lang, { status: 'error', error: msg })
    flushWaiters(lang, new Error(msg))
    if (inFlight?.lang === lang) { clearFlightTimer(); inFlight.reject(new Error(msg)); inFlight = null }
    pump()
  })
  return w
}

function flushWaiters(lang: PocketLang, err?: Error) {
  const list = waiters.get(lang) ?? []
  waiters.delete(lang)
  list.forEach((w) => (err ? w.reject(err) : w.resolve()))
}

function onMessage(lang: PocketLang, m: PocketResponse) {
  switch (m.type) {
    case 'progress':
      loadSince.set(lang, Date.now())
      setLang(lang, { loaded: m.loaded, total: m.total, fromCache: m.cached })
      break
    case 'ready':
      loadSince.delete(lang)
      setLang(lang, { status: 'ready', error: null, loadMs: m.ms, loaded: pocket.get().langs[lang].total, fromCache: true })
      pocket.set({ active: lang })
      keepStorage()
      flushWaiters(lang)
      pump()
      break
    case 'loadError':
      loadSince.delete(lang)
      workers.get(lang)?.terminate()
      workers.delete(lang)
      setLang(lang, { status: 'error', error: m.message })
      flushWaiters(lang, new Error(m.message))
      failQueued(lang, m.message)
      break
    case 'spoken':
    case 'speakError': {
      const job = inFlight
      if (!job || job.id !== m.id) break
      inFlight = null
      clearFlightTimer()
      if (m.type === 'spoken') {
        const dur = m.samples.length / m.sampleRate
        if (dur > 0.5) pocket.set({ lastRtf: m.ms / 1000 / dur })
        job.resolve({ samples: m.samples, sampleRate: m.sampleRate, ms: m.ms })
      } else job.reject(m.message === 'Aborted' ? new DOMException('Aborted', 'AbortError') : new Error(m.message))
      pump()
      break
    }
  }
}

function failQueued(lang: PocketLang, message: string) {
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].lang === lang) { queue[i].reject(new Error(message)); queue.splice(i, 1) }
}

/** Load a language's model (from the phone's cache after the first time). */
export function pocketEnsure(lang: PocketLang): Promise<void> {
  if (pocket.get().langs[lang].status === 'ready' && workers.has(lang)) return Promise.resolve()
  const p = new Promise<void>((resolve, reject) => {
    const list = waiters.get(lang) ?? []
    list.push({ resolve, reject })
    waiters.set(lang, list)
  })
  if (pocket.get().langs[lang].status !== 'loading' || !workers.has(lang)) {
    setLang(lang, { status: 'loading', loaded: 0, total: 0, error: null })
    loadSince.set(lang, Date.now())
    pocket.set({ active: lang })
    spawn(lang).postMessage({ type: 'load', language: POCKET_LANGUAGE[lang], threads: threads() } satisfies PocketRequest)
  }
  return p
}

export function pocketSynth(text: string, lang: PocketLang, voice: string, opts: { priority?: number; signal?: AbortSignal } = {}) {
  return new Promise<{ samples: Float32Array; sampleRate: number; ms: number }>((resolve, reject) => {
    if (opts.signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return }
    const job: Job = { id: nextId++, text, lang, voice, priority: opts.priority ?? 0, resolve, reject, signal: opts.signal }
    opts.signal?.addEventListener('abort', () => {
      const i = queue.indexOf(job)
      if (i >= 0) { queue.splice(i, 1); reject(new DOMException('Aborted', 'AbortError')) }
      else if (inFlight === job) workers.get(lang)?.postMessage({ type: 'cancel', id: job.id } satisfies PocketRequest)
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
  const st = pocket.get().langs[job.lang]
  if (st.status !== 'ready' || !workers.has(job.lang)) {
    if (st.status === 'loading') {
      // A load that has reported nothing — not even progress — for two
      // minutes is not loading; it is wedged. Kill it and fail the waiters
      // honestly, so the listener hears the truth instead of Processing…
      const since = loadSince.get(job.lang)
      if (since && Date.now() - since > LOAD_TIMEOUT_MS) {
        const msg = 'The voice model stopped loading.'
        loadSince.delete(job.lang)
        dropWorker(job.lang)
        flushWaiters(job.lang, new Error(msg))
        failQueued(job.lang, msg)
      }
    } else pocketEnsure(job.lang).catch(() => {})
    return
  }
  queue.shift()
  inFlight = job
  // The dispatch watchdog: if the worker never answers, this job — and the
  // whole single-file queue behind it — used to hang forever. Fail the job,
  // bury the worker, and let the next job raise a fresh one.
  clearFlightTimer()
  const dispatched = job
  inFlightTimer = setTimeout(() => {
    if (inFlight !== dispatched) return
    inFlight = null
    inFlightTimer = null
    dispatched.reject(new DOMException('The voice engine stopped answering.', 'TimeoutError'))
    dropWorker(dispatched.lang)
    pump()
  }, JOB_TIMEOUT_MS)
  workers.get(job.lang)!.postMessage({ type: 'speak', id: job.id, text: job.text, voice: job.voice } satisfies PocketRequest)
}

export function pocketPromote(signal: AbortSignal, priority: number) {
  const job = queue.find((j) => j.signal === signal)
  if (!job || job.priority >= priority) return
  job.priority = priority
  queue.sort((a, b) => b.priority - a.priority || a.id - b.id)
}

export function pocketClear(maxPriority = Infinity) {
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i].priority <= maxPriority) { queue[i].reject(new DOMException('Aborted', 'AbortError')); queue.splice(i, 1) }
  }
}

/** Free the models from memory (they stay saved on the phone), except one mid-sentence. */
export function pocketRelease() {
  for (const l of [...workers.keys()]) if (inFlight?.lang !== l) dropWorker(l)
}
let beforeSpawn: () => void = () => {}
export function onPocketBeforeLoad(fn: () => void) { beforeSpawn = fn }

export function pocketReset() {
  pocketClear()
  for (const l of [...workers.keys()]) dropWorker(l)
  inFlight = null
  queue.length = 0
  pocket.set({ langs: { en: blank(), es: blank() }, active: null })
}

export async function pocketDelete() {
  pocketReset()
  try { await caches.delete(CACHE) } catch { /* ignore */ }
}

/** Whether a language's model is already on this phone. */
export async function pocketCached(lang: PocketLang = 'en'): Promise<boolean> {
  try {
    const cache = await caches.open(CACHE)
    const keys = await cache.keys()
    const want = lang === 'es' ? 'spanish' : 'english'
    return keys.some((k) => k.url.includes(`pocket-tts-${want}`) && !k.url.includes('ipa'))
  } catch { return false }
}

export async function pocketCacheBytes(): Promise<number> {
  let bytes = 0
  try {
    const cache = await caches.open(CACHE)
    for (const req of await cache.keys()) {
      const res = await cache.match(req)
      const len = Number(res?.headers.get('content-length') ?? 0)
      bytes += len || (res ? (await res.blob()).size : 0)
    }
  } catch { /* ignore */ }
  return bytes
}

function keepStorage() {
  try { void navigator.storage?.persisted?.().then((p) => { if (!p) void navigator.storage.persist?.() }) } catch { /* unsupported */ }
}
