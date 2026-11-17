// EPUB 2 and 3: reading order from the spine, contents from nav.xhtml or toc.ncx,
// every internal link and footnote kept.
import JSZip from 'jszip'
import type { Pos } from '../books.ts'
import type { RawBook, RawChapter, RawToc } from './finish.ts'
import { parseMarkup, toBlocks, isWebLink } from './html.ts'

const dirOf = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '')
function join(base: string, href: string): string {
  const u = new URL(href, 'https://book.local/' + base)
  let path = u.pathname.slice(1)
  try { path = decodeURIComponent(path) } catch { /* keep */ }
  // Cure R3-T8-20: the fragment's decode sat OUTSIDE any try, so a
  // link whose anchor carries a bare '%' (percent-named anchors
  // exist; sloppy toolchains emit them) threw URIError out of join,
  // out of the link callback, out of parseEpub — a valid book
  // refused over one link's fragment. The fragment now gets the
  // pathname's discipline: undecodable means keep it raw; the link
  // then misses its anchor, and nothing else is lost.
  let frag = ''
  if (u.hash) { try { frag = '#' + decodeURIComponent(u.hash.slice(1)) } catch { frag = u.hash } }
  return path + frag
}
const byTag = (root: Document | Element, name: string) => Array.from(root.getElementsByTagName('*')).filter((e) => e.localName === name)

