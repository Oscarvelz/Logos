/**
 * catalogue.test.mjs — the Presentation catalogue + duration fence probes
 * (house pattern: plain Node, node:test, type-stripped TS imports — the
 * copy has no node_modules and needs none).
 *
 * Run: node --test scripts/presentation/catalogue.test.mjs
 *
 * Covers: all 20 modules of PLAN §3's ladder exist with the plan's titles
 * (Quick Q0–Q5, Advanced AD1–AD14); every title, capability promise and
 * scene title is a bilingual, non-empty pair (the bilingual fence's
 * catalogue half, FENCE-DESIGN §4); the duration fence D-1 (no duration
 * literal anywhere in catalogue.ts — no «N min» figure, no duration field
 * carrying a number) and D-2's null half (a script-less module exposes
 * duration null, so the index renders no label rather than a handwritten
 * one — as shipped, every module of both floors carries its registered
 * script and exposes the clock's computed label; the null half stands as
 * the contract for any future entry whose script has not landed); card states derived from a fixture state file (unseen /
 * in-progress with its exact resume point / seen / needs-refresh); the
 * resume head (the FIRST-CARD law: the last-used module heads the list
 * while in-progress — one head only, the latest-used wins, completing it
 * clears the head); the general progress line (the OVERALL-PROGRESS
 * law: a finished module counts whole, a part-way one counts its walked
 * fraction — recorded step over total steps — the headline percent is
 * the equal-weight mean over all twenty, needs-refresh counting by its
 * fraction); and
 * script registration — a valid script attaches, computes its label
 * through the one shared clock, and an invalid or off-catalogue script is
 * refused.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'

import {
  MODULE_CATALOGUE,
  catalogueModule,
  entryDuration,
  modulesOnFloor,
  overallProgress,
  registerPresentationScript,
  resumeHead,
  stateFor,
} from '../../src/lib/presentation/catalogue.ts'
import { durationLabel } from '../../src/lib/presentation/engine/clock.ts'
import { flattenSteps } from '../../src/lib/presentation/engine/types.ts'
import { normalizePresentationState } from '../../src/lib/presentation/presentation-state.ts'
// The shipped truth: importing the scripts index registers all twenty
// scripts (both floors) into the catalogue. Registration itself is
// asserted below.
import '../../src/lib/presentation/scripts/index.ts'

const EXPECTED = [
  ['Q0', 'quick', 'The Whole Lap', 'La vuelta completa'],
  ['Q1', 'quick', 'Listen in a Minute', 'Escuchar en un minuto'],
  ['Q2', 'quick', 'The Bubble', 'La burbuja'],
  ['Q3', 'quick', 'Voices', 'Voces'],
  ['Q4', 'quick', 'Save and Come Back', 'Guardar y volver'],
  ['Q5', 'quick', 'Books', 'Libros'],
  ['AD1', 'advanced', 'The Panel, Whole', 'El panel, entero'],
  ['AD2', 'advanced', 'Bringing Everything In', 'Traerlo todo'],
  ['AD3', 'advanced', 'The Reader in Depth', 'El lector a fondo'],
  ['AD4', 'advanced', 'Rhythm and Sleep', 'Ritmo y sueño'],
  ['AD5', 'advanced', 'Two Languages, One Listening', 'Dos idiomas, una escucha'],
  ['AD6', 'advanced', 'The Library in Depth', 'La Biblioteca a fondo'],
  ['AD7', 'advanced', 'The Book in Depth', 'El libro a fondo'],
  ['AD8', 'advanced', 'Create Audio Files', 'Crear archivos de audio'],
  ['AD9', 'advanced', 'You Never Lose the Thread', 'Nunca pierdes el hilo'],
  ['AD10', 'advanced', 'Pronunciation', 'Pronunciación'],
  ['AD11', 'advanced', 'The Floating Player in Settings', 'El reproductor flotante en Ajustes'],
  ['AD12', 'advanced', 'Outside the App', 'Fuera de la app'],
  ['AD13', 'advanced', 'Large Screens', 'Pantallas grandes'],
  ['AD14', 'advanced', 'The House Inside', 'La casa por dentro'],
]

const nonEmptyPair = (pair, at) => {
  assert.ok(pair && typeof pair === 'object', `${at}: a bilingual pair is required`)
  for (const lang of ['en', 'es']) {
    assert.equal(typeof pair[lang], 'string', `${at}: the ${lang} half must be a string`)
    assert.ok(pair[lang].trim().length > 0, `${at}: the ${lang} half must be non-empty`)
  }
}

describe('the catalogue — PLAN §3 transcribed', () => {
  test('all 20 modules exist, in ladder order, on their floors, with the plan’s titles', () => {
    assert.equal(MODULE_CATALOGUE.length, 20)
    assert.deepEqual(
      MODULE_CATALOGUE.map((m) => m.id),
      EXPECTED.map((e) => e[0]),
    )
    for (const [id, floor, en, es] of EXPECTED) {
      const entry = catalogueModule(id)
      assert.ok(entry, `${id}: missing from the catalogue`)
      assert.equal(entry.floor, floor, `${id}: wrong floor`)
      assert.equal(entry.title.en, en, `${id}: EN title is not the plan's`)
      assert.equal(entry.title.es, es, `${id}: ES title is not the plan's`)
    }
    assert.equal(modulesOnFloor('quick').length, 6)
    assert.equal(modulesOnFloor('advanced').length, 14)
    assert.equal(catalogueModule('Q9'), null)
  })

  test('every promise and scene title is bilingual and non-empty', () => {
    for (const entry of MODULE_CATALOGUE) {
      nonEmptyPair(entry.title, `${entry.id} title`)
      nonEmptyPair(entry.capability, `${entry.id} capability`)
      assert.ok(entry.capability.en !== entry.title.en, `${entry.id}: the promise must say more than the name`)
      assert.ok(Array.isArray(entry.scenes) && entry.scenes.length >= 3, `${entry.id}: the plan's scene list has at least three scenes`)
      entry.scenes.forEach((scene, i) => nonEmptyPair(scene, `${entry.id} scene ${i + 1}`))
    }
  })

  test('as shipped: all twenty scripts are registered, Quick and Advanced alike', () => {
    for (const entry of MODULE_CATALOGUE) {
      assert.ok(entry.script, `${entry.id}: both floors ship registered — its script must be attached`)
      assert.equal(entry.script.id, entry.id, `${entry.id}: the attached script must be this module's own`)
    }
  })
})

describe('the duration fence (FENCE-DESIGN §5)', () => {
  const source = readFileSync(new URL('../../src/lib/presentation/catalogue.ts', import.meta.url), 'utf8')

  test('D-1: no duration literal exists in catalogue.ts', () => {
    assert.ok(!/\d+\s*(min|minute|minuto)/.test(source), 'a handwritten «N min» figure is a fence defect')
    assert.ok(!/duration\s*:\s*\d/.test(source), 'a duration field carrying a number is a fence defect')
    assert.ok(!/minutesAt1x/.test(source), 'no hand-carried minutes field may exist')
    assert.ok(!/about\s+\d+\s*(min|minute)/.test(source), 'no "about N min" label form may exist')
    assert.ok(!/unos\s+\d+\s*min/.test(source), 'no «unos N min» label form may exist')
  })

  test('D-2 (null half): a script-less module exposes duration null in both languages', () => {
    // Every shipped entry now carries a script; the null half is the
    // function's contract for any entry whose script has not landed.
    const bare = { id: 'AD99', floor: 'advanced', script: null }
    assert.equal(entryDuration(bare, 'en'), null, 'EN duration must be null without a script')
    assert.equal(entryDuration(bare, 'es'), null, 'ES duration must be null without a script')
  })

  test('D-2 (computed half): every registered module exposes the clock’s label, never a handwritten one', () => {
    for (const entry of MODULE_CATALOGUE) {
      const en = entryDuration(entry, 'en')
      const es = entryDuration(entry, 'es')
      assert.ok(en && es, `${entry.id}: a registered script must expose a duration in both languages`)
      assert.equal(en.label, durationLabel(entry.script, 'en'), `${entry.id}: the EN label must be the shared clock's computation`)
      assert.equal(es.label, durationLabel(entry.script, 'es'), `${entry.id}: the ES label must be the shared clock's computation`)
      assert.match(en.label, /^Approx\. \d+ min$/)
      assert.match(es.label, /^Aprox\. \d+ min$/)
      assert.ok(en.ms > 0 && es.ms > 0)
    }
  })
})

describe('card states from a fixture state file', () => {
  const fixture = normalizePresentationState({
    speed: 1,
    myScenes: [{ module: 'Q2', scene: 'copy-plays', step: 9, stepId: 'q2-copy-1', savedAt: '2026-11-14T09:00:00Z' }],
    modules: {
      Q1: { state: 'in-progress', step: 5, scene: 'reader', stepId: 'q1-reader-2', verifiedAgainst: '1.4.156', skips: [] },
      Q3: { state: 'seen', verifiedAgainst: '1.4.156', skips: [] },
      AD2: { state: 'needs-refresh', step: 3, scene: 'doors', stepId: 'ad2-doors-1', verifiedAgainst: '1.4.150', skips: [] },
    },
  })

  test('unseen / in-progress with its exact resume point / seen / needs-refresh', () => {
    assert.deepEqual(stateFor(catalogueModule('Q0'), fixture), { state: 'unseen' })
    assert.deepEqual(stateFor(catalogueModule('Q1'), fixture), {
      state: 'in-progress',
      resume: { step: 5, scene: 'reader', stepId: 'q1-reader-2' },
    })
    assert.deepEqual(stateFor(catalogueModule('Q3'), fixture), { state: 'seen' })
    assert.deepEqual(stateFor(catalogueModule('AD2'), fixture), {
      state: 'needs-refresh',
      resume: { step: 3, scene: 'doors', stepId: 'ad2-doors-1' },
    })
  })

  test('an untouched module in an empty state file is unseen, with no resume point', () => {
    const empty = normalizePresentationState(null)
    for (const entry of MODULE_CATALOGUE) assert.deepEqual(stateFor(entry, empty), { state: 'unseen' })
  })
})

describe('the resume head (the FIRST-CARD law)', () => {
  const partway = (step) => ({ state: 'in-progress', step, scene: 's', stepId: `s-${step}`, verifiedAgainst: '1.4.156', skips: [] })

  test('(i) the last-used module, left incomplete, is derived as the resume head', () => {
    const state = normalizePresentationState({
      speed: 1,
      myScenes: [],
      lastUsed: 'Q2',
      modules: { Q2: partway(9) },
    })
    assert.equal(resumeHead(state)?.id, 'Q2')
    // The head is the same card: its announced state still carries the
    // exact resume point the card's Resume control launches from.
    assert.deepEqual(stateFor(catalogueModule('Q2'), state), {
      state: 'in-progress',
      resume: { step: 9, scene: 's', stepId: 's-9' },
    })
  })

  test('(ii) completing the marked module clears the head', () => {
    // The runner clears the mark itself on completion (no lastUsed key).
    const cleared = normalizePresentationState({
      speed: 1,
      myScenes: [],
      modules: { Q2: { state: 'seen', verifiedAgainst: '1.4.156', skips: [] } },
    })
    assert.equal(resumeHead(cleared), null)
    // And even a stale mark that outlived its module cannot head the
    // list once the module reads seen — the derivation checks the state.
    const staleMark = normalizePresentationState({
      speed: 1,
      myScenes: [],
      lastUsed: 'Q2',
      modules: { Q2: { state: 'seen', verifiedAgainst: '1.4.156', skips: [] } },
    })
    assert.equal(resumeHead(staleMark), null)
  })

  test('(iii) only ONE head: with several modules part-way, the latest-used wins', () => {
    const state = normalizePresentationState({
      speed: 1,
      myScenes: [],
      lastUsed: 'Q2',
      modules: { Q1: partway(5), Q2: partway(9), AD4: partway(2) },
    })
    assert.equal(resumeHead(state)?.id, 'Q2', 'the marked module heads — not Q1, not AD4')
    // The others are untouched by the derivation: still in-progress in
    // their floors (the index renders them there, once each).
    assert.equal(stateFor(catalogueModule('Q1'), state).state, 'in-progress')
    assert.equal(stateFor(catalogueModule('AD4'), state).state, 'in-progress')
    // Move the mark and the head follows it — the mark is the whole rule.
    const remark = normalizePresentationState({
      speed: 1,
      myScenes: [],
      lastUsed: 'AD4',
      modules: { Q1: partway(5), Q2: partway(9), AD4: partway(2) },
    })
    assert.equal(resumeHead(remark)?.id, 'AD4')
  })

  test('no head without a live mark: absent, unknown, unseen or needs-refresh', () => {
    const base = { speed: 1, myScenes: [], modules: { Q2: partway(9) } }
    assert.equal(resumeHead(normalizePresentationState(base)), null, 'no mark, no head — even with a module part-way')
    assert.equal(resumeHead(normalizePresentationState({ ...base, lastUsed: 'ZZ' })), null, 'an unknown id heads nothing')
    assert.equal(
      resumeHead(normalizePresentationState({ speed: 1, myScenes: [], lastUsed: 'Q2', modules: {} })),
      null,
      'a marked but untouched module is unseen, not a head',
    )
    assert.equal(
      resumeHead(
        normalizePresentationState({
          speed: 1,
          myScenes: [],
          lastUsed: 'AD2',
          modules: { AD2: { state: 'needs-refresh', step: 3, scene: 'doors', stepId: 'x', verifiedAgainst: '1.4.150', skips: [] } },
        }),
      ),
      null,
      'needs-refresh is not in-progress: the law’s head is the module left incomplete, not the one that broke',
    )
    assert.equal(resumeHead(normalizePresentationState(null)), null)
  })
})

describe('the general progress line (the OVERALL-PROGRESS law)', () => {
  const seenRec = { state: 'seen', verifiedAgainst: '1.4.156', skips: [] }
  const stateWith = (modules) => normalizePresentationState({ speed: 1, myScenes: [], modules })

  test('0%: an untouched state file has studied nothing', () => {
    assert.deepEqual(overallProgress(normalizePresentationState(null)), {
      percent: 0,
      finished: 0,
      inProgress: 0,
      total: 20,
      remainingPercent: 100,
    })
  })

  test('an exact 50%: ten modules whole, ten untouched', () => {
    const modules = {}
    for (const id of ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'AD1', 'AD2', 'AD3', 'AD4']) modules[id] = seenRec
    assert.deepEqual(overallProgress(stateWith(modules)), {
      percent: 50,
      finished: 10,
      inProgress: 0,
      total: 20,
      remainingPercent: 50,
    })
  })

  test('a part-way module counts the fraction of itself already walked', () => {
    // By hand: Q2's script has 37 steps, so standing at its recorded
    // step 17 is 17/37 of Q2 walked. With Q0 whole beside it:
    // (1 + 17/37) / 20 = 7.2972…% → 7%, and 93% left.
    assert.equal(flattenSteps(catalogueModule('Q2').script).length, 37, 'the hand count stands on Q2 having 37 steps')
    const state = stateWith({
      Q0: seenRec,
      Q2: { state: 'in-progress', step: 17, scene: 'copy-tap-listen', stepId: 's3-replaces', verifiedAgainst: '1.4.156', skips: [] },
    })
    assert.deepEqual(overallProgress(state), {
      percent: 7,
      finished: 1,
      inProgress: 1,
      total: 20,
      remainingPercent: 93,
    })
  })

  test('a needs-refresh module counts by its walked fraction, like one under way', () => {
    // By hand: AD2's script has 75 steps; a recorded step of 15 is
    // 15/75 = one fifth of one module → 0.2 / 20 = exactly 1%.
    assert.equal(flattenSteps(catalogueModule('AD2').script).length, 75, 'the hand count stands on AD2 having 75 steps')
    const state = stateWith({
      AD2: { state: 'needs-refresh', step: 15, scene: 'doors', stepId: 'ad2-doors-x', verifiedAgainst: '1.4.150', skips: [] },
    })
    assert.deepEqual(overallProgress(state), {
      percent: 1,
      finished: 0,
      inProgress: 1,
      total: 20,
      remainingPercent: 99,
    })
  })

  test('100%: every module seen studies the whole app', () => {
    const modules = {}
    for (const entry of MODULE_CATALOGUE) modules[entry.id] = seenRec
    assert.deepEqual(overallProgress(stateWith(modules)), {
      percent: 100,
      finished: 20,
      inProgress: 0,
      total: 20,
      remainingPercent: 0,
    })
  })
})

describe('script registration', () => {
  const q0 = catalogueModule('Q0')
  const script = {
    id: 'Q0',
    floor: 'quick',
    title: { ...q0.title },
    capability: { ...q0.capability },
    verifiedAgainst: '1.4.156',
    scenes: [
      {
        id: 'lap-start',
        chapter: { ...q0.scenes[0] },
        steps: [
          {
            id: 'q0-lap-1',
            anchorId: 'set-presentations',
            act: 'say',
            text: { en: 'One quick lap shows the whole app.', es: 'Una vuelta rápida muestra la app entera.' },
          },
        ],
      },
    ],
  }

  test('a valid script attaches and its label is the clock’s computation, in both languages', () => {
    const entry = registerPresentationScript(script)
    assert.equal(entry.script, script)
    for (const lang of ['en', 'es']) {
      const duration = entryDuration(entry, lang)
      assert.ok(duration, `${lang}: a registered script must expose a duration`)
      assert.equal(duration.label, durationLabel(script, lang))
      assert.ok(duration.ms > 0)
    }
    assert.match(entryDuration(entry, 'en').label, /^Approx\. \d+ min$/)
    assert.match(entryDuration(entry, 'es').label, /^Aprox\. \d+ min$/)
  })

  test('an invalid script, and one that disagrees with the catalogue, are refused', () => {
    assert.throws(
      () => registerPresentationScript({ ...script, id: 'Q1', scenes: [{ id: 'x', chapter: { en: 'X', es: 'X' }, steps: [{ id: 'x-1', anchorId: 'no-such-anchor', act: 'say', text: { en: 'Hi.', es: 'Hola.' } }] }] }),
      /not in ANCHORS/,
    )
    assert.throws(() => registerPresentationScript({ ...script, title: { en: 'Wrong', es: 'Mal' } }), /title disagrees/)
    assert.throws(() => registerPresentationScript({ ...script, id: 'ZZ' }), /no module "ZZ"/)
  })
})
