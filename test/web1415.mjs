import { launch, BASE, PHONE } from './common.mjs';
const b = await launch(); const p = await (await b.newContext(PHONE)).newPage();
await p.addInitScript(() => { localStorage.setItem('logos.debug', '1') });
await p.goto(BASE + '#/library'); await p.waitForTimeout(6000); await p.waitForFunction(() => window.__logos);
const urls = process.argv.slice(2);
for (const u of urls) {
  const t0 = Date.now();
  const r = await p.evaluate(async (u) => { try { const r = await __logos.webtext.fetchWebText(u); return { ...r, text: r.text } } catch (e) { return { err: e.message } } }, u);
  console.log('\n=====', u, Math.round((Date.now() - t0) / 1000) + 's', r.err ?? `${r.via} · ${r.title} · ${r.words} words`);
  if (r.text) console.log(r.text.slice(0, 1400), '\n…\n', r.text.slice(-500));
}
await b.close();
