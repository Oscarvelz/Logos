/**
 * entry-seeding-bench.mjs — the bench for Oscar's two-defect chain
 * (caught on his phone in Brizna, 2026-11-14 17:09 EST; every lane
 * ordered to check its own engine):
 *
 *   A) MID-MODULE ENTRY DOESN'T SEED — entering at an intermediate
 *      scene (resume / chapter jump) never executes the scenario acts
 *      of the earlier scenes, so the fiction the later scenes teach
 *      doesn't exist.
 *   B) BLIND SKIPPING — each dead anchor costs its full wait with the
 *      card invisible (Brizna: 2.2 s × N of lesson-less screen).
 *
 * Run: node scripts/presentation/entry-seeding-bench.mjs
 *
 * The bench drives the REAL runner + REAL scripts (Q2, AD1) + the REAL
 * default scenario port over a REAL fresh scenario (the host creates
 * one fresh per launch — presentation-player.tsx's wiring contract),
 * with the test fakes for clock/storage/resolver. It prints, per case:
 * the fiction state found at the target beat, how many scenario acts
 * the entry itself executed, and the fake-clock cost of the entry.
 */
import { PRESENTATION_STATE_KEY, savePresentationState } from '../../src/lib/presentation/presentation-state.ts'
import { CLIP_TEXT, TEXT_EN, createScenario } from '../../src/lib/presentation/scenario/index.ts'
import { createPresentationClock } from '../../src/lib/presentation/engine/clock.ts'
import { createPresentationRunner } from '../../src/lib/presentation/engine/runner.ts'
import { createScenarioPort } from '../../src/lib/presentation/engine/scenario-port.ts'
import { flattenSteps } from '../../src/lib/presentation/engine/types.ts'
import { anchorById } from '../../src/lib/presentation/anchors.ts'
import { Q2 } from '../../src/lib/presentation/scripts/q2.ts'
import { AD1 } from '../../src/lib/presentation/scripts/ad1.ts'

/* ── Fakes (the engine.test.mjs pattern) ──────────────────────────── */

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

function idxOf(script, stepId) {
  const flat = flattenSteps(script)
  const found = flat.find((f) => f.step.id === stepId)
  if (!found) throw new Error(`bench: no step ${stepId} in ${script.id}`)
  return found.globalIndex
}

