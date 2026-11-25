import {
  defineDocument,
  defineScene,
  parseDocument,
  parseDocumentJson,
  type Canvas2DScene,
  type Canvas2DSceneInput,
  type CanvasAuthoringPreviewForMode,
  type CanvasDocument,
  type CanvasDocumentInput,
  type CanvasHitResult,
  type CanvasHitTestInput,
  type CanvasNodeTransformHandleTarget,
  type CanvasNodeTransformInput,
  type CanvasNodeTransformPreviewForMode,
  type CanvasScenePointRequestFor,
  type CanvasScenePointResultFor,
  type CanvasStorageAdapter
} from "@de-novo/canvas-core";
import {
  connectEditorToRuntime,
  connectEditorToStorage,
  type CanvasEditor,
  type ConnectEditorToStorageOptions
} from "@de-novo/canvas-editor";
import {
  CanvasReadPixelsUnsupportedError,
  connectCanvasSelection,
  connectCanvasToolInput,
  createCanvas2D,
  type Canvas2DOptions,
  type Canvas2DRenderNode,
  type Canvas2DRuntime,
  type CanvasPointerSelectionOptions,
  type CanvasRuntimeChange,
  type CanvasRuntimeChangeListener,
  type CanvasTarget,
  type CreateCanvasOptions
} from "@de-novo/canvas-web/2d";

