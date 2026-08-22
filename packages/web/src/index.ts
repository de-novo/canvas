import {
  defineScene,
  type CanvasAuthoringPreview,
  type CanvasAuthoringPreviewForMode,
  type Canvas3DSurfacePointRequest,
  type Canvas3DSurfacePointResult,
  type CanvasHitResult,
  type CanvasHitTestInput,
  type CanvasMode,
  type CanvasNodeTransformHandleTarget,
  type CanvasNodeTransformInput,
  type CanvasNodeTransformKind,
  type CanvasNodeTransformPreview,
  type CanvasScene,
  type CanvasSceneInput,
  type CanvasScenePointRequest,
  type CanvasScenePointRequestFor,
  type CanvasScenePointResult,
  type CanvasScenePointResultFor,
  type CanvasStore
} from "@denovo/canvas-core";
import { createCanvas2D, type Canvas2DRuntime } from "./2d";
import { createCanvas3D, type ThreeCanvasRuntime } from "./3d";
import type {
  Canvas3DSectionPlaneInput,
  CanvasNavigationInputRuntime,
  CanvasRenderStats,
  CanvasRuntimeChange,
  CanvasRuntimeChangeListener,
  CanvasRuntimeChangeRuntime,
  CanvasTarget,
  CreateCanvasOptions
} from "./types";

export type DynamicCanvasRuntime = CanvasNavigationInputRuntime &
  CanvasRuntimeChangeRuntime & {
  readonly canvas: HTMLCanvasElement;
  readonly current: Canvas2DRuntime | ThreeCanvasRuntime;
  readonly mode: CanvasMode;
  readonly nodeTransformKinds: readonly CanvasNodeTransformKind[];
  readonly ready: Promise<void>;
  readonly store: CanvasStore;
  destroy: () => void;
  getScene: () => CanvasScene;
  getRenderStats: () => CanvasRenderStats | undefined;
  hitTest: (input: CanvasHitTestInput) => CanvasHitResult;
  render: () => void;
  resolveNodeTransform: (
    input: CanvasNodeTransformInput
  ) => CanvasNodeTransformPreview;
  resolveScenePoint: {
    (
      request: CanvasScenePointRequestFor<"2d">
    ):
      | CanvasScenePointResultFor<"2d">
      | Promise<CanvasScenePointResultFor<"2d">>;
    (
      request: CanvasScenePointRequestFor<"3d">
    ):
      | CanvasScenePointResultFor<"3d">
      | Promise<CanvasScenePointResultFor<"3d">>;
  };
  resolveSurfacePoint: (
    request: Canvas3DSurfacePointRequest
  ) => Canvas3DSurfacePointResult | Promise<Canvas3DSurfacePointResult>;
  resize: () => void;
  setAuthoringPreviews: (
    previews: readonly CanvasAuthoringPreview[]
  ) => void | Promise<void>;
  setNodeTransformHandleTarget: (
    target: CanvasNodeTransformHandleTarget | null
  ) => void;
  setNodeTransformPreview: (
    preview: CanvasNodeTransformPreview | null
  ) => void;
  /** Three.js runtime only. Sets/clears the renderer-level section plane. */
  setSectionPlane?: (section: Canvas3DSectionPlaneInput | null) => void;
  start: () => void;
  stop: () => void;
  update: (scene: CanvasSceneInput) => CanvasScene;
};

