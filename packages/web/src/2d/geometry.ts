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
  denovoImageSize,
  denovoShadeSize,
  denovoSparklineSize,
  isCanvas2DPluginNode,
  isDenovoImageNode,
  isDenovoShadeNode,
  isDenovoSparklineNode,
  type Canvas2DClipRect,
  type Canvas2DCornerRadius,
  type Canvas2DNode,
  type Canvas2DPluginNode,
  type Canvas2DScene,
  type CanvasNodePortSide,
  type CanvasNodeTransformPreview
} from "@de-novo/canvas-core";

import type { Canvas2DRectBounds } from "../view2d";
import { resolveCanvas2DObstacleFreeOrthogonalWaypoints } from "./routing";
import {
  CANVAS_2D_IDENTITY_MATRIX,
  createCanvas2DTransformMatrix,
  multiplyCanvas2DMatrices,
  transformCanvas2DPoint,
  type Canvas2DMatrix,
  type Canvas2DNodeRenderTransform
} from "./matrix";
import { CANVAS_2D_PLUGIN_MARKER_SIZE } from "./constants";
import { resolveHostPluginNodeLocalSize2d } from "../plugin-drawers";
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

function portsFaceEachOther(
  sourcePort: CanvasNodePortSide | null,
  targetPort: CanvasNodePortSide | null
): "horizontal" | "vertical" | null {
  if (
    (sourcePort === "left" && targetPort === "right") ||
    (sourcePort === "right" && targetPort === "left")
  ) {
    return "horizontal";
  }
  if (
    (sourcePort === "top" && targetPort === "bottom") ||
    (sourcePort === "bottom" && targetPort === "top")
  ) {
    return "vertical";
  }
  return null;
}

/**
 * Facing stubs must not overshoot the gap between ports. A 24-unit stub on
 * both ends of a 36-unit stack gap walks past the midpoint and leaves a
 * leftover segment in empty space.
 */
function resolveOrthogonalStubLength(
  start: readonly [number, number],
  end: readonly [number, number],
  sourcePort: CanvasNodePortSide | null,
  targetPort: CanvasNodePortSide | null
): { readonly startStub: number; readonly endStub: number } {
  const startStub = sourcePort === null ? 0 : CANVAS_2D_PORT_STUB_LENGTH;
  const endStub = targetPort === null ? 0 : CANVAS_2D_PORT_STUB_LENGTH;
  const facing = portsFaceEachOther(sourcePort, targetPort);

  if (facing === null) {
    return { endStub, startStub };
  }

  const gap =
    facing === "horizontal"
      ? Math.abs(start[0] - end[0])
      : Math.abs(start[1] - end[1]);
  const maxEach = gap / 2;

  return {
    endStub: Math.min(endStub, maxEach),
    startStub: Math.min(startStub, maxEach)
  };
}

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
/**
 * Clamps per-corner radii `[tl, tr, br, bl]` to the CSS Border Radius
 * specification so opposing corners never overlap past the box width or height.
 */
export function resolveClampedCornerRadii(
  width: number,
  height: number,
  cornerRadius: number | readonly [number, number, number, number]
): readonly [number, number, number, number] {
  const w = Math.abs(width);
  const h = Math.abs(height);
  if (w <= 0 || h <= 0) {
    return [0, 0, 0, 0];
  }

  let tl: number;
  let tr: number;
  let br: number;
  let bl: number;
  if (typeof cornerRadius === "number") {
    const r = Number.isFinite(cornerRadius) && cornerRadius > 0 ? cornerRadius : 0;
    tl = r;
    tr = r;
    br = r;
    bl = r;
  } else {
    tl = Number.isFinite(cornerRadius[0]) && cornerRadius[0] > 0 ? cornerRadius[0] : 0;
    tr = Number.isFinite(cornerRadius[1]) && cornerRadius[1] > 0 ? cornerRadius[1] : 0;
    br = Number.isFinite(cornerRadius[2]) && cornerRadius[2] > 0 ? cornerRadius[2] : 0;
    bl = Number.isFinite(cornerRadius[3]) && cornerRadius[3] > 0 ? cornerRadius[3] : 0;
  }

  if (tl === 0 && tr === 0 && br === 0 && bl === 0) {
    return [0, 0, 0, 0];
  }

  let scale = 1;
  if (tl + tr > w) scale = Math.min(scale, w / (tl + tr));
  if (bl + br > w) scale = Math.min(scale, w / (bl + br));
  if (tl + bl > h) scale = Math.min(scale, h / (tl + bl));
  if (tr + br > h) scale = Math.min(scale, h / (tr + br));

  return [tl * scale, tr * scale, br * scale, bl * scale];
}

