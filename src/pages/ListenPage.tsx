import { useEffect, useMemo, useRef, useState } from 'react'
import { ClipboardPaste, Eraser, Gauge, Languages, Loader2, Pause, PenLine, Play, SkipBack, SkipForward, Sparkles, X } from 'lucide-react'
import { useStore } from '../lib/store.ts'
import { drafts } from '../lib/drafts.ts'
import { saveLastText, settings } from '../lib/settings.ts'
import { detectLang, estimateSeconds, formatDuration, wordCount } from '../lib/text.ts'
import { voiceById, LANG_LABEL, type Lang } from '../lib/voices.ts'
import { listen, loadText, play, toggle, next, prev, seek, setRate, refreshVoices, relangSession, endSession, sentenceProgress } from '../player/listen.ts'
import { engine } from '../engine/engine.ts'
import { Visualizer } from '../components/Visualizer.tsx'
import { EngineNote, VoicePicker } from '../components/chrome.tsx'
import { Range, Sheet, toast } from '../components/ui.tsx'
import { navigate } from '../lib/router.ts'

const SPEEDS = [0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2]

export function ListenPage() {
  const d = useStore(drafts)
  const s = useStore(listen)
  const st = useStore(settings)
  const e = useStore(engine)
  const [editing, setEditing] = useState(() => !listen.get().active)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [speedOpen, setSpeedOpen] = useState(false)
  const text = d.listen

  useEffect(() => {
    if (d.sharedAt && Date.now() - d.sharedAt < 4000) { setEditing(true); toast('Shared text is ready — tap play') }
  }, [d.sharedAt])

  const setText = (t: string) => { drafts.set({ listen: t }); saveLastText(t) }
  const detected = useMemo(() => detectLang(text.slice(0, 4000)), [text])
  const mixed = useMemo(() => {
    const langs = new Set(text.split(/\n\s*\n/).filter((p) => p.trim().length > 30).map((p) => { const d = detectLang(p); return d.confidence >= 0.25 ? d.lang : null }).filter(Boolean))
    return langs.size > 1
  }, [text])
  const lang: Lang = st.langMode === 'auto' ? detected.lang : st.langMode
  const currentVoice = voiceById(s.active && !editing ? s.voices[s.current] : (st.voiceOverride ?? st.defaultVoice[lang]))

  const start = () => {
    if (!text.trim()) { toast('Paste or type something to listen to'); return }
    if (!s.active || s.text !== text) loadText(text)
    setEditing(false)
    void play()
  }

  const paste = async () => {
    try {
      const clip = await navigator.clipboard.readText()
      if (!clip.trim()) { toast('Clipboard is empty'); return }
      setText(clip)
      if (s.active) endSession()
      setEditing(true)
    } catch {
      toast('Clipboard blocked — long-press the box and choose Paste')
    }
  }

  const cycleLang = () => {
    const order: (Lang | 'auto')[] = ['auto', 'en', 'es']
    const nextMode = order[(order.indexOf(st.langMode) + 1) % order.length]
    settings.set({ langMode: nextMode, voiceOverride: st.voiceOverride && nextMode !== 'auto' && voiceById(st.voiceOverride)?.lang !== nextMode ? null : st.voiceOverride })
    relangSession()
  }

  // Space toggles playback (tablet keyboards)
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLTextAreaElement || ev.target instanceof HTMLInputElement) return
      if (ev.code === 'Space') { ev.preventDefault(); if (s.active && !editing) toggle(); else start() }
      if (ev.code === 'ArrowRight' && s.active) next()
      if (ev.code === 'ArrowLeft' && s.active) prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const reading = s.active && !editing
  const remaining = reading ? estimateSeconds(s.segments.slice(s.current).map((g) => g.text).join(' '), st.listenSpeed) : estimateSeconds(text, st.listenSpeed)

  return (
    <div className="page wide listen-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Listen</h1>
          <p className="page-sub">Paste anything. It starts speaking in a heartbeat.</p>
        </div>
      </div>

      <div className="listen-grid">
        <div className="card" style={{ overflow: 'hidden' }}>
          {reading ? (
            <Reader onEdit={() => setEditing(true)} />
          ) : (
            <div className="editor">
              <textarea
                value={text}
                onChange={(ev) => setText(ev.target.value)}
                placeholder="Paste an article, a chapter, a poem — or share text here from any app…"
                spellCheck={false}
                lang={lang}
                aria-label="Text to listen to"
              />
              <div className="editor-bar">
                <button className="icon-btn" onClick={paste} aria-label="Paste from clipboard" title="Paste"><ClipboardPaste size={21} /></button>
                <button className="icon-btn" onClick={() => { setText(''); endSession() }} disabled={!text} aria-label="Clear text" title="Clear"><Eraser size={21} /></button>
                {s.active && <button className="icon-btn" onClick={() => { if (s.text !== text) loadText(text); setEditing(false) }} aria-label="Back to reading view" title="Reading view"><X size={21} /></button>}
                <div className="editor-meta">
                  <div>{text.length.toLocaleString()} chars · {wordCount(text).toLocaleString()} words</div>
                  <div>≈ {formatDuration(estimateSeconds(text, st.listenSpeed))} listening</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card player-card">
          <div className="row between" style={{ position: 'relative', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
            <button className={`chip ${st.langMode === 'auto' ? '' : 'accent'}`} onClick={cycleLang} aria-label="Language">
              <Languages size={16} />
              {st.langMode === 'auto' ? <>Auto · {mixed ? 'EN + ES' : LANG_LABEL[detected.lang]}</> : LANG_LABEL[st.langMode]}
            </button>
            <button className="chip accent" onClick={() => setVoiceOpen(true)} aria-label="Voice">
              <span className="dot" />{st.voiceOverride ? voiceById(st.voiceOverride)?.name : `Auto · ${currentVoice?.name ?? ''}`}
            </button>
          </div>

          <Visualizer />

          <ProgressLine />

          <div className="player-meta">
            <span>{reading ? `Sentence ${s.current + 1} of ${s.segments.length}` : 'Ready'}</span>
            <span>{s.mode === 'device' ? 'Device voice' : currentVoice ? `${currentVoice.name} · ${currentVoice.accent}` : ''} · {formatDuration(remaining)} left</span>
          </div>

          <div className="transport">
            <button className="chip t-left" onClick={() => setSpeedOpen(true)} aria-label="Playback speed"><Gauge size={16} /> {fmtSpeed(st.listenSpeed)}</button>
            <button className="icon-btn filled" onClick={prev} disabled={!reading} aria-label="Previous sentence"><SkipBack size={22} /></button>
            <button className={`play-btn ${s.buffering ? 'busy' : ''}`} onClick={reading ? toggle : start} aria-label={s.playing ? 'Pause' : 'Play'}>
              {s.buffering ? <Loader2 size={32} className="spin" /> : s.playing ? <Pause size={34} fill="currentColor" /> : <Play size={34} fill="currentColor" style={{ marginLeft: 4 }} />}
            </button>
            <button className="icon-btn filled" onClick={next} disabled={!reading} aria-label="Next sentence"><SkipForward size={22} /></button>
            <button className="icon-btn filled t-right" onClick={() => { drafts.set({ create: text }); navigate('create') }} disabled={!text.trim()} aria-label="Save as audio file" title="Save as audio file"><Sparkles size={20} /></button>
          </div>

          {s.mode === 'device' && s.playing && (
            <div className="engine-note"><span>Using your device voice while the neural voice downloads. It switches over automatically.</span></div>
          )}
          {s.cushion && (
            <div className="engine-note">
              <span>
                Preparing the audio so it reads to the end without stopping · {s.cushion.done} of {s.cushion.total} sentences
                {s.cushion.eta != null ? ` · about ${formatWait(s.cushion.eta)} left` : ' · measuring this phone’s speed'}. Playback starts on its own.
              </span>
              <span className="bar"><i style={{ width: `${s.cushion.need > 0 ? Math.min(100, Math.round((s.cushion.have / s.cushion.need) * 100)) : 3}%` }} /></span>
            </div>
          )}
          <EngineNote />
          {s.error && <div className="error-note">{s.error}</div>}
          {e.status === 'error' && <div className="error-note">Neural engine: {e.error}</div>}
        </div>
      </div>

      <VoicePicker open={voiceOpen} onClose={() => setVoiceOpen(false)} value={st.voiceOverride} lang={st.langMode}
        onPick={(id) => { settings.set({ voiceOverride: id }); refreshVoices() }} />

      <Sheet open={speedOpen} onClose={() => setSpeedOpen(false)} title="Speed">
        <div className="speed-row" style={{ marginBottom: 14 }}>
          {SPEEDS.map((v) => <button key={v} className={Math.abs(st.listenSpeed - v) < 0.001 ? 'on' : ''} onClick={() => setRate(v)}>{v}×</button>)}
        </div>
        <Range label="Speed" min={0.5} max={2.5} step={0.05} value={st.listenSpeed} onChange={setRate} />
        <p className="muted small" style={{ margin: '8px 4px 0' }}>Changes apply instantly, pitch preserved.</p>
      </Sheet>
    </div>
  )
}

function ProgressLine() {
  const s = useStore(listen)
  const [, force] = useState(0)
  useEffect(() => {
    if (!s.playing) return
    const id = setInterval(() => force((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [s.playing])
  const n = Math.max(1, s.segments.length)
  const done = s.active ? (s.current + sentenceProgress()) / n : 0
  let ahead = s.current
  while (ahead < s.rendered.length && s.rendered[ahead]) ahead++
  return (
    <div className="player-progress" aria-hidden>
      <b style={{ width: `${(ahead / n) * 100}%`, background: 'var(--line-2)' }} />
      <i style={{ width: `${done * 100}%` }} />
    </div>
  )
}

function Reader({ onEdit }: { onEdit: () => void }) {
  const s = useStore(listen)
  const st = useStore(settings)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>(`[data-i="${s.current}"]`)
    if (el && box.current) {
      const r = el.getBoundingClientRect()
      const b = box.current.getBoundingClientRect()
      if (r.top < b.top + 40 || r.bottom > b.bottom - 60) box.current.scrollTo({ top: box.current.scrollTop + r.top - b.top - b.height / 3, behavior: 'smooth' })
    }
  }, [s.current])
  const paras = useMemo(() => {
    const out: (typeof s.segments)[] = []
    let curr: typeof s.segments = []
    for (const g of s.segments) { curr.push(g); if (g.paraEnd) { out.push(curr); curr = [] } }
    if (curr.length) out.push(curr)
    return out
  }, [s.segments])
  // Only the sentence list re-renders when the playhead moves, never on background render progress.
  const body = useMemo(() => paras.map((p, pi) => (
    <p key={pi} lang={p[0]?.lang}>
      {p.map((g) => (
        <span key={g.index}>
          <span data-i={g.index} role="button" tabIndex={0}
            className={`sent ${st.highlight && g.index === s.current ? 'now' : ''} ${g.index < s.current ? 'past' : ''}`}
            onClick={() => seek(g.index)} onKeyDown={(ev) => { if (ev.key === 'Enter') seek(g.index) }}>{g.text.replace(/\*\*|__|`/g, '')}</span>{' '}
        </span>
      ))}
    </p>
  )), [paras, s.current, st.highlight])
  return (
    <>
      <div className="reader-head">
        <span className="muted small grow">Tap any sentence to jump there</span>
        <button className="btn sm ghost" onClick={onEdit}><PenLine size={16} /> Edit</button>
      </div>
      <div className="reader" ref={box}>{body}</div>
    </>
  )
}

function fmtSpeed(v: number) {
  return `${Number(v.toFixed(2))}×`
}

function formatWait(sec: number): string {
  if (sec < 60) return `${Math.max(5, Math.round(sec / 5) * 5)} s`
  const m = Math.round(sec / 60)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`
}
