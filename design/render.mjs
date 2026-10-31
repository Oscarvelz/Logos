import { chromium } from '/workspace/work/browser-test/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
const svg = readFileSync(process.argv[2], 'utf8');
const b = await chromium.launch({ executablePath: '/workspace/work/browser-test/browsers/chromium_headless_shell-1155/chrome-linux/headless_shell', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 512, height: 512 } });
for (const [size, out, pad] of JSON.parse(process.argv[3])) {
  await p.setViewportSize({ width: size, height: size });
  const inner = pad ? svg.replace('<rect width="512" height="512" rx="116"', '<rect width="512" height="512" rx="0"').replace('<g fill="none"', '<g transform="translate(256 256) scale(0.78) translate(-256 -256)"><g fill="none"').replace('</svg>', '</g></svg>').replace('<!-- lambda -->\n  <g fill', '<!-- lambda -->\n  <g fill') : svg;
  await p.setContent(`<html><body style="margin:0;background:transparent">${inner.replace('width="512" height="512">', `width="${size}" height="${size}">`)}</body></html>`);
  await p.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await b.close();
