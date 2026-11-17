// Word, FB2, web pages, Markdown, plain text and RTF.
import type { Block, Pos } from '../books.ts'
import { isWrappedLines } from '../text.ts'
import { chapterize, type RawBook } from './finish.ts'
import { parseMarkup, toBlocks, isWebLink } from './html.ts'

/** One long document → chapters, with its ids mapped to places. */
function fromFlat(blocks: Block[], ids: Map<string, number>, extra: Partial<RawBook> = {}): RawBook {
  const { chapters, locate } = chapterize(blocks)
  const anchors = new Map<string, Pos>()
  for (const [id, i] of ids) anchors.set('#' + id, locate(i))
  return { ...extra, chapters, anchors }
}
const hashLink = (href: string | null) => (!href ? null : isWebLink(href) ? href : href.startsWith('#') && href.length > 1 ? 'x:' + decodeURIComponent(href) : null)

export async function parseDocx(buf: ArrayBuffer): Promise<RawBook> {
  const mod = await import('mammoth/mammoth.browser.js') as unknown as { default?: Mammoth } & Mammoth
  const mammoth = mod.default ?? mod
  const res = await mammoth.convertToHtml({ arrayBuffer: buf }, { includeDefaultStyleMap: true, ignoreEmptyParagraphs: true })
  const doc = parseMarkup(`<body>${res.value}</body>`, 'text/html')
  const { blocks, ids } = toBlocks(doc.body, { link: (a) => hashLink(a.getAttribute('href')) })
  // Word's own "Contents" field is a list of links to headings; titles come from the first heading.
  const title = blocks.find((b) => b.k === 'h1')?.t
  return fromFlat(blocks, ids, { title: title && title.length < 120 ? title : undefined })
}
type Mammoth = { convertToHtml: (input: { arrayBuffer: ArrayBuffer }, opts?: object) => Promise<{ value: string }> }

