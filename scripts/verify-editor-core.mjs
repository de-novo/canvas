import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";

import { createCheckRunner } from "./lib/checks.mjs";

/**
 * This suite threads one editor instance through several hundred sequential
 * assertions, so a failure genuinely invalidates everything after it — the
 * checks are not independent and must not be reported as if they were.
 *
 * What the runner buys here is an honest report: `ok` and the executed-check
 * list are derived from what ran, rather than a hand-maintained array that
 * survived even when its code was deleted.
 */
const { check, report } = createCheckRunner();

const root = path.resolve(import.meta.dirname, "..");
const facade = await import(
  pathToFileURL(path.join(root, "packages/canvas/dist/index.js")).href
);
const editorCore = await import(
  pathToFileURL(path.join(root, "packages/editor/dist/index.js")).href
);

assert.equal(typeof facade.createEditor, "function");
assert.equal(typeof facade.connectEditorToRuntime, "function");
assert.equal(typeof facade.connectEditorToCanvas, "function");
assert.equal(typeof facade.createPanOrbitTool, "function");
assert.equal(typeof facade.createSelectTool, "function");
assert.equal(typeof facade.createTransformTool, "function");
assert.equal(typeof editorCore.applyCommandsToDocument, "function");
assert.equal(typeof facade.applyCommandsToDocument, "function");
assert.equal(typeof editorCore.setLayerVisible, "function");
assert.equal(typeof facade.setLayerVisible, "function");
assert.equal(typeof editorCore.applyNamedOperations, "function");
assert.equal(typeof facade.applyNamedOperations, "function");
assert.equal(typeof editorCore.applyCommandsToStoredDocument, "function");
assert.equal(typeof facade.applyCommandsToStoredDocument, "function");
assert.equal(typeof facade.createMemoryGeometryStore, "function");
assert.equal(typeof facade.defineMeshGeometry, "function");
assert.equal(typeof facade.resolveCanvasMeshGeometry, "function");

const boxUpdateIdentity = { nodeMode: "3d", nodeType: "box" };
const rectUpdateIdentity = { nodeMode: "2d", nodeType: "rect" };
const circleUpdateIdentity = { nodeMode: "2d", nodeType: "circle" };
const group2DUpdateIdentity = { nodeMode: "2d", nodeType: "group" };

function pluginCommand(type, parsePayload = (payload) => payload) {
  return { parsePayload, type };
}

function pointerInput(type, overrides = {}) {
  return {
    altKey: false,
    button: 0,
    buttons: 0,
    ctrlKey: false,
    delta: [0, 0],
    dragging: false,
    isPrimary: true,
    metaKey: false,
    origin: [12, 24],
    point: [12, 24],
    pointerId: 1,
    pointerType: "mouse",
    pressure: 0,
    shiftKey: false,
    type,
    ...overrides
  };
}

function keyInput(type, key, overrides = {}) {
  return {
    altKey: false,
    code: key,
    ctrlKey: false,
    key,
    metaKey: false,
    repeat: false,
    shiftKey: false,
    type,
    ...overrides
  };
}

let tick = 0;
const reportedErrors = [];
const editor = facade.createEditor({
  activeToolId: "select",
  document: {
    id: "editor-document",
    scene: {
      id: "editor-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "3d",
      nodes: [
        {
          id: "box-1",
          layerId: "main",
          type: "box",
          color: "#3b82f6"
        }
      ]
    }
  },
  now: () => `2026-07-11T00:00:${String(tick++).padStart(2, "0")}.000Z`,
  onError: (error) => reportedErrors.push(error),
  tools: [
    facade.createPanOrbitTool(),
    facade.createSelectTool(),
    facade.createTransformTool()
  ]
});

const externalDocument = {
  id: "external-document",
  scene: {
    id: "external-scene",
    layers: [{ id: "main", name: "Main" }],
    mode: "3d",
    nodes: [
      {
        color: "#101010",
        id: "external-box",
        layerId: "main",
        type: "box"
      }
    ]
  }
};
const isolatedEditor = facade.createEditor({ document: externalDocument });
externalDocument.scene.nodes[0].color = "#ffffff";
assert.equal(
  isolatedEditor.getState().document.scene.nodes[0].color,
  "#101010"
);

assert.equal(editor.getState().document.scene.nodes.length, 1);
assert.equal(editor.getState().activeToolId, "select");
assert.equal(editor.getActiveTool()?.id, "select");
assert.equal(editor.getState().history.undoDepth, 0);
assert.equal(Object.isFrozen(editor.getState().document.scene.nodes), true);
assert.throws(() => {
  editor.getState().document.scene.nodes.push({
    id: "illegal-direct-mutation",
    layerId: "main",
    type: "box"
  });
}, TypeError);

const runtimeScenes = [];
const disconnectRuntime = facade.connectEditorToRuntime(editor, {
  update(scene) {
    runtimeScenes.push(scene);
  }
});
assert.equal(runtimeScenes.length, 1);

const changes = [];
const unsubscribe = editor.subscribe((state, change) => {
  changes.push({
    history: state.history,
    type: change.type
  });
});

const runtimeCountBeforeToolInput = runtimeScenes.length;
assert.equal(
  await editor.handleToolInput(pointerInput("pointer.move"), {
    hitTest: () => ({ kind: "node", nodeId: "box-1", renderer: "headless" })
  }),
  true
);
assert.equal(editor.getState().selection.hoveredId, "box-1");
await editor.handleToolInput(pointerInput("pointer.up"), {
  hitTest: () => ({ kind: "node", nodeId: "box-1", renderer: "headless" })
});
assert.deepEqual(editor.getState().selection.ids, ["box-1"]);
await editor.handleToolInput(keyInput("key.down", "Escape"));
assert.deepEqual(editor.getState().selection.ids, []);
await editor.handleToolInput(
  pointerInput("pointer.up", { dragging: true }),
  {
    hitTest: () => ({ kind: "node", nodeId: "box-1", renderer: "headless" })
  }
);
assert.deepEqual(editor.getState().selection.ids, []);
assert.equal(editor.getState().history.undoDepth, 0);
assert.equal(runtimeScenes.length, runtimeCountBeforeToolInput);

const navigationTool = editor.getTools().find((tool) => tool.id === "pan-orbit");
assert.equal(navigationTool?.cursor, "grab");
assert.equal(navigationTool?.navigation, "allow");
editor.activateTool("pan-orbit");
assert.equal(await editor.handleToolInput(pointerInput("pointer.up")), true);
assert.deepEqual(editor.getState().selection.ids, []);
assert.equal(editor.getState().history.undoDepth, 0);
editor.activateTool("select");

await assert.rejects(
  editor.handleToolInput(pointerInput("pointer.up")),
  (error) =>
    error instanceof facade.CanvasEditorError &&
    error.code === "tool-capability-missing"
);
await assert.rejects(
  editor.handleToolInput({ type: "pointer.up", point: [0, 0] }),
  (error) =>
    error instanceof facade.CanvasEditorError &&
    error.code === "invalid-tool-input"
);
assert.throws(
  () => editor.activateTool("missing-tool"),
  (error) =>
    error instanceof facade.CanvasEditorError && error.code === "tool-not-found"
);
assert.throws(
  () =>
    editor.registerTool({
      id: "invalid-navigation",
      label: "Invalid Navigation",
      navigation: "invalid"
    }),
  (error) =>
    error instanceof facade.CanvasEditorError && error.code === "invalid-command"
);

const routedToolInputs = [];
const unregisterInspectTool = editor.registerTool({
  cursor: "help",
  id: "inspect",
  label: "Inspect",
  onInput(input) {
    routedToolInputs.push(input.type);
  }
});
assert.equal(editor.activateTool("inspect")?.cursor, "help");
assert.equal(editor.getState().activeToolId, "inspect");
assert.equal(
  await editor.handleToolInput(pointerInput("pointer.up")),
  true
);
assert.deepEqual(routedToolInputs, ["pointer.up"]);
assert.deepEqual(editor.getState().selection.ids, []);
assert.equal(editor.activateTool(null), null);
assert.equal(await editor.handleToolInput(pointerInput("pointer.up")), false);
editor.activateTool("inspect");
unregisterInspectTool();
assert.equal(editor.getState().activeToolId, null);

const unregisterFailingTool = editor.registerTool({
  id: "failing-tool",
  label: "Failing Tool",
  onInput() {
    throw new Error("tool exploded");
  }
});
editor.activateTool("failing-tool");
await assert.rejects(
  editor.handleToolInput(keyInput("key.down", "F")),
  (error) =>
    error instanceof facade.CanvasEditorError &&
    error.code === "tool-handler-failed" &&
    error.cause instanceof Error
);
unregisterFailingTool();

const serializedToolEvents = [];
const unregisterSerializedTool = editor.registerTool({
  id: "serialized-tool",
  label: "Serialized Tool",
  async onInput(input) {
    const key = "key" in input ? input.key : input.type;
    serializedToolEvents.push(`${key}:start`);
    await Promise.resolve();
    serializedToolEvents.push(`${key}:end`);
  }
});
editor.activateTool("serialized-tool");
await Promise.all([
  editor.handleToolInput(keyInput("key.down", "A")),
  editor.handleToolInput(keyInput("key.down", "B"))
]);
assert.deepEqual(serializedToolEvents, [
  "A:start",
  "A:end",
  "B:start",
  "B:end"
]);
unregisterSerializedTool();
editor.activateTool("select");

const transformPreviews = [];
const transformDispatchCommands = [];
const transformEditor = facade.createEditor({
  activeToolId: "transform",
  document: {
    id: "transform-document",
    scene: {
      id: "transform-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "3d",
      nodes: [
        {
          id: "moving-box",
          layerId: "main",
          type: "box",
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        }
      ]
    }
  },
  tools: [
    facade.createSelectTool(),
    facade.createTransformTool(),
    facade.createTransformTool({ operation: "rotate" }),
    facade.createTransformTool({ operation: "scale" })
  ]
});
transformEditor.subscribe((_state, change) => {
  if (change.type === "dispatch") {
    transformDispatchCommands.push(change.command);
  }
});
const transformRuntime = {
  hitTest: () => ({
    kind: "node",
    nodeId: "moving-box",
    renderer: "headless-transform"
  }),
  nodeTransformKinds: ["translate", "rotate", "scale"],
  resolveNodeTransform(input) {
    assert.equal(input.nodeId, "moving-box");
    assert.equal(input.kind, "translate");
    assert.equal(input.constraint, "free");
    return {
      kind: "translate",
      mode: "3d",
      nodeId: input.nodeId,
      position: [
        input.point[0] - input.origin[0],
        input.point[1] - input.origin[1],
        3
      ]
    };
  },
  setNodeTransformPreview(preview) {
    transformPreviews.push(preview);
  }
};

const transformTool = transformEditor.getActiveTool();
assert.equal(transformTool?.cursor, "move");
assert.equal(transformTool?.navigation, "block");
assert.equal(transformTool?.transform, "translate");
await transformEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1 }),
  transformRuntime
);
await transformEditor.handleToolInput(
  pointerInput("pointer.move", {
    buttons: 1,
    delta: [6, 8],
    dragging: true,
    point: [18, 32]
  }),
  transformRuntime
);
assert.deepEqual(
  transformEditor.getState().document.scene.nodes[0].position,
  [0, 0, 0]
);
assert.equal(transformEditor.getState().history.undoDepth, 0);
assert.deepEqual(transformPreviews.at(-1), {
  kind: "translate",
  mode: "3d",
  nodeId: "moving-box",
  position: [6, 8, 3]
});
await transformEditor.handleToolInput(
  pointerInput("pointer.up", {
    dragging: true,
    point: [18, 32]
  }),
  transformRuntime
);
assert.deepEqual(
  transformEditor.getState().document.scene.nodes[0].position,
  [6, 8, 3]
);
assert.equal(transformEditor.getState().history.undoDepth, 1);
assert.equal(transformPreviews.at(-1), null);
const committedTransformCommand = transformDispatchCommands.at(-1);
assert.equal(committedTransformCommand?.type, "transaction");
assert.equal(committedTransformCommand?.commands[0]?.type, "node.update");
assert.equal(committedTransformCommand?.commands[0]?.nodeMode, "3d");
assert.equal(committedTransformCommand?.commands[0]?.nodeType, "box");
await transformEditor.undo();
assert.deepEqual(
  transformEditor.getState().document.scene.nodes[0].position,
  [0, 0, 0]
);
assert.equal(transformEditor.getState().history.undoDepth, 0);

const constrainedTransformInputs = [];
const constrainedTransformRuntime = {
  hitTest: () => ({
    kind: "handle",
    nodeId: "moving-box",
    renderer: "headless-transform",
    subTarget: "translate.x"
  }),
  nodeTransformKinds: ["translate"],
  resolveNodeTransform(input) {
    constrainedTransformInputs.push(input);
    return {
      kind: "translate",
      mode: "3d",
      nodeId: input.nodeId,
      position: [input.point[0] - input.origin[0], 0, 0]
    };
  },
  setNodeTransformPreview(preview) {
    transformPreviews.push(preview);
  }
};
await transformEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, pointerId: 3 }),
  constrainedTransformRuntime
);
await transformEditor.handleToolInput(
  pointerInput("pointer.move", {
    buttons: 1,
    dragging: true,
    point: [30, 45],
    pointerId: 3
  }),
  constrainedTransformRuntime
);
assert.equal(constrainedTransformInputs.at(-1)?.constraint, "x");
assert.deepEqual(
  transformEditor.getState().document.scene.nodes[0].position,
  [0, 0, 0]
);
await transformEditor.handleToolInput(
  pointerInput("pointer.up", {
    dragging: true,
    point: [30, 45],
    pointerId: 3
  }),
  constrainedTransformRuntime
);
assert.deepEqual(
  transformEditor.getState().document.scene.nodes[0].position,
  [18, 0, 0]
);
assert.equal(transformEditor.getState().history.undoDepth, 1);
await transformEditor.undo();
assert.deepEqual(
  transformEditor.getState().document.scene.nodes[0].position,
  [0, 0, 0]
);

await transformEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, pointerId: 2 }),
  transformRuntime
);
await transformEditor.handleToolInput(
  pointerInput("pointer.move", {
    buttons: 1,
    dragging: true,
    point: [22, 34],
    pointerId: 2
  }),
  transformRuntime
);
await transformEditor.handleToolInput(
  pointerInput("pointer.cancel", { dragging: true, pointerId: 2 }),
  transformRuntime
);
assert.deepEqual(
  transformEditor.getState().document.scene.nodes[0].position,
  [0, 0, 0]
);
assert.equal(transformEditor.getState().history.undoDepth, 0);
assert.equal(transformPreviews.at(-1), null);

