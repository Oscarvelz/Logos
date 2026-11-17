// Logos voice engines: Phonon (Gradium) and PocketTTS (Kyutai), both
// running on the phone's processor. This module is the one door the
// rest of the app uses: model status for the UI, loading, and a
// prioritised synthesis queue (Listen jumps the line). Each voice
// belongs to one engine. (A third engine, Kokoro, was removed whole
// in 1.4.146 — see removeKokoroCaches below.)
import { createStore } from '../lib/store.ts'
import { settings } from '../lib/settings.ts'
import { voiceById, type EngineKind } from '../lib/voices.ts'
import { timeStretch } from '../lib/audio.ts'
import { t } from '../lib/i18n.ts'
import { pocket, pocketEnsure, pocketSynth, pocketPromote, pocketClear, pocketDelete, pocketCached, pocketCacheBytes, pocketRelease, onPocketBeforeLoad, POCKET_SIZE_MB, type PocketLang } from './pocket.ts'
import { phonon, phononEnsure, phononSynth, phononPromote, phononClear, phononDelete, phononCached, phononCacheBytes, phononRelease, phononLoaded, onPhononBeforeLoad, PHONON_SIZE_MB } from './phonon.ts'
import { clearKeepStamps } from './keep.ts'

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error'
export type SynthResult = { samples: Float32Array; sampleRate: number; ms: number }

export type EngineState = {
  status: ModelStatus
  /** a routing substitution to tell the listener about (M-20), or null */
  note: string | null
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

export { POCKET_SIZE_MB, PHONON_SIZE_MB, pocketCacheBytes }
export async function modelCacheBytes(): Promise<number> {
  const [a, b] = await Promise.all([pocketCacheBytes(), phononCacheBytes()])
  return a + b
}

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* blocked */ } },
  del: (k: string) => { try { localStorage.removeItem(k) } catch { /* blocked */ } },
}

// Cached state is per engine (T4-6): one shared boolean probed once
// at startup for the startup engine used to answer for whichever
// engine was active later, so switching voices imported the other
// engine's download state in both directions — "Downloaded" over a
// Pocket model never fetched, "Not downloaded" over one sitting in
// the cache. Each kind now keeps its own probe result (null = never
// probed), and isModelCached probes and stores both.
// And Pocket's flag is per LANGUAGE (R2-T4-5): its models are
// separate ~179 MB downloads per language, but the flag was probed
// for the wanted language only and then read for whichever language
// the Pocket store showed active — with only English downloaded, a
// switch to Spanish still showed "Downloaded" and labelled the
// Spanish load 'warm' until the 60 s recheck happened to re-probe.
// (The routing layer never had the lie: engineUsable always asked
// Pocket per language. Only the shown flag was language-blind.)
// Phonon keeps a single flag — one model serves both its languages.
let phononCachedFlag: boolean | null = null
const pocketCachedFlags: Record<PocketLang, boolean | null> = { en: null, es: null }
/** The M-20 routing substitution note, read by computeFrom below —
 *  declared here, above the engine store's creation, because that
 *  creation calls compute() immediately. */
let routeNote: string | null = null
let lastSubstitution = ''
const cachedOf = (kind: EngineKind, lang?: PocketLang): boolean =>
  kind === 'phonon' ? (phononCachedFlag ?? false) : (pocketCachedFlags[lang ?? wantedLang()] ?? false)
/** Whether an engine's cached verdict (Pocket: for the language in
 *  question) has never been probed — the subscribers' cue to ask for
 *  a first probe rather than let an unprobed answer stand in. */
const cachedUnprobed = (kind: EngineKind, lang?: PocketLang): boolean =>
  kind === 'phonon' ? phononCachedFlag === null : pocketCachedFlags[lang ?? wantedLang()] === null
const wantedLang = (): PocketLang => (settings.get().langMode === 'es' ? 'es' : 'en')
/** The engine of the voice Listen will use. */
let lastKind: EngineKind | null = null
function activeKind(): EngineKind {
  if (lastKind) return lastKind
  const st = settings.get()
  const id = st.voiceOverride ?? st.defaultVoice[wantedLang()]
  return voiceById(id)?.engine ?? 'phonon'
}
const kindOf = (voice: string): EngineKind => voiceById(voice)?.engine ?? (voice.startsWith('pk_') ? 'pocket' : 'phonon')

