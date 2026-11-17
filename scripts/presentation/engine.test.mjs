/**
 * engine.test.mjs — the Logos Presentation engine probes (house pattern:
 * plain Node, node:test, type-stripped TS imports — the copy has no
 * node_modules and needs none).
 *
 * Run: node --test scripts/presentation/engine.test.mjs
 *
 * Covers: the shared clock calibration + duration computation (the index
 * label and playback can never disagree), caption word warnings in EN and
 * ES, the banned-key scan + anchor registration gate, mode switch keeping
 * place, Back place-memory + resume, the nav-pair law (Oscar, Brizna lane
 * 2026-11-14: the return stack of LIVED positions — never a skipped
 * machinery step, a chapter jump returns to the pre-jump place, a resumed
 * run starts empty; › refuses gesture beats), the stay-here window law
 * (same sitting: the window opens mid-module, THE CLOCK STOPS behind it,
 * Keep watching resumes untouched, confirm dissolves onto the recorded
 * place — and a finished module grows no window), the ✕-asks-first law
 * (same sitting: mid-module the ✕ opens its own confirmation window —
 * clock held, verbs down, the two windows never stack — confirm leaves
 * onto the recorded place, and a finished module grows no window), the
 * card-seat law (same sitting: geometry.cardSeat returns NO seat while
 * the focus or the viewport is unmeasured, so the card is born where it
 * will live and never travels from a provisional seat), the last-used mark
 * (recorded from module start and on every advance, cleared on
 * completion), the §7 fail-safe (optional
 * skip + log; required miss ends the scene, needs-refresh), entry
 * seeding (Oscar's invariant, Brizna lane 2026-11-14: a resume or a
 * forward chapters jump replays the earlier scenes' scenario acts
 * silently, in order, before the target beat is presented — Q2's Undo
 * has its replace, AD1's save has its playing text — and never
 * re-performs a lived toggle), the dead-anchor guarantee (three
 * consecutive optional misses cost 0 ms and emit no snapshot: the
 * card never shows an invisible beat), the
 * speed-choice hold, the screen-edge hole containment (geometry.ts:
 * the breathing hole wholly inside the viewport on all four sides — the
 * air compresses at the edges, the ring is never cut), state round-trip under
 * logos.presentation.state.v1, and the payload-isolation duty: no
 * scenario data reaches the state payload (or any backup/share-shaped
 * payload built from engine output), proven with the sandbox's own
 * leak scan + a positive control.
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { anchorById } from '../../src/lib/presentation/anchors.ts'
import {
  PRESENTATION_STATE_KEY,
  loadPresentationState,
  normalizePresentationState,
  savePresentationState,
} from '../../src/lib/presentation/presentation-state.ts'
import { CLIP_TEXT, TEXT_EN, containsScenarioData, createScenario } from '../../src/lib/presentation/scenario/index.ts'
import {
  CAPTION_MAX_MS,
  CAPTION_MIN_MS,
  HOVER_REST_MS,
  ACTION_BEAT_MS,
  RESULT_DWELL_MS,
  captionDurationMs,
  createPresentationClock,
  durationLabel,
  durationLabelForMs,
  moduleDurationMs,
  performDelayMs,
  physicalSpeed,
  stepDurationMs,
} from '../../src/lib/presentation/engine/clock.ts'
import { cardSeat, containedHole, unionRect } from '../../src/lib/presentation/engine/geometry.ts'
import { REFRESH_LINE, createPresentationRunner } from '../../src/lib/presentation/engine/runner.ts'
import { createScenarioPort } from '../../src/lib/presentation/engine/scenario-port.ts'
import {
  findForbiddenScriptKeys,
  flattenSteps,
  isRegisteredAnchorId,
  presentationScriptWarnings,
  validatePresentationModule,
} from '../../src/lib/presentation/engine/types.ts'
import { Q2 } from '../../src/lib/presentation/scripts/q2.ts'
import { AD1 } from '../../src/lib/presentation/scripts/ad1.ts'

/* ── Fakes ──────────────────────────────────────────────────────────── */

class FakeTimer {
  constructor() {
    this.nowMs = 0
    this.nextId = 1
    this.timers = new Map()
  }
  now = () => this.nowMs
  setTimeout = (cb, ms) => {
    const id = this.nextId++
    this.timers.set(id, { at: this.nowMs + ms, cb })
    return id
  }
  clearTimeout = (id) => {
    this.timers.delete(id)
  }
  advance(ms) {
    const end = this.nowMs + ms
    for (;;) {
      let next = null
      for (const [id, t] of this.timers) {
        if (t.at <= end && (!next || t.at < next.t.at)) next = { id, t }
      }
      if (!next) break
      this.nowMs = next.t.at
      this.timers.delete(next.id)
      next.t.cb()
    }
    this.nowMs = end
  }
}

class FakeStorage {
  constructor() {
    this.bytes = new Map()
  }
  getItem = (k) => this.bytes.get(k) ?? null
  setItem = (k, v) => {
    this.bytes.set(k, String(v))
  }
}

const bi = (en, es) => ({ en, es })

/** Wall ms a presentation-time wait takes at a speed LABEL (P2: physical = label / 2). */
const wallMs = (presMs, label = 1) => presMs / physicalSpeed(label)

function sampleModule() {
  return {
    id: 'engine-probe',
    floor: 'quick',
    title: bi('Engine probe', 'Sonda del motor'),
    capability: bi('You can work the engine probe.', 'Puedes usar la sonda del motor.'),
    verifiedAgainst: '1.4.156',
    scenes: [
      {
        id: 'opening',
        chapter: bi('Opening', 'Apertura'),
        steps: [
          { id: 's1', anchorId: 'listen-paste', act: 'tap', text: bi('Tap Paste and your text appears here.', 'Toca Pegar y tu texto aparece aquí.') },
          { id: 's2', anchorId: 'listen-play', act: 'tap', text: bi('Tap Play and Logos reads it aloud.', 'Toca Reproducir y Logos lo lee en voz alta.') },
          { id: 's3', anchorId: 'listen-editor', act: 'say', text: bi('That is the whole probe.', 'Eso es toda la sonda.') },
        ],
      },
    ],
  }
}

function fakeResolver(missing = new Set()) {
  return (step) => {
    const record = anchorById(step.anchorId)
    if (missing.has(step.anchorId)) return { status: 'miss', record, anchorId: step.anchorId, reason: 'fake-miss' }
    return { status: 'resolved', record, target: {} }
  }
}

function makeRunner(overrides = {}, script = sampleModule()) {
  const timer = new FakeTimer()
  const storage = new FakeStorage()
  const runner = createPresentationRunner(script, {
    clock: createPresentationClock(timer),
    resolver: fakeResolver(),
    storage,
    now: () => 1_762_902_000_000,
    appVersion: '1.4.156',
    ...overrides,
  })
  return { runner, timer, storage }
}

/* ── Clock calibration + duration (FENCE-DESIGN §5) ─────────────────── */

describe('clock', () => {
  test('caption life is proportional to word count, floored and capped', () => {
    assert.equal(captionDurationMs('One.'), CAPTION_MIN_MS) // 900 + 340 < floor
    assert.equal(captionDurationMs('one two three four five six seven eight nine ten'), 900 + 10 * 340)
    const long = Array.from({ length: 40 }, () => 'word').join(' ')
    assert.equal(captionDurationMs(long), CAPTION_MAX_MS)
  })

  test('caption life is computed in the language being heard', () => {
    const pair = bi('one two three', 'uno dos tres cuatro cinco seis siete ocho nueve diez')
    assert.equal(captionDurationMs(pair, 'en'), 900 + 3 * 340)
    assert.equal(captionDurationMs(pair, 'es'), 900 + 10 * 340)
  })

  test('step durations: ask adds the result dwell, hover rests, bare acts dwell on the result', () => {
    const ask = { id: 'a', anchorId: 'listen-paste', act: 'ask', question: bi('Where does it go?', '¿Adónde va?') }
    assert.equal(stepDurationMs(ask, 'en'), captionDurationMs(ask.question, 'en') + RESULT_DWELL_MS)
    const hover = { id: 'h', anchorId: 'listen-play', act: 'hover' }
    assert.equal(stepDurationMs(hover), HOVER_REST_MS)
    const tap = { id: 't', anchorId: 'listen-play', act: 'tap' }
    // Uncaptioned performed act: max(ACTION_BEAT_MS, 0 + RESULT_DWELL_MS).
    assert.equal(stepDurationMs(tap), Math.max(ACTION_BEAT_MS, RESULT_DWELL_MS))
    assert.equal(stepDurationMs(tap), 1000)
  })

  test('two-phase beats (P9+P16): read first, then perform, then rest on the result', () => {
    // Captioned tap: caption (the perform delay) + RESULT_DWELL_MS.
    const tap = { id: 't', anchorId: 'listen-play', act: 'tap', text: bi('Tap Play and Logos reads it aloud.', 'Toca Reproducir y Logos lo lee.') }
    assert.equal(performDelayMs(tap, 'en'), captionDurationMs(tap.text, 'en'))
    assert.equal(stepDurationMs(tap, 'en'), captionDurationMs(tap.text, 'en') + RESULT_DWELL_MS)
    // ask: the question is the read phase; the total rests RESULT_DWELL_MS on the answer.
    const ask = { id: 'a', anchorId: 'listen-paste', act: 'ask', question: bi('Where does it go?', '¿Adónde va?') }
    assert.equal(performDelayMs(ask, 'en'), captionDurationMs(ask.question, 'en'))
    assert.equal(stepDurationMs(ask, 'en'), captionDurationMs(ask.question, 'en') + RESULT_DWELL_MS)
    // Captioned hover with holdMs: caption + its announced hold (no shadowing).
    const hover = { id: 'h', anchorId: 'listen-play', act: 'hover', text: bi('Rest on the Play key.', 'Descansa en Reproducir.'), payload: { holdMs: 2000 } }
    assert.equal(performDelayMs(hover, 'en'), captionDurationMs(hover.text, 'en'))
    assert.equal(stepDurationMs(hover, 'en'), captionDurationMs(hover.text, 'en') + 2000)
    // Captioned hover without holdMs: caption + HOVER_REST_MS.
    const hoverDefault = { id: 'h2', anchorId: 'listen-play', act: 'hover', text: bi('Rest on the Play key.', 'Descansa en Reproducir.') }
    assert.equal(stepDurationMs(hoverDefault, 'en'), captionDurationMs(hoverDefault.text, 'en') + HOVER_REST_MS)
    // Uncaptioned acts: no read phase; hover keeps its hold exactly as before.
    const bareTap = { id: 'bt', anchorId: 'listen-play', act: 'tap' }
    assert.equal(performDelayMs(bareTap, 'en'), 0)
    assert.equal(stepDurationMs(bareTap, 'en'), Math.max(ACTION_BEAT_MS, RESULT_DWELL_MS))
    const bareHover = { id: 'bh', anchorId: 'listen-play', act: 'hover', payload: { holdMs: 2000 } }
    assert.equal(stepDurationMs(bareHover, 'en'), 2000)
    assert.equal(stepDurationMs({ id: 'bh2', anchorId: 'listen-play', act: 'hover' }, 'en'), HOVER_REST_MS)
    // say: nothing performed — no delay, no dwell, caption alone.
    const say = { id: 's', anchorId: 'listen-play', act: 'say', text: bi('That is the whole probe.', 'Eso es toda la sonda.') }
    assert.equal(performDelayMs(say, 'en'), 0)
    assert.equal(stepDurationMs(say, 'en'), captionDurationMs(say.text, 'en'))
  })

  test('physical speed mapping (P2): label / 2 — a 1000 ms wait at label 1 takes 2000 ms wall', () => {
    assert.equal(physicalSpeed(0.5), 0.25)
    assert.equal(physicalSpeed(0.75), 0.375)
    assert.equal(physicalSpeed(1), 0.5)
    assert.equal(physicalSpeed(1.5), 0.75)
    assert.equal(physicalSpeed(2), 1)
    const timer = new FakeTimer()
    const clock = createPresentationClock(timer)
    assert.equal(clock.speed, 1, 'the snapshot speed stays a LABEL')
    let firedAt = null
    clock.after(1000, () => {
      firedAt = timer.nowMs
    })
    timer.advance(1999)
    assert.equal(firedAt, null)
    timer.advance(1)
    assert.equal(firedAt, 2000, '1000 presentation ms at the new 1× (physical 0.5×) = 2000 wall ms')
    // Elapsed presentation time also converts through the physical rate.
    const timer2 = new FakeTimer()
    const clock2 = createPresentationClock(timer2)
    clock2.setSpeed(2) // physical 1× — the old 1×
    timer2.advance(1000)
    assert.equal(clock2.elapsedMs(), 1000)
    assert.equal(clock2.speed, 2, 'setSpeed still takes and reports LABELS')
  })

  test('module duration + label come from the one calibration, per language', () => {
    const script = sampleModule()
    // Presentation-time sums (two-phase): EN s1 tap 7 words → 3280 + 1000 dwell · s2 tap 7 → 3280 + 1000 · s3 say 5 → 2600.
    // moduleDurationMs is the WALL duration at the new Automatic 1×: the sum / physicalSpeed(1) = sum × 2.
    assert.equal(moduleDurationMs(script, 'en'), (4280 + 4280 + 2600) * 2)
    // ES: s1 7 → 4280 · s2 9 → 3960 + 1000 · s3 say 5 → 2600
    assert.equal(moduleDurationMs(script, 'es'), (4280 + 4960 + 2600) * 2)
    assert.equal(durationLabel(script, 'en'), durationLabelForMs(moduleDurationMs(script, 'en'), 'en'))
    assert.equal(durationLabel(script, 'en'), 'Approx. 1 min')
    assert.equal(durationLabel(script, 'es'), 'Aprox. 1 min')
    assert.ok(!/about|unos/.test(durationLabel(script, 'en') + durationLabel(script, 'es')))
  })

  test('speed scales a wait; a live change keeps the remaining presentation time', () => {
    const timer = new FakeTimer()
    const clock = createPresentationClock(timer)
    let firedAt = null
    clock.after(2000, () => {
      firedAt = timer.nowMs
    })
    timer.advance(500) // at label 1 (physical 0.5×) 500 wall ms consume 250 presentation ms — 1750 remain
    clock.setSpeed(2) // label 2 is physical 1× → the remainder runs 1750 wall ms
    timer.advance(1749)
    assert.equal(firedAt, null)
    timer.advance(1)
    assert.equal(firedAt, 2250)
  })

  test('pause holds a wait without consuming it', () => {
    const timer = new FakeTimer()
    const clock = createPresentationClock(timer)
    let fired = false
    clock.after(1000, () => {
      fired = true
    })
    timer.advance(400) // 200 presentation ms consumed at label 1; 800 remain → 1600 wall ms after resume
    clock.pause()
    timer.advance(10_000)
    assert.equal(fired, false)
    clock.resume()
    timer.advance(1599)
    assert.equal(fired, false)
    timer.advance(1)
    assert.equal(fired, true)
  })

  test('the speed choice is a first-class hold; only the five speeds are accepted', () => {
    const timer = new FakeTimer()
    const clock = createPresentationClock(timer)
    let fired = false
    clock.after(1000, () => {
      fired = true
    })
    timer.advance(400) // 200 presentation ms consumed at label 1
    clock.beginSpeedChoice()
    assert.equal(clock.speedChoiceOpen, true)
    timer.advance(10_000)
    assert.equal(fired, false)
    clock.setSpeed(2) // the choice itself, made inside the hold — label 2, physical 1×
    clock.endSpeedChoice()
    timer.advance(799) // 800 presentation ms remain at physical 1× → 800 wall ms
    assert.equal(fired, false)
    timer.advance(1)
    assert.equal(fired, true)
    assert.throws(() => clock.setSpeed(1.25), /not one of/)
  })

  test('the generic hold stops the clock; it resumes only a clock that was running', () => {
    const timer = new FakeTimer()
    const clock = createPresentationClock(timer)
    let fired = false
    clock.after(1000, () => {
      fired = true
    })
    timer.advance(400) // 200 presentation ms consumed at label 1; 800 remain → 1600 wall ms
    clock.beginHold()
    assert.equal(clock.holdOpen, true)
    timer.advance(60_000)
    assert.equal(fired, false, 'a held clock does not consume the wait')
    clock.endHold()
    timer.advance(1599)
    assert.equal(fired, false)
    timer.advance(1)
    assert.equal(fired, true)

    // A hold over a clock the user had already paused must not resurrect it.
    const timer2 = new FakeTimer()
    const clock2 = createPresentationClock(timer2)
    let fired2 = false
    clock2.after(1000, () => {
      fired2 = true
    })
    clock2.pause()
    clock2.beginHold()
    clock2.endHold()
    timer2.advance(60_000)
    assert.equal(fired2, false, 'the hold ends, the user’s pause stands')
    clock2.resume()
    timer2.advance(2000) // 1000 presentation ms at label 1 = 2000 wall ms
    assert.equal(fired2, true)
  })
})

