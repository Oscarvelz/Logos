import { launch, BASE, PHONE } from './common.mjs';
const b = await launch(); const ctx = await b.newContext(PHONE); const p = await ctx.newPage();
await p.goto(BASE + '#/listen'); await p.waitForTimeout(5000);
for (const r of ['listen', 'voices', 'create', 'library', 'settings', 'voices']) {
  await p.click(`nav a[href="#/${r}"], nav button:has-text("${r[0].toUpperCase() + r.slice(1)}")`).catch(() => p.goto(BASE + '#/' + r));
  await p.waitForTimeout(900);
  const m = await p.evaluate(() => { const n = document.querySelector('nav'); const r = n.getBoundingClientRect(); return { top: r.top, h: r.height, bottom: r.bottom, vh: innerHeight, docH: document.documentElement.scrollHeight, bodyCls: document.body.className, sb: innerWidth - document.documentElement.clientWidth } });
  console.log(r, JSON.stringify(m));
}
await p.screenshot({ path: 'test/out-voices-nav.png' });
await b.close();
