/**
 * The presentation runner — a state machine over a module script (Logos).
 *
 * States: idle / playing / paused / interactive-wait / done / aborted.
 *
 * - Automatic: each step is resolved (late, live, per step — FENCE-DESIGN
 *   §7 clause 1), its act is performed THROUGH THE SCENARIO PORT, and the
 *   ONE presentation clock advances it after its calibrated duration.
 * - Interactive: the step is resolved and then the runner waits — for the
 *   learner's real act on the fiction stage (`userAct()`) or for the Next
 *   control (`next()`); «Show me» (`showMe()`) routes the act through the
 *   scenario port and advances. Modes switch live, mid-scene, without
 *   losing place: the pointer never moves on a mode switch.
 * - Back (‹, the nav pair — Oscar's law, Brizna lane 2026-11-14): returns
 *   ONE beat to the exact place the learner already occupied — a return
 *   stack of LIVED positions. Only steps actually presented enter the
 *   stack: a skipped step (optional miss) is machinery and never does, a
 *   chapter jump returns to the pre-jump place rather than the flat
 *   neighbour, and every run — fresh or resumed — starts with an empty
 *   stack, so ‹ is disabled at the run's first beat (the snapshot's
 *   `canBack`). Going back never re-seeds the stage: the scenario is
 *   untouched, the step is simply re-resolved live like any entry.
 * - The pair's other half (›): in Interactive, `next()` refuses GESTURE
 *   beats — tap / type / key / scroll / hover / goto, the acts the
 *   learner's own hand performs on the stage — because › would skip the
 *   gesture; the gesture itself or «Show me» is the way through.
 *   Narration beats (say / ask) carry no gesture, so › advances them.
 *   (In Automatic the clock drives and the port performs: no gesture
 *   duty, no pair, and `next()` stays the transport skip.)
 * - Fail-safe (§7 clause 3): a step whose anchor misses is skipped + logged
 *   when `optional`, and ends the scene cleanly (status done, endReason
 *   "required-anchor-miss", the module flagged needs-refresh, one plain
 *   line for the learner) when required. NEVER a fallback locator.
 *   Resolution is SYNCHRONOUS and a skip emits no snapshot and consumes
 *   no clock: a dead anchor costs 0 ms and paints nothing — the card
 *   never shows an invisible beat (the Brizna blind-skip defect has no
 *   counterpart here; scripts/presentation/entry-seeding-bench.mjs
 *   case 4 measures it: three dead anchors in a row, 0 ms extra).
 * - ENTRY SEEDING (Oscar's invariant, Brizna lane 2026-11-14 — the
 *   mid-module-entry defect): entering a module at ANY scene — a resume
 *   onto the recorded place, a chapters jump forward — guarantees the
 *   scenario the earlier scenes built EXISTS before the lesson acts.
 *   `seedBefore(target)` replays the scenario acts of every step before
 *   the target, in order, as SILENT MACHINERY (through the port only:
 *   no captions, no waits, no clock, no place records, no return-stack
 *   entries) the first time an entry lands beyond the run's built
 *   frontier (`builtThrough` — every step behind it has had its act
 *   executed: walked, shown, or seeded; a machinery-passed optional
 *   miss counts as passed, its act unperformable). The fiction at the
 *   target beat is then indistinguishable from having walked there —
 *   Q2's Undo has its replace to undo, AD1's save has its playing text.
 *   Backward movement (‹, a chapters jump back) never re-seeds: what
 *   was built stays built, exactly as ‹ has always ruled.
 * - «Stay here» (the stay-here window law, Oscar, Brizna lane 2026-11-14):
 *   a mid-module tap does NOT dissolve the stage. `requestStayHere()`
 *   opens the card's window and HOLDS THE CLOCK (clock.beginHold — in
 *   Automatic the lesson never advances behind the window) while every
 *   transport/mode verb stands down; `cancelStayHere()` closes the
 *   window and the lesson continues untouched; `stayHere()` — the
 *   window's confirm — is the only dissolution, and it records the exact
 *   place first, so the window's promise (continue later, right there,
 *   no restart) is one the state file already keeps. On a finished
 *   module there is no window to open: the request is a no-op.
 * - The ✕ ASKS FIRST (Oscar's law, Brizna lane 2026-11-14): the same
 *   family, the other exit. A mid-module ✕ does NOT leave: `requestClose()`
 *   opens the card's confirmation window — the clock holds behind it,
 *   every transport verb stands down — «Keep watching» (`cancelClose()`)
 *   returns to the lesson untouched, and only the window's confirm
 *   (`abort()`, which records the exact place first) ends the module.
 *   On a finished module there is nothing to confirm: the request is a
 *   no-op and the ✕ exits directly. The two windows are mutually
 *   exclusive — each request stands down while the other window is open.
 * - The last-used mark (the first-card law, same sitting; Brizna's proven
 *   pattern): the state file records this module as `lastUsed` from
 *   `start()` and on every advance (markPlace), and the mark clears when
 *   the module completes. The index lifts the marked module to its head
 *   while it stands in-progress (`resumeHead`, catalogue.ts).
 *
 * THE SCENARIO GUARD: while a module runs, the scenario sandbox is the only
 * data surface. The runner is given no real store, no real control and no
 * shell: performed acts go to the ScenarioPort (scenario-port.ts) and
 * nowhere else, and every exit — natural end, ✕, required miss, «Stay
 * here» — discards the scenario whole through the port's teardown. The
 * only payloads the runner emits are the presentation state file and the
 * skip log inside it; both are leak-scanned before every write, and they
 * carry module/scene/step/anchor ids only (the payload-isolation test in
 * scripts/presentation/engine.test.mjs proves it with the sandbox's own
 * `containsScenarioData`).
 *
 * Progress persists per module in `logos.presentation.state.v1`
 * (presentation-state.ts) — presentation-owned storage, NOT a user store.
 */
