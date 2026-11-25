import {
  CanvasCommandSchema,
  CanvasLayerPatchSchema,
  CanvasNodeSchema,
  type CanvasCommand,
  type CanvasDocumentInput,
  type CanvasLayer,
  type CanvasLayerId,
  type CanvasLayerPatch,
  type CanvasNode,
  type CanvasNodePatch,
  type CanvasPluginCommand,
  type CanvasPluginCommandType,
  type JsonValue,
  type NodeId
} from "@de-novo/canvas-core";
import { Effect, Either } from "effect";
import { CanvasEditorError, PluginPayloadValidationFailure } from "../errors.js";
import type {
  ApplyCommandResult,
  EditorEffect,
  EditorSnapshot,
  RegisteredPluginCommand
} from "../internal-types.js";
import { freezeValue, isPlainObject, jsonEqual, uniqueIds } from "../utils.js";
import { resolveEffectiveNodeState, getEffectiveNodeState } from "../node-state.js";
import {
  parseDocumentEffect,
  parseSelectionForDocumentEffect,
  sanitizeSelectionForDocument
} from "../parsers.js";
import {
  compose2DTransforms,
  compose3DTransforms,
  transformPoint2,
  transformPoint3
} from "../math/transform.js";
import {
  createValidatedNodeUpdateCommand,
  getNodeIdentity,
  getNodeInputId
} from "./builders.js";

export function applyCommandEffect(
  command: CanvasCommand,
  current: EditorSnapshot,
  timestamp: string,
  handlers: ReadonlyMap<CanvasPluginCommandType, RegisteredPluginCommand>
): EditorEffect<ApplyCommandResult> {
  return Effect.gen(function* () {
    switch (command.type) {
      case "node.add":
        return yield* applyNodeAddEffect(command, current, timestamp);
      case "node.remove":
        return yield* applyNodeRemoveEffect(command, current, timestamp);
      case "node.update":
        return yield* applyNodeUpdateEffect(command, current, timestamp);
      case "layer.add":
        return yield* applyLayerAddEffect(command, current, timestamp);
      case "layer.update":
        return yield* applyLayerUpdateEffect(command, current, timestamp);
      case "layer.remove":
        return yield* applyLayerRemoveEffect(command, current, timestamp);
      case "layer.reorder":
        return yield* applyLayerReorderEffect(command, current, timestamp);
      case "selection.set":
        return yield* applySelectionEffect(command, current);
      case "transaction":
        return yield* applyTransactionEffect(command, current, timestamp, handlers);
      default:
        return yield* applyPluginCommandEffect(
          command,
          current,
          timestamp,
          handlers
        );
    }
  });
}

function applyNodeAddEffect(
  command: Extract<CanvasCommand, { type: "node.add" }>,
  current: EditorSnapshot,
  timestamp: string
): EditorEffect<ApplyCommandResult> {
  return Effect.gen(function* () {
    const nodes = current.document.scene.nodes;
    const nodeId = getNodeInputId(command.node);

    if (nodeId && nodes.some((node) => node.id === nodeId)) {
      return yield* Effect.fail(
        new CanvasEditorError(
          "node-already-exists",
          `Node already exists: ${nodeId}`,
          { commandType: command.type }
        )
      );
    }

    const node = yield* Effect.try({
      try: () => CanvasNodeSchema.parse(command.node),
      catch: (cause) =>
        new CanvasEditorError("invalid-command", "Node validation failed.", {
          cause,
          commandType: command.type
        })
    });
    const layer = current.document.scene.layers.find(
      (candidate) => candidate.id === node.layerId
    );

    if (!layer) {
      return yield* layerNotFoundEffect(node.layerId, command.type);
    }

    if (layer.locked) {
      return yield* lockedTargetEffect(node.layerId, command.type, "Layer");
    }

    if (node.parentId !== null) {
      const parent = nodes.find((candidate) => candidate.id === node.parentId);

      if (!parent) {
        return yield* nodeNotFoundEffect(node.parentId, command.type);
      }

      if (parent.type !== "group") {
        return yield* Effect.fail(
          new CanvasEditorError(
            "invalid-command",
            `Node parent is not a group: ${parent.id}`,
            { commandType: command.type }
          )
        );
      }

      if (resolveEffectiveNodeState(current.document, parent.id).locked) {
        return yield* lockedTargetEffect(parent.id, command.type, "Parent group");
      }
    }

    const index = command.index ?? nodes.length;

    if (!Number.isInteger(index) || index < 0 || index > nodes.length) {
      return yield* Effect.fail(
        new CanvasEditorError(
          "invalid-command",
          `node.add index must be an integer between 0 and ${nodes.length}.`,
          { commandType: command.type }
        )
      );
    }

    const nextNodes = [...nodes];
    nextNodes.splice(index, 0, node);
    const document = yield* parseDocumentEffect(
      {
        ...current.document,
        scene: {
          ...current.document.scene,
          nodes: nextNodes
        },
        updatedAt: timestamp
      },
      "invalid-command",
      command.type
    );
    const inserted = document.scene.nodes[index];

    if (!inserted) {
      return yield* Effect.fail(
        new CanvasEditorError("internal-error", "Inserted node was not retained.", {
          commandType: command.type
        })
      );
    }

    return {
      affectedNodeIds: [inserted.id],
      inverse: {
        nodeId: inserted.id,
        type: "node.remove"
      },
      persistent: true,
      snapshot: {
        document,
        selection: sanitizeSelectionForDocument(current.selection, document)
      }
    };
  });
}

