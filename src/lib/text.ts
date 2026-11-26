// Sentence segmentation tuned for streaming TTS (English + Spanish), and a
// lightweight English/Spanish language detector.
import type { Lang } from './voices.ts'
import { applyPron } from './pronounce.ts'

export type Segment = {
  index: number
  text: string
  /** character offsets into the source text */
  start: number
  end: number
  /** true when this segment ends a paragraph (adds a longer pause) */
  paraEnd: boolean
  /** false when this piece stops mid-sentence (at a comma or semicolon): only a short breath follows */
  sentEnd: boolean
  lang: Lang
}

const ABBREV = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'etc', 'e.g', 'i.e', 'inc', 'ltd', 'co', 'no', 'vol', 'fig', 'approx', 'dept', 'est', 'mt', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
  'sra', 'srta', 'uu', 'ee', 'hh', 'aa', 'oo', 'mm', 'vv', 'dra', 'ud', 'uds', 'pág', 'pag', 'núm', 'num', 'av', 'avda', 'lic', 'ing', 'arq', 'cap', 'art', 'aprox', 'p.ej', 'ej', 'tel',
  // Cure F8-3: common honorifics that were missing — "Gen. Grant" split
  // "Gen." off as its own spoken sentence (also Sen./Rev./Gov./…).
  'gen', 'sen', 'rep', 'gov', 'col', 'sgt', 'capt', 'lt', 'rev', 'hon',
  // Cure F8-4: dotted initialisms — "U.S." before a capital split mid-name
  // ("The U.S. / Senate voted…") because lastWord "u.s" matched nothing.
  'u.s', 'u.s.a', 'd.c', 'ee.uu', 'ph.d',
])

// Titles and name-prefixes: a name follows in the continuation case
// ("El Sr. García…"), so their period is a boundary only when what
// follows cannot be a name (cure F8-3's class, gated by cure R2-T8-3 —
// see TITLE_END_STARTERS below).
const TITLES = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'gen', 'sen', 'rep', 'gov', 'col', 'sgt', 'capt', 'lt', 'rev', 'hon', 'st', 'vs', 'mt',
  'sra', 'srta', 'dra', 'lic', 'ing', 'arq', 'cap',
])

// Words that, capitalised, open a fresh sentence after a dotted
// initialism ("…in the U.S. It was…") — cure F8-5's other half: an
// abbreviation's guard must not be unconditional, or a true sentence
// end before a capital ("…apples, etc. She went home.") merges two
// sentences into one segment with no pause.
const SENTENCE_STARTERS = new Set([
  'he', 'she', 'it', 'they', 'we', 'the', 'this', 'that', 'there', 'then', 'but', 'and', 'however', 'when', 'after', 'before', 'in', 'on', 'at', 'as', 'if', 'so', 'now', 'here',
  'él', 'ella', 'ello', 'esto', 'eso', 'pero', 'entonces', 'luego', 'cuando', 'después', 'sin',
  // Cure R2-T8-1: the Spanish articles — the commonest sentence openers
  // in Spanish prose ("…etc. El tren llegó…") — were missing, so the
  // gate welded every such pair into one segment. A capitalised article
  // after an abbreviation is a sentence opening in practice; the
  // mid-sentence capitals that continue ("EE. UU. Mexicanos…") are not
  // articles and still join.
  'el', 'la', 'los', 'las', 'un', 'una',
  // Cure R2-T8-2: the discourse openers were missing too — "…etc.
  // Suddenly…", "…etc. Today…", "…etc. Well,…" all welded. These words
  // open sentences and do not continue them after an abbreviation.
  // ("One" is deliberately NOT here: "No. One in the ranking" is a
  // continuation; the specimen "etc. One day later…" splits by the
  // etc. rule in the gate below, not by this list.)
  'suddenly', 'meanwhile', 'finally', 'today', 'yesterday', 'tomorrow', 'later', 'soon', 'again', 'well',
  'finalmente', 'hoy', 'ayer', 'también', 'además', 'ahora', 'mientras',
  // Cure R4-T8-12: the deictic day-part adverbs were missing their
  // night member — "…at 6 p.m. Tonight was bitterly cold." welded
  // while its twin with "Today" split. Same closed class (today /
  // yesterday / tomorrow / tonight; hoy / ayer / anoche), same role.
  'tonight', 'anoche',
])

