// Cure R4-T1-2 — the T2-19 stamp judges by the TRUE title on both sides.
// Mirrors the hunt specimen (round4/probes/r4-stamp-collision.ts):
// texts A and B share length, head-64 and segment count but earn
// different true titles. titleOf's cache is now keyed by the whole
// text itself, so B is pushed under B's title, B's pageCtx differs
// from A's stamp, and A's stored press is judged foreign against B —
// while a press stamped with B's OWN ctx is still honoured, and the
// non-colliding control C still refuses A's stamp.
// Run: node ~/workspace/vela-work/run-ts-test.mjs test/cure-waveE-stamp.ts
const HEAD = 'The harbour bell rang over the grey water. The ferry crew counted the ropes twice. Lanterns were lit along the quiet pier.'
const A = HEAD + ' ' + Array(6).fill('The ledger of Aurelia Voss lay open on the desk.').join(' ')
const B = HEAD + ' ' + Array(6).fill('The ledger of Matteo Lindt lay open on the desk.').join(' ')
const C = 'Mountain weather turned over the long northern road while the drivers waited for the pass to open again. Snow covered the signs. Nobody spoke for a while.'

const store = new Map<string, string>()
store.set('logos.lastText', A) // the box holds A when the page is born
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
const nowPayloads: any[] = []
const cmdQueue: string[] = []
let stamp = ''
;(globalThis as any).LogosAndroid = {
  playing: () => {}, media: () => {}, mediaF: () => {},
  bubbleState: () => JSON.stringify({ permission: true, running: true }),
  bubbleNow: (json: string) => { try { nowPayloads.push(JSON.parse(json)) } catch { /* ignore */ } },
  bubblePrefs: () => JSON.stringify({ clip: true, font: 2, disc: false, look: 0, wake: true, seek: true, keys: true, card: 1 }),
  bubbleLook: () => {},
  bubbleAuto: () => true,
  bubbleClip: () => '',
  bubbleWantClip: () => false,
  bubblePendingCmd: () => cmdQueue.shift() ?? '',
  bubblePendingCtx: () => stamp,
  bubbleNativePos: () => '',
  bubbleNativeStop: () => {},
  bubbleSeek: () => '',
  bubbleSeekCtx: () => '',
  bubbleLock: () => false,
}
;(globalThis as any).MediaMetadata = class { constructor(init: any) { Object.assign(this, init) } }
;(globalThis as any).Audio = class { currentTime = 0; duration = NaN; playbackRate = 1; volume = 1; paused = true; src = ''; preload = 'auto'; play() { return Promise.resolve() } pause() {} addEventListener() {} removeEventListener() {} }
;(globalThis as any).fetch = () => Promise.reject(new Error('offline probe'))

let pass = 0, fail = 0
const check = (name: string, ok: boolean, extra = '') => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) } }

const { describeText } = await import('../src/lib/describe.ts')
const { segmentText } = await import('../src/lib/text.ts')
const titleA = describeText(A, 'en').title
const titleB = describeText(B, 'en').title
check('specimen: A and B share length, head-64 and segment count', A.length === B.length && A.slice(0, 64) === B.slice(0, 64) && segmentText(A, 'en').length === segmentText(B, 'en').length)
check('specimen: their true titles differ', titleA !== titleB && !!titleA && !!titleB, `A=${titleA} B=${titleB}`)
const ct = segmentText(A, 'en').length

const bubble = await import('../src/lib/bubble.ts')
const { listen, loadText } = await import('../src/player/listen.ts')
bubble.initBubble()
// The reader loads B by hand in the same page, before any collection door.
loadText(B)
const lastPush = nowPayloads[nowPayloads.length - 1]
check('cure witness 1: the panel is told B’s TRUE title', !!lastPush && lastPush.title === titleB && lastPush.ct === ct, `pushed title=${lastPush?.title} ct=${lastPush?.ct}`)
// A press stored against A is still queued shell-side; a surfacing collects it.
stamp = `${titleA}|${ct}` // the stamp the shell stored against session A
cmdQueue.push('next')
;(globalThis as any).dispatchEvent(new Event('focus'))
const s = listen.get()
check('cure far end: A’s stored NEXT is judged foreign against B and dropped (current stays 0)', s.text === B && s.current === 0, `current=${s.current} textIsB=${s.text === B}`)
// The door still works for the session it names: B's own stamp is honoured.
stamp = `${titleB}|${ct}`
cmdQueue.push('next')
;(globalThis as any).dispatchEvent(new Event('focus'))
const s2 = listen.get()
check('control: a press stamped with B’s own ctx steps B (current 0 -> 1)', s2.text === B && s2.current === 1, `current=${s2.current}`)
// Control: the same A stamp against a non-colliding session C is refused.
loadText(C)
stamp = `${titleA}|${ct}`
cmdQueue.push('next')
;(globalThis as any).dispatchEvent(new Event('focus'))
const s3 = listen.get()
check('control: against non-colliding C the stamp is judged foreign and the press dropped', s3.text === C && s3.current === 0, `current=${s3.current}`)

console.log(`CURE R4-T1-2 probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
