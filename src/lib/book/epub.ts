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
  return path + (u.hash ? '#' + decodeURIComponent(u.hash.slice(1)) : '')
}
const byTag = (root: Document | Element, name: string) => Array.from(root.getElementsByTagName('*')).filter((e) => e.localName === name)

export async function parseEpub(buf: ArrayBuffer, step: (s: string, done: number, total: number) => void): Promise<RawBook> {
  const zip = await JSZip.loadAsync(buf)
  const files = new Map(Object.keys(zip.files).map((k) => [k.toLowerCase(), k]))
  const get = (p: string) => zip.file(p) ?? zip.file(files.get(p.toLowerCase()) ?? '')
  const container = await get('META-INF/container.xml')?.async('text')
  const opfPath = container && /full-path\s*=\s*"([^"]+)"/.exec(container)?.[1]
  if (!opfPath) throw new Error('This EPUB has no package file.')
  const opf = parseMarkup(await get(opfPath)!.async('text'), 'application/xml')
  const base = dirOf(opfPath)

  const dc = (n: string) => byTag(opf, n)[0]?.textContent?.trim() ?? ''
  const manifest = new Map<string, { href: string; type: string; props: string }>()
  for (const it of byTag(opf, 'item')) manifest.set(it.getAttribute('id') ?? '', { href: join(base, it.getAttribute('href') ?? ''), type: it.getAttribute('media-type') ?? '', props: it.getAttribute('properties') ?? '' })
  const spineEl = byTag(opf, 'spine')[0]
  const spine = byTag(opf, 'itemref').map((r) => manifest.get(r.getAttribute('idref') ?? '')).filter((x): x is NonNullable<typeof x> => !!x && /html|xml/.test(x.type))

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
  for (let i = 0; i < spine.length; i++) {
    step('Reading chapters', i, spine.length)
    const path = spine[i].href
    const text = await get(path)?.async('text')
    const here = chapters.length
    anchors.set(path, { ch: here, b: 0 })
    if (!text) continue
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

  return { title: dc('title'), author: byTag(opf, 'creator').map((c) => c.textContent?.trim()).filter(Boolean).join(', '), lang: dc('language'), cover, chapters: split, anchors, toc }
}
