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
const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
}
Object.defineProperty(globalThis, 'navigator', { value: { hardwareConcurrency: 4, deviceMemory: 4 }, configurable: true })
;(globalThis as any).self = globalThis

const sha256 = async (bytes: Uint8Array): Promise<string> => {
  const d = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('')
}
const BODY_EN = new Uint8Array([11, 22, 33, 44, 55])
const BODY_ES = new Uint8Array([66, 77, 88, 99, 111])
const SHA_EN = await sha256(BODY_EN)
const SHA_ES = await sha256(BODY_ES)

// The pocket bucket holds ONLY the English model, filed under its
// digest key, body hash-true and size-true (entryMatchesModel's bar).
const pocketBucket = {
  keys: async () => [{ url: `https://cdn.example/model.onnx?v=${SHA_EN}` }],
  match: async (req: any) => {
    const url = typeof req === 'string' ? req : req?.url ?? ''
    if (!String(url).includes(SHA_EN)) return undefined
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
    ? { model: { file: 'model.onnx', sha256: SHA_EN, bytes: BODY_EN.byteLength } }
    : { model: { file: 'model.onnx', sha256: SHA_ES, bytes: BODY_ES.byteLength } }
  return { json: async () => body }
}

const { settings } = await import('../src/lib/settings.ts')
const { pocket, pocketCached } = await import('../src/engine/pocket.ts')
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
check('T4-5 English shown state: cached (its model IS on the phone)', st.lang === 'en' && st.cached === true, `lang=${st.lang} cached=${st.cached}`)

pocket.set({ active: 'es' })
st = engine.get()
check('T4-5 Spanish shown state: NOT cached (only English was ever downloaded)', st.lang === 'es' && st.cached === false, `lang=${st.lang} cached=${st.cached}`)

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
check('T4-6 stalled manifest: the recorded-digest fallback still certifies English', enStalled === true)
check('T4-6 stalled manifest: the fallback settlement is bounded too', enElapsed < 20_000, `${enElapsed}ms`)

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASS')
process.exitCode = fails ? 1 : 0
