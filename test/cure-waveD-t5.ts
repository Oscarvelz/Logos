// Cure probes for the R3-T5 breaks (+ the backup half of R3-T7-1),
// run against the real importBackup/exportBackup on the Wave B
// fake-IDB setup. Each leg asserts the CURED behavior — the hunt
// probes in round3/probes/ assert the breaks and must now fail.
//   T5-1 validateBook proves author (string) and refuses a raw cover
//   T5-2 coverB64/blobB64 decode only from data: URLs (covers image/*)
//   T5-3/T7-1 the pron merge key is (word, scope): cross-language lands
//   T5-4 duplicate ids in one file dedupe, last wins, counts = records
//   T5-5 marks counted by id: landed and evicted both told
//   T5-6 ExportReport counts clips in and clips skipped
//   T5-7 favorites withheld reason distinguishes ghosts from empty
//   T5-8 the verbatim carry lands __proto__ as inert data, never a prototype
// Run: node ~/workspace/vela-work/run-ts-test.mjs test/cure-waveD-t5.ts
import './waveB-lib-setup.ts'

const ls = (globalThis as any).localStorage as Storage
let pass = 0, fail = 0
const check = (name: string, ok: boolean, extra = '') => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) } }

// The node bench has no FileReader, so export's blobToB64 would
// reject for every blob and the T5-6 counts would measure the bench,
// not the app. Install a faithful one: a data URL of the real bytes.
;(globalThis as any).FileReader = class {
  result: string | null = null
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  readAsDataURL(b: Blob) {
    void b.arrayBuffer().then((buf) => {
      this.result = `data:${b.type};base64,${Buffer.from(buf).toString('base64')}`
      this.onload?.()
    }, () => this.onerror?.())
  }
}
// Record every fetch: a cured import never fetches a non-data URL.
const fetched: string[] = []
const realFetch = globalThis.fetch.bind(globalThis)
;(globalThis as any).fetch = (u: unknown, ...a: unknown[]) => { fetched.push(String(u)); return (realFetch as any)(u, ...a) }
// Capture the shared export file instead of delivering it.
let shared: File | null = null
;(globalThis as any).navigator.share = async (d: any) => { shared = d.files[0] }

const { importBackup, exportBackup, BackupImportError } = await import('../src/lib/backup.ts')
const { getBook, books } = await import('../src/lib/books.ts')
const { getClip, library, refreshLibrary } = await import('../src/lib/library.ts')
const { pronEntries, savePronEntries } = await import('../src/lib/pronounce.ts')
const { loadMarks } = await import('../src/lib/marks.ts')
const { settings } = await import('../src/lib/settings.ts')

const book = (id: string, title: string, metaExtra: Record<string, unknown> = {}) => ({
  meta: { id, title, format: 'text', lang: 'en', addedAt: 1000, progress: 0, words: 4, links: 0, size: 20, pos: { ch: 0, b: 0 }, chWords: [4], toc: [], ...metaExtra },
  content: { id, chapters: [{ title: 'One', blocks: [{ k: 'p', t: 'Four small words here.' }] }] },
})
const clip = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: 'A clip', text: 'Clip words here.', voice: 'pk_alba', lang: 'en', format: 'mp3', createdAt: 5, duration: 3, size: 10, kind: 'text', source: 'create', ...extra })
const fileOf = (obj: unknown) => new File([JSON.stringify(obj)], 'backup.json', { type: 'application/json' })
const base = { app: 'logos', version: 1, at: 1, pronounce: [], marks: [], clips: [], books: [] as unknown[] }
const throwsDamaged = async (f: File) => { try { await importBackup(f); return false } catch (e) { return e instanceof BackupImportError } }

