import { useEffect, useMemo, useRef, useState, type PointerEvent as RPE } from 'react'
import { readClipboard } from '../lib/clipboard.ts'
import { AudioLines, BookDown, BookOpen, Bookmark, ClipboardPaste, Clock, Eraser, Gauge, Globe, Languages, Library as LibraryIcon, ListMusic, Loader2, Moon, PanelBottomClose, PanelBottomOpen, Pause, PenLine, Play, SkipBack, SkipForward, X } from 'lucide-react'
import { queue } from '../lib/queue.ts'
import { playQueueAt, sendQueueToLater, saveQueueItemToLater, stepQueue } from '../lib/bubble.ts'
import { removeItem as dropQueueItem, clearQueue } from '../lib/queue.ts'
import { useStore } from '../lib/store.ts'
import { drafts } from '../lib/drafts.ts'
import { saveLastText, settings, READER_SCALES, stepReaderScale } from '../lib/settings.ts'
import { detectLang, estimateSeconds, formatDuration, wordCount } from '../lib/text.ts'
import { voiceById, LANG_LABEL, type Lang } from '../lib/voices.ts'
import { listen, loadText, prepareText, play, toggle, next, prev, seek, setRate, RATE_STEPS, setSleepTimer, refreshVoices, relangSession, endSession, sentenceProgress, seekFraction, wordClock, seekWord, ScrubHold, markGate } from '../player/listen.ts'
import { markAndToast, textKey } from '../lib/marks.ts'
import { loadSessionResume } from '../lib/resume.ts'
import { ContinueRow } from '../components/continue.tsx'
import { clipPlayer } from '../player/clip.ts'
import { navPin } from '../lib/navpin.ts'
import { engine } from '../engine/engine.ts'
import { aiDescribe, describeText } from '../lib/describe.ts'
import { library, refreshLibrary, saveForLater } from '../lib/library.ts'
import { exportJob, queueExport } from '../player/exporter.ts'
import { navigate } from '../lib/router.ts'
import { nowReadingFor, posAt } from '../lib/book/nowreading.ts'
import { updateBook, getContent, progressAt, progressPatch } from '../lib/books.ts'
import { alignWords, wordAtTime } from '../player/wordsync.ts'
import { WebImport } from '../components/webimport.tsx'
import { isJustUrl, normalizeUrl } from '../lib/webtext.ts'
import { Visualizer } from '../components/Visualizer.tsx'
import { EngineNote, JumpKey, StatusPill, VoicePicker } from '../components/chrome.tsx'
import { Sheet, Switch, confirmAsk, toast, useMediaQuery } from '../components/ui.tsx'
import { t } from '../lib/i18n.ts'
import { TabletDesk, TextMap } from '../components/desk.tsx'

