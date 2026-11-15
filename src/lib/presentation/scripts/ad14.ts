/**
 * AD14 — «La casa por dentro / The House Inside» (Advanced floor).
 *
 * The house lesson: how Settings itself works, what the status pill is
 * really saying, the neural voice and its storage in its two worlds
 * (app / browser), a backup taught exactly as the code behaves, and the
 * serious doors — walked TO, never through.
 *
 * Census ownership (PLAN §2.5 — AD14 owns 37 items, the ladder's largest):
 * E-2 the fold itself · E-3 only Neural voice arrives open · E-5 the Neural
 * card's promise · E-6…E-19 the voice card whole (five status faces incl.
 * the Warming that still reads "Ready", Download vs Load, the storage row
 * in both variants, the Keep note, Protect — BROWSER ONLY, Delete model,
 * download-on-first-play, the device voice bridge — BROWSER ONLY) ·
 * E-32 + F-32 + F-34 the theme, which repaints everything instantly, this
 * card included · E-43…E-48 Backup against the code: the file carries
 * books, marks, dictionary, draft and a settings payload importing NEVER
 * reads; audio does not travel, and neither do Listen-later TEXT clips;
 * merges never clobber · E-49 About (one beat) · E-50 the version line
 * closing the page · A-40…A-44 the player's own engine notes (device
 * voice, cushion, background preparation, download, errors) · F-9 the
 * pill's five faces · F-10 the pill's tap by state — idle DOWNLOADS via
 * ensureModel, it does not navigate (PLAN §2.6 item 9: taught exactly as
 * the code proves) · F-13 the pill as the short door to the Neural card ·
 * F-40 the house's single confirmDelete window behind every serious door.
 * (E-1, the page head's no-Save truth, is Q0's glance; it is re-taught
 * here in the opening scene because this module owns the page itself.)
 *
 * Surface honesty is part of the lesson: Protect and the device bridge
 * are narrated over their neighbouring anchors, never pointed at — in
 * the Android app those anchors never resolve (registry preconditions).
 * Delete model is a SERIOUS door: the script walks to it, rests on it
 * (hover), and teaches its confirmation and consequences; no step taps
 * it, and nothing real is ever deleted — performed acts go through the
 * scenario port only, and this module performs no data act at all.
 *
 * Captions: bilingual, each ≤15 words in BOTH languages (the C′ caption
 * law), consequences stated, never implied. No duration literal anywhere —
 * the index label is computed from this script by the shared clock.
 * Title and capability are the catalogue's words, verbatim (PLAN §3).
 */
import type { PresentationModule } from '../engine/types.ts'

