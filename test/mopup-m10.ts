// Acceptance probe for the M-10 completion (Wave 3 mop-up): deleting a
// book must purge its text from the Listen draft and from
// logos.lastText — the leg that compared the stored key against the
// pre-T1-13 `length:first120` shape and could therefore never fire.
// Runs the REAL books.ts / nowreading.ts / drafts.ts over the shimmed
// IndexedDB in mopup-m10-setup.ts.
import './mopup-m10-setup.ts'
import { putBook, deleteBook, type BookMeta, type BookContent } from '../src/lib/books.ts'
import { setNowReading } from '../src/lib/book/nowreading.ts'
import { drafts } from '../src/lib/drafts.ts'

let pass = 0, fail = 0
const check = (name: string, ok: boolean, extra = '') => {
  if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) }
}

const paras = ['First paragraph of the doomed book.', 'Second paragraph, equally doomed.']
const text = paras.join('\n\n')
const meta = (id: string, title: string): BookMeta => ({ id, title, author: 'Probe', format: 'txt', lang: 'en', addedAt: 1, pos: { ch: 0, b: 0 }, progress: 0.4, words: 9, chWords: [9], toc: [], links: 0, size: 60 })
const content = (id: string, ps: string[]): BookContent => ({ id, chapters: [{ title: '', blocks: ps.map((t) => ({ k: 'p' as const, t })) }] })

await putBook(meta('bk-doomed', 'Doomed'), content('bk-doomed', paras))
setNowReading('bk-doomed', 'Doomed', paras, [{ ch: 0, b: 0 }, { ch: 0, b: 1 }])
drafts.set({ listen: text })
localStorage.setItem('logos.lastText', text)

const gone = await deleteBook('bk-doomed', { force: true })
check('the book itself is deleted', !!gone)
check('its text is gone from the Listen draft', drafts.get().listen === '', JSON.stringify(drafts.get().listen.slice(0, 40)))
check('logos.lastText is removed', localStorage.getItem('logos.lastText') === null)
check('the now-reading pointer is removed', localStorage.getItem('logos.nowReading') === null)

// Control: a draft belonging to ANOTHER book survives an unrelated delete.
const keepParas = ['A keeper paragraph.', 'Another keeper.']
const keepText = keepParas.join('\n\n')
await putBook(meta('bk-keeper', 'Keeper'), content('bk-keeper', keepParas))
await putBook(meta('bk-other', 'Other'), content('bk-other', paras))
setNowReading('bk-keeper', 'Keeper', keepParas, [{ ch: 0, b: 0 }, { ch: 0, b: 1 }])
drafts.set({ listen: keepText })
localStorage.setItem('logos.lastText', keepText)
await deleteBook('bk-other', { force: true })
check("another book's draft survives a delete", drafts.get().listen === keepText)
check('its lastText survives', localStorage.getItem('logos.lastText') === keepText)
check('its pointer survives', (JSON.parse(localStorage.getItem('logos.nowReading') ?? 'null') as { id?: string } | null)?.id === 'bk-keeper')

console.log(`M-10 mop-up probe: ${pass}/${pass + fail} PASS`)
if (fail) process.exit(1)
