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

// Realistic Industrial Fulfillment Center Layout:
// 6 wide AGV corridors flanked by 12 steel pallet-rack rows (paired back-to-back),
// 14 bays per row x 2 pallet positions per bay x 4 tiers, with blue steel upright
// frames, orange horizontal load beams, yellow bumper guards, wooden pallet bases,
// shrink-wrapped status-colored cargo boxes, loading docks, and 12 moving AGVs.
const CORRIDORS = 6;
const BAYS_PER_ROW = 14;
const TIERS = 4;
const BAY_LENGTH = 2.6;
const RACK_DEPTH = 1.2;
const TIER_HEIGHT = 1.65;
const RACK_HEIGHT = TIERS * TIER_HEIGHT + 0.35;
const PAIR_GAP = 0.28;
const AISLE_WIDTH = 3.2;
const CORRIDOR_PITCH = RACK_DEPTH * 2 + PAIR_GAP + AISLE_WIDTH; // 5.88m
const TOTAL_Z = BAYS_PER_ROW * BAY_LENGTH; // 36.4m
const AGV_COUNT = 12;

const STATUS_LIST = [
  { key: "available", label: "Available", color: "#22c55e" },
  { key: "occupied", label: "Occupied", color: "#38bdf8" },
  { key: "picking", label: "Picking", color: "#f59e0b" },
  { key: "alert", label: "Alert", color: "#ef4444" }
] as const;

type PalletSlot = {
  readonly id: string;
  readonly row: number;
  readonly bay: number;
  readonly posInBay: number;
  readonly tier: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly cargoHeight: number;
  readonly sku: string;
  statusIndex: number;
};

