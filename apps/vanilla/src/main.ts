import {
  CanvasSceneSchema,
  connectEditorToCanvas,
  create2DShapeTool,
  create3DPrimitiveTool,
  create3DSurfacePlacementTool,
  createAnnotationTool,
  createCanvas,
  createDistanceMeasurementTool,
  createEditor,
  createEmptySelection,
  createGroupNodesCommand,
  createNodeUpdateCommand,
  createPanOrbitTool,
  createSelectTool,
  createTransformTool,
  createUngroupNodesCommand,
  addLayer,
  listNodes,
  reorderLayer,
  stackBox,
  defineCanvasPlugin,
  defineDocument,
  definePluginCommand,
  JsonValueSchema,
  parseDocument,
  type Canvas2DGrid,
  type Canvas3DGrid,
  type CanvasCommand,
  type CanvasCreateId,
  type CanvasDocument,
  type CanvasMode,
  type CanvasNode,
  type CanvasSceneInput,
  type CanvasWorkPlane,
  type DenovoCanvasRuntime,
  type JsonValue,
  type NodeId,
  type SelectionState
} from "@denovo/canvas";
import { createIndexedDbDocumentAdapter } from "@denovo/canvas/indexed-db";
import "@denovo/canvas/styles.css";
import "./styles.css";

function requireElement<TElement extends Element>(selector: string): TElement {
  const element = document.querySelector<TElement>(selector);

  if (!element) {
    throw new Error(`Vanilla example element was not found: ${selector}`);
  }

  return element;
}

const canvasStage = requireElement<HTMLElement>("#stage");
const resetViewControl =
  requireElement<HTMLButtonElement>("#reset-view");
const swapButton = requireElement<HTMLButtonElement>("#swap-scene");
const selectToolButton = requireElement<HTMLButtonElement>("#select-tool");
const panOrbitToolButton =
  requireElement<HTMLButtonElement>("#pan-orbit-tool");
const transformToolButton =
  requireElement<HTMLButtonElement>("#transform-tool");
const rotateToolButton = requireElement<HTMLButtonElement>("#rotate-tool");
const scaleToolButton = requireElement<HTMLButtonElement>("#scale-tool");
const inspectToolButton = requireElement<HTMLButtonElement>("#inspect-tool");
const createRect2DButton =
  requireElement<HTMLButtonElement>("#create-rect-2d");
const createCircle2DButton =
  requireElement<HTMLButtonElement>("#create-circle-2d");
const createBox3DButton = requireElement<HTMLButtonElement>("#create-box-3d");
const stackBox3DButton = requireElement<HTMLButtonElement>("#stack-box-3d");
const createSphere3DButton =
  requireElement<HTMLButtonElement>("#create-sphere-3d");
const measureDistance2DButton =
  requireElement<HTMLButtonElement>("#measure-distance-2d");
const measureDistance3DButton =
  requireElement<HTMLButtonElement>("#measure-distance-3d");
const annotate2DButton = requireElement<HTMLButtonElement>("#annotate-2d");
const annotate3DButton = requireElement<HTMLButtonElement>("#annotate-3d");
const annotationTextControl =
  requireElement<HTMLInputElement>("#annotation-text");
const editLastNodeControl =
  requireElement<HTMLButtonElement>("#edit-last-node");
const groupLastTwoControl =
  requireElement<HTMLButtonElement>("#group-last-two");
const ungroupCurrentControl =
  requireElement<HTMLButtonElement>("#ungroup-current");
const addLayerControl = requireElement<HTMLButtonElement>("#add-layer");
const reorderLayerButton =
  requireElement<HTMLButtonElement>("#reorder-layer");
const toggleLayerVisibleButton =
  requireElement<HTMLButtonElement>("#toggle-layer-visible");
const toggleLayerLockedButton =
  requireElement<HTMLButtonElement>("#toggle-layer-locked");
const undoControl = requireElement<HTMLButtonElement>("#undo");
const redoControl = requireElement<HTMLButtonElement>("#redo");
const reloadDocumentJsonButton =
  requireElement<HTMLButtonElement>("#reload-document-json");
const stackPlusYControl =
  requireElement<HTMLButtonElement>("#stack-box-plus-y");
