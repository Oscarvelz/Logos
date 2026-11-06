// Turns an HTML / XHTML / XML document into reading blocks, keeping links and
// the ids links point at. Shared by EPUB, Word, FB2 and web files.
import type { Block, Kind, Link } from '../books.ts'

/** A link before it is resolved: `to` is "x:<key>" (inside the book), "p:<n>" (a PDF page) or a URL. */
export type RawLink = Link

const SKIP = new Set(['script', 'style', 'head', 'svg', 'math', 'noscript', 'template', 'iframe', 'object', 'video', 'audio', 'button', 'select', 'input', 'textarea', 'binary', 'description', 'title-info', 'document-info', 'publish-info', 'custom-info'])
const BLOCKS: Record<string, Kind | 'blk'> = {
  h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h3', h5: 'h3', h6: 'h3', li: 'li', blockquote: 'q', pre: 'pre',
  p: 'blk', div: 'blk', section: 'blk', article: 'blk', header: 'blk', footer: 'blk', aside: 'blk', main: 'blk', nav: 'blk',
  figure: 'blk', figcaption: 'blk', body: 'blk', ul: 'blk', ol: 'blk', dl: 'blk', dt: 'blk', dd: 'blk', table: 'blk',
  thead: 'blk', tbody: 'blk', tr: 'blk', td: 'blk', th: 'blk', center: 'blk', hr: 'blk', address: 'blk', caption: 'blk',
}

export type WalkOpts = {
  /** Map an element to the tag it behaves like (FB2 "title" → "h2"…). Return undefined to keep its own tag. */
  tagOf?: (el: Element) => string | undefined
  /** Resolve an <a> element's target into a raw link target, or null. */
  link: (el: Element) => string | null
}

class Builder {
  blocks: Block[] = []
  ids = new Map<string, number>()
  private buf = ''
  private links: RawLink[] = []
  private pending: string[] = []
  text(s: string, pre = false) {
    if (pre) {
      s.split('\n').forEach((line, i) => { if (i) this.br(); this.text(line) })
      return
    }
    let t = s.replace(/[\s\u00a0\u200b\ufeff]+/g, ' ')
    if (!this.buf || /[ \n]$/.test(this.buf)) t = t.replace(/^ /, '')
    this.buf += t
  }
  br() {
    if (!this.buf) return
    if (this.buf.endsWith(' ')) this.buf = this.buf.slice(0, -1) + '\n'
    else if (!this.buf.endsWith('\n')) this.buf += '\n'
  }
  get at() { return this.buf.length }
  id(id: string) { this.pending.push(id) }
  link(s: number, e: number, to: string) { if (e > s) this.links.push({ s, e, to }) }
  flush(k: Kind) {
    const t = this.buf.replace(/[ \n]+$/, '')
    if (/[\p{L}\p{N}]/u.test(t)) {
      const idx = this.blocks.length
      const l = this.links.filter((x) => x.s < t.length).map((x) => ({ ...x, e: Math.min(x.e, t.length) })).filter((x) => x.e > x.s)
      this.blocks.push(l.length ? { k, t, l } : { k, t })
      for (const id of this.pending) this.ids.set(id, idx)
      this.pending = []
    }
    this.buf = ''
    this.links = []
  }
  /** Ids still waiting for text at the end point at the next block (the start of what follows). */
  finish() { for (const id of this.pending) this.ids.set(id, this.blocks.length); this.pending = [] }
}

function walk(node: Node, b: Builder, kind: Kind, o: WalkOpts) {
  for (const n of Array.from(node.childNodes)) {
    if (n.nodeType === 3 || n.nodeType === 4) { b.text(n.nodeValue ?? '', kind === 'pre'); continue }
    if (n.nodeType !== 1) continue
    const el = n as Element
    const tag = (o.tagOf?.(el) ?? el.localName).toLowerCase()
    if (SKIP.has(tag)) continue
    const id = el.getAttribute('id') ?? (tag === 'a' ? el.getAttribute('name') : null)
    if (id) b.id(id)
    if (tag === 'br') { b.br(); continue }
    if (tag === 'img' || tag === 'image') continue
    const bk = BLOCKS[tag]
    if (bk) {
      b.flush(kind)
      const inner: Kind = bk === 'blk' ? (kind === 'q' || kind === 'li' || kind[0] === 'h' ? kind : 'p') : bk
      walk(el, b, inner, o)
      b.flush(inner)
      continue
    }
    if (tag === 'a') {
      const to = o.link(el)
      const s = b.at
      walk(el, b, kind, o)
      if (to) b.link(s, b.at, to)
      continue
    }
    walk(el, b, kind, o)
  }
}

export function toBlocks(root: Node, o: WalkOpts): { blocks: Block[]; ids: Map<string, number> } {
  const b = new Builder()
  walk(root, b, 'p', o)
  b.flush('p')
  b.finish()
  return { blocks: b.blocks, ids: b.ids }
}

export function parseMarkup(text: string, type: DOMParserSupportedType): Document {
  const doc = new DOMParser().parseFromString(text, type)
  if (type !== 'text/html' && doc.getElementsByTagName('parsererror').length) return new DOMParser().parseFromString(text, 'text/html')
  return doc
}

export const isWebLink = (href: string) => /^https?:\/\//i.test(href)
