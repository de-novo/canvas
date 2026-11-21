// @ts-check
/**
 * 2D canvas performance measurement and regression gate.
 *
 * Benchmarks large 2D scenes (1k / 10k rects + 1k HTML overlays) through the
 * real `@denovo/canvas` facade in Chromium:
 * - pan/zoom render latency (viewport culling effectiveness)
 * - hitTest latency (spatial index vs linear scan)
 * - getNodesInBounds marquee query latency
 * - overlay sync latency (O(1) lookup + viewport culling vs O(N^2))
 * - correctness parity (topmost z-order hit, empty hit, exact marquee set, non-blank pixels)
 *
 * Pass `--measure-only` to capture baseline metrics without enforcing gates.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  launchGpuWebGpuChromium,
  launchPixelChromium
} from "./lib/chromium.mjs";

const MEASURE_ONLY = process.argv.includes("--measure-only");
const REPORT_PATH = "artifacts/verification/performance-2d-report.json";
const PERF_HTML = "apps/vanilla/perf-2d-bench.html";
const PORT = 5189;

const WORKLOADS = [
  { label: "1k-2d-rects", kind: "rects", backend: "canvas2d", nodeCount: 1_000, cols: 50 },
  { label: "10k-2d-rects", kind: "rects", backend: "canvas2d", nodeCount: 10_000, cols: 100 },
  { label: "1k-2d-overlays", kind: "html", backend: "canvas2d", nodeCount: 1_000, cols: 50 },
  { label: "10k-2d-webgpu", kind: "rects", backend: "webgpu", nodeCount: 10_000, cols: 100 }
];

const server = await startViteServer();
const report = {
  measuredAt: new Date().toISOString(),
  workloads: /** @type {any[]} */ ([])
};

try {
  await writeFile(PERF_HTML, perf2DBenchHtml());
  const pixelBrowser = await launchPixelChromium();
  const webgpuBrowser = await launchGpuWebGpuChromium();
  try {
    for (const workload of WORKLOADS) {
      const browser = workload.backend === "webgpu" ? webgpuBrowser : pixelBrowser;
      const result = await measureWorkload(browser, server.url, workload);
      report.workloads.push(result);
      console.log(
        `[perf-2d] ${result.label}: ` +
          `panRender p50=${result.panRenderMs.p50.toFixed(2)}ms p95=${result.panRenderMs.p95.toFixed(2)}ms, ` +
          `hitTest p50=${result.hitTestMs.p50.toFixed(3)}ms (${result.hitTestTotalMs.toFixed(1)}ms/${result.hitTestCalls}), ` +
          `marquee p50=${result.marqueeMs.p50.toFixed(3)}ms, ` +
          `drawCalls=${result.drawCalls ?? "n/a"}, ` +
          `triangles=${result.triangles ?? "n/a"}, ` +
          `nonBlank=${result.nonBlank}`
      );
    }
  } finally {
    await Promise.all([pixelBrowser.close(), webgpuBrowser.close()]);
  }
} finally {
  server.process.kill("SIGTERM");
  await rm(PERF_HTML, { force: true });
}

await mkdir(path.dirname(REPORT_PATH), { recursive: true });
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

