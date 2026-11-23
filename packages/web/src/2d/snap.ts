import type { Canvas2DRectBounds } from "../view2d";
import { resolveCanvas2DNodeWorldBounds } from "./geometry";
import type { Canvas2DSceneGraph } from "./scene-graph";
import type { Canvas2DSpatialIndex } from "./spatial-index";

export type Canvas2DSnapGuideAxis = "x" | "y";
export type Canvas2DSnapEdge = "start" | "center" | "end";

export type Canvas2DSnapCandidate = {
  readonly id: string;
  readonly bounds: Canvas2DRectBounds;
};

export type Canvas2DSnapGuide = {
  readonly axis: Canvas2DSnapGuideAxis;
  readonly position: number;
  readonly from: number;
  readonly to: number;
  readonly sourceEdge: Canvas2DSnapEdge;
  readonly targetEdge: Canvas2DSnapEdge;
  readonly targetNodeId: string;
};

export type Canvas2DSnapOptions = {
  readonly threshold?: number;
  readonly excludeNodeIds?: readonly string[];
  readonly searchBounds?: Canvas2DRectBounds;
  readonly snapToCenters?: boolean;
  readonly snapToEdges?: boolean;
};

export type Canvas2DSnapResult = {
  readonly dx: number;
  readonly dy: number;
  readonly snappedBounds: Canvas2DRectBounds;
  readonly guides: readonly Canvas2DSnapGuide[];
  readonly candidateCount: number;
};

const DEFAULT_SNAP_THRESHOLD = 6;
const GUIDE_EPSILON = 1e-4;

function getAxisAnchors(
  min: number,
  max: number,
  snapToEdges: boolean,
  snapToCenters: boolean
): Array<{ readonly edge: Canvas2DSnapEdge; readonly value: number }> {
  const anchors: Array<{ readonly edge: Canvas2DSnapEdge; readonly value: number }> = [];
  if (snapToEdges) {
    anchors.push({ edge: "start", value: min });
  }
  if (snapToCenters) {
    anchors.push({ edge: "center", value: (min + max) / 2 });
  }
  if (snapToEdges) {
    anchors.push({ edge: "end", value: max });
  }
  return anchors;
}

/**
 * Pure O(candidates) 2D alignment snap solver. Compares start, center, and end
 * anchors along X and Y independently against `candidates` within `threshold`
 * scene units and returns the minimum translation delta plus visual guide spans.
 */
