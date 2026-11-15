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
  ASK_BEAT_MS,
  CAPTION_MAX_MS,
  CAPTION_MIN_MS,
  HOVER_REST_MS,
  ACTION_BEAT_MS,
  captionDurationMs,
  createPresentationClock,
  durationLabel,
  durationLabelForMs,
  moduleDurationMs,
  stepDurationMs,
} from '../../src/lib/presentation/engine/clock.ts'
import { cardSeat, containedHole } from '../../src/lib/presentation/engine/geometry.ts'
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

  test('step durations: ask adds the beat, hover rests, bare acts dwell', () => {
    const ask = { id: 'a', anchorId: 'listen-paste', act: 'ask', question: bi('Where does it go?', '¿Adónde va?') }
    assert.equal(stepDurationMs(ask, 'en'), captionDurationMs(ask.question, 'en') + ASK_BEAT_MS)
    const hover = { id: 'h', anchorId: 'listen-play', act: 'hover' }
    assert.equal(stepDurationMs(hover), HOVER_REST_MS)
    const tap = { id: 't', anchorId: 'listen-play', act: 'tap' }
    assert.equal(stepDurationMs(tap), ACTION_BEAT_MS)
  })

  test('module duration + label come from the one calibration, per language', () => {
    const script = sampleModule()
    // EN: s1 7 words → 3280 · s2 7 words → 3280 · s3 5 words → 2600
    assert.equal(moduleDurationMs(script, 'en'), 3280 + 3280 + 2600)
    // ES: s1 7 → 3280 · s2 9 → 3960 · s3 5 → 2600
    assert.equal(moduleDurationMs(script, 'es'), 3280 + 3960 + 2600)
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
    timer.advance(500) // 1500 presentation ms remain
    clock.setSpeed(2) // remainder now runs at 2× → 750 wall ms
    timer.advance(749)
    assert.equal(firedAt, null)
    timer.advance(1)
    assert.equal(firedAt, 1250)
  })

  test('pause holds a wait without consuming it', () => {
    const timer = new FakeTimer()
    const clock = createPresentationClock(timer)
    let fired = false
    clock.after(1000, () => {
      fired = true
    })
    timer.advance(400)
    clock.pause()
    timer.advance(10_000)
    assert.equal(fired, false)
    clock.resume()
    timer.advance(599)
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
    timer.advance(400)
    clock.beginSpeedChoice()
    assert.equal(clock.speedChoiceOpen, true)
    timer.advance(10_000)
    assert.equal(fired, false)
    clock.setSpeed(2) // the choice itself, made inside the hold
    clock.endSpeedChoice()
    timer.advance(299) // 600 presentation ms remain at 2× → 300 wall ms
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
    timer.advance(400)
    clock.beginHold()
    assert.equal(clock.holdOpen, true)
    timer.advance(60_000)
    assert.equal(fired, false, 'a held clock does not consume the wait')
    clock.endHold()
    timer.advance(599)
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
    timer2.advance(1000)
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
    timer.advance(stepDurationMs(script.scenes[0].steps[0], 'en'))
    assert.equal(runner.getSnapshot().current?.step.id, 's2')
    timer.advance(stepDurationMs(script.scenes[0].steps[1], 'en'))
    assert.equal(runner.getSnapshot().current?.step.id, 's3')
    timer.advance(stepDurationMs(script.scenes[0].steps[2], 'en'))
    const done = runner.getSnapshot()
    assert.equal(done.status, 'done')
    assert.equal(done.endReason, 'completed')
    assert.equal(done.progress.state, 'seen')

    const file = JSON.parse(storage.getItem(PRESENTATION_STATE_KEY))
    assert.deepEqual(Object.keys(file).sort(), ['modules', 'myScenes', 'speed'])
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
    timer.advance(stepDurationMs(script.scenes[0].steps[0], 'en')) // → s2
    runner.setMode('interactive')
    assert.equal(runner.getSnapshot().status, 'interactive-wait')
    assert.equal(runner.getSnapshot().current?.step.id, 's2')
    timer.advance(60_000)
    assert.equal(runner.getSnapshot().current?.step.id, 's2')
    runner.setMode('automatic')
    assert.equal(runner.getSnapshot().status, 'playing')
    assert.equal(runner.getSnapshot().current?.step.id, 's2')
    timer.advance(stepDurationMs(script.scenes[0].steps[1], 'en'))
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
    timer.advance(stepDurationMs(script.scenes[0].steps[0], 'en') / 2)
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
    timer.advance(1000) // part-way into s1's caption life
    runner.requestStayHere()
    assert.equal(runner.getSnapshot().stayWindowOpen, true)
    assert.equal(runner.getSnapshot().status, 'playing')
    timer.advance(60_000)
    assert.equal(runner.getSnapshot().current?.step.id, 's1', 'in Automatic the lesson must not advance behind the window')
    runner.cancelStayHere()
    assert.equal(runner.getSnapshot().stayWindowOpen, false)
    timer.advance(s1Ms - 1000 - 1)
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
    timer.advance(stepDurationMs(script.scenes[0].steps[0], 'en'))
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
    for (const step of script.scenes[0].steps) timer.advance(stepDurationMs(step, 'en'))
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
    timer.advance(1000) // part-way into s1's caption life
    runner.requestClose()
    assert.equal(runner.getSnapshot().closeWindowOpen, true)
    assert.equal(runner.getSnapshot().status, 'playing')
    timer.advance(60_000)
    assert.equal(runner.getSnapshot().current?.step.id, 's1', 'in Automatic the lesson must not advance behind the ✕ window')
    runner.cancelClose()
    assert.equal(runner.getSnapshot().closeWindowOpen, false)
    timer.advance(s1Ms - 1000 - 1)
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
    for (const step of script.scenes[0].steps) timer.advance(stepDurationMs(step, 'en'))
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
    timer.advance(stepDurationMs(script.scenes[0].steps[0], 'en'))
    assert.equal(runner.getSnapshot().current?.step.id, 's2')
    assert.equal(read().lastUsed, 'engine-probe', '…and rides every advance')
    timer.advance(stepDurationMs(script.scenes[0].steps[1], 'en'))
    timer.advance(stepDurationMs(script.scenes[0].steps[2], 'en'))
    assert.equal(runner.getSnapshot().progress.state, 'seen')
    const file = read()
    assert.equal('lastUsed' in file, false, 'completion clears the mark — the key itself leaves the file')
    assert.deepEqual(Object.keys(file).sort(), ['modules', 'myScenes', 'speed'])
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
      myScenes: [{ module: 'Q1', scene: 'reader', step: 3, stepId: 'q1-s4', savedAt: '2026-11-14T09:00:00.000Z' }],
      lastUsed: 'Q1',
    }
    savePresentationState(storage, state)
    assert.deepEqual(loadPresentationState(storage), state)
    assert.equal(loadPresentationState(storage).modules.Q1.state, 'in-progress')
  })

  test('a corrupt or foreign state file degrades to the empty state, never throws', () => {
    const storage = new FakeStorage()
    storage.setItem(PRESENTATION_STATE_KEY, '{not json')
    assert.deepEqual(loadPresentationState(storage), { modules: {}, speed: 1, myScenes: [] })
    assert.deepEqual(normalizePresentationState({ speed: 3, modules: 'x', myScenes: [42] }), {
      modules: {},
      speed: 1,
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
    const runner = createPresentationRunner(sampleModule(), {
      clock: createPresentationClock(new FakeTimer()),
      resolver: fakeResolver(),
      storage,
      scenarioPort: port,
      initialMode: 'interactive',
      now: () => 1_762_902_000_000,
    })
    runner.start()
    runner.showMe() // performs s1 through the port, then advances
    assert.deepEqual(performed, ['s1'])
    assert.equal(scenario.stage.session()?.textId, TEXT_EN.id, 'the act landed on the scenario, nowhere else')
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
    const runner = createPresentationRunner(clipModule, {
      clock: createPresentationClock(new FakeTimer()),
      resolver: fakeResolver(),
      storage: new FakeStorage(),
      scenario, // no port injected → the default scenario port is built
      now: () => 1_762_902_000_000,
    })
    runner.start()
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
    for (let i = 0; i < undoAt; i++) timer.advance(stepDurationMs(flat[i].step, 'en'))
    assert.equal(runner.getSnapshot().current?.step.id, 's3-undo-tap')
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
    assert.equal(emits[emits.length - 1].at, 2600 + 2600, 'total time is the two live beats only: 3 dead anchors ≪ 3 × any wait')
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

  test('a focus flush with the BOTTOM edge: the hole ends at vh − 4, never past the screen', () => {
    // The Brizna defect, staged: a bottom-bar control whose own bottom is
    // the viewport's bottom (844). The old ±10px hole ended at 854.
    const hole = containedHole({ top: 780, left: 24, width: 72, height: 64 }, VW, VH)
    const e = edges(hole)
    assert.equal(e.bottom, VH - 4)
    assert.equal(e.top, 770, 'the air above the focus is untouched')
    assert.ok(e.left >= 4 && e.right <= VW - 4)
  })

  test('a focus flush with the RIGHT edge: the hole ends at vw − 4', () => {
    const hole = containedHole({ top: 320, left: 318, width: 72, height: 52 }, VW, VH)
    const e = edges(hole)
    assert.equal(e.right, VW - 4)
    assert.equal(e.left, 308, 'the air left of the focus is untouched')
    assert.ok(e.top >= 4 && e.bottom <= VH - 4)
  })

  test('top and left edges compress the same way (the frame never starts off-screen)', () => {
    const hole = containedHole({ top: 0, left: 0, width: 60, height: 44 }, VW, VH)
    const e = edges(hole)
    assert.equal(e.top, 4)
    assert.equal(e.left, 4)
    assert.equal(e.bottom, 54)
    assert.equal(e.right, 70)
  })

  test('a corner focus (bottom-right) is contained on both axes at once', () => {
    const hole = containedHole({ top: 800, left: 330, width: 60, height: 44 }, VW, VH)
    const e = edges(hole)
    assert.deepEqual(e, { left: 320, top: 790, right: VW - 4, bottom: VH - 4 })
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
