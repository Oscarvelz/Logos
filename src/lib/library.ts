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
const META_STORE = 'clipmeta'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2)
    // R2-T3-6 cure: a blocked upgrade used to hang this promise forever —
    // an older Logos tab still holding the v1 database open wedges the v2
    // open, and the library sat on its spinner with no word (M-9's law:
    // a database failure surfaces as a failure, never as silence). The
    // block is now named on the store the Library page already renders,
    // and every connection this page opens closes itself when a newer
    // version arrives, so this tab can never be the wedge for the next
    // upgrade.
    req.onblocked = () => { library.set({ loaded: true, loadError: true }) }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('createdAt', 'createdAt')
      // M-11 cure: a meta-only twin store. refreshLibrary used to getAll()
      // the clips store — materialising every audio Blob in the database —
      // and then throw the blobs away, after EVERY mutation; a star tap on
      // a phone with a large saved-audio library paid a full blob-loaded
      // read. Metas now live blob-free in `clipmeta`, every write keeps
      // the twin in step in the same transaction, and refresh reads only
      // the twin. The clips store is touched only when a blob is actually
      // wanted (play, download, share, undo).
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => {
      const db = req.result
      db.onversionchange = () => { try { db.close() } catch { /* already closed */ } }
      resolve(db)
    }
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>, store: string = STORE): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode)
    const req = fn(t.objectStore(store))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

const metaOf = (clip: Clip): ClipMeta => { const { blob: _b, ...m } = clip; void _b; return m }

/** Write/delete a clip in BOTH stores inside one transaction, so the meta
    twin can never drift from the record it describes. The promise settles
    on the transaction's completion/abort, like books' runBoth. */
async function txBoth(start: (clips: IDBObjectStore, metas: IDBObjectStore) => void): Promise<void> {
  const db = await open()
  return new Promise<void>((resolve, reject) => {
    const t = db.transaction([STORE, META_STORE], 'readwrite')
    let settled = false
    const ok = () => { if (!settled) { settled = true; resolve() } }
    const fail = (e: unknown) => { if (!settled) { settled = true; reject(e instanceof Error ? e : new Error(String(e))) } }
    t.oncomplete = ok
    t.onabort = () => fail(t.error ?? new Error('Clip transaction aborted'))
    t.onerror = () => { /* a request error aborts the transaction; onabort settles this promise */ }
    try { start(t.objectStore(STORE), t.objectStore(META_STORE)) } catch (e) { try { t.abort() } catch { /* already settled */ } fail(e) }
  })
}

const putFull = (clip: Clip) => txBoth((cs, ms) => { cs.put(clip); ms.put(metaOf(clip)) })
const deleteBoth = (id: string) => txBoth((cs, ms) => { cs.delete(id); ms.delete(id) })

/** The twin meta alone (blob-free), and a twin-only write. R2-T3-2:
    position/flag patches travel this path — see updateClip. */
const getClipMeta = async (id: string): Promise<ClipMeta | null> =>
  (await tx<ClipMeta | undefined>('readonly', (s) => s.get(id) as IDBRequest<ClipMeta | undefined>, META_STORE)) ?? null
const putMetaOnly = async (meta: ClipMeta): Promise<void> => {
  await tx('readwrite', (s) => s.put(meta) as IDBRequest<IDBValidKey>, META_STORE)
}

export const library = createStore<{ clips: ClipMeta[]; loaded: boolean; loadError: boolean }>({ clips: [], loaded: false, loadError: false })

export async function refreshLibrary() {
  try {
    let clips = await tx<ClipMeta[]>('readonly', (s) => s.getAll() as IDBRequest<ClipMeta[]>, META_STORE)
    if (!clips.length) {
      // First refresh after the twin store was created (or a library whose
      // writes predate it): backfill ONCE from the full records, then
      // never read a blob for a refresh again.
      const full = await tx<Clip[]>('readonly', (s) => s.getAll() as IDBRequest<Clip[]>)
      if (full.length) {
        await txBoth((_cs, ms) => { for (const c of full) ms.put(metaOf(c)) })
        clips = full.map(metaOf)
      }
    }
    library.set({ clips: clips.sort((a, b) => b.createdAt - a.createdAt), loaded: true, loadError: false })
  } catch {
    // M-9 cure: a failed read is not an empty library (see books.ts).
    library.set({ loaded: true, loadError: true })
  }
}

export const kindOf = (c: Pick<Clip, 'kind'>) => c.kind ?? 'audio'

export async function saveClip(clip: Omit<Clip, 'id' | 'createdAt' | 'size'> & { id?: string; createdAt?: number }): Promise<ClipMeta> {
  const full: Clip = { ...clip, id: clip.id ?? crypto.randomUUID?.() ?? String(Date.now()), createdAt: clip.createdAt ?? Date.now(), size: clip.blob?.size ?? 0 }
  // R2-T3-1: a save under an explicit id (the exporter's re-render of an
  // existing clip) is a write like any other — it queues behind the
  // clip's pending writes instead of racing them.
  await enqueueClipWrite(full.id, () => putFull(full))
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
  const full = (await tx<Clip | undefined>('readonly', (s) => s.get(id) as IDBRequest<Clip | undefined>)) ?? null
  if (!full) return null
  // R2-T3-2's merge law: position/flag patches write the twin only (see
  // updateClip), so the full record's own meta fields may lag behind it.
  // Every full-record reader comes through here, and the twin — the
  // fresher witness — is laid over the record it describes; the blob is
  // the record's own and is never in the twin.
  const meta = await getClipMeta(id)
  return meta ? { ...full, ...meta } : full
}

