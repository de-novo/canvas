# M6 Phase D: Facade Storage Wiring

Date: 2026-07-20.

## Context

Phases [A](./2026-07-20-m6-phase-a-persistence-model.md),
[B](./2026-07-20-m6-phase-b-persistence-events.md), and
[C](./2026-07-20-m6-phase-c-filesystem-adapter.md) built the data model, the
editor persistence event bus + `connectEditorToStorage` bridge, and the first
durable (filesystem) adapter. None of it was reachable from the facade yet —
`createCanvas`/`connectEditorToCanvas` had no storage option. Phase D closes
that loop, fulfilling the `persistence-and-sync.md` requirement that "M6 must
connect an adapter end to end before adding it to `createCanvas()` configuration."

## Scope

Wire a `CanvasStorageAdapter` through the facade's `connectEditorToCanvas` so a
host app gets durable, conflict-aware auto-save by passing one option. The
vanilla save demo and TanStack Query hooks remain as follow-up; this slice
ships the contract.

## Changes

### Facade — `packages/canvas/src/index.ts`

- `ConnectEditorToCanvasOptions` gains `storage?: CanvasStorageAdapter` and
  `storageDebounceMs?: number`.
- `connectEditorToCanvas` now calls `connectEditorToStorage(editor,
  options.storage, { debounceMs })` when a storage adapter is supplied, and
  threads the resulting disconnect through the existing disconnect chain (and
  the try/catch rollback).
- Imports `connectEditorToStorage` from `@denovo/canvas-editor` and
  `CanvasStorageAdapter` from `@denovo/canvas-core`.

## Result

End-to-end persistence is now a one-liner from the facade:

```ts
const adapter = createFileSystemDocumentAdapter({ directory: "./docs" });
const disconnect = connectEditorToCanvas(editor, runtime, {
  storage: adapter,
  storageDebounceMs: 500
});
```

Every persistent editor command now flows: `dispatch` →
`transaction.committed` → debounced `adapter.saveDocument(document,
{ baseRevision })` → conflict reconciliation on `{ ok: false, reason:
"conflict" }`. Disconnect tears the whole chain down cleanly.

## Verification

Passed on 2026-07-20:

- `pnpm typecheck` (all tasks).
- `pnpm build`.
- `pnpm verify:public-api`.
- `pnpm verify:editor-core`.
- `pnpm verify:browser-rendering` (no behavior change without `storage`).

## Next

- Vanilla save demo (a "Save" button + autosave indicator in `apps/vanilla`).
- TanStack Query hooks (`useDocument`, `useSaveSnapshot`) and a Next.js route
  example in `apps/playground`.
- Browser IndexedDB adapter; `applyCommands` and `uploadAsset` implementations;
  `inverseCommand` → `DocumentPatchRecord` serialization.
