// @ts-check
/**
 * Region/mask first slice: a 2D document of rect and circle nodes tagged
 * with host metadata. No new kind, no raster editor.
 */

import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

import { launchPixelChromium } from "./lib/chromium.mjs";

import { createCheckRunner } from "./lib/checks.mjs";

const { check, report } = createCheckRunner();
const root = path.resolve(import.meta.dirname, "..");
const screenshotPath = path.resolve(
  root,
  "artifacts/verification/region-mask.png"
);

const facade = await import(
  pathToFileURL(path.join(root, "packages", "canvas", "dist", "index.js")).href
);

await check("region-mask-document-uses-rect-circle-metadata", () => {
  const document = facade.defineDocument({
    id: "region-mask-document",
    scene: {
      id: "region-mask-document-scene",
      layers: [
        { id: "image", name: "Image" },
        { id: "mask", name: "Mask" }
      ],
      mode: "2d",
      nodes: [
        {
          fill: "#1e293b",
          id: "stand-in",
          layerId: "image",
          metadata: { role: "image" },
          position: [40, 40],
          size: [640, 400],
          type: "rect"
        },
        {
          fill: "#e11d48",
          id: "mask-rect",
          layerId: "mask",
          metadata: { role: "mask" },
          position: [80, 80],
          size: [160, 120],
          type: "rect"
        },
        {
          fill: "#22c55e",
          id: "mask-circle",
          layerId: "mask",
          metadata: { role: "mask" },
          position: [400, 220],
          radius: 56,
          type: "circle"
        }
      ]
    }
  });
  const listed = facade.listNodes(document);
  assert.deepEqual(
    listed.map((node) => node.id),
    ["stand-in", "mask-rect", "mask-circle"]
  );
  assert.equal(
    listed.some((node) => "metadata" in node),
    false,
    "listNodes must not dump host metadata"
  );
  const masks = document.scene.nodes.filter(
    (node) => node.metadata?.role === "mask"
  );
  assert.deepEqual(
    masks.map((node) => node.type),
    ["rect", "circle"]
  );
  const hidden = facade.applyNamedOperations(document, [
    facade.setNodeVisible({ nodeId: "mask-rect", visible: false })
  ]);
  assert.equal(hidden.changed, true);
  assert.equal(
    facade.listNodes(hidden.document).find((node) => node.id === "mask-rect")
      ?.visible,
    false
  );
});

const server = await startApp("@denovo/canvas-vanilla-example", 5195);
try {
  await check("region-mask-hides-with-setNodeVisible", async () => {
    const browser = await launchPixelChromium();
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
      await page.goto(`${server.url}/region-mask-bench.html`, {
        waitUntil: "networkidle"
      });
      await page.waitForFunction(
        () =>
          document.querySelector("#stage")?.getAttribute("data-denovo-ready") ===
            "true" &&
          (window.__regionMaskBench || window.__regionMaskBenchError),
        undefined,
        { timeout: 60_000 }
      );
      const error = await page.evaluate(() => window.__regionMaskBenchError);
      if (error) {
        throw new Error(String(error));
      }
      const result = await page.evaluate(() => window.__regionMaskBench);
      assert.equal(result.iframeCount, 0);
      assert.deepEqual(result.maskIds, ["mask-rect", "mask-circle"]);
      assert.equal(result.listedHasMetadata, false);
      assert.equal(result.rectHit, true);
      assert.equal(result.undoDepth, 1);
      assert.ok(
        result.redBefore > 80,
        `mask rect must paint, got ${result.redBefore}`
      );
      assert.ok(
        result.redAfter < result.redBefore / 4,
        `hiding the mask rect must drop its pixels (${result.redBefore} → ${result.redAfter})`
      );
      assert.ok(
        result.greenAfter > 80,
        "hiding the rect must leave the circle mask"
      );
      const hidden = result.visibleAfter.find((node) => node.id === "mask-rect");
      assert.equal(hidden?.visible, false);
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
    child.on("error", reject);
  });
}
