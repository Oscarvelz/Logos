// PocketTTS manager: one worker per language (each model is its own 177 MB
// download), a priority queue shared with the rest of Logos, and progress
// reported to the rest of the app through engine.ts.
import { createStore } from '../lib/store.ts'
import type { PocketRequest, PocketResponse } from './pocket.worker.ts'
// The C-2 hash machinery (R2-T4-2): the certification probe below
// verifies content with the very digest function fetchAsset verifies
// downloads with, so probe and loader measure by one standard.
// @ts-expect-error pocket-assets.js is the vendored-assets replacement
// module (plain JS, no type declarations); only its sha256Hex is used.
import { sha256Hex } from './pocket-assets.js'

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
// Single-flight spawn (M-19): a spawn registers its worker here (and in
// `workers`) BEFORE any subscriber-firing call inside spawn — eviction,
// beforeSpawn — can re-enter pocketEnsure for the same language. A
// second ensure that arrives during a spawn finds the pending worker
// and joins its waiter list instead of constructing a second worker
// that overwrites the map entry and leaks the first, both loading
// 177 MB with only one reachable. `loadPostedFor` makes the 'load'
// message itself single-flight per worker, so a re-entrant ensure that
// beat the outer one to spawn() cannot make the outer one post a
// second load for the same worker.
const spawning = new Map<PocketLang, Worker>()
const loadPostedFor = new Map<PocketLang, Worker>()
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

// The load watchdog (T4-7): pump()'s timeout check only ticks when a
// synthesis job is queued, so an ensure-only load — the Settings
// "Download now", the App-start auto-warm — that wedged without ever
// posting progress hung forever, button disabled, no toast, no way
// back short of reload. This interval is a real time source behind
// every outstanding load: it runs while any load is outstanding and
// stops when none is, and a load it finds stale dies exactly the way
// pump()'s witnessed timeout dies — worker dropped, waiters and
// queued jobs failed with the same honest message.
let loadWatchdog: ReturnType<typeof setInterval> | null = null
function armLoadWatchdog() {
  if (loadWatchdog) return
  loadWatchdog = setInterval(() => {
    for (const [lang, since] of [...loadSince]) {
      if (pocket.get().langs[lang].status !== 'loading') { loadSince.delete(lang); continue }
      if (Date.now() - since <= LOAD_TIMEOUT_MS) continue
      const msg = 'The voice model stopped loading.'
      loadSince.delete(lang)
      dropWorker(lang, new Error(msg))
      flushWaiters(lang, new Error(msg))
      failQueued(lang, msg)
    }
    if (loadSince.size === 0 && loadWatchdog) { clearInterval(loadWatchdog); loadWatchdog = null }
  }, 1000)
}

function setLang(lang: PocketLang, patch: Partial<LangState>) {
  pocket.set((s) => ({ langs: { ...s.langs, [lang]: { ...s.langs[lang], ...patch } } }))
}

