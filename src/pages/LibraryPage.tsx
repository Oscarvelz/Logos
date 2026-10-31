import { useEffect, useState } from 'react'
import { ArrowDownToLine, AudioLines, Pause, Play, Share2, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store.ts'
import { library, refreshLibrary, getClip, deleteClip, restoreClip, type ClipMeta } from '../lib/library.ts'
import { clipPlayer, playClip, seekClip, pauseClip } from '../player/clip.ts'
import { downloadBlob, formatBytes, slugify } from '../lib/audio.ts'
import { formatDuration } from '../lib/text.ts'
import { voiceById } from '../lib/voices.ts'
import { drafts } from '../lib/drafts.ts'
import { navigate } from '../lib/router.ts'
import { loadText } from '../player/listen.ts'
import { toast } from '../components/ui.tsx'

export function LibraryPage() {
  const lib = useStore(library)
  const [query, setQuery] = useState('')
  useEffect(() => { void refreshLibrary() }, [])
  const total = lib.clips.reduce((n, c) => n + c.size, 0)
  const shown = query ? lib.clips.filter((c) => (c.title + ' ' + c.text).toLowerCase().includes(query.toLowerCase())) : lib.clips

  return (
    <div className="page wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Library</h1>
          <p className="page-sub">{lib.clips.length ? `${lib.clips.length} clip${lib.clips.length === 1 ? '' : 's'} · ${formatBytes(total)} on this device` : 'Everything you render lives here, offline.'}</p>
        </div>
      </div>

      {lib.clips.length > 3 && (
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clips" aria-label="Search clips"
          style={{ width: '100%', height: 48, borderRadius: 99, border: '1px solid var(--line)', background: 'var(--surface)', padding: '0 18px', outline: 'none', marginBottom: 14 }} />
      )}

      {lib.loaded && lib.clips.length === 0 ? (
        <div className="card empty">
          <div className="glyph">λ</div>
          <h3>No clips yet</h3>
          <p style={{ margin: '0 auto 18px', maxWidth: 320 }}>Render text into audio on the Create page and it will be saved here for replay and download.</p>
          <button className="btn primary" onClick={() => navigate('create')}>Create your first clip</button>
        </div>
      ) : (
        <div className="clips">
          {shown.map((c) => <ClipCard key={c.id} clip={c} />)}
        </div>
      )}
    </div>
  )
}

function ClipCard({ clip }: { clip: ClipMeta }) {
  const cp = useStore(clipPlayer)
  const key = `clip:${clip.id}`
  const active = cp.key === key
  const playing = active && cp.playing
  const progress = active && cp.duration ? cp.time / cp.duration : 0
  const v = voiceById(clip.voice)
  const filename = `${slugify(clip.title)}.${clip.format}`

  const play = async () => {
    if (active) { void playClip(key, '', { title: clip.title }); return }
    const full = await getClip(clip.id)
    if (full) void playClip(key, full.blob, { title: clip.title, artist: `Logos · ${v?.name ?? ''}` })
  }
  const download = async () => {
    const full = await getClip(clip.id)
    if (full) downloadBlob(full.blob, filename)
  }
  const share = async () => {
    const full = await getClip(clip.id)
    if (!full) return
    const file = new File([full.blob], filename, { type: full.blob.type })
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: clip.title }) } catch { /* cancelled */ }
    } else downloadBlob(full.blob, filename)
  }
  const remove = async () => {
    const full = await getClip(clip.id)
    if (active) pauseClip()
    await deleteClip(clip.id)
    if (full) toast('Clip deleted', { label: 'Undo', run: () => { void restoreClip(full) } }, 5000)
  }
  const listenAgain = () => {
    drafts.set({ listen: clip.text })
    loadText(clip.text)
    navigate('listen')
  }

  return (
    <div className="card clip">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <button className="mini-play" style={{ width: 52, height: 52 }} onClick={play} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" style={{ marginLeft: 2 }} />}
        </button>
        <div className="grow">
          <div className="clip-title">{clip.title}</div>
          <div className="clip-meta">
            <span>{v?.name ?? 'Voice'}</span>
            <span className="mono">{active && cp.duration ? `${formatDuration(cp.time)} / ` : ''}{formatDuration(clip.duration)}</span>
            <span>{clip.format.toUpperCase()} · {formatBytes(clip.size)}</span>
            <span>{new Date(clip.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          </div>
        </div>
      </div>
      <div className="row" style={{ gap: 2 }}>
        <div className="clip-bar grow" role="slider" aria-label="Seek" aria-valuenow={Math.round(progress * 100)} style={{ marginRight: 8 }}
          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); if (active) seekClip((e.clientX - r.left) / r.width) }}>
          <i style={{ width: `${progress * 100}%` }} />
        </div>
        <button className="icon-btn" onClick={listenAgain} aria-label="Open in Listen" title="Open in Listen"><AudioLines size={20} /></button>
        <button className="icon-btn" onClick={share} aria-label="Share" title="Share"><Share2 size={20} /></button>
        <button className="icon-btn" onClick={download} aria-label="Download" title="Download"><ArrowDownToLine size={20} /></button>
        <button className="icon-btn" onClick={remove} aria-label="Delete" title="Delete" style={{ color: 'var(--danger)' }}><Trash2 size={20} /></button>
      </div>
    </div>
  )
}
