// 1.4.206 built the front seat of the line; 1.4.239 retired it
// under Oscar's law — the line's order is the COPY order («Lo que
// define el orden de los audios es el orden de los textos
// copiados… en lugar de ir montando de primero los últimos
// textos»). 1.4.249 (Oscar's word, 2026-11-25) refines the law
// without breaking it: arrivals still only ever join the tail,
// in their turn — but the record again offers a front door, and
// it belongs to ONE deed only: the paste key's confirmed hand
// paste, which reaches it carrying the shell's front stamp.
// This bench judges both halves: the tail law for arrivals, and
// the front door's existence and deed for the hand.
const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, String(v)) },
  removeItem: (k: string) => { mem.delete(k) },
}

const q = await import('../src/lib/queue.ts')
const { queueItems, enqueue, enqueueFront, clearQueue } = q

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

ok(typeof enqueueFront === 'function', 'the record offers a front door — for the confirmed hand paste only')
const E = 'Echo text. His hand sent it first.'
enqueueFront(E, 'Echo', 50)
ok(queueItems().map((i) => i.title).join(',') === 'Echo,Alpha,Bravo,Charlie,Delta', 'a confirmed hand paste takes the head — the line behind keeps its order')
enqueueFront(B, 'Bravo', 20)
ok(queueItems().map((i) => i.title).join(',') === 'Bravo,Echo,Alpha,Charlie,Delta', 'a hand paste of a waiting text moves it to the head — no duplicate stands')
enqueue(A, 'Alpha', 10)
ok(queueItems().map((i) => i.title).join(',') === 'Bravo,Echo,Alpha,Charlie,Delta,Alpha', 'an arrival after the front deed still takes the tail')

console.log(fails === 0 ? 'WAVE249 COPY ORDER + FRONT DOOR: ALL PASS' : `WAVE249 COPY ORDER + FRONT DOOR: ${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
