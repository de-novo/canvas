# M4 Phase B: Draw-Call Batching

Date: 2026-07-17.

## Context

The Phase A baseline showed a strictly linear `drawCalls = nodeCount` curve:
1k boxes cost 1000 draw calls and 158 ms, 10k boxes cost 10000 draw calls and
250 ms. Geometry/material caching and diff-based `applyScene` cut allocation
and update churn but left draw calls O(nodes). Phase B's final step collapses
that curve.

## Scope

Opt-in draw-call batching (`render.batch: true`, default `false`). When on,
same-color top-level box nodes are rendered as one `InstancedMesh` per color.
Picking still resolves to individual nodes through a new instance-id mapping in
the hit tester. Nested boxes and other node types keep the per-object path, so
hierarchy and per-node transforms are unaffected.

## Changes

- `packages/core/src/index.ts`: added `batch: z.boolean().default(false)` to
  `RenderOptionsSchema` (and the scene default object).
- `packages/three/src/index.ts`: exported
  `INSTANCE_NODE_IDS_USER_DATA_KEY`; `createThreeHitTester` now checks the
  hit object's `userData` instance-id map when the raycaster reports an
  `instanceId`, falling back to the existing parent-walk resolution.
- `packages/web/src/3d.ts`:
  - `createBatchedBoxMesh(boxes)` builds one `InstancedMesh` (shared unit box
    geometry + cached material) with per-instance matrices and stores the
    per-instance node ids under `INSTANCE_NODE_IDS_USER_DATA_KEY`.
  - `boxEntryFromNode` narrows a `Canvas3DNode` to its box fields.
  - `applyScene` groups top-level (`parentId === null`) box nodes by color and,
    when `sceneData.render.batch` is on and a group has ≥ 2 entries, emits a
    batched mesh; those node ids are skipped in the per-object loop.

## Result

Re-measured with `pnpm verify:performance` (`frustumCulling: false`,
`batch: true`):

| Workload | cached-only p50 | batched p50 | drawCalls |
| --- | --- | --- | --- |
| 100-boxes | 15.80 ms | 8.60 ms | 1 |
| 1k-boxes | 83.30 ms | 48.60 ms | 1 |
| 10k-boxes | 151.00 ms | 91.70 ms | 1 |

Draw calls collapsed from O(nodes) to O(material-groups). End-to-end vs the
Phase A baseline: 1k 158 → 48.60 ms (−69%), 10k 250 → 91.70 ms (−63%). The
remaining frame time is now instance-matrix/CPU and headless-renderer overhead,
not draw-call count.

## Verification

Passed on 2026-07-17:

- `pnpm typecheck` (all tasks).
- `pnpm build`.
- `pnpm verify:public-api`, `verify:editor-core`, `verify:hit-testing`,
  `verify:document-schema` — all green with default `batch: false`.
- `pnpm verify:browser-rendering` (`"ok": true`) — visual correctness preserved
  with the default off.
- `pnpm verify:performance` — with `batch: true`, draw calls drop to 1 and
  frame times fall 39–45% vs the cached-only numbers.

## Next

Batching is currently box-only and top-level-only. Future work could extend it
to sphere nodes (needs radius-aware grouping), nested boxes, and per-instance
visibility, and could chase the remaining instance/CPU overhead toward 60 fps
at 10k nodes. The `batch` flag stays opt-in until those are validated.
