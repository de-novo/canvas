// @ts-check
/**
 * Browser proof that the BIM playground can federate a second IFC copy
 * with an origin offset. Asserts page-local markers only:
 * `#model-count[data-bim-models]` and `window.__bimFederation`.
 */

import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import { launchPixelChromium } from "./lib/chromium.mjs";

import { createCheckRunner } from "./lib/checks.mjs";

const { check, report } = createCheckRunner();

const screenshotPath = path.resolve(
  import.meta.dirname,
  "../artifacts/verification/bim-federation.png"
);

const server = await startPlayground(5188);
try {
  await check("bim-federation-browser-places-offset-copy", async () => {
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
        () => document.querySelector("#status")?.textContent === "ready",
        undefined,
        { timeout: 90_000 }
      );

      const before = await page.evaluate(() => window.__bimFederation);
      assert.equal(before?.modelCount, 1, "initial load must be one model");
      assert.equal(
        await page.locator("#model-count").getAttribute("data-bim-models"),
        "1"
      );
      const firstTargetX = before.cameraTargetX;

      await page.locator('[data-denovo-control="federate-copy"]').click();
      await page.waitForFunction(
        () => document.querySelector("#status")?.textContent === "federated",
        undefined,
        { timeout: 90_000 }
      );

      const after = await page.evaluate(() => window.__bimFederation);
      assert.equal(after?.modelCount, 2);
      assert.equal(
        await page.locator("#model-count").getAttribute("data-bim-models"),
        "2"
      );
      assert.equal(after.uniqueNodeIds, true);

      const sample = after.models.find((model) => model.id === "sample");
      const copy = after.models.find((model) => model.id === "copy");
      assert.ok(sample, "sample model missing after federate");
      assert.ok(copy, "copy model missing after federate");
      assert.equal(sample.nodeCount, copy.nodeCount);
      assert.ok(sample.nodeCount > 0);
      assert.deepEqual(sample.origin, [0, 0, 0]);
      assert.deepEqual(copy.origin, [40, 0, 0]);
      assert.ok(
        after.cameraTargetX > firstTargetX,
        `federated camera must widen (first ${firstTargetX}, federated ${after.cameraTargetX})`
      );

      mkdirSync(path.dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: true });

      assert.deepEqual(consoleErrors, []);
      console.log(
        `[bim-federation] ${after.models
          .map((model) => `${model.id}:${model.nodeCount}@${model.origin.join(",")}`)
          .join(" + ")}; cameraTargetX ${firstTargetX} → ${after.cameraTargetX}`
      );
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
        "@de-novo/canvas-bim-example",
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