function applyNodeRemoveEffect(
  command: Extract<CanvasCommand, { type: "node.remove" }>,
  current: EditorSnapshot,
  timestamp: string
): EditorEffect<ApplyCommandResult> {
  return Effect.gen(function* () {
    if (typeof command.nodeId !== "string" || command.nodeId.length === 0) {
      return yield* Effect.fail(
        new CanvasEditorError(
          "invalid-command",
          "node.remove nodeId must be a non-empty string.",
          { commandType: command.type }
        )
      );
    }

    const index = current.document.scene.nodes.findIndex(
      (node) => node.id === command.nodeId
    );

    if (index < 0) {
      return yield* nodeNotFoundEffect(command.nodeId, command.type);
    }

    const removed = current.document.scene.nodes[index];

    if (!removed) {
      return yield* nodeNotFoundEffect(command.nodeId, command.type);
    }

    if (resolveEffectiveNodeState(current.document, removed.id).locked) {
      return yield* lockedTargetEffect(removed.id, command.type, "Node");
    }

    if (
      current.document.scene.nodes.some(
        (node) =>
          node.type === "edge" &&
          (node.sourceId === removed.id || node.targetId === removed.id)
      )
    ) {
      return yield* Effect.fail(
        new CanvasEditorError(
          "invalid-command",
          `Node is referenced by an edge and cannot be removed: ${removed.id}`,
          { commandType: command.type }
        )
      );
    }

    if (
      removed.type === "group" &&
      current.document.scene.nodes.some((node) => node.parentId === removed.id)
    ) {
      return yield* Effect.fail(
        new CanvasEditorError(
          "invalid-command",
          `A non-empty group must be ungrouped before removal: ${removed.id}`,
          { commandType: command.type }
        )
      );
    }

    const nextNodes = current.document.scene.nodes.filter(
      (node) => node.id !== command.nodeId
    );
    const document = yield* parseDocumentEffect(
      {
        ...current.document,
        scene: {
          ...current.document.scene,
          nodes: nextNodes
        },
        updatedAt: timestamp
      },
      "invalid-command",
      command.type
    );
    const selection = yield* parseSelectionForDocumentEffect(
      {
        hoveredId:
          current.selection.hoveredId === command.nodeId
            ? null
            : current.selection.hoveredId,
        ids: current.selection.ids.filter((id) => id !== command.nodeId),
        primaryId:
          current.selection.primaryId === command.nodeId
            ? null
            : current.selection.primaryId
      },
      document,
      command.type
    );

    return {
      affectedNodeIds: [removed.id],
      inverse: {
        index,
        node: removed,
        type: "node.add"
      },
      persistent: true,
      snapshot: {
        document,
        selection
      }
    };
  });
}

