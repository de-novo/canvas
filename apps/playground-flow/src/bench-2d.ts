import {
  alignNodes,
  connectEditorToCanvas,
  createCanvas,
  createEditor,
  defineDocument,
  distributeNodes,
  type Canvas2DSceneInput,
  type CanvasDocument,
  type DenovoCanvas2DRuntime
} from "@de-novo/canvas/2d";
import "@de-novo/canvas/styles.css";

type BenchTelemetry = {
  readonly nodeCount: number;
  readonly drawCalls: number;
  readonly lastSyncKind: string;
  readonly lastSyncedNodeCount: number;
  readonly lastPanP50Ms: number | null;
  readonly lastSnapCandidates: number | null;
  readonly lastSnapMs: number | null;
  readonly activeGuideCount: number;
  readonly undoDepth: number;
};

declare global {
  interface Window {
    __bench2d?: {
      readonly getTelemetry: () => BenchTelemetry;
    };
  }
}

function buildGridDocument(count: number): CanvasDocument {
  const cols = Math.ceil(Math.sqrt(count));
  const pitch = 180;
  const nodes: NonNullable<Canvas2DSceneInput["nodes"]> = [];
  for (let i = 0; i < count; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const pos: [number, number] =
      i === 1 ? [165, 34] : i === 2 ? [380, 14] : [col * pitch, row * pitch];
    nodes.push({
      id: `rect-${i}`,
      layerId: "default",
      type: "rect",
      position: pos,
      size: [120, 80],
      fill: i < 3 ? "#f59e0b" : i % 2 === 0 ? "#22c55e" : "#38bdf8"
    });
  }
  return defineDocument({
    id: `bench-2d-${count}`,
    scene: {
      id: "bench-2d-scene",
      mode: "2d",
      background: "#0b1220",
      layers: [{ id: "default", name: "Default" }],
      nodes
    }
  });
}

const stageEl = document.querySelector<HTMLElement>("#stage");
const hudEl = document.querySelector<HTMLElement>("#hud");
const countSelect = document.querySelector<HTMLSelectElement>("#node-count");
const btnPanBurst = document.querySelector<HTMLButtonElement>("#btn-pan-burst");
const btnMoveOne = document.querySelector<HTMLButtonElement>("#btn-move-one");
const btnSnap = document.querySelector<HTMLButtonElement>("#btn-snap");
const btnAlign = document.querySelector<HTMLButtonElement>("#btn-align");
const btnUndo = document.querySelector<HTMLButtonElement>("#btn-undo");

if (
  !stageEl ||
  !hudEl ||
  !countSelect ||
  !btnPanBurst ||
  !btnMoveOne ||
  !btnSnap ||
  !btnAlign ||
  !btnUndo
) {
  throw new Error("Missing benchmark DOM elements.");
}

let activeRuntime: DenovoCanvas2DRuntime | null = null;
let activeDisconnect: (() => void) | null = null;
let activeEditor = createEditor({ document: buildGridDocument(10_000) });
let lastPanP50Ms: number | null = null;
let lastSnapCandidates: number | null = null;
let lastSnapMs: number | null = null;
let activeGuideCount = 0;
let moveCounter = 0;

function getTelemetry(): BenchTelemetry {
  const stats = activeRuntime?.getRenderStats();
  const spatial = activeRuntime?.current.getSpatialIndexStats();
  return {
    nodeCount: activeEditor.getState().document.scene.nodes.length,
    drawCalls: stats?.drawCalls ?? 0,
    lastSyncKind: spatial?.lastSyncKind ?? "full",
    lastSyncedNodeCount: spatial?.lastSyncedNodeCount ?? 0,
    lastPanP50Ms,
    lastSnapCandidates,
    lastSnapMs,
    activeGuideCount,
    undoDepth: activeEditor.getState().history.undoDepth
  };
}

