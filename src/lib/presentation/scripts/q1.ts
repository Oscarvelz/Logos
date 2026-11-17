/**
 * Q1 — «Escuchar en un minuto / Listen in a Minute» (Quick floor).
 *
 * The first listening lesson: a text comes in (typed by hand, the Paste
 * button, a share from another app), Play starts the voice, the reader
 * follows word by word, a tap on any word starts there, the scrubber drags
 * by sentences, and Previous / Next step through them — ending where every
 * listening ends, with Play itself as the replay.
 *
 * Census ownership (PLAN §2.5 — Q1 owns 18 items, all of Front A):
 * A-1 the editor and its living draft · A-2 typing silently prepares the
 * audio · A-3 the Paste BUTTON is Paste = Play (long-press paste only fills
 * the box — never the reverse claim) · A-4 paste-failure honesty · A-5 the
 * eraser ends the session · A-8 editor meta (words + minutes) · A-10 shared
 * text plays at once · A-12 the head names what is loaded · A-14 Play/Pause,
 * one button · A-15 Previous restarts the sentence when >2.5 s in, else
 * steps back · A-16 Next steps one sentence · A-18 the scrubber drags by
 * sentences (two layers; a paused drag stays paused) · A-19 its tip names
 * the sentence, ready or not · A-21 sentences past and now · A-22 tap a
 * word to start there · A-24 the word-by-word light · A-25 the reader
 * follows until your hand says wait · A-26 the reader's hint line · A-39
 * the player meta · A-45 the finished state (Play IS the replay).
 * One pointer beat only: the lone-URL banner (A-9, owned by AD2) is named
 * as an optional say — the banner waits for its «Read page» tap; it never
 * fetches on its own. Nothing else is claimed here.
 *
 * Performed acts go through the scenario port only: the type step carries
 * the fiction story itself, the Paste tap and the Play taps name their
 * fiction text by id (payload.param), and Next performs on the scenario
 * stage. All staged material is fiction.ts — never user data.
 */
import { POEM_EN, TEXT_EN } from '../scenario/fiction.ts'
import type { PresentationModule } from '../engine/types.ts'

