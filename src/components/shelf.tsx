import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, BookPlus, Grid2x2, Grid3x3, Square, CircleCheck, MoreHorizontal, Pencil, Search, Star, Trash2, X, Pin, Clock } from 'lucide-react'
import { useStore } from '../lib/store.ts'
import { books, refreshBooks, updateBook, deleteBook, putBook, getContent, sweepTempBooks, type BookMeta, type Pos } from '../lib/books.ts'
import { importBook, BOOK_ACCEPT } from '../lib/book/import.ts'
import { setNowReading } from '../lib/book/nowreading.ts'
import { keepAsk, askKeep } from '../lib/book/keepask.ts'
import { drafts } from '../lib/drafts.ts'
import { loadText, play } from '../player/listen.ts'
import { MenuSelect, Sheet, toast } from './ui.tsx'
import { BookCover } from './bookcover.tsx'

type Sort = 'recent' | 'added' | 'title' | 'author' | 'progress'
type Filter = 'all' | 'reading' | 'new' | 'fav' | 'done'
const FILTERS: { id: Filter; label: string; test: (b: BookMeta) => boolean }[] = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'reading', label: 'Reading', test: (b) => !b.done && b.progress > 0.002 },
  { id: 'new', label: 'Not started', test: (b) => !b.done && b.progress <= 0.002 },
  { id: 'fav', label: 'Favorites', test: (b) => !!b.fav },
  { id: 'done', label: 'Finished', test: (b) => !!b.done },
]

export const openBook = (id: string) => { location.hash = `#/book/${encodeURIComponent(id)}` }

/** Import one or more book files, one after another; a single imported book opens in Listen and starts reading aloud. */
export async function importMany(list: File[]) {
  let last: BookMeta | null = null
  const addedList: BookMeta[] = []
  for (const [i, f] of list.entries()) {
    try { last = await importBook(f, list.length > 1 ? `${i + 1} of ${list.length}` : undefined); addedList.push(last); if (list.length === 1 && !last.warn) toast(`Added ${last.title}`) } catch (e) { toast((e as Error).message || `Couldn’t read ${f.name}`, undefined, 6000) }
  }
  const warn = addedList.find((b) => b.warn)?.warn
  if (warn) toast(warn, undefined, 9000)
  else if (list.length > 1 && addedList.length) toast(`Added ${addedList.length} book${addedList.length === 1 ? '' : 's'}`)
  if (last && list.length === 1) void playImported(last)
  askKeep(addedList)
}

/** Take a freshly imported book straight to Listen and read it from the beginning, text following along. */
async function playImported(meta: BookMeta) {
  const content = await getContent(meta.id)
  const chapters = content?.chapters ?? []
  const parts: string[] = []
  const where: Pos[] = []
  let n = 0
  for (let c = 0; c < chapters.length && n < 40000; c++) {
    const blocks = chapters[c].blocks
    for (let i = 0; i < blocks.length && n < 40000; i++) { parts.push(blocks[i].t); where.push({ ch: c, b: i }); n += blocks[i].t.length }
  }
  const text = parts.join('\n\n')
  if (!text.trim()) { openBook(meta.id); return }
  setNowReading(meta.id, meta.title, parts, where)
  void sweepTempBooks()
  drafts.set({ listen: text })
  loadText(text)
  void play()
  location.hash = '#/listen'
}

/** Pick and import one or more book files. */
export function useBookPicker() {
  const input = useRef<HTMLInputElement>(null)
  const onFiles = async (files: FileList | null) => {
    const list = Array.from(files ?? [])
    if (input.current) input.current.value = ''
    await importMany(list)
  }
  const el = <input ref={input} type="file" accept={BOOK_ACCEPT} multiple hidden onChange={(e) => void onFiles(e.target.files)} />
  return { pick: () => input.current?.click(), el }
}

type CoverSize = 's' | 'm' | 'l'
const SIZE_KEY = 'logos.shelfSize'
/** Phones start with the large covers (two a row), tablets with the medium ones. */
const loadSize = (): CoverSize => { const v = localStorage.getItem(SIZE_KEY); return v === 's' || v === 'm' || v === 'l' ? v : innerWidth <= 420 ? 'l' : 'm' }
const SIZES: { id: CoverSize; label: string; icon: React.ReactNode }[] = [
  { id: 's', label: 'Small covers', icon: <Grid3x3 size={15} /> },
  { id: 'm', label: 'Medium covers', icon: <Grid2x2 size={15} /> },
  { id: 'l', label: 'Large covers', icon: <Square size={14} /> },
]

