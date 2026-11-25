# M4 Performance Thresholds

Last reviewed: 2026-09-07.

This document defines the measurable workloads and acceptance thresholds M4
optimizations must hold against. It exists because
[Project Status](./project-status.md) requires thresholds to be defined before
performance APIs are added.

Thresholds are captured against the **WebGL2 baseline** (Three.js
`WebGLRenderer`). Explicit WebGPU is a later measurement surface; per
[Rendering Backend Strategy](./rendering-backend-strategy.md), useful
performance features must stay available on WebGL2 where possible.

## Measurement Infrastructure

Baselines are produced by:

- `pnpm verify:performance` (`scripts/verify-performance.mjs`) — Playwright-driven,
  builds 100 / 1k / 10k box scenes through the vanilla facade, and captures
  frame timing plus render stats.
- The `onFrame(frame, runtime)` callback now carries `frame.render`
  (`CanvasRenderStats`): `{ drawCalls, triangles, geometries, textures,
  programs, computeDispatches, computeResidentCopies }`.
  `computeDispatches` is present when official WebGPU field-streak
  compute ran. `computeResidentCopies` is present when that compute
  copied into a Three vertex buffer without CPU readback.
- `runtime.getRenderStats()` exposes the same stats on demand for tooling.
- Report output: `artifacts/verification/performance-report.json`.

Frame-time samples are summarized as p50 over a 30-frame capture window in
`always` loop mode. The benchmark scene uses `render.frustumCulling: false` so
that every node's geometry is uploaded and counted (see Anomaly Resolution
below); production default keeps frustum culling on.

## Baseline Values

Captured 2026-07-17 via `pnpm verify:performance` (Playwright headless Chromium,
macOS, WebGL2/Three.js, `frustumCulling: false`). These are the pre-optimization
numbers; Phase B changes must not regress them and should improve the targeted
ones.

| Workload | frame p50 (ms) | drawCalls | triangles | geometries |
| --- | --- | --- | --- | --- |
| 100-boxes | 24.20 | 100 | 1,200 | 100 |
| 1k-boxes | 158.40 | 1,000 | 12,000 | 1,000 |
| 10k-boxes | 250.00 | 10,000 | 120,000 | 10,000 |

The relationship is strictly linear: one draw call, 12 triangles, and one
geometry per box node. Frame time grows super-linearly with node count, which
quantifies the Phase B draw-call batching target.

## Anomaly Resolution

The earlier "261-geometry saturation" was diagnosed and is **not a bug**. With
the production default `frustumCulling: true`, Three.js skips rendering of
off-screen meshes, and `WebGLRenderer.info.memory.geometries` only counts
geometries that have been uploaded to the GPU. The bench scene spread nodes
across a wide volume, so only the on-screen subset (~261) was counted.

With `frustumCulling: false` the count matches node count exactly (100/1000/10000),
`contextLost=0` rules out WebGL context loss, and `applyScene`/`createObject`
do iterate every node. The measurement infrastructure was correct; the anomaly
was a measurement-methodology artifact now controlled by the `frustumCulling`
flag in the bench scene.

## Phase B Targets

The linear `drawCalls = nodeCount` relationship is the primary optimization
target. Concretely, batching equal-material nodes into a single draw call
should move the curve from O(nodes) toward O(material-groups):

- **1k-boxes**: baseline 158 ms / 1000 draw calls → target ≤ 16 ms (60 fps)
  with draw calls in the tens.
- **10k-boxes**: baseline 250 ms / 10000 draw calls → target ≤ 16 ms with
  draw calls in the tens.

Subsequent Phase B work (BVH activation, geometry/material caching) is gated on
not regressing these frame times for the same node counts.

## Phase B Progress

### Geometry/material caching (done)

`packages/web/src/3d.ts` now caches the unit `BoxGeometry(1,1,1)` and shares
one `MeshStandardMaterial` per color. Cached resources are tracked in a
`WeakSet` and skipped by `disposeGroup`, so they survive scene rebuilds.
Draw calls are unchanged (still one per node), but GPU upload and allocation
churn drop sharply — `geometries` stat is now 1 regardless of node count.

Re-measured 2026-07-17 with `frustumCulling: false`:

| Workload | baseline p50 (ms) | cached p50 (ms) | improvement | geometries |
| --- | --- | --- | --- | --- |
| 100-boxes | 24.20 | 15.80 | 35% | 100 → 1 |
| 1k-boxes | 158.40 | 83.30 | 47% | 1000 → 1 |
| 10k-boxes | 250.00 | 151.00 | 40% | 10000 → 1 |

### Next: draw-call batching

Frame time is still dominated by per-node draw calls. The next step is to
collapse same-material box/sphere nodes into `InstancedMesh`/`BatchedMesh`
batches so draw calls move toward O(material-groups).

### BVH activation (done)

