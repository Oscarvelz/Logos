// AUDIT Wave3 T4-11 (Pocket half): a cache-write failure must fail the
// fetch honestly, not return silent success.
const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
}
let putFails = true
const bucket = {
  match: async () => undefined,
  put: async () => { if (putFails) throw new Error('QuotaExceededError') },
  delete: async () => true,
}
;(globalThis as any).caches = { open: async () => bucket, delete: async () => true }
;(globalThis as any).fetch = async () => new Response(new Uint8Array([9, 8, 7]), { headers: { 'content-length': '3' } })

import { fetchAsset } from '../src/engine/pocket-assets.js'

let pass = 0, fail = 0
const check = (name: string, ok: boolean) => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name) } }

let threw = ''
try { await fetchAsset('https://hf/espeak.bin', undefined, undefined) } catch (e: any) { threw = e?.message ?? String(e) }
check('cache-write failure throws instead of silent success', /Could not save/i.test(threw))
putFails = false
let okBuf: any = null, okThrew = ''
try { okBuf = await fetchAsset('https://hf/espeak.bin', undefined, undefined) } catch (e: any) { okThrew = e?.message ?? String(e) }
check('successful save still returns the bytes', !okThrew && okBuf && okBuf.byteLength === 3)
console.log(`T4-11 probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
