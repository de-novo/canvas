import {
  type Canvas2DSceneInput,
  type Canvas3DSceneInput
} from "@denovo/canvas-core";
import { CanvasView } from "@denovo/react-canvas";
import { useMemo, useState } from "react";

type DemoMode = "2d" | "3d";

export function App() {
  const [mode, setMode] = useState<DemoMode>("3d");
  const scene = useMemo(
    () => (mode === "3d" ? createThreeScene() : createTwoScene()),
    [mode]
  );

  return (
    <main className="shell">
      <section className="viewport">
        <CanvasView
          className="stage"
          scene={scene}
          style={{ minHeight: 320 }}
        />
      </section>
      <aside className="panel">
        <p className="eyebrow">React</p>
        <h1>React adapter smoke example</h1>
        <p>
          Renders 2D and 3D scenes through <code>@denovo/react-canvas</code>.
        </p>
        <div className="controls">
          <button
            type="button"
            data-denovo-control="swap"
            onClick={() => setMode(mode === "3d" ? "2d" : "3d")}
          >
            Swap scene
          </button>
        </div>
        <p className="mode-readout">
          Mode: <output id="mode-readout">{mode}</output>
        </p>
      </aside>
    </main>
  );
}

function createThreeScene(): Canvas3DSceneInput {
  return {
    id: "react-three",
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
    id: "react-two",
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
