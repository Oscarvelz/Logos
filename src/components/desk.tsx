import { useEffect, useRef } from 'react'
import { AudioLines, BookOpen, FileText, Gauge, ListTree, Pause, Play, Star } from 'lucide-react'
import { useStore } from '../lib/store.ts'
import { library, refreshLibrary, kindOf, getClipBlob, type ClipMeta } from '../lib/library.ts'
import { clipPlayer, playClip, pauseClip } from '../player/clip.ts'
import { books, refreshBooks } from '../lib/books.ts'
import { settings } from '../lib/settings.ts'
import { drafts } from '../lib/drafts.ts'
import { voiceById } from '../lib/voices.ts'
import { listen, loadText, refreshVoices, seek } from '../player/listen.ts'
import { detectLang, estimateSeconds, formatDuration, wordCount } from '../lib/text.ts'
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

/** Big tablet (≥1500 px): what's in the text, and a map of its paragraphs to jump around while listening. */
export function TextMap({ text, reading }: { text: string; reading: boolean }) {
  const s = useStore(listen)
  const st = useStore(settings)
  const src = reading ? s.text : text
  const words = wordCount(src)
  const paras = src.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean)
  const sentences = reading ? s.segments.length : (src.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) ?? []).filter((x) => x.trim()).length
  const lang = src.trim() ? detectLang(src).lang : null
  // Paragraph map from the live session: first sentence index of each paragraph.
  const map: { start: number; end: number; text: string }[] = []
  if (reading) {
    let start = 0
    s.segments.forEach((g, i) => { if (g.paraEnd || i === s.segments.length - 1) { map.push({ start, end: i, text: s.segments[start].text.replace(/\*\*|__|`/g, '') }); start = i + 1 } })
  }
  const curPara = map.findIndex((m) => s.current >= m.start && s.current <= m.end)
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => { listRef.current?.querySelector('.now')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [curPara])

  return (
    <div className="desk desk-map">
      <div className="card desk-stats">
        <div className="desk-kicker"><Gauge size={13} /> This text</div>
        {src.trim() ? (
          <div className="ds-grid">
            <div><b>{formatDuration(estimateSeconds(src, st.listenSpeed))}</b><span>listening</span></div>
            <div><b>{words.toLocaleString()}</b><span>words</span></div>
            <div><b>{sentences.toLocaleString()}</b><span>sentences</span></div>
            <div><b>{paras.length.toLocaleString()}</b><span>paragraphs</span></div>
            <div><b>{lang === 'es' ? 'Español' : 'English'}</b><span>language</span></div>
            <div><b>{reading ? `${Math.round((s.current / Math.max(1, s.segments.length)) * 100)}%` : `${st.listenSpeed.toFixed(2)}×`}</b><span>{reading ? 'heard' : 'speed'}</span></div>
          </div>
        ) : <p className="desk-empty">Paste or share a text and its length, language and listening time show up here.</p>}
      </div>
      <div className="card desk-outline">
        <div className="desk-kicker"><ListTree size={13} /> Paragraphs</div>
        {reading && map.length ? (
          <div className="desk-list" ref={listRef}>
            {map.map((m, i) => (
              <button key={i} className={`desk-para ${i === curPara ? 'now' : ''} ${i < curPara ? 'past' : ''}`} onClick={() => seek(m.start)}>
                <span className="dp-n">{i + 1}</span><span className="grow">{m.text}</span>
              </button>
            ))}
          </div>
        ) : <p className="desk-empty">Press play and every paragraph appears here. Tap one to jump straight to it.</p>}
      </div>
    </div>
  )
}

/** Big tablet Create: the audio you've made, ready to play without leaving the page. */
export function RecordingsPanel() {
  const lib = useStore(library)
  const cp = useStore(clipPlayer)
  useEffect(() => { if (!lib.loaded) void refreshLibrary() }, [lib.loaded])
  const audio = lib.clips.filter((c) => kindOf(c) === 'audio' && !c.rendering).sort((a, b) => b.createdAt - a.createdAt).slice(0, 30)
  const toggle = async (c: ClipMeta) => {
    const key = `clip:${c.id}`
    if (cp.key === key) { if (cp.playing) pauseClip(); else void playClip(key, '', { title: c.title }); return }
    const blob = await getClipBlob(c.id); if (blob) void playClip(key, blob, { title: c.title, artist: 'Logos' }, 0)
  }
  return (
    <div className="desk desk-recs">
      <div className="card desk-recent">
        <div className="desk-kicker"><AudioLines size={13} /> Your recordings</div>
        {audio.length ? (
          <div className="desk-list">
            {audio.map((c) => {
              const on = cp.key === `clip:${c.id}` && cp.playing
              return (
                <button key={c.id} className={`desk-item ${on ? 'on' : ''}`} onClick={() => void toggle(c)}>
                  <span className="desk-ic">{on ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" style={{ marginLeft: 2 }} />}</span>
                  <span className="grow desk-item-t">{c.title}</span>
                  <span className="desk-dur">{formatDuration(c.duration)}</span>
                </button>
              )
            })}
          </div>
        ) : <p className="desk-empty">Every audio you generate lands here, ready to play.</p>}
      </div>
    </div>
  )
}
