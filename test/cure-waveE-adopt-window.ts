// Cure R4-T1-1, leg B — there is no window.
// The hunt probe (round4/probes/r4-adopt-stale-lasttext.ts) showed
// adoption restoring the PREVIOUS text when the page died inside
// saveLastText's 300 ms debounce — the only persistence the old
// adoption had. Under the cured rule the handoff stamps the
// session's record synchronously inside handToShell, so this probe
// mirrors the specimen through the real door and kills the page in
// the SAME BREATH as the handoff — no timers run at all — and the
// rebuilt page must restore the fresh text B, never the landed A.
// Run: node ~/workspace/vela-work/run-ts-test.mjs test/cure-waveE-adopt-window.ts
const store = new Map<string, string>()
const A = [
  'Alphaline one opens the older text the box held yesterday morning.',
  'Alphaline two follows the older road beside the harbour wall.',
  'Alphaline three carries words the listener finished with long ago.',
  'Alphaline four drifts past the lanterns on the quiet pier.',
  'Alphaline five settles into the middle of the older text.',
  'Alphaline six closes the older text at the harbour gate.',
].join(' ')
const B = [
  'Bravoline one opens the fresh text the shell is reading right now.',
  'Bravoline two follows the fresh road beside the harbour wall.',
  'Bravoline three carries the words of the live session itself.',
  'Bravoline four drifts past the lanterns on the quiet pier.',
  'Bravoline five settles into the middle of the fresh text.',
  'Bravoline six closes the fresh text at the harbour gate.',
].join(' ')
store.set('logos.lastText', A) // the previous text, landed long ago
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
}
const et = new EventTarget()
;(globalThis as any).addEventListener = et.addEventListener.bind(et)
;(globalThis as any).removeEventListener = et.removeEventListener.bind(et)
;(globalThis as any).dispatchEvent = et.dispatchEvent.bind(et)
let report: any = { active: false }
let stopCalls = 0
;(globalThis as any).LogosAndroid = {
  playing: () => {}, media: () => {}, mediaF: () => {},
  bubbleNative: () => {},
  bubbleNativePos: () => JSON.stringify(report),
  bubbleNativeStop: () => { stopCalls++ },
  bubbleState: () => JSON.stringify({ permission: true, running: true }),
  bubbleSeek: () => '',
  bubbleSeekCtx: () => '',
  bubbleLock: () => false,
}
;(globalThis as any).MediaMetadata = class { constructor(init: any) { Object.assign(this, init) } }

let pass = 0, fail = 0
const check = (name: string, ok: boolean, extra = '') => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) } }

const { listen, loadText, handToShell, endSession } = await import('../src/player/listen.ts')
const { loadLastText } = await import('../src/lib/settings.ts')

// B is loaded and handed to the shell; the page dies in the same
// breath. No timer is ever awaited in this probe: under the old
// door the only write was a 300 ms debounce, so at this instant
// the persisted last text still says A — the hunt probe's window.
loadText(B)
check('setup: the handoff was accepted', handToShell(1) === true)
check('setup: the old door still holds A at this instant (the window is real)', loadLastText() === A)
const recRaw = store.get('logos.shellSession')
const rec = recRaw ? JSON.parse(recRaw) : null
check('cure: the session record already names B — the handoff stamped it synchronously', !!rec && rec.text === B)

endSession() // page death (the mock's stop is a counter only; the shell reads on)
stopCalls = 0
report = { active: true, idx: 1, total: 6, playing: true }
;(globalThis as any).dispatchEvent(new Event('logosandroid-nativepos'))
const s = listen.get()
check('cure: adoption engaged for the live (B) session', s.active && s.mode === 'device', `active=${s.active} mode=${s.mode}`)
check('cure far end: the rebuilt page adopted B, the session’s own text — not A', s.text === B, `text starts: ${s.text.slice(0, 40)}`)
check('cure far end: B’s position (1 of 6) mapped onto B', s.current === 1 && s.text.startsWith('Bravoline'), `current=${s.current}`)
check('control: adoption issued NO stop order to the shell (R3-T1-1 holds)', stopCalls === 0, `stopCalls=${stopCalls}`)

console.log(`CURE R4-T1-1 (leg B) probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
