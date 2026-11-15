/**
 * AD1 · El panel, entero / The Panel, Whole — every key on the bubble's
 * panel, in the panel's own order, each one explained before it acts —
 * because that is the panel's own house pattern (census B-46).
 *
 * Coverage (PLAN §2.5 — AD1 owns 31 census items): B-6, B-8, B-9, B-11,
 * B-12, B-17, B-20, B-21, B-23, B-25…B-36, B-38…B-47. The narrated
 * NO-SCENE beat B-58 (a stored order expires at 20 s; never obeyed late)
 * rides inside the B-34/B-35 beats of scene 4, as PLAN §2.5 assigns it.
 * B-37 (the transport row always fits) is a construction guarantee, not a
 * lesson: it is verified in this module's stage render, never taught.
 *
 * Staging (OQ-1, as ruled): orb and panel beats act on the sealed fiction
 * stage (`bubble-stage-*` anchors); native beats name their web↔shell
 * contract anchors. Title and capability are the catalogue's words,
 * verbatim — the catalogue owns the words (PLAN §3) and registration
 * refuses any disagreement. Declared `surfaces: ['android']`: the panel
 * is the Android shell's; in a browser the index explains instead of
 * pretending (OQ-3, census B-4).
 *
 * Performed scenario verbs (via the default scenario port): the harbour
 * text (goto with the fiction text id, scene 3) · the ⚑ mark (tap on
 * `bubble-mark` → markHere) · saving what's playing (tap on `bubble-save`
 * → saveCurrentToLibrary). Every other beat points or narrates: the stage
 * host rehearses the panel's own gestures.
 *
 * WORDING LAW — PLAN §2.6 bench items 4, 5 and 10 are UNPROVEN, and the
 * words stay inside what the code proves:
 * - Item 4 (panel keys against a sleeping page): captions promise the key
 *   "answers — perhaps after a breath", NEVER immediacy (B-34/B-35).
 * - Item 5 (the device-voice rescue floor): narrated with NO figures —
 *   the ~30 s of the code's comment is never spoken (B-60/B-47 beats,
 *   scene 7).
 * - Item 10 (the panel conducting a recording): the reading-only keys'
 *   toast is taught in the code's own words — «That key belongs to
 *   readings» / «Esa tecla es de las lecturas» (B-47).
 */
import type { PresentationModule } from '../engine/types.ts'

