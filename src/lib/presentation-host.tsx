/**
 * The Presentation host — the integration seam between the canon app
 * and the presentation package (src/lib/presentation/). Owns:
 *  - the launch bus: the Settings index (and later, search) asks, App
 *    swaps its shell for the player;
 *  - the LambdaPort: the scenario's ONE door out of the sandbox — it
 *    flips Oscar's own bubble switch and nothing else (Fence 0 E-λ);
 *    since the C-1 cure the host also captures that switch's value at
 *    launch and restores it on every exit (see lambdaRestoreRef);
 *  - the resolving stage: the host resolver shows the fiction stage's
 *    surface for the anchor about to be resolved (flushSync, so the
 *    element exists when the resolver looks), because a lesson walks
 *    the whole house and each beat must find its room standing;
 *  - the stage's visual choreography for performed acts (sheets open
 *    and close as the lesson performs them; the stage's own buttons
 *    do the same for the learner's real taps in Interactive mode);
 *  - the stay-here landing: when a module dissolves into the real
 *    place, the real element carrying the same anchor is brought
 *    into view.
 */
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { createStore, useStore } from './store.ts'
import { settings, ORIGINAL_FAVORITES } from './settings.ts'
import { setBubble } from './bubble.ts'
import { catalogueModule, type ResumePoint } from './presentation/catalogue.ts'
import { anchorRecordFor, resolveStayHereLanding, unfoldHeaderId, type RootLike, type StoreProbes } from './presentation/anchors.ts'
import { toast } from '../components/ui.tsx'
import { t } from './i18n.ts'
import { VOICES } from './voices.ts'
import { BOOK_ACCEPT } from './book/import.ts'
import { parseImage } from './book/image.ts'
import { createScenario, type LambdaPort, type Scenario } from './presentation/scenario/index.ts'
import { TEXT_EN } from './presentation/scenario/fiction.ts'
import { createScenarioPort } from './presentation/engine/scenario-port.ts'
import { createAnchorResolver, type AnchorResolver } from './presentation/engine/resolve.ts'
import { PresentationPlayer } from './presentation/engine/presentation-player.tsx'
import { PRESENTATIONS_OPEN_EVENT } from './presentation/presentation-index.tsx'
import { LogosScenarioStage } from './presentation-stage.tsx'
import './presentation/scripts/index.ts'

// ── The launch bus ────────────────────────────────────────────────
export interface PresentationLaunch {
  moduleId: string
  resumeFrom?: ResumePoint
  nonce: number
}
export const presentationLaunch = createStore<{ current: PresentationLaunch | null }>({ current: null })

export function launchPresentation(moduleId: string, resumeFrom?: ResumePoint) {
  presentationLaunch.set({ current: { moduleId, resumeFrom, nonce: Date.now() } })
}

export function closePresentation() {
  presentationLaunch.set({ current: null })
}

// ── The fiction stage's navigation + sheets ───────────────────────
export type StageSurface = 'listen' | 'library' | 'voices' | 'create' | 'settings' | 'book' | 'bubble'
export type StageSheet = 'voice' | 'keep' | 'sleep' | 'lang' | null
export const stageNav = createStore<{ surface: StageSurface; bump: number }>({ surface: 'settings', bump: 0 })
export interface StageUiState {
  sheet: StageSheet
  /** Library clip menu / book menu / rename: which overlay is open. */
  menu: string | null
  selecting: boolean
  confirm: string | null
  /** Book surface side panel: toc | search | type | info | note | find. */
  panel: string | null
  libTab: 'saved' | 'books'
  /** The Voices page fiction's open section (1.4.202 remap: the page is an accordion now, not filters). */
  voicesSection: string | null
  /** Timed fiction effects: 'creating' | 'importing' | 'web-loading' | null. */
  fx: string | null
  /** The keep sheet after «Make the audio»: it stays standing, busy,
   *  while the fiction render lands (a following beat still points
   *  at the button that was just tapped). */
  keepBusy: boolean
  /** The Listen player dressed with its error note: the state a beat
   *  about errors focuses (the fx fast-forward principle, applied to
   *  the player's error line). Cleared on any room change. */
  listenError: boolean
  /** The fiction speed wheel's step (1.4.211): the player's speed
   *  chip is a wheel now — a tap on the stage chip steps the
   *  fiction rate up the ladder, in a loop, as the real one does.
   *  Index into the ladder [0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
   *  born at 1× (index 2), the chip's resting face. */
  speedIdx: number
}
export const stageUi = createStore<StageUiState>({ sheet: null, menu: null, selecting: false, confirm: null, panel: null, libTab: 'saved', voicesSection: null, fx: null, keepBusy: false, listenError: false, speedIdx: 2 })
export function stagePatch(patch: Partial<StageUiState>) {
  stageUi.set({ ...stageUi.get(), ...patch })
  stageBump()
  syncStageDom()
}
/** Sync the mounted stage rooms (surfaces + library tabs) with the
 *  stores, imperatively: the resolver reads the stores synchronously,
 *  but geometry reads the DOM — and React may not have re-rendered yet
 *  (the runner starts inside a passive effect, where switches batch).
 *  This makes the room the resolver names the room that stands, in
 *  the same task. */
