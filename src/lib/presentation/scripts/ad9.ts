/**
 * AD9 · Nunca pierdes el hilo / You Never Lose the Thread — Advanced floor.
 *
 * Coverage (PLAN §2.5 — AD9 owns 19 census items):
 * A-13 · A-59 · A-60 · A-61 · A-62 · A-63 · C-29 · C-40 · C-41 · C-44 ·
 * C-45 · C-46 · C-47 · C-48 · C-64 · C-98 · C-121 · C-122 · F-43.
 *
 * Title, capability promise and chapter titles are copied VERBATIM from
 * catalogue.ts — the catalogue owns the words; registration refuses a
 * script that disagrees with them.
 *
 * The deep Continue lesson (Q4 carried it at glance level): Continue's
 * three legs are named distinctly and never confused with the Books
 * shelf's «Continuar leyendo» card — that door OPENS the reader; Listen's
 * rows PLAY. The clip leg is taught with its census truth (A-61): an
 * AUDIO clip resumes at its saved second, a TEXT clip loads and plays
 * FROM THE TOP. Behind the text leg sits the resume tracking (A-63):
 * every sentence change writes the place down.
 *
 * The loose mark's orphan (C-46) follows the §2.6-11 bench hedge: it is
 * taught exactly as the code states it — replace the draft and the tap
 * refuses with its toast; the mark stays on the shelf as words. Nothing
 * stronger is promised.
 *
 * Removing a mark has NO Undo (C-47) and the script says so plainly.
 * Endings are taught as asymmetries (C-28/C-63, C-29/C-64, C-40/C-41):
 * finishing a clip erases its place, finishing a book keeps it. The
 * book's saving bound is honest (C-121): about a second of reading.
 *
 * Everything performed lands on the sealed scenario only: the fiction
 * book «The Lighthouse Letter», the fiction clips and the fiction loose
 * mark. No real book, clip, mark or draft is ever touched
 * (PLAN §0.2, Fence 0).
 *
 * Anchors are registry ids only (anchors.ts). No duration is written
 * anywhere — the index label is computed from this script by the one
 * shared clock calibration (engine/clock.ts).
 */
import type { PresentationModule } from '../engine/types.ts'