`installMeshBvhRaycast()` was already wiring the three-mesh-bvh prototype, but
no geometry ever called `computeBoundsTree()`, so picking ran brute-force. Phase
B adds `prepareGeometryBounds()` in `packages/web/src/3d.ts` which calls
`computeBoundsTree()` (optional-chained, since the method is installed at
runtime) on the cached unit box and on each sphere geometry. Simple primitives
gain little, but this is the foundation for fast picking on complex geometry and
correctness is unchanged — `verify:hit-testing` and `verify:browser-rendering`
both pass.

### Diff-based applyScene (done)

`applyScene` previously rebuilt every `Object3D` on each scene update and
disposed the entire previous content. Phase B adds value-based node diffing: a
closure-level `prevNodesById` map and `canvas3DNodeEqual` let `applyScene` reuse
the existing `Object3D` when a node's value is unchanged across an update, only
creating/disposing objects for added, removed, or changed nodes. Three.js
`add()` reparents reused objects out of the old content `Group`, so the
existing `disposeGroup(content)` now only destroys genuinely removed nodes.
`verify:editor-core`, `verify:hit-testing`, and `verify:document-schema` stay
green. (The static-render `verify:performance` baseline does not exercise
`update()`, so the win shows up in update-heavy editor workflows rather than in
that benchmark.)

### Draw-call batching (done, opt-in)

`render.batch: true` (default `false`, schema in `RenderOptionsSchema`) makes
`applyScene` collapse same-color **top-level** (`parentId === null`) box nodes
into one `InstancedMesh` per color. Per-instance node ids are stored under
`userData[INSTANCE_NODE_IDS_USER_DATA_KEY]`, and `createThreeHitTester` now
resolves `intersection.instanceId` back to the originating node, so picking,
selection, and authoring keep working on batched scenes. Nested boxes and other
node types still take the per-object path, preserving hierarchy and per-node
transforms.

Re-measured 2026-07-17 with `frustumCulling: false`, `batch: true`:

| Workload | cached-only p50 | batched p50 | drawCalls | geometries |
| --- | --- | --- | --- | --- |
| 100-boxes | 15.80 ms | 8.60 ms | 1 | 1 |
| 1k-boxes | 83.30 ms | 48.60 ms | 1 | 1 |
| 10k-boxes | 151.00 ms | 91.70 ms | 1 | 1 |

Draw calls collapsed from O(nodes) to O(material-groups). End-to-end vs the
Phase A baseline: 1k 158 → 48.60 ms (−69%), 10k 250 → 91.70 ms (−63%). The
remaining frame time is now instance-matrix/CPU and headless-renderer overhead,
not draw-call count.

## Threshold Categories

Each later M4 optimization (BVH activation, geometry/material caching, diff-based
`applyScene`, batching, LOD, worker task queue) must not regress these and
should improve the ones it targets.

### Repeated Geometry

- **Workload**: 10k instanced `box` nodes (`verify-performance` 10k-boxes).
- **Metric**: frame p95; draw calls; geometry count.
- **Target**: draw calls scale sub-linearly with node count after batching
  (target: O(material-groups), not O(nodes)). Frame p95 ≤ baseline p95.

### Large Documents

- **Workload**: a scene with 10k nodes loaded via `runtime.update()`.
- **Metric**: time from `update()` call to first non-blank render; heap delta.
- **Target**: initial render under an absolute ceiling (TBD from baseline);
  no whole-scene dispose+recreate regression from diff-based `applyScene`.

### Picking

- **Workload**: 10k-box scene; 100 raycast hits via `hitTest()`.
- **Metric**: mean hit latency; p95 hit latency.
- **Target**: BVH-activated picking must not be slower than the brute-force
  baseline, and should be faster once `computeBoundsTree` is wired through.

### Resize

- **Workload**: 1k-box scene; 5 viewport transitions.
- **Metric**: dropped frames during transition; render count.
- **Target**: zero blank frames; demand loop stays bounded across resize.

### Demand Rendering

- **Workload**: static 3D scene in `demand` mode.
- **Metric**: `requestAnimationFrame` scheduling count after steady state;
  CPU usage when idle.
- **Target**: no continuous RAF scheduling when nothing invalidates; this is
  already verified by `verify:browser-rendering` and must stay green.

### Worker Tasks

- **Workload**: round-trip through `@de-novo/canvas-worker`'s
  `createWorkerClient` with representative payloads.
- **Metric**: request/response RTT p95 by payload size.
- **Target**: TBD once a real worker task (e.g. geometry/BVH build) is wired;
  until then, this category is documented but not gated.

#### Worker task queue (done, opt-in)

`createWorkerTaskQueue` pools workers behind a FIFO queue, and
`createDenovoWorkerHandler` installs the first-party
`denovo.geometry.convert` task (raw arrays → transferable typed arrays +
bounds). The facade re-exports both under `@de-novo/canvas/worker`, and
`supportsOffscreenCanvas()` is the OffscreenCanvas capability check.