export async function parseFb2(text: string): Promise<RawBook> {
  let markupWarn: string | undefined
  const doc = parseMarkup(text, 'application/xml', (w) => { markupWarn = w })
  const q = (root: Document | Element, name: string) => Array.from(root.getElementsByTagName('*')).filter((e) => e.localName === name)
  const ti = q(doc, 'title-info')[0]
  const title = ti && q(ti, 'book-title')[0]?.textContent?.trim()
  const author = ti && q(ti, 'author').map((a) => ['first-name', 'middle-name', 'last-name'].map((n) => q(a, n)[0]?.textContent?.trim()).filter(Boolean).join(' ')).filter(Boolean).join(', ')
  const lang = ti && q(ti, 'lang')[0]?.textContent?.trim()
  let cover: Blob | undefined
  const coverHref = ti && q(ti, 'coverpage')[0] && q(q(ti, 'coverpage')[0], 'image')[0]
  const cid = coverHref && (coverHref.getAttribute('l:href') ?? coverHref.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ?? coverHref.getAttribute('xlink:href') ?? '').replace(/^#/, '')
  const bin = cid && q(doc, 'binary').find((b) => b.getAttribute('id') === cid)
  if (bin) {
    try {
      const bytes = Uint8Array.from(atob((bin.textContent ?? '').replace(/\s+/g, '')), (c) => c.charCodeAt(0))
      cover = new Blob([bytes], { type: bin.getAttribute('content-type') ?? 'image/jpeg' })
    } catch { /* no cover */ }
  }
  const depth = (el: Element) => { let d = 0; for (let p = el.parentElement; p; p = p.parentElement) if (p.localName === 'section') d++; return d }
  const blocks: Block[] = []
  const ids = new Map<string, number>()
  for (const body of q(doc, 'body')) {
    const isNotes = /notes|comments/i.test(body.getAttribute('name') ?? '')
    if (isNotes) blocks.push({ k: 'h1', t: 'Notes' })
    const r = toBlocks(body, {
      tagOf: (el) => {
        switch (el.localName) {
          case 'title': return isNotes ? 'h3' : (['h1', 'h1', 'h2', 'h3'][Math.min(3, depth(el))])
          case 'subtitle': return 'h3'
          case 'epigraph': case 'cite': return 'blockquote'
          case 'poem': case 'stanza': case 'text-author': return 'div'
          case 'v': return 'p'
          case 'empty-line': return 'br'
          case 'image': return 'img'
          default: return undefined
        }
      },
      link: (a) => hashLink(a.getAttribute('l:href') ?? a.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ?? a.getAttribute('xlink:href') ?? a.getAttribute('href')),
    })
    for (const [id, i] of r.ids) ids.set(id, blocks.length + i)
    blocks.push(...r.blocks)
  }
  return fromFlat(blocks, ids, { title, author, lang, cover, warn: markupWarn })
}

export function parseHtml(text: string): RawBook {
  let markupWarn: string | undefined
  const doc = parseMarkup(text, 'text/html', (w) => { markupWarn = w })
  const { blocks, ids } = toBlocks(doc.body, { link: (a) => hashLink(a.getAttribute('href')) })
  const meta = (n: string) => doc.querySelector(`meta[name="${n}"]`)?.getAttribute('content') ?? undefined
  return fromFlat(blocks, ids, { title: doc.title || undefined, author: meta('author'), lang: doc.documentElement.lang || undefined, warn: markupWarn })
}

// Lines that open a chapter in plain text: "Capítulo IV", "Chapter 12: …", "Segunda parte", "Prólogo", "I.".
const ORD = String.raw`(?:\d{1,3}|[IVXLCDM]{1,7}|primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|sext[oa]|s[eé]ptim[oa]|octav[oa]|noven[oa]|d[eé]cim[oa]|one|two|three|four|five|six|seven|eight|nine|ten|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)`
const CHAPTER_LINE = new RegExp(String.raw`^(?:(?:cap[ií]tulo|chapter|parte|part|libro|book|canto|acto|act)\s+${ORD}\b[\s.:\-—–]*.{0,90}|${ORD}\s+(?:parte|part|libro|book)\b.{0,40}|(?:pr[oó]logo|prologue|ep[ií]logo|epilogue|introducci[oó]n|introduction|prefacio|preface|pr[eé]face|ap[eé]ndice|appendix|conclusi[oó]n|conclusion|dedicatoria|dedication)\b.{0,50}|[IVXLCDM]{1,7}\.?|\d{1,3}\.)$`, 'iu')

export function parseText(text: string, markdown: boolean): RawBook {
  let t = text.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ')
  // Project Gutenberg: keep the book between its START and END lines, and read its title and author.
  const head = t.slice(0, 6000)
  const gTitle = /^Title:\s*(.+)$/m.exec(head)?.[1]?.trim(), gAuthor = /^Author:\s*(.+)$/m.exec(head)?.[1]?.trim()
  const st = /^\*{3}\s*START OF.*$/m.exec(t), en = /^\*{3}\s*END OF.*$/m.exec(t)
  if (st) t = t.slice(st.index + st[0].length, en && en.index > st.index ? en.index : undefined)
  const lines = t.split('\n')
  const blocks: Block[] = []
  const ids = new Map<string, number>()
  // Hard-wrapped text joins lines into paragraphs; otherwise each line
  // stands. The verdict is text.ts's isWrappedLines — the same rule
  // intake applies per paragraph (cure R2-T8-7: the two doors used to
  // run different thresholds, >20 lines / width <100 here against ≥6 /
  // <110 plus wrap evidence there, so the same wrapped page segmented
  // one way pasted and another way imported).
  const wrapped = isWrappedLines(lines)
  const blankParas = lines.filter((l) => !l.trim()).length > lines.length * 0.08
  let para: string[] = []
  const flush = () => {
    if (!para.length) return
    let s = para.join(wrapped || markdown ? ' ' : '\n').replace(/[ \t]+/g, ' ').trim()
    if (markdown) s = s.replace(/(\*\*|__)(.+?)\1/g, '$2').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2').replace(/`([^`]+)`/g, '$1').replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    const links: Block['l'] = []
    if (markdown) {
      let out = ''
      let last = 0
      for (const m of s.matchAll(/\[\^([^\]]+)\]|\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g)) {
        out += s.slice(last, m.index)
        const start = out.length
        if (m[1]) { out += `[${m[1]}]`; links.push({ s: start, e: out.length, to: 'x:#fn-' + m[1].toLowerCase() }); last = m.index! + m[0].length; continue }
        out += m[2]
        const href = m[3]
        if (isWebLink(href)) links.push({ s: start, e: out.length, to: href })
        else if (href.startsWith('#')) links.push({ s: start, e: out.length, to: 'x:#' + href.slice(1).toLowerCase() })
        last = m.index! + m[0].length
      }
      s = out + s.slice(last)
    }
    if (s) blocks.push(links.length ? { k: 'p', t: s, l: links } : { k: 'p', t: s })
    para = []
  }
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li].trim()
    if (!line) { flush(); continue }
    const fn = markdown && /^\[\^([^\]]+)\]:\s*(.*)$/.exec(line)
    if (fn) { flush(); ids.set('fn-' + fn[1].toLowerCase(), blocks.length); blocks.push({ k: 'p', t: `${fn[1]}. ${fn[2]}` }); continue }
    const md = markdown && /^(#{1,6})\s+(.+?)\s*#*$/.exec(line)
    if (md) {
      flush()
      const k = md[1].length === 1 ? 'h1' : md[1].length === 2 ? 'h2' : 'h3'
      const title = md[2].replace(/(\*\*|__)/g, '')
      ids.set(title.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-'), blocks.length)
      blocks.push({ k, t: title })
      continue
    }
    if (markdown && /^[-*_]{3,}$/.test(line)) { flush(); continue }
    if (markdown && /^>\s?/.test(line)) { flush(); blocks.push({ k: 'q', t: line.replace(/^>\s?/, '') }); continue }
    if (markdown && /^([-*+]|\d+\.)\s+/.test(line)) { flush(); blocks.push({ k: 'li', t: line.replace(/^([-*+]|\d+\.)\s+/, '') }); continue }
    const alone = !para.length && (!lines[li + 1]?.trim() || !blankParas)
    if (!markdown && line.length < 110 && !para.length && CHAPTER_LINE.test(line)) {
      // Cure R2-T8-8: a BARE numeral on its own line ("1.", "IV") is not
      // heading evidence by itself — a vertical numbered list (number
      // line, item line, number line, …) shattered into a chapter per
      // item. A bare numeral heads a chapter only when a real body
      // follows it: at least ~120 chars of prose before the next
      // heading line. A book genuinely chaptered by bare numerals
      // (I. / II. / III. with pages between) clears that easily; a
      // list item never does, so the numeral stays in the text as the
      // list marker it is.
      if (/^(?:[IVXLCDM]{1,7}\.?|\d{1,3}\.)$/iu.test(line)) {
        let mass = 0
        for (let j = li + 1; j < lines.length && mass < 120; j++) {
          const nx = lines[j].trim()
          if (nx && CHAPTER_LINE.test(nx)) break
          mass += nx.length
        }
        if (mass < 120) { para.push(line); continue }
      }
      flush()
      blocks.push({ k: /^(parte|part|libro|book)\b/i.test(line) || /\b(parte|part|libro|book)$/i.test(line) ? 'h1' : 'h2', t: line })
      continue
    }
    if (!markdown && alone && blankParas && line.length >= 3 && line.length <= 60 && /\p{Lu}{3}/u.test(line) && line === line.toUpperCase() && !/[.,;]$/.test(line)) {
      flush(); blocks.push({ k: 'h2', t: line }); continue
    }
    para.push(line)
    if (!wrapped && !blankParas && !markdown) flush()
  }
  flush()
  const h = markdown ? blocks.slice(0, 3).find((b) => b.k === 'h1') : undefined
  return fromFlat(blocks, ids, { title: gTitle ?? (h && h.t.length < 120 ? h.t : undefined), author: gAuthor })
}