export async function deleteClip(id: string) {
  // R2-T3-1: the delete queues like every other write for this clip —
  // it used to write directly, so a tracker tick already in flight
  // (updateClip reads, the delete lands, the tick puts its photo back)
  // resurrected the clip the user had just deleted, Undo toast and all.
  await enqueueClipWrite(id, async () => {
    await deleteBoth(id)
    await refreshLibrary()
  })
}

export async function restoreClip(clip: Clip) {
  await enqueueClipWrite(clip.id, async () => {
    await putFull(clip)
    await refreshLibrary()
  })
}

type ClipPatch = Partial<Omit<Clip, 'id'>>
/** One writer at a time per clip — the queue books got in 1.4.108, which
    clips never did (H-15). updateClip used to be a bare read-modify-write,
    while trackPlayback fires it every 5 s during playback, on every pause
    and at clip end: a star, done flag or rename landing between the
    tracker's read and its write was silently reverted by the tracker's
    older photo, and a position could regress the same way. Now every
    write for a clip queues behind the previous one and reads the record
    FRESH inside its turn; a patch may be a function of that fresh record,
    so no writer ever merges onto a stale photo.
    R2-T3-1: the queue now carries EVERY clip writer — deleteClip,
    deleteClips, restoreClip(s) and an explicit-id saveClip used to write
    directly beside it, and the tracker's in-flight tick could put back a
    record a delete had just removed (the H-14 disease, one door over).
    Serialised, a tick and a delete of the same clip can only ever run
    one-after-the-other: the clip ends fully present or fully gone, and
    Undo's restore queues behind both. */
const clipWriteChains = new Map<string, Promise<unknown>>()
function enqueueClipWrite<T>(id: string, job: () => Promise<T>): Promise<T> {
  const prev = clipWriteChains.get(id) ?? Promise.resolve()
  const runJob = prev.then(job, job)
  clipWriteChains.set(id, runJob.then(() => undefined, () => undefined))
  return runJob
}

/** Change an item's details (title, favourite, finished, position…) without touching its audio. */
export function updateClip(id: string, patch: ClipPatch | ((cur: Clip) => ClipPatch), refresh = true): Promise<void> {
  return enqueueClipWrite(id, async () => {
    // R2-T3-2: a patch that does not itself carry a new blob never
    // touches the audio. The fresh record it merges onto is the
    // blob-free twin, the write is the twin alone, and getClip lays the
    // twin over the full record for any reader who needs the blob — so
    // the 5-second tracker tick and every star tap move O(meta) bytes
    // instead of reading and rewriting a whole recording. (M-11 cured
    // this on the refresh read; the write path kept paying it.) A patch
    // carrying a blob is a deed that changes the audio and takes the
    // full-record path, as does a function patch that hands one back.
    // A function patch receives the twin as its fresh record — Clip's
    // blob is optional, and a text clip's record looks exactly so.
    const carriesBlob = (p: ClipPatch) => 'blob' in p && p.blob !== undefined
    if (typeof patch !== 'function' && carriesBlob(patch)) return writeFull(id, patch, refresh)
    let base = await getClipMeta(id)
    if (!base) {
      const full = await getClip(id)
      if (!full) return
      base = metaOf(full)
    }
    const p = typeof patch === 'function' ? patch(base) : patch
    if (carriesBlob(p)) return writeFull(id, p, refresh)
    const { blob: _b, ...metaPatch } = p
    void _b
    const next: ClipMeta = { ...base, ...metaPatch }
    await putMetaOnly(next)
    if (refresh) await refreshLibrary()
    else library.set((st) => ({ clips: st.clips.map((c) => (c.id === id ? next : c)) }))
  })
}

/** The full-record write, for patches that change the audio itself. */
async function writeFull(id: string, p: ClipPatch, refresh: boolean): Promise<void> {
  const cur = await getClip(id)
  if (!cur) return
  await putFull({ ...cur, ...p, size: p.blob ? p.blob.size : cur.size })
  if (refresh) await refreshLibrary()
  else library.set((st) => ({ clips: st.clips.map((c) => (c.id === id ? { ...c, ...p, blob: undefined } as ClipMeta : c)) }))
}

export async function deleteClips(ids: string[]): Promise<Clip[]> {
  const gone: Clip[] = []
  for (const id of ids) {
    await enqueueClipWrite(id, async () => {
      const c = await getClip(id)
      if (c) gone.push(c)
      await deleteBoth(id)
    })
  }
  await refreshLibrary()
  return gone
}

export async function restoreClips(clips: Clip[]) {
  for (const c of clips) await enqueueClipWrite(c.id, () => putFull(c))
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
