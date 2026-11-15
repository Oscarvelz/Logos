/**
 * build-edge-probe.mjs — the screen-edge bench for the presentation player.
 *
 * Stages the two edge cases of the screen-edge law (law (11)'s sibling,
 * Oscar via the Brizna lane 2026-11-14) at phone size 390×844:
 *   · edge-bottom.html — a focus flush with the BOTTOM edge (a bottom-bar
 *     control whose own bottom is the viewport's bottom, y=844). The old
 *     ±10px hole ended at y=854: the ring was cut by the device's edge.
 *   · edge-right.html — a focus flush with the RIGHT edge (x=390). The old
 *     hole ended at x=400.
 * Both pages run the REAL computation — containedHole() imported from the
 * engine's geometry.ts, the very function presentation-player.tsx calls —
 * and paint with the player's REAL veil / ring rules, extracted verbatim
 * from presentation-player.css below: the veil as the FOUR panels
 * that tile the viewport around the hole (Oscar's corrected veil
 * principle: the panels darken and slightly desaturate the ground —
 * they never blur it, so the app behind stays readable), the
 * ring as itself. The scenarios (preview/scenario-edge-*.mjs) measure
 * the painted DOM: the ring contained, every panel on-screen, and the
 * hole itself free of any panel.
 *
 * Run: node scripts/presentation/build-edge-probe.mjs   (from app-copy)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { containedHole } from '../../src/lib/presentation/engine/geometry.ts'

const here = dirname(fileURLToPath(import.meta.url))
const previewDir = join(here, '..', '..', '..', 'preview')

const playerCss = readFileSync(join(here, '..', '..', 'src', 'lib', 'presentation', 'engine', 'presentation-player.css'), 'utf8')
const rule = (selector) => {
  const match = playerCss.match(new RegExp(`\\${selector} \\{[^}]*\\}`))
  if (!match) throw new Error(`rule ${selector} not found in presentation-player.css`)
  return match[0]
}

/* Logos' dark theme tokens (the same values the pack stages). */
const TOKENS = `:root {
  --bg: #09090d; --bg-2: #101016; --line: #26262e; --line-2: #34343e;
  --ink: #f2ede1; --ink-2: #b9b2a2; --ink-3: #7d7767;
  --accent: #e9bd72; --accent-2: #c98f2e; --accent-soft: rgba(233, 189, 114, 0.14);
  --accent-glow: rgba(233, 189, 114, 0.35); --accent-ink: #221806;
}`

const STAGE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body { background: var(--bg); color: var(--ink); font: 15px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif; overflow: hidden; }
  .stage { position: fixed; inset: 0; background: var(--bg-2); padding: 26px 22px; }
  .stage h1 { font-size: 21px; font-weight: 650; margin-bottom: 6px; }
  .stage .sub { color: var(--ink-2); font-size: 13.5px; margin-bottom: 22px; }
  .row { display: flex; align-items: center; gap: 12px; padding: 13px 2px; border-bottom: 1px solid var(--line); }
  .row .t { flex: 1; }
  .row .t b { display: block; font-weight: 600; font-size: 15px; }
  .row .t span { color: var(--ink-3); font-size: 12.5px; }
  .row .pill { color: var(--ink-2); border: 1px solid var(--line-2); border-radius: 99px; padding: 5px 12px; font-size: 13px; }
  /* The bottom tab bar, flush with the screen's bottom edge. */
  .tabbar { position: fixed; left: 0; right: 0; bottom: 0; height: 64px; background: var(--bg);
    border-top: 1px solid var(--line); display: flex; }
  .tabbar .cell { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 2px; color: var(--ink-3); font-size: 11px; }
  .tabbar .cell .g { font-size: 19px; line-height: 1; }
  /* The focused controls (the anchors under test). */
  .edge-anchor { background: color-mix(in srgb, var(--accent) 16%, var(--bg)); color: var(--accent);
    display: flex; align-items: center; justify-content: center; font-size: 22px; }
  #anchor-bottom { position: fixed; left: 24px; top: 780px; width: 72px; height: 64px; }
  #anchor-right { position: fixed; left: 314px; top: 320px; width: 76px; height: 52px; border-radius: 14px 0 0 14px; }