export function syncStageDom() {
  if (typeof document === 'undefined') return
  const surface = stageNav.get().surface
  document.querySelectorAll('[data-stage-surface]').forEach((el) => {
    const name = el.getAttribute('data-stage-surface')
    if (name) (el as HTMLElement).hidden = name !== surface
  })
  const tab = stageUi.get().libTab
  document.querySelectorAll('[data-stage-tab]').forEach((el) => {
    const name = el.getAttribute('data-stage-tab')
    if (name) (el as HTMLElement).hidden = name !== tab
  })
}

export function stageGo(surface: StageSurface) {
  stageNav.set({ surface, bump: stageNav.get().bump + 1 })
  // Changing rooms dismisses whatever sheet was open in the old one,
  // and leaves any half-finished fiction effect behind with its room.
  // A standing confirm belongs to its room too: the delete lessons
  // raise it and contemplate it in the same room, never across one.
  if (stageUi.get().sheet !== null || stageUi.get().keepBusy || stageUi.get().fx !== null || stageUi.get().listenError || stageUi.get().confirm !== null) {
    stageUi.set({ ...stageUi.get(), sheet: null, keepBusy: false, fx: null, listenError: false, confirm: null })
  }
  syncStageDom()
}
export function stageBump() {
  stageNav.set({ ...stageNav.get(), bump: stageNav.get().bump + 1 })
}
export function stageSheet(sheet: StageSheet) {
  stagePatch({ sheet })
}
/** Step the fiction speed wheel one rung up, looping past the top
 *  back to 0.75 — the real chip's tap deed since 1.4.211. */
export function stageStepSpeed() {
  stagePatch({ speedIdx: (stageUi.get().speedIdx + 1) % 8 })
}

/** Voice-catalogue state shared by the Voices surface and the voice
 *  picker: a star placed in one room is the same star in the other. */
export const stageVoices = createStore<{ favs: string[]; defaultId: string; pickedId: string | null }>({ favs: [...ORIGINAL_FAVORITES], defaultId: 'pk_alba', pickedId: null })
export function stageSetPickedVoice(voiceId: string | null) {
  stageVoices.set({ ...stageVoices.get(), pickedId: voiceId })
  stageBump()
}
export function stageToggleFav(voiceId: string) {
  const cur = stageVoices.get()
  const favs = cur.favs.includes(voiceId) ? cur.favs.filter((f) => f !== voiceId) : [...cur.favs, voiceId]
  stageVoices.set({ ...cur, favs })
  stageBump()
}
export function stageSetDefaultVoice(voiceId: string) {
  stageVoices.set({ ...stageVoices.get(), defaultId: voiceId })
  stageBump()
}
/** Fiction field values the lesson types into inputs that are not
 *  scenario drafts (search boxes, rename fields, the web URL). */
export const stageFields = createStore<{ values: Record<string, string> }>({ values: {} })
export function stageField(id: string, value: string) {
  stageFields.set({ values: { ...stageFields.get().values, [id]: value } })
}

/** The shelf as it stands the moment the player mounts. The
 *  scenario's backends answer asynchronously, but a module's first
 *  beat can already point at the shelf (AD7 opens on a tile): the
 *  host reads the shelf once, after entry staging, and the stage's
 *  first paint stands on this snapshot. Reloads on later bumps keep
 *  it live. Set before every mount, cleared on exit. */
export interface StagePrimeBook { id: string; title: string; author: string; temp?: boolean; progress: number }
export interface StagePrimeClip { id: string; title: string; kind: string; duration: number; text: string }
export const stagePrime = createStore<{ books: StagePrimeBook[]; clips: StagePrimeClip[] }>({ books: [], clips: [] })
/** The fiction book's keep-state as the lesson has set it: null =
 *  the book's own state stands; false after «Keep», and the tile
 *  badge (the same switch) flips it either way. Both this store
 *  and stageActiveClip wrap their primitive in an object on
 *  purpose: createStore.set MERGES into an object state, so a
 *  bare boolean/string store would be shredded by its own set
 *  (a string becomes a character-index object, never equal to
 *  what was set — the trap that kept AD6's seek bar unborn). */
export const stageBookTemp = createStore<{ temp: boolean | null }>({ temp: null })
/** The clip whose inline player stands open on the stage's shelf
 *  (its seek bar shows). Set by the card's own Play door and by
 *  the host when a lesson performs that tap. */
