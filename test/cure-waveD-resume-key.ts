// Cure R3-T1-4 — the resume record's fingerprint is now the strong
// whole-text key (marks.ts textKey, dual cyrb64), and stored marks
// keep a dual-accept door for the legacy formula. The hunt probe
// (round3/probes/r3-resume-textkey.ts) was written break-asserting:
// its "keys collide" and "gate accepts B" legs now fail because the
// properties are gone. This probe asserts the cured contract
// positively, through the real modules:
//   1. the hunt's own specimens A/B no longer collide;
//   2. a record A earns through the real tracker is accepted for A
//      and refused for B by the readers' own gate (textKey === key);
//   3. playLooseMark (the one dual-accept reader) still honours a
//      PRE-CURE legacy-keyed mark against its own text, and a
//      strong-keyed mark against its own text — and refuses the
//      strong-keyed mark against the middle-edited twin B.
// Run: node ~/workspace/vela-work/run-ts-test.mjs test/cure-waveD-resume-key.ts
const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
}
;(globalThis as any).window = globalThis
;(globalThis as any).location = { hash: '' }
;(globalThis as any).LogosAndroid = {
  playing: () => {}, media: () => {}, mediaF: () => {}, bubbleNative: () => {}, bubbleNativeStop: () => {},
}
;(globalThis as any).MediaMetadata = class { constructor(init: any) { Object.assign(this, init) } }
// playLooseMark ends in play(): its async tail builds the <audio>
// element. A stub keeps that tail from dying on a missing global
// after the checks have spoken (the gate's verdict is the return
// value, asserted synchronously below).
;(globalThis as any).Audio = class {
  src = ''; paused = true; currentTime = 0; duration = 0; playbackRate = 1; loop = false; preload = ''; volume = 1
  addEventListener() {} removeEventListener() {}
  play() { this.paused = false; return Promise.resolve() }
  pause() { this.paused = true }
  load() {} removeAttribute() {}
}
const et = new EventTarget()
;(globalThis as any).addEventListener = et.addEventListener.bind(et)
;(globalThis as any).removeEventListener = et.removeEventListener.bind(et)
;(globalThis as any).dispatchEvent = et.dispatchEvent.bind(et)

const { textKey, legacyTextKey, playLooseMark } = await import('../src/lib/marks.ts')
const { drafts } = await import('../src/lib/drafts.ts')
const { listen, loadText } = await import('../src/player/listen.ts')
const { initResumeTracking, loadSessionResume } = await import('../src/lib/resume.ts')

let pass = 0, fail = 0
const check = (name: string, ok: boolean, extra = '') => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) } }

// The hunt's specimens, verbatim: same length, same head/tail 48,
// the middle edited (two sentences in A, one merged in B).
const HEAD = 'The morning ferry crossed the harbour slowly while the town was still waking and the gulls cried over the water. '
const TAIL = ' And by the time the light failed, the whole town had heard the news and the harbour bell was ringing out.'
const midA = 'Alpha bravo charlie. Delta echo foxtrot. '
const midB = 'Alpha bravo charlie delta echo foxtrot.  '
const A = HEAD + midA + 'Golf hotel india juliet. Kilo lima mike november.' + TAIL
const B = HEAD + midB + 'Golf hotel india juliet. Kilo lima mike november.' + TAIL

check('specimens: still the same shape (length/head/tail equal, texts differ)',
  A.length === B.length && A.slice(0, 48) === B.slice(0, 48) && A.slice(-48) === B.slice(-48) && A !== B)
check('the legacy formula still collides (it is the pre-cure fingerprint)', legacyTextKey(A) === legacyTextKey(B))
check('CURE: the strong key separates the specimens', textKey(A) !== textKey(B), `keyA=${textKey(A)} keyB=${textKey(B)}`)
check('the strong key is stable for the same text', textKey(A) === textKey(A))

// The resume gate, through the real tracker and the readers' own
// comparison (continue.tsx / bubble.ts recoverSession / ListenPage
// all compute textKey(draft) === r.key with this same import).
initResumeTracking()
loadText(A)
listen.set({ current: 3, playing: true })
const r = loadSessionResume()
check('setup: A earned a resume record at sentence 3', !!r && r.idx === 3, JSON.stringify(r))
check('CURE: the gate accepts the record for its own text A', !!r && textKey(A) === r.key)
check('CURE: the gate refuses the record for the edited twin B', !!r && textKey(B) !== r.key)

// The marks door: dual-accept for pre-cure marks, strong-only for new.
const legacyMark = { id: 'm-legacy', at: 1, title: 'T', sentence: 'Alpha bravo charlie.', key: legacyTextKey(A), idx: 0 }
const strongMark = { id: 'm-strong', at: 2, title: 'T', sentence: 'Alpha bravo charlie.', key: textKey(A), idx: 0 }
drafts.set({ listen: A })
check('CURE: a pre-cure legacy-keyed mark still plays against its own text', playLooseMark(legacyMark) === true)
drafts.set({ listen: A })
check('CURE: a strong-keyed mark plays against its own text', playLooseMark(strongMark) === true)
drafts.set({ listen: B })
check('CURE: the strong-keyed mark refuses the middle-edited twin B', playLooseMark(strongMark) === false)

console.log(`CURE R3-T1-4 probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
