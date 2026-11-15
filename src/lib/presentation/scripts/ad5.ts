/**
 * AD5 «Dos idiomas, una escucha / Two Languages, One Listening» — the
 * Advanced module for how Logos hears two languages at once.
 *
 * Owns (PLAN §2.5): A-31 · D-1, D-2, D-3, D-4, D-18, D-19, D-26, D-27,
 * D-28, D-29, D-30 · E-33. Title and capability are the catalogue's own
 * words, verbatim (PLAN §3 owns the wording; registration refuses drift).
 *
 * Truths this script may teach, and no more:
 * - Automatic = one default voice per language (D-27): a voice the user
 *   picked wins only for its own language; otherwise the language's
 *   default speaks. Voices are resolved per segment when the text loads
 *   (D-28) — cast before the first sound, never improvised.
 * - Mixed texts switch by paragraph, PLUS the per-sentence override
 *   (D-29). BENCH HEDGE (PLAN §2.6 item 8, unproven): the bench has not
 *   yet probed the scenario mixed text segment by segment, so the
 *   override is taught as what Logos does BY DESIGN — a clearly foreign
 *   sentence past twenty-four characters takes its own voice — never as
 *   an acted, witnessed claim.
 * - The language chip cycles Auto → English → Spanish (A-31); forcing a
 *   language re-segments the live session KEEPING the reader's place,
 *   and leaving Auto quietly clears a voice override in the wrong
 *   language. Changing a default mid-session re-voices from the current
 *   sentence (D-30).
 * - Accents are a Phonon-only axis: ES-ES 13 · ES-MX 12 · EN-US 12 ·
 *   EN-UK 13 (D-2). Pocket is the classic engine: 7 voices, EN-US ×5 +
 *   ES-ES ×2 only (D-3) — no caption here may imply a Pocket British or
 *   Mexican voice exists.
 * - The app's UI language (E-33) is a SEPARATE choice: it switches the
 *   app's own words instantly and never chooses reading voices; an
 *   untranslated string simply stays English, honestly, not as a bug.
 *
 * The staged text is composed only of scenario fiction (TEXT_EN +
 * TEXT_ES paragraphs, recombined into one mixed text) — scenario
 * material only, through the port.
 */
import { TEXT_EN, TEXT_ES } from '../scenario/fiction.ts'
import type { PresentationModule } from '../engine/types.ts'

const enParagraphs = TEXT_EN.text.split('\n\n')
const esParagraphs = TEXT_ES.text.split('\n\n')
const enSentences = enParagraphs[1].split(/(?<=\.)\s+/)
const esSentences = esParagraphs[1].split(/(?<=\.)\s+/)
/** One mixed text: an English paragraph, a Spanish paragraph, then one
 *  paragraph where a single long Spanish sentence sits between English
 *  ones — the stage for the per-paragraph switch and the override. */
const MIXED_TEXT = [
  enParagraphs[0],
  esParagraphs[0],
  `${enSentences[0]} ${esSentences[1]} ${enSentences[2]}`,
].join('\n\n')

