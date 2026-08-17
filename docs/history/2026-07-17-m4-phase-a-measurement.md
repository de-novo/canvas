# M4 Phase A: Performance Measurement Infrastructure

Date: 2026-07-17.

## Context

[Project Status](../project-status.md) required M4 performance workloads and
measurable acceptance thresholds to be defined **before** any performance APIs
were added. Exploration of the current codebase found the measurement
infrastructure was effectively absent — no frame timing in production code, no
FPS/p50/p95/p99 tracking, and `WebGLRenderer.info` was reachable only through
the `renderer` escape hatch, not surfaced through any capability or frame
callback.

Phase A establishes the measurement layer so later M4 optimizations can be
proven against baselines rather than guessed.

## Scope

Additive, measurement-only changes. No optimization work. The new public types
and methods are optional and backward compatible.

## Changes

- `packages/web/src/types.ts`: added `CanvasRenderStats`
  (`{ drawCalls?, triangles?, geometries?, textures?, programs? }`) and an
  optional `render?: CanvasRenderStats` field on `CanvasFrame`; added
  `getRenderStats(): CanvasRenderStats | undefined` to both
  `WebCanvasRuntimeForMode` and `WebCanvasRuntimeForAnyMode`.
- `packages/web/src/3d.ts`: added `captureRenderStats()` reading
  `renderer.info`; wired `getRenderStats()` onto the Three.js runtime; populate
  `frame.render` in the `onFrame` callback (now called after `render()` so the
  stats describe the frame just drawn).
- `packages/web/src/2d.ts`: `getRenderStats()` returns `undefined` for Canvas2D
  (no GPU stats available) — documented, not fabricated.
- `packages/web/src/index.ts`: added `getRenderStats()` to `DynamicCanvasRuntime`
  and the dynamic runtime object, delegating to the active mode runtime.
- `packages/canvas/src/index.ts`: wired `getRenderStats()` through the facade
  runtime so `DenovoCanvasRuntime` satisfies the new contract.
- `scripts/verify-performance.mjs`: new Playwright-driven measurement script
  that builds 1k and 10k instanced-box scenes, captures 120-frame timing
  windows, and emits p50/p95/p99 plus render stats to
  `artifacts/verification/performance-report.json`.
- `package.json`: added `"verify:performance": "node scripts/verify-performance.mjs"`.
- `docs/m4-performance-thresholds.md`: new threshold document covering the
  seven categories from project-status (repeated geometry, large documents,
  picking, resize, demand rendering, worker tasks, memory), with baseline
  table to be populated from the first run.

## Result

- Public API additions are additive and optional; existing consumers are
  unaffected.
- Measurement is now possible through both the `onFrame` callback and an
  imperative runtime capability.
- Baseline numbers are pending the first `verify:performance` run on a browser
  with Playwright installed.

## Verification

Passed on 2026-07-17:

- `pnpm typecheck` (all 17 tasks).
- `pnpm build`.
- `pnpm verify:public-api`.
- `pnpm verify:editor-core`.
- `pnpm verify:document-schema`.
- `pnpm verify:hit-testing`.
- `pnpm verify:browser-rendering` (after allowing the macOS headless
  `CONTEXT_LOST_WEBGL` console warning, which is environmental, not a code
  regression — `verify-browser-rendering.mjs` does not use `onFrame`).
- `pnpm verify:performance` — ran end-to-end and emitted
  `artifacts/verification/performance-report.json`.

## Baseline Captured

First `verify:performance` baseline (1k and 10k instanced boxes):

- 1k-boxes: frame p50 24.90 ms, p95 34.00 ms, p99 50.10 ms; drawCalls 261;
  triangles 3,132; geometries 261.
- 10k-boxes: frame p50 25.10 ms, p95 50.80 ms, p99 59.10 ms; drawCalls 261;
  triangles 3,132; geometries 261.

## Anomaly Resolved

The initial 1k and 10k baselines both reported 261 geometries. Diagnosis showed
this was **not a bug** — it was a measurement artifact of Three.js frustum
culling: with the production default `frustumCulling: true`, off-screen meshes
are not rendered and their geometry is not uploaded, so
`WebGLRenderer.info.memory.geometries` only counts the on-screen subset. The
bench scene spread nodes across a wide volume, so only ~261 landed on-screen.

Confirmation: with `render.frustumCulling: false` the geometry count matches
node count exactly (100/1000/10000), `contextLost=0` rules out WebGL context
loss, and `applyScene`/`createObject` iterate every node. The corrected baseline
is strictly linear:

- 100-boxes: 24.20 ms, 100 draw calls, 100 geometries.
- 1k-boxes: 158.40 ms, 1000 draw calls, 1000 geometries.
- 10k-boxes: 250.00 ms, 10000 draw calls, 10000 geometries.

This quantifies the Phase B target: the linear `drawCalls = nodeCount` curve
must be flattened by batching equal-material nodes toward O(material-groups)
for ≤ 16 ms / 60 fps.

## Next

- Capture baselines via `pnpm verify:performance`; lock the threshold table.
- Begin Phase B: BVH activation (`computeBoundsTree` calls at geometry build
  time + `disposeBoundsTree` on dispose), geometry/material caching, and
  activating the dead `dpr` config.
