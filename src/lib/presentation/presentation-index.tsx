/**
 * The Presentation index — the modules' home in Settings (PLAN §4).
 *
 * INTEGRATION LOOKS AT THE HOUSE FIRST: the fold replicates Settings'
 * own SetCard pattern exactly — the same classes (.card.set-card,
 * .set-card-h, .set-ic, .set-card-t/-s, .set-chev, .set-fold/-in), the
 * same .list/.list-row interior. SetCard is private to SettingsPage.tsx,
 * so — following the fleet precedent of a fold living in its own
 * component — the pattern is reproduced here rather than imported; the
 * declared deviations are that open state lives in this component (so
 * progress is re-read from the state file each time the fold opens — a
 * module played since Settings opened must show its new state on
 * return) and that the fold can be opened from outside: every module
 * returns to this index, so the runtime opens the fold on return even
 * though it arrives folded (census E §11) — via the `forceOpen` prop or
 * the PRESENTATIONS_OPEN_EVENT below.
 *
 * THE WIRING (SettingsPage.tsx, done in this same wave): a new
 * <section className="set-group"> between the Floating player section's
 * close (SettingsPage.tsx:317) and the Backup/About section's open
 * (:318), rendering <PresentationsCard />. That section carries the
 * registry's anchor mint, data-present="set-presentations" — the anchor
 * record names SettingsPage as its file (ANCHOR-REGISTRY §3), and the
 * section wraps exactly this one card, header included.
 *
 * This component never launches anything itself. The host passes
 * `onLaunch`; the card calls it with the module id and, for a part-way
 * or needs-refresh module, the recorded resume point. A module whose
 * script has not landed yet shows its promise and its state and NO
 * launch control — the index never pretends a module can play before
 * its script exists.
 *
 * Rules carried (PLAN §0.0, §4; FENCE-DESIGN §5, §7 clause 5):
 * - FREE START — every playable card can start; the two floors are
 *   labelled groups and the order a recommendation, never a lock.
 * - Each card announces BEFORE play: name, the capability promise, the
 *   state (unseen / in progress with Resume at the recorded point /
 *   seen / needs-refresh), and — once its script is registered — the
 *   duration label computed from that script at Automatic 1× by the one
 *   shared clock: «Aprox. N min» / "Approx. N min", never «unos»,
 *   never "about", never handwritten. No script → no label.
 * - Language follows the app: every word renders in the UI language
 *   from bilingual pairs, so the grammar gate holds in both languages.
 * - THE FIRST CARD (Oscar's law, Brizna lane 2026-11-14): the last-used
 *   module, if it was left incomplete, heads the whole list under
 *   «Sigue donde ibas» / "Pick up where you left off" — the same card,
 *   lifted out of its floor, appearing exactly once; completed, it
 *   returns to its floor and the heading is gone. The derivation is
 *   pure (`resumeHead` in catalogue.ts, fed by the state file's
 *   `lastUsed` mark); this component only renders it.
 * - THE GENERAL PROGRESS LINE (Oscar's law, Cadence lane 2026-11-14):
 *   ONE line over ALL modules, directly under the fold's intro and
 *   above the resume head — a slim bar, the studied percentage, and
 *   the counts that make it useful (finished of total · under way ·
 *   how much is left). The count is honest: a finished module counts
 *   whole, a part-way one counts its walked fraction, untouched counts
 *   zero; the percent is the equal-weight mean over the whole ladder
 *   (`overallProgress` in catalogue.ts). At an honest zero the counts
 *   give way to a short invitation — the line never nags.
 */
import { useEffect, useState } from 'react'
import { ChevronDown, GraduationCap, Play, RotateCcw } from 'lucide-react'
import { settings } from '../settings.ts'
import { useStore } from '../store.ts'
import {
  entryDuration,
  modulesOnFloor,
  overallProgress,
  resumeHead,
  stateFor,
  type CatalogueModule,
  type OverallProgress,
  type ResumePoint,
} from './catalogue.ts'
import {
  defaultPresentationStorage,
  loadPresentationState,
  type PresentationStorage,
} from './presentation-state.ts'
import { pickText, type BilingualText, type PresentationLanguage, type PresentationStateFile } from './engine/types.ts'
// Side effect: registers the Quick floor's scripts (Q0–Q5) into the
// catalogue, so their cards carry computed duration labels and launch
// controls. The Advanced entries stay script-less until their wave lands.
import './scripts/index.ts'
import './presentation-index.css'

