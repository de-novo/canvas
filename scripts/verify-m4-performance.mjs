// @ts-check
/**
 * M4 performance API verification.
 *
 * Covers the opt-in LOD render options (schema defaults, validation, JSON
 * round-trip) and the scene chunk loader semantics (chunk boundaries,
 * budget batching, progress reporting, cancellation) with deterministic
 * Node-side fixtures. Browser-side LOD triangle measurements are captured
 * separately and recorded in docs/m4-performance-thresholds.md.
 */

import assert from "node:assert/strict";

import {
  CanvasSceneSchema,
  defineDocument,
  parseDocument
} from "../packages/core/dist/index.js";
import {
  CanvasSceneChunkCancelledError,
  createSceneChunkLoader
} from "../packages/web/dist/index.js";
import { createCheckRunner } from "./lib/checks.mjs";

const { check, report } = createCheckRunner();

function boxNode(id) {
  return {
    color: "#22c55e",
    id,
    layerId: "default",
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    type: "box"
  };
}

function sceneWithNodes(nodeCount) {
  return {
    camera: { position: [3, 2, 6], target: [0, 0, 0], fov: 50 },
    id: "lod-scene",
    layers: [{ id: "default", name: "Default" }],
    mode: "3d",
    nodes: Array.from({ length: nodeCount }, (_, index) => boxNode(`box-${index}`))
  };
}

function burnMs(duration) {
  const end = Date.now() + duration;

  while (Date.now() < end) {
    // Deliberate busy wait so chunk budgets elapse deterministically.
  }
}

// 1. LOD schema defaults stay off and validate explicit input.
{
  const parsed = CanvasSceneSchema.parse(sceneWithNodes(1));
  assert.equal(parsed.render.lod.enabled, false);
  assert.deepEqual(parsed.render.lod.distances, [24, 60]);
  check("render-lod-defaults-to-disabled", () => {});

  const enabled = CanvasSceneSchema.parse({
    ...sceneWithNodes(1),
    render: { lod: { enabled: true, distances: [10, 20] } }
  });
  assert.equal(enabled.render.lod.enabled, true);
  assert.deepEqual(enabled.render.lod.distances, [10, 20]);
  check("render-lod-accepts-explicit-options", () => {});

  assert.throws(() =>
    CanvasSceneSchema.parse({
      ...sceneWithNodes(1),
      render: { lod: { enabled: true, distances: [-1] } }
    })
  );
  assert.throws(() =>
    CanvasSceneSchema.parse({
      ...sceneWithNodes(1),
      render: { lod: { enabled: true, distances: [1, 2, 3] } }
    })
  );
  check("render-lod-rejects-invalid-distances", () => {});
}

// 2. LOD options survive the document JSON round-trip unchanged.
{
  const document = defineDocument({
    id: "lod-document",
    scene: {
      ...sceneWithNodes(1),
      render: { lod: { enabled: true, distances: [12, 48] } }
    }
  });
  const roundTrip = parseDocument(JSON.parse(JSON.stringify(document)));
  assert.equal(roundTrip.scene.render.lod.enabled, true);
  assert.deepEqual(roundTrip.scene.render.lod.distances, [12, 48]);
  const again = parseDocument(JSON.parse(JSON.stringify(roundTrip)));
  assert.deepEqual(again, roundTrip);
  check("render-lod-round-trips-through-document-json", () => {});
}

// 3. Scenes within one chunk commit exactly once.
{
  const updates = [];
  const runtime = { update: (scene) => updates.push(scene) };
  const loader = createSceneChunkLoader(runtime, { chunkSize: 10 });
  const scene = sceneWithNodes(7);

  const result = await loader.load(scene);
  assert.equal(result, scene);
  assert.equal(updates.length, 1);
  assert.equal(updates[0], scene);
  check("chunk-loader-small-scene-commits-once", () => {});
}

