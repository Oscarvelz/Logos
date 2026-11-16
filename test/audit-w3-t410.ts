// AUDIT Wave3 T4-10: pocketCached offline fallback must be language-bound.
// Online pass records en digest; offline, es must NOT be certified by en's model.
const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
}
Object.defineProperty(globalThis,'navigator',{value:{hardwareConcurrency:4,deviceMemory:4},configurable:true})
;(globalThis as any).self = globalThis

// Cache bucket containing ONLY the English model entry, body exactly 5 bytes.
const enKey = 'https://hf/model.onnx?v=aaaa'
const bucket = {
  keys: async () => [{ url: enKey }],
  match: async (req: any) => {
    const url = typeof req === 'string' ? req : req.url
    if (url !== enKey) return undefined
    return new Response(new Uint8Array([1, 2, 3, 4, 5]), { headers: { 'content-length': '5' } })
  },
}
;(globalThis as any).caches = { open: async () => bucket, delete: async () => true }

let offline = false
;(globalThis as any).fetch = async (url: string) => {
  if (offline) throw new Error('offline')
  const lang = String(url).includes('/es/') ? 'es' : 'en'
  const body = lang === 'en'
    ? { model: { file: 'model.onnx', sha256: 'aaaa', bytes: 5 } }
    : { model: { file: 'model.onnx', sha256: 'bbbb', bytes: 5 } }
  return { json: async () => body }
}

import { pocketCached } from '../src/engine/pocket.ts'

let pass = 0, fail = 0
const check = (name: string, ok: boolean) => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name) } }

const enOnline = await pocketCached('en')
check('online: en certified by its own entry', enOnline === true)
offline = true
const esOffline = await pocketCached('es')
check('offline: es NOT certified by en model (T4-10)', esOffline === false)
const enOffline = await pocketCached('en')
check('offline: en still certified via its recorded digest', enOffline === true)
console.log(`T4-10 probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