export async function parseEpub(buf: ArrayBuffer, step: (s: string, done: number, total: number) => void): Promise<RawBook> {
  const zip = await JSZip.loadAsync(buf)
  const files = new Map(Object.keys(zip.files).map((k) => [k.toLowerCase(), k]))
  const get = (p: string) => zip.file(p) ?? zip.file(files.get(p.toLowerCase()) ?? '')
  const container = await get('META-INF/container.xml')?.async('text')
  // Cure R2-T8-20: single-quoted attributes are legal XML and real
  // toolchains emit them; the double-quote-only pattern refused a
  // valid book as having "no package file" — blaming the file for
  // the reader's own narrowness.
  const opfPath = container && /full-path\s*=\s*["']([^"']+)["']/.exec(container)?.[1]
  if (!opfPath) throw new Error('This EPUB has no package file.')
  // L-2 cure: a container that points at an OPF the zip does not hold
  // used to be dereferenced blind (`get(opfPath)!`), and the reader got
  // a raw "Cannot read properties of undefined" toast. The failure is
  // the book's, and it is named as one.
  const opfFile = get(opfPath)
  if (!opfFile) throw new Error('This EPUB’s package file is missing from the book.')
  const opf = parseMarkup(await opfFile.async('text'), 'application/xml')
  const base = dirOf(opfPath)

  const dc = (n: string) => byTag(opf, n)[0]?.textContent?.trim() ?? ''
  const manifest = new Map<string, { href: string; type: string; props: string }>()
  for (const it of byTag(opf, 'item')) manifest.set(it.getAttribute('id') ?? '', { href: join(base, it.getAttribute('href') ?? ''), type: it.getAttribute('media-type') ?? '', props: it.getAttribute('properties') ?? '' })
  const spineEl = byTag(opf, 'spine')[0]
  // L-2 cure: spine entries that cannot be read as chapters — an idref
  // the manifest never declares, or a file whose type is not a readable
  // document — used to fall out of the book silently, truncating it
  // with no trace. They are counted here and named on the book's
  // warning at the end of the parse.
  let droppedSpine = 0
  const spine = byTag(opf, 'itemref').map((r) => manifest.get(r.getAttribute('idref') ?? '')).filter((x): x is NonNullable<typeof x> => {
    if (!x || !/html|xml/.test(x.type)) { droppedSpine++; return false }
    return true
  })

  // Cover image.
  let cover: Blob | undefined
  const coverId = byTag(opf, 'meta').find((m) => m.getAttribute('name') === 'cover')?.getAttribute('content')
  const coverItem = [...manifest.values()].find((m) => m.props.includes('cover-image')) ?? (coverId ? manifest.get(coverId) : undefined)
    ?? [...manifest.entries()].find(([k, m]) => /cover/i.test(k + m.href) && m.type.startsWith('image/'))?.[1]
  if (coverItem?.type.startsWith('image/')) {
    const data = await get(coverItem.href)?.async('blob')
    if (data) cover = new Blob([data], { type: coverItem.type })
  }

  const inSpine = new Set(spine.map((s) => s.href))
  const chapters: RawChapter[] = []
  const anchors = new Map<string, Pos>()
  let missingChapters = 0
  for (let i = 0; i < spine.length; i++) {
    step('Reading chapters', i, spine.length)
    const path = spine[i].href
    let text: string | undefined
    try { text = await get(path)?.async('text') } catch { text = undefined }
    if (!text) {
      // L-2 cure: a spine file that is not in the book (or cannot be
      // read) leaves NO anchor behind. The anchor used to be registered
      // before the load, so every link and contents entry aimed at the
      // missing chapter silently resolved to the NEXT chapter's start
      // — a redirect the reader never chose and never saw. Now the aim
      // resolves nowhere, finishBook drops the link, and the loss is
      // counted onto the book's warning below.
      missingChapters++
      continue
    }
    const here = chapters.length
    anchors.set(path, { ch: here, b: 0 })
    const doc = parseMarkup(text, 'application/xhtml+xml')
    const body = doc.body ?? byTag(doc, 'body')[0] ?? doc.documentElement
    const { blocks, ids } = toBlocks(body, {
      link: (a) => {
        const href = a.getAttribute('href') ?? a.getAttributeNS('http://www.w3.org/1999/xlink', 'href')
        if (!href) return null
        if (isWebLink(href)) return href
        if (/^[a-z]+:/i.test(href)) return null
        const target = join(path, href)
        return inSpine.has(target.split('#')[0]) ? 'x:' + target : null
      },
    })
    for (const [id, b] of ids) anchors.set(`${path}#${id}`, { ch: here, b })
    if (blocks.length) chapters.push({ blocks })
  }

  // Contents: EPUB 3 nav first, then EPUB 2 NCX.
  const toc: RawToc[] = []
  const navItem = [...manifest.values()].find((m) => m.props.split(/\s+/).includes('nav'))
  if (navItem) {
    const t = await get(navItem.href)?.async('text')
    if (t) {
      const doc = parseMarkup(t, 'application/xhtml+xml')
      const navs = byTag(doc, 'nav')
      const nav = navs.find((n) => /toc/.test(n.getAttribute('epub:type') ?? n.getAttributeNS('http://www.idpf.org/2007/ops', 'type') ?? '')) ?? navs[0]
      const walkList = (ol: Element, level: number) => {
        for (const li of Array.from(ol.children).filter((c) => c.localName === 'li')) {
          const a = Array.from(li.children).find((c) => c.localName === 'a' || c.localName === 'span')
          const href = a?.getAttribute('href')
          if (a && href) toc.push({ title: a.textContent ?? '', level, to: 'x:' + join(navItem.href, href) })
          const sub = Array.from(li.children).find((c) => c.localName === 'ol' || c.localName === 'ul')
          if (sub) walkList(sub, level + 1)
        }
      }
      const ol = nav && byTag(nav, 'ol')[0]
      if (ol) walkList(ol, 0)
    }
  }
  if (toc.length < 2) {
    toc.length = 0
    const ncxItem = manifest.get(spineEl?.getAttribute('toc') ?? '') ?? [...manifest.values()].find((m) => m.type === 'application/x-dtbncx+xml')
    const t = ncxItem && (await get(ncxItem.href)?.async('text'))
    if (ncxItem && t) {
      const doc = parseMarkup(t, 'application/xml')
      const walkPoints = (parent: Element, level: number) => {
        for (const np of Array.from(parent.children).filter((c) => c.localName === 'navPoint')) {
          const label = byTag(np, 'text')[0]?.textContent ?? ''
          const src = byTag(np, 'content')[0]?.getAttribute('src')
          if (src) toc.push({ title: label, level, to: 'x:' + join(ncxItem.href, src) })
          walkPoints(np, level + 1)
        }
      }
      const map = byTag(doc, 'navMap')[0]
      if (map) walkPoints(map, 0)
    }
  }

  // Chapter titles from the contents, where an entry starts a chapter.
  for (const t of toc) {
    const hit = anchors.get(t.to.slice(2)) ?? anchors.get(t.to.slice(2).split('#')[0])
    if (hit && hit.b === 0 && chapters[hit.ch] && !chapters[hit.ch].title) chapters[hit.ch].title = t.title.trim().replace(/\s+/g, ' ')
  }

  // Some books put many chapters in one file: split a long file where a contents entry lands on a heading inside it.
  const cuts = new Map<number, Set<number>>()
  for (const t of toc) {
    const hit = anchors.get(t.to.slice(2)) ?? anchors.get(t.to.slice(2).split('#')[0])
    const c = hit && chapters[hit.ch]
    if (!hit || !c || hit.b <= 0 || c.blocks.length < 60) continue
    const k = c.blocks[hit.b]?.k
    if (k !== 'h1' && k !== 'h2' && k !== 'h3') continue
    if (!cuts.has(hit.ch)) cuts.set(hit.ch, new Set())
    cuts.get(hit.ch)!.add(hit.b)
  }
  let split: RawChapter[] = chapters
  if (cuts.size) {
    split = []
    const map: { start: number; first: number }[][] = []
    chapters.forEach((c, i) => {
      const at = [0, ...[...(cuts.get(i) ?? [])].sort((a, b) => a - b)]
      map[i] = at.map((start) => ({ start, first: 0 }))
      at.forEach((start, n) => {
        map[i][n].first = split.length
        split.push({ title: n === 0 ? c.title : undefined, blocks: c.blocks.slice(start, at[n + 1] ?? c.blocks.length) })
      })
    })
    for (const [k, p] of anchors) {
      const parts = map[p.ch]
      if (!parts) { anchors.set(k, { ch: split.length, b: 0 }); continue }
      let j = 0
      while (j + 1 < parts.length && parts[j + 1].start <= p.b) j++
      anchors.set(k, { ch: parts[j].first, b: p.b - parts[j].start })
    }
  }

  // L-2: what the parse had to leave out is said on the book, in the
  // open — a truncated import is a fact about this copy of the book,
  // and the reader hears it at import time, not never.
  const leftOut: string[] = []
  if (missingChapters) leftOut.push(`${missingChapters} chapter file${missingChapters === 1 ? ' was' : 's were'} missing from the book`)
  if (droppedSpine) leftOut.push(`${droppedSpine} item${droppedSpine === 1 ? '' : 's'} in the reading order could not be read as a chapter`)
  const warn = leftOut.length ? `Part of this book was left out: ${leftOut.join('; ')}.` : undefined

  return { title: dc('title'), author: byTag(opf, 'creator').map((c) => c.textContent?.trim()).filter(Boolean).join(', '), lang: dc('language'), cover, chapters: split, anchors, toc, ...(warn ? { warn } : {}) }
}
