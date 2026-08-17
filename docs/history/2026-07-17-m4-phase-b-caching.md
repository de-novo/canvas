# M4 Phase B: Geometry/Material Caching

Date: 2026-07-17.

## Context

[M4 Phase A](./2026-07-17-m4-phase-a-measurement.md) captured a strictly linear
baseline: every box node costs one draw call, one geometry, and one material.
`packages/web/src/3d.ts` allocated a fresh `BoxGeometry(1,1,1)` and a fresh
`MeshStandardMaterial` per node on every scene build, then disposed all of them
on every `applyScene` rebuild. Phase B begins by removing that allocation and
GPU-upload churn.

## Scope

Share the unit box geometry and one material per color across all matching
nodes, without yet collapsing draw calls (that is the InstancedMesh/BatchedMesh
batching step that follows).

## Changes

`packages/web/src/3d.ts`:

- Added a module-level `cachedResources: WeakSet<object>` to track shared
  resources, a `cachedSurfaceMaterials: Map<string, MeshStandardMaterial>` for
  per-color materials, and a lazy `unitBoxGeometry: BoxGeometry`.
- `getUnitBoxGeometry()` returns the shared unit box.
- `createCanvas3DSurfaceMaterial(color)` returns the cached material for a
  color, creating and registering it on first use.
- `createObject` now uses the cached geometry for `box` nodes.
- `disposeGroup` skips any geometry/material present in `cachedResources`, so
  shared resources survive scene rebuilds and are never double-disposed.

Sphere geometry is not cached (radius varies per node); that remains a future
opportunity.

## Result

Re-measured with `pnpm verify:performance` (`frustumCulling: false`):

| Workload | baseline p50 | cached p50 | improvement | geometries |
| --- | --- | --- | --- | --- |
| 100-boxes | 24.20 ms | 15.80 ms | 35% | 100 → 1 |
| 1k-boxes | 158.40 ms | 83.30 ms | 47% | 1000 → 1 |
| 10k-boxes | 250.00 ms | 151.00 ms | 40% | 10000 → 1 |

Draw calls are unchanged (still O(nodes)). The frame-time win comes from
eliminating per-node geometry/material allocation and GPU upload.

## BVH Picking Acceleration

The same change set activated the previously-inert three-mesh-bvh integration.
`installMeshBvhRaycast()` had patched `BufferGeometry.prototype` with
`computeBoundsTree`, but nothing ever called it. Phase B added
`prepareGeometryBounds()` in `packages/web/src/3d.ts`, which calls
`computeBoundsTree()` (optional-chained, runtime-installed) on the cached unit
box and on each sphere geometry. Simple primitives benefit little, but this is
the foundation for fast picking on complex geometry.

## Diff-based applyScene

`applyScene` previously rebuilt every `Object3D` on each scene update and
disposed the entire previous content group — the P0 hot-path bottleneck from
the Phase A exploration. Phase B changed it to value-based diffing:

- A closure-level `prevNodesById: Map<string, Canvas3DNode>` remembers the last
  applied scene's nodes.
- `canvas3DNodeEqual(a, b)` short-circuits on reference equality, then on
  `type`, then falls back to JSON value equality across all node variants.
- In the node loop, an unchanged node reuses its existing `Object3D` (removed
  from the `objects` map so the trailing dispose does not touch it); only
  added, removed, or changed nodes create/dispose objects.
- Three.js `add()` reparents reused objects out of the old content `Group`, so
  the existing `disposeGroup(content)` now only destroys genuinely removed
  nodes. `disposeGroup` was refactored to share a new `disposeObject3D` helper
  that skips cached resources.

`prevNodesById` is repopulated at the end of each `applyScene` from the newly
applied scene's nodes.

## Verification

Passed on 2026-07-17:

- `pnpm typecheck` (all tasks).
- `pnpm verify:browser-rendering` (`"ok": true`) — caching, BVH, and diff-based
  applyScene did not regress visual correctness across authoring, transform, and
  surface-placement update workflows.
- `pnpm verify:editor-core` — command/selection/authoring dispatch unaffected.
- `pnpm verify:hit-testing` — picking still resolves correct nodes with BVH on.
- `pnpm verify:document-schema` — document validation unaffected.
- `pnpm verify:performance` — 35–47% frame-time improvement and `geometries`
  stat collapsed to 1.

## Next

Draw-call batching: collapse same-material box/sphere nodes into
`InstancedMesh`/`BatchedMesh` batches to move draw calls from O(nodes) toward
O(material-groups), targeting ≤ 16 ms (60 fps) at 1k and 10k nodes. This
requires extending the hit-tester to map `instanceId` → node id, so it is a
larger, contract-changing change deferred from this slice.
