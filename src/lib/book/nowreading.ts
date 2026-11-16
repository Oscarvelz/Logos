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

/** Remember that `paras` (joined by blank lines) are the book's blocks at `pos`. */
export function setNowReading(id: string, title: string, paras: string[], pos: Pos[]) {
  const starts: number[] = []
  let o = 0
  for (const p of paras) { starts.push(o); o += p.length + 2 }
  try { localStorage.setItem(KEY, JSON.stringify({ id, title, key: keyOf(paras.join('\n\n')), starts, pos })) } catch { /* full */ }
}

/** The id of the book at the play position, whatever text is loaded now. */
export function nowReadingId(): string | null {
  try { return (JSON.parse(localStorage.getItem(KEY) ?? 'null') as NowReading | null)?.id ?? null } catch { return null }
}

/** The book behind this Listen text, if it came from one. */
export function nowReadingFor(text: string): NowReading | null {
  try {
    const n = JSON.parse(localStorage.getItem(KEY) ?? 'null') as NowReading | null
    return n && n.key === keyOf(text) ? n : null
  } catch { return null }
}

/** Book position of a character offset in the Listen text. */
export function posAt(n: NowReading, offset: number): Pos {
  let i = 0
  while (i + 1 < n.starts.length && n.starts[i + 1] <= offset) i++
  return n.pos[i] ?? n.pos[0]
}
