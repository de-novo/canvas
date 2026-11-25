// @ts-check
/**
 * M4 Performance measurement plus the labeled 16 ms frame-budget gate.
 *
 * Writes a temporary Vite-served HTML page into the vanilla example, builds
 * large instanced 3D scenes (100 / 1k / 10k boxes), and captures frame timing
 * plus WebGL render stats. Draw-call batching is always gated. The 16 ms
 * 1k-boxes budget is measured on a hardware GPU (ANGLE Metal/D3D/Vulkan)
 * for WebGL2 and again for explicit 3D WebGPU. Software GL fails the
 * run: the budget must bite.
 *
 * Output: a JSON report at artifacts/verification/performance-report.json.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";

import { launchGpuChromium, launchGpuWebGpuChromium } from "./lib/chromium.mjs";
import {
  FRAME_BUDGET_MS,
  FRAME_BUDGET_WORKLOAD,
  classifyGlRenderer,
  evaluateFrameBudget
} from "./lib/frame-budget.mjs";

assert.equal(classifyGlRenderer("Google SwiftShader"), "software");
assert.equal(
  classifyGlRenderer("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))"),
  "software"
);
assert.equal(classifyGlRenderer(""), "unknown");
{
  const software = evaluateFrameBudget({
    kind: "software",
    p50: 44,
    workload: FRAME_BUDGET_WORKLOAD
  });
  assert.equal(software.gated, false);
  assert.equal(software.passed, true);
  const over = evaluateFrameBudget({
    kind: "gpu",
    p50: 17,
    workload: FRAME_BUDGET_WORKLOAD
  });
  assert.equal(over.gated, true);
  assert.equal(over.passed, false);
  const under = evaluateFrameBudget({
    kind: "gpu",
    p50: 15,
    workload: FRAME_BUDGET_WORKLOAD
  });
  assert.equal(under.gated, true);
  assert.equal(under.passed, true);
  const other = evaluateFrameBudget({
    kind: "gpu",
    p50: 40,
    workload: "100-boxes"
  });
  assert.equal(other.gated, false);
  const skipped = evaluateFrameBudget({
    kind: "software",
    p50: 44,
    requireGpu: true,
    workload: FRAME_BUDGET_WORKLOAD
  });
  assert.equal(skipped.gated, true);
  assert.equal(skipped.passed, false);
  assert.equal(skipped.reason, "gpu-required-software");
}

const WORKLOADS = [
  { label: "100-boxes", nodeCount: 100, primitive: "box" },
  { label: "1k-boxes", nodeCount: 1_000, primitive: "box" },
  { label: "10k-boxes", nodeCount: 10_000, primitive: "box" },
  { label: "1k-spheres", nodeCount: 1_000, primitive: "sphere" }
];

const CAPTURE_FRAMES = 30;
const REPORT_PATH = "artifacts/verification/performance-report.json";
const PERF_HTML = "apps/vanilla/perf-bench.html";

const server = await startViteServer();
/** @type {{ environment: any, frameBudget: any, webgpuFrameBudget: any, workloads: any[], webgpuWorkloads: any[] }} */
const report = {
  environment: null,
  frameBudget: null,
  webgpuFrameBudget: null,
  workloads: [],
  webgpuWorkloads: []
};

try {
  for (const workload of WORKLOADS) {
    const result = await measureWorkload(server.url, workload, "webgl2");
    report.environment ??= result.environment ?? null;
    report.workloads.push(result);
    console.log(
      `[perf] ${workload.label}: ` +
        `backend=${result.backend ?? "unknown"} ` +
        `frame p50=${result.frameTimeMs.p50.toFixed(2)}ms ` +
        `p95=${result.frameTimeMs.p95.toFixed(2)}ms, ` +
        `drawCalls=${result.renderStats.drawCalls}, ` +
        `geometries=${result.renderStats.geometries}` +
        (result.contextLostCount > 0
          ? `, contextLost=${result.contextLostCount}`
          : "")
    );
  }
  const webgpuOneK = await measureWorkload(
    server.url,
    { label: "1k-boxes", nodeCount: 1_000 },
    "webgpu"
  );
  report.webgpuWorkloads.push(webgpuOneK);
  console.log(
    `[perf] webgpu ${webgpuOneK.label}: ` +
      `backend=${webgpuOneK.backend ?? "unknown"} ` +
      `frame p50=${webgpuOneK.frameTimeMs.p50.toFixed(2)}ms ` +
      `p95=${webgpuOneK.frameTimeMs.p95.toFixed(2)}ms, ` +
      `drawCalls=${webgpuOneK.renderStats.drawCalls}, ` +
      `geometries=${webgpuOneK.renderStats.geometries}`
  );
} finally {
  await stopServer(server.process);
  await rm(PERF_HTML, { force: true });
}

