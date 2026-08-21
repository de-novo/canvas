import {
  connectEditorToCanvas,
  createCanvas,
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
const reloadButton = requireElement<HTMLButtonElement>("#reload");

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
    editor.registerTool(selectTool);
    editor.registerTool(panOrbitTool);
    editor.activateTool("bim.tool.pan-orbit");

    statusOutput.textContent = "ready";

    currentCleanup = () => {
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
