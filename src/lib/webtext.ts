// Bring the readable text of any web page into Logos, clean enough to listen to.
// GitHub Pages can't fetch other sites directly (CORS), so this tries, in order:
//   1. Wikipedia's own API (official, plain-text extracts)
//   2. Jina Reader (main-content extraction, CORS-enabled, free without a key)
//   3. public CORS relays + Mozilla Readability in the browser
// Every result goes through the same cleaner: no menus, links, images, tables,
// citation marks, "References" sections, cookie/newsletter lines or ad crumbs.

export type WebText = { title: string; text: string; site: string; url: string; words: number; via: string }

const STOP_SECTIONS = /^(references|notes|footnotes|citations|sources|bibliography|external links|see also|further reading|related (articles|posts|stories)|more (stories|from)|you may also like|read (more|next)|recommended|comments?|share this( article)?|about the author|referencias|notas|bibliograf[ií]a|enlaces externos|v[eé]ase tambi[eé]n|lectura adicional|art[ií]culos relacionados|comentarios|fuentes|data safety|ratings and reviews|what[’']s new|app support|similar apps|more by .{1,40}|flag as inappropriate|seguridad de los datos|calificaciones y opiniones|valoraciones y reseñas|asistencia de la app|apps similares)\s*:?$/i
const JUNK = /(cookie|subscribe|newsletter|sign (up|in)|log ?in|advertis|sponsored|all rights reserved|follow us|share (this|on)|click here|read more|skip to|privacy policy|terms of (use|service)|download (the|our) app|suscr[ií]b|bolet[ií]n|inicia sesi[oó]n|publicidad|todos los derechos|s[ií]guenos|leer m[aá]s|comparte|haz clic)/i

export function normalizeUrl(raw: string): string | null {
  // Cure F8-6: sentence punctuation copied along with a bare domain
  // ("…see example.com.") used to make the anchored bare-domain form
  // fail outright, while the https:// form accepted and stripped it —
  // the link was read aloud as prose instead of offering "Read page".
  // Strip the same trailing punctuation up front, for every form; the
  // selective loop below still guards balanced parentheses.
  const cleaned = raw.trim().replace(/[.,;]+$/, '')
  const s = cleaned.match(/https?:\/\/[^\s<>"'`]+|(?:www\.)[^\s<>"'`]+|^[a-z0-9-]+(\.[a-z0-9-]+)+(\/[^\s]*)?$/i)?.[0]
  if (!s) return null
  try {
    const u = new URL(/^https?:/i.test(s) ? s : `https://${s}`)
    if (!u.hostname.includes('.')) return null
    // Strip sentence punctuation copied along with the link (".", ",", ";"),
    // and a trailing ")" only when it is unbalanced — balanced parens belong
    // to the address itself (e.g. Wikipedia's Apple_(fruit)).
    let out = u.toString()
    for (;;) {
      const last = out[out.length - 1]
      if (last === '.' || last === ',' || last === ';') { out = out.slice(0, -1); continue }
      if (last === ')' && (out.match(/\)/g)?.length ?? 0) > (out.match(/\(/g)?.length ?? 0)) { out = out.slice(0, -1); continue }
      break
    }
    return out
  } catch { return null }
}

const JUNK_FAMILIES = [/cookie/i, /privacy|terms of/i, /subscribe|newsletter|sign (up|in)|log ?in|suscr[ií]b|bolet[ií]n|inicia sesi[oó]n/i, /advertis|sponsored|publicidad/i, /all rights reserved|todos los derechos/i, /follow us|share (this|on)|click here|download (the|our) app|s[ií]guenos|haz clic/i]
/** Boilerplate-shaped: junk terms from at least two different families. */
const junkHeavy = (t: string) => JUNK_FAMILIES.filter((re) => re.test(t)).length >= 2

/**
 * A page's own title, with only the site-name suffix removed (cure
 * F8-10). The old stripper blindly cut any trailing dash-phrase of
 * 2–40 chars, so "The End - Part Two" lost its real ending. Now: a
 * pipe suffix ("Article | Site Name") is the site's, and a dash
 * suffix is removed only when it actually names the site the page
 * came from — anything else is the title's own words and stays.
 */
function cleanTitle(raw: string, u?: URL): string {
  const title = (raw ?? '').trim()
  if (!title) return ''
  const pipe = title.lastIndexOf(' | ')
  if (pipe > 0) return title.slice(0, pipe).trim()
  if (u) {
    const m = title.match(/^(.*?)\s[–—-]\s([^\s–—-][^–—-]{1,40})$/)
    if (m) {
      const host = u.hostname.replace(/^(www|m|mobile|amp)\./, '').split('.')[0].toLowerCase()
      const tail = m[2].toLowerCase().replace(/[^a-z0-9]+/g, '')
      if (host && tail && (tail === host || tail.startsWith(host) || host.startsWith(tail))) return m[1].trim()
    }
  }
  return title
}

/** True when the whole input is just a link (so paste can offer to bring the page). */
export const isJustUrl = (t: string) => { const s = t.trim(); return !!s && !/\s/.test(s) && !!normalizeUrl(s) }

const siteName = (u: string) => new URL(u).hostname.replace(/^(www|m|mobile|amp)\./, '')

function timeout(ms: number, outer?: AbortSignal) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  outer?.addEventListener('abort', () => c.abort(), { once: true })
  return { signal: c.signal, done: () => clearTimeout(t) }
}

// ── cleaning ───────────────────────────────────────────────
function tidyLine(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')                  // images
    .replace(/\[([^\]]*)\]\((?:[^()]|\([^)]*\))*\)/g, '$1')  // links → their words
    .replace(/\[(\d+|[a-z]|citation needed|edit|editar|cita requerida|nota \d+)\]/gi, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/(\*\*|__|`)/g, '').replace(/(^|\s)[*_](\S[^*_]*\S|\S)[*_](?=\s|$|[.,;:!?])/g, '$1$2')
    .replace(/^\s*(#{1,6}|>+|[-*+•·]|\d+[.)])\s+/, '')
    .replace(/\s+([.,;:!?])/g, '$1').replace(/[ \t\u00a0]+/g, ' ')
    .trim()
}

/** Paragraph blocks → clean listening text (title first, then paragraphs). */
function finish(blocks: { text: string; heading?: boolean }[], title: string): string {
  const out: string[] = []
  const seen = new Set<string>()
  const tnorm = title.toLowerCase().replace(/\W+/g, '')
  for (const b of blocks) {
    const t = tidyLine(b.text)
    if (!t) continue
    const words = t.split(' ').length
    if (b.heading || (words <= 6 && !/[.!?…:"”»]$/.test(t))) {
      if (STOP_SECTIONS.test(t)) { if (out.length > 3) break; else continue }
      if (t.toLowerCase().replace(/\W+/g, '') === tnorm) continue
      if (!b.heading && words <= 3 && !/^[A-ZÁÉÍÓÚÑ]/.test(t)) continue
    }
    if (t.length < 160 && JUNK.test(t)) continue
    // Cure F8-12: the junk test used to stop at 160 chars, so a long
    // GDPR/consent paragraph — exactly the boilerplate that runs long —
    // was never tested and imported as article body. Long blocks are
    // now dropped too, but only when they are boilerplate-shaped: at
    // least two distinct junk families (a real paragraph that merely
    // mentions subscribing or cookies once is kept, untouched).
    if (t.length >= 160 && junkHeavy(t)) continue
    if (/^(image|photo|foto|imagen|credit|cr[eé]dito|source|fuente)s?\b.{0,80}$/i.test(t)) continue
    if (/(hide|toggle|show) caption$/i.test(t)) continue
    if (t.length < 160 && /(Getty Images|AP Photo|Reuters|AFP|Shutterstock|iStock|EFE|Europa Press|Alamy|\bvia (Getty|AP)\b)/.test(t)) continue
    if (/^(published|updated|posted|last (updated|modified)|publicado|actualizado|fecha)\b.{0,70}$/i.test(t)) continue
    if (/^(by|por)\s+[A-ZÁÉÍÓÚÑ][\w.'’-]+(\s+[A-ZÁÉÍÓÚÑ][\w.'’-]+){0,3}(\s*(,|and|y|&)\s*[A-ZÁÉÍÓÚÑ][\w.'’-]+(\s+[A-ZÁÉÍÓÚÑ][\w.'’-]+){0,3})*$/.test(t)) continue
    if (/^((\d{1,2}\s+(de\s+)?)?[A-Za-zé]{3,10}\.?\s+(\d{1,2},?\s+)?(de\s+)?\d{4}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})(\s*[-–·|,]\s*\d{1,2}:\d{2}.*)?$/i.test(t)) continue
    if (/^\d+\s*(min(ute)?s?|minutos?)\s*(read|de lectura)?$/i.test(t)) continue
    if (/^[\W\d_]+$/.test(t)) continue
    const key = t.toLowerCase()
    // Cure F8-11: this dedupe used to delete every repeated body block
    // under 200 chars — the refrains of a poem or song, a repeated
    // pull-line — silently, so the listening text no longer matched
    // the page. Repetition in body text is content, not boilerplate:
    // only repeated HEADINGS (menu/section crumbs) are deduped now.
    if (b.heading && seen.has(key)) continue
    seen.add(key)
    out.push(b.heading && !/[.!?:]$/.test(t) ? t : t)
  }
  // a heading left dangling at the very end reads oddly
  while (out.length && out[out.length - 1].split(' ').length <= 6 && !/[.!?…"”]$/.test(out[out.length - 1])) out.pop()
  return [title, ...out].filter(Boolean).join('\n\n')
}

function fromMarkdown(md: string, title: string): string {
  const lines = md.replace(/\r/g, '').split('\n')
  const blocks: { text: string; heading?: boolean }[] = []
  let para: string[] = []
  const flush = () => { if (para.length) { blocks.push({ text: para.join(' ') }); para = [] } }
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    const next = lines[i + 1] ?? ''
    if (/^\s*$/.test(l)) { flush(); continue }
    if (/^\s*\|/.test(l) || /^\s*([-=*_]\s*){3,}$/.test(l) || /^\s*```/.test(l)) { flush(); continue }
    if (/^\s*(=+|-+)\s*$/.test(next) && l.trim()) { flush(); blocks.push({ text: l, heading: true }); i++; continue }
    if (/^\s*#{1,6}\s/.test(l)) { flush(); blocks.push({ text: l, heading: true }); continue }
    if (/^\s*([-*+•]|\d+[.)])\s+/.test(l)) { flush(); blocks.push({ text: l }); continue }
    para.push(l.trim())
  }
  flush()
  return finish(blocks, title)
}

function fromHtmlDoc(root: ParentNode, title: string): string {
  const blocks: { text: string; heading?: boolean }[] = []
  root.querySelectorAll('figure, figcaption, table, aside, nav, footer, form, button, sup.reference, .mw-editsection, style, script, noscript, svg').forEach((n) => n.remove())
  root.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote, pre').forEach((el) => {
    if (el.closest('li') && el.tagName !== 'LI') return
    if (el.tagName === 'LI' && el.querySelector('p')) return
    const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (t) blocks.push({ text: t, heading: /^H[1-6]$/.test(el.tagName) })
  })
  return finish(blocks, title)
}

