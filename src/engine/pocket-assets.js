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
        await (await openCache())?.put(key, new Response(bytes, { headers: { "content-length": String(bytes.byteLength) } }));
        return true;
    }
    catch (e) {
        console.warn(`[logos] could not cache ${key}: ${e}`);
        return false;
    }
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
    const hit = await cacheGet(key);
    if (hit) {
        // Say it is a cache hit before reading the body, not after. Waiting until
        // the bytes land would leave a caller claiming to be downloading for the
        // whole of it.
        onProgress?.({ loaded: 0, total: hit.size, cached: true });
        const bytes = await hit.bytes();
        onProgress?.({ loaded: bytes.byteLength, total: bytes.byteLength, cached: true });
        return bytes;
    }
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(`${response.status} fetching ${url}`);
    const total = Number(response.headers.get("content-length") ?? 0);
    const body = response.body;
    if (!body) {
        const buf = await response.arrayBuffer();
        await store(key, buf);
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
    await store(key, out);
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
