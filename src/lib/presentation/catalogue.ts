/**
 * The Presentation module catalogue — the Settings index's data (PLAN §3, §4).
 *
 * All 20 modules of the ladder — Quick Q0–Q5 and Advanced AD1–AD14 —
 * transcribed from PLAN §3: bilingual title, bilingual capability promise
 * (what the user will be able to DO when the module ends), and the scene
 * titles of the plan's corrected scene lists. Coverage behind every entry is
 * the plan's §2.5 map: each module owns its census items and no other.
 *
 * SCRIPTS LAND FLOOR BY FLOOR. Every entry is born with `script: null`;
 * a script registers through `registerPresentationScript` (which validates
 * it against the engine format before accepting it) when its build wave
 * lands — the Quick floor first, then Advanced. An entry must never pretend
 * a module can play before its script exists: the index shows the promise
 * and the state, and no Play control, until then.
 *
 * THERE IS NO DURATION ANYWHERE IN THIS FILE (FENCE-DESIGN §5, D-1).
 * A module's length is computed from its script by the one shared clock
 * calibration (engine/clock.ts) at Automatic 1×, and the index label is
 * «Aprox. N min» / "Approx. N min" (Oscar, 2026-11-14 — never «unos»,
 * never "about"). While a module has no script there is nothing honest to
 * compute, so `entryDuration` returns null and the index renders NO label
 * rather than a handwritten one.
 *
 * Progress is read through the presentation's own state file
 * (`logos.presentation.state.v1`, presentation-state.ts) — never a private
 * parser here. `stateFor` derives a card's announced state from that file
 * as a pure function so the index component stays a thin rendering of it.
 */
import { durationLabel, moduleDurationMs } from './engine/clock.ts'
import {
  assertValidPresentationModule,
  flattenSteps,
  type BilingualText,
  type ModuleProgressState,
  type PresentationFloor,
  type PresentationModule,
  type PresentationStateFile,
} from './engine/types.ts'
import { currentModuleId, moduleProgress } from './presentation-state.ts'

export interface CatalogueModule {
  id: string
  floor: PresentationFloor
  /** Module name, both languages (PLAN §3). */
  title: BilingualText
  /** The capability promise the index card carries (PLAN §3). */
  capability: BilingualText
  /** Chapter titles of the plan's scene list, both languages. */
  scenes: BilingualText[]
  /** The module's script; null until its scene wave lands. */
  script: PresentationModule | null
}

/** Where Resume re-enters a part-way module (the recorded exact point). */
export interface ResumePoint {
  step: number
  scene?: string
  stepId?: string
}

/** A card's announced state, plus its resume point when one is recorded. */
export interface CatalogueState {
  state: ModuleProgressState
  resume?: ResumePoint
}

const M = (
  id: string,
  floor: PresentationFloor,
  title: BilingualText,
  capability: BilingualText,
  scenes: BilingualText[],
): CatalogueModule => ({ id, floor, title, capability, scenes, script: null })

