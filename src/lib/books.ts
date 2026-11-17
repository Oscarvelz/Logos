// Books: imported EPUB, PDF, Word, FB2, text and web files, kept on this device
// (IndexedDB "logos-books": `books` holds what the shelf shows, `content` the text).
import { createStore } from './store.ts'
import { nowReadingFor, nowReadingId } from './book/nowreading.ts'
import { drafts } from './drafts.ts'

export type Kind = 'h1' | 'h2' | 'h3' | 'p' | 'q' | 'li' | 'pre'
/** A link inside a block: `to` is "ch:b" (a place in this book) or an http(s) address. */
export type Link = { s: number; e: number; to: string }
export type Block = { k: Kind; t: string; l?: Link[]; pg?: number }
export type Chapter = { title: string; blocks: Block[] }
export type TocEntry = { title: string; level: number; ch: number; b: number }
export type Pos = { ch: number; b: number }

export type BookMeta = {
  id: string
  title: string
  author: string
  format: string          // epub | pdf | docx | fb2 | txt | md | html | rtf
  lang: string
  addedAt: number
  openedAt?: number
  pos: Pos
  progress: number        // 0…1, by words
  words: number
  chWords: number[]       // words per chapter, for progress
  toc: TocEntry[]
  links: number           // working links inside the book
  cover?: Blob
  fav?: boolean
  done?: boolean
  /** Imported "for now": removed once another book holds the floor, unless kept. */
  temp?: boolean
  /** A warning shown at import time (e.g. a shared image that arrived cut off). */
  warn?: string
  size: number
  /** Content fingerprint set at import (M-6 cure): two imports whose text
      hashes equal are the same book, however the file was named. */
  hash?: string
  pages?: number
  bookmarks?: { ch: number; b: number; at: number; text: string }[]
}
export type BookContent = { id: string; chapters: Chapter[] }

const DB = 'logos-books'
let dbp: Promise<IDBDatabase> | null = null
function open(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2)
    // R2-T3-6 cure: a blocked upgrade used to hang this promise forever —
    // a leftover tab still holding the v1 database open wedges the v2
    // open, the memoised dbp never settled, and the shelf spun silently
    // (M-9's law: a database failure surfaces, never renders as silence
    // or as an empty library). The block is named on the store the shelf
    // already renders; when the other tab closes, the open lands and the
    // next refresh clears the word.
    req.onblocked = () => { books.set({ loaded: true, loadError: true }) }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('content')) db.createObjectStore('content', { keyPath: 'id' })
      // M-11 cure: a blob-free twin of the metas. refreshBooks used to
      // getAll() the whole `books` store on every mutation, dragging
      // every cover Blob into memory each time; the list now reads the
      // twin, and covers are fetched one at a time, on demand
      // (getBookCover). Backfilled here, inside the upgrade
      // transaction, from the metas already stored.
      if (!db.objectStoreNames.contains('bookmeta')) {
        const ms = db.createObjectStore('bookmeta', { keyPath: 'id' })
        const tx = req.transaction
        if (tx) {
          const all = tx.objectStore('books').getAll() as IDBRequest<BookMeta[]>
          all.onsuccess = () => { for (const m of all.result ?? []) ms.put(stripCover(m)) }
        }
      }
    }
    req.onsuccess = () => {
      const db = req.result
      // Close this connection when a newer version arrives, so this tab
      // is never the wedge for the next upgrade; the memo is dropped so
      // the next caller reopens at the new version.
      db.onversionchange = () => { try { db.close() } catch { /* already closed */ } dbp = null }
      resolve(db)
    }
    req.onerror = () => { dbp = null; reject(req.error) }
  })
  return dbp
}
async function run<T>(store: 'books' | 'content' | 'bookmeta', mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode)
    const req = fn(t.objectStore(store))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** ONE transaction spanning the book stores (H-16; the blob-free
    `bookmeta` twin joined the same transaction with the M-11 cure, so
    a meta and its twin can never part ways). putBook/deleteBook used to
    write `content` and `books` in two separate transactions: a quota error
    or crash between them orphaned the content — the large half of the book —
    forever, because no meta listed it and every sweep/delete iterates the
    `books` store. Inside a single transaction both writes land or neither
    does. The promise settles on the TRANSACTION's completion, not a single
    request's: it resolves only once every write the body issued has
    committed, and rejects when the transaction aborts (a failed request
    aborts the whole transaction, discarding its sibling write with it).
    The body must issue its requests synchronously, or from inside a
    request's own success callback, while the transaction is still active. */
