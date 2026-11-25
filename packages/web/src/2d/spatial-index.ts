import {
  isCanvas2DPluginNode,
  type Canvas2DNode,
  type Canvas2DScene,
  type CanvasNodeTransformPreview
} from "@de-novo/canvas-core";

import type { Canvas2DRectBounds } from "../view2d";
import {
  CANVAS_2D_ANCHOR_HIT_RADIUS,
  CANVAS_2D_ANCHOR_RADIUS,
  CANVAS_2D_ANNOTATION_TEXT_OFFSET,
  CANVAS_2D_MEASUREMENT_LABEL_OFFSET,
  CANVAS_2D_SEGMENT_HIT_TOLERANCE
} from "./constants";
import {
  boundsFromPoints,
  rectsIntersect,
  resolveCanvas2DEdgeGeometry,
  resolveCanvas2DNodeWorldBounds,
  resolveCanvas2DPluginNodeLocalSize,
  resolveNodeRenderTransform
} from "./geometry";
import {
  CANVAS_2D_IDENTITY_MATRIX,
  createCanvas2DTransformMatrix,
  multiplyCanvas2DMatrices,
  transformCanvas2DPoint,
  type Canvas2DMatrix
} from "./matrix";
import {
  getCanvas2DAncestors,
  getCanvas2DGroupChildren,
  getCanvas2DLayerRoots,
  type Canvas2DDrawableNode,
  type Canvas2DGroupNode,
  type Canvas2DSceneGraph
} from "./scene-graph";

export type Canvas2DSpatialDrawableEntry = {
  readonly bounds: Canvas2DRectBounds;
  readonly hasStyledAncestor: boolean;
  readonly isIdentityParent: boolean;
  readonly node: Canvas2DDrawableNode;
  readonly order: number;
  readonly parentWorldTransform: Canvas2DMatrix;
};

export type Canvas2DSpatialGroupEntry = {
  readonly bounds: Canvas2DRectBounds;
  readonly node: Canvas2DGroupNode;
};

export type Canvas2DSpatialSyncKind = "full" | "incremental" | "noop";

export type Canvas2DSpatialIndexStats = {
  readonly cellSize: number;
  readonly entryCount: number;
  readonly lastSyncKind: Canvas2DSpatialSyncKind;
  readonly lastSyncedNodeCount: number;
};

export type Canvas2DSpatialIndex = {
  readonly cellSize: number;
  readonly entries: readonly Canvas2DSpatialDrawableEntry[];
  readonly entryIndexByNodeId: ReadonlyMap<string, number>;
  readonly groups: readonly Canvas2DSpatialGroupEntry[];
  readonly htmlEntryCount: number;
  readonly getLastChangedNodeIds: () => readonly string[];
  readonly getStats: () => Canvas2DSpatialIndexStats;
  readonly syncIncremental: (
    previousScene: Canvas2DScene,
    nextScene: Canvas2DScene,
    nextSceneGraph: Canvas2DSceneGraph
  ) => boolean;
  queryPoint: (
    point: readonly [number, number],
    preview: CanvasNodeTransformPreview | null,
    sceneGraph: Canvas2DSceneGraph
  ) => readonly Canvas2DSpatialDrawableEntry[];
  queryRect: (
    bounds: Canvas2DRectBounds,
    preview: CanvasNodeTransformPreview | null,
    sceneGraph: Canvas2DSceneGraph
  ) => readonly Canvas2DSpatialDrawableEntry[];
  queryRectIds: (
    bounds: Canvas2DRectBounds,
    sceneGraph: Canvas2DSceneGraph
  ) => string[];
  queryVisibleHtmlIds: (
    bounds: Canvas2DRectBounds,
    preview: CanvasNodeTransformPreview | null,
    sceneGraph: Canvas2DSceneGraph
  ) => readonly string[];
};

const CELL_COORD_OFFSET = 16_777_216;
const CELL_COORD_STRIDE = 33_554_432;
const MIN_CELL_COORD = -CELL_COORD_OFFSET;
const MAX_CELL_COORD = CELL_COORD_OFFSET - 1;
const MAX_CELLS_PER_ENTRY = 64;
const MIN_CELL_SIZE = 64;
const MAX_CELL_SIZE = 2048;
const DEFAULT_CELL_SIZE = 256;

function isIdentityMatrix(matrix: Canvas2DMatrix): boolean {
  return (
    matrix[0] === 1 &&
    matrix[1] === 0 &&
    matrix[2] === 0 &&
    matrix[3] === 1 &&
    matrix[4] === 0 &&
    matrix[5] === 0
  );
}

