// T7-07 + T7-09 probe: pronunciation replacements preserve the
// source's capitalization, and dictionary entries can be scoped to
// one language. Run: node ~/workspace/vela-work/run-ts-test.mjs test/waveb-t707-t709.ts
import assert from 'node:assert'

const { applyPron, savePronEntries, isValidPronEntry } = await import('../src/lib/pronounce.ts')

// ── T7-07: capitalization survives the replacement ──
savePronEntries([{ from: 'tomato', to: 'tomahto' }])
assert.equal(
  applyPron('Tomato soup. TOMATO! tomato.'),
  'Tomahto soup. TOMAHTO! tomahto.',
  'capitalized, all-caps and lowercase matches each keep their shape',
)
assert.equal(applyPron('tOmAtO'), 'tomahto', 'mixed case takes the entry as written (no honest mapping)')

// ── T7-09: language scoping ──
savePronEntries([{ from: 'pan', to: 'pahn', lang: 'en' }])
assert.equal(applyPron('el pan nuestro', 'es'), 'el pan nuestro', 'the hunt specimen: Spanish pan is bread, untouched')
assert.equal(applyPron('the pan is hot', 'en'), 'the pahn is hot', 'the same entry fires on English')
assert.equal(applyPron('the pan is hot'), 'the pan is hot', 'no language known → a scoped entry does not guess')

savePronEntries([{ from: 'casa', to: 'cassa' }])
assert.equal(applyPron('la casa es grande', 'es'), 'la cassa es grande', 'unscoped entries still fire everywhere')
assert.equal(applyPron('la casa es grande', 'en'), 'la cassa es grande')

// Scoped entries survive validation (and so survive save/load/import);
// an uninterpretable scope does not.
assert.equal(isValidPronEntry({ from: 'pan', to: 'pahn', lang: 'es' }), true)
assert.equal(isValidPronEntry({ from: 'pan', to: 'pahn', lang: 'fr' }), false)

console.log('T7-07 + T7-09 PASS: case preserved; entries scoped by language')
