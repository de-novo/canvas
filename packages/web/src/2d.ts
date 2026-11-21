import {
  CanvasAuthoringPreviewSchema,
  createCanvasStore,
  CanvasNodeTransformHandleTargetSchema,
  CanvasNodeTransformInputSchema,
  CanvasNodeTransformPreviewSchema,
  CanvasScenePointRequestSchema,
  CanvasScenePointResultSchema,
  defineScene,
  type CanvasAuthoringPreviewForMode,
  type Canvas2DNode,
  type Canvas2DScene,
  type Canvas2DSceneInput,
  type CanvasHitResult,
  type CanvasHitTestInput,
  type CanvasNodeTransformHandleTarget,
  type CanvasNodeTransformInput,
  type CanvasNodeTransformPreviewForMode,
  type CanvasScenePointRequestFor,
  type CanvasScenePointResultFor
} from "@denovo/canvas-core";
import {
  createResizeScheduler,
  getRenderRect,
  resolveCanvas,
  resolveCanvasCssColor,
  type ResolvedCanvas
} from "./dom";
import {
  canvasToScenePoint,
  defineCanvas2DViewState,
  IDENTITY_CANVAS_2D_VIEW,
  fitCanvas2DView,
  flyCanvas2DViewTo,
  getCanvas2DVisibleBounds,
  panCanvas2DView,
  sceneToCanvasPoint,
  tweenCanvas2DView,
  zoomCanvas2DViewAt,
  type Canvas2DRectBounds,
  type Canvas2DViewState,
  type Canvas2DViewStateInput
} from "./view2d";
import {
  applyCanvas2DMatrix,
  createCanvas2DTransformMatrix,
  invertCanvas2DMatrix,
  multiplyCanvas2DMatrices,
  normalizeAngleDelta,
  transformCanvas2DPoint
} from "./2d/matrix";
import {
  createCanvas2DSceneGraph,
  getCanvas2DLayer,
  isNodeEffectivelyLocked,
  isNodeEffectivelyVisible,
  type Canvas2DSceneGraph,
  type Canvas2DTransformNode
} from "./2d/scene-graph";
import {
  rectsIntersect,
  resolveCanvas2DNodeWorldBounds,
  resolveCanvas2DNodeWorldCenter,
  resolveNodeRenderTransform,
  resolveParentWorldTransform
} from "./2d/geometry";
import {
  applyCanvas2DWheelNavigation,
  Canvas2DWheelGesture
} from "./2d/wheel-navigation";
import {
  CANVAS_2D_HANDLE_LENGTH,
  CANVAS_2D_MINIMAP_PADDING
} from "./2d/constants";
import {
  assertCanvas2DTransformNode,
  hitTestCanvas2DConnectionHandle,
  hitTestSceneGraph
} from "./2d/hit-test";
import {
  renderCanvas2DAuthoringGridPreviews,
  renderCanvas2DAuthoringOverlayPreviews,
  renderCanvas2DConnectionHandles,
  renderCanvas2DDrawableNode,
  renderCanvas2DScene,
  renderTransformHandles,
  resolveCanvas2DGridRenderRange,
  type Canvas2DContentColors,
  type Canvas2DTransformHandleColors
} from "./2d/render";
import {
  createCanvas2DSpatialIndex,
  type Canvas2DSpatialIndex
} from "./2d/spatial-index";
import { createCanvas2DWebGpuPresenter, type Canvas2DWebGpuPresenter } from "./2d/webgpu";
import type { Canvas2DRenderNodeContext } from "./types";
import type {
  Canvas2DMinimapOptions,
  Canvas2DNavigationOptions,
  Canvas2DViewportRuntime,
  CanvasAuthoringRuntime,
  CanvasHitTestRuntime,
  CanvasNavigationInputRuntime,
  CanvasNodeTransformHandleRuntime,
  CanvasNodeTransformRuntime,
  CanvasTarget,
  CreateCanvasOptions
} from "./types";

export type Canvas2DObject = {
  id: string;
  render: (context: CanvasRenderingContext2D) => void;
};

const CANVAS_2D_TRANSFORM_KINDS = [
  "translate",
  "rotate",
  "scale"
] as const;

/** Extra world units so a card does not pop at the exact clip edge. */
const OVERLAY_CULL_PAD = 8;

function parseCanvas2DTransformPreview(
  input: unknown
): CanvasNodeTransformPreviewForMode<"2d"> {
  const preview = CanvasNodeTransformPreviewSchema.parse(input);

  if (preview.mode !== "2d") {
    throw new Error("Canvas2D transform preview validation returned 3D data.");
  }

  return preview;
}

export type Canvas2DRuntime = Omit<CanvasHitTestRuntime<"2d">, "mode"> &
  CanvasAuthoringRuntime<"2d"> &
  CanvasNavigationInputRuntime &
  Canvas2DViewportRuntime &
  CanvasNodeTransformRuntime<"2d"> &
  CanvasNodeTransformHandleRuntime & {
  readonly mode: "2d";
  readonly context: CanvasRenderingContext2D;
  readonly gpuBackend?: "webgpu";
  readonly objects: ReadonlyMap<string, Canvas2DObject>;
  readPixels: () => Promise<ImageData>;
};

