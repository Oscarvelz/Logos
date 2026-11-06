import { launch, BASE, PHONE } from './common.mjs';
const dir = new URL('./books/', import.meta.url).pathname;
const b = await launch(); const ctx = await b.newContext(PHONE); const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(BASE + '#/library'); await p.waitForTimeout(5000); await p.goto(BASE + '#/library'); await p.waitForTimeout(1200);
await p.click('.shelf-tabs button:has-text("Books")');
await p.setInputFiles('input[type=file][accept*=epub]', [dir + 'talks.pdf']);
for (let i = 0; i < 80; i++) { if (p.url().includes('#/book/')) break; await p.waitForTimeout(500) }
await p.waitForTimeout(1500);
await p.screenshot({ path: 'test/out-r1.png' });
await p.click('[aria-label="Contents"], button:has(svg.lucide-list-tree)').catch(e => console.log('noclick', e.message));
await p.waitForTimeout(900); await p.screenshot({ path: 'test/out-r2.png' });
await p.keyboard.press('Escape'); await p.waitForTimeout(500);
await p.goto(BASE + '#/library'); await p.waitForTimeout(1500); await p.screenshot({ path: 'test/out-r3.png' });
console.log(errs); await b.close();
