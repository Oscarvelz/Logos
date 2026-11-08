// The marks shelf (Library → Saved): every "keep this moment" in one list —
// book marks from the books' own lists and loose marks from pasted texts.
import { useState } from 'react'
import { Bookmark, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store.ts'
import { books, updateBook } from '../lib/books.ts'
import { loadMarks, removeLooseMark, playLooseMark, playBookMark, type LooseMark } from '../lib/marks.ts'
import { toast } from './ui.tsx'

type Row =
  | { kind: 'book'; at: number; bookId: string; bookTitle: string; ch: number; b: number; sentence: string }
  | { kind: 'loose'; at: number; mark: LooseMark }

const when = (at: number) => new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

export function MarksSection() {
  const bk = useStore(books)
  const [loose, setLoose] = useState<LooseMark[]>(() => loadMarks())
  const [, setTick] = useState(0)

  const rows: Row[] = [
    ...bk.list.flatMap((b) => (b.bookmarks ?? []).map((m) => ({ kind: 'book' as const, at: m.at, bookId: b.id, bookTitle: b.title, ch: m.ch, b: m.b, sentence: m.text }))),
    ...loose.map((mark) => ({ kind: 'loose' as const, at: mark.at, mark })),
  ].sort((a, b) => b.at - a.at)

  if (!rows.length) return null

  const drop = async (r: Row) => {
    if (r.kind === 'loose') { removeLooseMark(r.mark.id); setLoose(loadMarks()); return }
    const meta = bk.list.find((b) => b.id === r.bookId)
    if (!meta) return
    await updateBook(r.bookId, { bookmarks: (meta.bookmarks ?? []).filter((m) => m.at !== r.at) }, false)
    setTick((t) => t + 1)
  }

  return (
    <div className="card" style={{ padding: '12px 16px 6px', marginBottom: 14 }}>
      <div className="continue-h">Marks</div>
      {rows.slice(0, 30).map((r) => (
        <div key={`${r.kind}-${r.at}-${r.kind === 'book' ? r.bookId : r.mark.id}`} className="mark-row" role="button" tabIndex={0}
          onClick={() => {
            if (r.kind === 'book') void playBookMark(r.bookId, r)
            else if (!playLooseMark(r.mark)) toast('That text is no longer in Listen — the moment is kept here as words')
          }}>
          <span className="mark-ic"><Bookmark size={16} /></span>
          <span className="mark-tx grow">
            <span className="mark-t">{r.kind === 'book' ? r.bookTitle : r.mark.title}</span>
            <span className="mark-s">{r.kind === 'book' ? r.sentence : r.mark.sentence}</span>
            <span className="mark-when">{when(r.at)}</span>
          </span>
          <button className="mark-del" aria-label="Remove mark" onClick={(e) => { e.stopPropagation(); void drop(r) }}><Trash2 size={15} /></button>
        </div>
      ))}
    </div>
  )
}
