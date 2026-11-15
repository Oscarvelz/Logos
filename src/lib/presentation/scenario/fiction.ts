/**
 * The fiction material of the scenario (PLAN §2) — the ONLY content a
 * Presentation lesson may ever stage. Written for the lessons, by the lessons:
 * a short English text and its Spanish companion (for Auto and the
 * per-paragraph voice switch), a short poem, the text the bubble lesson
 * "copies", and the 3-chapter mini-book «The Lighthouse Letter / La carta del
 * faro» with an internal link and a note. Nothing here is borrowed from a real
 * book or from the user's current Listen text — Fence 0 asserts the stage
 * holds exactly these ids and no others.
 */
import type {
  ScenarioBookContent,
  ScenarioBookMeta,
  ScenarioClip,
  ScenarioMark,
  ScenarioPronEntry,
  ScenarioText,
} from './types.ts'

export const TEXT_EN: ScenarioText = {
  id: 'scenario:text-harbour-morning',
  lang: 'en',
  title: 'The Morning the Harbour Turned Gold',
  text:
    'The ferry came in slowly, the way it always does when the fog is kind. ' +
    'Marta stood at the end of the pier with two cups of coffee and nowhere to hurry. ' +
    'Below her, the water turned the colour of weak tea, then of honey, then of gold.\n\n' +
    'She had read the letter three times before breakfast. ' +
    'Every reading made it shorter and heavier at once. ' +
    'Today, she decided, she would finally answer it.',
}

export const TEXT_ES: ScenarioText = {
  id: 'scenario:text-puerto-dorado',
  lang: 'es',
  title: 'La mañana en que el puerto se volvió dorado',
  text:
    'El ferri entró despacio, como siempre entra cuando la niebla es amable. ' +
    'Marta esperaba al final del muelle con dos cafés y ninguna prisa. ' +
    'Bajo sus pies, el agua se volvió color de té flojo, luego de miel, luego de oro.\n\n' +
    'Había leído la carta tres veces antes del desayuno. ' +
    'Cada lectura la hacía más corta y más pesada a la vez. ' +
    'Hoy, decidió, por fin la contestaría.',
}

export const POEM_EN: ScenarioText = {
  id: 'scenario:poem-low-tide',
  lang: 'en',
  title: 'Low Tide',
  text:
    'The sea steps back and shows its hands,\n' +
    'all shells and ribboned sand.\n' +
    'What the water kept all night\n' +
    'lies blinking in the light.',
}

export const POEM_ES: ScenarioText = {
  id: 'scenario:poem-marea-baja',
  lang: 'es',
  title: 'Marea baja',
  text:
    'El mar se retira y muestra las manos,\n' +
    'todo conchas y arena peinada.\n' +
    'Lo que el agua guardó toda la noche\n' +
    'amanece parpadeando en la luz.',
}

/** The text Q2's lever lesson "copies in another app" and the bubble plays. */
export const CLIP_TEXT: ScenarioText = {
  id: 'scenario:clip-copied-note',
  lang: 'en',
  title: 'What you copied',
  text:
    'Remember: the ferry leaves at six, and Ana brings the keys to the boathouse. ' +
    'If the fog is thick, wait for the second bell.',
}

/** Every readable fiction text, by id. */
export const SCENARIO_TEXTS: readonly ScenarioText[] = [TEXT_EN, TEXT_ES, POEM_EN, POEM_ES, CLIP_TEXT]

/** The mini-book's shelf record (fiction; imported by the P2 script, exactly
 *  as a lesson imports it — it is NOT pre-loaded onto the scenario shelf). */
export const BOOK_META: ScenarioBookMeta = {
  id: 'scenario:book-lighthouse-letter',
  title: 'The Lighthouse Letter',
  titleEs: 'La carta del faro',
  author: 'Elena Marlowe',
  format: 'epub',
  lang: 'en',
  addedAt: 1762900000000,
  pos: { ch: 0, b: 0 },
  progress: 0,
  words: 148,
  temp: true,
}

/** The mini-book's text: 3 chapters, one internal link (chapter 1 → the note
 *  that opens chapter 3), one note read in its place. */