export function hasNonZeroCornerRadius(
  radii: readonly [number, number, number, number]
): boolean {
  return radii[0] > 0 || radii[1] > 0 || radii[2] > 0 || radii[3] > 0;
}

/**
 * Signed distance to a centered rounded rectangle in local coordinates (+Y down).
 * `radii` is `[tl, tr, br, bl]`. Negative inside, zero on boundary, positive outside.
 */
export function signedDistanceRoundedRect(
  px: number,
  py: number,
  halfWidth: number,
  halfHeight: number,
  radii: readonly [number, number, number, number]
): number {
  const radius =
    px > 0
      ? py > 0
        ? radii[2]
        : radii[1]
      : py > 0
        ? radii[3]
        : radii[0];
  const qx = Math.abs(px) - halfWidth + radius;
  const qy = Math.abs(py) - halfHeight + radius;
  return (
    Math.min(Math.max(qx, qy), 0) +
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) -
    radius
  );
}

export function isPointInsideClipRect(
  localPoint: readonly [number, number],
  clip: Canvas2DClipRect
): boolean {
  const halfWidth = clip.width * 0.5;
  const halfHeight = clip.height * 0.5;
  const px = localPoint[0] - (clip.x + halfWidth);
  const py = localPoint[1] - (clip.y + halfHeight);
  if (Math.abs(px) > halfWidth || Math.abs(py) > halfHeight) {
    return false;
  }
  const radii = resolveClampedCornerRadii(
    clip.width,
    clip.height,
    clip.cornerRadius
  );
  if (!hasNonZeroCornerRadius(radii)) {
    return true;
  }
  return signedDistanceRoundedRect(px, py, halfWidth, halfHeight, radii) <= 0;
}

export function isPointInsideCanvas2DShape(
  point: readonly [number, number],
  node: Canvas2DShapeNode
): boolean {
  const halfStroke =
    node.stroke !== null && node.strokeWidth > 0 ? node.strokeWidth * 0.5 : 0;

  if (node.type === "circle") {
    const effectiveRadius = node.radius + halfStroke;
    return (
      point[0] * point[0] + point[1] * point[1] <=
      effectiveRadius * effectiveRadius
    );
  }

  const minX = Math.min(0, node.size[0]);
  const maxX = Math.max(0, node.size[0]);
  const minY = Math.min(0, node.size[1]);
  const maxY = Math.max(0, node.size[1]);

  if (
    !isPointInsideRectangle(point, {
      maxX: maxX + halfStroke,
      maxY: maxY + halfStroke,
      minX: minX - halfStroke,
      minY: minY - halfStroke
    })
  ) {
    return false;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const radii = resolveClampedCornerRadii(width, height, node.cornerRadius);
  if (!hasNonZeroCornerRadius(radii)) {
    return true;
  }

  const px = point[0] - (minX + width * 0.5);
  const py = point[1] - (minY + height * 0.5);
  return (
    signedDistanceRoundedRect(px, py, width * 0.5, height * 0.5, radii) <=
    halfStroke
  );
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
    node.type === "text" ||
    node.type === "html" ||
    isCanvas2DPluginNode(node)
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
    default: {
      if (isCanvas2DPluginNode(node)) {
        const world = resolveCanvas2DNodeWorldTransform(node, sceneGraph);
        return transformCanvas2DPoint(world, [0, 0]);
      }
      const exhaustive: never = node;
      return exhaustive;
    }
  }
}
export function resolveCanvas2DPluginNodeLocalSize(
  node: Canvas2DPluginNode
): readonly [number, number] {
  if (isDenovoImageNode(node)) {
    return denovoImageSize(node.props);
  }
  if (isDenovoSparklineNode(node)) {
    return denovoSparklineSize(node.props);
  }
  if (isDenovoShadeNode(node)) {
    return denovoShadeSize(node.props);
  }

  const hostSize = resolveHostPluginNodeLocalSize2d(node);
  if (hostSize) {
    return hostSize;
  }

  return [CANVAS_2D_PLUGIN_MARKER_SIZE, CANVAS_2D_PLUGIN_MARKER_SIZE];
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
      if (node.clip !== null) {
        const world = resolveCanvas2DNodeWorldTransform(node, sceneGraph);
        const { x, y, width, height } = node.clip;
        return boundsFromPoints([
          transformCanvas2DPoint(world, [x, y]),
          transformCanvas2DPoint(world, [x + width, y]),
          transformCanvas2DPoint(world, [x + width, y + height]),
          transformCanvas2DPoint(world, [x, y + height])
        ]);
      }
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
    default: {
      if (isCanvas2DPluginNode(node)) {
        const origin = resolveCanvas2DNodeWorldCenter(node, sceneGraph);
        const [width, height] = resolveCanvas2DPluginNodeLocalSize(node);
        return {
          minX: origin[0],
          minY: origin[1],
          maxX: origin[0] + width,
          maxY: origin[1] + height
        };
      }
      const exhaustive: never = node;
      return exhaustive;
    }
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
function rectCenter(
  bounds: Canvas2DRectBounds
): readonly [number, number] {
  return [
    (bounds.minX + bounds.maxX) / 2,
    (bounds.minY + bounds.maxY) / 2
  ];
}

function portAimsToward(
  port: CanvasNodePortSide,
  from: readonly [number, number],
  to: readonly [number, number]
): boolean {
  const direction = resolveCanvas2DPortDirection(port);
  return (
    direction[0] * (to[0] - from[0]) + direction[1] * (to[1] - from[1]) > 0
  );
}

/**
 * Facing sides for two node boxes. Used when a named port would leave the
 * node pointing away from its neighbor after a layout move.
 */
export function resolveCanvas2DFacingPortPair(
  sourceBounds: Canvas2DRectBounds,
  targetBounds: Canvas2DRectBounds
): {
  readonly sourcePort: CanvasNodePortSide;
  readonly targetPort: CanvasNodePortSide;
} {
  const source = rectCenter(sourceBounds);
  const target = rectCenter(targetBounds);
  const dx = target[0] - source[0];
  const dy = target[1] - source[1];

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourcePort: "right", targetPort: "left" }
      : { sourcePort: "left", targetPort: "right" };
  }

  return dy >= 0
    ? { sourcePort: "bottom", targetPort: "top" }
    : { sourcePort: "top", targetPort: "bottom" };
}

