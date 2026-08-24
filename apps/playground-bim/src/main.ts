import {
  connectEditorToCanvas,
  createCanvas,
  createDistanceMeasurementTool,
  createEditor,
  createPanOrbitTool,
  createSelectTool,
  type CanvasDocument,
  type CanvasEditor
} from "@denovo/canvas";
import "@denovo/canvas/styles.css";
import { WebIfcBimAdapter } from "@denovo/canvas-bim/web-ifc";
import "./styles.css";

const FEDERATE_NAME = "copy";
const FEDERATE_ORIGIN = [40, 0, 0] as const;

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`BIM example element was not found: ${selector}`);
  }
  return element;
}

const stage = requireElement<HTMLDivElement>("#stage");
const statusOutput = requireElement<HTMLOutputElement>("#status");
const elementCountOutput = requireElement<HTMLOutputElement>("#element-count");
const modelCountOutput = requireElement<HTMLOutputElement>("#model-count");
const measurementCountOutput =
  requireElement<HTMLOutputElement>("#measurement-count");
const reloadButton = requireElement<HTMLButtonElement>("#reload");
const federateButton = requireElement<HTMLButtonElement>("#federate");
const measureSurfaceButton =
  requireElement<HTMLButtonElement>("#measure-surface");

type Cleanup = () => void;

type BimFederationModel = {
  id: string;
  nodeCount: number;
  origin: readonly [number, number, number];
};

type BimFederationSnapshot = {
  cameraTargetX: number;
  modelCount: number;
  models: readonly BimFederationModel[];
  uniqueNodeIds: boolean;
};

type PlaygroundHandle = {
  __bimEditor?: CanvasEditor | undefined;
  __bimFederation?: BimFederationSnapshot | undefined;
};

let currentCleanup: Cleanup | null = null;
let adapter: WebIfcBimAdapter | null = null;
let sampleData: ArrayBuffer | null = null;
let editor: CanvasEditor | null = null;
let federated = false;
let measuring = false;

function playgroundWindow(): PlaygroundHandle {
  return window as unknown as PlaygroundHandle;
}

function snapshotFederation(document: CanvasDocument): BimFederationSnapshot {
  const meshes = document.scene.nodes.filter((node) => node.type === "mesh");
  const byModel = new Map<string, BimFederationModel>();

  for (const node of meshes) {
    const metadata = node.metadata?.__bim;
    const modelId =
      metadata && typeof metadata === "object" && "modelId" in metadata
        ? metadata.modelId
        : undefined;

    if (typeof modelId !== "string") {
      continue;
    }

    const existing = byModel.get(modelId);
    if (existing) {
      existing.nodeCount += 1;
      continue;
    }

    byModel.set(modelId, {
      id: modelId,
      nodeCount: 1,
      origin: [
        node.position[0] ?? 0,
        node.position[1] ?? 0,
        node.position[2] ?? 0
      ]
    });
  }

  const ids = meshes.map((node) => node.id);

  return {
    cameraTargetX: document.scene.camera.target[0] ?? 0,
    modelCount: byModel.size,
    models: [...byModel.values()],
    uniqueNodeIds: new Set(ids).size === ids.length
  };
}

function publishFederation(document: CanvasDocument): BimFederationSnapshot {
  const snapshot = snapshotFederation(document);
  modelCountOutput.textContent = String(snapshot.modelCount);
  modelCountOutput.dataset.bimModels = String(snapshot.modelCount);
  playgroundWindow().__bimFederation = snapshot;
  return snapshot;
}

function unmountCanvas(): void {
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }
  editor = null;
  playgroundWindow().__bimEditor = undefined;
}

function setMeasuring(next: boolean): void {
  if (!editor) {
    return;
  }

  measuring = next;
  measureSurfaceButton.setAttribute("aria-pressed", String(next));
  editor.activateTool(next ? "bim.tool.measure-surface" : "bim.tool.pan-orbit");
  statusOutput.textContent = next
    ? "surface measure — click two points on geometry"
    : federated
      ? "federated"
      : "ready";
}

