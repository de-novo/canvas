export type Canvas2DViewState = Readonly<{
  /** Canvas-local CSS pixel occupied by the scene origin. */
  offset: readonly [number, number];
  /** Canvas-local CSS pixels per scene unit. */
  zoom: number;
}>;

export type Canvas2DViewStateInput = Readonly<{
  offset: readonly [number, number];
  zoom: number;
}>;

export const IDENTITY_CANVAS_2D_VIEW: Canvas2DViewState =
  defineCanvas2DViewState({
    offset: [0, 0],
    zoom: 1
  });

export function defineCanvas2DViewState(
  input: Canvas2DViewStateInput
): Canvas2DViewState {
  if (typeof input !== "object" || input === null) {
    throw new TypeError("Canvas2D view state must be an object.");
  }

  assertFinitePoint(input.offset, "Canvas2D view offset");

  if (!Number.isFinite(input.zoom) || input.zoom <= 0) {
    throw new TypeError("Canvas2D view zoom must be a finite positive number.");
  }

  return Object.freeze({
    offset: Object.freeze([input.offset[0], input.offset[1]]) as readonly [
      number,
      number
    ],
    zoom: input.zoom
  });
}

export function canvasToScenePoint(
  state: Canvas2DViewState,
  point: readonly [number, number]
): readonly [number, number] {
  assertCanvas2DViewState(state);
  assertFinitePoint(point, "Canvas2D canvas point");
  return Object.freeze([
    (point[0] - state.offset[0]) / state.zoom,
    (point[1] - state.offset[1]) / state.zoom
  ]) as readonly [number, number];
}

export function sceneToCanvasPoint(
  state: Canvas2DViewState,
  point: readonly [number, number]
): readonly [number, number] {
  assertCanvas2DViewState(state);
  assertFinitePoint(point, "Canvas2D scene point");
  return Object.freeze([
    point[0] * state.zoom + state.offset[0],
    point[1] * state.zoom + state.offset[1]
  ]) as readonly [number, number];
}

export function panCanvas2DView(
  state: Canvas2DViewState,
  delta: readonly [number, number]
): Canvas2DViewState {
  assertCanvas2DViewState(state);
  assertFinitePoint(delta, "Canvas2D pan delta");
  return defineCanvas2DViewState({
    offset: [state.offset[0] + delta[0], state.offset[1] + delta[1]],
    zoom: state.zoom
  });
}

export function zoomCanvas2DViewAt(
  state: Canvas2DViewState,
  zoom: number,
  anchor: readonly [number, number]
): Canvas2DViewState {
  assertCanvas2DViewState(state);
  assertFinitePoint(anchor, "Canvas2D zoom anchor");

  if (!Number.isFinite(zoom) || zoom <= 0) {
    throw new TypeError("Canvas2D view zoom must be a finite positive number.");
  }

  const ratio = zoom / state.zoom;
  return defineCanvas2DViewState({
    offset: [
      anchor[0] - (anchor[0] - state.offset[0]) * ratio,
      anchor[1] - (anchor[1] - state.offset[1]) * ratio
    ],
    zoom
  });
}

export type Canvas2DViewportSize = Readonly<{ width: number; height: number }>;
export type Canvas2DRectBounds = Readonly<{
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}>;

/**
 * Fits the view to the given scene-space bounds, leaving `padding` CSS pixels of
 * margin. Clamps zoom to [0.05, 8] so the result is always usable.
 */
export function fitCanvas2DView(
  state: Canvas2DViewState,
  viewport: Canvas2DViewportSize,
  bounds: Canvas2DRectBounds,
  padding: number
): Canvas2DViewState {
  assertCanvas2DViewState(state);

  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const zoom = Math.min(
    CANVAS_2D_MAX_ZOOM,
    Math.max(CANVAS_2D_MIN_ZOOM, Math.min(availableWidth / contentWidth, availableHeight / contentHeight))
  );

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return defineCanvas2DViewState({
    offset: [viewport.width / 2 - centerX * zoom, viewport.height / 2 - centerY * zoom],
    zoom
  });
}

