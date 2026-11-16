/**
 * anchors.ts — the Logos Presentation anchor registry, as code.
 *
 * Faithful transcription of ANCHOR-REGISTRY.md (323 anchors: 251 MINT ·
 * 34 CONTRACT · 30 CLASS · 5 STORE · 3 EXISTING), built against Logos
 * 1.4.156. One record per anchor: { id, kind, strategy, items (census ids),
 * modules, locator, file/shellFile, family/companion, precondition? }.
 *
 * Resolution law (FENCE-DESIGN §2 and §7 — no exceptions):
 *  - A web anchor resolves through its ONE declared locator: a MINT anchor
 *    via [data-present="<id>"] exactly-once, a CLASS anchor via its recorded
 *    class/role hook, an EXISTING anchor via its pre-existing attribute.
 *  - A contract anchor resolves via the web↔shell contract names recorded
 *    here (a logosandroid-* command, a LogosAndroid bridge method, or a
 *    field of the bubbleNow pushed state) — never pixels.
 *  - A store anchor resolves via a named store/pipeline probe.
 *  - The resolver NEVER falls back to another selector, a text label, or a
 *    coordinate. A miss returns a failed Resolution; the caller skips the
 *    step and logs the skip (§7 clause 3/4). Ambiguity (>1 match) is a miss.
 *  - A record's `precondition` (§5 of the registry) is a declared resolution
 *    step the player performs first (unfold the card, open the sheet, start
 *    playback) — it is part of resolving that anchor, never a fallback.
 *
 * This module is erasable-syntax TypeScript only (no enums/namespaces), so
 * the plain-Node fence (scripts/presentation/anchor-fence.mjs) can import
 * it directly under Node's type stripping.
 */

export type AnchorKind = 'web' | 'contract' | 'manifest' | 'store'
export type AnchorStrategy = 'MINT' | 'CLASS' | 'EXISTING' | 'CONTRACT' | 'STORE'

export type AnchorLocator =
  | { by: 'data-present' }
  | { by: 'class'; selector: string }
  | { by: 'existing-attr'; attr: string; tag?: string }
  | { by: 'command'; name: string }
  | { by: 'commands'; names: string[] }
  | { by: 'bridge'; name: string }
  | { by: 'push-fields'; names: string[] }
  | { by: 'intent-extra'; name: string }
  | { by: 'manifest'; action: string; mime?: string }
  | { by: 'web-contract'; name: string }
  | { by: 'probe'; name: string }

/** One source-probe site: every needle must be present in the file. */
export interface ProbeSite {
  file: string
  needles: string[]
}

export interface AnchorRecord {
  id: string
  kind: AnchorKind
  strategy: AnchorStrategy
  /** Census ids this anchor serves (A-1 … F-52). */
  items: string[]
  /** Owning modules (Q0–Q5, AD1–AD14, or Engine/All). */
  modules: string[]
  locator: AnchorLocator
  /** Owning web source file (web/store anchors; the web side of a contract). */
  file?: string
  /** Owning shell file (contract anchors' Kotlin side). */
  shellFile?: string
  /** Parameter name for a parameterized family id ({voiceId}, {i}, …). */
  family?: string
  /** Companion attribute carrying the parameter at runtime (e.g. data-voice-id). */
  companion?: string
  /** Source-probe sites for EXISTING / CLASS / CONTRACT / STORE anchors. MINT anchors carry none: they are the designed pending-integration list. */
  probe?: ProbeSite[]
  /** Registry §5 precondition: what must hold (or be performed) before this anchor may be pointed at. */
  precondition?: string
}

/* ------------------------------------------------------------------ */
/* Record factory + locator/probe shorthands (data stays one line each) */
/* ------------------------------------------------------------------ */

function r(
  id: string,
  kind: AnchorKind,
  strategy: AnchorStrategy,
  items: string[],
  modules: string[],
  locator: AnchorLocator,
  extra?: Partial<AnchorRecord>,
): AnchorRecord {
  return { id, kind, strategy, items, modules, locator, ...(extra ?? {}) }
}

const DP: AnchorLocator = { by: 'data-present' }
const cls = (selector: string): AnchorLocator => ({ by: 'class', selector })
const exa = (attr: string, tag?: string): AnchorLocator => (tag ? { by: 'existing-attr', attr, tag } : { by: 'existing-attr', attr })
const cmd = (name: string): AnchorLocator => ({ by: 'command', name })
const cmds = (...names: string[]): AnchorLocator => ({ by: 'commands', names })
const brg = (name: string): AnchorLocator => ({ by: 'bridge', name })
const pushF = (...names: string[]): AnchorLocator => ({ by: 'push-fields', names })
const probeLoc = (name: string): AnchorLocator => ({ by: 'probe', name })
const pr = (file: string, ...needles: string[]): ProbeSite => ({ file, needles })

/* Owning files */
const LP = 'src/pages/ListenPage.tsx'
const CH = 'src/components/chrome.tsx'
const UI = 'src/components/ui.tsx'
const CONT = 'src/components/continue.tsx'
const VIZ = 'src/components/Visualizer.tsx'
const LIB = 'src/pages/LibraryPage.tsx'
const SHELF = 'src/components/shelf.tsx'
const MARKS = 'src/components/marks.tsx'
const BOOK = 'src/pages/BookPage.tsx'
const VOICES_P = 'src/pages/VoicesPage.tsx'
const CREATE = 'src/pages/CreatePage.tsx'
const DESK = 'src/components/desk.tsx'
const WEBIMP = 'src/components/webimport.tsx'
const SET = 'src/pages/SettingsPage.tsx'
const BUB = 'src/lib/bubble.ts'
const LISTEN = 'src/player/listen.ts'
const DRAFTS = 'src/lib/drafts.ts'
const VOICES_LIB = 'src/lib/voices.ts'
const IMPORT_TS = 'src/lib/book/import.ts'
const IMAGE_TS = 'src/lib/book/image.ts'
const MA = 'android/app/src/main/java/com/oscarvelz/logos/MainActivity.kt'
const BS = 'android/app/src/main/java/com/oscarvelz/logos/BubbleService.kt'
const PS = 'android/app/src/main/java/com/oscarvelz/logos/PlaybackService.kt'
const MANIFEST = 'android/app/src/main/AndroidManifest.xml'
const STAGE = 'src/lib/presentation/stage (fiction stage component, built with the engine)'

/* Shared preconditions (registry §5) */
const PC_READING = 'requires an active session in reading view (while editing over a live session, Prev/Next/Mark are disabled and the reader is not mounted)'
const PC_STAGE = 'resolves only while the sealed fiction stage is mounted; never against the real panel or real data'
const PC_SHELL = 'shell present (bubbleSupported() true); in a browser this anchor fails safe and the card explains instead of pointing'
const PC_SHEET = 'owning sheet open — the scene performs the opening tap on the door anchor first'
const PC_MENU = 'item menu open'
const PC_SELECTION = 'selection mode (480 ms long-press on lib-clip-card or lib-select-toggle)'
const PC_1500 = '≥1500px only'
const PC_1100 = '≥1100px only'

/* ------------------------------------------------------------------ */
/* 1A · Listen — src/pages/ListenPage.tsx unless noted                  */
/* ------------------------------------------------------------------ */

const A_LISTEN: AnchorRecord[] = [
  r('listen-editor', 'web', 'MINT', ['A-1', 'A-2'], ['Q1', 'AD3'], DP, { file: LP }),
  r('listen-paste', 'web', 'MINT', ['A-3', 'A-4'], ['Q0', 'Q1'], DP, { file: LP }),
  r('listen-clear', 'web', 'MINT', ['A-5'], ['Q1', 'AD14'], DP, { file: LP }),
  r('listen-save', 'web', 'MINT', ['A-6'], ['Q1', 'Q4'], DP, { file: LP }),
  r('listen-reading-view', 'web', 'MINT', ['A-7'], ['AD3'], DP, { file: LP, precondition: 'exists only while editing over a live session (the inverse of the reader family)' }),
  r('listen-editor-meta', 'web', 'CLASS', ['A-8'], ['AD3'], cls('.editor-meta'), { file: LP, probe: [pr(LP, 'editor-meta')] }),
  r('listen-url-banner', 'web', 'CLASS', ['A-9'], ['AD2'], cls('.url-banner'), { file: LP, probe: [pr(LP, 'url-banner')] }),
  r('listen-page', 'web', 'CLASS', ['A-10', 'A-11', 'A-55', 'A-56'], ['Q1', 'AD2', 'AD3'], cls('.listen-page'), { file: LP, probe: [pr(LP, 'listen-page')] }),
  r('listen-head', 'web', 'CLASS', ['A-12'], ['Q1'], cls('.listen-head'), { file: LP, probe: [pr(LP, 'listen-head')] }),
  r('listen-back-to-book', 'web', 'MINT', ['A-13'], ['AD9'], DP, { file: LP, precondition: 'only while the current text is a book being read' }),
  r('listen-play', 'web', 'CLASS', ['A-14', 'A-45', 'A-50'], ['Q0', 'Q1', 'AD3'], cls('.play-btn'), { file: LP, probe: [pr(LP, 'play-btn')] }),
  r('listen-prev', 'web', 'MINT', ['A-15'], ['Q1', 'AD3'], DP, { file: LP, precondition: PC_READING }),
  r('listen-next', 'web', 'MINT', ['A-16'], ['Q1', 'AD3'], DP, { file: LP, precondition: PC_READING }),
  r('listen-mark', 'web', 'MINT', ['A-17'], ['Q4', 'AD9'], DP, { file: LP, precondition: PC_READING }),
  r('listen-scrubber', 'web', 'CLASS', ['A-18', 'A-19', 'A-20'], ['Q1', 'AD3'], cls('.scrubber'), { file: LP, probe: [pr(LP, 'scrubber', 'role="slider"')], precondition: PC_READING }),
  r('listen-reader', 'web', 'CLASS', ['A-21', 'A-25'], ['Q1', 'AD3'], cls('.reader'), { file: LP, probe: [pr(LP, 'className="reader"')], precondition: PC_READING }),
  r('listen-reader-sentence:{index}', 'web', 'EXISTING', ['A-22', 'A-23', 'A-24'], ['Q0', 'Q1', 'AD3'], exa('data-i'), { file: LP, family: 'index', probe: [pr(LP, 'data-i={')], precondition: PC_READING }),
  r('listen-reader-head', 'web', 'CLASS', ['A-26'], ['AD3'], cls('.reader-head'), { file: LP, probe: [pr(LP, 'reader-head')] }),
  r('listen-text-smaller', 'web', 'MINT', ['A-27'], ['AD3'], DP, { file: LP }),
  r('listen-text-bigger', 'web', 'MINT', ['A-27'], ['AD3'], DP, { file: LP }),
  r('listen-reader-save', 'web', 'MINT', ['A-28'], ['Q4'], DP, { file: LP }),
  r('listen-reader-edit', 'web', 'MINT', ['A-29'], ['AD3'], DP, { file: LP }),
  r('listen-visualizer', 'web', 'MINT', ['A-30'], ['AD3'], DP, { file: VIZ }),
  r('listen-lang-chip', 'web', 'CLASS', ['A-31'], ['Q1', 'AD5'], cls('.lang-chip'), { file: LP, probe: [pr(LP, 'lang-chip')] }),
  r('listen-voice-chip', 'web', 'CLASS', ['A-32'], ['Q0', 'Q3'], cls('.voice-chip'), { file: LP, probe: [pr(LP, 'voice-chip')] }),
  r('listen-speed-chip', 'web', 'CLASS', ['A-34'], ['AD4'], cls('.speed-chip'), { file: LP, probe: [pr(LP, 'speed-chip')] }),
  r('listen-speed-sheet', 'web', 'MINT', ['A-35'], ['AD4'], DP, { file: LP, precondition: PC_SHEET }),
  r('listen-sleep-chip', 'web', 'MINT', ['A-36'], ['AD4'], DP, { file: LP }),
  r('listen-sleep-sheet', 'web', 'MINT', ['A-37', 'A-38'], ['AD4'], DP, { file: LP, precondition: PC_SHEET }),
  r('listen-player-meta', 'web', 'CLASS', ['A-39', 'A-57'], ['Q1', 'AD12'], cls('.player-meta'), { file: LP, probe: [pr(LP, 'player-meta')] }),
  r('listen-engine-note', 'web', 'CLASS', ['A-40', 'A-41', 'A-42', 'A-43'], ['Q1', 'AD3', 'AD14'], cls('.engine-note'), { file: LP, probe: [pr(LP, 'engine-note')] }),
  r('listen-error-note', 'web', 'CLASS', ['A-44'], ['AD3', 'AD14'], cls('.error-note'), { file: LP, probe: [pr(LP, 'error-note')] }),
  r('listen-keep-sheet', 'web', 'MINT', ['A-46'], ['Q4'], DP, { file: LP, precondition: PC_SHEET }),
  r('listen-keep-audio', 'web', 'MINT', ['A-47'], ['Q4'], DP, { file: LP, precondition: PC_SHEET }),
  r('listen-keep-later', 'web', 'MINT', ['A-48'], ['Q4'], DP, { file: LP, precondition: PC_SHEET }),
  r('listen-keep-note', 'web', 'MINT', ['A-49'], ['Q4'], DP, { file: LP, precondition: 'only when the exact text already exists in the Library' }),
  r('listen-nav-pin', 'web', 'MINT', ['A-51', 'F-19'], ['AD3'], DP, { file: LP, precondition: 'exists only while playing and self-clears on stop — the scene starts the scenario session first; anchoring it in a paused stage is a fence error' }),
  r('listen-continue', 'web', 'CLASS', ['A-59'], ['Q4', 'AD9'], cls('.continue-card'), { file: CONT, probe: [pr(CONT, 'continue-card')] }),
  r('listen-continue-book', 'web', 'MINT', ['A-60'], ['AD9'], DP, { file: CONT }),
  r('listen-continue-clip', 'web', 'MINT', ['A-61'], ['AD9'], DP, { file: CONT }),
  r('listen-continue-text', 'web', 'MINT', ['A-62'], ['AD9'], DP, { file: CONT }),
]

