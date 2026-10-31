import { chromium } from '/workspace/work/browser-test/node_modules/playwright-core/index.mjs';
import { BASE, PHONE } from './common.mjs';
const ctx = await chromium.launchPersistentContext('/tmp/logos-profile', {
  executablePath: '/workspace/work/browser-test/browsers/chromium_headless_shell-1155/chrome-linux/headless_shell',
  args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:8899', '--autoplay-policy=no-user-gesture-required'], ...PHONE });
const p = ctx.pages()[0] ?? await ctx.newPage();
p.on('pageerror', (e) => console.log('PAGEERR', String(e)));
await p.addInitScript(() => localStorage.setItem('logos.debug', '1'));
await p.goto(BASE); await p.waitForTimeout(2000);
await p.waitForFunction(() => window.__logos && __logos.engine.engine.get().status === 'ready', null, { timeout: 60000 });
const TXT = 'The word logos meant speech and reason. Heraclitus called it the hidden order. We listen, and we understand. Then we speak again.';
const r = await p.evaluate(async (txt) => {
  const L = __logos.listen; L.loadText(txt); void L.play(0); const t0 = performance.now();
  const log = []; let last = '';
  while (performance.now() - t0 < 240000) {
    const s = L.listen.get();
    const k = `cur=${s.current} buf=${s.buffering} cushion=${s.cushion ? Math.round(s.cushion.have)+'/'+Math.round(s.cushion.need) : '-'} fin=${s.finished}`;
    if (k !== last) { log.push(((performance.now()-t0)/1000).toFixed(1)+'s '+k); last = k }
    if (s.finished) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  return log;
}, TXT);
console.log(r.join('\n'));
await p.screenshot({ path: 'shots/flow.png' });
await ctx.close();
