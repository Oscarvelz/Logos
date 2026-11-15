/**
 * FENCE 0 — the isolation proof (FENCE-DESIGN §1; PLAN §0.2).
 *
 * Seeds the twelve real stores with known content and hashes, runs the two
 * damaging operation scripts (P1 the bubble clipboard-replace, P2 Library /
 * books delete-and-restore) against the sealed scenario sandbox, exits three
 * ways (natural end · ✕ mid-scene · simulated hard kill — teardown never
 * called), and asserts after every exit:
 *   · every real store byte-identical to its seed;
 *   · the guarded-write counter at 0, with exactly the design's two named
 *     exceptions — E-λ (the λ toggle pair, written through the real settings
 *     seam by the injected LambdaPort) and E-state (the presentation's own
 *     state key, tallied separately and leak-scanned);
 *   · the scenario gone from every backend it touched;
 *   · no scenario data in the backup export, a share payload, or the
 *     presentation's own state record (the leak scan, §1.5);
 *   · Cache Storage writes at 0 while a scenario plays (§1.6).
 *
 * Instrumentation (§1.3) sits on the seams themselves: a counting
 * localStorage shim, counting IndexedDB shims behind the same database/store
 * names the real tx()/run() helpers use, and a LogosAndroid bridge spy. Any
 * real write during a run is tallied the moment it happens and fails the run.
 *
 * Two honest limits, stated rather than hidden (cf. §1.7):
 *   · The isolated copy carries no node_modules, so the app's own modules
 *     (whose store.ts imports React) cannot execute in Node. The counters
 *     therefore guard the backends those modules write through — the exact
 *     seams of §1.3 — and the static scan below proves the scenario has no
 *     import path to the writers at all. The in-memory app stores (S2's
 *     drafts store, S12's nav pin) are modelled as harness-held snapshots,
 *     compared by deep equality.
 *   · E-λ × hard kill: §1.3's pair rule ("bubbleOn back at its seeded value"
 *     after every exit) only composes with §1.4's mid-point rule if the λ
 *     teaching beat completes BEFORE the P1 mid-point. The P1 script below
 *     is written that way deliberately — tap λ on, tap λ off, then the
 *     replacement — and the mid-point sits during the replacement, as
 *     specified.
 *
 * Run: node scripts/presentation/fence0.mjs   (Node ≥ 22, type-stripped TS)
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CLIP_TEXT,
  TEXT_EN,
  containsScenarioData,
  createRealReader,
  createScenario,
} from '../../src/lib/presentation/scenario/index.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCENARIO_DIR = join(HERE, '..', '..', 'src', 'lib', 'presentation', 'scenario')

const sha256 = (data) => createHash('sha256').update(data).digest('hex')
const textKey = (t) => `${t.length}:${t.slice(0, 48)}:${t.slice(-48)}`

// ── Counting localStorage shim (§1.3, seam 1) ──────────────────────────────
function createLocalStorageShim() {
  const map = new Map()
  const counts = new Map()
  let armed = false
  const tally = (key, op) => {
    if (!armed) return
    const c = counts.get(key) ?? { set: 0, remove: 0 }
    c[op] += 1
    counts.set(key, c)
  }
  const api = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      tally(k, 'set')
      map.set(k, String(v))
    },
    removeItem: (k) => {
      tally(k, 'remove')
      map.delete(k)
    },
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
  }
  return {
    api,
    counts,
    arm: () => {
      armed = true
    },
    raw: (k) => (map.has(k) ? map.get(k) : null),
    entries: () => [...map.entries()],
  }
}

// ── Counting IndexedDB shim (§1.3, seam 2) ────────────────────────────────
// Implements exactly the surface the app's open()/tx()/run() helpers use
// (open + onupgradeneeded + createObjectStore().createIndex, transaction →
// objectStore → put/get/delete/getAll), and tallies readwrite transactions
// per database + store while armed.
function createIndexedDbShim() {
  const dbs = new Map() // name -> Map<store, Map<id, record>>
  const counts = new Map() // "db/store" -> readwrite transactions
  let armed = false
  const makeRequest = () => ({ result: undefined, error: null, onsuccess: null, onerror: null, onupgradeneeded: null })
  const succeed = (req, value) =>
    queueMicrotask(() => {
      req.result = value
      req.onsuccess?.()
    })
  class FakeObjectStore {
    constructor(records) {
      this.records = records
    }
    createIndex() {
      return {}
    }
    put(v) {
      const r = makeRequest()
      this.records.set(v.id, v)
      succeed(r, v.id)
      return r
    }
    get(id) {
      const r = makeRequest()
      succeed(r, this.records.get(id))
      return r
    }
    delete(id) {
      const r = makeRequest()
      this.records.delete(id)
      succeed(r, undefined)
      return r
    }
    getAll() {
      const r = makeRequest()
      succeed(r, [...this.records.values()])
      return r
    }
  }
  class FakeDb {
    constructor(name, stores) {
      this.name = name
      this.stores = stores
      this.objectStoreNames = { contains: (n) => stores.has(n) }
    }
    createObjectStore(name) {
      if (!this.stores.has(name)) this.stores.set(name, new Map())
      return new FakeObjectStore(this.stores.get(name))
    }
    transaction(store, mode) {
      if (armed && mode === 'readwrite') {
        const k = `${this.name}/${store}`
        counts.set(k, (counts.get(k) ?? 0) + 1)
      }
      if (!this.stores.has(store)) this.stores.set(store, new Map())
      const records = this.stores.get(store)
      return { objectStore: () => new FakeObjectStore(records) }
    }
  }
  const factory = {
    open(name) {
      const req = makeRequest()
      queueMicrotask(() => {
        const isNew = !dbs.has(name)
        if (isNew) dbs.set(name, new Map())
        req.result = new FakeDb(name, dbs.get(name))
        if (isNew) req.onupgradeneeded?.()
        req.onsuccess?.()
      })
      return req
    },
    deleteDatabase(name) {
      const req = makeRequest()
      dbs.delete(name)
      succeed(req, undefined)
      return req
    },
  }
  return {
    factory,
    counts,
    dbs,
    arm: () => {
      armed = true
    },
  }
}

// ── Bridge spy (§1.3, seam 3) + Cache Storage counter (§1.6) ──────────────
function createBridgeSpy() {
  const counts = new Map()
  const proxy = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (typeof prop !== 'string') return undefined
        return () => {
          counts.set(prop, (counts.get(prop) ?? 0) + 1)
          return undefined
        }
      },
    },
  )
  return { proxy, counts }
}

function createCachesCounter() {
  let writes = 0
  const cache = {
    put: async () => {
      writes += 1
    },
    delete: async () => {
      writes += 1
      return true
    },
    match: async () => undefined,
  }
  const api = {
    open: async () => cache,
    delete: async () => {
      writes += 1
      return true
    },
    has: async () => false,
    keys: async () => [],
  }
  return { api, writes: () => writes }
}

// ── The seeded real world (§1.1) ───────────────────────────────────────────
// Bank fiction about the USER's side — never scenario material.
const SEED_TS = 1762800000000
const SEED_SETTINGS = {
  theme: 'light',
  uiLang: 'es',
  listenSpeed: 1.25,
  exportSpeed: 1.1,
  defaultVoice: { en: 'pk_anna', es: 'pk_lola' },
  favorites: ['pk_alba', 'pk_lola', 'pk_anna'],
  langMode: 'auto',
  voiceOverride: null,
  format: 'wav',
  sentencePauseMs: 300,
  autoDownload: false,
  deviceFallback: true,
  bubbleOn: false,
  bubbleAuto: true,
  bubbleText: true,
  highlight: false,
  wordLeadMs: 120,
  readerScale: 1.15,
}
const SEED_DRAFT = 'Notas para la reunión del martes: hay que revisar el presupuesto antes de'
const SEED_MARK = {
  id: 'user-mark-1',
  at: SEED_TS,
  title: 'Notas para la reunión',
  sentence: 'hay que revisar el presupuesto',
  key: textKey(SEED_DRAFT),
  idx: 3,
}
const SEED_RESUME = { key: textKey(SEED_DRAFT), idx: 4, title: 'Notas para la reunión', at: SEED_TS }
const SEED_BUBBLE_RESUME = { text: SEED_DRAFT, idx: 2, title: 'Notas para la reunión' }
const SEED_PRONOUNCE = [
  { from: 'María', to: 'Mah-REE-ah' },
  { from: 'Nguyen', to: 'WIN' },
]
// `logos.kept` as the code actually keeps it (src/engine/keep.ts): model-cache
// keep stamps keyed `${engine}.${lang}` — NOT book decisions (FENCE-DESIGN
// §1.1 S10 corrected against code; book Keep/Only-once is BookMeta.temp, S4).
const SEED_KEPT = { 'phonon.en': SEED_TS, 'pocket.es': SEED_TS }

const SEED_CLIP_AUDIO = {
  id: 'user-clip-river-walk',
  title: 'River walk notes',
  text: 'The path along the river was empty this morning, and the herons were already fishing.',
  voice: 'pk_alba',
  lang: 'en',
  createdAt: SEED_TS,
  duration: 95,
  format: 'mp3',
  size: 16,
  kind: 'audio',
  pos: 47.5,
  playedAt: SEED_TS,
  blob: new Blob([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])], { type: 'audio/mpeg' }),
}
const SEED_CLIP_TEXT = {
  id: 'user-clip-read-later',
  title: 'Artículo para después',
  text: 'Un artículo guardado para escucharlo con calma la próxima semana.',
  voice: '',
  lang: 'es',
  createdAt: SEED_TS + 1000,
  duration: 60,
  format: '',
  size: 0,
  kind: 'text',
}
const SEED_BOOK_KEPT = {
  id: 'user-book-harbour-log',
  title: 'The Harbour Log (seeded)',
  author: 'A. Keeper',
  format: 'epub',
  lang: 'en',
  addedAt: SEED_TS,
  openedAt: SEED_TS,
  pos: { ch: 2, b: 5 },
  progress: 0.43,
  words: 1200,
  chWords: [400, 400, 400],
  toc: [
    { title: 'One', level: 1, ch: 0, b: 0 },
    { title: 'Two', level: 1, ch: 1, b: 0 },
    { title: 'Three', level: 1, ch: 2, b: 0 },
  ],
  links: 0,
  temp: false, // the Keep decision, where the code actually keeps it
  size: 2048,
  bookmarks: [
    { ch: 0, b: 3, at: SEED_TS, text: 'first seeded bookmark' },
    { ch: 2, b: 1, at: SEED_TS, text: 'second seeded bookmark' },
  ],
}
const SEED_BOOK_ONCE = {
  ...SEED_BOOK_KEPT,
  id: 'user-book-once-article',
  title: 'Once-only article (seeded)',
  progress: 0.1,
  pos: { ch: 0, b: 1 },
  temp: true, // the Only-once decision
  bookmarks: [],
}
const SEED_BOOK_CONTENT = {
  id: 'user-book-harbour-log',
  chapters: [
    { title: 'One', blocks: [{ k: 'p', t: 'Seeded chapter one of the harbour log.' }] },
    { title: 'Two', blocks: [{ k: 'p', t: 'Seeded chapter two, with weather.' }] },
    { title: 'Three', blocks: [{ k: 'p', t: 'Seeded chapter three, coming home.' }] },
  ],
}
const SEED_BOOK_ONCE_CONTENT = {
  id: 'user-book-once-article',
  chapters: [{ title: 'Article', blocks: [{ k: 'p', t: 'A seeded once-only article body.' }] }],
}

const reqDone = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
async function openDb(factory, name, upgrade) {
  const req = factory.open(name, 1)
  req.onupgradeneeded = () => upgrade?.(req.result)
  return reqDone(req)
}
async function idbPut(db, store, record) {
  return reqDone(db.transaction(store, 'readwrite').objectStore(store).put(record))
}
async function idbGetAll(db, store) {
  return reqDone(db.transaction(store, 'readonly').objectStore(store).getAll())
}

async function canonicalValue(v) {
  if (v instanceof Blob) {
    const buf = Buffer.from(await v.arrayBuffer())
    return { $blob: { size: v.size, sha256: sha256(buf) } }
  }
  if (Array.isArray(v)) {
    const out = []
    for (const item of v) out.push(await canonicalValue(item))
    return out
  }
  if (v !== null && typeof v === 'object') {
    const out = {}
    for (const k of Object.keys(v).sort()) out[k] = await canonicalValue(v[k])
    return out
  }
  return v
}
async function hashRecords(records) {
  const canon = []
  for (const r of [...records].sort((a, b) => String(a.id).localeCompare(String(b.id)))) canon.push(await canonicalValue(r))
  return sha256(JSON.stringify(canon))
}

const LS_SEED_KEYS = [
  'logos.settings.v1',
  'logos.lastText',
  'logos.marks.v1',
  'logos.resume.session',
  'logos.bubble.resume',
  'logos.pronounce.v1',
  'logos.kept',
  'logos.shelf',
]

async function seedRealWorld() {
  const ls = createLocalStorageShim()
  const idb = createIndexedDbShim()
  const bridge = createBridgeSpy()
  const caches = createCachesCounter()
  globalThis.localStorage = ls.api
  globalThis.indexedDB = idb.factory
  globalThis.window = { LogosAndroid: bridge.proxy }
  globalThis.LogosAndroid = bridge.proxy
  globalThis.caches = caches.api

  ls.api.setItem('logos.settings.v1', JSON.stringify(SEED_SETTINGS)) // S1
  ls.api.setItem('logos.lastText', SEED_DRAFT) // S2 (persisted half)
  ls.api.setItem('logos.marks.v1', JSON.stringify([SEED_MARK])) // S6
  ls.api.setItem('logos.resume.session', JSON.stringify(SEED_RESUME)) // S7
  ls.api.setItem('logos.bubble.resume', JSON.stringify(SEED_BUBBLE_RESUME)) // S8
  ls.api.setItem('logos.pronounce.v1', JSON.stringify(SEED_PRONOUNCE)) // S9
  ls.api.setItem('logos.kept', JSON.stringify(SEED_KEPT)) // S10 (engine stamps, per code)
  ls.api.setItem('logos.shelf', 'books') // S11

  const logosDb = await openDb(idb.factory, 'logos', (db) => {
    if (!db.objectStoreNames.contains('clips')) db.createObjectStore('clips', { keyPath: 'id' }).createIndex('createdAt', 'createdAt')
  })
  await idbPut(logosDb, 'clips', SEED_CLIP_AUDIO) // S3
  await idbPut(logosDb, 'clips', SEED_CLIP_TEXT)
  const booksDb = await openDb(idb.factory, 'logos-books', (db) => {
    if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' })
    if (!db.objectStoreNames.contains('content')) db.createObjectStore('content', { keyPath: 'id' })
  })
  await idbPut(booksDb, 'books', SEED_BOOK_KEPT) // S4 — kept book (temp:false)
  await idbPut(booksDb, 'books', SEED_BOOK_ONCE) // S4 — once-only book (temp:true)
  await idbPut(booksDb, 'content', SEED_BOOK_CONTENT) // S5
  await idbPut(booksDb, 'content', SEED_BOOK_ONCE_CONTENT)

  // In-memory app stores, modelled as harness-held snapshots (§1.1 S2/S12):
  const draftsModel = { listen: SEED_DRAFT, create: 'Borrador de audio: capítulo tres, escena del puerto…', sharedAt: 0 }
  const navPinModel = { pinned: true } // S12

  const world = {
    ls,
    idb,
    bridge,
    caches,
    logosDb,
    booksDb,
    draftsModel,
    navPinModel,
    stateWrites: 0,
    seedRaw: Object.fromEntries(LS_SEED_KEYS.map((k) => [k, ls.raw(k)])),
    seedDrafts: structuredClone(draftsModel),
    seedNavPin: structuredClone(navPinModel),
    seedHashes: {},
  }
  world.seedHashes.clips = await hashRecords(await idbGetAll(logosDb, 'clips'))
  world.seedHashes.books = await hashRecords(await idbGetAll(booksDb, 'books'))
  world.seedHashes.content = await hashRecords(await idbGetAll(booksDb, 'content'))
  ls.arm()
  idb.arm()
  return world
}

// ── The two named exceptions (§1.3) ────────────────────────────────────────
/** E-λ: the λ toggle, written through the real settings seam — the same
 *  parse/patch/stringify the settings save path performs, one write per flip. */
