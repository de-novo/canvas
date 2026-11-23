import {
  createCanvas,
  createEditor,
  defineDocument,
  type Canvas2DSceneInput,
  type Canvas3DSceneInput,
  type CanvasDocument,
  type DenovoCanvasRuntime
} from "@denovo/canvas";
import "@denovo/canvas/styles.css";

const AISLES = 20;
const SLOTS_PER_AISLE = 50;
const TIERS = 5;
const AGV_COUNT = 20;

const STATUS_LIST = [
  { key: "available", label: "Available", color: "#22c55e" },
  { key: "occupied", label: "Occupied", color: "#38bdf8" },
  { key: "picking", label: "Picking", color: "#f59e0b" },
  { key: "alert", label: "Alert", color: "#ef4444" },
  { key: "empty", label: "Empty", color: "#64748b" }
] as const;

type PalletMeta = {
  readonly kind: "pallet" | "agv";
  readonly aisle: number;
  readonly slot: number;
  readonly tier: number;
  readonly sku: string;
  readonly status: string;
  readonly color: string;
};

type WarehouseState = {
  readonly mode: "2d" | "3d";
  readonly nodeCount: number;
  readonly drawCalls: number;
  readonly lastTickMs: number | null;
  readonly telemetryRunning: boolean;
  readonly selectedId: string | null;
};

declare global {
  interface Window {
    __warehouseDemo?: {
      readonly getState: () => WarehouseState;
      readonly selectNodeById: (id: string) => void;
      readonly stepTelemetry: () => void;
    };
  }
}

const initialStatuses: number[] = [];
const agvZ: number[] = [];
for (let i = 0; i < AISLES * SLOTS_PER_AISLE * TIERS; i += 1) {
  // Deterministic realistic warehouse distribution: mostly occupied/available, some picking/alert.
  const bucket = (i * 17 + Math.floor(i / 5) * 7) % 20;
  const statusIndex = bucket < 8 ? 1 : bucket < 14 ? 0 : bucket < 17 ? 2 : bucket < 19 ? 4 : 3;
  initialStatuses.push(statusIndex);
}
for (let a = 0; a < AGV_COUNT; a += 1) {
  agvZ.push((a * 3.5) % (SLOTS_PER_AISLE * 1.5));
}

function build3DDocument(): CanvasDocument {
  const nodes: NonNullable<Canvas3DSceneInput["nodes"]> = [];
  let idx = 0;
  for (let aisle = 0; aisle < AISLES; aisle += 1) {
    for (let slot = 0; slot < SLOTS_PER_AISLE; slot += 1) {
      for (let tier = 0; tier < TIERS; tier += 1) {
        const st = STATUS_LIST[initialStatuses[idx]!]!;
        const x = (aisle - AISLES / 2) * 3.8;
        const y = tier * 1.45 + 0.55;
        const z = (slot - SLOTS_PER_AISLE / 2) * 1.55;
        nodes.push({
          id: `pallet-${idx}`,
          layerId: "racks",
          type: "box",
          position: [x, y, z],
          scale: [1.15, 1.0, 1.15],
          color: st.color,
          metadata: {
            kind: "pallet",
            aisle: aisle + 1,
            slot: slot + 1,
            tier: tier + 1,
            sku: `SKU-${String(1000 + (idx % 900)).padStart(4, "0")}`,
            status: st.label
          }
        });
        idx += 1;
      }
    }
  }

  for (let a = 0; a < AGV_COUNT; a += 1) {
    const x = (a - AISLES / 2) * 3.8 + 1.9;
    const z = agvZ[a]! - (SLOTS_PER_AISLE / 2) * 1.55;
    nodes.push({
      id: `agv-${a}`,
      layerId: "agvs",
      type: "box",
      position: [x, 0.3, z],
      scale: [0.95, 0.45, 1.35],
      color: "#a855f7",
      metadata: {
        kind: "agv",
        aisle: a + 1,
        slot: Math.max(1, Math.round(agvZ[a]! / 1.55)),
        tier: 0,
        sku: `AGV-BOT-${String(a + 1).padStart(2, "0")}`,
        status: "Transit"
      }
    });
  }

  return defineDocument({
    id: "warehouse-3d",
    scene: {
      id: "warehouse-3d-scene",
      mode: "3d",
      background: "#070d1a",
      render: { batch: true, loop: "demand" },
      camera: { position: [34, 24, 52], target: [0, 3, 0], fov: 48 },
      layers: [
        { id: "racks", name: "Racks" },
        { id: "agvs", name: "AGVs" }
      ],
      nodes
    }
  });
}

