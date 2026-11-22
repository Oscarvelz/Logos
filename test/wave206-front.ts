// 1.4.206 built the front seat of the line; 1.4.239 retired it
// under Oscar's law — the line's order is the COPY order («Lo que
// define el orden de los audios es el orden de los textos
// copiados… en lugar de ir montando de primero los últimos
// textos»). This bench now judges the law that stands: arrivals
// only ever join the tail, in their turn, and the record offers
// no front door at all.
const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, String(v)) },
  removeItem: (k: string) => { mem.delete(k) },
}

const q = await import('../src/lib/queue.ts')
const { queueItems, enqueue, clearQueue } = q

let fails = 0
const ok = (cond: boolean, name: string) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`); if (!cond) fails++ }

const A = 'Alpha text. It speaks first.'
const B = 'Bravo text. It speaks second.'
const C = 'Charlie text. It speaks third.'
const D = 'Delta text. It waits its turn.'

clearQueue()
enqueue(A, 'Alpha', 10); enqueue(B, 'Bravo', 20); enqueue(C, 'Charlie', 30)
ok(queueItems().map((i) => i.title).join(',') === 'Alpha,Bravo,Charlie', 'the line stands in copy order')

enqueue(D, 'Delta', 40)
ok(queueItems().map((i) => i.title).join(',') === 'Alpha,Bravo,Charlie,Delta', 'a late copy takes the tail — the last seat, never the first')

ok(!('enqueueFront' in q), 'the record offers no front door — the front road is retired')

console.log(fails === 0 ? 'WAVE239 COPY ORDER: ALL PASS' : `WAVE239 COPY ORDER: ${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
