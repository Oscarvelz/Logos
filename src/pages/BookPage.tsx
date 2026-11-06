import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, AudioLines, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Copy, CornerUpLeft, ListTree, Loader2, Pause, Play, Search, Type, X } from 'lucide-react'
import { getBook, getContent, updateBook, progressAt, type BookMeta, type Block, type Chapter, type Pos } from '../lib/books.ts'
import { drafts } from '../lib/drafts.ts'
import { loadText, play, listen, toggle } from '../player/listen.ts'
import { useStore } from '../lib/store.ts'
import { Sheet, Seg, toast, useMediaQuery } from '../components/ui.tsx'
import { BookCover } from '../components/bookcover.tsx'
import { setNowReading, nowReadingFor } from '../lib/book/nowreading.ts'

const bookIdFromHash = () => decodeURIComponent(location.hash.replace(/^#\/?book\/?/, '').split(/[/?]/)[0] ?? '')
type Type = { size: number; font: 'serif' | 'sans'; spacing: 'snug' | 'airy' }
const loadType = (): Type => { try { return { size: 19, font: 'serif', spacing: 'airy', ...JSON.parse(localStorage.getItem('logos.bookType') ?? '{}') } } catch { return { size: 19, font: 'serif', spacing: 'airy' } } }
const fold = (s: string) => { let o = ''; for (const c of s) { const f = c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase(); o += f.length === c.length ? f : (f + '  ').slice(0, c.length) } return o }
/** "Capítulo VIII. Del buen suceso…" → "Capítulo VIII" for the header; the full title opens the chapter. */
const shortTitle = (t: string) => /^((?:cap[ií]tulo|chapter|parte|part|libro|book|canto|acto|act|lecci[oó]n|lesson|tema|unidad|unit)\s+[\p{L}\d]+)[.:—–-]\s+\S/iu.exec(t)?.[1] ?? t
type Hit = { ch: number; b: number; s: number; e: number }
type Mark = { b: number; s: number; e: number } | null
const isPlace = (to: string) => /^\d+:\d+$/.test(to)
const parsePlace = (to: string): Pos => { const [ch, b] = to.split(':').map(Number); return { ch, b } }

export function BookPage() {
  const [id, setId] = useState(bookIdFromHash)
  const [meta, setMeta] = useState<BookMeta | null>(null)
  const [chapters, setChapters] = useState<Chapter[] | null>(null)
  const [missing, setMissing] = useState(false)
  const [ch, setCh] = useState(0)
  const [goal, setGoal] = useState<{ b: number; n: number } | null>(null)
  const [mark, setMark] = useState<Mark>(null)
  const [pos, setPos] = useState<Pos>({ ch: 0, b: 0 })
  const [sheet, setSheet] = useState<'toc' | 'search' | 'type' | null>(null)
  const wide = useMediaQuery('(min-width: 1100px)')
  const [sel, setSel] = useState<number | null>(null)
  const [back, setBack] = useState<Pos[]>([])
  const [note, setNote] = useState<{ to: Pos; text: string } | null>(null)
  const [type, setType] = useState<Type>(loadType)
  const [find, setFind] = useState<{ q: string; hits: Hit[]; i: number } | null>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const posRef = useRef(pos)
  posRef.current = pos

  useEffect(() => { const on = () => setId(bookIdFromHash()); addEventListener('hashchange', on); return () => removeEventListener('hashchange', on) }, [])
  useEffect(() => {
    let live = true
    setMeta(null); setChapters(null); setMissing(false)
    void (async () => {
      const [m, c] = await Promise.all([getBook(id), getContent(id)])
      if (!live) return
      if (!m || !c) { setMissing(true); return }
      setMeta(m); setChapters(c.chapters)
      const start = { ch: Math.min(m.pos.ch, c.chapters.length - 1), b: m.pos.b }
      setCh(start.ch); setPos(start); setGoal({ b: start.b, n: Date.now() })
      void updateBook(id, { openedAt: Date.now() }, false)
    })()
    return () => { live = false }
  }, [id])
  useEffect(() => { localStorage.setItem('logos.bookType', JSON.stringify(type)) }, [type])
  useEffect(() => { document.documentElement.dataset.book = '1'; return () => { delete document.documentElement.dataset.book } }, [])

  // Save the reading place (throttled, and when leaving).
  const save = useCallback(() => {
    if (!meta || !chapters) return
    const p = posRef.current
    const progress = progressAt(meta, chapters, p)
    void updateBook(meta.id, { pos: p, progress, done: meta.done || progress > 0.985 }, false)
  }, [meta, chapters])
  useEffect(() => { const t = setTimeout(save, 1200); return () => clearTimeout(t) }, [pos, save])
  useEffect(() => { addEventListener('pagehide', save); return () => { removeEventListener('pagehide', save); save() } }, [save])

  // Scroll to the block a jump asked for, once the chapter is on screen.
  useLayoutEffect(() => {
    if (!goal || !chapters) return
    const el = goal.b > 0 ? document.getElementById(`bk-${goal.b}`) : null
    const head = document.querySelector('.bk-head')?.getBoundingClientRect().height ?? 60
    const found = el?.querySelector<HTMLElement>('.bk-mark')
    // A search match sits a third of the way down the screen; any other jump puts its paragraph at the top.
    const top = found ? found.getBoundingClientRect().top + scrollY - innerHeight * 0.34 : el ? el.getBoundingClientRect().top + scrollY - head - 14 : 0
    window.scrollTo({ top: Math.max(0, top), behavior: 'instant' as ScrollBehavior })
  }, [goal, ch, chapters])

  // Track which block sits at the top of the screen.
  useEffect(() => {
    let raf = 0
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const els = textRef.current?.querySelectorAll<HTMLElement>('[data-b]')
        if (!els?.length) return
        const top = (document.querySelector('.bk-head')?.getBoundingClientRect().bottom ?? 60) + 8
        let lo = 0, hi = els.length - 1
        while (lo < hi) { const m = (lo + hi) >> 1; if (els[m].getBoundingClientRect().bottom < top) lo = m + 1; else hi = m }
        const b = Number(els[lo].dataset.b)
        if (posRef.current.ch !== ch || posRef.current.b !== b) setPos({ ch, b })
      })
    }
    addEventListener('scroll', on, { passive: true })
    on()
    return () => { removeEventListener('scroll', on); cancelAnimationFrame(raf) }
  }, [ch, chapters])

  const jump = useCallback((to: Pos, opts: { push?: boolean; mark?: Mark } = {}) => {
    if (!chapters) return
    const c = Math.max(0, Math.min(chapters.length - 1, to.ch))
    if (opts.push) setBack((s) => [...s.slice(-30), posRef.current])
    setSel(null)
    setMark(opts.mark ?? null)
    setCh(c)
    setPos({ ch: c, b: to.b })
    setGoal({ b: to.b, n: Date.now() })
  }, [chapters])

  const goBack = () => { const last = back[back.length - 1]; if (!last) return; setBack((s) => s.slice(0, -1)); jump(last) }

  const onLink = (to: string) => {
    if (!isPlace(to)) { window.open(to, '_blank', 'noopener'); return }
    const target = parsePlace(to)
    const block = chapters?.[target.ch]?.blocks[target.b]
    // A short link to a short passage is a note: show it in place.
    if (block && block.t.length < 700 && !(target.ch === ch && Math.abs(target.b - posRef.current.b) < 3) && block.k !== 'h1' && block.k !== 'h2') {
      const next = chapters![target.ch].blocks[target.b + 1]
      const isNoteish = /^\[?\(?\d{1,3}[\])]?\.?\s|^\*/.test(block.t) || (next && next.t.length < 700 && /^\[?\d{1,3}[\])]?/.test(next.t))
      if (isNoteish) { setNote({ to: target, text: block.t }); return }
    }
    jump(target, { push: true })
  }

  const listenFrom = (b: number) => {
    if (!chapters || !meta) return
    const parts: string[] = []
    const where: Pos[] = []
    let n = 0
    for (let c = ch; c < chapters.length && n < 40000; c++) {
      const blocks = chapters[c].blocks
      for (let i = c === ch ? b : 0; i < blocks.length && n < 40000; i++) { parts.push(blocks[i].t); where.push({ ch: c, b: i }); n += blocks[i].t.length }
    }
    const text = parts.join('\n\n')
    setNowReading(meta.id, meta.title, parts, where)
    drafts.set({ listen: text })
    loadText(text)
    void play()
    setSel(null)
    toast(`Reading ${meta.title} from here`)
  }

  const toggleBookmark = (b: number) => {
    if (!meta || !chapters) return
    const list = meta.bookmarks ?? []
    const has = list.some((x) => x.ch === ch && x.b === b)
    const next = has ? list.filter((x) => !(x.ch === ch && x.b === b)) : [...list, { ch, b, at: Date.now(), text: chapters[ch].blocks[b].t.slice(0, 160) }]
    setMeta({ ...meta, bookmarks: next })
    void updateBook(meta.id, { bookmarks: next }, false)
    toast(has ? 'Bookmark removed' : 'Bookmarked')
    setSel(null)
  }

  if (missing) return (
    <div className="page book-page"><div className="card empty"><h3>This book isn’t here any more</h3><button className="btn primary" onClick={() => { location.hash = '#/library?books' }}>Back to Library</button></div></div>
  )
  if (!meta || !chapters) return <div className="page book-page"><div className="bk-loading"><span className="spin-ring" /></div></div>

  const chapter = chapters[ch]
  const progress = progressAt(meta, chapters, pos)
  const marked = new Set((meta.bookmarks ?? []).filter((x) => x.ch === ch).map((x) => x.b))
  const st = { '--bk-size': `${type.size}px`, '--bk-lh': type.spacing === 'airy' ? 1.72 : 1.5 } as React.CSSProperties

  return (
    <div className={`page book-page bk-${type.font} ${wide ? 'has-side' : ''}`} style={st}>
      {wide && <aside className="bk-side" aria-label="Contents"><TocBody side active meta={meta} chapters={chapters} at={{ ch, b: pos.ch === ch ? pos.b : 0 }} onGo={(p) => jump(p, { push: true })} /></aside>}
      <header className="bk-head">
        <button className="icon-btn" onClick={() => { location.hash = '#/library?books' }} aria-label="Back to Library"><ArrowLeft size={21} /></button>
        <div className="bk-head-t">
          <div className="bk-head-book">{meta.title.split(/\s*[:—–]\s+|\s*:\s*/)[0] || meta.title}</div>
          <div className="bk-head-ch">{shortTitle(chapter.title)}</div>
        </div>
        <button className="icon-btn" onClick={() => setSheet('search')} aria-label="Search this book"><Search size={20} /></button>
        {!wide && <button className="icon-btn" onClick={() => setSheet('toc')} aria-label="Contents"><ListTree size={20} /></button>}
        <button className="icon-btn" onClick={() => setSheet('type')} aria-label="Text size and font"><Type size={20} /></button>
      </header>

      {(back.length > 0 || find) && (
        <div className="bk-float">
          {back.length > 0 && <button className="chip accent bk-back" onClick={goBack}><CornerUpLeft size={15} /> Back</button>}
          {find && (
            <div className="bk-find">
              <span className="bk-find-q">“{find.q}”</span>
              <span className="bk-find-n">{find.i + 1} of {find.hits.length}{find.hits.length >= 500 ? '+' : ''}</span>
              <button className="icon-btn" aria-label="Previous match" onClick={() => { const i = (find.i - 1 + find.hits.length) % find.hits.length; const h = find.hits[i]; setFind({ ...find, i }); jump(h, { mark: { b: h.b, s: h.s, e: h.e } }) }}><ChevronUp size={18} /></button>
              <button className="icon-btn" aria-label="Next match" onClick={() => { const i = (find.i + 1) % find.hits.length; const h = find.hits[i]; setFind({ ...find, i }); jump(h, { mark: { b: h.b, s: h.s, e: h.e } }) }}><ChevronDown size={18} /></button>
              <button className="icon-btn" aria-label="Close search" onClick={() => { setFind(null); setMark(null) }}><X size={17} /></button>
            </div>
          )}
        </div>
      )}

      <article className="bk-text" ref={textRef} key={ch}>
        <div className="bk-eyebrow">{ch === 0 && meta.author ? meta.author : `Chapter ${ch + 1} of ${chapters.length}`}</div>
        {chapter.blocks.map((b, i) => (
          <BlockView key={i} b={b} i={i} sel={sel === i} marked={marked.has(i)} mark={mark?.b === i ? mark : null} onLink={onLink}
            onTap={() => setSel((s) => (s === i ? null : i))} />
        ))}
        <ChapterEnd chapters={chapters} ch={ch} meta={meta} onNext={() => jump({ ch: ch + 1, b: 0 })} onFinish={() => { void updateBook(meta.id, { done: true, progress: 1 }); setMeta({ ...meta, done: true }); toast('Marked as finished') }} />
      </article>

      {createPortal(
        <>
          {sel !== null && (
            <div className="bk-actions" role="toolbar">
              <button className="btn sm primary" onClick={() => listenFrom(sel)}><Play size={15} fill="currentColor" /> Listen from here</button>
              <button className="icon-btn" onClick={() => toggleBookmark(sel)} aria-label="Bookmark">{marked.has(sel) ? <BookmarkCheck size={19} /> : <Bookmark size={19} />}</button>
              <button className="icon-btn" onClick={() => { void navigator.clipboard?.writeText(chapter.blocks[sel].t).then(() => toast('Copied')); setSel(null) }} aria-label="Copy"><Copy size={18} /></button>
              <button className="icon-btn" onClick={() => setSel(null)} aria-label="Close"><X size={18} /></button>
            </div>
          )}
          <BottomBar meta={meta} chapters={chapters} ch={ch} progress={progress} onPrev={() => jump({ ch: ch - 1, b: 0 })} onNext={() => jump({ ch: ch + 1, b: 0 })}
            onToc={() => setSheet('toc')} onListen={() => listenFrom(pos.ch === ch ? pos.b : 0)} />
        </>,
        document.body,
      )}

      <TocSheet open={sheet === 'toc'} onClose={() => setSheet(null)} meta={meta} chapters={chapters} at={pos} onGo={(p) => { setSheet(null); jump(p, { push: true }) }} />
      <SearchSheet open={sheet === 'search'} onClose={() => setSheet(null)} chapters={chapters} initial={find?.q ?? ''}
        onPick={(q, hits, i) => { setSheet(null); setFind({ q, hits, i }); const h = hits[i]; jump(h, { push: !find, mark: { b: h.b, s: h.s, e: h.e } }) }} />
      <Sheet open={sheet === 'type'} onClose={() => setSheet(null)} title="Text">
        <div className="bk-type">
          <div className="bk-type-row"><span>Size</span>
            <div className="row" style={{ gap: 8 }}>
              <button className="icon-btn" onClick={() => setType({ ...type, size: Math.max(11, type.size - 1) })} aria-label="Smaller"><span style={{ fontSize: 14 }}>A</span></button>
              <span className="mono" style={{ minWidth: 30, textAlign: 'center' }}>{type.size}</span>
              <button className="icon-btn" onClick={() => setType({ ...type, size: Math.min(30, type.size + 1) })} aria-label="Larger"><span style={{ fontSize: 22 }}>A</span></button>
            </div>
          </div>
          <div className="bk-type-row"><span>Font</span><Seg value={type.font} onChange={(font) => setType({ ...type, font })} options={[{ value: 'serif', label: 'Serif' }, { value: 'sans', label: 'Sans' }]} /></div>
          <div className="bk-type-row"><span>Lines</span><Seg value={type.spacing} onChange={(spacing) => setType({ ...type, spacing })} options={[{ value: 'snug', label: 'Snug' }, { value: 'airy', label: 'Airy' }]} /></div>
        </div>
      </Sheet>
      <Sheet open={!!note} onClose={() => setNote(null)} title="Note">
        {note && <>
          <p className="bk-note">{note.text}</p>
          <div className="row" style={{ gap: 8, marginTop: 14 }}>
            <button className="btn ghost grow" onClick={() => setNote(null)}>Close</button>
            <button className="btn primary grow" onClick={() => { const t = note.to; setNote(null); jump(t, { push: true }) }}>Go to the note</button>
          </div>
        </>}
      </Sheet>
    </div>
  )
}

