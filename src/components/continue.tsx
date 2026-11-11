// Continue listening (Oscar's ask, 2026-11-08): one front door for whatever
// was left mid-way — a book remembers its page, a clip remembers its second,
// a pasted text now remembers its sentence. Newest first, tap to resume.
import { useMemo } from 'react'
import { AudioLines, BookOpen, PenLine, Play } from 'lucide-react'
import { useStore } from '../lib/store.ts'
import { books, type BookMeta } from '../lib/books.ts'
import { library, getClipBlob, type ClipMeta } from '../lib/library.ts'
import { playBook } from '../lib/book/playbook.ts'
import { playClip } from '../player/clip.ts'
import { listen, loadText, play, seek } from '../player/listen.ts'
import { drafts } from '../lib/drafts.ts'
import { loadSessionResume } from '../lib/resume.ts'
import { textKey } from '../lib/marks.ts'
import { formatDuration } from '../lib/text.ts'
import { t } from '../lib/i18n.ts'

type Entry = {
  kind: 'book' | 'clip' | 'text'
  title: string
  sub: string
  at: number
  run: () => void
}

export function ContinueRow({ onResume }: { onResume?: () => void }) {
  const bk = useStore(books)
  const lib = useStore(library)
  const s = useStore(listen)
  const d = useStore(drafts)

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = []
    const book = [...bk.list]
      .filter((b) => !b.done && b.progress > 0.01 && b.progress < 0.985 && (b.openedAt ?? 0) > 0)
      .sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0))[0]
    if (book) {
      const meta: BookMeta = book
      out.push({
        kind: 'book',
        title: meta.title,
        sub: t('{n}% read', { n: Math.round(meta.progress * 100) }),
        at: meta.openedAt ?? 0,
        run: () => { void playBook(meta, { pos: meta.pos }) },
      })
    }
    const clip = [...lib.clips]
      .filter((c) => !c.done && (c.pos ?? 0) > 5 && (c.playedAt ?? 0) > 0)
      .sort((a, b) => (b.playedAt ?? 0) - (a.playedAt ?? 0))[0]
    if (clip) {
      const c: ClipMeta = clip
      out.push({
        kind: 'clip',
        title: c.title,
        sub: c.kind === 'text' ? t('Saved text') : t('Left at {d}', { d: formatDuration(c.pos ?? 0) }),
        at: c.playedAt ?? 0,
        run: () => {
          if (c.kind === 'text' || !c.format) {
            loadText(c.text)
            void play()
            location.hash = '#/listen'
            return
          }
          void getClipBlob(c.id).then((blob) => {
            if (blob) void playClip(`clip:${c.id}`, blob, { title: c.title, artist: c.voice }, c.pos ?? 0)
          })
        },
      })
    }
    const r = loadSessionResume()
    if (r && r.idx > 0 && d.listen.trim() && textKey(d.listen) === r.key && !(s.active && textKey(s.text) === r.key)) {
      out.push({
        kind: 'text',
        title: r.title,
        sub: t('Sentence {a}', { a: r.idx + 1 }),
        at: r.at,
        run: () => { loadText(d.listen); seek(r.idx); void play(r.idx); onResume?.(); location.hash = '#/listen' },
      })
    }
    return out.sort((a, b) => b.at - a.at).slice(0, 3)
  }, [bk.list, lib.clips, d.listen, s.active, s.text])

  if (!entries.length) return null
  const Icon = { book: BookOpen, clip: AudioLines, text: PenLine }
  return (
    <div className="card continue-card">
      <div className="continue-h">{t('Continue listening')}</div>
      {entries.map((e, i) => {
        const I = Icon[e.kind]
        return (
          <button key={`${e.kind}-${i}`} className="continue-row" onClick={e.run}>
            <span className="continue-ic"><I size={13} /></span>
            <span className="grow continue-tx">
              <span className="continue-t">{e.title}</span>
              <span className="continue-s">{e.sub}</span>
            </span>
            <span className="continue-play"><Play size={11} fill="currentColor" /></span>
          </button>
        )
      })}
    </div>
  )
}
