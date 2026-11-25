/**
 * Drawing for the 2D scene.
 *
 * Every function here takes the target context as an argument and touches no
 * renderer state, so the runtime decides *when* to draw and this module decides
 * *how*. Geometry is shared with hit-testing so what is drawn matches what is
 * clickable.
 */
import {
  CANVAS_NODE_PORT_SIDES,
  denovoShadeGradientStops,
  denovoShadeStripColor,
  denovoShadeStripCount,
  denovoSparklinePoints,
  isCanvas2DPluginNode,
  isDenovoImageNode,
  isDenovoShadeNode,
  isDenovoSparklineNode,
  resolveDenovoImageDrawRect,
  resolveDenovoImageStyle,
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
  canvasToScenePoint,
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
  PLUGIN_NODE_MARKER_FILL,
  resolveHostPluginNodeDraw2d
} from "../plugin-drawers";
import {
  CANVAS_2D_IDENTITY_MATRIX,
  applyCanvas2DMatrix,
  createCanvas2DTransformMatrix,
  multiplyCanvas2DMatrices,
  type Canvas2DMatrix
} from "./matrix";
import {
  getCanvas2DAncestors,
  getCanvas2DGroupChildren,
  getCanvas2DLayerRoots,
  isNodeEffectivelyLocked,
  isNodeEffectivelyVisible,
  type Canvas2DAnnotationNode,
  type Canvas2DDrawableNode,
  type Canvas2DMeasurementNode,
  type Canvas2DShapeNode,
  type Canvas2DSceneGraph
} from "./scene-graph";
import {
  measureCanvas2DText,
  resolveCanvas2DMeasurementLabel,
  wrapCanvas2DText
} from "./text";

type Canvas2DTextNode = Extract<Canvas2DNode, { type: "text" }>;

export type Canvas2DContentColors = {
  readonly accent: string;
  readonly foreground: string;
};

export type Canvas2DTransformHandleColors = {
  readonly x: string;
  readonly xy: string;
  readonly y: string;
};

/** Which nodes are currently selected/hovered, for emphasis while drawing. */
export type Canvas2DEmphasis = {
  readonly selectedIds: ReadonlySet<string>;
  readonly hoveredId: string | null;
};

export const CANVAS_2D_NO_EMPHASIS: Canvas2DEmphasis = {
  selectedIds: new Set(),
  hoveredId: null
};

