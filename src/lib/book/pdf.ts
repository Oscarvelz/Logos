// PDF: rebuilds paragraphs and headings from the text layer, drops running heads
// and page numbers, keeps the outline and the PDF's own links.
import type { Block } from '../books.ts'
import { chapterize, type RawBook, type RawToc } from './finish.ts'

type Item = { s: number; e: number; x0: number; x1: number }
type Line = { text: string; x: number; xEnd: number; y: number; h: number; items: Item[]; page: number; bi?: number; off?: number }
type Annot = { page: number; rect: number[]; to: string }

const TERMINAL = /[.!?:;…»”"')\]]$/
const median = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }

export async function parsePdf(buf: ArrayBuffer, step: (s: string, done: number, total: number) => void): Promise<RawBook> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const worker = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const task = pdfjs.getDocument({ data: new Uint8Array(buf), cMapUrl: `${import.meta.env.BASE_URL}pdfjs/cmaps/`, cMapPacked: true })
  const doc = await task.promise
  const N = doc.numPages
  const meta = await doc.getMetadata().catch(() => null)
  const info = (meta?.info ?? {}) as { Title?: string; Author?: string; Language?: string }

  const destPage = async (dest: unknown): Promise<number | null> => {
    try {
      const d = typeof dest === 'string' ? await doc.getDestination(dest) : dest
      if (!Array.isArray(d) || d[0] == null) return null
      const ref = d[0]
      return (typeof ref === 'number' ? ref : await doc.getPageIndex(ref)) + 1
    } catch { return null }
  }

  const pages: Line[][] = []
  const annots: Annot[] = []
  for (let p = 1; p <= N; p++) {
    step('Reading pages', p - 1, N)
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    const lines: Line[] = []
    let cur: Line | null = null
    let lastEol = false
    for (const raw of tc.items) {
      if (!('str' in raw)) continue
      const it = raw as { str: string; transform: number[]; width: number; height: number; hasEOL?: boolean }
      const x = it.transform[4], y = it.transform[5]
      const h = Math.abs(it.transform[3]) || Math.hypot(it.transform[2], it.transform[3]) || it.height || 10
      if (!it.str) { if (it.hasEOL) lastEol = true; continue }
      if (Math.abs(it.transform[1]) > 0.01 || Math.abs(it.transform[2]) > 0.01) continue   // rotated margin text
      const newLine = !cur || lastEol || Math.abs(y - cur.y) > Math.max(cur.h, h) * 0.55 || x < cur.xEnd - h * 4
      if (newLine) {
        if (cur && cur.text.trim()) lines.push(cur)
        cur = { text: '', x, xEnd: x, y, h, items: [], page: p }
      }
      const c = cur!
      if (c.text && !/\s$/.test(c.text) && !/^\s/.test(it.str) && x - c.xEnd > h * 0.12) c.text += ' '
      const s = c.text.length
      c.text += it.str
      c.items.push({ s, e: c.text.length, x0: x, x1: x + it.width })
      c.xEnd = Math.max(c.xEnd, x + it.width)
      c.h = Math.max(c.h, h)
      lastEol = !!it.hasEOL
    }
    if (cur && cur.text.trim()) lines.push(cur)
    for (const l of lines) { const lead = l.text.length - l.text.trimStart().length; l.text = l.text.trim(); if (lead) l.items.forEach((i) => { i.s = Math.max(0, i.s - lead); i.e = Math.max(0, i.e - lead) }) }
    pages.push(lines)
    try {
      for (const a of await page.getAnnotations()) {
        if (a.subtype !== 'Link' || !a.rect) continue
        if (a.url) annots.push({ page: p, rect: a.rect, to: a.url })
        else if (a.dest) { const t = await destPage(a.dest); if (t) annots.push({ page: p, rect: a.rect, to: `p:${t}` }) }
      }
    } catch { /* links are a bonus */ }
    page.cleanup()
  }

  const all = pages.flat()
  const chars = all.reduce((n, l) => n + l.text.length, 0)
  if (chars < Math.max(200, N * 40)) throw new Error('This PDF is scanned pictures of pages, so it has no text to read.')

  // Running heads and feet: the same words at the top or bottom of many pages. Page numbers: read, then dropped.
  const printed = new Map<number, number>()
  const edgeCount = new Map<string, number>()
  const edgeKey = (t: string) => t.replace(/\d+/g, '#').replace(/\s+/g, ' ').toLowerCase()
  for (const lines of pages) {
    const edge = new Set([...lines.slice(0, 2), ...lines.slice(-2)].map((l) => edgeKey(l.text)))
    edge.forEach((k) => edgeCount.set(k, (edgeCount.get(k) ?? 0) + 1))
  }
  const repeated = (t: string) => N >= 4 && (edgeCount.get(edgeKey(t)) ?? 0) >= Math.max(3, N * 0.25)
  pages.forEach((lines, i) => {
    const edges = new Set([...lines.slice(0, 2), ...lines.slice(-2)])
    pages[i] = lines.filter((l) => {
      if (!edges.has(l)) return true
      const num = /^(?:[-–—]\s*)?(?:p[áa]g(?:ina)?\.?\s*|page\s*)?(\d{1,4})(?:\s*[-–—])?$/i.exec(l.text) ?? /(?:^|\s)(\d{1,4})$/.exec(l.text)
      if (num && (l.text.length < 8 || repeated(l.text))) { const n = parseInt(num[1], 10); if (!printed.has(n)) printed.set(n, i + 1) }
      if (/^[-–—]?\s*\d{1,4}\s*[-–—]?$/.test(l.text) || /^[ivxlcdm]{1,6}$/i.test(l.text)) return false
      return !repeated(l.text)
    })
  })

  const flat = pages.flat()
  const body = median(flat.flatMap((l) => (l.text.length > 30 ? [l.h] : []))) || median(flat.map((l) => l.h)) || 10
  const gaps: number[] = []
  for (const lines of pages) for (let i = 1; i < lines.length; i++) { const g = lines[i - 1].y - lines[i].y; if (g > 0 && Math.abs(lines[i].h - body) < body * 0.2) gaps.push(g) }
  const lineGap = median(gaps) || body * 1.3

  const blocks: Block[] = []
  let para: Block | null = null
  let prev: Line | null = null
  const closePara = () => { para = null }
  for (const lines of pages) {
    const left = median(lines.map((l) => l.x))
    const right = Math.max(...lines.map((l) => l.xEnd), left + 1)
    const width = right - left
    lines.forEach((l, li) => {
      const numbered = /^(\d{1,2}(?:\.\d{1,2}){0,2})\.?\s+\p{Lu}[^.!?]{1,70}$/u.exec(l.text)
      const gapAbove = prev && prev.page === l.page ? prev.y - l.y : lineGap * 2
      const big = (l.h >= body * 1.22 && l.text.length < 140 && /[\p{L}]/u.test(l.text)) || (!!numbered && gapAbove > lineGap * 1.25 && l.xEnd < left + width * 0.75)
      if (big) {
        const last = blocks[blocks.length - 1]
        const depth = numbered ? numbered[1].split('.').length : 0
        const k = l.h >= body * 1.6 ? 'h1' : depth >= 3 ? 'h3' : depth === 2 ? 'h3' : 'h2'
        if (last && last.k === k && prev && prev.page === l.page && prev.y - l.y < l.h * 2 && !para) {
          l.bi = blocks.length - 1; l.off = last.t.length + 1; last.t += ' ' + l.text
        } else { l.bi = blocks.length; l.off = 0; blocks.push({ k, t: l.text, pg: l.page }) }
        closePara(); prev = l; return
      }
      let fresh = !para
      if (para && prev) {
        const samePage = prev.page === l.page
        const gap = samePage ? prev.y - l.y : lineGap
        const prevShort = prev.xEnd < left + width * 0.82
        const indented = l.x > left + body * 0.9 && l.x < left + width * 0.35
        if (samePage && gap > lineGap * 1.5) fresh = true
        else if (TERMINAL.test(prev.text) && (prevShort || indented)) fresh = true
        else if (!samePage && li === 0 && TERMINAL.test(prev.text) && /^[\p{Lu}\d"“«¿¡—–-]/u.test(l.text)) fresh = true
      }
      if (fresh) { para = { k: 'p', t: l.text, pg: l.page }; blocks.push(para); l.bi = blocks.length - 1; l.off = 0 }
      else {
        const p = para!
        if (/[\p{L}]-$/u.test(p.t) && /^\p{Ll}/u.test(l.text)) { p.t = p.t.slice(0, -1); l.off = p.t.length }
        else { p.t += ' '; l.off = p.t.length }
        p.t += l.text
        l.bi = blocks.length - 1
      }
      prev = l
    })
  }

  // The PDF's own links, placed on the words they cover.
  for (const a of annots) {
    const [x1, y1, x2, y2] = a.rect
    for (const l of pages[a.page - 1] ?? []) {
      if (l.bi == null || l.y < Math.min(y1, y2) - 2 || l.y > Math.max(y1, y2) + 2) continue
      const hit = l.items.filter((i) => i.x1 > x1 + 1 && i.x0 < x2 - 1)
      if (!hit.length) continue
      // Items are often whole lines: place the link inside them by position, then snap to whole words.
      const at = (it: Item, x: number) => it.s + Math.round(Math.max(0, Math.min(1, (x - it.x0) / Math.max(1, it.x1 - it.x0))) * (it.e - it.s))
      const b = blocks[l.bi]
      const stopL = /[\s[(,;]/, stopR = /[\s\]),;.:]/
      const narrow = Math.abs(x2 - x1) < l.h * 3.5
      let s = l.off! + at(hit[0], narrow ? (x1 + x2) / 2 : Math.min(x1, x2)), e = narrow ? s : l.off! + at(hit[hit.length - 1], Math.max(x1, x2))
      if (narrow) { if (stopR.test(b.t[s] ?? ' ') && s > l.off!) s--; if (stopL.test(b.t[s] ?? ' ') && !stopR.test(b.t[s + 1] ?? ' ')) s++; e = s + 1 }
      while (s > l.off! && !stopL.test(b.t[s - 1] ?? ' ')) s--
      while (s < e && /\s/.test(b.t[s])) s++
      while (e < b.t.length && !stopR.test(b.t[e])) e++
      while (e > s && /[\s,;]/.test(b.t[e - 1])) e--
      if (e > s && e <= b.t.length && !b.l?.some((x) => x.s < e && x.e > s)) (b.l ??= []).push({ s, e, to: a.to })
    }
  }
  blocks.forEach((b) => b.l?.sort((x, y) => x.s - y.s))

  const firstOnPage = (p: number) => blocks.findIndex((b) => (b.pg ?? 0) >= p)
  const fold = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  /** The block where an outline entry starts: the heading on its page that carries its title. */
  const placeOf = (p: number, title: string) => {
    const at = firstOnPage(p)
    if (at < 0) return at
    const want = fold(title).replace(/^\d+(\s\d+)*\s/, '')
    if (want.length < 2) return at
    for (let i = at; i < blocks.length && (blocks[i].pg ?? 0) <= p + 1; i++) {
      const t = fold(blocks[i].t)
      if (t.length < want.length + 40 && (t === want || t.endsWith(want) || t.startsWith(want) || t.replace(/^\d+(\s\d+)*\s/, '') === want)) return i
    }
    return at
  }
  // Outline → contents and chapter breaks.
  const toc: RawToc[] = []
  try {
    const outline = await doc.getOutline()
    const walk = async (items: typeof outline, level: number) => {
      for (const it of items ?? []) {
        const p = await destPage(it.dest)
        if (p) toc.push({ title: it.title, level, to: `b:${placeOf(p, it.title)}` })
        if (it.items?.length && level < 3) await walk(it.items, level + 1)
      }
    }
    if (outline) await walk(outline, 0)
  } catch { /* no outline */ }
  step('Building chapters', N, N)

  let bounds: { at: number; title?: string }[] | undefined
  const tops = toc.filter((t) => t.level === 0)
  const useLevel = tops.length >= 2 ? 0 : toc.filter((t) => t.level === 1).length >= 2 ? 1 : -1
  if (useLevel >= 0) bounds = toc.filter((t) => t.level === useLevel).map((t) => ({ at: parseInt(t.to.slice(2), 10), title: t.title.trim() })).filter((x) => x.at >= 0)
  else if (blocks.filter((b) => b.k === 'h1' || b.k === 'h2').length < 2 && N > 24) {
    bounds = []
    for (let p = 1; p <= N; p += 20) { const at = firstOnPage(p); if (at >= 0) bounds.push({ at, title: `Pages ${p}–${Math.min(N, p + 19)}` }) }
  }
  const { chapters, locate } = chapterize(blocks, bounds)
  // Outline entries point at blocks; express them as anchors the shared step resolves.
  const anchors = new Map<string, { ch: number; b: number }>()
  for (const t of toc) { const i = parseInt(t.to.slice(2), 10); if (i >= 0) { anchors.set('blk' + i, locate(i)); t.to = 'x:blk' + i } }
  const titleGuess = blocks.find((b) => b.pg === 1 && b.k === 'h1' && b.t.length < 150)?.t
  if (bounds?.[0]?.title?.startsWith('Pages ')) chapters.forEach((c) => { c.gen = true })

  let cover: Blob | undefined
  try {
    const page = await doc.getPage(1)
    const vp0 = page.getViewport({ scale: 1 })
    const vp = page.getViewport({ scale: 360 / vp0.width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height)
    await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport: vp }).promise
    cover = await new Promise<Blob | undefined>((r) => canvas.toBlob((b) => r(b ?? undefined), 'image/jpeg', 0.82))
  } catch { /* the shelf draws a cover */ }
  void task.destroy()

  const metaTitle = info.Title && !/^(untitled|microsoft word|document|\s*$)/i.test(info.Title) ? info.Title : undefined
  return { title: metaTitle ?? titleGuess, author: info.Author, lang: info.Language, cover, pages: N, chapters, anchors, toc: toc.filter((t) => t.to.startsWith('x:')), printed }
}