function applyNodeUpdateEffect(
  command: Extract<CanvasCommand, { type: "node.update" }>,
  current: EditorSnapshot,
  timestamp: string
): EditorEffect<ApplyCommandResult> {
  return Effect.gen(function* () {
    if (typeof command.nodeId !== "string" || command.nodeId.length === 0) {
      return yield* Effect.fail(
        new CanvasEditorError(
          "invalid-command",
          "node.update nodeId must be a non-empty string.",
          { commandType: command.type }
        )
      );
    }

    const index = current.document.scene.nodes.findIndex(
      (node) => node.id === command.nodeId
    );
    const node = current.document.scene.nodes[index];

    if (index < 0 || !node) {
      return yield* nodeNotFoundEffect(command.nodeId, command.type);
    }

    if (command.nodeMode !== current.document.scene.mode) {
      return yield* Effect.fail(
        new CanvasEditorError(
          "mode-mismatch",
          `node.update expected ${command.nodeMode} but the document is ${current.document.scene.mode}.`,
          { commandType: command.type }
        )
      );
    }

    if (command.nodeType !== node.type) {
      return yield* Effect.fail(
        new CanvasEditorError(
          "invalid-command",
          `node.update expected ${command.nodeType} but the current node is ${node.type}.`,
          { commandType: command.type }
        )
      );
    }

    if (!isPlainObject(command.patch) || Object.keys(command.patch).length === 0) {
      return yield* Effect.fail(
        new CanvasEditorError(
          "invalid-command",
          "node.update patch must be a non-empty object.",
          { commandType: command.type }
        )
      );
    }

    if ("id" in command.patch || "type" in command.patch) {
      return yield* Effect.fail(
        new CanvasEditorError(
          "immutable-node-field",
          "node.update cannot change node id or type.",
          { commandType: command.type }
        )
      );
    }

    const patchKeys = Object.keys(command.patch);
    const effectiveState = resolveEffectiveNodeState(current.document, node.id);
    const isExplicitSelfUnlock =
      node.locked &&
      !effectiveState.lockedByHierarchy &&
      patchKeys.length === 1 &&
      command.patch.locked === false;

    if (effectiveState.locked && !isExplicitSelfUnlock) {
      return yield* lockedTargetEffect(node.id, command.type, "Node");
    }

    const targetLayerId = command.patch.layerId;

    if (targetLayerId !== undefined) {
      const targetLayer = current.document.scene.layers.find(
        (layer) => layer.id === targetLayerId
      );

      if (!targetLayer) {
        return yield* layerNotFoundEffect(targetLayerId, command.type);
      }

      if (targetLayer.locked) {
        return yield* lockedTargetEffect(targetLayer.id, command.type, "Layer");
      }
    }

    const targetParentId = command.patch.parentId;

    if (targetParentId !== undefined && targetParentId !== null) {
      const targetParent = current.document.scene.nodes.find(
        (candidate) => candidate.id === targetParentId
      );

      if (!targetParent) {
        return yield* nodeNotFoundEffect(targetParentId, command.type);
      }

      if (targetParent.type !== "group") {
        return yield* Effect.fail(
          new CanvasEditorError(
            "invalid-command",
            `Node parent is not a group: ${targetParentId}`,
            { commandType: command.type }
          )
        );
      }

      if (resolveEffectiveNodeState(current.document, targetParent.id).locked) {
        return yield* lockedTargetEffect(
          targetParent.id,
          command.type,
          "Parent group"
        );
      }
    }

    for (const value of Object.values(command.patch)) {
      if (value === undefined) {
        return yield* Effect.fail(
          new CanvasEditorError(
            "invalid-command",
            "node.update patch values must be JSON-serializable.",
            { commandType: command.type }
          )
        );
      }
    }

    const nodeRecord = node as unknown as Readonly<Record<string, JsonValue>>;
    const inversePatch: Record<string, JsonValue> = {};
    let changed = false;

    for (const [key, value] of Object.entries(command.patch)) {
      const previous = nodeRecord[key];

      if (previous === undefined) {
        return yield* Effect.fail(
          new CanvasEditorError(
            "invalid-command",
            `node.update cannot add unknown field: ${key}`,
            { commandType: command.type }
          )
        );
      }

      inversePatch[key] = previous;
      changed ||= !jsonEqual(previous, value);
    }

    if (!changed) {
      return {
        affectedNodeIds: [],
        persistent: false,
        snapshot: current
      };
    }

    const nextNodes = [...current.document.scene.nodes];
    nextNodes[index] = {
      ...node,
      ...command.patch
    } as CanvasNode;
    const document = yield* parseDocumentEffect(
      {
        ...current.document,
        scene: {
          ...current.document.scene,
          nodes: nextNodes
        },
        updatedAt: timestamp
      },
      "invalid-command",
      command.type
    );
    const updatedNode = document.scene.nodes[index];

    if (!updatedNode) {
      return yield* Effect.fail(
        new CanvasEditorError(
          "internal-error",
          "Updated node was not retained.",
          { commandType: command.type }
        )
      );
    }
    const inverse = createNodeUpdateInverse(
      node,
      inversePatch as CanvasNodePatch,
      updatedNode.locked
    );

    return {
      affectedNodeIds: [node.id],
      inverse,
      persistent: true,
      snapshot: {
        document,
        selection: sanitizeSelectionForDocument(current.selection, document)
      }
    };
  });
}

