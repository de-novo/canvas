/**
 * M6 Phase A server verification.
 *
 * Exercises the in-memory `CanvasStorageAdapter` end-to-end: save/load
 * round-trip with monotonic revision, optimistic-concurrency conflict
 * detection, list/delete, and deterministic 0.1.0 → 0.2.0 migration on load.
 */

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Installs a global `indexedDB` implementation so the browser-only IndexedDB
// adapter can be exercised in Node alongside the memory/filesystem adapters.
import "fake-indexeddb/auto";

import {
  createMemoryGeometryStore,
  createMeshGeometryAssetRef,
  defineDocument,
  defineMeshGeometry,
  hydrateCanvasGeometryStore,
  parseDocument,
  persistCanvasGeometryStore,
  resolveCanvasMeshGeometry
} from "../packages/core/dist/index.js";
import {
  createCanvasServer,
  createMemoryDocumentAdapter
} from "../packages/server/dist/index.js";
import { createFileSystemDocumentAdapter } from "../packages/server/dist/filesystem.js";
import { createIndexedDbDocumentAdapter } from "../packages/web/dist/indexed-db.js";
import { connectEditorToStorage, createEditor } from "../packages/editor/dist/index.js";
import { createCheckRunner } from "./lib/checks.mjs";

const { check, report } = createCheckRunner();

const baseDocument = {
  id: "doc-1",
  schemaVersion: "0.2.0",
  revision: 0,
  scene: {
    id: "scene-1",
    mode: "3d",
    layers: [{ id: "default", name: "Default" }],
    nodes: [
      {
        id: "box-1",
        layerId: "default",
        type: "box",
        color: "#22c55e",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        visible: true,
        locked: false,
        metadata: {},
        parentId: null
      }
    ]
  },
  metadata: {}
};

function boxNode(id, color, position) {
  return {
    id,
    layerId: "default",
    type: "box",
    color,
    position,
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    visible: true,
    locked: false,
    metadata: {},
    parentId: null
  };
}

function addBoxCommand(id, color, position) {
  return {
    type: "node.add",
    node: boxNode(id, color, position)
  };
}

const checks = [];

// 1. Round-trip with monotonic revision.
{
  const adapter = createMemoryDocumentAdapter();
  const first = await adapter.saveDocument(baseDocument);

  assert.equal(first.ok, true, "first save should succeed");
  if (first.ok) {
    assert.equal(first.revision, 1, "first save should bump revision to 1");
    checks.push("saveDocument bumps revision to 1");
  }

  const loaded = await adapter.loadDocument("doc-1");
  assert.ok(loaded, "loadDocument should return the saved document");
  assert.equal(loaded?.id, "doc-1");
  assert.equal(loaded?.revision, 1, "loaded document should carry revision 1");
  checks.push("loadDocument returns saved document with revision");

  const second = await adapter.saveDocument(loaded);
  assert.equal(second.ok, true);
  if (second.ok) {
    assert.equal(second.revision, 2, "second save should bump revision to 2");
    checks.push("second save bumps revision to 2");
  }
}

// 2. Optimistic-concurrency conflict detection.
{
  const adapter = createMemoryDocumentAdapter();
  const first = await adapter.saveDocument(baseDocument);
  assert.equal(first.ok, true);

  // Stale baseRevision (0) against a server that is already at revision 1.
  const stale = await adapter.saveDocument(baseDocument, {
    baseRevision: 0
  });

  assert.equal(stale.ok, false, "stale baseRevision should conflict");
  if (!stale.ok) {
    assert.equal(stale.reason, "conflict");
    assert.equal(stale.serverRevision, 1);
    checks.push("stale baseRevision returns conflict with serverRevision");
  }

  // Matching baseRevision succeeds.
  const fresh = await adapter.saveDocument(baseDocument, {
    baseRevision: 1
  });
  assert.equal(fresh.ok, true, "matching baseRevision should succeed");
  if (fresh.ok) {
    assert.equal(fresh.revision, 2);
    checks.push("matching baseRevision succeeds and bumps revision");
  }
}

// 3. listDocuments / deleteDocument.
{
  const server = createCanvasServer();
  await server.saveDocument(baseDocument);
  await server.saveDocument({ ...baseDocument, id: "doc-2" });

  const listed = await server.listDocuments();
  assert.equal(listed.length, 2, "listDocuments should return both documents");
  checks.push("listDocuments returns saved documents");

  const deleted = await server.deleteDocument("doc-1");
  assert.equal(deleted, true, "deleteDocument should return true");
  const after = await server.loadDocument("doc-1");
  assert.equal(after, null, "deleted document should load as null");
  checks.push("deleteDocument removes the document");
}

