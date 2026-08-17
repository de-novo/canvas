# ego-browser QA: html overlay world transform

**Date:** 2026-08-17
**Status:** landed

## Context

Interactive QA of the diagram playground in ego-browser showed `html`
cards stuck at the top-left of the stage. Playwright smoke still passed
because it only checked that a `.denovo-card` existed, not where it sat.

## Changes

- `resolveCanvas2DNodeWorldTransform` now includes `html` with `text`
  (position/rotation/scale). Edges that target an `html` node attach to
  the card, not the origin.
- Host-returned overlay elements get `position: absolute; left: 0; top: 0`
  so `translate(...)` is measured from the overlay origin.
- Agent rules: browser-facing work SHOULD also be exercised in
  ego-browser.

## Verification

- `pnpm verify:hit-testing` — html world center is `[200, 260]`
- ego-browser on `http://127.0.0.1:5180/`: card transform
  `translate(200px, 260px)`, text probe `translate(40px, 340px)`,
  Fit/Fly move the overlay with the camera, Align top reports a status.

## Residual risk

Playground card CSS still collapses "HTML Card" and "node-b" onto one
line. That is example styling, not the runtime transform.

## Next action

Use ego-browser on future visual changes. Persistence remains the next
product slice.
