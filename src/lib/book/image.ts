// A photo or screenshot as a book: the words are read out of the picture with
// the same OCR engine that rescues scanned PDFs, and the picture itself is
// kept as the book's cover. An image with no legible words in it fails the
// usual way — importBook finds no readable text and says so.
import { parseText } from './formats.ts'
import { ocrImageText } from './pdf.ts'
import { isMachineName, titleFromText, type RawBook } from './finish.ts'

export async function parseImage(buf: ArrayBuffer, file: File, step: (s: string, done: number, total: number) => void): Promise<RawBook> {
  step('Reading the image (OCR)', 0, 1)
  const mime = file.type || 'image/png'
  let text = await ocrImageText(buf, mime)
  // Chat apps that share a message as a picture print a small footer on the
  // card ("from Muse app") and, when the message is longer than the card,
  // cut the text off with "…" — those words were never in the picture, so no
  // OCR can recover them. Drop the footer, remove the cut mark, keep what
  // did arrive, and warn plainly instead of playing a shortened text as if
  // it were whole.
  let cut = false
  const lines = text.split('\n').filter((l) => !/^\s*(from|de|desde)\s+[\p{L} ]{1,24}\bapp\b\.?\s*$/iu.test(l))
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i].trim()
    if (!t) continue
    if (/^(…|\.{3,})\.?$/.test(t)) { cut = true; lines.splice(i, 1) }
    else if (/\s(…|\.\.\.)$/.test(t)) { cut = true; lines[i] = t.replace(/\s*(…|\.\.\.)$/, '') }
    break
  }
  text = lines.join('\n')
  const raw = parseText(text, false)
  if (cut) raw.warn = 'This shared image arrived cut off: the app that shared it shortened the text with "…", so the ending was never in the picture. For the whole message, copy it and use Paste in Listen.'
  raw.cover = new Blob([buf], { type: mime })
  // The book is titled by its own words, never by the file's name. When the
  // file arrived under a machine name (a share hash, a camera name) the
  // derived title is not a guess but the title itself, so no fallback in
  // finishBook can ever resurrect the hash.
  const derived = titleFromText(text)
  if (derived) {
    if (!raw.titleGuess) raw.titleGuess = derived
    if (isMachineName(file.name)) raw.title = derived
  }
  return raw
}
