/**
 * Q2 · La burbuja / The Bubble — the heart Oscar named when he opened this
 * lane: tap the λ, let the bubble out, and let a copied text take the stage.
 *
 * Coverage (PLAN §2.5 — Q2 owns 14 census items): A-11 · B-1, B-2, B-3, B-7,
 * B-10, B-13, B-14, B-16, B-18, B-19, B-22, B-24 · F-39. The near-edge snap
 * (B-8's nuance) rides inside the drag beat, as the module brief orders;
 * B-8's own full lesson stays AD1's. The stage lock is NAMED here as a
 * promise only (final steps of scene 4, optional) — its lesson is AD1's.
 *
 * Staging (OQ-1, as ruled): panel and orb beats act on the sealed fiction
 * stage (`bubble-stage-*` anchors); native beats name their web↔shell
 * contract anchors. The ONE real touch is the λ itself, performed through
 * the scenario port's LambdaPort discipline (scenario-port.ts). Declared
 * `surfaces: ['android']`: in a browser there is no bubble, and the index
 * explains that instead of pretending (OQ-3, census B-4).
 *
 * Performed scenario verbs (via the default scenario port), in play order:
 * the λ tap (setLambda) · the harbour text (goto with the fiction text id)
 * · the lever (tap on `bubble-clip` → playClipboardText) · the Undo (key
 * 'Undo' on `bubble-clip` → undoReplace) · Play again (the same goto) ·
 * the lever a second time · one sentence advance (`listen-next`). The
 * return-to-interrupted beat is narrated on `bubble-clip` while the stage
 * host completes the clip — the sandbox's finishCurrent, proven as P1
 * choreography by Fence 0. The Undo is performed in the FIRST cycle on
 * purpose: a replace only arms its Undo against the draft it replaced, so
 * the script never asks the sandbox to undo across a return.
 *
 * WORDING LAW — PLAN §2.6 bench item 1: the replacement's Undo restores the
 * previous text LOADED AND PAUSED; the real code (bubble.ts:126–132) has no
 * play() call on that path. Captions here promise "the text comes back,
 * loaded and waiting" — NEVER that it plays again — and the very next beat
 * makes the learner press Play, so the truth is acted, not just said. The
 * auto-return (B-19) is a different mechanism and DOES resume playing; the
 * two are never worded as one.
 */
import type { PresentationModule } from '../engine/types.ts'

