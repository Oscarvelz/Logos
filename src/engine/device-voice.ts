// Built-in browser voices (speechSynthesis): an instant bridge while the
// neural voice downloads on first use.
import type { Lang } from '../lib/voices.ts'

export function deviceSpeechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
}

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null
function getVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!deviceSpeechAvailable()) return Promise.resolve([])
  const now = speechSynthesis.getVoices()
  if (now.length) return Promise.resolve(now)
  voicesReady ??= new Promise((resolve) => {
    const done = () => resolve(speechSynthesis.getVoices())
    speechSynthesis.addEventListener('voiceschanged', done, { once: true })
    setTimeout(done, 1200)
  })
  return voicesReady
}

function rank(v: SpeechSynthesisVoice, lang: Lang): number {
  let score = 0
  const l = v.lang.toLowerCase().replace('_', '-')
  if (!l.startsWith(lang)) return -1
  if (lang === 'en' && l === 'en-us') score += 3
  if (lang === 'es' && (l === 'es-us' || l === 'es-mx' || l === 'es-419')) score += 3
  if (lang === 'es' && l === 'es-es') score += 2
  if (/google|natural|neural|premium|enhanced/i.test(v.name)) score += 4
  if (v.localService) score += 1
  return score
}

export async function pickDeviceVoice(lang: Lang): Promise<SpeechSynthesisVoice | null> {
  const voices = await getVoices()
  let best: SpeechSynthesisVoice | null = null
  let bestScore = -1
  for (const v of voices) {
    const r = rank(v, lang)
    if (r > bestScore) { best = v; bestScore = r }
  }
  return best
}

let current: SpeechSynthesisUtterance | null = null

/** Speak one sentence; resolves true when it finished, false on failure/cancel. */
export async function speakDevice(text: string, lang: Lang, rate: number): Promise<boolean> {
  if (!deviceSpeechAvailable()) return false
  const voice = await pickDeviceVoice(lang)
  return new Promise<boolean>((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = voice?.lang ?? (lang === 'es' ? 'es-US' : 'en-US')
    if (voice) u.voice = voice
    u.rate = Math.max(0.5, Math.min(2, rate))
    let settled = false
    const done = (ok: boolean) => { if (!settled) { settled = true; resolve(ok) } }
    u.onend = () => done(current === u)
    u.onerror = () => done(false)
    current = u
    speechSynthesis.cancel()
    speechSynthesis.speak(u)
    // Some engines never fire onend for very short strings; guard with a generous timeout.
    setTimeout(() => done(current === u && !speechSynthesis.speaking), Math.max(4000, text.length * 160 / u.rate))
  })
}

export function cancelDevice() {
  current = null
  if (deviceSpeechAvailable()) speechSynthesis.cancel()
}
