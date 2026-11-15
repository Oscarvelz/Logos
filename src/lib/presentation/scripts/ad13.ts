/**
 * AD13 · Pantallas grandes / Large Screens — what each wide tier ADDS.
 *
 * Coverage (PLAN §2.5 — AD13 owns 20 census items): the 840 floor
 * (F-2, F-4, F-11, F-24) · the 1100 floor (F-25, F-26, C-88) · the
 * 1500 floor (F-27, F-28, C-2, F-29, C-116, C-117, C-118, C-119,
 * C-120, F-30, D-53) · the columns law (E-4, F-23, F-31).
 *
 * This module teaches ONLY what each tier adds — no phone lesson is
 * repeated. Its scenes exist where the screen exists: every anchor
 * here carries a breakpoint precondition in the registry, and the
 * closing beat says the honesty plainly (on a phone nothing hides;
 * it simply is not there).
 *
 * Make audiobook (C-120) has its ONLY home here, inside BookInfo at
 * ≥1500px — Q5 never promises it and AD7 points here. The tap queues
 * the scenario fiction book («The Lighthouse Letter / La carta del
 * faro») exactly as the real door queues a whole book: Auto voice per
 * paragraph, the Settings export speed and format.
 *
 * Title and capability are the catalogue's words, verbatim (the
 * catalogue owns the words). Captions: bilingual, each ≤15 words in
 * BOTH languages, consequences stated. No duration literal anywhere —
 * the index label is computed from this script by the shared clock.
 */
import type { PresentationModule } from '../engine/types.ts'

