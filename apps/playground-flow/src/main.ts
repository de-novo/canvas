import {
  connectEditorToCanvas,
  createCanvas,
  createConnectorTool,
  createEditor,
  createSelectTool,
  createTransformTool,
  listNodes,
  setLayerVisible,
  type Canvas2DNode,
  type Canvas2DRenderNodeContext,
  type ListedNode
} from "@denovo/canvas";
import "@denovo/canvas/styles.css";

import { renderFlowCard } from "./cards";
import { createReleaseBoardDocument, FLOW_LABEL_LAYER_ID } from "./document";
import "./styles.css";

const stage = document.querySelector<HTMLElement>("#stage");
const statusOutput = document.querySelector<HTMLOutputElement>("#status");
const nodesOutput = document.querySelector<HTMLElement>("#nodes");

if (!stage) {
  throw new Error("Release board stage was not found.");
}

const host = stage;
const documentModel = createReleaseBoardDocument();

const renderNode = (
  node: Canvas2DNode,
  context: Canvas2DRenderNodeContext
): HTMLElement | string => {
  if (node.type !== "html") {
    return "";
  }
  return renderFlowCard(node, context);
};

const runtime = createCanvas(host, {
  canvas2d: {
    initialView: { offset: [24, 16], zoom: 0.82 },
    minimap: { position: "bottom-right" },
    navigation: { enablePan: true, enableZoom: true }
  },
  document: documentModel,
  editable: true,
  renderNode
});

const editor = createEditor({ document: documentModel });
connectEditorToCanvas(editor, runtime);

editor.registerTool(createSelectTool({ id: "flow.select" }));
editor.registerTool(
  createTransformTool({
    id: "flow.move",
    label: "Move",
    operation: "translate"
  })
);
editor.registerTool(
  createConnectorTool({
    createId: () => `edge-${Math.random().toString(36).slice(2, 8)}`,
    id: "flow.connect",
    label: "Connect",
    layerId: "board",
    mode: "2d",
    stroke: "#64748b",
    strokeWidth: 2
  })
);
editor.activateTool("flow.select");

type FlowShowcaseProbe = {
  iframeCount: number;
  labelVisible: boolean;
  listed: readonly ListedNode[];
  selectedId: string | null;
  undoDepth: number;
};

function publishProbe(): FlowShowcaseProbe {
  const state = editor.getState();
  const labels = state.document.scene.layers.find(
    (layer) => layer.id === FLOW_LABEL_LAYER_ID
  );
  const probe: FlowShowcaseProbe = {
    iframeCount: document.querySelectorAll("iframe").length,
    labelVisible: labels?.visible !== false,
    listed: listNodes(state.document),
    selectedId: state.selection.primaryId,
    undoDepth: state.history.undoDepth
  };
  (
    window as unknown as { __flowShowcase?: FlowShowcaseProbe }
  ).__flowShowcase = probe;
  host.dataset.denovoFlowReady = "true";
  host.dataset.denovoFlowLabels = probe.labelVisible ? "true" : "false";
  host.dataset.denovoFlowUndo = String(probe.undoDepth);
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

const current = runtime.current;
if (
  current &&
  "fitViewBounds" in current &&
  typeof current.fitViewBounds === "function"
) {
  current.fitViewBounds(
    { maxX: 1210, maxY: 280, minX: 24, minY: 24 },
    40,
    false
  );
}

function requireButton(id: string): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(`#${id}`);
  if (!button) {
    throw new Error(`Control was not found: ${id}`);
  }
  return button;
}

requireButton("select-tool").addEventListener("click", () => {
  editor.activateTool("flow.select");
  publishProbe();
});
requireButton("move-tool").addEventListener("click", () => {
  editor.activateTool("flow.move");
  publishProbe();
});
requireButton("connect-tool").addEventListener("click", () => {
  editor.activateTool("flow.connect");
  publishProbe();
});
requireButton("hide-labels").addEventListener("click", () => {
  void editor
    .apply([setLayerVisible({ layerId: FLOW_LABEL_LAYER_ID, visible: false })])
    .then((result) => {
      if (statusOutput) {
        statusOutput.textContent = result.changed
          ? "labels hidden"
          : "labels already hidden";
      }
      publishProbe();
    });
});
requireButton("show-labels").addEventListener("click", () => {
  void editor
    .apply([setLayerVisible({ layerId: FLOW_LABEL_LAYER_ID, visible: true })])
    .then((result) => {
      if (statusOutput) {
        statusOutput.textContent = result.changed
          ? "labels shown"
          : "labels already shown";
      }
      publishProbe();
    });
});
requireButton("undo").addEventListener("click", () => {
  void editor.undo().then(() => {
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