transformEditor.activateTool("transform.rotate");
const rotateTool = transformEditor.getActiveTool();
assert.equal(rotateTool?.cursor, "crosshair");
assert.equal(rotateTool?.transform, "rotate");
const rotationInputs = [];
const rotationRuntime = {
  hitTest: () => ({
    kind: "handle",
    nodeId: "moving-box",
    renderer: "headless-transform",
    subTarget: "rotate.z"
  }),
  nodeTransformKinds: ["rotate"],
  resolveNodeTransform(input) {
    rotationInputs.push(input);
    return {
      kind: "rotate",
      mode: "3d",
      nodeId: input.nodeId,
      rotation: [0, 0, 0.75]
    };
  },
  setNodeTransformPreview(preview) {
    transformPreviews.push(preview);
  }
};
await transformEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, pointerId: 4 }),
  rotationRuntime
);
await transformEditor.handleToolInput(
  pointerInput("pointer.move", {
    buttons: 1,
    dragging: true,
    point: [28, 40],
    pointerId: 4
  }),
  rotationRuntime
);
assert.equal(rotationInputs.at(-1)?.kind, "rotate");
assert.equal(rotationInputs.at(-1)?.axis, "z");
assert.deepEqual(
  transformEditor.getState().document.scene.nodes[0].rotation,
  [0, 0, 0]
);
assert.deepEqual(transformEditor.getState().document.scene.nodes[0].scale, [1, 1, 1]);
assert.equal(transformEditor.getState().history.undoDepth, 0);
await transformEditor.handleToolInput(
  pointerInput("pointer.up", { dragging: true, pointerId: 4 }),
  rotationRuntime
);
assert.deepEqual(
  transformEditor.getState().document.scene.nodes[0].rotation,
  [0, 0, 0.75]
);
assert.deepEqual(transformEditor.getState().document.scene.nodes[0].position, [0, 0, 0]);
assert.deepEqual(transformEditor.getState().document.scene.nodes[0].scale, [1, 1, 1]);
assert.equal(transformEditor.getState().history.undoDepth, 1);
assert.equal(transformPreviews.at(-1), null);
await transformEditor.undo();
assert.deepEqual(
  transformEditor.getState().document.scene.nodes[0].rotation,
  [0, 0, 0]
);

transformEditor.activateTool("transform.scale");
const scaleTool = transformEditor.getActiveTool();
assert.equal(scaleTool?.cursor, "nwse-resize");
assert.equal(scaleTool?.transform, "scale");
const scaleInputs = [];
const scaleRuntime = {
  hitTest: () => ({
    kind: "gizmo",
    nodeId: "moving-box",
    renderer: "headless-transform",
    subTarget: "scale.uniform"
  }),
  nodeTransformKinds: ["scale"],
  resolveNodeTransform(input) {
    scaleInputs.push(input);
    return {
      kind: "scale",
      mode: "3d",
      nodeId: input.nodeId,
      scale: [2, 2, 2]
    };
  },
  setNodeTransformPreview(preview) {
    transformPreviews.push(preview);
  }
};
await transformEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, pointerId: 5 }),
  scaleRuntime
);
await transformEditor.handleToolInput(
  pointerInput("pointer.move", {
    buttons: 1,
    dragging: true,
    point: [30, 42],
    pointerId: 5
  }),
  scaleRuntime
);
assert.equal(scaleInputs.at(-1)?.kind, "scale");
assert.equal(scaleInputs.at(-1)?.constraint, "uniform");
assert.deepEqual(transformEditor.getState().document.scene.nodes[0].scale, [1, 1, 1]);
assert.deepEqual(
  transformEditor.getState().document.scene.nodes[0].rotation,
  [0, 0, 0]
);
assert.equal(transformEditor.getState().history.undoDepth, 0);
await transformEditor.handleToolInput(
  pointerInput("pointer.up", { dragging: true, pointerId: 5 }),
  scaleRuntime
);
assert.deepEqual(transformEditor.getState().document.scene.nodes[0].scale, [2, 2, 2]);
assert.deepEqual(transformEditor.getState().document.scene.nodes[0].position, [0, 0, 0]);
assert.deepEqual(
  transformEditor.getState().document.scene.nodes[0].rotation,
  [0, 0, 0]
);
assert.equal(transformEditor.getState().history.undoDepth, 1);
assert.equal(transformPreviews.at(-1), null);
await transformEditor.undo();
assert.deepEqual(transformEditor.getState().document.scene.nodes[0].scale, [1, 1, 1]);

transformEditor.activateTool("transform.rotate");
await assert.rejects(
  transformEditor.handleToolInput(
    pointerInput("pointer.down", { buttons: 1, pointerId: 6 }),
    {
      ...rotationRuntime,
      hitTest: () => ({
        kind: "handle",
        nodeId: "moving-box",
        subTarget: "scale.x"
      })
    }
  ),
  (error) =>
    error instanceof facade.CanvasEditorError &&
    error.code === "tool-handler-failed"
);

transformEditor.activateTool("transform");
await assert.rejects(
  transformEditor.handleToolInput(pointerInput("pointer.down", { buttons: 1 }), {
    hitTest: transformRuntime.hitTest,
    nodeTransformKinds: []
  }),
  (error) =>
    error instanceof facade.CanvasEditorError &&
    error.code === "tool-capability-missing"
);

let resolveDelayedPreview;
let markResolverStarted;
const resolverStarted = new Promise((resolve) => {
  markResolverStarted = resolve;
});
const delayedRuntime = {
  ...transformRuntime,
  resolveNodeTransform(input) {
    markResolverStarted();
    return new Promise((resolve) => {
      resolveDelayedPreview = () =>
        resolve({
          kind: "translate",
          mode: "3d",
          nodeId: input.nodeId,
          position: [4, 5, 6]
        });
    });
  }
};
await transformEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, pointerId: 7 }),
  delayedRuntime
);
const delayedMove = transformEditor.handleToolInput(
  pointerInput("pointer.move", {
    buttons: 1,
    dragging: true,
    pointerId: 7
  }),
  delayedRuntime
);
await resolverStarted;
transformEditor.activateTool("select");
assert.equal(transformPreviews.at(-1), null);
resolveDelayedPreview();
await delayedMove;
transformEditor.activateTool("transform");
await transformEditor.handleToolInput(
  pointerInput("pointer.up", { dragging: true, pointerId: 7 }),
  delayedRuntime
);
assert.deepEqual(transformEditor.getState().document.scene.nodes[0].position, [0, 0, 0]);
assert.equal(transformEditor.getState().history.undoDepth, 0);

const mismatchedPreviewRuntime = {
  hitTest: transformRuntime.hitTest,
  nodeTransformKinds: ["translate"],
  resolveNodeTransform: () => ({
      kind: "scale",
      mode: "3d",
      nodeId: "moving-box",
      scale: [2, 2, 2]
  }),
  setNodeTransformPreview(preview) {
    transformPreviews.push(preview);
  }
};
await transformEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, pointerId: 8 }),
  mismatchedPreviewRuntime
);
await assert.rejects(
  transformEditor.handleToolInput(
    pointerInput("pointer.move", {
      buttons: 1,
      dragging: true,
      pointerId: 8
    }),
    mismatchedPreviewRuntime
  ),
  (error) =>
    error instanceof facade.CanvasEditorError &&
    error.code === "tool-handler-failed"
);
transformEditor.activateTool("select");

const runtimeCountBeforeSelection = runtimeScenes.length;
const selectionResult = await editor.dispatch({
  type: "selection.set",
  selection: {
    hoveredId: "box-1",
    ids: ["box-1"],
    primaryId: "box-1"
  }
});
assert.equal(selectionResult.historyChanged, false);
assert.equal(editor.getState().history.undoDepth, 0);
assert.equal(runtimeScenes.length, runtimeCountBeforeSelection);

const hoverResult = await editor.hoverFromHit({
  kind: "node",
  nodeId: "box-1",
  renderer: "three"
});
assert.equal(hoverResult, null);
assert.equal(editor.getState().selection.hoveredId, "box-1");
const clearHoverResult = await editor.hoverFromHit({
  kind: "empty",
  renderer: "three"
});
assert.equal(clearHoverResult?.historyChanged, false);
assert.equal(editor.getState().selection.hoveredId, null);
const restoreHoverResult = await editor.hoverFromHit({
  kind: "node",
  nodeId: "box-1"
});
assert.equal(restoreHoverResult?.historyChanged, false);

await editor.selectFromHit({ kind: "empty", renderer: "three" });
assert.deepEqual(editor.getState().selection.ids, []);
assert.equal(
  await editor.selectFromHit({ kind: "empty" }, "toggle"),
  null
);
await editor.selectFromHit({ kind: "node", nodeId: "box-1" });
assert.deepEqual(editor.getState().selection.ids, ["box-1"]);
await editor.selectFromHit({ kind: "node", nodeId: "box-1" }, "toggle");
assert.deepEqual(editor.getState().selection.ids, []);
await editor.selectFromHit({ kind: "node", nodeId: "box-1" }, "add");
assert.deepEqual(editor.getState().selection.ids, ["box-1"]);
assert.equal(editor.getState().history.undoDepth, 0);
assert.equal(runtimeScenes.length, runtimeCountBeforeSelection);

await assert.rejects(
  editor.selectFromHit({ kind: "node" }),
  (error) =>
    error instanceof facade.CanvasEditorError &&
    error.code === "invalid-hit-result"
);
await assert.rejects(
  editor.selectFromHit({ kind: "node", nodeId: "missing-node" }),
  (error) =>
    error instanceof facade.CanvasEditorError && error.code === "invalid-selection"
);

const stateBeforeIdentityFailures = JSON.stringify(editor.getState());
const changeCountBeforeIdentityFailures = changes.length;
const runtimeCountBeforeIdentityFailures = runtimeScenes.length;
await assert.rejects(
  editor.dispatch({
    nodeId: "box-1",
    nodeMode: "2d",
    nodeType: "rect",
    patch: { fill: "#010101" },
    type: "node.update"
  }),
  (error) =>
    error instanceof facade.CanvasEditorError && error.code === "mode-mismatch"
);
await assert.rejects(
  editor.dispatch({
    nodeId: "box-1",
    nodeMode: "3d",
    nodeType: "sphere",
    patch: { color: "#020202" },
    type: "node.update"
  }),
  (error) =>
    error instanceof facade.CanvasEditorError && error.code === "invalid-command"
);
await assert.rejects(
  editor.dispatch({
    commands: [
      {
        ...boxUpdateIdentity,
        nodeId: "box-1",
        patch: { color: "#030303" },
        type: "node.update"
      },
      {
        nodeId: "box-1",
        nodeMode: "3d",
        nodeType: "sphere",
        patch: { color: "#040404" },
        type: "node.update"
      }
    ],
    type: "transaction"
  }),
  (error) =>
    error instanceof facade.CanvasEditorError && error.code === "invalid-command"
);
assert.equal(JSON.stringify(editor.getState()), stateBeforeIdentityFailures);
assert.equal(changes.length, changeCountBeforeIdentityFailures);
assert.equal(runtimeScenes.length, runtimeCountBeforeIdentityFailures);

const updateResult = await editor.dispatch({
  ...boxUpdateIdentity,
  label: "Move box",
  type: "node.update",
  nodeId: "box-1",
  patch: {
    position: [2, 1, 0],
    rotation: [0.1, 0.2, 0.3],
    scale: [2, 2, 2]
  }
});
assert.equal(updateResult.historyChanged, true);
assert.deepEqual(editor.getState().document.scene.nodes[0].position, [2, 1, 0]);
assert.deepEqual(editor.getState().document.scene.nodes[0].rotation, [0.1, 0.2, 0.3]);
assert.deepEqual(editor.getState().document.scene.nodes[0].scale, [2, 2, 2]);
assert.equal(editor.getState().history.undoDepth, 1);

const changeCountBeforeTransaction = changes.length;
const runtimeCountBeforeTransaction = runtimeScenes.length;
const transactionResult = await editor.dispatch({
  label: "Add and recolor",
  type: "transaction",
  commands: [
    {
      type: "node.add",
      node: {
        id: "sphere-1",
        layerId: "main",
        type: "sphere",
        color: "#f97316"
      }
    },
    {
      ...boxUpdateIdentity,
      type: "node.update",
      nodeId: "box-1",
      patch: {
        color: "#22c55e"
      }
    }
  ]
});
assert.equal(transactionResult.historyChanged, true);
assert.deepEqual(transactionResult.affectedNodeIds, ["sphere-1", "box-1"]);
assert.equal(editor.getState().document.scene.nodes.length, 2);
assert.equal(editor.getState().history.undoDepth, 2);
assert.equal(changes.length, changeCountBeforeTransaction + 1);
assert.equal(runtimeScenes.length, runtimeCountBeforeTransaction + 1);

await editor.dispatch({
  type: "selection.set",
  selection: {
    hoveredId: "sphere-1",
    ids: ["sphere-1"],
    primaryId: "sphere-1"
  }
});
await editor.dispatch({
  type: "node.remove",
  nodeId: "sphere-1"
});
assert.deepEqual(editor.getState().selection.ids, []);
assert.equal(editor.getState().history.undoDepth, 3);

const undoRemove = await editor.undo();
assert.equal(undoRemove?.command.type, "node.remove");
assert.equal(editor.getState().document.scene.nodes.length, 2);
assert.deepEqual(editor.getState().selection.ids, ["sphere-1"]);
assert.equal(editor.canRedo(), true);

await editor.redo();
assert.equal(editor.getState().document.scene.nodes.length, 1);
assert.deepEqual(editor.getState().selection.ids, []);

await editor.undo();
await editor.undo();
assert.equal(editor.getState().document.scene.nodes.length, 1);
assert.equal(editor.getState().document.scene.nodes[0].color, "#3b82f6");
assert.equal(editor.getState().history.redoDepth, 2);

await editor.dispatch({
  ...boxUpdateIdentity,
  type: "node.update",
  nodeId: "box-1",
  patch: {
    color: "#a855f7"
  }
});
assert.equal(editor.canRedo(), false);
assert.equal(editor.getState().history.redoDepth, 0);

const beforeAtomicFailure = JSON.stringify(editor.getState().document);
const selectionBeforeAtomicFailure = JSON.stringify(editor.getState().selection);
const beforeAtomicDepth = editor.getState().history.undoDepth;
const changeCountBeforeAtomicFailure = changes.length;
const runtimeCountBeforeAtomicFailure = runtimeScenes.length;
await assert.rejects(
  editor.dispatch({
    type: "transaction",
    commands: [
      {
        ...boxUpdateIdentity,
        type: "node.update",
        nodeId: "box-1",
        patch: {
          position: [9, 9, 9]
        }
      },
      {
        type: "node.add",
        node: {
          id: "box-1",
          layerId: "main",
          type: "box"
        }
      }
    ]
  }),
  (error) =>
    error instanceof facade.CanvasEditorError &&
    error.code === "node-already-exists"
);
assert.equal(JSON.stringify(editor.getState().document), beforeAtomicFailure);
assert.equal(JSON.stringify(editor.getState().selection), selectionBeforeAtomicFailure);
assert.equal(editor.getState().history.undoDepth, beforeAtomicDepth);
assert.equal(changes.length, changeCountBeforeAtomicFailure);
assert.equal(runtimeScenes.length, runtimeCountBeforeAtomicFailure);

await assert.rejects(
  editor.dispatch({
    type: "node.add",
    node: {
      id: "wrong-dimension",
      layerId: "main",
      type: "rect"
    }
  }),
  (error) =>
    error instanceof facade.CanvasEditorError && error.code === "invalid-command"
);
await assert.rejects(
  editor.dispatch({
    ...boxUpdateIdentity,
    type: "node.update",
    nodeId: "box-1",
    patch: {
      id: "renamed-box"
    }
  }),
  (error) =>
    error instanceof facade.CanvasEditorError &&
    error.code === "immutable-node-field"
);
for (const invalidCommand of [
  {
    type: "node.add",
    index: -1,
    node: {
      id: "invalid-index",
      layerId: "main",
      type: "box"
    }
  },
  {
    type: "node.add",
    node: {
      id: "unsupported-child",
      layerId: "main",
      parentId: "box-1",
      type: "box"
    }
  },
  {
    ...boxUpdateIdentity,
    type: "node.update",
    nodeId: "box-1",
    patch: {}
  },
  {
    ...boxUpdateIdentity,
    type: "node.update",
    nodeId: "box-1",
    patch: {
      unknownField: true
    }
  },
  {
    ...boxUpdateIdentity,
    type: "node.update",
    nodeId: "box-1",
    patch: {
      color: undefined
    }
  },
  {
    ...boxUpdateIdentity,
    type: "node.update",
    nodeId: "box-1",
    patch: {
      scale: [Number.NaN, 1, 1]
    }
  },
  {
    type: "transaction",
    commands: []
  }
]) {
  await assert.rejects(
    editor.dispatch(invalidCommand),
    (error) =>
      error instanceof facade.CanvasEditorError &&
      error.code === "invalid-command"
  );
}
await assert.rejects(
  editor.dispatch({
    type: "selection.set",
    selection: {
      ids: ["missing-node"],
      primaryId: "missing-node"
    }
  }),
  (error) =>
    error instanceof facade.CanvasEditorError && error.code === "invalid-selection"
);

