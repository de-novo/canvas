import type {
  Canvas3DSurfacePointRuntime,
  CanvasHitResult,
  CanvasHitTestInput,
  CanvasCommandResult,
  CanvasNodeTransformInput,
  CanvasNodeTransformPreview,
  CanvasSelectionMode,
  CanvasToolKeyInput,
  CanvasToolPointerInput,
  CanvasToolPointerType,
  Point2
} from "@denovo/canvas-core";
import type {
  CanvasAuthoringRuntime,
  CanvasHitSelectionTarget,
  CanvasHitTestRuntime,
  CanvasNodeTransformRuntime,
  CanvasPointerSelectionOptions,
  CanvasRuntimeChangeRuntime,
  CanvasToolInputTarget
} from "./types";

type CanvasInputTarget = CanvasHitSelectionTarget &
  Partial<CanvasToolInputTarget>;

type PointerSession = {
  readonly canvas: HTMLCanvasElement;
  readonly origin: Point2;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly thresholdSquared: number;
  lastInput?: CanvasToolPointerInput;
  lastPoint: Point2;
  moved: boolean;
};

type PendingHover = {
  readonly canvas: HTMLCanvasElement;
  readonly hitInput: CanvasHitTestInput;
  readonly toolInput: CanvasToolPointerInput;
};

type CanvasInputActionResult = CanvasCommandResult | boolean | null | void;

type ActiveToolTarget =
  | { readonly status: "active"; readonly target: CanvasToolInputTarget }
  | { readonly status: "failed" }
  | { readonly status: "inactive" };

