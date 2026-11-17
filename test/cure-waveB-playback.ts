// CURE Wave B — PLAYBACK probes (T1-14, T1-15, T1-16, T1-17, T1-19, F9).
// Stubs first, then DYNAMIC imports (listen.ts reads window at import).
const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
}
;(globalThis as any).window = globalThis
;(globalThis as any).MediaMetadata = class { constructor(init: any) { Object.assign(this, init) } }
const et = new EventTarget()
;(globalThis as any).addEventListener = et.addEventListener.bind(et)
;(globalThis as any).removeEventListener = et.removeEventListener.bind(et)
;(globalThis as any).dispatchEvent = et.dispatchEvent.bind(et)

// Fake browser speech (T1-17): one voice, utterances captured.
class FakeUtterance {
  lang = ''; voice: any = null; rate = 1
  onend: any = null; onerror: any = null; onboundary: any = null
  constructor(public text: string) {}
}
;(globalThis as any).SpeechSynthesisUtterance = FakeUtterance
let spoken: any = null
;(globalThis as any).speechSynthesis = {
  getVoices: () => [{ lang: 'en-US', name: 'Test Voice', localService: true }],
  speak: (u: any) => { spoken = u },
  cancel: () => {},
  speaking: false,
  addEventListener: () => {},
}

// Fake clip audio element (T1-16).
class FakeAudio {
  static instances: FakeAudio[] = []
  currentTime = 0; duration = 0; paused = true; src = ''; playbackRate = 1; pauseCalls = 0
  private listeners: Record<string, ((...a: any[]) => void)[]> = {}
  constructor() { FakeAudio.instances.push(this) }
  addEventListener(k: string, f: (...a: any[]) => void) { (this.listeners[k] ??= []).push(f) }
  removeEventListener() {}
  fire(k: string) { this.listeners[k]?.forEach((f) => f()) }
  async play() { this.paused = false; this.fire('play') }
  pause() { this.paused = true; this.pauseCalls++; this.fire('pause') }
  load() {}
  removeAttribute() {}
}
;(globalThis as any).Audio = FakeAudio

const { renderKey, pauseAfter } = await import('../src/player/rendercache.ts').then(async (rc) => {
  const tx = await import('../src/lib/text.ts')
  return { renderKey: rc.renderKey, pauseAfter: tx.pauseAfter }
})
const L = await import('../src/player/listen.ts')
const { settings } = await import('../src/lib/settings.ts')
const { playClip, stepClip } = await import('../src/player/clip.ts')
const { initResumeTracking, loadSessionResume } = await import('../src/lib/resume.ts')
const { setNowReading } = await import('../src/lib/book/nowreading.ts')

let pass = 0, fail = 0
const check = (name: string, ok: boolean, extra = '') => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) } }
const tick = () => new Promise((r) => setTimeout(r, 30))

// ── T1-14: the pause is part of the render key ──
const spokenText = 'The harbour bell rang twice over the water.'
check('T1-14 mid-paragraph pause (x0.4) keys apart from paragraph-end (x2.2)',
  renderKey(spokenText, 'v1', pauseAfter({ paraEnd: false, sentEnd: false }, 400)) !== renderKey(spokenText, 'v1', pauseAfter({ paraEnd: true, sentEnd: true }, 400)))
check('T1-14 a Sentence Pause change misses the old entry',
  renderKey(spokenText, 'v1', 400) !== renderKey(spokenText, 'v1', 800))
check('T1-14 same spoken+voice+pause is the same key (deterministic)',
  renderKey(spokenText, 'v1', 400) === renderKey(spokenText, 'v1', 400))
check('T1-14 legacy two-arg call still keys (pause defaults to 0)',
  renderKey(spokenText, 'v1') === renderKey(spokenText, 'v1', 0))

// ── F9: stored zero means zero ──
check('F9 jumpSeconds keeps a stored 0 a 0', L.jumpSeconds(0, 15) === 0)
check('F9 jumpSeconds honors a stored value', L.jumpSeconds(45, 15) === 45)
check('F9 jumpSeconds clamps to the field ceiling, not a floor of 1', L.jumpSeconds(900, 15) === 600 && L.jumpSeconds(0, 30) === 0)
check('F9 jumpSeconds falls back only for a wrong-kind value', L.jumpSeconds(NaN, 15) === 15)

