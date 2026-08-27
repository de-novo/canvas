/**
 * Explicit 2D WebGPU presenter. The display canvas gets a GPU context;
 * Canvas2D is used only on a hidden measure canvas for text metrics and
 * glyph rasterization. Auto 2D stays on the Canvas2D runtime.
 */
import {
  CANVAS_NODE_PORT_SIDES,
  denovoSparklinePoints,
  isCanvas2DPluginNode,
  isDenovoSparklineNode,
  type Canvas2DGrid,
  type Canvas2DNode,
  type Canvas2DPluginNode,
  type Canvas2DScene,
  type CanvasAuthoringPreviewForMode,
  type CanvasNodeTransformHandleTarget,
  type CanvasNodeTransformPreview
} from "@denovo/canvas-core";

import type { Canvas2DViewState } from "../view2d";
import type { CanvasRenderStats } from "../types";
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
  isCanvas2DConnectableNode,
  resolveCanvas2DConnectionHandlePoint,
  resolveCanvas2DEdgeGeometry,
  resolveCanvas2DNodeWorldBounds,
  resolveCanvas2DNodeWorldCenter,
  resolveCanvas2DPluginNodeLocalSize,
  resolveNodeRenderTransform,
  resolvePreviewParentWorldTransform,
  type Canvas2DEdgeNode
} from "./geometry";
import {
  CANVAS_2D_IDENTITY_MATRIX,
  createCanvas2DTransformMatrix,
  multiplyCanvas2DMatrices,
  transformCanvas2DPoint,
  type Canvas2DMatrix
} from "./matrix";
import { resolveCanvas2DGridRenderRange } from "./render";
import {
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

const FLOATS_PER_VERTEX = 12;
const SHAPE_RECT = 0;
const SHAPE_CIRCLE = 1;
const ATLAS_SIZE = 2048;
const GPU_BUFFER_USAGE_VERTEX = 0x0020;
const GPU_BUFFER_USAGE_UNIFORM = 0x0040;
const GPU_BUFFER_USAGE_COPY_DST = 0x0008;
const GPU_TEXTURE_USAGE_COPY_DST = 0x02;
const GPU_TEXTURE_USAGE_TEXTURE_BINDING = 0x04;
const GPU_TEXTURE_USAGE_RENDER_ATTACHMENT = 0x10;
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
@group(0) @binding(2) var textAtlas: texture_2d<f32>;

struct VSIn {
  @location(0) position: vec2f,
  @location(1) uv: vec2f,
  @location(2) color: vec4f,
  @location(3) extra: vec4f,
}

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
  @location(2) extra: vec4f,
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
  return out;
}

