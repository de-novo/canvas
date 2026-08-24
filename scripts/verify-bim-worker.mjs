// @ts-check
/**
 * M7 BIM worker parsing verification.
 *
 * Runs the real web-ifc tessellation core through the
 * `@denovo/canvas-worker` queue using an in-process loopback worker, against
 * the playground's sample.ifc. Proves: parse task correctness (typed arrays,
 * metadata, category layers), document assembly via `createWorkerBimAdapter`,
 * maxElements skipping, property-set reads (best-effort contract),
 * explicit failure for non-IFC sources, and multi-model federation
 * (additive load, namespaced ids, model-scoped property reads, unload)
 * and federated origin placement (node.position + camera frame).
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
    assert.equal(bimMeta.modelId, metadata.id);

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
    const refs = nodes.slice(0, 5).map((node) => ({
      expressID: node.metadata.__bim.expressID,
      modelId: node.metadata.__bim.modelId
    }));
    const psets = await adapter.getElementProperties(refs);
    assert.equal(psets.length, 5);

    for (const entry of psets) {
      assert.equal(entry.modelId, metadata.id);
      assert.equal(typeof entry.expressID, "number");
      assert.ok(Array.isArray(entry.psets));
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

// 5. Two staged models federate into one document without id collisions.
{
  const adapter = createWorkerBimAdapter({
    queue: createWorkerTaskQueue({
      createWorker: createBimLoopbackWorker,
      size: 1
    })
  });

  try {
    const alpha = await adapter.loadModel({
      data: sampleData(),
      name: "alpha",
      type: "ifc"
    });
    const beta = await adapter.loadModel({
      data: sampleData(),
      name: "beta",
      type: "ifc"
    });

    assert.equal(alpha.id, "alpha");
    assert.equal(beta.id, "beta");
    assert.equal(adapter.listModels().length, 2);
    assert.deepEqual(
      adapter.listModels().map((model) => model.id),
      ["alpha", "beta"]
    );

    const imported = await adapter.toDocument();
    const nodes = imported.document.scene.nodes;
    const expectedCount = (alpha.elementCount ?? 0) + (beta.elementCount ?? 0);
    assert.equal(nodes.length, expectedCount);
    assert.equal(imported.document.scene.id, "federated-ifc");

    const ids = nodes.map((node) => node.id);
    assert.equal(new Set(ids).size, ids.length, "federated node ids must be unique");

    const alphaNodes = nodes.filter(
      (node) => node.metadata?.__bim?.modelId === "alpha"
    );
    const betaNodes = nodes.filter(
      (node) => node.metadata?.__bim?.modelId === "beta"
    );
    assert.equal(alphaNodes.length, alpha.elementCount);
    assert.equal(betaNodes.length, beta.elementCount);
    assert.match(alphaNodes[0].id, /^ifc-element-alpha-\d+$/);
    assert.match(betaNodes[0].id, /^ifc-element-beta-\d+$/);

    const storeyLayers = imported.document.scene.layers.filter((layer) =>
      /^ifc-storey-/.test(layer.id)
    );
    assert.ok(
      storeyLayers.some((layer) => layer.id.startsWith("ifc-storey-alpha-"))
    );
    assert.ok(
      storeyLayers.some((layer) => layer.id.startsWith("ifc-storey-beta-"))
    );
    assert.ok(storeyLayers.some((layer) => layer.name.startsWith("alpha / ")));
    assert.ok(storeyLayers.some((layer) => layer.name.startsWith("beta / ")));

    const alphaProps = await adapter.getElementProperties([
      {
        expressID: alphaNodes[0].metadata.__bim.expressID,
        modelId: "alpha"
      }
    ]);
    assert.equal(alphaProps.length, 1);
    assert.equal(alphaProps[0].modelId, "alpha");
    assert.ok(Array.isArray(alphaProps[0].psets));

    await adapter.unloadModel("beta");
    assert.equal(adapter.listModels().length, 1);
    assert.equal(adapter.listModels()[0].id, "alpha");

    const remaining = await adapter.toDocument();
    assert.equal(remaining.document.scene.nodes.length, alpha.elementCount);
    assert.match(remaining.document.scene.nodes[0].id, /^ifc-element-\d+$/);
    const remainingStoreys = remaining.document.scene.layers.filter((layer) =>
      /^ifc-storey-\d+$/.test(layer.id)
    );
    assert.ok(remainingStoreys.length > 0);

    await assert.rejects(
      adapter.unloadModel("beta"),
      /unknown model id "beta"/
    );

    check("bim-worker-federates-two-models-without-id-collision", () => {});
  } finally {
    await adapter.dispose();
  }
}

// 6. A federated origin becomes node.position and widens the camera frame.
{
  const adapter = createWorkerBimAdapter({
    queue: createWorkerTaskQueue({
      createWorker: createBimLoopbackWorker,
      size: 1
    })
  });

  try {
    await assert.rejects(
      adapter.loadModel({
        data: sampleData(),
        origin: [Number.NaN, 0, 0],
        type: "ifc"
      }),
      /3-tuple of finite numbers/
    );

    const alpha = await adapter.loadModel({
      data: sampleData(),
      name: "alpha",
      type: "ifc"
    });
    const first = await adapter.toDocument();
    const firstTargetX = first.document.scene.camera.target[0];

    const origin = /** @type {const} */ ([40, 0, 0]);
    const beta = await adapter.loadModel({
      data: sampleData(),
      name: "beta",
      origin,
      type: "ifc"
    });
    assert.deepEqual(beta.origin, origin);

    const imported = await adapter.toDocument();
    const betaNodes = imported.document.scene.nodes.filter(
      (node) => node.metadata?.__bim?.modelId === "beta"
    );
    const alphaNodes = imported.document.scene.nodes.filter(
      (node) => node.metadata?.__bim?.modelId === "alpha"
    );
    assert.equal(alphaNodes.length, alpha.elementCount);
    assert.equal(betaNodes.length, beta.elementCount);

    for (const node of alphaNodes) {
      assert.deepEqual(node.position, [0, 0, 0]);
    }
    for (const node of betaNodes) {
      assert.deepEqual(node.position, origin);
    }

    const targetX = imported.document.scene.camera.target[0];
    assert.ok(
      targetX > firstTargetX,
      `origin must widen the camera frame (first ${firstTargetX}, federated ${targetX})`
    );

    check("bim-worker-federated-origin-offsets-nodes-and-camera", () => {});
  } finally {
    await adapter.dispose();
  }
}

check("bim-worker-suite", () => {});

report({});
