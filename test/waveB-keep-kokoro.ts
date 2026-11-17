// WAVE B (1.4.189) — T4-16 + T4-17 cure probes.
// T4-16: the keep note was a single slot; a joint eviction of both
// engines reported only the LAST loss (the other's stamp was already
// deleted). The notes must carry BOTH losses, migrate a legacy
// single-object note, and clear wholly on dismiss.
// T4-17: removeKokoroCaches set logos.kokoroRemoved=1 even when a
// bucket delete rejected. The flag must be earned: unset on failure
// (next launch retries), set once both deletes resolve.
// Modules are imported DYNAMICALLY, after the seeds: the runner
// hoists static imports above entry statements, and keep.ts reads
// its persisted note at module init — the legacy seed must land
// first for the migration leg to mean anything.

const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
}
Object.defineProperty(globalThis, 'navigator', { value: { hardwareConcurrency: 4, deviceMemory: 4 }, configurable: true })
;(globalThis as any).self = globalThis

// Empty cache buckets: every stamped model reads as evicted.
const emptyBucket = { keys: async () => [], match: async () => undefined, delete: async () => true }
let deleteBehavior: (name: string) => Promise<boolean> = async () => true
;(globalThis as any).caches = {
  open: async () => emptyBucket,
  delete: (name: string) => deleteBehavior(name),
}
;(globalThis as any).fetch = async () => { throw new Error('offline') }

// T4-16 legacy seed: a note written by the OLD single-slot version,
// in the store before keep.ts reads its initial state.
store.set('logos.keepNote', JSON.stringify({ kind: 'cleared', engine: 'pocket', lang: 'en', at: 5, keptAt: 4 }))

const { keep, checkStamps, dismissKeepNote } = await import('../src/engine/keep.ts')
const { removeKokoroCaches } = await import('../src/engine/engine.ts')

let fails = 0
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + extra}`)
  if (!ok) fails++
}

// ---------- T4-16: migration, then both losses at once ----------
const migrated = keep.get().notes
check('T4-16 a legacy single-object note migrates to a one-loss list', migrated.length === 1 && migrated[0].engine === 'pocket' && migrated[0].kind === 'cleared', JSON.stringify(migrated))

store.set('logos.kept', JSON.stringify({ 'pocket.en': { at: 111, digest: 'x' }, 'phonon.es': { at: 222, digest: 'y' } }))
await checkStamps()
const notes = keep.get().notes
check('T4-16 both losses are reported (pocket.en + phonon.es)', notes.length === 2 && notes.some((n) => n.engine === 'pocket' && n.lang === 'en') && notes.some((n) => n.engine === 'phonon' && n.lang === 'es'), JSON.stringify(notes))
check('T4-16 both notes are eviction reports with their keptAt', notes.every((n) => n.kind === 'cleared' && typeof n.keptAt === 'number'))
const persisted = JSON.parse(store.get('logos.keepNote') ?? 'null')
check('T4-16 persisted note is a list of both losses', Array.isArray(persisted) && persisted.length === 2, String(store.get('logos.keepNote')))
dismissKeepNote()
check('T4-16 dismiss clears every standing note', keep.get().notes.length === 0 && !store.has('logos.keepNote'))

// ---------- T4-17: the kokoroRemoved flag is earned ----------
let deleteCalls = 0
deleteBehavior = async (name: string) => { deleteCalls++; if (name === 'kokoro-voices') throw new Error('storage blocked'); return true }
await removeKokoroCaches()
check('T4-17 a rejected bucket delete leaves the flag UNSET', store.get('logos.kokoroRemoved') !== '1', String(store.get('logos.kokoroRemoved')))
check('T4-17 both buckets were attempted despite the failure', deleteCalls === 2, String(deleteCalls))
deleteBehavior = async () => { deleteCalls++; return true }
await removeKokoroCaches()
check('T4-17 retry succeeds and sets the flag', store.get('logos.kokoroRemoved') === '1')
const callsAfterDone = deleteCalls
await removeKokoroCaches()
check('T4-17 once flagged, later launches do not re-delete', deleteCalls === callsAfterDone)

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASS')
process.exitCode = fails ? 1 : 0
