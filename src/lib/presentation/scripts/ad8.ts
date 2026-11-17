/**
 * AD8 · Crear archivos de audio / Create Audio Files — Advanced floor.
 *
 * Coverage (PLAN §2.5 — AD8 owns 22 census items): D-31…D-52, every one.
 * The three distinctions PLAN §3 orders, taught plainly in the words:
 * Create's voice pick is PAGE-LOCAL state and touches no setting (D-38);
 * export speed is its OWN settings key, 0.6–1.6×, narrower than Listen's
 * (D-39); the format is SHARED with Listen's Keep sheet — one key, both
 * doors (D-40). The export queue is global across Listen and Create
 * (D-44), and Create's page deliberately hides Listen-origin jobs (D-45).
 *
 * Declared substitutions (the fleet pattern — narrated at the seat):
 * D-38, D-44 and D-45 own no anchor in the registry (they resolve by
 * store/job probes, R4), so their truths are spoken on the neighbouring
 * performed anchor and flagged here. D-53 (the RecordingsPanel) belongs
 * to AD13; it appears once, as an optional pointer beat on its own
 * anchor, and nothing more is promised of it here.
 *
 * Everything performed lands on the sealed scenario only: the editor is
 * filled with fiction (TEXT_EN), and the render performed here renders
 * that fiction on the stage. No real draft, clip or setting is ever
 * touched (PLAN §0.2, Fence 0).
 *
 * Title and capability are the catalogue's words verbatim — the
 * catalogue owns the words (parent ruling, Quick floor). Anchors are
 * registry ids only. No duration is written anywhere — the index label
 * is computed from this script by the one shared clock calibration.
 */
import { TEXT_EN } from '../scenario/fiction.ts'
import type { PresentationModule } from '../engine/types.ts'