function expandBounds(bounds: Canvas2DRectBounds, pad: number): Canvas2DRectBounds {
  return pad <= 0
    ? bounds
    : {
        minX: bounds.minX - pad,
        minY: bounds.minY - pad,
        maxX: bounds.maxX + pad,
        maxY: bounds.maxY + pad
      };
}

function transformedRectBounds(
  matrix: Canvas2DMatrix,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): Canvas2DRectBounds {
  return boundsFromPoints([
    transformCanvas2DPoint(matrix, [minX, minY]),
    transformCanvas2DPoint(matrix, [maxX, minY]),
    transformCanvas2DPoint(matrix, [maxX, maxY]),
    transformCanvas2DPoint(matrix, [minX, maxY])
  ]);
}

function unionBounds(a: Canvas2DRectBounds, b: Canvas2DRectBounds): Canvas2DRectBounds {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY)
  };
}

function computeConservativeDrawableBounds(
  node: Canvas2DDrawableNode,
  parentWorldTransform: Canvas2DMatrix,
  sceneGraph: Canvas2DSceneGraph
): Canvas2DRectBounds {
  switch (node.type) {
    case "rect": {
      const world = multiplyCanvas2DMatrices(
        parentWorldTransform,
        createCanvas2DTransformMatrix({
          position: node.position,
          rotation: node.rotation,
          scale: node.scale
        })
      );
      const halfStroke =
        node.stroke !== null && node.strokeWidth > 0 ? node.strokeWidth * 0.5 : 0;
      const minX = Math.min(0, node.size[0]) - halfStroke;
      const maxX = Math.max(0, node.size[0]) + halfStroke;
      const minY = Math.min(0, node.size[1]) - halfStroke;
      const maxY = Math.max(0, node.size[1]) + halfStroke;
      return expandBounds(transformedRectBounds(world, minX, minY, maxX, maxY), 2);
    }
    case "circle": {
      const world = multiplyCanvas2DMatrices(
        parentWorldTransform,
        createCanvas2DTransformMatrix({
          position: node.position,
          rotation: node.rotation,
          scale: node.scale
        })
      );
      const halfStroke =
        node.stroke !== null && node.strokeWidth > 0 ? node.strokeWidth * 0.5 : 0;
      const r = node.radius + halfStroke + 2;
      return transformedRectBounds(world, -r, -r, r, r);
    }
    case "html": {
      const world = multiplyCanvas2DMatrices(
        parentWorldTransform,
        createCanvas2DTransformMatrix({
          position: node.position,
          rotation: node.rotation,
          scale: node.scale
        })
      );
      const w = node.width ?? 0;
      const h = node.height ?? 0;
      return expandBounds(transformedRectBounds(world, 0, 0, w, h), 2);
    }
    case "edge": {
      const { start, end, waypoints, control } = resolveCanvas2DEdgeGeometry(
        node,
        sceneGraph
      );
      const raw = boundsFromPoints([
        start,
        end,
        ...waypoints,
        ...(control ? [control] : [])
      ]);
      const selectedStroke = node.strokeWidth + 2;
      const arrowSize = Math.max(selectedStroke * 2.5, 6);
      const pad = Math.max(selectedStroke, CANVAS_2D_ANCHOR_HIT_RADIUS, 6) + arrowSize + 2;
      return expandBounds(raw, pad);
    }
    case "measurement": {
      const minX = Math.min(node.start[0], node.end[0]);
      const maxX = Math.max(node.start[0], node.end[0]);
      const minY = Math.min(node.start[1], node.end[1]);
      const maxY = Math.max(node.start[1], node.end[1]);
      const padX = Math.max(CANVAS_2D_SEGMENT_HIT_TOLERANCE, 120);
      const padY = Math.max(
        CANVAS_2D_SEGMENT_HIT_TOLERANCE,
        CANVAS_2D_MEASUREMENT_LABEL_OFFSET + 32
      );
      return transformedRectBounds(
        parentWorldTransform,
        minX - padX,
        minY - padY,
        maxX + padX,
        maxY + padY
      );
    }
    case "annotation": {
      const [ax, ay] = node.anchor;
      const textWidth = Math.max(96, node.text.length * 14);
      const minX = Math.min(ax - CANVAS_2D_ANCHOR_HIT_RADIUS, ax - CANVAS_2D_ANCHOR_RADIUS);
      const maxX = Math.max(
        ax + CANVAS_2D_ANCHOR_HIT_RADIUS,
        ax + CANVAS_2D_ANNOTATION_TEXT_OFFSET[0] + textWidth
      );
      const minY = Math.min(
        ay - CANVAS_2D_ANCHOR_HIT_RADIUS,
        ay + CANVAS_2D_ANNOTATION_TEXT_OFFSET[1] - 28
      );
      const maxY = Math.max(
        ay + CANVAS_2D_ANCHOR_HIT_RADIUS,
        ay + CANVAS_2D_ANNOTATION_TEXT_OFFSET[1] + 12
      );
      return transformedRectBounds(parentWorldTransform, minX, minY, maxX, maxY);
    }
    case "text": {
      const world = multiplyCanvas2DMatrices(
        parentWorldTransform,
        createCanvas2DTransformMatrix({
          position: node.position,
          rotation: node.rotation,
          scale: node.scale
        })
      );
      const lines = node.text.split("\n");
      const maxLineChars = lines.reduce((acc, line) => Math.max(acc, line.length), 1);
      const estWidth = node.width ?? Math.max(node.fontSize, maxLineChars * node.fontSize * 1.15);
      const wrappedLines = node.width
        ? Math.max(
            lines.length,
            Math.ceil((node.text.length * node.fontSize * 0.9) / Math.max(1, node.width)) +
              lines.length
          )
        : lines.length;
      const estHeight = Math.max(1, wrappedLines) * node.fontSize * 1.4;
      const minX =
        node.align === "center"
          ? -estWidth / 2
          : node.align === "right"
            ? -estWidth
            : 0;
      const localBounds = transformedRectBounds(
        world,
        minX - node.fontSize,
        -node.fontSize,
        minX + estWidth + node.fontSize,
        estHeight + node.fontSize
      );
      return unionBounds(localBounds, resolveCanvas2DNodeWorldBounds(node, sceneGraph));
    }
    default: {
      if (isCanvas2DPluginNode(node)) {
        const world = multiplyCanvas2DMatrices(
          parentWorldTransform,
          createCanvas2DTransformMatrix({
            position: node.position,
            rotation: node.rotation,
            scale: node.scale
          })
        );
        const [width, height] = resolveCanvas2DPluginNodeLocalSize(node);
        return expandBounds(transformedRectBounds(world, 0, 0, width, height), 2);
      }
      const exhaustive: never = node;
      return exhaustive;
    }
  }
}

