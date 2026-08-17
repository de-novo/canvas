# M6 Phase A: Persistence Data Model + Interface Unification

Date: 2026-07-20.

## Context

M6 connects editing to real applications. Three parallel explorations found the
persistence layer was effectively dead code: `CanvasStorageAdapter` was fully
defined in core but had zero callers; `@denovo/canvas-server` defined its own
incompatible scene-level `SceneStore`; the editor's `persistent` flag meant
"undoable" not "saved"; and the facade's `loadDocument` was synchronous and
in-memory only. Before any adapter can be wired end-to-end, the data model
hard blockers had to land.

## Scope

Phase A ships the persistence data model and a real in-memory adapter. No
facade wiring yet (Phase B+), no filesystem/IndexedDB adapters (Phase C).

## Changes

### Core — `packages/core/src/index.ts`

- **`revision`** added to `CanvasDocumentSchema`
  (`z.number().int().nonnegative().default(0)`). Additive: existing `0.2.0`
  documents round-trip with revision 0 filled by the default.
- **`DocumentPatchOpSchema` / `DocumentPatchSchema`** — JSON-Patch-style
  operations (`add`/`remove`/`replace`/`move`, `path`, optional `from`/`value`)
  as a serializable, schema-validated array.
- **`DocumentPatchRecordSchema`** — `{ id, documentId, baseRevision, revision,
  patch, inversePatch?, commandType?, actorId?, createdAt }` for patch logs.
- **`CanvasSaveResult`** is now a discriminated union:
  `{ ok: true; document; revision }` | `{ ok: false; reason: "conflict";
  serverRevision; document? }` | `{ ok: false; reason: "validation" |
  "permission" | "unknown"; message }`.
- **`CanvasStorageAdapter`** options changed `baseVersion?: string` →
  `baseRevision?: number` on both `saveDocument` and `applyCommands`.

### Server — `packages/server/src/index.ts` (full rewrite)

- Removed the scene-level `SceneStore` / `createMemorySceneStore` /
  `createCanvasServer` scene API.
- Added `createMemoryDocumentAdapter(): CanvasStorageAdapter` — `Map<id,
  {document, revision}>` with `loadDocument`, `saveDocument` (optimistic
  concurrency via `baseRevision` → conflict `SaveResult`), `listDocuments`,
  `deleteDocument`. `applyCommands`/`uploadAsset` intentionally omitted (Phase
  B/C).
- Added `createCanvasServer({ adapter })` — thin document CRUD facade over an
  adapter, defaulting to the memory adapter.

### Verification — `scripts/verify-server.mjs` (new) + `package.json`

- Round-trip with monotonic revision.
- Conflict on stale `baseRevision` with correct `serverRevision`.
- Matching `baseRevision` succeeds.
- `listDocuments` / `deleteDocument`.
- Deterministic `0.1.0` → `0.2.0` migration on load, with default revision 0.
- Added `"verify:server": "node scripts/verify-server.mjs"`.

### Document-schema fixture

Updated the inline `CanvasStorageAdapter` mock in
`scripts/verify-document-schema.mjs` to return the new discriminated
`CanvasSaveResult` shape.

## Result

- Single transport boundary (`CanvasStorageAdapter`) across core and server.
- Documents carry monotonic `revision`; saves can detect conflicts.
- Patch records are serializable and schema-validated, ready for Phase B's
  editor event bus.
- The in-memory adapter is the first real, tested `CanvasStorageAdapter`
  implementation.

## Verification

Passed on 2026-07-20:

- `pnpm typecheck` (all tasks).
- `pnpm build`.
- `pnpm verify:public-api`.
- `pnpm verify:document-schema` (mock updated to discriminated `SaveResult`).
- `pnpm verify:editor-core`, `verify:hit-testing`.
- `pnpm verify:server` — new, 9 checks green.

## Next

- **Phase B**: editor `subscribePersistence` event bus + patch derivation from
  `applyCommandEffect`'s existing `inverse` + `baseRevision` tracking + a
  `connectEditorToStorage` bridge.
- **Phase C**: filesystem + IndexedDB adapters; real `applyCommands` and
  `uploadAsset`.
- **Phase D**: facade `storage` option wired end-to-end, vanilla save demo,
  TanStack Query hooks.