if (!MEASURE_ONLY) {
  const tenK = report.workloads.find((item) => item.label === "10k-2d-rects");
  assert.ok(tenK, "10k-2d-rects workload missing");
  // Viewport culling gate: a 1280x800 viewport over a 100x100 grid (cell pitch 180)
  // sees at most ~80 rects; drawCalls must stay far below total nodeCount.
  assert.ok(
    typeof tenK.drawCalls === "number" && tenK.drawCalls > 0 && tenK.drawCalls < 500,
    `expected culled 10k-2d-rects drawCalls in (0, 500), got ${tenK.drawCalls}`
  );
  // Frame budget gate: 10k 2D pan render stays well under 16 ms (60 fps)
  // and spatial hit-test stays under 1 ms per query.
  assert.ok(
    tenK.panRenderMs.p50 < 16,
    `expected 10k-2d-rects panRender p50 < 16ms, got ${tenK.panRenderMs.p50.toFixed(2)}ms`
  );
  assert.ok(
    tenK.hitTestMs.p50 < 1,
    `expected 10k-2d-rects hitTest p50 < 1ms, got ${tenK.hitTestMs.p50.toFixed(3)}ms`
  );
  assert.ok(
    tenK.marqueeMs.p50 < 2,
    `expected 10k-2d-rects marquee p50 < 2ms, got ${tenK.marqueeMs.p50.toFixed(3)}ms`
  );

  const overlays = report.workloads.find((item) => item.label === "1k-2d-overlays");
  assert.ok(overlays, "1k-2d-overlays workload missing");
  assert.ok(
    overlays.panRenderMs.p50 < 16,
    `expected 1k-2d-overlays panRender p50 < 16ms, got ${overlays.panRenderMs.p50.toFixed(2)}ms`
  );
  // HTML overlay diff gate: editing 1 card in a 1k-card scene must invoke
  // renderNode only once (for the edited card), not for all 1,001 cards.
  assert.equal(
    overlays.singleCardEditRenderNodeCalls,
    1,
    `expected 1 renderNode call on 1-card edit in 1k-card scene, got ${overlays.singleCardEditRenderNodeCalls}`
  );
  console.log(
    `[perf-2d] HTML overlay diff passed: 1-card edit in 1,001 cards -> ${overlays.singleCardEditRenderNodeCalls} renderNode call`
  );

  const webgpuTenK = report.workloads.find((item) => item.label === "10k-2d-webgpu");
  assert.ok(webgpuTenK, "10k-2d-webgpu workload missing");
  // Spatial culling + GPU-resident caching must keep 10k 2D WebGPU pan well under 16ms
  // and triangles far below the unculled 20,002 triangles (2 triangles per rect).
  assert.ok(
    webgpuTenK.panRenderMs.p50 < 4,
    `expected 10k-2d-webgpu panRender p50 < 4ms, got ${webgpuTenK.panRenderMs.p50.toFixed(2)}ms`
  );
  assert.ok(
    typeof webgpuTenK.triangles === "number" &&
      webgpuTenK.triangles > 0 &&
      webgpuTenK.triangles < 2_000,
    `expected culled 10k-2d-webgpu triangles in (0, 2000), got ${webgpuTenK.triangles}`
  );
  assert.ok(
    webgpuTenK.hitTestMs.p50 < 1,
    `expected 10k-2d-webgpu hitTest p50 < 1ms, got ${webgpuTenK.hitTestMs.p50.toFixed(3)}ms`
  );

  for (const item of report.workloads) {
    assert.equal(item.topmostHitOk, true, `${item.label}: topmost z-order hit failed`);
    assert.equal(item.emptyHitOk, true, `${item.label}: empty hit failed`);
    assert.equal(item.marqueeParityOk, true, `${item.label}: marquee parity failed`);
    if (item.kind === "rects") {
      assert.equal(item.nonBlank, true, `${item.label}: expected non-blank canvas`);
    }
  }
  // rAF coalescing gate: a synchronous burst of 20 wheel pan events in one frame
  // must coalesce into at most 1-2 actual Canvas2D renders instead of 20, while
  // still updating viewState by the full accumulated pan delta.
  assert.ok(
    typeof tenK.burstCoalesceRenders === "number" &&
      tenK.burstCoalesceRenders >= 1 &&
      tenK.burstCoalesceRenders <= 2,
    `expected 20-event wheel burst to coalesce into 1..2 renders, got ${tenK.burstCoalesceRenders}`
  );
  assert.equal(
    tenK.burstCoalesceViewMoved,
    true,
    "expected coalesced wheel burst to apply accumulated pan delta"
  );
  console.log(
    `[perf-2d] rAF burst coalescing passed: 20 wheel events -> ${tenK.burstCoalesceRenders} render(s)`
  );
  console.log("[perf-2d] all 2D culling, spatial-index, WebGPU caching, rAF coalescing, and correctness gates passed");
}

/**
 * @param {import("playwright").Browser} browser
 * @param {string} baseUrl
 * @param {{ label: string, kind: string, backend: string, nodeCount: number, cols: number }} workload
 */
async function measureWorkload(browser, baseUrl, workload) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 }
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  try {
    const url = `${baseUrl}perf-2d-bench.html?kind=${workload.kind}&backend=${workload.backend}&count=${workload.nodeCount}&cols=${workload.cols}`;
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForFunction(
      // @ts-ignore
      () => Boolean(window.__perf2dResult),
      undefined,
      { timeout: 120_000 }
    );
    const result = await page.evaluate(
      // @ts-ignore
      () => window.__perf2dResult
    );
    assert.deepEqual(errors, [], `browser errors in ${workload.label}: ${errors.join("; ")}`);
    return {
      ...workload,
      ...result
    };
  } finally {
    await page.close();
  }
}

