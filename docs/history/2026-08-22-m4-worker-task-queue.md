# 2026-08-22 M4 worker task queue and OffscreenCanvas capability

## Date

2026-08-22

## Scope

M4 Performance Layer slice: the worker task queue, the first-party
conversion task, the OffscreenCanvas capability check, and their facade
surface. This is the "heavy parsing/conversion runs outside the main
thread" half of the M4 acceptance criteria.

A product-boundary decision recorded alongside this slice: advanced graph
visuals in the Obsidian-plugin sense (nebula glow, planetary classes, 3D
star fields) stay userland. The SDK ships performance primitives and
extension points (`renderNode`, custom renderer adapters, plugin nodes,
worker tasks); it does not ship decorative universes. Our work stops at
performance optimization.

## Changes

### `@denovo/canvas-worker`

- `createWorkerHandler(tasks)` / `WorkerTaskImplementations` — worker-side
  dispatcher correlating requests to typed implementations; unknown task
  types and throwing implementations respond `{ ok: false, error }`
  instead of crashing the worker; top-level `ArrayBuffer`/typed-array
  results are transferred back.
- `denovo.geometry.convert` first-party task
  (`convertDenovoGeometry`, `DenovoWorkerTaskMap`) — raw arrays →
  transferable `Float32Array`/`Uint32Array` + axis-aligned bounds;
  rejects non-triangle indices and short positions explicitly.
- `createDenovoWorkerHandler()` — ready-to-install handler for the
  first-party vocabulary.
- `createWorkerTaskQueue({ createWorker, size })` — main-side pool with
  FIFO buffering, one in-flight request per worker, dispose rejecting
  in-flight **and** buffered callers, and explicit invalid-size failures.
- Existing `supportsOffscreenCanvas()` / `transferCanvasIfSupported()` /
  `createWorkerClient` unchanged.

### Facade

- New `@denovo/canvas/worker` subpath re-exporting the worker vocabulary;
  `scripts/verify-public-api.mjs` now asserts the subpath exists. The
  opt-in entrypoint keeps the facade root lean.

### Verification

- New `pnpm verify:worker-tasks`
  (`scripts/verify-worker-tasks.mjs`): loopback-worker checks for task
  correctness/rejection, queue round-trip, FIFO within pool size with one
  request per worker at a time, error recovery, dispose semantics, and
  unknown-task failures — 9 named checks, passing.
- Browser measurement via ego-browser against
  `apps/vanilla/worker-bench.html` (kept as a permanent bench; imports
  through the new facade subpath): RTT p95 1.6/0.8/8.4 ms for 12 KB /
  1.2 MB / 12 MB payloads; rAF fired 0.4 ms after issuing a 12 MB worker
  conversion vs 86.2 ms when the same work ran on the main thread.
  Numbers recorded in
  [M4 Performance Thresholds](../m4-performance-thresholds.md).

## Verification (commands)

- `pnpm typecheck`: passed (32 tasks).
- `pnpm build`: passed (21 packages/apps).
- `pnpm verify:public-api`: passed, including the new `./worker`
  assertion and the generated-declaration `any` audit.
- `pnpm verify:worker-tasks`: passed (9 checks).

## Residual risk

- Bench numbers come from a dev-server Chromium session on one macOS
  machine; they are baselines, not gates.
- Result buffers are transferred only for top-level typed arrays; nested
  views inside deeper structures copy.
- LOD controls and chunk loading APIs remain open M4 deliverables, as do
  the M7 BIM gaps; neither is claimed by this slice.

## Next action

Decide and implement (or descope) the remaining M4 deliverables: LOD
controls, chunk loading APIs, and a frame-budget gate for the 16 ms
target.
