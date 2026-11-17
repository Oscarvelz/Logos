// Listen-on-the-fly controller: sentence-chunked streaming with look-ahead
// synthesis, a single <audio> element (background + lock-screen friendly),
// Media Session controls, and a device-voice bridge while the neural voice downloads.
import { createStore } from '../lib/store.ts'
import { settings, loadLastText } from '../lib/settings.ts'
import { segmentText, speakable, estimateSeconds, pauseAfter, detectLang, type Segment } from '../lib/text.ts'
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
  playheadGate.reset()
  wordClockState.reset()
}
const onTrack = () => Boolean(track && audio && audio.src === track.url)
/** Seconds into the current sentence. */
function localTime(): number {
  if (!track || !audio) return 0
  const s = listen.get()
  const k = s.current - track.start
  return k >= 0 && k < track.offs.length ? Math.max(0, audio.currentTime - track.offs[k]) : 0
}
/** The sentence the audio clock is actually inside, per the track's offsets. */
export function sentenceAt(offs: number[], t: number): number {
  let k = 0
  while (k + 1 < offs.length - 1 && offs[k + 1] <= t + 0.01) k++
  return k
}

/**
 * The playhead gate (cure H-13/T1-3). The old law — at most +1 sentence
 * per timeupdate event — bounded the playhead by EVENT COUNT, but
 * timeupdate is throttleable (≈4 Hz in front, ≈1 Hz or stalled with the
 * screen off, the normal audiobook posture): short sentences at speed
 * cross boundaries faster than one per tick, the lag grew without bound,
 * and advance() at the track's end replayed sentences already heard.
 *
 * The new law bounds the playhead by the AUDIO CLOCK, not by events:
 * a sample may move the playhead to whatever sentence the clock truly
 * names — several at once after a throttled stretch — but only when the
 * clock's own movement since the last trusted sample is plausible for
 * the wall time elapsed at the current rate (plus a jitter allowance).
 * The anti-teleport intent survives intact (Oscar's video, 2026-11-08:
 * the counter sprinted 4 → 12 on a glitch): a single event whose clock
 * leaps hours in a quarter second is distrusted and dropped, and the
 * trusted baseline does not move with it — the next honest sample is
 * measured against the last honest one, so a transient glitch can
 * never drag the playhead.
 *
 * Round 2 (R2-T1-1) found the freeze inside that bookkeeping: a
 * rejection refreshed only the WALL stamp, so the budget stayed
 * per-interval while the distance from the trusted position was
 * cumulative — and one honest event produces a super-budget interval:
 * a mid-track rate DROP, whose last interval was honestly spent at
 * the old, faster rate but is budgeted at the new, slower one. The
 * debt then outgrew every later budget and the gate froze for the
 * rest of the track (the track end's forced sync included, so
 * advance() replayed from the frozen sentence). Two repairs, neither
 * touching the anti-teleport spine:
 *  - setRate() re-anchors the gate: a rate change is a KNOWN honest
 *    discontinuity, so the first sample at the new rate starts a
 *    fresh baseline instead of being judged across the change.
 *  - A rejection re-bases once the accumulated wall time since the
 *    baseline could HONESTLY cover the distance at the current rate
 *    (the budget is the whole span's, summed per interval so a rate
 *    rise mid-span cannot inflate it) — plus, at once, when the
 *    clock is not advancing past the baseline at all, where no debt
 *    can grow. A teleport earns acceptance only after as much real
 *    time as honestly travelling its distance takes — by then it is
 *    no longer a sprint, and a real glitch clock never sits still
 *    that long being believed: each of its samples is still judged,
 *    and the playhead moves only when the span's honesty covers it.
 */
export class PlayheadGate {
  private base: { url: string; t: number; wall: number } | null = null
  /** Wall time and rate of the latest sample, for the span budget. */
  private last: { wall: number; rate: number } | null = null
  /** Honest travel earned since the baseline, summed per interval. */
  private span = 0
  reset() { this.base = null; this.last = null; this.span = 0 }
  /** The sentence the playhead may move to, or null to distrust this sample. */
  check(url: string, t: number, wall: number, rate: number, clockIdx: number, current: number): number | null {
    const b = this.base
    if (!b || b.url !== url) { this.base = { url, t, wall }; this.last = { wall, rate }; this.span = 0; return clockIdx }
    if (clockIdx === current) { this.base = { url, t, wall }; this.last = { wall, rate }; this.span = 0; return clockIdx }
    const dtWall = Math.max(0, (wall - b.wall) / 1000)
    const budget = dtWall * Math.max(0.25, rate) + 0.35
    if (Math.abs(t - b.t) <= budget) { this.base = { url, t, wall }; this.last = { wall, rate }; this.span = 0; return clockIdx }
    // Rejected. Earn toward a re-base: this interval's honest travel at
    // the rate it was actually played at (the previous sample's rate),
    // summed — never the whole span at today's rate.
    if (this.last) this.span += Math.max(0, (wall - this.last.wall) / 1000) * Math.max(0.25, this.last.rate)
    this.last = { wall, rate }
    const dist = t - b.t
    if (dist <= 0 || this.span + 0.35 >= dist) {
      // The clock is not advancing past the baseline (no debt can
      // grow), or the span since the baseline honestly covers the
      // distance: re-base here. This sample still does not move the
      // playhead — the next one is judged against the new baseline.
      this.base = { url, t, wall }
      this.span = 0
    } else {
      this.base = { url: b.url, t: b.t, wall }
    }
    return null
  }
}
const playheadGate = new PlayheadGate()

