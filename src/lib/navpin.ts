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

/**
 * The lowered player (1.4.250, Oscar; the deed corrected by his
 * own word in 1.4.251): the same left seat of the transport, at
 * the hours when nothing plays. The pin's deed belongs to the
 * playing hours; Oscar asked for the key to stand in the quiet
 * ones too — tapped there, it lowers the WHOLE player, intact:
 * the desk below the player hides, the app goes immersive (the
 * bottom bar slides away, as it does for a reading), and the
 * player settles into the freed bottom while the text window
 * above takes everything — «ensanchar la ventana de arriba».
 * (250 first shipped a fold of the card's own furniture; Oscar
 * corrected it the same night: not smaller — lower.) Tapped
 * again, everything returns. It clears itself when playback
 * starts, the pin's own law mirrored: the listening hours wear
 * their own arrangement, and lowering is a writing-hours choice
 * he makes again with one tap.
 */
export const playerLow = createStore<{ lowered: boolean }>({ lowered: false })
