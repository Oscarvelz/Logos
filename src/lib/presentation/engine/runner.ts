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
 *
 * BUILDER-2 WAVE (P1/P12–P17), in brief: start is split into
 * prepare / confirmStart / abortClean (the opening phase: clock held,
 * persistence suppressed, a required entry miss blocks instead of
 * finishing); Automatic beats are TWO-PHASE (perform at performDelayMs,
 * advance at stepDurationMs) and «Show me» dwells RESULT_DWELL_MS;
 * a run-wide lived set makes re-performance impossible (back re-entry,
 * mode switch after userAct, seeded steps); seeding records every miss
 * ('seed-miss', seededRequiredMiss on a required one) and ANY skip in a
 * run bars 'seen' at the finish; a miss whose anchor's declared
 * precondition is sheet/menu-style (or whose previous step `establishes`)
 * earns a reveal wait — the same resolution retried every 100
 * presentation-ms up to 1200 before the miss path applies; and the
 * record carries mode + userPaused, restored on a resumed start, with
 * handleHidden/handleVisible pausing and reviving the clock honestly.
 */
import { anchorById, logSkip, type AnchorRecord } from '../anchors.ts'
import { defaultPresentationStorage, loadPresentationState, savePresentationState, withLastUsed, withSavedScene } from '../presentation-state.ts'
import type { PresentationStorage } from '../presentation-state.ts'
import { containsScenarioData } from '../scenario/index.ts'
import type { Scenario } from '../scenario/index.ts'
import { PRESENTATION_SPEEDS, RESULT_DWELL_MS, createPresentationClock, performDelayMs, stepDurationMs, type PresentationClock } from './clock.ts'
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

/** Run-local skip tally carried on the final snapshot (P17): the done card
 *  (a later builder) renders the declaration from this data alone. */
export interface RunnerEndInfo {
  skipCount: number
  /** Chapter names (in the snapshot's language) of the scenes skipped this run, de-duplicated, in skip order. */
  skipChapters: string[]
}

