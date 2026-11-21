import {
  connectEditorToCanvas,
  createCanvas,
  createConnectorTool,
  createEditor,
  createSelectTool,
  createTransformTool,
  listNodes,
  parseDocumentJson,
  removeEdge,
  removeNode,
  setLayerVisible,
  type Canvas2DNode,
  type Canvas2DRenderNodeContext,
  type CanvasDocument,
  type CanvasEditor,
  type ListedNode,
  type NamedOperation
} from "@denovo/canvas";
import "@denovo/canvas/styles.css";

import { encodeFlowCard, FLOW_CARD_STATUSES, readFlowCard, renderFlowCard } from "./cards";
import {
  createReleaseBoardDocument,
  FLOW_BOARD_LAYER_ID,
  FLOW_CARD_HEIGHT,
  FLOW_CARD_WIDTH,
  FLOW_LABEL_LAYER_ID
} from "./document";
import "./styles.css";

const stage = document.querySelector<HTMLElement>("#stage");
const statusOutput = document.querySelector<HTMLOutputElement>("#status");
const nodesOutput = document.querySelector<HTMLElement>("#nodes");

if (!stage) {
  throw new Error("Release board stage was not found.");
}

const host = stage;
const boardStorageKey = "denovo.playground.flow.release-board";
const storageNotice = document.querySelector<HTMLOutputElement>("#storage-notice")!;

function openBoard() {
  try {
    const saved = localStorage.getItem(boardStorageKey);
    if (saved !== null) {
      const board = parseDocumentJson(saved);
      if (board.id !== "flow-release-board" || board.scene.mode !== "2d") {
        throw new Error("Unexpected board document");
      }
      storageNotice.textContent = "Opened saved board.";
      return board;
    }
  } catch {
    storageNotice.textContent = "Could not open the saved board. Showing the example.";
  }
  return createReleaseBoardDocument();
}

const documentModel = openBoard();

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

const form = document.querySelector<HTMLFormElement>("#card-editor")!;
const titleInput = document.querySelector<HTMLInputElement>("#card-title")!;
const ownerInput = document.querySelector<HTMLInputElement>("#card-owner")!;
const statusInput = document.querySelector<HTMLSelectElement>("#card-status")!;
for (const status of FLOW_CARD_STATUSES) {
  statusInput.add(new Option(status, status));
}

function requireButton(id: string): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(`#${id}`);
  if (!button) {
    throw new Error(`Control was not found: ${id}`);
  }
  return button;
}

const undoButton = requireButton("undo");
const redoButton = requireButton("redo");
const deleteSelectedButton = requireButton("delete-selected");

let editor!: CanvasEditor;
let detachEditor: (() => void) | null = null;
let displayedCard: string | undefined;

function fitBoardView() {
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
}

function selectedNode() {
  const { document, selection } = editor.getState();
  return document.scene.nodes.find((item) => item.id === selection.primaryId) ?? null;
}

function selectedCard() {
  const node = selectedNode();
  if (node?.type !== "html") return null;
  const card = readFlowCard(node);
  return card && { node, card };
}

function deletableSelection() {
  const node = selectedNode();
  return node && (node.type === "html" || node.type === "edge") ? node : null;
}

function refreshControls() {
  undoButton.disabled = !editor.canUndo();
  redoButton.disabled = !editor.canRedo();
  deleteSelectedButton.disabled = !deletableSelection();
  const selected = selectedCard();
  form.hidden = !selected;
  const key = selected && JSON.stringify([selected.node.id, selected.node.html]);
  if (selected && key !== displayedCard) {
    titleInput.value = selected.card.title;
    ownerInput.value = selected.card.owner;
    statusInput.value = selected.card.status;
  }
  displayedCard = key ?? undefined;
}

function nextCardSlot(document: CanvasDocument): {
  id: string;
  index: number;
  position: [number, number];
} {
  const existingIds = new Set(document.scene.nodes.map((node) => node.id));
  let index = 1;
  while (existingIds.has(`card-${index}`)) {
    index += 1;
  }
  const htmlCards = document.scene.nodes.filter(
    (node): node is Extract<Canvas2DNode, { type: "html" }> => node.type === "html"
  );
  for (let slot = 0; ; slot += 1) {
    const x = 48 + (slot % 5) * 236;
    const y = 296 + Math.floor(slot / 5) * 124;
    const overlaps = htmlCards.some((card) => {
      const width = card.width ?? FLOW_CARD_WIDTH;
      const height = card.height ?? FLOW_CARD_HEIGHT;
      return (
        x < card.position[0] + width &&
        x + FLOW_CARD_WIDTH > card.position[0] &&
        y < card.position[1] + height &&
        y + FLOW_CARD_HEIGHT > card.position[1]
      );
    });
    if (!overlaps) {
      return { id: `card-${index}`, index, position: [x, y] };
    }
  }
}

