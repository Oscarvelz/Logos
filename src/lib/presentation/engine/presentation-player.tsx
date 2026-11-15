/**
 * The presentation player — Logos edition of the fleet C′ card.
 *
 * THE CARD (fleet standard, settled in the Faro line 2026-11-13, Oscar's
 * laws): the card lives BESIDE the focus (below it when the focus is high,
 * above it when low; never parked away), ~370px wide on phones and growing
 * with presence on large screens (480px ≥840px, 550px ≥1500px — Logos'
 * real breakpoint ladder, census F); a 3px progress thread at the screen's
 * top edge fills with the theme accent per scene; the header is ONE line —
 * left only the counter «n / total», right a quiet mini control cluster
 * (25px tall, 12px icons since Oscar's order of 2026-11-14 — from his own
 * crops: the header buttons run smaller so nothing is cut by the card's
 * corner at phone width and the row breathes; the bottom row and the stay
 * window keep the larger quiet size): the mode button WITH its word
 * (Automático/Interactivo · Automatic/Interactive), speed (gauge + «1×»)
 * unfolding ALL five speeds inside the card with the current one filled
 * (the clock auto-pauses while choosing), chapters, pause (Automatic
 * only), ✕. The EXPLANATION IS THE PROTAGONIST — the largest type on the
 * card, line-height 1.52, captions ≤15 words. The lower area: «Module ·
 * Chapter» in a soft tone owns its own line(s) at the FULL card width (it
 * WRAPS whole — text never truncates into "…" where there is room; no
 * button beside it, per Oscar's order of 2026-11-14 from his crops), and
 * BELOW it one actions row carries «Stay here» plus, in Interactive,
 * «Show me» at the row's right end, at Stay here's level. THE NAV PAIR (Oscar's law, Brizna lane 2026-11-14;
 * seat moved to the header at Oscar's order, relayed from the Cadence
 * lane 2026-11-14): the icon-only pair «‹ ›» sits in the HEADER,
 * immediately LEFT of the mode button, Interactive only, their words
 * living in the aria-labels. ‹ goes back
 * one beat down the runner's return stack of lived positions and is
 * disabled when no return exists; › advances one beat and does not
 * exist on gesture beats, where the learner's own act on the stage —
 * or «Show me» — is the way through. Each of the pair answers a touch
 * with a selection touch (accent-tinted ground + slight shrink) — a tap
 * never answers with silence. In Automatic there is NO pair: the clock
 * drives and pause lives in the header. EVERY text+icon control keeps
 * word + icon on ONE line by construction (nowrap, no shrink — Oscar's
 * controls-never-split law); the pair is icon-only by the nav-pair law
 * itself.
 * «STAY HERE» MID-MODULE OPENS A WINDOW FIRST (Oscar's stay-here law,
 * Brizna lane 2026-11-14): a small pop-up on the card that tells the
 * learner they can continue this module later exactly where they left
 * it, and where the card lives — Settings → Presentations. While it is
 * open the runner holds the clock (the lesson never advances behind
 * it) and stands every transport verb down; only the window's confirm
 * dissolves the stage into the real place, and «Keep watching» closes
 * it with the lesson untouched. A finished module's exit (the end card)
 * needs no window and never grows one.
 * THE ✕ ASKS FIRST, TOO (Oscar's law, same lane): mid-module the ✕
 * opens its own confirmation window before exiting — same family, same
 * clock hold, same «Keep watching»; only its «Leave» confirm ends the
 * module, onto the place the runner already recorded. In BOTH windows
 * the QUESTION is the big headline and the body stays brief.
 * THE CARD IS BORN WHERE IT WILL LIVE (Oscar's law, same lane): while
 * its seat is being measured the card stays invisible — the seat comes
 * from geometry.ts's cardSeat() and the card renders only once a seat
 * exists, so its first visible frame is already home. It never appears
 * at a provisional seat and then travels.
 * The veil DARKENS and slightly DESATURATES the background — it
 * NEVER BLURS (Oscar's corrected principle, from his phone verdict
 * on Faro 1.3.277, 2026-11-14, derogating the earlier blurred-ground
 * wording): four panels tile the screen around the contained hole,
 * each tinting and muting what lies beneath it, so the buttons and
 * layout behind stay clearly inferable — the module tours the app
 * like a map, and a map you cannot read is useless. The hole itself
 * stays pixel-sharp, and no panel ever covers it, so a gesture
 * beat's stage receives the learner's real touch with nothing in
 * between.
 * The focus is a breathing hole (~10px air) in a .55 veil, ring + glow in
 * the theme accent. The hole is CONTAINED wholly inside the viewport on
 * all four sides (the screen-edge law, law (11)'s sibling — Oscar, Brizna
 * lane 2026-11-14; see geometry.ts): the air compresses at the edges, the
 * ring is never cut by a device edge. Paint comes ONLY from Logos' theme variables — the
 * --accent family and the house tokens (--gold is referenced in the app
 * but never defined, census F: it is NOT used here).
 *
 * House respect: reduced motion is the engine's own (the house's handling
 * is partial, census F) — no breathing, no smooth scroll, no transitions
 * when the user asks for calm. The card never fights immersive mode (it
 * does not touch the nav or `dataset.immersive`) and it lifts clear of the
 * mini player (the `.has-mini` inset is measured, not assumed).
 *
 * THE SCENARIO SEAM: while a module runs, the scenario sandbox is the only
 * data surface. This component renders the host's scenario stage (the
 * `ScenarioView` prop or `children`, fed the sealed scenario and nothing
 * else) — never the real app — and the runner performs every act through
 * the scenario port. Resolution is the runner's: late, live, per step,
 * through the anchor registry; this component never resolves, caches, or
 * invents a target of its own.
 *
 * THE ONE WIRING POINT (App.tsx — NOT done by this builder; the
 * Settings-index/integration builder owns it): where App renders its shell
 * subtree, render instead, while a module is launched:
 *
 *     {launchedModule ? (
 *       <PresentationPlayer
 *         script={launchedModule}
 *         scenario={createScenario({ lambdaPort })}
 *         ScenarioView={LogosScenarioStage}
 *         lang={settings.uiLang}
 *         onExit={() => setLaunchedModule(null)}
 *       />
 *     ) : (
 *       …the existing shell subtree, unchanged…
 *     )}
 *
 * with the Presentations index living in Settings as its own
 * `<section class="set-group">` between SettingsPage.tsx:317 and :318
 * (PLAN §4). The λ exception (Fence 0 E-λ) is the host's LambdaPort: the
 * scenario's `setLambda` is the only door out of the sandbox, and it flips
 * the user's own switch and nothing else.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookmarkCheck,
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Hand,
  List,
  MapPin,
  MousePointerClick,
  Pause,
  Play,
  X,
} from 'lucide-react'
import type { Scenario } from '../scenario/index.ts'
import type { PresentationStorage } from '../presentation-state.ts'
import { PRESENTATION_SPEEDS } from './clock.ts'
import { VIEW_MARGIN, cardSeat, containedHole } from './geometry.ts'
import { createAnchorResolver, liveContractEnv, type AnchorResolver, type ContractEnv, type StoreProbes } from './resolve.ts'
import { createPresentationRunner, type PresentationRunner, type RunnerSnapshot } from './runner.ts'
import type { ScenarioPort } from './scenario-port.ts'
import type { AnchorElementLike } from './resolve.ts'
import type { PresentationLanguage, PresentationMode, PresentationModule } from './types.ts'
import './presentation-player.css'

/** The scenario seam: the host's fiction stage, fed the sealed scenario only. */
export interface ScenarioViewProps {
  scenario: Scenario
}

