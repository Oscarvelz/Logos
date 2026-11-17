/**
 * footprint-probe.mjs — Ruling 2's verification sweep (Oscar,
 * 2026-11-15: «Nada debe bloquear aquello que se está mostrando»).
 *
 * For EVERY performed step that now declares a footprint
 * (effectAnchorId), the probe runs the player's REAL seat machinery
 * (geometry.cardSeat) over a grid of plausible stage layouts —
 * control rects at several positions × effect regions small, medium
 * and page-large, three card heights, phone and large viewports —
 * and asserts the ruling's invariant:
 *
 *   whenever a zero-intersection placement for the card EXISTS,
 *   the seat cardSeat returns has ZERO intersection with the
 *   footprint union (control ∪ effect).
 *
 * (When no clear placement exists at all — footprint + card taller
 * than the screen — geometry's documented lesser-coverage fallback
 * is the honest remainder; the probe counts those separately and
 * never calls them violations.)
 *
 * Run: node scripts/presentation/footprint-probe.mjs
 */
import { MODULE_CATALOGUE } from '../../src/lib/presentation/catalogue.ts'
import { flattenSteps } from '../../src/lib/presentation/engine/types.ts'
import { cardSeat, unionRect, CARD_GAP, VIEW_MARGIN } from '../../src/lib/presentation/engine/geometry.ts'
import '../../src/lib/presentation/scripts/index.ts'

const PERFORMED = new Set(['tap', 'type', 'key', 'scroll', 'hover', 'goto'])
const intersects = (a, b) =>
  a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top

const ACT_RECTS = [
  { top: 60, left: 16, width: 120, height: 40 },
  { top: 300, left: 16, width: 160, height: 44 },
  { top: 540, left: 200, width: 120, height: 40 },
  { top: 760, left: 16, width: 200, height: 44 },
  { top: 420, left: 270, width: 58, height: 34 },
]
const EFFECT_RECTS = [
  { top: 120, left: 12, width: 350, height: 220 },
  { top: 360, left: 12, width: 350, height: 220 },
  { top: 600, left: 12, width: 350, height: 200 },
  { top: 60, left: 10, width: 370, height: 520 },
  { top: 200, left: 10, width: 370, height: 560 },
  { top: 480, left: 20, width: 200, height: 120 },
]
const CARD_HEIGHTS = [240, 320, 400]
const VIEWPORTS = [
  { w: 390, h: 844 },
  { w: 1200, h: 900 },
]

function cardRectOf(seat, vw, vh, cardHeight) {
  const cardWidth = vw >= 1500 ? 550 : vw >= 840 ? 480 : 370
  const top = seat.top !== undefined ? seat.top : vh - seat.bottom - cardHeight
  return { top, left: seat.left, width: cardWidth, height: cardHeight }
}

function clearPlacementExists(footprint, vw, vh, cardHeight, left) {
  const cardWidth = vw >= 1500 ? 550 : vw >= 840 ? 480 : 370
  const bottomLimit = vh - VIEW_MARGIN
  for (let top = VIEW_MARGIN; top + cardHeight <= bottomLimit; top += 4) {
    const rect = { top, left, width: cardWidth, height: cardHeight }
    if (!intersects(rect, footprint)) return true
  }
  return false
}

let beats = 0
let cases = 0
let fallbacks = 0
const violations = []
const perModule = []

for (const entry of MODULE_CATALOGUE) {
  if (!entry.script) continue
  let moduleBeats = 0
  for (const f of flattenSteps(entry.script)) {
    if (!PERFORMED.has(f.step.act) || !f.step.effectAnchorId) continue
    beats++
    moduleBeats++
    for (const vp of VIEWPORTS) {
      for (const act of ACT_RECTS) {
        for (const eff of EFFECT_RECTS) {
          for (const cardHeight of CARD_HEIGHTS) {
            const footprint = unionRect([act, eff])
            const seat = cardSeat(act, vp.w, vp.h, 0, footprint, cardHeight)
            if (!seat) {
              violations.push(`${entry.id}/${f.step.id}: cardSeat returned null`)
              continue
            }
            const rect = cardRectOf(seat, vp.w, vp.h, cardHeight)
            cases++
            if (intersects(rect, footprint)) {
              if (clearPlacementExists(footprint, vp.w, vp.h, cardHeight, seat.left)) {
                violations.push(
                  `${entry.id}/${f.step.id} @ ${vp.w}×${vp.h} act=${JSON.stringify(act)} eff=${JSON.stringify(eff)} cardH=${cardHeight}: seat intersects the footprint although a clear placement exists`,
                )
              } else {
                fallbacks++
              }
            }
          }
        }
      }
    }
  }
  perModule.push(`${entry.id}: ${moduleBeats}`)
}

console.log(`footprint probe — ${beats} annotated performed beats (${perModule.join(' · ')})`)
console.log(`seat cases swept: ${cases} · lesser-coverage fallbacks (no clear placement exists): ${fallbacks}`)
if (violations.length) {
  console.error(`VIOLATIONS (${violations.length}):\n- ` + violations.slice(0, 20).join('\n- '))
  process.exit(1)
}
console.log('PROBE PASS — whenever a clear seat exists, the card never intersects the footprint union')