export * from "@de-novo/canvas-core";
export {
  CanvasEditorError,
  addLayer,
  alignNodes,
  applyCommandsToDocument,
  applyCommandsToStoredDocument,
  applyNamedOperations,
  connectEditorToRuntime,
  create2DShapeTool,
  createAnnotationTool,
  createConnectorTool,
  createDistanceMeasurementTool,
  createEditor,
  createGroupNodesCommand,
  createNodeUpdateCommand,
  createPanOrbitTool,
  createRelationGraphLayoutAdapter,
  createSelectTool,
  createTimeGraphLayoutAdapter,
  createTransformTool,
  createUngroupNodesCommand,
  distributeNodes,
  getEffectiveNodeState,
  isNodeEffectivelyLocked,
  isNodeEffectivelyVisible,
  listLabels,
  listLayers,
  listNamedOperations,
  listNodes,
  NAMED_OPERATION_NAMES,
  removeEdge,
  removeLayer,
  removeNode,
  reorderLayer,
  setAnnotationText,
  setImageFit,
  setLayerLocked,
  setLayerName,
  setLayerVisible,
  setNodeLayer,
  setNodeLocked,
  setNodeVisible,
  setShadePattern,
  setSparklineStyle,
  setText,
  shallowEqual,
  snapPointToGrid,
  subscribeCanvasSelector,
  validateGridWorkPlaneCompatibility
} from "@de-novo/canvas-editor";
export type {
  AddLayerInput,
  AlignNodesInput,
  AlignNodesMode,
  ApplyStoredCommandsOptions,
  Canvas2DShapeToolOptions,
  CanvasAnnotationDraft,
  CanvasAnnotationDraftContext,
  CanvasAnnotationDraftProvider,
  CanvasAnnotationDraftResult,
  CanvasAnnotationToolOptions,
  CanvasConnectorToolOptions,
  CanvasDistanceMeasurementToolOptions,
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
  CanvasEffectiveNodeState,
  CanvasGroupNodesOptions,
  CanvasPanOrbitToolOptions,
  CanvasPersistenceEvent,
  CanvasPersistenceListener,
  CanvasSelectToolOptions,
  CanvasSelector,
  CanvasSelectorEquality,
  CanvasStoredDocument,
  CanvasTransformToolOptions,
  ConnectEditorToStorageOptions,
  CreateCanvasEditorOptions,
  DistributeNodesAxis,
  DistributeNodesInput,
  ListLabelsOptions,
  ListNodesOptions,
  ListedLabel,
  ListedLabelType,
  ListedLayer,
  ListedNode,
  NamedOperation,
  NamedOperationField,
  NamedOperationFieldKind,
  NamedOperationFieldName,
  NamedOperationManifestEntry,
  NamedOperationName,
  NamedOperationRole,
  NamedOperationResult,
  RelationGraphLayoutOptions,
  RemoveEdgeInput,
  RemoveLayerInput,
  RemoveNodeInput,
  ReorderLayerInput,
  SetAnnotationTextInput,
  SetImageFitInput,
  SetLayerLockedInput,
  SetLayerNameInput,
  SetLayerVisibleInput,
  SetNodeLayerInput,
  SetNodeLockedInput,
  SetNodeVisibleInput,
  SetShadePatternInput,
  SetSparklineStyleInput,
  SetTextInput,
  SubscribeCanvasSelectorOptions,
  TimeGraphLayoutOptions
} from "@de-novo/canvas-editor";
export {
  CanvasReadPixelsUnsupportedError,
  CanvasSceneChunkCancelledError,
  canvasToScenePoint,
  captureCanvas2DSnapshot,
  computeCanvas2DRedlines,
  computeCanvas2DSnapGuides,
  connectCanvasSelection,
  connectCanvasToolInput,
  createCanvas2D,
  createMemoryImageStore,
  createSceneChunkLoader,
  DEFAULT_BOX_MODEL_COLORS,
  DEFAULT_REDLINE_COLOR,
  defineCanvas2DViewState,
  fitCanvas2DView,
  flyCanvas2DViewTo,
  formatCanvas2DRedlineDistance,
  getCanvas2DVisibleBounds,
  IDENTITY_CANVAS_2D_VIEW,
  inspectCanvas2DRuntime,
  orthogonalSegmentIntersectsBoxInterior,
  panCanvas2DView,
  resolveCanvas2DBoxModelRegions,
  resolveCanvas2DObstacleFreeOrthogonalWaypoints,
  sceneToCanvasPoint,
  summarizeCanvasImageData,
  zoomCanvas2DViewAt
} from "@de-novo/canvas-web/2d";
export type {
  Canvas2DBoxEdges,
  Canvas2DBoxModelColors,
  Canvas2DBoxModelOverlay,
  Canvas2DBoxModelRect,
  Canvas2DCapturedSnapshot,
  Canvas2DInspectableRuntime,
  Canvas2DInspectedLayer,
  Canvas2DInspectedNode,
  Canvas2DInspectionOverlay,
  Canvas2DMinimapOptions,
  Canvas2DNavigationOptions,
  Canvas2DObject,
  Canvas2DObstacleRouteOptions,
  Canvas2DOptions,
  Canvas2DRectBounds,
  Canvas2DRedlineExtension,
  Canvas2DRedlineOptions,
  Canvas2DRedlineOverlay,
  Canvas2DRenderNode,
  Canvas2DRenderNodeContext,
  Canvas2DRuntime,
  Canvas2DRuntimeSnapshot,
  Canvas2DSnapCandidate,
  Canvas2DSnapEdge,
  Canvas2DSnapGuide,
  Canvas2DSnapGuideAxis,
  Canvas2DSnapOptions,
  Canvas2DSnapResult,
  Canvas2DSpatialIndexStats,
  Canvas2DSpatialSyncKind,
  Canvas2DViewState,
  Canvas2DViewStateInput,
  Canvas2DViewportRuntime,
  Canvas2DViewportSize,
  CanvasAuthoringRuntime,
  CanvasFrame,
  CanvasHitSelectionTarget,
  CanvasHitTestRuntime,
  CanvasImageSource2D,
  CanvasImageStore,
  CanvasNavigationInputCapability,
  CanvasNavigationInputRuntime,
  CanvasNavigationInputUnsupported,
  CanvasNodeTransformHandleRuntime,
  CanvasNodeTransformRuntime,
  CanvasPixelDataLike,
  CanvasPixelSummary,
  CanvasPointerSelectionOptions,
  CanvasRuntimeChange,
  CanvasRuntimeChangeListener,
  CanvasRuntimeChangeRuntime,
  CanvasSceneChunkLoader,
  CanvasSceneChunkLoaderOptions,
  CanvasSceneChunkProgress,
  CanvasTarget,
  CanvasToolInputTarget,
  CaptureCanvas2DSnapshotOptions,
  CreateCanvasOptions,
  InspectCanvas2DOptions,
  ResolvedCanvas2DBoxModelRegions,
  WebCanvasRuntime
} from "@de-novo/canvas-web/2d";