const statusOutput = requireElement<HTMLElement>("#selection-status");
const toolOutput = requireElement<HTMLElement>("#tool-status");
const AUTHORING_LAYER_ID = "authoring";
const EXTRA_LAYER_ID = "authoring-extra";
const TOOL_IDS = {
  annotate2D: "plugin.vanilla.tool.authoring.annotate.2d",
  annotate3D: "plugin.vanilla.tool.authoring.annotate.3d",
  box3D: "plugin.vanilla.tool.authoring.create.box.3d",
  circle2D: "plugin.vanilla.tool.authoring.create.circle.2d",
  distance2D: "plugin.vanilla.tool.authoring.measure.distance.2d",
  distance3D: "plugin.vanilla.tool.authoring.measure.distance.3d",
  inspect: "plugin.vanilla.tool.inspect",
  panOrbit: "plugin.vanilla.tool.pan-orbit",
  rect2D: "plugin.vanilla.tool.authoring.create.rect.2d",
  rotate: "plugin.vanilla.tool.transform.rotate",
  scale: "plugin.vanilla.tool.transform.scale",
  select: "plugin.vanilla.tool.select",
  sphere3D: "plugin.vanilla.tool.authoring.create.sphere.3d",
  stackBox3D: "plugin.vanilla.tool.authoring.stack.box.3d",
  transform: "plugin.vanilla.tool.transform"
} as const;
const toolButtons = {
  [TOOL_IDS.annotate2D]: annotate2DButton,
  [TOOL_IDS.annotate3D]: annotate3DButton,
  [TOOL_IDS.box3D]: createBox3DButton,
  [TOOL_IDS.circle2D]: createCircle2DButton,
  [TOOL_IDS.distance2D]: measureDistance2DButton,
  [TOOL_IDS.distance3D]: measureDistance3DButton,
  [TOOL_IDS.inspect]: inspectToolButton,
  [TOOL_IDS.panOrbit]: panOrbitToolButton,
  [TOOL_IDS.rect2D]: createRect2DButton,
  [TOOL_IDS.rotate]: rotateToolButton,
  [TOOL_IDS.scale]: scaleToolButton,
  [TOOL_IDS.select]: selectToolButton,
  [TOOL_IDS.sphere3D]: createSphere3DButton,
  [TOOL_IDS.stackBox3D]: stackBox3DButton,
  [TOOL_IDS.transform]: transformToolButton
};
const actionButtons = [
  addLayerControl,
  editLastNodeControl,
  groupLastTwoControl,
  redoControl,
  reloadDocumentJsonButton,
  stackPlusYControl,
  reorderLayerButton,
  resetViewControl,
  swapButton,
  toggleLayerLockedButton,
  toggleLayerVisibleButton,
  undoControl,
  ungroupCurrentControl
] as const;

const twoDimensionalGrid = {
  mode: "2d",
  origin: [0, 0],
  spacing: [20, 20]
} as const satisfies Canvas2DGrid;
const threeDimensionalWorkPlane = {
  constant: 0,
  normal: [0, 1, 0]
} as const satisfies CanvasWorkPlane;
const threeDimensionalGrid = {
  axisU: [1, 0, 0],
  axisV: [0, 0, 1],
  mode: "3d",
  origin: [0, 0, 0],
  spacing: [0.5, 0.5]
} as const satisfies Canvas3DGrid;
const measurementUnit = {
  metersPerUnit: 1,
  name: "meter",
  symbol: "m"
} as const;

let authoringIdSequence = 0;
const createAuthoringId: CanvasCreateId = ({ mode, type }) => {
  authoringIdSequence += 1;
  return `authoring-${mode}-${type}-${authoringIdSequence}`;
};

const NAMED_STACK_ID = "named-stack-plus-y";

type VanillaNamedOpsSnapshot = {
  changed: boolean;
  on: string | null;
  position: readonly [number, number, number] | null;
  stackedId: string;
  undoDepth: number;
};

function playgroundWindow(): { __vanillaNamedOps?: VanillaNamedOpsSnapshot } {
  return window as unknown as { __vanillaNamedOps?: VanillaNamedOpsSnapshot };
}

function findNamedStackTarget(document: CanvasDocument) {
  const boxes = listNodes(document).filter(
    (node) => node.type === "box" && node.visible && !node.locked
  );
  const preferred =
    boxes.find((node) => node.id === "static-box") ?? boxes[0];

  if (!preferred) {
    return null;
  }

  const node = document.scene.nodes.find((candidate) => candidate.id === preferred.id);
  if (
    !node ||
    node.type !== "box" ||
    node.parentId != null ||
    node.rotation.some((component) => component !== 0)
  ) {
    return null;
  }

  return node;
}

function publishNamedStack(document: CanvasDocument, changed: boolean): VanillaNamedOpsSnapshot {
  const stacked = document.scene.nodes.find((node) => node.id === NAMED_STACK_ID);
  const snapshot: VanillaNamedOpsSnapshot = {
    changed,
    on: findNamedStackTarget(document)?.id ?? null,
    position:
      stacked?.type === "box"
        ? [
            stacked.position[0],
            stacked.position[1],
            stacked.position[2]
          ]
        : null,
    stackedId: NAMED_STACK_ID,
    undoDepth: editor.getState().history.undoDepth
  };
  canvasStage.dataset.denovoNamedStackId = stacked?.id ?? "none";
  canvasStage.dataset.denovoNamedStackOn = snapshot.on ?? "none";
  canvasStage.dataset.denovoNamedStackChanged = String(changed);
  canvasStage.dataset.denovoNamedStackPosition =
    snapshot.position?.join(",") ?? "none";
  playgroundWindow().__vanillaNamedOps = snapshot;
  return snapshot;
}

