// @ts-check
/**
 * M3.1-extension browser proof: `resolveSurfacePoint` against a `mesh` node.
 *
 * Serves the vanilla example, loads mesh-surface-bench.html (a single quad
 * mesh facing +z), and asserts through the facade runtime that a centre
 * viewport ray resolves a correlated `mesh.triangle` hit with a unit,
 * camera-facing normal and an on-quad point — plus an explicit miss outside
 * the geometry.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";

import { launchPixelChromium } from "./lib/chromium.mjs";

import { createCheckRunner } from "./lib/checks.mjs";

const { check, report } = createCheckRunner();

const server = await startPlayground(5191);
try {
  await check("mesh-surface-point-browser", async () => {
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

      await page.goto(
        `${server.url}/mesh-surface-bench.html`,
        { waitUntil: "networkidle" }
      );
      await page.waitForFunction(
        () =>
          Boolean(window.__meshSurfaceResult) ||
          Boolean(window.__meshSurfaceError),
        undefined,
        { timeout: 60_000 }
      );

      const error = await page.evaluate(() => window.__meshSurfaceError);
      assert.equal(error ?? null, null, `bench errored: ${error}`);

      const result = await page.evaluate(() => window.__meshSurfaceResult);
      assert.deepEqual(result, {
        hitNodeId: "bench-mesh",
        missOutsideGeometry: true,
        normalUnit: true,
        normalFacesCamera: true,
        pointOnQuad: true,
        triangleIndexInRange: true
      });
      assert.deepEqual(consoleErrors, []);

      console.log(
        "[mesh-surface] hit + unit camera-facing normal + triangle correlation verified"
      );
    } finally {
      await browser.close();
    }
  });

  await check("instances-surface-point-browser", async () => {
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

      await page.goto(
        `${server.url}/instances-surface-bench.html`,
        { waitUntil: "networkidle" }
      );
      await page.waitForFunction(
        () =>
          Boolean(window.__instancesSurfaceResult) ||
          Boolean(window.__instancesSurfaceError),
        undefined,
        { timeout: 60_000 }
      );

      const error = await page.evaluate(() => window.__instancesSurfaceError);
      assert.equal(error ?? null, null, `bench errored: ${error}`);

      const result = await page.evaluate(
        () => window.__instancesSurfaceResult
      );
      assert.deepEqual(result, {
        hitNodeId: "bench-instances",
        instanceIndexIsCentre: true,
        missOutsideGeometry: true,
        normalUnit: true,
        normalFacesCamera: true,
        pointOnCentreBox: true
      });
      assert.deepEqual(consoleErrors, []);

      console.log(
        "[instances-surface] centre-instance hit + unit camera-facing normal verified"
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
        "@denovo/canvas-vanilla-example",
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
      reject(new Error(`playground did not start:\n${stdout}`));
    }, 20_000);
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
        reject(new Error(`playground exited ${code}:\n${stdout}`));
      }
    });
  });
}
