import { useEffect, useMemo, useRef, useState } from 'react'
import { readClipboard } from '../lib/clipboard.ts'
import { AudioLines, BookOpen, BookmarkPlus, ClipboardPaste, Clock, Eraser, Gauge, Globe, Languages, Library as LibraryIcon, Loader2, Moon, Pause, PenLine, Play, SkipBack, SkipForward, X } from 'lucide-react'
import { useStore } from '../lib/store.ts'
import { drafts } from '../lib/drafts.ts'
import { saveLastText, settings } from '../lib/settings.ts'
import { detectLang, estimateSeconds, formatDuration, wordCount } from '../lib/text.ts'
import { voiceById, LANG_LABEL, type Lang } from '../lib/voices.ts'
import { listen, loadText, prepareText, play, toggle, next, prev, seek, setRate, setSleepTimer, refreshVoices, relangSession, voiceFor, endSession, sentenceProgress, seekFraction, wordClock, seekWord } from '../player/listen.ts'
import { engine } from '../engine/engine.ts'
import { aiDescribe, describeText } from '../lib/describe.ts'
import { library, refreshLibrary, saveForLater } from '../lib/library.ts'
import { exportJob, queueExport } from '../player/exporter.ts'
import { navigate } from '../lib/router.ts'
import { nowReadingFor, posAt } from '../lib/book/nowreading.ts'
import { updateBook } from '../lib/books.ts'
import { alignWords, wordAtTime } from '../player/wordsync.ts'
import { WebImport } from '../components/webimport.tsx'
import { isJustUrl, normalizeUrl } from '../lib/webtext.ts'
import { Visualizer } from '../components/Visualizer.tsx'
import { EngineNote, StatusPill, VoicePicker } from '../components/chrome.tsx'
import { Range, Sheet, toast, useMediaQuery } from '../components/ui.tsx'
import { TabletDesk, TextMap } from '../components/desk.tsx'

const SPEEDS = [0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2]