export function BookShelf({ onPick }: { onPick: () => void }) {
  const [size, setSizeState] = useState<CoverSize>(loadSize)
  const setSize = (v: CoverSize) => { setSizeState(v); localStorage.setItem(SIZE_KEY, v) }
  const st = useStore(books)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const [filter, setFilter] = useState<Filter>('all')
  const [menu, setMenu] = useState<BookMeta | null>(null)
  const [renaming, setRenaming] = useState<BookMeta | null>(null)
  useEffect(() => { void refreshBooks() }, [])
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, st.list.filter(f.test).length])) as Record<Filter, number>, [st.list])
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase()
    const f = FILTERS.find((x) => x.id === filter)!
    const list = st.list.filter((b) => f.test(b) && (!n || `${b.title} ${b.author}`.toLowerCase().includes(n)))
    const by: Record<Sort, (a: BookMeta, b: BookMeta) => number> = {
      recent: (a, b) => (b.openedAt ?? b.addedAt) - (a.openedAt ?? a.addedAt), added: (a, b) => b.addedAt - a.addedAt,
      title: (a, b) => a.title.localeCompare(b.title), author: (a, b) => (a.author || '~').localeCompare(b.author || '~') || a.title.localeCompare(b.title),
      progress: (a, b) => b.progress - a.progress,
    }
    return list.sort(by[sort])
  }, [st.list, q, sort, filter])
  const reading = st.list.filter((b) => !b.done && b.progress > 0.002).sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0))[0]

  return (
    <div className="shelf">
      {st.importing && (
        <div className="card render-card">
          <span className="keep-ic"><BookPlus size={20} /></span>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="rc-title">Importing{st.importing.batch ? ` ${st.importing.batch}` : ''} · {st.importing.name}</div>
            <div className="rc-meta">{st.importing.step}{st.importing.total > 1 ? ` · ${st.importing.done} of ${st.importing.total}` : ''}</div>
            <div className="clip-bar" style={{ marginTop: 8 }}><i style={{ width: `${st.importing.total ? (st.importing.done / st.importing.total) * 100 : 0}%`, transition: 'width .3s var(--ease)' }} /></div>
          </div>
        </div>
      )}

      {st.loaded && !st.list.length && !st.importing ? (
        <div className="card empty">
          <div className="glyph">λ</div>
          <h3>Your bookshelf</h3>
          <p style={{ margin: '0 auto 18px', maxWidth: 340 }}>Import EPUB, PDF, Word, FB2, Markdown, text or web files. Each book gets its own contents, working links, search, and a voice to read it to you.</p>
          <button className="btn primary" onClick={onPick}><BookPlus size={18} /> Import a book</button>
        </div>
      ) : st.list.length > 0 && (
        <>
          {reading && !q && filter === 'all' && (
            <button className="card shelf-continue" onClick={() => openBook(reading.id)}>
              <BookCover meta={reading} small />
              <div className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
                <div className="clip-kicker"><BookOpen size={12} /><span className="ck-status prog">Continue reading</span></div>
                <div className="clip-title">{reading.title}</div>
                {reading.author && <div className="clip-sum">{reading.author}</div>}
                <div className="clip-bar" style={{ marginTop: 10 }}><i style={{ width: `${reading.progress * 100}%` }} /></div>
                <div className="clip-meta" style={{ marginTop: 6 }}><span>{Math.round(reading.progress * 100)}% read</span><span>{reading.toc[0] ? `${reading.chWords.length} chapters` : ''}</span></div>
              </div>
            </button>
          )}
          <label className="lib-search">
            <Search size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles and authors" aria-label="Search books" />
            {q && <button onClick={() => setQ('')} aria-label="Clear search"><X size={16} /></button>}
          </label>
          <div className="lib-filters" role="tablist" aria-label="Filter books">
            {FILTERS.filter((f) => f.id === 'all' || counts[f.id] > 0).map((f) => (
              <button key={f.id} role="tab" aria-selected={filter === f.id} className={`chip ${filter === f.id ? 'accent' : ''}`} onClick={() => setFilter(f.id)}>{f.label}<span className="lf-n">{counts[f.id]}</span></button>
            ))}
          </div>
          <div className="lib-sort">
            <span className="muted small">{shown.length} book{shown.length === 1 ? '' : 's'}</span>
            <div className="lib-sort-r">
              <div className="cover-size" role="radiogroup" aria-label="Cover size">
                {SIZES.map((z) => <button key={z.id} role="radio" aria-checked={size === z.id} aria-label={z.label} title={z.label} className={size === z.id ? 'on' : ''} onClick={() => setSize(z.id)}>{z.icon}</button>)}
              </div>
              <MenuSelect value={sort} onChange={setSort} label="Sort books" options={[
                { value: 'recent', label: 'Recently read' }, { value: 'added', label: 'Recently added' }, { value: 'title', label: 'Title' }, { value: 'author', label: 'Author' }, { value: 'progress', label: 'Progress' },
              ]} />
            </div>
          </div>
          <div className={`shelf-grid size-${size}`}>
            {shown.map((b) => <BookTile key={b.id} b={b} sort={sort} onMore={() => setMenu(b)} />)}
            <button className="shelf-add" onClick={onPick} aria-label="Import a book"><BookPlus size={26} /><span>Import</span></button>
          </div>
        </>
      )}

      <BookMenu b={menu} onClose={() => setMenu(null)} onRename={(b) => { setMenu(null); setRenaming(b) }} />
      <RenameBook b={renaming} onClose={() => setRenaming(null)} />
    </div>
  )
}

