// @ts-check
/**
 * Absorption proof for the Warp Field catalog case.
 * The hero is a Denovo document: no iframe, no vendor renderer, a
 * pickable field node, setFieldPattern, and undo.
 */

import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import { chromium, devices } from "playwright";

import { createCheckRunner } from "./lib/checks.mjs";

const { check, report } = createCheckRunner();

const root = path.resolve(import.meta.dirname, "..");
const desktopShot = path.resolve(
  root,
  "artifacts/verification/field-warp-field.png"
);
const mobileShot = path.resolve(
  root,
  "artifacts/verification/field-warp-field-mobile.png"
);

const server = await startApp("@denovo/canvas-field-example", 5182);

try {
  await check("field-showcase-desktop-absorbs-and-edits", async () => {
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

      await page.goto(server.url, { waitUntil: "networkidle" });
      await page.waitForFunction(
        () =>
          document.querySelector("#stage")?.getAttribute("data-denovo-field-ready") ===
          "true",
        undefined,
        { timeout: 30_000 }
      );

      assert.equal(await page.locator("iframe").count(), 0);
      assert.equal(
        await page.locator("[data-field-compare-host]").count(),
        1
      );
      assert.equal(
        await page.locator("[data-field-compare-denovo]").count(),
        1
      );
      const hostSource = await page.locator("[data-field-compare-host]").innerText();
      assert.match(hostSource, /createWarpFieldRenderer/);
      assert.match(hostSource, /WarpFieldBackground/);
      const denovoSource = await page
        .locator("[data-field-compare-denovo]")
        .innerText();
      assert.match(denovoSource, /plugin\.denovo\.field/);
      assert.match(denovoSource, /setFieldPattern/);
      assert.match(denovoSource, /createDenovoFieldObject/);
      assert.equal(await page.evaluate(() => window.__fieldShowcase?.vendorRenderer), false);
      assert.equal(await page.evaluate(() => window.__fieldShowcase?.pattern), "streaks");
      assert.equal(
        await page.evaluate(
          () => window.__fieldShowcase?.listed.find((node) => node.id === "field")?.type
        ),
        "plugin.denovo.field"
      );

      const canvas = page.locator("#stage canvas:not(.denovo-canvas-minimap)").first();
      const box = await canvas.boundingBox();
      assert.ok(box && box.width > 200 && box.height > 200);

      const hitPoint = await page.evaluate(() => {
        const runtime = window.__denovoRuntime;
        if (!runtime) {
          return null;
        }
        for (let y = 40; y < 720; y += 12) {
          for (let x = 40; x < 860; x += 12) {
            const hit = runtime.hitTest({ point: [x, y] });
            if (hit.kind === "node" && hit.nodeId === "field") {
              return { x, y };
            }
          }
        }
        return null;
      });
      assert.ok(hitPoint, "field node should hit-test on the canvas");
      await page.locator("#stage canvas[data-denovo-canvas]").click({
        position: hitPoint
      });
      await page.waitForFunction(
        () => window.__fieldShowcase?.selectedId === "field",
        undefined,
        { timeout: 10_000 }
      );

      await page.locator('[data-denovo-control="pattern-letters"]').click();
      await page.waitForFunction(
        () => window.__fieldShowcase?.pattern === "letters",
        undefined,
        { timeout: 10_000 }
      );
      const letters = await page.evaluate(() => window.__fieldShowcase);
      assert.equal(letters?.pattern, "letters");
      assert.equal(letters?.undoDepth, 1);
      assert.match(
        await page.locator("[data-field-compare-live]").innerText(),
        /"pattern": "letters"/
      );

      mkdirSync(path.dirname(desktopShot), { recursive: true });
      await page.screenshot({ path: desktopShot, fullPage: true });

      await page.locator('[data-denovo-control="undo"]').click();
      await page.waitForFunction(
        () => window.__fieldShowcase?.pattern === "streaks",
        undefined,
        { timeout: 10_000 }
      );
      const restored = await page.evaluate(() => window.__fieldShowcase);
      assert.equal(restored?.pattern, "streaks");
      assert.equal(restored?.undoDepth, 0);

      assert.deepEqual(consoleErrors, []);
    } finally {
      await browser.close();
    }
  });

  await check("field-showcase-mobile-paints-without-iframe", async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({
        ...devices["iPhone 14"]
      });
      await page.goto(server.url, { waitUntil: "networkidle" });
      await page.waitForFunction(
        () =>
          document.querySelector("#stage")?.getAttribute("data-denovo-field-ready") ===
          "true",
        undefined,
        { timeout: 30_000 }
      );
      assert.equal(await page.locator("iframe").count(), 0);
      assert.equal(await page.evaluate(() => window.__fieldShowcase?.pattern), "streaks");
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
