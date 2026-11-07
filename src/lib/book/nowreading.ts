// Which book the Listen text came from, so Listen and the book reader can hop to each other.
import type { Pos } from '../books.ts'

export type NowReading = { id: string; title: string; key: string; starts: number[]; pos: Pos[] }
const KEY = 'logos.nowReading'
const keyOf = (text: string) => `${text.length}:${text.slice(0, 120)}`

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