export type Canvas2DTargetInput = string | CanvasTarget;
export type Canvas2DDocumentSource = CanvasDocumentInput | string;
export type Canvas2DBackend = "auto" | "canvas2d" | "webgpu";
export type Canvas2DResolvedBackend = "canvas2d" | "webgpu";
export type Canvas2DThemePreset = "dark" | "light";

export type Canvas2DRendererInput =
  | Canvas2DBackend
  | {
      readonly backend?: Canvas2DBackend;
    };

export type Canvas2DThemeInput = {
  readonly background?: string;
  readonly className?: string;
  readonly fontFamily?: string;
  readonly gridColor?: string;
  readonly handleColor?: string;
  readonly overlayColor?: string;
  readonly selectionColor?: string;
};

export type DenovoCanvas2DCommonConfig = {
  readonly antialias?: boolean;
  readonly autoStart?: boolean;
  readonly canvas2d?: Canvas2DOptions;
  readonly className?: string;
  readonly devicePixelRatio?: number;
  readonly editable?: boolean;
  readonly imageStore?: CreateCanvasOptions["imageStore"];
  readonly onFrame?: CreateCanvasOptions["onFrame"];
  readonly renderNode?: Canvas2DRenderNode;
  readonly renderer?: Canvas2DRendererInput;
  readonly theme?: Canvas2DThemePreset | Canvas2DThemeInput;
};

type DenovoCanvas2DDocumentConfig = {
  readonly background?: never;
  readonly document: Canvas2DDocumentSource;
  readonly editor?: never;
  readonly id?: never;
  readonly layers?: never;
  readonly mode?: never;
  readonly nodes?: never;
  readonly scene?: never;
};

type DenovoCanvas2DEditorConfig = {
  readonly background?: never;
  readonly document?: never;
  readonly editor: CanvasEditor;
  readonly id?: never;
  readonly layers?: never;
  readonly mode?: never;
  readonly nodes?: never;
  readonly scene?: never;
};

type DenovoCanvas2DSceneConfig = {
  readonly background?: never;
  readonly document?: never;
  readonly editor?: never;
  readonly id?: never;
  readonly layers?: never;
  readonly mode?: never;
  readonly nodes?: never;
  readonly scene: Canvas2DSceneInput;
};

type DenovoCanvas2DInlineConfig = {
  readonly background?: string;
  readonly document?: never;
  readonly editor?: never;
  readonly id?: string;
  readonly layers?: Canvas2DSceneInput["layers"];
  readonly mode?: "2d";
  readonly nodes?: Canvas2DSceneInput["nodes"];
  readonly scene?: never;
};

export type DenovoCanvas2DConfig = DenovoCanvas2DCommonConfig &
  (
    | DenovoCanvas2DDocumentConfig
    | DenovoCanvas2DEditorConfig
    | DenovoCanvas2DSceneConfig
    | DenovoCanvas2DInlineConfig
  );

export type ResolvedDenovoCanvas2DConfig = {
  readonly editable: boolean;
  readonly renderer: {
    readonly requested: Canvas2DBackend;
    readonly resolved: Canvas2DResolvedBackend;
  };
  readonly theme: Canvas2DThemePreset | "custom";
};

export type DenovoCanvas2DRuntime = {
  readonly canvas: HTMLCanvasElement;
  readonly config: ResolvedDenovoCanvas2DConfig;
  readonly current: Canvas2DRuntime;
  readonly mode: "2d";
  readonly navigationInputEnabled: boolean;
  readonly navigationInputSupported: true;
  readonly nodeTransformKinds: Canvas2DRuntime["nodeTransformKinds"];
  readonly ready: Promise<void>;
  readonly store: Canvas2DRuntime["store"];
  destroy: () => void;
  getDocument: () => CanvasDocument | null;
  getRenderStats: Canvas2DRuntime["getRenderStats"];
  getScene: () => Canvas2DScene;
  hitTest: (input: CanvasHitTestInput) => CanvasHitResult;
  loadDocument: (document: Canvas2DDocumentSource) => CanvasDocument;
  readPixels: () => Promise<ImageData>;
  render: () => void;
  resize: () => void;
  resolveNodeTransform: Canvas2DRuntime["resolveNodeTransform"];
  resolveScenePoint: Canvas2DRuntime["resolveScenePoint"];
  setAuthoringPreviews: (
    previews: readonly CanvasAuthoringPreviewForMode<"2d">[]
  ) => void;
  setConnectionHandlesVisible: (visible: boolean) => void;
  setHoveredNode: (id: string | null) => void;
  setNavigationInputEnabled: (enabled: boolean) => void;
  setNavigationZoomEnabled: (enabled: boolean) => void;
  setNodeTransformHandleTarget: (
    target: CanvasNodeTransformHandleTarget | null
  ) => void;
  setNodeTransformPreview: (
    preview: CanvasNodeTransformPreviewForMode<"2d"> | null
  ) => void;
  setSelection: (ids?: readonly string[], primaryId?: string | null) => void;
  start: () => void;
  stop: () => void;
  subscribeRuntimeChange: (listener: CanvasRuntimeChangeListener) => () => void;
  update: (scene: Canvas2DSceneInput) => Canvas2DScene;
};