// Phones run out of memory with several models loaded: loading one engine
// frees the other unless the device has plenty of memory.
const roomy = () => ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4) >= 8
onPhononBeforeLoad((lang) => {
  if (!roomy()) { pocketRelease(); for (const l of phononLoaded()) if (l !== lang) phononRelease(l) }
})
onPocketBeforeLoad(() => { if (!roomy()) { for (const l of phononLoaded()) phononRelease(l) } })

function compute(): EngineState {
  const k = activeKind()
  return k === 'phonon' ? computeFrom(phonon.get(), 'phonon') : computeFrom(pocket.get(), 'pocket')
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
    note: routeNote,
    progress: l.total ? l.loaded / l.total : 0,
    loaded: l.loaded,
    total: l.total,
    error: friendlyError(l.error),
    // Cached means saved, not loaded (T4-11): this used to be
    // `cachedOf(kind) || anyReady`, so a model merely resident in
    // memory claimed "Downloaded / works offline" even when its
    // cache write had failed and nothing was kept. The flag now
    // answers alone, and it is earned: a load only reaches 'ready'
    // with its save verified (pocket-assets refuses a failed store;
    // phonon.ts verifies the bucket before filing its instance),
    // and the ready transition below re-probes the real caches, so
    // a verified save certifies here without anyReady's say-so.
    cached: cachedOf(kind, lang),
    lastRtf: p.lastRtf,
    loadMs: l.loadMs,
    phase: l.status === 'loading' ? (l.fromCache || (cachedOf(kind, lang) && !l.total) ? 'warm' : 'download') : null,
    lang,
    kind,
    threads: p.threads ?? null,
  }
}

export const engine = createStore<EngineState>(compute())
// A ready transition earns a fresh cache probe (T4-11): with
// anyReady gone from the cached flag, this re-probe is how a load
// whose save was verified at its own seam certifies as cached —
// the probe, not the readiness, is what says "saved". One probe
// per ready spell per engine; a release back to not-ready re-arms it.
const readyProbeSeen: Record<EngineKind, boolean> = { phonon: false, pocket: false }
function reprobeOnReady(kind: EngineKind, p: { langs: Record<PocketLang, { status: string }>; active?: PocketLang | null }) {
  const anyReadyNow = (['en', 'es'] as PocketLang[]).some((x) => p.langs[x].status === 'ready')
  if (!anyReadyNow) { readyProbeSeen[kind] = false; return }
  if (readyProbeSeen[kind]) return
  readyProbeSeen[kind] = true
  const knownTrue = kind === 'phonon' ? phononCachedFlag === true : pocketCachedFlags[p.active ?? wantedLang()] === true
  if (!knownTrue) void isModelCached()
}
pocket.subscribe(() => { engine.set(compute()); reprobeOnReady('pocket', pocket.get()) })
phonon.subscribe(() => { engine.set(compute()); reprobeOnReady('phonon', phonon.get()) })
settings.subscribe(() => {
  lastKind = null
  // A settings change (a new voice pick above all) retires any routing
  // substitution note: it described the previous pick, not this one.
  routeNote = null
  lastSubstitution = ''
  engine.set(compute())
  // A voice switch can land on an engine whose cached state was never
  // probed; probe it (both engines are probed and stored per kind —
  // Pocket per language) rather than letting another answer stand in.
  if (cachedUnprobed(activeKind())) void isModelCached()
})

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
  const busy = (['en', 'es'] as PocketLang[]).some((x) => pocket.get().langs[x].status === 'loading' || phonon.get().langs[x].status === 'loading')
  if (busy) { if (!ls.get(LOADING_KEY)) ls.set(LOADING_KEY, String(Date.now())) } else ls.del(LOADING_KEY)
}
pocket.subscribe(watchLoading)
phonon.subscribe(watchLoading)

/** Load the voice (from the phone after the first download). */
export function ensureModel(): Promise<void> {
  const k = activeKind()
  if (k === 'phonon') return phononEnsure(phonon.get().active ?? wantedLang())
  return pocketEnsure(pocket.get().active ?? wantedLang())
}

// ── Synthesis routing truth (M-20) ─────────────────────────────────
// The voice picker offers the whole catalogue, downloaded or not, and
// this router used to honour any pick: on a fresh install, a first
// Play on a voice whose engine model was never downloaded queued
// sentence after sentence against a model that was not there, and
// each sentence failed on its own. Routing now checks the truth it
// owns — is this engine's model for this language loaded, or verifiably
// downloaded (the cured per-engine probes) — and a pick that fails
// the check is re-routed to the loaded/downloaded default voice for
// that language, with the substitution surfaced on the engine store's
// note (the status channel every engine surface reads). When NO
// engine for the language is usable, the original pick stands: the
// queue's own ensure performs the one shared first download, exactly
// as the Settings download does, instead of a fabricated success.
/** The factory default voice of each engine, per language — the same
 *  ids settings.ts ships and migrates to. */
