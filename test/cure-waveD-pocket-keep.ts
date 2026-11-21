// Cure probes for R3-T4-2 (keep.ts's silent stamp corner) and the
// Pocket leg of R3-T4-3 (the byte counter measures the body). Same
// specimen state as the hunt probe r3-t4-keep-stamp.ts: the digest
// registry write is blocked (localStorage setItem throws for
// 'logos.pocketDigests' only) while Cache Storage works — the primary
// probe certifies from the manifest, and before the cure
// pocketModelDigest stayed null, so stamp() skipped the stamp in
// silence: no stamp, no note, the eviction watch never armed.
// The cure: pocket.ts keeps the digest the probe itself used in a
// session memory that outranks the stored registry, so the stamp is
// written, bound to that digest — the outcome is spoken, never silent.
// Run: node ~/workspace/vela-work/run-ts-test.mjs test/cure-waveD-pocket-keep.ts
//
// 1.4.195 RE-SCOPE (the pin): the probe's digest is now the FULL
// pinned model digest, learned from the manifest's 16-hex prefix.
// This probe's subject is the memory-vs-registry discipline, so its
// legs assert the RECORD: the probe records the pin, the session
// memory carries it despite the blocked registry write, and that is
// the digest keep.ts' stamps bind (stampDigest reads
// pocketModelDigest). The stamp's writing itself needs a certified
// body, which a mock body cannot be under the pin — that full chain
// (real body → certification → stamp) is proven by the real-file
// bench recorded in NOTES 1.4.195. The byte-counter leg is unchanged.

// --- fake localStorage with a selective write block -------------------------
const lsMap = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (lsMap.has(k) ? lsMap.get(k)! : null),
  setItem: (k: string, v: string) => {
    if (k === 'logos.pocketDigests') throw new Error('QuotaExceededError (stubbed)')
    lsMap.set(k, String(v))
  },
  removeItem: (k: string) => { lsMap.delete(k) },
}

// --- fake Cache Storage -------------------------------------------------------
type Entry = { body: Uint8Array; hdr: number }
let entries = new Map<string, Entry>()
const urlOf = (r: any) => (typeof r === 'string' ? r : r.url)
const fakeCache = {
  keys: async () => [...entries.keys()].map((url) => ({ url })),
  match: async (r: any) => {
    const e = entries.get(urlOf(r))
    return e ? new Response(e.body, { headers: { 'content-length': String(e.hdr) } }) : undefined
  },
  delete: async (r: any) => entries.delete(urlOf(r)),
}
;(globalThis as any).caches = { open: async () => fakeCache, delete: async () => true }

const body = new Uint8Array(2000).fill(23)
const { pinnedModelDigest } = await import('../src/engine/pocket-assets.js')
// The manifest speaks in the real upstream's grammar: a 16-hex prefix
// of the pinned English digest, with the pinned byte count.
const EN_PREFIX = '010c6701d007277e'
const sha = pinnedModelDigest(EN_PREFIX)!
entries = new Map([[`model.onnx?v=${EN_PREFIX}`, { body, hdr: 2000 }]])
;(globalThis as any).fetch = async () => ({ json: async () => ({ model: { file: 'model.onnx', sha256: EN_PREFIX, bytes: 176992315 } }) })

const { pocket, pocketCached, pocketCacheBytes, pocketModelDigest } = await import('../src/engine/pocket.ts')
const { startKeeping } = await import('../src/engine/keep.ts')

let pass = 0, fail = 0
const check = (name: string, ok: boolean) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); ok ? pass++ : fail++ }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const setPocketStatus = (status: string) =>
  pocket.set((s: any) => ({ langs: { ...s.langs, en: { ...s.langs.en, status } } }))

// The model certifies through the primary path, exactly as before.
await pocketCached('en')
// THE CURE, first half: the digest the probe itself used — now the
// full PIN, learned from the manifest's prefix — is known to the
// session even though its registry write was refused. (The probe's
// own verdict on this mock body is false: it is not the pinned
// model. The record fires before that judgment, by design — the
// record is the identity the probe verified the manifest against.)
check('cure: pocketModelDigest(en) is the probe\u2019s own digest despite the blocked registry write', pocketModelDigest('en') === sha)
check('cure: the registry really is empty (the memory, not storage, carries it)', lsMap.get('logos.pocketDigests') === undefined)

// THE CURE, second half (record level, 1.4.195 re-scope): keep.ts
// binds its stamps to pocketModelDigest — the value proven above —
// so the stamp, when a certified body lets it write, is bound to the
// pinned digest and never to a travelling prefix. The writing itself
// is proven with the real model body by the bench in NOTES 1.4.195.
startKeeping()
await sleep(100)
setPocketStatus('ready')
await sleep(7000) // stamp's 4 s wait + its probe
const kept = JSON.parse(lsMap.get('logos.kept') ?? '{}')
check('re-scope: no stamp is written for an uncertified body (the pin judges first)', kept['pocket.en'] === undefined)

// R3-T4-3, Pocket leg: the counter measures the body — a 10-byte body
// under a 2000 header counts 10.
{
  entries = new Map([[`model.onnx?v=${EN_PREFIX}`, { body: new Uint8Array(10).fill(1), hdr: 2000 }]])
  check('cure: pocketCacheBytes counts the 10-byte body, not the header', (await pocketCacheBytes()) === 10)
}

console.log(`\n== cure-waveD-pocket-keep: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
