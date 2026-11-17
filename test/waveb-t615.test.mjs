// T6-15 probe: overall progress credits only COMPLETED steps.
// Run: node --test test/waveb-t615.test.mjs
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { anchorById } from '../src/lib/presentation/anchors.ts'
import { overallProgress } from '../src/lib/presentation/catalogue.ts'
import {
  PRESENTATION_STATE_KEY,
  emptyPresentationState,
  withModuleProgress,
  withWatchLanding,
} from '../src/lib/presentation/presentation-state.ts'
import '../src/lib/presentation/scripts/index.ts'
import { createPresentationClock } from '../src/lib/presentation/engine/clock.ts'
import { createPresentationRunner } from '../src/lib/presentation/engine/runner.ts'

class FakeTimer {
  constructor() { this.nowMs = 0; this.timers = new Map(); this.nextId = 1 }
  now = () => this.nowMs
  setTimeout = (cb, ms) => { const id = this.nextId++; this.timers.set(id, { at: this.nowMs + ms, cb }); return id }
  clearTimeout = (id) => { this.timers.delete(id) }
  advance(ms) {
    const end = this.nowMs + ms
    for (;;) {
      let next = null
      for (const [id, t] of this.timers) if (t.at <= end && (!next || t.at < next.t.at)) next = { id, t }
      if (!next) break
      this.nowMs = next.t.at; this.timers.delete(next.id); next.t.cb()
    }
    this.nowMs = end
  }
}
class FakeStorage {
  constructor() { this.bytes = new Map() }
  getItem = (k) => this.bytes.get(k) ?? null
  setItem = (k, v) => { this.bytes.set(k, String(v)) }
}
const bi = (en, es) => ({ en, es })
function sampleModule() {
  return {
    id: 'engine-probe', floor: 'quick',
    title: bi('Engine probe', 'Sonda del motor'),
    capability: bi('You can work the engine probe.', 'Puedes usar la sonda del motor.'),
    verifiedAgainst: '1.4.156',
    scenes: [{ id: 'opening', chapter: bi('Opening', 'Apertura'), steps: [
      { id: 's1', anchorId: 'listen-paste', act: 'tap', text: bi('Tap Paste.', 'Toca Pegar.') },
      { id: 's2', anchorId: 'listen-play', act: 'tap', text: bi('Tap Play.', 'Toca Reproducir.') },
      { id: 's3', anchorId: 'listen-editor', act: 'say', text: bi('That is the whole probe.', 'Eso es toda la sonda.') },
    ] }],
  }
}
const fakeResolver = () => (step) => {
  const record = anchorById(step.anchorId)
  return { status: 'resolved', record, target: {} }
}
function makeRunner(storage, script = sampleModule()) {
  return createPresentationRunner(script, {
    clock: createPresentationClock(new FakeTimer()),
    resolver: fakeResolver(),
    storage,
    initialMode: 'interactive',
    now: () => 1_762_902_000_000,
    appVersion: '1.4.156',
  })
}
const recordOf = (storage, id) => JSON.parse(storage.getItem(PRESENTATION_STATE_KEY)).modules[id]

describe('T6-15 — overallProgress credits completed steps only', () => {
  test('the hunt specimen: a «Watch» landing at Q2 step 30 of 37 credits nothing', () => {
    const landed = withWatchLanding(emptyPresentationState(), 'Q2', { step: 30, scene: 'q2-save', stepId: 'x' }, '1.4.156')
    assert.deepEqual(landed.modules.Q2.done, [], 'the landing record carries an empty done set')
    assert.equal(overallProgress(landed).percent, 0, 'zero beats completed → zero walked')
  })

  test('a done set counts exactly its length; a legacy record keeps its word', () => {
    const done17 = Array.from({ length: 17 }, (_, i) => i)
    const withDone = withModuleProgress(emptyPresentationState(), 'Q2', {
      state: 'in-progress', step: 17, verifiedAgainst: '1.4.156', skips: [], done: done17,
    })
    const legacy = withModuleProgress(emptyPresentationState(), 'Q2', {
      state: 'in-progress', step: 17, verifiedAgainst: '1.4.156', skips: [],
    })
    assert.equal(overallProgress(withDone).percent, overallProgress(legacy).percent,
      'done=[0..16] at point 17 equals the legacy credit of 17/37')
    assert.ok(overallProgress(withDone).percent > 0)
    const noneDone = withModuleProgress(emptyPresentationState(), 'Q2', {
      state: 'in-progress', step: 30, verifiedAgainst: '1.4.156', skips: [], done: [],
    })
    assert.equal(overallProgress(noneDone).percent, 0, 'an explicit empty done set at point 30 credits nothing')
  })
})

describe('T6-15 — the runner writes the done set from lived walks only', () => {
  test('a full walk completes every step, in order', () => {
    const storage = new FakeStorage()
    const runner = makeRunner(storage)
    runner.start()
    runner.userAct() // s1 lived → s2 on stage
    assert.deepEqual(recordOf(storage, 'engine-probe').done, [0], 'leaving s1 for s2 completes s1')
    runner.userAct() // s2 lived → s3 on stage
    assert.deepEqual(recordOf(storage, 'engine-probe').done, [0, 1])
    runner.userAct() // s3 lived → the run finishes on it
    const rec = recordOf(storage, 'engine-probe')
    assert.deepEqual(rec.done, [0, 1, 2], 'the finish completes the final step')
    assert.equal(rec.state, 'seen')
  })

  test('a landing at the last step completes ONLY that step', () => {
    const storage = new FakeStorage()
    const runner = makeRunner(storage)
    runner.start({ resumeFrom: { step: 2, scene: 'opening', stepId: 's3' } })
    if (runner.getSnapshot().opening) runner.confirmStart()
    assert.equal(runner.getSnapshot().current?.step.id, 's3')
    runner.userAct() // s3 lived → finish
    const rec = recordOf(storage, 'engine-probe')
    assert.deepEqual(rec.done, [2], 'steps 0–1 were landed over, never walked — no credit')
  })
})
