// The saved processing (1.4.112): a rendered sentence's WAV is kept in
// IndexedDB, keyed by WHAT was spoken and WHICH voice spoke it — so
// stopping the audio, closing the bubble, even the page being reloaded
// or discarded by the system, never makes the engine process the same
// sentence twice. Oscar: "It's not saving the processing, and it has to
// restart again every single time I open the bubble." Now it saves it.
//
// The key is content, not position: the same sentence in another book,
// or the same book reopened next week, hits the same entry. A voice
// change or a pronunciation-dictionary edit changes the spoken string
// or the voice, and correctly misses. Storage is capped (~60 MB, the
// oldest entries go first) — a cache, never a vault: every failure here
// is silent and the engine simply renders, exactly as before.
import { envelope } from '../lib/audio.ts'

const DB_NAME = 'logos-renders'
const STORE = 'renders'
const BUDGET = 60 * 1024 * 1024
const SWEEP_TO = 48 * 1024 * 1024

type Rec = { key: string; blob: Blob; at: number; size: number }

let dbP: Promise<IDBDatabase | null> | null = null
function db(): Promise<IDBDatabase | null> {
  if (!dbP) {
    dbP = new Promise((res) => {
      try {
        const rq = indexedDB.open(DB_NAME, 1)
        rq.onupgradeneeded = () => {
          const d = rq.result
          if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'key' })
        }
        rq.onsuccess = () => res(rq.result)
        rq.onerror = () => res(null)
      } catch { res(null) }
    })
  }
  return dbP
}

function tx<T>(mode: IDBTransactionMode, run: (st: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return db().then((d) => new Promise<T | null>((res) => {
    if (!d) return res(null)
    try {
      const t = d.transaction(STORE, mode)
      const rq = run(t.objectStore(STORE))
      rq.onsuccess = () => res(rq.result)
      rq.onerror = () => res(null)
      t.onerror = () => res(null)
    } catch { res(null) }
  }))
}

/** FNV-1a over voice + spoken text — small, stable, collision-shy enough
 *  for a cache key (a collision costs one wrong sentence, heard at once,
 *  and the entry is keyed by the full string's hash only — accepted). */
export function renderKey(spoken: string, voice: string): string {
  let h = 0x811c9dc5
  const s = voice + '\n' + spoken
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return 'r' + (h >>> 0).toString(16) + '-' + s.length
}

/** Decode one of the app's own WAV blobs (16-bit PCM mono, 44-byte
 *  header) back to samples — no AudioContext, so no gesture or
 *  visibility rules apply to a cache hit. */
export async function decodeWav(blob: Blob): Promise<{ samples: Float32Array; sampleRate: number } | null> {
  try {
    const buf = await blob.arrayBuffer()
    if (buf.byteLength < 44) return null
    const v = new DataView(buf)
    const sampleRate = v.getUint32(24, true)
    // Find the data chunk (44 in every blob the app writes; scanned so a
    // future header change degrades to a miss, never to garbage audio).
    let off = 12
    let dataOff = -1
    let dataLen = 0
    while (off + 8 <= buf.byteLength) {
      const id = String.fromCharCode(v.getUint8(off), v.getUint8(off + 1), v.getUint8(off + 2), v.getUint8(off + 3))
      const len = v.getUint32(off + 4, true)
      if (id === 'data') { dataOff = off + 8; dataLen = len; break }
      off += 8 + len
    }
    if (dataOff < 0) return null
    const n = Math.min(dataLen, buf.byteLength - dataOff) >> 1
    const samples = new Float32Array(n)
    for (let i = 0; i < n; i++) samples[i] = v.getInt16(dataOff + i * 2, true) / 32768
    return { samples, sampleRate }
  } catch { return null }
}

/** Whether a render is saved under this key (prepare's cache-only path). */
export async function hasPersistedRender(key: string): Promise<boolean> {
  const rec = await tx<Rec | undefined>('readonly', (st) => st.get(key) as IDBRequest<Rec | undefined>)
  return !!rec
}

/** A saved render, rebuilt into the player's shape. */
export async function getPersistedRender(key: string): Promise<{ blob: Blob; env: Float32Array; duration: number } | null> {
  const rec = await tx<Rec | undefined>('readonly', (st) => st.get(key) as IDBRequest<Rec | undefined>)
  if (!rec) return null
  const dec = await decodeWav(rec.blob)
  if (!dec || dec.samples.length === 0) return null
  // LRU touch, at most once a day per entry — a daily text must not be
  // evicted as "old" while one-off renders survive.
  if (Date.now() - rec.at > 24 * 3600 * 1000) {
    void tx('readwrite', (st) => st.put({ ...rec, at: Date.now() }))
  }
  return { blob: rec.blob, env: envelope(dec.samples, dec.sampleRate, 60), duration: dec.samples.length / dec.sampleRate }
}

let totalBytes = -1
async function loadTotal(d: IDBDatabase): Promise<number> {
  return new Promise((res) => {
    try {
      let sum = 0
      const rq = d.transaction(STORE, 'readonly').objectStore(STORE).openCursor()
      rq.onsuccess = () => {
        const cur = rq.result
        if (cur) { sum += (cur.value as Rec).size; cur.continue() }
        else res(sum)
      }
      rq.onerror = () => res(-1)
    } catch { res(-1) }
  })
}

/** Save a fresh render. Fire-and-forget by design: playback never waits
 *  on the disk. Over budget, the oldest entries are swept. */
export function putPersistedRender(key: string, blob: Blob): void {
  void (async () => {
    const d = await db()
    if (!d) return
    if (totalBytes < 0) totalBytes = await loadTotal(d)
    if (totalBytes < 0) return
    const rec: Rec = { key, blob, at: Date.now(), size: blob.size }
    const ok = await tx('readwrite', (st) => st.put(rec))
    if (ok === null) return
    totalBytes += blob.size
    if (totalBytes <= BUDGET) return
    // Sweep oldest-first down to the soft floor.
    const all = await tx<Rec[]>('readonly', (st) => st.getAll() as IDBRequest<Rec[]>)
    if (!all) return
    all.sort((a, b) => a.at - b.at)
    for (const r of all) {
      if (totalBytes <= SWEEP_TO) break
      await tx('readwrite', (st) => st.delete(r.key))
      totalBytes -= r.size
    }
  })()
}
