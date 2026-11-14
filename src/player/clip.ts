// One shared player for finished clips (Library, Create result, voice previews).
import { createStore } from '../lib/store.ts'

export const clipPlayer = createStore<{ key: string | null; playing: boolean; time: number; duration: number; title: string; artist: string }>({ key: null, playing: false, time: 0, duration: 0, title: '', artist: '' })

let audio: HTMLAudioElement | null = null
let url: string | null = null
let onStopHooks: (() => void)[] = []
const endHooks: ((key: string | null) => void)[] = []
export function onClipEnded(fn: (key: string | null) => void) { endHooks.push(fn) }

function el() {
  if (audio) return audio
  audio = new Audio()
  audio.addEventListener('timeupdate', () => clipPlayer.set({ time: audio!.currentTime, duration: isFinite(audio!.duration) ? audio!.duration : 0 }))
  audio.addEventListener('loadedmetadata', () => clipPlayer.set({ duration: isFinite(audio!.duration) ? audio!.duration : 0 }))
  audio.addEventListener('play', () => clipPlayer.set({ playing: true }))
  audio.addEventListener('pause', () => clipPlayer.set({ playing: false }))
  audio.addEventListener('ended', () => { clipPlayer.set({ playing: false, time: 0 }); endHooks.forEach((f) => f(clipPlayer.get().key)) })
  return audio
}

/** Called by the Listen controller so two things never play at once. */
export function stopClipPlayer() {
  audio?.pause()
}
export function onClipPlay(fn: () => void) { onStopHooks.push(fn); return () => { onStopHooks = onStopHooks.filter((f) => f !== fn) } }

export async function playClip(key: string, source: Blob | string, meta?: { title: string; artist?: string }, startAt = 0) {
  const a = el()
  onStopHooks.forEach((f) => f())
  if (clipPlayer.get().key === key && a.src) {
    if (a.paused) await a.play().catch(() => {})
    else a.pause()
    return
  }
  if (url) URL.revokeObjectURL(url)
  url = typeof source === 'string' ? null : URL.createObjectURL(source)
  a.src = typeof source === 'string' ? source : url!
  clipPlayer.set({ key, time: startAt, duration: 0, title: meta?.title ?? '', artist: meta?.artist ?? '' })
  if (startAt > 0) a.addEventListener('loadedmetadata', () => { if (isFinite(a.duration) && startAt < a.duration - 2) a.currentTime = startAt }, { once: true })
  if (meta && 'mediaSession' in navigator) {
    const base = import.meta.env.BASE_URL
    // 1.4.49: same themed artwork as Listen (see listen.ts) — warm charcoal and gold, absolute URLs.
    const art = (file: string, sizes: string) => ({ src: new URL(`${base}${file}`, location.href).href, sizes, type: 'image/png' })
    navigator.mediaSession.metadata = new MediaMetadata({ title: meta.title, artist: meta.artist ?? 'Logos', artwork: [art('media-artwork-512.png', '512x512'), art('media-artwork.png', '1024x1024')] })
  }
  await a.play().catch(() => clipPlayer.set({ playing: false }))
}

export function seekClip(fraction: number) {
  if (audio && isFinite(audio.duration)) audio.currentTime = fraction * audio.duration
}

export function pauseClip() { audio?.pause() }

/** Resume the loaded clip where it stands (the bubble's play key, 1.4.156). */
export function resumeClip() { if (audio && audio.src) void audio.play().catch(() => { /* stays paused */ }) }

/** Step the loaded clip along its own timeline (the bubble's prev/next on a
 *  recording, 1.4.156: it has no sentences to step, so the keys walk time). */
export function stepClip(sec: number) {
  if (audio && isFinite(audio.duration) && audio.duration > 0) {
    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + sec))
  }
}
