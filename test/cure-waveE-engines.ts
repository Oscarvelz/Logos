// Cure probes for Round 4 Track 4 (Friend Wave E):
//   R4-T4-1 — the failure-eviction guard arms only on evictions the
//             bucket confirms; a failed eviction stays retryable and
//             the function reports the truth.
//   R4-T4-2 — the failure doors evict only when the failure implicates
//             the bytes (phononEvictForFailure's four-row table,
//             proven against a real fake bucket at the seam both doors
//             act through; failStaleLoad/phononEnsure wiring is
//             verified by reading, as the WASM loader cannot run here).
//   R4-T4-3 — the price of the counters' truth is paid once per
//             landscape, not once per refresh: the counters themselves
//             still measure the body in front of them on every direct
//             call (a truncated entry counts its real bytes even when
//             swapped in under the same URL and header — the standing
//             guards' contract), while Settings' door,
//             engine.modelCacheBytes, files the measured total under
//             the engine landscape (statuses + cached verdicts) and
//             re-measures only when the landscape changes.
// Run: cd ~/workspace/logos-work && node ~/workspace/vela-work/run-ts-test.mjs test/cure-waveE-engines.ts

// --- fake localStorage (pocket digest registry) ------------------------------
const lsMap = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (lsMap.has(k) ? lsMap.get(k)! : null),
  setItem: (k: string, v: string) => { lsMap.set(k, String(v)) },
  removeItem: (k: string) => { lsMap.delete(k) },
}

// --- fake Cache Storage: two buckets, body reads counted, failure modes ------
type Entry = { body: Uint8Array; hdr: number }
let phononEntries = new Map<string, Entry>()
let pocketEntries = new Map<string, Entry>()
let mode: 'ok' | 'openThrows' | 'deleteFails' = 'ok'
let failDeleteFor: string | null = null
let bodyReads = 0
const urlOf = (r: any) => (typeof r === 'string' ? r : r.url)
const makeCache = (seed: () => Map<string, Entry>) => ({
  keys: async () => [...seed().keys()].map((url) => ({ url })),
  match: async (r: any) => {
    const e = seed().get(urlOf(r))
    if (!e) return undefined
    return {
      headers: { get: (h: string) => (h === 'content-length' ? String(e.hdr) : null) },
      blob: async () => { bodyReads++; return { size: e.body.byteLength } },
      arrayBuffer: async () => { bodyReads++; return e.body.slice().buffer },
    }
  },
  delete: async (r: any) => {
    if (mode === 'deleteFails') return false // resolves, removes nothing
    if (failDeleteFor && urlOf(r).endsWith(failDeleteFor)) return false
    return seed().delete(urlOf(r))
  },
})
const phononCache = makeCache(() => phononEntries)
const pocketCache = makeCache(() => pocketEntries)
;(globalThis as any).caches = {
  open: async (name: string) => {
    if (mode === 'openThrows') throw new Error('SecurityError (stubbed: storage refused)')
    return name === 'pocket-tts-models-v2' ? pocketCache : phononCache
  },
  delete: async () => true,
}

// --- fake fetch: the pocket manifest road ------------------------------------
let manifest: any = null
;(globalThis as any).fetch = async () => {
  if (!manifest) throw new Error('offline (stubbed)')
  return { json: async () => manifest }
}

const { phononCached, phononCacheBytes, phononEvictAfterFailedLoad, phononEvictForFailure, phononDelete, phonon } =
  await import('../src/engine/phonon.ts')
const { pocketCached, pocketCacheBytes, pocketDelete, pocket } = await import('../src/engine/pocket.ts')
const { modelCacheBytes } = await import('../src/engine/engine.ts')
const { sha256Hex } = await import('../src/engine/pocket-assets.js')

const MODEL = 'https://huggingface.co/empyrealworks/Phonon-40M-multilingual/resolve/1191d231388bc97330225a2cece698c074eaa3ca/'
const SIZES: Record<string, number> = {
  'model.q8.gguf': 74_553_568,
  'tokenizer.json': 277_749,
  'config.json': 4_674,
  'default-voice.safetensors': 256_136,
}
const ALL = Object.keys(SIZES)
const PINNED_TOTAL = Object.values(SIZES).reduce((a, b) => a + b, 0)
let pass = 0, fail = 0
const check = (name: string, ok: boolean) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); ok ? pass++ : fail++ }
const garbage = (n: number) => new Uint8Array(n).fill(0x41)
const seedExactGarbage = () => {
  phononEntries = new Map()
  for (const [f, n] of Object.entries(SIZES)) phononEntries.set(MODEL + f, { body: garbage(n), hdr: n })
}
const resetPhonon = async () => { mode = 'ok'; failDeleteFor = null; await phononDelete(); seedExactGarbage() }