/* ── Script format: registration, banned keys, caption warnings ─────── */

describe('script format', () => {
  test('a well-formed module validates clean; family instances resolve', () => {
    assert.deepEqual(validatePresentationModule(sampleModule()), [])
    assert.equal(isRegisteredAnchorId('listen-paste'), true)
    assert.equal(isRegisteredAnchorId('voice-card:pk_alba'), true) // family instance
    assert.equal(isRegisteredAnchorId('no-such-anchor'), false)
  })

  test('an unregistered anchor id fails validation', () => {
    const script = sampleModule()
    script.scenes[0].steps[0].anchorId = 'no-such-anchor'
    const problems = validatePresentationModule(script)
    assert.ok(problems.some((p) => p.includes('no-such-anchor') && p.includes('not in ANCHORS')))
  })

  test('effectAnchorId / subjectAnchorId / leaves are accepted; an unregistered effect id is rejected', () => {
    const script = sampleModule()
    script.scenes[0].steps[0].effectAnchorId = 'listen-play'
    script.scenes[0].steps[0].subjectAnchorId = 'listen-editor'
    script.scenes[0].steps[0].leaves = 'text-on-stage'
    assert.deepEqual(validatePresentationModule(script), [], 'registered effect/subject ids and a free leaves state-name validate clean')
    script.scenes[0].steps[0].effectAnchorId = 'no-such-anchor'
    const problems = validatePresentationModule(script)
    assert.ok(problems.some((p) => p.includes('effect') && p.includes('no-such-anchor') && p.includes('not in ANCHORS')))
    const badSubject = sampleModule()
    badSubject.scenes[0].steps[0].subjectAnchorId = 'no-such-anchor'
    assert.ok(validatePresentationModule(badSubject).some((p) => p.includes('subject') && p.includes('not in ANCHORS')))
  })

  test('the banned-key scan catches smuggled selectors/coordinates at any depth', () => {
    const script = sampleModule()
    script.scenes[0].steps[0].payload = { param: 'x', selector: '.play-btn' }
    const found = findForbiddenScriptKeys(script)
    assert.ok(found.some((p) => p.endsWith('.selector')))
    const problems = validatePresentationModule(script)
    assert.ok(problems.some((p) => p.includes('banned key')))
    const nested = { a: [{ b: { coords: [1, 2] } }] }
    assert.deepEqual(findForbiddenScriptKeys(nested), ['$.a[0].b.coords'])
  })

  test('a missing language half fails validation (bilingual from birth)', () => {
    const script = sampleModule()
    delete script.scenes[0].steps[0].text.es
    const problems = validatePresentationModule(script)
    assert.ok(problems.some((p) => p.includes('es') && p.includes('missing')))
  })

  test('caption warnings fire in EN and in ES — warned, never silent', () => {
    const script = sampleModule()
    script.scenes[0].steps[0].text.en =
      'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen.'
    script.scenes[0].steps[1].text.es =
      'Uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciséis.'
    const warnings = presentationScriptWarnings(script)
    assert.equal(warnings.length, 2)
    assert.ok(warnings.some((w) => w.includes('(en)') && w.includes('16 words')))
    assert.ok(warnings.some((w) => w.includes('(es)') && w.includes('16 words')))
    assert.deepEqual(presentationScriptWarnings(sampleModule()), [])
  })
})

/* ── Runner ─────────────────────────────────────────────────────────── */

