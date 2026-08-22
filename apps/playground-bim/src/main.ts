import {
  connectEditorToCanvas,
  createCanvas,
  createDistanceMeasurementTool,
  createEditor,
  createPanOrbitTool,
  createSelectTool,
  type CanvasDocument
} from "@denovo/canvas";
import "@denovo/canvas/styles.css";
import { WebIfcBimAdapter } from "@denovo/canvas-bim/web-ifc";
import "./styles.css";

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
const measurementCountOutput =
  requireElement<HTMLOutputElement>("#measurement-count");
const reloadButton = requireElement<HTMLButtonElement>("#reload");
const measureSurfaceButton =
  requireElement<HTMLButtonElement>("#measure-surface");

type Cleanup = () => void;
let currentCleanup: Cleanup | null = null;

async function loadSample(): Promise<void> {
  statusOutput.textContent = "fetching sample…";

  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

  const response = await fetch("/sample.ifc");
  if (!response.ok) {
    statusOutput.textContent = `failed to fetch sample (${response.status})`;
    return;
  }
  const data = await response.arrayBuffer();

  statusOutput.textContent = "parsing IFC…";
  const adapter = new WebIfcBimAdapter({ wasm: { wasmBaseUrl: "/wasm/" } });

  try {
    const metadata = await adapter.loadModel({
      type: "ifc",
      data,
      name: "sample"
    });
    elementCountOutput.textContent = String(metadata.elementCount ?? "—");

    statusOutput.textContent = "building document…";
    const imported = await adapter.toDocument();
    const document: CanvasDocument = imported.document;

    statusOutput.textContent = "rendering…";

    const runtime = createCanvas(stage, {
      document,
      editable: true,
      geometryStore: imported.geometryStore
    });
    const editor = createEditor({ document });

    const disconnect = connectEditorToCanvas(editor, runtime);

    const selectTool = createSelectTool({ id: "bim.tool.select" });
    const panOrbitTool = createPanOrbitTool({ id: "bim.tool.pan-orbit" });

    // Surface capture: every measurement endpoint lands on the real box or
    // mesh surface under the pointer — no work-plane approximation.
    const firstLayerId = document.scene.layers[0]?.id ?? "default";
    const measureTool = createDistanceMeasurementTool({
      capture: "surface",
      createId: () => `ifc-measurement-${Date.now().toString(36)}`,
      id: "bim.tool.measure-surface",
      label: "Surface distance",
      layerId: firstLayerId,
      mode: "3d",
      precision: 3,
      type: "measurement",
      unit: { metersPerUnit: 1, name: "meter", symbol: "m" }
    });

    editor.registerTool(selectTool);
    editor.registerTool(panOrbitTool);
    editor.registerTool(measureTool);
    editor.activateTool("bim.tool.pan-orbit");

    const updateMeasurementCount = (): void => {
      const count = editor
        .getState()
        .document.scene.nodes.filter((node) => node.type === "measurement")
        .length;
      measurementCountOutput.textContent = String(count);
    };
    const unsubscribeMeasurements = editor.subscribe(() => {
      updateMeasurementCount();
    });
    updateMeasurementCount();

    let measuring = false;

    function setMeasuring(next: boolean): void {
      measuring = next;
      measureSurfaceButton.setAttribute("aria-pressed", String(next));
      editor.activateTool(next ? "bim.tool.measure-surface" : "bim.tool.pan-orbit");
      statusOutput.textContent = next
        ? "surface measure — click two points on geometry"
        : "ready";
    }

    measureSurfaceButton.addEventListener("click", () => {
      setMeasuring(!measuring);
    });

    editor.subscribe(() => {
      // Any committed command while measuring reports progress in status.
      if (!measuring) {
        return;
      }

      const measurements = editor
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
        const dx =
          (latest.end[0] ?? 0) - (latest.start[0] ?? 0);
        const dy =
          (latest.end[1] ?? 0) - (latest.start[1] ?? 0);
        const dz =
          (latest.end[2] ?? 0) - (latest.start[2] ?? 0);
        const meters =
          Math.hypot(dx, dy, dz) / latest.unit.metersPerUnit;
        statusOutput.textContent = `last distance ${meters.toFixed(3)} m`;
      }
    });

    statusOutput.textContent = "ready";

    currentCleanup = () => {
      unsubscribeMeasurements();
      disconnect();
      runtime.destroy();
      void adapter.dispose();
    };
  } catch (error) {
    statusOutput.textContent = `error: ${(error as Error).message}`;
  }
}

reloadButton.addEventListener("click", () => {
  void loadSample();
});

void loadSample();
