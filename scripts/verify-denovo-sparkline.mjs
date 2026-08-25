// @ts-check
/**
 * Official 2D sparkline drawer proof. The kind is a Denovo document:
 * no iframe, no marker, a polyline from closed props, setSparklineStyle.
 */

import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

import { createCheckRunner } from "./lib/checks.mjs";

const { check, report } = createCheckRunner();
const root = path.resolve(import.meta.dirname, "..");
const screenshotPath = path.resolve(
  root,
  "artifacts/verification/denovo-sparkline.png"
);

const core = await import(
  pathToFileURL(path.join(root, "packages", "core", "dist", "index.js")).href
);

await check("official-sparkline-points-follow-style", () => {
  const props = {
    fill: "none",
    height: 80,
    stroke: "#22c55e",
    style: "linear",
    values: [0, 10, 0],
    width: 100
  };
  const linear = core.denovoSparklinePoints(props);
  const stepped = core.denovoSparklinePoints({ ...props, style: "step" });
  assert.equal(linear.length, 3);
  assert.equal(stepped.length, 5);
  assert.deepEqual(core.denovoSparklineSize(props), [100, 80]);
  assert.equal(core.isDenovoSparklineType("plugin.denovo.sparkline"), true);
});

const server = await startApp("@denovo/canvas-vanilla-example", 5193);
try {
  await check("official-sparkline-drawer-paints-not-marker", async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 800 }
      });
      const consoleErrors = [];
      page.on("pageerror", (error) => consoleErrors.push(String(error)));
      page.on("console", (message) => {
        if (message.type() === "error") {
          consoleErrors.push(message.text());
        }
      });

      await page.goto(`${server.url}/sparkline-bench.html`, {
        waitUntil: "networkidle"
      });
      await page.waitForFunction(
        () =>
          document.querySelector("#stage")?.getAttribute("data-denovo-ready") ===
            "true" &&
          (window.__sparklineBench || window.__sparklineBenchError),
        undefined,
        { timeout: 60_000 }
      );

      const error = await page.evaluate(() => window.__sparklineBenchError);
      if (error) {
        throw new Error(String(error));
      }

      const result = await page.evaluate(() => window.__sparklineBench);
      assert.equal(result.iframeCount, 0);
      assert.equal(result.listedType, "plugin.denovo.sparkline");
      assert.equal(result.style, "step");
      assert.equal(result.undoDepth, 1);
      assert.ok(
        result.linearStroke > 0,
        `linear sparkline must paint stroke pixels, got ${result.linearStroke}`
      );
      assert.ok(
        result.stepStroke > 0,
        `step sparkline must paint stroke pixels, got ${result.stepStroke}`
      );
      assert.ok(
        result.linearMarker < result.linearStroke,
        "sparkline must not draw as the plugin marker"
      );

      mkdirSync(path.dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: true });
      assert.deepEqual(consoleErrors, []);
    } finally {
      await browser.close();
    }
  });
} finally {
  server.process.kill("SIGTERM");
}

report();

function startApp(filter, port) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      [
        "--filter",
        filter,
        "exec",
        "vite",
        "--host",
        "127.0.0.1",
        "--port",
        String(port)
      ],
      { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] }
    );
    let stdout = "";
    const url = `http://127.0.0.1:${port}`;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${filter} did not start:\n${stdout}`));
    }, 30_000);
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
    void ready();
    const poll = setInterval(() => {
      void ready();
    }, 250);
    child.on("exit", (code) => {
      clearInterval(poll);
      clearTimeout(timer);
      reject(new Error(`${filter} exited ${code}:\n${stdout}`));
    });
  });
}
