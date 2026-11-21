// Cure R4-T1-5 — a sounding voice preview keeps the browser card.
// Mirrors the hunt specimen (round4/probes/r4-preview-card-clobber.ts):
// a preview sounds over a paused reading; a reading-side seek runs
// updateMediaSession. Its clip guard now covers previews exactly as
// the R3-T1-8 subscription's law states, so the card keeps the
// preview's name while it sounds — and when the preview pauses, the
// subscription hands the card back to the reading.
// Run: node ~/workspace/vela-work/run-ts-test.mjs test/cure-waveE-preview-card.ts
const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
}
;(globalThis as any).window = globalThis
;(globalThis as any).location = { href: 'http://localhost/', hash: '' }
;(globalThis as any).MediaMetadata = class { constructor(init: any) { Object.assign(this, init) } }
const card: { metadata: any; playbackState: string } = { metadata: null, playbackState: 'none' }
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    mediaSession: {
      get metadata() { return card.metadata },
      set metadata(v: any) { card.metadata = v },
      get playbackState() { return card.playbackState },
      set playbackState(v: string) { card.playbackState = v },
      setActionHandler: () => {},
      setPositionState: () => {},
    },
  },
})
class FakeAudio {
  src = ''
  paused = true
  currentTime = 0
  duration = 100
  playbackRate = 1
  loop = false
  preload = ''
  volume = 1
  private ls = new Map<string, ((ev: any) => void)[]>()
  addEventListener(name: string, fn: (ev: any) => void) { const a = this.ls.get(name) ?? []; a.push(fn); this.ls.set(name, a) }
  removeEventListener() {}
  fire(name: string) { (this.ls.get(name) ?? []).forEach((f) => f({ type: name })) }
  play() { this.paused = false; this.fire('play'); return Promise.resolve() }
  pause() { this.paused = true; this.fire('pause') }
  load() {}
  removeAttribute() {}
}
const audios: FakeAudio[] = []
;(globalThis as any).Audio = class extends FakeAudio { constructor() { super(); audios.push(this) } }
const et = new EventTarget()
;(globalThis as any).addEventListener = et.addEventListener.bind(et)
;(globalThis as any).removeEventListener = et.removeEventListener.bind(et)
;(globalThis as any).dispatchEvent = et.dispatchEvent.bind(et)
;(import.meta as any).env = { BASE_URL: '/' }

const { loadText, seekTo } = await import('../src/player/listen.ts')
const { playClip, pauseClip, clipPlayer } = await import('../src/player/clip.ts')

let pass = 0, fail = 0
const check = (name: string, ok: boolean, extra = '') => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) } }
const tick = () => new Promise((r) => setTimeout(r, 10))

const sent = (n: number) => `Reading${n} ` + Array.from({ length: 22 }, (_, i) => `Word${i}`).join(' ') + '.'
loadText(Array.from({ length: 10 }, (_, i) => sent(i)).join(' '))
seekTo(1, 0)
await tick()
check('setup: the card wears the paused reading', !!card.metadata && String(card.metadata.title).includes('Reading1'), `title=${card.metadata?.title}`)

// A voice preview sounds over the paused reading and takes the card.
await playClip('preview:voice1', 'https://example.invalid/preview.mp3', { title: 'Voice Preview', artist: 'Preview Artist' })
await tick()
check('setup: the preview is sounding and wears the card', clipPlayer.get().playing === true && clipPlayer.get().key === 'preview:voice1' && card.metadata?.title === 'Voice Preview',
  `key=${clipPlayer.get().key} playing=${clipPlayer.get().playing} title=${card.metadata?.title}`)

// A reading-side seek runs updateMediaSession — its guard now refuses.
seekTo(2, 0)
await tick()
check('cure far end: the card still names the sounding preview after the reading-side seek', card.metadata?.title === 'Voice Preview' && clipPlayer.get().playing === true && clipPlayer.get().key === 'preview:voice1',
  `title=${card.metadata?.title} playing=${clipPlayer.get().playing}`)

// When the preview stops sounding, the card is handed back to the reading.
pauseClip()
await tick()
check('cure far end: the paused preview hands the card back to the reading', String(card.metadata?.title ?? '').includes('Reading2'), `title=${card.metadata?.title}`)

// Control: a real clip in the same seat is protected by the same call.
await playClip('clip:probe2', 'https://example.invalid/clip.mp3', { title: 'Real Clip', artist: 'Clip Artist' })
await tick()
seekTo(3, 0)
await tick()
check('control: a sounding CLIP keeps the card against the same seek', card.metadata?.title === 'Real Clip', `title=${card.metadata?.title}`)

console.log(`CURE R4-T1-5 probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
