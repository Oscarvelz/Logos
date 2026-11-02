import { launch, BASE, PHONE } from './common.mjs';
import fs from 'fs';
const b = await launch(); const ctx = await b.newContext({ ...PHONE, viewport: { width: 384, height: 832 } }); const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.addInitScript(() => { localStorage.setItem('logos.phononThreads', '1'); localStorage.setItem('logos.debug','1') });
await p.goto(BASE + '#/listen'); await p.waitForTimeout(6000);
const T = 'Sleep matters more than most people think. When we sleep, the brain clears waste and stores memories, which is why a long night of rest changes how you feel.';
await p.fill('textarea', T);
await p.waitForFunction(() => document.querySelector('.play-btn, [aria-label="Play"]'));
await p.locator('[aria-label="Play"]').first().click();
await p.waitForSelector('.reader-head', { timeout: 60000 });
const r = await p.evaluate(() => { const h = document.querySelector('.rh-hint'); return { h: Math.round(h.getBoundingClientRect().height), clipped: h.scrollWidth > h.clientWidth, btns: [...document.querySelectorAll('.rh-btn')].map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] }), head: (() => { const r = document.querySelector('.reader-head').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right)] })() } });
console.log('head', JSON.stringify(r));
await p.locator('.reader-head').screenshot({ path: 'test/shots/rh.png' });
// wait until both sentences rendered and dump envelopes + alignment
await p.waitForTimeout(25000);
const d = await p.evaluate(async () => {
  const { alignWords } = await import('/Logos/src/player/wordsync.ts').catch(() => ({}));
  return null;
});
const out = [];
for (let k = 0; k < 40; k++) {
  const c = await p.evaluate(() => { const c = __logos.listen.wordClock?.(); const cur = document.querySelector('.w.cur'); return c ? { idx: c.idx, t: +c.t.toFixed(2), env: k0(c.env), word: cur?.textContent } : null; function k0(e){ return Array.from(e).map(x=>+x.toFixed(3)) } });
  if (c) out.push(c); await p.waitForTimeout(250);
}
fs.writeFileSync('test/out-sync.json', JSON.stringify(out));
console.log(out.map(o => `${o.idx}:${o.t}:${o.word}`).join(' | '));
console.log('errs', errs);
await b.close();
