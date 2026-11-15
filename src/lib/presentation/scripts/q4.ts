/**
 * Q4 · Guardar y volver / Save and Come Back — Quick floor.
 *
 * Coverage (PLAN §2.5 — Q4 owns 23 census items):
 * A-6 · A-17 · A-28 · A-46 · A-47 · A-48 · A-49 · C-1 · C-4 · C-7 · C-9 ·
 * C-10 · C-12 · C-13 · C-15 · C-16 · C-17 · C-18 · C-19 · C-27 · C-35 ·
 * C-39 · C-43.
 *
 * Continue appears here at glance level, as PLAN §3 orders for Q4: the
 * card on Listen (A-59) and the clip leg with its census truth (A-61) —
 * an AUDIO clip resumes at its saved second; a TEXT clip starts again
 * from the top. The deep Continue lesson is AD9's. The two Continue
 * doors are named distinctly, as the law requires: Listen's row PLAYS;
 * the Books shelf's «Continuar leyendo» card OPENS the book reader —
 * that door is Q5/AD9's and gets only a pointer here, never a lesson.
 *
 * Everything performed lands on the sealed scenario only: the stage's
 * fiction clips («Welcome to the harbour», «Low Tide, read aloud», the
 * Listen-later harbour text in Spanish) and its fiction marks. No real
 * clip, mark or draft is ever touched (PLAN §0.2, Fence 0).
 *
 * Anchors are registry ids only (anchors.ts). No duration is written
 * anywhere — the index label is computed from this script by the one
 * shared clock calibration (engine/clock.ts).
 */
import type { PresentationModule } from '../engine/types.ts'

