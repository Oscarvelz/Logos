// Cure R4-T1-1, leg A — adoption restores the SESSION'S OWN text.
// The hunt probe (round4/probes/r4-adopt-wrong-text.ts) models the
// handoff's persistence as the loose-draft store, because that was
// the door the old adoption read. Under the cured rule the handoff
// itself stamps the session's record — synchronously, in
// handToShell — so this probe mirrors the hunt specimen through the
// REAL door: a book is loaded and handed to the shell, the page
// "dies" (its store is emptied; the shell session lives on, which
// is the whole premise of adoption), and a nativepos report then
// rebuilds the page. Far-end witnesses: the store's text, the
// mapped sentence, the sentence published to the card, the stop
// counter, and a resume record keyed to the book.
// Run: node ~/workspace/vela-work/run-ts-test.mjs test/cure-waveE-adopt.ts
const store = new Map<string, string>()
const DRAFT = [
  'Draftline one sails the quiet harbour road under a grey morning sky.',
  'Draftline two counts the ferry ropes beside the lantern light.',
  'Draftline three carries the stale loose words nobody is reading aloud.',
  'Draftline four waits in the box while another book is spoken.',
  'Draftline five closes the little draft that was never the session.',
].join(' ')
store.set('logos.lastText', DRAFT) // the stale loose draft squats in the old door
const sent = (n: number) => `Bookline${n} ` + Array.from({ length: 22 }, (_, i) => `Word${i}`).join(' ') + '.'
const BOOK = Array.from({ length: 20 }, (_, i) => sent(i)).join(' ')
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
const handoffs: any[] = []
const mediaCalls: any[] = []
;(globalThis as any).LogosAndroid = {
  playing: (on: boolean, book: string, artist: string, text: string) => { mediaCalls.push({ on, book, artist, text }) },
  media: (on: boolean, book: string, artist: string, text: string) => { mediaCalls.push({ on, book, artist, text }) },
  mediaF: (on: boolean, book: string, artist: string, text: string) => { mediaCalls.push({ on, book, artist, text }) },
  bubbleNative: (text: string, title: string, idx: number) => { handoffs.push({ text, title, idx }) },
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const { listen, loadText, handToShell, endSession } = await import('../src/player/listen.ts')
check('setup: no adoption at load (the shell reports no session yet)', !listen.get().active)

// The handoff, through the real door: the book is loaded and given
// to the shell's voice at sentence 8.
loadText(BOOK)
check('setup: the handoff was accepted by the shell bridge', handToShell(8) === true && handoffs.length === 1 && handoffs[0].text === BOOK)
// The record stands in the SAME breath — no timer, no debounce.
const recRaw = store.get('logos.shellSession')
const rec = recRaw ? JSON.parse(recRaw) : null
check('cure: the handoff stamped the session record synchronously, naming the book', !!rec && rec.text === BOOK, rec ? `key=${rec.key}` : 'no record')

// Page death: the page's store is emptied; the shell session lives
// on (the mock's stop is a counter only — a destroyed WebView sends
// no stop at all, and adoption exists precisely for this shape).
// The counter is reset afterwards so it witnesses adoption alone.
endSession()
stopCalls = 0
mediaCalls.length = 0
check('setup: the rebuilt page starts empty', !listen.get().active)

// The shell reports its live session; the page adopts it.
report = { active: true, idx: 8, total: 20, playing: true }
;(globalThis as any).dispatchEvent(new Event('logosandroid-nativepos'))
const s = listen.get()
check('cure: adoption engaged for the shell session', s.active && s.mode === 'device' && s.playing, `active=${s.active} mode=${s.mode} playing=${s.playing}`)
check('cure far end: the adopted text is the BOOK, not the stale draft in the box', s.text === BOOK, `text starts: ${s.text.slice(0, 40)}`)
check('cure far end: the position maps onto the book (idx 8 of 20)', s.current === 8 && s.segments.length === 20, `current=${s.current} segments=${s.segments.length}`)
check('cure far end: the card publish speaks a BOOK sentence', mediaCalls.some((c) => c.on && /Bookline/.test(c.text)), JSON.stringify(mediaCalls.map((c) => c.text)))
check('control: adoption issued NO stop order to the shell (R3-T1-1 holds)', stopCalls === 0, `stopCalls=${stopCalls}`)

// The resume tracker files its record against the book, not the draft.
const { initResumeTracking, loadSessionResume } = await import('../src/lib/resume.ts')
const { textKey } = await import('../src/lib/marks.ts')
initResumeTracking()
await sleep(200)
report = { active: true, idx: 12, total: 20, playing: true }
;(globalThis as any).dispatchEvent(new Event('logosandroid-nativepos'))
await sleep(50)
const r = loadSessionResume()
check('cure far end: the resume record is keyed to the book at its place', !!r && r.key === textKey(BOOK) && r.idx === 12, r ? `idx=${r.idx} keyMatch=${r.key === textKey(BOOK)}` : 'no record')

console.log(`CURE R4-T1-1 (leg A) probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