export const stageActiveClip = createStore<{ id: string | null }>({ id: null })
/** The clip a Make-audio tap set rendering — the one the lesson
 *  later plays (the fiction holds exactly one text clip). */
let lastRenderedClipId: string | null = null

/** The surface a web anchor lives on. Chrome anchors (nav, brand,
 *  the top-bar λ) live on every surface and return null. */
function surfaceForAnchor(anchorId: string): StageSurface | null {
  if (anchorId.startsWith('voice-picker')) return 'listen'
  if (anchorId.startsWith('listen-') || anchorId.startsWith('share-')) return 'listen'
  if (anchorId.startsWith('desk-')) return 'listen'
  if (anchorId.startsWith('lib-') || anchorId.startsWith('bk-') || anchorId.startsWith('web-import') || anchorId.startsWith('import-')) return 'library'
  if (anchorId.startsWith('book-')) return 'book'
  if (anchorId.startsWith('voices-') || anchorId.startsWith('voice-')) return 'voices'
  if (anchorId.startsWith('create-')) return 'create'
  if (anchorId.startsWith('set-')) return 'settings'
  if (anchorId === 'bubble-lambda') return null
  if (anchorId.startsWith('bubble-')) return 'bubble'
  return null
}

/** The stage's visual choreography for a performed act: sheets,
 *  menus and panels the lesson opens and closes by tapping their
 *  doors; timed fiction effects (a render, an import) start here
 *  and land in the stage a beat later, as they do in the real app. */
