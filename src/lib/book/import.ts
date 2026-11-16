// Import a book file into the shelf.
import { books, putBook, refreshBooks, getContent, updateBook, type BookMeta, type BookContent } from '../books.ts'
import { t } from '../i18n.ts'
import { finishBook, isMachineName, type RawBook } from './finish.ts'

export const BOOK_ACCEPT = '.epub,.pdf,.docx,.fb2,.txt,.md,.markdown,.html,.htm,.xhtml,.rtf,.png,.jpg,.jpeg,.webp,.gif,.bmp,application/epub+zip,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/html,application/rtf,image/png,image/jpeg,image/webp'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** Route a file by name and type — the FALLBACK, not the verdict (M-1
    cure). The old formatOf let the extension outrank everything and
    never looked at the bytes: image bytes named photo.txt were decoded
    as garbage text, an EPUB named .pdf went to the PDF parser, an HTML
    page with no extension was shelved as literal tags, a trailing space
    in the name ("notes.txt ") was refused outright, and a valid book
    with no extension and an empty/octet-stream type was refused too.
    Now: the name is trimmed and a real extension is required for an
    extension at all; a SPECIFIC MIME type outranks the extension; and
    importBook sniffs the actual bytes (sniffFormat) before this is even
    consulted — content first, MIME second, name last. */
export function formatOf(file: File): string | null {
  const name = file.name.trim()
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().trim() : ''
  if (file.type === 'application/pdf') return 'pdf'
  if (file.type === 'application/epub+zip') return 'epub'
  if (file.type === DOCX_MIME) return 'docx'
  if (file.type === 'text/html') return 'html'
  if (file.type.startsWith('image/')) return 'image'
  if (ext === 'markdown') return 'md'
  if (ext === 'htm' || ext === 'xhtml') return 'html'
  if (['epub', 'pdf', 'docx', 'fb2', 'txt', 'md', 'html', 'rtf'].includes(ext)) return ext
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) return 'image'
  if (file.type.startsWith('text/')) return 'txt'
  if (/^(mobi|azw3?|kfx|djvu|doc|odt|pages|cbz|cbr)$/.test(ext)) throw new Error(t('{ext} files can’t be read yet. Save it as EPUB or PDF and import that.', { ext: ext.toUpperCase() }))
  return null
}

/** What the bytes themselves say the file is (M-1 cure): magic numbers
    for PDF and the image kinds, the ZIP family told apart by the entries
    inside it (word/document.xml → DOCX, META-INF/container.xml or an
    EPUB mimetype entry → EPUB), and the opening markup for RTF, FB2 and
    HTML. Returns null when the bytes say nothing definite — the name
    and type then get their say via formatOf. */
export async function sniffFormat(buf: ArrayBuffer): Promise<string | null> {
  const b = new Uint8Array(buf)
  const at = (s: string, off = 0) => { for (let i = 0; i < s.length; i++) if (b[off + i] !== s.charCodeAt(i)) return false; return true }
  if (at('%PDF-')) return 'pdf'
  if (at('\x89PNG') || at('\xff\xd8\xff') || at('GIF8') || at('BM') || (at('RIFF') && at('WEBP', 8))) return 'image'
  if (at('PK\x03\x04')) {
    try {
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(buf)
      const names = Object.keys(zip.files).map((n) => n.toLowerCase())
      if (names.some((n) => n.endsWith('word/document.xml'))) return 'docx'
      if (names.some((n) => n.endsWith('meta-inf/container.xml')) || names.includes('mimetype')) return 'epub'
    } catch { /* not a readable zip: say nothing */ }
    return null
  }
  const head = new TextDecoder('windows-1252').decode(b.subarray(0, 512)).trimStart()
  if (/^\{\\rtf/i.test(head)) return 'rtf'
  if (/^<\?xml[^>]*>\s*<fictionbook/i.test(head) || /^<fictionbook/i.test(head)) return 'fb2'
  if (/^<!doctype\s+html/i.test(head) || /^<html[\s>]/i.test(head)) return 'html'
  return null
}

/** Content fingerprint (M-6): a cyrb53 hash over every block's text. */
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
  for (const c of content.chapters) for (const b of c.blocks) { mix(b.t); mix('\n') }
  return `${(h2 >>> 0).toString(16)}:${(h1 >>> 0).toString(16)}:${content.chapters.reduce((n, c) => n + c.blocks.length, 0)}`
}

/** The book already on the shelf with this exact text, if there is one
    (M-6 cure). Re-importing the same file used to mint a second book —
    and a temp duplicate was worse: playing the new copy let the sweep
    delete the old one with its progress and bookmarks. Books imported
    before fingerprints existed are matched by loading their content and
    hashing it (and the fingerprint is backfilled onto their meta). */
