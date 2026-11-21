# 2D spatial index, viewport culling, and O(1) overlay sync

Issue: [#2](https://github.com/de-novo/canvas/issues/2).

## Summary

Added a pure uniform-grid 2D spatial index (`Canvas2DSpatialIndex` in
`packages/web/src/2d/spatial-index.ts`) with cached conservative world bounds,
map-backed layer and incident-edge lookups on `Canvas2DSceneGraph`, viewport
frustum culling in `renderCanvas2DScene()`, spatial-indexed `hitTestSceneGraph()`
and `getNodesInBounds()`, O(1) node lookups across `packages/web/src/2d.ts`,
O(visible) HTML overlay virtualization in `syncOverlayElements()`, and Canvas2D
`drawCalls` reporting via `runtime.getRenderStats()`.

No public API types or document schemas changed.

## Before / After (`pnpm verify:2d-performance`, Chromium 1280×800)

| Workload | Metric | Before | After |
| --- | --- | --- | --- |
| `1k-2d-rects` | `panRender` p50 / p95 | 0.40 ms / 0.60 ms | 0.00 ms / 0.10 ms |
| `1k-2d-rects` | `hitTest` (200 calls) | 13.0 ms (0.100 ms p50) | 0.6 ms (0.000 ms p50) |
| `1k-2d-rects` | `marquee` p50 | 0.200 ms | 0.000 ms |
| `1k-2d-rects` | `drawCalls` | 1,001 (unreported) | 28 |
| `10k-2d-rects` | `panRender` p50 / p95 | 3.70 ms / 6.30 ms | 0.00 ms / 0.10 ms |
| `10k-2d-rects` | `hitTest` (200 calls) | 118.5 ms (0.600 ms p50) | 0.5 ms (0.000 ms p50) |
| `10k-2d-rects` | `marquee` p50 | 3.300 ms | 0.000 ms |
| `10k-2d-rects` | `drawCalls` | 10,001 (unreported) | 28 |
| `1k-2d-overlays` | `panRender` p50 / p95 | 0.80 ms / 1.00 ms | 0.10 ms / 0.20 ms |
| `1k-2d-overlays` | `hitTest` (200 calls) | 20.1 ms (0.100 ms p50) | 1.7 ms (0.000 ms p50) |

All three workloads also passed topmost z-order hit parity, empty hit checks,
exact marquee ID set parity, and non-blank canvas checks. Report stored at
`artifacts/verification/performance-2d-report.json`.

## Verification

- `pnpm verify:2d-performance`: passed (3/3 workloads, culling + spatial-index + parity gates)
- `pnpm typecheck`: passed (25 packages)
- `pnpm build`: passed (25/25)
- `pnpm verify:public-api`: passed
- `pnpm verify:hit-testing`: passed (7/7)
- `pnpm verify:editor-core`: passed
- `pnpm verify:diagram-rendering`: passed (desktop + mobile)
- `pnpm verify:flow-showcase`: passed (2/2)
- `pnpm verify:network-showcase`: passed (2/2)
- `pnpm verify:region-mask`: passed (6/6)
- `pnpm verify:webgpu`: passed (11/11)
- `pnpm verify:docs`: passed

## Unmeasured / Residual Notes

- `pnpm verify:browser-rendering` passed the 2D authoring suite on this run but
  hit a pre-existing 3D Three.js WebGL context warning (`WebGL: INVALID_OPERATION:
  delete: object does not belong to this context`) during 3D authoring
  replacement; 3D code was untouched in this change.
- 2D WebGPU (`packages/web/src/2d/webgpu.ts`) does not yet consume
  `Canvas2DSpatialIndex` for GPU vertex culling.
- Linux, Windows, and physical mobile device 2D frame timings remain unmeasured.
