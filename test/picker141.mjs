import { launch, BASE, PHONE, TABLET } from './common.mjs';
const b = await launch();
for (const [name, dev] of [['phone', PHONE], ['tablet', TABLET]]) {
  const ctx = await b.newContext(dev); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '#/listen'); await p.waitForTimeout(1500);
  await p.click('button[aria-label="Voice"]'); await p.waitForTimeout(700);
  const heads = await p.$$eval('.vgroup-head', (els) => els.map((e) => e.innerText.replace(/\n/g, ' | ') + ' [' + e.getAttribute('aria-expanded') + ']'));
  console.log(name, heads);
  await p.screenshot({ path: `test/shots/picker-${name}-1.png` });
  await p.click('[data-group="es-MX"] .vgroup-head'); await p.waitForTimeout(1200); await p.evaluate(() => document.querySelector(".sheet").scrollBy(0, 400)); await p.waitForTimeout(300);
  const open = await p.$$eval('.vgroup', (els) => els.filter((e) => e.classList.contains('open')).map((e) => e.dataset.group));
  console.log('open', open);
  await p.screenshot({ path: `test/shots/picker-${name}-2.png` });
  const wrap = await p.$$eval('.vgroup .voice-name, .vgroup-title, .vgroup-meta', (els) => els.filter((e) => e.offsetParent && e.getClientRects().length > 1 || e.scrollWidth > e.clientWidth + 1).map((e) => e.innerText));
  const over = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  console.log('wrap/clip', wrap, 'overflow', over);
  await p.click('[data-group="es-MX"] .pick >> nth=0'); await p.waitForTimeout(600);
  console.log('chip', await p.textContent('button[aria-label="Voice"]'));
  await p.click('button[aria-label="Voice"]'); await p.waitForTimeout(700);
  console.log('reopen open', await p.$$eval('.vgroup.open', (els) => els.map((e) => e.dataset.group)));
  await p.screenshot({ path: `test/shots/picker-${name}-3.png` });
  console.log('errors', errs);
  await ctx.close();
}
await b.close();
