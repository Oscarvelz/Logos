/**
 * AD4 — «Ritmo y sueño / Rhythm and Sleep» (Advanced floor).
 *
 * The pace lesson, kept tight: one speed key behind two doors, the silence
 * between sentences, and the sleep timer. Everything happens around the
 * scenario's practice text while it plays — speed is meaningless until the
 * voice is sounding, and the timer is a countdown worn on its chip.
 *
 * Census ownership (PLAN §2.5 — AD4 owns 8 items):
 * A-34 the speed chip opens the Speed sheet · A-35 the sheet itself: eight
 * step buttons (0.75 … 2) plus the fine slider (0.5–2.5) — the module NEVER
 * calls 2× the ceiling (census C-7) · A-36 the sleep chip wears the live
 * countdown · A-37 the Sleep sheet (Off · 10 · 15 · 20 · 30 · 45 · 60) and
 * its clearing by a new text · A-38 ★H the ending: the last ten seconds
 * fade, then it PAUSES — it never ends the session, the place is kept ·
 * E-20 the Playback card's promise, framing the two Settings beats ·
 * E-21 the Settings speed slider is the SAME listenSpeed the sheet drives
 * (one fact, two doors; pitch preserved, applies live) · E-22 the pause
 * between sentences lives ONLY in that Settings row — no other door exists.
 * Nothing else is claimed here: Create's separate export speed is AD8's.
 *
 * Performed acts go through the scenario port only: the opening Play tap
 * names its fiction text by id (payload.param). All staged material is
 * fiction.ts — never user data. The Settings beats unfold the Playback card
 * by its header anchor first, as the anchors' declared precondition asks.
 */
import { TEXT_EN } from '../scenario/fiction.ts'
import type { PresentationModule } from '../engine/types.ts'

