// Cure R2-T1-3: the now-reading mirror. The hunt probe
// (round2/probes/r2-nowreading.ts) proved a swallowed quota write
// stripped a genuine book of its identity for the whole session.
// This probe proves the mirror: identity survives the failed write,
// a deliberate removal still retires it, and a failed re-stamp beats
// the older record storage still holds.
let failSet = false
const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { if (failSet) throw new Error('QuotaExceededError'); store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
}
;(globalThis as any).window = globalThis

const { setNowReading, nowReadingFor, nowReadingId } = await import('../src/lib/book/nowreading.ts')

let pass = 0, fail = 0
const check = (name: string, ok: boolean, extra = '') => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) } }

const paras = ['First paragraph of the book, with enough words to matter.', 'Second paragraph follows here, somewhat later in the book.']
const text = paras.join('\n\n')
const pos = [{ ch: 0, b: 0 }, { ch: 0, b: 1 }]

// Control: healthy storage — the stamp lands and identifies the book.
setNowReading('bk-1', 'The Book', paras, pos)
check('control: healthy write identifies the book', nowReadingFor(text)?.id === 'bk-1' && nowReadingId() === 'bk-1')

// The hunt specimen: the stamp write throws (quota) and is swallowed.
store.delete('logos.nowReading')
failSet = true
setNowReading('bk-1', 'The Book', paras, pos) // must not throw — the swallow itself
failSet = false
check('cured: nowReadingFor still identifies the book on the mirror', nowReadingFor(text)?.id === 'bk-1')
check('cured: nowReadingId still returns the book — publisher keeps its SKIP and title', nowReadingId() === 'bk-1')
check('mirror does not invent identity for other text', nowReadingFor('Some other text entirely, never a book.') === null)

// A failed RE-stamp beats the older record storage still holds.
setNowReading('bk-1', 'The Book', paras, pos) // lands; storage holds bk-1
const paras2 = ['A different book opens here, with its own first paragraph.', 'And its second paragraph follows.']
const text2 = paras2.join('\n\n')
failSet = true
setNowReading('bk-2', 'The Other Book', paras2, pos)
failSet = false
check('failed re-stamp: the mirror (new book) wins over the stale stored record', nowReadingFor(text2)?.id === 'bk-2' && nowReadingId() === 'bk-2')

// Deliberate removal still retires the record (deleteBook's trace purge):
// a stamp that LANDED, then removed, must not be resurrected by the mirror.
setNowReading('bk-2', 'The Other Book', paras2, pos) // lands this time
store.delete('logos.nowReading')
check('landed-then-removed: the mirror retires with the record', nowReadingId() === null && nowReadingFor(text2) === null)

console.log(`CURE R2-T1-3 probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