/* ------------------------------------------------------------------ */
/* 1B · The bubble — web door and fiction stage                         */
/* ------------------------------------------------------------------ */

const B_STAGE: AnchorRecord[] = [
  r('bubble-lambda', 'web', 'MINT', ['B-1', 'B-2', 'B-45'], ['Q2', 'AD11'], DP, { file: CH, precondition: 'resolve the visible seat (topbar <840px, rail ≥840px); without overlay permission the tap opens the system permission screen — that first journey is narrated, never performed in a sealed scene' }),
  r('bubble-stage-orb', 'web', 'MINT', ['B-7', 'B-8', 'B-9', 'B-10', 'B-12', 'B-13'], ['Q2', 'AD1'], DP, { file: STAGE, precondition: PC_STAGE }),
  r('bubble-stage-panel', 'web', 'MINT', ['B-10', 'B-26', 'B-37', 'B-46'], ['AD1'], DP, { file: STAGE, precondition: PC_STAGE }),
  r('bubble-stage-words', 'web', 'MINT', ['B-30'], ['AD1'], DP, { file: STAGE, precondition: PC_STAGE }),
  r('bubble-stage-grip', 'web', 'MINT', ['B-32'], ['AD1'], DP, { file: STAGE, precondition: PC_STAGE }),
  r('bubble-stage-lock', 'web', 'MINT', ['B-25', 'B-41'], ['AD1'], DP, { file: STAGE, precondition: PC_STAGE }),
  r('bubble-stage-eye', 'web', 'MINT', ['B-45'], ['AD1'], DP, { file: STAGE, precondition: PC_STAGE }),
]

/* ------------------------------------------------------------------ */
/* 1C · The bubble and the system card — native contract                */
/* No DOM exists on these surfaces: resolution is the named command,    */
/* bridge function, or pushed state field.                              */
/* ------------------------------------------------------------------ */

const C_CONTRACT: AnchorRecord[] = [
  r('bubble-state', 'contract', 'CONTRACT', ['B-2', 'B-3', 'B-5'], ['Q2', 'AD11'], brg('bubbleState'), { file: BUB, shellFile: MA, probe: [pr(BUB, 'bubbleState'), pr(MA, 'fun bubbleState')], precondition: PC_SHELL }),
  r('bubble-supported', 'contract', 'CONTRACT', ['B-4'], ['Q2', 'AD11'], brg('bubbleState'), { file: BUB, shellFile: MA, probe: [pr(BUB, 'bubbleSupported'), pr(MA, 'fun bubbleState')], precondition: 'this anchor IS the shell-presence probe: false ⇒ the λ is a plain brand mark and bubble lessons explain themselves' }),
  r('bubble-permission', 'contract', 'CONTRACT', ['B-3'], ['Q2', 'AD11'], brg('bubblePermission'), { file: BUB, shellFile: MA, probe: [pr(BUB, 'bubblePermission'), pr(MA, 'fun bubblePermission', 'ACTION_MANAGE_OVERLAY_PERMISSION')], precondition: 'narrated, never performed inside a sealed scene' }),
  r('bubble-push-playing', 'contract', 'CONTRACT', ['B-6', 'B-14'], ['Q2', 'AD1'], pushF('playing', 'busy'), { file: BUB, shellFile: BS, probe: [pr(BUB, 'playing:'), pr(BS, 'optBoolean("playing")', 'optBoolean("busy")')], precondition: PC_SHELL }),
  r('bubble-voice-wheel', 'contract', 'CONTRACT', ['B-11'], ['AD1'], cmd('voice'), { file: BUB, shellFile: BS, probe: [pr(BUB, "addEventListener('logosandroid-voice'"), pr(BS, 'pokeOrWake("voice")')], precondition: PC_SHELL }),
  r('bubble-clip', 'contract', 'CONTRACT', ['B-16', 'B-17', 'B-18', 'B-19', 'B-20', 'B-24'], ['Q2', 'AD1'], cmd('clip'), { file: BUB, shellFile: MA, probe: [pr(BUB, "addEventListener('logosandroid-clip'", 'bubbleClip'), pr(MA, 'fun bubbleClip')], precondition: PC_SHELL }),
  r('bubble-arrival', 'contract', 'CONTRACT', ['B-21', 'B-24'], ['Q2', 'AD1'], brg('bubbleWantClip'), { file: BUB, shellFile: MA, probe: [pr(BUB, 'bubbleWantClip'), pr(MA, 'fun bubbleWantClip')], precondition: PC_SHELL }),
  r('bubble-lever', 'contract', 'CONTRACT', ['B-22', 'B-23', 'B-42'], ['Q2', 'AD1', 'AD11'], cmd('lever'), { file: BUB, shellFile: MA, probe: [pr(BUB, "addEventListener('logosandroid-lever'", 'bubblePrefs'), pr(MA, 'fun bubblePrefs', 'fun bubbleAuto'), pr(BS, 'poke?.invoke("lever")')], precondition: PC_SHELL }),
  r('bubble-lock-state', 'contract', 'CONTRACT', ['B-25'], ['AD1'], brg('bubbleLock'), { file: BUB, shellFile: MA, probe: [pr(BUB, 'bubbleLock'), pr(MA, 'fun bubbleLock')], precondition: PC_SHELL }),
  r('bubble-panel-state', 'contract', 'CONTRACT', ['B-27'], ['AD1'], pushF('title', 'sub', 'busy'), { file: BUB, shellFile: BS, probe: [pr(BUB, 'title: titleOf', 'sub: s.active'), pr(BS, 'optString("title")')], precondition: PC_SHELL }),
  r('bubble-spectrum', 'contract', 'CONTRACT', ['B-28'], ['AD1'], pushF('bars'), { file: BUB, shellFile: BS, probe: [pr(BUB, 'bars: s.active'), pr(BS, 'optJSONArray("bars")')], precondition: PC_SHELL }),
  r('bubble-words-state', 'contract', 'CONTRACT', ['B-29'], ['AD1'], pushF('tc', 'tp', 'tn', 'wi', 'words'), { file: BUB, shellFile: BS, probe: [pr(BUB, 'tc: s.active', 'wi: settings'), pr(BS, 'optString("tc")', 'optInt("wi"')], precondition: PC_SHELL }),
  r('bubble-seek', 'contract', 'CONTRACT', ['B-31', 'B-38'], ['AD1'], cmd('seek'), { file: BUB, shellFile: MA, probe: [pr(BUB, "addEventListener('logosandroid-seek'", 'bubbleSeek'), pr(MA, 'fun bubbleSeek'), pr(BS, 'poke?.invoke("seek")')], precondition: PC_SHELL }),
  r('bubble-prev', 'contract', 'CONTRACT', ['B-33'], ['AD1', 'AD12'], cmd('prev'), { file: LISTEN, shellFile: BS, probe: [pr(LISTEN, "addEventListener('logosandroid-prev'"), pr(BS, '"prev"')], precondition: PC_SHELL }),
  r('bubble-next', 'contract', 'CONTRACT', ['B-33'], ['AD1', 'AD12'], cmd('next'), { file: LISTEN, shellFile: BS, probe: [pr(LISTEN, "addEventListener('logosandroid-next'"), pr(BS, '"next"')], precondition: PC_SHELL }),
  r('bubble-play', 'contract', 'CONTRACT', ['B-34', 'B-58'], ['AD1'], cmd('play'), { file: BUB, shellFile: BS, probe: [pr(BUB, "addEventListener('logosandroid-play'"), pr(BS, '"play"')], precondition: PC_SHELL }),
  r('bubble-pause', 'contract', 'CONTRACT', ['B-34'], ['AD1'], cmd('pause'), { file: BUB, shellFile: BS, probe: [pr(BUB, "addEventListener('logosandroid-pause'"), pr(BS, '"pause"')], precondition: PC_SHELL }),
  r('bubble-pending', 'contract', 'CONTRACT', ['B-35', 'B-58'], ['AD1'], brg('bubblePendingCmd'), { file: BUB, shellFile: MA, probe: [pr(BUB, 'bubblePendingCmd'), pr(MA, 'fun bubblePendingCmd')], precondition: PC_SHELL }),
  r('bubble-speed', 'contract', 'CONTRACT', ['B-36'], ['AD1'], cmds('slower', 'faster'), { file: BUB, shellFile: BS, probe: [pr(BUB, "addEventListener('logosandroid-slower'", "addEventListener('logosandroid-faster'"), pr(BS, '"slower"', '"faster"')], precondition: PC_SHELL }),
  r('bubble-mark', 'contract', 'CONTRACT', ['B-39'], ['AD1'], cmd('mark'), { file: BUB, shellFile: BS, probe: [pr(BUB, "addEventListener('logosandroid-mark'"), pr(BS, 'pokeOrWake("mark")')], precondition: PC_SHELL }),
  r('bubble-save', 'contract', 'CONTRACT', ['B-40'], ['AD1'], cmd('save'), { file: BUB, shellFile: BS, probe: [pr(BUB, "addEventListener('logosandroid-save'"), pr(BS, 'pokeOrWake("save")')], precondition: PC_SHELL }),
  r('bubble-listen-visit', 'contract', 'CONTRACT', ['B-43', 'B-44', 'F-51'], ['AD1'], { by: 'intent-extra', name: 'logos.listen' }, { file: MA, shellFile: MA, probe: [pr(MA, '"logos.listen"', 'bubbleVisit')], precondition: PC_SHELL }),
  r('bubble-theme-lang', 'contract', 'CONTRACT', ['B-48'], ['AD11'], pushF('light', 'lang'), { file: BUB, shellFile: BS, probe: [pr(BUB, 'lang: settings.get().uiLang'), pr(BS, 'optString("lang"', 'optBoolean("light")')], precondition: PC_SHELL }),
  r('bubble-clip-stage', 'contract', 'CONTRACT', ['B-47'], ['AD1'], probeLoc('bubbleNow clip face (clipPlayer key)'), { file: BUB, shellFile: BS, probe: [pr(BUB, 'clipOwns', 'clipView'), pr(LISTEN, 'stepClip')], precondition: PC_SHELL }),
  r('bubble-native-floor', 'contract', 'CONTRACT', ['B-60'], ['AD1', 'AD12'], brg('bubbleNative'), { file: BUB, shellFile: MA, probe: [pr(BUB, 'bubbleNative'), pr(MA, 'fun bubbleNative', 'fun bubbleNativeStop')], precondition: PC_SHELL }),
  r('media-card', 'contract', 'CONTRACT', ['B-53'], ['AD12'], brg('media'), { file: LISTEN, shellFile: MA, probe: [pr(LISTEN, 'droid.media'), pr(MA, 'fun media')], precondition: PC_SHELL }),
  r('media-actions', 'contract', 'CONTRACT', ['B-54', 'B-57'], ['AD12'], cmds('play', 'pause', 'prev', 'next'), { file: BUB, shellFile: PS, probe: [pr(BUB, "addEventListener('logosandroid-play'", "addEventListener('logosandroid-pause'"), pr(LISTEN, "addEventListener('logosandroid-prev'", "addEventListener('logosandroid-next'"), pr(PS, 'onAction'), pr(MA, 'logosandroid-$a')], precondition: PC_SHELL }),
  r('media-session-active', 'contract', 'CONTRACT', ['B-55'], ['AD12'], probeLoc('media session isActive = playing'), { shellFile: PS, probe: [pr(PS, 'isActive = playing')], precondition: PC_SHELL }),
  r('media-dismissal', 'contract', 'CONTRACT', ['B-56'], ['AD12'], probeLoc('empty publish → stopForeground(REMOVE) + forceStop'), { shellFile: PS, probe: [pr(PS, 'forceStop', 'stopForeground'), pr(MA, 'forceStop')], precondition: PC_SHELL }),
]

