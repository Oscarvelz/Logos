// Cure probes for R3-T4-1 (load-failure eviction) and the Phonon leg of
// R3-T4-3 (the byte counter measures the body). Run against the real
// phonon.ts with a fake Cache Storage:
//   node ~/workspace/vela-work/run-ts-test.mjs test/cure-waveD-phonon.ts
//
// R3-T4-1's honest shape: certification still measures size, not
// content (no true digests exist in-tree to pin — none invented), so
// leg A asserts the DECLARED bound — exact-size garbage still
// certifies at probe time. The cure is that the false certification is
// no longer permanent: the first load that fails on those entries
// evicts them through phononEvictAfterFailedLoad (the seam
// phononEnsure's catch and failStaleLoad act through — the WASM
// loader itself cannot run in this bench, so the wiring is verified
// by reading and the eviction effect is proven here).

type Entry = { body: Uint8Array; hdr: number | null }
let entries = new Map<string, Entry>()
const urlOf = (r: any) => (typeof r === 'string' ? r : r.url)
const fakeCache = {
  keys: async () => [...entries.keys()].map((url) => ({ url })),
  match: async (r: any) => {
    const e = entries.get(urlOf(r))
    if (!e) return undefined
    return new Response(e.body, e.hdr == null ? {} : { headers: { 'content-length': String(e.hdr) } })
  },
  delete: async (r: any) => entries.delete(urlOf(r)),
}
;(globalThis as any).caches = { open: async () => fakeCache, delete: async () => true }

const { phononCached, phononCacheBytes, phononEvictAfterFailedLoad, phononDelete } = await import('../src/engine/phonon.ts')

const MODEL = 'https://huggingface.co/empyrealworks/Phonon-40M-multilingual/resolve/1191d231388bc97330225a2cece698c074eaa3ca/'
const SIZES: Record<string, number> = {
  'model.q8.gguf': 74_553_568,
  'tokenizer.json': 277_749,
  'config.json': 4_674,
  'default-voice.safetensors': 256_136,
}
const ALL = Object.keys(SIZES)
let pass = 0, fail = 0
const check = (name: string, ok: boolean) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); ok ? pass++ : fail++ }
const garbage = (n: number) => new Uint8Array(n).fill(0x41)
const seedExactGarbage = () => {
  entries = new Map()
  for (const [f, n] of Object.entries(SIZES)) entries.set(MODEL + f, { body: garbage(n), hdr: n })
}

// A. DECLARED BOUND — the probe-time measurement is still size: the
//    garbage certifies until a load fails on it. (The digest road
//    that would close this leg needs the files' true SHA-256 values,
//    which exist nowhere in-tree; none was invented.)
seedExactGarbage()
check('A (declared bound): exact-size garbage still certifies at probe time', (await phononCached()) === true)

// B. THE CURE — a load that fails after consuming all four entries
//    from the cache evicts them; the bucket stops certifying and the
//    next load must download fresh.
check('B: the failure eviction fires for the consumed set', (await phononEvictAfterFailedLoad(ALL)) === true)
check('B: all four garbage entries are gone', entries.size === 0)
check('B: phononCached() === false after the eviction', (await phononCached()) === false)

// C. THE GUARD — the same failure again evicts nothing: a device that
//    cannot run the model never pays a re-download per attempt.
seedExactGarbage()
check('C: a repeat failure evicts nothing (per-file guard)', (await phononEvictAfterFailedLoad(ALL)) === false)
check('C: the entries stand until a load succeeds or Delete resets', entries.size === 4)

// D. R3-T4-3, Phonon leg — the counter measures the body: a truncated
//    entry under a truthful header counts its real 1000 bytes.
{
  entries = new Map()
  entries.set(MODEL + 'model.q8.gguf', { body: garbage(1000), hdr: SIZES['model.q8.gguf'] })
  check('D: phononCacheBytes counts the 1000-byte body, not the header', (await phononCacheBytes()) === 1000)
}

// E. Delete resets the guard: after phononDelete, a later failed load
//    may evict again.
await phononDelete()
seedExactGarbage()
check('E: after Delete the failure eviction is armed again', (await phononEvictAfterFailedLoad(ALL)) === true)
check('E: and the garbage is gone again', entries.size === 0)

console.log(`\n== cure-waveD-phonon: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
