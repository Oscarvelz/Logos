/**
 * AD11 · El reproductor flotante en Ajustes / The Floating Player in
 * Settings — the bubble's permanent home: the same facts Q2 performs at
 * the λ, taught here at their Settings seat, with the long words.
 *
 * Coverage (PLAN §2.5 — AD11 owns 16 census items): B-4, B-5, B-48, B-49,
 * B-50, B-51, B-52 · E-34, E-35, E-36, E-37, E-38, E-39, E-40, E-41, E-42.
 * Title and capability are the catalogue's, verbatim — the catalogue owns
 * the words. Scene chapters are the catalogue's scene titles, verbatim.
 *
 * The three switches, one by one (scene 1): «Floating bubble» (E-38/B-49),
 * «Play the clipboard» (E-39/B-50), «Words in the panel» (E-40/B-51) — each
 * with its consequence in both directions. The main switch's description
 * speaks four situations and the lesson walks all four: browser (E-35),
 * old shell (E-36), permission needed (E-37), all in order (E-38). B-4
 * rides the browser beat: where the shell cannot exist, the λ is only a
 * brand mark and nothing is promised.
 *
 * The λ (scene 2) is the fast door to the SAME switch: one fact, two
 * seats, reconciled by the page's constant re-check of the native state.
 * Its tap here is performed through the scenario port's LambdaPort
 * discipline — the one real touch the fleet allows (Q2 performed it
 * first; this is its Settings seat). B-5 (left floating, the bubble
 * returns when Logos reopens) and B-48 (the panel wears the app's theme
 * and speaks its language) close the scene.
 *
 * BENCH HEDGE — PLAN §2.6 item 12 (scene 3): the permission journey is
 * NARRATED, never performed — the system screen is not a sealed stage.
 * The words claim exactly what the code proves and no more: the first
 * switch-on without permission opens Android's permission screen and
 * does NOT switch on; a toast says to allow it there and switch on
 * again; the Settings page polls the native state every 1 200 ms, so
 * returning lands on fresh truth; the second tap is the one that floats
 * the bubble. No step here taps the switch, and no caption says the
 * bubble floated during the trip.
 *
 * Scene 4 teaches the honest clipboard contract at its Settings home:
 * Android only lets Logos look AT the tap — never in secret, never
 * between taps — and the lever is one fact in two houses (this switch
 * and the panel's Auto, B-42 via the `bubble-lever` contract).
 *
 * Scene 5 NAMES the two diagnostic lines (E-41/E-42, B-52) as what they
 * are — windows, not controls: they render only when there is something
 * to say, they are read and shown, never operated. Their steps are
 * `optional` because both lines exist conditionally (the registry's own
 * preconditions); a miss skips and logs instead of ending the scene.
 *
 * Performed acts: taps on the `set-*` switches are stage gestures on the
 * fiction card (the default scenario port performs no data act for
 * them); the λ tap goes through the port. No duration literal anywhere.
 */
import type { PresentationModule } from '../engine/types.ts'