/* ------------------------------------------------------------------ */
/* 1D · Library — Saved — src/pages/LibraryPage.tsx unless noted        */
/* ------------------------------------------------------------------ */

const D_SAVED: AnchorRecord[] = [
  r('lib-shelf-tabs', 'web', 'MINT', ['C-1'], ['Q4', 'AD6'], DP, { file: LIB, precondition: '<1500px only; replaced by lib-split at ≥1500px' }),
  r('lib-split', 'web', 'CLASS', ['C-2', 'F-28'], ['AD13'], cls('.lib-split'), { file: LIB, probe: [pr(LIB, 'lib-split')], precondition: PC_1500 }),
  r('lib-split-saved', 'web', 'MINT', ['F-28'], ['AD13'], DP, { file: LIB, precondition: PC_1500 }),
  r('lib-split-books', 'web', 'MINT', ['F-28'], ['AD13'], DP, { file: LIB, precondition: PC_1500 }),
  r('lib-head-count', 'web', 'MINT', ['C-3'], ['AD6', 'AD14'], DP, { file: LIB }),
  r('lib-add', 'web', 'MINT', ['C-4', 'C-67'], ['Q4', 'Q5'], DP, { file: LIB }),
  r('lib-select-toggle', 'web', 'MINT', ['C-5', 'C-21'], ['AD6'], DP, { file: LIB }),
  r('lib-saved-empty', 'web', 'MINT', ['C-7', 'C-6'], ['Q4', 'AD6'], DP, { file: LIB }),
  r('lib-saved-nomatch', 'web', 'MINT', ['C-8'], ['AD6'], DP, { file: LIB }),
  r('lib-saved-search', 'web', 'MINT', ['C-9'], ['Q4', 'AD6'], DP, { file: LIB }),
  r('lib-saved-filters', 'web', 'CLASS', ['C-10'], ['Q4', 'AD6'], cls('[role="tablist"]'), { file: LIB, probe: [pr(LIB, 'tablist')] }),
  r('lib-filter:{filterId}', 'web', 'MINT', ['C-10'], ['Q4', 'AD6'], DP, { file: LIB, family: 'filterId', companion: 'data-filter', precondition: 'zero-count chips are not rendered (except All)' }),
  r('lib-saved-sort', 'web', 'MINT', ['C-11'], ['AD6'], DP, { file: LIB }),
  r('lib-clip-card', 'web', 'MINT', ['C-12', 'C-20', 'C-39', 'C-42'], ['Q4', 'AD6'], DP, { file: LIB, companion: 'data-clip-kind' }),
  r('lib-clip-play', 'web', 'MINT', ['C-13', 'C-40', 'C-41'], ['Q4', 'AD9'], DP, { file: LIB }),
  r('lib-clip-seek', 'web', 'CLASS', ['C-14'], ['AD6'], cls('[role="slider"]'), { file: LIB, probe: [pr(LIB, "'slider'")], precondition: 'the slider role exists only while that clip is the active one; an idle card\u2019s bar is a display, not a control' }),
  r('lib-clip-meta', 'web', 'MINT', ['C-15', 'C-17', 'C-36'], ['Q4', 'AD6'], DP, { file: LIB }),
  r('lib-clip-fav', 'web', 'MINT', ['C-18'], ['Q4', 'AD6'], DP, { file: LIB }),
  r('lib-clip-more', 'web', 'MINT', ['C-19'], ['Q4', 'AD6'], DP, { file: LIB, precondition: 'disappears in selection mode' }),
  r('lib-clip-selbox', 'web', 'MINT', ['C-21'], ['AD6'], DP, { file: LIB, precondition: PC_SELECTION }),
  r('lib-selbar', 'web', 'CLASS', ['C-22'], ['AD6'], cls('[role="toolbar"]'), { file: LIB, probe: [pr(LIB, 'role="toolbar"')], precondition: PC_SELECTION }),
  r('lib-sel-all', 'web', 'MINT', ['C-22'], ['AD6'], DP, { file: LIB, precondition: PC_SELECTION }),
  r('lib-sel-fav', 'web', 'MINT', ['C-23'], ['AD6'], DP, { file: LIB, precondition: PC_SELECTION }),
  r('lib-sel-done', 'web', 'MINT', ['C-24'], ['AD6'], DP, { file: LIB, precondition: PC_SELECTION }),
  r('lib-sel-delete', 'web', 'MINT', ['C-25'], ['AD6', 'AD14'], DP, { file: LIB, precondition: PC_SELECTION }),
  r('lib-menu-open-listen', 'web', 'MINT', ['C-26'], ['AD6'], DP, { file: LIB, precondition: PC_MENU + '; only when the clip holds text' }),
  r('lib-menu-make-audio', 'web', 'MINT', ['C-27'], ['Q4', 'AD6'], DP, { file: LIB, precondition: PC_MENU + '; text clips only' }),
  r('lib-menu-done', 'web', 'MINT', ['C-28'], ['AD6', 'AD9'], DP, { file: LIB, precondition: PC_MENU }),
  r('lib-menu-startover', 'web', 'MINT', ['C-29'], ['AD9'], DP, { file: LIB, precondition: PC_MENU + '; audio, part-heard, unfinished' }),
  r('lib-menu-webpage', 'web', 'MINT', ['C-30'], ['AD6', 'AD2'], DP, { file: LIB, precondition: PC_MENU + '; clip.url exists' }),
  r('lib-menu-rename', 'web', 'MINT', ['C-31'], ['AD6'], DP, { file: LIB, precondition: PC_MENU }),
  r('lib-rename-input', 'web', 'MINT', ['C-31', 'F-50'], ['AD6'], DP, { file: LIB, precondition: 'RenameSheet open' }),
  r('lib-menu-download', 'web', 'MINT', ['C-32'], ['AD6', 'AD8'], DP, { file: LIB, precondition: PC_MENU + '; audio only' }),
  r('lib-menu-share', 'web', 'MINT', ['C-33'], ['AD6'], DP, { file: LIB, precondition: PC_MENU + '; audio only' }),
  r('lib-menu-delete', 'web', 'MINT', ['C-34'], ['AD6', 'AD14'], DP, { file: LIB, precondition: PC_MENU }),
  r('lib-clip-make-audio', 'web', 'MINT', ['C-35'], ['Q4', 'AD6'], DP, { file: LIB }),
  r('lib-clip-render-stop', 'web', 'MINT', ['C-36', 'C-38'], ['AD6'], DP, { file: LIB, precondition: 'only while this item renders or waits in the queue' }),
  r('lib-render-card', 'web', 'MINT', ['C-37', 'C-38'], ['AD6', 'AD8'], DP, { file: LIB, precondition: 'only while an export job runs or queues; same .render-card class as bk-importing — resolution is page-scoped' }),
  r('lib-marks', 'web', 'MINT', ['C-43'], ['Q4', 'AD9'], DP, { file: MARKS, precondition: 'the shelf exists only when ≥1 mark exists' }),
  r('lib-marks-row', 'web', 'CLASS', ['C-44', 'C-45', 'C-46'], ['AD9'], cls('.mark-row'), { file: MARKS, probe: [pr(MARKS, 'mark-row')], precondition: 'only the latest 30 rows render' }),
  r('lib-mark-remove', 'web', 'MINT', ['C-47'], ['AD9', 'AD14'], DP, { file: MARKS }),
]