import { anchorById, logSkip, type AnchorRecord } from '../anchors.ts'
import { defaultPresentationStorage, loadPresentationState, savePresentationState, withLastUsed, withSavedScene } from '../presentation-state.ts'
import type { PresentationStorage } from '../presentation-state.ts'
import { containsScenarioData } from '../scenario/index.ts'
import type { Scenario } from '../scenario/index.ts'
import { ASK_BEAT_MS, PRESENTATION_SPEEDS, createPresentationClock, stepDurationMs, type PresentationClock } from './clock.ts'
import { createAnchorResolver, type AnchorResolution, type AnchorResolver } from './resolve.ts'
import { createScenarioPort, type ScenarioPort } from './scenario-port.ts'
import {
  assertValidPresentationModule,
  flattenSteps,
  type BilingualText,
  type FlatStep,
  type ModuleProgress,
  type PresentationLanguage,
  type PresentationMode,
  type PresentationModule,
  type PresentationStep,
  type PresentationStateFile,
  type StepAct,
} from './types.ts'

export type RunnerStatus = 'idle' | 'playing' | 'paused' | 'interactive-wait' | 'done' | 'aborted'
export type PlaybackMode = PresentationMode
export type RunnerEndReason = 'completed' | 'required-anchor-miss' | 'stay-here' | 'abort'

/**
 * Gesture beats (the nav-pair law): the acts the learner's own hand
 * performs on the stage. On these beats Interactive › does not exist —
 * the gesture itself, or «Show me», is the way through. The narration
 * acts (say / ask) are not gestures: nothing is performed, › advances.
 */
export const GESTURE_ACTS: readonly StepAct[] = ['tap', 'type', 'key', 'scroll', 'hover', 'goto']

export function isGestureBeat(step: PresentationStep): boolean {
  return GESTURE_ACTS.includes(step.act)
}

/** The one plain line a required miss shows (FENCE-DESIGN §7 clause 3). */
export const REFRESH_LINE: BilingualText = {
  en: 'This lesson needs a refresh — Logos has changed since it was checked.',
  es: 'Esta lección necesita una actualización: Logos cambió desde la última revisión.',
}

export interface RunnerOptions {
  clock?: PresentationClock
  /** An AnchorResolver, or a bare resolve function (tests inject fakes). */
  resolver?: AnchorResolver | ((step: FlatStep['step']) => AnchorResolution)
  storage?: PresentationStorage
  appVersion?: string
  shellVersion?: string
  now?: () => number
  initialMode?: PlaybackMode
  initialSpeed?: number
  initialLanguage?: PresentationLanguage
  /** The sealed scenario (a default port is built over it), or a ready port. */
  scenario?: Scenario
  scenarioPort?: ScenarioPort
  /**
   * Host hook for a record's declared precondition (registry §5): performed
   * as part of resolving that anchor (e.g. unfold the owning Settings
   * card). Returning false makes the step a miss. Absent = the script's own
   * setup steps establish the state (FENCE-DESIGN §2 L-5).
   */
  performPrecondition?: (record: AnchorRecord, flat: FlatStep) => boolean
}

