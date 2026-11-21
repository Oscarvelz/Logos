// The reader's own pronunciation dictionary: words the voice should say
// differently (names, places, terms of art). Stored on this device only and
// applied to everything Logos speaks — listening and exported audio alike —
// at the single point where text becomes speech (speakable in text.ts).
import type { Lang } from './voices.ts'

/**
 * A dictionary entry. `lang` scopes it (T7-09): the same spelling is
 * often a different word in the other language — the reader's
 * English pan→pahn must never rewrite Spanish "el pan nuestro". An
 * entry WITH a language fires only on segments of that language; an
 * entry without one is unscoped and fires everywhere (the shape
 * every existing dictionary carries — scoping must never silently
 * retire the reader's standing entries).
 */
export type PronEntry = { from: string; to: string; lang?: Lang }

const KEY = 'logos.pronounce.v1'
let cache: PronEntry[] | null = null

/** The ONE validation for a dictionary entry (M-48): save-side and
 *  read-side share this exact predicate, so an entry can never be saved
 *  in a shape the reader would drop — or, worse, half-accept (an empty
 *  "say it as" used to pass the old typeof-only read filter and silently
 *  delete the word from all speech). Both sides reject: non-objects,
 *  non-string fields, a blank word, and a blank replacement. */
export function isValidPronEntry(e: unknown): e is PronEntry {
  return Boolean(e) && typeof e === 'object'
    && typeof (e as PronEntry).from === 'string' && typeof (e as PronEntry).to === 'string'
    && (e as PronEntry).from.trim() !== '' && (e as PronEntry).to.trim() !== ''
    // A scope, when present, must name a language the app speaks —
    // an uninterpretable scope is a malformed entry, not a wild card.
    && ((e as PronEntry).lang === undefined || (e as PronEntry).lang === 'en' || (e as PronEntry).lang === 'es')
}

export function pronEntries(): PronEntry[] {
  if (cache) return cache
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as PronEntry[]
    cache = Array.isArray(raw) ? raw.filter(isValidPronEntry) : []
  } catch { cache = [] }
  witnesses.add(cache)
  return cache
}

/** Change listeners (T7-03): the dictionary used to be a silent module
 *  cache — a backup import updated speech at once, but a page holding
 *  an earlier snapshot (Settings' pronunciation card) never learned,
 *  and its next edit saved the stale list back over the imported
 *  entries, silently destroying them. Every save now notifies, so a
 *  surface can re-read and stay the dictionary's witness, not its
 *  stale copy. (The Settings wiring itself is a written request —
 *  SettingsPage.tsx is outside this office's files.) */
