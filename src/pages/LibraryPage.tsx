import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, AudioLines, ExternalLink, Globe, Check, CheckCheck, CircleCheck, Clock, FileAudio, MoreHorizontal, Pause, Pencil, Play, Plus, Search, Share2, Square, Star, Trash2, Upload, X } from 'lucide-react'
import { useStore } from '../lib/store.ts'
import { library, refreshLibrary, getClip, deleteClips, restoreClips, updateClip, importAudio, kindOf, type ClipMeta } from '../lib/library.ts'
import { clipPlayer, playClip, seekClip, pauseClip } from '../player/clip.ts'
import { exportJob, queueExport, cancelItem, cancelExport, isQueued } from '../player/exporter.ts'
import { downloadBlob, formatBytes, slugify } from '../lib/audio.ts'
import { formatDuration, wordCount } from '../lib/text.ts'
import { voiceById } from '../lib/voices.ts'
import { settings } from '../lib/settings.ts'
import { drafts } from '../lib/drafts.ts'
import { navigate } from '../lib/router.ts'
import { loadText, play as listenPlay } from '../player/listen.ts'
import { MenuSelect, Sheet, Seg, toast, useMediaQuery, confirmDelete } from '../components/ui.tsx'
import { BookShelf, useBookPicker, importMany } from '../components/shelf.tsx'
import { takeSharedFiles } from '../lib/book/import.ts'
import { books } from '../lib/books.ts'
import { WebImport } from '../components/webimport.tsx'
import { MarksSection } from '../components/marks.tsx'

type Filter = 'all' | 'later' | 'new' | 'progress' | 'fav' | 'done'
type Sort = 'new' | 'old' | 'long' | 'short' | 'az'

const FILTERS: { id: Filter; label: string; test: (c: ClipMeta) => boolean }[] = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'later', label: 'Listen later', test: (c) => kindOf(c) === 'text' && !c.done },
  { id: 'new', label: 'New', test: (c) => kindOf(c) === 'audio' && !c.done && !c.pos },
  { id: 'progress', label: 'In progress', test: (c) => !c.done && !!c.pos && c.pos > 1 },
  { id: 'fav', label: 'Favorites', test: (c) => !!c.fav },
  { id: 'done', label: 'Finished', test: (c) => !!c.done },
]
const SORTS: { id: Sort; label: string }[] = [
  { id: 'new', label: 'Newest' }, { id: 'old', label: 'Oldest' }, { id: 'long', label: 'Longest' }, { id: 'short', label: 'Shortest' }, { id: 'az', label: 'A–Z' },
]

async function removeWithUndo(ids: string[], askTitle: string, askBody?: string): Promise<boolean> {
  if (!await confirmDelete(askTitle, askBody)) return false
  const key = clipPlayer.get().key
  if (key && ids.includes(key.slice(5))) pauseClip()
  ids.forEach((id) => cancelItem(id))
  const gone = await deleteClips(ids)
  if (gone.length) toast(`${gone.length === 1 ? 'Deleted' : `${gone.length} deleted`}`, { label: 'Undo', run: () => { void restoreClips(gone) } }, 6000)
  return gone.length > 0
}

function makeAudio(c: ClipMeta) {
  const st = settings.get()
  const r = queueExport(c.text, { voice: c.voice || st.voiceOverride, speed: Math.min(2, Math.max(0.6, st.listenSpeed)), format: st.format, origin: 'listen', id: c.id })
  toast(r === 'queued' ? 'Queued · it starts after the current one' : 'Making the audio…')
}

function openInListen(c: ClipMeta, autoplay = false) {
  drafts.set({ listen: c.text })
  loadText(c.text)
  navigate('listen')
  if (autoplay) setTimeout(() => void listenPlay(), 350)
}

