// Byte-sniffing and content fingerprinting for book imports.
// Extracted from import.ts (Wave C, 1.4.190) so the runner can probe
// the real functions: import.ts's chain reaches pdf.ts's pdfjs `?url`
// worker import, which the in-memory bundler cannot load — the limit
// that forced the Round-2 hunt to probe verbatim copies. import.ts
// re-exports both functions; its surface is unchanged.
import type { BookContent } from '../books.ts'

/** What the bytes themselves say the file is (M-1 cure): magic numbers
    for PDF and the image kinds, the ZIP family told apart by the entries
    inside it (word/document.xml → DOCX, META-INF/container.xml or a
    mimetype entry declaring EPUB → EPUB), and the opening markup for RTF, FB2 and
    HTML. Returns null when the bytes say nothing definite — the name
    and type then get their say via formatOf.
    R2-T3-7: two of the magics were short enough to be coincidences —
    'BM' is two bytes of English prose as easily as a bitmap, and
    'GIF8' opens any text about GIFs. A two-byte witness cannot testify
    alone: the BMP claim now has to survive its own header (the
    file-size field must agree with the file in hand, the reserved
    fields must be the zeros every real BMP carries, and the DIB
    header and pixel-data offset must be plausible), and the GIF
    claim needs its version block plus a logical screen descriptor
    with a nonzero canvas. PNG and JPEG keep testifying on their
    magics — theirs are long, structured, and not prose. A claim that
    fails its structure check says nothing, and the name/type verdict
    (formatOf) decides instead, exactly as for any unrecognised bytes. */