// ============================================================================
// R4-T4-1 — the guard arms on evidence, not intent.
// ============================================================================
// B': caches.open throws at eviction time — nothing was evicted, the
//     function says so, and the guard stays unarmed for the retry.
await resetPhonon()
mode = 'openThrows'
check('T4-1 B1: with caches.open throwing, the eviction reports FALSE (was: true)', (await phononEvictAfterFailedLoad(ALL)) === false)
mode = 'ok'
check('T4-1 B2: the entries all stand (nothing was evicted)', phononEntries.size === 4)
check('T4-1 B3: the retry DOES evict (the guard never armed)', (await phononEvictAfterFailedLoad(ALL)) === true)
check('T4-1 B4: and the bucket is empty after the retry', phononEntries.size === 0)

// C': delete() resolves but removes nothing — same shape, same verdict.
await resetPhonon()
mode = 'deleteFails'
check('T4-1 C1: with delete() failing, the eviction reports FALSE (was: true)', (await phononEvictAfterFailedLoad(ALL)) === false)
mode = 'ok'
check('T4-1 C2: the entries all stand', phononEntries.size === 4)
check('T4-1 C3: the retry evicts once deletes land', (await phononEvictAfterFailedLoad(ALL)) === true)
check('T4-1 C4: phononCached() no longer certifies the garbage', (await phononCached()) === false)

// D': a partial landing — one file's delete fails, three land. The
//     landed three are guarded; the failed one alone stays retryable.
await resetPhonon()
failDeleteFor = 'config.json'
check('T4-1 D1: a partial landing still reports an eviction', (await phononEvictAfterFailedLoad(ALL)) === true)
check('T4-1 D2: only the failed file remains in the bucket', phononEntries.size === 1 && phononEntries.has(MODEL + 'config.json'))
failDeleteFor = null
check('T4-1 D3: the retry takes the one unguarded file', (await phononEvictAfterFailedLoad(ALL)) === true)
check('T4-1 D4: the bucket is empty', phononEntries.size === 0)
check('T4-1 D5: and now the guard is fully armed (a third call evicts nothing)', (await phononEvictAfterFailedLoad(ALL)) === false)

// ============================================================================
// R4-T4-2 — eviction judges fault, not consumption (the doors' table).
// ============================================================================
// Rejected + service complete: the rejection was raised parsing the
// served bytes — the R3-T4-1 road, preserved.
await resetPhonon()
check('T4-2 A1: rejected-after-service evicts the consumed set', (await phononEvictForFailure(ALL, 'rejected', true)) === true)
check('T4-2 A2: the bucket is empty', phononEntries.size === 0)

// Rejected + service incomplete: the failure was raised before/outside
// parsing (a fetch, a cache read, the module compile) — bytes stand.
await resetPhonon()
check('T4-2 B1: rejected-during-service evicts nothing', (await phononEvictForFailure(ALL, 'rejected', false)) === false)
check('T4-2 B2: the entries stand', phononEntries.size === 4)

// Silent (watchdog) + service complete: the headline specimen — a load
// served whole from cache, then parsing in silence past the clock on a
// slow phone. The load dies; the healthy entries must NOT be evicted.
await resetPhonon()
check('T4-2 C1: silence-after-service evicts nothing', (await phononEvictForFailure(ALL, 'silent', true)) === false)
check('T4-2 C2: the healthy entries stand', phononEntries.size === 4)
// (1.4.195 re-scope: this leg used to assert the bucket still
// certifies the standing entries. Certification now judges content
// against the pinned digests, and this scenario's bodies are
// right-sized mock bytes — so the honest pin-world assertion is the
// refusal: the failure eviction spared them (C2), and the digest
// pass, not the failure machinery, is what denies them.)
check('T4-2 C3: certification judges content now — right-sized mock bytes do not certify (1.4.195)', (await phononCached()) === false)

