/// <reference lib="webworker" />
// Kokoro synthesis worker. English voices go through kokoro-js (its own
// phonemizer + normalizer); Spanish voices use eSpeak-NG (ephone) phonemes fed
// straight into the same Kokoro model — the direct path is adapted from
// BetterTTS by SysAdminDoc (MIT).

export const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'
const HF_BASE = `https://huggingface.co/${KOKORO_MODEL_ID}/resolve/main/`
const SAMPLE_RATE = 24000
const STYLE_WIDTH = 256
const STYLE_MAX_TOKENS = 509

export type Device = 'webgpu' | 'wasm'
export type Dtype = 'fp32' | 'fp16' | 'q8'

export type WorkerRequest =
  | { type: 'load'; device: Device; dtype: Dtype; spin?: boolean; threads?: number }
  | { type: 'generate'; id: number; text: string; voice: string; phonemeLang: 'en-us' | 'en' | 'es'; speed: number }

export type ProgressInfo = { status?: string; file?: string; progress?: number; loaded?: number; total?: number }

export type WorkerResponse =
  | { type: 'progress'; info: ProgressInfo }
  | { type: 'loaded'; device: Device; dtype: Dtype; ms: number }
  | { type: 'loadError'; message: string }
  | { type: 'generated'; id: number; samples: Float32Array; sampleRate: number; ms: number }
  | { type: 'generateError'; id: number; message: string }

type KokoroInstance = Awaited<ReturnType<(typeof import('kokoro-js'))['KokoroTTS']['from_pretrained']>>
type TensorLike = { data?: Float32Array | number[]; dims?: readonly number[] }
type DirectKokoro = {
  tokenizer(input: string, opts: { truncation: boolean }): { input_ids: TensorLike }
  model(input: Record<string, unknown>): Promise<Record<string, TensorLike | undefined>>
}

let tts: KokoroInstance | null = null
let loading: Promise<void> | null = null
const voiceBins = new Map<string, Float32Array>()
let ephonePromise: Promise<import('ephone').ephoneModule> | null = null

const post = (msg: WorkerResponse, transfer?: Transferable[]) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg, transfer ?? [])

self.addEventListener('message', (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data
  if (msg.type === 'load') void handleLoad(msg)
  else if (msg.type === 'generate') void handleGenerate(msg)
})

async function handleLoad(msg: Extract<WorkerRequest, { type: 'load' }>) {
  if (tts) { post({ type: 'loaded', device: msg.device, dtype: msg.dtype, ms: 0 }); return }
  if (loading) return
  const t0 = performance.now()
  loading = (async () => {
    const { env } = await import('@huggingface/transformers')
    const onnx = env.backends.onnx as { wasm?: { wasmPaths?: unknown; numThreads?: number; proxy?: boolean } }
    if (onnx.wasm) {
      // Transformers.js points ORT at a CDN by default; clear it so ORT loads the
      // WASM binary Vite bundled next to this chunk (same origin, works offline).
      onnx.wasm.wasmPaths = undefined
      const cores = (self.navigator?.hardwareConcurrency ?? 2)
      onnx.wasm.numThreads = self.crossOriginIsolated ? (msg.threads || Math.max(1, Math.min(4, cores - 2))) /* leave cores free so scrolling stays smooth */ : 1
    }
    env.allowLocalModels = false
    env.useBrowserCache = true
    const { KokoroTTS } = await import('kokoro-js')
    const { StyleTextToSpeech2Model, AutoTokenizer } = await import('@huggingface/transformers')
    // Same as KokoroTTS.from_pretrained, but with session options it doesn't pass
    // through: WASM worker threads sleep instead of busy-spinning between ops,
    // which leaves the phone's cores to the page (smooth visualizer and
    // scrolling) and keeps it cooler, so it throttles less on long texts.
    const load = async (device: Device, dtype: Dtype): Promise<KokoroInstance> => {
      const progress_callback = (info: unknown) => post({ type: 'progress', info: info as ProgressInfo })
      const session_options = device === 'wasm' && msg.spin === false
        ? { extra: { session: { intra_op: { allow_spinning: '0' }, inter_op: { allow_spinning: '0' } } } }
        : {}
      const [model, tokenizer] = await Promise.all([
        StyleTextToSpeech2Model.from_pretrained(KOKORO_MODEL_ID, { device, dtype, progress_callback, session_options } as never),
        AutoTokenizer.from_pretrained(KOKORO_MODEL_ID, { progress_callback } as never),
      ])
      return new (KokoroTTS as unknown as new (m: unknown, t: unknown) => KokoroInstance)(model, tokenizer)
    }
    let device = msg.device
    let dtype = msg.dtype
    try {
      tts = await load(device, dtype)
      // Many phone GPUs load the model but fail on the first real run
      // ("createBuffer … too large"); find out now, not when you press play.
      if (device === 'webgpu') {
        const probe = (await tts.generate('Hello there, this is a quick check.', { voice: 'af_heart' as never })) as { audio?: Float32Array }
        const bad = probe.audio ? audioFault(probe.audio, 'Hello there, this is a quick check.') : 'no audio'
        if (bad) throw new Error(`WebGPU ${dtype} self-test: ${bad}`)
      }
    } catch (err) {
      tts = null
      throw err
    }
    loadedDevice = device
    post({ type: 'loaded', device, dtype, ms: Math.round(performance.now() - t0) })
  })()
  try { await loading } catch (err) {
    tts = null
    post({ type: 'loadError', message: err instanceof Error ? err.message : String(err) })
  } finally { loading = null }
}

