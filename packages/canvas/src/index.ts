import {
  CANVAS_DOCUMENT_SCHEMA_VERSION,
  CanvasNodeTransformKindSchema,
  CanvasSceneSchema,
  defineDocument,
  parseDocument,
  parseDocumentJson,
  type Canvas2DSceneInput,
  type Canvas3DSurfacePointRequest,
  type Canvas3DSurfacePointResult,
  type Canvas3DSurfacePointRuntime,
  type Canvas3DSceneInput,
  type CanvasAuthoringPreviewRuntime,
  type CanvasDocument,
  type CanvasDocumentInput,
  type CanvasHitResult,
  type CanvasHitTestInput,
  type CanvasMode,
  type CanvasNodeTransformHandleTarget,
  type CanvasNodeTransformInput,
  type CanvasNodeTransformPreview,
  type CanvasPlugin,
  type CanvasPluginCommandDescriptor,
  type CanvasPluginCommandHandler,
  type CanvasPluginCommandType,
  type CanvasPluginContext,
  type CanvasPluginToolDefinition,
  type CanvasRendererAdapter,
  type CanvasScene,
  type CanvasSceneInput,
  type CanvasScenePointRequest,
  type CanvasScenePointRequestFor,
  type CanvasScenePointRuntime,
  type CanvasScenePointResult,
  type CanvasScenePointResultFor,
  type CanvasStorageAdapter
} from "@denovo/canvas-core";
import {
  connectEditorToRuntime as connectEditorRuntime,
  connectEditorToStorage,
  type CanvasEditor,
  type CanvasEditorRuntimeTarget,
  type ConnectEditorToStorageOptions
} from "@denovo/canvas-editor";
import {
  connectCanvasSelection,
  connectCanvasToolInput,
  createCanvas as createWebCanvas,
  type CanvasHitTestRuntime,
  type CanvasNavigationInputRuntime,
  type CanvasNavigationInputUnsupported,
  type CanvasNodeTransformHandleRuntime,
  type CanvasNodeTransformRuntime,
  type CanvasPointerSelectionOptions,
  type CanvasRuntimeChangeRuntime,
  type Canvas3DSectionPlaneInput,
  type CanvasTarget,
  type CreateCanvasOptions,
  type DynamicCanvasRuntime,
  type WebCanvasRuntime
} from "@denovo/canvas-web";
import { Cause, Effect, Either, Option } from "effect";

export * from "@denovo/canvas-core";
export * from "./react-query";
export {
  CanvasEditorError,
  applyCommandsToDocument,
  applyCommandsToStoredDocument,
  addLayer,
  applyNamedOperations,
  listLayers,
  listNodes,
  removeEdge,
  removeLayer,
  removeNode,
  reorderLayer,
  setFieldPattern,
  setSparklineStyle,
  setLayerLocked,
  setLayerName,
  setLayerVisible,
  setNodeLayer,
  setNodeLocked,
  setNodeVisible,
  setText,
  stackBox,
  create2DShapeTool,
  create3DPrimitiveTool,
  create3DSurfacePlacementTool,
  createAnnotationTool,
  createConnectorTool,
  createDistanceMeasurementTool,
  createEditor,
  createRelationGraphLayoutAdapter,
  createTimeGraphLayoutAdapter,
  createGroupNodesCommand,
  createNodeUpdateCommand,
  createPanOrbitTool,
  createSelectTool,
  createTransformTool,
  createUngroupNodesCommand,
  getEffectiveNodeState,
  isNodeEffectivelyLocked,
  isNodeEffectivelyVisible,
  snapPointToGrid,
  validateGridWorkPlaneCompatibility
} from "@denovo/canvas-editor";
export type {
  Canvas2DShapeToolOptions,
  Canvas3DPrimitiveToolOptions,
  Canvas3DSurfacePlacementToolOptions,
  CanvasAnnotationDraft,
  CanvasAnnotationDraftContext,
  CanvasAnnotationDraftProvider,
  CanvasAnnotationDraftResult,
  CanvasAnnotationToolOptions,
  CanvasConnectorToolOptions,
  CanvasDistanceMeasurementToolOptions,
  ApplyStoredCommandsOptions,
  CanvasEditor,
  CanvasEditorChange,
  CanvasEditorDispatchResult,
  CanvasEditorErrorCode,
  CanvasEditorHistoryEntry,
  CanvasEditorHistoryState,
  CanvasEditorListener,
  CanvasEditorRuntimeTarget,
  CanvasEditorState,
  CanvasEditorToolRuntimeContext,
  CanvasPersistenceEvent,
  CanvasPersistenceListener,
  CanvasStoredDocument,
  ConnectEditorToStorageOptions,
  CanvasEffectiveNodeState,
  CanvasGroupNodesOptions,
  CanvasPanOrbitToolOptions,
  CanvasSelectToolOptions,
  CanvasTransformToolOptions,
  CreateCanvasEditorOptions,
  AddLayerInput,
  ListedLayer,
  ListedNode,
  ListNodesOptions,
  NamedOperation,
  NamedOperationResult,
  RelationGraphLayoutOptions,
  RemoveEdgeInput,
  RemoveLayerInput,
  RemoveNodeInput,
  ReorderLayerInput,
  SetFieldPatternInput,
  SetSparklineStyleInput,
  SetLayerLockedInput,
  SetLayerNameInput,
  SetLayerVisibleInput,
  SetNodeLayerInput,
  SetNodeLockedInput,
  SetNodeVisibleInput,
  SetTextInput,
  StackBoxFace,
  StackBoxInput,
  TimeGraphLayoutOptions
} from "@denovo/canvas-editor";
export {
  canvasToScenePoint,
  connectCanvasSelection,
  connectCanvasToolInput,
  createCanvas2D,
  createCanvas3D,
  createSceneChunkLoader,
  CanvasSceneChunkCancelledError,
  defineCanvas2DViewState,
  fitCanvas2DView,
  flyCanvas2DViewTo,
  getCanvas2DVisibleBounds,
  IDENTITY_CANVAS_2D_VIEW,
  panCanvas2DView,
  sceneToCanvasPoint,
  zoomCanvas2DViewAt
} from "@denovo/canvas-web";
export type {
  Canvas2DNavigationOptions,
  Canvas2DObject,
  Canvas2DRectBounds,
  Canvas2DRenderNode,
  Canvas2DRenderNodeContext,
  Canvas2DViewportSize,
  Canvas2DViewState,
  Canvas2DViewStateInput,
  Canvas2DOptions,
  Canvas2DRuntime,
  Canvas2DViewportRuntime,
  Canvas3DSectionPlaneInput,
  CanvasCameraControlsInput,
  CanvasCameraControlsOptions,
  CanvasFrame,
  CanvasAuthoringRuntime,
  CanvasHitSelectionTarget,
  CanvasHitTestRuntime,
  CanvasNavigationInputCapability,
  CanvasNavigationInputRuntime,
  CanvasNavigationInputUnsupported,
  CanvasNodeTransformHandleRuntime,
  CanvasNodeTransformRuntime,
  CanvasPointerSelectionOptions,
  CanvasSceneChunkLoader,
  CanvasSceneChunkLoaderOptions,
  CanvasSceneChunkProgress,
  CanvasTarget,
  CanvasToolInputTarget,
  Canvas3DGpuRenderer,
  CreateCanvasOptions,
  DynamicCanvasRuntime,
  ThreeCanvasRuntime,
  WebCanvasRuntime
} from "@denovo/canvas-web";

export type CanvasTargetInput = string | CanvasTarget;
export type CanvasDocumentSource = CanvasDocumentInput | string;

type AbsentCapability<TCapability extends object> = {
  readonly [TKey in keyof TCapability]?: never;
};

type OptionalCapability<TCapability extends object> =
  | TCapability
  | AbsentCapability<TCapability>;

type CanvasFacadeRendererNavigationCapability =
  | CanvasNavigationInputRuntime
  | (CanvasNavigationInputUnsupported &
      AbsentCapability<
        Omit<CanvasNavigationInputRuntime, "navigationInputSupported">
      >);