function choreograph(anchorId: string, act: string) {
  if (act !== 'tap' && act !== 'goto') return
  // Navigation is a room change, wherever the lesson performs it:
  // a goto on a nav door moves the stage, exactly as the tap would.
  if (anchorId.startsWith('shell-nav:')) {
    const route = anchorId.slice('shell-nav:'.length)
    if (route === 'listen' || route === 'library' || route === 'voices' || route === 'create' || route === 'settings') stageGo(route)
    return
  }
  if (anchorId === 'shell-brand-home') { stageGo('listen'); return }
  // The desk's book opens the book, as the real desk card does.
  if (anchorId === 'desk-book') { stageGo('book'); return }
  // The desk's favourite chips are doors too (the M-38 cure): a
  // performed tap on the favourites card takes the first favourite's
  // voice over — the Listen chip renames — exactly as a real tap on
  // that chip sets the override in the real desk. Before this wiring
  // the performed tap did nothing at all, in either mode, while the
  // caption announced the takeover.
  if (anchorId === 'desk-fav-voices') {
    const favs = stageVoices.get().favs
    if (favs[0]) stageSetPickedVoice(favs[0])
    return
  }
  // The Voices page's star and Make-default buttons (the M-38 cure):
  // their effects lived only in the stage buttons' own onClick, so a
  // PERFORMED tap (Automatic, «Show me») changed nothing while the
  // captions announced "joins your favorites immediately" / "becomes
  // the default voice". A performed tap now does what the button does.
  if (/^voice-card:[^:]+:star$/.test(anchorId)) { stageToggleFav(anchorId.split(':')[1]); return }
  if (/^voice-card:[^:]+:make-default$/.test(anchorId)) { stageSetDefaultVoice(anchorId.split(':')[1]); return }
  if (anchorId === 'listen-voice-chip') stageSheet('voice')
  // Picking a voice renames the chip but does NOT close the picker:
  // the lesson's consequence beats still point at the row just
  // tapped. The picker closes when the lesson changes rooms.
  else if (/^voice-picker-row:[^:]+$/.test(anchorId)) stageSetPickedVoice(anchorId.slice('voice-picker-row:'.length))
  else if (anchorId === 'voice-picker-auto') stageSetPickedVoice(null)
  else if (anchorId === 'listen-reader-save') stageSheet('keep')
  else if (anchorId === 'listen-keep-audio') stagePatch({ keepBusy: true })
  else if (anchorId === 'listen-keep-later') stagePatch({ keepBusy: false })
  else if (anchorId === 'listen-speed-chip') stageStepSpeed()
  else if (anchorId === 'listen-sleep-chip') stageSheet('sleep')
  // Library: clip menu, selection mode, delete confirm.
  else if (anchorId === 'lib-clip-more') stagePatch({ menu: 'clip' })
  else if (anchorId === 'lib-menu-rename') stagePatch({ menu: 'rename' })
  else if (anchorId === 'lib-menu-delete') stagePatch({ confirm: 'delete' })
  // State toggles inside the menu — finish/un-finish, start over —
  // are actions the lesson performs and then points at again in
  // the same open menu (AD9 taps Done twice running). The menu
  // stays standing; only doors (rename, delete) move on.
  else if (anchorId === 'lib-menu-done' || anchorId === 'lib-menu-startover') { /* toggles; the menu stays */ }
  else if (anchorId.startsWith('lib-menu-')) stagePatch({ menu: null })
  else if (anchorId === 'lib-select-toggle') stagePatch({ selecting: true })
  // «Done» marks the selected clips finished — it is an action
  // inside selection mode, not its exit: the lesson's next beats
  // still point at this bar (the mode leaves by its own door).
  else if (anchorId === 'lib-sel-done') { /* marks done; the bar stays */ }
  else if (anchorId === 'lib-sel-delete') stagePatch({ confirm: 'delete' })
  // Make audio — on the card or in its menu — starts the render:
  // the render card tops the shelf while it works (AD6's queue).
  else if (anchorId === 'lib-clip-make-audio' || anchorId === 'lib-menu-make-audio') stagePatch({ fx: 'rendering' })
  // Removing a mark always asks first — the confirm stands for
  // the beat that follows (AD9's marks shelf).
  else if (anchorId === 'lib-mark-remove') stagePatch({ confirm: 'delete' })
  else if (anchorId === 'bk-tile-more') stagePatch({ menu: 'book' })
  // Favourite is a toggle, not a door: the menu stays standing
  // (AD7 walks on to Rename in the same open menu). Done and
  // Start over are toggles too (AD7 points at Done again in the
  // next beat; AD9 taps a book's Done the same way).
  else if (anchorId === 'bk-menu-fav' || anchorId === 'bk-menu-done' || anchorId === 'bk-menu-startover') { /* toggles; the menu stays */ }
  else if (anchorId === 'bk-menu-temp') { stageBookTemp.set({ temp: !(stageBookTemp.get().temp ?? true) }); stagePatch({ menu: null }) }
  else if (anchorId === 'bk-menu-rename') stagePatch({ menu: 'bk-rename' })
  else if (anchorId === 'bk-menu-delete') stagePatch({ confirm: 'delete-book' })
  else if (anchorId.startsWith('bk-menu-')) stagePatch({ menu: null })
  // Book panels.
  else if (anchorId === 'book-head-toc') stagePatch({ panel: 'toc' })
  else if (anchorId === 'book-head-search') stagePatch({ panel: 'search' })
  else if (anchorId === 'book-head-type') stagePatch({ panel: 'type' })
  else if (anchorId === 'book-info') stagePatch({ panel: 'info' })
  else if (anchorId === 'book-link') stagePatch({ panel: 'note' })
  else if (anchorId === 'book-act-close' || anchorId === 'book-back') stagePatch({ panel: null })
  // Timed fiction effects.
  else if (anchorId === 'create-generate') stagePatch({ fx: 'creating' })
  else if (anchorId === 'bk-shelf-import') stagePatch({ fx: 'importing' })
  // The keep question's two answers close it; «Keep» also keeps the
  // book (its badge flips from «For now» to «Kept»), and the badge
  // itself — on the tile or in the book's menu — is the same switch.
  else if (anchorId === 'bk-keepask-keep') { stageBookTemp.set({ temp: false }); stagePatch({ fx: null }) }
  else if (anchorId === 'bk-keepask-once') stagePatch({ fx: null })
  else if (anchorId === 'bk-tile-temp') stageBookTemp.set({ temp: !(stageBookTemp.get().temp ?? true) })
  else if (anchorId === 'web-import-go') stagePatch({ fx: 'web-loading' })
}

// ── The λ port (the sandbox's only door out) ──────────────────────
const lambdaPort: LambdaPort = {
  getBubbleOn: () => settings.get().bubbleOn,
  setBubbleOn: (on: boolean) => { setBubble(on) },
}

// ── Store probes ──────────────────────────────────────────────────
/** STORE anchors point at facts, not elements: the voice catalogue
 *  that exists, the formats the book picker accepts, the image
 *  pipeline that reads a photo and marks a cut-off one with a
 *  warning. The probes answer from the running app's own constants
 *  and modules — the live twin of the anchor fence's static probes,
 *  which grep the same facts in the same files. No user data is
 *  read: a catalogue, an accept string, a function's presence. */
const storeProbes: StoreProbes = {
  'VOICES.length': () => VOICES.length,
  'VOICES grouped by lang+accent': () => new Set(VOICES.map((v) => `${v.lang}:${v.accent}`)).size,
  'BOOK_ACCEPT accept-string': () => BOOK_ACCEPT,
  'parseImage pipeline (scenario image fixture)': () => typeof parseImage === 'function',
  // The warn lives inside parseImage (raw.warn, fenced statically):
  // the runtime fact is that the pipeline carrying it is loaded.
  'BookMeta.warn on the imported scenario book': () => typeof parseImage === 'function',
}

