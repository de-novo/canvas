/**
 * Explicit 2D WebGPU presenter. The display canvas gets a GPU context;
 * Canvas2D is used only on a hidden measure canvas for text metrics and
 * glyph rasterization. Auto 2D stays on the Canvas2D runtime.
 */
import {
  CANVAS_NODE_PORT_SIDES,
  denovoShadeStripColor,
  denovoShadeStripCount,
  denovoSparklinePoints,
  isCanvas2DPluginNode,
  isDenovoImageNode,
  isDenovoShadeNode,
  isDenovoSparklineNode,
  resolveDenovoImageDrawRect,
  resolveDenovoImageStyle,
  type Canvas2DClipRect,
  type Canvas2DGrid,
  type Canvas2DNode,
  type Canvas2DPluginNode,
  type Canvas2DScene,
  type CanvasAuthoringPreviewForMode,
  type CanvasNodeTransformHandleTarget,
  type CanvasNodeTransformPreview
} from "@de-novo/canvas-core";
import type { Canvas2DImageCache } from "./image-cache";

import {
  getCanvas2DVisibleBounds,
  sceneToCanvasPoint,
  type Canvas2DRectBounds,
  type Canvas2DViewState
} from "../view2d";
import type { Canvas2DSnapGuide } from "./snap";
import {
  DEFAULT_BOX_MODEL_COLORS,
  DEFAULT_REDLINE_COLOR,
  formatCanvas2DRedlineDistance,
  resolveCanvas2DBoxModelRegions,
  type Canvas2DInspectionOverlay
} from "./inspection";
import {
  resolveLiveParentWorldTransform,
  type Canvas2DSpatialIndex
} from "./spatial-index";
import type { CanvasRenderStats } from "../types";
import {
  getPluginNodeDrawerRegistryVersion,
  PLUGIN_NODE_MARKER_FILL,
  resolveHostPluginNodeDraw2d
} from "../plugin-drawers";
import {
  CANVAS_2D_ANCHOR_RADIUS,
  CANVAS_2D_ANNOTATION_FONT,
  CANVAS_2D_ANNOTATION_TEXT_OFFSET,
  CANVAS_2D_CONNECTION_HANDLE_RADIUS,
  CANVAS_2D_MEASUREMENT_FONT,
  CANVAS_2D_MEASUREMENT_LABEL_OFFSET
} from "./constants";
import {
  getCanvas2DMidpoint,
  hasNonZeroCornerRadius,
  isCanvas2DConnectableNode,
  resolveCanvas2DConnectionHandlePoint,
  resolveCanvas2DEdgeGeometry,
  resolveCanvas2DNodeWorldBounds,
  resolveCanvas2DNodeWorldCenter,
  resolveCanvas2DPluginNodeLocalSize,
  resolveClampedCornerRadii,
  resolveNodeRenderTransform,
  resolvePreviewParentWorldTransform,
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
  resolveCanvas2DGridRenderRange,
  traceCanvas2DRoundedRectPath
} from "./render";
import {
  getCanvas2DAncestors,
  getCanvas2DGroupChildren,
  getCanvas2DLayerRoots,
  isNodeEffectivelyLocked,
  isNodeEffectivelyVisible,
  type Canvas2DAnnotationNode,
  type Canvas2DDrawableNode,
  type Canvas2DMeasurementNode,
  type Canvas2DSceneGraph,
  type Canvas2DShapeNode
} from "./scene-graph";
import {
  measureCanvas2DText,
  resolveCanvas2DMeasurementLabel,
  wrapCanvas2DText
} from "./text";
import type { Canvas2DContentColors, Canvas2DTransformHandleColors } from "./render";

const FLOATS_PER_VERTEX = 32;
const SHAPE_RECT = 0;
const SHAPE_CIRCLE = 1;
const SHAPE_ROUNDED_RECT = 2;
const ATLAS_SIZE = 2048;
const MAX_ATLAS_PAGES = 8;
const MIN_IMAGE_ATLAS_STAMP_DIM = 24;
const MAX_IMAGE_ATLAS_STAMP_DIM = 512;
const MAX_IMAGE_ATLAS_ZOOMED_IN_DIM = 1024;
const CANVAS_2D_WEBGPU_INSPECTION_FONT =
  "600 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
const TRANSPARENT_GPU_COLOR: GpuColor = [0, 0, 0, 0];
const ZERO_VEC4: readonly [number, number, number, number] = [0, 0, 0, 0];
const GPU_BUFFER_USAGE_MAP_READ = 0x0001;
const GPU_BUFFER_USAGE_VERTEX = 0x0020;
const GPU_BUFFER_USAGE_UNIFORM = 0x0040;
const GPU_BUFFER_USAGE_COPY_DST = 0x0008;
const GPU_TEXTURE_USAGE_COPY_SRC = 0x01;
const GPU_TEXTURE_USAGE_COPY_DST = 0x02;
const GPU_TEXTURE_USAGE_TEXTURE_BINDING = 0x04;
const GPU_TEXTURE_USAGE_RENDER_ATTACHMENT = 0x10;
const GPU_MAP_READ = 0x0001;
const GPU_SHADER_STAGE_VERTEX = 0x1;
const GPU_SHADER_STAGE_FRAGMENT = 0x2;

type GpuCanvasContext = {
  configure(descriptor: {
    alphaMode: "opaque" | "premultiplied";
    device: GPUDevice;
    format: GPUTextureFormat;
    usage: number;
  }): void;
  getCurrentTexture(): GPUTexture;
};

function requireGpuCanvasContext(canvas: HTMLCanvasElement): GpuCanvasContext {
  const context = canvas.getContext("webgpu") as GpuCanvasContext | null;
  if (!context) {
    throw new Error("Canvas backend webgpu is unavailable in the current environment.");
  }
  return context;
}

const COLOR_SHADER = /* wgsl */ `
struct View {
  offset: vec2f,
  zoom: f32,
  _pad0: f32,
  viewport: vec2f,
  _pad1: vec2f,
}

@group(0) @binding(0) var<uniform> view: View;
@group(0) @binding(1) var textSampler: sampler;
@group(0) @binding(2) var textAtlas: texture_2d_array<f32>;

struct VSIn {
  @location(0) position: vec2f,
  @location(1) uv: vec2f,
  @location(2) color: vec4f,
  @location(3) extra: vec4f,
  @location(4) strokeColor: vec4f,
  @location(5) sizeClipPos: vec4f,
  @location(6) radii: vec4f,
  @location(7) clipBox: vec4f,
  @location(8) clipRadii: vec4f,
}

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
  @location(2) extra: vec4f,
  @location(3) strokeColor: vec4f,
  @location(4) sizeClipPos: vec4f,
  @location(5) radii: vec4f,
  @location(6) clipBox: vec4f,
  @location(7) clipRadii: vec4f,
}

fn sdRoundedBox(p: vec2f, b: vec2f, r: vec4f) -> f32 {
  let rx = select(r.zw, r.xy, p.x > 0.0);
  let radius = select(rx.x, rx.y, p.y > 0.0);
  let q = abs(p) - b + vec2f(radius, radius);
  return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0, 0.0))) - radius;
}

@vertex
fn vs(input: VSIn) -> VSOut {
  var screen = input.position;
  if (input.extra.z < 0.5) {
    screen = input.position * view.zoom + view.offset;
  }
  var out: VSOut;
  out.position = vec4f(
    (screen.x / view.viewport.x) * 2.0 - 1.0,
    1.0 - (screen.y / view.viewport.y) * 2.0,
    0.0,
    1.0
  );
  out.uv = input.uv;
  out.color = input.color;
  out.extra = input.extra;
  out.strokeColor = input.strokeColor;
  out.sizeClipPos = input.sizeClipPos;
  out.radii = input.radii;
  out.clipBox = input.clipBox;
  out.clipRadii = input.clipRadii;
  return out;
}

@fragment
fn fs(input: VSOut) -> @location(0) vec4f {
  let atlasLayer = max(i32(round(input.extra.y)) - 1, 0);
  let texel = textureSample(textAtlas, textSampler, input.uv, atlasLayer);
  let localSize = max(input.sizeClipPos.xy, vec2f(1e-4, 1e-4));
  let p = (input.uv - vec2f(0.5, 0.5)) * localSize;
  let dRect = sdRoundedBox(p, localSize * 0.5, input.radii);
  let aaRect = max(fwidth(dRect), 1e-4);
  let dCircle = length(p) - localSize.x * 0.5;
  let aaCircle = max(fwidth(dCircle), 1e-4);
  let dClip = sdRoundedBox(input.sizeClipPos.zw - input.clipBox.xy, input.clipBox.zw, input.clipRadii);
  let aaClip = max(fwidth(dClip), 1e-4);

  var clipMask = 1.0;
  if (input.clipBox.z > 0.0) {
    clipMask = clamp(0.5 - dClip / aaClip, 0.0, 1.0);
    if (clipMask <= 0.001) {
      discard;
    }
  }

  var color = input.color;
  if (input.extra.y > 0.5) {
    color = vec4f(texel.rgb * input.color.rgb, input.color.a * texel.a * clipMask);
    if (color.a < 0.04) {
      discard;
    }
    return color;
  }

  let shape = input.extra.x;
  let strokeWidth = input.extra.w;
  if (shape > 0.5) {
    let isRoundedRect = shape > 1.5;
    let d = select(dCircle, dRect, isRoundedRect);
    let aa = select(aaCircle, aaRect, isRoundedRect);
    let fillAlpha = clamp(0.5 - d / aa, 0.0, 1.0) * input.color.a;

    if (strokeWidth > 0.0 && input.strokeColor.a > 0.0) {
      let halfStroke = strokeWidth * 0.5;
      let strokeDist = abs(d) - halfStroke;
      let strokeAlpha = clamp(0.5 - strokeDist / aa, 0.0, 1.0) * input.strokeColor.a;
      let outAlpha = strokeAlpha + fillAlpha * (1.0 - strokeAlpha);
      if (outAlpha <= 0.001) {
        discard;
      }
      let outRgb = (input.strokeColor.rgb * strokeAlpha + input.color.rgb * fillAlpha * (1.0 - strokeAlpha)) / outAlpha;
      return vec4f(outRgb, outAlpha * clipMask);
    }

    if (fillAlpha <= 0.001) {
      discard;
    }
    return vec4f(input.color.rgb, fillAlpha * clipMask);
  }

  return vec4f(color.rgb, color.a * clipMask);
}
`;

