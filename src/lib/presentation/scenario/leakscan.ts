/**
 * The leak scan (FENCE-DESIGN §1.5). Isolation faces outward too: nothing
 * scenario-born may ride a payload that leaves the sandbox — not the backup
 * export, not a share payload, not the presentation's own state record.
 *
 * A payload contains scenario data when it carries a `scenario:`-prefixed id
 * or a fingerprint slice of a fiction text. The scan is a pure function of
 * the payload; Fence 0 runs it over every payload shape the scripts compose,
 * plus a positive control (a payload that DOES carry fiction) to prove the
 * scan can see.
 */
import { FICTION_FINGERPRINTS } from './fiction.ts'
import { SCENARIO_PREFIX } from './types.ts'

export function containsScenarioData(payload: unknown): boolean {
  let s: string
  try {
    s = JSON.stringify(payload) ?? ''
  } catch {
    return false
  }
  if (s.includes(SCENARIO_PREFIX)) return true
  return FICTION_FINGERPRINTS.some((fp) => fp.length > 0 && s.includes(fp))
}
