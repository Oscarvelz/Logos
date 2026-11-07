// A photo or screenshot as a book: the words are read out of the picture with
// the same OCR engine that rescues scanned PDFs, and the picture itself is
// kept as the book's cover. An image with no legible words in it fails the
// usual way — importBook finds no readable text and says so.
import { parseText } from './formats.ts'
import { ocrImageText } from './pdf.ts'
import type { RawBook } from './finish.ts'

export async function parseImage(buf: ArrayBuffer, file: File, step: (s: string, done: number, total: number) => void): Promise<RawBook> {
  step('Reading the image (OCR)', 0, 1)
  const mime = file.type || 'image/png'
  const text = await ocrImageText(buf, mime)
  const raw = parseText(text, false)
  raw.cover = new Blob([buf], { type: mime })
  if (!raw.titleGuess) {
    const first = text.split('\n').map((l) => l.trim()).find((l) => l.length >= 12 && /\p{L}{3}/u.test(l))
    if (first) raw.titleGuess = first.length > 80 ? `${first.slice(0, 77)}…` : first
  }
  return raw
}