// Hard gate: the bench scene runs with `batch: true`, so every workload must
// render through one batched draw call. The 16 ms budget is a second gate
// on the GPU 1k-boxes p50.
for (const workload of report.workloads) {
  if (workload.renderStats.drawCalls !== 1) {
    throw new Error(
      `[perf] batching gate failed for ${workload.label}: ` +
        `expected drawCalls=1, got ${workload.renderStats.drawCalls}`
    );
  }
}
console.log("[perf] batching gate passed: drawCalls=1 across all workloads");

const rendererName = report.environment?.renderer ?? "";
const kind = classifyGlRenderer(rendererName);
const oneK = report.workloads.find((workload) => workload.label === FRAME_BUDGET_WORKLOAD);
if (!oneK) {
  throw new Error(`[perf] missing ${FRAME_BUDGET_WORKLOAD} workload`);
}
const bite = evaluateFrameBudget({
  kind: "gpu",
  p50: oneK.frameTimeMs.p50,
  targetMs: 0,
  workload: FRAME_BUDGET_WORKLOAD
});
assert.equal(bite.passed, false, "a 0 ms ceiling must fail the live 1k-boxes p50");

const frameBudget = evaluateFrameBudget({
  kind,
  p50: oneK.frameTimeMs.p50,
  requireGpu: true,
  targetMs: FRAME_BUDGET_MS,
  workload: FRAME_BUDGET_WORKLOAD
});
report.frameBudget = {
  ...frameBudget,
  kind,
  p50: oneK.frameTimeMs.p50,
  renderer: rendererName,
  requireGpu: true,
  targetMs: FRAME_BUDGET_MS,
  userAgent: report.environment?.userAgent ?? "",
  vendor: report.environment?.vendor ?? "",
  workload: FRAME_BUDGET_WORKLOAD
};
console.log(
  `[perf] frame budget: gated=${frameBudget.gated} passed=${frameBudget.passed} ` +
    `kind=${kind} p50=${oneK.frameTimeMs.p50.toFixed(2)}ms target=${FRAME_BUDGET_MS}ms ` +
    `renderer=${rendererName || "unknown"}`
);
if (frameBudget.gated && !frameBudget.passed) {
  throw new Error(
    `[perf] 16ms frame budget failed for ${FRAME_BUDGET_WORKLOAD}: ` +
      `p50=${oneK.frameTimeMs.p50.toFixed(2)}ms kind=${kind} ` +
      `reason=${frameBudget.reason} renderer=${rendererName || "unknown"}`
  );
}

const webgpuOneK = report.webgpuWorkloads.find(
  (workload) => workload.label === FRAME_BUDGET_WORKLOAD
);
if (!webgpuOneK) {
  throw new Error(`[perf] missing webgpu ${FRAME_BUDGET_WORKLOAD} workload`);
}
if (webgpuOneK.backend !== "webgpu") {
  throw new Error(
    `[perf] 1k-boxes webgpu must stay on webgpu, got ${webgpuOneK.backend}`
  );
}
const webgpuRenderer = webgpuOneK.environment?.renderer ?? "";
const webgpuKind = classifyGlRenderer(webgpuRenderer);
const webgpuBite = evaluateFrameBudget({
  kind: "gpu",
  p50: webgpuOneK.frameTimeMs.p50,
  targetMs: 0,
  workload: FRAME_BUDGET_WORKLOAD
});
assert.equal(
  webgpuBite.passed,
  false,
  "a 0 ms ceiling must fail the live webgpu 1k-boxes p50"
);
const webgpuFrameBudget = evaluateFrameBudget({
  kind: webgpuKind,
  p50: webgpuOneK.frameTimeMs.p50,
  requireGpu: true,
  targetMs: FRAME_BUDGET_MS,
  workload: FRAME_BUDGET_WORKLOAD
});
report.webgpuFrameBudget = {
  ...webgpuFrameBudget,
  backend: webgpuOneK.backend,
  drawCalls: webgpuOneK.renderStats.drawCalls,
  kind: webgpuKind,
  p50: webgpuOneK.frameTimeMs.p50,
  renderer: rendererName,
  requireGpu: true,
  targetMs: FRAME_BUDGET_MS,
  workload: FRAME_BUDGET_WORKLOAD
};
console.log(
  `[perf] webgpu frame budget: gated=${webgpuFrameBudget.gated} ` +
    `passed=${webgpuFrameBudget.passed} kind=${kind} ` +
    `p50=${webgpuOneK.frameTimeMs.p50.toFixed(2)}ms target=${FRAME_BUDGET_MS}ms ` +
    `drawCalls=${webgpuOneK.renderStats.drawCalls} ` +
    `renderer=${webgpuRenderer || "unknown"}`
);
if (webgpuFrameBudget.gated && !webgpuFrameBudget.passed) {
  throw new Error(
    `[perf] 16ms webgpu frame budget failed for ${FRAME_BUDGET_WORKLOAD}: ` +
      `p50=${webgpuOneK.frameTimeMs.p50.toFixed(2)}ms kind=${webgpuKind} ` +
      `reason=${webgpuFrameBudget.reason} renderer=${webgpuRenderer || "unknown"}`
  );
}

