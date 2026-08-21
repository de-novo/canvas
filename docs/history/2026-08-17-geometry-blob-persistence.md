# Geometry blob persistence

**Date:** 2026-08-17
**Status:** landed (type/build/`verify:*` evidence in this change)

## Context

Mesh tessellation lived in a session `CanvasGeometryStore`. Memory and
filesystem adapters had no blob I/O, and the storage contract had
`uploadAsset` but no read path, so a saved BIM document could not reload
geometry.

## Changes

- Core: `loadAsset` on `CanvasStorageAdapter`, `AssetRecord`,
  `encodeMeshGeometry` / `decodeMeshGeometry`,
  `persistCanvasGeometryStore` / `hydrateCanvasGeometryStore`.
- Server: memory and filesystem implement `uploadAsset` and `loadAsset`.
  Filesystem writes `assets/<id>.json` plus `assets/<id>.bin`.
  `createCanvasServer` forwards both methods.
- Web: IndexedDB `uploadAsset` uses the shared upload helper and
  `loadAsset` reads the assets object store.

## Verification

Ran after the code change on 2026-08-17:

- `pnpm typecheck` — 30/30
- `pnpm build` — 20/20
- `pnpm verify:public-api` — ok, including `loadAsset` and persist/hydrate
- `pnpm verify:server` — ok, 30 assertions, including memory/filesystem
  geometry blob round-trip

## Residual risk

- Geometry bytes are JSON `number[]` payloads, not a packed binary format.
- BIM playground still re-parses IFC instead of hydrating from storage.
- `deleteDocument` does not garbage-collect unused asset blobs.

## Next action

Milestone verification for M4–M8, or mount framework adapters on the
facade.
