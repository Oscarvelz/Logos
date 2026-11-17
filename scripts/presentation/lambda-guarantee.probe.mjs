/**
 * lambda-guarantee.probe.mjs — the merged tree's λ guarantee (INTEGRATION
 * MAP §17/§19.7), proven against the real runner + real Q2 + the real
 * scenario port, with a spy LambdaPort recording every real write.
 *
 * THE GUARANTEE: after ANY entry (fresh start, resume, chapter jump,
 * «Watch» landing) and ANY exit (completion, abort, stay-here, unmount),
 * the user's real bubble switch stands at exactly the value it held when
 * the presentation was launched; no seeding or replay path ever writes
 * it; and while a lesson is presented, the switch shows exactly the
 * fiction ledger's taught state.
 *
 * Assertions are on the CALL LOG, not end state alone — an end state can
 * be right by accident (the pre-merge read-through lambdaOn() made a
 * replayed toggle's meaning depend on the real switch's position).
 *
 * Run: node scripts/presentation/lambda-guarantee.probe.mjs
 * Exit 0 = the guarantee holds. Any ✘ = the merge is not done.
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

const resolveAll = (step) => ({ status: 'resolved', record: anchorById(step.anchorId), target: {} })

const idxOf = (script, stepId) => {
  const found = flattenSteps(script).find((f) => f.step.id === stepId)
  if (!found) throw new Error(`probe: no step ${stepId}`)
  return found.globalIndex
}

/** A spy LambdaPort: `value` is the user's real switch; `calls` is the log. */
function spyPort(entry) {
  return {
    value: entry,
    calls: [],
    getBubbleOn() {
      return this.value
    },
    setBubbleOn(v) {
      this.calls.push(v)
      this.value = v
    },
  }
}

function launch({ spy, storage = new FakeStorage(), mode = 'interactive' }) {
  const timer = new FakeTimer()
  const scenario = createScenario({ lambdaPort: spy })
  const port = createScenarioPort(scenario)
  const runner = createPresentationRunner(Q2, {
    clock: createPresentationClock(timer),
    resolver: resolveAll,
    storage,
    scenarioPort: port,
    initialMode: mode,
    now: () => 1_762_902_000_000,
    appVersion: '1.4.186',
  })
  return { runner, timer, scenario }
}

/** Plant the progress record of a prior run standing at `stepId`. */
function plantPlace(stepId) {
  const storage = new FakeStorage()
  const flat = flattenSteps(Q2)
  const at = flat[idxOf(Q2, stepId)]
  savePresentationState(storage, {
    modules: {
      [Q2.id]: {
        state: 'in-progress',
        step: at.globalIndex,
        scene: at.scene.id,
        stepId,
        verifiedAgainst: Q2.verifiedAgainst,
        skips: [],
      },
    },
    speed: 1,
    speedScale: 2,
    myScenes: [],
    lastUsed: Q2.id,
  })
  return storage
}

