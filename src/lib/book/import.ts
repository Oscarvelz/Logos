// Import a book file into the shelf.
import { books, putBook, type BookMeta } from '../books.ts'
import { finishBook, type RawBook } from './finish.ts'

export const BOOK_ACCEPT = '.epub,.pdf,.docx,.fb2,.txt,.md,.markdown,.html,.htm,.xhtml,.rtf,application/epub+zip,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/html,application/rtf'

export function formatOf(file: File): string | null {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  if (ext === 'markdown') return 'md'
  if (ext === 'htm' || ext === 'xhtml') return 'html'
  if (['epub', 'pdf', 'docx', 'fb2', 'txt', 'md', 'html', 'rtf'].includes(ext)) return ext
  if (file.type === 'application/pdf') return 'pdf'
  if (file.type === 'application/epub+zip') return 'epub'
  if (file.type.startsWith('text/')) return 'txt'
  if (/^(mobi|azw3?|kfx|djvu|doc|odt|pages|cbz|cbr)$/.test(ext)) throw new Error(`${ext.toUpperCase()} files can’t be read yet. Save it as EPUB or PDF and import that.`)
  return null
}

export async function importBook(file: File, batch?: string): Promise<BookMeta> {
  const format = formatOf(file)
  if (!format) throw new Error(`${file.name} isn’t a book file Logos can read.`)
  const step = (s: string, done: number, total: number) => books.set({ importing: { name: file.name, step: s, done, total, batch } })
  step('Opening', 0, 1)
  try {
    const buf = await file.arrayBuffer()
    let raw: RawBook
    if (format === 'epub') raw = await (await import('./epub.ts')).parseEpub(buf, step)
    else if (format === 'pdf') raw = await (await import('./pdf.ts')).parsePdf(buf, step)
    else {
      const f = await import('./formats.ts')
      if (format === 'docx') raw = await f.parseDocx(buf)
      else {
        const text = f.decodeText(buf)
        raw = format === 'fb2' ? await f.parseFb2(text)
          : format === 'html' ? f.parseHtml(text)
          : format === 'rtf' ? f.parseText(f.rtfToText(text), false)
          : f.parseText(text, format === 'md')
      }
    }
    step('Linking', 1, 1)
    const { meta, content } = finishBook(raw, file, format)
    if (!meta.words) throw new Error(`No readable text was found in ${file.name}.`)
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