const listeners = new Set<() => void>()
export function subscribePronEntries(l: () => void): () => void {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

/** Every array this module has handed out or been handed (T7-03):
 *  Settings' card holds its snapshot as React state and REPLACES it
 *  with a fresh array on each of its own edits, so preserving only
 *  the cache's identity is not enough — after one edit the page's
 *  state and the cache are different arrays, and an import landing
 *  between two edits would still be wiped by the second. Every save
 *  therefore syncs every witness array in place to the saved list:
 *  they are all views of the one dictionary, and a view can never
 *  again be a frozen pre-import copy that a later save writes back.
 *  (The lists are tiny and saves are rare; the set stays a handful.) */
const witnesses = new Set<PronEntry[]>()

export function savePronEntries(list: PronEntry[]) {
  const filtered = list.filter(isValidPronEntry)
  if (cache) cache.splice(0, cache.length, ...filtered)
  else cache = filtered
  witnesses.add(cache)
  if (Array.isArray(list)) witnesses.add(list)
  for (const w of witnesses) if (w !== cache) w.splice(0, w.length, ...cache)
  try { localStorage.setItem(KEY, JSON.stringify(cache)) } catch { /* full/blocked: keep the in-memory list */ }
  listeners.forEach((l) => l())
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Shape the replacement to the matched word's own capitalization
 *  (T7-07): the match is case-insensitive, but the word as written
 *  carries case the sentence means — a shout stays a shout
 *  ("TOMATO!" → "TOMAHTO!"), a sentence opening keeps its capital
 *  ("Tomato" → "Tomahto"), a lowercase word takes the entry as
 *  written. Mixed case has no honest mapping and takes the entry as
 *  written too. */
function matchCase(matched: string, to: string): string {
  const letters = matched.replace(/[^\p{L}]/gu, '')
  if (letters.length > 1 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) {
    return to.toUpperCase()
  }
  if (isCapitalizedName(matched)) return to.charAt(0).toUpperCase() + to.slice(1)
  return to
}

/** A capitalized NAME shape (R3-T7-4): opens with an uppercase letter,
 *  carries at least one lowercase letter, and never runs two uppercase
 *  letters together after the first — "Tomato", "McDonald", "O'Brien",
 *  "MacArthur" all wear it. T7-07's original test demanded an
 *  all-lowercase tail, so exactly the names this dictionary exists
 *  for — internal capitals — took the entry verbatim and lost the
 *  capital a sentence opening is owed. A camel shape with an
 *  uppercase run ("IPhone") still has no honest mapping and takes
 *  the entry as written, as does any lowercase-opening match. */
function isCapitalizedName(matched: string): boolean {
  const up = (c: string) => c === c.toUpperCase() && c !== c.toLowerCase()
  const lo = (c: string) => c === c.toLowerCase() && c !== c.toUpperCase()
  if (!up(matched.charAt(0))) return false
  if (matched.length === 1) return true
  let hasLower = false
  let prevUpper = true
  for (const ch of matched.slice(1)) {
    if (lo(ch)) { hasLower = true; prevUpper = false }
    else if (up(ch)) { if (prevUpper) return false; prevUpper = true }
    else prevUpper = false
  }
  return hasLower
}

/** Replace each dictionary word (whole word, any case) with how it
 *  should be said. `lang` is the language of THIS text segment
 *  (T7-09): scoped entries fire only on their own language — and,
 *  with no language known, do not fire at all rather than guess;
 *  unscoped entries fire everywhere, as they always have. */
export function applyPron(text: string, lang?: Lang): string {
  const list = pronEntries().filter((e) => e.lang === undefined || (lang !== undefined && e.lang === lang))
  if (!list.length) return text
  // Single pass (T7-05): ONE combined match over the original text,
  // longest word first — never a loop of passes over a mutating
  // string. The old loop re-matched replacement text with later
  // entries (read → reed, reed → red spoke "red" for "read"); here a
  // replacement is output, never input, so entries cannot cascade,
  // while every entry still applies to the words actually written.
  const byLower = new Map<string, PronEntry>()
  for (const e of [...list].sort((a, b) => b.from.length - a.from.length)) {
    const from = e.from.trim()
    if (!from) continue
    const key = from.toLowerCase()
    const held = byLower.get(key)
    // A twin scoped to THIS segment's language outranks the unscoped
    // twin for the same word, whichever was stored first (R3-T7-2):
    // every scoped entry in `list` passed the language filter above,
    // so its scope IS this segment's language. The old first-stored
    // rule let insertion order decide which reading spoke — the
    // Spanish entry was dead whenever the unscoped one came first.
    if (!held || (held.lang === undefined && e.lang !== undefined)) byLower.set(key, e)
  }
  if (!byLower.size) return text
  const alt = [...byLower.values()].map((e) => esc(e.from.trim())).join('|')
  // Whole word (M-42, widened by R2-T7-3): a boundary is where a word
  // truly begins or ends — and several marks JOIN rather than divide.
  // An apostrophe or underscore is part of a word ("don't", "O'Brien",
  // my_word are single words, so don/brien/word must not fire inside
  // them). An apostrophe joins only where a letter continues the word
  // through it, though: a possessive ENDS its word — "Saoirse's" and
  // "James'" are the name plus a mark hung on it, and the name is
  // this dictionary's whole purpose — so a trailing 's or a trailing
  // bare apostrophe is a boundary, judged by the second after-guard
  // below (R4-T7-5). ("It's" and "let's" wear the possessive's shape
  // and are judged boundaries too — English writes the two alike,
  // and a contraction of a dictionary NAME is not a shape that
  // exists; the possessive of one is everyday.)
  // A hyphen or slash between word characters joins one lexeme
  // ("well-known", "and/or" — the natural home of exactly the names
  // this dictionary exists for, "Anne-Marie"). A '.' or ',' between
  // digits is inside one number (3.14, 3,000, 1.4.186). Those joins
  // are the regex guards below, stated as "not here" on each side of
  // the match. The '.'-between-letters joins depend on CASE (a
  // lowercase continuation is the same token — example.com; an
  // uppercase one opens a sentence — end.Next), and case cannot be
  // judged inside this regex: it runs case-insensitively, where
  // \p{Ll} and \p{Lu} fold into each other. Those are judged in the
  // callback instead (joinedByPeriod), which leaves the match
  // untouched when the period joins it to its neighbour.
  return text.replace(
    new RegExp(
      `(?<![\\p{L}\\p{N}'’_])` + // a word character before: inside a word
      `(?<![\\p{L}\\p{N}][-/])` + // hyphen/slash joiner before ("…well-KNOWN", "and/OR")
      `(?<!\\p{N}[.,])` + // digit-grouping separator before ("3.14", "3,000")
      `(${alt})` +
      `(?![\\p{L}\\p{N}_])` + // a word character after: inside a word
      `(?![’'](?![sS](?![\\p{L}\\p{N}'’_]))[\\p{L}\\p{N}])` + // an apostrophe JOIN after ("don't", "we're"): a letter through the apostrophe continues this word — except a possessive 's (an s with a boundary beyond it), which bounds the word instead (R4-T7-5)
      `(?![-/][\\p{L}\\p{N}])` + // hyphen/slash joiner after ("WELL-known", "AND/or")
      `(?![.,]\\p{N})`, // digit-grouping separator after ("3.14", "3,000")
      'giu',
    ),
    (m, _g, offset: number, full: string) => {
      if (joinedByPeriod(full, offset, offset + m.length)) return m
      const to = byLower.get(m.toLowerCase())?.to
      return to === undefined ? m : matchCase(m, to)
    },
  )
}

const isLetter = (c: string): boolean => /\p{L}/u.test(c)
const isLowerCased = (c: string): boolean => c === c.toLowerCase() && c !== c.toUpperCase()
const isUpperCased = (c: string): boolean => c === c.toUpperCase() && c !== c.toLowerCase()

/** Whether a '.' touching the match at [start, end) JOINS it to its
 *  neighbour instead of bounding it (R2-T7-3 — judged here, not in
 *  the boundary regex, because the regex's case-insensitive flag folds
 *  \p{Ll} and \p{Lu} together and the distinction IS the case):
 *  before the match, a '.' after a LONE uppercase initial is an
 *  abbreviation chain (U.S.A — a whole uppercase word there is a
 *  caps sentence end instead, R3-T7-5), and a '.' after a lowercase letter
 *  joins a continuation that starts lowercase or with a digit
 *  (example.com) — but a continuation starting uppercase opens a new
 *  sentence and is NOT joined (end.Next: an entry on "Next" fires).
 *  After the match, a '.' before a lowercase letter continues the
 *  token (example.com); before an uppercase letter it ends the
 *  sentence (end.Next: an entry on "end" fires). Digit-flanked
 *  periods never reach here — the regex's digit-grouping guards
 *  already refuse those matches. */
function joinedByPeriod(full: string, start: number, end: number): boolean {
  if (start >= 2 && full[start - 1] === '.') {
    const before = full[start - 2]
    if (isLetter(before)) {
      if (isUpperCased(before)) {
        // An abbreviation chain joins only at a LONE initial (U.S.A,
        // a.k.a): the letter run ending at the period is one letter
        // long. A whole uppercase WORD before the period is a
        // sentence that ended in ALL-CAPS prose (THE END.NEXT) —
        // the period bounds there, and the opening word fires
        // (R3-T7-5). The old any-uppercase rule read every caps
        // sentence end as a chain and swallowed the next word.
        let run = 1
        while (start - 2 - run >= 0 && isLetter(full[start - 2 - run])) run++
        if (run === 1) return true
      } else {
        const first = full[start]
        if (isLowerCased(first) || /\p{N}/u.test(first)) return true
      }
    }
  }
  if (full[end] === '.' && end + 1 < full.length) {
    const after = full[end + 1]
    if (isLetter(after) && isLowerCased(after)) return true
  }
  return false
}
