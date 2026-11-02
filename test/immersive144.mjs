import { launch, BASE, PHONE, TABLET } from './common.mjs';
const b = await launch();
const TEXT = Array.from({ length: 6 }, (_, i) => `Paragraph ${i + 1}. The word logos meant both speech and reason, and Heraclitus believed it was the hidden order beneath all change. We listen, and we understand.`).join('\n\n');
for (const [name, dev] of [['phone', PHONE], ['tablet', TABLET]]) for (const theme of ['dark', 'light']) {
  const ctx = await b.newContext(dev); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript((th) => { localStorage.setItem('logos.debug', '1'); const k = 'logos.settings.v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.theme = th; localStorage.setItem(k, JSON.stringify(s)) }, theme);
  await p.goto(BASE + '#/listen'); await p.waitForFunction(() => window.__logos); await p.waitForTimeout(800);
  await p.fill('textarea', TEXT); await p.evaluate(() => { __logos.listen.loadText(document.querySelector('textarea').value) }); await p.waitForTimeout(300);
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Back to reading view'); b?.click() }); await p.waitForTimeout(400);
  await p.evaluate(() => scrollTo(0, 99999)); await p.waitForTimeout(300); await p.evaluate(() => scrollTo(0, 120)); await p.waitForTimeout(300);
  const st = async () => p.evaluate(() => { const n = document.querySelector('.nav'); const c = document.querySelector('.player-card'); const r = n && getComputedStyle(n); return { imm: document.documentElement.dataset.immersive ?? null, nav: r ? `${r.transform} op=${(+r.opacity).toFixed(2)} vis=${r.visibility}` : 'none', card: c ? getComputedStyle(c).transform : 'none', cardBottom: c ? Math.round(innerHeight - c.getBoundingClientRect().bottom) : null, firstSentTop: Math.round(document.querySelector('.sent')?.getBoundingClientRect().top ?? -1) } });
  const before = await st();
  // fast toggle: should never go immersive
  await p.evaluate(() => { __logos.listen.listen.set({ playing: true }); setTimeout(() => __logos.listen.listen.set({ playing: false }), 100) });
  await p.waitForTimeout(400); const fast = (await st()).imm;
  await p.evaluate(() => __logos.listen.listen.set({ playing: true }));
  if (name === 'phone' && theme === 'dark') for (const ms of [250, 400, 550, 900]) { await p.waitForTimeout(ms === 250 ? 250 : 150 + (ms === 900 ? 200 : 0)); await p.screenshot({ path: `test/shots/imm-${ms}.png` }) }
  await p.waitForTimeout(900); const playing = await st();
  if (name === 'phone') await p.screenshot({ path: `test/shots/imm-${name}-${theme}-playing.png` });
  await p.evaluate(() => __logos.listen.listen.set({ playing: false })); await p.waitForTimeout(800); const paused = await st();
  await p.screenshot({ path: `test/shots/imm-${name}-${theme}-paused.png` });
  await p.evaluate(() => __logos.listen.listen.set({ playing: true })); await p.waitForTimeout(500);
  await p.evaluate(() => __logos.listen.listen.set({ error: 'boom' })); await p.waitForTimeout(100); const onErr = (await st()).imm;
  await p.evaluate(() => __logos.listen.listen.set({ error: null })); await p.waitForTimeout(500);
  await p.evaluate(() => { location.hash = '#/voices' }); await p.waitForTimeout(700); const away = (await st()).imm;
  console.log(name, theme, JSON.stringify({ before, fast, playing, paused, onErr, away, errs }));
  await ctx.close();
}
await b.close();
