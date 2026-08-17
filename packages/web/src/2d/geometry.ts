/**
 * World-space geometry for the 2D renderer: node transforms, bounds, edge
 * routing, and the point/segment tests that hit-testing and layout share.
 *
 * Bounds and edge routing are mutually recursive — an edge's bounds come from
 * its endpoints, and a port endpoint comes from the node's bounds — so they
 * live together rather than in separate modules that would import each other.
 *
 * Pure: arguments in, values out. No renderer or module state.
 */
import {
  CANVAS_NODE_PORT_SIDES,
  type Canvas2DNode,
  type Canvas2DScene,
  type CanvasNodePortSide,
  type CanvasNodeTransformPreview
} from "@denovo/canvas-core";

import type { Canvas2DRectBounds } from "../view2d";
import {
  CANVAS_2D_IDENTITY_MATRIX,
  createCanvas2DTransformMatrix,
  multiplyCanvas2DMatrices,
  transformCanvas2DPoint,
  type Canvas2DMatrix,
  type Canvas2DNodeRenderTransform
} from "./matrix";
import {
  getCanvas2DAncestors,
  getCanvas2DGroupChildren,
  isNodeEffectivelyLocked,
  isNodeEffectivelyVisible,
  type Canvas2DSceneGraph,
  type Canvas2DShapeNode,
  type Canvas2DTransformNode
} from "./scene-graph";

export type Canvas2DEdgeNode = Extract<Canvas2DNode, { type: "edge" }>;

/**
 * The complete path an edge draws, in world space. Rendering, hit-testing and
 * bounds all read this so they cannot disagree about where an edge actually is.
 */
export type Canvas2DEdgeGeometry = {
  readonly start: readonly [number, number];
  readonly end: readonly [number, number];
  readonly waypoints: readonly (readonly [number, number])[];
  readonly control: readonly [number, number] | null;
};

/** Length of the straight stub an orthogonal edge leaves a port with. */
const CANVAS_2D_PORT_STUB_LENGTH = 24;

