/**
 * AD6 · La Biblioteca a fondo / The Library in Depth — Advanced floor.
 *
 * Coverage (PLAN §2.5 — AD6 owns 24 census items):
 * A-58 · C-3 · C-5 · C-6 · C-8 · C-11 · C-14 · C-20 · C-21 · C-22 ·
 * C-23 · C-24 · C-25 · C-26 · C-28 · C-30 · C-31 · C-32 · C-33 · C-34 ·
 * C-36 · C-37 · C-38 · C-42.
 * Taught here in depth, glanced in Q4 (PLAN §3 AD6): the search inside
 * title, summary and text (C-9 — Saved search does NOT fold accents;
 * the folding half of the pair is AD7's), and the six filters (C-10).
 *
 * Truths the words never soften: «All» in the bulk bar means all SHOWN;
 * bulk favourite only adds; bulk finish also erases each saved place;
 * bulk delete is confirm + six seconds of Undo, then final — there is
 * no trash shelf. The menu's finished toggle is not symmetric: marking
 * not finished cannot restore the place finishing erased. Share, where
 * file sharing is unavailable, quietly downloads instead (C-33). One
 * stage: a clip and a reading silence each other (A-58).
 *
 * Everything performed lands on the sealed scenario only: the stage's
 * fiction clips («Welcome to the harbour», «Low Tide, read aloud», the
 * Listen-later harbour text in Spanish). No real clip is ever touched
 * (PLAN §0.2, Fence 0).
 *
 * Anchors are registry ids only (anchors.ts). No duration is written
 * anywhere — the index label is computed from this script by the one
 * shared clock calibration (engine/clock.ts).
 */
import type { PresentationModule } from '../engine/types.ts'

