// CURE Wave B — T1-18 probe: while the render cache's opening census
// FAILS, saves must still land (the old code dropped every put
// silently) and the failure must be carried on the module's witness.
// Same minimal IndexedDB shim as audit-w3-rendercache, except the
// cursor — loadTotal's only road — errors on every open.
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
    queueMicrotask(() => { rq.onerror?.() })
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

const { putPersistedRender, flushRenderCache, renderCacheLedgerBytes, renderCacheCensusFailed, hasPersistedRender } = await import('../src/player/rendercache.ts')

let pass = 0, fail = 0
const check = (name: string, ok: boolean, extra = '') => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) } }
const blob = (n: number) => new Blob([new Uint8Array(n)])

putPersistedRender('k1', blob(100)); await flushRenderCache()
check('T1-18 the save LANDS while the census is failing (old code dropped it)', (await hasPersistedRender('k1')) && data.get('k1')?.size === 100)
check('T1-18 the failure is carried on the witness, not silent', renderCacheCensusFailed() === true)
check('T1-18 the ledger honestly stays unknown (no invented budget)', renderCacheLedgerBytes() === -1, `ledger=${renderCacheLedgerBytes()}`)
putPersistedRender('k2', blob(50)); await flushRenderCache()
check('T1-18 saves keep landing on later puts', (await hasPersistedRender('k2')) && data.size === 2)

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exitCode = 1