export function resolveNodeRenderTransform(
  node: Canvas2DTransformNode,
  preview: CanvasNodeTransformPreview | null
): Canvas2DNodeRenderTransform {
  if (!preview || preview.nodeId !== node.id) {
    return {
      position: node.position,
      rotation: node.rotation,
      scale: node.scale
    };
  }

  if (preview.mode !== "2d") {
    throw new Error(`Canvas2D cannot render a 3D transform preview: ${node.id}`);
  }

  switch (preview.kind) {
    case "translate":
      return {
        position: preview.position,
        rotation: node.rotation,
        scale: node.scale
      };
    case "rotate":
      return {
        position: node.position,
        rotation: preview.rotation,
        scale: node.scale
      };
    case "scale":
      return {
        position: node.position,
        rotation: node.rotation,
        scale: preview.scale
      };
    default: {
      const exhaustive: never = preview;
      return exhaustive;
    }
  }
}
export function isPointInsideCanvas2DShape(
  point: readonly [number, number],
  node: Canvas2DShapeNode
): boolean {
  if (node.type === "circle") {
    return (
      point[0] * point[0] + point[1] * point[1] <= node.radius * node.radius
    );
  }

  return isPointInsideRectangle(point, {
    maxX: Math.max(0, node.size[0]),
    maxY: Math.max(0, node.size[1]),
    minX: Math.min(0, node.size[0]),
    minY: Math.min(0, node.size[1])
  });
}
export function isPointInsideRectangle(
  point: readonly [number, number],
  bounds: {
    readonly maxX: number;
    readonly maxY: number;
    readonly minX: number;
    readonly minY: number;
  }
): boolean {
  return (
    point[0] >= bounds.minX &&
    point[0] <= bounds.maxX &&
    point[1] >= bounds.minY &&
    point[1] <= bounds.maxY
  );
}
export function rectsIntersect(
  a: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number },
  b: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number }
): boolean {
  return (
    a.minX <= b.maxX &&
    a.maxX >= b.minX &&
    a.minY <= b.maxY &&
    a.maxY >= b.minY
  );
}
export function getCanvas2DMidpoint(
  start: readonly [number, number],
  end: readonly [number, number]
): readonly [number, number] {
  return [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
}
export function distanceFromPointToSegment(
  point: readonly [number, number],
  start: readonly [number, number],
  end: readonly [number, number]
): number {
  const segmentX = end[0] - start[0];
  const segmentY = end[1] - start[1];
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (lengthSquared === 0) {
    return Math.hypot(point[0] - start[0], point[1] - start[1]);
  }

  const projection = Math.min(
    1,
    Math.max(
      0,
      ((point[0] - start[0]) * segmentX +
        (point[1] - start[1]) * segmentY) /
        lengthSquared
    )
  );
  return Math.hypot(
    point[0] - (start[0] + projection * segmentX),
    point[1] - (start[1] + projection * segmentY)
  );
}
export function resolveParentWorldTransform(
  node: Canvas2DNode,
  sceneGraph: Canvas2DSceneGraph
): Canvas2DMatrix {
  let transform = CANVAS_2D_IDENTITY_MATRIX;

  for (const ancestor of [...getCanvas2DAncestors(node, sceneGraph)].reverse()) {
    transform = multiplyCanvas2DMatrices(
      transform,
      createCanvas2DTransformMatrix(ancestor)
    );
  }

  return transform;
}
/**
 * Resolves a node's own local→world transform by composing its parent's world
 * transform with its own {position, rotation, scale}. Non-transform nodes
 * (measurement/annotation/edge) use the identity own-transform — their
 * geometry is already expressed in scene coordinates.
 */
export function resolveCanvas2DNodeWorldTransform(
  node: Canvas2DNode,
  sceneGraph: Canvas2DSceneGraph
): Canvas2DMatrix {
  const parentWorld = resolveParentWorldTransform(node, sceneGraph);

  if (
    node.type === "rect" ||
    node.type === "circle" ||
    node.type === "group" ||
    node.type === "text"
  ) {
    return multiplyCanvas2DMatrices(
      parentWorld,
      createCanvas2DTransformMatrix({
        position: node.position,
        rotation: node.rotation,
        scale: node.scale
      })
    );
  }

  return parentWorld;
}
/**
 * Resolves a node's center in world (scene) coordinates. Used by edge endpoint
 * routing and the diagram camera (`flyToNode`). Per-type: shapes use their
 * local center (rect→size/2, circle→origin); group recurses to the centroid of
 * its children's centers; measurement/annotation use their scene-space anchor;
 * edge uses the midpoint of its endpoints (resolved recursively).
 */
export function resolveCanvas2DNodeWorldCenter(
  node: Canvas2DNode,
  sceneGraph: Canvas2DSceneGraph
): readonly [number, number] {
  switch (node.type) {
    case "rect": {
      const world = resolveCanvas2DNodeWorldTransform(node, sceneGraph);
      return transformCanvas2DPoint(world, [
        node.size[0] / 2,
        node.size[1] / 2
      ]);
    }
    case "circle": {
      const world = resolveCanvas2DNodeWorldTransform(node, sceneGraph);
      return transformCanvas2DPoint(world, [0, 0]);
    }
    case "group": {
      const children = getCanvas2DGroupChildren(sceneGraph, node.id);
      if (children.length === 0) {
        const world = resolveCanvas2DNodeWorldTransform(node, sceneGraph);
        return [world[4], world[5]] as const;
      }
      let sumX = 0;
      let sumY = 0;
      for (const child of children) {
        const center = resolveCanvas2DNodeWorldCenter(child, sceneGraph);
        sumX += center[0];
        sumY += center[1];
      }
      return [sumX / children.length, sumY / children.length];
    }
    case "measurement":
      return [
        (node.start[0] + node.end[0]) / 2,
        (node.start[1] + node.end[1]) / 2
      ];
    case "annotation":
      return [node.anchor[0], node.anchor[1]];
    case "edge": {
      const source = sceneGraph.nodesById.get(node.sourceId);
      const target = sceneGraph.nodesById.get(node.targetId);
      const sourceCenter = source
        ? resolveCanvas2DNodeWorldCenter(source, sceneGraph)
        : ([0, 0] as const);
      const targetCenter = target
        ? resolveCanvas2DNodeWorldCenter(target, sceneGraph)
        : ([0, 0] as const);
      return [
        (sourceCenter[0] + targetCenter[0]) / 2,
        (sourceCenter[1] + targetCenter[1]) / 2
      ];
    }
    case "text": {
      const world = resolveCanvas2DNodeWorldTransform(node, sceneGraph);
      return transformCanvas2DPoint(world, [0, 0]);
    }
    case "html": {
      const world = resolveCanvas2DNodeWorldTransform(node, sceneGraph);
      return transformCanvas2DPoint(world, [0, 0]);
    }
  }
}
/**
 * Axis-aligned world bounds for a node. Used by marquee selection (rect-rect
 * intersection) and by the minimap. Rotated nodes yield the bounds of their
 * transformed corners, so the box stays conservative rather than exact.
 */
export function resolveCanvas2DNodeWorldBounds(
  node: Canvas2DNode,
  sceneGraph: Canvas2DSceneGraph
): Canvas2DRectBounds {
  switch (node.type) {
    case "rect": {
      const world = resolveCanvas2DNodeWorldTransform(node, sceneGraph);
      return boundsFromPoints([
        transformCanvas2DPoint(world, [0, 0]),
        transformCanvas2DPoint(world, [node.size[0], 0]),
        transformCanvas2DPoint(world, [node.size[0], node.size[1]]),
        transformCanvas2DPoint(world, [0, node.size[1]])
      ]);
    }
    case "circle": {
      const center = resolveCanvas2DNodeWorldCenter(node, sceneGraph);
      return {
        minX: center[0] - node.radius,
        minY: center[1] - node.radius,
        maxX: center[0] + node.radius,
        maxY: center[1] + node.radius
      };
    }
    case "group": {
      const children = getCanvas2DGroupChildren(sceneGraph, node.id);
      if (children.length === 0) {
        const center = resolveCanvas2DNodeWorldCenter(node, sceneGraph);
        return { minX: center[0], minY: center[1], maxX: center[0], maxY: center[1] };
      }
      let bounds = resolveCanvas2DNodeWorldBounds(children[0]!, sceneGraph);
      for (const child of children.slice(1)) {
        const childBounds = resolveCanvas2DNodeWorldBounds(child, sceneGraph);
        bounds = {
          minX: Math.min(bounds.minX, childBounds.minX),
          minY: Math.min(bounds.minY, childBounds.minY),
          maxX: Math.max(bounds.maxX, childBounds.maxX),
          maxY: Math.max(bounds.maxY, childBounds.maxY)
        };
      }
      return bounds;
    }
    case "measurement":
      return boundsFromPoints([node.start, node.end]);
    case "edge": {
      const { start, end, waypoints, control } = resolveCanvas2DEdgeGeometry(
        node,
        sceneGraph
      );
      // Bends and the curve's control point extend past the endpoints, so they
      // have to be included or marquee/minimap bounds clip the visible edge.
      return boundsFromPoints([
        start,
        end,
        ...waypoints,
        ...(control ? [control] : [])
      ]);
    }
    case "text": {
      const center = resolveCanvas2DNodeWorldCenter(node, sceneGraph);
      const width = node.width ?? node.fontSize * Math.max(1, node.text.length) * 0.6;
      return {
        minX: center[0],
        minY: center[1] - node.fontSize,
        maxX: center[0] + width,
        maxY: center[1]
      };
    }
    case "html": {
      const center = resolveCanvas2DNodeWorldCenter(node, sceneGraph);
      return {
        minX: center[0],
        minY: center[1],
        maxX: center[0] + (node.width ?? 0),
        maxY: center[1] + (node.height ?? 0)
      };
    }
    case "annotation":
      return {
        minX: node.anchor[0],
        minY: node.anchor[1],
        maxX: node.anchor[0],
        maxY: node.anchor[1]
      };
  }
}
export function boundsFromPoints(
  points: readonly (readonly [number, number])[]
): Canvas2DRectBounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return { minX, minY, maxX, maxY };
}
/**
 * Resolves an edge endpoint to a world-space point. When the edge names a port
 * side, the endpoint sits on that side of the node's bounds — the same point the
 * connection handle is drawn at — otherwise it falls back to the node centre.
 * The anchor offset is applied in both cases.
 */
