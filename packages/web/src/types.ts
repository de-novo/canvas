import type {
  CanvasAuthoringPreviewRuntime,
  Canvas3DSurfacePointRuntime,
  CanvasCommandResult,
  CanvasHitResult,
  CanvasHitTestInput,
  CanvasMode,
  CanvasNodeTransformHandleTarget,
  CanvasNodeTransformInput,
  CanvasCreateId,
  CanvasNodeTransformKind,
  CanvasNodeTransformPreviewForMode,
  CanvasSceneForMode,
  CanvasSceneInputForMode,
  CanvasScenePointRuntime,
  CanvasScenePointRuntimeForMode,
  CanvasSelectionMode,
  CanvasStore,
  CanvasToolDefinition,
  CanvasToolInput
} from "@denovo/canvas-core";
import type {
  Canvas2DRectBounds,
  Canvas2DViewState,
  Canvas2DViewStateInput
} from "./view2d";
import type { Canvas2DNode } from "@denovo/canvas-core";

export type CanvasTarget = HTMLElement | HTMLCanvasElement;

/**
 * Render statistics collected per frame or on demand.
 *
 * Mirrors the useful subset of Three.js `WebGLRenderer.info`. For the Canvas2D
 * backend, fields that have no Canvas2D equivalent are left `undefined` rather
 * than fabricated.
 */
export type CanvasRenderStats = {
  /** Number of draw calls issued in the last render. */
  readonly drawCalls?: number;
  /** Number of triangles rendered in the last render. */
  readonly triangles?: number;
  /** Number of distinct geometries currently held by the renderer. */
  readonly geometries?: number;
  /** Number of distinct textures currently held by the renderer. */
  readonly textures?: number;
  /** Number of GPU programs currently compiled. */
  readonly programs?: number;
};

export type CanvasFrame<TMode extends CanvasMode = CanvasMode> = {
  delta: number;
  elapsed: number;
  scene: CanvasSceneForMode<TMode>;
  /**
   * Render statistics for the most recent render. Populated by renderers that
   * track them (Three.js WebGL2). Absent when the renderer cannot supply them
   * or before the first render.
   */
  readonly render?: CanvasRenderStats;
};

export type CanvasCameraControlsOptions = {
  enabled?: boolean;
  enablePan?: boolean;
  enableRotate?: boolean;
  enableZoom?: boolean;
  maxDistance?: number;
  minDistance?: number;
};

export type CanvasCameraControlsInput = boolean | CanvasCameraControlsOptions;

export type Canvas2DNavigationOptions = {
  readonly enablePan?: boolean;
  readonly enableZoom?: boolean;
  readonly maxZoom?: number;
  readonly minZoom?: number;
  readonly wheelZoomSensitivity?: number;
};

export type Canvas2DOptions = {
  readonly initialView?: Canvas2DViewStateInput;
  readonly minimap?: Canvas2DMinimapOptions;
  readonly navigation?: false | Canvas2DNavigationOptions;
};

/** Opt-in scene overview rendered into its own canvas above the main one. */
export type Canvas2DMinimapOptions = {
  readonly position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  readonly width?: number;
  readonly height?: number;
  /** Clicking the minimap flies the main view to that point. Defaults to `true`. */
  readonly interactive?: boolean;
};

export type Canvas2DRenderNodeContext = {
  readonly sceneToCanvas: (point: readonly [number, number]) => readonly [number, number];
  readonly viewState: Canvas2DViewState;
  readonly viewportSize: Readonly<{ width: number; height: number }>;
  readonly selected?: boolean;
};

export type Canvas2DRenderNode = (
  node: Canvas2DNode,
  context: Canvas2DRenderNodeContext
) => HTMLElement | string;

export type CreateCanvasOptions = {
  antialias?: boolean;
  autoStart?: boolean;
  canvas2d?: Canvas2DOptions;
  controls?: CanvasCameraControlsInput;
  devicePixelRatio?: number;
  onFrame?: (
    frame: CanvasFrame,
    runtime: WebCanvasRuntime<CanvasMode>
  ) => void;
  /** When set, `html` nodes are rendered via this callback (returns a DOM element
   * or HTML string). Lets consumers control node design (Tailwind/shadcn/custom).
   * Only the 2D runtime honors this. */
  renderNode?: Canvas2DRenderNode;
};