/** RTF → plain text (paragraphs, accents and Unicode escapes). */
export function rtfToText(rtf: string): string {
  let out = ''
  let i = 0
  const skipStack: boolean[] = []
  let skip = false
  let uc = 1
  while (i < rtf.length) {
    const c = rtf[i]
    if (c === '{') { skipStack.push(skip); i++; if (rtf.startsWith('\\*', i)) skip = true; continue }
    if (c === '}') { skip = skipStack.pop() ?? false; i++; continue }
    if (c === '\\') {
      const nx = rtf[i + 1]
      if (nx === '\\' || nx === '{' || nx === '}') { if (!skip) out += nx; i += 2; continue }
      if (nx === "'") { if (!skip) out += new TextDecoder('windows-1252').decode(new Uint8Array([parseInt(rtf.substr(i + 2, 2), 16)])); i += 4; continue }
      const m = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(i, i + 40))
      if (!m) { i += 2; continue }
      const word = m[1], arg = m[2]
      i += m[0].length
      if (/^(fonttbl|colortbl|stylesheet|info|pict|header|footer|footnote|themedata|datastore|latentstyles)$/.test(word)) skip = true
      if (skip) continue
      if (word === 'par' || word === 'line') out += '\n'
      else if (word === 'tab') out += '\t'
      else if (word === 'uc') uc = parseInt(arg ?? '1', 10)
      else if (word === 'u' && arg) { let n = parseInt(arg, 10); if (n < 0) n += 65536; out += String.fromCharCode(n); i += uc }
      else if (word === 'emdash') out += '—'
      else if (word === 'endash') out += '–'
      else if (word === 'lquote') out += '‘'
      else if (word === 'rquote') out += '’'
      else if (word === 'ldblquote') out += '“'
      else if (word === 'rdblquote') out += '”'
      continue
    }
    if (c === '\r' || c === '\n') { i++; continue }
    if (!skip) out += c
    i++
  }
  return out.replace(/\n/g, '\n\n')
}

export type DecodedText = { text: string; warn?: string }

/** Mojibake score: UTF-8 bytes misread as windows-1252 leave "Ã©"-style
    pairs. Used to tell a real legacy file (whose windows-1252 reading is
    clean) from a real UTF-8 file with a damaged byte or two (whose
    windows-1252 reading is full of these pairs). */
