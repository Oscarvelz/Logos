import { launch, BASE, PHONE } from './common.mjs';
const b = await launch(); const ctx = await b.newContext({ ...PHONE }); const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.goto(BASE + '#/settings'); await p.waitForTimeout(6000);
await p.evaluate(() => localStorage.setItem('logos.kept', JSON.stringify({ 'pocket.en': Date.now() - 864e5 })));
await p.reload(); await p.waitForTimeout(4000);
const txt = await p.locator('.list-row', { hasText: 'Storage' }).first().innerText();
console.log(JSON.stringify(txt), await p.evaluate(() => localStorage.getItem('logos.kept')), errs);
await p.screenshot({ path: 'test/out-keep.png' });
await b.close();
