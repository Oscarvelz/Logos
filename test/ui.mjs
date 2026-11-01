import { launch, BASE, PHONE, TABLET } from './common.mjs';
const b = await launch();
const SAMPLE = `The word logos meant, for the Greeks, both speech and reason. Heraclitus believed it was the hidden order beneath all change.\n\n¿Qué es la palabra, sino pensamiento que se vuelve sonido? La voz da forma a lo que sentimos.`;
for (const [tag, dev] of [['phone', PHONE], ['tablet', TABLET]]) {
  const ctx = await b.newContext({ ...dev, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage(); await p.addInitScript(() => localStorage.setItem('logos.phononThreads', '1'));
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  await p.goto(BASE); await p.waitForTimeout(2500);
  console.log(tag, 'isolated:', await p.evaluate(() => crossOriginIsolated), 'sw:', await p.evaluate(() => !!navigator.serviceWorker.controller));
  await p.screenshot({ path: `shots/${tag}-listen-empty.png` });
  await p.fill('textarea', SAMPLE);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `shots/${tag}-listen-text.png` });
  for (const r of ['create', 'library', 'voices', 'settings']) {
    await p.click(`${tag === 'phone' ? '.nav' : '.rail'} a[href="#/${r}"]`);
    await p.waitForTimeout(700);
    const h = await p.locator('h1').innerText();
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    console.log(tag, r, 'h1=', h, 'hash=', await p.evaluate(() => location.hash), 'hOverflow=', overflow);
    await p.screenshot({ path: `shots/${tag}-${r}.png`, fullPage: r === 'settings' });
  }
  // light theme check
  await p.click('.seg button:has-text("Light")');
  await p.waitForTimeout(400);
  await p.screenshot({ path: `shots/${tag}-settings-light.png` });
  await p.click('a[href="#/listen"] >> visible=true');
  await p.waitForTimeout(600);
  await p.screenshot({ path: `shots/${tag}-listen-light.png` });
  await p.click('a[href="#/settings"] >> visible=true'); await p.waitForTimeout(400);
  await p.click('.seg button:has-text("Dark")');
  console.log(tag, 'errors:', errs);
  await ctx.close();
}
// share target
const ctx = await b.newContext(PHONE);
const p = await ctx.newPage(); await p.addInitScript(() => localStorage.setItem('logos.phononThreads', '1'));
await p.goto(BASE + '?title=Shared%20title&text=Hola%20desde%20otra%20app.%20%C2%BFC%C3%B3mo%20est%C3%A1s%3F&url=https%3A%2F%2Fexample.com');
await p.waitForTimeout(2500);
console.log('share: url=', p.url(), 'text=', JSON.stringify(await p.inputValue('textarea')));
await p.screenshot({ path: 'shots/phone-share-target.png' });
await b.close();