export type Canvas2DWebGpuFrame = {
  readonly authoringPreviews: readonly CanvasAuthoringPreviewForMode<"2d">[];
  readonly connectionHandlesVisible: boolean;
  readonly contentColors: Canvas2DContentColors;
  readonly hoveredId: string | null;
  readonly imageCache?: Canvas2DImageCache;
  readonly inspectionOverlay: Canvas2DInspectionOverlay | null;
  readonly measureContext: CanvasRenderingContext2D;
  readonly resizeState: {
    readonly height: number;
    readonly width: number;
  };
  readonly scene: Canvas2DScene;
  readonly sceneGraph: Canvas2DSceneGraph;
  readonly selectedIds: ReadonlySet<string>;
  readonly snapGuides: readonly Canvas2DSnapGuide[];
  readonly spatialIndex?: Canvas2DSpatialIndex;
  readonly transformHandleColors: Canvas2DTransformHandleColors;
  readonly transformHandlePosition: readonly [number, number] | null;
  readonly transformHandleTarget: CanvasNodeTransformHandleTarget | null;
  readonly transformPreview: CanvasNodeTransformPreview | null;
  readonly viewState: Canvas2DViewState;
};

export type Canvas2DWebGpuPresenter = {
  destroy(): void;
  getRenderStats(): CanvasRenderStats;
  readPixels(): Promise<ImageData>;
  render(frame: Canvas2DWebGpuFrame): void;
  resize(pixelWidth: number, pixelHeight: number): void;
};

type GpuColor = readonly [number, number, number, number];

export async function createCanvas2DWebGpuPresenter(
  canvas: HTMLCanvasElement
): Promise<Canvas2DWebGpuPresenter> {
  const gpu = navigator.gpu;
  if (!gpu) {
    throw new Error("Canvas backend webgpu is unavailable in the current environment.");
  }

  const adapter = await gpu.requestAdapter();
  if (!adapter) {
    throw new Error("Canvas backend webgpu is unavailable in the current environment.");
  }

  const device = await adapter.requestDevice();
  const format = gpu.getPreferredCanvasFormat();
  let context: GpuCanvasContext;
  try {
    context = requireGpuCanvasContext(canvas);
  } catch (error) {
    device.destroy();
    throw error;
  }

  context.configure({
    alphaMode: "opaque",
    device,
    format,
    usage: GPU_TEXTURE_USAGE_RENDER_ATTACHMENT | GPU_TEXTURE_USAGE_COPY_SRC
  });

  const shader = device.createShaderModule({ code: COLOR_SHADER });
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPU_SHADER_STAGE_VERTEX,
        buffer: { type: "uniform" }
      },
      {
        binding: 1,
        visibility: GPU_SHADER_STAGE_FRAGMENT,
        sampler: { type: "filtering" }
      },
      {
        binding: 2,
        visibility: GPU_SHADER_STAGE_FRAGMENT,
        texture: { sampleType: "float", viewDimension: "2d-array" }
      }
    ]
  });
  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertex: {
      module: shader,
      entryPoint: "vs",
      buffers: [
        {
          arrayStride: FLOATS_PER_VERTEX * 4,
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x2" },
            { shaderLocation: 1, offset: 8, format: "float32x2" },
            { shaderLocation: 2, offset: 16, format: "float32x4" },
            { shaderLocation: 3, offset: 32, format: "float32x4" },
            { shaderLocation: 4, offset: 48, format: "float32x4" },
            { shaderLocation: 5, offset: 64, format: "float32x4" },
            { shaderLocation: 6, offset: 80, format: "float32x4" },
            { shaderLocation: 7, offset: 96, format: "float32x4" },
            { shaderLocation: 8, offset: 112, format: "float32x4" }
          ]
        }
      ]
    },
    fragment: {
      module: shader,
      entryPoint: "fs",
      targets: [
        {
          format,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            }
          }
        }
      ]
    },
    primitive: { topology: "triangle-list" }
  });

  const uniformBuffer = device.createBuffer({
    size: 32,
    usage: GPU_BUFFER_USAGE_UNIFORM | GPU_BUFFER_USAGE_COPY_DST
  });
  const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });
  const whiteTexture = device.createTexture({
    format: "rgba8unorm",
    size: { width: 1, height: 1, depthOrArrayLayers: 1 },
    usage: GPU_TEXTURE_USAGE_TEXTURE_BINDING | GPU_TEXTURE_USAGE_COPY_DST
  });
  device.queue.writeTexture(
    { texture: whiteTexture, origin: { x: 0, y: 0, z: 0 } },
    new Uint8Array([255, 255, 255, 255]),
    { bytesPerRow: 4, rowsPerImage: 1 },
    { width: 1, height: 1, depthOrArrayLayers: 1 }
  );

  const FULL_SCENE_CACHE_THRESHOLD = 512;

  function makeBindGroup(texture: GPUTexture): GPUBindGroup {
    return device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: sampler },
        { binding: 2, resource: texture.createView({ dimension: "2d-array" }) }
      ]
    });
  }

  let atlasTexture = whiteTexture;
  let atlasPageCount = 0;
  let bindGroup = makeBindGroup(whiteTexture);
  let vertexBuffer: GPUBuffer | null = null;
  let vertexCapacity = 0;
  let cachedVertexCount = 0;
  let drawCalls = 0;
  let triangles = 0;
  let destroyed = false;
  let lastFrame: Canvas2DWebGpuFrame | null = null;
  let cachedClearCss: string | null = null;
  let cachedClearRgba: GpuColor = [0, 0, 0, 1];
  const uniforms = new Float32Array(8);
  let geometryCache: {
    readonly contentColors: Canvas2DContentColors;
    readonly coveredBounds: Canvas2DRectBounds | null;
    readonly coversFullScene: boolean;
    readonly drawerRegistryVersion: number;
    readonly hasAnimatedShade: boolean;
    readonly hasImages: boolean;
    readonly hoveredId: string | null;
    readonly imageCacheVersion: number;
    readonly imageLodScale: number;
    readonly scene: Canvas2DScene;
    readonly sceneGraph: Canvas2DSceneGraph;
    readonly selectedIds: ReadonlySet<string>;
    readonly transformPreview: CanvasNodeTransformPreview | null;
    readonly viewIndependent: boolean;
  } | null = null;
  let pendingReadback: {
    buffer: GPUBuffer;
    bytesPerRow: number;
    height: number;
    width: number;
  } | null = null;

  function destroy() {
    if (destroyed) {
      return;
    }
    destroyed = true;
    vertexBuffer?.destroy();
    if (atlasTexture !== whiteTexture) {
      atlasTexture.destroy();
    }
    whiteTexture.destroy();
    uniformBuffer.destroy();
    device.destroy();
  }

  function resize(pixelWidth: number, pixelHeight: number) {
    void pixelWidth;
    void pixelHeight;
  }

  function boundsContains(
    outer: Canvas2DRectBounds,
    inner: Canvas2DRectBounds
  ): boolean {
    return (
      outer.minX <= inner.minX &&
      outer.minY <= inner.minY &&
      outer.maxX >= inner.maxX &&
      outer.maxY >= inner.maxY
    );
  }

  function padBoundsForPanCache(bounds: Canvas2DRectBounds): Canvas2DRectBounds {
    const padX = Math.max(128, (bounds.maxX - bounds.minX) * 0.5);
    const padY = Math.max(128, (bounds.maxY - bounds.minY) * 0.5);
    return {
      minX: bounds.minX - padX,
      minY: bounds.minY - padY,
      maxX: bounds.maxX + padX,
      maxY: bounds.maxY + padY
    };
  }

  function render(frame: Canvas2DWebGpuFrame) {
    if (destroyed) {
      return;
    }

    const width = Math.max(1, frame.resizeState.width);
    const height = Math.max(1, frame.resizeState.height);
    const visibleBounds = getCanvas2DVisibleBounds(frame.viewState, {
      width,
      height
    });
    const drawerRegistryVersion = getPluginNodeDrawerRegistryVersion();
    const imageCacheVersion = frame.imageCache?.getVersion() ?? 0;
    const imageLodScale = resolveImageLodScale(frame.viewState.zoom);
    const hasSnapGuides = frame.snapGuides.length > 0;
    const hasInspectionOverlay =
      frame.inspectionOverlay !== null &&
      ((frame.inspectionOverlay.boxModels?.length ?? 0) > 0 ||
        (frame.inspectionOverlay.redlines?.length ?? 0) > 0);
    const viewIndependent =
      frame.authoringPreviews.length === 0 &&
      !frame.connectionHandlesVisible &&
      !hasSnapGuides &&
      !hasInspectionOverlay &&
      !(frame.transformHandleTarget !== null && frame.transformHandlePosition !== null);

    const canReuseGeometry =
      geometryCache !== null &&
      viewIndependent &&
      geometryCache.viewIndependent &&
      !geometryCache.hasAnimatedShade &&
      (!geometryCache.hasImages || geometryCache.imageLodScale === imageLodScale) &&
      geometryCache.scene === frame.scene &&
      geometryCache.sceneGraph === frame.sceneGraph &&
      geometryCache.selectedIds === frame.selectedIds &&
      geometryCache.hoveredId === frame.hoveredId &&
      geometryCache.transformPreview === frame.transformPreview &&
      geometryCache.contentColors === frame.contentColors &&
      geometryCache.drawerRegistryVersion === drawerRegistryVersion &&
      geometryCache.imageCacheVersion === imageCacheVersion &&
      (geometryCache.coversFullScene ||
        (geometryCache.coveredBounds !== null &&
          boundsContains(geometryCache.coveredBounds, visibleBounds)));

    if (!canReuseGeometry) {
      const useSpatialCulling =
        frame.spatialIndex !== undefined &&
        frame.spatialIndex.entries.length > FULL_SCENE_CACHE_THRESHOLD;
      const cullBounds = useSpatialCulling
        ? padBoundsForPanCache(visibleBounds)
        : null;

      const batch = new VertexBatch(frame.measureContext);
      const { hasAnimatedShade, hasImages } = recordFrame(
        batch,
        frame,
        cullBounds,
        imageLodScale
      );
      const packed = batch.pack();
      cachedVertexCount = packed.vertexCount;
      triangles = cachedVertexCount / 3;
      drawCalls = cachedVertexCount === 0 ? 0 : 1;

      if (cachedVertexCount > 0) {
        const byteLength = packed.vertices.byteLength;
        if (!vertexBuffer || vertexCapacity < byteLength) {
          vertexBuffer?.destroy();
          vertexCapacity = Math.max(byteLength, 4096);
          vertexBuffer = device.createBuffer({
            size: vertexCapacity,
            usage: GPU_BUFFER_USAGE_VERTEX | GPU_BUFFER_USAGE_COPY_DST
          });
        }
        device.queue.writeBuffer(vertexBuffer, 0, packed.vertices);
      }

      let atlasChanged = false;
      if (atlasTexture !== whiteTexture) {
        atlasTexture.destroy();
        atlasTexture = whiteTexture;
        atlasPageCount = 0;
        atlasChanged = true;
      }
      if (packed.atlas && packed.atlas.pages.length > 0) {
        const layerCount = packed.atlas.pages.length;
        atlasTexture = device.createTexture({
          format: "rgba8unorm",
          size: {
            width: packed.atlas.width,
            height: packed.atlas.height,
            depthOrArrayLayers: layerCount
          },
          usage: GPU_TEXTURE_USAGE_TEXTURE_BINDING | GPU_TEXTURE_USAGE_COPY_DST
        });
        for (let layer = 0; layer < layerCount; layer += 1) {
          device.queue.writeTexture(
            { texture: atlasTexture, origin: { x: 0, y: 0, z: layer } },
            packed.atlas.pages[layer]!,
            {
              bytesPerRow: packed.atlas.width * 4,
              rowsPerImage: packed.atlas.height
            },
            {
              width: packed.atlas.width,
              height: packed.atlas.height,
              depthOrArrayLayers: 1
            }
          );
        }
        atlasPageCount = layerCount;
        atlasChanged = true;
      }
      if (atlasChanged) {
        bindGroup = makeBindGroup(atlasTexture);
      }

      geometryCache = {
        contentColors: frame.contentColors,
        coveredBounds: cullBounds,
        coversFullScene: !useSpatialCulling,
        drawerRegistryVersion,
        hasAnimatedShade,
        hasImages,
        hoveredId: frame.hoveredId,
        imageCacheVersion,
        imageLodScale,
        scene: frame.scene,
        sceneGraph: frame.sceneGraph,
        selectedIds: frame.selectedIds,
        transformPreview: frame.transformPreview,
        viewIndependent
      };
    }

    uniforms[0] = frame.viewState.offset[0];
    uniforms[1] = frame.viewState.offset[1];
    uniforms[2] = frame.viewState.zoom;
    uniforms[3] = 0;
    uniforms[4] = width;
    uniforms[5] = height;
    uniforms[6] = 0;
    uniforms[7] = 0;
    device.queue.writeBuffer(uniformBuffer, 0, uniforms);

    if (cachedClearCss !== frame.scene.background) {
      cachedClearCss = frame.scene.background;
      cachedClearRgba = cssToRgba(frame.measureContext, frame.scene.background);
    }
    const clear = cachedClearRgba;
    const encoder = device.createCommandEncoder();
    const colorTexture = context.getCurrentTexture();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: colorTexture.createView(),
          clearValue: { r: clear[0], g: clear[1], b: clear[2], a: 1 },
          loadOp: "clear",
          storeOp: "store"
        }
      ]
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    if (vertexBuffer && cachedVertexCount > 0) {
      pass.setVertexBuffer(0, vertexBuffer);
      pass.draw(cachedVertexCount);
    }
    pass.end();
    if (pendingReadback) {
      encoder.copyTextureToBuffer(
        { texture: colorTexture },
        {
          buffer: pendingReadback.buffer,
          bytesPerRow: pendingReadback.bytesPerRow
        },
        { width: pendingReadback.width, height: pendingReadback.height }
      );
    }
    device.queue.submit([encoder.finish()]);
    lastFrame = frame;
  }

  async function readPixels(): Promise<ImageData> {
    if (destroyed) {
      throw new Error("Canvas2D WebGPU presenter has been destroyed.");
    }
    if (!lastFrame) {
      throw new Error("Canvas2D WebGPU has not rendered yet.");
    }

    const width = Math.max(1, canvas.width);
    const height = Math.max(1, canvas.height);
    const bytesPerRow = Math.ceil((width * 4) / 256) * 256;
    const buffer = device.createBuffer({
      size: bytesPerRow * height,
      usage: GPU_BUFFER_USAGE_COPY_DST | GPU_BUFFER_USAGE_MAP_READ
    });
    pendingReadback = { buffer, bytesPerRow, height, width };
    let mapped = false;
    try {
      render(lastFrame);
      await buffer.mapAsync(GPU_MAP_READ);
      mapped = true;
      const src = new Uint8Array(buffer.getMappedRange());
      const image = new ImageData(width, height);
      image.data.set(canvasBytesToRgba(src, format, width, height, bytesPerRow));
      return image;
    } finally {
      pendingReadback = null;
      if (mapped) {
        buffer.unmap();
      }
      buffer.destroy();
    }
  }

  return {
    destroy,
    getRenderStats: () => ({ drawCalls, textures: atlasPageCount, triangles }),
    readPixels,
    render,
    resize
  };
}

