/**
 * The presentation's own per-device state (FENCE-DESIGN §7 clause 5).
 *
 * ONE key — `logos.presentation.state.v1` — is the only real key a
 * presentation may ever write (the λ toggle in Q2 is the single other
 * exception, Fence 0's E-λ; the presentation's own bookkeeping is E-state).
 * The shape, exactly as designed:
 *
 *   { modules: { <moduleId>: { state, step?, scene?, stepId?,
 *                              verifiedAgainst, skips: [...],
 *                              mode?, userPaused?, seededRequiredMiss? } },
 *     speed: <the user's remembered speed, one per user>,
 *     speedScale: 2 <the pace-scale stamp: speed is a NEW label (P2)>,
 *     myScenes: [ { module, scene, step, stepId?, savedAt } ],
 *     lastUsed?: <the last module used — set at module start and on every
 *                 advance, cleared when that module completes; the index
 *                 lifts it to the head while it stands in-progress> }
 *
 * `modules[id].state` is "unseen" | "in-progress" | "seen" | "needs-refresh";
 * an in-progress record points at the exact step Resume re-enters. The skip
 * log (§7 clause 4) lives inside each module's record. Nothing in this file
 * can carry scenario data: it holds module/scene/step/anchor ids, states and
 * timestamps only — the engine's payload-isolation test scans it with the
 * scenario leak scan to prove exactly that.
 *
 * Storage access is guarded: in node tests (or any host where localStorage
 * throws) an injected or in-memory storage is used instead — progress is
 * per-session there, which is honest degradation, never a crash.
 */
import { PRESENTATION_SPEEDS } from './engine/clock.ts'
import type { ModuleProgress, PresentationStateFile, SavedScene } from './engine/types.ts'

/** The presentation's own storage key — its one real key (E-state). */
export const PRESENTATION_STATE_KEY = 'logos.presentation.state.v1'

export interface PresentationStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

const memoryFallback = new Map<string, string>()

export function defaultPresentationStorage(): PresentationStorage {
  try {
    const local = (globalThis as { localStorage?: PresentationStorage }).localStorage
    if (local) {
      // Probe: some hosts expose localStorage but throw on use.
      const probe = 'logos-presentation-probe'
      local.setItem(probe, '1')
      local.getItem(probe)
      return local
    }
  } catch {
    // Fall through to the in-memory store.
  }
  return {
    getItem: (key) => memoryFallback.get(key) ?? null,
    setItem: (key, value) => {
      memoryFallback.set(key, value)
    },
  }
}

