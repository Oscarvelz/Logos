// After an import, Logos asks once — Keep, or only for now? — and gives the
// question five seconds. No answer means "for now", which needs no action at
// all: books are born temporary (see finishBook), and Keep is the only choice
// that changes anything.
import { createStore } from '../store.ts'

export const keepAsk = createStore<{ ask: { ids: string[]; titles: string[] } | null }>({ ask: null })

export function askKeep(added: { id: string; title: string }[]) {
  if (added.length) keepAsk.set({ ask: { ids: added.map((b) => b.id), titles: added.map((b) => b.title) } })
}
