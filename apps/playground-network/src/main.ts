import {
  connectEditorToCanvas,
  createCanvas,
  createEditor,
  createSelectTool,
  listNodes,
  setLayerVisible,
  type Canvas2DNode,
  type Canvas2DRenderNodeContext,
  type ListedNode
} from "@de-novo/canvas/2d";
import "@de-novo/canvas/styles.css";

import { renderNetworkService } from "./cards";
import {
  createServiceMapDocument,
  NETWORK_HUB_ID,
  NETWORK_LABEL_LAYER_ID,
  NETWORK_LABEL_NODE_IDS,
  NETWORK_SERVICE_NODE_IDS
} from "./document";
import { applyNetworkLayout, registerNetworkLayouts } from "./layout";
import "./styles.css";

const stage = document.querySelector<HTMLElement>("#stage");
const statusOutput = document.querySelector<HTMLOutputElement>("#status");
const nodesOutput = document.querySelector<HTMLElement>("#nodes");

if (!stage) {
  throw new Error("Service map stage was not found.");
}

const host = stage;
const documentModel = createServiceMapDocument();

const renderNode = (
  node: Canvas2DNode,
  context: Canvas2DRenderNodeContext
): HTMLElement | string => {
  if (node.type !== "html") {
    return "";
  }
  return renderNetworkService(node, context);
};

const runtime = createCanvas(host, {
  canvas2d: {
    initialView: { offset: [8, 8], zoom: 0.92 },
    minimap: { position: "bottom-right" },
    navigation: { enablePan: true, enableZoom: true }
  },
  document: documentModel,
  editable: true,
  renderNode
});

const editor = createEditor({ document: documentModel });
connectEditorToCanvas(editor, runtime);
registerNetworkLayouts(editor);
editor.registerTool(createSelectTool({ id: "network.select" }));
editor.activateTool("network.select");

type NetworkShowcaseProbe = {
  hubPosition: readonly [number, number] | null;
  iframeCount: number;
  labelVisible: boolean;
  listed: readonly ListedNode[];
  overlayCount: number;
  selectedId: string | null;
  undoDepth: number;
};

function readHubPosition(): readonly [number, number] | null {
  const node = editor.getState().document.scene.nodes.find(
    (candidate) => candidate.id === NETWORK_HUB_ID
  );
  if (!node || !("position" in node)) {
    return null;
  }
  const position = node.position;
  if (
    !Array.isArray(position) ||
    position.length < 2 ||
    typeof position[0] !== "number" ||
    typeof position[1] !== "number"
  ) {
    return null;
  }
  return [position[0], position[1]];
}

function resolveLayoutBounds(ids: readonly string[]) {
  const current = runtime.current;
  if (
    current &&
    "resolveNodeBounds" in current &&
    typeof current.resolveNodeBounds === "function"
  ) {
    return current.resolveNodeBounds(ids);
  }
  return new Map();
}

function publishProbe(): NetworkShowcaseProbe {
  const state = editor.getState();
  const labels = state.document.scene.layers.find(
    (layer) => layer.id === NETWORK_LABEL_LAYER_ID
  );
  const probe: NetworkShowcaseProbe = {
    hubPosition: readHubPosition(),
    iframeCount: document.querySelectorAll("iframe").length,
    labelVisible: labels?.visible !== false,
    listed: listNodes(state.document),
    overlayCount: document.querySelectorAll(".point-field-overlay").length,
    selectedId: state.selection.primaryId,
    undoDepth: state.history.undoDepth
  };
  (
    window as unknown as { __networkShowcase?: NetworkShowcaseProbe }
  ).__networkShowcase = probe;
  host.dataset.denovoNetworkReady = "true";
  host.dataset.denovoNetworkLabels = probe.labelVisible ? "true" : "false";
  host.dataset.denovoNetworkUndo = String(probe.undoDepth);
  if (statusOutput) {
    const selected = probe.selectedId ?? "none";
    statusOutput.textContent = probe.labelVisible
      ? `select ${selected}`
      : `labels hidden · select ${selected}`;
  }
  if (nodesOutput) {
    nodesOutput.textContent = probe.listed
      .map((node) => `${node.id}  ${node.type}  ${node.visible ? "on" : "off"}`)
      .join("\n");
  }
  return probe;
}

editor.subscribe(() => {
  publishProbe();
});

function fitServiceMap(): void {
  const current = runtime.current;
  if (
    !current ||
    !("fitViewBounds" in current) ||
    typeof current.fitViewBounds !== "function" ||
    !("resolveNodeBounds" in current) ||
    typeof current.resolveNodeBounds !== "function"
  ) {
    return;
  }

  const boundsById = current.resolveNodeBounds([
    ...NETWORK_SERVICE_NODE_IDS,
    ...NETWORK_LABEL_NODE_IDS
  ]);
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const bounds of boundsById.values()) {
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX);
    maxY = Math.max(maxY, bounds.maxY);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return;
  }

  current.fitViewBounds({ maxX, maxY, minX, minY }, 56, false);
}

function requireButton(id: string): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(`#${id}`);
  if (!button) {
    throw new Error(`Control was not found: ${id}`);
  }
  return button;
}

requireButton("select-tool").addEventListener("click", () => {
  editor.activateTool("network.select");
  publishProbe();
});
requireButton("layout-relation").addEventListener("click", () => {
  void applyNetworkLayout(
    editor,
    "layout.relation-graph",
    resolveLayoutBounds
  ).then(() => {
    fitServiceMap();
    publishProbe();
  });
});
requireButton("layout-time").addEventListener("click", () => {
  void applyNetworkLayout(editor, "layout.time-graph", resolveLayoutBounds).then(
    () => {
      fitServiceMap();
      publishProbe();
    }
  );
});
requireButton("hide-labels").addEventListener("click", () => {
  void editor
    .apply([setLayerVisible({ layerId: NETWORK_LABEL_LAYER_ID, visible: false })])
    .then(() => {
      publishProbe();
    });
});
requireButton("show-labels").addEventListener("click", () => {
  void editor
    .apply([setLayerVisible({ layerId: NETWORK_LABEL_LAYER_ID, visible: true })])
    .then(() => {
      publishProbe();
    });
});
requireButton("undo").addEventListener("click", () => {
  void editor.undo().then(() => {
    fitServiceMap();
    publishProbe();
  });
});

(
  window as unknown as {
    __denovoEditor?: typeof editor;
    __denovoRuntime?: typeof runtime;
  }
).__denovoEditor = editor;
(
  window as unknown as {
    __denovoEditor?: typeof editor;
    __denovoRuntime?: typeof runtime;
  }
).__denovoRuntime = runtime;

publishProbe();
fitServiceMap();