export const MODULE_CATALOGUE: readonly CatalogueModule[] = [
  // ── Quick floor — finish ready to listen to anything today (PLAN §3) ──
  M(
    'Q0',
    'quick',
    { en: 'The Whole Lap', es: 'La vuelta completa' },
    {
      en: 'Take one quick lap through the whole app — paste, listen, change the voice, save, and float the bubble — and know where everything lives.',
      es: 'Da una vuelta rápida por toda la app — pegar, escuchar, cambiar la voz, guardar y soltar la burbuja — y sabrás dónde vive cada cosa.',
    },
    [
      { en: 'Paste and listen', es: 'Pegar y escuchar' },
      { en: 'Touch a word, change the voice', es: 'Tocar una palabra, cambiar la voz' },
      { en: 'Save it and float the bubble', es: 'Guardarlo y soltar la burbuja' },
    ],
  ),
  M(
    'Q1',
    'quick',
    { en: 'Listen in a Minute', es: 'Escuchar en un minuto' },
    {
      en: 'Bring any text in and hear it within a minute, follow the voice in the reader, and jump to the exact word or sentence you want.',
      es: 'Trae cualquier texto y escúchalo en un minuto, sigue la voz en el lector y salta a la palabra o la frase exacta que buscas.',
    },
    [
      { en: 'Paste means play', es: 'Pegar es escuchar' },
      { en: 'The reader follows the voice', es: 'El lector sigue la voz' },
      { en: 'Touch a word to start there', es: 'Toca una palabra para empezar ahí' },
      { en: 'Sentences: the bar, back and forward', es: 'Frases: la barra, atrás y adelante' },
    ],
  ),
  M(
    'Q2',
    'quick',
    { en: 'The Bubble', es: 'La burbuja' },
    {
      en: 'Float the bubble from the λ, place it anywhere, and make anything you copy anywhere play with a single tap — then return to your reading.',
      es: 'Suelta la burbuja desde la λ, colócala donde quieras y haz que lo que copies en cualquier app suene con un solo toque — y luego vuelve a tu lectura.',
    },
    [
      { en: 'Tap the λ: the bubble floats', es: 'Toca la λ: la burbuja flota' },
      { en: 'Permission, and the second tap', es: 'El permiso y el segundo toque' },
      { en: 'Place it anywhere', es: 'Colócala donde quieras' },
      { en: 'Copy anywhere, tap, it plays', es: 'Copia donde sea, tócala y suena' },
      { en: 'When the copy ends, your reading returns', es: 'Al acabar lo copiado, vuelve tu lectura' },
    ],
  ),
  M(
    'Q3',
    'quick',
    { en: 'Voices', es: 'Voces' },
    {
      en: 'Choose among 57 voices with confidence: hear each one first, star your favourites, and set the voice each language speaks by default.',
      es: 'Elige entre 57 voces con confianza: escucha cada una antes, estrella tus favoritas y fija la voz con la que hablará cada idioma por defecto.',
    },
    [
      { en: 'The voice picker', es: 'El selector de voces' },
      { en: 'Automatic: one voice per language', es: 'Automática: una voz por idioma' },
      { en: 'Hear a voice before you choose it', es: 'Escucha una voz antes de elegirla' },
      { en: 'Favourites and defaults', es: 'Favoritos y predeterminadas' },
    ],
  ),
  M(
    'Q4',
    'quick',
    { en: 'Save and Come Back', es: 'Guardar y volver' },
    {
      en: 'Keep anything you hear — as finished audio or as text for later — and always find your way back to exactly where you stopped.',
      es: 'Guarda lo que escuches — como audio terminado o como texto para después — y vuelve siempre al punto exacto donde te detuviste.',
    },
    [
      { en: 'Keep this: audio or later', es: 'Guardar esto: audio o después' },
      { en: 'Your Library: Saved', es: 'Tu Biblioteca: Guardado' },
      { en: 'Continue: pick up where you stopped', es: 'Continuar: sigue donde ibas' },
      { en: 'Mark the moment', es: 'Marca el momento' },
    ],
  ),
  M(
    'Q5',
    'quick',
    { en: 'Books', es: 'Libros' },
    {
      en: 'Bring your books in, decide whether each one stays or visits only once, and listen to any of them from any paragraph.',
      es: 'Trae tus libros, decide si cada uno se queda o visita solo una vez, y escucha cualquiera de ellos desde cualquier párrafo.',
    },
    [
      { en: 'Bring a book in', es: 'Trae un libro' },
      { en: 'Keep it, or only once', es: 'Conservarlo, o solo una vez' },
      { en: 'Open it where you left it', es: 'Ábrelo donde lo dejaste' },
      { en: 'Listen from here', es: 'Escuchar desde aquí' },
    ],
  ),

  // ── Advanced floor — the whole app, in depth (PLAN §3) ────────────────
  M(
    'AD1',
    'advanced',
    { en: 'The Panel, Whole', es: 'El panel, entero' },
    {
      en: 'Use every key on the bubble’s panel — words, speed, mark, save, lock, eye and headphones — and know what each one does before you touch it.',
      es: 'Usa cada tecla del panel de la burbuja — palabras, velocidad, marca, guardar, candado, ojo y auriculares — y sabe lo que hace cada una antes de tocarla.',
    },
    [
      { en: 'The panel’s anatomy', es: 'La anatomía del panel' },
      { en: 'The bubble’s drag doors', es: 'Las puertas del arrastre de la burbuja' },
      { en: 'Words that follow the voice', es: 'Palabras que siguen la voz' },
      { en: 'Speed at your fingertip', es: 'La velocidad al dedo' },
      { en: 'Mark, save, and the lock', es: 'Marcar, guardar y el candado' },
      { en: 'The eye, the headphones, and Back', es: 'El ojo, los auriculares y Atrás' },
      { en: 'The panel conducting a recording', es: 'El panel mandando una grabación' },
    ],
  ),
  M(
    'AD2',
    'advanced',
    { en: 'Bringing Everything In', es: 'Traerlo todo' },
    {
      en: 'Bring everything into Logos — text, links, files in every readable format, and even photos — and know exactly what Logos refuses, and why.',
      es: 'Trae todo a Logos — texto, enlaces, archivos en cada formato legible y hasta fotos — y sabe exactamente qué rechaza Logos, y por qué.',
    },
    [
      { en: 'Share text and links', es: 'Compartir texto y enlaces' },
      { en: 'Files: the three doors', es: 'Archivos: las tres puertas' },
      { en: 'A photo becomes text', es: 'Una foto se vuelve texto' },
      { en: 'The honest refusals', es: 'Las negativas honestas' },
      { en: 'The web reader, in depth', es: 'El lector web a fondo' },
      { en: 'A link pasted in Listen', es: 'Un enlace pegado en Escuchar' },
    ],
  ),
  M(
    'AD3',
    'advanced',
    { en: 'The Reader in Depth', es: 'El lector a fondo' },
    {
      en: 'Read your way: set the text size and the two lights, seek honestly with the bar, edit without losing the session, and listen immersively.',
      es: 'Lee a tu manera: ajusta el tamaño del texto y las dos luces, busca con honestidad en la barra, edita sin perder la sesión y escucha en modo inmersivo.',
    },
    [
      { en: 'Two kinds of light', es: 'Dos clases de luz' },
      { en: 'Text size and the word clock', es: 'Tamaño del texto y la sincronía de la palabra' },
      { en: 'The seek bar tells the truth', es: 'La barra de búsqueda dice la verdad' },
      { en: 'Edit without killing the session', es: 'Editar sin matar la sesión' },
      { en: 'Immersive mode and the bar pin', es: 'El modo inmersivo y fijar la barra' },
      { en: 'The mini player and the keyboard', es: 'El mini-reproductor y el teclado' },
    ],
  ),
  M(
    'AD4',
    'advanced',
    { en: 'Rhythm and Sleep', es: 'Ritmo y sueño' },
    {
      en: 'Set the pace of every listening: speed up to two and a half times, the pause between sentences, and a sleep timer that fades out gently.',
      es: 'Marca el ritmo de cada escucha: velocidad hasta dos veces y media, la pausa entre frases y un temporizador de sueño que se apaga con suavidad.',
    },
    [
      { en: 'One speed key, two doors', es: 'Una llave de velocidad, dos puertas' },
      { en: 'The pause between sentences', es: 'La pausa entre frases' },
      { en: 'The sleep timer', es: 'El temporizador de sueño' },
    ],
  ),
  M(
    'AD5',
    'advanced',
    { en: 'Two Languages, One Listening', es: 'Dos idiomas, una escucha' },
    {
      en: 'Listen to mixed English-and-Spanish texts with the right voice in every sentence, and understand exactly when Automatic switches — and when it doesn’t.',
      es: 'Escucha textos mezclados en inglés y español con la voz correcta en cada frase, y entiende exactamente cuándo cambia Automática — y cuándo no.',
    },
    [
      { en: 'Automatic with mixed texts', es: 'Automática con textos mixtos' },
      { en: 'The language chip keeps your place', es: 'El chip de idioma conserva tu lugar' },
      { en: 'Phonon and Pocket, and their accents', es: 'Phonon y Pocket, y sus acentos' },
      { en: 'The app’s own language', es: 'El idioma de la propia app' },
    ],
  ),
  M(
    'AD6',
    'advanced',
    { en: 'The Library in Depth', es: 'La Biblioteca a fondo' },
    {
      en: 'Run your whole Library: find any clip by its words, select many at once, rename, download, and control the render queue.',
      es: 'Domina tu Biblioteca entera: encuentra cualquier clip por sus palabras, selecciona muchos a la vez, renombra, descarga y controla la cola de renderizado.',
    },
    [
      { en: 'Find anything in Saved', es: 'Encuentra todo en Guardado' },
      { en: 'Select: one gesture, two meanings', es: 'Seleccionar: un gesto, dos significados' },
      { en: 'The item menu, entry by entry', es: 'El menú del ítem, entrada a entrada' },
      { en: 'Add audio from your phone', es: 'Añade audios de tu teléfono' },
      { en: 'The render queue', es: 'La cola de renderizado' },
    ],
  ),
  M(
    'AD7',
    'advanced',
    { en: 'The Book in Depth', es: 'El libro a fondo' },
    {
      en: 'Move inside a book like you own it: contents, in-book search, links and notes in their place, and an honest map of where you are.',
      es: 'Muévete dentro de un libro como si fuera tuyo: contenidos, búsqueda interna, enlaces y notas en su sitio, y un mapa honesto de dónde estás.',
    },
    [
      { en: 'Contents that know where you are', es: 'Contenidos que saben dónde estás' },
      { en: 'Search inside the book', es: 'Buscar dentro del libro' },
      { en: 'Links and the note in its place', es: 'Enlaces y la nota en su sitio' },
      { en: 'The honest percent bar', es: 'La barra del porcentaje honesta' },
      { en: 'The book’s own text controls', es: 'Los controles de texto del libro' },
      { en: 'Only once, and its two survivors', es: 'Solo una vez, y sus dos supervivientes' },
    ],
  ),
  M(
    'AD8',
    'advanced',
    { en: 'Create Audio Files', es: 'Crear archivos de audio' },
    {
      en: 'Turn any text into a finished audio file — with its own voice, speed and format — and find it waiting in your Library.',
      es: 'Convierte cualquier texto en un archivo de audio terminado — con su propia voz, velocidad y formato — y encuéntralo esperándote en tu Biblioteca.',
    },
    [
      { en: 'Create, whole', es: 'Crear, entero' },
      { en: 'Its own voice, its own speed', es: 'Su propia voz, su propia velocidad' },
      { en: 'Use the Listen text', es: 'Usa el texto de Escuchar' },
      { en: 'The global queue', es: 'La cola global' },
      { en: 'The result already lives in the Library', es: 'El resultado ya vive en la Biblioteca' },
    ],
  ),
  M(
    'AD9',
    'advanced',
    { en: 'You Never Lose the Thread', es: 'Nunca pierdes el hilo' },
    {
      en: 'Never lose your place again: understand Continue’s three legs, your marks, and what survives pausing, closing and coming back.',
      es: 'No vuelvas a perder tu lugar: entiende las tres patas de Continuar, tus marcas y lo que sobrevive a pausar, cerrar y volver.',
    },
    [
      { en: 'Continue’s three legs', es: 'Las tres patas de Continuar' },
      { en: 'The clip leg, honestly', es: 'La pata del clip, con honestidad' },
      { en: 'Marks on their shelf', es: 'Las marcas en su estante' },
      { en: 'Endings and their asymmetries', es: 'Los finales y sus asimetrías' },
      { en: 'What survives closing the app', es: 'Lo que sobrevive a cerrar la app' },
    ],
  ),
  M(
    'AD10',
    'advanced',
    { en: 'Pronunciation', es: 'Pronunciación' },
    {
      en: 'Teach Logos your own pronunciations — names, codes and links said your way — in listening, in books and in every audio file you make.',
      es: 'Enséñale a Logos tus propias pronunciaciones — nombres, códigos y enlaces dichos a tu manera — al escuchar, en los libros y en cada audio que crees.',
    },
    [
      { en: 'Say it your way', es: 'Dilo a tu manera' },
      { en: 'It works everywhere you listen', es: 'Vale dondequiera que escuches' },
      { en: 'Replace, remove, and no Undo', es: 'Reemplazar, quitar, y sin Deshacer' },
    ],
  ),
  M(
    'AD11',
    'advanced',
    { en: 'The Floating Player in Settings', es: 'El reproductor flotante en Ajustes' },
    {
      en: 'Control the floating player from Settings: its three switches in every situation, the permission trip, and why the clipboard is only read at your tap.',
      es: 'Controla el reproductor flotante desde Ajustes: sus tres interruptores en cada situación, el viaje del permiso y por qué el portapapeles solo se lee con tu toque.',
    },
    [
      { en: 'Three switches, four situations', es: 'Tres interruptores, cuatro situaciones' },
      { en: 'The λ is the same switch', es: 'La λ es el mismo interruptor' },
      { en: 'Permission: a two-tap trip', es: 'El permiso: un viaje de dos toques' },
      { en: 'Why Android only looks when you tap', es: 'Por qué Android solo mira al tocar' },
      { en: 'The two diagnostic lines', es: 'Las dos líneas de diagnóstico' },
    ],
  ),
  M(
    'AD12',
    'advanced',
    { en: 'Outside the App', es: 'Fuera de la app' },
    {
      en: 'Know what Logos promises outside the app — the system media card, the notification, and the media keys — and what it cannot promise.',
      es: 'Sabe lo que Logos promete fuera de la app — la tarjeta multimedia del sistema, la notificación y las teclas de medios — y lo que no puede prometer.',
    },
    [
      { en: 'The system media card', es: 'La tarjeta multimedia del sistema' },
      { en: 'The bubble’s own notification', es: 'La notificación propia de la burbuja' },
      { en: 'Media keys speak in sentences', es: 'Las teclas de medios hablan en frases' },
      { en: 'The rescue, narrated', es: 'El rescate, narrado' },
      { en: 'What each button can promise', es: 'Lo que cada botón puede prometer' },
    ],
  ),
  M(
    'AD13',
    'advanced',
    { en: 'Large Screens', es: 'Pantallas grandes' },
    {
      en: 'Use Logos on the big screen at full width: the rail, the tablet desk, the paragraph map, the book panel — and make an audiobook there.',
      es: 'Usa Logos en pantalla grande a todo ancho: el riel, el escritorio de tableta, el mapa de párrafos, el panel del libro — y crea un audiolibro ahí.',
    },
    [
      { en: '840: the rail arrives', es: '840: llega el riel' },
      { en: '1100: the tablet desk', es: '1100: el escritorio de tableta' },
      { en: '1500: the book panel and the audiobook', es: '1500: el panel del libro y el audiolibro' },
      { en: 'Anchor to the card, never the position', es: 'Ancla en la tarjeta, nunca en la posición' },
    ],
  ),
  M(
    'AD14',
    'advanced',
    { en: 'The House Inside', es: 'La casa por dentro' },
    {
      en: 'Understand the house inside: the neural voice and its storage, a backup that tells the truth about what travels, and every serious door.',
      es: 'Entiende la casa por dentro: la voz neuronal y su almacenamiento, un respaldo que dice la verdad sobre lo que viaja, y cada puerta seria.',
    },
    [
      { en: 'The Settings page itself', es: 'La página de Ajustes misma' },
      { en: 'The status pill’s five faces', es: 'Las cinco caras de la pastilla de estado' },
      { en: 'The neural voice and its storage', es: 'La voz neuronal y su almacenamiento' },
      { en: 'Backup, as the code tells it', es: 'El respaldo, como lo cuenta el código' },
      { en: 'The serious doors', es: 'Las puertas serias' },
    ],
  ),
]

