// 1.2.2: while preparing, an inaudible keep-alive track plays; then speech takes over with no tap.
import { chromium } from '/workspace/work/browser-test/node_modules/playwright-core/index.mjs';
import { BASE, PHONE } from './common.mjs';
const ctx = await chromium.launchPersistentContext('/tmp/logos-p120', { executablePath: '/workspace/work/browser-test/browsers/chromium_headless_shell-1155/chrome-linux/headless_shell', args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:8899'], ...PHONE });
const p = ctx.pages()[0] ?? await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)) });
await p.addInitScript(() => {
  localStorage.setItem('logos.debug', '1');
  const orig = HTMLMediaElement.prototype.play;
  window.__plays = [];
  HTMLMediaElement.prototype.play = function () { window.__plays.push({ src: this.src.slice(0, 30), loop: this.loop }); window.__aud = this; return orig.call(this) };
});
await p.goto(BASE); await p.waitForFunction(() => window.__logos);
await p.fill('textarea', 'A fresh sentence for the keep alive test. And a second one follows here. Then a third.');
await p.click('.play-btn');
await p.waitForTimeout(1500);
console.log('during prep', JSON.stringify(await p.evaluate(() => ({ loop: __aud?.loop, paused: __aud?.paused, cushion: !!__logos.listen.listen.get().cushion, buf: __logos.listen.listen.get().buffering }))));
for (let i = 0; i < 240; i++) { const ok = await p.evaluate(() => { const l = __logos.listen.listen.get(); return l.playing && !l.buffering && !l.cushion && __aud && !__aud.loop && !__aud.paused }); if (ok) break; await p.waitForTimeout(500); }
console.log('speaking', JSON.stringify(await p.evaluate(() => ({ loop: __aud.loop, paused: __aud.paused, t: __aud.currentTime, cur: __logos.listen.listen.get().current, plays: __plays }))));
console.log('errs', JSON.stringify(errs));
await ctx.close();
