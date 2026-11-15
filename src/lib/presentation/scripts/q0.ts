/**
 * Q0 — La vuelta completa / The Whole Lap.
 *
 * The front door of the Logos Presentation (PLAN §3): one quick PERFORMED
 * lap — paste the fiction text → listen → tap a word → change voice → save
 * → float the bubble (λ). It says plainly, in its first and last beats,
 * that this is only the quick view to start: every stop on the lap has its
 * own deeper module (Q1–Q5), and nothing is locked.
 *
 * Coverage (PLAN §2.5): Q0 owns exactly four census items — the doors of
 * the house: E-1 (the Settings page where this index lives), F-1 and F-3
 * (the one navigation, in its two seats), F-5 (the brand that brings you
 * home). The gestures it performs belong to Q1–Q5; Q0 teaches none of them
 * twice.
 *
 * Performed acts go through the scenario port verbs only (engine/
 * scenario-port.ts): the Paste tap carries the fiction text's id as its
 * parameter, so the stage loads and plays «The Morning the Harbour Turned
 * Gold» (scenario fiction, never user data); the λ tap flips through the
 * sandbox's LambdaPort discipline — the one real touch OQ-1 allows, since
 * the switch is the user's own and holds no data. The voice change is
 * staged on the fiction stage's own cast (`scenario-voice-es` is the
 * stage's second fiction voice).
 *
 * Captions are bilingual, each ≤15 words in BOTH languages, and every
 * performed act is followed by its consequence — what happens after is
 * part of the lesson. There is no duration literal anywhere: the index
 * computes the label from this script at Automatic 1× (clock.ts).
 */
import { TEXT_EN } from '../scenario/fiction.ts'
import type { PresentationModule } from '../engine/types.ts'

export const q0: PresentationModule = {
  id: 'Q0',
  floor: 'quick',
  title: { en: 'The Whole Lap', es: 'La vuelta completa' },
  capability: {
    en: 'Take one quick lap through the whole app — paste, listen, change the voice, save, and float the bubble — and know where everything lives.',
    es: 'Da una vuelta rápida por toda la app — pegar, escuchar, cambiar la voz, guardar y soltar la burbuja — y sabrás dónde vive cada cosa.',
  },
  verifiedAgainst: '1.4.156',
  scenes: [
    {
      id: 'q0-doors',
      chapter: { en: 'The quick lap', es: 'La vuelta rápida' },
      steps: [
        {
          id: 'q0-intro',
          anchorId: 'shell-nav:listen',
          act: 'say',
          text: {
            en: 'This is the quick lap: one fast tour to start listening today.',
            es: 'Esta es la vuelta rápida: un recorrido breve para empezar a escuchar hoy.',
          },
        },
        {
          id: 'q0-lessons-live-in-settings',
          anchorId: 'set-page-head',
          act: 'say',
          text: {
            en: 'These lessons live in Settings, free to start in any order.',
            es: 'Estas lecciones viven en Ajustes, libres para empezar en cualquier orden.',
          },
        },
        {
          id: 'q0-brand-home',
          anchorId: 'shell-brand-home',
          act: 'say',
          text: {
            en: 'Wherever you wander, the Logos name returns you to Listen.',
            es: 'Vayas donde vayas, el nombre de Logos te devuelve a Escuchar.',
          },
        },
      ],
    },
    {
      id: 'q0-paste-and-listen',
      chapter: { en: 'Paste, listen, steer', es: 'Pega, escucha, guía' },
      steps: [
        {
          id: 'q0-paste',
          anchorId: 'listen-paste',
          act: 'tap',
          text: {
            en: 'Tap Paste: the harbour text lands and starts playing at once.',
            es: 'Toca Pegar: el texto del puerto llega y empieza a sonar enseguida.',
          },
          payload: { param: TEXT_EN.id },
        },
        {
          id: 'q0-head-names-it',
          anchorId: 'listen-head',
          act: 'say',
          text: {
            en: 'The header confirms your text — and how long hearing it takes.',
            es: 'El encabezado confirma tu texto, y cuánto tarda escucharlo.',
          },
        },
        {
          id: 'q0-reader-follows',
          anchorId: 'listen-reader',
          act: 'say',
          text: {
            en: 'The voice reads sentence by sentence, lighting each word it says.',
            es: 'La voz lee frase a frase, iluminando cada palabra que dice.',
          },
        },
        {
          id: 'q0-ask-word',
          anchorId: 'listen-reader-sentence:2',
          act: 'ask',
          question: {
            en: 'Want to hear that sentence again, from its first word?',
            es: '¿Quieres oír esa frase otra vez, desde su primera palabra?',
          },
        },
        {
          id: 'q0-tap-word',
          anchorId: 'listen-reader-sentence:2',
          act: 'tap',
          text: {
            en: 'Tap any word: reading jumps there and continues from that word.',
            es: 'Toca cualquier palabra: la lectura salta ahí y sigue desde ella.',
          },
        },
      ],
    },
    {
      id: 'q0-voice-and-keep',
      chapter: { en: 'A new voice, kept safe', es: 'Una voz nueva, a salvo' },
      steps: [
        {
          id: 'q0-open-voices',
          anchorId: 'listen-voice-chip',
          act: 'tap',
          text: {
            en: 'The voice chip opens every voice Logos can read with.',
            es: 'El chip de voz abre todas las voces con que Logos lee.',
          },
        },
        {
          id: 'q0-pick-voice',
          anchorId: 'voice-picker-row:scenario-voice-es',
          act: 'tap',
          text: {
            en: 'Pick another voice: the reading continues in it, from this sentence.',
            es: 'Elige otra voz: la lectura continúa con ella, desde esta frase.',
          },
        },
        {
          id: 'q0-open-keep',
          anchorId: 'listen-reader-save',
          act: 'tap',
          text: {
            en: 'Save keeps this reading: choose the audio, and Logos makes it.',
            es: 'Guardar conserva esta lectura: elige el audio y Logos lo crea.',
          },
        },
        {
          id: 'q0-keep-audio',
          anchorId: 'listen-keep-audio',
          act: 'tap',
          text: {
            en: 'The finished audio waits for you in the Library, under Saved.',
            es: 'El audio terminado te espera en la Biblioteca, en Guardado.',
          },
        },
      ],
    },
    {
      id: 'q0-bubble-and-home',
      chapter: { en: 'The bubble, and home', es: 'La burbuja, y a casa' },
      steps: [
        {
          id: 'q0-lambda-door',
          anchorId: 'bubble-lambda',
          act: 'say',
          text: {
            en: 'One door remains: the λ in the top bar floats the bubble.',
            es: 'Queda una puerta: la λ de la barra superior suelta la burbuja.',
          },
        },
        {
          id: 'q0-lambda-tap',
          anchorId: 'bubble-lambda',
          act: 'tap',
          text: {
            en: 'Tap it: the bubble floats over every app; the gold dot confirms.',
            es: 'Tócala: la burbuja flota sobre cada app; el punto dorado lo confirma.',
          },
        },
        {
          id: 'q0-lap-done',
          anchorId: 'bubble-lambda',
          act: 'say',
          text: {
            en: 'That was the whole lap; each stop has its own deeper module.',
            es: 'Esa fue la vuelta completa; cada parada tiene su módulo a fondo.',
          },
        },
        {
          id: 'q0-free-start',
          anchorId: 'set-presentations',
          act: 'goto',
          text: {
            en: 'Start any module whenever you like; nothing here is locked.',
            es: 'Empieza cualquier módulo cuando quieras; aquí nada está cerrado.',
          },
        },
      ],
    },
  ],
}