function chooseCellSize(entries: readonly Canvas2DSpatialDrawableEntry[]): number {
  if (entries.length === 0) {
    return DEFAULT_CELL_SIZE;
  }
  const sampleCount = Math.min(entries.length, 256);
  const step = Math.max(1, Math.floor(entries.length / sampleCount));
  let sum = 0;
  let counted = 0;
  for (let i = 0; i < entries.length && counted < sampleCount; i += step) {
    const { bounds } = entries[i]!;
    const extent = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    if (Number.isFinite(extent) && extent > 0) {
      sum += extent;
      counted += 1;
    }
  }
  if (counted === 0) {
    return DEFAULT_CELL_SIZE;
  }
  const target = (sum / counted) * 2;
  const clamped = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, target));
  return Math.round(clamped);
}

function encodeCellKey(cx: number, cy: number): number | null {
  if (
    cx < MIN_CELL_COORD ||
    cx > MAX_CELL_COORD ||
    cy < MIN_CELL_COORD ||
    cy > MAX_CELL_COORD
  ) {
    return null;
  }
  return (cx + CELL_COORD_OFFSET) * CELL_COORD_STRIDE + (cy + CELL_COORD_OFFSET);
}

export function resolveLiveParentWorldTransform(
  entry: Canvas2DSpatialDrawableEntry,
  sceneGraph: Canvas2DSceneGraph,
  preview: CanvasNodeTransformPreview | null
): Canvas2DMatrix {
  if (!preview || entry.node.parentId === null) {
    return entry.parentWorldTransform;
  }

  const ancestors = getCanvas2DAncestors(entry.node, sceneGraph);
  let hasPreviewAncestor = false;
  for (const ancestor of ancestors) {
    if (ancestor.id === preview.nodeId) {
      hasPreviewAncestor = true;
      break;
    }
  }
  if (!hasPreviewAncestor) {
    return entry.parentWorldTransform;
  }

  let world = CANVAS_2D_IDENTITY_MATRIX;
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    world = multiplyCanvas2DMatrices(
      world,
      createCanvas2DTransformMatrix(
        resolveNodeRenderTransform(ancestors[i]!, preview)
      )
    );
  }
  return world;
}

