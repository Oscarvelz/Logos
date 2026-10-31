import { launch, BASE, PHONE, TABLET } from './common.mjs';
const b = await launch();
const T = `The word logos meant, for the Greeks, both speech and reason. Heraclitus believed it was the hidden order beneath all change.\n\n¿Qué es la palabra, sino pensamiento que se vuelve sonido? La voz da forma a lo que sentimos.`;
for (const theme of ['dark', 'light']) {
  const ctx = await b.newContext(PHONE); const p = await ctx.newPage();
  await p.addInitScript((t) => localStorage.setItem('logos.settings.v1', JSON.stringify({ theme: t })), theme);
  await p.goto(BASE); await p.waitForTimeout(2500);
  await p.fill('textarea', T); await p.waitForTimeout(300);
  await p.screenshot({ path: `shots/phone-listen-final-${theme}.png` });
  await p.click('.nav a[href="#/create"]'); await p.waitForTimeout(600);
  await p.fill('textarea', T); await p.screenshot({ path: `shots/phone-create-final-${theme}.png` });
  console.log(theme, 'overflow', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await ctx.close();
}
const ctx = await b.newContext(TABLET); const p = await ctx.newPage();
await p.goto(BASE + '#/voices'); await p.waitForTimeout(2500);
await p.screenshot({ path: 'shots/tablet-voices-final.png' });
await b.close();
