/**
 * 2D wheel / trackpad classification.
 *
 * Browser `wheel` events mix mouse notches, two-finger scrolls, and pinch
 * (Chrome/Safari send pinch as ctrl+wheel). That decision is isolated here so
 * the runtime only applies a view update.
 */
import {
  panCanvas2DView,
  zoomCanvas2DViewAt,
  type Canvas2DViewState
} from "../view2d";

export const WHEEL_LINE_TO_PIXEL = 8;
export const WHEEL_PAGE_TO_PIXEL = 24;
/** Ignore sub-pixel axis noise when asking "does this event have X?" */
export const WHEEL_AXIS_EPS = 0.5;
/**
 * Pixel-mode mouse wheels typically jump 100 or 120. Trackpad ticks are
 * usually much smaller. Fast flicks are held by {@link Canvas2DWheelGesture}.
 */
export const WHEEL_MOUSE_PIXEL_NOTCH = 50;
/** Keep the first intent of a burst so a flick does not flip zoom/pan mid-stream. */
export const WHEEL_GESTURE_LOCK_MS = 120;

export type Canvas2DWheelIntent = "zoom" | "pan" | "ignore";

/** DOM-free wheel payload so classification can be unit-tested. */
export type Canvas2DWheelInput = {
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly deltaMode: number;
  readonly timeStamp?: number;
};

export type Canvas2DWheelNavigationLimits = {
  readonly enablePan: boolean;
  readonly enableZoom: boolean;
  readonly maxZoom: number;
  readonly minZoom: number;
  readonly wheelZoomSensitivity: number;
};

/**
 * Classifies one wheel event. Pinch/modifier zoom wins; trackpad pixel
 * streams pan; discrete mouse wheels zoom. Does not look at prior events.
 */
export function classifyCanvas2DWheelIntent(
  event: Canvas2DWheelInput
): Canvas2DWheelIntent {
  if (event.ctrlKey || event.metaKey) {
    return "zoom";
  }

  if (event.shiftKey) {
    return "pan";
  }

  // Line/page deltas are almost always a physical mouse wheel.
  if (event.deltaMode !== 0) {
    return "zoom";
  }

  const absX = Math.abs(event.deltaX);
  const absY = Math.abs(event.deltaY);

  if (absX <= WHEEL_AXIS_EPS && absY <= WHEEL_AXIS_EPS) {
    return "ignore";
  }

  // Any real horizontal component is a two-finger pan.
  if (absX > WHEEL_AXIS_EPS) {
    return "pan";
  }

  // Pure vertical pixel stream: small ticks are a trackpad, large notches
  // are a mouse wheel that reported pixels instead of lines.
  return absY < WHEEL_MOUSE_PIXEL_NOTCH ? "pan" : "zoom";
}

export function normalizeWheelDelta(delta: number, mode: number): number {
  if (mode === 1) {
    return delta * WHEEL_LINE_TO_PIXEL;
  }

  if (mode === 2) {
    return delta * WHEEL_PAGE_TO_PIXEL;
  }

  return delta;
}

/**
 * Locks the first non-ignore intent of a wheel burst. Pinch (ctrl/meta)
 * always breaks the lock back to zoom.
 */
export class Canvas2DWheelGesture {
  private locked: Exclude<Canvas2DWheelIntent, "ignore"> | null = null;
  private lastAt = 0;

  classify(event: Canvas2DWheelInput): Canvas2DWheelIntent {
    const instant = classifyCanvas2DWheelIntent(event);
    const now = event.timeStamp ?? 0;

    if (instant === "zoom" && (event.ctrlKey || event.metaKey)) {
      this.locked = "zoom";
      this.lastAt = now;
      return "zoom";
    }

    if (
      this.locked !== null &&
      now - this.lastAt < WHEEL_GESTURE_LOCK_MS
    ) {
      this.lastAt = now;
      return this.locked;
    }

    if (instant !== "ignore") {
      this.locked = instant;
      this.lastAt = now;
    }

    return instant;
  }

  reset(): void {
    this.locked = null;
    this.lastAt = 0;
  }
}

export type Canvas2DWheelApplication = {
  readonly consumed: boolean;
  readonly view: Canvas2DViewState;
};

/**
 * Applies a classified wheel event to a view. Returns `consumed: false` when
 * the matching capability is off, so the runtime must not preventDefault.
 */
export function applyCanvas2DWheelNavigation(
  view: Canvas2DViewState,
  event: Canvas2DWheelInput,
  intent: Canvas2DWheelIntent,
  limits: Canvas2DWheelNavigationLimits,
  cursor: readonly [number, number]
): Canvas2DWheelApplication {
  if (intent === "ignore") {
    return { consumed: false, view };
  }

  if (intent === "pan") {
    if (!limits.enablePan) {
      return { consumed: false, view };
    }

    const dx = normalizeWheelDelta(event.deltaX, event.deltaMode);
    const dy = normalizeWheelDelta(event.deltaY, event.deltaMode);
    const next =
      event.shiftKey && Math.abs(dx) <= WHEEL_AXIS_EPS
        ? panCanvas2DView(view, [-dy, 0])
        : panCanvas2DView(view, [-dx, -dy]);
    return { consumed: true, view: next };
  }

  if (!limits.enableZoom) {
    return { consumed: false, view };
  }

  const factor = Math.exp(
    -normalizeWheelDelta(event.deltaY, event.deltaMode) *
      limits.wheelZoomSensitivity
  );
  const zoom = Math.min(
    limits.maxZoom,
    Math.max(limits.minZoom, view.zoom * factor)
  );
  return {
    consumed: true,
    view: zoomCanvas2DViewAt(view, zoom, cursor)
  };
}