await mkdir("artifacts/verification", { recursive: true });
await writeFile(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");
console.log(`[perf] report written to ${REPORT_PATH}`);

/**
 * @param {string} baseUrl
 * @param {{ label: string; nodeCount: number }} workload
 * @param {"webgl2" | "webgpu"} backend
 */
async function measureWorkload(baseUrl, workload, backend) {
  const primitive = workload.primitive ?? "box";
  const url = `${baseUrl}perf-bench.html?count=${workload.nodeCount}&frames=${CAPTURE_FRAMES}&backend=${backend}&primitive=${primitive}`;
  await writeFile(PERF_HTML, perfBenchHtml());

  const browser =
    backend === "webgpu"
      ? await launchGpuWebGpuChromium()
      : await launchGpuChromium();
  try {
    const page = await browser.newPage({
      viewport: { height: 800, width: 1280 }
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        console.log(`[browser error] ${message.text()}`);
      }
    });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForFunction(
      // @ts-ignore — __perfResult is set by the injected page script
      () => Boolean(window.__perfResult),
      undefined,
      { timeout: 180_000 }
    );
    const samples = await page.evaluate(
      // @ts-ignore — __perfResult is set by the injected page script
      () => window.__perfResult
    );

    const deltas = samples.collected
      .map((sample) => sample.delta)
      .filter((delta) => Number.isFinite(delta) && delta > 0)
      .sort((a, b) => a - b);

    return {
      label: workload.label,
      nodeCount: workload.nodeCount,
      backend: samples.backend ?? null,
      environment: samples.environment ?? null,
      sceneNodeCount: samples.sceneNodeCount,
      threeChildCount: samples.threeChildCount,
      contextLostCount: samples.contextLostCount,
      frameTimeMs: {
        p50: percentile(deltas, 0.5),
        p95: percentile(deltas, 0.95),
        p99: percentile(deltas, 0.99),
        min: deltas[0] ?? 0,
        max: deltas[deltas.length - 1] ?? 0,
        sampleCount: deltas.length
      },
      renderStats: {
        drawCalls: samples.finalStats?.drawCalls ?? 0,
        triangles: samples.finalStats?.triangles ?? 0,
        geometries: samples.finalStats?.geometries ?? 0,
        textures: samples.finalStats?.textures ?? 0,
        programs: samples.finalStats?.programs ?? 0
      }
    };
  } finally {
    await browser.close();
  }
}

