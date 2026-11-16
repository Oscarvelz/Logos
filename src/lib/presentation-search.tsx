/**
 * Presentation search + the first-run offer (integration-owned).
 *
 * SEARCH FINDS MODULES (the universal codex): every module and
 * scene is registered here with its anchor and its words, derived
 * from the catalogue and the scripts themselves — never a second,
 * hand-kept list. A scene result offers BOTH landings the law
 * requires: «Watch» leaves you in the scene (the module opens at
 * that scene, its fiction seeded up to it by the runner's own
 * entry seeding), and «Go» takes you straight to the real function
 * itself (its page, its card unfolded, the element in view).
 * «Go» resolves through the registry's own semantics — the one
 * declared locator per anchor, exactly as the engine resolves —
 * and a landing that cannot be made is said out loud, never a
 * silent dead poll; a scene whose only anchors live on the sealed
 * fiction stage has no «Go» at all, because no such element can
 * exist in the real app, and «Watch» is its honest door.
 *
 * THE FIRST-RUN OFFER: offered once, never imposed. It stands as a
 * slim banner on the home surface until it is answered either way;
 * after that it never returns — the system waits silently in
 * Settings, where the search above and the index live.
 */
import { useMemo, useState } from 'react'
import { MODULE_CATALOGUE, catalogueModule } from './presentation/catalogue.ts'
import {
  anchorRecordFor,
  isStageOnlyAnchor,
  resolveWeb,
  unfoldHeaderId,
  type RootLike,
} from './presentation/anchors.ts'
import { flattenSteps, pickText } from './presentation/engine/types.ts'
import {
  defaultPresentationStorage,
  loadPresentationState,
  savePresentationState,
  withWatchLanding,
} from './presentation/presentation-state.ts'
import { launchPresentation } from './presentation-host.tsx'
import { settings } from './settings.ts'
import { t } from './i18n.ts'
// Side effect: register every script into the catalogue HERE, on the
// search surface itself (the M-35 cure). The scene index below is
// derived from the registered scripts — module id, scene id, and the
// scene's first-step identity are the ONE dialect the index and the
// runner consume — and a search surface that silently depended on
// some other module having registered first could name scenes over
// an empty (or stale) catalogue, or name none at all. Importing the
// registration makes the dialect structural, not incidental.
import './presentation/scripts/index.ts'