export function resolveCanvas2DGridRenderRange(
  grid: Canvas2DGrid,
  viewState: Canvas2DViewState,
  resizeState: { readonly height: number; readonly width: number }
): {
  readonly maxX: number;
  readonly maxY: number;
  readonly minX: number;
  readonly minY: number;
  readonly startX: number;
  readonly startY: number;
  readonly xLineCount: number;
  readonly yLineCount: number;
} {
  const first = canvasToScenePoint(viewState, [0, 0]);
  const second = canvasToScenePoint(viewState, [
    resizeState.width,
    resizeState.height
  ]);
  const minX = Math.min(first[0], second[0]);
  const maxX = Math.max(first[0], second[0]);
  const minY = Math.min(first[1], second[1]);
  const maxY = Math.max(first[1], second[1]);
  const startX =
    grid.origin[0] +
    Math.floor((minX - grid.origin[0]) / grid.spacing[0]) * grid.spacing[0];
  const endX =
    grid.origin[0] +
    Math.ceil((maxX - grid.origin[0]) / grid.spacing[0]) * grid.spacing[0];
  const startY =
    grid.origin[1] +
    Math.floor((minY - grid.origin[1]) / grid.spacing[1]) * grid.spacing[1];
  const endY =
    grid.origin[1] +
    Math.ceil((maxY - grid.origin[1]) / grid.spacing[1]) * grid.spacing[1];
  const xLineCount = Math.floor((endX - startX) / grid.spacing[0]) + 1;
  const yLineCount = Math.floor((endY - startY) / grid.spacing[1]) + 1;

  if (
    !Number.isSafeInteger(xLineCount) ||
    !Number.isSafeInteger(yLineCount) ||
    xLineCount + yLineCount > 20_000
  ) {
    throw new Error(
      "Canvas2D grid preview exceeds the explicit 20,000 visible-line limit."
    );
  }

  return {
    maxX,
    maxY,
    minX,
    minY,
    startX,
    startY,
    xLineCount,
    yLineCount
  };
}
export function renderTransformHandles(
  context: CanvasRenderingContext2D,
  position: readonly [number, number] | null,
  kind: CanvasNodeTransformHandleTarget["kind"] | null,
  colors: Canvas2DTransformHandleColors
) {
  if (!position || !kind) {
    return;
  }

  const [x, y] = position;
  context.save();
  context.lineCap = "round";
  context.lineWidth = 3;

  if (kind === "rotate") {
    context.strokeStyle = colors.xy;
    context.beginPath();
    context.arc(x, y, 52, 0, Math.PI * 2);
    context.stroke();
    context.restore();
    return;
  }

  context.strokeStyle = colors.x;
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + 56, y);
  context.stroke();
  context.fillStyle = colors.x;
  if (kind === "translate") {
    context.beginPath();
    context.moveTo(x + 64, y);
    context.lineTo(x + 52, y - 6);
    context.lineTo(x + 52, y + 6);
    context.closePath();
    context.fill();
  } else {
    context.fillRect(x + 56, y - 8, 16, 16);
  }

  context.strokeStyle = colors.y;
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x, y + 56);
  context.stroke();
  context.fillStyle = colors.y;
  if (kind === "translate") {
    context.beginPath();
    context.moveTo(x, y + 64);
    context.lineTo(x - 6, y + 52);
    context.lineTo(x + 6, y + 52);
    context.closePath();
    context.fill();
  } else {
    context.fillRect(x - 8, y + 56, 16, 16);
  }

  context.fillStyle = colors.xy;
  if (kind === "translate") {
    context.fillRect(x - 6, y - 6, 12, 12);
  } else {
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + 42, y + 42);
    context.strokeStyle = colors.xy;
    context.stroke();
    context.fillRect(x - 7, y - 7, 14, 14);
    context.fillRect(x + 35, y + 35, 14, 14);
  }
  context.restore();
}
export function renderCanvas2DAuthoringGridPreviews(
  context: CanvasRenderingContext2D,
  previews: readonly CanvasAuthoringPreviewForMode<"2d">[],
  viewState: Canvas2DViewState,
  resizeState: { readonly height: number; readonly width: number },
  colors: Canvas2DContentColors
): void {
  for (const preview of previews) {
    if (preview.kind !== "grid") {
      continue;
    }

    const {
      maxX,
      maxY,
      minX,
      minY,
      startX,
      startY,
      xLineCount,
      yLineCount
    } = resolveCanvas2DGridRenderRange(
      preview.grid,
      viewState,
      resizeState
    );

    context.save();
    context.globalAlpha = 0.24;
    context.lineWidth = 1 / viewState.zoom;
    context.strokeStyle = colors.accent;
    context.beginPath();

    for (let index = 0; index < xLineCount; index += 1) {
      const x = startX + index * preview.grid.spacing[0];
      context.moveTo(x, minY);
      context.lineTo(x, maxY);
    }

    for (let index = 0; index < yLineCount; index += 1) {
      const y = startY + index * preview.grid.spacing[1];
      context.moveTo(minX, y);
      context.lineTo(maxX, y);
    }

    context.stroke();
    context.restore();
  }
}
export function renderCanvas2DAuthoringOverlayPreviews(
  context: CanvasRenderingContext2D,
  previews: readonly CanvasAuthoringPreviewForMode<"2d">[],
  scene: Canvas2DScene,
  sceneGraph: Canvas2DSceneGraph,
  zoom: number,
  colors: Canvas2DContentColors,
  imageCache?: Canvas2DImageCache
): void {
  for (const preview of previews) {
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
          sceneGraph
        );
        context.save();
        context.globalAlpha = 0.62;
        applyCanvas2DMatrix(context, parentWorldTransform);
        renderCanvas2DDrawableNode(
          context,
          preview.node,
          parentWorldTransform,
          null,
          colors,
          scene,
          sceneGraph,
          imageCache
        );
        context.restore();
        break;
      }
      case "measurement":
        context.save();
        context.globalAlpha = 0.78;
        context.lineWidth = 2 / zoom;
        context.setLineDash([6 / zoom, 4 / zoom]);
        context.strokeStyle = colors.accent;
        context.beginPath();
        context.moveTo(preview.start[0], preview.start[1]);
        context.lineTo(preview.end[0], preview.end[1]);
        context.stroke();
        context.restore();
        break;
      case "annotation.anchor":
        renderCanvas2DPreviewAnchor(context, preview.anchor, zoom, colors);
        break;
      case "annotation.draft":
        renderCanvas2DPreviewAnchor(context, preview.anchor, zoom, colors);
        context.save();
        context.fillStyle = colors.foreground;
        context.font = CANVAS_2D_ANNOTATION_FONT;
        context.textAlign = "left";
        context.textBaseline = "bottom";
        context.fillText(
          preview.text,
          preview.anchor[0] + CANVAS_2D_ANNOTATION_TEXT_OFFSET[0] / zoom,
          preview.anchor[1] + CANVAS_2D_ANNOTATION_TEXT_OFFSET[1] / zoom
        );
        context.restore();
        break;
      case "grid.snap":
        context.save();
        context.strokeStyle = colors.accent;
        context.lineWidth = 2 / zoom;
        context.beginPath();
        context.moveTo(preview.position[0] - 8 / zoom, preview.position[1]);
        context.lineTo(preview.position[0] + 8 / zoom, preview.position[1]);
        context.moveTo(preview.position[0], preview.position[1] - 8 / zoom);
        context.lineTo(preview.position[0], preview.position[1] + 8 / zoom);
        context.stroke();
        context.restore();
        break;
      case "edge.draft": {
        const source = sceneGraph.nodesById.get(preview.sourceId);
        if (!source) {
          break;
        }
        // Leave from the grabbed handle so the preview lines up with the edge
        // that will be committed on release.
        const start =
          preview.sourcePort === null
            ? resolveCanvas2DNodeWorldCenter(source, sceneGraph)
            : resolveCanvas2DConnectionHandlePoint(
                resolveCanvas2DNodeWorldBounds(source, sceneGraph),
                preview.sourcePort
              );
        const end: readonly [number, number] = [preview.targetPoint[0], preview.targetPoint[1]];
        context.save();
        context.strokeStyle = preview.stroke;
        context.lineWidth = preview.strokeWidth / zoom;
        context.setLineDash(
          preview.lineStyle === "dashed"
            ? [12 / zoom, 6 / zoom]
            : preview.lineStyle === "dotted"
              ? [2 / zoom, 6 / zoom]
              : []
        );
        context.beginPath();
        context.moveTo(start[0], start[1]);
        context.lineTo(end[0], end[1]);
        context.stroke();
        context.setLineDash([]);
        if (preview.targetArrow) {
          drawEdgeArrowhead(context, start[0], start[1], end[0], end[1], preview.strokeWidth / zoom);
        }
        context.restore();
        break;
      }
      case "select.marquee": {
        const minX = Math.min(preview.start[0], preview.end[0]);
        const minY = Math.min(preview.start[1], preview.end[1]);
        const width = Math.abs(preview.end[0] - preview.start[0]);
        const height = Math.abs(preview.end[1] - preview.start[1]);
        context.save();
        context.fillStyle = colors.accent;
        context.globalAlpha = 0.12;
        context.fillRect(minX, minY, width, height);
        context.globalAlpha = 1;
        context.strokeStyle = colors.accent;
        context.lineWidth = 1 / zoom;
        context.strokeRect(minX, minY, width, height);
        context.restore();
        break;
      }
      default: {
        const exhaustive: never = preview;
        return exhaustive;
      }
    }
  }
}
export function renderCanvas2DPreviewAnchor(
  context: CanvasRenderingContext2D,
  anchor: readonly [number, number],
  zoom: number,
  colors: Canvas2DContentColors
): void {
  context.save();
  context.fillStyle = colors.accent;
  context.beginPath();
  context.arc(anchor[0], anchor[1], CANVAS_2D_ANCHOR_RADIUS / zoom, 0, Math.PI * 2);
  context.fill();
  context.restore();
}
const CANVAS_2D_INSPECTION_FONT =
  "600 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

