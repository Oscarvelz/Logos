import { useSyncExternalStore } from 'react'

export type Route = 'listen' | 'create' | 'library' | 'voices' | 'settings'
export const ROUTES: Route[] = ['listen', 'create', 'library', 'voices', 'settings']

function parse(): Route {
  const h = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] as Route
  return ROUTES.includes(h) ? h : 'listen'
}

let current = parse()
const listeners = new Set<() => void>()
window.addEventListener('hashchange', () => {
  const next = parse()
  if (next === current) return
  const apply = () => { current = next; listeners.forEach((l) => l()) }
  // Smooth cross-fade where supported; CSS keyframes handle the rest.
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  if (doc.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) doc.startViewTransition(apply)
  else apply()
  window.scrollTo({ top: 0 })
})

export function navigate(route: Route) {
  if (parse() !== route) location.hash = `#/${route}`
}

export function useRoute(): Route {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, () => current)
}
