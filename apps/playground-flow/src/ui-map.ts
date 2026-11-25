import {
  captureCanvas2DSnapshot,
  computeCanvas2DRedlines,
  connectEditorToCanvas,
  createCanvas,
  createEditor,
  createImageAssetRef,
  createMemoryImageStore,
  createNodeUpdateCommand,
  define2DEdge,
  defineDocument,
  DENOVO_IMAGE_NODE_TYPE,
  inspectCanvas2DRuntime,
  setImageFit,
  type Canvas2DBoxModelOverlay,
  type Canvas2DNode,
  type Canvas2DRectBounds,
  type Canvas2DSceneInput,
  type CanvasDocument,
  type DenovoCanvas2DRuntime,
  type DenovoImageFit
} from "@de-novo/canvas/2d";
import "@de-novo/canvas/styles.css";

type ScreenSpec = {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly accent: string;
  readonly badge: string;
  readonly kind: "auth" | "dashboard" | "checkout" | "settings" | "profile" | "success";
};

const CORE_SCREENS: readonly ScreenSpec[] = [
  {
    id: "screen-login",
    title: "Sign In",
    subtitle: "iOS · 390×844",
    accent: "#6366f1",
    badge: "AUTH",
    kind: "auth"
  },
  {
    id: "screen-home",
    title: "Analytics Home",
    subtitle: "Web · 1440×900",
    accent: "#0ea5e9",
    badge: "MAIN",
    kind: "dashboard"
  },
  {
    id: "screen-checkout",
    title: "Checkout",
    subtitle: "Web · 1280×800",
    accent: "#f59e0b",
    badge: "FLOW",
    kind: "checkout"
  },
  {
    id: "screen-settings",
    title: "Workspace Settings",
    subtitle: "Desktop · GPUI",
    accent: "#14b8a6",
    badge: "PREFS",
    kind: "settings"
  },
  {
    id: "screen-profile",
    title: "Account & Keys",
    subtitle: "Android · 412×915",
    accent: "#a855f7",
    badge: "USER",
    kind: "profile"
  },
  {
    id: "screen-receipt",
    title: "Order Confirmed",
    subtitle: "iOS · 390×844",
    accent: "#22c55e",
    badge: "DONE",
    kind: "success"
  }
];

type UiMapDemoState = {
  readonly backend: "canvas2d" | "webgpu";
  readonly screenCount: number;
  readonly drawCalls: number;
  readonly textures: number | undefined;
  readonly avoidObstacles: boolean;
  readonly inspectEnabled: boolean;
  readonly selectedId: string;
  readonly hoveredId: string | null;
  readonly activeRedlineCount: number;
  readonly undoDepth: number;
  readonly selectedFit: DenovoImageFit;
  readonly lastSnapshotNonBlank: boolean | null;
  readonly lastSnapshotPngBytes: number | null;
};

declare global {
  interface Window {
    __uiMapDemo?: {
      readonly getState: () => UiMapDemoState;
      readonly captureNow: () => Promise<void>;
    };
  }
}

function drawRoundedPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function renderSyntheticScreenCanvas(spec: ScreenSpec, index: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }

  // Screen surface background
  const grad = ctx.createLinearGradient(0, 0, 480, 320);
  grad.addColorStop(0, "#111827");
  grad.addColorStop(1, "#0f172a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 480, 320);

  // Top app chrome
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, 480, 46);
  ctx.fillStyle = "#334155";
  ctx.fillRect(0, 45, 480, 1);

  // Window dots
  const dotColors = ["#ef4444", "#f59e0b", "#22c55e"];
  dotColors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(20 + i * 16, 23, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Title & platform badge
  ctx.fillStyle = "#f8fafc";
  ctx.font = "600 15px Inter, -apple-system, sans-serif";
  ctx.fillText(spec.title, 74, 28);

  drawRoundedPanel(ctx, 386, 12, 78, 22, 11, spec.accent);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 11px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(spec.badge, 425, 27);
  ctx.textAlign = "left";

  // Subtitle row
  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 12px ui-monospace, monospace";
  ctx.fillText(`${spec.subtitle}  ·  #${String(index + 1).padStart(2, "0")}`, 20, 72);

  if (spec.kind === "dashboard") {
    for (let k = 0; k < 3; k += 1) {
      drawRoundedPanel(ctx, 20 + k * 152, 88, 138, 72, 10, "#1e293b");
      ctx.fillStyle = k === 0 ? spec.accent : "#38bdf8";
      ctx.font = "700 22px Inter, sans-serif";
      ctx.fillText(["12.4k", "99.9%", "0.4ms"][k]!, 34 + k * 152, 128);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "500 11px Inter, sans-serif";
      ctx.fillText(["ACTIVE", "UPTIME", "SNAP"][k]!, 34 + k * 152, 148);
    }
    drawRoundedPanel(ctx, 20, 176, 440, 122, 10, "#1e293b");
    ctx.strokeStyle = spec.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const pts = [260, 238, 246, 214, 224, 198, 206, 190];
    pts.forEach((py, idx) => {
      const px = 42 + idx * 56;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  } else if (spec.kind === "auth") {
    drawRoundedPanel(ctx, 90, 92, 300, 196, 14, "#1e293b");
    drawRoundedPanel(ctx, 114, 122, 252, 36, 8, "#0f172a");
    drawRoundedPanel(ctx, 114, 170, 252, 36, 8, "#0f172a");
    drawRoundedPanel(ctx, 114, 224, 252, 40, 10, spec.accent);
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 14px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Continue to Workspace →", 240, 249);
    ctx.textAlign = "left";
  } else if (spec.kind === "checkout") {
    drawRoundedPanel(ctx, 20, 92, 250, 198, 12, "#1e293b");
    drawRoundedPanel(ctx, 286, 92, 174, 198, 12, "#1e293b");
    for (let r = 0; r < 3; r += 1) {
      drawRoundedPanel(ctx, 36, 112 + r * 52, 218, 38, 8, "#0f172a");
    }
    drawRoundedPanel(ctx, 304, 230, 138, 42, 10, spec.accent);
    ctx.fillStyle = "#0f172a";
    ctx.font = "700 13px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Pay $49.00", 373, 256);
    ctx.textAlign = "left";
  } else if (spec.kind === "success") {
    ctx.fillStyle = spec.accent;
    ctx.beginPath();
    ctx.arc(240, 152, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(222, 152);
    ctx.lineTo(235, 166);
    ctx.lineTo(260, 138);
    ctx.stroke();
    drawRoundedPanel(ctx, 130, 214, 220, 36, 8, "#1e293b");
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "600 13px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Receipt #DNV-2026-042", 240, 237);
    ctx.textAlign = "left";
  } else {
    // settings / profile rows
    drawRoundedPanel(ctx, 20, 90, 124, 204, 10, "#1e293b");
    drawRoundedPanel(ctx, 160, 90, 300, 204, 10, "#1e293b");
    for (let r = 0; r < 4; r += 1) {
      drawRoundedPanel(ctx, 34, 108 + r * 42, 96, 26, 6, r === 0 ? spec.accent : "#0f172a");
      drawRoundedPanel(ctx, 178, 108 + r * 42, 264, 28, 6, "#0f172a");
    }
  }

  return canvas;
}

function buildScreenMapData(count: number, avoidObstacles: boolean) {
  const imageStore = createMemoryImageStore();
  const assets = [];
  const nodes: NonNullable<Canvas2DSceneInput["nodes"]> = [];
  const screenIds: string[] = [];

  const cols = count <= 6 ? 3 : count <= 60 ? 10 : 20;
  const cardW = 240;
  const cardH = 160;
  const gapX = 64;
  const gapY = 76;

  // Populate reusable synthetic bitmaps for each of the 6 screen archetypes
  const tileAssetIds: string[] = [];
  for (let k = 0; k < CORE_SCREENS.length; k += 1) {
    const spec = CORE_SCREENS[k]!;
    const assetId = `asset-${spec.id}`;
    tileAssetIds.push(assetId);
    imageStore.set(assetId, renderSyntheticScreenCanvas(spec, k));
    assets.push(
      createImageAssetRef(assetId, {
        mimeType: "image/png",
        width: 480,
        height: 320
      })
    );
  }

  for (let i = 0; i < count; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const spec = CORE_SCREENS[i % CORE_SCREENS.length]!;
    const id = i < CORE_SCREENS.length ? spec.id : `screen-${i + 1}`;
    screenIds.push(id);
    nodes.push({
      id,
      layerId: "screens",
      type: DENOVO_IMAGE_NODE_TYPE,
      position: [col * (cardW + gapX), row * (cardH + gapY)],
      props: {
        assetId: tileAssetIds[i % tileAssetIds.length]!,
        width: cardW,
        height: cardH,
        fit: "fill",
        cornerRadius: [14, 14, 10, 10],
        stroke: i === 0 ? "#38bdf8" : "#334155",
        strokeWidth: i === 0 ? 3 : 2,
        placeholder: "#1e293b",
        alt: spec.title
      },
      metadata: {
        title: spec.title,
        platform: spec.subtitle,
        margin: 14,
        padding: 12,
        border: 2
      }
    });
  }

  // Add a clipped UI token swatch card using 0.2.0 rect/circle/group.clip primitives
  if (count <= 6) {
    const groupX = 3 * (cardW + gapX) + 12;
    nodes.push(
      {
        id: "ui-frame-clip",
        layerId: "screens",
        type: "group",
        position: [groupX, 0],
        clip: { x: 0, y: 0, width: 200, height: 160, cornerRadius: 16 },
        opacity: 1
      },
      {
        id: "ui-frame-bg",
        layerId: "screens",
        parentId: "ui-frame-clip",
        type: "rect",
        position: [0, 0],
        size: [200, 160],
        fill: "#1e293b",
        cornerRadius: 16,
        stroke: "#475569",
        strokeWidth: 2
      },
      {
        id: "ui-frame-overflow-orb",
        layerId: "screens",
        parentId: "ui-frame-clip",
        type: "circle",
        position: [190, 20],
        radius: 68,
        fill: "#38bdf8",
        opacity: 0.28
      },
      {
        id: "ui-frame-pill",
        layerId: "screens",
        parentId: "ui-frame-clip",
        type: "rect",
        position: [18, 22],
        size: [118, 30],
        fill: "#0ea5e9",
        cornerRadius: [15, 15, 15, 15],
        stroke: "#7dd3fc",
        strokeWidth: 1.5
      },
      {
        id: "ui-frame-label",
        layerId: "screens",
        parentId: "ui-frame-clip",
        type: "text",
        position: [18, 72],
        text: "Clipped Group\nrounded + opacity",
        fill: "#e2e8f0",
        fontSize: 13,
        fontWeight: "bold"
      }
    );
  }

  // Obstacle-free gutter transition edges (crossing past intermediate screens!)
  const edgePairs: readonly (readonly [string, string, string])[] =
    count <= 6
      ? [
          ["screen-login", "screen-checkout", "#f59e0b"], // bypasses screen-home via gutter!
          ["screen-home", "screen-receipt", "#38bdf8"], // crosses grid diagonally via gutters!
          ["screen-settings", "screen-receipt", "#22c55e"], // bypasses screen-profile via gutter!
          ["screen-login", "screen-settings", "#a855f7"]
        ]
      : [
          [screenIds[0]!, screenIds[2]!, "#f59e0b"],
          [screenIds[1]!, screenIds[cols + 3]!, "#38bdf8"],
          [screenIds[cols]!, screenIds[cols + 2]!, "#22c55e"],
          [screenIds[3]!, screenIds[cols * 2 + 1]!, "#a855f7"]
        ];

  edgePairs.forEach(([sourceId, targetId, stroke], idx) => {
    nodes.push(
      define2DEdge({
        id: `transition-${idx + 1}`,
        layerId: "screens",
        type: "edge",
        sourceId,
        targetId,
        sourcePort: "right",
        targetPort: "left",
        routing: "orthogonal",
        avoidObstacles,
        obstaclePadding: 20,
        stroke,
        strokeWidth: 2.5,
        targetArrow: true
      })
    );
  });

  const document: CanvasDocument = defineDocument({
    id: `ui-screen-map-${count}`,
    assets,
    scene: {
      id: `ui-screen-map-scene-${count}`,
      mode: "2d",
      background: "#0b1220",
      layers: [{ id: "screens", name: "Screens" }],
      nodes
    }
  });

  return { document, imageStore, screenIds };
}

const stageEl = document.querySelector<HTMLElement>("#stage");
const hudEl = document.querySelector<HTMLElement>("#hud");
const presetSelect = document.querySelector<HTMLSelectElement>("#screen-preset");
const btnBackend = document.querySelector<HTMLButtonElement>("#btn-backend");
const btnGutters = document.querySelector<HTMLButtonElement>("#btn-gutters");
const btnInspect = document.querySelector<HTMLButtonElement>("#btn-inspect");
const fitSelect = document.querySelector<HTMLSelectElement>("#fit-select");
const btnFitView = document.querySelector<HTMLButtonElement>("#btn-fit-view");
const btnSnapshot = document.querySelector<HTMLButtonElement>("#btn-snapshot");
const btnUndo = document.querySelector<HTMLButtonElement>("#btn-undo");
const snapshotDrawer = document.querySelector<HTMLElement>("#snapshot-drawer");
const snapImg = document.querySelector<HTMLImageElement>("#snap-img");
const snapMeta = document.querySelector<HTMLElement>("#snap-meta");
const snapClose = document.querySelector<HTMLElement>("#snap-close");

if (
  !stageEl ||
  !hudEl ||
  !presetSelect ||
  !btnBackend ||
  !btnGutters ||
  !btnInspect ||
  !fitSelect ||
  !btnFitView ||
  !btnSnapshot ||
  !btnUndo ||
  !snapshotDrawer ||
  !snapImg ||
  !snapMeta ||
  !snapClose
) {
  throw new Error("Missing UI map demo DOM elements.");
}

const hasWebGpu = typeof navigator !== "undefined" && "gpu" in navigator && Boolean((navigator as Navigator & { gpu?: unknown }).gpu);
if (!hasWebGpu) {
  btnBackend.disabled = true;
  btnBackend.title = "WebGPU unavailable in this browser";
}

let currentBackend: "canvas2d" | "webgpu" = "canvas2d";
let currentCount = 6;
let avoidObstacles = true;
let inspectEnabled = true;
let selectedId = "screen-login";
let hoveredId: string | null = "screen-home";
let activeRedlineCount = 0;
let lastSnapshotNonBlank: boolean | null = null;
let lastSnapshotPngBytes: number | null = null;

let initialData = buildScreenMapData(currentCount, avoidObstacles);
let activeEditor = createEditor({ document: initialData.document });
let activeImageStore = initialData.imageStore;
let activeRuntime: DenovoCanvas2DRuntime | null = null;
let activeDisconnect: (() => void) | null = null;

function getSelectedImageNode(): Extract<Canvas2DNode, { type: `plugin.${string}.${string}` }> | null {
  const scene = activeEditor.getState().document.scene;
  if (scene.mode !== "2d") {
    return null;
  }
  const node = scene.nodes.find((n) => n.id === selectedId);
  if (node && node.type === DENOVO_IMAGE_NODE_TYPE) {
    return node;
  }
  return null;
}

function getSelectedFit(): DenovoImageFit {
  const node = getSelectedImageNode();
  const fit = node && typeof node.props === "object" && node.props !== null && "fit" in node.props
    ? (node.props as { fit?: DenovoImageFit }).fit
    : undefined;
  return fit ?? "contain";
}

function computeAllBounds(): Canvas2DRectBounds {
  if (!activeRuntime) {
    return { minX: 0, minY: 0, maxX: 900, maxY: 420 };
  }
  const nodes = activeEditor.getState().document.scene.nodes;
  const boundsMap = activeRuntime.current.resolveNodeBounds(nodes.map((n) => n.id));
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const b of boundsMap.values()) {
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 900, maxY: 420 };
  }
  return { minX, minY, maxX, maxY };
}

