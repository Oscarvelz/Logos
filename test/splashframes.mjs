import { launch, BASE, PHONE } from './common.mjs';
const b = await launch(); const ctx = await b.newContext(PHONE);
const w = await ctx.newPage(); await w.goto(BASE + '#/listen'); await w.waitForTimeout(6000); await w.close();
const p = await ctx.newPage();
await p.addInitScript(() => { const st = window.setTimeout; window.setTimeout = (f, d, ...a) => (d >= 5000 ? 0 : st(f, d, ...a)); Object.defineProperty(window, '__logosReady', { set() {}, get() { return () => {} } }) });
await p.goto(BASE + '#/listen', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
for (const t of [0, 400, 900, 1300, 1900, 2900]) {
  await p.evaluate((t) => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = t } }, t);
  await p.screenshot({ path: `test/out-sp-${t}.png`, timeout: 15000 });
}
await b.close();