describe('runner', () => {
  test('Automatic advances on the clock and finishes seen; state file shape is exact', () => {
    const { runner, timer, storage } = makeRunner()
    const script = sampleModule()
    runner.start()
    assert.equal(runner.getSnapshot().status, 'playing')
    assert.equal(runner.getSnapshot().current?.step.id, 's1')
    timer.advance(wallMs(stepDurationMs(script.scenes[0].steps[0], 'en')))
    assert.equal(runner.getSnapshot().current?.step.id, 's2')
    timer.advance(wallMs(stepDurationMs(script.scenes[0].steps[1], 'en')))
    assert.equal(runner.getSnapshot().current?.step.id, 's3')
    timer.advance(wallMs(stepDurationMs(script.scenes[0].steps[2], 'en')))
    const done = runner.getSnapshot()
    assert.equal(done.status, 'done')
    assert.equal(done.endReason, 'completed')
    assert.equal(done.progress.state, 'seen')

    const file = JSON.parse(storage.getItem(PRESENTATION_STATE_KEY))
    assert.deepEqual(Object.keys(file).sort(), ['modules', 'myScenes', 'speed', 'speedScale'])
    assert.equal(file.speedScale, 2)
    assert.equal(file.modules['engine-probe'].state, 'seen')
    assert.equal(file.speed, 1)
    assert.deepEqual(file.myScenes, [])
  })

  test('Interactive waits for the act — the clock alone never advances it; › refuses gesture beats', () => {
    const { runner, timer } = makeRunner({ initialMode: 'interactive' })
    runner.start()
    assert.equal(runner.getSnapshot().status, 'interactive-wait')
    timer.advance(60_000)
    assert.equal(runner.getSnapshot().current?.step.id, 's1')
    // s1 is a tap — a gesture beat: › does not exist there (nav-pair law).
    assert.equal(runner.getSnapshot().gestureBeat, true)
    runner.next()
    assert.equal(runner.getSnapshot().current?.step.id, 's1', '› must not skip the gesture')
    runner.userAct()
    assert.equal(runner.getSnapshot().current?.step.id, 's2')
    // s2 is also a tap: the gesture, or «Show me», is the way through.
    runner.next()
    assert.equal(runner.getSnapshot().current?.step.id, 's2')
    runner.showMe()
    // P16: «Show me» performs at once, then dwells on the result for
    // RESULT_DWELL_MS — the step completes only when the dwell elapses.
    assert.equal(runner.getSnapshot().current?.step.id, 's2', 'the shown result dwells before the step completes')
    assert.equal(runner.getSnapshot().showMeDwelling, true)
    timer.advance(wallMs(RESULT_DWELL_MS))
    assert.equal(runner.getSnapshot().current?.step.id, 's3')
    // s3 is a narration beat (say): no gesture to skip, › advances it.
    assert.equal(runner.getSnapshot().gestureBeat, false)
    runner.next()
    assert.equal(runner.getSnapshot().status, 'done')
  })

  test('a live mode switch keeps the exact place, both directions', () => {
    const { runner, timer } = makeRunner()
    const script = sampleModule()
    runner.start()
    timer.advance(wallMs(stepDurationMs(script.scenes[0].steps[0], 'en'))) // → s2
    runner.setMode('interactive')
    assert.equal(runner.getSnapshot().status, 'interactive-wait')
    assert.equal(runner.getSnapshot().current?.step.id, 's2')
    timer.advance(60_000)
    assert.equal(runner.getSnapshot().current?.step.id, 's2')
    runner.setMode('automatic')
    assert.equal(runner.getSnapshot().status, 'playing')
    assert.equal(runner.getSnapshot().current?.step.id, 's2')
    timer.advance(wallMs(stepDurationMs(script.scenes[0].steps[1], 'en')))
    assert.equal(runner.getSnapshot().current?.step.id, 's3')
  })

  test('Back returns with exact place memory; resume lands on the recorded step', () => {
    const { runner, storage } = makeRunner({ initialMode: 'interactive' })
    runner.start()
    runner.userAct()
    runner.userAct()
    assert.equal(runner.getSnapshot().current?.step.id, 's3')
    runner.back()
    assert.equal(runner.getSnapshot().current?.step.id, 's2')
    assert.equal(runner.getSnapshot().progress.step, 1)
    assert.equal(runner.getSnapshot().progress.scene, 'opening')
    runner.back()
    assert.equal(runner.getSnapshot().current?.step.id, 's1')
    runner.back() // already first: stays, does not fall off the front
    assert.equal(runner.getSnapshot().current?.step.id, 's1')

    runner.userAct() // completes s1 → place is s2
    runner.abort()
    const resumed = createPresentationRunner(sampleModule(), {
      clock: createPresentationClock(new FakeTimer()),
      resolver: fakeResolver(),
      storage,
      now: () => 1_762_902_000_000,
      initialMode: 'interactive',
    })
    resumed.start()
    assert.equal(resumed.getSnapshot().current?.step.id, 's2')
    assert.equal(resumed.getSnapshot().progress.state, 'in-progress')
  })

  test('nav pair: ‹ never lands on a skipped machinery step — the stack holds lived positions only', () => {
    const script = sampleModule()
    script.scenes[0].steps[1].optional = true
    const { runner } = makeRunner(
      { resolver: fakeResolver(new Set(['listen-play'])), initialMode: 'interactive' },
      script,
    )
    runner.start()
    assert.equal(runner.getSnapshot().current?.step.id, 's1')
    assert.equal(runner.getSnapshot().canBack, false, 'the first beat has no return: ‹ is disabled')
    runner.userAct() // completes s1; s2 misses and is skipped by the machinery; s3 takes the stage
    assert.equal(runner.getSnapshot().current?.step.id, 's3')
    assert.equal(runner.getSnapshot().canBack, true)
    runner.back()
    assert.equal(runner.getSnapshot().current?.step.id, 's1', '‹ returns to the lived s1 — never onto the skipped s2')
    assert.equal(runner.getSnapshot().canBack, false)
    runner.back() // no return exists: a no-op, the learner stays at the first beat
    assert.equal(runner.getSnapshot().current?.step.id, 's1')
  })

  test('nav pair: after a chapter jump, ‹ returns to the pre-jump place, not the flat neighbour', () => {
    const script = {
      id: 'engine-probe-jump',
      floor: 'quick',
      title: bi('Jump probe', 'Sonda de saltos'),
      capability: bi('You can work the jump probe.', 'Puedes usar la sonda de saltos.'),
      verifiedAgainst: '1.4.156',
      scenes: [
        {
          id: 'first',
          chapter: bi('First', 'Primera'),
          steps: [
            { id: 'a1', anchorId: 'listen-paste', act: 'say', text: bi('One.', 'Uno.') },
            { id: 'a2', anchorId: 'listen-play', act: 'say', text: bi('Two.', 'Dos.') },
            { id: 'a3', anchorId: 'listen-editor', act: 'say', text: bi('Three.', 'Tres.') },
          ],
        },
        {
          id: 'second',
          chapter: bi('Second', 'Segunda'),
          steps: [
            { id: 'b1', anchorId: 'listen-paste', act: 'say', text: bi('Four.', 'Cuatro.') },
            { id: 'b2', anchorId: 'listen-play', act: 'say', text: bi('Five.', 'Cinco.') },
          ],
        },
      ],
    }
    const { runner } = makeRunner({ initialMode: 'interactive' }, script)
    runner.start()
    runner.next() // a1 → a2 (narration beats: › advances)
    assert.equal(runner.getSnapshot().current?.step.id, 'a2')
    runner.goToStep(3) // the chapters control lands on b1
    assert.equal(runner.getSnapshot().current?.step.id, 'b1')
    runner.back()
    assert.equal(runner.getSnapshot().current?.step.id, 'a2', '‹ returns to where the learner jumped FROM — not a3, the flat neighbour')
    runner.back()
    assert.equal(runner.getSnapshot().current?.step.id, 'a1')
    assert.equal(runner.getSnapshot().canBack, false)
  })

  test('nav pair: a resumed run starts with an empty return stack', () => {
    const script = sampleModule()
    script.scenes[0].steps.push({
      id: 's4',
      anchorId: 'listen-editor',
      act: 'say',
      text: bi('One more beat.', 'Un paso más.'),
    })
    const storage = new FakeStorage()
    const first = createPresentationRunner(script, {
      clock: createPresentationClock(new FakeTimer()),
      resolver: fakeResolver(),
      storage,
      now: () => 1_762_902_000_000,
      initialMode: 'interactive',
    })
    first.start()
    first.next() // s1 is a gesture beat (tap): › refuses — the run advances by acts
    assert.equal(first.getSnapshot().current?.step.id, 's1')
    first.userAct() // → s2
    first.userAct() // → s3
    assert.equal(first.getSnapshot().current?.step.id, 's3')
    first.abort()

    const resumed = createPresentationRunner(script, {
      clock: createPresentationClock(new FakeTimer()),
      resolver: fakeResolver(),
      storage,
      now: () => 1_762_902_000_000,
      initialMode: 'interactive',
    })
    resumed.start()
    assert.equal(resumed.getSnapshot().current?.step.id, 's3', 'resume lands on the recorded step')
    assert.equal(resumed.getSnapshot().canBack, false, 'this run has lived nothing before s3: ‹ is disabled')
    resumed.back()
    assert.equal(resumed.getSnapshot().current?.step.id, 's3', '‹ with no return is a no-op')
    resumed.next() // s3 is a narration beat: › advances to s4
    assert.equal(resumed.getSnapshot().current?.step.id, 's4')
    assert.equal(resumed.getSnapshot().canBack, true)
    resumed.back()
    assert.equal(resumed.getSnapshot().current?.step.id, 's3')
    assert.equal(resumed.getSnapshot().canBack, false)
  })

  test('fail-safe: an optional miss skips, logs, and the scene continues', () => {
    const script = sampleModule()
    script.scenes[0].steps[1].optional = true
    const { runner, storage } = makeRunner(
      { resolver: fakeResolver(new Set(['listen-play'])), initialMode: 'interactive' },
      script,
    )
    runner.start()
    runner.userAct() // completes s1; s2 misses and is skipped; s3 takes the stage
    const snapshot = runner.getSnapshot()
    assert.equal(snapshot.current?.step.id, 's3')
    assert.equal(snapshot.progress.state, 'in-progress')
    assert.equal(snapshot.progress.skips.length, 1)
    const skip = snapshot.progress.skips[0]
    assert.equal(skip.module, 'engine-probe')
    assert.equal(skip.scene, 'opening')
    assert.equal(skip.step, 1)
    assert.equal(skip.anchor, 'listen-play')
    assert.equal(skip.reason, 'fake-miss')
    // …and the log is persisted inside the state file.
    const file = JSON.parse(storage.getItem(PRESENTATION_STATE_KEY))
    assert.equal(file.modules['engine-probe'].skips.length, 1)
  })

  test('fail-safe: a required miss ends the scene cleanly, one plain line, needs-refresh', () => {
    const { runner } = makeRunner({ resolver: fakeResolver(new Set(['listen-play'])), initialMode: 'interactive' })
    runner.start()
    runner.userAct() // completes s1; s2 is required and misses
    const snapshot = runner.getSnapshot()
    assert.equal(snapshot.status, 'done')
    assert.equal(snapshot.endReason, 'required-anchor-miss')
    assert.equal(snapshot.notice.en, REFRESH_LINE.en)
    assert.equal(snapshot.progress.state, 'needs-refresh')
    assert.equal(snapshot.progress.step, 1, 'resume re-enters at the failed step')
    assert.equal(snapshot.progress.skips.length, 1)
  })

  test('the speed choice holds the runner clock (C′ law)', () => {
    const { runner, timer } = makeRunner()
    const script = sampleModule()
    runner.start()
    runner.beginSpeedChoice()
    assert.equal(runner.getSnapshot().speedChoiceOpen, true)
    timer.advance(60_000)
    assert.equal(runner.getSnapshot().current?.step.id, 's1')
    runner.setSpeed(2)
    runner.endSpeedChoice()
    timer.advance(wallMs(stepDurationMs(script.scenes[0].steps[0], 'en'), 2))
    assert.equal(runner.getSnapshot().current?.step.id, 's2')
  })

  test('speed is remembered per user across runners; saving a scene lands in myScenes', () => {
    const { runner, storage } = makeRunner({ initialMode: 'interactive' })
    runner.start()
    runner.setSpeed(1.5)
    runner.saveCurrentScene()
    const file = JSON.parse(storage.getItem(PRESENTATION_STATE_KEY))
    assert.equal(file.speed, 1.5)
    assert.equal(file.myScenes.length, 1)
    assert.equal(file.myScenes[0].module, 'engine-probe')
    assert.equal(file.myScenes[0].scene, 'opening')
    assert.equal(file.myScenes[0].step, 0)

    const second = createPresentationRunner(sampleModule(), {
      clock: createPresentationClock(new FakeTimer()),
      resolver: fakeResolver(),
      storage,
      now: () => 1_762_902_000_000,
    })
    assert.equal(second.getSnapshot().speed, 1.5)
  })
})

/* ── The stay-here window + the last-used mark (Oscar's laws, 2026-11-14) ── */

describe('stay-here window', () => {
  test('the clock stops while the window is open; Keep watching resumes the lesson untouched', () => {
    const { runner, timer } = makeRunner()
    const script = sampleModule()
    const s1Ms = stepDurationMs(script.scenes[0].steps[0], 'en')
    runner.start()
    timer.advance(wallMs(1000)) // part-way into s1's caption life (1000 presentation ms)
    runner.requestStayHere()
    assert.equal(runner.getSnapshot().stayWindowOpen, true)
    assert.equal(runner.getSnapshot().status, 'playing')
    timer.advance(60_000)
    assert.equal(runner.getSnapshot().current?.step.id, 's1', 'in Automatic the lesson must not advance behind the window')
    runner.cancelStayHere()
    assert.equal(runner.getSnapshot().stayWindowOpen, false)
    timer.advance(wallMs(s1Ms - 1000) - 1)
    assert.equal(runner.getSnapshot().current?.step.id, 's1', 'the held remainder is still owed')
    timer.advance(1)
    assert.equal(runner.getSnapshot().current?.step.id, 's2', 'the lesson continues exactly where it stood')
  })

  test('the window over a user-paused lesson does not resurrect the clock', () => {
    const { runner, timer } = makeRunner()
    const script = sampleModule()
    runner.start()
    runner.pause()
    runner.requestStayHere()
    runner.cancelStayHere()
    timer.advance(60_000)
    assert.equal(runner.getSnapshot().current?.step.id, 's1', 'the user’s pause survives the window')
    runner.resume()
    timer.advance(wallMs(stepDurationMs(script.scenes[0].steps[0], 'en')))
    assert.equal(runner.getSnapshot().current?.step.id, 's2')
  })

  test('while the window is open, nothing advances the lesson (Interactive)', () => {
    const { runner } = makeRunner({ initialMode: 'interactive' })
    runner.start()
    runner.requestStayHere()
    runner.next()
    runner.userAct()
    runner.showMe()
    assert.equal(runner.getSnapshot().current?.step.id, 's1', 'every advance verb stands down behind the window')
    runner.cancelStayHere()
    runner.userAct()
    assert.equal(runner.getSnapshot().current?.step.id, 's2')
  })

  test('confirm dissolves — and the place it recorded is the place Resume re-enters', () => {
    const { runner, storage } = makeRunner({ initialMode: 'interactive' })
    runner.start()
    runner.userAct() // → s2 on stage
    runner.requestStayHere()
    assert.equal(runner.getSnapshot().stayWindowOpen, true)
    runner.stayHere()
    const done = runner.getSnapshot()
    assert.equal(done.status, 'done')
    assert.equal(done.endReason, 'stay-here')
    assert.equal(done.stayWindowOpen, false)
    assert.equal(done.progress.state, 'in-progress')
    assert.equal(done.progress.step, 1, 'the step on stage when the learner left is the recorded place')
    assert.equal(done.progress.stepId, 's2')

    const file = JSON.parse(storage.getItem(PRESENTATION_STATE_KEY))
    assert.equal(file.lastUsed, 'engine-probe', 'the last-used mark survives the dissolution — the index head is built from it')
    const resumed = createPresentationRunner(sampleModule(), {
      clock: createPresentationClock(new FakeTimer()),
      resolver: fakeResolver(),
      storage,
      now: () => 1_762_902_000_000,
      initialMode: 'interactive',
    })
    resumed.start()
    assert.equal(resumed.getSnapshot().current?.step.id, 's2', 'resume re-enters exactly where the learner left off — no restart')
  })

  test('a finished module grows no window', () => {
    const { runner, timer } = makeRunner()
    const script = sampleModule()
    runner.requestStayHere() // before start: nothing to leave
    assert.equal(runner.getSnapshot().stayWindowOpen, false)
    runner.start()
    for (const step of script.scenes[0].steps) timer.advance(wallMs(stepDurationMs(step, 'en')))
    assert.equal(runner.getSnapshot().status, 'done')
    assert.equal(runner.getSnapshot().endReason, 'completed')
    runner.requestStayHere()
    assert.equal(runner.getSnapshot().stayWindowOpen, false, 'the end card dissolves directly, as before — no window')
  })
})

