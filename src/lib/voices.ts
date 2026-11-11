// Logos voices, from engines that run on the phone's processor:
// Phonon by Gradium (one model, English and Spanish, 50 voices),
// PocketTTS by Kyutai (one model per language), and Kokoro 82M by
// hexgrad (the full model, English, 28 voices — Oscar asked for the
// complete model on 2026-11-11: "Kokoro el completo, no el destilado").
import phononVoices from './phonon-voices.json'

export type Lang = 'en' | 'es'
export type Accent = 'US' | 'UK' | 'ES' | 'MX'
export type EngineKind = 'phonon' | 'pocket' | 'kokoro'

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
  /** Kokoro voice id in the hexgrad registry (af_heart, bm_george…) */
  kid?: string
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

// Kokoro's own quality grades ride in the taglines: Oscar is judging
// this engine by ear, and the grades set honest expectations.
const KOKORO_VOICES: Omit<Voice, 'engine'>[] = [
  { id: 'kk_heart', name: 'Heart', lang: 'en', accent: 'US', gender: 'Female', tagline: 'The flagship voice · Grade A', kid: 'af_heart' },
  { id: 'kk_bella', name: 'Bella', lang: 'en', accent: 'US', gender: 'Female', tagline: 'Bright and expressive · Grade A−', kid: 'af_bella' },
  { id: 'kk_nicole', name: 'Nicole', lang: 'en', accent: 'US', gender: 'Female', tagline: 'Made for audiobooks · Grade B−', kid: 'af_nicole' },
  { id: 'kk_emma', name: 'Emma', lang: 'en', accent: 'UK', gender: 'Female', tagline: 'Clear British voice · Grade B−', kid: 'bf_emma' },
  { id: 'kk_aoede', name: 'Aoede', lang: 'en', accent: 'US', gender: 'Female', tagline: 'Soft and clear · Grade C+', kid: 'af_aoede' },
  { id: 'kk_kore', name: 'Kore', lang: 'en', accent: 'US', gender: 'Female', tagline: 'Soft and clear · Grade C+', kid: 'af_kore' },
  { id: 'kk_sarah', name: 'Sarah', lang: 'en', accent: 'US', gender: 'Female', tagline: 'Soft and clear · Grade C+', kid: 'af_sarah' },
  { id: 'kk_fenrir', name: 'Fenrir', lang: 'en', accent: 'US', gender: 'Male', tagline: 'Deep and calm · Grade C+', kid: 'am_fenrir' },
  { id: 'kk_michael', name: 'Michael', lang: 'en', accent: 'US', gender: 'Male', tagline: 'Warm American male · Grade C+', kid: 'am_michael' },
  { id: 'kk_puck', name: 'Puck', lang: 'en', accent: 'US', gender: 'Male', tagline: 'Lively and quick · Grade C+', kid: 'am_puck' },
  { id: 'kk_alloy', name: 'Alloy', lang: 'en', accent: 'US', gender: 'Female', tagline: 'Smooth and even · Grade C', kid: 'af_alloy' },
  { id: 'kk_nova', name: 'Nova', lang: 'en', accent: 'US', gender: 'Female', tagline: 'Fresh and bright · Grade C', kid: 'af_nova' },
  { id: 'kk_isabella', name: 'Isabella', lang: 'en', accent: 'UK', gender: 'Female', tagline: 'Elegant British voice · Grade C', kid: 'bf_isabella' },
  { id: 'kk_fable', name: 'Fable', lang: 'en', accent: 'UK', gender: 'Male', tagline: 'Storyteller British male · Grade C', kid: 'bm_fable' },
  { id: 'kk_george', name: 'George', lang: 'en', accent: 'UK', gender: 'Male', tagline: 'Steady British male · Grade C', kid: 'bm_george' },
  { id: 'kk_sky', name: 'Sky', lang: 'en', accent: 'US', gender: 'Female', tagline: 'Light and airy · Grade C−', kid: 'af_sky' },
  { id: 'kk_jessica', name: 'Jessica', lang: 'en', accent: 'US', gender: 'Female', tagline: 'Casual and friendly · Grade D', kid: 'af_jessica' },
  { id: 'kk_river', name: 'River', lang: 'en', accent: 'US', gender: 'Female', tagline: 'Gentle and slow · Grade D', kid: 'af_river' },
  { id: 'kk_alice', name: 'Alice', lang: 'en', accent: 'UK', gender: 'Female', tagline: 'Soft British voice · Grade D', kid: 'bf_alice' },
  { id: 'kk_lily', name: 'Lily', lang: 'en', accent: 'UK', gender: 'Female', tagline: 'Gentle British voice · Grade D', kid: 'bf_lily' },
  { id: 'kk_echo', name: 'Echo', lang: 'en', accent: 'US', gender: 'Male', tagline: 'Resonant male voice · Grade D', kid: 'am_echo' },
  { id: 'kk_eric', name: 'Eric', lang: 'en', accent: 'US', gender: 'Male', tagline: 'Plainspoken male voice · Grade D', kid: 'am_eric' },
  { id: 'kk_liam', name: 'Liam', lang: 'en', accent: 'US', gender: 'Male', tagline: 'Young male voice · Grade D', kid: 'am_liam' },
  { id: 'kk_onyx', name: 'Onyx', lang: 'en', accent: 'US', gender: 'Male', tagline: 'Low male voice · Grade D', kid: 'am_onyx' },
  { id: 'kk_daniel', name: 'Daniel', lang: 'en', accent: 'UK', gender: 'Male', tagline: 'Clear British male · Grade D', kid: 'bm_daniel' },
  { id: 'kk_lewis', name: 'Lewis', lang: 'en', accent: 'UK', gender: 'Male', tagline: 'Warm British male · Grade D+', kid: 'bm_lewis' },
  { id: 'kk_santa', name: 'Santa', lang: 'en', accent: 'US', gender: 'Male', tagline: 'A playful Santa · Grade D−', kid: 'am_santa' },
  { id: 'kk_adam', name: 'Adam', lang: 'en', accent: 'US', gender: 'Male', tagline: 'Young American male · Grade F+', kid: 'am_adam' },
]

export const VOICES: Voice[] = [
  ...(phononVoices as Omit<Voice, 'engine'>[]).map((v) => ({ ...v, engine: 'phonon' as const })),
  ...POCKET_VOICES.map((v) => ({ ...v, engine: 'pocket' as const })),
  ...KOKORO_VOICES.map((v) => ({ ...v, engine: 'kokoro' as const })),
]

export const ENGINE_LABEL: Record<EngineKind, string> = { phonon: 'Phonon', pocket: 'Pocket', kokoro: 'Kokoro' }
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
