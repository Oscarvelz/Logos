/**
 * Q3 «Voces / Voices» — the Quick module for Logos' voices.
 *
 * Owns (PLAN §2.5): A-32, A-33 · D-5…D-13, D-15, D-16, D-17, D-20, D-21,
 * D-22, D-23, D-24, D-25. D-14 rides inside D-13 as a narrated beat
 * (NO-SCENE list: the live-synthesised preview never fires on the current
 * catalog — 57 of 57 samples are baked). AD5 owns the catalog's deep
 * anatomy (D-1…D-4, D-18, D-19, D-26…D-30); this module teaches only what
 * a first-week listener needs, and never contradicts it:
 *
 * - 57 voices: 50 Phonon + 7 Pocket (D-1…D-3).
 * - The four accents (American / British / España / México) are Phonon
 *   only; Pocket lives only in EN-US and ES-ES — no caption here may
 *   imply a Pocket British or Mexican voice exists.
 * - Original favorites wear gold stars; voices the user stars wear violet
 *   (D-10, verified in ui.tsx + settings.ts).
 * - Make default is per language, and a live session re-voices from the
 *   current sentence (D-11 + A-33).
 *
 * Sound (OQ-2, as decided): the preview beats really play when a voice is
 * ready; the script says so, and says honestly that an undownloaded
 * neural voice is announced, never faked. The fiction text staged here is
 * TEXT_EN from the scenario — scenario material only, through the port.
 *
 * Voice ids used below are the catalog's own (lib/voices.ts +
 * phonon-voices.json): Zoey (EN-US, original), Juniper (EN-US, unstarred),
 * Noa (ES-ES, original), Marcos (ES-ES), Alba (pk_alba, Pocket EN-US).
 */
import { TEXT_EN } from '../scenario/fiction.ts'
import type { PresentationModule } from '../engine/types.ts'

const ZOEY = 'ph_NbpkqMVS3CJeq2j8'
const JUNIPER = 'ph_NIWIOv5vTi5eRMj8'
const NOA = 'ph_b6FvJAiokjdqIti4'
const MARCOS = 'ph_jvPx8j8zLGQ3utZz'

