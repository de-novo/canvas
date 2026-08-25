// @ts-check
/**
 * Explicit 3D `backend: "webgpu"` proof. `auto` stays Canvas2D/WebGL2.
 * Headless hosts without a GPU still pass when the request fails
 * explicitly instead of falling back to WebGL2.
 */

import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { inflateSync } from "node:zlib";

import { chromium, devices } from "playwright";

import { createCheckRunner } from "./lib/checks.mjs";

const { check, report } = createCheckRunner();

const root = path.resolve(import.meta.dirname, "..");
const desktopShot = path.resolve(
  root,
  "artifacts/verification/webgpu-vanilla-desktop.png"
);
const mobileShot = path.resolve(
  root,
  "artifacts/verification/webgpu-vanilla-mobile.png"
);

const facade = await import(
  pathToFileURL(path.join(root, "packages/canvas/dist/index.js")).href
);

await check("webgpu-node-resolution-stays-explicit", () => {
  const target = {
    append() {},
    classList: { add() {} },
    dataset: {},
    removeAttribute() {},
    style: { setProperty() {} }
  };
  const twoD = facade.defineScene({
    id: "webgpu-2d",
    layers: [{ id: "main", name: "Main" }],
    mode: "2d",
    nodes: []
  });
  const threeD = facade.defineScene({
    id: "webgpu-3d",
    layers: [{ id: "main", name: "Main" }],
    mode: "3d",
    nodes: []
  });

  assert.throws(
    () =>
      facade.createCanvas(target, {
        renderer: { backend: "webgpu" },
        scene: twoD
      }),
    (error) =>
      error instanceof facade.CanvasBackendResolutionError &&
      error.code === "mode-mismatch"
  );
  assert.throws(
    () =>
      facade.createCanvas(target, {
        renderer: { backend: "webgpu" },
        scene: threeD
      }),
    (error) =>
      error instanceof facade.CanvasBackendResolutionError &&
      error.code === "capability-unavailable"
  );
});

const server = await startApp("@denovo/canvas-vanilla-example", 5191);
/** @type {{ desktop?: string, mobile?: string }} */
const outcomes = {};

try {
  await check("webgpu-vanilla-desktop-is-explicit", async () => {
    const outcome = await verifyVanillaWebgpu({
      screenshotPath: desktopShot,
      viewport: { height: 800, width: 1280 }
    });
    outcomes.desktop = outcome;
    assert.equal(
      outcome,
      "drawn",
      `desktop Chromium must paint explicit webgpu, got ${outcome}`
    );
  });

  await check("webgpu-vanilla-mobile-is-explicit", async () => {
    const outcome = await verifyVanillaWebgpu({
      screenshotPath: mobileShot,
      viewport: devices["iPhone 14"].viewport
    });
    outcomes.mobile = outcome;
    assert.ok(
      outcome === "drawn" || outcome === "unavailable",
      `mobile WebGPU must draw or fail explicitly, got ${outcome}`
    );
  });

  await check("webgpu-section-plane-uses-clipping-group", async () => {
    const browser = await chromium.launch({
      args: ["--enable-unsafe-webgpu", "--enable-webgpu-developer-features"]
    });
    try {
      const page = await browser.newPage({
        viewport: { height: 800, width: 1280 }
      });
      /** @type {string[]} */
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(String(error)));
      await page.goto(`${server.url}/section-bench.html?backend=webgpu`, {
        waitUntil: "networkidle"
      });
      if (
        pageErrors.some((message) =>
          /capability-unavailable|mode-mismatch/.test(message)
        )
      ) {
        return;
      }
      const result = await page.waitForFunction(
        () => window.__sectionBenchResult ?? window.__sectionBenchError ?? false,
        undefined,
        { timeout: 60_000 }
      );
      const value = await result.jsonValue();
      if (typeof value === "string") {
        throw new Error(`section-bench failed: ${value}`);
      }
      assert.equal(value.backend, "webgpu");
      assert.equal(value.verdict.clipOn, true, "section plane must attach one clipping plane");
      assert.equal(value.verdict.clipOff, true, "clearing the section plane must drop clipping planes");
    } finally {
      await browser.close();
    }
  });
} finally {
  server.process.kill("SIGTERM");
}

report({ outcomes });

/**
 * @param {{
 *   screenshotPath: string;
 *   viewport: { height: number; width: number };
 * }} options
 */
