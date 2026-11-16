// AUDIT Wave 3 PLAYBACK (T1-4,5,6,7,8,11,12) — probes against the real tree.
// Stubs first, then DYNAMIC imports: listen.ts reads window.LogosAndroid
// at import time (its publisher block), so static imports would hoist
// past the stubs.
const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
}
;(globalThis as any).window = globalThis
const mediaCalls: any[] = []
const nativeCalls: any[] = []
;(globalThis as any).LogosAndroid = {
  playing: (on: boolean, title: string, text: string) => { mediaCalls.push({ via: 'playing', on, book: title, text }) },
  media: (on: boolean, book: string, artist: string, text: string) => { mediaCalls.push({ via: 'media', on, book, artist, text }) },
  mediaF: (on: boolean, book: string, artist: string, text: string) => { mediaCalls.push({ via: 'mediaF', on, book, artist, text }) },
  bubbleNative: (t: string, ti: string, ix: number) => { nativeCalls.push(ix) },
  bubbleNativeStop: () => {},
}
;(globalThis as any).MediaMetadata = class { constructor(init: any) { Object.assign(this, init) } }
const et = new EventTarget()
;(globalThis as any).addEventListener = et.addEventListener.bind(et)
;(globalThis as any).removeEventListener = et.removeEventListener.bind(et)
;(globalThis as any).dispatchEvent = et.dispatchEvent.bind(et)

const { renderKey } = await import('../src/player/rendercache.ts')
const { listen, loadText, jumpBy, seekTo, seek, next, prev, sentenceProgress } = await import('../src/player/listen.ts')
const { settings } = await import('../src/lib/settings.ts')
const { clipPlayer } = await import('../src/player/clip.ts')

let pass = 0, fail = 0
const check = (name: string, ok: boolean, extra = '') => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) } }

// ── T1-11: the hunt's colliding pair must now split ──
const a = 'Chapter 48539 begins with a very different opening line, believe me.....'
const b = 'Chapter 165429 begins with a very different opening line, believe me....'
check('T1-11 premise: pair same length', a.length === b.length, `${a.length} vs ${b.length}`)
check('T1-11 hunt pair now keys differently', renderKey(a, 'v1') !== renderKey(b, 'v1'), `${renderKey(a, 'v1')} vs ${renderKey(b, 'v1')}`)
check('T1-11 same input same key (deterministic)', renderKey(a, 'v1') === renderKey(a, 'v1'))
check('T1-11 voice is part of the key', renderKey(a, 'v1') !== renderKey(a, 'v2'))

// Text fixture: 10 sentences x 23 words => estimateSeconds(seg,1) = 23/168*60 = 8.214s each.
// Capitalised sentence starts so the sentence splitter sees the boundaries.
const sent = (n: number) => `Sentence${n} ` + Array.from({ length: 22 }, (_, i) => `Word${i}`).join(' ') + '.'
const text = Array.from({ length: 10 }, (_, i) => sent(i)).join(' ')

// ── T1-5: jump distance independent of speed ──
for (const sp of [0.5, 1, 2]) {
  settings.set({ listenSpeed: sp })
  loadText(text)
  check(`T1-5 setup @${sp}x: 10 segments`, listen.get().segments.length === 10, `got ${listen.get().segments.length}: ${listen.get().segments.map((s: any) => s.text.slice(0, 20)).join('|')}`)
  jumpBy(30)
  const s = listen.get()
  check(`T1-5 jumpBy(30) @${sp}x lands sentence 4 (idx 3) frac~0.65`, s.current === 3 && Math.abs((s.seekFrac ?? 0) - 0.652) < 0.03, `current=${s.current} seekFrac=${s.seekFrac}`)
}
settings.set({ listenSpeed: 1 })

// ── T1-7: paused seek keeps the fraction (unrendered sentence) ──
loadText(text)
seekTo(5, 0.5)
{
  const s = listen.get()
  check('T1-7 paused seekTo(5,0.5): current=5, playing=false', s.current === 5 && s.playing === false, `current=${s.current} playing=${s.playing}`)
  check('T1-7 fraction recorded in store', Math.abs((s.seekFrac ?? 0) - 0.5) < 1e-9, `seekFrac=${s.seekFrac}`)
  check('T1-7 sentenceProgress() shows the scrubbed fraction while paused', Math.abs(sentenceProgress() - 0.5) < 1e-9, `progress=${sentenceProgress()}`)
}

