// Cure probe Wave E — the export queue's handoff seat (R4-T7-2).
// The hunt probe (round4/probes/r4-export-gap.ts) proved the loss:
// a job shifted out of the queue for its 50 ms start timer existed
// nowhere — isQueued blind, cancelItem blind, the dedupe door blind,
// admission open. This probe asserts the cured contract at the far
// end (the clips that land): in the breath after a job ends, the
// next job is VISIBLE in its seat (isQueued true, a repeat tap is a
// 'duplicate'), and cancelItem can call it back — whereupon it never
// lands and the following job takes the turn and does.
// Run: node ~/workspace/vela-work/run-ts-test.mjs test/cure-waveE-export-seat.ts (from ~/workspace/logos-work)
const lsStore = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (lsStore.has(k) ? lsStore.get(k)! : null),
  setItem: (k: string, v: string) => { lsStore.set(k, String(v)) },
  removeItem: (k: string) => { lsStore.delete(k) },
}
Object.defineProperty(globalThis, 'navigator', { value: { hardwareConcurrency: 4 }, configurable: true })
const emptyBucket = { keys: async () => [], match: async () => undefined, delete: async () => true, put: async () => {} }
;(globalThis as any).caches = { open: async () => emptyBucket, delete: async () => true }

type Rec = Record<string, any>
const idbData = new Map<string, Map<string, Rec>>()
const putTitles: string[] = []
function makeReq() { return { result: undefined as any, error: null as any, onsuccess: null as any, onerror: null as any } }
function makeStore(db: any, tx: any, name: string) {
  const map = () => { if (!idbData.has(name)) idbData.set(name, new Map()); return idbData.get(name)! }
  const run = (req: any, op: () => void) => { tx._begin(); setTimeout(() => { try { op() } finally { tx._end() } }, 0); return req }
  return {
    get(key: string) { const req = makeReq(); return run(req, () => { req.result = map().get(key); req.onsuccess?.() }) },
    getAll() { const req = makeReq(); return run(req, () => { req.result = [...map().values()]; req.onsuccess?.() }) },
    put(rec: Rec) { const req = makeReq(); return run(req, () => { map().set(rec.id, rec); if (name === 'clips') putTitles.push(String(rec.title)); req.result = rec.id; req.onsuccess?.() }) },
    delete(key: string) { const req = makeReq(); return run(req, () => { map().delete(key); req.onsuccess?.() }) },
    createIndex() {},
  }
}
function makeDb() {
  const db: any = {
    objectStoreNames: { contains: (n: string) => idbData.has(n) },
    createObjectStore(name: string) { if (!idbData.has(name)) idbData.set(name, new Map()); return { createIndex() {} } },
    transaction(names: string | string[], _mode: string) {
      const tx: any = { error: null, oncomplete: null, onabort: null, onerror: null, _pending: 0, _fired: false,
        _begin() { tx._pending++ },
        _end() { tx._pending--; setTimeout(() => { if (tx._pending === 0 && !tx._fired) { tx._fired = true; tx.oncomplete?.() } }, 0) },
        abort() { tx.onabort?.() },
        objectStore(name: string) { return makeStore(db, tx, name) },
      }
      void names
      return tx
    },
  }
  return db
}
;(globalThis as any).indexedDB = {
  open(_name: string, _ver: number) {
    const req = makeReq()
    const db = makeDb()
    setTimeout(() => { req.result = db; req.onupgradeneeded?.(); setTimeout(() => { req.result = db; req.onsuccess?.() }, 0) }, 0)
    return req
  },
}

const EXP = await import('../src/player/exporter.ts')
let pass = 0, fail = 0
const check = (name: string, ok: boolean, extra = '') => {
  if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const breath = 'IMG_2044.jpg' // segments non-empty, speaks empty — no TTS engine needed
const o = (title: string, id?: string) => ({ voice: null, speed: 1, format: 'wav' as const, title, origin: 'create' as const, ...(id ? { id } : {}) })

check('job A starts', EXP.queueExport(breath, o('Alpha')) === 'started')
check('job B queues (carries its clip id)', EXP.queueExport('IMG_2045.jpg', o('Bravo', 'clip-b')) === 'queued')
check('job C queues', EXP.queueExport('IMG_2046.jpg', o('Charlie', 'clip-c')) === 'queued')

// The moment A ends, B sits in the handoff seat for ~50 ms. The
// end-of-job chain (status set → next()) runs in one microtask
// breath, so a 1 ms poll always lands inside the seat's window.
let seated = false
const deadline = Date.now() + 15000
while (Date.now() < deadline) {
  if (EXP.exportJob.get().status === 'done') {
    seated = true
    check('in the handoff breath, isQueued sees the seated job', EXP.isQueued('clip-b') === true)
    check('a repeat tap of the seated job is a duplicate', EXP.queueExport('IMG_2045.jpg', o('Bravo', 'clip-b')) === 'duplicate')
    EXP.cancelItem('clip-b')
    check('cancelItem calls the seated job back (no longer queued anywhere)', EXP.isQueued('clip-b') === false)
    break
  }
  await sleep(1)
}
check('the seat was observed (specimen precondition)', seated)

await sleep(4000)
console.log('      clips put:', JSON.stringify(putTitles))
check('job A landed', putTitles.includes('Alpha'), JSON.stringify(putTitles))
check('the called-back job B never landed', !putTitles.includes('Bravo'), JSON.stringify(putTitles))
check('job C took the turn and landed', putTitles.includes('Charlie'), JSON.stringify(putTitles))

console.log(`\ncure-waveE-export-seat probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