export interface PresentationPlayerProps {
  script: PresentationModule
  /** The sealed scenario this module runs on (created fresh per launch). */
  scenario: Scenario
  /** A ready scenario port; absent = the default port over `scenario`. */
  scenarioPort?: ScenarioPort
  ScenarioView?: React.ComponentType<ScenarioViewProps>
  /** Or the stage as children (same contract: scenario-fed, never real data). */
  children?: React.ReactNode
  /** Called once, when the presentation is over (any ending). */
  onExit?: (info: { reason: RunnerSnapshot['endReason']; stayHereAnchorId: string | null }) => void
  initialMode?: PresentationMode
  /** UI language; absent = the document's language, else English. */
  lang?: PresentationLanguage
  resolver?: AnchorResolver
  contractEnv?: ContractEnv | (() => ContractEnv | null | undefined)
  storeProbes?: StoreProbes
  storage?: PresentationStorage
  appVersion?: string
  shellVersion?: string
}

interface TargetRect {
  top: number
  left: number
  width: number
  height: number
}

const LABELS = {
  automatic: { en: 'Automatic', es: 'Automático' },
  interactive: { en: 'Interactive', es: 'Interactivo' },
  chapters: { en: 'Chapters', es: 'Capítulos' },
  pause: { en: 'Pause', es: 'Pausa' },
  play: { en: 'Play', es: 'Reproducir' },
  exit: { en: 'Exit the lesson', es: 'Salir de la lección' },
  speed: { en: 'Presentation speed', es: 'Velocidad de la presentación' },
  stayHere: { en: 'Stay here', es: 'Quedarme aquí' },
  stayTitle: { en: 'Stay here?', es: '¿Quedarte aquí?' },
  stayResume: {
    en: 'You can continue this lesson later, exactly where you left off.',
    es: 'Puedes seguir esta lección después, justo donde la dejaste.',
  },
  stayFind: {
    en: 'Find this card again in Settings → Presentations.',
    es: 'Encuentra esta tarjeta en Ajustes → Presentaciones.',
  },
  keepWatching: { en: 'Keep watching', es: 'Seguir viendo' },
  closeTitle: { en: 'Leave this lesson?', es: '¿Salir de esta lección?' },
  closeBody: {
    en: 'Your place is saved. You can continue later, exactly where you are.',
    es: 'Tu lugar queda guardado. Podrás seguir después, justo donde estás.',
  },
  leaveLesson: { en: 'Leave', es: 'Salir' },
  showMe: { en: 'Show me', es: 'Muéstrame' },
  next: { en: 'Next', es: 'Siguiente' },
  back: { en: 'Back one step', es: 'Volver un paso' },
  saveScene: { en: 'Save scene', es: 'Guardar escena' },
  savedScene: { en: 'Saved', es: 'Guardada' },
  backToLessons: { en: 'Back to the lessons', es: 'Volver a las lecciones' },
  steps: { en: 'steps', es: 'pasos' },
  stayHereDone: {
    en: 'You are here — in your real Logos. The lesson’s case was fiction; this place is yours.',
    es: 'Estás aquí, en tu Logos de verdad. El caso de la lección era ficción; este lugar es tuyo.',
  },
  wholeLesson: { en: 'That is the whole lesson:', es: 'Esa es la lección completa:' },
} as const