function createNodeUpdateInverse(
  node: CanvasNode,
  patch: CanvasNodePatch,
  targetLocked: boolean
): CanvasCommand {
  if (
    targetLocked &&
    patch.locked === false &&
    Object.keys(patch).length > 1
  ) {
    const { locked: _locked, ...remainingPatch } = patch;
    return {
      commands: [
        createValidatedNodeUpdateCommand(node, { locked: false }),
        createValidatedNodeUpdateCommand(
          node,
          remainingPatch as CanvasNodePatch
        )
      ],
      type: "transaction"
    };
  }

  return createValidatedNodeUpdateCommand(node, patch);
}

function createLayerUpdateInverse(
  layerId: CanvasLayerId,
  patch: CanvasLayerPatch,
  targetLocked: boolean
): CanvasCommand {
  if (
    targetLocked &&
    patch.locked === false &&
    Object.keys(patch).length > 1
  ) {
    const { locked: _locked, ...remainingPatch } = patch;
    return {
      commands: [
        { layerId, patch: { locked: false }, type: "layer.update" },
        {
          layerId,
          patch: CanvasLayerPatchSchema.parse(remainingPatch),
          type: "layer.update"
        }
      ],
      type: "transaction"
    };
  }

  return { layerId, patch, type: "layer.update" };
}

function applyLayerAddEffect(
  command: Extract<CanvasCommand, { type: "layer.add" }>,
  current: EditorSnapshot,
  timestamp: string
): EditorEffect<ApplyCommandResult> {
  return Effect.gen(function* () {
    const layers = current.document.scene.layers;

    if (layers.some((layer) => layer.id === command.layer.id)) {
      return yield* Effect.fail(
        new CanvasEditorError(
          "layer-already-exists",
          `Layer already exists: ${command.layer.id}`,
          { commandType: command.type }
        )
      );
    }

    if (
      !Number.isInteger(command.index) ||
      command.index < 0 ||
      command.index > layers.length
    ) {
      return yield* Effect.fail(
        new CanvasEditorError(
          "invalid-command",
          `layer.add index must be an integer between 0 and ${layers.length}.`,
          { commandType: command.type }
        )
      );
    }

    const nextLayers = [...layers];
    nextLayers.splice(command.index, 0, command.layer as CanvasLayer);
    const document = yield* parseDocumentEffect(
      {
        ...current.document,
        scene: {
          ...current.document.scene,
          layers: nextLayers
        },
        updatedAt: timestamp
      },
      "invalid-command",
      command.type
    );
    const inserted = document.scene.layers[command.index];

    if (!inserted) {
      return yield* Effect.fail(
        new CanvasEditorError("internal-error", "Inserted layer was not retained.", {
          commandType: command.type
        })
      );
    }

    return {
      affectedNodeIds: [],
      inverse: {
        layerId: inserted.id,
        targetLayerId: null,
        type: "layer.remove"
      },
      persistent: true,
      snapshot: {
        document,
        selection: current.selection
      }
    };
  });
}