export function createCanvas(
  target: CanvasTarget,
  sceneInput: CanvasSceneInput,
  options: CreateCanvasOptions = {}
): DynamicCanvasRuntime {
  const initialScene = defineScene(sceneInput);
  let current = createRuntime(target, initialScene, options);
  let navigationInputAllowed = true;
  let runtimeGeneration = 0;
  const runtimeChangeListeners = new Set<CanvasRuntimeChangeListener>();

  function notifyRuntimeChange(
    change:
      | Omit<Extract<CanvasRuntimeChange, { type: "replace" }>, "generation">
      | Omit<Extract<CanvasRuntimeChange, { type: "destroy" }>, "generation">
  ): void {
    const event = {
      ...change,
      generation: runtimeGeneration + 1
    } as CanvasRuntimeChange;

    for (const listener of [...runtimeChangeListeners]) {
      listener(event);
    }

    runtimeGeneration = event.generation;
  }

  function resolveScenePoint(
    request: CanvasScenePointRequestFor<"2d">
  ):
    | CanvasScenePointResultFor<"2d">
    | Promise<CanvasScenePointResultFor<"2d">>;
  function resolveScenePoint(
    request: CanvasScenePointRequestFor<"3d">
  ):
    | CanvasScenePointResultFor<"3d">
    | Promise<CanvasScenePointResultFor<"3d">>;
  function resolveScenePoint(
    request: CanvasScenePointRequest
  ): CanvasScenePointResult | Promise<CanvasScenePointResult> {
    if (request.mode === "2d") {
      if (current.mode !== "2d") {
        throw new Error(
          "A 2D scene-point request requires the Canvas2D runtime."
        );
      }

      return current.resolveScenePoint(request);
    }

    if (current.mode !== "3d") {
      throw new Error(
        "A 3D scene-point request requires the Three.js runtime."
      );
    }

    return current.resolveScenePoint(request);
  }

  function resolveSurfacePoint(
    request: Canvas3DSurfacePointRequest
  ): Canvas3DSurfacePointResult | Promise<Canvas3DSurfacePointResult> {
    if (current.mode !== "3d") {
      throw new Error(
        "A 3D surface-point request requires the Three.js runtime."
      );
    }

    return current.resolveSurfacePoint(request);
  }

  const runtime: DynamicCanvasRuntime = {
    get canvas() {
      return current.canvas;
    },
    get current() {
      return current;
    },
    get mode() {
      return current.mode;
    },
    get navigationInputEnabled() {
      return current.navigationInputEnabled;
    },
    navigationInputSupported: true,
    get nodeTransformKinds() {
      return current.nodeTransformKinds;
    },
    get ready() {
      return current.ready;
    },
    get store() {
      return current.store;
    },
    destroy() {
      notifyRuntimeChange({
        previousMode: current.mode,
        type: "destroy"
      });
      runtimeChangeListeners.clear();
      current.destroy();
    },
    getScene() {
      return current.getScene();
    },
    getRenderStats() {
      return current.getRenderStats();
    },
    hitTest(input) {
      return current.hitTest(input);
    },
    render() {
      current.render();
    },
    resolveNodeTransform(input) {
      return current.resolveNodeTransform(input);
    },
    resolveScenePoint,
    resolveSurfacePoint,
    resize() {
      current.resize();
    },
    setNavigationInputEnabled(enabled) {
      navigationInputAllowed = enabled;
      current.setNavigationInputEnabled(enabled);
    },
    setSectionPlane(section) {
      // Optional capability: only the Three.js runtime implements it.
      current.setSectionPlane?.(section);
    },
    setNodeTransformHandleTarget(targetValue) {
      current.setNodeTransformHandleTarget(targetValue);
    },
    setNodeTransformPreview(preview) {
      if (preview === null) {
        current.setNodeTransformPreview(null);
        return;
      }

      if (current.mode === "2d" && preview.mode === "2d") {
        current.setNodeTransformPreview(preview);
        return;
      }

      if (current.mode === "3d" && preview.mode === "3d") {
        current.setNodeTransformPreview(preview);
        return;
      }

      throw new Error(
        `Canvas ${current.mode} runtime cannot render a ${preview.mode} transform preview.`
      );
    },
    setAuthoringPreviews(previews: readonly CanvasAuthoringPreview[]) {
      if (current.mode === "2d") {
        if (!isAuthoringPreviewArrayForMode(previews, "2d")) {
          throw new Error("Canvas2D cannot render 3D authoring previews.");
        }

        return current.setAuthoringPreviews(previews);
      }

      if (!isAuthoringPreviewArrayForMode(previews, "3d")) {
        throw new Error("Canvas3D cannot render 2D authoring previews.");
      }

      return current.setAuthoringPreviews(previews);
    },
    start() {
      current.start();
    },
    stop() {
      current.stop();
    },
    subscribeRuntimeChange(listener) {
      runtimeChangeListeners.add(listener);
      let subscribed = true;

      return () => {
        if (!subscribed) {
          return;
        }

        subscribed = false;
        runtimeChangeListeners.delete(listener);
      };
    },
    update(nextSceneInput: CanvasSceneInput): CanvasScene {
      const nextScene = defineScene(nextSceneInput);

      if (nextScene.mode === "2d") {
        if (current.mode === "2d") {
          return current.update(nextScene);
        }

        notifyRuntimeChange({
          nextMode: "2d",
          previousMode: current.mode,
          type: "replace"
        });
        current.destroy();
        current = createCanvas2D(target, nextScene, options);
      } else {
        if (current.mode === "3d") {
          return current.update(nextScene);
        }

        notifyRuntimeChange({
          nextMode: "3d",
          previousMode: current.mode,
          type: "replace"
        });
        current.destroy();
        current = createCanvas3D(target, nextScene, options);
      }

      current.setNavigationInputEnabled(navigationInputAllowed);

      return current.getScene();
    }
  };

  return runtime;
}