describe('the ✕ asks first (close window)', () => {
  test('the clock stops while the window is open; Keep watching resumes the lesson untouched', () => {
    const { runner, timer } = makeRunner()
    const script = sampleModule()
    const s1Ms = stepDurationMs(script.scenes[0].steps[0], 'en')
    runner.start()
    timer.advance(wallMs(1000)) // part-way into s1's caption life (1000 presentation ms)
    runner.requestClose()
    assert.equal(runner.getSnapshot().closeWindowOpen, true)
    assert.equal(runner.getSnapshot().status, 'playing')
    timer.advance(60_000)
    assert.equal(runner.getSnapshot().current?.step.id, 's1', 'in Automatic the lesson must not advance behind the ✕ window')
    runner.cancelClose()
    assert.equal(runner.getSnapshot().closeWindowOpen, false)
    timer.advance(wallMs(s1Ms - 1000) - 1)
    assert.equal(runner.getSnapshot().current?.step.id, 's1', 'the held remainder is still owed')
    timer.advance(1)
    assert.equal(runner.getSnapshot().current?.step.id, 's2', 'the lesson continues exactly where it stood')
  })

  test('while the window is open, nothing advances the lesson (Interactive)', () => {
    const { runner } = makeRunner({ initialMode: 'interactive' })
    runner.start()
    runner.requestClose()
    runner.next()
    runner.userAct()
    runner.showMe()
    runner.back()
    assert.equal(runner.getSnapshot().current?.step.id, 's1', 'every advance verb stands down behind the ✕ window')
    runner.cancelClose()
    runner.userAct()
    assert.equal(runner.getSnapshot().current?.step.id, 's2')
  })

  test('confirm leaves — onto the place already recorded, so Resume re-enters there', () => {
    const { runner } = makeRunner({ initialMode: 'interactive' })
    runner.start()
    runner.userAct() // → s2 on stage
    runner.requestClose()
    assert.equal(runner.getSnapshot().closeWindowOpen, true)
    runner.abort() // the window's «Leave» confirm
    const done = runner.getSnapshot()
    assert.equal(done.status, 'aborted')
    assert.equal(done.endReason, 'abort')
    assert.equal(done.closeWindowOpen, false, 'the window closes with the exit')
    assert.equal(done.progress.step, 1, 'the step on stage when the learner left is the recorded place')
    assert.equal(done.progress.stepId, 's2')
  })

  test('a finished module grows no window — its ✕ exits directly', () => {
    const { runner, timer } = makeRunner()
    const script = sampleModule()
    runner.requestClose() // before start: nothing to leave
    assert.equal(runner.getSnapshot().closeWindowOpen, false)
    runner.start()
    for (const step of script.scenes[0].steps) timer.advance(wallMs(stepDurationMs(step, 'en')))
    assert.equal(runner.getSnapshot().status, 'done')
    assert.equal(runner.getSnapshot().endReason, 'completed')
    runner.requestClose()
    assert.equal(runner.getSnapshot().closeWindowOpen, false, 'the finished card needs no confirmation')
  })

  test('the two windows never stack: each request stands down while the other is open', () => {
    const { runner } = makeRunner({ initialMode: 'interactive' })
    runner.start()
    runner.requestStayHere()
    assert.equal(runner.getSnapshot().stayWindowOpen, true)
    runner.requestClose()
    assert.equal(runner.getSnapshot().closeWindowOpen, false, 'no ✕ window over the stay-here window')
    runner.cancelStayHere()
    runner.requestClose()
    assert.equal(runner.getSnapshot().closeWindowOpen, true)
    runner.requestStayHere()
    assert.equal(runner.getSnapshot().stayWindowOpen, false, 'no stay-here window over the ✕ window')
    runner.cancelClose()
    assert.equal(runner.getSnapshot().current?.step.id, 's1', 'the lesson stood still through both windows')
  })
})

describe('the last-used mark (first-card law)', () => {
  test('recorded from module start and on every advance; cleared when the module completes', () => {
    const { runner, timer, storage } = makeRunner()
    const script = sampleModule()
    const read = () => JSON.parse(storage.getItem(PRESENTATION_STATE_KEY))
    runner.start()
    assert.equal(read().lastUsed, 'engine-probe', 'the mark is set from module start')
    timer.advance(wallMs(stepDurationMs(script.scenes[0].steps[0], 'en')))
    assert.equal(runner.getSnapshot().current?.step.id, 's2')
    assert.equal(read().lastUsed, 'engine-probe', '…and rides every advance')
    timer.advance(wallMs(stepDurationMs(script.scenes[0].steps[1], 'en')))
    timer.advance(wallMs(stepDurationMs(script.scenes[0].steps[2], 'en')))
    assert.equal(runner.getSnapshot().progress.state, 'seen')
    const file = read()
    assert.equal('lastUsed' in file, false, 'completion clears the mark — the key itself leaves the file')
    assert.deepEqual(Object.keys(file).sort(), ['modules', 'myScenes', 'speed', 'speedScale'])
  })

  test('the mark names the latest module used, even with another left part-way', () => {
    const storage = new FakeStorage()
    const make = (script) =>
      createPresentationRunner(script, {
        clock: createPresentationClock(new FakeTimer()),
        resolver: fakeResolver(),
        storage,
        now: () => 1_762_902_000_000,
        initialMode: 'interactive',
      })
    const first = make(sampleModule())
    first.start()
    first.abort() // left part-way; the mark names it
    assert.equal(JSON.parse(storage.getItem(PRESENTATION_STATE_KEY)).lastUsed, 'engine-probe')

    const second = make({ ...sampleModule(), id: 'engine-probe-two' })
    second.start()
    assert.equal(
      JSON.parse(storage.getItem(PRESENTATION_STATE_KEY)).lastUsed,
      'engine-probe-two',
      'starting another module moves the single mark — the latest used wins',
    )
  })
})

/* ── State round-trip ───────────────────────────────────────────────── */

describe('presentation state', () => {
  test('round-trip: modules, speed, myScenes and the last-used mark survive a save/load cycle', () => {
    const storage = new FakeStorage()
    const state = {
      modules: {
        Q1: { state: 'in-progress', step: 4, scene: 'reader', stepId: 'q1-s5', verifiedAgainst: '1.4.156', skips: [] },
      },
      speed: 0.75,
      speedScale: 2,
      myScenes: [{ module: 'Q1', scene: 'reader', step: 3, stepId: 'q1-s4', savedAt: '2026-11-14T09:00:00.000Z' }],
      lastUsed: 'Q1',
    }
    savePresentationState(storage, state)
    assert.deepEqual(loadPresentationState(storage), state)
    assert.equal(loadPresentationState(storage).modules.Q1.state, 'in-progress')
  })

  test('pace migration (P2): an unstamped file’s speed is discarded once — never reinterpreted', () => {
    // Old file: no speedScale, speed 2 (an OLD label — physical 2× then).
    const migrated = normalizePresentationState({ modules: {}, speed: 2, myScenes: [] })
    assert.equal(migrated.speed, 1, 'the old speed is discarded to the new label 1, not carried across')
    assert.equal(migrated.speedScale, 2, '…and the file is stamped with the new scale')
    // The migration runs once: the stamped result round-trips untouched.
    assert.equal(normalizePresentationState(migrated).speed, 1)
    // A speedScale: 2 file keeps its (new-label) speed, validated as before.
    assert.equal(normalizePresentationState({ modules: {}, speed: 2, speedScale: 2, myScenes: [] }).speed, 2)
    assert.equal(normalizePresentationState({ modules: {}, speed: 0.5, speedScale: 2, myScenes: [] }).speed, 0.5)
    assert.equal(normalizePresentationState({ modules: {}, speed: 3, speedScale: 2, myScenes: [] }).speed, 1, 'an invalid new-label speed still falls back to 1')
    // Through storage, the same: an old file on disk loads migrated.
    const storage = new FakeStorage()
    savePresentationState(storage, { modules: {}, speed: 2, myScenes: [] })
    const loaded = loadPresentationState(storage)
    assert.equal(loaded.speed, 1)
    assert.equal(loaded.speedScale, 2)
  })

  test('ModuleProgress mode / userPaused / seededRequiredMiss survive the load gate intact', () => {
    const state = {
      modules: {
        Q1: {
          state: 'in-progress',
          step: 4,
          scene: 'reader',
          stepId: 'q1-s5',
          verifiedAgainst: '1.4.156',
          skips: [],
          mode: 'interactive',
          userPaused: true,
          seededRequiredMiss: true,
        },
      },
      speed: 1,
      speedScale: 2,
      myScenes: [],
    }
    const storage = new FakeStorage()
    savePresentationState(storage, state)
    const loaded = loadPresentationState(storage)
    assert.deepEqual(loaded, state, 'all three fields round-trip through save/load — the normaliser names them, so it cannot strip them')
    assert.equal(loaded.modules.Q1.mode, 'interactive')
    assert.equal(loaded.modules.Q1.userPaused, true)
    assert.equal(loaded.modules.Q1.seededRequiredMiss, true)
    // A bogus mode value is still refused by the gate.
    const bogus = normalizePresentationState({
      modules: { Q1: { state: 'seen', verifiedAgainst: '1.4.156', skips: [], mode: 'sideways' } },
      speed: 1,
      speedScale: 2,
      myScenes: [],
    })
    assert.equal(bogus.modules.Q1.mode, undefined)
  })

  test('a corrupt or foreign state file degrades to the empty state, never throws', () => {
    const storage = new FakeStorage()
    storage.setItem(PRESENTATION_STATE_KEY, '{not json')
    assert.deepEqual(loadPresentationState(storage), { modules: {}, speed: 1, speedScale: 2, myScenes: [] })
    assert.deepEqual(normalizePresentationState({ speed: 3, modules: 'x', myScenes: [42] }), {
      modules: {},
      speed: 1,
      speedScale: 2,
      myScenes: [],
    })
  })
})

/* ── Payload isolation (the engine's half of Fence 0) ───────────────── */

describe('payload isolation', () => {
  test('acts route through the scenario port; no scenario data reaches any emitted payload', async () => {
    const scenario = createScenario()
    const performed = []
    const port = createScenarioPort(scenario, (flat, _resolution, sc) => {
      performed.push(flat.step.id)
      if (flat.step.id === 's1') sc.stage.playText(TEXT_EN.id)
    })
    const storage = new FakeStorage()
    const timer = new FakeTimer()
    const runner = createPresentationRunner(sampleModule(), {
      clock: createPresentationClock(timer),
      resolver: fakeResolver(),
      storage,
      scenarioPort: port,
      initialMode: 'interactive',
      now: () => 1_762_902_000_000,
    })
    runner.start()
    runner.showMe() // performs s1 through the port, then dwells on the result (P16)
    assert.deepEqual(performed, ['s1'])
    assert.equal(scenario.stage.session()?.textId, TEXT_EN.id, 'the act landed on the scenario, nowhere else')
    timer.advance(wallMs(RESULT_DWELL_MS)) // the dwell elapses → s2 on stage
    runner.userAct()
    runner.userAct()
    assert.equal(runner.getSnapshot().status, 'done')
    assert.equal(await scenario.isGone(), true, 'natural end discards the scenario whole')

    // Every payload the engine emitted, gathered the way outward paths would.
    const persisted = storage.getItem(PRESENTATION_STATE_KEY)
    const emitted = [
      persisted,
      JSON.stringify(runner.progress()),
      JSON.stringify(runner.getSnapshot().state),
      // backup-shaped and share-shaped payloads built from engine output only:
      JSON.stringify({ backup: JSON.parse(persisted) }),
      JSON.stringify({ share: { module: 'engine-probe', scene: 'opening', step: 2 } }),
    ]
    for (const payload of emitted) {
      assert.equal(containsScenarioData(JSON.parse(payload)), false, `engine payload leaked scenario data: ${payload}`)
    }
    // The scan is not vacuous: it sees the fiction when the fiction is there.
    assert.equal(containsScenarioData({ text: TEXT_EN.text }), true)
    assert.equal(containsScenarioData({ id: TEXT_EN.id }), true)
  })

  test('the default port performs the sandbox-native verbs (the lever replaces on the stage)', async () => {
    const scenario = createScenario()
    const clipModule = {
      id: 'engine-probe-clip',
      floor: 'quick',
      title: bi('Clip probe', 'Sonda del clip'),
      capability: bi('You can work the clip probe.', 'Puedes usar la sonda del clip.'),
      verifiedAgainst: '1.4.156',
      scenes: [
        {
          id: 'lever',
          chapter: bi('The lever', 'La palanca'),
          steps: [
            { id: 'c1', anchorId: 'bubble-clip', act: 'tap', text: bi('The copied text takes the stage.', 'El texto copiado toma la escena.') },
          ],
        },
      ],
    }
    const timer = new FakeTimer()
    const runner = createPresentationRunner(clipModule, {
      clock: createPresentationClock(timer),
      resolver: fakeResolver(),
      storage: new FakeStorage(),
      scenario, // no port injected → the default scenario port is built
      now: () => 1_762_902_000_000,
    })
    runner.start()
    // P16 two-phase: in Automatic the caption is read FIRST — the replace
    // lands only when the perform delay elapses, and the step is still on
    // stage then (its advance is a further RESULT_DWELL_MS away).
    assert.equal(scenario.stage.session(), null, 'nothing is performed before the caption has been read')
    timer.advance(wallMs(performDelayMs(clipModule.scenes[0].steps[0], 'en')))
    assert.equal(scenario.stage.session()?.title, CLIP_TEXT.title, 'the replace happened inside the sandbox')
    runner.abort()
    assert.equal(await scenario.isGone(), true, '✕ discards the scenario whole')
  })
})

/* ── Entry seeding — the mid-module-entry invariant (Oscar, 2026-11-14) ── */