function applyLayerUpdateEffect(
  command: Extract<CanvasCommand, { type: "layer.update" }>,
  current: EditorSnapshot,
  timestamp: string
): EditorEffect<ApplyCommandResult> {
  return Effect.gen(function* () {
    const index = current.document.scene.layers.findIndex(
      (layer) => layer.id === command.layerId
    );
    const layer = current.document.scene.layers[index];

    if (!layer) {
      return yield* layerNotFoundEffect(command.layerId, command.type);
    }

    const patch = yield* Effect.try({
      try: () => CanvasLayerPatchSchema.parse(command.patch),
      catch: (cause) =>
        new CanvasEditorError("invalid-command", "Layer patch validation failed.", {
          cause,
          commandType: command.type
        })
    });
    const patchKeys = Object.keys(patch);

    if (
      layer.locked &&
      !(
        patchKeys.length === 1 &&
        "locked" in patch &&
        patch.locked === false
      )
    ) {
      return yield* lockedTargetEffect(layer.id, command.type, "Layer");
    }

    const inversePatch: {
      locked?: CanvasLayer["locked"];
      metadata?: CanvasLayer["metadata"];
      name?: CanvasLayer["name"];
      visible?: CanvasLayer["visible"];
    } = {};
    let changed = false;

    for (const key of patchKeys) {
      switch (key) {
        case "locked":
          inversePatch.locked = layer.locked;
          changed ||= patch.locked !== layer.locked;
          break;
        case "metadata":
          inversePatch.metadata = layer.metadata;
          changed ||= !jsonEqual(patch.metadata, layer.metadata);
          break;
        case "name":
          inversePatch.name = layer.name;
          changed ||= patch.name !== layer.name;
          break;
        case "visible":
          inversePatch.visible = layer.visible;
          changed ||= patch.visible !== layer.visible;
          break;
        default:
          return yield* Effect.fail(
            new CanvasEditorError(
              "invalid-command",
              `Unsupported layer patch field: ${key}`,
              { commandType: command.type }
            )
          );
      }
    }

    if (!changed) {
      return {
        affectedNodeIds: [],
        persistent: false,
        snapshot: current
      };
    }

    const nextLayers = [...current.document.scene.layers];
    nextLayers[index] = { ...layer, ...patch };
    const document = yield* parseDocumentEffect(
      {
        ...current.document,
        scene: {
          ...current.document.scene,
          layers: nextLayers
        },
        updatedAt: timestamp
      },
      "invalid-command",
      command.type
    );
    const updatedLayer = document.scene.layers[index];

    if (!updatedLayer) {
      return yield* Effect.fail(
        new CanvasEditorError(
          "internal-error",
          "Updated layer was not retained.",
          { commandType: command.type }
        )
      );
    }
    const inversePatchValue = CanvasLayerPatchSchema.parse(inversePatch);
    const inverse = createLayerUpdateInverse(
      layer.id,
      inversePatchValue,
      updatedLayer.locked
    );

    return {
      affectedNodeIds: current.document.scene.nodes
        .filter((node) => node.layerId === layer.id)
        .map((node) => node.id),
      inverse,
      persistent: true,
      snapshot: {
        document,
        selection: sanitizeSelectionForDocument(current.selection, document)
      }
    };
  });
}