export function ListenPage() {
  const d = useStore(drafts)
  const s = useStore(listen)
  const st = useStore(settings)
  const e = useStore(engine)
  const [editing, setEditing] = useState(() => !listen.get().active)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [speedOpen, setSpeedOpen] = useState(false)
  const [sleepOpen, setSleepOpen] = useState(false)
  const [keepOpen, setKeepOpen] = useState(false)
  const [webUrl, setWebUrl] = useState<string | null>(null)
  const text = d.listen

  useEffect(() => {
    // Shared in from another app: a bare link opens the page reader; any other
    // text is loaded and read aloud at once (Oscar, 1.4.26).
    if (!d.sharedAt || Date.now() - d.sharedAt > 4000) return
    const shared = d.listen
    drafts.set({ sharedAt: 0 })
    if (!shared.trim()) return
    if (isJustUrl(shared)) { setWebUrl(normalizeUrl(shared)); return }
    if (listen.get().active) endSession()
    loadText(shared)
    setEditing(false)
    void play()
  }, [d.sharedAt])

  // The floating bubble loaded a clipboard text: the player takes the stage.
  useEffect(() => {
    const h = () => setEditing(false)
    addEventListener('logos-bubble-clip', h)
    return () => removeEventListener('logos-bubble-clip', h)
  }, [])

  const setText = (t: string) => { drafts.set({ listen: t }); saveLastText(t) }
  const detected = useMemo(() => detectLang(text.slice(0, 4000)), [text])
  const mixed = useMemo(() => {
    const langs = new Set(text.split(/\n\s*\n/).filter((p) => p.trim().length > 30).map((p) => { const d = detectLang(p); return d.confidence >= 0.25 ? d.lang : null }).filter(Boolean))
    return langs.size > 1
  }, [text])
  const lang: Lang = st.langMode === 'auto' ? detected.lang : st.langMode
  const currentVoice = voiceById(s.active && !editing && s.voices[s.current] ? s.voices[s.current] : voiceFor(lang))

  // Begin preparing the audio as soon as text is pasted or typed (after a short pause in typing).
  useEffect(() => {
    if (!text.trim() || isJustUrl(text)) return   // a bare link waits for "Read page"
    const t = setTimeout(() => prepareText(text), 1200)
    return () => clearTimeout(t)
  }, [text, st.voiceOverride, st.defaultVoice, st.langMode])

  const start = () => {
    if (!text.trim()) { toast('Paste or type something to listen to'); return }
    if (!s.active || s.text !== text) loadText(text)
    setEditing(false)
    void play()
  }

  const paste = async () => {
    try {
      const clip = await readClipboard()
      if (!clip.trim()) { toast('Clipboard is empty'); return }
      if (isJustUrl(clip)) { setWebUrl(normalizeUrl(clip)); return }
      setText(clip)
      // Paste = listen: load the new text and start playing right away (Oscar, 1.4.40)
      loadText(clip)
      setEditing(false)
      void play()
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
  const wide = useMediaQuery('(min-width: 1100px)')
  const big = useMediaQuery('(min-width: 1500px)')
  const remaining = reading ? estimateSeconds(s.segments.slice(s.current).map((g) => g.text).join(' '), st.listenSpeed) : estimateSeconds(text, st.listenSpeed)

  return (
    <div className="page wide listen-page">
      <ListenHead text={reading ? s.text : text} lang={lang} playing={s.playing && reading} remaining={remaining} />

      <div className="listen-grid">
        <div className="card" style={{ overflow: 'hidden' }}>
          {reading ? (
            <Reader onEdit={() => setEditing(true)} onKeep={() => setKeepOpen(true)} />
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
              {isJustUrl(text) && (
                <button className="url-banner" onClick={() => setWebUrl(normalizeUrl(text))}>
                  <Globe size={17} /><span className="grow">Bring the text from <b>{new URL(normalizeUrl(text)!).hostname.replace(/^www\./, '')}</b></span><span className="ub-go">Read page</span>
                </button>
              )}
              <div className="editor-bar">
                <button className="icon-btn" onClick={paste} aria-label="Paste from clipboard" title="Paste"><ClipboardPaste size={21} /></button>
                <button className="icon-btn" onClick={() => { setText(''); endSession() }} disabled={!text} aria-label="Clear text" title="Clear"><Eraser size={21} /></button>
                <button className="icon-btn" onClick={() => setKeepOpen(true)} disabled={!text.trim()} aria-label="Save to Library" title="Save to Library"><BookmarkPlus size={21} /></button>
                {s.active && <button className="icon-btn" onClick={() => { if (s.text !== text) loadText(text); setEditing(false) }} aria-label="Back to reading view" title="Reading view"><X size={21} /></button>}
                {text.trim() && <div className="editor-meta" aria-label={`About ${formatDuration(estimateSeconds(text, st.listenSpeed))} of listening, ${wordCount(text)} words`}>
                  <span className="em-time"><Clock size={12} strokeWidth={2.4} />{formatDuration(estimateSeconds(text, st.listenSpeed))}</span>
                  <span className="em-words">{wordCount(text).toLocaleString()} words</span>
                </div>}
              </div>
            </div>
          )}
        </div>

        <div className="listen-side">
        <div className="card player-card">
          {/* 1.4.59: back to one row (Oscar: two rows grew the player and shrank
              the text window) — the four chips fit by being smaller, not taller. */}
          <div className="player-top">
            <button className={`chip lang-chip ${st.langMode === 'auto' ? '' : 'accent'}`} onClick={cycleLang} aria-label="Language">
              <Languages size={16} />
              <span className="chip-txt">{st.langMode === 'auto' ? <>Auto · {mixed ? 'EN + ES' : detected.lang.toUpperCase()}</> : LANG_LABEL[st.langMode]}</span>
            </button>
            <div className="player-top-r">
              <button className={`chip ${s.sleepLeft != null ? 'accent' : ''}`} onClick={() => setSleepOpen(true)} aria-label="Sleep timer"><Moon size={15} />{s.sleepLeft != null ? formatDuration(s.sleepLeft) : null}</button>
              <button className="chip speed-chip" onClick={() => setSpeedOpen(true)} aria-label={`Playback speed ${fmtSpeed(st.listenSpeed)}`}><Gauge size={15} />{fmtSpeed(st.listenSpeed)}</button>
              <button className="chip accent voice-chip" onClick={() => setVoiceOpen(true)} aria-label="Voice">
                <span className="dot" /><span className="chip-txt">{currentVoice?.name ?? ''}</span>
              </button>
            </div>
          </div>

          <Visualizer />

          <ProgressLine />

          <div className="player-meta">
            <span>{reading ? `Sentence ${s.current + 1} of ${s.segments.length}` : 'Ready'}</span>
            {/* 1.4.60: the voice's name lives in the chip above — naming it again here was pure repetition (Oscar). Only the device-voice state, which the chip cannot show, is still said. */}
            <span>{s.mode === 'device' ? 'Device voice · ' : ''}{formatDuration(remaining)} left</span>
          </div>

          <div className="transport">
            <span aria-hidden />
            <button className="icon-btn filled" onClick={prev} disabled={!reading} aria-label="Previous sentence"><SkipBack size={22} /></button>
            <button className={`play-btn ${s.buffering ? 'busy' : ''}`} onClick={reading ? toggle : start} aria-label={s.playing ? 'Pause' : 'Play'}>
              <span className="pb-icon" key={s.buffering ? 'b' : s.playing ? 'p' : 'l'}>{s.buffering ? <Loader2 size={32} className="spin" /> : s.playing ? <Pause size={34} fill="currentColor" /> : <Play size={34} fill="currentColor" style={{ marginLeft: 4 }} />}</span>
            </button>
            <button className="icon-btn filled" onClick={next} disabled={!reading} aria-label="Next sentence"><SkipForward size={22} /></button>
            <span aria-hidden />
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
          {!s.playing && !s.cushion && s.active && s.text === text && s.segments.length > 0 && (() => {
            const ready = s.rendered.filter(Boolean).length
            return ready < s.segments.length ? (
              <div className="engine-note"><span>Preparing the audio in the background · {ready} of {s.segments.length} sentences ready</span><span className="bar"><i style={{ width: `${Math.round((ready / s.segments.length) * 100)}%` }} /></span></div>
            ) : <div className="engine-note"><span>All audio ready · it will read without stopping</span></div>
          })()}
          <EngineNote />
          {s.error && <div className="error-note">{s.error}</div>}
          {e.status === 'error' && <div className="error-note">Neural engine: {e.error}</div>}
        </div>
        {wide && <TabletDesk onOpen={(t) => { setText(t); setEditing(false) }} />}
        </div>
        {big && <TextMap text={text} reading={reading} />}
      </div>

      <VoicePicker open={voiceOpen} onClose={() => setVoiceOpen(false)} value={st.voiceOverride} lang={st.langMode}
        onPick={(id) => { settings.set({ voiceOverride: id }); refreshVoices() }} />

      <WebImport open={webUrl !== null} onClose={() => setWebUrl(null)} initialUrl={webUrl ?? undefined} />
      <KeepSheet open={keepOpen} onClose={() => setKeepOpen(false)} text={reading ? s.text : text} lang={lang} />

      <Sheet open={speedOpen} onClose={() => setSpeedOpen(false)} title="Speed">
        <div className="speed-row" style={{ marginBottom: 14 }}>
          {SPEEDS.map((v) => <button key={v} className={Math.abs(st.listenSpeed - v) < 0.001 ? 'on' : ''} onClick={() => setRate(v)}>{v}×</button>)}
        </div>
        <Range label="Speed" min={0.5} max={2.5} step={0.05} value={st.listenSpeed} onChange={setRate} />
        <p className="muted small" style={{ margin: '8px 4px 0' }}>Changes apply instantly, pitch preserved.</p>
      </Sheet>

      <Sheet open={sleepOpen} onClose={() => setSleepOpen(false)} title="Sleep timer">
        <div className="speed-row" style={{ marginBottom: 14 }}>
          <button className={s.sleepLeft == null ? 'on' : ''} onClick={() => setSleepTimer(null)}>Off</button>
          {[10, 15, 20, 30, 45, 60].map((m) => <button key={m} onClick={() => setSleepTimer(m)}>{m} min</button>)}
        </div>
        <p className="muted small" style={{ margin: '8px 4px 0' }}>The last ten seconds fade down gently, then it pauses.</p>
      </Sheet>
    </div>
  )
}

function ProgressLine() {
  const s = useStore(listen)
  const [, force] = useState(0)
  const [drag, setDrag] = useState<number | null>(null)
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!s.playing || drag !== null) return
    const id = setInterval(() => force((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [s.playing, drag])
  const n = Math.max(1, s.segments.length)
  const done = s.active ? (s.current + sentenceProgress()) / n : 0
  let ahead = s.current
  while (ahead < s.rendered.length && s.rendered[ahead]) ahead++
  const shown = drag ?? done
  const fracAt = (x: number) => {
    const r = bar.current!.getBoundingClientRect()
    return Math.max(0, Math.min(1, (x - r.left) / r.width))
  }
  const target = drag !== null ? Math.min(n - 1, Math.floor(drag * n)) : null
  return (
    <div
      ref={bar}
      className={`scrubber ${drag !== null ? 'dragging' : ''} ${s.active ? '' : 'off'}`}
      role="slider" aria-label="Position" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(shown * 100)}
      tabIndex={s.active ? 0 : -1}
      onPointerDown={(e) => { if (!s.active) return; e.currentTarget.setPointerCapture(e.pointerId); setDrag(fracAt(e.clientX)) }}
      onPointerMove={(e) => { if (drag !== null) setDrag(fracAt(e.clientX)) }}
      onPointerUp={(e) => { if (drag === null) return; const f = fracAt(e.clientX); setDrag(null); seekFraction(f) }}
      onPointerCancel={() => setDrag(null)}
      onKeyDown={(e) => {
        if (!s.active) return
        if (e.key === 'ArrowRight') seekFraction(Math.min(1, done + 1 / n))
        else if (e.key === 'ArrowLeft') seekFraction(Math.max(0, done - 1 / n))
      }}
    >
      <div className="player-progress">
        <b style={{ width: `${(ahead / n) * 100}%`, background: 'var(--line-2)' }} />
        <i style={{ width: `${shown * 100}%`, transition: drag !== null ? 'none' : undefined }} />
      </div>
      {s.active && <span className="scrub-thumb" style={{ left: `${shown * 100}%` }} />}
      {target !== null && (
        <span className="scrub-tip" style={{ left: `${Math.min(88, Math.max(12, drag! * 100))}%` }}>
          Sentence {target + 1} of {n}{s.rendered[target] ? '' : ' · not ready yet'}
        </span>
      )}
    </div>
  )
}

function Reader({ onEdit, onKeep }: { onEdit: () => void; onKeep: () => void }) {
  const s = useStore(listen)
  const st = useStore(settings)
  const box = useRef<HTMLDivElement>(null)
  // The user scrolling by hand pauses the automatic follow for a few seconds.
  const handScroll = useRef(0)
  useEffect(() => {
    const el = box.current; if (!el) return
    const mark = () => { handScroll.current = performance.now() }
    el.addEventListener('touchmove', mark, { passive: true }); el.addEventListener('wheel', mark, { passive: true })
    return () => { el.removeEventListener('touchmove', mark); el.removeEventListener('wheel', mark) }
  }, [])
  const follow = (target: HTMLElement | null, force = false) => {
    const b = box.current
    if (!target || !b) return
    if (!force && performance.now() - handScroll.current < 3500) return
    const r = target.getBoundingClientRect(), br = b.getBoundingClientRect()
    // keep the line being read in the upper-middle of the card
    if (force ? (r.top < br.top + 30 || r.bottom > br.bottom - 40) : (r.bottom > br.top + br.height * 0.58 || r.top < br.top + 24))
      b.scrollTo({ top: b.scrollTop + r.top - br.top - br.height * 0.3, behavior: 'smooth' })
  }
  useEffect(() => { follow(box.current?.querySelector<HTMLElement>(`[data-i="${s.current}"]`) ?? null, true) }, [s.current])
  // Word by word: purely visual. The voice still reads whole sentences; words light up in step with the audio.
  useEffect(() => {
    if (!s.playing) return
    let raf = 0, lastWord = -1, lastLine = -1, lastIdx = -1
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const sent = box.current?.querySelector<HTMLElement>(`[data-i="${listen.get().current}"]`)
      const ws = sent ? [...sent.querySelectorAll<HTMLElement>('.w')] : []
      if (!ws.length) return
      const idx = listen.get().current
      if (idx !== lastIdx) { box.current?.querySelectorAll('.w.said, .w.cur').forEach((x) => { if (!sent?.contains(x)) x.className = 'w' }); lastIdx = idx; lastWord = -1; lastLine = -1 }
      // Words are timed from the sentence's own audio (see wordsync.ts); the clock is smoothed
      // between the phone's coarse time updates and led slightly, so the light lands as the word starts.
      const clk = wordClock()
      let w: number
      if (clk && clk.idx === idx) {
        const starts = alignWords(clk.env, 60, ws.map((x) => x.textContent ?? ''))
        w = wordAtTime(starts, clk.t + settings.get().wordLeadMs / 1000)
      } else w = wordAt(ws, sentenceProgress())
      if (w === lastWord) return
      for (let i = 0; i < ws.length; i++) ws[i].className = i < w ? 'w said' : i === w ? 'w cur' : 'w'
      lastWord = w
      const top = ws[w].offsetTop
      if (top !== lastLine) { lastLine = top; follow(ws[w]) }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [s.playing, s.current])
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
            onClick={(ev) => tapWord(ev, g.index, g.text.replace(/\*\*|__|`/g, ''))} onKeyDown={(ev) => { if (ev.key === 'Enter') seek(g.index) }}><Words text={g.text.replace(/\*\*|__|`/g, '')} /></span>{' '}
        </span>
      ))}
    </p>
  )), [paras, s.current, st.highlight])
  return (
    <>
      <div className="reader-head">
        <span className="rh-hint">Tap a word to start there.</span>
        <div className="rh-actions">
          <button className="rh-btn" onClick={onKeep} aria-label="Save to Library"><BookmarkPlus size={13} /> Save</button>
          <button className="rh-btn" onClick={onEdit}><PenLine size={13} /> Edit</button>
        </div>
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

// Tap a word: find which word sits under the finger and read from it.
function tapWord(ev: { currentTarget: HTMLElement; target: EventTarget; clientX: number; clientY: number }, idx: number, text: string) {
  const el = ev.currentTarget
  const words = text.split(/\s+/).filter(Boolean)
  let w = 0
  // Every sentence is split into word spans, so the tapped word is simply the span under the finger.
  const hit = (ev.target as Element | null)?.closest?.('.w')
  if (hit && el.contains(hit)) { w = [...el.querySelectorAll('.w')].indexOf(hit) }
  else try {
    const d = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null }
    let node: Node | null = null, off = 0
    const cp = d.caretPositionFromPoint?.(ev.clientX, ev.clientY)
    if (cp) { node = cp.offsetNode; off = cp.offset }
    else { const r = document.caretRangeFromPoint?.(ev.clientX, ev.clientY); if (r) { node = r.startContainer; off = r.startOffset } }
    if (node && el.contains(node)) {
      const rg = document.createRange()
      rg.setStart(el, 0)
      rg.setEnd(node, off)
      const before = rg.toString()
      const n = before.split(/\s+/).filter(Boolean).length
      w = /\s$/.test(before) || !before ? n : n - 1
    }
  } catch { w = 0 }
  seekWord(idx, Math.max(0, Math.min(words.length - 1, w)), words)
}