function makeLambdaPort(world) {
  return {
    getBubbleOn: () => JSON.parse(world.ls.raw('logos.settings.v1')).bubbleOn === true,
    setBubbleOn: (on) => {
      const obj = JSON.parse(world.ls.raw('logos.settings.v1'))
      obj.bubbleOn = on
      world.ls.api.setItem('logos.settings.v1', JSON.stringify(obj))
    },
  }
}

/** E-state: the presentation writing its own bookkeeping, in its own key. */
function writePresentationState(world, record) {
  world.stateWrites += 1
  world.ls.api.setItem('logos.presentation.state.v1', JSON.stringify(record))
}

function readerFromSeeds() {
  return createRealReader({
    settings: SEED_SETTINGS,
    draftListen: SEED_DRAFT,
    clipIds: [SEED_CLIP_AUDIO.id, SEED_CLIP_TEXT.id],
    bookIds: [SEED_BOOK_KEPT.id, SEED_BOOK_ONCE.id],
    markIds: [SEED_MARK.id],
    pronounce: SEED_PRONOUNCE,
  })
}

// ── The damaging pair (§1.2), as operation scripts against the sandbox ────
const P1 = { name: 'P1', module: 'Q2' }
const P2 = { name: 'P2', module: 'AD6' }

/** P1 · the bubble clipboard-replace. A scenario reading is playing; a copied
 *  text replaces it; Undo is taken; the copied text ends and the interrupted
 *  reading resumes itself; a mark is dropped; the copied text is saved. */
