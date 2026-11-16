// Setup for F5 probe: must execute BEFORE settings.ts module load
// (settings load() runs at import time), so this is imported first.
const store = new Map<string, string>()
store.set('logos.mig105', '1'); store.set('logos.mig140', '1'); store.set('logos.mig172', '1')
store.set('logos.settings.v1', JSON.stringify({
  defaultVoice: { en: 'kk_bad', es: 'ph_b6FvJAiokjdqIti4', extraVoiceKey: 'keepme' },
  favorites: ['ph_b6FvJAiokjdqIti4'],
}))
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
}
;(globalThis as any).__f5store = store
export {}
