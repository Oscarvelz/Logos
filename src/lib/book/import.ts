// Import a book file into the shelf.
import { books, putBook, refreshBooks, getBook, getContent, updateBook, reapOrphanContent, type BookMeta, type BookContent } from '../books.ts'
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
async function existingDuplicate(meta: BookMeta, fresh: BookContent): Promise<{ dup: BookMeta | null; phantoms: BookMeta[] }> {
  if (!meta.hash) return { dup: null, phantoms: [] }
  if (!books.get().loaded) await refreshBooks()
  const legacyHash = legacyContentHash(fresh)
  let dup: BookMeta | null = null
  const phantoms: BookMeta[] = []
  // R4-T3-2 cure: the census NEVER returns early. The old loop crowned
  // the first content-less match (`phantom ??=`) and returned the
  // moment a candidate with content matched — discarding any phantom
  // already crowned, so a second phantom of the same text, and any
  // phantom standing beside a healthy copy, could never be healed by
  // any number of re-imports. Now every candidate is judged: the
  // first healthy match is the duplicate handed back, and EVERY
  // phantom of this text is collected for the heal.
  // R4-T3-3 cure: no word-count gate fronts the fingerprint courts.
  // The stored `words` used to skip a candidate before any hash was
  // compared, so one drifted count (an older build's arithmetic, a
  // damaged meta) hid a phantom from all three courts at once and
  // the re-import minted a twin beside the corpse. A fingerprint
  // match — either formula — is judged on the fingerprint alone.
  // The word count survives only as a cost filter for the recompute
  // court over hashed strangers (below), where it can hide nothing a
  // fingerprint could have named.
  for (const cand of books.get().list) {
    if (cand.hash && cand.hash === meta.hash) {
      const cc = await getContent(cand.id)
      if (cc) { dup ??= cand } else phantoms.push(cand)
      continue
    }
    if (cand.hash && cand.hash === legacyHash) {
      // R3-T3-6: a phantom wearing a PRE-190 fingerprint is recognised
      // by no other branch — the recompute court cannot sit for it
      // (the content it would recompute FROM is exactly what a
      // phantom has lost) and its stored hash can never equal the
      // fresh one. The legacy court is the strongest evidence a
      // content-less record can offer: the FRESH text, hashed by the
      // old formula, against the candidate's stored hash. A match
      // names the same book in its old fingerprint, and the heal
      // gives it the text back under its own id, new fingerprint
      // included. With content present, the recompute court judges
      // instead — the content itself outranks any stored fingerprint.
      const cc = await getContent(cand.id)
      if (cc) {
        if (contentHash(cc) === meta.hash) { void updateBook(cand.id, { hash: meta.hash }, false); dup ??= cand }
      } else phantoms.push(cand)
      continue
    }
    // No fingerprint — or one minted before the fingerprint learned
    // chapter structure (R2-T3-8): a stored hash from the old formula
    // can never equal a new one, so the stored value alone must not
    // be allowed to wave the candidate past. The content itself is
    // the court of appeal: recompute with the current formula, and
    // a match backfills the new fingerprint onto the candidate, so
    // the fast path works for it from then on. A fingerprint-less
    // candidate is judged here with NO word gate (that population
    // is legacy and shrinking); a hashed stranger keeps the word
    // count as a mere cost filter before its content is loaded.
    // Declared bound: a content-less record carrying NO fingerprint
    // at all holds no evidence of its text — no court can name it,
    // and none ever could.
    if (cand.hash && cand.words !== meta.words) continue
    const cc = await getContent(cand.id)
    if (cc && contentHash(cc) === meta.hash) { void updateBook(cand.id, { hash: meta.hash }, false); dup ??= cand }
  }
  return { dup, phantoms }
}

