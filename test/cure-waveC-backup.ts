// Cure probes for the R2-T5 lows, run against the real importBackup
// on the Wave B fake-IDB setup:
//   T5-3 the report counts every stage (deletion-record skips counted;
//        marks counted as landed, not as filed; clips counted)
//   T5-4 a backup whose favorites filter to empty never starves the phone
//   T5-5 unknown settings fields survive export→import, defaultVoice
//        extra keys included
//   T5-6 both sanitisers clamp numbers to the UI's own envelope
//        (patch half here; load half in WAVEC_T5=load mode)
//   T5-7 inert damage (non-object settings/drafts, mixed-type
//        deletion list) no longer vetoes a whole restore
// Run: node ~/workspace/vela-work/run-ts-test.mjs test/cure-waveC-backup.ts
//      WAVEC_T5=load node ~/workspace/vela-work/run-ts-test.mjs test/cure-waveC-backup.ts
import './waveB-lib-setup.ts'

const ls = (globalThis as any).localStorage as Storage
let pass = 0, fail = 0
const check = (name: string, ok: boolean, extra = '') => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) } }
const MODE = process.env.WAVEC_T5 ?? 'import'

if (MODE === 'load') {
  ls.setItem('logos.settings.v1', JSON.stringify({
    listenSpeed: 40, readerScale: 47, bubbleAlpha: -20, jumpFwdSec: 5000,
    favorites: ['pk_alba'], defaultVoice: { en: 'pk_alba', es: 'pk_lola' }, voiceOverride: null,
  }))
  const { settings } = await import('../src/lib/settings.ts')
  const s = settings.get()
  check('T5-6 load(): listenSpeed 40 clamps to the Range ceiling 2.5', s.listenSpeed === 2.5, `got ${s.listenSpeed}`)
  check('T5-6 load(): readerScale 47 snaps to the ladder top 2', s.readerScale === 2, `got ${s.readerScale}`)
  check('T5-6 load(): bubbleAlpha -20 clamps to 0', s.bubbleAlpha === 0, `got ${s.bubbleAlpha}`)
  check('T5-6 load(): jumpFwdSec 5000 clamps to 600', s.jumpFwdSec === 600, `got ${s.jumpFwdSec}`)
  console.log(`CURE R2-T5 (load half): ${pass}/${pass + fail} PASS`)
  process.exitCode = fail ? 1 : 0
} else {
  const { importBackup } = await import('../src/lib/backup.ts')
  const { settings } = await import('../src/lib/settings.ts')
  const { loadMarks } = await import('../src/lib/marks.ts')

  const book = (id: string) => ({
    meta: { id, title: `Book ${id}`, format: 'text', lang: 'en', addedAt: 1000, progress: 0, words: 4, links: 0, size: 20, pos: { ch: 0, b: 0 }, chWords: [4], toc: [] },
    content: { id, chapters: [{ title: 'One', blocks: [{ k: 'p', t: 'Four small words here.' }] }] },
  })
  const fileOf = (obj: unknown) => new File([JSON.stringify(obj)], 'backup.json', { type: 'application/json' })
  const base = { app: 'logos', version: 1, at: 1, pronounce: [], marks: [], clips: [], books: [] as unknown[] }

  // ── T5-7: inert damage restores normally ──
  const r7 = await importBackup(fileOf({ ...base, books: [book('bk-t57')], settings: 'a string, not a block', drafts: 42, deletedBooks: ['gone-1', 42, null] }))
  check('T5-7: a file with inert damage restores its book', r7.books === 1, JSON.stringify(r7))
  check('T5-7: the junk settings block changed nothing', settings.get().listenSpeed === 1, `got ${settings.get().listenSpeed}`)

  // ── T5-3: every stage counted ──
  const seeded = Array.from({ length: 119 }, (_, i) => ({ id: `seed-${i}`, at: 1_000_000 + i, idx: 0, title: 'Seed', sentence: 'Seed sentence.', key: 'k' }))
  ls.setItem('logos.marks.v1', JSON.stringify(seeded))
  const fileMarks = [5, 6, 7].map((at, i) => ({ id: `file-${i}`, at, idx: 0, title: 'File', sentence: 'File sentence.', key: 'k' }))
  const clip = { id: 'clip-1', title: 'A clip', text: 'Clip words here.', voice: 'pk_alba', lang: 'en', format: 'mp3', createdAt: 5, duration: 3, size: 10, kind: 'text', source: 'create' }
  const r3 = await importBackup(fileOf({ ...base, books: [book('bk-a'), book('bk-b')], deletedBooks: ['bk-b'], marks: fileMarks, clips: [clip] }))
  check('T5-3: the live book restored', r3.books === 1, JSON.stringify(r3))
  check('T5-3: the deletion-record skip is counted', r3.skippedDeleted === 1, `got ${r3.skippedDeleted}`)
  check('T5-3: clips counted', r3.clips === 1, `got ${r3.clips}`)
  check('T5-3: marks counted as LANDED (cap let 1 of 3 in), not as filed', r3.marks === 1 && loadMarks().length === 120, `report=${r3.marks} stored=${loadMarks().length}`)

  // ── T5-4: favorites can never land empty ──
  const starsBefore = settings.get().favorites
  const r4a = await importBackup(fileOf({ ...base, settings: { favorites: ['kk_ghost', 'ds_gone'] } }))
  check('T5-4: all-ghost favorites are withheld and reported', r4a.favoritesKept === true)
  check('T5-4: the phone keeps its stars', JSON.stringify(settings.get().favorites) === JSON.stringify(starsBefore))
  const r4b = await importBackup(fileOf({ ...base, settings: { favorites: [] } }))
  check('T5-4: an explicitly empty list is withheld too', r4b.favoritesKept === true && settings.get().favorites.length > 0)
  const r4c = await importBackup(fileOf({ ...base, settings: { favorites: ['pk_lola'] } }))
  check('T5-4: a living list lands normally', r4c.favoritesKept === false && JSON.stringify(settings.get().favorites) === JSON.stringify(['pk_lola']))

  // ── T5-5: forward-version fields survive the trip ──
  await importBackup(fileOf({ ...base, settings: { futureFieldX: { nested: [1, 2] }, defaultVoice: { en: 'pk_alba', thirdSlot: 'pk_lola' } } }))
  const s5 = settings.get() as unknown as Record<string, unknown>
  check('T5-5: an unknown top-level field lands verbatim', JSON.stringify(s5.futureFieldX) === JSON.stringify({ nested: [1, 2] }), JSON.stringify(s5.futureFieldX))
  const dv5 = s5.defaultVoice as Record<string, unknown>
  check('T5-5: an extra defaultVoice key lands; the known keys still sanitise', dv5.thirdSlot === 'pk_lola' && dv5.en === 'pk_alba', JSON.stringify(dv5))

  // ── T5-6: the patch clamps to the envelope ──
  await importBackup(fileOf({ ...base, settings: { listenSpeed: 40, exportSpeed: 9, sentencePauseMs: 5000, bubbleAlpha: 250, panelAlpha: -3, wordLeadMs: 9999, readerScale: 0, jumpBackSec: -5, jumpFwdSec: 700 } }))
  const s6 = settings.get()
  check('T5-6 patch: listenSpeed 40 → 2.5', s6.listenSpeed === 2.5, `got ${s6.listenSpeed}`)
  check('T5-6 patch: exportSpeed 9 → 1.6', s6.exportSpeed === 1.6, `got ${s6.exportSpeed}`)
  check('T5-6 patch: sentencePauseMs 5000 → 800', s6.sentencePauseMs === 800, `got ${s6.sentencePauseMs}`)
  check('T5-6 patch: alphas land inside 0–100', s6.bubbleAlpha === 100 && s6.panelAlpha === 0, `got ${s6.bubbleAlpha}/${s6.panelAlpha}`)
  check('T5-6 patch: wordLeadMs 9999 → 450', s6.wordLeadMs === 450, `got ${s6.wordLeadMs}`)
  check('T5-6 patch: readerScale 0 snaps to the ladder floor 0.8 (the reader cannot vanish)', s6.readerScale === 0.8, `got ${s6.readerScale}`)
  check('T5-6 patch: jumps land inside 0–600', s6.jumpBackSec === 0 && s6.jumpFwdSec === 600, `got ${s6.jumpBackSec}/${s6.jumpFwdSec}`)

  console.log(`CURE R2-T5 probe: ${pass}/${pass + fail} PASS`)
  process.exitCode = fail ? 1 : 0
}
