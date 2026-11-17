/**
 * Presentation script format — Logos edition.
 *
 * A module script is DATA ONLY. A step names its target by registry id
 * (`anchorId`) and nothing else: resolution data lives in
 * `src/lib/presentation/anchors.ts`, never in a scene. There is deliberately
 * no field in this format that can carry a CSS selector, a locator, or a
 * coordinate, and `validatePresentationModule` + the key scans below reject
 * a script that tries to smuggle one in (FENCE-DESIGN §2, L-4).
 *
 * Every user-facing string is a bilingual pair { en, es } — Logos is
 * bilingual from birth (PLAN §0.1) and the bilingual fence (FENCE-DESIGN §4)
 * requires both halves of every caption to exist. Captions over 15 words in
 * EITHER language produce a warning (never a silent pass, never a hard
 * failure): the words adapt, the card never stretches.
 *
 * There is NO duration field anywhere in this format. Index labels are
 * computed from the script by the one shared clock calibration (clock.ts,
 * FENCE-DESIGN §5 D-1) — a handwritten duration is a fence defect.
 */
import { ANCHORS } from '../anchors.ts'
import type { SkipLogEntry } from '../anchors.ts'

export type PresentationLanguage = 'en' | 'es'

/** One string in both of Logos' languages. Both halves are required. */
export interface BilingualText {
  en: string
  es: string
}

export type PresentationFloor = 'quick' | 'advanced'

/** The two playback modes (the C′ mode button carries its word). */
export type PresentationMode = 'automatic' | 'interactive'

/** Surfaces a module may declare (OQ-3 / FENCE-DESIGN §7 clause 6). */
export type PresentationSurface = 'web' | 'android'

export type StepAct = 'tap' | 'type' | 'key' | 'scroll' | 'hover' | 'ask' | 'say' | 'goto'

export const STEP_ACTS: readonly StepAct[] = ['tap', 'type', 'key', 'scroll', 'hover', 'ask', 'say', 'goto']

/**
 * The only payload a step may carry. Every field is a value the scenario
 * stage acts on (a family parameter, text to type, a key name, a semantic
 * scroll direction) — none of them can describe where anything is.
 */
export interface StepPayload {
  /** Family parameter for a parameterized anchor id (e.g. a voice id). */
  param?: string
  /** Text for a `type` step (fiction material only — never user data). */
  value?: string
  /** Key name for a `key` step (e.g. "Escape", "Enter"). */
  key?: string
  /** Semantic scroll direction for a `scroll` step — never a pixel amount. */
  direction?: 'up' | 'down' | 'top' | 'bottom' | 'into-view'
  /** How long a `hover` step rests on its target. */
  holdMs?: number
}

export interface PresentationStep {
  id: string
  /** Registry id only — must exist in ANCHORS (checked by validation). */
  anchorId: string
  /**
   * Optional second anchor: where the step's EFFECT lands, when that is
   * a different registered anchor than the acted-on one. Registry id
   * only, validated exactly as `anchorId` is.
   */
  effectAnchorId?: string
  /**
   * Optional anchor naming the step's SUBJECT, when it differs from the
   * acted-on anchor. Registry id only, validated exactly as `anchorId`.
   */
  subjectAnchorId?: string
  /**
   * The presence/state this step LEAVES behind — a free state-name
   * string, like `establishes`, never a locator.
   */
  leaves?: string
  act: StepAct
  /** Caption for say/tap/type/key/scroll/hover/goto steps, in both languages. */
  text?: BilingualText
  /** The short question for an `ask` step (ask → one-beat pause → show). */
  question?: BilingualText
  payload?: StepPayload
  /**
   * FENCE-DESIGN §7 clause 3: an optional step whose anchor misses is
   * skipped and logged; a required step (the default) ends its scene
   * cleanly and flags the module needs-refresh.
   */
  optional?: boolean
  /**
   * The presence/state this step establishes for a later step whose anchor
   * record declares it as a precondition (FENCE-DESIGN §2, L-5) — a state
   * name, never a locator.
   */
  establishes?: string
}

export interface PresentationScene {
  id: string
  /** Chapter title — every scene is a chapter, in both languages. */
  chapter: BilingualText
  steps: PresentationStep[]
}