export function createCanvas2D(
  target: CanvasTarget,
  sceneInput: Canvas2DSceneInput,
  options: CreateCanvasOptions = {}
): Canvas2DRuntime {
  const initialScene = defineScene(sceneInput);

  if (initialScene.mode !== "2d") {
    throw new Error("createCanvas2D requires a scene with mode: '2d'.");
  }

  if (typeof ResizeObserver === "undefined") {
    throw new Error(
      "Canvas2D runtime requires ResizeObserver for deterministic resize handling."
    );
  }

  if (
    options.canvas2d !== undefined &&
    (typeof options.canvas2d !== "object" || options.canvas2d === null)
  ) {
    throw new TypeError("canvas2d options must be an object.");
  }

  const store = createCanvasStore<"2d">(initialScene);
  const resolved = resolveCanvas(target);
  const useWebGpu =
    options.gpuBackend === "webgpu" &&
    options.gpuBackendFallback !== "webgl2";
  const context2d = createCanvas2DMeasureContext(resolved.canvas, useWebGpu);
  const objects = new Map<string, Canvas2DObject>();
  const overlayElements = new Map<string, HTMLElement>();
  const prevHtmlNodesById = new Map<string, Extract<Canvas2DNode, { type: "html" }>>();
  let activeOverlayIds = new Set<string>();
  const renderNode = options.renderNode;
  const contentColors = resolveContentColors(resolved.canvas);
  const navigationOptions = resolveCanvas2DNavigationOptions(
    options.canvas2d?.navigation
  );
  const navigationEnabledByConfig = navigationOptions !== null;
  const previousTouchAction = resolved.canvas.style.touchAction;
  const activeNavigationPointers = new Map<
    number,
    readonly [number, number]
  >();
  // --- mutable runtime state ---------------------------------------------
  // Keep every `let` in this block. The setup at the bottom of this closure
  // calls render()/resize(), which read most of these, and `let` is not
  // hoisted — a declaration moved below that point throws
  // "Cannot access X before initialization" at runtime while still
  // type-checking. That has already happened twice.
  let spacePanActive = false;
  let spacePanPointerId: number | null = null;
  /** Tool cursor captured when space-panning starts, restored when it ends. */
  let cursorBeforeSpacePan = "";
  let activeAnimation: (() => void) | null = null;
  // Tools with `navigation: "allow-pan"` suppress zoom while keeping pan, so a
  // drag-to-create gesture can reach an off-screen target without rescaling.
  let navigationZoomEnabled = true;
  const wheelGesture = new Canvas2DWheelGesture();
  // Connection handles are drawn (and hit-tested) only while a connect-capable
  // tool is active, so the default canvas stays visually clean.
  let connectionHandlesVisible = false;
  let currentScene: Canvas2DScene = initialScene;
  // Declared before the first render() call, which reads them for emphasis.
  let selectionIds: ReadonlySet<string> = new Set();
  let hoveredId: string | null = null;
  let authoringPreviews: readonly CanvasAuthoringPreviewForMode<"2d">[] = [];
  let sceneGraph = createCanvas2DSceneGraph(initialScene);
  let spatialIndex = createCanvas2DSpatialIndex(initialScene, sceneGraph);
  let lastCanvas2DDrawCalls = 0;
  let navigationInputEnabled = navigationEnabledByConfig;
  let transformHandleColors = resolveTransformHandleColors(resolved.canvas);
  let transformHandleTarget: CanvasNodeTransformHandleTarget | null = null;
  let transformPreview: CanvasNodeTransformPreviewForMode<"2d"> | null = null;
  let viewState =
    options.canvas2d?.initialView === undefined
      ? IDENTITY_CANVAS_2D_VIEW
      : defineCanvas2DViewState(options.canvas2d.initialView);
  const minimap = createCanvas2DMinimap(resolved, options.canvas2d?.minimap);
  let frameId: number | null = null;
  let scheduledRenderId: number | null = null;
  let destroyed = false;
  let previousTime = 0;
  let gpuPresenter: Canvas2DWebGpuPresenter | null = null;
  let runtime: Canvas2DRuntime;
  let resizeState = {
    height: 0,
    pixelRatio: 0,
    width: 0
  };

  const resizeScheduler = createResizeScheduler(() => runtime.resize());
  const resizeObserver = new ResizeObserver(() => resizeScheduler.schedule());

  function update(sceneValue: Canvas2DSceneInput): Canvas2DScene {
    const nextScene = defineScene(sceneValue);

    if (nextScene.mode !== "2d") {
      throw new Error("createCanvas2D cannot switch to a non-2D scene.");
    }

    transformPreview = null;
    authoringPreviews = [];
    store.getState().setScene(nextScene);
    currentScene = nextScene;
    sceneGraph = createCanvas2DSceneGraph(nextScene);
    spatialIndex = createCanvas2DSpatialIndex(nextScene, sceneGraph);
    rebuildObjects(currentScene, sceneGraph, objects, contentColors, overlayElements, prevHtmlNodesById, activeOverlayIds, renderNode, {
      sceneToCanvas: (point) => sceneToCanvasPoint(viewState, point),
      viewState,
      viewportSize: { width: resizeState.width, height: resizeState.height }
    }, resolved.overlay);
    runtime.resize();
    runtime.render();
    return currentScene;
  }

  function hitTest(input: CanvasHitTestInput): CanvasHitResult {
    const [x, y] = input.point;

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new TypeError("Canvas2D hit-test coordinates must be finite numbers.");
    }

    const rect = resolved.canvas.getBoundingClientRect();
    const width = rect.width || resizeState.width;
    const height = rect.height || resizeState.height;

    if (x < 0 || y < 0 || x > width || y > height) {
      return {
        kind: "empty",
        point: [x, y],
        renderer: hitRenderer()
      };
    }

    const handleHit = hitTestTransformHandle(x, y);

    if (handleHit) {
      return handleHit;
    }

    const scenePoint = canvasToScenePoint(viewState, [x, y]);

    // Connection handles sit on top of the node body so a drag that starts on a
    // handle begins a connection rather than selecting/moving the node.
    if (connectionHandlesVisible) {
      const connectionHit = hitTestCanvas2DConnectionHandle(
        currentScene,
        sceneGraph,
        scenePoint,
        viewState.zoom
      );

      if (connectionHit) {
        return {
          kind: "node",
          nodeId: connectionHit.nodeId,
          point: [x, y],
          renderer: hitRenderer(),
          subTarget: connectionHit.subTarget
        };
      }
    }
    const hit = hitTestSceneGraph(
      context2d,
      currentScene,
      sceneGraph,
      scenePoint,
      transformPreview,
      spatialIndex
    );

    if (hit) {
      const effectivelyLocked = isNodeEffectivelyLocked(
        currentScene,
        sceneGraph,
        hit.node
      );
      return {
        kind: "node",
        nodeId: hit.node.id,
        point: [x, y],
        renderer: hitRenderer(),
        ...(effectivelyLocked
          ? { subTarget: "locked" }
          : hit.subTarget === undefined
            ? {}
            : { subTarget: hit.subTarget })
      };
    }

    return {
      kind: "empty",
      point: [x, y],
      renderer: hitRenderer()
    };
  }

  function resolveNodeTransform(
    inputValue: CanvasNodeTransformInput
  ): CanvasNodeTransformPreviewForMode<"2d"> {
    const input = CanvasNodeTransformInputSchema.parse(inputValue);
    const node = sceneGraph.nodesById.get(input.nodeId);

    if (!node) {
      throw new Error(`Canvas2D transform node was not found: ${input.nodeId}`);
    }

    assertCanvas2DTransformNode(node);

    switch (input.kind) {
      case "translate":
        return resolveTranslationPreview(node, input);
      case "rotate":
        return resolveRotationPreview(node, input);
      case "scale":
        return resolveScalePreview(node, input);
      default: {
        const exhaustive: never = input;
        return exhaustive;
      }
    }
  }

  function resolveTranslationPreview(
    node: Canvas2DTransformNode,
    input: Extract<CanvasNodeTransformInput, { kind: "translate" }>
  ): CanvasNodeTransformPreviewForMode<"2d"> {
    const origin = canvasToScenePoint(viewState, input.origin);
    const point = canvasToScenePoint(viewState, input.point);
    const deltaX = point[0] - origin[0];
    const deltaY = point[1] - origin[1];
    const delta = (() => {
      switch (input.constraint) {
        case "free":
        case "xy":
          return [deltaX, deltaY] as const;
        case "x":
          return [deltaX, 0] as const;
        case "y":
          return [0, deltaY] as const;
        case "z":
        case "xz":
        case "yz":
          throw new Error(
            `Canvas2D does not support translate constraint: ${input.constraint}`
          );
        default: {
          const exhaustive: never = input.constraint;
          return exhaustive;
        }
      }
    })();

    const parentInverse = invertCanvas2DMatrix(
      resolveParentWorldTransform(node, sceneGraph),
      `Canvas2D cannot transform node through a non-invertible parent: ${node.id}`
    );
    const localOrigin = transformCanvas2DPoint(parentInverse, origin);
    const localPoint = transformCanvas2DPoint(parentInverse, [
      origin[0] + delta[0],
      origin[1] + delta[1]
    ]);

    return parseCanvas2DTransformPreview({
      kind: "translate",
      mode: "2d",
      nodeId: node.id,
      position: [
        node.position[0] + localPoint[0] - localOrigin[0],
        node.position[1] + localPoint[1] - localOrigin[1]
      ]
    });
  }

  function resolveRotationPreview(
    node: Canvas2DTransformNode,
    input: Extract<CanvasNodeTransformInput, { kind: "rotate" }>
  ): CanvasNodeTransformPreviewForMode<"2d"> {
    if (input.axis !== "z") {
      throw new Error(`Canvas2D does not support rotate axis: ${input.axis}`);
    }

    const parentInverse = invertCanvas2DMatrix(
      resolveParentWorldTransform(node, sceneGraph),
      `Canvas2D cannot transform node through a non-invertible parent: ${node.id}`
    );
    const localOrigin = transformCanvas2DPoint(
      parentInverse,
      canvasToScenePoint(viewState, input.origin)
    );
    const localPoint = transformCanvas2DPoint(
      parentInverse,
      canvasToScenePoint(viewState, input.point)
    );
    const originVector = [
      localOrigin[0] - node.position[0],
      localOrigin[1] - node.position[1]
    ] as const;
    const pointVector = [
      localPoint[0] - node.position[0],
      localPoint[1] - node.position[1]
    ] as const;

    if (
      Math.hypot(originVector[0], originVector[1]) <= Number.EPSILON ||
      Math.hypot(pointVector[0], pointVector[1]) <= Number.EPSILON
    ) {
      throw new Error(`Canvas2D rotation pointer is at the node origin: ${node.id}`);
    }

    const delta = normalizeAngleDelta(
      Math.atan2(pointVector[1], pointVector[0]) -
        Math.atan2(originVector[1], originVector[0])
    );
    return parseCanvas2DTransformPreview({
      kind: "rotate",
      mode: "2d",
      nodeId: node.id,
      rotation: node.rotation + delta
    });
  }

  function resolveScalePreview(
    node: Canvas2DTransformNode,
    input: Extract<CanvasNodeTransformInput, { kind: "scale" }>
  ): CanvasNodeTransformPreviewForMode<"2d"> {
    const deltaX = (input.point[0] - input.origin[0]) / CANVAS_2D_HANDLE_LENGTH;
    const deltaY = (input.point[1] - input.origin[1]) / CANVAS_2D_HANDLE_LENGTH;
    const factors = (() => {
      switch (input.constraint) {
        case "x":
          return [1 + deltaX, 1] as const;
        case "y":
          return [1, 1 + deltaY] as const;
        case "xy":
          return [1 + deltaX, 1 + deltaY] as const;
        case "uniform": {
          const factor = 1 + (deltaX + deltaY) / 2;
          return [factor, factor] as const;
        }
        case "z":
        case "xz":
        case "yz":
          throw new Error(
            `Canvas2D does not support scale constraint: ${input.constraint}`
          );
        default: {
          const exhaustive: never = input.constraint;
          return exhaustive;
        }
      }
    })();

    return parseCanvas2DTransformPreview({
      kind: "scale",
      mode: "2d",
      nodeId: node.id,
      scale: [node.scale[0] * factors[0], node.scale[1] * factors[1]]
    });
  }

  function setNodeTransformHandleTarget(
    targetValue: CanvasNodeTransformHandleTarget | null
  ) {
    const nextTarget =
      targetValue === null
        ? null
        : CanvasNodeTransformHandleTargetSchema.parse(targetValue);

    if (nextTarget) {
      const node = sceneGraph.nodesById.get(nextTarget.nodeId);

      if (!node) {
        throw new Error(
          `Canvas2D transform handle node was not found: ${nextTarget.nodeId}`
        );
      }

      assertCanvas2DTransformNode(node);
      transformHandleColors = resolveTransformHandleColors(resolved.canvas);
    }

    transformHandleTarget = nextTarget;
    scheduleRender();
  }

  function setNodeTransformPreview(
    previewValue: CanvasNodeTransformPreviewForMode<"2d"> | null
  ) {
    if (previewValue === null) {
      transformPreview = null;
      scheduleRender();
      return;
    }

    const preview = CanvasNodeTransformPreviewSchema.parse(previewValue);
    const node = sceneGraph.nodesById.get(preview.nodeId);

    if (preview.mode !== "2d") {
      throw new Error(
        `Canvas2D requires a 2D transform preview: ${preview.nodeId}`
      );
    }

    if (!node) {
      throw new Error(
        `Canvas2D transform preview node was not found: ${preview.nodeId}`
      );
    }

    assertCanvas2DTransformNode(node);
    transformPreview = preview;
    scheduleRender();
  }

  function resolveScenePoint(
    requestValue: CanvasScenePointRequestFor<"2d">
  ): CanvasScenePointResultFor<"2d"> {
    const request = CanvasScenePointRequestSchema.parse(requestValue);

    if (request.mode !== "2d") {
      throw new Error(
        "Canvas2D cannot resolve a 3D scene point or substitute a work plane."
      );
    }

    const result = CanvasScenePointResultSchema.parse({
      mode: "2d",
      position: canvasToScenePoint(viewState, request.viewportPoint)
    });

    if (result.mode !== "2d") {
      throw new Error("Canvas2D scene-point validation returned the wrong mode.");
    }

    return result;
  }

  function setAuthoringPreviews(
    previewsValue: readonly CanvasAuthoringPreviewForMode<"2d">[]
  ): void {
    const nextPreviews = previewsValue.map((previewValue) => {
      const preview = CanvasAuthoringPreviewSchema.parse(previewValue);

      if (preview.mode !== "2d") {
        throw new Error(
          `Canvas2D cannot render a ${preview.mode} authoring preview: ${preview.kind}`
        );
      }

      validateCanvas2DAuthoringPreview(preview, currentScene, sceneGraph);

      if (preview.kind === "grid") {
        resolveCanvas2DGridRenderRange(preview.grid, viewState, resizeState);
      }

      return preview;
    });

    authoringPreviews = nextPreviews;
    scheduleRender();
  }

  function hitRenderer(): "canvas2d" | "webgpu" {
    return useWebGpu ? "webgpu" : "canvas2d";
  }

  function renderGpu() {
    if (!gpuPresenter) {
      return;
    }

    gpuPresenter.render({
      authoringPreviews,
      connectionHandlesVisible,
      contentColors,
      hoveredId,
      measureContext: context2d,
      resizeState,
      scene: currentScene,
      sceneGraph,
      selectedIds: selectionIds,
      spatialIndex,
      transformHandleColors,
      transformHandlePosition: getTransformHandlePosition(),
      transformHandleTarget,
      transformPreview,
      viewState
    });
    syncOverlayElements();
    if (minimap) {
      renderCanvas2DMinimap(
        minimap,
        currentScene,
        spatialIndex,
        getCanvas2DVisibleBounds(viewState, {
          width: resizeState.width,
          height: resizeState.height
        }),
        contentColors
      );
    }
  }

  function cancelScheduledRender() {
    if (
      scheduledRenderId !== null &&
      typeof cancelAnimationFrame === "function"
    ) {
      cancelAnimationFrame(scheduledRenderId);
    }
    scheduledRenderId = null;
  }

  function scheduleRender() {
    if (destroyed) {
      return;
    }
    if (typeof requestAnimationFrame !== "function") {
      render();
      return;
    }
    if (scheduledRenderId !== null) {
      return;
    }
    scheduledRenderId = requestAnimationFrame(() => {
      scheduledRenderId = null;
      if (!destroyed) {
        render();
      }
    });
  }

  function render() {
    cancelScheduledRender();
    if (destroyed) {
      return;
    }
    if (useWebGpu) {
      renderGpu();
      return;
    }

    context2d.save();
    context2d.fillStyle = currentScene.background;
    context2d.fillRect(0, 0, resizeState.width, resizeState.height);

    context2d.save();
    context2d.translate(viewState.offset[0], viewState.offset[1]);
    context2d.scale(viewState.zoom, viewState.zoom);
    renderCanvas2DAuthoringGridPreviews(
      context2d,
      authoringPreviews,
      viewState,
      resizeState,
      contentColors
    );
    const visibleBounds = getCanvas2DVisibleBounds(viewState, {
      width: resizeState.width,
      height: resizeState.height
    });
    lastCanvas2DDrawCalls = renderCanvas2DScene(
      context2d,
      currentScene,
      sceneGraph,
      transformPreview,
      contentColors,
      { selectedIds: selectionIds, hoveredId },
      spatialIndex,
      visibleBounds
    );
    renderCanvas2DAuthoringOverlayPreviews(
      context2d,
      authoringPreviews,
      currentScene,
      sceneGraph,
      viewState.zoom,
      contentColors
    );

    if (connectionHandlesVisible) {
      renderCanvas2DConnectionHandles(
        context2d,
        currentScene,
        sceneGraph,
        viewState.zoom,
        contentColors
      );
    }

    context2d.restore();

    renderTransformHandles(
      context2d,
      getTransformHandlePosition(),
      transformHandleTarget?.kind ?? null,
      transformHandleColors
    );

    syncOverlayElements();
    context2d.restore();

    if (minimap) {
      renderCanvas2DMinimap(
        minimap,
        currentScene,
        spatialIndex,
        getCanvas2DVisibleBounds(viewState, {
          width: resizeState.width,
          height: resizeState.height
        }),
        contentColors
      );
    }
  }

  function syncOverlayElements() {
    if (overlayElements.size === 0) {
      return;
    }

    const visible = getCanvas2DVisibleBounds(viewState, {
      width: resizeState.width,
      height: resizeState.height
    });
    const paddedVisible = {
      minX: visible.minX - OVERLAY_CULL_PAD,
      minY: visible.minY - OVERLAY_CULL_PAD,
      maxX: visible.maxX + OVERLAY_CULL_PAD,
      maxY: visible.maxY + OVERLAY_CULL_PAD
    };
    const candidateIds = spatialIndex.queryVisibleHtmlIds(
      paddedVisible,
      transformPreview,
      sceneGraph
    );
    const nextActiveOverlayIds = new Set<string>();
    const pixelRatio = resizeState.pixelRatio || 1;

    for (let i = 0; i < candidateIds.length; i += 1) {
      const id = candidateIds[i]!;
      const element = overlayElements.get(id);
      if (!element) {
        continue;
      }
      const node = sceneGraph.nodesById.get(id);
      if (!node || node.type !== "html") {
        continue;
      }
      // html origin is top-left, not the visual middle. A point test at that
      // origin hides a card whose body still intersects the view, while canvas
      // edges keep drawing to the card's ports.
      let previewNode = node;
      if (transformPreview?.nodeId === id) {
        const { position, rotation, scale } = resolveNodeRenderTransform(node, transformPreview);
        previewNode = { ...node, position: [...position], rotation, scale: [...scale] };
      }
      const bounds = resolveCanvas2DNodeWorldBounds(previewNode, sceneGraph);
      if (!rectsIntersect(bounds, paddedVisible)) {
        continue;
      }

      // Virtualization: skip DOM work for off-screen html nodes. We keep the
      // element mounted (cheap) but hide it; recreate on next become-visible via
      // rebuildObjects if it was pruned by the liveIds step.
      element.style.display = "";
      const topLeft = sceneToCanvasPoint(viewState, [bounds.minX, bounds.minY]);
      const x = Math.round(topLeft[0] * pixelRatio) / pixelRatio;
      const y = Math.round(topLeft[1] * pixelRatio) / pixelRatio;
      const width = Math.max(0, (bounds.maxX - bounds.minX) * viewState.zoom);
      const height = Math.max(0, (bounds.maxY - bounds.minY) * viewState.zoom);
      element.style.transform = `translate(${x}px, ${y}px)`;
      element.style.transformOrigin = "0 0";
      element.style.width = `${width}px`;
      element.style.height = `${height}px`;
      element.style.boxSizing = "border-box";
      element.style.setProperty("--dc-html-zoom", String(viewState.zoom));
      nextActiveOverlayIds.add(id);
    }

    for (const id of activeOverlayIds) {
      if (!nextActiveOverlayIds.has(id)) {
        const element = overlayElements.get(id);
        if (element) {
          element.style.display = "none";
        }
      }
    }
    activeOverlayIds = nextActiveOverlayIds;
  }

  function getRenderStats() {
    return gpuPresenter ? gpuPresenter.getRenderStats() : { drawCalls: lastCanvas2DDrawCalls };
  }

  function loop(time: number) {
    const delta = previousTime === 0 ? 0 : time - previousTime;
    previousTime = time;

    options.onFrame?.(
      {
        delta,
        elapsed: time,
        scene: currentScene,
        render: getRenderStats()
      },
      runtime
    );
    runtime.render();

    if (currentScene.render.loop === "always") {
      frameId = requestAnimationFrame(loop);
    } else {
      frameId = null;
    }
  }

  function start() {
    if (frameId !== null) {
      return;
    }

    store.getState().setStatus("running");
    previousTime = 0;

    if (currentScene.render.loop === "always") {
      frameId = requestAnimationFrame(loop);
      return;
    }

    runtime.render();
  }

  function stop() {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }

    if (store.getState().status !== "destroyed") {
      store.getState().setStatus("idle");
    }
  }

  function resize() {
    const rect = getRenderRect(resolved.canvas, resolved.host);
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const pixelRatio = options.devicePixelRatio ?? currentScene.render.dpr;
    const canvasWidth = Math.max(1, Math.floor(width * pixelRatio));
    const canvasHeight = Math.max(1, Math.floor(height * pixelRatio));

    if (
      resizeState.width !== width ||
      resizeState.height !== height ||
      resizeState.pixelRatio !== pixelRatio
    ) {
      resolved.canvas.width = canvasWidth;
      resolved.canvas.height = canvasHeight;
      resolved.canvas.style.width = `${width}px`;
      resolved.canvas.style.height = `${height}px`;
      if (!useWebGpu) {
        context2d.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      }
      gpuPresenter?.resize(canvasWidth, canvasHeight);
      resizeState = {
        height,
        pixelRatio,
        width
      };
    }

    render();
  }

  function destroy() {
    destroyed = true;
    cancelScheduledRender();
    runtime.stop();
    gpuPresenter?.destroy();
    gpuPresenter = null;
    store.getState().setStatus("destroyed");
    resizeScheduler.cancel();
    resizeObserver.disconnect();
    authoringPreviews = [];
    transformPreview = null;
    transformHandleTarget = null;
    clearNavigationPointers();
    resolved.canvas.removeEventListener("pointerdown", handleNavigationPointerDown);
    resolved.canvas.removeEventListener("pointermove", handleNavigationPointerMove);
    resolved.canvas.removeEventListener("pointerup", handleNavigationPointerEnd);
    resolved.canvas.removeEventListener("pointercancel", handleNavigationPointerEnd);
    resolved.canvas.removeEventListener(
      "lostpointercapture",
      handleNavigationPointerEnd
    );
    resolved.canvas.removeEventListener("wheel", handleNavigationWheel);
    resolved.canvas.style.touchAction = previousTouchAction;
    objects.clear();

    for (const element of overlayElements.values()) {
      element.remove();
    }
    overlayElements.clear();
    prevHtmlNodesById.clear();
    activeOverlayIds.clear();

    if (activeAnimation) {
      activeAnimation();
      activeAnimation = null;
    }

    minimap?.canvas.remove();

    if (resolved.removeOnDestroy) {
      resolved.host.removeChild(resolved.overlay);
      resolved.canvas.remove();
    }
  }

  const ready = useWebGpu ? attachWebGpuPresenter() : Promise.resolve();

  runtime = {
    get canvas() {
      return resolved.canvas;
    },
    get mode() {
      return "2d" as const;
    },
    get navigationInputEnabled() {
      return navigationInputEnabled;
    },
    navigationInputSupported: true,
    nodeTransformKinds: CANVAS_2D_TRANSFORM_KINDS,
    get viewState() {
      return viewState;
    },
    canvasToScene(point) {
      return canvasToScenePoint(viewState, point);
    },
    context: context2d,
    objects,
    ready,
    ...(useWebGpu ? { gpuBackend: "webgpu" as const } : {}),
    store,
    destroy,
    getScene: () => currentScene,
    getRenderStats,
    async readPixels() {
      if (useWebGpu) {
        await ready;
        if (!gpuPresenter) {
          throw new Error("Canvas2D WebGPU presenter is not available.");
        }
        render();
        return gpuPresenter.readPixels();
      }
      render();
      return context2d.getImageData(
        0,
        0,
        resolved.canvas.width,
        resolved.canvas.height
      );
    },
    hitTest,
    render,
    resetViewState,
    resolveNodeTransform,
    resolveScenePoint,
    resize,
    sceneToCanvas(point) {
      return sceneToCanvasPoint(viewState, point);
    },
    setNavigationInputEnabled,
    start,
    stop,
    setNodeTransformHandleTarget,
    setNodeTransformPreview,
    setAuthoringPreviews,
    setViewState,
    getViewportSize() {
      return { width: resizeState.width, height: resizeState.height };
    },
    fitViewBounds(bounds, padding = 64, animate = false) {
      const next = fitCanvas2DView(viewState, { width: resizeState.width, height: resizeState.height }, bounds, padding);
      animateViewTransition(next, animate);
      return next;
    },
    flyToNode(nodeId, zoom, animate = false) {
      const node = sceneGraph.nodesById.get(nodeId);
      // Missing ids fail closed: do not fly toward the origin.
      if (!node) {
        return null;
      }
      const center = resolveCanvas2DNodeWorldCenter(node, sceneGraph);
      const next = flyCanvas2DViewTo(viewState, { width: resizeState.width, height: resizeState.height }, center, zoom);
      animateViewTransition(next, animate);
      return next;
    },
    getVisibleBounds() {
      return getCanvas2DVisibleBounds(viewState, { width: resizeState.width, height: resizeState.height });
    },
    resolveNodeBounds(ids) {
      const measured = new Map<string, Canvas2DRectBounds>();

      for (const id of ids) {
        const node = sceneGraph.nodesById.get(id);

        if (node) {
          measured.set(id, resolveCanvas2DNodeWorldBounds(node, sceneGraph));
        }
      }

      return measured;
    },
    getNodesInBounds(bounds) {
      return spatialIndex.queryRectIds(bounds, sceneGraph);
    },
    ...(renderNode === undefined ? {} : { renderOverlayNode: renderNode }),
    setConnectionHandlesVisible,
    setHoveredNode,
    setNavigationZoomEnabled,
    setSelection,
    update
  };


  function getTransformHandlePosition(): readonly [number, number] | null {
    if (!transformHandleTarget) {
      return null;
    }

    const node = sceneGraph.nodesById.get(transformHandleTarget.nodeId);

    if (!node) {
      return null;
    }

    assertCanvas2DTransformNode(node);

    if (!isNodeEffectivelyVisible(currentScene, sceneGraph, node)) {
      return null;
    }

    const scenePosition = transformCanvas2DPoint(
      multiplyCanvas2DMatrices(
        resolveParentWorldTransform(node, sceneGraph),
        createCanvas2DTransformMatrix(
          resolveNodeRenderTransform(node, transformPreview)
        )
      ),
      [0, 0]
    );
    return sceneToCanvasPoint(viewState, scenePosition);
  }

  function setViewState(state: Canvas2DViewStateInput): Canvas2DViewState {
    viewState = defineCanvas2DViewState(state);
    render();
    return viewState;
  }

  function setHoveredNode(id: string | null): void {
    if (hoveredId === id) {
      return;
    }

    hoveredId = id;
    scheduleRender();
  }

  function setSelection(ids?: readonly string[], primaryId?: string | null): void {
    selectionIds = new Set(ids ?? []);
    void primaryId;
    scheduleRender();
  }


  function animateViewTransition(target: Canvas2DViewState, animate: boolean): void {
    if (activeAnimation) {
      activeAnimation();
      activeAnimation = null;
    }
    if (!animate) {
      setViewState(target);
      return;
    }
    const from = viewState;
    activeAnimation = tweenCanvas2DView(
      from,
      target,
      { width: resizeState.width, height: resizeState.height },
      (next) => {
        viewState = next;
        render();
      }
    );
  }

  function resetViewState(): Canvas2DViewState {
    return setViewState(IDENTITY_CANVAS_2D_VIEW);
  }

  function setNavigationZoomEnabled(enabled: boolean) {
    navigationZoomEnabled = enabled;
  }

  function setConnectionHandlesVisible(visible: boolean) {
    if (connectionHandlesVisible === visible) {
      return;
    }

    connectionHandlesVisible = visible;
    render();
  }

  function setNavigationInputEnabled(enabled: boolean) {
    navigationInputEnabled = navigationEnabledByConfig && enabled;

    if (!navigationInputEnabled) {
      clearNavigationPointers();
      // Only clear the cursor this module set for space-panning; the active
      // tool's cursor is owned by the caller and must survive.
      if (spacePanActive || spacePanPointerId !== null) {
        resolved.canvas.style.cursor = cursorBeforeSpacePan;
      }
      spacePanActive = false;
      spacePanPointerId = null;
    }

    syncNavigationTouchAction();
  }

  function syncNavigationTouchAction() {
    resolved.canvas.style.touchAction = navigationInputEnabled
      ? "none"
      : previousTouchAction;
    if (navigationInputEnabled) {
      resolved.canvas.tabIndex = 0;
    }
  }

  function getNavigationPoint(event: PointerEvent | WheelEvent) {
    const rect = resolved.canvas.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top] as const;
  }

  function handleMinimapPointerDown(event: PointerEvent) {
    const projection = minimap?.projection;

    if (!minimap || !projection || !event.isPrimary || event.button !== 0) {
      return;
    }

    event.preventDefault();
    const rect = minimap.canvas.getBoundingClientRect();
    const scenePoint: readonly [number, number] = [
      projection.origin[0] +
        (event.clientX - rect.left - CANVAS_2D_MINIMAP_PADDING) /
          projection.scale,
      projection.origin[1] +
        (event.clientY - rect.top - CANVAS_2D_MINIMAP_PADDING) /
          projection.scale
    ];

    animateViewTransition(
      flyCanvas2DViewTo(
        viewState,
        { width: resizeState.width, height: resizeState.height },
        scenePoint
      ),
      true
    );
  }

  function handleNavigationKeyDown(event: KeyboardEvent) {
    if (event.code === "Space" && !spacePanActive && navigationInputEnabled) {
      spacePanActive = true;
      // Remember the tool's cursor so releasing Space restores it rather than
      // clearing a cursor this module does not own.
      cursorBeforeSpacePan = resolved.canvas.style.cursor;
      resolved.canvas.style.cursor = "grab";
      event.preventDefault();
    }
  }

  function handleNavigationKeyUp(event: KeyboardEvent) {
    if (event.code === "Space") {
      spacePanActive = false;
      spacePanPointerId = null;
      resolved.canvas.style.cursor = cursorBeforeSpacePan;
    }
  }

  function handleNavigationPointerDown(event: PointerEvent) {
    if (activeAnimation) {
      activeAnimation();
      activeAnimation = null;
    }

    if (!navigationInputEnabled) {
      return;
    }

    // Spacebar-drag pan: takes priority over the normal pan/zoom gates and the
    // tool layer (Space is captured before it reaches the tool bridge).
    if (spacePanActive && event.pointerType !== "touch" && event.button === 0) {
      spacePanPointerId = event.pointerId;
      resolved.canvas.style.cursor = "grabbing";
      activeNavigationPointers.set(event.pointerId, getNavigationPoint(event));
      try {
        resolved.canvas.setPointerCapture(event.pointerId);
      } catch {
        // Capture can already belong to the editor input bridge on the same canvas.
      }
      return;
    }

    if (
      !navigationOptions ||
      (!navigationOptions.enablePan && !navigationOptions.enableZoom) ||
      (event.pointerType !== "touch" && (!event.isPrimary || event.button !== 0))
    ) {
      return;
    }

    activeNavigationPointers.set(event.pointerId, getNavigationPoint(event));

    try {
      resolved.canvas.setPointerCapture(event.pointerId);
    } catch {
      // Capture can already belong to the editor input bridge on the same canvas.
    }
  }

  function handleNavigationPointerMove(event: PointerEvent) {
    const previousPoint = activeNavigationPointers.get(event.pointerId);

    if (!navigationInputEnabled || !previousPoint) {
      return;
    }

    // Spacebar-drag pan: one pointer, pan regardless of navigationOptions.
    if (event.pointerId === spacePanPointerId) {
      const next = getNavigationPoint(event);
      viewState = panCanvas2DView(viewState, [
        next[0] - previousPoint[0],
        next[1] - previousPoint[1]
      ]);
      scheduleRender();
      return;
    }

    if (!navigationOptions) {
      return;
    }

    const previousPointers = [...activeNavigationPointers.values()];
    const nextPoint = getNavigationPoint(event);
    activeNavigationPointers.set(event.pointerId, nextPoint);
    const nextPointers = [...activeNavigationPointers.values()];

    if (
      navigationOptions.enableZoom &&
      navigationZoomEnabled &&
      previousPointers.length >= 2 &&
      nextPointers.length >= 2
    ) {
      const previousGesture = getTwoPointerGesture(previousPointers);
      const nextGesture = getTwoPointerGesture(nextPointers);

      if (
        previousGesture.distance <= Number.EPSILON ||
        nextGesture.distance <= Number.EPSILON
      ) {
        throw new Error("Canvas2D pinch zoom requires distinct pointer positions.");
      }

      const nextZoom = constrainNavigationZoom(
        viewState.zoom * (nextGesture.distance / previousGesture.distance),
        navigationOptions
      );
      viewState = zoomCanvas2DViewAt(
        viewState,
        nextZoom,
        previousGesture.center
      );
      viewState = panCanvas2DView(viewState, [
        nextGesture.center[0] - previousGesture.center[0],
        nextGesture.center[1] - previousGesture.center[1]
      ]);
      scheduleRender();
      return;
    }

    if (navigationOptions.enablePan && activeNavigationPointers.size === 1) {
      viewState = panCanvas2DView(viewState, [
        nextPoint[0] - previousPoint[0],
        nextPoint[1] - previousPoint[1]
      ]);
      scheduleRender();
    }
  }

  function handleNavigationPointerEnd(event: PointerEvent) {
    if (event.pointerId === spacePanPointerId) {
      spacePanPointerId = null;
      // Still holding Space: go back to the ready-to-pan cursor.
      resolved.canvas.style.cursor = spacePanActive ? "grab" : cursorBeforeSpacePan;
    }
    activeNavigationPointers.delete(event.pointerId);
  }

  function handleNavigationWheel(event: WheelEvent) {
    if (!navigationInputEnabled || !navigationOptions) {
      return;
    }

    const intent = wheelGesture.classify(event);
    const applied = applyCanvas2DWheelNavigation(
      viewState,
      event,
      intent,
      {
        enablePan: navigationOptions.enablePan,
        enableZoom: navigationOptions.enableZoom && navigationZoomEnabled,
        maxZoom: navigationOptions.maxZoom,
        minZoom: navigationOptions.minZoom,
        wheelZoomSensitivity: navigationOptions.wheelZoomSensitivity
      },
      getNavigationPoint(event)
    );

    if (!applied.consumed) {
      return;
    }

    event.preventDefault();
    viewState = applied.view;
    scheduleRender();
  }

  function clearNavigationPointers() {
    for (const pointerId of activeNavigationPointers.keys()) {
      try {
        if (resolved.canvas.hasPointerCapture(pointerId)) {
          resolved.canvas.releasePointerCapture(pointerId);
        }
      } catch {
        // Cancellation can race the browser's implicit capture release.
      }
    }

    activeNavigationPointers.clear();
  }

  function hitTestTransformHandle(
    x: number,
    y: number
  ): CanvasHitResult | null {
    const position = getTransformHandlePosition();

    if (!position || !transformHandleTarget) {
      return null;
    }

    const deltaX = x - position[0];
    const deltaY = y - position[1];
    const base = {
      kind: "handle" as const,
      nodeId: transformHandleTarget.nodeId,
      point: [x, y] as [number, number],
      renderer: hitRenderer()
    };

    switch (transformHandleTarget.kind) {
      case "translate":
        if (Math.abs(deltaX) <= 9 && Math.abs(deltaY) <= 9) {
          return { ...base, subTarget: "translate.xy" };
        }

        if (deltaX >= 8 && deltaX <= 64 && Math.abs(deltaY) <= 8) {
          return { ...base, subTarget: "translate.x" };
        }

        if (deltaY >= 8 && deltaY <= 64 && Math.abs(deltaX) <= 8) {
          return { ...base, subTarget: "translate.y" };
        }

        return null;
      case "rotate": {
        const distance = Math.hypot(deltaX, deltaY);
        return distance >= 45 && distance <= 59
          ? { ...base, subTarget: "rotate.z" }
          : null;
      }
      case "scale":
        if (Math.abs(deltaX) <= 9 && Math.abs(deltaY) <= 9) {
          return { ...base, subTarget: "scale.uniform" };
        }

        if (Math.abs(deltaX - 64) <= 9 && Math.abs(deltaY) <= 9) {
          return { ...base, subTarget: "scale.x" };
        }

        if (Math.abs(deltaY - 64) <= 9 && Math.abs(deltaX) <= 9) {
          return { ...base, subTarget: "scale.y" };
        }

        if (Math.abs(deltaX - 42) <= 9 && Math.abs(deltaY - 42) <= 9) {
          return { ...base, subTarget: "scale.xy" };
        }

        return null;
      default: {
        const exhaustive: never = transformHandleTarget.kind;
        return exhaustive;
      }
    }
  }

  // --- setup -------------------------------------------------------------
  // Runs last on purpose: everything above is declared by now, so nothing here
  // can hit a temporal-dead-zone error. Two such bugs (`selectionIds`,
  // `activeAnimation`) shipped when this block sat above the declarations it
  // transitively read. Keep it at the bottom.

  resolved.canvas.addEventListener("pointerdown", handleNavigationPointerDown);
  resolved.canvas.addEventListener("pointermove", handleNavigationPointerMove);
  resolved.canvas.addEventListener("pointerup", handleNavigationPointerEnd);
  resolved.canvas.addEventListener("pointercancel", handleNavigationPointerEnd);
  resolved.canvas.addEventListener(
    "lostpointercapture",
    handleNavigationPointerEnd
  );
  resolved.canvas.addEventListener("wheel", handleNavigationWheel, {
    passive: false
  });
  resolved.canvas.addEventListener("keydown", handleNavigationKeyDown);
  resolved.canvas.addEventListener("keyup", handleNavigationKeyUp);

  if (minimap?.interactive) {
    minimap.canvas.addEventListener("pointerdown", handleMinimapPointerDown);
  }
  syncNavigationTouchAction();
  resizeObserver.observe(resolved.host);
  rebuildObjects(currentScene, sceneGraph, objects, contentColors, overlayElements, prevHtmlNodesById, activeOverlayIds, renderNode, {
    sceneToCanvas: (point) => sceneToCanvasPoint(viewState, point),
    viewState,
    viewportSize: { width: resizeState.width, height: resizeState.height }
  }, resolved.overlay);
  if (!useWebGpu) {
    runtime.resize();
    runtime.render();
  }

  if (options.autoStart ?? true) {
    runtime.start();
  }

  return runtime;

  async function attachWebGpuPresenter(): Promise<void> {
    gpuPresenter = await createCanvas2DWebGpuPresenter(resolved.canvas);
    if (store.getState().status === "destroyed") {
      gpuPresenter.destroy();
      gpuPresenter = null;
      return;
    }
    runtime.resize();
    runtime.render();
  }
}