async function runBoth(mode: IDBTransactionMode, start: (t: IDBTransaction, booksStore: IDBObjectStore, contentStore: IDBObjectStore, metaStore: IDBObjectStore) => void): Promise<void> {
  const db = await open()
  return new Promise<void>((resolve, reject) => {
    const t = db.transaction(['books', 'content', 'bookmeta'], mode)
    let settled = false
    const ok = () => { if (!settled) { settled = true; resolve() } }
    const fail = (e: unknown) => { if (!settled) { settled = true; reject(e instanceof Error ? e : new Error(String(e))) } }
    t.oncomplete = ok
    t.onabort = () => fail(t.error ?? new Error('Book transaction aborted'))
    t.onerror = () => { /* a request error aborts the transaction; onabort settles this promise */ }
    try { start(t, t.objectStore('books'), t.objectStore('content'), t.objectStore('bookmeta')) } catch (e) { try { t.abort() } catch { /* already settled */ } fail(e) }
  })
}

export type Importing = { name: string; step: string; done: number; total: number; batch?: string }
export const books = createStore<{ list: BookMeta[]; loaded: boolean; loadError: boolean; importing: Importing | null }>({ list: [], loaded: false, loadError: false, importing: null })

/** The meta as the list carries it: everything except the cover Blob
    (M-11). The full record, cover and all, stays in `books`; only the
    twin is stripped. */
export const stripCover = (m: BookMeta): BookMeta => {
  const { cover: _cover, ...rest } = m
  return rest
}

const coverCache = new Map<string, Blob | null>()
/** One book's cover, fetched on demand from the full record and
    remembered (null included: a coverless book is not re-asked on
    every tile mount). putBook/updateBook/deleteBook keep the cache
    honest. */
export async function getBookCover(id: string): Promise<Blob | null> {
  const hit = coverCache.get(id)
  if (hit !== undefined) return hit
  const meta = await getBook(id)
  const cover = meta?.cover ?? null
  coverCache.set(id, cover)
  return cover
}

export async function refreshBooks() {
  try {
    // M-11: the list reads the blob-free twin — a refresh after any
    // mutation no longer drags every cover Blob into memory.
    const list = await run<BookMeta[]>('bookmeta', 'readonly', (s) => s.getAll() as IDBRequest<BookMeta[]>)
    books.set({ list: list.sort((a, b) => (b.openedAt ?? b.addedAt) - (a.openedAt ?? a.addedAt)), loaded: true, loadError: false })
  } catch {
    // M-9 cure: a failed database read is NOT an empty library. The old
    // catch set loaded:true over an empty list, so a broken/blocked
    // database rendered as "Your bookshelf / Nothing saved yet" and
    // invited duplicate imports over data that was still there. The
    // failure is now carried on the store and the shelf says so.
    books.set({ loaded: true, loadError: true })
  }
}

/** `content` may be null ONLY for the Undo of a book whose content was
    already missing when it was deleted (see deleteBook): the meta goes
    back alone, restoring exactly the state that was there before. */
export async function putBook(meta: BookMeta, content: BookContent | null) {
  const clean = meta.bookmarks ? { ...meta, bookmarks: dedupeBookmarks(meta.bookmarks) } : meta
  await runBoth('readwrite', (_t, bs, cs, ms) => { if (content) cs.put(content); bs.put(clean); ms.put(stripCover(clean)) })
  coverCache.set(clean.id, clean.cover ?? null)
  try { await navigator.storage?.persist?.() } catch { /* optional */ }
  await refreshBooks()
}

/** One bookmark per place (M-12 cure): a bookmark's identity is its place
    in the book (chapter + block), never its timestamp — two marks of the
    same paragraph made moments apart (a double press on Mark in Listen,
    or the reader's door racing it) are ONE bookmark. Every write that
    carries a bookmark list passes through here — updateBook inside its
    queue turn, putBook on the way in — so no door can land a duplicate,
    however fast it fires: the queue serialises the writes and this
    collapses the second create onto the first's record. */
