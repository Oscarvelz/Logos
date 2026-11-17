/**
 * geometry.ts — the focus frame's geometry and the card's seat (pure;
 * the engine tests pin both).
 *
 * THE SCREEN-EDGE LAW (law (11)'s sibling — Oscar, relayed from the Brizna
 * lane 2026-11-14), AS AMENDED BY P6: the breathing hole around the focus
 * — the anchor's rect plus ~10px of air — never CROPS the focus, and
 * never leaves the viewport. The hole must always contain the element's
 * ON-SCREEN rect whole: for a flush element the hole runs to the very
 * edge of the screen on that side (0 / vw / vh — the AIR is what gives,
 * to zero if it must), instead of insetting 4px INTO the element and
 * veiling its outermost strip. Only a genuinely off-screen portion is
 * framed at the old HOLE_EDGE margin — the visible portion is the honest
 * maximum there. The veil (.lp-veil) and the ring (.lp-ring) both paint
 * from this one computation, so the hole the learner sees and the hole
 * the veil cuts can never disagree.
 *
 * Before this helper, the player inlined `rect ± 10px` with NO clamp on any
 * side: a focus flush with the bottom tab bar painted its ring 10px past
 * the screen's bottom edge (y=854 in an 844px viewport), and a focus flush
 * right painted it 10px past the right edge — the Brizna defect, verbatim.
 * The first containment pass then clamped every side independently to
 * [4, vw−4] / [4, vh−4], which fixed the ring leaving the screen but
 * cropped 4px of any flush element under the veil (P6) — hence the
 * contain-the-element rule below.
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
 * `viewportW` × `viewportH` — or NULL when there is no honest hole.
 *
 * VALIDITY CONTRACT (for the player, Builder 3b): `containedHole`
 * returns `RectLike | null`. Null means NO TARGET: the rect has zero
 * intersection with the viewport, or the derived hole would be
 * non-positive. The player must treat null exactly as it treats a
 * missing focus today — paint no veil panels and no ring for it. (The
 * current player already null-guards both call sites — `hole` and
 * `ringHole` are only painted under a truthiness check — so this
 * contract needs no signature gymnastics there; no separate
 * `holeIsValid` helper is exported, so there is exactly one validity
 * rule and it lives here.)
 *
 * Per side (left shown; right/top/bottom are symmetric), with
 * rectRight = rect.left + rect.width:
 *   · rect.left ≥ 0 (the element's left edge is on screen):
 *       holeLeft = min(max(HOLE_EDGE, rect.left − HOLE_AIR), rect.left)
 *     — the full 10px of air where the screen has room, compressing to
 *     the element's own edge for a flush element (holeLeft = 0 at
 *     rect.left = 0), NEVER past it into the element.
 *   · rect.right ≤ viewportW (right edge on screen):
 *       holeRight = max(min(vw − HOLE_EDGE, rectRight + HOLE_AIR), rectRight)
 *     — symmetric: a flush-right element's hole ends at vw itself.
 *   · a genuinely off-screen side (rect.left < 0, rect.right > vw, …)
 *     clamps to the viewport as before: HOLE_EDGE / vw − HOLE_EDGE,
 *     framing the visible portion.
 *
 * With no measured viewport yet (0 on either axis) there is nothing to
 * contain against (and no intersection to judge): the plain breathing
 * hole is returned for that pre-measure frame, exactly as the player
 * painted it before.
 */
export function containedHole(rect: RectLike, viewportW: number, viewportH: number): RectLike | null {
  if (!(viewportW > 0) || !(viewportH > 0)) {
    return {
      top: rect.top - HOLE_AIR,
      left: rect.left - HOLE_AIR,
      width: rect.width + HOLE_AIR * 2,
      height: rect.height + HOLE_AIR * 2,
    }
  }
  const rectRight = rect.left + rect.width
  const rectBottom = rect.top + rect.height
  // Zero intersection with the viewport: no target, no hole.
  if (rectRight <= 0 || rect.left >= viewportW || rectBottom <= 0 || rect.top >= viewportH) return null
  const left = rect.left >= 0 ? Math.min(Math.max(HOLE_EDGE, rect.left - HOLE_AIR), rect.left) : HOLE_EDGE
  const top = rect.top >= 0 ? Math.min(Math.max(HOLE_EDGE, rect.top - HOLE_AIR), rect.top) : HOLE_EDGE
  const right =
    rectRight <= viewportW ? Math.max(Math.min(viewportW - HOLE_EDGE, rectRight + HOLE_AIR), rectRight) : viewportW - HOLE_EDGE
  const bottom =
    rectBottom <= viewportH
      ? Math.max(Math.min(viewportH - HOLE_EDGE, rectBottom + HOLE_AIR), rectBottom)
      : viewportH - HOLE_EDGE
  const width = right - left
  const height = bottom - top
  if (!(width > 0) || !(height > 0)) return null
  return { top, left, width, height }
}