/* ------------------------------------------------------------------ */
/* 1E · Books shelf — src/components/shelf.tsx                          */
/* ------------------------------------------------------------------ */

const E_BOOKS: AnchorRecord[] = [
  r('bk-shelf-search', 'web', 'MINT', ['C-49'], ['Q5', 'AD7'], DP, { file: SHELF }),
  r('bk-shelf-filters', 'web', 'CLASS', ['C-50'], ['Q5', 'AD7'], cls('[role="tablist"]'), { file: SHELF, probe: [pr(SHELF, 'tablist')] }),
  r('bk-filter:{filterId}', 'web', 'MINT', ['C-50'], ['Q5', 'AD7'], DP, { file: SHELF, family: 'filterId', precondition: 'zero-count chips hide' }),
  r('bk-shelf-sort', 'web', 'MINT', ['C-51'], ['AD7'], DP, { file: SHELF }),
  r('bk-cover-size', 'web', 'CLASS', ['C-52'], ['Q5', 'AD7'], cls('[role="radiogroup"]'), { file: SHELF, probe: [pr(SHELF, 'radiogroup')] }),
  r('bk-shelf-continue', 'web', 'MINT', ['C-53', 'C-121'], ['Q5', 'AD9'], DP, { file: SHELF }),
  r('bk-tile', 'web', 'MINT', ['C-54', 'C-55', 'C-57', 'C-74'], ['Q5', 'AD7'], DP, { file: SHELF, family: 'book' }),
  r('bk-tile-temp', 'web', 'MINT', ['C-56', 'C-75', 'C-80', 'C-81'], ['Q5', 'AD7'], DP, { file: SHELF }),
  r('bk-tile-more', 'web', 'MINT', ['C-57'], ['Q5', 'AD7'], DP, { file: SHELF }),
  r('bk-shelf-import', 'web', 'MINT', ['C-58', 'C-67', 'C-69'], ['Q5', 'AD2', 'AD7'], DP, { file: SHELF, precondition: 'two seats, one id (grid Import tile / empty-state Import button) — the resolver picks the rendered one' }),
  r('bk-importing', 'web', 'MINT', ['C-59', 'C-71'], ['Q5', 'AD7'], DP, { file: SHELF, precondition: 'only while an import runs; same .render-card class as lib-render-card — resolution is page-scoped' }),
  r('bk-menu-open', 'web', 'MINT', ['C-60'], ['Q5'], DP, { file: SHELF, precondition: PC_MENU }),
  r('bk-menu-fav', 'web', 'MINT', ['C-61'], ['AD7'], DP, { file: SHELF, precondition: PC_MENU }),
  r('bk-menu-temp', 'web', 'MINT', ['C-62', 'C-81'], ['Q5', 'AD7'], DP, { file: SHELF, precondition: PC_MENU }),
  r('bk-menu-done', 'web', 'MINT', ['C-63'], ['AD7', 'AD9'], DP, { file: SHELF, precondition: PC_MENU }),
  r('bk-menu-startover', 'web', 'MINT', ['C-64'], ['AD9'], DP, { file: SHELF, precondition: PC_MENU + '; progress > 0' }),
  r('bk-menu-rename', 'web', 'MINT', ['C-65'], ['AD7'], DP, { file: SHELF, precondition: PC_MENU }),
  r('bk-rename-title', 'web', 'MINT', ['C-65', 'F-50'], ['AD7'], DP, { file: SHELF, precondition: 'RenameBook sheet open' }),
  r('bk-rename-author', 'web', 'MINT', ['C-65'], ['AD7'], DP, { file: SHELF, precondition: 'RenameBook sheet open' }),
  r('bk-menu-delete', 'web', 'MINT', ['C-66'], ['AD7', 'AD14'], DP, { file: SHELF, precondition: PC_MENU }),
  r('bk-keepask', 'web', 'MINT', ['C-77'], ['Q5'], DP, { file: SHELF, precondition: 'only in the ~5-second post-import window — the scene performs a scenario import first, and the clock is real' }),
  r('bk-keepask-keep', 'web', 'MINT', ['C-78'], ['Q5'], DP, { file: SHELF, precondition: 'KeepAsk window (see bk-keepask)' }),
  r('bk-keepask-once', 'web', 'MINT', ['C-79'], ['Q5'], DP, { file: SHELF, precondition: 'KeepAsk window (see bk-keepask)' }),
]

/* ------------------------------------------------------------------ */
/* 1F · The open book — src/pages/BookPage.tsx                          */
/* ------------------------------------------------------------------ */

const PC_TOOLBAR = 'paragraph toolbar open (a paragraph was tapped)'
const PC_FIND = 'only while a find is active'
const PC_TYPE_SHEET = 'type sheet open'
const PC_SEARCH_SHEET = 'book search sheet open'

const F_BOOK: AnchorRecord[] = [
  r('book-page', 'web', 'MINT', ['C-82', 'C-121'], ['Q5', 'AD9'], DP, { file: BOOK, precondition: 'on this route the phone shell is hidden — no nav/topbar anchor resolves here' }),
  r('book-missing', 'web', 'MINT', ['C-83'], ['AD7'], DP, { file: BOOK }),
  r('book-head-back', 'web', 'MINT', ['C-84'], ['Q5'], DP, { file: BOOK }),
  r('book-head-search', 'web', 'MINT', ['C-84'], ['Q5', 'AD7'], DP, { file: BOOK }),
  r('book-head-toc', 'web', 'MINT', ['C-84'], ['Q5'], DP, { file: BOOK, precondition: '<1100px only; at ≥1100px it disappears and book-side-toc replaces it' }),
  r('book-head-type', 'web', 'MINT', ['C-84'], ['Q5', 'AD7'], DP, { file: BOOK }),
  r('book-eyebrow', 'web', 'MINT', ['C-85'], ['AD7'], DP, { file: BOOK }),
  r('book-block:{i}', 'web', 'EXISTING', ['C-86', 'C-87', 'C-93', 'C-101', 'C-103', 'C-104'], ['Q5', 'AD7', 'AD9'], exa('data-b'), { file: BOOK, family: 'i', probe: [pr(BOOK, "'data-b':", 'bk-${i}')] }),
  r('book-side-toc', 'web', 'MINT', ['C-88', 'F-26'], ['AD13', 'AD7'], DP, { file: BOOK, precondition: PC_1100 }),
  r('book-toc-current', 'web', 'CLASS', ['C-89'], ['AD7'], cls('.bk-toc-i.cur'), { file: BOOK, probe: [pr(BOOK, 'bk-toc-i', "'cur'")] }),
  r('book-toc-tabs', 'web', 'MINT', ['C-90'], ['Q5', 'AD7'], DP, { file: BOOK }),
  r('book-toc-list', 'web', 'MINT', ['C-90'], ['AD7'], DP, { file: BOOK }),
  r('book-marks-list', 'web', 'MINT', ['C-90'], ['AD7'], DP, { file: BOOK }),
  r('book-toc-row', 'web', 'MINT', ['C-91'], ['Q5', 'AD7'], DP, { file: BOOK, family: 'entry' }),
  r('book-marks-row', 'web', 'MINT', ['C-92'], ['AD7', 'AD9'], DP, { file: BOOK, family: 'mark' }),
  r('book-actions', 'web', 'CLASS', ['C-93'], ['Q5', 'AD7'], cls('[role="toolbar"]'), { file: BOOK, probe: [pr(BOOK, 'role="toolbar"')], precondition: PC_TOOLBAR }),
  r('book-act-listen', 'web', 'MINT', ['C-94', 'C-98'], ['Q5', 'AD7', 'AD9'], DP, { file: BOOK, precondition: PC_TOOLBAR }),
  r('book-act-bookmark', 'web', 'MINT', ['C-95'], ['Q5', 'AD7', 'AD9'], DP, { file: BOOK, precondition: PC_TOOLBAR }),
  r('book-act-copy', 'web', 'MINT', ['C-96'], ['AD7'], DP, { file: BOOK, precondition: PC_TOOLBAR }),
  r('book-act-close', 'web', 'MINT', ['C-97'], ['AD7'], DP, { file: BOOK, precondition: PC_TOOLBAR }),
  r('book-search-input', 'web', 'MINT', ['C-99', 'F-50'], ['AD7'], DP, { file: BOOK, precondition: PC_SEARCH_SHEET }),
  r('book-search-count', 'web', 'MINT', ['C-100'], ['AD7'], DP, { file: BOOK, precondition: PC_SEARCH_SHEET }),
  r('book-search-row', 'web', 'MINT', ['C-100', 'C-101'], ['AD7'], DP, { file: BOOK, family: 'hit', precondition: PC_SEARCH_SHEET + '; only the first 120 matches render' }),
  r('book-search-paint', 'web', 'CLASS', ['C-101'], ['AD7'], cls('.bk-mark'), { file: BOOK, probe: [pr(BOOK, 'bk-mark')] }),
  r('book-findbar', 'web', 'MINT', ['C-102'], ['AD7'], DP, { file: BOOK, precondition: PC_FIND }),
  r('book-find-prev', 'web', 'MINT', ['C-102'], ['AD7'], DP, { file: BOOK, precondition: PC_FIND }),
  r('book-find-next', 'web', 'MINT', ['C-102'], ['AD7'], DP, { file: BOOK, precondition: PC_FIND }),
  r('book-find-close', 'web', 'MINT', ['C-102'], ['AD7'], DP, { file: BOOK, precondition: PC_FIND }),
  r('book-link', 'web', 'CLASS', ['C-103', 'C-104'], ['AD7'], cls('.bk-link'), { file: BOOK, probe: [pr(BOOK, 'bk-link')], precondition: 'sanctioned class resolution: links are generated content — a per-link mint is impossible (registry §1F ruling)' }),
  r('book-note-sheet', 'web', 'MINT', ['C-105'], ['AD7'], DP, { file: BOOK, precondition: 'appears only when the note rule fires (target <700 chars, note-shaped, ≥3 blocks away, not a heading); the same-looking link otherwise jumps' }),
  r('book-note-go', 'web', 'MINT', ['C-105'], ['AD7'], DP, { file: BOOK, precondition: 'note sheet open (see book-note-sheet)' }),
  r('book-back', 'web', 'MINT', ['C-106'], ['AD7'], DP, { file: BOOK, precondition: 'rendered only when the back stack is non-empty or a find is open' }),
  r('book-prev-ch', 'web', 'MINT', ['C-107'], ['Q5', 'AD7'], DP, { file: BOOK }),
  r('book-next-ch', 'web', 'MINT', ['C-107'], ['Q5', 'AD7'], DP, { file: BOOK }),
  r('book-bar-mid', 'web', 'MINT', ['C-108'], ['Q5', 'AD7'], DP, { file: BOOK }),
  r('book-bar-listen', 'web', 'MINT', ['C-109'], ['AD7', 'AD9'], DP, { file: BOOK }),
  r('book-bar-follow', 'web', 'MINT', ['C-109'], ['AD7', 'AD9'], DP, { file: BOOK }),
  r('book-seek', 'web', 'CLASS', ['C-110', 'C-111'], ['AD7', 'AD13'], cls('[role="slider"]'), { file: BOOK, probe: [pr(BOOK, 'role="slider"')] }),
  r('book-next-card', 'web', 'MINT', ['C-112'], ['Q5', 'AD7'], DP, { file: BOOK, precondition: 'at a chapter\u2019s end' }),
  r('book-end-finish', 'web', 'MINT', ['C-113'], ['AD7', 'AD9'], DP, { file: BOOK, precondition: 'absent once the book is done' }),
  r('book-type-size-minus', 'web', 'MINT', ['C-114'], ['AD7'], DP, { file: BOOK, precondition: PC_TYPE_SHEET }),
  r('book-type-size-plus', 'web', 'MINT', ['C-114'], ['AD7'], DP, { file: BOOK, precondition: PC_TYPE_SHEET }),
  r('book-type-font', 'web', 'MINT', ['C-115'], ['AD7'], DP, { file: BOOK, precondition: PC_TYPE_SHEET }),
  r('book-type-lines', 'web', 'MINT', ['C-115'], ['AD7'], DP, { file: BOOK, precondition: PC_TYPE_SHEET }),
  r('book-info', 'web', 'MINT', ['C-116', 'F-29'], ['AD13'], DP, { file: BOOK, precondition: PC_1500 }),
  r('book-info-listen', 'web', 'MINT', ['C-117'], ['AD13'], DP, { file: BOOK, precondition: PC_1500 }),
  r('book-info-search', 'web', 'MINT', ['C-117'], ['AD13'], DP, { file: BOOK, precondition: PC_1500 }),
  r('book-info-type', 'web', 'MINT', ['C-117'], ['AD13'], DP, { file: BOOK, precondition: PC_1500 }),
  r('book-info-marks', 'web', 'MINT', ['C-118'], ['AD13', 'AD9'], DP, { file: BOOK, precondition: PC_1500 }),
  r('book-info-stats', 'web', 'MINT', ['C-119'], ['AD13'], DP, { file: BOOK, precondition: PC_1500 }),
  r('book-info-audiobook', 'web', 'MINT', ['C-120'], ['AD13', 'AD8'], DP, { file: BOOK, precondition: '≥1500px only — there is no phone door; Q5 must never promise it' }),
]