// Cure R2-T8-3: a title word CAN end a sentence — "He walked down Main
// St. It was quiet." welded forever because TITLES skipped the gate
// unconditionally. A title now splits when what follows cannot be a
// name: a pronoun or discourse opener (this set), or a ¿/¡ opener. The
// set is SENTENCE_STARTERS minus the words that can belong to a name:
// the articles ("el Sr. Las Heras", "Sr. La Torre" are names) and
// "well" ("Mr. Well" is a name).
// Cure R4-T8-13: the prepositions were excluded wholesale on the same
// reasoning, but only the NAME PARTICLES can continue a name (de /
// del / la / las / los / el / y) — "in" cannot: "Main St. In the
// morning…" welded because the gate treated "In" as a name word. The
// plain prepositions and conjunctions (in / on / at / as / if, en)
// join the set; the particles stay out, as do the articles.
const TITLE_END_STARTERS = new Set([
  'he', 'she', 'it', 'they', 'we', 'this', 'that', 'there', 'then', 'but', 'and', 'however', 'when', 'after', 'before', 'so', 'now', 'here',
  'suddenly', 'meanwhile', 'finally', 'today', 'yesterday', 'tomorrow', 'later', 'soon', 'again',
  'él', 'ella', 'ello', 'esto', 'eso', 'pero', 'entonces', 'luego', 'cuando', 'después',
  'también', 'además', 'finalmente', 'ahora', 'mientras',
  'in', 'on', 'at', 'as', 'if', 'en', 'tonight', 'anoche',
])

// Segments follow the text's own shape: one sentence each. A sentence is only
// divided when it is long, and then only where a reader would breathe (a comma,
// semicolon, colon or dash), never between two words of the same phrase.
// The first pieces prefer a clause break sooner so audio starts fast.
const SOFT_MAX = 240
const HARD_MAX = 520
const RAMP = [110, 160, 200]

/** Pause after a segment: sentence pause, ×2.2 at a paragraph end, a short breath mid-sentence. */
export function pauseAfter(seg: Pick<Segment, 'paraEnd' | 'sentEnd'>, sentencePauseMs: number) {
  return sentencePauseMs * (seg.paraEnd ? 2.2 : seg.sentEnd === false ? 0.4 : 1)
}

/** Split text into speakable segments with offsets. */
export function segmentText(source: string, langMode: Lang | 'auto' = 'auto'): Segment[] {
  const out: (Omit<Segment, 'index' | 'lang'> & { paraLang: Lang })[] = []
  const docLang: Lang = langMode === 'auto' ? detectLang(source).lang : langMode
  const paraRe = /[^\n]+(?:\n(?!\s*\n)[^\n]*)*/g
  let m: RegExpExecArray | null
  while ((m = paraRe.exec(source))) {
    const para = m[0]
    const base = m.index
    if (!para.trim()) continue
    const pd = detectLang(para)
    const paraLang: Lang = langMode !== 'auto' ? langMode : pd.confidence >= 0.25 ? pd.lang : docLang
    const sentences = splitParaSentences(para)
    sentences.forEach((s, i) => {
      const pieces = capLength(para, s, RAMP[out.length] ?? SOFT_MAX)
      pieces.forEach((piece, k) => {
        out.push({ text: para.slice(piece.start, piece.end).replace(/\s+/g, ' ').trim(), start: base + piece.start, end: base + piece.end, paraEnd: false, sentEnd: k === pieces.length - 1, paraLang })
      })
      if (i === sentences.length - 1 && out.length) out[out.length - 1].paraEnd = true
    })
  }
  return out
    .filter((s) => /[\p{L}\p{N}]/u.test(s.text))
    .map(({ paraLang, ...s }, index) => {
      let lang: Lang = paraLang
      // 1.4.57: finer switching for mixed-language texts — a clearly-other-language
      // sentence now changes voice from ~24 characters up (a short quoted sentence
      // in a Spanish document used to be read with Spanish phonetics, and back).
      if (langMode === 'auto' && s.text.length > 24) {
        const d = detectLang(s.text)
        if (d.confidence >= 0.6) lang = d.lang
      }
      return { ...s, index, lang }
    })
}

type Span = { start: number; end: number }

/** True when a line ends mid-phrase, on a word that cannot close one
 * (an article, preposition, conjunction or complementiser, left bare —
 * a line ending "…went to." ends on the period, not the word, and does
 * not match). Shared by the wrap verdict and the continuation glue. */
const lineEndsOpen = (l: string) => /\b(?:the|a|an|of|to|in|on|at|by|for|with|from|and|or|but|that|el|la|los|las|un|una|de|del|en|con|por|para|y|o|que)$/i.test(l.trim())

/**
 * The ONE wrap verdict (cure R2-T8-7): are these lines hard-wrapped
 * prose — most long lines ending near one width — rather than a list
 * of standalone lines? Width alone also convicts a tidy list of long
 * items, whose lines cluster at one width exactly like a wrap column
 * (cure R2-T8-5), so a wrap verdict additionally needs wrap EVIDENCE
 * of continuation a list does not leave: most non-final lines ending
 * mid-phrase, or a short last line that runs on from the line above
 * (cure R3-T8-18 — the evidence legs are spelled out at the return).
 * This function is shared verbatim by intake (splitParaSentences,
 * per paragraph) and book import (formats.ts parseText, per
 * document), so the same text is judged the same way at both doors.
 */