const FACTORY_DEFAULT: Record<EngineKind, Record<PocketLang, string>> = {
  phonon: { en: 'ph_NbpkqMVS3CJeq2j8', es: 'ph_b6FvJAiokjdqIti4' },
  pocket: { en: 'pk_alba', es: 'pk_lola' },
}
/** Positive probe verdicts, per engine+language, memoised for the
 *  session. Negative verdicts are never memoised — a download can
 *  land at any time. A memoised positive is not immortal, though
 *  (T4-14): the periodic re-probe in isModelCached below retires a
 *  memo the moment its engine's real probe stops passing, so a
 *  mid-session eviction un-certifies routing as well as the flag.
 *  deleteModel clears the memo with everything else (M-24). */
const downloadedMemo = new Set<string>()
const memoKey = (kind: EngineKind, lang: PocketLang) => `${kind}.${lang}`
function engineReady(kind: EngineKind, lang: PocketLang): boolean {
  return (kind === 'phonon' ? phonon.get() : pocket.get()).langs[lang].status === 'ready'
}
async function engineUsable(kind: EngineKind, lang: PocketLang): Promise<boolean> {
  if (engineReady(kind, lang)) { downloadedMemo.add(memoKey(kind, lang)); return true }
  if (downloadedMemo.has(memoKey(kind, lang))) return true
  if (kind === 'phonon' && phononCachedFlag === true) { downloadedMemo.add(memoKey(kind, lang)); return true }
  // Pocket is always asked per language through its own cured probe
  // (its shown flag is per-language too, since R2-T4-5 — the two
  // finally agree); Phonon reaches here only when its per-engine
  // flag is not already a positive answer.
  const ok = kind === 'phonon' ? await phononCached() : await pocketCached(lang)
  if (kind === 'phonon') phononCachedFlag = ok
  if (ok) downloadedMemo.add(memoKey(kind, lang))
  return ok
}
async function routeVoice(voice: string, lang: PocketLang): Promise<string> {
  const v = voiceById(voice)
  if (!v) return voice
  if (await engineUsable(v.engine, lang)) {
    if (routeNote) { routeNote = null; engine.set(compute()) }
    return voice
  }
  const candidates = [settings.get().defaultVoice[lang], FACTORY_DEFAULT.phonon[lang], FACTORY_DEFAULT.pocket[lang]]
  for (const c of candidates) {
    const cv = voiceById(c)
    if (!cv || cv.id === voice || cv.lang !== lang) continue
    if (await engineUsable(cv.engine, lang)) {
      const sub = `${voice}→${c}`
      if (lastSubstitution !== sub) {
        lastSubstitution = sub
        routeNote = t('That voice is not downloaded yet, so the downloaded voice is reading instead.')
        engine.set(compute())
      }
      return c
    }
  }
  return voice
}

export function synthesize(text: string, voice: string, speed: number, opts: { priority?: number; signal?: AbortSignal } = {}): Promise<SynthResult> {
  return (async () => {
    const picked = voiceById(voice)
    const lang: PocketLang = picked?.lang === 'es' ? 'es' : 'en'
    const routed = await routeVoice(voice, lang)
    const kind = kindOf(routed)
    if (opts.priority && opts.priority >= 1000 && kind !== lastKind) {
      lastKind = kind
      engine.set(compute())
      if (cachedUnprobed(kind)) void isModelCached()
    }
    const job = kind === 'phonon' ? phononSynth(text, lang, routed, opts) : pocketSynth(text, lang, routed.replace(/^pk_/, ''), opts)
    const r = await job
    return speed && Math.abs(speed - 1) > 0.01 ? { ...r, samples: timeStretch(r.samples, r.sampleRate, speed) } : r
  })()
}

export function promote(signal: AbortSignal, priority: number) { pocketPromote(signal, priority); phononPromote(signal, priority) }
export function clearQueue(maxPriority?: number) { pocketClear(maxPriority); phononClear(maxPriority) }

