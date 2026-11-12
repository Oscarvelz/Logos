// Keeps the downloaded voice models on the phone, and notices when they vanish.
// After a model loads we check it really landed in the cache and stamp it in
// localStorage. On the next start, a stamp with no model behind it means the
// phone (or the browser) cleared the cache; Settings says so.
import { createStore } from '../lib/store.ts'
import { pocket, pocketCached } from './pocket.ts'
import { phonon, phononCached } from './phonon.ts'

type Kind = 'pocket' | 'phonon'
type Lang = 'en' | 'es'
export type KeepNote = { kind: 'cleared' | 'notSaved'; engine: Kind; lang: Lang; at: number; keptAt?: number }

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
  // The write finishes just after the model reports ready; give it a moment.
  await new Promise((r) => setTimeout(r, 4000))
  const kept = read<Record<string, number>>(KEY, {})
  if (await isCached(e, l)) {
    kept[`${e}.${l}`] = Date.now()
    write(KEY, kept)
    const n = keep.get().note
    if (n && n.engine === e && n.lang === l) setNote(null)
  } else {
    setNote({ kind: 'notSaved', engine: e, lang: l, at: Date.now() })
  }
  void protectStorage()
}

async function checkStamps() {
  const kept = read<Record<string, number>>(KEY, {})
  for (const [k, at] of Object.entries(kept)) {
    const [e, l] = k.split('.') as [Kind, Lang]
    if (await isCached(e, l)) continue
    delete kept[k]
    write(KEY, kept)
    setNote({ kind: 'cleared', engine: e, lang: l, at: Date.now(), keptAt: at })
  }
  // A 'notSaved' note whose model is in fact saved is a false alarm
  // (Pocket's probe lied about exactly this until 1.4.149); clear it on
  // sight instead of waiting for the next load's stamp to retire it.
  const n = keep.get().note
  if (n?.kind === 'notSaved' && (await isCached(n.engine, n.lang))) setNote(null)
}

export function startKeeping() {
  void protectStorage()
  void checkStamps()
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
