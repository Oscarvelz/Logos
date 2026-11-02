import { launch, BASE, PHONE } from './common.mjs';
const b = await launch(); const p = await (await b.newContext({ ...PHONE, viewport: { width: 384, height: 832 } })).newPage();
await p.goto(BASE + '#/voices'); await p.waitForTimeout(6000);
const c = p.locator('.voice-card.is-default').first(); await c.scrollIntoViewIfNeeded();
const bb = await c.boundingBox(); await p.screenshot({ path: 'test/shots/flag.png', clip: { x: 0, y: bb.y - 20, width: 384, height: bb.height + 30 } });
console.log(await p.evaluate(() => { const f = document.querySelector('.default-flag').getBoundingClientRect(); return [Math.round(f.width), Math.round(f.height)] }));
await b.close();
