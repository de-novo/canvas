// @ts-check
/**
 * M7 BIM worker parsing verification.
 *
 * Runs the real web-ifc tessellation core through the
 * `@denovo/canvas-worker` queue using an in-process loopback worker, against
 * the playground's sample.ifc. Proves: parse task correctness (typed arrays,
 * metadata, category layers), document assembly via `createWorkerBimAdapter`,
 * maxElements skipping, property-set reads (best-effort contract), and
 * explicit failure for non-IFC sources.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  createWorkerBimAdapter
} from "../packages/bim/dist/worker-adapter.js";
import {
  createBimWorkerHandler
} from "../packages/bim/dist/web-ifc-worker.js";
import { createWorkerTaskQueue } from "../packages/worker/dist/index.js";
import { resolveCanvasMeshGeometry } from "../packages/core/dist/index.js";
import { createCheckRunner } from "./lib/checks.mjs";

const { check, report } = createCheckRunner();

// Route worker-handler posts back to the most recently created loopback
// worker; every queue in this suite is used sequentially.
let currentEmit = null;
const originalSelf = globalThis.self;
globalThis.self = { postMessage: (message) => currentEmit?.({ data: message }) };

function createLoopbackWorker(handle) {
  const listeners = new Map();
  let terminated = false;

  const emit = (type, event) => {
    for (const listener of [...(listeners.get(type) ?? [])]) {
      listener(event);
    }
  };

  currentEmit = (event) => emit("message", event);

  return {
    addEventListener(type, listener) {
      const list = listeners.get(type) ?? [];
      list.push(listener);
      listeners.set(type, list);
    },
    removeEventListener(type, listener) {
      const list = listeners.get(type) ?? [];
      const index = list.indexOf(listener);

      if (index >= 0) {
        list.splice(index, 1);
      }
    },
    postMessage(message) {
      if (terminated) {
        return;
      }

      Promise.resolve().then(() => {
        if (!terminated) {
          handle(message, (response) => emit("message", { data: response }));
        }
      });
    },
    terminate() {
      terminated = true;
    }
  };
}

const bimHandler = createBimWorkerHandler();

function createBimLoopbackWorker() {
  return createLoopbackWorker((message) => {
    bimHandler({ data: message });
  });
}

const sampleIfc = readFileSync(
  path.resolve(import.meta.dirname, "../apps/playground-bim/public/sample.ifc")
);
const sampleData = () =>
  sampleIfc.buffer.slice(
    sampleIfc.byteOffset,
    sampleIfc.byteOffset + sampleIfc.byteLength
  );

// 1. Full parse through the queue produces typed geometry + provenance.
{
  const adapter = createWorkerBimAdapter({
    queue: createWorkerTaskQueue({
      createWorker: createBimLoopbackWorker,
      size: 1
    })
  });

  try {
    const metadata = await adapter.loadModel({
      data: sampleData(),
      name: "sample-model",
      type: "ifc"
    });

    assert.equal(metadata.sourceType, "ifc");
    assert.equal(metadata.id, "sample-model");
    assert.ok((metadata.elementCount ?? 0) > 0, "sample must yield elements");

    const imported = await adapter.toDocument();
    const nodes = imported.document.scene.nodes;
    assert.equal(nodes.length, metadata.elementCount);

    const first = nodes[0];
    assert.equal(first.type, "mesh");
    assert.match(first.id, /^ifc-element-\d+$/);
    assert.ok(first.geometryAssetId.startsWith("ifc-geometry-"));

    const bimMeta = first.metadata?.__bim;
    assert.ok(bimMeta, "node must carry __bim provenance");
    assert.equal(typeof bimMeta.ifcGuid, "string");
    assert.match(bimMeta.ifcType, /^Ifc/);
    assert.equal(typeof bimMeta.expressID, "number");

    // Geometry resolves from the store with valid triangle data.
    const resolved = resolveCanvasMeshGeometry(first, imported.geometryStore);
    assert.ok(resolved);
    assert.ok(resolved.positions.length >= 9);
    assert.equal(resolved.indices.length % 3, 0);

    // Category layers exist and every node maps to one of them.
    const layerIds = new Set(imported.document.scene.layers.map((l) => l.id));
    for (const node of nodes) {
      assert.ok(layerIds.has(node.layerId));
    }

    // Spatial hierarchy: one layer per building storey; contained elements
    // live on their storey's layer so level isolation is native.
    const layers = imported.document.scene.layers;
    const storeyLayers = layers.filter((layer) =>
      /^ifc-storey-\d+$/.test(layer.id)
    );
    const storeyLayerIds = new Set(storeyLayers.map((layer) => layer.id));
    const meshNodes = nodes.filter((node) => node.type === "mesh");

    assert.ok(
      storeyLayers.length > 0,
      "sample.ifc must contain at least one building storey layer"
    );
    for (const layer of storeyLayers) {
      assert.ok(
        typeof layer.name === "string" && layer.name.length > 0,
        "storey layers carry display names"
      );
    }

    let onStoreyLayer = 0;
    for (const node of meshNodes) {
      if (storeyLayerIds.has(node.layerId)) {
        onStoreyLayer += 1;
      }
    }
    assert.ok(
      onStoreyLayer > 0,
      "sample.ifc elements must be placed on their storey layers"
    );
    console.log(
      `[bim-worker] spatial hierarchy: ${storeyLayers.length} storey layers (${storeyLayers
        .map((layer) => layer.name)
        .join(", ")}), ${onStoreyLayer}/${meshNodes.length} elements on storey layers`
    );

    check("bim-worker-parses-sample-ifc-end-to-end", () => {});

    // 2. Property sets follow the best-effort contract (empty is valid).
    const expressIDs = nodes
      .slice(0, 5)
      .map((node) => node.metadata.__bim.expressID);
    const psets = await adapter.getElementProperties(expressIDs);
    assert.equal(psets.size, 5);

    for (const expressID of expressIDs) {
      assert.ok(Array.isArray(psets.get(expressID)));
    }
    check("bim-worker-property-reads-follow-best-effort-contract", () => {});
  } finally {
    await adapter.dispose();
  }
}

// 3. maxElements skips overflow elements and reports the count.
{
  const adapter = createWorkerBimAdapter({
    maxElements: 3,
    queue: createWorkerTaskQueue({
      createWorker: createBimLoopbackWorker,
      size: 1
    })
  });

  try {
    const metadata = await adapter.loadModel({
      data: sampleData(),
      type: "ifc"
    });
    assert.equal(metadata.elementCount, 3);
    assert.ok(adapter.getSkippedElementCount() > 0);

    const imported = await adapter.toDocument();
    assert.equal(imported.document.scene.nodes.length, 3);
    check("bim-worker-max-elements-skips-and-reports", () => {});
  } finally {
    await adapter.dispose();
  }
}

// 4. Non-IFC sources fail explicitly before any parsing work.
{
  const adapter = createWorkerBimAdapter({
    queue: createWorkerTaskQueue({
      createWorker: createBimLoopbackWorker,
      size: 1
    })
  });

  await assert.rejects(
    adapter.loadModel({ data: new ArrayBuffer(8), type: "xkt" }),
    /only supports IFC/
  );
  check("bim-worker-rejects-non-ifc-sources-explicitly", () => {});
}

check("bim-worker-suite", () => {});

report({});