function applyLayerRemoveEffect(
  command: Extract<CanvasCommand, { type: "layer.remove" }>,
  current: EditorSnapshot,
  timestamp: string
): EditorEffect<ApplyCommandResult> {
  return Effect.gen(function* () {
    const layers = current.document.scene.layers;
    const index = layers.findIndex((layer) => layer.id === command.layerId);
    const removedLayer = layers[index];

    if (!removedLayer) {
      return yield* layerNotFoundEffect(command.layerId, command.type);
    }

    if (layers.length === 1) {
      return yield* Effect.fail(
        new CanvasEditorError(
          "invalid-command",
          "The final scene layer cannot be removed.",
          { commandType: command.type }
        )
      );
    }

    const layerNodes = current.document.scene.nodes.filter(
      (node) => node.layerId === removedLayer.id
    );

    if (
      removedLayer.locked ||
      layerNodes.some((node) => getEffectiveNodeState(current.document, node.id).locked)
    ) {
      return yield* Effect.fail(
        new CanvasEditorError(
          "locked-target",
          `Layer removal includes a locked target: ${removedLayer.id}`,
          { commandType: command.type }
        )
      );
    }

    if (layerNodes.length === 0 && command.targetLayerId !== null) {
      return yield* Effect.fail(
        new CanvasEditorError(
          "invalid-command",
          "Removing an empty layer requires targetLayerId: null.",
          { commandType: command.type }
        )
      );
    }

    if (layerNodes.length > 0 && command.targetLayerId === null) {
      return yield* Effect.fail(
        new CanvasEditorError(
          "invalid-command",
          "Removing a non-empty layer requires an explicit targetLayerId.",
          { commandType: command.type }
        )
      );
    }

    const targetLayer =
      command.targetLayerId === null
        ? null
        : layers.find((layer) => layer.id === command.targetLayerId);

    if (command.targetLayerId !== null && !targetLayer) {
      return yield* layerNotFoundEffect(command.targetLayerId, command.type);
    }

    if (targetLayer?.locked) {
      return yield* Effect.fail(
        new CanvasEditorError(
          "locked-target",
          `Target layer is locked: ${targetLayer.id}`,
          { commandType: command.type }
        )
      );
    }

    const nextLayers = layers.filter((layer) => layer.id !== removedLayer.id);
    const nextNodes = targetLayer
      ? current.document.scene.nodes.map((node) =>
          node.layerId === removedLayer.id
            ? { ...node, layerId: targetLayer.id }
            : node
        )
      : current.document.scene.nodes;
    const document = yield* parseDocumentEffect(
      {
        ...current.document,
        scene: {
          ...current.document.scene,
          layers: nextLayers,
          nodes: nextNodes
        },
        updatedAt: timestamp
      },
      "invalid-command",
      command.type
    );
    const inverseCommands: CanvasCommand[] = [
      {
        index,
        layer: removedLayer,
        type: "layer.add"
      }
    ];

    if (targetLayer) {
      for (const node of layerNodes) {
        if (node.parentId !== null) {
          inverseCommands.push({
            ...getNodeIdentity(node),
            nodeId: node.id,
            patch: { parentId: null },
            type: "node.update"
          });
        }
      }

      for (const node of layerNodes) {
        inverseCommands.push({
          ...getNodeIdentity(node),
          nodeId: node.id,
          patch: { layerId: removedLayer.id },
          type: "node.update"
        });
      }

      for (const node of layerNodes) {
        if (node.parentId !== null) {
          inverseCommands.push({
            ...getNodeIdentity(node),
            nodeId: node.id,
            patch: { parentId: node.parentId },
            type: "node.update"
          });
        }
      }
    }

    const firstInverse = inverseCommands[0];

    if (!firstInverse) {
      return yield* Effect.fail(
        new CanvasEditorError(
          "internal-error",
          "Layer removal did not produce an inverse command.",
          { commandType: command.type }
        )
      );
    }

    return {
      affectedNodeIds: layerNodes.map((node) => node.id),
      inverse:
        inverseCommands.length === 1
          ? firstInverse
          : { commands: inverseCommands, type: "transaction" },
      persistent: true,
      snapshot: {
        document,
        selection: current.selection
      }
    };
  });
}

function applyLayerReorderEffect(
  command: Extract<CanvasCommand, { type: "layer.reorder" }>,
  current: EditorSnapshot,
  timestamp: string
): EditorEffect<ApplyCommandResult> {
  return Effect.gen(function* () {
    const layers = current.document.scene.layers;
    const currentIndex = layers.findIndex((layer) => layer.id === command.layerId);

    if (currentIndex < 0) {
      return yield* layerNotFoundEffect(command.layerId, command.type);
    }

    if (
      !Number.isInteger(command.index) ||
      command.index < 0 ||
      command.index >= layers.length
    ) {
      return yield* Effect.fail(
        new CanvasEditorError(
          "invalid-command",
          `layer.reorder index must be an integer between 0 and ${layers.length - 1}.`,
          { commandType: command.type }
        )
      );
    }

    if (currentIndex === command.index) {
      return {
        affectedNodeIds: [],
        persistent: false,
        snapshot: current
      };
    }

    const nextLayers = [...layers];
    const [layer] = nextLayers.splice(currentIndex, 1);

    if (!layer) {
      return yield* layerNotFoundEffect(command.layerId, command.type);
    }

    nextLayers.splice(command.index, 0, layer);
    const document = yield* parseDocumentEffect(
      {
        ...current.document,
        scene: {
          ...current.document.scene,
          layers: nextLayers
        },
        updatedAt: timestamp
      },
      "invalid-command",
      command.type
    );

    return {
      affectedNodeIds: current.document.scene.nodes.map((node) => node.id),
      inverse: {
        index: currentIndex,
        layerId: command.layerId,
        type: "layer.reorder"
      },
      persistent: true,
      snapshot: {
        document,
        selection: current.selection
      }
    };
  });
}