/** The event the runtime dispatches so a returning module reopens this fold. */
export const PRESENTATIONS_OPEN_EVENT = 'logos-presentations-open'

export interface PresentationsCardProps {
  /**
   * The host's launch seam (the player's documented wiring point):
   * called with the module id, and with the recorded resume point when
   * the card is part-way or needs-refresh.
   */
  onLaunch?: (moduleId: string, resumeFrom?: ResumePoint) => void
  /** Storage override for the state file (tests / hosted shells). */
  storage?: PresentationStorage
  /** Open the fold on mount (deep link / return from a module). */
  forceOpen?: boolean
}

const CARD_TITLE: BilingualText = { en: 'Presentations', es: 'Presentaciones' }
const CARD_SUB: BilingualText = {
  en: 'Learn the whole app, guided, at your pace',
  es: 'Aprende la app entera, con guía, a tu ritmo',
}

/** The device-scope announcement at the index head (PLAN §0.1, OQ-3). */
export const PRESENTATION_ANNOUNCEMENT: BilingualText = {
  en: 'Lessons run on every screen Logos serves — phone, tablet and computer. The bubble lessons live in the Android app.',
  es: 'Las lecciones corren en cada pantalla que Logos sirve — teléfono, tableta y ordenador. Las lecciones de la burbuja viven en la app de Android.',
}

const FLOOR_HEADS: Record<'quick' | 'advanced', { title: BilingualText; sub: BilingualText }> = {
  quick: {
    title: { en: 'Quick', es: 'Rápido' },
    sub: {
      en: 'Start anywhere — the order is a recommendation, never a lock.',
      es: 'Empieza donde quieras — el orden es una recomendación, nunca una cerradura.',
    },
  },
  advanced: {
    title: { en: 'Advanced', es: 'Avanzado' },
    sub: {
      en: 'The whole app, in depth, when you are ready.',
      es: 'La app entera, a fondo, cuando estés listo.',
    },
  },
}

const STATE_WORDS: Record<string, BilingualText> = {
  unseen: { en: 'Not started', es: 'Sin empezar' },
  'in-progress': { en: 'Part-way', es: 'A mitad' },
  seen: { en: 'Seen', es: 'Visto' },
  'needs-refresh': { en: 'Needs a refresh', es: 'Necesita una actualización' },
}

const START_WORD: BilingualText = { en: 'Start', es: 'Empezar' }
const RESUME_WORD: BilingualText = { en: 'Resume', es: 'Reanudar' }

/**
 * The resume head's words — Oscar's own (Brizna lane, 2026-11-14):
 * the last-used module, left incomplete, heads the whole list under
 * exactly this heading (the FIRST-CARD law; `resumeHead`, catalogue.ts).
 */
const RESUME_HEAD_TITLE: BilingualText = { en: 'Pick up where you left off', es: 'Sigue donde ibas' }

/**
 * The general progress line's words (the OVERALL-PROGRESS law — Oscar,
 * Cadence lane 2026-11-14). The lead completes the percentage beside
 * it: «12%» + "of the app studied" / «de la app ya estudiado». The
 * counts line carries the figures that make the line useful — finished
 * of total, under way, and how much is left («Te falta el 88%») — and
 * while nothing has been started the counts give way to one short
 * invitation instead: an honest zero, no nagging.
 */
const PROGRESS_LEAD: BilingualText = { en: 'of the app studied', es: 'de la app ya estudiado' }
const PROGRESS_INVITE: BilingualText = { en: 'Start wherever you like.', es: 'Empieza por donde quieras.' }