export function dedupeBookmarks(list: BookMeta['bookmarks']): BookMeta['bookmarks'] {
  if (!list) return list
  const seen = new Set<string>()
  return list.filter((m) => { const k = `${m.ch}:${m.b}`; if (seen.has(k)) return false; seen.add(k); return true })
}

/** The shelf's one search predicate (M-15 cure): the filter counts and
    the listed books both derive from it, so a count can never include a
    book the list excludes, or the reverse. */
export const bookMatchesQuery = (b: Pick<BookMeta, 'title' | 'author'>, q: string): boolean => {
  const n = q.trim().toLowerCase()
  return !n || `${b.title} ${b.author}`.toLowerCase().includes(n)
}

export const getBook = async (id: string) => (await run<BookMeta | undefined>('books', 'readonly', (s) => s.get(id) as IDBRequest<BookMeta | undefined>)) ?? null
export const getContent = async (id: string) => (await run<BookContent | undefined>('content', 'readonly', (s) => s.get(id) as IDBRequest<BookContent | undefined>)) ?? null

type BookPatch = Partial<Omit<BookMeta, 'id'>>
/** One writer at a time per book (1.4.108). updateBook used to be a bare
    read-modify-write: two writers holding different photos of the same
    record stomped each other — the reader's bookmark, written while the
    position saver re-saved its older photo, simply never landed (audit
    C-1), and a finished book's progress was re-derived back down (C-2).
    Now every write for a book queues behind the previous one and reads
    the record FRESH inside its turn; a patch may be a function of that
    fresh record, so no writer ever merges onto a stale photo. */
const bookWriteChains = new Map<string, Promise<unknown>>()
function enqueueBookWrite<T>(id: string, job: () => Promise<T>): Promise<T> {
  const prev = bookWriteChains.get(id) ?? Promise.resolve()
  const runJob = prev.then(job, job)
  bookWriteChains.set(id, runJob.then(() => undefined, () => undefined))
  return runJob
}

export function updateBook(id: string, patch: BookPatch | ((cur: BookMeta) => BookPatch), refresh = true): Promise<BookMeta | null> {
  return enqueueBookWrite(id, async () => {
    const cur = await getBook(id)
    if (!cur) return null
    const merged = { ...cur, ...(typeof patch === 'function' ? patch(cur) : patch) }
    const next = merged.bookmarks ? { ...merged, bookmarks: dedupeBookmarks(merged.bookmarks) } : merged
    await runBoth('readwrite', (_t, bs, _cs, ms) => { bs.put(next); ms.put(stripCover(next)) })
    coverCache.set(id, next.cover ?? null)
    if (refresh) await refreshBooks()
    else books.set((st) => ({ list: st.list.map((b) => (b.id === id ? stripCover(next) : b)) }))
    return next
  })
}

/** Delete a book — meta and content together, or not at all.
    Three cures meet here:
    · H-14: the delete runs INSIDE the per-book write queue, like every
      updateBook. It used to write directly, so a position save already in
      flight could read the record, watch the delete land, then put its
      photo back — resurrecting a meta-only phantom whose content was gone.
      Serialised, a save and a delete of the same book can only ever run
      one-after-the-other: the book ends fully present or fully gone.
    · The reader floor (Wave 1, H-1) is checked HERE, not only in the
      sweep: a delete of the book currently holding the reader floor, or
      the Listen position (nowReading), does not land while it is being
      read — checked when this delete's queue turn starts AND again at the
      last moment inside the transaction, so even a delete invoked in the
      very instant the book was opened refuses. That refusal is aimed at
      the sweep and at races. A DELIBERATE delete — the shelf menu's, with
      its confirmation and Undo — is a different posture and passes
      { force: true }; the sweep never does.
    · H-16: meta and content are read and deleted in ONE transaction
      spanning both stores (no orphaned content if the device dies
      mid-delete), and the deleted book comes back whenever the META
      existed — `content` is null when it was already missing — so the
      shelf can offer Undo for every book this actually deleted, instead
      of silently returning null for a book it did remove. */
