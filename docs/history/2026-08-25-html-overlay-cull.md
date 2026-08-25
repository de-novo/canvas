# 2026-08-25 HTML overlay culls by bounds

## Date

2026-08-25

## Scope

Zooming or panning a 2D `html` catalog hid cards while their canvas
edges stayed. Lines then pointed at empty space. Isolated to overlay
culling and orthogonal port stubs.

## Changes

- Overlay culling intersects the node's world bounds with the visible
  rect instead of testing the transform origin. `html` origin is
  top-left, so a point test hid cards whose body was still on screen.
- Orthogonal facing stubs clamp to half the port gap so a 24-unit stub
  cannot overshoot a 36-unit stack gap.
- [M8 Diagram Contract](../m8-diagram-contract.md) records both rules.

## Verification

- `pnpm --filter @denovo/canvas-web build`: passed
- `pnpm verify:hit-testing`: ok, including stacked orthogonal stubs
  staying inside a 36-unit gap
- `pnpm verify:network-showcase`: 2/2, including an API card whose
  origin is off-screen but whose body still intersects the view
- `pnpm verify:docs`: 134 Markdown files, 444/444 local targets

## Residual risk

Cards that sit entirely outside the padded visible rect still hide.
That is intentional virtualization. Very short facing gaps produce
short or zero stubs.

## Next action

Keep overlay culling on bounds. Do not restore origin-point tests for
`html`.
