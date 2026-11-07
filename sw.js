// Logos service worker — offline app shell + cross-origin isolation headers.
// Adapted from BetterTTS by SysAdminDoc (MIT). Voice models are cached by
// pocket-tts-onnx itself (Cache Storage: pocket-tts-models-v2).
const CACHE_NAME = 'logos-shell-1794022834176'
const ORT_CACHE = 'logos-ort' // .wasm assets survive deploys: the 21 MB runtime is content-hashed and rarely changes
const SCOPE = new URL('./', self.location).href
const POCKET_META = 'logos-pocket-meta'

// credentialless keeps SharedArrayBuffer (multi-threaded WASM) available while
// still allowing CORS fetches from the Hugging Face CDN.
const COEP_VALUE = /Chrome\//.test(self.navigator.userAgent) ? 'credentialless' : 'require-corp'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll([SCOPE, `${SCOPE}manifest.webmanifest`, `${SCOPE}icon-192.png`, `${SCOPE}icon-512.png`].map((u) => new Request(u, { cache: 'reload' }))))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('logos-shell-') && k !== CACHE_NAME).map((k) => caches.delete(k)))),
    self.clients.claim(),
  ]))
})

function isolate(response) {
  if (!response || response.type === 'opaque' || response.status === 0) return response
  const headers = new Headers(response.headers)
  headers.set('Cross-Origin-Embedder-Policy', COEP_VALUE)
  headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

function cacheKey(request) {
  const url = new URL(request.url)
  url.search = ''
  url.hash = ''
  return url.toString()
}

// Share sheet (POST multipart): text goes on as ?title&text&url, files wait in a
// cache for the app to import as books.
const SHARE_CACHE = 'logos-share'
async function takeShare(request) {
  const back = (q) => Response.redirect(`${SCOPE}${q}`, 303)
  try {
    const form = await request.formData()
    const files = form.getAll('books').filter((f) => f && typeof f !== 'string' && f.size > 0)
    if (files.length) {
      const cache = await caches.open(SHARE_CACHE)
      const stamp = Date.now()
      await Promise.all(files.map((f, i) => cache.put(`${SCOPE}__share/${stamp}-${i}`, new Response(f, { headers: { 'content-type': f.type || 'application/octet-stream', 'x-name': encodeURIComponent(f.name || `book-${i + 1}`) } }))))
      return back(`?sharedfiles=${files.length}#/library`)
    }
    const q = new URLSearchParams()
    for (const k of ['title', 'text', 'url']) { const v = form.get(k); if (typeof v === 'string' && v.trim()) q.set(k, v) }
    return back(`?${q.toString()}`)
  } catch {
    return back('#/listen')
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method === 'POST' && new URL(req.url).pathname.endsWith('/share-target')) { event.respondWith(takeShare(req)); return }
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // PocketTTS model descriptions (manifest.json, assets.json — tokenizer and
  // voices): serve from the phone at once, refresh in the background. Without
  // this every app start waited on the network before the voice could load.
  if (url.hostname === 'huggingface.co' && url.pathname.includes('/pocket-tts-onnx/') && url.pathname.endsWith('.json')) {
    event.respondWith(caches.open(POCKET_META).then(async (cache) => {
      const hit = await cache.match(req.url)
      const refresh = fetch(req).then((res) => { if (res.ok) void cache.put(req.url, res.clone()); return res })
      if (hit) { refresh.catch(() => {}); return hit }
      return refresh
    }))
    return
  }
  if (url.origin !== self.location.origin || !req.url.startsWith(SCOPE) || req.url.startsWith(SCOPE + 'lab/')) return // lab pages are separate

  // Navigations (including share-target ?text=...) → network first, cached shell offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      // no-cache: always ask GitHub Pages (its 10-minute HTTP cache otherwise hands back the
      // previous index.html, and the app flips back to the old version on the next load).
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(SCOPE, copy)).catch(() => {}) }
          return isolate(res)
        })
        .catch(() => caches.match(SCOPE).then((hit) => isolate(hit) ?? Response.error())),
    )
    return
  }

  // Hashed assets are immutable: cache first. Everything else: network first.
  const immutable = url.pathname.includes('/assets/') || url.pathname.includes('/previews/')
  const key = cacheKey(req)
  if (immutable) {
    const bucket = url.pathname.endsWith('.wasm') ? ORT_CACHE : CACHE_NAME
    event.respondWith(
      caches.match(key).then((hit) => hit ? isolate(hit) : fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(bucket).then((c) => c.put(key, copy)).catch(() => {}) }
        return isolate(res)
      })),
    )
    return
  }
  event.respondWith(
    fetch(req.method === 'GET' ? new Request(req, { cache: 'no-cache' }) : req)
      .then((res) => {
        if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(key, copy)).catch(() => {}) }
        return isolate(res)
      })
      .catch(() => caches.match(key).then((hit) => isolate(hit) ?? Response.error())),
  )
})
