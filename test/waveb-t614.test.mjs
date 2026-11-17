// T6-14 probe: the first-run offer is consumed only by an answer, and a
// throwing getItem must not suppress it. Run: node --test test/waveb-t614.test.mjs
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  answerOffer,
  offerPending,
  PRESENTATION_OFFER_KEY,
} from '../src/lib/presentation/presentation-state.ts'

const install = (fake) => { globalThis.localStorage = fake }
const mapStore = (seed = {}) => {
  const backing = new Map(Object.entries(seed))
  return {
    backing,
    getItem: (k) => backing.get(k) ?? null,
    setItem: (k, v) => { backing.set(k, v) },
    removeItem: (k) => { backing.delete(k) },
  }
}

describe('T6-14 — the offer is consumed only by an answer', () => {
  test('unanswered is pending even when module records already exist', () => {
    // The state-file half of the old rule is gone from the function:
    // pending is a pure function of the answer key. (The old rule read
    // the state file and required zero module records — any earlier
    // contact suppressed the unanswered offer forever.)
    install(mapStore())
    assert.equal(offerPending(), true)
  })

  test('an answered offer never returns', () => {
    install(mapStore({ [PRESENTATION_OFFER_KEY]: 'done' }))
    assert.equal(offerPending(), false)
  })

  test('answerOffer records the answer', () => {
    const store = mapStore()
    install(store)
    answerOffer()
    assert.equal(store.backing.get(PRESENTATION_OFFER_KEY), 'done')
    assert.equal(offerPending(), false)
  })

  test('a throwing getItem cannot suppress the offer', () => {
    install({
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') },
    })
    assert.equal(offerPending(), true)
    answerOffer() // must not throw
  })
})