export interface PresentationModule {
  id: string
  floor: PresentationFloor
  title: BilingualText
  /** The capability promise the Settings index card carries. */
  capability: BilingualText
  scenes: PresentationScene[]
  /** Logos version this script's words were last verified against. */
  verifiedAgainst?: string
  /** Surfaces this module may run on; absent = every surface Logos serves. */
  surfaces?: PresentationSurface[]
  /**
   * Set by the builder's re-verification pass (FENCE-DESIGN §7 clause 5):
   * when the app is newer than `verifiedAgainst` AND this flag is set, the
   * index state reads needs-refresh. Never computed on the device.
   */
  staleRisk?: boolean
}

/** Index-card progress states (FENCE-DESIGN §7 clause 5). */
export type ModuleProgressState = 'unseen' | 'in-progress' | 'seen' | 'needs-refresh'

/** One skipped step, logged under FENCE-DESIGN §7 clause 4 (anchors.ts shape). */
export type PresentationSkip = SkipLogEntry

export interface ModuleProgress {
  state: ModuleProgressState
  /**
   * The global (flattened) step index to resume at — the step on stage when
   * progress was last recorded; Resume re-enters exactly there and
   * re-resolves everything (FENCE-DESIGN §7 clause 5).
   */
  step?: number
  /** Scene id containing `step`. */
  scene?: string
  /** Step id at `step`. */
  stepId?: string
  verifiedAgainst: string
  skips: PresentationSkip[]
  /** The mode this module's progress was last recorded in. */
  mode?: 'automatic' | 'interactive'
  /** True when the learner had the lesson paused at the recorded place. */
  userPaused?: boolean
  /** True when entry seeding found a required step missing on the way in. */
  seededRequiredMiss?: boolean
}

/** A scene the user saved from the player's chapters panel («My scenes»). */
export interface SavedScene {
  module: string
  scene: string
  /** Global step index of the scene's first step — the exact landing. */
  step: number
  stepId?: string
  savedAt: string
}

/**
 * The whole per-device presentation state file — the ONLY real key the
 * presentation writes (besides the λ exception), under
 * `logos.presentation.state.v1` (presentation-state.ts).
 */
export interface PresentationStateFile {
  modules: Record<string, ModuleProgress>
  /** The user's remembered speed — one speed per user, across modules. */
  speed: number
  /**
   * The pace-scale stamp (P2): 2 marks a file whose `speed` is a NEW
   * label (physical rate = label / 2). A file without it — or with any
   * other value — holds an OLD-scale speed, which must never be
   * reinterpreted: the normaliser discards it to label 1 and stamps 2
   * (presentation-state.ts, a once-only migration).
   */
  speedScale?: number
  myScenes: SavedScene[]
  /**
   * The last module the learner used — set at module start and on every
   * advance, cleared when that module completes (Brizna's proven pattern;
   * the stay-here / first-card law, Oscar 2026-11-14). The Settings index
   * lifts this module to the head of the list while it stands in-progress
   * (`resumeHead`, catalogue.ts). Absent = no module in play. A single
   * field by construction: there can only ever be one last-used module.
   */
  lastUsed?: string
}

/* ------------------------------------------------------------------ */
/* Anchor-id lookup (exact ids + parameterized family patterns)        */
/* ------------------------------------------------------------------ */

const REGISTERED_IDS: ReadonlySet<string> = new Set(ANCHORS.map((a) => a.id))

