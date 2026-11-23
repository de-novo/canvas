// @ts-check
/**
 * Reproducible Naive vs Denovo Canvas comparative benchmark suite.
 *
 * Measures both 2D (10k & 100k) and 3D (1k & 10k) real-world workloads in
 * Node + headless Chromium and prints a structured comparison table.
 */

import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import { defineDocument, defineScene } from "../packages/core/dist/index.js";
import { createEditor, setNodeVisible } from "../packages/editor/dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4322;

function make2D(count) {
  const cols = Math.ceil(Math.sqrt(count));
  const nodes = new Array(count);
  for (let i = 0; i < count; i += 1) {
    nodes[i] = {
      id: `rect-${i}`,
      layerId: "default",
      type: "rect",
      position: [(i % cols) * 180, Math.floor(i / cols) * 180],
      size: [120, 80],
      fill: i % 2 === 0 ? "#22c55e" : "#38bdf8"
    };
  }
  return {
    id: `bench-2d-${count}`,
    mode: "2d",
    layers: [{ id: "default", name: "Default" }],
    nodes
  };
}

function make3D(count) {
  const cols = Math.ceil(Math.sqrt(count));
  const nodes = new Array(count);
  for (let i = 0; i < count; i += 1) {
    nodes[i] = {
      id: `box-${i}`,
      layerId: "default",
      type: "box",
      position: [(i % cols) * 2.5, 0, Math.floor(i / cols) * 2.5],
      scale: [1, 1, 1],
      color: "#22c55e"
    };
  }
  return {
    id: `bench-3d-${count}`,
    mode: "3d",
    render: { batch: true },
    layers: [{ id: "default", name: "Default" }],
    nodes
  };
}

function startViteServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      [
        "--filter",
        "@denovo/canvas-vanilla-example",
        "exec",
        "vite",
        "--host",
        "127.0.0.1",
        "--port",
        String(PORT)
      ],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"] }
    );
    let output = "";
    const url = `http://127.0.0.1:${PORT}/`;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Vite server did not start:\n${output}`));
    }, 30_000);
    const poll = setInterval(async () => {
      try {
        const res = await fetch(url);
        if (res.ok) {
          clearInterval(poll);
          clearTimeout(timer);
          resolve({ process: child, url });
        }
      } catch {
        // wait
      }
    }, 200);
    child.stdout.on("data", (d) => (output += d.toString()));
    child.stderr.on("data", (d) => (output += d.toString()));
  });
}

// 1. Headless Core & Editor Benchmarks (10k & 100k 2D, 1k & 10k 3D)
const coreResults = {};
for (const count of [10_000, 100_000]) {
  const doc = defineDocument({ id: `doc-${count}`, scene: make2D(count) });
  const editor = createEditor({ document: doc });
  const frozenScene = editor.getState().document.scene;

  const t0 = performance.now();
  for (let i = 0; i < 10; i += 1) defineScene(frozenScene);
  const frozenReDefineMs = (performance.now() - t0) / 10;

  const editSamples = [];
  for (let i = 0; i < 5; i += 1) {
    const s0 = performance.now();
    await editor.apply([setNodeVisible({ nodeId: "rect-0", visible: i % 2 === 1 })]);
    editSamples.push(performance.now() - s0);
  }
  editSamples.sort((a, b) => a - b);
  coreResults[`2d_${count}`] = {
    frozenReDefineMs: Number(frozenReDefineMs.toFixed(3)),
    editorApplyP50Ms: Number(editSamples[Math.floor(editSamples.length * 0.5)].toFixed(2))
  };
}

for (const count of [1_000, 10_000]) {
  const doc = defineDocument({ id: `doc3d-${count}`, scene: make3D(count) });
  const editor = createEditor({ document: doc });
  const editSamples = [];
  for (let i = 0; i < 5; i += 1) {
    const s0 = performance.now();
    await editor.apply([setNodeVisible({ nodeId: "box-0", visible: i % 2 === 1 })]);
    editSamples.push(performance.now() - s0);
  }
  editSamples.sort((a, b) => a - b);
  coreResults[`3d_${count}`] = {
    editorApplyP50Ms: Number(editSamples[Math.floor(editSamples.length * 0.5)].toFixed(2))
  };
}

// 2. Browser Comparative Benchmarks (Naive Canvas2D vs Denovo 2D at 10k & 100k + 3D 10k Batched vs Unbatched)
const harnessPath = path.join(root, "apps/vanilla/bench-compare.html");
writeFileSync(
  harnessPath,
  `<!doctype html>
