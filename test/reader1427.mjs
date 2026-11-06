import { launch, BASE, PHONE } from './common.mjs';
const dir = new URL('./books/', import.meta.url).pathname;
const b = await launch(); const ctx = await b.newContext(PHONE); const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(BASE + '#/library'); await p.waitForTimeout(6000);
await p.goto(BASE + '#/library'); await p.waitForTimeout(1200);
await p.click('.shelf-tabs button:has-text("Books")');
await p.setInputFiles('input[type=file][accept*=epub]', ['sample.fb2', 'attention.pdf', 'sample.epub', 'quijote.epub'].map(f => dir + f));
for (let i = 0; i < 200; i++) { const n = await p.locator('.book-tile').count(); const busy = await p.locator('.render-card').count(); if (n >= 4 && !busy) break; await p.waitForTimeout(500) }
await p.waitForTimeout(800);
await p.screenshot({ path: 'test/out-r-shelf.png' });
// Open Quijote
await p.click('.book-tile:has-text("Don Quijote") .book-tile-cover'); await p.waitForTimeout(1500);
await p.screenshot({ path: 'test/out-r-open.png' });
// contents → a chapter deep in the book
await p.click('[aria-label="Contents"]'); await p.waitForTimeout(700);
await p.screenshot({ path: 'test/out-r-toc.png' });
await p.click('.bk-toc-i:has-text("Capítulo VIII")'); await p.waitForTimeout(1000);
console.log('after toc:', await p.textContent('.bk-head-ch'), '| back chip', await p.locator('.bk-back').count());
await p.screenshot({ path: 'test/out-r-ch.png' });
// search
await p.click('[aria-label="Search this book"]'); await p.waitForTimeout(400);
const t0 = Date.now(); await p.fill('.sheet input', 'dulcinea'); await p.waitForSelector('.bk-s-i', { timeout: 15000 }); console.log('search ms', Date.now() - t0, await p.textContent('.bk-s-count'));
await p.screenshot({ path: 'test/out-r-search.png' });
await p.locator('.bk-s-i').nth(3).click(); await p.waitForTimeout(1000);
const markVis = await p.evaluate(() => { const m = document.querySelector('.bk-text .bk-mark'); if (!m) return 'none'; const r = m.getBoundingClientRect(); return `${m.textContent} y=${Math.round(r.top)} vh=${innerHeight}` });
console.log('mark', markVis, '| find', await p.textContent('.bk-find'));
await p.screenshot({ path: 'test/out-r-found.png' });
await p.click('[aria-label="Next match"]'); await p.waitForTimeout(800);
console.log('next', await p.textContent('.bk-find-n'));
await p.click('[aria-label="Close search"]');
// paragraph tap
await p.locator('.bk-text p.bk-b').nth(2).click(); await p.waitForTimeout(400);
await p.screenshot({ path: 'test/out-r-sel.png' });
console.log('actions', await p.locator('.bk-actions').count());
await p.click('.bk-actions [aria-label="Close"]');
// type sheet
await p.click('[aria-label="Text size and font"]'); await p.waitForTimeout(300); await p.click('[aria-label="Larger"]'); await p.click('[aria-label="Larger"]'); await p.screenshot({ path: 'test/out-r-type.png' }); await p.keyboard.press('Escape');
// back to library, open sample epub, follow internal link and note
await p.click('[aria-label="Back to Library"]'); await p.waitForTimeout(1200);
await p.screenshot({ path: 'test/out-r-shelf2.png' });
await p.click('.book-tile:has-text("El arte de escuchar") .book-tile-cover'); await p.waitForTimeout(1200);
await p.click('[aria-label="Next chapter"]'); await p.waitForTimeout(600);
await p.screenshot({ path: 'test/out-r-sample.png' });
const link = p.locator('.bk-text .bk-link:has-text("Capítulo 2")').first();
if (await link.count()) { await link.click(); await p.waitForTimeout(700); console.log('link →', await p.textContent('.bk-head-ch'), 'back', await p.locator('.bk-back').count()); await p.click('.bk-back'); await p.waitForTimeout(600); console.log('back →', await p.textContent('.bk-head-ch')) }
await p.click('[aria-label="Next chapter"]'); await p.waitForTimeout(600);
const fn = p.locator('.bk-text .bk-link').filter({ hasText: /^\d$/ }).first();
if (await fn.count()) { await fn.click(); await p.waitForTimeout(500); console.log('note sheet', await p.locator('.sheet .bk-note').count(), await p.locator('.sheet').textContent().catch(() => '')); await p.screenshot({ path: 'test/out-r-note.png' }); await p.keyboard.press('Escape') }
// pdf
await p.click('[aria-label="Back to Library"]'); await p.waitForTimeout(1000);
await p.click('.book-tile:has-text("Attention") .book-tile-cover'); await p.waitForTimeout(1200);
await p.click('[aria-label="Next chapter"]'); await p.waitForTimeout(600);
await p.screenshot({ path: 'test/out-r-pdf.png' });
console.log('errs', errs);
await b.close();
