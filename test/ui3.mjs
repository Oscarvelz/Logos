import { chromium } from '/workspace/work/browser-test/node_modules/playwright-core/index.mjs';
import { BASE, PHONE } from './common.mjs';
const ctx = await chromium.launchPersistentContext('/tmp/logos-profile', {
  executablePath: '/workspace/work/browser-test/browsers/chromium_headless_shell-1155/chrome-linux/headless_shell',
  args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:8899', '--autoplay-policy=no-user-gesture-required'], ...PHONE,
});
const p = ctx.pages()[0] ?? await ctx.newPage();
await p.addInitScript(() => localStorage.setItem('logos.debug', '1'));
p.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 300)));
await p.goto(BASE + '#/listen'); await p.waitForTimeout(2500);
await p.waitForFunction(() => window.__logos && __logos.engine.engine.get().status === 'ready', null, { timeout: 60000 });
if (await p.locator('textarea').count() === 0) await p.click('button:has-text("Edit")');
await p.fill('textarea', 'One short sentence to test. And a second one right after it.');
await p.click('.play-btn');
await p.waitForFunction(() => { const l = __logos.listen.listen.get(); return l.playing && !l.buffering }, null, { timeout: 90000 });
// pause/resume via media-session-like calls
await p.evaluate(() => __logos.listen.pause()); await p.waitForTimeout(300);
const paused = await p.evaluate(() => __logos.listen.listen.get().playing);
await p.evaluate(() => __logos.listen.resume()); await p.waitForTimeout(500);
console.log('pause->', paused, 'resume->', await p.evaluate(() => __logos.listen.listen.get().playing));
await p.click('button[aria-label="Voice"]'); await p.waitForTimeout(500);
await p.screenshot({ path: 'shots/phone-voice-sheet.png' });
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await p.click('button[aria-label="Playback speed"]'); await p.waitForTimeout(500);
await p.click('.speed-row button:has-text("1.5×")'); await p.waitForTimeout(200);
await p.screenshot({ path: 'shots/phone-speed-sheet.png' });
await p.keyboard.press('Escape');
console.log('rate applied', await p.evaluate(() => __logos.listen && JSON.parse(localStorage.getItem('logos.settings.v1')).listenSpeed));
await p.click('.nav a[href="#/voices"]'); await p.waitForTimeout(600);
await p.click('button[aria-label="Preview Bella"]'); await p.waitForTimeout(1500);
console.log('preview pauses listen:', !(await p.evaluate(() => __logos.listen.listen.get().playing)), 'preview playing btn:', await p.locator('button[aria-label="Pause preview"]').count());
// Settings delete/redownload not exercised (would re-download 92MB)
await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('logos.settings.v1')); s.listenSpeed = 1; localStorage.setItem('logos.settings.v1', JSON.stringify(s)) });
await ctx.close();
console.log('DONE');
