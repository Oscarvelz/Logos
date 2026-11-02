import { launch, BASE, PHONE } from './common.mjs';
const b = await launch(); const p = await (await b.newContext({ ...PHONE, viewport: { width: 384, height: 832 } })).newPage(); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.goto(BASE + '#/listen'); await p.waitForTimeout(6000);
await p.fill('textarea', 'In May 2009, Virginia Roberts Giuffre filed a lawsuit (with Katherine Ezell as her lawyer) as Jane Doe 102 against Epstein and accused him. '.repeat(6));
await p.waitForTimeout(800);
console.log(await p.evaluate(() => [...document.querySelectorAll('.editor-meta span')].map(e => { const r = e.getBoundingClientRect(); return [e.textContent, Math.round(r.height), Math.round(r.width)] })));
await p.locator('.editor-bar').screenshot({ path: 'test/shots/meta.png' });
console.log(errs); await b.close();