export const AD1: PresentationModule = {
  id: 'AD1',
  floor: 'advanced',
  title: { en: 'The Panel, Whole', es: 'El panel, entero' },
  capability: {
    en: 'Use every key on the bubble’s panel — words, speed, mark, save, lock, eye and headphones — and know what each one does before you touch it.',
    es: 'Usa cada tecla del panel de la burbuja — palabras, velocidad, marca, guardar, candado, ojo y auriculares — y sabe lo que hace cada una antes de tocarla.',
  },
  surfaces: ['android'],
  verifiedAgainst: '1.4.156',
  scenes: [
    {
      id: 'anatomy',
      chapter: { en: 'The panel’s anatomy', es: 'La anatomía del panel' },
      steps: [
        {
          id: 's1-ask',
          anchorId: 'bubble-stage-panel',
          act: 'ask',
          question: {
            en: 'What lives inside this little panel?',
            es: '¿Qué vive dentro de este pequeño panel?',
          },
        },
        {
          id: 's1-beside-bubble',
          anchorId: 'bubble-stage-panel',
          act: 'say',
          text: {
            en: 'The panel opens tucked against its bubble, corner almost touching.',
            es: 'El panel se abre pegado a su burbuja, esquina casi tocándola.',
          },
        },
        {
          id: 's1-rows',
          anchorId: 'bubble-stage-panel',
          act: 'say',
          text: {
            en: 'Six rows, one job each — we will walk them top to bottom.',
            es: 'Seis filas, una tarea cada una: las recorreremos de arriba abajo.',
          },
        },
        {
          id: 's1-title',
          anchorId: 'bubble-panel-state',
          act: 'say',
          text: {
            en: 'Its title always names what is playing — it changes with your listening.',
            es: 'Su título nombra siempre lo que suena: cambia con tu escucha.',
          },
        },
        {
          id: 's1-subtitle',
          anchorId: 'bubble-panel-state',
          act: 'say',
          text: {
            en: 'Below: your sentence and speed, or its honest state.',
            es: 'Debajo: tu frase y velocidad, o su estado honesto.',
          },
        },
        {
          id: 's1-spectrum',
          anchorId: 'bubble-spectrum',
          act: 'say',
          text: {
            en: 'These bars are the voice, moving; still bars mean stalled sound.',
            es: 'Estas barras son la voz en movimiento; barras quietas, sonido detenido.',
          },
        },
        {
          id: 's1-house-pattern',
          anchorId: 'bubble-stage-panel',
          act: 'say',
          text: {
            en: 'House rule: consequential keys explain themselves before acting.',
            es: 'Regla de la casa: las teclas con consecuencia se explican antes.',
          },
        },
      ],
    },
    {
      id: 'drag-doors',
      chapter: { en: 'The bubble’s drag doors', es: 'Las puertas del arrastre de la burbuja' },
      steps: [
        {
          id: 's2-jewel',
          anchorId: 'bubble-stage-orb',
          act: 'say',
          text: {
            en: 'Know her anywhere: a warm jewel, gold-ringed — your reading, floating.',
            es: 'Reconócela donde sea: una joya cálida de anillo dorado, tu lectura flotante.',
          },
        },
        {
          id: 's2-halo',
          anchorId: 'bubble-push-playing',
          act: 'say',
          text: {
            en: 'While she reads, her halo breathes; at rest, it calms.',
            es: 'Mientras lee, su halo respira; en reposo, se calma.',
          },
        },
        {
          id: 's2-free-placement',
          anchorId: 'bubble-stage-orb',
          act: 'say',
          text: {
            en: 'Dropped mid-screen, she stays mid-screen; your hand decides.',
            es: 'Soltada en mitad de pantalla, ahí se queda; manda tu mano.',
          },
        },
        {
          id: 's2-near-edge-snap',
          anchorId: 'bubble-stage-orb',
          act: 'say',
          text: {
            en: 'Only dropped near an edge does she settle against it.',
            es: 'Solo soltada cerca de un borde se acomoda contra él.',
          },
        },
        {
          id: 's2-doors-appear',
          anchorId: 'bubble-stage-orb',
          act: 'say',
          text: {
            en: 'Keep dragging, and two doors appear at the top.',
            es: 'Sigue arrastrando, y arriba aparecen dos puertas.',
          },
        },
        {
          id: 's2-remove',
          anchorId: 'bubble-stage-orb',
          act: 'tap',
          text: {
            en: 'Drop her on ✕ Remove, and she leaves at once.',
            es: 'Déjala sobre ✕ Quitar, y se va al instante.',
          },
        },
        {
          id: 's2-remove-no-ask',
          anchorId: 'bubble-stage-orb',
          act: 'say',
          text: {
            en: 'No card, no question: drag-Remove never asks first.',
            es: 'Sin tarjeta ni pregunta: Quitar por arrastre nunca pregunta.',
          },
        },
        {
          id: 's2-open-logos',
          anchorId: 'bubble-stage-orb',
          act: 'tap',
          text: {
            en: 'Drop her on λ Open Logos, and the app opens.',
            es: 'Déjala sobre λ Abrir Logos, y la aplicación se abre.',
          },
        },
        {
          id: 's2-fade',
          anchorId: 'bubble-stage-orb',
          act: 'say',
          text: {
            en: 'Untouched four seconds, she fades to a whisper.',
            es: 'Sin tocarla cuatro segundos, se desvanece a un susurro.',
          },
        },
        {
          id: 's2-wake',
          anchorId: 'bubble-stage-orb',
          act: 'tap',
          text: {
            en: 'She is not gone, only resting: one touch wakes her.',
            es: 'No se fue, solo descansa: un toque la despierta.',
          },
        },
        {
          id: 's2-ask-wheel',
          anchorId: 'bubble-voice-wheel',
          act: 'ask',
          question: {
            en: 'And holding her still, without dragging?',
            es: '¿Y mantenerla quieta, sin arrastrarla?',
          },
        },
        {
          id: 's2-wheel',
          anchorId: 'bubble-voice-wheel',
          act: 'hover',
          payload: { holdMs: 500 },
          text: {
            en: 'Hold her half a second: the voice wheel turns.',
            es: 'Mantenla medio segundo: la rueda de voces gira.',
          },
        },
        {
          id: 's2-wheel-effect',
          anchorId: 'bubble-voice-wheel',
          act: 'say',
          text: {
            en: 'The reading continues in your next favourite voice.',
            es: 'La lectura sigue con tu siguiente voz favorita.',
          },
        },
        {
          id: 's2-wheel-place',
          anchorId: 'bubble-voice-wheel',
          act: 'say',
          text: {
            en: 'It lives on the bubble, panel closed — not inside it.',
            es: 'Vive en la burbuja, con el panel cerrado — no dentro.',
          },
        },
      ],
    },
    {
      id: 'words-follow',
      chapter: { en: 'Words that follow the voice', es: 'Palabras que siguen la voz' },
      steps: [
        {
          id: 's3-setup',
          anchorId: 'listen-page',
          act: 'goto',
          payload: { param: 'scenario:text-harbour-morning' },
          text: {
            en: 'A harbour text is playing; picture its panel open.',
            es: 'Un texto del puerto está sonando; imagina su panel abierto.',
          },
        },
        {
          id: 's3-amber',
          anchorId: 'bubble-words-state',
          act: 'say',
          text: {
            en: 'The word being spoken wears amber; the window keeps it centred.',
            es: 'La palabra que suena lleva el ámbar; la ventana la mantiene centrada.',
          },
        },
        {
          id: 's3-before-after',
          anchorId: 'bubble-words-state',
          act: 'say',
          text: {
            en: 'Said words stand full; coming words wait dimmed.',
            es: 'Las palabras dichas van plenas; las venideras, atenuadas.',
          },
        },
        {
          id: 's3-scroll-vertical',
          anchorId: 'bubble-stage-words',
          act: 'scroll',
          payload: { direction: 'down' },
          text: {
            en: 'Drag the words upward: long sentences scroll too.',
            es: 'Arrastra las palabras hacia arriba: la frase larga también se recorre.',
          },
        },
        {
          id: 's3-scrub-sideways',
          anchorId: 'bubble-stage-words',
          act: 'tap',
          text: {
            en: 'Slide the words sideways, and you travel by sentences.',
            es: 'Desliza las palabras de lado, y viajas por frases.',
          },
        },
        {
          id: 's3-scrub-live',
          anchorId: 'bubble-seek',
          act: 'say',
          text: {
            en: 'The subtitle counts sentences as your finger travels.',
            es: 'El subtítulo cuenta las frases mientras tu dedo viaja.',
          },
        },
        {
          id: 's3-seek-bar',
          anchorId: 'bubble-seek',
          act: 'tap',
          text: {
            en: 'The seek bar lands on release, at that sentence.',
            es: 'La barra de búsqueda aterriza al soltar, en esa frase.',
          },
        },
        {
          id: 's3-grip',
          anchorId: 'bubble-stage-grip',
          act: 'tap',
          text: {
            en: 'Drag this corner grip: the reader stretches two ways.',
            es: 'Arrastra esta esquina: el lector se estira en dos direcciones.',
          },
        },
        {
          id: 's3-grip-memory',
          anchorId: 'bubble-stage-grip',
          act: 'say',
          text: {
            en: 'Its size is remembered — separately on phone and tablet.',
            es: 'Su tamaño se recuerda — por separado en teléfono y tableta.',
          },
        },
        {
          id: 's3-same-twice',
          anchorId: 'bubble-clip',
          act: 'say',
          text: {
            en: 'Copy the same text twice: the second tap restarts nothing.',
            es: 'Copia el mismo texto dos veces: el segundo toque no reinicia nada.',
          },
        },
        {
          id: 's3-arrival',
          anchorId: 'bubble-arrival',
          act: 'tap',
          text: {
            en: 'Or copy, then simply open Logos: the new text plays.',
            es: 'O copia y simplemente abre Logos: el texto nuevo suena.',
          },
        },
        {
          id: 's3-blink',
          anchorId: 'bubble-clip',
          act: 'say',
          text: {
            en: 'If a direct read fails, an invisible blink reads instead.',
            es: 'Si la lectura directa falla, un parpadeo invisible lee en su lugar.',
          },
        },
        {
          id: 's3-blink-calm',
          anchorId: 'bubble-clip',
          act: 'say',
          text: {
            en: 'A flicker, no window: that messenger is not a fault.',
            es: 'Un parpadeo, ninguna ventana: ese mensajero no es un fallo.',
          },
        },
      ],
    },
    {
      id: 'speed-fingertip',
      chapter: { en: 'Speed at your fingertip', es: 'La velocidad al dedo' },
      steps: [
        {
          id: 's4-prev',
          anchorId: 'bubble-prev',
          act: 'tap',
          text: {
            en: 'Previous steps back exactly one sentence — never another track.',
            es: 'Anterior retrocede exactamente una frase — nunca otra pista.',
          },
        },
        {
          id: 's4-next',
          anchorId: 'bubble-next',
          act: 'tap',
          text: {
            en: 'Next steps forward one sentence; the triangles say fast-wind.',
            es: 'Siguiente avanza una frase; los triángulos dicen avance rápido.',
          },
        },
        {
          id: 's4-pause-named',
          anchorId: 'bubble-pause',
          act: 'tap',
          text: {
            en: 'This key sends «pause» by name — never a blind toggle.',
            es: 'Esta tecla envía «pausa» por su nombre — nunca un conmutador ciego.',
          },
        },
        {
          id: 's4-pause-holds',
          anchorId: 'bubble-pause',
          act: 'say',
          text: {
            en: 'A pause sent stays a pause, all the way.',
            es: 'Una pausa enviada sigue siendo pausa, hasta el final.',
          },
        },
        {
          id: 's4-breath',
          anchorId: 'bubble-play',
          act: 'say',
          text: {
            en: 'Even asleep, the app answers — perhaps after a breath.',
            es: 'Aun dormida, la aplicación responde — quizá tras un respiro.',
          },
        },
        {
          id: 's4-stored-orders',
          anchorId: 'bubble-pending',
          act: 'say',
          text: {
            en: 'Orders for a sleeping page land on waking, or expire.',
            es: 'Las órdenes para una página dormida aterrizan al despertar, o caducan.',
          },
        },
        {
          id: 's4-never-late',
          anchorId: 'bubble-pending',
          act: 'say',
          text: {
            en: 'They are never obeyed late, against a changed stage.',
            es: 'Nunca se obedecen tarde, contra una escena cambiada.',
          },
        },
        {
          id: 's4-speed-minus',
          anchorId: 'bubble-speed',
          act: 'tap',
          text: {
            en: 'Minus steps down the same ladder Listen uses.',
            es: 'Menos baja por la misma escalera que usa Escuchar.',
          },
        },
        {
          id: 's4-speed-plus',
          anchorId: 'bubble-speed',
          act: 'tap',
          text: {
            en: 'Plus steps up one rung — never a leap.',
            es: 'Más sube un escalón — nunca un salto.',
          },
        },
        {
          id: 's4-speed-feel',
          anchorId: 'bubble-speed',
          act: 'say',
          text: {
            en: 'The key answers your finger before your ear confirms it.',
            es: 'La tecla responde a tu dedo antes de que tu oído lo confirme.',
          },
        },
        {
          id: 's4-speed-subtitle',
          anchorId: 'bubble-panel-state',
          act: 'say',
          text: {
            en: 'The subtitle republishes the new speed at once.',
            es: 'El subtítulo anuncia la nueva velocidad al instante.',
          },
        },
      ],
    },
    {
      id: 'mark-save-lock',
      chapter: { en: 'Mark, save, and the lock', es: 'Marcar, guardar y el candado' },
      steps: [
        {
          id: 's5-ask-mark',
          anchorId: 'bubble-mark',
          act: 'ask',
          question: {
            en: 'You hear a sentence worth keeping. This key?',
            es: 'Escuchas una frase que vale guardar. ¿Esta tecla?',
          },
        },
        {
          id: 's5-mark-saved',
          anchorId: 'bubble-mark',
          act: 'tap',
          text: {
            en: 'Already in your Library? The mark lands instantly.',
            es: '¿Ya vive en tu Biblioteca? La marca cae al instante.',
          },
        },
        {
          id: 's5-mark-teaches',
          anchorId: 'bubble-mark',
          act: 'say',
          text: {
            en: 'First time only, a card shows where marks live.',
            es: 'Solo la primera vez, una tarjeta muestra dónde viven las marcas.',
          },
        },
        {
          id: 's5-mark-unsaved',
          anchorId: 'bubble-mark',
          act: 'say',
          text: {
            en: 'Not saved yet? First it offers: Save to Library.',
            es: '¿Aún no guardado? Primero ofrece: Guardar en la Biblioteca.',
          },
        },
        {
          id: 's5-mark-not-now',
          anchorId: 'bubble-mark',
          act: 'say',
          text: {
            en: 'Choose Not now, and the moment simply passes unmarked.',
            es: 'Elige Ahora no, y el momento pasa sin marca.',
          },
        },
        {
          id: 's5-save-card',
          anchorId: 'bubble-save',
          act: 'say',
          text: {
            en: "The + key also explains first: Save what's playing.",
            es: 'La tecla + también se explica primero: guardar lo que suena.',
          },
        },
        {
          id: 's5-save-tap',
          anchorId: 'bubble-save',
          act: 'tap',
          text: {
            en: "Confirm, and what's playing becomes a Listen later text.",
            es: 'Confirma, y lo que suena se vuelve texto para después.',
          },
        },
        {
          id: 's5-save-truth',
          anchorId: 'bubble-save',
          act: 'say',
          text: {
            en: '«Saved» is announced only when the save is true.',
            es: '«Guardado» se anuncia solo cuando el guardado es verdad.',
          },
        },
        {
          id: 's5-save-book',
          anchorId: 'bubble-save',
          act: 'say',
          text: {
            en: 'Playing a book? It answers: already in your library.',
            es: '¿Suena un libro? Responde: ya está en tu biblioteca.',
          },
        },
        {
          id: 's5-lock-card',
          anchorId: 'bubble-stage-lock',
          act: 'tap',
          text: {
            en: 'The lock explains itself before changing, both directions.',
            es: 'El candado se explica antes de cambiar, en ambas direcciones.',
          },
        },
        {
          id: 's5-lock-effect',
          anchorId: 'bubble-lock-state',
          act: 'say',
          text: {
            en: "Locked: no copied text replaces what you're hearing.",
            es: 'Bloqueado: ningún texto copiado reemplaza lo que escuchas.',
          },
        },
        {
          id: 's5-lock-arrival',
          anchorId: 'bubble-lock-state',
          act: 'say',
          text: {
            en: 'Even texts arriving in Logos are held back.',
            es: 'Incluso los textos que llegan a Logos quedan retenidos.',
          },
        },
        {
          id: 's5-lock-purpose',
          anchorId: 'bubble-stage-lock',
          act: 'say',
          text: {
            en: 'It guards the long audiobook while you copy freely.',
            es: 'Protege el audiolibro largo mientras copias con libertad.',
          },
        },
        {
          id: 's5-auto-same',
          anchorId: 'bubble-lever',
          act: 'tap',
          text: {
            en: 'Panel Auto is the same lever Settings keeps.',
            es: 'El Auto del panel es la misma palanca de Ajustes.',
          },
        },
        {
          id: 's5-auto-sync',
          anchorId: 'bubble-lever',
          act: 'say',
          text: {
            en: 'Move it here, and Settings learns it too.',
            es: 'Muévela aquí, y Ajustes también se entera.',
          },
        },
        {
          id: 's5-auto-on',
          anchorId: 'bubble-lever',
          act: 'say',
          text: {
            en: 'Turning it on here reads the clipboard at once.',
            es: 'Encenderla aquí lee el portapapeles en el acto.',
          },
        },
      ],
    },
    {
      id: 'eye-headphones-back',
      chapter: { en: 'The eye, the headphones, and Back', es: 'El ojo, los auriculares y Atrás' },
      steps: [
        {
          id: 's6-headphones',
          anchorId: 'bubble-listen-visit',
          act: 'tap',
          text: {
            en: 'Headphones: the panel folds, Logos opens at your text.',
            es: 'Auriculares: el panel se pliega, Logos se abre en tu texto.',
          },
        },
        {
          id: 's6-headphones-keeps',
          anchorId: 'bubble-listen-visit',
          act: 'say',
          text: {
            en: 'The reading never stops along the way.',
            es: 'La lectura nunca se detiene por el camino.',
          },
        },
        {
          id: 's6-back',
          anchorId: 'bubble-listen-visit',
          act: 'say',
          text: {
            en: "Android's Back returns you to the app you were in.",
            es: 'El Atrás de Android te devuelve a la aplicación donde estabas.',
          },
        },
        {
          id: 's6-back-dissolves',
          anchorId: 'bubble-listen-visit',
          act: 'say',
          text: {
            en: 'Wander elsewhere inside Logos, and the visit dissolves.',
            es: 'Si te vas a otra sección de Logos, la visita se disuelve.',
          },
        },
        {
          id: 's6-eye',
          anchorId: 'bubble-stage-eye',
          act: 'tap',
          text: {
            en: 'The eye asks first: Remove the bubble?',
            es: 'El ojo pregunta primero: ¿Quitar la burbuja?',
          },
        },
        {
          id: 's6-eye-way-back',
          anchorId: 'bubble-stage-eye',
          act: 'say',
          text: {
            en: 'Its card names the way back: Settings, or the λ.',
            es: 'Su tarjeta nombra el regreso: Ajustes, o la λ.',
          },
        },
        {
          id: 's6-eye-contrast',
          anchorId: 'bubble-stage-eye',
          act: 'say',
          text: {
            en: 'Unlike drag-Remove, hiding her is never accidental.',
            es: 'A diferencia de Quitar arrastrando, ocultarla nunca es accidental.',
          },
        },
        {
          id: 's6-eye-ignore',
          anchorId: 'bubble-stage-eye',
          act: 'say',
          optional: true,
          text: {
            en: 'Ignore the card, and it fades away by itself.',
            es: 'Ignora la tarjeta, y se desvanece sola.',
          },
        },
      ],
    },
    {
      id: 'recording',
      chapter: { en: 'The panel conducting a recording', es: 'El panel mandando una grabación' },
      steps: [
        {
          id: 's7-face',
          anchorId: 'bubble-clip-stage',
          act: 'say',
          text: {
            en: 'Start a Library recording, and the panel changes face.',
            es: 'Inicia una grabación de la Biblioteca, y el panel cambia de cara.',
          },
        },
        {
          id: 's7-clock',
          anchorId: 'bubble-clip-stage',
          act: 'say',
          text: {
            en: 'Title and a clock now — no sentences, no words.',
            es: 'Ahora título y un reloj — sin frases ni palabras.',
          },
        },
        {
          id: 's7-skip',
          anchorId: 'bubble-prev',
          act: 'tap',
          text: {
            en: 'Previous and next become fifteen-second steps here.',
            es: 'Anterior y siguiente se vuelven pasos de quince segundos aquí.',
          },
        },
        {
          id: 's7-toast',
          anchorId: 'shell-toast-region',
          act: 'say',
          text: {
            en: 'Reading-only keys answer honestly: «That key belongs to readings».',
            es: 'Las teclas de lectura responden honestas: «Esa tecla es de las lecturas».',
          },
        },
        {
          id: 's7-previews',
          anchorId: 'bubble-clip-stage',
          act: 'say',
          optional: true,
          text: {
            en: 'Voice previews never take the panel over.',
            es: 'Las muestras de voz nunca se adueñan del panel.',
          },
        },
        {
          id: 's7-rescue',
          anchorId: 'bubble-native-floor',
          act: 'say',
          text: {
            en: 'If the stream ever dies, the device voice can carry on.',
            es: 'Si el flujo muere alguna vez, la voz del dispositivo puede seguir.',
          },
        },
        {
          id: 's7-rescue-return',
          anchorId: 'bubble-native-floor',
          act: 'say',
          text: {
            en: "When Logos' own voice recovers, it takes over again.",
            es: 'Cuando la voz de Logos se recupera, retoma la lectura.',
          },
        },
        {
          id: 's7-close',
          anchorId: 'bubble-stage-panel',
          act: 'say',
          text: {
            en: 'One panel, two stages — and every key accounted for.',
            es: 'Un panel, dos escenas — y cada tecla explicada.',
          },
        },
      ],
    },
  ],
}

export default AD1
