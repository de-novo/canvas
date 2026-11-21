/**
 * Scene-graph index and traversal for the 2D renderer.
 *
 * The graph is rebuilt whenever the scene changes and then read many times per
 * frame, so lookups are map-backed rather than repeated array scans. Pure: no
 * renderer or module state.
 */
import type {
  Canvas2DNode,
  Canvas2DPluginNode,
  Canvas2DScene
} from "@denovo/canvas-core";

export type Canvas2DShapeNode = Extract<
  Canvas2DNode,
  { type: "circle" | "rect" }
>;
export type Canvas2DGroupNode = Extract<Canvas2DNode, { type: "group" }>;
export type Canvas2DTransformNode =
  | Canvas2DShapeNode
  | Extract<Canvas2DNode, { type: "html" }>
  | Canvas2DGroupNode
  | Canvas2DPluginNode;
export type Canvas2DMeasurementNode = Extract<
  Canvas2DNode,
  { type: "measurement" }
>;
export type Canvas2DAnnotationNode = Extract<
  Canvas2DNode,
  { type: "annotation" }
>;
export type Canvas2DDrawableNode = Exclude<Canvas2DNode, Canvas2DGroupNode>;

export type Canvas2DSceneGraph = {
  readonly childrenByGroupId: ReadonlyMap<string, readonly Canvas2DNode[]>;
  readonly nodesById: ReadonlyMap<string, Canvas2DNode>;
  readonly rootsByLayerId: ReadonlyMap<string, readonly Canvas2DNode[]>;
};

export function createCanvas2DSceneGraph(
  scene: Canvas2DScene
): Canvas2DSceneGraph {
  const childrenByGroupId = new Map<string, Canvas2DNode[]>();
  const nodesById = new Map<string, Canvas2DNode>();
  const rootsByLayerId = new Map<string, Canvas2DNode[]>();

  for (const layer of scene.layers) {
    rootsByLayerId.set(layer.id, []);
  }

  for (const node of scene.nodes) {
    nodesById.set(node.id, node);

    if (node.type === "group") {
      childrenByGroupId.set(node.id, []);
    }
  }

  for (const node of scene.nodes) {
    if (node.parentId === null) {
      const roots = rootsByLayerId.get(node.layerId);

      if (!roots) {
        throw new Error(
          `Canvas2D scene graph is missing layer ${node.layerId} for node ${node.id}.`
        );
      }

      roots.push(node);
      continue;
    }

    const parent = nodesById.get(node.parentId);

    if (!parent || parent.type !== "group") {
      throw new Error(
        `Canvas2D scene graph requires group parent ${node.parentId} for node ${node.id}.`
      );
    }

    const children = childrenByGroupId.get(parent.id);

    if (!children) {
      throw new Error(`Canvas2D scene graph is missing group ${parent.id}.`);
    }

    children.push(node);
  }

  return {
    childrenByGroupId,
    nodesById,
    rootsByLayerId
  };
}

/** Visible only when the node, its layer, and every ancestor group are visible. */
export function isNodeEffectivelyVisible(
  scene: Canvas2DScene,
  sceneGraph: Canvas2DSceneGraph,
  node: Canvas2DNode
): boolean {
  if (!getCanvas2DLayer(scene, node.layerId).visible || !node.visible) {
    return false;
  }

  for (const ancestor of getCanvas2DAncestors(node, sceneGraph)) {
    if (!ancestor.visible) {
      return false;
    }
  }

  return true;
}

/** Locked when the node, its layer, or any ancestor group is locked. */
export function isNodeEffectivelyLocked(
  scene: Canvas2DScene,
  sceneGraph: Canvas2DSceneGraph,
  node: Canvas2DNode
): boolean {
  if (getCanvas2DLayer(scene, node.layerId).locked || node.locked) {
    return true;
  }

  return getCanvas2DAncestors(node, sceneGraph).some(
    (ancestor) => ancestor.locked
  );
}

export function getCanvas2DLayer(
  scene: Canvas2DScene,
  layerId: string
): Canvas2DScene["layers"][number] {
  const layer = scene.layers.find((candidate) => candidate.id === layerId);

  if (!layer) {
    throw new Error(`Canvas2D scene graph is missing layer: ${layerId}`);
  }

  return layer;
}

export function getCanvas2DLayerRoots(
  sceneGraph: Canvas2DSceneGraph,
  layerId: string
): readonly Canvas2DNode[] {
  const roots = sceneGraph.rootsByLayerId.get(layerId);

  if (!roots) {
    throw new Error(`Canvas2D scene graph is missing layer roots: ${layerId}`);
  }

  return roots;
}

export function getCanvas2DGroupChildren(
  sceneGraph: Canvas2DSceneGraph,
  groupId: string
): readonly Canvas2DNode[] {
  const children = sceneGraph.childrenByGroupId.get(groupId);

  if (!children) {
    throw new Error(`Canvas2D scene graph is missing group children: ${groupId}`);
  }

  return children;
}

/** Ancestor groups, innermost first. */
export function getCanvas2DAncestors(
  node: Canvas2DNode,
  sceneGraph: Canvas2DSceneGraph
): readonly Canvas2DGroupNode[] {
  const ancestors: Canvas2DGroupNode[] = [];
  let parentId = node.parentId;

  while (parentId !== null) {
    const parent = sceneGraph.nodesById.get(parentId);

    if (!parent || parent.type !== "group") {
      throw new Error(
        `Canvas2D scene graph requires group ancestor ${parentId} for node ${node.id}.`
      );
    }

    ancestors.push(parent);
    parentId = parent.parentId;
  }

  return ancestors;
}
