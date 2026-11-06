import { launch, BASE, PHONE } from './common.mjs';
const b = await launch(); const ctx = await b.newContext(PHONE);
const w = await ctx.newPage(); await w.goto(BASE + '#/listen'); await w.waitForTimeout(6000); await w.close();
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
const t0 = Date.now(); await p.goto(BASE + '#/listen', { waitUntil: 'commit' });
for (const t of [150, 800, 1500, 2300, 3300]) { const ww = t - (Date.now() - t0); if (ww > 0) await p.waitForTimeout(ww); try { await p.screenshot({ path: `test/out-sp-${t}.png`, timeout: 5000 }); } catch (e) { console.log('shot fail', t) } console.log(t, Date.now() - t0) }
await p.waitForTimeout(2000);
console.log('splash gone', await p.evaluate(() => !document.getElementById('splash')));
await p.reload(); await p.waitForTimeout(300); console.log('second load splash present', await p.evaluate(() => !!document.getElementById('splash')));
console.log(errs); await b.close();