// 4. Large scenes apply ordered chunks, then the authoritative full scene.
// Each update burns ~3 ms so the 1 ms budget forces one chunk per slice.
{
  let yieldCount = 0;
  const updates = [];
  const progress = [];
  const runtime = {
    update: (scene) => {
      updates.push(scene.nodes.length);
      burnMs(3);
    }
  };
  const loader = createSceneChunkLoader(runtime, {
    budgetMs: 1,
    chunkSize: 10,
    yieldSlice: () => {
      yieldCount += 1;
      return Promise.resolve();
    }
  });

  const scene = sceneWithNodes(35);
  const result = await loader.load(scene, (event) =>
    progress.push({ ...event })
  );

  assert.equal(result, scene);
  assert.deepEqual(updates, [10, 20, 30, 35]);
  assert.deepEqual(progress, [
    { appliedNodes: 10, totalNodes: 35 },
    { appliedNodes: 20, totalNodes: 35 },
    { appliedNodes: 30, totalNodes: 35 },
    { appliedNodes: 35, totalNodes: 35 }
  ]);
  assert.equal(
    yieldCount,
    3,
    "yields follow each partial slice; none follows the final full coverage"
  );
  check("chunk-loader-applies-ordered-chunks-with-progress", () => {});
}

// 5. Fast chunks batch inside the time budget before yielding.
{
  const updates = [];
  let yieldCount = 0;
  const runtime = { update: (scene) => updates.push(scene.nodes.length) };
  const loader = createSceneChunkLoader(runtime, {
    budgetMs: 5_000,
    chunkSize: 1,
    yieldSlice: () => {
      yieldCount += 1;
      return Promise.resolve();
    }
  });

  await loader.load(sceneWithNodes(50));
  assert.equal(updates.length, 50);
  assert.equal(updates.at(-1), 50);
  assert.equal(
    yieldCount,
    0,
    "a generous budget must batch all chunks into one slice"
  );
  check("chunk-loader-batches-fast-chunks-per-budget", () => {});
}

// 6. Cancellation stops before further slices and reports applied nodes.
{
  const updates = [];
  let firstYield;
  const runtime = {
    update: (scene) => {
      updates.push(scene.nodes.length);
      burnMs(3);
    }
  };
  const loader = createSceneChunkLoader(runtime, {
    budgetMs: 1,
    chunkSize: 10,
    yieldSlice: () =>
      new Promise((resolve) => {
        firstYield = resolve;
      })
  });

  const pending = loader
    .load(sceneWithNodes(40))
    .then(
      () => "resolved",
      (cause) => cause
    );

  // Wait until the first slice is applied and the loader is suspended in
  // its yield, then cancel.
  await new Promise((resolve) => setTimeout(resolve, 0));
  while (!firstYield) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  loader.cancel();
  firstYield();

  const outcome = await pending;
  assert.ok(outcome instanceof CanvasSceneChunkCancelledError);
  assert.equal(outcome.appliedNodes, 10);
  assert.equal(updates.at(-1), 10);
  check("chunk-loader-cancel-stops-before-next-slice", () => {});

  // A fresh load after cancellation works again.
  const recovery = [];
  const recoveringLoader = createSceneChunkLoader(
    { update: (scene) => recovery.push(scene.nodes.length) },
    { chunkSize: 5, yieldSlice: () => Promise.resolve() }
  );
  await recoveringLoader.load(sceneWithNodes(11));
  assert.deepEqual(recovery, [5, 10, 11]);
  check("chunk-loader-recovers-after-cancellation", () => {});
}

// 7. Invalid options fail explicitly.
{
  assert.throws(
    () => createSceneChunkLoader({ update: () => {} }, { chunkSize: 0 }),
    /positive integer/
  );
  assert.throws(
    () => createSceneChunkLoader({ update: () => {} }, { budgetMs: -1 }),
    /positive finite/
  );
  check("chunk-loader-rejects-invalid-options", () => {});
}

check("m4-performance-suite", () => {});

report({});