type WebCanvasRuntimeForMode<TMode extends CanvasMode> = {
  readonly canvas: HTMLCanvasElement;
  readonly mode: TMode;
  readonly ready: Promise<void>;
  readonly store: CanvasStore<TMode>;
  destroy: () => void;
  getScene: () => CanvasSceneForMode<TMode>;
  /**
   * Returns render statistics for the most recent render, or `undefined` when
   * the renderer cannot supply them. Used by performance tooling and the
   * `onFrame` callback.
   */
  getRenderStats: () => CanvasRenderStats | undefined;
  render: () => void;
  resize: () => void;
  start: () => void;
  stop: () => void;
  update: (
    scene: CanvasSceneInputForMode<TMode>
  ) => CanvasSceneForMode<TMode>;
};

type WebCanvasRuntimeForAnyMode = {
  readonly canvas: HTMLCanvasElement;
  readonly mode: CanvasMode;
  readonly ready: Promise<void>;
  readonly store: CanvasStore;
  destroy: () => void;
  getScene: () => CanvasSceneForMode<CanvasMode>;
  getRenderStats: () => CanvasRenderStats | undefined;
  render: () => void;
  resize: () => void;
  start: () => void;
  stop: () => void;
  update: (
    scene: CanvasSceneInputForMode<CanvasMode>
  ) => CanvasSceneForMode<CanvasMode>;
};

export type WebCanvasRuntime<
  TMode extends CanvasMode | undefined = undefined
> = [TMode] extends [undefined]
  ? WebCanvasRuntimeForAnyMode
  : TMode extends CanvasMode
    ? WebCanvasRuntimeForMode<TMode>
    : never;

export type CanvasHitTestRuntime<
  TMode extends CanvasMode | undefined = undefined
> = WebCanvasRuntime<TMode> & {
  hitTest: (input: CanvasHitTestInput) => CanvasHitResult;
};

export type CanvasNavigationInputRuntime = {
  readonly navigationInputSupported: true;
  readonly navigationInputEnabled: boolean;
  setNavigationInputEnabled: (enabled: boolean) => void;
};

export type CanvasNavigationInputUnsupported = {
  readonly navigationInputSupported: false;
};

export type CanvasNavigationInputCapability =
  | CanvasNavigationInputRuntime
  | CanvasNavigationInputUnsupported;

export type CanvasRuntimeChange =
  | {
      readonly generation: number;
      readonly nextMode: CanvasMode;
      readonly previousMode: CanvasMode;
      readonly type: "replace";
    }
  | {
      readonly generation: number;
      readonly previousMode: CanvasMode;
      readonly type: "destroy";
    };

export type CanvasRuntimeChangeListener = (change: CanvasRuntimeChange) => void;

export type CanvasRuntimeChangeRuntime = {
  subscribeRuntimeChange: (
    listener: CanvasRuntimeChangeListener
  ) => () => void;
};