async function runP1(world, scenario, exit) {
  const obs = (world.obs = {})
  const s = scenario.stage
  s.playText(TEXT_EN.id)
  writePresentationState(world, { module: 'Q2', state: 'in-progress', step: 3, skips: [] })
  s.advance()
  s.advance()
  assert.equal(s.session().idx, 2)
  assert.equal(s.session().playing, true)
  // E-λ teaching beat — tap the λ on, tap it off — completed before the
  // mid-point (see the header note on E-λ × hard kill).
  s.setLambda(true)
  assert.equal(s.lambdaOn(), true)
  assert.equal(JSON.parse(world.ls.raw('logos.settings.v1')).bubbleOn, true)
  s.setLambda(false)
  assert.equal(s.lambdaOn(), false)
  // The replacement. The declared mid-point sits during it (§1.4).
  const rep = s.playClipboardText(CLIP_TEXT.text)
  assert.equal(rep.undoAvailable, true)
  assert.equal(s.session().text, CLIP_TEXT.text)
  if (exit !== 'natural') return
  // Undo: restores the previous draft and loads it PAUSED — the real Undo in
  // bubble.ts contains no play() call (PLAN §2.6, bench item 1), so the
  // scenario promises exactly what the code does, no more.
  assert.equal(s.undoReplace(), true)
  obs.undoPaused = s.session().playing === false && s.session().text === TEXT_EN.text
  assert.equal(obs.undoPaused, true)
  // The lesson goes on: hear the reading again, then copy once more.
  s.playText(TEXT_EN.id)
  s.advance()
  s.advance()
  const rep2 = s.playClipboardText(CLIP_TEXT.text)
  assert.equal(rep2.undoAvailable, true)
  const mark = s.markHere()
  assert.ok(mark && mark.id.startsWith('scenario:'))
  const saved = await s.saveCurrentToLibrary()
  assert.ok(saved && saved.id.startsWith('scenario:'))
  // The copied text ends — the interrupted reading resumes itself, in place.
  const fin = s.finishCurrent()
  assert.equal(fin.resumed, true)
  obs.resumedText = s.session().text
  obs.resumedIdx = s.session().idx
  assert.equal(obs.resumedText, TEXT_EN.text)
  assert.equal(obs.resumedIdx, 2)
  assert.equal(s.session().playing, true)
}

