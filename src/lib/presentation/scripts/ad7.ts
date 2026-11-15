/**
 * AD7 · El libro a fondo / The Book in Depth — the open book, whole.
 *
 * Coverage (PLAN §2.5 — AD7 owns 31 census items, all from census C):
 * the five sorts and what "Recently read" really means (C-51) · changing
 * the sort changes what every tile SAYS (C-55) · the book menu's life:
 * favorite (C-61), finish by hand KEEPING the place (C-63), rename title
 * AND author (C-65), delete behind a confirm with a six-second Undo
 * (C-66) · the mistake clinic: formats refused by name with their remedy
 * (C-69), one bad file never stops a batch and a warning outranks the
 * count (C-72), machine names never become titles (C-73) · Logos builds
 * chapters, contents and links the file never brought (C-76) · the book
 * that isn't there any more (C-83) · the chapter eyebrow's asymmetry
 * (C-85) · two jump landings for two intents (C-87) · contents that know
 * where you are (C-89) · a bookmark row jumps to its paragraph (C-92) ·
 * copy takes the paragraph alone (C-96) · closing the toolbar, two ways
 * (C-97) · in-book search folds accents and capitals — the explicit pair
 * with AD6's Saved search, which does NOT fold (C-99) · honest caps:
 * the count stops at 500+ and the list shows 120 rows (C-100) · picking
 * a result paints the word in the text itself (C-101) · the find bar
 * walks matches without re-searching, wraps, and never stacks Back
 * (C-102) · internal links (C-103), external links leaving safely
 * (C-104), the note read in its place (C-105) · the Back stack, thirty
 * deep, pushed jumps only (C-106) · the bar's Listen seat in its three
 * faces (C-109) · the honest drag: shown numbers are the RESTING ones
 * (C-110) · the seek bar's keyboard, 5% steps (C-111) · the end card
 * and finishing by hand (C-113) · the type sheet: size 11–30 (C-114) ·
 * font and spacing — the book's OWN knob, not Listen's (C-115) · the
 * precise sweep: exactly TWO survivors (C-80, AD7's precise half).
 * The place saving itself by words, and reading past 98.5% finishing
 * the book, ride scene 4 as the percent bar's own foundation (C-121's
 * consequence, at the book's anchors).
 *
 * BENCH HEDGES (PLAN §2.6), declared: item 7 — the note-in-place lesson
 * teaches the rule's SHAPE (short, far away, note-shaped) as the code
 * states it; no caption claims each condition was toggled on a bench.
 * Item 6 — the two-survivor sweep is taught as the code states it
 * (books.ts sweepTempBooks), not as bench-acted fact.
 *
 * NOT here: the whole-book vs remainder distinction (C-98) is AD9's
 * headline and is never duplicated; Make audiobook exists only inside
 * BookInfo at ≥1500px and is AD13's — this module carries exactly one
 * pointer line, in its closing beat, and performs nothing toward it.
 *
 * Performed ONLY on the scenario fiction: the mini-book «The Lighthouse
 * Letter / La carta del faro» (scenario/fiction.ts BOOK_META /
 * BOOK_CONTENT — three chapters, one internal link to the note that
 * opens chapter 3, one note). Title and capability are the catalogue's
 * own words, verbatim (PLAN §3 owns them; registration refuses drift).
 *
 * Captions: bilingual, each ≤15 words in BOTH languages (the C′ caption
 * law), consequences stated, never implied. No duration literal
 * anywhere — the index label is computed from this script.
 */
import type { PresentationModule } from '../engine/types.ts'