/* ------------------------------------------------------------------ */
/* 1G · Voices — src/pages/VoicesPage.tsx / src/components/chrome.tsx   */
/* ------------------------------------------------------------------ */

const PC_PICKER = 'VoicePicker sheet open'
const PC_GROUP = 'picker open and that group unfolded (groups arrive folded; opening one closes the others)'

const G_VOICES: AnchorRecord[] = [
  r('voices-catalog', 'store', 'STORE', ['D-1'], ['AD5'], probeLoc('VOICES.length'), { file: VOICES_LIB, probe: [pr(VOICES_LIB, 'export const VOICES')] }),
  r('voices-catalog-accents', 'store', 'STORE', ['D-2', 'D-3'], ['AD5'], probeLoc('VOICES grouped by lang+accent'), { file: VOICES_LIB, probe: [pr(VOICES_LIB, 'export const VOICES')] }),
  r('voices-head', 'web', 'MINT', ['D-5'], ['Q3'], DP, { file: VOICES_P }),
  r('voices-filter:{key}', 'web', 'MINT', ['D-6'], ['Q3'], DP, { file: VOICES_P, family: 'key', companion: 'data-filter' }),
  r('voices-grid', 'web', 'MINT', ['D-7'], ['Q3', 'AD5'], DP, { file: VOICES_P }),
  r('voices-empty-fav', 'web', 'MINT', ['D-15'], ['Q3'], DP, { file: VOICES_P, precondition: 'Favorites filter with scenario favorites empty' }),
  r('voice-card:{voiceId}', 'web', 'MINT', ['D-8', 'D-3', 'D-4'], ['Q3', 'AD5'], DP, { file: VOICES_P, family: 'voiceId', companion: 'data-voice-id' }),
  r('voice-card:{voiceId}:star', 'web', 'MINT', ['D-9', 'D-10'], ['Q3'], DP, { file: VOICES_P, family: 'voiceId', companion: 'data-voice-id' }),
  r('voice-card:{voiceId}:make-default', 'web', 'MINT', ['D-11'], ['Q3', 'AD5'], DP, { file: VOICES_P, family: 'voiceId', companion: 'data-voice-id', precondition: 'absent on the card that already is the default (it wears the flag instead)' }),
  r('voice-card:{voiceId}:preview', 'web', 'MINT', ['D-12', 'D-13', 'D-14'], ['Q3'], DP, { file: VOICES_P, family: 'voiceId', companion: 'data-voice-id' }),
  r('voice-picker', 'web', 'MINT', ['D-16'], ['Q3', 'AD8'], DP, { file: CH, precondition: PC_PICKER }),
  r('voice-picker-auto', 'web', 'MINT', ['D-17'], ['Q3', 'AD5'], DP, { file: CH, precondition: PC_PICKER }),
  // T6-9 cure: the bare [data-group] hook matches TWO real elements — the
  // group's <section data-group> AND its head <button data-group …:head> —
  // so the unqualified locator was ambiguous in the real app and resolved
  // only on the fiction stage, whose picker rendered a single carrier.
  // The locator is now tag-qualified to the section: the group itself is
  // the one seat this anchor names (its head keeps its own :head anchor).
  r('voice-picker-group:{key}', 'web', 'EXISTING', ['D-18', 'D-19'], ['AD5'], exa('data-group', 'section'), { file: CH, family: 'key', probe: [pr(CH, 'data-group={')], precondition: PC_PICKER }),
  r('voice-picker-group:{key}:head', 'web', 'MINT', ['D-20', 'D-21', 'D-22'], ['Q3', 'AD5'], DP, { file: CH, family: 'key', companion: 'data-group', precondition: PC_GROUP }),
  r('voice-picker-row:{voiceId}', 'web', 'MINT', ['D-23', 'D-26'], ['Q3'], DP, { file: CH, family: 'voiceId', companion: 'data-voice-id', precondition: PC_GROUP + '; when the picker is opened for one language, other-language voices are filtered out everywhere — rows for them do not exist in that opening' }),
  r('voice-picker-row:{voiceId}:preview', 'web', 'MINT', ['D-24'], ['Q3'], DP, { file: CH, family: 'voiceId', companion: 'data-voice-id', precondition: PC_GROUP + '; rendered only for voices with a baked preview (all 57 today — see the fence note in registry §6)' }),
  r('voice-picker-row:{voiceId}:star', 'web', 'MINT', ['D-25'], ['Q3'], DP, { file: CH, family: 'voiceId', companion: 'data-voice-id', precondition: PC_GROUP }),
]

/* ------------------------------------------------------------------ */
/* 1H · Create — src/pages/CreatePage.tsx unless noted                  */
/* ------------------------------------------------------------------ */

const H_CREATE: AnchorRecord[] = [
  r('create-head', 'web', 'MINT', ['D-31'], ['AD8'], DP, { file: CREATE }),
  r('create-editor', 'web', 'MINT', ['D-32'], ['AD8'], DP, { file: CREATE }),
  r('create-paste', 'web', 'MINT', ['D-33'], ['AD8'], DP, { file: CREATE }),
  r('create-use-listen', 'web', 'MINT', ['D-34'], ['Q0', 'Q1', 'AD8'], DP, { file: CREATE, precondition: 'disabled while Listen is empty' }),
  r('create-meta', 'web', 'MINT', ['D-35'], ['AD8'], DP, { file: CREATE }),
  r('create-voice-row', 'web', 'MINT', ['D-36'], ['AD8'], DP, { file: CREATE }),
  r('create-voice-chip:{voiceId|auto}', 'web', 'MINT', ['D-36'], ['AD8'], DP, { file: CREATE, family: 'voiceId|auto', companion: 'data-voice-id' }),
  r('create-voice-chosen', 'web', 'MINT', ['D-37'], ['AD8'], DP, { file: CREATE }),
  r('create-speed', 'web', 'MINT', ['D-39'], ['AD8'], DP, { file: CREATE }),
  r('create-format', 'web', 'MINT', ['D-40'], ['AD8'], DP, { file: CREATE }),
  r('create-title', 'web', 'MINT', ['D-41'], ['AD8'], DP, { file: CREATE }),
  r('create-generate', 'web', 'MINT', ['D-42', 'D-44'], ['AD8'], DP, { file: CREATE }),
  r('create-engine-note', 'web', 'MINT', ['D-43'], ['AD8'], DP, { file: CREATE }),
  r('create-progress', 'web', 'MINT', ['D-46'], ['AD8'], DP, { file: CREATE, precondition: 'a render is in progress' }),
  r('create-cancel', 'web', 'MINT', ['D-46'], ['AD8'], DP, { file: CREATE, precondition: 'a render is in progress' }),
  r('create-error', 'web', 'MINT', ['D-47'], ['AD8'], DP, { file: CREATE, precondition: 'error state only' }),
  r('create-result', 'web', 'MINT', ['D-48'], ['AD8'], DP, { file: CREATE, precondition: 'a finished render exists' }),
  r('create-result-seek', 'web', 'MINT', ['D-49'], ['AD8'], DP, { file: CREATE, precondition: 'live only while the result holds the clip stage' }),
  r('create-result-download', 'web', 'MINT', ['D-50'], ['AD6', 'AD8'], DP, { file: CREATE }),
  r('create-result-share', 'web', 'MINT', ['D-51'], ['AD8'], DP, { file: CREATE }),
  r('create-result-library', 'web', 'MINT', ['D-52'], ['AD8'], DP, { file: CREATE }),
  r('create-result-new', 'web', 'MINT', ['D-52'], ['AD8'], DP, { file: CREATE }),
  r('create-recordings', 'web', 'MINT', ['D-53', 'F-30'], ['AD13'], DP, { file: DESK, precondition: PC_1500 }),
]

