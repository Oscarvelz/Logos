/**
 * Q5 · Libros / Books — the Quick module for the Books shelf and the open book.
 *
 * Coverage (PLAN §2.5 — Q5 owns 32 census items, all from census C):
 * the import doors and the formats Logos reads (C-67, C-68) · the importing
 * card (C-59) · the fork every learner must know — ONE book imported alone
 * starts playing at once, SEVERAL import one by one and none plays (C-70,
 * C-71) · every book is born "for now" (C-75) · the KeepAsk question: five
 * seconds, Keep is the only tap that changes anything, and Once / timeout /
 * closing are the same answer (C-77, C-78, C-79) · what "for now" costs —
 * the sweep when another book takes the floor (C-80) · the decision stays
 * on the cover: the Keep / Once badge is itself a switch, no confirmation
 * either way (C-56, C-81) · reading a tile (C-54) · shelf search reads
 * titles and authors only (C-49) · the five filters (C-50) · cover sizes,
 * remembered (C-52) · the shelf's «Continuar leyendo» card OPENS the reader
 * at your place — the opposite deed of Listen's Continue, which plays, and
 * every caption names them distinctly (C-53) · a book opens where you left
 * it (C-82) · the reader header's map (C-84) · Contents and Bookmarks, two
 * tabs of one sheet (C-90) · tapping a contents entry jumps (C-91) ·
 * scrolling IS the place (C-86) · tap a paragraph and get its toolbar
 * (C-93) · the toolbar's bookmark (C-95) · Listen from here reads to the
 * END of the book (C-94) · the bottom bar's middle — percent, and a tap
 * opens Contents (C-108) · previous / next chapter chevrons (C-107) ·
 * the Next card at a chapter's end (C-112).
 *
 * Performed ONLY on the scenario fiction: the mini-book «The Lighthouse
 * Letter / La carta del faro» (scenario/fiction.ts BOOK_META /
 * BOOK_CONTENT), imported by the scene itself exactly as a learner imports
 * it — it is never pre-loaded onto the scenario shelf. The import tap
 * establishes the KeepAsk window the next scene resolves inside.
 *
 * Q5 does NOT promise Make audiobook: that door exists only inside
 * BookInfo at ≥1500px and belongs to AD13 (census C-120 / §C-X-1). It is
 * not mentioned here at all.
 *
 * Captions: bilingual, each ≤15 words in BOTH languages (the C′ caption
 * law), consequences stated, never implied. No duration literal anywhere —
 * the index label is computed from this script by the shared clock.
 */
import type { PresentationModule } from '../engine/types.ts'