function build2DDocument(): CanvasDocument {
  // 2D Floorplan: top-down view of all 20 aisles x 50 slots = 1,000 rack columns
  // (showing highest-priority status across the 5 tiers) + 20 AGVs.
  const nodes: NonNullable<Canvas2DSceneInput["nodes"]> = [];
  for (let aisle = 0; aisle < AISLES; aisle += 1) {
    nodes.push({
      id: `aisle-label-${aisle}`,
      layerId: "floor",
      type: "text",
      position: [aisle * 88 + 12, -26],
      text: `A${String(aisle + 1).padStart(2, "0")}`,
      fill: "#94a3b8",
      fontSize: 13
    });
    for (let slot = 0; slot < SLOTS_PER_AISLE; slot += 1) {
      const baseIdx = (aisle * SLOTS_PER_AISLE + slot) * TIERS;
      const st = STATUS_LIST[initialStatuses[baseIdx]!]!;
      nodes.push({
        id: `pallet-${baseIdx}`,
        layerId: "floor",
        type: "rect",
        position: [aisle * 88, slot * 34],
        size: [46, 26],
        fill: st.color,
        metadata: {
          kind: "pallet",
          aisle: aisle + 1,
          slot: slot + 1,
          tier: 1,
          sku: `SKU-${String(1000 + (baseIdx % 900)).padStart(4, "0")}`,
          status: st.label
        }
      });
    }
  }
  for (let a = 0; a < AGV_COUNT; a += 1) {
    nodes.push({
      id: `agv-${a}`,
      layerId: "agvs",
      type: "circle",
      position: [a * 88 + 64, (agvZ[a]! / 1.55) * 34],
      radius: 9,
      fill: "#a855f7",
      metadata: {
        kind: "agv",
        aisle: a + 1,
        slot: Math.max(1, Math.round(agvZ[a]! / 1.55)),
        tier: 0,
        sku: `AGV-BOT-${String(a + 1).padStart(2, "0")}`,
        status: "Transit"
      }
    });
  }
  return defineDocument({
    id: "warehouse-2d",
    scene: {
      id: "warehouse-2d-scene",
      mode: "2d",
      background: "#070d1a",
      layers: [
        { id: "floor", name: "Floorplan" },
        { id: "agvs", name: "AGVs" }
      ],
      nodes
    }
  });
}

const stageEl = document.querySelector<HTMLElement>("#stage")!;
const statNodesEl = document.querySelector<HTMLElement>("#stat-nodes")!;
const statDrawsEl = document.querySelector<HTMLElement>("#stat-draws")!;
const statModeEl = document.querySelector<HTMLElement>("#stat-mode")!;
const statTickEl = document.querySelector<HTMLElement>("#stat-tick")!;
const inspectorEl = document.querySelector<HTMLElement>("#inspector")!;
const btnMode3D = document.querySelector<HTMLButtonElement>("#btn-mode-3d")!;
const btnMode2D = document.querySelector<HTMLButtonElement>("#btn-mode-2d")!;
const btnTelemetry = document.querySelector<HTMLButtonElement>("#btn-telemetry")!;
const btnTickOnce = document.querySelector<HTMLButtonElement>("#btn-tick-once")!;
const btnOrbitTour = document.querySelector<HTMLButtonElement>("#btn-orbit-tour")!;
const btnMarkAlert = document.querySelector<HTMLButtonElement>("#btn-mark-alert")!;
const btnMarkPicking = document.querySelector<HTMLButtonElement>("#btn-mark-picking")!;
const btnMarkOk = document.querySelector<HTMLButtonElement>("#btn-mark-ok")!;

let currentMode: "2d" | "3d" = "3d";
let editor = createEditor({ document: build3DDocument() });
let runtime: DenovoCanvasRuntime | null = null;
let lastTickMs: number | null = null;
let telemetryTimer: number | null = null;
let tickCounter = 0;
let selectedId: string | null = "pallet-42";

function readMeta(id: string | null): PalletMeta | null {
  if (!id || !runtime) return null;
  const scene = runtime.getScene();
  const node = scene.nodes.find((n) => n.id === id);
  if (!node) return null;
  const m = (node.metadata ?? {}) as Record<string, unknown>;
  const color =
    "color" in node && typeof node.color === "string"
      ? node.color
      : "fill" in node && typeof node.fill === "string"
        ? node.fill
        : "#38bdf8";
  return {
    kind: m.kind === "agv" ? "agv" : "pallet",
    aisle: Number(m.aisle ?? 1),
    slot: Number(m.slot ?? 1),
    tier: Number(m.tier ?? 1),
    sku: String(m.sku ?? id),
    status: String(m.status ?? "Unknown"),
    color
  };
}

