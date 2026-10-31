// Real-engine test: Kokoro WASM download, streaming Listen (EN + ES), export MP3/WAV download.
import { chromium } from '/workspace/work/browser-test/node_modules/playwright-core/index.mjs';
import { writeFileSync } from 'node:fs';
import { BASE, PHONE } from './common.mjs';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const ctx = await chromium.launchPersistentContext('/tmp/logos-profile', {
  executablePath: '/workspace/work/browser-test/browsers/chromium_headless_shell-1155/chrome-linux/headless_shell',
  args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:8899', '--autoplay-policy=no-user-gesture-required'],
  ...PHONE, acceptDownloads: true,
});
const p = ctx.pages()[0] ?? await ctx.newPage();
await p.addInitScript(() => localStorage.setItem('logos.debug', '1'));
p.on('pageerror', (e) => log('PAGEERR', String(e).slice(0, 300)));
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) log('console.' + m.type(), m.text().slice(0, 300)); });
await p.goto(BASE); await p.waitForTimeout(3000);
await p.waitForFunction(() => window.__logos, null, { timeout: 20000 });
log('isolated', await p.evaluate(() => crossOriginIsolated), 'threads hc', await p.evaluate(() => navigator.hardwareConcurrency));

const EN = 'The word logos meant, for the Greeks, both speech and reason. Heraclitus believed it was the hidden order beneath all change. We listen, and we understand.';
const ES = 'La palabra es pensamiento que se vuelve sonido. ¿Cómo estás, Óscar? Hoy es un buen día para escuchar.';

// 1) English Listen from cold: press play (device voice bridge may be unavailable headless)
await p.fill('textarea', EN);
const t0 = Date.now();
await p.click('.play-btn');
let last = '';
for (let i = 0; i < 400; i++) {
  const s = await p.evaluate(() => { const e = __logos.engine.engine.get(); const l = __logos.listen.listen.get(); return `${e.status} ${Math.round(e.progress * 100)}% ${(e.loaded / 1e6).toFixed(1)}MB/${(e.total / 1e6).toFixed(1)}MB | mode=${l.mode} cur=${l.current}/${l.segments.length} playing=${l.playing} buf=${l.buffering} rendered=${l.rendered.filter(Boolean).length} err=${l.error} eerr=${e.error}` });
  if (s !== last) { log(s); last = s; }
  if (s.startsWith('error')) break;
  if (s.includes('rendered=') && /cur=[1-9]/.test(s)) break;
  await p.waitForTimeout(1000);
}
log('EN first-run total ms', Date.now() - t0);
await p.screenshot({ path: 'shots/phone-listen-playing.png' });
const audioState = await p.evaluate(() => { const a = [...document.querySelectorAll('audio')]; return 'n/a' });
const eng = await p.evaluate(() => __logos.engine.engine.get());
log('engine', JSON.stringify({ device: eng.device, dtype: eng.dtype, loadMs: eng.loadMs, rtf: eng.lastRtf }));

// 2) Warm time-to-first-audio (model loaded): new English text
await p.evaluate(() => __logos.listen.endSession());
const warm = await p.evaluate(async (txt) => {
  const L = __logos.listen; L.loadText(txt); const t = performance.now(); void L.play(0);
  while (!(L.listen.get().playing && !L.listen.get().buffering)) await new Promise((r) => setTimeout(r, 20));
  return { ttfa: Math.round(performance.now() - t), segs: L.listen.get().segments.map((s) => s.lang + ':' + s.text.slice(0, 30)) };
}, 'Short opening line. Then a second, longer sentence follows it, adding more words for the engine to work through.');
log('warm EN time-to-first-audio ms', warm.ttfa, JSON.stringify(warm.segs));
await p.waitForTimeout(4000);
log('after 4s', JSON.stringify(await p.evaluate(() => { const l = __logos.listen.listen.get(); return { cur: l.current, playing: l.playing, rendered: l.rendered, err: l.error } })));

// 3) Spanish
await p.evaluate(() => __logos.listen.endSession());
const es = await p.evaluate(async (txt) => {
  const L = __logos.listen; L.loadText(txt); const t = performance.now(); void L.play(0);
  for (let i = 0; i < 1500; i++) { const s = L.listen.get(); if (s.error) return { err: s.error }; if (s.playing && !s.buffering) break; await new Promise((r) => setTimeout(r, 20)); }
  const s = L.listen.get();
  return { ttfa: Math.round(performance.now() - t), langs: s.segments.map((g) => g.lang), voices: s.voices, err: s.error };
}, ES);
log('ES', JSON.stringify(es));
await p.waitForTimeout(6000);
log('ES after 6s', JSON.stringify(await p.evaluate(() => { const l = __logos.listen.listen.get(); return { cur: l.current, playing: l.playing, rendered: l.rendered, err: l.error, finished: l.finished } })));
await p.screenshot({ path: 'shots/phone-listen-es-playing.png' });
// raw sample check for Spanish
const esStats = await p.evaluate(async () => { const r = await __logos.engine.synthesize('Hola, me llamo Óscar y vivo en Miami.', 'ef_dora', 1); let peak = 0; for (const v of r.samples) peak = Math.max(peak, Math.abs(v)); return { sec: r.samples.length / r.sampleRate, peak, ms: r.ms } });
log('ES raw', JSON.stringify(esStats));
await p.evaluate(() => __logos.listen.endSession());

// 4) Export MP3 via the Create page UI + real download
await p.click('.nav a[href="#/create"]'); await p.waitForTimeout(600);
await p.fill('textarea', EN + '\n\n' + ES);
await p.click('button:has-text("Generate audio")');
await p.waitForSelector('button:has-text("Download MP3")', { timeout: 180000 });
await p.screenshot({ path: 'shots/phone-create-done.png' });
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("Download MP3")')]);
await dl.saveAs('out/export.mp3');
log('downloaded', dl.suggestedFilename());
// WAV export
await p.click('button:has-text("New")');
await p.click('.seg button:has-text("WAV")');
await p.fill('textarea', ES);
await p.click('button:has-text("Generate audio")');
await p.waitForSelector('button:has-text("Download WAV")', { timeout: 120000 });
const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("Download WAV")')]);
await dl2.saveAs('out/export.wav');
log('downloaded', dl2.suggestedFilename());
await p.click('.seg button:has-text("MP3")').catch(() => {});
await p.click('.nav a[href="#/library"]'); await p.waitForTimeout(800);
await p.screenshot({ path: 'shots/phone-library-clips.png' });
log('library items', await p.locator('.clip').count());
await ctx.close();
log('DONE');
