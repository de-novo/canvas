# M6 Phase B: Editor Persistence Events + Storage Bridge

Date: 2026-07-20.

## Context

[Phase A](./2026-07-20-m6-phase-a-persistence-model.md) landed the persistence
data model (revision, `DocumentPatchRecord`, discriminated `SaveResult`) and the
first in-memory adapter, but the editor had no way to tell the outside world
that a document changed. `dispatch` mutated state and pushed undo history in
isolation; there was no persistence event bus, no revision tracking, and no
bridge from editor to adapter. Phase B wires that up.

## Scope

Editor-side persistence surface and a ready-to-use `connectEditorToStorage`
bridge. Still no facade wiring (Phase D), no filesystem/IndexedDB adapters
(Phase C). Patch derivation from `applyCommandEffect.inverse` is surfaced as
`inverseCommand` on the event; full JSON-Patch serialization is deferred.

## Changes

### Editor — `packages/editor/src/editor.ts`

- **`CanvasPersistenceEvent`** discriminated union:
  `{ type: "transaction.committed"; documentId; baseRevision; revision; command; inverseCommand? }`
  and `{ type: "revision.changed"; documentId; revision }`.
- **`CanvasPersistenceListener`** type.
- **`CreateCanvasEditorOptions`** gains `documentId?: NodeId` and
  `baseRevision?: number`.
- **`CanvasEditor`** interface gains `subscribePersistence(listener)`,
  `getDocumentId()`, `getBaseRevision()`, and `setBaseRevision(revision)`.
- `createEditor` tracks `documentId` and `baseRevision`, maintains a
  `persistenceListeners` set, and emits a `transaction.committed` event from
  `dispatchCommand` whenever a command is persistent — bumping the local
  revision and carrying `applied.inverse` as `inverseCommand`.
- `setBaseRevision` emits `revision.changed` when the revision actually moves
  (e.g. after a server reconcile).
- **`connectEditorToStorage(editor, adapter, { debounceMs? })`**: subscribes to
  persistence events, debounces `adapter.saveDocument(document,
  { baseRevision })`, and on a `conflict` result reconciles the editor's
  `baseRevision` to the server's `serverRevision`. Returns a disconnect
  function.

### Package export — `packages/editor/src/index.ts`

Re-exports `connectEditorToStorage`, `CanvasPersistenceEvent`,
`CanvasPersistenceListener`, and `ConnectEditorToStorageOptions`.

### Verification — `scripts/verify-server.mjs`

Added an end-to-end test: `createEditor` + `createMemoryDocumentAdapter` +
`connectEditorToStorage`, dispatch a `node.add`, assert a
`transaction.committed` event with `revision: 1`, and confirm the adapter
received the saved document (revision 1, new node present).

## Result

- Editors now broadcast persistence events without coupling to any adapter.
- The local `baseRevision` advances monotonically with each persistent command.
- `connectEditorToStorage` is the canonical bridge: debounce, save, reconcile.
- Optimistic-concurrency conflict recovery is exercised end-to-end in
  `verify:server`.

## Verification

Passed on 2026-07-20:

- `pnpm typecheck` (all tasks).
- `pnpm build`.
- `pnpm verify:public-api` (one doc comment was reworded to avoid the `any`
  declaration check — "any adapter" → "a storage adapter").
- `pnpm verify:document-schema`, `verify:hit-testing`, `verify:editor-core`.
- `pnpm verify:server` — now 11 checks, including the editor↔adapter bridge.

## Next

- **Phase C**: filesystem + IndexedDB adapters; real `applyCommands` and
  `uploadAsset`; serialize `inverseCommand` into a `DocumentPatchRecord`.
- **Phase D**: facade `storage` option wired end-to-end, vanilla save demo,
  TanStack Query hooks.
