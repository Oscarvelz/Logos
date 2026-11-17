/**
 * AD10 · Pronunciación / Pronunciation — «Say it your way», the personal
 * dictionary, taught whole in three short scenes.
 *
 * Coverage (PLAN §2.5 — AD10 owns 6 census items, all from census E):
 * the card and its promise, «Words said your way — names, places, terms
 * of art» (E-26) · the scope line and its two halves (E-27) · adding an
 * entry — two fields, Add dark until both are filled, the confirming
 * toast in the entry's own words, Enter in the second field (E-28) ·
 * adding the same word again REPLACES it, silently, no duplicate row
 * (E-29) · the entry row and its ✕ — removal is instant, no confirmation,
 * no Undo, and there is no edit: change means remove and re-add (E-30) ·
 * the mechanics with no surface, taught as context beats over the entry
 * row (E-31): whole words only, any case, the longest entry wins, and
 * only the SPOKEN words ever change — the screen never does.
 *
 * The scope is taught in full, as the card's own line states it and as
 * pronounce.ts proves it: the dictionary is applied at the single
 * speakable point, so LISTENING, BOOKS and EXPORTED audio all inherit
 * it. The second half of the scope line is a different animal and the
 * script says so: codes and links are already named, never spelled —
 * that is the automatic layer (text.ts), it needs no entry, and it
 * cannot be switched off. No caption lets a learner hunt the dictionary
 * for a codes row that does not exist.
 *
 * Performed ONLY on the scenario's fictional dictionary
 * (scenario/fiction.ts FICTION_PRONOUNCE: Saoirse → Seer-sha,
 * Yucatán → Yuca-tán). The scene adds one entry of its own — Tomas, the
 * letter-carrier of the fiction mini-book, read «Toh-MAHS» — replaces
 * Yucatán's reading, and removes the entry it added. The learner's real
 * dictionary is never touched.
 *
 * Small module by the length discipline: tight and complete, never
 * padded. Captions: bilingual, each ≤15 words in BOTH languages (the C′
 * caption law), consequences stated, never implied. No duration literal
 * anywhere — the index label is computed from this script by the
 * shared clock. Title and capability are the catalogue's words verbatim
 * (catalogue.ts owns them; registration refuses any disagreement).
 */
import type { PresentationModule } from '../engine/types.ts'

