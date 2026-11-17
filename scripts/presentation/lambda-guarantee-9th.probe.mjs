/**
 * lambda-guarantee-9th.probe.mjs — the λ guarantee's NINTH specimen
 * (adopted from the Round-3 hunt, R3-T6-3; the cure stands in
 * scenario.ts: the stage's λ verbs check `tornDown` first and write
 * nothing once the scenario is discarded).
 *
 * Specimens 1–7 (lambda-guarantee.probe.mjs) and the 8th
 * (lambda-guarantee-8th.probe.mjs) cover entries, exits, jumps,
 * resumes, kills MID-lesson, and the opening phase. None of them
 * touches the stage AFTER the lesson ends.
 *
 * The shape they miss: the DONE screen. finishCompleted tears the
 * scenario down (the switch restored), but the player keeps the
 * fiction stage MOUNTED behind the done card — no veil (the veil
 * paints only while `active`), no shield (the shield is the opening
 * phase's) — and the stage's own λ button is a plain button wired
 * straight to scenario.stage.setLambda. Before the cure,
 * scenario.teardown() did NOT disarm that wire: a tap on the done
 * screen wrote the REAL switch with no lesson alive to own the
 * write and no teardown left to restore it. A polite exit was saved
 * by the host's compare-then-write net; a kill from the done screen
 * (the natural end of every lesson — the learner reads the card,
 * taps the medallion the lesson just taught, closes the app) leaked
 * the flip permanently.
 *
 * Legs:
 *  A (unit) — after scenario.teardown(), stage.setLambda reaches
 *     nothing: the LambdaPort sees no call.
 *  B (the specimen) — full Automatic Q2 run to done (the switch at
 *     entry), then the done-screen stage tap (the stage button's
 *     exact onClick body), then a KILL: the switch stands at entry.
 *  C (control) — the same tap followed by a POLITE exit (the host
 *     net: compare-then-write) restores — the net is now a second
 *     wall, no longer the only thing standing.
 */
import { createScenario } from '../../src/lib/presentation/scenario/index.ts'
import { createPresentationClock } from '../../src/lib/presentation/engine/clock.ts'
import { createPresentationRunner } from '../../src/lib/presentation/engine/runner.ts'
import { createScenarioPort } from '../../src/lib/presentation/engine/scenario-port.ts'
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
const makeSpy = () => ({ value: false, calls: [], getBubbleOn() { return this.value }, setBubbleOn(v) { this.calls.push(v); this.value = v } })

let failures = 0
const check = (label, ok, detail) => { console.log(`  ${ok ? '✔' : '✘ BREAK'} ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failures += 1 }

console.log('[A] unit: the wire after teardown')
{
  const spy = makeSpy()
  const scenario = createScenario({ lambdaPort: spy })
  scenario.teardown()
  console.log(`  after teardown: calls=${JSON.stringify(spy.calls)}`)
  scenario.stage.setLambda(true) // the stage button's verb, after the scenario is gone
  check('a post-teardown stage tap writes NOTHING real', spy.calls.length === 0, `calls=${JSON.stringify(spy.calls)} value=${spy.value}`)
}

console.log('\n[B] the specimen: entry ON → Q2 to done → done-screen stage tap → kill')
{
  const timer = new FakeTimer()
  const storage = new FakeStorage()
  const spy = makeSpy()
  spy.value = true // the user's switch stands ON at entry
  const scenario = createScenario({ lambdaPort: spy })
  const runner = createPresentationRunner(Q2, {
    clock: createPresentationClock(timer),
    resolver: resolveAll,
    storage,
    scenarioPort: createScenarioPort(scenario),
    initialMode: 'automatic',
    now: () => 1_762_902_000_000,
    appVersion: '1.4.190',
  })
  runner.start()
  for (let i = 0; i < 2000 && runner.getSnapshot().status !== 'done'; i++) timer.advance(1000)
  const snap = runner.getSnapshot()
  check('the lesson completed', snap.status === 'done', `status=${snap.status}`)
  check('the run + teardown left the switch at entry (on)', spy.value === true, `calls=${JSON.stringify(spy.calls)}`)
  // The done screen: the stage stands mounted behind the done card.
  // Its λ button's exact onClick body (presentation-stage.tsx:62):
  scenario.stage.setLambda(!scenario.stage.lambdaOn())
  check('the done-screen tap wrote nothing real (no lesson is alive)', spy.value === true, `calls=${JSON.stringify(spy.calls)} value=${spy.value}`)
  // KILL: no exit tap, no unmount cleanup — the process is gone.
  check('after the kill the switch stands at its entry value', spy.value === true, `value=${spy.value} calls=${JSON.stringify(spy.calls)}`)
}

console.log('\n[C] control: the same tap, then a polite exit — the host net restores')
{
  const spy = makeSpy()
  const scenario = createScenario({ lambdaPort: spy })
  scenario.teardown()
  scenario.stage.setLambda(true)
  // The host's onExit net (presentation-host.tsx): compare-then-write.
  if (spy.getBubbleOn() !== false) spy.setBubbleOn(false)
  check('the polite exit restores (the net catches what the wire let through)', spy.value === false, `calls=${JSON.stringify(spy.calls)}`)
}

console.log(failures === 0 ? '\nHELD: the 9th specimen — the stage goes silent when the lesson ends' : `\nBROKEN: ${failures} assertion(s) — the λ wire outlives its lesson`)
process.exit(failures === 0 ? 0 : 1)
