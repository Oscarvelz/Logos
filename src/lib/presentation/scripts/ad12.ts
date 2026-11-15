/**
 * AD12 · Fuera de la app / Outside the App — what Logos promises on surfaces
 * it does not draw: the system media card, the bubble's own notification,
 * and the media keys.
 *
 * Coverage (PLAN §2.5 — AD12 owns 9 census items): A-57 · B-15, B-53, B-54,
 * B-55, B-56, B-57, B-60 · F-51. B-59 (the ghost visit) rides inside B-57 as
 * its one narrated context, per PLAN §2.5 — the mechanism itself is
 * NO-SCENE; only its possible visible symptom is taught, with no anchor of
 * its own (ANCHOR-REGISTRY §6): the beat sits on `media-actions`, the door
 * whose stored command pays the visit.
 *
 * Staging: every surface in this module is drawn by Android, not by Logos,
 * so nothing here is performed — the beats NARRATE at their contract seats
 * (`media-card`, `media-actions`, `media-session-active`, `media-dismissal`,
 * `bubble-native-floor`), exactly as the census rules (NARRATE for the whole
 * front). The only performed step is the opening `goto`, which loads the
 * fiction text through the scenario port so a reading is playing on stage.
 * Declared `surfaces: ['android']`: in a browser none of this exists, and
 * the index explains that instead of pretending (OQ-3).
 *
 * B-15's seat: the registry carries no row of its own for the bubble's
 * notification — its contract is the bubble service's own on/off door, so
 * its beats ride `bubble-state`, the running-state face of that same
 * service. Its Hide action carries a WORD, not an icon, and the captions
 * say so.
 *
 * WORDING LAWS kept in the words themselves:
 * — B-54: the card's glyphs are ANDROID's own drawings. The captions teach
 *   the BEHAVIOUR (one sentence step) and never describe a drawing Logos
 *   does not own (the plan's §1 phrasing was corrected by the census).
 * — B-56: the paused card cannot be swiped away — system law, stated
 *   plainly WITH its why (it is the price of a lock-screen Play that always
 *   works), so the learner never reads it as a Logos defect. The house
 *   phrase governs: paused, Android rules; over silence, it never stays.
 * — B-60 BENCH HEDGE (PLAN §2.6 item 5): the rescue is NARRATED ONLY and
 *   no figure is promised anywhere — the code's stall timings stay
 *   unwritten until the bench proves them. What the captions promise is
 *   only what the code guarantees: the phone's voice takes over, it
 *   returns by itself when Logos' voice flows, and a stop of yours is
 *   final — no rescue ever undoes it.
 */
import type { PresentationModule } from '../engine/types.ts'