export type ConnectEditorTo2DCanvasOptions = CanvasPointerSelectionOptions & {
  readonly storage?: CanvasStorageAdapter;
  readonly storageDebounceMs?: number;
  readonly storageOnConflict?: ConnectEditorToStorageOptions["onConflict"];
  readonly syncDocument?: boolean;
};

function resolveTarget(targetInput: Canvas2DTargetInput): CanvasTarget {
  if (typeof targetInput !== "string") {
    return targetInput;
  }

  if (typeof document === "undefined") {
    throw new Error("CSS selector targets require a browser DOM environment.");
  }

  const element = document.querySelector<HTMLElement>(targetInput);
  if (!element) {
    throw new Error(`Canvas target element was not found: ${targetInput}`);
  }

  return element;
}

function resolveDocumentSource(source: Canvas2DDocumentSource): CanvasDocument {
  const document =
    typeof source === "string" ? parseDocumentJson(source) : parseDocument(source);
  if (document.scene.mode !== "2d") {
    throw new TypeError(
      `@de-novo/canvas/2d requires a 2D document; received mode "${document.scene.mode}".`
    );
  }
  return document;
}

function resolveScene(config: DenovoCanvas2DConfig): Canvas2DScene {
  if ("scene" in config && config.scene !== undefined) {
    const scene = defineScene(config.scene);
    if (scene.mode !== "2d") {
      throw new TypeError(
        `@de-novo/canvas/2d requires a 2D scene; received mode "${scene.mode}".`
      );
    }
    return scene;
  }

  const inline = config as DenovoCanvas2DInlineConfig;
  const scene = defineScene({
    ...(inline.background === undefined ? {} : { background: inline.background }),
    id: inline.id ?? "canvas-2d",
    layers: inline.layers ?? [{ id: "default", name: "Default" }],
    mode: "2d",
    nodes: inline.nodes ?? []
  });
  if (scene.mode !== "2d") {
    throw new TypeError("@de-novo/canvas/2d requires a 2D scene.");
  }
  return scene;
}

function resolve2DRenderer(
  input: Canvas2DRendererInput | undefined
): { readonly requested: Canvas2DBackend; readonly resolved: Canvas2DResolvedBackend } {
  const requested: Canvas2DBackend =
    input === undefined
      ? "auto"
      : typeof input === "string"
        ? input
        : (input.backend ?? "auto");

  if (requested !== "auto" && requested !== "canvas2d" && requested !== "webgpu") {
    throw new TypeError(
      `@de-novo/canvas/2d supports only "auto", "canvas2d", or "webgpu" backends; received "${String(requested)}".`
    );
  }

  if (requested === "webgpu") {
    const hasWebGpu =
      typeof navigator !== "undefined" &&
      "gpu" in navigator &&
      Boolean((navigator as Navigator & { gpu?: unknown }).gpu);
    if (!hasWebGpu) {
      throw new Error("Canvas backend webgpu is unavailable in the current environment.");
    }
    return { requested, resolved: "webgpu" };
  }

  return { requested, resolved: "canvas2d" };
}

