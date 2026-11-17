// Take a book into Listen — the whole book as one session (1.4.57) — optionally
// at a place: a reading Pos or a character offset (a bookmark, Continue).
import { getContent, sweepTempBooks, books, refreshBooks, type BookMeta, type Pos } from '../books.ts'
import { setNowReading, nowReadingFor } from './nowreading.ts'
import { drafts } from '../drafts.ts'
import { listen, loadText, play, seek, registerBookSkip } from '../../player/listen.ts'

const openBook = (id: string) => { location.hash = `#/book/${encodeURIComponent(id)}` }

/** The character offset where a Pos starts in the joined Listen text. */
function offsetOfPos(parts: string[], where: Pos[], pos: Pos): number {
  let off = 0
  for (let i = 0; i < parts.length; i++) {
    if (where[i].ch === pos.ch && where[i].b === pos.b) return off
    off += parts[i].length + 2
  }
  return 0
}

/**
 * The book-to-book SKIP deed (cure T1-19), registered with the
 * player at this module's scope: the card's ⏭/⏮ over a book session
 * travel to the neighbouring book, as Oscar framed the seat —
 * «como si fuese una canción, pasar de un libro a otro». The queue
 * is the library in the order the books arrived (addedAt, then
 * title): a stable order that never re-sorts under the reader, so
 * repeated presses walk the shelf instead of oscillating between
 * the two most recently opened. The neighbouring book opens at its
 * own saved place — Continue's courtesy — or at its start when it
 * has none. At either end of the shelf the press simply stays.
 */
registerBookSkip((dir) => { void skipBook(dir) })

async function skipBook(dir: 1 | -1): Promise<void> {
  const cur = nowReadingFor(listen.get().text)
  if (!cur) return
  if (!books.get().loaded) await refreshBooks()
  const list = [...books.get().list].sort((a, b) => (a.addedAt - b.addedAt) || a.title.localeCompare(b.title))
  const i = list.findIndex((b) => b.id === cur.id)
  const target = i >= 0 ? list[i + dir] : undefined
  if (!target) return
  await playBook(target, { pos: target.pos })
}

export async function playBook(meta: BookMeta, at?: { pos?: Pos; offset?: number }): Promise<void> {
  const content = await getContent(meta.id)
  const chapters = content?.chapters ?? []
  const parts: string[] = []
  const where: Pos[] = []
  for (let c = 0; c < chapters.length; c++) {
    const blocks = chapters[c].blocks
    for (let i = 0; i < blocks.length; i++) { parts.push(blocks[i].t); where.push({ ch: c, b: i }) }
  }
  const text = parts.join('\n\n')
  if (!text.trim()) { openBook(meta.id); return }
  setNowReading(meta.id, meta.title, parts, where)
  void sweepTempBooks()
  drafts.set({ listen: text })
  loadText(text)
  let idx = 0
  const offset = at?.offset ?? (at?.pos ? offsetOfPos(parts, where, at.pos) : undefined)
  if (offset != null) {
    idx = Math.max(0, listen.get().segments.findIndex((g) => g.end > offset))
    if (idx > 0) seek(idx)
  }
  void play(idx)
  location.hash = '#/listen'
}