// ── The fiction stage's contract environment ──────────────────────
/** Contract anchors probe the shell's presence and the pushed
 *  bubble state. On the fiction stage the shell IS the stage: the
 *  bridge stub answers present, and the pushed state is the
 *  scenario's own session dressed as a bubbleNow payload. */
function fictionContractEnv(scenario: Scenario) {
  const s = scenario.stage.session()
  const st = scenario.getSettings()
  const bridge: Record<string, unknown> = {}
  for (const name of ['bubbleLock', 'bubbleNative', 'bubblePendingCmd', 'bubblePermission', 'bubbleState', 'bubbleWantClip', 'bubbleNow', 'bubbleLook', 'bubbleClip', 'playing', 'media', 'mediaF']) {
    bridge[name] = () => ''
  }
  return {
    supported: true,
    bridge,
    pushedState: {
      playing: !!s?.playing,
      busy: false,
      title: s?.title ?? 'Logos',
      sub: '',
      light: false,
      lang: st.uiLang,
      words: st.bubbleText,
      bars: null,
      tp: '', tc: s?.text ?? '', tn: '', wi: -1,
    },
  }
}

/** The resolving stage: before a web anchor is looked up, the stage
 *  shows that anchor's surface — synchronously, so the element the
 *  resolver seeks is standing in the room. */
/** The stage root the resolver sees: every surface stays mounted (so a
 *  surface switch never waits on a React commit), and this root only
 *  ever hands back elements of the surface the stage is standing on —
 *  plus the chrome that lives outside every surface. Exactly-once
 *  semantics therefore hold per surface, synchronously, even while
 *  React's own re-render of the switch is still queued.
 *
 *  NO FAMILY NARROWING (the T6-8 cure): this root used to scope a
 *  parameterized family's matches down to the FIRST standing card and
 *  hand them back as a clean resolution — silently converting the
 *  ambiguity the registry law declares a miss (>1 match) into a
 *  first-match, so a lesson pointed at an instance its script never
 *  named (the first of two pronunciation entries, of three chapter
 *  rows, of a favourited voice's two picker rows). The root now hands
 *  back every standing match and the resolver's exactly-once law
 *  decides, honestly: one visible match resolves, several are the
 *  declared 'ambiguous' miss, and a beat that means ONE member must
 *  name it (its companion attribute does the naming, as it always
 *  could). Beats that relied on the silent first-match are lane
 *  flags for the script lane, listed in the Wave 3 mop-up report —
 *  they are not re-pointed here in silence. */
function stageRoot(): { querySelectorAll: (selector: string) => Element[] } {
  return {
    querySelectorAll: (selector: string) => {
      if (typeof document === 'undefined') return []
      const active = stageNav.get().surface
      const tab = stageUi.get().libTab
      let out = Array.from(document.querySelectorAll(selector)).filter((el) => {
        const host = el.closest('[data-stage-surface]')
        if (host && host.getAttribute('data-stage-surface') !== active) return false
        const tabHost = el.closest('[data-stage-tab]')
        if (tabHost && tabHost.getAttribute('data-stage-tab') !== tab) return false
        return true
      })
      // The shell's nav lives twice on the stage, as in the real
      // app (rail + bottom bar); the standing one is the one the
      // viewport shows — wide screens stand on the rail.
      if (selector.includes('shell-nav')) {
        const wide = typeof window !== 'undefined' && window.innerWidth >= 1100
        const inRail = (el: Element) => !!el.closest('[data-present="shell-rail"]')
        const picked = out.filter((el) => inRail(el) === wide)
        if (picked.length > 0) out = picked
      }
      return out
    },
  }
}