function renderHud() {
  const t = getTelemetry();
  hudEl!.innerHTML = [
    `<div><strong>Nodes</strong>: ${t.nodeCount.toLocaleString()}</div>`,
    `<div><strong>Culled drawCalls</strong>: <span class="ok">${t.drawCalls}</span></div>`,
    `<div><strong>Spatial Sync</strong>: <span class="ok">${t.lastSyncKind}</span> (updated=${t.lastSyncedNodeCount})</div>`,
    `<div><strong>Pan 30-frame p50</strong>: ${t.lastPanP50Ms === null ? "click Pan Burst" : `<span class="ok">${t.lastPanP50Ms.toFixed(2)} ms</span>`}</div>`,
    `<div><strong>Smart Snap</strong>: ${t.lastSnapCandidates === null ? "click Smart Snap" : `<span class="ok">${t.lastSnapCandidates}/${t.nodeCount}</span> (${t.lastSnapMs?.toFixed(2)} ms, guides=${t.activeGuideCount})`}</div>`,
    `<div><strong>Undo Depth</strong>: ${t.undoDepth}</div>`
  ].join("");
}

async function mountBenchmark(count: number) {
  activeDisconnect?.();
  activeRuntime?.destroy();
  lastPanP50Ms = null;
  lastSnapCandidates = null;
  lastSnapMs = null;
  activeGuideCount = 0;
  moveCounter = 0;

  const doc = buildGridDocument(count);
  activeEditor = createEditor({ document: doc });
  const runtime = createCanvas(stageEl!, {
    document: doc,
    editable: true,
    renderer: { backend: "canvas2d" },
    canvas2d: {
      initialView: { offset: [60, 60], zoom: 1 },
      minimap: { position: "bottom-right" },
      navigation: { enablePan: true, enableZoom: true }
    }
  });
  activeRuntime = runtime;
  await runtime.ready;
  activeDisconnect = connectEditorToCanvas(activeEditor, runtime);
  activeEditor.subscribe(() => renderHud());
  renderHud();
}

btnPanBurst.addEventListener("click", () => {
  if (!activeRuntime) return;
  const samples: number[] = [];
  for (let i = 0; i < 30; i += 1) {
    const t0 = performance.now();
    activeRuntime.current.setViewState({
      offset: [-120 - i * 32, -80 - i * 24],
      zoom: 1
    });
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  lastPanP50Ms = samples[Math.floor(samples.length * 0.5)] ?? 0;
  renderHud();
});

btnMoveOne.addEventListener("click", () => {
  if (!activeRuntime) return;
  moveCounter += 1;
  const scene = activeEditor.getState().document.scene;
  if (scene.mode !== "2d") return;
  const nextNodes = scene.nodes.map((node, index) =>
    index === 0 && node.type === "rect"
      ? { ...node, position: [40 + (moveCounter % 5) * 28, 30 + (moveCounter % 4) * 18] as [number, number] }
      : node
  );
  activeRuntime.update({
    ...scene,
    nodes: nextNodes
  });
  renderHud();
});

btnSnap.addEventListener("click", () => {
  if (!activeRuntime) return;
  activeRuntime.current.setViewState({ offset: [60, 60], zoom: 1 });
  const t0 = performance.now();
  const snap = activeRuntime.current.computeSnapGuides(
    { minX: 183, minY: 184, maxX: 303, maxY: 264 },
    { excludeNodeIds: ["rect-1"], threshold: 6 }
  );
  lastSnapMs = performance.now() - t0;
  lastSnapCandidates = snap.candidateCount;
  activeGuideCount = snap.guides.length;
  activeRuntime.current.setSnapGuides(snap.guides);
  activeRuntime.render();
  renderHud();
});

btnAlign.addEventListener("click", async () => {
  if (!activeRuntime) return;
  activeRuntime.current.setViewState({ offset: [60, 60], zoom: 1 });
  await activeEditor.apply([
    alignNodes({ nodeIds: ["rect-0", "rect-1", "rect-2"], alignment: "middle" }),
    distributeNodes({ nodeIds: ["rect-0", "rect-1", "rect-2"], axis: "horizontal" })
  ]);
  renderHud();
});

btnUndo.addEventListener("click", async () => {
  await activeEditor.undo();
  renderHud();
});

countSelect.addEventListener("change", () => {
  void mountBenchmark(Number(countSelect.value));
});

window.__bench2d = { getTelemetry };
void mountBenchmark(Number(countSelect.value));