// ── T1-8: seek/next/prev while paused stay paused ──
loadText(text)
listen.set({ current: 2, playing: false })
next()
check('T1-8 next() while paused: moves +1, stays paused', listen.get().current === 3 && listen.get().playing === false, `current=${listen.get().current} playing=${listen.get().playing}`)
prev()
check('T1-8 prev() while paused: moves -1, stays paused', listen.get().current === 2 && listen.get().playing === false, `current=${listen.get().current} playing=${listen.get().playing}`)
seek(7)
check('T1-8 seek(7) while paused: moves, stays paused', listen.get().current === 7 && listen.get().playing === false, `current=${listen.get().current} playing=${listen.get().playing}`)

// ── T1-6: device-mode jump/seek stays on the device road ──
loadText(text)
nativeCalls.length = 0
listen.set({ current: 0, playing: true, mode: 'device' })
jumpBy(30)
{
  const s = listen.get()
  check('T1-6 jumpBy(30) in device mode: mode stays device, playing stays true', s.mode === 'device' && s.playing === true, `mode=${s.mode} playing=${s.playing}`)
  check('T1-6 device jump lands on a whole sentence via the native road', s.current === 3 && nativeCalls.includes(3), `current=${s.current} native=${JSON.stringify(nativeCalls)}`)
}
listen.set({ current: 1, playing: false, mode: 'device' })
seekTo(6, 0.5)
{
  const s = listen.get()
  check('T1-6 paused device seekTo: stays device + paused, fraction honestly dropped', s.mode === 'device' && s.playing === false && s.current === 6 && (s.seekFrac ?? 0) === 0, `mode=${s.mode} playing=${s.playing} current=${s.current} seekFrac=${s.seekFrac}`)
}

// ── T1-4: publisher must not claim PLAYING while buffering/cushioning ──
loadText(text)
mediaCalls.length = 0
listen.set({ playing: true, buffering: false, cushion: null }) // establishes `started`, publishes on=true
const afterPlay = mediaCalls[mediaCalls.length - 1]
check('T1-4 sanity: sounding session publishes on=true', !!afterPlay && afterPlay.on === true, JSON.stringify(mediaCalls))
listen.set({ buffering: true, cushion: { have: 0, need: 10, eta: 5, done: 0, total: 10 } })
const duringCushion = mediaCalls[mediaCalls.length - 1]
check('T1-4 buffering+cushion publishes on=false (not PLAYING)', !!duringCushion && duringCushion !== afterPlay && duringCushion.on === false, JSON.stringify(mediaCalls))
listen.set({ buffering: false, cushion: null })
const afterCushion = mediaCalls[mediaCalls.length - 1]
check('T1-4 cushion done + sounding publishes on=true again', !!afterCushion && afterCushion !== duringCushion && afterCushion.on === true, JSON.stringify(mediaCalls))

// ── T1-12: while a clip plays, the card publishes the CLIP (book='') ──
mediaCalls.length = 0
clipPlayer.set({ key: 'clip:rec1', playing: true, time: 0, duration: 120, title: 'My Recording', artist: 'Some Voice' })
const clipCall = mediaCalls[mediaCalls.length - 1]
check('T1-12 clip playing publishes to the card', !!clipCall && clipCall.on === true, JSON.stringify(mediaCalls))
check('T1-12 clip publish carries the clip title, no book face (no SKIP)', !!clipCall && clipCall.book === '' && clipCall.text === 'My Recording', JSON.stringify(clipCall))
clipPlayer.set({ playing: false })
const afterClip = mediaCalls[mediaCalls.length - 1]
check('T1-12 clip stopped: card returns to the reading truth (not the clip)', !!afterClip && afterClip !== clipCall && !(afterClip.text === 'My Recording' && afterClip.on === true), JSON.stringify(mediaCalls))

console.log(`PLAYBACK probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