const registrationFailureState = editor.getState();
for (const invalidType of ["node.update", "plugin."]) {
  assert.throws(
    () =>
      editor.registerCommand(pluginCommand(invalidType), (_command, context) => ({
        document: context.document
      })),
    (error) =>
      error instanceof facade.CanvasEditorError &&
      error.code === "unsupported-command"
  );
}
for (const invalidTool of [
  { id: "", label: "Missing id" },
  { id: "missing-label", label: "" }
]) {
  assert.throws(
    () => editor.registerTool(invalidTool),
    (error) =>
      error instanceof facade.CanvasEditorError && error.code === "invalid-command"
  );
}
assert.deepEqual(editor.getState(), registrationFailureState);

const unregisterPlugin = editor.registerCommand(
  pluginCommand("plugin.rename-document", (payload) => {
    if (typeof payload !== "string") {
      throw new TypeError("rename payload must be a string");
    }

    return payload;
  }),
  async (command, context) => ({
    document: {
      ...context.document,
      title: String(command.payload)
    }
  })
);
assert.throws(
  () =>
    editor.registerCommand(pluginCommand("plugin.rename-document"), () => ({
      document: editor.getState().document
    })),
  (error) =>
    error instanceof facade.CanvasEditorError && error.code === "invalid-command"
);
await editor.dispatch({
  type: "plugin.rename-document",
  payload: "Renamed by plugin"
});
assert.equal(editor.getState().document.title, "Renamed by plugin");
await assert.rejects(
  editor.dispatch({
    type: "plugin.rename-document",
    payload: 42
  }),
  (error) =>
    error instanceof facade.CanvasEditorError &&
    error.code === "invalid-command" &&
    error.cause instanceof TypeError
);
await editor.undo();
assert.equal(editor.getState().document.title, undefined);
await editor.redo();
assert.equal(editor.getState().document.title, "Renamed by plugin");
unregisterPlugin();
await assert.rejects(
  editor.dispatch({
    type: "plugin.rename-document",
    payload: "No handler"
  }),
  (error) =>
    error instanceof facade.CanvasEditorError &&
    error.code === "unsupported-command"
);

const unregisterCleanupCommandA = editor.registerCommand(
  pluginCommand("plugin.cleanup-command"),
  (_command, context) => ({
    document: {
      ...context.document,
      title: "cleanup-a"
    }
  })
);
unregisterCleanupCommandA();
const unregisterCleanupCommandB = editor.registerCommand(
  pluginCommand("plugin.cleanup-command"),
  (_command, context) => ({
    document: {
      ...context.document,
      title: "cleanup-b"
    }
  })
);
unregisterCleanupCommandA();
await editor.dispatch({
  type: "plugin.cleanup-command",
  payload: null
});
assert.equal(editor.getState().document.title, "cleanup-b");
unregisterCleanupCommandB();
unregisterCleanupCommandB();

const unregisterFailingPlugin = editor.registerCommand(
  pluginCommand("plugin.fail"),
  async () => {
    throw new Error("plugin exploded");
  }
);
await assert.rejects(
  editor.dispatch({
    type: "plugin.fail",
    payload: null
  }),
  (error) =>
    error instanceof facade.CanvasEditorError &&
    error.code === "command-handler-failed" &&
    error.cause instanceof Error
);
unregisterFailingPlugin();
await editor.dispatch({
  ...boxUpdateIdentity,
  type: "node.update",
  nodeId: "box-1",
  patch: {
    color: "#bada55"
  }
});
assert.equal(editor.getState().document.scene.nodes[0].color, "#bada55");

const unregisterInvalidPlugin = editor.registerCommand(
  pluginCommand("plugin.invalid-result"),
  (_command, context) => ({
    document: {
      ...context.document,
      scene: {
        ...context.document.scene,
        nodes: [
          ...context.document.scene.nodes,
          {
            id: "invalid-plugin-node",
            layerId: "main",
            type: "rect"
          }
        ]
      }
    }
  })
);
await assert.rejects(
  editor.dispatch({
    type: "plugin.invalid-result",
    payload: null
  }),
  (error) =>
    error instanceof facade.CanvasEditorError &&
    error.code === "invalid-handler-result"
);
unregisterInvalidPlugin();

const unregisterInvalidInversePlugin = editor.registerCommand(
  pluginCommand("plugin.invalid-inverse"),
  (_command, context) => ({
    document: {
      ...context.document,
      title: "Invalid inverse result"
    },
    inverse: {
      type: "not-a-command"
    }
  })
);
await assert.rejects(
  editor.dispatch({
    type: "plugin.invalid-inverse",
    payload: null
  }),
  (error) =>
    error instanceof facade.CanvasEditorError &&
    error.code === "invalid-handler-result"
);
unregisterInvalidInversePlugin();

const unregisterMissingResultPlugin = editor.registerCommand(
  pluginCommand("plugin.missing-result"),
  () => undefined
);
await assert.rejects(
  editor.dispatch({
    type: "plugin.missing-result",
    payload: null
  }),
  (error) =>
    error instanceof facade.CanvasEditorError &&
    error.code === "invalid-handler-result"
);
unregisterMissingResultPlugin();

const unregisterTool = editor.registerTool({
  cursor: "crosshair",
  id: "draw",
  label: "Draw"
});
assert.throws(
  () =>
    editor.registerTool({
      cursor: "wait",
      id: "draw",
      label: "Duplicate Draw"
    }),
  (error) =>
    error instanceof facade.CanvasEditorError && error.code === "invalid-command"
);
assert.deepEqual(
  editor.getTools().map((tool) => tool.id),
  ["pan-orbit", "select", "transform", "draw"]
);
unregisterTool();
const unregisterReplacementTool = editor.registerTool({
  cursor: "cell",
  id: "draw",
  label: "Replacement Draw"
});
unregisterTool();
assert.deepEqual(
  editor.getTools().find((tool) => tool.id === "draw"),
  {
    cursor: "cell",
    id: "draw",
    label: "Replacement Draw"
  }
);
unregisterReplacementTool();
unregisterReplacementTool();
assert.deepEqual(
  editor.getTools().map((tool) => tool.id),
  ["pan-orbit", "select", "transform"]
);

await Promise.all([
  editor.dispatch({
    ...boxUpdateIdentity,
    type: "node.update",
    nodeId: "box-1",
    patch: {
      color: "#111111"
    }
  }),
  editor.dispatch({
    ...boxUpdateIdentity,
    type: "node.update",
    nodeId: "box-1",
    patch: {
      color: "#222222"
    }
  })
]);
assert.equal(editor.getState().document.scene.nodes[0].color, "#222222");

const mutableCommand = {
  ...boxUpdateIdentity,
  type: "node.update",
  nodeId: "box-1",
  patch: {
    color: "#252525"
  }
};
const mutableDispatch = editor.dispatch(mutableCommand);
mutableCommand.patch.color = "#ffffff";
await mutableDispatch;
assert.equal(editor.getState().document.scene.nodes[0].color, "#252525");

let throwFromRuntimeUpdate = false;
const disconnectThrowingRuntime = facade.connectEditorToRuntime(editor, {
  update() {
    if (throwFromRuntimeUpdate) {
      throw new Error("runtime update failed");
    }
  }
});
throwFromRuntimeUpdate = true;
const depthBeforeRuntimeFailure = editor.getState().history.undoDepth;
await editor.dispatch({
  ...boxUpdateIdentity,
  type: "node.update",
  nodeId: "box-1",
  patch: {
    color: "#2f2f2f"
  }
});
assert.equal(editor.getState().history.undoDepth, depthBeforeRuntimeFailure + 1);
assert.equal(reportedErrors.at(-1)?.code, "subscriber-failed");
assert.ok(reportedErrors.at(-1)?.cause instanceof Error);
disconnectThrowingRuntime();

unsubscribe();
disconnectRuntime();
const runtimeCountAfterDisconnect = runtimeScenes.length;
await editor.dispatch({
  ...boxUpdateIdentity,
  type: "node.update",
  nodeId: "box-1",
  patch: {
    color: "#333333"
  }
});
assert.equal(runtimeScenes.length, runtimeCountAfterDisconnect);
assert.ok(changes.length >= 10);

const roundTripEditor = facade.createEditor({
  document: {
    id: "roundtrip-editor-document",
    scene: {
      id: "roundtrip-editor-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: [
        {
          id: "roundtrip-rect",
          layerId: "main",
          type: "rect"
        }
      ]
    }
  },
  now: () => "2026-07-11T01:00:00.000Z"
});

const beforeAdd = JSON.stringify(roundTripEditor.getState().document);
await roundTripEditor.dispatch({
  type: "node.add",
  index: 0,
  node: {
    id: "roundtrip-circle",
    layerId: "main",
    type: "circle"
  }
});
assert.deepEqual(
  roundTripEditor.getState().document.scene.nodes.map((node) => node.id),
  ["roundtrip-circle", "roundtrip-rect"]
);
const afterAdd = JSON.stringify(roundTripEditor.getState().document);
await roundTripEditor.undo();
assert.equal(JSON.stringify(roundTripEditor.getState().document), beforeAdd);
await roundTripEditor.redo();
assert.equal(JSON.stringify(roundTripEditor.getState().document), afterAdd);

const beforeUpdate = JSON.stringify(roundTripEditor.getState().document);
const roundTripUpdateResult = await roundTripEditor.dispatch({
  ...rectUpdateIdentity,
  type: "node.update",
  nodeId: "roundtrip-rect",
  patch: {
    position: [40, 50],
    rotation: 0.5,
    scale: [1.5, 2]
  }
});
assert.equal(roundTripUpdateResult.inverse.nodeMode, "2d");
assert.equal(roundTripUpdateResult.inverse.nodeType, "rect");
assert.deepEqual(
  JSON.parse(JSON.stringify(roundTripUpdateResult.inverse)),
  roundTripUpdateResult.inverse
);
const afterUpdate = JSON.stringify(roundTripEditor.getState().document);
await roundTripEditor.undo();
assert.equal(JSON.stringify(roundTripEditor.getState().document), beforeUpdate);
await roundTripEditor.redo();
assert.equal(JSON.stringify(roundTripEditor.getState().document), afterUpdate);

const beforeRemove = JSON.stringify(roundTripEditor.getState().document);
await roundTripEditor.dispatch({
  type: "node.remove",
  nodeId: "roundtrip-circle"
});
const afterRemove = JSON.stringify(roundTripEditor.getState().document);
await roundTripEditor.undo();
assert.equal(JSON.stringify(roundTripEditor.getState().document), beforeRemove);
await roundTripEditor.redo();
assert.equal(JSON.stringify(roundTripEditor.getState().document), afterRemove);

const emptyHistoryEditor = facade.createEditor({
  document: {
    id: "empty-history-document",
    scene: {
      id: "empty-history-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "3d",
      nodes: []
    }
  }
});
assert.equal(await emptyHistoryEditor.undo(), null);
assert.equal(await emptyHistoryEditor.redo(), null);

const limitedHistoryEditor = facade.createEditor({
  document: {
    id: "limited-history-document",
    scene: {
      id: "limited-history-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "3d",
      nodes: [
        {
          id: "limited-box",
          layerId: "main",
          type: "box"
        }
      ]
    }
  },
  historyLimit: 2,
  now: () => "2026-07-11T02:00:00.000Z"
});
for (const color of ["#111111", "#222222", "#333333"]) {
  await limitedHistoryEditor.dispatch({
    ...boxUpdateIdentity,
    type: "node.update",
    nodeId: "limited-box",
    patch: { color }
  });
}
assert.equal(limitedHistoryEditor.getState().history.undoDepth, 2);
await limitedHistoryEditor.undo();
await limitedHistoryEditor.undo();
assert.equal(limitedHistoryEditor.canUndo(), false);
assert.equal(
  limitedHistoryEditor.getState().document.scene.nodes[0].color,
  "#111111"
);

const brokenClockEditor = facade.createEditor({
  document: {
    id: "broken-clock-document",
    scene: {
      id: "broken-clock-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "3d",
      nodes: []
    }
  },
  now() {
    throw new Error("clock failed");
  }
});
await assert.rejects(
  brokenClockEditor.dispatch({
    type: "node.add",
    node: {
      id: "clock-box",
      layerId: "main",
      type: "box"
    }
  }),
  (error) =>
    error instanceof facade.CanvasEditorError && error.code === "invalid-command"
);

function assertVectorClose(actual, expected, epsilon = 1e-9) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => {
    assert.ok(
      Math.abs(value - expected[index]) <= epsilon,
      `${value} was not within ${epsilon} of ${expected[index]}`
    );
  });
}

const layerEditor = editorCore.createEditor({
  document: {
    id: "layer-document",
    scene: {
      id: "layer-scene",
      layers: [
        { id: "main", name: "Main" },
        { id: "secondary", name: "Secondary" }
      ],
      mode: "2d",
      nodes: [
        {
          id: "layer-rect",
          layerId: "main",
          position: [1, 2],
          size: [3, 4],
          type: "rect"
        }
      ]
    }
  }
});
await layerEditor.dispatch({
  index: 1,
  layer: { id: "draft", name: "Draft" },
  type: "layer.add"
});
assert.deepEqual(
  layerEditor.getState().document.scene.layers.map((layer) => layer.id),
  ["main", "draft", "secondary"]
);
await layerEditor.dispatch({
  layerId: "draft",
  patch: { name: "Working", visible: false },
  type: "layer.update"
});
await layerEditor.dispatch({ layerId: "draft", index: 2, type: "layer.reorder" });
await layerEditor.dispatch({
  layerId: "draft",
  targetLayerId: null,
  type: "layer.remove"
});
assert.equal(layerEditor.getState().history.undoDepth, 4);
await layerEditor.undo();
assert.equal(layerEditor.getState().document.scene.layers[2].id, "draft");
await layerEditor.redo();
await assert.rejects(
  layerEditor.dispatch({
    layerId: "main",
    targetLayerId: null,
    type: "layer.remove"
  }),
  (error) =>
    error instanceof editorCore.CanvasEditorError &&
    error.code === "invalid-command"
);
const layerRemoveResult = await layerEditor.dispatch({
  layerId: "main",
  targetLayerId: "secondary",
  type: "layer.remove"
});
assert.equal(layerRemoveResult.inverse.type, "transaction");
const layerRestoreUpdate = layerRemoveResult.inverse.commands.find(
  (command) => command.type === "node.update"
);
assert.equal(layerRestoreUpdate?.nodeMode, "2d");
assert.equal(layerRestoreUpdate?.nodeType, "rect");
assert.equal(layerEditor.getState().document.scene.nodes[0].layerId, "secondary");
await layerEditor.undo();
assert.equal(layerEditor.getState().document.scene.nodes[0].layerId, "main");