describe('entry seeding (mid-module entry)', () => {
  const idxOf = (script, stepId) => flattenSteps(script).find((f) => f.step.id === stepId).globalIndex

  /** Plant exactly the progress record a prior run's markPlace persists. */
  function plantPlace(script, stepId) {
    const storage = new FakeStorage()
    const at = flattenSteps(script)[idxOf(script, stepId)]
    savePresentationState(storage, {
      modules: {
        [script.id]: {
          state: 'in-progress',
          step: at.globalIndex,
          scene: at.scene.id,
          stepId,
          verifiedAgainst: script.verifiedAgainst,
          skips: [],
        },
      },
      speed: 1,
      myScenes: [],
      lastUsed: script.id,
    })
    return storage
  }

  test('resume at a dependent beat presents with its fiction already built (Q2’s Undo)', () => {
    // The Undo beat exists only because scene 3 played the harbour text
    // and then replaced it with the copied note. A resume lands on a
    // FRESH scenario (one per launch): without seeding there is no
    // session at all and the Undo has nothing to undo — the Brizna
    // defect, reproduced on this bench before the fix (0 acts seeded).
    const scenario = createScenario()
    const timer = new FakeTimer()
    const runner = createPresentationRunner(Q2, {
      clock: createPresentationClock(timer),
      resolver: fakeResolver(),
      storage: plantPlace(Q2, 's3-undo-tap'),
      scenario,
      initialMode: 'interactive',
      now: () => 1_762_902_000_000,
      appVersion: '1.4.156',
    })
    runner.start()
    assert.equal(runner.getSnapshot().current?.step.id, 's3-undo-tap')
    assert.equal(timer.nowMs, 0, 'seeding is machinery: it consumes no presentation clock')
    assert.equal(scenario.getSettings().bubbleOn, true, 'scene 1’s λ tap was seeded — the bubble is out')
    assert.equal(
      scenario.stage.session()?.textId,
      CLIP_TEXT.id,
      'the harbour text was loaded AND replaced before the Undo beat is presented',
    )
    runner.showMe() // «Show me» performs the Undo through the port
    const restored = scenario.stage.session()
    assert.equal(restored?.textId, TEXT_EN.id, 'the Undo restores the harbour text')
    assert.equal(restored?.playing, false, '…loaded and paused, never promised as sound (§2.6-1)')
    runner.abort()
  })

  test('resume at an Advanced dependent beat (AD1’s save has its playing text)', () => {
    // s5-save-tap performs saveCurrentToLibrary, which needs the session
    // scene 3's setup created by loading the harbour text.
    const scenario = createScenario()
    const runner = createPresentationRunner(AD1, {
      clock: createPresentationClock(new FakeTimer()),
      resolver: fakeResolver(),
      storage: plantPlace(AD1, 's5-save-tap'),
      scenario,
      initialMode: 'interactive',
      now: () => 1_762_902_000_000,
      appVersion: '1.4.156',
    })
    runner.start()
    assert.equal(runner.getSnapshot().current?.step.id, 's5-save-tap')
    assert.equal(scenario.stage.session()?.textId, TEXT_EN.id, 'the harbour text is playing when the save beat lands')
    runner.showMe()
    return scenario.library.listClips().then((clips) => {
      assert.equal(
        clips.filter((c) => c.id.includes('clip-saved')).length,
        1,
        'the save landed exactly one clip in the scenario Library',
      )
      runner.abort()
    })
  })

  test('a chapters jump forward seeds likewise — and never re-performs a lived toggle', () => {
    const scenario = createScenario()
    const runner = createPresentationRunner(Q2, {
      clock: createPresentationClock(new FakeTimer()),
      resolver: fakeResolver(),
      storage: new FakeStorage(),
      scenario,
      initialMode: 'interactive',
      now: () => 1_762_902_000_000,
      appVersion: '1.4.156',
    })
    runner.start()
    assert.equal(scenario.stage.session(), null, 'a fresh start at step 0 seeds nothing — the stage is untouched')
    runner.goToStep(idxOf(Q2, 's3-undo-tap'))
    assert.equal(runner.getSnapshot().current?.step.id, 's3-undo-tap')
    assert.equal(scenario.getSettings().bubbleOn, true, 'the jump seeded scene 1’s λ tap')
    assert.equal(scenario.stage.session()?.textId, CLIP_TEXT.id, '…and the whole replace chain before the landing beat')
    // Back to the top, then forward again: the built frontier already
    // covers those steps, so nothing re-seeds — above all the λ tap,
    // whose second performance would flip the bubble back IN.
    runner.goToStep(0)
    runner.goToStep(idxOf(Q2, 's3-undo-tap'))
    assert.equal(scenario.getSettings().bubbleOn, true, 'the λ was NOT performed twice — the fiction stands as built')
    assert.equal(scenario.stage.session()?.textId, CLIP_TEXT.id)
    runner.abort()
  })

  test('fresh start is unchanged: step 0 first, scenario untouched, the walked chain performs in order', () => {
    const scenario = createScenario()
    const timer = new FakeTimer()
    const runner = createPresentationRunner(Q2, {
      clock: createPresentationClock(timer),
      resolver: fakeResolver(),
      storage: new FakeStorage(),
      scenario,
      now: () => 1_762_902_000_000,
      appVersion: '1.4.156',
    })
    runner.start()
    assert.equal(runner.getSnapshot().current?.step.id, 's1-ask-lambda')
    assert.equal(scenario.stage.session(), null)
    assert.equal(scenario.getSettings().bubbleOn, false)
    // Walk Automatic through every beat before the Undo: at its entry,
    // the walked chain has performed the Undo's replace for it.
    const flat = flattenSteps(Q2)
    const undoAt = idxOf(Q2, 's3-undo-tap')
    for (let i = 0; i < undoAt; i++) timer.advance(wallMs(stepDurationMs(flat[i].step, 'en')))
    assert.equal(runner.getSnapshot().current?.step.id, 's3-undo-tap')
    // P16 two-phase: the Undo is a performed act — it fires after its
    // caption's reading time, while the beat is still on stage.
    timer.advance(wallMs(performDelayMs(flat[undoAt].step, 'en')))
    assert.equal(runner.getSnapshot().current?.step.id, 's3-undo-tap', 'the Undo beat is still on stage when its act fires')
    const restored = scenario.stage.session()
    assert.equal(restored?.textId, TEXT_EN.id, 'the walked Undo restored the harbour text')
    assert.equal(restored?.playing, false, 'loaded and paused (§2.6-1)')
    runner.abort()
  })
})

/* ── Dead anchors never blind the lesson (the Brizna chain, part B) ── */

describe('dead anchors (blind-skip audit)', () => {
  test('three consecutive dead anchors cost 0 ms and emit no snapshot — the card always has its beat', () => {
    // Brizna's price for this run was ≈2.2 s per dead anchor of
    // lesson-less screen. Logos's resolution is synchronous and its
    // skip is emit-free: the run below must take EXACTLY the two live
    // beats' time, and no emitted snapshot may lack a live step while
    // the lesson is active. (Bench case 4 prints the same numbers.)
    const script = {
      id: 'engine-probe-dead',
      floor: 'quick',
      title: bi('Dead probe', 'Sonda muerta'),
      capability: bi('You can work the dead probe.', 'Puedes usar la sonda muerta.'),
      verifiedAgainst: '1.4.156',
      scenes: [
        {
          id: 'run',
          chapter: bi('Run', 'Corrida'),
          steps: [
            { id: 'live-1', anchorId: 'listen-paste', act: 'say', text: bi('First live beat here now.', 'Primer paso vivo aquí.') },
            { id: 'dead-1', anchorId: 'listen-play', act: 'say', optional: true, text: bi('A dead beat.', 'Un paso muerto.') },
            { id: 'dead-2', anchorId: 'listen-editor', act: 'say', optional: true, text: bi('A dead beat.', 'Un paso muerto.') },
            { id: 'dead-3', anchorId: 'listen-next', act: 'say', optional: true, text: bi('A dead beat.', 'Un paso muerto.') },
            { id: 'live-2', anchorId: 'listen-mark', act: 'say', text: bi('Second live beat here now.', 'Segundo paso vivo aquí.') },
          ],
        },
      ],
    }
    const timer = new FakeTimer()
    const emits = []
    const runner = createPresentationRunner(script, {
      clock: createPresentationClock(timer),
      resolver: fakeResolver(new Set(['listen-play', 'listen-editor', 'listen-next'])),
      storage: new FakeStorage(),
      now: () => 1_762_902_000_000,
      appVersion: '1.4.156',
    })
    runner.subscribe(() => {
      const s = runner.getSnapshot()
      emits.push({ at: timer.nowMs, status: s.status, step: s.current?.step.id ?? null })
    })
    runner.start()
    timer.advance(60_000)
    assert.deepEqual(
      emits.map((e) => e.step ?? e.status),
      ['live-1', 'live-2', 'done'],
      'the dead beats emitted nothing — no invisible state was ever painted',
    )
    assert.equal(emits[emits.length - 1].at, wallMs(2600 + 2600), 'total wall time is the two live beats only (2600 presentation ms each at label 1): 3 dead anchors ≪ 3 × any wait')
    assert.ok(emits.filter((e) => e.status === 'playing').every((e) => e.step !== null), 'every active snapshot carries its live beat')
    assert.equal(runner.getSnapshot().progress.skips.length, 3, 'all three skips were logged')
  })
})

/* ── The screen-edge law (geometry.ts) ─────────────────────────────── */

describe('the screen-edge law — the breathing hole contained', () => {
  const VW = 390
  const VH = 844
  const edges = (hole) => ({
    left: hole.left,
    top: hole.top,
    right: hole.left + hole.width,
    bottom: hole.top + hole.height,
  })

  test('a centred focus keeps its full 10px of air on every side', () => {
    const hole = containedHole({ top: 300, left: 100, width: 80, height: 48 }, VW, VH)
    assert.deepEqual(hole, { top: 290, left: 90, width: 100, height: 68 })
  })

  test('a focus flush with the BOTTOM edge (P6): the hole ends at vh itself — the element is never cropped', () => {
    // The Brizna defect, staged: a bottom-bar control whose own bottom is
    // the viewport's bottom (844). The old ±10px hole ended at 854; the
    // first containment pass ended it at 840, veiling the element's own
    // bottom 4px (P6). Now the air below gives to zero and the hole
    // contains the element whole, ending exactly at the screen's edge.
    const hole = containedHole({ top: 780, left: 24, width: 72, height: 64 }, VW, VH)
    const e = edges(hole)
    assert.equal(e.bottom, VH)
    assert.equal(e.top, 770, 'the air above the focus is untouched')
    assert.ok(e.left >= 0 && e.right <= VW)
    assert.ok(e.left <= 24 && e.right >= 96, 'the hole contains the element’s on-screen rect')
  })

  test('a focus flush with the RIGHT edge (P6): the hole ends at vw itself', () => {
    const hole = containedHole({ top: 320, left: 318, width: 72, height: 52 }, VW, VH)
    const e = edges(hole)
    assert.equal(e.right, VW)
    assert.equal(e.left, 308, 'the air left of the focus is untouched')
    assert.ok(e.top >= 0 && e.bottom <= VH)
  })

  test('top and left edges (P6): a flush focus starts the hole at 0,0 — air only where the screen allows', () => {
    const hole = containedHole({ top: 0, left: 0, width: 60, height: 44 }, VW, VH)
    const e = edges(hole)
    assert.equal(e.top, 0)
    assert.equal(e.left, 0)
    assert.equal(e.bottom, 54)
    assert.equal(e.right, 70)
  })

  test('a corner focus (bottom-right, P6) is contained on both axes at once — and never cropped', () => {
    const hole = containedHole({ top: 800, left: 330, width: 60, height: 44 }, VW, VH)
    const e = edges(hole)
    assert.deepEqual(e, { left: 320, top: 790, right: VW, bottom: VH })
  })

  test('a partially off-screen focus (left): the hole frames the visible portion at the old edge margin', () => {
    // rect.left −30 is genuinely off screen: that side clamps as before
    // (HOLE_EDGE), while the on-screen sides keep their full air and the
    // hole still contains everything of the element that is visible
    // from the margin inward.
    const hole = containedHole({ top: 300, left: -30, width: 80, height: 48 }, VW, VH)
    const e = edges(hole)
    assert.deepEqual(e, { left: 4, top: 290, right: 60, bottom: 358 })
  })

  test('an element wider than vw − 8: the hole spans edge to edge and still contains it whole', () => {
    const hole = containedHole({ top: 200, left: 0, width: 390, height: 48 }, VW, VH)
    const e = edges(hole)
    assert.deepEqual(e, { left: 0, top: 190, right: VW, bottom: 258 })
    assert.equal(hole.width, VW)
  })

  test('an element fully below the viewport: NULL — no target (the 3b contract: null = paint no veil, no ring)', () => {
    assert.equal(containedHole({ top: 900, left: 100, width: 80, height: 48 }, VW, VH), null)
    assert.equal(containedHole({ top: 100, left: -200, width: 80, height: 48 }, VW, VH), null, 'fully off the left is likewise no target')
    assert.equal(containedHole({ top: -120, left: 100, width: 80, height: 48 }, VW, VH), null, 'fully above is likewise no target')
  })

  test('with no measured viewport, the plain breathing hole comes back (pre-measure frame)', () => {
    const hole = containedHole({ top: 780, left: 24, width: 72, height: 64 }, 0, 0)
    assert.deepEqual(hole, { top: 770, left: 14, width: 92, height: 84 })
  })
})

