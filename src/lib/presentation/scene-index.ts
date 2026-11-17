/**
 * The presentation scene index — the search's registry (integration
 * layer, housed in a plain .ts module so the node suites can probe
 * it without the React tree).
 *
 * Derived from the catalogue and the scripts themselves — never a
 * second, hand-kept list. The cache holds only what does NOT depend
 * on the UI language: each scene's identity, its landings, its
 * bilingual haystack, and its bilingual title SOURCES. Display
 * titles are derived from those sources on every read, in the
 * language the UI speaks NOW (T6-16): the old index baked the
 * first-use language into the cached hits, so after a language
 * switch the search kept FINDING scenes (the haystack is bilingual)
 * but kept DISPLAYING their titles in the previous language until a
 * full reload.
 */
import { MODULE_CATALOGUE } from './catalogue.ts'
import { anchorRecordFor, isStageOnlyAnchor } from './anchors.ts'
import { flattenSteps, pickText, type BilingualText } from './engine/types.ts'
import { settings } from '../settings.ts'
// Side effect: register every script into the catalogue HERE, on the
// index itself (the M-35 cure, carried from presentation-search):
// the index is derived from the registered scripts, and a surface
// that silently depended on some other module having registered
// first could name scenes over an empty (or stale) catalogue.
import './scripts/index.ts'

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

/** The cached half of a hit: everything language-independent, plus
 *  the bilingual title sources the display titles derive from. */
interface SceneHitSource extends Omit<SceneHit, 'moduleTitle' | 'sceneTitle'> {
  moduleTitleText: BilingualText
  sceneTitleText: BilingualText
}

let cachedIndex: SceneHitSource[] | null = null
function sceneIndexSources(): SceneHitSource[] {
  if (cachedIndex) return cachedIndex
  const out: SceneHitSource[] = []
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
        moduleTitleText: entry.title,
        sceneId: scene.id,
        sceneTitleText: scene.chapter,
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

export function presentationSceneIndex(): SceneHit[] {
  const lang = settings.get().uiLang
  return sceneIndexSources().map((s) => ({
    moduleId: s.moduleId,
    moduleTitle: pickText(s.moduleTitleText, lang),
    sceneId: s.sceneId,
    sceneTitle: pickText(s.sceneTitleText, lang),
    step: s.step,
    stepId: s.stepId,
    anchorId: s.anchorId,
    haystack: s.haystack,
  }))
}

export function searchScenes(query: string): SceneHit[] {
  const q = norm(query.trim())
  if (q.length < 2) return []
  const terms = q.split(/\s+/)
  return presentationSceneIndex()
    .filter((hit) => terms.every((term) => hit.haystack.includes(term)))
    .slice(0, 8)
}
