/// <reference lib="webworker" />
// PocketTTS (Kyutai, 100M, CC BY 4.0) running on ONNX Runtime WASM, one
// language per worker. Built for CPUs: it decodes speech in 80 ms frames and
// runs faster than real time on phones where Kokoro cannot.
import { Pipeline } from 'pocket-tts-onnx'

export type PocketRequest =
  | { type: 'load'; language: string; threads: number }
  | { type: 'speak'; id: number; text: string; voice: string }
  | { type: 'cancel'; id: number }

export type PocketResponse =
  | { type: 'progress'; loaded: number; total: number; cached: boolean }
  | { type: 'ready'; voices: string[]; sampleRate: number; ms: number }
  | { type: 'loadError'; message: string }
  | { type: 'spoken'; id: number; samples: Float32Array; sampleRate: number; ms: number }
  | { type: 'speakError'; id: number; message: string }

let pipeline: Pipeline | null = null
let loading: Promise<void> | null = null
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
    // Warm the default voice so the first sentence starts quickly.
    await pipeline.speak('Hi.', { voice: pipeline.defaultVoice }).catch(() => undefined)
    post({ type: 'ready', voices: pipeline.voices, sampleRate: pipeline.sampleRate, ms: Math.round(performance.now() - t0) })
  })()
  try { await loading } catch (err) {
    pipeline = null
    post({ type: 'loadError', message: err instanceof Error ? err.message : String(err) })
  } finally { loading = null }
}

async function speak(m: Extract<PocketRequest, { type: 'speak' }>) {
  const t0 = performance.now()
  try {
    if (!pipeline) throw new Error('PocketTTS is not loaded')
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
    post({ type: 'speakError', id: m.id, message: err instanceof Error ? err.message : String(err) })
  }
}
