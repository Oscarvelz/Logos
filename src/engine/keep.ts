// Keeps the downloaded voice models on the phone, and notices when they vanish.
// After a model loads we check it really landed in the cache and stamp it in
// localStorage. A stamp with no model behind it — found at the next start, or
// mid-session by the re-checks in startKeeping (T4-14) — means the phone (or
// the browser) cleared the cache; Settings says so.
import { createStore } from '../lib/store.ts'
import { pocket, pocketCached, pocketModelDigest } from './pocket.ts'
import { phonon, phononCached, phononModelIdentity } from './phonon.ts'

type Kind = 'pocket' | 'phonon'
type Lang = 'en' | 'es'
export type KeepNote = { kind: 'cleared' | 'notSaved'; engine: Kind; lang: Lang; at: number; keptAt?: number }

/**
 * A stamp's identity (M-21): a stamp certifies a specific model, not
 * just "something was once there for this engine and language". Its
 * value binds the language AND the digest the cured probes know —
 * Pocket's manifest sha for that language (pocketModelDigest), or
 * Phonon's pinned model base (phononModelIdentity). Stamps written
 * before this binding are bare numbers (a time, no identity): they
 * are never honoured on their own word — checkStamps re-probes first
 * and only then upgrades a surviving legacy stamp to the current
 * identity. The probe always outranks the stamp: a stamp is written
 * only against a passing probe verdict, and honoured only when the
 * probe passes again at honour time.
 */
type Stamp = { at: number; digest: string | null }
type StampRecord = Record<string, number | Stamp>
const stampDigest = (e: Kind, l: Lang): string | null => (e === 'pocket' ? pocketModelDigest(l) : phononModelIdentity())
const stampAt = (v: number | Stamp): number => (typeof v === 'number' ? v : v.at)

const KEY = 'logos.kept'
const NOTE = 'logos.keepNote'
const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : d } catch { return d } }
const write = (k: string, v: unknown) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)) } catch { /* blocked */ } }

export const keep = createStore<{ persisted: boolean | null; note: KeepNote | null }>({ persisted: null, note: read<KeepNote | null>(NOTE, null) })

const isCached = (e: Kind, l: Lang) => (e === 'pocket' ? pocketCached(l) : phononCached())

function setNote(n: KeepNote | null) { write(NOTE, n); keep.set({ note: n }) }
export function dismissKeepNote() { setNote(null) }

export async function protectStorage(): Promise<boolean> {
  try {
    const s = navigator.storage
    if (!s?.persisted) return false
    let p = await s.persisted()
    if (!p && s.persist) p = await s.persist()
    keep.set({ persisted: p })
    return p
  } catch { return false }
}

async function stamp(e: Kind, l: Lang) {
  // The write finishes just after the model reports ready; give it a
  // moment — and more than one look (freshness, M-21): Phonon's bytes
  // reach the cache through an asynchronous handoff that can still be
  // in flight seconds after 'ready', so a single probe at a fixed 4 s
  // could brand a model that lands moments later "couldn't be saved".
  // The stamp is written only against a passing verdict from the
  // cured probes; the 'notSaved' note is posted only after the last
  // re-probe still fails.
  await new Promise((r) => setTimeout(r, 4000))
  let ok = await isCached(e, l)
  for (let i = 0; !ok && i < 3; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    ok = await isCached(e, l)
  }
  if (ok) {
    const digest = stampDigest(e, l)
    // A Pocket stamp without its digest identity certifies nothing
    // (M-21): the probe passing means the digest was recorded (the
    // primary probe records it, the fallback requires it), so a null
    // here is a state the stamp must not be written into — skip the
    // stamp rather than write an unbound one.
    if (e === 'pocket' && !digest) return
    const kept = read<StampRecord>(KEY, {})
    kept[`${e}.${l}`] = { at: Date.now(), digest }
    write(KEY, kept)
    const n = keep.get().note
    if (n && n.engine === e && n.lang === l) setNote(null)
  } else {
    setNote({ kind: 'notSaved', engine: e, lang: l, at: Date.now() })
  }
  void protectStorage()
}

