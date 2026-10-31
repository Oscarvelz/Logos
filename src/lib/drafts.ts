import { createStore } from './store.ts'
import { loadLastText } from './settings.ts'

/** Text shared between pages (Listen draft, Create draft, share-target handoff). */
export const drafts = createStore<{ listen: string; create: string; sharedAt: number }>({
  listen: loadLastText(),
  create: '',
  sharedAt: 0,
})

/** Web Share Target (GET): ?title=&text=&url= → Listen. */
export function consumeShareTarget(): boolean {
  const q = new URLSearchParams(location.search)
  const title = q.get('title')?.trim() ?? ''
  const text = q.get('text')?.trim() ?? ''
  const url = q.get('url')?.trim() ?? ''
  if (!title && !text && !url) return false
  const parts: string[] = []
  if (title && !text.startsWith(title)) parts.push(title)
  if (text) parts.push(text)
  if (url && !text.includes(url)) parts.push(url)
  const combined = parts.join('\n\n').slice(0, 200_000)
  drafts.set({ listen: combined, sharedAt: Date.now() })
  try { localStorage.setItem('logos.lastText', combined) } catch { /* ignore */ }
  history.replaceState(null, '', `${location.pathname}#/listen`)
  return true
}