export const AD8: PresentationModule = {
  id: 'AD8',
  floor: 'advanced',
  title: { en: 'Create Audio Files', es: 'Crear archivos de audio' },
  capability: {
    en: 'Turn any text into a finished audio file — with its own voice, speed and format — and find it waiting in your Library.',
    es: 'Convierte cualquier texto en un archivo de audio terminado — con su propia voz, velocidad y formato — y encuéntralo esperándote en tu Biblioteca.',
  },
  verifiedAgainst: '1.4.156',
  scenes: [
    {
      id: 'create-whole',
      chapter: { en: 'Create, whole', es: 'Crear, entero' },
      steps: [
        {
          id: 'ad8-goto-create',
          anchorId: 'create-head',
          act: 'goto',
          establishes: 'create-page',
          text: {
            en: 'Create turns a whole text into an audio file.',
            es: 'Crear convierte un texto entero en un archivo de audio.',
          },
        },
        {
          id: 'ad8-one-job',
          anchorId: 'create-head',
          act: 'say',
          text: {
            en: 'Listen gives you a session; Create gives you a file.',
            es: 'Escuchar te da una sesión; Crear te da un archivo.',
          },
        },
        {
          id: 'ad8-own-draft',
          anchorId: 'create-editor',
          act: 'say',
          text: {
            en: 'This editor keeps its own draft, separate from Listen.',
            es: 'Este editor guarda su propio borrador, aparte de Escuchar.',
          },
        },
        {
          id: 'ad8-type-text',
          anchorId: 'create-editor',
          act: 'type',
          payload: { value: TEXT_EN.text },
          text: {
            en: 'Type or paste the text you want to own.',
            es: 'Escribe o pega el texto que quieres tener.',
          },
        },
        {
          id: 'ad8-paste',
          anchorId: 'create-paste',
          effectAnchorId: 'create-editor',
          act: 'tap',
          text: {
            en: "Paste swaps in the clipboard's text, if it holds any.",
            es: 'Pegar trae el texto del portapapeles, si tiene algo.',
          },
        },
        {
          id: 'ad8-meta-live',
          anchorId: 'create-meta',
          act: 'say',
          text: {
            en: 'Words and estimated length update as you type.',
            es: 'Las palabras y la duración estimada cambian al escribir.',
          },
        },
        {
          id: 'ad8-title-ask',
          anchorId: 'create-title',
          act: 'ask',
          question: {
            en: 'No title typed. What will the file be called?',
            es: 'Sin título escrito. ¿Cómo se llamará el archivo?',
          },
        },
        {
          id: 'ad8-title-fallback',
          anchorId: 'create-title',
          act: 'say',
          text: {
            en: 'The first line names it; a file is never nameless.',
            es: 'La primera línea lo nombra; ningún archivo queda sin nombre.',
          },
        },
      ],
    },
    {
      id: 'own-voice-own-speed',
      chapter: { en: 'Its own voice, its own speed', es: 'Su propia voz, su propia velocidad' },
      steps: [
        {
          id: 'ad8-voice-row',
          anchorId: 'create-voice-row',
          act: 'say',
          text: {
            en: 'Auto, your starred voices, and More: the shortlist lives here.',
            es: 'Auto, tus voces con estrella y Más: aquí vive la lista corta.',
          },
        },
        {
          id: 'ad8-voice-chip-auto',
          anchorId: 'create-voice-chip:auto',
          effectAnchorId: 'create-voice-chosen',
          act: 'tap',
          payload: { param: 'auto' },
          text: {
            en: "Tap a favourite chip to make it this render's voice.",
            es: 'Toca una voz favorita para que sea la voz de este archivo.',
          },
        },
        {
          id: 'ad8-voice-chosen',
          anchorId: 'create-voice-chosen',
          act: 'say',
          text: {
            en: 'Name and accent confirm your chosen voice before you render.',
            es: 'Nombre y acento confirman la voz elegida antes de crear el audio.',
          },
        },
        {
          id: 'ad8-voice-page-local',
          anchorId: 'create-voice-chosen',
          act: 'say',
          text: {
            en: 'This choice rules this render only; it touches no setting.',
            es: 'Esta elección manda solo en este archivo; no toca ningún ajuste.',
          },
        },
        {
          id: 'ad8-speed-own-key',
          anchorId: 'create-speed',
          act: 'say',
          text: {
            en: 'Export speed is its own key: 0.6 to 1.6 times.',
            es: 'La velocidad de exportación es otra llave: va de 0,6 a 1,6 veces.',
          },
        },
        {
          id: 'ad8-speed-consequence',
          anchorId: 'create-speed',
          act: 'say',
          text: {
            en: 'Files can run slower than you like to listen.',
            es: 'Los archivos pueden ir más lentos que tu escucha.',
          },
        },
        {
          id: 'ad8-format-shared',
          anchorId: 'create-format',
          act: 'tap',
          text: {
            en: "Format is shared: Listen's Keep sheet uses this same choice.",
            es: 'El formato se comparte: Guardar de Escuchar usa esta misma elección.',
          },
        },
        {
          id: 'ad8-format-kinds',
          anchorId: 'create-format',
          act: 'say',
          text: {
            en: 'MP3 is small; WAV is lossless and large.',
            es: 'MP3 es pequeño; WAV es sin pérdida y grande.',
          },
        },
      ],
    },
    {
      id: 'use-listen-text',
      chapter: { en: 'Use the Listen text', es: 'Usa el texto de Escuchar' },
      steps: [
        {
          id: 'ad8-use-listen-ask',
          anchorId: 'create-use-listen',
          act: 'ask',
          question: {
            en: 'Already hearing something in Listen? Must you retype it?',
            es: '¿Ya escuchas algo en Escuchar? ¿Debes reescribirlo?',
          },
        },
        {
          id: 'ad8-use-listen-tap',
          anchorId: 'create-use-listen',
          effectAnchorId: 'create-editor',
          act: 'tap',
          optional: true,
          establishes: 'create-text-from-listen',
          text: {
            en: 'Use Listen text copies that draft here, untouched there.',
            es: 'Usar el texto de Escuchar lo copia aquí, intacto allá.',
          },
        },
        {
          id: 'ad8-use-listen-consequence',
          anchorId: 'create-editor',
          act: 'say',
          text: {
            en: 'One tap: from hearing it to owning it.',
            es: 'Un toque: de escucharlo a tenerlo tuyo.',
          },
        },
        {
          id: 'ad8-use-listen-asleep',
          anchorId: 'create-use-listen',
          act: 'say',
          text: {
            en: 'While Listen stands empty, this button stays asleep.',
            es: 'Mientras Escuchar está vacío, este botón permanece dormido.',
          },
        },
      ],
    },
    {
      id: 'global-queue',
      chapter: { en: 'The global queue', es: 'La cola global' },
      steps: [
        {
          id: 'ad8-engine-note',
          anchorId: 'create-engine-note',
          act: 'say',
          optional: true,
          text: {
            en: 'The first render downloads its voice once, then works offline.',
            es: 'El primer archivo descarga su voz una vez; después trabaja sin conexión.',
          },
        },
        {
          id: 'ad8-generate',
          anchorId: 'create-generate',
          effectAnchorId: 'create-progress',
          act: 'tap',
          establishes: 'render-running',
          text: {
            en: 'Generate starts the render with everything set above.',
            es: 'Generar empieza a crear el audio con todo lo elegido.',
          },
        },
        {
          id: 'ad8-progress-ring',
          anchorId: 'create-progress',
          act: 'say',
          text: {
            en: 'The ring reports the render live: sentences, seconds made, time left.',
            es: 'El anillo informa en vivo: frases, segundos creados, tiempo restante.',
          },
        },
        {
          id: 'ad8-cancel',
          anchorId: 'create-cancel',
          act: 'say',
          text: {
            en: 'Cancel stops this render; the text stays, unharmed.',
            es: 'Cancelar detiene esta creación; el texto queda, intacto.',
          },
        },
        {
          id: 'ad8-queue-global',
          anchorId: 'create-generate',
          act: 'say',
          text: {
            en: "The queue is global: Listen's renders line up here too.",
            es: 'La cola es global: los audios de Escuchar también esperan aquí.',
          },
        },
        {
          id: 'ad8-own-jobs-only',
          anchorId: 'create-progress',
          act: 'say',
          text: {
            en: "This page shows only Create's jobs; Listen's live in Library.",
            es: 'Esta página muestra solo trabajos de Crear; los de Escuchar, en Biblioteca.',
          },
        },
        {
          id: 'ad8-error-note',
          anchorId: 'create-error',
          act: 'say',
          optional: true,
          text: {
            en: 'A failed render stays as a note; your form survives.',
            es: 'Un fallo queda como nota; tu formulario sobrevive.',
          },
        },
      ],
    },
    {
      id: 'result-lives-in-library',
      chapter: { en: 'The result already lives in the Library', es: 'El resultado ya vive en la Biblioteca' },
      steps: [
        {
          id: 'ad8-result-saved',
          anchorId: 'create-result',
          act: 'say',
          text: {
            en: 'Finished: the file already lives in your Library.',
            es: 'Terminado: el archivo ya vive en tu Biblioteca.',
          },
        },
        {
          id: 'ad8-result-play',
          anchorId: 'create-result',
          act: 'tap',
          text: {
            en: 'Play hears the finished file before you keep anything else.',
            es: 'Reproducir escucha el archivo terminado antes que nada.',
          },
        },
        {
          id: 'ad8-result-seek',
          anchorId: 'create-result-seek',
          act: 'tap',
          optional: true,
          text: {
            en: 'Tap the bar to hear a later moment.',
            es: 'Toca la barra para oír un momento posterior.',
          },
        },
        {
          id: 'ad8-result-download',
          anchorId: 'create-result-download',
          act: 'tap',
          text: {
            en: 'Download saves a copy to this phone.',
            es: 'Descargar guarda una copia en este teléfono.',
          },
        },
        {
          id: 'ad8-result-share',
          anchorId: 'create-result-share',
          act: 'tap',
          text: {
            en: 'Share sends the file; without share, it downloads instead.',
            es: 'Compartir envía el archivo; sin compartir, se descarga.',
          },
        },
        {
          id: 'ad8-share-never-dead',
          anchorId: 'create-result-share',
          act: 'say',
          text: {
            en: 'That button never dead-ends.',
            es: 'Ese botón nunca queda sin salida.',
          },
        },
        {
          id: 'ad8-result-library',
          anchorId: 'create-result-library',
          act: 'goto',
          text: {
            en: 'Library takes you to the shelf where it waits.',
            es: 'Biblioteca te lleva al estante donde espera.',
          },
        },
        {
          id: 'ad8-result-new',
          anchorId: 'create-result-new',
          act: 'say',
          text: {
            en: 'New clears the result and returns to the form.',
            es: 'Nuevo limpia el resultado y vuelve al formulario.',
          },
        },
        {
          id: 'ad8-recordings-pointer',
          anchorId: 'create-recordings',
          act: 'say',
          optional: true,
          text: {
            en: 'On big screens, recordings wait beside this form: AD13 shows how.',
            es: 'En pantallas grandes, las grabaciones esperan junto al formulario: AD13.',
          },
        },
      ],
    },
  ],
}