// 4. Deterministic 0.1.0 → 0.2.0 migration on load.
{
  const legacyDocument = {
    id: "legacy-1",
    schemaVersion: "0.1.0",
    scene: {
      id: "legacy-scene",
      nodes: [
        {
          id: "box-legacy",
          type: "box",
          color: "#22c55e",
          position: [0, 0, 0]
        }
      ]
    }
  };

  const migrated = parseDocument(legacyDocument);
  assert.equal(migrated.schemaVersion, "0.2.0", "legacy document migrates to 0.2.0");
  assert.equal(
    migrated.scene.nodes[0]?.layerId,
    "default",
    "migration fills default layerId"
  );
  assert.equal(
    migrated.revision,
    0,
    "migrated document gets default revision 0"
  );
  checks.push("0.1.0 legacy document migrates deterministically to 0.2.0");

  const adapter = createMemoryDocumentAdapter();
  const saved = await adapter.saveDocument(migrated);
  assert.equal(saved.ok, true);
  if (saved.ok) {
    assert.equal(saved.document.schemaVersion, "0.2.0");
    checks.push("migrated document round-trips through the adapter");
  }
}

// 5. Editor → adapter persistence bridge end-to-end.
{
  const adapter = createMemoryDocumentAdapter();
  const editor = createEditor({ document: baseDocument });
  const events = [];
  editor.subscribePersistence((event) => events.push(event));

  const disconnect = connectEditorToStorage(editor, adapter);

  await editor.dispatch(addBoxCommand("box-added", "#ef4444", [2, 0, 0]));

  // Let the synchronous save promise resolve.
  await new Promise((resolve) => setTimeout(resolve, 0));

  const committed = events.filter(
    (event) => event.type === "transaction.committed"
  );
  assert.ok(
    committed.length >= 1,
    "dispatch should emit transaction.committed"
  );
  assert.equal(
    committed[0].revision,
    1,
    "first commit should bump revision to 1"
  );
  checks.push("editor dispatch emits transaction.committed with revision");

  const stored = await adapter.loadDocument("doc-1");
  assert.ok(stored, "bridge should have saved the document");
  assert.equal(stored.revision, 1, "stored document should carry revision 1");
  assert.ok(
    stored.scene.nodes.some((node) => node.id === "box-added"),
    "stored document should contain the added node"
  );
  checks.push("connectEditorToStorage saves the document through the adapter");

  disconnect();
}