Measured 2026-08-22 in Chromium via `apps/vanilla/worker-bench.html`
(ego-browser session, Vite dev server, pool size 2, transferred buffers,
30 samples per row). Main-thread column is `convertDenovoGeometry` alone;
RTT adds structured-clone/transfer plus cross-thread latency:

| Payload (floats) | main-thread p50 (ms) | worker RTT p50 (ms) | worker RTT p95 (ms) |
| --- | --- | --- | --- |
| 3k (12 KB) | 0.10 | 0.10 | 1.60 |
| 300k (1.2 MB) | 0.30 | 0.50 | 0.80 |
| 3M (12 MB) | 4.40 | 5.50 | 8.40 |

Non-blocking proof: while the worker converted a 12 MB payload,
`requestAnimationFrame` fired **0.4 ms** after issue; running the same
conversion on the main thread delayed rAF by **86.2 ms** (window includes
payload construction). Heavy conversion therefore stays off the main
thread as required by the M4 acceptance criteria.

Node-side semantics are covered by `pnpm verify:worker-tasks` (loopback
workers): FIFO ordering within pool size, one in-flight request per
worker, error recovery, dispose rejecting in-flight + buffered work, and
explicit unknown-task failures.

### LOD controls (done, opt-in)

`render.lod: { enabled, distances }` (default off, schema in
`RenderOptionsSchema`) wraps sphere primitives in a three-level
`THREE.LOD` (48×24 → 16×8 → 8×4 segments at the configured distances).
Boxes stay single-detail (shared 12-triangle unit cube), meshes keep
authored tessellation, and instances batch internally, so spheres are the
primitive where distance reduction pays. Hit testing resolves through the
LOD parent, and disposal traverses LOD children.

Measured 2026-08-22 in Chromium via `apps/vanilla/lod-bench.html`
(ego-browser session): 301 spheres spread across depth, camera at
distance ~30, frustum culling off:

| render.lod | triangles | drawCalls | center hit resolves |
| --- | --- | --- | --- |
| off | 664,608 | 301 | yes |
| on ([10, 20]) | 17,312 | 301 | yes |

Triangle count dropped **97.4%** at identical draw-call count; picking
still resolves the node id through the active LOD level.

### Chunk loading API (done, opt-in)

`createSceneChunkLoader(runtime, { chunkSize, budgetMs, yieldSlice })`
applies large scenes across scheduled slices (default 2k nodes per update,
8 ms soft budget per slice, rAF yields) so hosts can stream big documents
without freezing input. The final slice is skipped when the last chunk
already covered every node. Cancellation throws
`CanvasSceneChunkCancelledError` with the applied count; the next `load`
starts clean. Semantics are covered by `pnpm verify:m4-performance`
(Node-side, deterministic).

### Batching gate (done)

`pnpm verify:performance` launches Chromium with a hardware GPU (ANGLE
Metal on macOS) and explicit `backend: "webgl2"`. It hard-fails unless
every workload renders through exactly one draw call (`drawCalls=1`
with `batch: true`) and unless the 1k-boxes p50 is ≤ 16 ms on that GPU.
Software GL fails the run (`requireGpu`). A 0 ms ceiling is asserted
against the live 1k-boxes p50 so the budget function is shown to fail
before the 16 ms check. The report writes `environment` and
`frameBudget` next to the workload table.

Measured 2026-09-07 via `pnpm verify:performance` (Playwright headless
Chromium 149, macOS, unmasked renderer `ANGLE (Apple, ANGLE Metal
Renderer: Apple M5 Pro, Unspecified Version)`):

| Backend | Workload | p50 (ms) | drawCalls | 16 ms gate |
| --- | --- | --- | --- | --- |
| webgl2 | 100-boxes | 8.20 | 1 | n/a (batching only) |
| webgl2 | 1k-boxes | 8.30 | 1 | pass |
| webgl2 | 10k-boxes | 8.30 | 1 | n/a (batching only) |
| webgpu | 1k-boxes | 8.30 | 24 | pass (time only) |

WebGPU `drawCalls` is recorded, not gated: `WebGPURenderer.info.render.calls`
is not the WebGL2 InstancedMesh=1 proof. A SwiftShader session on
2026-09-06 was 1k-boxes p50 108.10 ms and is not the gated environment.

### Memory

- **Workload**: 10k-box scene held for 60s with periodic `update()` churn.
- **Metric**: `performance.memory.usedJSHeapSize` growth (Chromium).
- **Target**: bounded heap growth; no per-update geometry/material leak after
  caching lands.

## Non-Goals For Phase A

- No optimization changes. Measurement only.
- No public opt-in performance APIs beyond the additive `CanvasRenderStats`
  type, the `frame.render` field, and `getRenderStats()`.
- No WebGPU runtime.

## Next

Populate the baseline table from the first `verify:performance` run, lock these
thresholds, then begin Phase B (BVH activation, geometry/material caching,
dead-config activation) and prove each change against the baseline.
