// Cure R4-T1-3 — the delete purge's draft leg hears the durable witness.
// Mirrors the hunt specimen (round4/probes/r4-nowreading-mirror-purge.ts):
// storage durably names book A; book B's stamp failed on quota, so B
// stands only in the non-durable mirror. nowReadingFor now asks
// storage directly when the mirror does not name the text asked
// about, so the purge's draft leg — its own expression, below —
// finds book A again, while the mirror still serves the session's
// own book B (R2-T1-3's intent intact).
// Run: node ~/workspace/vela-work/run-ts-test.mjs test/cure-waveE-purge.ts
const backing = new Map<string, string>()
let quota = false
;(globalThis as any).localStorage = {
  getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
  setItem: (k: string, v: string) => { if (quota) throw new Error('QuotaExceededError'); backing.set(k, String(v)) },
  removeItem: (k: string) => { backing.delete(k) },
}

let pass = 0, fail = 0
const check = (name: string, ok: boolean, extra = '') => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) } }

const nr = await import('../src/lib/book/nowreading.ts')
const parasA = ['Alpha chapter text of the first book.', 'More of the first book follows here.']
const parasB = ['Bravo chapter text of the second book.', 'More of the second book follows here.']
const pos = [{ ch: 0, b: 0 }, { ch: 0, b: 1 }]
const textA = parasA.join('\n\n')
const textB = parasB.join('\n\n')

nr.setNowReading('bookA', 'Book A', parasA, pos) // durable: storage names A
quota = true
nr.setNowReading('bookB', 'Book B', parasB, pos) // quota: mirror only, NOT durable
quota = false

const raw = backing.get('logos.nowReading')
const storedId = raw ? JSON.parse(raw).id : null
check('setup: storage still names book A (B stamp never landed)', storedId === 'bookA', `stored=${storedId}`)
check('control: the mirror serves the session’s own book B (R2-T1-3 intent intact)', nr.nowReadingFor(textB)?.id === 'bookB', `got ${nr.nowReadingFor(textB)?.id}`)
check('cure: nowReadingFor(A text) hears the durable witness behind the mirror', nr.nowReadingFor(textA)?.id === 'bookA', `got ${JSON.stringify(nr.nowReadingFor(textA))}`)
check('control: an unrelated text still belongs to no book', nr.nowReadingFor('Unrelated words that are no book at all.') === null)
// The purge's own gate, with its own pieces (books.ts clearDeletedBookTraces):
// pointer read from storage directly -> names bookA; draft leg via nowReadingFor.
const pointerNamesA = storedId === 'bookA'
const draftIsBook = nr.nowReadingFor(textA)?.id === 'bookA'
check('cure far end: the purge would remove BOTH the pointer and the draft (no ghost survives)', pointerNamesA && draftIsBook === true, `pointer=${pointerNamesA} draftIsBook=${draftIsBook}`)

console.log(`CURE R4-T1-3 probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
