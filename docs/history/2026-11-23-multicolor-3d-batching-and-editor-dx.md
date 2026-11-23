# Multi-color single-drawCall 3D InstancedMesh (instanceColor) and one-line editor mounting DX

Issue: [#19](https://github.com/de-novo/canvas/issues/19).

## Summary

- Upgraded 3D `render.batch: true` in `packages/web/src/3d.ts` from
  one-`InstancedMesh`-per-color to a single multi-color `InstancedMesh` per
  primitive (`denovo-batch:box`, `denovo-batch-sphere:sphere`) using Three.js
  `instanceColor` (`setColorAt`) with a shared `#ffffff` `MeshStandardMaterial`.
  Color flips (e.g., warehouse pallet status changes) and transform moves (e.g.,
  moving AGVs) now update GPU buffers in place without rebuilding the batch.
- Added one-line `editor` mounting DX:
  - `createCanvas("#stage", { editor })` in `@denovo/canvas/2d` and `@denovo/canvas`
    automatically loads the editor's document, defaults `editable: true`, connects
    on `ready`, and disconnects cleanly on `destroy()`.
  - `<Canvas2DView editor={editor} />` in `@denovo/react-canvas/2d` /
    `@denovo/canvas/react/2d` removes manual `useRef` / `ready.then` /
    `disconnect()` boilerplate.
- Added a 5,020-object multi-color Warehouse Digital Twin workload (20 aisles ×
  5 tiers × 50 stacked pallets + 20 moving AGVs across 6 distinct colors) to
  `scripts/bench-compare.mjs` (`pnpm bench:compare`) and consumer fixtures to
  `scripts/verify-public-api.mjs`.

## Verification

- `pnpm build`, `pnpm typecheck`
- `pnpm bench:compare` (including 5,020-object multi-color 3D warehouse)
- `pnpm verify:public-api`, `pnpm verify:performance`, `pnpm verify:2d-performance`
- `pnpm verify:browser-rendering`, `pnpm verify:pack-smoke`, `pnpm verify:docs`
- `git diff --check`
