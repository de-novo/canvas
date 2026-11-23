# Incremental validation cache, O(k) 2D/3D runtime updates, and 10k/100k comparative benchmarks

Issue: [#18](https://github.com/de-novo/canvas/issues/18).

## Summary

- Eliminated redundant O(N) Zod re-validation in `@denovo/canvas-core`
  (`defineScene`, `defineDocument`) using `WeakSet` tracking of deeply frozen
  validated scenes/documents/nodes with incremental per-node validation (only
  parsing newly created/modified nodes while preserving 100% identical
  cross-node invariant checks and `ZodError` fallback), and removed duplicate
  `defineScene` / `CanvasSceneSchema.parse` calls across `@denovo/canvas-editor`,
  `@denovo/canvas-web` (`2d.ts`, `3d.ts`), and `@denovo/canvas`.
- Eliminated O(N) `Object.values()` array copy inside `freezeValue`
  (`packages/editor/src/utils.ts`) and cached per-scene node lookup maps via
  `WeakMap` inside `resolveEffectiveNodeState` (`packages/editor/src/node-state.ts`).
- Made 2D `rebuildObjects` incremental (`rebuildObjectsIncremental` driven by
  `spatialIndex.getLastChangedNodeIds()`) and skipped redundant `runtime.resize()`
  reflows on `update()` in `packages/web/src/2d.ts`.
- Added in-place `InstancedMesh` batch reuse and incremental `setMatrixAt`
  updates in `packages/web/src/3d.ts` so single-node 3D transforms update only
  changed instances instead of reallocating 10k-instance GPU buffers.
- Added reproducible comparative benchmark script `scripts/bench-compare.mjs`
  (`pnpm bench:compare`) measuring Naive vs Denovo across 10k & 100k 2D and
  1k & 10k 3D workloads.

## Measured Results (Before -> After)

- 2D 10k `defineScene(frozenScene)`: `30.9 ms` -> `0.002 ms`
- 2D 100k `defineScene(frozenScene)`: `218.7 ms` -> `0.001 ms`
- 2D 10k `editor.apply([setNodeVisible])`: `79.3 ms` -> `4.05 ms` p50 (`19.6x`)
- 2D 100k `editor.apply([setNodeVisible])`: `630.4 ms` -> `81.3 ms` p50 (`7.8x`)
- 2D 10k single-node `runtime.update()` in Chromium: `51.8 ms` -> `5.6–7.9 ms` p50 (`6.5–9.2x`, 60fps+)
- 2D 100k Naive vs Denovo in Chromium: pan `6.5 ms` (`100,000` drawCalls) vs `0.00 ms` (`28` drawCalls); 200 hit-tests `51.8 ms` vs `0.30 ms` (`172x`); smart snap `0.00 ms` (`34/100,000` candidates)
- 3D 10k batched boxes (`render.batch: true`, Metal WebGL2): `drawCalls=1`, `geometries=1`, `editor.apply` `4.18 ms`, single-node `runtime.update()` `15.0 ms` p50

## Verification

- `pnpm build`, `pnpm typecheck`
- `pnpm verify:document-schema`, `pnpm verify:editor-core`, `pnpm verify:public-api`
- `pnpm verify:2d-performance`, `pnpm verify:hit-testing`, `pnpm verify:selectors`
- `pnpm verify:browser-rendering`, `pnpm verify:pack-smoke`, `pnpm verify:pages`, `pnpm verify:docs`
- `pnpm bench:compare`
- `git diff --check`
