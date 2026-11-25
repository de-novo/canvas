# 2026-09-06 Region/mask document and host-drawer pixels

## Date

2026-09-06

## Scope

Prove the first region/mask slice with built-in `rect` / `circle` plus
host `metadata.role`, and sample a host kind drawer in the browser
without adding `@de-novo/canvas-web` to the vanilla package.

## Changes

- Vanilla `region-mask-bench.html`: image stand-in + two mask nodes.
  `listNodes` omits metadata; `setNodeVisible` hides the rect mask.
- `pnpm verify:region-mask`.
- Facade subpath `@de-novo/canvas/web` re-exports
  `registerPluginNodeDrawer`. Default import still does not.
- Vanilla `host-drawer-webgpu-bench.html` registers a host kind through
  that subpath. WebGPU asserts hit + triangles; Canvas2D samples
  non-marker pixels.

## Verification

Recorded in [Project Status](../project-status.md) Evidence for this
date.

## Residual risk

- 2D WebGPU canvas contents did not appear in Playwright screenshots
  or `drawImage` readback. Color is proven on Canvas2D; WebGPU proves
  hit-test and draw stats.
- Polygon regions are still not a kind.

## Next action

Polygon `plugin.<org>.region` only if a consuming product shows
`rect` / `circle` is not enough. Do not wrap ThreeUI or Canvas UI.
A pinned 16 ms frame-budget gate still needs a measurement environment.