function provideAnnotationDraft() {
  const text = annotationTextControl.value.trim();

  if (text.length === 0) {
    return { kind: "cancel" } as const;
  }

  return {
    draft: { targetId: null, text },
    kind: "commit"
  } as const;
}

const scenes: CanvasSceneInput[] = [
  {
    id: "vanilla-3d",
    mode: "3d",
    layers: [
      { id: "main", name: "Main" },
      {
        id: AUTHORING_LAYER_ID,
        locked: false,
        name: "Authoring",
        visible: true
      }
    ],
    background: "#0f172a",
    render: {
      loop: "always",
      dpr: 1.5,
      frustumCulling: true,
    },
    camera: {
      position: [4.5, 3, 7],
      target: [0, 0, 0],
      fov: 42
    },
    nodes: [
      {
        id: "center",
        layerId: "main",
        type: "sphere",
        color: "#38bdf8",
        position: [0, 0.4, 0],
        radius: 0.9
      },
      {
        id: "batch",
        layerId: "main",
        type: "instances",
        geometry: "box",
        color: "#22c55e",
        position: [0, 0, -1.2],
        instances: Array.from({ length: 64 }, (_, index) => {
          const column = index % 8;
          const row = Math.floor(index / 8);

          return {
            position: [column * 0.55 - 1.9, row * 0.42 - 1.4, 0],
            rotation: [0.2, column * 0.08, 0],
            scale: [0.22, 0.22, 0.22],
            ...(index % 4 === 0 ? { color: "#a855f7" } : {})
          };
        })
      }
    ]
  },
  {
    id: "vanilla-2d",
    mode: "2d",
    layers: [
      { id: "main", name: "Main" },
      {
        id: AUTHORING_LAYER_ID,
        locked: false,
        name: "Authoring",
        visible: true
      }
    ],
    background: "#111827",
    render: {
      loop: "demand",
      dpr: 1.5,
      frustumCulling: true,
    },
    nodes: [
      {
        id: "panel",
        layerId: "main",
        type: "rect",
        fill: "#22c55e",
        position: [96, 96],
        size: [260, 180],
        rotation: 0.08
      },
      {
        id: "overlay",
        layerId: "main",
        type: "circle",
        fill: "#a855f7",
        position: [170, 160],
        radius: 30,
        rotation: 0.2,
        scale: [1.4, 0.65]
      },
      {
        id: "badge",
        layerId: "main",
        type: "circle",
        fill: "#38bdf8",
        position: [420, 220],
        radius: 76
      }
    ]
  },
  {
    id: "vanilla-3d-demand",
    mode: "3d",
    layers: [
      { id: "main", name: "Main" },
      {
        id: AUTHORING_LAYER_ID,
        locked: false,
        name: "Authoring",
        visible: true
      }
    ],
    background: "#121b2d",
    render: {
      loop: "demand",
      dpr: 1.5,
      frustumCulling: true,
    },
    camera: {
      position: [4.6, 3.4, 6.8],
      target: [0, -0.18, 0],
      fov: 42
    },
    nodes: [
      {
        id: "static-pedestal",
        layerId: "main",
        type: "box",
        color: "#334155",
        position: [0, -0.68, 0],
        rotation: [0, -0.15, 0],
        scale: [2.8, 0.18, 2.5]
      },
      {
        id: "static-box",
        layerId: "main",
        type: "box",
        color: "#fbbf24",
        rotation: [0, 0, 0],
        scale: [1.2, 1.2, 1.2]
      }
    ]
  }
];

let sceneIndex = 0;
let runtime: DenovoCanvasRuntime;

