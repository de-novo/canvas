# v1 persistence: applyCommands parity and undo visibility

**Date:** 2026-08-17
**Status:** landed (type/build/`verify:*` evidence in this change)

## Context

Review hardening left two persistence gaps: memory and filesystem adapters
omitted `applyCommands`, and undo/redo restored the editor snapshot without
telling `connectEditorToStorage`. IndexedDB already applied commands through
the editor applier.

## Changes

- Editor: `applyCommandsToStoredDocument` applies a command list to a stored
  snapshot with shared OCC, validation, and revision-bump rules.
- Editor: undo/redo emit `CanvasPersistenceEvent` `history.changed` without
  incrementing local `baseRevision`. `connectEditorToStorage` flushes on
  `transaction.committed` and `history.changed`, not on `revision.changed`.
- Server: `@denovo/canvas-server` depends on `@denovo/canvas-editor`. Memory
  and filesystem adapters persist the applied document. `createCanvasServer`
  forwards `applyCommands`.
- Web: IndexedDB `applyCommands` uses the same stored-document helper, then
  writes the existing patch audit record.
- Facade: re-exports `applyCommandsToStoredDocument` and the persistence
  event types.

## Verification

Ran after the code change on 2026-08-17:

- `pnpm typecheck` — 30/30
- `pnpm build` — 20/20
- `pnpm verify:public-api` — ok, including `applyCommandsToStoredDocument`
  and `history.changed` fixtures
- `pnpm verify:editor-core` — ok, including stored-document OCC/validation
- `pnpm verify:server` — ok, 26 assertions, including memory/filesystem
  `applyCommands` and undo/redo snapshot persistence

## Residual risk

- `uploadAsset` is still omitted on memory and filesystem adapters.
- M6 remains landed-but-unverified as a milestone.
- Snapshot save after undo writes a new revision of the restored document;
  there is still no persisted command-history log.

## Next action

Geometry store: keep IFC/glTF tessellation on `AssetRef` instead of
unbounded `number[]` on every `mesh` node.
