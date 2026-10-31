// Listen-on-the-fly controller: sentence-chunked streaming with look-ahead
// synthesis, a single <audio> element (background + lock-screen friendly),
// Media Session controls, and a device-voice bridge while Kokoro downloads.
import { createStore } from '../lib/store.ts'
import { settings } from '../lib/settings.ts'
import { segmentText, type Segment } from '../lib/text.ts'
import { voiceById, type Lang } from '../lib/voices.ts'
import { encodeWav, envelope, silence, trimSilence, concat } from '../lib/audio.ts'
import { engine, ensureModel, synthesize, promote } from '../engine/engine.ts'
import { speakDevice, cancelDevice, deviceSpeechAvailable } from '../engine/device-voice.ts'
import { stopClipPlayer, onClipPlay } from './clip.ts'

type Rendered = { url: string; env: Float32Array; duration: number; voice: string }

export type ListenState = {
  active: boolean
  text: string
  segments: Segment[]
  voices: string[]
  current: number
  playing: boolean
  buffering: boolean
  mode: 'kokoro' | 'device' | null
  rendered: boolean[]
  error: string | null
  finished: boolean
}

export const listen = createStore<ListenState>({
  active: false, text: '', segments: [], voices: [], current: 0, playing: false,
  buffering: false, mode: null, rendered: [], error: null, finished: false,
})

const LISTEN_PRIORITY = 1000
let audio: HTMLAudioElement | null = null
let cache = new Map<number, Rendered>()
let pending = new Map<number, { promise: Promise<Rendered>; ctrl: AbortController }>()
let session = 0
let token = 0
// 'pause' events are dispatched asynchronously, so count the pauses we cause
// ourselves and ignore exactly that many; anything else is a system pause.
let internalPauses = 0

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
    if (s.mode !== 'kokoro' || !s.playing) return
    advance()
  })
  audio.addEventListener('pause', () => {
    // A system pause (headphones unplugged, lock-screen button) must reflect in the UI.
    if (!audio) return
    if (internalPauses > 0) { internalPauses--; return }
    const s = listen.get()
    if (s.mode === 'kokoro' && s.playing && !audio.ended && audio.currentTime < (audio.duration || Infinity) - 0.05) {
      listen.set({ playing: false })
      updateMediaSession()
    }
  })
  audio.addEventListener('emptied', () => { internalPauses = 0 })
  audio.addEventListener('play', () => {
    const s = listen.get()
    if (!s.playing && s.mode === 'kokoro') listen.set({ playing: true })
    updateMediaSession()
  })
  audio.addEventListener('timeupdate', updatePosition)
  return audio
}

function voiceFor(lang: Lang): string {
  const s = settings.get()
  const override = voiceById(s.voiceOverride ?? undefined)
  if (override && (override.lang === lang || s.langMode !== 'auto')) return override.id
  return s.defaultVoice[lang]
}

function resetCache() {
  pending.forEach((p) => p.ctrl.abort())
  pending = new Map()
  cache.forEach((r) => URL.revokeObjectURL(r.url))
  cache = new Map()
}

/** Prepare a new listening session from text (does not start playback). */
export function loadText(text: string) {
  stop()
  resetCache()
  session++
  const segments = segmentText(text, settings.get().langMode)
  listen.set({
    active: segments.length > 0, text, segments, voices: segments.map((s) => voiceFor(s.lang)),
    current: 0, playing: false, buffering: false, mode: null, rendered: segments.map(() => false), error: null, finished: false,
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
    const res = await synthesize(seg.text, voice, 1, { priority, signal: ctrl.signal })
    const trimmed = trimSilence(res.samples, res.sampleRate)
    const pauseMs = settings.get().sentencePauseMs * (seg.paraEnd ? 2.2 : 1)
    const full = concat([trimmed, silence(pauseMs, res.sampleRate)])
    const r: Rendered = {
      url: URL.createObjectURL(encodeWav(full, res.sampleRate)),
      env: envelope(full, res.sampleRate, 60),
      duration: full.length / res.sampleRate,
      voice,
    }
    if (mySession !== session) { URL.revokeObjectURL(r.url); throw new DOMException('stale', 'AbortError') }
    cache.set(i, r)
    pending.delete(i)
    listen.set((st) => { const rendered = st.rendered.slice(); rendered[i] = true; return { rendered } })
    return r
  })()
  promise.catch(() => { if (pending.get(i)?.promise === promise) pending.delete(i) })
  pending.set(i, { promise, ctrl })
  return promise
}

function lookahead() {
  return document.visibilityState === 'hidden' ? 6 : 3
}

function prefetch(from: number) {
  const s = listen.get()
  const end = Math.min(s.segments.length - 1, from + lookahead())
  // Abort queued work outside the new window so seeks feel instant.
  pending.forEach((p, idx) => { if (idx < from || idx > end) { p.ctrl.abort(); pending.delete(idx) } })
  // Nearer sentences first; the sentence at the playhead outranks everything.
  for (let i = from; i <= end; i++) render(i, i === s.current ? PLAYHEAD_PRIORITY : LISTEN_PRIORITY - (i - from)).catch(() => {})
}

const kokoroUsable = () => engine.get().status === 'ready'

