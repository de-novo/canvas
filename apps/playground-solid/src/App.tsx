import {
  type Canvas2DSceneInput,
  type Canvas3DSceneInput
} from "@denovo/canvas-core";
import { DenovoCanvas } from "@denovo/solid-canvas";
import { createSignal } from "solid-js";

type DemoMode = "2d" | "3d";

export function App() {
  const [mode, setMode] = createSignal<DemoMode>("3d");

  const scene = () =>
    mode() === "3d" ? createThreeScene() : createTwoScene();

  return (
    <main class="shell">
      <section class="viewport">
        <DenovoCanvas scene={scene()} hostClass="stage" />
      </section>
      <aside class="panel">
        <p class="eyebrow">Solid</p>
        <h1>Solid adapter smoke example</h1>
        <p>
          Renders 2D and 3D scenes through <code>@denovo/solid-canvas</code>.
        </p>
        <div class="controls">
          <button
            type="button"
            data-denovo-control="swap"
            onClick={() => setMode(mode() === "3d" ? "2d" : "3d")}
          >
            Swap scene
          </button>
        </div>
        <p class="mode-readout">
          Mode: <output id="mode-readout">{mode()}</output>
        </p>
      </aside>
    </main>
  );
}

function createThreeScene(): Canvas3DSceneInput {
  return {
    id: "solid-three",
    mode: "3d",
    layers: [{ id: "main", name: "Main" }],
    background: "#0f172a",
    render: {
      loop: "demand",
      dpr: 1.5,
      frustumCulling: true,
      batch: false
    },
    camera: {
      position: [5, 3.5, 7],
      target: [0, 0, 0],
      fov: 44
    },
    nodes: [
      {
        id: "primary",
        layerId: "main",
        type: "sphere",
        color: "#38bdf8",
        position: [0, 0.4, 0],
        radius: 0.9
      }
    ]
  };
}

function createTwoScene(): Canvas2DSceneInput {
  return {
    id: "solid-two",
    mode: "2d",
    layers: [{ id: "main", name: "Main" }],
    background: "#111827",
    render: {
      loop: "demand",
      dpr: 1.5,
      frustumCulling: true,
      batch: false
    },
    nodes: [
      {
        id: "panel",
        layerId: "main",
        type: "rect",
        fill: "#22c55e",
        position: [96, 96],
        size: [260, 180],
        rotation: 0.08
      },
      {
        id: "badge",
        layerId: "main",
        type: "circle",
        fill: "#38bdf8",
        position: [420, 220],
        radius: 76
      }
    ]
  };
}
