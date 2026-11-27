// Logos voices, from engines that run on the phone's processor:
// Phonon by Gradium (one model, English and Spanish, 50 voices) and
// PocketTTS by Kyutai (one model per language). A third engine,
// Kokoro 82M, lived here from 1.4.143 to 1.4.145 and was removed
// whole in 1.4.146 by Oscar's verdict: too heavy for the app — its
// load closed the app on his phone at fp16 and at q8 alike.
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

/** The ONE favorites truth every surface reads (M-44): the stored ids run
 *  through the catalogue existence gate above, so a picker star, the
 *  Voices favorites list and the Create favorite chips can never disagree
 *  about a ghost id — it is a favorite nowhere, because it exists nowhere. */
export function favoriteIds(favorites: string[]): Set<string> {
  return new Set(favoriteVoices(favorites).map((v) => v.id))
}

/** The resolved default for a language — the same truth the engine uses
 *  (M-43): the Listen override wins when it speaks the language, or when
 *  the language mode is manual (mirrors voiceFor in player/listen.ts);
 *  otherwise the per-language default. Default flags must read THIS, not
 *  the raw defaultVoice map, or the flag can sit on a voice the override
 *  has superseded while the voice that will actually read wears none. */
export function resolvedVoiceId(
  s: { defaultVoice: Record<Lang, string>; voiceOverride: string | null; langMode: Lang | 'auto' },
  lang: Lang,
): string {
  const override = voiceById(s.voiceOverride ?? undefined)
  if (override && (override.lang === lang || s.langMode !== 'auto')) return override.id
  return s.defaultVoice[lang]
}

/** The Listen override standing over a language, when one is
 *  (R2-T7-4): the override governs a language when it speaks that
 *  language, or when the language mode is manual — the same condition
 *  resolvedVoiceId applies. The resolution says WHICH voice will
 *  read; this says WHY (a standing Listen pick), so a surface can
 *  name the pick instead of letting its own words fight it. */
export function governingOverride(
  s: { voiceOverride: string | null; langMode: Lang | 'auto' },
  lang: Lang,
): Voice | undefined {
  const override = voiceById(s.voiceOverride ?? undefined)
  return override && (override.lang === lang || s.langMode !== 'auto') ? override : undefined
}

/** What a Voices-page card may claim (R2-T7-4). M-43 seated the
 *  "Default" flag on the RESOLVED voice — so while a Listen override
 *  stands, the override's card wears "Default · English" (the wrong
 *  office: that voice is the pick, not the default), the stored
 *  default's card offers "Make default" for what it already is, and
 *  tapping it elsewhere toasts "…is now your English default" while
 *  the resolution does not move: the flag and the toast contradicted
 *  each other. The claims are separated now, one per office: the
 *  STORED default wears 'default'; the governing override wears
 *  'reading' on its own card (the picker's own word for the active
 *  voice — "Now reading"); "Make default" is offered only on a card
 *  that is not the stored default; and when an override governs the
 *  language, the toast must name it (toastOverride) instead of
 *  claiming a crown it cannot hand over. resolvedVoiceId above is
 *  untouched — what actually reads never changed; the page's words
 *  about it are what were lying.
 *
 *  1.4.257 — OSCAR'S CONSISTENCY RULING supersedes the hedge:
 *  Voices is the ONLY center for changing the reader's voice, so
 *  predetermining there must take the stage. Under the old rule
 *  the stored default's card offered no deed at all while a
 *  Listen pick governed its language — Noa wore "Default ·
 *  Español", Marcos wore "Now reading", and no button in Voices
 *  could make Noa read («No puedo elegir en voces la que quiero
 *  predeterminar»). Now "Make default" is offered on every card
 *  whose voice is not the resolved reader for its language —
 *  the stored-but-outranked default included — and its tap
 *  (VoicesPage) sets the stored default AND releases the
 *  governing pick, so the toast's plain words are the whole
 *  truth again. toastOverride survives in the shape for any
 *  surface that still wants to name the pick; the Voices toast
 *  no longer needs it.
 *
 *  1.4.261 — THE READING VOICE'S OWN CARD GAINS THE DEED
 *  (Oscar, 2026-11-27: «Continúa sin dejarme seleccionar la
 *  voz que quiero»). The 257 rule withheld the button from
 *  the resolved reader's card — but a reader who reads by a
 *  Listen pick is NOT the stored default, so the voice Oscar
 *  actually wanted to predetermine (the pick itself, Marcos)
 *  offered no deed at all: there was no way in Voices to make
 *  the standing pick permanent. The offer is now judged by
 *  the two offices the one deed serves: a card offers "Make
 *  default" when its voice is not the stored default (the
 *  deed crowns it — the pick's card included, converting the
 *  pick into the predetermination) OR when a pick governs
 *  its language (the deed releases it — the outranked
 *  default's card, the 257 case). The button is absent only
 *  where the voice already IS the predetermined one and
 *  nothing stands over her. */