/** Phones run out of memory with two 177 MB models; keep one unless the device has plenty. */
const maxWorkers = () => (((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4) >= 8 ? 2 : 1)

function threads() {
  if (!self.crossOriginIsolated) return 1
  const forced = Number(localStorage.getItem('logos.threads'))
  if (forced) return forced
  // Kyutai built PocketTTS around two DESKTOP cores; phone cores are
  // several times weaker, so phones take one more thread than the old
  // cap (Oscar, 2026-11-11: Pocket's processing felt endless). Four is
  // the ceiling — past it the pool waits on its slowest member.
  return Math.max(1, Math.min(4, (navigator.hardwareConcurrency ?? 2) - 2))
}

function dropWorker(lang: PocketLang, failWith?: Error) {
  // Settle this language's load waiters as the worker dies (T4-8):
  // eviction (spawn, below) and the cross-engine release both land here
  // mid-load, and a pocketEnsure promise left unsettled hangs its
  // caller — the Settings download, the App-start auto-warm — forever.
  // The rejection takes the same shape the worker error handler and
  // the load timeout use: an Error saying the load stopped. When no
  // load is outstanding the waiter list is empty, so releasing a ready
  // worker stays silent, exactly as before.
  flushWaiters(lang, new Error('The voice model stopped loading.'))
  loadSince.delete(lang)
  loadPostedFor.delete(lang)
  workers.get(lang)?.terminate()
  workers.delete(lang)
  setLang(lang, { status: 'idle' })
  // Queued and in-flight synth jobs on the dropped worker (M-25): the
  // in-flight job is rescued exactly once — requeued at the head, its
  // dispatch timer cleared, inFlight nulled, so no late 'spoken' from
  // the dead worker can also settle it (onMessage only ever settles
  // the job currently in flight) and no second drop can requeue it
  // again. Then pump() runs the rescue: the head job re-ensures its
  // language and is dispatched to the respawned worker, instead of
  // sitting in the queue until some unrelated synth or message happens
  // to call pump — the stranding this cure closes. Callers that are
  // killing the load on purpose (watchdog, pump's own timeout, reset)
  // pass failWith: the in-flight job is failed honestly with that
  // error, never requeued, and no rescue pump runs — the caller
  // settles the queued jobs itself, in its own order.
  if (inFlight?.lang === lang) {
    clearFlightTimer()
    const job = inFlight
    inFlight = null
    if (failWith) job.reject(failWith)
    else queue.unshift(job)
  }
  // Deferred to a microtask, deliberately: dropWorker is called from
  // inside spawn()'s eviction loop, and a synchronous pump here could
  // chain pump → ensure → spawn → dropWorker recursively across the
  // two languages. The rescue still runs before any user-visible
  // stall — it is queued ahead of the next task, not behind it.
  if (!failWith) queueMicrotask(() => pump())
}

function spawn(lang: PocketLang): Worker {
  const existing = workers.get(lang)
  if (existing) return existing
  // A spawn already in flight for this language (M-19): join it, never
  // build a second worker over the top of it.
  const pending = spawning.get(lang)
  if (pending) return pending
  const w = new Worker(new URL('./pocket.worker.ts', import.meta.url), { type: 'module' })
  // Register BEFORE eviction and beforeSpawn: both fire store
  // subscribers, and a subscriber that ensures this same language
  // re-enters spawn() — it must find this worker, not build another.
  spawning.set(lang, w)
  workers.set(lang, w)
  w.addEventListener('message', (e: MessageEvent<PocketResponse>) => onMessage(lang, e.data))
  w.addEventListener('error', (e) => {
    e.preventDefault?.()
    // The true error first (M-22): an ErrorEvent often carries the
    // real error on .error while .message is empty — the generic
    // crash line is only for when neither says anything.
    const src = (e as ErrorEvent).error as { message?: unknown; name?: unknown } | undefined
    const msg = (typeof src?.message === 'string' && src.message) || e.message || 'The PocketTTS engine crashed.'
    const name = typeof src?.name === 'string' && src.name ? src.name : undefined
    workers.delete(lang)
    loadPostedFor.delete(lang)
    setLang(lang, { status: 'error', error: msg })
    flushWaiters(lang, reviveError(msg, name))
    if (inFlight?.lang === lang) { clearFlightTimer(); inFlight.reject(reviveError(msg, name)); inFlight = null }
    pump()
  })
  try {
    while (workers.size > maxWorkers()) {
      const other = [...workers.keys()].find((l) => l !== lang && inFlight?.lang !== l) ?? [...workers.keys()].find((l) => l !== lang)
      if (!other) break
      dropWorker(other)
    }
    beforeSpawn()
  } finally { spawning.delete(lang) }
  return w
}

/** Rebuild the error the worker actually threw (M-22): the message
 *  verbatim, and the kind — the error's name — carried back onto the
 *  page-side error, so a RangeError from the worker is not re-labelled
 *  a plain Error and an abort stays an AbortError. */
function reviveError(message: string, name?: string): Error {
  if (name === 'AbortError' || message === 'Aborted') return new DOMException(message || 'Aborted', 'AbortError')
  const e = new Error(message)
  if (name && name !== 'Error') e.name = name
  return e
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
      // fromCache keeps the value the progress reports actually gave
      // (T4-11): hard-coding true here claimed a cache provenance the
      // load may not have — a fresh download is not "from the phone".
      // (A download whose cache save failed never reaches this case
      // at all now: pocket-assets refuses it as a load error.)
      setLang(lang, { status: 'ready', error: null, loadMs: m.ms, loaded: pocket.get().langs[lang].total })
      pocket.set({ active: lang })
      keepStorage()
      flushWaiters(lang)
      pump()
      break
    case 'loadError':
      loadSince.delete(lang)
      workers.get(lang)?.terminate()
      workers.delete(lang)
      loadPostedFor.delete(lang)
      setLang(lang, { status: 'error', error: m.message })
      flushWaiters(lang, reviveError(m.message, m.name))
      // A job in flight on this worker dies with it (M-25): fail it
      // honestly now, with the load's own error, instead of leaving it
      // to the 45 s dispatch timer on a worker that no longer exists.
      if (inFlight?.lang === lang) { clearFlightTimer(); const j = inFlight; inFlight = null; j.reject(reviveError(m.message, m.name)) }
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
      } else job.reject(reviveError(m.message, m.name))
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
  // Single-flight (M-19): an ensure that arrives while a spawn for this
  // language is in flight joins the same pending worker — it adds its
  // waiter above and does not spawn or post a second load.
  if (!spawning.has(lang) && (pocket.get().langs[lang].status !== 'loading' || !workers.has(lang))) {
    setLang(lang, { status: 'loading', loaded: 0, total: 0, error: null })
    loadSince.set(lang, Date.now())
    armLoadWatchdog()
    pocket.set({ active: lang })
    const w = spawn(lang)
    if (loadPostedFor.get(lang) !== w) {
      loadPostedFor.set(lang, w)
      w.postMessage({ type: 'load', language: POCKET_LANGUAGE[lang], threads: threads() } satisfies PocketRequest)
    }
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
        dropWorker(job.lang, new Error(msg))
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
  // Reset is a deliberate kill (M-25): the in-flight job is failed
  // honestly with the same AbortError pocketClear gives queued jobs,
  // never requeued into a queue this function is about to empty —
  // requeue-then-empty was a strand: the job's promise never settled.
  for (const l of [...workers.keys()]) dropWorker(l, new DOMException('Aborted', 'AbortError'))
  inFlight = null
  queue.length = 0
  pocket.set({ langs: { en: blank(), es: blank() }, active: null })
}

export async function pocketDelete() {
  pocketReset()
  // Delete resets every piece of bookkeeping (M-24): the digest
  // registry goes with the bucket, so no later probe can match a key
  // against an identity whose model was deliberately removed.
  clearPocketDigests()
  try { await caches.delete(CACHE) } catch { /* ignore */ }
}

// The digest registry (M-18): the cache key grammar is
// '<file>?v=<sha>' — the file name is the same 'model.onnx' for every
// language, so the digest in the key is the ONLY language identity a
// cached entry carries. The primary probe learns each language's
// digest from its manifest and records it here; the offline fallback
// may then match keys against the digest recorded for the language
// being probed — and only that language. With no recorded digest for
// the language, the fallback certifies nothing: a bare model-sized
// blob in the bucket cannot say which language it speaks.
const DIGEST_KEY = 'logos.pocketDigests'
type PocketDigest = { file: string; sha: string; bytes?: number }
/** The session's own copy of each recorded digest (R3-T4-2). The
 *  registry write below can be refused — quota, a storage partition
 *  that refuses localStorage while Cache Storage works — and the
 *  refusal is swallowed, so a digest known only to localStorage could
 *  be lost in the very session whose probe verified it: the primary
 *  probe certifies from the manifest directly, never consults the
 *  registry, and keep.ts then found pocketModelDigest null at stamp
 *  time and skipped the stamp in silence — no stamp, no note, the
 *  eviction watch never armed. The memory is written first and
 *  unconditionally, and readPocketDigests lets it outrank the stored
 *  registry: it is the digest the passing probe itself used, this
 *  session, first-hand. Across sessions the registry remains the
 *  record, re-recorded by the next primary probe as before. */
const digestMemory = new Map<PocketLang, PocketDigest>()
function readPocketDigests(): Partial<Record<PocketLang, PocketDigest>> {
  let stored: Partial<Record<PocketLang, PocketDigest>> = {}
  try {
    const v = localStorage.getItem(DIGEST_KEY)
    const o = v ? JSON.parse(v) as Partial<Record<PocketLang, PocketDigest>> : {}
    stored = o && typeof o === 'object' ? o : {}
  } catch { /* blocked — the session memory below still answers */ }
  for (const [lang, d] of digestMemory) stored[lang] = d
  return stored
}
function recordPocketDigest(lang: PocketLang, d: PocketDigest) {
  digestMemory.set(lang, d)
  try {
    const v = localStorage.getItem(DIGEST_KEY)
    const o = v ? JSON.parse(v) as Partial<Record<PocketLang, PocketDigest>> : {}
    const all = o && typeof o === 'object' ? o : {}
    if (all[lang]?.sha === d.sha && all[lang]?.file === d.file) return
    all[lang] = d
    localStorage.setItem(DIGEST_KEY, JSON.stringify(all))
  } catch { /* blocked — the session memory above carries it instead */ }
}
function clearPocketDigests() { digestMemory.clear(); try { localStorage.removeItem(DIGEST_KEY) } catch { /* blocked */ } }
/** The digest the probes currently know for a language, if any —
 *  keep.ts binds its stamps to this identity (M-21). */
export function pocketModelDigest(lang: PocketLang): string | null {
  return readPocketDigests()[lang]?.sha ?? null
}

/** Measure one cache entry against its manifest identity: the stored
 *  header must agree with the body (the 1.4.147 rule), the body must
 *  be exactly the declared size — or, when no size is declared,
 *  plainly model-sized — and, whenever the digest is known, the body
 *  must HASH to it (R2-T4-2). Size alone certified a same-length
 *  substitution: the digest recorded for the key was used only to
 *  find the entry, never to verify what was filed under it, while
 *  keep.ts stamps bind themselves to that same digest. The hash is
 *  computed with the C-2 machinery (sha256Hex in pocket-assets.js —
 *  the function fetchAsset verifies downloads with), and only after
 *  the cheap size bars pass. Shared by the primary probe and the
 *  offline fallback so both certify by the same standard. */
async function entryMatchesModel(cache: Cache, key: { url: string }, expectedBytes?: number, expectedSha?: string): Promise<boolean> {
  const res = await cache.match(key as Request)
  if (!res) return false
  const buf = await res.arrayBuffer()
  const actual = buf.byteLength
  const declared = Number(res.headers.get('content-length') ?? 0)
  if (declared > 0 && declared !== actual) return false
  if (typeof expectedBytes === 'number' && expectedBytes > 0) {
    if (actual !== expectedBytes) return false
  } else if (actual <= 100_000_000) return false
  const sha = typeof expectedSha === 'string' ? expectedSha.trim().toLowerCase() : ''
  if (sha) {
    let actualSha: string
    try { actualSha = await sha256Hex(buf) } catch { return false }
    if (actualSha !== sha) return false
  }
  return true
}

/** The manifest fetch behind the cached probe, with a deadline
 *  (R2-T4-6). A connection that is accepted and then held — a captive
 *  portal, a dead proxy — used to hang this fetch forever, and with
 *  it every probe: isModelCached's Promise.all never resolved, so
 *  the App-start probe, the 60 s recheck and keep.ts's stamp checks
 *  all piled up behind the same stuck fetch, and the cure watchdogs
 *  (T4-7) watched loads only. The probe now gives the manifest ten
 *  seconds — a lifetime for a small JSON on any honest link — and
 *  then treats the network as what it is behaving as: offline. The
 *  abort lands in pocketCached's existing catch, so the
 *  language-bound recorded-digest fallback answers instead, and
 *  every caller settles. */
const MANIFEST_PROBE_TIMEOUT_MS = 10_000
async function fetchPocketManifest(lang: PocketLang): Promise<{ model?: { file?: string; sha256?: string; bytes?: number } }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), MANIFEST_PROBE_TIMEOUT_MS)
  try {
    return await (await fetch(`https://huggingface.co/thewh1teagle/pocket-tts-onnx/resolve/main/${lang}/manifest.json`, { signal: ctrl.signal })).json() as { model?: { file?: string; sha256?: string; bytes?: number } }
  } finally {
    clearTimeout(timer)
  }
}

