// Setup for the M-10 mop-up probe: localStorage + a minimal IndexedDB
// faithful to the surface books.ts uses (open with upgrade, transactions
// whose requests may be issued from inside success callbacks, completion
// when the request queue drains). Executes before the app modules load.
const ls = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (ls.has(k) ? ls.get(k)! : null),
  setItem: (k: string, v: string) => { ls.set(k, String(v)) },
  removeItem: (k: string) => { ls.delete(k) },
}
Object.defineProperty(globalThis, 'navigator', { value: { hardwareConcurrency: 4, storage: undefined }, configurable: true })

type StoreData = Map<string, unknown>
class FakeRequest {
  result: unknown = undefined
  error: unknown = null
  onsuccess: (() => void) | null = null
  onerror: (() => void) | null = null
  onupgradeneeded: (() => void) | null = null
  transaction: FakeTx | null = null
}
class FakeTx {
  queue: Array<() => void> = []
  done = false
  oncomplete: (() => void) | null = null
  onabort: (() => void) | null = null
  onerror: (() => void) | null = null
  error: unknown = null
  constructor(private db: FakeDB) {}
  objectStore(name: string) { return new FakeStore(this, this.db.stores.get(name)!) }
  enqueue(job: () => void) { this.queue.push(job); this.pump() }
  private pumping = false
  private pump() {
    if (this.pumping) return
    this.pumping = true
    queueMicrotask(() => {
      while (this.queue.length) { const job = this.queue.shift()!; job() }
      this.pumping = false
      if (!this.done) { this.done = true; this.oncomplete?.() }
    })
  }
  abort() { this.onabort?.() }
}
class FakeStore {
  constructor(private tx: FakeTx, private data: StoreData) {}
  private req(run: () => unknown) {
    const r = new FakeRequest()
    this.tx.enqueue(() => { r.result = run(); r.onsuccess?.() })
    return r
  }
  get(k: string) { return this.req(() => { const v = this.data.get(k); return v === undefined ? undefined : structuredClone(v) }) }
  getAll() { return this.req(() => [...this.data.values()].map((v) => structuredClone(v))) }
  put(v: { id: string }) { return this.req(() => { this.data.set(v.id, structuredClone(v)); return v.id }) }
  delete(k: string) { return this.req(() => { this.data.delete(k); return undefined }) }
}
class FakeDB {
  stores = new Map<string, StoreData>()
  objectStoreNames = { contains: (n: string) => this.stores.has(n) }
  version = 0
  upgradeTx: FakeTx | null = null
  createObjectStore(name: string) {
    if (!this.stores.has(name)) this.stores.set(name, new Map())
    return new FakeStore(this.upgradeTx!, this.stores.get(name)!)
  }
  transaction(_names: string | string[], _mode = 'readonly') { return new FakeTx(this) }
  close() {}
}
const dbs = new Map<string, FakeDB>()
;(globalThis as any).indexedDB = {
  open(name: string, version = 1) {
    const req = new FakeRequest()
    queueMicrotask(() => {
      let db = dbs.get(name)
      if (!db) { db = new FakeDB(); dbs.set(name, db) }
      ;(req as any).result = db
      if (db.version < version) {
        const tx = new FakeTx(db)
        db.upgradeTx = tx
        req.transaction = tx
        req.onupgradeneeded?.()
        db.version = version
        queueMicrotask(() => { req.onsuccess?.() })
      } else {
        req.onsuccess?.()
      }
    })
    return req
  },
}
export {}