function createCanvas2DMeasureContext(
  canvas: HTMLCanvasElement,
  useWebGpu: boolean
): CanvasRenderingContext2D {
  if (!useWebGpu) {
    const context = canvas.getContext("2d", {
      alpha: false
    });
    if (!context) {
      throw new Error("2D canvas context is not available.");
    }
    return context;
  }

  const measure = canvas.ownerDocument.createElement("canvas");
  measure.width = 1;
  measure.height = 1;
  const context = measure.getContext("2d");
  if (!context) {
    throw new Error("2D canvas context is not available.");
  }
  return context;
}

type ResolvedCanvas2DNavigationOptions = Required<Canvas2DNavigationOptions>;

function resolveCanvas2DNavigationOptions(
  input: false | Canvas2DNavigationOptions | undefined
): ResolvedCanvas2DNavigationOptions | null {
  if (input === false) {
    return null;
  }

  if (input !== undefined && (typeof input !== "object" || input === null)) {
    throw new TypeError(
      "Canvas2D navigation must be false or a navigation options object."
    );
  }

  if (
    input &&
    ((input.enablePan !== undefined && typeof input.enablePan !== "boolean") ||
      (input.enableZoom !== undefined && typeof input.enableZoom !== "boolean"))
  ) {
    throw new TypeError(
      "Canvas2D navigation enablePan and enableZoom must be booleans."
    );
  }

  const options = {
    enablePan: input?.enablePan ?? true,
    enableZoom: input?.enableZoom ?? true,
    maxZoom: input?.maxZoom ?? 16,
    minZoom: input?.minZoom ?? 0.1,
    wheelZoomSensitivity: input?.wheelZoomSensitivity ?? 0.0015
  };

  if (
    !Number.isFinite(options.minZoom) ||
    options.minZoom <= 0 ||
    !Number.isFinite(options.maxZoom) ||
    options.maxZoom < options.minZoom ||
    !Number.isFinite(options.wheelZoomSensitivity) ||
    options.wheelZoomSensitivity <= 0
  ) {
    throw new TypeError(
      "Canvas2D navigation zoom bounds and wheel sensitivity must be finite positive values."
    );
  }

  return options;
}

