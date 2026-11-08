// Full-audio export: synthesize every sentence (speed applied without changing
// pitch), join with natural pauses, encode MP3 (incrementally) or WAV, and
// save to the Library. Lives outside React so it survives page changes.
import { createStore } from '../lib/store.ts'
import { settings } from '../lib/settings.ts'
import { segmentText, pauseAfter, speakable } from '../lib/text.ts'
import { voiceById, type Lang } from '../lib/voices.ts'
import { concat, createMp3Encoder, encodeWav, silence, trimSilence, applyGain, levelGain } from '../lib/audio.ts'
import { synthesize } from '../engine/engine.ts'
import { saveClip, updateClip, getClip, type ClipMeta } from '../lib/library.ts'

export type ExportState = {
  status: 'idle' | 'running' | 'done' | 'error'
  done: number
  total: number
  startedAt: number
  audioSec: number
  result: { blob: Blob; meta: ClipMeta } | null
  error: string | null
  origin?: 'create' | 'listen'
  title?: string
  itemId?: string | null
  queued?: number
}

export const exportJob = createStore<ExportState>({ status: 'idle', done: 0, total: 0, startedAt: 0, audioSec: 0, result: null, error: null })

let ctrl: AbortController | null = null

export function titleFrom(text: string): string {
  const first = text.trim().split(/\n/)[0].replace(/\s+/g, ' ')
  return first.length > 64 ? `${first.slice(0, 61).replace(/\s+\S*$/, '')}…` : first || 'Untitled'
}

type ExportOpts = { voice: string | null; speed: number; format: 'mp3' | 'wav'; title?: string; summary?: string; origin?: 'create' | 'listen'; id?: string; url?: string; site?: string }
const queue: { text: string; opts: ExportOpts }[] = []

/** Render now, or after the current job when one is already running (Listen → Library can stack several). */
export function queueExport(text: string, opts: ExportOpts): 'started' | 'queued' {
  if (exportJob.get().status === 'running') { queue.push({ text, opts }); exportJob.set({ queued: queue.length }); return 'queued' }
  void runExport(text, opts)
  return 'started'
}

function next() {
  const n = queue.shift()
  exportJob.set({ queued: queue.length })
  if (n) setTimeout(() => void runExport(n.text, n.opts), 50)
}

export function isQueued(id: string) { return queue.some((q) => q.opts.id === id) }

export async function runExport(text: string, opts: ExportOpts) {
  if (exportJob.get().status === 'running') return
  const st = settings.get()
  const segments = segmentText(text, st.langMode)
  if (!segments.length) { next(); return }
  const pick = (lang: Lang) => {
    const v = voiceById(opts.voice ?? undefined)
    if (v && (v.lang === lang || st.langMode !== 'auto')) return v.id
    return st.defaultVoice[lang]
  }
  ctrl = new AbortController()
  const signal = ctrl.signal
  exportJob.set({ status: 'running', done: 0, total: segments.length, startedAt: Date.now(), audioSec: 0, result: null, error: null, origin: opts.origin ?? 'create', title: opts.title?.trim() || titleFrom(text), itemId: opts.id ?? null })
  if (opts.id) void updateClip(opts.id, { rendering: true }, false)
  const SR = 24000
  try {
    const mp3 = opts.format === 'mp3' ? await createMp3Encoder(SR, 128) : null
    const pcm: Float32Array[] = []
    let samples = 0
    // Keep two requests queued so the worker never idles between sentences.
    const inflight: Promise<{ samples: Float32Array; sampleRate: number }>[] = []
    const request = (i: number) => {
      const spoken = speakable(segments[i].text, segments[i].lang)
      // A sentence that was only a code or a machine file name becomes a breath,
      // not a spelling bee (same rule as live listening).
      const p = spoken
        ? synthesize(spoken, pick(segments[i].lang), opts.speed, { priority: 0, signal })
        : Promise.resolve({ samples: silence(300, SR), sampleRate: SR })
      p.catch(() => {})
      return p
    }
    for (let i = 0; i < Math.min(2, segments.length); i++) inflight.push(request(i))
    for (let i = 0; i < segments.length; i++) {
      const res = await inflight[i]
      if (i + 2 < segments.length) inflight.push(request(i + 2))
      const trimmed = trimSilence(res.samples, res.sampleRate)
      // Level each sentence toward a common loudness, like live listening.
      const body = applyGain(trimmed, levelGain(trimmed))
      const gap = silence(pauseAfter(segments[i], st.sentencePauseMs) / opts.speed, res.sampleRate)
      const lead = i === 0 ? silence(150, res.sampleRate) : null
      const chunk = concat(lead ? [lead, body, gap] : [body, gap])
      samples += chunk.length
      if (mp3) await mp3.push(chunk)
      else pcm.push(chunk)
      exportJob.set({ done: i + 1, audioSec: samples / SR })
    }
    const blob = mp3 ? mp3.finish() : encodeWav(concat(pcm), SR)
    const first = voiceById(pick(segments[0].lang))
    const existing = opts.id ? await getClip(opts.id) : null
    const meta = existing
      ? await saveClip({ ...existing, voice: first?.id ?? '', duration: samples / SR, format: opts.format, blob, kind: 'audio', rendering: false, pos: 0 })
      : await saveClip({
        title: opts.title?.trim() || titleFrom(text), summary: opts.summary, text, voice: first?.id ?? '', lang: segments[0].lang,
        duration: samples / SR, format: opts.format, blob, kind: 'audio', source: opts.origin ?? 'create', url: opts.url, site: opts.site,
      })
    exportJob.set({ status: 'done', result: { blob, meta } })
  } catch (err) {
    if (opts.id) void updateClip(opts.id, { rendering: false })
    if ((err as Error).name === 'AbortError') exportJob.set({ status: 'idle', done: 0, total: 0 })
    else exportJob.set({ status: 'error', error: (err as Error).message })
  } finally {
    ctrl = null
    next()
  }
}

export function cancelExport() {
  ctrl?.abort()
}

/** Remove a waiting job (or stop it if it is the one rendering). */
export function cancelItem(id: string) {
  const i = queue.findIndex((q) => q.opts.id === id)
  if (i >= 0) { queue.splice(i, 1); exportJob.set({ queued: queue.length }); return }
  if (exportJob.get().itemId === id) ctrl?.abort()
}

export function resetExport() {
  if (exportJob.get().status !== 'running') exportJob.set({ status: 'idle', result: null, error: null, done: 0, total: 0 })
}
