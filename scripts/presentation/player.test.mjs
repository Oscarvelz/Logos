/**
 * player.test.mjs — source probes for presentation-player.tsx (house
 * pattern: plain Node, node:test, reads the source as text — the copy
 * has no node_modules, so the React component cannot execute here;
 * rendered proof belongs to the pack benches).
 *
 * Run: node --test scripts/presentation/player.test.mjs
 *
 * Covers the Builder-3b wiring contracts that ARE checkable from the
 * source: the P1 opening window (prepare/confirmStart/abortClean, the
 * .lp-openwin family, the exact EN/ES strings), the P3 captioned-birth
 * latch, the P5 ✕ window's seat outside the card, the P6 no-target
 * state, the P11 footprint/subject wiring, the P10 frame-tracking loop,
 * the P12 gesture map + read-gate, the P14 backgrounding wiring, the
 * P17 done-card declaration, and the P18 live reduced-motion listener.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src/lib/presentation/engine/presentation-player.tsx'),
  'utf8',
)
const CSS = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src/lib/presentation/engine/presentation-player.css'),
  'utf8',
)

describe('P1 — opening window', () => {
  test('the run begins with prepare(), never the combined start()', () => {
    // Canon seam (integration map §8): prepare carries the host's
    // resumeFrom launch point — the invariant is prepare-not-start.
    assert.ok(SRC.includes('runner.prepare({ resumeFrom: props.resumeFrom })'))
    assert.ok(!SRC.includes('runner.start('), 'the player must not bypass the opening phase')
    assert.ok(SRC.includes('runnerRef.current?.confirmStart()'))
    assert.ok(SRC.includes('runnerRef.current?.abortClean()'))
  })

  test('the .lp-openwin family renders with the exact bilingual strings', () => {
    for (const cls of ['lp-openwin', 'lp-openwin-t', 'lp-openwin-modes', 'lp-openwin-list', 'lp-openwin-row', 'lp-openwin-name', 'lp-openwin-hint', 'lp-openwin-actions']) {
      assert.ok(SRC.includes(cls), `missing ${cls}`)
    }
    assert.ok(SRC.includes('Before you start'))
    assert.ok(SRC.includes('Antes de empezar'))
    assert.ok(SRC.includes('Watch it (Automatic): Logos performs each step and taps for you.'))
    assert.ok(SRC.includes('Mírala (Automático): Logos hace cada paso y toca por ti.'))
    assert.ok(SRC.includes('Preparing the first step…'))
    assert.ok(SRC.includes('Preparando el primer paso…'))
    assert.ok(SRC.includes("'Not now'") || SRC.includes('Not now'))
    assert.ok(SRC.includes('Ahora no'))
    // Blocked prepare: the notice replaces the hint and Start is not offered.
    assert.ok(SRC.includes('snapshot.blockedNotice'))
  })

  test('readiness requires a current beat, a resolved anchor and a caption, plus a seat — or a non-element first beat', () => {
    // A first beat resolving to a non-element target (contract/store)
    // never produces a seat: elementOf() is null on a resolved
    // resolution, and the P6 corner seat is that beat's seat.
    assert.ok(SRC.includes("snapshot?.resolution?.status === 'resolved' && elementOf(snapshot) === null"))
    assert.ok(SRC.includes('const firstBeatNonElement ='))
    assert.ok(SRC.includes('current !== null &&'))
    assert.ok(SRC.includes("snapshot?.resolution?.status === 'resolved' &&"))
    assert.ok(SRC.includes('!!caption &&'))
    assert.ok(SRC.includes('(seat !== null || firstBeatNonElement)'))
    assert.ok(!SRC.includes("seat !== null && current !== null && snapshot?.resolution?.status === 'resolved' && !!caption"), 'the old seat-only formula is gone')
  })
})

describe('P3 — captioned-birth latch', () => {
  test('chrome paints only after the latch (the done card excepted)', () => {
    assert.ok(SRC.includes('const [born, setBorn] = useState(false)'))
    assert.ok(SRC.includes('if (!born && caption && seat !== null) setBorn(true)'))
    assert.ok(SRC.includes("const paintChrome = born || status === 'done'"))
    assert.ok(SRC.includes('active && paintChrome && hole'))
    assert.ok(SRC.includes('active && paintChrome && ringHole'))
  })
})

describe('P5 — the ✕ window leaves the card', () => {
  test('the .lp-closewin JSX is a sibling after the card, not inside it', () => {
    const cardStart = SRC.indexOf('ref={cardRef} className="lp-card"')
    const cardEnd = SRC.indexOf(') : null}', cardStart)
    const closewin = SRC.indexOf('className="lp-closewin"')
    assert.ok(cardStart >= 0 && cardEnd > cardStart, 'card block located')
    assert.ok(closewin > cardEnd, 'the close window renders after the card closes')
    assert.equal(SRC.split('className="lp-closewin"').length - 1, 1, 'exactly one close window')
  })

  test('stale prose is fixed: no ".55 veil", no windows-on-the-card claim', () => {
    assert.ok(SRC.includes('in a .45 veil'))
    assert.ok(!SRC.includes('.55 veil'))
  })
})

describe('Ruling 2026-11-15 — every pop-up / confirmation window centres', () => {
  test('the .lp-staywin JSX is a sibling after the card, not inside it', () => {
    const cardStart = SRC.indexOf('ref={cardRef} className="lp-card"')
    const cardEnd = SRC.indexOf(') : null}', cardStart)
    const staywin = SRC.indexOf('className="lp-staywin"')
    assert.ok(cardStart >= 0 && cardEnd > cardStart, 'card block located')
    assert.ok(staywin > cardEnd, 'the stay window renders after the card closes')
    assert.equal(SRC.split('className="lp-staywin"').length - 1, 1, 'exactly one stay window')
  })

  test('all three windows carry the centred-modal seat in CSS', () => {
    for (const cls of ['.lp-staywin', '.lp-closewin', '.lp-openwin']) {
      const at = CSS.indexOf(cls)
      assert.ok(at >= 0, `${cls} exists`)
      const block = CSS.slice(at, CSS.indexOf('}', at))
      assert.ok(block.includes('position: fixed'), `${cls} is fixed`)
      assert.ok(block.includes('top: 50%') && block.includes('left: 50%'), `${cls} stands at the centre`)
      assert.ok(block.includes('translate(-50%, -50%)'), `${cls} centres on its own middle`)
    }
    // The stay window's old in-card seat is gone.
    assert.ok(!/\.lp-staywin \{[^}]*margin-top/.test(CSS), 'no in-flow stay window remains')
  })
})

describe('P6 — honest no-target state', () => {
  test('resolved-but-not-an-element clears BOTH rects', () => {
    const at = SRC.indexOf("snapshot.resolution?.status === 'resolved' && !actElement")
    assert.ok(at >= 0)
    assert.ok(SRC.slice(at, at + 600).includes('setLastRect(null)'))
  })

  test('one full-viewport veil panel, no ring, corner-seated card', () => {
    assert.ok(SRC.includes('const noTarget = active && born && focus === null'))
    assert.ok(SRC.includes('className="lp-veil" style={{ inset: 0 }}'))
    assert.ok(SRC.includes('seat !== null || focus === null'), 'showCard accepts the corner seat')
  })
})

describe('P10/P11 — footprint, subject, frame tracking', () => {
  test('effect/subject resolve through the mount resolver and union into the footprint', () => {
    assert.ok(SRC.includes('resolverRef.current = resolver'))
    assert.ok(SRC.includes('resolver.resolveById(anchorId, step.payload?.param)'))
    assert.ok(SRC.includes('const footprint = unionRect(footprintRects)'))
    assert.ok(SRC.includes('0.7 * viewport.w * viewport.h'), 'the >70% footprint rule')
    assert.ok(SRC.includes('className="lp-subject"'))
    assert.ok(SRC.includes('cardHeightRef'), 'the card-height ref feeds cardSeat')
  })

  test('the tracking loop: rAF until 3 stable frames or 900 ms, then observers', () => {
    assert.ok(SRC.includes('stableFrames >= 3 || performance.now() - startedAt >= 900'))
    assert.ok(SRC.includes('new ResizeObserver'))
    assert.ok(SRC.includes('tryRebind'), 'one re-resolution attempt on detach')
    assert.ok(SRC.includes('isConnected'), 'detach is detected')
  })
})

describe('P12 — gesture listeners + read-gate', () => {
  test('the listener hears the gesture the step declares', () => {
    assert.ok(SRC.includes("case 'tap':"))
    assert.ok(SRC.includes("type = 'click'"))
    assert.ok(SRC.includes("type = 'input'"))
    assert.ok(SRC.includes("type = 'keydown'"))
    assert.ok(SRC.includes("type = 'scroll'"))
    assert.ok(SRC.includes('capture = true'))
    assert.ok(SRC.includes("type = 'pointerdown' // the documented fallback for hover / goto"))
    assert.ok(!SRC.includes("element.addEventListener('pointerdown', onAct"), 'the single pointerdown listener is gone')
  })

  test('the gate is captionDurationMs converted through physicalSpeed', () => {
    assert.ok(SRC.includes('captionDurationMs(captionText ?? \'\', lang) / physicalSpeed(snapshot.speed)'))
    assert.ok(SRC.includes('if (!gateOpen) return // the read-gate'))
    assert.ok(SRC.includes('aria-disabled={!gateOpen || snapshot.showMeDwelling}'))
    assert.ok(SRC.includes('disabled={snapshot.showMeDwelling}'), '› is inert while a shown result dwells')
  })
})

describe('P14/P17/P18 — backgrounding, declaration, live calm', () => {
  test('visibilitychange and pagehide reach the runner', () => {
    assert.ok(SRC.includes("document.addEventListener('visibilitychange', onVisibility)"))
    assert.ok(SRC.includes("window.addEventListener('pagehide', onPageHide)"))
    assert.ok(SRC.includes('runnerRef.current?.handleHidden()'))
    assert.ok(SRC.includes('runnerRef.current?.handleVisible()'))
  })

  test('the done-card declaration strings exist in both languages', () => {
    assert.ok(SRC.includes('This lesson does not count as learned.'))
    assert.ok(SRC.includes('Esta lección no cuenta como aprendida.'))
    assert.ok(SRC.includes('scene could not be shown:'))
    assert.ok(SRC.includes('scenes could not be shown:'))
    assert.ok(SRC.includes('escena no pudo mostrarse:'))
    assert.ok(SRC.includes('escenas no pudieron mostrarse:'))
    assert.ok(SRC.includes('Help lives in Settings: every control explains itself there.'))
    assert.ok(SRC.includes('La ayuda vive en Ajustes: cada control se explica allí.'))
    assert.ok(SRC.includes("status === 'done' && (snapshot?.endReason === 'required-anchor-miss' || skipCount > 0)"))
  })

  test('the ring breath subscribes to reduced-motion changes', () => {
    assert.ok(SRC.includes("window.matchMedia('(prefers-reduced-motion: reduce)')"))
    assert.ok(SRC.includes("query.addEventListener?.('change', onChange)"))
    assert.ok(SRC.includes('if (!rect || !ringRef.current || motionCalm) return'))
  })
})
