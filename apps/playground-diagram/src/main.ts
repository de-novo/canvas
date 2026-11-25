import {
  connectCanvasToolInput,
  createCanvas2D,
  createEditor,
  createSelectTool,
  defineDocument,
  type Canvas2DNode,
  type Canvas2DRenderNodeContext,
  type CanvasSceneInput
} from "@de-novo/canvas/2d";
import {
  createAlignAdapter,
  createConnectorTool,
  type CanvasLayoutAdapter
} from "@de-novo/canvas-editor";
import "@de-novo/canvas/styles.css";
import "./styles.css";

const stage = document.getElementById("stage");
if (!stage) {
  throw new Error("Element #stage not found");
}
const statusOutput = document.getElementById("status");
const moveButton = document.getElementById("move-source");
const fitButton = document.getElementById("fit");
const flyButton = document.getElementById("fly");
const connectButton = document.getElementById("connect");
const alignButton = document.getElementById("align-top");
const customLayoutButton = document.getElementById("custom-layout");

const scene: CanvasSceneInput = {
  id: "diagram",
  mode: "2d",
  layers: [{ id: "main", name: "Main" }],
  nodes: [
    {
      id: "node-a",
      layerId: "main",
      type: "rect",
      fill: "#38bdf8",
      position: [80, 80],
      size: [120, 60]
    },
    {
      id: "node-b",
      layerId: "main",
      type: "circle",
      fill: "#f97316",
      position: [360, 200],
      radius: 40
    },
    {
      id: "edge-1",
      layerId: "main",
      type: "edge",
      sourceId: "node-a",
      targetId: "node-b",
      stroke: "#94a3b8",
      strokeWidth: 2,
      targetArrow: true,
      curve: "curved",
      curveOffset: 60
    },
    {
      // Port-attached orthogonal edge: leaves node-a's bottom side and enters
      // the card's left side, so the line should visibly start/end at those
      // handles rather than at the node centres.
      id: "edge-2",
      layerId: "main",
      type: "edge",
      sourceId: "node-a",
      targetId: "card-1",
      sourcePort: "bottom",
      targetPort: "left",
      routing: "orthogonal",
      stroke: "#22c55e",
      strokeWidth: 2,
      targetArrow: true
    },
    {
      id: "label-1",
      layerId: "main",
      type: "text",
      fill: "#e2e8f0",
      position: [180, 40],
      text: "node-a → node-b",
      fontSize: 16
    },
    {
      id: "card-1",
      layerId: "main",
      type: "html",
      position: [200, 260],
      html: `<div class="card"><strong>HTML Card</strong><span>node-b</span></div>`,
      width: 120,
      height: 48
    },
    {
      id: "text-probe",
      layerId: "main",
      type: "html",
      position: [40, 340],
      html: "plain-text-card",
      width: 140,
      height: 24
    }
  ]
};

const renderNode = (
  node: Canvas2DNode,
  _context: Canvas2DRenderNodeContext
): HTMLElement | string => {
  if (node.type !== "html") {
    return "";
  }
  if (node.id === "text-probe") {
    return node.html;
  }
  const el = document.createElement("div");
  el.innerHTML = node.html;
  el.className = "denovo-card";
  return el;
};

const runtime = createCanvas2D(stage, scene, {
  renderNode,
  canvas2d: { minimap: { position: "bottom-right" } }
});
const editor = createEditor({ document: defineDocument({ id: "diagram-doc", scene }) });

// Exposed for manual inspection and browser-driven checks (hit-testing the live
// canvas from devtools or a Playwright probe). Playground-only.
(window as unknown as { __denovoRuntime?: unknown }).__denovoRuntime = runtime;
(window as unknown as { __denovoEditor?: unknown }).__denovoEditor = editor;

// Pointer + keyboard bridge: routes input to the active tool, and binds
// Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z to editor history. The bridge is mode-agnostic
// while this runtime is 2D-only, so the cast narrows to the shared surface.
connectCanvasToolInput(
  runtime as unknown as Parameters<typeof connectCanvasToolInput>[0],
  editor
);

