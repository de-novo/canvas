import {
  createCanvas,
  defineDocument,
  type Canvas3DSceneInput,
  type CanvasDocument,
  type DenovoCanvasRuntime
} from "@de-novo/canvas";
import "@de-novo/canvas/styles.css";

type PaletteKey = "rose" | "sakura" | "gold" | "orchid";

const PALETTES: Record<PaletteKey, readonly [string, string, string, string]> = {
  rose: ["#be123c", "#e11d48", "#fb7185", "#fda4af"],
  sakura: ["#db2777", "#ec4899", "#f472b6", "#fbcfe8"],
  gold: ["#b45309", "#d97706", "#f59e0b", "#fde68a"],
  orchid: ["#6d28d9", "#7c3aed", "#a855f7", "#e9d5ff"]
};

type FlowerState = {
  readonly nodeCount: number;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly bloom: number;
  readonly palette: PaletteKey;
  readonly wireframe: boolean;
};

declare global {
  interface Window {
    __flowerDemo?: {
      readonly getState: () => FlowerState;
    };
  }
}

function buildLotusPetalMesh({
  length,
  width,
  elevationRad,
  cup,
  tipDrop,
  radialOffset = 0.18,
  uSegs = 14,
  vSegs = 18
}: {
  readonly length: number;
  readonly width: number;
  readonly elevationRad: number;
  readonly cup: number;
  readonly tipDrop: number;
  readonly radialOffset?: number;
  readonly uSegs?: number;
  readonly vSegs?: number;
}) {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  function evalPt(u: number, v: number): readonly [number, number, number] {
    const profile = Math.pow(Math.sin(Math.pow(v, 0.78) * Math.PI), 0.85);
    const halfW = width * 0.5 * profile;
    const x = u * halfW;
    const s = v * length;
    const localY =
      Math.sin(elevationRad) * s +
      Math.sin(v * Math.PI) * 0.22 -
      Math.pow(v, 2.4) * tipDrop;
    const localZ = radialOffset + Math.cos(elevationRad) * s;
    const cupLift = u * u * cup * profile;
    return [x, localY + cupLift, localZ];
  }

  const eps = 0.005;
  for (let iv = 0; iv <= vSegs; iv += 1) {
    const v = iv / vSegs;
    for (let iu = 0; iu <= uSegs; iu += 1) {
      const u = (iu / uSegs) * 2 - 1;
      const p = evalPt(u, v);
      const pu = evalPt(Math.min(1, u + eps), v);
      const pv = evalPt(u, Math.min(1, v + eps));
      const du = [pu[0] - p[0], pu[1] - p[1], pu[2] - p[2]];
      const dv = [pv[0] - p[0], pv[1] - p[1], pv[2] - p[2]];
      const nx = dv[1]! * du[2]! - dv[2]! * du[1]!;
      const ny = dv[2]! * du[0]! - dv[0]! * du[2]!;
      const nz = dv[0]! * du[1]! - dv[1]! * du[0]!;
      const len = Math.hypot(nx, ny, nz) || 1;
      positions.push(p[0], p[1], p[2]);
      normals.push(nx / len, ny / len, nz / len);
    }
  }

  const stride = uSegs + 1;
  const frontCount = positions.length / 3;
  for (let i = 0; i < frontCount; i += 1) {
    positions.push(positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!);
    normals.push(-normals[i * 3]!, -normals[i * 3 + 1]!, -normals[i * 3 + 2]!);
  }

  for (let iv = 0; iv < vSegs; iv += 1) {
    for (let iu = 0; iu < uSegs; iu += 1) {
      const a = iv * stride + iu;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
      const ba = frontCount + a;
      const bb = frontCount + b;
      const bc = frontCount + c;
      const bd = frontCount + d;
      indices.push(ba, bb, bc, bb, bd, bc);
    }
  }

  return { positions, normals, indices };
}

