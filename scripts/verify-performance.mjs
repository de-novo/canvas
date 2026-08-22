// @ts-check
/**
 * M4 Performance baseline measurement.
 *
 * Writes a temporary Vite-served HTML page into the vanilla example, builds
 * large instanced 3D scenes (1k, 10k boxes), and captures frame timing plus
 * WebGL render stats (draw calls, triangles, geometries, textures) via the
 * `onFrame` `frame.render` field and the `getRenderStats()` runtime capability.
 *
 * Output: a JSON report at artifacts/verification/performance-report.json and
 * a console summary. Baselines only — no pass/fail gates (those live in
 * docs/m4-performance-thresholds.md once baselines are captured).
 */

import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";

import { chromium } from "playwright";

const WORKLOADS = [
  { label: "100-boxes", nodeCount: 100 },
  { label: "1k-boxes", nodeCount: 1_000 },
  { label: "10k-boxes", nodeCount: 10_000 }
];

const CAPTURE_FRAMES = 30;
const REPORT_PATH = "artifacts/verification/performance-report.json";
const PERF_HTML = "apps/vanilla/perf-bench.html";

const server = await startViteServer();
/** @type {{ workloads: any[] }} */
const report = { workloads: [] };

try {
  for (const workload of WORKLOADS) {
    const result = await measureWorkload(server.url, workload);
    report.workloads.push(result);
    console.log(
      `[perf] ${workload.label}: ` +
        `frame p50=${result.frameTimeMs.p50.toFixed(2)}ms ` +
        `p95=${result.frameTimeMs.p95.toFixed(2)}ms, ` +
        `drawCalls=${result.renderStats.drawCalls}, ` +
        `geometries=${result.renderStats.geometries}` +
        (result.contextLostCount > 0
          ? `, contextLost=${result.contextLostCount}`
          : "")
    );
  }
} finally {
  await stopServer(server.process);
  await rm(PERF_HTML, { force: true });
}

// Hard gate: the bench scene runs with `batch: true`, so every workload must
// render through one batched draw call. Frame-time ceilings stay out of the
// gate on purpose — headless numbers are machine-dependent baselines recorded
// in docs/m4-performance-thresholds.md, not pass/fail budgets.
for (const workload of report.workloads) {
  if (workload.renderStats.drawCalls !== 1) {
    throw new Error(
      `[perf] batching gate failed for ${workload.label}: ` +
        `expected drawCalls=1, got ${workload.renderStats.drawCalls}`
    );
  }
}
console.log("[perf] batching gate passed: drawCalls=1 across all workloads");

await mkdir("artifacts/verification", { recursive: true });
await writeFile(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");
console.log(`[perf] report written to ${REPORT_PATH}`);

/**
 * @param {string} baseUrl
 * @param {{ label: string; nodeCount: number }} workload
 */
async function measureWorkload(baseUrl, workload) {
  const url = `${baseUrl}perf-bench.html?count=${workload.nodeCount}&frames=${CAPTURE_FRAMES}`;
  await writeFile(PERF_HTML, perfBenchHtml());

  const browser = await chromium.launch({ headless: true });
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
    "    import { createCanvas } from \"@denovo/canvas\";",
    "    const params = new URLSearchParams(location.search);",
    "    const count = Number(params.get(\"count\") || \"1000\");",
    "    const captureFrames = Number(params.get(\"frames\") || \"120\");",
    "    const host = document.getElementById(\"stage\");",
    "    let contextLostCount = 0;",
    "    const nodes = [];",
    "    for (let i = 0; i < count; i += 1) {",
    "      nodes.push({",
    "        id: `box-${i}`,",
    "        layerId: \"default\",",
    "        type: \"box\",",
    "        color: \"#22c55e\",",
    "        position: [(i % 32) - 16, 0, Math.floor(i / 32) - 16],",
    "      });",
    "    }",
    "    const collected = [];",
    "    const runtime = createCanvas(host, {",
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
      "@denovo/canvas-vanilla-example",
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
