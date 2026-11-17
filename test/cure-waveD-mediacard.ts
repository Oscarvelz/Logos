// Cure R3-T1-8 — on the browser road, a finished clip's metadata is
// handed back to the reading. The hunt filed this mechanism-exact
// (three metadata writers, no clip-end caller); this probe witnesses
// the FAR END — navigator.mediaSession.metadata itself — through the
// real clip player and the real listen store:
//   1. a paused reading's seek writes the reading's metadata;
//   2. a clip playing over it replaces it with the clip's;
//   3. while the clip sounds, a reading-side updateMediaSession is
//      refused (the T1-12 guard: the clip's claim stands);
//   4. the clip ENDS (the element's own 'ended' event) and the card
//      wears the reading's metadata again — no listen-store change
//      happens in between, so only the cure's clipPlayer
//      subscription can have written it.
// Run: node ~/workspace/vela-work/run-ts-test.mjs test/cure-waveD-mediacard.ts
const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
}
;(globalThis as any).window = globalThis
;(globalThis as any).location = { href: 'http://localhost/', hash: '' }
;(globalThis as any).MediaMetadata = class { constructor(init: any) { Object.assign(this, init) } }

// A minimal media card: the metadata object itself is the witness.
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

// A fake <audio> the clip player can drive: play/pause flip `paused`
// and fire their events, exactly as the element does; the test fires
// 'ended' by hand.
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

// The app reads import.meta.env.BASE_URL when it builds card
// artwork URLs (a Vite define in production). The node runner
// leaves import.meta.env undefined; the bundle is a single chunk,
// so seeding it here — before any card-writing call — gives the
// app modules the same object they read at call time.
;(import.meta as any).env = { BASE_URL: '/' }

const { listen, loadText, seekTo } = await import('../src/player/listen.ts')
const { playClip, clipPlayer } = await import('../src/player/clip.ts')

let pass = 0, fail = 0
const check = (name: string, ok: boolean, extra = '') => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) } }
const tick = () => new Promise((r) => setTimeout(r, 10))

const sent = (n: number) => `Reading${n} ` + Array.from({ length: 22 }, (_, i) => `Word${i}`).join(' ') + '.'
loadText(Array.from({ length: 10 }, (_, i) => sent(i)).join(' '))

// 1. The reading takes the card (a paused seek runs updateMediaSession).
seekTo(1, 0)
await tick()
check('setup: the card wears the reading', !!card.metadata && String(card.metadata.title).includes('Reading1'),
  `title=${card.metadata?.title}`)

// 2. A clip plays over the paused reading and takes the card.
await playClip('clip:probe', 'https://example.invalid/clip.mp3', { title: 'The Clip Title', artist: 'Clip Artist' })
await tick()
check('setup: the clip is sounding and holds the stage', clipPlayer.get().playing === true && clipPlayer.get().key === 'clip:probe',
  JSON.stringify(clipPlayer.get()))
check('setup: the card wears the clip', card.metadata?.title === 'The Clip Title', `title=${card.metadata?.title}`)

// 3. While the clip sounds, the reading must not overwrite it.
seekTo(2, 0)
await tick()
check('guard: the sounding clip keeps the card', card.metadata?.title === 'The Clip Title', `title=${card.metadata?.title}`)

// 4. The clip ends — its element says so — and the card is handed back.
const clipEl = audios[audios.length - 1]
clipEl.fire('ended')
await tick()
check('the clip player reports the end', clipPlayer.get().playing === false, JSON.stringify(clipPlayer.get()))
check('CURE: the card wears the reading again after the clip ends',
  !!card.metadata && String(card.metadata.title).includes('Reading') && card.metadata.title !== 'The Clip Title',
  `title=${card.metadata?.title}`)

console.log(`CURE R3-T1-8 probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