function buildStemMesh(height = 2.6, rTop = 0.13, rBot = 0.18, segs = 16, rings = 16) {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (let iy = 0; iy <= rings; iy += 1) {
    const t = iy / rings;
    const y = -height * (1 - t);
    const cx = Math.sin(t * Math.PI * 0.7) * 0.18;
    const cz = Math.cos(t * Math.PI * 0.5) * 0.1 - 0.1;
    const r = rBot + (rTop - rBot) * t;
    for (let is = 0; is <= segs; is += 1) {
      const a = (is / segs) * Math.PI * 2;
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      positions.push(cx + nx * r, y, cz + nz * r);
      normals.push(nx, 0, nz);
    }
  }
  const stride = segs + 1;
  for (let iy = 0; iy < rings; iy += 1) {
    for (let is = 0; is < segs; is += 1) {
      const a = iy * stride + is;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  return { positions, normals, indices };
}

const stemGeom = buildStemMesh();
const leafGeom = buildLotusPetalMesh({
  length: 2.35,
  width: 1.25,
  elevationRad: -0.18,
  cup: 0.18,
  tipDrop: 0.45,
  radialOffset: 0.16
});

function buildFlowerDocument(
  bloom: number,
  palette: PaletteKey,
  wireframe: boolean
): CanvasDocument {
  const colors = PALETTES[palette];
  const nodes: NonNullable<Canvas3DSceneInput["nodes"]> = [];

  nodes.push({
    id: "stem",
    layerId: "flower",
    type: "mesh",
    position: [0, 0.05, 0],
    color: "#15803d",
    wireframe,
    ...stemGeom
  });

  for (let i = 0; i < 5; i += 1) {
    const yaw = (i / 5) * Math.PI * 2 + 0.25;
    nodes.push({
      id: `leaf-${i}`,
      layerId: "flower",
      type: "mesh",
      position: [0, -0.25, 0],
      rotation: [0, yaw, 0],
      color: i % 2 === 0 ? "#16a34a" : "#22c55e",
      wireframe,
      ...leafGeom
    });
  }

  // Higher bloom -> lower elevation angle (opens wider); lower bloom -> closed bud!
  const closeShift = (1 - bloom) * 0.72;
  const rings = [
    { count: 9, length: 2.15, width: 1.15, elevationRad: 0.14 + closeShift, cup: 0.24, tipDrop: 0.26 * bloom, radialOffset: 0.22, y: 0.02, color: colors[0], offset: 0 },
    { count: 9, length: 1.92, width: 1.05, elevationRad: 0.42 + closeShift * 0.85, cup: 0.28, tipDrop: 0.18 * bloom, radialOffset: 0.2, y: 0.1, color: colors[1], offset: 0.35 },
    { count: 8, length: 1.62, width: 0.9, elevationRad: 0.72 + closeShift * 0.65, cup: 0.3, tipDrop: 0.12 * bloom, radialOffset: 0.18, y: 0.18, color: colors[2], offset: 0.16 },
    { count: 7, length: 1.28, width: 0.72, elevationRad: 1.02 + closeShift * 0.4, cup: 0.26, tipDrop: 0.06 * bloom, radialOffset: 0.15, y: 0.24, color: colors[3], offset: 0.52 }
  ];

  let pIdx = 0;
  for (const ring of rings) {
    const geom = buildLotusPetalMesh(ring);
    for (let i = 0; i < ring.count; i += 1) {
      const yaw = (i / ring.count) * Math.PI * 2 + ring.offset;
      nodes.push({
        id: `petal-${pIdx++}`,
        layerId: "flower",
        type: "mesh",
        position: [0, ring.y, 0],
        rotation: [0, yaw, 0],
        color: ring.color,
        wireframe,
        ...geom
      });
    }
  }

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < 90; i += 1) {
    const frac = i / 90;
    const r = 0.05 + Math.sqrt(frac) * (0.42 + 0.2 * bloom);
    const theta = i * goldenAngle;
    const y = 0.62 - frac * 0.24 + Math.cos(r * 2.4) * 0.12;
    nodes.push({
      id: `pollen-${i}`,
      layerId: "flower",
      type: "sphere",
      position: [Math.cos(theta) * r, y, Math.sin(theta) * r],
      radius: 0.062 - frac * 0.012,
      color: i < 24 ? "#f59e0b" : i < 60 ? "#facc15" : "#fef08a"
    });
  }

  return defineDocument({
    id: "flower-demo",
    scene: {
      id: "flower-scene",
      mode: "3d",
      background: "#0a0c14",
      render: { batch: true, loop: "demand" },
      camera: { position: [0.6, 3.6, 4.3], target: [0, 0.35, 0], fov: 40 },
      layers: [{ id: "flower", name: "Flower" }],
      nodes
    }
  });
}

const stageEl = document.querySelector<HTMLElement>("#stage")!;
const hudEl = document.querySelector<HTMLElement>("#hud")!;
const bloomSlider = document.querySelector<HTMLInputElement>("#bloom-slider")!;
const paletteSelect = document.querySelector<HTMLSelectElement>("#palette-select")!;
const btnWireframe = document.querySelector<HTMLButtonElement>("#btn-wireframe")!;
const btnSpin = document.querySelector<HTMLButtonElement>("#btn-spin")!;

let bloom = Number(bloomSlider.value);
let palette: PaletteKey = paletteSelect.value as PaletteKey;
let wireframe = false;
let spinning = true;
let orbitAngle = 1.42;
let runtime: DenovoCanvasRuntime | null = null;

function getState(): FlowerState {
  const stats = runtime?.getRenderStats();
  return {
    nodeCount: runtime?.getScene().nodes.length ?? 0,
    drawCalls: stats?.drawCalls ?? 0,
    triangles: stats?.triangles ?? 0,
    bloom,
    palette,
    wireframe
  };
}

function updateHud() {
  const s = getState();
  hudEl.innerHTML = [
    `<div><strong>Nodes</strong>: ${s.nodeCount} (39 parametric meshes + 90 batched spheres)</div>`,
    `<div><strong>Triangles</strong>: ${s.triangles.toLocaleString()}</div>`,
    `<div><strong>drawCalls</strong>: ${s.drawCalls}</div>`,
    `<div><strong>Bloom</strong>: ${Math.round(s.bloom * 100)}% · <strong>Palette</strong>: ${s.palette}</div>`
  ].join("");
}

function rebuildFlower() {
  if (!runtime) return;
  const doc = buildFlowerDocument(bloom, palette, wireframe);
  runtime.update(doc.scene);
  updateHud();
}

function tickSpin() {
  if (spinning && runtime) {
    const cur = runtime.current;
    if (cur.mode === "3d" && "camera" in cur) {
      orbitAngle += 0.008;
      const r = 4.6;
      cur.camera.position.set(
        Math.cos(orbitAngle) * r,
        3.2 + Math.sin(orbitAngle * 1.5) * 0.45,
        Math.sin(orbitAngle) * r
      );
      cur.camera.lookAt(0, 0.35, 0);
      cur.camera.updateProjectionMatrix();
      runtime.render();
    }
  }
  requestAnimationFrame(tickSpin);
}

bloomSlider.addEventListener("input", () => {
  bloom = Number(bloomSlider.value);
  rebuildFlower();
});
paletteSelect.addEventListener("change", () => {
  palette = paletteSelect.value as PaletteKey;
  rebuildFlower();
});
btnWireframe.addEventListener("click", () => {
  wireframe = !wireframe;
  btnWireframe.textContent = `Wireframe: ${wireframe ? "ON" : "OFF"}`;
  btnWireframe.classList.toggle("active", wireframe);
  rebuildFlower();
});
btnSpin.addEventListener("click", () => {
  spinning = !spinning;
  btnSpin.textContent = `Turntable: ${spinning ? "ON" : "OFF"}`;
  btnSpin.classList.toggle("active", spinning);
});

window.__flowerDemo = { getState };

void (async () => {
  runtime = createCanvas(stageEl, {
    document: buildFlowerDocument(bloom, palette, wireframe),
    renderer: { backend: "webgl2" }
  });
  await runtime.ready;
  runtime.render();
  updateHud();
  requestAnimationFrame(tickSpin);
})();