// Splits the sentence being read into words (spaces kept outside the word spans).
function Words({ text }: { text: string }) {
  const parts = text.split(/(\s+)/)
  return <>{parts.map((t, i) => /^\s+$/.test(t) || !t ? t : <span key={i} className="w">{t}</span>)}</>
}

// Which word the voice is on, from how far through the sentence's audio we are.
// Each word weighs its letters plus a little for the breath after punctuation.
function wordAt(ws: HTMLElement[], p: number): number {
  const wt = ws.map((w) => { const t = w.textContent ?? ''; return t.replace(/[^\p{L}\p{N}]/gu, '').length + 1.2 + (/[.!?…]$/.test(t) ? 3 : /[,;:—–]$/.test(t) ? 2 : 0) })
  const total = wt.reduce((a, b) => a + b, 0)
  let acc = 0, target = Math.max(0, Math.min(1, p)) * total
  for (let i = 0; i < wt.length; i++) { acc += wt[i]; if (target < acc - wt[i] * 0.35) return i }
  return wt.length - 1
}

// Slim header for Listen: what is loaded and how long it runs, instead of a big page title.
// The title is the text's own heading, or a complete one Logos composes (with a one-line summary).
function ListenHead({ text, lang, playing, remaining }: { text: string; lang: Lang; playing: boolean; remaining: number }) {
  const local = useMemo(() => describeText(text, lang), [text, lang])
  const book = useMemo(() => nowReadingFor(text), [text])
  const backToBook = () => {
    if (!book) return
    const s = listen.get()
    const seg = s.text === text ? s.segments[s.current] : undefined
    const at = posAt(book, seg?.start ?? 0)
    void updateBook(book.id, { pos: at }, false).finally(() => { location.hash = `#/book/${encodeURIComponent(book.id)}` })
  }
  const [ai, setAi] = useState<{ key: string; title?: string; summary?: string } | null>(null)
  useEffect(() => {
    if (!local.generated || text.trim().length < 200) return
    let alive = true
    const t = setTimeout(() => { void aiDescribe(text).then((r) => { if (alive && r) setAi({ key: text, ...r }) }) }, 600)
    return () => { alive = false; clearTimeout(t) }
  }, [text, local.generated])
  const useAi = ai && ai.key === text && local.generated
  const title = (useAi && ai.title && ai.title.length <= 60 ? ai.title : local.title)
  const summary = local.generated ? (useAi && ai.summary && ai.summary.length <= 140 ? ai.summary : local.summary) : undefined
  const words = wordCount(text)
  const has = !!text.trim()
  if (isJustUrl(text)) {
    const host = new URL(normalizeUrl(text)!).hostname.replace(/^www\./, '')
    return (
      <div className="listen-head">
        <div className="lh-eyebrow"><span className="lh-dot" /><span>Web page</span></div>
        <div className="lh-title">{host}</div>
        <div className="lh-sum">Tap Read page to bring in its text, clean and ready to hear.</div>
      </div>
    )
  }
  return (
    <div className={`listen-head ${playing ? 'live' : ''}`}>
      <div className="lh-eyebrow">
        <span className="lh-dot" />
        <span>{has ? (playing ? 'Now reading' : 'Ready to read') : 'Listen'}</span>
        {has ? <span className="lh-meta">{words.toLocaleString()} words · {formatDuration(remaining)} · {LANG_LABEL[lang]}</span> : null}
      </div>
      {book
        ? <button className="lh-book" onClick={backToBook} aria-label={`Back to ${book.title}`}>
            <BookOpen size={17} />
            <span className="lh-book-t" lang={lang}>{book.title}</span>
            <span className="lh-book-go">Back to book</span>
          </button>
        : <div className="lh-title" lang={lang}>{title || 'Paste anything. Hear it instantly.'}</div>}
      {summary && !book ? <div className="lh-sum" lang={lang}>{summary}</div> : null}
      <div className="lh-status"><StatusPill compact /></div>
    </div>
  )
}