export function voiceCardTruth(
  s: { defaultVoice: Record<Lang, string>; voiceOverride: string | null; langMode: Lang | 'auto' },
  v: Voice,
): { flag: 'default' | 'reading' | null; makeDefault: boolean; toastOverride: Voice | null } {
  const stored = s.defaultVoice[v.lang] === v.id
  const override = governingOverride(s, v.lang)
  return {
    flag: stored ? 'default' : override?.id === v.id ? 'reading' : null,
    makeDefault: !stored || override != null,
    toastOverride: override && override.id !== v.id ? override : null,
  }
}

/** Create/Export voice resolution (T7-11): an explicitly picked voice
 *  is the render's voice for EVERY segment. The old exporter rule —
 *  the pick applies only where its language matches the segment (or
 *  the mode is manual) — silently handed every other-language segment
 *  to the per-language default in Auto mode, while the Create UI
 *  presented the pick as the render's voice. Only the Auto pick
 *  (null) resolves per segment, to the language's default. A picked
 *  id that no longer exists falls back to the default, like every
 *  other ghost-gated surface. */
export function exportVoiceId(
  picked: string | null | undefined,
  lang: Lang,
  s: { defaultVoice: Record<Lang, string> },
): string {
  const v = voiceById(picked ?? undefined)
  if (v) return v.id
  return s.defaultVoice[lang]
}

/** The picker-visibility truth (T7-12): the voice that will actually
 *  read must never be invisible in the picker. The picker's groups
 *  are language-filtered, so an active voice of the other language
 *  (an override kept under a manual language mode) can fall out of
 *  every group — no row, no check, "nothing chosen" while a specific
 *  voice is live. This returns that orphan so the picker can seat it
 *  in its own Current group; undefined when it is already grouped. */
export function pickerActiveVoice(activeId: string | null | undefined, groupedIds: Set<string>): Voice | undefined {
  const v = voiceById(activeId ?? undefined)
  return v && !groupedIds.has(v.id) ? v : undefined
}

/** Plain voice search over the catalogue (name, accent, tagline). */
export function searchVoices(query: string): Voice[] {
  const q = query.trim().toLowerCase()
  if (!q) return VOICES
  return VOICES.filter((v) => v.name.toLowerCase().includes(q) || v.accent.toLowerCase().includes(q) || v.tagline.toLowerCase().includes(q))
}

/** Debounce + staleness gate for voice search (M-47): keystrokes schedule
 *  one run after a quiet pause, and every schedule mints a token — a slow
 *  earlier result whose token is no longer current is dropped, never
 *  applied over a newer one. The picker wiring lives in chrome.tsx; this
 *  gate is the seam it (and VoicesPage) share. */
export class VoiceSearchGate {
  private token = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  schedule(query: string, delayMs: number, run: (results: Voice[]) => void): number {
    const mine = ++this.token
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => { if (mine === this.token) run(searchVoices(query)) }, delayMs)
    return mine
  }
  isCurrent(token: number): boolean { return token === this.token }
  cancel() {
    this.token++
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }
}
