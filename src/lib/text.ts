// Sentence segmentation tuned for streaming TTS (English + Spanish), and a
// lightweight English/Spanish language detector.
import type { Lang } from './voices.ts'

export type Segment = {
  index: number
  text: string
  /** character offsets into the source text */
  start: number
  end: number
  /** true when this segment ends a paragraph (adds a longer pause) */
  paraEnd: boolean
  lang: Lang
}

const ABBREV = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'etc', 'e.g', 'i.e', 'inc', 'ltd', 'co', 'no', 'vol', 'fig', 'approx', 'dept', 'est', 'mt', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
  'sra', 'srta', 'dra', 'ud', 'uds', 'pág', 'pag', 'núm', 'num', 'av', 'avda', 'lic', 'ing', 'arq', 'cap', 'art', 'aprox', 'p.ej', 'ej', 'tel',
])

const MAX_CHARS = 220
// Chunk ramp: the first chunks are short so audio starts fast and the engine
// can build a buffer before the longer chunks arrive (no stall at sentence 2).
const RAMP = [80, 120, 160, 200]

/** Split text into speakable segments with offsets. */
export function segmentText(source: string, langMode: Lang | 'auto' = 'auto'): Segment[] {
  const out: (Omit<Segment, 'index' | 'lang'> & { paraLang: Lang })[] = []
  const docLang: Lang = langMode === 'auto' ? detectLang(source).lang : langMode
  const paraRe = /[^\n]+(?:\n(?!\s*\n)[^\n]*)*/g
  let m: RegExpExecArray | null
  while ((m = paraRe.exec(source))) {
    const para = m[0]
    const base = m.index
    if (!para.trim()) continue
    const pd = detectLang(para)
    const paraLang: Lang = langMode !== 'auto' ? langMode : pd.confidence >= 0.25 ? pd.lang : docLang
    const sentences = splitSentences(para)
    sentences.forEach((s, i) => {
      for (const piece of capLength(para, s, RAMP[out.length] ?? MAX_CHARS)) {
        out.push({ text: para.slice(piece.start, piece.end).replace(/\s+/g, ' ').trim(), start: base + piece.start, end: base + piece.end, paraEnd: false, paraLang })
      }
      if (i === sentences.length - 1 && out.length) out[out.length - 1].paraEnd = true
    })
  }
  return out
    .filter((s) => /[\p{L}\p{N}]/u.test(s.text))
    .map(({ paraLang, ...s }, index) => {
      let lang: Lang = paraLang
      if (langMode === 'auto' && s.text.length > 40) {
        const d = detectLang(s.text)
        if (d.confidence >= 0.7) lang = d.lang
      }
      return { ...s, index, lang }
    })
}

type Span = { start: number; end: number }

