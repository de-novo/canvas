# 2D minimap cache, HTML overlay diffing, and fast 3D node equality

Issue: [#7](https://github.com/de-novo/canvas/issues/7).

## Summary

1. **O(1) 2D minimap offscreen cache (`packages/web/src/2d.ts`)**: cached the
   static minimap node layer on an offscreen canvas keyed by
   `(scene, foreground color, contentBounds)` using cached bounds from
   `Canvas2DSpatialIndex`. Pan/zoom frames inside the cached content bounds now
   blit `drawImage` and stroke the viewport frame without iterating scene nodes.
2. **2D HTML overlay diffing (`packages/web/src/2d.ts`)**: tracked previous
   `html` nodes in `prevHtmlNodesById` inside `rebuildObjects()` and skipped
   re-invoking `renderNode()` when an existing overlay element's node fields
   (including `metadata`) are unchanged.
3. **Allocation-free 3D node equality (`packages/web/src/3d.ts`)**: replaced
   `JSON.stringify(a) === JSON.stringify(b)` in `canvas3DNodeEqual()` with
   direct field-by-field structural comparison across all 3D node types.

No public API types or document schemas changed.

## Verification

- `pnpm verify:2d-performance`: passed (4/4 workloads; `10k-2d-rects` with
  `minimap` enabled held `panRender` p50 `0.00 ms` / p95 `0.10 ms`;
  `1k-2d-overlays` single-card edit invoked `renderNode` **1 time** across
  1,001 cards; 20-event wheel burst coalesced to 1 render)
- `pnpm verify:browser-rendering`: passed (`ok: true`, desktop & mobile 2D/3D
  authoring, updates, transforms, surface stacking, replacement, demand loop)
- `pnpm verify:webgpu`: passed (11/11)
- `pnpm verify:flow-showcase`: passed (2/2)
- `pnpm verify:network-showcase`: passed (2/2)
- `pnpm verify:diagram-rendering`: passed (desktop & mobile)
- `pnpm verify:hit-testing`: passed (7/7)
- `pnpm typecheck`: passed (25 packages)
- `pnpm build`: passed (25/25)
- `pnpm verify:docs`: passed

## Unmeasured Scope

- Dedicated 10k-node 3D single-node `update()` microbenchmark timing and
  Linux/Windows/physical mobile measurements remain unmeasured beyond the full
  3D authoring `verify:browser-rendering` gate.