/** Whether a language's model is already on this phone. */
export async function pocketCached(lang: PocketLang = 'en'): Promise<boolean> {
  try {
    const cache = await caches.open(CACHE)
    const keys = await cache.keys()
    // The loader files the model under its manifest name and digest —
    // 'model.onnx?v=<sha>' — never under the library's display name.
    // The old probe searched the keys for 'pocket-tts-english', could
    // never match, and answered "not saved" forever: the Storage note
    // was a false alarm even while the model sat saved (proven
    // 2026-11-12 against the loader's live manifest: the English
    // model is 176,992,315 B + a 39 MB encoder + assets — exactly
    // the bytes Settings counts in this bucket).
    try {
      const m = await fetchPocketManifest(lang)
      const file = m.model?.file
      const sha = m.model?.sha256
      if (file && sha) {
        // Learn this language's digest identity (M-18) before judging:
        // the offline fallback below is only as honest as this record.
        recordPocketDigest(lang, { file, sha, bytes: typeof m.model?.bytes === 'number' ? m.model.bytes : undefined })
        // Key existence alone never certifies (T4-3): a 1-byte stub or
        // an HTML error page filed under the digest key is not a model.
        // The manifest declares the model's true size (`bytes` —
        // 176,992,315 for the English model), so open the entry filed
        // under the key and measure its actual body against it; the
        // entry's own stored header must agree with its body too (the
        // 1.4.147 rule). Only a body of exactly the declared size —
        // or, if a manifest ever omits `bytes`, a plainly model-sized
        // body — reports "downloaded".
        const hitKey = keys.find((k) => k.url.includes(`${file}?v=${sha}`))
        if (!hitKey) return false
        return await entryMatchesModel(cache, hitKey, m.model?.bytes, sha)
      }
    } catch { /* offline — fall through to the language-bound fallback */ }
    // Offline fallback (M-18, was T4-10): the old shape loop iterated
    // EVERY key and certified this language from any model-sized
    // 'model.onnx' entry — the English model certified Spanish, in
    // exactly the offline condition this probe exists for. The key
    // grammar carries the language's identity in its digest
    // ('model.onnx?v=<sha>'), so the fallback now matches only the
    // key carrying the digest recorded for THIS language, measured
    // by the same standard as the primary probe. No recorded digest
    // for this language → nothing is certified.
    const known = readPocketDigests()[lang]
    if (!known) return false
    const hitKey = keys.find((k) => k.url.includes(`${known.file}?v=${known.sha}`))
    if (!hitKey) return false
    return await entryMatchesModel(cache, hitKey, known.bytes, known.sha)
  } catch { /* ignore */ }
  return false
}

export async function pocketCacheBytes(): Promise<number> {
  let bytes = 0
  try {
    const cache = await caches.open(CACHE)
    for (const req of await cache.keys()) {
      const res = await cache.match(req)
      // The body is the only witness (R3-T4-3): the stored header used
      // to win whenever present, so a truncated entry under a truthful
      // header — the interrupted-write shape pocket-assets' cacheGet
      // refuses to serve — counted at full size in Settings' storage
      // total. Measure what is actually there. (The price of
      // measuring on every call is paid by the caller: engine.ts's
      // modelCacheBytes files the measured total under the engine
      // landscape and re-measures only when it changes — R4-T4-3.
      // This counter itself never trusts a memory.)
      bytes += res ? (await res.blob()).size : 0
    }
  } catch { /* ignore */ }
  return bytes
}

function keepStorage() {
  try { void navigator.storage?.persisted?.().then((p) => { if (!p) void navigator.storage.persist?.() }) } catch { /* unsupported */ }
}