<html>
<head><meta charset="utf-8" /><style>html,body{margin:0;width:1280px;height:800px;overflow:hidden}#host{width:1280px;height:800px}</style></head>
<body>
  <div id="host"></div>
  <canvas id="naive" width="1280" height="800" style="width:1280px;height:800px;display:none"></canvas>
  <script type="module">
    import { createCanvas, defineDocument, createEditor } from "@denovo/canvas";

    const host = document.getElementById("host");
    const naiveCanvas = document.getElementById("naive");
    const naiveCtx = naiveCanvas.getContext("2d");

    function p50(arr) {
      const s = [...arr].sort((a, b) => a - b);
      return Number(s[Math.floor(s.length * 0.5)].toFixed(2));
    }

    function make2DNodes(count) {
      const cols = Math.ceil(Math.sqrt(count));
      const nodes = new Array(count);
      for (let i = 0; i < count; i += 1) {
        nodes[i] = {
          id: "r-" + i,
          layerId: "default",
          type: "rect",
          position: [(i % cols) * 180, Math.floor(i / cols) * 180],
          size: [120, 80],
          fill: i % 2 === 0 ? "#22c55e" : "#38bdf8"
        };
      }
      return nodes;
    }

    function benchNaive2D(nodes) {
      const panSamples = [];
      for (let f = 0; f < 15; f += 1) {
        const ox = -200 - f * 35;
        const oy = -150 - f * 25;
        const t0 = performance.now();
        naiveCtx.fillStyle = "#0b1220";
        naiveCtx.fillRect(0, 0, 1280, 800);
        naiveCtx.save();
        naiveCtx.translate(ox, oy);
        for (let i = 0; i < nodes.length; i += 1) {
          const n = nodes[i];
          naiveCtx.fillStyle = n.fill;
          naiveCtx.fillRect(n.position[0], n.position[1], n.size[0], n.size[1]);
        }
        naiveCtx.restore();
        panSamples.push(performance.now() - t0);
      }

      const hitStart = performance.now();
      for (let i = 0; i < 200; i += 1) {
        const px = 200 + ((i * 53) % 1200);
        const py = 150 + ((i * 37) % 720);
        for (let j = nodes.length - 1; j >= 0; j -= 1) {
          const n = nodes[j];
          if (px >= n.position[0] && px <= n.position[0] + n.size[0] && py >= n.position[1] && py <= n.position[1] + n.size[1]) {
            break;
          }
        }
      }
      const hitTotalMs = Number((performance.now() - hitStart).toFixed(2));
      return { panP50Ms: p50(panSamples), drawCalls: nodes.length, hit200TotalMs: hitTotalMs };
    }

    async function benchDenovo2D(count) {
      host.innerHTML = "";
      const nodes = make2DNodes(count);
      const naive = benchNaive2D(nodes);
      const doc = defineDocument({
        id: "d2-" + count,
        scene: { id: "s2-" + count, mode: "2d", background: "#0b1220", layers: [{ id: "default", name: "Default" }], nodes }
      });
      const editor = createEditor({ document: doc });
      const frozenScene = editor.getState().document.scene;
      const runtime = createCanvas(host, {
        scene: frozenScene,
        renderer: { backend: "canvas2d" },
        canvas2d: { initialView: { offset: [40, 40], zoom: 1 } }
      });
      await runtime.ready;
      const cur = runtime.current;

      const panSamples = [];
      for (let f = 0; f < 20; f += 1) {
        const t0 = performance.now();
        cur.setViewState({ offset: [-200 - f * 35, -150 - f * 25], zoom: 1 });
        panSamples.push(performance.now() - t0);
      }
      const drawCalls = runtime.getRenderStats()?.drawCalls ?? 0;

      const hitStart = performance.now();
      for (let i = 0; i < 200; i += 1) {
        runtime.hitTest({ point: [40 + ((i * 53) % 1200), 40 + ((i * 37) % 720)] });
      }
      const hitTotalMs = Number((performance.now() - hitStart).toFixed(2));

      cur.setViewState({ offset: [40, 40], zoom: 1 });
      const snapSamples = [];
      let snapCandidates = 0;
      for (let i = 0; i < 10; i += 1) {
        const t0 = performance.now();
        const s = cur.computeSnapGuides({ minX: 183, minY: 184, maxX: 303, maxY: 264 }, { excludeNodeIds: ["r-1"], threshold: 6 });
        snapSamples.push(performance.now() - t0);
        snapCandidates = s.candidateCount;
      }

      const updateSamples = [];
      for (let i = 0; i < 10; i += 1) {
        const nextNodes = frozenScene.nodes.slice();
        nextNodes[0] = { ...frozenScene.nodes[0], position: [40 + i * 20, 40 + i * 10] };
        const t0 = performance.now();
        runtime.update({ ...frozenScene, nodes: nextNodes });
        updateSamples.push(performance.now() - t0);
      }
      const spatialStats = cur.getSpatialIndexStats();
      runtime.destroy();
      return {
        naive,
        denovo: {
          panP50Ms: p50(panSamples),
          drawCalls,
          hit200TotalMs: hitTotalMs,
          snapP50Ms: p50(snapSamples),
          snapCandidates,
          singleNodeUpdateP50Ms: p50(updateSamples),
          syncKind: spatialStats.lastSyncKind
        }
      };
    }

    async function bench3D(count, batch) {
      host.innerHTML = "";
      const cols = Math.ceil(Math.sqrt(count));
      const nodes = new Array(count);
      for (let i = 0; i < count; i += 1) {
        nodes[i] = {
          id: "b-" + i,
          layerId: "default",
          type: "box",
          position: [(i % cols) * 2.2, 0, Math.floor(i / cols) * 2.2],
          scale: [1, 1, 1],
          color: "#22c55e"
        };
      }
      const doc = defineDocument({
        id: "d3-" + count + "-" + batch,
        scene: {
          id: "s3-" + count,
          mode: "3d",
          background: "#0b1220",
          render: { batch },
          layers: [{ id: "default", name: "Default" }],
          nodes
        }
      });
      const editor = createEditor({ document: doc });
      const frozenScene = editor.getState().document.scene;
      const runtime = createCanvas(host, { scene: frozenScene, renderer: { backend: "webgl2" } });
      await runtime.ready;

      const renderSamples = [];
      for (let i = 0; i < 15; i += 1) {
        const t0 = performance.now();
        runtime.render();
        renderSamples.push(performance.now() - t0);
      }
      const stats = runtime.getRenderStats();

      const updateSamples = [];
      for (let i = 0; i < 6; i += 1) {
        const nextNodes = frozenScene.nodes.slice();
        nextNodes[0] = { ...frozenScene.nodes[0], position: [i * 0.5, 1, 0] };
        const t0 = performance.now();
        runtime.update({ ...frozenScene, nodes: nextNodes });
        updateSamples.push(performance.now() - t0);
      }
      runtime.destroy();
      return {
        drawCalls: stats?.drawCalls ?? null,
        geometries: stats?.geometries ?? null,
        renderP50Ms: p50(renderSamples),
        singleNodeUpdateP50Ms: p50(updateSamples)
      };
    }

    async function benchWarehouse3D() {
      host.innerHTML = "";
      // Realistic Warehouse Digital Twin:
      // 20 aisles x 5 rack tiers x 50 slots = 5,000 stacked multi-color pallets
      // + 20 moving AGVs = 5,020 boxes across 5 live status colors.
      const palette = ["#22c55e", "#38bdf8", "#f59e0b", "#ef4444", "#64748b"];
      const nodes = [];
      let idx = 0;
      for (let aisle = 0; aisle < 20; aisle += 1) {
        for (let slot = 0; slot < 50; slot += 1) {
          for (let tier = 0; tier < 5; tier += 1) {
            nodes.push({
              id: "pallet-" + idx,
              layerId: "default",
              type: "box",
              position: [aisle * 4.2, tier * 1.6 + 0.6, slot * 1.5],
              scale: [1.2, 1.1, 1.2],
              color: palette[idx % palette.length]
            });
            idx += 1;
          }
        }
      }
      for (let a = 0; a < 20; a += 1) {
        nodes.push({
          id: "agv-" + a,
          layerId: "default",
          type: "box",
          position: [a * 4.2 + 2.1, 0.35, 10 + a],
          scale: [1.0, 0.5, 1.4],
          color: "#a855f7"
        });
      }
      const doc = defineDocument({
        id: "warehouse-3d",
        scene: {
          id: "warehouse-3d-scene",
          mode: "3d",
          background: "#0b1220",
          render: { batch: true },
          camera: { position: [42, 26, 95], target: [42, 4, 37], fov: 50 },
          layers: [{ id: "default", name: "Default" }],
          nodes
        }
      });
      const editor = createEditor({ document: doc });
      // One-line editor mounting DX!
      const runtime = createCanvas(host, { editor, renderer: { backend: "webgl2" } });
      await runtime.ready;
      const frozenScene = editor.getState().document.scene;

      const renderSamples = [];
      for (let i = 0; i < 15; i += 1) {
        const t0 = performance.now();
        runtime.render();
        renderSamples.push(performance.now() - t0);
      }
      const stats = runtime.getRenderStats();

      // Simulate live warehouse telemetry tick: 50 pallets change status color + 20 AGVs move.
      const telemetrySamples = [];
      for (let tick = 0; tick < 8; tick += 1) {
        const nextNodes = frozenScene.nodes.slice();
        for (let p = 0; p < 50; p += 1) {
          const targetIdx = (tick * 50 + p) % 5000;
          const prev = frozenScene.nodes[targetIdx];
          nextNodes[targetIdx] = { ...prev, color: palette[(tick + p + 1) % palette.length] };
        }
        for (let a = 0; a < 20; a += 1) {
          const agvIdx = 5000 + a;
          const prev = frozenScene.nodes[agvIdx];
          nextNodes[agvIdx] = { ...prev, position: [prev.position[0], 0.35, (prev.position[2] + tick * 0.8) % 70] };
        }
        const t0 = performance.now();
        runtime.update({ ...frozenScene, nodes: nextNodes });
        telemetrySamples.push(performance.now() - t0);
      }
      const postStats = runtime.getRenderStats();
      runtime.destroy();
      return {
        totalPalletsAndAgvs: nodes.length,
        distinctColors: 6,
        drawCalls: stats?.drawCalls ?? null,
        postTelemetryDrawCalls: postStats?.drawCalls ?? null,
        geometries: stats?.geometries ?? null,
        renderP50Ms: p50(renderSamples),
        telemetry50ColorsPlus20AgvsP50Ms: p50(telemetrySamples)
      };
    }

    const r2d10k = await benchDenovo2D(10_000);
    const r2d100k = await benchDenovo2D(100_000);
    const r3dUnbatched = await bench3D(1_000, false);
    const r3dBatched1k = await bench3D(1_000, true);
    const r3dBatched10k = await bench3D(10_000, true);
    const warehouse3d5k = await benchWarehouse3D();
    window.__benchCompare = { r2d10k, r2d100k, r3dUnbatched, r3dBatched1k, r3dBatched10k, warehouse3d5k };
  </script>
</body>
</html>`
);

const server = await startViteServer();
const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=metal", "--enable-webgl"]
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${server.url}bench-compare.html`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__benchCompare), undefined, {
    timeout: 90_000
  });
  const browserResults = await page.evaluate(() => window.__benchCompare);
  console.log(JSON.stringify({ coreResults, browserResults, errors }, null, 2));
} finally {
  await browser.close();
  server.process.kill("SIGTERM");
  if (existsSync(harnessPath)) rmSync(harnessPath, { force: true });
}