export function resolveCanvas2DEdgeEndpoint(
  node: Canvas2DEdgeNode,
  sceneGraph: Canvas2DSceneGraph,
  which: "source" | "target"
): readonly [number, number] {
  const endpointNode =
    which === "source"
      ? sceneGraph.nodesById.get(node.sourceId)
      : sceneGraph.nodesById.get(node.targetId);

  if (!endpointNode) {
    return [0, 0];
  }

  const port = which === "source" ? node.sourcePort : node.targetPort;
  const anchor = which === "source" ? node.sourceAnchor : node.targetAnchor;
  const base =
    port === null
      ? resolveCanvas2DNodeWorldCenter(endpointNode, sceneGraph)
      : resolveCanvas2DConnectionHandlePoint(
          resolveCanvas2DNodeWorldBounds(endpointNode, sceneGraph),
          port
        );

  return [base[0] + anchor[0], base[1] + anchor[1]];
}
export function resolveCanvas2DEdgeGeometry(
  node: Canvas2DEdgeNode,
  sceneGraph: Canvas2DSceneGraph
): Canvas2DEdgeGeometry {
  const start = resolveCanvas2DEdgeEndpoint(node, sceneGraph, "source");
  const end = resolveCanvas2DEdgeEndpoint(node, sceneGraph, "target");

  if (node.routing === "orthogonal") {
    return {
      start,
      end,
      waypoints: resolveCanvas2DOrthogonalWaypoints(
        start,
        end,
        node.sourcePort,
        node.targetPort
      ),
      control: null
    };
  }

  if (node.curve === "curved" && node.curveOffset !== 0) {
    const midX = (start[0] + end[0]) / 2;
    const midY = (start[1] + end[1]) / 2;
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length = Math.hypot(dx, dy) || 1;

    return {
      start,
      end,
      waypoints: [],
      control: [
        midX + (-dy / length) * node.curveOffset,
        midY + (dx / length) * node.curveOffset
      ]
    };
  }

  return { start, end, waypoints: [], control: null };
}
/** Unit vector pointing away from the node for a given attachment side. */
export function resolveCanvas2DPortDirection(
  side: CanvasNodePortSide
): readonly [number, number] {
  switch (side) {
    case "top":
      return [0, -1];
    case "right":
      return [1, 0];
    case "bottom":
      return [0, 1];
    case "left":
      return [-1, 0];
  }
}
/**
 * Corners of an orthogonal edge, excluding the start point and including the
 * end point. When either end names a port the path leaves a short stub in that
 * side's direction first, so the line does not immediately cut back across the
 * node it just left. With no ports this keeps the original single-bend
 * behaviour so existing scenes render identically.
 */
