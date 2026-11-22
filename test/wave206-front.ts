// 1.4.206 — the front seat of the line, judged on the record's own
// laws: a fresh text takes the head, a lined-up text MOVES to the
// head (one entry, never two), the head re-fronted is itself, and
// the order behind the head is untouched.
const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, String(v)) },
  removeItem: (k: string) => { mem.delete(k) },
}

const { queueItems, enqueue, enqueueFront, clearQueue } = await import('../src/lib/queue.ts')

let fails = 0
const ok = (cond: boolean, name: string) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`); if (!cond) fails++ }

const A = 'Alpha text. It speaks first.'
const B = 'Bravo text. It speaks second.'
const C = 'Charlie text. It speaks third.'
const D = 'Delta text. It cuts the line.'

clearQueue()
enqueue(A, 'Alpha', 10); enqueue(B, 'Bravo', 20); enqueue(C, 'Charlie', 30)
ok(queueItems().map((i) => i.title).join(',') === 'Alpha,Bravo,Charlie', 'the line stands in order')

const d = enqueueFront(D, 'Delta', 40)
ok(queueItems().length === 4 && queueItems()[0].id === d.id, 'a fresh text takes the head')
ok(queueItems().map((i) => i.title).join(',') === 'Delta,Alpha,Bravo,Charlie', 'the rest keep their order behind it')

const b = enqueueFront(B, 'Bravo', 20)
ok(queueItems().length === 4, 'a lined-up text moves — it is never two entries')
ok(queueItems()[0].title === 'Bravo' && b.title === 'Bravo', 'the moved text wears the head')
ok(queueItems().map((i) => i.title).join(',') === 'Bravo,Delta,Alpha,Charlie', 'its old seat closes behind it')

const again = enqueueFront(B, 'Bravo', 20)
ok(again.id === b.id && queueItems().length === 4 && queueItems()[0].id === b.id, 'the head re-fronted is itself, unmoved')

console.log(fails === 0 ? 'WAVE206 FRONT: ALL PASS' : `WAVE206 FRONT: ${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
