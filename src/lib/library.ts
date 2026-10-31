// Saved clips in IndexedDB.
import { createStore } from './store.ts'

export type Clip = {
  id: string
  title: string
  text: string
  voice: string
  lang: string
  createdAt: number
  duration: number
  format: 'mp3' | 'wav'
  size: number
  blob: Blob
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

export async function saveClip(clip: Omit<Clip, 'id' | 'createdAt' | 'size'>): Promise<ClipMeta> {
  const full: Clip = { ...clip, id: crypto.randomUUID?.() ?? String(Date.now()), createdAt: Date.now(), size: clip.blob.size }
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
