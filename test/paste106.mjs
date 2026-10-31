// 1.0.6: pasting text starts preparing audio before play.
import { chromium } from '/workspace/work/browser-test/node_modules/playwright-core/index.mjs';
import { BASE, PHONE } from './common.mjs';
const ctx = await chromium.launchPersistentContext('/tmp/logos-profile', { executablePath: '/workspace/work/browser-test/browsers/chromium_headless_shell-1155/chrome-linux/headless_shell', args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:8899', '--autoplay-policy=no-user-gesture-required'], ...PHONE });
const p = ctx.pages()[0] ?? await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await p.addInitScript(() => localStorage.setItem('logos.debug', '1'));
await p.goto(BASE + '#/listen'); await p.waitForFunction(() => window.__logos, null, { timeout: 20000 });
await p.evaluate(() => __logos.listen.endSession());
await p.fill('textarea', 'Pasted text starts now. A second line follows. And a third.');
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(5000);
  const s = await p.evaluate(() => { const l = __logos.listen.listen.get(); return { playing: l.playing, ready: l.rendered.filter(Boolean).length, n: l.segments.length, note: document.querySelector('.engine-note')?.textContent } });
  console.log(JSON.stringify(s));
  if (s.ready >= 1) break;
}
console.log('errors', JSON.stringify(errs));
await ctx.close();