export interface RunnerSnapshot {
  status: RunnerStatus
  mode: PlaybackMode
  lang: PresentationLanguage
  speed: number
  /**
   * True during the PREPARE phase (P1): `prepare()` has seeded and entered
   * the first beat, but the opening window has not been confirmed — the
   * clock is held from t=0 and NO place / last-used / progress write of any
   * kind has been persisted. `confirmStart()` ends the phase.
   */
  opening: boolean
  /**
   * The plain refresh line, in the run's language, when a REQUIRED anchor
   * missed at the entry beat during `prepare()`: the run is blocked behind
   * the opening window (status stays non-done) and only `abortClean()`
   * exits from there. Absent otherwise.
   */
  blockedNotice?: string
  /** True only on the snapshot produced by `abortClean()` (the «Ahora no» path). */
  cleanAbort?: boolean
  /**
   * True while «Show me»'s result dwell (P16) is running: the act has been
   * performed and the step completes after RESULT_DWELL_MS on the clock.
   * While it stands, Show-me / › (and userAct) are inert — the chosen
   * exposure for the dwell (status stays 'interactive-wait').
   */
  showMeDwelling: boolean
  /** The run-local skip declaration, present on a final (done / aborted) snapshot. */
  endInfo?: RunnerEndInfo
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
  start: (options?: { resume?: boolean; resumeFrom?: { step: number; scene?: string; stepId?: string } }) => void
  /**
   * P1, phase one: load state, compute the resume point, seed, and enter
   * the first beat — with the clock HELD from t=0 and persistence
   * SUPPRESSED (no markPlace, no last-used write, no progress write) until
   * `confirmStart()`. Snapshot `opening: true` while this phase stands.
   */
  prepare: (options?: { resume?: boolean; resumeFrom?: { step: number; scene?: string; stepId?: string } }) => void
  /**
   * P1, phase two: end the hold, lift suppression, perform the deferred
   * markPlace + last-used write for the current beat, `opening: false`.
   * (If prepare blocked on a required entry miss, confirming instead
   * finalises that miss the way `start()` always has: done,
   * needs-refresh, the plain line, scenario discarded.)
   */
  confirmStart: () => void
  /**
   * P1, the «Ahora no» path: tear down the scenario and stop pending with
   * NO place / last-used / progress writes — a resume cancelled here
   * leaves the previously recorded resume point byte-identical.
   * endReason 'abort', snapshot `cleanAbort: true`.
   * The one exception (P17's honesty discipline, R2-T6-6): if the
   * opening was BLOCKED by a required entry miss, the exit finalises
   * that miss onto the record instead (done, needs-refresh, the skip
   * logged) — the miss is the lesson's fact, and the blocked window
   * offers no other exit.
   */
  abortClean: () => void
  /**
   * P14 backgrounding: the app went hidden mid-run — record whether the
   * lesson was playing (Automatic) and whether the clock itself was
   * running (any mode), pause the clock, persist mode/paused.
   */
  handleHidden: () => void
  /**
   * The app is visible again: resume the clock ONLY if it was running
   * when it hid. A user-paused or window-held lesson stays still; an
   * Interactive lesson's own clock waits (the «Show me» dwell, the
   * reveal wait) were running, so they revive and can complete —
   * the lesson still never advances past a wait on its own.
   */
  handleVisible: () => void
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
  /** Cancels a pending REVEAL WAIT retry (P12) — the same slot family as the other two. */
  let cancelReveal: (() => void) | null = null
  let startedAt = 0
  let hadRequiredMiss = false
  let userPaused = false
  let scenarioLive = false
  /* ── P1 prepare/confirm ──────────────────────────────────────────── */
  /** True in the prepare phase: clock held, persistence suppressed. */
  let opening = false
  /** True when prepare blocked on a required miss at the entry beat. */
  let blockedOpening = false
  /** True when the run reached its natural end during prepare (an entry
   *  skip chain running off the end): its persist + teardown are deferred
   *  to confirmStart, like everything else in the phase. */
  let finishDeferred = false
  let blockedNotice: string | undefined
  /** Set only by abortClean(), carried on its snapshot. */
  let cleanAbortFlag = false
  /* ── R2-T6-4: the opening shield ─────────────────────────────────── */
  /**
   * True while the opening phase holds the scenario in seed-mode: from
   * the end of prepare's seeding until confirmStart (or an exit). The
   * runner's own verbs all stand down while `opening` stands — but the
   * STAGE's own λ button is not a runner verb: it calls
   * scenario.stage.setLambda directly, and before this shield that was
   * a live presented-path write during the phase, before «Empezar» was
   * ever tapped (a kill in that window left the real switch flipped,
   * and a polite tap inverted Q2's own tap beat). Held in seed-mode,
   * any such act absorbs into the fiction ledger only; confirmStart
   * restores the ledger to the value seeding left (`openingLedger`)
   * before releasing the shield, so the lesson starts from exactly
   * the state its entry built — and the stage's λ keeps its real hand
   * the moment the lesson is confirmed (the T6-11 cure stands).
   */
  let openingShieldHeld = false
  /** The fiction ledger's value as entry seeding left it. */
  let openingLedger: boolean | null = null
  /* ── P16 two-phase + dwell ───────────────────────────────────────── */
  /** True while a scheduled perform has not yet fired. */
  let performPending = false
  let performPendingKey: string | null = null
  /** True during showMe()'s RESULT_DWELL_MS dwell. */
  let showMeDwelling = false
  /* ── P14/P13 run-wide lived performances ─────────────────────────── */
  /**
   * Step keys (`scene:step`) whose act has been performed IN THIS RUN —
   * by the port (Automatic / «Show me»), by the learner's own hand
   * (userAct), or by entry seeding. A key in this set is never performed
   * again this run: back() re-entry and a mode switch after userAct()
   * cannot re-fire a toggle and unbuild the fiction.
   */
  const livedPerformed = new Set<string>()
  /**
   * The steps this run has actually PRESENTED (canon's H-28 cure,
   * restored by R2-T6-1 — the lane runner the 186 merge took as its
   * base never carried it, and the merge dropped it silently): a step
   * enters the set when it takes the stage resolved in `attemptEnter`,
   * or when the machinery passes it as an optional miss during a lived
   * walk. Entry seeding and chapters jumps never add to it — seeded
   * steps were built, not presented — so a run that reaches the end
   * over un-presented steps cannot earn a clean full play.
   */
  let presentedSteps = new Set<number>()
  /* ── P17 run-local skip tally ────────────────────────────────────── */
  let runSkipCount = 0
  let runSkipChapters: BilingualText[] = []
  let runSkipChapterIds = new Set<string>()
  let seededRequiredMissRun = false
  /* ── P12 reveal wait ─────────────────────────────────────────────── */
  let revealTries = 0
  /**
   * True while the clock stands RESUMED for an opening-phase reveal
   * wait (R2-T6-3): prepare holds the clock, and a wait registered on
   * a paused clock never arms — the retry could never fire, the entry
   * beat could never seat, «Empezar» could never enable. During the
   * phase the reveal retry is the only wait that can be pending (the
   * entry beat has not seated, so nothing else is armed), so the clock
   * resumes for it alone; the next attemptEnter re-pauses the moment
   * the attempt lands — seat, skip or block — before any perform or
   * advance wait is armed on it.
   */
  let openingRevealResumed = false
  /* ── P14 backgrounding ───────────────────────────────────────────── */
  let hiddenWasPlaying = false
  /**
   * Whether the presentation clock was RUNNING when the app hid — any
   * mode (R2-T6-2). Automatic's was-playing is the narrow case; an
   * Interactive lesson's clock is just as alive (the «Show me» dwell
   * and the reveal wait run on it), and pausing it on hide with no
   * record stranded those waits forever. `hiddenOutstanding` keeps a
   * double hide (visibilitychange + pagehide) from overwriting the
   * first hide's record with the already-paused second one.
   */
  let hiddenClockWasRunning = false
  let hiddenOutstanding = false
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
  // The completed-steps set (T6-15): the steps this module's lived
  // walks have actually finished, seeded from the record and grown
  // only by the forward-advance rule in attemptEnter. A record with
  // no `done` predates the field — take the old law's word for the
  // past and seed the steps before its resume point, so upgrading
  // never visibly erases progress the old law credited; landings and
  // jumps from here on add nothing until a walk completes the step.
  // Both seedings are bounded by THIS module's length (R3-T6-2): the
  // grandfather branch always clamped its word-taking to the module,
  // and the explicit-done branch now stands under the same discipline
  // — the runner knows its script's length even where the state
  // layer's registry has not been fed, so a stored set naming steps
  // the module does not have seeds only the steps it can witness.
  //
  // THE WITNESS IS SIGNED (R4-T6-3): done[] names steps by position,
  // and a position testifies only about the layout that seated it.
  // This seed — the runner's one read of the stored set, and so the
  // finish's one trust point — honours an index only where the
  // record's signature names the very step THIS script seats there.
  // A script revision that moves no seat (an append at the tail)
  // costs the witness nothing; an insert refuses exactly the seats
  // it shifted, each on its own evidence. A done set carrying no
  // signature — everything written before the signature existed —
  // cannot prove any of its positions and is refused whole: the
  // module is honestly re-walked, its resume place still standing,
  // its steps witnessing as the new walk presents them. The
  // grandfather branch is a different shape of record — no done set
  // at all — and keeps its own law, now bounded to the in-range
  // steps the resume gate itself would accept as a place (R4-T6-2):
  // an out-of-range step is damage, and damage seeds nothing rather
  // than clamping into a full walk.
  const doneStepIds = new Map<number, string>()
  const doneSteps = new Set<number>()
  let witnessRefused = false
  if (progress.done !== undefined) {
    const ids = progress.doneIds
    const signed = Array.isArray(ids) && ids.length === progress.done.length
    progress.done.forEach((n, i) => {
      if (!(n >= 0 && n < flat.length)) return
      const id = signed ? ids[i] : undefined
      if (typeof id === 'string' && flat[n].step.id === id) {
        doneSteps.add(n)
        doneStepIds.set(n, id)
      } else {
        witnessRefused = true
      }
    })
  } else if (typeof progress.step === 'number' && progress.step > 0 && progress.step < flat.length) {
    for (let i = 0; i < progress.step; i++) {
      doneSteps.add(i)
      doneStepIds.set(i, flat[i].step.id)
    }
  }
  // A record that calls itself `seen` on a witness this script
  // cannot verify has not seen THIS lesson. It degrades to
  // in-progress here, at the read, so the learner is offered the
  // re-walk the verdict implies and the next persist writes the
  // honest state — never a softened needs-refresh, never a kept
  // `seen` the finish would have to launder.
  if (witnessRefused && progress.state === 'seen') {
    progress = { ...progress, state: 'in-progress' }
  }

