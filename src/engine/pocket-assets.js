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
// when the delivered byte count disagrees with a known total, on the
// streaming path and the no-body fallback alike. Nothing short is
// stored, and nothing short is returned.
function refuseIfShort(url, total, delivered) {
    if (total > 0 && delivered !== total)
        throw new Error(`Truncated download fetching ${url}: content-length promised ${total} bytes, the body delivered ${delivered}. Refusing to use or cache these bytes.`);
}
const SHA256_HEX = /^[0-9a-f]{64}$/i;
export function expectedSha256(version) {
    const v = typeof version === "string" ? version.trim().toLowerCase() : "";
    return SHA256_HEX.test(v) ? v : null;
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
    const expected = expectedSha256(version);
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