`

const page = (title, bodyHtml, hole) => `<!doctype html>
<html lang="es" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
${TOKENS}
${rule('.lp-veil')}
${rule('.lp-veil-t')}
${rule('.lp-veil-b')}
${rule('.lp-veil-l')}
${rule('.lp-veil-r')}
${rule('.lp-ring')}
${STAGE_CSS}
</style>
</head>
<body>
${bodyHtml}
  <div class="lp-veil lp-veil-t" aria-hidden style="height:${hole.top}px"></div>
  <div class="lp-veil lp-veil-b" aria-hidden style="top:${hole.top + hole.height}px"></div>
  <div class="lp-veil lp-veil-l" aria-hidden style="top:${hole.top}px;height:${hole.height}px;width:${hole.left}px"></div>
  <div class="lp-veil lp-veil-r" aria-hidden style="top:${hole.top}px;height:${hole.height}px;left:${hole.left + hole.width}px"></div>
  <div class="lp-ring" aria-hidden style="top:${hole.top}px;left:${hole.left}px;width:${hole.width}px;height:${hole.height}px"></div>
</body>
</html>
`

const VW = 390
const VH = 844
const report = []

/* ── Bottom edge: the λ cell of the bottom tab bar (its bottom IS 844). ── */
const bottomAnchor = { top: 780, left: 24, width: 72, height: 64 }
const bottomHole = containedHole(bottomAnchor, VW, VH)
report.push(
  `bottom: anchor bottom=${bottomAnchor.top + bottomAnchor.height} · old hole bottom=${bottomAnchor.top + bottomAnchor.height + 10} (CUT) · contained hole bottom=${bottomHole.top + bottomHole.height}`,
)
writeFileSync(
  join(previewDir, 'edge-bottom.html'),
  page(
    'Borde inferior — la burbuja en la barra',
    `  <div class="stage">
    <h1>Escuchar</h1>
    <p class="sub">El texto que trajiste, en voz alta.</p>
    <div class="row"><div class="t"><b>El puerto al amanecer</b><span>Texto · 3 min</span></div><span class="pill">Oír</span></div>
    <div class="row"><div class="t"><b>La carta del faro</b><span>Libro · Capítulo 1</span></div><span class="pill">Oír</span></div>
    <div class="row"><div class="t"><b>Notas de la semana</b><span>Texto · 1 min</span></div><span class="pill">Oír</span></div>
  </div>
  <div class="tabbar">
    <div class="cell"><span class="g">♪</span>Escuchar</div>
    <div class="cell"><span class="g">▤</span>Biblioteca</div>
    <div class="cell"><span class="g">⚙</span>Ajustes</div>
  </div>
  <div class="edge-anchor" id="anchor-bottom">λ</div>`,
    bottomHole,
  ),
)

/* ── Right edge: a control flush with the screen's right edge (x=390). ── */
const rightAnchor = { top: 320, left: 314, width: 76, height: 52 }
const rightHole = containedHole(rightAnchor, VW, VH)
report.push(
  `right:  anchor right=${rightAnchor.left + rightAnchor.width} · old hole right=${rightAnchor.left + rightAnchor.width + 10} (CUT) · contained hole right=${rightHole.left + rightHole.width}`,
)
writeFileSync(
  join(previewDir, 'edge-right.html'),
  page(
    'Borde derecho — control al ras',
    `  <div class="stage">
    <h1>Ajustes</h1>
    <p class="sub">El reproductor flotante y la burbuja.</p>
    <div class="row"><div class="t"><b>Voz</b><span>Bolsillo · Español</span></div><span class="pill">Cambiar</span></div>
    <div class="row"><div class="t"><b>Velocidad</b><span>1×</span></div><span class="pill">Ajustar</span></div>
    <div class="row"><div class="t"><b>Burbuja flotante</b><span>Activa</span></div></div>
  </div>
  <div class="edge-anchor" id="anchor-right">λ</div>`,
    rightHole,
  ),
)

console.log('edge probes built:')
for (const line of report) console.log(' ', line)