/** When a book was last read (or added): "Today", "Yesterday", "3 d ago", or "Nov 2". */
const whenRead = (ts: number) => {
  const d = new Date(ts); const now = new Date()
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function BookTile({ b, sort, onMore }: { b: BookMeta; sort: Sort; onMore: () => void }) {
  const press = useRef<number | null>(null)
  const long = useRef(false)
  const start = () => { long.current = false; press.current = window.setTimeout(() => { long.current = true; onMore() }, 480) }
  const end = () => { if (press.current) clearTimeout(press.current); press.current = null }
  const pct = Math.round(b.progress * 100)
  return (
    <div className={`book-tile ${b.done ? 'is-done' : ''}`}>
      <button className="book-tile-cover" onClick={() => { if (!long.current) openBook(b.id) }} onPointerDown={start} onPointerUp={end} onPointerLeave={end} onPointerCancel={end}
        onContextMenu={(e) => { e.preventDefault(); onMore() }} aria-label={`Open ${b.title}`}>
        <BookCover meta={b} />
        <span className="book-fmt">{b.format.toUpperCase()}</span>
        {b.fav && <span className="book-fav"><Star size={13} fill="currentColor" /></span>}
        <span className={`book-temp ${b.temp ? 'is-temp' : ''}`} role="button" aria-label={b.temp ? `Keep ${b.title}` : `Keep ${b.title} only once`} title={b.temp ? 'Keep this book' : 'Only once — removed when you move to another book'} onClick={(e) => { e.stopPropagation(); void updateBook(b.id, { temp: !b.temp }) }}>{b.temp ? <><Pin size={11} /> Keep</> : <><Clock size={11} /> Once</>}</span>
        <span className="book-prog"><i style={{ width: `${b.done ? 100 : pct}%` }} /></span>
      </button>
      <div className="book-tile-info">
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="book-tile-title">{b.title}</div>
          <div className="book-tile-sub">{b.done ? 'Finished' : pct > 0 ? `${pct}%` : 'New'}{sort === 'recent' ? ` · ${whenRead(b.openedAt ?? b.addedAt)}` : ''}{b.author ? ` · ${b.author}` : ''}</div>
        </div>
        <button className="icon-btn book-more" onClick={onMore} aria-label={`More for ${b.title}`}><MoreHorizontal size={18} /></button>
      </div>
    </div>
  )
}

/** After an import: five seconds to say Keep, or the books stay "for now". */
export function KeepAskSheet() {
  const { ask } = useStore(keepAsk)
  const [left, setLeft] = useState(5)
  useEffect(() => {
    if (!ask) return
    setLeft(5)
    const t0 = Date.now()
    const iv = setInterval(() => {
      const s = 5 - Math.floor((Date.now() - t0) / 1000)
      if (s <= 0) { clearInterval(iv); keepAsk.set({ ask: null }) } else setLeft(s)
    }, 200)
    return () => clearInterval(iv)
  }, [ask])
  if (!ask) return null
  const keep = () => { for (const id of ask.ids) void updateBook(id, { temp: false }, false); void refreshBooks(); keepAsk.set({ ask: null }) }
  const forNow = () => keepAsk.set({ ask: null })
  const one = ask.titles.length === 1
  return (
    <Sheet open onClose={forNow} title={one ? 'Keep this book?' : `Keep these ${ask.titles.length} books?`}>
      <p className="keepask-body"><b>Keep</b> saves it. <b>Once</b> removes it when you move to another book.</p>
      <div className="keepask-bar"><i key={ask.ids.join(',')} style={{ animationDuration: '5s' }} /></div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn ghost grow" onClick={forNow}>Once · {left}</button>
        <button className="btn primary grow" onClick={keep}><Pin size={16} /> Keep</button>
      </div>
    </Sheet>
  )
}

function BookMenu({ b, onClose, onRename }: { b: BookMeta | null; onClose: () => void; onRename: (b: BookMeta) => void }) {
  if (!b) return null
  const run = (fn: () => void | Promise<void>) => () => { onClose(); void fn() }
  const remove = async () => {
    const gone = await deleteBook(b.id)
    if (gone) toast('Book deleted', { label: 'Undo', run: () => { void putBook(gone.meta, gone.content) } }, 6000)
  }
  return (
    <Sheet open onClose={onClose} title={b.title.length > 34 ? 'Book' : b.title}>
      <div className="menu-list">
        <button onClick={run(() => openBook(b.id))}><BookOpen size={20} /> {b.progress > 0.002 ? 'Continue reading' : 'Start reading'}</button>
        <button onClick={run(() => updateBook(b.id, { fav: !b.fav }, false))}><Star size={20} /> {b.fav ? 'Remove from favorites' : 'Add to favorites'}</button>
        <button onClick={run(() => updateBook(b.id, { temp: !b.temp }, false))}>{b.temp ? <Pin size={20} /> : <Clock size={20} />} {b.temp ? 'Keep this book' : 'Only once'}</button>
        <button onClick={run(() => updateBook(b.id, b.done ? { done: false } : { done: true, progress: 1 }, false))}><CircleCheck size={20} /> {b.done ? 'Mark as not finished' : 'Mark as finished'}</button>
        {b.progress > 0 && <button onClick={run(() => updateBook(b.id, { pos: { ch: 0, b: 0 }, progress: 0, done: false }, false))}><BookOpen size={20} /> Start over</button>}
        <button onClick={() => onRename(b)}><Pencil size={20} /> Rename</button>
        <button className="danger" onClick={run(remove)}><Trash2 size={20} /> Delete</button>
      </div>
    </Sheet>
  )
}

function RenameBook({ b, onClose }: { b: BookMeta | null; onClose: () => void }) {
  const [t, setT] = useState('')
  const [a, setA] = useState('')
  useEffect(() => { if (b) { setT(b.title); setA(b.author) } }, [b])
  if (!b) return null
  const save = () => { if (t.trim()) void updateBook(b.id, { title: t.trim(), author: a.trim() }, false); onClose() }
  return (
    <Sheet open onClose={onClose} title="Rename">
      <input className="text-input" value={t} onChange={(e) => setT(e.target.value)} placeholder="Title" aria-label="Title" autoFocus />
      <input className="text-input" style={{ marginTop: 8 }} value={a} onChange={(e) => setA(e.target.value)} placeholder="Author" aria-label="Author" onKeyDown={(e) => { if (e.key === 'Enter') save() }} />
      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button className="btn ghost grow" onClick={onClose}>Cancel</button>
        <button className="btn primary grow" onClick={save} disabled={!t.trim()}>Save</button>
      </div>
    </Sheet>
  )
}