function refreshInspectionOverlay() {
  if (!activeRuntime) {
    return;
  }
  if (!inspectEnabled) {
    activeRedlineCount = 0;
    activeRuntime.current.setInspectionOverlay(null);
    return;
  }

  const idsToMeasure = [selectedId];
  const fallbackNeighbor = selectedId === "screen-login" ? "screen-home" : "screen-login";
  const partnerId = hoveredId && hoveredId !== selectedId ? hoveredId : fallbackNeighbor;
  idsToMeasure.push(partnerId);

  const boundsMap = activeRuntime.current.resolveNodeBounds(idsToMeasure);
  const selectedBounds = boundsMap.get(selectedId);
  const partnerBounds = boundsMap.get(partnerId);

  if (!selectedBounds) {
    activeRedlineCount = 0;
    activeRuntime.current.setInspectionOverlay(null);
    return;
  }

  const boxModels: Canvas2DBoxModelOverlay[] = [
    {
      bounds: selectedBounds,
      margin: { top: 14, right: 14, bottom: 14, left: 14 },
      border: { top: 3, right: 3, bottom: 3, left: 3 },
      padding: { top: 12, right: 12, bottom: 12, left: 12 },
      label: `${selectedId} · ${Math.round(selectedBounds.maxX - selectedBounds.minX)} × ${Math.round(selectedBounds.maxY - selectedBounds.minY)}`
    }
  ];

  const redlines = partnerBounds
    ? computeCanvas2DRedlines(selectedBounds, partnerBounds, { unit: "px" })
    : [];
  activeRedlineCount = redlines.length;
  activeRuntime.current.setInspectionOverlay({ boxModels, redlines });
}