export function connectCanvasSelection(
  runtime: CanvasHitTestRuntime &
    Partial<CanvasNodeTransformRuntime> &
    Partial<CanvasAuthoringRuntime> &
    Partial<Canvas3DSurfacePointRuntime> &
    Partial<CanvasRuntimeChangeRuntime>,
  target: CanvasInputTarget,
  options: CanvasPointerSelectionOptions = {}
): () => void {
  const mouseThreshold = resolveMovementThreshold(
    options.mouseMovementThreshold,
    4,
    "mouseMovementThreshold"
  );
  const touchThreshold = resolveMovementThreshold(
    options.touchMovementThreshold,
    8,
    "touchMovementThreshold"
  );
  const eventTarget =
    options.eventTarget ?? runtime.canvas.parentElement ?? runtime.canvas;
  const previousTouchAction = eventTarget.style.touchAction;
  eventTarget.style.touchAction = "none";
  let hoverFrameId: number | null = null;
  let pendingHover: PendingHover | undefined;
  let session: PointerSession | null = null;
  let unsubscribeRuntimeChange: (() => void) | null = null;
  const toolRuntime = createStableToolRuntime(runtime);

  function isCurrentCanvasEvent(event: PointerEvent): boolean {
    const canvas = runtime.canvas;
    return event.target === canvas || event.composedPath().includes(canvas);
  }

  function getPoint(
    event: Pick<PointerEvent, "clientX" | "clientY">,
    canvas: HTMLCanvasElement = runtime.canvas
  ): Point2 {
    const rect = canvas.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }

  function getInput(event: PointerEvent): CanvasHitTestInput {
    return { point: getPoint(event) };
  }

  function report(error: unknown) {
    if (options.onError) {
      try {
        options.onError(error);
        return;
      } catch (reporterError) {
        setTimeout(() => {
          throw reporterError;
        });
        return;
      }
    }

    setTimeout(() => {
      throw error;
    });
  }

  function runTarget(
    action: () => CanvasInputActionResult | Promise<CanvasInputActionResult>
  ) {
    try {
      void Promise.resolve(action()).catch(report);
    } catch (error) {
      report(error);
    }
  }

  function getActiveToolTarget(): ActiveToolTarget {
    if (
      typeof target.getActiveTool !== "function" ||
      typeof target.handleToolInput !== "function" ||
      typeof target.cancelActiveToolSession !== "function"
    ) {
      return { status: "inactive" };
    }

    try {
      return target.getActiveTool()
        ? { status: "active", target: target as CanvasToolInputTarget }
        : { status: "inactive" };
    } catch (error) {
      report(error);
      return { status: "failed" };
    }
  }

  function runToolInput(
    input: CanvasToolPointerInput | CanvasToolKeyInput
  ): boolean {
    const activeTool = getActiveToolTarget();

    if (activeTool.status === "inactive") {
      return false;
    }

    if (activeTool.status === "failed") {
      return true;
    }

    runTarget(() =>
      activeTool.target.handleToolInput(input, toolRuntime)
    );
    return true;
  }

  function scheduleHover(event: PointerEvent, toolInput: CanvasToolPointerInput) {
    const activeTool = getActiveToolTarget();

    if (activeTool.status === "failed") {
      return;
    }

    if (
      activeTool.status === "inactive" &&
      (options.hover === false || !target.hoverFromHit)
    ) {
      return;
    }

    pendingHover = {
      canvas: runtime.canvas,
      hitInput: getInput(event),
      toolInput
    };

    if (hoverFrameId !== null) {
      return;
    }

    hoverFrameId = requestAnimationFrame(() => {
      hoverFrameId = null;
      const pending = pendingHover;
      pendingHover = undefined;

      if (!pending || pending.canvas !== runtime.canvas) {
        return;
      }

      if (runToolInput(pending.toolInput)) {
        return;
      }

      if (options.hover === false || !target.hoverFromHit) {
        return;
      }

      let hit: CanvasHitResult;

      try {
        hit = runtime.hitTest(pending.hitInput);
      } catch (error) {
        report(error);
        return;
      }

      runTarget(() => target.hoverFromHit?.(hit));
    });
  }

  function releasePointerCapture(active: PointerSession) {
    try {
      if (active.canvas.hasPointerCapture(active.pointerId)) {
        active.canvas.releasePointerCapture(active.pointerId);
      }
    } catch {
      // The renderer may have replaced or released the canvas capture already.
    }
  }

  function cancelToolSession() {
    const active = session;
    const activeTool = getActiveToolTarget();

    if (activeTool.status === "active") {
      runTarget(() => activeTool.target.cancelActiveToolSession());
    }

    session = null;

    if (active) {
      releasePointerCapture(active);
    }
  }

  function handleRuntimeChange() {
    pendingHover = undefined;

    if (hoverFrameId !== null) {
      cancelAnimationFrame(hoverFrameId);
      hoverFrameId = null;
    }

    cancelToolSession();
    runTarget(() =>
      target.hoverFromHit?.({ kind: "empty", renderer: "web-input" })
    );
  }

  function updateMovement(event: PointerEvent, active: PointerSession) {
    const deltaX = event.clientX - active.startX;
    const deltaY = event.clientY - active.startY;
    active.moved ||=
      deltaX * deltaX + deltaY * deltaY > active.thresholdSquared;
  }

  function createPointerInput(
    event: PointerEvent,
    type: CanvasToolPointerInput["type"],
    active: PointerSession | null
  ): CanvasToolPointerInput {
    const point = getPoint(event, active?.canvas ?? runtime.canvas);
    const origin = active?.origin ?? point;
    const previousPoint = active?.lastPoint ?? point;

    return {
      altKey: event.altKey,
      button: event.button,
      buttons: event.buttons,
      ctrlKey: event.ctrlKey,
      delta: [point[0] - previousPoint[0], point[1] - previousPoint[1]],
      dragging: active?.moved ?? false,
      isPrimary: event.isPrimary,
      metaKey: event.metaKey,
      origin,
      point,
      pointerId: Math.max(0, Math.trunc(event.pointerId)),
      pointerType: normalizePointerType(event.pointerType),
      pressure: normalizePressure(event.pressure),
      shiftKey: event.shiftKey,
      type
    };
  }

  function createKeyInput(
    event: KeyboardEvent,
    type: CanvasToolKeyInput["type"]
  ): CanvasToolKeyInput {
    return {
      altKey: event.altKey,
      code: event.code,
      ctrlKey: event.ctrlKey,
      key: event.key,
      metaKey: event.metaKey,
      repeat: event.repeat,
      shiftKey: event.shiftKey,
      type
    };
  }

  function handlePointerDown(event: PointerEvent) {
    if (!isCurrentCanvasEvent(event)) {
      return;
    }

    if (session && session.pointerId !== event.pointerId) {
      cancelToolSession();
    }

    if (!event.isPrimary || event.button !== 0 || session) {
      return;
    }

    const threshold = event.pointerType === "touch" ? touchThreshold : mouseThreshold;
    const canvas = runtime.canvas;
    const origin = getPoint(event, canvas);
    session = {
      canvas,
      lastPoint: origin,
      moved: false,
      origin,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      thresholdSquared: threshold * threshold
    };

    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is an optimization; the stable host still receives bubbles.
    }

    const input = createPointerInput(event, "pointer.down", session);
    session.lastInput = input;
    runToolInput(input);
  }

  function handlePointerMove(event: PointerEvent) {
    if (!isCurrentCanvasEvent(event)) {
      return;
    }

    const active = session?.pointerId === event.pointerId ? session : null;

    if (active) {
      updateMovement(event, active);
    }

    const input = createPointerInput(event, "pointer.move", active);

    if (active) {
      active.lastPoint = input.point;
      active.lastInput = input;
    }

    if (event.buttons === 0) {
      scheduleHover(event, input);
      return;
    }

    runToolInput(input);
  }

  function handlePointerUp(event: PointerEvent) {
    if (!isCurrentCanvasEvent(event) || session?.pointerId !== event.pointerId) {
      return;
    }

    const active = session;
    updateMovement(event, active);
    const toolInput = createPointerInput(event, "pointer.up", active);
    session = null;
    releasePointerCapture(active);

    if (runToolInput(toolInput)) {
      return;
    }

    if (active.moved) {
      return;
    }

    let hit: CanvasHitResult;

    try {
      hit = runtime.hitTest(getInput(event));
    } catch (error) {
      report(error);
      return;
    }

    const mode = options.resolveSelectionMode
      ? options.resolveSelectionMode(event)
      : getDefaultSelectionMode(event);
    runTarget(() => target.selectFromHit(hit, mode));
  }

  function handlePointerCancel(event: PointerEvent) {
    if (session?.pointerId !== event.pointerId) {
      return;
    }

    const active = session;
    updateMovement(event, active);
    const input = createPointerInput(event, "pointer.cancel", active);
    cancelToolSession();
    runToolInput(input);
  }

  function handleLostPointerCapture(event: PointerEvent) {
    if (session?.pointerId !== event.pointerId) {
      return;
    }

    const active = session;
    updateMovement(event, active);
    const input = createPointerInput(event, "pointer.cancel", active);
    cancelToolSession();
    runToolInput(input);
  }

  function handlePointerLeave(event: PointerEvent) {
    const active = session?.pointerId === event.pointerId ? session : null;
    const input = createPointerInput(event, "pointer.leave", active);

    if (active) {
      cancelToolSession();
    }

    const handled = runToolInput(input);

    if (handled) {
      return;
    }

    if (options.hover === false || !target.hoverFromHit) {
      return;
    }

    runTarget(() =>
      target.hoverFromHit?.({
        kind: "empty",
        renderer: "web-input"
      })
    );
  }

  function handleKeyDown(event: KeyboardEvent) {
    // History shortcuts are owned by the editor, not the active tool, so they
    // are intercepted before the input reaches the tool layer.
    if ((event.metaKey || event.ctrlKey) && !event.altKey) {
      const key = event.key.toLowerCase();

      if (key === "z" && typeof target.undo === "function" && !event.shiftKey) {
        event.preventDefault();
        target.undo();
        return;
      }

      if (
        typeof target.redo === "function" &&
        ((key === "z" && event.shiftKey) || key === "y")
      ) {
        event.preventDefault();
        target.redo();
        return;
      }

      if (key === "c" && typeof target.copySelection === "function") {
        event.preventDefault();
        target.copySelection();
        return;
      }

      if (
        key === "v" &&
        typeof target.pasteClipboard === "function" &&
        options.createId !== undefined
      ) {
        event.preventDefault();
        target.pasteClipboard(options.createId);
        return;
      }
    }

    runToolInput(createKeyInput(event, "key.down"));
  }

  function handleKeyUp(event: KeyboardEvent) {
    runToolInput(createKeyInput(event, "key.up"));
  }

  eventTarget.addEventListener("pointerdown", handlePointerDown);
  eventTarget.addEventListener("pointermove", handlePointerMove);
  eventTarget.addEventListener("pointerup", handlePointerUp);
  eventTarget.addEventListener("pointercancel", handlePointerCancel);
  eventTarget.addEventListener("lostpointercapture", handleLostPointerCapture);
  eventTarget.addEventListener("pointerleave", handlePointerLeave);

  if (typeof runtime.subscribeRuntimeChange === "function") {
    unsubscribeRuntimeChange = runtime.subscribeRuntimeChange(handleRuntimeChange);
  }

  if (options.keyboard !== false) {
    eventTarget.addEventListener("keydown", handleKeyDown);
    eventTarget.addEventListener("keyup", handleKeyUp);
  }

  return () => {
    unsubscribeRuntimeChange?.();
    unsubscribeRuntimeChange = null;
    cancelToolSession();
    pendingHover = undefined;

    if (hoverFrameId !== null) {
      cancelAnimationFrame(hoverFrameId);
      hoverFrameId = null;
    }

    eventTarget.removeEventListener("pointerdown", handlePointerDown);
    eventTarget.removeEventListener("pointermove", handlePointerMove);
    eventTarget.removeEventListener("pointerup", handlePointerUp);
    eventTarget.removeEventListener("pointercancel", handlePointerCancel);
    eventTarget.removeEventListener("lostpointercapture", handleLostPointerCapture);
    eventTarget.removeEventListener("pointerleave", handlePointerLeave);
    eventTarget.removeEventListener("keydown", handleKeyDown);
    eventTarget.removeEventListener("keyup", handleKeyUp);

    if (eventTarget.style.touchAction === "none") {
      eventTarget.style.touchAction = previousTouchAction;
    }
  };
}

