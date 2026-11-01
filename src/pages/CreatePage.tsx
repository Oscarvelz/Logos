import { useState } from 'react'
import { ArrowDownToLine, ClipboardPaste, Library, Pause, Play, RotateCcw, Share2, Sparkles, Square, Wand2 } from 'lucide-react'
import { useStore } from '../lib/store.ts'
import { drafts } from '../lib/drafts.ts'
import { settings } from '../lib/settings.ts'
import { detectLang, estimateSeconds, formatDuration, wordCount } from '../lib/text.ts'
import { VOICES, voiceById, LANG_LABEL, type Lang } from '../lib/voices.ts'
import { exportJob, runExport, cancelExport, resetExport, titleFrom } from '../player/exporter.ts'
import { clipPlayer, playClip, seekClip } from '../player/clip.ts'
import { downloadBlob, formatBytes, slugify } from '../lib/audio.ts'
import { engine, MODEL_SIZE_MB, POCKET_SIZE_MB } from '../engine/engine.ts'
import { EngineNote, VoicePicker } from '../components/chrome.tsx'
import { Avatar, Range, Seg, toast } from '../components/ui.tsx'
import { navigate } from '../lib/router.ts'

export function CreatePage() {
  const d = useStore(drafts)
  const st = useStore(settings)
  const job = useStore(exportJob)
  const e = useStore(engine)
  const [voice, setVoice] = useState<string | null>(st.voiceOverride)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [title, setTitle] = useState('')
  const text = d.create

  const detected = detectLang(text.slice(0, 4000))
  const lang: Lang = st.langMode === 'auto' ? detected.lang : st.langMode
  const v = voiceById(voice ?? st.defaultVoice[lang])
  const favs = VOICES.filter((x) => st.favorites.includes(x.id))

  const elapsed = (Date.now() - job.startedAt) / 1000
  const eta = job.done > 0 ? (elapsed / job.done) * (job.total - job.done) : NaN

  const generate = () => {
    if (!text.trim()) { toast('Add some text first'); return }
    void runExport(text, { voice, speed: st.exportSpeed, format: st.format, title })
  }

  return (
    <div className="page wide create-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Create</h1>
          <p className="page-sub">Render the whole text into an audio file you can keep.</p>
        </div>
      </div>

      <div className="create-grid">
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="editor">
            <textarea value={text} onChange={(ev) => drafts.set({ create: ev.target.value })} placeholder="What should Logos record?" aria-label="Text to render" lang={lang} />
            <div className="editor-bar">
              <button className="icon-btn" title="Paste" aria-label="Paste" onClick={async () => {
                try { const c = await navigator.clipboard.readText(); if (c.trim()) drafts.set({ create: c }) } catch { toast('Clipboard blocked — long-press to paste') }
              }}><ClipboardPaste size={21} /></button>
              <button className="btn sm ghost" onClick={() => drafts.set({ create: drafts.get().listen })} disabled={!d.listen.trim()}>Use Listen text</button>
              <div className="editor-meta">
                <div>{wordCount(text).toLocaleString()} words</div>
                <div>≈ {formatDuration(estimateSeconds(text, st.exportSpeed))}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="stack">
          {job.status === 'running' ? (
            <div className="card card-pad" style={{ textAlign: 'center' }}>
              <Ring value={job.total ? job.done / job.total : 0} />
              <div style={{ fontWeight: 700, fontSize: 17 }}>Rendering {job.done} of {job.total}</div>
              <div className="muted small mono" style={{ margin: '4px 0 14px' }}>
                {formatDuration(job.audioSec)} of audio · {isFinite(eta) ? `about ${formatDuration(eta)} left` : e.status === 'loading' ? 'waiting for the voice model' : 'starting'}
              </div>
              <button className="btn" onClick={cancelExport}><Square size={16} /> Cancel</button>
              <EngineNote />
            </div>
          ) : job.status === 'done' && job.result ? (
            <Result onAgain={resetExport} />
          ) : (
            <div className="card card-pad stack">
              <div>
                <div className="field-label"><span>Voice</span><span className="muted">{st.langMode === 'auto' ? `Auto-detect · ${LANG_LABEL[detected.lang]}` : LANG_LABEL[st.langMode]}</span></div>
                <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <button className={`chip ${voice === null ? 'accent' : ''}`} onClick={() => setVoice(null)}><Wand2 size={15} /> Auto</button>
                  {favs.map((f) => <button key={f.id} className={`chip ${voice === f.id ? 'accent' : ''}`} onClick={() => setVoice(f.id)}>{f.name}</button>)}
                  <button className="chip" onClick={() => setPickerOpen(true)}>More…</button>
                </div>
                {v && (
                  <div className="row" style={{ marginTop: 12 }}>
                    <Avatar voice={v} />
                    <div className="grow"><div className="voice-name">{v.name} <span className="badge">{v.accent}</span></div><div className="voice-tag">{voice === null ? 'Switches per paragraph language' : v.tagline}</div></div>
                  </div>
                )}
              </div>
              <div>
                <div className="field-label"><span>Speed</span><span className="mono">{st.exportSpeed.toFixed(2)}×</span></div>
                <Range label="Export speed" min={0.6} max={1.6} step={0.05} value={st.exportSpeed} onChange={(x) => settings.set({ exportSpeed: x })} />
              </div>
              <div>
                <div className="field-label"><span>Format</span><span className="muted">{st.format === 'mp3' ? '128 kbps · small' : 'Lossless · large'}</span></div>
                <Seg value={st.format} onChange={(f) => settings.set({ format: f })} options={[{ value: 'mp3', label: 'MP3' }, { value: 'wav', label: 'WAV' }]} label="Format" />
              </div>
              <div>
                <div className="field-label"><span>Title</span></div>
                <input value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder={text ? titleFrom(text) : 'Untitled'}
                  style={{ width: '100%', height: 48, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)', padding: '0 14px', outline: 'none' }} />
              </div>
              <button className="btn primary block" onClick={generate} disabled={!text.trim()} style={{ height: 56, fontSize: 16 }}><Sparkles size={18} /> Generate audio</button>
              {e.status !== 'ready' && <p className="muted small" style={{ margin: 0, textAlign: 'center' }}>First run downloads the neural voice (~{e.family === "pocket" ? POCKET_SIZE_MB : MODEL_SIZE_MB.q8} MB), then works offline.</p>}
              {job.status === 'error' && <div className="error-note">{job.error}</div>}
            </div>
          )}
        </div>
      </div>

      <VoicePicker open={pickerOpen} onClose={() => setPickerOpen(false)} value={voice} onPick={setVoice} />
    </div>
  )
}

function Ring({ value }: { value: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <svg className="progress-ring" viewBox="0 0 120 120" aria-hidden>
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="6" />
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} transform="rotate(-90 60 60)" style={{ transition: 'stroke-dashoffset .5s var(--ease)' }} />
      <text x="60" y="68" textAnchor="middle" fontSize="26" fontFamily="var(--font-display)" fill="var(--text)">{Math.round(value * 100)}%</text>
    </svg>
  )
}