// ── T5-1: author and cover are proven at the door ──
check('T5-1: an object author refuses the file at the door', await throwsDamaged(fileOf({ ...base, books: [book('bk-t51a', 'A', { author: { name: 'Ghost Writer' } })] })))
check('T5-1: zero writes — the refused book is not on the shelf', (await getBook('bk-t51a')) == null)
check('T5-1: a raw cover member refuses the file at the door', await throwsDamaged(fileOf({ ...base, books: [book('bk-t51b', 'B', { cover: { not: 'a blob' } })] })))
check('T5-1: zero writes — the cover-poisoned book is not on the shelf', (await getBook('bk-t51b')) == null)
const r51 = await importBackup(fileOf({ ...base, books: [book('bk-t51c', 'C', { author: 'A Real Author' })] }))
const stored51 = await getBook('bk-t51c')
check('T5-1 control: a string author restores and lands as a string', r51.books === 1 && (stored51 as any)?.author === 'A Real Author')

// ── T5-2: only data: URLs are decoded; a cover's payload must be an image ──
fetched.length = 0
const htmlB64 = 'data:text/html;base64,' + Buffer.from('<html><body>not a cover</body></html>').toString('base64')
const r52a = await importBackup(fileOf({ ...base, books: [book('bk-t52a', 'A', { coverB64: htmlB64 })] }))
const stored52a = await getBook('bk-t52a')
check('T5-2: the html-payload book still restores (decoration dropped, not a veto)', r52a.books === 1, JSON.stringify(r52a))
check('T5-2: no cover is stored for a text/html payload', (stored52a as any)?.cover === undefined)
check('T5-2: the html data URL was never fetched', !fetched.some((u) => u.includes('text/html')), JSON.stringify(fetched))
const r52b = await importBackup(fileOf({ ...base, books: [book('bk-t52b', 'B', { coverB64: 'https://example.invalid/cover.png' })] }))
const stored52b = await getBook('bk-t52b')
check('T5-2: an address in coverB64 is never fetched and never stored', r52b.books === 1 && (stored52b as any)?.cover === undefined && !fetched.some((u) => u.includes('example.invalid')), JSON.stringify(fetched))
const pngB64 = 'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64')
const r52c = await importBackup(fileOf({ ...base, books: [book('bk-t52c', 'C', { coverB64: pngB64 })] }))
const stored52c = await getBook('bk-t52c')
check('T5-2 control: a real image data URL still lands as the cover', r52c.books === 1 && (stored52c as any)?.cover instanceof Blob && ((stored52c as any).cover as Blob).type === 'image/png', `cover=${(stored52c as any)?.cover}`)
const wavB64 = 'data:audio/wav;base64,' + Buffer.from([0x52, 0x49, 0x46, 0x46]).toString('base64')
await importBackup(fileOf({ ...base, clips: [clip('clip-t52a', { blobB64: wavB64 })] }))
const clip52a = await getClip('clip-t52a')
check('T5-2 control: a data: audio blobB64 still lands as the clip audio', clip52a?.blob instanceof Blob, `blob=${clip52a?.blob}`)
await importBackup(fileOf({ ...base, clips: [clip('clip-t52b', { blobB64: 'https://example.invalid/song.mp3' })] }))
const clip52b = await getClip('clip-t52b')
check('T5-2: an address in blobB64 lands the clip WITHOUT audio and is never fetched', clip52b != null && clip52b.blob === undefined && !fetched.some((u) => u.includes('example.invalid')), JSON.stringify(fetched))

// ── Shore-up: a raw blob member in a clip entry refuses the file ──
check('clip blob member: refused at the door (blobB64 is the only audio channel)', await throwsDamaged(fileOf({ ...base, clips: [clip('clip-rawblob', { blob: { not: 'a blob' } })] })))