const propertyRect = layerEditor.getState().document.scene.nodes[0];
const preciseUpdate = editorCore.createNodeUpdateCommand(propertyRect, {
  fill: "#abcdef"
});
assert.deepEqual(preciseUpdate.patch, { fill: "#abcdef" });
assert.equal(preciseUpdate.nodeMode, "2d");
assert.equal(preciseUpdate.nodeType, "rect");
assert.throws(
  () => editorCore.createNodeUpdateCommand(propertyRect, { radius: 2 }),
  (error) =>
    error instanceof editorCore.CanvasEditorError &&
    error.code === "invalid-command"
);

const lockingInverseEditor = editorCore.createEditor({
  document: {
    id: "locking-inverse-document",
    scene: {
      id: "locking-inverse-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "3d",
      nodes: [
        {
          color: "#111111",
          id: "locking-box",
          layerId: "main",
          type: "box"
        }
      ]
    }
  }
});
const nodeLockResult = await lockingInverseEditor.dispatch({
  ...boxUpdateIdentity,
  nodeId: "locking-box",
  patch: { color: "#222222", locked: true },
  type: "node.update"
});
assert.equal(nodeLockResult.inverse.type, "transaction");
assert.deepEqual(
  nodeLockResult.inverse.commands.map((command) => ({
    nodeMode: command.nodeMode,
    nodeType: command.nodeType,
    type: command.type
  })),
  [
    { nodeMode: "3d", nodeType: "box", type: "node.update" },
    { nodeMode: "3d", nodeType: "box", type: "node.update" }
  ]
);
await lockingInverseEditor.dispatch(nodeLockResult.inverse);
assert.equal(
  lockingInverseEditor.getState().document.scene.nodes[0].locked,
  false
);
assert.equal(
  lockingInverseEditor.getState().document.scene.nodes[0].color,
  "#111111"
);
const layerLockResult = await lockingInverseEditor.dispatch({
  layerId: "main",
  patch: { locked: true, name: "Locked Main" },
  type: "layer.update"
});
assert.equal(layerLockResult.inverse.type, "transaction");
await lockingInverseEditor.dispatch(layerLockResult.inverse);
assert.equal(
  lockingInverseEditor.getState().document.scene.layers[0].locked,
  false
);
assert.equal(
  lockingInverseEditor.getState().document.scene.layers[0].name,
  "Main"
);

const lockedEditor = editorCore.createEditor({
  document: {
    id: "locked-document",
    scene: {
      id: "locked-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: [
        {
          id: "locked-group",
          layerId: "main",
          locked: true,
          position: [0, 0],
          rotation: 0,
          scale: [1, 1],
          type: "group",
          visible: false
        },
        {
          id: "locked-child",
          layerId: "main",
          parentId: "locked-group",
          type: "circle"
        }
      ]
    }
  }
});
assert.deepEqual(
  editorCore.getEffectiveNodeState(
    lockedEditor.getState().document,
    "locked-child"
  ),
  { locked: true, visible: false }
);
const lockedStateBeforeModeMismatch = JSON.stringify(lockedEditor.getState());
await assert.rejects(
  lockedEditor.dispatch({
    nodeId: "locked-group",
    nodeMode: "3d",
    nodeType: "group",
    patch: { visible: true },
    type: "node.update"
  }),
  (error) =>
    error instanceof editorCore.CanvasEditorError &&
    error.code === "mode-mismatch"
);
assert.equal(JSON.stringify(lockedEditor.getState()), lockedStateBeforeModeMismatch);
await assert.rejects(
  lockedEditor.selectFromHit({
    kind: "node",
    nodeId: "locked-child",
    subTarget: "locked"
  }),
  (error) =>
    error instanceof editorCore.CanvasEditorError &&
    error.code === "locked-target"
);
await assert.rejects(
  lockedEditor.dispatch({
    ...circleUpdateIdentity,
    nodeId: "locked-child",
    patch: { radius: 8 },
    type: "node.update"
  }),
  (error) =>
    error instanceof editorCore.CanvasEditorError &&
    error.code === "locked-target"
);
await lockedEditor.dispatch({
  ...group2DUpdateIdentity,
  nodeId: "locked-group",
  patch: { locked: false },
  type: "node.update"
});
await lockedEditor.dispatch({
  ...group2DUpdateIdentity,
  nodeId: "locked-group",
  patch: { visible: true },
  type: "node.update"
});
await lockedEditor.selectFromHit({ kind: "node", nodeId: "locked-child" });
assert.deepEqual(lockedEditor.getState().selection.ids, ["locked-child"]);
await lockedEditor.dispatch({
  layerId: "main",
  patch: { locked: true },
  type: "layer.update"
});
assert.deepEqual(lockedEditor.getState().selection.ids, []);

const groupingEditor = editorCore.createEditor({
  document: {
    id: "grouping-document",
    scene: {
      id: "grouping-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: [
        {
          id: "group-rect",
          layerId: "main",
          position: [3, 4],
          size: [5, 6],
          type: "rect"
        },
        {
          id: "group-circle",
          layerId: "main",
          position: [1, 0],
          radius: 2,
          type: "circle"
        }
      ]
    }
  }
});
assert.throws(
  () =>
    editorCore.createGroupNodesCommand({
      createId: () => "conflicting-group",
      document: groupingEditor.getState().document,
      groupId: "conflicting-group",
      nodeIds: ["group-rect"]
    }),
  (error) =>
    error instanceof editorCore.CanvasEditorError &&
    error.code === "invalid-command"
);
const groupNodesCommand = editorCore.createGroupNodesCommand({
  document: groupingEditor.getState().document,
  groupId: "group-1",
  nodeIds: ["group-rect", "group-circle"]
});
assert.deepEqual(
  groupNodesCommand.commands
    .filter((command) => command.type === "node.update")
    .map((command) => ({
      nodeMode: command.nodeMode,
      nodeType: command.nodeType
    })),
  [
    { nodeMode: "2d", nodeType: "rect" },
    { nodeMode: "2d", nodeType: "circle" }
  ]
);
await groupingEditor.dispatch(groupNodesCommand);
assert.equal(groupingEditor.getState().history.undoDepth, 1);
assert.ok(
  groupingEditor
    .getState()
    .document.scene.nodes.filter((node) => node.parentId === "group-1").length === 2
);
const groupNode = groupingEditor
  .getState()
  .document.scene.nodes.find((node) => node.id === "group-1");
await groupingEditor.dispatch(
  editorCore.createNodeUpdateCommand(groupNode, {
    position: [10, 20],
    rotation: Math.PI / 2,
    scale: [2, 2]
  })
);
await groupingEditor.dispatch(
  editorCore.createUngroupNodesCommand(
    groupingEditor.getState().document,
    "group-1"
  )
);
const ungroupedRect = groupingEditor
  .getState()
  .document.scene.nodes.find((node) => node.id === "group-rect");
assertVectorClose(ungroupedRect.position, [2, 26]);
assertVectorClose(ungroupedRect.scale, [2, 2]);
assert.ok(Math.abs(ungroupedRect.rotation - Math.PI / 2) <= 1e-9);
assert.equal(groupingEditor.getState().history.undoDepth, 3);

const textGroupEditor = editorCore.createEditor({
  document: {
    id: "text-group-document",
    scene: {
      id: "text-group-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: [
        {
          id: "text-group",
          layerId: "main",
          position: [10, 20],
          rotation: 0,
          scale: [2, 2],
          type: "group"
        },
        {
          id: "grouped-text",
          layerId: "main",
          parentId: "text-group",
          position: [5, 5],
          text: "label",
          type: "text"
        }
      ]
    }
  }
});
await textGroupEditor.dispatch(
  editorCore.createUngroupNodesCommand(
    textGroupEditor.getState().document,
    "text-group"
  )
);
const ungroupedText = textGroupEditor
  .getState()
  .document.scene.nodes.find((node) => node.id === "grouped-text");
assertVectorClose(ungroupedText.position, [20, 30]);
assertVectorClose(ungroupedText.scale, [2, 2]);

const htmlGroupEditor = editorCore.createEditor({
  document: {
    id: "html-group-document",
    scene: {
      id: "html-group-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: [
        {
          id: "html-group",
          layerId: "main",
          position: [10, 20],
          rotation: 0,
          scale: [2, 2],
          type: "group"
        },
        {
          id: "grouped-html",
          layerId: "main",
          parentId: "html-group",
          position: [5, 5],
          html: "<div>Card</div>",
          type: "html"
        }
      ]
    }
  }
});
await htmlGroupEditor.dispatch(
  editorCore.createUngroupNodesCommand(
    htmlGroupEditor.getState().document,
    "html-group"
  )
);
const ungroupedHtml = htmlGroupEditor
  .getState()
  .document.scene.nodes.find((node) => node.id === "grouped-html");
assertVectorClose(ungroupedHtml.position, [20, 30]);
assertVectorClose(ungroupedHtml.scale, [2, 2]);

const meshEditor = editorCore.createEditor({
  document: {
    id: "mesh-update-document",
    scene: {
      id: "mesh-update-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "3d",
      nodes: [
        {
          id: "mesh-1",
          indices: [0, 1, 2],
          layerId: "main",
          positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
          type: "mesh"
        }
      ]
    }
  }
});
const meshNode = meshEditor.getState().document.scene.nodes[0];
await meshEditor.dispatch(
  editorCore.createNodeUpdateCommand(meshNode, {
    position: [4, 5, 6]
  })
);
assert.deepEqual(
  meshEditor.getState().document.scene.nodes[0].position,
  [4, 5, 6]
);

const pasteEditor = editorCore.createEditor({
  document: {
    id: "paste-document",
    scene: {
      id: "paste-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: [
        {
          id: "paste-group",
          layerId: "main",
          position: [0, 0],
          type: "group"
        },
        {
          id: "paste-rect",
          layerId: "main",
          parentId: "paste-group",
          position: [8, 8],
          type: "rect"
        },
        {
          fill: "#38bdf8",
          id: "paste-circle",
          layerId: "main",
          position: [40, 8],
          type: "circle"
        },
        {
          id: "paste-edge",
          layerId: "main",
          sourceId: "paste-rect",
          targetId: "paste-circle",
          type: "edge"
        }
      ]
    }
  }
});
await pasteEditor.dispatch({
  selection: {
    hoveredId: null,
    ids: ["paste-group", "paste-rect", "paste-circle", "paste-edge"],
    primaryId: "paste-group"
  },
  type: "selection.set"
});
pasteEditor.copySelection();
let pasteSerial = 0;
const pastedIds = await pasteEditor.pasteClipboard(
  ({ type }) => `pasted-${type}-${pasteSerial++}`
);
assert.equal(pasteEditor.getState().history.undoDepth, 1);
const pasted = pasteEditor
  .getState()
  .document.scene.nodes.filter((node) => pastedIds.includes(node.id));
const pastedGroup = pasted.find((node) => node.type === "group");
const pastedRect = pasted.find((node) => node.type === "rect");
const pastedCircle = pasted.find((node) => node.type === "circle");
const pastedEdge = pasted.find((node) => node.type === "edge");
assert.equal(pastedRect.parentId, pastedGroup.id);
assert.equal(pastedEdge.sourceId, pastedRect.id);
assert.equal(pastedEdge.targetId, pastedCircle.id);
await pasteEditor.undo();
assert.equal(pasteEditor.getState().document.scene.nodes.length, 4);

const deleteEditor = editorCore.createEditor({
  document: {
    id: "delete-document",
    scene: {
      id: "delete-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: [
        {
          id: "keep-rect",
          layerId: "main",
          position: [0, 0],
          type: "rect"
        },
        {
          id: "drop-rect",
          layerId: "main",
          position: [80, 0],
          type: "rect"
        },
        {
          id: "drop-edge",
          layerId: "main",
          sourceId: "keep-rect",
          targetId: "drop-rect",
          type: "edge"
        }
      ]
    }
  },
  tools: [editorCore.createSelectTool()]
});
deleteEditor.activateTool("select");
await deleteEditor.dispatch({
  selection: {
    hoveredId: null,
    ids: ["drop-rect"],
    primaryId: "drop-rect"
  },
  type: "selection.set"
});
assert.equal(
  await deleteEditor.handleToolInput(keyInput("key.down", "Delete")),
  true
);
assert.deepEqual(
  deleteEditor.getState().document.scene.nodes.map((node) => node.id),
  ["keep-rect"]
);
assert.equal(deleteEditor.getState().history.undoDepth, 1);
await deleteEditor.undo();
assert.equal(deleteEditor.getState().document.scene.nodes.length, 3);

const connectorTool = editorCore.createConnectorTool({
  createId: () => "connected-edge",
  layerId: "main",
  mode: "2d"
});
const connectorEditor = editorCore.createEditor({
  activeToolId: connectorTool.id,
  document: {
    id: "connector-document",
    scene: {
      id: "connector-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: [
        { id: "source-rect", layerId: "main", position: [0, 0], type: "rect" },
        { id: "target-rect", layerId: "main", position: [80, 0], type: "rect" }
      ]
    }
  },
  tools: [connectorTool]
});
const connectorRuntime = {
  resolveScenePoint(request) {
    return { mode: "2d", position: request.viewportPoint };
  },
  async hitTest(input) {
    if (input.point[0] < 40) {
      return {
        kind: "node",
        nodeId: "source-rect",
        renderer: "test",
        subTarget: "handle.right"
      };
    }
    return {
      kind: "node",
      nodeId: "target-rect",
      renderer: "test",
      subTarget: "handle.left"
    };
  },
  setAuthoringPreviews() {}
};
await connectorEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, point: [10, 10] }),
  connectorRuntime
);
await connectorEditor.handleToolInput(
  pointerInput("pointer.move", { buttons: 1, dragging: true, point: [90, 10] }),
  connectorRuntime
);
await connectorEditor.handleToolInput(
  pointerInput("pointer.up", { dragging: true, point: [90, 10] }),
  connectorRuntime
);
const connected = connectorEditor
  .getState()
  .document.scene.nodes.find((node) => node.type === "edge");
assert.equal(connected.id, "connected-edge");
assert.equal(connected.sourceId, "source-rect");
assert.equal(connected.targetId, "target-rect");
assert.equal(connected.sourcePort, "right");
assert.equal(connected.targetPort, "left");
assert.equal(connected.routing, "straight");
assert.notEqual(connected.routing, "curved");
assert.equal(connectorEditor.getState().history.undoDepth, 1);
await connectorEditor.undo();
assert.equal(
  connectorEditor.getState().document.scene.nodes.filter((node) => node.type === "edge")
    .length,
  0
);

const appliedDocument = await editorCore.applyCommandsToDocument(
  meshEditor.getState().document,
  [
    {
      nodeId: "mesh-1",
      nodeMode: "3d",
      nodeType: "mesh",
      patch: { color: "#ff0000" },
      type: "node.update"
    }
  ]
);
assert.equal(
  appliedDocument.scene.nodes.find((node) => node.id === "mesh-1").color,
  "#ff0000"
);

const storedApplied = await editorCore.applyCommandsToStoredDocument(
  {
    document: meshEditor.getState().document,
    revision: 4
  },
  meshEditor.getState().document.id,
  [
    {
      nodeId: "mesh-1",
      nodeMode: "3d",
      nodeType: "mesh",
      patch: { color: "#00ff00" },
      type: "node.update"
    }
  ],
  { baseRevision: 4 }
);
assert.equal(storedApplied.ok, true);
if (storedApplied.ok) {
  assert.equal(storedApplied.revision, 5);
  assert.equal(
    storedApplied.document.scene.nodes.find((node) => node.id === "mesh-1").color,
    "#00ff00"
  );
}

