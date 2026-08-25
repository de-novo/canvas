import {
  connectEditorToCanvas,
  createCanvas,
  createEditor,
  createSelectTool,
  isDenovoFieldNode,
  listNodes,
  type ListedNode
} from "@denovo/canvas";
import "@denovo/canvas/styles.css";

import { applyFieldPatternOps } from "./apply-pattern";
import { mountCompareBoard } from "./compare";
import { createWarpFieldDocument, FIELD_NODE_ID } from "./document";
import "./styles.css";

const stage = document.querySelector<HTMLElement>("#stage");
const compareRoot = document.querySelector<HTMLElement>("[data-field-compare]");
const statusOutput = document.querySelector<HTMLOutputElement>("#status");
const nodesOutput = document.querySelector<HTMLElement>("#nodes");

if (!stage) {
  throw new Error("Warp field stage was not found.");
}
if (!compareRoot) {
  throw new Error("Warp field compare board was not found.");
}

const compare = mountCompareBoard(compareRoot);

const host = stage;
const documentModel = createWarpFieldDocument();
const runtime = createCanvas(host, {
  document: documentModel,
  editable: true
});
const editor = createEditor({ document: documentModel });
connectEditorToCanvas(editor, runtime);
editor.registerTool(createSelectTool({ id: "field.select" }));
editor.activateTool("field.select");

type FieldShowcaseProbe = {
  iframeCount: number;
  listed: readonly ListedNode[];
  pattern: "letters" | "streaks" | null;
  selectedId: string | null;
  undoDepth: number;
  vendorRenderer: boolean;
};

function readPattern(): "letters" | "streaks" | null {
  const node = editor.getState().document.scene.nodes.find(
    (candidate) => candidate.id === FIELD_NODE_ID
  );
  if (!node || !isDenovoFieldNode(node)) {
    return null;
  }
  return node.props.pattern;
}

function publishProbe(): FieldShowcaseProbe {
  const state = editor.getState();
  const probe: FieldShowcaseProbe = {
    iframeCount: document.querySelectorAll("iframe").length,
    listed: listNodes(state.document),
    pattern: readPattern(),
    selectedId: state.selection.primaryId,
    undoDepth: state.history.undoDepth,
    vendorRenderer:
      typeof (window as unknown as { createWarpFieldRenderer?: unknown })
        .createWarpFieldRenderer === "function"
  };
  (
    window as unknown as { __fieldShowcase?: FieldShowcaseProbe }
  ).__fieldShowcase = probe;
  host.dataset.denovoFieldReady = "true";
  host.dataset.denovoFieldPattern = probe.pattern ?? "none";
  host.dataset.denovoFieldUndo = String(probe.undoDepth);
  if (statusOutput) {
    statusOutput.textContent = `${probe.pattern ?? "missing"} · select ${probe.selectedId ?? "none"}`;
  }
  if (nodesOutput) {
    nodesOutput.textContent = probe.listed
      .map((node) => `${node.id}  ${node.type}  ${node.visible ? "on" : "off"}`)
      .join("\n");
  }
  const node = editor.getState().document.scene.nodes.find(
    (candidate) => candidate.id === FIELD_NODE_ID
  );
  compare.updateLiveNode(
    `${JSON.stringify(
      node && isDenovoFieldNode(node)
        ? {
            id: node.id,
            type: node.type,
            layerId: node.layerId,
            props: node.props
          }
        : null,
      null,
      2
    )}\n`
  );
  return probe;
}

editor.subscribe(() => {
  publishProbe();
});

function requireButton(id: string): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(`#${id}`);
  if (!button) {
    throw new Error(`Control was not found: ${id}`);
  }
  return button;
}

requireButton("select-tool").addEventListener("click", () => {
  editor.activateTool("field.select");
  publishProbe();
});
requireButton("pattern-letters").addEventListener("click", () => {
  void editor.apply(applyFieldPatternOps("letters")).then(() => {
    publishProbe();
  });
});
requireButton("pattern-streaks").addEventListener("click", () => {
  void editor.apply(applyFieldPatternOps("streaks")).then(() => {
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