let loadedDevice: Device | null = null

/** Returns a reason when synthesized audio is unusable (NaN, or silent for real text). */
function audioFault(x: Float32Array, text: string): string | null {
  let peak = 0
  const step = Math.max(1, Math.floor(x.length / 20000))
  for (let i = 0; i < x.length; i += step) {
    const v = x[i]
    if (v !== v) return 'produced invalid audio (NaN)'
    const a = v < 0 ? -v : v
    if (a > peak) peak = a
  }
  if (peak < 1e-3 && /[\p{L}\p{N}]{2}/u.test(text)) return 'produced silent audio'
  return null
}

async function handleGenerate(msg: Extract<WorkerRequest, { type: 'generate' }>) {
  const t0 = performance.now()
  try {
    if (!tts) throw new Error('Model not loaded')
    let samples: Float32Array | undefined
    if (msg.phonemeLang === 'es') {
      samples = await synthesizeDirect(tts as unknown as DirectKokoro, msg.text, msg.voice, msg.speed)
    } else {
      const audio = (await tts.generate(msg.text, { voice: msg.voice as never, speed: msg.speed })) as { audio?: Float32Array }
      samples = audio.audio
    }
    if (!samples || samples.length === 0) throw new Error('No audio produced')
    // Half-precision GPU runs can overflow and return NaN or all-zero audio,
    // which played as silence. Treat that as an engine failure so Logos falls
    // back instead of "playing" blank sentences.
    const bad = audioFault(samples, msg.text)
    if (bad) throw new Error(`${loadedDevice === 'webgpu' ? 'GPU ' : ''}${bad}`)
    const copy = samples.buffer.byteLength === samples.byteLength ? samples : samples.slice()
    post({ type: 'generated', id: msg.id, samples: copy, sampleRate: SAMPLE_RATE, ms: Math.round(performance.now() - t0) }, [copy.buffer])
  } catch (err) {
    post({ type: 'generateError', id: msg.id, message: err instanceof Error ? err.message : String(err) })
  }
}

// ── Direct path (Spanish) ───────────────────────────────────────

async function synthesizeDirect(direct: DirectKokoro, text: string, voice: string, speed: number): Promise<Float32Array | undefined> {
  const phonemes = await phonemizeSpanish(text)
  if (!phonemes) return undefined
  const tokenized = direct.tokenizer(phonemes, { truncation: true })
  const tokenCount = tokenized.input_ids.dims?.at(-1) ?? 0
  const offset = STYLE_WIDTH * Math.min(Math.max(tokenCount - 2, 0), STYLE_MAX_TOKENS)
  const bin = await voiceBin(voice)
  const style = bin.slice(offset, offset + STYLE_WIDTH)
  const { Tensor } = await import('@huggingface/transformers')
  const out = await direct.model({
    input_ids: tokenized.input_ids,
    style: new Tensor('float32', style, [1, STYLE_WIDTH]),
    speed: new Tensor('float32', [speed], [1]),
  })
  const wave = out.waveform ?? out.audio ?? Object.values(out).find((v) => v?.data)
  if (!wave?.data) return undefined
  return wave.data instanceof Float32Array ? wave.data : new Float32Array(wave.data)
}

async function phonemizeSpanish(text: string): Promise<string> {
  const normalized = text
    .replace(/[‘’]/g, "'")
    .replace(/[«»“”]/g, '"')
    .replace(/\(/g, '«').replace(/\)/g, '»')
    .replace(/[^\S \n]/g, ' ')
    .replace(/  +/g, ' ')
    .trim()
  if (!normalized) return ''
  ephonePromise ??= quiet(() => import('ephone').then(({ default: create, roa }) => create(roa)))
  const ephone = await ephonePromise
  ephone.setVoice('es')
  const ipa = await quiet(async () => ephone.textToIpa(normalized))
  return ipa.trim()
}

async function quiet<T>(fn: () => Promise<T>): Promise<T> {
  const log = console.log
  console.log = (...args: unknown[]) => { if (args[0] !== 'Tones have been removed') log(...args) }
  try { return await fn() } finally { console.log = log }
}

async function voiceBin(voice: string): Promise<Float32Array> {
  const hit = voiceBins.get(voice)
  if (hit) return hit
  const url = `${HF_BASE}voices/${voice}.bin`
  let buf: ArrayBuffer | null = null
  let cache: Cache | undefined
  try {
    cache = await caches.open('kokoro-voices') // same cache kokoro-js uses
    const res = await cache.match(url)
    if (res) buf = await res.arrayBuffer()
  } catch { /* no cache */ }
  if (!buf) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Voice ${voice} download failed (${res.status})`)
    buf = await res.arrayBuffer()
    try { await cache?.put(url, new Response(buf.slice(0))) } catch { /* ignore */ }
  }
  const data = new Float32Array(buf)
  voiceBins.set(voice, data)
  return data
}
