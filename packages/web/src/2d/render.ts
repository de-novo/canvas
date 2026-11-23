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
  isDenovoShadeNode,
  isDenovoSparklineNode,
  type Canvas2DGrid,
  type Canvas2DNode,
  type Canvas2DPluginNode,
  type Canvas2DScene,
  type CanvasAuthoringPreviewForMode,
  type CanvasNodeTransformHandleTarget,
  type CanvasNodeTransformPreview
} from "@denovo/canvas-core";

import {
  canvasToScenePoint,
  type Canvas2DRectBounds,
  type Canvas2DViewState
} from "../view2d";
import type { Canvas2DSnapGuide } from "./snap";
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
  colors: Canvas2DContentColors
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
          sceneGraph
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
  visibleBounds?: Canvas2DRectBounds
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
          sceneGraph
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
          sceneGraph
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
        emphasis
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
  emphasis: Canvas2DEmphasis = CANVAS_2D_NO_EMPHASIS
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
      sceneGraph
    );
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

  for (const child of getCanvas2DGroupChildren(sceneGraph, node.id)) {
    renderCanvas2DTreeNode(
      context,
      child,
      scene,
      sceneGraph,
      worldTransform,
      preview,
      colors,
      emphasis
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
  sceneGraph: Canvas2DSceneGraph
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
  const transform = resolveNodeRenderTransform(node, preview);
  context.save();
  applyCanvas2DMatrix(context, createCanvas2DTransformMatrix(transform));
  context.fillStyle = node.fill;

  switch (node.type) {
    case "rect":
      context.fillRect(0, 0, node.size[0], node.size[1]);
      break;
    case "circle":
      context.beginPath();
      context.arc(0, 0, node.radius, 0, Math.PI * 2);
      context.fill();
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
