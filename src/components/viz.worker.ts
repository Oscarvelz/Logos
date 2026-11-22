/// <reference lib="webworker" />
// Retired in 1.4.230 — do not revive. This worker drew the Listen
// visualizer through an OffscreenCanvas handed over by
// Visualizer.tsx. The transfer is a one-way door: a transferred
// canvas whose worker has not painted, or whose surface the system
// discarded, shows the compositor's white backing — the white seat
// Oscar photographed at 1.4.196's first open and again at 1.4.229.
// The visualizer draws on the page's own thread now; a plain canvas
// unpainted is transparent over the dark card, never a white hole.
// This file remains only as the tombstone of that road.
export {}
