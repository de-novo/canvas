import type { Canvas2DRectBounds } from "../view2d";

export type Canvas2DBoxEdges = {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
};

export type Canvas2DBoxModelColors = {
  readonly margin?: string;
  readonly border?: string;
  readonly padding?: string;
  readonly content?: string;
  readonly labelBackground?: string;
  readonly labelForeground?: string;
};

/**
 * Ephemeral DevTools-style CSS/UI box-model inspection overlay in scene
 * coordinates. `bounds` is the border-box (matching DOM `getBoundingClientRect`
 * and platform-neutral `RenderNodeSnapshot` bounds); `margin` expands outward
 * and `border` / `padding` inset inward.
 */
export type Canvas2DBoxModelOverlay = {
  readonly bounds: Canvas2DRectBounds;
  readonly margin?: Canvas2DBoxEdges;
  readonly border?: Canvas2DBoxEdges;
  readonly padding?: Canvas2DBoxEdges;
  readonly label?: string;
  readonly colors?: Canvas2DBoxModelColors;
};

export type Canvas2DRedlineExtension = {
  readonly start: readonly [number, number];
  readonly end: readonly [number, number];
};

/**
 * Ephemeral spacing/distance measurement redline rendered over the 2D canvas
 * without mutating the document or undo history.
 */
export type Canvas2DRedlineOverlay = {
  readonly start: readonly [number, number];
  readonly end: readonly [number, number];
  readonly label?: string;
  readonly color?: string;
  readonly extensions?: readonly Canvas2DRedlineExtension[];
};

export type Canvas2DRedlineOptions = {
  readonly color?: string;
  readonly formatDistance?: (distance: number) => string;
  readonly unit?: string;
  readonly includeZero?: boolean;
};

export type Canvas2DInspectionOverlay = {
  readonly boxModels?: readonly Canvas2DBoxModelOverlay[];
  readonly redlines?: readonly Canvas2DRedlineOverlay[];
};

export type Canvas2DBoxModelRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type ResolvedCanvas2DBoxModelRegions = {
  readonly marginBox: Canvas2DRectBounds;
  readonly borderBox: Canvas2DRectBounds;
  readonly paddingBox: Canvas2DRectBounds;
  readonly contentBox: Canvas2DRectBounds;
  readonly marginStrips: readonly Canvas2DBoxModelRect[];
  readonly borderStrips: readonly Canvas2DBoxModelRect[];
  readonly paddingStrips: readonly Canvas2DBoxModelRect[];
  readonly contentRect: Canvas2DBoxModelRect | null;
};

export const DEFAULT_BOX_MODEL_COLORS: Required<Canvas2DBoxModelColors> = {
  margin: "#f97316",
  border: "#eab308",
  padding: "#22c55e",
  content: "#38bdf8",
  labelBackground: "#0f172a",
  labelForeground: "#f8fafc"
};

export const DEFAULT_REDLINE_COLOR = "#f43f5e";

const ZERO_EDGES: Canvas2DBoxEdges = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0
};

const DISTANCE_EPSILON = 1e-4;

