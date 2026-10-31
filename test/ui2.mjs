import { chromium } from '/workspace/work/browser-test/node_modules/playwright-core/index.mjs';
import { BASE, PHONE, TABLET } from './common.mjs';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const LONG = `Philosophy begins in wonder. The Greeks used the word logos for speech, for reason, and for the order that runs through the world. To read aloud is to give that order a voice.

La poesía es la memoria de la lengua. Cuando la escuchamos, entendemos de otra manera. Cada palabra pesa distinto.

A good listening app should feel effortless: paste, press play, and the words begin. Everything else should stay out of the way.`;
for (const [tag, dev] of [['phone', PHONE], ['tablet', TABLET]]) {
  const ctx = await chromium.launchPersistentContext('/tmp/logos-profile', {
    executablePath: '/workspace/work/browser-test/browsers/chromium_headless_shell-1155/chrome-linux/headless_shell',
    args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:8899', '--autoplay-policy=no-user-gesture-required'], ...dev,
  });
  const p = ctx.pages()[0] ?? await ctx.newPage();
  await p.addInitScript(() => localStorage.setItem('logos.debug', '1'));
  p.on('pageerror', (e) => log('PAGEERR', String(e).slice(0, 300)));
  await p.goto(BASE + '#/listen'); await p.waitForTimeout(2500);
  await p.waitForFunction(() => window.__logos && __logos.engine.engine.get().status === 'ready', null, { timeout: 60000 });
  log(tag, 'model warm-loaded from cache');
  if (await p.locator('textarea').count() === 0) await p.click('button:has-text("Edit")');
  await p.fill('textarea', LONG);
  await p.click('.play-btn');
  await p.waitForFunction(() => { const l = __logos.listen.listen.get(); return l.playing && !l.buffering }, null, { timeout: 90000 });
  log(tag, 'segments', JSON.stringify(await p.evaluate(() => __logos.listen.listen.get().segments.map((s) => s.lang))));
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `shots/${tag}-listen-reading.png` });
  // tap-to-seek: jump to sentence 4 (Spanish paragraph)
  await p.click('.sent[data-i="3"]');
  await p.waitForFunction(() => { const l = __logos.listen.listen.get(); return l.current === 3 && l.playing && !l.buffering }, null, { timeout: 120000 });
  log(tag, 'seek ok -> current', await p.evaluate(() => __logos.listen.listen.get().current), 'voice', await p.evaluate(() => __logos.listen.listen.get().voices[3]));
  await p.screenshot({ path: `shots/${tag}-listen-seek-es.png` });
  // Navigate away: mini player
  await p.click(`${tag === 'phone' ? '.nav' : '.rail'} a[href="#/voices"]`);
  await p.waitForTimeout(800);
  log(tag, 'mini visible', await p.locator('.mini').isVisible());
  await p.screenshot({ path: `shots/${tag}-voices-mini.png` });
  // Static preview playback pauses Listen
  await p.click('button[aria-label="Preview Bella"]');
  await p.waitForTimeout(1500);
  log(tag, 'preview state', JSON.stringify(await p.evaluate(() => ({ listenPlaying: __logos.listen.listen.get().playing }))), 'preview btn', await p.locator('button[aria-label="Pause preview"]').count());
  if (tag === 'phone') {
    // speed sheet + voice sheet visuals
    await p.click('.nav a[href="#/listen"]'); await p.waitForTimeout(600);
    await p.click('button[aria-label="Voice"]'); await p.waitForTimeout(500);
    await p.screenshot({ path: `shots/phone-voice-sheet.png` });
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    await p.click('button[aria-label="Playback speed"]'); await p.waitForTimeout(500);
    await p.screenshot({ path: `shots/phone-speed-sheet.png` });
    await p.keyboard.press('Escape');
  }
  await p.evaluate(() => __logos.listen.endSession());
  await ctx.close();
}
log('DONE');