const initialDocument = defineDocument({
  id: "vanilla-document",
  scene: scenes[sceneIndex]!
});
const loadSceneCommand = definePluginCommand({
  parsePayload: (payload) => CanvasSceneSchema.parse(payload),
  type: "plugin.example.load-scene"
});
const loadDocumentCommand = definePluginCommand({
  parsePayload: (payload) => parseDocument(payload),
  type: "plugin.example.load-document"
});
const sceneCommandPlugin = defineCanvasPlugin({
  name: "vanilla-scene-command",
  tools: [
    createSelectTool({ id: TOOL_IDS.select }),
    createPanOrbitTool({ id: TOOL_IDS.panOrbit }),
    createTransformTool({ id: TOOL_IDS.transform }),
    createTransformTool({ id: TOOL_IDS.rotate, operation: "rotate" }),
    createTransformTool({ id: TOOL_IDS.scale, operation: "scale" }),
    create2DShapeTool({
      createId: createAuthoringId,
      fill: "#fb7185",
      grid: twoDimensionalGrid,
      id: TOOL_IDS.rect2D,
      label: "2D Rectangle",
      layerId: AUTHORING_LAYER_ID,
      mode: "2d",
      type: "rect"
    }),
    create2DShapeTool({
      createId: createAuthoringId,
      fill: "#2dd4bf",
      grid: twoDimensionalGrid,
      id: TOOL_IDS.circle2D,
      label: "2D Circle",
      layerId: AUTHORING_LAYER_ID,
      mode: "2d",
      type: "circle"
    }),
    create3DPrimitiveTool({
      color: "#fb7185",
      createId: createAuthoringId,
      grid: threeDimensionalGrid,
      id: TOOL_IDS.box3D,
      label: "3D Box",
      layerId: AUTHORING_LAYER_ID,
      mode: "3d",
      scale: [0.75, 0.75, 0.75],
      type: "box",
      workPlane: threeDimensionalWorkPlane
    }),
    create3DPrimitiveTool({
      color: "#2dd4bf",
      createId: createAuthoringId,
      grid: threeDimensionalGrid,
      id: TOOL_IDS.sphere3D,
      label: "3D Sphere",
      layerId: AUTHORING_LAYER_ID,
      mode: "3d",
      radius: 0.6,
      type: "sphere",
      workPlane: threeDimensionalWorkPlane
    }),
    create3DSurfacePlacementTool({
      color: "#60a5fa",
      createId: createAuthoringId,
      id: TOOL_IDS.stackBox3D,
      label: "Stack Box",
      layerId: AUTHORING_LAYER_ID,
      mode: "3d",
      placement: {
        kind: "box-face",
        orientation: "world-aligned"
      },
      scale: [0.65, 0.65, 0.65],
      type: "box"
    }),
    createDistanceMeasurementTool({
      createId: createAuthoringId,
      grid: twoDimensionalGrid,
      id: TOOL_IDS.distance2D,
      label: "2D Distance",
      layerId: AUTHORING_LAYER_ID,
      mode: "2d",
      precision: 2,
      type: "measurement",
      unit: measurementUnit
    }),
    createDistanceMeasurementTool({
      createId: createAuthoringId,
      grid: threeDimensionalGrid,
      id: TOOL_IDS.distance3D,
      label: "3D Distance",
      layerId: AUTHORING_LAYER_ID,
      mode: "3d",
      precision: 2,
      type: "measurement",
      unit: measurementUnit,
      workPlane: threeDimensionalWorkPlane
    }),
    createAnnotationTool({
      createId: createAuthoringId,
      grid: twoDimensionalGrid,
      id: TOOL_IDS.annotate2D,
      label: "2D Annotation",
      layerId: AUTHORING_LAYER_ID,
      mode: "2d",
      provideDraft: provideAnnotationDraft,
      type: "annotation"
    }),
    createAnnotationTool({
      createId: createAuthoringId,
      grid: threeDimensionalGrid,
      id: TOOL_IDS.annotate3D,
      label: "3D Annotation",
      layerId: AUTHORING_LAYER_ID,
      mode: "3d",
      provideDraft: provideAnnotationDraft,
      type: "annotation",
      workPlane: threeDimensionalWorkPlane
    }),
    {
      cursor: "help",
      id: TOOL_IDS.inspect,
      label: "Inspect",
      navigation: "block",
      onInput(input) {
        if (input.type !== "pointer.up") {
          return;
        }

        const inputCount =
          Number(canvasStage.dataset.denovoToolInputCount ?? "0") + 1;
        canvasStage.dataset.denovoToolInputCount = String(inputCount);
        canvasStage.dataset.denovoToolPointerType = input.pointerType;
      }
    }
  ],
  async setup(context) {
    await Promise.resolve();
    context.registerCommand(
      loadSceneCommand,
      (command, commandContext) => {
        return {
          document: defineDocument({
            ...commandContext.document,
            scene: command.payload
          }),
          selection: createEmptySelection()
        };
      }
    );
    context.registerCommand(
      loadDocumentCommand,
      (command) => {
        return {
          document: command.payload,
          selection: createEmptySelection()
        };
      }
    );
  }
});

const requestedBackend = new URLSearchParams(window.location.search).get(
  "backend"
);

runtime = createCanvas(canvasStage, {
  controls: {
    enablePan: true,
    enableRotate: true,
    enableZoom: true,
    maxDistance: 20,
    minDistance: 1
  },
  document: initialDocument,
  ...(requestedBackend === "webgpu"
    ? { renderer: { backend: "webgpu" as const } }
    : {}),
  plugins: [sceneCommandPlugin],
  onFrame: ({ elapsed, render: renderStats }) => {
    const frameCount = Number(canvasStage.dataset.denovoFrameCount ?? "0") + 1;
    canvasStage.dataset.denovoFrameCount = String(frameCount);
    canvasStage.dataset.denovoDrawCalls = String(renderStats?.drawCalls ?? 0);
    canvasStage.dataset.denovoTriangles = String(renderStats?.triangles ?? 0);
    const current = runtime.current;

    if (
      current.mode !== "3d" ||
      !("objects" in current) ||
      !(current.objects instanceof Map)
    ) {
      return;
    }

    const center = current.objects.get("center");
    const batch = current.objects.get("batch");

    if (center) {
      center.rotation.y = elapsed * 0.00045;
    }

    if (batch) {
      batch.rotation.y = elapsed * 0.00025;
    }
  }
});