export const AD10: PresentationModule = {
  id: 'AD10',
  floor: 'advanced',
  title: { en: 'Pronunciation', es: 'Pronunciación' },
  capability: {
    en: 'Teach Logos your own pronunciations — names, codes and links said your way — in listening, in books and in every audio file you make.',
    es: 'Enséñale a Logos tus propias pronunciaciones — nombres, códigos y enlaces dichos a tu manera — al escuchar, en los libros y en cada audio que crees.',
  },
  verifiedAgainst: '1.4.156',
  scenes: [
    {
      id: 'say-it-your-way',
      chapter: { en: 'Say it your way', es: 'Dilo a tu manera' },
      steps: [
        {
          id: 'ad10-open-card',
          anchorId: 'set-pron',
          act: 'tap',
          text: {
            en: 'Words said your way: names, places, terms of art.',
            es: 'Palabras dichas a tu manera: nombres, lugares, términos.',
          },
        },
        {
          id: 'ad10-yours-alone',
          anchorId: 'set-pron',
          act: 'say',
          text: {
            en: 'This dictionary is personal, and lives only here.',
            es: 'Este diccionario es personal y vive solo aquí.',
          },
        },
        {
          id: 'ad10-two-waiting',
          anchorId: 'set-pron-entry',
          act: 'say',
          text: {
            en: 'Two entries wait inside: Saoirse, and Yucatán.',
            es: 'Dentro esperan dos entradas: Saoirse y Yucatán.',
          },
        },
        {
          id: 'ad10-ask-add',
          anchorId: 'set-pron-from',
          act: 'ask',
          question: {
            en: 'Shall we teach it one more name?',
            es: '¿Le enseñamos un nombre más?',
          },
        },
        {
          id: 'ad10-type-from',
          anchorId: 'set-pron-from',
          act: 'type',
          payload: { value: 'Tomas' },
          text: {
            en: 'The first field: the word, exactly as written.',
            es: 'El primer campo: la palabra, tal como se escribe.',
          },
        },
        {
          id: 'ad10-type-to',
          anchorId: 'set-pron-to',
          act: 'type',
          payload: { value: 'Toh-MAHS' },
          text: {
            en: 'The second field: how it should sound.',
            es: 'El segundo campo: cómo debe sonar.',
          },
        },
        {
          id: 'ad10-add-waits',
          anchorId: 'set-pron-add',
          act: 'say',
          text: {
            en: 'Add stays dark until both fields are filled.',
            es: 'Añadir permanece apagado hasta llenar ambos campos.',
          },
        },
        {
          id: 'ad10-add-tap',
          anchorId: 'set-pron-add',
          effectAnchorId: 'set-pron-entry',
          act: 'tap',
          text: {
            en: 'Tap Add: the fields clear, the entry stays.',
            es: 'Toca Añadir: los campos se vacían, la entrada queda.',
          },
        },
        {
          id: 'ad10-add-toast',
          anchorId: 'set-pron-entry',
          act: 'say',
          text: {
            en: 'Logos confirms: “Tomas” will be read as “Toh-MAHS”.',
            es: 'Logos lo confirma: “Tomas” se leerá “Toh-MAHS”.',
          },
        },
        {
          id: 'ad10-enter-too',
          anchorId: 'set-pron-to',
          act: 'say',
          text: {
            en: 'Enter in the second field adds it too.',
            es: 'Intro en el segundo campo también lo añade.',
          },
        },
      ],
    },
    {
      id: 'everywhere-you-listen',
      chapter: { en: 'It works everywhere you listen', es: 'Vale dondequiera que escuches' },
      steps: [
        {
          id: 'ad10-scope',
          anchorId: 'set-pron-scope',
          act: 'say',
          text: {
            en: 'It applies to listening, to books, to exported audio.',
            es: 'Vale al escuchar, en los libros, en audio exportado.',
          },
        },
        {
          id: 'ad10-one-door',
          anchorId: 'set-pron-scope',
          act: 'say',
          text: {
            en: 'Every reading passes through this one dictionary.',
            es: 'Toda lectura pasa por este único diccionario.',
          },
        },
        {
          id: 'ad10-codes-named',
          anchorId: 'set-pron-scope',
          act: 'say',
          text: {
            en: 'Codes and links are already named, never spelled out.',
            es: 'Los códigos y enlaces ya se nombran, nunca se deletrean.',
          },
        },
        {
          id: 'ad10-codes-layer',
          anchorId: 'set-pron-scope',
          act: 'say',
          text: {
            en: 'That layer is automatic: no entry, no switch.',
            es: 'Esa capa es automática: sin entrada, sin interruptor.',
          },
        },
      ],
    },
    {
      id: 'replace-remove-no-undo',
      chapter: { en: 'Replace, remove, and no Undo', es: 'Reemplazar, quitar, y sin Deshacer' },
      steps: [
        {
          id: 'ad10-ask-replace',
          anchorId: 'set-pron-from',
          act: 'ask',
          question: {
            en: 'What if Yucatán still sounds wrong to you?',
            es: '¿Y si Yucatán aún te suena mal?',
          },
        },
        {
          id: 'ad10-retype-from',
          anchorId: 'set-pron-from',
          act: 'type',
          payload: { value: 'Yucatán' },
          text: {
            en: 'The same word again, in the first field.',
            es: 'La misma palabra otra vez, en el primer campo.',
          },
        },
        {
          id: 'ad10-retype-to',
          anchorId: 'set-pron-to',
          act: 'type',
          payload: { value: 'Yoo-cah-TAHN' },
          text: {
            en: 'And the reading you like better.',
            es: 'Y la lectura que te suena mejor.',
          },
        },
        {
          id: 'ad10-replace-tap',
          anchorId: 'set-pron-add',
          effectAnchorId: 'set-pron-entry',
          act: 'tap',
          text: {
            en: 'No second row appears: the new reading wins.',
            es: 'No aparece una segunda fila: manda la lectura nueva.',
          },
        },
        {
          id: 'ad10-no-edit',
          anchorId: 'set-pron-entry',
          act: 'say',
          text: {
            en: 'There is no edit button: changing means re-adding.',
            es: 'No hay botón de editar: cambiar es volver a añadir.',
          },
        },
        {
          id: 'ad10-remove-tap',
          anchorId: 'set-pron-remove',
          effectAnchorId: 'set-pron-entry',
          act: 'tap',
          text: {
            en: 'The ✕ removes Tomas — instantly, no confirmation asked.',
            es: 'La ✕ quita Tomas al instante, sin pedir confirmación.',
          },
        },
        {
          id: 'ad10-no-undo',
          anchorId: 'set-pron-entry',
          act: 'say',
          text: {
            en: 'And no Undo: bringing it back means re-adding.',
            es: 'Y sin Deshacer: recuperarlo es añadirlo otra vez.',
          },
        },
        {
          id: 'ad10-mechanics-match',
          anchorId: 'set-pron-entry',
          act: 'say',
          text: {
            en: 'It matches whole words only, whatever their case.',
            es: 'Solo coincide con palabras enteras, sin importar mayúsculas.',
          },
        },
        {
          id: 'ad10-mechanics-screen',
          anchorId: 'set-pron-entry',
          act: 'say',
          text: {
            en: 'Longest entry wins; only spoken words ever change.',
            es: 'Gana la entrada más larga; solo cambia lo hablado.',
          },
        },
      ],
    },
  ],
}

export default AD10
