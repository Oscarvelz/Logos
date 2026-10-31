import { chromium } from '/workspace/work/browser-test/node_modules/playwright-core/index.mjs';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { BASE, PHONE } from './common.mjs';
const OUT = '/workspace/work/voz/public/previews';
mkdirSync(OUT, { recursive: true });
const TEXT = { en: 'Words carry meaning. Here is how I sound when I read to you.', es: 'Las palabras dan forma al pensamiento. Así sueno cuando leo para ti.' };
const VOICES = process.argv.slice(2);
const ctx = await chromium.launchPersistentContext('/tmp/logos-profile', {
  executablePath: '/workspace/work/browser-test/browsers/chromium_headless_shell-1155/chrome-linux/headless_shell',
  args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:8899'], ...PHONE,
});
const p = ctx.pages()[0] ?? await ctx.newPage();
await p.addInitScript(() => localStorage.setItem('logos.debug', '1'));
await p.goto(BASE); await p.waitForTimeout(2500);
await p.waitForFunction(() => window.__logos, null, { timeout: 20000 });
console.log('threads/isolated', await p.evaluate(() => crossOriginIsolated));
for (const id of VOICES) {
  if (existsSync(`${OUT}/${id}.mp3`)) continue;
  const lang = id.startsWith('e') ? 'es' : 'en';
  const t = Date.now();
  const b64 = await p.evaluate(async ([text, id]) => {
    const { engine, audio } = __logos;
    const r = await engine.synthesize(text, id, 1, { priority: 200 });
    const trimmed = audio.trimSilence(r.samples, r.sampleRate);
    const blob = await audio.encodeMp3(trimmed, r.sampleRate, 64);
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
    return { b64: btoa(s), sec: trimmed.length / r.sampleRate, ms: r.ms };
  }, [TEXT[lang], id]);
  writeFileSync(`${OUT}/${id}.mp3`, Buffer.from(b64.b64, 'base64'));
  console.log(id, b64.sec.toFixed(2) + 's audio', b64.ms + 'ms synth', (Date.now() - t) + 'ms total');
}
await ctx.close();
console.log('DONE');