/** The catalogue entry for an id, or null. */
export function catalogueModule(id: string): CatalogueModule | null {
  return MODULE_CATALOGUE.find((entry) => entry.id === id) ?? null
}

/** The entries of one floor, in ladder order. */
export function modulesOnFloor(floor: PresentationFloor): CatalogueModule[] {
  return MODULE_CATALOGUE.filter((entry) => entry.floor === floor)
}

/**
 * Register a module's script when its build wave lands. The script is
 * validated against the engine format first — an invalid script is refused
 * loudly rather than half-registered — and it must be the script OF this
 * catalogue entry (same id, floor, title and capability), so the index can
 * never announce one module and play another.
 */
export function registerPresentationScript(script: PresentationModule): CatalogueModule {
  assertValidPresentationModule(script)
  const entry = catalogueModule(script.id)
  if (!entry) throw new Error(`presentation catalogue: no module "${script.id}" to register a script for`)
  if (entry.floor !== script.floor) {
    throw new Error(`presentation catalogue: script "${script.id}" is floor "${script.floor}", the catalogue says "${entry.floor}"`)
  }
  if (entry.title.en !== script.title.en || entry.title.es !== script.title.es) {
    throw new Error(`presentation catalogue: script "${script.id}" title disagrees with the catalogue (PLAN §3 owns the words)`)
  }
  if (entry.capability.en !== script.capability.en || entry.capability.es !== script.capability.es) {
    throw new Error(`presentation catalogue: script "${script.id}" capability promise disagrees with the catalogue (PLAN §3 owns the words)`)
  }
  entry.script = script
  return entry
}

