// Setup for deleteModel probe: executes before engine modules load.
const store = new Map<string, string>()
store.set('logos.kept', JSON.stringify({ 'pocket.en': { at: 1, digest: 'x' }, 'phonon.en': { at: 2, digest: 'y' } }))
store.set('logos.keepNote', JSON.stringify({ kind: 'cleared', engine: 'pocket', lang: 'en', at: 1 }))
store.set('logos.pocketDigests', JSON.stringify({ en: { file: 'model.onnx', sha: 'aaaa' } }))
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
}
Object.defineProperty(globalThis, 'navigator', { value: { hardwareConcurrency: 4, deviceMemory: 4, storage: undefined }, configurable: true })
const deleted: string[] = []
const emptyBucket = { keys: async () => [], match: async () => undefined, delete: async () => true, put: async () => {} }
;(globalThis as any).caches = { open: async () => emptyBucket, delete: async (n: string) => { deleted.push(n); return true } }
;(globalThis as any).__delstore = store
;(globalThis as any).__deleted = deleted
export {}