export const AD9: PresentationModule = {
  id: 'AD9',
  floor: 'advanced',
  title: { en: 'You Never Lose the Thread', es: 'Nunca pierdes el hilo' },
  capability: {
    en: 'Never lose your place again: understand Continue’s three legs, your marks, and what survives pausing, closing and coming back.',
    es: 'No vuelvas a perder tu lugar: entiende las tres patas de Continuar, tus marcas y lo que sobrevive a pausar, cerrar y volver.',
  },
  verifiedAgainst: '1.4.156',
  scenes: [
    {
      id: 'three-legs',
      chapter: { en: 'Continue’s three legs', es: 'Las tres patas de Continuar' },
      steps: [
        {
          id: 'legs-goto',
          anchorId: 'shell-nav:listen',
          act: 'goto',
          establishes: 'on-listen',
          text: {
            en: 'Open Listen: your unfinished listening waits at the top.',
            es: 'Abre Escuchar: tu escucha inconclusa espera arriba.',
          },
        },
        {
          id: 'legs-card',
          anchorId: 'listen-continue',
          act: 'say',
          text: {
            en: 'Continue shows at most three doors, newest first.',
            es: 'Continuar muestra tres puertas como máximo, recientes primero.',
          },
        },
        {
          id: 'legs-card-empty',
          anchorId: 'listen-continue',
          act: 'say',
          text: {
            en: 'Nothing unfinished? The card simply never appears.',
            es: '¿Nada inconcluso? La tarjeta simplemente no aparece.',
          },
        },
        {
          id: 'legs-book-ask',
          anchorId: 'listen-continue-book',
          act: 'ask',
          question: {
            en: 'What does the book door promise?',
            es: '¿Qué promete la puerta del libro?',
          },
        },
        {
          id: 'legs-book-tap',
          anchorId: 'listen-continue-book',
          act: 'tap',
          text: {
            en: 'The book row names its percent already read.',
            es: 'La fila del libro nombra su porcentaje ya leído.',
          },
        },
        {
          id: 'legs-book-plays',
          anchorId: 'listen-continue-book',
          act: 'say',
          text: {
            en: 'Tap it, and the book plays from its saved place.',
            es: 'Tócala y el libro suena desde su lugar guardado.',
          },
        },
        {
          id: 'legs-bridge',
          anchorId: 'listen-back-to-book',
          act: 'say',
          text: {
            en: 'The head now offers Back to book, the way back.',
            es: 'La cabecera ofrece ahora Volver al libro, el camino de vuelta.',
          },
        },
        {
          id: 'legs-bridge-saves',
          anchorId: 'listen-back-to-book',
          act: 'say',
          text: {
            en: 'It saves your listening place before the jump.',
            es: 'Guarda tu lugar de escucha antes del salto.',
          },
        },
        {
          id: 'legs-text-ask',
          anchorId: 'listen-continue-text',
          act: 'ask',
          question: {
            en: 'And the loose text you pasted earlier?',
            es: '¿Y el texto suelto que pegaste antes?',
          },
        },
        {
          id: 'legs-text-tap',
          anchorId: 'listen-continue-text',
          act: 'tap',
          text: {
            en: 'Its row names the sentence where you stopped.',
            es: 'Su fila nombra la frase donde te detuviste.',
          },
        },
        {
          id: 'legs-text-conditions',
          anchorId: 'listen-continue-text',
          act: 'say',
          text: {
            en: 'It appears only while that same draft sits in Listen.',
            es: 'Aparece solo mientras ese mismo borrador sigue en Escuchar.',
          },
        },
        {
          id: 'legs-clip-pointer',
          anchorId: 'listen-continue-clip',
          act: 'say',
          text: {
            en: 'The third door is the clip. Its promise needs care.',
            es: 'La tercera puerta es el clip. Su promesa pide cuidado.',
          },
        },
        {
          id: 'legs-two-doors',
          anchorId: 'listen-continue',
          act: 'say',
          text: {
            en: "Careful: the shelf's Continue reading opens books; this one plays.",
            es: 'Ojo: el Continuar leyendo del estante abre libros; este suena.',
          },
        },
      ],
    },
    {
      id: 'clip-leg-honestly',
      chapter: { en: 'The clip leg, honestly', es: 'La pata del clip, con honestidad' },
      steps: [
        {
          id: 'clip-goto',
          anchorId: 'shell-nav:library',
          act: 'goto',
          establishes: 'saved-shelf',
          text: {
            en: 'In Saved, a half-heard audio clip waits.',
            es: 'En Guardado espera un clip de audio a medias.',
          },
        },
        {
          id: 'clip-play',
          anchorId: 'lib-clip-play',
          act: 'tap',
          text: {
            en: 'Play it: the clip resumes where it stopped.',
            es: 'Reprodúcelo: el clip continúa donde se detuvo.',
          },
        },
        {
          id: 'clip-self-tracks',
          anchorId: 'lib-clip-play',
          act: 'say',
          text: {
            en: 'While it plays, it saves its place every few seconds.',
            es: 'Mientras suena, guarda su lugar cada pocos segundos.',
          },
        },
        {
          id: 'clip-pause-saves',
          anchorId: 'lib-clip-play',
          act: 'say',
          text: {
            en: 'Pause, and it saves again, right then.',
            es: 'Pausa, y vuelve a guardar, en el acto.',
          },
        },
        {
          id: 'clip-close-cost',
          anchorId: 'lib-clip-play',
          act: 'say',
          text: {
            en: 'Close the app mid-clip: five seconds lost, at most.',
            es: 'Cierra la app a mitad: pierdes cinco segundos como máximo.',
          },
        },
        {
          id: 'clip-goto-listen',
          anchorId: 'shell-nav:listen',
          act: 'goto',
          text: {
            en: 'Back in Listen, the same clip gets a door.',
            es: 'De vuelta en Escuchar, el mismo clip tiene puerta.',
          },
        },
        {
          id: 'clip-row',
          anchorId: 'listen-continue-clip',
          act: 'tap',
          text: {
            en: 'The audio row says Left at — its exact saved second.',
            es: 'La fila de audio anuncia el segundo exacto donde quedó.',
          },
        },
        {
          id: 'clip-audio-resumes',
          anchorId: 'listen-continue-clip',
          act: 'say',
          text: {
            en: 'Tap, and the sound continues at that very second.',
            es: 'Toca, y el sonido continúa en ese mismo segundo.',
          },
        },
        {
          id: 'clip-text-ask',
          anchorId: 'listen-continue-clip',
          act: 'ask',
          question: {
            en: 'Does a text clip keep that same promise?',
            es: '¿Un clip de texto guarda esa misma promesa?',
          },
        },
        {
          id: 'clip-text-truth',
          anchorId: 'listen-continue-clip',
          act: 'say',
          text: {
            en: 'No. A text clip loads and plays from the top.',
            es: 'No. Un clip de texto carga y suena desde arriba.',
          },
        },
        {
          id: 'clip-text-row',
          anchorId: 'listen-continue-clip',
          act: 'say',
          text: {
            en: 'Its row names no second — only the saved words.',
            es: 'Su fila no nombra ningún segundo: solo las palabras guardadas.',
          },
        },
        {
          id: 'text-tracking',
          anchorId: 'listen-continue-text',
          act: 'say',
          text: {
            en: 'Each new sentence writes your place down, silently.',
            es: 'Cada frase nueva escribe tu lugar, en silencio.',
          },
        },
        {
          id: 'text-tracking-survives',
          anchorId: 'listen-continue-text',
          act: 'say',
          text: {
            en: 'Close, crash, wander off: the pasted text keeps its place.',
            es: 'Cierra, falla, pasea: el texto pegado conserva su lugar.',
          },
        },
      ],
    },
    {
      id: 'marks-shelf',
      chapter: { en: 'Marks on their shelf', es: 'Las marcas en su estante' },
      steps: [
        {
          id: 'marks-goto',
          anchorId: 'shell-nav:library',
          act: 'goto',
          establishes: 'saved-shelf',
          text: {
            en: 'Above your clips lives a smaller shelf: Marks.',
            es: 'Sobre tus clips vive un estante menor: las Marcas.',
          },
        },
        {
          id: 'marks-born',
          anchorId: 'lib-marks',
          act: 'say',
          text: {
            en: 'It exists only because a mark exists.',
            es: 'Existe solo porque existe una marca.',
          },
        },
        {
          id: 'marks-ask',
          anchorId: 'lib-marks-row',
          act: 'ask',
          question: {
            en: 'What gathers on this one shelf?',
            es: '¿Qué se reúne en este único estante?',
          },
        },
        {
          id: 'marks-two-kinds',
          anchorId: 'lib-marks-row',
          act: 'say',
          text: {
            en: 'Book marks and loose marks, newest first.',
            es: 'Marcas de libro y marcas sueltas, recientes primero.',
          },
        },
        {
          id: 'marks-thirty',
          anchorId: 'lib-marks-row',
          act: 'say',
          text: {
            en: 'The shelf shows the latest thirty marks.',
            es: 'El estante muestra las últimas treinta marcas.',
          },
        },
        {
          id: 'marks-rest-in-book',
          anchorId: 'lib-marks-row',
          act: 'say',
          text: {
            en: 'Older book marks live on inside their book, in book order.',
            es: 'Las marcas viejas viven dentro de su libro, en orden del libro.',
          },
        },
        {
          id: 'marks-book-tap',
          anchorId: 'lib-marks-row',
          act: 'tap',
          text: {
            en: 'Tap a book mark: the book plays from there.',
            es: 'Toca una marca de libro: el libro suena desde ahí.',
          },
        },
        {
          id: 'marks-book-lands',
          anchorId: 'lib-marks-row',
          act: 'say',
          text: {
            en: 'You land in Listen, mid-book, already playing.',
            es: 'Aterrizas en Escuchar, a mitad del libro, ya sonando.',
          },
        },
        {
          id: 'marks-whole-book',
          anchorId: 'listen-continue-book',
          act: 'say',
          text: {
            en: 'That door loaded the whole book into Listen.',
            es: 'Esa puerta cargó el libro entero en Escuchar.',
          },
        },
        {
          id: 'marks-open-book',
          anchorId: 'book-page',
          act: 'goto',
          establishes: 'book-open',
          text: {
            en: 'Open the book itself, at the same page.',
            es: 'Abre el libro mismo, en la misma página.',
          },
        },
        {
          id: 'marks-tap-paragraph',
          anchorId: 'book-block:1',
          act: 'tap',
          establishes: 'paragraph-toolbar',
          text: {
            en: 'Tap a paragraph, and its actions appear.',
            es: 'Toca un párrafo y aparecen sus acciones.',
          },
        },
        {
          id: 'marks-listen-from',
          anchorId: 'book-act-listen',
          act: 'tap',
          text: {
            en: 'Listen from here plays from this paragraph onward.',
            es: 'Escuchar desde aquí suena desde este párrafo en adelante.',
          },
        },
        {
          id: 'marks-remainder',
          anchorId: 'book-act-listen',
          act: 'say',
          text: {
            en: 'Only the remainder loads — not the whole book.',
            es: 'Solo carga lo que resta, no el libro entero.',
          },
        },
        {
          id: 'marks-two-machines',
          anchorId: 'book-act-listen',
          act: 'say',
          text: {
            en: 'Same voice, different text underneath: whole, or remainder.',
            es: 'Misma voz, distinto texto debajo: entero, o el resto.',
          },
        },
        {
          id: 'marks-goto-shelf',
          anchorId: 'shell-nav:library',
          act: 'goto',
          text: {
            en: 'Back on the shelf, the other kind of mark waits.',
            es: 'De vuelta en el estante, espera la otra clase de marca.',
          },
        },
        {
          id: 'marks-loose-tap',
          anchorId: 'lib-marks-row',
          act: 'tap',
          text: {
            en: 'Tap the loose mark: its sentence sounds again.',
            es: 'Toca la marca suelta: su frase suena otra vez.',
          },
        },
        {
          id: 'marks-loose-draft',
          anchorId: 'lib-marks-row',
          act: 'say',
          text: {
            en: 'A loose mark points into a draft, not something saved.',
            es: 'Una marca suelta apunta a un borrador, no a algo guardado.',
          },
        },
        {
          id: 'marks-orphan',
          anchorId: 'lib-marks-row',
          act: 'say',
          text: {
            en: 'Replace that draft, and the same tap is refused.',
            es: 'Reemplaza ese borrador, y el mismo toque es rechazado.',
          },
        },
        {
          id: 'marks-orphan-words',
          anchorId: 'lib-marks-row',
          act: 'say',
          text: {
            en: 'A toast explains why; the mark stays, as words.',
            es: 'Un aviso explica por qué; la marca queda, como palabras.',
          },
        },
        {
          id: 'marks-cap',
          anchorId: 'lib-marks-row',
          act: 'say',
          text: {
            en: 'At one hundred twenty, the oldest loose mark silently leaves.',
            es: 'Al llegar a ciento veinte, la más vieja sale en silencio.',
          },
        },
        {
          id: 'marks-remove',
          anchorId: 'lib-mark-remove',
          act: 'tap',
          text: {
            en: 'Removing a mark always asks first.',
            es: 'Quitar una marca siempre pregunta primero.',
          },
        },
        {
          id: 'marks-remove-no-undo',
          anchorId: 'shell-confirm-host',
          act: 'say',
          text: {
            en: 'Confirm, and it is gone. There is no Undo.',
            es: 'Confirma y desaparece. No hay Deshacer.',
          },
        },
        {
          id: 'marks-remove-contrast',
          anchorId: 'lib-mark-remove',
          act: 'say',
          text: {
            en: 'Clips and books forgive deletions. Marks do not.',
            es: 'Los clips y libros perdonan borrados. Las marcas, no.',
          },
        },
      ],
    },
    {
      id: 'endings-asymmetries',
      chapter: { en: 'Endings and their asymmetries', es: 'Los finales y sus asimetrías' },
      steps: [
        {
          id: 'end-goto',
          anchorId: 'shell-nav:library',
          act: 'goto',
          establishes: 'saved-shelf',
          text: {
            en: 'Start with a clip that plays to its end.',
            es: 'Empieza con un clip que suena hasta el final.',
          },
        },
        {
          id: 'end-clip-files-itself',
          anchorId: 'lib-clip-play',
          act: 'say',
          text: {
            en: 'It files itself under Finished, its place cleared.',
            es: 'Se archiva solo en Terminados, con su lugar borrado.',
          },
        },
        {
          id: 'end-clip-replay',
          anchorId: 'lib-clip-play',
          act: 'tap',
          text: {
            en: 'Play a finished clip, and it un-finishes itself.',
            es: 'Reproduce un clip terminado y deja de estar terminado.',
          },
        },
        {
          id: 'end-clip-replay-truth',
          anchorId: 'lib-clip-play',
          act: 'say',
          text: {
            en: 'You cannot rehear it and keep it Finished.',
            es: 'No puedes reoírlo y conservarlo en Terminados.',
          },
        },
        {
          id: 'end-clip-menu',
          anchorId: 'lib-clip-more',
          act: 'tap',
          establishes: 'item-menu-open',
          text: {
            en: "The ⋯ menu holds the clip's ending doors.",
            es: 'El menú ⋯ guarda las puertas de cierre del clip.',
          },
        },
        {
          id: 'end-clip-ask',
          anchorId: 'lib-menu-done',
          act: 'ask',
          question: {
            en: 'What does finishing by hand do to its place?',
            es: '¿Qué le hace terminarlo a mano a su lugar?',
          },
        },
        {
          id: 'end-clip-finish',
          anchorId: 'lib-menu-done',
          act: 'tap',
          text: {
            en: "Mark finished also erases the clip's saved place.",
            es: 'Marcar terminado también borra el lugar guardado del clip.',
          },
        },
        {
          id: 'end-clip-unfinish',
          anchorId: 'lib-menu-done',
          act: 'tap',
          text: {
            en: 'Un-finishing brings back the clip, not its place.',
            es: 'Desmarcarlo devuelve el clip, no su lugar.',
          },
        },
        {
          id: 'end-clip-startover',
          anchorId: 'lib-menu-startover',
          act: 'tap',
          text: {
            en: 'Start over next time forgets only the resume point.',
            es: 'Empezar de nuevo solo olvida el punto de reanudación.',
          },
        },
        {
          id: 'end-book-menu',
          anchorId: 'bk-tile-more',
          act: 'tap',
          establishes: 'book-menu-open',
          text: {
            en: 'A book tile hides the same kind of doors.',
            es: 'La portada de un libro esconde puertas parecidas.',
          },
        },
        {
          id: 'end-book-ask',
          anchorId: 'bk-menu-done',
          act: 'ask',
          question: {
            en: 'Does a book end the same way?',
            es: '¿Un libro termina de la misma manera?',
          },
        },
        {
          id: 'end-book-finish',
          anchorId: 'bk-menu-done',
          act: 'tap',
          text: {
            en: 'A hand-finished book keeps its place untouched.',
            es: 'Un libro terminado a mano conserva intacto su lugar.',
          },
        },
        {
          id: 'end-book-unfinish',
          anchorId: 'bk-menu-done',
          act: 'say',
          text: {
            en: 'Un-finish it, and Continue reading finds that place again.',
            es: 'Desmárcalo, y Continuar leyendo encuentra ese lugar otra vez.',
          },
        },
        {
          id: 'end-book-startover',
          anchorId: 'bk-menu-startover',
          act: 'tap',
          text: {
            en: 'Start over resets the place — but its bookmarks survive.',
            es: 'Empezar de nuevo reinicia el lugar; sus marcadores sobreviven.',
          },
        },
        {
          id: 'end-book-last-page',
          anchorId: 'book-end-finish',
          act: 'say',
          optional: true,
          text: {
            en: 'At its last page, a book offers its own finish button.',
            es: 'En su última página, el libro ofrece su propio botón de terminar.',
          },
        },
      ],
    },
    {
      id: 'what-survives',
      chapter: { en: 'What survives closing the app', es: 'Lo que sobrevive a cerrar la app' },
      steps: [
        {
          id: 'survives-open',
          anchorId: 'book-page',
          act: 'goto',
          establishes: 'book-open',
          text: {
            en: 'Your book reopens exactly where you left it.',
            es: 'Tu libro se reabre exactamente donde lo dejaste.',
          },
        },
        {
          id: 'survives-throttle',
          anchorId: 'book-page',
          act: 'say',
          text: {
            en: 'Each move schedules its save a second later.',
            es: 'Cada movimiento programa su guardado un segundo después.',
          },
        },
        {
          id: 'survives-leaving',
          anchorId: 'book-page',
          act: 'say',
          text: {
            en: 'Leave the page, and the save happens at once.',
            es: 'Sal de la página, y el guardado ocurre al instante.',
          },
        },
        {
          id: 'survives-bound',
          anchorId: 'book-page',
          act: 'say',
          text: {
            en: 'Kill the app mid-scroll: the newest screenful may be lost.',
            es: 'Mata la app al desplazarte: puedes perder la última pantalla.',
          },
        },
        {
          id: 'survives-one-place',
          anchorId: 'book-page',
          act: 'say',
          text: {
            en: 'One stored place feeds every surface showing this book.',
            es: 'Un solo lugar guardado alimenta cada superficie de este libro.',
          },
        },
        {
          id: 'survives-everywhere',
          anchorId: 'book-page',
          act: 'say',
          text: {
            en: 'Tile, Continue card, reader: all read that same place.',
            es: 'Portada, tarjeta Continuar, lector: todos leen ese mismo lugar.',
          },
        },
        {
          id: 'survives-address',
          anchorId: 'book-page',
          act: 'say',
          text: {
            en: 'This book lives at its own address, identifier included.',
            es: 'Este libro vive en su propia dirección, identificador incluido.',
          },
        },
        {
          id: 'survives-ask',
          anchorId: 'book-page',
          act: 'ask',
          question: {
            en: 'So what does NOT survive?',
            es: '¿Y qué NO sobrevive?',
          },
        },
        {
          id: 'survives-goto-library',
          anchorId: 'shell-nav:library',
          act: 'goto',
          text: {
            en: 'Back in the Library, the honest exceptions wait.',
            es: 'De vuelta en la Biblioteca, esperan las excepciones honestas.',
          },
        },
        {
          id: 'survives-not-loose',
          anchorId: 'lib-marks-row',
          act: 'say',
          text: {
            en: 'A loose mark outlives its changed draft only as words.',
            es: 'Una marca suelta sobrevive a su borrador cambiado solo como palabras.',
          },
        },
        {
          id: 'survives-not-place',
          anchorId: 'lib-clip-card',
          act: 'say',
          text: {
            en: "A finished clip's place is gone for good.",
            es: 'El lugar de un clip terminado se perdió para siempre.',
          },
        },
        {
          id: 'survives-close',
          anchorId: 'lib-marks',
          act: 'say',
          text: {
            en: 'Pause, close, come back: your thread is still there.',
            es: 'Pausa, cierra, vuelve: tu hilo sigue ahí.',
          },
        },
      ],
    },
  ],
}