function canvasBytesToRgba(
  src: Uint8Array,
  format: GPUTextureFormat,
  width: number,
  height: number,
  bytesPerRow: number
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  const bgra = format === "bgra8unorm" || format === "bgra8unorm-srgb";
  for (let row = 0; row < height; row += 1) {
    const sourceRow = row * bytesPerRow;
    for (let column = 0; column < width; column += 1) {
      const source = sourceRow + column * 4;
      const dest = (row * width + column) * 4;
      if (bgra) {
        data[dest] = src[source + 2] ?? 0;
        data[dest + 1] = src[source + 1] ?? 0;
        data[dest + 2] = src[source] ?? 0;
        data[dest + 3] = src[source + 3] ?? 0;
      } else {
        data[dest] = src[source] ?? 0;
        data[dest + 1] = src[source + 1] ?? 0;
        data[dest + 2] = src[source + 2] ?? 0;
        data[dest + 3] = src[source + 3] ?? 0;
      }
    }
  }
  return data;
}

type ActiveGpuClip = {
  readonly inverseMatrix: Canvas2DMatrix;
  readonly clipBox: readonly [number, number, number, number];
  readonly clipRadii: readonly [number, number, number, number];
};

function isAxisAlignedNonNegativeScale(matrix: Canvas2DMatrix): boolean {
  return matrix[1] === 0 && matrix[2] === 0 && matrix[0] > 0 && matrix[3] > 0;
}

function createGpuClipFromGroup(
  groupWorldTransform: Canvas2DMatrix,
  clip: Canvas2DClipRect
): ActiveGpuClip | null {
  const inverse = tryInvertCanvas2DMatrix(groupWorldTransform);
  if (!inverse) {
    return null;
  }
  const clamped = resolveClampedCornerRadii(
    clip.width,
    clip.height,
    clip.cornerRadius
  );
  return {
    inverseMatrix: inverse,
    clipBox: [
      clip.x + clip.width * 0.5,
      clip.y + clip.height * 0.5,
      clip.width * 0.5,
      clip.height * 0.5
    ],
    clipRadii: [clamped[1], clamped[2], clamped[0], clamped[3]]
  };
}

function composeGpuClips(
  outer: ActiveGpuClip | null,
  inner: ActiveGpuClip | null
): ActiveGpuClip | null {
  if (!outer) return inner;
  if (!inner) return outer;

  if (
    isAxisAlignedNonNegativeScale(outer.inverseMatrix) &&
    isAxisAlignedNonNegativeScale(inner.inverseMatrix)
  ) {
    const outerWorld = tryInvertCanvas2DMatrix(outer.inverseMatrix);
    const innerWorld = tryInvertCanvas2DMatrix(inner.inverseMatrix);
    if (outerWorld && innerWorld) {
      const oMin = transformCanvas2DPoint(outerWorld, [
        outer.clipBox[0] - outer.clipBox[2],
        outer.clipBox[1] - outer.clipBox[3]
      ]);
      const oMax = transformCanvas2DPoint(outerWorld, [
        outer.clipBox[0] + outer.clipBox[2],
        outer.clipBox[1] + outer.clipBox[3]
      ]);
      const iMin = transformCanvas2DPoint(innerWorld, [
        inner.clipBox[0] - inner.clipBox[2],
        inner.clipBox[1] - inner.clipBox[3]
      ]);
      const iMax = transformCanvas2DPoint(innerWorld, [
        inner.clipBox[0] + inner.clipBox[2],
        inner.clipBox[1] + inner.clipBox[3]
      ]);
      const minX = Math.max(oMin[0], iMin[0]);
      const minY = Math.max(oMin[1], iMin[1]);
      const maxX = Math.min(oMax[0], iMax[0]);
      const maxY = Math.min(oMax[1], iMax[1]);
      const halfW = Math.max(0, (maxX - minX) * 0.5);
      const halfH = Math.max(0, (maxY - minY) * 0.5);
      const sx = innerWorld[0];
      const sy = innerWorld[3];
      const scaleAvg = (sx + sy) * 0.5;
      return {
        inverseMatrix: CANVAS_2D_IDENTITY_MATRIX,
        clipBox: [
          minX + halfW,
          minY + halfH,
          Math.max(1e-4, halfW),
          Math.max(1e-4, halfH)
        ],
        clipRadii: [
          inner.clipRadii[0] * scaleAvg,
          inner.clipRadii[1] * scaleAvg,
          inner.clipRadii[2] * scaleAvg,
          inner.clipRadii[3] * scaleAvg
        ]
      };
    }
  }

  return inner;
}

class VertexBatch {
  private readonly floats: number[] = [];
  private readonly atlas = new TextAtlas();
  private activeClip: ActiveGpuClip | null = null;
  readonly measure: CanvasRenderingContext2D;

  constructor(measure: CanvasRenderingContext2D) {
    this.measure = measure;
  }

  get vertexCount() {
    return this.floats.length / FLOATS_PER_VERTEX;
  }

  setClip(clip: ActiveGpuClip | null) {
    this.activeClip = clip;
  }

  pack(): {
    readonly atlas: {
      readonly height: number;
      readonly pages: readonly Uint8Array[];
      readonly width: number;
    } | null;
    readonly vertexCount: number;
    readonly vertices: Float32Array;
  } {
    return {
      atlas: this.atlas.snapshot(),
      vertexCount: this.vertexCount,
      vertices: new Float32Array(this.floats)
    };
  }

  fillColor(css: string, alpha = 1): GpuColor {
    return cssToRgba(this.measure, css, alpha);
  }

  rect(
    matrix: Canvas2DMatrix,
    x: number,
    y: number,
    width: number,
    height: number,
    color: GpuColor,
    screenSpace = false
  ) {
    this.quad(
      transformCanvas2DPoint(matrix, [x, y]),
      transformCanvas2DPoint(matrix, [x + width, y]),
      transformCanvas2DPoint(matrix, [x, y + height]),
      transformCanvas2DPoint(matrix, [x + width, y + height]),
      color,
      SHAPE_RECT,
      false,
      screenSpace
    );
  }

  roundedRect(
    matrix: Canvas2DMatrix,
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: GpuColor,
    radii: readonly [number, number, number, number],
    strokeColor: GpuColor | null = null,
    strokeWidth = 0,
    screenSpace = false
  ) {
    const rx = width < 0 ? x + width : x;
    const ry = height < 0 ? y + height : y;
    const rw = Math.abs(width);
    const rh = Math.abs(height);
    if (rw <= 0 || rh <= 0) {
      return;
    }

    const hasStroke =
      strokeColor !== null && strokeWidth > 0 && strokeColor[3] > 0;
    const hasRadius = hasNonZeroCornerRadius(radii);
    if (!hasRadius && !hasStroke) {
      if (fillColor[3] > 0) {
        this.rect(matrix, rx, ry, rw, rh, fillColor, screenSpace);
      }
      return;
    }

    const pad = hasStroke ? strokeWidth * 0.5 + 1 : 0;
    const u0 = -pad / rw;
    const u1 = 1 + pad / rw;
    const v0 = -pad / rh;
    const v1 = 1 + pad / rh;
    const radiiShader: readonly [number, number, number, number] = [
      radii[1],
      radii[2],
      radii[0],
      radii[3]
    ];

    this.quad(
      transformCanvas2DPoint(matrix, [rx - pad, ry - pad]),
      transformCanvas2DPoint(matrix, [rx + rw + pad, ry - pad]),
      transformCanvas2DPoint(matrix, [rx - pad, ry + rh + pad]),
      transformCanvas2DPoint(matrix, [rx + rw + pad, ry + rh + pad]),
      fillColor,
      SHAPE_ROUNDED_RECT,
      false,
      screenSpace,
      { u0, v0, u1, v1 },
      strokeColor ?? TRANSPARENT_GPU_COLOR,
      hasStroke ? strokeWidth : 0,
      [rw, rh],
      radiiShader
    );
  }

