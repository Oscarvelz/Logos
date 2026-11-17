// Cure R2-T1-4: the shell publisher's dedupe key now covers the voice
// its payload carries. The hunt probe (round2/probes/r2-pubkey.ts)
// proved a paused voice change was deduped away; this probe proves
// the next publish after refreshVoices() names the new voice.
const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
}
;(globalThis as any).window = globalThis
const mediaCalls: any[] = []
;(globalThis as any).LogosAndroid = {
  playing: (on: boolean, title: string, text: string) => { mediaCalls.push({ via: 'playing', on, book: title, artist: '', text }) },
  media: (on: boolean, book: string, artist: string, text: string) => { mediaCalls.push({ via: 'media', on, book, artist, text }) },
  mediaF: (on: boolean, book: string, artist: string, text: string) => { mediaCalls.push({ via: 'mediaF', on, book, artist, text }) },
  bubbleNative: () => {},
  bubbleNativeStop: () => {},
}
;(globalThis as any).MediaMetadata = class { constructor(init: any) { Object.assign(this, init) } }
const et = new EventTarget()
;(globalThis as any).addEventListener = et.addEventListener.bind(et)
;(globalThis as any).removeEventListener = et.removeEventListener.bind(et)
;(globalThis as any).dispatchEvent = et.dispatchEvent.bind(et)

const { listen, loadText, refreshVoices } = await import('../src/player/listen.ts')
const { settings } = await import('../src/lib/settings.ts')
const { VOICES, voiceById } = await import('../src/lib/voices.ts')

let pass = 0, fail = 0
const check = (name: string, ok: boolean, extra = '') => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) } }

const sent = (n: number) => `Sentence${n} ` + Array.from({ length: 22 }, (_, i) => `Word${i}`).join(' ') + '.'
loadText(Array.from({ length: 10 }, (_, i) => sent(i)).join(' '))
listen.set({ playing: true }) // establishes `started`, publishes with the standing voice
const v0 = listen.get().voices[0]
const call0 = mediaCalls[mediaCalls.length - 1]
check('setup: a publish names the standing voice as artist', !!call0 && call0.artist.includes(voiceById(v0)?.name ?? '∅'), JSON.stringify(call0))

listen.set({ playing: false }) // pause: publishes on=false, same voice
const callsAfterPause = mediaCalls.length

const other = VOICES.find((v) => v.lang === 'en' && v.id !== v0)!
settings.set({ voiceOverride: other.id })
refreshVoices()
const v1 = listen.get().voices[0]
check('the store now stands on the new voice', v1 === other.id, `voices[0]=${v1} wanted ${other.id}`)
const fresh = mediaCalls.slice(callsAfterPause)
check('cured: a publish after the voice change names the new voice', fresh.some((c) => c.artist.includes(other.name)), `new calls=${JSON.stringify(fresh)}`)

// And the dedupe still dedupes: a no-op store touch republishes nothing.
const before = mediaCalls.length
listen.set({})
check('dedupe intact: an unchanged state publishes nothing new', mediaCalls.length === before, `calls ${before} -> ${mediaCalls.length}`)

console.log(`CURE R2-T1-4 probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