export function deleteBook(id: string, opts?: { force?: boolean }): Promise<{ meta: BookMeta; content: BookContent | null } | null> {
  return enqueueBookWrite(id, async () => {
    const held = () => id === readerFloorId || id === nowReadingId()
    if (!opts?.force && held()) return null
    let meta: BookMeta | null = null
    let content: BookContent | null = null
    let refused = false
    await runBoth('readwrite', (_t, bs, cs, ms) => {
      const gm = bs.get(id) as IDBRequest<BookMeta | undefined>
      const gc = cs.get(id) as IDBRequest<BookContent | undefined>
      let pending = 2
      const got = () => {
        if (--pending > 0) return
        if (!opts?.force && held()) { refused = true; return } // floor taken while the reads were in flight: issue no deletes, the transaction commits empty
        if (meta) { bs.delete(id); cs.delete(id); ms.delete(id) }
        else if (content) { cs.delete(id); ms.delete(id) } // orphan content with no meta: clean it up; there is no book to hand back
      }
      gm.onsuccess = () => { meta = gm.result ?? null; got() }
      gc.onsuccess = () => { content = gc.result ?? null; got() }
    })
    const goneMeta = meta
    if (refused || !goneMeta) return null
    coverCache.delete(id)
    clearDeletedBookTraces(id)
    await refreshBooks()
    return { meta: goneMeta, content }
  })
}

/** M-10 cure: a deleted book leaves no ghost. Playing a book copied its
    whole text into the Listen draft and persisted a now-reading pointer
    (id, title, position map) in localStorage; deleteBook used to remove
    only the two IndexedDB records, so the deleted book's full text stayed
    playable in Listen, and nowReadingId() kept returning the dead id —
    every later sweep wasted one of its protection slots on the ghost and
    Listen's back-to-book card could offer a book that no longer exists.
    When the deleted book is the one those traces point at, they go with
    it: the pointer is removed, and a Listen draft that IS this book's
    text (matched by the pointer's own fingerprint) is cleared, in memory
    and in its persisted copy. A draft of anything else is untouched. */
function clearDeletedBookTraces(id: string): void {
  try {
    const raw = localStorage.getItem('logos.nowReading')
    if (!raw) return
    const nr = JSON.parse(raw) as { id?: string; key?: string } | null
    if (!nr || nr.id !== id) return
    // The draft match is resolved BEFORE the pointer is removed, and by
    // identity: nowReadingFor(draft) is the pointer's own resolution of
    // the draft text, with the T1-13 fingerprint inside it. The first
    // writing of this cure compared the stored key against a hand-built
    // `length:first120` string — a shape the T1-13 key no longer takes —
    // so the comparison could never be true and this leg was dead code.
    const draft = drafts.get().listen
    const draftIsBook = !!draft && nowReadingFor(draft)?.id === id
    localStorage.removeItem('logos.nowReading')
    if (draftIsBook) {
      drafts.set({ listen: '' })
      try { localStorage.removeItem('logos.lastText') } catch { /* ignore */ }
    }
  } catch { /* traces are best-effort; the book itself is already gone */ }
}

/** The book open in the reader right now — the reader floor. Opening a book
    to READ never sets nowReading (only Listen playback does), so without
    this the temp sweep below had no deterministic way to know which book
    was on screen: it guessed from `openedAt`, and the reader's own
    `openedAt` write had not always landed when the guess was made (H-1).
    BookPage claims the floor synchronously when its load effect starts
    (before any await, so a sweep fired by a parent effect or a concurrent
    caller afterwards already sees it) and releases it on unmount / id
    change. The sweep reads it both when it builds its keep-set and again
    live before each delete, so a book that takes the floor while a sweep
    is already working through its list is never that sweep's to remove. */
let readerFloorId: string | null = null
export function setReaderFloor(id: string): void { readerFloorId = id }
export function clearReaderFloor(id: string): void { if (readerFloorId === id) readerFloorId = null }

/** Temporary books — imported "for now" — are removed once another book holds
    the floor. The floor is the book at the play position (Listen), the book
    open in the reader (the reader floor, plus any id the caller protects
    explicitly), together with the book most recently opened; every other
    temporary book goes. Runs when the current book changes and when the
    app starts. */