export type CanvasFacadeRendererRuntime = WebCanvasRuntime &
  OptionalCapability<Pick<CanvasHitTestRuntime, "hitTest">> &
  CanvasFacadeRendererNavigationCapability &
  OptionalCapability<CanvasNodeTransformHandleRuntime> &
  OptionalCapability<CanvasNodeTransformRuntime> &
  OptionalCapability<CanvasScenePointRuntime> &
  OptionalCapability<CanvasAuthoringPreviewRuntime> &
  OptionalCapability<Canvas3DSurfacePointRuntime> &
  OptionalCapability<CanvasRuntimeChangeRuntime>;
export type CanvasFacadeRendererAdapter = CanvasRendererAdapter<
  CanvasTarget,
  CanvasFacadeRendererRuntime,
  CreateCanvasOptions
>;
/**
 * Renderer backend selector.
 *
 * `auto` resolves only to an implemented built-in: Canvas2D for 2D scenes and
 * WebGL2 for 3D scenes. Explicit `webgpu` is a 3D built-in and is never an
 * `auto` result. `offscreen-canvas2d` stays reserved; requesting it fails
 * with `backend-unimplemented` until a runtime exists.
 */
export type CanvasBackend =
  | "auto"
  | "webgpu"
  | "webgl2"
  | "canvas2d"
  | "offscreen-canvas2d"
  | "custom";
/** Built-in backends that `auto` may currently resolve to. */
export type CanvasImplementedBackend = "canvas2d" | "webgl2";
/** Reserved built-in names. Requests fail until a runtime is implemented. */
export type CanvasUnimplementedBackend = "offscreen-canvas2d";
/** Successful resolution result. Never `auto` or an unimplemented built-in. */
export type CanvasResolvedBackend =
  | CanvasImplementedBackend
  | "webgpu"
  | "custom";
export type CanvasBuiltInBackend = Exclude<CanvasBackend, "custom">;
export type RendererPreset = CanvasBuiltInBackend | "three";
export type CanvasThemePreset = "dark" | "light";

export type CanvasRendererConfig =
  | {
      adapter?: never;
      backend?: CanvasBuiltInBackend;
    }
  | {
      adapter: CanvasFacadeRendererAdapter;
      backend: "custom";
    };

export type CanvasRendererInput =
  | RendererPreset
  | CanvasFacadeRendererAdapter
  | CanvasRendererConfig;

export type CanvasBackendCapabilities = {
  canvas2d: boolean;
  offscreenCanvas2d: boolean;
  webgl2: boolean;
  webgpu: boolean;
};

export type CanvasBackendResolutionErrorCode =
  | "adapter-required"
  | "backend-unimplemented"
  | "capability-unavailable"
  | "mode-mismatch";

export type ResolvedCanvasRenderer = {
  adapterName: string;
  capabilities: CanvasBackendCapabilities;
  requested: CanvasBackend;
  resolved: CanvasResolvedBackend;
};

export class CanvasBackendResolutionError extends Error {
  readonly code: CanvasBackendResolutionErrorCode;
  readonly mode: CanvasMode;
  readonly requested: Exclude<CanvasBackend, "auto">;

  constructor(
    code: CanvasBackendResolutionErrorCode,
    requested: Exclude<CanvasBackend, "auto">,
    mode: CanvasMode,
    message: string
  ) {
    super(message);
    this.name = "CanvasBackendResolutionError";
    this.code = code;
    this.mode = mode;
    this.requested = requested;
  }
}

export type CanvasThemeInput = {
  background?: string;
  className?: string;
  fontFamily?: string;
  gridColor?: string;
  handleColor?: string;
  overlayColor?: string;
  selectionColor?: string;
};

export type DenovoCanvasCommonConfig = Omit<CreateCanvasOptions, "onFrame"> & {
  className?: string;
  editable?: boolean;
  onFrame?: CreateCanvasOptions["onFrame"];
  plugins?: readonly CanvasPlugin[];
  renderer?: CanvasRendererInput;
  theme?: CanvasThemePreset | CanvasThemeInput;
};

type DenovoCanvasDocumentConfig = {
  background?: never;
  document: CanvasDocumentSource;
  id?: never;
  layers?: never;
  mode?: never;
  nodes?: never;
  scene?: never;
};

type DenovoCanvasSceneConfig = {
  background?: never;
  document?: never;
  id?: never;
  layers?: never;
  mode?: never;
  nodes?: never;
  scene: CanvasSceneInput;
};

type DenovoCanvasInlineSceneBase = {
  background?: string;
  document?: never;
  id?: string;
  layers?: CanvasSceneInput["layers"];
  scene?: never;
};

type DenovoCanvasInline2DConfig = DenovoCanvasInlineSceneBase & {
  mode: "2d";
  nodes?: Canvas2DSceneInput["nodes"];
};

type DenovoCanvasInline3DConfig = DenovoCanvasInlineSceneBase & {
  mode: "3d";
  nodes?: Canvas3DSceneInput["nodes"];
};

type DenovoCanvasInferredInlineConfig = DenovoCanvasInlineSceneBase & {
  mode?: never;
  nodes?: never;
};

export type DenovoCanvasConfig = DenovoCanvasCommonConfig &
  (
    | DenovoCanvasDocumentConfig
    | DenovoCanvasSceneConfig
    | DenovoCanvasInline2DConfig
    | DenovoCanvasInline3DConfig
    | DenovoCanvasInferredInlineConfig
  );

export type ResolvedDenovoCanvasConfig = {
  editable: boolean;
  pluginNames: readonly string[];
  renderer: ResolvedCanvasRenderer;
  theme: CanvasThemePreset | "custom";
};

type CanvasFacadeRegistry = {
  commands: Map<CanvasPluginCommandType, CanvasFacadeCommandRegistration>;
  tools: CanvasPluginToolDefinition[];
};

type CanvasFacadeCommandRegistration = {
  attach: (editor: CanvasEditor) => () => void;
};

type CanvasFacadeRegistryBinding = {
  detach: (() => void) | undefined;
  editor: CanvasEditor;
};

type CanvasFacadeRegistryController = {
  commit: (staged: CanvasFacadeRegistry) => void;
  connect: (editor: CanvasEditor) => () => void;
  destroy: () => void;
};

const facadeRegistryControllers = new WeakMap<
  CanvasEditorRuntimeTarget,
  CanvasFacadeRegistryController
>();

export type CanvasFacadeCurrentRuntime =
  | DynamicCanvasRuntime["current"]
  | CanvasFacadeRendererRuntime;

type DenovoCanvasRuntimeBase = Omit<
  DynamicCanvasRuntime,
  | "current"
  | "navigationInputEnabled"
  | "navigationInputSupported"
  | "nodeTransformKinds"
  | "resolveNodeTransform"
  | "setNavigationInputEnabled"
  | "setNodeTransformHandleTarget"
  | "setNodeTransformPreview"
  | "resolveScenePoint"
  | "resolveSurfacePoint"
  | "setAuthoringPreviews"
  | "subscribeRuntimeChange"
> &
  OptionalCapability<CanvasNodeTransformHandleRuntime> &
  OptionalCapability<CanvasNodeTransformRuntime> &
  OptionalCapability<CanvasScenePointRuntime> &
  OptionalCapability<CanvasAuthoringPreviewRuntime> &
  OptionalCapability<Canvas3DSurfacePointRuntime> &
  OptionalCapability<CanvasRuntimeChangeRuntime> & {
    readonly current: CanvasFacadeCurrentRuntime;
    readonly config: ResolvedDenovoCanvasConfig;
    getDocument: () => CanvasDocument | null;
    loadDocument: (document: CanvasDocumentSource) => CanvasDocument;
  };

export type CanvasFacadeNavigationInputUnsupportedRuntime =
  CanvasNavigationInputUnsupported & {
    readonly navigationInputEnabled: false;
    setNavigationInputEnabled: (enabled: boolean) => never;
  };

export type DenovoCanvasRuntime = DenovoCanvasRuntimeBase &
  (
    | CanvasNavigationInputRuntime
    | CanvasFacadeNavigationInputUnsupportedRuntime
  );

export type ConnectEditorToCanvasOptions = CanvasPointerSelectionOptions & {
  storage?: CanvasStorageAdapter;
  storageDebounceMs?: number;
  storageOnConflict?: ConnectEditorToStorageOptions["onConflict"];
  syncDocument?: boolean;
};

export class CanvasHitTestUnsupportedError extends Error {
  readonly renderer: string;

  constructor(renderer: string) {
    super(`Canvas renderer does not support hit testing: ${renderer}`);
    this.name = "CanvasHitTestUnsupportedError";
    this.renderer = renderer;
  }
}

