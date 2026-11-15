/**
 * The ladder's registration — importing this module attaches all twenty
 * scripts (Quick Q0–Q5, Advanced AD1–AD14) to the catalogue, so the
 * Settings index can show their computed duration labels and launch
 * controls.
 *
 * Registration goes through `registerPresentationScript`, which validates
 * each script against the engine format AND against the catalogue entry's
 * own words (id, floor, title, capability — PLAN §3 owns them). A script
 * that disagrees is refused loudly at import time rather than half-shown.
 */
import { registerPresentationScript } from '../catalogue.ts'
import { q0 } from './q0.ts'
import { Q1 } from './q1.ts'
import { Q2 } from './q2.ts'
import { Q3 } from './q3.ts'
import { Q4 } from './q4.ts'
import { Q5 } from './q5.ts'
import { AD1 } from './ad1.ts'
import { AD2 } from './ad2.ts'
import { AD3 } from './ad3.ts'
import { AD4 } from './ad4.ts'
import { AD5 } from './ad5.ts'
import { AD6 } from './ad6.ts'
import { AD7 } from './ad7.ts'
import { AD8 } from './ad8.ts'
import { AD9 } from './ad9.ts'
import { AD10 } from './ad10.ts'
import { AD11 } from './ad11.ts'
import { AD12 } from './ad12.ts'
import { AD13 } from './ad13.ts'
import { AD14 } from './ad14.ts'

for (const script of [
  q0, Q1, Q2, Q3, Q4, Q5,
  AD1, AD2, AD3, AD4, AD5, AD6, AD7, AD8, AD9, AD10, AD11, AD12, AD13, AD14,
]) {
  registerPresentationScript(script)
}
