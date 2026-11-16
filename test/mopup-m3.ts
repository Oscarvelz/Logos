// Acceptance probe for cure M-3 (Wave 3 mop-up): a short PDF that read
// perfectly must no longer be refused with the false "scanned pictures"
// diagnosis; a PDF with no readable text at all must still be refused,
// with an honest message. Runs the REAL parsePdf over two hand-made
// minimal PDFs (their bytes are embedded so the probe is self-contained).
import { readFileSync } from 'node:fs'
import { parsePdf } from '../src/lib/book/pdf.ts'

let pass = 0, fail = 0
const check = (name: string, ok: boolean, extra = '') => {
  if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) }
}

const shortBuf = readFileSync('/tmp/m3-short.pdf')
const emptyBuf = readFileSync('/tmp/m3-empty.pdf')
const toAB = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
const step = () => {}

// The short book: ~120 chars of real text — the old gate (chars <
// max(200, N*40)) refused exactly this, calling it scanned pictures.
try {
  const raw = await parsePdf(toAB(shortBuf), step)
  const text = raw.chapters.flatMap((c) => c.blocks.map((b) => b.t)).join(' ')
  check('short real PDF is accepted', true)
  check('its text came through', text.includes('short poem') && text.includes('text layer'), text.slice(0, 120))
} catch (e) {
  check('short real PDF is accepted', false, String(e))
}

// The empty book: no text layer, nothing for OCR to find — refusal is
// honest here, and the message must state the fact, not the old lie.
try {
  await parsePdf(toAB(emptyBuf), step)
  check('empty PDF is refused', false, 'parsePdf returned a book')
} catch (e) {
  const msg = String((e as Error)?.message ?? e)
  check('empty PDF is refused', true)
  check('refusal states the fact', msg.includes('No readable text was found'), msg)
  check('refusal is not the old false diagnosis', !msg.includes('is scanned pictures of pages, and no text could be read'), msg)
}

console.log(`M-3 mop-up probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