// ── The registry ──────────────────────────────────────────────────
export interface SceneHit {
  moduleId: string
  moduleTitle: string
  sceneId: string
  sceneTitle: string
  /** Global step index of the scene's first step (the Watch landing). */
  step: number
  stepId: string
  /** The scene's first web anchor (the Go landing), when it has one. */
  anchorId: string | null
  haystack: string
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')

let cachedIndex: SceneHit[] | null = null
export function presentationSceneIndex(): SceneHit[] {
  if (cachedIndex) return cachedIndex
  const out: SceneHit[] = []
  for (const entry of MODULE_CATALOGUE) {
    const script = entry.script
    if (!script) continue
    const flat = flattenSteps(script)
    for (const scene of script.scenes) {
      const first = flat.find((f) => f.scene === scene)
      if (!first) continue
      let anchorId: string | null = null
      for (const f of flat) {
        if (f.scene !== scene) continue
        const rec = anchorRecordFor(f.step.anchorId)
        // The «Go» landing must be landable IN THE REAL APP: a
        // stage-only anchor (the sealed fiction stage's own seats)
        // can never exist there, so it is passed over for the
        // scene's next real anchor — and a scene with none offers
        // no «Go» rather than a button that polls and dies (H-25).
        if (rec && rec.record.kind === 'web' && !isStageOnlyAnchor(rec.record)) { anchorId = f.step.anchorId; break }
      }
      const words: string[] = [pickText(entry.title, 'en'), pickText(entry.title, 'es'), pickText(scene.chapter, 'en'), pickText(scene.chapter, 'es')]
      for (const f of flat) {
        if (f.scene !== scene) continue
        if (f.step.text) words.push(pickText(f.step.text, 'en'), pickText(f.step.text, 'es'))
        if (f.step.question) words.push(pickText(f.step.question, 'en'), pickText(f.step.question, 'es'))
      }
      out.push({
        moduleId: entry.id,
        moduleTitle: pickText(entry.title, settings.get().uiLang),
        sceneId: scene.id,
        sceneTitle: pickText(scene.chapter, settings.get().uiLang),
        step: first.globalIndex,
        stepId: first.step.id,
        anchorId,
        haystack: norm(words.join(' · ')),
      })
    }
  }
  cachedIndex = out
  return out
}

export function searchScenes(query: string): SceneHit[] {
  const q = norm(query.trim())
  if (q.length < 2) return []
  const terms = q.split(/\s+/)
  return presentationSceneIndex()
    .filter((hit) => terms.every((term) => hit.haystack.includes(term)))
    .slice(0, 8)
}

// ── The two landings ──────────────────────────────────────────────
/** Watch: open the module at the scene. The landing MERGES into
 *  the presentation's own state file (withWatchLanding — a seen
 *  module stays seen, the skip log survives, a further resume point
 *  is never rewound; the H-27 cure) and the launch carries the
 *  scene as its explicit resumeFrom (the H-26 cure), so entry
 *  seeding builds the fiction of the earlier scenes before the
 *  first beat and the runner starts exactly at the scene tapped. */
export function watchScene(hit: SceneHit) {
  const entry = catalogueModule(hit.moduleId)
  if (!entry?.script) return
  const storage = defaultPresentationStorage()
  const state = loadPresentationState(storage)
  savePresentationState(storage, withWatchLanding(
    state,
    hit.moduleId,
    { step: hit.step, scene: hit.sceneId, stepId: hit.stepId },
    entry.script.verifiedAgainst ?? 'unknown',
  ))
  launchPresentation(hit.moduleId, { step: hit.step, scene: hit.sceneId, stepId: hit.stepId })
}

function routeForAnchor(anchorId: string): string {
  if (anchorId.startsWith('shell-nav:')) return '/' + anchorId.slice('shell-nav:'.length)
  if (anchorId.startsWith('listen-') || anchorId.startsWith('voice-picker') || anchorId.startsWith('desk-') || anchorId.startsWith('share-')) return '/listen'
  if (anchorId.startsWith('voices-') || anchorId.startsWith('voice-card')) return '/voices'
  if (anchorId.startsWith('create-')) return '/create'
  if (anchorId.startsWith('set-')) return '/settings'
  return '/library'
}

/** Go: straight to the real function itself — its page, the card
 *  that owns it unfolded when the registry declares one, and the
 *  element scrolled into view.
 *
 *  Resolution is the registry's own (the H-25 cure): the record's
 *  ONE declared locator, through `resolveWeb` — a MINT anchor by
 *  its `data-present` value PLUS its companion attribute, a CLASS
 *  anchor by its class/role hook, an EXISTING anchor by its
 *  pre-existing attribute — exactly as the engine resolves a beat.
 *  A stage-only anchor (or a non-web one) is unlandable by design
 *  and fails at once, out loud; an element that never stands is
 *  reported through `onMiss` after the poll, never silently. The
 *  declared unfold step is performed once, from the precondition's
 *  real wording (`unfold <card> first …` — the T6-7 cure). Returns
 *  false when the anchor is unlandable by design. */
export function goToAnchor(anchorId: string, onMiss?: (anchorId: string, reason: string) => void): boolean {
  const found = anchorRecordFor(anchorId)
  if (!found || found.record.kind !== 'web' || isStageOnlyAnchor(found.record)) {
    // Unlandable BY DESIGN — the reason is declared by the registry,
    // and since the T6-12 completion it reaches the learner (the
    // rendering below words each reason honestly) instead of
    // collapsing into the same generic miss as a lost element.
    onMiss?.(anchorId, !found ? 'not-in-registry' : found.record.kind !== 'web' ? 'not-a-web-anchor' : 'stage-only')
    return false
  }
  const route = routeForAnchor(anchorId)
  if (location.hash !== `#${route}`) location.hash = route
  const root = document as unknown as RootLike
  const unfoldHeader = unfoldHeaderId(found.record)
  let tries = 0
  let unfolded = false
  let lastReason = 'missing'
  const tick = () => {
    tries++
    const res = resolveWeb(root, found.record, found.param)
    if (res.ok) {
      const el = res.value as { scrollIntoView?: (options?: { block?: string; behavior?: string }) => void }
      el.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
      return
    }
    lastReason = res.reason
    if (unfoldHeader && !unfolded) {
      // The declared resolution step, performed once: tap the owning
      // card's header so the interior element stands. (Once only —
      // a second tap would fold the card shut again.)
      unfolded = true
      const header = anchorRecordFor(unfoldHeader)
      if (header) {
        const hres = resolveWeb(root, header.record, header.param)
        if (hres.ok) {
          const hel = hres.value as {
            querySelector?: (selector: string) => { click?: () => void } | null
            click?: () => void
          }
          const head = hel.querySelector?.('button')
          if (head?.click) head.click()
          else hel.click?.()
        }
      }
    }
    if (tries < 14) setTimeout(tick, 180)
    else onMiss?.(anchorId, lastReason)
  }
  setTimeout(tick, 220)
  return true
}

// ── The search block (inside the opened Presentations index) ─────
// It lived in Settings above the card until 1.4.177 — Oscar: the
// search belongs inside Presentations, after it opens, never
// outside it. The index gives it its seat via the searchSlot prop.
export function PresentationSearch() {
  const [query, setQuery] = useState('')
  const [goMiss, setGoMiss] = useState<{ id: string; reason: string } | null>(null)
  const hits = useMemo(() => searchScenes(query), [query])
  return (
    <div className="pres-search">
      <div className="field-label"><span>{t('Find a lesson or a function')}</span></div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('Try “sleep”, “bubble”, “pronunciation”…')}
        aria-label={t('Find a lesson or a function')}
        style={{ width: '100%', height: 48, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)', padding: '0 14px', outline: 'none' }}
      />
      {query.trim().length >= 2 && hits.length === 0 && (
        <p className="muted small" style={{ margin: '10px 4px 0' }}>{t('Nothing in the lessons matches that yet.')}</p>
      )}
      {hits.map((hit) => (
        <div key={`${hit.moduleId}:${hit.sceneId}`} className="row" style={{ gap: 8, padding: '10px 0 0' }}>
          <div className="grow" style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 650 }}>{hit.sceneTitle}</div>
            <div className="muted small">{hit.moduleTitle}</div>
          </div>
          <button className="btn sm" onClick={() => watchScene(hit)}>{t('Watch')}</button>
          {hit.anchorId && (
            <button
              className="btn sm ghost"
              onClick={() => { setGoMiss(null); goToAnchor(hit.anchorId!, (id, reason) => setGoMiss({ id, reason })) }}
            >
              {t('Go')}
            </button>
          )}
        </div>
      ))}
      {goMiss && (
        <p className="muted small" role="status" style={{ margin: '10px 4px 0' }}>
          {goMiss.reason === 'stage-only'
            ? t('That spot lives only on the practice stage — Watch the lesson to see it there.')
            : goMiss.reason === 'not-a-web-anchor' || goMiss.reason === 'not-in-registry'
              ? t("That isn't a spot in the real app — Watch the lesson to see it in action.")
              : t("Couldn't find that spot in the real app.")}
        </p>
      )}
    </div>
  )
}

