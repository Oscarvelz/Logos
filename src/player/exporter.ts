// Full-audio export: synthesize every sentence (speed applied without changing
// pitch), join with natural pauses, encode MP3 (incrementally) or WAV, and
// save to the Library. Lives outside React so it survives page changes.
import { createStore } from '../lib/store.ts'
import { settings } from '../lib/settings.ts'
import { segmentText, pauseAfter, speakable } from '../lib/text.ts'
import { exportVoiceId, type Lang } from '../lib/voices.ts'
import { concat, createMp3Encoder, encodeWav, silence, trimSilence, applyGain, levelGain, slugify } from '../lib/audio.ts'
import { synthesize } from '../engine/engine.ts'
import { saveClip, updateClip, getClip, type ClipMeta } from '../lib/library.ts'
import { voiceCredit } from './voice-credit.ts'
import { t } from '../lib/i18n.ts'

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

/** Admission claim (R2-T7-1): held from a job's synchronous admission
 *  until it fully ends. The store's 'running' status is only set after
 *  the pre-flight (the getClip await + segmentation), so the admission
 *  gates consult this claim alongside the status — without it, a second
 *  admission inside the getClip window passed both gates and ran a
 *  second render over this one store and the one `ctrl` above: progress
 *  and result stomped, Cancel reached only the second render, and both
 *  jobs could reach saveClip. */
let claimed = false

export function titleFrom(text: string): string {
  const first = text.trim().split(/\n/)[0].replace(/\s+/g, ' ')
  return first.length > 64 ? `${first.slice(0, 61).replace(/\s+\S*$/, '')}…` : first || 'Untitled'
}

/** File name for one export (M-46): slugify already restricts the title
 *  to a filesystem/share-sheet-safe alphabet ([a-z0-9-], diacritics
 *  folded, capped length, 'logos' when nothing survives); this adds the
 *  session half — a name is never handed out twice in one app session,
 *  so two exports of the same title download as name.mp3 and
 *  name-2.mp3 instead of silently overwriting each other. */
const usedExportNames = new Set<string>()
export function exportFileName(title: string, format: string): string {
  const base = slugify(title)
  let name = `${base}.${format}`
  for (let n = 2; usedExportNames.has(name); n++) name = `${base}-${n}.${format}`
  usedExportNames.add(name)
  return name
}

type ExportOpts = { voice: string | null; speed: number; format: 'mp3' | 'wav'; title?: string; summary?: string; origin?: 'create' | 'listen'; id?: string; url?: string; site?: string }
const queue: { text: string; opts: ExportOpts }[] = []

/** Render now, or after the current job when one is already running (Listen → Library can stack several). */
export function queueExport(text: string, opts: ExportOpts): 'started' | 'queued' {
  if (claimed || exportJob.get().status === 'running') { queue.push({ text, opts }); exportJob.set({ queued: queue.length }); return 'queued' }
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
  if (claimed || exportJob.get().status === 'running') return
  claimed = true
  try {
    await runExportClaimed(text, opts)
  } finally {
    // Released on every exit — including a pre-flight rejection (today
    // that rejection propagates unhandled; the claim must not leak with
    // it and wedge every later admission behind a phantom job).
    claimed = false
  }
}