function Result({ onAgain }: { onAgain: () => void }) {
  const job = useStore(exportJob)
  const cp = useStore(clipPlayer)
  const { blob, meta } = job.result!
  const key = `clip:${meta.id}`
  const playing = cp.key === key && cp.playing
  const progress = cp.key === key && cp.duration ? cp.time / cp.duration : 0
  const filename = `${slugify(meta.title)}.${meta.format}`
  const share = async () => {
    const file = new File([blob], filename, { type: blob.type })
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: meta.title }) } catch { /* cancelled */ }
    } else downloadBlob(blob, filename)
  }
  return (
    <div className="card card-pad stack">
      <div className="row">
        <button className="play-btn" style={{ width: 64, height: 64 }} onClick={() => playClip(key, blob, { title: meta.title })} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" style={{ marginLeft: 3 }} />}
        </button>
        <div className="grow">
          <div className="clip-title">{meta.title}</div>
          <div className="clip-meta"><span>{formatDuration(meta.duration)}</span><span>{meta.format.toUpperCase()}</span><span>{formatBytes(meta.size)}</span><span>Saved to Library</span></div>
        </div>
      </div>
      <div className="clip-bar" style={{ height: 6 }} onClick={(ev) => { const r = (ev.currentTarget as HTMLElement).getBoundingClientRect(); if (cp.key === key) seekClip((ev.clientX - r.left) / r.width) }}>
        <i style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <button className="btn primary grow" onClick={() => downloadBlob(blob, filename)}><ArrowDownToLine size={18} /> Download {meta.format.toUpperCase()}</button>
        <button className="btn" onClick={share}><Share2 size={18} /> Share</button>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn ghost grow" onClick={() => navigate('library')}><Library size={18} /> Library</button>
        <button className="btn ghost grow" onClick={onAgain}><RotateCcw size={18} /> New</button>
      </div>
    </div>
  )
}
