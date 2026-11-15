/**
 * The scenario sandbox — the sealed stage every Presentation module runs on
 * (PLAN §0.2, the supreme isolation law; FENCE-DESIGN §1).
 *
 * HOW THE SEALING WORKS (enforced by construction, proven by Fence 0):
 *
 * 1. No import path out. This folder imports only its own siblings. The app's
 *    persistence writers — the settings/drafts savers, the Library's and the
 *    books' IndexedDB helpers, the shell bridge — are never imported here,
 *    not even for types: the record shapes are re-declared in types.ts. A
 *    module that cannot name a writer cannot call one.
 * 2. No ambient authority. Scenario code names no storage global, no bridge
 *    object, no DOM and no network. Its backends (backends.ts) are plain
 *    in-memory structures created with the scenario instance and referenced
 *    by nothing outside it, so scenario data never transits a real backend —
 *    not even transiently. That is what makes the hard-kill exit provable:
 *    there is nothing to clean up because nothing was ever written.
 * 3. One narrow door. The only outward capability is the injected LambdaPort
 *    (scenario.ts): one boolean, the λ switch — the single real thing PLAN
 *    §0.2/OQ-1 allows a lesson to touch, tallied by Fence 0 as exception E-λ.
 *    Uninjected, even that lands on the scenario's own settings copy.
 * 4. The real side is a read-only type. Hosts may hand in a RealDataReader
 *    (realview.ts) — frozen snapshots, getters only — so a lesson can prove
 *    it is not borrowing the user's material. There is no write-shaped
 *    method on it to misuse.
 * 5. Fiction carries its name. Every scenario id starts with `scenario:`
 *    (types.ts), and leakscan.ts proves no id and no fiction fingerprint
 *    rides the backup export, a share payload, or the presentation's own
 *    state record out of the sandbox.
 *
 * Fence 0 (scripts/presentation/fence0.mjs) re-verifies each of these
 * mechanically on every run — including a static scan of this folder's
 * imports and forbidden tokens — so a future edit that quietly widens the
 * sandbox turns the fence red instead of leaking quietly.
 */
export { createScenario, type LambdaPort, type Scenario, type ScenarioOptions } from './scenario.ts'
export { createRealReader, type RealDataReader, type RealSnapshotData } from './realview.ts'
export { containsScenarioData } from './leakscan.ts'
export {
  BOOK_CONTENT,
  BOOK_META,
  CLIP_TEXT,
  FICTION_CLIPS,
  FICTION_IDS,
  FICTION_FINGERPRINTS,
  FICTION_MARK,
  FICTION_PRONOUNCE,
  POEM_EN,
  POEM_ES,
  SCENARIO_TEXTS,
  TEXT_EN,
  TEXT_ES,
} from './fiction.ts'
export { SCENARIO_PREFIX } from './types.ts'
export type {
  ScenarioBlock,
  ScenarioBookContent,
  ScenarioBookMeta,
  ScenarioChapter,
  ScenarioClip,
  ScenarioLang,
  ScenarioMark,
  ScenarioPronEntry,
  ScenarioResumeCard,
  ScenarioSession,
  ScenarioSettings,
  ScenarioText,
} from './types.ts'
