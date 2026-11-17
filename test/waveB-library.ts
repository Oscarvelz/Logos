// WAVE B (1.4.189) — Library-track cure probes: L-1, L-2, L-3, L-4, F8.
// Each leg asserts the CURED behavior through the real modules; the
// break side of every flip is the Round-1 hunt's own probe/mechanism
// (track-3-library.md, track-5-settings.md), and L-3 carries an
// in-probe control leg proving the sweep still takes a verbatim
// (old-shape) restore.
import './waveB-lib-setup.ts'
import JSZip from 'jszip'
import { importAudio, saveClip, getClip, trackPlayback } from '../src/lib/library.ts'
import { putBook, deleteBook, getBook, sweepTempBooks, type BookMeta, type BookContent } from '../src/lib/books.ts'
import { importBackup, exportBackup } from '../src/lib/backup.ts'
import { parseEpub } from '../src/lib/book/epub.ts'
import { finishBook } from '../src/lib/book/finish.ts'
import { clipPlayer } from '../src/player/clip.ts'

let fails = 0
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + extra}`)
  if (!ok) fails++
}
const tick = (ms: number) => new Promise((r) => setTimeout(r, ms))
const meta = (id: string, extra: Partial<BookMeta> = {}): BookMeta => ({
  id, title: id, format: 'epub', lang: 'en', addedAt: 1000, openedAt: 1000,
  progress: 0, words: 10, links: 0, size: 10, pos: { ch: 0, b: 0 }, chWords: [10], toc: [], temp: true, ...extra,
})
const content = (id: string): BookContent => ({ id, chapters: [{ title: 'C', blocks: [{ k: 'p', t: 'words here' }] }] })

// ---------- L-1: honest format + duration heal ----------
const c1 = await importAudio(new File([new Uint8Array([1, 2, 3])], 'mysong', { type: 'audio/mpeg' }))
check('L-1 extensionless audio takes its format from the reported type, not its name', c1.format === 'mpeg', c1.format)
const c2 = await importAudio(new File([new Uint8Array([1])], 'talk.mp3', { type: '' }))
check('L-1 a real extension still wins', c2.format === 'mp3', c2.format)
check('L-1 the failed metadata probe still lands duration 0 (the heal setup)', c1.duration === 0, String(c1.duration))

const zero = await saveClip({ title: 'Zero', text: '', voice: '', lang: '', duration: 0, format: 'mp3', kind: 'audio', source: 'import' })
trackPlayback()
clipPlayer.set({ key: `clip:${zero.id}`, playing: true, time: 2, duration: 42, title: 'Zero', artist: '' })
await tick(120)
const healed = await getClip(zero.id)
check('L-1 a duration-0 clip heals to the length the player reports', healed?.duration === 42, String(healed?.duration))

// ---------- L-3: Undo shape vs the sweep (control + cure) ----------
await putBook(meta('ctl'), content('ctl'))
await putBook(meta('keeper', { addedAt: 2000, openedAt: 2000 }), content('keeper'))
const goneCtl = await deleteBook('ctl', { force: true })
await putBook(goneCtl!.meta, goneCtl!.content) // the OLD undo shape: verbatim, temp intact
await sweepTempBooks()
check('L-3 control: a verbatim-restored temp book IS swept again (the old disease)', !(await getBook('ctl')))

await putBook(meta('und'), content('und'))
const goneUnd = await deleteBook('und', { force: true })
await putBook({ ...goneUnd!.meta, temp: false }, goneUnd!.content) // the shelf Undo shape after the cure
await sweepTempBooks()
check('L-3 an undone deletion (temp cleared at the Undo call site) survives the sweep', !!(await getBook('und')))
check('L-3 the most-recently-opened floor book is untouched throughout', !!(await getBook('keeper')))

// ---------- L-4: restores land kept; merges never resurrect temp ----------
const bkBook = (id: string, progress: number, temp: boolean) => ({
  meta: { id, title: id, format: 'epub', lang: 'en', addedAt: 500, openedAt: 500, progress, words: 10, links: 0, size: 10, pos: { ch: 0, b: 0 }, chWords: [10], toc: [], temp },
  content: { id, chapters: [{ title: 'C', blocks: [{ k: 'p', t: 'text' }] }] },
})
const backupFile = (booksArr: unknown[]) => new File([JSON.stringify({ app: 'logos', version: 1, settings: {}, books: booksArr, clips: [] })], 'logos-backup.json', { type: 'application/json' })

await importBackup(backupFile([bkBook('fresh', 0.3, true)]))
const fresh = await getBook('fresh')
check('L-4 a book that exists only in the backup lands KEPT', !!fresh && !fresh.temp, JSON.stringify(fresh?.temp))

await putBook({ ...meta('mrg'), temp: false, progress: 0.2, openedAt: 9000, addedAt: 9000 }, content('mrg'))
await importBackup(backupFile([bkBook('mrg', 0.9, true)]))
const mrg = await getBook('mrg')
check('L-4 the merge still takes the further-along progress', mrg?.progress === 0.9, String(mrg?.progress))
check('L-4 the merge does not resurrect temp from the backup copy', !!mrg && !mrg.temp, JSON.stringify(mrg?.temp))

// ---------- F8: export declares what it had to leave out ----------
await putBook(meta('has-text', { temp: false }), content('has-text'))
await putBook(meta('no-text', { temp: false }), null) // meta-only record: its text is gone (the Undo-of-missing-content shape)
const report = await exportBackup()
check('F8 the export report counts the book left out for missing text', report.skipped === 1, JSON.stringify(report))
check('F8 the export report counts the books inside (keeper, und, fresh, mrg, has-text)', report.books === 5, JSON.stringify(report))

// ---------- L-2: EPUB honesty ----------
const step = () => {}
const dummy = new File([], 'book.epub')
const zip = new JSZip()
zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
zip.file('OEBPS/content.opf', '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Broken Book</dc:title><dc:creator>Tester</dc:creator><dc:language>en</dc:language></metadata><manifest><item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/><item id="missing" href="missing.xhtml" media-type="application/xhtml+xml"/><item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/><item id="blob" href="data.bin" media-type="application/octet-stream"/></manifest><spine><itemref idref="ch1"/><itemref idref="missing"/><itemref idref="ch2"/><itemref idref="blob"/></spine></package>')
zip.file('OEBPS/ch1.xhtml', '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>One</title></head><body><h1>Chapter One</h1><p>Start here. <a href="missing.xhtml">The lost chapter</a> and <a href="ch2.xhtml">the next chapter</a> await.</p></body></html>')
zip.file('OEBPS/ch2.xhtml', '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Two</title></head><body><h1>Chapter Two</h1><p>The real second chapter.</p></body></html>')
const buf = await zip.generateAsync({ type: 'arraybuffer' })
const raw = await parseEpub(buf, step)
check('L-2 the book parses despite the missing chapter', raw.chapters.length === 2, String(raw.chapters.length))
check('L-2 the missing chapter leaves NO anchor behind', !raw.anchors.has('OEBPS/missing.xhtml'))
const ch2Anchor = raw.anchors.get('OEBPS/ch2.xhtml')
check('L-2 the surviving chapter anchors at its own index', ch2Anchor?.ch === 1 && ch2Anchor?.b === 0, JSON.stringify(ch2Anchor))
check('L-2 the warning names the missing chapter file', !!raw.warn && /1 chapter file was missing/.test(raw.warn), raw.warn ?? '(no warn)')
check('L-2 the warning names the unreadable spine item', !!raw.warn && /1 item in the reading order/.test(raw.warn), raw.warn ?? '(no warn)')

const fin = finishBook(raw, dummy, 'epub')
const allLinks: string[] = []
for (const ch of fin.content.chapters) for (const b of ch.blocks) if (b.l) for (const l of b.l) allLinks.push(l.to)
check('L-2 the finished book keeps the honest link to chapter two', allLinks.filter((l) => l === '1:0').length === 1, JSON.stringify(allLinks))
check('L-2 no link in the finished book points anywhere else (the lost-chapter link is dropped, not redirected)', allLinks.length === 1, JSON.stringify(allLinks))
check('L-2 the warning reaches the shelf record', !!fin.meta.warn && /missing/.test(fin.meta.warn), fin.meta.warn ?? '(no warn)')

const badZip = new JSZip()
badZip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/nope.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
const badBuf = await badZip.generateAsync({ type: 'arraybuffer' })
let err: unknown = null
try { await parseEpub(badBuf, step) } catch (e) { err = e }
check('L-2 a dangling OPF fails with a readable book error, not a raw TypeError', err instanceof Error && !(err instanceof TypeError) && /package file is missing/.test((err as Error).message), String(err))

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASS')
process.exitCode = fails ? 1 : 0