function constrainNavigationZoom(
  zoom: number,
  options: ResolvedCanvas2DNavigationOptions
): number {
  if (!Number.isFinite(zoom) || zoom <= 0) {
    throw new TypeError("Canvas2D gesture produced an invalid zoom value.");
  }

  return Math.min(options.maxZoom, Math.max(options.minZoom, zoom));
}

function getTwoPointerGesture(
  points: readonly (readonly [number, number])[]
): { center: readonly [number, number]; distance: number } {
  const first = points[0];
  const second = points[1];

  if (!first || !second) {
    throw new Error("Canvas2D pinch zoom requires two active pointers.");
  }

  return {
    center: [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2],
    distance: Math.hypot(second[0] - first[0], second[1] - first[1])
  };
}


function resolveTransformHandleColors(
  canvas: HTMLCanvasElement
): Canvas2DTransformHandleColors {
  return {
    x: resolveCanvasCssColor(canvas, "--_dc-handle-x", "#ef4444"),
    xy: resolveCanvasCssColor(canvas, "--_dc-handle-xy", "#facc15"),
    y: resolveCanvasCssColor(canvas, "--_dc-handle-y", "#22c55e")
  };
}


function resolveContentColors(canvas: HTMLCanvasElement): Canvas2DContentColors {
  return {
    accent: resolveCanvasCssColor(canvas, "--_dc-selection", "#38bdf8"),
    foreground: resolveCanvasCssColor(canvas, "--_dc-foreground", "#f8fafc")
  };
}

