// A short, complete title (and, when the text has no heading, a one-line summary) for the Listen header.
// All on-device and instant. Never truncates with an ellipsis: it picks words that fit instead.
import type { Lang } from './voices.ts'

export interface TextInfo { title: string; summary?: string; generated: boolean }

const STOP_EN = new Set(('a an the and or but if of to in on at by for with from as is are was were be been being it its this that these those he she they we you i his her their our your my me him them us not no so than then there here when where who whom which what why how all any each every some such only own same very can will would should could may might must do does did done have has had having into over under about after before between through during without within also just more most other another one two three new first last many much said says say like mr mrs ms dr').split(' '))
const STOP_ES = new Set(('el la los las un una unos unas y o pero si de del al a en por para con sin sobre entre desde hasta que qué quien quién cual cuál como cómo cuando cuándo donde dónde es son era eran fue fueron ser sido estar está están estaba este esta estos estas ese esa esos esas aquel su sus mi mis tu tus lo le les se nos no ni ya muy más menos también solo sólo otro otra otros otras todo toda todos todas uno dos tres hay han ha había dijo dice según sr sra').split(' '))

const SENT_RE = /[^.!?¡¿…]+[.!?…]+["'”’)]*|[^.!?…]+$/g

function sentences(text: string): string[] {
  return (text.replace(/\[(?:\d+|[a-z]|citation needed|cita requerida)\]/gi, '').replace(/\s+/g, ' ').match(SENT_RE) ?? []).map((s) => s.trim()).filter((s) => s.length > 2)
}

// A first line that reads like a heading: short, no full stop at the end, followed by more text.
function headingLine(text: string): string | null {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return null
  const l = lines[0].replace(/^#+\s*/, '').replace(/[*_`]/g, '').trim()
  const words = l.split(/\s+/).length
  if (l.length < 3 || l.length > 72 || words > 12) return null
  if (/[.,;:]$/.test(l) && !/[?!]$/.test(l)) return null
  return l
}

function isStop(w: string, lang: Lang) {
  const k = w.toLowerCase()
  return (lang === 'es' ? STOP_ES : STOP_EN).has(k) || STOP_EN.has(k) || STOP_ES.has(k)
}

// Proper names: runs of capitalised words (Virginia Roberts Giuffre), merged so "Giuffre" counts toward the full name.
function names(text: string, lang: Lang): { name: string; n: number; first: number }[] {
  const found = new Map<string, { n: number; first: number }>()
  const re = /(?:[A-ZÁÉÍÓÚÑ][\p{L}'’-]+)(?:\s+(?:de|del|la|von|van|da|di|y)?\s*[A-ZÁÉÍÓÚÑ][\p{L}'’-]+)*/gu
  for (const s of sentences(text)) {
    let m: RegExpExecArray | null
    const offset = text.indexOf(s)
    while ((m = re.exec(s))) {
      let name = m[0].trim()
      const parts = name.split(/\s+/)
      // a lone capitalised word that starts the sentence is usually just a sentence opener
      if (m.index === 0 && parts.length === 1 && isStop(name, lang)) continue
      if (parts.length === 1 && (isStop(name, lang) || name.length < 3)) continue
      while (parts.length && isStop(parts[0], lang)) parts.shift()
      name = parts.join(' ')
      if (!name || /^\p{Lu}+$/u.test(name) && name.length > 6) continue
      const cur = found.get(name)
      if (cur) cur.n++; else found.set(name, { n: 1, first: offset + m.index })
    }
  }
  const list = [...found.entries()].map(([name, v]) => ({ name, ...v }))
  // fold short mentions ("Giuffre", "Epstein") into the longest name that contains them
  for (const a of list) for (const b of list) {
    if (a !== b && a.n > 0 && b.name.split(/\s+/).length > a.name.split(/\s+/).length && b.name.split(/\s+/).includes(a.name)) { b.n += a.n; a.n = 0 }
  }
  return list.filter((x) => x.n > 0).sort((a, b) => b.n - a.n || a.first - b.first)
}

function keywords(text: string, lang: Lang): Map<string, number> {
  const freq = new Map<string, number>()
  for (const w of text.toLowerCase().match(/[\p{L}]{4,}/gu) ?? []) if (!isStop(w, lang)) freq.set(w, (freq.get(w) ?? 0) + 1)
  return freq
}

function shortName(name: string, max = 28): string {
  if (name.length <= max) return name
  const p = name.split(/\s+/)
  return p.length > 2 ? `${p[0]} ${p[p.length - 1]}` : p[p.length - 1]
}

const ORG_EN = new Set('department senate house court university government ministry council bank party state army united white supreme federal national european world city museum congress parliament republic church league'.split(' '))
const ORG_ES_M = new Set('departamento senado gobierno congreso tribunal ministerio consejo banco partido estado ejército papa presidente parlamento museo vaticano'.split(' '))
const ORG_ES_F = new Set('corte casa universidad comisión policía organización unión fiscalía iglesia liga ciudad república asamblea'.split(' '))
// "On the Department of Justice", "Sobre el Departamento de Justicia"; people keep their bare names.
function withArticle(name: string, es: boolean): string {
  const w = name.split(/\s+/)[0].toLowerCase()
  if (es) return ORG_ES_M.has(w) ? `el ${name}` : ORG_ES_F.has(w) ? `la ${name}` : name
  return ORG_EN.has(w) ? `the ${name}` : name
}

function cap(s: string) { return s.charAt(0).toLocaleUpperCase() + s.slice(1) }

function isPoem(text: string) {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 4) return false
  const short = lines.filter((l) => l.length < 60 && !/[.]$/.test(l)).length
  return short / lines.length > 0.7
}

// The sentence that best says what the text is about: rich in its key words, short enough to read at a glance.
function bestSentence(text: string, lang: Lang, maxLen = 108): string | undefined {
  const ss = sentences(text)
  if (!ss.length) return undefined
  const kw = keywords(text, lang)
  const nm = names(text, lang).slice(0, 4).map((n) => n.name.toLowerCase())
  let best: { s: string; score: number } | undefined
  ss.slice(0, 14).forEach((s, i) => {
    const words = s.toLowerCase().match(/[\p{L}]{4,}/gu) ?? []
    let score = words.reduce((a, w) => a + Math.min(4, (kw.get(w) ?? 0) - 1), 0) / Math.sqrt(words.length + 1)
    score += nm.filter((n) => s.toLowerCase().includes(n.split(' ').pop()!)).length * 0.8
    score *= 1 - i * 0.04 // earlier sentences usually set the scene
    if (s.length > maxLen) {
      // a long sentence still works if its opening clause stands on its own
      const clause = s.slice(0, maxLen).match(/^(.{40,})[,;:—–]\s/)?.[1]
      if (!clause) return
      s = clause + '.'
      score *= 0.85
    }
    if (s.length < 30) score *= 0.6
    // a sentence that leans on what came before ("She said…", "At the time…") doesn't stand alone as a summary
    if (/^(she|he|it|they|this|that|these|those|his|her|their|but|however|also|then|at the time|later|ella|él|ellos|ellas|esto|eso|pero|sin embargo|también|luego|entonces|en ese momento)\b/i.test(s)) score *= 0.35
    if (!best || score > best.score) best = { s, score }
  })
  return best?.s.replace(/^[«"“'‘]+|[»"”'’]+$/g, '').trim()
}

export function describeText(text: string, lang: Lang): TextInfo {
  const clean = text.trim()
  if (!clean) return { title: '', generated: false }
  const head = headingLine(clean)
  if (head) return { title: head, generated: false }
  const es = lang === 'es'
  const nm = names(clean, lang)
  const poem = isPoem(clean)
  const kw = [...keywords(clean, lang).entries()].filter(([w]) => !nm.some((n) => n.name.toLowerCase().includes(w))).sort((a, b) => b[1] - a[1])
  let title: string
  const top = nm[0], second = nm[1]
  if (poem) title = es ? (top ? `Un poema sobre ${shortName(top.name)}` : 'Un poema') : (top ? `A Poem on ${shortName(top.name)}` : 'A Poem')
  else if (top && second && top.n >= 2 && second.n >= 2 && (shortName(top.name, 18) + shortName(second.name, 18)).length <= 36) title = cap(`${withArticle(shortName(top.name, 18), es)} ${es ? 'y' : 'and'} ${withArticle(shortName(second.name, 18), es)}`)
  else if (top && top.n >= 2) title = es ? `Sobre ${withArticle(shortName(top.name, 32), true)}` : `On ${withArticle(shortName(top.name, 32), false)}`
  else if (kw[0] && kw[0][1] >= 2) title = es ? `Sobre ${kw[0][0]}` : `On ${cap(kw[0][0])}`
  else if (top && top.name.includes(' ')) title = es ? `Sobre ${withArticle(shortName(top.name, 32), true)}` : `On ${withArticle(shortName(top.name, 32), false)}`
  else if ((sentences(clean)[0] ?? '').length <= 48) title = sentences(clean)[0].replace(/[.…]+$/, '')
  else title = es ? 'Un texto para escuchar' : 'A Text to Listen To'
  const summary = poem ? undefined : bestSentence(clean, lang)
  return { title, summary: summary && summary !== title ? summary : undefined, generated: true }
}

// Chrome's built-in on-device summarizer, when the phone already has it. Never triggers a model download.
export async function aiDescribe(text: string): Promise<{ title?: string; summary?: string } | null> {
  try {
    const S = (globalThis as any).Summarizer
    if (!S || (await S.availability()) !== 'available') return null
    const sample = text.slice(0, 6000)
    const h = await S.create({ type: 'headline', length: 'short', format: 'plain-text' })
    const t = await S.create({ type: 'tldr', length: 'short', format: 'plain-text' })
    const [title, summary] = await Promise.all([h.summarize(sample), t.summarize(sample)])
    h.destroy?.(); t.destroy?.()
    const one = (s: string) => s.replace(/\s+/g, ' ').replace(/^["“]|["”]$/g, '').trim()
    return { title: title ? one(title).replace(/[.]$/, '') : undefined, summary: summary ? one(summary).split(/(?<=[.!?])\s/)[0] : undefined }
  } catch { return null }
}
