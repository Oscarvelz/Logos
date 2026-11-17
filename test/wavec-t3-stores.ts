// WAVE C (1.4.190) — R2-T3-9 + R2-T3-10 cure probes, on the fake IDB.
// T3-9: refreshLibrary's lazy twin backfill read all clips in one
// transaction and wrote their metas in a LATER one; a delete landing
// in the window was resurrected as a ghost meta. The backfill now
// re-reads each record inside the write transaction itself.
// T3-10: putBook wrote directly, outside the per-book write queue —
// a restore landing between an updateBook job's read and its write
// was clobbered by the job's stale photo (meta and content from
// different editions). putBook now takes its queue turn like every
// other writer; the straddle sweep below tries every microtask
// offset and the restore must survive whole at every one.
import './waveB-lib-setup.ts'
import { saveClip, deleteClip, getClip, refreshLibrary, library } from '../src/lib/library.ts'
import { putBook, updateBook, getBook, getContent, type BookMeta, type BookContent } from '../src/lib/books.ts'

let fails = 0
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + extra}`)
  if (!ok) fails++
}
const tick = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ---------- T3-9: delete inside the backfill window leaves no ghost ----------
// Seed a clip through the real path (both stores written), then empty
// the twin directly — the first-launch-after-upgrade precondition.
// The race is swept across microtask offsets: at some offset the
// delete lands after the backfill's full read but before its write.
const wipeTwin = () => new Promise<void>((resolve, reject) => {
  const req = (globalThis as any).indexedDB.open('logos', 2)
  req.onsuccess = () => {
    const t = req.result.transaction(['clipmeta'], 'readwrite')
    const s = t.objectStore('clipmeta')
    const all = s.getAll()
    all.onsuccess = () => { for (const m of all.result) s.delete(m.id); t.oncomplete = () => resolve() }
  }
  req.onerror = () => reject(req.error)
})
const twinIds = () => new Promise<string[]>((resolve, reject) => {
  const req = (globalThis as any).indexedDB.open('logos', 2)
  req.onsuccess = () => {
    const s = req.result.transaction(['clipmeta'], 'readonly').objectStore('clipmeta')
    const all = s.getAll()
    all.onsuccess = () => resolve(all.result.map((m: any) => m.id))
  }
  req.onerror = () => reject(req.error)
})
let ghostAt: number[] = []
for (let k = 0; k <= 10; k++) {
  const c = await saveClip({ title: `Ghost candidate ${k}`, text: 'boo', voice: '', lang: 'en', duration: 3, format: 'mp3', kind: 'audio', source: 'import' })
  await wipeTwin()
  const rp = refreshLibrary()
  for (let i = 0; i < k; i++) await null // let the refresh advance k microtask generations
  const dp = deleteClip(c.id)
  await Promise.all([rp, dp])
  await tick(10)
  await refreshLibrary()
  const ghost = (await twinIds()).includes(c.id) && (await getClip(c.id)) === null
  if (ghost || library.get().clips.some((x) => x.id === c.id)) ghostAt.push(k)
}
check('T3-9 a delete inside the backfill window leaves no ghost at any offset', ghostAt.length === 0, `ghost at offsets: ${ghostAt.join(',')}`)

// ---------- T3-10: a mid-gap putBook survives whole ----------
const metaA: BookMeta = {
  id: 'straddle', title: 'Edition A', author: '', format: 'txt', lang: 'en', addedAt: 1000, openedAt: 1000,
  progress: 0.1, words: 10, links: 0, size: 10, pos: { ch: 0, b: 0 }, chWords: [10], toc: [],
}
const contentA: BookContent = { id: 'straddle', chapters: [{ title: 'C', blocks: [{ k: 'p', t: 'alpha text' }] }] }
const metaB: BookMeta = { ...metaA, title: 'Edition B', progress: 0.9 }
const contentB: BookContent = { id: 'straddle', chapters: [{ title: 'C', blocks: [{ k: 'p', t: 'beta text' }] }] }

let brokeAt: number[] = []
for (let k = 0; k <= 8; k++) {
  await putBook(metaA, contentA)
  const up = updateBook('straddle', { progress: 0.5 })
  for (let i = 0; i < k; i++) await null // let the job advance k microtask generations
  const pp = putBook(metaB, contentB)
  await Promise.all([up, pp])
  const m = await getBook('straddle')
  const c = await getContent('straddle')
  const whole = m?.title === 'Edition B' && m?.progress === 0.9 && c?.chapters[0].blocks[0].t === 'beta text'
  if (!whole) brokeAt.push(k)
}
check('T3-10 the restore survives whole at every straddle offset (meta + content from the same edition)', brokeAt.length === 0, `broke at offsets: ${brokeAt.join(',')}`)

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASS')
process.exitCode = fails ? 1 : 0