function updateStatsUi() {
  if (!runtime) return;
  const scene = runtime.getScene();
  const stats = runtime.getRenderStats();
  statNodesEl.textContent = scene.nodes.length.toLocaleString();
  statDrawsEl.textContent = String(stats?.drawCalls ?? "-");
  statModeEl.textContent = currentMode.toUpperCase();
  statTickEl.textContent = lastTickMs === null ? "-" : `${lastTickMs.toFixed(1)} ms`;

  const meta = readMeta(selectedId);
  if (!meta) {
    inspectorEl.textContent = "Click any pallet or AGV on the canvas to inspect SKU & location.";
  } else {
    inspectorEl.innerHTML = [
      `<div>ID: <strong>${selectedId}</strong></div>`,
      `<div>SKU: <strong>${meta.sku}</strong></div>`,
      `<div>Aisle ${meta.aisle} · Slot ${meta.slot} · Tier ${meta.tier}</div>`,
      `<div>Status: <span style="color:${meta.color};font-weight:700">${meta.status}</span></div>`
    ].join("");
  }
}

async function mountMode(mode: "2d" | "3d") {
  currentMode = mode;
  btnMode3D.classList.toggle("active", mode === "3d");
  btnMode2D.classList.toggle("active", mode === "2d");
  runtime?.destroy();
  const doc = mode === "3d" ? build3DDocument() : build2DDocument();
  editor = createEditor({ document: doc });
  // One-line editor mounting DX!
  runtime = createCanvas(stageEl, {
    editor,
    renderer: mode === "3d" ? { backend: "webgl2" } : { backend: "canvas2d" },
    ...(mode === "2d"
      ? {
          canvas2d: {
            initialView: { offset: [32, 48], zoom: 0.72 },
            minimap: { position: "bottom-right" },
            navigation: { enablePan: true, enableZoom: true }
          }
        }
      : {})
  });
  await runtime.ready;
  runtime.render();
  runtime.canvas.addEventListener("click", (event) => {
    if (!runtime) return;
    const rect = runtime.canvas.getBoundingClientRect();
    const hit = runtime.hitTest({
      point: [event.clientX - rect.left, event.clientY - rect.top]
    });
    if (hit.kind === "node") {
      selectedId = hit.nodeId;
      updateStatsUi();
    }
  });
  updateStatsUi();
}

function stepTelemetry() {
  if (!runtime) return;
  tickCounter += 1;
  const scene = runtime.getScene();
  const nextNodes = scene.nodes.slice();

  if (scene.mode === "3d") {
    // Flip 50 pallets' live status color + advance all 20 AGVs along aisles!
    for (let p = 0; p < 50; p += 1) {
      const idx = (tickCounter * 50 + p) % (AISLES * SLOTS_PER_AISLE * TIERS);
      const nextStatusIdx = (initialStatuses[idx]! + 1) % STATUS_LIST.length;
      initialStatuses[idx] = nextStatusIdx;
      const st = STATUS_LIST[nextStatusIdx]!;
      const prev = scene.nodes[idx];
      if (prev && prev.type === "box") {
        nextNodes[idx] = {
          ...prev,
          color: st.color,
          metadata: { ...prev.metadata, status: st.label }
        };
      }
    }
    const agvStart = AISLES * SLOTS_PER_AISLE * TIERS;
    for (let a = 0; a < AGV_COUNT; a += 1) {
      agvZ[a] = (agvZ[a]! + 1.6) % (SLOTS_PER_AISLE * 1.5);
      const prev = scene.nodes[agvStart + a];
      if (prev && prev.type === "box") {
        const z = agvZ[a]! - (SLOTS_PER_AISLE / 2) * 1.55;
        nextNodes[agvStart + a] = {
          ...prev,
          position: [prev.position[0], 0.3, z]
        };
      }
    }
  } else {
    // 2D floorplan: update 25 bin statuses + move 20 AGV dots!
    for (let p = 0; p < 25; p += 1) {
      const colIdx = (tickCounter * 25 + p) % (AISLES * SLOTS_PER_AISLE);
      const baseIdx = colIdx * TIERS;
      const nextStatusIdx = (initialStatuses[baseIdx]! + 1) % STATUS_LIST.length;
      initialStatuses[baseIdx] = nextStatusIdx;
      const st = STATUS_LIST[nextStatusIdx]!;
      const targetId = `pallet-${baseIdx}`;
      const nodeIdx = nextNodes.findIndex((n) => n.id === targetId);
      const prev = nodeIdx >= 0 ? nextNodes[nodeIdx] : undefined;
      if (prev && prev.type === "rect") {
        nextNodes[nodeIdx] = {
          ...prev,
          fill: st.color,
          metadata: { ...prev.metadata, status: st.label }
        };
      }
    }
    for (let a = 0; a < AGV_COUNT; a += 1) {
      agvZ[a] = (agvZ[a]! + 1.6) % (SLOTS_PER_AISLE * 1.5);
      const targetId = `agv-${a}`;
      const nodeIdx = nextNodes.findIndex((n) => n.id === targetId);
      const prev = nodeIdx >= 0 ? nextNodes[nodeIdx] : undefined;
      if (prev && prev.type === "circle") {
        nextNodes[nodeIdx] = {
          ...prev,
          position: [prev.position[0], (agvZ[a]! / 1.55) * 34]
        };
      }
    }
  }

  const t0 = performance.now();
  runtime.update({ ...scene, nodes: nextNodes } as typeof scene);
  lastTickMs = performance.now() - t0;
  updateStatsUi();
}

