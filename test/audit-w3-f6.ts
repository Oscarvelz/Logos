// AUDIT Wave3 F6: importBackup must validate the WHOLE file (version
// included) and fail at the door with the true reason — before any write.
const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
}
Object.defineProperty(globalThis,'navigator',{value:{hardwareConcurrency:4},configurable:true})
;(globalThis as any).location = { search: '', pathname: '/' }
;(globalThis as any).history = { replaceState: () => {} }

import { importBackup, BackupImportError } from '../src/lib/backup.ts'

let pass = 0, fail = 0
const check = (name: string, ok: boolean) => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name) } }
const fakeFile = (data: unknown) => ({ text: async () => (typeof data === 'string' ? data : JSON.stringify(data)) }) as any
async function attempt(data: unknown): Promise<string> {
  try { await importBackup(fakeFile(data)); return 'NO-THROW' } catch (e: any) { return `${e instanceof BackupImportError ? 'BIE' : 'OTHER'}: ${e?.message ?? e}` }
}

const goodBook = {
  meta: { id: 'b1', title: 'T', format: 'txt', lang: 'en', addedAt: 1, progress: 0, words: 3, links: 0, size: 3, pos: { ch: 0, b: 0 }, chWords: [3], toc: [] },
  content: { id: 'b1', chapters: [{ title: 'c', blocks: [{ k: 'p', t: 'hi' }] }] },
}

const v999 = await attempt({ app: 'logos', version: 999, books: [] })
check('version 999 rejected as newer-version, not accepted', v999.startsWith('BIE') && /newer Logos/.test(v999))
const noVersion = await attempt({ app: 'logos', books: [] })
check('missing version rejected as damaged', /damaged/.test(noVersion))
const badBook = await attempt({ app: 'logos', version: 1, books: [{ meta: { title: 'NoId' }, content: {} }] })
check('book missing id rejected at validation with true reason', /damaged/.test(badBook) && /no id/.test(badBook))
const badPron = await attempt({ app: 'logos', version: 1, books: [goodBook], pronounce: [null] })
check('null pron entry rejected at validation (old code crashed mid-restore)', /damaged/.test(badPron) && /pronunciation entry 1/.test(badPron))
const badContent = await attempt({ app: 'logos', version: 1, books: [{ ...goodBook, content: { id: 'OTHER', chapters: [{ title: 'c', blocks: [{ k: 'p', t: 'x' }] }] } }] })
check('content id mismatch rejected at validation', /different book/.test(badContent))
console.log(`F6 probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