/**
 * A module's computed duration — from its script alone, through the one
 * shared clock (engine/clock.ts), in the language the index renders.
 * Null while the module has no script: there is no honest figure yet, and
 * the index renders no label instead of a handwritten one (D-1/D-2).
 */
export function entryDuration(entry: CatalogueModule, lang: 'en' | 'es'): { ms: number; label: string } | null {
  if (!entry.script) return null
  return { ms: moduleDurationMs(entry.script, lang), label: durationLabel(entry.script, lang) }
}

/**
 * The state a module's index card announces, derived purely from the
 * state file (FENCE-DESIGN §7 clause 5):
 * - no record → unseen;
 * - a record the runner marked needs-refresh stays needs-refresh, with its
 *   recorded point kept for Resume;
 * - a builder-flagged stale script (staleRisk) whose words were verified
 *   against a different build than the progress record's reads
 *   needs-refresh;
 * - in-progress carries the exact resume point; seen stays seen.
 */
export function stateFor(entry: CatalogueModule, state: PresentationStateFile): CatalogueState {
  const progress = moduleProgress(state, entry.id)
  if (!progress) return { state: 'unseen' }
  const resume: ResumePoint | undefined =
    progress.step !== undefined ? { step: progress.step, scene: progress.scene, stepId: progress.stepId } : undefined
  if (progress.state === 'needs-refresh') return { state: 'needs-refresh', resume }
  if (
    entry.script?.staleRisk &&
    entry.script.verifiedAgainst &&
    progress.verifiedAgainst !== entry.script.verifiedAgainst
  ) {
    return { state: 'needs-refresh', resume }
  }
  if (progress.state === 'in-progress') return { state: 'in-progress', resume }
  return { state: progress.state }
}