// ── The first-run offer ───────────────────────────────────────────
const OFFER_KEY = 'logos.presentation.offer.v1'

export function offerPending(): boolean {
  try {
    if (localStorage.getItem(OFFER_KEY)) return false
  } catch { return false }
  const state = loadPresentationState(defaultPresentationStorage())
  return Object.keys(state.modules).length === 0
}

export function PresentationOffer() {
  const [gone, setGone] = useState(false)
  if (gone || !offerPending()) return null
  const answer = (start: boolean) => {
    try { localStorage.setItem(OFFER_KEY, 'done') } catch { /* private mode */ }
    setGone(true)
    if (start) launchPresentation('Q0')
  }
  return (
    // Centered, over a dimmed world (1.4.175, Oscar): the offer
    // used to stand in flow at the top of the page, where a first
    // run could scroll past it unseen — «should be at the center
    // of the screen, not at the top, to make it difficult to
    // miss». It now wears the house's centered-window grammar
    // (the sheet's seat and entrance), over the presentation
    // family's veil — darkened and slightly desaturated, never
    // blurred. The veil takes the taps: the choice is the point,
    // and both answers live on the card.
    <div className="pres-offer-veil">
      <div className="card card-pad pres-offer-card" role="dialog" aria-modal="true">
        <div style={{ fontWeight: 700, fontSize: 16 }}>{t('New here? Logos can teach you itself.')}</div>
        <p className="muted small" style={{ margin: '6px 0 12px', lineHeight: 1.5 }}>
          {t('Short guided lessons walk the whole app, on a practice stage — your own library is never touched.')}
        </p>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn primary" onClick={() => answer(true)}>{t('Start the tour')}</button>
          <button className="btn ghost" onClick={() => answer(false)}>{t('Not now')}</button>
        </div>
      </div>
    </div>
  )
}