function perf2DBenchHtml() {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>perf-2d-bench</title></head>
<body style="margin:0;background:#070b14;">
  <div id="stage" style="position:fixed;inset:0;"></div>
  <script type="module">
    import { createCanvas } from "@denovo/canvas";

    const params = new URLSearchParams(location.search);
    const kind = params.get("kind") || "rects";
    const backend = params.get("backend") || "canvas2d";
    const count = Number(params.get("count") || "1000");
    const cols = Number(params.get("cols") || "50");
    const pitch = 180;
    const size = 120;
    const host = document.getElementById("stage");

    const nodes = [];
    for (let i = 0; i < count; i += 1) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * pitch;
      const y = row * pitch;
      if (kind === "html") {
        nodes.push({
          id: \`card-\${i}\`,
          layerId: "default",
          type: "html",
          position: [x, y],
          width: size,
          height: 80,
          html: \`Card \${i}\`
        });
      } else {
        nodes.push({
          id: \`rect-\${i}\`,
          layerId: "default",
          type: "rect",
          position: [x, y],
          size: [size, 80],
          fill: i % 2 === 0 ? "#22c55e" : "#38bdf8"
        });
      }
    }
    // Add an overlapping top node over node 0 to prove topmost z-order parity.
    const overlapId = "top-overlap";
    nodes.push(
      kind === "html"
        ? {
            id: overlapId,
            layerId: "default",
            type: "html",
            position: [20, 10],
            width: 80,
            height: 60,
            html: "Top"
          }
        : {
            id: overlapId,
            layerId: "default",
            type: "rect",
            position: [20, 10],
            size: [80, 60],
            fill: "#f59e0b"
          }
    );

    let renderNodeCalls = 0;
    const runtime = createCanvas(host, {
      canvas2d: {
        initialView: { offset: [40, 40], zoom: 1 },
        minimap: kind === "rects" && backend === "canvas2d" ? { position: "bottom-right" } : undefined,
        navigation: { enablePan: true, enableZoom: true }
      },
      renderer: { backend },
      renderNode:
        kind === "html"
          ? (node) => {
              renderNodeCalls += 1;
              return node.type === "html" ? node.html : "";
            }
          : undefined,
      scene: {
        id: "perf-2d",
        mode: "2d",
        background: "#0b1220",
        layers: [{ id: "default", name: "Default" }],
        nodes
      }
    });

    await runtime.ready;
    const current = runtime.current;

    function percentile(sorted, p) {
      if (sorted.length === 0) return 0;
      const idx = Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)));
      return sorted[idx];
    }

    // Correctness checks at origin view (offset [40, 40], zoom 1):
    // Scene point (50, 30) -> canvas point (90, 70) hits top-overlap over node 0.
    const topHit = runtime.hitTest({ point: [90, 70] });
    const topmostHitOk = topHit.kind === "node" && topHit.nodeId === overlapId;
    // Scene point (150, 140) -> canvas point (190, 180) is in the gap between rects.
    const emptyHit = runtime.hitTest({ point: [190, 180] });
    const emptyHitOk = emptyHit.kind === "empty";

    // Marquee parity: bounds covering cols 0..2, rows 0..1 -> 6 grid nodes + top-overlap = 7 nodes.
    const queryBounds = { minX: -10, minY: -10, maxX: 2 * pitch + size + 10, maxY: 1 * pitch + 80 + 10 };
    const marqueeIds = current.getNodesInBounds(queryBounds);
    const expectedIds = new Set([overlapId]);
    for (let r = 0; r <= 1; r += 1) {
      for (let c = 0; c <= 2; c += 1) {
        const idx = r * cols + c;
        if (idx < count) {
          expectedIds.add(kind === "html" ? \`card-\${idx}\` : \`rect-\${idx}\`);
        }
      }
    }
    const marqueeSet = new Set(marqueeIds);
    const marqueeParityOk =
      marqueeSet.size === expectedIds.size &&
      [...expectedIds].every((id) => marqueeSet.has(id));

    // Check non-blank canvas pixels for rect workloads.
    let nonBlank = false;
    if (backend === "webgpu") {
      const pixels = await runtime.readPixels();
      const data = pixels.data;
      const first = \`\${data[0]},\${data[1]},\${data[2]}\`;
      for (let i = 0; i < data.length; i += 64) {
        if (\`\${data[i]},\${data[i + 1]},\${data[i + 2]}\` !== first) {
          nonBlank = true;
          break;
        }
      }
    } else {
      const canvas = host.querySelector("canvas");
      if (canvas instanceof HTMLCanvasElement) {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const first = \`\${data[0]},\${data[1]},\${data[2]}\`;
          for (let i = 0; i < data.length; i += 64) {
            if (\`\${data[i]},\${data[i + 1]},\${data[i + 2]}\` !== first) {
              nonBlank = true;
              break;
            }
          }
        }
      }
    }

    // Warmup pan renders
    for (let i = 0; i < 5; i += 1) {
      current.setViewState({ offset: [-i * 40, -i * 20], zoom: 1 });
    }

    // Measure 30 pan renders
    const panSamples = [];
    for (let i = 0; i < 30; i += 1) {
      const t0 = performance.now();
      current.setViewState({ offset: [-200 - i * 35, -150 - i * 25], zoom: 1 });
      panSamples.push(performance.now() - t0);
    }
    const finalStats = runtime.getRenderStats();
    const drawCalls = finalStats?.drawCalls ?? null;
    const triangles = finalStats?.triangles ?? null;

    // Measure 200 hitTest calls across the viewport
    const hitCalls = 200;
    const hitSamples = [];
    const hitStart = performance.now();
    for (let i = 0; i < hitCalls; i += 1) {
      const px = 40 + ((i * 53) % 1200);
      const py = 40 + ((i * 37) % 720);
      const t0 = performance.now();
      runtime.hitTest({ point: [px, py] });
      hitSamples.push(performance.now() - t0);
    }
    const hitTestTotalMs = performance.now() - hitStart;

    // Measure 50 marquee getNodesInBounds calls
    const marqueeSamples = [];
    for (let i = 0; i < 50; i += 1) {
      const bx = 200 + (i % 10) * 180;
      const by = 200 + Math.floor(i / 10) * 180;
      const t0 = performance.now();
      current.getNodesInBounds({ minX: bx, minY: by, maxX: bx + 600, maxY: by + 400 });
      marqueeSamples.push(performance.now() - t0);
    }

    panSamples.sort((a, b) => a - b);
    hitSamples.sort((a, b) => a - b);
    marqueeSamples.sort((a, b) => a - b);

    // Measure rAF coalescing for a 20-event wheel burst in one synchronous turn
    // on Canvas2D (counting background fillRect clears).
    let burstCoalesceRenders = null;
    let burstCoalesceViewMoved = null;
    if (backend === "canvas2d") {
      const stageCanvas = host.querySelector("canvas");
      const stageCtx = stageCanvas instanceof HTMLCanvasElement ? stageCanvas.getContext("2d") : null;
      if (stageCanvas && stageCtx) {
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const beforeMinX = current.getVisibleBounds().minX;
        let clearCount = 0;
        const origFillRect = stageCtx.fillRect.bind(stageCtx);
        const w = stageCanvas.clientWidth;
        const h = stageCanvas.clientHeight;
        stageCtx.fillRect = (x, y, rw, rh) => {
          if (x === 0 && y === 0 && Math.abs(rw - w) <= 1 && Math.abs(rh - h) <= 1) {
            clearCount += 1;
          }
          return origFillRect(x, y, rw, rh);
        };
        for (let i = 0; i < 20; i += 1) {
          stageCanvas.dispatchEvent(
            new WheelEvent("wheel", {
              bubbles: true,
              cancelable: true,
              clientX: 300,
              clientY: 300,
              deltaMode: 0,
              deltaX: 12,
              deltaY: 0
            })
          );
        }
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        stageCtx.fillRect = origFillRect;
        burstCoalesceRenders = clearCount;
        const afterMinX = current.getVisibleBounds().minX;
        burstCoalesceViewMoved = Math.abs(afterMinX - (beforeMinX + 240)) < 1;
      }
    }

    // For HTML overlays, verify editing 1 card out of 1,001 only invokes renderNode once.
    let singleCardEditRenderNodeCalls = null;
    if (kind === "html") {
      const beforeCalls = renderNodeCalls;
      const updatedNodes = nodes.map((node, index) =>
        index === 0 ? { ...node, html: "Updated Card 0" } : { ...node }
      );
      runtime.update({
        id: "perf-2d",
        mode: "2d",
        background: "#0b1220",
        layers: [{ id: "default", name: "Default" }],
        nodes: updatedNodes
      });
      singleCardEditRenderNodeCalls = renderNodeCalls - beforeCalls;
    }

    window.__perf2dResult = {
      burstCoalesceRenders,
      burstCoalesceViewMoved,
      drawCalls,
      emptyHitOk,
      hitTestCalls: hitCalls,
      hitTestMs: {
        p50: percentile(hitSamples, 0.5),
        p95: percentile(hitSamples, 0.95)
      },
      hitTestTotalMs,
      marqueeMs: {
        p50: percentile(marqueeSamples, 0.5),
        p95: percentile(marqueeSamples, 0.95)
      },
      marqueeParityOk,
      nonBlank,
      panRenderMs: {
        p50: percentile(panSamples, 0.5),
        p95: percentile(panSamples, 0.95)
      },
      singleCardEditRenderNodeCalls,
      topmostHitOk,
      triangles
    };
  </script>
</body>
</html>`;
}

function startViteServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      ["--filter", "@denovo/canvas-vanilla-example", "exec", "vite", "--host", "127.0.0.1", "--port", String(PORT)],
      { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] }
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
        // keep polling
      }
    }, 200);
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("exit", (code) => {
      clearInterval(poll);
      clearTimeout(timer);
      reject(new Error(`Vite server exited ${code}:\n${output}`));
    });
  });
}