export const Q1: PresentationModule = {
  id: 'Q1',
  floor: 'quick',
  title: { en: 'Listen in a Minute', es: 'Escuchar en un minuto' },
  capability: {
    en: 'Bring any text in and hear it within a minute, follow the voice in the reader, and jump to the exact word or sentence you want.',
    es: 'Trae cualquier texto y escúchalo en un minuto, sigue la voz en el lector y salta a la palabra o la frase exacta que buscas.',
  },
  verifiedAgainst: '1.4.156',
  scenes: [
    {
      id: 'q1-bring',
      chapter: { en: 'Bring a text in', es: 'Trae un texto' },
      steps: [
        {
          id: 'q1-bring-ask',
          anchorId: 'listen-editor',
          act: 'ask',
          question: {
            en: 'How does any text start playing here?',
            es: '¿Cómo empieza a sonar cualquier texto aquí?',
          },
        },
        {
          id: 'q1-bring-type',
          anchorId: 'listen-editor',
          act: 'type',
          payload: { value: TEXT_EN.text },
          text: {
            en: 'Type or paste by hand: it lands in this box.',
            es: 'Escribe o pega a mano: cae en esta caja.',
          },
        },
        {
          id: 'q1-bring-draft',
          anchorId: 'listen-editor',
          act: 'say',
          text: {
            en: 'Leave and return: the draft stays, word for word.',
            es: 'Sal y vuelve: el borrador queda, palabra por palabra.',
          },
        },
        {
          id: 'q1-bring-prep',
          anchorId: 'listen-editor',
          act: 'say',
          text: {
            en: 'Quietly, Logos already prepares the audio behind it.',
            es: 'En silencio, Logos ya va preparando el audio.',
          },
        },
        {
          id: 'q1-bring-meta',
          anchorId: 'listen-editor-meta',
          act: 'say',
          text: {
            en: 'Before anything plays, this line tells you the text\u2019s size.',
            es: 'Antes de que suene nada, esta línea te dice el tamaño del texto.',
          },
        },
        {
          id: 'q1-paste-ask',
          anchorId: 'listen-paste',
          act: 'ask',
          question: {
            en: 'Copied a poem somewhere else first?',
            es: '¿Copiaste un poema en otro sitio antes?',
          },
        },
        {
          id: 'q1-paste-tap',
          anchorId: 'listen-paste',
          effectAnchorId: 'listen-reader',
          act: 'tap',
          payload: { param: POEM_EN.id },
          text: {
            en: 'The Paste button pastes and plays, all at once.',
            es: 'El botón Pegar pega y reproduce, todo junto.',
          },
        },
        {
          id: 'q1-paste-after',
          anchorId: 'listen-reader',
          act: 'say',
          text: {
            en: 'The reader opens already sounding, no second tap.',
            es: 'El lector se abre ya sonando, sin otro toque.',
          },
        },
        {
          id: 'q1-paste-fail',
          anchorId: 'listen-paste',
          act: 'say',
          text: {
            en: 'Clipboard empty or blocked? A toast answers honestly.',
            es: '¿Portapapeles vacío o bloqueado? Un aviso responde con honestidad.',
          },
        },
        {
          id: 'q1-paste-manual',
          anchorId: 'listen-editor',
          act: 'say',
          text: {
            en: 'Long-press pasting only fills the box, never plays.',
            es: 'Pegar con pulsación larga solo llena, nunca reproduce.',
          },
        },
        {
          id: 'q1-url-pointer',
          anchorId: 'listen-url-banner',
          act: 'say',
          optional: true,
          text: {
            en: 'A lone link waits here for its Read page tap.',
            es: 'Un enlace solo espera aquí tocar Leer página.',
          },
        },
        {
          id: 'q1-share-say',
          anchorId: 'listen-page',
          act: 'say',
          text: {
            en: 'Sharing text here from another app plays it too.',
            es: 'Compartir aquí un texto desde otra app también suena.',
          },
        },
        {
          id: 'q1-clear-tap',
          anchorId: 'listen-clear',
          effectAnchorId: 'listen-editor',
          act: 'tap',
          text: {
            en: 'The eraser clears the text and ends the session.',
            es: 'Este botón borra el texto y termina la sesión.',
          },
        },
        {
          id: 'q1-clear-after',
          anchorId: 'listen-clear',
          act: 'say',
          text: {
            en: 'Every sound stops, even one already handed over.',
            es: 'Todo deja de sonar, incluso lo ya entregado.',
          },
        },
      ],
    },
    {
      id: 'q1-play',
      chapter: { en: 'Play, and the reader follows', es: 'Reproduce, y el lector sigue' },
      steps: [
        {
          id: 'q1-play-ask',
          anchorId: 'listen-head',
          act: 'ask',
          question: {
            en: 'Ready to hear our story out loud?',
            es: '¿Listo para oír nuestra historia en voz alta?',
          },
        },
        {
          id: 'q1-play-head',
          anchorId: 'listen-head',
          act: 'say',
          text: {
            en: 'The head confirms what is loaded: this text, counted and timed.',
            es: 'La cabecera confirma lo cargado: este texto, contado y medido.',
          },
        },
        {
          id: 'q1-play-tap',
          anchorId: 'listen-play',
          effectAnchorId: 'listen-reader',
          act: 'tap',
          payload: { param: TEXT_EN.id },
          text: {
            en: 'One tap on Play loads it and starts reading.',
            es: 'Un toque en Reproducir lo carga y empieza a leer.',
          },
        },
        {
          id: 'q1-play-pause',
          anchorId: 'listen-play',
          effectAnchorId: 'listen-reader',
          act: 'tap',
          text: {
            en: 'Tap it again: the reading pauses right here.',
            es: 'Tócalo otra vez: la lectura se pausa aquí.',
          },
        },
        {
          id: 'q1-play-meta',
          anchorId: 'listen-player-meta',
          act: 'say',
          text: {
            en: 'This line tracks what remains: sentences and minutes still to hear.',
            es: 'Esta línea sigue lo que falta: frases y minutos por escuchar.',
          },
        },
        {
          id: 'q1-reader-past',
          anchorId: 'listen-reader',
          act: 'say',
          text: {
            en: 'Sentences already read rest dimmer behind the voice.',
            es: 'Las frases ya leídas descansan atenuadas tras la voz.',
          },
        },
        {
          id: 'q1-reader-words',
          anchorId: 'listen-reader-sentence:0',
          act: 'say',
          text: {
            en: 'Each word lights exactly as the voice reaches it.',
            es: 'Cada palabra se ilumina justo cuando llega la voz.',
          },
        },
        {
          id: 'q1-reader-follow',
          anchorId: 'listen-reader',
          act: 'scroll',
          payload: { direction: 'down' },
          text: {
            en: 'Scroll by hand: it waits three seconds, then follows.',
            es: 'Desliza a mano: espera tres segundos y sigue.',
          },
        },
      ],
    },
    {
      id: 'q1-step',
      chapter: { en: 'Tap a word, step by sentence', es: 'Toca una palabra, avanza frase a frase' },
      steps: [
        {
          id: 'q1-tap-ask',
          anchorId: 'listen-reader-head',
          act: 'ask',
          question: {
            en: 'Missed a word? Must you restart everything?',
            es: '¿Perdiste una palabra? ¿Hay que empezar todo?',
          },
        },
        {
          id: 'q1-tap-hint',
          anchorId: 'listen-reader-head',
          act: 'say',
          text: {
            en: "The reader's own hint teaches it: tap a word, jump there.",
            es: 'La ayuda del lector lo enseña: toca una palabra y saltas ahí.',
          },
        },
        {
          id: 'q1-tap-word',
          anchorId: 'listen-reader-sentence:3',
          effectAnchorId: 'listen-reader',
          act: 'tap',
          text: {
            en: 'Tap any word: reading starts right there.',
            es: 'Toca cualquier palabra: la lectura empieza ahí mismo.',
          },
        },
        {
          id: 'q1-tap-after',
          anchorId: 'listen-reader-sentence:3',
          act: 'say',
          text: {
            en: 'The voice lands just before that word.',
            es: 'La voz aterriza justo antes de esa palabra.',
          },
        },
        {
          id: 'q1-scrub-ask',
          anchorId: 'listen-scrubber',
          act: 'ask',
          question: {
            en: 'Want somewhere far, without tapping word by word?',
            es: '¿Quieres ir lejos, sin tocar palabra por palabra?',
          },
        },
        {
          id: 'q1-scrub-drag',
          anchorId: 'listen-scrubber',
          effectAnchorId: 'listen-reader',
          act: 'tap',
          text: {
            en: 'Drag this bar: it moves sentence by sentence.',
            es: 'Arrastra esta barra: se mueve frase a frase.',
          },
        },
        {
          id: 'q1-scrub-layers',
          anchorId: 'listen-scrubber',
          act: 'say',
          text: {
            en: 'The pale stretch shows audio already prepared ahead.',
            es: 'El tramo pálido muestra el audio ya preparado.',
          },
        },
        {
          id: 'q1-scrub-tip',
          anchorId: 'listen-scrubber',
          act: 'say',
          text: {
            en: 'Its tip names the sentence, even unprepared ones.',
            es: 'Su punta nombra la frase, incluso las no preparadas.',
          },
        },
        {
          id: 'q1-scrub-paused',
          anchorId: 'listen-scrubber',
          act: 'say',
          text: {
            en: 'Drag while paused: it moves, and stays paused.',
            es: 'Arrastra en pausa: se mueve y sigue en pausa.',
          },
        },
        {
          id: 'q1-prev-ask',
          anchorId: 'listen-prev',
          act: 'ask',
          question: {
            en: 'You missed that. Which button saves you?',
            es: 'Te lo perdiste. ¿Qué botón te salva?',
          },
        },
        {
          id: 'q1-prev-tap',
          anchorId: 'listen-prev',
          effectAnchorId: 'listen-reader',
          act: 'tap',
          text: {
            en: 'Previous, deep inside a sentence, restarts that sentence.',
            es: 'Anterior, dentro de una frase, la reinicia entera.',
          },
        },
        {
          id: 'q1-prev-after',
          anchorId: 'listen-prev',
          act: 'say',
          text: {
            en: 'Near its start, Previous steps one sentence back.',
            es: 'Cerca de su inicio, Anterior retrocede una frase.',
          },
        },
        {
          id: 'q1-next-tap',
          anchorId: 'listen-next',
          effectAnchorId: 'listen-reader',
          act: 'tap',
          text: {
            en: 'Next steps exactly one sentence forward.',
            es: 'Siguiente avanza exactamente una frase.',
          },
        },
      ],
    },
    {
      id: 'q1-end',
      chapter: { en: 'To the end, and again', es: 'Hasta el final, y otra vez' },
      steps: [
        {
          id: 'q1-end-ask',
          anchorId: 'listen-play',
          act: 'ask',
          question: {
            en: 'The story ends. Where is the replay button?',
            es: 'La historia termina. ¿Dónde está el botón de repetir?',
          },
        },
        {
          id: 'q1-end-say',
          anchorId: 'listen-play',
          act: 'say',
          text: {
            en: 'There is none: Play itself starts it over.',
            es: 'No existe: el mismo botón Reproducir lo reinicia.',
          },
        },
        {
          id: 'q1-end-tap',
          anchorId: 'listen-play',
          effectAnchorId: 'listen-reader',
          act: 'tap',
          payload: { param: TEXT_EN.id },
          text: {
            en: 'From the end, Play returns to sentence one.',
            es: 'Desde el final, Reproducir vuelve a la primera frase.',
          },
        },
        {
          id: 'q1-end-close',
          anchorId: 'listen-page',
          act: 'say',
          text: {
            en: 'One minute, and you can hear anything here.',
            es: 'Un minuto, y ya puedes escuchar cualquier cosa aquí.',
          },
        },
      ],
    },
  ],
}

export default Q1