// Mid-session eviction watch (T4-14): the cached flags used to be
// probed exactly once, at App start, so a model bucket evicted under
// storage pressure while the app sat open kept displaying
// "Downloaded" until the next launch — or until an offline play
// attempt failed. The first probe (App start calls isModelCached)
// arms this re-check for the rest of the session: every 60 s both
// engines are re-probed through the same cured probes, each flag is
// re-filed under its own kind (Pocket: under its own language), and
// a probe that now fails also retires that engine's memoised
// routing verdicts (phonon for both languages — one shared model;
// pocket per language, matching its per-language flags).
// keep.ts runs the matching watch over its stamps and posts the
// "phone cleared the saved voice" note from the same discovery.
const CACHED_RECHECK_MS = 60_000
let cachedRecheck: ReturnType<typeof setInterval> | null = null
function armCachedRecheck() {
  if (cachedRecheck) return
  cachedRecheck = setInterval(() => { void isModelCached() }, CACHED_RECHECK_MS)
}

export async function isModelCached(): Promise<boolean> {
  armCachedRecheck()
  // Probe BOTH engines and store each answer under its own kind, so
  // the flag that answers for an engine is always that engine's own —
  // whichever engine is active when the question is asked later.
  // Pocket is probed for BOTH languages and each verdict filed under
  // its own language (R2-T4-5): two small manifest fetches per cycle
  // is the price of neither language ever borrowing the other's
  // answer.
  const [ph, pkEn, pkEs] = await Promise.all([phononCached(), pocketCached('en'), pocketCached('es')])
  phononCachedFlag = ph
  pocketCachedFlags.en = pkEn
  pocketCachedFlags.es = pkEs
  if (!ph) { downloadedMemo.delete(memoKey('phonon', 'en')); downloadedMemo.delete(memoKey('phonon', 'es')) }
  if (!pkEn) downloadedMemo.delete(memoKey('pocket', 'en'))
  if (!pkEs) downloadedMemo.delete(memoKey('pocket', 'es'))
  engine.set(compute())
  return cachedOf(activeKind())
}

/** Remove the downloaded voice models from this device. */
export async function deleteModel() {
  // Delete is the one writer that resets ALL the bookkeeping (M-24):
  // the per-engine cached flags, the routing probe memo and note, the
  // Pocket digest registry (inside pocketDelete), the engine stores
  // (inside pocket/phononDelete) — and the keep.ts stamps and note.
  // The stamps were the surviving lie: deleteModel used to leave
  // 'logos.kept' untouched, so the next start's checkStamps found a
  // stamp with no cache behind it and reported an eviction — "The
  // phone cleared the saved voice" — for the user's own deliberate
  // deletion. The resets below run unconditionally, in intent
  // atomically: each engine delete already swallows its own cache
  // failures, and the bookkeeping resets do not depend on them, so
  // after deleteModel() every flag, stamp and memo is in exactly the
  // state the cured probes will find — nothing downloaded, nothing
  // kept, nothing substituted.
  await pocketDelete()
  await phononDelete()
  clearKeepStamps()
  downloadedMemo.clear()
  routeNote = null
  lastSubstitution = ''
  phononCachedFlag = false
  pocketCachedFlags.en = false
  pocketCachedFlags.es = false
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
  for (const k of ['logos.gpuBroken', 'logos.gpuFp16Broken', 'logos.gpuWhy', 'logos.mig110', 'logos.mig123', 'logos.spin']) ls.del(k)
  ls.set('logos.legacyRemoved', '1')
}

/**
 * Kokoro (1.4.143–1.4.145) was removed whole in 1.4.146 by Oscar's
 * verdict — too heavy for the app; its load closed the app on his
 * phone. Its downloads live in two Cache Storage buckets nothing else
 * uses; delete them once so the phone gets its ~100–270 MB back.
 * Saved kk_ voice choices are migrated by settings.ts (they land on
 * Pocket Alba/Lola like every removed engine before them).
 */
export async function removeKokoroCaches() {
  if (ls.get('logos.kokoroRemoved') === '1') return
  // T4-17 cure: the done flag is earned, not assumed. It used to be set
  // unconditionally after two deletes whose rejections were swallowed
  // by their own try/catch, so one transient failure (storage blocked,
  // a WebView hiccup) closed the gate forever while the buckets it
  // exists to reclaim stayed on the phone. A delete that RESOLVES
  // counts — true or false, the bucket is gone either way; a rejection
  // leaves the flag unset, and the next launch tries again. No Cache
  // Storage at all means there is nothing to reclaim on this device,
  // which is done by definition.
  if (typeof caches === 'undefined') { ls.set('logos.kokoroRemoved', '1'); return }
  let allGone = true
  for (const bucket of ['transformers-cache', 'kokoro-voices']) {
    try { await caches.delete(bucket) } catch { allGone = false }
  }
  if (allGone) ls.set('logos.kokoroRemoved', '1')
}
