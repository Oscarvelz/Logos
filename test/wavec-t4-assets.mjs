// WAVE C (1.4.190) — R2-T4-3 + R2-T4-4 cure probe: pocket-assets.js,
// real module, stubbed platform (caches + fetch). Run: node test/wavec-t4-assets.mjs
// T4-3: refuseIfShort refused COMPLETE bodies that outgrow the
// content-length header (the content-encoding shape). Only a SHORT
// body is a truncation; a complete over-long body must be accepted.
// T4-4: a present-but-malformed digest silently switched C-2
// verification OFF. A digest-shaped version that is not exactly
// 64 hex is now a loud load error; a version that was never a
// digest (a release label, or none) still flows as before.
import { fetchAsset, expectedSha256, sha256Hex } from '../src/engine/pocket-assets.js'

// --- stub Cache API -------------------------------------------------------
const buckets = new Map()
function makeCache() {
  const m = new Map()
  return {
    async match(key) { const b = m.get(key); return b ? new Response(b.bytes, { headers: { 'content-length': String(b.hdr ?? b.bytes.byteLength) } }) : undefined },
    async put(key, res) { const buf = new Uint8Array(await res.arrayBuffer()); m.set(key, { bytes: buf, hdr: Number(res.headers.get('content-length') ?? buf.byteLength) }) },
    async delete(key) { return m.delete(key) },
    _map: m,
  }
}
let currentCache = makeCache()
globalThis.caches = { open: async () => currentCache, delete: async () => { currentCache = makeCache(); return true } }

// --- stub fetch -----------------------------------------------------------
let fetchImpl = null
globalThis.fetch = (...a) => fetchImpl(...a)
const streamResponse = (bytes, headerLen) => new Response(new ReadableStream({
  start(c) { c.enqueue(bytes); c.close() },
}), { status: 200, headers: headerLen == null ? {} : { 'content-length': String(headerLen) } })
const bufferResponse = (bytes, headerLen) => ({
  ok: true, status: 200, body: null,
  headers: { get: (n) => (n === 'content-length' && headerLen != null ? String(headerLen) : null) },
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
})