export const Q2: PresentationModule = {
  id: 'Q2',
  floor: 'quick',
  title: { en: 'The Bubble', es: 'La burbuja' },
  capability: {
    en: 'Float the bubble from the λ, place it anywhere, and make anything you copy anywhere play with a single tap — then return to your reading.',
    es: 'Suelta la burbuja desde la λ, colócala donde quieras y haz que lo que copies en cualquier app suene con un solo toque — y luego vuelve a tu lectura.',
  },
  surfaces: ['android'],
  verifiedAgainst: '1.4.156',
  scenes: [
    {
      id: 'let-her-out',
      chapter: { en: 'Let her out', es: 'Suéltala' },
      steps: [
        {
          id: 's1-ask-lambda',
          anchorId: 'bubble-lambda',
          act: 'ask',
          question: { en: 'What does tapping this λ do?', es: '¿Qué pasa al tocar esta λ?' },
        },
        {
          id: 's1-tap-lambda',
          anchorId: 'bubble-lambda',
          act: 'tap',
          text: {
            en: 'One tap, and Logos floats over your other apps.',
            es: 'Un toque, y Logos flota sobre tus demás aplicaciones.',
          },
        },
        {
          id: 's1-gold-dot',
          anchorId: 'bubble-state',
          act: 'say',
          text: {
            en: 'The gold dot on the λ says she is out.',
            es: 'El punto dorado sobre la λ dice que está fuera.',
          },
        },
        {
          id: 's1-tap-again',
          anchorId: 'bubble-lambda',
          act: 'say',
          text: {
            en: 'Tap it again and the bubble comes back in.',
            es: 'Tócala otra vez y la burbuja vuelve a entrar.',
          },
        },
        {
          id: 's1-permission-door',
          anchorId: 'bubble-permission',
          act: 'say',
          text: {
            en: "No permission yet? The λ takes you to Android's switch.",
            es: '¿Aún sin permiso? La λ te lleva al interruptor de Android.',
          },
        },
        {
          id: 's1-permission-return',
          anchorId: 'bubble-permission',
          act: 'say',
          text: {
            en: 'Allow it, come back, and tap the λ again.',
            es: 'Permítelo, vuelve y toca la λ otra vez.',
          },
        },
      ],
    },
    {
      id: 'move-and-tap',
      chapter: { en: 'Move her, tap her', es: 'Muévela y tócala' },
      steps: [
        {
          id: 's2-meet',
          anchorId: 'bubble-stage-orb',
          act: 'say',
          text: {
            en: 'The bubble floats over any app — your reading follows you out.',
            es: 'La burbuja flota sobre cualquier app: tu lectura te sigue fuera.',
          },
        },
        {
          id: 's2-greeting',
          anchorId: 'bubble-stage-orb',
          act: 'say',
          text: {
            en: 'As you leave Logos, her halo greets you.',
            es: 'Al salir de Logos, su halo te saluda.',
          },
        },
        {
          id: 's2-drag',
          anchorId: 'bubble-stage-orb',
          act: 'tap',
          text: {
            en: 'Drag her anywhere; she stays where your hand leaves her.',
            es: 'Arrástrala donde quieras; se queda donde tu mano la deja.',
          },
        },
        {
          id: 's2-snap',
          anchorId: 'bubble-stage-orb',
          act: 'say',
          text: {
            en: 'Drop her near an edge and she settles against it.',
            es: 'Suéltala cerca de un borde y se acomoda contra él.',
          },
        },
        {
          id: 's2-open-panel',
          anchorId: 'bubble-stage-orb',
          act: 'tap',
          text: {
            en: 'Tap her and the panel opens: your reading, in miniature.',
            es: 'Tócala y se abre el panel: tu lectura, en miniatura.',
          },
        },
        {
          id: 's2-close-panel',
          anchorId: 'bubble-stage-orb',
          act: 'say',
          text: {
            en: 'Tap outside and the panel folds away again.',
            es: 'Toca fuera y el panel se pliega otra vez.',
          },
        },
      ],
    },
    {
      id: 'copy-tap-listen',
      chapter: { en: 'Copy, tap, listen', es: 'Copia, toca, escucha' },
      steps: [
        {
          id: 's3-setup-playing',
          anchorId: 'listen-page',
          act: 'goto',
          payload: { param: 'scenario:text-harbour-morning' },
          text: {
            en: 'First, a harbour text is playing inside Logos.',
            es: 'Primero, un texto del puerto está sonando en Logos.',
          },
        },
        {
          id: 's3-another-app',
          anchorId: 'bubble-stage-orb',
          act: 'say',
          text: {
            en: 'Now picture another app, where you copy this note.',
            es: 'Ahora imagina otra aplicación, donde copias esta nota.',
          },
        },
        {
          id: 's3-ask',
          anchorId: 'bubble-clip',
          act: 'ask',
          question: { en: 'You tap the bubble. What happens?', es: 'Tocas la burbuja. ¿Qué pasa?' },
        },
        {
          id: 's3-tap-bubble',
          anchorId: 'bubble-clip',
          act: 'tap',
          text: {
            en: 'The panel opens and reads what you copied.',
            es: 'El panel se abre y lee lo que copiaste.',
          },
        },
        {
          id: 's3-no-paste-key',
          anchorId: 'bubble-clip',
          act: 'say',
          text: {
            en: 'There is no Paste key: opening the panel is the request.',
            es: 'No hay tecla de pegar: abrir el panel ya es pedirlo.',
          },
        },
        {
          id: 's3-replaces',
          anchorId: 'bubble-clip',
          act: 'say',
          text: {
            en: 'The copied note replaces what was playing.',
            es: 'La nota copiada reemplaza lo que estaba sonando.',
          },
        },
        {
          id: 's3-undo-toast',
          anchorId: 'shell-toast-region',
          act: 'say',
          text: {
            en: 'A toast offers Undo for six seconds.',
            es: 'Un aviso ofrece Deshacer durante seis segundos.',
          },
        },
        {
          id: 's3-reader-took-stage',
          anchorId: 'listen-page',
          act: 'say',
          text: {
            en: 'Inside Logos, the reader already shows the copied note.',
            es: 'Dentro de Logos, el lector ya muestra la nota copiada.',
          },
        },
        {
          id: 's3-undo-tap',
          anchorId: 'bubble-clip',
          act: 'key',
          payload: { key: 'Undo' },
          text: {
            en: 'Tap Undo in the toast.',
            es: 'Toca Deshacer en el aviso.',
          },
        },
        {
          id: 's3-undo-truth',
          anchorId: 'bubble-clip',
          act: 'say',
          text: {
            en: 'Your harbour text comes back, loaded and waiting.',
            es: 'Tu texto del puerto vuelve, cargado y en espera.',
          },
        },
        {
          id: 's3-undo-not-sound',
          anchorId: 'bubble-clip',
          act: 'say',
          text: {
            en: 'Undo returns the text, not the sound.',
            es: 'Deshacer devuelve el texto, no el sonido.',
          },
        },
        {
          id: 's3-play-again',
          anchorId: 'listen-page',
          act: 'goto',
          payload: { param: 'scenario:text-harbour-morning' },
          text: {
            en: 'One Play, and the harbour text reads on.',
            es: 'Un toque en Reproducir, y el texto sigue.',
          },
        },
        {
          id: 's3-copy-again',
          anchorId: 'bubble-stage-orb',
          act: 'say',
          text: {
            en: 'Copy the note once more, and tap the bubble.',
            es: 'Copia la nota otra vez y toca la burbuja.',
          },
        },
        {
          id: 's3-replace-again',
          anchorId: 'bubble-clip',
          act: 'tap',
          text: {
            en: 'The note takes the stage again.',
            es: 'La nota ocupa la escena otra vez.',
          },
        },
        {
          id: 's3-advance-clip',
          anchorId: 'listen-next',
          act: 'tap',
          text: {
            en: 'The note is short: two sentences, and it ends.',
            es: 'La nota es corta: dos frases, y termina.',
          },
        },
        {
          id: 's3-return',
          anchorId: 'bubble-clip',
          act: 'say',
          text: {
            en: 'When the note ends, your harbour text returns by itself.',
            es: 'Cuando la nota termina, tu texto del puerto vuelve solo.',
          },
        },
        {
          id: 's3-return-place',
          anchorId: 'bubble-clip',
          act: 'say',
          text: {
            en: 'It picks up at the very sentence it left.',
            es: 'Retoma en la misma frase donde lo dejó.',
          },
        },
        {
          id: 's3-return-limit',
          anchorId: 'bubble-clip',
          act: 'say',
          text: {
            en: 'Load something else yourself, and that return is cancelled.',
            es: 'Si cargas otra cosa tú mismo, esa vuelta se cancela.',
          },
        },
        {
          id: 's3-screen-off',
          anchorId: 'bubble-push-playing',
          act: 'say',
          text: {
            en: 'Lock the phone now: the reading still arrives.',
            es: 'Bloquea el teléfono ahora: la lectura llega igual.',
          },
        },
      ],
    },
    {
      id: 'lever-and-privacy',
      chapter: { en: 'The lever, and never in secret', es: 'La palanca, y nunca en secreto' },
      steps: [
        {
          id: 's4-lever-off',
          anchorId: 'bubble-lever',
          act: 'say',
          text: {
            en: 'Lever off, the bubble only takes play, previous, next.',
            es: 'Con la palanca bajada, la burbuja solo obedece reproducir, anterior, siguiente.',
          },
        },
        {
          id: 's4-lever-off-2',
          anchorId: 'bubble-lever',
          act: 'say',
          text: {
            en: 'Nothing gets read until you turn Auto back on.',
            es: 'Nada se lee hasta que vuelves a encender Auto.',
          },
        },
        {
          id: 's4-three-moments',
          anchorId: 'bubble-arrival',
          act: 'say',
          text: {
            en: "Logos reads the clipboard only at your tap, the panel's focus, or your arrival.",
            es: 'Logos lee el portapapeles solo al tocar, al enfocar el panel o al llegar.',
          },
        },
        {
          id: 's4-never-secret',
          anchorId: 'bubble-clip',
          act: 'say',
          text: {
            en: 'Between your taps, Logos never peeks at the clipboard.',
            es: 'Entre tus toques, Logos nunca espía el portapapeles.',
          },
        },
        {
          id: 's4-lock-promise',
          anchorId: 'bubble-stage-lock',
          act: 'say',
          optional: true,
          text: {
            en: "A lock in the panel guards what's playing; its whole lesson waits in AD1.",
            es: 'Un candado del panel protege lo que suena; su lección entera espera en AD1.',
          },
        },
        {
          id: 's4-close',
          anchorId: 'bubble-lambda',
          act: 'say',
          text: {
            en: 'That is the bubble: out with one tap, home with another.',
            es: 'Esa es la burbuja: sale con un toque, vuelve con otro.',
          },
        },
      ],
    },
  ],
}

export default Q2
