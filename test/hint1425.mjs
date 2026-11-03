import { launch, BASE, PHONE } from './common.mjs';
const b = await launch();
for (const w of [412, 360]) { const ctx = await b.newContext({ ...PHONE, viewport: { width: w, height: 900 } }); const p = await ctx.newPage();
await p.addInitScript(() => localStorage.setItem('logos.debug', '1'));
await p.goto(BASE + '#/settings'); await p.waitForTimeout(6000); await p.waitForFunction(() => window.__logos);
await p.evaluate(() => __logos.listen.loadText('The word logos meant both speech and reason. Heraclitus believed it was the hidden order beneath all change.'));
await p.evaluate(() => { location.hash = '#/listen' }); await p.waitForTimeout(1500);
await p.waitForTimeout(800); const h = p.locator('.rh-hint');
console.log(w, await h.count() ? await h.evaluate(e => ({ t: e.textContent, lines: Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)), over: e.scrollWidth > e.clientWidth })) : 'no hint');
await p.screenshot({ path: `test/out-hint${w}.png`, clip: { x: 0, y: 0, width: w, height: 500 } }); await ctx.close(); }
await b.close();