/**
 * The smallest rect containing every rect in `rects` (P8/P11: the
 * footprint a step's anchor + its effect region together occupy), or
 * NULL for an empty list — there is nothing to contain.
 */
export function unionRect(rects: readonly RectLike[]): RectLike | null {
  if (rects.length === 0) return null
  let top = Infinity
  let left = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const r of rects) {
    top = Math.min(top, r.top)
    left = Math.min(left, r.left)
    right = Math.max(right, r.left + r.width)
    bottom = Math.max(bottom, r.top + r.height)
  }
  return { top, left, width: right - left, height: bottom - top }
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
 *
 * THE FOOTPRINT SEAT (P8/P11/P4): when the caller passes `footprint`
 * — the union (see unionRect) of the anchor rect and the region its
 * effect will occupy — the seat is computed against the FOOTPRINT, not
 * the anchor alone, so the card never sits on the place the lesson is
 * about to change. Candidate seats stand above and below the
 * footprint, each a full CARD_GAP clear of it:
 *   · a candidate is VALID only if it does not intersect the footprint
 *     expanded by CARD_GAP on every side AND it fits the viewport —
 *     the card's bottom edge never passes
 *     viewportH − miniInset − VIEW_MARGIN, its top never passes
 *     VIEW_MARGIN. Fit is judged with `cardHeight` when provided;
 *     without it, the candidate's single placement point (its top for
 *     the below seat, its bottom edge for the above seat) is what must
 *     fit — the current single-point placement style for that side.
 *   · preference order is ABOVE the footprint, then BELOW it (when a
 *     step's effect portion lies below its anchor, the valid seat is
 *     the one above — the non-intersection rule already yields that;
 *     the order is encoded here so it never depends on the focus-half
 *     rule the legacy seat uses). When neither stands, a SIDE seat
 *     beside the footprint (right, then left — R2-T6-8) is tried
 *     before any covering fallback: a seat that covers nothing always
 *     beats one that covers something.
 *   · if NEITHER candidate is valid, the seat is the side whose
 *     clamped-into-the-viewport placement covers LESS: first by
 *     whether it covers the anchor rect itself (`focus`) — a side
 *     that avoids the anchor always beats one that covers it — then
 *     by the height it covers of the footprint. (Card width is the
 *     same on both sides, so covered height is covered area.) Without
 *     `cardHeight` there is no card extent to cover with, so the
 *     fallback picks the side with the larger clear run and clamps
 *     its placement point into the viewport.
 *
 * With NO footprint, the behaviour is byte-identical to the legacy
 * seat above: the focus-half rule, untouched.
 */
