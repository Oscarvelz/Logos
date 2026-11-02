import { launch, BASE, PHONE, TABLET } from './common.mjs';
const b = await launch();
for (const [name, dev] of [['phone360', { ...PHONE, viewport: { width: 360, height: 800 } }], ['phone', PHONE], ['tablet', TABLET]]) {
  const ctx = await b.newContext(dev); const p = await ctx.newPage();
  await p.addInitScript(() => { const k = 'logos.settings.v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.listenSpeed = 1.7; localStorage.setItem(k, JSON.stringify(s)) });
  await p.goto(BASE + '#/listen'); await p.waitForTimeout(1200);
  const r = await p.evaluate(() => { const card = document.querySelector('.player-card').getBoundingClientRect(); const t = document.querySelector('.transport'); const kids = [...t.children].map((e) => e.getBoundingClientRect()); const play = document.querySelector('.play-btn').getBoundingClientRect();
    return { cardCenter: Math.round(card.left + card.width / 2), playCenter: Math.round(play.left + play.width / 2), leftGap: Math.round(kids[0].left - card.left), rightGap: Math.round(card.right - kids[4].right), overlap: kids.some((k, i) => i && k.left < kids[i - 1].right - 0.5), widths: kids.map((k) => Math.round(k.width)) } });
  console.log(name, JSON.stringify(r));
  await p.locator('.player-card').screenshot({ path: `test/shots/transport-${name}.png` });
  await ctx.close();
}
await b.close();