export function LibraryPage() {
  const lib = useStore(library)
  const job = useStore(exportJob)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('new')
  const [selecting, setSelecting] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<ClipMeta | null>(null)
  const [renaming, setRenaming] = useState<ClipMeta | null>(null)
  const [adding, setAdding] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const [shelf, setShelfState] = useState<'saved' | 'books'>(() => (location.hash.includes('books') || localStorage.getItem('logos.shelf') === 'books' ? 'books' : 'saved'))
  const setShelf = (v: 'saved' | 'books') => { setShelfState(v); localStorage.setItem('logos.shelf', v); endSelect() }
  const bk = useStore(books)
  const big = useMediaQuery('(min-width: 1500px)')
  const picker = useBookPicker()
  useEffect(() => { void refreshLibrary() }, [])
  // Books shared from another app (share sheet): import them all, one after another.
  useEffect(() => { void takeSharedFiles().then((files) => { if (files.length) { setShelf('books'); void importMany(files) } }) }, [])
  useEffect(() => { if (job.status === 'done' || job.status === 'idle') void refreshLibrary() }, [job.status])

  const total = lib.clips.reduce((n, c) => n + c.size, 0)
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, lib.clips.filter(f.test).length])) as Record<Filter, number>, [lib.clips])
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const f = FILTERS.find((x) => x.id === filter)!
    const list = lib.clips.filter((c) => f.test(c) && (!q || (c.title + ' ' + (c.summary ?? '') + ' ' + c.text).toLowerCase().includes(q)))
    const by: Record<Sort, (a: ClipMeta, b: ClipMeta) => number> = {
      new: (a, b) => b.createdAt - a.createdAt, old: (a, b) => a.createdAt - b.createdAt,
      long: (a, b) => b.duration - a.duration, short: (a, b) => a.duration - b.duration, az: (a, b) => a.title.localeCompare(b.title),
    }
    return list.sort(by[sort])
  }, [lib.clips, filter, sort, query])

  const toggleSel = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const endSelect = () => { setSelecting(false); setSel(new Set()) }
  const bulk = async (patch: Partial<ClipMeta>) => { for (const id of sel) await updateClip(id, patch, false); await refreshLibrary(); endSelect() }
  const allSelected = shown.length > 0 && shown.every((c) => sel.has(c.id))

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    let n = 0
    for (const f of Array.from(files)) { if (f.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|opus|flac|webm)$/i.test(f.name)) { await importAudio(f); n++ } }
    toast(n ? `Added ${n} audio file${n === 1 ? '' : 's'}` : 'That file isn’t audio')
    if (file.current) file.current.value = ''
  }

  const savedPart = (<>
      <MarksSection />
      {job.status === 'running' && (
        <div className="card render-card">
          <span className="keep-ic"><AudioLines size={20} /></span>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="rc-title">Making audio · {job.title}</div>
            <div className="rc-meta">{job.done} of {job.total} sentences{job.queued ? ` · ${job.queued} more waiting` : ''}</div>
            <div className="clip-bar" style={{ marginTop: 8 }}><i style={{ width: `${job.total ? (job.done / job.total) * 100 : 0}%`, transition: 'width .4s var(--ease)' }} /></div>
          </div>
          <button className="icon-btn" onClick={cancelExport} aria-label="Stop making this audio" title="Stop"><Square size={18} /></button>
        </div>
      )}

      {lib.clips.length > 0 && (
        <>
          <label className="lib-search">
            <Search size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search titles and text" aria-label="Search the Library" />
            {query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={16} /></button>}
          </label>
          <div className="lib-filters" role="tablist" aria-label="Filter">
            {FILTERS.filter((f) => f.id === 'all' || counts[f.id] > 0).map((f) => (
              <button key={f.id} role="tab" aria-selected={filter === f.id} className={`chip ${filter === f.id ? 'accent' : ''}`} onClick={() => setFilter(f.id)}>
                {f.label}<span className="lf-n">{counts[f.id]}</span>
              </button>
            ))}
          </div>
          <div className="lib-sort">
            <span className="muted small">{shown.length} shown</span>
            <MenuSelect value={sort} onChange={setSort} label="Sort" options={SORTS.map((s) => ({ value: s.id, label: s.label }))} />
          </div>
        </>
      )}

      {lib.loaded && lib.clips.length === 0 ? (
        <div className="card empty">
          <div className="glyph">λ</div>
          <h3>Nothing saved yet</h3>
          <p style={{ margin: '0 auto 18px', maxWidth: 330 }}>Bring in any web page as clean text, save what you hear on Listen, or add audio files from your phone.</p>
          <div className="row" style={{ justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={() => setAdding(true)}><Globe size={18} /> From a web page</button>
            <button className="btn" onClick={() => file.current?.click()}><Upload size={18} /> Add audio</button>
          </div>
        </div>
      ) : shown.length === 0 && lib.loaded ? (
        <div className="card empty" style={{ padding: '32px 20px' }}><p style={{ margin: 0 }}>Nothing here{query ? ' matches your search' : ''}.</p></div>
      ) : (
        <div className="clips">
          {shown.map((c) => (
            <ClipCard key={c.id} clip={c} selecting={selecting} selected={sel.has(c.id)} onSelect={() => toggleSel(c.id)}
              onLongPress={() => { setSelecting(true); toggleSel(c.id) }} onMore={() => setMenu(c)} />
          ))}
        </div>
      )}

      {selecting && (
        <div className="sel-bar" role="toolbar" aria-label="Selection">
          <button className="btn sm ghost" onClick={() => setSel(allSelected ? new Set() : new Set(shown.map((c) => c.id)))}>{allSelected ? 'None' : 'All'}</button>
          <span className="sel-n">{sel.size} selected</span>
          <button className="icon-btn" disabled={!sel.size} onClick={() => void bulk({ fav: true })} aria-label="Add to favorites" title="Favorite"><Star size={20} /></button>
          <button className="icon-btn" disabled={!sel.size} onClick={() => void bulk({ done: true, pos: 0 })} aria-label="Mark finished" title="Mark finished"><CheckCheck size={20} /></button>
          <button className="icon-btn" disabled={!sel.size} style={{ color: 'var(--danger)' }} onClick={() => { const n = sel.size; void removeWithUndo([...sel], n === 1 ? 'Delete this file?' : `Delete ${n} files?`, 'The selected files will be removed from your library.').then((ok) => { if (ok) endSelect() }) }} aria-label="Delete selected" title="Delete"><Trash2 size={20} /></button>
        </div>
      )}

  </>)

  return (
    <div className={`page wide library-page ${selecting ? 'selecting' : ''}`}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Library</h1>
          <p className="page-sub">{shelf === 'books'
            ? (bk.list.length ? `${bk.list.length} book${bk.list.length === 1 ? '' : 's'} on this device` : 'Your books, with contents, links and search.')
            : lib.clips.length ? `${lib.clips.length} item${lib.clips.length === 1 ? '' : 's'}${total ? ` · ${formatBytes(total)} on this device` : ''}` : 'Saved audio and texts to hear later, offline.'}</p>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {shelf === 'saved' && lib.clips.length > 0 && <button className="btn sm ghost" onClick={() => (selecting ? endSelect() : setSelecting(true))}>{selecting ? 'Done' : 'Select'}</button>}
          <button className="icon-btn filled" onClick={() => (shelf === 'books' ? picker.pick() : setAdding(true))} aria-label={shelf === 'books' ? 'Import a book' : 'Add to Library'} title={shelf === 'books' ? 'Import a book' : 'Add a web page, book or audio'}><Plus size={20} /></button>
          <input ref={file} type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.opus,.flac" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
          {picker.el}
        </div>
      </div>
      {!big && <div className="shelf-tabs">
        <Seg value={shelf} onChange={setShelf} label="Shelf" options={[{ value: 'saved', label: <>Saved{lib.clips.length ? <span className="lf-n">{lib.clips.length}</span> : null}</> }, { value: 'books', label: <>Books{bk.list.length ? <span className="lf-n">{bk.list.length}</span> : null}</> }]} />
      </div>}
      {big ? (
        <div className="lib-split">
          <section className="lib-col"><div className="lib-col-head"><span>Saved</span>{lib.clips.length ? <span className="lf-n">{lib.clips.length}</span> : null}</div>{savedPart}</section>
          <section className="lib-col"><div className="lib-col-head"><span>Books</span>{bk.list.length ? <span className="lf-n">{bk.list.length}</span> : null}<button className="btn sm ghost lib-col-add" onClick={picker.pick}>Import a book</button></div><BookShelf onPick={picker.pick} /></section>
        </div>
      ) : shelf === 'books' ? <BookShelf onPick={picker.pick} /> : savedPart}
      <ItemMenu clip={menu} onClose={() => setMenu(null)} onRename={(c) => { setMenu(null); setRenaming(c) }} />
      <RenameSheet clip={renaming} onClose={() => setRenaming(null)} />
      <WebImport open={adding} onClose={() => setAdding(false)} onAudioFile={() => file.current?.click()} onBookFile={() => { setShelf('books'); picker.pick() }} />
    </div>
  )
}

function ClipCard({ clip, selecting, selected, onSelect, onLongPress, onMore }: { clip: ClipMeta; selecting: boolean; selected: boolean; onSelect: () => void; onLongPress: () => void; onMore: () => void }) {
  const cp = useStore(clipPlayer)
  const job = useStore(exportJob)
  const key = `clip:${clip.id}`
  const active = cp.key === key
  const playing = active && cp.playing
  const isText = kindOf(clip) === 'text'
  const rendering = job.status === 'running' && job.itemId === clip.id
  const waiting = !rendering && isText && isQueued(clip.id)
  const pos = active ? cp.time : clip.pos ?? 0
  const progress = clip.done && !active ? 1 : clip.duration ? Math.min(1, pos / clip.duration) : 0
  const v = voiceById(clip.voice)
  const press = useRef<number | null>(null)

  const play = async () => {
    if (active) { void playClip(key, '', { title: clip.title }); return }
    const full = await getClip(clip.id)
    if (full?.blob) void playClip(key, full.blob, { title: clip.title, artist: `Logos · ${v?.name ?? 'Library'}` }, clip.done ? 0 : clip.pos ?? 0)
    if (clip.done) void updateClip(clip.id, { done: false }, false)
  }
  const status = clip.done ? 'Finished' : isText ? (rendering ? `Making audio · ${job.done}/${job.total}` : waiting ? 'Waiting to make audio' : 'Listen later') : pos > 1 ? `${formatDuration(Math.max(0, clip.duration - pos))} left` : 'New'
  const startPress = () => { if (!selecting) press.current = window.setTimeout(() => { press.current = null; onLongPress() }, 480) }
  const endPress = () => { if (press.current) { clearTimeout(press.current); press.current = null } }

  return (
    <div className={`card clip ${selected ? 'sel' : ''} ${clip.done ? 'is-done' : ''}`} onClick={selecting ? onSelect : undefined}
      onPointerDown={startPress} onPointerUp={endPress} onPointerLeave={endPress} onPointerCancel={endPress} onContextMenu={(e) => { if (!selecting) { e.preventDefault(); onLongPress() } }}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
        {selecting ? (
          <span className={`sel-box ${selected ? 'on' : ''}`} aria-hidden>{selected && <Check size={16} />}</span>
        ) : isText ? (
          <button className="mini-play text" onClick={() => openInListen(clip, true)} aria-label="Listen now"><Play size={20} fill="currentColor" style={{ marginLeft: 2 }} /></button>
        ) : (
          <button className="mini-play" onClick={play} aria-label={playing ? 'Pause' : pos > 1 && !clip.done ? 'Resume' : 'Play'}>
            {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" style={{ marginLeft: 2 }} />}
          </button>
        )}
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="clip-kicker">
            {clip.url && isText ? <Globe size={12} /> : isText ? <Clock size={12} /> : clip.source === 'import' ? <FileAudio size={12} /> : <AudioLines size={12} />}
            <span className={`ck-status ${clip.done ? 'done' : isText ? 'later' : pos > 1 ? 'prog' : 'new'}`}>{status}</span>
          </div>
          <div className="clip-title">{clip.title}</div>
          {clip.summary && <div className="clip-sum">{clip.summary}</div>}
          <div className="clip-meta">
            {isText ? <span>{wordCount(clip.text).toLocaleString()} words · about {formatDuration(clip.duration)}</span>
              : <span className="mono">{active && cp.duration ? `${formatDuration(cp.time)} / ` : ''}{formatDuration(clip.duration)}</span>}
            {clip.site && <span className="clip-site"><Globe size={11} /> {clip.site}</span>}
            {v && <span>{v.name}</span>}
            {!isText && <span>{clip.format.toUpperCase()} · {formatBytes(clip.size)}</span>}
            <span>{new Date(clip.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          </div>
        </div>
        {!selecting && (
          <div className="clip-side">
            <button className={`icon-btn fav-btn ${clip.fav ? 'on' : ''}`} onClick={() => void updateClip(clip.id, { fav: !clip.fav }, false)} aria-label={clip.fav ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={!!clip.fav}>
              <Star size={19} fill={clip.fav ? 'currentColor' : 'none'} />
            </button>
            <button className="icon-btn" onClick={onMore} aria-label="More actions"><MoreHorizontal size={20} /></button>
          </div>
        )}
      </div>
      {!isText ? (
        <div className="clip-bar" role="slider" aria-label="Seek" aria-valuenow={Math.round(progress * 100)}
          onClick={(e) => { if (selecting) return; const r = e.currentTarget.getBoundingClientRect(); if (active) seekClip((e.clientX - r.left) / r.width) }}>
          <i style={{ width: `${progress * 100}%` }} />
        </div>
      ) : !selecting && (
        <div className="row clip-actions">
          <button className="btn sm" onClick={() => openInListen(clip, true)}><Play size={15} fill="currentColor" /> Listen now</button>
          {rendering || waiting
            ? <button className="btn sm ghost" onClick={() => cancelItem(clip.id)}><Square size={14} /> Stop</button>
            : <button className="btn sm ghost" onClick={() => makeAudio(clip)}><AudioLines size={15} /> Make audio</button>}
        </div>
      )}
      {rendering && <div className="clip-bar"><i style={{ width: `${job.total ? (job.done / job.total) * 100 : 0}%`, transition: 'width .4s var(--ease)' }} /></div>}
    </div>
  )
}

function ItemMenu({ clip, onClose, onRename }: { clip: ClipMeta | null; onClose: () => void; onRename: (c: ClipMeta) => void }) {
  if (!clip) return null
  const isText = kindOf(clip) === 'text'
  const filename = `${slugify(clip.title)}.${clip.format}`
  const run = (fn: () => void | Promise<void>) => () => { onClose(); void fn() }
  const download = async () => { const f = await getClip(clip.id); if (f?.blob) downloadBlob(f.blob, filename) }
  const share = async () => {
    const f = await getClip(clip.id)
    if (!f?.blob) return
    const file = new File([f.blob], filename, { type: f.blob.type })
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: clip.title }) } catch { /* cancelled */ } } else downloadBlob(f.blob, filename, true)
  }
  return (
    <Sheet open onClose={onClose} title={clip.title.length > 34 ? 'Options' : clip.title}>
      <div className="menu-list">
        {clip.text && <button onClick={run(() => openInListen(clip))}><AudioLines size={20} /> Open in Listen</button>}
        {isText && <button onClick={run(() => makeAudio(clip))}><FileAudio size={20} /> Make audio</button>}
        <button onClick={run(() => updateClip(clip.id, clip.done ? { done: false } : { done: true, pos: 0 }, false))}><CircleCheck size={20} /> {clip.done ? 'Mark as not finished' : 'Mark as finished'}</button>
        {!isText && !!clip.pos && !clip.done && <button onClick={run(() => updateClip(clip.id, { pos: 0 }, false))}><Clock size={20} /> Start over next time</button>}
        {clip.url && <button onClick={run(() => { window.open(clip.url, '_blank', 'noopener') })}><ExternalLink size={20} /> Open the web page</button>}
        <button onClick={() => onRename(clip)}><Pencil size={20} /> Rename</button>
        {!isText && <button onClick={run(download)}><ArrowDownToLine size={20} /> Download {clip.format.toUpperCase()}</button>}
        {!isText && <button onClick={run(share)}><Share2 size={20} /> Share</button>}
        <button className="danger" onClick={run(async () => { await removeWithUndo([clip.id], 'Delete this file?', `“${clip.title.length > 90 ? clip.title.slice(0, 90) + '…' : clip.title}” will be removed from your library.`) })}><Trash2 size={20} /> Delete</button>
      </div>
    </Sheet>
  )
}

function RenameSheet({ clip, onClose }: { clip: ClipMeta | null; onClose: () => void }) {
  const [v, setV] = useState('')
  useEffect(() => { if (clip) setV(clip.title) }, [clip])
  if (!clip) return null
  const save = () => { const t = v.trim(); if (t && t !== clip.title) void updateClip(clip.id, { title: t }, false); onClose() }
  return (
    <Sheet open onClose={onClose} title="Rename">
      <input className="text-input" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save() }} autoFocus aria-label="Title" />
      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button className="btn ghost grow" onClick={onClose}>Cancel</button>
        <button className="btn primary grow" onClick={save} disabled={!v.trim()}>Save</button>
      </div>
    </Sheet>
  )
}