export function createCanvas2DSpatialIndex(
  scene: Canvas2DScene,
  sceneGraph: Canvas2DSceneGraph
): Canvas2DSpatialIndex {
  const entries: Canvas2DSpatialDrawableEntry[] = [];
  const groups: Canvas2DSpatialGroupEntry[] = [];
  const entryIndexByNodeId = new Map<string, number>();
  let htmlEntryCount = 0;

  function visitNode(
    node: Canvas2DNode,
    parentWorldTransform: Canvas2DMatrix,
    styledAncestor: boolean
  ) {
    if (!node.visible) {
      return;
    }

    if (node.type === "group") {
      groups.push({
        bounds: resolveCanvas2DNodeWorldBounds(node, sceneGraph),
        node
      });
      const worldTransform = multiplyCanvas2DMatrices(
        parentWorldTransform,
        createCanvas2DTransformMatrix({
          position: node.position,
          rotation: node.rotation,
          scale: node.scale
        })
      );
      const childStyledAncestor =
        styledAncestor || node.clip !== null || node.opacity < 1;
      for (const child of getCanvas2DGroupChildren(sceneGraph, node.id)) {
        visitNode(child, worldTransform, childStyledAncestor);
      }
      return;
    }

    const order = entries.length;
    const effectiveParent =
      node.type === "edge" ? CANVAS_2D_IDENTITY_MATRIX : parentWorldTransform;
    const bounds = computeConservativeDrawableBounds(
      node,
      effectiveParent,
      sceneGraph
    );
    entryIndexByNodeId.set(node.id, order);
    if (node.type === "html") {
      htmlEntryCount += 1;
    }
    entries.push({
      bounds,
      hasStyledAncestor: node.type !== "edge" && styledAncestor,
      isIdentityParent: isIdentityMatrix(effectiveParent),
      node,
      order,
      parentWorldTransform: effectiveParent
    });
  }

  for (const layer of scene.layers) {
    if (!layer.visible) {
      continue;
    }
    for (const root of getCanvas2DLayerRoots(sceneGraph, layer.id)) {
      visitNode(root, CANVAS_2D_IDENTITY_MATRIX, false);
    }
  }

  const cellSize = chooseCellSize(entries);
  const invCellSize = 1 / cellSize;
  const cells = new Map<number, number[]>();
  const overflow: number[] = [];
  const entryCells: Array<number[] | null> = new Array(entries.length);
  let lastSyncKind: Canvas2DSpatialSyncKind = "full";
  let lastSyncedNodeCount = entries.length;
  let lastChangedNodeIds: readonly string[] = [];

  function insertEntryCells(index: number, bounds: Canvas2DRectBounds): void {
    if (
      !Number.isFinite(bounds.minX) ||
      !Number.isFinite(bounds.minY) ||
      !Number.isFinite(bounds.maxX) ||
      !Number.isFinite(bounds.maxY)
    ) {
      overflow.push(index);
      entryCells[index] = null;
      return;
    }

    const minCx = Math.floor(bounds.minX * invCellSize);
    const maxCx = Math.floor(bounds.maxX * invCellSize);
    const minCy = Math.floor(bounds.minY * invCellSize);
    const maxCy = Math.floor(bounds.maxY * invCellSize);
    const cellCount = (maxCx - minCx + 1) * (maxCy - minCy + 1);

    if (
      cellCount > MAX_CELLS_PER_ENTRY ||
      minCx < MIN_CELL_COORD ||
      maxCx > MAX_CELL_COORD ||
      minCy < MIN_CELL_COORD ||
      maxCy > MAX_CELL_COORD
    ) {
      overflow.push(index);
      entryCells[index] = null;
      return;
    }

    const keys: number[] = [];
    for (let cy = minCy; cy <= maxCy; cy += 1) {
      for (let cx = minCx; cx <= maxCx; cx += 1) {
        const key = encodeCellKey(cx, cy);
        if (key === null) {
          continue;
        }
        keys.push(key);
        const bucket = cells.get(key);
        if (bucket) {
          bucket.push(index);
        } else {
          cells.set(key, [index]);
        }
      }
    }
    entryCells[index] = keys;
  }

  function removeEntryCells(index: number): void {
    const keys = entryCells[index];
    if (keys === null) {
      const pos = overflow.indexOf(index);
      if (pos !== -1) {
        const last = overflow.pop()!;
        if (pos < overflow.length) {
          overflow[pos] = last;
        }
      }
      return;
    }
    if (!keys) {
      return;
    }
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i]!;
      const bucket = cells.get(key);
      if (!bucket) {
        continue;
      }
      const pos = bucket.indexOf(index);
      if (pos !== -1) {
        const last = bucket.pop()!;
        if (pos < bucket.length) {
          bucket[pos] = last;
        }
      }
      if (bucket.length === 0) {
        cells.delete(key);
      }
    }
  }

  for (let index = 0; index < entries.length; index += 1) {
    insertEntryCells(index, entries[index]!.bounds);
  }

  const seenStamp = new Uint32Array(entries.length);
  let currentStamp = 0;

  function nextStamp(): number {
    currentStamp += 1;
    if (currentStamp >= 0xffffffff) {
      seenStamp.fill(0);
      currentStamp = 1;
    }
    return currentStamp;
  }

  function addPreviewAffectedIndices(
    preview: CanvasNodeTransformPreview | null,
    sceneGraphRef: Canvas2DSceneGraph,
    stamp: number,
    out: number[]
  ) {
    if (!preview) {
      return;
    }
    const movedNodeIds: string[] = [];
    const stack: string[] = [preview.nodeId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      movedNodeIds.push(id);
      const entryIndex = entryIndexByNodeId.get(id);
      if (entryIndex !== undefined && seenStamp[entryIndex] !== stamp) {
        seenStamp[entryIndex] = stamp;
        out.push(entryIndex);
      }
      const children = sceneGraphRef.childrenByGroupId.get(id);
      if (children) {
        for (const child of children) {
          stack.push(child.id);
        }
      }
    }
    for (const movedId of movedNodeIds) {
      const incident = sceneGraphRef.edgesByEndpointId.get(movedId);
      if (!incident) {
        continue;
      }
      for (const edge of incident) {
        const edgeIndex = entryIndexByNodeId.get(edge.id);
        if (edgeIndex !== undefined && seenStamp[edgeIndex] !== stamp) {
          seenStamp[edgeIndex] = stamp;
          out.push(edgeIndex);
        }
      }
    }
  }

  function collectRectCandidateIndices(
    bounds: Canvas2DRectBounds,
    preview: CanvasNodeTransformPreview | null,
    sceneGraphRef: Canvas2DSceneGraph
  ): number[] {
    if (bounds.minX > bounds.maxX || bounds.minY > bounds.maxY) {
      return [];
    }
    const stamp = nextStamp();
    const indices: number[] = [];

    const minCx = Math.max(MIN_CELL_COORD, Math.floor(bounds.minX * invCellSize));
    const maxCx = Math.min(MAX_CELL_COORD, Math.floor(bounds.maxX * invCellSize));
    const minCy = Math.max(MIN_CELL_COORD, Math.floor(bounds.minY * invCellSize));
    const maxCy = Math.min(MAX_CELL_COORD, Math.floor(bounds.maxY * invCellSize));
    const spannedCells = (maxCx - minCx + 1) * (maxCy - minCy + 1);

    if (spannedCells > cells.size * 2 && cells.size > 0) {
      // Very zoomed-out viewport: scanning entries directly avoids walking empty grid cells.
      for (let index = 0; index < entries.length; index += 1) {
        if (rectsIntersect(entries[index]!.bounds, bounds)) {
          seenStamp[index] = stamp;
          indices.push(index);
        }
      }
    } else {
      for (let cy = minCy; cy <= maxCy; cy += 1) {
        for (let cx = minCx; cx <= maxCx; cx += 1) {
          const key = encodeCellKey(cx, cy);
          if (key === null) {
            continue;
          }
          const bucket = cells.get(key);
          if (!bucket) {
            continue;
          }
          for (let i = 0; i < bucket.length; i += 1) {
            const entryIndex = bucket[i]!;
            if (
              seenStamp[entryIndex] !== stamp &&
              rectsIntersect(entries[entryIndex]!.bounds, bounds)
            ) {
              seenStamp[entryIndex] = stamp;
              indices.push(entryIndex);
            }
          }
        }
      }
      for (let i = 0; i < overflow.length; i += 1) {
        const entryIndex = overflow[i]!;
        if (
          seenStamp[entryIndex] !== stamp &&
          rectsIntersect(entries[entryIndex]!.bounds, bounds)
        ) {
          seenStamp[entryIndex] = stamp;
          indices.push(entryIndex);
        }
      }
    }

    addPreviewAffectedIndices(preview, sceneGraphRef, stamp, indices);
    return indices;
  }

  function resolveWorldParentTransformForNode(
    node: Canvas2DDrawableNode,
    sceneGraphRef: Canvas2DSceneGraph
  ): Canvas2DMatrix {
    if (node.type === "edge" || node.parentId === null) {
      return CANVAS_2D_IDENTITY_MATRIX;
    }
    const ancestors = getCanvas2DAncestors(node, sceneGraphRef);
    let world = CANVAS_2D_IDENTITY_MATRIX;
    for (let i = ancestors.length - 1; i >= 0; i -= 1) {
      const ancestor = ancestors[i]!;
      world = multiplyCanvas2DMatrices(
        world,
        createCanvas2DTransformMatrix({
          position: ancestor.position,
          rotation: ancestor.rotation,
          scale: ancestor.scale
        })
      );
    }
    return world;
  }

  function syncIncremental(
    previousScene: Canvas2DScene,
    nextScene: Canvas2DScene,
    nextSceneGraph: Canvas2DSceneGraph
  ): boolean {
    if (previousScene.layers.length !== nextScene.layers.length) {
      return false;
    }
    for (let i = 0; i < nextScene.layers.length; i += 1) {
      const prevLayer = previousScene.layers[i]!;
      const nextLayer = nextScene.layers[i]!;
      if (
        prevLayer.id !== nextLayer.id ||
        prevLayer.visible !== nextLayer.visible
      ) {
        return false;
      }
    }
    if (previousScene.nodes.length !== nextScene.nodes.length) {
      return false;
    }

    const maxIncrementalChanges = Math.max(64, Math.floor(entries.length * 0.15));
    const changedNodes: Canvas2DNode[] = [];
    for (let i = 0; i < nextScene.nodes.length; i += 1) {
      const prevNode = previousScene.nodes[i]!;
      const nextNode = nextScene.nodes[i]!;
      if (prevNode === nextNode) {
        continue;
      }
      if (
        prevNode.id !== nextNode.id ||
        prevNode.type !== nextNode.type ||
        prevNode.layerId !== nextNode.layerId ||
        prevNode.parentId !== nextNode.parentId ||
        prevNode.visible !== nextNode.visible
      ) {
        return false;
      }
      if (!isSameCanvas2DNodeValue(prevNode, nextNode)) {
        changedNodes.push(nextNode);
        if (changedNodes.length > maxIncrementalChanges) {
          return false;
        }
      }
    }

    if (changedNodes.length === 0) {
      lastSyncKind = "noop";
      lastSyncedNodeCount = 0;
      lastChangedNodeIds = [];
      return true;
    }

    const affectedDrawableIds = new Set<string>();
    const affectedGroupIds = new Set<string>();
    const affectedObstacleLayers = new Set<string>();
    const stack: Canvas2DNode[] = [...changedNodes];

    while (stack.length > 0) {
      const node = stack.pop()!;
      if (node.type === "group") {
        affectedGroupIds.add(node.id);
        const children = nextSceneGraph.childrenByGroupId.get(node.id);
        if (children) {
          for (let i = 0; i < children.length; i += 1) {
            stack.push(children[i]!);
          }
        }
      } else {
        affectedDrawableIds.add(node.id);
        if (node.type !== "edge") {
          affectedObstacleLayers.add(node.layerId);
        }
      }
      const incidentEdges = nextSceneGraph.edgesByEndpointId.get(node.id);
      if (incidentEdges) {
        for (let i = 0; i < incidentEdges.length; i += 1) {
          affectedDrawableIds.add(incidentEdges[i]!.id);
        }
      }
    }

    if (affectedObstacleLayers.size > 0) {
      for (let i = 0; i < nextScene.nodes.length; i += 1) {
        const candidate = nextScene.nodes[i]!;
        if (
          candidate.type === "edge" &&
          candidate.routing === "orthogonal" &&
          candidate.avoidObstacles &&
          affectedObstacleLayers.has(candidate.layerId)
        ) {
          affectedDrawableIds.add(candidate.id);
        }
      }
    }

    if (affectedDrawableIds.size > maxIncrementalChanges) {
      return false;
    }

    for (const id of affectedDrawableIds) {
      const entryIndex = entryIndexByNodeId.get(id);
      if (entryIndex === undefined) {
        continue;
      }
      const nextNode = nextSceneGraph.nodesById.get(id);
      if (!nextNode || nextNode.type === "group") {
        return false;
      }
      const effectiveParent = resolveWorldParentTransformForNode(
        nextNode,
        nextSceneGraph
      );
      const nextBounds = computeConservativeDrawableBounds(
        nextNode,
        effectiveParent,
        nextSceneGraph
      );
      const prevBounds = entries[entryIndex]!.bounds;
      const boundsChanged =
        prevBounds.minX !== nextBounds.minX ||
        prevBounds.minY !== nextBounds.minY ||
        prevBounds.maxX !== nextBounds.maxX ||
        prevBounds.maxY !== nextBounds.maxY;
      if (boundsChanged) {
        removeEntryCells(entryIndex);
        insertEntryCells(entryIndex, nextBounds);
      }
      const hasStyledAncestor =
        nextNode.type !== "edge" &&
        nextNode.parentId !== null &&
        getCanvas2DAncestors(nextNode, nextSceneGraph).some(
          (ancestor) => ancestor.clip !== null || ancestor.opacity < 1
        );
      entries[entryIndex] = {
        bounds: nextBounds,
        hasStyledAncestor,
        isIdentityParent: isIdentityMatrix(effectiveParent),
        node: nextNode,
        order: entryIndex,
        parentWorldTransform: effectiveParent
      };
    }

    if (groups.length > 0 && (affectedGroupIds.size > 0 || affectedDrawableIds.size > 0)) {
      for (let i = 0; i < groups.length; i += 1) {
        const groupId = groups[i]!.node.id;
        const nextGroup = nextSceneGraph.nodesById.get(groupId);
        if (!nextGroup || nextGroup.type !== "group") {
          return false;
        }
        groups[i] = {
          bounds: resolveCanvas2DNodeWorldBounds(nextGroup, nextSceneGraph),
          node: nextGroup
        };
      }
    }

    lastSyncKind = "incremental";
    lastSyncedNodeCount = affectedDrawableIds.size;
    lastChangedNodeIds = [...affectedDrawableIds];
    return true;
  }

  return {
    cellSize,
    entries,
    entryIndexByNodeId,
    groups,
    htmlEntryCount,
    getLastChangedNodeIds() {
      return lastChangedNodeIds;
    },
    getStats() {
      return {
        cellSize,
        entryCount: entries.length,
        lastSyncKind,
        lastSyncedNodeCount
      };
    },
    syncIncremental,
    queryPoint(point, preview, sceneGraphRef) {
      const [px, py] = point;
      const stamp = nextStamp();
      const indices: number[] = [];
      const cx = Math.floor(px * invCellSize);
      const cy = Math.floor(py * invCellSize);
      const key = encodeCellKey(cx, cy);

      if (key !== null) {
        const bucket = cells.get(key);
        if (bucket) {
          for (let i = 0; i < bucket.length; i += 1) {
            const entryIndex = bucket[i]!;
            if (seenStamp[entryIndex] === stamp) {
              continue;
            }
            const b = entries[entryIndex]!.bounds;
            if (px >= b.minX && px <= b.maxX && py >= b.minY && py <= b.maxY) {
              seenStamp[entryIndex] = stamp;
              indices.push(entryIndex);
            }
          }
        }
      }

      for (let i = 0; i < overflow.length; i += 1) {
        const entryIndex = overflow[i]!;
        if (seenStamp[entryIndex] === stamp) {
          continue;
        }
        const b = entries[entryIndex]!.bounds;
        if (px >= b.minX && px <= b.maxX && py >= b.minY && py <= b.maxY) {
          seenStamp[entryIndex] = stamp;
          indices.push(entryIndex);
        }
      }

      addPreviewAffectedIndices(preview, sceneGraphRef, stamp, indices);

      if (indices.length > 1) {
        indices.sort((a, b) => b - a);
      }

      const result: Canvas2DSpatialDrawableEntry[] = new Array(indices.length);
      for (let i = 0; i < indices.length; i += 1) {
        result[i] = entries[indices[i]!]!;
      }
      return result;
    },
    queryRect(bounds, preview, sceneGraphRef) {
      const indices = collectRectCandidateIndices(bounds, preview, sceneGraphRef);
      if (indices.length > 1) {
        indices.sort((a, b) => a - b);
      }
      const result: Canvas2DSpatialDrawableEntry[] = new Array(indices.length);
      for (let i = 0; i < indices.length; i += 1) {
        result[i] = entries[indices[i]!]!;
      }
      return result;
    },
    queryRectIds(bounds, sceneGraphRef) {
      const indices = collectRectCandidateIndices(bounds, null, sceneGraphRef);
      const ids: string[] = [];
      for (let i = 0; i < indices.length; i += 1) {
        const entry = entries[indices[i]!]!;
        if (rectsIntersect(resolveCanvas2DNodeWorldBounds(entry.node, sceneGraphRef), bounds)) {
          ids.push(entry.node.id);
        }
      }
      for (let i = 0; i < groups.length; i += 1) {
        const group = groups[i]!;
        if (rectsIntersect(group.bounds, bounds)) {
          ids.push(group.node.id);
        }
      }
      return ids;
    },
    queryVisibleHtmlIds(bounds, preview, sceneGraphRef) {
      if (htmlEntryCount === 0) {
        return [];
      }
      const indices = collectRectCandidateIndices(bounds, preview, sceneGraphRef);
      const ids: string[] = [];
      for (let i = 0; i < indices.length; i += 1) {
        const entry = entries[indices[i]!]!;
        if (entry.node.type === "html") {
          ids.push(entry.node.id);
        }
      }
      return ids;
    }
  };
}

