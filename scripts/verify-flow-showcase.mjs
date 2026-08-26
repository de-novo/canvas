// @ts-check
/**
 * Absorption proof for the release-board showcase.
 * The board is a Denovo document: no iframe, pickable cards, named-op
 * label hide, and undo.
 */

import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import { devices } from "playwright";
import { launchPixelChromium } from "./lib/chromium.mjs";

import { createCheckRunner } from "./lib/checks.mjs";

const { check, report } = createCheckRunner();

const root = path.resolve(import.meta.dirname, "..");
const desktopShot = path.resolve(
  root,
  "artifacts/verification/flow-release-board.png"
);
const mobileShot = path.resolve(
  root,
  "artifacts/verification/flow-release-board-mobile.png"
);

const server = await startApp("@denovo/canvas-flow-example", 5181);

try {
  await check("flow-showcase-desktop-absorbs-and-edits", async () => {
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

      await page.goto(server.url, { waitUntil: "networkidle" });
      await page.waitForFunction(
        () =>
          document.querySelector("#stage")?.getAttribute("data-denovo-flow-ready") ===
          "true",
        undefined,
        { timeout: 30_000 }
      );

      const iframeCount = await page.locator("iframe").count();
      assert.equal(iframeCount, 0);

      const cards = page.locator("[data-flow-card]");
      await cards.first().waitFor({ timeout: 10_000 });
      assert.equal(await cards.count(), 5);

      const canvas = page.locator("#stage canvas:not(.denovo-canvas-minimap)").first();
      const box = await canvas.boundingBox();
      assert.ok(box && box.width > 200 && box.height > 200);

      const colors = await countCanvasColors(page);
      assert.ok(colors >= 2, `expected a painted canvas, got ${colors} colors`);

      const hitPoint = await page.evaluate(() => {
        const runtime = window.__denovoRuntime;
        if (!runtime) {
          return null;
        }
        for (let y = 20; y < 760; y += 16) {
          for (let x = 20; x < 880; x += 16) {
            const hit = runtime.hitTest({ point: [x, y] });
            if (hit.kind === "node" && hit.nodeId === "build") {
              return { x, y };
            }
          }
        }
        return null;
      });
      assert.ok(hitPoint, "build card should hit-test on the canvas");
      await page.locator("#stage canvas[data-denovo-canvas]").click({
        position: hitPoint
      });
      await page.waitForFunction(
        () => window.__flowShowcase?.selectedId === "build",
        undefined,
        { timeout: 10_000 }
      );

      await page.locator('[data-denovo-control="hide-labels"]').click();
      await page.waitForFunction(
        () => window.__flowShowcase?.labelVisible === false,
        undefined,
        { timeout: 10_000 }
      );
      const hidden = await page.evaluate(() => window.__flowShowcase);
      assert.equal(hidden?.labelVisible, false);
      assert.equal(hidden?.undoDepth, 1);
      assert.equal(
        hidden?.listed.find((node) => node.id === "title")?.visible,
        false
      );

      mkdirSync(path.dirname(desktopShot), { recursive: true });
      await page.screenshot({ path: desktopShot, fullPage: true });

      await page.locator('[data-denovo-control="undo"]').click();
      await page.waitForFunction(
        () => window.__flowShowcase?.labelVisible === true,
        undefined,
        { timeout: 10_000 }
      );
      const restored = await page.evaluate(() => window.__flowShowcase);
      assert.equal(restored?.labelVisible, true);
      assert.equal(restored?.undoDepth, 0);

      assert.deepEqual(consoleErrors, []);
    } finally {
      await browser.close();
    }
  });

  await check("flow-showcase-mobile-paints-without-iframe", async () => {
    const browser = await launchPixelChromium();
    try {
      const page = await browser.newPage({
        ...devices["iPhone 14"]
      });
      await page.goto(server.url, { waitUntil: "networkidle" });
      await page.waitForFunction(
        () =>
          document.querySelector("#stage")?.getAttribute("data-denovo-flow-ready") ===
          "true",
        undefined,
        { timeout: 30_000 }
      );
      assert.equal(await page.locator("iframe").count(), 0);
      assert.equal(await page.locator("[data-flow-card]").count(), 5);
      mkdirSync(path.dirname(mobileShot), { recursive: true });
      await page.screenshot({ path: mobileShot, fullPage: true });
    } finally {
      await browser.close();
    }
  });
} finally {
  server.process.kill("SIGTERM");
}

report();

/**
 * @param {import("playwright").Page} page
 */
async function countCanvasColors(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("#stage canvas:not(.denovo-canvas-minimap)");
    if (!(canvas instanceof HTMLCanvasElement)) {
      return 0;
    }
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return 0;
    }
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const seen = new Set();
    const stride = 16 * 4;
    for (let index = 0; index < data.length; index += stride) {
      seen.add(`${data[index]},${data[index + 1]},${data[index + 2]}`);
    }
    return seen.size;
  });
}

function startApp(filter, port) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      ["--filter", filter, "exec", "vite", "--host", "127.0.0.1", "--port", String(port)],
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
