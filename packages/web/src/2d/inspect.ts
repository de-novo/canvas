import type { Canvas2DNode, JsonValue } from "@de-novo/canvas-core";
import type { Canvas2DRectBounds, Canvas2DViewportSize, Canvas2DViewState } from "../view2d";
import type { CanvasRenderStats } from "../types";
import type { Canvas2DSpatialIndexStats } from "./spatial-index";
import { createCanvas2DSceneGraph, isNodeEffectivelyLocked, isNodeEffectivelyVisible } from "./scene-graph";
import { rectsIntersect, resolveCanvas2DNodeWorldBounds } from "./geometry";
import type { Canvas2DRuntime } from "../2d";

export type Canvas2DInspectableRuntime =
  | Canvas2DRuntime
  | { readonly current: Canvas2DRuntime };

export type InspectCanvas2DOptions = {
  readonly layerId?: string;
  readonly onlyVisible?: boolean;
  readonly onlyInViewport?: boolean;
  readonly includeMetadata?: boolean;
};

export type Canvas2DInspectedLayer = {
  readonly id: string;
  readonly name: string;
  readonly visible: boolean;
  readonly locked: boolean;
};

export type Canvas2DInspectedNode = {
  readonly id: string;
  readonly type: Canvas2DNode["type"];
  readonly layerId: string;
  readonly parentId: string | null;
  readonly visible: boolean;
  readonly locked: boolean;
  readonly inViewport: boolean;
  readonly worldBounds: Canvas2DRectBounds;
  readonly screenBounds: Canvas2DRectBounds;
  readonly screenCenter: readonly [number, number];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
};

export type Canvas2DRuntimeSnapshot = {
  readonly sceneId: string;
  readonly mode: "2d";
  readonly backend: "canvas2d" | "webgpu";
  readonly viewport: Canvas2DViewportSize;
  readonly viewState: Canvas2DViewState;
  readonly visibleBounds: Canvas2DRectBounds;
  readonly renderStats: CanvasRenderStats | undefined;
  readonly spatialIndex: Canvas2DSpatialIndexStats;
  readonly nodeCount: number;
  readonly visibleNodeCount: number;
  readonly layers: readonly Canvas2DInspectedLayer[];
  readonly nodes: readonly Canvas2DInspectedNode[];
};

export type CanvasPixelDataLike = {
  readonly data: ArrayLike<number>;
  readonly width: number;
  readonly height: number;
};

export type CanvasPixelSummary = {
  readonly width: number;
  readonly height: number;
  readonly sampledPixels: number;
  readonly uniqueColors: number;
  readonly nonBlank: boolean;
  readonly averageRgba: readonly [number, number, number, number];
};

export type CaptureCanvas2DSnapshotOptions = InspectCanvas2DOptions & {
  /** Whether to encode `readPixels()` into a `data:image/png;base64,...` URL. Defaults to `true`. */
  readonly includePngDataUrl?: boolean;
  /** Optional pixel sampling stride for `summarizeCanvasImageData`. */
  readonly sampleStride?: number;
};

export type Canvas2DCapturedSnapshot = {
  readonly inspection: Canvas2DRuntimeSnapshot;
  readonly pixels: CanvasPixelSummary;
  readonly pngDataUrl: string | null;
};

function unwrapCanvas2DRuntime(target: Canvas2DInspectableRuntime): Canvas2DRuntime {
  return "current" in target ? target.current : target;
}

/**
 * Pure pixel-buffer summary helper (works in Node and browsers without DOM).
 * Reports sampled unique RGB colors, average RGBA, and whether the frame is
 * non-blank (`uniqueColors >= 2`).
 */
export function summarizeCanvasImageData(
  image: CanvasPixelDataLike,
  sampleStride?: number
): CanvasPixelSummary {
  const width = Math.max(0, Math.floor(image.width));
  const height = Math.max(0, Math.floor(image.height));
  const totalPixels = width * height;
  if (totalPixels === 0) {
    return {
      width,
      height,
      sampledPixels: 0,
      uniqueColors: 0,
      nonBlank: false,
      averageRgba: [0, 0, 0, 0]
    };
  }

  const stride =
    sampleStride !== undefined && Number.isFinite(sampleStride) && sampleStride >= 1
      ? Math.floor(sampleStride)
      : Math.max(1, Math.floor(totalPixels / 4096));
  const seen = new Set<number>();
  let sampled = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumA = 0;

  for (let pixel = 0; pixel < totalPixels; pixel += stride) {
    const offset = pixel * 4;
    const r = image.data[offset] ?? 0;
    const g = image.data[offset + 1] ?? 0;
    const b = image.data[offset + 2] ?? 0;
    const a = image.data[offset + 3] ?? 0;
    seen.add((r << 16) | (g << 8) | b);
    sumR += r;
    sumG += g;
    sumB += b;
    sumA += a;
    sampled += 1;
  }

  return {
    width,
    height,
    sampledPixels: sampled,
    uniqueColors: seen.size,
    nonBlank: seen.size >= 2,
    averageRgba:
      sampled > 0
        ? [
            Math.round(sumR / sampled),
            Math.round(sumG / sampled),
            Math.round(sumB / sampled),
            Math.round(sumA / sampled)
          ]
        : [0, 0, 0, 0]
  };
}

