// Marks — "keep this moment" while listening (Oscar's ask, 2026-11-08).
// A mark made inside a BOOK joins the book's own bookmark list (the reader's
// system: one list, two doors). A mark made on loose text (a draft, a pasted
// page, a bubble clip) lives here, tied to the draft it was made in.
import { listen, loadText, play, seek } from '../player/listen.ts'
import { drafts } from './drafts.ts'
import { describeText } from './describe.ts'
import { detectLang } from './text.ts'
import { getBook, updateBook } from './books.ts'
import { library } from './library.ts'
import { nowReadingFor, posAt } from './book/nowreading.ts'
import { playBook } from './book/playbook.ts'
import { toast } from '../components/ui.tsx'
import { t } from './i18n.ts'

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
// The fingerprint (cure R3-T1-4). This formula used to be
// `${length}:${first 48}:${last 48}` — the class this app convicted
// in T1-13 (nowreading) and F8-1/T2-1 (the clipboard) — and Round 3
// proved the conviction applies here too: a corrected re-paste of
// the same length, same opening and closing, one paragraph fixed in
// the middle, inherited the previous text's resume record whole —
// its offer, its sentence index (naming different words past the
// edit), and its finished state. The key is now two independent
// 32-bit hashes (cyrb64, the keyOf/renderKey pattern) over EVERY
// character: a collision needs both to agree on the same length.
// The old formula survives as `legacyTextKey` for exactly one
// reader: playLooseMark dual-accepts it, because a LooseMark is
// the user's own data — a moment they chose to keep — and changing
// the key must not orphan the marks already stored. SessionResume
// records get no dual-accept: a resume record is a pointer, never
// a vault (the T1-13 doctrine), so a pre-cure record simply stops
// matching the readers' comparisons and is overwritten by the next
// session that earns one.
export const legacyTextKey = (t: string) => `${t.length}:${t.slice(0, 48)}:${t.slice(-48)}`
export const textKey = (t: string) => {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < t.length; i++) {
    const ch = t.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 'k' + (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0') + '-' + t.length
}

export function loadMarks(): LooseMark[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as LooseMark[] } catch { return [] }
}
function saveMarks(list: LooseMark[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 120))) } catch { /* full */ }
}
export function addLooseMark(m: LooseMark) {
  // M-12 cure (loose half): a loose mark's identity is (draft fingerprint,
  // sentence index) — the same moment marked twice in quick succession
  // (a double press) is ONE mark, however different the two timestamps
  // and ids are. Book marks get the same law at the books store's write
  // chokepoint (dedupeBookmarks in books.ts, identity = chapter + block).
  const cur = loadMarks()
  if (cur.some((x) => x.key === m.key && x.idx === m.idx)) return
  saveMarks([m, ...cur])
}
export function removeLooseMark(id: string) { saveMarks(loadMarks().filter((m) => m.id !== id)) }
export function mergeMarks(incoming: LooseMark[]) {
  const have = new Set(loadMarks().map((m) => m.id))
  saveMarks([...loadMarks(), ...incoming.filter((m) => !have.has(m.id))].sort((a, b) => b.at - a.at))
}

// 1.4.204: the shell's receipt witness for the panel's ⚑. A landed mark
// changes nothing the panel state push carries, so the shell's poke
// watch judged every mark on a quiet session unheard and manufactured
// a ghost visit — the black-screen trip Oscar reported again. Every
// handled mark now moves this counter, and the push carries it.
let marksEpochN = 0
export const marksEpoch = () => marksEpochN

/** Mark the sentence on the needle right now. Returns what happened, for the toast. */
export async function markCurrentMoment(): Promise<'book' | 'loose' | null> {
  const s = listen.get()
  if (!s.active) return null
  const seg = s.segments[s.current]
  if (!seg) return null
  const nr = nowReadingFor(s.text)
  if (nr) {
    const p = posAt(nr, seg.start)
    const landed = await updateBook(nr.id, (cur) => ({ bookmarks: [...(cur.bookmarks ?? []), { ch: p.ch, b: p.b, at: Date.now(), text: seg.text }] }), false)
    if (landed) { marksEpochN++; return 'book' }
  }
  addLooseMark({
    id: `m${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`,
    at: Date.now(),
    title: describeText(s.text.slice(0, 12000), detectLang(s.text.slice(0, 2000)).lang).title || 'Listen',
    sentence: seg.text,
    key: textKey(s.text),
    idx: s.current,
  })
  marksEpochN++
  return 'loose'
}

/** The one toast every door uses after marking. */
export async function markAndToast() {
  const r = await markCurrentMoment()
  if (r === 'book') toast(t('Marked in the book — find it in the book’s marks'))
  else if (r === 'loose') toast(t('Moment marked — find it in Library'))
  else toast(t('Nothing is playing to mark'))
}

/** Jump back to a loose mark: while its text is still the Listen draft,
 *  or — 1.4.204, Oscar's ruling — from its saved copy in the Library:
 *  a mark made after saving lives with that copy, so when the draft has
 *  moved on, the copy comes back into Listen at the marked sentence. */
export function playLooseMark(m: LooseMark): boolean {
  const text = drafts.get().listen
  // Dual-accept (cure R3-T1-4): a mark stored before the key change
  // carries the legacy fingerprint and is still honoured — the mark
  // is the user's data. New marks carry the strong key, against
  // which a middle-edited near-copy no longer matches.
  if (text.trim() && (textKey(text) === m.key || legacyTextKey(text) === m.key)) {
    loadText(text)
    if (m.idx > 0) seek(m.idx)
    void play(m.idx)
    location.hash = '#/listen'
    return true
  }
  const clip = library.get().clips.find((c) => { const ct = c.text; return !!ct && (textKey(ct) === m.key || legacyTextKey(ct) === m.key) })
  if (!clip?.text) return false
  drafts.set({ listen: clip.text })
  loadText(clip.text)
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
