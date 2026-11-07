// PDF: rebuilds paragraphs and headings from the text layer, drops running heads
// and page numbers, keeps the outline and the PDF's own links.
import type { Block } from '../books.ts'
import { chapterize, type RawBook, type RawToc } from './finish.ts'

type Item = { s: number; e: number; x0: number; x1: number }
type Line = { text: string; x: number; xEnd: number; y: number; h: number; items: Item[]; page: number; bi?: number; off?: number }
type Annot = { page: number; rect: number[]; to: string }

const TERMINAL = /[.!?:;…»”"')\]]$/
const foldT = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const lettersOf = (t: string) => foldT(t).replace(/[^a-z\u00f1]/g, '')
/** Share of words that look like real words: OCR noise ("//AW Jr v^") scores low. */
const quality = (t: string) => {
  const toks = t.split(/\s+/).filter(Boolean)
  if (!toks.length) return 0
  const good = toks.filter((w) => /^[("“'‘¿¡[]*\p{L}{2,}[\p{L}'’-]*[.,;:!?'’"”)\]…]*$/u.test(w) || /^[(\[]?\d+[.,:)\]]?$/.test(w) || /^[aAyYoOeIu][.,]?$/.test(w)).length
  return good / toks.length
}
function lev(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t }
  }
  return d[b.length]
}
const SMALL = new Set(['a', 'an', 'the', 'of', 'and', 'or', 'in', 'on', 'to', 'for', 'by', 'at', 'de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'un', 'una'])
const titleCase = (t: string) => (t === t.toUpperCase() && /\p{Lu}{3}/u.test(t) ? t.split(' ').map((W, i) => { if (/^[IVXLC]+\.?$/.test(W)) return W; const w = W.toLowerCase(); return i && SMALL.has(w) && !/^[IVXLC\d]+\.?$/.test(t.split(' ')[i - 1]) ? w : w.charAt(0).toUpperCase() + w.slice(1) }).join(' ') : t)
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
    // Drop caps ("W" + "hen I was…") join their line; OCR noise lines go.
    const kept: Line[] = []
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i], nx = lines[i + 1]
      if (/^\p{Lu}$/u.test(l.text)) {
        if (nx && l.h > nx.h * 1.4 && /^\p{L}/u.test(nx.text)) { nx.text = l.text + nx.text; nx.items.forEach((it) => { it.s += 1; it.e += 1 }); nx.x = Math.min(nx.x, l.x) }
        continue
      }
      const letters = (l.text.match(/\p{L}/gu) ?? []).length
      if (letters < l.text.replace(/\s/g, '').length * 0.45 && !/^[\d\s.,–—-]+$/.test(l.text)) continue
      if (l.text.length < 60 && quality(l.text) < 0.5 && !/^[-–—]?\s*\d{1,4}\s*[-–—]?$/.test(l.text)) continue
      kept.push(l)
    }
    lines.length = 0; lines.push(...kept)
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

  // Running heads and feet: the same words at the top or bottom of many pages, even when
  // OCR garbles them a little ("24 I HOW THE MIND WORKS", "The M i d i Eye 231"). Page numbers: read, then dropped.
  const printed = new Map<number, number>()
  const edgesOf = (lines: Line[]) => [...lines.slice(0, 3), ...lines.slice(-2)].filter((l) => l.text.length < 90)
  const keyCount = new Map<string, number>()
  const keyForms = new Map<string, Map<string, number>>()
  for (const lines of pages) {
    const seen = new Set<string>()
    for (const l of edgesOf(lines)) {
      const k = lettersOf(l.text)
      if (k.length < 4 || seen.has(k)) continue
      seen.add(k); keyCount.set(k, (keyCount.get(k) ?? 0) + 1)
      const form = l.text.replace(/\d+/g, ' ').replace(/^[\s\p{P}]*(\S\s+)*(?=\S{2})/u, '').replace(/(\s+\S)*[\s\p{P}]*$/u, '').replace(/\s+/g, ' ').trim()
      const forms = keyForms.get(k) ?? new Map<string, number>(); forms.set(form, (forms.get(form) ?? 0) + 1); keyForms.set(k, forms)
    }
  }
  const minRepeat = N >= 12 ? Math.max(3, Math.ceil(N * 0.03)) : Math.max(3, N * 0.25)
  const frequent = [...keyCount].filter(([k, c]) => c >= minRepeat && k.length >= 5).map(([k]) => k)
  const isHead = (t: string) => {
    if (N < 4) return false
    const k = lettersOf(t)
    if (k.length < 4) return false
    if ((keyCount.get(k) ?? 0) >= minRepeat) return true
    return frequent.some((f) => (k.includes(f) && k.length <= f.length + 3) || (Math.abs(k.length - f.length) <= 3 && lev(k, f) <= Math.max(1, Math.floor(f.length / 6))))
  }
  pages.forEach((lines, i) => {
    const edges = new Set(edgesOf(lines))
    pages[i] = lines.filter((l) => {
      if (!edges.has(l)) return true
      const bare = /^[-–—]?\s*(?:p[áa]g(?:ina)?\.?\s*|page\s*)?(\d{1,4})\s*[-–—]?$/i.exec(l.text)
      const head = isHead(l.text)
      const num = bare ?? (head ? (/(?:^|\s)(\d{1,4})$/.exec(l.text) ?? /^(\d{1,4})\s/.exec(l.text)) : null)
      if (num) { const n = parseInt(num[1], 10); if (!printed.has(n)) printed.set(n, i + 1) }
      if (bare || /^[ivxlcdm]{1,6}$/i.test(l.text)) return false
      return !head
    })
  })
  // The book's title is usually the running head on most left-hand pages.
  let headTitle: string | undefined
  const topKey = [...keyCount].filter(([k]) => frequent.includes(k)).sort((a, b) => b[1] - a[1])[0]
  if (topKey && topKey[1] >= Math.max(4, N * 0.15)) {
    const form = [...(keyForms.get(topKey[0]) ?? [])].sort((a, b) => b[1] - a[1])[0]?.[0]
    if (form && form.length >= 4 && form.length < 120 && quality(form) >= 0.8) headTitle = titleCase(form)
  }

  const flat = pages.flat()
  const body = median(flat.flatMap((l) => (l.text.length > 30 ? [l.h] : []))) || median(flat.map((l) => l.h)) || 10
  const gaps: number[] = []
  for (const lines of pages) for (let i = 1; i < lines.length; i++) { const g = lines[i - 1].y - lines[i].y; if (g > 0 && Math.abs(lines[i].h - body) < body * 0.2) gaps.push(g) }
  const lineGap = median(gaps) || body * 1.3

  // Cover title: the title as the book itself prints it, in the biggest type on its
  // first pages. Read it straight from the lines, grouped by size — the block builder
  // merges and renames too much to trust for this. A lone short word in the biggest
  // type is the publisher's mark, not the title, so it never counts on its own.
  const coverTitle = ((): string | undefined => {
    const generic = /^(contents|table of contents|índice|indice|contenido|contenidos|sumario|preface|prefacio|introduction|introducción|foreword|prólogo|acknowledg\w+|bibliography|bibliografía|references|referencias|appendix|apéndice|copyright|edition|edición)$/i
    for (let p = 0; p < Math.min(N, 3); p++) {
      let lines = pages[p].filter((l) => l.h >= body * 1.8 && l.text.length >= 2 && l.text.length <= 110 && quality(l.text) >= 0.75 && !isHead(l.text) && !/^[\d\s.,–—-]+$/.test(l.text))
      if (!lines.length) continue
      // The publisher's mark can be the biggest type on the page, over the title:
      // a lone short word, strictly bigger than everything else, is not the title.
      const maxH = Math.max(...lines.map((l) => l.h))
      if (lines.length > 1 && lines.some((l) => l.h < maxH)) lines = lines.filter((l) => l.h !== maxH || /\s/.test(l.text) || l.text.length > 6)
      if (!lines.length) continue
      const groups: Line[][] = []
      for (const l of lines) {
        const g = groups[groups.length - 1]
        if (g && l.h >= g[0].h * 0.6 && l.h <= g[0].h * 1.6) g.push(l)
        else groups.push([l])
      }
      let best: string | undefined, bestH = 0
      for (const g of groups) {
        const text = g.map((l) => l.text).join(' ').replace(/\s+/g, ' ').trim()
        if (text.length < 4 || text.length > 150) continue
        if (!/\s/.test(text) && text.length <= 6) continue   // a lone short word is the publisher's mark
        if ((text.match(/\p{L}/gu) ?? []).length < 3) continue
        if (generic.test(text.replace(/[.:]+$/, ''))) continue
        if (g[0].h > bestH) { best = titleCase(text); bestH = g[0].h }
      }
      if (best) return best
    }
    return undefined
  })()

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
      const big = (l.h >= body * 1.22 && l.text.length < 140 && /[\p{L}]/u.test(l.text) && !/^\p{Ll}/u.test(l.text) && quality(l.text) >= 0.7 && lettersOf(l.text).length >= 3) || (!!numbered && gapAbove > lineGap * 1.25 && l.xEnd < left + width * 0.75)
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
  function contentsChapters(): { at: number; title: string }[] {
    const limit = Math.min(N, 40)
    const start = blocks.findIndex((b) => (b.pg ?? 0) <= limit && /^(table of )?(contents|índice|indice|contenidos?|sumario|tabla de contenidos?)$/i.test(fold(b.t)))
    if (start < 0) return []
    const page0 = blocks[start].pg ?? 1
    let text = ''
    for (let i = start + 1; i < blocks.length && (blocks[i].pg ?? 0) <= page0 + 5 && text.length < 6000; i++) text += ' ' + blocks[i].t
    // Line by line first: each contents line is "[number] Title … page". OCR misreads numbers
    // ("J" or "l" for 1, "O" for 0), so those are read as the digits they stand for.
    const ocrNum = (t: string) => { const d = t.replace(/[JlI|!]/g, '1').replace(/[Oo]/g, '0').replace(/S/g, '5').replace(/B/g, '8'); return /^\d{1,4}$/.test(d) ? parseInt(d, 10) : null }
    const lineEntries: { title: string; n: number | null; num?: string }[] = []
    for (let pg = page0; pg <= Math.min(N, page0 + 5); pg++) {
      const lines = pages[pg - 1] ?? []
      let from = 0
      if (pg === page0) { const h = lines.findIndex((l) => /^(table of )?(contents|índice|indice|contenidos?|sumario|tabla de contenidos?)$/i.test(fold(l.text))); from = h + 1 }
      for (const l of lines.slice(from)) {
        const m = /^(?:(\S{1,4}?)\.?\s+)?(\S.*?)[\s.·…_]*\s((?:[\dJlI|!OoSB]{1,4})|[ivxlcdm]{1,7})$/u.exec(l.text.trim())
        if (!m) continue
        let num: string | undefined
        let title = m[2]
        if (m[1]) {
          const asNum = ocrNum(m[1])
          if (/^[IVXLC]{2,6}$/.test(m[1])) num = m[1]
          else if (asNum != null && asNum < 100) num = String(asNum)
          else if (/^[IVXLC]$/.test(m[1])) num = m[1]
          else title = `${m[1]} ${title}`
        }
        const pageTok = m[3]
        const n = /^[ivxlcdm]+$/.test(pageTok) ? null : ocrNum(pageTok)
        title = title.replace(/[\s.·…_]+$/u, '')
        if (!/^\p{L}/u.test(title) || quality(title) < 0.6 || title.length > 75 || /[,;:]$/.test(title)) continue
        lineEntries.push({ title: titleCase(title.replace(/[\s.·…_]+$/u, '')), n, num })
      }
    }
    // Roman chapters: a lone "I" read as 1 goes back to I.
    lineEntries.forEach((e, i) => { if (e.num === '1' && /^[IVXLC]{2,}$/.test(lineEntries[i + 1]?.num ?? '')) e.num = 'I' })
    // Chapter numbers in order: a junk number between 1 and 3 is 2.
    lineEntries.forEach((e, i) => { if (!e.num && e.n != null) { const a = lineEntries[i - 1]?.num, b = lineEntries[i + 1]?.num; if (a && b && /^\d+$/.test(a) && +b === +a + 2) e.num = String(+a + 1) } })
    const entries: { title: string; n: number }[] = []
    const front: string[] = []
    for (const e of lineEntries) {
      const title = e.num ? `${e.num}. ${e.title}` : e.title
      if (e.n == null) { if (!entries.length) front.push(title); continue }
      if (entries.length && e.n <= entries[entries.length - 1].n) continue
      entries.push({ title, n: e.n })
    }
    const re = /(?:^|\s)(?:(\d{1,2}|[IVXLC]{1,6})\.?\s+)?(\p{Lu}[^\d]{1,90}?)[\s.·…_]*\b(\d{1,4})(?=\s|$)/gu
    const textEntries: { title: string; n: number }[] = []
    for (const m of text.matchAll(re)) {
      let title = `${m[1] ? m[1] + '. ' : ''}${m[2]}`.replace(/[\s.·…_]+$/u, '').trim()
      const n = parseInt(m[3], 10)
      // Running heads caught in the text ("CONTENTS PAGE V. The Necessity…"): keep from the chapter number on.
      const numbered = /^.*(?:^|\s)((?:[IVXLC]{1,6}|\d{1,2})\.\s+\p{Lu}.{2,})$/u.exec(title)
      if (numbered) title = numbered[1]
      // Sub-entries of a detailed contents ("Fear and love,") are not chapters.
      if (title.length < 2 || title.length > 75 || /[,;:]$/.test(title) || quality(title) < 0.6) continue
      title = titleCase(title)
      if (textEntries.length && n <= textEntries[textEntries.length - 1].n) continue
      textEntries.push({ title, n })
    }
    // Whichever reading found more chapters wins (line by line keeps its front matter).
    if (textEntries.length > entries.length) { entries.length = 0; entries.push(...textEntries); front.length = 0 }
    if (entries.length < 3) return []
    // Printed page → PDF page: the page numbers read on each page, or their usual offset.
    const offs = new Map<number, number>()
    printed.forEach((pdf, n) => { const o = pdf - n; offs.set(o, (offs.get(o) ?? 0) + 1) })
    const offset = [...offs].sort((a, b) => b[1] - a[1])[0]
    const out: { at: number; title: string }[] = []
    for (const t of front) {
      const want = fold(t.replace(/^\S+\.\s/, ''))
      const lo = blocks.findIndex((b) => (b.pg ?? 0) > page0)
      if (lo < 0 || want.length < 3) continue
      for (let i = lo; i < blocks.length && (blocks[i].pg ?? 0) <= page0 + 30; i++) {
        const b = fold(blocks[i].t)
        if (b.length < want.length + 30 && (b === want || b.startsWith(want) || b.endsWith(want))) { if (!out.length || i > out[out.length - 1].at) out.push({ at: i, title: t }); break }
      }
    }
    for (const e of entries) {
      const want = fold(e.title)
      const guess = printed.get(e.n) ?? (offset && offset[1] >= 3 ? e.n + offset[0] : null)
      let at = -1
      const lo = guess ? firstOnPage(Math.max(page0 + 1, guess - 1)) : blocks.findIndex((b) => (b.pg ?? 0) > page0 + 1)
      const hiPage = guess ? guess + 2 : N
      if (lo >= 0) for (let i = lo; i < blocks.length && (blocks[i].pg ?? 0) <= hiPage; i++) {
        const t = fold(blocks[i].t)
        if (t.length < want.length + 50 && (t === want || t.endsWith(want) || t.startsWith(want))) { at = i; break }
      }
      if (at < 0 && guess) at = firstOnPage(guess)
      if (at >= 0 && (!out.length || at > out[out.length - 1].at)) out.push({ at, title: e.title })
    }
    return out.length >= Math.min(3, entries.length) ? out : []
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
  // No outline: read the book's own printed contents page and place each entry by its page number.
  if (toc.length < 2) {
    const fromContents = contentsChapters()
    if (fromContents.length >= 3) for (const c of fromContents) toc.push({ title: c.title, level: 0, to: `b:${c.at}` })
  }
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

  // Cover: the first page that isn't blank (scans often open on an empty white page).
  let cover: Blob | undefined
  try {
    for (let pg = 1; pg <= Math.min(N, 4) && !cover; pg++) {
      const page = await doc.getPage(pg)
      const vp0 = page.getViewport({ scale: 1 })
      const vp = page.getViewport({ scale: 360 / vp0.width })
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height)
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise
      const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      let ink = 0, n = 0
      for (let i = 0; i < px.length; i += 4 * 37) { n++; if ((px[i] + px[i + 1] + px[i + 2]) / 3 < 200) ink++ }
      if (ink / n > 0.012) cover = await new Promise<Blob | undefined>((r) => canvas.toBlob((b) => r(b ?? undefined), 'image/jpeg', 0.82))
    }
  } catch { /* the shelf draws a cover */ }
  void task.destroy()

  const metaTitle = info.Title && !/^(untitled|microsoft word|document|scan|\s*$)|\.(pdf|docx?|indd|qxd)$/i.test(info.Title.trim()) && quality(info.Title) >= 0.6 ? info.Title.trim() : undefined
  return { title: metaTitle ?? coverTitle ?? headTitle, titleGuess, author: info.Author, lang: info.Language, cover, pages: N, chapters, anchors, toc: toc.filter((t) => t.to.startsWith('x:')), printed }
}