async function existingDuplicate(meta: BookMeta): Promise<BookMeta | null> {
  if (!meta.hash) return null
  if (!books.get().loaded) await refreshBooks()
  for (const cand of books.get().list) {
    if (cand.words !== meta.words) continue
    if (cand.hash) { if (cand.hash === meta.hash) return cand; continue }
    const cc = await getContent(cand.id)
    if (cc && contentHash(cc) === meta.hash) { void updateBook(cand.id, { hash: meta.hash }, false); return cand }
  }
  return null
}

export async function importBook(file: File, batch?: string): Promise<BookMeta> {
  // A machine-named file (a share hash, a camera name) is labelled by what it
  // is, not by the string Android invented for it.
  let shown = isMachineName(file.name) ? 'Shared file' : file.name
  const step = (s: string, done: number, total: number) => books.set({ importing: { name: shown, step: s, done, total, batch } })
  step('Opening', 0, 1)
  try {
    const buf = await file.arrayBuffer()
    // M-1: the bytes get the first say, then MIME, then the name.
    const format = (await sniffFormat(buf)) ?? formatOf(file)
    if (!format) throw new Error(t('{name} isn’t a book file Logos can read.', { name: file.name }))
    if (isMachineName(file.name) && format === 'image') shown = 'Shared image'
    let raw: RawBook
    let decodeWarn: string | undefined
    if (format === 'epub') raw = await (await import('./epub.ts')).parseEpub(buf, step)
    else if (format === 'pdf') raw = await (await import('./pdf.ts')).parsePdf(buf, step)
    else if (format === 'image') raw = await (await import('./image.ts')).parseImage(buf, file, step)
    else {
      const f = await import('./formats.ts')
      if (format === 'docx') raw = await f.parseDocx(buf)
      else {
        // M-2: decode as declared / as the bytes are shaped, and carry
        // any encoding guess onto the book as a warning — never silent.
        const dec = f.decodeTextDetailed(buf)
        decodeWarn = dec.warn
        const text = dec.text
        raw = format === 'fb2' ? await f.parseFb2(text)
          : format === 'html' ? f.parseHtml(text)
          : format === 'rtf' ? f.parseText(f.rtfToText(text), false)
          : f.parseText(text, format === 'md')
      }
    }
    if (decodeWarn) raw.warn = raw.warn ? `${raw.warn} ${decodeWarn}` : decodeWarn
    step('Linking', 1, 1)
    const { meta, content } = finishBook(raw, file, format)
    if (!meta.words) throw new Error(t('No readable text was found in {name}.', { name: file.name }))
    // M-6: the same text already on the shelf IS that book — hand it
    // back instead of minting a twin.
    meta.hash = contentHash(content)
    const dup = await existingDuplicate(meta)
    if (dup) return dup
    await putBook(meta, content)
    return meta
  } finally {
    books.set({ importing: null })
  }
}

/** Files shared into Logos from another app wait in a cache until the app opens. */
export async function takeSharedFiles(): Promise<File[]> {
  if (!new URLSearchParams(location.search).has('sharedfiles')) return []
  history.replaceState(null, '', `${location.pathname}#/library`)
  const droid = (window as unknown as { LogosAndroid?: AndroidBridge }).LogosAndroid
  if (droid?.sharedList) return takeFromAndroid(droid)
  try {
    const cache = await caches.open('logos-share')
    const files: File[] = []
    for (const req of await cache.keys()) {
      if (!req.url.includes('/__share/')) continue
      const res = await cache.match(req)
      if (res) {
        const blob = await res.blob()
        files.push(new File([blob], decodeURIComponent(res.headers.get('x-name') ?? 'book'), { type: res.headers.get('content-type') ?? blob.type }))
      }
      await cache.delete(req)
    }
    return files
  } catch { return [] }
}

type AndroidBridge = { sharedList(): string; sharedChunk(i: number, offset: number, length: number): string; sharedDone(): void }
/** Files shared into the Android app: read from the phone through the app's bridge, 1 MB at a time. */
async function takeFromAndroid(b: AndroidBridge): Promise<File[]> {
  const out: File[] = []
  try {
    const list = JSON.parse(b.sharedList() || '[]') as { name: string; type: string; size: number }[]
    for (let i = 0; i < list.length; i++) {
      const parts: Uint8Array[] = []
      for (let off = 0; ; ) {
        const b64 = b.sharedChunk(i, off, 1 << 20)
        if (!b64) break
        const bin = atob(b64)
        const u = new Uint8Array(bin.length)
        for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k)
        parts.push(u); off += u.length
        if (u.length < 1 << 20) break
        await new Promise((r) => setTimeout(r, 0))
      }
      if (parts.length) out.push(new File(parts as BlobPart[], list[i].name, { type: list[i].type || '' }))
    }
  } catch { /* nothing readable */ }
  try { b.sharedDone() } catch { /* old shell */ }
  return out
}
