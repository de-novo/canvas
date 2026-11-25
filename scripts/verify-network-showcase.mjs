// @ts-check
/**
 * Absorption proof for the service-map catalog case.
 * The graph is a Denovo document: no iframe, no point-field overlay,
 * a pickable hub, relation layout, and undo.
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
  "artifacts/verification/network-service-map.png"
);
const mobileShot = path.resolve(
  root,
  "artifacts/verification/network-service-map-mobile.png"
);

const server = await startApp("@de-novo/canvas-network-example", 5183);

try {
  await check("network-showcase-desktop-absorbs-and-layouts", async () => {
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
          document
            .querySelector("#stage")
            ?.getAttribute("data-denovo-network-ready") === "true",
        undefined,
        { timeout: 30_000 }
      );

      assert.equal(await page.locator("iframe").count(), 0);
      assert.equal(
        await page.evaluate(() => window.__networkShowcase?.overlayCount),
        0
      );
      const cards = page.locator("[data-network-card]");
      await cards.first().waitFor({ timeout: 10_000 });
      assert.equal(await cards.count(), 9);
      const overlayFit = await page.evaluate(() => {
        const runtime = window.__denovoRuntime;
        const card = document.querySelector("[data-network-card=\"api\"]");
        if (!runtime?.current || !(card instanceof HTMLElement)) {
          return null;
        }
        const zoom = runtime.current.viewState.zoom;
        return {
          height: Number.parseFloat(card.style.height),
          width: Number.parseFloat(card.style.width),
          zoom
        };
      });
      assert.ok(overlayFit);
      assert.ok(Math.abs(overlayFit.width - 200 * overlayFit.zoom) < 1.5);
      assert.ok(Math.abs(overlayFit.height - 96 * overlayFit.zoom) < 1.5);

      const overlayZoomed = await page.evaluate(() => {
        const runtime = window.__denovoRuntime;
        const card = document.querySelector("[data-network-card=\"api\"]");
        if (!runtime?.current || !(card instanceof HTMLElement)) {
          return null;
        }
        const previous = runtime.current.viewState;
        runtime.current.setViewState({ offset: previous.offset, zoom: 2 });
        const width = Number.parseFloat(card.style.width);
        const height = Number.parseFloat(card.style.height);
        runtime.current.setViewState(previous);
        return { height, width };
      });
      assert.deepEqual(overlayZoomed, { height: 192, width: 400 });

      const overlayCull = await page.evaluate(() => {
        const runtime = window.__denovoRuntime;
        const api = document.querySelector("[data-network-card=\"api\"]");
        const warehouse = document.querySelector(
          "[data-network-card=\"warehouse\"]"
        );
        if (
          !runtime?.current ||
          !(api instanceof HTMLElement) ||
          !(warehouse instanceof HTMLElement)
        ) {
          return null;
        }
        const previous = runtime.current.viewState;
        // Visible world starts at [100, 180]. API origin [80, 168] is
        // outside; API body [80, 168]–[280, 264] still intersects. Warehouse
        // at x=848 is fully off-screen.
        runtime.current.setViewState({ offset: [-400, -720], zoom: 4 });
        const result = {
          apiDisplay: api.style.display,
          warehouseDisplay: warehouse.style.display
        };
        runtime.current.setViewState(previous);
        return result;
      });
      assert.ok(overlayCull);
      assert.notEqual(
        overlayCull.apiDisplay,
        "none",
        "html overlay must stay visible when its body intersects the view"
      );
      assert.equal(overlayCull.warehouseDisplay, "none");

      assert.equal(
        await page.evaluate(
          () =>
            window.__networkShowcase?.listed.find((node) => node.id === "api")
              ?.type
        ),
        "html"
      );

      const before = await page.evaluate(() => window.__networkShowcase);
      assert.deepEqual(before?.hubPosition, [80, 168]);
      assert.equal(before?.undoDepth, 0);

      const canvas = page.locator("#stage canvas:not(.denovo-canvas-minimap)").first();
      const box = await canvas.boundingBox();
      assert.ok(box && box.width > 200 && box.height > 200);

      const hitPoint = await page.evaluate(() => {
        const runtime = window.__denovoRuntime;
        if (!runtime) {
          return null;
        }
        for (let y = 20; y < 760; y += 12) {
          for (let x = 20; x < 880; x += 12) {
            const hit = runtime.hitTest({ point: [x, y] });
            if (hit.kind === "node" && hit.nodeId === "api") {
              return { x, y };
            }
          }
        }
        return null;
      });
      assert.ok(hitPoint, "api card should hit-test on the canvas");
      await page.locator("#stage canvas[data-denovo-canvas]").click({
        position: hitPoint
      });
      await page.waitForFunction(
        () => window.__networkShowcase?.selectedId === "api",
        undefined,
        { timeout: 10_000 }
      );

      await page.locator('[data-denovo-control="layout-relation"]').click();
      await page.waitForFunction(
        () => window.__networkShowcase?.undoDepth === 1,
        undefined,
        { timeout: 10_000 }
      );
      const laidOut = await page.evaluate(() => {
        const editor = window.__denovoEditor;
        const title = editor
          ?.getState()
          .document.scene.nodes.find((node) => node.id === "title");
        const warehouse = document.querySelector(
          "[data-network-card=\"warehouse\"]"
        );
        return {
          hubPosition: window.__networkShowcase?.hubPosition,
          titlePosition:
            title && "position" in title ? title.position : null,
          undoDepth: window.__networkShowcase?.undoDepth,
          warehouseDisplay:
            warehouse instanceof HTMLElement ? warehouse.style.display : null
        };
      });
      assert.equal(laidOut.undoDepth, 1);
      assert.ok(laidOut.hubPosition);
      assert.notDeepEqual(laidOut.hubPosition, [80, 168]);
      assert.deepEqual(laidOut.titlePosition, [80, 44]);
      assert.notEqual(
        laidOut.warehouseDisplay,
        "none",
        "relation layout must fit isolated cards into view"
      );

      mkdirSync(path.dirname(desktopShot), { recursive: true });
      await page.screenshot({ path: desktopShot, fullPage: true });

      await page.locator('[data-denovo-control="undo"]').click();
      await page.waitForFunction(
        () => window.__networkShowcase?.undoDepth === 0,
        undefined,
        { timeout: 10_000 }
      );
      const restored = await page.evaluate(() => window.__networkShowcase);
      assert.deepEqual(restored?.hubPosition, [80, 168]);
      assert.equal(restored?.undoDepth, 0);

      assert.deepEqual(consoleErrors, []);
    } finally {
      await browser.close();
    }
  });

  await check("network-showcase-mobile-paints-without-iframe", async () => {
    const browser = await launchPixelChromium();
    try {
      const page = await browser.newPage({
        ...devices["iPhone 14"]
      });
      await page.goto(server.url, { waitUntil: "networkidle" });
      await page.waitForFunction(
        () =>
          document
            .querySelector("#stage")
            ?.getAttribute("data-denovo-network-ready") === "true",
        undefined,
        { timeout: 30_000 }
      );
      assert.equal(await page.locator("iframe").count(), 0);
      assert.equal(await page.locator("[data-network-card]").count(), 9);
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