let failures = 0
const check = (label, ok, detail) => {
  console.log(`  ${ok ? '✔' : '✘ GUARANTEE BROKEN'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}
const callsEq = (spy, expected) =>
  spy.calls.length === expected.length && spy.calls.every((v, i) => v === expected[i])

/* (a) Resume past the λ tap: seeding writes NOTHING; the ledger reports
 *     the taught state. */
console.log('\n(a) resume preloaded past s1-tap-lambda → zero real calls, taught state reported')
{
  const spy = spyPort(false)
  const { runner, scenario } = launch({ spy, storage: plantPlace('s1-gold-dot') })
  runner.start()
  check('zero setBubbleOn calls during entry seeding', callsEq(spy, []), `calls=${JSON.stringify(spy.calls)}`)
  check('lambdaOn() reports the taught state (on)', scenario.stage.lambdaOn() === true)
  check('the real switch never moved', spy.value === false)
  runner.abort()
  check('abort after a seeded resume writes nothing either', callsEq(spy, []), `calls=${JSON.stringify(spy.calls)}`)
}

/* (b)+(c) The presented tap writes the absolute; abort restores entry. */
console.log('\n(b,c) presented tap → [true]; abort → [true, false], switch back at entry')
{
  const spy = spyPort(false)
  const { runner, scenario } = launch({ spy })
  runner.start()
  runner.next() // past the ask, onto s1-tap-lambda
  const at = runner.getSnapshot().current?.step.id
  check('standing on the λ tap beat', at === 's1-tap-lambda', `at=${at}`)
  runner.showMe() // «Show me» performs the tap through the port
  check('the presented tap wrote the absolute [true]', callsEq(spy, [true]), `calls=${JSON.stringify(spy.calls)}`)
  check('the real switch flipped (the demonstration is genuine)', spy.value === true)
  check('the ledger agrees', scenario.stage.lambdaOn() === true)
  runner.abort()
  check('abort restored entry: calls [true, false]', callsEq(spy, [true, false]), `calls=${JSON.stringify(spy.calls)}`)
  check('the real switch stands at entry (off)', spy.value === false)
}

/* (d) Entry = true: the exit leaves the switch at true. */
console.log('\n(d) entry true → after the lesson and its exit the switch stands at true')
{
  const spy = spyPort(true)
  const { runner } = launch({ spy })
  runner.start()
  runner.next()
  runner.showMe()
  runner.abort()
  check('the real switch stands at entry (on)', spy.value === true, `calls=${JSON.stringify(spy.calls)}`)
}

/* (e) Full Automatic completion: exactly [true, false]. */
console.log('\n(e) full Automatic run → exactly [true, false], module done')
{
  const spy = spyPort(false)
  const { runner, timer } = launch({ spy, mode: 'automatic' })
  runner.start()
  for (let i = 0; i < 1200 && runner.getSnapshot().status !== 'done'; i++) timer.advance(1000)
  const snap = runner.getSnapshot()
  check('the module completed', snap.status === 'done', `status=${snap.status}`)
  check('exactly [true, false] for the whole run', callsEq(spy, [true, false]), `calls=${JSON.stringify(spy.calls)}`)
  check('the real switch stands at entry (off)', spy.value === false)
}

/* (f) The P14 kill specimen: kill after the presented tap (no teardown),
 *     relaunch + resume → no toggle call, the switch stands at the taught
 *     value while presented, teardown returns it to the relaunch entry. */
console.log('\n(f) kill mid-lesson, relaunch + resume → no new calls, no inversion')
{
  const spy = spyPort(false)
  const first = launch({ spy })
  first.runner.start()
  first.runner.next()
  first.runner.showMe()
  check('the tap landed before the kill', callsEq(spy, [true]), `calls=${JSON.stringify(spy.calls)}`)
  // KILL: no abort, no teardown — the process simply dies here. The real
  // switch stands flipped (true) in the world the relaunch inherits.
  const second = launch({ spy, storage: plantPlace('s1-gold-dot') })
  second.runner.start()
  check('resume seeding made NO call (no toggle, no replay write)', callsEq(spy, [true]), `calls=${JSON.stringify(spy.calls)}`)
  check('the ledger reports the taught state', second.scenario.stage.lambdaOn() === true)
  check('the switch stands at the taught value while presented', spy.value === true)
  second.runner.abort()
  check('teardown of the relaunched lesson writes nothing (already at its entry)', callsEq(spy, [true]), `calls=${JSON.stringify(spy.calls)}`)
  check('the switch stands at the relaunch entry (on)', spy.value === true)
}

/* (g) goToStep — the other seeding door — also writes nothing. */
console.log('\n(g) chapters jump (goToStep) past the λ tap → zero real calls')
{
  const spy = spyPort(false)
  const { runner, scenario } = launch({ spy })
  runner.start()
  runner.goToStep(idxOf(Q2, 's2-meet'))
  check('zero setBubbleOn calls during jump seeding', callsEq(spy, []), `calls=${JSON.stringify(spy.calls)}`)
  check('lambdaOn() reports the taught state (on)', scenario.stage.lambdaOn() === true)
  runner.abort()
}

console.log(failures === 0 ? '\nλ GUARANTEE: HOLDS (all seven specimens)' : `\nλ GUARANTEE: ${failures} assertion(s) BROKEN`)
process.exit(failures === 0 ? 0 : 1)