export function emptyPresentationState(): PresentationStateFile {
  return { modules: {}, speed: 1, speedScale: 2, myScenes: [] }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const MODULE_STATES: ReadonlySet<string> = new Set(['unseen', 'in-progress', 'seen', 'needs-refresh'])

/**
 * Sanitise anything found under the key into the one true shape. Unknown or
 * damaged content degrades to the empty state field by field — a corrupt
 * progress file must never break a lesson.
 */
export function normalizePresentationState(value: unknown): PresentationStateFile {
  if (!isRecord(value)) return emptyPresentationState()
  const out = emptyPresentationState()

  // Pace migration (P2), once, never reinterpret: a file whose
  // speedScale is not 2 holds an OLD-scale speed — the same label meant
  // twice the physical rate — so it is DISCARDED to the new label 1,
  // never carried across. Only a file already stamped 2 has its stored
  // label validated against the five speeds. Either way the returned
  // state carries speedScale: 2 (emptyPresentationState), so the
  // migration can only ever run once. This normaliser is the single
  // gate: every reader of the stored speed goes through it.
  if (value.speedScale === 2) {
    out.speedScale = 2
    if (typeof value.speed === 'number' && PRESENTATION_SPEEDS.includes(value.speed)) {
      out.speed = value.speed
    }
  } else {
    out.speed = 1
    out.speedScale = 2
  }

  if (isRecord(value.modules)) {
    for (const [id, raw] of Object.entries(value.modules)) {
      if (!isRecord(raw)) continue
      const progress: ModuleProgress = {
        state: typeof raw.state === 'string' && MODULE_STATES.has(raw.state)
          ? (raw.state as ModuleProgress['state'])
          : 'unseen',
        verifiedAgainst: typeof raw.verifiedAgainst === 'string' ? raw.verifiedAgainst : '',
        skips: Array.isArray(raw.skips)
          ? (raw.skips.filter(isRecord) as unknown as ModuleProgress['skips'])
          : [],
      }
      if (typeof raw.step === 'number' && Number.isFinite(raw.step)) progress.step = raw.step
      if (typeof raw.scene === 'string') progress.scene = raw.scene
      if (typeof raw.stepId === 'string') progress.stepId = raw.stepId
      if (raw.mode === 'automatic' || raw.mode === 'interactive') progress.mode = raw.mode
      if (typeof raw.userPaused === 'boolean') progress.userPaused = raw.userPaused
      if (typeof raw.seededRequiredMiss === 'boolean') progress.seededRequiredMiss = raw.seededRequiredMiss
      out.modules[id] = progress
    }
  }

  if (typeof value.lastUsed === 'string' && value.lastUsed) out.lastUsed = value.lastUsed

  if (Array.isArray(value.myScenes)) {
    for (const raw of value.myScenes) {
      if (!isRecord(raw)) continue
      if (typeof raw.module !== 'string' || typeof raw.scene !== 'string') continue
      if (typeof raw.step !== 'number' || !Number.isFinite(raw.step)) continue
      const saved: SavedScene = {
        module: raw.module,
        scene: raw.scene,
        step: raw.step,
        savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : '',
      }
      if (typeof raw.stepId === 'string') saved.stepId = raw.stepId
      out.myScenes.push(saved)
    }
  }

  return out
}

/** Read + sanitise the state file (missing/corrupt → the empty state). */
export function loadPresentationState(storage: PresentationStorage): PresentationStateFile {
  try {
    const raw = storage.getItem(PRESENTATION_STATE_KEY)
    if (!raw) return emptyPresentationState()
    return normalizePresentationState(JSON.parse(raw) as unknown)
  } catch {
    return emptyPresentationState()
  }
}

/** Persist the state file under its one key. Never throws. */
export function savePresentationState(storage: PresentationStorage, state: PresentationStateFile): void {
  try {
    storage.setItem(PRESENTATION_STATE_KEY, JSON.stringify(state))
  } catch {
    // Progress is a convenience, never a reason to break a lesson.
  }
}

/** A module's progress record, or null when the module was never played. */
export function moduleProgress(state: PresentationStateFile, moduleId: string): ModuleProgress | null {
  return state.modules[moduleId] ?? null
}

/**
 * THE current module — the one computation every surface reads (the
 * M-37 cure). The stay-here bookkeeping (the runner: a module standing
 * in-progress IS the lesson the learner is inside, and Resume re-enters
 * it) and the index's first-card head disagreed because they computed
 * "where you are" differently: the index gated on the file's `lastUsed`
 * mark alone, so a state file whose in-progress record stands WITHOUT
 * the mark — exactly the shape a search «Watch» landing writes first
 * (`withWatchLanding` writes the record; the mark is the runner's, set
 * when the launch actually starts) — read as "no current module" on
 * the index while the runner resumed that very module as current.
 *
 * The one truth, from the state layer:
 * - the marked module, while its record stands in-progress, is current
 *   (the first-card law's ordinary case);
 * - with no usable mark, a file holding EXACTLY ONE in-progress record
 *   has that module as its current — the record is unambiguous, and
 *   the runner already treats it so;
 * - otherwise (no in-progress record, or several and no mark to choose
 *   between them) there is honestly no current module: null.
 */
export function currentModuleId(state: PresentationStateFile): string | null {
  const marked = state.lastUsed
  if (marked && state.modules[marked]?.state === 'in-progress') return marked
  const inProgress = Object.keys(state.modules).filter((id) => state.modules[id].state === 'in-progress')
  return inProgress.length === 1 ? inProgress[0] : null
}

/** Return a new state with one module's progress replaced. */
export function withModuleProgress(
  state: PresentationStateFile,
  moduleId: string,
  progress: ModuleProgress,
): PresentationStateFile {
  return { ...state, modules: { ...state.modules, [moduleId]: progress } }
}

/**
 * The search «Watch» landing, as a MERGE — never a clobber (the H-27
 * cure). Watching one scene must never destroy state the learner
 * earned elsewhere in the module:
 * - a module never started gets the fresh in-progress record at the
 *   watched scene (the only case that writes a whole new record);
 * - an existing record keeps its state — a `seen` module stays seen,
 *   a `needs-refresh` flag is not cleared by watching — and keeps its
 *   whole skip log (§7 clause 4's diagnostic record);
 * - the resume point moves to the watched scene ONLY when that loses
 *   nothing: a record already further along keeps its further point
 *   (never rewound), and a completed module's point is moot (its
 *   state, not its point, is what the index announces). The launch
 *   itself carries the watched scene as its explicit resumeFrom, so
 *   «Watch» still lands exactly on the scene tapped.
 */
export function withWatchLanding(
  state: PresentationStateFile,
  moduleId: string,
  point: { step: number; scene: string; stepId?: string },
  verifiedAgainst: string,
): PresentationStateFile {
  const existing = state.modules[moduleId]
  if (!existing) {
    return withModuleProgress(state, moduleId, {
      state: 'in-progress',
      step: point.step,
      scene: point.scene,
      stepId: point.stepId,
      verifiedAgainst,
      skips: [],
    })
  }
  const further =
    existing.state !== 'seen' && typeof existing.step === 'number' && existing.step > point.step
  const merged: ModuleProgress = {
    state: existing.state === 'unseen' ? 'in-progress' : existing.state,
    step: further ? existing.step : point.step,
    scene: further ? existing.scene : point.scene,
    stepId: further ? existing.stepId : point.stepId,
    verifiedAgainst: existing.verifiedAgainst || verifiedAgainst,
    skips: existing.skips,
  }
  return withModuleProgress(state, moduleId, merged)
}

/** Return a new state with the remembered speed replaced (validated). */
export function withSpeed(state: PresentationStateFile, speed: number): PresentationStateFile {
  if (!PRESENTATION_SPEEDS.includes(speed)) return state
  return { ...state, speed }
}

/**
 * Return a new state with a scene saved into «My scenes». Saving the same
 * scene twice keeps one entry (the newest landing).
 */
export function withSavedScene(state: PresentationStateFile, saved: SavedScene): PresentationStateFile {
  const rest = state.myScenes.filter((s) => !(s.module === saved.module && s.scene === saved.scene))
  return { ...state, myScenes: [...rest, saved] }
}

/** Return a new state with a saved scene removed. */
export function withoutSavedScene(state: PresentationStateFile, module: string, scene: string): PresentationStateFile {
  return { ...state, myScenes: state.myScenes.filter((s) => !(s.module === module && s.scene === scene)) }
}

/**
 * Return a new state with the last-used mark set — or, with null, cleared
 * (the key itself leaves the file: an absent mark is the honest shape).
 */
export function withLastUsed(state: PresentationStateFile, moduleId: string | null): PresentationStateFile {
  if (moduleId === null) {
    if (state.lastUsed === undefined) return state
    const next = { ...state }
    delete next.lastUsed
    return next
  }
  return state.lastUsed === moduleId ? state : { ...state, lastUsed: moduleId }
}
