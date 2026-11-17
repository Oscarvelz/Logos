/**
 * lambda-guarantee-8th.probe.mjs — Round 2, Track 6: the λ guarantee's
 * 8TH SPECIMEN, flipped by the Friend-Rule cure (R2-T6-4).
 *
 * Companion to the in-tree guarantee probe
 * (scripts/presentation/lambda-guarantee.probe.mjs, specimens
 * 1–7). The hunt's specimen
 * (probe-lambda-opening-tap.mjs) broke the guarantee through a door the
 * seven never drove: during P1's opening phase the stage renders
 * unshielded and its λ button is a live presented-path write — a tap
 * before «Empezar» writes the real switch, and a kill there leaves it
 * flipped; a polite tap inverts Q2's own tap beat.
 *
 * THE CURE (two halves):
 * - the runner holds the scenario in seed-mode across the whole
 *   opening phase (the opening shield): any stage λ act in the phase
 *   absorbs into the fiction ledger only, and confirmStart restores
 *   the ledger to the value entry seeding left before releasing the
 *   shield — the lesson starts from exactly the state its entry built;
 * - the player renders the stage behind a pointer-events shield while
 *   the opening window stands, so no stage control answers a finger
 *   before the lesson is confirmed (proven here at the scenario door
 *   the button itself calls; the DOM half is by construction in
 *   presentation-player.tsx's opening return).
 *
 * Assertions are on the spy's CALL LOG, like the family it joins.
 * Exit 0 = the 8th specimen holds.
 */
import { savePresentationState } from '../../src/lib/presentation/presentation-state.ts'
import { createScenario } from '../../src/lib/presentation/scenario/index.ts'
import { createPresentationClock } from '../../src/lib/presentation/engine/clock.ts'
import { createPresentationRunner } from '../../src/lib/presentation/engine/runner.ts'
import { createScenarioPort } from '../../src/lib/presentation/engine/scenario-port.ts'
import { flattenSteps } from '../../src/lib/presentation/engine/types.ts'
import { anchorById } from '../../src/lib/presentation/anchors.ts'
import { Q2 } from '../../src/lib/presentation/scripts/q2.ts'