export const AD5: PresentationModule = {
  id: 'AD5',
  floor: 'advanced',
  title: { en: 'Two Languages, One Listening', es: 'Dos idiomas, una escucha' },
  capability: {
    en: 'Listen to mixed English-and-Spanish texts with the right voice in every sentence, and understand exactly when Automatic switches — and when it doesn’t.',
    es: 'Escucha textos mezclados en inglés y español con la voz correcta en cada frase, y entiende exactamente cuándo cambia Automática — y cuándo no.',
  },
  verifiedAgainst: '1.4.156',
  scenes: [
    {
      id: 'automatic-with-mixed-texts',
      chapter: { en: 'Automatic with mixed texts', es: 'Automática con textos mixtos' },
      steps: [
        {
          id: 'ad5-type-mixed',
          anchorId: 'listen-editor',
          act: 'type',
          payload: { value: MIXED_TEXT },
          establishes: 'scenario-mixed-text',
          text: {
            en: 'This practice text mixes English and Spanish paragraphs.',
            es: 'Este texto de práctica mezcla párrafos en inglés y español.',
          },
        },
        {
          id: 'ad5-play-mixed',
          anchorId: 'listen-play',
          act: 'tap',
          establishes: 'scenario-session-playing',
          text: {
            en: 'Tap Play. Automatic is already in charge here.',
            es: 'Toca Reproducir. Automática ya está al mando aquí.',
          },
        },
        {
          id: 'ad5-auto-two-defaults',
          anchorId: 'listen-voice-chip',
          act: 'say',
          text: {
            en: 'Automatic keeps one default voice for each language.',
            es: 'Automática guarda una voz predeterminada para cada idioma.',
          },
        },
        {
          id: 'ad5-pick-wins',
          anchorId: 'listen-voice-chip',
          act: 'say',
          text: {
            en: 'A voice you pick yourself wins for its own language.',
            es: 'Una voz que eliges tú manda en su propio idioma.',
          },
        },
        {
          id: 'ad5-cast-before-sound',
          anchorId: 'listen-reader',
          act: 'say',
          text: {
            en: 'Every sentence was cast its voice before the first sound.',
            es: 'Cada frase recibió su voz antes del primer sonido.',
          },
        },
        {
          id: 'ad5-paragraph-switch',
          anchorId: 'listen-reader',
          act: 'say',
          text: {
            en: "So each paragraph is read in its own language's voice.",
            es: 'Así, cada párrafo se lee con la voz de su idioma.',
          },
        },
        {
          id: 'ad5-ask-sentence',
          anchorId: 'listen-reader',
          act: 'ask',
          question: {
            en: 'Can one lone Spanish sentence switch voices mid-paragraph?',
            es: '¿Puede una sola frase en español cambiar de voz dentro del párrafo?',
          },
        },
        {
          id: 'ad5-override-by-design',
          anchorId: 'listen-reader',
          act: 'say',
          text: {
            en: 'By design, yes: one clearly foreign sentence takes its own voice.',
            es: 'Por diseño, sí: una frase claramente extranjera toma su propia voz.',
          },
        },
        {
          id: 'ad5-override-conditions',
          anchorId: 'listen-reader',
          act: 'say',
          text: {
            en: 'It must run past twenty-four characters and read unmistakably foreign.',
            es: 'Debe pasar de veinticuatro caracteres y sonar inconfundiblemente extranjera.',
          },
        },
      ],
    },
    {
      id: 'the-language-chip',
      chapter: { en: 'The language chip keeps your place', es: 'El chip de idioma conserva tu lugar' },
      steps: [
        {
          id: 'ad5-chip-reads',
          anchorId: 'listen-lang-chip',
          act: 'say',
          text: {
            en: 'In a mixed text, the chip reads Auto · EN + ES.',
            es: 'En un texto mixto, el chip dice Auto · EN + ES.',
          },
        },
        {
          id: 'ad5-ask-force',
          anchorId: 'listen-lang-chip',
          act: 'ask',
          question: {
            en: 'What happens if you force one language instead?',
            es: '¿Qué pasa si fuerzas un solo idioma en su lugar?',
          },
        },
        {
          id: 'ad5-tap-english',
          anchorId: 'listen-lang-chip',
          act: 'tap',
          establishes: 'lang-forced-en',
          text: {
            en: 'Tap once: the chip lands on English.',
            es: 'Toca una vez: el chip cae en inglés.',
          },
        },
        {
          id: 'ad5-resegment-place',
          anchorId: 'listen-lang-chip',
          act: 'say',
          text: {
            en: 'Logos re-segments everything, keeping your exact place.',
            es: 'Logos vuelve a segmentar todo, conservando tu lugar exacto.',
          },
        },
        {
          id: 'ad5-keeps-playing',
          anchorId: 'listen-reader',
          act: 'say',
          text: {
            en: 'It keeps playing, from the sentence holding your place.',
            es: 'Y sigue sonando desde la frase donde está tu lugar.',
          },
        },
        {
          id: 'ad5-tap-spanish',
          anchorId: 'listen-lang-chip',
          act: 'tap',
          establishes: 'lang-forced-es',
          text: {
            en: 'Tap again: Spanish takes the whole text.',
            es: 'Toca otra vez: el español toma el texto entero.',
          },
        },
        {
          id: 'ad5-tap-auto',
          anchorId: 'listen-lang-chip',
          act: 'tap',
          establishes: 'lang-auto',
          text: {
            en: 'One more tap returns to Auto and both voices.',
            es: 'Un toque más vuelve a Automática y a ambas voces.',
          },
        },
        {
          id: 'ad5-override-clears',
          anchorId: 'listen-lang-chip',
          act: 'say',
          text: {
            en: 'Leaving Auto quietly clears a voice picked for another language.',
            es: 'Al salir de Automática se borra la voz de otro idioma.',
          },
        },
        {
          id: 'ad5-revoice-consequence',
          anchorId: 'listen-voice-chip',
          act: 'say',
          text: {
            en: 'Change a default mid-listening: this sentence restarts, re-voiced.',
            es: 'Cambia una predeterminada mientras escuchas: esta frase reinicia con otra voz.',
          },
        },
      ],
    },
    {
      id: 'phonon-and-pocket',
      chapter: { en: 'Phonon and Pocket, and their accents', es: 'Phonon y Pocket, y sus acentos' },
      steps: [
        {
          id: 'ad5-open-picker',
          anchorId: 'listen-voice-chip',
          act: 'tap',
          establishes: 'voice-picker-open',
          text: {
            en: "Open the picker: its groups tell the catalog's story.",
            es: 'Abre el selector: sus grupos cuentan la historia del catálogo.',
          },
        },
        {
          id: 'ad5-two-engines',
          anchorId: 'voices-catalog',
          act: 'say',
          text: {
            en: 'Fifty-seven voices, two engines: fifty Phonon, seven Pocket.',
            es: 'Cincuenta y siete voces, dos motores: cincuenta Phonon, siete Pocket.',
          },
        },
        {
          id: 'ad5-pocket-classic',
          anchorId: 'voice-picker-group:pocket',
          act: 'say',
          text: {
            en: 'Pocket is the classic engine, with seven voices only.',
            es: 'Pocket es el motor clásico, con solo siete voces.',
          },
        },
        {
          id: 'ad5-pocket-scope',
          anchorId: 'voices-catalog-accents',
          act: 'say',
          text: {
            en: 'Pocket speaks only American English and Spain Spanish.',
            es: 'Pocket solo habla inglés americano y español de España.',
          },
        },
        {
          id: 'ad5-accents-phonon',
          anchorId: 'voice-picker-group:es-MX',
          act: 'say',
          text: {
            en: "Mexico's accent exists only among Phonon voices.",
            es: 'El acento de México solo existe entre las voces Phonon.',
          },
        },
        {
          id: 'ad5-four-accents',
          anchorId: 'voice-picker-group:en-UK',
          act: 'say',
          text: {
            en: 'Four accents in all: American, British, España, México.',
            es: 'Cuatro acentos en total: americano, británico, España, México.',
          },
        },
        {
          id: 'ad5-group-order',
          anchorId: 'voice-picker-group:fav',
          act: 'say',
          text: {
            en: 'Six groups keep one fixed order; an empty group disappears.',
            es: 'Los grupos guardan un orden fijo; un grupo vacío desaparece.',
          },
        },
        {
          id: 'ad5-women-first',
          anchorId: 'voice-picker-group:en-US',
          act: 'say',
          text: {
            en: "Inside each accent group, women's voices come first, then A–Z.",
            es: 'Dentro de cada grupo, las voces de mujer van primero, luego A–Z.',
          },
        },
        {
          id: 'ad5-badges-favorites',
          anchorId: 'voice-picker-row:pk_alba',
          act: 'say',
          text: {
            en: 'In Favorites, rows wear their accent and Pocket badges.',
            es: 'En Favoritas, las filas llevan sus insignias de acento y Pocket.',
          },
        },
        {
          id: 'ad5-badges-quiet',
          anchorId: 'voice-picker-group:es-ES',
          act: 'say',
          text: {
            en: 'Inside its own accent group, the badge goes quiet.',
            es: 'Dentro de su propio grupo, la insignia de acento calla.',
          },
        },
        {
          id: 'ad5-voice-identity',
          anchorId: 'voice-picker-row:pk_alba',
          act: 'say',
          text: {
            en: 'Each voice carries a name, accent, gender and tagline.',
            es: 'Cada voz trae nombre, acento, género y una frase propia.',
          },
        },
      ],
    },
    {
      id: 'the-apps-own-language',
      chapter: { en: 'The app’s own language', es: 'El idioma de la propia app' },
      steps: [
        {
          id: 'ad5-goto-language-card',
          anchorId: 'set-card-language',
          act: 'goto',
          establishes: 'settings-language-card',
          text: {
            en: "Now a different choice: the app's own language.",
            es: 'Ahora otra elección distinta: el idioma de la propia app.',
          },
        },
        {
          id: 'ad5-unfold-language',
          anchorId: 'set-card-language',
          act: 'tap',
          establishes: 'language-card-open',
          text: {
            en: "Tap the Language card's header and it unfolds.",
            es: 'Toca la cabecera de la tarjeta Idioma y se despliega.',
          },
        },
        {
          id: 'ad5-ui-switch',
          anchorId: 'set-ui-lang',
          act: 'say',
          text: {
            en: 'English or Español: every word on screen switches instantly.',
            es: 'English o Español: cada palabra en pantalla cambia al instante.',
          },
        },
        {
          id: 'ad5-ui-not-voices',
          anchorId: 'set-ui-lang',
          act: 'say',
          text: {
            en: "But it never chooses reading voices; that is Listen's job.",
            es: 'Pero nunca elige las voces de lectura; eso es tarea de Escuchar.',
          },
        },
        {
          id: 'ad5-untranslated-stays',
          anchorId: 'set-ui-lang:en',
          act: 'say',
          text: {
            en: 'An untranslated line simply stays English; that is no failure.',
            es: 'Una línea sin traducir simplemente queda en inglés; no es un fallo.',
          },
        },
        {
          id: 'ad5-two-jobs-close',
          anchorId: 'set-ui-lang',
          act: 'say',
          text: {
            en: 'Two language choices, two jobs: screen words here, voices there.',
            es: 'Dos elecciones de idioma, dos tareas: pantalla aquí, voces allá.',
          },
        },
      ],
    },
  ],
}

export default AD5
