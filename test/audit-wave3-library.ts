// Wave 3 audit probes — Track 3 (Library & Books) mediums M-2, M-5,
// M-7, M-8, M-10 (key-format leg). In-memory only; no app source edited.
// (M-1 and the M-6 fingerprint live in audit-wave3-library-import.ts —
// import.ts pulls pdf.ts, whose `?url` worker import the standard runner
// cannot resolve; that file runs under the supplementary runner beside it.)
import { decodeTextDetailed } from '../src/lib/book/formats.ts'
import { clampPos, progressPatch, wordsIn } from '../src/lib/books.ts'
import { askKeep, keepAsk } from '../src/lib/book/keepask.ts'
import { setNowReading } from '../src/lib/book/nowreading.ts'

let fails = 0
const check = (name: string, cond: boolean, extra?: unknown) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra !== undefined ? ' :: ' + JSON.stringify(extra) : ''}`)
  if (!cond) fails++
}
const buf = (bytes: number[] | Uint8Array) => { const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer }
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0))

// ── M-2: honest decoding ─────────────────────────────────────────────────
const sentence = 'The quick brown fox jumps over the lazy dog near the river bank today' // 14 words
const u16le: number[] = []
for (const c of sentence) u16le.push(c.charCodeAt(0), 0)
const d16 = decodeTextDetailed(buf(u16le))
check('M-2 BOM-less UTF-16LE decodes to the real sentence', d16.text === sentence, d16.text.slice(0, 40))
check('M-2 BOM-less UTF-16LE carries a guess warning', !!d16.warn && /UTF-16LE/.test(d16.warn), d16.warn)
check('M-2 decoded UTF-16LE word count is the real count', wordsIn(d16.text) === wordsIn(sentence), wordsIn(d16.text))
// short windows-1252 Spanish with sparse accents (~120 chars)
const es = 'El niño comió jamón y bebió café en Cádiz; la lección fue útil y rápida.'
const cp1252: Record<string, number> = { 'á': 0xe1, 'é': 0xe9, 'í': 0xed, 'ó': 0xf3, 'ú': 0xfa, 'ñ': 0xf1, '¡': 0xa1, '¿': 0xbf }
const esBytes = [...es].map((c) => cp1252[c] ?? c.charCodeAt(0))
const dEs = decodeTextDetailed(buf(esBytes))
check('M-2 short cp1252 Spanish survives intact', dEs.text === es, dEs.text)
check('M-2 cp1252 guess is warned, not silent', !!dEs.warn)
// FB2 declaring windows-1251: prolog is honoured
const cyr: Record<string, number> = { 'П': 0xcf, 'р': 0xf0, 'и': 0xe8, 'в': 0xe2, 'е': 0xe5, 'т': 0xf2 }
const fb2Head = '<?xml version="1.0" encoding="windows-1251"?><FictionBook><body><p>'
const fb2Bytes = [...ascii(fb2Head), ...[...'Привет'].map((c) => cyr[c]), ...ascii('</p></body></FictionBook>')]
const dFb2 = decodeTextDetailed(buf(fb2Bytes))
check('M-2 declared windows-1251 (FB2 prolog) decoded as declared', dFb2.text.includes('Привет'), dFb2.text.slice(60, 90))

// ── M-5: raw askKeep still replaces (merge lives in importMany) ──────────
askKeep([{ id: 'AAA', title: 'A' }])
askKeep([{ id: 'BBB', title: 'B' }])
check('M-5 askKeep() alone still replaces wholesale (merge is in shelf importMany)', JSON.stringify(keepAsk.get().ask?.ids) === '["BBB"]', keepAsk.get().ask?.ids)

// ── M-7: progressPatch ───────────────────────────────────────────────────
const pp1 = progressPatch({ done: true }, 0.05)
check('M-7 done book re-read from start un-finishes, progress truthful', pp1.done === false && pp1.progress === 0.05, pp1)
const pp2 = progressPatch({ done: true }, 1)
check('M-7 done book at the end stays done at 1', pp2.done === true && pp2.progress === 1, pp2)
const pp3 = progressPatch({ done: false }, 0.99)
check('M-7 crossing 98.5% finishes', pp3.done === true && pp3.progress === 0.99, pp3)
const pp4 = progressPatch({ done: false }, 0.5)
check('M-7 mid-book save is plain', pp4.done === false && pp4.progress === 0.5, pp4)

// ── M-8: clampPos ────────────────────────────────────────────────────────
const chs = [{ blocks: [{ t: 'only' }] }, { blocks: [{ t: 'a' }, { t: 'b' }, { t: 'c' }] }]
check('M-8 pos.b=999 on a 1-block chapter clamps to 0', JSON.stringify(clampPos(chs, { ch: 0, b: 999 })) === '{"ch":0,"b":0}', clampPos(chs, { ch: 0, b: 999 }))
check('M-8 stale chapter+block clamp into the real book', JSON.stringify(clampPos(chs, { ch: 9, b: 5 })) === '{"ch":1,"b":2}', clampPos(chs, { ch: 9, b: 5 }))
check('M-8 negative place clamps to the start', JSON.stringify(clampPos(chs, { ch: -2, b: -3 })) === '{"ch":0,"b":0}', clampPos(chs, { ch: -2, b: -3 }))

// ── M-10 leg: the key clearDeletedBookTraces compares against ────────────
const store: Record<string, string> = {}
;(globalThis as any).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
}
const bookText = 'First paragraph of the deleted book.\n\nSecond paragraph follows here.'
setNowReading('BOOK1', 'Deleted Book', ['First paragraph of the deleted book.', 'Second paragraph follows here.'], [{ ch: 0, b: 0 }, { ch: 0, b: 1 }])
const nr = JSON.parse(store['logos.nowReading'])
const oldShape = `${bookText.length}:${bookText.slice(0, 120)}`
check('M-10 stored nowReading key is the NEW cyrb64 shape', typeof nr.key === 'string' && nr.key.startsWith('b') && nr.key.endsWith('-' + bookText.length), nr.key)
check('M-10 books.ts compare target (len:first120) can never equal the stored key', nr.key !== oldShape, { stored: nr.key, comparedAgainst: oldShape })

console.log(fails ? `\n${fails} FAILURES` : '\nALL CHECKS PASSED')
process.exitCode = fails ? 1 : 0