function applyHostAttributes(
  target: CanvasTarget,
  config: DenovoCanvas2DConfig,
  resolvedBackend: Canvas2DResolvedBackend
): Canvas2DThemePreset | "custom" {
  const host = target instanceof HTMLCanvasElement ? target.parentElement : target;
  const themeKind: Canvas2DThemePreset | "custom" =
    typeof config.theme === "string"
      ? config.theme
      : config.theme === undefined
        ? "dark"
        : "custom";

  if (!host) {
    return themeKind;
  }

  host.classList.add("denovo-canvas");
  if (config.className) {
    for (const cls of config.className.split(/\s+/).filter(Boolean)) {
      host.classList.add(cls);
    }
  }
  host.dataset.denovoCanvas = "true";
  host.dataset.denovoMode = "2d";
  host.dataset.denovoBackend = resolvedBackend;
  host.dataset.denovoTheme = themeKind;

  if (typeof config.theme === "object" && config.theme !== null) {
    if (config.theme.className) {
      for (const cls of config.theme.className.split(/\s+/).filter(Boolean)) {
        host.classList.add(cls);
      }
    }
    const tokenMap: ReadonlyArray<readonly [string, string | undefined]> = [
      ["--dc-background", config.theme.background],
      ["--dc-font-family", config.theme.fontFamily],
      ["--dc-grid-color", config.theme.gridColor],
      ["--dc-handle-color", config.theme.handleColor],
      ["--dc-overlay-color", config.theme.overlayColor],
      ["--dc-selection-color", config.theme.selectionColor]
    ];
    for (const [token, value] of tokenMap) {
      if (value !== undefined) {
        host.style.setProperty(token, value);
      }
    }
  }

  return themeKind;
}

function extractImageAssetUris(
  document: CanvasDocument | null
): ReadonlyMap<string, string> {
  const uris = new Map<string, string>();
  if (!document) {
    return uris;
  }
  for (const asset of document.assets) {
    if (asset.type === "image" && asset.uri !== undefined) {
      uris.set(asset.id, asset.uri);
    }
  }
  return uris;
}

/**
 * Lightweight 2D-only facade entrypoint. Mounts Canvas2D or 2D WebGPU without
 * importing Three.js, three/webgpu, or three-mesh-bvh into the bundle.
 */
