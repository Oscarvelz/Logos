import { launch, BASE, PHONE, TABLET } from './common.mjs';
const b = await launch();
for (const [name, dev, scale] of [['phone360', { ...PHONE, viewport: { width: 360, height: 800 } }, 1], ['phone', PHONE, 1], ['phoneBigFont', PHONE, 1.15], ['tablet', TABLET, 1]]) {
  const ctx = await b.newContext(dev); const p = await ctx.newPage();
  await p.addInitScript(() => { const k = 'logos.settings.v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.listenSpeed = 1.7; s.langMode = 'auto'; localStorage.setItem(k, JSON.stringify(s)) });
  await p.goto(BASE + '#/listen'); await p.waitForTimeout(1000);
  if (scale !== 1) await p.addStyleTag({ content: `html { font-size: ${scale * 100}% } .chip { font-size: ${14 * scale}px }` });
  await p.fill('textarea', 'Hola, Óscar. La palabra es pensamiento que se vuelve sonido. Y el sonido vuelve a ser pensamiento.'); await p.waitForTimeout(400);
  const r = await p.evaluate(() => { const card = document.querySelector('.player-card').getBoundingClientRect(); const top = [...document.querySelectorAll('.player-top .chip')].map((e) => e.getBoundingClientRect()); const play = document.querySelector('.play-btn').getBoundingClientRect(); const tr = [...document.querySelectorAll('.transport button')].map((e) => e.getBoundingClientRect());
    const ov = (a) => a.some((k, i) => i && k.left < a[i - 1].right - 0.5);
    return { center: Math.round(card.left + card.width / 2) - Math.round(play.left + play.width / 2), topOverlap: ov(top), topOut: top.some((k) => k.right > card.right - 10 || k.left < card.left + 10), trOverlap: ov(tr), oneLine: new Set(top.map((k) => Math.round(k.top))).size === 1, chips: [...document.querySelectorAll('.player-top .chip')].map((e) => e.innerText) } });
  console.log(name, JSON.stringify(r));
  await p.locator('.player-card').screenshot({ path: `test/shots/top-${name}.png` });
  await ctx.close();
}
await b.close();
