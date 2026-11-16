/**
 * The scenario port — the runner's ONLY door to performed acts.
 *
 * While a module runs, the sealed scenario sandbox is the only data surface
 * (PLAN §0.2): the runner never clicks a real control, never calls a real
 * store, never touches the shell. Every act a lesson performs is handed to
 * this port, and the port acts on the scenario — the fiction stage's own
 * state and backends, which no real payload can reach.
 *
 * A host stage (the future fiction-stage component) supplies its own
 * `perform` to rehearse its exact gestures. The default port below covers
 * the scenario-native verbs the sandbox itself owns — the λ flip (through
 * the sandbox's own LambdaPort discipline), the clipboard replace, sentence
 * advance, the ⚑ mark, saving what's playing, and loading a fiction text —
 * keyed by anchor id + act, never by position or appearance. Any other step
 * (say / ask / hover / a focus beat) performs no data act: pointing and
 * narrating are the player's, not the data surface's.
 *
 * Teardown is the port's other half: natural end, ✕, required miss and
 * «Stay here» all discard the scenario whole through the same path
 * (FENCE-DESIGN §7 clause 7) — and, since the C-1 cure, that same
 * teardown restores the real bubble switch to the value it held at
 * presentation entry, so the one real touch a lesson is allowed can
 * never leak past an exit.
 */
import { CLIP_TEXT, SCENARIO_TEXTS, type Scenario } from '../scenario/index.ts'
import type { AnchorResolution } from './resolve.ts'
import type { FlatStep } from './types.ts'

export type ScenarioTeardownReason = 'completed' | 'required-anchor-miss' | 'stay-here' | 'abort'

export interface ScenarioPort {
  /** The sealed scenario this port acts on. */
  readonly scenario: Scenario
  /** Perform one step's act on the scenario. Called by the runner only. */
  perform: (flat: FlatStep, resolution: AnchorResolution) => void
  /**
   * Perform one step's act as ENTRY SEEDING (silent machinery, the
   * runner's seedBefore only). Identical to perform for every data act
   * EXCEPT the λ tap: a seeded λ tap is absorbed by the scenario's own
   * internal state (stage.setLambdaSeeded) and never reaches the real
   * bubble switch — resuming or jumping into a lesson must not flip
   * the user's switch before any beat is shown (H-1). Optional: ports
   * without it are still safe under the runner, which brackets seeding
   * in the scenario's own seed-mode (stage.beginLambdaSeed).
   */
  performSeeded?: (flat: FlatStep, resolution: AnchorResolution) => void
  /** Discard the scenario whole. Idempotent. */
  teardown: (reason: ScenarioTeardownReason) => void
}

/** A host stage's own perform, layered over the default scenario verbs. */
export type ScenarioPerform = (flat: FlatStep, resolution: AnchorResolution, scenario: Scenario) => void

/**
 * Build a port over a scenario. `hostPerform`, when given, runs FIRST (the
 * stage's own gesture); the default verbs then apply for the anchor ids the
 * sandbox owns natively, unless the host perform already handled the step
 * by returning through `handled` — keep it simple: hosts that need full
 * control pass a perform that covers their anchors, and the defaults only
 * fire for the sandbox-native ids listed below.
 */
export function createScenarioPort(scenario: Scenario, hostPerform?: ScenarioPerform): ScenarioPort {
  let tornDown = false

  /** One perform path, two λ disciplines: a PRESENTED λ tap genuinely
   *  flips the real switch (that flip IS the demonstration), while a
   *  SEEDED λ tap is absorbed by the scenario's internal state only. */
  function performInternal(flat: FlatStep, resolution: AnchorResolution, seeded: boolean): void {
    if (tornDown) return
    hostPerform?.(flat, resolution, scenario)
    const { step } = flat
    const stage = scenario.stage

    // The λ itself (Q2's one real touch goes through the sandbox's
    // LambdaPort discipline inside setLambda — see scenario.ts).
    if (step.anchorId === 'bubble-lambda' && step.act === 'tap') {
      if (seeded) stage.setLambdaSeeded(!stage.lambdaOn())
      else stage.setLambda(!stage.lambdaOn())
      return
    }
      // The lever: a copied text takes the stage and replaces what's playing.
      if (step.anchorId === 'bubble-clip' && (step.act === 'tap' || step.act === 'goto')) {
        stage.playClipboardText(CLIP_TEXT.text)
        return
      }
      // Undo the replace (restores the previous text, loaded — PLAN §2.6-1).
      if (step.anchorId === 'bubble-clip' && step.act === 'key' && step.payload?.key === 'Undo') {
        stage.undoReplace()
        return
      }
      // Next sentence on the stage.
      if (step.anchorId === 'listen-next' && step.act === 'tap') {
        stage.advance()
        return
      }
      // ⚑ — a mark on the moment being heard (scenario marks only).
      if ((step.anchorId === 'listen-mark' || step.anchorId === 'bubble-mark') && step.act === 'tap') {
        stage.markHere()
        return
      }
      // Save what's playing to the scenario Library.
      if (step.anchorId === 'bubble-save' && step.act === 'tap') {
        void stage.saveCurrentToLibrary()
        return
      }
      // Load a fiction text: a goto whose parameter names the text, or a
      // Play step whose parameter names it. Fiction ids only — the sandbox
      // itself refuses anything it does not hold.
      const textId = step.payload?.param
      if (textId && SCENARIO_TEXTS.some((t) => t.id === textId) && (step.act === 'goto' || step.act === 'tap')) {
        stage.playText(textId)
        return
      }
    // Every other step performs no data act on the scenario.
  }

  return {
    scenario,

    perform(flat, resolution) {
      performInternal(flat, resolution, false)
    },

    performSeeded(flat, resolution) {
      performInternal(flat, resolution, true)
    },

    teardown() {
      if (tornDown) return
      tornDown = true
      // scenario.teardown() also restores the real bubble switch to
      // its entry value (the C-1 cure, scenario.ts): every exit the
      // runner takes funnels through here.
      scenario.teardown()
    },
  }
}