export const AD11: PresentationModule = {
  id: 'AD11',
  floor: 'advanced',
  title: { en: 'The Floating Player in Settings', es: 'El reproductor flotante en Ajustes' },
  capability: {
    en: 'Control the floating player from Settings: its three switches in every situation, the permission trip, and why the clipboard is only read at your tap.',
    es: 'Controla el reproductor flotante desde Ajustes: sus tres interruptores en cada situación, el viaje del permiso y por qué el portapapeles solo se lee con tu toque.',
  },
  verifiedAgainst: '1.4.156',
  scenes: [
    {
      id: 'three-switches-four-situations',
      chapter: { en: 'Three switches, four situations', es: 'Tres interruptores, cuatro situaciones' },
      steps: [
        {
          id: 'ad11-card-home',
          anchorId: 'set-bubble',
          act: 'say',
          text: {
            en: 'This card is the floating player’s permanent home in Settings.',
            es: 'Esta tarjeta es la casa permanente del reproductor flotante en Ajustes.',
          },
        },
        {
          id: 'ad11-card-promise',
          anchorId: 'set-bubble-desc',
          act: 'say',
          text: {
            en: 'Its promise: a small λ that floats over your other apps.',
            es: 'Su promesa: una pequeña λ que flota sobre tus demás apps.',
          },
        },
        {
          id: 'ad11-ask-first-switch',
          anchorId: 'set-bubble-switch',
          act: 'ask',
          question: {
            en: 'What does this first switch turn on?',
            es: '¿Qué enciende este primer interruptor?',
          },
        },
        {
          id: 'ad11-switch-on',
          anchorId: 'set-bubble-switch',
          act: 'tap',
          text: {
            en: 'Switch it on: the λ floats over your other apps.',
            es: 'Enciéndelo: la λ flota sobre tus demás aplicaciones.',
          },
        },
        {
          id: 'ad11-switch-off',
          anchorId: 'set-bubble-switch',
          act: 'tap',
          text: {
            en: 'Switch it off: the bubble comes back inside.',
            es: 'Apágalo: la burbuja vuelve adentro.',
          },
        },
        {
          id: 'ad11-desc-speaks',
          anchorId: 'set-bubble-desc',
          act: 'say',
          text: {
            en: 'Its description always tells the truth about your situation.',
            es: 'Su descripción siempre dice la verdad sobre tu situación.',
          },
        },
        {
          id: 'ad11-desc-browser',
          anchorId: 'set-bubble-desc',
          act: 'say',
          text: {
            en: 'In a browser it reads: only in the Logos app.',
            es: 'En el navegador dice: solo en la app de Logos.',
          },
        },
        {
          id: 'ad11-browser-mark',
          anchorId: 'bubble-supported',
          act: 'say',
          text: {
            en: 'There, the λ is only a brand mark, never a promise.',
            es: 'Ahí, la λ es solo una marca, nunca una promesa.',
          },
        },
        {
          id: 'ad11-desc-old-shell',
          anchorId: 'set-bubble-desc',
          act: 'say',
          text: {
            en: 'An old app shell reads: update Logos, and it appears.',
            es: 'Un shell viejo dice: actualiza Logos, y aparecerá aquí.',
          },
        },
        {
          id: 'ad11-desc-permission',
          anchorId: 'set-bubble-desc',
          act: 'say',
          text: {
            en: 'Without permission, it says the switch will take you there.',
            es: 'Sin permiso dice que el interruptor te llevará ahí.',
          },
        },
        {
          id: 'ad11-desc-in-order',
          anchorId: 'set-bubble-desc',
          act: 'say',
          text: {
            en: 'When all is well: drag it anywhere; tap it to play.',
            es: 'Cuando todo está en orden: arrástrala y tócala para escuchar.',
          },
        },
        {
          id: 'ad11-lever-on',
          anchorId: 'set-bubble-auto',
          act: 'tap',
          text: {
            en: 'Second switch: play the clipboard. It starts on.',
            es: 'Segundo interruptor: reproducir el portapapeles. Empieza encendido.',
          },
        },
        {
          id: 'ad11-lever-off',
          anchorId: 'set-bubble-auto',
          act: 'tap',
          text: {
            en: 'Switch it off: the bubble only controls; nothing plays alone.',
            es: 'Apágalo: la burbuja solo controla; nada suena solo.',
          },
        },
        {
          id: 'ad11-words-on',
          anchorId: 'set-bubble-text',
          act: 'tap',
          text: {
            en: 'Third switch: the words inside the bubble’s panel.',
            es: 'Tercer interruptor: las palabras dentro del panel.',
          },
        },
        {
          id: 'ad11-words-consequence',
          anchorId: 'set-bubble-text',
          act: 'say',
          text: {
            en: 'On, the panel reads along; on tablets, neighbours ride dimmed.',
            es: 'Encendido, el panel lee contigo; en tabletas, las vecinas acompañan atenuadas.',
          },
        },
        {
          id: 'ad11-words-off',
          anchorId: 'set-bubble-text',
          act: 'tap',
          text: {
            en: 'Switch it off: the panel keeps only its transport keys.',
            es: 'Apágalo: el panel conserva solo sus teclas de transporte.',
          },
        },
      ],
    },
    {
      id: 'the-lambda-is-the-same-switch',
      chapter: { en: 'The λ is the same switch', es: 'La λ es el mismo interruptor' },
      steps: [
        {
          id: 'ad11-ask-lambda',
          anchorId: 'bubble-lambda',
          act: 'ask',
          question: {
            en: 'Is the λ a different switch from this one?',
            es: '¿Es la λ un interruptor distinto de este?',
          },
        },
        {
          id: 'ad11-lambda-same',
          anchorId: 'bubble-lambda',
          act: 'say',
          text: {
            en: 'No: the λ is this same switch, within a finger’s reach.',
            es: 'No: la λ es este mismo interruptor, al alcance del dedo.',
          },
        },
        {
          id: 'ad11-lambda-tap',
          anchorId: 'bubble-lambda',
          act: 'tap',
          text: {
            en: 'Tap it here or there: one fact changes, both places agree.',
            es: 'Tócala aquí o allá: cambia un solo hecho, ambos lugares concuerdan.',
          },
        },
        {
          id: 'ad11-both-agree',
          anchorId: 'set-bubble-switch',
          act: 'say',
          text: {
            en: 'Settings checks with the phone constantly, so both always agree.',
            es: 'Ajustes consulta al teléfono constantemente, así que ambos siempre concuerdan.',
          },
        },
        {
          id: 'ad11-bubble-returns',
          anchorId: 'bubble-state',
          act: 'say',
          text: {
            en: 'Leave it floating, and it returns when Logos reopens.',
            es: 'Déjala flotando, y volverá cuando Logos se abra de nuevo.',
          },
        },
        {
          id: 'ad11-no-reinstall',
          anchorId: 'bubble-state',
          act: 'say',
          text: {
            en: 'After an update, you never reinstall the bubble.',
            es: 'Tras una actualización, nunca reinstalas la burbuja.',
          },
        },
        {
          id: 'ad11-panel-dress',
          anchorId: 'bubble-theme-lang',
          act: 'say',
          text: {
            en: 'The panel wears Logos’ theme and speaks its language.',
            es: 'El panel viste el tema de Logos y habla su idioma.',
          },
        },
        {
          id: 'ad11-panel-follows',
          anchorId: 'bubble-theme-lang',
          act: 'say',
          text: {
            en: 'Change theme or language once; the bubble follows by itself.',
            es: 'Cambia el tema o el idioma una vez; la burbuja sigue sola.',
          },
        },
      ],
    },
    {
      id: 'permission-a-two-tap-trip',
      chapter: { en: 'Permission: a two-tap trip', es: 'El permiso: un viaje de dos toques' },
      steps: [
        {
          id: 'ad11-ask-permission',
          anchorId: 'set-bubble-switch',
          act: 'ask',
          question: {
            en: 'You switch it on: does the bubble float immediately?',
            es: 'Lo enciendes: ¿la burbuja flota de inmediato?',
          },
        },
        {
          id: 'ad11-permission-first',
          anchorId: 'bubble-permission',
          act: 'say',
          text: {
            en: 'Not without permission: Android must allow floating over other apps.',
            es: 'No sin permiso: Android debe permitir flotar sobre otras apps.',
          },
        },
        {
          id: 'ad11-first-tap-trip',
          anchorId: 'set-bubble-switch',
          act: 'say',
          text: {
            en: 'The first tap opens Android’s permission screen, nothing more.',
            es: 'El primer toque abre la pantalla de permiso de Android, nada más.',
          },
        },
        {
          id: 'ad11-toast-warns',
          anchorId: 'set-bubble-desc',
          act: 'say',
          text: {
            en: 'A message warns: allow it there, then switch on again.',
            es: 'Un aviso lo dice: permítelo ahí, y enciéndelo otra vez.',
          },
        },
        {
          id: 'ad11-grant-there',
          anchorId: 'bubble-permission',
          act: 'say',
          text: {
            en: 'Grant it there. That screen is Android’s, not Logos’.',
            es: 'Concédelo ahí. Esa pantalla es de Android, no de Logos.',
          },
        },
        {
          id: 'ad11-fresh-truth',
          anchorId: 'set-bubble-switch',
          act: 'say',
          text: {
            en: 'Back here, Settings already knows: it re-checks every moment.',
            es: 'De vuelta aquí, Ajustes ya lo sabe: vuelve a comprobarlo cada instante.',
          },
        },
        {
          id: 'ad11-second-tap',
          anchorId: 'set-bubble-switch',
          act: 'say',
          text: {
            en: 'Now the second tap truly floats the bubble.',
            es: 'Ahora el segundo toque sí suelta la burbuja.',
          },
        },
        {
          id: 'ad11-permission-serves',
          anchorId: 'bubble-state',
          act: 'say',
          text: {
            en: 'Permission granted once serves every later trip to the λ.',
            es: 'El permiso concedido una vez sirve para cada visita a la λ.',
          },
        },
      ],
    },
    {
      id: 'why-android-only-looks',
      chapter: { en: 'Why Android only looks when you tap', es: 'Por qué Android solo mira al tocar' },
      steps: [
        {
          id: 'ad11-lever-decides',
          anchorId: 'set-bubble-auto',
          act: 'say',
          text: {
            en: 'This lever decides whether Logos listens to your copies.',
            es: 'Esta palanca decide si Logos escucha tus copias.',
          },
        },
        {
          id: 'ad11-ask-watch',
          anchorId: 'set-bubble-auto',
          act: 'ask',
          question: {
            en: 'Can Logos watch the clipboard all the time, quietly?',
            es: '¿Puede Logos vigilar el portapapeles todo el tiempo, en silencio?',
          },
        },
        {
          id: 'ad11-only-at-tap',
          anchorId: 'set-bubble-auto',
          act: 'say',
          text: {
            en: 'No. Android only lets Logos look at the tap itself.',
            es: 'No. Android solo deja que Logos mire en el toque mismo.',
          },
        },
        {
          id: 'ad11-tap-is-permission',
          anchorId: 'bubble-lever',
          act: 'say',
          text: {
            en: 'Copy anywhere, then tap the bubble: that tap is permission.',
            es: 'Copia donde sea y toca la burbuja: ese toque es el permiso.',
          },
        },
        {
          id: 'ad11-opening-counts',
          anchorId: 'bubble-lever',
          act: 'say',
          text: {
            en: 'Opening Logos right after copying counts as the same tap.',
            es: 'Abrir Logos justo después de copiar cuenta como el mismo toque.',
          },
        },
        {
          id: 'ad11-one-lever',
          anchorId: 'set-bubble-auto',
          act: 'tap',
          text: {
            en: 'One lever, two houses: this switch and the panel’s Auto.',
            es: 'Una palanca, dos casas: este interruptor y el Auto del panel.',
          },
        },
        {
          id: 'ad11-lever-agrees',
          anchorId: 'bubble-lever',
          act: 'say',
          text: {
            en: 'Move either one, and the other agrees; they are one fact.',
            es: 'Mueve cualquiera de los dos, y el otro concuerda; son un solo hecho.',
          },
        },
        {
          id: 'ad11-never-secret',
          anchorId: 'set-bubble-auto',
          act: 'say',
          text: {
            en: 'Nothing is ever read in secret, between your taps.',
            es: 'Nunca se lee nada en secreto, entre tus toques.',
          },
        },
      ],
    },
    {
      id: 'the-two-diagnostic-lines',
      chapter: { en: 'The two diagnostic lines', es: 'Las dos líneas de diagnóstico' },
      steps: [
        {
          id: 'ad11-lines-appear',
          anchorId: 'set-bubble',
          act: 'say',
          text: {
            en: 'At the card’s foot, two quiet lines sometimes appear.',
            es: 'Al pie de la tarjeta a veces aparecen dos líneas discretas.',
          },
        },
        {
          id: 'ad11-lines-conditional',
          anchorId: 'set-bubble',
          act: 'say',
          text: {
            en: 'They only appear when there is something to say.',
            es: 'Solo aparecen cuando hay algo que decir.',
          },
        },
        {
          id: 'ad11-ask-where-look',
          anchorId: 'set-bubble-last',
          act: 'ask',
          optional: true,
          question: {
            en: 'You copied, and nothing played. Where do you look?',
            es: 'Copiaste, y nada sonó. ¿Dónde miras?',
          },
        },
        {
          id: 'ad11-last-try',
          anchorId: 'set-bubble-last',
          act: 'say',
          optional: true,
          text: {
            en: 'Here: the last clipboard try, told in plain words.',
            es: 'Aquí: el último intento del portapapeles, contado en palabras claras.',
          },
        },
        {
          id: 'ad11-last-says',
          anchorId: 'set-bubble-last',
          act: 'say',
          optional: true,
          text: {
            en: 'It says what the shell tried, and what came back.',
            es: 'Dice lo que el shell intentó, y lo que volvió.',
          },
        },
        {
          id: 'ad11-journal-line',
          anchorId: 'set-bubble-journal',
          act: 'say',
          optional: true,
          text: {
            en: 'Below it, stage moves: the reading’s last four moves.',
            es: 'Debajo, movimientos de escena: los últimos cuatro del punto de lectura.',
          },
        },
        {
          id: 'ad11-journal-purpose',
          anchorId: 'set-bubble-journal',
          act: 'say',
          optional: true,
          text: {
            en: 'It exists so a helper can diagnose from one screenshot.',
            es: 'Existe para que quien ayuda diagnostique con una sola captura.',
          },
        },
        {
          id: 'ad11-windows-not-controls',
          anchorId: 'set-bubble-last',
          act: 'say',
          optional: true,
          text: {
            en: 'You never operate them; you only read and show them.',
            es: 'Nunca se operan; solo se leen y se enseñan.',
          },
        },
        {
          id: 'ad11-copy-story',
          anchorId: 'set-bubble',
          act: 'say',
          text: {
            en: 'A copy that never arrives leaves its story here.',
            es: 'Una copia que nunca llega deja su historia aquí.',
          },
        },
      ],
    },
  ],
}

export default AD11
