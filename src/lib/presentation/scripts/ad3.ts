/**
 * AD3 — «El lector a fondo / The Reader in Depth» (Advanced floor).
 *
 * The reader, taken apart calmly: its TWO lights (the sentence band and
 * the word light are different mechanisms with different switches), the
 * text-size ladder and the word clock that keeps the light married to
 * the sound on Bluetooth ears, the seek bar whose tip tells the truth
 * about readiness, Edit as a visit rather than an execution, immersive
 * listening and its pin, and finally the mini player plus the three
 * keyboard doors.
 *
 * Census ownership (PLAN §2.5 — AD3 owns 26 items):
 * A-7 the × back to reading view · A-19 the scrubber's honest tip ·
 * A-20 the focused bar's own arrows · A-23 Enter on a focused sentence ·
 * A-27 A−/A+ and the size ladder · A-29 Edit never ends the session ·
 * A-30 the visualizer as a diagnostic · A-50 immersive listening ·
 * A-51 the pin that exists only while playing · A-52 the transport-only
 * mini player · A-53 its body tap opens Listen · A-55 Space · A-56 the
 * window arrows · E-23 the sentence-highlight switch · E-24 the reader
 * size stepper · E-25 word timing · F-14 when the mini appears ·
 * F-15 transport only, by Oscar's law · F-16 the mini's body tap ·
 * F-18 what immersive looks like · F-19 the pin as the way back ·
 * F-38 Escape closes the sheet · F-46 the window keyboard trio ·
 * F-47 the focused bar's arrows · F-48 Enter on a sentence ·
 * F-50 Enter confirms, the house grammar.
 * Narrated inside their hosts, never given scenes of their own:
 * A-54 (inside A-52: the mini's hairline is a rough glance — its number
 * is never taught) · F-49 (inside F-38: beyond the sheet, no Escape
 * staircase exists in the web app).
 *
 * Bench hedges honoured (PLAN §2.6): item 2 — the scrubber tip is
 * taught BY MEANING in both languages; its exact Spanish wording is
 * never quoted. Item 3 — the device-voice tap is stated only as far as
 * the code proves: it degrades to the whole sentence (listen.ts); no
 * bench-acted claim is made. The pin is anchored only in a playing
 * stage, exactly as its registry record demands.
 *
 * Performed acts go through the scenario port only: Play names its
 * fiction text by id (payload.param); every other act is a stage
 * gesture. All staged material is fiction.ts — never user data.
 * Title and capability are the catalogue's words, verbatim.
 */
import { TEXT_EN } from '../scenario/fiction.ts'
import type { PresentationModule } from '../engine/types.ts'

