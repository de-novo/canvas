# Persistence and Sync

## Goal

Denovo Canvas documents must be easy to save locally, save remotely, version,
migrate, diff, patch, and eventually synchronize across sessions.

Persistence must not depend on React, Next.js, TanStack Query, or a specific
database. Those integrations should sit on top of small storage interfaces.

## Storage Model

The persistence model has three durable layers:

1. Document snapshot.
2. Asset store.
3. Patch or command log.

### Document Snapshot

A snapshot is the full JSON document at a point in time. Its public
`CanvasDocument` type is inferred from `CanvasDocumentSchema`; this document
does not maintain a broader handwritten shadow type. The canonical snapshot
version is `0.2.0` and contains document identity, a mode-specific scene with
ordered layers and nodes, asset references, metadata, plugin state, and
optional title and timestamps.

Snapshots are best for:

- initial load;
- simple save;
- export/import;
- backup;
- migration.

The facade supports snapshot ingestion through `document` and
`loadDocument()`, accepting a current typed object or JSON string.
`getDocument()` returns the current validated canonical snapshot.
`parseDocument()` accepts untrusted legacy object input, while
`parseDocumentJson()` and facade JSON loading apply the strict, deterministic
`0.1.0` to `0.2.0` migration. Unknown past or future versions fail explicitly.
This remains an in-memory runtime contract. Storage adapter I/O, revisions,
remote loading, and a generalized migration registry remain later persistence
milestones.

`CanvasStorageAdapter` defines that later transport boundary, but the current
facade does not expose storage presets or accept a storage config it would only
record and ignore. M6 must connect an adapter end to end before adding it to
`createCanvas()` configuration.

### Asset Store

Assets are external to the JSON document.

Use assets for:

- images;
- glTF/GLB;
- IFC/XKT;
- textures;
- generated binary geometry;
- WASM parser outputs;
- large metadata tables.

```ts
type AssetRef = {
  id: string;
  type: "image" | "gltf" | "glb" | "ifc" | "xkt" | "binary" | "json" | "other";
  uri?: string;
  byteLength?: number;
  mimeType?: string;
  checksum?: string;
  metadata: Record<string, JsonValue>;
};
```

Document nodes reference assets by `assetId`, never by embedding large payloads.

M1 retains and exposes asset references when a document is loaded or its scene
is updated. It does not yet fetch or decode referenced payloads. Asset loaders
remain renderer/plugin capabilities so binary handling does not enter the core
document model.

### Patch Log

A patch log stores incremental changes.

Patch logs are best for:

- autosave;
- undo/redo persistence;
- optimistic remote writes;
- collaborative editing foundations;
- audit trails.

```ts
type DocumentPatchRecord = {
  id: string;
  documentId: string;
  baseRevision: number;
  revision: number;
  patch: DocumentPatch;
  inversePatch?: DocumentPatch;
  commandType?: string;
  actorId?: string;
  createdAt: string;
};
```

The first implementation can use a simple JSON patch-like format. If
collaboration becomes a priority, the patch layer can be replaced or backed by a
CRDT without changing renderer packages.

## Save Modes

### Manual Save

Manual save writes a complete snapshot.

Flow:

1. Validate document.
2. Upload new assets.
3. Write snapshot with current revision.
4. Clear dirty flag.
5. Keep local history.

### Autosave

Autosave writes patches or debounced snapshots.

Rules:

- do not save every pointer move;
- commit transform drag as one transaction;
- debounce patch writes;
- flush on page hide or before unload where supported;
- expose save status to host apps.

### Export

Export writes a portable document package.

Initial export format:

- `document.json`;
- `assets/`;
- optional `manifest.json`.

### Remote Save

Remote save should use a repository interface:

```ts
type SceneRepository = {
  getDocument: (id: string) => Promise<CanvasDocument | null>;
  saveSnapshot: (document: CanvasDocument) => Promise<SaveResult>;
  savePatch: (patch: DocumentPatchRecord) => Promise<SaveResult>;
  listAssets?: (documentId: string) => Promise<AssetRef[]>;
  putAsset?: (asset: AssetUpload) => Promise<AssetRef>;
};
```

Server packages can provide memory, filesystem, object storage, database, or app
framework adapters. Core packages only depend on the interface.

## Revisions and Conflicts

Every document has a monotonically increasing revision.

Save requests should include `baseRevision`.

If the server revision differs from the client base revision:

- simple apps may reject with conflict;
- advanced apps may attempt patch rebase;
- collaborative apps may use a CRDT or operation transform layer.

Conflict result (implemented in `@denovo/canvas-core` as `CanvasSaveResult`;
M6 Phase A settled on this shape):

```ts
type CanvasSaveResult =
  | { ok: true; document: CanvasDocument; revision: number }
  | {
      ok: false;
      reason: "conflict";
      serverRevision: number;
      document?: CanvasDocument;
    }
  | {
      ok: false;
      reason: "validation" | "permission" | "unknown";
      message: string;
    };
```

Note: the earlier `SceneRepository` interface sketched below is folded into
`CanvasStorageAdapter` — snapshot save = `saveDocument`, patch save =
`applyCommands`. There is one transport boundary, not two.

## Migrations

Documents must be versioned from the start.

Rules:

- every persisted document has `schemaVersion`;
- migrations are pure functions;
- migrations run before validation against the current schema;
- migrations are covered by fixtures;
- unsupported future versions fail clearly.

The current migration boundary accepts strict legacy `0.1.0`, adds the
canonical default layer and common node authoring fields, and returns only a
strict `0.2.0` document. It does not inspect time, randomness, renderer state,
or framework state. Later registry work must preserve known string-version
relationships rather than widening `schemaVersion` to an arbitrary string or
number.

## Local Persistence

Recommended local backends:

- `localStorage` for demos only;
- IndexedDB for real local documents and assets;
- Origin Private File System for large local files where supported;
- downloadable packages for export/import.

Local storage should still use the same `SceneRepository` interface.

## Server Persistence

The server package should remain framework-neutral.

Expected adapters:

- memory store for tests;
- filesystem store for local tools;
- object storage asset store;
- SQL document metadata store;
- app-specific API route examples.

Next.js route handlers, Remix loaders/actions, Hono, Express, Fastify, or custom
RPC should wrap the same repository interface.

## TanStack Query Integration

TanStack Query should be an example/integration, not core.

Recommended app-level usage:

- `useQuery` for document load;
- `useMutation` for save snapshot or patch;
- optimistic updates from editor command results;
- invalidate/reconcile after server save.

Core should expose enough events for adapters:

```ts
editor.subscribePersistence((event) => {
  if (event.type === "transaction.committed") {
    savePatchMutation.mutate(event.patchRecord);
  }
});
```

## Persistence Events

Editor core should emit:

- document loaded;
- command applied;
- transaction committed;
- dirty state changed;
- asset referenced;
- asset uploaded;
- save started;
- save succeeded;
- save failed;
- conflict detected.

These events let apps build their own UI without coupling persistence to one
framework.
