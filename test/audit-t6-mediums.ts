// Audit probe: Wave 3 Presentation mediums T6-7..T6-12 (audit only)
import {
  ANCHORS,
  anchorRecordFor,
  resolveWeb,
  resolveStayHereLanding,
  unfoldHeaderId,
  type ElementLike,
  type RootLike,
} from '../src/lib/presentation/anchors.ts'
import { createScenario } from '../src/lib/presentation/scenario/scenario.ts'
import { MODULE_CATALOGUE } from '../src/lib/presentation/catalogue.ts'
import { flattenSteps } from '../src/lib/presentation/engine/types.ts'
import '../src/lib/presentation/scripts/index.ts'

let fails = 0
const check = (name: string, cond: boolean, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name} ${detail}`)
  if (!cond) fails++
}

// ── Fake DOM ──────────────────────────────────────────────────────
interface FakeEl extends ElementLike {
  _tag: string
  _attrs: Record<string, string>
  _label: string
}
function el(tag: string, attrs: Record<string, string>, label: string, visible = true): FakeEl {
  return {
    _tag: tag,
    _attrs: attrs,
    _label: label,
    hidden: !visible,
    checkVisibility: () => visible,
    getBoundingClientRect: () => (visible ? { width: 100, height: 20 } : { width: 0, height: 0 }),
    getAttribute(name: string) { return this._attrs[name] ?? null },
  }
}
function rootOf(els: FakeEl[]): RootLike {
  return {
    querySelectorAll(selector: string) {
      const tagMatch = selector.match(/^([a-zA-Z][a-zA-Z0-9]*)/)
      const tag = tagMatch && !selector.startsWith('[') && !selector.startsWith('.') ? tagMatch[1] : null
      const attrConds = [...selector.matchAll(/\[([^\]=]+)="([^"]*)"\]/g)].map((m) => [m[1], m[2]] as const)
      const classConds = [...selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)]
        .map((m) => m[1])
        .filter((c) => !attrConds.some(([, v]) => v.includes(c)))
      // class selectors appear outside brackets only
      const outside = selector.replace(/\[[^\]]*\]/g, '')
      const classes = [...outside.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1])
      void classConds
      return els.filter((e) => {
        if (tag && e._tag !== tag) return false
        for (const [k, v] of attrConds) if (e._attrs[k] !== v) return false
        for (const c of classes) if (!((e._attrs['class'] ?? '').split(/\s+/).includes(c))) return false
        return true
      })
    },
  }
}
const rec = (id: string) => {
  const f = anchorRecordFor(id)
  if (!f) throw new Error('no record ' + id)
  return f
}

// ── T6-7: unfold precondition parser ─────────────────────────────
{
  const unfoldRecs = ANCHORS.filter((a) => a.precondition?.startsWith('unfold '))
  const oldRegex = /unfold\('([^']+)'\)/
  const oldHits = unfoldRecs.filter((a) => oldRegex.test(a.precondition!)).length
  const newHits = unfoldRecs.filter((a) => unfoldHeaderId(a) !== null).length
  console.log(`T6-7 unfold records=${unfoldRecs.length} oldRegexHits=${oldHits} unfoldHeaderIdHits=${newHits} sample=${unfoldRecs.slice(0, 3).map((a) => unfoldHeaderId(a)).join(',')}`)
  check('T6-7 old regex is 0', oldHits === 0)
  check('T6-7 new parser hits all', newHits === unfoldRecs.length && unfoldRecs.length > 0)
  check('T6-7 sample set-speed->set-playback', unfoldHeaderId(rec('set-speed').record) === 'set-playback')
}

// ── T6-9: voice-picker-group tag-qualified ───────────────────────
{
  const section = el('section', { 'data-group': 'en-US' }, 'section', true)
  const headBtn = el('button', { 'data-group': 'en-US', 'data-present': 'voice-picker-group:head' }, 'head', true)
  const root = rootOf([section, headBtn])
  const f = rec('voice-picker-group:en-US')
  console.log(`T6-9 record locator=${JSON.stringify(f.record.locator)} param=${f.param}`)
  const res = resolveWeb(root, f.record, f.param)
  check('T6-9 resolveWeb ok in real-app-shaped DOM', res.ok === true)
  check('T6-9 resolves to the section, not head', res.ok === true && (res.value as unknown as FakeEl)._label === 'section')
}

// ── T6-10: visibility blindness ──────────────────────────────────
{
  const railRec = rec('shell-rail').record
  const hiddenRail = rootOf([el('nav', { 'data-present': 'shell-rail' }, 'rail', false)])
  const r1 = resolveWeb(hiddenRail, railRec)
  check('T6-10 hidden rail is a miss', r1.ok === false, r1.ok ? '' : `reason=${r1.reason}`)
  check('T6-10 hidden rail reason not-visible', r1.ok === false && r1.reason === 'not-visible')
  const visRail = rootOf([el('nav', { 'data-present': 'shell-rail' }, 'rail', true)])
  check('T6-10 visible rail resolves', resolveWeb(visRail, railRec).ok === true)
  const deskRec = rec('desk-tablet').record
  const hiddenDesk = rootOf([el('div', { 'data-present': 'desk-tablet' }, 'desk', false)])
  const r2 = resolveWeb(hiddenDesk, deskRec)
  check('T6-10 hidden desk is not-visible miss', r2.ok === false && r2.reason === 'not-visible')
  // element carrying NO visibility signals at all stays visible (probe-fake rule)
  const bare: ElementLike = { getAttribute: (n: string) => (n === 'data-present' ? 'shell-rail' : null) }
  const bareRoot: RootLike = { querySelectorAll: () => [bare] }
  check('T6-10 bare probe element (no signals) still resolves', resolveWeb(bareRoot, railRec).ok === true)
}

// ── T6-8: ambiguity is a miss again (resolver level) ─────────────
{
  const pronRec = rec('set-pron-entry').record
  const two = rootOf([
    el('div', { 'data-present': 'set-pron-entry' }, 'pron1', true),
    el('div', { 'data-present': 'set-pron-entry' }, 'pron2', true),
  ])
  const r = resolveWeb(two, pronRec)
  check('T6-8 two visible set-pron-entry = ambiguous miss', r.ok === false && r.reason === 'ambiguous', r.ok ? '' : r.reason)
  const one = rootOf([el('div', { 'data-present': 'set-pron-entry' }, 'pron1', true)])
  check('T6-8 one set-pron-entry resolves', resolveWeb(one, pronRec).ok === true)
  const tocRec = rec('book-toc-row').record
  const three = rootOf([1, 2, 3].map((i) => el('button', { 'data-present': 'book-toc-row' }, 'toc' + i, true)))
  const r3 = resolveWeb(three, tocRec)
  check('T6-8 three book-toc-row = ambiguous miss', r3.ok === false && r3.reason === 'ambiguous')
  // one visible + one hidden family member: hidden is not a match
  const mixed = rootOf([
    el('div', { 'data-present': 'set-pron-entry' }, 'vis', true),
    el('div', { 'data-present': 'set-pron-entry' }, 'hid', false),
  ])
  check('T6-8 visible+hidden pron-entry resolves to visible', resolveWeb(mixed, pronRec).ok === true)
}

// ── T6-12: stay-here landing ─────────────────────────────────────
{
  // family id: shell-nav:listen
  const navEl = el('button', { 'data-present': 'shell-nav', 'data-route': 'listen' }, 'nav', true)
  const l1 = resolveStayHereLanding(rootOf([navEl]), 'shell-nav:listen')
  check('T6-12 shell-nav:listen lands', l1.status === 'landed' && (l1.element as unknown as FakeEl)._label === 'nav')
  // CLASS anchor: listen-play (.play-btn, no data-present)
  const playEl = el('button', { class: 'play-btn big' }, 'play', true)
  const l2 = resolveStayHereLanding(rootOf([playEl]), 'listen-play')
  check('T6-12 listen-play (CLASS) lands', l2.status === 'landed', l2.status === 'unlandable' ? l2.reason : '')
  // EXISTING anchor: book-block:1 ([data-b="1"])
  const blockEl = el('p', { 'data-b': '1' }, 'block1', true)
  const l3 = resolveStayHereLanding(rootOf([blockEl]), 'book-block:1')
  check('T6-12 book-block:1 (EXISTING) lands', l3.status === 'landed', l3.status === 'unlandable' ? l3.reason : '')
  // voice-picker-group family
  const section = el('section', { 'data-group': 'en-US' }, 'section', true)
  const headBtn = el('button', { 'data-group': 'en-US', 'data-present': 'voice-picker-group:head' }, 'head', true)
  const l4 = resolveStayHereLanding(rootOf([section, headBtn]), 'voice-picker-group:en-US')
  check('T6-12 voice-picker-group:en-US lands on section', l4.status === 'landed' && (l4.element as unknown as FakeEl)._label === 'section')
  // multi-seat: hidden first seat, visible second seat
  const pillH = el('span', { 'data-present': 'shell-status-pill' }, 'pill-hidden', false)
  const pillV = el('span', { 'data-present': 'shell-status-pill' }, 'pill-visible', true)
  const l5 = resolveStayHereLanding(rootOf([pillH, pillV]), 'shell-status-pill')
  check('T6-12 status-pill lands on VISIBLE seat', l5.status === 'landed' && (l5.element as unknown as FakeEl)._label === 'pill-visible')
  // stage-only + contract: declared unlandable with reason, not silent
  const l6 = resolveStayHereLanding(rootOf([]), 'bubble-stage-orb')
  check('T6-12 bubble-stage-orb declared stage-only', l6.status === 'unlandable' && l6.reason === 'stage-only', l6.status === 'unlandable' ? l6.reason : '')
  const l7 = resolveStayHereLanding(rootOf([]), 'bubble-state')
  check('T6-12 bubble-state (contract) declared not-a-web-anchor', l7.status === 'unlandable' && l7.reason === 'not-a-web-anchor', l7.status === 'unlandable' ? l7.reason : '')

  // Census over ALL script anchor ids: in-principle landable vs by-design unlandable
  const ids = new Set<string>()
  for (const entry of MODULE_CATALOGUE) {
    if (!entry.script) continue
    for (const f of flattenSteps(entry.script)) ids.add(f.step.anchorId)
  }
  let webLandable = 0, byDesign = 0, unknown = 0
  const byDesignReasons: Record<string, number> = {}
  for (const id of ids) {
    const f = anchorRecordFor(id)
    if (!f) { unknown++; continue }
    // empty-root landing classifies by-design reasons before missing
    const l = resolveStayHereLanding(rootOf([]), id)
    if (l.status === 'unlandable' && (l.reason === 'not-a-web-anchor' || l.reason === 'stage-only' || l.reason === 'not-in-registry')) {
      byDesign++; byDesignReasons[l.reason] = (byDesignReasons[l.reason] ?? 0) + 1
    } else webLandable++ // missing/ambiguous/not-visible on empty root = has a real locator
  }
  console.log(`T6-12 census distinctScriptIds=${ids.size} inPrincipleLandable=${webLandable} byDesignUnlandable=${byDesign} unknown=${unknown} reasons=${JSON.stringify(byDesignReasons)}`)
  check('T6-12 census covers ~310 ids', ids.size >= 300, `n=${ids.size}`)
}

// ── T6-11: the λ tap's target actually flips (scenario port) ─────
{
  let real = false
  const calls: boolean[] = []
  const scen = createScenario({
    lambdaPort: {
      getBubbleOn: () => real,
      setBubbleOn: (on: boolean) => { calls.push(on); real = on },
    },
  })
  // This is exactly what the stage λ button's onClick now calls:
  // scenario.stage.setLambda(!lambdaOn)
  const before = scen.stage.lambdaOn()
  scen.stage.setLambda(!before)
  check('T6-11 setLambda flips the real port', real === !before && calls.length === 1, `calls=${JSON.stringify(calls)}`)
  check('T6-11 lambdaOn now reports flipped state (gold dot truth)', scen.stage.lambdaOn() === !before)
  scen.stage.setLambda(before)
  check('T6-11 second tap flips back', real === before && calls.length === 2)
}

console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`)
process.exitCode = fails === 0 ? 0 : 1