const editor = createEditor({
  document: initialDocument
});

type DocumentReloadResult = "error" | "idle" | "pending" | "success";
type EditorAction = () => Promise<void>;

let selectionRevision = 0;
let previousSelection = editor.getState().selection;
let documentRevision = 0;
let previousDocument = editor.getState().document;
let previousNodeIds = new Set(
  previousDocument.scene.nodes.map((node) => node.id)
);
let recentCommittedNodeIds: NodeId[] = [];
let currentGroupId: NodeId | null = null;
let pendingActionCount = 0;
let actionQueue: Promise<void> = Promise.resolve();
let editorReady = false;
let documentReloadRevision = 0;
let documentReloadResult: DocumentReloadResult = "idle";

function selectionsEqual(left: SelectionState, right: SelectionState) {
  return (
    left.primaryId === right.primaryId &&
    left.ids.length === right.ids.length &&
    left.ids.every((id, index) => id === right.ids[index])
  );
}

function getToolMode(toolId: string): CanvasMode | null {
  switch (toolId) {
    case TOOL_IDS.annotate2D:
    case TOOL_IDS.circle2D:
    case TOOL_IDS.distance2D:
    case TOOL_IDS.rect2D:
      return "2d";
    case TOOL_IDS.annotate3D:
    case TOOL_IDS.box3D:
    case TOOL_IDS.distance3D:
    case TOOL_IDS.sphere3D:
    case TOOL_IDS.stackBox3D:
      return "3d";
    default:
      return null;
  }
}

function trackDocumentChanges(document: CanvasDocument) {
  if (document === previousDocument) {
    return;
  }

  documentRevision += 1;
  const nextNodeIds = new Set(document.scene.nodes.map((node) => node.id));

  for (const node of document.scene.nodes) {
    if (previousNodeIds.has(node.id) || node.layerId !== AUTHORING_LAYER_ID) {
      continue;
    }

    if (node.type === "group") {
      currentGroupId = node.id;
      continue;
    }

    if (!recentCommittedNodeIds.includes(node.id)) {
      recentCommittedNodeIds.push(node.id);
    }
  }

  recentCommittedNodeIds = recentCommittedNodeIds.filter((nodeId) => {
    const node = document.scene.nodes.find((candidate) => candidate.id === nodeId);
    return (
      node !== undefined &&
      node.layerId === AUTHORING_LAYER_ID &&
      node.type !== "group"
    );
  });

  const authoringGroups = document.scene.nodes.filter(
    (node) => node.layerId === AUTHORING_LAYER_ID && node.type === "group"
  );

  if (
    currentGroupId === null ||
    !authoringGroups.some((group) => group.id === currentGroupId)
  ) {
    currentGroupId = authoringGroups.at(-1)?.id ?? null;
  }

  previousDocument = document;
  previousNodeIds = nextNodeIds;
}

function getLastCommittedNode(document: CanvasDocument): CanvasNode | null {
  const nodeId = recentCommittedNodeIds.at(-1);

  if (nodeId === undefined) {
    return null;
  }

  return document.scene.nodes.find((node) => node.id === nodeId) ?? null;
}

function getGroupCandidateIds(document: CanvasDocument): NodeId[] {
  return recentCommittedNodeIds.filter((nodeId) => {
    const node = document.scene.nodes.find((candidate) => candidate.id === nodeId);
    return (
      node !== undefined &&
      node.layerId === AUTHORING_LAYER_ID &&
      node.parentId === null &&
      node.type !== "group"
    );
  });
}

function requireLastCommittedNode(): CanvasNode {
  const node = getLastCommittedNode(editor.getState().document);

  if (!node) {
    throw new Error("There is no committed authoring node to edit.");
  }

  return node;
}

function requireAuthoringLayer() {
  const layer = editor
    .getState()
    .document.scene.layers.find((candidate) => candidate.id === AUTHORING_LAYER_ID);

  if (!layer) {
    throw new Error("The explicit authoring layer is missing.");
  }

  return layer;
}

