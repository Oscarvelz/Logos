// Listen-on-the-fly controller: sentence-chunked streaming with look-ahead
// synthesis, a single <audio> element (background + lock-screen friendly),
// Media Session controls, and a device-voice bridge while the neural voice downloads.
import { createStore } from '../lib/store.ts'
import { settings } from '../lib/settings.ts'
import { segmentText, speakable, estimateSeconds, pauseAfter, type Segment } from '../lib/text.ts'
import { voiceById, type Lang } from '../lib/voices.ts'
import { encodeWav, envelope, silence, trimSilence, concat, applyGain, levelGain } from '../lib/audio.ts'
import { engine, ensureModel, synthesize, promote } from '../engine/engine.ts'
import { speakDevice, cancelDevice, deviceSpeechAvailable } from '../engine/device-voice.ts'
import { stopClipPlayer, onClipPlay, clipPlayer, pauseClip, resumeClip, stepClip } from './clip.ts'
import { nowReadingFor } from '../lib/book/nowreading.ts'
import { t } from '../lib/i18n.ts'
import { alignWords } from './wordsync.ts'
import { renderKey, getPersistedRender, putPersistedRender, hasPersistedRender, dropPersistedRender } from './rendercache.ts'

type Rendered = { blob: Blob; env: Float32Array; duration: number; voice: string }

// ── Continuous playback ──
// Android only treats a page as a media player (notification, lock screen,
// keeps running in the background) when the audio is longer than a few
// seconds. Sentences are short, so the ready sentences from the playhead on
// are joined into ONE audio file (a "track") and played as a whole; the
// current sentence is followed from the playback time.
type Track = { url: string; start: number; end: number; offs: number[] }
let track: Track | null = null

function wavHeader(dataBytes: number, sampleRate: number): ArrayBuffer {
  const buf = new ArrayBuffer(44)
  const v = new DataView(buf)
  const w = (o: number, t: string) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)) }
  w(0, 'RIFF'); v.setUint32(4, 36 + dataBytes, true); w(8, 'WAVE')
  w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  w(36, 'data'); v.setUint32(40, dataBytes, true)
  return buf
}

/** Join the ready sentences from `i` on into one track. */
function buildTrack(i: number): Track {
  dropTrack()
  const parts: Blob[] = []
  const offs: number[] = []
  let t = 0
  let bytes = 0
  let j = i
  while (cache.has(j)) {
    const r = cache.get(j)!
    offs.push(t)
    t += r.duration
    const body = r.blob.slice(44)
    bytes += body.size
    parts.push(body)
    j++
  }
  const sr = 24000
  track = { url: URL.createObjectURL(new Blob([wavHeader(bytes, sr), ...parts], { type: 'audio/wav' })), start: i, end: j, offs: [...offs, t] }
  return track
}
function dropTrack() {
  if (track) { URL.revokeObjectURL(track.url); track = null }
}
const onTrack = () => Boolean(track && audio && audio.src === track.url)
/** Seconds into the current sentence. */
function localTime(): number {
  if (!track || !audio) return 0
  const s = listen.get()
  const k = s.current - track.start
  return k >= 0 && k < track.offs.length ? Math.max(0, audio.currentTime - track.offs[k]) : 0
}
/** Follow the playback time: update the current sentence when it changes. */
function syncCurrent() {
  if (!onTrack() || !audio || audio.paused || audio.seeking) return
  const t = audio.currentTime
  const offs = track!.offs
  let k = 0
  while (k + 1 < offs.length - 1 && offs[k + 1] <= t + 0.01) k++
  const idx = track!.start + k
  const s = listen.get()
  if (idx !== s.current && s.mode === 'neural') {
    // Time following the audio may only STEP to the next sentence, never
    // leap: the playhead crosses boundaries one at a time. (Oscar's video,
    // 2026-11-08: the panel's counter sprinted 4 → 12 while the app stood
    // at 4 — somewhere the position teleported. A leap is now impossible
    // on this road whatever clock or offset glitch asks for it.)
    listen.set({ current: idx > s.current ? Math.min(idx, s.current + 1) : idx })
    updateMediaSession()
  }
}

export type ListenState = {
  active: boolean
  text: string
  segments: Segment[]
  voices: string[]
  current: number
  playing: boolean
  buffering: boolean
  mode: 'neural' | 'device' | null
  rendered: boolean[]
  error: string | null
  finished: boolean
  /** while preparing audio before playback: seconds ready vs. needed, and estimated seconds left */
  cushion: { have: number; need: number; eta: number | null; done: number; total: number } | null
  /** sleep timer: seconds left, or null when off */
  sleepLeft: number | null
  /** the duration chosen for the sleep timer, so its sheet can mark it */
  sleepMins: number | null
}

export const listen = createStore<ListenState>({
  active: false, text: '', segments: [], voices: [], current: 0, playing: false,
  buffering: false, mode: null, rendered: [], error: null, finished: false, cushion: null, sleepLeft: null, sleepMins: null,
})