export async function sweepTempBooks(protect?: string | readonly string[] | null): Promise<void> {
  if (!books.get().loaded) await refreshBooks()
  const list = books.get().list
  const keep = new Set<string>()
  const nr = nowReadingId(); if (nr) keep.add(nr)
  if (readerFloorId) keep.add(readerFloorId)
  if (typeof protect === 'string') { if (protect) keep.add(protect) }
  else if (protect) for (const pid of protect) if (pid) keep.add(pid)
  const current = [...list].sort((a, b) => (b.openedAt ?? b.addedAt) - (a.openedAt ?? a.addedAt))[0]
  if (current) keep.add(current.id)
  for (const b of list) {
    if (!b.temp || keep.has(b.id)) continue
    // Live re-check before this delete fires: the floor can move while the
    // sweep awaits an earlier delete — a book that has since been opened
    // in the reader, taken the Listen position, or become the most
    // recently opened (its awaited openedAt write landed in the in-memory
    // list) is no longer this sweep's to remove.
    if (b.id === readerFloorId) continue
    const nrLive = nowReadingId(); if (nrLive && b.id === nrLive) continue
    const currentLive = [...books.get().list].sort((a, b) => (b.openedAt ?? b.addedAt) - (a.openedAt ?? a.addedAt))[0]
    if (currentLive && b.id === currentLive.id) continue
    try { await deleteBook(b.id) } catch { /* already gone */ }
  }
}

/** Clamp a saved place into the book that actually exists (M-8 cure):
    chapter AND block. BookPage used to clamp only the chapter and copy
    `pos.b` verbatim, so a place written against a longer edition (a
    backup restore pairs any meta with any content, unchecked) pointed
    past the end of its chapter — progressAt capped the damage at 100%,
    the scroll goal found no element, and "Listen from here" started
    past the chapter's blocks, silently skipping it. Every door that
    lands a saved place in a book goes through here. */
export function clampPos(chapters: readonly { blocks: readonly unknown[] }[], p: Pos): Pos {
  if (!chapters.length) return { ch: 0, b: 0 }
  const ch = Math.max(0, Math.min(p.ch, chapters.length - 1))
  const b = Math.max(0, Math.min(p.b, Math.max(0, chapters[ch].blocks.length - 1)))
  return { ch, b }
}

/** The progress/done pair a save writes for a live progress (M-7 cure).
    `done` used to pin the stored progress at 1 forever: cross 98.5% once
    and every later save wrote progress:1 even while the reader walked
    back through chapter 1 — the shelf claimed Finished/100% while `pos`
    moved backwards. Now a book whose live progress falls well back
    under the finish line is being re-read: it un-finishes and its
    stored progress tells the truth again. Deliberate "Mark as finished"
    writes do not pass through here. */
export function progressPatch(cur: Pick<BookMeta, 'done'>, progress: number): { progress: number; done: boolean } {
  if (cur.done && progress < 0.9) return { progress, done: false }
  return { progress: cur.done ? 1 : progress, done: cur.done || progress > 0.985 }
}

export const wordsIn = (t: string) => (t.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu) ?? []).length

/** Share of the book read at a place, by words. */
export function progressAt(meta: Pick<BookMeta, 'chWords' | 'words'>, chapters: Chapter[] | null, p: Pos) {
  if (!meta.words) return 0
  let before = 0
  for (let i = 0; i < p.ch; i++) before += meta.chWords[i] ?? 0
  const ch = chapters?.[p.ch]
  if (ch) for (let i = 0; i < Math.min(p.b, ch.blocks.length); i++) before += wordsIn(ch.blocks[i].t)
  return Math.min(1, before / meta.words)
}

/** The place a share of the book (0..1) lands on, by words: the inverse of progressAt. */
export function posAtProgress(meta: Pick<BookMeta, 'chWords' | 'words'>, chapters: Chapter[], f: number): Pos {
  if (!meta.words || !chapters.length) return { ch: 0, b: 0 }
  let within = Math.max(0, Math.min(1, f)) * meta.words
  for (let c = 0; c < chapters.length; c++) {
    const cw = meta.chWords[c] ?? 0
    if (within > cw && c < chapters.length - 1) { within -= cw; continue }
    const ch = chapters[c]
    for (let b = 0; b < ch.blocks.length; b++) {
      const bw = wordsIn(ch.blocks[b].t)
      if (within <= bw || b === ch.blocks.length - 1) return { ch: c, b }
      within -= bw
    }
    return { ch: c, b: 0 }
  }
  return { ch: chapters.length - 1, b: 0 }
}
