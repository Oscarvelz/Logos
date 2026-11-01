// Engine speed benchmark: node test/bench.mjs <spin 0|1> <threads>
import { chromium } from '/workspace/work/browser-test/node_modules/playwright-core/index.mjs';
import { BASE, PHONE } from './common.mjs';
const [spin = '0', threads = '2'] = process.argv.slice(2);
const ctx = await chromium.launchPersistentContext('/tmp/logos-bench', {
  executablePath: '/workspace/work/browser-test/browsers/chromium_headless_shell-1155/chrome-linux/headless_shell',
  args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:8899', '--autoplay-policy=no-user-gesture-required'], ...PHONE,
});
const p = ctx.pages()[0] ?? await ctx.newPage();
await p.addInitScript(([s, t]) => { localStorage.setItem('logos.debug', '1'); localStorage.setItem('logos.spin', s); localStorage.setItem('logos.threads', t); localStorage.setItem('logos.settings', JSON.stringify({ ...(JSON.parse(localStorage.getItem('logos.settings') || '{}')), engine: 'wasm' })) }, [spin, threads]);
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(BASE); await p.waitForFunction(() => window.__logos, null, { timeout: 30000 });
const r = await p.evaluate(async () => {
  const E = __logos.engine; await E.ensureModel();
  const txt = 'Heraclitus believed the logos was the hidden order beneath all change, and that we listen to it without understanding.';
  await E.synthesize('Warm up.', 'af_heart', 1, { priority: 1 });
  const out = [];
  for (let i = 0; i < 3; i++) { const t = performance.now(); const res = await E.synthesize(txt, 'af_heart', 1, { priority: 1 }); const ms = performance.now() - t; out.push(+(ms / 1000 / (res.samples.length / res.sampleRate)).toFixed(3)); }
  // main-thread responsiveness during synthesis: worst frame gap
  let worst = 0, last = performance.now(), go = true;
  const loop = () => { const n = performance.now(); worst = Math.max(worst, n - last); last = n; if (go) requestAnimationFrame(loop) }; requestAnimationFrame(loop);
  await E.synthesize(txt, 'af_heart', 1, { priority: 1 }); go = false;
  return { rtf: out, worstFrameMs: Math.round(worst), dev: E.engine.get().device };
});
console.log(JSON.stringify({ spin, threads, ...r, errs }));
await ctx.close();
