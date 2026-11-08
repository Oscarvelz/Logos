// The library's safety net (Oscar's ask, 2026-11-08): one file that carries
// the irreplaceable things — books with their content and progress, reading
// bookmarks, Listen marks, the pronunciation dictionary, drafts and settings.
// Audio clips are NOT in it on purpose: they can always be re-made from the
// books and texts that are.
import { books, refreshBooks, getContent, putBook, type BookMeta, type BookContent } from './books.ts'
import { settings } from './settings.ts'
import { drafts } from './drafts.ts'
import { pronEntries, savePronEntries, type PronEntry } from './pronounce.ts'
import { loadMarks, mergeMarks } from './marks.ts'
import { downloadBlob } from './audio.ts'

type BackupFile = {
  app: 'logos'
  version: 1
  at: number
  settings: Record<string, unknown>
  pronounce: PronEntry[]
  marks: ReturnType<typeof loadMarks>
  drafts: { listen: string }
  books: { meta: BookMeta & { coverB64?: string }; content: unknown }[]
}

const blobToB64 = (b: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader()
  r.onload = () => res(String(r.result))
  r.onerror = () => rej(new Error('cover read failed'))
  r.readAsDataURL(b)
})

export async function exportBackup(): Promise<number> {
  await refreshBooks()
  const out: BackupFile = {
    app: 'logos', version: 1, at: Date.now(),
    settings: { ...settings.get() },
    pronounce: pronEntries(),
    marks: loadMarks(),
    drafts: { listen: drafts.get().listen },
    books: [],
  }
  for (const m of books.get().list) {
    const content = await getContent(m.id)
    if (!content) continue
    const meta = { ...m } as BookMeta & { coverB64?: string }
    if (m.cover) { try { meta.coverB64 = await blobToB64(m.cover) } catch { /* cover is decoration */ } }
    delete (meta as { cover?: Blob }).cover
    out.books.push({ meta, content })
  }
  const blob = new Blob([JSON.stringify(out)], { type: 'application/json' })
  const name = `logos-backup-${new Date().toISOString().slice(0, 10)}.json`
  const file = new File([blob], name, { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Logos backup' }); return out.books.length } catch { /* cancelled */ }
  }
  downloadBlob(blob, name, true)
  return out.books.length
}

export async function importBackup(file: File): Promise<number> {
  const data = JSON.parse(await file.text()) as BackupFile
  if (data.app !== 'logos' || !Array.isArray(data.books)) throw new Error('Not a Logos backup')
  let n = 0
  for (const b of data.books) {
    const meta = { ...b.meta } as BookMeta & { coverB64?: string }
    if (meta.coverB64) {
      try { meta.cover = await (await fetch(meta.coverB64)).blob() } catch { /* no cover */ }
      delete meta.coverB64
    }
    await putBook(meta as BookMeta, b.content as BookContent)
    n++
  }
  if (data.pronounce?.length) {
    const have = new Set(pronEntries().map((e) => e.from.toLowerCase()))
    savePronEntries([...pronEntries(), ...data.pronounce.filter((e) => !have.has(e.from.toLowerCase()))])
  }
  if (data.marks?.length) mergeMarks(data.marks)
  if (data.drafts?.listen && !drafts.get().listen.trim()) drafts.set({ listen: data.drafts.listen })
  await refreshBooks()
  return n
}