const storedMissing = await editorCore.applyCommandsToStoredDocument(
  null,
  "missing-document",
  []
);
assert.equal(storedMissing.ok, false);
if (!storedMissing.ok) {
  assert.equal(storedMissing.reason, "unknown");
}

const storedConflict = await editorCore.applyCommandsToStoredDocument(
  {
    document: meshEditor.getState().document,
    revision: 4
  },
  meshEditor.getState().document.id,
  [],
  { baseRevision: 3 }
);
assert.equal(storedConflict.ok, false);
if (!storedConflict.ok) {
  assert.equal(storedConflict.reason, "conflict");
  assert.equal(storedConflict.serverRevision, 4);
}

const storedInvalid = await editorCore.applyCommandsToStoredDocument(
  {
    document: meshEditor.getState().document,
    revision: 4
  },
  meshEditor.getState().document.id,
  [
    {
      nodeId: "missing-mesh",
      nodeMode: "3d",
      nodeType: "mesh",
      patch: { color: "#000000" },
      type: "node.update"
    }
  ],
  { baseRevision: 4 }
);
assert.equal(storedInvalid.ok, false);
if (!storedInvalid.ok) {
  assert.equal(storedInvalid.reason, "validation");
}

const group3DEditor = editorCore.createEditor({
  document: {
    id: "group-3d-document",
    scene: {
      id: "group-3d-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "3d",
      nodes: [
        {
          id: "group-3d",
          layerId: "main",
          position: [10, 0, 0],
          rotation: [0, 0, Math.PI / 2],
          scale: [2, 2, 2],
          type: "group"
        },
        {
          id: "child-3d",
          layerId: "main",
          parentId: "group-3d",
          position: [1, 0, 0],
          type: "box"
        }
      ]
    }
  }
});
await assert.rejects(
  group3DEditor.dispatch({ nodeId: "group-3d", type: "node.remove" }),
  (error) =>
    error instanceof editorCore.CanvasEditorError &&
    error.code === "invalid-command"
);
await group3DEditor.dispatch(
  editorCore.createUngroupNodesCommand(
    group3DEditor.getState().document,
    "group-3d"
  )
);
const child3D = group3DEditor.getState().document.scene.nodes[0];
assertVectorClose(child3D.position, [10, 2, 0]);
assertVectorClose(child3D.scale, [2, 2, 2]);
assertVectorClose(child3D.rotation, [0, 0, Math.PI / 2]);

assert.deepEqual(
  editorCore.snapPointToGrid({
    grid: { mode: "2d", origin: [1, 1], spacing: [2, 3] },
    kind: "grid",
    mode: "2d",
    position: [4.2, 5.8]
  }).position,
  [5, 7]
);
const diagonal = Math.SQRT1_2;
const snapped3D = editorCore.snapPointToGrid({
  grid: {
    axisU: [2, 0, 0],
    axisV: [2, 2, 0],
    mode: "3d",
    origin: [0, 0, 0],
    spacing: [2, 1]
  },
  kind: "grid",
  mode: "3d",
  position: [2.2 + 1.3 * diagonal, 1.3 * diagonal, 0]
});
assertVectorClose(snapped3D.position, [2 + diagonal, diagonal, 0]);
assert.throws(
  () =>
    editorCore.snapPointToGrid({
      grid: { mode: "2d", origin: [0, 0], spacing: [1, 1] },
      kind: "guide",
      mode: "2d",
      position: [0, 0]
    }),
  (error) =>
    error instanceof editorCore.CanvasEditorError &&
    error.code === "invalid-command"
);

const authoringPreviews = [];
const rectTool = editorCore.create2DShapeTool({
  createId: () => "authored-rect",
  layerId: "main",
  mode: "2d",
  type: "rect"
});
const shapeEditor = editorCore.createEditor({
  activeToolId: rectTool.id,
  document: {
    id: "shape-document",
    scene: {
      id: "shape-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: []
    }
  },
  tools: [rectTool]
});
const shapeRuntime = {
  resolveScenePoint(request) {
    return { mode: "2d", position: request.viewportPoint };
  },
  setAuthoringPreviews(previews) {
    authoringPreviews.push(previews);
  }
};
await shapeEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, point: [10, 10] }),
  shapeRuntime
);
await shapeEditor.handleToolInput(
  pointerInput("pointer.move", {
    buttons: 1,
    dragging: true,
    point: [2, 4]
  }),
  shapeRuntime
);
await shapeEditor.handleToolInput(
  pointerInput("pointer.up", { dragging: true, point: [2, 4] }),
  shapeRuntime
);
assert.deepEqual(shapeEditor.getState().document.scene.nodes[0].position, [2, 4]);
assert.deepEqual(shapeEditor.getState().document.scene.nodes[0].size, [8, 6]);
assert.equal(shapeEditor.getState().history.undoDepth, 1);
assert.deepEqual(authoringPreviews.at(-1), []);

let cancellationId = 0;
const cancellationTool = editorCore.create2DShapeTool({
  createId: () => `cancel-shape-${++cancellationId}`,
  layerId: "main",
  mode: "2d",
  type: "circle"
});
const cancellationPreviews = [];
const cancellationEditor = editorCore.createEditor({
  activeToolId: cancellationTool.id,
  document: {
    id: "cancellation-document",
    scene: {
      id: "cancellation-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: []
    }
  },
  tools: [cancellationTool, editorCore.createSelectTool()]
});
const cancellationRuntime = {
  ...shapeRuntime,
  setAuthoringPreviews(previews) {
    cancellationPreviews.push(previews);
  }
};
await cancellationEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, point: [1, 1] }),
  cancellationRuntime
);
await cancellationEditor.handleToolInput(
  pointerInput("pointer.cancel", { point: [4, 1] }),
  cancellationRuntime
);
assert.equal(cancellationEditor.getState().history.undoDepth, 0);
assert.deepEqual(cancellationPreviews.at(-1), []);
await cancellationEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, point: [2, 2] }),
  cancellationRuntime
);
await cancellationEditor.handleToolInput(
  pointerInput("pointer.up", { point: [2, 2] }),
  cancellationRuntime
);
assert.equal(cancellationEditor.getState().document.scene.nodes.length, 0);
assert.equal(cancellationEditor.getState().history.undoDepth, 0);
await cancellationEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, point: [3, 3] }),
  cancellationRuntime
);
cancellationEditor.activateTool("select");
assert.deepEqual(cancellationPreviews.at(-1), []);
assert.equal(cancellationEditor.getState().history.undoDepth, 0);

const primitiveTool = editorCore.create3DPrimitiveTool({
  createId: () => "authored-box",
  grid: {
    axisU: [2, 0, 0],
    axisV: [0, 0, 3],
    mode: "3d",
    origin: [0, 0, 0],
    spacing: [1, 2]
  },
  layerId: "main",
  mode: "3d",
  type: "box",
  workPlane: { constant: 0, normal: [0, 1, 0] }
});
const primitiveEditor = editorCore.createEditor({
  activeToolId: primitiveTool.id,
  document: {
    id: "primitive-document",
    scene: {
      id: "primitive-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "3d",
      nodes: []
    }
  },
  tools: [primitiveTool]
});
const primitivePreviews = [];
const primitiveRuntime = {
  resolveScenePoint(request) {
    return {
      mode: "3d",
      position: [request.viewportPoint[0], 0, request.viewportPoint[1]]
    };
  },
  setAuthoringPreviews(previews) {
    primitivePreviews.push(previews);
  }
};
await primitiveEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, point: [1.4, 3.2] }),
  primitiveRuntime
);
await primitiveEditor.handleToolInput(
  pointerInput("pointer.up", { point: [1.4, 3.2] }),
  primitiveRuntime
);
assertVectorClose(
  primitiveEditor.getState().document.scene.nodes[0].position,
  [1, 0, 4]
);
assert.equal(primitiveEditor.getState().history.undoDepth, 1);
assert.deepEqual(primitivePreviews.at(-1), []);

let surfacePlacementIdCalls = 0;
const surfacePlacementPreviews = [];
const surfacePlacementTool = editorCore.create3DSurfacePlacementTool({
  color: "#22d3ee",
  createId: () => `surface-box-${++surfacePlacementIdCalls}`,
  id: "plugin.editor.tool.surface-box",
  layerId: "main",
  mode: "3d",
  placement: { kind: "box-face", orientation: "world-aligned" },
  scale: [2, 4, 6],
  type: "box"
});
const surfacePlacementEditor = editorCore.createEditor({
  activeToolId: surfacePlacementTool.id,
  document: {
    id: "surface-placement-document",
    scene: {
      id: "surface-placement-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "3d",
      nodes: [
        {
          id: "surface-target",
          layerId: "main",
          position: [2, 3, 4],
          rotation: [0, 0, 0],
          scale: [4, 2, 6],
          type: "box"
        }
      ]
    }
  },
  tools: [surfacePlacementTool]
});

function boxSurfaceHit(axis, side, point, normal) {
  return {
    feature: { axis, kind: "box.face", side },
    kind: "hit",
    mode: "3d",
    nodeId: "surface-target",
    nodeType: "box",
    normal,
    point
  };
}

let surfacePlacementResult = boxSurfaceHit(
  "y",
  1,
  [2, 4, 4],
  [0, 1, 0]
);
const surfacePlacementRuntime = {
  resolveSurfacePoint(request) {
    assert.deepEqual(request.target, { kind: "node", nodeType: "box" });
    assert.equal(request.mode, "3d");
    return surfacePlacementResult;
  },
  setAuthoringPreviews(previews) {
    surfacePlacementPreviews.push(previews);
  }
};

await surfacePlacementEditor.handleToolInput(
  pointerInput("pointer.move", {
    buttons: 0,
    point: [30, 40],
    pointerType: "mouse"
  }),
  surfacePlacementRuntime
);
assert.equal(surfacePlacementIdCalls, 0);
assert.equal(surfacePlacementEditor.getState().document.scene.nodes.length, 1);
assert.equal(surfacePlacementEditor.getState().history.undoDepth, 0);
const firstSurfaceGhost = surfacePlacementPreviews.at(-1)?.[0];
assert.equal(firstSurfaceGhost?.kind, "primitive.ghost");
assert.deepEqual(firstSurfaceGhost?.primitive.position, [2, 6, 4]);
assert.deepEqual(firstSurfaceGhost?.primitive.rotation, [0, 0, 0]);
assert.deepEqual(firstSurfaceGhost?.primitive.scale, [2, 4, 6]);

await surfacePlacementEditor.handleToolInput(
  pointerInput("pointer.down", {
    buttons: 1,
    point: [30, 40]
  }),
  surfacePlacementRuntime
);
assert.equal(surfacePlacementIdCalls, 0);
surfacePlacementResult = boxSurfaceHit(
  "x",
  1,
  [4, 3, 4],
  [1, 0, 0]
);
await surfacePlacementEditor.handleToolInput(
  pointerInput("pointer.up", { point: [35, 40] }),
  surfacePlacementRuntime
);
assert.equal(surfacePlacementIdCalls, 1);
assert.equal(surfacePlacementEditor.getState().history.undoDepth, 1);
const firstSurfaceBox = surfacePlacementEditor
  .getState()
  .document.scene.nodes.find((node) => node.id === "surface-box-1");
assert.equal(firstSurfaceBox?.type, "box");
assert.deepEqual(firstSurfaceBox?.position, [5, 3, 4]);
assert.deepEqual(firstSurfaceBox?.rotation, [0, 0, 0]);
assert.deepEqual(firstSurfaceBox?.scale, [2, 4, 6]);
assert.deepEqual(surfacePlacementPreviews.at(-1), []);

surfacePlacementResult = boxSurfaceHit(
  "z",
  -1,
  [2, 3, 1],
  [0, 0, -1]
);
await surfacePlacementEditor.handleToolInput(
  pointerInput("pointer.down", {
    buttons: 1,
    pointerId: 2,
    pointerType: "touch",
    pressure: 1,
    point: [42, 46]
  }),
  surfacePlacementRuntime
);
assert.equal(surfacePlacementIdCalls, 1);
await surfacePlacementEditor.handleToolInput(
  pointerInput("pointer.up", {
    pointerId: 2,
    pointerType: "touch",
    point: [42, 46]
  }),
  surfacePlacementRuntime
);
assert.equal(surfacePlacementIdCalls, 2);
assert.equal(surfacePlacementEditor.getState().history.undoDepth, 2);
const secondSurfaceBox = surfacePlacementEditor
  .getState()
  .document.scene.nodes.find((node) => node.id === "surface-box-2");
assert.deepEqual(secondSurfaceBox?.position, [2, 3, -2]);

surfacePlacementResult = { kind: "miss", mode: "3d" };
await surfacePlacementEditor.handleToolInput(
  pointerInput("pointer.move", { point: [80, 80] }),
  surfacePlacementRuntime
);
assert.deepEqual(surfacePlacementPreviews.at(-1), []);
await surfacePlacementEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, point: [80, 80] }),
  surfacePlacementRuntime
);
await surfacePlacementEditor.handleToolInput(
  pointerInput("pointer.up", { point: [80, 80] }),
  surfacePlacementRuntime
);
assert.equal(surfacePlacementIdCalls, 2);
assert.equal(surfacePlacementEditor.getState().document.scene.nodes.length, 3);
assert.equal(surfacePlacementEditor.getState().history.undoDepth, 2);

const surfaceDiagonal = Math.SQRT1_2;
surfacePlacementResult = boxSurfaceHit(
  "x",
  1,
  [4, 3, 4],
  [surfaceDiagonal, surfaceDiagonal, 0]
);
await assert.rejects(
  surfacePlacementEditor.handleToolInput(
    pointerInput("pointer.move", { point: [44, 44] }),
    surfacePlacementRuntime
  ),
  (error) =>
    error instanceof editorCore.CanvasEditorError &&
    error.code === "invalid-hit-result"
);
assert.equal(surfacePlacementIdCalls, 2);
assert.equal(surfacePlacementEditor.getState().history.undoDepth, 2);
assert.deepEqual(surfacePlacementPreviews.at(-1), []);

await assert.rejects(
  surfacePlacementEditor.handleToolInput(
    pointerInput("pointer.move", { point: [50, 50] }),
    {
      setAuthoringPreviews() {}
    }
  ),
  (error) =>
    error instanceof editorCore.CanvasEditorError &&
    error.code === "tool-capability-missing"
);
assert.equal(surfacePlacementIdCalls, 2);

surfacePlacementResult = boxSurfaceHit(
  "y",
  1,
  [2, 4, 4],
  [0, 1, 0]
);
const replacementSurfacePreviews = [];
await surfacePlacementEditor.handleToolInput(
  pointerInput("pointer.move", { point: [52, 52] }),
  surfacePlacementRuntime
);
const replacementSurfaceRuntime = {
  resolveSurfacePoint() {
    return { kind: "miss", mode: "3d" };
  },
  setAuthoringPreviews(previews) {
    replacementSurfacePreviews.push(previews);
  }
};
await surfacePlacementEditor.handleToolInput(
  pointerInput("pointer.move", { point: [53, 53] }),
  replacementSurfaceRuntime
);
assert.deepEqual(surfacePlacementPreviews.at(-1), []);
assert.deepEqual(replacementSurfacePreviews.at(-1), []);
assert.equal(surfacePlacementIdCalls, 2);
await surfacePlacementEditor.handleToolInput(
  keyInput("key.down", "Escape"),
  replacementSurfaceRuntime
);
assert.deepEqual(replacementSurfacePreviews.at(-1), []);

