// 1.2.3: Kokoro is WebGPU-only; without a GPU it errors clearly (no WASM load).
import { chromium } from '/workspace/work/browser-test/node_modules/playwright-core/index.mjs';
import { BASE, PHONE } from './common.mjs';
const ctx = await chromium.launchPersistentContext('/tmp/logos-gpu123', { executablePath: '/workspace/work/browser-test/browsers/chromium_headless_shell-1155/chrome-linux/headless_shell', args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:8899'], ...PHONE });
const p = ctx.pages()[0] ?? await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); await p.addInitScript(() => localStorage.setItem('logos.debug', '1'));
await p.goto(BASE); await p.waitForFunction(() => window.__logos);
const r = await p.evaluate(async () => { try { await __logos.engine.synthesize('Hello.', 'af_heart', 1, {}); return 'synth ok?!' } catch (e) { return String(e.message) } });
console.log('kokoro:', r, JSON.stringify(await p.evaluate(() => { const k = __logos.engine.kokoro.get(); return { status: k.status, device: k.device } })));
console.log('errs', JSON.stringify(errs));
await ctx.close();
