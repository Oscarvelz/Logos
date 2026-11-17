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
  const first = matched.charAt(0)
  const rest = matched.slice(1)
  if (first && first === first.toUpperCase() && first !== first.toLowerCase() && rest === rest.toLowerCase()) {
    return to.charAt(0).toUpperCase() + to.slice(1)
  }
  return to
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
    if (from && !byLower.has(from.toLowerCase())) byLower.set(from.toLowerCase(), e)
  }
  if (!byLower.size) return text
  const alt = [...byLower.values()].map((e) => esc(e.from.trim())).join('|')
  // Whole word (M-42): an apostrophe or underscore is part of a word,
  // not a boundary — "don't", "O'Brien" and my_word are single words,
  // and a short entry (don, brien, word) must not fire inside them.
  return text.replace(
    new RegExp(`(?<![\\p{L}\\p{N}'’_])(${alt})(?![\\p{L}\\p{N}'’_])`, 'giu'),
    (m) => {
      const to = byLower.get(m.toLowerCase())?.to
      return to === undefined ? m : matchCase(m, to)
    },
  )
}
