import { launch, BASE, PHONE } from './common.mjs';
const b = await launch(); const ctx = await b.newContext({ ...PHONE, permissions: ['clipboard-read', 'clipboard-write'] }); const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.goto(BASE + '#/library'); await p.waitForTimeout(6000);
await p.evaluate(() => navigator.clipboard.writeText('Floats above every app on Android. Just tap, speak, and Flow types it out perfectly. https://share.google/OzxIEJPMSVOSsqo6r'));
await p.getByText('From a web page').first().click(); await p.waitForTimeout(1200);
console.log('field', await p.locator('input[aria-label="Web address"]').inputValue(), errs);
await b.close();
