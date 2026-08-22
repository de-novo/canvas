import { createCanvas2D } from "@denovo/canvas-web";
import { createEditor, defineDocument, type CanvasSceneInput } from "@denovo/canvas";
import {
  createRelationGraphLayoutAdapter,
  createTimeGraphLayoutAdapter
} from "@denovo/canvas-editor";
import "@denovo/canvas/styles.css";
import { createPointFieldBench } from "./field-bench";
import "./styles.css";

const requested = Number(new URLSearchParams(window.location.search).get("points") ?? "");
const pointCount = Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : 0;

const stage = document.getElementById("stage");
if (!stage) {
  throw new Error("Element #stage not found");
}
const statusOutput = document.getElementById("status");

if (pointCount > 0) {
  startPointField(stage, pointCount, statusOutput);
} else {
  startCircleGraph(stage, statusOutput);
}

function startPointField(
  host: HTMLElement,
  count: number,
  status: HTMLElement | null
): void {
  const scene: CanvasSceneInput = {
    id: "point-field",
    mode: "2d",
    layers: [{ id: "main", name: "Main" }],
    nodes: []
  };
  const runtime = createCanvas2D(host, scene, {
    canvas2d: {
      navigation: { enablePan: true, enableZoom: true },
      initialView: { offset: [0, 0], zoom: 1 }
    }
  });
  const overlay = document.createElement("canvas");
  overlay.className = "point-field-overlay";
  overlay.setAttribute("aria-hidden", "true");
  host.append(overlay);
  const bench = createPointFieldBench(runtime, overlay, count);
  const paint = () => {
    bench.redraw();
    const report = bench.getReport();
    const samples = report.drawMs;
    const latest = samples[samples.length - 1] ?? 0;
    const min = samples.length === 0 ? 0 : Math.min(...samples);
    if (status) {
      status.textContent = `${report.count} points · last ${latest.toFixed(2)}ms · min ${min.toFixed(2)}ms · drawn ${report.lastDrawnPoints}`;
    }
    (
      window as unknown as { __pointFieldPerf?: unknown }
    ).__pointFieldPerf = {
      count: report.count,
      drawMsMin: min,
      drawnPoints: report.lastDrawnPoints,
      drawnEdges: report.lastDrawnEdges,
      minScreenPx: report.minScreenPx
    };
  };
  host.addEventListener("pointerup", paint);
  host.addEventListener("wheel", paint, { passive: true });
  document.getElementById("layout-time")?.addEventListener("click", () => {
    bench.applyTime();
    paint();
  });
  document.getElementById("layout-relation")?.addEventListener("click", () => {
    bench.applyRelation();
    paint();
  });
  document.getElementById("fit")?.addEventListener("click", () => {
    bench.fit();
    paint();
  });
  bench.applyTime();
  paint();
}

function startCircleGraph(host: HTMLElement, status: HTMLElement | null): void {
  const day = 24 * 60 * 60 * 1000;
  const t0 = Date.UTC(2026, 7, 1);
  const tickets = [
    { id: "alpha", fill: "#38bdf8", at: t0, links: ["beta"] },
    { id: "beta", fill: "#38bdf8", at: t0 + 2 * day, links: ["gamma"] },
    { id: "gamma", fill: "#38bdf8", at: t0 + 5 * day, links: [] },
    { id: "delta", fill: "#f97316", at: t0 + 1 * day, links: ["epsilon"] },
    { id: "epsilon", fill: "#f97316", at: t0 + 4 * day, links: ["zeta"] },
    { id: "zeta", fill: "#f97316", at: t0 + 8 * day, links: [] },
    { id: "eta", fill: "#a78bfa", at: t0 + 3 * day, links: ["theta"] },
    { id: "theta", fill: "#a78bfa", at: t0 + 6 * day, links: [] },
    { id: "iota", fill: "#94a3b8", at: undefined, links: [] },
    { id: "kappa", fill: "#94a3b8", at: undefined, links: [] }
  ] as const;
  const at: Record<string, number> = Object.fromEntries(
    tickets.flatMap((ticket) => (ticket.at === undefined ? [] : [[ticket.id, ticket.at]]))
  );
  const scene: CanvasSceneInput = {
    id: "graph-field",
    mode: "2d",
    layers: [{ id: "main", name: "Main" }],
    nodes: [
      ...tickets.map((ticket, index) => ({
        id: ticket.id,
        layerId: "main",
        type: "circle" as const,
        fill: ticket.fill,
        position: [80 + (index % 5) * 72, 80 + Math.floor(index / 5) * 72] as [
          number,
          number
        ],
        radius: 10
      })),
      ...tickets.flatMap((ticket) =>
        ticket.links.map((targetId) => ({
          id: `edge-${ticket.id}-${targetId}`,
          layerId: "main",
          type: "edge" as const,
          sourceId: ticket.id,
          targetId,
          stroke: "rgba(148, 163, 184, 0.28)",
          strokeWidth: 1
        }))
      )
    ]
  };
  const runtime = createCanvas2D(host, scene, {
    canvas2d: {
      navigation: { enablePan: true, enableZoom: true },
      initialView: { offset: [0, 0], zoom: 1 }
    }
  });
  const editor = createEditor({
    document: defineDocument({ id: "graph-field-doc", scene })
  });
  editor.registerLayoutAdapter(createTimeGraphLayoutAdapter());
  editor.registerLayoutAdapter(createRelationGraphLayoutAdapter());
  editor.subscribe((state) => {
    const nextScene = state.document.scene;
    if (nextScene.mode === "2d") {
      runtime.update(nextScene);
    }
  });
  (window as unknown as { __denovoRuntime?: unknown }).__denovoRuntime = runtime;
  (window as unknown as { __denovoEditor?: unknown }).__denovoEditor = editor;
  const layoutBounds = (ids: readonly string[]) => runtime.resolveNodeBounds(ids);
  function fitField(): void {
    const bounds = runtime.resolveNodeBounds(tickets.map((ticket) => ticket.id));
    const boxes = [...bounds.values()];
    if (boxes.length === 0) {
      return;
    }
    const extent = boxes.reduce((union, box) => ({
      minX: Math.min(union.minX, box.minX),
      minY: Math.min(union.minY, box.minY),
      maxX: Math.max(union.maxX, box.maxX),
      maxY: Math.max(union.maxY, box.maxY)
    }));
    runtime.fitViewBounds(extent, 64, true);
  }
  async function applyNamedLayout(
    name: "layout.time-graph" | "layout.relation-graph"
  ): Promise<void> {
    const result = await editor.applyLayout(name, {
      resolveNodeBounds: layoutBounds,
      options:
        name === "layout.time-graph"
          ? { at, origin: [80, 160], columnGap: 88, laneGap: 40 }
          : { origin: [80, 160], layerGap: 88, laneGap: 48, componentGap: 140 }
    });
    fitField();
    if (status) {
      status.textContent = `${name} moved ${result.movedNodeIds.length}`;
    }
  }
  document.getElementById("layout-time")?.addEventListener("click", () => {
    void applyNamedLayout("layout.time-graph");
  });
  document.getElementById("layout-relation")?.addEventListener("click", () => {
    void applyNamedLayout("layout.relation-graph");
  });
  document.getElementById("fit")?.addEventListener("click", () => {
    fitField();
    if (status) {
      status.textContent = "fit";
    }
  });
  void applyNamedLayout("layout.time-graph");
}