export class CanvasNavigationInputUnsupportedError extends Error {
  readonly renderer: string;

  constructor(renderer: string) {
    super(`Canvas renderer does not support navigation input: ${renderer}`);
    this.name = "CanvasNavigationInputUnsupportedError";
    this.renderer = renderer;
  }
}

export type CanvasPluginErrorCode =
  | "duplicate-command"
  | "duplicate-tool"
  | "internal-error"
  | "invalid-command"
  | "invalid-tool"
  | "runtime-destroyed"
  | "setup-failed";

export class CanvasPluginError extends Error {
  readonly code: CanvasPluginErrorCode;
  override readonly cause: unknown;
  readonly pluginName: string | undefined;

  constructor(
    code: CanvasPluginErrorCode,
    message: string,
    options: {
      cause?: unknown;
      pluginName?: string;
    } = {}
  ) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause }
    );
    this.name = "CanvasPluginError";
    this.code = code;
    this.cause = options.cause;
    this.pluginName = options.pluginName;
  }
}

export function defineCanvasPlugin(plugin: CanvasPlugin): CanvasPlugin {
  return plugin;
}

export function defineCanvasConfig(config: DenovoCanvasConfig): DenovoCanvasConfig {
  return config;
}

export function connectEditorToRuntime(
  editor: CanvasEditor,
  runtime: CanvasEditorRuntimeTarget
): () => void {
  const disconnectPlugins = connectFacadePlugins(editor, runtime);

  try {
    const disconnectRuntime = connectEditorRuntime(editor, runtime);

    return () => {
      disconnectRuntime();
      disconnectPlugins();
    };
  } catch (cause) {
    disconnectPlugins();
    throw cause;
  }
}

export function connectEditorToCanvas(
  editor: CanvasEditor,
  runtime: DenovoCanvasRuntime,
  options: ConnectEditorToCanvasOptions = {}
): () => void {
  if (!isCanvasHitTestRuntime(runtime.current)) {
    throw new CanvasHitTestUnsupportedError(runtime.config.renderer.adapterName);
  }

  const disconnectPlugins = connectFacadePlugins(editor, runtime);
  const disconnectRuntime =
    options.syncDocument === false
      ? () => undefined
      : connectEditorRuntime(editor, runtime);
  let disconnectSelection: () => void = () => undefined;
  let disconnectToolState: () => void = () => undefined;
  let disconnectStorage: () => void = () => undefined;

  try {
    disconnectSelection = connectCanvasToolInput(runtime, editor, options);
    disconnectToolState = connectEditorToolState(editor, runtime);

    if (options.storage) {
      disconnectStorage = connectEditorToStorage(editor, options.storage, {
        ...(options.storageDebounceMs === undefined
          ? {}
          : { debounceMs: options.storageDebounceMs }),
        ...(options.storageOnConflict === undefined
          ? {}
          : { onConflict: options.storageOnConflict })
      });
    }
  } catch (cause) {
    disconnectStorage();
    disconnectSelection();
    disconnectRuntime();
    disconnectPlugins();
    throw cause;
  }

  return () => {
    disconnectStorage();
    disconnectToolState();
    disconnectSelection();
    disconnectRuntime();
    disconnectPlugins();
  };
}

function connectEditorToolState(
  editor: CanvasEditor,
  runtime: DenovoCanvasRuntime
): () => void {
  const previousNavigationInputEnabled = runtime.navigationInputEnabled;

  function syncToolState() {
    const tool = editor.getActiveTool();
    const selectedNodeId = editor.getState().selection.primaryId;
    const transformHandleTarget: CanvasNodeTransformHandleTarget | null =
      tool?.transform && selectedNodeId
        ? { kind: tool.transform, nodeId: selectedNodeId }
        : null;
    runtime.canvas.style.cursor = tool?.cursor ?? "";
    runtime.setNavigationInputEnabled(tool?.navigation !== "block");
    (
      runtime as {
        setNavigationZoomEnabled?: (enabled: boolean) => void;
        setConnectionHandlesVisible?: (visible: boolean) => void;
      }
    ).setNavigationZoomEnabled?.(tool?.navigation !== "allow-pan");
    (
      runtime as {
        setConnectionHandlesVisible?: (visible: boolean) => void;
      }
    ).setConnectionHandlesVisible?.(tool?.connectionHandles === true);
    runtime.setNodeTransformHandleTarget?.(transformHandleTarget);
  }

  syncToolState();
  const unsubscribe = editor.subscribe(() => {
    syncToolState();
  });

  return () => {
    unsubscribe();
    runtime.setNodeTransformHandleTarget?.(null);
    runtime.canvas.style.removeProperty("cursor");
    runtime.setNavigationInputEnabled(previousNavigationInputEnabled);
  };
}

