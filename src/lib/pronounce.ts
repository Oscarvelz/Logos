// The reader's own pronunciation dictionary: words the voice should say
// differently (names, places, terms of art). Stored on this device only and
// applied to everything Logos speaks — listening and exported audio alike —
// at the single point where text becomes speech (speakable in text.ts).
export type PronEntry = { from: string; to: string }

const KEY = 'logos.pronounce.v1'
let cache: PronEntry[] | null = null

export function pronEntries(): PronEntry[] {
  if (cache) return cache
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as PronEntry[]
    cache = Array.isArray(raw) ? raw.filter((e) => e && typeof e.from === 'string' && typeof e.to === 'string') : []
  } catch { cache = [] }
  return cache
}

export function savePronEntries(list: PronEntry[]) {
  cache = list
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* full/blocked: keep the in-memory list */ }
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Replace each dictionary word (whole word, any case) with how it should be said. */
export function applyPron(text: string): string {
  const list = pronEntries()
  if (!list.length) return text
  for (const e of [...list].sort((a, b) => b.from.length - a.from.length)) {
    const from = e.from.trim()
    if (!from) continue
    text = text.replace(new RegExp(`(?<![\\p{L}\\p{N}])${esc(from)}(?![\\p{L}\\p{N}])`, 'giu'), () => e.to)
  }
  return text
}