function renderText(b: Block, mark: Mark, onLink: (to: string) => void): ReactNode {
  const cuts = new Set<number>([0, b.t.length])
  b.l?.forEach((l) => { cuts.add(l.s); cuts.add(l.e) })
  if (mark) { cuts.add(mark.s); cuts.add(mark.e) }
  const pts = [...cuts].filter((x) => x >= 0 && x <= b.t.length).sort((x, y) => x - y)
  const out: ReactNode[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const s = pts[i], e = pts[i + 1]
    let node: ReactNode = b.t.slice(s, e)
    if (mark && s >= mark.s && e <= mark.e) node = <mark className="bk-mark">{node}</mark>
    const link = b.l?.find((l) => l.s <= s && l.e >= e)
    if (link) {
      const inner = isPlace(link.to)
      node = <a href={inner ? undefined : link.to} className={inner ? 'bk-link' : 'bk-link ext'} role="link" tabIndex={0}
        onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); onLink(link.to) }}>{node}</a>
    }
    out.push(<Fragment key={s}>{node}</Fragment>)
  }
  return out
}

function BlockView({ b, i, sel, marked, mark, onLink, onTap }: { b: Block; i: number; sel: boolean; marked: boolean; mark: Mark; onLink: (to: string) => void; onTap: () => void }) {
  const cls = `bk-b bk-${b.k}${sel ? ' sel' : ''}${marked ? ' marked' : ''}${mark ? ' found' : ''}`
  const props = { id: `bk-${i}`, 'data-b': i, className: cls, onClick: (e: React.MouseEvent) => { if (!getSelection()?.toString()) { e.stopPropagation(); onTap() } } }
  const kids = renderText(b, mark, onLink)
  switch (b.k) {
    case 'h1': return <h2 {...props}>{kids}</h2>
    case 'h2': return <h3 {...props}>{kids}</h3>
    case 'h3': return <h4 {...props}>{kids}</h4>
    case 'q': return <blockquote {...props}>{kids}</blockquote>
    case 'pre': return <pre {...props}>{kids}</pre>
    default: return <p {...props}>{kids}</p>
  }
}