function isAuthoringPreviewArrayForMode<TMode extends CanvasMode>(
  previews: readonly CanvasAuthoringPreview[],
  mode: TMode
): previews is readonly CanvasAuthoringPreviewForMode<TMode>[] {
  return previews.every((preview) => preview.mode === mode);
}

function createRuntime(
  target: CanvasTarget,
  scene: CanvasScene,
  options: CreateCanvasOptions
) {
  return scene.mode === "2d"
    ? createCanvas2D(target, scene, options)
    : createCanvas3D(target, scene, options);
}

export { createCanvas2D } from "./2d";
export { createCanvas3D } from "./3d";
export {
  CanvasSceneChunkCancelledError,
  createSceneChunkLoader,
  type CanvasSceneChunkLoader,
  type CanvasSceneChunkLoaderOptions,
  type CanvasSceneChunkProgress
} from "./scene-chunks";
export {
  resolveCanvas2DEdgeGeometry,
  resolveCanvas2DNodeWorldCenter
} from "./2d/geometry";
export { createCanvas2DSceneGraph } from "./2d/scene-graph";
export {
  canvasScreenPointSize,
  renderCanvas2DPointField
} from "./2d/point-field";
export type {
  Canvas2DPointFieldEdge,
  Canvas2DPointFieldInput,
  Canvas2DPointFieldPoint,
  Canvas2DPointFieldRange,
  Canvas2DPointFieldStats
} from "./2d/point-field";
export {
  Canvas2DWheelGesture,
  classifyCanvas2DWheelIntent,
  applyCanvas2DWheelNavigation,
  normalizeWheelDelta,
  WHEEL_AXIS_EPS,
  WHEEL_GESTURE_LOCK_MS,
  WHEEL_MOUSE_PIXEL_NOTCH
} from "./2d/wheel-navigation";
export {
  canvasToScenePoint,
  defineCanvas2DViewState,
  fitCanvas2DView,
  flyCanvas2DViewTo,
  getCanvas2DVisibleBounds,
  IDENTITY_CANVAS_2D_VIEW,
  panCanvas2DView,
  sceneToCanvasPoint,
  zoomCanvas2DViewAt
} from "./view2d";
export { connectCanvasSelection, connectCanvasToolInput } from "./selection";
export type { Canvas2DObject, Canvas2DRuntime } from "./2d";
export type { Canvas2DRectBounds, Canvas2DViewportSize, Canvas2DViewState, Canvas2DViewStateInput } from "./view2d";
export type { Canvas2DRenderNode, Canvas2DRenderNodeContext } from "./types";
export type { Canvas3DSectionPlaneInput } from "./types";
export type { ThreeCanvasRuntime } from "./3d";
export type {
  CanvasCameraControlsInput,
  CanvasCameraControlsOptions,
  Canvas2DNavigationOptions,
  Canvas2DOptions,
  Canvas2DViewportRuntime,
  CanvasFrame,
  CanvasAuthoringRuntime,
  CanvasHitSelectionTarget,
  CanvasHitTestRuntime,
  CanvasNavigationInputRuntime,
  CanvasNavigationInputCapability,
  CanvasNavigationInputUnsupported,
  CanvasNodeTransformHandleRuntime,
  CanvasNodeTransformRuntime,
  CanvasPointerSelectionOptions,
  CanvasRuntimeChange,
  CanvasRuntimeChangeListener,
  CanvasRuntimeChangeRuntime,
  CanvasTarget,
  CanvasToolInputTarget,
  CreateCanvasOptions,
  WebCanvasRuntime
} from "./types";