function splitSentences(p: string): Span[] {
  const spans: Span[] = []
  let start = 0
  const re = /([.!?…。]+)(["'”’»)\]*_]*)(\s+|$)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(p))) {
    const endPunct = m.index + m[1].length + m[2].length
    const before = p.slice(start, m.index)
    const lastWord = (before.match(/([\p{L}.]+)$/u)?.[1] ?? '').toLowerCase()
    // Skip abbreviations, single initials ("J. R. R."), and decimals.
    if (m[1] === '.' && (ABBREV.has(lastWord) || /^\p{L}$/u.test(lastWord))) continue
    if (m[1] === '.' && /\d$/.test(before) && /^\d/.test(p.slice(m.index + 1))) continue
    // A bare list number ("2.") belongs to the sentence that follows it.
    if (/^\s*\(?[\dIVXivx]{1,3}[.)]?$/.test(p.slice(start, endPunct))) continue
    // A following lowercase letter usually means it was not a sentence end.
    const next = p.slice(m.index + m[0].length)
    if (!/[!?]/.test(m[1]) && /^[a-zà-ÿ]/.test(next)) continue
    spans.push({ start, end: endPunct })
    start = m.index + m[0].length
  }
  if (start < p.length && p.slice(start).trim()) spans.push({ start, end: p.length })
  return spans.map(trimSpan(p)).filter((s) => s.end > s.start)
}

function trimSpan(p: string) {
  return (s: Span): Span => {
    let { start, end } = s
    while (start < end && /\s/.test(p[start])) start++
    while (end > start && /\s/.test(p[end - 1])) end--
    return { start, end }
  }
}

/** Break an over-long sentence at clause boundaries, then at spaces. */
function capLength(p: string, s: Span, max: number): Span[] {
  if (s.end - s.start <= max) return [s]
  const pieces: Span[] = []
  let a = s.start
  while (s.end - a > max) {
    const window = p.slice(a, a + max)
    let cut = Math.max(window.lastIndexOf(', '), window.lastIndexOf('; '), window.lastIndexOf(': '), window.lastIndexOf(' — '), window.lastIndexOf(' – '))
    if (cut < max * 0.35) cut = window.lastIndexOf(' ')
    if (cut <= 0) cut = max - 1
    const b = a + cut + 1
    pieces.push({ start: a, end: b })
    a = b
    while (a < s.end && /\s/.test(p[a])) a++
  }
  if (a < s.end) pieces.push({ start: a, end: s.end })
  return pieces.map(trimSpan(p)).filter((x) => x.end > x.start)
}

// ── Language detection ──────────────────────────────────────────

const ES_WORDS = new Set('el la los las de del que y en un una es por con no se su para al lo como más pero sus le ya o fue este ha sí porque esta son entre cuando muy sin sobre también me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mí antes algunos qué unos yo otro otras otra él tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros mi mis tú te ti tu tus ellas nosotras vosotros os mío mía tuyo suyo estoy estás está estamos están soy eres somos tengo tiene hola gracias bien día vida tiempo hacer puede'.split(' '))
const EN_WORDS = new Set('the of and to a in is it you that he was for on are with as i his they be at one have this from or had by not word but what some we can out other were all there when up use your how said an each she which do their time if will way about many then them write would like so these her long make thing see him two has look more day could go come did my sound no most people over know water than call first who may down side been now find any new work part take get place made live where after back little only round man year came show every good me give our under name very through just form much great think say help low line before turn cause same mean differ move right boy old too does tell set three want air well also play small end put home read hand port large spell add even land here must big high such follow act why ask men change went light kind off need house picture try us again animal point mother world near build self earth father'.split(' '))

export function detectLang(text: string): { lang: Lang; confidence: number } {
  const lower = text.toLowerCase()
  let es = 0
  let en = 0
  if (/[ñ¿¡]/.test(lower)) es += 4
  es += (lower.match(/[áéíóú]/g)?.length ?? 0) * 0.8
  const words = lower.match(/[\p{L}']+/gu) ?? []
  for (const w of words) {
    if (ES_WORDS.has(w)) es += 1
    if (EN_WORDS.has(w)) en += 1
    if (/'(s|t|re|ve|ll|d|m)$/.test(w)) en += 1
    if (/(ción|ciones|mente|idad|amos|aron|ando|iendo)$/.test(w)) es += 0.8
    if (/(tion|ing|ness|ly|ed)$/.test(w) && w.length > 4) en += 0.6
  }
  // Words common to both lists ("no", "me", "a") cancel out.
  const total = es + en
  if (total === 0) return { lang: 'en', confidence: 0 }
  const lang: Lang = es > en ? 'es' : 'en'
  return { lang, confidence: Math.abs(es - en) / total }
}

export function wordCount(text: string): number {
  return text.match(/[\p{L}\p{N}']+/gu)?.length ?? 0
}

/** Rough listening time at ~165 wpm (EN) / ~175 wpm (ES), divided by speed. */
export function estimateSeconds(text: string, speed = 1): number {
  return (wordCount(text) / 168) * 60 / speed
}

export function formatDuration(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`
}

/** Text as it should be spoken: drops markdown and list symbols the voice would read out. */
export function speakable(text: string): string {
  return text
    .replace(/\*\*|__|~~|`+/g, '')
    .replace(/(^|\s)[*_](?=\S)|(?<=\S)[*_](?=\s|$|[.,;:!?])/g, '$1')
    .replace(/(^|\s)#{1,6}\s+/g, '$1')
    .replace(/(^|\s)>\s+/g, '$1')
    .replace(/(^|\s)[•▪◦]\s+/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, 'link')
    .replace(/\s+/g, ' ')
    .trim()
}