function ChapterEnd({ chapters, ch, meta, onNext, onFinish }: { chapters: Chapter[]; ch: number; meta: BookMeta; onNext: () => void; onFinish: () => void }) {
  const next = chapters[ch + 1]
  if (next) return (
    <button className="bk-next" onClick={onNext}>
      <span className="bk-next-k">Next · Chapter {ch + 2}</span>
      <span className="bk-next-t">{next.title}</span>
      <ChevronRight size={22} className="bk-next-ic" />
    </button>
  )
  return (
    <div className="bk-end">
      <div className="bk-end-glyph">λ</div>
      <div className="bk-end-t">The end of {meta.title}</div>
      {!meta.done && <button className="btn primary" onClick={onFinish}>Mark as finished</button>}
    </div>
  )
}

function BottomBar({ meta, chapters, ch, progress, onPrev, onNext, onToc, onListen }: { meta: BookMeta; chapters: Chapter[]; ch: number; progress: number; onPrev: () => void; onNext: () => void; onToc: () => void; onListen: () => void }) {
  const s = useStore(listen)
  const left = Math.max(0, meta.words * (1 - progress))
  const mins = Math.round(left / 230)
  const fromHere = s.active && nowReadingFor(s.text)?.id === meta.id
  const timeLeft = mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min left` : `${Math.max(1, mins)} min left`
  return (
    <div className="bk-bar">
      <div className="bk-prog"><i style={{ width: `${progress * 100}%` }} /></div>
      <button className="icon-btn" onClick={onPrev} disabled={ch === 0} aria-label="Previous chapter"><ChevronLeft size={22} /></button>
      <button className="bk-bar-mid" onClick={onToc}>
        <b>{Math.round(progress * 100)}%</b>
        <span>{progress >= 0.995 ? 'Finished' : timeLeft} · {ch + 1}/{chapters.length}</span>
      </button>
      {fromHere
        ? <div className="bk-duo">
            <button className="bk-duo-play" onClick={toggle} aria-label={s.playing || s.buffering ? 'Pause' : 'Resume'}>{s.buffering ? <Loader2 size={17} className="spin" /> : s.playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button>
            <button className="bk-duo-go" onClick={() => { location.hash = '#/listen' }} aria-label="Follow the text in Listen"><AudioLines size={17} /> Follow</button>
          </div>
        : s.active && (s.playing || s.buffering)
        ? <button className="bk-listen" onClick={toggle} aria-label="Pause">{s.buffering ? <Loader2 size={17} className="spin" /> : <Pause size={17} fill="currentColor" />} Pause</button>
        : <button className="bk-listen" onClick={onListen} aria-label="Listen from here"><Play size={17} fill="currentColor" /> Listen</button>}
      <button className="icon-btn" onClick={onNext} disabled={ch >= chapters.length - 1} aria-label="Next chapter"><ChevronRight size={22} /></button>
    </div>
  )
}

function TocSheet({ open, onClose, meta, chapters, at, onGo }: { open: boolean; onClose: () => void; meta: BookMeta; chapters: Chapter[]; at: Pos; onGo: (p: Pos) => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={meta.title.length > 40 ? 'Contents' : meta.title}>
      <TocBody active={open} meta={meta} chapters={chapters} at={at} onGo={onGo} />
    </Sheet>
  )
}

/** Contents and bookmarks: inside the sheet on phones, pinned beside the text on a tablet. */
function TocBody({ active, meta, chapters, at, onGo, side = false }: { active: boolean; meta: BookMeta; chapters: Chapter[]; at: Pos; onGo: (p: Pos) => void; side?: boolean }) {
  const [tab, setTab] = useState<'toc' | 'marks'>('toc')
  const listRef = useRef<HTMLDivElement>(null)
  // The entry for where the reader is now: the last one at or before the place.
  const current = useMemo(() => {
    let k = -1
    meta.toc.forEach((t, i) => { if (t.ch < at.ch || (t.ch === at.ch && t.b <= at.b)) k = i })
    return k
  }, [meta.toc, at])
  useEffect(() => { if (active && tab === 'toc') setTimeout(() => listRef.current?.querySelector('.cur')?.scrollIntoView({ block: side ? 'nearest' : 'center' }), 60) }, [active, tab, side, current])
  const marks = [...(meta.bookmarks ?? [])].sort((a, b) => a.ch - b.ch || a.b - b.b)
  return (
    <>
      <div className="bk-toc-head">
        <BookCover meta={meta} small />
        <div className="grow" style={{ minWidth: 0 }}>
          {side && <div className="bk-side-title">{meta.title}</div>}
          {meta.author && <div className="bk-toc-author">{meta.author}</div>}
          <div className="bk-toc-stats">{chapters.length} chapters · {meta.words.toLocaleString()} words{meta.links ? ` · ${meta.links.toLocaleString()} links` : ''}</div>
          <Seg value={tab} onChange={setTab} options={[{ value: 'toc', label: 'Contents' }, { value: 'marks', label: `Bookmarks${marks.length ? ` ${marks.length}` : ''}` }]} />
        </div>
      </div>
      <div className="bk-toc" ref={listRef}>
        {tab === 'toc' ? meta.toc.map((t, i) => (
          <button key={i} className={`bk-toc-i lv${t.level} ${i === current ? 'cur' : ''}`} onClick={() => onGo({ ch: t.ch, b: t.b })}>
            <span className="grow">{t.title}</span>
            {t.level === 0 && <span className="bk-toc-n">{t.ch + 1}</span>}
          </button>
        )) : marks.length ? marks.map((m, i) => (
          <button key={i} className="bk-toc-i bk-mark-i" onClick={() => onGo({ ch: m.ch, b: m.b })}>
            <span className="grow"><small>{chapters[m.ch]?.title}</small>{m.text}</span>
          </button>
        )) : <p className="muted small" style={{ padding: '14px 6px' }}>Tap any paragraph, then the bookmark, to keep your place.</p>}
      </div>
    </>
  )
}

function SearchSheet({ open, onClose, chapters, initial, onPick }: { open: boolean; onClose: () => void; chapters: Chapter[]; initial: string; onPick: (q: string, hits: Hit[], i: number) => void }) {
  const [q, setQ] = useState(initial)
  const [dq, setDq] = useState(initial)
  const folded = useRef<string[][] | null>(null)
  useEffect(() => { if (open) setQ(initial) }, [open, initial])
  useEffect(() => { const t = setTimeout(() => setDq(q), 160); return () => clearTimeout(t) }, [q])
  const hits = useMemo(() => {
    const needle = fold(dq.trim())
    if (needle.length < 2) return []
    folded.current ??= chapters.map((c) => c.blocks.map((b) => fold(b.t)))
    const out: Hit[] = []
    folded.current.forEach((blocks, ch) => blocks.forEach((t, b) => {
      let k = t.indexOf(needle)
      while (k >= 0 && out.length < 500) { out.push({ ch, b, s: k, e: k + needle.length }); k = t.indexOf(needle, k + needle.length) }
    }))
    return out
  }, [dq, chapters])
  const chCount = new Set(hits.map((h) => h.ch)).size
  return (
    <Sheet open={open} onClose={onClose} title="Search">
      <label className="lib-search" style={{ marginBottom: 10 }}>
        <Search size={18} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Words, names, a phrase" aria-label="Search this book" enterKeyHint="search"
          onKeyDown={(e) => { if (e.key === 'Enter' && hits.length) onPick(dq.trim(), hits, 0) }} />
        {q && <button onClick={() => setQ('')} aria-label="Clear"><X size={16} /></button>}
      </label>
      {dq.trim().length >= 2 && <div className="bk-s-count">{hits.length ? `${hits.length >= 500 ? '500+' : hits.length} match${hits.length === 1 ? '' : 'es'} in ${chCount} chapter${chCount === 1 ? '' : 's'}` : 'No matches. Accents and capitals don’t matter.'}</div>}
      <div className="bk-s-list">
        {hits.slice(0, 120).map((h, i) => {
          const t = chapters[h.ch].blocks[h.b].t
          let a = Math.max(0, h.s - 60); if (a > 0) { const sp = t.indexOf(' ', a); if (sp >= 0 && sp < h.s) a = sp + 1 }
          let z = Math.min(t.length, h.e + 90); if (z < t.length) { const sp = t.lastIndexOf(' ', z); if (sp > h.e) z = sp }
          return (
            <button key={i} className="bk-s-i" onClick={() => onPick(dq.trim(), hits, i)}>
              <small>{chapters[h.ch].title}</small>
              <span>{t.slice(a, h.s)}<mark className="bk-mark">{t.slice(h.s, h.e)}</mark>{t.slice(h.e, z)}</span>
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