const LISTEN_PRIORITY = 1000
let audio: HTMLAudioElement | null = null
let cache = new Map<number, Rendered>()
let pending = new Map<number, { promise: Promise<Rendered>; ctrl: AbortController }>()
// Sentences the device voice already rescued once this session — a wedged
// neural engine earns one rescue per sentence, never a loop.
const fellBack = new Set<number>()
let session = 0
let token = 0
// 'pause' events are dispatched asynchronously, so count the pauses we cause
// ourselves and ignore exactly that many; anything else is a system pause.
let internalPauses = 0
// Measured speed of the voice engine on this device (render time per second of audio).
// Render speed (seconds of compute per second of audio), measured over the
// last few sentences only. The first synthesis after a model loads can take
// ten times as long as the rest; the old lifetime average let that one
// warm-up poison every later estimate, and the cushion then demanded nearly
// the whole text rendered before the first sound — minutes of 'Processing…'
// that were not a hang at all, just an invisible, oversized head start.
const rtfWindow: { ms: number; sec: number }[] = []
const deviceRtf = () => {
  const ms = rtfWindow.reduce((a, r) => a + r.ms, 0)
  const sec = rtfWindow.reduce((a, r) => a + r.sec, 0)
  return sec > 3 ? ms / 1000 / sec : engine.get().lastRtf ?? 0
}

// ── Background keep-alive ──
// Android freezes a page that is in the background and not playing sound, which
// stopped the voice engine while you waited in another app. While audio is being
// prepared, Logos plays an inaudible track on the same <audio> element: the page
// counts as playing media (lock-screen controls included), keeps rendering, and
// switches straight to the speech when it's ready, no tap needed.
let keepAliveUrl: string | null = null
function keepAliveSrc(): string {
  if (keepAliveUrl) return keepAliveUrl
  // 30 s long: Android shows the media notification (and keeps the app
  // running) only for audio longer than a few seconds.
  const sr = 8000
  const x = new Float32Array(sr * 30)
  // ~-80 dB noise: silent to the ear, but not digital silence (which some
  // browsers treat as "not playing").
  for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * 1e-4
  keepAliveUrl = URL.createObjectURL(encodeWav(x, sr))
  return keepAliveUrl
}
function keepAlive() {
  const a = el()
  if (a.src === keepAliveSrc() && !a.paused) return
  a.loop = true
  a.src = keepAliveSrc()
  a.play().catch(() => { /* not allowed yet: rendering still runs while visible */ })
}

function quietPause() {
  if (!audio || audio.paused) return
  internalPauses++
  audio.pause()
}

