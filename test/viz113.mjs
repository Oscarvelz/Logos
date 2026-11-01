// Visualizer runs in a worker (OffscreenCanvas) while the voice plays; no errors.
import { chromium } from '/workspace/work/browser-test/node_modules/playwright-core/index.mjs';
import { BASE, PHONE } from './common.mjs';
const ctx = await chromium.launchPersistentContext('/tmp/logos-bench', { executablePath: '/workspace/work/browser-test/browsers/chromium_headless_shell-1155/chrome-linux/headless_shell', args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:8899', '--autoplay-policy=no-user-gesture-required'], ...PHONE });
const p = ctx.pages()[0] ?? await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) });
await p.addInitScript(() => localStorage.setItem('logos.debug', '1'));
await p.goto(BASE); await p.waitForFunction(() => window.__logos);
await p.fill('textarea', 'Short line one. And a second short line.');
await p.click('.play-btn');
for (let i = 0; i < 100; i++) { const s = await p.evaluate(() => { const l = __logos.listen.listen.get(); return l.playing && !l.buffering && l.mode === 'neural' }); if (s) break; await p.waitForTimeout(1000); }
await p.waitForTimeout(1500);
const viz = await p.evaluate(() => { const c = document.querySelector('canvas.viz'); return { off: c?.dataset.off, cw: c?.clientWidth } });
await p.screenshot({ path: 'shots/viz113.png' });
console.log(JSON.stringify({ viz, state: await p.evaluate(() => { const l = __logos.listen.listen.get(); return { playing: l.playing, cur: l.current, err: l.error } }), errs }));
await ctx.close();