export function isWrappedLines(lines: string[]): boolean {
  const long = lines.filter((l) => l.trim().length > 40)
  if (long.length < 6) return false
  const widths = long.map((l) => l.trimEnd().length).sort((a, b) => a - b)
  const wrapAt = widths[Math.floor(widths.length * 0.8)] ?? 0
  if (!(wrapAt < 110)) return false
  if (long.filter((l) => l.trimEnd().length >= wrapAt - 12).length <= long.length * 0.5) return false
  // Cure R3-T8-18: the two evidence legs convicted a tidy list — a
  // short last item plus two items ending on a glue word ("…of the",
  // "…in the") is exactly what an innocent list leaves behind. Wrap
  // evidence is about CONTINUATION, so both legs now ask for it: the
  // short last line counts only when it runs on from the line above
  // (that line ends mid-phrase, or the last line opens lowercase — a
  // fresh item opens as itself, capitalised), and scattered open
  // ends count only when they are the column's habit rather than
  // its accident — at least half the non-final lines ending
  // mid-phrase. A real wrap column breaks at its width wherever the
  // words fall, so most of its breaks land mid-phrase and its
  // remainder continues the line above; a list's items end complete,
  // each opening as its own sentence-shaped unit.
  const nonFinal = lines.slice(0, -1)
  const openEnds = nonFinal.filter(lineEndsOpen).length
  const lastLine = lines[lines.length - 1]
  const lastContinues = lineEndsOpen(nonFinal[nonFinal.length - 1] ?? '')
    || /^[a-zà-ÿ]/u.test(lastLine.trim().replace(/^["'“‘«(]+/u, ''))
  const lastLen = lastLine.trimEnd().length
  return (lastLen < wrapAt - 12 && lastContinues) || openEnds * 2 >= nonFinal.length
}

/**
 * Sentence spans for one paragraph, line-aware (cure F8-9). Unpunctuated
 * newline-separated lines — pasted lists, addresses, poem lines — used to
 * collapse into a single "sentence" that was then chopped mid-phrase by
 * the length cap. Hard-wrapped prose (the shared verdict above) joins
 * its lines and splits by punctuation exactly as before; otherwise each
 * line stands as its own unit — except a line flowing into a
 * continuation of a prose-shaped paragraph, which is wrapped prose
 * whatever the widths say (conditions in the body, cures R2-T8-4/6).
 */
function splitParaSentences(para: string): Span[] {
  if (!para.includes('\n')) return splitSentences(para)
  const lines = para.split('\n')
  if (isWrappedLines(lines)) return splitSentences(para)
  const spans: Span[] = []
  for (const c of lineChunks(lines)) {
    for (const s of splitSentences(c.text)) spans.push({ start: c.start + s.start, end: c.start + s.end })
  }
  return spans
}

/**
 * The line grouping splitParaSentences applies below the wrap
 * verdict: consecutive lines that flow into one another form one
 * chunk; every other line stands alone. Exported for book import
 * (formats.ts parseText) so the SAME text is grouped the same way at
 * both doors (cure R3-T8-10: below the wrap verdict's width evidence
 * the doors diverged — the paste door glued continuations into
 * sentences while import flushed every line into its own block, so a
 * narrow-wrapped sentence imported as one block per line, each read
 * with a paragraph's pause, its severed halves never rejoining).
 */
export function chunkLines(lines: string[]): string[] {
  return lineChunks(lines).map((c) => c.text)
}

/** Cure R3-T8-4: lineEndsOpen judges a line-final word's SHAPE, but
 * two of its words close clauses in another ROLE — demonstrative
 * "that" ("He said only that") and the phrasal particle "in" ("…
 * finally gave in") — and a complete sentence ending on either glued
 * to the next line's sentence and read as one run-on. A capital
 * continuation glues only when the open-ended reading is the
 * plausible one: "that" with a demonstrative licenser before it
 * (only / just / all / after / before + that) does not glue, and
 * "in" does not glue into a line opening with a subject pronoun —
 * a new sentence's subject, where a preposition's continuation
 * would be its object, a noun phrase. The lowercase road never
 * needed the open-end evidence and is untouched.
 * Cure R4-T8-14: the licenser list named five words, but the
 * licenser is a ROLE, not a vocabulary: demonstrative "that" is
 * licensed by whatever governs it — a preposition ("laughed at
 * that", "because of that", "more than that") or a degree adverb
 * (only / just / all) — because a complementiser "that" is governed
 * by a verb or a noun, never by a preposition ("in that" is the one
 * conjunction wearing a preposition's shape, and it is deliberately
 * NOT in the class: "happy in that he had won" still glues).
 * Cure R4-T8-15: the "in" road's subject test named only pronouns
 * and omitted the commonest subject of all — "I" — and every name:
 * "…gave in / I understood…", "…gave in / Maria announced…" glued.
 * A name-shaped opening (a capitalised word that is no function
 * word) is a subject's head in the same way; it is judged for the
 * "in" road only, where the phrasal reading competes. */
const SUBJECT_OPEN = /^(?:she|he|it|they|we|you|I|él|ella|ellos|ellas|nosotros|esto|eso)\b/iu
const nameOpens = (next: string): boolean => {
  const w = next.match(/^\p{Lu}\p{Ll}+/u)?.[0]
  if (!w) return false
  const lw = w.toLowerCase()
  return !SENTENCE_STARTERS.has(lw) && !TITLE_END_STARTERS.has(lw)
}
const capitalGlues = (prev: string, next: string): boolean => {
  if (!lineEndsOpen(prev)) return false
  if (/\b(?:only|just|all|than|at|by|for|from|of|on|to|with|about|after|before|behind|beyond|under|upon|over|against|despite|through|toward|towards|into|since|until|via)\s+that$/i.test(prev)) return false
  if (/\bin$/i.test(prev) && (SUBJECT_OPEN.test(next) || nameOpens(next))) return false
  return true
}

function lineChunks(lines: string[]): { start: number; text: string }[] {
  const chunks: { start: number; text: string }[] = []
  let chunkStart = 0
  let chunk = lines[0]
  // Cure R2-T8-4: the lowercase glue had no list exception, so a
  // lowercase shopping list ("buy milk / buy eggs / …") glued into one
  // segment verbatim — F8-9's disease for exactly the lists people
  // paste. The glue now asks for prose shape first: the paragraph must
  // OPEN with a capital (a sentence beginning — a list opens as
  // itself, lowercase from its first line), and the line being
  // continued must be long enough to be a wrap remainder (≥14 chars —
  // nobody hard-wraps prose narrower than that; a shorter line is a
  // complete item). Genuinely wrapped prose (capital opening, long
  // lines flowing lowercase) still joins.
  // Cure R3-T8-5: the shape test read line 1 raw, so prose opening
  // with a quotation mark or a digit was judged not-prose and NO
  // continuation glued — not even lowercase ones. Opening quotes are
  // stripped for the test, and a digit opening counts when a
  // lowercase word follows ("3 days later we crossed…" is a
  // narrative opening; a digit-led list's later lines open with
  // digits themselves, which the continuation test refuses).
  const firstLine = lines[0].trim().replace(/^["'“”‘’«»(]+/u, '')
  const proseShaped = /^\p{Lu}/u.test(firstLine) || /^\d+\s+[a-zà-ÿ]/u.test(firstLine)
  // Cure R2-T8-6: the glue only recognised LOWERCASE continuations,
  // so narrow-wrapped prose whose next line opens with a capital —
  // a proper noun ("…crossed over to / Santander…") or "I" ("She
  // told me that / I should wait…") — still split mid-sentence. A
  // capital continuation glues too, but only on mid-phrase evidence:
  // the previous line must end bare on a word that cannot close a
  // phrase (lineEndsOpen — a terminal period or comma after the word
  // defeats the match, so a completed sentence never glues), judged
  // by ROLE where shape alone convicts (capitalGlues, cure R3-T8-4).
  // List items end on phrase-complete words ("Item one", "…papers
  // today"), so lists keep standing per line.
  const glue: boolean[] = []
  {
    let prevLen = lines[0].trim().length
    let prevTrim = lines[0].trim()
    for (let i = 1; i < lines.length; i++) {
      const t = lines[i].trim()
      // Cure R4-T8-16: the continuation test read the line raw, so a
      // wrapped line OPENING with a quote was judged by the quote
      // mark and severed from its lead-in — proseShaped strips
      // opening quotes for line 1 (cure R3-T8-5) and the wrap
      // verdict strips them for the last line, but this test, the
      // one that actually joins the lines, never did. The quote is
      // stripped for the test only; the line itself is untouched.
      const tOpen = t.replace(/^["'“‘«(]+/u, '')
      const continuation = /^[a-zà-ÿ]/u.test(tOpen) || (/^\p{Lu}/u.test(tOpen) && capitalGlues(prevTrim, tOpen))
      glue.push(proseShaped && prevLen >= 14 && continuation)
      prevLen = t.length
      prevTrim = t
    }
  }
  // Cure R3-T8-18, second half: pairwise glue alone still joined a
  // tidy list's middle items — two of its items ended on glue words,
  // so their joins glued while every other join stood apart. Wrapped
  // prose glues at MOST of its joins (its breaks are one text
  // flowing); a list glues at a minority, by accident. When glue is
  // not the paragraph's habit — fewer than half its joins — no join
  // glues: the paragraph is lines, not a wrap.
  const glueDominant = glue.filter(Boolean).length * 2 >= glue.length
  let off = lines[0].length + 1
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (glueDominant && glue[i - 1]) {
      chunk += `\n${line}` // a continuation is the same sentence, wrapped
    } else {
      chunks.push({ start: chunkStart, text: chunk })
      chunkStart = off
      chunk = line
    }
    off += line.length + 1
  }
  chunks.push({ start: chunkStart, text: chunk })
  return chunks
}

function splitSentences(p: string): Span[] {
  const spans: Span[] = []
  let start = 0
  // Cure R4-T8-19: the boundary demanded whitespace (or the string's
  // end) after the terminal punctuation, so pasted text missing the
  // space — "He left.She stayed home." — never split at all. A
  // capital that opens a word is a boundary witness of the same
  // strength: the lookahead leg fires only before a capital followed
  // by a lowercase letter, a space or the end, so the dots inside a
  // dotted initialism ("Ph.D.", "U.S.A.") — where the next capital
  // is followed by another dot — never become candidates, and a
  // lowercase continuation ("example.com") still cannot split.
  const re = /([.!?…。]+)(["'”’»)\]*]*)(\s+|$|(?=\p{Lu}(?:\p{Ll}|\s|$)))/gu
  let m: RegExpExecArray | null
  while ((m = re.exec(p))) {
    const endPunct = m.index + m[1].length + m[2].length
    const before = p.slice(start, m.index)
    const lastWord = (before.match(/([\p{L}.]+)$/u)?.[1] ?? '').toLowerCase()
    // What follows the period, judged once for every guard below: the
    // next word with any opening quotes stripped (an opener hiding
    // behind a quote still opens), its capital, and whether a ¿/¡
    // opens there — by orthography those can only OPEN a sentence.
    let nextTok = '', capNext = false, punctOpener = false, stripped = ''
    if (m[1] === '.') {
      const rest = p.slice(m.index + m[0].length)
      stripped = rest.replace(/^["'“‘«(]+/u, '')
      nextTok = stripped.match(/^[\p{L}]+/u)?.[0] ?? ''
      capNext = /^\p{Lu}/u.test(nextTok)
      // The ¿/¡ test reads the UNstripped rest (the standing R2-T8-1
      // shape): an opener hiding behind a quote is rescued by its
      // own closing punctuation, which is a boundary in its own
      // right — splitting before the quote as well would orphan the
      // quoted question from its verb ("…etc. "¿Y el postre?"
      // preguntó." stays two segments, not three).
      punctOpener = /^[¿¡]/.test(rest)
    }
    // Skip abbreviations, single initials ("J. R. R."), and decimals.
    if (m[1] === '.' && /^\p{L}$/u.test(lastWord)) {
      // Cure R3-T8-2: this skip was unconditional, so a sentence
      // ENDING on a single letter — a grade, an option ("He got an
      // A. She smiled.") — welded into the next sentence forever.
      // An initial still never splits mid-chain ("J. R. R. …": the
      // next initial follows) or before what cannot open a sentence;
      // a starter after it is a true end, judged by the same gate
      // the abbreviations below use ("I" is an opener too — the
      // pronoun opens sentences and never continues a name).
      const nextIsInitial = /^\p{L}\./u.test(stripped)
      // Cure R4-T8-11: the gate judged only the word AFTER the
      // letter, so two true ends welded: a digit opener ("He got an
      // A. 3 of his classmates…" — the etc. road below has had the
      // digit leg since R2-T8-2) and a name opener ("He got an A.
      // Maria smiled…"). The name leg is judged by the letter's own
      // seat: a letter sitting inside a name — a capitalised word
      // before it ("John F. Kennedy"), another initial, or nothing
      // at all ("F. Scott Fitzgerald") — is an initial and never
      // ends the sentence; a letter after a lowercase word is a
      // grade or option, and a capital after it opens the next
      // sentence. Declared trade: a label in name position ("Room
      // B. Maria entered.") keeps the initial's protection.
      const prevWord = before.slice(0, before.length - lastWord.length).match(/([\p{L}]+)\s*$/u)?.[1] ?? ''
      const nameSeat = !prevWord || /^\p{Lu}/u.test(prevWord)
      const opensSentence = punctOpener || nextTok === 'I'
        || (capNext && SENTENCE_STARTERS.has(nextTok.toLowerCase()))
        || /^\d/.test(stripped)
        || (capNext && !nameSeat)
      if (nextIsInitial || !opensSentence) continue
    }
    // Cure R3-T8-1: the dotted initialisms are a CLASS, not a list —
    // F8-4 stocked five (u.s, u.s.a, d.c, ee.uu, ph.d) and every other
    // member (U.K., U.N., E.U., a.k.a., P.O. …) split before any
    // capital noun, severing the commonest initialisms in English
    // books mid-name. The shape — single letters joined by dots —
    // takes the same gate as the listed members.
    if (m[1] === '.' && (ABBREV.has(lastWord) || /^(?:\p{L}\.)+\p{L}$/u.test(lastWord))) {
      // Cure F8-5: the guard is no longer unconditional. Titles take
      // the name-safe gate below (cure R2-T8-3). Every other abbreviation —
      // dotted initialism ("U.S.") or plain ("etc.", months, "fig.") —
      // skips unless a capitalised SENTENCE-STARTER follows ("U.S. It…"
      // and "etc. She…" are two sentences; "U.S. Senate" is one). The
      // plain abbreviations first got a weaker gate (skip only before a
      // non-capital), which split before ANY capital — including the
      // capitals that CONTINUE a sentence: a figure label ("See Fig. A
      // for details"), a roman numeral ("Vol. II"), a name ("Jan.
      // Jones", "approx. Noon Hall"). Those are the old unconditional
      // guard's own cases, so both classes now share the one gate: a
      // capital alone never ends the sentence after an abbreviation;
      // a capital that opens sentences does.
      // (The next-token evidence is computed once, above — cure
      // R2-T8-1's half included: the token test reads through opening
      // quotes, so a word hiding behind one still fires the gate.)
      // Cure R3-T8-3: "e.g." and "i.e." can never END a sentence —
      // they exist to introduce what follows — yet the starter gate
      // fired on them when the example opened with a starter word
      // ("…, i.e. The Hague, …" severed). They skip unconditionally,
      // like the initials chain; no gate is consulted.
      if (lastWord === 'e.g' || lastWord === 'i.e' || lastWord === 'p.ej') continue
      if (TITLES.has(lastWord)) {
        // Cure R2-T8-3: titles skipped this gate unconditionally, so a
        // title word at a TRUE sentence end ("Main St. It was quiet.",
        // "Sam Smith Jr. He left.", "el Sr. Él asintió.") welded the
        // two sentences forever. A title now ends the sentence when
        // what follows cannot be a name — a pronoun/discourse opener
        // (TITLE_END_STARTERS) or a ¿/¡ — and still never splits
        // before a name ("Sr. García", "St. Paul", "Dr. Smith").
        if (!punctOpener && !(capNext && TITLE_END_STARTERS.has(nextTok.toLowerCase()))) continue
      } else {
        const opensSentence = punctOpener
          || (capNext && SENTENCE_STARTERS.has(nextTok.toLowerCase()))
          // Cure R2-T8-2, second half: "etc." closes its clause, so a
          // capital or a digit after it opens a new sentence — "etc.
          // Maria went home.", "etc. 3 days later he returned." —
          // while the capitals that continue after OTHER abbreviations
          // (a figure label "Fig. A", a name "Jan. Jones", "U.S.
          // Senate") still join under the starter gate above.
          || (lastWord === 'etc' && (capNext || /^\d/.test(stripped)))
        if (!opensSentence) continue
      }
    }
    if (m[1] === '.' && /\d$/.test(before) && /^\d/.test(p.slice(m.index + 1))) continue
    // A bare list number ("2.") belongs to the sentence that follows it.
    if (/^\s*\(?[\dIVXivx]{1,3}[.)]?$/.test(p.slice(start, endPunct))) continue
    // A following lowercase letter usually means it was not a sentence end.
    const next = p.slice(m.index + m[0].length)
    if (!/[!?]/.test(m[1]) && /^[a-zà-ÿ]/.test(next)) continue
    spans.push({ start, end: endPunct })
    start = m.index + m[0].length
  }
  if (start < p.length && p.slice(start).trim()) spans.push({ start, end: p.length })
  return spans.map(trimSpan(p)).filter((s) => s.end > s.start)
}

function trimSpan(p: string) {
  return (s: Span): Span => {
    let { start, end } = s
    while (start < end && /\s/.test(p[start])) start++
    while (end > start && /\s/.test(p[end - 1])) end--
    return { start, end }
  }
}

/** Divide a long sentence only at natural breath points. */
function capLength(p: string, s: Span, soft: number): Span[] {
  const CLAUSE = /([,;:])\s+|\s+[—–]\s+/g
  const breaks = (a: number, b: number) => {
    const out: number[] = []
    CLAUSE.lastIndex = 0
    const seg = p.slice(a, b)
    let m: RegExpExecArray | null
    while ((m = CLAUSE.exec(seg))) out.push(a + m.index + m[0].length)
    return out
  }
  if (s.end - s.start <= soft) return [s]
  const pieces: Span[] = []
  let a = s.start
  let limit = soft
  while (s.end - a > limit) {
    // the last breath point inside the soft limit, if it leaves a real phrase on both sides
    const inSoft = breaks(a, Math.min(s.end, a + limit)).filter((x) => x - a >= 25 && s.end - x >= 25)
    let cut = inSoft.length ? inSoft[inSoft.length - 1] : -1
    if (cut < 0) {
      if (s.end - a <= HARD_MAX) break // no breath point yet: keep the sentence whole
      const inHard = breaks(a, a + HARD_MAX).filter((x) => x - a >= 25 && s.end - x >= 25)
      cut = inHard.length ? inHard[inHard.length - 1] : (() => {
        const w = p.slice(a, a + HARD_MAX)
        const sp = w.lastIndexOf(' ')
        if (sp > 0) return a + sp + 1
        // Cure R2-T8-9: no space inside the whole window means one
        // spaceless token longer than the cap — a pasted key, hash or
        // spaceless URL. The old fallback cut at exactly HARD_MAX,
        // sawing the token in half and pronouncing a sentence break
        // inside it. Emit the token whole: run to its end (the next
        // space, or the span's own end) — long, but one unit.
        // Cure R3-T8-6: the run hunted a SPACE only — a token followed
        // by a NEWLINE (a glued chunk's line break) overran its true
        // end and swallowed the next word into its segment. The end
        // of a token is any whitespace.
        const ws = p.slice(a + HARD_MAX, s.end).search(/\s/)
        return ws >= 0 ? a + HARD_MAX + ws : s.end
      })()
    }
    pieces.push({ start: a, end: cut })
    a = cut
    while (a < s.end && /\s/.test(p[a])) a++
    limit = SOFT_MAX
  }
  if (a < s.end) pieces.push({ start: a, end: s.end })
  return pieces.map(trimSpan(p)).filter((x) => x.end > x.start)
}

// ── Language detection ──────────────────────────────────────────

const ES_WORDS = new Set('el la los las de del que y en un una es por con no se su para al lo como más pero sus le ya o fue este ha sí porque esta son entre cuando muy sin sobre también me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mí antes algunos qué unos yo otro otras otra él tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros mi mis tú te ti tu tus ellas nosotras vosotros os mío mía tuyo suyo estoy estás está estamos están soy eres somos tengo tiene hola gracias bien día vida tiempo hacer puede'.split(' '))
const EN_WORDS = new Set('the of and to a in is it you that he was for on are with as i his they be at one have this from or had by not word but what some we can out other were all there when up use your how said an each she which do their time if will way about many then them write would like so these her long make thing see him two has look more day could go come did my sound no most people over know water than call first who may down side been now find any new work part take get place made live where after back little only round man year came show every good me give our under name very through just form much great think say help low line before turn cause same mean differ move right boy old too does tell set three want air well also play small end put home read hand port large spell add even land here must big high such follow act why ask men change went light kind off need house picture try us again animal point mother world near build self earth father'.split(' '))

export function detectLang(text: string): { lang: Lang; confidence: number } {
  const lower = text.toLowerCase()
  let es = 0
  let en = 0
  if (/[ñ¿¡]/.test(lower)) es += 4
  es += (lower.match(/[áéíóú]/g)?.length ?? 0) * 0.8
  const words = lower.match(/[\p{L}']+/gu) ?? []
  for (const w of words) {
    if (ES_WORDS.has(w)) es += 1
    if (EN_WORDS.has(w)) en += 1
    if (/'(s|t|re|ve|ll|d|m)$/.test(w)) en += 1
    if (/(ción|ciones|mente|idad|amos|aron|ando|iendo)$/.test(w)) es += 0.8
    if (/(tion|ing|ness|ly|ed)$/.test(w) && w.length > 4) en += 0.6
  }
  // Words common to both lists ("no", "me", "a") cancel out.
  const total = es + en
  if (total === 0) return { lang: 'en', confidence: 0 }
  const lang: Lang = es > en ? 'es' : 'en'
  return { lang, confidence: Math.abs(es - en) / total }
}

export function wordCount(text: string): number {
  return text.match(/[\p{L}\p{N}']+/gu)?.length ?? 0
}

/** The one honest words-per-minute table (cure F8-13): the comment
 * below promised ~165 wpm (EN) / ~175 wpm (ES) for years while the
 * code divided everything by a flat 168 — neither language's number.
 * The table IS the promise now; every duration in the app derives
 * from it through this function. */
const WPM: Record<Lang, number> = { en: 165, es: 175 }

/** Rough listening time at the table's rate for the text's language, divided by speed. */
export function estimateSeconds(text: string, speed = 1, lang?: Lang): number {
  const l = lang ?? detectLang(text).lang
  return (wordCount(text) / WPM[l]) * 60 / speed
}

export function formatDuration(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`
}

/** Text as it should be spoken: drops markdown and list symbols the voice would read out. */
// Spanish doubled-letter abbreviations (plural initials) and a few common ones the
// voices would otherwise spell out or misread: "EE.UU.", "EE. UU.", "E.E.U.U.", "EEUU" → Estados Unidos.
const ES_ABBR: [RegExp, string][] = [
  [/(?<![\p{L}])(?:E\.?\s?E\.?\s?U\.?\s?U\.?|EEUU|EE\.?\s?UU\.?)(?![\p{L}])/gu, 'Estados Unidos'],
  [/(?<![\p{L}])RR\.?\s?HH\.?(?![\p{L}])/gu, 'recursos humanos'],
  [/(?<![\p{L}])FF\.?\s?AA\.?(?![\p{L}])/gu, 'Fuerzas Armadas'],
  [/(?<![\p{L}])JJ\.?\s?OO\.?(?![\p{L}])/gu, 'Juegos Olímpicos'],
  [/(?<![\p{L}])CC\.?\s?AA\.?(?![\p{L}])/gu, 'comunidades autónomas'],
  [/(?<![\p{L}])SS\.?\s?MM\.?(?![\p{L}])/gu, 'Sus Majestades'],
  [/(?<![\p{L}])AA\.?\s?VV\.?(?![\p{L}])/gu, 'autores varios'],
  [/(?<![\p{L}])Sr\.(?=\s)/gu, 'señor'], [/(?<![\p{L}])Sra\.(?=\s)/gu, 'señora'], [/(?<![\p{L}])Srta\.(?=\s)/gu, 'señorita'],
  [/(?<![\p{L}])Dr\.(?=\s)/gu, 'doctor'], [/(?<![\p{L}])Dra\.(?=\s)/gu, 'doctora'],
  [/(?<![\p{L}])Ud\.(?=\s)/gu, 'usted'], [/(?<![\p{L}])Uds\.(?=\s)/gu, 'ustedes'],
  [/(?<![\p{L}])(?:Avda|Av)\.(?=\s)/gu, 'avenida'], [/(?<![\p{L}])[Pp]ág\.(?=\s)/gu, 'página'],
  [/(?<![\p{L}])[Nn]úm\.(?=\s)/gu, 'número'], [/(?<![\p{L}])aprox\.(?=\s)/gu, 'aproximadamente'],
]
const EN_ABBR: [RegExp, string][] = []

/** Expands abbreviations the voice would misread, by language. */
export function expandAbbrev(text: string, lang?: Lang): string {
  const list = lang === 'es' ? ES_ABBR : lang === 'en' ? EN_ABBR : []
  for (const [re, to] of list) text = text.replace(re, to)
  return text
}

/**
 * Spanish decimals (1.4.252, Oscar) and thousands (1.4.253,
 * Oscar): in Spanish the dot is the thousands separator and the
 * comma the decimal one — but texts pasted from English sources
 * carry the English forms, and the voice misreads both ways:
 * «2.00 dólares» comes out as two THOUSAND dollars, and «1,200
 * piezas» comes out as «1 coma doscientos» instead of «mil
 * doscientos». A Spanish segment's English-shaped numbers are
 * rewritten to the Spanish form before the voice sees them, in
 * this order: the full English money shape first (1,234.56 →
 * 1234,56), then the English thousands commas (1,200 → 1.200;
 * 1,234,567 → 1.234.567), then the plain dot decimal with
 * exactly two fraction digits (2.00 → 2,00). The Spanish forms
 * are never touched: 2.000 stays two thousand, 1.234,56 and
 * 2,00 stay as written — a comma with one or two digits after
 * it is a Spanish decimal, never a thousands group — and a dot
 * with one digit or three-plus is left alone. Only the shapes
 * that get misread are rewritten.
 */
export function spanishDecimals(text: string): string {
  return text
    .replace(/(?<![\d.,])(\d{1,3}(?:,\d{3})+)\.(\d{1,2})(?!\d|\.\d)/g, (_m, int: string, frac: string) => `${int.replace(/,/g, '')},${frac}`)
    .replace(/(?<![\d.,])(\d{1,3})((?:,\d{3})+)(?!\d)/g, (_m, head: string, groups: string) => head + groups.replace(/,/g, '.'))
    .replace(/(?<![\d.,])(\d+)\.(\d{2})(?!\d|\.\d)/g, '$1,$2')
}

export function speakable(text: string, lang?: Lang): string {
  // 1.4.57 pronunciation layer: a code the voice would spell out character by
  // character for ten seconds is named once ("code"), never read — and machine
  // file names (share-media-<hash>.png, IMG_2044.jpg) are dropped entirely.
  const CODE = lang === 'es' ? ' código ' : ' code '
  // Cure R2-T8-11: the word spoken for a link was hardcoded English —
  // a Spanish reading announced "link" mid-sentence while the code
  // substitution right above it was already language-aware.
  const LINK = lang === 'es' ? 'enlace' : 'link'
  const prepared = lang === 'es' ? spanishDecimals(expandAbbrev(text, lang)) : expandAbbrev(text, lang)
  const out = prepared
    .replace(/\*\*|__|~~|`+/g, '')
    .replace(/(^|\s)[*_](?=\S)|(?<=\S)[*_](?=\s|$|[.,;:!?])/g, '$1')
    .replace(/(^|\s)#{1,6}\s+/g, '$1')
    .replace(/(^|\s)>\s+/g, '$1')
    .replace(/(^|\s)[•▪◦]\s+/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, LINK)
    .replace(/\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi, CODE)
    .replace(/\S*[0-9a-f]{16,}\S*/gi, (tok) => (/\.(?:png|jpe?g|gif|webp|svg)$/i.test(tok) ? ' ' : CODE))
    .replace(/\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{8,15}\b/gi, CODE)
    .replace(/\b[\w-]*(?:\d|_)[\w-]*\.(?:png|jpe?g|gif|webp|mp3|mp4|wav|pdf|epub|docx?|txt|zip)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // The segment's language rides along (T7-09): language-scoped
  // dictionary entries fire only on their own language's segments.
  return applyPron(out, lang)
}