export function createCanvas(
  targetInput: CanvasTargetInput,
  config: DenovoCanvasConfig = {}
): DenovoCanvasRuntime {
  assertValidCanvasConfig(config);
  const target = resolveTarget(targetInput);
  let currentDocument = isDocumentConfig(config)
    ? resolveDocumentSource(config.document)
    : null;
  const scene = currentDocument?.scene ?? resolveScene(config);
  const theme = resolveTheme(config.theme);
  let renderer = resolveRenderer(config.renderer, scene);
  const host = applyHostContract(target, scene, config, theme, renderer);
  const registry = createRegistry();
  const registryController = createRegistryController(registry);
  const pluginReady = setupPlugins(config.plugins ?? [], registryController);
  const options: CreateCanvasOptions = {
    ...(config.antialias === undefined ? {} : { antialias: config.antialias }),
    ...(config.autoStart === undefined ? {} : { autoStart: config.autoStart }),
    ...(config.canvas2d === undefined ? {} : { canvas2d: config.canvas2d }),
    ...(config.controls === undefined ? {} : { controls: config.controls }),
    ...(config.devicePixelRatio === undefined
      ? {}
      : { devicePixelRatio: config.devicePixelRatio }),
    ...(config.onFrame === undefined ? {} : { onFrame: config.onFrame }),
    ...(config.geometryStore === undefined
      ? {}
      : { geometryStore: config.geometryStore }),
    ...(config.renderNode === undefined ? {} : { renderNode: config.renderNode }),
    ...(renderer.resolved === "webgpu" ? { gpuBackend: "webgpu" as const } : {})
  };
  const customAdapter = resolveRendererAdapter(config.renderer);
  const runtime = createResolvedRendererRuntime(
    renderer,
    customAdapter,
    target,
    scene,
    options
  );

  function resolveRuntimeScenePoint(
    request: CanvasScenePointRequestFor<"2d">
  ):
    | CanvasScenePointResultFor<"2d">
    | Promise<CanvasScenePointResultFor<"2d">>;
  function resolveRuntimeScenePoint(
    request: CanvasScenePointRequestFor<"3d">
  ):
    | CanvasScenePointResultFor<"3d">
    | Promise<CanvasScenePointResultFor<"3d">>;
  function resolveRuntimeScenePoint(
    request: CanvasScenePointRequest
  ): CanvasScenePointResult | Promise<CanvasScenePointResult> {
    if (typeof runtime.resolveScenePoint !== "function") {
      throw new Error("Canvas renderer does not support scene-point resolution.");
    }

    if (request.mode === "2d") {
      return runtime.resolveScenePoint(request);
    }

    return runtime.resolveScenePoint(request);
  }
  function resolveRuntimeSurfacePoint(
    request: Canvas3DSurfacePointRequest
  ): Canvas3DSurfacePointResult | Promise<Canvas3DSurfacePointResult> {
    if (typeof runtime.resolveSurfacePoint !== "function") {
      throw new Error(
        "Canvas renderer does not support 3D surface-point resolution."
      );
    }

    return runtime.resolveSurfacePoint(request);
  }
  const resolvedConfig: ResolvedDenovoCanvasConfig = {
    editable: config.editable ?? false,
    pluginNames: config.plugins?.map((plugin) => plugin.name) ?? [],
    renderer,
    theme: typeof config.theme === "string" ? config.theme : theme.name
  };
  const transformRuntime = isCanvasNodeTransformRuntime(runtime)
    ? {
        nodeTransformKinds: runtime.nodeTransformKinds,
        resolveNodeTransform: (input: CanvasNodeTransformInput) =>
          runtime.resolveNodeTransform(input),
        setNodeTransformPreview: (preview: CanvasNodeTransformPreview | null) =>
          runtime.setNodeTransformPreview(preview)
      }
    : {};
  const transformHandleRuntime = isCanvasNodeTransformHandleRuntime(runtime)
    ? {
        setNodeTransformHandleTarget: (
          targetValue: CanvasNodeTransformHandleTarget | null
        ) => runtime.setNodeTransformHandleTarget(targetValue)
      }
    : {};
  const scenePointRuntime = isCanvasScenePointRuntime(runtime)
    ? {
        resolveScenePoint: resolveRuntimeScenePoint
      }
    : {};
  const authoringPreviewRuntime = isCanvasAuthoringPreviewRuntime(runtime)
    ? {
        setAuthoringPreviews: (
          previews: Parameters<
            CanvasAuthoringPreviewRuntime["setAuthoringPreviews"]
          >[0]
        ) => runtime.setAuthoringPreviews(previews)
      }
    : {};
  const surfacePointRuntime = isCanvas3DSurfacePointRuntime(runtime)
    ? {
        resolveSurfacePoint: resolveRuntimeSurfacePoint
      }
    : {};
  const runtimeChangeRuntime =
    "subscribeRuntimeChange" in runtime &&
    typeof runtime.subscribeRuntimeChange === "function"
      ? {
          subscribeRuntimeChange:
            runtime.subscribeRuntimeChange.bind(runtime)
        }
      : {};

  function updateRuntimeScene(nextSceneInput: CanvasSceneInput): CanvasScene {
    const nextScene = CanvasSceneSchema.parse(nextSceneInput);
    const nextRenderer = resolveRenderer(config.renderer, nextScene);

    if (customAdapter) {
      assertAdapterSupportsMode(customAdapter, nextScene.mode);
    }

    const updatedScene = CanvasSceneSchema.parse(runtime.update(nextScene));

    if (updatedScene.mode !== nextScene.mode) {
      throw new Error(
        `Canvas renderer ${nextRenderer.adapterName} updated a ${nextScene.mode} scene as ${updatedScene.mode}.`
      );
    }

    renderer = nextRenderer;
    resolvedConfig.renderer = renderer;
    host.dataset.denovoBackend = renderer.resolved;
    host.dataset.denovoMode = updatedScene.mode;

    if (currentDocument) {
      currentDocument = defineDocument({
        ...currentDocument,
        scene: updatedScene
      });
    }

    return updatedScene;
  }

  const facadeRuntimeBase: DenovoCanvasRuntimeBase = {
    config: resolvedConfig,
    ...runtimeChangeRuntime,
    ...surfacePointRuntime,
    ...authoringPreviewRuntime,
    ...scenePointRuntime,
    ...transformHandleRuntime,
    ...transformRuntime,
    get canvas() {
      return runtime.canvas;
    },
    get current() {
      return getCurrentRuntime(runtime);
    },
    get mode() {
      return runtime.mode;
    },
    get ready() {
      return Promise.all([runtime.ready, pluginReady]).then(() => undefined);
    },
    get store() {
      return runtime.store;
    },
    destroy() {
      registryController.destroy();
      runtime.destroy();
      host.removeAttribute("data-denovo-backend");
      host.removeAttribute("data-denovo-editable");
      host.removeAttribute("data-denovo-mode");
      host.removeAttribute("data-denovo-ready");
      host.removeAttribute("data-denovo-theme");
    },
    getScene() {
      return runtime.getScene();
    },
    getRenderStats() {
      return runtime.getRenderStats();
    },
    hitTest(input: CanvasHitTestInput): CanvasHitResult {
      if (!isCanvasHitTestRuntime(runtime)) {
        throw new CanvasHitTestUnsupportedError(renderer.adapterName);
      }

      return runtime.hitTest(input);
    },
    getDocument() {
      return currentDocument;
    },
    loadDocument(documentSource) {
      const document = resolveDocumentSource(documentSource);
      const updatedScene = updateRuntimeScene(document.scene);
      currentDocument = defineDocument({
        ...document,
        scene: updatedScene
      });
      return currentDocument;
    },
    render() {
      runtime.render();
    },
    resize() {
      runtime.resize();
    },
    setSectionPlane(section: Canvas3DSectionPlaneInput | null) {
      // Optional capability: only the Three.js runtime implements it.
      runtime.setSectionPlane?.(section);
    },
    start() {
      runtime.start();
    },
    stop() {
      runtime.stop();
    },
    update(nextSceneInput) {
      return updateRuntimeScene(nextSceneInput);
    }
  };

  const facadeRuntime = isCanvasNavigationInputRuntime(runtime)
    ? (Object.defineProperties(facadeRuntimeBase, {
        navigationInputEnabled: {
          enumerable: true,
          get: () => runtime.navigationInputEnabled
        },
        navigationInputSupported: {
          enumerable: true,
          value: true
        },
        setNavigationInputEnabled: {
          enumerable: true,
          value: (enabled: boolean) => runtime.setNavigationInputEnabled(enabled)
        }
      }) as DenovoCanvasRuntime)
    : (Object.defineProperties(facadeRuntimeBase, {
        navigationInputEnabled: {
          enumerable: true,
          value: false
        },
        navigationInputSupported: {
          enumerable: true,
          value: false
        },
        setNavigationInputEnabled: {
          enumerable: true,
          value: (_enabled: boolean): never => {
            throw new CanvasNavigationInputUnsupportedError(renderer.adapterName);
          }
        }
      }) as DenovoCanvasRuntime);

  facadeRegistryControllers.set(facadeRuntime, registryController);
  void facadeRuntime.ready.then(
    () => {
      host.dataset.denovoReady = "true";
    },
    () => {
      host.dataset.denovoReady = "error";
    }
  );
  return facadeRuntime;
}

function resolveDocumentSource(source: CanvasDocumentSource): CanvasDocument {
  return typeof source === "string"
    ? parseDocumentJson(source)
    : parseDocument(source);
}

function createResolvedRendererRuntime(
  renderer: ResolvedCanvasRenderer,
  customAdapter: CanvasFacadeRendererAdapter | null,
  target: CanvasTarget,
  scene: CanvasScene,
  options: CreateCanvasOptions
): DynamicCanvasRuntime | CanvasFacadeRendererRuntime {
  if (renderer.resolved === "custom") {
    if (!customAdapter) {
      throw new CanvasBackendResolutionError(
        "adapter-required",
        "custom",
        scene.mode,
        "The resolved custom canvas backend has no renderer adapter."
      );
    }

    return createCustomRendererRuntime(customAdapter, target, scene, options);
  }

  if (customAdapter) {
    throw new Error(
      `Canvas renderer adapter ${customAdapter.name} cannot be used with resolved built-in backend ${renderer.resolved}.`
    );
  }

  return createWebCanvas(target, scene, options);
}

function createCustomRendererRuntime(
  adapter: CanvasFacadeRendererAdapter,
  target: CanvasTarget,
  scene: CanvasScene,
  options: CreateCanvasOptions
): CanvasFacadeRendererRuntime {
  assertAdapterSupportsMode(adapter, scene.mode);
  const runtime = adapter.createRuntime(target, scene, options);
  assertCanvasFacadeRendererRuntime(runtime, adapter.name);

  const runtimeScene = CanvasSceneSchema.parse(runtime.getScene());

  if (runtimeScene.mode !== scene.mode) {
    throw new Error(
      `Canvas renderer adapter ${adapter.name} created mode ${runtimeScene.mode} for a ${scene.mode} scene.`
    );
  }

  return runtime;
}

function assertAdapterSupportsMode(
  adapter: CanvasFacadeRendererAdapter,
  mode: CanvasMode
) {
  if (!adapter.modes.includes(mode)) {
    throw new Error(
      `Canvas renderer adapter ${adapter.name} does not support scene mode: ${mode}.`
    );
  }
}

function getCurrentRuntime(
  runtime: DynamicCanvasRuntime | CanvasFacadeRendererRuntime
): CanvasFacadeCurrentRuntime {
  return "current" in runtime ? runtime.current : runtime;
}

function isCanvasHitTestRuntime(value: unknown): value is CanvasHitTestRuntime {
  return (
    typeof value === "object" &&
    value !== null &&
    "hitTest" in value &&
    typeof value.hitTest === "function"
  );
}

