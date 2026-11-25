# M6 Polish: Vanilla Save Demo + Facade IndexedDB Entry

Date: 2026-07-21.

## Context

The IndexedDB adapter landed in
[the previous slice](./2026-07-21-m6-indexed-db-adapter.md) under
`@de-novo/canvas-web/indexed-db`, but the vanilla example — the canonical
"simple things simple" demo — had no persistence wired in, so the end-to-end
save story was not visible anywhere. This slice makes the facade re-export the
adapter and turns the vanilla app into the first real save demo.

## Scope

1. Re-export the IndexedDB adapter through the facade so consumers import from
   a single package.
2. Wire the vanilla example to auto-save via the adapter.

`applyCommands`, and `uploadAsset` remain.

## Changes

### Facade — `packages/canvas/src/indexed-db.ts` (new) + `package.json`

- New `@de-novo/canvas/indexed-db` subpath that re-exports
  `createIndexedDbDocumentAdapter` and `IndexedDbDocumentAdapterOptions` from
  `@de-novo/canvas-web/indexed-db`.
- Added the `./indexed-db` export and `src/indexed-db.ts` to the tsup build so
  the subpath resolves in ESM and CJS.

### Vanilla example — `apps/vanilla/src/main.ts`

- Imports `createIndexedDbDocumentAdapter` from `@de-novo/canvas/indexed-db`.
- Creates the adapter and passes it to `connectEditorToCanvas` with
  `storageDebounceMs: 500`, so every persistent editor command now auto-saves
  to IndexedDB (debounced) with conflict reconciliation handled by the existing
  bridge.

## Result

The vanilla example now persists edits across reloads out of the box — reload
the page and the document is restored from IndexedDB. This is the first
end-to-end, user-visible save flow in the repo and the reference for the
`storage` facade option.

## Verification

Passed on 2026-07-21:

- `pnpm typecheck` (all tasks).
- `pnpm build`.
- `pnpm verify:public-api`.
- `pnpm verify:browser-rendering` — pending in background (storage wiring does
  not change rendering behavior).

## Next

- TanStack Query hooks (`useDocument`, `useSaveSnapshot`) and a Next.js route
  example in `apps/playground`.
- `applyCommands` and `uploadAsset` implementations; `inverseCommand` →
  `DocumentPatchRecord` serialization.
- Save-status UI in the vanilla example (dirty / saving / saved / conflict).
