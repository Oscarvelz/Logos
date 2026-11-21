import { useEffect } from 'react'
import { AudioLines, BookOpen, FileText, Gauge, Mic2, Pause, Play, Star } from 'lucide-react'
import { useStore } from '../lib/store.ts'
import { library, refreshLibrary, kindOf, getClipBlob, type ClipMeta } from '../lib/library.ts'
import { clipPlayer, playClip, pauseClip } from '../player/clip.ts'
import { books, refreshBooks } from '../lib/books.ts'
import { settings } from '../lib/settings.ts'
import { drafts } from '../lib/drafts.ts'
import { voiceById } from '../lib/voices.ts'
import { listen, loadText, refreshVoices } from '../player/listen.ts'
import { detectLang, estimateSeconds, formatDuration, wordCount } from '../lib/text.ts'
import { BookCover } from './bookcover.tsx'
import { t } from '../lib/i18n.ts'

/** Tablet-only column under the player: the book in progress, quick voices and recent items. */
export function TabletDesk({ onOpen, onVoice }: { onOpen: (text: string) => void; onVoice: () => void }) {
  const lib = useStore(library)
  const bk = useStore(books)
  const st = useStore(settings)
  useEffect(() => { if (!lib.loaded) void refreshLibrary(); if (!bk.loaded) void refreshBooks() }, [lib.loaded, bk.loaded])

  const book = [...bk.list].filter((b) => !b.done).sort((a, b) => (b.openedAt ?? b.addedAt) - (a.openedAt ?? a.addedAt))[0]
  const recent = [...lib.clips].sort((a, b) => (b.playedAt ?? b.createdAt) - (a.playedAt ?? a.createdAt)).slice(0, 6)
  const favs = st.favorites.map((id) => voiceById(id)).filter(Boolean).slice(0, 8)
  const open = (c: ClipMeta) => { drafts.set({ listen: c.text }); loadText(c.text); onOpen(c.text) }

  return (
    <div className="desk" data-present="desk-tablet">
      {book && (
        <a className="card desk-book" data-present="desk-book" href={`#/book/${book.id}`}>
          <BookCover meta={book} small />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="desk-kicker"><BookOpen size={13} /> {book.progress > 0.002 ? t('Continue reading') : t('Start reading')}</div>
            <div className="desk-book-t">{book.title}</div>
            <div className="desk-sub">{book.author ? `${book.author} · ` : ''}{t('{n}% read', { n: Math.round(book.progress * 100) })}</div>
            <div className="desk-prog"><i style={{ width: `${Math.max(2, Math.round(book.progress * 100))}%` }} /></div>
          </div>
        </a>
      )}

      {/* The desk's voices card stands ALWAYS (1.4.203): it is the
          Listen area's voice seat now — the player's own voice chip
          was retired as its duplicate (Oscar). Beside the favorite
          chips, the card carries what that chip held: the door to
          the FULL picker (every voice, Automatic, search), wearing
          the chip's own face — gold dot and Mic2 — and its class,
          so the .voice-chip anchor follows the deed. Without the
          door the desk would be a lesser substitute; with it, the
          removal loses nothing. */}
      <div className="card desk-voices" data-present="desk-fav-voices">
        <div className="desk-kicker"><Star size={13} /> {t('Favorite voices')}</div>
        <div className="desk-vrow">
          {favs.map((v) => (
            <button key={v!.id} className={`chip ${st.voiceOverride === v!.id ? 'accent' : ''}`} onClick={() => { settings.set({ voiceOverride: st.voiceOverride === v!.id ? null : v!.id }); refreshVoices() }}>
              <span className="dot" />{v!.name}
            </button>
          ))}
          <button className="chip voice-chip" onClick={onVoice} aria-label={t('Choose a voice')}>
            <span className="dot" /><Mic2 size={15} />{t('Choose a voice')}
          </button>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="card desk-recent" data-present="desk-recent">
          <div className="desk-kicker"><AudioLines size={13} /> {t('Recent in Library')}</div>
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

/** Big tablet (≥1500 px): what's in the text, and the reader's books.
    Until 1.4.167 the second card mapped the text's paragraphs — the
    very words already on stage in the main window. Oscar (2026-11-14):
    that column earns its place as his books instead, the ones he
    starred as favorites first of all. The star itself was already the
    books' own (the shelf menu's «Add to favorites», BookMeta.fav);
    nothing new had to be built for the pin to exist — this card is
    where it pays off. With no favorites yet, the card shows his books
    and says how a star pins one here. */
export function TextMap({ text, reading }: { text: string; reading: boolean }) {
  const s = useStore(listen)
  const st = useStore(settings)
  const bk = useStore(books)
  useEffect(() => { if (!bk.loaded) void refreshBooks() }, [bk.loaded])
  const src = reading ? s.text : text
  const words = wordCount(src)
  const paras = src.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean)
  const sentences = reading ? s.segments.length : (src.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) ?? []).filter((x) => x.trim()).length
  const lang = src.trim() ? detectLang(src).lang : null
  const favBooks = [...bk.list].filter((b) => b.fav).sort((a, b) => (b.openedAt ?? b.addedAt) - (a.openedAt ?? a.addedAt))
  const pinned = favBooks.length > 0
  const shown = (pinned ? favBooks : [...bk.list].sort((a, b) => (b.openedAt ?? b.addedAt) - (a.openedAt ?? a.addedAt))).slice(0, 8)

  return (
    <div className="desk desk-map">
      <div className="card desk-stats" data-present="desk-textmap-stats">
        <div className="desk-kicker"><Gauge size={13} /> {t('This text')}</div>
        {src.trim() ? (
          <div className="ds-grid">
            <div><b>{formatDuration(estimateSeconds(src, st.listenSpeed))}</b><span>{t('listening')}</span></div>
            <div><b>{words.toLocaleString()}</b><span>{t('words')}</span></div>
            <div><b>{sentences.toLocaleString()}</b><span>{t('sentences')}</span></div>
            <div><b>{paras.length.toLocaleString()}</b><span>{t('paragraphs')}</span></div>
            <div><b>{lang === 'es' ? 'Español' : t('English')}</b><span>{t('language')}</span></div>
            <div><b>{reading ? `${Math.round((s.current / Math.max(1, s.segments.length)) * 100)}%` : `${st.listenSpeed.toFixed(2)}×`}</b><span>{reading ? t('heard') : t('speed')}</span></div>
          </div>
        ) : <p className="desk-empty">{t('Paste or share a text and its length, language and listening time show up here.')}</p>}
      </div>
      <div className="card desk-outline">
        <div className="desk-kicker">{pinned ? <Star size={13} /> : <BookOpen size={13} />} {pinned ? t('Favorite books') : t('Your books')}</div>
        {shown.length ? (
          <div className="desk-list">
            {shown.map((b) => (
              <a key={b.id} className="desk-item" href={`#/book/${b.id}`}>
                <span className="desk-ic"><BookOpen size={16} /></span>
                <span className="grow desk-item-t">{b.title}
                  <span className="desk-item-sub">{b.author ? `${b.author} · ` : ''}{b.done ? t('Finished') : t('{n}% read', { n: Math.round(b.progress * 100) })}</span>
                </span>
                {b.fav && <Star size={14} className="desk-fav-star" fill="currentColor" />}
              </a>
            ))}
          </div>
        ) : <p className="desk-empty">{t('Books you import land here. Star one in its menu and it stays pinned.')}</p>}
        {!pinned && shown.length > 0 && <p className="desk-hint">{t('Star a book in its menu and it pins here as a favorite.')}</p>}
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
    <div className="desk desk-recs" data-present="create-recordings">
      <div className="card desk-recent">
        <div className="desk-kicker"><AudioLines size={13} /> {t('Your recordings')}</div>
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
        ) : <p className="desk-empty">{t('Every audio you generate lands here, ready to play.')}</p>}
      </div>
    </div>
  )
}
