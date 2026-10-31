// PCM helpers: WAV/MP3 encoding, envelopes for the visualizer, joining clips.

export function floatTo16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const pcm = floatTo16(samples)
  const buf = new ArrayBuffer(44 + pcm.byteLength)
  const v = new DataView(buf)
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.byteLength, true); w(8, 'WAVE')
  w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  w(36, 'data'); v.setUint32(40, pcm.byteLength, true)
  new Int16Array(buf, 44).set(pcm)
  return new Blob([buf], { type: 'audio/wav' })
}

/** Incremental MP3 encoder (lamejs) — feed chunks as they are synthesized. */
export async function createMp3Encoder(sampleRate: number, kbps = 128) {
  const { Mp3Encoder } = await import('@breezystack/lamejs')
  const enc = new Mp3Encoder(1, sampleRate, kbps)
  const parts: Uint8Array[] = []
  const BLOCK = 1152 * 20
  return {
    async push(samples: Float32Array) {
      const pcm = floatTo16(samples)
      for (let i = 0; i < pcm.length; i += BLOCK) {
        const out = enc.encodeBuffer(pcm.subarray(i, i + BLOCK))
        if (out.length) parts.push(new Uint8Array(out))
        if (i % (BLOCK * 10) === 0) await new Promise((r) => setTimeout(r, 0))
      }
    },
    finish(): Blob {
      const out = enc.flush()
      if (out.length) parts.push(new Uint8Array(out))
      return new Blob(parts as BlobPart[], { type: 'audio/mpeg' })
    },
  }
}

export async function encodeMp3(samples: Float32Array, sampleRate: number, kbps = 128): Promise<Blob> {
  const enc = await createMp3Encoder(sampleRate, kbps)
  await enc.push(samples)
  return enc.finish()
}

/** RMS envelope at `fps` frames/second, normalised to 0..1. */
export function envelope(samples: Float32Array, sampleRate: number, fps = 60): Float32Array {
  const hop = Math.max(1, Math.floor(sampleRate / fps))
  const n = Math.ceil(samples.length / hop)
  const env = new Float32Array(n)
  let peak = 1e-6
  for (let f = 0; f < n; f++) {
    let sum = 0
    const a = f * hop
    const b = Math.min(samples.length, a + hop)
    for (let i = a; i < b; i++) sum += samples[i] * samples[i]
    const rms = Math.sqrt(sum / Math.max(1, b - a))
    env[f] = rms
    if (rms > peak) peak = rms
  }
  for (let f = 0; f < n; f++) env[f] = Math.min(1, env[f] / peak)
  return env
}

/** Trim near-silent head/tail so sentence joins sound natural. */
export function trimSilence(samples: Float32Array, sampleRate: number, threshold = 0.004, keepMs = 40): Float32Array {
  let a = 0
  let b = samples.length - 1
  while (a < b && Math.abs(samples[a]) < threshold) a++
  while (b > a && Math.abs(samples[b]) < threshold) b--
  const keep = Math.floor((keepMs / 1000) * sampleRate)
  return samples.subarray(Math.max(0, a - keep), Math.min(samples.length, b + keep))
}

export function silence(ms: number, sampleRate: number): Float32Array {
  return new Float32Array(Math.floor((ms / 1000) * sampleRate))
}

export function concat(chunks: Float32Array[]): Float32Array {
  const len = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Float32Array(len)
  let o = 0
  for (const c of chunks) { out.set(c, o); o += c.length }
  return out
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function slugify(text: string, max = 40): string {
  const base = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return (base.slice(0, max).replace(/-$/, '') || 'logos')
}

export function formatBytes(n: number): string {
  if (!n) return '0 MB'
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}
