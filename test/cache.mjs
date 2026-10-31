import { chromium } from '/workspace/work/browser-test/node_modules/playwright-core/index.mjs';
import { BASE, PHONE } from './common.mjs';
const ctx = await chromium.launchPersistentContext('/tmp/logos-profile', {
  executablePath: '/workspace/work/browser-test/browsers/chromium_headless_shell-1155/chrome-linux/headless_shell',
  args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:8899'], ...PHONE });
const hf = [];
ctx.on('request', (r) => { if (/huggingface|hf\.co|xethub/.test(r.url())) hf.push(r.url().slice(0, 120)) });
const p = ctx.pages()[0] ?? await ctx.newPage();
await p.addInitScript(() => localStorage.setItem('logos.debug', '1'));
await p.goto(BASE); await p.waitForTimeout(2000);
await p.waitForFunction(() => window.__logos, null, { timeout: 20000 });
const t0 = Date.now(); const seen = [];
for (let i = 0; i < 60; i++) { const s = await p.evaluate(() => { const e = __logos.engine.engine.get(); return e.status + ' ' + e.phase + ' pill=' + (document.querySelector('.status-pill')?.textContent) + ' note=' + (document.querySelector('.engine-note')?.textContent ?? '') }); if (seen.at(-1) !== s) seen.push(((Date.now()-t0)/1000).toFixed(1) + 's ' + s); if (s.startsWith('ready')) break; await p.waitForTimeout(500) }
console.log(seen.join('\n'));
console.log('caches', await p.evaluate(async () => { const out = {}; for (const n of await caches.keys()) out[n] = (await (await caches.open(n)).keys()).length; return out }));
console.log('persisted', await p.evaluate(() => navigator.storage.persisted()));
console.log('HF requests', hf.length, hf.slice(0, 8));
await ctx.close();