export const Q4: PresentationModule = {
  id: 'Q4',
  floor: 'quick',
  title: { en: 'Save and Come Back', es: 'Guardar y volver' },
  capability: {
    en: 'Keep anything you hear — as finished audio or as text for later — and always find your way back to exactly where you stopped.',
    es: 'Guarda lo que escuches — como audio terminado o como texto para después — y vuelve siempre al punto exacto donde te detuviste.',
  },
  verifiedAgainst: '1.4.156',
  scenes: [
    {
      id: 'keep-this',
      chapter: { en: 'Keep this: audio or words', es: 'Guardar esto: audio o palabras' },
      steps: [
        {
          id: 'keep-ask',
          anchorId: 'listen-reader-save',
          act: 'ask',
          question: {
            en: 'How do you keep this text for another day?',
            es: '¿Cómo guardas este texto para otro día?',
          },
        },
        {
          id: 'keep-open-from-reader',
          anchorId: 'listen-reader-save',
          act: 'tap',
          establishes: 'keep-sheet-open',
          text: {
            en: 'While reading, Save opens the Keep this sheet.',
            es: 'Mientras lees, Guardar abre la hoja Guardar esto.',
          },
        },
        {
          id: 'keep-editor-door',
          anchorId: 'listen-save',
          act: 'say',
          optional: true,
          text: {
            en: 'The editor bar holds the same door.',
            es: 'La barra del editor tiene la misma puerta.',
          },
        },
        {
          id: 'keep-sheet-header',
          anchorId: 'listen-keep-sheet',
          act: 'say',
          text: {
            en: 'The sheet confirms what you are keeping before you choose how.',
            es: 'La hoja confirma qué estás guardando antes de elegir cómo.',
          },
        },
        {
          id: 'keep-audio',
          anchorId: 'listen-keep-audio',
          act: 'tap',
          text: {
            en: 'Save the audio turns the whole text into a file.',
            es: 'Guardar el audio convierte todo el texto en un archivo.',
          },
        },
        {
          id: 'keep-audio-lands',
          anchorId: 'listen-keep-audio',
          act: 'say',
          text: {
            en: 'It lands in your Library: offline, shareable, yours.',
            es: 'Llega a tu Biblioteca: sin conexión, compartible, tuyo.',
          },
        },
        {
          id: 'keep-audio-queue',
          anchorId: 'listen-keep-audio',
          act: 'say',
          text: {
            en: 'If another render is running, yours waits its turn.',
            es: 'Si otro audio se está creando, el tuyo espera su turno.',
          },
        },
        {
          id: 'keep-later',
          anchorId: 'listen-keep-later',
          act: 'tap',
          text: {
            en: 'Listen later keeps only the words, instantly.',
            es: 'Escuchar después guarda solo las palabras, al instante.',
          },
        },
        {
          id: 'keep-later-consequence',
          anchorId: 'listen-keep-later',
          act: 'say',
          text: {
            en: 'No file exists yet; make the audio whenever you like.',
            es: 'Aún no hay archivo; crea el audio cuando quieras.',
          },
        },
        {
          id: 'keep-note',
          anchorId: 'listen-keep-note',
          act: 'say',
          optional: true,
          text: {
            en: 'Already kept? This note says which kind, and opens it.',
            es: '¿Ya lo guardaste? Esta nota dice cuál es y lo abre.',
          },
        },
      ],
    },
    {
      id: 'saved-shelf',
      chapter: { en: 'The Saved shelf', es: 'El estante Guardado' },
      steps: [
        {
          id: 'shelf-goto',
          anchorId: 'shell-nav:library',
          act: 'goto',
          establishes: 'saved-shelf',
          text: {
            en: 'Everything you keep lives in the Library.',
            es: 'Todo lo que guardas vive en la Biblioteca.',
          },
        },
        {
          id: 'shelf-two',
          anchorId: 'lib-shelf-tabs',
          act: 'say',
          text: {
            en: 'Two shelves: Saved keeps clips; Books keeps whole books.',
            es: 'Dos estantes: Guardado guarda clips; Libros, libros enteros.',
          },
        },
        {
          id: 'shelf-empty',
          anchorId: 'lib-shelf-tabs',
          act: 'say',
          text: {
            en: 'An empty shelf names its doors: a web page, audio.',
            es: 'Un estante vacío nombra sus puertas: página web, audio.',
          },
        },
        {
          id: 'shelf-add',
          anchorId: 'lib-add',
          act: 'say',
          text: {
            en: 'On Saved, the + brings in a web page.',
            es: 'En Guardado, el + trae una página web.',
          },
        },
        {
          id: 'shelf-search',
          anchorId: 'lib-saved-search',
          act: 'type',
          payload: { value: 'honey' },
          text: {
            en: 'Search reads inside the text, not just titles.',
            es: 'La búsqueda lee dentro del texto, no solo los títulos.',
          },
        },
        {
          id: 'shelf-filters',
          anchorId: 'lib-saved-filters',
          act: 'tap',
          text: {
            en: 'Filters line up your shelf: Later, New, Favorites, Finished.',
            es: 'Los filtros ordenan el estante: Después, Nuevos, Favoritos, Terminados.',
          },
        },
      ],
    },
    {
      id: 'two-cards',
      chapter: { en: 'Two kinds of card', es: 'Dos clases de tarjeta' },
      steps: [
        {
          id: 'card-kinds',
          anchorId: 'lib-clip-card',
          act: 'say',
          text: {
            en: 'Each saved item is audio or text; its card says which.',
            es: 'Cada guardado es audio o texto; su tarjeta lo dice.',
          },
        },
        {
          id: 'card-audio-play',
          anchorId: 'lib-clip-play',
          act: 'tap',
          text: {
            en: 'An audio card plays right here, resuming its place.',
            es: 'La tarjeta de audio suena aquí, retomando su lugar.',
          },
        },
        {
          id: 'card-audio-meta',
          anchorId: 'lib-clip-meta',
          act: 'say',
          text: {
            en: 'Read it without playing: time left, voice, format and size declare themselves.',
            es: 'Léela sin reproducir: tiempo, voz, formato y tamaño se declaran solos.',
          },
        },
        {
          id: 'card-text-listen',
          anchorId: 'lib-clip-play',
          act: 'tap',
          text: {
            en: 'A text card opens inside Listen, already playing.',
            es: 'La tarjeta de texto se abre en Escuchar, ya sonando.',
          },
        },
        {
          id: 'card-text-meta',
          anchorId: 'lib-clip-meta',
          act: 'say',
          text: {
            en: 'A text card counts words, and estimates the listening.',
            es: 'La de texto cuenta palabras y estima la escucha.',
          },
        },
        {
          id: 'card-fav',
          anchorId: 'lib-clip-fav',
          act: 'tap',
          text: {
            en: 'One tap on the star files it under Favorites.',
            es: 'Un toque en la estrella lo archiva en Favoritos.',
          },
        },
        {
          id: 'card-more',
          anchorId: 'lib-clip-more',
          act: 'say',
          text: {
            en: 'Behind ⋯ waits the full menu for each item.',
            es: 'Tras el ⋯ espera el menú completo de cada guardado.',
          },
        },
      ],
    },
    {
      id: 'text-to-audio',
      chapter: { en: 'From text to audio', es: 'De texto a audio' },
      steps: [
        {
          id: 'make-ask',
          anchorId: 'lib-clip-make-audio',
          act: 'ask',
          question: {
            en: 'Your saved words have no file yet. Now what?',
            es: 'Tus palabras guardadas aún no tienen archivo. ¿Qué sigue?',
          },
        },
        {
          id: 'make-audio',
          anchorId: 'lib-clip-make-audio',
          act: 'tap',
          text: {
            en: 'Make audio renders this text in your listening voice.',
            es: 'Hacer audio crea este texto con tu voz de escucha.',
          },
        },
        {
          id: 'make-audio-borrows',
          anchorId: 'lib-clip-make-audio',
          act: 'say',
          text: {
            en: 'It borrows your listening speed and chosen format.',
            es: 'Toma tu velocidad de escucha y tu formato elegido.',
          },
        },
        {
          id: 'make-audio-menu-door',
          anchorId: 'lib-menu-make-audio',
          act: 'say',
          optional: true,
          text: {
            en: 'The same Make audio also lives in the ⋯ menu.',
            es: 'Ese mismo Hacer audio vive también en el menú ⋯.',
          },
        },
        {
          id: 'make-audio-transforms',
          anchorId: 'lib-clip-card',
          act: 'say',
          text: {
            en: 'When it finishes, the same item is audio. No duplicate.',
            es: 'Al terminar, el mismo guardado ya es audio. Sin duplicados.',
          },
        },
        {
          id: 'make-audio-fresh',
          anchorId: 'lib-clip-card',
          act: 'say',
          text: {
            en: 'It starts fresh, from the beginning, as sound.',
            es: 'Comienza de nuevo, desde el principio, ya como sonido.',
          },
        },
      ],
    },
    {
      id: 'moment-marks',
      chapter: { en: 'Moment marks', es: 'Marcas de momento' },
      steps: [
        {
          id: 'mark-goto-listen',
          anchorId: 'shell-nav:listen',
          act: 'goto',
          establishes: 'reading',
          text: {
            en: 'Back in Listen, the harbour text is playing.',
            es: 'De vuelta en Escuchar, suena el texto del puerto.',
          },
        },
        {
          id: 'mark-ask',
          anchorId: 'listen-mark',
          act: 'ask',
          question: {
            en: 'A sentence deserves keeping. How do you mark it?',
            es: 'Una frase merece guardarse. ¿Cómo la marcas?',
          },
        },
        {
          id: 'mark-tap',
          anchorId: 'listen-mark',
          act: 'tap',
          text: {
            en: 'This button marks the sentence sounding right now.',
            es: 'Este botón marca la frase que suena ahora mismo.',
          },
        },
        {
          id: 'mark-in-book',
          anchorId: 'listen-mark',
          act: 'say',
          text: {
            en: "Inside a book, the mark joins the book's marks.",
            es: 'Dentro de un libro, la marca se une a sus marcas.',
          },
        },
        {
          id: 'mark-loose',
          anchorId: 'listen-mark',
          act: 'say',
          text: {
            en: 'On loose text, it becomes a Library mark.',
            es: 'En un texto suelto, se convierte en marca de Biblioteca.',
          },
        },
        {
          id: 'mark-goto-library',
          anchorId: 'shell-nav:library',
          act: 'goto',
          text: {
            en: 'All your marks gather in one shelf.',
            es: 'Todas tus marcas se reúnen en un estante.',
          },
        },
        {
          id: 'mark-shelf',
          anchorId: 'lib-marks',
          act: 'say',
          text: {
            en: 'This shelf appears only once a mark exists.',
            es: 'Este estante aparece solo cuando existe una marca.',
          },
        },
      ],
    },
    {
      id: 'continue',
      chapter: { en: 'Continue: back without hunting', es: 'Continuar: volver sin buscar' },
      steps: [
        {
          id: 'continue-goto',
          anchorId: 'shell-nav:listen',
          act: 'goto',
          text: {
            en: 'Leave, wander, return: Listen keeps your place.',
            es: 'Sal, pasea, vuelve: Escuchar guarda tu lugar.',
          },
        },
        {
          id: 'continue-card',
          anchorId: 'listen-continue',
          act: 'say',
          text: {
            en: 'Continue offers everything unfinished, newest first.',
            es: 'Continuar ofrece todo lo inconcluso, lo reciente primero.',
          },
        },
        {
          id: 'continue-legs',
          anchorId: 'listen-continue',
          act: 'say',
          text: {
            en: 'One door each: a book, a clip, a loose text.',
            es: 'Una puerta para cada uno: libro, clip, texto suelto.',
          },
        },
        {
          id: 'continue-clip-audio',
          anchorId: 'listen-continue-clip',
          act: 'tap',
          text: {
            en: 'An audio clip resumes at its saved second.',
            es: 'Un clip de audio continúa en su segundo guardado.',
          },
        },
        {
          id: 'continue-clip-text-truth',
          anchorId: 'listen-continue-clip',
          act: 'say',
          text: {
            en: 'But a text clip starts over, from the top.',
            es: 'Pero un clip de texto empieza otra vez, desde arriba.',
          },
        },
        {
          id: 'continue-two-doors',
          anchorId: 'listen-continue',
          act: 'say',
          text: {
            en: "Careful: the shelf's Continue reading opens books; this plays.",
            es: 'Ojo: el Continuar leyendo del estante abre libros; este suena.',
          },
        },
        {
          id: 'continue-close',
          anchorId: 'listen-continue',
          act: 'say',
          text: {
            en: 'What you keep, you can always find again.',
            es: 'Lo que guardas, siempre puedes volver a encontrarlo.',
          },
        },
      ],
    },
  ],
}