// "Keep this": save the whole audio to the Library, or save the text to hear later.
function KeepSheet({ open, onClose, text, lang }: { open: boolean; onClose: () => void; text: string; lang: Lang }) {
  const st = useStore(settings)
  const lib = useStore(library)
  const job = useStore(exportJob)
  useEffect(() => { if (open) void refreshLibrary() }, [open])
  const info = useMemo(() => describeText(text, lang), [text, lang])
  const existing = lib.clips.filter((c) => c.text === text)
  const hasAudio = existing.some((c) => (c.kind ?? 'audio') === 'audio')
  const hasLater = existing.some((c) => c.kind === 'text')
  const speed = Math.min(2, Math.max(0.6, st.listenSpeed))
  const v = voiceById(st.voiceOverride ?? st.defaultVoice[lang])
  const words = wordCount(text)
  const busy = job.status === 'running'
  const saveAudio = () => {
    const r = queueExport(text, { voice: st.voiceOverride, speed, format: st.format, title: info.title, summary: info.summary, origin: 'listen' })
    onClose()
    toast(r === 'queued' ? 'Queued for your Library · it starts after the current one' : 'Making the audio · it will be in your Library', { label: 'Library', run: () => navigate('library') }, 5000)
  }
  const later = async () => {
    await saveForLater(text, { title: info.title, summary: info.summary, lang, voice: st.voiceOverride ?? '', duration: estimateSeconds(text, 1) })
    onClose()
    toast('Saved to Listen later', { label: 'Library', run: () => navigate('library') }, 4000)
  }
  return (
    <Sheet open={open} onClose={onClose} title="Keep this">
      <div className="keep-title">{info.title}</div>
      <div className="keep-sub">{words.toLocaleString()} words · about {formatDuration(estimateSeconds(text, speed))} at {fmtSpeed(speed)}</div>
      <div className="keep-opts">
        <button className="keep-opt" onClick={saveAudio}>
          <span className="keep-ic"><AudioLines size={22} /></span>
          <span className="grow">
            <b>Save the audio</b>
            <small>{st.format.toUpperCase()} in {v?.name ?? 'your voice'}{st.voiceOverride ? '' : ' (switches by language)'} · plays offline, ready to share{busy ? ' · queued after the current one' : ''}</small>
          </span>
        </button>
        <button className="keep-opt" onClick={() => void later()}>
          <span className="keep-ic"><Clock size={22} /></span>
          <span className="grow">
            <b>Listen later</b>
            <small>Saves the text instantly. Make its audio whenever you like</small>
          </span>
        </button>
      </div>
      {(hasAudio || hasLater) && (
        <button className="keep-note" onClick={() => { onClose(); navigate('library') }}>
          <LibraryIcon size={16} /> {hasAudio ? 'This text is already in your Library as audio' : 'This text is already in Listen later'} · Open
        </button>
      )}
    </Sheet>
  )
}
