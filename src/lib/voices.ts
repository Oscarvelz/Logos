// Curated Kokoro-82M v1.0 voices: the strongest English (US/UK) voices plus all
// three Spanish voices. Grades follow the upstream Kokoro voice notes.

export type Lang = 'en' | 'es'
export type Accent = 'US' | 'UK' | 'ES'

export type Voice = {
  id: string
  name: string
  lang: Lang
  accent: Accent
  gender: 'Female' | 'Male'
  grade: string
  tagline: string
  /** espeak voice used by the direct (non-English) path */
  phonemeLang: 'en-us' | 'en' | 'es'
}

export const VOICES: Voice[] = [
  { id: 'af_heart', name: 'Heart', lang: 'en', accent: 'US', gender: 'Female', grade: 'A', tagline: 'Warm, expressive — the flagship voice', phonemeLang: 'en-us' },
  { id: 'af_bella', name: 'Bella', lang: 'en', accent: 'US', gender: 'Female', grade: 'A−', tagline: 'Bright, lively narrator', phonemeLang: 'en-us' },
  { id: 'af_nicole', name: 'Nicole', lang: 'en', accent: 'US', gender: 'Female', grade: 'B−', tagline: 'Soft, close, almost whispered', phonemeLang: 'en-us' },
  { id: 'af_kore', name: 'Kore', lang: 'en', accent: 'US', gender: 'Female', grade: 'C+', tagline: 'Clear and composed', phonemeLang: 'en-us' },
  { id: 'af_sarah', name: 'Sarah', lang: 'en', accent: 'US', gender: 'Female', grade: 'C+', tagline: 'Friendly, conversational', phonemeLang: 'en-us' },
  { id: 'af_aoede', name: 'Aoede', lang: 'en', accent: 'US', gender: 'Female', grade: 'C+', tagline: 'Gentle storyteller', phonemeLang: 'en-us' },
  { id: 'am_michael', name: 'Michael', lang: 'en', accent: 'US', gender: 'Male', grade: 'C+', tagline: 'Steady, trustworthy baritone', phonemeLang: 'en-us' },
  { id: 'am_fenrir', name: 'Fenrir', lang: 'en', accent: 'US', gender: 'Male', grade: 'C+', tagline: 'Deep and grounded', phonemeLang: 'en-us' },
  { id: 'am_puck', name: 'Puck', lang: 'en', accent: 'US', gender: 'Male', grade: 'C+', tagline: 'Energetic, youthful', phonemeLang: 'en-us' },
  { id: 'bf_emma', name: 'Emma', lang: 'en', accent: 'UK', gender: 'Female', grade: 'B−', tagline: 'Polished British narrator', phonemeLang: 'en' },
  { id: 'bf_isabella', name: 'Isabella', lang: 'en', accent: 'UK', gender: 'Female', grade: 'C', tagline: 'Elegant, measured', phonemeLang: 'en' },
  { id: 'bm_george', name: 'George', lang: 'en', accent: 'UK', gender: 'Male', grade: 'C', tagline: 'Classic British gentleman', phonemeLang: 'en' },
  { id: 'bm_fable', name: 'Fable', lang: 'en', accent: 'UK', gender: 'Male', grade: 'C', tagline: 'Storybook warmth', phonemeLang: 'en' },
  { id: 'ef_dora', name: 'Dora', lang: 'es', accent: 'ES', gender: 'Female', grade: 'C', tagline: 'Voz femenina clara y cercana', phonemeLang: 'es' },
  { id: 'em_alex', name: 'Alex', lang: 'es', accent: 'ES', gender: 'Male', grade: 'C', tagline: 'Voz masculina natural', phonemeLang: 'es' },
  { id: 'em_santa', name: 'Santa', lang: 'es', accent: 'ES', gender: 'Male', grade: 'C', tagline: 'Grave y cálida', phonemeLang: 'es' },
]

export const VOICE_BY_ID = new Map(VOICES.map((v) => [v.id, v]))

export function voiceById(id: string | undefined): Voice | undefined {
  return id ? VOICE_BY_ID.get(id) : undefined
}

export const LANG_LABEL: Record<Lang, string> = { en: 'English', es: 'Español' }

export const PREVIEW_TEXT: Record<Lang, string> = {
  en: 'Words carry meaning. Here is how I sound when I read to you.',
  es: 'Las palabras dan forma al pensamiento. Así sueno cuando leo para ti.',
}

export function isEnglishPath(v: Voice): boolean {
  return v.phonemeLang === 'en-us' || v.phonemeLang === 'en'
}