/**
 * Produces a deterministic, JSON-serializable inspection snapshot of a live 2D
 * canvas runtime: backend, viewport, view state, render/spatial-index stats,
 * effective layer/node visibility and locks, world bounds, and exact canvas
 * CSS-pixel screen bounds & centers for automated verification or AI agents.
 */
export function inspectCanvas2DRuntime(
  target: Canvas2DInspectableRuntime,
  options: InspectCanvas2DOptions = {}
): Canvas2DRuntimeSnapshot {
  const runtime = unwrapCanvas2DRuntime(target);
  const scene = runtime.getScene();
  const sceneGraph = createCanvas2DSceneGraph(scene);
  const viewport = runtime.getViewportSize();
  const viewState = runtime.viewState;
  const visibleBounds = runtime.getVisibleBounds();
  const renderStats = runtime.getRenderStats();
  const spatialIndex = runtime.getSpatialIndexStats();

  const layers: Canvas2DInspectedLayer[] = scene.layers.map((layer) => ({
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    locked: layer.locked
  }));

  const nodes: Canvas2DInspectedNode[] = [];
  let visibleNodeCount = 0;

  for (let i = 0; i < scene.nodes.length; i += 1) {
    const node = scene.nodes[i]!;
    if (options.layerId !== undefined && node.layerId !== options.layerId) {
      continue;
    }

    const visible = isNodeEffectivelyVisible(scene, sceneGraph, node);
    const locked = isNodeEffectivelyLocked(scene, sceneGraph, node);
    const worldBounds = resolveCanvas2DNodeWorldBounds(node, sceneGraph);
    const inViewport = visible && rectsIntersect(worldBounds, visibleBounds);

    if (visible) {
      visibleNodeCount += 1;
    }
    if (options.onlyVisible && !visible) {
      continue;
    }
    if (options.onlyInViewport && !inViewport) {
      continue;
    }

    const topLeft = runtime.sceneToCanvas([worldBounds.minX, worldBounds.minY]);
    const bottomRight = runtime.sceneToCanvas([worldBounds.maxX, worldBounds.maxY]);
    const screenBounds: Canvas2DRectBounds = {
      minX: Math.min(topLeft[0], bottomRight[0]),
      minY: Math.min(topLeft[1], bottomRight[1]),
      maxX: Math.max(topLeft[0], bottomRight[0]),
      maxY: Math.max(topLeft[1], bottomRight[1])
    };
    const screenCenter: readonly [number, number] = [
      (screenBounds.minX + screenBounds.maxX) * 0.5,
      (screenBounds.minY + screenBounds.maxY) * 0.5
    ];

    nodes.push({
      id: node.id,
      type: node.type,
      layerId: node.layerId,
      parentId: node.parentId,
      visible,
      locked,
      inViewport,
      worldBounds,
      screenBounds,
      screenCenter,
      ...(options.includeMetadata ? { metadata: node.metadata } : {})
    });
  }

  return {
    sceneId: scene.id,
    mode: "2d",
    backend: runtime.gpuBackend === "webgpu" ? "webgpu" : "canvas2d",
    viewport,
    viewState: {
      offset: [viewState.offset[0], viewState.offset[1]],
      zoom: viewState.zoom
    },
    visibleBounds,
    renderStats,
    spatialIndex,
    nodeCount: scene.nodes.length,
    visibleNodeCount,
    layers,
    nodes
  };
}

function encodeImageDataToPngDataUrl(image: ImageData): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Captures both a structured {@link Canvas2DRuntimeSnapshot} and a pixel-verified
 * framebuffer readback (`CanvasPixelSummary` + optional PNG data URL) across
 * both Canvas2D and 2D WebGPU runtimes (including headless WebGPU where direct
 * `canvas.toDataURL()` returns blank).
 */
export async function captureCanvas2DSnapshot(
  target: Canvas2DInspectableRuntime,
  options: CaptureCanvas2DSnapshotOptions = {}
): Promise<Canvas2DCapturedSnapshot> {
  const runtime = unwrapCanvas2DRuntime(target);
  const inspection = inspectCanvas2DRuntime(runtime, options);
  const image = await runtime.readPixels();
  const pixels = summarizeCanvasImageData(image, options.sampleStride);
  const pngDataUrl =
    options.includePngDataUrl === false
      ? null
      : encodeImageDataToPngDataUrl(image);

  return {
    inspection,
    pixels,
    pngDataUrl
  };
}