export const BOOK_CONTENT: ScenarioBookContent = {
  id: 'scenario:book-lighthouse-letter',
  chapters: [
    {
      title: 'The Arrival',
      blocks: [
        { k: 'h1', t: 'The Arrival' },
        {
          k: 'p',
          t: 'The boat brought one passenger and one letter, and the island made room for both.',
        },
        {
          k: 'p',
          t: 'Tomas carried the letter up the lighthouse path, reading the address twice at every turn.',
          l: [{ s: 61, e: 68, to: '2:0' }],
        },
        { k: 'p', t: 'At the top, the lamp was already lit, though nobody remembered lighting it.' },
      ],
    },
    {
      title: 'The Storm',
      blocks: [
        { k: 'h1', t: 'The Storm' },
        { k: 'p', t: 'That night the wind took the shutters one by one and returned none of them.' },
        { k: 'p', t: 'Tomas read the letter aloud to the lamp, because a lamp is a patient listener.' },
        { k: 'p', t: 'By the last line, the storm had spent itself listening too.' },
      ],
    },
    {
      title: 'The Note',
      blocks: [
        {
          k: 'q',
          t: 'Note, in the keeper’s hand: whoever lights the lamp for others must first learn to sit in the dark with them.',
        },
        { k: 'p', t: 'In the morning, Tomas wrote his answer in letters an inch tall, so the sea could read it too.' },
        { k: 'p', t: 'And the letter, at last, was on its way home.' },
      ],
    },
  ],
}

/** The scenario Library's starting clips (fiction only). */
export const FICTION_CLIPS: readonly ScenarioClip[] = [
  {
    id: 'scenario:clip-welcome',
    title: 'Welcome to the harbour',
    text: TEXT_EN.text,
    voice: 'scenario-voice-en',
    lang: 'en',
    createdAt: 1762900100000,
    duration: 42,
    format: 'mp3',
    size: 204800,
    kind: 'audio',
    pos: 0,
  },
  {
    id: 'scenario:clip-poem-audio',
    title: 'Low Tide, read aloud',
    text: POEM_EN.text,
    voice: 'scenario-voice-en',
    lang: 'en',
    createdAt: 1762900200000,
    duration: 18,
    format: 'mp3',
    size: 81920,
    kind: 'audio',
  },
  {
    id: 'scenario:clip-listen-later',
    title: 'La carta del faro, para después',
    text: TEXT_ES.text,
    voice: '',
    lang: 'es',
    createdAt: 1762900300000,
    duration: 45,
    format: '',
    size: 0,
    kind: 'text',
  },
]

/** One loose mark, living in the English text (fingerprint shape mirrors
 *  lib/marks.ts textKey: length + first 48 + last 48). */
export const FICTION_MARK: ScenarioMark = {
  id: 'scenario:mark-first',
  at: 1762900400000,
  title: TEXT_EN.title,
  sentence: 'Below her, the water turned the colour of weak tea, then of honey, then of gold.',
  key: `${TEXT_EN.text.length}:${TEXT_EN.text.slice(0, 48)}:${TEXT_EN.text.slice(-48)}`,
  idx: 2,
}

/** The scenario dictionary's starting entries (fiction only). */
export const FICTION_PRONOUNCE: readonly ScenarioPronEntry[] = [
  { from: 'Saoirse', to: 'Seer-sha' },
  { from: 'Yucatán', to: 'Yuca-tán' },
]

/** Every id the fiction brings with it. Fence 0's stage-is-fiction assertion
 *  (§1.4) is an id list: the scenario backends may hold these ids, plus ids
 *  the operation scripts themselves create from this material — nothing else. */
export const FICTION_IDS: readonly string[] = [
  ...SCENARIO_TEXTS.map((t) => t.id),
  BOOK_META.id,
  ...FICTION_CLIPS.map((c) => c.id),
  FICTION_MARK.id,
]

/** Distinctive slices of the fiction texts, for the leak scan: if any of
 *  these strings appears in a payload, scenario content is inside it. */
export const FICTION_FINGERPRINTS: readonly string[] = [
  'The ferry came in slowly, the way it always does',
  'El ferri entró despacio, como siempre entra',
  'The sea steps back and shows its hands',
  'El mar se retira y muestra las manos',
  'the ferry leaves at six, and Ana brings the keys',
  'The boat brought one passenger and one letter',
  'whoever lights the lamp for others must first learn',
  'La carta del faro, para después',
]
