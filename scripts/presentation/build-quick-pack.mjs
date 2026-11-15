/**
 * build-quick-pack.mjs — the Presentation screenshot pack generator
 * (both floors: Quick Q0–Q5 and Advanced AD1–AD14).
 *
 * Produces ~/workspace/logos-presentation-work/preview/quick-floor.html
 * from the REAL registered catalogue + scripts (importing
 * src/lib/presentation/scripts/index.ts runs the same registration the
 * app runs — refused scripts would fail this build loudly):
 *
 *  (a) the Settings Presentations index as rendered — the real fold DOM
 *      of presentation-index.tsx, both floors, Spanish primary, Quick
 *      cards carrying their REAL computed labels; English labels in a
 *      table beneath. The index is staged with ONE bench state file:
 *      Q0 and Q1 stand completed, Q2 stands part-way at the very place
 *      the stage mock (b) shows it (its recorded step, 18 of 37) and
 *      marked last-used — so the GENERAL PROGRESS LINE computes a real
 *      figure from it through the app's own overallProgress() (2 whole
 *      + 17/37 walked → 12% studied, «Te falta el 88%»), and Q2 heads
 *      the list under «Sigue donde ibas», once, lifted out of the Quick
 *      floor (the FIRST-CARD fixture — the pack's own staging of
 *      resumeHead()'s derivation, labelled as bench staging in a note
 *      under the card);
 *  (b) a phone-width stage mock of the C′ card mid-scene in Q2 scene 3
 *      (the clipboard-replace beat, step s3-replaces) — the REAL
 *      presentation-player.css and Q2's actual caption text, over a
 *      dimmed fake "another app" surface with the bubble, honestly
 *      labelled as a bench render of real CSS + real words;
 *  (b2) the same bench for the Advanced floor: the C′ card mid-scene in
 *      AD1's drag-doors scene (the Remove-never-asks beat, step
 *      s2-remove-no-ask) — same CSS, AD1's actual caption text, same
 *      fake surface and bubble;
 *  (b3) the ✕ confirmation window open on the Q2 card (the ✕-asks-first
 *      law): the question big, the body brief, its two buttons on their
 *      own row — the real window CSS and the player's real words;
 *  (c) the length table — module · scenes · steps · computed EN · ES ·
 *      label — every figure from the one shared clock.
 *
 * Styling: Logos' real dark-theme tokens — the app's own styles.css
 * (its @import font lines stripped: the bench has no font files, so
 * Manrope falls back to the system font), presentation-index.css and
 * presentation-player.css, all inlined verbatim. Pack-only scaffolding
 * rules live in one clearly-marked block and paint only with tokens.
 *
 * Run: node scripts/presentation/build-quick-pack.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

import { MODULE_CATALOGUE, entryDuration, overallProgress, resumeHead, stateFor } from '../../src/lib/presentation/catalogue.ts'
import { normalizePresentationState } from '../../src/lib/presentation/presentation-state.ts'
import { flattenSteps } from '../../src/lib/presentation/engine/types.ts'
import { Q2 } from '../../src/lib/presentation/scripts/q2.ts'
import { AD1 } from '../../src/lib/presentation/scripts/ad1.ts'
import { CLIP_TEXT } from '../../src/lib/presentation/scenario/fiction.ts'
// Registration side effect: all twenty scripts attach to the catalogue.
import '../../src/lib/presentation/scripts/index.ts'

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/* Lucide-style stroke icons, same geometry family the components use. */
const ICONS = {
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
  pointerClick:
    '<path d="M14 4.1 12 6"/><path d="m5.1 8-2.9-.8"/><path d="m6 12-1.9 2"/><path d="M7.2 2.2 8 5.1"/><path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  list: '<path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  rotateCcw: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  mapPin:
    '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  gradCap:
    '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.084a1 1 0 0 0 0 1.838l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
}
const icon = (name, size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`

/* ── The real CSS, inlined ─────────────────────────────────────────── */
const stripImports = (css) => css.replace(/@import[^;]+;\s*/g, '')
const appCss = stripImports(readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8'))
const indexCss = readFileSync(new URL('../../src/lib/presentation/presentation-index.css', import.meta.url), 'utf8')
const playerCss = readFileSync(new URL('../../src/lib/presentation/engine/presentation-player.css', import.meta.url), 'utf8')

/* Pack-only scaffolding — section framing, bench tags, tables, and the
   fake "another app" stage surface. Token paint only. */
const packCss = `
  .pack-sec { padding: 16px 12px 34px; }
  .pack-tag { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: .04em;
    color: var(--accent-ink); background: var(--accent); border-radius: 99px; padding: 4px 10px; margin-bottom: 12px; }
  .pack-note { font-size: 12.5px; color: var(--muted); margin: 10px 2px 0; line-height: 1.45; }
  .pack-h { font-size: 17px; font-weight: 750; margin: 4px 2px 10px; }
  table.pack-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.pack-table th { text-align: left; font-size: 11px; letter-spacing: .05em; text-transform: uppercase;
    color: var(--muted); font-weight: 700; padding: 8px 8px; border-bottom: 1px solid var(--line-2); }
  table.pack-table td { padding: 8px; border-bottom: 1px solid var(--line); color: var(--text-2); vertical-align: top; }
  table.pack-table td.id { font-weight: 750; color: var(--text); white-space: nowrap; }
  table.pack-table td.num { font-variant-numeric: tabular-nums; white-space: nowrap; }
  table.pack-table td.lab { color: var(--accent); font-weight: 650; white-space: nowrap; }
  /* The fake "another app" stage surface (fiction — bench scaffolding). */
  #sec-stage { padding: 0; }
  #sec-stage-ad1 { padding: 0; }
  #sec-closewin { padding: 0; }
  .stage-app { position: relative; height: 100dvh; overflow: hidden; background: var(--bg-2); }
  .fake-head { padding: 26px 20px 10px; }
  .fake-appname { font-size: 13px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
  .fake-title { font-family: var(--font-display); font-size: 30px; margin-top: 4px; color: var(--text); }
  .fake-body { padding: 8px 20px; font-size: 15.5px; line-height: 1.65; color: var(--text-2); }
  .fake-note { margin: 16px 20px 0; background: var(--surface-2); border: 1px solid var(--line-2);
    border-radius: 16px; padding: 14px 16px; font-size: 15.5px; line-height: 1.6; color: var(--text); }
  .fake-copied { display: inline-block; margin-top: 10px; font-size: 11.5px; font-weight: 700;
    color: var(--accent); border: 1px solid var(--accent); border-radius: 99px; padding: 3px 9px; }
  .fake-orb { position: absolute; width: 56px; height: 56px; border-radius: 50%;
    background: linear-gradient(145deg, var(--accent-2), var(--accent)); color: var(--accent-ink);
    display: grid; place-items: center; font-family: var(--font-display); font-size: 27px;
    box-shadow: 0 10px 26px -8px var(--accent-glow), 0 0 0 1px var(--line-2); }
  .stage-tag { position: absolute; bottom: 12px; left: 12px; z-index: 105; font-size: 11px; font-weight: 650;
    color: var(--text-2); background: var(--surface-3); border: 1px solid var(--line-2);
    border-radius: 99px; padding: 4px 10px; }
  /* The length table must fit the phone whole — fixed layout, wrapping labels. */
  table.pack-table.length { table-layout: fixed; font-size: 12px; }
  table.pack-table.length td.lab { white-space: normal; }
  table.pack-table.length th, table.pack-table.length td { padding: 7px 5px; }
  table.pack-table.length th { font-size: 9px; letter-spacing: .02em; white-space: nowrap; }
  /* Titles wrap at word boundaries in their (now wide) column — a word
     is never split to make a table fit. */
  table.pack-table.length td { overflow-wrap: normal; }
`

/* ── (a) The Settings Presentations index, as rendered ─────────────── */
/* Words mirror presentation-index.tsx exactly (Spanish primary, as the
   app renders with UI language ES); durations via the catalogue's own
   entryDuration — the shared clock's computation, or nothing. */
const IDX = {
  cardTitle: 'Presentaciones',
  cardSub: 'Aprende la app entera, con guía, a tu ritmo',
  announcement:
    'Las lecciones corren en cada pantalla que Logos sirve — teléfono, tableta y ordenador. Las lecciones de la burbuja viven en la app de Android.',
  floors: {
    quick: { t: 'Rápido', s: 'Empieza donde quieras — el orden es una recomendación, nunca una cerradura.' },
    advanced: { t: 'Avanzado', s: 'La app entera, a fondo, cuando estés listo.' },
  },
  stateUnseen: 'Sin empezar',
  start: 'Empezar',
  myScenes: 'Mis escenas',
  myScenesEmpty: 'Las escenas que guardes desde los capítulos de una lección vivirán aquí.',
  /* The bench fixture's words (the pack's own staging, not app state):
     the resume head's heading and the progress line's lead, mirroring
     presentation-index.tsx exactly. The FIGURES are never staged by
     hand — the fixture state below runs through the app's own pure
     derivations (stateFor / resumeHead / overallProgress). */
  resumeHeadTitle: 'Sigue donde ibas',
  statePartway: 'A mitad',
  stateSeen: 'Visto',
  resume: 'Reanudar',
  progressLead: 'de la app ya estudiado',
}

/* The bench fixture state — ONE staged logos.presentation.state.v1 for
   the whole index: Q0 and Q1 completed; Q2 part-way at its recorded
   place — the very step the stage mock (b) puts on its card (the
   s3-replaces beat, counter 18 of 37, recorded step 17) — and marked
   last-used, so it heads the list. Every index figure and state word
   below derives from this file through the app's own functions. */
const q2Recorded = flattenSteps(Q2).find((f) => f.step.id === 's3-replaces')
const BENCH_STATE = normalizePresentationState({
  speed: 1,
  myScenes: [],
  lastUsed: 'Q2',
  modules: {
    Q0: { state: 'seen', verifiedAgainst: '1.4.156', skips: [] },
    Q1: { state: 'seen', verifiedAgainst: '1.4.156', skips: [] },
    Q2: {
      state: 'in-progress',
      step: q2Recorded.globalIndex,
      scene: q2Recorded.scene.id,
      stepId: 's3-replaces',
      verifiedAgainst: '1.4.156',
      skips: [],
    },
  },
})
const BENCH_PROGRESS = overallProgress(BENCH_STATE)

/* The counts line under the bar (Spanish mirror of the component's
   progressCounts — same parts, same order, same separators). */
function progressCountsEs(p) {
  const parts = [`${p.finished} de ${p.total} módulos terminados`]
  if (p.inProgress > 0) parts.push(`${p.inProgress} en curso`)
  if (p.remainingPercent > 0) parts.push(`Te falta el ${p.remainingPercent}%`)
  return parts.join(' · ')
}

function moduleRowEs(entry, variant = 'floor') {
  const duration = entryDuration(entry, 'es')
  const playable = entry.script !== null
  const announced = stateFor(entry, BENCH_STATE)
  const head = variant === 'head'
  const partway = announced.state === 'in-progress' || announced.state === 'needs-refresh'
  const stateWord = head || announced.state === 'in-progress'
    ? IDX.statePartway
    : announced.state === 'seen'
      ? IDX.stateSeen
      : IDX.stateUnseen
  const stateClass = announced.state === 'seen' ? ' seen' : announced.state === 'needs-refresh' ? ' refresh' : ''
  const go = partway
    ? `<button class="btn ghost pres-go"><span>${icon('rotateCcw', 15)}${IDX.resume}</span></button>`
    : `<button class="btn ghost pres-go"><span>${icon('play', 15)}${IDX.start}</span></button>`
  return `          <div class="list-row" style="display:block">
            <div class="pres-mod-t"><span class="t">${esc(entry.title.es)}</span>${duration ? `<span class="pres-dur">${esc(duration.label)}</span>` : ''}</div>
            <div class="d">${esc(entry.capability.es)}</div>
            <div class="pres-mod-foot"><span class="pres-state${stateClass}">${stateWord}</span>${playable ? go : ''}</div>
          </div>`
}

function floorEs(floor, skipId = null) {
  const rows = MODULE_CATALOGUE.filter((e) => e.floor === floor && e.id !== skipId).map((e) => moduleRowEs(e)).join('\n')
  return `        <div class="pres-floor">
          <div class="pres-floor-t">${IDX.floors[floor].t}</div>
          <div class="pres-floor-s muted small">${IDX.floors[floor].s}</div>
          <div class="list">
${rows}
          </div>
        </div>`
}

const headEntry = resumeHead(BENCH_STATE)
const resumeHeadHtml = `        <div class="pres-floor pres-resume">
          <div class="pres-floor-t">${IDX.resumeHeadTitle}</div>
          <div class="list">
${moduleRowEs(headEntry, 'head')}
          </div>
        </div>`

/* The general progress line, exactly as the component renders it —
   every figure from overallProgress() over the bench state above. */
const progressHtml = `      <div class="pres-progress">
        <div class="pres-progress-head"><span class="pres-progress-pct">${BENCH_PROGRESS.percent}%</span><span class="pres-progress-lead">${IDX.progressLead}</span></div>
        <div class="pres-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${BENCH_PROGRESS.percent}" aria-label="Has estudiado el ${BENCH_PROGRESS.percent}% de la app."><div class="pres-progress-fill" style="width:${BENCH_PROGRESS.percent}%"></div></div>
        <div class="pres-progress-counts muted small">${progressCountsEs(BENCH_PROGRESS)}</div>
      </div>`

const indexHtml = `<section id="sec-index" class="pack-sec">
  <span class="pack-tag">Banco · el índice tal como se renderiza</span>
  <div class="card set-card open">
    <button class="set-card-h" aria-expanded="true">
      <span class="set-ic">${icon('gradCap', 19)}</span>
      <div class="grow"><div class="set-card-t">${IDX.cardTitle}</div><div class="set-card-s">${IDX.cardSub}</div></div>
      ${icon('chevronDown', 18).replace('<svg', '<svg class="set-chev"')}
    </button>
    <div class="set-fold open"><div class="set-fold-in">
      <p class="muted small pres-note">${IDX.announcement}</p>
${progressHtml}
${resumeHeadHtml}
${floorEs('quick', headEntry?.id)}
${floorEs('advanced')}
      <div class="pres-mine">
        <div class="pres-floor-t">${IDX.myScenes}</div>
        <p class="muted small" style="padding:0 2px;margin-top:4px">${IDX.myScenesEmpty}</p>
      </div>
    </div></div>
  </div>
  <p class="pack-note">Banco: el índice está escenificado con un estado de banco de logos.presentation.state.v1 — Q0 y Q1 terminados; Q2 a mitad, en el paso grabado que muestra el escenario de la burbuja (18 de 37), y marcado como último módulo usado. La línea de progreso y la cabecera «Sigue donde ibas» se calculan de ese estado con las mismas funciones puras de la app — overallProgress() y resumeHead() — sin cifras escritas a mano: 2 módulos enteros y 17/37 de Q2 dan el 12% estudiado, y te falta el 88%. En la app, ambas salen del estado real del dispositivo, y la cabecera desaparece al completar el módulo.</p>
  <h2 class="pack-h" style="margin-top:26px">Etiquetas calculadas · Calculated labels</h2>
  <table class="pack-table">
    <tr><th>Módulo</th><th>Title (EN)</th><th>Label EN</th><th>Título (ES)</th><th>Etiqueta ES</th></tr>
${MODULE_CATALOGUE.map((entry) => {
  const en = entryDuration(entry, 'en')
  const es = entryDuration(entry, 'es')
  return `    <tr><td class="id">${entry.id}</td><td>${esc(entry.title.en)}</td><td class="lab">${en ? esc(en.label) : '—'}</td><td>${esc(entry.title.es)}</td><td class="lab">${es ? esc(es.label) : '—'}</td></tr>`
}).join('\n')}
  </table>
  <p class="pack-note">Sin guion registrado no hay etiqueta: la duración se calcula del guion a Automático 1× — nunca se escribe a mano. / No registered script, no label: duration is computed from the script at Automatic 1× — never handwritten.</p>
</section>`

/* ── (b) The C′ card mid-scene: Q2, scene 3, the replace beat ──────── */
/* The card is shown in INTERACTIVE mode (mode button «Interactivo», no
   pause in the header) so the bench evidences the NAV PAIR (Oscar's law,
   Brizna lane 2026-11-14): the icon-only «‹ ›» in the header, immediately
   left of the mode button (seat moved up at Oscar's order, Cadence lane
   2026-11-14). Below the caption, «Module · Chapter» owns its own
   line at full width and «Muéstrame» rides the actions row under it,
   at «Quedarme aquí»'s level (Oscar's order, 2026-11-14, from his
   crops). The staged beat is a narration beat (act: say), so the
   pair stands complete; on a gesture beat › would not exist. Placement
   replicates presentation-player.tsx's own math at 390×844:
   the focus (the bubble, 56px at left 302 / top 556) sits low, so the
   card goes above it; the veil hole and ring carry the same −10px air. */
const scene3 = Q2.scenes.find((s) => s.id === 'copy-tap-listen')
const replaceStep = scene3.steps.find((s) => s.id === 's3-replaces')
const stepsBefore = Q2.scenes.slice(0, Q2.scenes.indexOf(scene3)).reduce((n, s) => n + s.steps.length, 0)
const stepNumber = stepsBefore + scene3.steps.indexOf(replaceStep) + 1
const totalSteps = flattenSteps(Q2).length
const sceneFraction = (scene3.steps.indexOf(replaceStep) + 1) / scene3.steps.length
const threadPercent = ((Q2.scenes.indexOf(scene3) + sceneFraction) / Q2.scenes.length) * 100
const FOCUS = { left: 302, top: 556, size: 56 }
const cardLeft = Math.min(Math.max(FOCUS.left, 12), Math.max(12, 390 - 370 - 12))
const cardBottom = Math.max(844 - FOCUS.top + 16, 12)

/* The veil (Oscar's corrected principle — darkens, never blurs):
   four panels tile the 390×844 viewport AROUND the contained hole
   (the bubble's rect ± 10px of air), each tinting and slightly
   desaturating what lies beneath it; the hole itself carries NO
   panel — it stays pixel-sharp, exactly as the real player paints
   it (presentation-player.tsx). */
const HOLE = { top: FOCUS.top - 10, left: FOCUS.left - 10, size: FOCUS.size + 20 }
const veilHtml = `  <div class="lp-veil lp-veil-t" aria-hidden style="height:${HOLE.top}px"></div>
  <div class="lp-veil lp-veil-b" aria-hidden style="top:${HOLE.top + HOLE.size}px"></div>
  <div class="lp-veil lp-veil-l" aria-hidden style="top:${HOLE.top}px;height:${HOLE.size}px;width:${HOLE.left}px"></div>
  <div class="lp-veil lp-veil-r" aria-hidden style="top:${HOLE.top}px;height:${HOLE.size}px;left:${HOLE.left + HOLE.size}px"></div>`

const stageHtml = `<section id="sec-stage" class="pack-sec">
<div class="lp-player">
  <div class="stage-app">
    <div class="stage-tag">Banco: CSS real + palabras reales de Q2 · la «otra app» es ficción</div>
    <div class="fake-head"><div class="fake-appname">Notas · otra aplicación</div><div class="fake-title">Cosas del puerto</div></div>
    <p class="fake-body">La barca sale con la primera luz y vuelve con la marea. Hay que revisar las redes, comprar hielo y dejar la boathouse abierta para quien llegue tarde.</p>
    <div class="fake-note">${esc(CLIP_TEXT.text)}<br><span class="fake-copied">Copiado</span></div>
    <p class="fake-body" style="margin-top:16px">Si el faro parpadea dos veces, es la señal de siempre: té caliente y paciencia.</p>
    <div class="fake-orb" style="left:${FOCUS.left}px;top:${FOCUS.top}px">λ</div>
  </div>
  <div class="lp-thread" aria-hidden><div class="lp-thread-fill" style="width:${threadPercent.toFixed(1)}%"></div></div>
${veilHtml}
  <div class="lp-ring" aria-hidden style="top:${FOCUS.top - 10}px;left:${FOCUS.left - 10}px;width:${FOCUS.size + 20}px;height:${FOCUS.size + 20}px"></div>
  <div class="lp-card" style="left:${cardLeft}px;bottom:${cardBottom}px" role="dialog" aria-label="${esc(Q2.title.es)}">
    <div class="lp-head">
      <p class="lp-counter">${stepNumber} / ${totalSteps}</p>
      <div class="lp-cluster">
        <span class="lp-navpair"><button type="button" class="lp-qbtn lp-qicon lp-navbtn" aria-label="Volver un paso">${icon('chevronLeft', 12)}</button><button type="button" class="lp-qbtn lp-qicon lp-navbtn" aria-label="Siguiente">${icon('chevronRight', 12)}</button></span>
        <button type="button" class="lp-qbtn">${icon('hand', 12)}<span>Interactivo</span></button>
        <button type="button" class="lp-qbtn">${icon('gauge', 12)}<span>1×</span></button>
        <button type="button" class="lp-qbtn lp-qicon" aria-label="Capítulos">${icon('list', 12)}</button>
        <button type="button" class="lp-qbtn lp-qicon" aria-label="Salir de la lección">${icon('x', 12)}</button>
      </div>
    </div>
    <p class="lp-text">${esc(replaceStep.text.es)}</p>
    <p class="lp-module">${esc(Q2.title.es)} · ${esc(scene3.chapter.es)}</p>
    <div class="lp-bottom">
      <button type="button" class="lp-qbtn lp-stay">${icon('mapPin', 13)}<span>Quedarme aquí</span></button>
      <button type="button" class="lp-qbtn lp-showme">${icon('pointerClick', 13)}<span>Muéstrame</span></button>
    </div>
  </div>
</div>
</section>`

/* ── (b2) The C′ card mid-scene: AD1, drag-doors, Remove never asks ── */
/* Same bench as the Q2 stage, mirrored exactly: same placement math at
   390×844, same fake "another app" surface, the bubble as the focus —
   here the drag-doors scene's own beat (dropping the bubble on ✕ Remove
   asks nothing first), AD1's actual caption text. Also Interactive, with
   the nav pair in the header, left of the mode button (this beat is
   likewise a say). */
const doorsScene = AD1.scenes.find((s) => s.id === 'drag-doors')
const removeStep = doorsScene.steps.find((s) => s.id === 's2-remove-no-ask')
const ad1StepsBefore = AD1.scenes.slice(0, AD1.scenes.indexOf(doorsScene)).reduce((n, s) => n + s.steps.length, 0)
const ad1StepNumber = ad1StepsBefore + doorsScene.steps.indexOf(removeStep) + 1
const ad1TotalSteps = flattenSteps(AD1).length
const ad1SceneFraction = (doorsScene.steps.indexOf(removeStep) + 1) / doorsScene.steps.length
const ad1ThreadPercent = ((AD1.scenes.indexOf(doorsScene) + ad1SceneFraction) / AD1.scenes.length) * 100

const stageAd1Html = `<section id="sec-stage-ad1" class="pack-sec">
<div class="lp-player">
  <div class="stage-app">
    <div class="stage-tag">Banco: CSS real + palabras reales de AD1 · la «otra app» es ficción</div>
    <div class="fake-head"><div class="fake-appname">Notas · otra aplicación</div><div class="fake-title">Cosas del puerto</div></div>
    <p class="fake-body">La barca sale con la primera luz y vuelve con la marea. Hay que revisar las redes, comprar hielo y dejar la boathouse abierta para quien llegue tarde.</p>
    <div class="fake-note">${esc(CLIP_TEXT.text)}<br><span class="fake-copied">Copiado</span></div>
    <p class="fake-body" style="margin-top:16px">Si el faro parpadea dos veces, es la señal de siempre: té caliente y paciencia.</p>
    <div class="fake-orb" style="left:${FOCUS.left}px;top:${FOCUS.top}px">λ</div>
  </div>
  <div class="lp-thread" aria-hidden><div class="lp-thread-fill" style="width:${ad1ThreadPercent.toFixed(1)}%"></div></div>
${veilHtml}
  <div class="lp-ring" aria-hidden style="top:${FOCUS.top - 10}px;left:${FOCUS.left - 10}px;width:${FOCUS.size + 20}px;height:${FOCUS.size + 20}px"></div>
  <div class="lp-card" style="left:${cardLeft}px;bottom:${cardBottom}px" role="dialog" aria-label="${esc(AD1.title.es)}">
    <div class="lp-head">
      <p class="lp-counter">${ad1StepNumber} / ${ad1TotalSteps}</p>
      <div class="lp-cluster">
        <span class="lp-navpair"><button type="button" class="lp-qbtn lp-qicon lp-navbtn" aria-label="Volver un paso">${icon('chevronLeft', 12)}</button><button type="button" class="lp-qbtn lp-qicon lp-navbtn" aria-label="Siguiente">${icon('chevronRight', 12)}</button></span>
        <button type="button" class="lp-qbtn">${icon('hand', 12)}<span>Interactivo</span></button>
        <button type="button" class="lp-qbtn">${icon('gauge', 12)}<span>1×</span></button>
        <button type="button" class="lp-qbtn lp-qicon" aria-label="Capítulos">${icon('list', 12)}</button>
        <button type="button" class="lp-qbtn lp-qicon" aria-label="Salir de la lección">${icon('x', 12)}</button>
      </div>
    </div>
    <p class="lp-text">${esc(removeStep.text.es)}</p>
    <p class="lp-module">${esc(AD1.title.es)} · ${esc(doorsScene.chapter.es)}</p>
    <div class="lp-bottom">
      <button type="button" class="lp-qbtn lp-stay">${icon('mapPin', 13)}<span>Quedarme aquí</span></button>
      <button type="button" class="lp-qbtn lp-showme">${icon('pointerClick', 13)}<span>Muéstrame</span></button>
    </div>
  </div>
</div>
</section>`

/* ── (b3) The ✕ confirmation window, open on the Q2 card ──────────── */
/* The same stage bench as (b), with the card caught at the moment the
   ✕ ASKS FIRST (Oscar's law, Brizna lane 2026-11-14): the learner has
   tapped ✕ mid-module and the confirmation window stands open on the
   card — the question as the big headline, the body brief, «Salir» and
   «Seguir viendo» breathing on their own row. The window's words mirror
   presentation-player.tsx's LABELS exactly (Spanish primary). */
const closeWinHtml = `<section id="sec-closewin" class="pack-sec">
<div class="lp-player">
  <div class="stage-app">
    <div class="stage-tag">Banco: la ventana de la ✕ abierta · CSS real + palabras reales</div>
    <div class="fake-head"><div class="fake-appname">Notas · otra aplicación</div><div class="fake-title">Cosas del puerto</div></div>
    <p class="fake-body">La barca sale con la primera luz y vuelve con la marea. Hay que revisar las redes, comprar hielo y dejar la boathouse abierta para quien llegue tarde.</p>
    <div class="fake-note">${esc(CLIP_TEXT.text)}<br><span class="fake-copied">Copiado</span></div>
    <p class="fake-body" style="margin-top:16px">Si el faro parpadea dos veces, es la señal de siempre: té caliente y paciencia.</p>
    <div class="fake-orb" style="left:${FOCUS.left}px;top:${FOCUS.top}px">λ</div>
  </div>
  <div class="lp-thread" aria-hidden><div class="lp-thread-fill" style="width:${threadPercent.toFixed(1)}%"></div></div>
${veilHtml}
  <div class="lp-ring" aria-hidden style="top:${FOCUS.top - 10}px;left:${FOCUS.left - 10}px;width:${FOCUS.size + 20}px;height:${FOCUS.size + 20}px"></div>
  <div class="lp-card" style="left:${cardLeft}px;bottom:${cardBottom}px" role="dialog" aria-label="${esc(Q2.title.es)}">
    <div class="lp-head">
      <p class="lp-counter">${stepNumber} / ${totalSteps}</p>
      <div class="lp-cluster">
        <span class="lp-navpair"><button type="button" class="lp-qbtn lp-qicon lp-navbtn" aria-label="Volver un paso">${icon('chevronLeft', 12)}</button><button type="button" class="lp-qbtn lp-qicon lp-navbtn" aria-label="Siguiente">${icon('chevronRight', 12)}</button></span>
        <button type="button" class="lp-qbtn">${icon('hand', 12)}<span>Interactivo</span></button>
        <button type="button" class="lp-qbtn">${icon('gauge', 12)}<span>1×</span></button>
        <button type="button" class="lp-qbtn lp-qicon" aria-label="Capítulos">${icon('list', 12)}</button>
        <button type="button" class="lp-qbtn lp-qicon" aria-label="Salir de la lección">${icon('x', 12)}</button>
      </div>
    </div>
    <div class="lp-closewin" role="alertdialog" aria-label="¿Salir de esta lección?">
      <p class="lp-closewin-t">¿Salir de esta lección?</p>
      <p class="lp-closewin-b">Tu lugar queda guardado. Podrás seguir después, justo donde estás.</p>
      <div class="lp-closewin-row">
        <button type="button" class="lp-done-btn"><span>Salir</span></button>
        <button type="button" class="lp-qbtn"><span>Seguir viendo</span></button>
      </div>
    </div>
    <p class="lp-text">${esc(replaceStep.text.es)}</p>
    <p class="lp-module">${esc(Q2.title.es)} · ${esc(scene3.chapter.es)}</p>
    <div class="lp-bottom">
      <button type="button" class="lp-qbtn lp-stay">${icon('mapPin', 13)}<span>Quedarme aquí</span></button>
      <button type="button" class="lp-qbtn lp-showme">${icon('pointerClick', 13)}<span>Muéstrame</span></button>
    </div>
  </div>
</div>
</section>`

/* ── (c) The length table — scenes/steps counted, duration as label ── */
/* Oscar's law (2026-11-14): no exact seconds anywhere — the computed
 * «Aprox. N min» label is the whole duration story; the freed columns'
 * space belongs to the titles. */
const lengthRows = MODULE_CATALOGUE.map((entry) => {
  if (!entry.script) {
    return `    <tr><td class="id">${entry.id}</td><td>${esc(entry.title.es)}</td><td class="num">${entry.scenes.length}</td><td class="num">—</td><td>—</td></tr>`
  }
  const es = entryDuration(entry, 'es')
  return `    <tr><td class="id">${entry.id}</td><td>${esc(entry.title.es)}</td><td class="num">${entry.script.scenes.length}</td><td class="num">${flattenSteps(entry.script).length}</td><td class="lab">${esc(es.label)}</td></tr>`
}).join('\n')

const tableHtml = `<section id="sec-table" class="pack-sec">
  <span class="pack-tag">Banco · longitudes calculadas</span>
  <h2 class="pack-h">Longitud de cada módulo, calculada a Automático 1×</h2>
  <table class="pack-table length">
    <colgroup><col style="width:13%"><col style="width:37%"><col style="width:14%"><col style="width:12%"><col style="width:24%"></colgroup>
    <tr><th>Módulo</th><th>Título</th><th>Escenas</th><th>Pasos</th><th>Etiqueta</th></tr>
${lengthRows}
  </table>
  <p class="pack-note">Las veinte filas — planta Quick y planta Avanzada — salen de los guiones registrados: escenas y pasos contados del guion, y la duración calculada por el reloj compartido (engine/clock.ts) en cada idioma, mostrada solo como su aproximación.</p>
</section>`

/* ── Assemble ──────────────────────────────────────────────────────── */
const html = `<!DOCTYPE html>
<html lang="es" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Banco — Presentaciones de Logos · las dos plantas</title>
<style>
${appCss}
</style>
<style>
${indexCss}
</style>
<style>
${playerCss}
</style>
<style>/* Pack-only scaffolding (bench framing, tables, fake stage surface). */
${packCss}
</style>
</head>
<body>
${indexHtml}
${stageHtml}
${stageAd1Html}
${closeWinHtml}
${tableHtml}
<script>
  // Bench section switcher: the screenshot scenarios show one section
  // at a time so the fixed-position card pieces anchor to the viewport
  // exactly as they do in the app.
  window.__packShow = (id) => {
    for (const sec of document.querySelectorAll('.pack-sec')) sec.style.display = sec.id === id ? '' : 'none'
    window.scrollTo(0, 0)
    return true
  }
</script>
</body>
</html>`

const outUrl = new URL('../../../preview/quick-floor.html', import.meta.url)
mkdirSync(new URL('../../../preview/', import.meta.url), { recursive: true })
writeFileSync(outUrl, html)
console.log(`quick-floor.html written (${html.length} bytes)`)
console.log(`Q2 stage beat: step ${stepNumber} / ${totalSteps} · thread ${threadPercent.toFixed(1)}% · caption ES: ${replaceStep.text.es}`)
console.log(`AD1 stage beat: step ${ad1StepNumber} / ${ad1TotalSteps} · thread ${ad1ThreadPercent.toFixed(1)}% · caption ES: ${removeStep.text.es}`)
