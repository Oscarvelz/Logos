/**
 * The module step-count registry (R3-T6-2).
 *
 * The state layer's normaliser bounds the `done[]` witness by the length
 * of the module it witnesses — but it cannot learn lengths on its own:
 * it must never import the catalogue (the catalogue reads state THROUGH
 * it; the cycle would be real), and the scripts are data it never sees.
 * So lengths arrive by registration instead: when a script registers
 * with the catalogue, the catalogue files its flattened step count
 * here, and the normaliser consults the registry.
 *
 * A module with no registered length keeps the unbounded reading —
 * the normaliser judges only what it can know, exactly as it treats
 * every other field it cannot verify. This module imports nothing, so
 * anything may consult it without a cycle.
 */
const stepCounts = new Map<string, number>()

/** File a module's flattened step count (called by script registration). */
export function registerModuleStepCount(moduleId: string, steps: number): void {
  if (typeof moduleId === 'string' && moduleId && Number.isFinite(steps) && steps > 0) {
    stepCounts.set(moduleId, Math.floor(steps))
  }
}

/** A module's registered step count, or undefined when none was filed. */
export function moduleStepCount(moduleId: string): number | undefined {
  return stepCounts.get(moduleId)
}
