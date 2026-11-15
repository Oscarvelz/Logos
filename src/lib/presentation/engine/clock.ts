/**
 * The ONE presentation clock (PLAN §0.0; FENCE-DESIGN §5).
 *
 * Everything a presentation waits on — caption lifetimes, the ask beat,
 * action beats, hover rests — is scheduled on this clock and nothing else,
 * so the speed setting scales the whole performance and can be changed
 * live, mid-wait, in both directions, without losing place: a pending wait
 * keeps its *remaining presentation time*; only the wall-clock rate changes.
 *
 * THE SHARED CALIBRATION (FENCE-DESIGN §5): the constants below are the
 * single source both the player (through this module) and the duration
 * fence use. `stepDurationMs` / `moduleDurationMs` are the only functions
 * that turn a script into a duration, so an index label («Aprox. N min» /
 * "Approx. N min", computed at Automatic 1×) and the playback it labels can
 * never disagree — there is no second formula anywhere.
 *
 * Calibration (the fleet calibration, PLAN §0.0):
 * - CAPTION_MS_PER_WORD = 340 ms/word ≈ 176 words per minute — a comfortable
 *   average adult reading pace for short instructional captions.
 * - CAPTION_BASE_MS = 900 ms — the fixed cost of finding the caption,
 *   looking at the marked control, and coming back.
 * - CAPTION_MIN_MS = 1,600 / CAPTION_MAX_MS = 7,000 — floor and ceiling: no
 *   caption flashes by, and none overstays.
 * - ASK_BEAT_MS = 1,100 — after a question is asked, one held beat before
 *   the answer is shown (ask → one-beat pause → show).
 * - ACTION_BEAT_MS = 750 — the dwell after a performed act with no caption.
 * - HOVER_REST_MS = 280 — a hover's rest when it carries no caption.
 *
 * Captions are bilingual; a step's duration is computed in the language the
 * learner is hearing, and the duration fence computes the label in the same
 * language the index renders.
 */
import { wordCount, type BilingualText, type PresentationLanguage, type PresentationModule, type PresentationStep } from './types.ts'

export { wordCount }

export const PRESENTATION_SPEEDS: readonly number[] = [0.5, 0.75, 1, 1.5, 2]

export const CAPTION_BASE_MS = 900
export const CAPTION_MS_PER_WORD = 340
export const CAPTION_MIN_MS = 1600
export const CAPTION_MAX_MS = 7000
export const ASK_BEAT_MS = 1100
export const ACTION_BEAT_MS = 750
export const HOVER_REST_MS = 280

function textIn(text: string | BilingualText, lang: PresentationLanguage): string {
  return typeof text === 'string' ? text : text[lang]
}

/** On-screen life of a caption at 1×: base + per-word, floored and capped. */
export function captionDurationMs(text: string | BilingualText, lang: PresentationLanguage = 'en'): number {
  const raw = CAPTION_BASE_MS + wordCount(textIn(text, lang)) * CAPTION_MS_PER_WORD
  return Math.min(CAPTION_MAX_MS, Math.max(CAPTION_MIN_MS, raw))
}

/**
 * The 1× duration of one step, in the given language:
 * - ask: the question's own reading time + the held beat before the show.
 * - say (and any captioned act): the caption's reading time.
 * - hover: the caption's time, or the payload's rest (default 280 ms).
 * - an uncaptioned act: one action beat, to see what it did.
 */
export function stepDurationMs(step: PresentationStep, lang: PresentationLanguage = 'en'): number {
  if (step.act === 'ask') return captionDurationMs(step.question ?? '', lang) + ASK_BEAT_MS
  if (step.text) return captionDurationMs(step.text, lang)
  if (step.act === 'hover') return step.payload?.holdMs ?? HOVER_REST_MS
  return ACTION_BEAT_MS
}

/** A module's complete duration at Automatic 1×, from its script alone. */
export function moduleDurationMs(script: PresentationModule, lang: PresentationLanguage = 'en'): number {
  let total = 0
  for (const scene of script.scenes) {
    for (const step of scene.steps) total += stepDurationMs(step, lang)
  }
  return total
}

/** The labelled minutes for a duration: whole minutes, rounded up (D-2). */
export function durationMinutes(durationMs: number): number {
  return Math.max(1, Math.ceil(durationMs / 60_000))
}

/**
 * The index label, exactly as the law spells it (Oscar, 2026-11-14):
 * «Aprox. N min» in Spanish, "Approx. N min" in English — never «unos»,
 * never "about". Computed from the script at Automatic 1×, never handwritten.
 */
export function durationLabel(script: PresentationModule, lang: PresentationLanguage): string {
  const minutes = durationMinutes(moduleDurationMs(script, lang))
  return lang === 'es' ? `Aprox. ${minutes} min` : `Approx. ${minutes} min`
}

/** The same label from a raw duration (the fence's comparison form). */
export function durationLabelForMs(durationMs: number, lang: PresentationLanguage): string {
  const minutes = durationMinutes(durationMs)
  return lang === 'es' ? `Aprox. ${minutes} min` : `Approx. ${minutes} min`
}

/* ------------------------------------------------------------------ */
/* The clock itself                                                    */
/* ------------------------------------------------------------------ */

