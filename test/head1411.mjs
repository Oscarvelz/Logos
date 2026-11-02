import { launch, BASE, PHONE } from './common.mjs';
const b = await launch(); const p = await (await b.newContext({ ...PHONE, viewport: { width: 360, height: 780 } })).newPage(); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.addInitScript(() => localStorage.setItem('logos.debug', '1'));
await p.goto(BASE + '#/listen'); await p.waitForTimeout(6000); await p.waitForFunction(() => window.__logos);
await p.fill('textarea', `Virginia Giuffre was an American advocate for victims of sex trafficking.[1] In 2009, she filed a lawsuit against Jeffrey Epstein in Florida, describing years of abuse that began when she was a teenager.[20] At the time, she named Epstein and Maxwell but did not identify any of the men. Epstein settled the case. Giuffre later became a prominent voice for survivors. Epstein died in jail in 2019.`);
await p.evaluate(() => { __logos.listen.loadText(document.querySelector('textarea').value) }); await p.waitForTimeout(300);
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Back to reading view')?.click()); await p.waitForTimeout(800);
console.log(errs, await p.evaluate(() => document.documentElement.scrollHeight - innerHeight));
await p.screenshot({ path: 'test/shots/head1411.png', clip: { x: 0, y: 0, width: 360, height: 300 } }); await b.close();