function createStableToolRuntime(
  runtime: CanvasHitTestRuntime &
    Partial<CanvasNodeTransformRuntime> &
    Partial<CanvasAuthoringRuntime> &
    Partial<Canvas3DSurfacePointRuntime>
): Parameters<CanvasToolInputTarget["handleToolInput"]>[1] {
  const hitTest = (input: CanvasHitTestInput) => runtime.hitTest(input);
  const transformRuntime = isCanvasNodeTransformRuntime(runtime)
    ? {
        nodeTransformKinds: runtime.nodeTransformKinds,
        resolveNodeTransform: (input: CanvasNodeTransformInput) =>
          runtime.resolveNodeTransform(input),
        setNodeTransformPreview: (preview: CanvasNodeTransformPreview | null) =>
          runtime.setNodeTransformPreview(preview)
      }
    : {};
  const scenePointRuntime =
    typeof runtime.resolveScenePoint === "function"
      ? { resolveScenePoint: runtime.resolveScenePoint.bind(runtime) }
      : {};
  const authoringPreviewRuntime =
    typeof runtime.setAuthoringPreviews === "function"
      ? {
          setAuthoringPreviews: runtime.setAuthoringPreviews.bind(runtime)
        }
      : {};
  const surfacePointRuntime =
    typeof runtime.resolveSurfacePoint === "function"
      ? { resolveSurfacePoint: runtime.resolveSurfacePoint.bind(runtime) }
      : {};
  const geometryRuntime = runtime as unknown as {
    getNodesInBounds?: (bounds: {
      readonly minX: number;
      readonly minY: number;
      readonly maxX: number;
      readonly maxY: number;
    }) => readonly string[];
    resolveNodeBounds?: (
      ids: readonly string[]
    ) => ReadonlyMap<
      string,
      {
        readonly minX: number;
        readonly minY: number;
        readonly maxX: number;
        readonly maxY: number;
      }
    >;
  };
  const areaQueryRuntime =
    typeof geometryRuntime.getNodesInBounds === "function"
      ? { getNodesInBounds: geometryRuntime.getNodesInBounds.bind(runtime) }
      : {};
  const nodeBoundsRuntime =
    typeof geometryRuntime.resolveNodeBounds === "function"
      ? { resolveNodeBounds: geometryRuntime.resolveNodeBounds.bind(runtime) }
      : {};

  return {
    hitTest,
    ...areaQueryRuntime,
    ...nodeBoundsRuntime,
    ...authoringPreviewRuntime,
    ...scenePointRuntime,
    ...surfacePointRuntime,
    ...transformRuntime
  };
}