export function cardSeat(
  focus: RectLike | null,
  viewportW: number,
  viewportH: number,
  miniInset: number,
  footprint?: RectLike | null,
  cardHeight?: number,
): CardSeat | null {
  if (!focus || !(viewportW > 0) || !(viewportH > 0)) return null
  const cardWidth = viewportW >= 1500 ? 550 : viewportW >= 840 ? 480 : 370
  const left = Math.min(Math.max(focus.left, VIEW_MARGIN), Math.max(VIEW_MARGIN, viewportW - cardWidth - VIEW_MARGIN))
  if (!footprint) {
    if (focus.top + focus.height / 2 > (viewportH - miniInset) / 2) {
      // Focus is low: the card sits above it, lifted clear of the mini player.
      return { left, bottom: Math.max(viewportH - focus.top + CARD_GAP, miniInset + VIEW_MARGIN) }
    }
    return { left, top: focus.top + focus.height + CARD_GAP }
  }

  /* ── Footprint seat ─────────────────────────────────────────────── */
  const bottomLimit = viewportH - miniInset - VIEW_MARGIN // lowest y a card edge may reach
  const fpTop = footprint.top
  const fpBottom = footprint.top + footprint.height
  const expanded = {
    top: fpTop - CARD_GAP,
    left: footprint.left - CARD_GAP,
    width: footprint.width + CARD_GAP * 2,
    height: footprint.height + CARD_GAP * 2,
  }
  const hasHeight = typeof cardHeight === 'number' && cardHeight > 0
  const intersects = (a: RectLike, b: RectLike) =>
    a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top

  // Above the footprint: the card's bottom edge stands CARD_GAP above
  // the footprint's top, lifted no lower than the mini-player limit.
  const aboveBottomEdge = Math.min(fpTop - CARD_GAP, bottomLimit)
  const aboveTop = hasHeight ? aboveBottomEdge - cardHeight : aboveBottomEdge
  const aboveRect: RectLike = { top: aboveTop, left, width: cardWidth, height: hasHeight ? cardHeight : 0 }
  const aboveValid =
    aboveBottomEdge >= VIEW_MARGIN &&
    (!hasHeight || aboveTop >= VIEW_MARGIN) &&
    !intersects(aboveRect, expanded)

  // Below the footprint: the card's top stands CARD_GAP below the
  // footprint's bottom.
  const belowTop = fpBottom + CARD_GAP
  const belowRect: RectLike = { top: belowTop, left, width: cardWidth, height: hasHeight ? cardHeight : 0 }
  const belowValid =
    belowTop >= VIEW_MARGIN &&
    (hasHeight ? belowTop + cardHeight <= bottomLimit : belowTop <= bottomLimit) &&
    !intersects(belowRect, expanded)

  if (aboveValid) return { left, bottom: viewportH - aboveBottomEdge }
  if (belowValid) return { left, top: belowTop }

  /* SIDE seats (R2-T6-8 — Oscar's tablet finding): before any seat
   * that COVERS part of the footprint is even considered, a seat
   * BESIDE it that covers nothing wins — the fallback's own first
   * principle (a side that avoids the subject beats one that covers
   * it), extended from the anchor to the whole footprint. A side seat
   * needs the card's real height: the card stands in the vertical run
   * beside the footprint, top-aligned with it and clamped into the
   * viewport, and is valid only if it fits that run whole and never
   * intersects the expanded footprint. Right side first (the reading
   * direction), then left. On phone widths neither side can fit a
   * card, so phone seats are untouched. */
  if (hasHeight) {
    const sideTop = Math.min(
      Math.max(fpTop, VIEW_MARGIN),
      Math.max(VIEW_MARGIN, bottomLimit - (cardHeight as number)),
    )
    const sideRect = (l: number): RectLike => ({ top: sideTop, left: l, width: cardWidth, height: cardHeight as number })
    const rightLeft = footprint.left + footprint.width + CARD_GAP
    if (rightLeft + cardWidth <= viewportW - VIEW_MARGIN && !intersects(sideRect(rightLeft), expanded)) {
      return { left: rightLeft, top: sideTop }
    }
    const leftLeft = footprint.left - CARD_GAP - cardWidth
    if (leftLeft >= VIEW_MARGIN && !intersects(sideRect(leftLeft), expanded)) {
      return { left: leftLeft, top: sideTop }
    }
  }

  /* Neither candidate is valid: the lesser-coverage side, clamped. */
  if (!hasHeight) {
    const aboveClear = fpTop - CARD_GAP - VIEW_MARGIN
    const belowClear = bottomLimit - belowTop
    if (aboveClear >= belowClear) {
      const edge = Math.min(Math.max(aboveBottomEdge, VIEW_MARGIN), bottomLimit)
      return { left, bottom: viewportH - edge }
    }
    return { left, top: Math.min(Math.max(belowTop, VIEW_MARGIN), bottomLimit) }
  }
  const clampTop = (top: number) => Math.min(Math.max(top, VIEW_MARGIN), Math.max(VIEW_MARGIN, bottomLimit - cardHeight))
  const overlapHeight = (a: RectLike, b: RectLike) =>
    Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top))
  const fpRect: RectLike = { top: fpTop, left: footprint.left, width: footprint.width, height: footprint.height }
  const candidates = [
    { seat: { left, bottom: viewportH - (clampTop(aboveTop) + cardHeight) } as CardSeat, rect: { ...aboveRect, top: clampTop(aboveTop) } },
    { seat: { left, top: clampTop(belowTop) } as CardSeat, rect: { ...belowRect, top: clampTop(belowTop) } },
  ]
  const score = (rect: RectLike) => ({
    coversAnchor: intersects(rect, focus) ? 1 : 0,
    coversFootprint: overlapHeight(rect, fpRect),
  })
  const [a, b] = candidates.map((c) => ({ ...c, s: score(c.rect) }))
  const pick =
    a.s.coversAnchor !== b.s.coversAnchor
      ? a.s.coversAnchor < b.s.coversAnchor
        ? a
        : b
      : a.s.coversFootprint <= b.s.coversFootprint
        ? a // a tie keeps the encoded preference: above the footprint
        : b
  return pick.seat
}