function mountImported(
  imported: Awaited<ReturnType<WebIfcBimAdapter["toDocument"]>>
): void {
  const { document, geometryStore } = imported;
  const runtime = createCanvas(stage, {
    document,
    editable: true,
    geometryStore
  });
  const nextEditor = createEditor({ document });
  const disconnect = connectEditorToCanvas(nextEditor, runtime);

  nextEditor.registerTool(createSelectTool({ id: "bim.tool.select" }));
  nextEditor.registerTool(createPanOrbitTool({ id: "bim.tool.pan-orbit" }));

  const firstLayerId = document.scene.layers[0]?.id ?? "default";
  nextEditor.registerTool(
    createDistanceMeasurementTool({
      capture: "surface",
      createId: () => `ifc-measurement-${Date.now().toString(36)}`,
      id: "bim.tool.measure-surface",
      label: "Surface distance",
      layerId: firstLayerId,
      mode: "3d",
      precision: 3,
      type: "measurement",
      unit: { metersPerUnit: 1, name: "meter", symbol: "m" }
    })
  );
  nextEditor.activateTool("bim.tool.pan-orbit");

  const updateMeasurementCount = (): void => {
    const count = nextEditor
      .getState()
      .document.scene.nodes.filter((node) => node.type === "measurement")
      .length;
    measurementCountOutput.textContent = String(count);
  };
  const unsubscribeMeasurements = nextEditor.subscribe(() => {
    updateMeasurementCount();

    if (!measuring) {
      return;
    }

    const measurements = nextEditor
      .getState()
      .document.scene.nodes.filter(
        (node) =>
          node.type === "measurement" && node.measurement === "distance"
      );
    const latest = measurements.at(-1);

    if (
      latest &&
      latest.type === "measurement" &&
      latest.measurement === "distance"
    ) {
      const dx = (latest.end[0] ?? 0) - (latest.start[0] ?? 0);
      const dy = (latest.end[1] ?? 0) - (latest.start[1] ?? 0);
      const dz = (latest.end[2] ?? 0) - (latest.start[2] ?? 0);
      const meters = Math.hypot(dx, dy, dz) / latest.unit.metersPerUnit;
      statusOutput.textContent = `last distance ${meters.toFixed(3)} m`;
    }
  });
  updateMeasurementCount();

  editor = nextEditor;
  playgroundWindow().__bimEditor = nextEditor;
  publishFederation(document);
  elementCountOutput.textContent = String(
    document.scene.nodes.filter((node) => node.type === "mesh").length
  );
  setMeasuring(false);

  currentCleanup = () => {
    unsubscribeMeasurements();
    disconnect();
    runtime.destroy();
  };
}

async function loadSample(): Promise<void> {
  statusOutput.textContent = "fetching sample…";
  federated = false;
  federateButton.disabled = true;
  unmountCanvas();

  if (adapter) {
    await adapter.dispose();
    adapter = null;
  }

  const response = await fetch("/sample.ifc");
  if (!response.ok) {
    statusOutput.textContent = `failed to fetch sample (${response.status})`;
    return;
  }

  const data = await response.arrayBuffer();
  sampleData = data;
  statusOutput.textContent = "parsing IFC…";
  adapter = new WebIfcBimAdapter({ wasm: { wasmBaseUrl: "/wasm/" } });

  try {
    const metadata = await adapter.loadModel({
      data,
      name: "sample",
      type: "ifc"
    });
    elementCountOutput.textContent = String(metadata.elementCount ?? "—");
    statusOutput.textContent = "building document…";
    const imported = await adapter.toDocument();
    statusOutput.textContent = "rendering…";
    mountImported(imported);
    federateButton.disabled = false;
    statusOutput.textContent = "ready";
  } catch (error) {
    statusOutput.textContent = `error: ${(error as Error).message}`;
  }
}

async function federateCopy(): Promise<void> {
  if (!adapter || !sampleData || federated) {
    return;
  }

  federateButton.disabled = true;
  statusOutput.textContent = "parsing federated copy…";

  try {
    await adapter.loadModel({
      data: sampleData.slice(0),
      name: FEDERATE_NAME,
      origin: FEDERATE_ORIGIN,
      type: "ifc"
    });
    statusOutput.textContent = "building federated document…";
    const imported = await adapter.toDocument();
    unmountCanvas();
    statusOutput.textContent = "rendering…";
    mountImported(imported);
    federated = true;
    statusOutput.textContent = "federated";
  } catch (error) {
    federateButton.disabled = false;
    statusOutput.textContent = `error: ${(error as Error).message}`;
  }
}

reloadButton.addEventListener("click", () => {
  void loadSample();
});

federateButton.addEventListener("click", () => {
  void federateCopy();
});

measureSurfaceButton.addEventListener("click", () => {
  setMeasuring(!measuring);
});

void loadSample();
