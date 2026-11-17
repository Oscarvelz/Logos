// Import a book file into the shelf.
import { books, putBook, refreshBooks, getContent, updateBook, type BookMeta } from '../books.ts'
import { t } from '../i18n.ts'
import { finishBook, isMachineName, type RawBook } from './finish.ts'
import { sniffFormat, contentHash } from './sniff.ts'

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

/* sniffFormat and contentHash live in ./sniff.ts (extracted in
   1.4.190 so the real functions are probeable — this module's chain
   reaches pdf.ts's `?url` worker import, which the test runner
   cannot load) and are re-exported here unchanged in surface. */
export { sniffFormat, contentHash } from './sniff.ts'

/** The book already on the shelf with this exact text, if there is one
    (M-6 cure). Re-importing the same file used to mint a second book —
    and a temp duplicate was worse: playing the new copy let the sweep
    delete the old one with its progress and bookmarks. Books imported
    before fingerprints existed are matched by loading their content and
    hashing it (and the fingerprint is backfilled onto their meta).
    R2-T3-4: a hash match is only a duplicate when the candidate's
    CONTENT is still there. The hashed path used to return the candidate
    unchecked, so a meta-only phantom (content lost to a partial failure
    or a quota casualty) trapped every re-import of its file forever —
    the one self-healing move a user has was refused by the cure. A
    phantom is reported separately, and the import heals it under its
    own id, keeping its place, progress and marks. */
async function existingDuplicate(meta: BookMeta): Promise<{ dup: BookMeta | null; phantom: BookMeta | null }> {
  if (!meta.hash) return { dup: null, phantom: null }
  if (!books.get().loaded) await refreshBooks()
  let phantom: BookMeta | null = null
  for (const cand of books.get().list) {
    if (cand.words !== meta.words) continue
    if (cand.hash && cand.hash === meta.hash) {
      const cc = await getContent(cand.id)
      if (cc) return { dup: cand, phantom: null }
      phantom ??= cand
      continue
    }
    // No fingerprint — or one minted before the fingerprint learned
    // chapter structure (R2-T3-8): a stored hash from the old formula
    // can never equal a new one, so the stored value alone must not
    // be allowed to wave the candidate past. The content itself is
    // the court of appeal: recompute with the current formula, and
    // a match backfills the new fingerprint onto the candidate, so
    // the fast path works for it from then on.
    const cc = await getContent(cand.id)
    if (cc && contentHash(cc) === meta.hash) { void updateBook(cand.id, { hash: meta.hash }, false); return { dup: cand, phantom: null } }
  }
  return { dup: null, phantom }
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
    const { dup, phantom } = await existingDuplicate(meta)
    if (dup) return dup
    if (phantom) {
      // R2-T3-4: heal the phantom under its own id — the fresh content
      // lands in the record that kept the reader's place, progress,
      // bookmarks and cover, instead of a twin minting beside it.
      const healed: BookMeta = {
        ...meta,
        id: phantom.id,
        addedAt: phantom.addedAt,
        openedAt: phantom.openedAt,
        pos: phantom.pos,
        progress: phantom.progress,
        done: phantom.done,
        bookmarks: phantom.bookmarks,
        fav: phantom.fav,
        temp: phantom.temp,
        cover: meta.cover ?? phantom.cover,
      }
      await putBook(healed, content)
      return healed
    }
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