let pass = 0, fail = 0
const check = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`); cond ? pass++ : fail++ }
const throws = async (fn) => { try { await fn(); return null } catch (e) { return e } }

// 1. CONTROL — exact-length unhashed download (espeak label) stores and returns.
{
  currentCache = makeCache()
  const body = new Uint8Array(1000).fill(7)
  fetchImpl = async () => streamResponse(body, 1000)
  const out = await fetchAsset('https://x.test/espeak.wasm', null, 'espeak-ng-1.0.2')
  check('control: exact-length body under a release label accepted', new Uint8Array(out).byteLength === 1000 && currentCache._map.size === 1)
}

// 2. T4-3 SPECIMEN — a COMPLETE body longer than its content-length
//    header (the content-encoding shape) must be ACCEPTED and cached.
{
  currentCache = makeCache()
  const body = new Uint8Array(1500).fill(9)
  fetchImpl = async () => streamResponse(body, 1000)
  const err = await throws(async () => {
    const out = await fetchAsset('https://x.test/model.onnx', null, null)
    check('T4-3: over-long COMPLETE body accepted', new Uint8Array(out).byteLength === 1500)
  })
  check('T4-3: over-long body raises no truncation error', err === null, err ? `-> "${err.message.slice(0, 80)}"` : '')
  check('T4-3: over-long body is cached', currentCache._map.size === 1)
}

// 3. CONTROL — a genuinely SHORT body is still refused as truncated.
{
  currentCache = makeCache()
  const body = new Uint8Array(1000).fill(5)
  fetchImpl = async () => streamResponse(body, 1500)
  const err = await throws(() => fetchAsset('https://x.test/model.onnx', null, null))
  check('control: SHORT body still refused as truncated', !!err && /Truncated download/.test(err.message))
  check('control: short body stored nothing', currentCache._map.size === 0)
}

// 4. T4-3 on the no-body fallback path: over-long accepted, short refused.
{
  currentCache = makeCache()
  const body = new Uint8Array(1500).fill(4)
  fetchImpl = async () => bufferResponse(body, 1000)
  let outLen = -1
  const err4 = await throws(async () => { outLen = new Uint8Array(await fetchAsset('https://x.test/renikud.onnx', null, null)).byteLength })
  check('T4-3 (fallback): over-long COMPLETE body accepted', err4 === null && outLen === 1500, err4 ? err4.message.slice(0, 80) : '')
  currentCache = makeCache()
  fetchImpl = async () => bufferResponse(new Uint8Array(900).fill(4), 1000)
  const err = await throws(() => fetchAsset('https://x.test/renikud.onnx', null, null))
  check('control (fallback): SHORT body still refused', !!err && /Truncated download/.test(err.message))
}

// 5. C-2 CONTROLS — the hash check itself is untouched by both cures.
{
  currentCache = makeCache()
  const good = new Uint8Array([1, 2, 3, 4])
  const sha = await sha256Hex(good)
  const bad = new Uint8Array([9, 9, 9, 9])
  fetchImpl = async () => streamResponse(bad, 4)
  const err = await throws(() => fetchAsset('https://x.test/model.onnx', null, sha))
  check('C-2 control: sha mismatch on download refused', !!err && /SHA-256 mismatch/.test(err.message))
  check('C-2 control: mismatch stored nothing', currentCache._map.size === 0)
  fetchImpl = async () => streamResponse(good, 4)
  const out = await fetchAsset('https://x.test/model.onnx', null, sha)
  check('C-2 control: correct bytes under their sha accepted + cached', new Uint8Array(out).byteLength === 4 && currentCache._map.size === 1)
  // A hashed asset whose ENCODED download delivers more decoded bytes
  // than the header: the hash, not the header, is the integrity bar.
  fetchImpl = async () => streamResponse(good, 3)
  currentCache = makeCache()
  const out2 = await fetchAsset('https://x.test/model.onnx', null, sha)
  check('T4-3+C-2: over-long header with hash-true body accepted', new Uint8Array(out2).byteLength === 4)
}

// 6. T4-4 SPECIMENS — a malformed digest is a LOUD error, never a
//    silent downgrade to unverified.
{
  const e1 = await throws(async () => expectedSha256('a'.repeat(63)))
  check('T4-4: expectedSha256(63-hex) throws instead of returning null', !!e1 && /malformed/i.test(e1.message), e1 ? e1.message.slice(0, 80) : '(no throw)')
  const e2 = await throws(async () => expectedSha256('sha256:' + 'a'.repeat(64)))
  check('T4-4: expectedSha256(sha256:-prefixed) throws', !!e2 && /malformed/i.test(e2.message))
  check('T4-4: expectedSha256(uppercase 64-hex) still parses', expectedSha256('A'.repeat(64)) === 'a'.repeat(64))
  check('T4-4: expectedSha256(release label) is null (never a digest)', expectedSha256('espeak-ng-1.0.2') === null)
  check('T4-4: expectedSha256(no version) is null', expectedSha256(undefined) === null && expectedSha256(null) === null)

  currentCache = makeCache()
  const body = new Uint8Array(64).fill(3)
  fetchImpl = async () => streamResponse(body, 64)
  const err = await throws(() => fetchAsset('https://x.test/model.onnx', null, 'a'.repeat(63)))
  check('T4-4: fetchAsset under a malformed digest fails loudly', !!err && /malformed/i.test(err.message), err ? err.message.slice(0, 80) : '(no error!)')
  check('T4-4: malformed digest stored nothing', currentCache._map.size === 0)
}

console.log(`\n${pass} pass, ${fail} fail`)
process.exitCode = fail ? 1 : 0