// ── sources ────────────────────────────────────────────────
async function viaWikipedia(u: URL, signal: AbortSignal): Promise<WebText | null> {
  const m = u.hostname.match(/^([a-z-]+)\.(?:m\.)?wikipedia\.org$/)
  const page = decodeURIComponent(u.pathname.replace(/^\/wiki\//, ''))
  if (!m || !page || u.pathname === '/') return null
  const api = `https://${m[1]}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=wiki&redirects=1&format=json&origin=*&titles=${encodeURIComponent(page)}`
  const r = await fetch(api, { signal })
  const j = await r.json()
  const p = Object.values(j?.query?.pages ?? {})[0] as { title?: string; extract?: string } | undefined
  if (!p?.extract) return null
  const blocks = p.extract.split(/\n+/).map((l) => { const h = l.match(/^=+\s*(.*?)\s*=+$/); return h ? { text: h[1], heading: true } : { text: l } })
  const title = p.title ?? page
  return pack(finish(blocks, title), title, u, 'Wikipedia')
}

async function viaJina(u: URL, signal: AbortSignal): Promise<WebText | null> {
  const r = await fetch(`https://r.jina.ai/${u.toString()}`, { signal, headers: { Accept: 'application/json', 'X-Retain-Images': 'none', 'X-With-Links-Summary': 'false' } })
  if (!r.ok) return null
  const j = await r.json()
  const d = j?.data
  if (!d?.content) return null
  const title = cleanTitle(d.title ?? '', u)
  return pack(fromMarkdown(d.content, title), title, u, 'Jina Reader')
}

const RELAYS = [
  (x: string) => `https://api.cors.lol/?url=${encodeURIComponent(x)}`,
  (x: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(x)}`,
  (x: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(x)}`,
  (x: string) => `https://corsproxy.io/?url=${encodeURIComponent(x)}`,
]

async function viaRelay(u: URL, relay: (x: string) => string, signal: AbortSignal): Promise<WebText | null> {
  const r = await fetch(relay(u.toString()), { signal })
  if (!r.ok) return null
  const html = await r.text()
  if (html.length < 400) return null
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const base = doc.createElement('base'); base.href = u.toString(); doc.head.prepend(base)
  const { Readability } = await import('@mozilla/readability')
  const art = new Readability(doc, { charThreshold: 400 }).parse()
  if (!art?.content) return null
  const holder = new DOMParser().parseFromString(art.content, 'text/html').body
  const title = cleanTitle(art.title ?? doc.title ?? '', u)
  return pack(fromHtmlDoc(holder, title), title, u, 'Readability')
}

function pack(text: string, title: string, u: URL, via: string): WebText | null {
  const words = text.split(/\s+/).filter(Boolean).length
  if (words < 40) return null
  return { title: title || siteName(u.toString()), text, site: siteName(u.toString()), url: u.toString(), words, via }
}

/** Fetch a page's readable text. Throws a friendly message when nothing worked. */
export async function fetchWebText(raw: string, outer?: AbortSignal): Promise<WebText> {
  const norm = normalizeUrl(raw)
  if (!norm) throw new Error('That doesn’t look like a web address.')
  const u = new URL(norm)
  // Relays race each other: the first clean result wins, the rest are cancelled.
  const raceRelays = async (s: AbortSignal): Promise<WebText | null> => {
    const c = new AbortController(); s.addEventListener('abort', () => c.abort(), { once: true })
    try {
      return await Promise.any(RELAYS.map((rl) => viaRelay(u, rl, c.signal).then((r) => r ?? Promise.reject(new Error('empty')))))
    } catch { return null } finally { c.abort() }
  }
  const tries: ((s: AbortSignal) => Promise<WebText | null>)[] = [
    (s) => viaWikipedia(u, s),
    (s) => viaJina(u, s),
    raceRelays,
  ]
  for (const t of tries) {
    if (outer?.aborted) throw new DOMException('Aborted', 'AbortError')
    const to = timeout(20000, outer)
    try { const r = await t(to.signal); if (r) return r } catch { /* next source */ } finally { to.done() }
  }
  if (outer?.aborted) throw new DOMException('Aborted', 'AbortError')
  throw new Error('Couldn’t read that page. It may need a sign-in, block readers, or be mostly video or images.')
}