/* ── The card is born where it will live (Oscar's law, 2026-11-14) ── */

describe('the card is born where it will live (cardSeat)', () => {
  const VW = 390
  const VH = 844

  test('no focus yet, or no measured viewport: NO seat — the card stays invisible', () => {
    // While its seat is being measured there is nothing to render: the
    // player shows no card at all rather than a provisional one.
    assert.equal(cardSeat(null, VW, VH, 0), null)
    assert.equal(cardSeat({ top: 100, left: 40, width: 56, height: 56 }, 0, VH, 0), null)
    assert.equal(cardSeat({ top: 100, left: 40, width: 56, height: 56 }, VW, 0, 0), null)
  })

  test('a high focus: the card hangs below it, beside it — its home from the first frame', () => {
    // At phone width the 370px card spans nearly the whole screen, so
    // left rests at the margin; the seat's life is vertical there.
    const seat = cardSeat({ top: 100, left: 40, width: 56, height: 56 }, VW, VH, 0)
    assert.deepEqual(seat, { left: 12, top: 172 }) // focus bottom 156 + 16 of air
  })

  test('a low focus: the card stands above it, lifted clear of the mini player', () => {
    const seat = cardSeat({ top: 700, left: 40, width: 56, height: 56 }, VW, VH, 0)
    assert.deepEqual(seat, { left: 12, bottom: 160 }) // 844 − 700 + 16
    const withMini = cardSeat({ top: 780, left: 40, width: 56, height: 56 }, VW, VH, 84)
    assert.deepEqual(withMini, { left: 12, bottom: 96 }, 'the mini inset (84) + margin wins over the raw gap (80)')
  })

  test('the seat never leaves the screen: left clamps at every width the ladder serves', () => {
    assert.equal(cardSeat({ top: 100, left: 380, width: 10, height: 10 }, VW, VH, 0).left, 12)
    assert.equal(cardSeat({ top: 100, left: 600, width: 10, height: 10 }, 1000, 800, 0).left, 508) // 480px card ≥840
    assert.equal(cardSeat({ top: 100, left: 1400, width: 10, height: 10 }, 1600, 900, 0).left, 1038) // 550px card ≥1500
    assert.equal(cardSeat({ top: 100, left: 2, width: 10, height: 10 }, VW, VH, 0).left, 12)
  })
})

/* ── unionRect + the footprint seat (P8/P11/P4 geometry) ────────────── */

describe('unionRect', () => {
  test('empty → null; a single rect → itself; many → the smallest containing rect', () => {
    assert.equal(unionRect([]), null)
    assert.deepEqual(unionRect([{ top: 10, left: 20, width: 30, height: 40 }]), { top: 10, left: 20, width: 30, height: 40 })
    assert.deepEqual(
      unionRect([
        { top: 100, left: 40, width: 56, height: 56 },
        { top: 300, left: 10, width: 200, height: 80 },
        { top: 50, left: 300, width: 20, height: 20 },
      ]),
      { top: 50, left: 10, width: 310, height: 330 }, // right edge 320, bottom edge 380
    )
  })
})

describe('the footprint seat (cardSeat with a footprint)', () => {
  const VW = 390
  const VH = 844

  test('no footprint → the legacy result, unchanged', () => {
    const focus = { top: 100, left: 40, width: 56, height: 56 }
    assert.deepEqual(cardSeat(focus, VW, VH, 0), { left: 12, top: 172 })
    assert.deepEqual(cardSeat(focus, VW, VH, 0, undefined), cardSeat(focus, VW, VH, 0))
    assert.deepEqual(cardSeat(focus, VW, VH, 0, null), cardSeat(focus, VW, VH, 0))
    const low = { top: 700, left: 40, width: 56, height: 56 }
    assert.deepEqual(cardSeat(low, VW, VH, 0, undefined, 200), { left: 12, bottom: 160 }, 'cardHeight alone (no footprint) changes nothing')
  })

  test('effect below the anchor → the card seats ABOVE the footprint', () => {
    // Anchor at 400; its effect occupies 456–600 below it. The footprint
    // is their union (400–600). A 180px card above the footprint ends
    // its bottom edge at 400 − 16 = 384 → bottom offset 844 − 384 = 460,
    // covering neither the anchor nor the effect.
    const focus = { top: 400, left: 40, width: 56, height: 56 }
    const footprint = unionRect([focus, { top: 456, left: 40, width: 200, height: 144 }])
    assert.deepEqual(footprint, { top: 400, left: 40, width: 200, height: 200 })
    assert.deepEqual(cardSeat(focus, VW, VH, 0, footprint, 180), { left: 12, bottom: 460 })
  })

  test('effect above the anchor → the card seats BELOW the footprint', () => {
    // Anchor at 400; its effect occupies 200–400 above it, so the
    // footprint runs 200–456. Above the footprint a 180px card would
    // start at 200 − 16 − 180 = 4 < the 12px margin — not valid — so
    // the seat below wins: top = 456 + 16 = 472.
    const focus = { top: 400, left: 40, width: 56, height: 56 }
    const footprint = unionRect([{ top: 200, left: 40, width: 200, height: 200 }, focus])
    assert.deepEqual(footprint, { top: 200, left: 40, width: 200, height: 256 })
    assert.deepEqual(cardSeat(focus, VW, VH, 0, footprint, 180), { left: 12, top: 472 })
  })

  test('footprint without cardHeight keeps the single-point placement style for the side', () => {
    const focus = { top: 400, left: 40, width: 56, height: 56 }
    const footprint = { top: 400, left: 40, width: 200, height: 200 }
    // Above: the card's bottom edge point stands at 400 − 16 = 384.
    assert.deepEqual(cardSeat(focus, VW, VH, 0, footprint), { left: 12, bottom: 460 })
  })

  test('neither side fits → the side covering LESS of the footprint, clamped into the viewport', () => {
    // Footprint 200–640 (440 tall), a 300px card: above it would start
    // at −116, below it would end at 956 — neither is valid. Clamped,
    // above covers 200–312 of the footprint (112px), below covers
    // 532–640 (108px): below covers less, so below wins, its top
    // clamped to 844 − 12 − 300 = 532. Neither clamped seat covers the
    // anchor itself (380–430).
    const focus = { top: 380, left: 40, width: 56, height: 50 }
    const footprint = { top: 200, left: 40, width: 200, height: 440 }
    assert.deepEqual(cardSeat(focus, VW, VH, 0, footprint, 300), { left: 12, top: 532 })
  })
})

/* ── P1 · Prepare / confirm / clean abort (Builder 2 wave) ──────────── */

describe('P1 prepare / confirm / abortClean', () => {
  test('prepare holds the clock from t=0 and suppresses every write; confirm writes the place and playback runs from confirmation', () => {
    const { runner, timer, storage } = makeRunner()
    const script = sampleModule()
    runner.prepare()
    const openingSnap = runner.getSnapshot()
    assert.equal(openingSnap.opening, true)
    assert.equal(openingSnap.current?.step.id, 's1')
    assert.equal(openingSnap.status, 'playing', 'Automatic is armed — but the clock is held')
    assert.equal(storage.getItem(PRESENTATION_STATE_KEY), null, 'no markPlace, no lastUsed, no progress write of any kind while opening')
    timer.advance(60_000)
    assert.equal(runner.getSnapshot().current?.step.id, 's1', 'Automatic cannot advance behind the opening window')
    runner.confirmStart()
    assert.equal(runner.getSnapshot().opening, false)
    const file = JSON.parse(storage.getItem(PRESENTATION_STATE_KEY))
    assert.equal(file.lastUsed, 'engine-probe', 'the deferred last-used write lands on confirm')
    assert.equal(file.modules['engine-probe'].step, 0, 'the deferred markPlace lands on confirm')
    assert.equal(file.modules['engine-probe'].state, 'in-progress')
    const s1Ms = stepDurationMs(script.scenes[0].steps[0], 'en')
    timer.advance(wallMs(s1Ms) - 1)
    assert.equal(runner.getSnapshot().current?.step.id, 's1', 'the two-phase schedule runs FROM confirmation, not from prepare')
    timer.advance(1)
    assert.equal(runner.getSnapshot().current?.step.id, 's2')
    runner.abort()
  })

  test('abortClean leaves a recorded resume point byte-identical and tears the scenario down', async () => {
    const storage = new FakeStorage()
    savePresentationState(storage, {
      modules: {
        'engine-probe': {
          state: 'in-progress',
          step: 1,
          scene: 'opening',
          stepId: 's2',
          verifiedAgainst: '1.4.156',
          skips: [],
        },
      },
      speed: 1,
      speedScale: 2,
      myScenes: [],
      lastUsed: 'engine-probe',
    })
    const before = storage.getItem(PRESENTATION_STATE_KEY)
    const scenario = createScenario()
    const runner = createPresentationRunner(sampleModule(), {
      clock: createPresentationClock(new FakeTimer()),
      resolver: fakeResolver(),
      storage,
      scenario,
      now: () => 1_762_902_000_000,
      appVersion: '1.4.156',
    })
    runner.prepare()
    assert.equal(runner.getSnapshot().current?.step.id, 's2', 'prepare computed the resume point')
    assert.equal(runner.getSnapshot().opening, true)
    runner.abortClean()
    const snap = runner.getSnapshot()
    assert.equal(snap.status, 'aborted')
    assert.equal(snap.endReason, 'abort')
    assert.equal(snap.cleanAbort, true)
    assert.equal(snap.opening, false)
    assert.equal(storage.getItem(PRESENTATION_STATE_KEY), before, 'the previously recorded resume point is byte-identical — nothing was written')
    assert.equal(await scenario.isGone(), true, 'the scenario is discarded whole')
  })

  test('prepare blocked on a required miss at the entry beat: opening + blockedNotice, non-done, only abortClean exits', () => {
    const { runner, storage } = makeRunner({ resolver: fakeResolver(new Set(['listen-paste'])) })
    runner.prepare()
    const snap = runner.getSnapshot()
    assert.equal(snap.opening, true)
    assert.equal(snap.blockedNotice, REFRESH_LINE.en, 'the refresh line, in the run language')
    assert.notEqual(snap.status, 'done', 'the run does NOT silently finish behind the opening window')
    assert.equal(storage.getItem(PRESENTATION_STATE_KEY), null, 'the blocked miss persisted nothing')
    runner.next()
    runner.userAct()
    assert.notEqual(runner.getSnapshot().status, 'done', 'transport verbs do not exit the blocked prepare')
    runner.abortClean()
    assert.equal(runner.getSnapshot().status, 'aborted')
    assert.equal(runner.getSnapshot().cleanAbort, true)
    assert.equal(storage.getItem(PRESENTATION_STATE_KEY), null)
  })

  test('a finish reached during prepare (entry skip chain runs off the end) defers its persist + teardown to confirm', async () => {
    const script = sampleModule()
    script.scenes[0].steps[2].optional = true // s3, the recorded place, is now a dead optional beat
    const storage = new FakeStorage()
    savePresentationState(storage, {
      modules: {
        'engine-probe': { state: 'in-progress', step: 2, scene: 'opening', stepId: 's3', verifiedAgainst: '1.4.156', skips: [] },
      },
      speed: 1,
      speedScale: 2,
      myScenes: [],
      lastUsed: 'engine-probe',
    })
    const before = storage.getItem(PRESENTATION_STATE_KEY)
    const scenario = createScenario()
    const runner = createPresentationRunner(script, {
      clock: createPresentationClock(new FakeTimer()),
      resolver: fakeResolver(new Set(['listen-editor'])),
      storage,
      scenario,
      initialMode: 'interactive',
      now: () => 1_762_902_000_000,
      appVersion: '1.4.156',
    })
    runner.prepare()
    assert.equal(runner.getSnapshot().status, 'done', 'the skip chain ran off the end during prepare')
    assert.equal(runner.getSnapshot().opening, true)
    assert.equal(storage.getItem(PRESENTATION_STATE_KEY), before, '…but nothing was persisted yet')
    assert.equal(await scenario.isGone(), false, '…and the scenario is not torn down yet')
    runner.confirmStart()
    const file = JSON.parse(storage.getItem(PRESENTATION_STATE_KEY))
    assert.equal(file.modules['engine-probe'].state, 'needs-refresh', 'the deferred finish persists on confirm — with its skip, so needs-refresh (P17)')
    assert.equal(await scenario.isGone(), true, '…and the scenario is discarded on confirm')
  })

  test('start() on the same entry miss keeps its old semantics: done, required-anchor-miss, needs-refresh persisted', () => {
    const { runner, storage } = makeRunner({ resolver: fakeResolver(new Set(['listen-paste'])) })
    runner.start()
    const snap = runner.getSnapshot()
    assert.equal(snap.status, 'done')
    assert.equal(snap.endReason, 'required-anchor-miss')
    assert.equal(snap.opening, false)
    assert.equal(snap.notice.en, REFRESH_LINE.en)
    const file = JSON.parse(storage.getItem(PRESENTATION_STATE_KEY))
    assert.equal(file.modules['engine-probe'].state, 'needs-refresh')
  })
})

