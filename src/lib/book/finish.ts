// Shared last steps for every format: split into chapters, resolve links, build
// the contents, add links Logos finds on its own, and count words.
import type { Block, BookContent, BookMeta, Chapter, Pos, TocEntry } from '../books.ts'
import { wordsIn } from '../books.ts'
import { detectLang } from '../text.ts'

export type RawChapter = { title?: string; blocks: Block[]; gen?: boolean }
export type RawToc = { title: string; level: number; to: string }
export type RawBook = {
  title?: string
  /** A weaker guess (the first big line), used only when the file name says nothing. */
  titleGuess?: string
  author?: string
  lang?: string
  cover?: Blob
  pages?: number
  chapters: RawChapter[]
  anchors: Map<string, Pos>
  toc?: RawToc[]
  /** Printed page number → PDF page, read from the page numbers on each page. */
  printed?: Map<number, number>
}

const HEAD = (k: string) => k === 'h1' || k === 'h2' || k === 'h3'

/** Split one long run of blocks into chapters at its biggest headings. */
export function chapterize(blocks: Block[], given?: { at: number; title?: string }[]): { chapters: RawChapter[]; locate: (i: number) => Pos } {
  let bounds = given?.filter((x) => x.at >= 0 && x.at < blocks.length) ?? []
  if (!given) {
    for (const k of ['h1', 'h2'] as const) {
      const at = blocks.map((b, i) => (b.k === k ? i : -1)).filter((i) => i >= 0)
      // Drop headings that follow each other with nothing between (a title over a subtitle).
      const firstOf = at.filter((i, n) => n === 0 || blocks.slice(at[n - 1] + 1, i).some((b) => !HEAD(b.k)))
      if (firstOf.length >= 2 && firstOf.length <= 600) { bounds = firstOf.map((i) => ({ at: i })); break }
    }
    if (!bounds.length && blocks.length > 360) {
      const gen: { at: number; title?: string }[] = []
      for (let i = 0; i < blocks.length; i += 180) gen.push({ at: i, title: `Section ${gen.length + 1}` })
      bounds = gen
    }
  }
  bounds = bounds.sort((a, b) => a.at - b.at).filter((x, i, a) => i === 0 || x.at !== a[i - 1].at)
  if (!bounds.length || bounds[0].at > 0) bounds.unshift({ at: 0, title: bounds.length ? 'Opening pages' : undefined })
  const chapters: RawChapter[] = bounds.map((x, i) => ({ title: x.title, gen: !!x.title && /^(Section \d+|Opening pages)$/.test(x.title), blocks: blocks.slice(x.at, bounds[i + 1]?.at ?? blocks.length) }))
  const starts = bounds.map((x) => x.at)
  const locate = (i: number): Pos => {
    let lo = 0, hi = starts.length - 1
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= i) lo = m; else hi = m - 1 }
    return { ch: lo, b: Math.max(0, i - starts[lo]) }
  }
  return { chapters, locate }
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const norm = (s: string) => fold(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const firstLine = (t: string) => t.split('\n')[0].trim()

const ROMAN: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 }
const WORDNUM: Record<string, number> = {
  uno: 1, una: 1, primero: 1, primera: 1, dos: 2, segundo: 2, segunda: 2, tres: 3, tercero: 3, tercera: 3, cuatro: 4, cuarto: 4, cuarta: 4,
  cinco: 5, quinto: 5, quinta: 5, seis: 6, sexto: 6, sexta: 6, siete: 7, septimo: 7, septima: 7, ocho: 8, octavo: 8, octava: 8,
  nueve: 9, noveno: 9, novena: 9, diez: 10, decimo: 10, decima: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  one: 1, first: 1, two: 2, second: 2, three: 3, third: 3, four: 4, fourth: 4, five: 5, fifth: 5, six: 6, sixth: 6, seven: 7, seventh: 7,
  eight: 8, eighth: 8, nine: 9, ninth: 9, ten: 10, tenth: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
}
function numOf(s: string): number | null {
  const w = fold(s)
  if (/^\d+$/.test(w)) return parseInt(w, 10)
  if (WORDNUM[w]) return WORDNUM[w]
  if (/^[ivxlcdm]+$/.test(w)) {
    let n = 0
    for (let i = 0; i < w.length; i++) { const v = ROMAN[w[i]], nx = ROMAN[w[i + 1]] ?? 0; n += v < nx ? -v : v }
    return n > 0 && n < 4000 ? n : null
  }
  return null
}
const GROUPS: [RegExp, string][] = [
  [/^(capitulo|chapter|cap)$/, 'ch'], [/^(parte|part)$/, 'part'], [/^(libro|book)$/, 'book'], [/^canto$/, 'canto'],
  [/^(acto|act)$/, 'act'], [/^(leccion|lesson)$/, 'lesson'], [/^tema$/, 'tema'], [/^(unidad|unit)$/, 'unit'], [/^(seccion|section)$/, 'sec'],
]
const groupOf = (w: string) => GROUPS.find(([r]) => r.test(fold(w)))?.[1] ?? null
const NUM = String.raw`(\d{1,3}|[IVXLCDM]{1,7}|[A-Za-zÁÉÍÓÚáéíóú]{3,9})`
const REF_WORDS = String.raw`cap[ií]tulos?|chapters?|parte|part|libro|book|canto|acto|act|lecci[oó]n|lesson|tema|unidad|unit|secci[oó]n|section`
const HEAD_RE = new RegExp(String.raw`^(${REF_WORDS})\s+${NUM}\b`, 'iu')
const REF_RE = new RegExp(String.raw`\b(${REF_WORDS})\s+${NUM}\b`, 'giu')
const PAGE_RE = /\b(p[áa]gs?\.|p[áa]ginas?|pages?|pp?\.)\s*(\d{1,4})\b/giu

