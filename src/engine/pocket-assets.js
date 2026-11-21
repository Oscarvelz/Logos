/**
 * Fetching the model, with progress, and keeping it between runs.
 *
 * The weights are the whole cost of this package, so the download is streamed
 * for a real progress bar and then parked wherever this environment keeps
 * things — the Cache API in a page, a directory under `~/.cache` in Node. A
 * second run pays no network at all.
 */
// Logos patch: the model downloads into one buffer and is cached from it,
// instead of chunks + joined copy + a third copy. On a phone the extra memory
// could make the cache write fail silently, so it downloaded on every launch.
// (Streaming the response into the cache failed for the 177 MB file in Chrome.)
const CACHE = "pocket-tts-models-v2";
async function openCache() { try { return await caches.open(CACHE); } catch { return null; } }
async function cacheGet(key) {
    const cache = await openCache();
    const hit = await cache?.match(key);
    if (!hit) return null;
    const size = Number(hit.headers.get("content-length") ?? 0);
    const buf = await hit.arrayBuffer();
    // A cache write interrupted by the app dying leaves a truncated body
    // under a truthful header — and in the Kokoro days (1.4.143–1.4.145)
    // the app died over and over, mid-write included. Serving those
    // bytes onward hands the runtime a broken model and the load kills
    // the app outright, every time (Oscar, 2026-11-12: Pocket "forces
    // the app to stop"; it worked before Kokoro). Refuse the entry:
    // drop it and report a miss, so the file downloads fresh and whole.
    if (size > 0 && buf.byteLength !== size) {
        try { await cache?.delete(key); } catch { /* nothing */ }
        return null;
    }
    return { size, bytes: () => Promise.resolve(buf) };
}
async function cacheClear() { try { await caches.delete(CACHE); } catch { /* nothing */ } }
async function readLocal() { return null; }
// One buffer, written once: the stock downloader kept the chunks, a joined copy
// and a third copy for the cache all alive at once (~530 MB for this model).
async function store(key, bytes) {
    try {
        const cache = await openCache();
        // No cache at all (storage blocked / unavailable) is a failed
        // save too, not a silent success (T4-11): the old optional-chain
        // put resolved to undefined and this returned true over nothing.
        if (!cache)
            return false;
        await cache.put(key, new Response(bytes, { headers: { "content-length": String(bytes.byteLength) } }));
        return true;
    }
    catch (e) {
        console.warn(`[logos] could not cache ${key}: ${e}`);
        return false;
    }
}
// A download that could not be saved is not a success (T4-11): both
// engines used to claim "ready" / "cached" when a quota-full phone had
// kept nothing, so the "works offline now" promise was flatly false and
// the model silently re-downloaded (or failed offline) next time. The
// save is part of what fetchAsset promises, so its failure fails the
// fetch: the error travels the load's existing error channel (the
// worker posts loadError; the page sets the error status and rejects
// the ensure waiters) instead of a ready with nothing behind it. A
// later load whose save succeeds certifies exactly as before.
async function storeOrThrow(key, bytes) {
    if (!(await store(key, bytes)))
        throw new Error("Could not save the downloaded voice model on this device — storage may be full. Nothing was kept, so it is not marked as downloaded.");
}
/**
 * The cache key for an asset: its digest, when the manifest gives one.
 *
 * Only the key carries the digest; the fetch itself uses the plain URL. Keyed
 * by digest rather than by URL, the same bytes published under two folders,
 * as `en/` and `he/` are, cost one download, and a changed model under the
 * same name simply misses. The Cache API wants a URL for a key, and compares
 * query strings but drops fragments, so the digest rides in `?v=` on the
 * file's name alone.
 */
