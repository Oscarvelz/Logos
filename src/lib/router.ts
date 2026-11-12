import { useSyncExternalStore } from 'react'

export type Route = 'listen' | 'create' | 'library' | 'voices' | 'settings' | 'book'
export const ROUTES: Route[] = ['listen', 'voices', 'create', 'library', 'settings', 'book']

function parse(): Route {
  const h = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] as Route
  return ROUTES.includes(h) ? h : 'listen'
}

let current = parse()
const listeners = new Set<() => void>()
window.addEventListener('hashchange', () => {
  const next = parse()
  if (next === current) return
  current = next
  listeners.forEach((l) => l())
  window.scrollTo({ top: 0 })
})

export function navigate(route: Route) {
  if (parse() !== route) location.hash = `#/${route}`
}

export function useRoute(): Route {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, () => current)
}
