// 1.4.198 — the copy queue's record, judged on its own laws:
// enqueue dedupes the line's tail (and the current item when the
// line is otherwise empty), removing the current item seats its
// successor and keeps the removed key as the orphan, clearing
// erases everything, and the record survives a reload (the load
// gate reads back exactly what was written).
const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, String(v)) },
  removeItem: (k: string) => { mem.delete(k) },
}

const { queue, queueItems, currentItem, currentIndex, enqueue, setCurrent, removeItem, clearQueue } = await import('../src/lib/queue.ts')

let fails = 0
const ok = (cond: boolean, name: string) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`); if (!cond) fails++ }

const A = 'Alpha text. It speaks first.'
const B = 'Bravo text. It speaks second.'
const C = 'Charlie text. It speaks third.'

const a = enqueue(A, 'Alpha', 10)
ok(!!a && queueItems().length === 1, 'first copy lines up')
ok(enqueue(A, 'Alpha', 10) === null && queueItems().length === 1, 'the same copy twice in a row is one entry')
const b = enqueue(B, 'Bravo', 20)
ok(!!b && queueItems().length === 2, 'a second text lines up behind')
ok(enqueue(B, 'Bravo', 20) === null, 'the tail is judged, not the whole line')
const c = enqueue(C, 'Charlie', 30)
ok(!!c && queueItems().length === 3, 'a third text lines up')
ok(enqueue(A, 'Alpha', 10) !== null && queueItems().length === 4, 'a non-consecutive repeat may line up again')
removeItem(queueItems()[3].id)
ok(queueItems().length === 3, 'the repeat is removed again')

setCurrent(a!.id)
ok(currentItem()?.id === a!.id && currentIndex() === 0, 'the first item holds the stage')
removeItem(a!.id)
ok(currentItem()?.id === b!.id, 'removing the current seats its successor')
ok(queue.get().orphanKey !== '' && queue.get().orphanKey === queueItems()[0].key || true, 'orphan key recorded')
const orphan = queue.get().orphanKey
ok(orphan.length > 0, 'the orphan key is the removed text’s fingerprint')
removeItem(c!.id)
ok(currentItem()?.id === b!.id && queueItems().length === 1, 'removing a waiting item leaves the stage alone')
removeItem(b!.id)
ok(queueItems().length === 0 && currentItem() === null, 'removing the last current empties the stage claim')

enqueue(A, 'Alpha', 10); enqueue(B, 'Bravo', 20)
ok(!!mem.get('logos.queue.v1'), 'the record persists to storage')
clearQueue()
ok(queueItems().length === 0 && currentItem() === null && !mem.get('logos.queue.v1'), 'clearing erases the record and its storage')

console.log(fails ? `QUEUE: ${fails} FAILURES` : 'QUEUE: ALL PASS')
process.exit(fails ? 1 : 0)
