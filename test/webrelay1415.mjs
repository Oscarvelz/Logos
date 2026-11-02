// Sandbox can't reach the public relays (rate-limited IP), so route them to a direct fetch here
// to exercise the Readability + cleaning path exactly as the phone will.
import { launch, BASE, PHONE } from './common.mjs';
import { execFileSync } from 'child_process';
const b = await launch(); const ctx = await b.newContext(PHONE); const p = await ctx.newPage();
await ctx.route(/r\.jina\.ai/, (r) => r.fulfill({ status: 401, body: '{}', headers: { 'access-control-allow-origin': '*' } }));
await ctx.route(/api\.cors\.lol/, async (r) => {
  const target = new URL(r.request().url()).searchParams.get('url');
  const body = execFileSync('curl', ['-sL', '-m', '15', '-A', 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile', target], { maxBuffer: 1e8 }).toString();
  r.fulfill({ status: 200, body, headers: { 'content-type': 'text/html', 'access-control-allow-origin': '*' } });
});
await p.addInitScript(() => { localStorage.setItem('logos.debug', '1') });
await p.goto(BASE + '#/library'); await p.waitForTimeout(6000); await p.waitForFunction(() => window.__logos);
for (const u of process.argv.slice(2)) {
  const t0 = Date.now();
  const r = await p.evaluate(async (u) => { try { return await __logos.webtext.fetchWebText(u) } catch (e) { return { err: e.message } } }, u);
  console.log('\n=====', u, Math.round((Date.now() - t0) / 1000) + 's', r.err ?? `${r.via} · ${r.title} · ${r.words} words`);
  if (r.text) console.log(r.text.slice(0, 1100), '\n…\n', r.text.slice(-450));
}
await b.close();