// Silent + service incomplete: the load wedged while its files were
// still arriving — the consumed bytes stay implicated, as before.
await resetPhonon()
check('T4-2 D1: silence-mid-service still evicts the consumed set', (await phononEvictForFailure(ALL, 'silent', false)) === true)
check('T4-2 D2: the bucket is empty', phononEntries.size === 0)

// ============================================================================
// R4-T4-3 — the counters keep the truth; Settings' door stops re-paying it.
// ============================================================================
// The counters themselves, asked directly, measure the body in front of
// them on every call — including a body swapped in under the same URL
// and header (the standing guards' specimens, cure-waveD-pocket-keep's
// final leg among them).
phononEntries = new Map([
  [MODEL + 'model.q8.gguf', { body: garbage(7000), hdr: 7000 }],
  [MODEL + 'tokenizer.json', { body: garbage(1000), hdr: 1000 }],
])
bodyReads = 0
check('T4-3 P1: the phonon counter returns the true total (8000)', (await phononCacheBytes()) === 8000)
check('T4-3 P2: and measured both bodies to do it (the counter trusts no memory)', bodyReads === 2)
phononEntries = new Map([[MODEL + 'model.q8.gguf', { body: garbage(1000), hdr: SIZES['model.q8.gguf'] }]])
check('T4-3 P3: a truncated entry swapped under the same header counts its real 1000 bytes', (await phononCacheBytes()) === 1000)

const pkBody = new Uint8Array(2000).fill(17)
const pkSha = await sha256Hex(pkBody)
const pkKey = `model.onnx?v=${pkSha}`
manifest = { model: { file: 'model.onnx', sha256: pkSha, bytes: 2000 } }
pocketEntries = new Map([
  [pkKey, { body: pkBody, hdr: 2000 }],
  ['encoder.onnx?v=fixture', { body: garbage(3000), hdr: 3000 }],
])
await pocketDelete()
bodyReads = 0
check('T4-3 K1: the pocket counter returns the true total (5000)', (await pocketCacheBytes()) === 5000)
check('T4-3 K2: and measured both bodies to do it', bodyReads === 2)
pocketEntries = new Map([[pkKey, { body: garbage(10), hdr: 2000 }]])
check('T4-3 K3: a truncated entry swapped under the same URL and header counts its real 10 bytes', (await pocketCacheBytes()) === 10)
check('T4-3 K4: the certification probe still certifies nothing here (the swap is not a model)', (await pocketCached('en')) === false)

// Settings' door: the measured total is filed under the landscape.
// Buckets: phonon holds the one truncated gguf entry (1000), pocket
// holds the model key (10) — the honest total of what is stored: 1010.
bodyReads = 0
check('T4-3 S1: modelCacheBytes returns the measured total (1010)', (await modelCacheBytes()) === 1010)
check('T4-3 S2: the first asking measured both buckets (2 body reads)', bodyReads === 2)
bodyReads = 0
check('T4-3 S3: a routine refresh under the same landscape returns the same total', (await modelCacheBytes()) === 1010)
check('T4-3 S4: and reads NO bodies to do it (was: every body, every refresh)', bodyReads === 0)
// The landscape moves — an engine status changes, as a load, a failure
// or a Delete makes it do — and the next asking measures again.
pocket.set((s: any) => ({ langs: { ...s.langs, en: { ...s.langs.en, status: 'error' } } }))
bodyReads = 0
check('T4-3 S5: after a status change the total is re-measured (1010)', (await modelCacheBytes()) === 1010)
check('T4-3 S6: the re-measurement read the bodies again (2 reads)', bodyReads === 2)
pocket.set((s: any) => ({ langs: { ...s.langs, en: { ...s.langs.en, status: 'idle' } } }))
bodyReads = 0
check('T4-3 S7: the landscape moving back re-measures too', (await modelCacheBytes()) === 1010 && bodyReads === 2)
bodyReads = 0
check('T4-3 S8: and settles again (0 reads)', (await modelCacheBytes()) === 1010 && bodyReads === 0)
// The phonon side of the landscape: a phonon status change re-measures.
phonon.set((s: any) => ({ langs: { ...s.langs, es: { ...s.langs.es, status: 'loading' } } }))
bodyReads = 0
check('T4-3 S9: a phonon status change also re-measures', (await modelCacheBytes()) === 1010 && bodyReads === 2)
phonon.set((s: any) => ({ langs: { ...s.langs, es: { ...s.langs.es, status: 'idle' } } }))

console.log(`\n== cure-waveE-engines: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