  circle(
    matrix: Canvas2DMatrix,
    x: number,
    y: number,
    radius: number,
    color: GpuColor,
    screenSpace = false,
    strokeColor: GpuColor | null = null,
    strokeWidth = 0
  ) {
    const diameter = radius * 2;
    if (diameter <= 0) {
      return;
    }
    const hasStroke =
      strokeColor !== null && strokeWidth > 0 && strokeColor[3] > 0;
    const pad = hasStroke ? strokeWidth * 0.5 + 1 : 0;
    const extent = radius + pad;
    const u0 = -pad / diameter;
    const u1 = 1 + pad / diameter;
    const v0 = -pad / diameter;
    const v1 = 1 + pad / diameter;

    this.quad(
      transformCanvas2DPoint(matrix, [x - extent, y - extent]),
      transformCanvas2DPoint(matrix, [x + extent, y - extent]),
      transformCanvas2DPoint(matrix, [x - extent, y + extent]),
      transformCanvas2DPoint(matrix, [x + extent, y + extent]),
      color,
      SHAPE_CIRCLE,
      false,
      screenSpace,
      { u0, v0, u1, v1 },
      strokeColor ?? TRANSPARENT_GPU_COLOR,
      hasStroke ? strokeWidth : 0,
      [diameter, diameter],
      ZERO_VEC4
    );
  }

  line(
    start: readonly [number, number],
    end: readonly [number, number],
    width: number,
    color: GpuColor,
    screenSpace = false
  ) {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length = Math.hypot(dx, dy);
    if (length <= Number.EPSILON) {
      this.circle(CANVAS_2D_IDENTITY_MATRIX, start[0], start[1], width / 2, color, screenSpace);
      return;
    }
    const nx = (-dy / length) * (width / 2);
    const ny = (dx / length) * (width / 2);
    this.quad(
      [start[0] + nx, start[1] + ny],
      [end[0] + nx, end[1] + ny],
      [start[0] - nx, start[1] - ny],
      [end[0] - nx, end[1] - ny],
      color,
      SHAPE_RECT,
      false,
      screenSpace
    );
    this.circle(CANVAS_2D_IDENTITY_MATRIX, start[0], start[1], width / 2, color, screenSpace);
    this.circle(CANVAS_2D_IDENTITY_MATRIX, end[0], end[1], width / 2, color, screenSpace);
  }

  polyline(
    points: readonly (readonly [number, number])[],
    width: number,
    color: GpuColor,
    dash: readonly [number, number] | null = null
  ) {
    if (points.length < 2) {
      return;
    }
    if (!dash) {
      for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const current = points[index];
        if (previous && current) {
          this.line(previous, current, width, color);
        }
      }
      return;
    }
    this.dashedPolyline(points, width, color, dash[0], dash[1]);
  }

  triangle(
    a: readonly [number, number],
    b: readonly [number, number],
    c: readonly [number, number],
    color: GpuColor,
    screenSpace = false
  ) {
    this.vertex(a, [0, 0], color, SHAPE_RECT, false, screenSpace, TRANSPARENT_GPU_COLOR, 0, [1, 1], ZERO_VEC4);
    this.vertex(b, [1, 0], color, SHAPE_RECT, false, screenSpace, TRANSPARENT_GPU_COLOR, 0, [1, 1], ZERO_VEC4);
    this.vertex(c, [0, 1], color, SHAPE_RECT, false, screenSpace, TRANSPARENT_GPU_COLOR, 0, [1, 1], ZERO_VEC4);
  }

  raster(
    matrix: Canvas2DMatrix,
    x: number,
    y: number,
    width: number,
    height: number,
    paint: (context: CanvasRenderingContext2D) => void,
    alpha = 1,
    stampWidth = width,
    stampHeight = height
  ): boolean {
    const entry = this.atlas.stamp(stampWidth, stampHeight, paint);
    if (!entry) {
      return false;
    }
    this.quad(
      transformCanvas2DPoint(matrix, [x, y]),
      transformCanvas2DPoint(matrix, [x + width, y]),
      transformCanvas2DPoint(matrix, [x, y + height]),
      transformCanvas2DPoint(matrix, [x + width, y + height]),
      [1, 1, 1, alpha],
      SHAPE_RECT,
      entry.layer + 1,
      false,
      entry.uv
    );
    return true;
  }

  text(
    matrix: Canvas2DMatrix,
    x: number,
    y: number,
    font: string,
    text: string,
    colorCss: string,
    align: "left" | "center" | "right" = "left",
    baseline: "top" | "bottom" | "middle" = "top",
    screenSpace = false,
    alpha = 1
  ) {
    if (text.length === 0) {
      return;
    }
    const entry = this.atlas.add(this.measure, font, text, colorCss);
    if (!entry) {
      return;
    }
    let drawX = x;
    if (align === "center") {
      drawX -= entry.width / 2;
    } else if (align === "right") {
      drawX -= entry.width;
    }
    const drawY =
      baseline === "bottom"
        ? y - entry.height
        : baseline === "middle"
          ? y - entry.height / 2
          : y;
    this.quad(
      transformCanvas2DPoint(matrix, [drawX, drawY]),
      transformCanvas2DPoint(matrix, [drawX + entry.width, drawY]),
      transformCanvas2DPoint(matrix, [drawX, drawY + entry.height]),
      transformCanvas2DPoint(matrix, [drawX + entry.width, drawY + entry.height]),
      [1, 1, 1, alpha],
      SHAPE_RECT,
      entry.layer + 1,
      screenSpace,
      entry.uv
    );
  }

  private dashedPolyline(
    points: readonly (readonly [number, number])[],
    width: number,
    color: GpuColor,
    dash: number,
    gap: number
  ) {
    let drawing = true;
    let remaining = dash;
    for (let index = 1; index < points.length; index += 1) {
      let start = points[index - 1];
      const end = points[index];
      if (!start || !end) {
        continue;
      }
      let leftover = Math.hypot(end[0] - start[0], end[1] - start[1]);
      while (leftover > Number.EPSILON) {
        const step = Math.min(leftover, remaining);
        const t = step / leftover;
        const next: readonly [number, number] = [
          start[0] + (end[0] - start[0]) * t,
          start[1] + (end[1] - start[1]) * t
        ];
        if (drawing) {
          this.line(start, next, width, color);
        }
        leftover -= step;
        remaining -= step;
        start = next;
        if (remaining <= Number.EPSILON) {
          drawing = !drawing;
          remaining = drawing ? dash : gap;
        }
      }
    }
  }

  private quad(
    topLeft: readonly [number, number],
    topRight: readonly [number, number],
    bottomLeft: readonly [number, number],
    bottomRight: readonly [number, number],
    color: GpuColor,
    shape: number,
    textured: boolean | number,
    screenSpace: boolean,
    uv?: { u0: number; v0: number; u1: number; v1: number },
    strokeColor: GpuColor = TRANSPARENT_GPU_COLOR,
    strokeWidth = 0,
    localSize: readonly [number, number] = [1, 1],
    radii: readonly [number, number, number, number] = ZERO_VEC4
  ) {
    const u0 = uv?.u0 ?? 0;
    const v0 = uv?.v0 ?? 0;
    const u1 = uv?.u1 ?? 1;
    const v1 = uv?.v1 ?? 1;
    const textureSlot =
      typeof textured === "number" ? textured : textured ? 1 : 0;
    this.vertex(topLeft, [u0, v0], color, shape, textureSlot, screenSpace, strokeColor, strokeWidth, localSize, radii);
    this.vertex(topRight, [u1, v0], color, shape, textureSlot, screenSpace, strokeColor, strokeWidth, localSize, radii);
    this.vertex(bottomLeft, [u0, v1], color, shape, textureSlot, screenSpace, strokeColor, strokeWidth, localSize, radii);
    this.vertex(topRight, [u1, v0], color, shape, textureSlot, screenSpace, strokeColor, strokeWidth, localSize, radii);
    this.vertex(bottomRight, [u1, v1], color, shape, textureSlot, screenSpace, strokeColor, strokeWidth, localSize, radii);
    this.vertex(bottomLeft, [u0, v1], color, shape, textureSlot, screenSpace, strokeColor, strokeWidth, localSize, radii);
  }

  private vertex(
    point: readonly [number, number],
    uv: readonly [number, number],
    color: GpuColor,
    shape: number,
    textureSlot: number | boolean,
    screenSpace: boolean,
    strokeColor: GpuColor,
    strokeWidth: number,
    localSize: readonly [number, number],
    radii: readonly [number, number, number, number]
  ) {
    const clip = !screenSpace ? this.activeClip : null;
    const slotValue =
      typeof textureSlot === "number" ? textureSlot : textureSlot ? 1 : 0;
    let clipX = 0;
    let clipY = 0;
    let clipBox0 = 0;
    let clipBox1 = 0;
    let clipBox2 = 0;
    let clipBox3 = 0;
    let clipR0 = 0;
    let clipR1 = 0;
    let clipR2 = 0;
    let clipR3 = 0;
    if (clip) {
      const transformed = transformCanvas2DPoint(clip.inverseMatrix, point);
      clipX = transformed[0];
      clipY = transformed[1];
      clipBox0 = clip.clipBox[0];
      clipBox1 = clip.clipBox[1];
      clipBox2 = clip.clipBox[2];
      clipBox3 = clip.clipBox[3];
      clipR0 = clip.clipRadii[0];
      clipR1 = clip.clipRadii[1];
      clipR2 = clip.clipRadii[2];
      clipR3 = clip.clipRadii[3];
    }

    this.floats.push(
      point[0],
      point[1],
      uv[0],
      uv[1],
      color[0],
      color[1],
      color[2],
      color[3],
      shape,
      slotValue,
      screenSpace ? 1 : 0,
      strokeWidth,
      strokeColor[0],
      strokeColor[1],
      strokeColor[2],
      strokeColor[3],
      localSize[0],
      localSize[1],
      clipX,
      clipY,
      radii[0],
      radii[1],
      radii[2],
      radii[3],
      clipBox0,
      clipBox1,
      clipBox2,
      clipBox3,
      clipR0,
      clipR1,
      clipR2,
      clipR3
    );
  }
}

