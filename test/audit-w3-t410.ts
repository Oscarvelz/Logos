// AUDIT Wave3 T4-10: pocketCached offline fallback must be language-bound.
// Online pass records en digest; offline, es must NOT be certified by en's model.
//
// 1.4.195 RE-SCOPE (the pin): certification now judges against the
// full model digests pinned in pocket-assets.js, measured from the
// real upstream files. The upstream manifest carries only 16-hex
// prefixes, so this probe's manifests speak in prefixes, as the real
// ones do. A mock body can no longer BE the pinned model, so the
// true-positive certification leg (a real body certifies, online and
// offline) is proven by the real-file bench recorded in NOTES 1.4.195;
// what this probe proves is the pin-world machinery around it: the
// probe learns the FULL pinned digest from a prefix manifest, an
// unpinned manifest records nothing, the fallback stays bound to the
// language's own recorded identity (T4-10's law), and a body that is
// not the pinned model certifies nothing under its own key.
const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
}
Object.defineProperty(globalThis,'navigator',{value:{hardwareConcurrency:4,deviceMemory:4},configurable:true})
;(globalThis as any).self = globalThis

const EN_PIN = '010c6701d007277e6b37440b909de098200802fddbe70f74e890763b5dd43745'
const EN_PREFIX = '010c6701d007277e'
// Cache bucket containing ONLY the English entry, filed under the
// manifest prefix key exactly as the loader files it — with a 5-byte
// body that is NOT the pinned model.
const enKey = `https://hf/model.onnx?v=${EN_PREFIX}`
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
    ? { model: { file: 'model.onnx', sha256: EN_PREFIX, bytes: 176992315 } }
    : { model: { file: 'model.onnx', sha256: 'bbbbbbbbbbbbbbbb', bytes: 173604779 } }
  return { json: async () => body }
}

import { pocketCached, pocketModelDigest } from '../src/engine/pocket.ts'

let pass = 0, fail = 0
const check = (name: string, ok: boolean) => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name) } }

const enOnline = await pocketCached('en')
check('pin: the probe learned the FULL pinned digest from the prefix manifest', pocketModelDigest('en') === EN_PIN)
check('pin: a body that is not the pinned model does not certify', enOnline === false)
const esOnline = await pocketCached('es')
check('pin gate: an unpinned manifest certifies nothing for es', esOnline === false)
check('pin gate: an unpinned manifest records nothing for es', pocketModelDigest('es') === null)
offline = true
const esOffline = await pocketCached('es')
check('offline: es NOT certified by en model (T4-10)', esOffline === false)
const enOffline = await pocketCached('en')
check('offline: en not certified by a non-model body under its own key', enOffline === false)
console.log(`T4-10 probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