export const AD14: PresentationModule = {
  id: 'AD14',
  floor: 'advanced',
  title: { en: 'The House Inside', es: 'La casa por dentro' },
  capability: {
    en: 'Understand the house inside: the neural voice and its storage, a backup that tells the truth about what travels, and every serious door.',
    es: 'Entiende la casa por dentro: la voz neuronal y su almacenamiento, un respaldo que dice la verdad sobre lo que viaja, y cada puerta seria.',
  },
  verifiedAgainst: '1.4.156',
  scenes: [
    {
      id: 'the-settings-page-itself',
      chapter: { en: 'The Settings page itself', es: 'La página de Ajustes misma' },
      steps: [
        {
          id: 'ad14-page-head',
          anchorId: 'set-page-head',
          act: 'goto',
          establishes: 'settings-page',
          text: {
            en: 'Settings: everything runs on this device.',
            es: 'Ajustes: todo funciona en este dispositivo.',
          },
        },
        {
          id: 'ad14-no-account',
          anchorId: 'set-page-head',
          act: 'say',
          text: {
            en: 'No account, no cloud: your library stays home.',
            es: 'Sin cuenta, sin nube: tu biblioteca se queda en casa.',
          },
        },
        {
          id: 'ad14-no-save',
          anchorId: 'set-page-head',
          act: 'say',
          text: {
            en: 'There is no Save button anywhere here.',
            es: 'Aquí no hay ningún botón de guardar.',
          },
        },
        {
          id: 'ad14-instant-writes',
          anchorId: 'set-page-head',
          act: 'say',
          text: {
            en: 'Each change saves itself the moment you make it.',
            es: 'Cada cambio se guarda solo al hacerlo.',
          },
        },
        {
          id: 'ad14-fold-handle',
          anchorId: 'set-neural',
          act: 'say',
          text: {
            en: 'Every card folds; its header is the handle.',
            es: 'Cada tarjeta se pliega; su cabecera es el asa.',
          },
        },
        {
          id: 'ad14-first-open',
          anchorId: 'set-neural',
          act: 'say',
          text: {
            en: 'Only Neural voice arrives open; the rest wait folded.',
            es: 'Solo Voz neuronal llega abierta; las demás esperan plegadas.',
          },
        },
        {
          id: 'ad14-appearance-open',
          anchorId: 'set-card-appearance',
          act: 'tap',
          establishes: 'appearance-card-open',
          text: {
            en: 'Appearance holds one choice: the theme.',
            es: 'Apariencia guarda una sola elección: el tema.',
          },
        },
        {
          id: 'ad14-theme-change',
          anchorId: 'set-theme:light',
          act: 'tap',
          text: {
            en: 'Change the theme, and everything repaints instantly.',
            es: 'Cambia el tema y todo se repinta al instante.',
          },
        },
        {
          id: 'ad14-theme-card-too',
          anchorId: 'set-theme',
          act: 'say',
          text: {
            en: "This lesson's card repaints too; nothing reloads.",
            es: 'La tarjeta de esta lección también; nada se recarga.',
          },
        },
        {
          id: 'ad14-theme-system',
          anchorId: 'set-theme:system',
          act: 'say',
          text: {
            en: "System follows your phone's own light or dark.",
            es: 'Sistema sigue la luz u oscuridad de tu teléfono.',
          },
        },
      ],
    },
    {
      id: 'the-status-pills-five-faces',
      chapter: { en: 'The status pill’s five faces', es: 'Las cinco caras de la pastilla de estado' },
      steps: [
        {
          id: 'ad14-pill-door',
          anchorId: 'shell-status-pill',
          act: 'say',
          text: {
            en: 'This pill reports whether your voice lives here.',
            es: 'Esta pastilla dice si tu voz vive aquí.',
          },
        },
        {
          id: 'ad14-pill-ask',
          anchorId: 'shell-status-pill',
          act: 'ask',
          question: {
            en: 'How many faces can this pill wear?',
            es: '¿Cuántas caras puede mostrar esta pastilla?',
          },
        },
        {
          id: 'ad14-pill-five',
          anchorId: 'shell-status-pill',
          act: 'say',
          text: {
            en: 'Five: ready, warming, downloading, error, not downloaded.',
            es: 'Cinco: lista, calentando, descargando, error, sin descargar.',
          },
        },
        {
          id: 'ad14-pill-ready',
          anchorId: 'shell-status-pill',
          act: 'say',
          text: {
            en: 'Ready means the voice is downloaded and loaded.',
            es: 'Lista significa que la voz está descargada y cargada.',
          },
        },
        {
          id: 'ad14-pill-warm-face',
          anchorId: 'shell-status-pill',
          act: 'say',
          text: {
            en: 'Warming also reads Ready; a breathing light betrays it.',
            es: 'Calentando también dice Lista; la delata una luz que respira.',
          },
        },
        {
          id: 'ad14-pill-warm-truth',
          anchorId: 'shell-status-pill',
          act: 'say',
          text: {
            en: 'Warming only loads into memory; it costs no data.',
            es: 'Calentar solo carga en memoria; no gasta datos.',
          },
        },
        {
          id: 'ad14-pill-downloading',
          anchorId: 'shell-status-pill',
          act: 'say',
          text: {
            en: 'Downloading shows a ring and a real percentage.',
            es: 'Descargando muestra un anillo y un porcentaje real.',
          },
        },
        {
          id: 'ad14-pill-error',
          anchorId: 'shell-status-pill',
          act: 'say',
          text: {
            en: "An error turns the pill's words red.",
            es: 'Un error tiñe de rojo las palabras de la pastilla.',
          },
        },
        {
          id: 'ad14-pill-tap-ready',
          anchorId: 'shell-status-pill',
          act: 'say',
          text: {
            en: 'Tap Ready, and the pill opens Settings.',
            es: 'Toca Lista y la pastilla abre Ajustes.',
          },
        },
        {
          id: 'ad14-pill-tap-idle',
          anchorId: 'shell-status-pill',
          act: 'say',
          text: {
            en: 'Tap the undownloaded pill, and it downloads instead.',
            es: 'Toca la pastilla sin descargar y descarga en su sitio.',
          },
        },
        {
          id: 'ad14-pill-tap-truth',
          anchorId: 'shell-status-pill',
          act: 'say',
          text: {
            en: 'It never navigates first; the download starts right there.',
            es: 'Nunca navega primero; la descarga empieza ahí mismo.',
          },
        },
      ],
    },
    {
      id: 'the-neural-voice-and-its-storage',
      chapter: { en: 'The neural voice and its storage', es: 'La voz neuronal y su almacenamiento' },
      steps: [
        {
          id: 'ad14-neural-open',
          anchorId: 'set-neural',
          act: 'goto',
          establishes: 'neural-card-open',
          text: {
            en: "This card arrives open: the voice is the house's engine.",
            es: 'Esta tarjeta llega abierta: la voz es el motor de la casa.',
          },
        },
        {
          id: 'ad14-neural-promise',
          anchorId: 'set-neural',
          act: 'say',
          text: {
            en: 'It downloads once, then works offline forever.',
            es: 'Se descarga una vez y luego funciona sin conexión siempre.',
          },
        },
        {
          id: 'ad14-status-downloaded',
          anchorId: 'set-neural-status',
          act: 'say',
          text: {
            en: 'Downloaded means saved here, not yet in memory.',
            es: 'Descargado significa guardado aquí, aún no en memoria.',
          },
        },
        {
          id: 'ad14-status-ready',
          anchorId: 'set-neural-status',
          act: 'say',
          text: {
            en: 'Ready names the engine and language actually loaded.',
            es: 'Lista nombra el motor y el idioma realmente cargados.',
          },
        },
        {
          id: 'ad14-two-engines',
          anchorId: 'set-neural-status',
          act: 'say',
          text: {
            en: 'Two engines share this card: Phonon and Pocket.',
            es: 'Dos motores comparten esta tarjeta: Phonon y Pocket.',
          },
        },
        {
          id: 'ad14-phonon-size',
          anchorId: 'set-neural-status',
          act: 'say',
          text: {
            en: 'Phonon weighs about 75 megabytes, both languages together.',
            es: 'Phonon pesa cerca de 75 megabytes con ambos idiomas.',
          },
        },
        {
          id: 'ad14-pocket-size',
          anchorId: 'set-neural-status',
          act: 'say',
          text: {
            en: 'Pocket weighs about 179 megabytes per language.',
            es: 'Pocket pesa cerca de 179 megabytes por idioma.',
          },
        },
        {
          id: 'ad14-status-warming',
          anchorId: 'set-neural-status',
          act: 'say',
          text: {
            en: 'Warming reads Ready while it loads into memory.',
            es: 'Calentando dice Lista mientras carga en memoria.',
          },
        },
        {
          id: 'ad14-warming-play',
          anchorId: 'set-neural-status',
          act: 'say',
          text: {
            en: 'You can press Play; the first sentence just waits.',
            es: 'Puedes tocar Reproducir; la primera frase solo espera.',
          },
        },
        {
          id: 'ad14-neural-meter',
          anchorId: 'set-neural-meter',
          act: 'say',
          optional: true,
          text: {
            en: 'While downloading, real bytes fill this meter.',
            es: 'Mientras descarga, bytes reales llenan este medidor.',
          },
        },
        {
          id: 'ad14-neural-error',
          anchorId: 'set-neural-error',
          act: 'say',
          optional: true,
          text: {
            en: 'Needs attention shows the error beside its fix.',
            es: 'Necesita atención muestra el error junto a su arreglo.',
          },
        },
        {
          id: 'ad14-error-words',
          anchorId: 'set-neural-error',
          act: 'say',
          optional: true,
          text: {
            en: 'A dead connection is worded plainly, never technically.',
            es: 'Una conexión muerta se dice claramente, nunca con tecnicismos.',
          },
        },
        {
          id: 'ad14-download-button',
          anchorId: 'set-neural-download',
          act: 'tap',
          optional: true,
          text: {
            en: 'Download now fetches the model onto this device.',
            es: 'Descargar ahora trae el modelo a este dispositivo.',
          },
        },
        {
          id: 'ad14-load-button',
          anchorId: 'set-neural-download',
          act: 'say',
          optional: true,
          text: {
            en: 'Already saved? The same button only says Load now.',
            es: '¿Ya está guardado? El mismo botón solo dice Cargar ahora.',
          },
        },
        {
          id: 'ad14-download-toast',
          anchorId: 'set-neural-download',
          act: 'say',
          optional: true,
          text: {
            en: 'Success announces: neural voice ready, works offline now.',
            es: 'El éxito anuncia: voz neuronal lista, funciona sin conexión.',
          },
        },
        {
          id: 'ad14-auto-download',
          anchorId: 'set-auto-download',
          act: 'tap',
          text: {
            en: 'This switch lets the first Play download by itself.',
            es: 'Este interruptor deja que el primer Play descargue solo.',
          },
        },
        {
          id: 'ad14-auto-download-off',
          anchorId: 'set-auto-download',
          act: 'tap',
          text: {
            en: 'Turn it off: nothing downloads until you ask.',
            es: 'Apágalo: nada se descarga hasta que lo pidas.',
          },
        },
        {
          id: 'ad14-bridge-narrated',
          anchorId: 'set-neural',
          act: 'say',
          text: {
            en: 'In a browser, a bridge switch appears here.',
            es: 'En un navegador, aquí aparece el puente de voz.',
          },
        },
        {
          id: 'ad14-bridge-voice',
          anchorId: 'set-neural',
          act: 'say',
          text: {
            en: "It speaks instantly with the phone's built-in voice.",
            es: 'Habla al instante con la voz integrada del teléfono.',
          },
        },
        {
          id: 'ad14-bridge-handover',
          anchorId: 'set-neural',
          act: 'say',
          text: {
            en: 'Then the neural voice takes over when ready.',
            es: 'Después la voz neuronal toma el relevo cuando está lista.',
          },
        },
        {
          id: 'ad14-bridge-honesty',
          anchorId: 'set-neural',
          act: 'say',
          text: {
            en: 'Inside the app, this row simply does not exist.',
            es: 'Dentro de la app, esta fila simplemente no existe.',
          },
        },
        {
          id: 'ad14-storage-row',
          anchorId: 'set-storage-row',
          act: 'say',
          text: {
            en: 'This row answers: where did my space go?',
            es: 'Esta fila responde: ¿a dónde fue mi espacio?',
          },
        },
        {
          id: 'ad14-storage-count',
          anchorId: 'set-storage-row',
          act: 'say',
          text: {
            en: "It counts both engines' saved bytes together.",
            es: 'Cuenta juntos los bytes guardados de ambos motores.',
          },
        },
        {
          id: 'ad14-storage-app',
          anchorId: 'set-storage-row',
          act: 'say',
          text: {
            en: 'In the app: kept inside Logos, safe from cleanup.',
            es: 'En la app: guardado dentro de Logos, a salvo de limpiezas.',
          },
        },
        {
          id: 'ad14-storage-browser',
          anchorId: 'set-storage-row',
          act: 'say',
          text: {
            en: 'In a browser, it tells whether cleanup may clear it.',
            es: 'En un navegador, dice si una limpieza puede borrarla.',
          },
        },
        {
          id: 'ad14-storage-note',
          anchorId: 'set-storage-note',
          act: 'say',
          optional: true,
          text: {
            en: 'This note appears if the phone cleared a voice.',
            es: 'Esta nota aparece si el teléfono borró una voz.',
          },
        },
        {
          id: 'ad14-storage-note-two',
          anchorId: 'set-storage-note',
          act: 'say',
          optional: true,
          text: {
            en: 'Or if a voice loaded but could not save.',
            es: 'O si una voz cargó pero no pudo guardarse.',
          },
        },
        {
          id: 'ad14-protect-narrated',
          anchorId: 'set-storage-row',
          act: 'say',
          text: {
            en: 'A browser may offer a Protect button here.',
            es: 'Un navegador puede ofrecer aquí un botón Proteger.',
          },
        },
        {
          id: 'ad14-protect-ask',
          anchorId: 'set-storage-row',
          act: 'say',
          text: {
            en: 'It asks the browser to exempt Logos from cleanup.',
            es: 'Pide al navegador que exceptúe a Logos de la limpieza.',
          },
        },
        {
          id: 'ad14-protect-honesty',
          anchorId: 'set-storage-row',
          act: 'say',
          text: {
            en: 'In the app there is no Protect button at all.',
            es: 'En la app no existe ningún botón Proteger.',
          },
        },
        {
          id: 'ad14-player-note-goto',
          anchorId: 'listen-engine-note',
          act: 'goto',
          text: {
            en: 'The player also reports the engine while you listen.',
            es: 'El reproductor también informa del motor mientras escuchas.',
          },
        },
        {
          id: 'ad14-player-download-note',
          anchorId: 'listen-engine-note',
          act: 'say',
          text: {
            en: 'Downloading shows bytes and a bar inside the player.',
            es: 'La descarga muestra bytes y una barra en el reproductor.',
          },
        },
        {
          id: 'ad14-device-voice-note',
          anchorId: 'listen-engine-note',
          act: 'say',
          text: {
            en: "Your phone's voice reads only until the neural arrives.",
            es: 'La voz del teléfono lee solo hasta que llega la neuronal.',
          },
        },
        {
          id: 'ad14-cushion-note',
          anchorId: 'listen-engine-note',
          act: 'say',
          text: {
            en: 'A slow phone builds a head start before speaking.',
            es: 'Un teléfono lento crea una ventaja antes de hablar.',
          },
        },
        {
          id: 'ad14-cushion-truth',
          anchorId: 'listen-engine-note',
          act: 'say',
          text: {
            en: 'Then playback starts on its own; pressing nothing is right.',
            es: 'Luego la reproducción empieza sola; no tocar nada es correcto.',
          },
        },
        {
          id: 'ad14-background-note',
          anchorId: 'listen-engine-note',
          act: 'say',
          text: {
            en: 'Paused, the note counts sentences ready in the background.',
            es: 'En pausa, la nota cuenta frases listas en segundo plano.',
          },
        },
        {
          id: 'ad14-error-note',
          anchorId: 'listen-error-note',
          act: 'say',
          text: {
            en: 'Errors stop the sound, never lose your place.',
            es: 'Los errores detienen el sonido, nunca pierden tu lugar.',
          },
        },
        {
          id: 'ad14-error-retry',
          anchorId: 'listen-error-note',
          act: 'say',
          text: {
            en: 'Press Play again: that is the retry.',
            es: 'Toca Reproducir otra vez: ese es el reintento.',
          },
        },
      ],
    },
    {
      id: 'backup-as-the-code-tells-it',
      chapter: { en: 'Backup, as the code tells it', es: 'El respaldo, como lo cuenta el código' },
      steps: [
        {
          id: 'ad14-backup-open',
          anchorId: 'set-backup',
          act: 'tap',
          establishes: 'backup-card-open',
          text: {
            en: "Open Backup: one file carries your library's core.",
            es: 'Abre Respaldo: un archivo lleva el núcleo de tu biblioteca.',
          },
        },
        {
          id: 'ad14-backup-promise',
          anchorId: 'set-backup',
          act: 'say',
          text: {
            en: 'Its promise mentions settings; the code tells more.',
            es: 'Su promesa menciona ajustes; el código cuenta más.',
          },
        },
        {
          id: 'ad14-backup-export',
          anchorId: 'set-backup-export',
          act: 'tap',
          text: {
            en: 'Export makes one dated file, ready to share.',
            es: 'Exportar crea un archivo con fecha, listo para compartir.',
          },
        },
        {
          id: 'ad14-backup-export-toast',
          anchorId: 'set-backup-export',
          act: 'say',
          text: {
            en: 'Its toast counts only the books inside.',
            es: 'Su aviso cuenta solo los libros de dentro.',
          },
        },
        {
          id: 'ad14-backup-books-travel',
          anchorId: 'set-backup-export',
          act: 'say',
          text: {
            en: 'Books travel whole: content, place, bookmarks, covers.',
            es: 'Los libros viajan enteros: contenido, lugar, marcadores, portadas.',
          },
        },
        {
          id: 'ad14-backup-more-travels',
          anchorId: 'set-backup-export',
          act: 'say',
          text: {
            en: 'Loose marks, the dictionary, your draft travel too.',
            es: 'También viajan marcas sueltas, el diccionario, tu borrador.',
          },
        },
        {
          id: 'ad14-backup-no-audio',
          anchorId: 'set-backup-export',
          act: 'say',
          text: {
            en: 'Audio clips are not inside the file.',
            es: 'Los clips de audio no van dentro del archivo.',
          },
        },
        {
          id: 'ad14-backup-audio-why',
          anchorId: 'set-backup-export',
          act: 'say',
          text: {
            en: 'Audio can always be made again from books.',
            es: 'El audio siempre puede rehacerse desde los libros.',
          },
        },
        {
          id: 'ad14-backup-no-texts',
          anchorId: 'set-backup-export',
          act: 'say',
          text: {
            en: 'Listen-later texts do not travel either.',
            es: 'Los textos de Escuchar después tampoco viajan.',
          },
        },
        {
          id: 'ad14-backup-text-loss',
          anchorId: 'set-backup-export',
          act: 'say',
          text: {
            en: 'A text living only there is lost in a move.',
            es: 'Un texto que vive solo ahí se pierde al mudarse.',
          },
        },
        {
          id: 'ad14-backup-import',
          anchorId: 'set-backup-import',
          act: 'tap',
          text: {
            en: 'Import opens a picker that accepts backup files only.',
            es: 'Importar abre un selector que solo acepta respaldos.',
          },
        },
        {
          id: 'ad14-backup-import-refusal',
          anchorId: 'set-backup-import',
          act: 'say',
          text: {
            en: 'A foreign file changes nothing; it is refused.',
            es: 'Un archivo ajeno no cambia nada; es rechazado.',
          },
        },
        {
          id: 'ad14-backup-settings-truth',
          anchorId: 'set-backup-import',
          act: 'say',
          text: {
            en: "Import never reads the file's settings payload.",
            es: 'Importar nunca lee los ajustes del archivo.',
          },
        },
        {
          id: 'ad14-backup-settings-stay',
          anchorId: 'set-backup-import',
          act: 'say',
          text: {
            en: "Your theme, voices and speeds stay this phone's own.",
            es: 'Tu tema, voces y velocidades quedan los de este teléfono.',
          },
        },
        {
          id: 'ad14-backup-merges',
          anchorId: 'set-backup-import',
          act: 'say',
          text: {
            en: 'Pronunciation and marks merge; your existing words win.',
            es: 'Pronunciación y marcas se fusionan; tus palabras actuales ganan.',
          },
        },
        {
          id: 'ad14-backup-draft-rule',
          anchorId: 'set-backup-import',
          act: 'say',
          text: {
            en: "The file's draft fills only an empty draft.",
            es: 'El borrador del archivo solo llena un borrador vacío.',
          },
        },
      ],
    },
    {
      id: 'the-serious-doors',
      chapter: { en: 'The serious doors', es: 'Las puertas serias' },
      steps: [
        {
          id: 'ad14-confirm-law',
          anchorId: 'shell-confirm-host',
          act: 'say',
          text: {
            en: 'Nothing consequential deletes with a single tap.',
            es: 'Nada importante se borra con un solo toque.',
          },
        },
        {
          id: 'ad14-confirm-window',
          anchorId: 'shell-confirm-host',
          act: 'say',
          text: {
            en: 'Every serious door asks through this one window.',
            es: 'Toda puerta seria pregunta por esta única ventana.',
          },
        },
        {
          id: 'ad14-confirm-delete',
          anchorId: 'shell-confirm-host',
          act: 'say',
          text: {
            en: 'Only the explicit Delete button says yes.',
            es: 'Solo el botón Borrar explícito dice que sí.',
          },
        },
        {
          id: 'ad14-delete-door',
          anchorId: 'set-neural-delete',
          act: 'goto',
          text: {
            en: 'The deepest door: deleting the downloaded model.',
            es: 'La puerta más honda: borrar el modelo descargado.',
          },
        },
        {
          id: 'ad14-delete-rest',
          anchorId: 'set-neural-delete',
          act: 'hover',
          payload: { holdMs: 1200 },
          text: {
            en: 'We stop at this door; we do not open it.',
            es: 'Nos detenemos en esta puerta; no la abrimos.',
          },
        },
        {
          id: 'ad14-delete-question',
          anchorId: 'shell-confirm-host',
          act: 'say',
          text: {
            en: 'Its question promises: you can download it again.',
            es: 'Su pregunta promete: puedes descargarlo otra vez.',
          },
        },
        {
          id: 'ad14-delete-session',
          anchorId: 'set-neural-delete',
          act: 'say',
          text: {
            en: 'Confirming ends your listening session first.',
            es: 'Confirmar termina primero tu sesión de escucha.',
          },
        },
        {
          id: 'ad14-delete-both',
          anchorId: 'set-neural-delete',
          act: 'say',
          text: {
            en: "Then both engines' models leave this device.",
            es: 'Después los modelos de ambos motores dejan el dispositivo.',
          },
        },
        {
          id: 'ad14-delete-others',
          anchorId: 'shell-confirm-host',
          act: 'say',
          text: {
            en: 'Deleting a book or clip asks the same way.',
            es: 'Borrar un libro o un clip pregunta igual.',
          },
        },
        {
          id: 'ad14-delete-undo',
          anchorId: 'shell-confirm-host',
          act: 'say',
          text: {
            en: 'A six-second Undo follows; the item comes back.',
            es: 'Sigue un Deshacer de seis segundos; el ítem vuelve.',
          },
        },
        {
          id: 'ad14-mark-exception',
          anchorId: 'shell-confirm-host',
          act: 'say',
          text: {
            en: 'Removing a mark is the exception: no Undo.',
            es: 'Quitar una marca es la excepción: sin Deshacer.',
          },
        },
        {
          id: 'ad14-mark-warning',
          anchorId: 'shell-confirm-host',
          act: 'say',
          text: {
            en: 'It asks nothing and returns nothing; think first.',
            es: 'No pregunta nada ni devuelve nada; piénsalo antes.',
          },
        },
        {
          id: 'ad14-about-beat',
          anchorId: 'set-about',
          act: 'say',
          text: {
            en: 'About tells who built the voices, openly licensed.',
            es: 'Acerca de cuenta quién creó las voces, con licencias abiertas.',
          },
        },
        {
          id: 'ad14-version-line',
          anchorId: 'set-version',
          act: 'say',
          text: {
            en: "The last line stamps the version — your build's exact name.",
            es: 'La última línea sella la versión: el nombre exacto de tu edición.',
          },
        },
        {
          id: 'ad14-version-stamp',
          anchorId: 'set-version',
          act: 'say',
          text: {
            en: 'Before believing nothing changed, check this stamp first.',
            es: 'Antes de creer que nada cambió, revisa este sello.',
          },
        },
      ],
    },
  ],
}