export function createCanvas(
  targetInput: Canvas2DTargetInput,
  config: DenovoCanvas2DConfig = {}
): DenovoCanvas2DRuntime {
  const target = resolveTarget(targetInput);
  const attachedEditor =
    "editor" in config && config.editor !== undefined ? config.editor : null;
  let currentDocument =
    attachedEditor !== null
      ? attachedEditor.getState().document
      : "document" in config && config.document !== undefined
        ? resolveDocumentSource(config.document)
        : null;
  if (attachedEditor !== null && currentDocument?.scene.mode !== "2d") {
    throw new TypeError(
      `@de-novo/canvas/2d requires a 2D editor document; received mode "${currentDocument?.scene.mode ?? "unknown"}".`
    );
  }
  const initialScene: Canvas2DScene =
    currentDocument?.scene.mode === "2d"
      ? currentDocument.scene
      : resolveScene(config);
  const renderer = resolve2DRenderer(config.renderer);
  const theme = applyHostAttributes(target, config, renderer.resolved);
  const initialImageAssetUris = extractImageAssetUris(currentDocument);

  const webOptions: CreateCanvasOptions = {
    ...(config.antialias === undefined ? {} : { antialias: config.antialias }),
    ...(config.autoStart === undefined ? {} : { autoStart: config.autoStart }),
    ...(config.canvas2d === undefined ? {} : { canvas2d: config.canvas2d }),
    ...(config.devicePixelRatio === undefined
      ? {}
      : { devicePixelRatio: config.devicePixelRatio }),
    ...(initialImageAssetUris.size === 0
      ? {}
      : { imageAssetUris: initialImageAssetUris }),
    ...(config.imageStore === undefined
      ? {}
      : { imageStore: config.imageStore }),
    ...(config.onFrame === undefined ? {} : { onFrame: config.onFrame }),
    ...(config.renderNode === undefined ? {} : { renderNode: config.renderNode }),
    ...(renderer.resolved === "webgpu"
      ? { gpuBackend: "webgpu" as const }
      : {})
  };

  const runtime = createCanvas2D(target, initialScene, webOptions);
  const listeners = new Set<CanvasRuntimeChangeListener>();
  let generation = 0;
  let destroyed = false;
  let disconnectAttachedEditor: (() => void) | null = null;

  const resolvedConfig: ResolvedDenovoCanvas2DConfig = {
    editable: config.editable ?? (attachedEditor !== null),
    renderer,
    theme
  };

  function updateScene(sceneInput: Canvas2DSceneInput): Canvas2DScene {
    const updated = runtime.update(sceneInput);
    if (currentDocument) {
      currentDocument = defineDocument({
        ...currentDocument,
        scene: updated
      });
    }
    return updated;
  }

  const facade: DenovoCanvas2DRuntime = {
    get canvas() {
      return runtime.canvas;
    },
    config: resolvedConfig,
    get current() {
      return runtime;
    },
    mode: "2d",
    get navigationInputEnabled() {
      return runtime.navigationInputEnabled;
    },
    navigationInputSupported: true,
    nodeTransformKinds: runtime.nodeTransformKinds,
    ready: runtime.ready,
    store: runtime.store,
    destroy() {
      destroyed = true;
      disconnectAttachedEditor?.();
      disconnectAttachedEditor = null;
      generation += 1;
      const event: CanvasRuntimeChange = {
        generation,
        previousMode: "2d",
        type: "destroy"
      };
      for (const listener of [...listeners]) {
        listener(event);
      }
      listeners.clear();
      runtime.destroy();
    },
    getDocument() {
      return currentDocument;
    },
    getRenderStats() {
      return runtime.getRenderStats();
    },
    getScene() {
      return runtime.getScene();
    },
    hitTest(input) {
      return runtime.hitTest(input);
    },
    loadDocument(source) {
      const parsed = resolveDocumentSource(source);
      if (parsed.scene.mode !== "2d") {
        throw new TypeError(
          `@de-novo/canvas/2d requires a 2D document; received mode "${parsed.scene.mode}".`
        );
      }
      runtime.setImageAssetUris(extractImageAssetUris(parsed));
      const updated = runtime.update(parsed.scene);
      currentDocument = defineDocument({
        ...parsed,
        scene: updated
      });
      return currentDocument;
    },
    readPixels() {
      return runtime.readPixels();
    },
    render() {
      runtime.render();
    },
    resize() {
      runtime.resize();
    },
    resolveNodeTransform(input) {
      return runtime.resolveNodeTransform(input);
    },
    resolveScenePoint(request) {
      return runtime.resolveScenePoint(request);
    },
    setAuthoringPreviews(previews) {
      runtime.setAuthoringPreviews(previews);
    },
    setConnectionHandlesVisible(visible) {
      runtime.setConnectionHandlesVisible?.(visible);
    },
    setHoveredNode(id) {
      runtime.setHoveredNode?.(id);
    },
    setNavigationInputEnabled(enabled) {
      runtime.setNavigationInputEnabled(enabled);
    },
    setNavigationZoomEnabled(enabled) {
      runtime.setNavigationZoomEnabled?.(enabled);
    },
    setNodeTransformHandleTarget(targetHandle) {
      runtime.setNodeTransformHandleTarget(targetHandle);
    },
    setNodeTransformPreview(preview) {
      runtime.setNodeTransformPreview(preview);
    },
    setSelection(ids, primaryId) {
      runtime.setSelection?.(ids ?? [], primaryId);
    },
    start() {
      runtime.start();
    },
    stop() {
      runtime.stop();
    },
    subscribeRuntimeChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update: updateScene
  };

  if (attachedEditor !== null) {
    void runtime.ready.then(() => {
      if (destroyed) {
        return;
      }
      disconnectAttachedEditor = connectEditorToCanvas(attachedEditor, facade);
    });
  }

  return facade;
}

/**
 * Connects a {@link CanvasEditor} to a lightweight 2D facade runtime (document
 * sync, pointer/keyboard tool routing, cursor & navigation policy sync, and
 * optional storage persistence).
 */