export const AD6: PresentationModule = {
  id: 'AD6',
  floor: 'advanced',
  title: { en: 'The Library in Depth', es: 'La Biblioteca a fondo' },
  capability: {
    en: 'Run your whole Library: find any clip by its words, select many at once, rename, download, and control the render queue.',
    es: 'Domina tu Biblioteca entera: encuentra cualquier clip por sus palabras, selecciona muchos a la vez, renombra, descarga y controla la cola de renderizado.',
  },
  verifiedAgainst: '1.4.156',
  scenes: [
    {
      id: 'find-anything',
      chapter: { en: 'Find anything in Saved', es: 'Encuentra todo en Guardado' },
      steps: [
        {
          id: 'ad6-goto-library',
          anchorId: 'shell-nav:library',
          act: 'goto',
          establishes: 'saved-shelf',
          text: {
            en: 'Everything you saved as clips lives here.',
            es: 'Todo lo que guardaste como clips vive aquí.',
          },
        },
        {
          id: 'ad6-head-count',
          anchorId: 'lib-head-count',
          act: 'say',
          text: {
            en: 'The header keeps your shelf\u2019s tally as it grows: clips and size.',
            es: 'El encabezado lleva la cuenta del estante: clips y tamaño total.',
          },
        },
        {
          id: 'ad6-head-count-scope',
          anchorId: 'lib-head-count',
          act: 'say',
          text: {
            en: 'That size is Saved audio only; books never count.',
            es: 'Ese tamaño es solo audios guardados; los libros nunca cuentan.',
          },
        },
        {
          id: 'ad6-search-ask',
          anchorId: 'lib-saved-search',
          act: 'ask',
          question: {
            en: 'You remember one word from a clip. Then what?',
            es: 'Recuerdas una palabra de un clip. ¿Y luego?',
          },
        },
        {
          id: 'ad6-search-type',
          anchorId: 'lib-saved-search',
          effectAnchorId: 'lib-clip-card',
          act: 'type',
          payload: { value: 'honey' },
          text: {
            en: 'Search reads titles, summaries, and the text itself.',
            es: 'La búsqueda lee títulos, resúmenes y el texto mismo.',
          },
        },
        {
          id: 'ad6-search-accents',
          anchorId: 'lib-saved-search',
          act: 'say',
          text: {
            en: "Capitals don't matter. Accents do: type them as written.",
            es: 'Las mayúsculas no importan. Los acentos sí: escríbelos tal cual.',
          },
        },
        {
          id: 'ad6-search-pair',
          anchorId: 'lib-saved-search',
          act: 'say',
          text: {
            en: "Inside a book, search forgives accents. Here it doesn't.",
            es: 'Dentro de un libro, la búsqueda perdona acentos. Aquí no.',
          },
        },
        {
          id: 'ad6-filters',
          anchorId: 'lib-saved-filters',
          effectAnchorId: 'lib-clip-card',
          act: 'tap',
          text: {
            en: "Six filters split the shelf by each clip's state.",
            es: 'Seis filtros dividen el estante según el estado de cada clip.',
          },
        },
        {
          id: 'ad6-filter-counts',
          anchorId: 'lib-filter:fav',
          act: 'say',
          text: {
            en: 'Every chip counts its clips; an empty chip hides.',
            es: 'Cada filtro cuenta sus clips; el que está vacío se oculta.',
          },
        },
        {
          id: 'ad6-filter-done',
          anchorId: 'lib-filter:done',
          effectAnchorId: 'lib-clip-card',
          act: 'tap',
          text: {
            en: 'Finished gathers everything you heard to the end.',
            es: 'Terminados reúne todo lo que escuchaste hasta el final.',
          },
        },
        {
          id: 'ad6-sort',
          anchorId: 'lib-saved-sort',
          effectAnchorId: 'lib-clip-card',
          act: 'tap',
          text: {
            en: 'Five orders: newest, oldest, longest, shortest, A to Z.',
            es: 'Cinco órdenes: recientes, antiguos, largos, cortos, A a Z.',
          },
        },
        {
          id: 'ad6-sort-estimate',
          anchorId: 'lib-saved-sort',
          act: 'say',
          text: {
            en: 'For saved texts, longest means the estimated listening time.',
            es: 'En textos guardados, «largo» significa la duración estimada de escucha.',
          },
        },
        {
          id: 'ad6-nomatch-type',
          anchorId: 'lib-saved-search',
          effectAnchorId: 'lib-saved-nomatch',
          act: 'type',
          payload: { value: 'zzzz' },
          text: {
            en: 'Type a word that nothing contains, and watch.',
            es: 'Escribe una palabra que nada contenga, y observa.',
          },
        },
        {
          id: 'ad6-nomatch',
          anchorId: 'lib-saved-nomatch',
          act: 'say',
          text: {
            en: "'Nothing here' means no match, not an empty Library.",
            es: '«Nada por aquí» significa sin coincidencias, no Biblioteca vacía.',
          },
        },
        {
          id: 'ad6-search-clear',
          anchorId: 'lib-saved-search',
          effectAnchorId: 'lib-clip-card',
          act: 'type',
          payload: { value: '' },
          text: {
            en: 'Clear the search, and the whole shelf returns.',
            es: 'Borra la búsqueda y vuelve el estante entero.',
          },
        },
      ],
    },
    {
      id: 'select-gesture',
      chapter: { en: 'Select: one gesture, two meanings', es: 'Seleccionar: un gesto, dos significados' },
      steps: [
        {
          id: 'ad6-select-ask',
          anchorId: 'lib-select-toggle',
          act: 'ask',
          question: {
            en: 'How do you act on many clips at once?',
            es: '¿Cómo actúas sobre muchos clips a la vez?',
          },
        },
        {
          id: 'ad6-select-door',
          anchorId: 'lib-select-toggle',
          effectAnchorId: 'lib-selbar',
          act: 'tap',
          establishes: 'selection',
          text: {
            en: "'Select' is the written door into selection mode.",
            es: '«Seleccionar» es la puerta escrita al modo de selección.',
          },
        },
        {
          id: 'ad6-select-longpress',
          anchorId: 'lib-clip-card',
          effectAnchorId: 'lib-selbar',
          act: 'hover',
          payload: { holdMs: 480 },
          establishes: 'selection',
          text: {
            en: 'Or hold any card half a second: same door.',
            es: 'O mantén cualquier tarjeta medio segundo: misma puerta.',
          },
        },
        {
          id: 'ad6-select-taps',
          anchorId: 'lib-clip-selbox',
          act: 'say',
          text: {
            en: 'Now tapping a card only selects it. Nothing plays.',
            es: 'Ahora tocar una tarjeta solo la selecciona. Nada suena.',
          },
        },
        {
          id: 'ad6-select-two-meanings',
          anchorId: 'lib-clip-card',
          act: 'say',
          text: {
            en: 'In Books, that same long hold opens a menu.',
            es: 'En Libros, esa misma pulsación larga abre un menú.',
          },
        },
        {
          id: 'ad6-sel-all',
          anchorId: 'lib-sel-all',
          effectAnchorId: 'lib-clip-card',
          act: 'tap',
          text: {
            en: "'All' selects everything shown, nothing the filter hides.",
            es: '«Todos» selecciona todo lo mostrado, nada que el filtro oculte.',
          },
        },
        {
          id: 'ad6-sel-all-way',
          anchorId: 'lib-selbar',
          act: 'say',
          text: {
            en: 'So filter first, then All: subsets stay precise.',
            es: 'Por eso filtra primero y luego pulsa Todos: así precisas el grupo.',
          },
        },
        {
          id: 'ad6-sel-fav',
          anchorId: 'lib-sel-fav',
          effectAnchorId: 'lib-clip-card',
          act: 'tap',
          text: {
            en: 'The star gives every selected clip a star.',
            es: 'La estrella da una estrella a cada clip seleccionado.',
          },
        },
        {
          id: 'ad6-sel-fav-oneway',
          anchorId: 'lib-sel-fav',
          act: 'say',
          text: {
            en: 'It only adds stars. Removing them is one by one.',
            es: 'Solo añade estrellas. Quitarlas se hace una por una.',
          },
        },
        {
          id: 'ad6-sel-done',
          anchorId: 'lib-sel-done',
          effectAnchorId: 'lib-clip-card',
          act: 'tap',
          text: {
            en: "'Finish' marks every selected clip as finished.",
            es: '«Terminar» marca cada clip seleccionado como terminado.',
          },
        },
        {
          id: 'ad6-sel-done-resets',
          anchorId: 'lib-sel-done',
          act: 'say',
          text: {
            en: "It also erases each clip's saved place. Both travel together.",
            es: 'También borra el lugar guardado de cada clip. Ambas cosas viajan juntas.',
          },
        },
        {
          id: 'ad6-sel-delete',
          anchorId: 'lib-sel-delete',
          effectAnchorId: 'shell-confirm-host',
          act: 'tap',
          establishes: 'delete-confirm',
          text: {
            en: 'Even in bulk, Delete asks first.',
            es: 'Incluso en masa, Borrar pregunta primero.',
          },
        },
        {
          id: 'ad6-sel-confirm',
          anchorId: 'shell-confirm-host',
          act: 'say',
          text: {
            en: 'Confirm, and the selected clips leave the shelf.',
            es: 'Confirma, y los clips seleccionados salen del estante.',
          },
        },
        {
          id: 'ad6-sel-undo',
          anchorId: 'shell-toast-region',
          act: 'say',
          text: {
            en: 'For six seconds, Undo brings every clip back.',
            es: 'Durante seis segundos, Deshacer devuelve cada clip.',
          },
        },
        {
          id: 'ad6-sel-final',
          anchorId: 'shell-toast-region',
          act: 'say',
          text: {
            en: 'After that, deletion is final. No trash shelf exists.',
            es: 'Después, el borrado es definitivo. No hay papelera.',
          },
        },
      ],
    },
    {
      id: 'item-menu',
      chapter: { en: 'The item menu, entry by entry', es: 'El menú del ítem, entrada a entrada' },
      steps: [
        {
          id: 'ad6-menu-open',
          anchorId: 'lib-clip-more',
          act: 'tap',
          establishes: 'item-menu',
          text: {
            en: "The ⋯ opens this clip's own menu.",
            es: 'El ⋯ abre el menú propio de este clip.',
          },
        },
        {
          id: 'ad6-menu-conditional',
          anchorId: 'lib-clip-more',
          act: 'say',
          text: {
            en: "Its entries change with the clip's kind and state.",
            es: 'Sus entradas cambian según la clase y el estado del clip.',
          },
        },
        {
          id: 'ad6-menu-open-listen',
          anchorId: 'lib-menu-open-listen',
          act: 'say',
          optional: true,
          text: {
            en: 'Open in Listen appears only when the clip holds text.',
            es: 'Abrir en Escuchar aparece solo cuando el clip guarda texto.',
          },
        },
        {
          id: 'ad6-menu-open-listen-quiet',
          anchorId: 'lib-menu-open-listen',
          act: 'say',
          optional: true,
          text: {
            en: "The menu opens it quietly; the card's button plays it.",
            es: 'El menú lo abre en silencio; el botón de la tarjeta lo reproduce.',
          },
        },
        {
          id: 'ad6-menu-make-audio',
          anchorId: 'lib-menu-make-audio',
          act: 'say',
          optional: true,
          text: {
            en: 'Make audio lives here too, for text clips.',
            es: 'Hacer audio también vive aquí, para clips de texto.',
          },
        },
        {
          id: 'ad6-menu-done',
          anchorId: 'lib-menu-done',
          act: 'say',
          text: {
            en: 'Mark finished also resets the clip to its start.',
            es: 'Marcar terminado también devuelve el clip a su inicio.',
          },
        },
        {
          id: 'ad6-menu-undone',
          anchorId: 'lib-menu-done',
          act: 'say',
          text: {
            en: 'Mark not finished cannot bring that place back.',
            es: 'Marcar no terminado no puede recuperar ese lugar.',
          },
        },
        {
          id: 'ad6-menu-webpage',
          anchorId: 'lib-menu-webpage',
          act: 'say',
          optional: true,
          text: {
            en: 'A web-born clip keeps its page: this opens it.',
            es: 'Un clip nacido en la web conserva su página: esto la abre.',
          },
        },
        {
          id: 'ad6-menu-rename',
          anchorId: 'lib-menu-rename',
          effectAnchorId: 'lib-rename-input',
          act: 'tap',
          establishes: 'rename-sheet',
          text: {
            en: 'Rename changes the title, in its own sheet.',
            es: 'Renombrar cambia el título, en su propia hoja.',
          },
        },
        {
          id: 'ad6-rename-type',
          anchorId: 'lib-rename-input',
          act: 'type',
          payload: { value: 'Low Tide, for Marta' },
          text: {
            en: 'Only the title changes; summary and text stay.',
            es: 'Solo cambia el título; resumen y texto se quedan.',
          },
        },
        {
          id: 'ad6-rename-save',
          anchorId: 'lib-rename-input',
          effectAnchorId: 'lib-clip-card',
          act: 'key',
          payload: { key: 'Enter' },
          text: {
            en: 'Enter saves. An empty title cannot be saved.',
            es: 'Intro guarda. Un título vacío no puede guardarse.',
          },
        },
        {
          id: 'ad6-menu-download',
          anchorId: 'lib-menu-download',
          act: 'say',
          optional: true,
          text: {
            en: 'Download saves the audio under its current title.',
            es: 'Descargar guarda el audio con su título actual.',
          },
        },
        {
          id: 'ad6-menu-download-name',
          anchorId: 'lib-menu-download',
          act: 'say',
          optional: true,
          text: {
            en: 'So renaming first renames the file you download.',
            es: 'Así que renombrar antes renombra el archivo que descargas.',
          },
        },
        {
          id: 'ad6-menu-share',
          anchorId: 'lib-menu-share',
          act: 'say',
          optional: true,
          text: {
            en: 'Share sends the audio file itself.',
            es: 'Compartir envía el propio archivo de audio.',
          },
        },
        {
          id: 'ad6-menu-share-fallback',
          anchorId: 'lib-menu-share',
          act: 'say',
          optional: true,
          text: {
            en: 'Where file sharing is unavailable, it quietly downloads instead.',
            es: 'Donde compartir archivos no está disponible, descarga en silencio.',
          },
        },
        {
          id: 'ad6-menu-delete',
          anchorId: 'lib-menu-delete',
          act: 'say',
          text: {
            en: 'Single Delete signs the same contract: confirm, then Undo.',
            es: 'Borrar uno firma el mismo contrato: confirmar, luego Deshacer.',
          },
        },
      ],
    },
    {
      id: 'add-audio',
      chapter: { en: 'Add audio from your phone', es: 'Añade audios de tu teléfono' },
      steps: [
        {
          id: 'ad6-add-door',
          anchorId: 'lib-add',
          act: 'say',
          text: {
            en: 'On Saved, the + also brings audio files.',
            es: 'En Guardado, el + también trae archivos de audio.',
          },
        },
        {
          id: 'ad6-add-audio-door',
          anchorId: 'web-import-audio-door',
          act: 'tap',
          text: {
            en: "This door opens your phone's audio files.",
            es: 'Esta puerta abre los archivos de audio de tu teléfono.',
          },
        },
        {
          id: 'ad6-add-filter',
          anchorId: 'web-import-audio-door',
          act: 'say',
          text: {
            en: 'Only real audio enters; other files are skipped silently.',
            es: 'Solo entra audio de verdad; lo demás se salta en silencio.',
          },
        },
        {
          id: 'ad6-add-none',
          anchorId: 'web-import-audio-door',
          act: 'say',
          text: {
            en: "If none qualifies, Logos says that file isn't audio.",
            es: 'Si ninguno vale, Logos dice que ese archivo no es audio.',
          },
        },
        {
          id: 'ad6-add-first-class',
          anchorId: 'lib-clip-card',
          act: 'say',
          text: {
            en: 'Imported audio becomes a clip like any other.',
            es: 'El audio importado se vuelve un clip como cualquier otro.',
          },
        },
        {
          id: 'ad6-add-rights',
          anchorId: 'lib-clip-card',
          act: 'say',
          text: {
            en: 'It gains resume, stars, filters, and this same menu.',
            es: 'Gana reanudación, estrellas, filtros y este mismo menú.',
          },
        },
        {
          id: 'ad6-add-no-text',
          anchorId: 'lib-clip-card',
          act: 'say',
          text: {
            en: 'But it holds no text: no Open in Listen, no Make audio.',
            es: 'Pero no guarda texto: ni Abrir en Escuchar, ni Hacer audio.',
          },
        },
      ],
    },
    {
      id: 'render-queue',
      chapter: { en: 'The render queue', es: 'La cola de renderizado' },
      steps: [
        {
          id: 'ad6-queue-ask',
          anchorId: 'lib-clip-make-audio',
          act: 'ask',
          question: {
            en: 'Two texts need audio. Can both render at once?',
            es: 'Dos textos necesitan audio. ¿Pueden crearse a la vez?',
          },
        },
        {
          id: 'ad6-queue-start',
          anchorId: 'lib-clip-make-audio',
          effectAnchorId: 'lib-render-card',
          act: 'tap',
          establishes: 'render-running',
          text: {
            en: 'Make audio starts this text rendering right away.',
            es: 'Hacer audio empieza a crear este texto enseguida.',
          },
        },
        {
          id: 'ad6-queue-second',
          anchorId: 'lib-clip-make-audio',
          act: 'say',
          text: {
            en: 'Ask for another, and that one waits its turn.',
            es: 'Pide otro, y ese otro espera su turno.',
          },
        },
        {
          id: 'ad6-render-card',
          anchorId: 'lib-render-card',
          act: 'say',
          text: {
            en: 'While anything renders, this card tops the shelf.',
            es: 'Mientras algo se crea, esta tarjeta corona el estante.',
          },
        },
        {
          id: 'ad6-render-card-counts',
          anchorId: 'lib-render-card',
          act: 'say',
          text: {
            en: 'It reports progress without opening anything: sentences done, jobs waiting.',
            es: 'Informa del progreso sin abrir nada: frases hechas, trabajos en espera.',
          },
        },
        {
          id: 'ad6-queue-fifo',
          anchorId: 'lib-render-card',
          act: 'say',
          text: {
            en: 'One renders; the rest wait in order. First come, first served.',
            es: 'Uno se crea; los demás esperan en orden. Primero llegado, primero atendido.',
          },
        },
        {
          id: 'ad6-item-stop',
          anchorId: 'lib-clip-render-stop',
          act: 'say',
          optional: true,
          text: {
            en: "A waiting item's Stop removes it from the queue.",
            es: 'El Detener de un ítem en espera lo saca de la cola.',
          },
        },
        {
          id: 'ad6-item-stop-scope',
          anchorId: 'lib-clip-render-stop',
          act: 'say',
          optional: true,
          text: {
            en: 'Stopped mid-render, the item simply stays text.',
            es: 'Detenido a mitad, el ítem simplemente sigue siendo texto.',
          },
        },
        {
          id: 'ad6-global-stop',
          anchorId: 'lib-render-card',
          act: 'say',
          text: {
            en: "The card's Stop kills the running render itself.",
            es: 'El Detener de la tarjeta mata la creación en curso.',
          },
        },
        {
          id: 'ad6-queue-transform',
          anchorId: 'lib-clip-card',
          act: 'say',
          text: {
            en: 'Finished, the same item becomes its audio. No duplicate.',
            es: 'Al terminar, el mismo ítem se vuelve su audio. Sin duplicados.',
          },
        },
        {
          id: 'ad6-stage-play',
          anchorId: 'lib-clip-play',
          act: 'tap',
          text: {
            en: 'Play that new audio: it starts right here.',
            es: 'Reproduce ese audio nuevo: empieza aquí mismo.',
          },
        },
        {
          id: 'ad6-clip-seek',
          anchorId: 'lib-clip-seek',
          act: 'tap',
          text: {
            en: 'Tap its bar while it plays: you seek the clip.',
            es: 'Toca su barra mientras suena: buscas en el clip.',
          },
        },
        {
          id: 'ad6-clip-seek-idle',
          anchorId: 'lib-clip-seek',
          act: 'say',
          text: {
            en: "An idle card's bar only displays; it cannot seek.",
            es: 'La barra de una tarjeta quieta solo muestra; no busca.',
          },
        },
        {
          id: 'ad6-one-stage',
          anchorId: 'lib-clip-play',
          act: 'say',
          text: {
            en: 'Starting a clip pauses any reading in Listen.',
            es: 'Empezar un clip pausa cualquier lectura en Escuchar.',
          },
        },
        {
          id: 'ad6-one-stage-back',
          anchorId: 'lib-clip-play',
          act: 'say',
          text: {
            en: 'And Play in Listen stops the clip. Never two sounds.',
            es: 'Y Reproducir en Escuchar detiene el clip. Nunca dos sonidos.',
          },
        },
      ],
    },
  ],
}
