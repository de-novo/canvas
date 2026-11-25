import type { CanvasDocument, NodeId } from "@de-novo/canvas-core";
import { CanvasEditorError } from "./errors.js";
import { freezeValue } from "./utils.js";

export type CanvasEffectiveNodeState = {
  readonly locked: boolean;
  readonly visible: boolean;
};

export type ResolvedEffectiveNodeState = CanvasEffectiveNodeState & {
  readonly lockedByHierarchy: boolean;
};

export function getEffectiveNodeState(
  document: CanvasDocument,
  nodeId: NodeId
): CanvasEffectiveNodeState {
  const state = resolveEffectiveNodeState(document, nodeId);
  return freezeValue({ locked: state.locked, visible: state.visible });
}

export function isNodeEffectivelyLocked(
  document: CanvasDocument,
  nodeId: NodeId
): boolean {
  return resolveEffectiveNodeState(document, nodeId).locked;
}

export function isNodeEffectivelyVisible(
  document: CanvasDocument,
  nodeId: NodeId
): boolean {
  return resolveEffectiveNodeState(document, nodeId).visible;
}

const nodeByIdByNodesArray = new WeakMap<
  readonly CanvasDocument["scene"]["nodes"][number][],
  Map<string, CanvasDocument["scene"]["nodes"][number]>
>();

function getNodeByIdMap(
  nodes: CanvasDocument["scene"]["nodes"]
): Map<string, CanvasDocument["scene"]["nodes"][number]> {
  let map = nodeByIdByNodesArray.get(nodes);
  if (!map) {
    map = new Map();
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]!;
      map.set(node.id, node);
    }
    nodeByIdByNodesArray.set(nodes, map);
  }
  return map;
}

export function resolveEffectiveNodeState(
  document: CanvasDocument,
  nodeId: NodeId
): ResolvedEffectiveNodeState {
  const nodeById = getNodeByIdMap(document.scene.nodes);
  const node = nodeById.get(nodeId);

  if (!node) {
    throw new CanvasEditorError(
      "node-not-found",
      `Node was not found: ${nodeId}`
    );
  }

  const layer = document.scene.layers.find(
    (candidate) => candidate.id === node.layerId
  );

  if (!layer) {
    throw new CanvasEditorError(
      "layer-not-found",
      `Layer was not found: ${node.layerId}`
    );
  }

  let lockedByHierarchy = layer.locked;
  let locked = node.locked || lockedByHierarchy;
  let visible = node.visible && layer.visible;
  let parentId = node.parentId;
  const visited = new Set<NodeId>([node.id]);

  while (parentId !== null) {
    if (visited.has(parentId)) {
      throw new CanvasEditorError(
        "invalid-document",
        `Node hierarchy contains a cycle at: ${parentId}`
      );
    }

    visited.add(parentId);
    const parent = nodeById.get(parentId);

    if (!parent || parent.type !== "group") {
      throw new CanvasEditorError(
        "invalid-document",
        `Node parent is not a group: ${parentId}`
      );
    }

    lockedByHierarchy ||= parent.locked;
    locked ||= parent.locked;
    visible &&= parent.visible;
    parentId = parent.parentId;
  }

  return { locked, lockedByHierarchy, visible };
}