function createPropertyEditCommand(node: CanvasNode): CanvasCommand {
  switch (node.type) {
    case "rect":
      return createNodeUpdateCommand(node, {
        fill: node.fill === "#fb7185" ? "#facc15" : "#fb7185"
      });
    case "circle":
      return createNodeUpdateCommand(node, {
        radius: node.radius + 8
      });
    case "box":
      return createNodeUpdateCommand(node, {
        color: node.color === "#fb7185" ? "#facc15" : "#fb7185"
      });
    case "sphere":
      return createNodeUpdateCommand(node, {
        radius: node.radius + 0.1
      });
    case "instances":
      return createNodeUpdateCommand(node, {
        color: node.color === "#22c55e" ? "#facc15" : "#22c55e"
      });
    case "mesh":
      return createNodeUpdateCommand(node, {
        color: node.color === "#9ca3af" ? "#facc15" : "#9ca3af"
      });
    case "edge":
      return createNodeUpdateCommand(node, {
        stroke: node.stroke === "#94a3b8" ? "#facc15" : "#94a3b8"
      });
    case "text":
      return createNodeUpdateCommand(node, {
        fill: node.fill === "#f8fafc" ? "#facc15" : "#f8fafc"
      });
    case "group":
      return createNodeUpdateCommand(node, { visible: !node.visible });
    case "measurement":
      return createNodeUpdateCommand(node, {
        precision: node.precision === 3 ? 0 : node.precision + 1
      });
    case "annotation":
      return createNodeUpdateCommand(node, {
        text: `${node.text} · edited`
      });
    case "html":
      return createNodeUpdateCommand(node, {
        html: node.html === "" ? "edited" : `${node.html} · edited`
      });
    default:
      return createNodeUpdateCommand(node, { visible: !node.visible });
  }
}

function syncControlAvailability(document: CanvasDocument) {
  const interactionsBlocked = !editorReady || pendingActionCount > 0;

  for (const button of actionButtons) {
    button.disabled = interactionsBlocked;
  }

  for (const [toolId, button] of Object.entries(toolButtons)) {
    const requiredMode = getToolMode(toolId);
    button.disabled =
      interactionsBlocked ||
      (requiredMode !== null && requiredMode !== document.scene.mode);
  }

  annotationTextControl.disabled = interactionsBlocked;
  editLastNodeControl.disabled =
    interactionsBlocked || getLastCommittedNode(document) === null;
  groupLastTwoControl.disabled =
    interactionsBlocked || getGroupCandidateIds(document).length < 2;
  ungroupCurrentControl.disabled =
    interactionsBlocked || currentGroupId === null;
  addLayerControl.disabled =
    interactionsBlocked ||
    document.scene.layers.some((layer) => layer.id === EXTRA_LAYER_ID);
  undoControl.disabled = interactionsBlocked || !editor.canUndo();
  redoControl.disabled = interactionsBlocked || !editor.canRedo();

  const currentRuntime = runtime.current;
  resetViewControl.disabled =
    interactionsBlocked ||
    !(currentRuntime.mode === "2d" && "resetViewState" in currentRuntime);
  stackPlusYControl.disabled =
    interactionsBlocked || document.scene.mode !== "3d";
}

function syncEditorStatus() {
  const state = editor.getState();
  trackDocumentChanges(state.document);

  if (!selectionsEqual(previousSelection, state.selection)) {
    selectionRevision += 1;
    previousSelection = state.selection;
  }

  const primaryId = state.selection.primaryId ?? "none";
  const primaryNode = state.document.scene.nodes.find(
    (node) => node.id === state.selection.primaryId
  );
  const lastCommittedNode = getLastCommittedNode(state.document);
  canvasStage.dataset.denovoSceneId = state.document.scene.id;
  canvasStage.dataset.denovoDocumentRevision = String(documentRevision);
  canvasStage.dataset.denovoDocumentJson = JSON.stringify(state.document);
  canvasStage.dataset.denovoNodeCount = String(state.document.scene.nodes.length);
  canvasStage.dataset.denovoNodeTypes = state.document.scene.nodes
    .map((node) => node.type)
    .join(",");
  canvasStage.dataset.denovoLastCommittedId = lastCommittedNode?.id ?? "none";
  canvasStage.dataset.denovoLastCommittedType =
    lastCommittedNode?.type ?? "none";
  canvasStage.dataset.denovoLayerOrder = state.document.scene.layers
    .map((layer) => layer.id)
    .join(",");
  canvasStage.dataset.denovoLayerVisible = state.document.scene.layers
    .map((layer) => `${layer.id}:${layer.visible}`)
    .join(",");
  canvasStage.dataset.denovoLayerLocked = state.document.scene.layers
    .map((layer) => `${layer.id}:${layer.locked}`)
    .join(",");
  canvasStage.dataset.denovoSelectionIds = state.selection.ids.join(",");
  canvasStage.dataset.denovoSelectionPrimary = primaryId;
  canvasStage.dataset.denovoSelectionParent = primaryNode?.parentId ?? "none";
  canvasStage.dataset.denovoSelectionRevision = String(selectionRevision);
  canvasStage.dataset.denovoParentMap = JSON.stringify(
    state.document.scene.nodes.map((node) => [node.id, node.parentId])
  );
  canvasStage.dataset.denovoGroupId = currentGroupId ?? "none";
  canvasStage.dataset.denovoHistoryUndoDepth = String(state.history.undoDepth);
  canvasStage.dataset.denovoHistoryRedoDepth = String(state.history.redoDepth);
  canvasStage.dataset.denovoPendingCount = String(pendingActionCount);
  canvasStage.dataset.denovoReloadRevision = String(documentReloadRevision);
  canvasStage.dataset.denovoReloadResult = documentReloadResult;
  canvasStage.dataset.denovoActiveTool = state.activeToolId ?? "none";
  canvasStage.dataset.denovoNavigationInput = String(
    runtime.navigationInputEnabled
  );
  const currentRuntime = runtime.current;

  if (currentRuntime.mode === "2d" && "viewState" in currentRuntime) {
    canvasStage.dataset.denovoViewOffset = currentRuntime.viewState.offset.join(",");
    canvasStage.dataset.denovoViewZoom = String(currentRuntime.viewState.zoom);
  } else {
    canvasStage.dataset.denovoViewOffset = "unavailable";
    canvasStage.dataset.denovoViewZoom = "unavailable";
  }
  canvasStage.dataset.denovoPanelPosition = getNodePosition("panel");
  canvasStage.dataset.denovoStaticBoxPosition = getNodePosition("static-box");
  statusOutput.textContent = primaryId;
  toolOutput.textContent = state.activeToolId ?? "none";

  for (const [toolId, button] of Object.entries(toolButtons)) {
    button.setAttribute("aria-pressed", String(state.activeToolId === toolId));
  }

  syncControlAvailability(state.document);
}

