import { createStore } from './store.ts'

/**
 * The bottom-bar pin (1.4.115, Oscar — correcting the 1.4.114 house,
 * which misunderstood him and left the app): while Listen plays, the
 * app goes immersive — the bottom bar slides away and the player
 * settles into its place — and the ONLY way back to the bar was to
 * stop the audio. The pin is his key in the player's empty left seat:
 * pinned, the bar stays and the player glides back up, the reading
 * never stopping. It clears itself when playback stops, so the next
 * play starts immersive as designed.
 */
export const navPin = createStore<{ pinned: boolean }>({ pinned: false })
