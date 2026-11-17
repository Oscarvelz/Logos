// T7-14 probe: a mixed-language export credits every voice that
// sang — `voice` is the dominant voice by rendered samples, and
// `voices` lists them all. Run: node ~/workspace/vela-work/run-ts-test.mjs test/waveb-t714.ts
import assert from 'node:assert'

const { voiceCredit } = await import('../src/player/voice-credit.ts')

// The hunt specimen's shape: a book whose FIRST segment is a short
// English line (Alba) but whose bulk is Spanish (Lola). The old
// credit named Alba — the voice that sang one sentence.
const mixed = new Map([['pk_alba', 24_000], ['pk_lola', 240_000]])
assert.deepEqual(voiceCredit(mixed), { voice: 'pk_lola', voices: ['pk_alba', 'pk_lola'] })

// A single-voice export keeps exactly the old credit — no `voices`.
assert.deepEqual(voiceCredit(new Map([['pk_alba', 96_000]])), { voice: 'pk_alba' })

// Ties go to the first voice used; order is first-use order.
const tied = new Map([['pk_lola', 48_000], ['pk_alba', 48_000]])
assert.deepEqual(voiceCredit(tied), { voice: 'pk_lola', voices: ['pk_lola', 'pk_alba'] })

// An empty render credits nobody (the '' the old code wrote).
assert.deepEqual(voiceCredit(new Map()), { voice: '' })

console.log('T7-14 PASS: dominant voice credited; every used voice listed')
