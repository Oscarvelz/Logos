/**
 * The presentation's own per-device state (FENCE-DESIGN §7 clause 5).
 *
 * ONE key — `logos.presentation.state.v1` — is the only real key a
 * presentation may ever write (the λ toggle in Q2 is the single other
 * exception, Fence 0's E-λ; the presentation's own bookkeeping is E-state).
 * The shape, exactly as designed:
 *
 *   { modules: { <moduleId>: { state, step?, scene?, stepId?, done?,
 *                              doneIds?, verifiedAgainst, skips: [...],
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
import { moduleStepCount } from './engine/module-lengths.ts'
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
      // The probe cleans up after itself (T6-13): the one-key law in
      // this file's header is accounting Fence 0 relies on, and a
      // probe key left behind made it false — ordinary app use wrote
      // `logos-presentation-probe=1` into the user's real storage
      // forever. The removal also sweeps the key earlier versions
      // already left there. removeItem is reached structurally: the
      // PresentationStorage interface stays get/set only, so injected
      // stores (tests, hosts) are untouched.
      try {
        ;(local as { removeItem?: (key: string) => void }).removeItem?.(probe)
      } catch {
        // A host that can write but not remove is pathological; the
        // probe has still proven what it came to prove.
      }
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
      // The module's registered length, when registration has fed it:
      // the one bound every numeric witness in this record is judged
      // against (done[] since R3-T6-2; the skip log and the resume
      // point since R4-T6-1/2). A module with no registered length
      // keeps the unbounded reading for whatever can still be judged
      // — the gate judges only what it can know.
      const total = moduleStepCount(id)
      const progress: ModuleProgress = {
        state: typeof raw.state === 'string' && MODULE_STATES.has(raw.state)
          ? (raw.state as ModuleProgress['state'])
          : 'unseen',
        verifiedAgainst: typeof raw.verifiedAgainst === 'string' ? raw.verifiedAgainst : '',
        // The skip log is a standing witness (R3-T6-4): an entry bars
        // `seen` until a lived walk presents its step and strikes it
        // — so it is validated element-wise with the same discipline
        // as done[] (R4-T6-1). An entry survives only if its step is
        // an integer this module has: a string, a fraction, an absent
        // or out-of-range step names no step a walk could ever
        // present, so the entry could never be struck and would bar
        // `seen` forever. Damage degrades to the honest subset here,
        // exactly as a damaged done[] degrades below.
        skips: Array.isArray(raw.skips)
          ? (raw.skips.filter(
              (entry): entry is Record<string, unknown> =>
                isRecord(entry) &&
                typeof entry.step === 'number' &&
                Number.isInteger(entry.step) &&
                entry.step >= 0 &&
                (total === undefined || entry.step < total),
            ) as unknown as ModuleProgress['skips'])
          : [],
      }
      // The resume point is a PLACE (R4-T6-2): it survives only as an
      // integer step this module has — the same bound prepare()'s
      // resume gate applies when it judges the field as a place to
      // stand. An out-of-range or fractional value is damage, and a
      // damaged place is dropped here, never left for the runner's
      // grandfather seed to clamp into a completed walk.
      if (
        typeof raw.step === 'number' &&
        Number.isInteger(raw.step) &&
        raw.step >= 0 &&
        (total === undefined || raw.step < total)
      ) {
        progress.step = raw.step
      }
      if (typeof raw.scene === 'string') progress.scene = raw.scene
      if (typeof raw.stepId === 'string') progress.stepId = raw.stepId
      if (Array.isArray(raw.done)) {
        // The completed-steps set (T6-15): whole, non-negative,
        // deduped, in order — a damaged list degrades to the honest
        // subset rather than breaking the record. Each index travels
        // with its signature (R4-T6-3): the id the writer's script
        // seated at that index, read from the parallel doneIds array
        // at the same raw position, so dedupe and ordering here can
        // never separate an index from the step it names.
        const rawIds = Array.isArray(raw.doneIds) ? raw.doneIds : null
        const pairs = new Map<number, string | undefined>()
        raw.done.forEach((n, i) => {
          if (typeof n === 'number' && Number.isFinite(n) && n >= 0) {
            const idx = Math.floor(n)
            if (!pairs.has(idx)) {
              pairs.set(idx, rawIds && typeof rawIds[i] === 'string' ? rawIds[i] : undefined)
            }
          }
        })
        let entries = [...pairs.entries()].sort((a, b) => a[0] - b[0])
        // The set is bounded by the module it witnesses (R3-T6-2):
        // an entry naming a step the module does not have means the
        // writer was not writing about THIS module — the set's
        // provenance is broken, so the witness is refused WHOLE.
        // (Filtering to the in-range subset would manufacture a
        // fully-walked module out of exactly such a file: 100 claimed
        // steps of a 37-step module would clamp to a complete walk.)
        // A module with no registered length keeps the unbounded
        // reading — the gate judges only what it can know.
        if (total !== undefined && entries.some(([n]) => n >= total)) entries = []
        progress.done = entries.map(([n]) => n)
        // The signature is kept only when it signs EVERY surviving
        // index: a set with an unsigned seat has no whole provenance,
        // and the runner reads an absent signature as exactly that
        // (R4-T6-3). A partial signature is damage, resolved here by
        // dropping the signature — never by aligning it loosely.
        if (entries.length > 0 && entries.every(([, stepId]) => typeof stepId === 'string')) {
          progress.doneIds = entries.map(([, stepId]) => stepId as string)
        }
      }
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

/* ── The first-run offer's answer ───────────────────────────────────
 * The offer (presentation-search.tsx) has its own real key: the
 * learner's answer, nothing else. It lives here, beside the state
 * file's own key, so the pending rule is testable without the React
 * tree — and so it is stated once. */

