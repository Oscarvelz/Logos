// Wave D parent cure probe — R3-T7-6: the Voices page's "On this device"
// badge under its CURED rule (VoicesPage.tsx VoiceCard):
//   const onDevice = e.kind === v.engine && engineCachedFor(v.engine, v.lang)
// The hunt probe (round3/probes/r3-voice-badge.ts) hardcodes the OLD rule
// and so cannot flip; this probe mirrors its specimen exactly (EN-only
// bucket, hash-true) and judges the rule the page now runs.
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
;(globalThis as any).fetch = async (url: string) => {
  const lang = String(url).includes('/es/') ? 'es' : 'en'
  const body = lang === 'en'
    ? { model: { file: 'model.onnx', sha256: SHA_EN, bytes: BODY_EN.byteLength } }
    : { model: { file: 'model.onnx', sha256: SHA_ES, bytes: BODY_ES.byteLength } }
  return { json: async () => body }
}

const { settings } = await import('../src/lib/settings.ts')
const { pocket } = await import('../src/engine/pocket.ts')
const { engine, engineCachedFor, isModelCached } = await import('../src/engine/engine.ts')
const { voiceById } = await import('../src/lib/voices.ts')

// The page's cured badge rule, verbatim.
const badge = (voiceId: string): boolean => {
  const e = engine.get()
  const v = voiceById(voiceId)!
  return e.kind === v.engine && engineCachedFor(v.engine, v.lang)
}

let pass = 0, fail = 0
const check = (name: string, ok: boolean, extra = '') => {
  if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) }
}

settings.set({ langMode: 'en', voiceOverride: 'pk_alba' } as any)
await isModelCached()

pocket.set({ active: 'en' })
check('control: Alba (en) wears the badge — her model IS on the phone', badge('pk_alba') === true)
check('Lola (es) wears NO badge — the Spanish model was never downloaded', badge('pk_lola') === false,
  `badge=${badge('pk_lola')} — the card claims a 179 MB model the phone does not hold`)

pocket.set({ active: 'es' })
check('flipped: Lola (es) still wears no badge', badge('pk_lola') === false)
check('flipped: Alba (en) KEEPS her badge — her model is still on the phone', badge('pk_alba') === true,
  `badge=${badge('pk_alba')} — the downloaded English model lost its claim when the store's active language moved`)

console.log(`\ncure-waveD-voice-badge probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