function clampNonNegative(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

function normalizeBoxEdges(
  edges: Canvas2DBoxEdges | undefined
): Canvas2DBoxEdges {
  if (!edges) {
    return ZERO_EDGES;
  }
  return {
    top: clampNonNegative(edges.top),
    right: clampNonNegative(edges.right),
    bottom: clampNonNegative(edges.bottom),
    left: clampNonNegative(edges.left)
  };
}

function normalizeRectBounds(bounds: Canvas2DRectBounds): Canvas2DRectBounds {
  return {
    minX: Math.min(bounds.minX, bounds.maxX),
    minY: Math.min(bounds.minY, bounds.maxY),
    maxX: Math.max(bounds.minX, bounds.maxX),
    maxY: Math.max(bounds.minY, bounds.maxY)
  };
}

function insetRectBounds(
  outer: Canvas2DRectBounds,
  edges: Canvas2DBoxEdges
): Canvas2DRectBounds {
  const width = Math.max(0, outer.maxX - outer.minX);
  const height = Math.max(0, outer.maxY - outer.minY);
  const horizontal = edges.left + edges.right;
  const vertical = edges.top + edges.bottom;
  const hScale = horizontal > width && horizontal > 0 ? width / horizontal : 1;
  const vScale = vertical > height && vertical > 0 ? height / vertical : 1;

  return {
    minX: outer.minX + edges.left * hScale,
    minY: outer.minY + edges.top * vScale,
    maxX: outer.maxX - edges.right * hScale,
    maxY: outer.maxY - edges.bottom * vScale
  };
}

function ringStrips(
  outer: Canvas2DRectBounds,
  inner: Canvas2DRectBounds
): Canvas2DBoxModelRect[] {
  const strips: Canvas2DBoxModelRect[] = [];
  const outerWidth = outer.maxX - outer.minX;
  const innerHeight = inner.maxY - inner.minY;

  const topHeight = inner.minY - outer.minY;
  if (outerWidth > DISTANCE_EPSILON && topHeight > DISTANCE_EPSILON) {
    strips.push({
      x: outer.minX,
      y: outer.minY,
      width: outerWidth,
      height: topHeight
    });
  }

  const bottomHeight = outer.maxY - inner.maxY;
  if (outerWidth > DISTANCE_EPSILON && bottomHeight > DISTANCE_EPSILON) {
    strips.push({
      x: outer.minX,
      y: inner.maxY,
      width: outerWidth,
      height: bottomHeight
    });
  }

  const leftWidth = inner.minX - outer.minX;
  if (leftWidth > DISTANCE_EPSILON && innerHeight > DISTANCE_EPSILON) {
    strips.push({
      x: outer.minX,
      y: inner.minY,
      width: leftWidth,
      height: innerHeight
    });
  }

  const rightWidth = outer.maxX - inner.maxX;
  if (rightWidth > DISTANCE_EPSILON && innerHeight > DISTANCE_EPSILON) {
    strips.push({
      x: inner.maxX,
      y: inner.minY,
      width: rightWidth,
      height: innerHeight
    });
  }

  return strips;
}

/**
 * Resolves a {@link Canvas2DBoxModelOverlay} into non-overlapping margin,
 * border, padding, and content strips so Canvas2D and 2D WebGPU render
 * identical alpha-blended bands with zero double-fill overlap.
 */
export function resolveCanvas2DBoxModelRegions(
  overlay: Canvas2DBoxModelOverlay
): ResolvedCanvas2DBoxModelRegions {
  const borderBox = normalizeRectBounds(overlay.bounds);
  const margin = normalizeBoxEdges(overlay.margin);
  const border = normalizeBoxEdges(overlay.border);
  const padding = normalizeBoxEdges(overlay.padding);

  const marginBox: Canvas2DRectBounds = {
    minX: borderBox.minX - margin.left,
    minY: borderBox.minY - margin.top,
    maxX: borderBox.maxX + margin.right,
    maxY: borderBox.maxY + margin.bottom
  };
  const paddingBox = insetRectBounds(borderBox, border);
  const contentBox = insetRectBounds(paddingBox, padding);
  const contentWidth = contentBox.maxX - contentBox.minX;
  const contentHeight = contentBox.maxY - contentBox.minY;

  return {
    marginBox,
    borderBox,
    paddingBox,
    contentBox,
    marginStrips: ringStrips(marginBox, borderBox),
    borderStrips: ringStrips(borderBox, paddingBox),
    paddingStrips: ringStrips(paddingBox, contentBox),
    contentRect:
      contentWidth > DISTANCE_EPSILON && contentHeight > DISTANCE_EPSILON
        ? {
            x: contentBox.minX,
            y: contentBox.minY,
            width: contentWidth,
            height: contentHeight
          }
        : null
  };
}

export function formatCanvas2DRedlineDistance(
  distance: number,
  unit?: string
): string {
  const rounded = Math.round(distance * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return unit ? `${text}${unit}` : text;
}

function isRectContainedIn(
  inner: Canvas2DRectBounds,
  outer: Canvas2DRectBounds
): boolean {
  return (
    inner.minX >= outer.minX - DISTANCE_EPSILON &&
    inner.maxX <= outer.maxX + DISTANCE_EPSILON &&
    inner.minY >= outer.minY - DISTANCE_EPSILON &&
    inner.maxY <= outer.maxY + DISTANCE_EPSILON
  );
}

/**
 * Pure spacing/inset redline solver between two scene-space boxes (Figma
 * Alt-hover / UI inspector style).
 *
 * - Contained boxes emit up to four inset redlines (top, right, bottom, left).
 * - Horizontally or vertically separated boxes emit gap redlines plus dashed
 *   perpendicular alignment extension lines when diagonally offset.
 * - Partially overlapping boxes emit non-zero edge-to-edge clearance offsets.
 */
export function computeCanvas2DRedlines(
  sourceBounds: Canvas2DRectBounds,
  targetBounds: Canvas2DRectBounds,
  options: Canvas2DRedlineOptions = {}
): readonly Canvas2DRedlineOverlay[] {
  const source = normalizeRectBounds(sourceBounds);
  const target = normalizeRectBounds(targetBounds);
  const color = options.color ?? DEFAULT_REDLINE_COLOR;
  const includeZero = options.includeZero ?? false;
  const format =
    options.formatDistance ??
    ((distance: number) => formatCanvas2DRedlineDistance(distance, options.unit));

  const redlines: Canvas2DRedlineOverlay[] = [];

  function pushRedline(
    start: readonly [number, number],
    end: readonly [number, number],
    distance: number,
    extensions?: readonly Canvas2DRedlineExtension[]
  ) {
    if (!includeZero && distance <= DISTANCE_EPSILON) {
      return;
    }
    redlines.push({
      start,
      end,
      label: format(Math.max(0, distance)),
      color,
      ...(extensions && extensions.length > 0 ? { extensions } : {})
    });
  }

  const sourceInTarget = isRectContainedIn(source, target);
  const targetInSource = isRectContainedIn(target, source);

  if (sourceInTarget || targetInSource) {
    const inner = sourceInTarget ? source : target;
    const outer = sourceInTarget ? target : source;
    const cx = (inner.minX + inner.maxX) / 2;
    const cy = (inner.minY + inner.maxY) / 2;

    pushRedline([cx, outer.minY], [cx, inner.minY], inner.minY - outer.minY);
    pushRedline([inner.maxX, cy], [outer.maxX, cy], outer.maxX - inner.maxX);
    pushRedline([cx, inner.maxY], [cx, outer.maxY], outer.maxY - inner.maxY);
    pushRedline([outer.minX, cy], [inner.minX, cy], inner.minX - outer.minX);
    return redlines;
  }

  const sourceCx = (source.minX + source.maxX) / 2;
  const sourceCy = (source.minY + source.maxY) / 2;

  let separated = false;

  if (source.maxX < target.minX - DISTANCE_EPSILON) {
    separated = true;
    const gap = target.minX - source.maxX;
    const overlapMinY = Math.max(source.minY, target.minY);
    const overlapMaxY = Math.min(source.maxY, target.maxY);
    if (overlapMaxY >= overlapMinY) {
      const y = (overlapMinY + overlapMaxY) / 2;
      pushRedline([source.maxX, y], [target.minX, y], gap);
    } else {
      const y = sourceCy;
      const targetNearestY = y < target.minY ? target.minY : target.maxY;
      pushRedline([source.maxX, y], [target.minX, y], gap, [
        { start: [target.minX, y], end: [target.minX, targetNearestY] }
      ]);
    }
  } else if (target.maxX < source.minX - DISTANCE_EPSILON) {
    separated = true;
    const gap = source.minX - target.maxX;
    const overlapMinY = Math.max(source.minY, target.minY);
    const overlapMaxY = Math.min(source.maxY, target.maxY);
    if (overlapMaxY >= overlapMinY) {
      const y = (overlapMinY + overlapMaxY) / 2;
      pushRedline([target.maxX, y], [source.minX, y], gap);
    } else {
      const y = sourceCy;
      const targetNearestY = y < target.minY ? target.minY : target.maxY;
      pushRedline([target.maxX, y], [source.minX, y], gap, [
        { start: [target.maxX, y], end: [target.maxX, targetNearestY] }
      ]);
    }
  }

  if (source.maxY < target.minY - DISTANCE_EPSILON) {
    separated = true;
    const gap = target.minY - source.maxY;
    const overlapMinX = Math.max(source.minX, target.minX);
    const overlapMaxX = Math.min(source.maxX, target.maxX);
    if (overlapMaxX >= overlapMinX) {
      const x = (overlapMinX + overlapMaxX) / 2;
      pushRedline([x, source.maxY], [x, target.minY], gap);
    } else {
      const x = sourceCx;
      const targetNearestX = x < target.minX ? target.minX : target.maxX;
      pushRedline([x, source.maxY], [x, target.minY], gap, [
        { start: [x, target.minY], end: [targetNearestX, target.minY] }
      ]);
    }
  } else if (target.maxY < source.minY - DISTANCE_EPSILON) {
    separated = true;
    const gap = source.minY - target.maxY;
    const overlapMinX = Math.max(source.minX, target.minX);
    const overlapMaxX = Math.min(source.maxX, target.maxX);
    if (overlapMaxX >= overlapMinX) {
      const x = (overlapMinX + overlapMaxX) / 2;
      pushRedline([x, target.maxY], [x, source.minY], gap);
    } else {
      const x = sourceCx;
      const targetNearestX = x < target.minX ? target.minX : target.maxX;
      pushRedline([x, target.maxY], [x, source.minY], gap, [
        { start: [x, target.maxY], end: [targetNearestX, target.maxY] }
      ]);
    }
  }

  if (!separated) {
    const leftDelta = Math.abs(source.minX - target.minX);
    if (leftDelta > DISTANCE_EPSILON) {
      pushRedline(
        [Math.min(source.minX, target.minX), sourceCy],
        [Math.max(source.minX, target.minX), sourceCy],
        leftDelta
      );
    }
    const rightDelta = Math.abs(source.maxX - target.maxX);
    if (rightDelta > DISTANCE_EPSILON) {
      pushRedline(
        [Math.min(source.maxX, target.maxX), sourceCy],
        [Math.max(source.maxX, target.maxX), sourceCy],
        rightDelta
      );
    }
    const topDelta = Math.abs(source.minY - target.minY);
    if (topDelta > DISTANCE_EPSILON) {
      pushRedline(
        [sourceCx, Math.min(source.minY, target.minY)],
        [sourceCx, Math.max(source.minY, target.minY)],
        topDelta
      );
    }
    const bottomDelta = Math.abs(source.maxY - target.maxY);
    if (bottomDelta > DISTANCE_EPSILON) {
      pushRedline(
        [sourceCx, Math.min(source.maxY, target.maxY)],
        [sourceCx, Math.max(source.maxY, target.maxY)],
        bottomDelta
      );
    }
  }

  return redlines;
}