const overlaps = (b: Block, s: number, e: number) => b.l?.some((x) => x.s < e && x.e > s) ?? false
const addLink = (b: Block, s: number, e: number, to: string) => { (b.l ??= []).push({ s, e, to }); b.l.sort((x, y) => x.s - y.s) }

/** "James, William, 1842-1910" → "William James". */
function tidyAuthor(a: string): string {
  const t = a.trim().replace(/\s+/g, ' ')
  const m = /^([^,;]+),\s*([^,;\d]+?)(?:,\s*[\d\s?.\-–]+)?\.?$/.exec(t)
  if (!m || m[1].trim().split(' ').length > 2 || /\b(and|y)\b|&/i.test(t)) return t
  return `${m[2].trim()} ${m[1].trim()}`
}

export function finishBook(raw: RawBook, file: File, format: string): { meta: BookMeta; content: BookContent } {
  const chapters: Chapter[] = raw.chapters.filter((c) => c.blocks.length).map((c, i) => {
    const head = c.blocks.slice(0, 4).find((b) => HEAD(b.k))
    const title = (c.title?.trim() || (head ? firstLine(head.t).replace(/\s+/g, ' ') : '') || `Section ${i + 1}`).slice(0, 400)
    return { title, blocks: c.blocks }
  })
  // Chapters dropped above for being empty shift the indexes anchors were made with.
  const kept = raw.chapters.map((c) => c.blocks.length > 0)
  const shift: number[] = []
  let n = 0
  kept.forEach((k, i) => { shift[i] = n; if (k) n++ })
  const fix = (p: Pos): Pos => ({ ch: Math.min(Math.max(0, chapters.length - 1), shift[p.ch] ?? chapters.length - 1), b: kept[p.ch] ? p.b : 0 })
  const generated = new Set(raw.chapters.filter((c) => c.blocks.length).map((c, i) => (c.gen ? i : -1)).filter((i) => i >= 0))

  // PDF pages → the first block printed on them.
  const pageFirst = new Map<number, Pos>()
  chapters.forEach((c, ch) => c.blocks.forEach((b, i) => { if (b.pg && !pageFirst.has(b.pg)) pageFirst.set(b.pg, { ch, b: i }) }))
  const pageKeys = [...pageFirst.keys()].sort((a, b) => a - b)
  const pagePos = (p: number): Pos | null => { const k = pageKeys.find((x) => x >= p); return k ? pageFirst.get(k)! : null }

  const resolve = (to: string): Pos | string | null => {
    if (to.startsWith('x:')) {
      const key = to.slice(2)
      const hit = raw.anchors.get(key) ?? raw.anchors.get(key.split('#')[0])
      return hit ? fix(hit) : null
    }
    if (to.startsWith('p:')) return pagePos(parseInt(to.slice(2), 10))
    if (/^https?:|^mailto:/i.test(to)) return to
    return null
  }
  const asTo = (r: Pos | string) => (typeof r === 'string' ? r : `${r.ch}:${r.b}`)
  for (const c of chapters) for (const b of c.blocks) {
    if (!b.l) continue
    b.l = b.l.map((x) => { const r = resolve(x.to); return r ? { ...x, to: asTo(r) } : null }).filter((x): x is NonNullable<typeof x> => !!x)
    if (!b.l.length) delete b.l
  }

  // Contents: the book's own, or one built from its headings.
  let toc: TocEntry[] = []
  if (raw.toc?.length) {
    for (const t of raw.toc) {
      const r = resolve(t.to)
      if (r && typeof r !== 'string' && t.title.trim()) toc.push({ title: t.title.trim().replace(/\s+/g, ' ').slice(0, 400), level: Math.min(3, t.level), ch: r.ch, b: r.b })
    }
  }
  if (toc.length < 2) {
    toc = []
    const inner = chapters.reduce((n, c) => n + c.blocks.filter((b) => HEAD(b.k)).length, 0) < 700
    chapters.forEach((c, ch) => {
      toc.push({ title: c.title, level: 0, ch, b: 0 })
      if (!inner) return
      c.blocks.forEach((b, i) => {
        if (i < 3 || (b.k !== 'h2' && b.k !== 'h3')) return
        toc.push({ title: firstLine(b.t).slice(0, 160), level: b.k === 'h2' ? 1 : 2, ch, b: i })
      })
    })
  }

  // Links Logos adds: the book's own contents page, "chapter 4" mentions, "page 37" mentions.
  const order = (p: Pos) => p.ch * 1e6 + p.b
  const titles = new Map<string, Pos>()
  for (const t of toc) { const k = norm(t.title); if (k.length >= 4 && !titles.has(k)) titles.set(k, { ch: t.ch, b: t.b }) }
  chapters.forEach((c, ch) => { if (!generated.has(ch)) { const k = norm(c.title); if (k.length >= 4 && !titles.has(k)) titles.set(k, { ch, b: 0 }) } })
  const refs = new Map<string, Pos>()
  const noteRef = (text: string, p: Pos) => {
    const m = HEAD_RE.exec(firstLine(text))
    if (!m) return
    const g = groupOf(m[1].replace(/s$/i, '')), v = numOf(m[2])
    if (g && v && !refs.has(`${g}:${v}`)) refs.set(`${g}:${v}`, p)
  }
  chapters.forEach((c, ch) => {
    if (!generated.has(ch)) noteRef(c.title, { ch, b: 0 })
    c.blocks.forEach((b, i) => { if (HEAD(b.k)) noteRef(b.t, { ch, b: i }) })
  })
  const totalBlocks = chapters.reduce((s, c) => s + c.blocks.length, 0)
  let seen = 0
  chapters.forEach((c, ch) => {
    const contentsPage = /\b(contents|indice|contenido|contenidos|sumario|table of contents|tabla de contenido)\b/.test(norm(c.title))
    c.blocks.forEach((b, i) => {
      seen++
      const here = { ch, b: i }
      if (HEAD(b.k) && !contentsPage) return
      // 1. Lines of a contents page that name a chapter.
      if ((contentsPage || seen < totalBlocks * 0.15) && b.t.length < 2400) {
        let off = 0
        for (const line of b.t.split('\n')) {
          const stripped = line.replace(/[\s.·…_\-–]*\b\d{1,4}\s*$/u, '').trimEnd()
          const lead = stripped.length - stripped.trimStart().length
          const target = stripped.length < 160 ? titles.get(norm(stripped)) : undefined
          if (target && order(target) > order(here) && !overlaps(b, off + lead, off + stripped.length)) addLink(b, off + lead, off + stripped.length, `${target.ch}:${target.b}`)
          off += line.length + 1
        }
      }
      // 2. "chapter 4", "capítulo IV", "segunda parte"…
      if (refs.size) {
        for (const m of b.t.matchAll(REF_RE)) {
          const g = groupOf(m[1].replace(/s$/i, '')), v = numOf(m[2])
          const target = g && v ? refs.get(`${g}:${v}`) : undefined
          const s = m.index!, e = s + m[0].length
          if (target && !(target.ch === ch && Math.abs(target.b - i) < 2) && !overlaps(b, s, e)) addLink(b, s, e, `${target.ch}:${target.b}`)
        }
      }
      // 3. "page 37" / "pág. 37" in PDFs whose printed page numbers Logos read.
      if (raw.printed && raw.printed.size >= 3) {
        for (const m of b.t.matchAll(PAGE_RE)) {
          const pdfPage = raw.printed.get(parseInt(m[2], 10))
          const target = pdfPage ? pagePos(pdfPage) : null
          const s = m.index!, e = s + m[0].length
          if (target && !(target.ch === ch && target.b === i) && !overlaps(b, s, e)) addLink(b, s, e, `${target.ch}:${target.b}`)
        }
      }
    })
  })

  const chWords = chapters.map((c) => c.blocks.reduce((s, b) => s + wordsIn(b.t), 0))
  const words = chWords.reduce((a, b) => a + b, 0)
  const links = chapters.reduce((s, c) => s + c.blocks.reduce((t, b) => t + (b.l?.filter((x) => /^\d+:\d+$/.test(x.to)).length ?? 0), 0), 0)
  const sample = chapters.flatMap((c) => c.blocks).slice(0, 400).map((b) => b.t).join(' ').slice(0, 6000)
  const fileTitle = file.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim()
  const id = crypto.randomUUID?.() ?? String(Date.now())
  const meta: BookMeta = {
    id,
    title: (raw.title?.trim() || (/\p{L}{3,}\s+\S*\p{L}{3,}/u.test(fileTitle) && !/^(scan|img|doc|book|file|download)[\s\d-]*$/i.test(fileTitle) ? fileTitle : '') || raw.titleGuess?.trim() || fileTitle || 'Untitled').slice(0, 200),
    author: tidyAuthor(raw.author ?? '').slice(0, 160),
    format,
    lang: /^(en|es)/i.test(raw.lang ?? '') ? raw.lang!.slice(0, 2).toLowerCase() : detectLang(sample).lang,
    addedAt: Date.now(),
    pos: { ch: 0, b: 0 },
    progress: 0,
    words,
    chWords,
    toc,
    links,
    cover: raw.cover,
    size: file.size,
    pages: raw.pages,
  }
  return { meta, content: { id, chapters } }
}