export const Q3: PresentationModule = {
  id: 'Q3',
  floor: 'quick',
  title: { en: 'Voices', es: 'Voces' },
  capability: {
    en: 'Choose among 57 voices with confidence: hear each one first, star your favourites, and set the voice each language speaks by default.',
    es: 'Elige entre 57 voces con confianza: escucha cada una antes, estrella tus favoritas y fija la voz con la que hablará cada idioma por defecto.',
  },
  verifiedAgainst: '1.4.156',
  scenes: [
    {
      id: 'the-chip',
      chapter: { en: 'The chip on Listen', es: 'El chip en Escuchar' },
      steps: [
        {
          id: 'q3-play-fiction',
          anchorId: 'listen-play',
          effectAnchorId: 'listen-reader',
          act: 'tap',
          payload: { param: TEXT_EN.id },
          establishes: 'scenario-session-playing',
          text: {
            en: 'First, our practice text starts playing on the stage.',
            es: 'Primero, nuestro texto de práctica empieza a sonar en el escenario.',
          },
        },
        {
          id: 'q3-chip-names-voice',
          anchorId: 'listen-voice-chip',
          act: 'say',
          text: {
            en: 'This chip names the voice reading right now — it changes with the sentences.',
            es: 'Este chip nombra la voz que lee ahora: cambia con las frases.',
          },
        },
        {
          id: 'q3-chip-opens-picker',
          anchorId: 'listen-voice-chip',
          effectAnchorId: 'voice-picker',
          act: 'tap',
          establishes: 'voice-picker-open',
          text: {
            en: 'Tap the chip and the voice picker opens.',
            es: 'Toca el chip y se abre el selector de voces.',
          },
        },
        {
          id: 'q3-picker-purpose',
          anchorId: 'voice-picker',
          act: 'say',
          text: {
            en: 'The picker is where you choose the voice for this listening.',
            es: 'En el selector eliges la voz de esta escucha.',
          },
        },
      ],
    },
    {
      id: 'folded-groups',
      chapter: { en: 'Folded groups, one open at a time', es: 'Grupos plegados, uno abierto a la vez' },
      steps: [
        {
          id: 'q3-ask-wall',
          anchorId: 'voice-picker-group:en-US:head',
          act: 'ask',
          question: {
            en: 'Do fifty-seven voices open as one long wall?',
            es: '¿Se abren las cincuenta y siete voces como una lista enorme?',
          },
        },
        {
          id: 'q3-groups-folded',
          anchorId: 'voice-picker-group:en-US:head',
          act: 'say',
          text: {
            en: 'No. Groups arrive folded, and only one opens at a time.',
            es: 'No. Los grupos llegan plegados y solo se abre uno.',
          },
        },
        {
          id: 'q3-open-group',
          anchorId: 'voice-picker-group:en-US:head',
          effectAnchorId: 'voice-picker-group:en-US',
          act: 'tap',
          establishes: 'picker-group-open',
          text: {
            en: "Tap a group's header and it unfolds; the others close.",
            es: 'Toca la cabecera de un grupo y se despliega; los demás se cierran.',
          },
        },
        {
          id: 'q3-automatic-row',
          anchorId: 'voice-picker-auto',
          act: 'say',
          text: {
            en: 'The top row is Automatic: your default voice for each language.',
            es: 'La primera fila es Automática: tu voz predeterminada para cada idioma.',
          },
        },
        {
          id: 'q3-selected-line',
          anchorId: 'voice-picker-group:fav:head',
          act: 'say',
          text: {
            en: 'A folded group holding your voice reads “Selected” plus its name.',
            es: 'Un grupo plegado con tu voz dice «Seleccionada» y su nombre.',
          },
        },
      ],
    },
    {
      id: 'hear-before-choosing',
      chapter: { en: 'Hear it before you choose it', es: 'Escúchala antes de elegirla' },
      steps: [
        {
          id: 'q3-ask-judge',
          anchorId: `voice-picker-row:${JUNIPER}:preview`,
          act: 'ask',
          question: {
            en: 'How can you judge a voice without choosing it?',
            es: '¿Cómo juzgas una voz sin elegirla todavía?',
          },
        },
        {
          id: 'q3-preview-button',
          anchorId: `voice-picker-row:${JUNIPER}:preview`,
          act: 'tap',
          text: {
            en: 'The small play button previews the voice; nothing is chosen yet.',
            es: 'El botón de reproducir muestra la voz; aún no eliges nada.',
          },
        },
        {
          id: 'q3-preview-really-sounds',
          anchorId: `voice-picker-row:${JUNIPER}:preview`,
          act: 'say',
          text: {
            en: 'The preview really sounds when the voice is ready on your phone.',
            es: 'La muestra suena de verdad cuando la voz está lista en tu teléfono.',
          },
        },
        {
          id: 'q3-preview-honest',
          anchorId: `voice-picker-row:${JUNIPER}:preview`,
          act: 'say',
          text: {
            en: 'If the neural voice is not downloaded, Logos says so honestly.',
            es: 'Si la voz neuronal no está descargada, Logos lo dice con honestidad.',
          },
        },
        {
          id: 'q3-pick-row',
          anchorId: `voice-picker-row:${JUNIPER}`,
          effectAnchorId: 'listen-reader',
          act: 'tap',
          text: {
            en: 'Tap the row itself and that voice is chosen; the picker closes.',
            es: 'Toca la fila y esa voz queda elegida; el selector se cierra.',
          },
        },
        {
          id: 'q3-revoice-consequence',
          anchorId: 'listen-voice-chip',
          act: 'say',
          text: {
            en: 'Your text re-voices at once: the current sentence restarts, newly voiced.',
            es: 'Tu texto cambia de voz al instante: la frase actual empieza de nuevo.',
          },
        },
        {
          id: 'q3-badges-quiet',
          anchorId: `voice-picker-row:${JUNIPER}`,
          act: 'say',
          optional: true,
          text: {
            en: 'Inside its accent group, a row drops the accent badge: quieter.',
            es: 'Dentro de su grupo de acento, la fila omite la insignia: más limpia.',
          },
        },
      ],
    },
    {
      id: 'voices-page',
      chapter: { en: 'The Voices page: all fifty-seven', es: 'La página de Voces: las cincuenta y siete' },
      steps: [
        {
          id: 'q3-goto-voices',
          anchorId: 'voices-head',
          act: 'goto',
          establishes: 'voices-page',
          text: {
            en: 'The Voices page holds the whole catalog: fifty-seven voices.',
            es: 'La página de Voces guarda el catálogo entero: cincuenta y siete voces.',
          },
        },
        {
          id: 'q3-two-jobs',
          anchorId: 'voices-head',
          act: 'say',
          text: {
            en: 'Its two jobs: star favorites, and set one default per language.',
            es: 'Sus dos tareas: estrellar favoritas y fijar una predeterminada por idioma.',
          },
        },
        {
          id: 'q3-filter-pocket',
          anchorId: 'voices-filter:pocket',
          effectAnchorId: 'voices-grid',
          act: 'tap',
          establishes: 'voices-filter-pocket',
          text: {
            en: 'Filters sort the catalog: All, Favorites, English, Español, Pocket.',
            es: 'Los filtros ordenan el catálogo por idioma, favoritas o motor Pocket.',
          },
        },
        {
          id: 'q3-card-anatomy',
          anchorId: 'voice-card:pk_alba',
          act: 'say',
          text: {
            en: 'Name, accent, one line of character — star to keep it, play to judge it.',
            es: 'Nombre, acento y carácter; estrella para guardarla, muestra para juzgarla.',
          },
        },
        {
          id: 'q3-pocket-scope',
          anchorId: 'voice-card:pk_alba',
          act: 'say',
          text: {
            en: 'Pocket voices like Alba live only in American English and Spain Spanish.',
            es: 'Las voces Pocket como Alba solo viven en inglés americano y español de España.',
          },
        },
        {
          id: 'q3-accents-phonon',
          anchorId: 'voices-grid',
          act: 'say',
          text: {
            en: 'American, British, España and México accents belong to Phonon voices only.',
            es: 'Los acentos americano, británico, España y México son solo de voces Phonon.',
          },
        },
        {
          id: 'q3-card-preview',
          anchorId: `voice-card:${NOA}:preview`,
          act: 'tap',
          text: {
            en: "Tap a card's play button and hear that voice before choosing.",
            es: 'Toca el botón de una tarjeta y escucha esa voz antes de elegir.',
          },
        },
        {
          id: 'q3-previews-baked',
          anchorId: `voice-card:${NOA}:preview`,
          act: 'say',
          text: {
            en: 'Every sample is ready-made, so previews play instantly, with no waiting.',
            es: 'Cada muestra ya viene lista, así que suena al instante, sin esperas.',
          },
        },
      ],
    },
    {
      id: 'stars',
      chapter: { en: 'Stars: gold and violet', es: 'Estrellas: doradas y violetas' },
      steps: [
        {
          id: 'q3-ask-keep-close',
          anchorId: `voice-card:${JUNIPER}:star`,
          act: 'ask',
          question: {
            en: 'You love a voice. How do you keep it close?',
            es: 'Te encanta una voz. ¿Cómo la mantienes cerca?',
          },
        },
        {
          id: 'q3-star-juniper',
          anchorId: `voice-card:${JUNIPER}:star`,
          act: 'tap',
          text: {
            en: 'Tap its star. Juniper joins your favorites immediately.',
            es: 'Toca su estrella. Juniper entra en tus favoritas al instante.',
          },
        },
        {
          id: 'q3-gold-originals',
          anchorId: `voice-card:${ZOEY}:star`,
          act: 'say',
          text: {
            en: 'Original favorites wear gold stars; Zoey came starred from the factory.',
            es: 'Las favoritas originales llevan estrella dorada; Zoey ya venía estrellada.',
          },
        },
        {
          id: 'q3-violet-yours',
          anchorId: `voice-card:${JUNIPER}:star`,
          act: 'say',
          text: {
            en: 'Voices you star yourself wear violet, so yours stand apart.',
            es: 'Las que estrellas tú llevan violeta, para distinguir las tuyas.',
          },
        },
        {
          id: 'q3-favorites-float',
          anchorId: 'voices-grid',
          act: 'say',
          text: {
            en: 'Favorites float to the top of every voice list, in star order.',
            es: 'Las favoritas flotan arriba en cada lista, en tu orden de estrellas.',
          },
        },
        {
          id: 'q3-back-to-picker',
          anchorId: 'listen-voice-chip',
          effectAnchorId: 'voice-picker',
          act: 'tap',
          establishes: 'voice-picker-open',
          text: {
            en: "Back in Listen's picker, the same star waits on each row.",
            es: 'De vuelta en el selector de Escuchar, la misma estrella espera en cada fila.',
          },
        },
        {
          id: 'q3-open-favorites-group',
          anchorId: 'voice-picker-group:fav:head',
          effectAnchorId: 'voice-picker-group:fav',
          act: 'tap',
          establishes: 'picker-group-open',
          text: {
            en: 'Open Favorites: your newly starred Juniper is already here.',
            es: 'Abre Favoritas: Juniper, recién estrellada, ya está aquí.',
          },
        },
        {
          id: 'q3-picker-star',
          anchorId: `voice-picker-row:${JUNIPER}:star`,
          act: 'tap',
          text: {
            en: "Tap a row's star here and it only stars; nothing gets chosen.",
            es: 'Toca aquí la estrella de una fila y solo estrella; no eliges nada.',
          },
        },
        {
          id: 'q3-empty-favorites',
          anchorId: 'voices-empty-fav',
          act: 'say',
          optional: true,
          text: {
            en: 'With no favorites, the empty page itself teaches the star gesture.',
            es: 'Sin favoritas, la página vacía te enseña el gesto de la estrella.',
          },
        },
      ],
    },
    {
      id: 'make-default',
      chapter: { en: 'One default per language', es: 'Una predeterminada por idioma' },
      steps: [
        {
          id: 'q3-ask-default',
          anchorId: `voice-card:${MARCOS}:make-default`,
          act: 'ask',
          question: {
            en: 'Which voice should start every Spanish text by itself?',
            es: '¿Qué voz debería empezar sola cada texto en español?',
          },
        },
        {
          id: 'q3-make-default-marcos',
          anchorId: `voice-card:${MARCOS}:make-default`,
          act: 'tap',
          text: {
            en: "Tap Make default on Marcos. He becomes Spanish's default voice.",
            es: 'Toca el botón de predeterminada en Marcos: será la voz del español.',
          },
        },
        {
          id: 'q3-other-language-untouched',
          anchorId: `voice-card:${MARCOS}:make-default`,
          act: 'say',
          text: {
            en: 'Only Spanish changed. Your English default stays exactly as it was.',
            es: 'Solo cambió el español. Tu predeterminada de inglés queda como estaba.',
          },
        },
        {
          id: 'q3-default-revoices-live',
          anchorId: 'listen-voice-chip',
          act: 'say',
          text: {
            en: 'If a session is playing, it re-voices from the current sentence.',
            es: 'Si una sesión está sonando, cambia de voz desde la frase actual.',
          },
        },
        {
          id: 'q3-automatic-closing',
          anchorId: 'voice-picker-auto',
          act: 'say',
          optional: true,
          text: {
            en: 'Choose Automatic anytime and your two defaults do the choosing.',
            es: 'Elige Automática cuando quieras y tus dos predeterminadas eligen por ti.',
          },
        },
      ],
    },
  ],
}

export default Q3