async function verifyVanillaWebgpu(options) {
  const browser = await chromium.launch({
    args: ["--enable-unsafe-webgpu", "--enable-webgpu-developer-features"]
  });

  try {
    const page = await browser.newPage({ viewport: options.viewport });
    /** @type {string[]} */
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await page.goto(`${server.url}/?backend=webgpu`, {
      waitUntil: "networkidle"
    });

    if (
      pageErrors.some((message) =>
        /capability-unavailable|mode-mismatch/.test(message)
      )
    ) {
      const backend = await page
        .locator("#stage")
        .getAttribute("data-denovo-backend")
        .catch(() => null);
      assert.notEqual(backend, "webgl2");
      return "unavailable";
    }

    const outcome = await page.waitForFunction(
      () => {
        const stage = document.querySelector("#stage");
        const ready = stage?.getAttribute("data-denovo-ready");
        const backend = stage?.getAttribute("data-denovo-backend");
        if (backend === "webgl2") {
          return "fallback";
        }
        if (ready === "true" && backend === "webgpu") {
          return "drawn";
        }
        if (ready === "error" && backend === "webgpu") {
          return "unavailable";
        }
        return false;
      },
      undefined,
      { timeout: 60_000 }
    );

    const result = await outcome.jsonValue();
    assert.notEqual(result, "fallback", "explicit webgpu must not resolve to webgl2");

    if (result === "drawn") {
      await page.waitForFunction(
        () =>
          document.querySelector("#stage")?.getAttribute("data-denovo-editor-ready") ===
            "true" &&
          Number(
            document.querySelector("#stage")?.getAttribute("data-denovo-frame-count") ??
              "0"
          ) >= 8 &&
          Number(
            document.querySelector("#stage")?.getAttribute("data-denovo-triangles") ??
              "0"
          ) > 0,
        undefined,
        { timeout: 30_000 }
      );
      const triangles = Number(
        await page.locator("#stage").getAttribute("data-denovo-triangles")
      );
      const drawCalls = Number(
        await page.locator("#stage").getAttribute("data-denovo-draw-calls")
      );
      assert.ok(triangles > 0, `WebGPU issued no triangles (${triangles})`);
      assert.ok(drawCalls > 0, `WebGPU issued no draw calls (${drawCalls})`);
      mkdirSync(path.dirname(options.screenshotPath), { recursive: true });
      const screenshot = await page.screenshot({
        path: options.screenshotPath,
        fullPage: true
      });
      const png = decodePng(screenshot);
      const seen = new Set();
      const stride = Math.max(1, Math.floor((png.width * png.height) / 4000));
      for (let index = 0; index < png.width * png.height; index += stride) {
        const offset = index * 4;
        seen.add(
          `${png.pixels[offset]},${png.pixels[offset + 1]},${png.pixels[offset + 2]}`
        );
      }
      assert.ok(
        seen.size >= 2,
        `WebGPU page screenshot did not paint more than one color (${seen.size})`
      );
      mkdirSync(path.dirname(options.screenshotPath), { recursive: true });
    }

    assert.deepEqual(
      pageErrors.filter((message) => !/WebGPU/.test(message)),
      []
    );
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
    child.on("exit", (code) => {
      if (code && code !== 0) {
        clearTimeout(timer);
        reject(new Error(`${filter} exited ${code}:\n${stdout}`));
      }
    });
  });
}

/**
 * @param {Buffer} buffer
 */
function decodePng(buffer) {
  const signature = buffer.subarray(0, 8);
  assert.deepEqual(
    Array.from(signature),
    [137, 80, 78, 71, 13, 10, 26, 10],
    "Invalid PNG signature."
  );

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  /** @type {Buffer[]} */
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    const type = buffer.subarray(offset, offset + 4).toString("ascii");
    offset += 4;
    const data = buffer.subarray(offset, offset + length);
    offset += length + 4;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? 0;
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  assert.equal(bitDepth, 8, "Only 8-bit PNG screenshots are supported.");
  assert.ok(
    colorType === 2 || colorType === 6,
    `Unsupported PNG color type: ${colorType}.`
  );

  const channelCount = colorType === 6 ? 4 : 3;
  const rowBytes = width * channelCount;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const pixels = new Uint8Array(width * height * 4);
  let inputOffset = 0;
  let previousRow = new Uint8Array(rowBytes);

  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;
    const rawRow = inflated.subarray(inputOffset, inputOffset + rowBytes);
    inputOffset += rowBytes;
    const row = unfilterRow(filter, rawRow, previousRow, channelCount);

    for (let column = 0; column < width; column += 1) {
      const sourceOffset = column * channelCount;
      const targetOffset = (rowIndex * width + column) * 4;
      pixels[targetOffset] = row[sourceOffset] ?? 0;
      pixels[targetOffset + 1] = row[sourceOffset + 1] ?? 0;
      pixels[targetOffset + 2] = row[sourceOffset + 2] ?? 0;
      pixels[targetOffset + 3] =
        channelCount === 4 ? (row[sourceOffset + 3] ?? 255) : 255;
    }

    previousRow = row;
  }

  return { height, pixels, width };
}

/**
 * @param {number | undefined} filter
 * @param {Uint8Array} rawRow
 * @param {Uint8Array} previousRow
 * @param {number} bytesPerPixel
 */
function unfilterRow(filter, rawRow, previousRow, bytesPerPixel) {
  const row = new Uint8Array(rawRow.length);

  for (let index = 0; index < rawRow.length; index += 1) {
    const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
    const up = previousRow[index] ?? 0;
    const upperLeft =
      index >= bytesPerPixel ? previousRow[index - bytesPerPixel] : 0;
    const source = rawRow[index] ?? 0;

    switch (filter) {
      case 0:
        row[index] = source;
        break;
      case 1:
        row[index] = (source + left) & 0xff;
        break;
      case 2:
        row[index] = (source + up) & 0xff;
        break;
      case 3:
        row[index] = (source + Math.floor((left + up) / 2)) & 0xff;
        break;
      case 4:
        row[index] = (source + paeth(left, up, upperLeft)) & 0xff;
        break;
      default:
        throw new Error(`Unsupported PNG filter: ${filter}.`);
    }
  }

  return row;
}

/**
 * @param {number} left
 * @param {number} up
 * @param {number} upperLeft
 */
function paeth(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);

  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) {
    return left;
  }

  if (upDistance <= upperLeftDistance) {
    return up;
  }

  return upperLeft;
}