/** Plant exactly the progress record a prior run's markPlace persists. */
function plantPlace(script, stepId) {
  const storage = new FakeStorage()
  const flat = flattenSteps(script)
  const at = flat[idxOf(script, stepId)]
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

/** A runner over a FRESH scenario (per-launch contract), with a tallying port. */
function launch(script, storage, mode = 'interactive') {
  const timer = new FakeTimer()
  const scenario = createScenario()
  const tally = { performs: 0, performedIds: [] }
  const port = createScenarioPort(scenario, (flat) => {
    tally.performs += 1
    tally.performedIds.push(flat.step.id)
  })
  const runner = createPresentationRunner(script, {
    clock: createPresentationClock(timer),
    resolver: resolveAll,
    storage,
    scenarioPort: port,
    initialMode: mode,
    now: () => 1_762_902_000_000,
    appVersion: '1.4.156',
  })
  return { runner, timer, scenario, tally }
}

const sessionDesc = (scenario) => {
  const s = scenario.stage.session()
  if (!s) return 'NO SESSION (nothing is playing — the stage is empty)'
  return `session textId=${s.textId} title="${s.title}" playing=${s.playing} idx=${s.idx}`
}

let failures = 0
const check = (label, ok, detail) => {
  console.log(`  ${ok ? '✔' : '✘ DEFECT'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

/* ── Case 1 · Q2 resume at the Undo beat (defect A) ───────────────── */
/* The Undo only exists because scene 3 first played the harbour text */
/* (s3-setup-playing) and then replaced it (s3-tap-bubble).           */

console.log('\nCASE 1 · Q2 — resume «Sigue donde ibas» at s3-undo-tap (the Undo beat)')
{
  const storage = plantPlace(Q2, 's3-undo-tap')
  const { runner, timer, scenario, tally } = launch(Q2, storage)
  const t0 = timer.nowMs
  runner.start()
  const entryMs = timer.nowMs - t0
  const snap = runner.getSnapshot()
  console.log(`  landed on: ${snap.current?.step.id} · status ${snap.status} · entry cost ${entryMs} fake ms`)
  console.log(`  scenario acts executed BY THE ENTRY: ${tally.performs} (${tally.performedIds.join(', ') || 'none'})`)
  console.log(`  λ in the scenario: ${scenario.getSettings().bubbleOn} (scene 1's tap turns it on)`)
  console.log(`  fiction at the beat: ${sessionDesc(scenario)}`)
  check('the harbour text was replaced by the clip before the Undo beat', scenario.stage.session()?.textId === CLIP_TEXT.id)
  check('λ is on (scene 1 was lived or seeded)', scenario.getSettings().bubbleOn === true)
  runner.showMe() // «Show me» performs the Undo through the port
  const after = scenario.stage.session()
  console.log(`  after the Undo performs: ${sessionDesc(scenario)}`)
  check(
    'the Undo restores the harbour text, loaded and PAUSED (§2.6-1)',
    after?.textId === TEXT_EN.id && after?.playing === false,
    after ? `textId=${after.textId} playing=${after.playing}` : 'no session at all — the Undo had nothing to undo',
  )
  runner.abort()
}

/* ── Case 2 · Q2 chapter jump to the same beat (defect A) ─────────── */

console.log('\nCASE 2 · Q2 — fresh start, chapters jump straight to s3-undo-tap')
{
  const storage = new FakeStorage()
  const { runner, scenario, tally } = launch(Q2, storage)
  runner.start()
  tally.performs = 0
  tally.performedIds = []
  runner.goToStep(idxOf(Q2, 's3-undo-tap'))
  console.log(`  landed on: ${runner.getSnapshot().current?.step.id}`)
  console.log(`  scenario acts executed BY THE JUMP: ${tally.performs} (${tally.performedIds.join(', ') || 'none'})`)
  console.log(`  fiction at the beat: ${sessionDesc(scenario)}`)
  check('the jump seeded the fiction (clip on stage, λ on)', scenario.stage.session()?.textId === CLIP_TEXT.id && scenario.getSettings().bubbleOn === true)
  runner.abort()
}

/* ── Case 3 · AD1 resume at the save beat (defect A, Advanced) ────── */
/* s5-save-tap performs saveCurrentToLibrary — it needs the session   */
/* scene 3's s3-setup created by loading the harbour text.            */

console.log('\nCASE 3 · AD1 — resume at s5-save-tap (saves what is playing)')
{
  const storage = plantPlace(AD1, 's5-save-tap')
  const { runner, scenario, tally } = launch(AD1, storage)
  runner.start()
  console.log(`  landed on: ${runner.getSnapshot().current?.step.id} · acts executed by the entry: ${tally.performs}`)
  console.log(`  fiction at the beat: ${sessionDesc(scenario)}`)
  check('the harbour text is playing (scene 3 was lived or seeded)', scenario.stage.session()?.textId === TEXT_EN.id)
  runner.showMe() // performs the save through the port
  await Promise.resolve()
  const clips = await scenario.library.listClips()
  const saved = clips.filter((c) => c.id.includes('clip-saved'))
  console.log(`  scenario Library after the save beat: ${clips.length} clips, ${saved.length} saved by the lesson`)
  check('the save landed a clip in the scenario Library', saved.length === 1)
  runner.abort()
}

/* ── Case 4 · three consecutive dead anchors (defect B) ───────────── */
/* Brizna's price: 2.2 s each ≈ 6.6 s of lesson-less screen. Logos's  */
/* price is measured here against the fake clock, snapshot by        */
/* snapshot: a skipped step must emit NOTHING and cost NOTHING.      */

console.log('\nCASE 4 · dead anchors ×3 in a row (optional misses, Automatic)')
{
  const bi = (en, es) => ({ en, es })
  const script = {
    id: 'bench-dead',
    floor: 'quick',
    title: bi('Dead-anchor bench', 'Banco de anclas muertas'),
    capability: bi('You can work the bench.', 'Puedes usar el banco.'),
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
  const dead = new Set(['listen-play', 'listen-editor', 'listen-next'])
  const timer = new FakeTimer()
  const emits = []
  const runner = createPresentationRunner(script, {
    clock: createPresentationClock(timer),
    resolver: (step) =>
      dead.has(step.anchorId)
        ? { status: 'miss', record: anchorById(step.anchorId), anchorId: step.anchorId, reason: 'bench-dead' }
        : { status: 'resolved', record: anchorById(step.anchorId), target: {} },
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
  const liveMs = 10400 // WALL ms: the two live beats total 2600 + 2600 presentation ms, and at label 1 (physical 0.5×) wall = presentation × 2
  console.log(`  snapshots emitted: ${emits.map((e) => `${e.step ?? e.status}@${e.at}ms`).join(' · ')}`)
  console.log(`  total run: ${emits[emits.length - 1].at} fake ms for 2 live beats (${liveMs} ms) + 3 dead anchors`)
  console.log(`  skips logged: ${runner.getSnapshot().progress.skips.length}`)
  check('the 3 dead anchors cost 0 ms (Brizna: ≈6,600 ms)', emits[emits.length - 1].at === liveMs, `extra = ${emits[emits.length - 1].at - liveMs} ms`)
  check('no snapshot was ever painted for a dead beat (nothing invisible is shown)', emits.every((e) => e.step !== null || e.status === 'done'))
  check('every active snapshot carries a live step (the card always has its beat)', emits.filter((e) => e.status === 'playing').every((e) => e.step !== null))
  check('all 3 skips were logged', runner.getSnapshot().progress.skips.length === 3)
}

console.log(failures === 0 ? '\nBENCH: no defect found.\n' : `\nBENCH: ${failures} defect check(s) failed.\n`)
process.exit(failures === 0 ? 0 : 1)