function el(): HTMLAudioElement {
  if (audio) return audio
  audio = new Audio()
  audio.preload = 'auto'
  ;(audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true
  audio.addEventListener('ended', () => {
    const s = listen.get()
    if (s.mode !== 'neural' || !s.playing) return
    // No catch-up teleport here: this handler used to snap the position to
    // the track's last sentence in one step — the same leap the clamp in
    // syncCurrent now forbids. advance() steps from where the playhead
    // honestly is.
    advance()
  })
  audio.addEventListener('pause', () => {
    // A system pause (headphones unplugged, lock-screen button) must reflect in the UI.
    if (!audio) return
    if (internalPauses > 0) { internalPauses--; return }
    const s = listen.get()
    if (s.mode === 'neural' && s.playing && !audio.ended && audio.currentTime < (audio.duration || Infinity) - 0.05) {
      listen.set({ playing: false })
      updateMediaSession()
    }
  })
  audio.addEventListener('emptied', () => { internalPauses = 0 })
  audio.addEventListener('play', () => {
    const s = listen.get()
    if (!s.playing && s.mode === 'neural') listen.set({ playing: true })
    updateMediaSession()
  })
  audio.addEventListener('timeupdate', () => { syncCurrent(); updatePosition() })
  return audio
}

export function voiceFor(lang: Lang): string {
  const s = settings.get()
  const override = voiceById(s.voiceOverride ?? undefined)
  if (override && (override.lang === lang || s.langMode !== 'auto')) return override.id
  return s.defaultVoice[lang]
}

function resetCache() {
  pending.forEach((p) => p.ctrl.abort())
  pending = new Map()
  dropTrack()
  cache = new Map()
  fellBack.clear()
}

/** Prepare a new listening session from text (does not start playback). */
export function loadText(text: string) {
  stop()
  setSleepTimer(null)
  resetCache()
  session++
  const segments = segmentText(text, settings.get().langMode)
  listen.set({
    active: segments.length > 0, text, segments, voices: segments.map((s) => voiceFor(s.lang)),
    current: 0, playing: false, buffering: false, mode: null, rendered: segments.map(() => false), error: null, finished: false, cushion: null,
  })
}

/** Start preparing audio for text as soon as it is pasted (before play is pressed). */
export function prepareText(text: string) {
  const s = listen.get()
  if (s.playing || s.text === text || !text.trim()) return
  loadText(text)
  if (!listen.get().active) return
  const go = () => prefetch(0)
  if (engine.get().status === 'ready') go()
  else ensureModel().then(() => { if (listen.get().text === text && !listen.get().playing) go() }).catch(() => {
    // The saved processing does not need the model (1.4.112): when this
    // text's first sentence is already rendered on disk, prepare from
    // the cache anyway — unsaved sentences fail quietly inside prefetch,
    // exactly as render errors always have.
    const st = listen.get()
    if (st.text !== text || st.playing || !st.segments.length) return
    const spoken = speakable(st.segments[0].text, st.segments[0].lang)
    if (!spoken) return
    void hasPersistedRender(renderKey(spoken, st.voices[0])).then((has) => {
      if (has && listen.get().text === text && !listen.get().playing) go()
    })
  })
}

/** Re-resolve voices (after a voice change) and restart the current sentence if playing. */
export function refreshVoices() {
  const s = listen.get()
  if (!s.active) return
  const voices = s.segments.map((seg) => voiceFor(seg.lang))
  if (!voices.some((v, i) => v !== s.voices[i])) return
  resetCache()
  session++
  listen.set({ voices, rendered: s.segments.map(() => false) })
  if (s.playing) void play(s.current)
}

/** Re-segment with the current language mode, keeping the reading position. */
export function relangSession() {
  const s = listen.get()
  if (!s.active) return
  const wasPlaying = s.playing
  const at = s.segments[s.current]?.start ?? 0
  loadText(s.text)
  const idx = Math.max(0, listen.get().segments.findIndex((g) => g.end > at))
  listen.set({ current: idx })
  if (wasPlaying) void play(idx)
}

const PLAYHEAD_PRIORITY = 2000

/** A render that came back as digital silence is not speech (1.4.122).
 *  A wedged engine — or one voice's missing model — can return zeros of
 *  exactly the right duration; every downstream system (the clock, the
 *  word highlight, the sentence counter) then "plays" a sentence nobody
 *  hears, which is precisely the failure Oscar kept meeting: sentences
 *  advancing, the wave flat, no sound — the English sentences of a
 *  Spanish text among them. The judgment is made on the SAMPLES' own
 *  peak (1.4.123): the envelope cannot testify, because envelope()
 *  peak-normalizes — a whisper of noise wears a full-height envelope,
 *  and the first version of this detector, which judged the envelope,
 *  caught exact zeros and missed near-silence. Real speech, even
 *  levelled quiet speech, peaks far above this floor; silence is 0. */
const renderSilent = (peak: number): boolean => peak < 0.005

/** Peak absolute value of a sample buffer — the loudness witness. */
const peakAbs = (samples: Float32Array): number => {
  let peak = 0
  for (let k = 0; k < samples.length; k++) { const a = Math.abs(samples[k]); if (a > peak) peak = a }
  return peak
}

function render(i: number, priority: number): Promise<Rendered> {
  const hit = cache.get(i)
  if (hit) return Promise.resolve(hit)
  const p = pending.get(i)
  if (p) { promote(p.ctrl.signal, priority); return p.promise }
  const s = listen.get()
  const seg = s.segments[i]
  const voice = s.voices[i]
  const ctrl = new AbortController()
  const mySession = session
  const promise = (async () => {
    // What the voice actually says: the sentence cleaned for speech (codes named,
    // not spelled; machine file names dropped) and run through the reader's
    // pronunciation dictionary. A sentence that was only a code becomes a breath
    // of silence instead of a spelling bee.
    const spoken = speakable(seg.text, seg.lang)
    // The saved processing (1.4.112): a sentence rendered before — in a
    // past session, another day, another book — plays from disk and is
    // never rendered twice. The key is the spoken string + the voice,
    // so a dictionary edit or a voice change correctly misses.
    const key = spoken ? renderKey(spoken, voice) : null
    if (key) {
      const saved = await getPersistedRender(key)
      if (saved && renderSilent(saved.peak)) {
        // Poisoned on a bad night and served forever since: evict it
        // and render the sentence fresh below.
        dropPersistedRender(key)
      } else if (saved) {
        if (mySession !== session) throw new DOMException('stale', 'AbortError')
        const r: Rendered = { blob: saved.blob, env: saved.env, duration: saved.duration, voice }
        cache.set(i, r)
        pending.delete(i)
        listen.set((st) => { const rendered = st.rendered.slice(); rendered[i] = true; return { rendered } })
        return r
      }
    }
    const res = spoken
      ? await synthesize(spoken, voice, 1, { priority, signal: ctrl.signal })
      : { samples: silence(300, 24000), sampleRate: 24000, ms: 0 }
    rtfWindow.push({ ms: res.ms, sec: res.samples.length / res.sampleRate })
    if (rtfWindow.length > 8) rtfWindow.shift()
    const trimmed = trimSilence(res.samples, res.sampleRate)
    const pauseMs = pauseAfter(seg, settings.get().sentencePauseMs)
    const joined = concat([trimmed, silence(pauseMs, res.sampleRate)])
    // Level each sentence toward a common loudness, so a long book sounds even.
    const full = applyGain(joined, levelGain(joined))
    const r: Rendered = {
      blob: encodeWav(full, res.sampleRate),
      env: envelope(full, res.sampleRate, 60),
      duration: full.length / res.sampleRate,
      voice,
    }
    if (spoken && renderSilent(peakAbs(full))) {
      // The voice rendered silence: never cache it, never save it —
      // fail the render so the caller's rescue (the shell's device
      // voice, 1.4.122) takes the sentence instead.
      pending.delete(i)
      throw new Error('the voice rendered silence')
    }
    if (mySession !== session) throw new DOMException('stale', 'AbortError')
    cache.set(i, r)
    if (key) putPersistedRender(key, r.blob)
    pending.delete(i)
    listen.set((st) => { const rendered = st.rendered.slice(); rendered[i] = true; return { rendered } })
    return r
  })()
  promise.catch(() => { if (pending.get(i)?.promise === promise) pending.delete(i) })
  pending.set(i, { promise, ctrl })
  return promise
}

// Prepare audio ahead of the playhead in the background (sentence by sentence,
// in a worker), in a bounded window that follows the playhead — whole-book
// sessions would otherwise try to hold hours of rendered audio in memory.
function lookahead() {
  return 400
}

function prefetch(from: number) {
  const s = listen.get()
  const end = Math.min(s.segments.length - 1, from + lookahead())
  // Abort queued work outside the new window so seeks feel instant.
  pending.forEach((p, idx) => { if (idx < from || idx > end) { p.ctrl.abort(); pending.delete(idx) } })
  // Nearer sentences first; the sentence at the playhead outranks everything.
  for (let i = from; i <= end; i++) render(i, i === s.current ? PLAYHEAD_PRIORITY : LISTEN_PRIORITY - (i - from)).catch(() => {})
}

const neuralUsable = () => engine.get().status === 'ready'

export async function play(from?: number) {
  const s = listen.get()
  if (!s.active) return
  // The page taking the stage silences the shell's voice (1.4.128):
  // two drivers, one stage — a press on Play here is also a stop
  // there, whichever road the shell's voice took the stage by.
  stopShellVoice()
  stopClipPlayer()
  let idx = from ?? (s.finished ? 0 : s.current)
  if (idx >= s.segments.length) idx = 0
  if (!neuralUsable()) {
    const st = settings.get()
    if (st.autoDownload || engine.get().cached) ensureModel().catch(() => {})
    if (st.deviceFallback && deviceSpeechAvailable() && !cache.has(idx)) {
      void playDevice(idx)
      return
    }
  }
  await playIndex(idx)
}

async function playIndex(i: number, startFrac = 0, startWord?: { w: number; words: string[] }) {
  cancelDevice()
  const s = listen.get()
  if (i < 0 || i >= s.segments.length) return
  const my = ++token
  const stalled = !cache.has(i)
  if (stalled) keepAlive()
  else quietPause()
  dropTrack()
  listen.set({ current: i, playing: true, mode: 'neural', finished: false, error: null, buffering: stalled })
  updateMediaSession()
  if (!neuralUsable()) ensureModel().catch((e) => { if (my === token) listen.set({ playing: false, buffering: false, error: (e as Error).message }) })
  // Whole-book sessions: bound the rendered cache — drop sentences far behind
  // the playhead (30 stay for stepping back) and far beyond the lookahead.
  // Stepping back to a dropped sentence simply renders it again.
  for (const k of [...cache.keys()]) if (k < i - 30 || k > i + 460) cache.delete(k)
  prefetch(i)
  let r: Rendered
  try {
    r = await render(i, PLAYHEAD_PRIORITY)
  } catch (err) {
    if (my !== token || (err as Error).name === 'AbortError') return
    if (!listen.get().playing) return
    // A voice that renders silence (1.4.122) has failed as surely as
    // one that throws — hand the session to the shell's real device
    // voice, whatever the page-bridge toggle says.
    if ((err as Error).message === 'the voice rendered silence' && handToShell(i)) return
    // A wedged voice engine must never leave the listener in silence: the
    // device voice reads this sentence while the engine heals itself.
    if (settings.get().deviceFallback && deviceSpeechAvailable() && !fellBack.has(i)) {
      fellBack.add(i)
      void playDevice(i)
      return
    }
    listen.set({ playing: false, buffering: false, error: (err as Error).message })
    return
  }
  if (my !== token || listen.get().current !== i || !listen.get().playing) return
  // We ran dry. If this phone renders slower than it speaks, build a head start
  // big enough to play the rest without stopping, instead of a pause after every
  // sentence. A sentence that is already rendered (going back, seeking, tapping
  // a sentence) plays at once.
  if (stalled && !allReadyFrom(i)) {
    const ok = await buildCushion(i, my)
    if (!ok) return
  }
  const a = el()
  a.loop = false
  const tr = buildTrack(i)
  a.src = tr.url
  const startT = startWord ? wordStart(r, startWord.w, startWord.words) : startFrac * r.duration
  if (startT > 0) await setTimeWhenReady(a, startT)
  if (my !== token) return
  a.playbackRate = settings.get().listenSpeed
  listen.set({ buffering: false })
  try {
    await a.play()
  } catch (err) {
    if (my !== token) return
    listen.set({ playing: false, error: (err as Error).name === 'NotAllowedError' ? 'Tap play to start audio.' : (err as Error).message })
  }
}

function setTimeWhenReady(a: HTMLAudioElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const go = () => { try { a.currentTime = t } catch { /* ignore */ } resolve() }
    if (a.readyState >= 1) go()
    else { a.addEventListener('loadedmetadata', go, { once: true }); setTimeout(resolve, 1500) }
  })
}

