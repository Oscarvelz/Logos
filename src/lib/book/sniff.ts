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
  if (at('%PDF-') && b[5] >= 0x30 && b[5] <= 0x39 && b[6] === 0x2e && b[7] >= 0x30 && b[7] <= 0x39 && (b[8] === 0x0a || b[8] === 0x0d)) return 'pdf'
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
      if (mtKey && (await zip.file(mtKey)?.async('text'))?.trim() === 'application/epub+zip') return 'epub'
    } catch { /* not a readable zip: say nothing */ }
    return null
  }
  const head = new TextDecoder('windows-1252').decode(b.subarray(0, 512)).trimStart()
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
    cannot wear is the block byte where the format puts it. */
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
  return b[next] === 0x2c || b[next] === 0x21 || b[next] === 0x3b
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
