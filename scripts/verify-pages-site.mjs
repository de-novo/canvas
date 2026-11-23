// @ts-check
/**
 * Builds and verifies the static GitHub Pages demo hub (`dist-pages/`) in
 * headless Chromium over local HTTP.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import { createCheckRunner } from "./lib/checks.mjs";

const { check, report } = createCheckRunner();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist-pages");

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2"
};

function startStaticServer(directory) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const cleanUrl = (req.url || "/").split("?")[0];
      let filePath = path.join(directory, cleanUrl);
      if (existsSync(filePath) && statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }
      if (!existsSync(filePath)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(readFileSync(filePath));
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

await check("build-pages-static-bundle", () => {
  execFileSync(process.execPath, [path.join(root, "scripts/build-pages-site.mjs")], {
    cwd: root,
    stdio: "pipe"
  });
  for (const rel of [
    "index.html",
    ".nojekyll",
    "bench-2d/index.html",
    "flow/index.html",
    "network/index.html",
    "field/index.html",
    "warehouse/index.html"
  ]) {
    assert.ok(existsSync(path.join(distDir, rel)), `missing dist-pages/${rel}`);
  }
  // Confirm bench-2d bundle contains zero Three.js WebGLRenderer code.
  const benchAssets = path.join(distDir, "bench-2d", "assets");
  const jsFiles = readdirSync(benchAssets).filter((f) => f.endsWith(".js"));
  assert.ok(jsFiles.length > 0, "expected bench-2d JS assets");
  for (const file of jsFiles) {
    const code = readFileSync(path.join(benchAssets, file), "utf8");
    assert.ok(
      !code.includes("WebGLRenderer"),
      `bench-2d asset ${file} must remain Three.js-free`
    );
  }
});

const { server, url } = await startStaticServer(distDir);
const browser = await chromium.launch({ headless: true });

try {
  await check("pages-hub-multilingual-switch", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${url}/`, { waitUntil: "networkidle" });
    const enTitle = await page.locator("#hero-title").textContent();
    assert.ok(enTitle?.includes("Framework-agnostic"), `unexpected EN title: ${enTitle}`);
    await page.click('button[data-lang="ko"]');
    const koTitle = await page.locator("#hero-title").textContent();
    assert.ok(koTitle?.includes("프레임워크"), `unexpected KO title: ${koTitle}`);
    await page.click('button[data-lang="zh"]');
    const zhTitle = await page.locator("#hero-title").textContent();
    assert.ok(zhTitle?.includes("框架无关"), `unexpected ZH title: ${zhTitle}`);
    assert.deepEqual(errors, []);
    await page.close();
  });

  await check("pages-bench-2d-10k-live-interactions", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto(`${url}/bench-2d/`, { waitUntil: "networkidle" });
    await page.waitForFunction(
      () => Boolean(window.__bench2d && window.__bench2d.getTelemetry().drawCalls > 0),
      undefined,
      { timeout: 10_000 }
    );
    const initial = await page.evaluate(() => window.__bench2d.getTelemetry());
    assert.equal(initial.nodeCount, 10_000);
    assert.ok(initial.drawCalls > 0 && initial.drawCalls < 150, `expected culled drawCalls < 150, got ${initial.drawCalls}`);

    await page.click("#btn-move-one");
    const afterMove = await page.evaluate(() => window.__bench2d.getTelemetry());
    assert.equal(afterMove.lastSyncKind, "incremental");
    assert.equal(afterMove.lastSyncedNodeCount, 1);

    await page.click("#btn-snap");
    const afterSnap = await page.evaluate(() => window.__bench2d.getTelemetry());
    assert.ok(
      typeof afterSnap.lastSnapCandidates === "number" &&
        afterSnap.lastSnapCandidates > 0 &&
        afterSnap.lastSnapCandidates < 150,
      `expected O(visible) snap candidates < 150, got ${afterSnap.lastSnapCandidates}`
    );
    assert.ok(afterSnap.activeGuideCount >= 2, `expected >= 2 active snap guides, got ${afterSnap.activeGuideCount}`);

    await page.click("#btn-align");
    await page.waitForFunction(
      () => window.__bench2d.getTelemetry().undoDepth === 1,
      undefined,
      { timeout: 5_000 }
    );
    assert.deepEqual(errors, []);
    await page.close();
  });

  await check("pages-warehouse-digital-twin-3d-and-2d", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto(`${url}/warehouse/`, { waitUntil: "networkidle" });
    await page.waitForFunction(
      () => Boolean(window.__warehouseDemo && window.__warehouseDemo.getState().drawCalls > 0),
      undefined,
      { timeout: 15_000 }
    );
    const s3d = await page.evaluate(() => window.__warehouseDemo.getState());
    assert.equal(s3d.mode, "3d");
    assert.ok(s3d.nodeCount > 3_000, `expected > 3,000 rack/pallet/AGV parts, got ${s3d.nodeCount}`);
    assert.ok(s3d.drawCalls >= 1 && s3d.drawCalls <= 2, `expected 1-2 batched drawCalls across multi-color racks/pallets/AGVs, got ${s3d.drawCalls}`);

    await page.click("#btn-tick-once");
    const afterTick = await page.evaluate(() => window.__warehouseDemo.getState());
    assert.equal(afterTick.drawCalls, s3d.drawCalls, "drawCalls must stay constant after live status color & AGV tick");

    await page.click("#btn-mode-2d");
    await page.waitForFunction(
      () => window.__warehouseDemo && window.__warehouseDemo.getState().mode === "2d" && window.__warehouseDemo.getState().drawCalls > 0,
      undefined,
      { timeout: 10_000 }
    );
    assert.deepEqual(errors, [], `warehouse had errors: ${errors.join("; ")}`);
    await page.close();
  });

  await check("pages-subapps-flow-and-network-load-cleanly", async () => {
    for (const sub of ["flow", "network"]) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.goto(`${url}/${sub}/`, { waitUntil: "networkidle" });
      await page.waitForSelector("canvas", { timeout: 10_000 });
      assert.deepEqual(errors, [], `${sub} had console/page errors: ${errors.join("; ")}`);
      await page.close();
    }
  });
} finally {
  await browser.close();
  server.close();
}

report({ distDir: "dist-pages" });