// Preload mode: hold playback until enough audio is ready that it can read to
// the END without stopping, however long that takes on this phone. The amount
// is recomputed from the measured speed after every sentence.
function allReadyFrom(i: number) {
  const n = listen.get().segments.length
  for (let k = i; k < n; k++) if (!cache.has(k)) return false
  return true
}

async function buildCushion(i: number, my: number): Promise<boolean> {
  const s0 = listen.get()
  const segs = s0.segments
  const still = () => my === token && listen.get().current === i && listen.get().playing
  const total = segs.length - i
  const estOf = (k: number) => estimateSeconds(speakable(segs[k].text) || segs[k].text, 1)
  let have = 0 // seconds of audio ready from the playhead on
  let estReady = 0 // word-based estimate of the same sentences (to calibrate)
  let j = i
  const wake = await keepAwake()
  const t0 = Date.now()
  try {
    for (;;) {
      if (j >= segs.length) break
      const r = deviceRtf() // render seconds per second of audio
      if (r > 0) {
        const rate = settings.get().listenSpeed
        const calib = estReady > 2 ? have / estReady : 1
        let rest = 0
        for (let k = j; k < segs.length; k++) rest += estOf(k)
        rest *= calib
        // To never stop: ready audio A must cover R·(r·rate − 1) plus one sentence of slack (10% margin).
        const k = Math.max(0, 1.1 * (r * rate - 1))
        const slack = 3
        const deficit = (rest * k + slack - have) / (1 + k)
        if (deficit <= 0) break
        listen.set({ cushion: { have, need: have + deficit, eta: deficit * r, done: j - i, total } })
      } else {
        listen.set({ cushion: { have, need: 0, eta: null, done: j - i, total } })
      }
      try {
        const out = await render(j, PLAYHEAD_PRIORITY - (j - i))
        have += out.duration
        estReady += estOf(j)
      } catch { break }
      if (!still()) return false
      // The first sound may not be held hostage: after this long, play with
      // whatever head start exists and keep rendering ahead during playback.
      // Running dry later shows an honest per-sentence Processing… — never
      // one endless silence up front.
      if (Date.now() - t0 > 25_000) break
      j++
    }
    return still()
  } finally {
    listen.set({ cushion: null })
    wake?.release().catch(() => {})
  }
}