  /** Witness one completed step: its index joins the done set with its step's id as its signature. */
  function witnessStep(flatStep: FlatStep): void {
    doneSteps.add(flatStep.globalIndex)
    doneStepIds.set(flatStep.globalIndex, flatStep.step.id)
  }

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
      // The skip log is judged against THIS script's length at the
      // read (R4-T6-1): the normaliser bounds it by the registry,
      // but the registry is fed by registration, and a reader that
      // never registered (a probe, a partial import graph) would let
      // an out-of-range entry stand — un-strikeable, barring `seen`
      // forever. The runner knows its own length even where the
      // registry has not been fed, the same double gate the done
      // seed applies: an entry naming a step this module does not
      // have is not a witness of this module.
      skips: Array.isArray(stored.skips)
        ? stored.skips.filter(
            (s) => Number.isInteger(s.step) && s.step >= 0 && s.step < flat.length,
          )
        : [],
      // Threaded through the normaliser by Builder 1 — the runner must
      // name them too, or its own load gate strips them (P14/P17).
      mode: stored.mode,
      userPaused: stored.userPaused,
      seededRequiredMiss: stored.seededRequiredMiss,
      done: stored.done,
      // The witness's signature rides with it (R4-T6-3): the seed
      // below judges each done index against the step id the record
      // names for it, and an unthreaded field would read as an
      // unsigned — therefore refused — witness.
      doneIds: stored.doneIds,
    }
  }

  function persistProgress(): void {
    // P1 suppression: while `opening` stands, NO progress / place /
    // last-used write of any kind leaves this runner. In-memory progress
    // still moves (skip log, seeded-miss flag); confirmStart()'s deferred
    // markPlace persists it whole, and abortClean() discards it unwritten.
    if (opening) return
    // P14: every persisted record carries the CURRENT mode and paused
    // state, so a resumed start can restore them over host defaults.
    // The done set rides the same funnel (T6-15): folded from the
    // run-local set here, at the single persistence point, so no
    // rebuild path (finish, landing, re-mark) can drop it. Its
    // signature rides the same funnel (R4-T6-3): every index the set
    // claims carries the id of the step that earned it, so a future
    // script revision can judge each seat on its own evidence. Every
    // member of the set has an id by construction — the seed keeps
    // only signed pairs, and the walk signs what it completes.
    const doneSorted = [...doneSteps].sort((a, b) => a - b)
    progress = {
      ...progress,
      mode,
      userPaused,
      done: doneSorted,
      doneIds: doneSorted.map((n) => doneStepIds.get(n) as string),
    }
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
    const final = status === 'done' || status === 'aborted'
    return {
      status,
      mode,
      lang,
      speed: clock.speed,
      opening,
      blockedNotice,
      cleanAbort: cleanAbortFlag || undefined,
      showMeDwelling,
      endInfo: final ? { skipCount: runSkipCount, skipChapters: runSkipChapters.map((c) => c[lang]) } : undefined,
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

  /** True only inside start()'s synchronous prepare+confirm: the entry
   *  beat must emit ONCE (at confirm), exactly as the old start() did. */
  let startBatching = false

  function emit(): void {
    snapshot = buildSnapshot()
    if (startBatching) return
    for (const listener of [...listeners]) listener()
  }

  function cancelAdvanceTimer(): void {
    if (cancelPending) {
      cancelPending()
      cancelPending = null
    }
  }

  function cancelPerformTimer(): void {
    if (cancelPerform) {
      cancelPerform()
      cancelPerform = null
    }
    performPending = false
    performPendingKey = null
  }

  function stopPending(): void {
    cancelAdvanceTimer()
    cancelPerformTimer()
    if (cancelReveal) {
      cancelReveal()
      cancelReveal = null
    }
    showMeDwelling = false
  }

  function teardownScenario(reason: 'completed' | 'required-anchor-miss' | 'stay-here' | 'abort'): void {
    if (!port || !scenarioLive) return
    scenarioLive = false
    port.teardown(reason)
  }

  /** Engage the opening shield (R2-T6-4): seed-mode held across the phase. */
  function engageOpeningShield(): void {
    const stage = port?.scenario?.stage
    if (!stage) return
    try {
      stage.beginLambdaSeed()
      openingLedger = stage.lambdaOn()
      openingShieldHeld = true
    } catch {
      openingShieldHeld = false
    }
  }

  /**
   * Release the opening shield. With `restoreLedger`, a ledger the
   * stage's own hand moved during the phase is first put back to the
   * value entry seeding left — while seed-mode still stands, so the
   * restoration itself is absorbed and never writes the real switch.
   */
  function releaseOpeningShield(restoreLedger: boolean): void {
    if (!openingShieldHeld) return
    openingShieldHeld = false
    const stage = port?.scenario?.stage
    const seeded = openingLedger
    openingLedger = null
    if (!stage) return
    try {
      if (restoreLedger && seeded !== null && stage.lambdaOn() !== seeded) {
        stage.setLambda(seeded)
      }
      stage.endLambdaSeed()
    } catch {
      // Seed-mode is scenario-local; teardown clears it regardless.
    }
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
    // P17: every skip this run — walked or seeded, optional or required —
    // joins the run-local tally the finish rule and endInfo read.
    runSkipCount += 1
    if (!runSkipChapterIds.has(step.scene.id)) {
      runSkipChapterIds.add(step.scene.id)
      runSkipChapters.push(step.scene.chapter)
    }
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

  const stepKey = (flatStep: FlatStep): string => `${flatStep.scene.id}:${flatStep.step.id}`

  /** Acts the stage actually performs (clock.ts's performed set, mirrored: `say` performs nothing). */
  const PERFORMED_ACTS: ReadonlySet<string> = new Set(['tap', 'type', 'key', 'goto', 'scroll', 'hover', 'ask'])

  /**
   * Fire one step's act through the scenario port — at most once per run
   * (P14/P13): the run-wide lived set is the guard, so a back() re-entry,
   * a mode switch after the learner's own act, or a later entry onto a
   * seeded step can never perform it a second time.
   */
  function doPerform(flatStep: FlatStep, res: AnchorResolution): void {
    if (!port || res.status !== 'resolved') return
    const key = stepKey(flatStep)
    if (livedPerformed.has(key)) return
    livedPerformed.add(key)
    port.perform(flatStep, res)
  }

  /**
   * P16 two-phase, phase one: schedule the current step's PERFORM at
   * performDelayMs(step, lang) on the presentation clock — the caption is
   * read first, the act fires only after its reading time. (`say` has no
   * perform phase.) The handle is cancellable; `performPending` remembers
   * that the act is still owed, which is what setLanguage re-arms.
   */
  function performCurrent(): void {
    if (!port || !current || !resolution || resolution.status !== 'resolved') return
    if (!PERFORMED_ACTS.has(current.step.act)) return
    const flatStep = current
    const res = resolution
    const key = stepKey(flatStep)
    if (livedPerformed.has(key)) return
    if (performPending && performPendingKey === key) return
    performPending = true
    performPendingKey = key
    cancelPerform = clock.after(performDelayMs(flatStep.step, lang), () => {
      cancelPerform = null
      performPending = false
      performPendingKey = null
      doPerform(flatStep, res)
    })
  }

  /** P16 two-phase, phase two: the ADVANCE at the step's full duration (read + perform + result dwell). */
  function scheduleCurrent(): void {
    if (!current) return
    cancelAdvanceTimer()
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
   *
   * THE λ SEED RULE (H-1 cure, kept over the lane runner): seeding is
   * silent machinery, so a seeded λ tap must NEVER reach the user's
   * real bubble switch. The whole pass is bracketed in the scenario's
   * seed-mode — while it stands, any setLambda absorbs into the
   * fiction ledger only, whichever perform path a port takes — and
   * each step is performed through the port's seeded path when it
   * offers one (performSeeded). The seed-miss record above stands
   * alongside: the bracket governs the λ, the record governs honesty.
   */
  function seedBefore(target: number): void {
    if (!port || !scenarioLive) {
      builtThrough = Math.max(builtThrough, target)
      return
    }
    let missedThisCall = false
    const seedMiss = (flatStep: FlatStep): void => {
      // P17 seeding honesty: seeding stays VISUALLY silent — never silent
      // in the record. Any miss is skip-logged as 'seed-miss'; a REQUIRED
      // miss also raises the persisted seededRequiredMiss flag.
      missedThisCall = true
      recordSkip(flatStep, 'seed-miss')
      if (!flatStep.step.optional) {
        seededRequiredMissRun = true
        progress = { ...progress, seededRequiredMiss: true }
      }
    }
    const seedScenario = port.scenario
    let seedModeOn = false
    try {
      seedScenario?.stage.beginLambdaSeed()
      seedModeOn = true
    } catch {
      seedModeOn = false
    }
    try {
      while (builtThrough < target) {
        const flatStep = flat[builtThrough]
        builtThrough += 1
        if (!flatStep) break
        // R2-T6-5: a step already PERFORMED this run is never re-performed
        // by seeding. `builtThrough` advances only when a step COMPLETES,
        // so a performed-but-not-completed step stands in front of the
        // frontier — inside «Show me»'s result dwell, and in Automatic
        // between the perform and the advance. A chapters jump landing
        // past it re-seeded it through the port, and a toggle-shaped act
        // (the λ tap above all) inverted the very state its performance
        // had just taught. Its fiction stands exactly as its performance
        // left it; the frontier simply walks past.
        if (livedPerformed.has(stepKey(flatStep))) continue
        const record = anchorById(flatStep.step.anchorId)
        let preconditionFailed = false
        if (record?.precondition && options.performPrecondition) {
          try {
            preconditionFailed = options.performPrecondition(record, flatStep) === false
          } catch {
            preconditionFailed = true
          }
        }
        if (preconditionFailed) {
          seedMiss(flatStep)
          continue
        }
        const res = resolveStep(flatStep.step)
        if (res.status !== 'resolved') {
          seedMiss(flatStep)
          continue
        }
        try {
          if (typeof port.performSeeded === 'function') port.performSeeded(flatStep, res)
          else port.perform(flatStep, res)
          // P13: a seeded step counts as performed — a later entry onto it
          // never performs it again (a seeded λ toggle must not invert).
          livedPerformed.add(stepKey(flatStep))
        } catch {
          // Machinery never breaks an entry: a failed seed act leaves the
          // fiction as the live acts built it, and the target beat's own
          // resolution decides what the learner sees — but it is recorded.
          seedMiss(flatStep)
        }
      }
    } finally {
      if (seedModeOn) {
        try {
          seedScenario?.stage.endLambdaSeed()
        } catch {
          // Seed-mode is scenario-local; a failure to leave it cannot
          // break the entry either — teardown clears it regardless.
        }
      }
    }
    // Persist the honesty record now (suppressed centrally while opening;
    // confirmStart's deferred markPlace then carries it whole).
    if (missedThisCall) persistProgress()
  }

  /**
   * P12 reveal eligibility: a miss may still MATERIALISE when its anchor's
   * declared precondition is sheet/menu-style — the AnchorRecord carries
   * the precondition as free text (registry §5), so sheet/menu-style is
   * read from that declared text (sheet / menu / unfold / open) — or when
   * the previous step in the script declares `establishes`. State
   * preconditions (reading view, shell present, selection mode…) are not
   * materialising waits and never qualify.
   */
  function revealEligible(step: FlatStep): boolean {
    const prev = flat[step.globalIndex - 1]
    if (prev?.step.establishes) return true
    const precondition = anchorById(step.step.anchorId)?.precondition ?? ''
    return /sheet|menu|unfold|open/i.test(precondition)
  }

  /** One declared resolution attempt: the declared precondition hook first, then the live resolver. */
  function tryResolve(step: FlatStep): AnchorResolution {
    const record = anchorById(step.step.anchorId)
    let preconditionFailed = false
    if (record?.precondition && options.performPrecondition) {
      try {
        preconditionFailed = options.performPrecondition(record, step) === false
      } catch {
        preconditionFailed = true
      }
    }
    return preconditionFailed
      ? { status: 'miss', record, anchorId: step.step.anchorId, reason: 'precondition-failed' }
      : resolveStep(step.step)
  }

  function enterCurrent(): void {
    stopPending()
    revealTries = 0
    attemptEnter()
  }

  function attemptEnter(): void {
    // R2-T6-3: an opening-phase reveal retry fired on a clock resumed
    // for that wait alone (below). The attempt has landed now — restore
    // the phase's held stillness BEFORE anything below arms a perform
    // or advance wait on the clock.
    if (openingRevealResumed) {
      openingRevealResumed = false
      clock.pause()
    }
    const step = flat[pointer]
    if (!step) {
      finishCompleted()
      return
    }

    // Resolve LATE and LIVE, at this moment, for this step only.
    const res = tryResolve(step)

    if (res.status === 'miss' && revealTries < 12 && revealEligible(step)) {
      // P12 REVEAL WAIT: retry the SAME declared resolution every 100
      // presentation-ms, up to 1200, while its declared precondition
      // materialises. No fallback locator, no coordinates. During the
      // wait NOTHING is emitted and `current` does not move — the
      // previous beat's snapshot stands.
      revealTries += 1
      cancelReveal = clock.after(100, () => {
        cancelReveal = null
        attemptEnter()
      })
      if (opening) {
        // The opening hold has the clock paused, and a wait on a paused
        // clock never arms — left so, the retry could never fire and
        // the phase deadlocked (R2-T6-3). Resume the clock for the
        // wait: in this phase it is the only wait that can be pending,
        // and the attempt it fires re-pauses on landing (above).
        openingRevealResumed = true
        clock.resume()
      }
      return
    }

    // A step is COMPLETED when a lived walk leaves it for the very
    // next step after presenting it (T6-15): the forward advance is
    // the only honest witness — landings, chapter jumps and resumes
    // move the place without completing anything, and seeding never
    // passes through here at all. The optional-miss path below also
    // lands here first (the missed step takes `current`, counts as
    // passed, and completes when the walk moves on past it).
    if (current && step.globalIndex === current.globalIndex + 1 && presentedSteps.has(current.globalIndex)) {
      witnessStep(current)
    }

    current = step
    endReason = undefined
    notice = undefined
    resolution = res

    if (resolution.status === 'miss') {
      recordSkip(step, resolution.reason)
      if (step.step.optional) {
        // Skip + log; the scene continues at the next step. The skipped step
        // counts as passed for place purposes: resume lands after it. It
        // also counts as passed for the built frontier: its act can never
        // be performed, so seeding never owes it either. And it counts as
        // walked for the presented set (H-28): the machinery passed it
        // DURING a lived walk, in order — unlike a seeded step, which no
        // walk ever met.
        presentedSteps.add(step.globalIndex)
        builtThrough = Math.max(builtThrough, step.globalIndex + 1)
        pointer = step.globalIndex + 1
        persistProgress()
        enterCurrent()
        return
      }
      // Required miss.
      hadRequiredMiss = true
      if (opening) {
        // P1: behind the opening window this must NOT silently finish.
        // Nothing is persisted, the scenario is NOT torn down, status
        // stays non-done, and only abortClean() exits from here.
        blockedOpening = true
        blockedNotice = REFRESH_LINE[lang]
        notice = REFRESH_LINE
        status = 'paused'
        resolution = null
        current = step
        emit()
        return
      }
      // The scene ends cleanly, back to the index, one plain line.
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

    // The step takes the stage: this run has PRESENTED it (H-28).
    presentedSteps.add(step.globalIndex)
    // Presentation strikes the step's skip-log entry (R3-T6-4): the
    // log is the record's standing witness that this step was once
    // skipped and never since presented — the finish rule bars `seen`
    // while any entry stands, and a lived presentation is the one act
    // that answers it. (Seeding never passes through here: a seeded
    // step was built, not presented, and strikes nothing.)
    if (progress.skips.some((s) => s.step === step.globalIndex)) {
      progress = { ...progress, skips: progress.skips.filter((s) => s.step !== step.globalIndex) }
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

  /** confirmStart() on a blocked prepare: finalise the entry required miss exactly as a normal run ends it. */
  function finalizeBlockedOpening(): void {
    const step = current
    blockedOpening = false
    blockedNotice = undefined
    if (!step) return
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
    teardownScenario('required-anchor-miss')
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
    // And it is COMPLETED (T6-15): this is the one witness overall
    // progress trusts — a step the walk itself presented and passed.
    witnessStep(current)
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
    // The final step completes here (T6-15): a finished run has no
    // "next step" for the advance rule to witness, so the finish
    // itself is the witness — but only for a step this run actually
    // presented (a landing straight onto the end beat completes
    // nothing).
    const lastFlat = flat[flat.length - 1]
    if (lastFlat && presentedSteps.has(lastFlat.globalIndex)) witnessStep(lastFlat)
    // P17 finish rule: 'seen' ONLY with no disqualifier — a clean full
    // play, no required miss (walked), no seeded required miss, and a
    // run-local skip count of zero. ANY skip (required or optional,
    // walked or seeded) lands 'needs-refresh'. Preserved from before:
    // a resumed tail of a healthy record still completes to 'seen' (it
    // carries no disqualifier), a resumed tail never CLEARS a
    // pre-existing needs-refresh, and a genuinely clean full replay does.
    // H-28 (restored, R2-T6-1) composes into the same rule: FULL also
    // means PRESENTED — every step took the stage in this run (or was
    // machinery-passed as an optional miss during the walk). A run that
    // reached the end over un-presented steps, carrying no P17
    // disqualifier, completes as in-progress at the end beat below.
    //
    // THE FINISH JUDGES THE RECORD TOO (R3-T6-1/4/5): the run-local
    // tallies above are only half the evidence — the record carries
    // two witnesses of its own, and the finish now opens both.
    // COVERAGE: a finish earns 'seen' only when every step is either
    // presented by this run or witnessed complete by the record's
    // done set — as admitted at the seed, under its signature
    // (R4-T6-3): `doneSteps` here is never the raw stored set, so a
    // position a script revision reseated cannot testify. A «Watch»
    // landing or an unearned resume point walks
    // a tail over steps no run ever presented and no walk completed,
    // and lands in-progress at the end beat whatever its startedAt.
    // THE SKIP LOG: an entry still standing names a step that was
    // skipped and never presented since (presentation strikes its
    // entry — attemptEnter), so it disqualifies exactly as a run-local
    // skip does, across runs: P17's bar is a property of the module's
    // history, not of one run's memory. And a standing needs-refresh
    // is never SOFTENED by any finish branch — the in-progress landing
    // below keeps the flag, and keeps its seededRequiredMiss account,
    // whenever the record carries them; only a clean full play clears
    // either, as the fall-through already ruled.
    const presentedEveryStep = flat.every((f) => presentedSteps.has(f.globalIndex))
    const coveredEveryStep = flat.every(
      (f) => presentedSteps.has(f.globalIndex) || doneSteps.has(f.globalIndex),
    )
    const outstandingSkips = progress.skips.length > 0
    const cleanFullPlay = startedAt === 0 && !hadRequiredMiss && presentedEveryStep && !outstandingSkips
    const disqualified = hadRequiredMiss || seededRequiredMissRun || runSkipCount > 0 || outstandingSkips
    if (!disqualified && !coveredEveryStep && flat.length > 0) {
      // The run reached the end over steps it never presented and no
      // walk ever completed — a chapters jump to the last beat and one
      // tap, a «Watch» landing, an unearned resume. It did not walk
      // the module: it completes as in-progress, resumable at the end
      // beat, never as seen. A standing needs-refresh is NOT softened
      // into in-progress here (R3-T6-5): the flag, and the account
      // that explains it, ride through the landing untouched.
      const last = flat[flat.length - 1]
      progress = {
        state: progress.state === 'needs-refresh' ? 'needs-refresh' : 'in-progress',
        step: last.globalIndex,
        scene: last.scene.id,
        stepId: last.step.id,
        verifiedAgainst: script.verifiedAgainst ?? appVersion,
        skips: progress.skips,
        seededRequiredMiss: progress.seededRequiredMiss,
      }
    } else {
      let nextState: ModuleProgress['state']
      if (disqualified) nextState = 'needs-refresh'
      else if (cleanFullPlay) nextState = 'seen'
      else if (progress.state === 'needs-refresh') nextState = 'needs-refresh'
      else nextState = 'seen'
      progress = {
        state: nextState,
        verifiedAgainst: script.verifiedAgainst ?? appVersion,
        skips: progress.skips,
        // The seeded-miss flag stands while it is the reason for the flag;
        // a clean finish clears it from the record. While the flag
        // STANDS (any needs-refresh landing), its account stands with
        // it — a finish that keeps the flag keeps the reason it is
        // flagged (R3-T6-5); only a 'seen' landing clears the account.
        seededRequiredMiss:
          nextState === 'seen'
            ? undefined
            : seededRequiredMissRun || progress.seededRequiredMiss
              ? true
              : undefined,
      }
    }
    // The last-used mark clears when the module completes (Brizna's
    // pattern): a finished module returns to its floor in the index.
    if (progress.state === 'seen') lastUsedModule = null
    status = 'done'
    endReason = 'completed'
    if (opening) {
      // P1: a finish reached during prepare persists and tears down only
      // on confirmStart — nothing leaves the phase early.
      finishDeferred = true
      emit()
      return
    }
    persistProgress()
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
      // start() keeps its current semantics exactly: prepare + confirm,
      // synchronously — existing tests and harnesses see one call, and
      // the entry beat emits once, at the confirm.
      startBatching = true
      try {
        runner.prepare(startOptions)
      } finally {
        startBatching = false
      }
      runner.confirmStart()
    },

    prepare(startOptions = {}) {
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
      stayWindowOpen = false
      closeWindowOpen = false
      blockedOpening = false
      blockedNotice = undefined
      finishDeferred = false
      cleanAbortFlag = false
      openingRevealResumed = false
      releaseOpeningShield(false)
      hiddenWasPlaying = false
      hiddenClockWasRunning = false
      hiddenOutstanding = false
      livedPerformed.clear()
      presentedSteps = new Set()
      runSkipCount = 0
      runSkipChapters = []
      runSkipChapterIds = new Set()
      seededRequiredMissRun = false
      // The last-used mark is recorded from module start (Brizna's
      // pattern); enterCurrent's markPlace persists it with the place —
      // in this phase that persistence is SUPPRESSED (below) and the
      // mark lands only on confirmStart().
      lastUsedModule = script.id
      // Every run starts with an empty return stack — even a resumed one:
      // ‹ answers only for places THIS run has lived.
      returnStack = []
      // …and with an unbuilt frontier: this run's scenario is fresh, so
      // a resume's fiction must be seeded up to the recorded place.
      builtThrough = 0
      scenarioLive = port !== null
      let startAt = 0
      let hasRecordedPlace = false
      if (resume && (progress.state === 'in-progress' || progress.state === 'needs-refresh')) {
        if (typeof progress.step === 'number' && progress.step >= 0 && progress.step < flat.length) {
          startAt = progress.step
          hasRecordedPlace = true
        }
      }
      // A launch point (canon's H-26 cure, restored over the lane
      // runner — the integration map's §8 threading): «My scenes» and
      // search «Watch» name a place outside the module's own progress
      // record, and it outranks the record. The stepId is the exact
      // identity and wins; the recorded step, then the scene's first
      // step, are its fallbacks. An unresolvable point falls through
      // to the ordinary resume rather than landing nowhere.
      const launchPoint = startOptions.resumeFrom
      if (launchPoint) {
        let launchAt = -1
        if (launchPoint.stepId) launchAt = flat.findIndex((f) => f.step.id === launchPoint.stepId)
        if (launchAt < 0 && typeof launchPoint.step === 'number' && launchPoint.step >= 0 && launchPoint.step < flat.length) {
          launchAt = Math.floor(launchPoint.step)
        }
        if (launchAt < 0 && launchPoint.scene) launchAt = flat.findIndex((f) => f.scene.id === launchPoint.scene)
        if (launchAt >= 0) {
          startAt = launchAt
          hasRecordedPlace = true
        }
      }
      // P14: on a RESUMED start, the record's mode and paused state win
      // over host defaults; a fresh start keeps the host's.
      if (hasRecordedPlace && progress.mode) mode = progress.mode
      userPaused = hasRecordedPlace ? progress.userPaused === true : false
      startedAt = startAt
      // P1: the clock is HELD from t=0 — before any scheduleCurrent — so
      // Automatic cannot advance behind the opening window, and
      // persistence is suppressed until confirmStart().
      opening = true
      // A resumed user-paused lesson pauses the clock BEFORE the hold is
      // taken, so the hold remembers "was not running" and confirmStart's
      // endHold cannot resurrect it.
      if (userPaused) clock.pause()
      clock.beginHold()
      // R2-T6-3: the snapshot shows the phase from the moment it begins.
      // (The reveal branch below returns without an emit by design —
      // mid-run the previous beat stands — but in prepare there IS no
      // previous beat: without this emit the creation snapshot, with
      // opening=false, stood for the whole phase and the player never
      // rendered the window at all.)
      emit()
      // ENTRY SEEDING: the recorded place's fiction is built BEFORE the
      // first presented beat — the earlier scenes' scenario acts replay
      // silently, in order, so the beat lands on the stage it teaches.
      seedBefore(startAt)
      // R2-T6-4: with the entry's fiction built, the shield goes up —
      // seed-mode held across the whole opening phase, so the stage's
      // own controls cannot write the real switch before «Empezar».
      engageOpeningShield()
      pointer = startAt
      enterCurrent()
    },

    confirmStart() {
      if (!opening) return
      opening = false
      openingRevealResumed = false
      // R2-T6-4: the shield comes down as the lesson is confirmed —
      // the ledger restored to its seeded value first, so a stage tap
      // behind the window cannot invert the lesson's own teaching.
      releaseOpeningShield(true)
      clock.endHold()
      if (blockedOpening) {
        // The entry beat's required miss, finalised the way start()
        // always ended it (see the interface note).
        finalizeBlockedOpening()
        return
      }
      if (finishDeferred) {
        finishDeferred = false
        persistProgress()
        teardownScenario('completed')
        emit()
        return
      }
      // The deferred place + last-used write for the beat on stage.
      // (Timers armed while the clock was held kept their full remaining
      // presentation time — the clock's hold never consumed them — so
      // endHold above is itself the re-arm: in Automatic the current
      // beat's two-phase schedule runs from this confirmation.)
      if (current) markPlace(current)
      emit()
    },

    abortClean() {
      const wasOpening = opening
      const wasBlocked = blockedOpening
      stopPending()
      openingRevealResumed = false
      if (stayWindowOpen || closeWindowOpen) {
        stayWindowOpen = false
        closeWindowOpen = false
        clock.endHold()
      }
      if (wasOpening) {
        opening = false
        clock.endHold()
      }
      releaseOpeningShield(false)
      if (wasBlocked) {
        // R2-T6-6: a BLOCKED opening's exit is not the clean abort.
        // The entry miss is a fact about the lesson, not the learner's
        // declination — and «Ahora no» is the only exit the window
        // renders — so leaving by it finalises the miss exactly as
        // confirmStart would: needs-refresh on the record, the skip
        // already in the log. (An UNBLOCKED «Ahora no» still writes
        // nothing, byte-identical, below.)
        finalizeBlockedOpening()
        return
      }
      blockedOpening = false
      blockedNotice = undefined
      // NO markPlace, NO last-used write, NO progress write: the record
      // on disk stays byte-identical to before prepare().
      status = 'aborted'
      endReason = 'abort'
      cleanAbortFlag = true
      teardownScenario('abort')
      emit()
    },

    handleHidden() {
      if (status !== 'playing' && status !== 'paused' && status !== 'interactive-wait') return
      if (!hiddenOutstanding) {
        hiddenOutstanding = true
        // Playing = Automatic, running, not user-paused, no window/hold.
        hiddenWasPlaying =
          mode === 'automatic' &&
          status === 'playing' &&
          !userPaused &&
          !stayWindowOpen &&
          !closeWindowOpen &&
          !opening &&
          !clock.holdOpen &&
          !clock.speedChoiceOpen
        // The clock's own truth, for BOTH modes: was it running when the
        // app hid? (A held or user-paused clock reads paused here, so
        // those lessons stay still across the cycle, as they must.)
        hiddenClockWasRunning = !clock.paused
      }
      clock.pause()
      persistProgress() // carries mode + userPaused (suppressed while opening)
    },

    handleVisible() {
      const wasPlaying = hiddenWasPlaying
      const clockWasRunning = hiddenClockWasRunning
      hiddenWasPlaying = false
      hiddenClockWasRunning = false
      hiddenOutstanding = false
      // Resume ONLY a clock that was running when it hid: a user-paused
      // lesson stays paused, a window-held lesson stays held. For
      // Automatic that is exactly the was-playing discipline; for
      // Interactive it revives the lesson's own pending waits (the
      // «Show me» dwell, a reveal wait) so they can complete — the
      // lesson then waits for the learner again, as it should.
      if (wasPlaying || clockWasRunning) clock.resume()
    },

    pause() {
      if (opening) return // P1: transport stands down behind the opening window
      if (stayWindowOpen || closeWindowOpen) return // a window is modal; the clock already stands still
      if (status !== 'playing') return
      userPaused = true
      clock.pause()
      status = 'paused'
      persistProgress() // P14: the paused state is part of the record
      emit()
    },

    resume() {
      if (opening) return
      if (stayWindowOpen || closeWindowOpen) return
      if (status !== 'paused') return
      userPaused = false
      status = 'playing'
      clock.resume()
      persistProgress()
      emit()
    },

    next() {
      if (opening) return
      if (stayWindowOpen || closeWindowOpen) return // nothing advances behind a window
      if (showMeDwelling) return // P16: › stays inert while the shown result dwells
      // The nav-pair law: on a gesture beat, › would skip the gesture —
      // it does not exist there, and neither does its effect. The
      // learner's own act on the stage, or «Show me», is the way through.
      if (status === 'interactive-wait' && current && isGestureBeat(current.step)) return
      if (status === 'interactive-wait' || status === 'playing' || status === 'paused') completeCurrent()
    },

    userAct() {
      if (opening) return
      if (stayWindowOpen || closeWindowOpen) return
      if (showMeDwelling) return
      if (status === 'interactive-wait') {
        // P13: the learner's own act counts as performed — a later mode
        // switch or re-entry must never perform this step again.
        if (current) livedPerformed.add(stepKey(current))
        completeCurrent()
      }
    },

    showMe() {
      if (opening) return
      if (stayWindowOpen || closeWindowOpen) return
      if (showMeDwelling) return // a second «Show me» during the dwell is inert
      if (status !== 'interactive-wait' || !current) return
      // Perform NOW (cancelling any scheduled perform — e.g. an ask's
      // read delay), then dwell on the result: the step completes only
      // after RESULT_DWELL_MS on the presentation clock (P16), which
      // respects pause, holds and windows like every other wait.
      cancelPerformTimer()
      if (resolution && resolution.status === 'resolved') doPerform(current, resolution)
      showMeDwelling = true
      const dwelling = current
      cancelPending = clock.after(RESULT_DWELL_MS, () => {
        cancelPending = null
        showMeDwelling = false
        if (current === dwelling) completeCurrent()
      })
      emit()
    },

    back() {
      if (opening) return
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
      if (opening) return
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
      if (opening) return
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
        persistProgress() // P14: the new mode is part of the record
        emit()
      } else {
        status = userPaused ? 'paused' : 'playing'
        // P13: performCurrent is lived-guarded — if the learner already
        // acted this step by hand, this performs nothing a second time;
        // the advance is (re)scheduled regardless.
        performCurrent()
        scheduleCurrent()
        persistProgress()
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
      // P16 fix: a perform still PENDING (scheduled, not yet fired) is
      // cancelled and re-scheduled at the NEW language's performDelayMs,
      // and the advance re-armed at the new stepDurationMs — the act
      // still happens exactly once. (The old code stopped both timers
      // and re-armed only the advance: the act was silently deleted.)
      // If the perform already fired, only the advance is re-armed.
      if (current && mode === 'automatic' && (status === 'playing' || status === 'paused')) {
        const owed = performPending
        cancelPerformTimer()
        cancelAdvanceTimer()
        if (owed) performCurrent()
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
      if (opening) return
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
      if (opening || stayWindowOpen || closeWindowOpen || !current) return
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
      if (opening) return // P1: the opening phase exits only via confirmStart / abortClean
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
      if (opening || closeWindowOpen || stayWindowOpen || !current) return
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
      if (opening) return // P1: use abortClean() — it writes nothing
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
