# Geometry store: mesh tessellation on AssetRef

**Date:** 2026-08-17
**Status:** landed (type/build/`verify:*` evidence in this change)

## Context

`mesh` nodes stored unbounded `positions` / `indices` arrays in the
document JSON. That made IFC imports huge and blocked any later cap lift.
Canonical schema stays `0.2.0`; this slice is additive.

## Changes

- Core: `mesh` accepts either inline `positions`/`indices` or
  `geometryAssetId`. Combining both, or providing neither, fails parse.
- Core: `AssetKind` includes `geometry`. Documents reject a
  `geometryAssetId` that is missing or not type `geometry`.
- Core: `CanvasGeometryStore`, `defineMeshGeometry`,
  `createMeshGeometryAssetRef`, and `resolveCanvasMeshGeometry` keep
  tessellation out of the snapshot.
- Web/facade: `CreateCanvasOptions.geometryStore` resolves asset-backed
  meshes at render time.
- BIM: `toDocument()` writes one `geometry` asset per element and puts
  buffers in the adapter store. `toScene()` returns the same asset-backed
  scene. The playground passes the store into `createCanvas`.
- React R3F `CanvasStage3D` accepts the same store for its mesh path.

## Verification

Ran after the code change on 2026-08-17:

- `pnpm typecheck` — 30/30
- `pnpm build` — 20/20
- `pnpm verify:document-schema` — 37 named checks, including
  `mesh-nodes-accept-inline-or-geometry-asset`
- `pnpm verify:public-api` — ok, including geometry-store fixtures
- `pnpm verify:editor-core` — ok, including geometry helper exports

`pnpm verify:bim-rendering` was not re-run in this pass.

## Residual risk

- Geometry buffers are session-scoped. Snapshot save keeps `AssetRef`s
  and bounds metadata, not the `Float32` payloads. Reloading a saved BIM
  document still needs `uploadAsset` / a blob store.
- `verify:bim-rendering` was not necessarily re-run in the same pass.
- The 5000-element cap is unchanged.

## Next action

WebGPU language: keep WebGL2/Canvas2D as the implemented backends.
