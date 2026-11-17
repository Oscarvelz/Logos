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
// oldest entries go first) — a cache, never a vault: a failed READ
// simply misses and the engine renders, exactly as before; a failed
// census no longer blocks SAVING (cure T1-18, below).
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

/** A 64-bit key over voice + spoken text (cure T1-11). The old key
 *  was a single 32-bit FNV-1a plus the string length, and collisions
 *  were NOT theoretical: the hunt's birthday search found two real
 *  chapter openings — "Chapter 48539 begins…" and "Chapter 165429
 *  begins…", same length — keying identically (r5d6d94ef-81), so the
 *  second was served the first one's audio, wrong chapter number
 *  and all. A swapped negation or number inside a long book is
 *  exactly the wrong sentence that is NOT "heard at once". The key
 *  is now two independent 32-bit hashes (cyrb64) carried as 64
 *  bits: a collision needs both to agree on the same length, which
 *  the birthday bound puts beyond any library this cache will hold.
 *  Changing the key orphans entries saved under the old one — they
 *  simply miss, re-render once, and age out through the sweep; a
 *  cache, never a vault. */
export function renderKey(spoken: string, voice: string, pauseMs = 0): string {
  // The pause is part of the key (cure T1-14). render() appends the
  // sentence pause to the samples BEFORE encoding and saving, so the
  // pause is baked into the cached audio — yet the old key carried
  // neither the Sentence Pause setting nor the segment's place, so
  // changing the setting never reached a cached sentence (it silently
  // half-applied, to never-rendered text only), and the same spoken
  // string mid-paragraph (pause ×0.4) and at a paragraph end (×2.2)
  // shared one entry and both places got whichever pause baked first.
  // The key now carries the exact pause that will be baked. Changing
  // the key orphans entries saved under the old one — they miss,
  // re-render once, and age out through the sweep (the T1-11
  // doctrine: a cache, never a vault).
  const s = voice + '\n' + spoken + '\n' + Math.round(pauseMs)
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 'r' + (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0') + '-' + s.length
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
export async function getPersistedRender(key: string): Promise<{ blob: Blob; env: Float32Array; duration: number; peak: number } | null> {
  const rec = await tx<Rec | undefined>('readonly', (st) => st.get(key) as IDBRequest<Rec | undefined>)
  if (!rec) return null
  const dec = await decodeWav(rec.blob)
  if (!dec || dec.samples.length === 0) return null
  // The samples' own peak, for the silence judgment (1.4.123): the
  // envelope is peak-NORMALIZED, so it cannot testify about loudness —
  // a whisper of noise wears a full-height envelope. Only the samples
  // tell the truth.
  let peak = 0
  for (let i = 0; i < dec.samples.length; i++) { const a = Math.abs(dec.samples[i]); if (a > peak) peak = a }
  // LRU touch, at most once a day per entry — a daily text must not be
  // evicted as "old" while one-off renders survive.
  if (Date.now() - rec.at > 24 * 3600 * 1000) {
    void tx('readwrite', (st) => st.put({ ...rec, at: Date.now() }))
  }
  return { blob: rec.blob, env: envelope(dec.samples, dec.sampleRate, 60), duration: dec.samples.length / dec.sampleRate, peak }
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

/**
 * The byte ledger, kept honest (cure T1-10). The old code trusted
 * one module-level counter and it diverged from the store in both
 * directions: an overwrite ADDED the new size without subtracting
 * the replaced record's, dropPersistedRender deleted without
 * touching the ledger at all (over-count — sweeps fired early and
 * evicted honest entries, re-creating the 1.4.112 re-render
 * complaint), and two overlapping sweeps could snapshot the same
 * record, both delete it and BOTH subtract its size (under-count —
 * the store grew past the cap while the ledger insisted it was at
 * the floor). The cap and the floor were accounting fiction.
 *
 * Now every ledger-changing operation — put, drop, sweep — runs
 * through ONE serialized chain, so no two ever interleave: a put
 * subtracts the size of the record it replaces, a drop subtracts
 * the size it removes, a sweep subtracts each victim exactly once
 * and then re-anchors the ledger to the store it actually left
 * behind (the sum of the survivors it just enumerated). The
 * ledger is the store, or it is re-derived from the store at the
 * next sweep. Round 3 (R3-T1-5) closed the chain's last intent-
 * based step: a delete is now believed only when it lands — a
 * failed delete subtracts nothing, in the sweep or in a drop, so
 * the ledger cannot under-count a store that kept the record.
 */
let ledgerChain: Promise<void> = Promise.resolve()
function enqueueLedger(fn: () => Promise<void>): Promise<void> {
  ledgerChain = ledgerChain.then(fn, fn)
  return ledgerChain
}

/** The ledger's current word on the store's size (-1 = not counted yet). */
export function renderCacheLedgerBytes(): number { return totalBytes }

/** True while the opening census is failing (cure T1-18): saves still
 *  land in that state — the witness exists so the failure is a known,
 *  probe-checkable fact, never a silent one. */
let censusFailed = false
export function renderCacheCensusFailed(): boolean { return censusFailed }
/** When the next census retry becomes due after a failure, so a
 *  broken store is not re-scanned in full on every sentence. */
let censusRetryAt = 0

/** Settles when every queued put/drop/sweep has landed (probes, tests). */
export function flushRenderCache(): Promise<void> { return ledgerChain }

/** Save a fresh render. Fire-and-forget by design: playback never waits
 *  on the disk. Over budget, the oldest entries are swept. */
export function putPersistedRender(key: string, blob: Blob): void {
  void enqueueLedger(async () => {
    const d = await db()
    if (!d) return
    if (totalBytes < 0 && Date.now() >= censusRetryAt) {
      totalBytes = await loadTotal(d)
      censusFailed = totalBytes < 0
      if (censusFailed) censusRetryAt = Date.now() + 30_000
    }
    // What this put replaces, so the ledger counts the store, not
    // the traffic: an overwritten sentence changes the total by
    // the difference, never by the whole new size again.
    const prev = await tx<Rec | undefined>('readonly', (st) => st.get(key) as IDBRequest<Rec | undefined>)
    const rec: Rec = { key, blob, at: Date.now(), size: blob.size }
    const ok = await tx('readwrite', (st) => st.put(rec))
    if (ok === null) return
    // A failed census no longer kills the save (cure T1-18). The old
    // code returned BEFORE this write whenever loadTotal errored, so
    // for as long as the error persisted — a locked or corrupted
    // store does not heal between sentences — the saved-processing
    // cache was silently dead while playback continued normally (the
    // 1.4.112 complaint, re-created inside the cache's own error
    // path), and every put paid a full cursor re-scan for the
    // privilege. Now the record lands regardless; only the BUDGET
    // waits for a census — while the ledger is unknown the sweep
    // cannot judge it honestly, so it stands down, the failure is
    // carried on renderCacheCensusFailed(), and the census retries
    // at most once per 30 s instead of once per sentence. When one
    // lands, loadTotal re-derives the whole truth from the store.
    if (totalBytes < 0) return
    totalBytes += blob.size - (prev?.size ?? 0)
    if (totalBytes <= BUDGET) return
    // Sweep oldest-first down to the soft floor.
    const all = await tx<Rec[]>('readonly', (st) => st.getAll() as IDBRequest<Rec[]>)
    if (!all) return
    all.sort((a, b) => a.at - b.at)
    const gone = new Set<string>()
    for (const r of all) {
      if (totalBytes <= SWEEP_TO) break
      // A delete is believed only when it LANDS (cure R3-T1-5):
      // the sweep used to subtract on intent, so one failed delete
      // — a locked or aborting store, the weather T1-18 describes —
      // left the record in the store while the ledger counted it
      // gone, and the re-anchor below inherited the lie. A failed
      // delete keeps its size in the ledger (and out of `gone`),
      // and the sweep moves on to the next victim: the cap is
      // enforced against what the store actually holds.
      const landed = await tx('readwrite', (st) => st.delete(r.key))
      if (landed === null) continue
      totalBytes -= r.size
      gone.add(r.key)
    }
    // Re-anchor: whatever the arithmetic believed, the ledger now
    // says exactly what the sweep's own census says remains.
    totalBytes = all.reduce((a, r) => a + (gone.has(r.key) ? 0 : r.size), 0)
  })
}

/** Remove a saved render. A poisoned entry — digital silence saved on a
 *  bad-engine night (1.4.122) — must not be served forever. */
export function dropPersistedRender(key: string): void {
  void enqueueLedger(async () => {
    const prev = totalBytes >= 0
      ? await tx<Rec | undefined>('readonly', (st) => st.get(key) as IDBRequest<Rec | undefined>)
      : undefined
    // The subtraction follows the delete, never precedes it (cure
    // R3-T1-5): a drop whose delete failed leaves the record in the
    // store, so its size stays in the ledger too.
    const landed = await tx('readwrite', (st) => st.delete(key) as IDBRequest<undefined>)
    if (prev && landed !== null) totalBytes -= prev.size
  })
}
