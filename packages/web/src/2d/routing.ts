import type { CanvasNodePortSide } from "@de-novo/canvas-core";
import type { Canvas2DRectBounds } from "../view2d";

export type Canvas2DObstacleRouteOptions = {
  readonly padding?: number;
  readonly sourceBounds?: Canvas2DRectBounds | null;
  readonly targetBounds?: Canvas2DRectBounds | null;
};

const EPS = 1e-3;
const DEFAULT_PADDING = 16;
const DEFAULT_PORT_STUB = 24;
const BEND_PENALTY = 48;
const TIGHT_GUTTER_FACTOR = 1.35;
const MAX_AXIS_LINES = 72;

function portDirection(side: CanvasNodePortSide): readonly [number, number] {
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

function facingAxis(
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

function expandBox(box: Canvas2DRectBounds, pad: number): Canvas2DRectBounds {
  return pad <= 0
    ? box
    : {
        minX: box.minX - pad,
        minY: box.minY - pad,
        maxX: box.maxX + pad,
        maxY: box.maxY + pad
      };
}

function boxesIntersect(a: Canvas2DRectBounds, b: Canvas2DRectBounds): boolean {
  return (
    a.minX <= b.maxX &&
    a.maxX >= b.minX &&
    a.minY <= b.maxY &&
    a.maxY >= b.minY
  );
}

/**
 * True when an axis-aligned segment passes through the strict interior of
 * `box`. Segments running flush along a box boundary return `false`.
 */
export function orthogonalSegmentIntersectsBoxInterior(
  a: readonly [number, number],
  b: readonly [number, number],
  box: Canvas2DRectBounds
): boolean {
  if (Math.abs(a[1] - b[1]) <= EPS) {
    const y = (a[1] + b[1]) * 0.5;
    if (y <= box.minY + EPS || y >= box.maxY - EPS) {
      return false;
    }
    const minX = Math.min(a[0], b[0]);
    const maxX = Math.max(a[0], b[0]);
    return maxX > box.minX + EPS && minX < box.maxX - EPS;
  }

  if (Math.abs(a[0] - b[0]) <= EPS) {
    const x = (a[0] + b[0]) * 0.5;
    if (x <= box.minX + EPS || x >= box.maxX - EPS) {
      return false;
    }
    const minY = Math.min(a[1], b[1]);
    const maxY = Math.max(a[1], b[1]);
    return maxY > box.minY + EPS && minY < box.maxY - EPS;
  }

  return false;
}

function polylineHitsAnyBox(
  points: readonly (readonly [number, number])[],
  boxes: readonly Canvas2DRectBounds[]
): boolean {
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    for (let j = 0; j < boxes.length; j += 1) {
      if (orthogonalSegmentIntersectsBoxInterior(a, b, boxes[j]!)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Shortens a port stub when another obstacle sits directly in front of the
 * port within the nominal stub distance, placing the exit point cleanly at the
 * midpoint of the open gutter instead of inside the neighbor.
 */
function clampStubAgainstObstacles(
  origin: readonly [number, number],
  port: CanvasNodePortSide,
  desiredStub: number,
  obstacles: readonly Canvas2DRectBounds[]
): number {
  let stub = desiredStub;
  const [ox, oy] = origin;

  for (let i = 0; i < obstacles.length; i += 1) {
    const ob = obstacles[i]!;
    if (port === "right") {
      if (oy > ob.minY + EPS && oy < ob.maxY - EPS && ob.minX >= ox - EPS) {
        const dist = ob.minX - ox;
        if (dist > EPS && dist < stub) {
          stub = dist * 0.5;
        }
      }
    } else if (port === "left") {
      if (oy > ob.minY + EPS && oy < ob.maxY - EPS && ob.maxX <= ox + EPS) {
        const dist = ox - ob.maxX;
        if (dist > EPS && dist < stub) {
          stub = dist * 0.5;
        }
      }
    } else if (port === "bottom") {
      if (ox > ob.minX + EPS && ox < ob.maxX - EPS && ob.minY >= oy - EPS) {
        const dist = ob.minY - oy;
        if (dist > EPS && dist < stub) {
          stub = dist * 0.5;
        }
      }
    } else if (port === "top") {
      if (ox > ob.minX + EPS && ox < ob.maxX - EPS && ob.maxY <= oy + EPS) {
        const dist = oy - ob.maxY;
        if (dist > EPS && dist < stub) {
          stub = dist * 0.5;
        }
      }
    }
  }

  return Math.max(0, stub);
}

function simplifyOrthogonalPath(
  points: readonly (readonly [number, number])[]
): (readonly [number, number])[] {
  const deduped: (readonly [number, number])[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const pt = points[i]!;
    const prev = deduped[deduped.length - 1];
    if (
      !prev ||
      Math.abs(prev[0] - pt[0]) > EPS ||
      Math.abs(prev[1] - pt[1]) > EPS
    ) {
      deduped.push(pt);
    }
  }

  if (deduped.length <= 2) {
    return deduped;
  }

  const out: (readonly [number, number])[] = [deduped[0]!];
  for (let i = 1; i < deduped.length - 1; i += 1) {
    const prev = out[out.length - 1]!;
    const curr = deduped[i]!;
    const next = deduped[i + 1]!;
    const sameX =
      Math.abs(prev[0] - curr[0]) <= EPS && Math.abs(curr[0] - next[0]) <= EPS;
    const sameY =
      Math.abs(prev[1] - curr[1]) <= EPS && Math.abs(curr[1] - next[1]) <= EPS;
    if (!sameX && !sameY) {
      out.push(curr);
    }
  }
  out.push(deduped[deduped.length - 1]!);
  return out;
}

function collectCorridorObstacles(
  start: readonly [number, number],
  end: readonly [number, number],
  afterStart: readonly [number, number],
  beforeEnd: readonly [number, number],
  sourceBounds: Canvas2DRectBounds | null,
  targetBounds: Canvas2DRectBounds | null,
  obstacles: readonly Canvas2DRectBounds[],
  padding: number
): Canvas2DRectBounds[] {
  const margin = Math.max(padding * 2, 48);
  let minX = Math.min(start[0], end[0], afterStart[0], beforeEnd[0]);
  let maxX = Math.max(start[0], end[0], afterStart[0], beforeEnd[0]);
  let minY = Math.min(start[1], end[1], afterStart[1], beforeEnd[1]);
  let maxY = Math.max(start[1], end[1], afterStart[1], beforeEnd[1]);

  if (sourceBounds) {
    minX = Math.min(minX, sourceBounds.minX);
    maxX = Math.max(maxX, sourceBounds.maxX);
    minY = Math.min(minY, sourceBounds.minY);
    maxY = Math.max(maxY, sourceBounds.maxY);
  }
  if (targetBounds) {
    minX = Math.min(minX, targetBounds.minX);
    maxX = Math.max(maxX, targetBounds.maxX);
    minY = Math.min(minY, targetBounds.minY);
    maxY = Math.max(maxY, targetBounds.maxY);
  }

  let corridor: Canvas2DRectBounds = {
    minX: minX - margin,
    minY: minY - margin,
    maxX: maxX + margin,
    maxY: maxY + margin
  };

  const included = new Uint8Array(obstacles.length);
  const selected: Canvas2DRectBounds[] = [];

  for (let pass = 0; pass < 6; pass += 1) {
    let grew = false;
    for (let i = 0; i < obstacles.length; i += 1) {
      if (included[i] === 1) {
        continue;
      }
      const ob = obstacles[i]!;
      if (boxesIntersect(corridor, ob)) {
        included[i] = 1;
        selected.push(ob);
        corridor = {
          minX: Math.min(corridor.minX, ob.minX - margin),
          minY: Math.min(corridor.minY, ob.minY - margin),
          maxX: Math.max(corridor.maxX, ob.maxX + margin),
          maxY: Math.max(corridor.maxY, ob.maxY + margin)
        };
        grew = true;
      }
    }
    if (!grew) {
      break;
    }
  }

  return selected;
}

function collectGutterMidpoints(
  intervals: readonly (readonly [number, number])[]
): number[] {
  if (intervals.length < 2) {
    return [];
  }
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [[sorted[0]![0], sorted[0]![1]]];
  for (let i = 1; i < sorted.length; i += 1) {
    const [lo, hi] = sorted[i]!;
    const last = merged[merged.length - 1]!;
    if (lo <= last[1] + EPS) {
      if (hi > last[1]) {
        last[1] = hi;
      }
    } else {
      merged.push([lo, hi]);
    }
  }

  const midpoints: number[] = [];
  for (let i = 1; i < merged.length; i += 1) {
    const prevEnd = merged[i - 1]![1];
    const nextStart = merged[i]![0];
    if (nextStart - prevEnd > 0.5) {
      midpoints.push((prevEnd + nextStart) * 0.5);
    }
  }
  return midpoints;
}

function buildAxisCoordinates(
  required: readonly number[],
  candidates: readonly number[]
): number[] {
  const all = [...required, ...candidates].filter(Number.isFinite);
  all.sort((a, b) => a - b);

  const unique: number[] = [];
  for (let i = 0; i < all.length; i += 1) {
    const value = all[i]!;
    const prev = unique[unique.length - 1];
    if (prev === undefined || value - prev > 0.25) {
      unique.push(value);
    }
  }

  // Ensure exact required coordinates remain present.
  for (let i = 0; i < required.length; i += 1) {
    const req = required[i]!;
    let found = false;
    for (let j = 0; j < unique.length; j += 1) {
      if (Math.abs(unique[j]! - req) <= EPS) {
        unique[j] = req;
        found = true;
        break;
      }
    }
    if (!found) {
      unique.push(req);
    }
  }
  unique.sort((a, b) => a - b);

  if (unique.length <= MAX_AXIS_LINES) {
    return unique;
  }

  // Downsample optional interior lines while preserving required endpoints and outer rails.
  const pinned = new Set<number>([0, unique.length - 1]);
  for (let i = 0; i < required.length; i += 1) {
    const req = required[i]!;
    for (let j = 0; j < unique.length; j += 1) {
      if (Math.abs(unique[j]! - req) <= EPS) {
        pinned.add(j);
        break;
      }
    }
  }
  const budget = Math.max(2, MAX_AXIS_LINES - pinned.size);
  const step = unique.length / budget;
  for (let i = 0; i < budget; i += 1) {
    pinned.add(Math.min(unique.length - 1, Math.floor(i * step)));
  }
  return Array.from(pinned)
    .sort((a, b) => a - b)
    .map((index) => unique[index]!);
}

function findCoordinateIndex(coords: readonly number[], target: number): number {
  let bestIndex = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let i = 0; i < coords.length; i += 1) {
    const delta = Math.abs(coords[i]! - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = i;
    }
  }
  return bestIndex;
}

type HeapItem = {
  readonly state: number;
  readonly f: number;
};

class MinHeap {
  private readonly items: HeapItem[] = [];

  get size() {
    return this.items.length;
  }

  push(item: HeapItem) {
    const items = this.items;
    items.push(item);
    let idx = items.length - 1;
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (items[parent]!.f <= items[idx]!.f) {
        break;
      }
      const tmp = items[parent]!;
      items[parent] = items[idx]!;
      items[idx] = tmp;
      idx = parent;
    }
  }

  pop(): HeapItem | undefined {
    const items = this.items;
    if (items.length === 0) {
      return undefined;
    }
    const top = items[0]!;
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let idx = 0;
      const len = items.length;
      while (true) {
        const left = (idx << 1) + 1;
        const right = left + 1;
        let smallest = idx;
        if (left < len && items[left]!.f < items[smallest]!.f) {
          smallest = left;
        }
        if (right < len && items[right]!.f < items[smallest]!.f) {
          smallest = right;
        }
        if (smallest === idx) {
          break;
        }
        const tmp = items[idx]!;
        items[idx] = items[smallest]!;
        items[smallest] = tmp;
        idx = smallest;
      }
    }
    return top;
  }
}

/**
 * Pure obstacle-free gutter orthogonal edge router.
 *
 * Computes orthogonal waypoints from `start` to `end` (excluding `start`,
 * including `end` — matching `resolveCanvas2DOrthogonalWaypoints`) that:
 * 1. Honor port exit/entry directions without cutting across endpoint boxes.
 * 2. Take a fast-path L/Z route when the direct corridor is obstacle-free.
 * 3. Otherwise build a gutter visibility grid (padded edges + centered gap
 *    midlines + outer escape rails) and run bend-penalized A* so segments
 *    thread cleanly down open gutters and never cross any obstacle interior.
 */
export function resolveCanvas2DObstacleFreeOrthogonalWaypoints(
  start: readonly [number, number],
  end: readonly [number, number],
  sourcePort: CanvasNodePortSide | null,
  targetPort: CanvasNodePortSide | null,
  obstacles: readonly Canvas2DRectBounds[],
  options: Canvas2DObstacleRouteOptions = {}
): readonly (readonly [number, number])[] {
  const padding =
    options.padding !== undefined &&
    Number.isFinite(options.padding) &&
    options.padding >= 0
      ? options.padding
      : DEFAULT_PADDING;
  const sourceBounds = options.sourceBounds ?? null;
  const targetBounds = options.targetBounds ?? null;

  const nominalStub = Math.max(DEFAULT_PORT_STUB, padding);
  let startStub = sourcePort === null ? 0 : nominalStub;
  let endStub = targetPort === null ? 0 : nominalStub;

  const facing = facingAxis(sourcePort, targetPort);
  if (facing !== null) {
    const gap =
      facing === "horizontal"
        ? Math.abs(start[0] - end[0])
        : Math.abs(start[1] - end[1]);
    const maxEach = gap * 0.5;
    startStub = Math.min(startStub, maxEach);
    endStub = Math.min(endStub, maxEach);
  }

  if (sourcePort !== null) {
    startStub = clampStubAgainstObstacles(start, sourcePort, startStub, obstacles);
  }
  if (targetPort !== null) {
    endStub = clampStubAgainstObstacles(end, targetPort, endStub, obstacles);
  }

  const afterStart: readonly [number, number] =
    sourcePort === null
      ? start
      : (() => {
          const [dx, dy] = portDirection(sourcePort);
          return [start[0] + dx * startStub, start[1] + dy * startStub] as const;
        })();

  const beforeEnd: readonly [number, number] =
    targetPort === null
      ? end
      : (() => {
          const [dx, dy] = portDirection(targetPort);
          return [end[0] + dx * endStub, end[1] + dy * endStub] as const;
        })();

  const localObstacles = collectCorridorObstacles(
    start,
    end,
    afterStart,
    beforeEnd,
    sourceBounds,
    targetBounds,
    obstacles,
    padding
  );

  const hardObstacles: Canvas2DRectBounds[] = [...localObstacles];
  if (sourceBounds) {
    hardObstacles.push(sourceBounds);
  }
  if (targetBounds) {
    hardObstacles.push(targetBounds);
  }
  const paddedObstacles = localObstacles.map((ob) => expandBox(ob, padding));
  const preferredClearBoxes: Canvas2DRectBounds[] = [
    ...paddedObstacles,
    ...(sourceBounds ? [sourceBounds] : []),
    ...(targetBounds ? [targetBounds] : [])
  ];

  // Fast path: try clean direct / L-bend / midpoint Z-bend candidates first.
  const verticalFirst =
    sourcePort === "top" ||
    sourcePort === "bottom" ||
    (sourcePort === null && (targetPort === "left" || targetPort === "right"));

  const midX = (afterStart[0] + beforeEnd[0]) * 0.5;
  const midY = (afterStart[1] + beforeEnd[1]) * 0.5;

  const lVertical: (readonly [number, number])[] = [
    afterStart,
    [afterStart[0], beforeEnd[1]],
    beforeEnd
  ];
  const lHorizontal: (readonly [number, number])[] = [
    afterStart,
    [beforeEnd[0], afterStart[1]],
    beforeEnd
  ];
  const zHorizontal: (readonly [number, number])[] = [
    afterStart,
    [midX, afterStart[1]],
    [midX, beforeEnd[1]],
    beforeEnd
  ];
  const zVertical: (readonly [number, number])[] = [
    afterStart,
    [afterStart[0], midY],
    [beforeEnd[0], midY],
    beforeEnd
  ];

  const simpleCandidates: (readonly (readonly [number, number])[])[] = [];
  if (
    Math.abs(afterStart[0] - beforeEnd[0]) <= EPS ||
    Math.abs(afterStart[1] - beforeEnd[1]) <= EPS
  ) {
    simpleCandidates.push([afterStart, beforeEnd]);
  }
  if (verticalFirst) {
    simpleCandidates.push(lVertical, lHorizontal, zVertical, zHorizontal);
  } else {
    simpleCandidates.push(lHorizontal, lVertical, zHorizontal, zVertical);
  }

  for (let i = 0; i < simpleCandidates.length; i += 1) {
    const candidate = simpleCandidates[i]!;
    if (!polylineHitsAnyBox(candidate, preferredClearBoxes)) {
      const full = simplifyOrthogonalPath([start, ...candidate, end]);
      return full.slice(1);
    }
  }

  // Build orthogonal gutter visibility grid.
  const xCandidates: number[] = [];
  const yCandidates: number[] = [];
  const xIntervals: (readonly [number, number])[] = [];
  const yIntervals: (readonly [number, number])[] = [];

  let globalMinX = Math.min(afterStart[0], beforeEnd[0]);
  let globalMaxX = Math.max(afterStart[0], beforeEnd[0]);
  let globalMinY = Math.min(afterStart[1], beforeEnd[1]);
  let globalMaxY = Math.max(afterStart[1], beforeEnd[1]);

  for (let i = 0; i < hardObstacles.length; i += 1) {
    const ob = hardObstacles[i]!;
    globalMinX = Math.min(globalMinX, ob.minX);
    globalMaxX = Math.max(globalMaxX, ob.maxX);
    globalMinY = Math.min(globalMinY, ob.minY);
    globalMaxY = Math.max(globalMaxY, ob.maxY);

    xIntervals.push([ob.minX, ob.maxX]);
    yIntervals.push([ob.minY, ob.maxY]);
    xCandidates.push(ob.minX - padding, ob.maxX + padding);
    yCandidates.push(ob.minY - padding, ob.maxY + padding);
  }

  const gutterXs = collectGutterMidpoints(xIntervals);
  const gutterYs = collectGutterMidpoints(yIntervals);
  const outerPad = Math.max(padding, DEFAULT_PORT_STUB);

  const requiredXs = [
    afterStart[0],
    beforeEnd[0],
    globalMinX - outerPad,
    globalMaxX + outerPad,
    ...gutterXs
  ];
  const requiredYs = [
    afterStart[1],
    beforeEnd[1],
    globalMinY - outerPad,
    globalMaxY + outerPad,
    ...gutterYs
  ];

  const xs = buildAxisCoordinates(requiredXs, xCandidates);
  const ys = buildAxisCoordinates(requiredYs, yCandidates);

  const width = xs.length;
  const height = ys.length;
  const startIx = findCoordinateIndex(xs, afterStart[0]);
  const startIy = findCoordinateIndex(ys, afterStart[1]);
  const goalIx = findCoordinateIndex(xs, beforeEnd[0]);
  const goalIy = findCoordinateIndex(ys, beforeEnd[1]);

  const stateCount = width * height * 2;
  const gScore = new Float64Array(stateCount);
  gScore.fill(Number.POSITIVE_INFINITY);
  const parentState = new Int32Array(stateCount);
  parentState.fill(-1);
  const closed = new Uint8Array(stateCount);
  const heap = new MinHeap();

  const preferStartDir =
    sourcePort === "left" || sourcePort === "right"
      ? 0
      : sourcePort === "top" || sourcePort === "bottom"
        ? 1
        : -1;

  for (let dir = 0; dir <= 1; dir += 1) {
    const state = ((startIy * width + startIx) << 1) | dir;
    const initCost =
      preferStartDir === -1 || preferStartDir === dir ? 0 : BEND_PENALTY * 0.5;
    gScore[state] = initCost;
    const h =
      Math.abs(xs[startIx]! - xs[goalIx]!) + Math.abs(ys[startIy]! - ys[goalIy]!);
    heap.push({ state, f: initCost + h });
  }

  const goalX = xs[goalIx]!;
  const goalY = ys[goalIy]!;
  let reachedState = -1;

  const neighborOffsets: readonly (readonly [number, number, number])[] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 1],
    [0, -1, 1]
  ];

  while (heap.size > 0) {
    const current = heap.pop()!;
    const state = current.state;
    if (closed[state] === 1) {
      continue;
    }
    closed[state] = 1;

    const dir = state & 1;
    const cell = state >> 1;
    const ix = cell % width;
    const iy = (cell - ix) / width;

    if (ix === goalIx && iy === goalIy) {
      reachedState = state;
      break;
    }

    const ax = xs[ix]!;
    const ay = ys[iy]!;
    const currentG = gScore[state]!;

    for (let n = 0; n < 4; n += 1) {
      const [dx, dy, nextDir] = neighborOffsets[n]!;
      const nx = ix + dx;
      const ny = iy + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
        continue;
      }

      const nextState = ((ny * width + nx) << 1) | nextDir;
      if (closed[nextState] === 1) {
        continue;
      }

      const bx = xs[nx]!;
      const by = ys[ny]!;
      const segA: readonly [number, number] = [ax, ay];
      const segB: readonly [number, number] = [bx, by];

      let blocked = false;
      for (let k = 0; k < hardObstacles.length; k += 1) {
        if (orthogonalSegmentIntersectsBoxInterior(segA, segB, hardObstacles[k]!)) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        continue;
      }

      let tightGutter = false;
      for (let k = 0; k < paddedObstacles.length; k += 1) {
        if (orthogonalSegmentIntersectsBoxInterior(segA, segB, paddedObstacles[k]!)) {
          tightGutter = true;
          break;
        }
      }

      const stepDist = Math.abs(bx - ax) + Math.abs(by - ay);
      const bendCost = nextDir !== dir ? BEND_PENALTY : 0;
      const tentativeG =
        currentG + stepDist * (tightGutter ? TIGHT_GUTTER_FACTOR : 1) + bendCost;

      if (tentativeG < gScore[nextState]!) {
        gScore[nextState] = tentativeG;
        parentState[nextState] = state;
        const h = Math.abs(bx - goalX) + Math.abs(by - goalY);
        heap.push({ state: nextState, f: tentativeG + h });
      }
    }
  }

  if (reachedState !== -1) {
    const gridPoints: (readonly [number, number])[] = [];
    let cursor = reachedState;
    while (cursor !== -1) {
      const cell = cursor >> 1;
      const ix = cell % width;
      const iy = (cell - ix) / width;
      gridPoints.push([xs[ix]!, ys[iy]!]);
      cursor = parentState[cursor]!;
    }
    gridPoints.reverse();
    const full = simplifyOrthogonalPath([start, ...gridPoints, end]);
    return full.slice(1);
  }

  // Fallback when endpoints themselves sit trapped inside overlapping obstacles.
  const fallback = simplifyOrthogonalPath([
    start,
    ...(verticalFirst ? lVertical : lHorizontal),
    end
  ]);
  return fallback.slice(1);
}
