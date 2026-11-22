#!/usr/bin/env node
/**
 * anchor-fence.mjs — the Logos Presentation anchor fence (FENCE-DESIGN §2).
 *
 * Source-probe style: plain Node, reads sources as text — no DOM, no build.
 * Run from anywhere:  node scripts/presentation/anchor-fence.mjs
 *
 * What it proves, per registry record in src/lib/presentation/anchors.ts:
 *  - EXISTING / CLASS anchors: the recorded hook (pre-existing attribute or
 *    stable class/role) is present in the app-copy source → found/missing.
 *  - CONTRACT anchors: BOTH sides exist in the copy — the web side
 *    (bubble.ts literal/handler, bridge declaration, pushed-state build)
 *    AND the shell side (Kotlin emitter/bridge in MainActivity /
 *    BubbleService / PlaybackService). A contract anchor dies if either
 *    side drops it; the report says which side.
 *  - STORE anchors: the named probe target is present in source.
 *  - MINT anchors: NOT probed. They are the designed pending-integration
 *    list — the mints land with the integration wave, and until they do,
 *    this list is the red gate at integration, exactly as the Cadence
 *    lane's S6 mints gate stayed red until integration. Their absence here
 *    is not a failure of the registry itself.
 *
 * Exit code: 1 if any probeable anchor is missing, any registry id is
 * duplicated, or the registry's strategy totals drift from
 * ANCHOR-REGISTRY.md §2; otherwise 0 (with the MINT gate reported, not
 * hidden).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ANCHORS, RETIRED_ANCHORS } from '../../src/lib/presentation/anchors.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** ANCHOR-REGISTRY.md §2 — the document totals this registry must match. */
const DOC_TOTALS = { MINT: 250, CONTRACT: 34, CLASS: 30, STORE: 5, EXISTING: 3, TOTAL: 322 }

const cache = new Map()
function source(rel) {
  if (!cache.has(rel)) {
    try {
      cache.set(rel, readFileSync(join(ROOT, rel), 'utf8'))
    } catch {
      cache.set(rel, null)
    }
  }
  return cache.get(rel)
}

function probeSite(site) {
  const text = source(site.file)
  if (text === null) return { ok: false, file: site.file, missing: ['<file not found>'] }
  const missing = site.needles.filter((n) => !text.includes(n))
  return { ok: missing.length === 0, file: site.file, missing }
}

const isShell = (file) => file.endsWith('.kt') || file.endsWith('.xml')

let failures = 0
const fail = (line) => {
  failures++
  console.log('  ✗ ' + line)
}

/* --- Registry integrity: unique ids + parity with the document ------- */
console.log('Anchor fence — Logos Presentation (app-copy, Logos 1.4.156 base)')
console.log('='.repeat(72))

const seen = new Set()
const dupes = []
const totals = {}
for (const a of ANCHORS) {
  totals[a.strategy] = (totals[a.strategy] ?? 0) + 1
  if (seen.has(a.id)) dupes.push(a.id)
  seen.add(a.id)
}
console.log(`Registry: ${ANCHORS.length} records (document: ${DOC_TOTALS.TOTAL})`)
for (const s of ['MINT', 'CONTRACT', 'CLASS', 'STORE', 'EXISTING']) {
  const mark = totals[s] === DOC_TOTALS[s] ? '✓' : '✗ MISMATCH'
  console.log(`  ${s.padEnd(9)} ${String(totals[s] ?? 0).padStart(3)} (document: ${DOC_TOTALS[s]}) ${mark}`)
  if (totals[s] !== DOC_TOTALS[s]) failures++
}
if (ANCHORS.length !== DOC_TOTALS.TOTAL) failures++
if (dupes.length) fail(`duplicate anchor ids: ${dupes.join(', ')}`)
else console.log('  ids: all unique ✓')

/* --- Retired records: lineage only, never active --------------------- */
console.log(`\nRetired records (${RETIRED_ANCHORS.length}) — kept for lineage, never in the active registry:`)
for (const a of RETIRED_ANCHORS) {
  if (seen.has(a.id)) fail(`${a.id}: retired record is also in ANCHORS (it must never resolve)`)
  if (!a.retired) fail(`${a.id}: retired record carries no retirement note (registry defect)`)
  console.log(`  ${a.id} — ${a.retired ?? ''}`)
}