/** P2 · Library / books delete-and-restore. Delete + Undo; delete for good;
 *  the fiction mini-book imported, opened, bookmarked, deleted, restored; a
 *  bulk selection deleting everything left at once. */
async function runP2(world, scenario, exit) {
  const { meta, content } = scenario.fictionBook
  await scenario.books.importBook(meta, content)
  writePresentationState(world, { module: 'AD6', state: 'in-progress', step: 2, skips: [] })
  const opened = await scenario.books.openBook(meta.id, { ch: 0, b: 2 })
  assert.deepEqual(opened.pos, { ch: 0, b: 2 })
  const marked = await scenario.books.addBookmark(meta.id, { ch: 1, b: 1, text: 'the lamp was already lit' })
  assert.equal(marked.bookmarks.length, 1)
  // First delete. The declared mid-point sits right after it (§1.4).
  const goneClip = await scenario.library.deleteClip('scenario:clip-welcome')
  assert.ok(goneClip)
  assert.equal(await scenario.library.getClip('scenario:clip-welcome'), null)
  if (exit !== 'natural') return
  await scenario.library.restoreClip(goneClip)
  assert.ok(await scenario.library.getClip('scenario:clip-welcome'))
  // A clip deleted and NOT restored.
  await scenario.library.deleteClip('scenario:clip-poem-audio')
  assert.equal(await scenario.library.getClip('scenario:clip-poem-audio'), null)
  // The book: deleted whole, restored whole — its bookmark intact.
  const goneBook = await scenario.books.deleteBook(meta.id)
  assert.ok(goneBook)
  assert.equal(goneBook.meta.bookmarks.length, 1)
  assert.equal(await scenario.books.getBook(meta.id), null)
  await scenario.books.restoreBook(goneBook.meta, goneBook.content)
  const back = await scenario.books.getBook(meta.id)
  assert.equal(back.bookmarks.length, 1)
  // Bulk delete: everything left on the scenario shelf, at once.
  const rest = await scenario.library.listClips()
  assert.ok(rest.length >= 2)
  const goneBulk = await scenario.library.deleteClips(rest.map((c) => c.id))
  assert.equal(goneBulk.length, rest.length)
  assert.deepEqual(await scenario.library.listClips(), [])
}

