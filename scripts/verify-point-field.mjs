import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";

import { launchPixelChromium } from "./lib/chromium.mjs";

import { createCheckRunner } from "./lib/checks.mjs";

const { check, report } = createCheckRunner();
const root = path.resolve(import.meta.dirname, "..");
const web = await import(
  pathToFileURL(path.join(root, "packages/web/dist/index.js")).href
);

function mockContext() {
  const calls = { arcs: 0, fills: 0, strokes: 0, moves: 0 };
  return {
    calls,
    beginPath() {},
    arc() {
      calls.arcs += 1;
    },
    fill() {
      calls.fills += 1;
    },
    stroke() {
      calls.strokes += 1;
    },
    moveTo() {
      calls.moves += 1;
    },
    lineTo() {},
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1
  };
}

check("screen-point-size-clamps", () => {
  assert.equal(web.canvasScreenPointSize(8, 0.1), 4);
  assert.equal(web.canvasScreenPointSize(8, 1), 8);
  assert.equal(web.canvasScreenPointSize(20, 2), 14);
});

check("on-screen-points-are-drawn", () => {
  const context = mockContext();
  const stats = web.renderCanvas2DPointField(context, {
    points: [
      { x: 10, y: 10, fill: "#fff" },
      { x: 20, y: 20, fill: "#fff" },
      { x: 30, y: 30, fill: "#fff" }
    ],
    view: { offset: [0, 0], zoom: 1 },
    viewport: { width: 200, height: 200 }
  });
  assert.equal(stats.drawnPoints, 3);
  assert.equal(context.calls.arcs, 3);
});

check("off-screen-points-are-culled", () => {
  const context = mockContext();
  const stats = web.renderCanvas2DPointField(context, {
    points: [
      { x: -400, y: -400, fill: "#fff" },
      { x: 800, y: 800, fill: "#fff" }
    ],
    view: { offset: [0, 0], zoom: 1 },
    viewport: { width: 200, height: 200 }
  });
  assert.equal(stats.drawnPoints, 0);
  assert.equal(context.calls.arcs, 0);
});

check("edges-are-counted", () => {
  const context = mockContext();
  const stats = web.renderCanvas2DPointField(context, {
    points: [
      { x: 10, y: 10, fill: "#fff" },
      { x: 40, y: 40, fill: "#fff" }
    ],
    edges: [{ source: 0, target: 1 }],
    view: { offset: [0, 0], zoom: 1 },
    viewport: { width: 200, height: 200 }
  });
  assert.equal(stats.drawnEdges, 1);
  assert.equal(context.calls.strokes, 1);
});

// Per-point beginPath/fill is the measured-fastest Canvas2D shape for this
// primitive (colour-batched union fills were tried and measured slower —
// see docs/history/2026-08-22-graph-field-throughput.md). This check pins
// that shape so a future edit cannot silently switch strategies.
check("hex-points-draw-per-point", () => {
  const context = mockContext();
  const stats = web.renderCanvas2DPointField(context, {
    points: [
      { x: 10, y: 10, fill: "#38bdf8" },
      { x: 20, y: 20, fill: "#f97316" },
      { x: 30, y: 30, fill: "#38bdf8" }
    ],
    view: { offset: [0, 0], zoom: 1 },
    viewport: { width: 200, height: 200 }
  });
  assert.equal(stats.drawnPoints, 3);
  assert.equal(context.calls.arcs, 3);
  assert.equal(context.calls.fills, 3);
});

const server = await startPlayground(5189);
try {
  await check("10k-point-field-browser", async () => {
    const browser = await launchPixelChromium();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.goto(`${server.url}/?points=10000`, { waitUntil: "networkidle" });
      await page.waitForFunction(
        () => Boolean(window.__pointFieldPerf?.count === 10000),
        undefined,
        { timeout: 60_000 }
      );
      const perf = await page.evaluate(() => window.__pointFieldPerf);
      assert.equal(perf.count, 10_000);
      assert.ok(perf.drawnPoints > 0, "fit view must keep some points on screen");
      assert.ok(perf.minScreenPx >= 4, `screen size must stay readable, got ${perf.minScreenPx}`);
      assert.ok(
        Number.isFinite(perf.drawMsMin) && perf.drawMsMin > 0,
        "draw time must be measured"
      );
      console.log(
        `[point-field] 10k draw min ${perf.drawMsMin.toFixed(2)}ms · drawn ${perf.drawnPoints}/${perf.count}`
      );

      // Scale evidence at the 100k working set: correctness gates only —
      // draw time is recorded as a machine-dependent baseline.
      const large = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      try {
        await large.goto(`${server.url}/?points=100000`, { waitUntil: "networkidle" });
        await large.waitForFunction(
          () => Boolean(window.__pointFieldPerf?.count === 100000),
          undefined,
          { timeout: 120_000 }
        );
        const bigPerf = await large.evaluate(() => window.__pointFieldPerf);
        assert.equal(bigPerf.count, 100_000);
        assert.ok(bigPerf.drawnPoints > 0);
        assert.ok(Number.isFinite(bigPerf.drawMsMin) && bigPerf.drawMsMin > 0);
        console.log(
          `[point-field] 100k draw min ${bigPerf.drawMsMin.toFixed(2)}ms · drawn ${bigPerf.drawnPoints}/${bigPerf.count}`
        );
      } finally {
        await large.close();
      }
    } finally {
      await browser.close();
    }
  });
} finally {
  server.process.kill("SIGTERM");
}

report();

function startPlayground(port) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      [
        "--filter",
        "@denovo/canvas-graph-example",
        "exec",
        "vite",
        "--host",
        "127.0.0.1",
        "--port",
        String(port)
      ],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"] }
    );
    let stdout = "";
    const url = `http://127.0.0.1:${port}`;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`playground did not start:\n${stdout}`));
    }, 20_000);
    const ready = async () => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          clearTimeout(timer);
          resolve({ process: child, url });
        }
      } catch {
        // keep polling until the timeout
      }
    };
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      void ready();
    });
    child.stderr.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.on("exit", (code) => {
      if (code && code !== 0) {
        clearTimeout(timer);
        reject(new Error(`playground exited ${code}:\n${stdout}`));
      }
    });
  });
}