// ── T5-3 + T7-1 (backup half): the pron merge key is (word, scope) ──
// Seeded through savePronEntries, not raw storage: pronEntries()
// caches, and the earlier legs' imports already warmed the cache —
// a raw setItem here would seed a dictionary the merge never sees.
savePronEntries([
  { from: 'pan', to: 'pahn', lang: 'en' },
  { from: 'sol', to: 'sohl' },
  { from: 'luna', to: 'loona', lang: 'es' },
])
const r53a = await importBackup(fileOf({ ...base, pronounce: [{ from: 'pan', to: 'pahn-es', lang: 'es' }] }))
const dict53 = pronEntries()
check('T5-3: the Spanish reading of "pan" LANDS beside the English one', r53a.pronAdded === 1 && r53a.pronKept === 0 && dict53.some((e) => e.from === 'pan' && e.lang === 'es' && e.to === 'pahn-es'), JSON.stringify({ r: r53a, dict: dict53 }))
const r53b = await importBackup(fileOf({ ...base, pronounce: [{ from: 'pan', to: 'otro', lang: 'en' }] }))
check('T5-3 control: a same-scope clash is still refused and counted', r53b.pronKept === 1 && r53b.pronAdded === 0, JSON.stringify(r53b))
const r53c = await importBackup(fileOf({ ...base, pronounce: [{ from: 'sol', to: 'sol-es', lang: 'es' }] }))
check('T5-3 control: an UNSCOPED phone entry still refuses a scoped file entry (it speaks both languages)', r53c.pronKept === 1 && r53c.pronAdded === 0, JSON.stringify(r53c))
const r53d = await importBackup(fileOf({ ...base, pronounce: [{ from: 'luna', to: 'loona' }] }))
check('T5-3 control: an unscoped file entry with the SAME reading as the phone’s is a duplicate, not a keep', r53d.pronKept === 0 && r53d.pronAdded === 0, JSON.stringify(r53d))

// ── T5-4: duplicate ids dedupe — last entry wins, counts are records ──
const r54 = await importBackup(fileOf({ ...base, books: [book('bk-dup2', 'First copy'), book('bk-dup2', 'Second copy')], clips: [clip('clip-dup2'), clip('clip-dup2')] }))
check('T5-4: the report counts 1 book for a duplicated id', r54.books === 1, JSON.stringify(r54))
check('T5-4: the shelf gained exactly 1 such book', books.get().list.filter((m) => m.id === 'bk-dup2').length === 1)
check('T5-4: the LAST entry is the one that landed', (await getBook('bk-dup2'))?.title === 'Second copy', (await getBook('bk-dup2'))?.title)
check('T5-4: the report counts 1 clip for a duplicated id', r54.clips === 1, JSON.stringify(r54))
check('T5-4: the Library gained exactly 1 such clip', library.get().clips.filter((c) => c.id === 'clip-dup2').length === 1)
const r54b = await importBackup(fileOf({ ...base, books: [book('bk-del2', 'Deleted twice')], deletedBooks: ['bk-del2', 'bk-del2'] }))
check('T5-4: a duplicated deleted id is skipped and counted ONCE', r54b.skippedDeleted === 1 && r54b.books === 0, JSON.stringify(r54b))

// ── T5-5: marks counted by id — landed and evicted both told ──
const seeded = Array.from({ length: 120 }, (_, i) => ({ id: `wseed-${i}`, at: 2_000_000 + i, idx: 0, title: 'Seed', sentence: 'Seed sentence.', key: 'k' }))
ls.setItem('logos.marks.v1', JSON.stringify(seeded))
const fileMarks = [0, 1, 2].map((i) => ({ id: `wfile-${i}`, at: 3_000_000 + i, idx: 0, title: 'File', sentence: 'File sentence.', key: 'k' }))
const r55 = await importBackup(fileOf({ ...base, marks: fileMarks }))
const after55 = loadMarks()
check('T5-5: the report counts the 3 file marks as LANDED', r55.marks === 3, `marks=${r55.marks}`)
check('T5-5: the report counts the 3 phone marks the cap evicted', r55.marksEvicted === 3, `evicted=${r55.marksEvicted}`)
check('T5-5: the store agrees — 3 file marks in, 117 seeded remain', fileMarks.every((m) => after55.some((x) => x.id === m.id)) && after55.filter((m) => m.id.startsWith('wseed-')).length === 117)