let resolveDelayedSurfacePoint;
let markDelayedSurfaceStarted;
const delayedSurfaceStarted = new Promise((resolve) => {
  markDelayedSurfaceStarted = resolve;
});
const delayedSurfacePreviews = [];
const delayedSurfaceRuntime = {
  resolveSurfacePoint() {
    markDelayedSurfaceStarted();
    return new Promise((resolve) => {
      resolveDelayedSurfacePoint = resolve;
    });
  },
  setAuthoringPreviews(previews) {
    delayedSurfacePreviews.push(previews);
  }
};
const delayedSurfaceHover = surfacePlacementEditor.handleToolInput(
  pointerInput("pointer.move", { point: [54, 54] }),
  delayedSurfaceRuntime
);
await delayedSurfaceStarted;
await surfacePlacementEditor.cancelActiveToolSession();
resolveDelayedSurfacePoint(
  boxSurfaceHit("y", 1, [2, 4, 4], [0, 1, 0])
);
await delayedSurfaceHover;
assert.deepEqual(delayedSurfacePreviews.at(-1), []);
assert.equal(surfacePlacementIdCalls, 2);
assert.equal(surfacePlacementEditor.getState().history.undoDepth, 2);

const rotatedSurfaceTool = editorCore.create3DSurfacePlacementTool({
  createId: () => "should-not-be-created",
  layerId: "main",
  mode: "3d",
  placement: { kind: "box-face", orientation: "world-aligned" },
  type: "box"
});
const rotatedSurfaceEditor = editorCore.createEditor({
  activeToolId: rotatedSurfaceTool.id,
  document: {
    id: "rotated-surface-document",
    scene: {
      id: "rotated-surface-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "3d",
      nodes: [
        {
          id: "surface-target",
          layerId: "main",
          rotation: [0, 0.25, 0],
          type: "box"
        }
      ]
    }
  },
  tools: [rotatedSurfaceTool]
});
await assert.rejects(
  rotatedSurfaceEditor.handleToolInput(pointerInput("pointer.move"), {
    resolveSurfacePoint() {
      return boxSurfaceHit("y", 1, [0, 0.5, 0], [0, 1, 0]);
    },
    setAuthoringPreviews() {}
  }),
  (error) =>
    error instanceof editorCore.CanvasEditorError &&
    error.code === "invalid-hit-result"
);
assert.equal(rotatedSurfaceEditor.getState().history.undoDepth, 0);
assert.equal(rotatedSurfaceEditor.getState().document.scene.nodes.length, 1);

assert.throws(
  () =>
    editorCore.create3DSurfacePlacementTool({
      createId: () => "invalid-scale-box",
      layerId: "main",
      mode: "3d",
      placement: { kind: "box-face", orientation: "world-aligned" },
      scale: [1, 0, 1],
      type: "box"
    }),
  (error) =>
    error instanceof editorCore.CanvasEditorError &&
    error.code === "invalid-command"
);

const measurementTool = editorCore.createDistanceMeasurementTool({
  createId: () => "distance-1",
  layerId: "main",
  mode: "2d",
  precision: 2,
  type: "measurement",
  unit: { metersPerUnit: 1, name: "meter", symbol: "m" }
});
const measurementEditor = editorCore.createEditor({
  activeToolId: measurementTool.id,
  document: {
    id: "measurement-document",
    scene: {
      id: "measurement-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: []
    }
  },
  tools: [measurementTool]
});
const measurementPreviews = [];
const measurementRuntime = {
  ...shapeRuntime,
  setAuthoringPreviews(previews) {
    measurementPreviews.push(previews);
  }
};
await measurementEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, point: [0, 0] }),
  measurementRuntime
);
await measurementEditor.handleToolInput(
  pointerInput("pointer.up", { point: [0, 0] }),
  measurementRuntime
);
await measurementEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, point: [3, 4] }),
  measurementRuntime
);
await measurementEditor.handleToolInput(
  pointerInput("pointer.up", { point: [3, 4] }),
  measurementRuntime
);
const measurement = measurementEditor.getState().document.scene.nodes[0];
assert.deepEqual(measurement.start, [0, 0]);
assert.deepEqual(measurement.end, [3, 4]);
assert.equal(measurementEditor.getState().history.undoDepth, 1);
assert.deepEqual(measurementPreviews.at(-1), []);

// Surface-capture 3D distance: endpoints come from the M3.1 surface-point
// capability against whatever box/mesh node is under the pointer. Misses
// never fall back to a work plane.
const surfaceMesh = {
  color: "#38bdf8",
  id: "m1",
  indices: [0, 1, 2],
  layerId: "main",
  position: [0, 0, 0],
  positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  type: "mesh",
  visible: true,
  wireframe: false,
  locked: false,
  parentId: null,
  metadata: {}
};
const surfaceTool = editorCore.createDistanceMeasurementTool({
  capture: "surface",
  createId: () => "surface-distance-1",
  layerId: "main",
  mode: "3d",
  precision: 2,
  type: "measurement",
  unit: { metersPerUnit: 1, name: "meter", symbol: "m" }
});
const surfaceEditor = editorCore.createEditor({
  activeToolId: surfaceTool.id,
  document: {
    id: "surface-measurement-document",
    scene: {
      id: "surface-measurement-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "3d",
      nodes: [surfaceMesh]
    }
  },
  tools: [surfaceTool]
});
const surfacePreviews = [];
let surfaceMissNextHitTest = false;
let surfaceMissNextResolve = false;
const surfaceRuntime = {
  hitTest(input) {
    if (surfaceMissNextHitTest) {
      return { kind: "none", renderer: "test" };
    }
    return { kind: "node", nodeId: "m1", renderer: "test" };
  },
  resolveSurfacePoint(request) {
    assert.equal(request.mode, "3d");
    assert.deepEqual(request.target, { kind: "node", nodeType: "mesh" });
    if (surfaceMissNextResolve) {
      return { kind: "miss", mode: "3d" };
    }
    const [x, y] = request.viewportPoint;
    return {
      feature: { kind: "mesh.triangle", triangleIndex: x + y >= 6 ? 3 : 1 },
      kind: "hit",
      mode: "3d",
      nodeId: "m1",
      nodeType: "mesh",
      normal: [0, 0, 1],
      point: [x / 2, y / 2, 0]
    };
  },
  setAuthoringPreviews(previews) {
    surfacePreviews.push(previews);
  }
};

// Start tap on the mesh captures a surface endpoint (2,1) from point (4,2).
await surfaceEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, point: [4, 2] }),
  surfaceRuntime
);
await surfaceEditor.handleToolInput(
  pointerInput("pointer.up", { point: [4, 2] }),
  surfaceRuntime
);
const startedSurfaceNode = surfaceEditor
  .getState()
  .document.scene.nodes.find((node) => node.id === "surface-distance-1");
assert.equal(startedSurfaceNode, undefined, "draft must not be committed early");

// Release tap at (10,8) resolves surface endpoint (5,4) and commits once.
await surfaceEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, point: [10, 8] }),
  surfaceRuntime
);
await surfaceEditor.handleToolInput(
  pointerInput("pointer.up", { point: [10, 8] }),
  surfaceRuntime
);

const surfaceMeasurement = surfaceEditor
  .getState()
  .document.scene.nodes.find((node) => node.type === "measurement");
assert.ok(surfaceMeasurement, "a distance measurement must commit");
assert.deepEqual(surfaceMeasurement.start, [2, 1, 0]);
assert.deepEqual(surfaceMeasurement.end, [5, 4, 0]);
assert.equal(surfaceEditor.getState().history.undoDepth, 1);
await surfaceEditor.undo();
assert.equal(
  surfaceEditor.getState().document.scene.nodes.some((node) => node.type === "measurement"),
  false,
  "one undo removes the surface measurement"
);

// A start-tap miss starts nothing; the next full gesture still works.
surfaceMissNextHitTest = true;
await surfaceEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, point: [1, 1] }),
  surfaceRuntime
);
await surfaceEditor.handleToolInput(
  pointerInput("pointer.up", { point: [1, 1] }),
  surfaceRuntime
);
assert.equal(
  surfaceEditor.getState().document.scene.nodes.filter((node) => node.type === "measurement").length,
  0
);

// A release-tap resolver miss never commits and keeps the tool armed.
surfaceMissNextHitTest = false;
surfaceMissNextResolve = true;
await surfaceEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, point: [4, 2] }),
  surfaceRuntime
);
await surfaceEditor.handleToolInput(
  pointerInput("pointer.up", { point: [4, 2] }),
  surfaceRuntime
);
assert.equal(
  surfaceEditor.getState().document.scene.nodes.filter((node) => node.type === "measurement").length,
  0,
  "a missed release tap must not commit"
);
surfaceMissNextResolve = false;
await surfaceEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, point: [4, 2] }),
  surfaceRuntime
);
await surfaceEditor.handleToolInput(
  pointerInput("pointer.up", { point: [4, 2] }),
  surfaceRuntime
);
await surfaceEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, point: [10, 8] }),
  surfaceRuntime
);
await surfaceEditor.handleToolInput(
  pointerInput("pointer.up", { point: [10, 8] }),
  surfaceRuntime
);
assert.equal(
  surfaceEditor.getState().document.scene.nodes.filter((node) => node.type === "measurement").length,
  1,
  "the armed tool commits after a re-aimed release"
);

check("distance-surface-capture-tool", () => {});

const annotationTool = editorCore.createAnnotationTool({
  createId: () => "annotation-1",
  layerId: "main",
  mode: "2d",
  provideDraft: ({ anchor }) => {
    assert.deepEqual(anchor, [6, 7]);
    return { draft: { targetId: null, text: "Review" }, kind: "commit" };
  },
  type: "annotation"
});
const annotationEditor = editorCore.createEditor({
  activeToolId: annotationTool.id,
  document: {
    id: "annotation-document",
    scene: {
      id: "annotation-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: []
    }
  },
  tools: [annotationTool]
});
const annotationPreviews = [];
const annotationRuntime = {
  ...shapeRuntime,
  setAuthoringPreviews(previews) {
    annotationPreviews.push(previews);
  }
};
await annotationEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, point: [6, 7] }),
  annotationRuntime
);
await annotationEditor.handleToolInput(
  pointerInput("pointer.up", { point: [6, 7] }),
  annotationRuntime
);
assert.equal(annotationEditor.getState().document.scene.nodes[0].text, "Review");
assert.equal(annotationEditor.getState().history.undoDepth, 1);
assert.deepEqual(annotationPreviews.at(-1), []);

async function verifyDelayedAuthoringStartCancellation({
  mode,
  resolveResult,
  tool
}) {
  let markResolutionStarted;
  let resolveScenePoint;
  const resolutionStarted = new Promise((resolve) => {
    markResolutionStarted = resolve;
  });
  const scenePoint = new Promise((resolve) => {
    resolveScenePoint = resolve;
  });
  const previews = [];
  const cancellationSelectTool = editorCore.createSelectTool();
  const delayedStartEditor = editorCore.createEditor({
    activeToolId: tool.id,
    document: {
      id: `delayed-${mode}-authoring-document`,
      scene: {
        id: `delayed-${mode}-authoring-scene`,
        layers: [{ id: "main", name: "Main" }],
        mode,
        nodes: []
      }
    },
    tools: [tool, cancellationSelectTool]
  });
  const pendingStart = delayedStartEditor.handleToolInput(
    pointerInput("pointer.down", { buttons: 1 }),
    {
      resolveScenePoint() {
        markResolutionStarted();
        return scenePoint;
      },
      setAuthoringPreviews(nextPreviews) {
        previews.push(nextPreviews);
      }
    }
  );

  await resolutionStarted;
  delayedStartEditor.activateTool(cancellationSelectTool.id);
  resolveScenePoint(resolveResult);
  await pendingStart;

  assert.equal(delayedStartEditor.getState().activeToolId, cancellationSelectTool.id);
  assert.equal(delayedStartEditor.getState().document.scene.nodes.length, 0);
  assert.equal(delayedStartEditor.getState().history.undoDepth, 0);
  assert.equal(previews.some((preview) => preview.length > 0), false);
  assert.deepEqual(previews.at(-1), []);
}

let delayedAuthoringIdCount = 0;
let delayedAnnotationProviderCount = 0;
await verifyDelayedAuthoringStartCancellation({
  mode: "2d",
  resolveResult: { mode: "2d", position: [10, 20] },
  tool: editorCore.create2DShapeTool({
    createId: () => `delayed-shape-${++delayedAuthoringIdCount}`,
    layerId: "main",
    mode: "2d",
    type: "rect"
  })
});
await verifyDelayedAuthoringStartCancellation({
  mode: "3d",
  resolveResult: { mode: "3d", position: [1, 0, 2] },
  tool: editorCore.create3DPrimitiveTool({
    createId: () => `delayed-primitive-${++delayedAuthoringIdCount}`,
    layerId: "main",
    mode: "3d",
    type: "sphere",
    workPlane: { constant: 0, normal: [0, 1, 0] }
  })
});
await verifyDelayedAuthoringStartCancellation({
  mode: "2d",
  resolveResult: { mode: "2d", position: [3, 4] },
  tool: editorCore.createDistanceMeasurementTool({
    createId: () => `delayed-measurement-${++delayedAuthoringIdCount}`,
    layerId: "main",
    mode: "2d",
    precision: 2,
    type: "measurement",
    unit: { metersPerUnit: 1, name: "meter", symbol: "m" }
  })
});
await verifyDelayedAuthoringStartCancellation({
  mode: "3d",
  resolveResult: { mode: "3d", position: [2, 0, 3] },
  tool: editorCore.createAnnotationTool({
    createId: () => `delayed-annotation-${++delayedAuthoringIdCount}`,
    layerId: "main",
    mode: "3d",
    provideDraft: () => {
      delayedAnnotationProviderCount += 1;
      return { draft: { targetId: null, text: "late" }, kind: "commit" };
    },
    type: "annotation",
    workPlane: { constant: 0, normal: [0, 1, 0] }
  })
});
assert.equal(delayedAuthoringIdCount, 0);
assert.equal(delayedAnnotationProviderCount, 0);

let releaseDelayedPreview;
let markDelayedPreviewStarted;
const delayedPreviewStarted = new Promise((resolve) => {
  markDelayedPreviewStarted = resolve;
});
const latePreviewWrites = [];
const latePreviewTool = editorCore.create2DShapeTool({
  createId: () => "late-preview-rect",
  grid: { mode: "2d", origin: [0, 0], spacing: [1, 1] },
  layerId: "main",
  mode: "2d",
  type: "rect"
});
const latePreviewEditor = editorCore.createEditor({
  activeToolId: latePreviewTool.id,
  document: {
    id: "late-preview-document",
    scene: {
      id: "late-preview-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: []
    }
  },
  tools: [latePreviewTool, editorCore.createSelectTool()]
});
const latePreviewRuntime = {
  resolveScenePoint(request) {
    return { mode: "2d", position: request.viewportPoint };
  },
  setAuthoringPreviews(previews) {
    if (previews.some((preview) => preview.kind === "node")) {
      markDelayedPreviewStarted();
      return new Promise((resolve) => {
        releaseDelayedPreview = () => {
          latePreviewWrites.push(previews);
          resolve();
        };
      });
    }

    latePreviewWrites.push(previews);
  }
};
await latePreviewEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, point: [1, 1] }),
  latePreviewRuntime
);
const delayedPreviewMove = latePreviewEditor.handleToolInput(
  pointerInput("pointer.move", {
    buttons: 1,
    dragging: true,
    point: [5, 6]
  }),
  latePreviewRuntime
);
await delayedPreviewStarted;
latePreviewEditor.activateTool("select");
releaseDelayedPreview();
await delayedPreviewMove;
assert.deepEqual(latePreviewWrites.at(-1), []);
assert.equal(latePreviewEditor.getState().document.scene.nodes.length, 0);
assert.equal(latePreviewEditor.getState().history.undoDepth, 0);