class FakeTimer {
  constructor() { this.nowMs = 0; this.nextId = 1; this.timers = new Map() }
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
const resolveAll = (step) => ({ status: 'resolved', record: anchorById(step.anchorId), target: {} })
const idxOf = (stepId) => flattenSteps(Q2).find((f) => f.step.id === stepId).globalIndex

function launch(storage = new FakeStorage()) {
  const timer = new FakeTimer()
  const spy = { value: false, calls: [], getBubbleOn() { return this.value }, setBubbleOn(v) { this.calls.push(v); this.value = v } }
  const scenario = createScenario({ lambdaPort: spy })
  const runner = createPresentationRunner(Q2, {
    clock: createPresentationClock(timer),
    resolver: resolveAll,
    storage,
    scenarioPort: createScenarioPort(scenario),
    initialMode: 'interactive',
    now: () => 1_762_902_000_000,
    appVersion: '1.4.186',
  })
  return { runner, timer, scenario, spy, storage }
}
/** EXACTLY the stage λ button's onClick body (presentation-stage.tsx). */
const stageLambdaTap = (scenario) => scenario.stage.setLambda(!scenario.stage.lambdaOn())

let failures = 0
const check = (label, ok, detail) => { console.log(`  ${ok ? '✔' : '✘ BREAK'} ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failures += 1 }

console.log('\n[control] an untouched opening phase writes nothing')
{
  const { runner, spy } = launch()
  runner.prepare()
  check('zero real calls during prepare', spy.calls.length === 0, `calls=${JSON.stringify(spy.calls)}`)
  runner.abortClean()
  check('zero real calls after the clean abort', spy.calls.length === 0, `calls=${JSON.stringify(spy.calls)}`)
}

console.log('\n[specimen A — the 8th] stage λ tap during the opening phase, then a kill (no teardown)')
{
  const { runner, scenario, spy } = launch()
  runner.prepare()
  check('the opening phase stands', runner.getSnapshot().opening === true)
  stageLambdaTap(scenario)
  check('NO real write before «Empezar»', spy.calls.length === 0, `calls=${JSON.stringify(spy.calls)}`)
  check('after the kill the switch stands at its entry value', spy.value === false, `value=${spy.value}`)
}

console.log('\n[specimen B — the 8th] stage λ tap during opening, then «Empezar»: the lesson teaches straight')
{
  const { runner, timer, scenario, spy } = launch()
  runner.prepare()
  stageLambdaTap(scenario)
  runner.confirmStart()
  runner.next() // onto s1-tap-lambda — the beat that turns λ ON
  const at = runner.getSnapshot().current?.step.id
  runner.showMe()
  timer.advance(60_000)
  const snap = runner.getSnapshot()
  check('standing on the tap beat', at === 's1-tap-lambda', `at=${at}`)
  check('after the tap beat, the ledger stands ON (as its caption teaches)', scenario.stage.lambdaOn() === true,
    `lambdaOn=${scenario.stage.lambdaOn()}`)
  check('the only real write is the lesson’s own presented tap', JSON.stringify(spy.calls) === '[true]',
    `calls=${JSON.stringify(spy.calls)}`)
  check('the gold-dot beat is reached with the dot lit', snap.current?.step.id !== 's1-gold-dot' || scenario.stage.lambdaOn() === true,
    `at=${snap.current?.step.id} lambdaOn=${scenario.stage.lambdaOn()}`)
}

console.log('\n[specimen C — strength] a resumed entry: a stage tap behind the window cannot unbuild the seeded fiction')
{
  const storage = new FakeStorage()
  savePresentationState(storage, {
    modules: {
      Q2: { state: 'in-progress', step: idxOf('s2-meet'), scene: 'copy-tap-listen', stepId: 's2-meet', verifiedAgainst: '1.4.186', skips: [] },
    },
    speed: 1, speedScale: 2, myScenes: [],
  })
  const { runner, scenario, spy } = launch(storage)
  runner.prepare()
  check('seeding lit the ledger with zero real writes', scenario.stage.lambdaOn() === true && spy.calls.length === 0,
    `lambdaOn=${scenario.stage.lambdaOn()} calls=${JSON.stringify(spy.calls)}`)
  stageLambdaTap(scenario) // the curious finger: ledger flips off, absorbed
  check('the tap behind the window wrote nothing real', spy.calls.length === 0, `calls=${JSON.stringify(spy.calls)}`)
  runner.confirmStart()
  check('confirm restored the seeded ledger (ON)', scenario.stage.lambdaOn() === true, `lambdaOn=${scenario.stage.lambdaOn()}`)
  check('still zero real writes', spy.calls.length === 0, `calls=${JSON.stringify(spy.calls)}`)
  runner.abort()
  check('the exit restores the entry value (no call needed — it never moved)', spy.value === false, `value=${spy.value}`)
}

console.log('\n[specimen D — strength] the stage λ keeps its real hand DURING the lesson (T6-11 stands)')
{
  const { runner, scenario, spy } = launch()
  runner.prepare()
  runner.confirmStart()
  stageLambdaTap(scenario) // mid-lesson, the learner's own hand on the stage λ
  check('a presented stage tap writes the real switch', JSON.stringify(spy.calls) === '[true]', `calls=${JSON.stringify(spy.calls)}`)
  runner.abort()
  check('the exit restores the entry value', spy.value === false && JSON.stringify(spy.calls) === '[true,false]',
    `value=${spy.value} calls=${JSON.stringify(spy.calls)}`)
}

console.log(failures === 0 ? '\nHELD: the 8th specimen — the opening phase cannot touch the switch, and the lesson’s hand is real' : `\nBROKEN: ${failures} assertion(s)`)
process.exit(failures === 0 ? 0 : 1)
