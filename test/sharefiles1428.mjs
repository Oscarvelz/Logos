import { launch, BASE, PHONE } from './common.mjs';
import fs from 'fs';
const dir = new URL('./books/', import.meta.url).pathname;
const b = await launch(); const ctx = await b.newContext(PHONE); const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(BASE + '#/listen'); await p.waitForTimeout(6000);
await p.goto(BASE + '#/listen'); await p.waitForTimeout(1500);
console.log('controlled', await p.evaluate(() => !!navigator.serviceWorker.controller));
const files = ['sample.epub', 'sample.fb2', 'attention.pdf'].map(f => ({ name: f, b64: fs.readFileSync(dir + f).toString('base64') }));
// Submit the share form exactly as Android does: POST multipart to the share action.
await p.evaluate((files) => {
  const f = document.createElement('form'); f.method = 'POST'; f.enctype = 'multipart/form-data'; f.action = './share-target';
  const inp = document.createElement('input'); inp.type = 'file'; inp.name = 'books'; inp.multiple = true;
  const dt = new DataTransfer();
  for (const x of files) { const bytes = Uint8Array.from(atob(x.b64), c => c.charCodeAt(0)); dt.items.add(new File([bytes], x.name)) }
  inp.files = dt.files; f.appendChild(inp); document.body.appendChild(f); f.submit();
}, files);
await p.waitForTimeout(2500);
console.log('url after share', p.url());
let seen = new Set();
for (let i = 0; i < 120; i++) {
  (await p.evaluate(() => [...document.querySelectorAll('.toast, .rc-title')].map(x => x.textContent))).forEach(t => seen.add(t));
  const n = await p.locator('.book-tile').count(); const busy = await p.locator('.render-card').count();
  if (n >= 3 && !busy) break; await p.waitForTimeout(500);
}
console.log('seen', [...seen]);
console.log('tiles', await p.locator('.book-tile-title').allTextContents());
await p.screenshot({ path: 'test/out-sharefiles.png' });
// Text share through the same POST endpoint
await p.evaluate(() => {
  const f = document.createElement('form'); f.method = 'POST'; f.enctype = 'multipart/form-data'; f.action = './share-target';
  for (const [k, v] of [['title', 'Hola'], ['text', 'Esto es una prueba de texto compartido.']]) { const i = document.createElement('input'); i.name = k; i.value = v; f.appendChild(i) }
  document.body.appendChild(f); f.submit();
});
await p.waitForTimeout(3500);
console.log('text share url', p.url(), '| eyebrow', await p.locator('.listen-head').first().textContent().catch(() => 'none'));
console.log('errs', errs);
await b.close();
