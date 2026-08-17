# M6 Phase C: Filesystem Adapter

Date: 2026-07-20.

## Context

[Phase A](./2026-07-20-m6-phase-a-persistence-model.md) landed the data model
and an in-memory adapter; [Phase B](./2026-07-20-m6-phase-b-persistence-events.md)
connected the editor to any adapter via persistence events and
`connectEditorToStorage`. Both adapters so far evaporate on process exit. Phase
C adds the first durable, disk-backed adapter so documents actually persist.

## Scope

A Node.js filesystem `CanvasStorageAdapter` that stores each document as a JSON
file. Browser IndexedDB adapter, `applyCommands`, and `uploadAsset` remain
(future Phase C slices); the filesystem adapter is the durable baseline and is
verifiable in plain Node without a browser.

## Changes

### Filesystem adapter — `packages/server/src/filesystem.ts` (new)

- `createFileSystemDocumentAdapter({ directory })` implements
  `CanvasStorageAdapter`:
  - `loadDocument(id)` reads `<directory>/<id>.json` (returns `null` if
    missing/unreadable).
  - `saveDocument(document, { baseRevision? })` reads the existing file's
    revision for optimistic-concurrency conflict detection, bumps revision,
    validates with `CanvasDocumentSchema`, and writes pretty-printed JSON.
  - `listDocuments()` scans the directory for `.json` files and returns
    summaries (invalid files skipped).
  - `deleteDocument(id)` unlinks the file.
- Uses `node:fs/promises` and `node:path`, so it is published under a separate
  `@denovo/canvas-server/filesystem` export to keep browser bundles clean.

### Package wiring — `packages/server/package.json`, `tsconfig.json`

- New `./filesystem` export (`dist/filesystem.{js,cjs,d.ts}`).
- `build` now compiles `src/index.ts` and `src/filesystem.ts` as separate
  entries.
- Added `@types/node` devDependency and `types: ["node"]` in `tsconfig.json`.

### Verification — `scripts/verify-server.mjs`

Three new checks (now 14 total): document JSON lands on disk, loads back with
the right revision, and stale `baseRevision` conflicts against the stored file.

## Result

- Documents now persist across process restarts via plain JSON files.
- The filesystem adapter reuses the same conflict-detection contract as the
  in-memory adapter, so editor↔storage bridges work unchanged.
- `@denovo/canvas-server/filesystem` is the first durable, real I/O adapter.

## Verification

Passed on 2026-07-20:

- `pnpm typecheck` (all tasks).
- `pnpm build`.
- `pnpm verify:public-api`.
- `pnpm verify:server` — 14 checks, including 3 new filesystem checks.

## Next

- Browser IndexedDB adapter (needs Playwright verification).
- `applyCommands` implementation (command applier lives in the editor package;
  the server would depend on it, so this needs a dependency decision).
- `uploadAsset` (blob storage) and `inverseCommand` → `DocumentPatchRecord`
  serialization.
- Phase D: facade `storage` option wired end-to-end + vanilla save demo +
  TanStack Query hooks.
