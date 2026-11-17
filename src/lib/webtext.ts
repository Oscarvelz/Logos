// Bring the readable text of any web page into Logos, clean enough to listen to.
// GitHub Pages can't fetch other sites directly (CORS), so this tries, in order:
//   1. Wikipedia's own API (official, plain-text extracts)
//   2. Jina Reader (main-content extraction, CORS-enabled, free without a key)
//   3. public CORS relays + Mozilla Readability in the browser
// Every result goes through the same cleaner: no menus, links, images, tables,
// citation marks, "References" sections, cookie/newsletter lines or ad crumbs.

export type WebText = { title: string; text: string; site: string; url: string; words: number; via: string }

// Cure R3-T8-15: both stop lists were anchored to the bare name, so
// a heading wearing its full real-world name — "References and
// notes" — matched neither, was imported as a heading, and every
// citation after it imported as article body. A trailing
// "and/&/y …" qualifier now belongs to the section's name on both
// lists. (A connector is required: "Notes on the text" is a real
// section and still does not match.)
const STOP_SECTIONS = /^(references|notes|footnotes|citations|sources|bibliography|external links|see also|further reading|related (articles|posts|stories)|more (stories|from)|you may also like|read (more|next)|recommended|comments?|share this( article)?|about the author|referencias|notas|bibliograf[ií]a|enlaces externos|v[eé]ase tambi[eé]n|lectura adicional|art[ií]culos relacionados|comentarios|fuentes|data safety|ratings and reviews|what[’']s new|app support|similar apps|more by .{1,40}|flag as inappropriate|seguridad de los datos|calificaciones y opiniones|valoraciones y reseñas|asistencia de la app|apps similares)(\s+(and|&|y)\s+.{1,40})?\s*:?$/i

// Cure R2-T8-10: the bare-domain form blessed ANY dotted token —
// "e.g", "U.S.A", "Ph.D", "word.word" all became addresses, and the
// number "3.5" became https://3.0.0.5/ — so a lone copied token
// offered "Read page" instead of being read aloud. A bare host (no
// scheme, no www.) must now be address-shaped: its last label a
// two-letter country code or a known TLD, and a dotted all-numeric
// token is a number unless it is a full IPv4 address. Explicit
// https:// and www. forms show their intent and are not re-judged.
const BARE_TLDS = new Set(('com net org edu gov mil int info biz name pro aero asia cat coop jobs mobi museum post tel travel xxx ' +
  'academy agency app art audio apartments band bar bike blog blue book boutique builders business buzz cafe camera camp capital cards care careers cars casa cash center ceo chat cheap church city claims clinic clothing cloud club coach codes coffee college community company computer condos construction consulting contact contractors cooking cool country credit cruises dating deals degree delivery dental dentist design dev diamonds digital direct directory discount docs dog domains download earth education email energy engineer engineering enterprises equipment estate events exchange expert express extensions faith fan fans farm fashion finance financial fish fishing fitness flights florist flowers football forum foundation fun fund furniture fyi gallery game games garden gifts gives glass global gold golf graphics green group guide guitars guru haus health healthcare help hockey holdings holiday homes horse hospital host hosting house how immo industries ink institute insure international investments io jewelry kitchen land law lawyer lease legal life lighting link live living llc loan loans lol love ltd luxury maison management market marketing markets mba me media meet memorial menu miami mobi moda money movie network news ninja nyc observer one online organic page partners parts party pets pharmacy photo photography photos pics pictures pink pizza place plumbing plus poker press productions promo properties property protection pub racing radio recipes red rehab reisen rentals repair report republican rest restaurant restaurants reviews rocks rugby run sale salon samples school science security services shop shopping show singles site ski soccer social software solar solutions space sport sports storage store stream studio style supplies supply support surf surgery systems tattoo tax taxi team tech technology tennis theater theatre tickets tips tires today tokyo tools top tours town toys trade trading training tube university vacations vegas ventures vet video villas vin vip vision vote voting voyage watch watches webcam website wedding wiki win wine world wtf work works xyz yoga zone click').split(' '))
function bareDomainOk(host: string): boolean {
  const labels = host.toLowerCase().split('.')
  if (labels.length < 2 || labels.some((l) => !l)) return false
  if (labels.every((l) => /^\d+$/.test(l))) return labels.length === 4 && labels.every((l) => Number(l) <= 255)
  const tld = labels[labels.length - 1]
  return tld.length === 2 || BARE_TLDS.has(tld)
}

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
  // Cure R2-T8-10 (the test itself is above): a match from the
  // bare-domain alternative — no scheme, no www. — must be
  // address-shaped, or the token is prose, not a link.
  if (!/^https?:/i.test(s) && !/^www\./i.test(s) && !bareDomainOk(s.split('/')[0])) return null
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

// Cure R2-T8-16: the third family used to lump the subscription pitch
// (subscribe / newsletter) together with the account pitch (sign up /
// log in) as ONE family, so a long paragraph that was nothing but a
// subscription pitch — both halves of that genre in its own words —
// counted as a single family and sailed past the two-family bar as
// article body. The two genres are separate families now: a pitch
// that works both of them is boilerplate-shaped, while a real
// paragraph mentioning one of them in passing still counts once.
// Cure R3-T8-14: the families are now the ONLY junk test (the old
// single-regex JUNK retired into them — "comparte" joins the share
// family and the navigation crumbs "skip to / read more / leer más"
// form a family of their own), because finish() applies the
// two-family standard at every length; see there.
const JUNK_FAMILIES = [/cookie/i, /privacy|terms of/i, /subscribe|newsletter|suscr[ií]b|bolet[ií]n/i, /sign (up|in)|log ?in|inicia sesi[oó]n/i, /advertis|sponsored|publicidad/i, /all rights reserved|todos los derechos/i, /follow us|share (this|on)|click here|download (the|our) app|s[ií]guenos|haz clic|comparte/i, /skip to|read more|leer m[aá]s/i]
/** Boilerplate-shaped: junk terms from at least two different families. */
const junkHeavy = (t: string) => JUNK_FAMILIES.filter((re) => re.test(t)).length >= 2

/**
 * A page's own title, with only the site-name suffix removed (cure
 * F8-10). The old stripper blindly cut any trailing dash-phrase of
 * 2–40 chars, so "The End - Part Two" lost its real ending. Now a
 * suffix — dash OR pipe — is removed only when it actually names the
 * site the page came from; anything else is the title's own words
 * and stays. (The pipe branch originally skipped the site check —
 * cure R2-T8-15: "Faith | Hope | Love" lost "| Love", "Part One |
 * The Beginning" lost its second half.)
 */
function cleanTitle(raw: string, u?: URL): string {
  const title = (raw ?? '').trim()
  if (!title) return ''
  const namesSite = (tail: string): boolean => {
    if (!u) return false
    const host = u.hostname.replace(/^(www|m|mobile|amp)\./, '').split('.')[0].toLowerCase()
    const t = tail.toLowerCase().replace(/[^a-z0-9]+/g, '')
    // Cure R3-T8-16: the third leg — host.startsWith(t) — convicted
    // innocent titles: on ports.com, "Sailing Home - Port" lost
    // " - Port", because "ports" starts with the title's own word
    // "port". A tail names the site when it IS the host's name, or
    // carries it whole at its head ("bbcnews" on bbc) — never when
    // it is merely a prefix of a longer host word.
    return !!host && !!t && (t === host || t.startsWith(host))
  }
  const pipe = title.lastIndexOf(' | ')
  if (pipe > 0 && namesSite(title.slice(pipe + 3))) return title.slice(0, pipe).trim()
  if (u) {
    const m = title.match(/^(.*?)\s[–—-]\s([^\s–—-][^–—-]{1,40})$/)
    if (m && namesSite(m[2])) return m[1].trim()
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

// Cure R2-T8-18: the reference apparatus — References, Footnotes,
// Citations, Bibliography, External links, See also and their Spanish
// twins — is never article body, at any article length. These stop
// the import outright; the softer stop sections (Notes, Comments,
// Recommended…) keep the old rule below.
const HARD_STOP_SECTIONS = /^(references|footnotes|citations|bibliography|external links|see also|further reading|referencias|bibliograf[ií]a|enlaces externos|v[eé]ase tambi[eé]n)(\s+(and|&|y)\s+.{1,40})?\s*:?$/i

/** Paragraph blocks → clean listening text (title first, then paragraphs). */
function finish(blocks: { text: string; heading?: boolean }[], title: string): string {
  const out: { t: string; heading?: boolean }[] = []
  const seen = new Set<string>()
  const tnorm = title.toLowerCase().replace(/\W+/g, '')
  for (const b of blocks) {
    const t = tidyLine(b.text)
    if (!t) continue
    const words = t.split(' ').length
    if (b.heading || (words <= 6 && !/[.!?…:"”»]$/.test(t))) {
      // Cure R2-T8-18: the old rule skipped a stop heading ALONE when
      // three or fewer blocks were out and imported everything after
      // it — in a short article the whole reference list became body
      // and was read aloud. A hard stop section now breaks at any
      // length; a soft one in a short article still only loses its
      // heading, as before.
      if (STOP_SECTIONS.test(t)) { if (HARD_STOP_SECTIONS.test(t) || out.length > 3) break; else continue }
      if (t.toLowerCase().replace(/\W+/g, '') === tnorm) continue
      if (!b.heading && words <= 3 && !/^[A-ZÁÉÍÓÚÑ]/.test(t)) continue
    }
    // Cure F8-12: the junk test used to stop at 160 chars, so a long
    // GDPR/consent paragraph — exactly the boilerplate that runs long —
    // was never tested and imported as article body. Long blocks are
    // now dropped too, but only when they are boilerplate-shaped: at
    // least two distinct junk families (a real paragraph that merely
    // mentions subscribing or cookies once is kept, untouched).
    // Cure R3-T8-14: the short road kept the pre-F8-12 standard —
    // ONE family dropped a block under 160 chars while a long one
    // needed two — so a real 118-char paragraph mentioning
    // "subscribe" once was silently deleted while its 218-char twin
    // was kept. F8-12's ruling (one mention is not boilerplate)
    // governs every length now: junkHeavy is the only junk test.
    if (junkHeavy(t)) continue
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
    out.push({ t, heading: b.heading })
  }
  // A heading left dangling at the very end reads oddly — but only a
  // HEADING may be popped for it (cure R2-T8-17). The old loop popped
  // any short tail block without terminal punctuation, so a page
  // ending in unpunctuated closing lines — a poem's last lines, a
  // caption, "…and that was all" — lost them all, silently, one pop
  // at a time. A closing line is content; a dangling heading is not.
  while (out.length) {
    const last = out[out.length - 1]
    if (last.heading && last.t.split(' ').length <= 6 && !/[.!?…"”]$/.test(last.t)) out.pop()
    else break
  }
  return [title, ...out.map((o) => o.t)].filter(Boolean).join('\n\n')
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