type AtlasEntry = {
  readonly height: number;
  readonly layer: number;
  readonly uv: { u0: number; v0: number; u1: number; v1: number };
  readonly width: number;
};

class TextAtlas {
  private readonly pages: { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }[] = [];
  private cursorX = 1;
  private cursorY = 1;
  private rowHeight = 0;
  private used = false;

  private allocateSlot(
    slotWidth: number,
    slotHeight: number
  ): {
    readonly context: CanvasRenderingContext2D;
    readonly layer: number;
    readonly x: number;
    readonly y: number;
  } | null {
    if (slotWidth + 2 > ATLAS_SIZE || slotHeight + 2 > ATLAS_SIZE) {
      return null;
    }
    if (this.pages.length === 0) {
      this.pages.push(createAtlasCanvas());
      this.cursorX = 1;
      this.cursorY = 1;
      this.rowHeight = 0;
    }
    if (this.cursorX + slotWidth + 1 > ATLAS_SIZE) {
      this.cursorX = 1;
      this.cursorY += this.rowHeight + 1;
      this.rowHeight = 0;
    }
    if (this.cursorY + slotHeight + 1 > ATLAS_SIZE) {
      if (this.pages.length >= MAX_ATLAS_PAGES) {
        return null;
      }
      this.pages.push(createAtlasCanvas());
      this.cursorX = 1;
      this.cursorY = 1;
      this.rowHeight = 0;
    }
    const layer = this.pages.length - 1;
    const x = this.cursorX;
    const y = this.cursorY;
    this.cursorX += slotWidth + 1;
    this.rowHeight = Math.max(this.rowHeight, slotHeight);
    this.used = true;
    return { context: this.pages[layer]!.context, layer, x, y };
  }

  stamp(
    width: number,
    height: number,
    paint: (context: CanvasRenderingContext2D) => void
  ): AtlasEntry | null {
    const stampWidth = Math.max(1, Math.ceil(width));
    const stampHeight = Math.max(1, Math.ceil(height));
    const slot = this.allocateSlot(stampWidth, stampHeight);
    if (!slot) {
      return null;
    }
    slot.context.save();
    slot.context.beginPath();
    slot.context.rect(slot.x, slot.y, stampWidth, stampHeight);
    slot.context.clip();
    slot.context.translate(slot.x, slot.y);
    paint(slot.context);
    slot.context.restore();
    const uv = {
      u0: slot.x / ATLAS_SIZE,
      v0: slot.y / ATLAS_SIZE,
      u1: (slot.x + stampWidth) / ATLAS_SIZE,
      v1: (slot.y + stampHeight) / ATLAS_SIZE
    };
    return { height: stampHeight, layer: slot.layer, uv, width: stampWidth };
  }

  add(
    measure: CanvasRenderingContext2D,
    font: string,
    text: string,
    fill: string
  ): AtlasEntry | null {
    measure.font = font;
    const width = Math.max(1, Math.ceil(measure.measureText(text).width) + 2);
    const sizeMatch = /(\d+(?:\.\d+)?)px/.exec(font);
    const height = Math.max(1, Math.ceil(Number(sizeMatch?.[1] ?? 14) + 6));
    const slot = this.allocateSlot(width, height);
    if (!slot) {
      return null;
    }
    slot.context.font = font;
    slot.context.fillStyle = fill;
    slot.context.textBaseline = "top";
    slot.context.textAlign = "left";
    slot.context.fillText(text, slot.x + 1, slot.y + 1);
    const uv = {
      u0: slot.x / ATLAS_SIZE,
      v0: slot.y / ATLAS_SIZE,
      u1: (slot.x + width) / ATLAS_SIZE,
      v1: (slot.y + height) / ATLAS_SIZE
    };
    return { height, layer: slot.layer, uv, width };
  }

  snapshot(): {
    readonly height: number;
    readonly pages: readonly Uint8Array[];
    readonly width: number;
  } | null {
    if (!this.used || this.pages.length === 0) {
      return null;
    }
    const pages: Uint8Array[] = [];
    for (let i = 0; i < this.pages.length; i += 1) {
      const image = this.pages[i]!.context.getImageData(0, 0, ATLAS_SIZE, ATLAS_SIZE);
      pages.push(new Uint8Array(image.data.buffer));
    }
    return {
      height: ATLAS_SIZE,
      pages,
      width: ATLAS_SIZE
    };
  }
}

function createAtlasCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) {
    throw new Error("2D canvas context is not available.");
  }
  context.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
  return { canvas, context };
}

function cssToRgba(
  context: CanvasRenderingContext2D,
  css: string,
  alpha = 1
): GpuColor {
  context.fillStyle = "#000000";
  context.fillStyle = css;
  const value = String(context.fillStyle);
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex?.[1]) {
    const n = Number.parseInt(hex[1], 16);
    return [
      ((n >> 16) & 255) / 255,
      ((n >> 8) & 255) / 255,
      (n & 255) / 255,
      alpha
    ];
  }
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?/i.exec(value);
  const cssAlpha = rgb?.[4] !== undefined ? Number(rgb[4]) : 1;
  return [
    Number(rgb?.[1] ?? 0) / 255,
    Number(rgb?.[2] ?? 0) / 255,
    Number(rgb?.[3] ?? 0) / 255,
    (Number.isFinite(cssAlpha) ? cssAlpha : 1) * alpha
  ];
}

function resolveImageLodScale(zoom: number): number {
  const clamped = Math.max(
    0.0625,
    Math.min(2, Number.isFinite(zoom) && zoom > 0 ? zoom : 1)
  );
  const exp = Math.ceil(Math.log2(clamped));
  return Math.max(0.0625, Math.min(2, Math.pow(2, exp)));
}

function recordFrame(
  batch: VertexBatch,
  frame: Canvas2DWebGpuFrame,
  cullBounds: Canvas2DRectBounds | null,
  imageLodScale: number
): { readonly hasAnimatedShade: boolean; readonly hasImages: boolean } {
  recordGridPreviews(batch, frame);
  const { hasAnimatedShade, hasImages } = recordScene(
    batch,
    frame,
    cullBounds,
    imageLodScale
  );
  batch.setClip(null);
  recordOverlayPreviews(batch, frame, imageLodScale);
  if (frame.snapGuides.length > 0) {
    recordSnapGuides(batch, frame);
  }
  if (frame.inspectionOverlay) {
    recordInspectionOverlay(batch, frame);
  }
  if (frame.connectionHandlesVisible) {
    recordConnectionHandles(batch, frame);
  }
  recordTransformHandles(batch, frame);
  return { hasAnimatedShade, hasImages };
}

function recordSnapGuides(batch: VertexBatch, frame: Canvas2DWebGpuFrame) {
  const safeZoom = Math.max(frame.viewState.zoom, 1e-4);
  const lineWidth = 1 / safeZoom;
  const dash = 4 / safeZoom;
  const tick = 3 / safeZoom;
  const color = batch.fillColor(frame.contentColors.accent || "#f43f5e");

  for (let i = 0; i < frame.snapGuides.length; i += 1) {
    const guide = frame.snapGuides[i]!;
    if (guide.axis === "x") {
      batch.polyline(
        [
          [guide.position, guide.from],
          [guide.position, guide.to]
        ],
        lineWidth,
        color,
        [dash, dash]
      );
      batch.line(
        [guide.position - tick, guide.from],
        [guide.position + tick, guide.from],
        lineWidth,
        color
      );
      batch.line(
        [guide.position - tick, guide.to],
        [guide.position + tick, guide.to],
        lineWidth,
        color
      );
    } else {
      batch.polyline(
        [
          [guide.from, guide.position],
          [guide.to, guide.position]
        ],
        lineWidth,
        color,
        [dash, dash]
      );
      batch.line(
        [guide.from, guide.position - tick],
        [guide.from, guide.position + tick],
        lineWidth,
        color
      );
      batch.line(
        [guide.to, guide.position - tick],
        [guide.to, guide.position + tick],
        lineWidth,
        color
      );
    }
  }
}

function recordInspectionPill(
  batch: VertexBatch,
  frame: Canvas2DWebGpuFrame,
  sceneX: number,
  sceneY: number,
  text: string,
  backgroundCss: string,
  foregroundCss: string,
  verticalAnchor: "above" | "center"
) {
  if (text.length === 0) {
    return;
  }
  const screen = sceneToCanvasPoint(frame.viewState, [sceneX, sceneY]);
  batch.measure.font = CANVAS_2D_WEBGPU_INSPECTION_FONT;
  const textWidth = batch.measure.measureText(text).width;
  const pillWidth = textWidth + 12;
  const pillHeight = 18;
  const pillX = screen[0] - pillWidth * 0.5;
  const pillY =
    verticalAnchor === "above"
      ? screen[1] - (pillHeight + 6)
      : screen[1] - pillHeight * 0.5;

  batch.roundedRect(
    CANVAS_2D_IDENTITY_MATRIX,
    pillX,
    pillY,
    pillWidth,
    pillHeight,
    batch.fillColor(backgroundCss),
    [4, 4, 4, 4],
    null,
    0,
    true
  );
  batch.text(
    CANVAS_2D_IDENTITY_MATRIX,
    screen[0],
    pillY + pillHeight * 0.5,
    CANVAS_2D_WEBGPU_INSPECTION_FONT,
    text,
    foregroundCss,
    "center",
    "middle",
    true
  );
}

