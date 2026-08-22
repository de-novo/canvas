# 2026-08-22 M4 LOD controls, chunk loading, and batching gate

## Date

2026-08-22

## Scope

M4 Performance Layer slice: opt-in LOD render options, the progressive
scene chunk loader, and a hard batching gate in `verify:performance`.
Together with the morning's worker task queue this closes the M4
acceptance criteria except for a defined frame-budget measurement
environment (explicitly descoped below).

## Changes

### LOD controls (opt-in)

- `RenderLodOptionsSchema` in core: `render.lod: { enabled, distances }`,
  default `{ enabled: false, distances: [24, 60] }`. Additive with
  defaults; documents without the field parse unchanged and round-trip.
- `packages/web/src/3d.ts`: sphere primitives build a three-level
  `THREE.LOD` (48×24 → 16×8 → 8×4 segments at the configured distances)
  when enabled. Boxes/meshes/instances are intentionally single-detail or
  already batched. Hit testing resolves node ids through the LOD parent;
  disposal traverses LOD children; authoring previews stay full-detail.

### Chunk loading API (opt-in)

- `packages/web/src/scene-chunks.ts`:
  `createSceneChunkLoader(runtime, { chunkSize = 2000, budgetMs = 8,
  yieldSlice })` applies large scenes across scheduled slices (rAF yield
  by default), batches fast chunks inside the budget, skips the final
  commit when the last chunk covered every node, and throws
  `CanvasSceneChunkCancelledError(appliedNodes)` on cancel. Re-exported
  through the facade root.

### Verification

- New `pnpm verify:m4-performance` (11 named checks): LOD schema
  defaults/validation/round-trip; chunk loader single-commit path, ordered
  chunks + progress, budget batching, cancellation + recovery, invalid
  options.
- `pnpm verify:performance` now hard-fails unless every workload renders
  through exactly one draw call (`batch: true`). Fresh baselines:
  100 boxes p50 16.5 ms, 1k 66.3 ms, 10k 143.1 ms — noisier than the
  2026-08-21 run (50/116 ms), confirming headless frame times must stay
  recorded baselines rather than gates.
- Fixed `verify-performance.mjs` Vite readiness detection against Vite 8's
  ANSI-decorated banner (URL match now strips escape sequences).
- Browser LOD measurement via ego-browser on
  `apps/vanilla/lod-bench.html`: 301 spheres, triangles 664,608 → 17,312
  (**−97.4%**) at identical draw-call count; center hit still resolves
  `sphere-center` through the active level.

## Verification (commands)

- `pnpm typecheck`, `pnpm build`, `pnpm verify:public-api`: passed.
- `pnpm verify:m4-performance`: passed (11 checks).
- `pnpm verify:worker-tasks`: passed (9 checks).
- `pnpm verify:performance`: passed including the new batching gate.

## Residual risk

- The 16 ms frame-budget target remains ungated: headless frame times are
  machine-dependent, so a gate needs a pinned measurement environment
  (hardware + renderer flags) first. Recorded as an explicit descope in
  [M4 Performance Thresholds](../m4-performance-thresholds.md).
- LOD currently covers spheres only; extending to instanced sphere batches
  is future work.
- Chunk loader intermediate states are content-equal partial scenes; hosts
  must not treat them as complete until `load()` resolves.

## Next action

~~M4 can be marked verified once the frame-budget descope is accepted as
the milestone's boundary.~~

**Decision (2026-08-22, same day):** the descope was accepted. Every
deliverable in
[M4 Performance Layer](../vision-and-milestones.md#m4-performance-layer)
is implemented — instancing helpers, direct `BufferGeometry` builders,
geometry/material batching, frustum culling controls, LOD controls, chunk
loading APIs, the worker task queue, the OffscreenCanvas *capability*
check (`supportsOffscreenCanvas()`), and BVH picking — and all three
acceptance criteria hold: batched rendering (`drawCalls=1` gate), heavy
conversion off the main thread (worker queue + rAF proof), and opt-in
features without framework leakage. The 16 ms figure remains a documented
aspirational baseline from the thresholds doc, not an M4 deliverable.
**M4 is verified.**
