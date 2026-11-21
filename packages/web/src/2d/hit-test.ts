/**
 * Hit-testing for the 2D scene: which node (and which part of it) is under a
 * scene-space point.
 *
 * These read from the passed context for text metrics but never draw, and they
 * share geometry helpers with the renderer so what is clickable matches what is
 * visible.
 */
import {
  CANVAS_NODE_PORT_SIDES,
  isCanvas2DPluginNode,
  isPluginNodeType,
  type Canvas2DNode,
  type Canvas2DScene,
  type CanvasNodeTransformPreview
} from "@denovo/canvas-core";

import {
  CANVAS_2D_ANCHOR_HIT_RADIUS,
  CANVAS_2D_ANNOTATION_FONT,
  CANVAS_2D_ANNOTATION_TEXT_OFFSET,
  CANVAS_2D_CONNECTION_HANDLE_HIT_RADIUS,
  CANVAS_2D_MEASUREMENT_FONT,
  CANVAS_2D_MEASUREMENT_LABEL_OFFSET,
  CANVAS_2D_SEGMENT_HIT_TOLERANCE
} from "./constants";
import {
  distanceFromPointToSegment,
  getCanvas2DMidpoint,
  isCanvas2DConnectableNode,
  isPointInsideCanvas2DShape,
  isPointInsideRectangle,
  resolveCanvas2DConnectionHandlePoint,
  resolveCanvas2DEdgeGeometry,
  resolveCanvas2DNodeWorldBounds,
  resolveNodeRenderTransform,
  type Canvas2DEdgeNode
} from "./geometry";
import {
  CANVAS_2D_IDENTITY_MATRIX,
  createCanvas2DTransformMatrix,
  multiplyCanvas2DMatrices,
  transformCanvas2DPoint,
  tryInvertCanvas2DMatrix,
  type Canvas2DMatrix
} from "./matrix";
import {
  getCanvas2DGroupChildren,
  getCanvas2DLayerRoots,
  isNodeEffectivelyLocked,
  isNodeEffectivelyVisible,
  type Canvas2DAnnotationNode,
  type Canvas2DDrawableNode,
  type Canvas2DMeasurementNode,
  type Canvas2DSceneGraph,
  type Canvas2DShapeNode,
  type Canvas2DTransformNode
} from "./scene-graph";
import {
  measureCanvas2DText,
  resolveCanvas2DMeasurementLabel,
  wrapCanvas2DText
} from "./text";

type Canvas2DTextNode = Extract<Canvas2DNode, { type: "text" }>;

export type Canvas2DNodeHit = {
  readonly node: Canvas2DDrawableNode;
  readonly subTarget?: string;
};