/**
 * Keep named ports when they still aim at the other node. Otherwise pick
 * a facing pair from the current boxes so orthogonal edges survive layout.
 */
export function resolveCanvas2DOrthogonalPorts(
  sourceBounds: Canvas2DRectBounds,
  targetBounds: Canvas2DRectBounds,
  sourcePort: CanvasNodePortSide | null,
  targetPort: CanvasNodePortSide | null
): {
  readonly sourcePort: CanvasNodePortSide | null;
  readonly targetPort: CanvasNodePortSide | null;
} {
  if (sourcePort === null && targetPort === null) {
    return { sourcePort, targetPort };
  }

  const source = rectCenter(sourceBounds);
  const target = rectCenter(targetBounds);
  const sourceOk =
    sourcePort === null || portAimsToward(sourcePort, source, target);
  const targetOk =
    targetPort === null || portAimsToward(targetPort, target, source);

  if (sourceOk && targetOk) {
    return { sourcePort, targetPort };
  }

  return resolveCanvas2DFacingPortPair(sourceBounds, targetBounds);
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
  which: "source" | "target",
  portOverride?: CanvasNodePortSide | null
): readonly [number, number] {
  const endpointNode =
    which === "source"
      ? sceneGraph.nodesById.get(node.sourceId)
      : sceneGraph.nodesById.get(node.targetId);

  if (!endpointNode) {
    return [0, 0];
  }

  const port =
    portOverride !== undefined
      ? portOverride
      : which === "source"
        ? node.sourcePort
        : node.targetPort;
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
type LayerObstacleEntry = {
  readonly id: string;
  readonly bounds: Canvas2DRectBounds;
};

const obstacleCacheBySceneGraph = new WeakMap<
  Canvas2DSceneGraph,
  Map<string, readonly LayerObstacleEntry[]>
>();

function isNodeVisibleInSceneGraph(
  node: Canvas2DNode,
  sceneGraph: Canvas2DSceneGraph
): boolean {
  const layer = sceneGraph.layersById.get(node.layerId);
  if (!layer || !layer.visible || !node.visible) {
    return false;
  }
  for (const ancestor of getCanvas2DAncestors(node, sceneGraph)) {
    if (!ancestor.visible) {
      return false;
    }
  }
  return true;
}

function getLayerObstacleEntries(
  sceneGraph: Canvas2DSceneGraph,
  layerId: string
): readonly LayerObstacleEntry[] {
  let perLayer = obstacleCacheBySceneGraph.get(sceneGraph);
  if (!perLayer) {
    perLayer = new Map();
    obstacleCacheBySceneGraph.set(sceneGraph, perLayer);
  }
  const cached = perLayer.get(layerId);
  if (cached) {
    return cached;
  }

  const entries: LayerObstacleEntry[] = [];
  for (const candidate of sceneGraph.nodesById.values()) {
    if (
      candidate.layerId !== layerId ||
      candidate.type === "group" ||
      !isCanvas2DConnectableNode(candidate) ||
      !isNodeVisibleInSceneGraph(candidate, sceneGraph)
    ) {
      continue;
    }
    entries.push({
      id: candidate.id,
      bounds: resolveCanvas2DNodeWorldBounds(candidate, sceneGraph)
    });
  }

  perLayer.set(layerId, entries);
  return entries;
}

function collectObstacleBoundsForEdge(
  node: Canvas2DEdgeNode,
  sceneGraph: Canvas2DSceneGraph
): Canvas2DRectBounds[] {
  const entries = getLayerObstacleEntries(sceneGraph, node.layerId);
  const obstacles: Canvas2DRectBounds[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]!;
    if (entry.id === node.sourceId || entry.id === node.targetId) {
      continue;
    }
    obstacles.push(entry.bounds);
  }
  return obstacles;
}