/* ── P16 · Two-phase scheduling, showMe dwell, setLanguage ──────────── */

describe('P16 two-phase scheduling', () => {
  function countingPort() {
    const performed = []
    return {
      performed,
      port: {
        scenario: null,
        perform: (flat) => performed.push(flat.step.id),
        teardown: () => {},
      },
    }
  }

  test('Automatic: the act fires after its caption reading time, the advance after the result dwell', () => {
    const { performed, port } = countingPort()
    const { runner, timer } = makeRunner({ scenarioPort: port })
    const s1 = sampleModule().scenes[0].steps[0]
    runner.start()
    timer.advance(wallMs(performDelayMs(s1, 'en')) - 1)
    assert.deepEqual(performed, [], 'the caption is still being read — nothing performed yet')
    timer.advance(1)
    assert.deepEqual(performed, ['s1'], 'the act fires at its perform delay')
    assert.equal(runner.getSnapshot().current?.step.id, 's1', 'the result dwells — the beat is still on stage')
    timer.advance(wallMs(RESULT_DWELL_MS) - 1)
    assert.equal(runner.getSnapshot().current?.step.id, 's1')
    timer.advance(1)
    assert.equal(runner.getSnapshot().current?.step.id, 's2', 'the advance lands at the full two-phase duration')
    runner.abort()
  })

  test('setLanguage mid-ask re-schedules the pending perform — the ask act happens exactly once', () => {
    const askModule = {
      id: 'engine-probe-ask',
      floor: 'quick',
      title: bi('Ask probe', 'Sonda de pregunta'),
      capability: bi('You can work the ask probe.', 'Puedes usar la sonda de pregunta.'),
      verifiedAgainst: '1.4.156',
      scenes: [
        {
          id: 'asking',
          chapter: bi('Asking', 'Preguntando'),
          steps: [
            {
              id: 'a1',
              anchorId: 'listen-paste',
              act: 'ask',
              question: bi('Where does it go?', '¿Adónde va lo que copiaste en la otra aplicación ayer?'),
            },
            { id: 'a2', anchorId: 'listen-play', act: 'say', text: bi('There it is.', 'Ahí está.') },
          ],
        },
      ],
    }
    const { performed, port } = countingPort()
    const { runner, timer } = makeRunner({ scenarioPort: port }, askModule)
    const a1 = askModule.scenes[0].steps[0]
    runner.start()
    timer.advance(wallMs(500)) // part-way through the EN question's reading time
    assert.deepEqual(performed, [])
    runner.setLanguage('es')
    // The pending perform is re-armed at the ES perform delay, from now.
    timer.advance(wallMs(performDelayMs(a1, 'es')) - 1)
    assert.deepEqual(performed, [], 'the act is owed at the new language’s delay — not deleted, not early')
    timer.advance(1)
    assert.deepEqual(performed, ['a1'], 'the ask act is performed exactly once after the switch')
    timer.advance(wallMs(RESULT_DWELL_MS))
    assert.equal(runner.getSnapshot().current?.step.id, 'a2', 'the re-armed advance lands at the new language’s duration')
    assert.deepEqual(performed, ['a1'], 'still exactly once')
    runner.abort()
  })

  test('setLanguage after the perform already fired re-arms only the advance — no second performance', () => {
    const { performed, port } = countingPort()
    const { runner, timer } = makeRunner({ scenarioPort: port })
    const s1 = sampleModule().scenes[0].steps[0]
    runner.start()
    timer.advance(wallMs(performDelayMs(s1, 'en')))
    assert.deepEqual(performed, ['s1'])
    runner.setLanguage('es')
    timer.advance(wallMs(stepDurationMs(s1, 'es')))
    assert.deepEqual(performed, ['s1'], 'the fired act is never re-performed by a language switch')
    assert.equal(runner.getSnapshot().current?.step.id, 's2')
    runner.abort()
  })

  test('showMe dwells: while dwelling, Show-me / › / userAct are inert', () => {
    const { performed, port } = countingPort()
    const { runner, timer } = makeRunner({ scenarioPort: port, initialMode: 'interactive' })
    runner.start()
    runner.showMe()
    assert.deepEqual(performed, ['s1'], '«Show me» performs immediately')
    assert.equal(runner.getSnapshot().showMeDwelling, true)
    runner.showMe()
    runner.next()
    runner.userAct()
    assert.deepEqual(performed, ['s1'], 'nothing re-performs during the dwell')
    assert.equal(runner.getSnapshot().current?.step.id, 's1', 'nothing advances during the dwell')
    timer.advance(wallMs(RESULT_DWELL_MS) - 1)
    assert.equal(runner.getSnapshot().current?.step.id, 's1')
    timer.advance(1)
    assert.equal(runner.getSnapshot().current?.step.id, 's2', 'the step completes when the dwell elapses')
    assert.equal(runner.getSnapshot().showMeDwelling, false)
    runner.abort()
  })
})

/* ── P13 · No re-performance + the λ fiction ledger ─────────────────── */

describe('P13 no re-performance', () => {
  test('back over the λ tap: the port performed it exactly once (Automatic re-entry does not re-fire)', () => {
    let real = false
    const lambdaPort = {
      getBubbleOn: () => real,
      setBubbleOn: (on) => {
        real = on
      },
    }
    const scenario = createScenario({ lambdaPort })
    const performed = []
    const port = createScenarioPort(scenario, (flat) => performed.push(flat.step.id))
    const lambdaModule = {
      id: 'engine-probe-lambda',
      floor: 'quick',
      title: bi('Lambda probe', 'Sonda lambda'),
      capability: bi('You can work the lambda probe.', 'Puedes usar la sonda lambda.'),
      verifiedAgainst: '1.4.156',
      scenes: [
        {
          id: 'out',
          chapter: bi('Out', 'Fuera'),
          steps: [
            { id: 'l1', anchorId: 'bubble-lambda', act: 'tap', text: bi('One tap, and Logos floats.', 'Un toque, y Logos flota.') },
            { id: 'l2', anchorId: 'listen-play', act: 'say', text: bi('She is out now.', 'Ya está fuera.') },
          ],
        },
      ],
    }
    const timer = new FakeTimer()
    const runner = createPresentationRunner(lambdaModule, {
      clock: createPresentationClock(timer),
      resolver: fakeResolver(),
      storage: new FakeStorage(),
      scenarioPort: port,
      now: () => 1_762_902_000_000,
      appVersion: '1.4.156',
    })
    const l1 = lambdaModule.scenes[0].steps[0]
    runner.start()
    timer.advance(wallMs(stepDurationMs(l1, 'en')))
    assert.equal(runner.getSnapshot().current?.step.id, 'l2')
    assert.deepEqual(performed.filter((id) => id === 'l1'), ['l1'])
    assert.equal(real, true)
    runner.back()
    assert.equal(runner.getSnapshot().current?.step.id, 'l1', '‹ re-enters the λ beat')
    timer.advance(wallMs(stepDurationMs(l1, 'en')))
    assert.deepEqual(performed.filter((id) => id === 'l1'), ['l1'], 're-entry performed the λ tap ZERO further times')
    assert.equal(real, true, 'the λ was not toggled back off by the re-entry')
    assert.equal(scenario.stage.lambdaOn(), true)
    runner.abort()
  })

  test('userAct then setMode(automatic): exactly one performance total — the learner’s own act counts', () => {
    const performed = []
    const port = {
      scenario: null,
      perform: (flat) => performed.push(flat.step.id),
      teardown: () => {},
    }
    const { runner, timer } = makeRunner({ scenarioPort: port, initialMode: 'interactive' })
    const s1 = sampleModule().scenes[0].steps[0]
    runner.start()
    runner.userAct() // the learner performs s1 by hand — that IS its one performance
    assert.equal(runner.getSnapshot().current?.step.id, 's2')
    runner.back()
    assert.equal(runner.getSnapshot().current?.step.id, 's1')
    runner.setMode('automatic')
    timer.advance(wallMs(stepDurationMs(s1, 'en')))
    assert.deepEqual(performed, [], 'Automatic did not perform s1 a second time after userAct')
    assert.equal(runner.getSnapshot().current?.step.id, 's2', '…but its advance scheduling was unaffected')
    runner.abort()
  })
})

describe('P13/P14 the λ fiction ledger (scenario)', () => {
  test('the fiction flag starts at the fiction default — never read from the real switch', () => {
    let real = true // the user's real switch is ON at creation
    const scenario = createScenario({
      lambdaPort: {
        getBubbleOn: () => real,
        setBubbleOn: (on) => {
          real = on
        },
      },
    })
    assert.equal(scenario.stage.lambdaOn(), false, 'the fiction λ starts OFF (bubbleOn: false), whatever the real switch says')
    assert.equal(scenario.getSettings().bubbleOn, false)
    scenario.teardown()
    assert.equal(real, true, 'teardown with an unmoved fiction writes nothing — the real switch stands as captured')
  })

  test('(a) kill with the real switch left ON, then seeding the same λ tap converges ON — never inverted OFF', () => {
    let real = false
    const makePort = () => ({
      getBubbleOn: () => real,
      setBubbleOn: (on) => {
        real = on
      },
    })
    // First run: Q2's λ tap is lived (ask → next, tap → «Show me»).
    const scenario1 = createScenario({ lambdaPort: makePort() })
    const runner1 = createPresentationRunner(Q2, {
      clock: createPresentationClock(new FakeTimer()),
      resolver: fakeResolver(),
      storage: new FakeStorage(),
      scenario: scenario1,
      initialMode: 'interactive',
      now: () => 1_762_902_000_000,
      appVersion: '1.4.156',
    })
    runner1.start()
    runner1.next() // the ask beat: › advances narration
    assert.equal(runner1.getSnapshot().current?.step.id, 's1-tap-lambda')
    runner1.showMe()
    assert.equal(real, true, 'the lived tap left the real switch ON')
    // HARD KILL: no teardown, no abort — scenario1 is simply dropped.
    // Relaunch: a NEW scenario over a port reading the left real value ON.
    const scenario2 = createScenario({ lambdaPort: makePort() })
    assert.equal(scenario2.stage.lambdaOn(), false, 'the new fiction still starts at its own default')
    const storage = new FakeStorage()
    const at = flattenSteps(Q2).find((f) => f.step.id === 's3-undo-tap')
    savePresentationState(storage, {
      modules: {
        Q2: { state: 'in-progress', step: at.globalIndex, scene: at.scene.id, stepId: 's3-undo-tap', verifiedAgainst: Q2.verifiedAgainst, skips: [] },
      },
      speed: 1,
      speedScale: 2,
      myScenes: [],
      lastUsed: 'Q2',
    })
    const runner2 = createPresentationRunner(Q2, {
      clock: createPresentationClock(new FakeTimer()),
      resolver: fakeResolver(),
      storage,
      scenario: scenario2,
      initialMode: 'interactive',
      now: () => 1_762_902_000_000,
      appVersion: '1.4.156',
    })
    runner2.start() // seedBefore replays the same λ tap on the new fiction
    assert.equal(scenario2.stage.lambdaOn(), true, 'the seeded tap set the FICTION flag')
    assert.equal(real, true, 'the real switch ends ON — the taught state — not inverted OFF')
    runner2.abort()
  })

  test('(b) teardown after λ ON restores the real switch to its creation value', () => {
    let real = false
    const scenario = createScenario({
      lambdaPort: {
        getBubbleOn: () => real,
        setBubbleOn: (on) => {
          real = on
        },
      },
    })
    scenario.stage.setLambda(true)
    assert.equal(real, true, 'setLambda wrote the absolute value through the port')
    scenario.teardown()
    assert.equal(real, false, 'teardown restored the value captured at creation')

    // And the mirror: created with the real switch ON, a lesson that
    // turns the fiction OFF leaves the real switch ON again at teardown.
    let real2 = true
    const scenario2 = createScenario({
      lambdaPort: {
        getBubbleOn: () => real2,
        setBubbleOn: (on) => {
          real2 = on
        },
      },
    })
    scenario2.stage.setLambda(false)
    assert.equal(real2, false)
    scenario2.teardown()
    assert.equal(real2, true, 'restored to the creation value, not to the fiction’s end state')
  })
})

/* ── P17 · Seeding honesty + the finish rule ────────────────────────── */

