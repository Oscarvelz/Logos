// Logos voices, from engines that run on the phone's processor:
// Phonon by Gradium (one model, English and Spanish, 50 voices) and
// PocketTTS by Kyutai (one model per language).
import phononVoices from './phonon-voices.json'

export type Lang = 'en' | 'es'
export type Accent = 'US' | 'UK' | 'ES' | 'MX'
export type EngineKind = 'phonon' | 'pocket'

export type Voice = {
  id: string
  name: string
  lang: Lang
  accent: Accent
  gender: 'Female' | 'Male'
  tagline: string
  engine: EngineKind
  /** Phonon voice file in gradium/phonon-voices */
  file?: string
}

const POCKET_VOICES: Omit<Voice, 'engine'>[] = [
  { id: 'pk_alba', name: 'Alba', lang: 'en', accent: 'US', gender: 'Female', tagline: 'Natural, warm narrator' },
  { id: 'pk_anna', name: 'Anna', lang: 'en', accent: 'US', gender: 'Female', tagline: 'Calm and clear' },
  { id: 'pk_michael', name: 'Michael', lang: 'en', accent: 'US', gender: 'Male', tagline: 'Relaxed male voice' },
  { id: 'pk_liat', name: 'Liat', lang: 'en', accent: 'US', gender: 'Female', tagline: 'Bright and friendly' },
  { id: 'pk_omer', name: 'Omer', lang: 'en', accent: 'US', gender: 'Male', tagline: 'Low, steady male voice' },
  { id: 'pk_lola', name: 'Lola', lang: 'es', accent: 'ES', gender: 'Female', tagline: 'Voz natural y cálida' },
  { id: 'pk_javert', name: 'Javert', lang: 'es', accent: 'ES', gender: 'Male', tagline: 'Voz masculina serena' },
]

export const VOICES: Voice[] = [
  ...(phononVoices as Omit<Voice, 'engine'>[]).map((v) => ({ ...v, engine: 'phonon' as const })),
  ...POCKET_VOICES.map((v) => ({ ...v, engine: 'pocket' as const })),
]

export const ENGINE_LABEL: Record<EngineKind, string> = { phonon: 'Phonon', pocket: 'Pocket' }
export const ACCENT_LABEL: Record<Accent, string> = { US: 'American', UK: 'British', ES: 'España', MX: 'México' }

export const VOICE_BY_ID = new Map(VOICES.map((v) => [v.id, v]))

export function voiceById(id: string | undefined): Voice | undefined {
  return id ? VOICE_BY_ID.get(id) : undefined
}

export const LANG_LABEL: Record<Lang, string> = { en: 'English', es: 'Español' }

export const PREVIEW_TEXT: Record<Lang, string> = {
  en: 'Words carry meaning. Here is how I sound when I read to you.',
  es: 'Las palabras dan forma al pensamiento. Así sueno cuando leo para ti.',
}

/** Favorites in the order they were starred. */
export function favoriteVoices(favorites: string[]): Voice[] {
  return favorites.map((id) => VOICE_BY_ID.get(id)).filter((v): v is Voice => Boolean(v))
}
