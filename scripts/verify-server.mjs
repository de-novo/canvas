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

import { parseDocument } from "../packages/core/dist/index.js";
import {
  createCanvasServer,
  createMemoryDocumentAdapter
} from "../packages/server/dist/index.js";
import { createFileSystemDocumentAdapter } from "../packages/server/dist/filesystem.js";
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

  await editor.dispatch({
    type: "node.add",
    node: {
      id: "box-added",
      layerId: "default",
      type: "box",
      color: "#ef4444",
      position: [2, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      visible: true,
      locked: false,
      metadata: {},
      parentId: null
    }
  });

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

  await editor.dispatch({
    type: "node.add",
    node: {
      id: "local-box",
      layerId: "default",
      type: "box",
      color: "#f97316",
      position: [3, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      visible: true,
      locked: false,
      metadata: {},
      parentId: null
    }
  });
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

// `checks` above records the individual assertions that passed; the runner
// contributes the completion marker and derives `ok` from execution.
check("server-suite", () => {});

report({ assertions: checks });