const keyFor = (url, version) => version ? `${url.slice(url.lastIndexOf("/") + 1)}?v=${version}` : url;
// C-2 cure (T4-1): the digest in the key was only a label — nothing ever
// hashed a downloaded byte, so corrupt, substituted or captive-portal
// bytes were stored under the digest key and trusted forever. Now every
// asset whose `version` is a SHA-256 (the manifest's model and encoder
// entries — see pipeline.js, which passes manifest.*.sha256 as `version`)
// is hashed with crypto.subtle.digest after download and compared to
// that expected digest before it is stored or returned. The expected
// digest source is the `version` argument itself, which is also the
// digest carried in the asset's own cache key (`?v=<sha>`).
// Assets with no SHA-256 version (renikud.onnx: no version; espeak:
// "espeak-ng-1.0.2") carry no expected digest anywhere in the code, so
// there is nothing honest to compare them against — they flow exactly
// as before rather than gaining a fabricated check.
// H-17 cure (T4-2, remainder): the digest check above covers only the
// hashed assets (model/encoder). A download whose body ends short of
// its promised content-length is truncated whatever it is — an early
// clean close is indistinguishable from a finished file — so every
// asset, hashed or not (renikud.onnx, the espeak files), is refused
// when the delivered byte count falls SHORT of a known total, on the
// streaming path and the no-body fallback alike. Nothing short is
// stored, and nothing short is returned.
// R2-T4-3: the first shape of this check refused on any disagreement
// (delivered !== total) — but a body can also arrive COMPLETE and
// longer than the header: whenever a content-encoding is applied on
// the path, the header carries the wire (encoded) length while the
// decoded body stream delivers more, and the cure read that healthy
// download as a truncation and refused it forever. Over-long is not
// short: a stream that ran to its clean end delivered everything it
// had. Only falling short is a truncation, so only short is refused;
// the hashed assets keep their own stronger bar (the digest decides,
// not the header), and an unhashed asset's parser remains the judge
// of the bytes it is handed, exactly as for a header-less download.
function refuseIfShort(url, total, delivered) {
    if (total > 0 && delivered < total)
        throw new Error(`Truncated download fetching ${url}: content-length promised ${total} bytes, the body delivered ${delivered}. Refusing to use or cache these bytes.`);
}
const SHA256_HEX = /^[0-9a-f]{64}$/i;
// The pinned Pocket model digests (1.4.195, Oscar's delegated ruling):
// the upstream manifest's `sha256` fields are 16-hex PREFIXES, not full
// digests — so the C-2 machinery, fed the manifest's own value, could
// never verify a model byte in production (expectedSha256 returned
// null for a prefix, and the probe in pocket.ts compared a full hash
// against a prefix and could never certify). These full digests were
// measured on 2026-11-21 from the canonical upstream files themselves
// (thewh1teagle/pocket-tts-onnx), cross-checked against the manifest's
// prefixes and byte counts, which agree. They live HERE, in the
// shipped code — never in the travelling manifest. If upstream ever
// publishes a new model, the prefix stops matching, every door below
// fails closed, and a future release re-pins deliberately, the same
// way these were measured.
const PINNED_MODEL_SHA256 = [
    "010c6701d007277e6b37440b909de098200802fddbe70f74e890763b5dd43745", // en — 176,992,315 B
    "fd31ae98160932edb15c22e4a3539912a1010c691615fff0bc05c9135e18dd81", // es — 173,604,779 B
];
/** The pinned full digest a digest-shaped value names, when it is a
 *  prefix of (or equal to) one of the pinned models — null when the
 *  value is not digest-shaped or names no pinned model. Shared with
 *  pocket.ts, whose probe and load gate judge by the same pins. */
export function pinnedModelDigest(version) {
    const v = typeof version === "string" ? version.trim().toLowerCase() : "";
    if (!/^[0-9a-f]{8,64}$/.test(v))
        return null;
    return PINNED_MODEL_SHA256.find((p) => p.startsWith(v)) ?? null;
}
/** The pinned full digest a model download must hash to, when the
 *  manifest's prefix names one of the pinned models — null when the
 *  asset is not a pinned model at all. A model.onnx fetch whose prefix
 *  names NO pinned model is refused outright (fail closed): upstream
 *  moved, and this version of Logos does not follow it silently. */