function stageResolver(scenario: Scenario): AnchorResolver {
  const base = createAnchorResolver({
    root: () => stageRoot(),
    contractEnv: () => fictionContractEnv(scenario),
    storeProbes,
  })
  const show = (anchorId: string) => {
    const found = anchorRecordFor(anchorId)
    if (found && found.record.kind !== 'web') return
    const target = surfaceForAnchor(anchorId)
    if (target && target !== stageNav.get().surface) {
      flushSync(() => stageGo(target))
    }
    // The Library's two tabs are rooms of their own: shelf anchors
    // stand in Books, the rest in Saved.
    if (target === 'library') {
      const want = anchorId.startsWith('bk-') ? 'books' : 'saved'
      if (stageUi.get().libTab !== want && !anchorId.startsWith('lib-split')) {
        stagePatch({ libTab: want })
        syncStageDom()
      }
    }
    // Timed fiction lands on demand: when a beat focuses the state
    // an effect lands in, the effect completes for that beat rather
    // than making the lesson wait on a wall clock. The transition is
    // flushed synchronously — the resolver queries the DOM in this
    // same task, so the dressed state must already stand in it.
    const fx = stageUi.get().fx
    if (fx === 'importing' && anchorId.startsWith('bk-keepask')) flushSync(() => stagePatch({ fx: 'keepask' }))
    else if (fx === 'web-loading' && anchorId.startsWith('web-import-') && !/url|paste|go|loading|cancel|error/.test(anchorId)) flushSync(() => stagePatch({ fx: 'web-ready' }))
    else if (fx === 'creating' && anchorId.startsWith('create-result')) flushSync(() => stagePatch({ fx: 'created' }))
    // A render lands when the lesson turns to the finished item:
    // its card, its Play door or its seek bar — the render card
    // retires and the item stands as audio (AD6's queue).
    else if (fx === 'rendering' && (anchorId === 'lib-clip-card' || anchorId === 'lib-clip-play' || anchorId === 'lib-clip-seek')) flushSync(() => stagePatch({ fx: null }))
    // The seek bar is React-rendered from the active-clip store;
    // when a beat turns to it, flush any pending stage render in
    // the same task, so the bar stands before the lookup runs.
    if (anchorId === 'lib-clip-seek') flushSync(() => stageBump())
    if (stageUi.get().fx !== fx) syncStageDom()
    // The player's error note is a state like any other: when a
    // beat turns to it, the stage dresses it (and stageGo clears it
    // when the lesson leaves the room).
    if (anchorId === 'listen-error-note' && !stageUi.get().listenError) flushSync(() => stagePatch({ listenError: true }))
    // The web reader's failure is a state too: after the ready
    // state has been walked, the lesson turns to the blocked page,
    // and the sheet dresses its error line for that beat.
    if (anchorId === 'web-import-error' && stageUi.get().fx !== 'web-error') flushSync(() => stagePatch({ fx: 'web-error' }))
    // After the failure, the lesson walks back to the ready state's
    // other doors (the book and audio imports): the retry has
    // landed by then, in fiction time — focusing them lands it.
    if ((anchorId === 'web-import-book-door' || anchorId === 'web-import-audio-door') && stageUi.get().fx === 'web-error') flushSync(() => stagePatch({ fx: 'web-ready' }))
    // The confirm window is a state too: a lesson that turns to
    // contemplate it (AD14's serious doors open on the window
    // itself) finds it standing; delete beats that raise it
    // through choreography arrive earlier and leave it untouched.
    if (anchorId === 'shell-confirm-host' && !stageUi.get().confirm) flushSync(() => stagePatch({ confirm: 'delete' }))
  }
  return {
    resolve: (step) => { show(step.anchorId); return base.resolve(step) },
    resolveById: (anchorId, param) => { show(anchorId); return base.resolveById(anchorId, param) },
  }
}

