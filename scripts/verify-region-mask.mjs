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

import { devices } from "playwright";

import { launchPixelChromium } from "./lib/chromium.mjs";

import { createCheckRunner } from "./lib/checks.mjs";
import {
  applyRegionMask,
  rasterizeRegionMask,
  sampleRegionMask
} from "../apps/vanilla/src/rasterize-region-mask.mjs";

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

await check("region-mask-host-rasterizes-rect-circle-from-json", () => {
  const document = facade.defineDocument({
    id: "region-mask-raster",
    scene: {
      id: "region-mask-raster-scene",
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
  const origin = [40, 40];
  const width = 640;
  const height = 400;
  const mask = rasterizeRegionMask(document, { height, origin, width });
  const expectedCircle = countDiskPixels(360, 180, 56, width, height);
  assert.deepEqual(mask.kinds, ["rect", "circle"]);
  assert.deepEqual(mask.unsupportedKinds, []);
  assert.equal(mask.pixelCount, 160 * 120 + expectedCircle);
  assert.equal(sampleRegionMask(mask, 80, 80), 255);
  assert.equal(sampleRegionMask(mask, 360, 180), 255);
  assert.equal(sampleRegionMask(mask, 10, 10), 0);
  const applied = applyRegionMask(mask, [30, 41, 59]);
  let appliedCount = 0;
  for (let index = 3; index < applied.length; index += 4) {
    if ((applied[index] ?? 0) > 127) {
      appliedCount += 1;
    }
  }
  assert.equal(appliedCount, mask.pixelCount);
  const hidden = facade.applyNamedOperations(document, [
    facade.setNodeVisible({ nodeId: "mask-rect", visible: false })
  ]);
  const after = rasterizeRegionMask(hidden.document, { height, origin, width });
  assert.equal(after.pixelCount, expectedCircle);
  assert.equal(sampleRegionMask(after, 80, 80), 0);
  assert.equal(sampleRegionMask(after, 360, 180), 255);
});

await check("region-mask-host-reports-unknown-kinds-without-inventing", () => {
  const raster = rasterizeRegionMask(
    {
      scene: {
        layers: [{ id: "mask", visible: true }],
        mode: "2d",
        nodes: [
          {
            id: "poly",
            layerId: "mask",
            metadata: { role: "mask" },
            type: "polyline",
            visible: true
          }
        ]
      }
    },
    { height: 8, origin: [0, 0], width: 8 }
  );
  assert.deepEqual(raster.unsupportedKinds, ["polyline"]);
  assert.equal(raster.pixelCount, 0);
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
      assert.equal(result.usedHostRasterizer, true);
      assert.deepEqual(result.unsupportedKinds, []);
      assert.equal(result.rectSampleBefore, 255);
      assert.equal(result.rectSampleAfter, 0);
      assert.equal(result.circleSampleAfter, 255);
      assert.equal(result.outsideSample, 0);
      assert.ok(
        result.maskPixelsBefore > 20_000,
        `host mask must cover rect+circle, got ${result.maskPixelsBefore}`
      );
      assert.ok(
        result.maskPixelsAfter < result.maskPixelsBefore / 2,
        `hiding the rect must drop host mask pixels (${result.maskPixelsBefore} → ${result.maskPixelsAfter})`
      );
      assert.equal(result.maskedImagePixels, result.maskPixelsBefore);
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

const playgroundShot = path.resolve(
  root,
  "artifacts/verification/playground-region-mask.png"
);
const playground = await startNext(5196);
try {
  await check("playground-host-rasterizes-region-mask", async () => {
    await verifyPlaygroundMask({
      screenshotPath: playgroundShot,
      viewport: { height: 800, width: 1280 }
    });
  });
  await check("playground-host-region-mask-mobile", async () => {
    await verifyPlaygroundMask({
      touch: true,
      viewport: devices["iPhone 14"].viewport
    });
  });
} finally {
  playground.process.kill("SIGTERM");
}

report();

function countDiskPixels(centerX, centerY, radius, width, height) {
  const radiusSquared = radius * radius;
  let count = 0;
  const minX = Math.max(0, Math.floor(centerX - radius));
  const minY = Math.max(0, Math.floor(centerY - radius));
  const maxX = Math.min(width, Math.ceil(centerX + radius));
  const maxY = Math.min(height, Math.ceil(centerY + radius));
  for (let row = minY; row < maxY; row += 1) {
    for (let column = minX; column < maxX; column += 1) {
      const dx = column + 0.5 - centerX;
      const dy = row + 0.5 - centerY;
      if (dx * dx + dy * dy <= radiusSquared) {
        count += 1;
      }
    }
  }
  return count;
}

/**
 * @param {{
 *   screenshotPath?: string,
 *   touch?: boolean,
 *   viewport: { height: number, width: number }
 * }} options
 */
async function verifyPlaygroundMask(options) {
  const browser = await launchPixelChromium();
  try {
    const page = await browser.newPage({ viewport: options.viewport, hasTouch: options.touch ?? false, isMobile: options.touch ?? false });
    const consoleErrors = [];
    page.on("pageerror", (error) => consoleErrors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    await page.goto(`${playground.url}/mask`, { waitUntil: "domcontentloaded" });
    try {
      await page.waitForSelector('[data-denovo-mask-ready="true"]', {
        timeout: 60_000
      });
    } catch (error) {
      const body = await page.locator("body").innerText();
      throw new Error(
        `${error}\npageerrors=${consoleErrors.join(" | ")}\nbody=${body.slice(0, 2000)}`
      );
    }
    const before = await page.evaluate(() => window.__playgroundMask);
    assert.equal(before.iframeCount, 0);
    assert.equal(before.listedHasMetadata, false);
    assert.deepEqual(before.unsupportedKinds, []);
    assert.equal(before.rectSample, 255);
    assert.equal(before.circleSample, 255);
    assert.equal(before.outsideSample, 0);
    assert.equal(before.rectHidden, false);
    assert.ok(
      before.maskPixels > 20_000,
      `playground host mask must cover rect+circle, got ${before.maskPixels}`
    );
    async function press(name) {
      const button = page.getByRole("button", { name, exact: true });
      if (options.touch) await button.tap();
      else await button.click();
    }
    await press("Hide rect mask");
    await page.waitForSelector('[data-denovo-rect-sample="0"]');
    const after = await page.evaluate(() => window.__playgroundMask);
    assert.equal(after.rectSample, 0);
    assert.equal(after.circleSample, 255);
    assert.equal(after.rectHidden, true);
    assert.ok(
      after.maskPixels < before.maskPixels / 2,
      `hiding the rect must drop host mask pixels (${before.maskPixels} → ${after.maskPixels})`
    );
    if (options.screenshotPath) {
      mkdirSync(path.dirname(options.screenshotPath), { recursive: true });
      await page.screenshot({ path: options.screenshotPath, fullPage: true });
    }
    for (const [name, sample] of [["Undo", 255], ["Redo", 0], ["Show rect mask", 255]]) {
      await press(name);
      await page.waitForSelector(`[data-denovo-rect-sample="${sample}"]`);
      const preview = page.getByLabel("Host-rasterized mask preview");
      assert.equal(await preview.evaluate(canvas =>
        canvas.getContext("2d").getImageData(80, 80, 1, 1).data[3]
      ), sample);
    }
    assert.deepEqual(
      consoleErrors.filter((message) => !/Download the React DevTools/i.test(message)),
      []
    );
  } finally {
    await browser.close();
  }
}

function startNext(port) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      [
        "--filter",
        "@denovo/canvas-next-playground",
        "exec",
        "next",
        "dev",
        "-H",
        "127.0.0.1",
        "-p",
        String(port)
      ],
      { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] }
    );
    let stdout = "";
    const url = `http://127.0.0.1:${port}`;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`next playground did not start:\n${stdout}`));
    }, 90_000);
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
      void ready();
    });
    void ready();
    const poll = setInterval(() => {
      void ready();
    }, 250);
    child.on("exit", (code) => {
      clearInterval(poll);
      clearTimeout(timer);
      reject(new Error(`next playground exited ${code}:\n${stdout}`));
    });
    child.on("error", reject);
  });
}

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