function getState(): UiMapDemoState {
  const stats = activeRuntime?.getRenderStats();
  return {
    backend: currentBackend,
    screenCount: currentCount,
    drawCalls: stats?.drawCalls ?? 0,
    textures: stats?.textures,
    avoidObstacles,
    inspectEnabled,
    selectedId,
    hoveredId,
    activeRedlineCount,
    undoDepth: activeEditor.getState().history.undoDepth,
    selectedFit: getSelectedFit(),
    lastSnapshotNonBlank,
    lastSnapshotPngBytes
  };
}

function renderHud() {
  const st = getState();
  const atlasLine =
    st.backend === "webgpu"
      ? `<div><strong>WebGPU Atlas</strong>: <span class="ok">${st.textures ?? 0} page(s)</span> · 1 drawCall</div>`
      : "";
  hudEl!.innerHTML = [
    `<div><strong>Backend</strong>: <span class="ok">${st.backend}</span> · <strong>drawCalls</strong>: <span class="ok">${st.drawCalls}</span></div>`,
    atlasLine,
    `<div><strong>Screens</strong>: ${st.screenCount} · <strong>Selected</strong>: ${st.selectedId} (${st.selectedFit})</div>`,
    `<div><strong>Gutter Routing</strong>: <span class="${st.avoidObstacles ? "ok" : "warn"}">${st.avoidObstacles ? "obstacle-free ON" : "naive OFF"}</span></div>`,
    `<div><strong>Inspector</strong>: ${st.inspectEnabled ? `<span class="ok">box-model + ${st.activeRedlineCount} redline(s)</span>` : "OFF"}</div>`,
    `<div><strong>Undo Depth</strong>: ${st.undoDepth}</div>`
  ].join("");
  fitSelect!.value = st.selectedFit;
  btnBackend!.textContent = `Backend: ${currentBackend === "webgpu" ? "WebGPU" : "Canvas2D"}`;
  btnBackend!.classList.toggle("active", currentBackend === "webgpu");
  btnGutters!.textContent = `Obstacle-Free Gutters: ${avoidObstacles ? "ON" : "OFF"}`;
  btnGutters!.classList.toggle("active", avoidObstacles);
  btnInspect!.textContent = `Box-Model + Redlines: ${inspectEnabled ? "ON" : "OFF"}`;
  btnInspect!.classList.toggle("active", inspectEnabled);
}