/**
 * The resume head of the index (the FIRST-CARD law — Oscar, Brizna lane
 * 2026-11-14): the LAST-USED module, when it was left incomplete, heads
 * the whole list under «Sigue donde ibas» / "Pick up where you left off",
 * lifted out of its floor and shown exactly once. Pure derivation from
 * the state file:
 * - the mark is the file's single `lastUsed` field (recorded by the
 *   runner from module start and on every advance; cleared on
 *   completion) — so there can only ever be ONE head, and when several
 *   modules stand in-progress the latest-used is the head while the
 *   others keep their floor seats;
 * - the marked module heads the list only while its announced state is
 *   in-progress; completed (seen) it returns to its floor, and with no
 *   mark — or a mark naming an unknown module — there is no head and
 *   the index is exactly as it was.
 * - THE M-37 AMENDMENT: "current" is computed ONCE, in the state layer
 *   (`currentModuleId`) — a file with no usable mark but exactly one
 *   in-progress record (the shape a search «Watch» landing writes)
 *   heads that record's module, because the runner already resumes it
 *   as current; several in-progress records with no mark still head
 *   none, honestly ambiguous.
 */
export function resumeHead(state: PresentationStateFile): CatalogueModule | null {
  // The current module is the STATE LAYER's one computation
  // (`currentModuleId`, presentation-state.ts — the M-37 cure): the
  // index head and the runner's stay-here bookkeeping read the same
  // truth, so the module the index lifts is the module a resume
  // re-enters — including a Watch-shaped file whose in-progress record
  // stands before its lastUsed mark exists. The stateFor gate below
  // keeps the announced-state semantics (a builder-flagged stale
  // script still reads needs-refresh, never a resume head).
  const current = currentModuleId(state)
  if (!current) return null
  const entry = catalogueModule(current)
  if (!entry) return null
  return stateFor(entry, state).state === 'in-progress' ? entry : null
}