export const AD12: PresentationModule = {
  id: 'AD12',
  floor: 'advanced',
  title: { en: 'Outside the App', es: 'Fuera de la app' },
  capability: {
    en: 'Know what Logos promises outside the app — the system media card, the notification, and the media keys — and what it cannot promise.',
    es: 'Sabe lo que Logos promete fuera de la app — la tarjeta multimedia del sistema, la notificación y las teclas de medios — y lo que no puede prometer.',
  },
  surfaces: ['android'],
  verifiedAgainst: '1.4.156',
  scenes: [
    {
      id: 'the-system-media-card',
      chapter: { en: 'The system media card', es: 'La tarjeta multimedia del sistema' },
      steps: [
        {
          id: 's1-setup-playing',
          anchorId: 'listen-page',
          act: 'goto',
          payload: { param: 'scenario:text-harbour-morning' },
          text: {
            en: 'First, a reading is playing inside Logos.',
            es: 'Primero, una lectura está sonando dentro de Logos.',
          },
        },
        {
          id: 's1-ask-where',
          anchorId: 'media-card',
          act: 'ask',
          question: {
            en: 'Where does your reading live outside Logos?',
            es: '¿Dónde vive tu lectura fuera de Logos?',
          },
        },
        {
          id: 's1-card-carries-it',
          anchorId: 'media-card',
          act: 'say',
          text: {
            en: 'On the lock screen, a card carries it.',
            es: 'En la pantalla de bloqueo, una tarjeta la lleva.',
          },
        },
        {
          id: 's1-title-is-the-book',
          anchorId: 'media-card',
          act: 'say',
          text: {
            en: 'Its title is your book, never a loose sentence.',
            es: 'Su título es tu libro, nunca una frase suelta.',
          },
        },
        {
          id: 's1-no-book-sentence-titles',
          anchorId: 'media-card',
          act: 'say',
          text: {
            en: 'With no book, the sentence itself becomes the title.',
            es: 'Sin libro, la propia frase se vuelve el título.',
          },
        },
        {
          id: 's1-house-art',
          anchorId: 'media-card',
          act: 'say',
          text: {
            en: "Its face is Logos' own artwork — spot it among other apps.",
            es: 'Su cara es el arte propio de Logos: reconócelo entre otras apps.',
          },
        },
        {
          id: 's1-session-sleeps',
          anchorId: 'media-session-active',
          act: 'say',
          text: {
            en: "While paused, the card's session sleeps.",
            es: 'En pausa, la sesión de la tarjeta duerme.',
          },
        },
        {
          id: 's1-no-foreign-play',
          anchorId: 'media-session-active',
          act: 'say',
          text: {
            en: 'No foreign play can wake it; yours always can.',
            es: 'Ningún play ajeno la despierta; el tuyo, siempre.',
          },
        },
        {
          id: 's1-cannot-swipe',
          anchorId: 'media-dismissal',
          act: 'say',
          text: {
            en: 'Paused, you cannot swipe the card away.',
            es: 'En pausa, no puedes barrer la tarjeta.',
          },
        },
        {
          id: 's1-swipe-why',
          anchorId: 'media-dismissal',
          act: 'say',
          text: {
            en: "That is Android's price for a lock-screen play that always works.",
            es: 'Es el precio de Android por un play de bloqueo que siempre funciona.',
          },
        },
        {
          id: 's1-leaves-by-itself',
          anchorId: 'media-dismissal',
          act: 'say',
          text: {
            en: 'Finished or closed, it leaves by itself.',
            es: 'Terminada o cerrada, se va sola.',
          },
        },
      ],
    },
    {
      id: 'the-bubbles-own-notification',
      chapter: { en: 'The bubble’s own notification', es: 'La notificación propia de la burbuja' },
      steps: [
        {
          id: 's2-notification-waits',
          anchorId: 'bubble-state',
          act: 'say',
          text: {
            en: 'While the bubble floats, its own notification waits.',
            es: 'Mientras la burbuja flota, su propia notificación espera.',
          },
        },
        {
          id: 's2-notification-name',
          anchorId: 'bubble-state',
          act: 'say',
          text: {
            en: 'It waits in the shade: Logos bubble.',
            es: 'Espera en la cortina: «Logos bubble».',
          },
        },
        {
          id: 's2-tap-enters',
          anchorId: 'bubble-state',
          act: 'say',
          text: {
            en: 'Tap it, and you enter Logos.',
            es: 'Tócala, y entras en Logos.',
          },
        },
        {
          id: 's2-one-action-a-word',
          anchorId: 'bubble-state',
          act: 'say',
          text: {
            en: 'Its one action is a word: Hide bubble.',
            es: 'Su única acción es una palabra: «Hide bubble».',
          },
        },
        {
          id: 's2-hide-goes-home',
          anchorId: 'bubble-state',
          act: 'say',
          text: {
            en: 'Tap it, and the bubble goes home.',
            es: 'Tócala, y la burbuja se recoge.',
          },
        },
      ],
    },
    {
      id: 'media-keys-speak-in-sentences',
      chapter: { en: 'Media keys speak in sentences', es: 'Las teclas de medios hablan en frases' },
      steps: [
        {
          id: 's3-ask-buttons',
          anchorId: 'media-actions',
          act: 'ask',
          question: {
            en: 'What do its back and forward buttons do?',
            es: '¿Qué hacen sus botones de atrás y adelante?',
          },
        },
        {
          id: 's3-one-sentence',
          anchorId: 'media-actions',
          act: 'say',
          text: {
            en: 'Each one steps exactly one sentence.',
            es: 'Cada uno pisa exactamente una frase.',
          },
        },
        {
          id: 's3-never-another-track',
          anchorId: 'media-actions',
          act: 'say',
          text: {
            en: 'Never another book, never another track.',
            es: 'Nunca otro libro, nunca otra pista.',
          },
        },
        {
          id: 's3-glyphs-are-androids',
          anchorId: 'media-actions',
          act: 'say',
          text: {
            en: "Their drawings are Android's own; Logos declares the step.",
            es: 'Sus dibujos son de Android; Logos declara el paso.',
          },
        },
        {
          id: 's3-headset-keys',
          anchorId: 'listen-player-meta',
          act: 'say',
          text: {
            en: 'Your headset keys speak sentences too.',
            es: 'Las teclas de tus auriculares también hablan en frases.',
          },
        },
        {
          id: 's3-next-track-means-sentence',
          anchorId: 'listen-player-meta',
          act: 'say',
          text: {
            en: 'Next track means next sentence, here.',
            es: 'Pista siguiente significa frase siguiente, aquí.',
          },
        },
        {
          id: 's3-recording-fifteen-seconds',
          anchorId: 'media-actions',
          act: 'say',
          text: {
            en: 'When a recording holds the stage, they walk fifteen seconds.',
            es: 'Cuando una grabación tiene la escena, caminan quince segundos.',
          },
        },
        {
          id: 's3-tap-card-opens',
          anchorId: 'media-actions',
          act: 'say',
          text: {
            en: 'Tap the card itself, and Logos opens.',
            es: 'Toca la tarjeta misma, y Logos se abre.',
          },
        },
        {
          id: 's3-keys-arrive',
          anchorId: 'media-actions',
          act: 'say',
          text: {
            en: 'Its keys arrive even if Android retired the app.',
            es: 'Sus teclas llegan aunque Android haya retirado la app.',
          },
        },
        {
          id: 's3-ghost-breath',
          anchorId: 'media-actions',
          act: 'say',
          text: {
            en: 'You may glimpse Logos breathe for an instant.',
            es: 'Quizá veas a Logos respirar un instante.',
          },
        },
        {
          id: 's3-ghost-leaves',
          anchorId: 'media-actions',
          act: 'say',
          text: {
            en: 'It leaves alone, and your place never changes.',
            es: 'Se va solo, y tu sitio nunca cambia.',
          },
        },
      ],
    },
    {
      id: 'the-rescue-narrated',
      chapter: { en: 'The rescue, narrated', es: 'El rescate, narrado' },
      steps: [
        {
          id: 's4-stall-not-abandoned',
          anchorId: 'bubble-native-floor',
          act: 'say',
          text: {
            en: "If Logos' voice stalls, the reading is not abandoned.",
            es: 'Si la voz de Logos se atasca, la lectura no se abandona.',
          },
        },
        {
          id: 's4-phone-voice-takes-over',
          anchorId: 'bubble-native-floor',
          act: 'say',
          text: {
            en: "Your phone's own voice takes over the text.",
            es: 'La voz de tu teléfono se hace cargo del texto.',
          },
        },
        {
          id: 's4-it-is-logos-rescuing',
          anchorId: 'bubble-native-floor',
          act: 'say',
          text: {
            en: 'That change is Logos rescuing, not another app.',
            es: 'Ese cambio es Logos rescatando, no otra aplicación.',
          },
        },
        {
          id: 's4-voice-returns-alone',
          anchorId: 'bubble-native-floor',
          act: 'say',
          text: {
            en: "When Logos' voice flows again, it returns alone.",
            es: 'Cuando la voz de Logos fluye otra vez, vuelve sola.',
          },
        },
        {
          id: 's4-your-stop-is-final',
          anchorId: 'bubble-native-floor',
          act: 'say',
          text: {
            en: 'Your own stop stays final; no rescue undoes it.',
            es: 'Tu parada es final; ningún rescate la deshace.',
          },
        },
      ],
    },
    {
      id: 'what-each-button-can-promise',
      chapter: { en: 'What each button can promise', es: 'Lo que cada botón puede prometer' },
      steps: [
        {
          id: 's5-ask-promises',
          anchorId: 'media-actions',
          act: 'ask',
          question: {
            en: 'So, what can each button promise?',
            es: 'Entonces, ¿qué puede prometer cada botón?',
          },
        },
        {
          id: 's5-play-promises',
          anchorId: 'media-actions',
          act: 'say',
          text: {
            en: 'Play promises this reading, at your tap.',
            es: 'Play promete esta lectura, a tu toque.',
          },
        },
        {
          id: 's5-step-promises',
          anchorId: 'media-actions',
          act: 'say',
          text: {
            en: 'Previous and next promise one sentence, exactly.',
            es: 'Anterior y siguiente prometen una frase, exacta.',
          },
        },
        {
          id: 's5-pause-promises',
          anchorId: 'media-session-active',
          act: 'say',
          text: {
            en: 'Pause promises silence until you return.',
            es: 'Pausa promete silencio hasta que tú vuelvas.',
          },
        },
        {
          id: 's5-cannot-promise-swipe',
          anchorId: 'media-dismissal',
          act: 'say',
          text: {
            en: 'The card cannot promise a swipe while paused.',
            es: 'La tarjeta no puede prometer un barrido en pausa.',
          },
        },
        {
          id: 's5-drawings-not-logos',
          anchorId: 'media-card',
          act: 'say',
          text: {
            en: 'And its drawings belong to Android, never to Logos.',
            es: 'Y sus dibujos son de Android, nunca de Logos.',
          },
        },
      ],
    },
  ],
}

export default AD12