export function resolveCanvas2DEdgeGeometry(
  node: Canvas2DEdgeNode,
  sceneGraph: Canvas2DSceneGraph
): Canvas2DEdgeGeometry {
  if (node.routing === "orthogonal") {
    const sourceNode = sceneGraph.nodesById.get(node.sourceId);
    const targetNode = sceneGraph.nodesById.get(node.targetId);
    const sourceBounds = sourceNode
      ? resolveCanvas2DNodeWorldBounds(sourceNode, sceneGraph)
      : null;
    const targetBounds = targetNode
      ? resolveCanvas2DNodeWorldBounds(targetNode, sceneGraph)
      : null;
    const ports =
      sourceBounds && targetBounds
        ? resolveCanvas2DOrthogonalPorts(
            sourceBounds,
            targetBounds,
            node.sourcePort,
            node.targetPort
          )
        : { sourcePort: node.sourcePort, targetPort: node.targetPort };
    const start = resolveCanvas2DEdgeEndpoint(
      node,
      sceneGraph,
      "source",
      ports.sourcePort
    );
    const end = resolveCanvas2DEdgeEndpoint(
      node,
      sceneGraph,
      "target",
      ports.targetPort
    );

    return {
      start,
      end,
      waypoints: node.avoidObstacles
        ? resolveCanvas2DObstacleFreeOrthogonalWaypoints(
            start,
            end,
            ports.sourcePort,
            ports.targetPort,
            collectObstacleBoundsForEdge(node, sceneGraph),
            {
              padding: node.obstaclePadding,
              sourceBounds,
              targetBounds
            }
          )
        : resolveCanvas2DOrthogonalWaypoints(
            start,
            end,
            ports.sourcePort,
            ports.targetPort
          ),
      control: null
    };
  }

  const start = resolveCanvas2DEdgeEndpoint(node, sceneGraph, "source");
  const end = resolveCanvas2DEdgeEndpoint(node, sceneGraph, "target");

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
  const { startStub, endStub } = resolveOrthogonalStubLength(
    start,
    end,
    sourcePort,
    targetPort
  );

  const afterStart =
    sourcePort === null
      ? start
      : (() => {
          const direction = resolveCanvas2DPortDirection(sourcePort);
          return [
            start[0] + direction[0] * startStub,
            start[1] + direction[1] * startStub
          ] as const;
        })();

  const beforeEnd =
    targetPort === null
      ? end
      : (() => {
          const direction = resolveCanvas2DPortDirection(targetPort);
          return [
            end[0] + direction[0] * endStub,
            end[1] + direction[1] * endStub
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
    node.type === "group" ||
    isCanvas2DPluginNode(node)
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
