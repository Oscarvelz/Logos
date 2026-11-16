// Wave 3 audit probes — M-1 (formatOf / sniffFormat) and the M-6 content
// fingerprint, against the REAL src/lib/book/import.ts. Run via
// audit-wave3-run-import.mjs (the standard vela runner cannot resolve
// pdf.ts's `?url` worker import; that runner stubs only that asset URL,
// which none of the functions exercised here touch).
import { formatOf, sniffFormat, contentHash } from '../src/lib/book/import.ts'
import { finishBook, type RawBook } from '../src/lib/book/finish.ts'

let fails = 0
const check = (name: string, cond: boolean, extra?: unknown) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra !== undefined ? ' :: ' + JSON.stringify(extra) : ''}`)
  if (!cond) fails++
}
const buf = (bytes: number[] | Uint8Array) => { const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer }
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0))

const pngBytes = buf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
check('M-1 png bytes named photo.txt sniff image', (await sniffFormat(pngBytes)) === 'image')
check('M-1 image MIME outranks .txt in formatOf', formatOf(new File([pngBytes], 'photo.txt', { type: 'image/png' })) === 'image')
check('M-1 pdf bytes sniff pdf', (await sniffFormat(buf([...ascii('%PDF-1.7\n'), 1, 2]))) === 'pdf')
check('M-1 pdf MIME outranks .txt name', formatOf(new File(['x'], 'book.txt', { type: 'application/pdf' })) === 'pdf')
check('M-1 html no-ext text/html -> html', formatOf(new File(['<html>'], 'page', { type: 'text/html' })) === 'html')
check('M-1 html bytes sniff html', (await sniffFormat(buf(ascii('<!DOCTYPE html><html><body>hi')))) === 'html')
check('M-1 rtf bytes named .txt sniff rtf', (await sniffFormat(buf(ascii('{\\rtf1\\ansi hello}')))) === 'rtf')
check('M-1 fb2 bytes sniff fb2', (await sniffFormat(buf(ascii('<?xml version="1.0"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">')))) === 'fb2')
check('M-1 trailing-space name notes.txt␣ -> txt', formatOf(new File(['x'], 'notes.txt ', { type: '' })) === 'txt')
check('M-1 epub MIME outranks .pdf name', formatOf(new File(['x'], 'book.pdf', { type: 'application/epub+zip' })) === 'epub')
check('M-1 plain text bytes sniff nothing (name/type decide)', (await sniffFormat(buf(ascii('Just some plain words in a row.')))) === null)
try {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip')
  zip.file('META-INF/container.xml', '<?xml version="1.0"?><container/>')
  zip.file('OEBPS/ch1.xhtml', '<html/>')
  const epubBuf = await zip.generateAsync({ type: 'arraybuffer' })
  check('M-1 epub bytes named book.pdf sniff epub (not pdf)', (await sniffFormat(epubBuf)) === 'epub')
  check('M-1 epub bytes, no extension, empty type sniff epub', (await sniffFormat(epubBuf)) === 'epub' && formatOf(new File(['x'], 'book', { type: '' })) === null)
  const zip2 = new JSZip()
  zip2.file('word/document.xml', '<w:document/>')
  const docxBuf = await zip2.generateAsync({ type: 'arraybuffer' })
  check('M-1 docx bytes named book.epub sniff docx', (await sniffFormat(docxBuf)) === 'docx')
} catch (e) { check('M-1 zip-family sniff (jszip craft)', false, String(e)) }

// ── M-6 fingerprint ──────────────────────────────────────────────────────
const raw: RawBook = { title: 'Same Book', chapters: [{ title: 'One', blocks: [{ k: 'p', t: 'alpha beta gamma delta epsilon zeta eta theta' }] }], anchors: new Map() }
const f1 = finishBook(raw, new File(['x'], 'same.txt'), 'txt')
const f2 = finishBook(raw, new File(['x'], 'same.txt'), 'txt')
check('M-6 two finishes mint different ids (the fingerprint is what saves us)', f1.meta.id !== f2.meta.id)
check('M-6 contentHash identical for the same file twice', contentHash(f1.content) === contentHash(f2.content), contentHash(f1.content))
const rawOther: RawBook = { title: 'Other', chapters: [{ title: 'One', blocks: [{ k: 'p', t: 'alpha beta gamma delta epsilon zeta eta omega' }] }], anchors: new Map() }
check('M-6 contentHash differs when the text differs', contentHash(finishBook(rawOther, new File(['x'], 'o.txt'), 'txt').content) !== contentHash(f1.content))

console.log(fails ? `\n${fails} FAILURES` : '\nALL CHECKS PASSED')
process.exitCode = fails ? 1 : 0