/** The backup export the app would produce from the real stores (backup.ts's
 *  shape), rebuilt here so the leak scan can face it. */
async function buildBackupPayload(world) {
  const contents = await idbGetAll(world.booksDb, 'content')
  const books = []
  for (const meta of await idbGetAll(world.booksDb, 'books')) {
    books.push({ meta, content: contents.find((c) => c.id === meta.id) ?? null })
  }
  return {
    app: 'logos',
    version: 1,
    at: SEED_TS,
    settings: JSON.parse(world.ls.raw('logos.settings.v1')),
    pronounce: JSON.parse(world.ls.raw('logos.pronounce.v1')),
    marks: JSON.parse(world.ls.raw('logos.marks.v1')),
    drafts: { listen: world.ls.raw('logos.lastText') },
    books,
  }
}

/** Every post-exit assertion of §1.4, run from the real side. */
async function assertRealUntouched(world, script, exit) {
  const label = `${script.name}/${exit}`
  // Byte-identity, store by store (S1–S11).
  for (const k of LS_SEED_KEYS) {
    assert.equal(world.ls.raw(k), world.seedRaw[k], `${label}: real store ${k} changed`)
  }
  // S1 also under the E-λ rule in the design's own terms: whole-object value
  // equality, with bubbleOn back at its seeded value.
  assert.deepEqual(JSON.parse(world.ls.raw('logos.settings.v1')), SEED_SETTINGS, `${label}: S1 settings object differs`)
  assert.equal(JSON.parse(world.ls.raw('logos.settings.v1')).bubbleOn, false, `${label}: bubbleOn not restored`)
  assert.equal(await hashRecords(await idbGetAll(world.logosDb, 'clips')), world.seedHashes.clips, `${label}: S3 clips changed`)
  assert.equal(await hashRecords(await idbGetAll(world.booksDb, 'books')), world.seedHashes.books, `${label}: S4 books changed`)
  assert.equal(await hashRecords(await idbGetAll(world.booksDb, 'content')), world.seedHashes.content, `${label}: S5 book contents changed`)
  // In-memory snapshots (S2's drafts store, S12's nav pin).
  assert.deepEqual(world.draftsModel, world.seedDrafts, `${label}: in-memory drafts changed`)
  assert.deepEqual(world.navPinModel, world.seedNavPin, `${label}: nav pin changed`)
  // Guarded-write counters (§1.3): 0 everywhere, two named exceptions only.
  for (const [key, c] of world.ls.counts) {
    if (key === 'logos.presentation.state.v1') {
      assert.equal(c.set, world.stateWrites, `${label}: E-state tally mismatch`)
      assert.equal(c.remove, 0, `${label}: E-state removals`)
    } else if (key === 'logos.settings.v1' && script.name === 'P1') {
      assert.equal(c.set, 2, `${label}: E-λ must be exactly the toggle pair, saw ${c.set}`)
      assert.equal(c.remove, 0, `${label}: E-λ removals`)
    } else {
      assert.equal(c.set + c.remove, 0, `${label}: real write to ${key} while a scenario ran`)
    }
  }
  if (script.name !== 'P1') {
    assert.equal(world.ls.counts.has('logos.settings.v1'), false, `${label}: settings written outside P1's E-λ`)
  }
  for (const [k, n] of world.idb.counts) assert.equal(n, 0, `${label}: IndexedDB readwrite transaction on ${k}`)
  assert.equal(world.bridge.counts.size, 0, `${label}: shell bridge called during a scenario`)
  assert.equal(world.caches.writes(), 0, `${label}: Cache Storage written during a scenario (§1.6)`)
  // The write perimeter's canaries: never seeded, never to appear.
  assert.equal(world.ls.raw('logos.stage.journal'), null, `${label}: stage journal appeared`)
  assert.equal(world.ls.raw('logos.bubble.lastClip'), null, `${label}: real bubble lastClip appeared`)
  // The scenario's databases never existed in the real factory — the hard
  // kill's whole proof (nothing was ever written, so nothing needs cleaning).
  assert.deepEqual([...world.idb.dbs.keys()].sort(), ['logos', 'logos-books'], `${label}: foreign database in the real factory`)
  // From the other direction: no scenario trace in any real backend.
  for (const [k, v] of world.ls.entries()) {
    if (k === 'logos.presentation.state.v1') continue
    assert.equal(v.includes('scenario:'), false, `${label}: scenario id leaked into ${k}`)
  }
  for (const rec of await idbGetAll(world.logosDb, 'clips')) {
    assert.equal(String(rec.id).startsWith('scenario:'), false, `${label}: scenario clip in the real Library`)
  }
  for (const rec of await idbGetAll(world.booksDb, 'books')) {
    assert.equal(String(rec.id).startsWith('scenario:'), false, `${label}: scenario book on the real shelf`)
  }
  // The leak scan (§1.5), over every payload shape the run composes.
  assert.equal(containsScenarioData(await buildBackupPayload(world)), false, `${label}: scenario data in the backup payload`)
  assert.equal(
    containsScenarioData(JSON.parse(world.ls.raw('logos.presentation.state.v1'))),
    false,
    `${label}: scenario data in the presentation state record`,
  )
  assert.equal(containsScenarioData({ title: 'Notas para la reunión', text: SEED_DRAFT }), false, `${label}: leak scan false-positive on a real share payload`)
}