@fragment
fn fs(input: VSOut) -> @location(0) vec4f {
  let texel = textureSample(textAtlas, textSampler, input.uv);
  var color = input.color;
  if (input.extra.y > 0.5) {
    color = vec4f(input.color.rgb, input.color.a * texel.a);
    if (color.a < 0.04) {
      discard;
    }
  }
  if (input.extra.x > 0.5 && input.extra.x < 1.5) {
    if (distance(input.uv, vec2f(0.5, 0.5)) > 0.5) {
      discard;
    }
  }
  return color;
}
`;

export type Canvas2DWebGpuFrame = {
  readonly authoringPreviews: readonly CanvasAuthoringPreviewForMode<"2d">[];
  readonly connectionHandlesVisible: boolean;
  readonly contentColors: Canvas2DContentColors;
  readonly hoveredId: string | null;
  readonly measureContext: CanvasRenderingContext2D;
  readonly resizeState: {
    readonly height: number;
    readonly width: number;
  };
  readonly scene: Canvas2DScene;
  readonly sceneGraph: Canvas2DSceneGraph;
  readonly selectedIds: ReadonlySet<string>;
  readonly transformHandleColors: Canvas2DTransformHandleColors;
  readonly transformHandlePosition: readonly [number, number] | null;
  readonly transformHandleTarget: CanvasNodeTransformHandleTarget | null;
  readonly transformPreview: CanvasNodeTransformPreview | null;
  readonly viewState: Canvas2DViewState;
};

export type Canvas2DWebGpuPresenter = {
  destroy(): void;
  getRenderStats(): CanvasRenderStats;
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
    usage: GPU_TEXTURE_USAGE_RENDER_ATTACHMENT
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
        texture: { sampleType: "float" }
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
            { shaderLocation: 3, offset: 32, format: "float32x4" }
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
    size: { width: 1, height: 1 },
    usage: GPU_TEXTURE_USAGE_TEXTURE_BINDING | GPU_TEXTURE_USAGE_COPY_DST
  });
  device.queue.writeTexture(
    { texture: whiteTexture },
    new Uint8Array([255, 255, 255, 255]),
    { bytesPerRow: 4 },
    { width: 1, height: 1 }
  );

  let atlasTexture = whiteTexture;
  let vertexBuffer: GPUBuffer | null = null;
  let vertexCapacity = 0;
  let drawCalls = 0;
  let triangles = 0;
  let destroyed = false;

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

  function render(frame: Canvas2DWebGpuFrame) {
    if (destroyed) {
      return;
    }

    const width = Math.max(1, frame.resizeState.width);
    const height = Math.max(1, frame.resizeState.height);
    const batch = new VertexBatch(frame.measureContext);
    recordFrame(batch, frame);
    const packed = batch.pack();
    const vertexCount = packed.vertexCount;
    triangles = vertexCount / 3;
    drawCalls = vertexCount === 0 ? 0 : 1;

    if (vertexCount > 0) {
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

    if (atlasTexture !== whiteTexture) {
      atlasTexture.destroy();
      atlasTexture = whiteTexture;
    }
    if (packed.atlas) {
      atlasTexture = device.createTexture({
        format: "rgba8unorm",
        size: { width: packed.atlas.width, height: packed.atlas.height },
        usage: GPU_TEXTURE_USAGE_TEXTURE_BINDING | GPU_TEXTURE_USAGE_COPY_DST
      });
      device.queue.writeTexture(
        { texture: atlasTexture },
        packed.atlas.data,
        { bytesPerRow: packed.atlas.width * 4 },
        { width: packed.atlas.width, height: packed.atlas.height }
      );
    }

    const uniforms = new Float32Array([
      frame.viewState.offset[0],
      frame.viewState.offset[1],
      frame.viewState.zoom,
      0,
      width,
      height,
      0,
      0
    ]);
    device.queue.writeBuffer(uniformBuffer, 0, uniforms);

    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: sampler },
        { binding: 2, resource: atlasTexture.createView() }
      ]
    });

    const clear = cssToRgba(frame.measureContext, frame.scene.background);
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: clear[0], g: clear[1], b: clear[2], a: 1 },
          loadOp: "clear",
          storeOp: "store"
        }
      ]
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    if (vertexBuffer && vertexCount > 0) {
      pass.setVertexBuffer(0, vertexBuffer);
      pass.draw(vertexCount);
    }
    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  return {
    destroy,
    getRenderStats: () => ({ drawCalls, triangles }),
    render,
    resize
  };
}

class VertexBatch {
  private readonly floats: number[] = [];
  private readonly atlas = new TextAtlas();
  readonly measure: CanvasRenderingContext2D;

  constructor(measure: CanvasRenderingContext2D) {
    this.measure = measure;
  }

  get vertexCount() {
    return this.floats.length / FLOATS_PER_VERTEX;
  }

  pack(): {
    readonly atlas: { data: Uint8Array; height: number; width: number } | null;
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

  circle(
    matrix: Canvas2DMatrix,
    x: number,
    y: number,
    radius: number,
    color: GpuColor,
    screenSpace = false
  ) {
    this.quad(
      transformCanvas2DPoint(matrix, [x - radius, y - radius]),
      transformCanvas2DPoint(matrix, [x + radius, y - radius]),
      transformCanvas2DPoint(matrix, [x - radius, y + radius]),
      transformCanvas2DPoint(matrix, [x + radius, y + radius]),
      color,
      SHAPE_CIRCLE,
      false,
      screenSpace
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
    this.vertex(a, [0, 0], color, SHAPE_RECT, false, screenSpace);
    this.vertex(b, [1, 0], color, SHAPE_RECT, false, screenSpace);
    this.vertex(c, [0, 1], color, SHAPE_RECT, false, screenSpace);
  }

  text(
    matrix: Canvas2DMatrix,
    x: number,
    y: number,
    font: string,
    text: string,
    colorCss: string,
    align: "left" | "center" | "right" = "left",
    baseline: "top" | "bottom" = "top"
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
    const drawY = baseline === "bottom" ? y - entry.height : y;
    this.quad(
      transformCanvas2DPoint(matrix, [drawX, drawY]),
      transformCanvas2DPoint(matrix, [drawX + entry.width, drawY]),
      transformCanvas2DPoint(matrix, [drawX, drawY + entry.height]),
      transformCanvas2DPoint(matrix, [drawX + entry.width, drawY + entry.height]),
      [1, 1, 1, 1],
      SHAPE_RECT,
      true,
      false,
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
    textured: boolean,
    screenSpace: boolean,
    uv?: { u0: number; v0: number; u1: number; v1: number }
  ) {
    const u0 = uv?.u0 ?? 0;
    const v0 = uv?.v0 ?? 0;
    const u1 = uv?.u1 ?? 1;
    const v1 = uv?.v1 ?? 1;
    this.vertex(topLeft, [u0, v0], color, shape, textured, screenSpace);
    this.vertex(topRight, [u1, v0], color, shape, textured, screenSpace);
    this.vertex(bottomLeft, [u0, v1], color, shape, textured, screenSpace);
    this.vertex(topRight, [u1, v0], color, shape, textured, screenSpace);
    this.vertex(bottomRight, [u1, v1], color, shape, textured, screenSpace);
    this.vertex(bottomLeft, [u0, v1], color, shape, textured, screenSpace);
  }

  private vertex(
    point: readonly [number, number],
    uv: readonly [number, number],
    color: GpuColor,
    shape: number,
    textured: boolean,
    screenSpace: boolean
  ) {
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
      textured ? 1 : 0,
      screenSpace ? 1 : 0,
      0
    );
  }
}

class TextAtlas {
  private readonly canvas = createAtlasCanvas();
  private cursorX = 1;
  private cursorY = 1;
  private rowHeight = 0;
  private used = false;

  add(
    measure: CanvasRenderingContext2D,
    font: string,
    text: string,
    fill: string
  ): { height: number; uv: { u0: number; v0: number; u1: number; v1: number }; width: number } | null {
    measure.font = font;
    const width = Math.max(1, Math.ceil(measure.measureText(text).width) + 2);
    const sizeMatch = /(\d+(?:\.\d+)?)px/.exec(font);
    const height = Math.max(1, Math.ceil((Number(sizeMatch?.[1] ?? 14) + 6)));
    if (this.cursorX + width + 1 > ATLAS_SIZE) {
      this.cursorX = 1;
      this.cursorY += this.rowHeight + 1;
      this.rowHeight = 0;
    }
    if (this.cursorY + height + 1 > ATLAS_SIZE) {
      return null;
    }
    this.canvas.context.font = font;
    this.canvas.context.fillStyle = fill;
    this.canvas.context.textBaseline = "top";
    this.canvas.context.textAlign = "left";
    this.canvas.context.fillText(text, this.cursorX + 1, this.cursorY + 1);
    const uv = {
      u0: this.cursorX / ATLAS_SIZE,
      v0: this.cursorY / ATLAS_SIZE,
      u1: (this.cursorX + width) / ATLAS_SIZE,
      v1: (this.cursorY + height) / ATLAS_SIZE
    };
    this.cursorX += width + 1;
    this.rowHeight = Math.max(this.rowHeight, height);
    this.used = true;
    return { height, uv, width };
  }

  snapshot(): { data: Uint8Array; height: number; width: number } | null {
    if (!this.used) {
      return null;
    }
    const image = this.canvas.context.getImageData(0, 0, ATLAS_SIZE, ATLAS_SIZE);
    return {
      data: new Uint8Array(image.data.buffer),
      height: ATLAS_SIZE,
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
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(value);
  return [
    Number(rgb?.[1] ?? 0) / 255,
    Number(rgb?.[2] ?? 0) / 255,
    Number(rgb?.[3] ?? 0) / 255,
    alpha
  ];
}

function recordFrame(batch: VertexBatch, frame: Canvas2DWebGpuFrame) {
  recordGridPreviews(batch, frame);
  recordScene(batch, frame);
  recordOverlayPreviews(batch, frame);
  if (frame.connectionHandlesVisible) {
    recordConnectionHandles(batch, frame);
  }
  recordTransformHandles(batch, frame);
}

function recordScene(batch: VertexBatch, frame: Canvas2DWebGpuFrame) {
  for (const layer of frame.scene.layers) {
    if (!layer.visible) {
      continue;
    }
    for (const root of getCanvas2DLayerRoots(frame.sceneGraph, layer.id)) {
      recordTreeNode(
        batch,
        root,
        frame,
        CANVAS_2D_IDENTITY_MATRIX
      );
    }
  }
}

function recordTreeNode(
  batch: VertexBatch,
  node: Canvas2DNode,
  frame: Canvas2DWebGpuFrame,
  parentWorldTransform: Canvas2DMatrix
) {
  if (!node.visible) {
    return;
  }
  if (node.type === "edge") {
    recordEdge(
      batch,
      node,
      frame,
      frame.selectedIds.has(node.id),
      frame.hoveredId === node.id
    );
    return;
  }
  if (node.type !== "group") {
    recordDrawable(batch, node, frame, parentWorldTransform);
    return;
  }
  const worldTransform = multiplyCanvas2DMatrices(
    parentWorldTransform,
    createCanvas2DTransformMatrix(resolveNodeRenderTransform(node, frame.transformPreview))
  );
  for (const child of getCanvas2DGroupChildren(frame.sceneGraph, node.id)) {
    recordTreeNode(batch, child, frame, worldTransform);
  }
}

function recordDrawable(
  batch: VertexBatch,
  node: Canvas2DDrawableNode,
  frame: Canvas2DWebGpuFrame,
  parentWorldTransform: Canvas2DMatrix
) {
  switch (node.type) {
    case "rect":
    case "circle":
      recordShape(batch, node, frame.transformPreview);
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
      recordText(batch, node);
      return;
    case "html":
      return;
    default: {
      if (isDenovoSparklineNode(node)) {
        recordSparkline(batch, node, frame.transformPreview);
        return;
      }
      if (isCanvas2DPluginNode(node)) {
        recordPluginMarker(batch, node, frame.transformPreview);
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
  preview: CanvasNodeTransformPreview | null
) {
  const matrix = createCanvas2DTransformMatrix(resolveNodeRenderTransform(node, preview));
  const color = batch.fillColor(node.fill);
  if (node.type === "rect") {
    batch.rect(matrix, 0, 0, node.size[0], node.size[1], color);
    return;
  }
  batch.circle(matrix, 0, 0, node.radius, color);
}

function recordText(
  batch: VertexBatch,
  node: Extract<Canvas2DNode, { type: "text" }>
) {
  const matrix = createCanvas2DTransformMatrix({
    position: node.position,
    rotation: node.rotation,
    scale: node.scale
  });
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
    batch.text(matrix, drawX, index * lineHeight, font, line, node.fill, "left", "top");
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

function recordSparkline(
  batch: VertexBatch,
  node: Canvas2DPluginNode,
  preview: CanvasNodeTransformPreview | null
) {
  if (!isDenovoSparklineNode(node)) {
    return;
  }
  const matrix = createCanvas2DTransformMatrix(resolveNodeRenderTransform(node, preview));
  const points = denovoSparklinePoints(node.props);
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) {
    return;
  }
  const worldPoints = points.map((point) => transformCanvas2DPoint(matrix, point));
  if (node.props.fill !== "none") {
    const fill = batch.fillColor(node.props.fill);
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
  batch.polyline(worldPoints, 2, batch.fillColor(node.props.stroke));
}

function recordPluginMarker(
  batch: VertexBatch,
  node: Canvas2DPluginNode,
  preview: CanvasNodeTransformPreview | null
) {
  const matrix = createCanvas2DTransformMatrix(resolveNodeRenderTransform(node, preview));
  const [width, height] = resolveCanvas2DPluginNodeLocalSize(node);
  batch.rect(matrix, 0, 0, width, height, batch.fillColor("#64748b"));
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

function recordOverlayPreviews(batch: VertexBatch, frame: Canvas2DWebGpuFrame) {
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
          parentWorldTransform
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
