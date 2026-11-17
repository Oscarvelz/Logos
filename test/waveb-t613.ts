// T6-13 probe: defaultPresentationStorage must leave NO second key behind.
import assert from 'node:assert'

const backing = new Map<string, string>()
// A leftover from an earlier version, already sitting in the user's store.
backing.set('logos-presentation-probe', '1')
;(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => backing.get(k) ?? null,
  setItem: (k: string, v: string) => { backing.set(k, v) },
  removeItem: (k: string) => { backing.delete(k) },
}

const { defaultPresentationStorage, PRESENTATION_STATE_KEY } = await import('../src/lib/presentation/presentation-state.ts')

const storage = defaultPresentationStorage()
assert.equal(backing.has('logos-presentation-probe'), false, 'probe key must be removed (incl. legacy leftovers)')
storage.setItem(PRESENTATION_STATE_KEY, '{}')
assert.equal(backing.get(PRESENTATION_STATE_KEY), '{}', 'the one real key still works')
assert.deepEqual([...backing.keys()], [PRESENTATION_STATE_KEY], 'exactly one key was ever left behind')
console.log('T6-13 PASS: probe leaves no second key; the one real key works')