function setSelectedStatus(statusKey: "alert" | "picking" | "available") {
  if (!runtime || !selectedId) return;
  const st = STATUS_LIST.find((s) => s.key === statusKey)!;
  const scene = runtime.getScene();
  const idx = scene.nodes.findIndex((n) => n.id === selectedId);
  if (idx < 0) return;
  const prev = scene.nodes[idx]!;
  const nextNodes = scene.nodes.slice();
  if (scene.mode === "3d" && prev.type === "box") {
    nextNodes[idx] = {
      ...prev,
      color: st.color,
      metadata: { ...prev.metadata, status: st.label }
    };
  } else if (scene.mode === "2d" && prev.type === "rect") {
    nextNodes[idx] = {
      ...prev,
      fill: st.color,
      metadata: { ...prev.metadata, status: st.label }
    };
  }
  const t0 = performance.now();
  runtime.update({ ...scene, nodes: nextNodes } as typeof scene);
  lastTickMs = performance.now() - t0;
  updateStatsUi();
}

btnMode3D.addEventListener("click", () => void mountMode("3d"));
btnMode2D.addEventListener("click", () => void mountMode("2d"));
btnTickOnce.addEventListener("click", () => stepTelemetry());
btnTelemetry.addEventListener("click", () => {
  if (telemetryTimer !== null) {
    window.clearInterval(telemetryTimer);
    telemetryTimer = null;
    btnTelemetry.textContent = "Live Telemetry: OFF";
    btnTelemetry.classList.remove("active");
  } else {
    telemetryTimer = window.setInterval(stepTelemetry, 160);
    btnTelemetry.textContent = "Live Telemetry: ON";
    btnTelemetry.classList.add("active");
  }
});
btnOrbitTour.addEventListener("click", () => {
  if (!runtime || currentMode !== "3d") return;
  const current = runtime.current;
  if (current.mode !== "3d" || !("camera" in current)) return;
  let step = 0;
  const total = 40;
  const anim = () => {
    if (!runtime || currentMode !== "3d" || step >= total) return;
    const angle = (step / total) * Math.PI * 0.65 + 0.55;
    current.camera.position.set(
      Math.cos(angle) * 58,
      20 + Math.sin(angle * 2) * 5,
      Math.sin(angle) * 58
    );
    current.camera.lookAt(0, 3, 0);
    current.camera.updateProjectionMatrix();
    runtime.render();
    step += 1;
    requestAnimationFrame(anim);
  };
  requestAnimationFrame(anim);
});
btnMarkAlert.addEventListener("click", () => setSelectedStatus("alert"));
btnMarkPicking.addEventListener("click", () => setSelectedStatus("picking"));
btnMarkOk.addEventListener("click", () => setSelectedStatus("available"));

window.__warehouseDemo = {
  getState: () => ({
    mode: currentMode,
    nodeCount: runtime?.getScene().nodes.length ?? 0,
    drawCalls: runtime?.getRenderStats()?.drawCalls ?? 0,
    lastTickMs,
    telemetryRunning: telemetryTimer !== null,
    selectedId
  }),
  selectNodeById: (id) => {
    selectedId = id;
    updateStatsUi();
  },
  stepTelemetry
};

void mountMode("3d");
