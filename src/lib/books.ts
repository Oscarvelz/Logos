// Books: imported EPUB, PDF, Word, FB2, text and web files, kept on this device
// (IndexedDB "logos-books": `books` holds what the shelf shows, `content` the text).
import { createStore } from './store.ts'
import { nowReadingId } from './book/nowreading.ts'

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
  size: number
  pages?: number
  bookmarks?: { ch: number; b: number; at: number; text: string }[]
}
export type BookContent = { id: string; chapters: Chapter[] }

const DB = 'logos-books'
let dbp: Promise<IDBDatabase> | null = null
function open(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('content')) db.createObjectStore('content', { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => { dbp = null; reject(req.error) }
  })
  return dbp
}
async function run<T>(store: 'books' | 'content', mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode)
    const req = fn(t.objectStore(store))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export type Importing = { name: string; step: string; done: number; total: number; batch?: string }
export const books = createStore<{ list: BookMeta[]; loaded: boolean; importing: Importing | null }>({ list: [], loaded: false, importing: null })

export async function refreshBooks() {
  try {
    const list = await run<BookMeta[]>('books', 'readonly', (s) => s.getAll() as IDBRequest<BookMeta[]>)
    books.set({ list: list.sort((a, b) => (b.openedAt ?? b.addedAt) - (a.openedAt ?? a.addedAt)), loaded: true })
  } catch { books.set({ loaded: true }) }
}

export async function putBook(meta: BookMeta, content: BookContent) {
  await run('content', 'readwrite', (s) => s.put(content))
  await run('books', 'readwrite', (s) => s.put(meta))
  try { await navigator.storage?.persist?.() } catch { /* optional */ }
  await refreshBooks()
}

export const getBook = async (id: string) => (await run<BookMeta | undefined>('books', 'readonly', (s) => s.get(id) as IDBRequest<BookMeta | undefined>)) ?? null
export const getContent = async (id: string) => (await run<BookContent | undefined>('content', 'readonly', (s) => s.get(id) as IDBRequest<BookContent | undefined>)) ?? null

export async function updateBook(id: string, patch: Partial<Omit<BookMeta, 'id'>>, refresh = true) {
  const cur = await getBook(id)
  if (!cur) return
  const next = { ...cur, ...patch }
  await run('books', 'readwrite', (s) => s.put(next))
  if (refresh) await refreshBooks()
  else books.set((st) => ({ list: st.list.map((b) => (b.id === id ? next : b)) }))
}

export async function deleteBook(id: string): Promise<{ meta: BookMeta; content: BookContent } | null> {
  const meta = await getBook(id), content = await getContent(id)
  await run('books', 'readwrite', (s) => s.delete(id))
  await run('content', 'readwrite', (s) => s.delete(id))
  await refreshBooks()
  return meta && content ? { meta, content } : null
}

/** Temporary books — imported "for now" — are removed once another book holds
    the floor. The floor is the book at the play position (Listen) together with
    the book most recently opened; every other temporary book goes. Runs when
    the current book changes and when the app starts. */
export async function sweepTempBooks(): Promise<void> {
  if (!books.get().loaded) await refreshBooks()
  const list = books.get().list
  const keep = new Set<string>()
  const nr = nowReadingId(); if (nr) keep.add(nr)
  const current = [...list].sort((a, b) => (b.openedAt ?? b.addedAt) - (a.openedAt ?? a.addedAt))[0]
  if (current) keep.add(current.id)
  for (const b of list) if (b.temp && !keep.has(b.id)) { try { await deleteBook(b.id) } catch { /* already gone */ } }
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