// Push document + selection changes back into the renderer.
editor.subscribe((state) => {
  const nextScene = state.document.scene;

  if (nextScene.mode === "2d") {
    runtime.update(nextScene);
  }

  runtime.setSelection?.(state.selection.ids, state.selection.primaryId);
});

editor.registerTool(createSelectTool({ id: "diagram.select" }));
editor.registerTool(
  createConnectorTool({
    createId: () => `edge-${Math.random().toString(36).slice(2, 8)}`,
    id: "diagram.connect",
    label: "Connect",
    layerId: "main",
    mode: "2d",
    stroke: "#94a3b8",
    strokeWidth: 2
  })
);
editor.activateTool("diagram.select");

// A built-in arrange adapter…
editor.registerLayoutAdapter(createAlignAdapter("top"));

// …and a custom one. An adapter is just a pure function from measured nodes to
// positions; everything else (commands, single-step undo) is the editor's job.
const stackAdapter: CanvasLayoutAdapter = {
  name: "custom.stack",
  kind: "layout",
  label: "Stack vertically",
  apply(input) {
    let cursorY = Math.min(...input.nodes.map((node) => node.bounds.minY));

    return {
      positions: input.nodes.map((node) => {
        const height = node.bounds.maxY - node.bounds.minY;
        const position: [number, number] = [
          node.position[0],
          node.position[1] + (cursorY - node.bounds.minY)
        ];
        cursorY += height + 16;
        return { id: node.id, position };
      })
    };
  }
};
editor.registerLayoutAdapter(stackAdapter);

// Layout needs node bounds, which only the renderer can measure.
const layoutBounds = (ids: readonly string[]) => runtime.resolveNodeBounds(ids);

if (statusOutput) {
  statusOutput.textContent = "ready";
}

moveButton?.addEventListener("click", () => {
  const nextScene: CanvasSceneInput = {
    ...scene,
    nodes: (scene.nodes ?? []).map((node) => {
      if (node.id !== "node-a" || !("position" in node) || !node.position) {
        return node;
      }
      const x = node.position[0] ?? 0;
      const y = node.position[1] ?? 0;
      return { ...node, position: [x + 24, y + 12] as [number, number] };
    })
  };
  runtime.update(nextScene);
  if (statusOutput) {
    statusOutput.textContent = "moved source — edge should follow";
  }
});

fitButton?.addEventListener("click", () => {
  const result = runtime.fitViewBounds(
    {
      minX: 60,
      minY: 30,
      maxX: 420,
      maxY: 260
    },
    48,
    true
  );
  if (statusOutput) {
    statusOutput.textContent = `fit (zoom ${result.zoom.toFixed(2)})`;
  }
});

flyButton?.addEventListener("click", () => {
  const result = runtime.flyToNode("node-a", undefined, true);
  if (statusOutput) {
    statusOutput.textContent = result ? `fly (zoom ${result.zoom.toFixed(2)})` : "not found";
  }
});

connectButton?.addEventListener("click", () => {
  editor.activateTool("diagram.connect");
  if (statusOutput) {
    statusOutput.textContent = "connect tool active — drag from a node to another";
  }
});

alignButton?.addEventListener("click", () => {
  void editor
    .applyLayout("align.top", {
      nodeIds: ["node-a", "node-b", "card-1"],
      resolveNodeBounds: layoutBounds
    })
    .then((result) => {
      if (statusOutput) {
        statusOutput.textContent = `aligned ${result.movedNodeIds.length} node(s) — one undo reverts all`;
      }
    });
});

customLayoutButton?.addEventListener("click", () => {
  void editor
    .applyLayout("custom.stack", {
      nodeIds: ["node-a", "node-b", "card-1"],
      resolveNodeBounds: layoutBounds
    })
    .then((result) => {
      if (statusOutput) {
        statusOutput.textContent = `custom adapter moved ${result.movedNodeIds.length} node(s)`;
      }
    });
});