async function addCard() {
  const { id, index, position } = nextCardSlot(editor.getState().document);
  try {
    await editor.dispatch({
      type: "transaction",
      label: "Add card",
      commands: [
        {
          type: "node.add",
          label: "Add card",
          node: {
            height: FLOW_CARD_HEIGHT,
            html: encodeFlowCard({
              owner: "Team",
              status: "ready",
              title: `Task ${index}`
            }),
            id,
            layerId: FLOW_BOARD_LAYER_ID,
            position,
            type: "html",
            width: FLOW_CARD_WIDTH
          }
        },
        {
          type: "selection.set",
          selection: { hoveredId: null, ids: [id], primaryId: id }
        }
      ]
    });
  } catch (error) {
    if (statusOutput) statusOutput.textContent = String(error);
  }
}

async function deleteSelected() {
  const target = deletableSelection();
  if (!target) return;
  const nodes = editor.getState().document.scene.nodes;
  const removing = new Set<string>([target.id]);
  const incidentEdgeIds: string[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const node of nodes) {
      if (
        node.type === "edge" &&
        !removing.has(node.id) &&
        (removing.has(node.sourceId) || removing.has(node.targetId))
      ) {
        removing.add(node.id);
        incidentEdgeIds.push(node.id);
        added = true;
      }
    }
  }
  const operations: NamedOperation[] = [
    ...incidentEdgeIds.reverse().map((nodeId) => removeEdge({ nodeId })),
    target.type === "edge"
      ? removeEdge({ nodeId: target.id })
      : removeNode({ nodeId: target.id })
  ];
  try {
    await editor.apply(operations);
  } catch (error) {
    if (statusOutput) statusOutput.textContent = String(error);
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const selected = selectedCard();
  const status = FLOW_CARD_STATUSES.find(value => value === statusInput.value);
  const title = titleInput.value.trim();
  const owner = ownerInput.value.trim();
  if (!selected || !status || !title || !owner) return;
  const html = encodeFlowCard({ owner, status, title });
  if (html === selected.node.html) return;
  try {
    await editor.dispatch({
      type: "node.update", nodeMode: "2d", nodeType: "html",
      nodeId: selected.node.id, patch: { html }
    });
  } catch (error) {
    if (statusOutput) statusOutput.textContent = String(error);
  }
});

type FlowShowcaseProbe = {
  iframeCount: number;
  labelVisible: boolean;
  listed: readonly ListedNode[];
  redoDepth: number;
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
    redoDepth: state.history.redoDepth,
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

function mountBoardEditor(boardDocument: CanvasDocument, reloadRuntime: boolean) {
  detachEditor?.();
  if (reloadRuntime) {
    runtime.loadDocument(boardDocument);
  }
  const nextEditor = createEditor({ document: boardDocument });
  const disconnect = connectEditorToCanvas(nextEditor, runtime);

  nextEditor.registerTool(createSelectTool({ id: "flow.select" }));
  nextEditor.registerTool(
    createTransformTool({
      id: "flow.move",
      label: "Move",
      operation: "translate"
    })
  );
  nextEditor.registerTool({
    ...createConnectorTool({
      createId: () => `edge-${Math.random().toString(36).slice(2, 8)}`,
      id: "flow.connect",
      label: "Connect",
      layerId: FLOW_BOARD_LAYER_ID,
      mode: "2d",
      stroke: "#64748b",
      strokeWidth: 2
    }),
    // Reserve the primary drag for drawing an edge on this board.
    navigation: "block"
  });
  nextEditor.activateTool("flow.select");

  const unsubscribe = nextEditor.subscribe(() => {
    refreshControls();
    publishProbe();
  });

  editor = nextEditor;
  displayedCard = undefined;
  detachEditor = () => {
    unsubscribe();
    disconnect();
  };
  (
    window as unknown as {
      __denovoEditor?: CanvasEditor;
      __denovoRuntime?: typeof runtime;
    }
  ).__denovoEditor = nextEditor;
  (
    window as unknown as {
      __denovoEditor?: CanvasEditor;
      __denovoRuntime?: typeof runtime;
    }
  ).__denovoRuntime = runtime;

  fitBoardView();
  refreshControls();
  publishProbe();
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
requireButton("add-card").addEventListener("click", () => {
  void addCard();
});
deleteSelectedButton.addEventListener("click", () => {
  void deleteSelected();
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
requireButton("save-board").addEventListener("click", () => {
  try {
    localStorage.setItem(boardStorageKey, JSON.stringify(editor.getState().document));
    storageNotice.textContent = "Saved in this browser.";
  } catch {
    storageNotice.textContent = "Could not save in this browser.";
  }
});
requireButton("reset-board").addEventListener("click", () => {
  try {
    localStorage.removeItem(boardStorageKey);
    mountBoardEditor(createReleaseBoardDocument(), true);
    storageNotice.textContent = "Reset to example board.";
  } catch {
    storageNotice.textContent = "Could not reset saved board.";
  }
});
undoButton.addEventListener("click", () => {
  void editor.undo().then(() => {
    refreshControls();
    publishProbe();
  });
});
redoButton.addEventListener("click", () => {
  void editor.redo().then(() => {
    refreshControls();
    publishProbe();
  });
});

mountBoardEditor(documentModel, false);
