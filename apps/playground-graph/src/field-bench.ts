import {
  canvasScreenPointSize,
  renderCanvas2DPointField,
  type Canvas2DPointFieldEdge,
  type Canvas2DPointFieldPoint,
  type Canvas2DRuntime
} from "@de-novo/canvas-web";
import {
  createRelationGraphLayoutAdapter,
  createTimeGraphLayoutAdapter
} from "@de-novo/canvas-editor";

const FILLS = ["#38bdf8", "#f97316", "#a78bfa", "#94a3b8", "#22c55e", "#f43f5e", "#eab308", "#2dd4bf"];
const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 7, 1);

export type PointFieldBench = {
  readonly count: number;
  readonly drawMs: readonly number[];
  readonly lastDrawnPoints: number;
  readonly lastDrawnEdges: number;
  readonly minScreenPx: number;
};

export function createPointFieldBench(
  runtime: Canvas2DRuntime,
  overlay: HTMLCanvasElement,
  count: number
): {
  applyTime: () => void;
  applyRelation: () => void;
  fit: () => void;
  getReport: () => PointFieldBench;
  redraw: () => void;
} {
  const generated = generateField(count);
  let points = generated.points;
  const edges = generated.edges;
  const drawMs: number[] = [];
  let lastDrawnPoints = 0;
  let lastDrawnEdges = 0;
  const overlayContext = overlay.getContext("2d");
  if (!overlayContext) {
    throw new Error("2D overlay context is not available.");
  }
  const context = overlayContext;

  function syncOverlay(): void {
    const size = runtime.getViewportSize();
    const dpr = window.devicePixelRatio || 1;
    overlay.width = Math.max(1, Math.floor(size.width * dpr));
    overlay.height = Math.max(1, Math.floor(size.height * dpr));
    overlay.style.width = `${size.width}px`;
    overlay.style.height = `${size.height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function redraw(): void {
    syncOverlay();
    const size = runtime.getViewportSize();
    const started = performance.now();
    context.clearRect(0, 0, size.width, size.height);
    const stats = renderCanvas2DPointField(context, {
      points,
      edges,
      view: runtime.viewState,
      viewport: size
    });
    const elapsed = performance.now() - started;
    drawMs.push(elapsed);
    lastDrawnPoints = stats.drawnPoints;
    lastDrawnEdges = stats.drawnEdges;
  }

  function apply(kind: "time" | "relation"): void {
    const adapter =
      kind === "time" ? createTimeGraphLayoutAdapter() : createRelationGraphLayoutAdapter();
    const nodes = toLayoutNodes(points);
    const result = adapter.apply({
      nodes,
      edges: generated.layoutEdges,
      measured: true,
      options:
        kind === "time"
          ? { at: generated.at, origin: [0, 0], columnGap: 24, laneGap: 18 }
          : { origin: [0, 0], layerGap: 28, laneGap: 20, componentGap: 48 }
    });
    const next = points.map((point) => ({ ...point }));
    const moved = new Map(result.positions.map((placement) => [placement.id, placement.position]));
    for (const node of nodes) {
      const position = moved.get(node.id);
      if (!position) {
        continue;
      }
      const index = Number(node.id);
      next[index] = { ...next[index]!, x: position[0], y: position[1] };
    }
    points = next;
    fit();
  }

  function fit(): void {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    runtime.fitViewBounds({ minX, minY, maxX, maxY }, 48, false);
    redraw();
  }

  return {
    applyTime: () => apply("time"),
    applyRelation: () => apply("relation"),
    fit,
    getReport: () => ({
      count,
      drawMs,
      lastDrawnPoints,
      lastDrawnEdges,
      minScreenPx: canvasScreenPointSize(8, runtime.viewState.zoom)
    }),
    redraw
  };
}

function generateField(count: number): {
  readonly points: Canvas2DPointFieldPoint[];
  readonly edges: Canvas2DPointFieldEdge[];
  readonly layoutEdges: readonly { id: string; sourceId: string; targetId: string }[];
  readonly at: Record<string, number>;
} {
  const points: Canvas2DPointFieldPoint[] = [];
  const edges: Canvas2DPointFieldEdge[] = [];
  const layoutEdges: { id: string; sourceId: string; targetId: string }[] = [];
  const at: Record<string, number> = {};
  const clusters = 8;
  const edgeCount = Math.min(1_600, Math.floor(count * 0.16));

  for (let index = 0; index < count; index += 1) {
    const cluster = index % clusters;
    points.push({
      x: (index % 100) * 12,
      y: Math.floor(index / 100) * 12,
      fill: FILLS[cluster]!,
      radius: 8
    });
    at[String(index)] = T0 + (index % 90) * DAY;
  }

  for (let index = 0; index < edgeCount; index += 1) {
    const cluster = index % clusters;
    const source = cluster + ((index * 13) % Math.floor(count / clusters)) * clusters;
    const target = cluster + ((index * 29 + 3) % Math.floor(count / clusters)) * clusters;
    if (source === target || source >= count || target >= count) {
      continue;
    }
    edges.push({ source, target });
    layoutEdges.push({
      id: `e${index}`,
      sourceId: String(source),
      targetId: String(target)
    });
  }

  return { points, edges, layoutEdges, at };
}

function toLayoutNodes(points: readonly Canvas2DPointFieldPoint[]) {
  return points.map((point, index) => ({
    id: String(index),
    type: "circle",
    position: [point.x, point.y] as [number, number],
    bounds: { minX: point.x, minY: point.y, maxX: point.x, maxY: point.y }
  }));
}
