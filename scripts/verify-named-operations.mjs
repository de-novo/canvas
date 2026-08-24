// @ts-check
/**
 * Usability proof for named authoring slice 1. The node recipe is the
 * same list a host button or an agent would write. The browser check
 * clicks playground Hide Level 2, which calls that list.
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
  "artifacts/verification/named-ops-hide-level-2.png"
);

const facade = await import(
  pathToFileURL(path.join(root, "packages/canvas/dist/index.js")).href
);

await check("named-ops-human-and-agent-share-the-same-list", async () => {
  const document = facade.defineDocument({
    id: "named-ops-usability",
    scene: {
      id: "named-ops-usability-scene",
      layers: [
        { id: "storey-1", name: "Level 1", visible: true },
        { id: "storey-2", name: "Level 2", visible: true }
      ],
      mode: "3d",
      nodes: []
    }
  });
  const hideLevel2 = facade.setLayerVisible({
    layerId: "storey-2",
    visible: false
  });
  const preview = facade.applyNamedOperations(document, [hideLevel2]);
  assert.equal(preview.changed, true);
  assert.equal(preview.commands[0]?.type, "layer.update");

  const editor = facade.createEditor({ document });
  const applied = await editor.apply([hideLevel2]);
  assert.equal(applied.changed, true);
  assert.equal(
    editor.getState().document.scene.layers.find((layer) => layer.id === "storey-2")
      ?.visible,
    false
  );
  assert.equal(editor.getState().history.undoDepth, 1);

  const again = await editor.apply([hideLevel2]);
  assert.equal(again.changed, false);
  assert.equal(editor.getState().history.undoDepth, 1);
});

const server = await startPlayground(5189);
try {
  await check("named-ops-playground-hide-level-2-uses-the-helper", async () => {
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
        () => document.querySelector("#status")?.textContent === "ready",
        undefined,
        { timeout: 90_000 }
      );

      const before = await page.evaluate(() => window.__bimNamedOps);
      assert.equal(before?.visible, true);
      assert.ok((before?.layerIds.length ?? 0) > 0);
      assert.equal(
        await page.locator("#level-2-visible").getAttribute("data-level-2-visible"),
        "true"
      );

      await page.locator('[data-denovo-control="hide-level-2"]').click();
      await page.waitForFunction(
        () => window.__bimNamedOps?.visible === false,
        undefined,
        { timeout: 15_000 }
      );

      const hidden = await page.evaluate(() => window.__bimNamedOps);
      assert.equal(hidden?.visible, false);
      assert.equal(hidden?.changed, true);
      assert.equal(hidden?.undoDepth, 1);
      assert.equal(
        await page.locator("#level-2-visible").getAttribute("data-level-2-visible"),
        "false"
      );

      mkdirSync(path.dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: true });

      await page.locator('[data-denovo-control="hide-level-2"]').click();
      await page.waitForFunction(
        () =>
          document.querySelector("#status")?.textContent ===
          "Level 2 already hidden",
        undefined,
        { timeout: 10_000 }
      );
      const again = await page.evaluate(() => window.__bimNamedOps);
      assert.equal(again?.changed, false);
      assert.equal(again?.undoDepth, 1);

      await page.locator('[data-denovo-control="show-level-2"]').click();
      await page.waitForFunction(
        () => window.__bimNamedOps?.visible === true,
        undefined,
        { timeout: 10_000 }
      );
      const shown = await page.evaluate(() => window.__bimNamedOps);
      assert.equal(shown?.visible, true);
      assert.equal(shown?.changed, true);
      assert.equal(shown?.undoDepth, 2);

      assert.deepEqual(consoleErrors, []);
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
        "@denovo/canvas-bim-example",
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
      reject(new Error(`playground-bim did not start:\n${stdout}`));
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
    child.on("exit", (code) => {
      if (code && code !== 0) {
        clearTimeout(timer);
        reject(new Error(`playground-bim exited ${code}:\n${stdout}`));
      }
    });
  });
}