function recordInspectionOverlay(batch: VertexBatch, frame: Canvas2DWebGpuFrame) {
  const overlay = frame.inspectionOverlay;
  if (!overlay) {
    return;
  }
  const safeZoom = Math.max(frame.viewState.zoom, 1e-4);
  const invZoom = 1 / safeZoom;

  if (overlay.boxModels && overlay.boxModels.length > 0) {
    for (let i = 0; i < overlay.boxModels.length; i += 1) {
      const boxModel = overlay.boxModels[i]!;
      const regions = resolveCanvas2DBoxModelRegions(boxModel);
      const palette = {
        ...DEFAULT_BOX_MODEL_COLORS,
        ...boxModel.colors
      };

      const marginColor = batch.fillColor(palette.margin, 0.26);
      for (let s = 0; s < regions.marginStrips.length; s += 1) {
        const strip = regions.marginStrips[s]!;
        batch.rect(CANVAS_2D_IDENTITY_MATRIX, strip.x, strip.y, strip.width, strip.height, marginColor);
      }

      const borderColor = batch.fillColor(palette.border, 0.34);
      for (let s = 0; s < regions.borderStrips.length; s += 1) {
        const strip = regions.borderStrips[s]!;
        batch.rect(CANVAS_2D_IDENTITY_MATRIX, strip.x, strip.y, strip.width, strip.height, borderColor);
      }

      const paddingColor = batch.fillColor(palette.padding, 0.26);
      for (let s = 0; s < regions.paddingStrips.length; s += 1) {
        const strip = regions.paddingStrips[s]!;
        batch.rect(CANVAS_2D_IDENTITY_MATRIX, strip.x, strip.y, strip.width, strip.height, paddingColor);
      }

      if (regions.contentRect) {
        batch.rect(
          CANVAS_2D_IDENTITY_MATRIX,
          regions.contentRect.x,
          regions.contentRect.y,
          regions.contentRect.width,
          regions.contentRect.height,
          batch.fillColor(palette.content, 0.22)
        );
      }

      const b = regions.borderBox;
      batch.polyline(
        [
          [b.minX, b.minY],
          [b.maxX, b.minY],
          [b.maxX, b.maxY],
          [b.minX, b.maxY],
          [b.minX, b.minY]
        ],
        invZoom,
        batch.fillColor(palette.content, 0.92),
        [4 * invZoom, 3 * invZoom]
      );

      if (boxModel.label) {
        recordInspectionPill(
          batch,
          frame,
          (b.minX + b.maxX) * 0.5,
          regions.marginBox.minY,
          boxModel.label,
          palette.labelBackground,
          palette.labelForeground,
          "above"
        );
      }
    }
  }

  if (overlay.redlines && overlay.redlines.length > 0) {
    const tickHalf = 4 * invZoom;
    for (let i = 0; i < overlay.redlines.length; i += 1) {
      const redline = overlay.redlines[i]!;
      const accentCss = redline.color ?? DEFAULT_REDLINE_COLOR;
      const accent = batch.fillColor(accentCss);
      const extColor = batch.fillColor(accentCss, 0.65);
      const dx = redline.end[0] - redline.start[0];
      const dy = redline.end[1] - redline.start[1];
      const length = Math.hypot(dx, dy);

      if (redline.extensions && redline.extensions.length > 0) {
        for (let e = 0; e < redline.extensions.length; e += 1) {
          const ext = redline.extensions[e]!;
          batch.polyline(
            [ext.start, ext.end],
            invZoom,
            extColor,
            [3 * invZoom, 3 * invZoom]
          );
        }
      }

      batch.line(redline.start, redline.end, 1.5 * invZoom, accent);
      if (length > 1e-6) {
        const nx = (-dy / length) * tickHalf;
        const ny = (dx / length) * tickHalf;
        batch.line(
          [redline.start[0] - nx, redline.start[1] - ny],
          [redline.start[0] + nx, redline.start[1] + ny],
          1.5 * invZoom,
          accent
        );
        batch.line(
          [redline.end[0] - nx, redline.end[1] - ny],
          [redline.end[0] + nx, redline.end[1] + ny],
          1.5 * invZoom,
          accent
        );
      }

      const labelText =
        redline.label ?? formatCanvas2DRedlineDistance(length);
      if (labelText.length > 0) {
        recordInspectionPill(
          batch,
          frame,
          (redline.start[0] + redline.end[0]) * 0.5,
          (redline.start[1] + redline.end[1]) * 0.5,
          labelText,
          accentCss,
          frame.contentColors.foreground === accentCss ? "#0f172a" : "#ffffff",
          "center"
        );
      }
    }
  }
}

function recordScene(
  batch: VertexBatch,
  frame: Canvas2DWebGpuFrame,
  cullBounds: Canvas2DRectBounds | null,
  imageLodScale: number
): { readonly hasAnimatedShade: boolean; readonly hasImages: boolean } {
  let hasAnimatedShade = false;
  let hasImages = false;

  if (frame.spatialIndex && cullBounds) {
    const candidates = frame.spatialIndex.queryRect(
      cullBounds,
      frame.transformPreview,
      frame.sceneGraph
    );
    for (let i = 0; i < candidates.length; i += 1) {
      const entry = candidates[i]!;
      const node = entry.node;
      if (node.type === "edge") {
        batch.setClip(null);
        recordEdge(
          batch,
          node,
          frame,
          frame.selectedIds.has(node.id),
          frame.hoveredId === node.id
        );
        continue;
      }
      if (isDenovoShadeNode(node)) {
        hasAnimatedShade = true;
      }
      if (isDenovoImageNode(node)) {
        hasImages = true;
      }
      if (entry.hasStyledAncestor) {
        const ancestors = getCanvas2DAncestors(node, frame.sceneGraph);
        let opacity = 1;
        let world = CANVAS_2D_IDENTITY_MATRIX;
        let activeClip: ActiveGpuClip | null = null;
        for (let a = ancestors.length - 1; a >= 0; a -= 1) {
          const ancestor = ancestors[a]!;
          opacity *= ancestor.opacity;
          if (opacity <= 0) {
            break;
          }
          world = multiplyCanvas2DMatrices(
            world,
            createCanvas2DTransformMatrix(
              resolveNodeRenderTransform(ancestor, frame.transformPreview)
            )
          );
          if (ancestor.clip !== null) {
            activeClip = composeGpuClips(
              activeClip,
              createGpuClipFromGroup(world, ancestor.clip)
            );
          }
        }
        if (opacity > 0) {
          batch.setClip(activeClip);
          recordDrawable(batch, node, frame, world, opacity, imageLodScale);
          batch.setClip(null);
        }
        continue;
      }
      batch.setClip(null);
      const parentWorldTransform = resolveLiveParentWorldTransform(
        entry,
        frame.sceneGraph,
        frame.transformPreview
      );
      recordDrawable(batch, node, frame, parentWorldTransform, 1, imageLodScale);
    }
    return { hasAnimatedShade, hasImages };
  }

  for (const layer of frame.scene.layers) {
    if (!layer.visible) {
      continue;
    }
    for (const root of getCanvas2DLayerRoots(frame.sceneGraph, layer.id)) {
      const flags = recordTreeNode(
        batch,
        root,
        frame,
        CANVAS_2D_IDENTITY_MATRIX,
        1,
        null,
        imageLodScale
      );
      if (flags.hasAnimatedShade) {
        hasAnimatedShade = true;
      }
      if (flags.hasImages) {
        hasImages = true;
      }
    }
  }
  batch.setClip(null);
  return { hasAnimatedShade, hasImages };
}

function recordTreeNode(
  batch: VertexBatch,
  node: Canvas2DNode,
  frame: Canvas2DWebGpuFrame,
  parentWorldTransform: Canvas2DMatrix,
  inheritedOpacity: number,
  activeClip: ActiveGpuClip | null,
  imageLodScale: number
): { readonly hasAnimatedShade: boolean; readonly hasImages: boolean } {
  if (!node.visible || inheritedOpacity <= 0) {
    return { hasAnimatedShade: false, hasImages: false };
  }
  if (node.type === "edge") {
    batch.setClip(null);
    recordEdge(
      batch,
      node,
      frame,
      frame.selectedIds.has(node.id),
      frame.hoveredId === node.id
    );
    return { hasAnimatedShade: false, hasImages: false };
  }
  if (node.type !== "group") {
    batch.setClip(activeClip);
    recordDrawable(batch, node, frame, parentWorldTransform, inheritedOpacity, imageLodScale);
    return {
      hasAnimatedShade: isDenovoShadeNode(node),
      hasImages: isDenovoImageNode(node)
    };
  }
  const nextOpacity = inheritedOpacity * node.opacity;
  if (nextOpacity <= 0) {
    return { hasAnimatedShade: false, hasImages: false };
  }
  const worldTransform = multiplyCanvas2DMatrices(
    parentWorldTransform,
    createCanvas2DTransformMatrix(resolveNodeRenderTransform(node, frame.transformPreview))
  );
  const nextClip =
    node.clip !== null
      ? composeGpuClips(activeClip, createGpuClipFromGroup(worldTransform, node.clip))
      : activeClip;
  let hasAnimatedShade = false;
  let hasImages = false;
  for (const child of getCanvas2DGroupChildren(frame.sceneGraph, node.id)) {
    const flags = recordTreeNode(
      batch,
      child,
      frame,
      worldTransform,
      nextOpacity,
      nextClip,
      imageLodScale
    );
    if (flags.hasAnimatedShade) {
      hasAnimatedShade = true;
    }
    if (flags.hasImages) {
      hasImages = true;
    }
  }
  return { hasAnimatedShade, hasImages };
}

function recordDrawable(
  batch: VertexBatch,
  node: Canvas2DDrawableNode,
  frame: Canvas2DWebGpuFrame,
  parentWorldTransform: Canvas2DMatrix,
  inheritedOpacity = 1,
  imageLodScale = 1
) {
  switch (node.type) {
    case "rect":
    case "circle":
      recordShape(batch, node, frame.transformPreview, parentWorldTransform, inheritedOpacity);
      return;
    case "measurement":
      recordMeasurement(batch, node, parentWorldTransform, frame.contentColors);
      return;
    case "annotation":
      recordAnnotation(batch, node, frame.contentColors);
      return;
    case "edge":
      recordEdge(batch, node, frame, false, false);
      return;
    case "text":
      recordText(batch, node, parentWorldTransform, inheritedOpacity);
      return;
    case "html":
      return;
    default: {
      if (isDenovoImageNode(node)) {
        recordImage(
          batch,
          node,
          frame.transformPreview,
          parentWorldTransform,
          inheritedOpacity,
          frame.imageCache,
          imageLodScale
        );
        return;
      }
      if (isDenovoSparklineNode(node)) {
        recordSparkline(batch, node, frame.transformPreview, parentWorldTransform, inheritedOpacity);
        return;
      }
      if (isDenovoShadeNode(node)) {
        recordShade(batch, node, frame.transformPreview, parentWorldTransform, inheritedOpacity);
        return;
      }
      if (isCanvas2DPluginNode(node)) {
        if (
          recordHostPluginDrawer(batch, node, frame.transformPreview, parentWorldTransform, inheritedOpacity)
        ) {
          return;
        }
        recordPluginMarker(batch, node, frame.transformPreview, parentWorldTransform, inheritedOpacity);
        return;
      }
      const exhaustive: never = node;
      return exhaustive;
    }
  }
}

function recordShape(
  batch: VertexBatch,
  node: Canvas2DShapeNode,
  preview: CanvasNodeTransformPreview | null,
  parentWorldTransform: Canvas2DMatrix,
  inheritedOpacity: number
) {
  const effectiveOpacity = inheritedOpacity * node.opacity;
  if (effectiveOpacity <= 0) {
    return;
  }

  const matrix = multiplyCanvas2DMatrices(
    parentWorldTransform,
    createCanvas2DTransformMatrix(resolveNodeRenderTransform(node, preview))
  );
  const transparentFill = node.fill === "none" || node.fill === "transparent";
  const fillColor: GpuColor = transparentFill
    ? TRANSPARENT_GPU_COLOR
    : batch.fillColor(node.fill, effectiveOpacity);
  const hasStroke = node.stroke !== null && node.strokeWidth > 0;
  const strokeColor: GpuColor | null =
    hasStroke && node.stroke !== null
      ? batch.fillColor(node.stroke, effectiveOpacity)
      : null;

  if (node.type === "rect") {
    const radii = resolveClampedCornerRadii(
      node.size[0],
      node.size[1],
      node.cornerRadius
    );
    batch.roundedRect(
      matrix,
      0,
      0,
      node.size[0],
      node.size[1],
      fillColor,
      radii,
      strokeColor,
      hasStroke ? node.strokeWidth : 0
    );
    return;
  }
  batch.circle(
    matrix,
    0,
    0,
    node.radius,
    fillColor,
    false,
    strokeColor,
    hasStroke ? node.strokeWidth : 0
  );
}