async function mountRuntime(fitAfterMount = true) {
  activeDisconnect?.();
  activeRuntime?.destroy();
  stageEl!.innerHTML = "";

  const runtime = createCanvas(stageEl!, {
    document: activeEditor.getState().document,
    editable: true,
    imageStore: activeImageStore,
    renderer: currentBackend,
    canvas2d: {
      minimap: { position: "bottom-right", width: 170, height: 112 }
    }
  });
  activeRuntime = runtime;
  await runtime.ready;
  activeDisconnect = connectEditorToCanvas(activeEditor, runtime);

  runtime.canvas.addEventListener("pointermove", (event) => {
    const rect = runtime.canvas.getBoundingClientRect();
    const hit = runtime.hitTest({
      point: [event.clientX - rect.left, event.clientY - rect.top]
    });
    const nextHover =
      hit.kind === "node" && hit.nodeId.startsWith("screen-") ? hit.nodeId : null;
    if (nextHover !== hoveredId) {
      hoveredId = nextHover;
      refreshInspectionOverlay();
      renderHud();
    }
  });

  runtime.canvas.addEventListener("click", (event) => {
    const rect = runtime.canvas.getBoundingClientRect();
    const hit = runtime.hitTest({
      point: [event.clientX - rect.left, event.clientY - rect.top]
    });
    if (hit.kind === "node" && hit.nodeId.startsWith("screen-")) {
      selectedId = hit.nodeId;
      refreshInspectionOverlay();
      renderHud();
    }
  });

  if (fitAfterMount) {
    runtime.current.fitViewBounds(computeAllBounds(), 84, false);
  }
  refreshInspectionOverlay();
  runtime.render();
  renderHud();
}

