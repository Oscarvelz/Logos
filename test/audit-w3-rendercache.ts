// AUDIT Wave 3 T1-10 — render-cache ledger probe with a minimal
// in-memory IndexedDB shim covering exactly the API surface
// rendercache.ts uses (open/upgrade, get/put/delete/getAll,
// openCursor). Ledger must equal the store's real byte sum after
// overwrites, drops, and concurrent puts.
type Req = { result?: any; onsuccess?: (() => void) | null; onerror?: (() => void) | null }
const data = new Map<string, any>()
function makeReq(exec: () => any): Req {
  const rq: Req = {}
  queueMicrotask(() => { try { rq.result = exec(); rq.onsuccess?.() } catch { rq.onerror?.() } })
  return rq
}
const storeObj = {
  get: (k: string) => makeReq(() => data.get(k)),
  put: (rec: any) => makeReq(() => { data.set(rec.key, rec); return rec.key }),
  delete: (k: string) => makeReq(() => { data.delete(k); return undefined }),
  getAll: () => makeReq(() => [...data.values()]),
  openCursor: () => {
    const rq: Req = {}
    const items = [...data.values()]
    let i = 0
    const step = () => {
      if (i < items.length) {
        const v = items[i++]
        rq.result = { value: v, continue: () => queueMicrotask(step) }
      } else rq.result = null
      rq.onsuccess?.()
    }
    queueMicrotask(step)
    return rq
  },
}
;(globalThis as any).indexedDB = {
  open: () => {
    const rq: Req & { result?: any } = {}
    queueMicrotask(() => {
      rq.result = {
        objectStoreNames: { contains: () => true },
        createObjectStore: () => ({}),
        transaction: () => ({ objectStore: () => storeObj, onerror: null }),
      }
      ;(rq as any).onupgradeneeded?.()
      rq.onsuccess?.()
    })
    return rq
  },
}

const { putPersistedRender, dropPersistedRender, flushRenderCache, renderCacheLedgerBytes, hasPersistedRender } = await import('../src/player/rendercache.ts')

let pass = 0, fail = 0
const check = (name: string, ok: boolean, extra = '') => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) } }
const blob = (n: number) => new Blob([new Uint8Array(n)])
const realSum = () => [...data.values()].reduce((a, r) => a + r.size, 0)

putPersistedRender('k1', blob(100)); await flushRenderCache()
check('ledger after first put = 100 = store', renderCacheLedgerBytes() === 100 && realSum() === 100, `ledger=${renderCacheLedgerBytes()} real=${realSum()}`)
putPersistedRender('k1', blob(150)); await flushRenderCache()
check('overwrite counts the difference, not the whole new size (old over-count)', renderCacheLedgerBytes() === 150 && realSum() === 150, `ledger=${renderCacheLedgerBytes()} real=${realSum()}`)
putPersistedRender('k2', blob(50)); await flushRenderCache()
check('second key adds: ledger = 200 = store', renderCacheLedgerBytes() === 200 && realSum() === 200, `ledger=${renderCacheLedgerBytes()} real=${realSum()}`)
dropPersistedRender('k1'); await flushRenderCache()
check('drop subtracts (old code never touched the ledger)', renderCacheLedgerBytes() === 50 && realSum() === 50, `ledger=${renderCacheLedgerBytes()} real=${realSum()}`)
dropPersistedRender('nope'); await flushRenderCache()
check('dropping a missing key changes nothing', renderCacheLedgerBytes() === 50 && realSum() === 50, `ledger=${renderCacheLedgerBytes()} real=${realSum()}`)
// Concurrent burst, including a same-key race — serialized chain must keep ledger = store.
putPersistedRender('k3', blob(10)); putPersistedRender('k3', blob(20)); putPersistedRender('k4', blob(5)); putPersistedRender('k2', blob(60))
await flushRenderCache()
check('concurrent puts (same-key race + overwrite): ledger = store', renderCacheLedgerBytes() === realSum() && realSum() === 85, `ledger=${renderCacheLedgerBytes()} real=${realSum()}`)
check('surviving entries are really in the store', (await hasPersistedRender('k3')) && (await hasPersistedRender('k4')) && !(await hasPersistedRender('k1')))

console.log(`T1-10 probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