export const AD4: PresentationModule = {
  id: 'AD4',
  floor: 'advanced',
  title: { en: 'Rhythm and Sleep', es: 'Ritmo y sueño' },
  capability: {
    en: 'Set the pace of every listening: speed up to two and a half times, the pause between sentences, and a sleep timer that fades out gently.',
    es: 'Marca el ritmo de cada escucha: velocidad hasta dos veces y media, la pausa entre frases y un temporizador de sueño que se apaga con suavidad.',
  },
  verifiedAgainst: '1.4.156',
  scenes: [
    {
      id: 'ad4-speed',
      chapter: { en: 'One speed key, two doors', es: 'Una llave de velocidad, dos puertas' },
      steps: [
        {
          id: 'ad4-play-fiction',
          anchorId: 'listen-play',
          effectAnchorId: 'listen-reader',
          act: 'tap',
          payload: { param: TEXT_EN.id },
          establishes: 'scenario-session-playing',
          text: {
            en: 'First, our practice text starts playing on the stage.',
            es: 'Primero, nuestro texto de práctica empieza a sonar en el escenario.',
          },
        },
        {
          id: 'ad4-speed-ask',
          anchorId: 'listen-speed-chip',
          act: 'ask',
          question: {
            en: 'How fast should this voice read?',
            es: '¿A qué velocidad debería leer esta voz?',
          },
        },
        {
          id: 'ad4-speed-chip-tap',
          anchorId: 'listen-speed-chip',
          act: 'tap',
          text: {
            en: 'This gauge chip wears the current speed — and the chip itself is a wheel. Tap it: the speed steps up.',
            es: 'Este chip medidor lleva la velocidad actual — y el propio chip es una rueda. Tócalo: la velocidad sube un paso.',
          },
        },
        {
          id: 'ad4-speed-steps',
          anchorId: 'listen-speed-chip',
          act: 'say',
          text: {
            en: 'Drag it up or down and the speed rolls with it, one step at a time: eight steps climb from 0.75 up to 2, and past 2 the wheel loops back to 0.75.',
            es: 'Arrástralo hacia arriba o hacia abajo y la velocidad rueda con él, paso a paso: ocho pasos suben de 0,75 hasta 2, y al pasar de 2 la rueda vuelve a 0,75.',
          },
        },
        {
          id: 'ad4-speed-pick',
          anchorId: 'listen-speed-chip',
          act: 'tap',
          text: {
            en: 'Every step applies the moment it lands — the reading speeds up or slows down right now.',
            es: 'Cada paso se aplica en el instante en que cae: la lectura acelera o frena ahora mismo.',
          },
        },
        {
          id: 'ad4-speed-slider',
          anchorId: 'listen-speed-chip',
          act: 'say',
          text: {
            en: 'For a finer speed — any value, up to 2.5 — the same key waits in Settings, on its own slider. We will meet it there in a moment.',
            es: 'Para una velocidad más fina — cualquier valor, hasta 2,5 — la misma llave espera en Ajustes, con su propio deslizador. La veremos allí en un momento.',
          },
        },
        {
          id: 'ad4-speed-pitch',
          anchorId: 'listen-speed-chip',
          act: 'say',
          text: {
            en: 'Faster, but never squeaky: the pitch stays natural.',
            es: 'Más rápido, pero sin voz aguda: el tono queda natural.',
          },
        },
        {
          id: 'ad4-goto-settings',
          anchorId: 'shell-nav:settings',
          act: 'goto',
          establishes: 'settings-page',
          text: {
            en: 'The same speed key also lives in Settings.',
            es: 'La misma llave de velocidad también vive en Ajustes.',
          },
        },
        {
          id: 'ad4-set-playback',
          anchorId: 'set-playback',
          act: 'tap',
          establishes: 'playback-card-open',
          text: {
            en: 'Open the Playback card: every row applies instantly.',
            es: 'Abre la tarjeta Reproducción: cada fila se aplica al instante.',
          },
        },
        {
          id: 'ad4-set-speed',
          anchorId: 'set-speed',
          act: 'say',
          text: {
            en: 'One fact, two doors: this slider moves Listen too.',
            es: 'Un solo hecho, dos puertas: este deslizador mueve también Escuchar.',
          },
        },
      ],
    },
    {
      id: 'ad4-pause',
      chapter: { en: 'The pause between sentences', es: 'La pausa entre frases' },
      steps: [
        {
          id: 'ad4-pause-where',
          anchorId: 'set-sentence-pause',
          act: 'say',
          text: {
            en: 'This row exists only here, nowhere else in Logos.',
            es: 'Esta fila existe solo aquí, en ningún otro rincón.',
          },
        },
        {
          id: 'ad4-pause-range',
          anchorId: 'set-sentence-pause',
          act: 'say',
          text: {
            en: 'From zero, continuous, up to eight hundred milliseconds.',
            es: 'De cero, continua, hasta ochocientos milisegundos de silencio.',
          },
        },
        {
          id: 'ad4-pause-hear',
          anchorId: 'set-sentence-pause',
          act: 'say',
          text: {
            en: 'Set it once; every reading breathes with that gap.',
            es: 'Fíjala una vez; cada lectura respira con esa pausa.',
          },
        },
      ],
    },
    {
      id: 'ad4-sleep',
      chapter: { en: 'The sleep timer', es: 'El temporizador de sueño' },
      steps: [
        {
          id: 'ad4-sleep-ask',
          anchorId: 'listen-sleep-chip',
          act: 'ask',
          question: {
            en: 'Listening in bed, half asleep already?',
            es: '¿Escuchando en la cama, ya casi dormido?',
          },
        },
        {
          id: 'ad4-goto-listen',
          anchorId: 'shell-nav:listen',
          act: 'goto',
          establishes: 'listen-page',
          text: {
            en: 'Back in Listen, the moon chip keeps sleep time.',
            es: 'De vuelta en Escuchar, el chip de luna guarda el sueño.',
          },
        },
        {
          id: 'ad4-sleep-chip-tap',
          anchorId: 'listen-sleep-chip',
          effectAnchorId: 'listen-sleep-sheet',
          act: 'tap',
          establishes: 'sleep-sheet-open',
          text: {
            en: 'Tap the moon: choose when the voice rests.',
            es: 'Toca la luna: elige cuándo descansa la voz.',
          },
        },
        {
          id: 'ad4-sleep-choices',
          anchorId: 'listen-sleep-sheet',
          act: 'say',
          text: {
            en: 'Ten to sixty minutes, or Off to clear it.',
            es: 'De diez a sesenta minutos, o Apagado para quitarlo.',
          },
        },
        {
          id: 'ad4-sleep-set',
          anchorId: 'listen-sleep-sheet',
          effectAnchorId: 'listen-sleep-chip',
          act: 'tap',
          text: {
            en: 'Choose twenty minutes: the countdown begins now.',
            es: 'Elige veinte minutos: la cuenta regresiva empieza ahora.',
          },
        },
        {
          id: 'ad4-sleep-chip-counts',
          anchorId: 'listen-sleep-chip',
          act: 'say',
          text: {
            en: 'The chip itself counts down: no opening anything.',
            es: 'El propio chip descuenta: sin abrir nada más.',
          },
        },
        {
          id: 'ad4-sleep-fade',
          anchorId: 'listen-sleep-sheet',
          act: 'say',
          text: {
            en: 'The last ten seconds fade gently, then it pauses.',
            es: 'Los últimos diez segundos bajan suave, y luego pausa.',
          },
        },
        {
          id: 'ad4-sleep-place',
          anchorId: 'listen-sleep-sheet',
          act: 'say',
          text: {
            en: 'Paused, never ended: your place stays exactly here.',
            es: 'En pausa, nunca terminado: tu lugar queda justo aquí.',
          },
        },
        {
          id: 'ad4-sleep-fresh',
          anchorId: 'listen-sleep-sheet',
          act: 'say',
          optional: true,
          text: {
            en: 'A new text clears the timer; nothing lingers.',
            es: 'Un texto nuevo borra el temporizador; nada queda colgando.',
          },
        },
      ],
    },
  ],
}

export default AD4