export interface RunnerSnapshot {
  status: RunnerStatus
  mode: PlaybackMode
  lang: PresentationLanguage
  speed: number
  /** True while the C′ speed strip is open and the clock is held for the choice. */
  speedChoiceOpen: boolean
  /**
   * True while the stay-here window is open on the card: the clock is
   * held and the lesson stands still behind it (the stay-here law).
   */
  stayWindowOpen: boolean
  /**
   * True while the ✕ confirmation window is open on the card: the clock
   * is held and the lesson stands still behind it (the ✕-asks-first law).
   */
  closeWindowOpen: boolean
  module: PresentationModule
  /** The step on stage now (null when idle before start, done, or aborted past the end). */
  current: FlatStep | null
  /** The current step's live resolution (null on a miss or when no step is on stage). */
  resolution: AnchorResolution | null
  /**
   * The nav pair's ‹ state: true when the return stack holds a lived
   * position to go back to. False at a run's first beat — ‹ is disabled.
   */
  canBack: boolean
  /** True when the step on stage is a gesture beat: Interactive › hides. */
  gestureBeat: boolean
  progress: ModuleProgress
  /** The whole state file (modules + speed + myScenes), as last persisted. */
  state: PresentationStateFile
  endReason?: RunnerEndReason
  /** The plain bilingual line to show the learner (a required miss sets REFRESH_LINE). */
  notice?: BilingualText
}

export interface PresentationRunner {
  getSnapshot: () => RunnerSnapshot
  subscribe: (listener: () => void) => () => void
  start: (options?: { resume?: boolean }) => void
  pause: () => void
  resume: () => void
  /**
   * Advance past the current step (the transport Next; also the
   * Interactive "done" signal). In Interactive it refuses gesture beats:
   * the gesture itself or «Show me» is the way through those.
   */
  next: () => void
  /** The learner performed the step's real act on the stage (Interactive mode). */
  userAct: () => void
  /** «Show me»: perform the current step's act through the scenario port, then advance. */
  showMe: () => void
  /**
   * ‹: go back ONE beat to the previous LIVED position (the return
   * stack). A no-op when no return exists — the run's first beat.
   */
  back: () => void
  /** Jump to a step by its global index (the C′ chapters control lands on a scene's first step).
   *  A forward jump seeds the scenario acts of the steps it passes over (entry seeding). */
  goToStep: (globalIndex: number) => void
  setMode: (mode: PlaybackMode) => void
  setSpeed: (speed: number) => void
  setLanguage: (lang: PresentationLanguage) => void
  /** C′ speed strip opened: the clock holds while the user chooses. */
  beginSpeedChoice: () => void
  /** C′ speed strip closed: the clock resumes iff it was running. */
  endSpeedChoice: () => void
  /** Save the current scene into «My scenes» (state file). */
  saveCurrentScene: () => void
  /**
   * «Stay here» tapped mid-module: open the stay-here window (the clock
   * holds; nothing dissolves yet). A no-op once the module is finished —
   * a finished module's exit needs no window.
   */
  requestStayHere: () => void
  /** «Keep watching»: close the stay-here window; the lesson continues untouched. */
  cancelStayHere: () => void
  /** The window's confirm: end the presentation on this step's place (the host navigates the real app). */
  stayHere: () => void
  /**
   * ✕ tapped mid-module: open the confirmation window (the clock holds;
   * nothing exits yet). A no-op once the module is finished — a finished
   * module's ✕ exits directly, with no window.
   */
  requestClose: () => void
  /** «Keep watching»: close the ✕ window; the lesson continues untouched. */
  cancelClose: () => void
  abort: () => void
  /** This module's persisted progress (the index contract shape). */
  progress: () => ModuleProgress
}

