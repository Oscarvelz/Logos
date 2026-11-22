import { createStore } from './store.ts'
import { textKey } from './marks.ts'

/**
 * The copy queue (Oscar, 1.4.198). With the queue mode on, a copied
 * text no longer replaces what is playing — it lines up behind it,
 * and the line plays through like a playlist, one text after the
 * next. This module is only the record: the items, which one holds
 * the stage, and the memory of a current item removed mid-play.
 * Every deed — playing, advancing, saving — lives in bubble.ts,
 * which wires this record to the session, the panel and the Library.
 *
 * The record persists across nights (localStorage); turning the
 * mode off erases it whole — that erasure is the mode's own law,
 * judged in bubble.ts where the settings change is seen.
 */
/**
 * What stands in the line (1.4.229): a copied text carries its own
 * words; a book or a recording carries only its name in the
 * Library (`ref`) and is fetched when its turn comes — if it has
 * been deleted by then, the line steps over it. A book item's
 * `key` begins as its shelf identity and is re-noted with the
 * staged text's key when it takes the stage, so the finish judge
 * recognises it like any reading; a recording's key is its player
 * key (`clip:<id>`), which is what the clip-end judge hears.
 */
export type QueueKind = 'copy' | 'book' | 'audio'
export type QueueItem = { id: string; text: string; key: string; title: string; secs: number; at: number; kind: QueueKind; ref: string }
export type QueueState = { items: QueueItem[]; currentId: string | null; orphanKey: string }

const KEY = 'logos.queue.v1'
let seq = 0
const newId = () => `q${Date.now().toString(36)}${(seq++).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`

function load(): QueueState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as QueueState | null
    if (raw && Array.isArray(raw.items)) {
      const items = raw.items.filter((i) => {
        if (!i) return false
        const kind = i.kind === 'book' || i.kind === 'audio' ? i.kind : 'copy'
        return kind === 'copy' ? (typeof i.text === 'string' && !!i.text.trim()) : typeof i.ref === 'string' && !!i.ref
      }).map((i) => {
        const kind: QueueKind = i.kind === 'book' || i.kind === 'audio' ? i.kind : 'copy'
        return {
          id: String(i.id || newId()), text: typeof i.text === 'string' ? i.text : '', key: String(i.key || (kind === 'copy' ? textKey(i.text ?? '') : `${kind}:${i.ref}`)), title: String(i.title || ''), secs: Number(i.secs) || 0, at: Number(i.at) || 0, kind, ref: String(i.ref || ''),
        }
      })
      const currentId = items.some((i) => i.id === raw.currentId) ? raw.currentId : null
      return { items, currentId, orphanKey: typeof raw.orphanKey === 'string' ? raw.orphanKey : '' }
    }
  } catch { /* a broken record is no record */ }
  return { items: [], currentId: null, orphanKey: '' }
}

export const queue = createStore<QueueState>(load())

function persist() {
  try {
    const s = queue.get()
    if (!s.items.length && !s.currentId) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify(s))
  } catch { /* the record lives in memory when storage refuses */ }
}
queue.subscribe(persist)

export const queueItems = () => queue.get().items
export const currentItem = () => queue.get().items.find((i) => i.id === queue.get().currentId) ?? null
export const currentIndex = () => { const s = queue.get(); return s.items.findIndex((i) => i.id === s.currentId) }

/**
 * Line a text up. The same text twice in a row is one entry, never
 * two (Oscar): the copy is judged against the line's tail — the
 * current item when the line is otherwise empty, else the last item.
 * Returns the item, or null when the copy was already the tail.
 */
export function enqueue(text: string, title: string, secs: number): QueueItem | null {
  const key = textKey(text)
  const s = queue.get()
  const tail = s.items.length ? s.items[s.items.length - 1] : null
  if (tail && tail.key === key) return null
  if (!tail) { const cur = currentItem(); if (cur && cur.key === key) return null }
  const item: QueueItem = { id: newId(), text, key, title, secs, at: Date.now(), kind: 'copy', ref: '' }
  queue.set({ items: [...s.items, item] })
  return item
}

/**
 * Put a text at the FRONT of the line (Oscar, 1.4.206): the hand
 * paste's second deed while the mode is on. A text already in the
 * line moves to the head — it is one entry, never two; a new text
 * takes the head seat. Who plays it, and whose seat it takes on
 * stage, is bubble.ts' judgment, not the record's.
 */
export function enqueueFront(text: string, title: string, secs: number): QueueItem {
  const key = textKey(text)
  const s = queue.get()
  const existing = s.items.find((i) => i.key === key)
  if (existing) {
    if (s.items[0]?.id !== existing.id) {
      queue.set({ items: [existing, ...s.items.filter((i) => i.id !== existing.id)] })
    }
    return existing
  }
  const item: QueueItem = { id: newId(), text, key, title, secs, at: Date.now(), kind: 'copy', ref: '' }
  queue.set({ items: [item, ...s.items] })
  return item
}

/**
 * Line up a Library resident — a book or a recording (Oscar,
 * 1.4.229). The same resident twice in a row is one entry, never
 * two: judged by kind + ref against the line's tail, the same law
 * the copies live under. Returns the item, or null when it was
 * already the tail.
 */
export function enqueueRef(kind: 'book' | 'audio', ref: string, title: string, secs: number, key: string): QueueItem | null {
  const s = queue.get()
  const tail = s.items.length ? s.items[s.items.length - 1] : null
  if (tail && tail.kind === kind && tail.ref === ref) return null
  if (!tail) { const cur = currentItem(); if (cur && cur.kind === kind && cur.ref === ref) return null }
  const item: QueueItem = { id: newId(), text: '', key, title, secs, at: Date.now(), kind, ref }
  queue.set({ items: [...s.items, item] })
  return item
}

/**
 * Re-note an item's key once its deed is known — a book's key is
 * its shelf identity until the staged text exists; from then on
 * the finish judge must recognise the item by the text it loaded.
 */
export function noteStagedKey(id: string, key: string) {
  const s = queue.get()
  if (!s.items.some((i) => i.id === id && i.key !== key)) return
  queue.set({ items: s.items.map((i) => (i.id === id ? { ...i, key } : i)) })
}

export function setCurrent(id: string | null) {
  queue.set({ currentId: id, orphanKey: '' })
}

/**
 * Take an item out of the line. Removing the one on stage does not
 * stop the sound — its text is already loaded — but the stage's
 * memory moves to the item that followed it, and the removed
 * item's key is kept as the orphan: when the sound ends, the
 * finish judge recognises the orphan and steps to the successor.
 */
export function removeItem(id: string) {
  const s = queue.get()
  const idx = s.items.findIndex((i) => i.id === id)
  if (idx < 0) return
  const items = s.items.filter((i) => i.id !== id)
  if (s.currentId === id) {
    const successor = items[idx] ?? null
    queue.set({ items, currentId: successor ? successor.id : null, orphanKey: s.items[idx].key })
  } else {
    queue.set({ items })
  }
}

export function clearQueue() {
  queue.set({ items: [], currentId: null, orphanKey: '' })
}