function isTransparentFill(fill: string): boolean {
  return fill === "none" || fill === "transparent";
}

export function traceCanvas2DRoundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radii: readonly [number, number, number, number]
): void {
  const rx = width < 0 ? x + width : x;
  const ry = height < 0 ? y + height : y;
  const rw = Math.abs(width);
  const rh = Math.abs(height);
  const [tl, tr, br, bl] = radii;

  context.beginPath();
  if (tl === 0 && tr === 0 && br === 0 && bl === 0) {
    context.rect(rx, ry, rw, rh);
    return;
  }

  context.moveTo(rx + tl, ry);
  context.lineTo(rx + rw - tr, ry);
  if (tr > 0) {
    context.arcTo(rx + rw, ry, rx + rw, ry + tr, tr);
  }
  context.lineTo(rx + rw, ry + rh - br);
  if (br > 0) {
    context.arcTo(rx + rw, ry + rh, rx + rw - br, ry + rh, br);
  }
  context.lineTo(rx + bl, ry + rh);
  if (bl > 0) {
    context.arcTo(rx, ry + rh, rx, ry + rh - bl, bl);
  }
  context.lineTo(rx, ry + tl);
  if (tl > 0) {
    context.arcTo(rx, ry, rx + tl, ry, tl);
  }
  context.closePath();
}

function drawInspectionPill(
  context: CanvasRenderingContext2D,
  sceneX: number,
  sceneY: number,
  text: string,
  background: string,
  foreground: string,
  invZoom: number,
  verticalAnchor: "above" | "center"
): void {
  if (text.length === 0) {
    return;
  }

  context.save();
  context.translate(sceneX, sceneY);
  context.scale(invZoom, invZoom);
  context.font = CANVAS_2D_INSPECTION_FONT;
  const textWidth =
    typeof context.measureText === "function"
      ? context.measureText(text).width
      : text.length * 6.5;
  const padX = 6;
  const pillWidth = textWidth + padX * 2;
  const pillHeight = 18;
  const pillX = -pillWidth * 0.5;
  const pillY =
    verticalAnchor === "above" ? -(pillHeight + 6) : -pillHeight * 0.5;

  traceCanvas2DRoundedRectPath(
    context,
    pillX,
    pillY,
    pillWidth,
    pillHeight,
    [4, 4, 4, 4]
  );
  context.fillStyle = background;
  context.fill();

  context.fillStyle = foreground;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 0, pillY + pillHeight * 0.5 + 0.5);
  context.restore();
}

/**
 * Renders ephemeral DevTools-style box-model regions and spacing redlines on
 * top of the 2D scene without mutating the document or undo history.
 */
