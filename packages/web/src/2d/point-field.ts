import { canvasScreenPointRadius } from "@de-novo/canvas-editor";

import type { Canvas2DViewState } from "../view2d";

export type Canvas2DPointFieldRange = {
  readonly min: number;
  readonly max: number;
};

export type Canvas2DPointFieldPoint = {
  readonly x: number;
  readonly y: number;
  readonly fill: string;
  readonly radius?: number;
};

export type Canvas2DPointFieldEdge = {
  readonly source: number;
  readonly target: number;
};

export type Canvas2DPointFieldInput = {
  readonly points: readonly Canvas2DPointFieldPoint[];
  readonly edges?: readonly Canvas2DPointFieldEdge[];
  readonly view: Canvas2DViewState;
  readonly viewport: Readonly<{ width: number; height: number }>;
  readonly pointScreen?: Canvas2DPointFieldRange;
  readonly edgeStroke?: string;
  readonly edgeWidth?: number;
};

export type Canvas2DPointFieldStats = {
  readonly drawnPoints: number;
  readonly drawnEdges: number;
};

const DEFAULT_WORLD_RADIUS = 8;
const DEFAULT_SCREEN = { min: 4, max: 14 } as const;
const CULL_PAD = 16;

/**
 * Draws a packed 2D point field in screen pixels. Size is clamped so far
 * zoom cannot shrink a point below `pointScreen.min`. This is a throughput
 * primitive — hosts own colour language, glow, and labels.
 */
export function renderCanvas2DPointField(
  context: CanvasRenderingContext2D,
  input: Canvas2DPointFieldInput
): Canvas2DPointFieldStats {
  const range = input.pointScreen ?? DEFAULT_SCREEN;
  const { offset, zoom } = input.view;
  const pad = CULL_PAD + range.max;
  const minX = -pad;
  const minY = -pad;
  const maxX = input.viewport.width + pad;
  const maxY = input.viewport.height + pad;
  const points = input.points;
  let drawnEdges = 0;
  let drawnPoints = 0;

  const edges = input.edges;
  if (edges !== undefined && edges.length > 0) {
    context.beginPath();
    context.strokeStyle = input.edgeStroke ?? "rgba(148, 163, 184, 0.2)";
    context.lineWidth = input.edgeWidth ?? 1;
    for (const edge of edges) {
      const source = points[edge.source];
      const target = points[edge.target];
      if (source === undefined || target === undefined) {
        continue;
      }
      const ax = source.x * zoom + offset[0];
      const ay = source.y * zoom + offset[1];
      const bx = target.x * zoom + offset[0];
      const by = target.y * zoom + offset[1];
      if (
        (ax < minX && bx < minX) ||
        (ay < minY && by < minY) ||
        (ax > maxX && bx > maxX) ||
        (ay > maxY && by > maxY)
      ) {
        continue;
      }
      context.moveTo(ax, ay);
      context.lineTo(bx, by);
      drawnEdges += 1;
    }
    context.stroke();
  }

  for (const point of points) {
    const x = point.x * zoom + offset[0];
    const y = point.y * zoom + offset[1];
    if (x < minX || y < minY || x > maxX || y > maxY) {
      continue;
    }
    const worldRadius = point.radius ?? DEFAULT_WORLD_RADIUS;
    const screenRadius =
      canvasScreenPointRadius(worldRadius, zoom, range) * zoom;
    context.beginPath();
    context.fillStyle = point.fill;
    context.arc(x, y, screenRadius, 0, Math.PI * 2);
    context.fill();
    drawnPoints += 1;
  }

  return { drawnPoints, drawnEdges };
}

export function canvasScreenPointSize(
  worldRadius: number,
  zoom: number,
  range: Canvas2DPointFieldRange = DEFAULT_SCREEN
): number {
  return canvasScreenPointRadius(worldRadius, zoom, range) * zoom;
}
