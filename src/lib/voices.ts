// Logos voices: PocketTTS by Kyutai, built for phone processors. English voices
// share one model, the Spanish voices another.

export type Lang = 'en' | 'es'
export type Accent = 'US' | 'UK' | 'ES'

export type Voice = {
  id: string
  name: string
  lang: Lang
  accent: Accent
  gender: 'Female' | 'Male'
  tagline: string
}

export const VOICES: Voice[] = [
  { id: 'pk_alba', name: 'Alba', lang: 'en', accent: 'US', gender: 'Female', tagline: 'Natural, warm narrator' },
  { id: 'pk_anna', name: 'Anna', lang: 'en', accent: 'US', gender: 'Female', tagline: 'Calm and clear' },
  { id: 'pk_michael', name: 'Michael', lang: 'en', accent: 'US', gender: 'Male', tagline: 'Relaxed male voice' },
  { id: 'pk_liat', name: 'Liat', lang: 'en', accent: 'US', gender: 'Female', tagline: 'Bright and friendly' },
  { id: 'pk_omer', name: 'Omer', lang: 'en', accent: 'US', gender: 'Male', tagline: 'Low, steady male voice' },
  { id: 'pk_lola', name: 'Lola', lang: 'es', accent: 'ES', gender: 'Female', tagline: 'Voz natural y cálida' },
  { id: 'pk_javert', name: 'Javert', lang: 'es', accent: 'ES', gender: 'Male', tagline: 'Voz masculina serena' },
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
