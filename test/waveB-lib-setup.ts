// Setup for the Wave B library probe: localStorage + a minimal
// IndexedDB (the mopup-m10 surface, plus the createIndex stub
// library.ts's upgrade chains) + an Audio stub whose metadata always
// fails (the duration-0 import path) + a compact XML DOM, since node
// has no DOMParser and the EPUB parser needs one. Imported FIRST so
// every global exists before the app modules load.
const ls = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (ls.has(k) ? ls.get(k)! : null),
  setItem: (k: string, v: string) => { ls.set(k, String(v)) },
  removeItem: (k: string) => { ls.delete(k) },
}
Object.defineProperty(globalThis, 'navigator', {
  value: { hardwareConcurrency: 4, storage: undefined, canShare: () => true, share: async () => {} },
  configurable: true,
})

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
  createIndex() { return {} }
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

// Audio whose metadata NEVER loads: importAudio's probe falls to its
// error path and the clip is saved with duration 0 — the L-1 setup.
class FakeAudio {
  duration = Number.NaN
  preload = ''
  onloadedmetadata: (() => void) | null = null
  onerror: (() => void) | null = null
  set src(_v: string) { queueMicrotask(() => this.onerror?.()) }
  get src() { return '' }
}
;(globalThis as any).Audio = FakeAudio
;(globalThis as any).URL.createObjectURL = () => 'blob:fake'
;(globalThis as any).URL.revokeObjectURL = () => {}

// ---- A compact XML DOM (the surface epub.ts/html.ts actually use) ----
class XText {
  nodeType = 3
  nodeValue: string
  constructor(v: string) { this.nodeValue = v }
  get textContent() { return this.nodeValue }
}
class XEl {
  nodeType = 1
  localName: string
  attrs = new Map<string, string>()
  childNodes: Array<XEl | XText> = []
  constructor(public qualified: string) { this.localName = qualified.includes(':') ? qualified.slice(qualified.indexOf(':') + 1) : qualified }
  get children() { return this.childNodes.filter((n): n is XEl => n.nodeType === 1) }
  get textContent(): string { return this.childNodes.map((n) => n.textContent).join('') }
  getAttribute(name: string) { return this.attrs.has(name) ? this.attrs.get(name)! : null }
  getAttributeNS(_ns: string, name: string) {
    if (this.attrs.has(name)) return this.attrs.get(name)!
    for (const [k, v] of this.attrs) if (k.endsWith(':' + name)) return v
    return null
  }
  getElementsByTagName(name: string): XEl[] {
    const out: XEl[] = []
    const walk = (e: XEl) => { for (const c of e.children) { if (name === '*' || c.localName === name) out.push(c); walk(c) } }
    walk(this)
    return out
  }
}
class XDoc {
  constructor(public documentElement: XEl) {}
  get body() { return this.getElementsByTagName('body')[0] as XEl | undefined }
  getElementsByTagName(name: string): XEl[] {
    const inner = this.documentElement.getElementsByTagName(name)
    return name === '*' || this.documentElement.localName === name ? [this.documentElement, ...inner] : inner
  }
}
const decodeEntities = (s: string) => s.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (m, e: string) => {
  if (e[0] === '#') { const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return String.fromCodePoint(code) }
  return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[e] ?? m
})
function parseXml(text: string): XEl {
  const root = new XEl('#root')
  const stack: XEl[] = [root]
  let i = 0
  const pushText = (raw: string) => { if (raw) stack[stack.length - 1].childNodes.push(new XText(decodeEntities(raw))) }
  while (i < text.length) {
    const lt = text.indexOf('<', i)
    if (lt === -1) { pushText(text.slice(i)); break }
    if (lt > i) pushText(text.slice(i, lt))
    if (text.startsWith('<!--', lt)) { const end = text.indexOf('-->', lt); i = end === -1 ? text.length : end + 3; continue }
    if (text.startsWith('<![CDATA[', lt)) { const end = text.indexOf(']]>', lt); const raw = text.slice(lt + 9, end === -1 ? text.length : end); stack[stack.length - 1].childNodes.push(new XText(raw)); i = end === -1 ? text.length : end + 3; continue }
    if (text.startsWith('<?', lt)) { const end = text.indexOf('?>', lt); i = end === -1 ? text.length : end + 2; continue }
    if (text.startsWith('<!', lt)) { const end = text.indexOf('>', lt); i = end === -1 ? text.length : end + 1; continue }
    const gt = text.indexOf('>', lt)
    if (gt === -1) break
    const tagSrc = text.slice(lt + 1, gt)
    i = gt + 1
    if (tagSrc.startsWith('/')) { stack.pop(); continue }
    const selfClose = tagSrc.endsWith('/')
    const body = selfClose ? tagSrc.slice(0, -1) : tagSrc
    const sp = body.search(/\s/)
    const name = sp === -1 ? body : body.slice(0, sp)
    const el = new XEl(name)
    if (sp !== -1) {
      const attrRe = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g
      let m: RegExpExecArray | null
      const attrSrc = body.slice(sp)
      while ((m = attrRe.exec(attrSrc))) el.attrs.set(m[1], decodeEntities(m[3] ?? m[4] ?? ''))
    }
    stack[stack.length - 1].childNodes.push(el)
    if (!selfClose) stack.push(el)
  }
  return root.children[0]
}
class DOMParserShim { parseFromString(text: string) { return new XDoc(parseXml(text)) } }
;(globalThis as any).DOMParser = DOMParserShim

export {}
