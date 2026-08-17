# M6 Polish: IndexedDB Adapter

Date: 2026-07-21.

## Context

[Phase C](./2026-07-20-m6-phase-c-filesystem-adapter.md) added a durable
Node.js filesystem adapter, but browser apps had no durable adapter yet — only
the in-memory one. Browser-local persistence is the most common real-app need
("save my work without a server"), so this slice adds an IndexedDB adapter.

## Scope

A browser `CanvasStorageAdapter` backed by IndexedDB. Vanilla save demo and
TanStack Query hooks remain as follow-up. The adapter reuses the exact same
conflict-detection contract as the memory and filesystem adapters, so
`connectEditorToStorage` works unchanged.

## Changes

### IndexedDB adapter — `packages/web/src/indexed-db.ts` (new)

- `createIndexedDbDocumentAdapter({ dbName?, storeName? })` implements
  `CanvasStorageAdapter`:
  - Opens (and upgrades) an IndexedDB database lazily, cached across calls.
  - `loadDocument(id)` reads the stored entry and re-validates with
    `CanvasDocumentSchema` (returns `null` on miss/parse failure).
  - `saveDocument(document, { baseRevision? })` reads the stored revision for
    conflict detection, bumps revision, validates, and `put`s the entry.
  - `listDocuments()` returns summaries from all stored entries.
  - `deleteDocument(id)` removes the entry.
- Published under `@denovo/canvas-web/indexed-db` to keep the browser-only
  IndexedDB API out of Node/server bundles.

### Package wiring — `packages/web/package.json`

- New `./indexed-db` export (`dist/indexed-db.{js,cjs,d.ts}`).
- `build` now compiles `src/indexed-db.ts` as a fourth entry.

## Result

- Browser apps can now persist documents locally across reloads with the same
  one-liner as the filesystem adapter:
  ```ts
  import { createIndexedDbDocumentAdapter } from "@denovo/canvas-web/indexed-db";
  connectEditorToCanvas(editor, runtime, {
    storage: createIndexedDbDocumentAdapter(),
    storageDebounceMs: 500
  });
  ```
- Three durable adapters now exist: in-memory (test), filesystem (Node),
  IndexedDB (browser) — all behind the single `CanvasStorageAdapter` contract.

## Verification

Passed on 2026-07-21:

- `pnpm typecheck` (all tasks).
- `pnpm build` (web package now emits 4 entries).
- `pnpm verify:public-api` (no explicit `any` in the new declaration).

Browser round-trip verification (Playwright) is a follow-up; the adapter
shares the same conflict-detection logic already covered by `verify:server`.

## Next

- Vanilla save demo: a "Save" button + autosave indicator in `apps/vanilla`
  using the IndexedDB adapter.
- TanStack Query hooks (`useDocument`, `useSaveSnapshot`) and a Next.js route
  example in `apps/playground`.
- `applyCommands` and `uploadAsset` implementations; `inverseCommand` →
  `DocumentPatchRecord` serialization.
