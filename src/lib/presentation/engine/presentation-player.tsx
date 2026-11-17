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
 * Brizna lane 2026-11-14): a window that tells the learner they can
 * continue this module later exactly where they left it, and where
 * the card lives — Settings → Presentations. While it is open the
 * runner holds the clock (the lesson never advances behind it) and
 * stands every transport verb down; only the window's confirm
 * dissolves the stage into the real place, and «Keep watching» closes
 * it with the lesson untouched. A finished module's exit (the end
 * card) needs no window and never grows one.
 * THE ✕ ASKS FIRST, TOO (Oscar's law, same lane): mid-module the ✕
 * opens its own confirmation window before exiting — same family, same
 * clock hold, same «Keep watching»; only its «Leave» confirm ends the
 * module, onto the place the runner already recorded. NEITHER window
 * sits on the card: BOTH are CENTRED MODALS over it (P5 for the ✕;
 * Oscar's ruling 2026-11-15 — every pop-up / confirmation window
 * centres — for «Stay here»), direct siblings under .lp-player. In
 * BOTH windows the QUESTION is the big headline and the body stays
 * brief.
 * BEFORE THE LESSON, THE OPENING WINDOW (P1): a run begins in the
 * runner's prepare phase — the clock held, nothing persisted — behind
 * a centred opening window that names the controls and their jobs.
 * Only «Empezar» / "Start" (confirmStart) births the card; «Ahora no»
 * / "Not now" leaves cleanly (abortClean) with the record untouched.
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
 * The focus is a breathing hole (~10px air) in a .45 veil, ring + glow in
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
 * through the anchor registry. The player's only resolutions of its own
 * (P11) are RENDER-ONLY — a step's effect/subject anchors, through the
 * same mount resolver, purely to frame and seat; a miss there degrades
 * silently to the act anchor and never decides anything.
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
import type { ResumePoint } from '../catalogue.ts'
import type { Scenario } from '../scenario/index.ts'
import type { PresentationStorage } from '../presentation-state.ts'
import { PRESENTATION_SPEEDS, captionDurationMs, physicalSpeed } from './clock.ts'
import { VIEW_MARGIN, cardSeat, containedHole, unionRect } from './geometry.ts'
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
  /**
   * The launch point the host was asked for (canon's H-26 cure,
   * threaded through the opening window): «My scenes» and search
   * «Watch» name a place outside the module's own progress record,
   * and the runner enters there — behind the window, so «Empezar»
   * confirms AT the tapped scene. Absent = the runner's ordinary
   * resume from the record.
   */
  resumeFrom?: ResumePoint
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
  beforeStart: { en: 'Before you start', es: 'Antes de empezar' },
  startLesson: { en: 'Start', es: 'Empezar' },
  notNow: { en: 'Not now', es: 'Ahora no' },
  preparing: { en: 'Preparing the first step…', es: 'Preparando el primer paso…' },
  openingModes: {
    en: 'Watch it (Automatic): Logos performs each step and taps for you. Do it by hand (Interactive): the lesson waits — it only advances when you tap.',
    es: 'Mírala (Automático): Logos hace cada paso y toca por ti. Hazla a mano (Interactivo): la lección espera — solo avanza cuando tú tocas.',
  },
  notLearned: { en: 'This lesson does not count as learned.', es: 'Esta lección no cuenta como aprendida.' },
  helpInSettings: {
    en: 'Help lives in Settings: every control explains itself there.',
    es: 'La ayuda vive en Ajustes: cada control se explica allí.',
  },
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

/** The element a resolution points at, or null when it is not an element
 *  (contract / store / manifest targets carry no rect — P6/P11). */
function elementFromResolution(resolution: { status: string; target?: unknown } | null): AnchorElementLike | null {
  if (!resolution || resolution.status !== 'resolved') return null
  const target = resolution.target as AnchorElementLike | null
  if (!target || typeof target.getBoundingClientRect !== 'function') return null
  return target
}

function rectsEqual(a: TargetRect | null, b: TargetRect | null): boolean {
  if (a === null || b === null) return a === b
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height
}

/**
 * The gesture surface (P12): AnchorElementLike's listener signature is
 * event-less, so the gesture listener works through this structural
 * view — real DOM elements satisfy it exactly.
 */
interface GestureTarget {
  addEventListener?: (type: string, listener: (event: Event) => void, options?: { capture?: boolean }) => void
  removeEventListener?: (type: string, listener: (event: Event) => void, options?: { capture?: boolean }) => void
}

export function PresentationPlayer(props: PresentationPlayerProps) {
  const { script, scenario, onExit } = props
  const lang: PresentationLanguage =
    props.lang ?? (typeof document !== 'undefined' && document.documentElement.lang === 'es' ? 'es' : 'en')
  const label = (key: LabelKey): string => LABELS[key][lang]

  const runnerRef = useRef<PresentationRunner | null>(null)
  const exitNotifiedRef = useRef(false)
  const ringRef = useRef<HTMLDivElement | null>(null)
  /** The ONE resolver this player constructs at mount (P11): the runner
   *  resolves through it, and the player's own render-only resolutions
   *  of effect/subject anchors reuse it — never a second system. */
  const resolverRef = useRef<AnchorResolver | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  /** The card's last measured height (P11 seat input); undefined until
   *  the card has been measured once — the very first beat seats
   *  without it, exactly as geometry's contract allows. */
  const cardHeightRef = useRef<number | undefined>(undefined)
  /** When the read-gate (P12) for the beat on stage started (wall ms). */
  const gateStartRef = useRef<{ key: string; at: number }>({ key: '', at: 0 })

  const [snapshot, setSnapshot] = useState<RunnerSnapshot | null>(null)
  const [rect, setRect] = useState<TargetRect | null>(null)
  const [lastRect, setLastRect] = useState<TargetRect | null>(null)
  /** The current beat's EFFECT region rect (P11) — render-only. */
  const [effectRect, setEffectRect] = useState<TargetRect | null>(null)
  /** The current beat's SUBJECT region rect (P11) — render-only. */
  const [subjectRect, setSubjectRect] = useState<TargetRect | null>(null)
  const [chaptersOpen, setChaptersOpen] = useState(false)
  const [savedScene, setSavedScene] = useState<string | null>(null)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  const [miniInset, setMiniInset] = useState(0)
  /** CAPTIONED-BIRTH LATCH (P3): true once this run's first captioned,
   *  seated beat has arrived. Before it, presented steps advance
   *  stage-only — card, veil, ring and thread paint nothing. */
  const [born, setBorn] = useState(false)
  /** READ-GATE (P12): true once the beat on stage has been readable for
   *  its caption's reading time — only then do the gesture listener and
   *  «Muéstrame» go live. */
  const [gateOpen, setGateOpen] = useState(false)
  /** Reduced motion, LIVE (P18): the ring breath subscribes to changes —
   *  turning calm on mid-lesson cancels the breath, off re-applies it. */
  const [motionCalm, setMotionCalm] = useState<boolean>(() => reducedMotion())

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
    resolverRef.current = resolver
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
    // P1: the run begins in the PREPARE phase — seeded and entered, the
    // clock held, nothing persisted — behind the opening window. The
    // lesson itself starts only at the window's «Empezar» (confirmStart).
    // The host's launch point (H-26) rides along: prepare enters AT it.
    runner.prepare({ resumeFrom: props.resumeFrom })
    return () => {
      unsubscribe()
      // Unmount is an exit like any other: the scenario dies with the
      // player; the user's real data was never touched (sandbox contract).
      // Still in the prepare phase, the exit is the CLEAN abort — it
      // writes nothing, exactly like «Ahora no».
      if (runnerRef.current) {
        if (runnerRef.current.getSnapshot().opening) runnerRef.current.abortClean()
        else runnerRef.current.abort()
      }
      runnerRef.current = null
      resolverRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Backgrounding (P14): hidden pauses the runner's clock honestly;
  // visible revives it only if it was playing when it hid. ─────────────
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) runnerRef.current?.handleHidden()
      else runnerRef.current?.handleVisible()
    }
    const onPageHide = () => runnerRef.current?.handleHidden()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [])

  // ── Reduced motion, live (P18): subscribe to the media query's changes
  // so the ring breath (below) stands down / re-applies mid-lesson. ────
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setMotionCalm(query.matches)
    onChange()
    query.addEventListener?.('change', onChange)
    return () => query.removeEventListener?.('change', onChange)
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

  // ── Focus tracking for the current step's elements (P10 + P11). ─────
  // The act element is measured alongside the step's EFFECT and SUBJECT
  // elements (resolved render-only through the mount resolver — a miss
  // there degrades silently to the act anchor, never a required miss).
  // Tracking: measure immediately on entry, then a rAF loop every frame
  // until the rect is stable for 3 consecutive frames or 900 ms elapse;
  // then a ResizeObserver on the measured elements plus the scroll /
  // resize listeners guard the beat's life. Reduced motion skips the
  // loop (one measure after the short 30 ms settle, as before) but
  // still attaches the observers. If the act element detaches mid-loop,
  // ONE re-resolution of the step's anchors is attempted; failing that,
  // the beat falls into the honest no-target state (P6). This effect
  // runs during the opening phase too (P1): the seat must be real
  // before «Empezar» can birth the card.
  useEffect(() => {
    setRect(null)
    setEffectRect(null)
    setSubjectRect(null)
    if (!snapshot || !current) return
    const step = current.step
    const actElement = elementOf(snapshot)
    if (snapshot.resolution?.status === 'resolved' && !actElement) {
      // P6 — RESOLVED BUT NOT AN ELEMENT (a contract / store / manifest
      // target): there is no rect to frame. Clear BOTH rects — element
      // beats keep lastRect continuity, this case must not inherit a
      // stale frame — and the render falls into the no-target state.
      setLastRect(null)
      return
    }
    if (!actElement) return

    const resolver = resolverRef.current
    const extraElement = (anchorId: string | undefined): AnchorElementLike | null => {
      if (!anchorId || !resolver) return null
      return elementFromResolution(resolver.resolveById(anchorId, step.payload?.param))
    }
    let actEl: AnchorElementLike = actElement
    let effectEl = extraElement(step.effectAnchorId)
    let subjectEl = extraElement(step.subjectAnchorId)

    actEl.scrollIntoView?.({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center', inline: 'center' })

    let disposed = false
    let loopFrame = 0
    let moveFrame = 0
    let settle = 0
    let observer: ResizeObserver | null = null
    let listenersOn = false
    let rebindTried = false

    const readRect = (el: AnchorElementLike): TargetRect => {
      const box = el.getBoundingClientRect!()
      return { top: box.top, left: box.left, width: box.width, height: box.height }
    }
    const isGone = (el: AnchorElementLike, box: TargetRect): boolean =>
      (el as { isConnected?: boolean }).isConnected === false ||
      (box.width === 0 && box.height === 0 && box.top === 0 && box.left === 0)

    /** Measure all three elements; returns the act rect, or null when the act element is gone. */
    const measure = (): TargetRect | null => {
      const next = readRect(actEl)
      if (isGone(actEl, next)) return null
      setRect(next)
      setLastRect(next)
      if (effectEl) {
        const box = readRect(effectEl)
        if (isGone(effectEl, box)) setEffectRect(null)
        else setEffectRect(box)
      }
      if (subjectEl) {
        const box = readRect(subjectEl)
        if (isGone(subjectEl, box)) setSubjectRect(null)
        else setSubjectRect(box)
      }
      return next
    }

    /** ONE re-resolution of the step's anchors (P10); true when a live act element was rebound. */
    const tryRebind = (): boolean => {
      if (rebindTried || !resolver) return false
      rebindTried = true
      const rebound = elementFromResolution(resolver.resolveById(step.anchorId, step.payload?.param))
      if (!rebound) return false
      if (isGone(rebound, readRect(rebound))) return false
      actEl = rebound
      effectEl = extraElement(step.effectAnchorId)
      subjectEl = extraElement(step.subjectAnchorId)
      return true
    }

    const fallToNoTarget = () => {
      setRect(null)
      setLastRect(null)
      setEffectRect(null)
      setSubjectRect(null)
    }

    const onMove = () => {
      cancelAnimationFrame(moveFrame)
      moveFrame = requestAnimationFrame(() => {
        if (!disposed) measure()
      })
    }
    const attachObservers = () => {
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => {
          if (!disposed) measure()
        })
        for (const el of [actEl, effectEl, subjectEl]) {
          if (el) observer.observe(el as unknown as Element)
        }
      }
      window.addEventListener('scroll', onMove, true)
      window.addEventListener('resize', onMove)
      listenersOn = true
    }

    if (reducedMotion()) {
      // Calm path: no rAF loop — a single measure after the short settle,
      // then the observers still guard the beat's life.
      settle = window.setTimeout(() => {
        if (disposed) return
        if (!measure() && !(tryRebind() && measure())) {
          fallToNoTarget()
          return
        }
        attachObservers()
      }, 30)
    } else {
      // Measure immediately on entry, then track every frame.
      let first = measure()
      if (!first && tryRebind()) first = measure()
      if (!first) {
        fallToNoTarget()
      } else {
        let last: TargetRect | null = first
        let stableFrames = 0
        const startedAt = performance.now()
        const tick = () => {
          if (disposed) return
          const next = measure()
          if (!next) {
            if (tryRebind() && measure()) {
              last = null
              stableFrames = 0
              loopFrame = requestAnimationFrame(tick)
              return
            }
            fallToNoTarget()
            return
          }
          if (rectsEqual(last, next)) stableFrames += 1
          else stableFrames = 0
          last = next
          if (stableFrames >= 3 || performance.now() - startedAt >= 900) {
            attachObservers()
            return
          }
          loopFrame = requestAnimationFrame(tick)
        }
        loopFrame = requestAnimationFrame(tick)
      }
    }

    return () => {
      disposed = true
      cancelAnimationFrame(loopFrame)
      cancelAnimationFrame(moveFrame)
      window.clearTimeout(settle)
      observer?.disconnect()
      if (listenersOn) {
        window.removeEventListener('scroll', onMove, true)
        window.removeEventListener('resize', onMove)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.scene.id, current?.step.id, current?.globalIndex, snapshot?.resolution])

  // The card's height, kept measured for the footprint seat (P11): a
  // ResizeObserver on the card element keeps cardHeightRef at the last
  // measured height across beats (undefined only before the first card).
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const initial = el.getBoundingClientRect().height
    if (initial > 0) cardHeightRef.current = initial
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const height = el.getBoundingClientRect().height
      if (height > 0) cardHeightRef.current = height
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [snapshot?.status, born])

  // The ring breathes in the theme accent — unless reduced motion asks
  // calm. P18: `motionCalm` is LIVE — when it turns on mid-lesson this
  // effect's cleanup cancels the running WAAPI breath; when it turns
  // off, the effect re-runs and the breath re-applies under the same
  // rules. No other motion behaviour subscribes.
  useEffect(() => {
    if (!rect || !ringRef.current || motionCalm) return
    const animation = ringRef.current.animate(
      [
        { boxShadow: '0 0 0 2px var(--accent), 0 0 22px 2px var(--accent-glow)' },
        { boxShadow: '0 0 0 2px var(--accent), 0 0 34px 6px var(--accent-soft)' },
      ],
      { duration: 1600, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' },
    )
    return () => animation.cancel()
  }, [rect, motionCalm, born])

  // ── READ-GATE (P12): the gesture listener and «Muéstrame» stay inert
  // until the beat's reading time elapses — the caption's life
  // (captionDurationMs, presentation ms) converted to wall time through
  // the physical rate behind the current speed LABEL. The gate is
  // timed from the beat's entry into interactive-wait; the start stamp
  // survives snapshot churn and live speed changes (the remainder is
  // simply recomputed at the new rate). ───────────────────────────────
  useEffect(() => {
    if (!snapshot || snapshot.status !== 'interactive-wait' || !current) {
      setGateOpen(false)
      return
    }
    const key = `${current.scene.id}:${current.step.id}:${current.globalIndex}`
    const nowMs = Date.now()
    if (gateStartRef.current.key !== key) gateStartRef.current = { key, at: nowMs }
    const captionText = isQuestion
      ? (current.step.question ?? current.step.text)
      : (current.step.text ?? current.step.question)
    const gateWallMs = captionDurationMs(captionText ?? '', lang) / physicalSpeed(snapshot.speed)
    const remaining = Math.max(0, gateWallMs - (nowMs - gateStartRef.current.at))
    if (remaining <= 0) {
      setGateOpen(true)
      return
    }
    setGateOpen(false)
    const timer = window.setTimeout(() => setGateOpen(true), remaining)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, lang])

  // ── Interactive: the learner's real act on the stage advances (P12). ──
  // The listener hears the gesture the step DECLARES — tap → 'click',
  // type → 'input' (with payload.value set, the field must come to
  // contain it), key → 'keydown' (matching payload.key when given),
  // scroll → 'scroll' (capture) on the element; hover / goto keep
  // 'pointerdown' as the documented fallback, there being no single
  // honest DOM event for either. Narration beats (say / ask) declare no
  // gesture: no listener — › is their way through. The listener is not
  // attached at all before the read-gate opens, and `userAct()` is
  // called ONLY on a matching observed gesture.
  useEffect(() => {
    if (!snapshot || snapshot.status !== 'interactive-wait' || !current) return
    if (!gateOpen) return // the read-gate: inert until the reading time elapses
    const element = elementOf(snapshot)
    if (!element) return
    const target = element as unknown as GestureTarget
    if (!target.addEventListener || !target.removeEventListener) return
    const step = current.step
    let type: string | null = null
    let capture = false
    switch (step.act) {
      case 'tap':
        type = 'click'
        break
      case 'type':
        type = 'input'
        break
      case 'key':
        type = 'keydown'
        break
      case 'scroll':
        type = 'scroll'
        capture = true
        break
      case 'hover':
      case 'goto':
        type = 'pointerdown' // the documented fallback for hover / goto
        break
      default:
        type = null // say / ask: no gesture to hear
    }
    if (!type) return
    const onGesture = (event: Event) => {
      if (step.act === 'type') {
        const wanted = step.payload?.value
        if (wanted) {
          const field = event.target as { value?: unknown; textContent?: unknown } | null
          const text =
            typeof field?.value === 'string' ? field.value : typeof field?.textContent === 'string' ? field.textContent : ''
          if (!text.includes(wanted)) return
        }
      } else if (step.act === 'key') {
        const wantedKey = step.payload?.key
        if (wantedKey && (event as KeyboardEvent).key !== wantedKey) return
      }
      runnerRef.current?.userAct()
    }
    target.addEventListener(type, onGesture, { capture })
    return () => target.removeEventListener!(type, onGesture, { capture })
  }, [snapshot, gateOpen])

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

  /** P1 — the opening window's «Empezar»: the lesson starts for real. */
  const handleConfirmStart = () => {
    runnerRef.current?.confirmStart()
  }

  /** P1 — the opening window's «Ahora no»: the clean abort (nothing was
   *  ever written), then the same exit the ✕ confirm already wires. */
  const handleNotNow = () => {
    runnerRef.current?.abortClean()
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
  // The FOOTPRINT (P11): the union of the rects this beat touches — the
  // act rect (with lastRect continuity, as the veil has always used),
  // plus the EFFECT and SUBJECT rects when they were measured. The
  // breathing hole frames the footprint, contained wholly inside the
  // viewport on all four sides (geometry.ts — the screen-edge law);
  // the RING stays on the act rect only, as it always has. When the
  // footprint would swallow the lesson (>70% of the viewport), the
  // hole falls back to the act rect and the effect region is pointed
  // at with the subject box instead.
  const footprintRects: TargetRect[] = []
  if (focus) footprintRects.push(focus)
  if (effectRect) footprintRects.push(effectRect)
  if (subjectRect) footprintRects.push(subjectRect)
  const footprint = unionRect(footprintRects)
  const footprintTooBig =
    footprint !== null &&
    viewport.w > 0 &&
    viewport.h > 0 &&
    footprint.width * footprint.height > 0.7 * viewport.w * viewport.h
  const hole = !footprint
    ? null
    : footprintTooBig
      ? focus
        ? containedHole(focus, viewport.w, viewport.h)
        : null
      : containedHole(footprint, viewport.w, viewport.h)
  const ringHole = rect ? containedHole(rect, viewport.w, viewport.h) : null
  // The SUBJECT box (P11): the caption's subject region, when it is a
  // different anchor than the acted-on one and it measured. In the
  // too-big-footprint case the EFFECT region takes the same treatment.
  const subjectHole =
    subjectRect && current?.step.subjectAnchorId && current.step.subjectAnchorId !== current.step.anchorId
      ? containedHole(subjectRect, viewport.w, viewport.h)
      : null
  const effectSubjectHole =
    footprintTooBig && effectRect && current?.step.effectAnchorId && current.step.effectAnchorId !== current.step.anchorId
      ? containedHole(effectRect, viewport.w, viewport.h)
      : null
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
  // The seat (P11): computed against the FOOTPRINT when the beat carries
  // an effect/subject region beyond the act rect — the card never sits
  // on the place the lesson is about to change — with the card's last
  // measured height as the fit input. A plain act-only beat passes no
  // footprint, and geometry keeps its legacy focus-half seat.
  const seat = cardSeat(
    focus,
    viewport.w,
    viewport.h,
    miniInset,
    effectRect || subjectRect ? footprint : undefined,
    cardHeightRef.current,
  )
  const cardStyle: React.CSSProperties = {}
  if (seat) {
    cardStyle.left = seat.left
    if (seat.top !== undefined) cardStyle.top = seat.top
    if (seat.bottom !== undefined) cardStyle.bottom = seat.bottom
  } else {
    // No focus ever existed (a module that ended on a first-step miss —
    // or the P6 no-target state, whose card takes this same corner):
    // the card's home is this corner, and it is born there directly.
    cardStyle.right = VIEW_MARGIN
    cardStyle.bottom = miniInset + VIEW_MARGIN
  }

  // CAPTIONED-BIRTH LATCH (P3): the latch fires the first time a beat is
  // BOTH captioned (its text or question is on the card) AND seated, and
  // stays fired for the rest of the run. It resets when the module
  // changes (a new run must earn its own birth).
  useEffect(() => {
    setBorn(false)
  }, [script.id])
  useEffect(() => {
    if (!born && caption && seat !== null) setBorn(true)
  }, [born, caption, seat])

  /** Chrome paints only after the birth latch — except the done card,
   *  which keeps its standing exception and paints as it always has. */
  const paintChrome = born || status === 'done'
  /** P6 no-target: active, post-birth, and no focus exists at all. */
  const noTarget = active && born && focus === null
  const showCard =
    snapshot !== null && (status === 'done' || (active && born && (seat !== null || focus === null)))
  const ScenarioView = props.ScenarioView

  // ── P1 — the opening window's readiness: the first beat is resolved,
  // captioned, and its seat is real (the focus effect kept measuring
  // through the whole prepare phase, so this can become true behind
  // the window). A first beat that resolves to a NON-ELEMENT target
  // (contract / store) never produces a seat — elementOf() is null on
  // a resolved resolution, exactly as the focus effect detects it —
  // and for such a beat the corner seat of the P6 no-target state IS
  // its seat, so readiness must not wait for a seat that cannot exist.
  // A blocked prepare (a required entry miss) replaces the hint with
  // the notice and offers only «Ahora no». ──────────────────────────
  const firstBeatNonElement =
    snapshot?.resolution?.status === 'resolved' && elementOf(snapshot) === null
  const openingReady =
    current !== null &&
    snapshot?.resolution?.status === 'resolved' &&
    !!caption &&
    (seat !== null || firstBeatNonElement)
  const openingRows: { key: string; icon: React.ReactNode; name: string; job: string }[] = [
    {
      key: 'counter',
      icon: null,
      name: 'n / total',
      job: lang === 'es' ? 'dónde vas en la lección' : 'where you are in the lesson',
    },
    {
      key: 'back',
      icon: <ChevronLeft size={13} />,
      name: lang === 'es' ? 'Atrás' : 'Back',
      job: lang === 'es' ? 'vuelve un paso (solo en Interactivo)' : 'returns one step (Interactive only)',
    },
    {
      key: 'next',
      icon: <ChevronRight size={13} />,
      name: lang === 'es' ? 'Siguiente' : 'Next',
      job: lang === 'es' ? 'avanza un paso (solo en Interactivo)' : 'advances one step (Interactive only)',
    },
    {
      key: 'mode',
      icon: <Hand size={13} />,
      name: lang === 'es' ? 'Automático · Interactivo' : 'Automatic · Interactive',
      job: lang === 'es' ? 'mírala o hazla a mano' : 'watch it, or do it by hand',
    },
    {
      key: 'speed',
      icon: <Gauge size={13} />,
      name: lang === 'es' ? 'Velocidad' : 'Speed',
      job: lang === 'es' ? 'qué tan rápido va la lección' : 'how fast the lesson plays',
    },
    {
      key: 'chapters',
      icon: <List size={13} />,
      name: lang === 'es' ? 'Capítulos' : 'Chapters',
      job: lang === 'es' ? 'las partes de la lección; guarda una escena' : "the lesson's parts; save a scene",
    },
    {
      key: 'pause',
      icon: <Pause size={13} />,
      name: lang === 'es' ? 'Pausa' : 'Pause',
      job: lang === 'es' ? 'detiene la lección (solo en Automático)' : 'stops the lesson (Automatic only)',
    },
    {
      key: 'exit',
      icon: <X size={13} />,
      name: lang === 'es' ? 'Salir' : 'Exit',
      job: lang === 'es' ? 'abandona la lección; pregunta antes' : 'leaves the lesson; it asks first',
    },
    {
      key: 'stay',
      icon: <MapPin size={13} />,
      name: label('stayHere'),
      job: lang === 'es' ? 'sales y te quedas en este lugar' : 'leave and stay in this place',
    },
    {
      key: 'showme',
      icon: <MousePointerClick size={13} />,
      name: label('showMe'),
      job: lang === 'es' ? 'la lección hace el paso por ti' : 'the lesson performs the step for you',
    },
  ]

  // ── P17 — the done-card declaration: a finished run that missed
  // (a required anchor) or skipped (any scene, walked or seeded) does
  // NOT count as learned, and the card says so plainly, naming the
  // scenes that could not be shown. A clean done card is untouched. ──
  const endInfo = snapshot?.endInfo
  const skipCount = endInfo?.skipCount ?? 0
  const showDeclaration =
    status === 'done' && (snapshot?.endReason === 'required-anchor-miss' || skipCount > 0)
  const skipLine =
    skipCount > 0
      ? lang === 'es'
        ? skipCount === 1
          ? `1 escena no pudo mostrarse: ${endInfo?.skipChapters.join(', ')}.`
          : `${skipCount} escenas no pudieron mostrarse: ${endInfo?.skipChapters.join(', ')}.`
        : skipCount === 1
          ? `1 scene could not be shown: ${endInfo?.skipChapters.join(', ')}.`
          : `${skipCount} scenes could not be shown: ${endInfo?.skipChapters.join(', ')}.`
      : null

  // P1: while the opening phase stands, the opening window is ALL that
  // paints — card, veil, ring and thread are suppressed (birth happens
  // at confirm). The stage still renders: its anchors are what the
  // focus effect measures toward readiness.
  if (snapshot?.opening) {
    return (
      <div className="lp-player">
        {/* The fiction stage, rendered from the sealed scenario only. */}
        {ScenarioView ? <ScenarioView scenario={scenario} /> : props.children}

        <div className="lp-openwin" role="dialog" aria-label={label('beforeStart')}>
          <p className="lp-openwin-t">
            {label('beforeStart')}
            <span
              style={{ display: 'block', marginTop: 2, fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}
            >
              {script.title[lang]}
            </span>
          </p>
          <p className="lp-openwin-modes">{label('openingModes')}</p>
          <div className="lp-openwin-list">
            {openingRows.map((row) => (
              <div className="lp-openwin-row" key={row.key}>
                {row.icon}
                <span className="lp-openwin-name">{row.name}</span>
                <span>{row.job}</span>
              </div>
            ))}
          </div>
          {snapshot.blockedNotice ? (
            <p className="lp-openwin-hint">{snapshot.blockedNotice}</p>
          ) : !openingReady ? (
            <p className="lp-openwin-hint">{label('preparing')}</p>
          ) : null}
          <div className="lp-openwin-actions">
            {snapshot.blockedNotice ? null : (
              <button type="button" className="lp-done-btn" onClick={handleConfirmStart} disabled={!openingReady}>
                <span>{label('startLesson')}</span>
              </button>
            )}
            <button type="button" className="lp-qbtn" onClick={handleNotNow}>
              <span>{label('notNow')}</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="lp-player">
      {/* The fiction stage, rendered from the sealed scenario only. */}
      {ScenarioView ? <ScenarioView scenario={scenario} /> : props.children}

      {/* Progress thread — 3px at the top edge, accent-filled per scene.
          P3: it paints only after the captioned-birth latch has fired. */}
      {paintChrome ? (
        <div className="lp-thread" aria-hidden>
          <div className="lp-thread-fill" style={{ width: `${threadPercent}%` }} />
        </div>
      ) : null}

      {/* The veil (Oscar's corrected principle, 2026-11-14): the
          background DARKENS and slightly DESATURATES — it NEVER
          BLURS — everywhere except the focus hole, which stays
          pixel-sharp, so the app behind remains readable like a
          map. Four panels tile the viewport AROUND the contained
          hole — no panel ever covers the hole, so nothing stands
          between the learner's hand and the stage on a gesture
          beat (and every panel is pointer-events: none besides). */}
      {active && paintChrome && hole ? (
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
      {/* P6 — the honest no-target state: the step resolved to no
          element, so there is no hole to cut. ONE full-viewport veil
          panel, no ring, and the card at its corner seat. */}
      {noTarget ? <div aria-hidden className="lp-veil" style={{ inset: 0 }} /> : null}
      {/* The ring + glow in the theme accent, breathing over the hole. */}
      {active && paintChrome && ringHole ? (
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
      {/* The SUBJECT box (P11): a quiet dashed pointer at the region the
          caption is about — and, when the footprint was too big to
          frame, at the EFFECT region instead of a hole around it. */}
      {active && paintChrome && subjectHole ? (
        <div
          aria-hidden
          className="lp-subject"
          style={{
            top: subjectHole.top,
            left: subjectHole.left,
            width: subjectHole.width,
            height: subjectHole.height,
          }}
        />
      ) : null}
      {active && paintChrome && effectSubjectHole ? (
        <div
          aria-hidden
          className="lp-subject"
          style={{
            top: effectSubjectHole.top,
            left: effectSubjectHole.left,
            width: effectSubjectHole.width,
            height: effectSubjectHole.height,
          }}
        />
      ) : null}

      {/* The C′ card, beside the focus. */}
      {showCard && snapshot ? (
        <div ref={cardRef} className="lp-card" style={cardStyle} role="dialog" aria-label={script.title[lang]}>
          {status === 'done' ? (
            <div className="lp-done">
              {showDeclaration ? (
                <>
                  {snapshot.endReason === 'required-anchor-miss' ? (
                    <p className="lp-text">{snapshot.notice?.[lang]}</p>
                  ) : snapshot.endReason === 'stay-here' ? (
                    <p className="lp-text">{label('stayHereDone')}</p>
                  ) : null}
                  <p className="lp-text">{label('notLearned')}</p>
                  {skipLine ? <p className="lp-text">{skipLine}</p> : null}
                  <p className="lp-text">{label('helpInSettings')}</p>
                </>
              ) : (
                <p className="lp-text">
                  {snapshot.endReason === 'required-anchor-miss'
                    ? snapshot.notice?.[lang]
                    : snapshot.endReason === 'stay-here'
                      ? label('stayHereDone')
                      : `${label('wholeLesson')} ${script.capability[lang]}`}
                </p>
              )}
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
                          disabled={snapshot.showMeDwelling}
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

              {/* The stay-here and ✕ windows live OUTSIDE the card now:
                  both render below, as direct siblings under .lp-player,
                  in their centred-modal seats (Oscar's ruling
                  2026-11-15: every pop-up / confirmation window centres). */}

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
                  <button
                    type="button"
                    className="lp-qbtn lp-showme"
                    aria-disabled={!gateOpen || snapshot.showMeDwelling}
                    style={{ opacity: !gateOpen || snapshot.showMeDwelling ? 0.55 : undefined }}
                    onClick={() => {
                      // P12: inert before the read-gate opens, and while
                      // a shown result dwells (the runner guards both
                      // too — this is the honest face of the same law).
                      if (!gateOpen || snapshot.showMeDwelling) return
                      runnerRef.current?.showMe()
                    }}
                  >
                    <MousePointerClick size={13} />
                    <span>{label('showMe')}</span>
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* The stay-here window (Oscar's law, Brizna lane 2026-11-14; seat:
          Oscar's ruling 2026-11-15 — every pop-up / confirmation window
          CENTRES): «Stay here» mid-module FIRST opens this window as a
          CENTRED MODAL over the card (a direct sibling under .lp-player,
          never inside it, the same seat as the ✕ window) — it says the
          learner can continue later exactly where they left off, and
          where the card lives (Settings → Presentations). The clock
          stands still behind it. Only the confirm dissolves the stage;
          «Keep watching» closes the window and the lesson continues
          untouched. A finished module never grows this window. */}
      {snapshot?.stayWindowOpen ? (
        <div className="lp-staywin" role="alertdialog" aria-label={label('stayTitle')}>
          <p className="lp-staywin-t">{label('stayTitle')}</p>
          <p className="lp-staywin-b">{label('stayResume')}</p>
          <p className="lp-staywin-b">{label('stayFind')}</p>
          <div className="lp-staywin-row">
            <button type="button" className="lp-done-btn" onClick={confirmStayHere}>
              <span>{label('stayHere')}</span>
            </button>
            <button type="button" className="lp-qbtn" onClick={() => runnerRef.current?.cancelStayHere()}>
              <span>{label('keepWatching')}</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* The ✕ confirmation window (Oscar's law, Brizna lane 2026-11-14;
          seat P5): mid-module, the ✕ ASKS FIRST — this window opens as a
          CENTRED MODAL over the card (a direct sibling under .lp-player,
          never inside it) before anything exits. The question is the big
          headline; the body stays brief (the window law): your place is
          saved, and you can continue later exactly where you are. The
          clock stands still behind it. Only «Leave» ends the module —
          with the place already recorded — and «Keep watching» closes
          the window with the lesson untouched. A finished module never
          grows this window: its exit is direct. */}
      {snapshot?.closeWindowOpen ? (
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
    </div>
  )
}