export const AD13: PresentationModule = {
  id: 'AD13',
  floor: 'advanced',
  title: { en: 'Large Screens', es: 'Pantallas grandes' },
  capability: {
    en: 'Use Logos on the big screen at full width: the rail, the tablet desk, the paragraph map, the book panel — and make an audiobook there.',
    es: 'Usa Logos en pantalla grande a todo ancho: el riel, el escritorio de tableta, el mapa de párrafos, el panel del libro — y crea un audiolibro ahí.',
  },
  verifiedAgainst: '1.4.156',
  scenes: [
    {
      id: 'the-rail-arrives',
      chapter: { en: '840: the rail arrives', es: '840: llega el riel' },
      steps: [
        {
          id: 'ad13-wide-house',
          anchorId: 'shell-rail',
          act: 'say',
          text: {
            en: 'On a wide screen, Logos is a different house.',
            es: 'En pantalla ancha, Logos es otra casa.',
          },
        },
        {
          id: 'ad13-bar-becomes-rail',
          anchorId: 'shell-rail',
          act: 'say',
          text: {
            en: 'Past 840 pixels, the bottom bar becomes this side rail.',
            es: 'Pasados 840 píxeles, la barra inferior se vuelve este riel.',
          },
        },
        {
          id: 'ad13-same-doors',
          anchorId: 'shell-nav:library',
          act: 'tap',
          text: {
            en: 'Same doors, same order: only their seat has changed.',
            es: 'Las mismas puertas, mismo orden: solo cambia su asiento.',
          },
        },
        {
          id: 'ad13-doors-land',
          anchorId: 'shell-nav:library',
          act: 'say',
          text: {
            en: 'You land in the Library, exactly as from the bar.',
            es: 'Llegas a la Biblioteca, igual que desde la barra.',
          },
        },
        {
          id: 'ad13-topbar-gone',
          anchorId: 'shell-brand-home',
          act: 'say',
          text: {
            en: "The top bar is gone: the brand crowns the rail.",
            es: 'La barra superior desaparece: la marca corona el riel.',
          },
        },
        {
          id: 'ad13-pill-moved',
          anchorId: 'shell-status-pill',
          act: 'say',
          text: {
            en: 'The voice pill moved too; in Listen, the heading hosts it.',
            es: 'La pastilla de voz también se mudó; en Escuchar vive en el encabezado.',
          },
        },
        {
          id: 'ad13-room-to-breathe',
          anchorId: 'shell-rail',
          act: 'say',
          text: {
            en: 'Everything breathes: a taller editor, larger titles, wider cards.',
            es: 'Todo respira: editor más alto, títulos mayores, tarjetas anchas.',
          },
        },
      ],
    },
    {
      id: 'the-tablet-desk',
      chapter: { en: '1100: the tablet desk', es: '1100: el escritorio de tableta' },
      steps: [
        {
          id: 'ad13-desk-appears',
          anchorId: 'desk-tablet',
          act: 'say',
          text: {
            en: 'Past 1100 pixels, a desk appears beside the player.',
            es: 'Pasados 1100 píxeles, aparece un escritorio junto al reproductor.',
          },
        },
        {
          id: 'ad13-desk-book-waits',
          anchorId: 'desk-book',
          act: 'say',
          text: {
            en: 'Your book in progress waits here, with its percent.',
            es: 'Tu libro en curso espera aquí, con su porcentaje.',
          },
        },
        {
          id: 'ad13-fav-chips',
          anchorId: 'desk-fav-voices',
          act: 'say',
          text: {
            en: 'Your favourite voices wait here too, as one-tap chips.',
            es: 'Tus voces favoritas también esperan aquí, como botones de un toque.',
          },
        },
        {
          id: 'ad13-fav-chip-tap',
          anchorId: 'desk-fav-voices',
          act: 'tap',
          text: {
            en: 'Tap a favourite chip, and that voice takes over.',
            es: 'Toca una voz favorita, y esa voz toma el mando.',
          },
        },
        {
          id: 'ad13-fav-height',
          anchorId: 'desk-fav-voices',
          act: 'say',
          optional: true,
          text: {
            en: 'On short screens this card hides; height decides, not width.',
            es: 'En pantallas bajas esta tarjeta se esconde; manda la altura.',
          },
        },
        {
          id: 'ad13-recents',
          anchorId: 'desk-recent',
          act: 'say',
          text: {
            en: 'Recent Library clips wait below, six at most.',
            es: 'Abajo esperan los clips recientes de la Biblioteca, seis máximo.',
          },
        },
        {
          id: 'ad13-recent-tap',
          anchorId: 'desk-recent',
          act: 'tap',
          text: {
            en: 'Tap one, and its text loads here in Listen.',
            es: 'Toca uno, y su texto se carga aquí en Escuchar.',
          },
        },
        {
          id: 'ad13-open-the-book',
          anchorId: 'desk-book',
          act: 'tap',
          establishes: 'book-open',
          text: {
            en: 'Now the book: tap it, and it opens.',
            es: 'Ahora el libro: tócalo, y se abre.',
          },
        },
        {
          id: 'ad13-side-toc',
          anchorId: 'book-side-toc',
          act: 'say',
          text: {
            en: 'At this width, Contents lives pinned beside the text.',
            es: 'A este ancho, Contenidos vive fijo junto al texto.',
          },
        },
        {
          id: 'ad13-contents-button-gone',
          anchorId: 'book-side-toc',
          act: 'say',
          text: {
            en: "So the header's Contents button disappears: the map never closes.",
            es: 'Por eso el botón Contenidos desaparece: el mapa nunca se cierra.',
          },
        },
        {
          id: 'ad13-side-marks',
          anchorId: 'book-side-toc',
          act: 'say',
          text: {
            en: 'Bookmarks share this panel, always in sight while reading.',
            es: 'Los marcadores comparten este panel, siempre visibles al leer.',
          },
        },
      ],
    },
    {
      id: 'the-book-panel-and-the-audiobook',
      chapter: { en: '1500: the book panel and the audiobook', es: '1500: el panel del libro y el audiolibro' },
      steps: [
        {
          id: 'ad13-third-column',
          anchorId: 'desk-textmap-stats',
          act: 'say',
          text: {
            en: 'Past 1500 pixels, Listen gains a third column.',
            es: 'Pasados 1500 píxeles, Escuchar gana una tercera columna.',
          },
        },
        {
          id: 'ad13-textmap-stats',
          anchorId: 'desk-textmap-stats',
          act: 'say',
          text: {
            en: 'This card is your text measured whole, before you dive in.',
            es: 'Esta tarjeta es tu texto medido entero, antes de entrar.',
          },
        },
        {
          id: 'ad13-textmap-tap',
          anchorId: 'desk-textmap-paragraphs',
          act: 'tap',
          text: {
            en: 'Tap any paragraph, and listening jumps to its first sentence.',
            es: 'Toca un párrafo, y la escucha salta a su primera frase.',
          },
        },
        {
          id: 'ad13-go-library',
          anchorId: 'shell-nav:library',
          act: 'goto',
          text: {
            en: 'In the Library, the two shelves stand side by side.',
            es: 'En la Biblioteca, los dos estantes están lado a lado.',
          },
        },
        {
          id: 'ad13-split-shelves',
          anchorId: 'lib-split',
          act: 'say',
          text: {
            en: 'No more switching shelves: Saved and Books stay both visible.',
            es: 'Ya no cambias de estante: Guardado y Libros quedan visibles.',
          },
        },
        {
          id: 'ad13-split-books',
          anchorId: 'lib-split-books',
          act: 'say',
          text: {
            en: 'Each column keeps its own header and its Import door.',
            es: 'Cada columna conserva su cabecera y su puerta de Importar.',
          },
        },
        {
          id: 'ad13-open-book-again',
          anchorId: 'bk-shelf-continue',
          act: 'tap',
          establishes: 'book-open',
          text: {
            en: 'Open the book again: a third column appears here too.',
            es: 'Abre el libro otra vez: aquí también aparece otra columna.',
          },
        },
        {
          id: 'ad13-info-ring',
          anchorId: 'book-info',
          act: 'say',
          text: {
            en: 'This ring answers at a glance: how far, which chapter, how long.',
            es: 'Este anillo responde de un vistazo: cuánto, qué capítulo, cuánto falta.',
          },
        },
        {
          id: 'ad13-info-stats',
          anchorId: 'book-info-stats',
          act: 'say',
          text: {
            en: 'The book in numbers tells its size before you commit hours.',
            es: 'El libro en cifras dice su tamaño antes de comprometer horas.',
          },
        },
        {
          id: 'ad13-info-marks',
          anchorId: 'book-info-marks',
          act: 'tap',
          text: {
            en: 'Newest first: tap one, and you land right there.',
            es: 'Del más nuevo primero: toca uno, y aterrizas ahí.',
          },
        },
        {
          id: 'ad13-info-actions',
          anchorId: 'book-info-listen',
          act: 'say',
          text: {
            en: "Listen, Search and Text repeat the header's doors here.",
            es: 'Escuchar, Buscar y Texto repiten aquí las puertas de la cabecera.',
          },
        },
        {
          id: 'ad13-audiobook-ask',
          anchorId: 'book-info-audiobook',
          act: 'ask',
          question: {
            en: 'One door exists only on this panel. Which one?',
            es: 'Una puerta existe solo en este panel. ¿Cuál es?',
          },
        },
        {
          id: 'ad13-audiobook-tap',
          anchorId: 'book-info-audiobook',
          act: 'tap',
          text: {
            en: 'Make audiobook: the whole book queues as one audio file.',
            es: 'Crear audiolibro: el libro entero entra en cola como un audio.',
          },
        },
        {
          id: 'ad13-audiobook-renders',
          anchorId: 'book-info-audiobook',
          act: 'say',
          text: {
            en: 'It renders with Auto voice, your export speed and format.',
            es: 'Se crea con voz automática, tu velocidad y formato de exportación.',
          },
        },
        {
          id: 'ad13-audiobook-only-here',
          anchorId: 'book-info-audiobook',
          act: 'say',
          text: {
            en: 'No phone shows this button: big screens only, by design.',
            es: 'Ningún teléfono muestra este botón: solo pantallas grandes, por diseño.',
          },
        },
        {
          id: 'ad13-go-create',
          anchorId: 'shell-nav:create',
          act: 'goto',
          text: {
            en: 'In Create, your recordings move in beside the form.',
            es: 'En Crear, tus grabaciones se mudan junto al formulario.',
          },
        },
        {
          id: 'ad13-recording-tap',
          anchorId: 'create-recordings',
          act: 'tap',
          text: {
            en: 'Tap a recording, and it plays without leaving Create.',
            es: 'Toca una grabación, y suena sin salir de Crear.',
          },
        },
        {
          id: 'ad13-recordings-count',
          anchorId: 'create-recordings',
          act: 'say',
          text: {
            en: 'Up to thirty newest recordings live here; phones use the Library.',
            es: 'Aquí viven hasta treinta grabaciones recientes; el teléfono usa la Biblioteca.',
          },
        },
      ],
    },
    {
      id: 'anchor-to-the-card',
      chapter: { en: 'Anchor to the card, never the position', es: 'Ancla en la tarjeta, nunca en la posición' },
      steps: [
        {
          id: 'ad13-go-settings',
          anchorId: 'shell-nav:settings',
          act: 'goto',
          text: {
            en: 'Back in Settings, notice how the cards now flow.',
            es: 'De vuelta en Ajustes, mira cómo fluyen las tarjetas.',
          },
        },
        {
          id: 'ad13-set-columns',
          anchorId: 'set-presentations',
          act: 'say',
          text: {
            en: 'Two columns at 1100, three at 1500: groups never split.',
            es: 'Dos columnas a los 1100, tres a los 1500: ningún grupo se parte.',
          },
        },
        {
          id: 'ad13-any-column',
          anchorId: 'set-presentations',
          act: 'say',
          text: {
            en: 'So a card may land in any column: position means nothing.',
            es: 'Así, una tarjeta puede caer en cualquier columna: la posición no significa nada.',
          },
        },
        {
          id: 'ad13-by-name',
          anchorId: 'set-presentations',
          act: 'say',
          text: {
            en: 'This lesson found its card by name, never by place.',
            es: 'Esta lección encontró su tarjeta por nombre, nunca por lugar.',
          },
        },
        {
          id: 'ad13-card-grows',
          anchorId: 'set-presentations',
          act: 'say',
          text: {
            en: 'This card grows on big screens; its words never end in dots.',
            es: 'Esta tarjeta crece en pantallas grandes; sus palabras nunca acaban en puntos.',
          },
        },
        {
          id: 'ad13-phone-honesty',
          anchorId: 'shell-rail',
          act: 'say',
          text: {
            en: 'On a phone, none of this hides: it simply is not there.',
            es: 'En el teléfono nada se esconde: simplemente no está.',
          },
        },
      ],
    },
  ],
}