function validateCanvas2DAuthoringPreview(
  preview: CanvasAuthoringPreviewForMode<"2d">,
  scene: Canvas2DScene,
  sceneGraph: Canvas2DSceneGraph
): void {
  if (preview.kind === "node") {
    getCanvas2DLayer(scene, preview.node.layerId);

    if (preview.node.parentId !== null) {
      const parent = sceneGraph.nodesById.get(preview.node.parentId);

      if (!parent || parent.type !== "group") {
        throw new Error(
          `Canvas2D authoring preview requires group parent: ${preview.node.parentId}`
        );
      }

      if (parent.layerId !== preview.node.layerId) {
        throw new Error(
          `Canvas2D authoring preview cannot cross layers: ${preview.node.id}`
        );
      }
    }

    return;
  }

  if (
    preview.kind === "annotation.draft" &&
    preview.targetId !== null &&
    !sceneGraph.nodesById.has(preview.targetId)
  ) {
    throw new Error(
      `Canvas2D annotation preview target was not found: ${preview.targetId}`
    );
  }
}












/**
 * The complete path an edge draws, in world space. Rendering, hit-testing and
 * bounds all read this one function so they cannot disagree about where an edge
 * actually is.
 *
 * `waypoints` are the intermediate corners of a polyline (empty for straight and
 * curved edges); `control` is the quadratic control point for curved edges.
 * The two are mutually exclusive.
 */















function jsonValuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (
    typeof a !== "object" ||
    a === null ||
    typeof b !== "object" ||
    b === null
  ) {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i += 1) {
      if (!jsonValuesEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
  const recA = a as Record<string, unknown>;
  const recB = b as Record<string, unknown>;
  const keysA = Object.keys(recA);
  const keysB = Object.keys(recB);
  if (keysA.length !== keysB.length) {
    return false;
  }
  for (let i = 0; i < keysA.length; i += 1) {
    const key = keysA[i]!;
    if (
      !Object.prototype.hasOwnProperty.call(recB, key) ||
      !jsonValuesEqual(recA[key], recB[key])
    ) {
      return false;
    }
  }
  return true;
}

function htmlNodeEqual(
  a: Extract<Canvas2DNode, { type: "html" }>,
  b: Extract<Canvas2DNode, { type: "html" }>
): boolean {
  if (a === b) {
    return true;
  }
  return (
    a.html === b.html &&
    a.width === b.width &&
    a.height === b.height &&
    a.visible === b.visible &&
    a.locked === b.locked &&
    a.layerId === b.layerId &&
    a.parentId === b.parentId &&
    a.rotation === b.rotation &&
    a.position[0] === b.position[0] &&
    a.position[1] === b.position[1] &&
    a.scale[0] === b.scale[0] &&
    a.scale[1] === b.scale[1] &&
    jsonValuesEqual(a.metadata, b.metadata)
  );
}

function rebuildObjects(
  scene: Canvas2DScene,
  sceneGraph: Canvas2DSceneGraph,
  objects: Map<string, Canvas2DObject>,
  colors: Canvas2DContentColors,
  overlayElements: Map<string, HTMLElement>,
  prevHtmlNodesById: Map<string, Extract<Canvas2DNode, { type: "html" }>>,
  activeOverlayIds: Set<string>,
  renderNode: CreateCanvasOptions["renderNode"],
  renderContext: Canvas2DRenderNodeContext,
  overlayParent: HTMLElement
) {
  objects.clear();

  const liveIds = new Set<string>();

  for (const node of scene.nodes) {
    if (node.type === "group") {
      continue;
    }

    liveIds.add(node.id);

    const parentWorldTransform = resolveParentWorldTransform(node, sceneGraph);
    objects.set(node.id, {
      id: node.id,
      render(context) {
        if (!isNodeEffectivelyVisible(scene, sceneGraph, node)) {
          return;
        }

        context.save();
        // Edges are drawn in world (scene) coordinates derived from their
        // endpoint nodes, so they must NOT inherit the parent group transform.
        if (node.type !== "edge") {
          applyCanvas2DMatrix(context, parentWorldTransform);
        }
        renderCanvas2DDrawableNode(
          context,
          node,
          parentWorldTransform,
          null,
          colors,
          scene,
          sceneGraph
        );
        context.restore();
      }
    });

    if (node.type === "html" && renderNode) {
      let element = overlayElements.get(node.id);
      const prevNode = prevHtmlNodesById.get(node.id);
      if (element && prevNode && htmlNodeEqual(prevNode, node)) {
        prevHtmlNodesById.set(node.id, node);
        continue;
      }

      const rendered = renderNode(node, renderContext);

      if (typeof rendered === "string") {
        if (!element) {
          element = document.createElement("div");
          element.style.position = "absolute";
          element.style.display = "none";
          overlayElements.set(node.id, element);
          overlayParent.appendChild(element);
          activeOverlayIds.delete(node.id);
        }
        // Strings are text, not markup. Hosts that need HTML return an Element.
        element.textContent = rendered;
      } else if (element !== rendered) {
        rendered.style.position = "absolute";
        rendered.style.left = "0";
        rendered.style.top = "0";
        rendered.style.display = "none";
        if (element) {
          element.replaceWith(rendered);
        } else {
          overlayParent.appendChild(rendered);
        }
        overlayElements.set(node.id, rendered);
        activeOverlayIds.delete(node.id);
      }
      prevHtmlNodesById.set(node.id, node);
    }
  }

  for (const [id, element] of overlayElements) {
    if (!liveIds.has(id)) {
      element.remove();
      overlayElements.delete(id);
      prevHtmlNodesById.delete(id);
      activeOverlayIds.delete(id);
    }
  }
}






type Canvas2DMinimapCache = {
  readonly bitmap: HTMLCanvasElement;
  readonly color: string;
  readonly contentBounds: Canvas2DRectBounds;
  readonly scene: Canvas2DScene;
  readonly sceneBounds: Canvas2DRectBounds | null;
};

type Canvas2DMinimap = {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
  readonly interactive: boolean;
  cache: Canvas2DMinimapCache | null;
  /**
   * Scene→minimap mapping from the most recent render, so a click can be turned
   * back into a scene point without recomputing content bounds.
   */
  projection: { origin: readonly [number, number]; scale: number } | null;
};


function createCanvas2DMinimap(
  resolved: ResolvedCanvas,
  options: Canvas2DMinimapOptions | undefined
): Canvas2DMinimap | null {
  if (options === undefined) {
    return null;
  }

  const width = options.width ?? 180;
  const height = options.height ?? 120;
  const position = options.position ?? "bottom-right";
  const canvas = document.createElement("canvas");
  canvas.className = "denovo-canvas-minimap";
  canvas.width = width;
  canvas.height = height;
  canvas.style.position = "absolute";
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.style.pointerEvents = options.interactive === false ? "none" : "auto";

  const inset = `${CANVAS_2D_MINIMAP_PADDING}px`;
  if (position === "top-left" || position === "top-right") {
    canvas.style.top = inset;
  } else {
    canvas.style.bottom = inset;
  }
  if (position === "top-left" || position === "bottom-left") {
    canvas.style.left = inset;
  } else {
    canvas.style.right = inset;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  resolved.host.appendChild(canvas);

  return {
    cache: null,
    canvas,
    context,
    interactive: options.interactive !== false,
    projection: null
  };
}

function minimapBoundsEqual(
  a: Canvas2DRectBounds,
  b: Canvas2DRectBounds
): boolean {
  return (
    a.minX === b.minX &&
    a.minY === b.minY &&
    a.maxX === b.maxX &&
    a.maxY === b.maxY
  );
}

/**
 * Draws every node as a filled box plus the current viewport frame, scaled to
 * fit the union of scene content and viewport so the frame is always visible.
 * Static node boxes are cached on an offscreen bitmap per (scene, color,
 * contentBounds) so panning inside the scene bounds is O(1).
 */
function renderCanvas2DMinimap(
  minimap: Canvas2DMinimap,
  scene: Canvas2DScene,
  spatialIndex: Canvas2DSpatialIndex,
  viewport: Canvas2DRectBounds,
  colors: Canvas2DContentColors
): void {
  const { canvas, context } = minimap;
  const cached = minimap.cache;

  let sceneBounds: Canvas2DRectBounds | null;
  if (cached && cached.scene === scene) {
    sceneBounds = cached.sceneBounds;
  } else if (spatialIndex.entries.length === 0) {
    sceneBounds = null;
  } else {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < spatialIndex.entries.length; i += 1) {
      const b = spatialIndex.entries[i]!.bounds;
      if (b.minX < minX) minX = b.minX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.maxY > maxY) maxY = b.maxY;
    }
    sceneBounds = { minX, minY, maxX, maxY };
  }

  const content: Canvas2DRectBounds = sceneBounds
    ? {
        minX: Math.min(sceneBounds.minX, viewport.minX),
        minY: Math.min(sceneBounds.minY, viewport.minY),
        maxX: Math.max(sceneBounds.maxX, viewport.maxX),
        maxY: Math.max(sceneBounds.maxY, viewport.maxY)
      }
    : viewport;

  const contentWidth = Math.max(1, content.maxX - content.minX);
  const contentHeight = Math.max(1, content.maxY - content.minY);
  const inner = CANVAS_2D_MINIMAP_PADDING;
  const scale = Math.min(
    (canvas.width - inner * 2) / contentWidth,
    (canvas.height - inner * 2) / contentHeight
  );
  const toMinimapX = (x: number) => inner + (x - content.minX) * scale;
  const toMinimapY = (y: number) => inner + (y - content.minY) * scale;
  minimap.projection = { origin: [content.minX, content.minY], scale };

  const cacheHit =
    cached !== null &&
    cached.scene === scene &&
    cached.color === colors.foreground &&
    cached.bitmap.width === canvas.width &&
    cached.bitmap.height === canvas.height &&
    minimapBoundsEqual(cached.contentBounds, content);

  let bitmap: HTMLCanvasElement;
  if (cacheHit) {
    bitmap = cached.bitmap;
  } else {
    bitmap = cached?.bitmap ?? document.createElement("canvas");
    if (bitmap.width !== canvas.width) bitmap.width = canvas.width;
    if (bitmap.height !== canvas.height) bitmap.height = canvas.height;
    const offscreen = bitmap.getContext("2d");
    if (offscreen) {
      offscreen.clearRect(0, 0, bitmap.width, bitmap.height);
      offscreen.save();
      offscreen.globalAlpha = 0.6;
      offscreen.fillStyle = colors.foreground;
      for (let i = 0; i < spatialIndex.entries.length; i += 1) {
        const bounds = spatialIndex.entries[i]!.bounds;
        offscreen.fillRect(
          toMinimapX(bounds.minX),
          toMinimapY(bounds.minY),
          Math.max(1, (bounds.maxX - bounds.minX) * scale),
          Math.max(1, (bounds.maxY - bounds.minY) * scale)
        );
      }
      offscreen.restore();
    }
    minimap.cache = {
      bitmap,
      color: colors.foreground,
      contentBounds: content,
      scene,
      sceneBounds
    };
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0);

  context.save();
  context.globalAlpha = 1;
  context.strokeStyle = colors.accent;
  context.lineWidth = 1.5;
  context.strokeRect(
    toMinimapX(viewport.minX),
    toMinimapY(viewport.minY),
    Math.max(1, (viewport.maxX - viewport.minX) * scale),
    Math.max(1, (viewport.maxY - viewport.minY) * scale)
  );
  context.restore();
}

