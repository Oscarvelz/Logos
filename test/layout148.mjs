import { launch, BASE, PHONE, TABLET } from './common.mjs';
const b = await launch();
const TEXT = Array.from({ length: 8 }, (_, i) => `Párrafo ${i + 1}. Un juez federal desestimó una demanda del Departamento de Justicia que buscaba retrasar la certificación de la contienda, debido a un supuesto plan para confundir a los votantes.`).join('\n\n');
for (const [name, dev] of [['phone', PHONE], ['phoneShort', { ...PHONE, viewport: { width: 384, height: 740 } }], ['tablet', TABLET]]) for (const theme of ['dark', 'light']) {
  const ctx = await b.newContext(dev); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript((th) => { localStorage.setItem('logos.debug', '1'); const k = 'logos.settings.v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.theme = th; s.listenSpeed = 1.7; localStorage.setItem(k, JSON.stringify(s)) }, theme);
  await p.goto(BASE + '#/listen'); await p.waitForFunction(() => window.__logos); await p.waitForTimeout(700);
  const m = () => p.evaluate(() => { const c = document.querySelector('.listen-grid > .card').getBoundingClientRect(); const pl = document.querySelector('.player-card').getBoundingClientRect(); const nav = document.querySelector('.nav')?.getBoundingClientRect();
    return { textBottom: Math.round(c.bottom), playerTop: Math.round(pl.top), playerBottom: Math.round(pl.bottom), navTop: nav ? Math.round(nav.top) : null, vh: innerHeight, docScroll: document.documentElement.scrollHeight - innerHeight } });
  const editor = await m();
  await p.fill('textarea', TEXT); await p.evaluate(() => { __logos.listen.loadText(document.querySelector('textarea').value) }); await p.waitForTimeout(200);
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Back to reading view')?.click()); await p.waitForTimeout(500);
  const reading = await m();
  if (theme === 'dark') await p.screenshot({ path: `test/shots/layout-${name}-paused.png` });
  await p.evaluate(() => __logos.listen.listen.set({ playing: true })); await p.waitForTimeout(1100);
  const playing = await m();
  if (theme === 'dark') await p.screenshot({ path: `test/shots/layout-${name}-playing.png` });
  await p.evaluate(() => __logos.listen.listen.set({ playing: false })); await p.waitForTimeout(900);
  const back = await m();
  console.log(name, theme, JSON.stringify({ editor, reading, playing, back, errs }));
  await ctx.close();
}
await b.close();