type AgvUnit = {
  readonly id: string;
  readonly corridor: number;
  readonly x: number;
  readonly direction: 1 | -1;
  z: number;
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

// Compute X centers for the 12 rack rows (paired back-to-back between 6 AGV aisles)
const rowCentersX: number[] = [];
const aisleCentersX: number[] = [];
const totalWidth = CORRIDORS * CORRIDOR_PITCH;
const startX = -totalWidth / 2 + CORRIDOR_PITCH / 2;

for (let c = 0; c < CORRIDORS; c += 1) {
  const aisleX = startX + c * CORRIDOR_PITCH;
  aisleCentersX.push(aisleX);
  const leftRackX = aisleX - AISLE_WIDTH / 2 - RACK_DEPTH / 2;
  const rightRackX = aisleX + AISLE_WIDTH / 2 + RACK_DEPTH / 2;
  rowCentersX.push(leftRackX, rightRackX);
}

// Deterministic realistic inventory occupancy (~78% occupied so steel racks show through!)
const palletSlots: PalletSlot[] = [];
let slotSeq = 0;
for (let row = 0; row < rowCentersX.length; row += 1) {
  const rx = rowCentersX[row]!;
  for (let bay = 0; bay < BAYS_PER_ROW; bay += 1) {
    const bayZ0 = -TOTAL_Z / 2 + bay * BAY_LENGTH;
    for (let pos = 0; pos < 2; pos += 1) {
      const pz = bayZ0 + (pos === 0 ? BAY_LENGTH * 0.27 : BAY_LENGTH * 0.73);
      for (let tier = 0; tier < TIERS; tier += 1) {
        const hash = (row * 131 + bay * 37 + pos * 17 + tier * 53) % 23;
        // Leave ~22% empty slots so the orange beams and blue steel uprights shine through!
        if (hash < 5) {
          continue;
        }
        const statusIndex =
          hash < 13 ? 1 : hash < 19 ? 0 : hash < 22 ? 2 : 3;
        const cargoHeight = 0.72 + ((hash % 4) * 0.11);
        const beamTopY = tier === 0 ? 0.08 : tier * TIER_HEIGHT + 0.08;
        palletSlots.push({
          id: `pallet-${slotSeq}`,
          row: row + 1,
          bay: bay + 1,
          posInBay: pos + 1,
          tier: tier + 1,
          x: rx,
          y: beamTopY,
          z: pz,
          cargoHeight,
          sku: `SKU-${String(1000 + (slotSeq % 899)).padStart(4, "0")}`,
          statusIndex
        });
        slotSeq += 1;
      }
    }
  }
}

const agvFleet: AgvUnit[] = [];
for (let a = 0; a < AGV_COUNT; a += 1) {
  const corridor = a % CORRIDORS;
  const isSecond = a >= CORRIDORS;
  agvFleet.push({
    id: `agv-${a}`,
    corridor,
    x: aisleCentersX[corridor]! + (isSecond ? 0.65 : -0.65),
    direction: isSecond ? -1 : 1,
    z: -TOTAL_Z / 2 + ((a * 5.7) % TOTAL_Z)
  });
}

// Track exact node indices in the 3D scene for O(1) live telemetry updates
const pallet3DNodeIndex = new Map<string, number>();
const agv3DChassisIndex = new Map<string, number>();
const agv3DDeckIndex = new Map<string, number>();
const agv3DBeaconIndex = new Map<string, number>();

function build3DDocument(): CanvasDocument {
  const nodes: NonNullable<Canvas3DSceneInput["nodes"]> = [];
  pallet3DNodeIndex.clear();
  agv3DChassisIndex.clear();
  agv3DDeckIndex.clear();
  agv3DBeaconIndex.clear();

  // 1. Concrete warehouse slab & inbound/outbound loading dock apron
  const floorW = totalWidth + 8;
  const floorZ = TOTAL_Z + 12;
  nodes.push({
    id: "warehouse-floor",
    layerId: "structure",
    type: "box",
    position: [0, -0.1, 0],
    scale: [floorW, 0.2, floorZ],
    color: "#111827"
  });
  // Loading dock apron at front (+Z) and rear (-Z)
  nodes.push({
    id: "dock-apron-front",
    layerId: "structure",
    type: "box",
    position: [0, 0.015, TOTAL_Z / 2 + 3.2],
    scale: [floorW - 2, 0.03, 4.4],
    color: "#1e293b"
  });
  nodes.push({
    id: "dock-apron-back",
    layerId: "structure",
    type: "box",
    position: [0, 0.015, -TOTAL_Z / 2 - 3.2],
    scale: [floorW - 2, 0.03, 4.4],
    color: "#1e293b"
  });
  // Dock gate bumpers (safety orange)
  for (let d = 0; d < CORRIDORS; d += 1) {
    const ax = aisleCentersX[d]!;
    nodes.push({
      id: `dock-bay-${d}`,
      layerId: "structure",
      type: "box",
      position: [ax, 0.03, TOTAL_Z / 2 + 5.2],
      scale: [2.4, 0.06, 0.4],
      color: "#f97316"
    });
  }

  // 2. Painted yellow safety lane lines along each AGV corridor
  for (let c = 0; c < CORRIDORS; c += 1) {
    const ax = aisleCentersX[c]!;
    for (const side of [-1, 1]) {
      nodes.push({
        id: `lane-${c}-${side > 0 ? "r" : "l"}`,
        layerId: "structure",
        type: "box",
        position: [ax + side * (AISLE_WIDTH / 2 - 0.2), 0.02, 0],
        scale: [0.09, 0.02, TOTAL_Z + 1.2],
        color: "#eab308"
      });
    }
    // Subtle center AGV guide strip
    nodes.push({
      id: `agv-track-${c}`,
      layerId: "structure",
      type: "box",
      position: [ax, 0.018, 0],
      scale: [0.05, 0.015, TOTAL_Z + 4.4],
      color: "#334155"
    });
  }

  // 3. Industrial Steel Pallet Racks:
  //    - Blue vertical upright columns (#1d4ed8) at every bay divider (front & back)
  //    - Horizontal steel side ties connecting front/back uprights
  //    - Safety-orange horizontal load beams (#f97316) running along every rack tier!
  //    - Yellow corner safety bollards (#facc15) at aisle ends
  for (let row = 0; row < rowCentersX.length; row += 1) {
    const rx = rowCentersX[row]!;
    const frontX = rx - RACK_DEPTH / 2 + 0.06;
    const backX = rx + RACK_DEPTH / 2 - 0.06;

    // Upright posts + cross-bracing frames at each bay boundary (BAYS_PER_ROW + 1 frames)
    for (let b = 0; b <= BAYS_PER_ROW; b += 1) {
      const z = -TOTAL_Z / 2 + b * BAY_LENGTH;
      nodes.push({
        id: `upright-${row}-${b}-f`,
        layerId: "structure",
        type: "box",
        position: [frontX, RACK_HEIGHT / 2, z],
        scale: [0.1, RACK_HEIGHT, 0.1],
        color: "#1d4ed8"
      });
      nodes.push({
        id: `upright-${row}-${b}-b`,
        layerId: "structure",
        type: "box",
        position: [backX, RACK_HEIGHT / 2, z],
        scale: [0.1, RACK_HEIGHT, 0.1],
        color: "#1d4ed8"
      });
      // Depth tie bars across the upright frame on levels 1..TIERS
      for (let t = 1; t <= TIERS; t += 1) {
        nodes.push({
          id: `tie-${row}-${b}-${t}`,
          layerId: "structure",
          type: "box",
          position: [rx, t * TIER_HEIGHT - 0.3, z],
          scale: [RACK_DEPTH - 0.08, 0.06, 0.06],
          color: "#2563eb"
        });
      }
      // Yellow floor-mounted rack end protectors at aisle entrances
      if (b === 0 || b === BAYS_PER_ROW) {
        nodes.push({
          id: `guard-${row}-${b}`,
          layerId: "structure",
          type: "box",
          position: [rx, 0.28, z + (b === 0 ? -0.18 : 0.18)],
          scale: [RACK_DEPTH + 0.14, 0.56, 0.14],
          color: "#facc15"
        });
      }
    }

    // Continuous safety-orange load beams (front & back rail per elevated tier)
    for (let t = 1; t < TIERS; t += 1) {
      const beamY = t * TIER_HEIGHT;
      nodes.push({
        id: `beam-${row}-${t}-f`,
        layerId: "structure",
        type: "box",
        position: [frontX, beamY, 0],
        scale: [0.09, 0.13, TOTAL_Z + 0.1],
        color: "#f97316"
      });
      nodes.push({
        id: `beam-${row}-${t}-b`,
        layerId: "structure",
        type: "box",
        position: [backX, beamY, 0],
        scale: [0.09, 0.13, TOTAL_Z + 0.1],
        color: "#f97316"
      });
    }
    // Top cap rail
    nodes.push({
      id: `beam-${row}-top-f`,
      layerId: "structure",
      type: "box",
      position: [frontX, RACK_HEIGHT - 0.06, 0],
      scale: [0.08, 0.09, TOTAL_Z + 0.1],
      color: "#1e40af"
    });
    nodes.push({
      id: `beam-${row}-top-b`,
      layerId: "structure",
      type: "box",
      position: [backX, RACK_HEIGHT - 0.06, 0],
      scale: [0.08, 0.09, TOTAL_Z + 0.1],
      color: "#1e40af"
    });
  }

  // 4. Wooden Pallet Bases + Status-Colored Cargo Cartons
  for (let i = 0; i < palletSlots.length; i += 1) {
    const slot = palletSlots[i]!;
    const st = STATUS_LIST[slot.statusIndex]!;
    // Wooden EUR pallet sitting directly on floor/orange beam
    nodes.push({
      id: `wood-${slot.id}`,
      layerId: "racks",
      type: "box",
      position: [slot.x, slot.y + 0.06, slot.z],
      scale: [1.08, 0.12, 1.04],
      color: "#b45309"
    });
    // Cargo box stacked on top of the wooden pallet (clickable + live status colored!)
    pallet3DNodeIndex.set(slot.id, nodes.length);
    nodes.push({
      id: slot.id,
      layerId: "racks",
      type: "box",
      position: [slot.x, slot.y + 0.12 + slot.cargoHeight / 2, slot.z],
      scale: [0.96, slot.cargoHeight, 0.94],
      color: st.color,
      metadata: {
        kind: "pallet",
        row: slot.row,
        bay: slot.bay,
        tier: slot.tier,
        sku: slot.sku,
        status: st.label
      }
    });
  }

  // 5. Detailed Autonomous Mobile Robots (AGVs):
  //    dark chassis + glowing purple deck + cyan safety beacon sphere
  for (let a = 0; a < agvFleet.length; a += 1) {
    const agv = agvFleet[a]!;
    agv3DChassisIndex.set(agv.id, nodes.length);
    nodes.push({
      id: agv.id,
      layerId: "agvs",
      type: "box",
      position: [agv.x, 0.22, agv.z],
      scale: [0.95, 0.36, 1.45],
      color: "#334155",
      metadata: {
        kind: "agv",
        row: agv.corridor + 1,
        bay: Math.max(1, Math.round((agv.z + TOTAL_Z / 2) / BAY_LENGTH)),
        tier: 0,
        sku: `AGV-BOT-${String(a + 1).padStart(2, "0")}`,
        status: "In Transit"
      }
    });
    agv3DDeckIndex.set(agv.id, nodes.length);
    nodes.push({
      id: `${agv.id}-deck`,
      layerId: "agvs",
      type: "box",
      position: [agv.x, 0.45, agv.z],
      scale: [0.84, 0.12, 1.24],
      color: "#a855f7"
    });
    agv3DBeaconIndex.set(agv.id, nodes.length);
    nodes.push({
      id: `${agv.id}-beacon`,
      layerId: "agvs",
      type: "sphere",
      position: [agv.x, 0.62, agv.z + agv.direction * 0.42],
      radius: 0.13,
      color: "#22d3ee"
    });
  }

  return defineDocument({
    id: "warehouse-3d-industrial",
    scene: {
      id: "warehouse-3d-scene",
      mode: "3d",
      background: "#090e1a",
      render: { batch: true, loop: "demand" },
      camera: { position: [23, 13.5, 29], target: [0, 3.2, -1], fov: 44 },
      layers: [
        { id: "structure", name: "Racking & Floor" },
        { id: "racks", name: "Pallets & Cargo" },
        { id: "agvs", name: "AGV Fleet" }
      ],
      nodes
    }
  });
}

function build2DDocument(): CanvasDocument {
  const nodes: NonNullable<Canvas2DSceneInput["nodes"]> = [];
  const scaleX = 24;
  const scaleZ = 24;
  const padX = (totalWidth / 2) * scaleX + 90;
  const padY = (TOTAL_Z / 2) * scaleZ + 90;

  // Floor slab + loading zones
  nodes.push({
    id: "floor-bg",
    layerId: "floor",
    type: "rect",
    position: [20, 20],
    size: [totalWidth * scaleX + 140, TOTAL_Z * scaleZ + 140],
    fill: "#0f172a"
  });
  nodes.push({
    id: "dock-label-top",
    layerId: "floor",
    type: "text",
    position: [padX - 110, 36],
    text: "INBOUND / OUTBOUND DOCK ZONE",
    fill: "#f97316",
    fontSize: 13
  });

  // Aisle lanes & labels
  for (let c = 0; c < CORRIDORS; c += 1) {
    const cx = padX + aisleCentersX[c]! * scaleX;
    nodes.push({
      id: `aisle-2d-${c}`,
      layerId: "floor",
      type: "rect",
      position: [cx - (AISLE_WIDTH * scaleX) / 2 + 4, padY - (TOTAL_Z * scaleZ) / 2],
      size: [AISLE_WIDTH * scaleX - 8, TOTAL_Z * scaleZ],
      fill: "#172033"
    });
    nodes.push({
      id: `aisle-label-${c}`,
      layerId: "floor",
      type: "text",
      position: [cx - 18, padY - (TOTAL_Z * scaleZ) / 2 - 22],
      text: `AISLE ${c + 1}`,
      fill: "#eab308",
      fontSize: 11
    });
  }

  // Rack bays (top-down highest-tier slot per bay position)
  const seenColumn = new Set<string>();
  for (let i = palletSlots.length - 1; i >= 0; i -= 1) {
    const slot = palletSlots[i]!;
    const colKey = `${slot.row}:${slot.bay}:${slot.posInBay}`;
    if (seenColumn.has(colKey)) continue;
    seenColumn.add(colKey);
    const st = STATUS_LIST[slot.statusIndex]!;
    nodes.push({
      id: slot.id,
      layerId: "floor",
      type: "rect",
      position: [
        padX + slot.x * scaleX - 11,
        padY + slot.z * scaleZ - 11
      ],
      size: [22, 22],
      fill: st.color,
      metadata: {
        kind: "pallet",
        row: slot.row,
        bay: slot.bay,
        tier: slot.tier,
        sku: slot.sku,
        status: st.label
      }
    });
  }

  // AGV bots
  for (let a = 0; a < agvFleet.length; a += 1) {
    const agv = agvFleet[a]!;
    nodes.push({
      id: agv.id,
      layerId: "agvs",
      type: "circle",
      position: [padX + agv.x * scaleX, padY + agv.z * scaleZ],
      radius: 9,
      fill: "#a855f7",
      metadata: {
        kind: "agv",
        row: agv.corridor + 1,
        bay: Math.max(1, Math.round((agv.z + TOTAL_Z / 2) / BAY_LENGTH)),
        tier: 0,
        sku: `AGV-BOT-${String(a + 1).padStart(2, "0")}`,
        status: "In Transit"
      }
    });
  }

  return defineDocument({
    id: "warehouse-2d-industrial",
    scene: {
      id: "warehouse-2d-scene",
      mode: "2d",
      background: "#090e1a",
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
let selectedId: string | null = palletSlots[12]?.id ?? null;

function updateStatsUi() {
  if (!runtime) return;
  const scene = runtime.getScene();
  const stats = runtime.getRenderStats();
  statNodesEl.textContent = scene.nodes.length.toLocaleString();
  statDrawsEl.textContent = String(stats?.drawCalls ?? "-");
  statModeEl.textContent = currentMode.toUpperCase();
  statTickEl.textContent = lastTickMs === null ? "-" : `${lastTickMs.toFixed(1)} ms`;

  const node = selectedId ? scene.nodes.find((n) => n.id === selectedId) : null;
  if (!node || !node.metadata) {
    inspectorEl.textContent = "Click any cargo box or AGV on the canvas to inspect SKU & rack bay.";
    return;
  }
  const m = node.metadata as Record<string, unknown>;
  const color =
    "color" in node && typeof node.color === "string"
      ? node.color
      : "fill" in node && typeof node.fill === "string"
        ? node.fill
        : "#38bdf8";
  inspectorEl.innerHTML = [
    `<div>ID: <strong>${node.id}</strong></div>`,
    `<div>SKU: <strong>${String(m.sku ?? node.id)}</strong></div>`,
    `<div>Rack Row ${String(m.row ?? 1)} · Bay ${String(m.bay ?? 1)} · Tier ${String(m.tier ?? 1)}</div>`,
    `<div>Status: <span style="color:${color};font-weight:700">${String(m.status ?? "Active")}</span></div>`
  ].join("");
}

async function mountMode(mode: "2d" | "3d") {
  currentMode = mode;
  btnMode3D.classList.toggle("active", mode === "3d");
  btnMode2D.classList.toggle("active", mode === "2d");
  runtime?.destroy();
  const doc = mode === "3d" ? build3DDocument() : build2DDocument();
  editor = createEditor({ document: doc });
  runtime = createCanvas(stageEl, {
    editor,
    renderer: mode === "3d" ? { backend: "webgl2" } : { backend: "canvas2d" },
    ...(mode === "2d"
      ? {
          canvas2d: {
            initialView: { offset: [24, 16], zoom: 0.72 },
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
    if (hit.kind === "node" && (hit.nodeId.startsWith("pallet-") || hit.nodeId.startsWith("agv-"))) {
      selectedId = hit.nodeId.replace(/-(deck|beacon)$/, "");
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
    // Flip 30 pallets' live status color + advance all 12 multi-part AGVs along aisles
    for (let p = 0; p < 30; p += 1) {
      const slot = palletSlots[(tickCounter * 30 + p) % palletSlots.length]!;
      slot.statusIndex = (slot.statusIndex + 1) % STATUS_LIST.length;
      const st = STATUS_LIST[slot.statusIndex]!;
      const nodeIdx = pallet3DNodeIndex.get(slot.id);
      const prev = nodeIdx !== undefined ? scene.nodes[nodeIdx] : undefined;
      if (nodeIdx !== undefined && prev && prev.type === "box") {
        nextNodes[nodeIdx] = {
          ...prev,
          color: st.color,
          metadata: { ...prev.metadata, status: st.label }
        };
      }
    }
    for (let a = 0; a < agvFleet.length; a += 1) {
      const agv = agvFleet[a]!;
      agv.z += agv.direction * 0.9;
      if (agv.z > TOTAL_Z / 2 + 1.5) agv.z = -TOTAL_Z / 2 - 1.5;
      if (agv.z < -TOTAL_Z / 2 - 1.5) agv.z = TOTAL_Z / 2 + 1.5;

      const cIdx = agv3DChassisIndex.get(agv.id)!;
      const dIdx = agv3DDeckIndex.get(agv.id)!;
      const bIdx = agv3DBeaconIndex.get(agv.id)!;
      const prevC = scene.nodes[cIdx];
      const prevD = scene.nodes[dIdx];
      const prevB = scene.nodes[bIdx];
      if (prevC && prevC.type === "box") {
        nextNodes[cIdx] = { ...prevC, position: [agv.x, 0.22, agv.z] };
      }
      if (prevD && prevD.type === "box") {
        nextNodes[dIdx] = { ...prevD, position: [agv.x, 0.45, agv.z] };
      }
      if (prevB && prevB.type === "sphere") {
        nextNodes[bIdx] = {
          ...prevB,
          position: [agv.x, 0.62, agv.z + agv.direction * 0.42]
        };
      }
    }
  } else {
    const scaleX = 24;
    const scaleZ = 24;
    const padX = (totalWidth / 2) * scaleX + 90;
    const padY = (TOTAL_Z / 2) * scaleZ + 90;
    for (let p = 0; p < 18; p += 1) {
      const slot = palletSlots[(tickCounter * 18 + p) % palletSlots.length]!;
      slot.statusIndex = (slot.statusIndex + 1) % STATUS_LIST.length;
      const st = STATUS_LIST[slot.statusIndex]!;
      const idx = nextNodes.findIndex((n) => n.id === slot.id);
      const prev = idx >= 0 ? nextNodes[idx] : undefined;
      if (prev && prev.type === "rect") {
        nextNodes[idx] = {
          ...prev,
          fill: st.color,
          metadata: { ...prev.metadata, status: st.label }
        };
      }
    }
    for (let a = 0; a < agvFleet.length; a += 1) {
      const agv = agvFleet[a]!;
      agv.z += agv.direction * 0.9;
      if (agv.z > TOTAL_Z / 2 + 1.5) agv.z = -TOTAL_Z / 2 - 1.5;
      if (agv.z < -TOTAL_Z / 2 - 1.5) agv.z = TOTAL_Z / 2 + 1.5;
      const idx = nextNodes.findIndex((n) => n.id === agv.id);
      const prev = idx >= 0 ? nextNodes[idx] : undefined;
      if (prev && prev.type === "circle") {
        nextNodes[idx] = {
          ...prev,
          position: [padX + agv.x * scaleX, padY + agv.z * scaleZ]
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
    telemetryTimer = window.setInterval(stepTelemetry, 140);
    btnTelemetry.textContent = "Live Telemetry: ON";
    btnTelemetry.classList.add("active");
  }
});
btnOrbitTour.addEventListener("click", () => {
  if (!runtime || currentMode !== "3d") return;
  const current = runtime.current;
  if (current.mode !== "3d" || !("camera" in current)) return;
  let step = 0;
  const total = 75;
  const anim = () => {
    if (!runtime || currentMode !== "3d" || step >= total) return;
    const t = step / total;
    // Sweep smoothly from high 3/4 overview down into an illuminated AGV aisle and back!
    const angle = 0.65 + t * Math.PI * 0.9;
    const radius = 36 - Math.sin(t * Math.PI) * 18;
    const height = 13.5 - Math.sin(t * Math.PI) * 7.5;
    current.camera.position.set(
      Math.cos(angle) * radius,
      height,
      Math.sin(angle) * radius
    );
    current.camera.lookAt(0, 2.8, 0);
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