function perfBenchHtml() {
  return [
    "<!DOCTYPE html>",
    "<html>",
    "<head><meta charset=\"utf-8\" /><title>perf-bench</title></head>",
    "<body>",
    "  <div id=\"stage\" style=\"position:fixed;inset:0;\"></div>",
    "  <script type=\"module\">",
    "    import { createCanvas } from \"@de-novo/canvas\";",
    "    const params = new URLSearchParams(location.search);",
    "    const count = Number(params.get(\"count\") || \"1000\");",
    "    const primitive = params.get(\"primitive\") || \"box\";",
    "    const captureFrames = Number(params.get(\"frames\") || \"120\");",
    "    const host = document.getElementById(\"stage\");",
    "    let contextLostCount = 0;",
    "    const nodes = [];",
    "    for (let i = 0; i < count; i += 1) {",
    "      if (primitive === \"sphere\") {",
    "        nodes.push({",
    "          id: `sphere-${i}`,",
    "          layerId: \"default\",",
    "          type: \"sphere\",",
    "          color: \"#38bdf8\",",
    "          radius: 0.45 + (i % 3) * 0.08,",
    "          position: [(i % 32) - 16, 0, Math.floor(i / 32) - 16],",
    "        });",
    "      } else {",
    "        nodes.push({",
    "          id: `box-${i}`,",
    "          layerId: \"default\",",
    "          type: \"box\",",
    "          color: \"#22c55e\",",
    "          position: [(i % 32) - 16, 0, Math.floor(i / 32) - 16],",
    "        });",
    "      }",
    "    }",
    "    const collected = [];",
    "    const requestedBackend = params.get(\"backend\") || \"webgl2\";",
    "    const runtime = createCanvas(host, {",
    "      renderer: { backend: requestedBackend },",
    "      scene: {",
    "        id: \"perf\",",
    "        mode: \"3d\",",
    "        layers: [{ id: \"default\", name: \"Default\" }],",
    "        nodes,",
    "        render: { loop: \"always\", frustumCulling: false, batch: true },",
    "      },",
    "      onFrame: (frame) => {",
    "        collected.push({ delta: frame.delta, stats: frame.render });",
    "      }",
    "    });",
    "    function describeEnvironment() {",
    "      const probe = document.createElement(\"canvas\");",
    "      const gl = probe.getContext(\"webgl2\") || probe.getContext(\"webgl\");",
    "      let renderer = \"unavailable\";",
    "      let vendor = \"unavailable\";",
    "      if (gl) {",
    "        const info = gl.getExtension(\"WEBGL_debug_renderer_info\");",
    "        if (info) {",
    "          renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || renderer);",
    "          vendor = String(gl.getParameter(info.UNMASKED_VENDOR_WEBGL) || vendor);",
    "        } else {",
    "          renderer = String(gl.getParameter(gl.RENDERER) || renderer);",
    "          vendor = String(gl.getParameter(gl.VENDOR) || vendor);",
    "        }",
    "      }",
    "      return {",
    "        devicePixelRatio: window.devicePixelRatio,",
    "        hardwareConcurrency: navigator.hardwareConcurrency,",
    "        renderer,",
    "        userAgent: navigator.userAgent,",
    "        vendor",
    "      };",
    "    }",
    "    runtime.start();",
    "    const canvas = host.querySelector(\"canvas\");",
    "    if (canvas) {",
    "      canvas.addEventListener(\"webglcontextlost\", () => { contextLostCount += 1; });",
    "    }",
    "    const check = setInterval(() => {",
    "      if (collected.length >= captureFrames) {",
    "        clearInterval(check);",
    "        runtime.stop();",
    "        const current = runtime.current;",
    "        const threeScene = current && current.scene ? current.scene : null;",
    "        window.__perfResult = {",
    "          collected,",
    "          backend: host.getAttribute(\"data-denovo-backend\"),",
    "          environment: describeEnvironment(),",
    "          finalStats: runtime.getRenderStats(),",
    "          sceneNodeCount: runtime.getScene().nodes.length,",
    "          threeChildCount: threeScene ? threeScene.children.length : null,",
    "          contextLostCount",
    "        };",
    "      }",
    "    }, 50);",
    "  </script>",
    "</body>",
    "</html>",
    ""
  ].join("\n");
}

/**
 * @param {number[]} sorted
 * @param {number} p
 */
function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
  return sorted[index];
}

async function startViteServer() {
  const configPath = `/tmp/denovo-perf-vite-${process.pid}.mjs`;
  await writeFile(
    configPath,
    [
      "export default {",
      "  clearScreen: false,",
      "  server: {",
      "    hmr: false,",
      "    watch: { ignored: ['**/*'] }",
      "  }",
      "};",
      ""
    ].join("\n")
  );
  const child = spawn(
    "pnpm",
    [
      "--filter",
      "@de-novo/canvas-vanilla-example",
      "exec",
      "vite",
      "--config",
      configPath,
      "--host",
      "127.0.0.1",
      "--port",
      "5183"
    ],
    {
      env: { ...process.env, CI: "1" },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  const url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for Vite server.\n${output}`));
    }, 30_000);

    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Vite exited before ready with code ${code}.\n${output}`));
    });

    const interval = setInterval(() => {
      // Vite 8 decorates its banner with ANSI escapes even when piped; strip
      // them before matching the Local URL.
      const clean = output.replace(
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
        ""
      );
      const match = clean.match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+\/)/);
      if (match?.[1]) {
        clearInterval(interval);
        clearTimeout(timeout);
        resolve(match[1]);
      }
    }, 50);
  });

  return { configPath, process: child, url };
}

/**
 * @param {import("node:child_process").ChildProcess} child
 */
async function stopServer(child) {
  if (child.exitCode !== null) {
    return;
  }
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 2_000);
    child.on("exit", () => {
      clearTimeout(timeout);
      resolve(undefined);
    });
  });
}
