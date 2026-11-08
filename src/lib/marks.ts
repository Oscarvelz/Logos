// Marks — "keep this moment" while listening (Oscar's ask, 2026-11-08).
// A mark made inside a BOOK joins the book's own bookmark list (the reader's
// system: one list, two doors). A mark made on loose text (a draft, a pasted
// page, a bubble clip) lives here, tied to the draft it was made in.
import { listen, loadText, play, seek } from '../player/listen.ts'
import { drafts } from './drafts.ts'
import { describeText } from './describe.ts'
import { detectLang } from './text.ts'
import { getBook, updateBook } from './books.ts'
import { nowReadingFor, posAt } from './book/nowreading.ts'
import { playBook } from './book/playbook.ts'
import { toast } from '../components/ui.tsx'

export type LooseMark = {
  id: string
  at: number
  title: string
  sentence: string
  /** fingerprint of the draft text the moment lives in */
  key: string
  idx: number
}

const KEY = 'logos.marks.v1'
export const textKey = (t: string) => `${t.length}:${t.slice(0, 48)}:${t.slice(-48)}`

export function loadMarks(): LooseMark[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as LooseMark[] } catch { return [] }
}
function saveMarks(list: LooseMark[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 120))) } catch { /* full */ }
}
export function addLooseMark(m: LooseMark) { saveMarks([m, ...loadMarks()]) }
export function removeLooseMark(id: string) { saveMarks(loadMarks().filter((m) => m.id !== id)) }
export function mergeMarks(incoming: LooseMark[]) {
  const have = new Set(loadMarks().map((m) => m.id))
  saveMarks([...loadMarks(), ...incoming.filter((m) => !have.has(m.id))].sort((a, b) => b.at - a.at))
}

/** Mark the sentence on the needle right now. Returns what happened, for the toast. */
export async function markCurrentMoment(): Promise<'book' | 'loose' | null> {
  const s = listen.get()
  if (!s.active) return null
  const seg = s.segments[s.current]
  if (!seg) return null
  const nr = nowReadingFor(s.text)
  if (nr) {
    const meta = await getBook(nr.id)
    if (meta) {
      const p = posAt(nr, seg.start)
      const marks = [...(meta.bookmarks ?? []), { ch: p.ch, b: p.b, at: Date.now(), text: seg.text }]
      await updateBook(nr.id, { bookmarks: marks }, false)
      return 'book'
    }
  }
  addLooseMark({
    id: `m${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`,
    at: Date.now(),
    title: describeText(s.text.slice(0, 12000), detectLang(s.text.slice(0, 2000)).lang).title || 'Listen',
    sentence: seg.text,
    key: textKey(s.text),
    idx: s.current,
  })
  return 'loose'
}

/** The one toast every door uses after marking. */
export async function markAndToast() {
  const r = await markCurrentMoment()
  if (r === 'book') toast('Marked in the book — find it in the book’s marks')
  else if (r === 'loose') toast('Moment marked — find it in Library')
  else toast('Nothing is playing to mark')
}

/** Jump back to a loose mark: only while its text is still the Listen draft. */
export function playLooseMark(m: LooseMark): boolean {
  const text = drafts.get().listen
  if (!text.trim() || textKey(text) !== m.key) return false
  loadText(text)
  if (m.idx > 0) seek(m.idx)
  void play(m.idx)
  location.hash = '#/listen'
  return true
}

/** Jump back to a book mark, at its exact place. */
export async function playBookMark(bookId: string, mark: { ch: number; b: number }) {
  const meta = await getBook(bookId)
  if (!meta) return
  await playBook(meta, { pos: { ch: mark.ch, b: mark.b } })
}