async function rebuildPreset(count: number) {
  currentCount = count;
  const built = buildScreenMapData(count, avoidObstacles);
  activeImageStore = built.imageStore;
  activeEditor = createEditor({ document: built.document });
  selectedId = built.screenIds[0] ?? "screen-login";
  hoveredId = built.screenIds[1] ?? null;
  await mountRuntime(true);
}

async function toggleGutters() {
  avoidObstacles = !avoidObstacles;
  const edges = activeEditor
    .getState()
    .document.scene.nodes.filter((n) => n.type === "edge");
  if (edges.length > 0) {
    await activeEditor.dispatch({
      type: "transaction",
      label: avoidObstacles ? "Enable obstacle-free gutters" : "Disable obstacle-free gutters",
      commands: edges.map((edge) =>
        createNodeUpdateCommand(edge, { avoidObstacles })
      )
    });
  }
  activeRuntime?.render();
  renderHud();
}

async function captureNow() {
  if (!activeRuntime) {
    return;
  }
  const snap = await captureCanvas2DSnapshot(activeRuntime, {
    onlyInViewport: true
  });
  const fullInspect = inspectCanvas2DRuntime(activeRuntime);
  lastSnapshotNonBlank = snap.pixels.nonBlank;
  lastSnapshotPngBytes = snap.pngDataUrl ? snap.pngDataUrl.length : 0;

  if (snap.pngDataUrl) {
    snapImg!.src = snap.pngDataUrl;
  }
  snapMeta!.innerHTML = [
    `<div class="row"><span>backend</span><span>${snap.inspection.backend}</span></div>`,
    `<div class="row"><span>inViewport</span><span>${snap.inspection.nodes.length}/${fullInspect.nodeCount}</span></div>`,
    `<div class="row"><span>uniqueColors</span><span>${snap.pixels.uniqueColors}</span></div>`,
    `<div class="row"><span>nonBlank</span><span>${snap.pixels.nonBlank}</span></div>`,
    `<div class="row"><span>pngDataUrl</span><span>${Math.round((lastSnapshotPngBytes ?? 0) / 1024)} KB</span></div>`
  ].join("");
  snapshotDrawer!.classList.add("open");
  renderHud();
}

presetSelect.addEventListener("change", () => {
  void rebuildPreset(Number(presetSelect.value));
});

btnBackend.addEventListener("click", () => {
  if (!hasWebGpu) return;
  currentBackend = currentBackend === "canvas2d" ? "webgpu" : "canvas2d";
  void mountRuntime(false);
});

btnGutters.addEventListener("click", () => {
  void toggleGutters();
});

btnInspect.addEventListener("click", () => {
  inspectEnabled = !inspectEnabled;
  refreshInspectionOverlay();
  activeRuntime?.render();
  renderHud();
});

fitSelect.addEventListener("change", () => {
  const fit = fitSelect.value as DenovoImageFit;
  const selected = getSelectedImageNode();
  if (!selected) return;
  void activeEditor.apply([setImageFit({ nodeId: selected.id, fit })]).then(() => {
    activeRuntime?.render();
    renderHud();
  });
});

btnFitView.addEventListener("click", () => {
  activeRuntime?.current.fitViewBounds(computeAllBounds(), 84, true);
});

btnSnapshot.addEventListener("click", () => {
  void captureNow();
});

snapClose.addEventListener("click", () => {
  snapshotDrawer.classList.remove("open");
});

btnUndo.addEventListener("click", () => {
  void activeEditor.undo().then(() => {
    const firstEdge = activeEditor
      .getState()
      .document.scene.nodes.find((n) => n.type === "edge");
    if (firstEdge && firstEdge.type === "edge") {
      avoidObstacles = firstEdge.avoidObstacles;
    }
    refreshInspectionOverlay();
    activeRuntime?.render();
    renderHud();
  });
});

window.__uiMapDemo = { getState, captureNow };

void mountRuntime(true);