function getNodePosition(nodeId: string): string {
  const node = editor
    .getState()
    .document.scene.nodes.find((candidate) => candidate.id === nodeId);
  return node && "position" in node ? node.position.join(",") : "none";
}

function formatBoundaryError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function reportBoundaryError(error: unknown) {
  const message = formatBoundaryError(error);
  canvasStage.dataset.denovoInputError = message;
  canvasStage.dataset.denovoPendingError = message;
}

function enqueueEditorAction(action: EditorAction) {
  pendingActionCount += 1;
  canvasStage.dataset.denovoInputError = "none";
  canvasStage.dataset.denovoPendingError = "none";
  syncEditorStatus();

  const runAction = async () => {
    try {
      await action();
    } catch (error: unknown) {
      reportBoundaryError(error);
    } finally {
      pendingActionCount -= 1;

      try {
        syncEditorStatus();
      } catch (error: unknown) {
        reportBoundaryError(error);
      }
    }
  };
  actionQueue = actionQueue.then(runAction, runAction);
}

canvasStage.dataset.denovoEditorReady = "false";
canvasStage.dataset.denovoInputError = "none";
canvasStage.dataset.denovoPendingError = "none";
canvasStage.dataset.denovoToolInputCount = "0";
canvasStage.dataset.denovoToolPointerType = "none";

syncEditorStatus();

const storage = createIndexedDbDocumentAdapter();
const disconnectEditor = connectEditorToCanvas(editor, runtime, {
  onError(error) {
    reportBoundaryError(error);
  },
  storage,
  storageDebounceMs: 500
});
const unsubscribeEditor = editor.subscribe(syncEditorStatus);
let diagnosticFrameId: number | null = null;

function scheduleRuntimeDiagnostics() {
  if (diagnosticFrameId !== null) {
    return;
  }

  diagnosticFrameId = requestAnimationFrame(() => {
    diagnosticFrameId = null;
    syncEditorStatus();
  });
}

canvasStage.addEventListener("pointerup", scheduleRuntimeDiagnostics);
canvasStage.addEventListener("pointercancel", scheduleRuntimeDiagnostics);
canvasStage.addEventListener("wheel", scheduleRuntimeDiagnostics);
await runtime.ready;
editor.activateTool(TOOL_IDS.select);
editorReady = true;
canvasStage.dataset.denovoEditorReady = "true";
syncEditorStatus();

for (const [toolId, button] of Object.entries(toolButtons)) {
  button.addEventListener("click", () => {
    canvasStage.dataset.denovoInputError = "none";
    canvasStage.dataset.denovoPendingError = "none";

    try {
      editor.activateTool(toolId);
    } catch (error: unknown) {
      reportBoundaryError(error);
    }
  });
}

swapButton.addEventListener("click", () => {
  enqueueEditorAction(async () => {
    const nextSceneIndex = (sceneIndex + 1) % scenes.length;
    const serializedScene = JSON.stringify(scenes[nextSceneIndex]);
    const parsedScene: unknown = JSON.parse(serializedScene) as unknown;
    const payload: JsonValue = JsonValueSchema.parse(parsedScene);
    await editor.dispatch({
      payload,
      type: "plugin.example.load-scene"
    });
    sceneIndex = nextSceneIndex;
  });
});