export { connectCanvasSelection, connectCanvasToolInput } from "./selection";
export {
  CanvasSceneChunkCancelledError,
  createSceneChunkLoader,
  type CanvasSceneChunkLoader,
  type CanvasSceneChunkLoaderOptions,
  type CanvasSceneChunkProgress
} from "./scene-chunks";
export {
  canvasToScenePoint,
  defineCanvas2DViewState,
  fitCanvas2DView,
  flyCanvas2DViewTo,
  getCanvas2DVisibleBounds,
  IDENTITY_CANVAS_2D_VIEW,
  panCanvas2DView,
  sceneToCanvasPoint,
  zoomCanvas2DViewAt,
  type Canvas2DRectBounds,
  type Canvas2DViewportSize,
  type Canvas2DViewState,
  type Canvas2DViewStateInput
} from "./view2d";
export {
  CanvasReadPixelsUnsupportedError,
  type Canvas2DMinimapOptions,
  type Canvas2DNavigationOptions,
  type Canvas2DOptions,
  type Canvas2DRenderNode,
  type Canvas2DRenderNodeContext,
  type Canvas2DViewportRuntime,
  type CanvasAuthoringRuntime,
  type CanvasFrame,
  type CanvasHitSelectionTarget,
  type CanvasHitTestRuntime,
  type CanvasNavigationInputCapability,
  type CanvasNavigationInputRuntime,
  type CanvasNavigationInputUnsupported,
  type CanvasNodeTransformHandleRuntime,
  type CanvasNodeTransformRuntime,
  type CanvasPointerSelectionOptions,
  type CanvasRuntimeChange,
  type CanvasRuntimeChangeListener,
  type CanvasRuntimeChangeRuntime,
  type CanvasTarget,
  type CanvasToolInputTarget,
  type CreateCanvasOptions,
  type WebCanvasRuntime
} from "./types";





