/* ------------------------------------------------------------------ */
/* 1I · Sharing in and web import                                       */
/* ------------------------------------------------------------------ */

const PC_ANDROID = 'Android app only; does not exist on the web surface'

const I_SHARE: AnchorRecord[] = [
  r('share-listen-in-logos', 'manifest', 'CONTRACT', ['D-54', 'D-57'], ['AD2', 'Q1'], { by: 'manifest', action: 'android.intent.action.SEND', mime: 'text/plain' }, { file: MANIFEST, probe: [pr(MANIFEST, 'android.intent.action.SEND', 'text/plain')], precondition: PC_ANDROID }),
  r('share-web-target', 'contract', 'CONTRACT', ['D-55'], ['AD2'], { by: 'web-contract', name: '?title=&text=&url=' }, { file: DRAFTS, probe: [pr(DRAFTS, 'consumeShareTarget')] }),
  r('share-link-to-webimport', 'contract', 'CONTRACT', ['D-58'], ['AD2'], { by: 'web-contract', name: 'isJustUrl → WebImport opens with the URL' }, { file: LP, probe: [pr(LP, 'isJustUrl')] }),
  r('share-add-to-logos', 'manifest', 'CONTRACT', ['D-59'], ['AD2', 'Q5'], { by: 'manifest', action: 'android.intent.action.SEND_MULTIPLE', mime: 'image/*' }, { file: MANIFEST, probe: [pr(MANIFEST, 'android.intent.action.SEND_MULTIPLE', 'image/*')], precondition: PC_ANDROID }),
  r('share-open-in-logos', 'manifest', 'CONTRACT', ['D-60'], ['AD2'], { by: 'manifest', action: 'android.intent.action.VIEW' }, { file: MANIFEST, probe: [pr(MANIFEST, 'android.intent.action.VIEW')], precondition: PC_ANDROID + '; narrower than share-add-to-logos — no image/*, no octet-stream' }),
  r('book-picker-accept', 'store', 'STORE', ['D-62', 'C-68'], ['Q5', 'AD2'], probeLoc('BOOK_ACCEPT accept-string'), { file: IMPORT_TS, probe: [pr(IMPORT_TS, 'BOOK_ACCEPT')] }),
  r('import-image-ocr', 'store', 'STORE', ['D-68', 'D-67'], ['AD2'], probeLoc('parseImage pipeline (scenario image fixture)'), { file: IMAGE_TS, probe: [pr(IMAGE_TS, 'parseImage')] }),
  r('import-image-cut-warn', 'store', 'STORE', ['D-70', 'D-71'], ['AD2', 'Q5'], probeLoc('BookMeta.warn on the imported scenario book'), { file: IMAGE_TS, probe: [pr(IMAGE_TS, 'raw.warn')] }),
  r('web-import', 'web', 'MINT', ['D-72', 'D-73'], ['AD2'], DP, { file: WEBIMP, precondition: PC_SHEET }),
  r('web-import-url', 'web', 'MINT', ['D-74', 'D-75'], ['AD2'], DP, { file: WEBIMP, precondition: 'WebImport input phase' }),
  r('web-import-go', 'web', 'MINT', ['D-74'], ['AD2'], DP, { file: WEBIMP, precondition: 'WebImport input phase (becomes "Try again" in the error phase)' }),
  r('web-import-paste', 'web', 'MINT', ['D-76'], ['AD2'], DP, { file: WEBIMP, precondition: 'WebImport input phase' }),
  r('web-import-loading', 'web', 'MINT', ['D-78'], ['AD2'], DP, { file: WEBIMP, precondition: 'WebImport loading phase' }),
  r('web-import-cancel', 'web', 'MINT', ['D-78'], ['AD2'], DP, { file: WEBIMP, precondition: 'WebImport loading phase' }),
  r('web-import-book-door', 'web', 'MINT', ['D-79', 'C-67'], ['AD2'], DP, { file: WEBIMP, precondition: 'the callbacks exist only when the sheet was opened from Library' }),
  r('web-import-audio-door', 'web', 'MINT', ['D-79', 'C-6'], ['AD2', 'AD6'], DP, { file: WEBIMP, precondition: 'the callbacks exist only when the sheet was opened from Library' }),
  r('web-import-ready', 'web', 'MINT', ['D-82'], ['AD2'], DP, { file: WEBIMP, precondition: 'WebImport ready phase' }),
  r('web-import-listen-now', 'web', 'MINT', ['D-83'], ['AD2'], DP, { file: WEBIMP, precondition: 'WebImport ready phase' }),
  r('web-import-later', 'web', 'MINT', ['D-84'], ['AD2'], DP, { file: WEBIMP, precondition: 'WebImport ready phase' }),
  r('web-import-save-audio', 'web', 'MINT', ['D-85'], ['AD2'], DP, { file: WEBIMP, precondition: 'WebImport ready phase' }),
  r('web-import-error', 'web', 'MINT', ['D-86'], ['AD2'], DP, { file: WEBIMP, precondition: 'WebImport error phase (a user\u2019s own Cancel never lands here — AbortError is swallowed)' }),
]

/* ------------------------------------------------------------------ */
/* 1J · Settings — src/pages/SettingsPage.tsx                           */
/* Universal precondition (registry §1J/§5): an interior anchor         */
/* resolves only after its owning card is unfolded — the runtime taps   */
/* the card's header anchor first. On wide screens the cards flow in    */
/* CSS columns, so a scene anchors the card, never a position.          */
/* ------------------------------------------------------------------ */

const unfold = (header: string): string => `unfold ${header} first (tap the card header; the fold is a declared resolution step)`

const J_SETTINGS: AnchorRecord[] = [
  r('set-page-head', 'web', 'MINT', ['E-1'], ['Q0', 'AD14'], DP, { file: SET }),
  r('set-neural', 'web', 'MINT', ['E-2', 'E-5'], ['AD14'], DP, { file: SET, precondition: 'card header / fold handle; the only card that arrives open' }),
  r('set-playback', 'web', 'MINT', ['E-2', 'E-20'], ['AD4', 'AD3'], DP, { file: SET, precondition: 'card header / fold handle' }),
  r('set-pron', 'web', 'MINT', ['E-2', 'E-26'], ['AD10'], DP, { file: SET, precondition: 'card header / fold handle' }),
  r('set-card-appearance', 'web', 'MINT', ['E-2'], ['AD14'], DP, { file: SET, precondition: 'card header / fold handle' }),
  r('set-card-language', 'web', 'MINT', ['E-2'], ['AD5'], DP, { file: SET, precondition: 'card header / fold handle' }),
  r('set-bubble', 'web', 'MINT', ['E-2', 'E-34'], ['AD11'], DP, { file: SET, precondition: 'card header / fold handle' }),
  r('set-backup', 'web', 'MINT', ['E-2', 'E-43'], ['AD14'], DP, { file: SET, precondition: 'card header / fold handle' }),
  r('set-about', 'web', 'MINT', ['E-49'], ['AD14'], DP, { file: SET, precondition: 'card header / fold handle' }),
  r('set-presentations', 'web', 'MINT', [], ['All'], DP, { file: SET, precondition: 'integration-time mint on the new Presentations SetCard (its own <section class="set-group"> between SettingsPage.tsx:317 and :318); arrives folded; return-from-module opens it' }),
  r('set-neural-status', 'web', 'MINT', ['E-6', 'E-8', 'E-9'], ['AD14', 'AD5'], DP, { file: SET, precondition: 'inside set-neural (arrives open); the face is read from the engine store' }),
  r('set-neural-meter', 'web', 'MINT', ['E-7'], ['AD14'], DP, { file: SET, precondition: 'exists only while downloading' }),
  r('set-neural-error', 'web', 'MINT', ['E-10'], ['AD14'], DP, { file: SET, precondition: 'error state only' }),
  r('set-neural-download', 'web', 'MINT', ['E-11'], ['AD14'], DP, { file: SET, precondition: 'absent while Ready or warming' }),
  r('set-neural-delete', 'web', 'MINT', ['E-12'], ['AD14'], DP, { file: SET, precondition: 'a serious door: confirming ends the session first; its confirm is shell-confirm-host' }),
  r('set-storage-row', 'web', 'MINT', ['E-13', 'E-14', 'E-15'], ['AD14'], DP, { file: SET, precondition: unfold('set-neural') }),
  r('set-storage-note', 'web', 'MINT', ['E-16'], ['AD14'], DP, { file: SET, precondition: 'exists only when keep.ts has something to say' }),
  r('set-storage-protect', 'web', 'MINT', ['E-17'], ['AD14'], DP, { file: SET, precondition: 'browser only, and only while unpersisted — in the Android app this anchor never resolves and scenes must not point at it' }),
  r('set-auto-download', 'web', 'MINT', ['E-18'], ['AD14'], DP, { file: SET, precondition: unfold('set-neural') }),
  r('set-device-bridge', 'web', 'MINT', ['E-19'], ['AD14'], DP, { file: SET, precondition: 'browser only — the row does not exist in the app' }),
  r('set-speed', 'web', 'MINT', ['E-21'], ['AD4'], DP, { file: SET, precondition: unfold('set-playback') }),
  r('set-sentence-pause', 'web', 'MINT', ['E-22'], ['AD4'], DP, { file: SET, precondition: unfold('set-playback') }),
  r('set-highlight', 'web', 'MINT', ['E-23'], ['AD3'], DP, { file: SET, precondition: unfold('set-playback') + '; its effect is read in the reader (listen-reader), never on this row' }),
  r('set-reader-size', 'web', 'MINT', ['E-24'], ['AD3'], DP, { file: SET, precondition: unfold('set-playback') }),
  r('set-reader-size-minus', 'web', 'MINT', ['E-24'], ['AD3'], DP, { file: SET, precondition: unfold('set-playback') }),
  r('set-reader-size-reset', 'web', 'MINT', ['E-24'], ['AD3'], DP, { file: SET, precondition: unfold('set-playback') }),
  r('set-reader-size-plus', 'web', 'MINT', ['E-24'], ['AD3'], DP, { file: SET, precondition: unfold('set-playback') }),
  r('set-word-timing', 'web', 'MINT', ['E-25'], ['AD3'], DP, { file: SET, precondition: unfold('set-playback') }),
  r('set-word-timing-minus', 'web', 'MINT', ['E-25'], ['AD3'], DP, { file: SET, precondition: unfold('set-playback') }),
  r('set-word-timing-reset', 'web', 'MINT', ['E-25'], ['AD3'], DP, { file: SET, precondition: unfold('set-playback') }),
  r('set-word-timing-plus', 'web', 'MINT', ['E-25'], ['AD3'], DP, { file: SET, precondition: unfold('set-playback') }),
  r('set-pron-scope', 'web', 'MINT', ['E-27'], ['AD10'], DP, { file: SET, precondition: unfold('set-pron') }),
  r('set-pron-from', 'web', 'MINT', ['E-28'], ['AD10'], DP, { file: SET, precondition: unfold('set-pron') }),
  r('set-pron-to', 'web', 'MINT', ['E-28'], ['AD10'], DP, { file: SET, precondition: unfold('set-pron') }),
  r('set-pron-add', 'web', 'MINT', ['E-28', 'E-29', 'F-50'], ['AD10'], DP, { file: SET, precondition: unfold('set-pron') }),
  r('set-pron-entry', 'web', 'MINT', ['E-30'], ['AD10'], DP, { file: SET, family: 'entry', precondition: unfold('set-pron') }),
  r('set-pron-remove', 'web', 'MINT', ['E-30'], ['AD10'], DP, { file: SET, precondition: unfold('set-pron') + '; instant — no confirm, no Undo' }),
  r('set-theme', 'web', 'MINT', ['E-32', 'F-32', 'F-34'], ['AD14'], DP, { file: SET, precondition: unfold('set-card-appearance') }),
  r('set-theme:{dark|light|system}', 'web', 'MINT', ['E-32'], ['AD14'], DP, { file: SET, family: 'dark|light|system', precondition: unfold('set-card-appearance') }),
  r('set-ui-lang', 'web', 'MINT', ['E-33'], ['AD5'], DP, { file: SET, precondition: unfold('set-card-language') }),
  r('set-ui-lang:{en|es}', 'web', 'MINT', ['E-33'], ['AD5'], DP, { file: SET, family: 'en|es', companion: 'data-lang', precondition: unfold('set-card-language') }),
  r('set-bubble-switch', 'web', 'MINT', ['E-35', 'E-36', 'E-37', 'E-38', 'B-49'], ['AD11', 'Q2'], DP, { file: SET, precondition: unfold('set-bubble') }),
  r('set-bubble-desc', 'web', 'MINT', ['E-35', 'E-36', 'E-37'], ['AD11'], DP, { file: SET, precondition: unfold('set-bubble') }),
  r('set-bubble-auto', 'web', 'MINT', ['E-39', 'B-50', 'B-22'], ['AD11', 'Q2'], DP, { file: SET, precondition: unfold('set-bubble') }),
  r('set-bubble-text', 'web', 'MINT', ['E-40', 'B-51'], ['AD11', 'AD1'], DP, { file: SET, precondition: unfold('set-bubble') }),
  r('set-bubble-last', 'web', 'MINT', ['E-41', 'B-52'], ['AD11'], DP, { file: SET, precondition: 'rendered only when the native state carries a last' }),
  r('set-bubble-journal', 'web', 'MINT', ['E-42', 'B-52'], ['AD11'], DP, { file: SET, precondition: 'rendered only when the stage journal has content; named in a lesson, never operated' }),
  r('set-backup-export', 'web', 'MINT', ['E-44', 'E-45', 'E-46'], ['AD14'], DP, { file: SET, precondition: unfold('set-backup') }),
  r('set-backup-import', 'web', 'MINT', ['E-47', 'E-48'], ['AD14'], DP, { file: SET, precondition: unfold('set-backup') }),
  r('set-version', 'web', 'MINT', ['E-50'], ['AD14'], DP, { file: SET }),
]