export function applySelectionEffect(
  command: Extract<CanvasCommand, { type: "selection.set" }>,
  current: EditorSnapshot
): EditorEffect<ApplyCommandResult> {
  return Effect.gen(function* () {
    const selection = yield* parseSelectionForDocumentEffect(
      command.selection,
      current.document,
      command.type
    );

    return {
      affectedNodeIds: uniqueIds([
        ...current.selection.ids,
        ...selection.ids,
        ...(current.selection.hoveredId ? [current.selection.hoveredId] : []),
        ...(selection.hoveredId ? [selection.hoveredId] : [])
      ]),
      inverse: {
        selection: current.selection,
        type: "selection.set"
      },
      persistent: false,
      snapshot: {
        document: current.document,
        selection
      }
    };
  });
}

function applyTransactionEffect(
  command: Extract<CanvasCommand, { type: "transaction" }>,
  current: EditorSnapshot,
  timestamp: string,
  handlers: ReadonlyMap<CanvasPluginCommandType, RegisteredPluginCommand>
): EditorEffect<ApplyCommandResult> {
  return Effect.gen(function* () {
    if (!Array.isArray(command.commands) || command.commands.length === 0) {
      return yield* Effect.fail(
        new CanvasEditorError(
          "invalid-command",
          "transaction commands must be a non-empty array.",
          { commandType: command.type }
        )
      );
    }

    let next = current;
    let persistent = false;
    const affectedNodeIds: NodeId[] = [];
    const inverseCommands: CanvasCommand[] = [];

    for (const child of command.commands) {
      const applied = yield* applyCommandEffect(child, next, timestamp, handlers);
      next = applied.snapshot;
      persistent ||= applied.persistent;
      affectedNodeIds.push(...applied.affectedNodeIds);

      if (applied.inverse) {
        inverseCommands.unshift(applied.inverse);
      }
    }

    return {
      affectedNodeIds: uniqueIds(affectedNodeIds),
      ...(inverseCommands.length === command.commands.length
        ? {
            inverse: {
              commands: inverseCommands,
              type: "transaction" as const
            }
          }
        : {}),
      persistent,
      snapshot: next
    };
  });
}

function applyPluginCommandEffect(
  command: CanvasPluginCommand,
  current: EditorSnapshot,
  timestamp: string,
  handlers: ReadonlyMap<CanvasPluginCommandType, RegisteredPluginCommand>
): EditorEffect<ApplyCommandResult> {
  return Effect.gen(function* () {
    const commandType = command.type;

    const registration = handlers.get(commandType);

    if (!registration) {
      return yield* Effect.fail(
        new CanvasEditorError(
          "unsupported-command",
          `No command handler is registered for: ${commandType}`,
          { commandType }
        )
      );
    }

    const result = yield* Effect.tryPromise({
      try: () => Promise.resolve(registration.execute(command, current)),
      catch: (cause) =>
        cause instanceof PluginPayloadValidationFailure
          ? new CanvasEditorError(
              "invalid-command",
              `Plugin command payload validation failed: ${commandType}`,
              { cause: cause.cause, commandType }
            )
          : new CanvasEditorError(
              "command-handler-failed",
              `Command handler failed: ${commandType}`,
              { cause, commandType }
            )
    });

    if (!isPlainObject(result) || !("document" in result)) {
      return yield* Effect.fail(
        new CanvasEditorError(
          "invalid-handler-result",
          `Command handler returned an invalid result: ${commandType}`,
          { commandType }
        )
      );
    }

    const parsedDocument = yield* parseDocumentEffect(
      result.document,
      "invalid-handler-result",
      commandType
    );
    const persistent = !jsonEqual(parsedDocument, current.document);
    const document = persistent
      ? yield* parseDocumentEffect(
          {
            ...parsedDocument,
            updatedAt: timestamp
          },
          "invalid-handler-result",
          commandType
        )
      : current.document;
    const selection = yield* parseSelectionForDocumentEffect(
      result.selection ?? current.selection,
      document,
      commandType,
      "invalid-handler-result"
    );
    const inverse =
      result.inverse === undefined
        ? undefined
        : yield* parseCommandEffect(
            result.inverse,
            "invalid-handler-result",
            commandType
          );

    return {
      affectedNodeIds: persistent
        ? uniqueIds([
            ...current.document.scene.nodes.map((node) => node.id),
            ...document.scene.nodes.map((node) => node.id)
          ])
        : [],
      ...(inverse === undefined ? {} : { inverse }),
      persistent,
      snapshot: {
        document,
        selection
      }
    };
  });
}