describe('P17 seeding honesty + finish rule', () => {
  function skipModule() {
    return {
      id: 'engine-probe-skips',
      floor: 'quick',
      title: bi('Skip probe', 'Sonda de saltos'),
      capability: bi('You can work the skip probe.', 'Puedes usar la sonda de saltos.'),
      verifiedAgainst: '1.4.156',
      scenes: [
        {
          id: 'only',
          chapter: bi('Only chapter', 'Capítulo único'),
          steps: [
            { id: 'k1', anchorId: 'listen-paste', act: 'say', text: bi('First beat here.', 'Primer paso aquí.') },
            { id: 'k2', anchorId: 'listen-play', act: 'tap', text: bi('Second beat here.', 'Segundo paso aquí.') },
            { id: 'k3', anchorId: 'listen-editor', act: 'say', text: bi('Third beat here.', 'Tercer paso aquí.') },
          ],
        },
      ],
    }
  }
  const silentPort = () => ({ scenario: null, perform: () => {}, teardown: () => {} })

  test('the Brizna hole, door one: goToStep jumping over a dead REQUIRED anchor → needs-refresh + a seed-miss log entry', () => {
    const { runner } = makeRunner(
      { resolver: fakeResolver(new Set(['listen-play'])), initialMode: 'interactive', scenarioPort: silentPort() },
      skipModule(),
    )
    runner.start()
    runner.goToStep(2) // jumps over k2 — seeding meets its dead anchor
    assert.equal(runner.getSnapshot().current?.step.id, 'k3')
    const seeded = runner.getSnapshot().progress
    assert.equal(seeded.seededRequiredMiss, true, 'the seeded required miss is flagged in the record')
    assert.ok(
      seeded.skips.some((s) => s.reason === 'seed-miss' && s.anchor === 'listen-play'),
      'seeding was visually silent — but not silent in the record',
    )
    runner.next() // k3 is narration: › finishes the module
    const done = runner.getSnapshot()
    assert.equal(done.status, 'done')
    assert.equal(done.progress.state, 'needs-refresh', 'a run with a seeded required miss never lands seen')
    assert.equal(done.endInfo.skipCount, 1)
    assert.deepEqual(done.endInfo.skipChapters, ['Only chapter'])
  })

  test('the Brizna hole, door two: resume at N with an earlier REQUIRED anchor newly dead → finishing the tail lands needs-refresh', () => {
    const script = skipModule()
    const storage = new FakeStorage()
    savePresentationState(storage, {
      modules: {
        [script.id]: { state: 'in-progress', step: 2, scene: 'only', stepId: 'k3', verifiedAgainst: '1.4.156', skips: [] },
      },
      speed: 1,
      speedScale: 2,
      myScenes: [],
      lastUsed: script.id,
    })
    const runner = createPresentationRunner(script, {
      clock: createPresentationClock(new FakeTimer()),
      resolver: fakeResolver(new Set(['listen-play'])),
      storage,
      scenarioPort: silentPort(),
      initialMode: 'interactive',
      now: () => 1_762_902_000_000,
      appVersion: '1.4.156',
    })
    runner.start()
    assert.equal(runner.getSnapshot().current?.step.id, 'k3', 'resume lands on the recorded beat')
    runner.next()
    const done = runner.getSnapshot()
    assert.equal(done.progress.state, 'needs-refresh', 'the tail cannot complete to seen over a dead required anchor behind it')
    assert.equal(done.progress.seededRequiredMiss, true)
    const file = JSON.parse(storage.getItem(PRESENTATION_STATE_KEY))
    assert.equal(file.modules[script.id].seededRequiredMiss, true, 'the flag is persisted, not just in memory')
    assert.ok(file.modules[script.id].skips.some((s) => s.reason === 'seed-miss'))
  })

  test('an OPTIONAL skip on a walked beat → needs-refresh, with endInfo naming the chapter', () => {
    const script = skipModule()
    script.scenes[0].steps[1].optional = true
    const { runner } = makeRunner(
      { resolver: fakeResolver(new Set(['listen-play'])), initialMode: 'interactive' },
      script,
    )
    runner.start()
    runner.next() // k1 narration → k2 misses (optional, walked) → k3 on stage
    assert.equal(runner.getSnapshot().current?.step.id, 'k3')
    runner.next()
    const done = runner.getSnapshot()
    assert.equal(done.progress.state, 'needs-refresh', 'ANY skip — even an optional walked one — blocks seen')
    assert.equal(done.endInfo.skipCount, 1)
    assert.deepEqual(done.endInfo.skipChapters, ['Only chapter'])
    assert.equal(done.progress.skips[0].reason, 'fake-miss', 'a walked skip keeps its own reason, distinct from seed-miss')
  })

  test('a genuinely clean full replay still clears needs-refresh to seen', () => {
    const script = skipModule()
    script.scenes[0].steps[1].optional = true
    const storage = new FakeStorage()
    const dead = createPresentationRunner(script, {
      clock: createPresentationClock(new FakeTimer()),
      resolver: fakeResolver(new Set(['listen-play'])),
      storage,
      initialMode: 'interactive',
      now: () => 1_762_902_000_000,
      appVersion: '1.4.156',
    })
    dead.start()
    dead.next()
    dead.next()
    assert.equal(dead.getSnapshot().progress.state, 'needs-refresh')
    // Replay from the top, every anchor alive this time.
    const clean = createPresentationRunner(script, {
      clock: createPresentationClock(new FakeTimer()),
      resolver: fakeResolver(),
      storage,
      initialMode: 'interactive',
      now: () => 1_762_902_000_000,
      appVersion: '1.4.156',
    })
    clean.start({ resume: false })
    clean.next() // k1
    clean.userAct() // k2, a tap — the learner's gesture
    clean.next() // k3
    assert.equal(clean.getSnapshot().progress.state, 'seen', 'the clean full play clears the flag')
    assert.equal(clean.getSnapshot().endInfo.skipCount, 0)
  })
})

/* ── P12 · Reveal wait ──────────────────────────────────────────────── */

describe('P12 reveal wait', () => {
  test('a sheet-style anchor that materialises after ~300 presentation-ms resolves with NO skip recorded', () => {
    const script = {
      id: 'engine-probe-reveal',
      floor: 'quick',
      title: bi('Reveal probe', 'Sonda de aparición'),
      capability: bi('You can work the reveal probe.', 'Puedes usar la sonda de aparición.'),
      verifiedAgainst: '1.4.156',
      scenes: [
        {
          id: 'sheet',
          chapter: bi('Sheet', 'Hoja'),
          steps: [
            { id: 'r1', anchorId: 'listen-paste', act: 'say', text: bi('First live beat here now.', 'Primer paso vivo aquí.') },
            { id: 'r2', anchorId: 'listen-speed-sheet', act: 'tap', text: bi('The sheet is here now.', 'La hoja ya está aquí.') },
          ],
        },
      ],
    }
    let attempts = 0
    const resolver = (step) => {
      const record = anchorById(step.anchorId)
      if (step.anchorId === 'listen-speed-sheet') {
        attempts += 1
        if (attempts <= 3) return { status: 'miss', record, anchorId: step.anchorId, reason: 'not-yet' }
      }
      return { status: 'resolved', record, target: {} }
    }
    const timer = new FakeTimer()
    const runner = createPresentationRunner(script, {
      clock: createPresentationClock(timer),
      resolver,
      storage: new FakeStorage(),
      now: () => 1_762_902_000_000,
      appVersion: '1.4.156',
    })
    runner.start()
    timer.advance(wallMs(stepDurationMs(script.scenes[0].steps[0], 'en'))) // r1 completes; r2's entry attempt misses
    assert.equal(runner.getSnapshot().current?.step.id, 'r1', 'during the wait the previous beat’s snapshot stands — nothing wrong is painted')
    timer.advance(wallMs(100)) // retry 1 (100 presentation-ms)
    timer.advance(wallMs(100)) // retry 2 (200)
    assert.equal(runner.getSnapshot().current?.step.id, 'r1', 'still waiting — no skip, no wrong snapshot')
    timer.advance(wallMs(100)) // retry 3 (300): the target has materialised
    assert.equal(runner.getSnapshot().current?.step.id, 'r2', 'the SAME declared resolution succeeded on retry')
    assert.equal(attempts, 4, 'one entry attempt + three retries at 100 presentation-ms intervals')
    assert.equal(runner.getSnapshot().progress.skips.length, 0, 'no skip was recorded for a beat that only needed its precondition to materialise')
    runner.abort()
  })

  test('a previous step’s `establishes` also earns the wait — and a target that never appears still takes the miss path after 1200', () => {
    const script = {
      id: 'engine-probe-reveal-2',
      floor: 'quick',
      title: bi('Reveal probe two', 'Sonda de aparición dos'),
      capability: bi('You can work the probe.', 'Puedes usar la sonda.'),
      verifiedAgainst: '1.4.156',
      scenes: [
        {
          id: 'door',
          chapter: bi('Door', 'Puerta'),
          steps: [
            {
              id: 'e1',
              anchorId: 'listen-paste',
              act: 'say',
              establishes: 'speed-sheet-open',
              text: bi('First live beat here now.', 'Primer paso vivo aquí.'),
            },
            { id: 'e2', anchorId: 'listen-play', act: 'say', optional: true, text: bi('A beat behind the door.', 'Un paso tras la puerta.') },
            { id: 'e3', anchorId: 'listen-editor', act: 'say', text: bi('Second live beat here now.', 'Segundo paso vivo aquí.') },
          ],
        },
      ],
    }
    const timer = new FakeTimer()
    const runner = createPresentationRunner(script, {
      clock: createPresentationClock(timer),
      resolver: fakeResolver(new Set(['listen-play'])), // e2 NEVER appears
      storage: new FakeStorage(),
      now: () => 1_762_902_000_000,
      appVersion: '1.4.156',
    })
    runner.start()
    timer.advance(wallMs(stepDurationMs(script.scenes[0].steps[0], 'en')))
    assert.equal(runner.getSnapshot().current?.step.id, 'e1', 'the wait is running — e2 has not been skipped yet')
    timer.advance(wallMs(1200)) // the full reveal budget
    assert.equal(runner.getSnapshot().current?.step.id, 'e3', 'after 1200 presentation-ms the miss path applies: e2 skipped + logged, the scene continues')
    assert.equal(runner.getSnapshot().progress.skips.length, 1)
    runner.abort()
  })
})

/* ── P14 · Backgrounding + mode/paused persistence ──────────────────── */

describe('P14 backgrounding + mode/paused persistence', () => {
  test('playing Automatic → hidden → visible → the clock runs again', () => {
    const { runner, timer } = makeRunner()
    const s1 = sampleModule().scenes[0].steps[0]
    runner.start()
    runner.handleHidden()
    timer.advance(60_000)
    assert.equal(runner.getSnapshot().current?.step.id, 's1', 'a hidden lesson does not advance')
    runner.handleVisible()
    timer.advance(wallMs(stepDurationMs(s1, 'en')))
    assert.equal(runner.getSnapshot().current?.step.id, 's2', 'a lesson that was playing resumes playing')
    runner.abort()
  })

  test('user-paused → hidden → visible → still paused', () => {
    const { runner, timer } = makeRunner()
    runner.start()
    runner.pause()
    runner.handleHidden()
    runner.handleVisible()
    timer.advance(60_000)
    assert.equal(runner.getSnapshot().current?.step.id, 's1')
    assert.equal(runner.getSnapshot().status, 'paused', 'visibility never resurrects a user pause')
    runner.abort()
  })

  test('mode + userPaused persist, and a resumed start restores them over host defaults', () => {
    const storage = new FakeStorage()
    const first = createPresentationRunner(sampleModule(), {
      clock: createPresentationClock(new FakeTimer()),
      resolver: fakeResolver(),
      storage,
      now: () => 1_762_902_000_000,
      appVersion: '1.4.156',
    })
    first.start() // Automatic by host default
    first.pause() // userPaused = true
    first.setMode('interactive') // mode changes while paused — both must persist
    const file = JSON.parse(storage.getItem(PRESENTATION_STATE_KEY))
    assert.equal(file.modules['engine-probe'].mode, 'interactive', 'the record carries the mode')
    assert.equal(file.modules['engine-probe'].userPaused, true, 'the record carries the paused state')
    first.abort()

    const resumed = createPresentationRunner(sampleModule(), {
      clock: createPresentationClock(new FakeTimer()),
      resolver: fakeResolver(),
      storage,
      now: () => 1_762_902_000_000,
      appVersion: '1.4.156',
      initialMode: 'automatic', // the host default the record must override
    })
    resumed.start()
    const snap = resumed.getSnapshot()
    assert.equal(snap.mode, 'interactive', 'the paused Interactive lesson resumes in Interactive — not playing in Automatic')
    assert.equal(snap.progress.userPaused, true, '…and still paused')
    assert.equal(snap.status, 'interactive-wait')
    resumed.abort()
  })
})