let resolveDelayedDraft;
let markDelayedDraftStarted;
const delayedDraftStarted = new Promise((resolve) => {
  markDelayedDraftStarted = resolve;
});
const lateDraftPreviews = [];
const lateDraftTool = editorCore.createAnnotationTool({
  createId: () => "late-draft-annotation",
  layerId: "main",
  mode: "2d",
  provideDraft: () => {
    markDelayedDraftStarted();
    return new Promise((resolve) => {
      resolveDelayedDraft = resolve;
    });
  },
  type: "annotation"
});
const lateDraftEditor = editorCore.createEditor({
  activeToolId: lateDraftTool.id,
  document: {
    id: "late-draft-document",
    scene: {
      id: "late-draft-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: []
    }
  },
  tools: [lateDraftTool, editorCore.createSelectTool()]
});
const lateDraftRuntime = {
  ...shapeRuntime,
  setAuthoringPreviews(previews) {
    lateDraftPreviews.push(previews);
  }
};
await lateDraftEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, point: [7, 8] }),
  lateDraftRuntime
);
const delayedDraftCommit = lateDraftEditor.handleToolInput(
  pointerInput("pointer.up", { point: [7, 8] }),
  lateDraftRuntime
);
await delayedDraftStarted;
await lateDraftEditor.cancelActiveToolSession();
resolveDelayedDraft({
  draft: { targetId: null, text: "must not commit" },
  kind: "commit"
});
await delayedDraftCommit;
assert.deepEqual(lateDraftPreviews.at(-1), []);
assert.equal(lateDraftEditor.getState().document.scene.nodes.length, 0);
assert.equal(lateDraftEditor.getState().history.undoDepth, 0);

let resolveCancelledStart;
let markCancelledStartPending;
const cancelledStartPending = new Promise((resolve) => {
  markCancelledStartPending = resolve;
});
const cancelledStartResult = new Promise((resolve) => {
  resolveCancelledStart = resolve;
});
let replacementResolverCalled = false;
let immediateCancellationId = 0;
const immediateCancellationTool = editorCore.create2DShapeTool({
  createId: () => `immediate-cancel-${++immediateCancellationId}`,
  grid: { mode: "2d", origin: [0, 0], spacing: [1, 1] },
  id: "immediate-cancellation-shape",
  layerId: "main",
  mode: "2d",
  type: "rect"
});
const immediateCancellationEditor = editorCore.createEditor({
  activeToolId: immediateCancellationTool.id,
  document: {
    id: "immediate-cancellation-document",
    scene: {
      id: "immediate-cancellation-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: []
    }
  },
  tools: [immediateCancellationTool]
});
const immediateCancellationPreviews = [];
const pendingCancelledStart = immediateCancellationEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, point: [1, 1] }),
  {
    resolveScenePoint() {
      markCancelledStartPending();
      return cancelledStartResult;
    },
    setAuthoringPreviews(previews) {
      immediateCancellationPreviews.push(previews);
    }
  }
);
await cancelledStartPending;
await immediateCancellationEditor.cancelActiveToolSession();
const replacementStart = immediateCancellationEditor.handleToolInput(
  pointerInput("pointer.down", {
    buttons: 1,
    point: [9, 9],
    pointerId: 2
  }),
  {
    resolveScenePoint(request) {
      replacementResolverCalled = true;
      return { mode: "2d", position: request.viewportPoint };
    },
    setAuthoringPreviews(previews) {
      immediateCancellationPreviews.push(previews);
    }
  }
);
await replacementStart;
assert.equal(replacementResolverCalled, true);
assert.equal(immediateCancellationPreviews.at(-1).length > 0, true);
await immediateCancellationEditor.cancelActiveToolSession();
resolveCancelledStart({ mode: "2d", position: [1, 1] });
await pendingCancelledStart;
assert.deepEqual(immediateCancellationPreviews.at(-1), []);
assert.equal(immediateCancellationEditor.getState().document.scene.nodes.length, 0);
assert.equal(immediateCancellationEditor.getState().history.undoDepth, 0);

let releaseOldLeaseWrite;
let markOldLeaseWritePending;
const oldLeaseWritePending = new Promise((resolve) => {
  markOldLeaseWritePending = resolve;
});
const leaseWrites = [];
const oldLeaseTool = editorCore.create2DShapeTool({
  createId: () => "old-lease-node",
  grid: { mode: "2d", origin: [0, 0], spacing: [1, 1] },
  id: "old-lease-tool",
  layerId: "main",
  mode: "2d",
  type: "rect"
});
const newLeaseTool = editorCore.create2DShapeTool({
  createId: () => "new-lease-node",
  grid: { mode: "2d", origin: [0, 0], spacing: [1, 1] },
  id: "new-lease-tool",
  layerId: "main",
  mode: "2d",
  type: "rect"
});
const leaseEditor = editorCore.createEditor({
  activeToolId: oldLeaseTool.id,
  document: {
    id: "preview-lease-document",
    scene: {
      id: "preview-lease-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: []
    }
  },
  tools: [oldLeaseTool, newLeaseTool]
});
const leaseRuntime = {
  resolveScenePoint(request) {
    return { mode: "2d", position: request.viewportPoint };
  },
  setAuthoringPreviews(previews) {
    const oldNodePreview = previews.some(
      (preview) => preview.kind === "node" && preview.node.id === "old-lease-node"
    );

    if (oldNodePreview && !releaseOldLeaseWrite) {
      markOldLeaseWritePending();
      return new Promise((resolve) => {
        releaseOldLeaseWrite = () => {
          leaseWrites.push(previews);
          resolve();
        };
      });
    }

    leaseWrites.push(previews);
  }
};
await leaseEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1, point: [1, 1] }),
  leaseRuntime
);
const oldLeaseMove = leaseEditor.handleToolInput(
  pointerInput("pointer.move", {
    buttons: 1,
    dragging: true,
    point: [4, 5]
  }),
  leaseRuntime
);
await oldLeaseWritePending;
leaseEditor.activateTool(newLeaseTool.id);
const newLeaseStart = leaseEditor.handleToolInput(
  pointerInput("pointer.down", {
    buttons: 1,
    point: [9, 9],
    pointerId: 2
  }),
  leaseRuntime
);
releaseOldLeaseWrite();
await Promise.all([oldLeaseMove, newLeaseStart]);
assert.deepEqual(
  leaseWrites.at(-1).find((preview) => preview.kind === "grid.snap").position,
  [9, 9]
);
assert.equal(leaseWrites.at(-1).length > 0, true);
await leaseEditor.cancelActiveToolSession();
assert.deepEqual(leaseWrites.at(-1), []);

const cleanupFailure = new Error("preview cleanup rejected");
const cleanupFailureTool = editorCore.create2DShapeTool({
  createId: () => "cleanup-failure-node",
  grid: { mode: "2d", origin: [0, 0], spacing: [1, 1] },
  id: "cleanup-failure-tool",
  layerId: "main",
  mode: "2d",
  type: "rect"
});
const cleanupFailureEditor = editorCore.createEditor({
  activeToolId: cleanupFailureTool.id,
  document: {
    id: "cleanup-failure-document",
    scene: {
      id: "cleanup-failure-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: []
    }
  },
  tools: [cleanupFailureTool]
});
await cleanupFailureEditor.handleToolInput(
  pointerInput("pointer.down", { buttons: 1 }),
  {
    ...shapeRuntime,
    setAuthoringPreviews(previews) {
      return previews.length === 0
        ? Promise.reject(cleanupFailure)
        : undefined;
    }
  }
);
await assert.rejects(
  cleanupFailureEditor.cancelActiveToolSession(),
  (error) =>
    error instanceof editorCore.CanvasEditorError &&
    error.code === "tool-handler-failed" &&
    error.cause === cleanupFailure
);

const missingCapabilityEditor = editorCore.createEditor({
  activeToolId: rectTool.id,
  document: {
    id: "missing-capability-document",
    scene: {
      id: "missing-capability-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: []
    }
  },
  tools: [rectTool]
});
await assert.rejects(
  missingCapabilityEditor.handleToolInput(pointerInput("pointer.down"), {
    resolveScenePoint: shapeRuntime.resolveScenePoint
  }),
  (error) =>
    error instanceof editorCore.CanvasEditorError &&
    error.code === "tool-capability-missing"
);
assert.equal(missingCapabilityEditor.getState().document.scene.nodes.length, 0);
assert.equal(missingCapabilityEditor.getState().history.undoDepth, 0);

const editorDeclaration = readFileSync(
  path.join(root, "packages/editor/dist/index.d.ts"),
  "utf8"
);
assert.doesNotMatch(editorDeclaration, /\bany\b/);
assert.doesNotMatch(editorDeclaration, /Record<string/);
const typeFixtureDirectory = mkdtempSync(path.join(root, ".editor-types-"));
const typeFixturePath = path.join(typeFixtureDirectory, "fixture.ts");
const typeFixture = `
import {
  create2DShapeTool,
  create3DPrimitiveTool,
  create3DSurfacePlacementTool,
  createAnnotationTool,
  createGroupNodesCommand,
  createNodeUpdateCommand,
  snapPointToGrid
} from "../packages/editor/dist/index.js";
import type { CanvasDocument, CanvasNodeByType, Point2, Vector3 } from "../packages/core/dist/index.js";

declare const document: CanvasDocument;
declare const rect: CanvasNodeByType<"2d", "rect">;
const rectUpdate = createNodeUpdateCommand(rect, { fill: "#fff" });
const rectUpdateMode: "2d" = rectUpdate.nodeMode;
const rectUpdateType: "rect" = rectUpdate.nodeType;
createNodeUpdateCommand(rect, { position: [1, 2] });
// @ts-expect-error rect patches cannot use circle-only radius
createNodeUpdateCommand(rect, { radius: 4 });
// @ts-expect-error 2D position cannot contain three coordinates
createNodeUpdateCommand(rect, { position: [1, 2, 3] });
// @ts-expect-error immutable node fields cannot be patched
createNodeUpdateCommand(rect, { id: "replacement" });

create2DShapeTool({ createId: () => "rect-1", layerId: "main", mode: "2d", type: "rect" });
// @ts-expect-error rect tools do not accept radius
create2DShapeTool({ createId: () => "rect-1", layerId: "main", mode: "2d", radius: 2, type: "rect" });
create3DPrimitiveTool({ createId: () => "sphere-1", layerId: "main", mode: "3d", radius: 2, type: "sphere", workPlane: { constant: 0, normal: [0, 1, 0] } });
// @ts-expect-error box tools do not accept sphere radius
create3DPrimitiveTool({ createId: () => "box-1", layerId: "main", mode: "3d", radius: 2, type: "box", workPlane: { constant: 0, normal: [0, 1, 0] } });
const typedSurfaceTool = create3DSurfacePlacementTool({ createId: () => "surface-1", id: "plugin.fixture.tool.surface", layerId: "main", mode: "3d", placement: { kind: "box-face", orientation: "world-aligned" }, scale: [1, 2, 3], type: "box" });
const typedSurfaceToolId: "plugin.fixture.tool.surface" = typedSurfaceTool.id;
// @ts-expect-error surface-placement tools do not accept rotation
create3DSurfacePlacementTool({ createId: () => "surface-2", layerId: "main", mode: "3d", placement: { kind: "box-face", orientation: "world-aligned" }, rotation: [0, 0, 0], type: "box" });
// @ts-expect-error surface-placement tools do not accept work planes
create3DSurfacePlacementTool({ createId: () => "surface-3", layerId: "main", mode: "3d", placement: { kind: "box-face", orientation: "world-aligned" }, type: "box", workPlane: { constant: 0, normal: [0, 1, 0] } });
// @ts-expect-error surface-placement tools do not accept grids
create3DSurfacePlacementTool({ createId: () => "surface-4", grid: { axisU: [1, 0, 0], axisV: [0, 0, 1], mode: "3d", origin: [0, 0, 0], spacing: [1, 1] }, layerId: "main", mode: "3d", placement: { kind: "box-face", orientation: "world-aligned" }, type: "box" });
// @ts-expect-error surface-placement orientation is exact
create3DSurfacePlacementTool({ createId: () => "surface-5", layerId: "main", mode: "3d", placement: { kind: "box-face", orientation: "surface-aligned" }, type: "box" });
// @ts-expect-error surface-placement source type is box only
create3DSurfacePlacementTool({ createId: () => "surface-6", layerId: "main", mode: "3d", placement: { kind: "box-face", orientation: "world-aligned" }, type: "sphere" });
// @ts-expect-error 2D tools cannot receive a 3D grid
create2DShapeTool({ createId: () => "rect-2", grid: { axisU: [1, 0, 0], axisV: [0, 0, 1], mode: "3d", origin: [0, 0, 0], spacing: [1, 1] }, layerId: "main", mode: "2d", type: "rect" });

const snapped2D = snapPointToGrid({ grid: { mode: "2d", origin: [0, 0], spacing: [1, 1] }, kind: "grid", mode: "2d", position: [1, 2] });
const point2: Point2 = snapped2D.position;
// @ts-expect-error 2D snap results are not Vector3
const point3: Vector3 = snapped2D.position;
void point2;
void point3;
void rectUpdateMode;
void rectUpdateType;
void typedSurfaceToolId;

createAnnotationTool({ createId: () => "note-1", layerId: "main", mode: "2d", provideDraft: ({ anchor }) => { const point: Point2 = anchor; void point; return { draft: { targetId: null, text: "note" }, kind: "commit" }; }, type: "annotation" });
// @ts-expect-error annotation providers must return commit or cancel
createAnnotationTool({ createId: () => "note-2", layerId: "main", mode: "2d", provideDraft: () => undefined, type: "annotation" });
createGroupNodesCommand({ document, groupId: "group-1", nodeIds: ["node-1"] });
// @ts-expect-error group identity must be either groupId or createId, not both
createGroupNodesCommand({ createId: () => "group-2", document, groupId: "group-2", nodeIds: ["node-1"] });
`;
try {
  writeFileSync(typeFixturePath, typeFixture);
  const typeCheck = spawnSync(
    "pnpm",
    [
      "exec",
      "tsc",
      "--noEmit",
      "--strict",
      "--exactOptionalPropertyTypes",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "--target",
      "ES2022",
      "--skipLibCheck",
      typeFixturePath
    ],
    { cwd: root, encoding: "utf8" }
  );
  assert.equal(
    typeCheck.status,
    0,
    `Editor type fixture failed:\n${typeCheck.stdout}\n${typeCheck.stderr}`
  );
} finally {
  rmSync(typeFixtureDirectory, { force: true, recursive: true });
}