export function hitTestSceneGraph(
  context: CanvasRenderingContext2D,
  scene: Canvas2DScene,
  sceneGraph: Canvas2DSceneGraph,
  scenePoint: readonly [number, number],
  preview: CanvasNodeTransformPreview | null
): Canvas2DNodeHit | null {
  for (const layer of [...scene.layers].reverse()) {
    if (!layer.visible) {
      continue;
    }

    const roots = getCanvas2DLayerRoots(sceneGraph, layer.id);

    for (const root of [...roots].reverse()) {
      const hit = hitTestCanvas2DTreeNode(
        context,
        root,
        sceneGraph,
        CANVAS_2D_IDENTITY_MATRIX,
        scenePoint,
        preview
      );

      if (hit) {
        return hit;
      }
    }
  }

  return null;
}
export function hitTestCanvas2DTreeNode(
  context: CanvasRenderingContext2D,
  node: Canvas2DNode,
  sceneGraph: Canvas2DSceneGraph,
  parentWorldTransform: Canvas2DMatrix,
  scenePoint: readonly [number, number],
  preview: CanvasNodeTransformPreview | null
): Canvas2DNodeHit | null {
  if (!node.visible) {
    return null;
  }

  if (node.type !== "group") {
    return hitTestCanvas2DDrawableNode(
      context,
      node,
      parentWorldTransform,
      scenePoint,
      preview,
      sceneGraph
    );
  }

  const worldTransform = multiplyCanvas2DMatrices(
    parentWorldTransform,
    createCanvas2DTransformMatrix(resolveNodeRenderTransform(node, preview))
  );

  for (const child of [
    ...getCanvas2DGroupChildren(sceneGraph, node.id)
  ].reverse()) {
    const hit = hitTestCanvas2DTreeNode(
      context,
      child,
      sceneGraph,
      worldTransform,
      scenePoint,
      preview
    );

    if (hit) {
      return hit;
    }
  }

  return null;
}
export function hitTestCanvas2DDrawableNode(
  context: CanvasRenderingContext2D,
  node: Canvas2DDrawableNode,
  parentWorldTransform: Canvas2DMatrix,
  scenePoint: readonly [number, number],
  preview: CanvasNodeTransformPreview | null,
  sceneGraph: Canvas2DSceneGraph
): Canvas2DNodeHit | null {
  if (node.type === "edge") {
    return hitTestCanvas2DEdgeNode(node, scenePoint, sceneGraph);
  }

  if (isCanvas2DShapeNode(node)) {
    const worldTransform = multiplyCanvas2DMatrices(
      parentWorldTransform,
      createCanvas2DTransformMatrix(resolveNodeRenderTransform(node, preview))
    );
    const inverse = tryInvertCanvas2DMatrix(worldTransform);

    if (!inverse) {
      return null;
    }

    const localPoint = transformCanvas2DPoint(inverse, scenePoint);
    return isPointInsideCanvas2DShape(localPoint, node) ? { node } : null;
  }

  const inverse = tryInvertCanvas2DMatrix(parentWorldTransform);

  if (!inverse) {
    return null;
  }

  const localPoint = transformCanvas2DPoint(inverse, scenePoint);

  switch (node.type) {
    case "measurement":
      return hitTestCanvas2DMeasurementNode(
        context,
        node,
        parentWorldTransform,
        localPoint
      );
    case "annotation":
      return hitTestCanvas2DAnnotationNode(context, node, localPoint);
    case "text":
      return hitTestCanvas2DTextNode(context, node, localPoint);
    case "html": {
      const bounds = resolveCanvas2DNodeWorldBounds(node, sceneGraph);
      return isPointInsideRectangle(scenePoint, bounds) ? { node } : null;
    }
    default: {
      if (isCanvas2DPluginNode(node)) {
        const bounds = resolveCanvas2DNodeWorldBounds(node, sceneGraph);
        return isPointInsideRectangle(scenePoint, bounds) ? { node } : null;
      }
      const exhaustive: never = node;
      return exhaustive;
    }
  }
}
export function hitTestCanvas2DEdgeNode(
  node: Canvas2DEdgeNode,
  scenePoint: readonly [number, number],
  sceneGraph: Canvas2DSceneGraph
): Canvas2DNodeHit | null {
  const source = sceneGraph.nodesById.get(node.sourceId);
  const target = sceneGraph.nodesById.get(node.targetId);

  if (!source || !target) {
    return null;
  }

  const { start, end, waypoints, control } = resolveCanvas2DEdgeGeometry(
    node,
    sceneGraph
  );

  if (
    Math.hypot(scenePoint[0] - start[0], scenePoint[1] - start[1]) <=
    CANVAS_2D_ANCHOR_HIT_RADIUS
  ) {
    return { node, subTarget: "edge.source" };
  }
  if (
    Math.hypot(scenePoint[0] - end[0], scenePoint[1] - end[1]) <=
    CANVAS_2D_ANCHOR_HIT_RADIUS
  ) {
    return { node, subTarget: "edge.target" };
  }

  const tolerance = Math.max(node.strokeWidth, 6);

  if (control) {
    // Flatten the quadratic into segments and test each.
    let previous = start;
    for (let step = 1; step <= 16; step += 1) {
      const t = step / 16;
      const mt = 1 - t;
      const point: readonly [number, number] = [
        mt * mt * start[0] + 2 * mt * t * control[0] + t * t * end[0],
        mt * mt * start[1] + 2 * mt * t * control[1] + t * t * end[1]
      ];
      if (distanceFromPointToSegment(scenePoint, previous, point) <= tolerance) {
        return { node, subTarget: "edge.body" };
      }
      previous = point;
    }
    return null;
  }

  // Straight edges have no waypoints, so this covers them and the orthogonal
  // polyline with the same walk.
  let previous = start;
  for (const point of waypoints.length > 0 ? waypoints : [end]) {
    if (distanceFromPointToSegment(scenePoint, previous, point) <= tolerance) {
      return { node, subTarget: "edge.body" };
    }
    previous = point;
  }

  return null;
}
export function hitTestCanvas2DTextNode(
  context: CanvasRenderingContext2D,
  node: Canvas2DTextNode,
  localPoint: readonly [number, number]
): Canvas2DNodeHit | null {
  const font = `${node.fontWeight} ${node.fontSize}px ${node.fontFamily}`;
  const lines = wrapCanvas2DText(context, font, node.text, node.width);
  const lineHeight = node.fontSize * 1.2;
  const height = lines.length * lineHeight;
  const maxWidth = Math.max(
    ...lines.map((line) => measureCanvas2DText(context, font, line))
  );
  const minX = node.align === "center" ? -maxWidth / 2 : node.align === "right" ? -maxWidth : 0;

  return isPointInsideRectangle(localPoint, {
    minX,
    minY: 0,
    maxX: minX + maxWidth,
    maxY: height
  })
    ? { node }
    : null;
}
export function hitTestCanvas2DMeasurementNode(
  context: CanvasRenderingContext2D,
  node: Canvas2DMeasurementNode,
  parentWorldTransform: Canvas2DMatrix,
  localPoint: readonly [number, number]
): Canvas2DNodeHit | null {
  const label = resolveCanvas2DMeasurementLabel(node, parentWorldTransform);
  const labelWidth = measureCanvas2DText(
    context,
    CANVAS_2D_MEASUREMENT_FONT,
    label
  );
  const midpoint = getCanvas2DMidpoint(node.start, node.end);
  const labelBaseline = midpoint[1] - CANVAS_2D_MEASUREMENT_LABEL_OFFSET;

  if (
    isPointInsideRectangle(localPoint, {
      maxX: midpoint[0] + labelWidth / 2,
      maxY: labelBaseline,
      minX: midpoint[0] - labelWidth / 2,
      minY: labelBaseline - 12
    })
  ) {
    return {
      node,
      subTarget: "measurement.label"
    };
  }

  return distanceFromPointToSegment(localPoint, node.start, node.end) <=
    CANVAS_2D_SEGMENT_HIT_TOLERANCE
    ? {
        node,
        subTarget: "measurement.segment"
      }
    : null;
}
export function hitTestCanvas2DAnnotationNode(
  context: CanvasRenderingContext2D,
  node: Canvas2DAnnotationNode,
  localPoint: readonly [number, number]
): Canvas2DNodeHit | null {
  const textWidth = measureCanvas2DText(
    context,
    CANVAS_2D_ANNOTATION_FONT,
    node.text
  );
  const textX = node.anchor[0] + CANVAS_2D_ANNOTATION_TEXT_OFFSET[0];
  const textBaseline = node.anchor[1] + CANVAS_2D_ANNOTATION_TEXT_OFFSET[1];

  if (
    isPointInsideRectangle(localPoint, {
      maxX: textX + textWidth,
      maxY: textBaseline,
      minX: textX,
      minY: textBaseline - 14
    })
  ) {
    return {
      node,
      subTarget: "annotation.text"
    };
  }

  return Math.hypot(
    localPoint[0] - node.anchor[0],
    localPoint[1] - node.anchor[1]
  ) <= CANVAS_2D_ANCHOR_HIT_RADIUS
    ? {
        node,
        subTarget: "annotation.anchor"
      }
    : null;
}
export function hitTestCanvas2DConnectionHandle(
  scene: Canvas2DScene,
  sceneGraph: Canvas2DSceneGraph,
  scenePoint: readonly [number, number],
  zoom: number
): { readonly nodeId: string; readonly subTarget: string } | null {
  const radius = CANVAS_2D_CONNECTION_HANDLE_HIT_RADIUS / zoom;

  // Iterate back-to-front so the topmost node's handles win, matching paint order.
  for (let index = scene.nodes.length - 1; index >= 0; index -= 1) {
    const node = scene.nodes[index]!;

    if (
      !isCanvas2DConnectableNode(node) ||
      !isNodeEffectivelyVisible(scene, sceneGraph, node) ||
      isNodeEffectivelyLocked(scene, sceneGraph, node)
    ) {
      continue;
    }

    const bounds = resolveCanvas2DNodeWorldBounds(node, sceneGraph);

    for (const side of CANVAS_NODE_PORT_SIDES) {
      const point = resolveCanvas2DConnectionHandlePoint(bounds, side);

      if (Math.hypot(scenePoint[0] - point[0], scenePoint[1] - point[1]) <= radius) {
        return { nodeId: node.id, subTarget: `handle.${side}` };
      }
    }
  }

  return null;
}
export function isCanvas2DShapeNode(node: Canvas2DNode): node is Canvas2DShapeNode {
  switch (node.type) {
    case "rect":
    case "circle":
      return true;
    case "group":
    case "measurement":
    case "annotation":
    case "edge":
    case "text":
    case "html":
      return false;
    default: {
      if (isCanvas2DPluginNode(node)) {
        return false;
      }
      const exhaustive: never = node;
      return exhaustive;
    }
  }
}
export function assertCanvas2DTransformNode(
  node: Canvas2DNode
): asserts node is Canvas2DTransformNode {
  if (
    !isCanvas2DShapeNode(node) &&
    node.type !== "html" &&
    node.type !== "group" &&
    !isPluginNodeType(node.type)
  ) {
    throw new Error(
      `Canvas2D transforms support rect, circle, html, group, and plugin nodes; received ${node.type}: ${node.id}`
    );
  }
}