export async function play(from?: number) {
  const s = listen.get()
  if (!s.active) return
  stopClipPlayer()
  let idx = from ?? (s.finished ? 0 : s.current)
  if (idx >= s.segments.length) idx = 0
  if (!kokoroUsable()) {
    const st = settings.get()
    if (st.autoDownload || engine.get().cached) ensureModel().catch(() => {})
    if (st.deviceFallback && deviceSpeechAvailable() && !cache.has(idx)) {
      void playDevice(idx)
      return
    }
  }
  await playIndex(idx)
}

async function playIndex(i: number) {
  cancelDevice()
  const s = listen.get()
  if (i < 0 || i >= s.segments.length) return
  const my = ++token
  quietPause()
  listen.set({ current: i, playing: true, mode: 'kokoro', finished: false, error: null, buffering: !cache.has(i) })
  updateMediaSession()
  if (!kokoroUsable()) ensureModel().catch((e) => { if (my === token) listen.set({ playing: false, buffering: false, error: (e as Error).message }) })
  prefetch(i)
  let r: Rendered
  try {
    r = await render(i, PLAYHEAD_PRIORITY)
  } catch (err) {
    if (my !== token || (err as Error).name === 'AbortError') return
    listen.set({ playing: false, buffering: false, error: (err as Error).message })
    return
  }
  if (my !== token || listen.get().current !== i || !listen.get().playing) return
  const a = el()
  a.src = r.url
  a.playbackRate = settings.get().listenSpeed
  listen.set({ buffering: false })
  try {
    await a.play()
  } catch (err) {
    if (my !== token) return
    listen.set({ playing: false, error: (err as Error).name === 'NotAllowedError' ? 'Tap play to start audio.' : (err as Error).message })
  }
}

function advance() {
  const s = listen.get()
  const nxt = s.current + 1
  if (nxt >= s.segments.length) { finish(); return }
  if (s.mode === 'device' && !(kokoroUsable() && cache.has(nxt))) { void playDevice(nxt); return }
  void playIndex(nxt)
}

function finish() {
  listen.set({ playing: false, finished: true, buffering: false })
  updateMediaSession()
}

// ── Device-voice bridge (speechSynthesis) ──

async function playDevice(i: number) {
  const s = listen.get()
  const my = ++token
  quietPause()
  listen.set({ current: i, playing: true, mode: 'device', finished: false, buffering: false, error: null })
  updateMediaSession()
  if (kokoroUsable()) prefetch(i + 1)
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

// Once Kokoro is ready mid-session, render ahead so the next sentence boundary can switch over.
engine.subscribe(() => {
  const s = listen.get()
  if (engine.get().status === 'ready' && s.mode === 'device' && s.playing && pending.size === 0 && cache.size === 0) {
    prefetch(s.current + 1)
  }
})

// ── Transport ──

export function pause() {
  const s = listen.get()
  if (!s.playing) return
  listen.set({ playing: false })
  if (s.mode === 'device') { token++; cancelDevice() } else quietPause()
  updateMediaSession()
}

export function resume() {
  const s = listen.get()
  if (s.playing) return
  if (s.mode === 'kokoro' && audio?.src && !s.finished && cache.get(s.current)?.url === audio.src && !audio.ended) {
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

export function next() {
  const s = listen.get()
  if (s.current + 1 < s.segments.length) seek(s.current + 1)
}

export function prev() {
  const s = listen.get()
  if (s.mode === 'kokoro' && audio && audio.currentTime > 2.5) seek(s.current)
  else seek(s.current - 1)
}

export function stop() {
  token++
  cancelDevice()
  if (audio) {
    quietPause()
    audio.removeAttribute('src')
    audio.load()
  }
  const s = listen.get()
  if (s.playing || s.mode) listen.set({ playing: false, buffering: false, mode: null })
  updateMediaSession()
}

export function endSession() {
  stop()
  resetCache()
  session++
  listen.set({ active: false, segments: [], voices: [], rendered: [], current: 0, finished: false, error: null })
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = null
}

export function setRate(rate: number) {
  settings.set({ listenSpeed: rate })
  if (audio) audio.playbackRate = rate
}

/** Visualizer feed: `count` levels around the playhead (0..1). */
export function levels(count: number, out: Float32Array): boolean {
  const s = listen.get()
  if (!s.playing || s.mode !== 'kokoro' || !audio) return false
  const r = cache.get(s.current)
  if (!r || audio.src !== r.url) return false
  const f = Math.floor(audio.currentTime * 60)
  for (let k = 0; k < count; k++) {
    const idx = f - Math.floor(count / 2) + k
    out[k] = idx >= 0 && idx < r.env.length ? r.env[idx] : 0
  }
  return true
}

export function sentenceProgress(): number {
  const s = listen.get()
  if (s.mode !== 'kokoro' || !audio) return 0
  const r = cache.get(s.current)
  return r && audio.src === r.url ? Math.min(1, audio.currentTime / r.duration) : 0
}

// ── Media Session ──

function updateMediaSession() {
  if (!('mediaSession' in navigator)) return
  const s = listen.get()
  if (!s.active) return
  const ms = navigator.mediaSession
  const v = voiceById(s.voices[s.current])
  const base = import.meta.env.BASE_URL
  ms.metadata = new MediaMetadata({
    title: s.segments[s.current]?.text.slice(0, 90) ?? 'Logos',
    artist: `Logos · ${v?.name ?? 'Voice'}`,
    album: `Sentence ${s.current + 1} of ${s.segments.length}`,
    artwork: [
      { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png' },
    ],
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