/** Follow the playback time: update the current sentence when it changes.
 *  `force` is for the track's 'ended' moment, when the element already
 *  reads paused but the clock's final word is the truth advance() needs. */
function syncCurrent(force = false) {
  if (!onTrack() || !audio || audio.seeking) return
  if (audio.paused && !force) return
  const t = audio.currentTime
  const idx = track!.start + sentenceAt(track!.offs, t)
  const s = listen.get()
  if (s.mode !== 'neural') return
  const next = playheadGate.check(track!.url, t, performance.now(), audio.playbackRate || 1, idx, s.current)
  if (next !== null && next !== s.current) {
    listen.set({ current: next })
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
  /** Where inside the current sentence a PAUSED seek landed (cure
   *  T1-7): a scrub while paused used to throw this fraction away
   *  when the target sentence wasn't rendered yet — no field held
   *  it, and every play door restarted the sentence. A paused
   *  seekTo records it here; play()/resume() hand it to playIndex
   *  as the start fraction, and playIndex clears it as it consumes
   *  it. Always 0 on the device road (whole sentences only). */
  seekFrac: number
}

export const listen = createStore<ListenState>({
  active: false, text: '', segments: [], voices: [], current: 0, playing: false,
  buffering: false, mode: null, rendered: [], error: null, finished: false, cushion: null, sleepLeft: null, sleepMins: null, seekFrac: 0,
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
    // the track's last sentence in one step. But advance() must not trust
    // a playhead that throttled timeupdate left behind, either (H-13):
    // take the clock's final word first — the gate still vets it — and
    // only then step. advance() re-reads the store, so it steps from the
    // sentence the clock says just finished, never from a lagged one,
    // and the stretch already heard is never replayed.
    syncCurrent(true)
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

/**
 * The language THIS sentence is decided in (cure M-3). Segmentation
 * stamps a language on every segment, but its per-sentence override
 * only fires for sentences longer than 24 characters — a short
 * sentence in the other language inside a long paragraph (a quoted
 * "Gracias por todo." in an English chapter) kept the paragraph's
 * language and was read in the wrong voice for the whole session,
 * because the voice was settled once, from the stamp, at load.
 * The decision is therefore re-made here, at the render seam, from
 * the sentence itself: in auto mode a sentence whose own words
 * clearly detect as the other language (the detector's own ≥0.6
 * confidence, the same bar segmentation uses) is rendered in that
 * language's voice; anything less clear keeps the segment's stamp.
 * A fixed language mode is never second-guessed.
 */
export function sentenceLang(seg: Segment, langMode: Lang | 'auto'): Lang {
  if (langMode !== 'auto') return seg.lang
  const d = detectLang(seg.text)
  return d.confidence >= 0.6 ? d.lang : seg.lang
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
    active: segments.length > 0, text, segments, voices: segments.map((seg) => voiceFor(sentenceLang(seg, settings.get().langMode))),
    current: 0, playing: false, buffering: false, mode: null, rendered: segments.map(() => false), error: null, finished: false, cushion: null, seekFrac: 0,
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
    void hasPersistedRender(renderKey(spoken, st.voices[0], pauseAfter(st.segments[0], settings.get().sentencePauseMs))).then((has) => {
      if (has && listen.get().text === text && !listen.get().playing) go()
    })
  })
}

/** Re-resolve voices (after a voice change) and restart the current sentence if playing. */
export function refreshVoices() {
  const s = listen.get()
  if (!s.active) return
  const voices = s.segments.map((seg) => voiceFor(sentenceLang(seg, settings.get().langMode)))
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
  // The voice is decided per sentence at render time (cure M-3): the
  // sentence's own language, resolved now — never the voice the
  // session happened to start with. When the resolution moves a
  // sentence, the store's witness list moves with it, so the voice
  // chip and the media card name the voice actually rendering.
  const lang = sentenceLang(seg, settings.get().langMode)
  const voice = voiceFor(lang)
  if (voice !== s.voices[i]) listen.set((st) => { const voices = st.voices.slice(); voices[i] = voice; return { voices } })
  const ctrl = new AbortController()
  const mySession = session
  const promise = (async () => {
    // What the voice actually says: the sentence cleaned for speech (codes named,
    // not spelled; machine file names dropped) and run through the reader's
    // pronunciation dictionary. A sentence that was only a code becomes a breath
    // of silence instead of a spelling bee.
    const spoken = speakable(seg.text, lang)
    // The pause this render will bake in, computed once, up front:
    // it is appended to the samples before encoding (below), so it
    // belongs to the cache key as well (cure T1-14 — see rendercache).
    const pauseMs = pauseAfter(seg, settings.get().sentencePauseMs)
    // The saved processing (1.4.112): a sentence rendered before — in a
    // past session, another day, another book — plays from disk and is
    // never rendered twice. The key is the spoken string + the voice,
    // so a dictionary edit or a voice change correctly misses.
    const key = spoken ? renderKey(spoken, voice, pauseMs) : null
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
  // It retakes the stage at the CURRENT sentence (H-12): while the
  // native progress channel (applyNativePos) is live, the store's
  // current has followed the device voice, so a page-side Play no
  // longer discards everything the native voice read past the
  // handoff — it resumes from where the reading actually is. On a
  // shell without the channel, current is the last page-known
  // position, which is all the page can honestly claim.
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
  // A paused scrub's landing survives into this start (cure T1-7):
  // starting at the sentence the listener scrubbed into starts at
  // the fraction they scrubbed to, through EVERY play door — this
  // one is the door they all share (the panel's play, the bubble's
  // logosandroid-play), not only resume()'s fast path.
  await playIndex(idx, idx === s.current ? (s.seekFrac ?? 0) : 0)
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
  // The start fraction (a live seek's, or a paused scrub's recorded
  // seekFrac handed in by play()) is consumed by this start — clear
  // the record so a later plain start never replays it (cure T1-7).
  listen.set({ current: i, playing: true, mode: 'neural', finished: false, error: null, buffering: stalled, seekFrac: 0 })
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

/** True while this page has a session living in the shell's device
 *  voice (cure H-12/T1-2). Set by handToShell — or by ADOPTION
 *  (R2-T1-2: a fresh page that finds a native session outlived the
 *  page that handed it over); cleared when the page ends the shell's
 *  voice (stopShellVoice), when the shell reports the native session
 *  over (applyNativePos), or when a new session replaces this one.
 *  It is the guard that keeps a late or foreign native-progress
 *  report from writing into a session it does not belong to. */
let shellHanded = false

/** Hand the session to the shell's real device voice (1.4.122): the
 *  page stops, the shell's Android TTS takes the text from sentence i,
 *  switching language sentence by sentence. False where there is no
 *  shell (a real browser), whose own speech bridge is honest.
 *
 *  The store tells the truth about the handoff (H-12): sound IS
 *  playing — in the shell — so `playing` is true, exactly as the
 *  browser device road below already sets it. The old `playing:false`
 *  froze every page-side witness for the whole native session: the
 *  panel showed paused at the handoff sentence, the media publisher
 *  sent on=false, the resume record froze, and the ListenPage fold
 *  stayed open over sounding audio. What the page still cannot know
 *  on its own is how far the native voice has read — that arrives
 *  through applyNativePos below. */
export function handToShell(i: number): boolean {
  const d = (window as unknown as { LogosAndroid?: { bubbleNative?: (t: string, ti: string, ix: number) => void } }).LogosAndroid
  if (typeof d?.bubbleNative !== 'function') return false
  const s = listen.get()
  ++token
  quietPause()
  shellHanded = true
  listen.set({ current: i, playing: true, mode: 'device', finished: false, buffering: false, error: null })
  updateMediaSession()
  d.bubbleNative(s.text, '', i)
  return true
}

/**
 * A progress report from the shell's device voice (H-12, page-side
 * half). Investigation found NO shell→page progress channel: the
 * native speaker advances its own index in the shell, and its only
 * listener refreshes the shell's own panel — the page was never told.
 * The channel designed for it follows the house's own pattern (the
 * seek bar, the pending command): the shell pokes a bare
 * `logosandroid-nativepos` event on every sentence advance and on
 * play/pause/finish transitions, and the page PULLS the position
 * through a new bridge getter, `bubbleNativePos()` — see the written
 * request for the shell-side half (NativeSpeaker.kt/BubbleService.kt/
 * MainActivity.kt). Until a shell carrying the getter answers, this
 * is a no-op and the store keeps the last page-known position.
 *
 * The shell splits sentences with its own splitter, so its index is
 * mapped proportionally onto the page's segments when the totals
 * differ — an honest approximation, never a silent pretence that the
 * two segmentations are one. `done` marks a reading that reached the
 * end (the store finishes); a native session that simply stopped
 * reports active:false without done, and the store goes quiet.
 */
/**
 * Adoption (cure R2-T1-2). A page reload during a shell-native
 * session used to orphan it: `shellHanded` is page memory, so the
 * fresh page started empty, its forced load publish retired the
 * media card over a still-reading device voice, and every later
 * nativepos report — even the session's natural `done` — was
 * refused, so the store never rejoined and never finished.
 *
 * The door: a report that arrives with no page-side handoff may be
 * ADOPTED, under strict conditions that keep the guard's promise —
 * the store must be INACTIVE (a page with a session of its own is
 * never written into; stop()/loadText() clear the guard for exactly
 * that reason), no clip may hold the stage, and the report must be
 * a live session (active) or a finished one (done). The session is
 * restored from the persisted last text — the text this app handed
 * the shell is the text it keeps — and the ordinary report body
 * below then maps the position and, for `done`, closes the record.
 * With no persisted text there is nothing honest to restore, and
 * the report is refused as before.
 */
function adoptNativeSession(pos: { active?: boolean; done?: boolean }): boolean {
  if (!pos.active && !pos.done) return false
  const s = listen.get()
  if (s.active) return false
  const cp = clipPlayer.get()
  if (cp.key && !cp.key.startsWith('preview:')) return false
  const text = loadLastText()
  if (!text.trim()) return false
  loadText(text)
  if (!listen.get().active) return false
  shellHanded = true
  listen.set({ mode: 'device', playing: false, finished: false, buffering: false, error: null })
  return true
}

export function applyNativePos(pos: { idx?: number; total?: number; playing?: boolean; active?: boolean; done?: boolean }): void {
  if (!shellHanded && !adoptNativeSession(pos)) return
  const s = listen.get()
  if (!s.active || s.mode !== 'device') return
  if (!pos.active) {
    shellHanded = false
    if (pos.done) {
      // The native voice read to the end: land on its final reported
      // sentence (mapped like any other report) before finishing, so
      // the resume record and the counter close on the truth.
      const n = s.segments.length
      let idx = typeof pos.idx === 'number' && Number.isFinite(pos.idx) ? pos.idx : s.current
      if (pos.total && pos.total > 0 && pos.total !== n) idx = Math.floor((idx * n) / pos.total)
      idx = n ? Math.max(0, Math.min(n - 1, idx)) : idx
      listen.set({ current: idx, playing: false, finished: true, buffering: false })
    } else if (s.playing) listen.set({ playing: false })
    updateMediaSession()
    return
  }
  const n = s.segments.length
  if (!n) return
  let idx = typeof pos.idx === 'number' && Number.isFinite(pos.idx) ? pos.idx : s.current
  if (pos.total && pos.total > 0 && pos.total !== n) idx = Math.floor((idx * n) / pos.total)
  idx = Math.max(0, Math.min(n - 1, idx))
  const patch: Partial<ListenState> = {}
  if (idx !== s.current) patch.current = idx
  if (typeof pos.playing === 'boolean' && pos.playing !== s.playing) patch.playing = pos.playing
  if (Object.keys(patch).length) { listen.set(patch); updateMediaSession() }
}

/**
 * The browser device voice's place inside the sentence it is reading
 * (cure T1-17): the fraction of the sentence's characters the voice
 * has reached, fed by the utterance's real boundary events. Kept
 * monotonic — a late or repeated event never walks the light
 * backward. Only the browser road reports: the shell's native voice
 * has its own sentence-level channel (applyNativePos) and reports
 * no within-sentence position, so nothing is invented for it.
 */
let deviceFrac = { idx: -1, frac: 0 }

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
  deviceFrac = { idx: i, frac: 0 }
  const ok = await speakDevice(seg.text, sentenceLang(seg, settings.get().langMode), settings.get().listenSpeed, (charIndex) => {
    if (deviceFrac.idx !== i || !seg.text.length) return
    const f = Math.min(1, Math.max(0, charIndex / seg.text.length))
    if (f > deviceFrac.frac) deviceFrac = { idx: i, frac: f }
  })
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
    // A pause spoken while a start is still preparing cancels the
    // start's claim too (1.4.173): buffering is a promise, not
    // sound — left standing, it kept the shell's session awake and
    // claiming PLAYING after a pause Oscar had honestly taken.
    if (s.buffering) listen.set({ buffering: false })
    // A session handed to the shell's voice is paused on the page but
    // still reading in the shell. A stop spoken on the page's side —
    // the sleep timer's word above all — is a stop for the whole
    // house (1.4.124): the shell voice stops too.
    if (!fromShell && s.mode === 'device') stopShellVoice()
    return
  }
  listen.set({ playing: false, buffering: false })
  if (s.mode === 'device') { token++; cancelDevice(); if (!fromShell) stopShellVoice() } else quietPause()
  updateMediaSession()
}

/** Tell the shell its voice's session is over (1.4.124). Older shells
 *  simply do not have the door; the call fades away harmlessly. */
function stopShellVoice() {
  // The handed session is over on this side too (H-12): a native
  // progress report arriving after this stop belongs to a dead
  // session and must not write into whatever replaced it.
  shellHanded = false
  const d = (window as unknown as { LogosAndroid?: { bubbleNativeStop?: () => void } }).LogosAndroid
  try { d?.bubbleNativeStop?.() } catch { /* a stale shell ignores it */ }
}

export function resume() {
  const s = listen.get()
  if (s.playing) return
  if (s.mode === 'neural' && audio?.src && !s.finished && onTrack() && s.current >= track!.start && s.current < track!.end && !audio.ended) {
    stopClipPlayer()
    // The element already stands where a rendered paused seek put
    // it (seekTo set its time), so the recorded fraction is spent.
    listen.set({ playing: true, seekFrac: 0 })
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
  const idx = Math.max(0, Math.min(s.segments.length - 1, i))
  if (!s.playing) {
    // Stepping while paused moves and STAYS paused (cure T1-8):
    // seekTo's paused branch has stated this law all along, but the
    // sentence-stepping doors never honoured it — a headphone or
    // panel "next" pressed on a paused session to cue the next
    // sentence started sound the user never asked for. Callers that
    // want sound say so themselves (every seek caller in the tree
    // pairs its seek with its own play(), which now starts from
    // exactly the spot this move records).
    seekTo(idx, 0)
    return
  }
  // A playing device-voice session steps on its own road (cure
  // T1-6): play() would re-decide the road and could hijack the
  // session into neural mid-book.
  if (s.mode === 'device') { void playDevice(idx); return }
  void play(idx)
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
  if (w <= 0) { void play(i); return }   // tap-a-word is a play-from-here door: it keeps its promise to sound
  const r = cache.get(i)
  if (r && s.playing && s.mode === 'neural' && audio && onTrack() && i >= track!.start && i < track!.end) {
    audio.currentTime = track!.offs[i - track!.start] + wordStart(r, w, words)
    if (i !== s.current) { listen.set({ current: i }); updateMediaSession() }
    if (s.finished) listen.set({ finished: false })
    updatePosition()
    return
  }
  if (!neuralUsable() && !r) { void play(i); return }   // device-voice bridge reads whole sentences
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
  seekTo(Math.floor(pos), pos - Math.floor(pos))
}

/** Land on sentence `idx`, `frac` of the way through it. */
export function seekTo(idx: number, frac: number) {
  const s = listen.get()
  if (!s.active || !s.segments.length) return
  // Bounds live here, at the door itself (the hunt's unproven #2 was
  // a direct seekTo(5) on a 4-sentence session landing out of range;
  // every in-app caller clamped for it — the door now does).
  idx = Math.max(0, Math.min(s.segments.length - 1, Math.floor(idx)))
  frac = Math.max(0, Math.min(1, frac))
  if (s.mode === 'device') {
    // The device road (cure T1-6): a seek or jump in a device-voice
    // session stays on that road. The old code fell through to
    // playIndex, which cancels the device voice and restarts in
    // neural — on a phone whose engine is unready (the very reason
    // the session is on the device voice) the jump key killed a
    // working reading and landed on an error. The device voice
    // reads whole sentences, so the fraction is honestly dropped:
    // the landing is the sentence's own beginning.
    if (s.playing) { void playDevice(idx); return }
    token++
    listen.set({ current: idx, finished: false, seekFrac: 0, buffering: false })
    updateMediaSession()
    return
  }
  const r = cache.get(idx)
  if (s.mode === 'neural' && audio && r && onTrack() && idx >= track!.start && idx < track!.end) {
    // Already in the playing track: just move the playhead.
    audio.currentTime = track!.offs[idx - track!.start] + frac * r.duration
    if (idx !== s.current) { listen.set({ current: idx }); updateMediaSession() }
    if (s.finished) listen.set({ finished: false })
    if (s.seekFrac) listen.set({ seekFrac: 0 })
    updatePosition()
    return
  }
  if (s.playing) { void playIndex(idx, frac); return }
  // Paused: move there and stay paused (resume continues from the new
  // spot) — and RECORD the fraction (cure T1-7). It used to survive
  // only as the <audio> element's currentTime in the rendered case,
  // and not at all when the sentence wasn't rendered yet; now the
  // store holds it, and play() — every play door, the bubble's
  // included — starts from it.
  token++
  cancelDevice()
  listen.set({ current: idx, finished: false, mode: r ? 'neural' : s.mode, buffering: false, seekFrac: frac })
  if (r) {
    const a = el()
    quietPause()
    a.loop = false
    a.src = buildTrack(idx).url
    void setTimeWhenReady(a, frac * r.duration)
  } else if (neuralUsable()) prefetch(idx)
  updateMediaSession()
}

/**
 * Leap by TIME, not by sentence (1.4.163, Oscar): the rewind and
 * forward keys jump the seconds Settings names (15 back, 30 ahead
 * out of the box), crossing as many sentences as the leap spans.
 * The walk runs on the buffer's own timeline — a rendered sentence
 * knows its true length; one not yet rendered is estimated from
 * its words — and lands through the same door as the scrubber.
 * The device voice reads whole sentences, so there the leap lands
 * on the nearest sentence start: the sentence is right, the offset
 * is the sentence's own beginning.
 */
export function jumpBy(deltaSec: number) {
  const s = listen.get()
  if (!s.active || !s.segments.length || !deltaSec) return
  const n = s.segments.length
  const dur = (i: number): number => {
    const r = cache.get(i)
    return r ? r.duration : Math.max(0.4, estimateSeconds(s.segments[i].text, 1))
  }
  let idx = s.current
  let off = s.mode === 'neural' && onTrack() && cache.get(idx) ? localTime() : 0
  // The named seconds are BOOK seconds at every speed (cure T1-5):
  // Settings names them, 1.4.176/179 settled the promise, and
  // recordings already step exactly the named seconds. The walk
  // below spends `rem` against the buffer's own timeline (durations
  // and localTime are both book time), so the old speed factor
  // silently redefined the key — 30 s skipped 15 s of book at 0.5×
  // and 60 s at 2×. No factor: the deed matches the name.
  let rem = Math.abs(deltaSec)
  if (deltaSec > 0) {
    for (;;) {
      const d = dur(idx)
      if (off + rem < d) { seekTo(idx, (off + rem) / d); return }
      rem -= d - off
      idx++; off = 0
      if (idx >= n) { seekTo(n - 1, 0.999); return }
    }
  }
  for (;;) {
    const d = dur(idx)
    if (off - rem >= 0) { seekTo(idx, (off - rem) / d); return }
    rem -= off
    idx--
    if (idx < 0) { seekTo(0, 0); return }
    off = dur(idx)
  }
}

/**
 * A configured leap, in the stored value's own semantics (cure F9).
 * The settings load guarantees a finite number and keeps a stored 0
 * a 0; the consumers used to substitute 15/30 through `||`, so zero
 * could never mean zero — the substitution the 1.4.158 sliders-to-
 * zero ruling forbids. The clamp is the field's own ceiling with 0
 * admitted: a stored 0 is an honest no-op leap (jumpBy already
 * refuses a zero delta), never a silent 15. Only a value of the
 * wrong kind — which the load itself already replaces — falls back.
 */
export const jumpSeconds = (v: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(600, Math.max(0, v)) : fallback

/** The configured leaps, clamped to the field's own range: 0..600 s. */
export const jumpBack = () => jumpBy(-jumpSeconds(settings.get().jumpBackSec, 15))
export const jumpFwd = () => jumpBy(jumpSeconds(settings.get().jumpFwdSec, 30))

/**
 * The scrub hold (cure M-4). While the listener drags the progress
 * bar, the store keeps reporting the playing position — and the
 * thumb used to be re-rendered from that live position between the
 * drag's own updates, so it snapped back toward the playhead
 * mid-drag and the listener fought the bar. The hold is the one
 * authority for what the thumb shows: once a drag begins, store-
 * driven position updates are displayed NOWHERE — `display` returns
 * the held fraction until the drag ends — and on release the seek
 * fraction is handed out exactly once, so the seek lands a single
 * time and a stray second release (pointerup after pointercancel)
 * seeks nothing.
 */
export class ScrubHold {
  private value: number | null = null
  get active(): boolean { return this.value !== null }
  get current(): number | null { return this.value }
  begin(f: number): number { this.value = Math.max(0, Math.min(1, f)); return this.value }
  move(f: number): number | null { if (this.value !== null) this.value = Math.max(0, Math.min(1, f)); return this.value }
  /** What the thumb shows: the held fraction while dragging, else the store's position. */
  display(done: number): number { return this.value ?? done }
  /** Release: the fraction to seek to, handed out once; null when no drag is live. */
  end(f?: number): number | null {
    if (this.value === null) return null
    const v = f !== undefined ? Math.max(0, Math.min(1, f)) : this.value
    this.value = null
    return v
  }
  cancel(): void { this.value = null }
}

/**
 * Save-once discipline, keyed per target (cure M-5). The mark door
 * saved on every tap with no in-flight guard: a double-tap filed
 * the same moment twice, and a slow save left the button live for
 * more. A gate run refuses to start while a run for the SAME key
 * is still in flight — and only that key: a different mark target
 * (another sentence, another book) is never blocked by a save that
 * isn't its own. The key frees when the save settles, success or
 * failure alike, so a failed save can be retried at once.
 */
export class InFlightGate {
  private inFlight = new Set<string>()
  busy(key: string): boolean { return this.inFlight.has(key) }
  /** Run `fn` unless a run for `key` is already in flight. */
  async run<T>(key: string, fn: () => Promise<T>): Promise<{ ran: boolean; value?: T }> {
    if (this.inFlight.has(key)) return { ran: false }
    this.inFlight.add(key)
    try { return { ran: true, value: await fn() } }
    finally { this.inFlight.delete(key) }
  }
}

/** The one gate every mark door shares (the Listen transport today;
 *  the bubble's mark key is asked to route through it too). */
export const markGate = new InFlightGate()

export function next() {
  const s = listen.get()
  if (s.current + 1 < s.segments.length) seek(s.current + 1)
}

export function prev() {
  const s = listen.get()
  if (s.mode === 'neural' && audio && localTime() > 2.5) seek(s.current)
  else seek(s.current - 1)
}

/**
 * The SKIP deed (cure T1-19). The media card's ⏭/⏮ are declared
 * only over a BOOK (1.4.172), and Oscar's framing for the seat is a
 * song queue: «como si fuese una canción, pasar de un libro a
 * otro» (1.4.163). No queue ever existed, so the press landed here
 * and stepped one sentence — the card's promise had no deed behind
 * it. Now the SKIP roads (the shell's logosandroid-next/prev, which
 * only the session's Skip callbacks send, and the browser's
 * nexttrack/previoustrack) route here: over a book session the
 * press travels to the neighbouring BOOK through the deed the book
 * layer registers below; over anything else it keeps the sentence
 * step it has always had. The in-page transport keeps calling
 * next()/prev() directly — sentence precision lives there, as
 * 1.4.163 settled. The book layer registers its deed at its own
 * module scope: it owns loading a book into Listen, and a book
 * session can only exist once that module has run.
 */
let bookSkipImpl: ((dir: 1 | -1) => void) | null = null
export function registerBookSkip(fn: (dir: 1 | -1) => void) { bookSkipImpl = fn }

export function skipNext() {
  const s = listen.get()
  if (bookSkipImpl && s.active && nowReadingFor(s.text)) { bookSkipImpl(1); return }
  next()
}

export function skipPrev() {
  const s = listen.get()
  if (bookSkipImpl && s.active && nowReadingFor(s.text)) { bookSkipImpl(-1); return }
  prev()
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
  listen.set({ active: false, segments: [], voices: [], rendered: [], current: 0, finished: false, error: null, seekFrac: 0 })
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = null
}

export function setRate(rate: number) {
  settings.set({ listenSpeed: rate })
  if (audio) audio.playbackRate = rate
  // A rate change is a known honest discontinuity (R2-T1-1): the
  // interval straddling it was spent at the old rate but would be
  // budgeted at the new one — after a DROP that mismatch froze the
  // playhead gate for the rest of the track. Re-anchor: the first
  // sample at the new rate starts a fresh baseline.
  playheadGate.reset()
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
  const f = (smoothTime(audio, s.current) - (track!.offs[s.current - track!.start] ?? 0)) * 60
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

/**
 * The word clock (cure M-1). Phones update audio.currentTime only a
 * few times a second, so between updates the clock predicts — but
 * the prediction state used to be keyed only by the track's src:
 * the lead it had accumulated by the end of one sentence (up to a
 * quarter second of prediction, plus whatever a stall or a late
 * render had folded in) was carried INTO the next sentence, whose
 * word marks then ran ahead of the voice for the rest of the track,
 * the error compounding at every boundary. The clock is now re-based
 * at every sentence transition: the first sample inside a sentence
 * anchors it at the element's own reported time — the sentence's
 * true start on the audio clock — and prediction only ever fills
 * the gaps WITHIN that sentence. Drift cannot cross a boundary, so
 * it cannot accumulate across a track.
 */
export class WordClock {
  private src = ''
  private idx = -1
  private raw = -1
  private at = 0
  private shown = 0
  reset() { this.src = ''; this.idx = -1; this.raw = -1; this.at = 0; this.shown = 0 }
  /** Smoothed track time for sentence `idx`, re-based at its true start. */
  time(src: string, raw: number, paused: boolean, rate: number, idx: number, now: number): number {
    if (src !== this.src || idx !== this.idx || raw < this.raw - 0.05 || Math.abs(raw - this.shown) > 0.4) {
      // Re-base: a new track, a new sentence, a seek, or a clock that
      // no longer agrees with the prediction — the element's own
      // reported time is the only anchor, never the carried lead.
      this.src = src; this.idx = idx; this.raw = raw; this.at = now; this.shown = raw
      return raw
    }
    if (raw !== this.raw) { this.raw = raw; this.at = now }
    const predicted = paused ? raw : raw + ((now - this.at) / 1000) * Math.max(0.25, rate || 1)
    // never run more than a quarter second ahead of what the element reported
    this.shown = Math.max(this.shown, Math.min(predicted, raw + 0.25))
    return this.shown
  }
}
const wordClockState = new WordClock()

function smoothTime(a: HTMLAudioElement, idx: number): number {
  return wordClockState.time(a.src, a.currentTime, a.paused, a.playbackRate || 1, idx, performance.now())
}

/** For the word highlight: the current sentence's loudness envelope and a smooth time into it. */
export function wordClock(): { env: Float32Array; t: number; idx: number } | null {
  const s = listen.get()
  if (s.mode !== 'neural' || !audio || !onTrack()) return null
  const r = cache.get(s.current)
  if (!r) return null
  const off = track!.offs[s.current - track!.start] ?? 0
  return { env: r.env, t: Math.max(0, smoothTime(audio, s.current) - off), idx: s.current }
}

export function sentenceProgress(): number {
  const s = listen.get()
  // A paused scrub's recorded landing is the position while paused
  // (cure T1-7): the progress bar and the panel must show where the
  // listener actually put the playhead, not the sentence's start,
  // until sound resumes and the audio clock takes over again.
  if (!s.playing && (s.seekFrac ?? 0) > 0) return Math.min(1, s.seekFrac)
  // The browser device voice reports its own place (cure T1-17):
  // the boundary-fed fraction of the sentence it is reading, so the
  // word highlight follows the voice instead of sitting on word one
  // for the whole session. The shell's native road (shellHanded)
  // reports no within-sentence position and keeps the honest zero.
  if (s.mode === 'device' && !shellHanded && deviceFrac.idx === s.current) return deviceFrac.frac
  if (s.mode !== 'neural' || !audio) return 0
  const r = cache.get(s.current)
  return r && onTrack() ? Math.min(1, localTime() / r.duration) : 0
}

// ── Media Session ──

function updateMediaSession() {
  if (!('mediaSession' in navigator)) return
  const s = listen.get()
  if (!s.active) return
  // While a recording owns the stage, the browser card is the
  // clip's (cure T1-12): clip.ts writes its metadata, and the
  // reading must not overwrite it with its own claim.
  const cp = clipPlayer.get()
  if (cp.key && !cp.key.startsWith('preview:') && cp.playing) return
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
  // Sound only, as at the shell publisher below (cure T1-4): a
  // buffering/cushioning session is a promise, not sound, and must
  // not wear 'playing' on the browser's card either.
  ms.playbackState = s.playing && !s.buffering && !s.cushion ? 'playing' : 'paused'
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
  // Inside the Android app the shell's own session is the media
  // face, and it sleeps while no sound flows (1.4.154/1.4.173). The
  // WebView's session would be a second door standing open beside
  // it — a stray PLAY of the dictation kind resuming a paused
  // reading with no hand near a Logos key. The handlers live for
  // the browser, where no shell session exists; in the app they are
  // never installed.
  if ((window as unknown as { LogosAndroid?: unknown }).LogosAndroid) return
  const ms = navigator.mediaSession
  const set = (a: MediaSessionAction, h: MediaSessionActionHandler) => { try { ms.setActionHandler(a, h) } catch { /* unsupported */ } }
  set('play', () => resume())
  set('pause', () => pause())
  set('stop', () => stop())
  set('nexttrack', () => skipNext())
  set('previoustrack', () => skipPrev())
  set('seekforward', () => jumpFwd())
  set('seekbackward', () => jumpBack())
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
  type Droid = { playing(on: boolean, title: string, text: string): void; media?: (on: boolean, book: string, artist: string, text: string) => void; mediaF?: (on: boolean, book: string, artist: string, text: string) => void; bubbleNativePos?: () => string }
  const droid = (window as unknown as { LogosAndroid?: Droid }).LogosAndroid
  if (droid?.playing) {
    let last = ''
    let started = false
    const publish = (force = false) => {
      const s = listen.get()
      // Sound only (1.4.173): a buffering session is not playing,
      // and the shell's media session wakes for sound, never for a
      // promise — a pause taken during Preparing used to leave the
      // session awake and targetable (the dictation autoplay).
      // That law is now the CODE, not only its comment (cure T1-4):
      // playIndex claims playing:true before rendering, and
      // buildCushion may then hold for up to 25 s with only the
      // inaudible keep-alive sounding — the old expression published
      // PLAYING through the whole cushion. Buffering and cushion
      // subtract: the card wakes when the first word sounds, and a
      // seek into unrendered audio honestly reads as not-playing
      // until it does.
      const on = s.active && s.playing && !s.buffering && !s.cushion
      // While a recording owns the stage, the card tells the
      // CLIP's truth (cure T1-12): this publisher is the card's
      // only writer, and it used to keep describing the reading —
      // a paused mid-book sentence, or the parked Finished card —
      // for the whole duration of every clip. The clip's state is
      // published from here (the single writer stays single), and
      // when the clip stops, the reading's own truth resumes below.
      // Whether recordings should FOLLOW the card beyond this —
      // live title/position as they play — is Oscar's standing
      // open question (2026-11-14); this cures the falsehood, it
      // does not build that feature.
      const cp = clipPlayer.get()
      const clipOn = Boolean(cp.key && !cp.key.startsWith('preview:') && cp.playing)
      if (clipOn) started = true
      // The notification appears with the first play, not when text is merely loaded.
      if (on) started = true
      if (!started && !force) return
      if (clipOn) {
        const ckey = `clip|${cp.key}|${cp.title}`
        if (ckey === last) return
        last = ckey
        try {
          if (droid.media) droid.media(true, '', cp.artist || 'Logos', cp.title || '')
          else droid.playing(true, cp.artist || 'Logos', cp.title || '')
        } catch { /* old shell */ }
        return
      }
      // The `started` gate keeps its purpose — no publish noise before
      // the session machinery is up — with ONE exception (cure
      // H-11/T1-1): the single forced publish at page load below.
      // After a crash / watchdog reload / process restart during
      // playback, the fresh page's truth IS "nothing is playing",
      // and saying so once is what retires the dead page's stale,
      // unswipeable "playing" card in the shell. Without it the gate
      // kept this page silent until the next successful play, and
      // the 1.4.155 chain stayed open. The gate still swallows every
      // later pre-play change (loadText, prepareText, endSession)
      // exactly as before.
      if (!started && !force) return
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
    }
    listen.subscribe(() => publish())
    // The clip's stage changes are publishes too (cure T1-12): a
    // clip starting, pausing or ending must move the card off (and
    // back onto) the reading's claim without waiting for the
    // reading's store to change.
    clipPlayer.subscribe(() => publish())
    // Before the fresh page's first word (R2-T1-2): ask the shell
    // whether a native session outlived the page that handed it
    // over. If one is live (or just finished), applyNativePos
    // adopts it into this page's empty store, and the forced
    // publish below then speaks the ADOPTED truth instead of
    // retiring the card over a still-reading device voice. An old
    // shell without the getter answers nothing, exactly as at the
    // poke listener below.
    try {
      const raw = droid.bubbleNativePos?.()
      if (raw) applyNativePos(JSON.parse(raw) as { idx?: number; total?: number; playing?: boolean; active?: boolean; done?: boolean })
    } catch { /* an old or confused shell: the load truth stays page-known */ }
    // The fresh page's first word to the shell (H-11): publish the
    // current truth once, on load — for a fresh page that truth is
    // inactive, and the shell retires whatever card a dead page left
    // standing. If this page later starts a reading, its own
    // publishes raise the card again through the normal gate.
    publish(true)
    // The device voice's progress, pulled on the shell's poke (H-12):
    // the shell advances its native speaker sentence by sentence and
    // pokes `logosandroid-nativepos`; the page pulls the position
    // through bubbleNativePos (the house's pull pattern — the same
    // shape as bubbleSeek / bubblePendingCmd). Shells without the
    // getter answer nothing and the store keeps its last page-known
    // position; applyNativePos itself refuses reports that do not
    // belong to a live handed session.
    addEventListener('logosandroid-nativepos', () => {
      try {
        const raw = droid.bubbleNativePos?.()
        if (raw) applyNativePos(JSON.parse(raw) as { idx?: number; total?: number; playing?: boolean; active?: boolean; done?: boolean })
      } catch { /* an old or confused shell: the position stays page-known */ }
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
    addEventListener('logosandroid-next', () => { if (clipStage()) { stepClip(15); return } skipNext() })
    addEventListener('logosandroid-prev', () => { if (clipStage()) { stepClip(-15); return } skipPrev() })
    addEventListener('logosandroid-jumpfwd', () => { if (clipStage()) { stepClip(jumpSeconds(settings.get().jumpFwdSec, 30)); return } jumpFwd() })
    addEventListener('logosandroid-jumpback', () => { if (clipStage()) { stepClip(-jumpSeconds(settings.get().jumpBackSec, 15)); return } jumpBack() })
  }
}
