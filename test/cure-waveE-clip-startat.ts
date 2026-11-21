// Cure R4-T1-4 — a clip's startAt seek belongs to its own clip.
// Mirrors the hunt specimen (round4/probes/r4-clip-startat-listener.ts):
// clip A is pressed with a resume offset while its metadata is still
// pending; clip B takes the element; B's metadata fires. The
// generation stamp on the armed listener now judges ownership at
// fire time, so B is never seeked to A's place — while a clip's OWN
// startAt, including a re-pressed A's, still lands.
// Run: node ~/workspace/vela-work/run-ts-test.mjs test/cure-waveE-clip-startat.ts
type Handler = { fn: () => void; once: boolean }
class FakeAudio {
  static instances: FakeAudio[] = []
  handlers = new Map<string, Handler[]>()
  currentTime = 0
  duration = 100
  paused = true
  playbackRate = 1
  volume = 1
  preload = 'auto'
  src = ''
  constructor() { FakeAudio.instances.push(this) }
  addEventListener(type: string, fn: () => void, opts?: { once?: boolean }) {
    const list = this.handlers.get(type) ?? []
    list.push({ fn, once: !!opts?.once })
    this.handlers.set(type, list)
  }
  removeEventListener(type: string, fn: () => void) {
    this.handlers.set(type, (this.handlers.get(type) ?? []).filter((h) => h.fn !== fn))
  }
  dispatch(type: string) {
    const list = [...(this.handlers.get(type) ?? [])]
    this.handlers.set(type, list.filter((h) => !h.once))
    for (const h of list) h.fn()
  }
  play() { this.paused = false; this.dispatch('play'); return Promise.resolve() }
  pause() { if (!this.paused) { this.paused = true; this.dispatch('pause') } }
}
;(globalThis as any).Audio = FakeAudio
;(globalThis as any).localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true })
let urlN = 0
;(globalThis as any).URL.createObjectURL = () => `blob:fake-${++urlN}`
;(globalThis as any).URL.revokeObjectURL = () => {}
;(globalThis as any).MediaMetadata = class { constructor(init: any) { Object.assign(this, init) } }
;(globalThis as any).fetch = () => Promise.reject(new Error('offline probe'))

let pass = 0, fail = 0
const check = (name: string, ok: boolean, extra = '') => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) } }

const { playClip, clipPlayer } = await import('../src/player/clip.ts')
const blob = new Blob(['x'])
const el = () => FakeAudio.instances[0]

// Clip A pressed with a resume offset of 50 s; its metadata has NOT loaded.
await playClip('clip:a', blob, { title: 'Clip A', sub: '' } as any, 50)
check('setup: clip A owns the element, metadata pending', clipPlayer.get().key === 'clip:a' && el().currentTime === 0, `key=${clipPlayer.get().key} t=${el().currentTime}`)
// Clip B pressed (from its beginning) before A's metadata ever fires.
await playClip('clip:b', blob, { title: 'Clip B', sub: '' } as any, 0)
check('setup: clip B owns the element now', clipPlayer.get().key === 'clip:b', `key=${clipPlayer.get().key}`)
// B's metadata arrives — A's once-listener is still armed on the element.
el().dispatch('loadedmetadata')
el().dispatch('timeupdate')
check('cure: clip B was NOT seeked to clip A’s startAt by the stale listener', el().currentTime === 0, `currentTime=${el().currentTime}`)
check('cure far end: the clip store reports B at its own beginning', clipPlayer.get().key === 'clip:b' && clipPlayer.get().time === 0, `time=${clipPlayer.get().time}`)
// A clip's OWN startAt still lands where it should.
await playClip('clip:c', blob, { title: 'Clip C', sub: '' } as any, 30)
el().dispatch('loadedmetadata')
check('control: clip C’s own startAt (30 s) honoured', el().currentTime === 30, `currentTime=${el().currentTime}`)
// And a RE-PRESSED A (a fresh playClip, a fresh listener) lands its own.
await playClip('clip:a', blob, { title: 'Clip A', sub: '' } as any, 50)
el().dispatch('loadedmetadata')
check('control: re-pressed clip A’s own startAt (50 s) honoured', el().currentTime === 50, `currentTime=${el().currentTime}`)

console.log(`CURE R4-T1-4 probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