export function renderCanvas2DInspectionOverlay(
  context: CanvasRenderingContext2D,
  overlay: Canvas2DInspectionOverlay,
  zoom: number,
  colors: Canvas2DContentColors
): void {
  const boxModels = overlay.boxModels;
  const redlines = overlay.redlines;
  if (
    (!boxModels || boxModels.length === 0) &&
    (!redlines || redlines.length === 0)
  ) {
    return;
  }

  const safeZoom = Math.max(zoom, 1e-4);
  const invZoom = 1 / safeZoom;

  if (boxModels && boxModels.length > 0) {
    for (let i = 0; i < boxModels.length; i += 1) {
      const boxModel = boxModels[i]!;
      const regions = resolveCanvas2DBoxModelRegions(boxModel);
      const palette = {
        ...DEFAULT_BOX_MODEL_COLORS,
        ...boxModel.colors
      };

      context.save();

      if (regions.marginStrips.length > 0) {
        context.fillStyle = palette.margin;
        context.globalAlpha = 0.26;
        for (let s = 0; s < regions.marginStrips.length; s += 1) {
          const strip = regions.marginStrips[s]!;
          context.fillRect(strip.x, strip.y, strip.width, strip.height);
        }
      }

      if (regions.borderStrips.length > 0) {
        context.fillStyle = palette.border;
        context.globalAlpha = 0.34;
        for (let s = 0; s < regions.borderStrips.length; s += 1) {
          const strip = regions.borderStrips[s]!;
          context.fillRect(strip.x, strip.y, strip.width, strip.height);
        }
      }

      if (regions.paddingStrips.length > 0) {
        context.fillStyle = palette.padding;
        context.globalAlpha = 0.26;
        for (let s = 0; s < regions.paddingStrips.length; s += 1) {
          const strip = regions.paddingStrips[s]!;
          context.fillRect(strip.x, strip.y, strip.width, strip.height);
        }
      }

      if (regions.contentRect) {
        context.fillStyle = palette.content;
        context.globalAlpha = 0.22;
        context.fillRect(
          regions.contentRect.x,
          regions.contentRect.y,
          regions.contentRect.width,
          regions.contentRect.height
        );
      }

      context.globalAlpha = 0.92;
      context.strokeStyle = palette.content;
      context.lineWidth = invZoom;
      context.setLineDash([4 * invZoom, 3 * invZoom]);
      context.strokeRect(
        regions.borderBox.minX,
        regions.borderBox.minY,
        regions.borderBox.maxX - regions.borderBox.minX,
        regions.borderBox.maxY - regions.borderBox.minY
      );
      context.restore();

      if (boxModel.label) {
        const labelX = (regions.borderBox.minX + regions.borderBox.maxX) * 0.5;
        const labelY = regions.marginBox.minY;
        drawInspectionPill(
          context,
          labelX,
          labelY,
          boxModel.label,
          palette.labelBackground,
          palette.labelForeground,
          invZoom,
          "above"
        );
      }
    }
  }

  if (redlines && redlines.length > 0) {
    const tickHalf = 4 * invZoom;
    for (let i = 0; i < redlines.length; i += 1) {
      const redline = redlines[i]!;
      const accent = redline.color ?? DEFAULT_REDLINE_COLOR;
      const dx = redline.end[0] - redline.start[0];
      const dy = redline.end[1] - redline.start[1];
      const length = Math.hypot(dx, dy);

      context.save();
      context.strokeStyle = accent;

      if (redline.extensions && redline.extensions.length > 0) {
        context.globalAlpha = 0.65;
        context.lineWidth = invZoom;
        context.setLineDash([3 * invZoom, 3 * invZoom]);
        for (let e = 0; e < redline.extensions.length; e += 1) {
          const ext = redline.extensions[e]!;
          context.beginPath();
          context.moveTo(ext.start[0], ext.start[1]);
          context.lineTo(ext.end[0], ext.end[1]);
          context.stroke();
        }
      }

      context.globalAlpha = 1;
      context.setLineDash([]);
      context.lineWidth = 1.5 * invZoom;
      context.beginPath();
      context.moveTo(redline.start[0], redline.start[1]);
      context.lineTo(redline.end[0], redline.end[1]);

      if (length > 1e-6) {
        const nx = (-dy / length) * tickHalf;
        const ny = (dx / length) * tickHalf;
        context.moveTo(redline.start[0] - nx, redline.start[1] - ny);
        context.lineTo(redline.start[0] + nx, redline.start[1] + ny);
        context.moveTo(redline.end[0] - nx, redline.end[1] - ny);
        context.lineTo(redline.end[0] + nx, redline.end[1] + ny);
      }
      context.stroke();
      context.restore();

      const labelText =
        redline.label ?? formatCanvas2DRedlineDistance(length);
      if (labelText.length > 0) {
        const midX = (redline.start[0] + redline.end[0]) * 0.5;
        const midY = (redline.start[1] + redline.end[1]) * 0.5;
        drawInspectionPill(
          context,
          midX,
          midY,
          labelText,
          accent,
          colors.foreground === accent ? "#0f172a" : "#ffffff",
          invZoom,
          "center"
        );
      }
    }
  }
}

export function renderCanvas2DSnapGuides(
  context: CanvasRenderingContext2D,
  guides: readonly Canvas2DSnapGuide[],
  zoom: number,
  colors: Canvas2DContentColors
): void {
  if (guides.length === 0) {
    return;
  }
  const safeZoom = Math.max(zoom, 1e-4);
  const lineWidth = 1 / safeZoom;
  const dash = 4 / safeZoom;
  const tick = 3 / safeZoom;

  context.save();
  context.strokeStyle = colors.accent || "#f43f5e";
  context.lineWidth = lineWidth;
  context.setLineDash([dash, dash]);

  for (let i = 0; i < guides.length; i += 1) {
    const guide = guides[i]!;
    context.beginPath();
    if (guide.axis === "x") {
      context.moveTo(guide.position, guide.from);
      context.lineTo(guide.position, guide.to);
    } else {
      context.moveTo(guide.from, guide.position);
      context.lineTo(guide.to, guide.position);
    }
    context.stroke();
  }

  context.setLineDash([]);
  for (let i = 0; i < guides.length; i += 1) {
    const guide = guides[i]!;
    context.beginPath();
    if (guide.axis === "x") {
      context.moveTo(guide.position - tick, guide.from);
      context.lineTo(guide.position + tick, guide.from);
      context.moveTo(guide.position - tick, guide.to);
      context.lineTo(guide.position + tick, guide.to);
    } else {
      context.moveTo(guide.from, guide.position - tick);
      context.lineTo(guide.from, guide.position + tick);
      context.moveTo(guide.to, guide.position - tick);
      context.lineTo(guide.to, guide.position + tick);
    }
    context.stroke();
  }

  context.restore();
}

