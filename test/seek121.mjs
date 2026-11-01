// 1.2.1: going back to rendered audio is instant; scrubber seeks.
import { chromium } from '/workspace/work/browser-test/node_modules/playwright-core/index.mjs';
import { BASE, PHONE } from './common.mjs';
const ctx = await chromium.launchPersistentContext('/tmp/logos-p120', { executablePath: '/workspace/work/browser-test/browsers/chromium_headless_shell-1155/chrome-linux/headless_shell', args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:8899', '--autoplay-policy=no-user-gesture-required'], ...PHONE });
const p = ctx.pages()[0] ?? await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)) });
await p.addInitScript(() => localStorage.setItem('logos.debug', '1'));
await p.goto(BASE); await p.waitForFunction(() => window.__logos);
await p.fill('textarea', 'One. Two is here. Three comes next. Four is after that. Five ends it.');
await p.click('.play-btn');
for (let i = 0; i < 240; i++) { const ok = await p.evaluate(() => { const l = __logos.listen.listen.get(); return l.current >= 2 && l.playing && !l.buffering }); if (ok) break; await p.waitForTimeout(500); }
const st = () => p.evaluate(() => { const l = __logos.listen.listen.get(); return { cur: l.current, playing: l.playing, buf: l.buffering, cushion: !!l.cushion, rendered: l.rendered.filter(Boolean).length } });
console.log('at', JSON.stringify(await st()));
// back twice
const back = await p.evaluate(async () => { const L = __logos.listen; const t = performance.now(); L.seek(0); for (let i = 0; i < 400; i++) { const s = L.listen.get(); if (s.current === 0 && s.playing && !s.buffering && !s.cushion) break; await new Promise(r => setTimeout(r, 10)); } return Math.round(performance.now() - t) });
console.log('back to sentence 1 ms', back, JSON.stringify(await st()));
// scrub via pointer to 50%
const box = await p.locator('.scrubber').boundingBox();
await p.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2); await p.mouse.down();
await p.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 5 });
await p.screenshot({ path: 'shots/scrub121.png' });
await p.mouse.up();
await p.waitForTimeout(300);
console.log('after scrub 50%', JSON.stringify(await st()), await p.evaluate(() => document.querySelector('audio')?.currentTime ?? 'n/a'));
// paused seek
await p.evaluate(() => __logos.listen.pause());
await p.evaluate(() => __logos.listen.seekFraction(0.05));
console.log('paused seek', JSON.stringify(await st()));
console.log('errs', JSON.stringify(errs));
await ctx.close();