function parseCommandEffect(
  input: unknown,
  code: "invalid-command" | "invalid-handler-result",
  commandType?: string
): EditorEffect<CanvasCommand> {
  return Effect.try({
    try: () => freezeValue(CanvasCommandSchema.parse(input)),
    catch: (cause) =>
      new CanvasEditorError(code, "Canvas command validation failed.", {
        cause,
        ...(commandType === undefined ? {} : { commandType })
      })
  });
}


export function createInitialSnapshot(
  documentInput: CanvasDocumentInput,
  selectionInput: unknown
): EditorSnapshot {
  const documentResult = Effect.runSync(
    Effect.either(parseDocumentEffect(documentInput, "invalid-document"))
  );

  if (Either.isLeft(documentResult)) {
    throw documentResult.left;
  }

  const selectionResult = Effect.runSync(
    Effect.either(
      parseSelectionForDocumentEffect(
        selectionInput === undefined ? {} : selectionInput,
        documentResult.right
      )
    )
  );

  if (Either.isLeft(selectionResult)) {
    throw selectionResult.left;
  }

  return freezeValue({
    document: documentResult.right,
    selection: selectionResult.right
  });
}

export function getCommandTypeEffect(command: CanvasCommand): EditorEffect<string> {
  if (!isPlainObject(command) || typeof command.type !== "string") {
    return Effect.fail(
      new CanvasEditorError(
        "invalid-command",
        "A command must be an object with a string type."
      )
    );
  }

  return Effect.succeed(command.type);
}

export function getCommandTimestampEffect(
  command: CanvasCommand,
  now: () => string
): EditorEffect<string> {
  return Effect.try({
    try: () => command.timestamp ?? now(),
    catch: (cause) =>
      new CanvasEditorError("invalid-command", "Editor clock failed.", {
        cause,
        commandType: command.type
      })
  }).pipe(
    Effect.flatMap((timestamp) =>
      typeof timestamp === "string" && timestamp.length > 0
        ? Effect.succeed(timestamp)
        : Effect.fail(
            new CanvasEditorError(
              "invalid-command",
              "Command timestamp must be a non-empty string.",
              { commandType: command.type }
            )
          )
    )
  );
}

function nodeNotFoundEffect(
  nodeId: NodeId,
  commandType: string
): EditorEffect<never> {
  return Effect.fail(
    new CanvasEditorError("node-not-found", `Node was not found: ${nodeId}`, {
      commandType
    })
  );
}

function layerNotFoundEffect(
  layerId: CanvasLayerId,
  commandType: string
): EditorEffect<never> {
  return Effect.fail(
    new CanvasEditorError("layer-not-found", `Layer was not found: ${layerId}`, {
      commandType
    })
  );
}

function lockedTargetEffect(
  id: NodeId | CanvasLayerId,
  commandType: string,
  targetKind: "Layer" | "Node" | "Parent group"
): EditorEffect<never> {
  return Effect.fail(
    new CanvasEditorError(
      "locked-target",
      `${targetKind} is effectively locked: ${id}`,
      { commandType }
    )
  );
}