export function computeCanvas2DSnapGuides(
  targetBounds: Canvas2DRectBounds,
  candidates: readonly Canvas2DSnapCandidate[],
  options: Canvas2DSnapOptions = {}
): Canvas2DSnapResult {
  const threshold = options.threshold ?? DEFAULT_SNAP_THRESHOLD;
  const snapToEdges = options.snapToEdges ?? true;
  const snapToCenters = options.snapToCenters ?? true;
  const excluded =
    options.excludeNodeIds && options.excludeNodeIds.length > 0
      ? new Set(options.excludeNodeIds)
      : null;

  if (threshold <= 0 || (!snapToEdges && !snapToCenters)) {
    return {
      dx: 0,
      dy: 0,
      snappedBounds: targetBounds,
      guides: [],
      candidateCount: 0
    };
  }

  const srcX = getAxisAnchors(targetBounds.minX, targetBounds.maxX, snapToEdges, snapToCenters);
  const srcY = getAxisAnchors(targetBounds.minY, targetBounds.maxY, snapToEdges, snapToCenters);

  let bestDx = 0;
  let bestAbsDx = threshold + GUIDE_EPSILON;
  let hasX = false;

  let bestDy = 0;
  let bestAbsDy = threshold + GUIDE_EPSILON;
  let hasY = false;

  const filtered: Canvas2DSnapCandidate[] = [];

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i]!;
    if (excluded?.has(candidate.id)) {
      continue;
    }
    const cb = candidate.bounds;
    if (
      !Number.isFinite(cb.minX) ||
      !Number.isFinite(cb.minY) ||
      !Number.isFinite(cb.maxX) ||
      !Number.isFinite(cb.maxY)
    ) {
      continue;
    }
    filtered.push(candidate);

    const candX = getAxisAnchors(cb.minX, cb.maxX, snapToEdges, snapToCenters);
    for (let s = 0; s < srcX.length; s += 1) {
      const sv = srcX[s]!.value;
      for (let t = 0; t < candX.length; t += 1) {
        const delta = candX[t]!.value - sv;
        const abs = Math.abs(delta);
        if (abs < bestAbsDx - GUIDE_EPSILON) {
          bestAbsDx = abs;
          bestDx = delta;
          hasX = true;
        }
      }
    }

    const candY = getAxisAnchors(cb.minY, cb.maxY, snapToEdges, snapToCenters);
    for (let s = 0; s < srcY.length; s += 1) {
      const sv = srcY[s]!.value;
      for (let t = 0; t < candY.length; t += 1) {
        const delta = candY[t]!.value - sv;
        const abs = Math.abs(delta);
        if (abs < bestAbsDy - GUIDE_EPSILON) {
          bestAbsDy = abs;
          bestDy = delta;
          hasY = true;
        }
      }
    }
  }

  const dx = hasX ? bestDx : 0;
  const dy = hasY ? bestDy : 0;
  const snappedBounds: Canvas2DRectBounds = {
    minX: targetBounds.minX + dx,
    minY: targetBounds.minY + dy,
    maxX: targetBounds.maxX + dx,
    maxY: targetBounds.maxY + dy
  };

  const guides: Canvas2DSnapGuide[] = [];
  if (hasX || hasY) {
    const snappedX = getAxisAnchors(
      snappedBounds.minX,
      snappedBounds.maxX,
      snapToEdges,
      snapToCenters
    );
    const snappedY = getAxisAnchors(
      snappedBounds.minY,
      snappedBounds.maxY,
      snapToEdges,
      snapToCenters
    );

    for (let i = 0; i < filtered.length; i += 1) {
      const candidate = filtered[i]!;
      const cb = candidate.bounds;
      if (hasX) {
        const candX = getAxisAnchors(cb.minX, cb.maxX, snapToEdges, snapToCenters);
        for (let s = 0; s < snappedX.length; s += 1) {
          for (let t = 0; t < candX.length; t += 1) {
            if (Math.abs(candX[t]!.value - snappedX[s]!.value) <= GUIDE_EPSILON) {
              guides.push({
                axis: "x",
                position: candX[t]!.value,
                from: Math.min(snappedBounds.minY, cb.minY),
                to: Math.max(snappedBounds.maxY, cb.maxY),
                sourceEdge: snappedX[s]!.edge,
                targetEdge: candX[t]!.edge,
                targetNodeId: candidate.id
              });
            }
          }
        }
      }
      if (hasY) {
        const candY = getAxisAnchors(cb.minY, cb.maxY, snapToEdges, snapToCenters);
        for (let s = 0; s < snappedY.length; s += 1) {
          for (let t = 0; t < candY.length; t += 1) {
            if (Math.abs(candY[t]!.value - snappedY[s]!.value) <= GUIDE_EPSILON) {
              guides.push({
                axis: "y",
                position: candY[t]!.value,
                from: Math.min(snappedBounds.minX, cb.minX),
                to: Math.max(snappedBounds.maxX, cb.maxX),
                sourceEdge: snappedY[s]!.edge,
                targetEdge: candY[t]!.edge,
                targetNodeId: candidate.id
              });
            }
          }
        }
      }
    }
  }

  return {
    dx,
    dy,
    snappedBounds,
    guides,
    candidateCount: filtered.length
  };
}

/**
 * Spatial-index-backed O(visible) snap solver. Queries only drawable nodes
 * intersecting `searchBounds` (typically the current viewport) instead of
 * scanning all nodes in the scene.
 */
export function computeCanvas2DSnapGuidesFromIndex(
  targetBounds: Canvas2DRectBounds,
  spatialIndex: Canvas2DSpatialIndex,
  sceneGraph: Canvas2DSceneGraph,
  defaultSearchBounds: Canvas2DRectBounds,
  options: Canvas2DSnapOptions = {}
): Canvas2DSnapResult {
  const threshold = options.threshold ?? DEFAULT_SNAP_THRESHOLD;
  const baseSearch = options.searchBounds ?? defaultSearchBounds;
  const queryBounds: Canvas2DRectBounds = {
    minX: Math.min(baseSearch.minX, targetBounds.minX) - threshold,
    minY: Math.min(baseSearch.minY, targetBounds.minY) - threshold,
    maxX: Math.max(baseSearch.maxX, targetBounds.maxX) + threshold,
    maxY: Math.max(baseSearch.maxY, targetBounds.maxY) + threshold
  };
  const excluded =
    options.excludeNodeIds && options.excludeNodeIds.length > 0
      ? new Set(options.excludeNodeIds)
      : null;

  const entries = spatialIndex.queryRect(queryBounds, null, sceneGraph);
  const candidates: Canvas2DSnapCandidate[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    const node = entries[i]!.node;
    if (
      node.type === "edge" ||
      node.type === "measurement" ||
      node.type === "annotation" ||
      excluded?.has(node.id)
    ) {
      continue;
    }
    candidates.push({
      id: node.id,
      bounds: resolveCanvas2DNodeWorldBounds(node, sceneGraph)
    });
  }

  const { excludeNodeIds: _ignored, ...restOptions } = options;
  return computeCanvas2DSnapGuides(targetBounds, candidates, restOptions);
}
