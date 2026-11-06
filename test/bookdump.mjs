import { launch, BASE, PHONE } from './common.mjs';
const dir = new URL('./books/', import.meta.url).pathname;
const b = await launch(); const ctx = await b.newContext(PHONE); const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) });
await p.goto(BASE + '#/library'); await p.waitForTimeout(6000);
await p.goto(BASE + '#/library'); await p.waitForTimeout(1500);
await p.click('.shelf-tabs button:has-text("Books")'); await p.waitForTimeout(500);
await p.screenshot({ path: 'test/out-shelf-empty.png' });
const files = (process.env.FILES ?? 'sample.epub,sample.docx,sample.fb2,sample.md,sample.html,attention.pdf,quijote.epub,quijote.txt').split(',').map(f => dir + f);
const t0 = Date.now();
await p.setInputFiles('input[type=file][accept*=epub]', files);
const toasts = new Set();
for (let i = 0; i < 400; i++) {
  const n = await p.evaluate(() => new Promise(r => { const q = indexedDB.open('logos-books'); q.onsuccess = () => { try { const t = q.result.transaction('books').objectStore('books').count(); t.onsuccess = () => r(t.result) } catch { r(0) } } }));
  (await p.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.textContent))).forEach(t => toasts.add(t));
  const busy = await p.evaluate(() => !!document.querySelector('.render-card'));
  if (n >= files.length && !busy) break;
  if (!busy && i > 8 && [...toasts].some(t => !t.startsWith('Added'))) { if (i > 20) break }
  await p.waitForTimeout(500);
}
console.log('toasts', [...toasts]);
for (let i = 0; i < 6; i++) { const t = await p.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.textContent).join(' | ')); if (t) console.log('toast:', t); await p.waitForTimeout(250) }
console.log('import ms', Date.now() - t0);
const sum = await p.evaluate(async () => {
  const db = await new Promise(r => { const q = indexedDB.open('logos-books'); q.onsuccess = () => r(q.result) });
  const all = (st) => new Promise(r => { const a = db.transaction(st).objectStore(st).getAll(); a.onsuccess = () => r(a.result) });
  const metas = await all('books'), contents = await all('content');
  return metas.map(m => {
    const ch = contents.find(x => x.id === m.id).chapters;
    const links = ch.flatMap(x => x.blocks.flatMap(bl => (bl.l || []).map(l => bl.t.slice(l.s, l.e) + ' -> ' + l.to)));
    return { title: m.title, author: m.author, fmt: m.format, lang: m.lang, chapters: ch.length, words: m.words, toc: m.toc.length,
      toc6: m.toc.slice(0, 45).map(t => t.level + ':' + t.title + ' -> ' + t.ch + ':' + t.b), links: m.links, linkSample: links.slice(0, 8), cover: !!m.cover,
      ch4: ch.slice(0, 3).map(x => x.title + ' [' + x.blocks.length + ']'), blocks: ch[Math.min(1, ch.length - 1)].blocks.slice(0, 3).map(x => x.k + ': ' + x.t.slice(0, 90)) };
  });
});
for (const s of sum) console.log(JSON.stringify(s, null, 1));
await p.screenshot({ path: 'test/out-shelf.png', fullPage: false });
console.log('errs', errs);
await b.close();