/** One full Fence 0 case: seed → arm → run one script → exit one way → prove. */
async function runCase(script, exit) {
  const world = await seedRealWorld()
  const scenario = createScenario({ lambdaPort: makeLambdaPort(world), real: readerFromSeeds() })
  writePresentationState(world, { module: script.module, state: 'in-progress', step: 0, skips: [] })
  if (script.name === 'P1') await runP1(world, scenario, exit)
  else await runP2(world, scenario, exit)
  // The stage is fiction (§1.4) — checked while the stage still stands.
  const fic = await scenario.fictionCheck()
  assert.equal(fic.ok, true, `${script.name}/${exit}: stage holds foreign material: ${fic.foreign.join(', ')}`)
  if (exit === 'natural' || exit === 'close') {
    // The player's teardown — the same path for a finished module, a ✕
    // mid-scene and an abort (§7 clause 7).
    scenario.teardown()
    assert.equal(await scenario.isGone(), true, `${script.name}/${exit}: scenario survives its teardown`)
    assert.equal(scenario.backendInfo().kvSize, 0, `${script.name}/${exit}: scenario kv not empty`)
    assert.deepEqual(scenario.backendInfo().databases, [], `${script.name}/${exit}: scenario databases not dropped`)
  }
  // Hard kill: teardown is never called and the reference is dropped here;
  // assertRealUntouched proves from the real side that there was never
  // anything to clean up.
  await assertRealUntouched(world, script, exit)
  return world
}