export function renderCanvas2DScene(
  context: CanvasRenderingContext2D,
  scene: Canvas2DScene,
  sceneGraph: Canvas2DSceneGraph,
  preview: CanvasNodeTransformPreview | null,
  colors: Canvas2DContentColors,
  emphasis: Canvas2DEmphasis = CANVAS_2D_NO_EMPHASIS,
  spatialIndex?: Canvas2DSpatialIndex,
  visibleBounds?: Canvas2DRectBounds,
  imageCache?: Canvas2DImageCache
): number {
  if (spatialIndex && visibleBounds) {
    const candidates = spatialIndex.queryRect(visibleBounds, preview, sceneGraph);
    let drawnCount = 0;

    for (let i = 0; i < candidates.length; i += 1) {
      const entry = candidates[i]!;
      const node = entry.node;
      if (node.type === "html") {
        continue;
      }

      drawnCount += 1;
      if (node.type === "edge") {
        context.save();
        renderCanvas2DEdgeNode(
          context,
          node,
          scene,
          sceneGraph,
          colors,
          emphasis.selectedIds.has(node.id),
          emphasis.hoveredId === node.id
        );
        context.restore();
        continue;
      }

      if (entry.hasStyledAncestor) {
        context.save();
        const ancestors = getCanvas2DAncestors(node, sceneGraph);
        let ancestorVisible = true;
        let world = CANVAS_2D_IDENTITY_MATRIX;
        for (let a = ancestors.length - 1; a >= 0; a -= 1) {
          const ancestor = ancestors[a]!;
          if (ancestor.opacity <= 0) {
            ancestorVisible = false;
            break;
          }
          const local = createCanvas2DTransformMatrix(
            resolveNodeRenderTransform(ancestor, preview)
          );
          applyCanvas2DMatrix(context, local);
          world = multiplyCanvas2DMatrices(world, local);
          if (ancestor.opacity < 1) {
            context.globalAlpha *= ancestor.opacity;
          }
          if (ancestor.clip !== null) {
            const clipRadii = resolveClampedCornerRadii(
              ancestor.clip.width,
              ancestor.clip.height,
              ancestor.clip.cornerRadius
            );
            traceCanvas2DRoundedRectPath(
              context,
              ancestor.clip.x,
              ancestor.clip.y,
              ancestor.clip.width,
              ancestor.clip.height,
              clipRadii
            );
            context.clip();
          }
        }
        if (ancestorVisible) {
          renderCanvas2DDrawableNode(
            context,
            node,
            world,
            preview,
            colors,
            scene,
            sceneGraph,
            imageCache
          );
        }
        context.restore();
        continue;
      }

      const parentWorldTransform = resolveLiveParentWorldTransform(
        entry,
        sceneGraph,
        preview
      );
      const applyParent =
        !entry.isIdentityParent || (preview !== null && node.parentId !== null);
      if (applyParent) {
        context.save();
        applyCanvas2DMatrix(context, parentWorldTransform);
        renderCanvas2DDrawableNode(
          context,
          node,
          parentWorldTransform,
          preview,
          colors,
          scene,
          sceneGraph,
          imageCache
        );
        context.restore();
      } else {
        renderCanvas2DDrawableNode(
          context,
          node,
          parentWorldTransform,
          preview,
          colors,
          scene,
          sceneGraph,
          imageCache
        );
      }
    }

    return drawnCount;
  }

  for (const layer of scene.layers) {
    if (!layer.visible) {
      continue;
    }

    const roots = getCanvas2DLayerRoots(sceneGraph, layer.id);

    for (const root of roots) {
      renderCanvas2DTreeNode(
        context,
        root,
        scene,
        sceneGraph,
        CANVAS_2D_IDENTITY_MATRIX,
        preview,
        colors,
        emphasis,
        imageCache
      );
    }
  }

  return scene.nodes.length;
}
export function renderCanvas2DTreeNode(
  context: CanvasRenderingContext2D,
  node: Canvas2DNode,
  scene: Canvas2DScene,
  sceneGraph: Canvas2DSceneGraph,
  parentWorldTransform: Canvas2DMatrix,
  preview: CanvasNodeTransformPreview | null,
  colors: Canvas2DContentColors,
  emphasis: Canvas2DEmphasis = CANVAS_2D_NO_EMPHASIS,
  imageCache?: Canvas2DImageCache
) {
  if (!node.visible) {
    return;
  }

  if (node.type !== "group") {
    // Edges render in world (scene) coordinates; skip the accumulated group
    // transform for them so they follow endpoint nodes, not their parent group.
    if (node.type === "edge") {
      context.save();
      renderCanvas2DEdgeNode(
        context,
        node,
        scene,
        sceneGraph,
        colors,
        emphasis.selectedIds.has(node.id),
        emphasis.hoveredId === node.id
      );
      context.restore();
      return;
    }
    renderCanvas2DDrawableNode(
      context,
      node,
      parentWorldTransform,
      preview,
      colors,
      scene,
      sceneGraph,
      imageCache
    );
    return;
  }


  if (node.opacity <= 0) {
    return;
  }

  const localTransform = createCanvas2DTransformMatrix(
    resolveNodeRenderTransform(node, preview)
  );
  const worldTransform = multiplyCanvas2DMatrices(
    parentWorldTransform,
    localTransform
  );
  context.save();
  applyCanvas2DMatrix(context, localTransform);
  if (node.opacity < 1) {
    context.globalAlpha *= node.opacity;
  }
  if (node.clip !== null) {
    const clipRadii = resolveClampedCornerRadii(
      node.clip.width,
      node.clip.height,
      node.clip.cornerRadius
    );
    traceCanvas2DRoundedRectPath(
      context,
      node.clip.x,
      node.clip.y,
      node.clip.width,
      node.clip.height,
      clipRadii
    );
    context.clip();
  }

  for (const child of getCanvas2DGroupChildren(sceneGraph, node.id)) {
    renderCanvas2DTreeNode(
      context,
      child,
      scene,
      sceneGraph,
      worldTransform,
      preview,
      colors,
      emphasis,
      imageCache
    );
  }

  context.restore();
}
export function renderCanvas2DDrawableNode(
  context: CanvasRenderingContext2D,
  node: Canvas2DDrawableNode,
  parentWorldTransform: Canvas2DMatrix,
  preview: CanvasNodeTransformPreview | null,
  colors: Canvas2DContentColors,
  scene: Canvas2DScene,
  sceneGraph: Canvas2DSceneGraph,
  imageCache?: Canvas2DImageCache
) {
  switch (node.type) {
    case "rect":
    case "circle":
      renderCanvas2DShapeNode(context, node, preview);
      return;
    case "measurement":
      renderCanvas2DMeasurementNode(
        context,
        node,
        parentWorldTransform,
        colors
      );
      return;
    case "annotation":
      renderCanvas2DAnnotationNode(context, node, colors);
      return;
    case "edge":
      // Reached only via the authoring-preview path, which draws unemphasised.
      renderCanvas2DEdgeNode(
        context,
        node,
        scene,
        sceneGraph,
        colors,
        false,
        false
      );
      return;
    case "text":
      renderCanvas2DTextNode(context, node);
      return;
    case "html":
      // html nodes are rendered into the DOM overlay, not the bitmap canvas.
      return;
    default: {
      if (isDenovoImageNode(node)) {
        renderCanvas2DImageNode(context, node, preview, imageCache);
        return;
      }
      if (isDenovoSparklineNode(node)) {
        renderCanvas2DSparkline(context, node, preview);
        return;
      }
      if (isDenovoShadeNode(node)) {
        renderCanvas2DShade(context, node, preview);
        return;
      }
      if (isCanvas2DPluginNode(node)) {
        const draw2d = resolveHostPluginNodeDraw2d(node);
        if (draw2d) {
          const transform = resolveNodeRenderTransform(node, preview);
          context.save();
          applyCanvas2DMatrix(context, createCanvas2DTransformMatrix(transform));
          draw2d(context, node, preview);
          context.restore();
          return;
        }
        renderCanvas2DPluginMarker(context, node, preview);
        return;
      }
      const exhaustive: never = node;
      return exhaustive;
    }
  }
}