function isCanvasNavigationInputRuntime(
  value: DynamicCanvasRuntime | CanvasFacadeRendererRuntime
): value is DynamicCanvasRuntime | (CanvasFacadeRendererRuntime & CanvasNavigationInputRuntime) {
  return (
    value.navigationInputSupported === true &&
    typeof value.setNavigationInputEnabled === "function" &&
    typeof value.navigationInputEnabled === "boolean"
  );
}

function isCanvasNodeTransformRuntime(
  value: DynamicCanvasRuntime | CanvasFacadeRendererRuntime
): value is DynamicCanvasRuntime | (CanvasFacadeRendererRuntime & CanvasNodeTransformRuntime) {
  return (
    Array.isArray(value.nodeTransformKinds) &&
    typeof value.resolveNodeTransform === "function" &&
    typeof value.setNodeTransformPreview === "function"
  );
}

function isCanvasNodeTransformHandleRuntime(
  value: DynamicCanvasRuntime | CanvasFacadeRendererRuntime
): value is
  | DynamicCanvasRuntime
  | (CanvasFacadeRendererRuntime & CanvasNodeTransformHandleRuntime) {
  return typeof value.setNodeTransformHandleTarget === "function";
}

function isCanvasScenePointRuntime(
  value: DynamicCanvasRuntime | CanvasFacadeRendererRuntime
): value is
  | DynamicCanvasRuntime
  | (CanvasFacadeRendererRuntime & CanvasScenePointRuntime) {
  return typeof value.resolveScenePoint === "function";
}

function isCanvasAuthoringPreviewRuntime(
  value: DynamicCanvasRuntime | CanvasFacadeRendererRuntime
): value is
  | DynamicCanvasRuntime
  | (CanvasFacadeRendererRuntime & CanvasAuthoringPreviewRuntime) {
  return typeof value.setAuthoringPreviews === "function";
}

function isCanvas3DSurfacePointRuntime(
  value: DynamicCanvasRuntime | CanvasFacadeRendererRuntime
): value is
  | DynamicCanvasRuntime
  | (CanvasFacadeRendererRuntime & Canvas3DSurfacePointRuntime) {
  return typeof value.resolveSurfacePoint === "function";
}

function assertCanvasFacadeRendererRuntime(
  value: unknown,
  adapterName: string
): asserts value is CanvasFacadeRendererRuntime {
  const prefix = `Canvas renderer adapter ${adapterName}`;

  if (typeof value !== "object" || value === null) {
    throw new TypeError(`${prefix} must return a facade runtime object.`);
  }

  const runtime = value as Record<PropertyKey, unknown>;
  const navigationSupported = runtime.navigationInputSupported;

  if (navigationSupported === true) {
    if (
      typeof runtime.navigationInputEnabled !== "boolean" ||
      typeof runtime.setNavigationInputEnabled !== "function"
    ) {
      throw new TypeError(
        `${prefix} must provide navigationInputEnabled and setNavigationInputEnabled when navigation input is supported.`
      );
    }
  } else if (
    navigationSupported === false &&
    ("navigationInputEnabled" in runtime ||
      "setNavigationInputEnabled" in runtime)
  ) {
    throw new TypeError(
      `${prefix} cannot expose navigation input methods when navigation input is unsupported.`
    );
  } else if (navigationSupported !== false) {
    throw new TypeError(
      `${prefix} must declare navigationInputSupported as true or false.`
    );
  }

  assertOptionalRuntimeCapability(
    runtime,
    [["hitTest", isFunction]],
    "hit testing",
    prefix
  );
  assertOptionalRuntimeCapability(
    runtime,
    [["setNodeTransformHandleTarget", isFunction]],
    "transform handles",
    prefix
  );
  assertOptionalRuntimeCapability(
    runtime,
    [
      ["nodeTransformKinds", Array.isArray],
      ["resolveNodeTransform", isFunction],
      ["setNodeTransformPreview", isFunction]
    ],
    "node transforms",
    prefix
  );
  assertOptionalRuntimeCapability(
    runtime,
    [["resolveScenePoint", isFunction]],
    "scene-point resolution",
    prefix
  );
  assertOptionalRuntimeCapability(
    runtime,
    [["setAuthoringPreviews", isFunction]],
    "authoring previews",
    prefix
  );
  assertOptionalRuntimeCapability(
    runtime,
    [["resolveSurfacePoint", isFunction]],
    "3D surface-point resolution",
    prefix
  );
  assertOptionalRuntimeCapability(
    runtime,
    [["subscribeRuntimeChange", isFunction]],
    "runtime change notifications",
    prefix
  );

  if (runtime.mode !== "2d" && runtime.mode !== "3d") {
    throw new TypeError(`${prefix} runtime mode must be "2d" or "3d".`);
  }

  if (!isPromiseLike(runtime.ready)) {
    throw new TypeError(
      `${prefix} runtime.ready must be a promise; asynchronous initialization belongs in that promise.`
    );
  }

  const requiredMethods = [
    "destroy",
    "getScene",
    "render",
    "resize",
    "start",
    "stop",
    "update"
  ] as const;
  const invalidMethods = requiredMethods.filter(
    (method) => typeof runtime[method] !== "function"
  );

  if (invalidMethods.length > 0) {
    throw new TypeError(
      `${prefix} runtime is missing required methods: ${invalidMethods.join(", ")}.`
    );
  }

  if (runtime.canvas === undefined || runtime.store === undefined) {
    throw new TypeError(`${prefix} runtime must expose canvas and store.`);
  }
}

type CapabilityValidator = readonly [
  key: PropertyKey,
  validate: (value: unknown) => boolean
];

function hasValidOptionalCapability(
  runtime: Record<PropertyKey, unknown>,
  validators: readonly CapabilityValidator[]
): boolean {
  const presentCount = validators.filter(([key]) => key in runtime).length;

  if (presentCount === 0) {
    return true;
  }

  return (
    presentCount === validators.length &&
    validators.every(([key, validate]) => validate(runtime[key]))
  );
}

function assertOptionalRuntimeCapability(
  runtime: Record<PropertyKey, unknown>,
  validators: readonly CapabilityValidator[],
  capabilityName: string,
  prefix: string
): void {
  if (hasValidOptionalCapability(runtime, validators)) {
    return;
  }

  throw new TypeError(
    `${prefix} must provide all or none of the ${capabilityName} capability fields: ${validators.map(([key]) => String(key)).join(", ")}.`
  );
}

function isFunction(value: unknown): value is (...args: never[]) => unknown {
  return typeof value === "function";
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}

function resolveTarget(targetInput: CanvasTargetInput): CanvasTarget {
  if (typeof targetInput !== "string") {
    return targetInput;
  }

  const target = document.querySelector<HTMLElement>(targetInput);

  if (!target) {
    throw new Error(`Denovo Canvas target was not found: ${targetInput}`);
  }

  return target;
}

function resolveScene(config: DenovoCanvasConfig): CanvasScene {
  if (isSceneConfig(config)) {
    return CanvasSceneSchema.parse(config.scene);
  }

  if (isDocumentConfig(config)) {
    throw new Error(
      "A document-backed canvas scene must be resolved from the document."
    );
  }

  const mode = resolveSceneMode(config);

  return CanvasSceneSchema.parse({
    id: config.id ?? "scene",
    ...(config.layers === undefined ? {} : { layers: config.layers }),
    mode: mode ?? "3d",
    ...(config.background === undefined
      ? {}
      : { background: config.background }),
    ...(config.nodes === undefined ? {} : { nodes: config.nodes })
  });
}

function isDocumentConfig(
  config: DenovoCanvasConfig
): config is DenovoCanvasCommonConfig & DenovoCanvasDocumentConfig {
  return hasOwn(config, "document");
}

function isSceneConfig(
  config: DenovoCanvasConfig
): config is DenovoCanvasCommonConfig & DenovoCanvasSceneConfig {
  return hasOwn(config, "scene");
}

const inlineSceneKeys = [
  "background",
  "id",
  "layers",
  "mode",
  "nodes"
] as const;

