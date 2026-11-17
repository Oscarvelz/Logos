/**
 * Ruling-2 audit dump (Oscar, 2026-11-15): every PERFORMED step
 * (act ∈ tap/type/key/scroll/hover/goto) across the 20 registered
 * scripts, with its anchors and captions — the census the footprint
 * extension works from. Bench tooling only; never shipped.
 */
import { MODULE_CATALOGUE } from '../../src/lib/presentation/catalogue.ts'
import { flattenSteps } from '../../src/lib/presentation/engine/types.ts'
import '../../src/lib/presentation/scripts/index.ts'

const PERFORMED = new Set(['tap', 'type', 'key', 'scroll', 'hover', 'goto'])
const only = process.argv[2] // optional module id filter

for (const entry of MODULE_CATALOGUE) {
  if (!entry.script) continue
  if (only && entry.id !== only) continue
  const flat = flattenSteps(entry.script)
  const performed = flat.filter((f) => PERFORMED.has(f.step.act))
  console.log(`\n=== ${entry.id.toUpperCase()} · ${entry.script.title.en} — performed ${performed.length} / ${flat.length}`)
  for (const f of performed) {
    const s = f.step
    const marks = [
      s.effectAnchorId ? `EFF=${s.effectAnchorId}` : '',
      s.subjectAnchorId ? `SUBJ=${s.subjectAnchorId}` : '',
      s.leaves ? `leaves=${s.leaves}` : '',
      s.establishes ? `est=${s.establishes}` : '',
      s.payload?.param ? `param=${s.payload.param}` : '',
      s.payload?.value ? `val="${s.payload.value}"` : '',
      s.payload?.key ? `key=${s.payload.key}` : '',
      s.payload?.direction ? `dir=${s.payload.direction}` : '',
    ].filter(Boolean).join(' ')
    console.log(`  [${f.scene.id}] ${s.id} · ${s.act} @ ${s.anchorId}${marks ? ' · ' + marks : ''}`)
    if (s.text) console.log(`      EN: ${s.text.en}\n      ES: ${s.text.es}`)
  }
}
