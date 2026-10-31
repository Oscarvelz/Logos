// 1.0.5: preload until it can read to the end, then play with no stalls.
import { chromium } from '/workspace/work/browser-test/node_modules/playwright-core/index.mjs';
import { BASE, PHONE } from './common.mjs';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const ctx = await chromium.launchPersistentContext('/tmp/logos-profile', {
  executablePath: '/workspace/work/browser-test/browsers/chromium_headless_shell-1155/chrome-linux/headless_shell',
  args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:8899', '--autoplay-policy=no-user-gesture-required'], ...PHONE,
});
const p = ctx.pages()[0] ?? await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await p.addInitScript(() => localStorage.setItem('logos.debug', '1'));
await p.goto(BASE); await p.waitForFunction(() => window.__logos, null, { timeout: 20000 });
log('deviceFallback', await p.evaluate(() => JSON.parse(localStorage.getItem('logos.settings.v1') || '{}').deviceFallback));
const text = 'We listen. And we understand. The word was spoken. Then it was heard. Reason follows speech. Speech follows thought. Thought follows life. That is all.';
const r = await p.evaluate(async (txt) => {
  const L = __logos.listen; L.loadText(txt); const t = performance.now(); void L.play(0);
  let started = null, stalls = 0, prevBuf = true, log = [], last = '';
  while (performance.now() - t < 400000) {
    const s = L.listen.get();
    if (s.error) return { err: s.error, log };
    const line = s.cushion ? `prep ${s.cushion.done}/${s.cushion.total} eta=${s.cushion.eta && Math.round(s.cushion.eta)}` : `cur=${s.current} buf=${s.buffering} play=${s.playing}`;
    if (line !== last) { log.push(Math.round((performance.now() - t) / 1000) + 's ' + line); last = line; }
    if (started === null && s.playing && !s.buffering) started = performance.now() - t;
    if (started !== null && s.buffering && !prevBuf) stalls++;
    prevBuf = s.buffering;
    if (s.finished) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  return { startedS: started && Math.round(started / 1000), totalS: Math.round((performance.now() - t) / 1000), stalls, finished: L.listen.get().finished, rtf: __logos.engine.engine.get().lastRtf, log };
}, text);
log(JSON.stringify(r, null, 1)); log('errors', JSON.stringify(errs));
await ctx.close();