function assertValidCanvasConfig(
  input: unknown
): asserts input is DenovoCanvasConfig {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new TypeError("Canvas config must be an object.");
  }

  const config = input as Record<PropertyKey, unknown>;
  const hasDocument = hasOwn(config, "document");
  const hasScene = hasOwn(config, "scene");
  const inlineKeys = inlineSceneKeys.filter((key) => hasOwn(config, key));

  if (hasDocument && config.document === undefined) {
    throw new TypeError("Canvas config document must be defined when provided.");
  }

  if (hasScene && config.scene === undefined) {
    throw new TypeError("Canvas config scene must be defined when provided.");
  }

  if (hasDocument && hasScene) {
    throw new TypeError(
      "Canvas config accepts exactly one scene source: document, scene, or inline scene fields."
    );
  }

  if ((hasDocument || hasScene) && inlineKeys.length > 0) {
    throw new TypeError(
      `Canvas config ${hasDocument ? "document" : "scene"} cannot be combined with inline scene fields: ${inlineKeys.join(", ")}.`
    );
  }

  if (!hasDocument && !hasScene) {
    const hasMode = hasOwn(config, "mode");
    const hasNodes = hasOwn(config, "nodes");

    if (hasMode && config.mode !== "2d" && config.mode !== "3d") {
      throw new TypeError('Canvas config mode must be either "2d" or "3d".');
    }

    if (hasNodes && config.nodes === undefined) {
      throw new TypeError("Canvas config nodes must be defined when provided.");
    }

    if (hasNodes && !hasMode) {
      throw new TypeError(
        "Canvas config inline nodes require an explicit mode so node types are unambiguous."
      );
    }
  }

  if (hasOwn(config, "renderer") && config.renderer === undefined) {
    throw new TypeError("Canvas config renderer must be defined when provided.");
  }

  assertRendererInput(config.renderer);
}

function hasOwn<TObject extends object, TKey extends PropertyKey>(
  value: TObject,
  key: TKey
): value is TObject & Record<TKey, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function resolveSceneMode(config: DenovoCanvasConfig): CanvasMode | null {
  if (config.mode) {
    return config.mode;
  }

  const backend = resolveRequestedBackend(config.renderer);
  const adapter = resolveRendererAdapter(config.renderer);

  if (
    backend === "canvas2d" ||
    backend === "offscreen-canvas2d" ||
    (adapter?.modes.length === 1 && adapter.modes[0] === "2d")
  ) {
    return "2d";
  }

  if (
    backend === "webgpu" ||
    backend === "webgl2" ||
    config.renderer === "three" ||
    (adapter?.modes.length === 1 && adapter.modes[0] === "3d")
  ) {
    return "3d";
  }

  return null;
}

function applyHostContract(
  target: CanvasTarget,
  scene: CanvasScene,
  config: DenovoCanvasConfig,
  theme: ResolvedTheme,
  renderer: ResolvedCanvasRenderer
) {
  const host = isCanvasElement(target) ? target : target;
  host.classList.add("denovo-canvas");

  for (const className of [
    config.className,
    typeof config.theme === "object" ? config.theme.className : undefined
  ]) {
    if (!className) {
      continue;
    }

    host.classList.add(...className.split(/\s+/).filter(Boolean));
  }

  host.dataset.denovoBackend = renderer.resolved;
  host.dataset.denovoEditable = String(config.editable ?? false);
  host.dataset.denovoMode = scene.mode;
  host.dataset.denovoReady = "pending";
  host.dataset.denovoTheme = theme.name;

  if (typeof config.theme === "object") {
    const variables = [
      ["--dc-background", config.theme.background],
      ["--dc-selection-color", config.theme.selectionColor],
      ["--dc-grid-color", config.theme.gridColor],
      ["--dc-handle-color", config.theme.handleColor],
      ["--dc-overlay-color", config.theme.overlayColor],
      ["--dc-font-family", config.theme.fontFamily]
    ] as const;

    for (const [name, value] of variables) {
      if (value !== undefined) {
        host.style.setProperty(name, value);
      }
    }
  }

  return host;
}

type ResolvedTheme = {
  background: string;
  fontFamily: string;
  gridColor: string;
  handleColor: string;
  name: CanvasThemePreset | "custom";
  overlayColor: string;
  selectionColor: string;
};

function resolveTheme(theme: DenovoCanvasConfig["theme"]): ResolvedTheme {
  const preset = theme === "light" ? lightTheme : darkTheme;

  if (!theme || typeof theme === "string") {
    return {
      ...preset,
      name: theme ?? "dark"
    };
  }

  return {
    background: theme.background ?? preset.background,
    fontFamily: theme.fontFamily ?? preset.fontFamily,
    gridColor: theme.gridColor ?? preset.gridColor,
    handleColor: theme.handleColor ?? preset.handleColor,
    name: "custom",
    overlayColor: theme.overlayColor ?? preset.overlayColor,
    selectionColor: theme.selectionColor ?? preset.selectionColor
  };
}

const darkTheme = {
  background: "#0f172a",
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  gridColor: "rgb(148 163 184 / 0.18)",
  handleColor: "#f8fafc",
  overlayColor: "rgb(15 23 42 / 0.72)",
  selectionColor: "#38bdf8"
};

const lightTheme = {
  background: "#f8fafc",
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  gridColor: "rgb(15 23 42 / 0.12)",
  handleColor: "#0f172a",
  overlayColor: "rgb(248 250 252 / 0.82)",
  selectionColor: "#2563eb"
};

function createRegistry(): CanvasFacadeRegistry {
  return {
    commands: new Map(),
    tools: []
  };
}

function createRegistryController(
  registry: CanvasFacadeRegistry
): CanvasFacadeRegistryController {
  const bindings = new Set<CanvasFacadeRegistryBinding>();
  let committed = false;
  let destroyed = false;

  return {
    commit(staged) {
      if (destroyed) {
        return;
      }

      const installed: CanvasFacadeRegistryBinding[] = [];

      try {
        for (const binding of bindings) {
          binding.detach = attachEditorPlugins(binding.editor, staged);
          installed.push(binding);
        }

        commitRegistry(registry, staged);
        committed = true;
      } catch (cause) {
        for (const binding of installed.reverse()) {
          binding.detach?.();
          binding.detach = undefined;
        }

        throw cause;
      }
    },
    connect(editor) {
      if (destroyed) {
        throw new CanvasPluginError(
          "runtime-destroyed",
          "Cannot connect an editor after the canvas runtime is destroyed."
        );
      }

      const binding: CanvasFacadeRegistryBinding = {
        detach: undefined,
        editor
      };

      if (committed) {
        binding.detach = attachEditorPlugins(editor, registry);
      }

      bindings.add(binding);
      let disconnected = false;

      return () => {
        if (disconnected) {
          return;
        }

        disconnected = true;
        binding.detach?.();
        binding.detach = undefined;
        bindings.delete(binding);
      };
    },
    destroy() {
      if (destroyed) {
        return;
      }

      destroyed = true;

      for (const binding of [...bindings].reverse()) {
        binding.detach?.();
        binding.detach = undefined;
      }

      bindings.clear();
    }
  };
}

function connectFacadePlugins(
  editor: CanvasEditor,
  runtime: CanvasEditorRuntimeTarget
): () => void {
  return (
    facadeRegistryControllers.get(runtime)?.connect(editor) ?? (() => undefined)
  );
}

function commitRegistry(
  registry: CanvasFacadeRegistry,
  staged: CanvasFacadeRegistry
) {
  registry.commands.clear();

  for (const [type, handler] of staged.commands) {
    registry.commands.set(type, handler);
  }

  registry.tools.splice(0, registry.tools.length, ...staged.tools);
}

function setupPlugins(
  plugins: readonly CanvasPlugin[],
  controller: CanvasFacadeRegistryController
): Promise<void> {
  return runCanvasEffect(
    Effect.gen(function* () {
      const staged = createRegistry();

      for (const plugin of plugins) {
        yield* stagePluginDeclarations(plugin, staged);
      }

      for (const plugin of plugins) {
        yield* runPluginSetup(plugin, staged);
      }

      yield* Effect.try({
        try: () => controller.commit(staged),
        catch: toPublicError
      });
    })
  );
}

function stagePluginDeclarations(
  plugin: CanvasPlugin,
  registry: CanvasFacadeRegistry
): Effect.Effect<void, CanvasPluginError> {
  return Effect.try({
    try: () => {
      for (const tool of plugin.tools ?? []) {
        registerRegistryTool(registry, tool, plugin.name);
      }
    },
    catch: (cause) => toPluginSetupError(plugin.name, cause)
  });
}