/** The counts line under the bar, in the UI language. */
function progressCounts(progress: OverallProgress, lang: PresentationLanguage): string {
  const parts = [
    lang === 'es'
      ? `${progress.finished} de ${progress.total} módulos terminados`
      : `${progress.finished} of ${progress.total} modules finished`,
  ]
  if (progress.inProgress > 0) {
    parts.push(lang === 'es' ? `${progress.inProgress} en curso` : `${progress.inProgress} in progress`)
  }
  if (progress.remainingPercent > 0) {
    parts.push(lang === 'es' ? `Te falta el ${progress.remainingPercent}%` : `${progress.remainingPercent}% to go`)
  }
  return parts.join(' · ')
}

/** The bar's spoken sentence (its aria-label), in the UI language. */
function progressAria(progress: OverallProgress, lang: PresentationLanguage): string {
  if (progress.finished === 0 && progress.inProgress === 0) {
    return lang === 'es' ? 'Todavía no has estudiado nada de la app.' : "You haven't studied any of the app yet."
  }
  return lang === 'es'
    ? `Has estudiado el ${progress.percent}% de la app.`
    : `You've studied ${progress.percent}% of the app.`
}

const MY_SCENES_TITLE: BilingualText = { en: 'My scenes', es: 'Mis escenas' }
const MY_SCENES_EMPTY: BilingualText = {
  en: 'Scenes you save from a lesson’s chapters will live here.',
  es: 'Las escenas que guardes desde los capítulos de una lección vivirán aquí.',
}