// ── Tests ──────────────────────────────────────────────────────────────────
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

describe('Fence 0 — sealing by construction (static scan)', () => {
  const files = readdirSync(SCENARIO_DIR).filter((f) => f.endsWith('.ts'))

  test('scenario sources import only their siblings', () => {
    assert.ok(files.length >= 6, 'scenario folder unexpectedly small')
    for (const f of files) {
      const src = stripComments(readFileSync(join(SCENARIO_DIR, f), 'utf8'))
      for (const m of src.matchAll(/from\s+'([^']+)'/g)) {
        assert.ok(m[1].startsWith('./'), `${f} imports outside the sandbox: ${m[1]}`)
        assert.ok(files.includes(m[1].slice(2)), `${f} imports a missing sibling: ${m[1]}`)
      }
    }
  })

  test('scenario sources name no storage global, bridge, DOM or network', () => {
    const banned = ['localStorage', 'indexedDB', 'LogosAndroid', 'window', 'document', 'navigator', 'fetch(', 'caches', 'XMLHttpRequest', 'WebSocket', 'globalThis']
    for (const f of files) {
      const src = stripComments(readFileSync(join(SCENARIO_DIR, f), 'utf8'))
      for (const b of banned) assert.equal(src.includes(b), false, `${f} names forbidden token ${b}`)
    }
  })

  test('every fiction id carries the scenario: prefix, and a fresh scenario is pure fiction', async () => {
    const scenario = createScenario()
    const ids = await scenario.allIds()
    assert.ok(ids.length >= 4)
    for (const id of ids) assert.ok(id.startsWith('scenario:'), `fiction id without prefix: ${id}`)
    const fic = await scenario.fictionCheck()
    assert.equal(fic.ok, true, `fresh scenario holds foreign ids: ${fic.foreign.join(', ')}`)
    scenario.teardown()
    assert.equal(await scenario.isGone(), true)
  })

  test('leak scan sees scenario data (positive control) and passes real data', () => {
    assert.equal(containsScenarioData({ note: TEXT_EN.text }), true)
    assert.equal(containsScenarioData({ id: 'scenario:clip-welcome' }), true)
    assert.equal(containsScenarioData({ settings: SEED_SETTINGS, draft: SEED_DRAFT }), false)
  })
})

describe('Fence 0 — P1 · the bubble clipboard-replace (the future Q2)', () => {
  for (const exit of ['natural', 'close', 'kill']) {
    test(`real stores byte-identical, counters at 0 — exit: ${exit}`, async () => {
      await runCase(P1, exit)
    })
  }
  test('the choreography itself: replace → Undo (paused, as the real code does) → return-to-interrupted', async () => {
    const world = await runCase(P1, 'natural')
    assert.equal(world.obs.undoPaused, true)
    assert.equal(world.obs.resumedText, TEXT_EN.text)
    assert.equal(world.obs.resumedIdx, 2)
  })
})

describe('Fence 0 — P2 · Library / books delete-and-restore (the future AD6/AD7)', () => {
  for (const exit of ['natural', 'close', 'kill']) {
    test(`real stores byte-identical, counters at 0 — exit: ${exit}`, async () => {
      await runCase(P2, exit)
    })
  }
})