function isCanvasNodeTransformRuntime(
  runtime: CanvasHitTestRuntime & Partial<CanvasNodeTransformRuntime>
): runtime is CanvasHitTestRuntime & CanvasNodeTransformRuntime {
  return (
    Array.isArray(runtime.nodeTransformKinds) &&
    typeof runtime.resolveNodeTransform === "function" &&
    typeof runtime.setNodeTransformPreview === "function"
  );
}

export function connectCanvasToolInput(
  runtime: CanvasHitTestRuntime &
    Partial<CanvasNodeTransformRuntime> &
    Partial<CanvasAuthoringRuntime> &
    Partial<Canvas3DSurfacePointRuntime> &
    Partial<CanvasRuntimeChangeRuntime>,
  target: CanvasHitSelectionTarget & CanvasToolInputTarget,
  options: CanvasPointerSelectionOptions = {}
): () => void {
  return connectCanvasSelection(runtime, target, options);
}

function getDefaultSelectionMode(event: PointerEvent): CanvasSelectionMode {
  return event.shiftKey || event.ctrlKey || event.metaKey ? "toggle" : "replace";
}

function normalizePointerType(pointerType: string): CanvasToolPointerType {
  switch (pointerType) {
    case "mouse":
    case "pen":
    case "touch":
      return pointerType;
    default:
      return "unknown";
  }
}

function normalizePressure(pressure: number): number {
  if (!Number.isFinite(pressure)) {
    return 0;
  }

  return Math.min(1, Math.max(0, pressure));
}

function resolveMovementThreshold(
  value: number | undefined,
  fallback: number,
  name: string
): number {
  const threshold = value ?? fallback;

  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new TypeError(`${name} must be a finite non-negative number.`);
  }

  return threshold;
}