function runPluginSetup(
  plugin: CanvasPlugin,
  registry: CanvasFacadeRegistry
): Effect.Effect<void, CanvasPluginError> {
  if (!plugin.setup) {
    return Effect.void;
  }

  const setup = plugin.setup;

  return Effect.tryPromise({
    try: () => Promise.resolve(setup(createPluginContext(registry, plugin.name))),
    catch: (cause) => toPluginSetupError(plugin.name, cause)
  });
}

function createPluginContext(
  registry: CanvasFacadeRegistry,
  pluginName: string
): CanvasPluginContext {
  return {
    coreVersion: CANVAS_DOCUMENT_SCHEMA_VERSION,
    registerCommand(descriptor, handler) {
      const registration = validatePluginCommandRegistration(
        descriptor,
        handler,
        pluginName
      );
      const { type } = registration.descriptor;

      if (registry.commands.has(type)) {
        throw new CanvasPluginError(
          "duplicate-command",
          `Plugin command is already registered: ${type}`,
          { pluginName }
        );
      }

      registry.commands.set(type, {
        attach: (editor) =>
          editor.registerCommand(registration.descriptor, registration.handler)
      });
    },
    registerTool(definition) {
      registerRegistryTool(registry, definition, pluginName);
    }
  };
}

function validatePluginCommandRegistration<
  TType extends CanvasPluginCommandType,
  TPayload
>(
  descriptor: CanvasPluginCommandDescriptor<TType, TPayload>,
  handler: CanvasPluginCommandHandler<TType, TPayload>,
  pluginName: string
): {
  readonly descriptor: CanvasPluginCommandDescriptor<TType, TPayload>;
  readonly handler: CanvasPluginCommandHandler<TType, TPayload>;
} {
  if (typeof descriptor !== "object" || descriptor === null) {
    throw new CanvasPluginError(
      "invalid-command",
      "Plugin commands require a descriptor object.",
      { pluginName }
    );
  }

  const { parsePayload, type } = descriptor;

  if (
    typeof type !== "string" ||
    !type.startsWith("plugin.") ||
    type.length === "plugin.".length
  ) {
    throw new CanvasPluginError(
      "invalid-command",
      `Plugin command types must use a non-empty plugin.* namespace: ${String(type)}`,
      { pluginName }
    );
  }

  if (typeof parsePayload !== "function") {
    throw new CanvasPluginError(
      "invalid-command",
      `Plugin command payload parser must be a function: ${type}`,
      { pluginName }
    );
  }

  if (typeof handler !== "function") {
    throw new CanvasPluginError(
      "invalid-command",
      `Plugin command handler must be a function: ${type}`,
      { pluginName }
    );
  }

  return Object.freeze({
    descriptor: Object.freeze({ parsePayload, type }),
    handler
  });
}

function registerRegistryTool(
  registry: CanvasFacadeRegistry,
  definition: CanvasPluginToolDefinition,
  pluginName: string
) {
  const registered = validatePluginToolDefinition(definition, pluginName);

  if (registry.tools.some((tool) => tool.id === registered.id)) {
    throw new CanvasPluginError(
      "duplicate-tool",
      `Plugin tool is already registered: ${registered.id}`,
      { pluginName }
    );
  }

  registry.tools.push(registered);
}

function validatePluginToolDefinition(
  definition: CanvasPluginToolDefinition,
  pluginName: string
): CanvasPluginToolDefinition {
  if (typeof definition !== "object" || definition === null) {
    throw new CanvasPluginError(
      "invalid-tool",
      "Plugin tools require string id and label fields.",
      { pluginName }
    );
  }

  const {
    cursor,
    id,
    label,
    navigation,
    onDeactivate,
    onInput,
    transform
  } = definition;

  if (typeof id !== "string" || typeof label !== "string") {
    throw new CanvasPluginError(
      "invalid-tool",
      "Plugin tools require string id and label fields.",
      { pluginName }
    );
  }

  const segments = id.split(".");

  if (
    segments.length < 4 ||
    segments[0] !== "plugin" ||
    segments[1]?.length === 0 ||
    segments[2] !== "tool" ||
    segments.slice(3).some((segment) => segment.length === 0)
  ) {
    throw new CanvasPluginError(
      "invalid-tool",
      `Plugin tool ids must use plugin.<owner>.tool.<name>: ${id}`,
      { pluginName }
    );
  }

  if (label.length === 0) {
    throw new CanvasPluginError(
      "invalid-tool",
      `Plugin tool labels must be non-empty: ${id}`,
      { pluginName }
    );
  }

  if (cursor !== undefined && typeof cursor !== "string") {
    throw new CanvasPluginError(
      "invalid-tool",
      `Plugin tool cursor must be a string: ${id}`,
      { pluginName }
    );
  }

  if (
    navigation !== undefined &&
    navigation !== "allow" &&
    navigation !== "block" &&
    navigation !== "allow-pan"
  ) {
    throw new CanvasPluginError(
      "invalid-tool",
      `Plugin tool navigation must be allow, block, or allow-pan: ${id}`,
      { pluginName }
    );
  }

  if (
    transform !== undefined &&
    !CanvasNodeTransformKindSchema.safeParse(transform).success
  ) {
    throw new CanvasPluginError(
      "invalid-tool",
      `Plugin tool transform must be translate, rotate, or scale: ${id}`,
      { pluginName }
    );
  }

  if (onInput !== undefined && typeof onInput !== "function") {
    throw new CanvasPluginError(
      "invalid-tool",
      `Plugin tool input handler must be a function: ${id}`,
      { pluginName }
    );
  }

  if (onDeactivate !== undefined && typeof onDeactivate !== "function") {
    throw new CanvasPluginError(
      "invalid-tool",
      `Plugin tool deactivation handler must be a function: ${id}`,
      { pluginName }
    );
  }

  return Object.freeze({
    ...(cursor === undefined ? {} : { cursor }),
    id,
    label,
    ...(navigation === undefined ? {} : { navigation }),
    ...(onDeactivate === undefined ? {} : { onDeactivate }),
    ...(onInput === undefined ? {} : { onInput }),
    ...(transform === undefined ? {} : { transform })
  });
}

function attachEditorPlugins(
  editor: CanvasEditor,
  registry: CanvasFacadeRegistry
): () => void {
  const cleanups: Array<() => void> = [];

  try {
    for (const registration of registry.commands.values()) {
      cleanups.push(registration.attach(editor));
    }

    for (const tool of registry.tools) {
      cleanups.push(editor.registerTool(tool));
    }
  } catch (cause) {
    runCleanups(cleanups);
    throw cause;
  }

  let detached = false;

  return () => {
    if (detached) {
      return;
    }

    detached = true;
    runCleanups(cleanups);
  };
}

function runCleanups(cleanups: readonly (() => void)[]) {
  for (const cleanup of [...cleanups].reverse()) {
    cleanup();
  }
}

function toPluginSetupError(
  pluginName: string,
  cause: unknown
): CanvasPluginError {
  if (cause instanceof CanvasPluginError) {
    return cause;
  }

  return new CanvasPluginError(
    "setup-failed",
    `Canvas plugin setup failed: ${pluginName}`,
    { cause, pluginName }
  );
}

function toPublicError(cause: unknown): Error {
  return cause instanceof Error
    ? cause
    : new CanvasPluginError("internal-error", "Canvas plugin lifecycle failed.", {
        cause
      });
}

async function runCanvasEffect<Value>(
  effect: Effect.Effect<Value, Error>
): Promise<Value> {
  const guarded = Effect.catchAllCause(effect, (cause) => {
    const failure = Cause.failureOption(cause);

    if (Option.isSome(failure) && failure.value instanceof Error) {
      return Effect.fail(failure.value);
    }

    return Effect.fail(
      new CanvasPluginError("internal-error", "Canvas plugin lifecycle failed.", {
        cause: new Error(Cause.pretty(cause))
      })
    );
  });
  const result = await Effect.runPromise(Effect.either(guarded));

  if (Either.isLeft(result)) {
    throw result.left;
  }

  return result.right;
}

function resolveRenderer(
  renderer: DenovoCanvasConfig["renderer"],
  scene: CanvasScene
): ResolvedCanvasRenderer {
  assertRendererInput(renderer);
  const requested = resolveRequestedBackend(renderer);
  const adapter = resolveRendererAdapter(renderer);
  const capabilities = detectCanvasBackendCapabilities();
  const resolved = resolveBackend(requested, scene.mode, adapter, capabilities);

  return {
    adapterName: adapter?.name ?? "builtin-web",
    capabilities,
    requested,
    resolved
  };
}

