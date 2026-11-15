/**
 * geometry.ts — the focus frame's geometry and the card's seat (pure;
 * the engine tests pin both).
 *
 * THE SCREEN-EDGE LAW (law (11)'s sibling — Oscar, relayed from the Brizna
 * lane 2026-11-14): the breathing hole around the focus — the anchor's rect
 * plus ~10px of air — is CONTAINED wholly inside the viewport on all four
 * sides. The AIR compresses at the edges; the RING never leaves the screen
 * and is never cut by a device edge. The veil (.lp-veil) and the ring
 * (.lp-ring) both paint from this one computation, so the hole the learner
 * sees and the hole the veil cuts can never disagree.
 *
 * Before this helper, the player inlined `rect ± 10px` with NO clamp on any
 * side: a focus flush with the bottom tab bar painted its ring 10px past
 * the screen's bottom edge (y=854 in an 844px viewport), and a focus flush
 * right painted it 10px past the right edge — the Brizna defect, verbatim.
 */

export interface RectLike {
  top: number
  left: number
  width: number
  height: number
}

/** Air the hole keeps around the focus, where the screen has room for it. */
export const HOLE_AIR = 10
/** Margin the hole itself always keeps from every edge of the screen. */
export const HOLE_EDGE = 4

/**
 * The contained breathing hole for `rect` inside a viewport of
 * `viewportW` × `viewportH`: left = max(4, rect.left − 10),
 * top = max(4, rect.top − 10), right = min(vw − 4, rect.right + 10),
 * bottom = min(vh − 4, rect.bottom + 10), width/height derived — so the
 * whole frame breathes inside the screen on all four sides.
 *
 * With no measured viewport yet (0 on either axis) there is nothing to
 * contain against: the plain breathing hole is returned for that
 * pre-measure frame, exactly as the player painted it before.
 */
export function containedHole(rect: RectLike, viewportW: number, viewportH: number): RectLike {
  if (!(viewportW > 0) || !(viewportH > 0)) {
    return {
      top: rect.top - HOLE_AIR,
      left: rect.left - HOLE_AIR,
      width: rect.width + HOLE_AIR * 2,
      height: rect.height + HOLE_AIR * 2,
    }
  }
  const left = Math.max(HOLE_EDGE, rect.left - HOLE_AIR)
  const top = Math.max(HOLE_EDGE, rect.top - HOLE_AIR)
  const right = Math.min(viewportW - HOLE_EDGE, rect.left + rect.width + HOLE_AIR)
  const bottom = Math.min(viewportH - HOLE_EDGE, rect.top + rect.height + HOLE_AIR)
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
}

/* ------------------------------------------------------------------ */
/* The card's seat — where the C′ card lives (law: the card is born    */
/* where it will live, Oscar via the Brizna lane 2026-11-14).          */
/* ------------------------------------------------------------------ */

/** Air between the focus and the card that sits beside it. */
export const CARD_GAP = 16
/** Margin the card keeps from the viewport's edges. */
export const VIEW_MARGIN = 12

export interface CardSeat {
  left: number
  /** Set when the card hangs from the viewport's top (focus is high). */
  top?: number
  /** Set when the card stands from the viewport's bottom (focus is low). */
  bottom?: number
}

/**
 * The card's seat beside `focus`, or NULL while no honest seat exists.
 *
 * THE CARD IS BORN WHERE IT WILL LIVE: while its seat is still being
 * measured — no focus rect yet, or no measured viewport — there is NO
 * seat, and the player renders no card at all. The card's first visible
 * frame is already home; it never appears at a provisional seat (the
 * centre, a corner) and then travels. Once seated, later seats come
 * from this same computation, and the card's one motion clock (the
 * player's --lp-dur / --lp-ease) glides it between them.
 *
 * The seat itself (the C′ placement): beside the focus — below it when
 * the focus is high, above it when low, lifted clear of the mini player
 * (`miniInset`) — at the width the screen's size earns (370px on
 * phones, 480px ≥840px, 550px ≥1500px; Logos' real breakpoint ladder).
 */
export function cardSeat(
  focus: RectLike | null,
  viewportW: number,
  viewportH: number,
  miniInset: number,
): CardSeat | null {
  if (!focus || !(viewportW > 0) || !(viewportH > 0)) return null
  const cardWidth = viewportW >= 1500 ? 550 : viewportW >= 840 ? 480 : 370
  const left = Math.min(Math.max(focus.left, VIEW_MARGIN), Math.max(VIEW_MARGIN, viewportW - cardWidth - VIEW_MARGIN))
  if (focus.top + focus.height / 2 > (viewportH - miniInset) / 2) {
    // Focus is low: the card sits above it, lifted clear of the mini player.
    return { left, bottom: Math.max(viewportH - focus.top + CARD_GAP, miniInset + VIEW_MARGIN) }
  }
  return { left, top: focus.top + focus.height + CARD_GAP }
}
