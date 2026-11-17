/**
 * AD2 — «Traerlo todo / Bringing Everything In» (Advanced floor).
 *
 * Every road a text, a link, a file or a photo takes INTO Logos: the
 * share sheet's doors, the file picker's honest format list and its
 * honest refusals, the OCR road for pictures (and the cut-off warning
 * that refuses to fake an ending), the waiting room for files shared
 * while Logos slept, the web reader in depth, and the pasted link that
 * waits for its «Read page» tap in Listen.
 *
 * Census ownership (PLAN §2.5 — AD2 owns 33 items): A-9 the lone URL's
 * «Read page» banner · A-10 shared-in text plays at once · C-74 the
 * shared image that arrived cut off · D-54…D-62 the shell's share doors,
 * the web twin, the freshness window, the waiting room and the picker's
 * accepted formats · D-64 the honest refusal list · D-66 no readable
 * text = no book · D-68…D-86 the image/OCR path and the whole WebImport
 * sheet. Three further items ride as narrated beats inside their hosts,
 * exactly as §2.5 rules: D-63 (format decided by extension, then type —
 * inside D-62's scene), D-65 (a machine name never becomes a title —
 * inside D-62's scene) and D-67 (images dispatch to the OCR route —
 * inside D-68's scene).
 *
 * Surface honesty: the module runs on every surface Logos serves. The
 * three manifest doors exist only in the Android app, so their steps
 * are `optional` — on the web they skip and log (§7 clause 3) while the
 * web share target, the picker, OCR, the web reader and the pasted-link
 * banner carry the same lessons. Nothing pretends a door exists where
 * it does not.
 *
 * Performed acts go through the scenario port only: the one performed
 * share names its fiction text by id (payload.param, TEXT_EN), and the
 * typed link is an invented example address. All staged material is
 * fiction — never user data.
 */
import { TEXT_EN } from '../scenario/fiction.ts'
import type { PresentationModule } from '../engine/types.ts'