export async function sniffFormat(buf: ArrayBuffer): Promise<string | null> {
  const b = new Uint8Array(buf)
  const at = (s: string, off = 0) => { for (let i = 0; i < s.length; i++) if (b[off + i] !== s.charCodeAt(i)) return false; return true }
  // Cure R2-T8-13 (the PDF half; T3-7 above cured the image half):
  // "%PDF-" alone is five bytes of prose in any text ABOUT the format
  // ("%PDF-1.7 is the signature every PDF file starts with…"), and it
  // routed such a text into the PDF parser to die there. A real
  // header is "%PDF-X.Y" followed by a line break — the version and
  // the break are part of the magic now.
  // Cure R3-T8-9: the header need not sit at byte 0 — the spec lets
  // it live anywhere in the first 1024 bytes, and files that
  // travelled (a mailer's blank lines, a generator's comment line)
  // carry it later; an extensionless copy of such a file was refused
  // as "isn't a book file". The shape demanded is unchanged, only
  // the seat moves: prose ABOUT the signature still fails the break
  // test wherever in it the mention sits.
  // Cure R4-T8-18: the header shape was the WHOLE testimony — a
  // prose file that opens with the exact header line ("%PDF-1.7"
  // followed by prose explaining the format) sniffed pdf and was
  // sent to the PDF
  // parser to die, where BMP must match its own size field and GIF
  // its block layout. A real PDF agrees with itself behind the
  // header: an indirect object ("12 0 obj") opens within the first
  // stretch of the file, and the file ends with its cross-reference
  // machinery (startxref / %%EOF). Prose about the format carries
  // neither where the format puts them. A claim with no structure
  // behind it says nothing, and the name/type verdict decides — a
  // real PDF named .pdf loses nothing by the stricter door.
  for (let off = 0; off < 1024 && off + 9 <= b.length; off++) {
    if (at('%PDF-', off) && b[off + 5] >= 0x30 && b[off + 5] <= 0x39 && b[off + 6] === 0x2e && b[off + 7] >= 0x30 && b[off + 7] <= 0x39 && (b[off + 8] === 0x0a || b[off + 8] === 0x0d)) {
      const region = new TextDecoder('windows-1252').decode(b.subarray(off, Math.min(b.length, off + 2048)))
      const tail = new TextDecoder('windows-1252').decode(b.subarray(Math.max(off, b.length - 1024)))
      if (/\d+ \d+ obj\b/.test(region) || /startxref/.test(tail) || /%%EOF/.test(tail)) return 'pdf'
    }
  }
  if (at('\x89PNG') || at('\xff\xd8\xff') || (at('RIFF') && at('WEBP', 8))) return 'image'
  if (at('GIF8') && gifShaped(b)) return 'image'
  if (at('BM') && bmpShaped(b)) return 'image'
  if (at('PK\x03\x04')) {
    try {
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(buf)
      const names = Object.keys(zip.files).map((n) => n.toLowerCase())
      if (names.some((n) => n.endsWith('word/document.xml'))) return 'docx'
      if (names.some((n) => n.endsWith('meta-inf/container.xml'))) return 'epub'
      // Cure R2-T8-14: a "mimetype" ENTRY is not an EPUB signal — an
      // ODF document is a zip whose defining entry is also named
      // "mimetype", and it was refused as a broken EPUB before
      // formatOf could give its honest answer ("ODT files can't be
      // read yet…"). The entry's CONTENT is the signal: only
      // application/epub+zip means EPUB.
      const mtKey = Object.keys(zip.files).find((n) => n.toLowerCase() === 'mimetype')
      // Cure R3-T8-8: media types are case-insensitive and real
      // toolchains vary the case ("Application/EPUB+ZIP"); the
      // comparison folds case like the entry-name lookup above it.
      if (mtKey && (await zip.file(mtKey)?.async('text'))?.trim().toLowerCase() === 'application/epub+zip') return 'epub'
    } catch { /* not a readable zip: say nothing */ }
    return null
  }
  // Cure R3-T3-2: a UTF-8 BOM decodes to "ï»¿" in front of the
  // markup and trimStart does not remove it, so a BOM'd HTML or FB2
  // file said nothing at all and formatOf judged it by name alone —
  // a BOM'd page named .txt shelved as literal tags. The BOM is
  // skipped before the markup tests, as everywhere else in the app.
  const bom = b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf ? 3 : 0
  const head = new TextDecoder('windows-1252').decode(b.subarray(bom, bom + 512)).trimStart()
  if (/^\{\\rtf/i.test(head)) return 'rtf'
  if (/^<\?xml[^>]*>\s*<fictionbook/i.test(head) || /^<fictionbook/i.test(head)) return 'fb2'
  if (/^<!doctype\s+html/i.test(head) || /^<html[\s>]/i.test(head)) return 'html'
  return null
}

/** A real BMP's header agrees with itself: the size it declares is
    the size of the file in hand, its reserved fields are zero, and
    its DIB header and pixel offset sit where the format puts them.
    Prose that merely opens with the letters "BM" agrees with none
    of this. */
function bmpShaped(b: Uint8Array): boolean {
  if (b.length < 26) return false
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  if (dv.getUint32(2, true) !== b.length) return false
  if (dv.getUint16(6, true) !== 0 || dv.getUint16(8, true) !== 0) return false
  const dib = dv.getUint32(14, true)
  if (dib < 12) return false
  const dataOff = dv.getUint32(10, true)
  return dataOff >= 14 + dib && dataOff <= b.length
}

/** A real GIF carries its version ('87a'/'89a') right after the
    'GIF8' signature, a logical screen descriptor whose canvas has
    size, and — after the descriptor and any global colour table it
    declares — a block introducer (image descriptor, extension or
    trailer). The version and canvas alone do NOT suffice: the prose
    "GIF89a is not a picture…" wears both, by spelling. What it
    cannot wear is the block byte where the format puts it.
    Cure R3-T8-7 / R3-T3-1: prose CAN wear the block byte after all —
    in "GIF89a is old, …" the byte at the block offset is the comma,
    0x2C by value, and a semicolon wears the trailer. So the block
    itself is now read, not just its introducer: a trailer must
    end the GIF (only inert NUL padding may follow it — prose
    after a semicolon is not padding); an extension must carry a
    known label (and its fixed block size where the spec fixes
    one); an image descriptor must carry a canvas of its own and
    be followed — past any local colour table — by an LZW minimum
    code size, which the spec fixes at 2–8. Prose wears a comma
    easily; it does not wear a plausible descriptor AND a code
    size in range.
    Cure R4-T8-17: the comment extension's label alone testified —
    prose wearing '!' + 'þ' at the block offset passed. The blocks
    are now WALKED (gifBlockWalk below): every extension must end
    where its structure ends it, and the stream must arrive at an
    image descriptor or the trailer before anything testifies. */
function gifShaped(b: Uint8Array): boolean {
  if (b.length < 14) return false
  const v = String.fromCharCode(b[4], b[5])
  if (v !== '7a' && v !== '9a') return false
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  if (dv.getUint16(6, true) === 0 || dv.getUint16(8, true) === 0) return false
  const packed = b[10]
  let next = 13
  if (packed & 0x80) next += 3 * 2 ** ((packed & 0x07) + 1)
  if (next >= b.length) return false
  return gifBlockWalk(b, dv, next)
}

/** The end of a sub-block chain (a size byte, that many data bytes,
    …, a zero terminator): the index just past the terminator, or -1
    when the chain runs off the end of the file. */
function gifChainEnd(b: Uint8Array, i: number): number {
  for (;;) {
    if (i >= b.length) return -1
    const size = b[i]
    if (size === 0) return i + 1
    i += 1 + size
  }
}

/** Walk the GIF's block stream from `next`, judging each block by
    its own structure, until an image descriptor or the trailer
    testifies. Cure R4-T8-17: the first-block reading let the
    COMMENT extension testify on its label alone ("a comment's chain
    is free-form; its label is witness enough") — and prose wears
    the label: "GIF89a is old!þ…" puts '!' at the block offset and
    'þ' (0xFE) after it, and was routed to OCR as a picture. A
    comment is now walked like every other extension — its chain
    must terminate inside the file (prose's "size" byte is a letter,
    so its chain runs off the end) — and the block AFTER the chain
    must testify in its turn: an image descriptor with a canvas of
    its own and an LZW code size in range, or the trailer with only
    NUL padding behind it. The fixed-size extensions keep their size
    testimony and must now also END where the spec ends them (the
    graphic control's terminator byte) and be followed by a block
    that testifies. Declared bound: a header-plus-extensions file
    with no image and no trailer no longer testifies — it is not a
    decodable GIF either. */
function gifBlockWalk(b: Uint8Array, dv: DataView, next: number): boolean {
  let i = next
  for (let blocks = 0; blocks < 64; blocks++) {
    if (i >= b.length) return false
    const block = b[i]
    if (block === 0x3b) return b.subarray(i + 1).every((x) => x === 0) // trailer: only NUL padding may follow
    if (block === 0x2c) {
      // Image descriptor: position, a canvas of its own (nonzero),
      // a packed byte, then the LZW minimum code size in 2–8.
      if (i + 10 >= b.length) return false
      if (dv.getUint16(i + 5, true) === 0 || dv.getUint16(i + 7, true) === 0) return false
      let after = i + 10
      if (b[i + 9] & 0x80) after += 3 * 2 ** ((b[i + 9] & 0x07) + 1)
      if (after >= b.length) return false
      return b[after] >= 2 && b[after] <= 8
    }
    if (block !== 0x21) return false
    // Extension: graphic control, plain text, comment or application.
    const label = b[i + 1]
    if (label === 0xf9) { // graphic control: size byte 4, four bytes, a zero terminator
      if (b[i + 2] !== 4 || b[i + 7] !== 0) return false
      i += 8
      continue
    }
    if (label === 0xff) { // application: size byte 11, eleven bytes, then a sub-block chain
      if (b[i + 2] !== 11) return false
      const j = gifChainEnd(b, i + 14)
      if (j < 0) return false
      i = j
      continue
    }
    if (label === 0x01) { // plain text: size byte 12, twelve bytes, then a sub-block chain
      if (b[i + 2] !== 12) return false
      const j = gifChainEnd(b, i + 15)
      if (j < 0) return false
      i = j
      continue
    }
    if (label === 0xfe) { // comment: a sub-block chain, walked like the rest
      const j = gifChainEnd(b, i + 2)
      if (j < 0) return false
      i = j
      continue
    }
    return false
  }
  return false
}

/** Content fingerprint (M-6): a cyrb53 hash over every block's text.
    R2-T3-8: the hash used to mix only the blocks, so the same text
    split into chapters differently hashed identically — and the
    dedupe then refused a better-split edition of a book already
    shelved, keeping the flat one's chapters, TOC and links forever.
    Each chapter now opens with a boundary mix carrying its block
    count, so the fingerprint is over the text AS STRUCTURED. Chapter
    titles are deliberately not mixed: a retitled edition is the same
    book, a re-split one is a different shelving. */
export function contentHash(content: BookContent): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  const mix = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      const ch = s.charCodeAt(i)
      h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677)
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  }
  for (const c of content.chapters) {
    mix(`\u0001${c.blocks.length}\u0002`)
    for (const b of c.blocks) { mix(b.t); mix('\n') }
  }
  return `${(h2 >>> 0).toString(16)}:${(h1 >>> 0).toString(16)}:${content.chapters.reduce((n, c) => n + c.blocks.length, 0)}`
}
