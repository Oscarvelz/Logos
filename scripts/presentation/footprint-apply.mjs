/**
 * footprint-apply.mjs — Ruling 2 (Oscar, 2026-11-15: «Nada debe
 * bloquear aquello que se está mostrando») applied to the scripts.
 *
 * THE CLASSIFICATION of every PERFORMED step (act ∈ tap / type / key /
 * scroll / hover / goto) in the 20 modules, decided from the census
 * (footprint-audit.mjs) and each step's own caption:
 *
 *   EFF  — the effect plays in a distinct, anchorable region:
 *          `effectAnchorId` is added (the player seats the card
 *          against control ∪ effect; a union over the 70% cap falls
 *          back to the subject-box treatment automatically).
 *   PRE  — already carried its footprint from the 18-principles wave.
 *   SELF — the effect lands on the acted element itself (its state,
 *          its own field, its own card): the act hole already frames
 *          it in normal colour; nothing distinct exists to unblock.
 *   NAV  — a goto (or a tap whose whole act is navigation): the
 *          demonstrated thing is the destination surface, which the
 *          anchor itself names; the next beat frames its own focus.
 *   EXC  — the effect region genuinely has no anchor (listed with its
 *          reason). Coverage is never faked.
 *
 * The script refuses to run unless the table covers the live census
 * EXACTLY (every performed step, once), every EFF anchor is
 * registered, and no EFF equals its step's own anchorId. It inserts
 * `effectAnchorId` directly after the step's `anchorId` line.
 *
 * Run: node scripts/presentation/footprint-apply.mjs [--dry]
 *
 * NOTE (application record, 2026-11-15): the first run inserted 148
 * lines; ONE landed wrong — q3-pick-row's anchorId is a template
 * literal (`` `voice-picker-row:${JUNIPER}` ``), which the original
 * single-quote regex missed, so its line slid onto the following say
 * step (q3-revoice-consequence). Both were corrected by hand the same
 * day and verified step-by-step; the regex below now accepts both
 * quote forms. The script remains one-shot by design: its census
 * cross-check refuses a second run.
 *
 * NOTE (maintenance, 2026-11-21): canon 1.4.200 removed the Voices
 * page filter chips, so the step this table knew as 'q3-filter-pocket'
 * was renamed 'q3-section-pocket' in the same wave's remap (anchor
 * voices-section-head:pocket, same EFF footprint on voices-grid). The
 * table key above follows the live script; the 2026-11-15 run itself
 * is unchanged history.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { MODULE_CATALOGUE } from '../../src/lib/presentation/catalogue.ts'
import { flattenSteps, isRegisteredAnchorId } from '../../src/lib/presentation/engine/types.ts'
import '../../src/lib/presentation/scripts/index.ts'

const DRY = process.argv.includes('--dry')
const PERFORMED = new Set(['tap', 'type', 'key', 'scroll', 'hover', 'goto'])
const R = 'listen-reader'

/** stepId → ['EFF', anchor] | ['SELF'] | ['NAV'] | ['EXC', reason] | ['PRE'] */
export const CLASSIFICATION = {
  'q0.ts': {
    'q0-paste': ['EFF', R],
    'q0-tap-word': ['EFF', R],
    'q0-open-voices': ['EFF', 'voice-picker'],
    'q0-pick-voice': ['EFF', R],
    'q0-open-keep': ['EFF', 'listen-keep-sheet'],
    'q0-keep-audio': ['EXC', 'the render finishes off-surface; the file waits in the Library'],
    'q0-lambda-tap': ['SELF'],
    'q0-free-start': ['NAV'],
  },
  'q1.ts': {
    'q1-bring-type': ['SELF'],
    'q1-paste-tap': ['EFF', R],
    'q1-clear-tap': ['EFF', 'listen-editor'],
    'q1-play-tap': ['EFF', R],
    'q1-play-pause': ['EFF', R],
    'q1-reader-follow': ['SELF'],
    'q1-tap-word': ['EFF', R],
    'q1-scrub-drag': ['EFF', R],
    'q1-prev-tap': ['EFF', R],
    'q1-next-tap': ['EFF', R],
    'q1-end-tap': ['EFF', R],
  },
  'q2.ts': {
    's1-tap-lambda': ['SELF'],
    's2-drag': ['SELF'],
    's2-open-panel': ['EFF', 'bubble-stage-panel'],
    's3-setup-playing': ['NAV'],
    's3-tap-bubble': ['PRE'],
    's3-undo-tap': ['EFF', 'bubble-stage-panel'],
    's3-play-again': ['NAV'],
    's3-replace-again': ['EFF', 'bubble-stage-panel'],
    's3-advance-clip': ['EFF', R],
  },
  'q3.ts': {
    'q3-play-fiction': ['EFF', R],
    'q3-chip-opens-picker': ['EFF', 'voice-picker'],
    'q3-open-group': ['EFF', 'voice-picker-group:en-US'],
    'q3-preview-button': ['SELF'],
    'q3-pick-row': ['EFF', R],
    'q3-goto-voices': ['NAV'],
    'q3-section-pocket': ['EFF', 'voices-grid'],
    'q3-card-preview': ['SELF'],
    'q3-star-juniper': ['SELF'],
    'q3-back-to-picker': ['EFF', 'voice-picker'],
    'q3-open-favorites-group': ['EFF', 'voice-picker-group:fav'],
    'q3-picker-star': ['SELF'],
    'q3-make-default-marcos': ['SELF'],
  },
  'q4.ts': {
    'keep-open-from-reader': ['EFF', 'listen-keep-sheet'],
    'keep-audio': ['EXC', 'the render finishes off-surface; the file waits in the Library'],
    'keep-later': ['EXC', 'the kept text lives in the Library; no region on this surface changes'],
    'shelf-goto': ['NAV'],
    'shelf-search': ['EFF', 'lib-clip-card'],
    'shelf-filters': ['EFF', 'lib-clip-card'],
    'card-audio-play': ['SELF'],
    'card-text-listen': ['EFF', R],
    'card-fav': ['SELF'],
    'make-audio': ['EFF', 'lib-render-card'],
    'mark-goto-listen': ['NAV'],
    'mark-tap': ['EFF', R],
    'mark-goto-library': ['NAV'],
    'continue-goto': ['NAV'],
    'continue-clip-audio': ['EFF', R],
  },
  'q5.ts': {
    'q5-import-tap': ['EFF', 'bk-keepask'],
    'q5-keep-tap': ['EFF', 'bk-tile'],
    'q5-badge-is-switch': ['SELF'],
    'q5-shelf-search': ['EFF', 'bk-tile'],
    'q5-search-clear': ['EFF', 'bk-tile'],
    'q5-filters': ['EFF', 'bk-tile'],
    'q5-cover-sizes': ['EFF', 'bk-tile'],
    'q5-continue-tap': ['EFF', 'book-page'],
    'q5-contents-open': ['EFF', 'book-side-toc'],
    'q5-contents-jump': ['EFF', 'book-page'],
    'q5-scrolling-is-place': ['SELF'],
    'q5-next-card': ['EFF', 'book-page'],
    'q5-paragraph-tap': ['EFF', 'book-actions'],
    'q5-bookmark-it': ['SELF'],
    'q5-paragraph-again': ['EFF', 'book-actions'],
    'q5-listen-from-here': ['EFF', 'book-page'],
  },
  'ad1.ts': {
    's2-remove': ['SELF'],
    's2-open-logos': ['EXC', 'Logos opens at the text — a destination surface, not a region on the panel stage'],
    's2-wake': ['SELF'],
    's2-wheel': ['SELF'],
    's3-setup': ['NAV'],
    's3-scroll-vertical': ['SELF'],
    's3-scrub-sideways': ['SELF'],
    's3-seek-bar': ['EFF', 'bubble-stage-words'],
    's3-grip': ['EFF', 'bubble-stage-panel'],
    's3-arrival': ['EFF', 'bubble-stage-words'],
    's4-prev': ['EFF', 'bubble-stage-words'],
    's4-next': ['EFF', 'bubble-stage-words'],
    's4-pause-named': ['EFF', 'bubble-stage-words'],
    's4-speed-minus': ['EFF', 'bubble-stage-words'],
    's4-speed-plus': ['EFF', 'bubble-stage-words'],
    's5-mark-saved': ['EXC', 'the mark lands in the Library shelf (taught in Q4/AD9); no panel region changes'],
    's5-save-tap': ['EXC', 'the saved text lives in the Library; panel feedback is the contract state bubble-panel-state, which has no element'],
    's5-lock-card': ['PRE'],
    's5-auto-same': ['SELF'],
    's6-headphones': ['EXC', 'the panel folds and Logos opens at the text — a destination surface'],
    's6-eye': ['EFF', 'shell-confirm-host'],
    's7-skip': ['EFF', 'bubble-stage-words'],
    's7-unlock': ['PRE'],
  },
  'ad2.ts': {
    'ad2-share-text-tap': ['EXC', 'the share completes inside Logos; playback lands on Listen\u2019s surface, not the share surface'],
    'ad2-share-link-tap': ['EFF', 'web-import'],
    'ad2-files-import-tap': ['EFF', 'bk-tile'],
    'ad2-photo-ocr-tap': ['EXC', 'the recognized text lands in Listen; nothing on the import surface shows it'],
    'ad2-web-paste-tap': ['EFF', 'web-import-url'],
    'ad2-web-type-address': ['SELF'],
    'ad2-web-go-tap': ['EFF', 'web-import-loading'],
    'ad2-web-cancel-tap': ['SELF'],
    'ad2-web-listen-now-tap': ['EXC', 'it loads and plays inside Listen, off this sheet'],
    'ad2-web-later-tap': ['EXC', 'it files into the Library, off this sheet'],
    'ad2-web-audio-tap': ['EXC', 'it renders without opening Listen; this sheet has no render-region anchor'],
    'ad2-web-book-door': ['EXC', 'the system file picker — a surface outside the app'],
    'ad2-web-audio-door': ['EXC', 'the system file picker — a surface outside the app'],
    'ad2-pasted-type': ['EFF', 'listen-url-banner'],
    'ad2-pasted-banner-tap': ['EFF', 'web-import'],
  },
  'ad3.ts': {
    'ad3-play-fiction': ['EFF', R],
    'ad3-goto-settings': ['NAV'],
    'ad3-highlight-off': ['PRE'],
    'ad3-back-to-listen': ['NAV'],
    'ad3-restore-goto': ['NAV'],
    'ad3-highlight-on': ['PRE'],
    'ad3-light-home': ['NAV'],
    'ad3-bigger': ['EFF', R],
    'ad3-smaller': ['EFF', R],
    'ad3-size-settings-goto': ['NAV'],
    'ad3-size-stepper': ['EFF', R],
    'ad3-timing-plus': ['EFF', R],
    'ad3-timing-home': ['NAV'],
    'ad3-tap-word': ['EFF', R],
    'ad3-enter': ['EFF', R],
    'ad3-seek-drag': ['EFF', R],
    'ad3-seek-pause': ['EFF', R],
    'ad3-seek-paused-drag': ['EFF', R],
    'ad3-seek-resume': ['EFF', R],
    'ad3-edit-tap': ['EFF', 'listen-editor'],
    'ad3-edit-back': ['EFF', R],
    'ad3-pin-tap': ['SELF'],
    'ad3-pin-again': ['SELF'],
    'ad3-mini-goto': ['NAV'],
    'ad3-mini-next': ['EXC', 'it steps sentences inside Listen — not visible on the Library surface; the mini player\u2019s own keys are what is framed'],
    'ad3-mini-body': ['NAV'],
    'ad3-key-space': ['EFF', R],
    'ad3-key-right': ['EFF', R],
    'ad3-key-left': ['EFF', R],
    'ad3-key-scrubber': ['EFF', R],
  },
  'ad4.ts': {
    'ad4-play-fiction': ['EFF', R],
    'ad4-speed-chip-tap': ['EFF', 'listen-speed-sheet'],
    'ad4-speed-pick': ['EFF', R],
    'ad4-goto-settings': ['NAV'],
    'ad4-set-playback': ['SELF'],
    'ad4-goto-listen': ['NAV'],
    'ad4-sleep-chip-tap': ['EFF', 'listen-sleep-sheet'],
    'ad4-sleep-set': ['EFF', 'listen-sleep-chip'],
  },
  'ad5.ts': {
    'ad5-type-mixed': ['SELF'],
    'ad5-play-mixed': ['EFF', R],
    'ad5-tap-english': ['PRE'],
    'ad5-tap-spanish': ['PRE'],
    'ad5-tap-auto': ['PRE'],
    'ad5-open-picker': ['EFF', 'voice-picker'],
    'ad5-goto-language-card': ['NAV'],
    'ad5-unfold-language': ['SELF'],
  },
  'ad6.ts': {
    'ad6-goto-library': ['NAV'],
    'ad6-search-type': ['EFF', 'lib-clip-card'],
    'ad6-filters': ['EFF', 'lib-clip-card'],
    'ad6-filter-done': ['EFF', 'lib-clip-card'],
    'ad6-sort': ['EFF', 'lib-clip-card'],
    'ad6-nomatch-type': ['EFF', 'lib-saved-nomatch'],
    'ad6-search-clear': ['EFF', 'lib-clip-card'],
    'ad6-select-door': ['EFF', 'lib-selbar'],
    'ad6-select-longpress': ['EFF', 'lib-selbar'],
    'ad6-sel-all': ['EFF', 'lib-clip-card'],
    'ad6-sel-fav': ['EFF', 'lib-clip-card'],
    'ad6-sel-done': ['EFF', 'lib-clip-card'],
    'ad6-sel-delete': ['EFF', 'shell-confirm-host'],
    'ad6-menu-open': ['EXC', 'the item menu has no single region anchor in the registry; its items are framed on their own beats'],
    'ad6-menu-rename': ['EFF', 'lib-rename-input'],
    'ad6-rename-type': ['SELF'],
    'ad6-rename-save': ['EFF', 'lib-clip-card'],
    'ad6-add-audio-door': ['EXC', 'the system file picker — a surface outside the app'],
    'ad6-queue-start': ['EFF', 'lib-render-card'],
    'ad6-stage-play': ['SELF'],
    'ad6-clip-seek': ['SELF'],
  },
  'ad7.ts': {
    'ad7-open-tap': ['EFF', 'book-page'],
    'ad7-contents-tap': ['EFF', 'book-side-toc'],
    'ad7-contents-jump': ['EFF', 'book-page'],
    'ad7-marks-tab': ['EFF', 'book-marks-list'],
    'ad7-marks-jump': ['EFF', 'book-page'],
    'ad7-search-open': ['EFF', 'book-search-input'],
    'ad7-search-type': ['EFF', 'book-search-row'],
    'ad7-search-pick': ['EFF', 'book-page'],
    'ad7-find-next': ['EFF', 'book-page'],
    'ad7-find-close': ['EFF', 'book-page'],
    'ad7-link-tap': ['EFF', 'book-note-sheet'],
    'ad7-note-go': ['EFF', 'book-page'],
    'ad7-back-tap': ['EFF', 'book-page'],
    'ad7-bar-drag': ['EFF', 'book-page'],
    'ad7-bar-keys': ['EFF', 'book-page'],
    'ad7-bar-listen-tap': ['EFF', 'book-page'],
    'ad7-end-finish': ['SELF'],
    'ad7-tools-again': ['EFF', 'book-actions'],
    'ad7-copy': ['EXC', 'Copy writes the clipboard — no visible region changes'],
    'ad7-tools-reopen': ['EFF', 'book-actions'],
    'ad7-close': ['SELF'],
    'ad7-type-open': ['EXC', 'the Text sheet has no single region anchor in the registry; its rows are framed on their own beats'],
    'ad7-size': ['EFF', 'book-page'],
    'ad7-font': ['EFF', 'book-page'],
    'ad7-lines': ['EFF', 'book-page'],
    'ad7-sort': ['EFF', 'bk-tile'],
    'ad7-menu-open': ['EXC', 'the book menu has no single region anchor in the registry; its items are framed on their own beats'],
    'ad7-menu-fav': ['EFF', 'bk-tile'],
    'ad7-menu-rename': ['EFF', 'bk-rename-title'],
    'ad7-menu-finish': ['EFF', 'bk-tile'],
    'ad7-delete': ['EFF', 'shell-confirm-host'],
  },
  'ad8.ts': {
    'ad8-goto-create': ['NAV'],
    'ad8-type-text': ['SELF'],
    'ad8-paste': ['EFF', 'create-editor'],
    'ad8-voice-chip-auto': ['EFF', 'create-voice-chosen'],
    'ad8-format-shared': ['SELF'],
    'ad8-use-listen-tap': ['EFF', 'create-editor'],
    'ad8-generate': ['EFF', 'create-progress'],
    'ad8-result-play': ['SELF'],
    'ad8-result-seek': ['SELF'],
    'ad8-result-download': ['EXC', 'it saves a copy to the phone — off this surface'],
    'ad8-result-share': ['EXC', 'the system share surface — outside the app'],
    'ad8-result-library': ['NAV'],
  },
  'ad9.ts': {
    'legs-goto': ['NAV'],
    'legs-book-tap': ['EFF', R],
    'legs-text-tap': ['EFF', R],
    'clip-goto': ['NAV'],
    'clip-play': ['SELF'],
    'clip-goto-listen': ['NAV'],
    'clip-row': ['EFF', R],
    'marks-goto': ['NAV'],
    'marks-book-tap': ['EXC', 'playback starts inside Listen, off the shelf surface; the book itself opens on the next beat'],
    'marks-open-book': ['NAV'],
    'marks-tap-paragraph': ['EFF', 'book-actions'],
    'marks-listen-from': ['EFF', 'book-page'],
    'marks-goto-shelf': ['NAV'],
    'marks-loose-tap': ['EXC', 'its sentence sounds again inside Listen, off the shelf surface'],
    'marks-remove': ['EFF', 'shell-confirm-host'],
    'end-goto': ['NAV'],
    'end-clip-replay': ['SELF'],
    'end-clip-menu': ['EXC', 'the item menu has no single region anchor in the registry; its items are framed on their own beats'],
    'end-clip-finish': ['EFF', 'lib-clip-card'],
    'end-clip-unfinish': ['EFF', 'lib-clip-card'],
    'end-clip-startover': ['EFF', 'lib-clip-card'],
    'end-book-menu': ['EXC', 'the book menu has no single region anchor in the registry; its items are framed on their own beats'],
    'end-book-finish': ['EFF', 'bk-tile'],
    'end-book-startover': ['EFF', 'bk-tile'],
    'survives-open': ['NAV'],
    'survives-goto-library': ['NAV'],
  },
  'ad10.ts': {
    'ad10-open-card': ['SELF'],
    'ad10-type-from': ['SELF'],
    'ad10-type-to': ['SELF'],
    'ad10-add-tap': ['EFF', 'set-pron-entry'],
    'ad10-retype-from': ['SELF'],
    'ad10-retype-to': ['SELF'],
    'ad10-replace-tap': ['EFF', 'set-pron-entry'],
    'ad10-remove-tap': ['EFF', 'set-pron-entry'],
  },
  'ad11.ts': {
    'ad11-switch-on': ['EXC', 'the wave\u2019s standing note: the demonstrated effect is the \u03bb over other apps — no anchorable region on this surface'],
    'ad11-switch-off': ['EXC', 'the bubble comes back inside — the effect lives off this surface, as above'],
    'ad11-lever-on': ['EXC', 'Panel Auto\u2019s effect is the panel\u2019s behaviour over other apps — no anchorable region on this surface'],
    'ad11-lever-off': ['EXC', 'Panel Auto\u2019s effect is the panel\u2019s behaviour over other apps — no anchorable region on this surface'],
    'ad11-words-on': ['EXC', 'the panel\u2019s words live on the panel over other apps — no anchorable region on this surface'],
    'ad11-words-off': ['EXC', 'the panel\u2019s words live on the panel over other apps — no anchorable region on this surface'],
    'ad11-lambda-tap': ['SELF'],
  },
  'ad12.ts': {
    's1-setup-playing': ['NAV'],
  },
  'ad13.ts': {
    'ad13-same-doors': ['NAV'],
    'ad13-fav-chip-tap': ['EXC', 'the voice takes over the desk\u2019s listening — the desk has no listening-region anchor'],
    'ad13-recent-tap': ['EXC', 'its text loads in the desk\u2019s Listen region — no anchor names that region'],
    'ad13-open-the-book': ['EFF', 'book-page'],
    'ad13-textmap-tap': ['SELF'],
    'ad13-go-library': ['NAV'],
    'ad13-open-book-again': ['EFF', 'book-page'],
    'ad13-info-marks': ['EFF', 'book-page'],
    'ad13-audiobook-tap': ['EXC', 'the book queues in Create\u2019s render queue — off this surface'],
    'ad13-go-create': ['NAV'],
    'ad13-recording-tap': ['SELF'],
    'ad13-go-settings': ['NAV'],
  },
  'ad14.ts': {
    'ad14-page-head': ['NAV'],
    'ad14-appearance-open': ['SELF'],
    'ad14-theme-change': ['EXC', 'the whole surface repaints at once — no region anchor can frame the entire app; the theme control itself is framed'],
    'ad14-neural-open': ['NAV'],
    'ad14-download-button': ['EFF', 'set-neural-status'],
    'ad14-auto-download': ['SELF'],
    'ad14-auto-download-off': ['SELF'],
    'ad14-player-note-goto': ['NAV'],
    'ad14-backup-open': ['SELF'],
    'ad14-backup-export': ['EXC', 'the dated file leaves through the system share surface — outside the app'],
    'ad14-backup-import': ['EXC', 'the system file picker — a surface outside the app'],
    'ad14-delete-door': ['NAV'],
    'ad14-delete-rest': ['SELF'],
    'ad14-theme-restore': ['EXC', 'the whole surface repaints at once — as the theme change above'],
  },
}