export const AD2: PresentationModule = {
  id: 'AD2',
  floor: 'advanced',
  title: { en: 'Bringing Everything In', es: 'Traerlo todo' },
  capability: {
    en: 'Bring everything into Logos — text, links, files in every readable format, and even photos — and know exactly what Logos refuses, and why.',
    es: 'Trae todo a Logos — texto, enlaces, archivos en cada formato legible y hasta fotos — y sabe exactamente qué rechaza Logos, y por qué.',
  },
  verifiedAgainst: '1.4.156',
  scenes: [
    {
      id: 'ad2-share-text-links',
      chapter: { en: 'Share text and links', es: 'Compartir texto y enlaces' },
      steps: [
        {
          id: 'ad2-share-ask',
          anchorId: 'share-listen-in-logos',
          act: 'ask',
          optional: true,
          question: {
            en: 'Reading something good in another app right now?',
            es: '¿Estás leyendo algo bueno en otra app ahora?',
          },
        },
        {
          id: 'ad2-share-door',
          anchorId: 'share-listen-in-logos',
          act: 'say',
          optional: true,
          text: {
            en: 'In any app, Share offers «Listen in Logos».',
            es: 'En cualquier app, Compartir ofrece «Escuchar en Logos».',
          },
        },
        {
          id: 'ad2-share-text-tap',
          anchorId: 'share-listen-in-logos',
          act: 'tap',
          optional: true,
          payload: { param: TEXT_EN.id },
          text: {
            en: 'Share our harbour story: it starts playing at once.',
            es: 'Comparte nuestra historia del puerto: empieza a sonar enseguida.',
          },
        },
        {
          id: 'ad2-share-text-after',
          anchorId: 'listen-page',
          act: 'say',
          text: {
            en: 'Whatever was playing ends; the shared text takes over.',
            es: 'Lo que sonaba termina; el texto compartido toma su lugar.',
          },
        },
        {
          id: 'ad2-share-no-confirm',
          anchorId: 'share-listen-in-logos',
          act: 'say',
          optional: true,
          text: {
            en: 'No confirmation, no Play tap: sharing means hearing.',
            es: 'Sin confirmación ni botón Reproducir: compartir es escuchar.',
          },
        },
        {
          id: 'ad2-share-link-ask',
          anchorId: 'share-link-to-webimport',
          act: 'ask',
          question: {
            en: 'And if what you share is only a link?',
            es: '¿Y si lo que compartes es solo un enlace?',
          },
        },
        {
          id: 'ad2-share-link-never-read',
          anchorId: 'share-link-to-webimport',
          act: 'say',
          text: {
            en: 'A lone link is never read aloud, letter by letter.',
            es: 'Un enlace solo nunca se lee letra por letra.',
          },
        },
        {
          id: 'ad2-share-link-tap',
          anchorId: 'share-link-to-webimport',
          effectAnchorId: 'web-import',
          act: 'tap',
          establishes: 'webimport-open',
          text: {
            en: 'It opens the page reader on that article instead.',
            es: 'En su lugar, abre el lector de páginas sobre ese artículo.',
          },
        },
        {
          id: 'ad2-share-web-twin',
          anchorId: 'share-web-target',
          act: 'say',
          text: {
            en: 'In the browser, the same share lands the same way.',
            es: 'En el navegador, compartir llega exactamente al mismo sitio.',
          },
        },
        {
          id: 'ad2-share-fresh-window',
          anchorId: 'share-listen-in-logos',
          act: 'say',
          optional: true,
          text: {
            en: 'A share counts only in its first four seconds.',
            es: 'Un envío solo cuenta en sus primeros cuatro segundos.',
          },
        },
        {
          id: 'ad2-share-fresh-after',
          anchorId: 'listen-page',
          act: 'say',
          text: {
            en: 'After that, it can never hijack your listening later.',
            es: 'Después, ya nunca podrá secuestrar tu escucha más tarde.',
          },
        },
      ],
    },
    {
      id: 'ad2-three-doors',
      chapter: { en: 'Files: the three doors', es: 'Archivos: las tres puertas' },
      steps: [
        {
          id: 'ad2-files-ask',
          anchorId: 'share-add-to-logos',
          act: 'ask',
          optional: true,
          question: {
            en: 'Got a book file sitting in another app?',
            es: '¿Tienes un archivo de libro en otra app?',
          },
        },
        {
          id: 'ad2-files-add-door',
          anchorId: 'share-add-to-logos',
          act: 'say',
          optional: true,
          text: {
            en: '«Add to Logos» takes files: one, or several together.',
            es: '«Añadir a Logos» recibe archivos: uno, o varios juntos.',
          },
        },
        {
          id: 'ad2-files-formats',
          anchorId: 'book-picker-accept',
          act: 'say',
          text: {
            en: 'EPUB, PDF, Word, FB2, RTF, Markdown, HTML, plain text.',
            es: 'EPUB, PDF, Word, FB2, RTF, Markdown, HTML, texto plano.',
          },
        },
        {
          id: 'ad2-files-import-tap',
          anchorId: 'bk-shelf-import',
          effectAnchorId: 'bk-tile',
          act: 'tap',
          text: {
            en: 'The imported book lands on the Library shelf.',
            es: 'El libro importado aterriza en la estantería de Libros.',
          },
        },
        {
          id: 'ad2-files-open-door',
          anchorId: 'share-open-in-logos',
          act: 'say',
          optional: true,
          text: {
            en: 'From Files, «Open in Logos» opens one file directly.',
            es: 'Desde Archivos, «Abrir en Logos» abre un archivo directamente.',
          },
        },
        {
          id: 'ad2-files-open-narrower',
          anchorId: 'share-open-in-logos',
          act: 'say',
          optional: true,
          text: {
            en: 'This door is narrower: no photos, no unknown files.',
            es: 'Esta puerta es más estrecha: sin fotos, sin archivos desconocidos.',
          },
        },
        {
          id: 'ad2-files-photo-contrast',
          anchorId: 'share-add-to-logos',
          act: 'say',
          optional: true,
          text: {
            en: 'Sharing a photo still works; opening one never offers Logos.',
            es: 'Compartir una foto sí funciona; abrirla nunca ofrece Logos.',
          },
        },
        {
          id: 'ad2-files-waiting-ask',
          anchorId: 'share-add-to-logos',
          act: 'ask',
          optional: true,
          question: {
            en: 'Shared something while Logos was completely closed?',
            es: '¿Compartiste algo con Logos completamente cerrado?',
          },
        },
        {
          id: 'ad2-files-waiting-room',
          anchorId: 'share-add-to-logos',
          act: 'say',
          optional: true,
          text: {
            en: 'Nothing is lost: the files wait in a waiting room.',
            es: 'Nada se pierde: los archivos esperan en una sala de espera.',
          },
        },
        {
          id: 'ad2-files-waiting-collect',
          anchorId: 'bk-shelf-import',
          act: 'say',
          text: {
            en: 'When Logos opens, the Library collects them automatically.',
            es: 'Cuando Logos se abre, la Biblioteca los recoge automáticamente.',
          },
        },
        {
          id: 'ad2-files-empty',
          anchorId: 'book-picker-accept',
          act: 'say',
          text: {
            en: 'A file with no readable words becomes no book.',
            es: 'Un archivo sin palabras legibles no se vuelve libro.',
          },
        },
        {
          id: 'ad2-files-empty-after',
          anchorId: 'book-picker-accept',
          act: 'say',
          text: {
            en: 'It fails loudly at the door, never hollow on the shelf.',
            es: 'Falla en voz alta en la puerta, nunca vacío en la estantería.',
          },
        },
      ],
    },
    {
      id: 'ad2-photo-text',
      chapter: { en: 'A photo becomes text', es: 'Una foto se vuelve texto' },
      steps: [
        {
          id: 'ad2-photo-ask',
          anchorId: 'import-image-ocr',
          act: 'ask',
          question: {
            en: 'Can a photograph become something you can hear?',
            es: '¿Puede una fotografía volverse algo que puedas escuchar?',
          },
        },
        {
          id: 'ad2-photo-share',
          anchorId: 'share-add-to-logos',
          act: 'say',
          optional: true,
          text: {
            en: 'Share the photo through «Add to Logos», images included.',
            es: 'Comparte la foto por «Añadir a Logos», imágenes incluidas.',
          },
        },
        {
          id: 'ad2-photo-ocr-tap',
          anchorId: 'import-image-ocr',
          act: 'tap',
          text: {
            en: "Logos reads the picture's words with OCR.",
            es: 'Logos lee las palabras de la imagen con OCR.',
          },
        },
        {
          id: 'ad2-photo-cover',
          anchorId: 'import-image-ocr',
          act: 'say',
          text: {
            en: "The photo itself stays as the new book's cover.",
            es: 'La foto misma queda como portada del libro nuevo.',
          },
        },
        {
          id: 'ad2-photo-footer',
          anchorId: 'import-image-ocr',
          act: 'say',
          text: {
            en: "A chat app's footer line never gets read aloud.",
            es: 'La línea de pie de la app de chat nunca se lee.',
          },
        },
        {
          id: 'ad2-photo-logo',
          anchorId: 'import-image-ocr',
          act: 'say',
          text: {
            en: 'Nor a misread logo, posing as a first chapter.',
            es: 'Ni un logotipo mal leído, disfrazado de primer capítulo.',
          },
        },
        {
          id: 'ad2-photo-cut-ask',
          anchorId: 'import-image-cut-warn',
          act: 'ask',
          question: {
            en: 'What if the picture holds only part of the message?',
            es: '¿Y si la imagen guarda solo parte del mensaje?',
          },
        },
        {
          id: 'ad2-photo-cut-mark',
          anchorId: 'import-image-cut-warn',
          act: 'say',
          text: {
            en: 'A trailing «…» tells Logos the ending never arrived.',
            es: 'Un «…» final le dice que el final nunca llegó.',
          },
        },
        {
          id: 'ad2-photo-cut-kept',
          anchorId: 'import-image-cut-warn',
          act: 'say',
          text: {
            en: 'Everything that did arrive is kept, exactly as written.',
            es: 'Todo lo que sí llegó se guarda, tal como llegó.',
          },
        },
        {
          id: 'ad2-photo-cut-warn',
          anchorId: 'import-image-cut-warn',
          act: 'say',
          text: {
            en: 'The book arrives with a warning, not a secret.',
            es: 'El libro llega con un aviso, no con un secreto.',
          },
        },
        {
          id: 'ad2-photo-cut-never-whole',
          anchorId: 'import-image-cut-warn',
          act: 'say',
          text: {
            en: 'A shortened text is never played as if whole.',
            es: 'Un texto acortado nunca suena como si estuviera entero.',
          },
        },
        {
          id: 'ad2-photo-cut-remedy',
          anchorId: 'listen-paste',
          act: 'say',
          text: {
            en: 'For the whole message: copy it, then Paste in Listen.',
            es: 'Para el mensaje entero: cópialo y usa Pegar en Escuchar.',
          },
        },
      ],
    },
    {
      id: 'ad2-refusals',
      chapter: { en: 'The honest refusals', es: 'Las negativas honestas' },
      steps: [
        {
          id: 'ad2-refusals-ask',
          anchorId: 'book-picker-accept',
          act: 'ask',
          question: {
            en: 'Does Logos accept absolutely every file format?',
            es: '¿Acepta Logos absolutamente todos los formatos de archivo?',
          },
        },
        {
          id: 'ad2-refusals-kindle',
          anchorId: 'book-picker-accept',
          act: 'say',
          text: {
            en: 'Kindle and others are refused: MOBI, AZW, KFX, DJVU.',
            es: 'Kindle y otros se rechazan: MOBI, AZW, KFX, DJVU.',
          },
        },
        {
          id: 'ad2-refusals-more',
          anchorId: 'book-picker-accept',
          act: 'say',
          text: {
            en: 'Also old Word, ODT, Pages, and comic files.',
            es: 'También Word antiguo, ODT, Pages y archivos de cómic.',
          },
        },
        {
          id: 'ad2-refusals-names-way',
          anchorId: 'book-picker-accept',
          act: 'say',
          text: {
            en: 'The refusal itself names the way out, in words.',
            es: 'La propia negativa nombra la salida, con palabras claras.',
          },
        },
        {
          id: 'ad2-refusals-error-words',
          anchorId: 'book-picker-accept',
          act: 'say',
          text: {
            en: '«Save it as EPUB or PDF and import that.»',
            es: '«Guárdalo como EPUB o PDF e impórtalo así.»',
          },
        },
        {
          id: 'ad2-refusals-consequence',
          anchorId: 'book-picker-accept',
          act: 'say',
          text: {
            en: 'Unsupported means converted, never impossible.',
            es: 'No compatible significa convertirlo, nunca imposible.',
          },
        },
        {
          id: 'ad2-refusals-how-decided',
          anchorId: 'book-picker-accept',
          act: 'say',
          text: {
            en: 'Format is decided by extension first, then by type.',
            es: 'El formato se decide por la extensión, luego por el tipo.',
          },
        },
        {
          id: 'ad2-refusals-machine-name',
          anchorId: 'book-picker-accept',
          act: 'say',
          text: {
            en: 'A camera-named file is never shown as a title.',
            es: 'Un nombre de cámara nunca se muestra como título.',
          },
        },
        {
          id: 'ad2-refusals-shared-name',
          anchorId: 'bk-shelf-import',
          act: 'say',
          text: {
            en: 'It imports as «Shared file», in honest words.',
            es: 'Se importa como «Archivo compartido», con palabras honestas.',
          },
        },
      ],
    },
    {
      id: 'ad2-web-reader',
      chapter: { en: 'The web reader, in depth', es: 'El lector web a fondo' },
      steps: [
        {
          id: 'ad2-web-ask',
          anchorId: 'web-import',
          act: 'ask',
          question: {
            en: 'A page full of menus and ads: hear only the article?',
            es: '¿Una página llena de menús y anuncios: escuchar solo el artículo?',
          },
        },
        {
          id: 'ad2-web-sheet',
          anchorId: 'web-import',
          act: 'say',
          text: {
            en: "This sheet brings a page's text into Logos, clean.",
            es: 'Esta hoja trae el texto de una página a Logos, limpio.',
          },
        },
        {
          id: 'ad2-web-prefilled',
          anchorId: 'web-import-url',
          act: 'say',
          text: {
            en: 'Open it after copying a link: it is already filled.',
            es: 'Ábrela tras copiar un enlace: ya viene escrito.',
          },
        },
        {
          id: 'ad2-web-paste-tap',
          anchorId: 'web-import-paste',
          effectAnchorId: 'web-import-url',
          act: 'tap',
          establishes: 'web-phase-loading',
          text: {
            en: 'This button fills the link and fetches immediately.',
            es: 'Este botón escribe el enlace y busca de inmediato.',
          },
        },
        {
          id: 'ad2-web-promise',
          anchorId: 'web-import-url',
          act: 'say',
          text: {
            en: 'The promise, in plain words: only the article itself.',
            es: 'La promesa, con palabras claras: solo el artículo mismo.',
          },
        },
        {
          id: 'ad2-web-cleaner',
          anchorId: 'web-import-url',
          act: 'say',
          text: {
            en: 'No menus, ads, links, captions or reference lists.',
            es: 'Sin menús, anuncios, enlaces, pies ni listas de referencias.',
          },
        },
        {
          id: 'ad2-web-type-address',
          anchorId: 'web-import-url',
          act: 'type',
          payload: { value: 'www.example.org/la-carta-del-faro' },
          text: {
            en: 'Or type the page’s address yourself, by hand.',
            es: 'O escribe la dirección de la página, tú mismo.',
          },
        },
        {
          id: 'ad2-web-go-tap',
          anchorId: 'web-import-go',
          effectAnchorId: 'web-import-loading',
          act: 'tap',
          text: {
            en: 'Logos tries several roads until one brings the text.',
            es: 'Logos prueba varios caminos hasta que uno trae el texto.',
          },
        },
        {
          id: 'ad2-web-loading',
          anchorId: 'web-import-loading',
          act: 'say',
          text: {
            en: "While it reads: the page's name, and honest waiting.",
            es: 'Mientras lee: el nombre del sitio, y espera honesta.',
          },
        },
        {
          id: 'ad2-web-cancel-tap',
          anchorId: 'web-import-cancel',
          act: 'tap',
          text: {
            en: 'Cancel truly cancels; closing the sheet cancels too.',
            es: 'Cancelar cancela de verdad; cerrar la hoja también cancela.',
          },
        },
        {
          id: 'ad2-web-cancel-after',
          anchorId: 'web-import',
          act: 'say',
          text: {
            en: 'Your own Cancel never becomes an error message.',
            es: 'Tu propia cancelación nunca se vuelve un mensaje de error.',
          },
        },
        {
          id: 'ad2-web-ready-proof',
          anchorId: 'web-import-ready',
          act: 'say',
          text: {
            en: 'Ready shows site, title, words and listening time.',
            es: 'La vista previa muestra sitio, título, palabras y tiempo.',
          },
        },
        {
          id: 'ad2-web-ready-check',
          anchorId: 'web-import-ready',
          act: 'say',
          text: {
            en: 'You check the right page before choosing anything.',
            es: 'Compruebas que es la página correcta antes de elegir.',
          },
        },
        {
          id: 'ad2-web-outcomes-ask',
          anchorId: 'web-import-listen-now',
          act: 'ask',
          question: {
            en: 'Verified. Now: hear it, keep it, or file it?',
            es: 'Comprobado. Ahora: ¿escucharlo, guardarlo o archivarlo?',
          },
        },
        {
          id: 'ad2-web-listen-now-tap',
          anchorId: 'web-import-listen-now',
          act: 'tap',
          text: {
            en: '«Listen now» loads it and starts the voice.',
            es: '«Escuchar ahora» lo carga y arranca la voz.',
          },
        },
        {
          id: 'ad2-web-later-tap',
          anchorId: 'web-import-later',
          act: 'tap',
          text: {
            en: '«Listen later» files the text in your Library.',
            es: '«Escuchar después» guarda el texto en tu Biblioteca.',
          },
        },
        {
          id: 'ad2-web-later-memory',
          anchorId: 'web-import-later',
          act: 'say',
          text: {
            en: 'The saved page remembers its site and address.',
            es: 'La página guardada recuerda su sitio y su dirección.',
          },
        },
        {
          id: 'ad2-web-audio-tap',
          anchorId: 'web-import-save-audio',
          act: 'tap',
          text: {
            en: '«Save the audio» renders it without opening Listen.',
            es: '«Guardar el audio» lo crea sin abrir Escuchar.',
          },
        },
        {
          id: 'ad2-web-audio-queue',
          anchorId: 'web-import-save-audio',
          act: 'say',
          text: {
            en: 'Busy rendering another? This one queues behind it.',
            es: '¿Creando otro audio? Este espera su turno en la cola.',
          },
        },
        {
          id: 'ad2-web-error',
          anchorId: 'web-import-error',
          act: 'say',
          text: {
            en: 'A blocked page fails here, naming its likely cause.',
            es: 'Una página bloqueada falla aquí, nombrando su causa probable.',
          },
        },
        {
          id: 'ad2-web-retry',
          anchorId: 'web-import-go',
          act: 'say',
          text: {
            en: 'The same button becomes «Try again», right there.',
            es: 'El mismo botón se vuelve «Intentar de nuevo», ahí mismo.',
          },
        },
        {
          id: 'ad2-web-book-door',
          anchorId: 'web-import-book-door',
          act: 'tap',
          optional: true,
          text: {
            en: 'From the Library, this sheet also imports books.',
            es: 'Desde la Biblioteca, esta hoja también importa libros.',
          },
        },
        {
          id: 'ad2-web-audio-door',
          anchorId: 'web-import-audio-door',
          act: 'tap',
          optional: true,
          text: {
            en: 'And audio files already living on this phone.',
            es: 'Y archivos de audio que ya viven en este teléfono.',
          },
        },
      ],
    },
    {
      id: 'ad2-pasted-link',
      chapter: { en: 'A link pasted in Listen', es: 'Un enlace pegado en Escuchar' },
      steps: [
        {
          id: 'ad2-pasted-ask',
          anchorId: 'listen-editor',
          act: 'ask',
          question: {
            en: "Pasted a link into Listen's box instead? What happens?",
            es: '¿Pegaste un enlace en la caja de Escuchar? ¿Qué pasa?',
          },
        },
        {
          id: 'ad2-pasted-type',
          anchorId: 'listen-editor',
          effectAnchorId: 'listen-url-banner',
          act: 'type',
          payload: { value: 'www.example.org/la-carta-del-faro' },
          text: {
            en: 'The whole box holds one link, and nothing more.',
            es: 'Toda la caja guarda un enlace, y nada más.',
          },
        },
        {
          id: 'ad2-pasted-banner',
          anchorId: 'listen-url-banner',
          act: 'say',
          text: {
            en: 'A banner appears, naming the site it found.',
            es: 'Aparece un cartel que nombra el sitio encontrado.',
          },
        },
        {
          id: 'ad2-pasted-waits',
          anchorId: 'listen-url-banner',
          act: 'say',
          text: {
            en: 'Nothing is fetched yet; the link simply waits.',
            es: 'Nada se busca todavía; el enlace simplemente espera.',
          },
        },
        {
          id: 'ad2-pasted-banner-tap',
          anchorId: 'listen-url-banner',
          effectAnchorId: 'web-import',
          act: 'tap',
          establishes: 'webimport-open',
          text: {
            en: 'Tap «Read page»: the web reader opens there.',
            es: 'Toca «Leer la página»: el lector web se abre ahí.',
          },
        },
        {
          id: 'ad2-pasted-after',
          anchorId: 'web-import',
          act: 'say',
          text: {
            en: 'The clean article replaces the link as listening material.',
            es: 'El artículo limpio reemplaza al enlace como material de escucha.',
          },
        },
        {
          id: 'ad2-pasted-contrast',
          anchorId: 'listen-url-banner',
          act: 'say',
          text: {
            en: 'Shared links open it alone; pasted links ask you.',
            es: 'Los enlaces compartidos lo abren solos; los pegados te preguntan.',
          },
        },
        {
          id: 'ad2-pasted-close',
          anchorId: 'listen-editor',
          act: 'say',
          text: {
            en: 'Now every road in is one you command.',
            es: 'Ahora cada camino de entrada es uno que tú mandas.',
          },
        },
      ],
    },
  ],
}

export default AD2
