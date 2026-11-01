// 1.2.0: PocketTTS default voices: load, play EN + ES, export check, no errors.
import { chromium } from '/workspace/work/browser-test/node_modules/playwright-core/index.mjs';
import { BASE, PHONE } from './common.mjs';
const ctx = await chromium.launchPersistentContext('/tmp/logos-p120', { executablePath: '/workspace/work/browser-test/browsers/chromium_headless_shell-1155/chrome-linux/headless_shell', args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:8899', '--autoplay-policy=no-user-gesture-required'], ...PHONE });
const p = ctx.pages()[0] ?? await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)) });
await p.addInitScript(() => localStorage.setItem('logos.debug', '1'));
await p.goto(BASE); await p.waitForFunction(() => window.__logos);
const t0 = Date.now();
await p.fill('textarea', 'The word logos meant both speech and reason. Heraclitus believed it was the hidden order beneath all change. We listen, and we understand.');
await p.click('.play-btn');
let last = '';
for (let i = 0; i < 200; i++) {
  const s = await p.evaluate(() => { const e = __logos.engine.engine.get(); const l = __logos.listen.listen.get(); return `${e.family} ${e.status} ${e.phase} ${Math.round(e.progress*100)}% | cur=${l.current}/${l.segments.length} playing=${l.playing} buf=${l.buffering} rendered=${l.rendered.filter(Boolean).length} v=${l.voices[0]} err=${l.error} eerr=${e.error}` });
  if (s !== last) { console.log(((Date.now()-t0)/1000).toFixed(1), s); last = s; }
  if (/err=[^n]/.test(s) || /cur=2\/3 playing=true buf=false/.test(s)) break;
  await p.waitForTimeout(1000);
}
console.log('rtf', await p.evaluate(() => __logos.engine.engine.get().lastRtf));
await p.screenshot({ path: 'shots/p120-listen.png' });
// Spanish
await p.evaluate(() => __logos.listen.endSession());
const es = await p.evaluate(async () => { const L = __logos.listen; L.loadText('Hola, Óscar. La palabra es pensamiento que se vuelve sonido.'); const t = performance.now(); void L.play(0);
  for (let i = 0; i < 3000; i++) { const s = L.listen.get(); if (s.error) return { err: s.error }; if (s.playing && !s.buffering) break; await new Promise(r => setTimeout(r, 50)); }
  return { ms: Math.round(performance.now() - t), voices: L.listen.get().voices, langs: L.listen.get().segments.map(g => g.lang) }; });
console.log('ES', JSON.stringify(es));
console.log('errs', JSON.stringify(errs.slice(0, 8)));
await ctx.close();