// ── T5-6: export counts clips in and clips skipped ──
await refreshLibrary()
const ghost = { id: 'clip-ghost2', title: 'Ghost clip', text: 'Words with no record.', voice: 'pk_alba', lang: 'en', format: '', createdAt: 7, duration: 0, size: 0, kind: 'text', source: 'listen' }
await new Promise<void>((resolve, reject) => {
  const req = (globalThis as any).indexedDB.open('logos', 2)
  req.onsuccess = () => {
    const db = req.result
    const tx = db.transaction(['clipmeta'], 'readwrite')
    tx.objectStore('clipmeta').put(ghost)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  }
  req.onerror = () => reject(req.error)
})
await refreshLibrary()
const rep56 = await exportBackup()
check('T5-6: the export report carries clip counts', typeof rep56.clips === 'number' && typeof rep56.clipsSkipped === 'number', JSON.stringify(rep56))
check('T5-6: the ghost clip is counted as skipped, exactly once', rep56.clipsSkipped === 1, JSON.stringify(rep56))
const parsed56 = JSON.parse(await shared!.text()) as { clips?: { id: string }[] }
check('T5-6: the exported file still lacks the ghost clip — but now the skip is told', !(parsed56.clips ?? []).some((c) => c.id === 'clip-ghost2'))

// ── T5-7: the withheld reason distinguishes ghosts from empty ──
const starsBefore = settings.get().favorites.length
const r57a = await importBackup(fileOf({ ...base, settings: { favorites: [] } }))
check('T5-7: an empty list is still withheld (safety rule intact)', r57a.favoritesKept === true, JSON.stringify(r57a))
check('T5-7: …and reported as EMPTY, not as ghosts', r57a.favoritesKeptReason === 'empty', JSON.stringify(r57a))
check('T5-7: the phone keeps its stars', settings.get().favorites.length === starsBefore && starsBefore > 0)
const r57b = await importBackup(fileOf({ ...base, settings: { favorites: ['kk_ghost', 'ds_gone'] } }))
check('T5-7: an all-ghost list is withheld and reported as GHOSTS', r57b.favoritesKept === true && r57b.favoritesKeptReason === 'ghosts', JSON.stringify(r57b))
const r57c = await importBackup(fileOf({ ...base, settings: { favorites: ['pk_lola'] } }))
check('T5-7 control: a living list lands, no flag, no reason', r57c.favoritesKept === false && r57c.favoritesKeptReason === null && JSON.stringify(settings.get().favorites) === JSON.stringify(['pk_lola']), JSON.stringify(r57c))

// ── T5-8: __proto__ lands as inert data; no prototype is ever swapped ──
const crafted = JSON.parse('{"__proto__": {"pollutedR3": "yes"}, "futureField": 7, "defaultVoice": {"en": "pk_alba", "__proto__": {"pollutedDv": "yes"}}}')
await importBackup(fileOf({ ...base, settings: crafted }))
check('T5-8: Object.prototype is NOT polluted', ({} as Record<string, unknown>).pollutedR3 === undefined && ({} as Record<string, unknown>).pollutedDv === undefined)
const s58 = settings.get() as unknown as Record<string, unknown>
check('T5-8: a normal unknown field still rides verbatim', s58.futureField === 7, JSON.stringify(s58.futureField))
check('T5-8: the top-level __proto__ lands as an OWN data field (the drop is cured)', Object.prototype.hasOwnProperty.call(s58, '__proto__') && (s58['__proto__'] as Record<string, unknown>)?.pollutedR3 === 'yes')
check('T5-8: the settings object’s prototype is untouched', Object.getPrototypeOf(s58) === Object.prototype)
const dv58 = s58.defaultVoice as Record<string, unknown>
check('T5-8: defaultVoice’s prototype is untouched', Object.getPrototypeOf(dv58) === Object.prototype)
check('T5-8: no inherited read answers through defaultVoice', dv58.pollutedDv === undefined, JSON.stringify(dv58.pollutedDv))
check('T5-8: defaultVoice’s __proto__ is inert own data, and en still reads', Object.prototype.hasOwnProperty.call(dv58, '__proto__') && dv58.en === 'pk_alba')

console.log(`CURE WaveD T5: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
