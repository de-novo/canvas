# Trackpad wheel classification and module boundary

**Date:** 2026-08-17
**Status:** landed

## Context

2D navigation treated any `deltaX !== 0` as pan and only zoomed when
`deltaX === 0`. Trackpad two-finger scrolls, tiny horizontal noise, and
Mac pinch (`ctrl+wheel`, often with `deltaX`) therefore swapped pan and
zoom from one tick to the next.

## Changes

- New `packages/web/src/2d/wheel-navigation.ts` owns classification,
  delta normalisation, burst locking, and the view update. `2d.ts` only
  asks for an intent and applies the result.
- Intent order: ctrl/meta → zoom (pinch); shift → pan; line/page mouse
  wheel → zoom; pixel stream with X or small Y → pan; large discrete Y
  → zoom.
- `Canvas2DWheelGesture` holds the first intent of a burst for 120 ms so
  a flick does not flip mid-stream. Pinch still breaks the lock.

## Verification

`pnpm verify:hit-testing` includes pinch-vs-pan, mouse notch vs trackpad
tick, burst lock, and capability-off `consumed: false`.

## Residual risk

Pixel-mode mouse wheels that emit small `deltaY` will pan until a notch
exceeds 50 px. Fast trackpad flicks that start above 50 px zoom unless a
prior tick locked pan. Physical feel should be checked on a real
trackpad.

## Next action

Keep 3D on Three `OrbitControls` until a similar classifier is worth
sharing. Persistence remains the next product slice.