/** The offer's own key: set only when the offer is answered. */
export const PRESENTATION_OFFER_KEY = 'logos.presentation.offer.v1'

/**
 * The offer stands until it is ANSWERED either way — and only an
 * answer consumes it (T6-14). The old rule also required an
 * untouched state file, so any earlier contact with the system —
 * opening a module from Settings, a search «Watch» — permanently
 * suppressed an offer the learner had never seen, let alone
 * answered. And where `localStorage.getItem` throws
 * (storage-blocked WebViews, where the lessons themselves run fine
 * on the in-memory fallback) the old guard answered "not pending":
 * the offer could never appear there at all. An unreadable key is
 * an unanswered offer.
 */
export function offerPending(): boolean {
  try {
    return !localStorage.getItem(PRESENTATION_OFFER_KEY)
  } catch {
    return true
  }
}

/** Record the offer's answer. Never throws (private mode). */
export function answerOffer(): void {
  try {
    localStorage.setItem(PRESENTATION_OFFER_KEY, 'done')
  } catch {
    // The offer hides for the session regardless (the component's
    // own state); a host that cannot record the answer will simply
    // be offered again next time — the honest degradation.
  }
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
      // A landing completes nothing (T6-15): the record carries an
      // empty done set, so overall progress credits the watched
      // scene's module with zero walked steps until a lived walk
      // actually completes some — the old shape let the landing
      // point itself masquerade as walked fraction.
      done: [],
    })
  }
  const further =
    existing.state !== 'seen' && typeof existing.step === 'number' && existing.step > point.step
  // The merge starts from the WHOLE existing record and names only the
  // fields it means to change (the anti-Vela discipline, R2-T6-7): a
  // field-by-field rebuild here silently dropped the 186 fields —
  // `mode`, `userPaused` and `seededRequiredMiss` — from every record a
  // «Watch» landing touched. The spread carries them, and the skip log,
  // exactly as they stand.
  const merged: ModuleProgress = {
    ...existing,
    state: existing.state === 'unseen' ? 'in-progress' : existing.state,
    step: further ? existing.step : point.step,
    scene: further ? existing.scene : point.scene,
    stepId: further ? existing.stepId : point.stepId,
    verifiedAgainst: existing.verifiedAgainst || verifiedAgainst,
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