export type Canvas2DViewportRuntime = {
  readonly viewState: Canvas2DViewState;
  canvasToScene: (
    point: readonly [number, number]
  ) => readonly [number, number];
  resetViewState: () => Canvas2DViewState;
  sceneToCanvas: (
    point: readonly [number, number]
  ) => readonly [number, number];
  setViewState: (state: Canvas2DViewStateInput) => Canvas2DViewState;
  getViewportSize: () => Readonly<{ width: number; height: number }>;
  fitViewBounds: (
    bounds: Canvas2DRectBounds,
    padding?: number,
    animate?: boolean
  ) => Canvas2DViewState;
  flyToNode: (
    nodeId: string,
    zoom?: number,
    animate?: boolean
  ) => Canvas2DViewState | null;
  getVisibleBounds: () => Canvas2DRectBounds;
  /** Ids of visible nodes whose world bounds intersect `bounds` (marquee select). */
  getNodesInBounds: (bounds: Canvas2DRectBounds) => readonly string[];
  /** World bounds for the given nodes, for layout/alignment. Missing ids are omitted. */
  resolveNodeBounds: (
    ids: readonly string[]
  ) => ReadonlyMap<string, Canvas2DRectBounds>;
  renderOverlayNode?: Canvas2DRenderNode;
  /** Shows/hides the implicit per-node connection handles and their hit targets. */
  setConnectionHandlesVisible?: (visible: boolean) => void;
  /** Suppresses wheel/pinch zoom while leaving pan intact (tool policy `allow-pan`). */
  setNavigationZoomEnabled?: (enabled: boolean) => void;
  setSelection?: (ids: readonly string[], primaryId?: string | null) => void;
  /** Node currently under the pointer, drawn with a lighter emphasis than selection. */
  setHoveredNode?: (id: string | null) => void;
};

export type CanvasNodeTransformRuntime<
  TMode extends CanvasMode = CanvasMode
> = {
  readonly nodeTransformKinds: readonly CanvasNodeTransformKind[];
  resolveNodeTransform: (
    input: CanvasNodeTransformInput
  ) => CanvasNodeTransformPreviewForMode<TMode>;
  setNodeTransformPreview: (
    preview: CanvasNodeTransformPreviewForMode<TMode> | null
  ) => void;
};

export type CanvasNodeTransformHandleRuntime = {
  setNodeTransformHandleTarget: (
    target: CanvasNodeTransformHandleTarget | null
  ) => void;
};

export type CanvasAuthoringRuntime<
  TMode extends CanvasMode = CanvasMode
> = [CanvasMode] extends [TMode]
  ? CanvasScenePointRuntime & CanvasAuthoringPreviewRuntime
  : CanvasScenePointRuntimeForMode<TMode> &
      CanvasAuthoringPreviewRuntime<TMode>;

export type CanvasHitSelectionTarget = {
  hoverFromHit?: (
    hit: CanvasHitResult
  ) => CanvasCommandResult | null | Promise<CanvasCommandResult | null>;
  selectFromHit: (
    hit: CanvasHitResult,
    mode?: CanvasSelectionMode
  ) => CanvasCommandResult | null | Promise<CanvasCommandResult | null>;
};

export type CanvasToolInputTarget = {
  cancelActiveToolSession: () => Promise<void>;
  getActiveTool: () => CanvasToolDefinition | null;
  handleToolInput: (
    input: CanvasToolInput,
    runtime: Pick<CanvasHitTestRuntime, "hitTest"> &
      Partial<CanvasNodeTransformRuntime> &
      Partial<CanvasAuthoringRuntime> &
      Partial<Canvas3DSurfacePointRuntime> &
      Partial<CanvasAreaQueryRuntime>
  ) => boolean | Promise<boolean>;
  /** Optional history hooks; when present, Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z are bound. */
  undo?: () => unknown;
  redo?: () => unknown;
  /** Optional clipboard hooks; when both are present, Ctrl/Cmd+C and Ctrl/Cmd+V are bound. */
  copySelection?: () => unknown;
  pasteClipboard?: (createId: CanvasCreateId) => unknown;
};

export type CanvasAreaQueryRuntime = {
  getNodesInBounds: (bounds: Canvas2DRectBounds) => readonly string[];
  resolveNodeBounds: (
    ids: readonly string[]
  ) => ReadonlyMap<string, Canvas2DRectBounds>;
};

export type CanvasPointerSelectionOptions = {
  /**
   * Id factory used when pasting. Ctrl/Cmd+V is only bound when this is
   * supplied, since pasted nodes need ids the host controls.
   */
  createId?: CanvasCreateId;
  eventTarget?: HTMLElement;
  hover?: boolean;
  keyboard?: boolean;
  mouseMovementThreshold?: number;
  onError?: (error: unknown) => void;
  resolveSelectionMode?: (event: PointerEvent) => CanvasSelectionMode;
  touchMovementThreshold?: number;
};