/** The fingerprint formula as it stood before 1.4.190 taught it
    chapter structure (R2-T3-8): the same cyrb64 pair over the blocks
    alone, in order, with no chapter-boundary mixes. It survives only
    as the legacy court in existingDuplicate — never for new records:
    one generation of stored hashes was minted by it, and a phantom
    carrying one can be recognised no other way (R3-T3-6). */
function legacyContentHash(content: BookContent): string {
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

/** One import's census-and-write at a time (R4-T3-5): a simple
    promise chain every importBook queues its verdict phase behind.
    The tail never rejects, so one failed import cannot wedge the
    imports behind it. */
let importWriteTail: Promise<unknown> = Promise.resolve()
function withImportWriteLock<T>(job: () => Promise<T>): Promise<T> {
  const run = importWriteTail.then(job, job)
  importWriteTail = run.then(() => undefined, () => undefined)
  return run
}

/** Heal one phantom under its own id (R2-T3-4): the fresh content
    lands in the record that kept the reader's place, progress,
    bookmarks and cover, instead of a twin minting beside it.
    R4-T3-1 cure: the preserved fields and the cover are read from
    the phantom's FULL record (getBook), never from the census's
    candidate — the list carries the blob-free bookmeta twin (M-11),
    whose cover is undefined BY CONSTRUCTION, so the old heal's
    `meta.cover ?? phantom.cover` stripped the surviving cover from
    any book re-imported in a coverless format. R4-T3-4 cure: the
    healed book lands `temp: false` — a re-import is a deliberate
    recovery deed, and the backup door ruled the same deed a keeping
    (L-4: a restore lands temp:false); the old heal preserved
    temp:true verbatim and the next sweep deleted the just-recovered
    book. R3-T3-5: the content is re-keyed WITH the meta (putBook
    stores content by its own keyPath id) — the healed book's
    content lives under the healed book's id, or the heal did not
    happen. Returns null when the record vanished between the census
    and the heal: nothing left to heal. */
async function healPhantom(phantom: BookMeta, meta: BookMeta, content: BookContent): Promise<BookMeta | null> {
  const full = await getBook(phantom.id)
  if (!full) return null
  const healed: BookMeta = {
    ...meta,
    id: full.id,
    addedAt: full.addedAt,
    openedAt: full.openedAt,
    pos: full.pos,
    progress: full.progress,
    done: full.done,
    bookmarks: full.bookmarks,
    fav: full.fav,
    temp: false,
    cover: meta.cover ?? full.cover,
  }
  await putBook(healed, { ...content, id: full.id })
  return healed
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
    // R4-T3-5 cure: dedupe is check-then-act across awaits, so two
    // imports of the same file in flight at once (share-intake's
    // importMany fired from a mount effect, racing the reader's own
    // pick of the same file — importMany itself sequences a batch
    // but nothing guarded re-entry) both passed the check before
    // either write landed, and each minted its own id: identical
    // twins the per-book write queue cannot merge, since the twins
    // take different chains. The census-and-write phase now runs
    // under one import lock: a second import of the same text
    // re-judges the shelf AFTER the first import's write has landed
    // and finds the duplicate (or the phantom) waiting. Parsing
    // stays outside the lock — only the verdict and the write are
    // serialised.
    return await withImportWriteLock(async () => {
      const { dup, phantoms } = await existingDuplicate(meta, content)
      let landed: BookMeta | null = dup
      // R4-T3-2: heal EVERY phantom of this text, each under its own
      // id — beside a healthy copy too (the copy is what comes back;
      // the corpses are healed on the way past).
      for (const phantom of phantoms) {
        const healed = await healPhantom(phantom, meta, content)
        if (healed && !landed) landed = healed
      }
      if (!landed) {
        await putBook(meta, content)
        landed = meta
      }
      // R4-T3-6: an import that just proved what this text is also
      // reaps the content rows no book owns (the pre-fix heal's
      // orphans). Hygiene only — a failure here never fails an import.
      try { await reapOrphanContent() } catch { /* a missed reap is a leak, never a loss */ }
      return landed
    })
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