export function ListenPage() {
  const d = useStore(drafts)
  const s = useStore(listen)
  const cp = useStore(clipPlayer)
  const pin = useStore(navPin)
  const st = useStore(settings)
  const e = useStore(engine)
  const [editing, setEditing] = useState(() => !listen.get().active)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [sleepOpen, setSleepOpen] = useState(false)
  const [keepOpen, setKeepOpen] = useState(false)
  const [markAsk, setMarkAsk] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const q = useStore(queue)
  // The queue's deeds ask first in this house too (1.4.232, Oscar):
  // the floating panel's list has asked since 1.4.201/206, and the
  // app's sheet acted on the tap — the same deeds wear the same
  // questions here, in the panel's own words, short and direct.
  const askQueueMode = async (v: boolean) => {
    if (v) {
      if (await confirmAsk(t('Turn on the copy queue?'), t('What you copy will line up and play one text after the next, instead of replacing what is playing.'), t('Turn it on'))) settings.set({ copyQueue: true })
    } else if (await confirmAsk(t('Turn off the copy queue?'), t('The line will be erased, and copies will stop lining up — a copy will take the stage as it did before.'), t('Turn it off'))) {
      settings.set({ copyQueue: false })
    }
  }
  const [webUrl, setWebUrl] = useState<string | null>(null)
  // Save-once for the mark door (cure M-5): the gate is keyed by the
  // mark's target (this text, this sentence), so a double-tap files
  // one mark and a slow save disables THIS target's button until it
  // settles — while a mark on another sentence stays live.
  const [, setMarkTick] = useState(0)
  const markTarget = `${textKey(s.text)}:${s.current}`
  const markBusy = markGate.busy(markTarget)
  const runMark = () => {
    const st = listen.get()
    const target = `${textKey(st.text)}:${st.current}`
    void markGate.run(target, () => markAndToast()).finally(() => setMarkTick((n) => n + 1))
    setMarkTick((n) => n + 1)
  }
  // Oscar's ruling (1.4.204): a mark on a text that is not saved is a
  // bookmark in a file that may not exist tomorrow. The door asks the
  // user to save it to the Library first — then the mark lives with
  // its text — and marking anyway is allowed only under the spoken
  // warning: the mark lasts while this text stays open or playing.
  const doMark = () => {
    const st = listen.get()
    if (!st.active) { runMark(); return }
    const saved = !!nowReadingFor(st.text) || library.get().clips.some((c) => c.kind === 'text' && !!c.text && c.text.trim() === st.text.trim())
    if (saved) { runMark(); return }
    setMarkAsk(true)
  }
  const saveThenMark = async () => {
    const ls = listen.get()
    const info = describeText(ls.text, lang)
    await saveForLater(ls.text, { title: info.title, summary: info.summary, lang, voice: st.voiceOverride ?? '', duration: estimateSeconds(ls.text, 1) })
    setMarkAsk(false)
    runMark()
  }
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

  // Begin preparing the audio as soon as text is pasted or typed (after a short pause in typing).
  useEffect(() => {
    if (!text.trim() || isJustUrl(text)) return   // a bare link waits for "Read page"
    // A saved resume for this very draft keeps its front door (1.4.109,
    // audit A-1/B-6): preparing loads the draft as the session, and the
    // Continue row — which exists to offer that resume — hides itself the
    // moment the session is the same text. While the offer stands, the
    // draft waits unprepared; typing changes the text (and its key) and
    // preparation resumes on its own.
    const r = loadSessionResume()
    if (r && r.idx > 0 && textKey(text) === r.key) return
    const t = setTimeout(() => prepareText(text), 1200)
    return () => clearTimeout(t)
  }, [text, st.voiceOverride, st.defaultVoice, st.langMode])

  const start = () => {
    if (!text.trim()) { toast(t('Paste or type something to listen to')); return }
    if (!s.active || s.text !== text) loadText(text)
    setEditing(false)
    void play()
  }

  const paste = async () => {
    try {
      const clip = await readClipboard()
      if (!clip.trim()) { toast(t('Clipboard is empty')); return }
      if (isJustUrl(clip)) { setWebUrl(normalizeUrl(clip)); return }
      setText(clip)
      // Paste = listen: load the new text and start playing right away (Oscar, 1.4.40)
      loadText(clip)
      setEditing(false)
      void play()
    } catch {
      toast(t('Clipboard blocked — long-press the box and choose Paste'))
    }
  }

  const cycleLang = () => {
    const order: (Lang | 'auto')[] = ['auto', 'en', 'es']
    const nextMode = order[(order.indexOf(st.langMode) + 1) % order.length]
    settings.set({ langMode: nextMode, voiceOverride: st.voiceOverride && nextMode !== 'auto' && voiceById(st.voiceOverride)?.lang !== nextMode ? null : st.voiceOverride })
    relangSession()
  }

  // The speed wheel (1.4.211, Oscar): the chip keeps its face —
  // gauge and number — but the number is a drum, the same wheel
  // the bubble's counter grew in 1.4.207. Drag up or down and
  // the rate rolls through the ladder in a loop, each detent
  // (26 px, as in the bubble) applying at once with a tick and
  // the number rolling in from the side it came; a tap steps one
  // up. The Speed sheet is gone — the wheel is the door, here as
  // in the bubble. A finer rate (any value up to 2.5) still
  // lives in Settings, on its own slider.
  const rateLabel = useRef<HTMLSpanElement>(null)
  const wheelDrag = useRef<{ y: number; idx: number; applied: number } | null>(null)
  const nearestStep = (rate: number) => {
    let best = 0, bd = Infinity
    RATE_STEPS.forEach((v, i) => { const dd = Math.abs(v - rate); if (dd < bd) { bd = dd; best = i } })
    return best
  }
  const rollRate = (idx: number, dir: number) => {
    setRate(RATE_STEPS[idx])
    const el = rateLabel.current
    if (el) el.animate([{ transform: `translateY(${dir * 6}px)`, opacity: 0.25 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 110, easing: 'ease-out' })
    try { navigator.vibrate?.(1) } catch { /* this surface has no haptics */ }
  }
  const onWheelDown = (e: RPE<HTMLButtonElement>) => {
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* a synthetic or stale pointer: the drag still tracks by hand */ }
    wheelDrag.current = { y: e.clientY, idx: nearestStep(settings.get().listenSpeed), applied: 0 }
  }
  const onWheelMove = (e: RPE<HTMLButtonElement>) => {
    const w = wheelDrag.current
    if (!w) return
    const total = Math.trunc((w.y - e.clientY) / 26)
    while (w.applied < total) { w.applied++; w.idx = (w.idx + 1) % RATE_STEPS.length; rollRate(w.idx, 1) }
    while (w.applied > total) { w.applied--; w.idx = (w.idx + RATE_STEPS.length - 1) % RATE_STEPS.length; rollRate(w.idx, -1) }
  }
  const onWheelUp = () => {
    const w = wheelDrag.current
    wheelDrag.current = null
    if (w && w.applied === 0) rollRate((w.idx + 1) % RATE_STEPS.length, 1)
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
  // 1.4.228 (Oscar): while the copy queue stands, the player's jump
  // seats become the line's track keys — the same swap the floating
  // panel makes. The line stands when the mode is on AND it holds
  // texts (turning the mode off erases it, so both of his return
  // conditions are this one count); the keys wake only while a
  // queued text holds the stage, so they never sit dead.
  const queueMode = st.copyQueue && q.items.length > 0
  const queueLive = q.currentId != null
  const wide = useMediaQuery('(min-width: 1100px)')
  const big = useMediaQuery('(min-width: 1500px)')
  const remaining = reading ? estimateSeconds(s.segments.slice(s.current).map((g) => g.text).join(' '), st.listenSpeed) : estimateSeconds(text, st.listenSpeed)

  return (
    <div className="page wide listen-page">
      <ListenHead text={reading ? s.text : text} lang={lang} playing={s.playing && reading} remaining={remaining} />

      {/* Phone: while anything sounds in the main listening area, the
          Continue card folds itself away (Oscar, 2026-11-14): the
          text takes the whole stage. When the audio stops, the card
          unfolds back — since 1.4.167 both ways on the immersive
          glide's own clock. Tablet (wide) has room to spare, so there
          the card never folds at all: it lives below the player, in
          the side column (Oscar, 2026-11-14) — rendered there, not
          here. */}
      {!wide && (
        <div className={`continue-fold${s.playing || s.buffering || cp.playing ? '' : ' open'}`} aria-hidden={s.playing || s.buffering || cp.playing}>
          <div className="set-fold-in">
            <ContinueRow onResume={() => setEditing(false)} />
          </div>
        </div>
      )}

      <div className="listen-grid">
        <div className="card" style={{ overflow: 'hidden' }}>
          {reading ? (
            <Reader onEdit={() => setEditing(true)} onKeep={() => setKeepOpen(true)} />
          ) : (
            <div className="editor">
              <textarea
                data-present="listen-editor"
                value={text}
                onChange={(ev) => setText(ev.target.value)}
                placeholder={t('Paste an article, a chapter, a poem — or share text here from any app…')}
                spellCheck={false}
                lang={lang}
                aria-label={t('Text to listen to')}
              />
              {isJustUrl(text) && (
                <button className="url-banner" onClick={() => setWebUrl(normalizeUrl(text))}>
                  <Globe size={17} /><span className="grow">{t('Bring the text from')} <b>{new URL(normalizeUrl(text)!).hostname.replace(/^www\./, '')}</b></span><span className="ub-go">{t('Read page')}</span>
                </button>
              )}
              <div className="editor-bar">
                <button className="icon-btn" data-present="listen-paste" onClick={paste} aria-label={t('Paste from clipboard')} title={t('Paste')}><ClipboardPaste size={21} /></button>
                <button className="icon-btn" data-present="listen-clear" onClick={() => { setText(''); endSession() }} disabled={!text} aria-label={t('Clear text')} title={t('Clear')}><Eraser size={21} /></button>
                <button className="icon-btn" data-present="listen-save" onClick={() => setKeepOpen(true)} disabled={!text.trim()} aria-label={t('Save to Library')} title={t('Save to Library')}><BookDown size={21} /></button>
                {s.active && <button className="icon-btn" data-present="listen-reading-view" onClick={() => { if (s.text !== text) loadText(text); setEditing(false) }} aria-label={t('Back to reading view')} title={t('Reading view')}><X size={21} /></button>}
                {text.trim() && <div className="editor-meta" aria-label={t('About {d} of listening, {n} words', { d: formatDuration(estimateSeconds(text, st.listenSpeed)), n: wordCount(text) })}>
                  <span className="em-time"><Clock size={12} strokeWidth={2.4} />{formatDuration(estimateSeconds(text, st.listenSpeed))}</span>
                  <span className="em-words">{t('{n} words', { n: wordCount(text).toLocaleString() })}</span>
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
            <button className={`chip lang-chip ${st.langMode === 'auto' ? '' : 'accent'}`} onClick={cycleLang} aria-label={t('Language')}>
              <Languages size={16} />
              <span className="chip-txt">{st.langMode === 'auto' ? <>Auto · {mixed ? 'EN + ES' : detected.lang.toUpperCase()}</> : LANG_LABEL[st.langMode]}</span>
            </button>
            <div className="player-top-r">
              <button className={`chip ${s.sleepLeft != null ? 'accent' : ''}`} data-present="listen-sleep-chip" onClick={() => setSleepOpen(true)} aria-label={t('Sleep timer')}><Moon size={15} />{s.sleepLeft != null ? formatDuration(s.sleepLeft) : null}</button>
              <button className="chip speed-chip" onPointerDown={onWheelDown} onPointerMove={onWheelMove} onPointerUp={onWheelUp} onPointerCancel={() => { wheelDrag.current = null }} onClick={(e) => { if (e.detail === 0) rollRate((nearestStep(settings.get().listenSpeed) + 1) % RATE_STEPS.length, 1) }} aria-label={t('Playback speed {x}', { x: fmtSpeed(st.listenSpeed) })}><Gauge size={15} /><span ref={rateLabel} style={{ display: 'inline-block' }}>{fmtSpeed(st.listenSpeed)}</span></button>
              {/* 1.4.203 (Oscar's determination): the voice chip that
                  stood here is GONE — it duplicated the voice choice
                  the desk below already gives, and this row was too
                  full to breathe. The copy queue takes its seat (the
                  row's last), and the desk's voices card gains the
                  door the chip held — the full picker — so the desk
                  is a real substitute, not a lesser one. The
                  .voice-chip class (and its anchor) follows the
                  deed to the desk; see desk.tsx. */}
              {/* 1.4.210 (Oscar's word): the queue's door STANDS
                  whether the queue is on or off. It used to vanish
                  when the queue was off and the line empty — the
                  very state in which he needs the door, since the
                  sheet behind it carries the switch that turns the
                  queue on. Off and empty it wears the bare icon;
                  the count and the accent come with the line. */}
              <button className={`chip ${q.items.length ? 'accent' : ''}`} data-present="listen-queue-chip" onClick={() => setQueueOpen(true)} aria-label={t('Copy queue')}><ListMusic size={15} />{q.items.length > 0 ? q.items.length : null}</button>
            </div>
          </div>

          <Visualizer />

          <ProgressLine />

          <div className="player-meta">
            <span>{reading ? t('Sentence {a} of {b}', { a: s.current + 1, b: s.segments.length }) : t('Ready')}</span>
            {/* 1.4.60: the voice's name lived in the chip above — naming it again here was pure repetition (Oscar). 1.4.201: the chip wore the voice icon instead. 1.4.203: the chip itself is gone (the desk below is the voice seat now); the name is said nowhere on this card, and only the device-voice state is still said. */}
            <span>{s.mode === 'device' ? t('Device voice · ') : ''}{t('{d} left', { d: formatDuration(remaining) })}</span>
          </div>

          <div className="transport">
            {/* 1.4.115 (Oscar): the seat at the player's left is the
                bottom-bar key. While the audio plays, the app is
                immersive and the bar below is gone — this key pins the
                bar back (the player glides up) without stopping the
                reading; tapped again, the bar slides away once more. */}
            {s.playing
              ? <button className="icon-btn" data-present="listen-nav-pin" onClick={() => navPin.set({ pinned: !pin.pinned })} aria-label={t(pin.pinned ? 'Hide the bottom bar' : 'Show the bottom bar')} title={t(pin.pinned ? 'Hide the bottom bar' : 'Show the bottom bar')}>{pin.pinned ? <PanelBottomClose size={20} /> : <PanelBottomOpen size={20} />}</button>
              : <span aria-hidden />}
            {queueMode
              ? <button className="icon-btn jump-key filled" data-present="listen-prev" onClick={() => stepQueue(-1)} disabled={!queueLive} aria-label={t('Previous in the queue')} title={t('Previous in the queue')}><SkipBack size={25} fill="currentColor" /></button>
              : <JumpKey dir="back" size={25} disabled={!reading} present="listen-prev" />}
            <button className={`play-btn ${s.buffering ? 'busy' : ''}`} onClick={reading ? toggle : start} aria-label={s.playing ? t('Pause') : t('Play')}>
              <span className="pb-icon" key={s.buffering ? 'b' : s.playing ? 'p' : 'l'}>{s.buffering ? <Loader2 size={32} className="spin" /> : s.playing ? <Pause size={34} fill="currentColor" /> : <Play size={34} fill="currentColor" style={{ marginLeft: 4 }} />}</span>
            </button>
            {queueMode
              ? <button className="icon-btn jump-key filled" data-present="listen-next" onClick={() => stepQueue(1)} disabled={!queueLive} aria-label={t('Next in the queue')} title={t('Next in the queue')}><SkipForward size={25} fill="currentColor" /></button>
              : <JumpKey dir="fwd" size={25} disabled={!reading} present="listen-next" />}
            <button className="icon-btn" data-present="listen-mark" onClick={doMark} disabled={!reading || markBusy} aria-label={t('Mark this moment')} title={t('Mark this moment')}><Bookmark size={20} /></button>
          </div>

          {s.mode === 'device' && s.playing && (
            <div className="engine-note"><span>{t('Using your device voice while the neural voice downloads. It switches over automatically.')}</span></div>
          )}
          {s.cushion && (
            <div className="engine-note">
              <span>
                {t('Preparing the audio so it reads to the end without stopping · {d} of {t} sentences', { d: s.cushion.done, t: s.cushion.total })}
                {s.cushion.eta != null ? t(' · about {w} left', { w: formatWait(s.cushion.eta) }) : t(' · measuring this phone’s speed')}{t('. Playback starts on its own.')}
              </span>
              <span className="bar"><i style={{ width: `${s.cushion.need > 0 ? Math.min(100, Math.round((s.cushion.have / s.cushion.need) * 100)) : 3}%` }} /></span>
            </div>
          )}
          {!s.playing && !s.cushion && s.active && s.text === text && s.segments.length > 0 && (() => {
            const ready = s.rendered.filter(Boolean).length
            return ready < s.segments.length ? (
              <div className="engine-note"><span>{t('Preparing the audio in the background · {r} of {n} sentences ready', { r: ready, n: s.segments.length })}</span><span className="bar"><i style={{ width: `${Math.round((ready / s.segments.length) * 100)}%` }} /></span></div>
            ) : <div className="engine-note"><span>{t('All audio ready · it will read without stopping')}</span></div>
          })()}
          <EngineNote />
          {s.error && <div className="error-note">{s.error}</div>}
          {e.status === 'error' && <div className="error-note">{t('Neural engine: ')}{e.error}</div>}
        </div>
        {wide && <ContinueRow onResume={() => setEditing(false)} />}
        {wide && <TabletDesk onOpen={(t) => { setText(t); setEditing(false) }} onVoice={() => setVoiceOpen(true)} />}
        </div>
        {big && <TextMap text={text} reading={reading} />}
      </div>

      <VoicePicker open={voiceOpen} onClose={() => setVoiceOpen(false)} value={st.voiceOverride} lang={st.langMode}
        onPick={(id) => { settings.set({ voiceOverride: id }); refreshVoices() }} />

      <WebImport open={webUrl !== null} onClose={() => setWebUrl(null)} initialUrl={webUrl ?? undefined} />
      <KeepSheet open={keepOpen} onClose={() => setKeepOpen(false)} text={reading ? s.text : text} lang={lang} />

      <Sheet open={markAsk} onClose={() => setMarkAsk(false)} title={t('Mark this moment')}>
        <p className="keepask-body">{t('This text is not in your Library yet. Save it to your Library and the mark stays with it. If you mark without saving, the mark lasts only while this text is open or playing — when the text is replaced, the mark is lost.')}</p>
        <div className="row" style={{ gap: 8, marginBottom: 8 }}>
          <button className="btn primary grow" onClick={() => void saveThenMark()}>{t('Save to Library')}</button>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost grow" onClick={() => setMarkAsk(false)}>{t('Cancel')}</button>
          <button className="btn ghost grow" onClick={() => { setMarkAsk(false); runMark() }}>{t('Mark anyway')}</button>
        </div>
      </Sheet>

      <Sheet open={sleepOpen} onClose={() => setSleepOpen(false)} title={t('Sleep timer')} present="listen-sleep-sheet">
        <div className="speed-row" style={{ marginBottom: 14 }}>
          <button className={s.sleepLeft == null ? 'on' : ''} onClick={() => setSleepTimer(null)}>{t('Off')}</button>
          {[10, 15, 20, 30, 45, 60].map((m) => <button key={m} className={s.sleepMins === m ? 'on' : ''} onClick={() => setSleepTimer(m)}>{m} min</button>)}
        </div>
        <p className="muted small" style={{ margin: '8px 4px 0' }}>{t('The last ten seconds fade down gently, then it pauses.')}</p>
      </Sheet>

      <Sheet open={queueOpen} onClose={() => setQueueOpen(false)} title={t('Copy queue')} present="listen-queue-sheet">
        <div className="row between" style={{ marginBottom: 6 }}>
          <div className="t">{t('Queue what I copy')}</div>
          <Switch label={t('Queue what I copy')} on={st.copyQueue} onChange={(v) => { void askQueueMode(v) }} />
        </div>
        <p className="muted small" style={{ margin: '0 4px 12px' }}>{t('On: every text you copy lines up behind the one playing, and the line plays through in order. Off: the line is erased and a copy takes the stage as always.')}</p>
        {q.items.length === 0
          ? <p className="muted" style={{ margin: '4px' }}>{t('The line is empty. Copy a text and it will stand here.')}</p>
          : <div>
              {q.items.map((it, i) => {
                const isCur = it.id === q.currentId
                return (
                  <div key={it.id} className={`qrow ${isCur ? 'cur' : ''}`} data-present="listen-queue-row">
                    <button className="qrow-main" onClick={() => { playQueueAt(i); setQueueOpen(false) }} aria-label={t('Play this one')}>
                      {isCur ? <AudioLines size={16} /> : <Play size={16} />}
                      <span className="qrow-title">{it.title || t('Copied text')}</span>
                      <span className="muted small">{formatDuration(it.secs)}</span>
                    </button>
                    {it.kind === 'copy' && <button className="icon-btn" onClick={() => { void (async () => { if (await confirmAsk(t('Save to Listen later'), t('"{x}" will be saved in the Library to hear later.', { x: it.title || t('Copied text') }), t('Save'))) void saveQueueItemToLater(it) })() }} aria-label={t('Save to Listen later')} title={t('Save to Listen later')}><BookDown size={17} /></button>}
                    <button className="icon-btn" onClick={() => { void (async () => { if (await confirmAsk(t('Remove from the queue'), t('"{x}" will leave the line.', { x: it.title || t('Copied text') }), t('Remove'))) dropQueueItem(it.id) })() }} aria-label={t('Remove from the queue')} title={t('Remove')}><X size={17} /></button>
                  </div>
                )
              })}
              <div className="row" style={{ gap: 8, marginTop: 12 }}>
                <button className="btn primary" style={{ flex: 1 }} onClick={() => { void sendQueueToLater(); setQueueOpen(false) }}>{t('Send all to Listen later')}</button>
                <button className="btn ghost" onClick={() => { void (async () => { if (await confirmAsk(t('Empty the queue'), t('Every text in the line will be removed. What is playing keeps playing.'), t('Empty it'))) clearQueue() })() }}>{t('Clear')}</button>
              </div>
            </div>}
      </Sheet>
    </div>
  )
}

function ProgressLine() {
  const s = useStore(listen)
  const [, force] = useState(0)
  // The scrub hold (cure M-4): while the listener drags, the hold —
  // not the store — decides what the thumb shows, so the playhead's
  // own updates can't snap the thumb back mid-drag; on release the
  // hold hands out the seek fraction exactly once.
  const hold = useRef(new ScrubHold())
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
  const shown = hold.current.display(done)
  const fracAt = (x: number) => {
    const r = bar.current!.getBoundingClientRect()
    return Math.max(0, Math.min(1, (x - r.left) / r.width))
  }
  const target = drag !== null ? Math.min(n - 1, Math.floor(drag * n)) : null
  return (
    <div
      ref={bar}
      className={`scrubber ${drag !== null ? 'dragging' : ''} ${s.active ? '' : 'off'}`}
      role="slider" aria-label={t('Position')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(shown * 100)}
      tabIndex={s.active ? 0 : -1}
      onPointerDown={(e) => { if (!s.active) return; e.currentTarget.setPointerCapture(e.pointerId); setDrag(hold.current.begin(fracAt(e.clientX))) }}
      onPointerMove={(e) => { if (hold.current.active) setDrag(hold.current.move(fracAt(e.clientX))) }}
      onPointerUp={(e) => { const f = hold.current.end(fracAt(e.clientX)); setDrag(null); if (f !== null) seekFraction(f) }}
      onPointerCancel={() => { hold.current.cancel(); setDrag(null) }}
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
          {t('Sentence {a} of {b}', { a: target + 1, b: n })}{s.rendered[target] ? '' : t(' · not ready yet')}
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
  // The reader's text size lives in one CSS variable on the reader box.
  useEffect(() => { box.current?.style.setProperty('--rscale', String(st.readerScale)) }, [st.readerScale])
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
        <span className="rh-hint">{t('Tap a word to start there.')}</span>
        <div className="rh-actions">
          <button className="rh-btn" data-present="listen-text-smaller" aria-label={t('Smaller text')} disabled={st.readerScale <= READER_SCALES[0]} onClick={() => settings.set({ readerScale: stepReaderScale(st.readerScale, -1) })}><span style={{ fontSize: 10, fontWeight: 700 }}>A</span><span aria-hidden="true">−</span></button>
          <button className="rh-btn" data-present="listen-text-bigger" aria-label={t('Bigger text')} disabled={st.readerScale >= READER_SCALES[READER_SCALES.length - 1]} onClick={() => settings.set({ readerScale: stepReaderScale(st.readerScale, 1) })}><span style={{ fontSize: 15, fontWeight: 700 }}>A</span><span aria-hidden="true">+</span></button>
          <button className="rh-btn" data-present="listen-reader-save" onClick={onKeep} aria-label={t('Save to Library')}><BookDown size={13} /><span className="rh-label">{t('Save')}</span></button>
          <button className="rh-btn" data-present="listen-reader-edit" onClick={onEdit}><PenLine size={13} /><span className="rh-label">{t('Edit')}</span></button>
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
    // R2-T3-5: pos never travels alone. M-7's cure made the reader's
    // saver write the pos+progress+done triple as one truth; this door
    // wrote { pos } only, so a finished book listened back at a third
    // kept progress 1 / done true — the shelf called it Finished while
    // its saved place sat a third in. Same derivation as BookPage's
    // saver: the pair is computed from the FRESH record and the live
    // place, with the book's chapters fetched for the word count.
    void (async () => {
      const content = await getContent(book.id).catch(() => null)
      await updateBook(book.id, (cur) => ({ pos: at, ...progressPatch(cur, progressAt(cur, content?.chapters ?? null, at)) }), false)
    })().finally(() => { location.hash = `#/book/${encodeURIComponent(book.id)}` })
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
        <div className="lh-eyebrow"><span className="lh-dot" /><span>{t('Web page')}</span></div>
        <div className="lh-title">{host}</div>
        <div className="lh-sum">{t('Tap Read page to bring in its text, clean and ready to hear.')}</div>
      </div>
    )
  }
  return (
    <div className={`listen-head ${playing ? 'live' : ''}`}>
      <div className="lh-eyebrow">
        <span className="lh-dot" />
        <span>{has ? (playing ? t('Now reading') : t('Ready to read')) : t('Listen')}</span>
        {has ? <span className="lh-meta">{t('{n} words · {d} · {l}', { n: words.toLocaleString(), d: formatDuration(remaining), l: LANG_LABEL[lang] })}</span> : null}
      </div>
      {book
        ? <button className="lh-book" data-present="listen-back-to-book" onClick={backToBook} aria-label={t('Back to {title}', { title: book.title })}>
            <BookOpen size={17} />
            <span className="lh-book-t" lang={lang}>{book.title}</span>
            <span className="lh-book-go">{t('Back to book')}</span>
          </button>
        : <div className="lh-title" lang={lang}>{title || t('Paste anything. Hear it instantly.')}</div>}
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
    toast(r === 'queued' ? t('Queued for your Library · it starts after the current one') : t('Making the audio · it will be in your Library'), { label: t('Library'), run: () => navigate('library') }, 5000)
  }
  const later = async () => {
    await saveForLater(text, { title: info.title, summary: info.summary, lang, voice: st.voiceOverride ?? '', duration: estimateSeconds(text, 1) })
    onClose()
    toast(t('Saved to Listen later'), { label: t('Library'), run: () => navigate('library') }, 4000)
  }
  return (
    <Sheet open={open} onClose={onClose} title={t('Keep this')} present="listen-keep-sheet">
      <div className="keep-title">{info.title}</div>
      <div className="keep-sub">{t('{n} words · about {d} at {s}', { n: words.toLocaleString(), d: formatDuration(estimateSeconds(text, speed)), s: fmtSpeed(speed) })}</div>
      <div className="keep-opts">
        <button className="keep-opt" data-present="listen-keep-audio" onClick={saveAudio}>
          <span className="keep-ic"><AudioLines size={22} /></span>
          <span className="grow">
            <b>{t('Save the audio')}</b>
            <small>{t('{f} in {v}', { f: st.format.toUpperCase(), v: v?.name ?? t('your voice') })}{st.voiceOverride ? '' : t(' (switches by language)')}{t(' · plays offline, ready to share')}{busy ? t(' · queued after the current one') : ''}</small>
          </span>
        </button>
        <button className="keep-opt" data-present="listen-keep-later" onClick={() => void later()}>
          <span className="keep-ic"><Clock size={22} /></span>
          <span className="grow">
            <b>{t('Listen later')}</b>
            <small>{t('Saves the text instantly. Make its audio whenever you like')}</small>
          </span>
        </button>
      </div>
      {(hasAudio || hasLater) && (
        <button className="keep-note" data-present="listen-keep-note" onClick={() => { onClose(); navigate('library') }}>
          <LibraryIcon size={16} /> {hasAudio ? t('This text is already in your Library as audio') : t('This text is already in Listen later')} · {t('Open')}
        </button>
      )}
    </Sheet>
  )
}
