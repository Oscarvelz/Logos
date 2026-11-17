// Cure R2-T1-5: the resume card and its trigger now persist together.
// The hunt proved a reload orphaned the persisted card: stageKey was
// memory-only, so the watcher could never fire and the stale card
// blocked the F8-8 draft leg forever. Run in three fresh processes
// (a process boundary IS the reload):
//   WAVEC_PHASE=1  node run-ts-test.mjs test/cure-waveC-resume.ts
//   WAVEC_PHASE=2a node run-ts-test.mjs test/cure-waveC-resume.ts
//   WAVEC_PHASE=2b node run-ts-test.mjs test/cure-waveC-resume.ts
import { readFileSync, writeFileSync } from 'node:fs'

const PHASE = process.env.WAVEC_PHASE ?? '1'
const STATE = '/tmp/wavec-resume-state.json'
const DRAFT = 'A draft I typed this morning and never played, about the harbour light.'
const CLIP = 'Copied words that take the stage: the ferry leaves at dawn tomorrow.'
const OTHER = 'Something else entirely that the box holds now, unrelated words.'

const store = new Map<string, string>()
if (PHASE !== '1') {
  const saved = JSON.parse(readFileSync(STATE, 'utf8')) as Record<string, string>
  for (const [k, v] of Object.entries(saved)) store.set(k, v)
  if (PHASE === '2b') store.set('logos.lastText', OTHER)
} else {
  store.set('logos.lastText', DRAFT)
}
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
}
const et = new EventTarget()
;(globalThis as any).window = globalThis
;(globalThis as any).matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })
;(globalThis as any).addEventListener = et.addEventListener.bind(et)
;(globalThis as any).removeEventListener = et.removeEventListener.bind(et)
;(globalThis as any).dispatchEvent = et.dispatchEvent.bind(et)
;(globalThis as any).document = { addEventListener: () => {}, hidden: false }
;(globalThis as any).LogosAndroid = {
  bubbleState: () => JSON.stringify({ permission: true, running: true }),
  bubbleClip: () => '',
  bubblePendingCmd: () => '',
  bubblePendingCtx: () => '',
  bubbleSeek: () => '',
  bubbleSeekCtx: () => '',
  bubbleNativePos: () => '',
}
;(globalThis as any).MediaMetadata = class { constructor(init: any) { Object.assign(this, init) } }
;(globalThis as any).Audio = class { currentTime = 0; duration = NaN; playbackRate = 1; volume = 1; paused = true; src = ''; preload = 'auto'; play() { return Promise.resolve() } pause() {} addEventListener() {} removeEventListener() {} }
;(globalThis as any).fetch = () => Promise.reject(new Error('offline probe'))

let pass = 0, fail = 0
const check = (name: string, ok: boolean, extra = '') => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) } }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const bubble = await import('../src/lib/bubble.ts')
const { drafts } = await import('../src/lib/drafts.ts')
const { listen, loadText } = await import('../src/player/listen.ts')

if (PHASE === '1') {
  check('setup: the box holds the never-played draft', drafts.get().listen === DRAFT)
  bubble.playClipboardText(CLIP)
  const raw = store.get('logos.bubble.resume')
  const card = raw ? JSON.parse(raw) : null
  check('the eviction leaves a draft card', !!card && card.draftOnly === true && card.text === DRAFT, raw ?? 'no card')
  check('the card carries its stage stamp', !!card && card.stage === bubble.clipKey(CLIP), raw ?? 'no card')
  // saveLastText is debounced: let the clip's landing in the box persist
  // before the state is frozen, or the "reload" would read a stale box.
  await sleep(600)
  check('the box now holds the clip text (persisted)', store.get('logos.lastText') === CLIP)
  writeFileSync(STATE, JSON.stringify(Object.fromEntries(store)))
} else if (PHASE === '2a') {
  check('reload, stage alive: the card survives init (not retired)', store.has('logos.bubble.resume'))
  check('reload: the box holds the clip, not the draft', drafts.get().listen === CLIP, `box=${drafts.get().listen.slice(0, 40)}`)
  bubble.initBubble()
  await sleep(300)
  loadText(CLIP)
  listen.set({ finished: true })
  await sleep(100)
  check('the clip finishing restores the draft to the box', drafts.get().listen === DRAFT, `box=${drafts.get().listen.slice(0, 40)}`)
  check('the card is spent by its own restore', !store.has('logos.bubble.resume'))
} else {
  check('reload, stage gone: the stale card is retired at init', !store.has('logos.bubble.resume'))
  const D2 = 'A second draft, typed after the reload, also never played.'
  drafts.set({ listen: D2 })
  bubble.playClipboardText('Fresh copied words, another stage entirely now.')
  const raw = store.get('logos.bubble.resume')
  const card = raw ? JSON.parse(raw) : null
  check('the next eviction leaves ITS OWN draft card (the slot is free)', !!card && card.draftOnly === true && card.text === D2, raw ?? 'no card')
}

console.log(`CURE R2-T1-5 phase ${PHASE}: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