export const Q5: PresentationModule = {
  id: 'Q5',
  floor: 'quick',
  title: { en: 'Books', es: 'Libros' },
  capability: {
    en: 'Bring your books in, decide whether each one stays or visits only once, and listen to any of them from any paragraph.',
    es: 'Trae tus libros, decide si cada uno se queda o visita solo una vez, y escucha cualquiera de ellos desde cualquier párrafo.',
  },
  verifiedAgainst: '1.4.156',
  scenes: [
    {
      id: 'bring-a-book-in',
      chapter: { en: 'Bring a book in', es: 'Trae un libro' },
      steps: [
        {
          id: 'q5-shelf',
          anchorId: 'bk-shelf-import',
          act: 'say',
          text: {
            en: "Books live here, on the Library's Books shelf.",
            es: 'Los libros viven aquí, en la estantería Libros de la Biblioteca.',
          },
        },
        {
          id: 'q5-import-tap',
          anchorId: 'bk-shelf-import',
          effectAnchorId: 'bk-keepask',
          act: 'tap',
          establishes: 'keepask-window',
          text: {
            en: 'Tap Import, and pick one book from your files.',
            es: 'Toca Importar y elige un libro de tus archivos.',
          },
        },
        {
          id: 'q5-importing-card',
          anchorId: 'bk-importing',
          act: 'say',
          text: {
            en: 'This card works aloud: opening, reading chapters, linking.',
            es: 'Esta tarjeta trabaja en voz alta: abrir, leer capítulos, enlazar.',
          },
        },
        {
          id: 'q5-one-book-ask',
          anchorId: 'bk-importing',
          act: 'ask',
          question: {
            en: 'You imported just one book. What happens now?',
            es: 'Importaste un solo libro. ¿Qué pasa ahora?',
          },
        },
        {
          id: 'q5-one-book-plays',
          anchorId: 'bk-importing',
          act: 'say',
          text: {
            en: 'It starts playing at once, from the beginning.',
            es: 'Empieza a sonar al instante, desde el principio.',
          },
        },
        {
          id: 'q5-several-wait',
          anchorId: 'bk-importing',
          act: 'say',
          text: {
            en: 'Import several instead, and none plays: they wait shelved.',
            es: 'Importa varios, y ninguno suena: esperan en la estantería.',
          },
        },
      ],
    },
    {
      id: 'keep-or-only-once',
      chapter: { en: 'Keep it, or only once?', es: '¿Conservarlo o solo una vez?' },
      steps: [
        {
          id: 'q5-born-for-now',
          anchorId: 'bk-keepask',
          act: 'say',
          text: {
            en: "Every new book arrives 'for now', never promised forever.",
            es: 'Todo libro nuevo llega «por ahora», sin promesa de quedarse.',
          },
        },
        {
          id: 'q5-five-seconds',
          anchorId: 'bk-keepask',
          act: 'say',
          text: {
            en: 'One question appears, and its bar drains in five seconds.',
            es: 'Aparece una pregunta, y su barra se vacía en cinco segundos.',
          },
        },
        {
          id: 'q5-once-is-same',
          anchorId: 'bk-keepask-once',
          act: 'say',
          text: {
            en: 'Once, closing the sheet, or waiting: all answer the same.',
            es: 'Solo una vez, cerrar o esperar: todo responde lo mismo.',
          },
        },
        {
          id: 'q5-keep-tap',
          anchorId: 'bk-keepask-keep',
          effectAnchorId: 'bk-tile',
          act: 'tap',
          text: {
            en: 'Tap Keep, and this book stays in your library.',
            es: 'Toca Conservar, y este libro se queda en tu biblioteca.',
          },
        },
        {
          id: 'q5-the-sweep',
          anchorId: 'bk-tile-temp',
          act: 'say',
          text: {
            en: "A 'for now' book leaves when another book takes over.",
            es: 'Un libro «por ahora» se va cuando otro libro toma su lugar.',
          },
        },
        {
          id: 'q5-badge-is-switch',
          anchorId: 'bk-tile-temp',
          act: 'tap',
          text: {
            en: 'Missed the question? This cover badge is the same switch.',
            es: '¿Perdiste la pregunta? La insignia de la portada es el mismo interruptor.',
          },
        },
        {
          id: 'q5-badge-flips',
          anchorId: 'bk-tile-temp',
          act: 'say',
          text: {
            en: 'It flips instantly, both ways, with no confirmation asked.',
            es: 'Cambia al instante, en ambos sentidos, sin pedir confirmación.',
          },
        },
      ],
    },
    {
      id: 'the-shelf-and-your-place',
      chapter: { en: 'The shelf and your place', es: 'La estantería y tu lugar' },
      steps: [
        {
          id: 'q5-reading-a-tile',
          anchorId: 'bk-tile',
          act: 'say',
          text: {
            en: "A cover reports at a glance: format, star, and how far you've read.",
            es: 'Cada portada informa de un vistazo: formato, estrella y tu avance.',
          },
        },
        {
          id: 'q5-shelf-search',
          anchorId: 'bk-shelf-search',
          effectAnchorId: 'bk-tile',
          act: 'type',
          payload: { value: 'Lighthouse' },
          text: {
            en: 'Shelf search reads titles and authors only, never inside.',
            es: 'La búsqueda lee títulos y autores, nunca el interior.',
          },
        },
        {
          id: 'q5-search-clear',
          anchorId: 'bk-shelf-search',
          effectAnchorId: 'bk-tile',
          act: 'type',
          payload: { value: '' },
          text: {
            en: 'Clear the search, and the whole shelf comes back.',
            es: 'Borra la búsqueda, y vuelve toda la estantería.',
          },
        },
        {
          id: 'q5-filters',
          anchorId: 'bk-shelf-filters',
          effectAnchorId: 'bk-tile',
          act: 'tap',
          text: {
            en: 'Tap the filters: reading, new, favorites, finished.',
            es: 'Toca los filtros: en curso, nuevos, favoritos, terminados.',
          },
        },
        {
          id: 'q5-cover-sizes',
          anchorId: 'bk-cover-size',
          effectAnchorId: 'bk-tile',
          act: 'tap',
          text: {
            en: 'Three cover sizes, and the shelf remembers your pick.',
            es: 'Tres tamaños de portada, y la estantería recuerda tu elección.',
          },
        },
        {
          id: 'q5-continue-ask',
          anchorId: 'bk-shelf-continue',
          act: 'ask',
          question: {
            en: 'This card says Continue reading. Does it play aloud?',
            es: 'Esta tarjeta dice Continuar leyendo. ¿Suena en voz alta?',
          },
        },
        {
          id: 'q5-continue-opens',
          anchorId: 'bk-shelf-continue',
          act: 'say',
          text: {
            en: 'No. It opens the reader, exactly where you stopped.',
            es: 'No. Abre el lector, exactamente donde te detuviste.',
          },
        },
        {
          id: 'q5-two-continues',
          anchorId: 'bk-shelf-continue',
          act: 'say',
          text: {
            en: 'The Continue that plays lives in Listen, not here.',
            es: 'El Continuar que suena vive en Escuchar, no aquí.',
          },
        },
        {
          id: 'q5-continue-tap',
          anchorId: 'bk-shelf-continue',
          effectAnchorId: 'book-page',
          act: 'tap',
          establishes: 'book-open',
          text: {
            en: 'Tap it, and the book opens at your place.',
            es: 'Tócala, y el libro se abre en tu lugar.',
          },
        },
      ],
    },
    {
      id: 'inside-the-book',
      chapter: { en: 'Inside the book', es: 'Dentro del libro' },
      steps: [
        {
          id: 'q5-opens-where-left',
          anchorId: 'book-page',
          act: 'say',
          text: {
            en: 'A book always opens where you left it.',
            es: 'Un libro siempre se abre donde lo dejaste.',
          },
        },
        {
          id: 'q5-header-map',
          anchorId: 'book-head-toc',
          act: 'say',
          text: {
            en: 'Three header doors: find a word, jump by chapters, dress the text.',
            es: 'Tres puertas arriba: buscar una palabra, saltar capítulos, vestir el texto.',
          },
        },
        {
          id: 'q5-contents-open',
          anchorId: 'book-head-toc',
          effectAnchorId: 'book-side-toc',
          act: 'tap',
          establishes: 'contents-open',
          text: {
            en: "Tap Contents to see the book's whole map.",
            es: 'Toca Contenidos para ver el mapa completo del libro.',
          },
        },
        {
          id: 'q5-two-tabs',
          anchorId: 'book-toc-tabs',
          act: 'say',
          text: {
            en: 'One sheet, two tabs: Contents and Bookmarks together.',
            es: 'Una hoja, dos pestañas: Contenidos y Marcadores juntos.',
          },
        },
        {
          id: 'q5-contents-jump',
          anchorId: 'book-toc-row',
          effectAnchorId: 'book-page',
          act: 'tap',
          text: {
            en: 'Tap any chapter, and you land at its start.',
            es: 'Toca un capítulo, y aterrizas en su comienzo.',
          },
        },
        {
          id: 'q5-scrolling-is-place',
          anchorId: 'book-page',
          act: 'scroll',
          payload: { direction: 'down' },
          text: {
            en: 'Just scroll: where you stop is your saved place.',
            es: 'Solo desplázate: donde paras es tu lugar guardado.',
          },
        },
      ],
    },
    {
      id: 'tap-a-paragraph',
      chapter: { en: 'Tap a paragraph', es: 'Toca un párrafo' },
      steps: [
        {
          id: 'q5-bar-middle',
          anchorId: 'book-bar-mid',
          act: 'say',
          text: {
            en: 'The bar below shows your percent; tap it for Contents.',
            es: 'La barra inferior muestra tu porcentaje; tócala para Contenidos.',
          },
        },
        {
          id: 'q5-chapter-arrows',
          anchorId: 'book-next-ch',
          act: 'say',
          text: {
            en: 'These edge arrows step one chapter, forward or back.',
            es: 'Estas flechas laterales avanzan o retroceden un capítulo.',
          },
        },
        {
          id: 'q5-next-card',
          anchorId: 'book-next-card',
          effectAnchorId: 'book-page',
          act: 'tap',
          optional: true,
          text: {
            en: "At a chapter's end, this card offers the next chapter.",
            es: 'Al final de un capítulo, esta tarjeta ofrece el siguiente.',
          },
        },
        {
          id: 'q5-paragraph-tap',
          anchorId: 'book-block:1',
          effectAnchorId: 'book-actions',
          act: 'tap',
          establishes: 'paragraph-tools-open',
          text: {
            en: 'Tap any paragraph, and its hidden tools appear.',
            es: 'Toca un párrafo, y aparecen sus herramientas escondidas.',
          },
        },
        {
          id: 'q5-four-tools',
          anchorId: 'book-actions',
          act: 'say',
          text: {
            en: 'Four tools: listen from here, bookmark, copy, close.',
            es: 'Cuatro herramientas: escuchar desde aquí, marcar, copiar, cerrar.',
          },
        },
        {
          id: 'q5-bookmark-it',
          anchorId: 'book-act-bookmark',
          act: 'tap',
          text: {
            en: "Bookmark keeps this place in the book's own list.",
            es: 'Marcar guarda este lugar en la lista del libro.',
          },
        },
        {
          id: 'q5-paragraph-again',
          anchorId: 'book-block:1',
          effectAnchorId: 'book-actions',
          act: 'tap',
          establishes: 'paragraph-tools-open',
          text: {
            en: 'Tap the paragraph once more for its tools.',
            es: 'Toca el párrafo otra vez para ver sus herramientas.',
          },
        },
        {
          id: 'q5-listen-from-here',
          anchorId: 'book-act-listen',
          effectAnchorId: 'book-page',
          act: 'tap',
          text: {
            en: "Listen from here reads on to the book's end.",
            es: 'Escuchar desde aquí lee hasta el final del libro.',
          },
        },
      ],
    },
  ],
}