/* ------------------------------------------------------------------ */
/* 1K · Shell, desk and house patterns                                  */
/* ------------------------------------------------------------------ */

const PC_MINI = 'only with a live session, and never on listen or book routes'

const K_SHELL: AnchorRecord[] = [
  r('shell-nav:{route}', 'web', 'MINT', ['F-1', 'F-3'], ['Q0', 'AD13'], DP, { file: CH, family: 'route', companion: 'data-route', precondition: 'one component, two seats — resolve the visible seat (bottom nav <840px, rail ≥840px); on route book the phone seat is hidden' }),
  r('shell-bottomnav', 'web', 'MINT', ['F-2', 'F-3'], ['Q0'], DP, { file: CH, precondition: '<840px only' }),
  r('shell-rail', 'web', 'MINT', ['F-2', 'F-24'], ['AD13'], DP, { file: CH, precondition: '≥840px only' }),
  r('shell-brand-home', 'web', 'MINT', ['F-5'], ['Q0'], DP, { file: CH, precondition: 'two seats (App.tsx topbar, chrome.tsx rail) — resolve the visible one; not the λ' }),
  r('shell-status-pill', 'web', 'MINT', ['F-9', 'F-10', 'F-11', 'F-13', 'A-12'], ['AD14', 'Q0'], DP, { file: CH, precondition: 'one anchor, three seats — resolve the visible pill, never a fixed seat; its idle face\u2019s tap downloads the model (it does not navigate), so scenes read the face from the engine store before scripting a tap' }),
  r('shell-miniplayer', 'web', 'CLASS', ['F-14', 'F-15', 'F-16', 'A-52', 'A-53'], ['AD3'], cls('.mini'), { file: CH, probe: [pr(CH, 'className="mini"')], precondition: PC_MINI }),
  r('shell-mini-prev', 'web', 'MINT', ['F-15'], ['AD3'], DP, { file: CH, precondition: PC_MINI }),
  r('shell-mini-toggle', 'web', 'MINT', ['F-15'], ['AD3'], DP, { file: CH, precondition: PC_MINI }),
  r('shell-mini-next', 'web', 'MINT', ['F-15'], ['AD3'], DP, { file: CH, precondition: PC_MINI }),
  r('shell-mini-progress', 'web', 'CLASS', ['F-15', 'A-54'], ['AD3'], cls('.mini-prog'), { file: CH, probe: [pr(CH, 'mini-prog')], precondition: PC_MINI }),
  r('shell-sheet', 'web', 'MINT', ['F-37', 'F-38', 'F-49'], ['Engine'], DP, { file: UI }),
  r('shell-sheet-scrim', 'web', 'MINT', ['F-37'], ['Engine'], DP, { file: UI }),
  r('shell-toast-region', 'web', 'CLASS', ['F-39'], ['Engine', 'AD6', 'AD14'], cls('.toasts'), { file: UI, probe: [pr(UI, 'toasts')] }),
  r('shell-confirm-host', 'web', 'MINT', ['F-40', 'C-25', 'C-34', 'C-47', 'C-66', 'E-12'], ['AD14', 'AD6', 'AD9'], DP, { file: UI }),
  r('desk-tablet', 'web', 'MINT', ['F-25'], ['AD13'], DP, { file: DESK, precondition: PC_1100 }),
  r('desk-book', 'web', 'MINT', ['F-25'], ['AD13'], DP, { file: DESK, precondition: PC_1100 }),
  r('desk-fav-voices', 'web', 'MINT', ['F-25'], ['AD13'], DP, { file: DESK, precondition: PC_1100 + '; also hidden when viewport height ≤900px' }),
  r('desk-recent', 'web', 'MINT', ['F-25'], ['AD13'], DP, { file: DESK, precondition: PC_1100 }),
  r('desk-textmap-stats', 'web', 'MINT', ['F-27'], ['AD13'], DP, { file: DESK, precondition: PC_1500 }),
  r('desk-textmap-paragraphs', 'web', 'MINT', ['F-27'], ['AD13'], DP, { file: DESK, precondition: 'retired at 1.4.167 — the real card now shows favourite books and carries no mint; no element carries this mint anywhere (the M-36 cure: the record survives so AD13’s beat resolves as a declared miss until the script is refreshed)' }),
]

/* ------------------------------------------------------------------ */
/* The registry                                                         */
/* ------------------------------------------------------------------ */

export const ANCHORS: AnchorRecord[] = [
  ...A_LISTEN,
  ...B_STAGE,
  ...C_CONTRACT,
  ...D_SAVED,
  ...E_BOOKS,
  ...F_BOOK,
  ...G_VOICES,
  ...H_CREATE,
  ...I_SHARE,
  ...J_SETTINGS,
  ...K_SHELL,
]

const BY_ID = new Map<string, AnchorRecord>(ANCHORS.map((a) => [a.id, a]))

export function anchorById(id: string): AnchorRecord | null {
  return BY_ID.get(id) ?? null
}

/**
 * Family-aware lookup (integration amendment, 1.4.166 — the canon
 * integration closes this seam): a step may name a CONCRETE family
 * member (`shell-nav:listen`, `voice-card:<id>:star`) while the
 * registry holds the template (`shell-nav:{route}`). An exact hit
 * wins; otherwise each template with the same segment shape is
 * matched segment by segment, `{param}` segments capturing the
 * concrete value. Every template in the registry carries exactly
 * one parameter, which becomes the resolution param (the caller's
 * explicit param, when present, still wins).
 */
export function anchorRecordFor(id: string): { record: AnchorRecord; param?: string } | null {
  const exact = BY_ID.get(id)
  if (exact) return { record: exact }
  const parts = id.split(':')
  for (const rec of ANCHORS) {
    if (!rec.id.includes('{')) continue
    const tparts = rec.id.split(':')
    if (tparts.length !== parts.length) continue
    let param: string | undefined
    let ok = true
    for (let i = 0; i < tparts.length; i++) {
      if (tparts[i].startsWith('{') && tparts[i].endsWith('}')) { param = parts[i]; continue }
      if (tparts[i] !== parts[i]) { ok = false; break }
    }
    if (ok) return { record: rec, param }
  }
  return null
}

export function anchorsForModule(module: string): AnchorRecord[] {
  return ANCHORS.filter((a) => a.modules.includes(module))
}

export function anchorsServing(censusItem: string): AnchorRecord[] {
  return ANCHORS.filter((a) => a.items.includes(censusItem))
}

/* ------------------------------------------------------------------ */
/* The resolver (FENCE-DESIGN §7).                                      */
/*                                                                      */
/* Resolve late, resolve live: an anchor is resolved at the moment its  */
/* step is about to render — never pre-resolved, never cached. Each     */
/* record declares exactly ONE locator; the resolver uses that locator  */
/* and nothing else. There is no fallback locator and no coordinate     */
/* fallback, ever. A miss — absent, or ambiguous (>1 match) — returns   */
/* a failed Resolution and the caller skips + logs (§7 clause 3/4).     */
/* A record's `precondition` is performed by the caller as a declared   */
/* resolution step BEFORE calling resolve; it is not handled here and   */
/* is never improvised inside the resolver.                             */
/* ------------------------------------------------------------------ */

export interface ElementLike {
  getAttribute(name: string): string | null
  /** Optional visibility signals (real DOM elements carry them all).
   *  A resolver probe element that carries none is taken at face value:
   *  visibility can only ever REMOVE a match a signal proves hidden,
   *  never invent one. */
  hidden?: boolean
  checkVisibility?: () => boolean
  getBoundingClientRect?: () => { width: number; height: number }
}

export interface RootLike {
  querySelectorAll(selector: string): ArrayLike<ElementLike>
}