// Keep the screen on while preparing: Android slows or freezes background work.
async function keepAwake(): Promise<{ release(): Promise<void> } | null> {
  try {
    const wl = (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock
    return wl ? await wl.request('screen') : null
  } catch { return null }
}

function advance() {
  const s = listen.get()
  const nxt = s.current + 1
  if (nxt >= s.segments.length) { finish(); return }
  if (s.mode === 'device' && !(neuralUsable() && cache.has(nxt))) { void playDevice(nxt); return }
  void playIndex(nxt)
}

function finish() {
  listen.set({ playing: false, finished: true, buffering: false })
  updateMediaSession()
}

// ── Device-voice bridge (speechSynthesis) ──

/** Hand the session to the shell's real device voice (1.4.122): the
 *  page stops, the shell's Android TTS takes the text from sentence i,
 *  switching language sentence by sentence. False where there is no
 *  shell (a real browser), whose own speech bridge is honest. */
function handToShell(i: number): boolean {
  const d = (window as unknown as { LogosAndroid?: { bubbleNative?: (t: string, ti: string, ix: number) => void } }).LogosAndroid
  if (typeof d?.bubbleNative !== 'function') return false
  const s = listen.get()
  ++token
  quietPause()
  listen.set({ current: i, playing: false, mode: 'device', finished: false, buffering: false, error: null })
  updateMediaSession()
  d.bubbleNative(s.text, '', i)
  return true
}

async function playDevice(i: number) {
  const s = listen.get()
  // In the Android app, the page's own speechSynthesis is a trap
  // (1.4.122): inside a WebView it can run a sentence to "completion"
  // without producing any sound at all. The shell owns a real device
  // voice — Android TTS, switching language sentence by sentence —
  // so hand the session over at this sentence and let it read. Real
  // browsers keep the bridge below.
  if (handToShell(i)) return
  const my = ++token
  quietPause()
  listen.set({ current: i, playing: true, mode: 'device', finished: false, buffering: false, error: null })
  updateMediaSession()
  if (neuralUsable()) prefetch(i + 1)
  const seg = s.segments[i]
  const ok = await speakDevice(seg.text, seg.lang, settings.get().listenSpeed)
  if (my !== token || !listen.get().playing) return
  if (!ok) {
    // No usable device voice: wait for the neural voice instead.
    void playIndex(i)
    return
  }
  advance()
}

// Once the neural voice is ready mid-session, render ahead so the next sentence boundary can switch over.
engine.subscribe(() => {
  const s = listen.get()
  if (engine.get().status === 'ready' && s.mode === 'device' && s.playing && pending.size === 0 && cache.size === 0) {
    prefetch(s.current + 1)
  }
})

// ── Transport ──

export function pause() { pauseImpl(false) }

/** A pause arriving FROM the shell (1.4.124): it must never echo back.
 *  When the shell's own voice pauses, it pokes the page as a courtesy
 *  (1.4.120) — if that poke returned as a stop order, his pause would
 *  become a full stop of the native session. */
export function pauseFromShell() { pauseImpl(true) }

function pauseImpl(fromShell: boolean) {
  const s = listen.get()
  if (!s.playing) {
    // A session handed to the shell's voice is paused on the page but
    // still reading in the shell. A stop spoken on the page's side —
    // the sleep timer's word above all — is a stop for the whole
    // house (1.4.124): the shell voice stops too.
    if (!fromShell && s.mode === 'device') stopShellVoice()
    return
  }
  listen.set({ playing: false })
  if (s.mode === 'device') { token++; cancelDevice(); if (!fromShell) stopShellVoice() } else quietPause()
  updateMediaSession()
}

/** Tell the shell its voice's session is over (1.4.124). Older shells
 *  simply do not have the door; the call fades away harmlessly. */
function stopShellVoice() {
  const d = (window as unknown as { LogosAndroid?: { bubbleNativeStop?: () => void } }).LogosAndroid
  try { d?.bubbleNativeStop?.() } catch { /* a stale shell ignores it */ }
}

export function resume() {
  const s = listen.get()
  if (s.playing) return
  if (s.mode === 'neural' && audio?.src && !s.finished && onTrack() && s.current >= track!.start && s.current < track!.end && !audio.ended) {
    stopClipPlayer()
    listen.set({ playing: true })
    audio.playbackRate = settings.get().listenSpeed
    audio.play().catch(() => listen.set({ playing: false }))
    return
  }
  void play(s.finished ? 0 : s.current)
}

export function toggle() {
  if (listen.get().playing) pause()
  else resume()
}

export function seek(i: number) {
  const s = listen.get()
  if (!s.active) return
  void play(Math.max(0, Math.min(s.segments.length - 1, i)))
}

/** Where word `w` begins inside a rendered sentence, a hair early so its first sound isn't clipped. */
function wordStart(r: Rendered, w: number, words: string[]): number {
  if (w <= 0) return 0
  const starts = alignWords(r.env, 60, words)
  return Math.max(0, Math.min(r.duration - 0.05, (starts[Math.min(w, starts.length - 1)] ?? 0) - 0.06))
}

/**
 * Tap a word: read from that word. `words` is the sentence as shown, split on spaces
 * (the same list the word highlight uses), so the timing matches what lights up.
 */
export function seekWord(i: number, w: number, words: string[]) {
  const s = listen.get()
  if (!s.active) return
  i = Math.max(0, Math.min(s.segments.length - 1, i))
  if (w <= 0) { seek(i); return }
  const r = cache.get(i)
  if (r && s.playing && s.mode === 'neural' && audio && onTrack() && i >= track!.start && i < track!.end) {
    audio.currentTime = track!.offs[i - track!.start] + wordStart(r, w, words)
    if (i !== s.current) { listen.set({ current: i }); updateMediaSession() }
    if (s.finished) listen.set({ finished: false })
    updatePosition()
    return
  }
  if (!neuralUsable() && !r) { seek(i); return }   // device-voice bridge reads whole sentences
  stopClipPlayer()
  void playIndex(i, 0, { w, words })
}

/**
 * Seek anywhere in the text, like a video scrubber. `f` is 0..1 across all
 * sentences (the same scale the progress bar shows). Ready audio seeks
 * instantly; a sentence that isn't rendered yet jumps the queue.
 */
export function seekFraction(f: number) {
  const s = listen.get()
  if (!s.active || !s.segments.length) return
  const n = s.segments.length
  const pos = Math.max(0, Math.min(n - 1e-6, f * n))
  const idx = Math.floor(pos)
  const frac = pos - idx
  const r = cache.get(idx)
  if (s.mode === 'neural' && audio && r && onTrack() && idx >= track!.start && idx < track!.end) {
    // Already in the playing track: just move the playhead.
    audio.currentTime = track!.offs[idx - track!.start] + frac * r.duration
    if (idx !== s.current) { listen.set({ current: idx }); updateMediaSession() }
    if (s.finished) listen.set({ finished: false })
    updatePosition()
    return
  }
  if (s.playing) { void playIndex(idx, frac); return }
  // Paused: move there and stay paused (resume continues from the new spot).
  token++
  cancelDevice()
  listen.set({ current: idx, finished: false, mode: r ? 'neural' : s.mode, buffering: false })
  if (r) {
    const a = el()
    quietPause()
    a.loop = false
    a.src = buildTrack(idx).url
    void setTimeWhenReady(a, frac * r.duration)
  } else if (neuralUsable()) prefetch(idx)
  updateMediaSession()
}

export function next() {
  const s = listen.get()
  if (s.current + 1 < s.segments.length) seek(s.current + 1)
}

export function prev() {
  const s = listen.get()
  if (s.mode === 'neural' && audio && localTime() > 2.5) seek(s.current)
  else seek(s.current - 1)
}

export function stop() {
  token++
  cancelDevice()
  // A session in the shell ends there too (1.4.124, widened 1.4.128):
  // handed over OR taken over, the shell's voice stops with the
  // page's session — the mode flag only knows the roads the page
  // itself took, and a chain takeover is not one of them.
  stopShellVoice()
  if (audio) {
    quietPause()
    audio.removeAttribute('src')
    audio.load()
  }
  const s = listen.get()
  if (s.playing || s.mode || s.cushion) listen.set({ playing: false, buffering: false, mode: null, cushion: null })
  updateMediaSession()
}

export function endSession() {
  stop()
  setSleepTimer(null)
  resetCache()
  session++
  listen.set({ active: false, segments: [], voices: [], rendered: [], current: 0, finished: false, error: null })
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = null
}

export function setRate(rate: number) {
  settings.set({ listenSpeed: rate })
  if (audio) audio.playbackRate = rate
}

/** The one speed ladder — the Listen sheet and the floating bubble step along it. */
export const RATE_STEPS = [0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2]

/** One step slower or faster along the ladder (the bubble's − / + keys). */
export function stepRate(dir: 1 | -1) {
  const cur = settings.get().listenSpeed
  let i = RATE_STEPS.findIndex((v) => Math.abs(v - cur) < 0.001)
  if (i < 0) { // the slider can land between steps: step from the nearest one
    let best = 0
    RATE_STEPS.forEach((v, j) => { if (Math.abs(v - cur) < Math.abs(RATE_STEPS[best] - cur)) best = j })
    i = best
  }
  const n = Math.min(RATE_STEPS.length - 1, Math.max(0, i + dir))
  setRate(RATE_STEPS[n])
}

// ── Sleep timer ──
// Counts down in the store (the Listen page shows the minutes left); the last
// ten seconds fade the volume down to silence, then playback pauses and full
// volume is restored, so a faded book never stays quiet by accident.
let sleepId: ReturnType<typeof setInterval> | null = null
let sleepEnd = 0

export function setSleepTimer(minutes: number | null) {
  if (sleepId) { clearInterval(sleepId); sleepId = null }
  if (audio) audio.volume = 1
  if (!minutes || minutes <= 0) { listen.set({ sleepLeft: null, sleepMins: null }); return }
  sleepEnd = Date.now() + minutes * 60000
  listen.set({ sleepLeft: minutes * 60, sleepMins: minutes })
  sleepId = setInterval(() => {
    const left = Math.max(0, (sleepEnd - Date.now()) / 1000)
    listen.set({ sleepLeft: Math.ceil(left) })
    if (audio && listen.get().playing) audio.volume = left <= 10 ? Math.max(0, left / 10) : 1
    if (left <= 0) { setSleepTimer(null); pause() }
  }, 500)
}

/** Visualizer feed: `count` levels around the playhead (0..1). */
export function levels(count: number, out: Float32Array): boolean {
  syncCurrent()
  const s = listen.get()
  if (!s.playing || s.mode !== 'neural' || !audio) return false
  const r = cache.get(s.current)
  if (!r || !onTrack()) return false
  // Phones update audio.currentTime only a few times a second, which made the
  // bars step and lag; run a smooth clock between those updates instead.
  const f = (smoothTime(audio) - (track!.offs[s.current - track!.start] ?? 0)) * 60
  const base = Math.floor(f)
  const frac = f - base
  const env = r.env
  for (let k = 0; k < count; k++) {
    const idx = base - Math.floor(count / 2) + k
    const a = idx >= 0 && idx < env.length ? env[idx] : 0
    const b = idx + 1 >= 0 && idx + 1 < env.length ? env[idx + 1] : 0
    out[k] = a + (b - a) * frac
  }
  return true
}

let clockSrc = ''
let clockRaw = -1
let clockAt = 0
let clockShown = 0
function smoothTime(a: HTMLAudioElement): number {
  const now = performance.now()
  const raw = a.currentTime
  if (a.src !== clockSrc || raw < clockRaw - 0.05 || Math.abs(raw - clockShown) > 0.4) {
    clockSrc = a.src; clockRaw = raw; clockAt = now; clockShown = raw
    return raw
  }
  if (raw !== clockRaw) { clockRaw = raw; clockAt = now }
  const predicted = a.paused ? raw : raw + ((now - clockAt) / 1000) * (a.playbackRate || 1)
  // never run more than a quarter second ahead of what the element reported
  clockShown = Math.max(clockShown, Math.min(predicted, raw + 0.25))
  return clockShown
}

/** For the word highlight: the current sentence's loudness envelope and a smooth time into it. */
export function wordClock(): { env: Float32Array; t: number; idx: number } | null {
  const s = listen.get()
  if (s.mode !== 'neural' || !audio || !onTrack()) return null
  const r = cache.get(s.current)
  if (!r) return null
  const off = track!.offs[s.current - track!.start] ?? 0
  return { env: r.env, t: Math.max(0, smoothTime(audio) - off), idx: s.current }
}

export function sentenceProgress(): number {
  const s = listen.get()
  if (s.mode !== 'neural' || !audio) return 0
  const r = cache.get(s.current)
  return r && onTrack() ? Math.min(1, localTime() / r.duration) : 0
}

// ── Media Session ──

function updateMediaSession() {
  if (!('mediaSession' in navigator)) return
  const s = listen.get()
  if (!s.active) return
  const ms = navigator.mediaSession
  const v = voiceById(s.voices[s.current])
  const base = import.meta.env.BASE_URL
  // 1.4.49 (Oscar): Android draws the notification / lock-screen card from this metadata —
  // the app cannot style the card itself, only feed it. Title is the book's title when the
  // text came from a book (the current sentence scrolled a random heading across the card),
  // and the artwork is a dedicated full-bleed warm-charcoal-and-gold piece at absolute URLs,
  // so the card takes the app's theme instead of a generic system blue.
  const book = nowReadingFor(s.text)
  const art = (file: string, sizes: string) => ({ src: new URL(`${base}${file}`, location.href).href, sizes, type: 'image/png' })
  ms.metadata = new MediaMetadata({
    title: book?.title ?? s.segments[s.current]?.text.slice(0, 90) ?? 'Logos',
    artist: `Logos · ${v?.name ?? 'Voice'}`,
    album: `Sentence ${s.current + 1} of ${s.segments.length}`,
    artwork: [art('media-artwork-512.png', '512x512'), art('media-artwork.png', '1024x1024')],
  })
  ms.playbackState = s.playing ? 'playing' : 'paused'
}

function updatePosition() {
  if (!('mediaSession' in navigator) || !audio) return
  const d = audio.duration
  if (!isFinite(d) || d <= 0) return
  try {
    navigator.mediaSession.setPositionState({ duration: d, position: Math.min(audio.currentTime, d), playbackRate: audio.playbackRate || 1 })
  } catch { /* unsupported */ }
}

export function installMediaSession() {
  if (!('mediaSession' in navigator)) return
  const ms = navigator.mediaSession
  const set = (a: MediaSessionAction, h: MediaSessionActionHandler) => { try { ms.setActionHandler(a, h) } catch { /* unsupported */ } }
  set('play', () => resume())
  set('pause', () => pause())
  set('stop', () => stop())
  set('nexttrack', () => next())
  set('previoustrack', () => prev())
  set('seekforward', () => next())
  set('seekbackward', () => prev())
}

// Starting a Library clip or a voice preview pauses listening (never two at once).
onClipPlay(() => { if (listen.get().playing) pause() })

/** What the off-thread visualizer needs: the playing sentence's envelope and the raw playhead. */
export function vizSnapshot(): { key: string; env: Float32Array | null; time: number; rate: number; running: boolean } {
  syncCurrent()
  const s = listen.get()
  if (!s.playing || s.mode !== 'neural' || !audio) return { key: '', env: null, time: 0, rate: 1, running: false }
  const r = cache.get(s.current)
  if (!r || !onTrack()) return { key: '', env: null, time: 0, rate: 1, running: false }
  return { key: `${track!.url}#${s.current}`, env: r.env, time: localTime(), rate: audio.playbackRate || 1, running: !audio.paused }
}

// Android app: keep the phone's media notification (and the app awake while reading) in step with playback,
// and take play/pause/next/previous from that notification.
{
  type Droid = { playing(on: boolean, title: string, text: string): void; media?: (on: boolean, book: string, artist: string, text: string) => void; mediaF?: (on: boolean, book: string, artist: string, text: string) => void }
  const droid = (window as unknown as { LogosAndroid?: Droid }).LogosAndroid
  if (droid?.playing) {
    let last = ''
    let started = false
    listen.subscribe(() => {
      const s = listen.get()
      const on = s.active && (s.playing || s.buffering)
      // The notification appears with the first play, not when text is merely loaded.
      if (on) started = true
      if (!started) return
      if (!s.active) started = false
      // A closed session is over (1.4.155): publish the blank truth
      // and the shell puts the card away. A FINISHED reading is a
      // different truth since 1.4.160 — see the mediaF publish below:
      // it parks instead of retiring, by Oscar's word.
      const ended = !s.active || s.finished
      const v = voiceById(s.voices[s.current])
      // A finished reading keeps its book (1.4.160): its publish is
      // not the blank retirement — through mediaF it parks a standing
      // card that says Finished, the handle for Oscar's headphone
      // replay. Only a closed session (!active) publishes the blank
      // truth 1.4.155 established, and old shells (no mediaF) keep
      // receiving exactly that blank for a finish, as before.
      const book = !s.active ? null : nowReadingFor(s.text)
      const sentence = !ended && s.active ? (s.segments[s.current]?.text.slice(0, 120) ?? '') : ''
      const key = `${on}|${s.current}|${s.active}|${s.finished}|${book?.title ?? ''}`
      if (key === last) return
      last = key
      // Shell 17+ gets the book's title and the artist line separately, so its media card heads
      // with the book and wears the bundled charcoal-and-gold artwork; older shells keep the
      // original call (their card scrolls the current sentence — the 1.4.49 complaint).
      try {
        if (s.active && s.finished && droid.mediaF) droid.mediaF(false, book?.title ?? '', `Logos · ${v?.name ?? 'Voice'}`, t('Finished'))
        else if (droid.media) droid.media(on, ended ? '' : (book?.title ?? ''), `Logos · ${v?.name ?? 'Voice'}`, sentence)
        else droid.playing(on, `Logos · ${v?.name ?? 'Voice'}`, sentence)
      } catch { /* old shell */ }
    })
    // The shell's keys serve whichever player holds the stage
    // (1.4.156): while a finished-audio clip owns it — sounding now,
    // or standing loaded with no reading session live — the toggle
    // works the clip and prev/next walk its timeline by fifteen
    // seconds; a recording has no sentences to step. Voice samples
    // (preview: keys) never own the stage.
    const clipStage = () => {
      const cp = clipPlayer.get()
      return cp.key && !cp.key.startsWith('preview:') && (cp.playing || !listen.get().active) ? cp : null
    }
    addEventListener('logosandroid-toggle', () => { const cp = clipStage(); if (cp) { if (cp.playing) pauseClip(); else resumeClip(); return } toggle() })
    addEventListener('logosandroid-next', () => { if (clipStage()) { stepClip(15); return } next() })
    addEventListener('logosandroid-prev', () => { if (clipStage()) { stepClip(-15); return } prev() })
  }
}
