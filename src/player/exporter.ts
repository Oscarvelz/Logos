// Full-audio export: synthesize every sentence (speed applied without changing
// pitch), join with natural pauses, encode MP3 (incrementally) or WAV, and
// save to the Library. Lives outside React so it survives page changes.
import { createStore } from '../lib/store.ts'
import { settings } from '../lib/settings.ts'
import { segmentText } from '../lib/text.ts'
import { voiceById, type Lang } from '../lib/voices.ts'
import { concat, createMp3Encoder, encodeWav, silence, trimSilence } from '../lib/audio.ts'
import { synthesize } from '../engine/engine.ts'
import { saveClip, type ClipMeta } from '../lib/library.ts'

export type ExportState = {
  status: 'idle' | 'running' | 'done' | 'error'
  done: number
  total: number
  startedAt: number
  audioSec: number
  result: { blob: Blob; meta: ClipMeta } | null
  error: string | null
}

export const exportJob = createStore<ExportState>({ status: 'idle', done: 0, total: 0, startedAt: 0, audioSec: 0, result: null, error: null })

let ctrl: AbortController | null = null

export function titleFrom(text: string): string {
  const first = text.trim().split(/\n/)[0].replace(/\s+/g, ' ')
  return first.length > 64 ? `${first.slice(0, 61).replace(/\s+\S*$/, '')}…` : first || 'Untitled'
}

export async function runExport(text: string, opts: { voice: string | null; speed: number; format: 'mp3' | 'wav'; title?: string }) {
  if (exportJob.get().status === 'running') return
  const st = settings.get()
  const segments = segmentText(text, st.langMode)
  if (!segments.length) return
  const pick = (lang: Lang) => {
    const v = voiceById(opts.voice ?? undefined)
    if (v && (v.lang === lang || st.langMode !== 'auto')) return v.id
    return st.defaultVoice[lang]
  }
  ctrl = new AbortController()
  const signal = ctrl.signal
  exportJob.set({ status: 'running', done: 0, total: segments.length, startedAt: Date.now(), audioSec: 0, result: null, error: null })
  const SR = 24000
  try {
    const mp3 = opts.format === 'mp3' ? await createMp3Encoder(SR, 128) : null
    const pcm: Float32Array[] = []
    let samples = 0
    // Keep two requests queued so the worker never idles between sentences.
    const inflight: Promise<{ samples: Float32Array; sampleRate: number }>[] = []
    const request = (i: number) => {
      const p = synthesize(segments[i].text, pick(segments[i].lang), opts.speed, { priority: 0, signal })
      p.catch(() => {})
      return p
    }
    for (let i = 0; i < Math.min(2, segments.length); i++) inflight.push(request(i))
    for (let i = 0; i < segments.length; i++) {
      const res = await inflight[i]
      if (i + 2 < segments.length) inflight.push(request(i + 2))
      const body = trimSilence(res.samples, res.sampleRate)
      const gap = silence(st.sentencePauseMs * (segments[i].paraEnd ? 2.2 : 1) / opts.speed, res.sampleRate)
      const lead = i === 0 ? silence(150, res.sampleRate) : null
      const chunk = concat(lead ? [lead, body, gap] : [body, gap])
      samples += chunk.length
      if (mp3) await mp3.push(chunk)
      else pcm.push(chunk)
      exportJob.set({ done: i + 1, audioSec: samples / SR })
    }
    const blob = mp3 ? mp3.finish() : encodeWav(concat(pcm), SR)
    const first = voiceById(pick(segments[0].lang))
    const meta = await saveClip({
      title: opts.title?.trim() || titleFrom(text), text, voice: first?.id ?? '', lang: segments[0].lang,
      duration: samples / SR, format: opts.format, blob,
    })
    exportJob.set({ status: 'done', result: { blob, meta } })
  } catch (err) {
    if ((err as Error).name === 'AbortError') exportJob.set({ status: 'idle', done: 0, total: 0 })
    else exportJob.set({ status: 'error', error: (err as Error).message })
  } finally {
    ctrl = null
  }
}

export function cancelExport() {
  ctrl?.abort()
}

export function resetExport() {
  if (exportJob.get().status !== 'running') exportJob.set({ status: 'idle', result: null, error: null, done: 0, total: 0 })
}