async function runExportClaimed(text: string, opts: ExportOpts) {
  const st = settings.get()
  // M-41: re-rendering an existing clip renders at THE CLIP's speed —
  // the clip record's `sp` is the owner (the Playback office's contract);
  // the caller's speed (today: the live Listen speed from LibraryPage)
  // is only the fallback for clips that carry no `sp`, and the global
  // speeds govern only fresh, non-clip renders.
  const existingEarly = opts.id ? await getClip(opts.id) : null
  const clipSp = (existingEarly as (ClipMeta & { sp?: unknown }) | null)?.sp
  const speed = typeof clipSp === 'number' && Number.isFinite(clipSp) && clipSp > 0 ? clipSp : opts.speed
  const segments = segmentText(text, st.langMode)
  if (!segments.length) { next(); return }
  // T7-11: the resolution itself lives in voices.ts (exportVoiceId) —
  // an explicit pick renders every segment; only Auto (null) picks
  // per language. The old inline rule silently overrode an explicit
  // pick per segment in Auto language mode.
  const pick = (lang: Lang) => exportVoiceId(opts.voice, lang, st)
  ctrl = new AbortController()
  const signal = ctrl.signal
  exportJob.set({ status: 'running', done: 0, total: segments.length, startedAt: Date.now(), audioSec: 0, result: null, error: null, origin: opts.origin ?? 'create', title: opts.title?.trim() || titleFrom(text), itemId: opts.id ?? null })
  if (opts.id) void updateClip(opts.id, { rendering: true }, false)
  const SR = 24000
  try {
    const mp3 = opts.format === 'mp3' ? await createMp3Encoder(SR, 128) : null
    const pcm: Float32Array[] = []
    let samples = 0
    // Rendered samples per voice actually used (T7-14): in Auto the
    // pick switches per segment language, so a mixed-language book is
    // sung by several voices — the credit below is tallied from what
    // each voice truly rendered, not assumed from the first segment.
    const voiceSamples = new Map<string, number>()
    // Keep two requests queued so the worker never idles between sentences.
    const inflight: Promise<{ samples: Float32Array; sampleRate: number }>[] = []
    const request = (i: number) => {
      const spoken = speakable(segments[i].text, segments[i].lang)
      // A sentence that was only a code or a machine file name becomes a breath,
      // not a spelling bee (same rule as live listening).
      const p = spoken
        ? synthesize(spoken, pick(segments[i].lang), speed, { priority: 0, signal })
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
      const gap = silence(pauseAfter(segments[i], st.sentencePauseMs) / speed, res.sampleRate)
      const lead = i === 0 ? silence(150, res.sampleRate) : null
      const chunk = concat(lead ? [lead, body, gap] : [body, gap])
      samples += chunk.length
      const vid = pick(segments[i].lang)
      voiceSamples.set(vid, (voiceSamples.get(vid) ?? 0) + chunk.length)
      if (mp3) await mp3.push(chunk)
      else pcm.push(chunk)
      exportJob.set({ done: i + 1, audioSec: samples / SR })
    }
    const blob = mp3 ? mp3.finish() : encodeWav(concat(pcm), SR)
    // Credit every voice that sang (T7-14, computed in
    // voice-credit.ts from the per-voice tally above): `voice` is
    // the dominant voice; `voices` — present only when more than one
    // sang — lists them all. A single-voice re-render also CLEARS a
    // stale `voices` a previous mixed render left on the record.
    const { voice: credit, voices: creditVoices } = voiceCredit(voiceSamples)
    const withVoices = <T extends object>(rec: T): T => {
      const out = { ...rec } as T & { voices?: string[] }
      if (creditVoices) out.voices = creditVoices
      else delete out.voices
      return out
    }
    const existing = existingEarly
    const meta = existing
      ? await saveClip(withVoices({ ...existing, voice: credit, duration: samples / SR, format: opts.format, blob, kind: 'audio', rendering: false, pos: 0 }))
      : await saveClip(withVoices({
        title: opts.title?.trim() || titleFrom(text), summary: opts.summary, text, voice: credit, lang: segments[0].lang,
        duration: samples / SR, format: opts.format, blob, kind: 'audio', source: opts.origin ?? 'create', url: opts.url, site: opts.site,
      }))
    exportJob.set({ status: 'done', result: { blob, meta } })
  } catch (err) {
    if (opts.id) void updateClip(opts.id, { rendering: false })
    if ((err as Error).name === 'AbortError') exportJob.set({ status: 'idle', done: 0, total: 0 })
    else {
      // The raw system message («Failed to fetch») is not user language
      // (audit C-4): say what happened, in the app's own words.
      const raw = (err as Error).message ?? ''
      exportJob.set({ status: 'error', error: /quota|storage/i.test(raw) ? t('Not enough storage to finish the audiobook') : t('The audiobook could not be finished — please try again') })
    }
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
