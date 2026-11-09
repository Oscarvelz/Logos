import { settings } from './settings.ts'
import { ES } from './es.ts'

/**
 * The app's own words, in the language Oscar chose (Settings → Language).
 * Keys are the English source strings themselves: an untranslated string
 * simply stays English, and the Spanish is fitted to the design — when a
 * faithful rendering would break a pill or a row, the Spanish bends,
 * never the layout.
 */
export function t(source: string, params?: Record<string, string | number>): string {
  let out = settings.get().uiLang === 'es' ? (ES[source] ?? source) : source
  if (params) for (const [k, v] of Object.entries(params)) out = out.split(`{${k}}`).join(String(v))
  return out
}

export function applyUiLang() {
  try { document.documentElement.lang = settings.get().uiLang } catch { /* no document */ }
}
