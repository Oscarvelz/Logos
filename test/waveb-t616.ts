// T6-16 probe: search titles follow the LIVE UI language, not the
// language of first use. Runs through the in-memory TS runner (the
// settings chain pulls a JSON import plain node type-stripping
// cannot load): node ~/workspace/vela-work/run-ts-test.mjs test/waveb-t616.ts
import assert from 'node:assert'

const { presentationSceneIndex, searchScenes } = await import('../src/lib/presentation/scene-index.ts')
const { catalogueModule } = await import('../src/lib/presentation/catalogue.ts')
const { pickText } = await import('../src/lib/presentation/engine/types.ts')
const { settings } = await import('../src/lib/settings.ts')

const q0 = catalogueModule('Q0')!
const enTitle = pickText(q0.title, 'en')
const esTitle = pickText(q0.title, 'es')
assert.notEqual(enTitle, esTitle, 'the probe needs a module whose titles differ by language')

settings.set({ uiLang: 'en' })
const firstUse = presentationSceneIndex().find((h) => h.moduleId === 'Q0')!
assert.equal(firstUse.moduleTitle, enTitle, 'first use shows English titles')

// The old index cached here: every later read kept the first language.
settings.set({ uiLang: 'es' })
const afterSwitch = presentationSceneIndex().find((h) => h.moduleId === 'Q0')!
assert.equal(afterSwitch.moduleTitle, esTitle, 'after the switch, titles speak Spanish')
assert.equal(afterSwitch.sceneTitle, pickText(q0.script!.scenes[0].chapter, 'es'))

const hits = searchScenes('vuelta')
assert.ok(hits.some((h) => h.moduleId === 'Q0'), 'search finds Q0 by its Spanish words')
assert.equal(hits.find((h) => h.moduleId === 'Q0')!.moduleTitle, esTitle)

settings.set({ uiLang: 'en' })
assert.equal(presentationSceneIndex().find((h) => h.moduleId === 'Q0')!.moduleTitle, enTitle, 'and back again')

console.log('T6-16 PASS: titles follow the live UI language across switches')
