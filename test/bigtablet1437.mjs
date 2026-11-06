import { launch, BASE } from '/workspace/work/voz/test/common.mjs';
const dir = '/workspace/work/voz/test/books/';
const [name, w, h] = process.argv.slice(2); const b = await launch(); const errs = [];
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, isMobile: false, hasTouch: true, deviceScaleFactor: 1 }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(() => localStorage.setItem('logos.debug', '1'));
await p.goto(BASE + '#/library'); await p.waitForTimeout(4000);
await p.evaluate(async () => { const L = window.__logos.library; for (const [t, d] of [['La ciudad y los perros, capítulo uno', 610], ['How habits form in the brain', 380], ['Carta a un joven poeta', 920], ['The Stoics on anger', 245]]) await L.saveForLater('Texto de prueba. ' + t, { title: t, lang: 'es', voice: '', duration: d }); await L.refreshLibrary() });
await p.setInputFiles('input[type=file][accept*=epub]', ['quijote.epub','sample.epub','attention.pdf'].map(f => dir + f));
for (let i = 0; i < 120; i++) { const busy = await p.evaluate(() => !!document.querySelector('.render-card')); const n = await p.locator('.book-tile').count(); if (n >= 3 && !busy) break; await p.waitForTimeout(500) }
await p.waitForTimeout(800); await p.screenshot({ path: `/tmp/b-${name}-library.png` });
const txt = 'The mind is not a vessel to be filled, but a fire to be kindled. We read to know we are not alone.\n\nA second paragraph follows here. It has two sentences.\n\nAnd a third paragraph closes the sample.';
await p.goto(BASE + '#/listen'); await p.waitForTimeout(1200); await p.fill('.editor textarea', txt); await p.waitForTimeout(500); await p.screenshot({ path: `/tmp/b-${name}-listen.png` });
await p.evaluate(() => window.__logos.listen.loadText(document.querySelector('.editor textarea').value)); await p.waitForTimeout(1200); await p.screenshot({ path: `/tmp/b-${name}-listen2.png` });
for (const r of ['voices', 'create', 'settings']) { await p.goto(BASE + '#/' + r); await p.waitForTimeout(1200); await p.screenshot({ path: `/tmp/b-${name}-${r}.png` }) }
await p.goto(BASE + '#/library'); await p.waitForTimeout(1000); await p.locator('.book-tile .book-tile-cover').first().click(); await p.waitForTimeout(1800); await p.screenshot({ path: `/tmp/b-${name}-book.png` });
console.log(name, 'sw', await p.evaluate(() => document.scrollingElement.scrollWidth), 'errs', errs); await b.close();