export function pinnedModelSha256(url, version) {
    if (typeof url !== "string" || !url.endsWith("/model.onnx"))
        return null;
    const v = typeof version === "string" ? version.trim().toLowerCase() : "";
    if (!/^[0-9a-f]{8,64}$/.test(v))
        return null;
    const pin = pinnedModelDigest(v);
    if (pin)
        return pin;
    // Refuse here only the values the pin can judge: a well-formed
    // full digest, or a clean prefix-length one (the manifest's
    // grammar). A malformed shape (32–63 hex, a labelled digest) is
    // not the pin's to judge — it falls through to expectedSha256's
    // malformed-digest law, which refuses it just as loudly.
    if (SHA256_HEX.test(v) || /^[0-9a-f]{8,31}$/.test(v))
        throw new Error(`The voice model offered at ${url} is not the model this version of Logos is pinned to (digest ${version}). Refusing to download or trust these bytes.`);
    return null;
}
export function expectedSha256(version, url) {
    const v = typeof version === "string" ? version.trim().toLowerCase() : "";
    // For a model.onnx fetch the PIN judges first: even a full-length
    // digest is only ever the pinned one — anything else is refused
    // inside pinnedModelSha256, never merely compared against itself.
    const pinned = pinnedModelSha256(url, version);
    if (pinned)
        return pinned;
    if (SHA256_HEX.test(v))
        return v;
    // R2-T4-4: a version that PRESENTS as a digest — it carries a
    // sha256 label, or it is a long run of pure hex — but is not
    // exactly 64 hex chars is a MALFORMED digest, and it used to fall
    // into the same null as "no digest exists", silently switching
    // verification OFF while the bytes were filed under the
    // digest-shaped key: Round-1's C-2 state, re-entered by a parsing
    // edge. That is precisely the moment verification matters most
    // (an upstream format change), so it fails CLOSED — a loud load
    // error, never a silent downgrade to unverified. A version that
    // was never a digest at all (a release label like
    // "espeak-ng-1.0.2", or no version) still returns null: there is
    // no expected digest anywhere to compare against, and inventing
    // one would be a fabrication, not a check.
    if (v.startsWith("sha256:") || /^[0-9a-f]{32,}$/.test(v))
        throw new Error(`Malformed SHA-256 digest "${version}": a digest was promised for this asset but does not parse as 64 hex characters, so its bytes cannot be verified. Refusing to download or trust them.`);
    return null;
}
export async function sha256Hex(data) {
    const digest = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function verifySha256(data, expected, url) {
    if (!expected)
        return;
    const actual = await sha256Hex(data);
    if (actual !== expected)
        throw new Error(`SHA-256 mismatch fetching ${url}: expected ${expected}, got ${actual}. Refusing to use or cache these bytes.`);
}
/** Whether this exact asset is already cached, without fetching it. */
export async function isCached(url, version) {
    return (await cacheGet(keyFor(url, version))) !== null;
}
/**
 * Fetch an asset, and keep it under a key that changes when it does.
 *
 * The URL alone is not a safe cache key: a new model published to the same
 * filename would be masked by the old one forever. The manifest carries a
 * digest per file, so that goes in the key and a changed model simply misses.
 */
export async function fetchAsset(url, onProgress, version) {
    // A local path is already on the disk it would be cached to.
    const local = await readLocal(url);
    if (local) {
        onProgress?.({ loaded: local.byteLength, total: local.byteLength, cached: true });
        return local;
    }
    const key = keyFor(url, version);
    const expected = expectedSha256(version, url);
    const hit = await cacheGet(key);
    if (hit) {
        // Say it is a cache hit before reading the body, not after. Waiting until
        // the bytes land would leave a caller claiming to be downloading for the
        // whole of it.
        onProgress?.({ loaded: 0, total: hit.size, cached: true });
        const bytes = await hit.bytes();
        if (!expected) {
            onProgress?.({ loaded: bytes.byteLength, total: bytes.byteLength, cached: true });
            return bytes;
        }
        // Read-time verification: download-time verification alone would
        // leave poison written before this cure (or corrupted in place)
        // trusted forever, because a cache hit never re-downloads. A
        // mismatch here evicts the entry and falls through to a fresh
        // download below; that download is itself verified, so a bad
        // network answer still fails honestly instead of re-poisoning.
        try {
            await verifySha256(bytes, expected, url);
            onProgress?.({ loaded: bytes.byteLength, total: bytes.byteLength, cached: true });
            return bytes;
        }
        catch {
            try {
                await (await openCache())?.delete(key);
            }
            catch { /* nothing */ }
        }
    }
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(`${response.status} fetching ${url}`);
    const total = Number(response.headers.get("content-length") ?? 0) || 0;
    const body = response.body;
    if (!body) {
        const buf = await response.arrayBuffer();
        refuseIfShort(url, total, buf.byteLength);
        await verifySha256(buf, expected, url);
        await storeOrThrow(key, buf);
        return buf;
    }
    let buffer = new Uint8Array(total || 1 << 20);
    let loaded = 0;
    const reader = body.getReader();
    for (;;) {
        const { done, value } = await reader.read();
        if (done)
            break;
        if (loaded + value.byteLength > buffer.length) {
            const grown = new Uint8Array(Math.max(buffer.length * 2, loaded + value.byteLength));
            grown.set(buffer.subarray(0, loaded));
            buffer = grown;
        }
        buffer.set(value, loaded);
        loaded += value.byteLength;
        onProgress?.({ loaded, total, cached: false });
    }
    const out = loaded === buffer.length ? buffer : buffer.slice(0, loaded);
    buffer = null;
    refuseIfShort(url, total, loaded);
    // Verify the exact bytes about to be stored and returned, before
    // either happens: on mismatch verifySha256 throws, nothing is
    // stored, and the load fails honestly to its caller.
    await verifySha256(out, expected, url);
    await storeOrThrow(key, out);
    return out.buffer;
}
export async function fetchJson(url) {
    const local = await readLocal(url);
    if (local)
        return JSON.parse(new TextDecoder().decode(local));
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(`${response.status} fetching ${url}`);
    return (await response.json());
}
/** Drop every cached model. */
export const clearAssetCache = cacheClear;