// Fixture: capitalised sentences the splitter sees.
const sent = (n: number) => `Sentence${n} ` + Array.from({ length: 10 }, (_, i) => `word${i}`).join(' ') + '.'
const fixture = [sent(1), sent(2), sent(3), sent(4), sent(5)].join(' ')
L.loadText(fixture)
check('fixture loaded with several sentences', L.listen.get().segments.length >= 4, `segments=${L.listen.get().segments.length}`)
L.seek(2)
settings.set({ jumpBackSec: 0 })
const beforeZero = L.listen.get().current
L.jumpBack()
check('F9 a stored 0 leap is an honest no-op (old code leapt 15 s)', L.listen.get().current === beforeZero, `current ${beforeZero} -> ${L.listen.get().current}`)
settings.set({ jumpBackSec: 15 })

// ── T1-19: SKIP routes book-to-book over a book, steps over a text ──
const dirs: number[] = []
L.registerBookSkip((dir) => { dirs.push(dir) })
L.seek(0)
L.skipNext()
check('T1-19 SKIP over a plain text still steps one sentence', L.listen.get().current === 1 && dirs.length === 0, `current=${L.listen.get().current} dirs=${dirs}`)
const paras = ['First para opens the book. It speaks twice.', 'Second para follows here. It also speaks.']
const bookText = paras.join('\n\n')
setNowReading('book-1', 'The Probe Book', paras, [{ ch: 0, b: 0 }, { ch: 0, b: 1 }])
L.loadText(bookText)
L.skipNext()
check('T1-19 SKIP over a book session delegates book-to-book (+1)', dirs.length === 1 && dirs[0] === 1, `dirs=${dirs}`)
L.skipPrev()
check('T1-19 SKIP-back over a book session delegates book-to-book (-1)', dirs.length === 2 && dirs[1] === -1, `dirs=${dirs}`)

// ── T1-17: the device voice's boundary events move the progress ──
L.loadText(fixture)
settings.set({ deviceFallback: true })
spoken = null
void L.play(0)
await tick()
check('T1-17 device road took the session', L.listen.get().mode === 'device' && !!spoken, `mode=${L.listen.get().mode}`)
const seg0 = L.listen.get().segments[0].text
spoken.onboundary({ charIndex: Math.floor(seg0.length / 2) })
const pHalf = L.sentenceProgress()
check('T1-17 halfway boundary -> progress near halfway (old code: pinned to 0)', pHalf > 0.3 && pHalf < 0.7, `progress=${pHalf}`)
spoken.onboundary({ charIndex: 2 })
check('T1-17 a late smaller event never walks the light backward', L.sentenceProgress() === pHalf, `progress=${L.sentenceProgress()} vs ${pHalf}`)
spoken.onend()
await tick()
check('T1-17 next sentence resets the fraction', L.listen.get().current === 1 && L.sentenceProgress() === 0, `current=${L.listen.get().current} progress=${L.sentenceProgress()}`)
if (spoken) spoken.onend()
L.stop()

// ── T1-16: a clip step past the end preserves the saved place ──
await playClip('clip:probe', 'fake-src', { title: 'Probe clip' })
const a = FakeAudio.instances[FakeAudio.instances.length - 1]
a.duration = 100; a.currentTime = 90
const pausesBefore = a.pauseCalls
stepClip(30)
check('T1-16 overrun step does NOT land on the end', a.currentTime < a.duration && a.currentTime > 99, `t=${a.currentTime}`)
check('T1-16 overrun step pauses on the doorstep (no ended, no done-mark)', a.paused && a.pauseCalls > pausesBefore)
a.currentTime = 10; a.paused = false
stepClip(15)
check('T1-16 an in-range step still lands exactly', a.currentTime === 25 && !a.paused, `t=${a.currentTime} paused=${a.paused}`)
stepClip(-30)
check('T1-16 a backward overrun clamps to the start', a.currentTime === 0, `t=${a.currentTime}`)

// ── T1-15: the resume record learns "finished" ──
initResumeTracking()
const rtext = [sent(11), sent(12), sent(13), sent(14)].join(' ')
L.listen.set({ active: true, text: rtext, current: 2, playing: true, finished: false })
const rec1 = loadSessionResume()
check('T1-15 a mid-text record is offered', !!rec1 && rec1.idx === 2, JSON.stringify(rec1))
L.listen.set({ finished: true, playing: false })
const rec2 = loadSessionResume()
check('T1-15 a finished session is no longer offered as a resume', rec2 === null, JSON.stringify(rec2))
const raw = JSON.parse(store.get('logos.resume.session') ?? 'null')
check('T1-15 the record itself learned done', !!raw && raw.done === true, JSON.stringify(raw))
L.listen.set({ finished: false, playing: true, current: 3 })
const rec3 = loadSessionResume()
check('T1-15 a replay that stops mid-text is a resume again', !!rec3 && rec3.idx === 3 && !rec3.done, JSON.stringify(rec3))

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exitCode = 1