/* ── Cross-check the table against the live census ────────────────── */
const fileOf = (id) => `${id.toLowerCase()}.ts`
let censusCount = 0
const problems = []
for (const entry of MODULE_CATALOGUE) {
  if (!entry.script) continue
  const table = CLASSIFICATION[fileOf(entry.id)]
  if (!table) {
    problems.push(`${entry.id}: no classification table`)
    continue
  }
  const seen = new Set()
  for (const f of flattenSteps(entry.script)) {
    if (!PERFORMED.has(f.step.act)) continue
    censusCount++
    const c = table[f.step.id]
    if (!c) {
      problems.push(`${entry.id}/${f.step.id}: performed step missing from the table`)
      continue
    }
    seen.add(f.step.id)
    if (c[0] === 'EFF') {
      if (!isRegisteredAnchorId(c[1])) problems.push(`${entry.id}/${f.step.id}: effect anchor "${c[1]}" is not registered`)
      if (c[1] === f.step.anchorId) problems.push(`${entry.id}/${f.step.id}: effect anchor equals its own anchorId`)
      if (f.step.effectAnchorId) problems.push(`${entry.id}/${f.step.id}: already carries effectAnchorId ${f.step.effectAnchorId} — table says EFF`)
    }
    if (c[0] === 'PRE' && !f.step.effectAnchorId) problems.push(`${entry.id}/${f.step.id}: table says PRE but no effectAnchorId exists`)
    if ((c[0] === 'SELF' || c[0] === 'NAV' || c[0] === 'EXC') && f.step.effectAnchorId) {
      problems.push(`${entry.id}/${f.step.id}: table says ${c[0]} but the step already carries effectAnchorId ${f.step.effectAnchorId}`)
    }
  }
  for (const id of Object.keys(table)) {
    if (!seen.has(id)) problems.push(`${entry.id}: table entry "${id}" matches no performed step`)
  }
}
if (problems.length) {
  console.error('CLASSIFICATION PROBLEMS:\n- ' + problems.join('\n- '))
  process.exit(1)
}
console.log(`census cross-check OK — ${censusCount} performed steps classified exactly once`)

/* ── Apply the EFF insertions ─────────────────────────────────────── */
let inserted = 0
for (const [file, table] of Object.entries(CLASSIFICATION)) {
  const url = new URL(`../../src/lib/presentation/scripts/${file}`, import.meta.url)
  const lines = readFileSync(url, 'utf8').split('\n')
  const out = []
  let currentStep = null
  for (const line of lines) {
    out.push(line)
    const idMatch = line.match(/^\s*id: '([^']+)',$/)
    if (idMatch && table[idMatch[1]]) currentStep = idMatch[1]
    const anchorMatch = line.match(/^(\s*)anchorId: /)
    if (anchorMatch && currentStep && table[currentStep]?.[0] === 'EFF') {
      out.push(`${anchorMatch[1]}effectAnchorId: '${table[currentStep][1]}',`)
      inserted++
      currentStep = null
    }
  }
  if (!DRY) writeFileSync(url, out.join('\n'))
}
console.log(`${DRY ? '[dry] would insert' : 'inserted'} ${inserted} effectAnchorId lines`)