// ── The host ──────────────────────────────────────────────────────
export function PresentationHost() {
  const { current } = useStore(presentationLaunch)
  const [built, setBuilt] = useState<{ nonce: number; scenario: Scenario } | null>(null)
  /** The λ restore for the CURRENT launch (the C-1 cure's host safety
   *  net): the closure captured by the launch effect below, called on
   *  onExit and from the effect's cleanup, so an exit that somehow
   *  bypasses the runner's teardown still cannot leak a flipped
   *  bubble switch. Idempotent — it only sets the switch when it
   *  stands away from the entry value. */
  const lambdaRestoreRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!current) { setBuilt(null); return }
    stageNav.set({ surface: 'settings', bump: 0 })
    stageUi.set({ sheet: null, menu: null, selecting: false, confirm: null, panel: null, libTab: 'saved', voicesSection: null, fx: null, keepBusy: false, listenError: false })
    stagePrime.set({ books: [], clips: [] })
    stageBookTemp.set({ temp: null })
    stageActiveClip.set({ id: null })
    lastRenderedClipId = null
    // The stage's voice world starts at the app's own factory state
    // (the M-38 cure): the original favourites — Zoey, Noa, Marcos and
    // the rest of settings.ts's ORIGINAL_FAVORITES — arrive starred,
    // as Q3's own narration says they do ("Zoey came starred from the
    // factory"); a lone pk_alba made the star scene's world false
    // before its first beat.
    stageVoices.set({ favs: [...ORIGINAL_FAVORITES], defaultId: 'pk_alba', pickedId: null })
    // THE λ ENTRY CAPTURE (the C-1 cure): the real bubble setting is
    // read HERE, at presentation launch, before the scenario exists
    // and before any beat can flip it. The scenario captures the same
    // value at its own creation and its teardown restores it on every
    // runner exit; this host-side restore is the second net — onExit
    // and this effect's cleanup both call it, and it is a no-op when
    // the switch already stands at the entry value.
    const entryBubbleOn = settings.get().bubbleOn
    const restoreBubble = () => {
      try {
        if (settings.get().bubbleOn !== entryBubbleOn) setBubble(entryBubbleOn)
      } catch { /* a restore must never break an exit */ }
    }
    lambdaRestoreRef.current = restoreBubble
    const scenario = createScenario({ lambdaPort })
    // Entry staging: some lessons open mid-story by design — Q4 and
    // AD3 begin at a live reader, AD7 on a shelf that already holds
    // the fiction book, AD9 and AD13 in a house where that book is
    // already half-read (their Continue card and desk presume it).
    // The staging lands on the sealed scenario before the player
    // mounts, so beat one finds its room standing.
    let live = true
    void (async () => {
      try {
        if (current.moduleId === 'Q4' || current.moduleId === 'AD3') {
          scenario.stage.playText(TEXT_EN.id)
        } else if (current.moduleId === 'AD7') {
          await scenario.books.importBook(scenario.fictionBook.meta, scenario.fictionBook.content)
        } else if (current.moduleId === 'AD9' || current.moduleId === 'AD13') {
          await scenario.books.importBook({ ...scenario.fictionBook.meta, progress: 0.42, pos: { ch: 1, b: 2 } }, scenario.fictionBook.content)
        }
        // Prime the stage's first paint with the shelf as staged.
        const [books0, clips0] = await Promise.all([scenario.books.listBooks(), scenario.library.listClips()])
        stagePrime.set({
          books: books0.map((b) => ({ id: b.id, title: b.title, author: b.author, temp: b.temp, progress: b.progress })),
          clips: clips0.map((c) => ({ id: c.id, title: c.title, kind: c.kind, duration: c.duration, text: c.text })),
        })
      } catch { /* staging is best-effort; the fences report misses */ }
      if (live) setBuilt({ nonce: current.nonce, scenario })
    })()
    return () => {
      live = false
      // The launch ends here — by close, by a new launch, or by the
      // host itself unmounting (the path where the player's own
      // unmount-abort may never run). The player's teardown normally
      // restores the λ first; this is the net under it, and it is a
      // no-op when the switch already stands at the entry value.
      restoreBubble()
      if (lambdaRestoreRef.current === restoreBubble) lambdaRestoreRef.current = null
    }
  }, [current])

  if (!current || !built || built.nonce !== current.nonce) return null
  const entry = catalogueModule(current.moduleId)
  if (!entry?.script) { closePresentation(); return null }

  const port = createScenarioPort(built.scenario, (flat, _res, scenario) => {
    const step = flat.step
    if (step.act === 'type' && typeof step.payload?.value === 'string') {
      // Typed words land where the real app would put them: the two
      // drafts live in the scenario; every other field is stage-local.
      if (step.anchorId === 'listen-editor') scenario.setDraft('listen', step.payload.value)
      else if (step.anchorId === 'create-editor') scenario.setDraft('create', step.payload.value)
      else stageField(step.anchorId, step.payload.value)
    }
    // Data acts the default port does not carry: the keep sheet's
    // two doors land real items in the scenario Library (the beats
    // that follow point at them), and Continue's three doors start
    // their sessions, as the real rows do.
    if (step.act === 'tap' && step.anchorId === 'listen-keep-audio') {
      void scenario.stage.saveCurrentToLibrary().then(() => stageBump()).catch(() => {})
    } else if (step.act === 'tap' && step.anchorId === 'listen-keep-later') {
      void scenario.stage.saveCurrentAsText().then(() => stageBump()).catch(() => {})
    } else if (step.act === 'tap' && step.anchorId === 'listen-continue-book') {
      void scenario.books.listBooks().then((bs) => (bs[0] ? scenario.stage.playBook(bs[0].id) : null)).then(() => stageBump()).catch(() => {})
    } else if (step.act === 'tap' && step.anchorId === 'listen-continue-clip') {
      void scenario.library.listClips().then((cs) => (cs[0] ? scenario.stage.playClip(cs[0].id) : null)).then(() => stageBump()).catch(() => {})
    } else if (step.act === 'tap' && step.anchorId === 'listen-continue-text') {
      try { scenario.stage.playText(TEXT_EN.id) } catch { /* the fiction holds it */ }
    } else if (step.act === 'tap' && step.anchorId === 'bk-shelf-import') {
      // The shelf's import door brings the fiction book in — the
      // beats that follow (the keep question, the tile, its badge)
      // stand on the book actually being in the scenario. It lands
      // dressed as the fiction's one book always is in these
      // lessons: already half-read, so its Continue card stands on
      // the shelf (the same dressing AD9/AD13 stage at entry).
      void scenario.books.importBook({ ...scenario.fictionBook.meta, progress: 0.42, pos: { ch: 1, b: 2 } }, scenario.fictionBook.content).then(() => stageBump()).catch(() => {})
    } else if (step.act === 'tap' && (step.anchorId === 'lib-clip-make-audio' || step.anchorId === 'lib-menu-make-audio')) {
      // Remember which clip is rendering: the queue lesson later
      // plays exactly that one, and its seek bar must stand.
      void scenario.library.listClips().then((cs) => { lastRenderedClipId = cs.find((c) => c.kind === 'text')?.id ?? cs[0]?.id ?? null }).catch(() => {})
    } else if (step.act === 'tap' && step.anchorId === 'lib-clip-play') {
      // Playing a clip opens its inline player on the card (the
      // stage's own Play door does the same for a learner's tap).
      // Synchronous, from the primed shelf: the next beat points
      // at the seek bar, and its resolution must not wait on a
      // promise landing.
      const primed = stagePrime.get().clips
      stageActiveClip.set({ id: lastRenderedClipId ?? primed.find((c) => c.kind === 'text')?.id ?? primed[0]?.id ?? null })
    }
    // Saving a rename with Enter returns to the menu the lesson is
    // walking (the form was a door inside it, not a room change).
    if (step.act === 'key' && step.anchorId === 'lib-rename-input') stagePatch({ menu: 'clip' })
    choreograph(step.anchorId, step.act)
    stageBump()
  })

  return (
    <PresentationPlayer
      key={current.nonce}
      script={entry.script}
      resumeFrom={current.resumeFrom}
      scenario={built.scenario}
      scenarioPort={port}
      ScenarioView={LogosScenarioStage}
      resolver={stageResolver(built.scenario)}
      lang={settings.get().uiLang}
      onExit={(info) => {
        // The λ restore, first (the C-1 cure): completion, abort and
        // stay-here all land here, and the runner's teardown has
        // normally restored the switch already — this call is the
        // host's own guarantee, a no-op when it has.
        lambdaRestoreRef.current?.()
        closePresentation()
        // The index card listens for this: progress, the resume
        // head and «My scenes» refresh the moment a lesson closes.
        dispatchEvent(new Event(PRESENTATIONS_OPEN_EVENT))
        if (info.reason === 'stay-here' && info.stayHereAnchorId) {
          // THE STAY-HERE LANDING (the T6-12 cure): the raw anchor id
          // is NOT a data-present value — a concrete family id's real
          // element carries the family name PLUS its companion
          // attribute, a CLASS anchor carries no data-present at all,
          // an EXISTING anchor lives on its own attribute, and
          // contract / store / stage-only anchors have no real element
          // to land on. The landing therefore resolves through the
          // registry's own semantics (resolveStayHereLanding —
          // resolveWeb, visibility-aware, exactly-once: a multi-seat
          // anchor lands on its VISIBLE seat, never the first in DOM
          // order), performs the record's declared unfold step once
          // when the element stands inside a folded Settings card
          // (the same declared step search «Go» performs), and polls
          // briefly for the real shell to stand. An anchor that
          // cannot land is DECLARED unlandable by the helper's reason
          // — no element exists for it in the real app, or none
          // stands visibly right now — and no fake scroll is made;
          // the learner's place stays recorded in the state file
          // either way, exactly as the stay-here window promised.
          const anchorId = info.stayHereAnchorId
          requestAnimationFrame(() => requestAnimationFrame(() => {
            const root = document as unknown as RootLike
            let unfolded = false
            let tries = 0
            const attempt = () => {
              tries++
              const landing = resolveStayHereLanding(root, anchorId)
              if (landing.status === 'landed') {
                ;(landing.element as { scrollIntoView?: (options?: { block?: string; behavior?: string }) => void })
                  .scrollIntoView?.({ block: 'center', behavior: 'smooth' })
                return
              }
              if (!unfolded) {
                unfolded = true
                const found = anchorRecordFor(anchorId)
                const headerId = found ? unfoldHeaderId(found.record) : null
                if (headerId) {
                  const header = resolveStayHereLanding(root, headerId)
                  if (header.status === 'landed') {
                    const hel = header.element as {
                      querySelector?: (selector: string) => { click?: () => void } | null
                      click?: () => void
                    }
                    const head = hel.querySelector?.('button')
                    if (head?.click) head.click()
                    else hel.click?.()
                  }
                }
              }
              // T6-12 completion: the learner hears WHY nothing
              // landed. A by-design reason (stage-only, not a web
              // anchor, not in the registry) could never land, and a
              // standing failure (missing, ambiguous, not visible)
              // has now had its poll — either way the declared reason
              // is spoken, in the words its class earns. Before this,
              // attempt() simply stopped after 8 tries and the
              // learner heard nothing at all.
              if (tries < 8) setTimeout(attempt, 180)
              else if (landing.reason === 'stage-only' || landing.reason === 'not-a-web-anchor' || landing.reason === 'not-in-registry')
                toast(t("That spot is part of the lesson stage, so there's nothing to land on here — your place is saved."))
              else toast(t("Couldn't find that spot just now — your place is saved in Presentations."))
            }
            attempt()
          }))
        }
      }}
    />
  )
}
