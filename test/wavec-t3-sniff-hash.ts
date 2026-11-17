// WAVE C (1.4.190) — R2-T3-7 + R2-T3-8 cure probes, through the REAL
// functions. The Round-2 hunt copied them verbatim because import.ts's
// chain reaches pdf.ts's `?url` worker import, which the runner cannot
// load; the cure wave extracted both functions into book/sniff.ts
// (import.ts re-exports them), so this probe tests the shipped code.
// T3-7: two-byte magics ("BM", "GIF8") routed plain text to the image
// parser. The BMP test now demands a structurally plausible BMP
// header; the GIF test demands the version block AND the logical
// screen descriptor's nonzero canvas. Text starting with either
// coincidence falls through to the name/type verdict.
// T3-8: contentHash mixed only block text — chapter boundaries now
// mix in, so a better-split edition of the same text is not refused
// as a duplicate, while the same split still hashes identically.
const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
}
Object.defineProperty(globalThis, 'navigator', { value: { hardwareConcurrency: 4, storage: undefined }, configurable: true })
;(globalThis as any).self = globalThis
;(globalThis as any).indexedDB = {
  open: () => { const r: any = { onerror: null, onsuccess: null, onupgradeneeded: null, onblocked: null }; queueMicrotask(() => { r.onerror?.() }); return r },
}

const { sniffFormat, contentHash } = await import('../src/lib/book/sniff.ts')

let fails = 0
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + extra}`)
  if (!ok) fails++
}
const enc = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer

// ---------- T3-7: byte coincidences are not images ----------
check('T3-7 text starting "BM…" is not an image', (await sniffFormat(enc('BMX riders of the valley\n\nChapter one began quietly...'))) !== 'image')
check('T3-7 text starting "BM " (initials) is not an image', (await sniffFormat(enc('BM was the oldest of the brothers. He kept the lighthouse...'))) !== 'image')
check('T3-7 text starting "GIF8" (a book about GIFs) is not an image', (await sniffFormat(enc('GIF89a is not a picture here, it is the first line of chapter one.'))) !== 'image')
check('T3-7 ordinary text still says nothing', (await sniffFormat(enc('It was a bright day in April, and the clocks were striking thirteen.'))) === null)
check('T3-7 real PDF header still routes pdf', (await sniffFormat(enc('%PDF-1.7\n%âãÏÓ\n1 0 obj'))) === 'pdf')

// A REAL BMP: 'BM', file-size field = actual length, reserved zeros,
// DIB header size 40, 1x1 pixels.
const bmp = new Uint8Array(58)
bmp.set([0x42, 0x4d])
new DataView(bmp.buffer).setUint32(2, 58, true)
new DataView(bmp.buffer).setUint32(10, 54, true)
new DataView(bmp.buffer).setUint32(14, 40, true)
new DataView(bmp.buffer).setInt32(18, 1, true)
new DataView(bmp.buffer).setInt32(22, 1, true)
check('T3-7 a real BMP still routes image', (await sniffFormat(bmp.buffer as ArrayBuffer)) === 'image')

// A REAL GIF89a header: version block + nonzero logical screen size
// + the trailer block byte where the format puts it.
const gif = new Uint8Array(20)
gif.set(new TextEncoder().encode('GIF89a'))
new DataView(gif.buffer).setUint16(6, 2, true)
new DataView(gif.buffer).setUint16(8, 3, true)
gif[13] = 0x3b
check('T3-7 a real GIF still routes image', (await sniffFormat(gif.buffer as ArrayBuffer)) === 'image')

// PNG / JPEG magics are long enough to keep testifying alone.
check('T3-7 PNG magic still routes image', (await sniffFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]).buffer as ArrayBuffer)) === 'image')
check('T3-7 JPEG magic still routes image', (await sniffFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 1, 2]).buffer as ArrayBuffer)) === 'image')

// ---------- T3-8: the fingerprint sees chapter structure ----------
const blocks = (...ts: string[]) => ts.map((t) => ({ t }))
const oneChapter: any = { chapters: [{ blocks: blocks('Alpha text.', 'Beta text.', 'Gamma text.') }] }
const threeChapters: any = {
  chapters: [
    { blocks: blocks('Alpha text.') },
    { blocks: blocks('Beta text.') },
    { blocks: blocks('Gamma text.') },
  ],
}
const h1 = contentHash(oneChapter)
const h3 = contentHash(threeChapters)
console.log(`hash one-chapter   : ${h1}`)
console.log(`hash three-chapter : ${h3}`)
check('T3-8 a different chapter split hashes DIFFERENTLY', h1 !== h3, `${h1} vs ${h3}`)
check('T3-8 the same split still hashes identically (dedupe intact)', contentHash(oneChapter) === h1)
check('T3-8 reordered blocks still differ (control)', contentHash({ chapters: [{ blocks: blocks('Beta text.', 'Alpha text.', 'Gamma text.') }] } as any) !== h1)
check('T3-8 chapter TITLES alone do not move the hash (structure, not labels)', contentHash({ chapters: [{ title: 'One', blocks: blocks('Alpha text.', 'Beta text.', 'Gamma text.') }] } as any) === h1)

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASS')
process.exitCode = fails ? 1 : 0