function recordText(
  batch: VertexBatch,
  node: Extract<Canvas2DNode, { type: "text" }>,
  parentWorldTransform: Canvas2DMatrix,
  inheritedOpacity: number
) {
  const matrix = multiplyCanvas2DMatrices(
    parentWorldTransform,
    createCanvas2DTransformMatrix({
      position: node.position,
      rotation: node.rotation,
      scale: node.scale
    })
  );
  const font = `${node.fontWeight} ${node.fontSize}px ${node.fontFamily}`;
  const lines = wrapCanvas2DText(batch.measure, font, node.text, node.width);
  const lineHeight = node.fontSize * 1.2;
  lines.forEach((line, index) => {
    let drawX = 0;
    if (node.align === "center") {
      drawX = -(measureCanvas2DText(batch.measure, font, line) / 2);
    } else if (node.align === "right") {
      drawX = -measureCanvas2DText(batch.measure, font, line);
    }
    batch.text(
      matrix,
      drawX,
      index * lineHeight,
      font,
      line,
      node.fill,
      "left",
      "top",
      false,
      inheritedOpacity
    );
  });
}

function recordAnnotation(
  batch: VertexBatch,
  node: Canvas2DAnnotationNode,
  colors: Canvas2DContentColors
) {
  batch.circle(
    CANVAS_2D_IDENTITY_MATRIX,
    node.anchor[0],
    node.anchor[1],
    CANVAS_2D_ANCHOR_RADIUS,
    batch.fillColor(colors.accent)
  );
  batch.text(
    CANVAS_2D_IDENTITY_MATRIX,
    node.anchor[0] + CANVAS_2D_ANNOTATION_TEXT_OFFSET[0],
    node.anchor[1] + CANVAS_2D_ANNOTATION_TEXT_OFFSET[1],
    CANVAS_2D_ANNOTATION_FONT,
    node.text,
    colors.foreground,
    "left",
    "bottom"
  );
}

function recordMeasurement(
  batch: VertexBatch,
  node: Canvas2DMeasurementNode,
  parentWorldTransform: Canvas2DMatrix,
  colors: Canvas2DContentColors
) {
  const label = resolveCanvas2DMeasurementLabel(node, parentWorldTransform);
  const midpoint = getCanvas2DMidpoint(node.start, node.end);
  batch.line(node.start, node.end, 2, batch.fillColor(colors.accent));
  batch.text(
    CANVAS_2D_IDENTITY_MATRIX,
    midpoint[0],
    midpoint[1] - CANVAS_2D_MEASUREMENT_LABEL_OFFSET,
    CANVAS_2D_MEASUREMENT_FONT,
    label,
    colors.foreground,
    "center",
    "bottom"
  );
}

function recordEdge(
  batch: VertexBatch,
  node: Canvas2DEdgeNode,
  frame: Canvas2DWebGpuFrame,
  selected: boolean,
  hovered: boolean
) {
  const { start, end, waypoints, control } = resolveCanvas2DEdgeGeometry(
    node,
    frame.sceneGraph
  );
  const stroke = selected ? frame.contentColors.accent : node.stroke;
  const strokeWidth = selected
    ? node.strokeWidth + 2
    : hovered
      ? node.strokeWidth + 1
      : node.strokeWidth;
  const color = batch.fillColor(stroke);
  const points = edgePoints(start, end, waypoints, control);
  const dash =
    node.lineStyle === "dashed"
      ? ([12, 6] as const)
      : node.lineStyle === "dotted"
        ? ([2, 6] as const)
        : null;
  batch.polyline(points, strokeWidth, color, dash);
  if (node.sourceArrow) {
    const from = waypoints[0] ?? control ?? end;
    recordArrowhead(batch, from, start, strokeWidth, color);
  }
  if (node.targetArrow) {
    const from =
      waypoints.length > 1
        ? waypoints[waypoints.length - 2]!
        : (control ?? start);
    recordArrowhead(batch, from, end, strokeWidth, color);
  }
}

function edgePoints(
  start: readonly [number, number],
  end: readonly [number, number],
  waypoints: readonly (readonly [number, number])[],
  control: readonly [number, number] | null
): readonly (readonly [number, number])[] {
  if (waypoints.length > 0) {
    return [start, ...waypoints, end];
  }
  if (control) {
    return sampleQuadratic(start, control, end);
  }
  return [start, end];
}

function sampleQuadratic(
  start: readonly [number, number],
  control: readonly [number, number],
  end: readonly [number, number]
): readonly (readonly [number, number])[] {
  const points: [number, number][] = [];
  for (let index = 0; index <= 16; index += 1) {
    const t = index / 16;
    const u = 1 - t;
    points.push([
      u * u * start[0] + 2 * u * t * control[0] + t * t * end[0],
      u * u * start[1] + 2 * u * t * control[1] + t * t * end[1]
    ]);
  }
  return points;
}

function recordArrowhead(
  batch: VertexBatch,
  from: readonly [number, number],
  to: readonly [number, number],
  strokeWidth: number,
  color: GpuColor
) {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const size = Math.max(strokeWidth * 2.5, 6);
  const wing = Math.PI / 7;
  batch.triangle(
    to,
    [
      to[0] + Math.cos(angle + Math.PI - wing) * size,
      to[1] + Math.sin(angle + Math.PI - wing) * size
    ],
    [
      to[0] + Math.cos(angle + Math.PI + wing) * size,
      to[1] + Math.sin(angle + Math.PI + wing) * size
    ],
    color
  );
}

function recordImage(
  batch: VertexBatch,
  node: Canvas2DPluginNode,
  preview: CanvasNodeTransformPreview | null,
  parentWorldTransform: Canvas2DMatrix,
  inheritedOpacity: number,
  imageCache?: Canvas2DImageCache,
  lodScale = 1
) {
  if (!isDenovoImageNode(node)) {
    return;
  }

  const style = resolveDenovoImageStyle(node.props);
  const effectiveOpacity = inheritedOpacity * style.opacity;
  if (effectiveOpacity <= 0) {
    return;
  }

  const width = node.props.width;
  const height = node.props.height;
  const matrix = multiplyCanvas2DMatrices(
    parentWorldTransform,
    createCanvas2DTransformMatrix(resolveNodeRenderTransform(node, preview))
  );
  const radii = resolveClampedCornerRadii(width, height, style.cornerRadius);
  const hasStroke = style.stroke !== null && style.strokeWidth > 0;
  const strokeColor: GpuColor | null =
    hasStroke && style.stroke !== null
      ? batch.fillColor(style.stroke, effectiveOpacity)
      : null;

  const resolved = imageCache?.resolve(node.props) ?? null;
  let stamped = false;

  if (resolved) {
    const drawRect = resolveDenovoImageDrawRect(
      resolved.naturalWidth,
      resolved.naturalHeight,
      width,
      height,
      style.fit
    );
    if (drawRect) {
      const lodCap =
        lodScale > 1 ? MAX_IMAGE_ATLAS_ZOOMED_IN_DIM : MAX_IMAGE_ATLAS_STAMP_DIM;
      const desiredWidth = width * lodScale;
      const desiredHeight = height * lodScale;
      const maxDesired = Math.max(desiredWidth, desiredHeight);
      const clampScale = maxDesired > lodCap ? lodCap / maxDesired : 1;
      const minW = Math.min(Math.ceil(width), MIN_IMAGE_ATLAS_STAMP_DIM);
      const minH = Math.min(Math.ceil(height), MIN_IMAGE_ATLAS_STAMP_DIM);
      const stampWidth = Math.max(
        minW,
        Math.min(lodCap, Math.round(desiredWidth * clampScale))
      );
      const stampHeight = Math.max(
        minH,
        Math.min(lodCap, Math.round(desiredHeight * clampScale))
      );
      stamped = batch.raster(
        matrix,
        0,
        0,
        width,
        height,
        (context) => {
          context.scale(stampWidth / width, stampHeight / height);
          traceCanvas2DRoundedRectPath(context, 0, 0, width, height, radii);
          context.clip();
          if (
            style.fit === "contain" &&
            style.placeholder !== "none" &&
            style.placeholder !== "transparent"
          ) {
            context.fillStyle = style.placeholder;
            context.fillRect(0, 0, width, height);
          }
          context.drawImage(
            resolved.source,
            drawRect.sx,
            drawRect.sy,
            drawRect.sw,
            drawRect.sh,
            drawRect.dx,
            drawRect.dy,
            drawRect.dw,
            drawRect.dh
          );
        },
        effectiveOpacity,
        stampWidth,
        stampHeight
      );
    }
  }

  if (!stamped) {
    const transparentPlaceholder =
      style.placeholder === "none" || style.placeholder === "transparent";
    const fillColor: GpuColor = transparentPlaceholder
      ? TRANSPARENT_GPU_COLOR
      : batch.fillColor(style.placeholder, effectiveOpacity);
    batch.roundedRect(
      matrix,
      0,
      0,
      width,
      height,
      fillColor,
      radii,
      strokeColor,
      hasStroke ? style.strokeWidth : 0
    );
    return;
  }

  if (hasStroke && strokeColor !== null) {
    batch.roundedRect(
      matrix,
      0,
      0,
      width,
      height,
      TRANSPARENT_GPU_COLOR,
      radii,
      strokeColor,
      style.strokeWidth
    );
  }
}

function recordShade(
  batch: VertexBatch,
  node: Canvas2DPluginNode,
  preview: CanvasNodeTransformPreview | null,
  parentWorldTransform: Canvas2DMatrix,
  inheritedOpacity: number
) {
  if (!isDenovoShadeNode(node)) {
    return;
  }
  const matrix = multiplyCanvas2DMatrices(
    parentWorldTransform,
    createCanvas2DTransformMatrix(resolveNodeRenderTransform(node, preview))
  );
  const [width, height] = [node.props.width, node.props.height];
  const elapsedMs = performance.now();
  const strips = node.props.pattern === "gradient" ? 24 : denovoShadeStripCount(node.props);
  const stripWidth = width / strips;
  for (let index = 0; index < strips; index += 1) {
    batch.rect(
      matrix,
      index * stripWidth,
      0,
      stripWidth + 0.5,
      height,
      batch.fillColor(
        denovoShadeStripColor(node.props, index, strips, elapsedMs),
        inheritedOpacity
      )
    );
  }
}