function ModuleRow({
  entry,
  lang,
  state,
  onLaunch,
}: {
  entry: CatalogueModule
  lang: PresentationLanguage
  state: PresentationStateFile
  onLaunch?: PresentationsCardProps['onLaunch']
}) {
  const announced = stateFor(entry, state)
  const duration = entryDuration(entry, lang)
  const playable = entry.script !== null && onLaunch !== undefined
  const partway = announced.state === 'in-progress' || announced.state === 'needs-refresh'
  return (
    <div className="list-row" style={{ display: 'block' }}>
      <div className="pres-mod-t">
        <span className="t">{pickText(entry.title, lang)}</span>
        {duration ? <span className="pres-dur">{duration.label}</span> : null}
      </div>
      <div className="d">{pickText(entry.capability, lang)}</div>
      <div className="pres-mod-foot">
        <span className={`pres-state ${announced.state === 'seen' ? 'seen' : ''} ${announced.state === 'needs-refresh' ? 'refresh' : ''}`}>
          {pickText(STATE_WORDS[announced.state], lang)}
        </span>
        {playable ? (
          <button
            className="btn ghost pres-go"
            onClick={() => onLaunch(entry.id, partway ? announced.resume : undefined)}
          >
            <span>
              {partway ? <RotateCcw size={15} /> : <Play size={15} />}
              {pickText(partway ? RESUME_WORD : START_WORD, lang)}
            </span>
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function PresentationsCard({ onLaunch, storage, forceOpen }: PresentationsCardProps) {
  const st = useStore(settings)
  const lang: PresentationLanguage = st.uiLang === 'es' ? 'es' : 'en'
  const [open, setOpen] = useState(!!forceOpen)
  const [state, setState] = useState<PresentationStateFile>(() =>
    loadPresentationState(storage ?? defaultPresentationStorage()),
  )

  // Re-read progress each time the fold opens: a module played since
  // Settings opened shows its new state on return (census E §11).
  useEffect(() => {
    if (open) setState(loadPresentationState(storage ?? defaultPresentationStorage()))
  }, [open, storage])

  // A module returning to the index reopens its fold (census E §11).
  useEffect(() => {
    const onOpenRequest = () => setOpen(true)
    addEventListener(PRESENTATIONS_OPEN_EVENT, onOpenRequest)
    return () => removeEventListener(PRESENTATIONS_OPEN_EVENT, onOpenRequest)
  }, [])

  // The FIRST-CARD law: the last-used module, left incomplete, heads the
  // whole list under «Sigue donde ibas» — lifted out of its floor, shown
  // exactly once (the floors below skip it). No head → the index is as
  // it always was.
  const head = resumeHead(state)

  // The OVERALL-PROGRESS law: ONE general line over all the modules,
  // directly under the fold's intro — a pure derivation (`overallProgress`
  // in catalogue.ts) rendered as a slim bar with its percentage and the
  // counts that make it useful. It is index furniture about the whole;
  // the resume head below it stays first among the cards.
  const progress = overallProgress(state)
  const untouched = progress.finished === 0 && progress.inProgress === 0

  return (
    <div className={'card set-card' + (open ? ' open' : '')}>
      <button className="set-card-h" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="set-ic"><GraduationCap size={19} /></span>
        <div className="grow">
          <div className="set-card-t">{pickText(CARD_TITLE, lang)}</div>
          <div className="set-card-s">{pickText(CARD_SUB, lang)}</div>
        </div>
        <ChevronDown size={18} className="set-chev" />
      </button>
      <div className={'set-fold' + (open ? ' open' : '')}>
        <div className="set-fold-in">
          {open ? (
            <>
              <p className="muted small pres-note">{pickText(PRESENTATION_ANNOUNCEMENT, lang)}</p>
              <div className="pres-progress">
                <div className="pres-progress-head">
                  <span className="pres-progress-pct">{progress.percent}%</span>
                  <span className="pres-progress-lead">{pickText(PROGRESS_LEAD, lang)}</span>
                </div>
                <div
                  className="pres-progress-bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress.percent}
                  aria-label={progressAria(progress, lang)}
                >
                  <div className="pres-progress-fill" style={{ width: `${progress.percent}%` }} />
                </div>
                <div className="pres-progress-counts muted small">
                  {untouched ? pickText(PROGRESS_INVITE, lang) : progressCounts(progress, lang)}
                </div>
              </div>
              {head ? (
                <div className="pres-floor pres-resume">
                  <div className="pres-floor-t">{pickText(RESUME_HEAD_TITLE, lang)}</div>
                  <div className="list">
                    <ModuleRow entry={head} lang={lang} state={state} onLaunch={onLaunch} />
                  </div>
                </div>
              ) : null}
              {(['quick', 'advanced'] as const).map((floor) => (
                <div className="pres-floor" key={floor}>
                  <div className="pres-floor-t">{pickText(FLOOR_HEADS[floor].title, lang)}</div>
                  <div className="pres-floor-s muted small">{pickText(FLOOR_HEADS[floor].sub, lang)}</div>
                  <div className="list">
                    {modulesOnFloor(floor)
                      .filter((entry) => entry.id !== head?.id)
                      .map((entry) => (
                        <ModuleRow key={entry.id} entry={entry} lang={lang} state={state} onLaunch={onLaunch} />
                      ))}
                  </div>
                </div>
              ))}
              <div className="pres-mine">
                <div className="pres-floor-t">{pickText(MY_SCENES_TITLE, lang)}</div>
                {state.myScenes.length === 0 ? (
                  <p className="muted small" style={{ padding: '0 2px', marginTop: 4 }}>{pickText(MY_SCENES_EMPTY, lang)}</p>
                ) : (
                  <div className="list" style={{ marginTop: 8 }}>
                    {state.myScenes.map((saved) => {
                      const entry = modulesOnFloor('quick')
                        .concat(modulesOnFloor('advanced'))
                        .find((m) => m.id === saved.module)
                      const scene = entry?.script?.scenes.find((s) => s.id === saved.scene)
                      const label = entry
                        ? `${pickText(entry.title, lang)} · ${scene ? pickText(scene.chapter, lang) : saved.scene}`
                        : `${saved.module} · ${saved.scene}`
                      return (
                        <div className="list-row" key={`${saved.module}:${saved.scene}`} style={{ display: 'block' }}>
                          <div className="t">{label}</div>
                          {entry?.script && onLaunch ? (
                            <div className="pres-mod-foot">
                              <button
                                className="btn ghost pres-go"
                                onClick={() => onLaunch(saved.module, { step: saved.step, scene: saved.scene, stepId: saved.stepId })}
                              >
                                <span><Play size={15} />{pickText(START_WORD, lang)}</span>
                              </button>
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