/**
 * Moves the view so the given scene-space point sits at the viewport center.
 * Keeps the current zoom unless an explicit `zoom` is provided.
 */
export function flyCanvas2DViewTo(
  state: Canvas2DViewState,
  viewport: Canvas2DViewportSize,
  point: readonly [number, number],
  zoom?: number
): Canvas2DViewState {
  assertCanvas2DViewState(state);
  assertFinitePoint(point, "Canvas2D fly target");
  const targetZoom = zoom ?? state.zoom;
  return defineCanvas2DViewState({
    offset: [viewport.width / 2 - point[0] * targetZoom, viewport.height / 2 - point[1] * targetZoom],
    zoom: targetZoom
  });
}

/**
 * Returns the visible scene-space rectangle. Inverse of the per-frame
 * translate(offset)/scale(zoom) applied in the renderer.
 */
export function getCanvas2DVisibleBounds(
  state: Canvas2DViewState,
  viewport: Canvas2DViewportSize
): Canvas2DRectBounds {
  assertCanvas2DViewState(state);
  return {
    minX: -state.offset[0] / state.zoom,
    minY: -state.offset[1] / state.zoom,
    maxX: (viewport.width - state.offset[0]) / state.zoom,
    maxY: (viewport.height - state.offset[1]) / state.zoom
  };
}

/**
 * Smoothly animates the view state from `from` to `to` over `durationMs`,
 * invoking `onStep` with each intermediate state. Returns a `cancel` function.
 * Uses an ease-in-out curve and a self-scheduled rAF chain. The caller owns the
 * chain — it must invoke the returned cancel function on user-initiated navigation
 * (e.g. pointerdown) and on dispose.
 */
export function tweenCanvas2DView(
  from: Canvas2DViewState,
  to: Canvas2DViewState,
  viewport: Canvas2DViewportSize,
  onStep: (state: Canvas2DViewState) => void,
  durationMs = 350
): () => void {
  assertCanvas2DViewState(from);
  assertCanvas2DViewState(to);

  let cancelled = false;
  let startTime = 0;

  const fromOffsetX = from.offset[0];
  const fromOffsetY = from.offset[1];
  const fromZoom = from.zoom;
  const toOffsetX = to.offset[0];
  const toOffsetY = to.offset[1];
  const toZoom = to.zoom;

  const step = (time: number) => {
    if (cancelled) {
      return;
    }
    if (startTime === 0) {
      startTime = time;
    }
    const elapsed = time - startTime;
    const t = durationMs <= 0 ? 1 : Math.min(1, elapsed / durationMs);
    // ease-in-out cubic
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    onStep(
      defineCanvas2DViewState({
        offset: [
          fromOffsetX + (toOffsetX - fromOffsetX) * eased,
          fromOffsetY + (toOffsetY - fromOffsetY) * eased
        ],
        zoom: fromZoom + (toZoom - fromZoom) * eased
      })
    );

    if (t < 1) {
      requestAnimationFrame(step);
    }
  };

  requestAnimationFrame(step);

  return () => {
    cancelled = true;
  };
}

const CANVAS_2D_MIN_ZOOM = 0.05;
const CANVAS_2D_MAX_ZOOM = 8;

function assertCanvas2DViewState(state: Canvas2DViewState): void {
  if (typeof state !== "object" || state === null) {
    throw new TypeError("Canvas2D view state must be an object.");
  }

  assertFinitePoint(state.offset, "Canvas2D view offset");

  if (!Number.isFinite(state.zoom) || state.zoom <= 0) {
    throw new TypeError("Canvas2D view zoom must be a finite positive number.");
  }
}

function assertFinitePoint(
  point: readonly [number, number],
  label: string
): void {
  if (
    !Array.isArray(point) ||
    point.length !== 2 ||
    !Number.isFinite(point[0]) ||
    !Number.isFinite(point[1])
  ) {
    throw new TypeError(`${label} must be a two-item finite tuple.`);
  }
}