// --- layout adapters ------------------------------------------------------
{
  const layoutEditor = facade.createEditor({
    document: {
      id: "layout-document",
      scene: {
        id: "layout-scene",
        layers: [{ id: "main", name: "Main" }],
        mode: "2d",
        nodes: [
          { id: "a", layerId: "main", type: "rect", position: [0, 0], size: [100, 50] },
          { id: "b", layerId: "main", type: "rect", position: [200, 30], size: [60, 80] },
          { id: "c", layerId: "main", type: "rect", position: [400, 90], size: [40, 40] },
          { id: "edge", layerId: "main", type: "edge", sourceId: "a", targetId: "b" }
        ]
      }
    }
  });

  // The renderer supplies bounds; here we stand in for it so the editor stays
  // renderer-independent (packages/editor does not depend on packages/web).
  const boundsFor = (ids) => {
    const nodes = layoutEditor.getState().document.scene.nodes;
    const measured = new Map();
    for (const id of ids) {
      const node = nodes.find((candidate) => candidate.id === id);
      if (node?.size) {
        measured.set(id, {
          minX: node.position[0],
          minY: node.position[1],
          maxX: node.position[0] + node.size[0],
          maxY: node.position[1] + node.size[1]
        });
      }
    }
    return measured;
  };
  const align = editorCore.createAlignAdapter("top");
  const unregister = layoutEditor.registerLayoutAdapter(align);
  assert.equal(layoutEditor.getLayoutAdapters().length, 1);

  assert.throws(
    () => layoutEditor.registerLayoutAdapter(align),
    /already registered/
  );
  assert.throws(
    () => layoutEditor.registerLayoutAdapter({ name: "", kind: "arrange", apply: () => ({ positions: [] }) }),
    /non-empty name/
  );
  assert.throws(
    () => layoutEditor.registerLayoutAdapter({ name: "bad", kind: "nope", apply: () => ({ positions: [] }) }),
    /arrange or layout/
  );

  const before = JSON.parse(
    JSON.stringify(layoutEditor.getState().document.scene.nodes)
  );
  const applied = await layoutEditor.applyLayout("align.top", {
    nodeIds: ["a", "b", "c", "edge"],
    resolveNodeBounds: boundsFor
  });

  assert.equal(applied.measured, true, "bounds capability should be used");

  const afterNodes = layoutEditor.getState().document.scene.nodes;
  const byId = (id) => afterNodes.find((node) => node.id === id);

  // All three rects share the topmost edge (y = 0); the edge node has no
  // position and must be left untouched.
  assert.equal(byId("a").position[1], 0);
  assert.equal(byId("b").position[1], 0);
  assert.equal(byId("c").position[1], 0);
  assert.equal(byId("a").position[0], 0, "align.top must not move x");
  assert.deepEqual(applied.movedNodeIds.includes("edge"), false);
  assert.equal(byId("edge").type, "edge");

  // The whole arrange must collapse into a single undo step.
  await layoutEditor.undo();
  assert.deepEqual(
    JSON.parse(JSON.stringify(layoutEditor.getState().document.scene.nodes)),
    before,
    "one undo must revert every node the adapter moved"
  );

  unregister();
  assert.equal(layoutEditor.getLayoutAdapters().length, 0);
  await assert.rejects(
    layoutEditor.applyLayout("align.top"),
    /Unknown layout adapter/
  );

  // Without renderer geometry the input is unmeasured and edge-based adapters
  // decline to move anything rather than aligning against point-sized boxes.
  const blindEditor = facade.createEditor({
    document: {
      id: "blind-document",
      scene: {
        id: "blind-scene",
        layers: [{ id: "main", name: "Main" }],
        mode: "2d",
        nodes: [
          { id: "a", layerId: "main", type: "rect", position: [0, 0], size: [10, 10] },
          { id: "b", layerId: "main", type: "rect", position: [50, 50], size: [10, 10] }
        ]
      }
    }
  });
  blindEditor.registerLayoutAdapter(editorCore.createAlignAdapter("left"));
  const blind = await blindEditor.applyLayout("align.left", {
    nodeIds: ["a", "b"]
  });
  assert.equal(blind.measured, false);
  assert.deepEqual(blind.movedNodeIds, []);
}

// --- built-in adapter geometry -------------------------------------------
// Adapters are pure functions, so their placements are asserted directly rather
// than through the editor. Boxes differ in size on both axes so that anything
// computing from `position` instead of bounds shows up immediately.
{
  const nodes = [
    { id: "a", type: "rect", position: [0, 0], bounds: { minX: 0, minY: 0, maxX: 40, maxY: 20 } },
    { id: "b", type: "rect", position: [100, 50], bounds: { minX: 100, minY: 50, maxX: 120, maxY: 90 } },
    { id: "c", type: "rect", position: [300, 10], bounds: { minX: 300, minY: 10, maxX: 360, maxY: 40 } }
  ];
  const input = { nodes, edges: [], measured: true };
  const placementsOf = (adapter) =>
    Object.fromEntries(
      adapter.apply(input).positions.map((p) => [p.id, p.position])
    );

  // Every node's left edge lands on the leftmost edge (x = 0); y is untouched.
  assert.deepEqual(placementsOf(editorCore.createAlignAdapter("left")), {
    b: [0, 50],
    c: [0, 10]
  });
  // Right edges meet at x = 360, so each node shifts by its own width.
  assert.deepEqual(placementsOf(editorCore.createAlignAdapter("right")), {
    a: [320, 0],
    b: [340, 50]
  });
  // Differing heights must produce differing y deltas — this is what breaks if
  // an adapter aligns by `position` rather than by bounds.
  assert.deepEqual(placementsOf(editorCore.createAlignAdapter("center-y")), {
    a: [0, 35],
    b: [100, 25],
    c: [300, 30]
  });
  assert.deepEqual(placementsOf(editorCore.createAlignAdapter("bottom")), {
    a: [0, 70],
    c: [300, 60]
  });

  // Distribute keeps the outermost nodes fixed and equalises the gaps.
  const distributed = editorCore
    .createDistributeAdapter("horizontal")
    .apply(input);
  assert.deepEqual(
    distributed.positions.map((p) => p.id),
    ["b"],
    "only interior nodes move when distributing"
  );
  const moved = new Map(distributed.positions.map((p) => [p.id, p.position]));
  const spans = nodes
    .map((node) => {
      const dx = (moved.get(node.id) ?? node.position)[0] - node.position[0];
      return { minX: node.bounds.minX + dx, maxX: node.bounds.maxX + dx };
    })
    .sort((left, right) => left.minX - right.minX);
  const gaps = spans.slice(1).map((span, index) => span.minX - spans[index].maxX);
  assert.equal(gaps.length, 2);
  assert.ok(
    Math.abs(gaps[0] - gaps[1]) < 1e-9,
    `distribute must equalise gaps, got ${JSON.stringify(gaps)}`
  );

  // Grid packs into uniform cells sized by the largest node plus the gap.
  assert.deepEqual(
    placementsOf(editorCore.createGridLayoutAdapter({ columns: 2, gap: 10 })),
    { b: [70, 0], c: [0, 50] }
  );

  // Guard rails: without measured bounds, or with too few nodes to define the
  // operation, adapters decline rather than emitting wrong positions.
  assert.deepEqual(
    editorCore.createAlignAdapter("left").apply({ ...input, measured: false })
      .positions,
    []
  );
  assert.deepEqual(
    editorCore
      .createAlignAdapter("left")
      .apply({ ...input, nodes: nodes.slice(0, 1) }).positions,
    []
  );
  assert.deepEqual(
    editorCore
      .createDistributeAdapter("horizontal")
      .apply({ ...input, nodes: nodes.slice(0, 2) }).positions,
    [],
    "two nodes have a single gap, so there is nothing to equalise"
  );
}

// --- time / relation graph adapters --------------------------------------
// These are the first graph layouts: time is a left-to-right axis, relation
// is BFS layers with no global centre. Both must be order-independent.
{
  const nodes = [
    { id: "c", type: "circle", position: [9, 9], bounds: { minX: 9, minY: 9, maxX: 9, maxY: 9 } },
    { id: "a", type: "circle", position: [1, 1], bounds: { minX: 1, minY: 1, maxX: 1, maxY: 1 } },
    { id: "b", type: "circle", position: [2, 2], bounds: { minX: 2, minY: 2, maxX: 2, maxY: 2 } },
    { id: "d", type: "circle", position: [4, 4], bounds: { minX: 4, minY: 4, maxX: 4, maxY: 4 } }
  ];
  const reversed = [...nodes].reverse();
  const edges = [
    { id: "e2", sourceId: "b", targetId: "c" },
    { id: "e1", sourceId: "a", targetId: "b" }
  ];
  const at = { a: 10, b: 20, c: 20 };
  const timeAdapter = editorCore.createTimeGraphLayoutAdapter({
    origin: [0, 0],
    columnGap: 100,
    laneGap: 40
  });
  const relationAdapter = editorCore.createRelationGraphLayoutAdapter({
    origin: [0, 0],
    layerGap: 80,
    laneGap: 40,
    componentGap: 120
  });
  const byId = (adapter, input) =>
    Object.fromEntries(adapter.apply(input).positions.map((p) => [p.id, p.position]));

  const timeForward = byId(timeAdapter, {
    nodes,
    edges,
    measured: true,
    options: { at }
  });
  const timeReversed = byId(timeAdapter, {
    nodes: reversed,
    edges: [...edges].reverse(),
    measured: true,
    options: { at }
  });
  assert.deepEqual(timeForward, timeReversed, "time layout must ignore input order");
  assert.equal(timeForward.a[0], 0, "earliest time is the first column");
  assert.equal(timeForward.b[0], 100);
  assert.equal(timeForward.c[0], 100, "same time shares a column");
  assert.ok(timeForward.d[0] > timeForward.c[0], "untimed nodes sit to the right");
  assert.ok(timeForward.b[1] < timeForward.c[1], "same-time lanes follow id order");

  const relationForward = byId(relationAdapter, { nodes, edges, measured: true });
  const relationReversed = byId(relationAdapter, {
    nodes: reversed,
    edges: [...edges].reverse(),
    measured: true
  });
  assert.deepEqual(
    relationForward,
    relationReversed,
    "relation layout must ignore input order"
  );
  // a–b–c is one component; b has degree 2 so it is the root. d is isolated.
  assert.equal(relationForward.b[0], 0, "highest-degree node is the relation root");
  assert.equal(relationForward.a[0], 80);
  assert.equal(relationForward.c[0], 80);
  assert.ok(
    relationForward.d[0] > relationForward.a[0],
    "unconnected nodes start a new component to the right"
  );

  assert.equal(
    editorCore.canvasScreenPointRadius(20, 0.1, { min: 4, max: 14 }),
    40,
    "far zoom grows world radius so the painted size stays at min screen px"
  );
  assert.equal(editorCore.canvasScreenPointRadius(8, 1, { min: 4, max: 14 }), 8);
  assert.equal(
    editorCore.canvasScreenPointRadius(20, 2, { min: 4, max: 14 }),
    7,
    "close zoom shrinks world radius so the screen size stays at max"
  );
}

{
  const graphEditor = facade.createEditor({
    document: {
      id: "graph-layout",
      scene: {
        id: "graph",
        mode: "2d",
        layers: [{ id: "main", name: "Main" }],
        nodes: [
          { id: "early", layerId: "main", type: "circle", position: [40, 10], radius: 8, fill: "#fff" },
          { id: "late", layerId: "main", type: "circle", position: [10, 40], radius: 8, fill: "#fff" }
        ]
      }
    }
  });
  graphEditor.registerLayoutAdapter(editorCore.createTimeGraphLayoutAdapter());
  const before = JSON.parse(JSON.stringify(graphEditor.getState().document.scene.nodes));
  const applied = await graphEditor.applyLayout("layout.time-graph", {
    options: { at: { early: 1, late: 2 }, origin: [0, 0], columnGap: 50, laneGap: 20 }
  });
  assert.deepEqual(applied.movedNodeIds.slice().sort(), ["early", "late"]);
  const after = graphEditor.getState().document.scene.nodes;
  assert.deepEqual(
    after.find((node) => node.id === "early").position,
    [0, 0]
  );
  assert.deepEqual(
    after.find((node) => node.id === "late").position,
    [50, 0]
  );
  await graphEditor.undo();
  assert.deepEqual(
    JSON.parse(JSON.stringify(graphEditor.getState().document.scene.nodes)),
    before,
    "one undo must restore the time-graph placements"
  );
}

{
  // Human-shaped and agent-shaped callers share this list. The playground
  // Hide Level 2 button uses the same functions.
  const document = {
    id: "named-ops",
    scene: {
      id: "named-ops-scene",
      layers: [
        { id: "storey-1", name: "Level 1", visible: true },
        { id: "storey-2", name: "Level 2", visible: true }
      ],
      mode: "3d",
      nodes: []
    }
  };
  const hideLevel2 = facade.setLayerVisible({
    layerId: "storey-2",
    visible: false
  });
  const preview = facade.applyNamedOperations(document, [hideLevel2]);
  assert.equal(preview.changed, true);
  assert.equal(preview.commands.length, 1);
  assert.equal(preview.commands[0].type, "layer.update");
  assert.equal(preview.commands[0].layerId, "storey-2");
  assert.deepEqual(preview.commands[0].patch, { visible: false });
  assert.equal(
    preview.document.scene.layers.find((layer) => layer.id === "storey-2")
      .visible,
    false
  );
  assert.equal(
    preview.document.scene.layers.find((layer) => layer.id === "storey-1")
      .visible,
    true
  );

  const alreadyHidden = facade.applyNamedOperations(preview.document, [
    hideLevel2
  ]);
  assert.equal(alreadyHidden.changed, false);
  assert.deepEqual(alreadyHidden.commands, []);
  assert.equal(alreadyHidden.document, preview.document);

  const editor = facade.createEditor({ document });
  const applied = await editor.apply([hideLevel2]);
  assert.equal(applied.changed, true);
  assert.equal(
    editor.getState().document.scene.layers.find((layer) => layer.id === "storey-2")
      .visible,
    false
  );
  assert.equal(editor.getState().history.undoDepth, 1);

  const noop = await editor.apply([hideLevel2]);
  assert.equal(noop.changed, false);
  assert.deepEqual(noop.commands, []);
  assert.equal(editor.getState().history.undoDepth, 1);

  await editor.undo();
  assert.equal(
    editor.getState().document.scene.layers.find((layer) => layer.id === "storey-2")
      .visible,
    true
  );

  await assert.rejects(
    async () =>
      editor.apply([
        facade.setLayerVisible({ layerId: "missing-storey", visible: false })
      ]),
    (error) =>
      error instanceof facade.CanvasEditorError &&
      error.code === "layer-not-found"
  );
  assert.equal(editor.getState().history.undoDepth, 0);

  assert.throws(
    () =>
      facade.setLayerVisible({
        layerId: "storey-2",
        visible: false,
        extra: true
      }),
    (error) =>
      error instanceof facade.CanvasEditorError &&
      error.code === "invalid-command"
  );
  assert.throws(
    () => facade.applyNamedOperations(document, hideLevel2),
    (error) =>
      error instanceof facade.CanvasEditorError &&
      error.code === "invalid-command" &&
      error.message.includes("list as the second argument")
  );
  assert.throws(
    () => editor.apply(hideLevel2),
    (error) =>
      error instanceof facade.CanvasEditorError &&
      error.code === "invalid-command" &&
      error.message.includes("editor.apply([setLayerVisible")
  );

  const twoLayers = await editor.apply([
    facade.setLayerVisible({ layerId: "storey-1", visible: false }),
    facade.setLayerVisible({ layerId: "storey-2", visible: false })
  ]);
  assert.equal(twoLayers.changed, true);
  assert.equal(twoLayers.commands.length, 2);
  assert.equal(editor.getState().history.undoDepth, 1);
  assert.equal(
    editor.getState().document.scene.layers.every((layer) => layer.visible === false),
    true
  );
  await editor.undo();
  assert.equal(
    editor.getState().document.scene.layers.every((layer) => layer.visible === true),
    true
  );
}

// Reaching here means every sequential assertion above held: any failure throws
// and aborts the run, which the non-zero exit code reports.
check("editor-core-suite", () => {});

report({
  history: editor.getState().history,
  runtimeUpdateCount: runtimeScenes.length
});