export const AD3: PresentationModule = {
  id: 'AD3',
  floor: 'advanced',
  title: { en: 'The Reader in Depth', es: 'El lector a fondo' },
  capability: {
    en: 'Read your way: set the text size and the two lights, seek honestly with the bar, edit without losing the session, and listen immersively.',
    es: 'Lee a tu manera: ajusta el tamaño del texto y las dos luces, busca con honestidad en la barra, edita sin perder la sesión y escucha en modo inmersivo.',
  },
  verifiedAgainst: '1.4.156',
  scenes: [
    {
      id: 'two-kinds-of-light',
      chapter: { en: 'Two kinds of light', es: 'Dos clases de luz' },
      steps: [
        {
          id: 'ad3-play-fiction',
          anchorId: 'listen-play',
          effectAnchorId: 'listen-reader',
          act: 'tap',
          payload: { param: TEXT_EN.id },
          establishes: 'scenario-session-playing',
          text: {
            en: 'Our harbour story starts playing; watch its sentences.',
            es: 'Nuestra historia del puerto empieza a sonar; mira sus frases.',
          },
        },
        {
          id: 'ad3-sentence-light',
          anchorId: 'listen-reader-sentence:1',
          act: 'say',
          text: {
            en: 'The sentence being read wears a band of light.',
            es: 'La frase que se está leyendo lleva una banda de luz.',
          },
        },
        {
          id: 'ad3-past-sentences',
          anchorId: 'listen-reader',
          act: 'say',
          text: {
            en: 'Sentences already read rest dimmer behind it.',
            es: 'Las frases ya leídas descansan más tenues detrás.',
          },
        },
        {
          id: 'ad3-word-light',
          anchorId: 'listen-reader-sentence:1',
          act: 'say',
          text: {
            en: 'Inside it, every word lights as the voice speaks.',
            es: 'Dentro, cada palabra se ilumina cuando la voz la dice.',
          },
        },
        {
          id: 'ad3-wave-moves',
          anchorId: 'listen-visualizer',
          act: 'say',
          text: {
            en: 'The living wave moves only while the neural voice sounds.',
            es: 'La onda viva solo se mueve mientras suena la voz neuronal.',
          },
        },
        {
          id: 'ad3-wave-clue',
          anchorId: 'listen-visualizer',
          act: 'say',
          text: {
            en: 'A still wave with moving numbers is itself a clue.',
            es: 'Una onda quieta con números moviéndose ya es una pista.',
          },
        },
        {
          id: 'ad3-goto-settings',
          anchorId: 'shell-nav:settings',
          act: 'goto',
          text: {
            en: 'The sentence light has a switch, in Settings.',
            es: 'La luz de la frase tiene un interruptor, en Ajustes.',
          },
        },
        {
          id: 'ad3-highlight-off',
          anchorId: 'set-highlight',
          effectAnchorId: 'listen-reader',
          act: 'tap',
          text: {
            en: 'Inside Playback, this switch turns the sentence light off.',
            es: 'Dentro de Reproducción, este interruptor apaga la luz de frase.',
          },
        },
        {
          id: 'ad3-back-to-listen',
          anchorId: 'shell-nav:listen',
          act: 'goto',
          text: {
            en: 'Back in Listen, look at the same sentence.',
            es: 'De vuelta en Escuchar, mira la misma frase.',
          },
        },
        {
          id: 'ad3-light-gone',
          anchorId: 'listen-reader',
          act: 'say',
          text: {
            en: 'The band is gone; the word light still travels.',
            es: 'La banda desapareció; la luz de palabra sigue viajando.',
          },
        },
        {
          id: 'ad3-restore-goto',
          anchorId: 'shell-nav:settings',
          act: 'goto',
          text: {
            en: 'The two lights are separate, always.',
            es: 'Las dos luces son independientes, siempre.',
          },
        },
        {
          id: 'ad3-highlight-on',
          anchorId: 'set-highlight',
          effectAnchorId: 'listen-reader',
          act: 'tap',
          text: {
            en: 'Switch it back on: nothing else changed.',
            es: 'Vuelve a encenderla: nada más cambió.',
          },
        },
        {
          id: 'ad3-light-home',
          anchorId: 'shell-nav:listen',
          act: 'goto',
          text: {
            en: 'And the reader wears its light again.',
            es: 'Y el lector lleva su luz otra vez.',
          },
        },
      ],
    },
    {
      id: 'text-size-and-the-word-clock',
      chapter: { en: 'Text size and the word clock', es: 'Tamaño del texto y la sincronía de la palabra' },
      steps: [
        {
          id: 'ad3-size-ask',
          anchorId: 'listen-reader-head',
          act: 'ask',
          question: {
            en: 'Are these words smaller than you would like?',
            es: '¿Estas palabras se ven más pequeñas de lo deseado?',
          },
        },
        {
          id: 'ad3-bigger',
          anchorId: 'listen-text-bigger',
          effectAnchorId: 'listen-reader',
          act: 'tap',
          text: {
            en: 'Tapping A+ steps the size up one rung.',
            es: 'Tocar A+ sube el tamaño un escalón.',
          },
        },
        {
          id: 'ad3-size-whole',
          anchorId: 'listen-reader',
          act: 'say',
          text: {
            en: 'The whole reader grows at once, every paragraph.',
            es: 'Todo el lector crece a la vez, cada párrafo.',
          },
        },
        {
          id: 'ad3-ladder',
          anchorId: 'listen-text-smaller',
          act: 'say',
          text: {
            en: 'Eight rungs from small to double; the ends stop.',
            es: 'Ocho escalones, de pequeño al doble; los extremos paran.',
          },
        },
        {
          id: 'ad3-smaller',
          anchorId: 'listen-text-smaller',
          effectAnchorId: 'listen-reader',
          act: 'tap',
          text: {
            en: 'A− steps back down, one rung at a time.',
            es: 'A− baja de nuevo, un escalón cada vez.',
          },
        },
        {
          id: 'ad3-size-settings-goto',
          anchorId: 'shell-nav:settings',
          act: 'goto',
          text: {
            en: 'The same ladder lives in Settings, under Playback.',
            es: 'La misma escalera vive en Ajustes, en Reproducción.',
          },
        },
        {
          id: 'ad3-size-stepper',
          anchorId: 'set-reader-size-plus',
          effectAnchorId: 'listen-reader',
          act: 'tap',
          text: {
            en: 'This stepper walks exactly that same ladder.',
            es: 'Este control recorre exactamente esa misma escalera.',
          },
        },
        {
          id: 'ad3-size-percent',
          anchorId: 'set-reader-size',
          act: 'say',
          text: {
            en: 'The row shows the percentage while you change it.',
            es: 'La fila muestra el porcentaje mientras lo cambias.',
          },
        },
        {
          id: 'ad3-timing-plus',
          anchorId: 'set-word-timing-plus',
          effectAnchorId: 'listen-reader',
          act: 'tap',
          text: {
            en: 'Word timing, stepped up: the light lands earlier.',
            es: 'Sincronía de la palabra, subida: la luz llega antes.',
          },
        },
        {
          id: 'ad3-timing-row',
          anchorId: 'set-word-timing',
          act: 'say',
          text: {
            en: 'The row names it: earlier, tuned for Bluetooth delay.',
            es: 'La fila lo nombra: antes, pensado para el retardo Bluetooth.',
          },
        },
        {
          id: 'ad3-timing-home',
          anchorId: 'shell-nav:listen',
          act: 'goto',
          text: {
            en: 'Through Bluetooth ears, light and voice meet again.',
            es: 'Con audífonos Bluetooth, luz y voz vuelven a encontrarse.',
          },
        },
        {
          id: 'ad3-tap-word',
          anchorId: 'listen-reader-sentence:2',
          effectAnchorId: 'listen-reader',
          act: 'tap',
          text: {
            en: 'Tap a word: the voice lands just before it.',
            es: 'Toca una palabra: la voz aterriza justo antes.',
          },
        },
        {
          id: 'ad3-tap-device',
          anchorId: 'listen-reader-sentence:2',
          act: 'say',
          text: {
            en: 'With the device voice, the tap takes the whole sentence.',
            es: 'Con la voz del dispositivo, el toque toma la frase entera.',
          },
        },
        {
          id: 'ad3-enter',
          anchorId: 'listen-reader-sentence:3',
          effectAnchorId: 'listen-reader',
          act: 'key',
          payload: { key: 'Enter' },
          text: {
            en: 'A focused sentence, then Enter: reading starts there.',
            es: 'Una frase enfocada y Enter: la lectura empieza ahí.',
          },
        },
      ],
    },
    {
      id: 'the-seek-bar-tells-the-truth',
      chapter: { en: 'The seek bar tells the truth', es: 'La barra de búsqueda dice la verdad' },
      steps: [
        {
          id: 'ad3-seek-ask',
          anchorId: 'listen-scrubber',
          act: 'ask',
          question: {
            en: 'Half heard, but you need an earlier sentence?',
            es: '¿Vas por la mitad y necesitas una frase anterior?',
          },
        },
        {
          id: 'ad3-seek-drag',
          anchorId: 'listen-scrubber',
          effectAnchorId: 'listen-reader',
          act: 'tap',
          text: {
            en: 'Drag the bar: the place moves by sentences.',
            es: 'Arrastra la barra: el lugar se mueve por frases.',
          },
        },
        {
          id: 'ad3-seek-layers',
          anchorId: 'listen-scrubber',
          act: 'say',
          text: {
            en: 'Two fills run together: played, and paler prepared audio.',
            es: 'Dos rellenos corren juntos: lo sonado y el audio preparado.',
          },
        },
        {
          id: 'ad3-seek-tip',
          anchorId: 'listen-scrubber',
          act: 'say',
          text: {
            en: 'While dragging, a tip names the sentence underneath.',
            es: 'Al arrastrar, una punta nombra la frase bajo tu dedo.',
          },
        },
        {
          id: 'ad3-seek-unready',
          anchorId: 'listen-scrubber',
          act: 'say',
          text: {
            en: "Unready sentence? The tip warns; landing simply waits.",
            es: '¿Frase sin preparar? La punta avisa; aterrizar solo espera.',
          },
        },
        {
          id: 'ad3-seek-queue',
          anchorId: 'listen-scrubber',
          act: 'say',
          text: {
            en: "That sentence jumps to the render queue's front.",
            es: 'Esa frase salta al frente de la cola de preparación.',
          },
        },
        {
          id: 'ad3-seek-pause',
          anchorId: 'listen-play',
          effectAnchorId: 'listen-reader',
          act: 'tap',
          text: {
            en: 'Pause here a moment, then drag again.',
            es: 'Pausa aquí un momento, y arrastra otra vez.',
          },
        },
        {
          id: 'ad3-seek-paused-drag',
          anchorId: 'listen-scrubber',
          effectAnchorId: 'listen-reader',
          act: 'tap',
          text: {
            en: 'Dragged while paused, the place moves, still paused.',
            es: 'Arrastrada en pausa, el lugar se mueve, aún pausado.',
          },
        },
        {
          id: 'ad3-seek-resume',
          anchorId: 'listen-play',
          effectAnchorId: 'listen-reader',
          act: 'tap',
          text: {
            en: 'Play resumes from exactly the new place.',
            es: 'Reproducir reanuda exactamente desde el lugar nuevo.',
          },
        },
      ],
    },
    {
      id: 'edit-without-killing-the-session',
      chapter: { en: 'Edit without killing the session', es: 'Editar sin matar la sesión' },
      steps: [
        {
          id: 'ad3-edit-ask',
          anchorId: 'listen-reader-edit',
          act: 'ask',
          question: {
            en: 'A typo mid-reading: must the session die?',
            es: '¿Un error a mitad de lectura mata la sesión?',
          },
        },
        {
          id: 'ad3-edit-tap',
          anchorId: 'listen-reader-edit',
          effectAnchorId: 'listen-editor',
          act: 'tap',
          text: {
            en: 'Edit opens the text; the session stays loaded.',
            es: 'Editar abre el texto; la sesión sigue cargada.',
          },
        },
        {
          id: 'ad3-edit-say',
          anchorId: 'listen-editor',
          act: 'say',
          text: {
            en: 'Change any words; nothing has stopped yet.',
            es: 'Cambia las palabras que quieras; nada se detuvo aún.',
          },
        },
        {
          id: 'ad3-edit-meta',
          anchorId: 'listen-editor-meta',
          act: 'say',
          optional: true,
          text: {
            en: 'The bar recounts words and minutes as you type.',
            es: 'La barra recuenta palabras y minutos mientras escribes.',
          },
        },
        {
          id: 'ad3-edit-back',
          anchorId: 'listen-reading-view',
          effectAnchorId: 'listen-reader',
          act: 'tap',
          text: {
            en: 'This cross returns you to the reading view.',
            es: 'Esta cruz te devuelve a la vista de lectura.',
          },
        },
        {
          id: 'ad3-edit-same',
          anchorId: 'listen-reader',
          act: 'say',
          text: {
            en: 'Text untouched? You land on your very sentence.',
            es: '¿Texto intacto? Aterrizas en tu misma frase.',
          },
        },
        {
          id: 'ad3-edit-changed',
          anchorId: 'listen-reader',
          act: 'say',
          text: {
            en: 'Text changed? It loads fresh, from sentence one.',
            es: '¿Texto cambiado? Se carga nuevo, desde la primera frase.',
          },
        },
        {
          id: 'ad3-edit-close',
          anchorId: 'listen-reader',
          act: 'say',
          text: {
            en: 'Either way, editing never kills a session silently.',
            es: 'En ambos casos, editar nunca mata una sesión en silencio.',
          },
        },
      ],
    },
    {
      id: 'immersive-mode-and-the-bar-pin',
      chapter: { en: 'Immersive mode and the bar pin', es: 'El modo inmersivo y fijar la barra' },
      steps: [
        {
          id: 'ad3-imm-ask',
          anchorId: 'listen-play',
          act: 'ask',
          question: {
            en: 'While it plays, why does the bottom bar leave?',
            es: 'Mientras suena, ¿por qué se va la barra inferior?',
          },
        },
        {
          id: 'ad3-imm-say',
          anchorId: 'listen-play',
          act: 'say',
          text: {
            en: 'Playing hands the reader the whole screen: immersive listening.',
            es: 'Al sonar, el lector recibe la pantalla entera: escucha inmersiva.',
          },
        },
        {
          id: 'ad3-imm-beat',
          anchorId: 'listen-page',
          act: 'say',
          text: {
            en: 'It waits a short beat; quick taps never trigger it.',
            es: 'Espera un instante corto; los toques rápidos nunca lo activan.',
          },
        },
        {
          id: 'ad3-imm-wide',
          anchorId: 'listen-page',
          act: 'say',
          text: {
            en: 'On wide screens only the play halo grows instead.',
            es: 'En pantallas anchas solo crece el halo de Reproducir.',
          },
        },
        {
          id: 'ad3-pin-seat',
          anchorId: 'listen-nav-pin',
          act: 'say',
          text: {
            en: 'Only while playing does this seat hold a key.',
            es: 'Solo mientras suena este asiento guarda una llave.',
          },
        },
        {
          id: 'ad3-pin-tap',
          anchorId: 'listen-nav-pin',
          act: 'tap',
          establishes: 'bar-pinned',
          text: {
            en: 'Pin the bar back; the voice never stops.',
            es: 'Fija la barra de vuelta; la voz nunca para.',
          },
        },
        {
          id: 'ad3-pin-again',
          anchorId: 'listen-nav-pin',
          act: 'tap',
          text: {
            en: 'Tap it again and the bar glides away again.',
            es: 'Tócala otra vez y la barra se aleja otra vez.',
          },
        },
        {
          id: 'ad3-imm-exits',
          anchorId: 'listen-page',
          act: 'say',
          text: {
            en: 'Pause, an error, or leaving brings the bar back.',
            es: 'Pausar, un error o salir trae la barra de vuelta.',
          },
        },
        {
          id: 'ad3-pin-clears',
          anchorId: 'listen-play',
          act: 'say',
          text: {
            en: 'When reading stops, the pin clears itself away.',
            es: 'Cuando la lectura para, el pin se borra solo.',
          },
        },
      ],
    },
    {
      id: 'the-mini-player-and-the-keyboard',
      chapter: { en: 'The mini player and the keyboard', es: 'El mini-reproductor y el teclado' },
      steps: [
        {
          id: 'ad3-mini-goto',
          anchorId: 'shell-nav:library',
          act: 'goto',
          establishes: 'mini-player-visible',
          text: {
            en: 'Leave Listen mid-reading: something follows you out.',
            es: 'Sal de Escuchar a mitad de lectura: algo te sigue.',
          },
        },
        {
          id: 'ad3-mini-when',
          anchorId: 'shell-miniplayer',
          act: 'say',
          text: {
            en: 'The mini player exists only with a live session.',
            es: 'El mini-reproductor solo existe con una sesión viva.',
          },
        },
        {
          id: 'ad3-mini-transport',
          anchorId: 'shell-miniplayer',
          act: 'say',
          text: {
            en: 'Transport only: previous, play or pause, next. No words.',
            es: 'Solo transporte: anterior, reproducir o pausar, siguiente. Sin palabras.',
          },
        },
        {
          id: 'ad3-mini-hairline',
          anchorId: 'shell-mini-progress',
          act: 'say',
          text: {
            en: 'Its hairline gives a rough glance, never a count.',
            es: 'Su línea fina da un vistazo aproximado, nunca un conteo.',
          },
        },
        {
          id: 'ad3-mini-next',
          anchorId: 'shell-mini-next',
          act: 'tap',
          text: {
            en: 'Its keys step sentences from wherever you are.',
            es: 'Sus teclas avanzan frases desde donde estés.',
          },
        },
        {
          id: 'ad3-mini-absent',
          anchorId: 'shell-miniplayer',
          act: 'say',
          text: {
            en: 'It hides on Listen itself, and on book pages.',
            es: 'Se esconde en el propio Escuchar y en los libros.',
          },
        },
        {
          id: 'ad3-mini-body',
          anchorId: 'shell-miniplayer',
          act: 'tap',
          establishes: 'back-on-listen',
          text: {
            en: 'Tap its empty body, not a key: Listen opens.',
            es: 'Toca su cuerpo vacío, no una tecla: se abre Escuchar.',
          },
        },
        {
          id: 'ad3-key-space',
          anchorId: 'listen-page',
          effectAnchorId: 'listen-reader',
          act: 'key',
          payload: { key: 'Space' },
          text: {
            en: 'Space pauses; Space again resumes the reading.',
            es: 'Espacio pausa; Espacio otra vez reanuda la lectura.',
          },
        },
        {
          id: 'ad3-key-right',
          anchorId: 'listen-page',
          effectAnchorId: 'listen-reader',
          act: 'key',
          payload: { key: 'ArrowRight' },
          text: {
            en: 'Right arrow steps exactly one sentence forward.',
            es: 'Flecha derecha avanza exactamente una frase.',
          },
        },
        {
          id: 'ad3-key-left',
          anchorId: 'listen-page',
          effectAnchorId: 'listen-reader',
          act: 'key',
          payload: { key: 'ArrowLeft' },
          text: {
            en: 'Left arrow restarts the sentence, or steps back.',
            es: 'Flecha izquierda reinicia la frase, o retrocede.',
          },
        },
        {
          id: 'ad3-key-guard',
          anchorId: 'listen-page',
          act: 'say',
          text: {
            en: 'Typing in a box? These keys stay entirely yours.',
            es: '¿Escribiendo en una caja? Estas teclas quedan todas tuyas.',
          },
        },
        {
          id: 'ad3-key-scrubber',
          anchorId: 'listen-scrubber',
          effectAnchorId: 'listen-reader',
          act: 'key',
          payload: { key: 'ArrowRight' },
          text: {
            en: 'Bar focused, arrows move one sentence by position.',
            es: 'Con la barra enfocada, las flechas mueven una frase.',
          },
        },
        {
          id: 'ad3-key-doors',
          anchorId: 'listen-page',
          act: 'say',
          text: {
            en: 'Three keyboard doors, three different reaches. Choose yours.',
            es: 'Tres puertas de teclado, tres alcances distintos. Elige la tuya.',
          },
        },
        {
          id: 'ad3-grammar-enter',
          anchorId: 'listen-page',
          act: 'say',
          text: {
            en: 'House grammar: Enter confirms, everywhere in Logos.',
            es: 'Gramática de la casa: Enter confirma, en todo Logos.',
          },
        },
        {
          id: 'ad3-grammar-escape',
          anchorId: 'listen-page',
          act: 'say',
          text: {
            en: 'Escape closes the open sheet, and nothing beyond.',
            es: 'Escape cierra la hoja abierta, y nada más allá.',
          },
        },
      ],
    },
  ],
}

export default AD3