resetViewControl.addEventListener("click", () => {
  enqueueEditorAction(async () => {
    const currentRuntime = runtime.current;

    if (currentRuntime.mode !== "2d" || !("resetViewState" in currentRuntime)) {
      throw new Error(
        "Reset View requires the built-in Canvas2D viewport runtime."
      );
    }

    currentRuntime.resetViewState();
  });
});

editLastNodeControl.addEventListener("click", () => {
  enqueueEditorAction(async () => {
    await editor.dispatch(createPropertyEditCommand(requireLastCommittedNode()));
  });
});

groupLastTwoControl.addEventListener("click", () => {
  enqueueEditorAction(async () => {
    const document = editor.getState().document;
    const candidates = getGroupCandidateIds(document);
    const [firstNodeId, secondNodeId] = candidates.slice(-2);

    if (firstNodeId === undefined || secondNodeId === undefined) {
      throw new Error("Grouping requires two committed authoring nodes.");
    }

    await editor.dispatch(
      createGroupNodesCommand({
        createId: createAuthoringId,
        document,
        nodeIds: [firstNodeId, secondNodeId]
      })
    );
  });
});

ungroupCurrentControl.addEventListener("click", () => {
  enqueueEditorAction(async () => {
    const groupId = currentGroupId;

    if (groupId === null) {
      throw new Error("There is no current authoring group to ungroup.");
    }

    const document = editor.getState().document;
    await editor.dispatch(createUngroupNodesCommand(document, groupId));
  });
});

addLayerControl.addEventListener("click", () => {
  enqueueEditorAction(async () => {
    await editor.apply([
      addLayer({
        layerId: EXTRA_LAYER_ID,
        name: "Authoring Extra"
      })
    ]);
  });
});

reorderLayerButton.addEventListener("click", () => {
  enqueueEditorAction(async () => {
    const document = editor.getState().document;
    const currentIndex = document.scene.layers.findIndex(
      (layer) => layer.id === AUTHORING_LAYER_ID
    );

    if (currentIndex < 0) {
      throw new Error("The explicit authoring layer is missing.");
    }

    await editor.apply([
      reorderLayer({
        index: currentIndex === 0 ? document.scene.layers.length - 1 : 0,
        layerId: AUTHORING_LAYER_ID
      })
    ]);
  });
});

toggleLayerVisibleButton.addEventListener("click", () => {
  enqueueEditorAction(async () => {
    const layer = requireAuthoringLayer();
    const command: CanvasCommand = {
      layerId: layer.id,
      patch: { visible: !layer.visible },
      type: "layer.update"
    };
    await editor.dispatch(command);
  });
});

toggleLayerLockedButton.addEventListener("click", () => {
  enqueueEditorAction(async () => {
    const layer = requireAuthoringLayer();
    const command: CanvasCommand = {
      layerId: layer.id,
      patch: { locked: !layer.locked },
      type: "layer.update"
    };
    await editor.dispatch(command);
  });
});

undoControl.addEventListener("click", () => {
  enqueueEditorAction(async () => {
    await editor.undo();
  });
});

redoControl.addEventListener("click", () => {
  enqueueEditorAction(async () => {
    await editor.redo();
  });
});

reloadDocumentJsonButton.addEventListener("click", () => {
  enqueueEditorAction(async () => {
    documentReloadResult = "pending";
    syncEditorStatus();

    try {
      const serializedDocument = JSON.stringify(editor.getState().document);
      const parsedDocument: unknown = JSON.parse(serializedDocument) as unknown;
      const payload: JsonValue = JsonValueSchema.parse(parsedDocument);
      await editor.dispatch({
        payload,
        type: "plugin.example.load-document"
      });
      documentReloadRevision += 1;
      documentReloadResult = "success";
    } catch (error: unknown) {
      documentReloadResult = "error";
      throw error;
    }
  });
});

stackPlusYControl.addEventListener("click", () => {
  enqueueEditorAction(async () => {
    const document = editor.getState().document;
    const target = findNamedStackTarget(document);

    if (!target) {
      throw new Error("No world-aligned box to stack on.");
    }

    const result = await editor.apply([
      stackBox({
        createId: () => NAMED_STACK_ID,
        face: "+y",
        on: target.id
      })
    ]);
    publishNamedStack(editor.getState().document, result.changed);
  });
});

window.addEventListener(
  "pagehide",
  () => {
    if (diagnosticFrameId !== null) {
      cancelAnimationFrame(diagnosticFrameId);
    }

    canvasStage.removeEventListener("pointerup", scheduleRuntimeDiagnostics);
    canvasStage.removeEventListener("pointercancel", scheduleRuntimeDiagnostics);
    canvasStage.removeEventListener("wheel", scheduleRuntimeDiagnostics);
    unsubscribeEditor();
    disconnectEditor();
    runtime.destroy();
  },
  { once: true }
);