/** One full stamp check: every stamp is re-probed, a stamp whose
 *  model is gone is deleted and reported as cleared, a surviving
 *  legacy stamp is re-bound. Exported as the detection seam — the
 *  triggers that call it mid-session live in startKeeping below. */
export async function checkStamps() {
  const kept = read<StampRecord>(KEY, {})
  for (const [k, v] of Object.entries(kept)) {
    const [e, l] = k.split('.') as [Kind, Lang]
    // The probe's verdict comes first and alone decides loss (M-21):
    // a stamp never outranks a failed probe, whatever it claims.
    if (!(await isCached(e, l))) {
      delete kept[k]
      write(KEY, kept)
      setNote({ kind: 'cleared', engine: e, lang: l, at: Date.now(), keptAt: stampAt(v) })
      continue
    }
    // The probe passes. A legacy bare-number stamp, or one bound to a
    // superseded digest (the model was replaced and the replacement
    // is verifiably present), is re-bound to the identity the probes
    // know now — the old stamp never certified the new bytes by
    // itself; the passing probe did, and the stamp now says so.
    const digest = stampDigest(e, l)
    if (typeof v === 'number' || v.digest !== digest) {
      if (e === 'pocket' && !digest) continue
      kept[k] = { at: stampAt(v), digest }
      write(KEY, kept)
    }
  }
  // A 'notSaved' note whose model is in fact saved is a false alarm
  // (Pocket's probe lied about exactly this until 1.4.149); clear it on
  // sight instead of waiting for the next load's stamp to retire it.
  const n = keep.get().note
  if (n?.kind === 'notSaved' && (await isCached(n.engine, n.lang))) setNote(null)
}

/** Forget every stamp and any standing note (M-24): a deliberate
 *  Delete model (engine.ts) is not an eviction — no stamp may survive
 *  it to be read at the next start as "the phone cleared the saved
 *  voice", and no note may outlive the models it described. */
export function clearKeepStamps() {
  write(KEY, null)
  setNote(null)
}

// Mid-session eviction watch (T4-14): checkStamps used to run
// exactly once, at app start, so this file noticed only vanishings
// that happened while the app was closed — a PWA left open for days
// whose bucket was evicted under storage pressure kept its
// "Protected / Downloaded" face until the next launch. The check
// now has two mid-session triggers for the life of the session:
// a re-check every 60 s, and a re-check the moment the app returns
// to the foreground (document visible again — the return from the
// background spell in which eviction pressure usually lands).
// Either trigger finding a stamp with no model behind it does what
// the start check always did: delete the stamp and post the
// 'cleared' note Settings shows. engine.ts runs the matching 60 s
// re-probe over its cached flags, so the Neural card's "Downloaded"
// falls in the same discovery.
const RECHECK_MS = 60_000
let recheckTimer: ReturnType<typeof setInterval> | null = null
let recheckListening = false

export function startKeeping() {
  void protectStorage()
  void checkStamps()
  if (!recheckTimer) recheckTimer = setInterval(() => { void checkStamps() }, RECHECK_MS)
  if (!recheckListening) {
    recheckListening = true
    try {
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void checkStamps() })
    } catch { /* no document — the interval still watches */ }
  }
  const seen = new Set<string>()
  const watch = (e: Kind, get: () => { langs: Record<Lang, { status: string; fromCache: boolean }> }) => () => {
    for (const l of ['en', 'es'] as Lang[]) {
      const s = get().langs[l]
      const id = `${e}.${l}`
      if (s.status === 'ready' && !seen.has(id)) { seen.add(id); void stamp(e, l) }
      if (s.status !== 'ready') seen.delete(id)
    }
  }
  pocket.subscribe(watch('pocket', pocket.get))
  phonon.subscribe(watch('phonon', phonon.get))
}
