import {
  isCanvas2DPluginNode,
  type Canvas2DNode,
  type Canvas2DScene,
  type CanvasNodeTransformPreview
} from "@denovo/canvas-core";

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
  readonly isIdentityParent: boolean;
  readonly node: Canvas2DDrawableNode;
  readonly order: number;
  readonly parentWorldTransform: Canvas2DMatrix;
};

export type Canvas2DSpatialGroupEntry = {
  readonly bounds: Canvas2DRectBounds;
  readonly node: Canvas2DGroupNode;
};

export type Canvas2DSpatialIndex = {
  readonly cellSize: number;
  readonly entries: readonly Canvas2DSpatialDrawableEntry[];
  readonly entryIndexByNodeId: ReadonlyMap<string, number>;
  readonly groups: readonly Canvas2DSpatialGroupEntry[];
  readonly htmlEntryCount: number;
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
      const minX = Math.min(0, node.size[0]);
      const maxX = Math.max(0, node.size[0]);
      const minY = Math.min(0, node.size[1]);
      const maxY = Math.max(0, node.size[1]);
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
      const r = node.radius + 2;
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

  function visitNode(node: Canvas2DNode, parentWorldTransform: Canvas2DMatrix) {
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
      for (const child of getCanvas2DGroupChildren(sceneGraph, node.id)) {
        visitNode(child, worldTransform);
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
      visitNode(root, CANVAS_2D_IDENTITY_MATRIX);
    }
  }

  const cellSize = chooseCellSize(entries);
  const invCellSize = 1 / cellSize;
  const cells = new Map<number, number[]>();
  const overflow: number[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const { bounds } = entries[index]!;
    if (
      !Number.isFinite(bounds.minX) ||
      !Number.isFinite(bounds.minY) ||
      !Number.isFinite(bounds.maxX) ||
      !Number.isFinite(bounds.maxY)
    ) {
      overflow.push(index);
      continue;
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
      continue;
    }

    for (let cy = minCy; cy <= maxCy; cy += 1) {
      for (let cx = minCx; cx <= maxCx; cx += 1) {
        const key = encodeCellKey(cx, cy);
        if (key === null) {
          continue;
        }
        const bucket = cells.get(key);
        if (bucket) {
          bucket.push(index);
        } else {
          cells.set(key, [index]);
        }
      }
    }
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

  return {
    cellSize,
    entries,
    entryIndexByNodeId,
    groups,
    htmlEntryCount,
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