/** The numbers of the index's one general progress line. */
export interface OverallProgress {
  /** Whole-number percent of the whole app already studied. */
  percent: number
  /** Modules completed — each one counts whole. */
  finished: number
  /** Modules under way — needs-refresh ones included (see below). */
  inProgress: number
  /** All registered modules, each of equal weight. */
  total: number
  /** How much of the app is left to study: 100 − percent. */
  remainingPercent: number
}

/**
 * The general progress over ALL modules (the OVERALL-PROGRESS law —
 * Oscar, Cadence lane 2026-11-14): the index carries ONE line over the
 * whole ladder, so the learner sees at a glance how much of the app
 * they have studied and how much is left. The count is the honest one,
 * settled in Cadence:
 * - a completed module (seen) counts whole — fraction 1;
 * - a module under way counts the fraction of itself already walked:
 *   its recorded resume point over its total length (the recorded step
 *   over the script's total steps — the same point Resume re-enters);
 * - a needs-refresh module counts by that same walked fraction: its
 *   record carries a place, and what was walked was truly walked (it
 *   also counts among the modules under way);
 * - an untouched module counts 0.
 * The headline percent is the mean of the per-module fractions across
 * every registered module — each module equal weight — rounded to a
 * whole number. A pure derivation from the state file, like `stateFor`
 * and `resumeHead`; the index only renders it.
 */
export function overallProgress(state: PresentationStateFile): OverallProgress {
  let finished = 0
  let inProgress = 0
  let walked = 0
  for (const entry of MODULE_CATALOGUE) {
    const progress = moduleProgress(state, entry.id)
    if (!progress || progress.state === 'unseen') continue
    if (progress.state === 'seen') {
      finished += 1
      walked += 1
      continue
    }
    // in-progress or needs-refresh: the fraction of itself already walked.
    inProgress += 1
    const totalSteps = entry.script ? flattenSteps(entry.script).length : 0
    if (totalSteps > 0 && typeof progress.step === 'number' && progress.step > 0) {
      walked += Math.min(progress.step, totalSteps) / totalSteps
    }
  }
  const total = MODULE_CATALOGUE.length
  const percent = total === 0 ? 0 : Math.round((walked / total) * 100)
  return { percent, finished, inProgress, total, remainingPercent: 100 - percent }
}
