// Saved clips in IndexedDB.
import { createStore } from './store.ts'
import { clipPlayer, onClipEnded } from '../player/clip.ts'

export type Clip = {
  id: string
  title: string
  text: string
  voice: string
  lang: string
  createdAt: number
  duration: number
  format: string            // mp3 | wav | m4a | ogg … ('' for a text saved to listen later)
  size: number
  blob?: Blob               // absent for "Listen later" texts that have no audio yet
  kind?: 'audio' | 'text'   // missing on clips saved before 1.4.13 → audio
  source?: 'listen' | 'create' | 'import'
  summary?: string
  fav?: boolean
  done?: boolean            // finished listening
  pos?: number              // resume position (seconds)
  playedAt?: number
  rendering?: boolean       // audio is being made for this item right now
  url?: string              // the web page the text came from
  site?: string
}

export type ClipMeta = Omit<Clip, 'blob'>

const DB = 'logos'
const STORE = 'clips'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('createdAt', 'createdAt')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const library = createStore<{ clips: ClipMeta[]; loaded: boolean }>({ clips: [], loaded: false })

export async function refreshLibrary() {
  try {
    const all = await tx<Clip[]>('readonly', (s) => s.getAll() as IDBRequest<Clip[]>)
    const clips = all.map(({ blob: _b, ...m }) => { void _b; return m }).sort((a, b) => b.createdAt - a.createdAt)
    library.set({ clips, loaded: true })
  } catch {
    library.set({ loaded: true })
  }
}

export const kindOf = (c: Pick<Clip, 'kind'>) => c.kind ?? 'audio'

export async function saveClip(clip: Omit<Clip, 'id' | 'createdAt' | 'size'> & { id?: string; createdAt?: number }): Promise<ClipMeta> {
  const full: Clip = { ...clip, id: clip.id ?? crypto.randomUUID?.() ?? String(Date.now()), createdAt: clip.createdAt ?? Date.now(), size: clip.blob?.size ?? 0 }
  await tx('readwrite', (s) => s.put(full))
  try { await navigator.storage?.persist?.() } catch { /* optional */ }
  await refreshLibrary()
  const { blob: _b, ...meta } = full
  void _b
  return meta
}

export async function getClipBlob(id: string): Promise<Blob | null> {
  const clip = await tx<Clip | undefined>('readonly', (s) => s.get(id) as IDBRequest<Clip | undefined>)
  return clip?.blob ?? null
}

export async function getClip(id: string): Promise<Clip | null> {
  return (await tx<Clip | undefined>('readonly', (s) => s.get(id) as IDBRequest<Clip | undefined>)) ?? null
}

export async function deleteClip(id: string) {
  await tx('readwrite', (s) => s.delete(id))
  await refreshLibrary()
}

export async function restoreClip(clip: Clip) {
  await tx('readwrite', (s) => s.put(clip))
  await refreshLibrary()
}

/** Change an item's details (title, favourite, finished, position…) without touching its audio. */
export async function updateClip(id: string, patch: Partial<Omit<Clip, 'id'>>, refresh = true) {
  const cur = await getClip(id)
  if (!cur) return
  await tx('readwrite', (s) => s.put({ ...cur, ...patch, size: patch.blob ? patch.blob.size : cur.size }))
  if (refresh) await refreshLibrary()
  else library.set((st) => ({ clips: st.clips.map((c) => (c.id === id ? { ...c, ...patch, blob: undefined } as ClipMeta : c)) }))
}

export async function deleteClips(ids: string[]): Promise<Clip[]> {
  const gone: Clip[] = []
  for (const id of ids) { const c = await getClip(id); if (c) gone.push(c); await tx('readwrite', (s) => s.delete(id)) }
  await refreshLibrary()
  return gone
}

export async function restoreClips(clips: Clip[]) {
  for (const c of clips) await tx('readwrite', (s) => s.put(c))
  await refreshLibrary()
}

/** Save a text to hear later, instantly, with no audio yet. */
export async function saveForLater(text: string, info: { title: string; summary?: string; lang: string; voice: string; duration: number; url?: string; site?: string }) {
  return saveClip({ ...info, text, format: '', kind: 'text', source: 'listen' })
}

/** Add an audio file from the device. */
export async function importAudio(file: File): Promise<ClipMeta> {
  const duration = await new Promise<number>((resolve) => {
    const a = new Audio(); const u = URL.createObjectURL(file)
    const done = (d: number) => { URL.revokeObjectURL(u); resolve(isFinite(d) ? d : 0) }
    a.preload = 'metadata'; a.onloadedmetadata = () => done(a.duration); a.onerror = () => done(0); a.src = u
    setTimeout(() => done(a.duration), 6000)
  })
  const ext = (file.name.split('.').pop() ?? '').toLowerCase().slice(0, 5) || (file.type.split('/')[1] ?? 'audio')
  return saveClip({ title: file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Audio', text: '', voice: '', lang: '', duration, format: ext, blob: file, kind: 'audio', source: 'import' })
}

// Remember where each Library item was left, and mark it finished when it plays to the end.
let tracking = false
export function trackPlayback() {
  if (tracking) return
  tracking = true
  let lastSaved = 0, lastKey: string | null = null, wasPlaying = false
  clipPlayer.subscribe(() => {
    const p = clipPlayer.get()
    if (!p.key?.startsWith('clip:')) return
    const id = p.key.slice(5)
    const now = Date.now()
    const paused = wasPlaying && !p.playing
    if (p.key !== lastKey) { lastKey = p.key; lastSaved = 0; if (p.playing) void updateClip(id, { playedAt: now }, false) }
    wasPlaying = p.playing
    if ((p.playing && now - lastSaved > 5000) || paused) {
      lastSaved = now
      if (p.time > 1) void updateClip(id, { pos: p.time, playedAt: now }, false)
    }
  })
  onClipEnded((key) => { if (key?.startsWith('clip:')) void updateClip(key.slice(5), { done: true, pos: 0 }, false) })
}
