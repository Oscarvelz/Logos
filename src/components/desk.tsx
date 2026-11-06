import { useEffect } from 'react'
import { AudioLines, BookOpen, FileText, Star } from 'lucide-react'
import { useStore } from '../lib/store.ts'
import { library, refreshLibrary, kindOf, type ClipMeta } from '../lib/library.ts'
import { books, refreshBooks } from '../lib/books.ts'
import { settings } from '../lib/settings.ts'
import { drafts } from '../lib/drafts.ts'
import { voiceById } from '../lib/voices.ts'
import { loadText, refreshVoices } from '../player/listen.ts'
import { formatDuration } from '../lib/text.ts'
import { BookCover } from './bookcover.tsx'

/** Tablet-only column under the player: the book in progress, quick voices and recent items. */
export function TabletDesk({ onOpen }: { onOpen: (text: string) => void }) {
  const lib = useStore(library)
  const bk = useStore(books)
  const st = useStore(settings)
  useEffect(() => { if (!lib.loaded) void refreshLibrary(); if (!bk.loaded) void refreshBooks() }, [lib.loaded, bk.loaded])

  const book = [...bk.list].filter((b) => !b.done).sort((a, b) => (b.openedAt ?? b.addedAt) - (a.openedAt ?? a.addedAt))[0]
  const recent = [...lib.clips].sort((a, b) => (b.playedAt ?? b.createdAt) - (a.playedAt ?? a.createdAt)).slice(0, 6)
  const favs = st.favorites.map((id) => voiceById(id)).filter(Boolean).slice(0, 8)
  const open = (c: ClipMeta) => { drafts.set({ listen: c.text }); loadText(c.text); onOpen(c.text) }

  return (
    <div className="desk">
      {book && (
        <a className="card desk-book" href={`#/book/${book.id}`}>
          <BookCover meta={book} small />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="desk-kicker"><BookOpen size={13} /> {book.progress > 0.002 ? 'Continue reading' : 'Start reading'}</div>
            <div className="desk-book-t">{book.title}</div>
            <div className="desk-sub">{book.author ? `${book.author} · ` : ''}{Math.round(book.progress * 100)}% read</div>
            <div className="desk-prog"><i style={{ width: `${Math.max(2, Math.round(book.progress * 100))}%` }} /></div>
          </div>
        </a>
      )}

      {favs.length > 0 && (
        <div className="card desk-voices">
          <div className="desk-kicker"><Star size={13} /> Favorite voices</div>
          <div className="desk-vrow">
            {favs.map((v) => (
              <button key={v!.id} className={`chip ${st.voiceOverride === v!.id ? 'accent' : ''}`} onClick={() => { settings.set({ voiceOverride: st.voiceOverride === v!.id ? null : v!.id }); refreshVoices() }}>
                <span className="dot" />{v!.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div className="card desk-recent">
          <div className="desk-kicker"><AudioLines size={13} /> Recent in Library</div>
          <div className="desk-list">
            {recent.map((c) => (
              <button key={c.id} className="desk-item" onClick={() => open(c)}>
                <span className="desk-ic">{kindOf(c) === 'audio' ? <AudioLines size={16} /> : <FileText size={16} />}</span>
                <span className="grow desk-item-t">{c.title}</span>
                {c.duration > 0 && <span className="desk-dur">{formatDuration(c.duration)}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