export const AD7: PresentationModule = {
  id: 'AD7',
  floor: 'advanced',
  title: { en: 'The Book in Depth', es: 'El libro a fondo' },
  capability: {
    en: 'Move inside a book like you own it: contents, in-book search, links and notes in their place, and an honest map of where you are.',
    es: 'Muévete dentro de un libro como si fuera tuyo: contenidos, búsqueda interna, enlaces y notas en su sitio, y un mapa honesto de dónde estás.',
  },
  verifiedAgainst: '1.4.156',
  scenes: [
    {
      id: 'contents-know-where-you-are',
      chapter: { en: 'Contents that know where you are', es: 'Contenidos que saben dónde estás' },
      steps: [
        {
          id: 'ad7-open-say',
          anchorId: 'bk-tile',
          act: 'say',
          text: {
            en: 'Back to the harbour book — this time, everything inside it.',
            es: 'De vuelta al libro del puerto: esta vez, todo su interior.',
          },
        },
        {
          id: 'ad7-open-tap',
          anchorId: 'bk-tile',
          act: 'tap',
          establishes: 'book-open',
          text: {
            en: 'Open it: the book resumes exactly where it stopped.',
            es: 'Ábrelo: el libro continúa exactamente donde se detuvo.',
          },
        },
        {
          id: 'ad7-eyebrow',
          anchorId: 'book-eyebrow',
          act: 'say',
          text: {
            en: 'Chapter one shows the author here; later chapters count themselves.',
            es: 'El capítulo uno muestra aquí al autor; los demás se numeran.',
          },
        },
        {
          id: 'ad7-contents-tap',
          anchorId: 'book-head-toc',
          act: 'tap',
          establishes: 'contents-open',
          text: {
            en: 'Open Contents: the whole map of the book appears.',
            es: 'Abre Contenidos: aparece el mapa completo del libro.',
          },
        },
        {
          id: 'ad7-contents-current',
          anchorId: 'book-toc-current',
          act: 'say',
          text: {
            en: 'One row glows: the chapter you are standing in.',
            es: 'Una fila brilla: el capítulo donde estás parado.',
          },
        },
        {
          id: 'ad7-contents-ask',
          anchorId: 'book-toc-list',
          act: 'ask',
          question: {
            en: 'Must you scroll the book to know your chapter?',
            es: '¿Debes recorrer el libro para saber tu capítulo?',
          },
        },
        {
          id: 'ad7-contents-answer',
          anchorId: 'book-toc-current',
          act: 'say',
          text: {
            en: 'No. Contents already knows, and brings that row to you.',
            es: 'No. Contenidos ya lo sabe, y te trae esa fila.',
          },
        },
        {
          id: 'ad7-furniture',
          anchorId: 'book-toc-list',
          act: 'say',
          text: {
            en: 'No chapters in the file? Logos builds them, and the links.',
            es: '¿El archivo no traía capítulos? Logos los construye, y los enlaces.',
          },
        },
        {
          id: 'ad7-contents-jump',
          anchorId: 'book-toc-row',
          act: 'tap',
          text: {
            en: 'Tap The Storm: you land at its very first line.',
            es: 'Toca La tormenta: aterrizas en su primera línea.',
          },
        },
        {
          id: 'ad7-landing',
          anchorId: 'book-page',
          act: 'say',
          text: {
            en: 'Jumps land at the top. Found words land in context.',
            es: 'Los saltos aterrizan arriba. Las palabras halladas, en su contexto.',
          },
        },
        {
          id: 'ad7-marks-tab',
          anchorId: 'book-toc-tabs',
          act: 'tap',
          text: {
            en: "The second tab keeps this book's own bookmarks.",
            es: 'La segunda pestaña guarda los marcadores de este libro.',
          },
        },
        {
          id: 'ad7-marks-order',
          anchorId: 'book-marks-list',
          act: 'say',
          text: {
            en: 'Here they stand in book order, first to last.',
            es: 'Aquí están en orden del libro, del primero al último.',
          },
        },
        {
          id: 'ad7-marks-jump',
          anchorId: 'book-marks-row',
          act: 'tap',
          optional: true,
          text: {
            en: 'Tap one, and you land on its exact paragraph.',
            es: 'Toca uno, y aterrizas en su párrafo exacto.',
          },
        },
      ],
    },
    {
      id: 'search-inside-the-book',
      chapter: { en: 'Search inside the book', es: 'Buscar dentro del libro' },
      steps: [
        {
          id: 'ad7-search-open',
          anchorId: 'book-head-search',
          act: 'tap',
          establishes: 'book-search-open',
          text: {
            en: 'Now the other search — the one inside the book.',
            es: 'Ahora la otra búsqueda: la de dentro del libro.',
          },
        },
        {
          id: 'ad7-search-ask',
          anchorId: 'book-search-input',
          act: 'ask',
          question: {
            en: 'Saved search respects accents. Does this one?',
            es: 'La búsqueda de Guardado respeta los acentos. ¿Esta también?',
          },
        },
        {
          id: 'ad7-search-type',
          anchorId: 'book-search-input',
          act: 'type',
          payload: { value: 'LAMP' },
          text: {
            en: 'Type LAMP in capitals: every lamp in the book answers.',
            es: 'Escribe LAMP en mayúsculas: cada lámpara del libro responde.',
          },
        },
        {
          id: 'ad7-search-folds',
          anchorId: 'book-search-count',
          act: 'say',
          text: {
            en: 'Capitals and accents fold away here. Saved search keeps them apart.',
            es: 'Aquí mayúsculas y acentos se pliegan. En Guardado quedan separados.',
          },
        },
        {
          id: 'ad7-search-caps',
          anchorId: 'book-search-count',
          act: 'say',
          text: {
            en: 'Counting stops at five hundred: the line honestly says 500+.',
            es: 'El conteo para en quinientos: la línea dice 500+, sin mentir.',
          },
        },
        {
          id: 'ad7-search-rows',
          anchorId: 'book-search-row',
          act: 'say',
          text: {
            en: 'The list shows 120 rows — the count, not the list, is truth.',
            es: 'La lista muestra 120 filas: la verdad es el conteo.',
          },
        },
        {
          id: 'ad7-search-pick',
          anchorId: 'book-search-row',
          act: 'tap',
          text: {
            en: 'Tap a row: the sheet closes, the word stands painted.',
            es: 'Toca una fila: la hoja se cierra, la palabra queda pintada.',
          },
        },
        {
          id: 'ad7-search-landing',
          anchorId: 'book-search-paint',
          act: 'say',
          text: {
            en: 'It lands mid-screen, in its sentence — scroll, it stays painted.',
            es: 'Aterriza a media pantalla, en su frase: desplázate, sigue pintada.',
          },
        },
        {
          id: 'ad7-findbar',
          anchorId: 'book-findbar',
          act: 'say',
          text: {
            en: 'This bar now walks the matches, no searching again.',
            es: 'Esta barra ahora recorre los hallazgos, sin buscar de nuevo.',
          },
        },
        {
          id: 'ad7-find-next',
          anchorId: 'book-find-next',
          act: 'tap',
          text: {
            en: 'Step forward: at the last match, it wraps around.',
            es: 'Avanza: en el último hallazgo, vuelve a empezar.',
          },
        },
        {
          id: 'ad7-find-noback',
          anchorId: 'book-findbar',
          act: 'say',
          text: {
            en: 'Steps never stack Back entries: one Back leaves the search whole.',
            es: 'Los pasos no apilan Atrás: un solo Atrás abandona la búsqueda entera.',
          },
        },
        {
          id: 'ad7-find-close',
          anchorId: 'book-find-close',
          act: 'tap',
          text: {
            en: 'Close the bar, and the painted word washes away.',
            es: 'Cierra la barra, y la palabra pintada se borra.',
          },
        },
      ],
    },
    {
      id: 'links-and-the-note',
      chapter: { en: 'Links and the note in its place', es: 'Enlaces y la nota en su sitio' },
      steps: [
        {
          id: 'ad7-link-say',
          anchorId: 'book-link',
          act: 'say',
          text: {
            en: 'Some words wear a link: the letter points onward.',
            es: 'Algunas palabras llevan enlace: la carta apunta más adelante.',
          },
        },
        {
          id: 'ad7-link-ask',
          anchorId: 'book-link',
          act: 'ask',
          question: {
            en: 'Tap it — do you lose your place forever?',
            es: 'Tócalo: ¿pierdes tu lugar para siempre?',
          },
        },
        {
          id: 'ad7-link-tap',
          anchorId: 'book-link',
          act: 'tap',
          text: {
            en: 'Watch: this one does not take you anywhere.',
            es: 'Mira: este no te lleva a ninguna parte.',
          },
        },
        {
          id: 'ad7-note-sheet',
          anchorId: 'book-note-sheet',
          act: 'say',
          text: {
            en: 'The note opens here, in its place, over the text.',
            es: 'La nota se abre aquí, en su sitio, sobre el texto.',
          },
        },
        {
          id: 'ad7-note-rule',
          anchorId: 'book-note-sheet',
          act: 'say',
          text: {
            en: 'Short, far away, note-shaped: those links read where you stand.',
            es: 'Corta, lejana, con forma de nota: esas se leen donde estás.',
          },
        },
        {
          id: 'ad7-note-other',
          anchorId: 'book-note-sheet',
          act: 'say',
          text: {
            en: 'Every other link simply takes you to its place.',
            es: 'Cualquier otro enlace te lleva, sin más, a su lugar.',
          },
        },
        {
          id: 'ad7-note-go',
          anchorId: 'book-note-go',
          act: 'tap',
          text: {
            en: 'Prefer going? This button jumps — and arms Back.',
            es: '¿Prefieres ir? Este botón salta, y arma el Atrás.',
          },
        },
        {
          id: 'ad7-back-tap',
          anchorId: 'book-back',
          act: 'tap',
          text: {
            en: 'Tap Back: you return to the exact paragraph.',
            es: 'Toca Atrás: vuelves al párrafo exacto.',
          },
        },
        {
          id: 'ad7-back-stack',
          anchorId: 'book-back',
          act: 'say',
          text: {
            en: 'Back stacks thirty places deep — pushed jumps only.',
            es: 'Atrás apila hasta treinta lugares: solo saltos empujados.',
          },
        },
        {
          id: 'ad7-external',
          anchorId: 'book-link',
          act: 'say',
          text: {
            en: 'A web link leaves the book, opening a new tab.',
            es: 'Un enlace web sale del libro: abre una pestaña nueva.',
          },
        },
        {
          id: 'ad7-external-stays',
          anchorId: 'book-page',
          act: 'say',
          text: {
            en: 'The reader never moves: your place survives the detour.',
            es: 'El lector no se mueve: tu lugar sobrevive al desvío.',
          },
        },
      ],
    },
    {
      id: 'the-honest-percent-bar',
      chapter: { en: 'The honest percent bar', es: 'La barra del porcentaje honesta' },
      steps: [
        {
          id: 'ad7-bar-mid',
          anchorId: 'book-bar-mid',
          act: 'say',
          text: {
            en: 'This bar holds your whole position — and it never guesses.',
            es: 'Esta barra guarda tu posición entera, y nunca adivina.',
          },
        },
        {
          id: 'ad7-bar-ask',
          anchorId: 'book-seek',
          act: 'ask',
          question: {
            en: 'Drag toward the end. Where exactly do you land?',
            es: 'Arrastra hacia el final. ¿Dónde aterrizas exactamente?',
          },
        },
        {
          id: 'ad7-bar-drag',
          anchorId: 'book-seek',
          act: 'tap',
          text: {
            en: 'Drag it: the numbers follow your finger, honestly.',
            es: 'Arrástrala: los números siguen a tu dedo, con honestidad.',
          },
        },
        {
          id: 'ad7-bar-resting',
          anchorId: 'book-seek',
          act: 'say',
          text: {
            en: 'Shown percent and chapter are the resting ones, never raw.',
            es: 'Porcentaje y capítulo mostrados son los del descanso, nunca crudos.',
          },
        },
        {
          id: 'ad7-bar-release',
          anchorId: 'book-seek',
          act: 'say',
          text: {
            en: 'Release, and you land exactly there — Back remembers it.',
            es: 'Suelta, y aterrizas exactamente ahí: Atrás lo recuerda.',
          },
        },
        {
          id: 'ad7-bar-keys',
          anchorId: 'book-seek',
          act: 'key',
          payload: { key: 'ArrowRight' },
          text: {
            en: 'Focused, arrow keys walk the bar in five-percent steps.',
            es: 'Con foco, las flechas mueven la barra en pasos de cinco.',
          },
        },
        {
          id: 'ad7-bar-saves',
          anchorId: 'book-page',
          act: 'say',
          text: {
            en: 'Your place saves itself by words, about a second later.',
            es: 'Tu lugar se guarda solo, por palabras, un segundo después.',
          },
        },
        {
          id: 'ad7-bar-finish-auto',
          anchorId: 'book-page',
          act: 'say',
          text: {
            en: 'Cross 98.5% by reading: the book marks itself finished.',
            es: 'Cruza el 98,5% leyendo: el libro se marca terminado solo.',
          },
        },
        {
          id: 'ad7-bar-listen-faces',
          anchorId: 'book-bar-listen',
          act: 'say',
          text: {
            en: 'This Listen seat wears three faces, decided by state.',
            es: 'Este asiento de Escuchar tiene tres caras, según el estado.',
          },
        },
        {
          id: 'ad7-bar-listen-which',
          anchorId: 'book-bar-listen',
          act: 'say',
          text: {
            en: 'Your book playing: pause and follow. Another: pause only.',
            es: 'Si suena tu libro: pausa y seguir. Otro: solo pausa.',
          },
        },
        {
          id: 'ad7-bar-listen-tap',
          anchorId: 'book-bar-listen',
          act: 'tap',
          optional: true,
          text: {
            en: "Otherwise it starts this book from the screen's top paragraph.",
            es: 'Si no, empieza este libro desde el párrafo visible arriba.',
          },
        },
        {
          id: 'ad7-end-card',
          anchorId: 'book-end-finish',
          act: 'say',
          optional: true,
          text: {
            en: 'At the end: the λ, and one honest finishing door.',
            es: 'Al final: la λ, y una puerta honesta para terminar.',
          },
        },
        {
          id: 'ad7-end-finish',
          anchorId: 'book-end-finish',
          act: 'tap',
          optional: true,
          text: {
            en: 'Mark as finished by hand: done, without reading further.',
            es: 'Márcalo terminado a mano: hecho, sin leer más.',
          },
        },
      ],
    },
    {
      id: 'the-books-own-text-controls',
      chapter: { en: 'The book’s own text controls', es: 'Los controles de texto del libro' },
      steps: [
        {
          id: 'ad7-tools-again',
          anchorId: 'book-block:1',
          act: 'tap',
          establishes: 'paragraph-tools-open',
          text: {
            en: 'One more paragraph tap — this time, the remaining tools.',
            es: 'Un toque más a un párrafo: esta vez, las demás herramientas.',
          },
        },
        {
          id: 'ad7-copy',
          anchorId: 'book-act-copy',
          act: 'tap',
          text: {
            en: 'Copy takes this paragraph alone — no title, no neighbours.',
            es: 'Copiar toma este párrafo solo: sin título ni vecinos.',
          },
        },
        {
          id: 'ad7-copy-heard',
          anchorId: 'book-page',
          act: 'say',
          text: {
            en: 'And copied words sit one bubble tap from being heard.',
            es: 'Y lo copiado queda a un toque de burbuja de escucharse.',
          },
        },
        {
          id: 'ad7-tools-reopen',
          anchorId: 'book-block:1',
          act: 'tap',
          establishes: 'paragraph-tools-open',
          text: {
            en: 'Tap the paragraph once more for its tools.',
            es: 'Toca el párrafo otra vez para ver sus herramientas.',
          },
        },
        {
          id: 'ad7-close',
          anchorId: 'book-act-close',
          act: 'tap',
          text: {
            en: 'The X closes the tools. So does re-tapping the paragraph.',
            es: 'La X cierra las herramientas. Retocar el párrafo, también.',
          },
        },
        {
          id: 'ad7-type-open',
          anchorId: 'book-head-type',
          act: 'tap',
          establishes: 'type-sheet-open',
          text: {
            en: 'Different surface: the Text sheet dresses every book.',
            es: 'Otra superficie: la hoja Texto viste a todos los libros.',
          },
        },
        {
          id: 'ad7-size',
          anchorId: 'book-type-size-plus',
          act: 'tap',
          text: {
            en: 'Size steps one point at a time, eleven to thirty.',
            es: 'El tamaño avanza un punto cada vez, de once a treinta.',
          },
        },
        {
          id: 'ad7-font',
          anchorId: 'book-type-font',
          act: 'tap',
          text: {
            en: 'Tap the font: serif to sans — the text changes face.',
            es: 'Toca la fuente: de serif a sans, el texto se reviste.',
          },
        },
        {
          id: 'ad7-lines',
          anchorId: 'book-type-lines',
          act: 'tap',
          text: {
            en: 'Change the spacing: every book you open wears it.',
            es: 'Cambia el interlineado: lo lleva cada libro que abras.',
          },
        },
        {
          id: 'ad7-two-knobs',
          anchorId: 'book-head-type',
          act: 'say',
          text: {
            en: "This knob is the book's. Listen's size is another, in Settings.",
            es: 'Esta perilla es del libro. La de Escuchar es otra, en Ajustes.',
          },
        },
      ],
    },
    {
      id: 'only-once-two-survivors',
      chapter: { en: 'Only once, and its two survivors', es: 'Solo una vez, y sus dos supervivientes' },
      steps: [
        {
          id: 'ad7-sort',
          anchorId: 'bk-shelf-sort',
          act: 'tap',
          text: {
            en: 'Tap Sort: five orders; Recently read means recently opened.',
            es: 'Toca Ordenar: cinco órdenes; Recientemente leído significa abierto hace poco.',
          },
        },
        {
          id: 'ad7-subtitle',
          anchorId: 'bk-tile',
          act: 'say',
          text: {
            en: 'Change sorts, and every tile changes its words too.',
            es: 'Cambia el orden, y cada portada cambia también sus palabras.',
          },
        },
        {
          id: 'ad7-subtitle-dates',
          anchorId: 'bk-tile',
          act: 'say',
          text: {
            en: 'Dates ride only under Recently read. Vanished is not lost.',
            es: 'Las fechas solo viajan con ese orden. Oculto no es perdido.',
          },
        },
        {
          id: 'ad7-clinic-formats',
          anchorId: 'bk-shelf-import',
          act: 'say',
          text: {
            en: 'Some formats are refused by name, with their remedy.',
            es: 'Algunos formatos se rechazan por nombre, con su remedio.',
          },
        },
        {
          id: 'ad7-clinic-remedy',
          anchorId: 'bk-shelf-import',
          act: 'say',
          text: {
            en: 'Save it as EPUB or PDF, and import that instead.',
            es: 'Guárdalo como EPUB o PDF, e impórtalo así.',
          },
        },
        {
          id: 'ad7-clinic-batch',
          anchorId: 'bk-shelf-import',
          act: 'say',
          text: {
            en: 'One bad file never stops a batch; warnings outrank counts.',
            es: 'Un archivo malo nunca detiene un lote; el aviso manda.',
          },
        },
        {
          id: 'ad7-clinic-names',
          anchorId: 'bk-tile',
          act: 'say',
          text: {
            en: 'Machine file names never become titles: its words name it.',
            es: 'Los nombres de máquina nunca son títulos: lo nombran sus palabras.',
          },
        },
        {
          id: 'ad7-menu-open',
          anchorId: 'bk-tile-more',
          act: 'tap',
          establishes: 'book-menu-open',
          text: {
            en: "Open this book's menu: its whole shelf life lives here.",
            es: 'Abre el menú de este libro: aquí vive su vida entera.',
          },
        },
        {
          id: 'ad7-menu-fav',
          anchorId: 'bk-menu-fav',
          act: 'tap',
          text: {
            en: 'Favorite it: the star and the Favorites filter follow.',
            es: 'Hazlo favorito: la estrella y el filtro Favoritos lo siguen.',
          },
        },
        {
          id: 'ad7-menu-rename',
          anchorId: 'bk-menu-rename',
          act: 'tap',
          text: {
            en: 'Rename offers two fields: title and author both.',
            es: 'Renombrar ofrece dos campos: título y autor.',
          },
        },
        {
          id: 'ad7-rename-author',
          anchorId: 'bk-rename-author',
          act: 'say',
          text: {
            en: 'The author may be emptied; the title may not.',
            es: 'El autor puede vaciarse; el título, no.',
          },
        },
        {
          id: 'ad7-menu-finish',
          anchorId: 'bk-menu-done',
          act: 'tap',
          text: {
            en: 'Finish it by hand — and notice: its place survives.',
            es: 'Termínalo a mano, y fíjate: su lugar sobrevive.',
          },
        },
        {
          id: 'ad7-finish-unfinish',
          anchorId: 'bk-menu-done',
          act: 'say',
          text: {
            en: 'Un-finish it, and Continue reading resumes exactly there.',
            es: 'Quítale el terminado, y Continuar leyendo sigue exactamente ahí.',
          },
        },
        {
          id: 'ad7-delete',
          anchorId: 'bk-menu-delete',
          act: 'tap',
          text: {
            en: 'Tap Delete: it asks first, always.',
            es: 'Toca Borrar: pregunta primero, siempre.',
          },
        },
        {
          id: 'ad7-delete-final',
          anchorId: 'bk-menu-delete',
          act: 'say',
          text: {
            en: 'Confirm: Undo for six seconds; then final, no trash.',
            es: 'Confirmas: Deshacer por seis segundos; luego, definitivo, sin papelera.',
          },
        },
        {
          id: 'ad7-temp-precise',
          anchorId: 'bk-tile-temp',
          act: 'say',
          text: {
            en: 'The sweep keeps exactly two: the heard book, the latest opened.',
            es: 'La limpieza guarda exactamente dos: el escuchado y el recién abierto.',
          },
        },
        {
          id: 'ad7-temp-third',
          anchorId: 'bk-tile-temp',
          act: 'say',
          text: {
            en: 'Open a third book, and the oldest visitor silently leaves.',
            es: 'Abre un tercer libro, y el visitante más viejo sale en silencio.',
          },
        },
        {
          id: 'ad7-temp-silent',
          anchorId: 'bk-tile-temp',
          act: 'say',
          text: {
            en: 'No toast, no Undo, no trash: gone with its bookmarks.',
            es: 'Sin aviso, sin Deshacer, sin papelera: se va con sus marcadores.',
          },
        },
        {
          id: 'ad7-menu-temp',
          anchorId: 'bk-menu-temp',
          act: 'say',
          optional: true,
          text: {
            en: 'Missed the question? The same switch lives in this menu.',
            es: '¿Perdiste la pregunta? El mismo interruptor vive en este menú.',
          },
        },
        {
          id: 'ad7-missing',
          anchorId: 'book-missing',
          act: 'say',
          optional: true,
          text: {
            en: "Follow a swept book's door: 'This book isn't here any more.'",
            es: 'Sigue la puerta de un libro limpiado: «Este libro ya no está».',
          },
        },
        {
          id: 'ad7-audiobook-pointer',
          anchorId: 'bk-tile',
          act: 'say',
          text: {
            en: 'Making the audiobook lives elsewhere: the large-screens module.',
            es: 'Hacer el audiolibro vive en otro módulo: el de pantallas grandes.',
          },
        },
      ],
    },
  ],
}