/* --- EXISTING + CLASS: the recorded hook must be in source ----------- */
console.log('\nEXISTING + CLASS anchors — recorded hook probe:')
let probedOk = 0
for (const a of ANCHORS.filter((x) => x.strategy === 'EXISTING' || x.strategy === 'CLASS')) {
  const results = (a.probe ?? []).map(probeSite)
  if (results.length && results.every((x) => x.ok)) {
    probedOk++
  } else if (!results.length) {
    fail(`${a.id}: no probe recorded (registry defect)`)
  } else {
    for (const x of results.filter((y) => !y.ok)) {
      fail(`${a.id}: hook not found in ${x.file} — missing needle(s): ${x.missing.join(' · ')}`)
    }
  }
}
console.log(`  ${probedOk}/${ANCHORS.filter((x) => x.strategy === 'EXISTING' || x.strategy === 'CLASS').length} found in source`)

/* --- CONTRACT: both sides of the web↔shell contract ------------------ */
console.log('\nCONTRACT anchors — both-sides probe (web literal/handler AND Kotlin emitter/bridge):')
let contractOk = 0
for (const a of ANCHORS.filter((x) => x.strategy === 'CONTRACT')) {
  const sites = a.probe ?? []
  const web = sites.filter((s) => !isShell(s.file))
  const shell = sites.filter((s) => isShell(s.file))
  const webBad = web.map(probeSite).filter((x) => !x.ok)
  const shellBad = shell.map(probeSite).filter((x) => !x.ok)
  if (sites.length && !webBad.length && !shellBad.length) {
    contractOk++
  } else {
    if (!sites.length) fail(`${a.id}: no probe recorded (registry defect)`)
    for (const x of webBad) fail(`${a.id}: WEB side missing in ${x.file} — needle(s): ${x.missing.join(' · ')}`)
    for (const x of shellBad) fail(`${a.id}: SHELL side missing in ${x.file} — needle(s): ${x.missing.join(' · ')}`)
  }
}
console.log(`  ${contractOk}/${ANCHORS.filter((x) => x.strategy === 'CONTRACT').length} resolve on both sides`)

/* --- STORE: the named probe target ----------------------------------- */
console.log('\nSTORE anchors — probe-target probe:')
let storeOk = 0
for (const a of ANCHORS.filter((x) => x.strategy === 'STORE')) {
  const results = (a.probe ?? []).map(probeSite)
  if (results.length && results.every((x) => x.ok)) {
    storeOk++
  } else {
    for (const x of results.filter((y) => !y.ok)) {
      fail(`${a.id}: probe target not found in ${x.file} — needle(s): ${x.missing.join(' · ')}`)
    }
    if (!results.length) fail(`${a.id}: no probe recorded (registry defect)`)
  }
}
console.log(`  ${storeOk}/${ANCHORS.filter((x) => x.strategy === 'STORE').length} probe targets found`)

/* --- MINT: the designed pending-integration list --------------------- */
const mints = ANCHORS.filter((x) => x.strategy === 'MINT')
const byFile = new Map()
for (const a of mints) {
  const f = a.file ?? '<no file recorded>'
  if (!byFile.has(f)) byFile.set(f, [])
  byFile.get(f).push(a.id)
}
console.log(`\nMINT anchors — DESIGNED PENDING-INTEGRATION LIST (${mints.length}):`)
console.log('  These data-present mints land with the integration wave. Until they')
console.log('  do, this list is the red gate at integration — the same shape as the')
console.log('  Cadence lane\u2019s S6 mints gate. It is not a failure of this registry.')
for (const [f, ids] of [...byFile.entries()].sort((x, y) => y[1].length - x[1].length)) {
  console.log(`  ${f} (${ids.length}):`)
  console.log(`    ${ids.join(' · ')}`)
}

/* --- Verdict ---------------------------------------------------------- */
console.log('\n' + '='.repeat(72))
if (failures) {
  console.log(`ANCHOR FENCE: RED — ${failures} failure(s) above. A red fence blocks publish (FENCE-DESIGN §2.1).`)
  process.exit(1)
}
console.log('ANCHOR FENCE: GREEN for every probeable anchor (EXISTING/CLASS/CONTRACT/STORE).')
console.log(`The ${mints.length} MINT anchors remain the designed integration gate, listed above.`)