export function createPresentationRunner(script: PresentationModule, options: RunnerOptions = {}): PresentationRunner {
  assertValidPresentationModule(script)

  const clock = options.clock ?? createPresentationClock()
  const resolverOption =
    options.resolver ??
    createAnchorResolver({
      root: () => (typeof document !== 'undefined' ? (document as unknown as import('../anchors.ts').RootLike) : null),
    })
  const resolveStep = (step: FlatStep['step']): AnchorResolution =>
    typeof resolverOption === 'function' ? resolverOption(step) : resolverOption.resolve(step)
  const storage: PresentationStorage = options.storage ?? defaultPresentationStorage()
  const appVersion = options.appVersion ?? script.verifiedAgainst ?? 'unknown'
  const now = options.now ?? (() => Date.now())
  const port: ScenarioPort | null =
    options.scenarioPort ?? (options.scenario ? createScenarioPort(options.scenario) : null)

  const flat = flattenSteps(script)
  const listeners = new Set<() => void>()

  let mode: PlaybackMode = options.initialMode ?? 'automatic'
  let lang: PresentationLanguage = options.initialLanguage ?? 'en'

  let memoryFile: PresentationStateFile | null = null
  let stateFile: PresentationStateFile = loadState()
  if (options.initialSpeed !== undefined) {
    clock.setSpeed(options.initialSpeed)
  } else if (PRESENTATION_SPEEDS.includes(stateFile.speed)) {
    clock.setSpeed(stateFile.speed)
  }

  let status: RunnerStatus = 'idle'
  /** Index into `flat` of the step on stage; `flat.length` when finished. */
  let pointer = 0
  /**
   * The return stack of LIVED positions (global indices into `flat`),
   * most recent last. A position enters it only when the learner leaves
   * a step that was actually presented — by advancing or by jumping —
   * never for a step the machinery passed through (a skipped optional
   * miss never takes the stage, so it is never pushed). `back()` pops.
   */
  let returnStack: number[] = []
  /**
   * The built frontier: every step with globalIndex < builtThrough has
   * had its scenario act executed — walked and completed, performed by
   * «Show me», or replayed silently by entry seeding — or was passed by
   * the machinery as an optional miss (its act unperformable). Entries
   * landing beyond the frontier seed up to their target first, so the
   * fiction a mid-module beat teaches on always exists (the entry-
   * seeding invariant). Reset per run: a run's scenario is fresh.
   */
  let builtThrough = 0
  let current: FlatStep | null = null
  let resolution: AnchorResolution | null = null
  let endReason: RunnerEndReason | undefined
  let notice: BilingualText | undefined
  let cancelPending: (() => void) | null = null
  let cancelPerform: (() => void) | null = null
  let performedKey: string | null = null
  let startedAt = 0
  let hadRequiredMiss = false
  let userPaused = false
  let scenarioLive = false
  /** True while the stay-here window is open: the clock is held, verbs stand down. */
  let stayWindowOpen = false
  /** True while the ✕ confirmation window is open: same hold, same stand-down. */
  let closeWindowOpen = false
  /**
   * The last-used mark this runner maintains in the state file (Brizna's
   * pattern): this module from start and on every advance; null once the
   * module completes (the mark clears) or before any run.
   */
  let lastUsedModule: string | null = null

  let progress: ModuleProgress = readProgress()

  function loadState(): PresentationStateFile {
    if (!storage) {
      // No storage injected: an in-memory file for this runner only
      // (honest degradation — see presentation-state.ts).
      if (!memoryFile) memoryFile = { modules: {}, speed: 1, myScenes: [] }
      return memoryFile
    }
    return loadPresentationState(storage)
  }

  function freshProgress(): ModuleProgress {
    return { state: 'unseen', verifiedAgainst: script.verifiedAgainst ?? appVersion, skips: [] }
  }

  function readProgress(): ModuleProgress {
    const stored = stateFile.modules[script.id]
    if (!stored) return freshProgress()
    return {
      state: stored.state ?? 'unseen',
      step: typeof stored.step === 'number' ? stored.step : undefined,
      scene: stored.scene,
      stepId: stored.stepId,
      verifiedAgainst: stored.verifiedAgainst ?? script.verifiedAgainst ?? appVersion,
      skips: Array.isArray(stored.skips) ? stored.skips : [],
    }
  }

  function persistProgress(): void {
    stateFile = loadState()
    stateFile = withLastUsed(
      {
        ...stateFile,
        modules: { ...stateFile.modules, [script.id]: progress },
        speed: clock.speed,
      },
      lastUsedModule,
    )
    // The guard, in code: a state payload carrying scenario data is never
    // written. (By construction it cannot — ids and states only — and the
    // payload-isolation test proves the construction; this scan is the
    // belt over the braces.)
    if (containsScenarioData(stateFile)) {
      stateFile = { ...stateFile, modules: { ...stateFile.modules, [script.id]: { ...progress, skips: [] } } }
      if (containsScenarioData(stateFile)) return
    }
    if (storage) savePresentationState(storage, stateFile)
    else memoryFile = stateFile
  }

  let snapshot: RunnerSnapshot = buildSnapshot()

  function buildSnapshot(): RunnerSnapshot {
    return {
      status,
      mode,
      lang,
      speed: clock.speed,
      speedChoiceOpen: clock.speedChoiceOpen,
      stayWindowOpen,
      closeWindowOpen,
      module: script,
      current,
      resolution,
      canBack: returnStack.length > 0,
      gestureBeat: current ? isGestureBeat(current.step) : false,
      progress,
      state: stateFile,
      endReason,
      notice,
    }
  }

  function emit(): void {
    snapshot = buildSnapshot()
    for (const listener of [...listeners]) listener()
  }

  function stopPending(): void {
    if (cancelPending) {
      cancelPending()
      cancelPending = null
    }
    if (cancelPerform) {
      cancelPerform()
      cancelPerform = null
    }
  }

  function teardownScenario(reason: 'completed' | 'required-anchor-miss' | 'stay-here' | 'abort'): void {
    if (!port || !scenarioLive) return
    scenarioLive = false
    port.teardown(reason)
  }

  /** Point progress at the step on stage: resume re-enters exactly there. */
  function markPlace(step: FlatStep): void {
    // A learner standing mid-module is part-way through it — from
    // 'unseen', and equally when replaying a module once 'seen' (the
    // same flip ‹ already makes in back()): the record must read
    // in-progress, or the index could not offer the exact Resume the
    // stay-here window promises. 'needs-refresh' is never flipped here:
    // only a clean full play clears that flag (finishCompleted).
    if (progress.state === 'unseen' || progress.state === 'seen') progress = { ...progress, state: 'in-progress' }
    // The last-used mark rides every advance (Brizna's pattern).
    lastUsedModule = script.id
    progress = {
      ...progress,
      step: step.globalIndex,
      scene: step.scene.id,
      stepId: step.step.id,
      verifiedAgainst: script.verifiedAgainst ?? appVersion,
    }
    persistProgress()
  }

  function recordSkip(step: FlatStep, reason: string): void {
    progress = {
      ...progress,
      skips: logSkip(progress.skips, {
        module: script.id,
        scene: step.scene.id,
        step: step.globalIndex,
        anchor: step.step.anchorId,
        reason,
        appVersion,
        shellVersion: options.shellVersion,
        at: now(),
      }),
    }
  }

  /** Perform the current step's act through the scenario port, once per entry. */
  function performCurrent(): void {
    if (!port || !current || !resolution || resolution.status !== 'resolved') return
    const key = `${current.scene.id}:${current.step.id}`
    if (performedKey === key) return
    performedKey = key
    const flatStep = current
    const res = resolution
    if (flatStep.step.act === 'ask') {
      // ask → one-beat pause → show: the act lands after the beat.
      cancelPerform = clock.after(ASK_BEAT_MS, () => {
        cancelPerform = null
        port.perform(flatStep, res)
      })
    } else {
      port.perform(flatStep, res)
    }
  }

  function scheduleCurrent(): void {
    if (!current) return
    cancelPending = clock.after(stepDurationMs(current.step, lang), () => {
      cancelPending = null
      completeCurrent()
    })
  }

  /**
   * Entry seeding (the mid-module-entry invariant): replay the scenario
   * acts of every step in [builtThrough, target), in order, as silent
   * machinery, so the fiction those steps build exists before the target
   * beat is presented. Each step is resolved the same way entry resolves
   * it — the declared precondition first, then the live resolver — and
   * its act is performed through the port only when it resolves; a dead
   * anchor's act cannot be performed, and the fiction keeps whatever the
   * live acts built (the presented beat's own fail-safe still governs
   * the target). No captions, no waits, no clock, no place records, no
   * skip log, no return-stack entries: seeding is not living the steps,
   * it is building the stage they built. A throwing port or hook never
   * breaks an entry.
   */
  function seedBefore(target: number): void {
    if (!port || !scenarioLive) {
      builtThrough = Math.max(builtThrough, target)
      return
    }
    while (builtThrough < target) {
      const flatStep = flat[builtThrough]
      builtThrough += 1
      if (!flatStep) break
      const record = anchorById(flatStep.step.anchorId)
      let preconditionFailed = false
      if (record?.precondition && options.performPrecondition) {
        try {
          preconditionFailed = options.performPrecondition(record, flatStep) === false
        } catch {
          preconditionFailed = true
        }
      }
      if (preconditionFailed) continue
      const res = resolveStep(flatStep.step)
      if (res.status !== 'resolved') continue
      try {
        port.perform(flatStep, res)
      } catch {
        // Machinery never breaks an entry: a failed seed act leaves the
        // fiction as the live acts built it, and the target beat's own
        // resolution decides what the learner sees.
      }
    }
  }

  function enterCurrent(): void {
    stopPending()
    const step = flat[pointer]
    if (!step) {
      finishCompleted()
      return
    }
    current = step
    endReason = undefined
    notice = undefined
    performedKey = null

    // A declared precondition is a resolution step, performed first (§7.1/§2 L-5).
    const record = anchorById(step.step.anchorId)
    let preconditionFailed = false
    if (record?.precondition && options.performPrecondition) {
      try {
        preconditionFailed = options.performPrecondition(record, step) === false
      } catch {
        preconditionFailed = true
      }
    }

    // Resolve LATE and LIVE, at this moment, for this step only.
    resolution = preconditionFailed
      ? { status: 'miss', record, anchorId: step.step.anchorId, reason: 'precondition-failed' }
      : resolveStep(step.step)

    if (resolution.status === 'miss') {
      recordSkip(step, resolution.reason)
      if (step.step.optional) {
        // Skip + log; the scene continues at the next step. The skipped step
        // counts as passed for place purposes: resume lands after it. It
        // also counts as passed for the built frontier: its act can never
        // be performed, so seeding never owes it either.
        builtThrough = Math.max(builtThrough, step.globalIndex + 1)
        pointer = step.globalIndex + 1
        persistProgress()
        enterCurrent()
        return
      }
      // Required miss: the scene ends cleanly, back to the index, one line.
      hadRequiredMiss = true
      progress = {
        ...progress,
        state: 'needs-refresh',
        step: step.globalIndex,
        scene: step.scene.id,
        stepId: step.step.id,
        verifiedAgainst: script.verifiedAgainst ?? appVersion,
      }
      persistProgress()
      status = 'done'
      endReason = 'required-anchor-miss'
      notice = REFRESH_LINE
      resolution = null
      current = step
      teardownScenario('required-anchor-miss')
      emit()
      return
    }

    markPlace(step)
    if (mode === 'automatic') {
      status = userPaused ? 'paused' : 'playing'
      performCurrent()
      scheduleCurrent()
    } else {
      status = 'interactive-wait'
    }
    emit()
  }

  /** Record a lived position the learner is leaving, for ‹ to return to. */
  function pushReturn(globalIndex: number): void {
    if (returnStack[returnStack.length - 1] !== globalIndex) returnStack.push(globalIndex)
  }

  function completeCurrent(): void {
    if (!current) return
    stopPending()
    // The beat was LIVED — its act performed by the port (Automatic /
    // «Show me») or by the learner's own hand on the stage (Interactive):
    // the built frontier covers it, and no later entry re-seeds it (a
    // toggle act performed twice would unbuild the fiction).
    builtThrough = Math.max(builtThrough, current.globalIndex + 1)
    pushReturn(current.globalIndex)
    pointer = current.globalIndex + 1
    current = null
    resolution = null
    if (pointer >= flat.length) {
      finishCompleted()
      return
    }
    enterCurrent()
  }

  function finishCompleted(): void {
    stopPending()
    pointer = flat.length
    current = null
    resolution = null
    // A clean FULL play clears a needs-refresh flag; a resumed tail does not
    // (FENCE-DESIGN §7 clause 5: "a clean full play clears the state").
    const cleanFullPlay = startedAt === 0 && !hadRequiredMiss
    progress = {
      state: cleanFullPlay || progress.state !== 'needs-refresh' ? 'seen' : 'needs-refresh',
      verifiedAgainst: script.verifiedAgainst ?? appVersion,
      skips: progress.skips,
    }
    // The last-used mark clears when the module completes (Brizna's
    // pattern): a finished module returns to its floor in the index.
    if (progress.state === 'seen') lastUsedModule = null
    persistProgress()
    status = 'done'
    endReason = 'completed'
    teardownScenario('completed')
    emit()
  }

  const runner: PresentationRunner = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    progress: () => progress,

    start(startOptions = {}) {
      const resume = startOptions.resume !== false
      stateFile = loadState()
      progress = readProgress()
      // §7 clause 5(b): a newer app + the builder's stale-risk stamp.
      if (script.staleRisk && script.verifiedAgainst && appVersion !== script.verifiedAgainst) {
        progress = { ...progress, state: 'needs-refresh' }
      }
      hadRequiredMiss = false
      endReason = undefined
      notice = undefined
      userPaused = false
      stayWindowOpen = false
      closeWindowOpen = false
      // The last-used mark is recorded from module start (Brizna's
      // pattern); enterCurrent's markPlace persists it with the place.
      lastUsedModule = script.id
      // Every run starts with an empty return stack — even a resumed one:
      // ‹ answers only for places THIS run has lived.
      returnStack = []
      // …and with an unbuilt frontier: this run's scenario is fresh, so
      // a resume's fiction must be seeded up to the recorded place.
      builtThrough = 0
      scenarioLive = port !== null
      let startAt = 0
      if (resume && (progress.state === 'in-progress' || progress.state === 'needs-refresh')) {
        if (typeof progress.step === 'number' && progress.step >= 0 && progress.step < flat.length) {
          startAt = progress.step
        }
      }
      startedAt = startAt
      // ENTRY SEEDING: the recorded place's fiction is built BEFORE the
      // first presented beat — the earlier scenes' scenario acts replay
      // silently, in order, so the beat lands on the stage it teaches.
      seedBefore(startAt)
      pointer = startAt
      enterCurrent()
    },

    pause() {
      if (stayWindowOpen || closeWindowOpen) return // a window is modal; the clock already stands still
      if (status !== 'playing') return
      userPaused = true
      clock.pause()
      status = 'paused'
      emit()
    },

    resume() {
      if (stayWindowOpen || closeWindowOpen) return
      if (status !== 'paused') return
      userPaused = false
      status = 'playing'
      clock.resume()
      emit()
    },

    next() {
      if (stayWindowOpen || closeWindowOpen) return // nothing advances behind a window
      // The nav-pair law: on a gesture beat, › would skip the gesture —
      // it does not exist there, and neither does its effect. The
      // learner's own act on the stage, or «Show me», is the way through.
      if (status === 'interactive-wait' && current && isGestureBeat(current.step)) return
      if (status === 'interactive-wait' || status === 'playing' || status === 'paused') completeCurrent()
    },

    userAct() {
      if (stayWindowOpen || closeWindowOpen) return
      if (status === 'interactive-wait') completeCurrent()
    },

    showMe() {
      if (stayWindowOpen || closeWindowOpen) return
      if (status !== 'interactive-wait' || !current) return
      performCurrent()
      if (cancelPerform) {
        // An ask step's act is beat-delayed; «Show me» shows it now.
        cancelPerform()
        cancelPerform = null
        if (port && resolution && resolution.status === 'resolved') port.perform(current, resolution)
      }
      completeCurrent()
    },

    back() {
      if (stayWindowOpen || closeWindowOpen) return
      if (status !== 'playing' && status !== 'paused' && status !== 'interactive-wait') return
      // ‹ pops the return stack: one beat back, to a position this run
      // actually occupied — never a flat neighbour, never a skipped
      // machinery step. No return on the stack = the run's first beat:
      // ‹ is disabled there and this is a no-op. The stage is NOT
      // re-seeded: the step is re-resolved live, like any entry.
      const target = returnStack.pop()
      if (target === undefined) return
      stopPending()
      pointer = target
      if (progress.state === 'seen') progress = { ...progress, state: 'in-progress' }
      enterCurrent()
    },

    goToStep(globalIndex) {
      if (stayWindowOpen || closeWindowOpen) return
      if (status !== 'playing' && status !== 'paused' && status !== 'interactive-wait') return
      if (flat.length === 0) return
      const target = Math.min(Math.max(0, Math.floor(globalIndex)), flat.length - 1)
      // ENTRY SEEDING: a jump forward lands beyond the built frontier —
      // the passed-over scenes' scenario acts replay silently first, so
      // the landing beat's fiction exists. A jump back seeds nothing:
      // what was built stays built (the frontier only moves forward).
      seedBefore(target)
      // A jump is a leaving: the place jumped FROM is a lived position,
      // and ‹ from the landing returns there — not to the flat neighbour.
      if (current && target !== current.globalIndex) pushReturn(current.globalIndex)
      pointer = target
      enterCurrent()
    },

    setMode(nextMode) {
      if (stayWindowOpen || closeWindowOpen) return
      if (nextMode === mode) return
      mode = nextMode
      if (!current) {
        emit()
        return
      }
      if (mode === 'interactive') {
        stopPending()
        status = 'interactive-wait'
        emit()
      } else {
        status = userPaused ? 'paused' : 'playing'
        performCurrent()
        scheduleCurrent()
        emit()
      }
    },

    setSpeed(speed) {
      clock.setSpeed(speed)
      persistProgress() // the speed is remembered per user, immediately
      emit()
    },

    setLanguage(nextLang) {
      if (nextLang === lang) return
      lang = nextLang
      // The place never moves; an Automatic wait is re-timed in the new
      // language (durations are computed per language — clock.ts).
      if (current && mode === 'automatic' && (status === 'playing' || status === 'paused')) {
        stopPending()
        scheduleCurrent()
      }
      emit()
    },

    beginSpeedChoice() {
      if (stayWindowOpen || closeWindowOpen) return
      clock.beginSpeedChoice()
      emit()
    },

    endSpeedChoice() {
      if (stayWindowOpen || closeWindowOpen) return
      clock.endSpeedChoice()
      emit()
    },

    saveCurrentScene() {
      if (stayWindowOpen || closeWindowOpen) return
      if (!current) return
      stateFile = withSavedScene(stateFile, {
        module: script.id,
        scene: current.scene.id,
        step: current.globalIndex - current.indexInScene,
        stepId: current.scene.steps[0]?.id,
        savedAt: new Date(now()).toISOString(),
      })
      stateFile = withLastUsed(
        { ...stateFile, modules: { ...stateFile.modules, [script.id]: progress }, speed: clock.speed },
        lastUsedModule,
      )
      if (storage) savePresentationState(storage, stateFile)
      else memoryFile = stateFile
      emit()
    },

    requestStayHere() {
      // The window exists only mid-module: a finished (or never-started)
      // module has nothing to leave part-way, so there is nothing to ask.
      // And the two windows never stack: while the ✕ window is open,
      // this request stands down.
      if (stayWindowOpen || closeWindowOpen || !current) return
      if (status !== 'playing' && status !== 'paused' && status !== 'interactive-wait') return
      // THE CLOCK STOPS while the window is open (Oscar's refinement):
      // beginHold freezes every pending wait — in Automatic the lesson
      // must not advance behind the window — and endHold will resume it
      // only if it was running when the window opened.
      clock.beginHold()
      stayWindowOpen = true
      emit()
    },

    cancelStayHere() {
      if (!stayWindowOpen) return
      stayWindowOpen = false
      clock.endHold()
      emit()
    },

    stayHere() {
      if (!current) return
      stopPending()
      // The window's confirm (or a direct call): the window, if open,
      // closes with the dissolution — its clock hold ends with it.
      if (stayWindowOpen || closeWindowOpen) {
        stayWindowOpen = false
        closeWindowOpen = false
        clock.endHold()
      }
      // Place stays recorded: resume re-enters at this very step.
      markPlace(current)
      status = 'done'
      endReason = 'stay-here'
      teardownScenario('stay-here')
      emit()
    },

    requestClose() {
      // The ✕ window exists only mid-module: on a finished module the ✕
      // exits directly, with nothing to confirm. And the two windows
      // never stack: while the stay-here window is open, this stands down.
      if (closeWindowOpen || stayWindowOpen || !current) return
      if (status !== 'playing' && status !== 'paused' && status !== 'interactive-wait') return
      // THE CLOCK STOPS while the window is open — the same hold the
      // stay-here window takes: in Automatic the lesson must not advance
      // behind the question, and endHold resumes it only if it was
      // running when the window opened.
      clock.beginHold()
      closeWindowOpen = true
      emit()
    },

    cancelClose() {
      if (!closeWindowOpen) return
      closeWindowOpen = false
      clock.endHold()
      emit()
    },

    abort() {
      stopPending()
      // The ✕ window's confirm lands here (and a direct ✕ with a window
      // open is still an exit, never an advance): any open window closes
      // with the run, and its clock hold ends with it.
      if (stayWindowOpen || closeWindowOpen) {
        stayWindowOpen = false
        closeWindowOpen = false
        clock.endHold()
      }
      if (current) markPlace(current)
      status = 'aborted'
      endReason = 'abort'
      teardownScenario('abort')
      emit()
    },
  }

  return runner
}