function recordSparkline(
  batch: VertexBatch,
  node: Canvas2DPluginNode,
  preview: CanvasNodeTransformPreview | null,
  parentWorldTransform: Canvas2DMatrix,
  inheritedOpacity: number
) {
  if (!isDenovoSparklineNode(node)) {
    return;
  }
  const matrix = multiplyCanvas2DMatrices(
    parentWorldTransform,
    createCanvas2DTransformMatrix(resolveNodeRenderTransform(node, preview))
  );
  const points = denovoSparklinePoints(node.props);
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) {
    return;
  }
  const worldPoints = points.map((point) => transformCanvas2DPoint(matrix, point));
  if (node.props.fill !== "none") {
    const fill = batch.fillColor(node.props.fill, inheritedOpacity);
    const bottomFirst = transformCanvas2DPoint(matrix, [first[0], node.props.height]);
    const bottomLast = transformCanvas2DPoint(matrix, [last[0], node.props.height]);
    for (let index = 1; index < worldPoints.length; index += 1) {
      const previous = worldPoints[index - 1];
      const current = worldPoints[index];
      if (!previous || !current) {
        continue;
      }
      const previousBottom = transformCanvas2DPoint(matrix, [
        points[index - 1]?.[0] ?? first[0],
        node.props.height
      ]);
      const currentBottom = transformCanvas2DPoint(matrix, [
        points[index]?.[0] ?? last[0],
        node.props.height
      ]);
      batch.triangle(previous, current, previousBottom, fill);
      batch.triangle(current, currentBottom, previousBottom, fill);
    }
    void bottomFirst;
    void bottomLast;
  }
  batch.polyline(worldPoints, 2, batch.fillColor(node.props.stroke, inheritedOpacity));
}

function recordHostPluginDrawer(
  batch: VertexBatch,
  node: Canvas2DPluginNode,
  preview: CanvasNodeTransformPreview | null,
  parentWorldTransform: Canvas2DMatrix,
  inheritedOpacity: number
): boolean {
  const draw2d = resolveHostPluginNodeDraw2d(node);
  if (!draw2d) {
    return false;
  }
  const [width, height] = resolveCanvas2DPluginNodeLocalSize(node);
  const matrix = multiplyCanvas2DMatrices(
    parentWorldTransform,
    createCanvas2DTransformMatrix(resolveNodeRenderTransform(node, preview))
  );
  return batch.raster(
    matrix,
    0,
    0,
    width,
    height,
    (context) => {
      draw2d(context, node, preview);
    },
    inheritedOpacity
  );
}

function recordPluginMarker(
  batch: VertexBatch,
  node: Canvas2DPluginNode,
  preview: CanvasNodeTransformPreview | null,
  parentWorldTransform: Canvas2DMatrix,
  inheritedOpacity: number
) {
  const matrix = multiplyCanvas2DMatrices(
    parentWorldTransform,
    createCanvas2DTransformMatrix(resolveNodeRenderTransform(node, preview))
  );
  const [width, height] = resolveCanvas2DPluginNodeLocalSize(node);
  batch.rect(
    matrix,
    0,
    0,
    width,
    height,
    batch.fillColor(PLUGIN_NODE_MARKER_FILL, inheritedOpacity)
  );
}

function recordConnectionHandles(batch: VertexBatch, frame: Canvas2DWebGpuFrame) {
  const radius = CANVAS_2D_CONNECTION_HANDLE_RADIUS / frame.viewState.zoom;
  const fill = batch.fillColor(frame.contentColors.accent);
  for (const node of frame.scene.nodes) {
    if (
      !isCanvas2DConnectableNode(node) ||
      !isNodeEffectivelyVisible(frame.scene, frame.sceneGraph, node) ||
      isNodeEffectivelyLocked(frame.scene, frame.sceneGraph, node)
    ) {
      continue;
    }
    const bounds = resolveCanvas2DNodeWorldBounds(node, frame.sceneGraph);
    for (const side of CANVAS_NODE_PORT_SIDES) {
      const [x, y] = resolveCanvas2DConnectionHandlePoint(bounds, side);
      batch.circle(CANVAS_2D_IDENTITY_MATRIX, x, y, radius, fill);
    }
  }
}

function recordGridPreviews(batch: VertexBatch, frame: Canvas2DWebGpuFrame) {
  for (const preview of frame.authoringPreviews) {
    if (preview.kind !== "grid") {
      continue;
    }
    recordGrid(batch, preview.grid, frame, batch.fillColor(frame.contentColors.accent, 0.24));
  }
}

function recordGrid(
  batch: VertexBatch,
  grid: Canvas2DGrid,
  frame: Canvas2DWebGpuFrame,
  color: GpuColor
) {
  const range = resolveCanvas2DGridRenderRange(grid, frame.viewState, frame.resizeState);
  const width = 1 / frame.viewState.zoom;
  for (let index = 0; index < range.xLineCount; index += 1) {
    const x = range.startX + index * grid.spacing[0];
    batch.line([x, range.minY], [x, range.maxY], width, color);
  }
  for (let index = 0; index < range.yLineCount; index += 1) {
    const y = range.startY + index * grid.spacing[1];
    batch.line([range.minX, y], [range.maxX, y], width, color);
  }
}

function recordOverlayPreviews(
  batch: VertexBatch,
  frame: Canvas2DWebGpuFrame,
  imageLodScale: number
) {
  const zoom = frame.viewState.zoom;
  for (const preview of frame.authoringPreviews) {
    switch (preview.kind) {
      case "grid":
        break;
      case "node": {
        if (
          !preview.node.visible ||
          preview.node.type === "group" ||
          preview.node.type === "edge"
        ) {
          break;
        }
        const parentWorldTransform = resolvePreviewParentWorldTransform(
          preview.node,
          frame.sceneGraph
        );
        recordDrawable(
          batch,
          preview.node,
          { ...frame, transformPreview: null },
          parentWorldTransform,
          0.62,
          imageLodScale
        );
        break;
      }
      case "measurement":
        batch.polyline(
          [preview.start, preview.end],
          2 / zoom,
          batch.fillColor(frame.contentColors.accent, 0.78),
          [6 / zoom, 4 / zoom]
        );
        break;
      case "annotation.anchor":
        batch.circle(
          CANVAS_2D_IDENTITY_MATRIX,
          preview.anchor[0],
          preview.anchor[1],
          CANVAS_2D_ANCHOR_RADIUS / zoom,
          batch.fillColor(frame.contentColors.accent)
        );
        break;
      case "annotation.draft":
        batch.circle(
          CANVAS_2D_IDENTITY_MATRIX,
          preview.anchor[0],
          preview.anchor[1],
          CANVAS_2D_ANCHOR_RADIUS / zoom,
          batch.fillColor(frame.contentColors.accent)
        );
        batch.text(
          CANVAS_2D_IDENTITY_MATRIX,
          preview.anchor[0] + CANVAS_2D_ANNOTATION_TEXT_OFFSET[0] / zoom,
          preview.anchor[1] + CANVAS_2D_ANNOTATION_TEXT_OFFSET[1] / zoom,
          CANVAS_2D_ANNOTATION_FONT,
          preview.text,
          frame.contentColors.foreground,
          "left",
          "bottom"
        );
        break;
      case "grid.snap":
        batch.line(
          [preview.position[0] - 8 / zoom, preview.position[1]],
          [preview.position[0] + 8 / zoom, preview.position[1]],
          2 / zoom,
          batch.fillColor(frame.contentColors.accent)
        );
        batch.line(
          [preview.position[0], preview.position[1] - 8 / zoom],
          [preview.position[0], preview.position[1] + 8 / zoom],
          2 / zoom,
          batch.fillColor(frame.contentColors.accent)
        );
        break;
      case "edge.draft": {
        const source = frame.sceneGraph.nodesById.get(preview.sourceId);
        if (!source) {
          break;
        }
        const start =
          preview.sourcePort === null
            ? resolveCanvas2DNodeWorldCenter(source, frame.sceneGraph)
            : resolveCanvas2DConnectionHandlePoint(
                resolveCanvas2DNodeWorldBounds(source, frame.sceneGraph),
                preview.sourcePort
              );
        batch.polyline(
          [start, preview.targetPoint],
          preview.strokeWidth / zoom,
          batch.fillColor(preview.stroke),
          preview.lineStyle === "dashed"
            ? [12 / zoom, 6 / zoom]
            : preview.lineStyle === "dotted"
              ? [2 / zoom, 6 / zoom]
              : null
        );
        if (preview.targetArrow) {
          recordArrowhead(
            batch,
            start,
            preview.targetPoint,
            preview.strokeWidth / zoom,
            batch.fillColor(preview.stroke)
          );
        }
        break;
      }
      case "select.marquee": {
        const minX = Math.min(preview.start[0], preview.end[0]);
        const minY = Math.min(preview.start[1], preview.end[1]);
        const width = Math.abs(preview.end[0] - preview.start[0]);
        const height = Math.abs(preview.end[1] - preview.start[1]);
        batch.rect(
          CANVAS_2D_IDENTITY_MATRIX,
          minX,
          minY,
          width,
          height,
          batch.fillColor(frame.contentColors.accent, 0.12)
        );
        break;
      }
      default: {
        const exhaustive: never = preview;
        return exhaustive;
      }
    }
  }
}

function recordTransformHandles(batch: VertexBatch, frame: Canvas2DWebGpuFrame) {
  const position = frame.transformHandlePosition;
  const kind = frame.transformHandleTarget?.kind ?? null;
  if (!position || !kind) {
    return;
  }
  const [x, y] = position;
  const colors = frame.transformHandleColors;
  if (kind === "rotate") {
    batch.circle(
      CANVAS_2D_IDENTITY_MATRIX,
      x,
      y,
      52,
      batch.fillColor(colors.xy, 0.18),
      true
    );
    return;
  }
  batch.line([x, y], [x + 56, y], 3, batch.fillColor(colors.x), true);
  batch.line([x, y], [x, y + 56], 3, batch.fillColor(colors.y), true);
  if (kind === "translate") {
    batch.triangle(
      [x + 64, y],
      [x + 52, y - 6],
      [x + 52, y + 6],
      batch.fillColor(colors.x),
      true
    );
    batch.triangle(
      [x, y + 64],
      [x - 6, y + 52],
      [x + 6, y + 52],
      batch.fillColor(colors.y),
      true
    );
    batch.rect(
      CANVAS_2D_IDENTITY_MATRIX,
      x - 6,
      y - 6,
      12,
      12,
      batch.fillColor(colors.xy),
      true
    );
    return;
  }
  batch.rect(
    CANVAS_2D_IDENTITY_MATRIX,
    x + 56,
    y - 8,
    16,
    16,
    batch.fillColor(colors.x),
    true
  );
  batch.rect(
    CANVAS_2D_IDENTITY_MATRIX,
    x - 8,
    y + 56,
    16,
    16,
    batch.fillColor(colors.y),
    true
  );
  batch.line([x, y], [x + 42, y + 42], 3, batch.fillColor(colors.xy), true);
  batch.rect(
    CANVAS_2D_IDENTITY_MATRIX,
    x - 7,
    y - 7,
    14,
    14,
    batch.fillColor(colors.xy),
    true
  );
  batch.rect(
    CANVAS_2D_IDENTITY_MATRIX,
    x + 35,
    y + 35,
    14,
    14,
    batch.fillColor(colors.xy),
    true
  );
}
