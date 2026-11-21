// WAVE C (1.4.190) — R2-T4-5 + R2-T4-6 cure probes.
// T4-5: engine.cached's Pocket flag was probed for ONE language and
// read for both — with only English downloaded, the state shown for
// a Spanish Pocket voice claimed cached:true and phase 'warm'.
// The flag is now per language; this probe puts ONLY English in the
// bucket and reads the shown state for both languages.
// T4-6: pocketCached's manifest fetch had no deadline — a stalled
// network hung every probe forever. The fetch now aborts at 10 s
// and the recorded-digest fallback answers; this probe stalls the
// manifest and times the settlement. (Slow by design: ~20 s.)
//
// 1.4.195 RE-SCOPE (the pin): the manifests below speak in the real
// upstream's grammar — 16-hex prefixes of the pinned digests, with
// the pinned byte counts — and the bucket's English body is a 5-byte
// mock, which is NOT the pinned model. So the shown state can no
// longer read cached:true here: what this probe now proves is the
// per-language discipline around the pin — each language's probe
// learns its OWN pinned identity (never the other's), the shown
// state is read for the active language, and an unverifiable body
// shows not-cached for both. The true-positive shown state (a real
// model body reads cached) is proven by the real-file bench in
// NOTES 1.4.195. T4-6's subject — bounded settlement — is unchanged;
// its fallback leg now also asserts the fallback refuses the
// non-model body it is offered.
const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
}
Object.defineProperty(globalThis, 'navigator', { value: { hardwareConcurrency: 4, deviceMemory: 4 }, configurable: true })
;(globalThis as any).self = globalThis

const BODY_EN = new Uint8Array([11, 22, 33, 44, 55])
const EN_PREFIX = '010c6701d007277e'
const ES_PREFIX = 'fd31ae98160932ed'
const EN_PIN = '010c6701d007277e6b37440b909de098200802fddbe70f74e890763b5dd43745'
const ES_PIN = 'fd31ae98160932edb15c22e4a3539912a1010c691615fff0bc05c9135e18dd81'

// The pocket bucket holds ONLY the English entry, filed under the
// manifest prefix key exactly as the loader files it — its body is a
// mock, not the pinned model.
const pocketBucket = {
  keys: async () => [{ url: `https://cdn.example/model.onnx?v=${EN_PREFIX}` }],
  match: async (req: any) => {
    const url = typeof req === 'string' ? req : req?.url ?? ''
    if (!String(url).includes(EN_PREFIX)) return undefined
    return new Response(BODY_EN.slice(), { headers: { 'content-length': String(BODY_EN.byteLength) } })
  },
  delete: async () => true,
}
const emptyBucket = { keys: async () => [], match: async () => undefined, delete: async () => true }
;(globalThis as any).caches = {
  open: async (name: string) => (name === 'pocket-tts-models-v2' ? pocketBucket : emptyBucket),
  delete: async () => true,
}

let fetchMode: 'online' | 'stall' = 'online'
;(globalThis as any).fetch = async (url: string, opts?: { signal?: AbortSignal }) => {
  if (fetchMode === 'stall') {
    // A connection accepted and then held: never answers, but an
    // abort lands — exactly the captive-portal shape of T4-6.
    return new Promise((_, reject) => {
      const sig = opts?.signal
      if (!sig) return // no signal: hangs forever (the pre-cure world)
      if (sig.aborted) { reject(new DOMException('Aborted', 'AbortError')); return }
      sig.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })
  }
  const lang = String(url).includes('/es/') ? 'es' : 'en'
  const body = lang === 'en'
    ? { model: { file: 'model.onnx', sha256: EN_PREFIX, bytes: 176992315 } }
    : { model: { file: 'model.onnx', sha256: ES_PREFIX, bytes: 173604779 } }
  return { json: async () => body }
}

const { settings } = await import('../src/lib/settings.ts')
const { pocket, pocketCached, pocketModelDigest } = await import('../src/engine/pocket.ts')
const { engine, isModelCached } = await import('../src/engine/engine.ts')

let fails = 0
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + extra}`)
  if (!ok) fails++
}

// ---------- T4-5: one language's download must not answer for the other ----------
settings.set({ langMode: 'en', voiceOverride: 'pk_alba' } as any)
await isModelCached()

pocket.set({ active: 'en' })
let st = engine.get()
check('T4-5 English shown state is read for English (per-language reading)', st.lang === 'en', `lang=${st.lang}`)
check('T4-5 English shown state: NOT cached — the filed body is not the pinned model (1.4.195)', st.cached === false, `cached=${st.cached}`)
check('T4-5 the English probe learned the English pinned identity', pocketModelDigest('en') === EN_PIN)

pocket.set({ active: 'es' })
st = engine.get()
check('T4-5 Spanish shown state: NOT cached (only English was ever downloaded)', st.lang === 'es' && st.cached === false, `lang=${st.lang} cached=${st.cached}`)
check('T4-5 the Spanish probe learned the Spanish pinned identity, not the English one', pocketModelDigest('es') === ES_PIN)

const esLang = pocket.get().langs.es
pocket.set({ active: 'es', langs: { ...pocket.get().langs, es: { ...esLang, status: 'loading', loaded: 0, total: 0, fromCache: false } } })
st = engine.get()
check('T4-5 a Spanish load is labelled a download, not a warm start', st.phase === 'download', `phase=${st.phase}`)

// ---------- T4-6: a stalled manifest can no longer wedge the probe ----------
fetchMode = 'stall'
const t0 = Date.now()
const esStalled = await pocketCached('es')
const esElapsed = Date.now() - t0
check('T4-6 stalled manifest: pocketCached(es) settles false', esStalled === false)
check('T4-6 stalled manifest: settlement is bounded by the deadline, not instant, not forever', esElapsed >= 8_000 && esElapsed < 20_000, `${esElapsed}ms`)

const t1 = Date.now()
const enStalled = await pocketCached('en')
const enElapsed = Date.now() - t1
check('T4-6 stalled manifest: the recorded-digest fallback answers for English — and refuses the non-model body (1.4.195)', enStalled === false)
check('T4-6 stalled manifest: the fallback settlement is bounded too', enElapsed < 20_000, `${enElapsed}ms`)

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASS')
process.exitCode = fails ? 1 : 0