/** Turn a family id (`voice-card:{voiceId}:star`) into a one-segment pattern. */
function familyPattern(id: string): RegExp | null {
  if (!id.includes('{')) return null
  const source = id
    .split(/(\{[^}]*\})/)
    .map((part) => (part.startsWith('{') ? '[^:]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('')
  return new RegExp(`^${source}$`)
}

const FAMILY_PATTERNS: readonly RegExp[] = ANCHORS.map((a) => familyPattern(a.id)).filter(
  (p): p is RegExp => p !== null,
)

/** True when `id` is a registered anchor id or an instance of a registered family. */
export function isRegisteredAnchorId(id: string): boolean {
  if (REGISTERED_IDS.has(id)) return true
  return FAMILY_PATTERNS.some((pattern) => pattern.test(id))
}

/* ------------------------------------------------------------------ */
/* Key scans — the banned-key scan and the format whitelists           */
/* ------------------------------------------------------------------ */

/**
 * Keys that would let a script describe WHERE something is. Banned anywhere
 * in a script, at any depth (FENCE-DESIGN §2 L-4 names selector / locator /
 * x / y / coords / css; the rest are the same smuggling in other clothes).
 */
export const FORBIDDEN_SCRIPT_KEYS: ReadonlySet<string> = new Set([
  'selector',
  'selectors',
  'locator',
  'locators',
  'css',
  'xpath',
  'x',
  'y',
  'coords',
  'coordinate',
  'coordinates',
  'left',
  'top',
  'right',
  'bottom',
  'width',
  'height',
  'pixel',
  'pixels',
])

export const MODULE_KEY_WHITELIST: ReadonlySet<string> = new Set([
  'id',
  'floor',
  'title',
  'capability',
  'scenes',
  'verifiedAgainst',
  'surfaces',
  'staleRisk',
])

export const SCENE_KEY_WHITELIST: ReadonlySet<string> = new Set(['id', 'chapter', 'steps'])

export const STEP_KEY_WHITELIST: ReadonlySet<string> = new Set([
  'id',
  'anchorId',
  'effectAnchorId',
  'subjectAnchorId',
  'leaves',
  'act',
  'text',
  'question',
  'payload',
  'optional',
  'establishes',
])

export const PAYLOAD_KEY_WHITELIST: ReadonlySet<string> = new Set(['param', 'value', 'key', 'direction', 'holdMs'])

export const BILINGUAL_KEY_WHITELIST: ReadonlySet<string> = new Set(['en', 'es'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Deep-scan ANY script value for banned keys. Returns the paths at which a
 * banned key appears (empty when clean). The scan covers the whole script
 * because a coordinate is a coordinate wherever it hides.
 */
export function findForbiddenScriptKeys(value: unknown, path = '$', out: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findForbiddenScriptKeys(item, `${path}[${index}]`, out))
    return out
  }
  if (!isRecord(value)) return out
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_SCRIPT_KEYS.has(key)) out.push(`${path}.${key}`)
    findForbiddenScriptKeys(child, `${path}.${key}`, out)
  }
  return out
}

/**
 * Deep-scan the instruction layer (module → scenes → steps → payloads →
 * bilingual pairs) against the format's whitelists. Keys outside the
 * whitelist are not part of the format; a script carrying one is rejected
 * rather than silently tolerated, so the format cannot grow a side channel.
 */
