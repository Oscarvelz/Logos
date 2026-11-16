// Acceptance probe for cure T1-13 (nowreading book fingerprint).
// Two book texts of equal length sharing their first 120 chars but
// differing later must produce different keys; identical texts must
// produce the same key. Runs the REAL shipped module.
const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
}

import { setNowReading, nowReadingFor, nowReadingId } from '../src/lib/book/nowreading.ts'

let pass = 0, fail = 0
const check = (name: string, ok: boolean) => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name) } }

const head = 'The harbour at dawn. '.repeat(8) // 168 chars — covers the old 120-char window
const textA = head + 'M'.repeat(400) + 'alpha ending'
const textB = head + 'M'.repeat(400) + 'omega ending'
check('premise: equal length', textA.length === textB.length)
check('premise: first 120 chars identical', textA.slice(0, 120) === textB.slice(0, 120))
check('premise: texts differ later', textA !== textB)
check('premise: old formula would collide', `${textA.length}:${textA.slice(0, 120)}` === `${textB.length}:${textB.slice(0, 120)}`)

setNowReading('book-1', 'The Book', [textA], [{ ch: 0, b: 0 }])
const rec = JSON.parse(store.get('logos.nowReading')!)
check('stored key has the new full-hash shape', typeof rec.key === 'string' && rec.key.startsWith('b') && rec.key.endsWith('-' + textA.length))
check('identical text matches (same key)', nowReadingFor(textA)?.id === 'book-1')
check('hunt pair splits (different key)', nowReadingFor(textB) === null)
const mid = textA.slice(0, 300) + 'Z' + textA.slice(301)
check('single middle-char edit splits', nowReadingFor(mid) === null)
check('nowReadingId still serves the stored id', nowReadingId() === 'book-1')

console.log(`T1-13 probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
