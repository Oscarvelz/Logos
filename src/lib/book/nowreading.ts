// Which book the Listen text came from, so Listen and the book reader can hop to each other.
import type { Pos } from '../books.ts'

export type NowReading = { id: string; title: string; key: string; starts: number[]; pos: Pos[] }
const KEY = 'logos.nowReading'
/** A 64-bit fingerprint over the WHOLE text (cure T1-13). The old key
 *  was length + the first 120 chars, so any pasted text of the same
 *  length opening with the book's first 120 chars was treated as the
 *  book itself — SKIP, book seat and all. The key is now two
 *  independent 32-bit hashes (cyrb64, the renderKey pattern from
 *  rendercache.ts) carried as 64 bits over every character: a
 *  collision needs both hashes to agree on the same length. Changing
 *  the key orphans the one stored record — it simply stops matching
 *  until the book is opened again and re-stamps it; a pointer, never
 *  a vault. */
const keyOf = (text: string) => {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 'b' + (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0') + '-' + text.length
}

/** The in-memory mirror (cure R2-T1-3). T1-13 cured the fingerprint;
 *  its reverse half stood open: the stamp's write is swallowed when
 *  storage is full (this app parks whole texts in localStorage, so
 *  quota is a real weather), and with no mirror the record simply did
 *  not exist — a genuine book published book='' for the whole session:
 *  no SKIP, no book title on the card, no Back-to-book, no mark filing.
 *  The record is one small pointer, so the session keeps its own copy.
 *  `mirrorDurable` remembers whether the mirror's write LANDED: while
 *  it did, storage stays authoritative — a later absence is a
 *  deliberate removal (deleteBook's trace purge) and retires the
 *  mirror with it. While it did not, absence is the failure itself
 *  and the mirror rules. */
let mirror: NowReading | null = null
let mirrorDurable = false

function readRecord(): NowReading | null {
  // A mirror whose write never landed is the freshest truth there is:
  // whatever storage holds is older than it.
  if (mirror && !mirrorDurable) return mirror
  let stored: NowReading | null = null
  let readable = true
  try { stored = JSON.parse(localStorage.getItem(KEY) ?? 'null') as NowReading | null } catch { readable = false }
  if (stored) { mirror = stored; mirrorDurable = true; return stored }
  if (readable && mirrorDurable) mirror = null // landed once, gone now: removed on purpose
  return mirror
}

/** Remember that `paras` (joined by blank lines) are the book's blocks at `pos`. */
export function setNowReading(id: string, title: string, paras: string[], pos: Pos[]) {
  const starts: number[] = []
  let o = 0
  for (const p of paras) { starts.push(o); o += p.length + 2 }
  const rec: NowReading = { id, title, key: keyOf(paras.join('\n\n')), starts, pos }
  mirror = rec
  try { localStorage.setItem(KEY, JSON.stringify(rec)); mirrorDurable = true } catch { mirrorDurable = false /* full — the mirror above carries the session */ }
}

/** The id of the book at the play position, whatever text is loaded now. */
export function nowReadingId(): string | null {
  return readRecord()?.id ?? null
}

/** The book behind this Listen text, if it came from one. */
export function nowReadingFor(text: string): NowReading | null {
  const key = keyOf(text)
  const n = readRecord()
  if (n && n.key === key) return n
  // The non-durable mirror shadows storage for the SESSION's book
  // (cure R2-T1-3) — the right law for "what is being read now",
  // but this door answers a different question: "whose text is
  // THIS?" A text the mirror does not name may still belong to the
  // book the durable record names — an older stamp, yet the only
  // witness for that text. Judged by the mirror alone, the delete
  // purge (books.ts clearDeletedBookTraces) spared a deleted
  // book's draft whole: its pointer leg read storage directly and
  // named the book, its draft leg asked here and — the mirror
  // standing for a newer book whose stamp never landed — heard
  // nothing, so the pointer was removed and the text stayed,
  // playable, in the Listen box (cure R4-T1-3). When the first
  // witness does not name the text, ask storage directly before
  // answering that no book stands behind it.
  if (mirror && !mirrorDurable) {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null') as NowReading | null
      if (stored && stored.key === key) return stored
    } catch { /* unreadable — the first witness stands */ }
  }
  return null
}

/** Book position of a character offset in the Listen text. */
export function posAt(n: NowReading, offset: number): Pos {
  let i = 0
  while (i + 1 < n.starts.length && n.starts[i + 1] <= offset) i++
  return n.pos[i] ?? n.pos[0]
}
