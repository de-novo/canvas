# 2026-08-25 HTML overlay follows zoom

## Date

2026-08-25

## Scope

2D `html` overlays were positioned on camera move but kept the size from
the last `renderNode` call. Zoom made cards drift from edges and look
soft. Isolated to the Canvas2D overlay sync.

## Changes

- `syncOverlayElements` now writes CSS `width` / `height` as world size
  × zoom, snaps translation to device pixels, and sets `--dc-html-zoom`.
- `html` hit-testing uses the same world bounds as the overlay
  (top-left + size), not a centered box.
- Orthogonal edges use round joins and caps.
- Catalog cards read `--dc-html-zoom` instead of snapshotting zoom at
  mount.

## Verification

- `pnpm --filter @de-novo/canvas-web build`: passed
- `pnpm verify:hit-testing`: ok, including html bounds
  `[200, 260] → [320, 308]`
- `pnpm verify:network-showcase`: 2/2, including overlay width at
  current zoom and after `setViewState({ zoom: 2 })` → `400×192`

## Residual risk

Very large zooms still enlarge CSS chrome (borders, radii). That is
layout, not a bitmap stretch. Canvas strokes remain world-width × zoom.

## Next action

Keep catalog hosts off mount-time zoom math. Do not put a CSS grid on
the stage that ignores the camera.