function resolveRequestedBackend(
  renderer: DenovoCanvasConfig["renderer"]
): CanvasBackend {
  if (!renderer) {
    return "auto";
  }

  if (typeof renderer === "string") {
    return renderer === "three" ? "webgl2" : renderer;
  }

  if (isRendererAdapter(renderer)) {
    return "custom";
  }

  return renderer.backend ?? "auto";
}

function resolveRendererAdapter(
  renderer: DenovoCanvasConfig["renderer"]
): CanvasFacadeRendererAdapter | null {
  if (!renderer || typeof renderer === "string") {
    return null;
  }

  if (isRendererAdapter(renderer)) {
    return renderer;
  }

  return renderer.backend === "custom" ? renderer.adapter : null;
}

const rendererPresets = [
  "auto",
  "webgpu",
  "webgl2",
  "canvas2d",
  "offscreen-canvas2d",
  "three"
] as const satisfies readonly RendererPreset[];

const rendererConfigKeys = new Set(["adapter", "backend"]);

function assertRendererInput(
  renderer: unknown
): asserts renderer is CanvasRendererInput | undefined {
  if (renderer === undefined) {
    return;
  }

  if (typeof renderer === "string") {
    if (renderer === "custom") {
      throw new TypeError(
        "The custom canvas backend requires an explicit renderer adapter."
      );
    }

    if (!(rendererPresets as readonly string[]).includes(renderer)) {
      throw new TypeError(`Unknown canvas renderer preset: ${renderer}.`);
    }

    return;
  }

  if (typeof renderer !== "object" || renderer === null || Array.isArray(renderer)) {
    throw new TypeError(
      "Canvas renderer must be a preset, renderer config, or renderer adapter."
    );
  }

  const rendererRecord = renderer as Record<PropertyKey, unknown>;
  const declaresRuntime = "createRuntime" in rendererRecord;
  const hasAdapter = hasOwn(rendererRecord, "adapter");
  const hasBackend = hasOwn(rendererRecord, "backend");

  if (declaresRuntime) {
    if (hasAdapter || hasBackend) {
      throw new TypeError(
        "A direct renderer adapter cannot be combined with renderer config fields."
      );
    }

    assertRendererAdapter(rendererRecord, "Canvas renderer adapter");
    return;
  }

  const unknownKeys = Object.keys(rendererRecord).filter(
    (key) => !rendererConfigKeys.has(key)
  );

  if (unknownKeys.length > 0) {
    throw new TypeError(
      `Canvas renderer config contains unsupported fields: ${unknownKeys.join(", ")}.`
    );
  }

  if (!hasBackend) {
    if (hasAdapter) {
      throw new TypeError(
        'Canvas renderer config with an adapter must set backend to "custom".'
      );
    }

    return;
  }

  const backend = rendererRecord.backend;

  if (
    backend !== "auto" &&
    backend !== "webgpu" &&
    backend !== "webgl2" &&
    backend !== "canvas2d" &&
    backend !== "offscreen-canvas2d" &&
    backend !== "custom"
  ) {
    throw new TypeError(`Unknown canvas renderer backend: ${String(backend)}.`);
  }

  if (backend === "custom") {
    if (!hasAdapter) {
      throw new TypeError(
        "The custom canvas backend requires an explicit renderer adapter."
      );
    }

    assertRendererAdapter(rendererRecord.adapter, "Custom renderer adapter");
    return;
  }

  if (hasAdapter) {
    throw new TypeError(
      `Built-in canvas backend ${backend} cannot be combined with a renderer adapter.`
    );
  }
}

function assertRendererAdapter(
  adapter: unknown,
  label: string
): asserts adapter is CanvasFacadeRendererAdapter {
  if (typeof adapter !== "object" || adapter === null || Array.isArray(adapter)) {
    throw new TypeError(`${label} must be an object.`);
  }

  const adapterRecord = adapter as Record<PropertyKey, unknown>;

  if (
    typeof adapterRecord.name !== "string" ||
    adapterRecord.name.trim().length === 0
  ) {
    throw new TypeError(`${label} must have a non-empty name.`);
  }

  if (
    !Array.isArray(adapterRecord.modes) ||
    adapterRecord.modes.length === 0 ||
    adapterRecord.modes.some((mode) => mode !== "2d" && mode !== "3d") ||
    new Set(adapterRecord.modes).size !== adapterRecord.modes.length
  ) {
    throw new TypeError(
      `${label} modes must be a non-empty list containing unique "2d" or "3d" values.`
    );
  }

  if (typeof adapterRecord.createRuntime !== "function") {
    throw new TypeError(`${label} must define createRuntime.`);
  }
}

function resolveBackend(
  requested: CanvasBackend,
  mode: CanvasMode,
  adapter: CanvasFacadeRendererAdapter | null,
  capabilities: CanvasBackendCapabilities
): CanvasResolvedBackend {
  if (requested === "auto") {
    // `capabilities.webgpu` is detection-only. Auto never selects WebGPU.
    if (mode === "2d") {
      requireBackendCapability("canvas2d", mode, capabilities.canvas2d);
      return "canvas2d";
    }

    requireBackendCapability("webgl2", mode, capabilities.webgl2);
    return "webgl2";
  }

  switch (requested) {
    case "custom":
      if (!adapter) {
        throw new CanvasBackendResolutionError(
          "adapter-required",
          requested,
          mode,
          "A custom canvas backend requires an explicit renderer adapter."
        );
      }

      return "custom";
    case "canvas2d":
      requireBackendMode(requested, mode, "2d");
      requireBackendCapability(requested, mode, capabilities.canvas2d);
      return requested;
    case "webgl2":
      requireBackendMode(requested, mode, "3d");
      requireBackendCapability(requested, mode, capabilities.webgl2);
      return requested;
    case "offscreen-canvas2d":
      requireBackendMode(requested, mode, "2d");
      throw new CanvasBackendResolutionError(
        "backend-unimplemented",
        requested,
        mode,
        "The built-in offscreen Canvas2D runtime is not implemented. Install and select a custom renderer adapter instead."
      );
    case "webgpu":
      requireBackendMode(requested, mode, "3d");
      requireBackendCapability(requested, mode, capabilities.webgpu);
      return requested;
    default: {
      const exhaustive: never = requested;
      return exhaustive;
    }
  }
}

function requireBackendMode(
  backend: Exclude<CanvasBackend, "auto" | "custom">,
  actualMode: CanvasMode,
  requiredMode: CanvasMode
): void {
  if (actualMode !== requiredMode) {
    throw new CanvasBackendResolutionError(
      "mode-mismatch",
      backend,
      actualMode,
      `Canvas backend ${backend} does not support ${actualMode} scenes.`
    );
  }
}

function requireBackendCapability(
  backend: "canvas2d" | "webgl2" | "webgpu",
  mode: CanvasMode,
  available: boolean
): void {
  if (!available) {
    throw new CanvasBackendResolutionError(
      "capability-unavailable",
      backend,
      mode,
      `Canvas backend ${backend} is unavailable in the current environment.`
    );
  }
}

function detectCanvasBackendCapabilities(): CanvasBackendCapabilities {
  const canvas2d = Boolean(createProbeCanvas()?.getContext("2d"));
  const webgl2 = Boolean(createProbeCanvas()?.getContext("webgl2"));
  const offscreenCanvas2d =
    typeof OffscreenCanvas !== "undefined" &&
    Boolean(new OffscreenCanvas(1, 1).getContext("2d"));
  const webgpu =
    typeof navigator !== "undefined" &&
    "gpu" in navigator &&
    Boolean(navigator.gpu);

  return {
    canvas2d,
    offscreenCanvas2d,
    webgl2,
    webgpu
  };
}

function createProbeCanvas() {
  if (typeof document === "undefined") {
    return null;
  }

  return document.createElement("canvas");
}

function isRendererAdapter(
  renderer: CanvasFacadeRendererAdapter | CanvasRendererConfig
): renderer is CanvasFacadeRendererAdapter {
  return "createRuntime" in renderer && typeof renderer.createRuntime === "function";
}

function isCanvasElement(target: CanvasTarget): target is HTMLCanvasElement {
  return (
    typeof HTMLCanvasElement !== "undefined" &&
    target instanceof HTMLCanvasElement
  );
}
