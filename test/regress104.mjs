// 1.0.4 regression: phone that was set to WebGPU and crashed mid-load.
import { chromium } from '/workspace/work/browser-test/node_modules/playwright-core/index.mjs';
import { BASE, PHONE } from './common.mjs';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const ctx = await chromium.launchPersistentContext('/tmp/logos-profile', {
  executablePath: '/workspace/work/browser-test/browsers/chromium_headless_shell-1155/chrome-linux/headless_shell',
  args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:8899', '--autoplay-policy=no-user-gesture-required'], ...PHONE,
});
const p = ctx.pages()[0] ?? await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let navs = 0; p.on('framenavigated', (f) => { if (f === p.mainFrame()) navs++; });
await p.goto(BASE); await p.waitForTimeout(2000);
// Put the phone in Oscar's state: engine=webgpu, and a load that "crashed".
await p.evaluate(() => {
  localStorage.setItem('logos.debug', '1');
  const s = JSON.parse(localStorage.getItem('logos.settings.v1') || '{}'); s.engine = 'webgpu'; localStorage.setItem('logos.settings.v1', JSON.stringify(s));
  localStorage.setItem('logos.loadingSince', JSON.stringify({ device: 'webgpu', t: Date.now() }));
  localStorage.removeItem('logos.gpuBroken');
});
navs = 0;
await p.reload(); await p.waitForFunction(() => window.__logos, null, { timeout: 20000 });
await p.waitForTimeout(4000);
const st = await p.evaluate(() => ({ engineSetting: JSON.parse(localStorage.getItem('logos.settings.v1')).engine, gpuBroken: localStorage.getItem('logos.gpuBroken'), status: __logos.engine.engine.get().status, loadingFlag: localStorage.getItem('logos.loadingSince') }));
log('after crash-reload', JSON.stringify(st), 'navigations', navs);
await p.goto(BASE + '#/settings'); await p.waitForTimeout(1500);
log('settings has WebGPU button:', await p.locator('text=WebGPU').count() > 0 ? 'some text' : 'none', '| seg buttons:', await p.locator('button:has-text("WebGPU")').count());
await p.goto(BASE + '#/listen'); await p.waitForTimeout(1000);
// Long text like his (43 sentences)
const sent = ['The word logos meant, for the Greeks, both speech and reason.', 'Heraclitus believed it was the hidden order beneath all change.', 'We listen, and we understand.', 'Every sentence here is short enough to start quickly.'];
const text = Array.from({ length: 43 }, (_, i) => sent[i % 4]).join(' ');
const r = await p.evaluate(async (txt) => {
  const L = __logos.listen; L.loadText(txt); const t = performance.now(); void L.play(0);
  let first = null; const marks = [];
  while (performance.now() - t < 200000) {
    const s = L.listen.get();
    if (s.error) return { err: s.error };
    if (first === null && s.playing && !s.buffering && s.mode === 'kokoro') first = Math.round(performance.now() - t);
    if (s.current >= 3) { marks.push(Math.round(performance.now() - t)); break; }
    const e0 = __logos.engine.engine.get(); const line = `${e0.status}/${e0.phase} mode=${s.mode} cur=${s.current} play=${s.playing} buf=${s.buffering} r=${s.rendered.filter(Boolean).length} cush=${JSON.stringify(s.cushion)}`;
    if (line !== marks.last) { marks.log = (marks.log || []).concat(Math.round((performance.now() - t)/100)/10 + 's ' + line); marks.last = line; }
    await new Promise((r) => setTimeout(r, 50));
  }
  const e = __logos.engine.engine.get();
  return { log: marks.log, firstAudioMs: first, reachedSentence4Ms: marks[0] ?? null, device: e.device, dtype: e.dtype, rtf: e.lastRtf, cur: L.listen.get().current, rendered: L.listen.get().rendered.filter(Boolean).length };
}, text);
log('listen', JSON.stringify(r, null, 1));
// Voice change mid-play
const v = await p.evaluate(async () => {
  const t = performance.now(); const { settings } = await import('/Logos/src/lib/settings.ts').catch(() => ({}));
  return 'skip';
});
log('page errors', JSON.stringify(errs), 'reloads during test', navs);
await ctx.close();