function sameVec2(
  a: readonly [number, number],
  b: readonly [number, number]
): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function sameOptionalRecord(
  a: Readonly<Record<string, unknown>> | undefined,
  b: Readonly<Record<string, unknown>> | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i += 1) {
    const key = aKeys[i]!;
    if (!Object.prototype.hasOwnProperty.call(b, key) || !Object.is(a[key], b[key])) {
      return false;
    }
  }
  return true;
}

function sameCornerRadius(
  a: number | readonly [number, number, number, number],
  b: number | readonly [number, number, number, number]
): boolean {
  if (typeof a === "number" || typeof b === "number") {
    return a === b;
  }
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

function sameClipRect(
  a: { readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly cornerRadius: number | readonly [number, number, number, number] } | null,
  b: { readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly cornerRadius: number | readonly [number, number, number, number] } | null
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    sameCornerRadius(a.cornerRadius, b.cornerRadius)
  );
}

function isSameCanvas2DNodeValue(a: Canvas2DNode, b: Canvas2DNode): boolean {
  if (a.locked !== b.locked || !sameOptionalRecord(a.metadata, b.metadata)) {
    return false;
  }
  switch (a.type) {
    case "rect":
      return (
        b.type === "rect" &&
        sameVec2(a.position, b.position) &&
        sameVec2(a.size, b.size) &&
        a.rotation === b.rotation &&
        sameVec2(a.scale, b.scale) &&
        a.fill === b.fill &&
        sameCornerRadius(a.cornerRadius, b.cornerRadius) &&
        a.stroke === b.stroke &&
        a.strokeWidth === b.strokeWidth &&
        a.opacity === b.opacity
      );
    case "circle":
      return (
        b.type === "circle" &&
        sameVec2(a.position, b.position) &&
        a.radius === b.radius &&
        a.rotation === b.rotation &&
        sameVec2(a.scale, b.scale) &&
        a.fill === b.fill &&
        a.stroke === b.stroke &&
        a.strokeWidth === b.strokeWidth &&
        a.opacity === b.opacity
      );
    case "group":
      return (
        b.type === "group" &&
        sameVec2(a.position, b.position) &&
        a.rotation === b.rotation &&
        sameVec2(a.scale, b.scale) &&
        a.opacity === b.opacity &&
        sameClipRect(a.clip, b.clip)
      );
    case "html":
      return (
        b.type === "html" &&
        sameVec2(a.position, b.position) &&
        a.width === b.width &&
        a.height === b.height &&
        a.rotation === b.rotation &&
        sameVec2(a.scale, b.scale) &&
        a.html === b.html
      );
    case "text":
      return (
        b.type === "text" &&
        sameVec2(a.position, b.position) &&
        a.text === b.text &&
        a.fontSize === b.fontSize &&
        a.fontFamily === b.fontFamily &&
        a.fontWeight === b.fontWeight &&
        a.fill === b.fill &&
        a.align === b.align &&
        a.width === b.width &&
        a.rotation === b.rotation &&
        sameVec2(a.scale, b.scale)
      );
    case "measurement":
      return (
        b.type === "measurement" &&
        sameVec2(a.start, b.start) &&
        sameVec2(a.end, b.end) &&
        a.precision === b.precision &&
        a.unit.name === b.unit.name &&
        a.unit.symbol === b.unit.symbol &&
        a.unit.metersPerUnit === b.unit.metersPerUnit
      );
    case "annotation":
      return (
        b.type === "annotation" &&
        sameVec2(a.anchor, b.anchor) &&
        a.text === b.text &&
        a.targetId === b.targetId
      );
    case "edge":
      return (
        b.type === "edge" &&
        a.sourceId === b.sourceId &&
        a.targetId === b.targetId &&
        a.sourcePort === b.sourcePort &&
        a.targetPort === b.targetPort &&
        sameVec2(a.sourceAnchor, b.sourceAnchor) &&
        sameVec2(a.targetAnchor, b.targetAnchor) &&
        a.curve === b.curve &&
        a.routing === b.routing &&
        a.avoidObstacles === b.avoidObstacles &&
        a.obstaclePadding === b.obstaclePadding &&
        a.curveOffset === b.curveOffset &&
        a.lineStyle === b.lineStyle &&
        a.stroke === b.stroke &&
        a.strokeWidth === b.strokeWidth &&
        a.sourceArrow === b.sourceArrow &&
        a.targetArrow === b.targetArrow
      );
    default:
      return false;
  }
}

export function syncCanvas2DSpatialIndex(
  previousIndex: Canvas2DSpatialIndex,
  previousScene: Canvas2DScene,
  nextScene: Canvas2DScene,
  nextSceneGraph: Canvas2DSceneGraph
): Canvas2DSpatialIndex {
  if (previousIndex.syncIncremental(previousScene, nextScene, nextSceneGraph)) {
    return previousIndex;
  }
  return createCanvas2DSpatialIndex(nextScene, nextSceneGraph);
}
