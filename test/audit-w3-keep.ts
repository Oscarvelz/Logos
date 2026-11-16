// AUDIT Wave3 T4-12 + T4-14 seams: clearKeepStamps wipes stamps+note;
// checkStamps (the function the 60s/visibility re-checks call) retires a
// stamp whose model is gone and posts the cleared note.
const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
}
Object.defineProperty(globalThis,'navigator',{value:{hardwareConcurrency:4,storage:undefined},configurable:true})
const emptyBucket = { keys: async () => [], match: async () => undefined, delete: async () => true }
;(globalThis as any).caches = { open: async () => emptyBucket, delete: async () => true }
;(globalThis as any).fetch = async () => { throw new Error('offline') }

import { clearKeepStamps, checkStamps, keep } from '../src/engine/keep.ts'

let pass = 0, fail = 0
const check = (name: string, ok: boolean) => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name) } }

// T4-12 seam: deliberate-delete bookkeeping wipe
store.set('logos.kept', JSON.stringify({ 'pocket.en': { at: 1, digest: 'x' } }))
store.set('logos.keepNote', JSON.stringify({ kind: 'cleared', engine: 'pocket', lang: 'en', at: 1 }))
clearKeepStamps()
check('clearKeepStamps removes logos.kept', store.get('logos.kept') === undefined)
check('clearKeepStamps removes logos.keepNote', store.get('logos.keepNote') === undefined)

// T4-14 seam: checkStamps detects a vanished model and reports it
store.set('logos.kept', JSON.stringify({ 'pocket.en': { at: 123, digest: 'x' } }))
await checkStamps()
check('checkStamps deletes stamp with no model behind it', (store.get('logos.kept') ?? '{}') === '{}')
check('checkStamps posts cleared note', keep.get().note?.kind === 'cleared' && keep.get().note?.engine === 'pocket')
console.log(`KEEP probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