type LabelKey = keyof typeof LABELS

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
}

function fmtSpeed(speed: number): string {
  return `${Number(speed.toFixed(2))}×`
}

function elementOf(snapshot: RunnerSnapshot | null): AnchorElementLike | null {
  const resolution = snapshot?.resolution
  if (!resolution || resolution.status !== 'resolved') return null
  const target = resolution.target as AnchorElementLike | null
  if (!target || typeof target.getBoundingClientRect !== 'function') return null
  return target
}

export function PresentationPlayer(props: PresentationPlayerProps) {
  const { script, scenario, onExit } = props
  const lang: PresentationLanguage =
    props.lang ?? (typeof document !== 'undefined' && document.documentElement.lang === 'es' ? 'es' : 'en')
  const label = (key: LabelKey): string => LABELS[key][lang]

  const runnerRef = useRef<PresentationRunner | null>(null)
  const exitNotifiedRef = useRef(false)
  const ringRef = useRef<HTMLDivElement | null>(null)

  const [snapshot, setSnapshot] = useState<RunnerSnapshot | null>(null)
  const [rect, setRect] = useState<TargetRect | null>(null)
  const [lastRect, setLastRect] = useState<TargetRect | null>(null)
  const [chaptersOpen, setChaptersOpen] = useState(false)
  const [savedScene, setSavedScene] = useState<string | null>(null)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  const [miniInset, setMiniInset] = useState(0)

  // ── Begin: the runner over the sealed scenario. ─────────────────────────
  useEffect(() => {
    if (runnerRef.current) return
    const resolver =
      props.resolver ??
      createAnchorResolver({
        root: () => (typeof document !== 'undefined' ? (document as unknown as import('../anchors.ts').RootLike) : null),
        contractEnv: props.contractEnv ?? (() => liveContractEnv()),
        storeProbes: props.storeProbes,
      })
    const runner = createPresentationRunner(script, {
      resolver,
      scenario,
      scenarioPort: props.scenarioPort,
      storage: props.storage,
      appVersion: props.appVersion,
      shellVersion: props.shellVersion,
      initialMode: props.initialMode,
      initialLanguage: lang,
    })
    runnerRef.current = runner
    const unsubscribe = runner.subscribe(() => setSnapshot(runner.getSnapshot()))
    runner.start()
    return () => {
      unsubscribe()
      // Unmount is an exit like any other: the scenario dies with the
      // player; the user's real data was never touched (sandbox contract).
      if (runnerRef.current) runnerRef.current.abort()
      runnerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const update = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight })
      // The mini player's inset (.has-mini room) is measured, not assumed.
      const mini = document.querySelector('.mini')
      setMiniInset(mini ? mini.getBoundingClientRect().height + 20 : 0)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [snapshot?.current?.step.id, snapshot?.status])

  const status = snapshot?.status ?? 'idle'
  const current = snapshot?.current ?? null
  const isQuestion = current?.step.act === 'ask'
  const active = status === 'playing' || status === 'paused' || status === 'interactive-wait'
  const speedOpen = snapshot?.speedChoiceOpen ?? false

  const chapters = useMemo(() => {
    let start = 0
    return script.scenes.map((scene) => {
      const entry = { scene, start, steps: scene.steps.length }
      start += scene.steps.length
      return entry
    })
  }, [script])
  const totalSteps = chapters.reduce((count, chapter) => count + chapter.steps, 0)

  // ── Focus tracking for the current step's element. ──────────────────────
  useEffect(() => {
    setRect(null)
    const element = elementOf(snapshot)
    if (!element) return
    element.scrollIntoView?.({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center', inline: 'center' })
    let frame = 0
    const measure = () => {
      const box = element.getBoundingClientRect!()
      const next = { top: box.top, left: box.left, width: box.width, height: box.height }
      setRect(next)
      setLastRect(next)
    }
    const settle = window.setTimeout(measure, reducedMotion() ? 30 : 380)
    const onMove = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.clearTimeout(settle)
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [current?.step.id, snapshot?.resolution, snapshot])

  // The ring breathes in the theme accent — unless reduced motion asks calm.
  useEffect(() => {
    if (!rect || !ringRef.current || reducedMotion()) return
    const animation = ringRef.current.animate(
      [
        { boxShadow: '0 0 0 2px var(--accent), 0 0 22px 2px var(--accent-glow)' },
        { boxShadow: '0 0 0 2px var(--accent), 0 0 34px 6px var(--accent-soft)' },
      ],
      { duration: 1600, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' },
    )
    return () => animation.cancel()
  }, [rect])

  // ── Interactive: the learner's real act on the stage advances. ─────────
  useEffect(() => {
    if (!snapshot || snapshot.status !== 'interactive-wait') return
    const element = elementOf(snapshot)
    if (!element?.addEventListener || !element.removeEventListener) return
    const onAct = () => runnerRef.current?.userAct()
    element.addEventListener('pointerdown', onAct, { capture: true })
    return () => element.removeEventListener!('pointerdown', onAct, { capture: true })
  }, [snapshot])

  const notifyExit = (reason: RunnerSnapshot['endReason'], stayHereAnchorId: string | null) => {
    if (exitNotifiedRef.current) return
    exitNotifiedRef.current = true
    onExit?.({ reason, stayHereAnchorId })
  }

  const handleCloseTap = () => {
    const runner = runnerRef.current
    if (!runner) return
    if (snapshot?.closeWindowOpen) {
      // A second tap on ✕ with its window open is the confirm (the same
      // pattern the stay-here window uses).
      confirmClose()
      return
    }
    // Mid-module, the ✕ ASKS FIRST (Oscar's law, Brizna lane 2026-11-14):
    // the tap opens the confirmation window — the runner holds the
    // clock, and nothing exits yet. (The ✕ exists only mid-module in
    // this card; the finished card's own exit needs no window.)
    runner.requestClose()
  }

  const confirmClose = () => {
    runnerRef.current?.abort()
    notifyExit('abort', null)
  }

  const handleStayHere = () => {
    const runner = runnerRef.current
    if (!runner) return
    if (snapshot?.stayWindowOpen) {
      // A second tap on «Stay here» with its window open is the confirm.
      confirmStayHere()
      return
    }
    // Mid-module, the tap FIRST opens the window (the stay-here law):
    // the runner holds the clock, and nothing dissolves yet.
    runner.requestStayHere()
  }

  const confirmStayHere = () => {
    const anchorId = current?.step.anchorId ?? null
    runnerRef.current?.stayHere()
    notifyExit('stay-here', anchorId)
  }

  const handlePlayPause = () => {
    const runner = runnerRef.current
    if (!runner || !snapshot) return
    if (snapshot.status === 'playing') runner.pause()
    else if (snapshot.status === 'paused') runner.resume()
    else if (snapshot.status === 'interactive-wait') runner.setMode('automatic')
  }

  const handleSpeedButton = () => {
    const runner = runnerRef.current
    if (!runner) return
    if (speedOpen) runner.endSpeedChoice()
    else runner.beginSpeedChoice() // the clock holds while the strip is open
  }

  const handleSpeedPick = (speed: number) => {
    const runner = runnerRef.current
    if (!runner) return
    runner.setSpeed(speed)
    runner.endSpeedChoice()
  }

  const handleChapterPick = (start: number) => {
    runnerRef.current?.goToStep(start)
    setChaptersOpen(false)
  }

  const handleSaveScene = () => {
    if (!current) return
    runnerRef.current?.saveCurrentScene()
    setSavedScene(current.scene.id)
  }

  // ── Placement: the card lives beside the focus (C′). ────────────────────
  const focus = rect ?? lastRect
  // The breathing hole, contained wholly inside the viewport on all four
  // sides (geometry.ts — the screen-edge law): the air compresses at the
  // edges, the ring is never cut by a device edge. The veil paints from
  // `focus` (kept during machinery beats via lastRect), the ring from
  // `rect`; both go through the one contained computation.
  const hole = focus ? containedHole(focus, viewport.w, viewport.h) : null
  const ringHole = rect ? containedHole(rect, viewport.w, viewport.h) : null
  const sceneIndex = current ? script.scenes.findIndex((scene) => scene.id === current.scene.id) : script.scenes.length - 1
  const sceneFraction = current ? (current.indexInScene + 1) / Math.max(1, current.scene.steps.length) : 1
  const threadPercent =
    script.scenes.length > 0 ? ((Math.max(0, sceneIndex) + sceneFraction) / script.scenes.length) * 100 : 0
  const stepNumber = current ? current.globalIndex + 1 : totalSteps
  const caption = current
    ? isQuestion
      ? (current.step.question ?? current.step.text)?.[lang]
      : (current.step.text ?? current.step.question)?.[lang]
    : null

  // THE CARD IS BORN WHERE IT WILL LIVE (Oscar's law, Brizna lane
  // 2026-11-14): the seat comes from geometry.ts's one computation, and
  // while no seat exists — the focus not yet measured, the viewport not
  // yet known — the card is NOT RENDERED AT ALL. Its first visible frame
  // is already home; it never appears at a provisional seat and travels.
  // Later seats glide on the card's one motion clock (--lp-dur/--lp-ease).
  const seat = cardSeat(focus, viewport.w, viewport.h, miniInset)
  const cardStyle: React.CSSProperties = {}
  if (seat) {
    cardStyle.left = seat.left
    if (seat.top !== undefined) cardStyle.top = seat.top
    if (seat.bottom !== undefined) cardStyle.bottom = seat.bottom
  } else {
    // No focus ever existed (a module that ended on a first-step miss):
    // the end card's home is this corner, and it is born there directly.
    cardStyle.right = VIEW_MARGIN
    cardStyle.bottom = miniInset + VIEW_MARGIN
  }

  const showCard = snapshot !== null && (status === 'done' || (active && seat !== null))
  const ScenarioView = props.ScenarioView

  return (
    <div className="lp-player">
      {/* The fiction stage, rendered from the sealed scenario only. */}
      {ScenarioView ? <ScenarioView scenario={scenario} /> : props.children}

      {/* Progress thread — 3px at the top edge, accent-filled per scene. */}
      <div className="lp-thread" aria-hidden>
        <div className="lp-thread-fill" style={{ width: `${threadPercent}%` }} />
      </div>

      {/* The veil (Oscar's corrected principle, 2026-11-14): the
          background DARKENS and slightly DESATURATES — it NEVER
          BLURS — everywhere except the focus hole, which stays
          pixel-sharp, so the app behind remains readable like a
          map. Four panels tile the viewport AROUND the contained
          hole — no panel ever covers the hole, so nothing stands
          between the learner's hand and the stage on a gesture
          beat (and every panel is pointer-events: none besides). */}
      {active && hole ? (
        <>
          <div aria-hidden className="lp-veil lp-veil-t" style={{ height: hole.top }} />
          <div aria-hidden className="lp-veil lp-veil-b" style={{ top: hole.top + hole.height }} />
          <div aria-hidden className="lp-veil lp-veil-l" style={{ top: hole.top, height: hole.height, width: hole.left }} />
          <div
            aria-hidden
            className="lp-veil lp-veil-r"
            style={{ top: hole.top, height: hole.height, left: hole.left + hole.width }}
          />
        </>
      ) : null}
      {/* The ring + glow in the theme accent, breathing over the hole. */}
      {active && ringHole ? (
        <div
          ref={ringRef}
          aria-hidden
          className="lp-ring"
          style={{
            top: ringHole.top,
            left: ringHole.left,
            width: ringHole.width,
            height: ringHole.height,
          }}
        />
      ) : null}

      {/* The C′ card, beside the focus. */}
      {showCard && snapshot ? (
        <div className="lp-card" style={cardStyle} role="dialog" aria-label={script.title[lang]}>
          {status === 'done' ? (
            <div className="lp-done">
              <p className="lp-text">
                {snapshot.endReason === 'required-anchor-miss'
                  ? snapshot.notice?.[lang]
                  : snapshot.endReason === 'stay-here'
                    ? label('stayHereDone')
                    : `${label('wholeLesson')} ${script.capability[lang]}`}
              </p>
              <p className="lp-module">
                {script.title[lang]} · {current?.scene.chapter[lang] ?? ''}
              </p>
              <div className="lp-bottom">
                <button
                  type="button"
                  className="lp-stay lp-done-btn"
                  onClick={() => notifyExit(snapshot.endReason, null)}
                >
                  <span>{label('backToLessons')}</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Header, one line: counter left, quiet cluster right. */}
              <div className="lp-head">
                <p className="lp-counter">
                  {stepNumber} / {totalSteps}
                </p>
                <div className="lp-cluster">
                  {snapshot.mode === 'interactive' ? (
                    <span className="lp-navpair">
                      <button
                        type="button"
                        className="lp-qbtn lp-qicon lp-navbtn"
                        onClick={() => runnerRef.current?.back()}
                        disabled={!snapshot.canBack}
                        aria-label={label('back')}
                      >
                        <ChevronLeft size={12} />
                      </button>
                      {snapshot.gestureBeat ? null : (
                        <button
                          type="button"
                          className="lp-qbtn lp-qicon lp-navbtn"
                          onClick={() => runnerRef.current?.next()}
                          aria-label={label('next')}
                        >
                          <ChevronRight size={12} />
                        </button>
                      )}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="lp-qbtn"
                    onClick={() => runnerRef.current?.setMode(snapshot.mode === 'automatic' ? 'interactive' : 'automatic')}
                  >
                    {snapshot.mode === 'automatic' ? <Play size={12} /> : <Hand size={12} />}
                    <span>{snapshot.mode === 'automatic' ? label('automatic') : label('interactive')}</span>
                  </button>
                  <button
                    type="button"
                    className="lp-qbtn"
                    onClick={handleSpeedButton}
                    aria-expanded={speedOpen}
                    aria-label={label('speed')}
                  >
                    <Gauge size={12} />
                    <span>{fmtSpeed(snapshot.speed)}</span>
                  </button>
                  <button
                    type="button"
                    className="lp-qbtn lp-qicon"
                    onClick={() => setChaptersOpen((open) => !open)}
                    aria-label={label('chapters')}
                    aria-expanded={chaptersOpen}
                  >
                    <List size={12} />
                  </button>
                  {snapshot.mode === 'automatic' ? (
                    <button
                      type="button"
                      className="lp-qbtn lp-qicon"
                      onClick={handlePlayPause}
                      aria-label={snapshot.status === 'playing' && !speedOpen ? label('pause') : label('play')}
                    >
                      {snapshot.status === 'playing' && !speedOpen ? <Pause size={12} /> : <Play size={12} />}
                    </button>
                  ) : null}
                  <button type="button" className="lp-qbtn lp-qicon" onClick={handleCloseTap} aria-label={label('exit')}>
                    <X size={12} />
                  </button>
                </div>
              </div>

              {/* The integrated speed strip: all five, current filled, clock held. */}
              {speedOpen ? (
                <div className="lp-speedstrip" role="group" aria-label={label('speed')}>
                  {PRESENTATION_SPEEDS.map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => handleSpeedPick(speed)}
                      className={speed === snapshot.speed ? 'lp-speed on' : 'lp-speed'}
                    >
                      {fmtSpeed(speed)}
                    </button>
                  ))}
                </div>
              ) : null}

              {/* Chapters, unfolded inside the card (+ «My scenes» saving). */}
              {chaptersOpen ? (
                <div className="lp-chapters" role="group" aria-label={label('chapters')}>
                  {chapters.map((chapter) => (
                    <button
                      key={chapter.scene.id}
                      type="button"
                      onClick={() => handleChapterPick(chapter.start)}
                      className={current?.scene.id === chapter.scene.id ? 'lp-chapter cur' : 'lp-chapter'}
                    >
                      <span>{chapter.scene.chapter[lang]}</span>
                      <span className="lp-chapter-n">
                        {chapter.steps} {label('steps')}
                      </span>
                    </button>
                  ))}
                  <button type="button" className="lp-chapter lp-save" onClick={handleSaveScene}>
                    {savedScene === current?.scene.id ? <BookmarkCheck size={13} /> : <BookmarkPlus size={13} />}
                    <span>{savedScene === current?.scene.id ? label('savedScene') : label('saveScene')}</span>
                  </button>
                </div>
              ) : null}

              {/* The stay-here window (Oscar's law, Brizna lane 2026-11-14):
                  «Stay here» mid-module FIRST opens this small window on
                  the card — it says the learner can continue later exactly
                  where they left off, and where the card lives (Settings
                  → Presentations). The clock stands still behind it. Only
                  the confirm dissolves the stage; «Keep watching» closes
                  the window and the lesson continues untouched. A finished
                  module never grows this window. */}
              {snapshot.stayWindowOpen ? (
                <div className="lp-staywin" role="alertdialog" aria-label={label('stayTitle')}>
                  <p className="lp-staywin-t">{label('stayTitle')}</p>
                  <p className="lp-staywin-b">{label('stayResume')}</p>
                  <p className="lp-staywin-b">{label('stayFind')}</p>
                  <div className="lp-staywin-row">
                    <button type="button" className="lp-done-btn" onClick={confirmStayHere}>
                      <span>{label('stayHere')}</span>
                    </button>
                    <button
                      type="button"
                      className="lp-qbtn"
                      onClick={() => runnerRef.current?.cancelStayHere()}
                    >
                      <span>{label('keepWatching')}</span>
                    </button>
                  </div>
                </div>
              ) : null}

              {/* The ✕ confirmation window (Oscar's law, Brizna lane
                  2026-11-14): mid-module, the ✕ ASKS FIRST — this small
                  window opens on the card before anything exits. The
                  question is the big headline; the body stays brief (the
                  window law): your place is saved, and you can continue
                  later exactly where you are. The clock stands still
                  behind it. Only «Leave» ends the module — with the
                  place already recorded — and «Keep watching» closes
                  the window with the lesson untouched. A finished
                  module never grows this window: its exit is direct. */}
              {snapshot.closeWindowOpen ? (
                <div className="lp-closewin" role="alertdialog" aria-label={label('closeTitle')}>
                  <p className="lp-closewin-t">{label('closeTitle')}</p>
                  <p className="lp-closewin-b">{label('closeBody')}</p>
                  <div className="lp-closewin-row">
                    <button type="button" className="lp-done-btn" onClick={confirmClose}>
                      <span>{label('leaveLesson')}</span>
                    </button>
                    <button type="button" className="lp-qbtn" onClick={() => runnerRef.current?.cancelClose()}>
                      <span>{label('keepWatching')}</span>
                    </button>
                  </div>
                </div>
              ) : null}

              {/* The explanation — the protagonist. */}
              {caption ? (
                <p className={isQuestion ? 'lp-text lp-question' : 'lp-text'}>
                  {isQuestion ? <span className="lp-qmark">?</span> : null}
                  {caption}
                </p>
              ) : null}

              {/* The lower area (Oscar's order, 2026-11-14, from his own
                  crops): «Module · Chapter» owns its own line(s) at the
                  FULL card width — no button beside it, nothing cutting
                  across the text. BELOW it, one actions row carries
                  «Stay here» and, in Interactive, «Show me» at the row's
                  right end, at Stay here's level; in Automatic the row
                  carries «Stay here» alone. (The nav pair's seat is the
                  header now, at Oscar's earlier order.) */}
              <p className="lp-module">
                {script.title[lang]} · {current?.scene.chapter[lang]}
              </p>
              <div className="lp-bottom">
                <button type="button" className="lp-qbtn lp-stay" onClick={handleStayHere}>
                  <MapPin size={13} />
                  <span>{label('stayHere')}</span>
                </button>
                {snapshot.mode === 'interactive' ? (
                  <button type="button" className="lp-qbtn lp-showme" onClick={() => runnerRef.current?.showMe()}>
                    <MousePointerClick size={13} />
                    <span>{label('showMe')}</span>
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
