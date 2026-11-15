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
 *
 * THE FIRST-RUN OFFER: offered once, never imposed. It stands as a
 * slim banner on the home surface until it is answered either way;
 * after that it never returns — the system waits silently in
 * Settings, where the search above and the index live.
 */
import { useMemo, useState } from 'react'
import { MODULE_CATALOGUE, catalogueModule } from './presentation/catalogue.ts'
import { anchorRecordFor } from './presentation/anchors.ts'
import { flattenSteps, pickText } from './presentation/engine/types.ts'
import {
  defaultPresentationStorage,
  loadPresentationState,
  savePresentationState,
  withModuleProgress,
} from './presentation/presentation-state.ts'
import { launchPresentation } from './presentation-host.tsx'
import { settings } from './settings.ts'
import { t } from './i18n.ts'

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
        if (rec && rec.record.kind === 'web') { anchorId = f.step.anchorId; break }
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
/** Watch: open the module at the scene. The place is written into
 *  the presentation's own state file as an in-progress resume
 *  point — the runner's documented door — so entry seeding builds
 *  the fiction of the earlier scenes before the first beat. */
export function watchScene(hit: SceneHit) {
  const entry = catalogueModule(hit.moduleId)
  if (!entry?.script) return
  const storage = defaultPresentationStorage()
  const state = loadPresentationState(storage)
  savePresentationState(storage, withModuleProgress(state, hit.moduleId, {
    state: 'in-progress',
    step: hit.step,
    scene: hit.sceneId,
    stepId: hit.stepId,
    verifiedAgainst: entry.script.verifiedAgainst ?? 'unknown',
    skips: [],
  }))
  launchPresentation(hit.moduleId)
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
 *  element scrolled into view. */
export function goToAnchor(anchorId: string) {
  const found = anchorRecordFor(anchorId)
  const route = routeForAnchor(anchorId)
  if (location.hash !== `#${route}`) location.hash = route
  const unfold = found?.record.precondition?.match(/unfold\('([^']+)'\)/)?.[1]
  let tries = 0
  const tick = () => {
    tries++
    if (unfold) {
      const card = document.querySelector(`[data-present="${unfold}"]`)
      const head = card?.querySelector('button')
      if (card && head && !document.querySelector(`[data-present="${cssEscape(anchorValue(anchorId))}"]`)) {
        head.click()
      }
    }
    const el = document.querySelector(`[data-present="${cssEscape(anchorValue(anchorId))}"]`)
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }
    if (tries < 14) setTimeout(tick, 180)
  }
  setTimeout(tick, 220)
}

function anchorValue(anchorId: string): string {
  return anchorId.split(':').filter((s) => !s.startsWith('{')).join(':')
}
function cssEscape(v: string): string {
  return v.replace(/["\\]/g, '\\$&')
}

// ── The search block (Settings, above the index card) ─────────────
export function PresentationSearch() {
  const [query, setQuery] = useState('')
  const hits = useMemo(() => searchScenes(query), [query])
  return (
    <div className="card card-pad pres-search">
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
          {hit.anchorId && <button className="btn sm ghost" onClick={() => goToAnchor(hit.anchorId!)}>{t('Go')}</button>}
        </div>
      ))}
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
    <div className="card card-pad pres-offer" style={{ margin: '14px 16px 0' }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{t('New here? Logos can teach you itself.')}</div>
      <p className="muted small" style={{ margin: '6px 0 12px', lineHeight: 1.5 }}>
        {t('Short guided lessons walk the whole app, on a practice stage — your own library is never touched.')}
      </p>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn primary" onClick={() => answer(true)}>{t('Start the tour')}</button>
        <button className="btn ghost" onClick={() => answer(false)}>{t('Not now')}</button>
      </div>
    </div>
  )
}
