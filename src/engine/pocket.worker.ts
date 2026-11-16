/// <reference lib="webworker" />
// PocketTTS (Kyutai, 100M, CC BY 4.0) running on ONNX Runtime WASM, one
// language per worker. Built for CPUs: it decodes speech in 80 ms frames and
// runs faster than real time on phone processors.
import { Pipeline } from 'pocket-tts-onnx'

export type PocketRequest =
  | { type: 'load'; language: string; threads: number }
  | { type: 'speak'; id: number; text: string; voice: string }
  | { type: 'cancel'; id: number }

export type PocketResponse =
  | { type: 'progress'; loaded: number; total: number; cached: boolean }
  | { type: 'ready'; voices: string[]; sampleRate: number; ms: number }
  | { type: 'loadError'; message: string; name?: string }
  | { type: 'spoken'; id: number; samples: Float32Array; sampleRate: number; ms: number }
  | { type: 'speakError'; id: number; message: string; name?: string }

/**
 * The true error, carried whole (M-22): the original message verbatim
 * and its kind (the error's name) beside it. The old flattening —
 * `err instanceof Error ? err.message : String(err)` — re-labelled
 * everything it could not recognise: a DOMException or a plain
 * {message, name} object thrown across the WASM boundary became
 * "[object Object]" or lost its kind entirely, and the page then
 * showed a generic line for a specific failure. An error with a
 * readable message keeps it, whatever its class; only an error with
 * no message at all falls back to a serialised shape, never to a
 * placeholder that hides what happened.
 */
function errInfo(err: unknown): { message: string; name: string } {
  if (err instanceof Error) return { message: err.message || err.name, name: err.name || 'Error' }
  if (typeof err === 'object' && err !== null) {
    const o = err as { message?: unknown; name?: unknown }
    const name = typeof o.name === 'string' && o.name ? o.name : 'Error'
    if (typeof o.message === 'string' && o.message) return { message: o.message, name }
    try { const s = JSON.stringify(err); if (s && s !== '{}') return { message: s, name } } catch { /* fall through */ }
  }
  if (typeof err === 'string' && err) return { message: err, name: 'Error' }
  return { message: String(err), name: 'Error' }
}

let pipeline: Pipeline | null = null
let loading: Promise<void> | null = null
let warm: Promise<void> = Promise.resolve()
const cancelled = new Set<number>()
const post = (m: PocketResponse, t: Transferable[] = []) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m, t)

self.addEventListener('message', (e: MessageEvent<PocketRequest>) => {
  const m = e.data
  if (m.type === 'load') void load(m)
  else if (m.type === 'speak') void speak(m)
  else if (m.type === 'cancel') cancelled.add(m.id)
})

async function load(m: Extract<PocketRequest, { type: 'load' }>) {
  if (pipeline) { post({ type: 'ready', voices: pipeline.voices, sampleRate: pipeline.sampleRate, ms: 0 }); return }
  if (loading) return
  const t0 = performance.now()
  loading = (async () => {
    pipeline = await Pipeline.load({
      language: m.language,
      threads: m.threads,
      onProgress: (stage, p) => { if (stage === 'model') post({ type: 'progress', loaded: p.loaded, total: p.total, cached: p.cached }) },
    })
    post({ type: 'ready', voices: pipeline.voices, sampleRate: pipeline.sampleRate, ms: Math.round(performance.now() - t0) })
    // Warm the default voice in the background; the first sentence waits for it.
    const p = pipeline
    warm = p.speak('Hi.', { voice: p.defaultVoice }).then(() => undefined, () => undefined)
  })()
  try { await loading } catch (err) {
    pipeline = null
    post({ type: 'loadError', ...errInfo(err) })
  } finally { loading = null }
}

async function speak(m: Extract<PocketRequest, { type: 'speak' }>) {
  const t0 = performance.now()
  try {
    if (!pipeline) throw new Error('PocketTTS is not loaded')
    await warm
    const ctrl = new AbortController()
    const frames: Float32Array[] = []
    let total = 0
    const voice = pipeline.voices.includes(m.voice) ? m.voice : pipeline.defaultVoice
    for await (const f of pipeline.stream(m.text, { voice, signal: ctrl.signal })) {
      if (cancelled.has(m.id)) { ctrl.abort(); break }
      frames.push(f); total += f.length
    }
    if (cancelled.delete(m.id)) throw new DOMException('Aborted', 'AbortError')
    const out = new Float32Array(total)
    let at = 0
    for (const f of frames) { out.set(f, at); at += f.length }
    if (!out.length) throw new Error('No audio produced')
    post({ type: 'spoken', id: m.id, samples: out, sampleRate: pipeline.sampleRate, ms: Math.round(performance.now() - t0) }, [out.buffer])
  } catch (err) {
    post({ type: 'speakError', id: m.id, ...errInfo(err) })
  }
}
