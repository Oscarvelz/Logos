// 1.4.24: Pocket model is streamed into the cache and loads from it after reload.
import { chromium } from '/workspace/work/browser-test/node_modules/playwright-core/index.mjs';
import { BASE, PHONE } from './common.mjs';
import { rmSync } from 'node:fs';
rmSync('/tmp/logos-p1424e', { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext('/tmp/logos-p1424e', { executablePath: '/workspace/work/browser-test/browsers/chromium_headless_shell-1155/chrome-linux/headless_shell', args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:8899'], ...PHONE });
const p = ctx.pages()[0] ?? await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('worker', w => w.on('console', m => errs.push('W '+m.text().slice(0,300)))); p.on('console', m => { if (m.type() !== 'log') errs.push(m.type()+': '+m.text().slice(0,200)) }); ctx.on('serviceworker', () => {});
await p.addInitScript(() => { localStorage.setItem('logos.debug', '1'); localStorage.setItem('logos.phononThreads', '1') });
await p.goto(BASE); await p.waitForTimeout(6000); await p.waitForFunction(() => window.__logos);
const t0 = Date.now();
const r = await p.evaluate(async () => { try { const x = await __logos.engine.synthesize('Hello there.', 'ph_NbpkqMVS3CJeq2j8', 1); return x.samples.length } catch (e) { return String(e) } });
console.log(((Date.now()-t0)/1000).toFixed(0), 's synth', r);
await p.waitForTimeout(3000);
console.log('cache', await p.evaluate(async () => { const c = await caches.open('phonon-tts-v1'); const out = []; for (const k of await c.keys()) { const r = await c.match(k); out.push([k.url.split('/').pop(), (await r.blob()).size]) } return out }));
console.log('all', await p.evaluate(async () => { const o = {}; for (const n of await caches.keys()) { const c = await caches.open(n); o[n] = (await c.keys()).map(k => k.url.slice(-60)) } return o }));
console.log('errs', errs.slice(0, 5));
await ctx.close();