export function connectEditorToCanvas(
  editor: CanvasEditor,
  runtime: DenovoCanvas2DRuntime,
  options: ConnectEditorTo2DCanvasOptions = {}
): () => void {
  const resolveScenePoint = ((
    request:
      | CanvasScenePointRequestFor<"2d">
      | CanvasScenePointRequestFor<"3d">
  ) => {
    if (request.mode !== "2d") {
      throw new TypeError("@de-novo/canvas/2d cannot resolve 3D scene points.");
    }
    return runtime.resolveScenePoint(request);
  }) as Parameters<typeof connectCanvasToolInput>[0]["resolveScenePoint"];

  const runtimeTarget: Parameters<typeof connectCanvasToolInput>[0] &
    Parameters<typeof connectEditorToRuntime>[1] & {
      setHoveredNode: (id: string | null) => void;
      setNodeTransformHandleTarget: (
        target: CanvasNodeTransformHandleTarget | null
      ) => void;
      setSelection: (ids?: readonly string[], primaryId?: string | null) => void;
    } = {
    get canvas() {
      return runtime.canvas;
    },
    get mode() {
      return runtime.mode;
    },
    get ready() {
      return runtime.ready;
    },
    get store() {
      return runtime.store;
    },
    get nodeTransformKinds() {
      return runtime.nodeTransformKinds;
    },
    destroy: () => runtime.destroy(),
    getRenderStats: () => runtime.getRenderStats(),
    getScene: () => runtime.getScene(),
    hitTest: (input) => runtime.hitTest(input),
    readPixels: () => runtime.readPixels(),
    render: () => runtime.render(),
    resize: () => runtime.resize(),
    resolveNodeTransform: (input) => runtime.resolveNodeTransform(input),
    ...(resolveScenePoint === undefined ? {} : { resolveScenePoint }),
    setAuthoringPreviews: (previews) => {
      for (const preview of previews) {
        if (preview.mode !== "2d") {
          throw new TypeError("@de-novo/canvas/2d cannot render 3D authoring previews.");
        }
      }
      runtime.setAuthoringPreviews(
        previews as readonly CanvasAuthoringPreviewForMode<"2d">[]
      );
    },
    setHoveredNode: (id: string | null) => runtime.setHoveredNode(id),
    setNodeTransformHandleTarget: (
      target: CanvasNodeTransformHandleTarget | null
    ) => runtime.setNodeTransformHandleTarget(target),
    setNodeTransformPreview: (preview) => {
      if (preview !== null && preview.mode !== "2d") {
        throw new TypeError("@de-novo/canvas/2d cannot render 3D transform previews.");
      }
      runtime.setNodeTransformPreview(preview);
    },
    setSelection: (ids?: readonly string[], primaryId?: string | null) =>
      runtime.setSelection(ids, primaryId),
    start: () => runtime.start(),
    stop: () => runtime.stop(),
    subscribeRuntimeChange: (listener) => runtime.subscribeRuntimeChange(listener),
    update: (scene) => {
      const resolved = defineScene(scene);
      if (resolved.mode !== "2d") {
        throw new TypeError(
          `@de-novo/canvas/2d requires a 2D scene; received mode "${resolved.mode}".`
        );
      }
      return runtime.update(resolved);
    }
  };

  const disconnectRuntime =
    options.syncDocument === false
      ? () => undefined
      : connectEditorToRuntime(editor, runtimeTarget);
  let disconnectToolInput: () => void = () => undefined;
  let disconnectToolState: () => void = () => undefined;
  let disconnectStorage: () => void = () => undefined;

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
    runtime.setNavigationZoomEnabled(tool?.navigation !== "allow-pan");
    runtime.setConnectionHandlesVisible(tool?.connectionHandles === true);
    runtime.setNodeTransformHandleTarget(transformHandleTarget);
  }

  try {
    disconnectToolInput = connectCanvasToolInput(runtimeTarget, editor, options);
    syncToolState();
    const unsubscribeToolState = editor.subscribe(() => {
      syncToolState();
    });
    disconnectToolState = () => {
      unsubscribeToolState();
      runtime.setNodeTransformHandleTarget(null);
      runtime.canvas.style.removeProperty("cursor");
      runtime.setNavigationInputEnabled(previousNavigationInputEnabled);
    };

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
    disconnectToolState();
    disconnectToolInput();
    disconnectRuntime();
    throw cause;
  }

  return () => {
    disconnectStorage();
    disconnectToolState();
    disconnectToolInput();
    disconnectRuntime();
  };
}
