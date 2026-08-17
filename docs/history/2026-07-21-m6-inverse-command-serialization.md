# M6 Polish: inverseCommand → DocumentPatchRecord Serialization

**Date:** 2026-07-21  
**Status:** ✅ Complete — M6 fully delivered

## Overview

Implemented serialization of `CanvasCommand` (including the editor's
`inverseCommand`) into `DocumentPatch` / `DocumentPatchRecord` form, so storage
adapters can persist a real, replayable audit log of every patch between
document revisions — including an `inversePatch` that lets a server undo a
rejected patch.

This was the final deliverable for M6 Persistence.

## Problem

Before this slice:

- The editor generated an `inverseCommand` for each committed transaction, but
  nothing turned it into the `inversePatch` field defined on
  `DocumentPatchRecord`.
- The IndexedDB adapter's `applyCommands` wrote a placeholder patch
  (`{ op: "replace", path: ["revision"], value: n+1 }`) that described nothing
  about what the commands actually did.
- A server / offline-replay layer therefore could not reason about rejected
  patches, replay history, or undo — the audit log was effectively empty.

## Solution

### 1. Command serializer in `@denovo/canvas-core`

New module `packages/core/src/serialize.ts`, exported from the core barrel so
every adapter package can use it without depending on the editor.

**Functions:**

| Function | Purpose |
|---|---|
| `serializeCommandToPatch(command)` | One `CanvasCommand` → `DocumentPatch` (JSON-Patch ops) |
| `serializeCommandsToPatch(commands)` | Many commands → merged `DocumentPatch` |
| `serializeInverseCommandToPatch(inverseCommand?)` | Optional inverse → `inversePatch` (or `undefined`) |
| `buildPatchRecord(options)` | Composes a complete `DocumentPatchRecord` |
| `getCommandAffectedNodeIds(command)` | Node ids a command reads/writes |

**Patch semantics** — the patch is a *description* of what a command does to
the document shape, not a diff of two snapshots:

| Command | Op | Path |
|---|---|---|
| `node.add` | `add` | `["scene","nodes",nodeId]` (+ optional `move` for index) |
| `node.remove` | `remove` | `["scene","nodes",nodeId]` |
| `node.update` | `replace` | `["scene","nodes",nodeId]` |
| `layer.add` | `add` | `["scene","layers",index]` |
| `layer.remove` | `remove` | `["scene","layers",layerId]` |
| `layer.update` | `replace` | `["scene","layers",layerId]` |
| `layer.reorder` | `move` | `["scene","layers",index]` |
| `selection.set` | `replace` | `["selection"]` |
| `transaction` | *(flattened)* | all child commands |
| `plugin.*` / unknown | `replace` | `["command",type]` |

A description-based patch is stable across unrelated document state and stays
small — it does not embed the full before/after document.

### 2. Editor re-export

`packages/editor/src/commands/serialize.ts` is now a thin re-export of the
core implementation, so consumers importing from `@denovo/canvas-editor` keep
the same API surface:

```ts
export {
  buildPatchRecord,
  serializeCommandToPatch,
  serializeCommandsToPatch,
  serializeInverseCommandToPatch,
  getCommandAffectedNodeIds,
  type BuildPatchRecordOptions
} from "@denovo/canvas-core";
```

### 3. IndexedDB adapter uses the real patch

`packages/web/src/indexed-db.ts` `applyCommands` now calls `buildPatchRecord`
to write a genuine `DocumentPatchRecord` into the `patches` store, including:

- the real `patch` (serialized commands),
- a `commandType` (`"node.add"`, `"transaction"`, etc.) for quick filtering,
- the document's new revision.

The placeholder patch is gone.

## Why the serializer lives in core

`@denovo/canvas-web` (which owns the IndexedDB adapter) does **not** depend on
`@denovo/canvas-editor`. Putting the serializer in core — which every package
already depends on, and which already owns the `CanvasCommand` /
`DocumentPatchRecord` type definitions — avoids a new dependency edge and a
potential cycle. The editor re-exports it purely for API ergonomics.

## Verification

21/21 runtime assertions pass against the built core (`node test-serialize.mjs`,
since removed), covering every command type, `inversePatch` presence/absence,
and `buildPatchRecord` field composition.

Full workspace build is green: **12/12 packages**, including `tsc
--emitDeclarationOnly` for the core and editor `.d.ts` bundles.

## Usage

### Direct (adapter / server)

```ts
import { buildPatchRecord } from "@denovo/canvas-core";

const record = buildPatchRecord({
  id: `patch-${Date.now()}`,
  documentId: "doc-1",
  baseRevision: 4,
  revision: 5,
  commands,
  inverseCommand,        // optional → becomes inversePatch
  createdAt: new Date().toISOString(),
  actorId: userId,
  commandType: commands[0]?.type
});
// persist `record` as an audit-log entry
```

### Through the IndexedDB adapter

The adapter now writes these records automatically:

```ts
const adapter = createIndexedDbDocumentAdapter();
const result = await adapter.applyCommands("doc-1", commands, { baseRevision: 4 });
// → patches store now holds a real DocumentPatchRecord for this revision
```

## M6 Status

M6 Persistence is now **fully delivered**:

- ✅ Data model (`revision`, `DocumentPatchRecord`, discriminated `CanvasSaveResult`)
- ✅ Editor bridge (`subscribePersistence` + `connectEditorToStorage`)
- ✅ Adapters: memory, filesystem, IndexedDB
- ✅ Facade `storage` option end-to-end
- ✅ Vanilla save demo
- ✅ TanStack Query hooks
- ✅ `applyCommands` / `uploadAsset`
- ✅ `inverseCommand` → `DocumentPatchRecord` serialization

No M6 deliverables remain.