const mojibake = (s: string) => (s.match(/Ã[\u0080-\u00ff]|Â[\u0080-\u00bf]/g) ?? []).length

/** Decode a book file's bytes, honestly (M-2 cure). The old decoder was
    encoding-blind: it sniffed only a BOM, ignored the encoding an FB2
    declares in its XML prolog or an HTML file in its meta charset, and
    gated its windows-1252 fallback on a threshold a short legacy file
    could not reach — so BOM-less UTF-16 and short legacy files were
    shelved as silent garbage (the UTF-16 case even passed the word-count
    gate: every isolated letter counted as a "word"). Now, in order:
    BOM → the file's own declared encoding → a BOM-less UTF-16 shape
    (NUL bytes massed on one parity) → UTF-8, with a legacy fallback that
    fires on ANY replacement damage when the legacy reading is cleaner
    than the UTF-8 one. Whenever the encoding was GUESSED rather than
    declared, the result carries a warning for the book's meta — a guess
    is never silent. */
export function decodeTextDetailed(buf: ArrayBuffer): DecodedText {
  const bytes = new Uint8Array(buf)
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(bytes) }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(bytes) }
  // The file's own declaration: an XML prolog (FB2) or a meta charset
  // (HTML), both readable as plain ASCII in the first bytes.
  const head = new TextDecoder('windows-1252').decode(bytes.subarray(0, 1024))
  const declared = /<\?xml[^>]*?encoding\s*=\s*["']([\w.:-]+)["']/i.exec(head)?.[1]
    ?? /<meta[^>]*?charset\s*=\s*["']?([\w.:-]+)/i.exec(head)?.[1]
  if (declared && !/^utf-?8$/i.test(declared)) {
    try {
      const asDeclared = new TextDecoder(declared).decode(bytes)
      // Cure R2-T8-12: a declaration can LIE — sloppy converters stamp
      // encoding="iso-8859-1" over UTF-8 bytes, and the old branch
      // shelved the resulting mojibake with no warning: the one road
      // M-2 left unguarded. The lie is detectable: if the bytes are
      // strictly valid UTF-8 and the declared reading carries the
      // mojibake signature while the UTF-8 reading is clean, the file
      // is UTF-8 — read it as UTF-8 and say so. An honest legacy file
      // fails the strict UTF-8 check (its high bytes are not valid
      // sequences) and an honest reading shows no mojibake pairs, so a
      // true declaration is never second-guessed.
      if (!/^utf-?16/i.test(declared)) {
        let asUtf8: string | null = null
        try { asUtf8 = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { /* not valid UTF-8: the declaration stands */ }
        if (asUtf8 !== null && mojibake(asDeclared) > 0 && mojibake(asUtf8) === 0) {
          return { text: asUtf8, warn: `This file says its text is ${declared}, but it was really written in UTF-8; Logos read it as UTF-8 so the words come out right.` }
        }
      }
      return { text: asDeclared }
    } catch { /* unknown label: fall through to the guesses */ }
  }
  // BOM-less UTF-16: NUL bytes massed on one byte parity.
  const sample = bytes.subarray(0, Math.min(bytes.length, 8192))
  let zeroAtOdd = 0, zeroAtEven = 0
  for (let i = 0; i + 1 < sample.length; i += 2) { if (sample[i] === 0) zeroAtEven++; if (sample[i + 1] === 0) zeroAtOdd++ }
  const pairs = Math.max(1, Math.floor(sample.length / 2))
  if ((zeroAtOdd > pairs * 0.2 && zeroAtEven < pairs * 0.02) || (zeroAtEven > pairs * 0.2 && zeroAtOdd < pairs * 0.02)) {
    const enc = zeroAtOdd > zeroAtEven ? 'utf-16le' : 'utf-16be'
    return { text: new TextDecoder(enc).decode(bytes), warn: `This file's text encoding (${enc.toUpperCase()} without a marker) was guessed by Logos. If the words look wrong, save the file as UTF-8 and import it again.` }
  }
  const utf8 = new TextDecoder('utf-8').decode(bytes)
  const bad = (utf8.match(/\ufffd/g) ?? []).length
  if (!bad) return { text: utf8 }
  const legacy = new TextDecoder('windows-1252').decode(bytes)
  if (mojibake(legacy) < bad) return { text: legacy, warn: 'This file was written in an older text encoding, which Logos guessed. If some words look wrong, save the file as UTF-8 and import it again.' }
  return { text: utf8, warn: 'A few characters in this file could not be read and are shown as �. The rest of the book is intact.' }
}

export function decodeText(buf: ArrayBuffer): string {
  return decodeTextDetailed(buf).text
}