export function findNonWhitelistedScriptKeys(script: PresentationModule): string[] {
  const out: string[] = []
  if (isRecord(script)) {
    for (const key of Object.keys(script)) {
      if (!MODULE_KEY_WHITELIST.has(key)) out.push(`$.${key}`)
    }
  }
  const bilingual = (value: unknown, path: string) => {
    if (!isRecord(value)) return
    for (const key of Object.keys(value)) {
      if (!BILINGUAL_KEY_WHITELIST.has(key)) out.push(`${path}.${key}`)
    }
  }
  bilingual(script?.title, '$.title')
  bilingual(script?.capability, '$.capability')
  script?.scenes?.forEach((scene, sceneIndex) => {
    const scenePath = `$.scenes[${sceneIndex}]`
    if (isRecord(scene)) {
      for (const key of Object.keys(scene)) {
        if (!SCENE_KEY_WHITELIST.has(key)) out.push(`${scenePath}.${key}`)
      }
    }
    bilingual(scene?.chapter, `${scenePath}.chapter`)
    scene?.steps?.forEach((step, stepIndex) => {
      const stepPath = `${scenePath}.steps[${stepIndex}]`
      if (isRecord(step)) {
        for (const key of Object.keys(step)) {
          if (!STEP_KEY_WHITELIST.has(key)) out.push(`${stepPath}.${key}`)
        }
      }
      bilingual(step?.text, `${stepPath}.text`)
      bilingual(step?.question, `${stepPath}.question`)
      if (isRecord(step?.payload)) {
        for (const key of Object.keys(step.payload)) {
          if (!PAYLOAD_KEY_WHITELIST.has(key)) out.push(`${stepPath}.payload.${key}`)
        }
      }
    })
  })
  return out
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function bilingualProblems(value: unknown, at: string, required: boolean): string[] {
  if (value === undefined || value === null) return required ? [`${at}: a bilingual { en, es } pair is required`] : []
  if (!isRecord(value)) return [`${at}: must be a bilingual { en, es } pair`]
  const problems: string[] = []
  for (const lang of ['en', 'es'] as const) {
    if (typeof value[lang] !== 'string' || !(value[lang] as string).trim()) {
      problems.push(`${at}: the ${lang} half is missing or empty — every caption exists in both languages`)
    }
  }
  return problems
}

/**
 * Validate a module script before it may play. Returns a list of problems
 * (empty = valid). Checks: the banned-key scan; the whitelists; module /
 * scene / step shape; bilingual completeness; and that every cited anchor
 * id is registered in ANCHORS (an exact id, or an instance of a registered
 * parameterized family).
 */
export function validatePresentationModule(script: PresentationModule): string[] {
  const problems: string[] = []
  if (!isRecord(script)) return ['script is not an object']

  for (const path of findForbiddenScriptKeys(script)) {
    problems.push(`${path}: banned key — scripts name anchors by id only (FENCE-DESIGN §2 L-4)`)
  }
  for (const path of findNonWhitelistedScriptKeys(script)) {
    problems.push(`${path}: key is outside the script format's whitelist`)
  }

  if (typeof script.id !== 'string' || !script.id) problems.push('module id is missing')
  if (script.floor !== 'quick' && script.floor !== 'advanced') {
    problems.push(`module "${script.id}": floor must be "quick" or "advanced"`)
  }
  problems.push(...bilingualProblems(script.title, `module "${script.id}" title`, true))
  problems.push(...bilingualProblems(script.capability, `module "${script.id}" capability`, true))
  if (script.surfaces !== undefined) {
    if (!Array.isArray(script.surfaces) || script.surfaces.some((s) => s !== 'web' && s !== 'android')) {
      problems.push(`module "${script.id}": surfaces must list only "web" / "android"`)
    }
  }

  if (!Array.isArray(script.scenes) || script.scenes.length === 0) {
    problems.push(`module "${script.id}": a module needs at least one scene`)
    return problems
  }

  const sceneIds = new Set<string>()
  const stepIds = new Set<string>()
  script.scenes.forEach((scene, sceneIndex) => {
    const scenePath = `$.scenes[${sceneIndex}]`
    if (!isRecord(scene)) {
      problems.push(`${scenePath}: scene is not an object`)
      return
    }
    if (typeof scene.id !== 'string' || !scene.id) problems.push(`${scenePath}: scene id is missing`)
    else if (sceneIds.has(scene.id)) problems.push(`${scenePath}: duplicate scene id "${scene.id}"`)
    else sceneIds.add(scene.id)
    problems.push(...bilingualProblems(scene.chapter, `${scenePath} (${scene.id}) chapter`, true))
    if (!Array.isArray(scene.steps) || scene.steps.length === 0) {
      problems.push(`${scenePath} (${scene.id}): a scene needs at least one step`)
      return
    }
    scene.steps.forEach((step, stepIndex) => {
      const stepPath = `${scenePath}.steps[${stepIndex}]`
      if (!isRecord(step)) {
        problems.push(`${stepPath}: step is not an object`)
        return
      }
      if (typeof step.id !== 'string' || !step.id) problems.push(`${stepPath}: step id is missing`)
      else if (stepIds.has(step.id)) problems.push(`${stepPath}: duplicate step id "${step.id}"`)
      else stepIds.add(step.id)
      if (typeof step.anchorId !== 'string' || !step.anchorId) {
        problems.push(`${stepPath} (${step.id}): anchorId is missing — a step names its anchor by registry id`)
      } else if (!isRegisteredAnchorId(step.anchorId)) {
        problems.push(`${stepPath} (${step.id}): anchor "${step.anchorId}" is not in ANCHORS`)
      }
      if (step.effectAnchorId !== undefined) {
        if (typeof step.effectAnchorId !== 'string' || !step.effectAnchorId) {
          problems.push(`${stepPath} (${step.id}): effectAnchorId must be a registry id when present`)
        } else if (!isRegisteredAnchorId(step.effectAnchorId)) {
          problems.push(`${stepPath} (${step.id}): effect anchor "${step.effectAnchorId}" is not in ANCHORS`)
        }
      }
      if (step.subjectAnchorId !== undefined) {
        if (typeof step.subjectAnchorId !== 'string' || !step.subjectAnchorId) {
          problems.push(`${stepPath} (${step.id}): subjectAnchorId must be a registry id when present`)
        } else if (!isRegisteredAnchorId(step.subjectAnchorId)) {
          problems.push(`${stepPath} (${step.id}): subject anchor "${step.subjectAnchorId}" is not in ANCHORS`)
        }
      }
      if (!STEP_ACTS.includes(step.act)) {
        problems.push(`${stepPath} (${step.id}): act "${String(step.act)}" is not one of ${STEP_ACTS.join(' / ')}`)
      }
      problems.push(...bilingualProblems(step.text, `${stepPath} (${step.id}) text`, false))
      problems.push(...bilingualProblems(step.question, `${stepPath} (${step.id}) question`, false))
      if (step.act === 'ask' && step.question === undefined) {
        problems.push(`${stepPath} (${step.id}): an ask step needs its short question`)
      }
      if (step.act === 'type' && typeof step.payload?.value !== 'string') {
        problems.push(`${stepPath} (${step.id}): a type step needs payload.value`)
      }
      if (step.act === 'key' && typeof step.payload?.key !== 'string') {
        problems.push(`${stepPath} (${step.id}): a key step needs payload.key`)
      }
      if (step.payload?.holdMs !== undefined && (typeof step.payload.holdMs !== 'number' || step.payload.holdMs < 0)) {
        problems.push(`${stepPath} (${step.id}): payload.holdMs must be a non-negative number`)
      }
    })
  })

  return problems
}

/** Throwing form of validation, for module registration / test gates. */
export function assertValidPresentationModule(script: PresentationModule): void {
  const problems = validatePresentationModule(script)
  if (problems.length) throw new Error(`presentation module "${script?.id ?? '?'}":\n- ${problems.join('\n- ')}`)
}

/* ------------------------------------------------------------------ */
/* Caption word law                                                    */
/* ------------------------------------------------------------------ */

/** Count words the way a reader meets them (whitespace-separated tokens). */
export function wordCount(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

/**
 * The caption law (C′ card): a caption is at most 15 words — in EACH
 * language. This is a WARNING, never a validation failure and never
 * silently passed: an over-long caption still plays; the warning exists so
 * the module author shortens the words at the next pass.
 */
export const CAPTION_WORD_LIMIT = 15

/** Non-fatal script warnings (currently: the ≤15-word caption law, EN and ES). */
export function presentationScriptWarnings(script: PresentationModule): string[] {
  const warnings: string[] = []
  if (!isRecord(script) || !Array.isArray(script.scenes)) return warnings
  const check = (value: unknown, at: string, field: string) => {
    if (!isRecord(value)) return
    for (const lang of ['en', 'es'] as const) {
      const text = value[lang]
      if (typeof text !== 'string') continue
      const words = wordCount(text)
      if (words > CAPTION_WORD_LIMIT) {
        warnings.push(
          `${at}: ${field} (${lang}) is ${words} words — the caption law is ≤ ${CAPTION_WORD_LIMIT}; shorten the words, never stretch the card`,
        )
      }
    }
  }
  script.scenes.forEach((scene, sceneIndex) => {
    if (!isRecord(scene) || !Array.isArray(scene.steps)) return
    scene.steps.forEach((step, stepIndex) => {
      if (!isRecord(step)) return
      const at = `$.scenes[${sceneIndex}].steps[${stepIndex}] (${typeof step.id === 'string' ? step.id : '?'})`
      check(step.text, at, 'text')
      check(step.question, at, 'question')
    })
  })
  return warnings
}

/* ------------------------------------------------------------------ */
/* Flattening                                                          */
/* ------------------------------------------------------------------ */

/** Every step of a module, flattened in play order, with its scene. */
export interface FlatStep {
  scene: PresentationScene
  step: PresentationStep
  sceneIndex: number
  stepIndex: number
  /** Index of this step within its scene. */
  indexInScene: number
  globalIndex: number
}

export function flattenSteps(script: PresentationModule): FlatStep[] {
  const out: FlatStep[] = []
  script.scenes.forEach((scene, sceneIndex) => {
    scene.steps.forEach((step, stepIndex) => {
      out.push({ scene, step, sceneIndex, stepIndex, indexInScene: stepIndex, globalIndex: out.length })
    })
  })
  return out
}

/** Pick one language out of a bilingual pair. */
export function pickText(text: BilingualText, lang: PresentationLanguage): string {
  return text[lang]
}
