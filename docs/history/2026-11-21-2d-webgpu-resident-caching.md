# 2D WebGPU GPU-resident caching and spatial viewport culling

Issue: [#4](https://github.com/de-novo/canvas/issues/4).

## Summary

Updated `packages/web/src/2d/webgpu.ts` so 2D WebGPU keeps its packed vertex
buffer, atlas texture, and `GPUBindGroup` resident on the GPU across pure
pan/zoom frames (updating only the 32-byte view uniform buffer), caches parsed
background clear color, and culls large scenes (>512 entries) to a padded
viewport window through `Canvas2DSpatialIndex`.

Invalidation stays exact: scene, sceneGraph, selection, hover, transform
preview, content colors, authoring previews, connection handles, transform
handles, animated `plugin.denovo.shade` nodes, and host plugin drawer registry
changes (`getPluginNodeDrawerRegistryVersion()` in
`packages/web/src/plugin-drawers.ts`) trigger a fresh pack immediately.

No public API types or document schemas changed.

## Before / After (`pnpm verify:2d-performance`, `10k-2d-webgpu`, Chromium 1280×800)

| Metric | Before | After |
| --- | --- | --- |
| `panRender` p50 | 6.90 ms | 0.00 ms |
| `panRender` p95 | 14.40 ms | 0.10 ms |
| `triangles` | 20,002 | 210 |
| `drawCalls` | 1 | 1 |
| `hitTest` (200 calls) | 0.5 ms | 0.6 ms |
| `nonBlank` / z-order / marquee | pass | pass |

Report stored at `artifacts/verification/performance-2d-report.json`.

## Verification

- `pnpm typecheck`: passed (25 packages)
- `pnpm build`: passed (25/25)
- `pnpm verify:2d-performance`: passed (4/4 workloads including `10k-2d-webgpu`
  pan < 4 ms and culled triangles < 2,000 gates)
- `pnpm verify:webgpu`: passed (11/11, desktop & mobile `drawn`)
- `pnpm verify:hit-testing`: passed (7/7)
- `pnpm verify:public-api`: passed
- `pnpm verify:docs`: passed

## Unmeasured Scope

- Linux, Windows, and physical mobile device 2D WebGPU pan timings remain
  unmeasured.
