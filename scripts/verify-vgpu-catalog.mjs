// @ts-check
/**
 * vgpu example graphics restated as Denovo documents. No iframe, no WGSL
 * on the document, closed kinds only.
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

const core = await import(
  pathToFileURL(path.join(root, "packages", "core", "dist", "index.js")).href
);

await check("official-shade-props-are-closed", () => {
  const props = {
    height: 360,
    hue: 210,
    pattern: "gradient",
    speed: 12,
    width: 520
  };
  assert.equal(core.isDenovoShadeType("plugin.denovo.shade"), true);
  assert.deepEqual(core.denovoShadeSize(props), [520, 360]);
  assert.equal(core.denovoShadeStripCount({ ...props, pattern: "wave" }), 48);
  assert.match(core.denovoShadeGradientStops(props)[0], /^#[0-9a-f]{6}$/u);
});

const server = await startApp("@de-novo/canvas-vanilla-example", 5194);
try {
  await check("vgpu-catalog-gradient-is-shade-not-marker", async () => {
    const result = await openCatalog(server.url, "gradient");
    assert.equal(result.iframeCount, 0);
    assert.equal(result.listedType, "plugin.denovo.shade");
    assert.equal(result.pattern, "wave");
    assert.equal(result.undoDepth, 1);
    assert.ok(result.markerBefore < 80, "gradient must not paint as the marker");
    assert.ok(result.markerAfter < 80, "wave must not paint as the marker");
  });

  await check("vgpu-catalog-instances-is-official-kind", async () => {
    const result = await openCatalog(server.url, "instances");
    assert.equal(result.iframeCount, 0);
    assert.equal(result.listedType, "instances");
    assert.equal(result.mode, "3d");
  });

  await check("vgpu-catalog-clip-uses-section-plane", async () => {
    const result = await openCatalog(server.url, "clip");
    assert.equal(result.iframeCount, 0);
    assert.equal(result.listedType, "sphere");
    assert.equal(result.clipOn, 1);
  });
} finally {
  server.process.kill("SIGTERM");
}

report();

/**
 * @param {string} url
 * @param {string} example
 */
async function openCatalog(url, example) {
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

    await page.goto(`${url}/vgpu-catalog-bench.html?example=${example}`, {
      waitUntil: "networkidle"
    });
    await page.waitForFunction(
      () =>
        document.querySelector("#stage")?.getAttribute("data-denovo-ready") ===
          "true" &&
        (window.__vgpuCatalogResult || window.__vgpuCatalogError),
      undefined,
      { timeout: 60_000 }
    );

    const error = await page.evaluate(() => window.__vgpuCatalogError);
    if (error) {
      throw new Error(String(error));
    }

    const result = await page.evaluate(() => window.__vgpuCatalogResult);
    mkdirSync(path.dirname(path.join(root, "artifacts/verification/.keep")), {
      recursive: true
    });
    await page.screenshot({
      path: path.join(root, `artifacts/verification/vgpu-catalog-${example}.png`),
      fullPage: true
    });
    assert.deepEqual(consoleErrors, []);
    return result;
  } finally {
    await browser.close();
  }
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
  });
}
