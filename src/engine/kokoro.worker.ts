/// <reference lib="webworker" />
// Kokoro 82M (hexgrad, Apache-2.0) — the COMPLETE model. It shipped
// at fp16 in 1.4.143 (Oscar's "Kokoro el completo, no el destilado")
// and crashed his phone on load: fp16 storage plus the runtime's
// inflation toward fp32 outgrew the WebView's memory. From 1.4.144 it
// runs at q8 storage — the same architecture, all 82M weights, stored
// at 8 bits and executed on integer kernels; quantization is not
// distillation, and Oscar picked this route himself. Runs on ONNX
// Runtime WASM through kokoro-js / Transformers.js. The model bytes
// never come from Hugging Face at runtime: the manager (kokoro.ts)
// streams our hosted parts into the Transformers browser cache under
// this origin's hub-mirror URLs; the loader below reads them from
// that cache. Voices arrive the same way through the 'kokoro-voices'
// cache. Proven in the 2026-11-11 spike (q8 spoke identically to fp16).
import { KokoroTTS } from 'kokoro-js'
import { env } from '@huggingface/transformers'

// Configure the Transformers env through the library's own module:
// kokoro-js re-exports only a sliver of it (its `env` has no
// `backends`), but both imports resolve to the same instance, so
// setting remoteHost / wasm paths here is what the loader obeys.

export type KokoroRequest =
  | { type: 'load'; remoteHost: string; ortBase: string; threads: number }
  | { type: 'speak'; id: number; text: string; voice: string }
  | { type: 'cancel'; id: number }

export type KokoroResponse =
  | { type: 'progress'; loaded: number; total: number; cached: boolean }
  | { type: 'ready'; ms: number }
  | { type: 'loadError'; message: string }
  | { type: 'spoken'; id: number; samples: Float32Array; sampleRate: number; ms: number }
  | { type: 'speakError'; id: number; message: string }

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'
let tts: KokoroTTS | null = null
let loading: Promise<void> | null = null
const cancelled = new Set<number>()
const post = (m: KokoroResponse, t: Transferable[] = []) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m, t)

self.addEventListener('message', (e: MessageEvent<KokoroRequest>) => {
  const m = e.data
  if (m.type === 'load') void load(m)
  else if (m.type === 'speak') void speak(m)
  else if (m.type === 'cancel') cancelled.add(m.id)
})

async function load(m: Extract<KokoroRequest, { type: 'load' }>) {
  if (tts) { post({ type: 'ready', ms: 0 }); return }
  if (loading) return
  const t0 = performance.now()
  loading = (async () => {
    env.remoteHost = m.remoteHost
    const wasm = env.backends.onnx.wasm as unknown as Record<string, unknown>
    wasm.wasmPaths = m.ortBase
    wasm.numThreads = m.threads
    tts = await KokoroTTS.from_pretrained(MODEL_ID, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (p: { status?: string; file?: string; loaded?: number; total?: number }) => {
        if (p && p.status === 'progress' && typeof p.loaded === 'number' && typeof p.total === 'number') {
          post({ type: 'progress', loaded: p.loaded, total: p.total, cached: true })
        }
      },
    })
    post({ type: 'ready', ms: Math.round(performance.now() - t0) })
    // Warm the flagship voice: the first sentence should not pay for it.
    const t = tts
    void t.generate('Hi.', { voice: 'af_heart' }).then(() => undefined, () => undefined)
  })()
  try { await loading } catch (err) {
    tts = null
    post({ type: 'loadError', message: err instanceof Error ? err.message : String(err) })
  } finally { loading = null }
}

async function speak(m: Extract<KokoroRequest, { type: 'speak' }>) {
  const t0 = performance.now()
  try {
    if (!tts) throw new Error('Kokoro is not loaded')
    const out = await tts.generate(m.text, { voice: m.voice as never })
    if (cancelled.delete(m.id)) throw new DOMException('Aborted', 'AbortError')
    if (!out.audio.length) throw new Error('No audio produced')
    const samples = new Float32Array(out.audio)
    post({ type: 'spoken', id: m.id, samples, sampleRate: out.sampling_rate, ms: Math.round(performance.now() - t0) }, [samples.buffer])
  } catch (err) {
    post({ type: 'speakError', id: m.id, message: err instanceof Error ? err.message : String(err) })
  }
}