// 5b. Conflict does not rebase the editor onto the server document.
{
  const adapter = createMemoryDocumentAdapter();
  const seeded = await adapter.saveDocument(baseDocument);
  assert.equal(seeded.ok, true);

  const editor = createEditor({
    document: seeded.ok ? seeded.document : baseDocument,
    baseRevision: seeded.ok ? seeded.revision : 0
  });
  const conflicts = [];
  const disconnect = connectEditorToStorage(editor, adapter, {
    onConflict(result) {
      conflicts.push(result.serverRevision);
    }
  });

  const external = await adapter.saveDocument(
    {
      ...baseDocument,
      scene: {
        ...baseDocument.scene,
        nodes: [
          ...baseDocument.scene.nodes,
          {
            id: "external-box",
            layerId: "default",
            type: "box",
            color: "#111827",
            position: [9, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            visible: true,
            locked: false,
            metadata: {},
            parentId: null
          }
        ]
      }
    },
    { baseRevision: seeded.ok ? seeded.revision : 0 }
  );
  assert.equal(external.ok, true);

  await editor.dispatch(addBoxCommand("local-box", "#f97316", [3, 0, 0]));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.ok(conflicts.length >= 1, "stale local save should report a conflict");
  const stored = await adapter.loadDocument("doc-1");
  assert.ok(stored);
  assert.ok(
    stored.scene.nodes.some((node) => node.id === "external-box"),
    "server document must keep the external write"
  );
  assert.ok(
    !stored.scene.nodes.some((node) => node.id === "local-box"),
    "conflict must not overwrite the server with the local document"
  );
  assert.ok(
    editor.getState().document.scene.nodes.some((node) => node.id === "local-box"),
    "local editor document stays on the local edit"
  );
  checks.push("connectEditorToStorage conflict does not overwrite the server");

  disconnect();
}

// 6. Filesystem adapter round-trips through real JSON files.
{
  const directory = await mkdtemp(join(tmpdir(), "denovo-fs-"));

  try {
    const adapter = createFileSystemDocumentAdapter({ directory });

    const saved = await adapter.saveDocument(baseDocument);
    assert.equal(saved.ok, true);
    if (saved.ok) {
      assert.equal(saved.revision, 1);
    }

    // It landed on disk as JSON.
    const raw = JSON.parse(await readFile(join(directory, "doc-1.json"), "utf8"));
    assert.equal(raw.id, "doc-1");
    assert.equal(raw.revision, 1);
    checks.push("filesystem adapter writes document JSON to disk");

    const loaded = await adapter.loadDocument("doc-1");
    assert.ok(loaded);
    assert.equal(loaded.revision, 1);
    checks.push("filesystem adapter loads document from disk");

    // Conflict detection via stored revision.
    const conflict = await adapter.saveDocument(baseDocument, {
      baseRevision: 0
    });
    assert.equal(conflict.ok, false);
    if (!conflict.ok) {
      assert.equal(conflict.reason, "conflict");
      assert.equal(conflict.serverRevision, 1);
    }
    checks.push("filesystem adapter detects conflicts via stored revision");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

// 7. Memory applyCommands applies, conflicts, and rejects bad input.
{
  const adapter = createMemoryDocumentAdapter();
  const seeded = await adapter.saveDocument(baseDocument);
  assert.equal(seeded.ok, true);
  assert.equal(typeof adapter.applyCommands, "function");

  const applied = await adapter.applyCommands(
    "doc-1",
    [addBoxCommand("box-applied", "#0ea5e9", [4, 0, 0])],
    { baseRevision: 1 }
  );
  assert.equal(applied.ok, true);
  if (applied.ok) {
    assert.equal(applied.revision, 2);
    assert.ok(
      applied.document.scene.nodes.some((node) => node.id === "box-applied"),
      "applied document should contain the added node"
    );
  }
  checks.push("memory applyCommands applies commands and bumps revision");

  const conflict = await adapter.applyCommands(
    "doc-1",
    [addBoxCommand("box-stale", "#111827", [5, 0, 0])],
    { baseRevision: 1 }
  );
  assert.equal(conflict.ok, false);
  if (!conflict.ok) {
    assert.equal(conflict.reason, "conflict");
    assert.equal(conflict.serverRevision, 2);
  }
  checks.push("memory applyCommands detects stale baseRevision");

  const missing = await adapter.applyCommands("missing-doc", [], {});
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.equal(missing.reason, "unknown");
  }
  checks.push("memory applyCommands rejects a missing document");

  const invalid = await adapter.applyCommands(
    "doc-1",
    [
      {
        type: "node.update",
        nodeId: "missing-node",
        nodeMode: "3d",
        nodeType: "box",
        patch: { color: "#000000" }
      }
    ],
    { baseRevision: 2 }
  );
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.equal(invalid.reason, "validation");
  }
  checks.push("memory applyCommands returns validation on a bad command");
}

// 8. Filesystem applyCommands persists the applied document.
{
  const directory = await mkdtemp(join(tmpdir(), "denovo-fs-apply-"));

  try {
    const adapter = createFileSystemDocumentAdapter({ directory });
    const seeded = await adapter.saveDocument(baseDocument);
    assert.equal(seeded.ok, true);
    assert.equal(typeof adapter.applyCommands, "function");

    const applied = await adapter.applyCommands(
      "doc-1",
      [addBoxCommand("box-fs-applied", "#a855f7", [6, 0, 0])],
      { baseRevision: 1 }
    );
    assert.equal(applied.ok, true);
    if (applied.ok) {
      assert.equal(applied.revision, 2);
    }

    const raw = JSON.parse(await readFile(join(directory, "doc-1.json"), "utf8"));
    assert.equal(raw.revision, 2);
    assert.ok(raw.scene.nodes.some((node) => node.id === "box-fs-applied"));
    checks.push("filesystem applyCommands writes the applied document");

    const conflict = await adapter.applyCommands(
      "doc-1",
      [addBoxCommand("box-fs-stale", "#111827", [7, 0, 0])],
      { baseRevision: 1 }
    );
    assert.equal(conflict.ok, false);
    if (!conflict.ok) {
      assert.equal(conflict.reason, "conflict");
      assert.equal(conflict.serverRevision, 2);
    }
    checks.push("filesystem applyCommands detects stale baseRevision");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

// 9. CanvasServer forwards applyCommands to the adapter.
{
  const server = createCanvasServer();
  const seeded = await server.saveDocument(baseDocument);
  assert.equal(seeded.ok, true);

  const applied = await server.applyCommands(
    "doc-1",
    [addBoxCommand("box-server", "#f43f5e", [8, 0, 0])],
    { baseRevision: 1 }
  );
  assert.equal(applied.ok, true);
  if (applied.ok) {
    assert.ok(
      applied.document.scene.nodes.some((node) => node.id === "box-server")
    );
  }
  checks.push("createCanvasServer.applyCommands forwards to the adapter");
}

// 10. Undo/redo emit history.changed and persist the restored snapshot.
{
  const adapter = createMemoryDocumentAdapter();
  const editor = createEditor({ document: baseDocument });
  const events = [];
  editor.subscribePersistence((event) => events.push(event));

  const disconnect = connectEditorToStorage(editor, adapter);

  await editor.dispatch(addBoxCommand("box-undo", "#22c55e", [1, 0, 0]));
  await new Promise((resolve) => setTimeout(resolve, 0));

  const afterAdd = await adapter.loadDocument("doc-1");
  assert.ok(afterAdd);
  assert.ok(afterAdd.scene.nodes.some((node) => node.id === "box-undo"));

  const undone = await editor.undo();
  assert.ok(undone);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const historyEvents = events.filter((event) => event.type === "history.changed");
  assert.equal(historyEvents.length >= 1, true, "undo should emit history.changed");
  assert.equal(historyEvents[0].action, "undo");
  checks.push("undo emits history.changed");

  const afterUndo = await adapter.loadDocument("doc-1");
  assert.ok(afterUndo);
  assert.equal(
    afterUndo.scene.nodes.some((node) => node.id === "box-undo"),
    false,
    "undone snapshot must be saved"
  );
  checks.push("connectEditorToStorage persists the undone snapshot");

  await editor.redo();
  await new Promise((resolve) => setTimeout(resolve, 0));

  const afterRedo = await adapter.loadDocument("doc-1");
  assert.ok(afterRedo);
  assert.ok(
    afterRedo.scene.nodes.some((node) => node.id === "box-undo"),
    "redone snapshot must be saved"
  );
  assert.ok(
    events.some(
      (event) => event.type === "history.changed" && event.action === "redo"
    ),
    "redo should emit history.changed"
  );
  checks.push("connectEditorToStorage persists the redone snapshot");

  const revisionBefore = afterRedo.revision;
  editor.setBaseRevision(revisionBefore + 10);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const afterRevisionEvent = await adapter.loadDocument("doc-1");
  assert.equal(
    afterRevisionEvent?.revision,
    revisionBefore,
    "revision.changed must not flush another snapshot"
  );
  checks.push("setBaseRevision does not flush a new snapshot");

  disconnect();
}

// 11. Geometry blobs persist through memory and filesystem adapters.
{
  const geometry = defineMeshGeometry({
    schema: "denovo.mesh-geometry.v1",
    positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    indices: [0, 1, 2]
  });
  const asset = createMeshGeometryAssetRef("mesh-geo-1", geometry);
  const document = defineDocument({
    id: "doc-geo",
    assets: [asset],
    scene: {
      id: "geo-scene",
      layers: [{ id: "default", name: "Default" }],
      mode: "3d",
      nodes: [
        {
          color: "#9ca3af",
          geometryAssetId: "mesh-geo-1",
          id: "asset-mesh",
          layerId: "default",
          type: "mesh"
        }
      ]
    }
  });

  async function persistAndReload(adapter) {
    const store = createMemoryGeometryStore();
    store.set("mesh-geo-1", geometry);
    const withBlobs = await persistCanvasGeometryStore(document, store, adapter);
    const saved = await adapter.saveDocument(withBlobs);
    assert.equal(saved.ok, true);
    const loaded = await adapter.loadDocument("doc-geo");
    assert.ok(loaded);
    const rehydrated = createMemoryGeometryStore();
    await hydrateCanvasGeometryStore(loaded, adapter, rehydrated);
    const resolved = resolveCanvasMeshGeometry(
      loaded.scene.nodes[0],
      rehydrated
    );
    assert.deepEqual(resolved?.indices, [0, 1, 2]);
    assert.deepEqual([...resolved.positions], [...geometry.positions]);
    return loaded;
  }

  const memory = createMemoryDocumentAdapter();
  const memoryLoaded = await persistAndReload(memory);
  assert.equal(memoryLoaded.assets[0]?.type, "geometry");
  assert.match(memoryLoaded.assets[0]?.uri ?? "", /^memory:\/\//);
  checks.push("memory uploadAsset persists geometry blobs");

  const missing = await memory.loadAsset("missing-asset");
  assert.equal(missing, null);
  checks.push("memory loadAsset returns null for a missing blob");

  const server = createCanvasServer({ adapter: memory });
  const viaServer = await server.loadAsset("mesh-geo-1");
  assert.ok(viaServer);
  assert.equal(viaServer.asset.id, "mesh-geo-1");
  checks.push("createCanvasServer.loadAsset forwards to the adapter");

  const directory = await mkdtemp(join(tmpdir(), "denovo-fs-assets-"));
  try {
    const filesystem = createFileSystemDocumentAdapter({ directory });
    const fsLoaded = await persistAndReload(filesystem);
    const raw = JSON.parse(
      await readFile(join(directory, "assets", "mesh-geo-1.json"), "utf8")
    );
    assert.equal(raw.id, "mesh-geo-1");
    assert.equal(fsLoaded.assets[0]?.byteLength > 0, true);
    checks.push("filesystem uploadAsset writes geometry blobs beside documents");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

// 12. IndexedDB adapter (via fake-indexeddb) satisfies the same storage
// contract as the memory and filesystem adapters.
{
  const adapter = createIndexedDbDocumentAdapter({
    dbName: "denovo-canvas-verify"
  });

  const missing = await adapter.loadDocument("doc-indexed-missing");
  assert.equal(missing, null);
  checks.push("indexed-db loadDocument returns null for a missing document");

  const saved = await adapter.saveDocument(baseDocument);
  assert.equal(saved.ok, true);
  assert.equal(saved.revision, 1);
  const loaded = await adapter.loadDocument("doc-1");
  assert.ok(loaded);
  assert.equal(loaded.revision, 1);
  checks.push("indexed-db saveDocument persists and bumps revision");

  const conflict = await adapter.saveDocument(
    { ...baseDocument, revision: 1 },
    { baseRevision: 99 }
  );
  assert.equal(conflict.ok, false);
  if (!conflict.ok) {
    assert.equal(conflict.reason, "conflict");
    assert.equal(conflict.serverRevision, 1);
  }
  checks.push("indexed-db detects conflicts via stored revision");

  const applied = await adapter.applyCommands("doc-1", [
    addBoxCommand("box-indexed", "#f97316", [1, 0, 0])
  ]);
  assert.equal(applied.ok, true);
  if (applied.ok) {
    assert.ok(applied.document.scene.nodes.some((node) => node.id === "box-indexed"));
    assert.equal(applied.revision, 2);
  }
  checks.push("indexed-db applyCommands applies commands and bumps revision");

  const stale = await adapter.applyCommands(
    "doc-1",
    [addBoxCommand("box-stale", "#ef4444", [2, 0, 0])],
    { baseRevision: 1 }
  );
  assert.equal(stale.ok, false);
  checks.push("indexed-db applyCommands detects stale baseRevision");

  const listed = await adapter.listDocuments();
  assert.ok(listed.some((summary) => summary.id === "doc-1"));
  assert.equal(await adapter.deleteDocument("doc-1"), true);
  assert.equal(await adapter.loadDocument("doc-1"), null);
  checks.push("indexed-db listDocuments and deleteDocument round-trip");

  const geometry = defineMeshGeometry({
    schema: "denovo.mesh-geometry.v1",
    positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    indices: [0, 1, 2]
  });
  const asset = createMeshGeometryAssetRef("mesh-geo-idb", geometry);
  const geoDocument = defineDocument({
    id: "doc-geo-idb",
    assets: [asset],
    scene: {
      id: "geo-scene-idb",
      layers: [{ id: "default", name: "Default" }],
      mode: "3d",
      nodes: [
        {
          color: "#9ca3af",
          geometryAssetId: "mesh-geo-idb",
          id: "asset-mesh-idb",
          layerId: "default",
          type: "mesh"
        }
      ]
    }
  });
  const blobStore = createMemoryGeometryStore();
  blobStore.set("mesh-geo-idb", geometry);
  const withBlobs = await persistCanvasGeometryStore(
    geoDocument,
    blobStore,
    adapter
  );
  const savedGeo = await adapter.saveDocument(withBlobs);
  assert.equal(savedGeo.ok, true);
  const loadedGeo = await adapter.loadDocument("doc-geo-idb");
  assert.ok(loadedGeo);
  assert.equal(loadedGeo.assets[0]?.type, "geometry");
  const rehydrated = createMemoryGeometryStore();
  await hydrateCanvasGeometryStore(loadedGeo, adapter, rehydrated);
  const resolved = resolveCanvasMeshGeometry(loadedGeo.scene.nodes[0], rehydrated);
  assert.deepEqual(resolved?.indices, [0, 1, 2]);
  assert.deepEqual([...resolved.positions], [...geometry.positions]);
  checks.push("indexed-db uploadAsset/loadAsset persist geometry blobs");
}

// `checks` above records the individual assertions that passed; the runner
// contributes the completion marker and derives `ok` from execution.
check("server-suite", () => {});

report({ assertions: checks });
