// Word timing for the reading highlight.
// The voices don't report when each word is spoken, so Logos reads it from the audio itself:
// the sentence's loudness envelope (60 frames a second) shows where speech starts and ends and
// where the voice takes a breath. Breaths are pinned to the punctuation that caused them, and
// the words between two pins share that stretch by how long they take to say (syllables, not
// letters). Small dips in loudness then nudge each boundary onto the real gap between words.

const cache = new WeakMap<Float32Array, Map<string, number[]>>()

/** Rough speaking length of a word: syllables dominate, consonant clusters add a little. */
function weight(w: string): number {
  const t = w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  if (!t) return 0.3
  if (/^\d+$/.test(t)) return 1.2 * t.length + 0.6   // digits are read out as words
  const vowels = t.match(/[aeiouyáéíóúüàèìòùâêîôû]+/g)?.length ?? 1
  const cons = t.replace(/[aeiouyáéíóúüàèìòùâêîôû]/g, '').length
  return 0.35 + vowels * 1 + cons * 0.18
}

const strongAfter = (w: string) => /[.!?…]["”»')\]]*$/.test(w) ? 3 : /[,;:—–]["”»')\]]*$/.test(w) || /[-–—]$/.test(w) ? 2 : 0

/** Start time (seconds) of each word in a sentence, from its loudness envelope. */
export function alignWords(env: Float32Array, fps: number, words: string[]): number[] {
  const key = words.join(' ')
  let m = cache.get(env)
  const hit = m?.get(key)
  if (hit) return hit
  const n = words.length
  const out = new Array<number>(n).fill(0)
  if (!n || env.length < 4) return out

  // Smooth (3 frames) to ignore single-frame flicker.
  const e = new Float32Array(env.length)
  for (let i = 0; i < env.length; i++) e[i] = ((env[i - 1] ?? env[i]) + env[i] * 2 + (env[i + 1] ?? env[i])) / 4
  const sorted = [...e].sort((a, b) => a - b)
  const loud = sorted[Math.floor(sorted.length * 0.85)] || 1
  const th = Math.max(0.03, loud * 0.1)       // below this is silence
  const quiet = th * 1.6                       // below this counts as a gap/dip

  let s0 = 0; while (s0 < e.length && e[s0] < th) s0++
  let s1 = e.length - 1; while (s1 > s0 && e[s1] < th) s1--
  if (s1 - s0 < 3) { for (let i = 0; i < n; i++) out[i] = (s0 + (i / n) * (s1 - s0)) / fps; return out }

  // Breaths inside the speech: runs of quiet frames, at least ~80 ms long.
  const pauses: { a: number; b: number }[] = []
  for (let i = s0; i <= s1; i++) {
    if (e[i] >= quiet) continue
    let j = i; while (j <= s1 && e[j] < quiet) j++
    if (j - i >= 5) pauses.push({ a: i, b: j })
    i = j
  }

  // Expected boundary positions (in "speech time") from the word weights.
  const wt = words.map(weight)
  const total = wt.reduce((a, b) => a + b, 0)
  const pauseLen = pauses.reduce((a, p) => a + (p.b - p.a), 0)
  const speech = Math.max(1, s1 - s0 - pauseLen)
  // Map a speech-time position to a frame, skipping the pauses we already found.
  const toFrame = (pos: number) => {
    let f = s0, left = pos
    for (const p of pauses) {
      if (f + left <= p.a) break
      left -= p.a - f; f = p.b
    }
    return f + left
  }
  const cum: number[] = [0]
  for (let i = 0; i < n; i++) cum.push(cum[i] + wt[i])
  const expected = cum.map((c) => toFrame((c / total) * speech))   // expected[i] = start of word i

  // Pin each pause to the punctuation boundary nearest to it (in order); unmatched pauses
  // go to any boundary nearby. A pin means: word k starts when the pause ends.
  const pins = new Map<number, number>()   // word index -> start frame
  let from = 1
  for (const p of pauses) {
    let best = -1, bestD = Infinity
    for (let k = from; k < n; k++) {
      const strength = strongAfter(words[k - 1])
      const d = Math.abs(expected[k] - (p.a + p.b) / 2) / (strength ? 1 + strength : 0.6)
      if (d < bestD) { bestD = d; best = k }
    }
    if (best > 0 && Math.abs(expected[best] - (p.a + p.b) / 2) < Math.max(18, speech * 0.3)) {
      pins.set(best, p.b - 1); from = best + 1
    }
  }

  // Fill words between pins in proportion to their weight.
  const anchors = [{ k: 0, f: s0 }, ...[...pins.entries()].sort((a, b) => a[0] - b[0]).map(([k, f]) => ({ k, f })), { k: n, f: s1 + 1 }]
  for (let a = 0; a + 1 < anchors.length; a++) {
    const A = anchors[a], B = anchors[a + 1]
    // the stretch ends where the next breath begins (if this run ends at a pause)
    const pauseBefore = pauses.find((p) => p.b - 1 === B.f)
    const end = pauseBefore ? pauseBefore.a : B.f
    const span = Math.max(1, end - A.f)
    const sub = wt.slice(A.k, B.k)
    const subTotal = sub.reduce((x, y) => x + y, 0) || 1
    let acc = 0
    for (let k = A.k; k < B.k; k++) {
      let f = A.f + (acc / subTotal) * span
      // Nudge onto the deepest dip within ±5 frames (the real gap between two words).
      if (k > A.k) {
        let bf = Math.round(f), bv = e[bf] ?? 1
        for (let d = -5; d <= 5; d++) { const g = Math.round(f) + d; if (g > A.f && g < end && e[g] < bv * 0.8) { bv = e[g]; bf = g } }
        if (bv < quiet * 1.4) f = bf + 1
      }
      out[k] = f / fps
      acc += wt[k]
    }
  }
  for (let i = 1; i < n; i++) if (out[i] < out[i - 1] + 0.04) out[i] = out[i - 1] + 0.04   // keep order
  if (!m) { m = new Map(); cache.set(env, m) }
  m.set(key, out)
  return out
}

/** Index of the word being spoken at time t (seconds into the sentence). */
export function wordAtTime(starts: number[], t: number): number {
  let lo = 0
  for (let i = 0; i < starts.length; i++) { if (starts[i] <= t) lo = i; else break }
  return lo
}