export type Resolution<T> =
  | { ok: true; value: T }
  | { ok: false; anchor: string; reason: string }

function miss<T>(rec: AnchorRecord, reason: string): Resolution<T> {
  return { ok: false, anchor: rec.id, reason }
}

function esc(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * The `data-present` value a parameterized mint writes: the family name —
 * the id with its {parameter} segment removed
 * (`voice-card:{voiceId}:star` → `voice-card:star`).
 */
export function dataPresentValue(id: string): string {
  return id.replace(/\{[^}]*\}/g, '').replace(/::/g, ':').replace(/:$/, '')
}

/**
 * True when a web anchor lives ONLY on the sealed fiction stage (its
 * owning file is the stage itself, and its precondition says so): no
 * element for it can ever exist in the real app, so a real-app landing
 * (search «Go», a stay-here landing) must treat it as unlandable by
 * design rather than polling for an element that cannot be there.
 */
export function isStageOnlyAnchor(rec: AnchorRecord): boolean {
  return (rec.file?.includes('fiction stage') ?? false) || (rec.precondition?.includes('sealed fiction stage') ?? false)
}

/**
 * The Settings card a record's precondition says to unfold first, or
 * null. The runtime precondition strings are built by the `unfold()`
 * helper above and read `unfold <header-id> first (tap the card
 * header; …)` — the header id is the bare second word, unquoted.
 */
export function unfoldHeaderId(rec: AnchorRecord): string | null {
  const match = rec.precondition?.match(/^unfold\s+(\S+)\s+first\b/)
  return match ? match[1] : null
}

function exactlyOnce<T extends ElementLike>(rec: AnchorRecord, matches: ArrayLike<T>): Resolution<T> {
  if (matches.length === 1) return { ok: true, value: matches[0] }
  if (matches.length === 0) return miss(rec, 'missing')
  return miss(rec, 'ambiguous')
}

/**
 * Visibility (the T6-10 cure): the resolver used to count DOM presence
 * only, so an element CSS hides — the stage rail and the Listen desk
 * below their breakpoints, a seat the viewport swaps out — "resolved"
 * and the focus hole painted around a 0×0 rect on nothing. An element
 * is visible unless a signal it carries proves it hidden: the `hidden`
 * property, `checkVisibility()` answering false, or a collapsed
 * (0×0) bounding rect — the shape `display: none` leaves behind.
 * Elements carrying no signal at all (plain probe fakes) stay visible:
 * the check removes only what is PROVEN hidden.
 */
export function isAnchorElementVisible(el: ElementLike): boolean {
  if (el.hidden === true) return false
  if (typeof el.checkVisibility === 'function') {
    try {
      if (!el.checkVisibility()) return false
    } catch { /* a throwing probe proves nothing either way */ }
  }
  if (typeof el.getBoundingClientRect === 'function') {
    try {
      const rect = el.getBoundingClientRect()
      if (rect && rect.width === 0 && rect.height === 0) return false
    } catch { /* as above */ }
  }
  return true
}

/**
 * Exactly-once over the VISIBLE matches: hidden seats are not matches
 * at all (the registry's own "resolve the visible one" for multi-seat
 * anchors — shell-status-pill, shell-brand-home, the nav's two seats),
 * several visible matches are the ambiguity miss the law declares,
 * and matches that ALL prove hidden are their own declared miss
 * ('not-visible'), never a resolution onto nothing.
 */
function visibleOnce<T extends ElementLike>(rec: AnchorRecord, matches: ArrayLike<T>): Resolution<T> {
  const all: T[] = []
  for (let i = 0; i < matches.length; i++) all.push(matches[i])
  const visible = all.filter((el) => isAnchorElementVisible(el))
  if (visible.length === 0 && all.length > 0) return miss(rec, 'not-visible')
  return exactlyOnce(rec, visible)
}

/**
 * Resolve a `web` anchor against a root (the app root, or a subtree the
 * caller scoped — e.g. inside `.reader`, or one card of a family).
 * Exactly-once semantics: 0 matches = missing, >1 = ambiguous, both are
 * misses. For a parameterized family with a recorded companion attribute,
 * the parameter selects through that attribute; without one, a parameter
 * can only resolve when exactly one family member is rendered in scope.
 */
export function resolveWeb(root: RootLike, rec: AnchorRecord, param?: string): Resolution<ElementLike> {
  const loc = rec.locator
  if (loc.by === 'data-present') {
    let selector = `[data-present="${esc(dataPresentValue(rec.id))}"]`
    if (param !== undefined && rec.companion) selector += `[${rec.companion}="${esc(param)}"]`
    return visibleOnce(rec, root.querySelectorAll(selector))
  }
  if (loc.by === 'class') {
    return visibleOnce(rec, root.querySelectorAll(loc.selector))
  }
  if (loc.by === 'existing-attr') {
    // A tag-qualified record (voice-picker-group:{key} — the T6-9 cure)
    // names ONE element kind carrying the attribute; unqualified records
    // keep the bare attribute selector they have always used.
    const tag = loc.tag ?? ''
    const selector = param !== undefined ? `${tag}[${loc.attr}="${esc(param)}"]` : `${tag}[${loc.attr}]`
    return visibleOnce(rec, root.querySelectorAll(selector))
  }
  return miss(rec, 'not-a-web-locator')
}

/** The runtime environment a contract resolution probes. */
export interface ContractEnv {
  /** bubbleSupported(): a shell new enough to carry the bubble is present. */
  supported: boolean
  /** The LogosAndroid bridge object, when present. */
  bridge?: Record<string, unknown> | null
  /** The latest bubbleNow pushed state, when a session is live. */
  pushedState?: Record<string, unknown> | null
}

/**
 * Resolve a `contract` / `manifest` anchor. Commands are events, not
 * elements: their runtime presence is the shell-support probe (§7 clause
 * 6) — an absent shell side is a miss, and the lesson stops honestly
 * rather than pointing at a panel that isn't there. Bridge anchors probe
 * the named method; pushed-state anchors probe the named fields of the
 * latest bubbleNow state. On the fiction stage, the caller passes the
 * stage's contract stub as this environment, by the same ids.
 */
export function resolveContract(rec: AnchorRecord, env: ContractEnv): Resolution<true> {
  const loc = rec.locator
  if (loc.by === 'bridge') {
    return typeof env.bridge?.[loc.name] === 'function' ? { ok: true, value: true } : miss(rec, 'no-shell')
  }
  if (loc.by === 'push-fields') {
    const state = env.pushedState
    if (!state) return miss(rec, 'missing')
    return loc.names.every((n) => n in state) ? { ok: true, value: true } : miss(rec, 'missing')
  }
  if (loc.by === 'command' || loc.by === 'commands' || loc.by === 'intent-extra') {
    return env.supported ? { ok: true, value: true } : miss(rec, 'no-shell')
  }
  if (loc.by === 'manifest') {
    // A manifest door exists at install time; inside the app its presence
    // is the shell itself. Outside the app it cannot be pointed at.
    return env.supported ? { ok: true, value: true } : miss(rec, 'no-shell')
  }
  if (loc.by === 'web-contract') {
    // A contract the page itself implements (share target, link fork):
    // resolvable wherever the page runs.
    return { ok: true, value: true }
  }
  if (loc.by === 'probe') {
    // A state face read from the pushed state (e.g. the clip stage).
    return env.pushedState ? { ok: true, value: true } : miss(rec, 'missing')
  }
  return miss(rec, 'not-a-contract-locator')
}

/** Named store/pipeline probes, supplied by the caller (integrator-wired). */
export type StoreProbes = Record<string, () => unknown>

/**
 * Resolve a `store` anchor through its named probe. A probe that is not
 * registered, or that returns null/undefined/false, is a miss — the
 * resolver never substitutes a DOM guess for a store fact.
 */
export function resolveStore(rec: AnchorRecord, probes: StoreProbes): Resolution<unknown> {
  const loc = rec.locator
  if (loc.by !== 'probe') return miss(rec, 'not-a-store-locator')
  const fn = probes[loc.name]
  if (!fn) return miss(rec, 'no-probe-registered')
  const value = fn()
  return value !== null && value !== undefined && value !== false
    ? { ok: true, value }
    : miss(rec, 'probe-false')
}

/* ------------------------------------------------------------------ */
/* The stay-here landing (the T6-12 cure).                            */
/*                                                                    */
/* On a stay-here exit the host lands the learner on the REAL element */
/* the final beat was standing on. The old landing queried            */
/* `[data-present="<raw step anchor id>"]` — a selector that cannot   */
/* match any concrete family id (the real value is the family name    */
/* PLUS its companion attribute), any CLASS anchor (no data-present   */
/* in the real app at all), any EXISTING anchor, and every contract / */
/* store / stage-only anchor: 96 of the 310 script anchor ids could   */
/* never land, silently, and plain multi-seat anchors took the first  */
/* DOM seat regardless of visibility. The landing now resolves        */
/* through the registry's own semantics — resolveWeb, exactly as the  */
/* engine and search «Go» resolve — and every outcome is DECLARED:    */
/* 'landed' carries the one visible element, and 'unlandable' names   */
/* its reason (not a web anchor, stage-only by design, missing,       */
/* ambiguous, not-visible) instead of scrolling nowhere in silence.   */
/* ------------------------------------------------------------------ */

export type StayHereLanding =
  | { status: 'landed'; record: AnchorRecord; element: ElementLike }
  | { status: 'unlandable'; anchorId: string; reason: string }

export function resolveStayHereLanding(root: RootLike, anchorId: string): StayHereLanding {
  const found = anchorRecordFor(anchorId)
  if (!found) return { status: 'unlandable', anchorId, reason: 'not-in-registry' }
  if (found.record.kind !== 'web') return { status: 'unlandable', anchorId, reason: 'not-a-web-anchor' }
  if (isStageOnlyAnchor(found.record)) return { status: 'unlandable', anchorId, reason: 'stage-only' }
  const res = resolveWeb(root, found.record, found.param)
  if (!res.ok) return { status: 'unlandable', anchorId, reason: res.reason }
  return { status: 'landed', record: found.record, element: res.value }
}

/* ------------------------------------------------------------------ */
/* The skip log (FENCE-DESIGN §7 clause 4). In-memory per session,      */
/* persisted with the module state in the presentation's own key —      */
/* never in a user store, never leaves the device on its own.           */
/* ------------------------------------------------------------------ */

export interface SkipLogEntry {
  module: string
  scene: string
  step: number
  anchor: string
  reason: string
  appVersion: string
  shellVersion?: string
  at: number
}

export function makeSkipLogEntry(entry: Omit<SkipLogEntry, 'at'>): SkipLogEntry {
  return { ...entry, at: Date.now() }
}

/** Pure append: returns a new log with the entry added. */
export function logSkip(log: readonly SkipLogEntry[], entry: SkipLogEntry): SkipLogEntry[] {
  return [...log, entry]
}