/** The timer surface the presentation clock needs — injectable for tests. */
export interface ClockTimer {
  now: () => number
  setTimeout: (callback: () => void, ms: number) => unknown
  clearTimeout: (handle: unknown) => void
}

const systemTimer: ClockTimer = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export interface PresentationClock {
  readonly speed: number
  readonly paused: boolean
  /**
   * First-class state (C′ card law): while the speed strip is open inside
   * the card, the clock is held — `beginSpeedChoice` pauses it, and
   * `endSpeedChoice` resumes it ONLY if it was running when the strip
   * opened (a clock the user had already paused stays paused).
   */
  readonly speedChoiceOpen: boolean
  beginSpeedChoice: () => void
  endSpeedChoice: () => void
  /**
   * A generic modal hold, the speed choice's sibling: while a hold is
   * open the clock is stopped — a lesson must not advance behind a
   * window (the stay-here window holds the clock this way) — and
   * `endHold` resumes it ONLY if it was running when the hold began (a
   * clock the user had already paused stays paused). Holds nest safely
   * with the speed choice: each remembers its own was-running.
   */
  readonly holdOpen: boolean
  beginHold: () => void
  endHold: () => void
  /** Change the rate live; pending waits keep their remaining presentation time. */
  setSpeed: (speed: number) => void
  /**
   * Schedule `callback` after `durationAt1x` presentation milliseconds.
   * Returns a cancel function. While paused, the wait is held, not consumed.
   */
  after: (durationAt1x: number, callback: () => void) => () => void
  pause: () => void
  resume: () => void
  /** Presentation milliseconds elapsed since the clock was created (pauses excluded). */
  elapsedMs: () => number
}

interface PendingWait {
  remainingAt1x: number
  startedWall: number
  handle: unknown
  callback: () => void
  cancelled: boolean
  armed: boolean
}

export function createPresentationClock(timer: ClockTimer = systemTimer): PresentationClock {
  let speed = 1
  let paused = false
  let speedChoiceOpen = false
  let speedChoiceWasRunning = false
  let holdOpen = false
  let holdWasRunning = false
  let elapsedBase = 0
  let runningSince: number | null = timer.now()
  const waits = new Set<PendingWait>()

  function elapsedMs(): number {
    if (runningSince === null) return elapsedBase
    return elapsedBase + (timer.now() - runningSince) * speed
  }

  function arm(wait: PendingWait): void {
    if (paused || wait.cancelled) return
    wait.startedWall = timer.now()
    wait.armed = true
    wait.handle = timer.setTimeout(() => {
      wait.armed = false
      waits.delete(wait)
      if (!wait.cancelled) wait.callback()
    }, wait.remainingAt1x / speed)
  }

  function disarm(wait: PendingWait): void {
    if (!wait.armed) return
    wait.armed = false
    if (wait.handle !== null && wait.handle !== undefined) timer.clearTimeout(wait.handle)
    wait.handle = null
    // Consume the presentation time that ran since this wait was (re)armed.
    wait.remainingAt1x = Math.max(0, wait.remainingAt1x - (timer.now() - wait.startedWall) * speed)
  }

  function pauseClock(): void {
    if (paused) return
    elapsedBase = elapsedMs()
    runningSince = null
    paused = true
    for (const wait of waits) disarm(wait)
  }

  function resumeClock(): void {
    if (!paused) return
    paused = false
    runningSince = timer.now()
    for (const wait of waits) arm(wait)
  }

  return {
    get speed() {
      return speed
    },
    get paused() {
      return paused
    },
    get speedChoiceOpen() {
      return speedChoiceOpen
    },
    beginSpeedChoice() {
      if (speedChoiceOpen) return
      speedChoiceOpen = true
      speedChoiceWasRunning = !paused
      pauseClock()
    },
    endSpeedChoice() {
      if (!speedChoiceOpen) return
      speedChoiceOpen = false
      if (speedChoiceWasRunning) {
        speedChoiceWasRunning = false
        resumeClock()
      }
    },
    get holdOpen() {
      return holdOpen
    },
    beginHold() {
      if (holdOpen) return
      holdOpen = true
      holdWasRunning = !paused
      pauseClock()
    },
    endHold() {
      if (!holdOpen) return
      holdOpen = false
      if (holdWasRunning) {
        holdWasRunning = false
        resumeClock()
      }
    },
    elapsedMs,
    setSpeed(next: number) {
      if (!PRESENTATION_SPEEDS.includes(next)) {
        throw new Error(`presentation clock: speed ${next} is not one of ${PRESENTATION_SPEEDS.join(' / ')}`)
      }
      if (next === speed) return
      for (const wait of waits) disarm(wait)
      speed = next
      for (const wait of waits) arm(wait)
    },
    after(durationAt1x, callback) {
      const wait: PendingWait = {
        remainingAt1x: Math.max(0, durationAt1x),
        startedWall: timer.now(),
        handle: null,
        callback,
        cancelled: false,
        armed: false,
      }
      waits.add(wait)
      arm(wait)
      return () => {
        wait.cancelled = true
        if (wait.handle !== null && wait.handle !== undefined) timer.clearTimeout(wait.handle)
        waits.delete(wait)
      }
    },
    pause: pauseClock,
    resume: resumeClock,
  }
}