function renderCanvas2DImageNode(
  context: CanvasRenderingContext2D,
  node: Canvas2DPluginNode,
  preview: CanvasNodeTransformPreview | null,
  imageCache?: Canvas2DImageCache
) {
  if (!isDenovoImageNode(node)) {
    return;
  }

  const style = resolveDenovoImageStyle(node.props);
  if (style.opacity <= 0) {
    return;
  }

  const transform = resolveNodeRenderTransform(node, preview);
  const width = node.props.width;
  const height = node.props.height;
  const radii = resolveClampedCornerRadii(width, height, style.cornerRadius);
  const hasRadius = hasNonZeroCornerRadius(radii);
  const resolved = imageCache?.resolve(node.props) ?? null;

  context.save();
  if (style.opacity < 1) {
    context.globalAlpha *= style.opacity;
  }
  applyCanvas2DMatrix(context, createCanvas2DTransformMatrix(transform));

  if (resolved) {
    const drawRect = resolveDenovoImageDrawRect(
      resolved.naturalWidth,
      resolved.naturalHeight,
      width,
      height,
      style.fit
    );
    if (drawRect) {
      context.save();
      traceCanvas2DRoundedRectPath(context, 0, 0, width, height, radii);
      context.clip();
      if (style.fit === "contain" && !isTransparentFill(style.placeholder)) {
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
      context.restore();
    }
  } else if (!isTransparentFill(style.placeholder)) {
    if (hasRadius) {
      traceCanvas2DRoundedRectPath(context, 0, 0, width, height, radii);
      context.fillStyle = style.placeholder;
      context.fill();
    } else {
      context.fillStyle = style.placeholder;
      context.fillRect(0, 0, width, height);
    }
  }

  if (style.stroke !== null && style.strokeWidth > 0) {
    traceCanvas2DRoundedRectPath(context, 0, 0, width, height, radii);
    context.strokeStyle = style.stroke;
    context.lineWidth = style.strokeWidth;
    context.lineJoin = "round";
    context.stroke();
  }

  context.restore();
}
function renderCanvas2DPluginMarker(
  context: CanvasRenderingContext2D,
  node: Canvas2DPluginNode,
  preview: CanvasNodeTransformPreview | null
) {
  const transform = resolveNodeRenderTransform(node, preview);
  const [width, height] = resolveCanvas2DPluginNodeLocalSize(node);
  context.save();
  applyCanvas2DMatrix(context, createCanvas2DTransformMatrix(transform));
  context.fillStyle = PLUGIN_NODE_MARKER_FILL;
  context.fillRect(0, 0, width, height);
  context.restore();
}

function renderCanvas2DShade(
  context: CanvasRenderingContext2D,
  node: Canvas2DPluginNode,
  preview: CanvasNodeTransformPreview | null
) {
  if (!isDenovoShadeNode(node)) {
    return;
  }

  const transform = resolveNodeRenderTransform(node, preview);
  const [width, height] = resolveCanvas2DPluginNodeLocalSize(node);
  const elapsedMs = performance.now();
  context.save();
  applyCanvas2DMatrix(context, createCanvas2DTransformMatrix(transform));

  if (node.props.pattern === "gradient") {
    const [start, end] = denovoShadeGradientStops(node.props);
    const fill = context.createLinearGradient(0, 0, width, height);
    fill.addColorStop(0, start);
    fill.addColorStop(1, end);
    context.fillStyle = fill;
    context.fillRect(0, 0, width, height);
    context.restore();
    return;
  }

  const strips = denovoShadeStripCount(node.props);
  const stripWidth = width / strips;
  for (let index = 0; index < strips; index += 1) {
    context.fillStyle = denovoShadeStripColor(node.props, index, strips, elapsedMs);
    context.fillRect(index * stripWidth, 0, stripWidth + 1, height);
  }
  context.restore();
}

function renderCanvas2DSparkline(
  context: CanvasRenderingContext2D,
  node: Canvas2DPluginNode,
  preview: CanvasNodeTransformPreview | null
) {
  if (!isDenovoSparklineNode(node)) {
    return;
  }

  const transform = resolveNodeRenderTransform(node, preview);
  const points = denovoSparklinePoints(node.props);
  const first = points[0];
  const last = points[points.length - 1];

  if (!first || !last) {
    return;
  }

  context.save();
  applyCanvas2DMatrix(context, createCanvas2DTransformMatrix(transform));

  if (node.props.fill !== "none") {
    context.beginPath();
    context.moveTo(first[0], node.props.height);
    context.lineTo(first[0], first[1]);
    for (const point of points.slice(1)) {
      context.lineTo(point[0], point[1]);
    }
    context.lineTo(last[0], node.props.height);
    context.closePath();
    context.fillStyle = node.props.fill;
    context.fill();
  }

  context.beginPath();
  context.moveTo(first[0], first[1]);
  for (const point of points.slice(1)) {
    context.lineTo(point[0], point[1]);
  }
  context.strokeStyle = node.props.stroke;
  context.lineWidth = 2;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.stroke();
  context.restore();
}

export function renderCanvas2DShapeNode(
  context: CanvasRenderingContext2D,
  node: Canvas2DShapeNode,
  preview: CanvasNodeTransformPreview | null
) {
  if (node.opacity <= 0) {
    return;
  }

  const transform = resolveNodeRenderTransform(node, preview);
  const hasStroke = node.stroke !== null && node.strokeWidth > 0;
  const hasFill = !isTransparentFill(node.fill);
  context.save();
  if (node.opacity < 1) {
    context.globalAlpha *= node.opacity;
  }
  applyCanvas2DMatrix(context, createCanvas2DTransformMatrix(transform));

  switch (node.type) {
    case "rect": {
      const radii = resolveClampedCornerRadii(
        node.size[0],
        node.size[1],
        node.cornerRadius
      );
      if (!hasNonZeroCornerRadius(radii) && !hasStroke) {
        if (hasFill) {
          context.fillStyle = node.fill;
          context.fillRect(0, 0, node.size[0], node.size[1]);
        }
        break;
      }
      traceCanvas2DRoundedRectPath(
        context,
        0,
        0,
        node.size[0],
        node.size[1],
        radii
      );
      if (hasFill) {
        context.fillStyle = node.fill;
        context.fill();
      }
      if (hasStroke && node.stroke !== null) {
        context.strokeStyle = node.stroke;
        context.lineWidth = node.strokeWidth;
        context.lineJoin = "round";
        context.stroke();
      }
      break;
    }
    case "circle":
      context.beginPath();
      context.arc(0, 0, node.radius, 0, Math.PI * 2);
      if (hasFill) {
        context.fillStyle = node.fill;
        context.fill();
      }
      if (hasStroke && node.stroke !== null) {
        context.strokeStyle = node.stroke;
        context.lineWidth = node.strokeWidth;
        context.stroke();
      }
      break;
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }

  context.restore();
}
/**
 * Renders an edge in world (scene) coordinates. Endpoints are resolved from the
 * current source/target node centers via {@link resolveCanvas2DNodeWorldCenter},
 * so edges auto-follow endpoint moves. Callers MUST NOT apply a parent group
 * transform before calling this (edges ignore their own placement).
 */
export function renderCanvas2DEdgeNode(
  context: CanvasRenderingContext2D,
  node: Canvas2DEdgeNode,
  scene: Canvas2DScene,
  sceneGraph: Canvas2DSceneGraph,
  colors: Canvas2DContentColors,
  selected: boolean,
  hovered: boolean
): void {
  void scene;

  const { start, end, waypoints, control } = resolveCanvas2DEdgeGeometry(
    node,
    sceneGraph
  );

  // Selection recolours the edge; hover only thickens it, so a hovered edge
  // still reads as unselected.
  const stroke = selected ? colors.accent : node.stroke;
  const strokeWidth = selected
    ? node.strokeWidth + 2
    : hovered
      ? node.strokeWidth + 1
      : node.strokeWidth;

  context.save();
  context.strokeStyle = stroke;
  context.fillStyle = stroke;
  context.lineWidth = strokeWidth;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.setLineDash(
    node.lineStyle === "dashed"
      ? [12, 6]
      : node.lineStyle === "dotted"
        ? [2, 6]
        : []
  );

  context.beginPath();
  context.moveTo(start[0], start[1]);

  if (waypoints.length > 0) {
    for (const [wx, wy] of waypoints) {
      context.lineTo(wx, wy);
    }
  } else if (control) {
    context.quadraticCurveTo(control[0], control[1], end[0], end[1]);
  } else {
    context.lineTo(end[0], end[1]);
  }
  context.stroke();
  context.setLineDash([]);

  // Arrowheads point along the path's first/last segment, so they stay correct
  // for straight, curved and multi-segment orthogonal edges alike.
  if (node.sourceArrow) {
    const from = waypoints[0] ?? control ?? end;
    drawEdgeArrowhead(context, from[0], from[1], start[0], start[1], strokeWidth);
  }
  if (node.targetArrow) {
    const from =
      waypoints.length > 1
        ? waypoints[waypoints.length - 2]!
        : (control ?? start);
    drawEdgeArrowhead(context, from[0], from[1], end[0], end[1], strokeWidth);
  }

  context.restore();
}
export function drawEdgeArrowhead(
  context: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  strokeWidth: number
): void {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const size = Math.max(strokeWidth * 2.5, 6);
  const wing = Math.PI / 7;
  context.beginPath();
  context.moveTo(toX, toY);
  context.lineTo(
    toX + Math.cos(angle + Math.PI - wing) * size,
    toY + Math.sin(angle + Math.PI - wing) * size
  );
  context.lineTo(
    toX + Math.cos(angle + Math.PI + wing) * size,
    toY + Math.sin(angle + Math.PI + wing) * size
  );
  context.closePath();
  context.fill();
}
export function renderCanvas2DMeasurementNode(
  context: CanvasRenderingContext2D,
  node: Canvas2DMeasurementNode,
  parentWorldTransform: Canvas2DMatrix,
  colors: Canvas2DContentColors
) {
  const label = resolveCanvas2DMeasurementLabel(node, parentWorldTransform);
  const midpoint = getCanvas2DMidpoint(node.start, node.end);
  context.save();
  context.strokeStyle = colors.accent;
  context.fillStyle = colors.foreground;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(node.start[0], node.start[1]);
  context.lineTo(node.end[0], node.end[1]);
  context.stroke();
  context.font = CANVAS_2D_MEASUREMENT_FONT;
  context.textAlign = "center";
  context.textBaseline = "bottom";
  context.fillText(
    label,
    midpoint[0],
    midpoint[1] - CANVAS_2D_MEASUREMENT_LABEL_OFFSET
  );
  context.restore();
}
export function renderCanvas2DAnnotationNode(
  context: CanvasRenderingContext2D,
  node: Canvas2DAnnotationNode,
  colors: Canvas2DContentColors
) {
  context.save();
  context.fillStyle = colors.accent;
  context.beginPath();
  context.arc(
    node.anchor[0],
    node.anchor[1],
    CANVAS_2D_ANCHOR_RADIUS,
    0,
    Math.PI * 2
  );
  context.fill();
  context.fillStyle = colors.foreground;
  context.font = CANVAS_2D_ANNOTATION_FONT;
  context.textAlign = "left";
  context.textBaseline = "bottom";
  context.fillText(
    node.text,
    node.anchor[0] + CANVAS_2D_ANNOTATION_TEXT_OFFSET[0],
    node.anchor[1] + CANVAS_2D_ANNOTATION_TEXT_OFFSET[1]
  );
  context.restore();
}
export function renderCanvas2DTextNode(
  context: CanvasRenderingContext2D,
  node: Canvas2DTextNode
): void {
  const transform = createCanvas2DTransformMatrix({
    position: node.position,
    rotation: node.rotation,
    scale: node.scale
  });

  context.save();
  applyCanvas2DMatrix(context, transform);

  const font = `${node.fontWeight} ${node.fontSize}px ${node.fontFamily}`;
  context.font = font;
  context.fillStyle = node.fill;
  context.textBaseline = "top";

  const lines = wrapCanvas2DText(context, font, node.text, node.width);
  const lineHeight = node.fontSize * 1.2;

  lines.forEach((line, index) => {
    let drawX = 0;
    if (node.align === "center") {
      drawX = -(measureCanvas2DText(context, font, line) / 2);
    } else if (node.align === "right") {
      drawX = -measureCanvas2DText(context, font, line);
    }
    context.fillText(line, drawX, index * lineHeight);
  });

  context.restore();
}
export function renderCanvas2DConnectionHandles(
  context: CanvasRenderingContext2D,
  scene: Canvas2DScene,
  sceneGraph: Canvas2DSceneGraph,
  zoom: number,
  colors: Canvas2DContentColors
): void {
  const radius = CANVAS_2D_CONNECTION_HANDLE_RADIUS / zoom;

  context.save();
  context.fillStyle = colors.accent;
  context.strokeStyle = colors.foreground;
  context.lineWidth = 1.5 / zoom;

  for (const node of scene.nodes) {
    if (
      !isCanvas2DConnectableNode(node) ||
      !isNodeEffectivelyVisible(scene, sceneGraph, node) ||
      isNodeEffectivelyLocked(scene, sceneGraph, node)
    ) {
      continue;
    }

    const bounds = resolveCanvas2DNodeWorldBounds(node, sceneGraph);

    for (const side of CANVAS_NODE_PORT_SIDES) {
      const [x, y] = resolveCanvas2DConnectionHandlePoint(bounds, side);
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
  }

  context.restore();
}
