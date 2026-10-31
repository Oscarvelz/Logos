// One shared player for finished clips (Library, Create result, voice previews).
import { createStore } from '../lib/store.ts'

export const clipPlayer = createStore<{ key: string | null; playing: boolean; time: number; duration: number }>({ key: null, playing: false, time: 0, duration: 0 })

let audio: HTMLAudioElement | null = null
let url: string | null = null
let onStopHooks: (() => void)[] = []

function el() {
  if (audio) return audio
  audio = new Audio()
  audio.addEventListener('timeupdate', () => clipPlayer.set({ time: audio!.currentTime, duration: isFinite(audio!.duration) ? audio!.duration : 0 }))
  audio.addEventListener('loadedmetadata', () => clipPlayer.set({ duration: isFinite(audio!.duration) ? audio!.duration : 0 }))
  audio.addEventListener('play', () => clipPlayer.set({ playing: true }))
  audio.addEventListener('pause', () => clipPlayer.set({ playing: false }))
  audio.addEventListener('ended', () => clipPlayer.set({ playing: false, time: 0 }))
  return audio
}

/** Called by the Listen controller so two things never play at once. */
export function stopClipPlayer() {
  audio?.pause()
}
export function onClipPlay(fn: () => void) { onStopHooks.push(fn); return () => { onStopHooks = onStopHooks.filter((f) => f !== fn) } }

export async function playClip(key: string, source: Blob | string, meta?: { title: string; artist?: string }) {
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
  clipPlayer.set({ key, time: 0, duration: 0 })
  if (meta && 'mediaSession' in navigator) {
    const base = import.meta.env.BASE_URL
    navigator.mediaSession.metadata = new MediaMetadata({ title: meta.title, artist: meta.artist ?? 'Logos', artwork: [{ src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png' }] })
  }
  await a.play().catch(() => clipPlayer.set({ playing: false }))
}

export function seekClip(fraction: number) {
  if (audio && isFinite(audio.duration)) audio.currentTime = fraction * audio.duration
}

export function pauseClip() { audio?.pause() }