export function resolveCanvas2DOrthogonalWaypoints(
  start: readonly [number, number],
  end: readonly [number, number],
  sourcePort: CanvasNodePortSide | null,
  targetPort: CanvasNodePortSide | null
): readonly (readonly [number, number])[] {
  const points: (readonly [number, number])[] = [];

  const afterStart =
    sourcePort === null
      ? start
      : (() => {
          const direction = resolveCanvas2DPortDirection(sourcePort);
          return [
            start[0] + direction[0] * CANVAS_2D_PORT_STUB_LENGTH,
            start[1] + direction[1] * CANVAS_2D_PORT_STUB_LENGTH
          ] as const;
        })();

  const beforeEnd =
    targetPort === null
      ? end
      : (() => {
          const direction = resolveCanvas2DPortDirection(targetPort);
          return [
            end[0] + direction[0] * CANVAS_2D_PORT_STUB_LENGTH,
            end[1] + direction[1] * CANVAS_2D_PORT_STUB_LENGTH
          ] as const;
        })();

  if (sourcePort !== null) {
    points.push(afterStart);
  }

  // Join the two stub ends with an L. Which axis runs first is chosen from the
  // source side so the first leg continues the direction the edge left in.
  if (afterStart[0] !== beforeEnd[0] && afterStart[1] !== beforeEnd[1]) {
    const verticalFirst =
      sourcePort === "top" ||
      sourcePort === "bottom" ||
      (sourcePort === null &&
        (targetPort === "left" || targetPort === "right"));

    points.push(
      verticalFirst
        ? [afterStart[0], beforeEnd[1]]
        : [beforeEnd[0], afterStart[1]]
    );
  }

  if (targetPort !== null) {
    points.push(beforeEnd);
  }

  points.push(end);
  return points;
}
/**
 * Implicit connection handles: four points on the node's world-bounds edges.
 * Nodes declare no ports of their own — the renderer derives them so any node
 * type gains React-Flow-style connection affordances for free.
 */
export function resolveCanvas2DConnectionHandlePoint(
  bounds: Canvas2DRectBounds,
  side: CanvasNodePortSide
): readonly [number, number] {
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midY = (bounds.minY + bounds.maxY) / 2;

  switch (side) {
    case "top":
      return [midX, bounds.minY];
    case "right":
      return [bounds.maxX, midY];
    case "bottom":
      return [midX, bounds.maxY];
    case "left":
      return [bounds.minX, midY];
  }
}
/** Node types that accept connections; edges and annotations are excluded. */
export function isCanvas2DConnectableNode(node: Canvas2DNode): boolean {
  return (
    node.type === "rect" ||
    node.type === "circle" ||
    node.type === "text" ||
    node.type === "html" ||
    node.type === "group"
  );
}
export function resolvePreviewParentWorldTransform(
  node: Canvas2DNode,
  sceneGraph: Canvas2DSceneGraph
): Canvas2DMatrix {
  if (node.parentId === null) {
    return CANVAS_2D_IDENTITY_MATRIX;
  }

  const parent = sceneGraph.nodesById.get(node.parentId);

  if (!parent || parent.type !== "group") {
    throw new Error(
      `Canvas2D authoring preview parent was not found: ${node.parentId}`
    );
  }

  return multiplyCanvas2DMatrices(
    resolveParentWorldTransform(parent, sceneGraph),
    createCanvas2DTransformMatrix(parent)
  );
}
