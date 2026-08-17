// Adapter smoke-rendering verification.
//
// Loads the React (@denovo/canvas-react-example) and Vue
// (@denovo/canvas-vue-example) example apps in a real browser via Playwright
// and confirms each adapter actually paints pixels:
//   - page loads with no console/page errors
//   - a <canvas> exists with non-zero size
//   - the canvas is non-blank (more than one distinct color) after initial render
//   - the canvas is still non-blank after a viewport resize
//   - swapping the scene (3d -> 2d) still produces a non-blank canvas
//
// This is intentionally a *smoke* check — it verifies the adapter mounts and
// renders, not the full authoring/transform coverage the vanilla
// `verify:browser-rendering` suite exercises. Run with:
//   pnpm verify:browser-rendering-adapters

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { inflateSync } from "node:zlib";

import { chromium, devices } from "playwright";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", ...devices["iPhone 14"] }
];

// Console patterns that are benign in headless WebGL and must not fail the run.
const ALLOWED_CONSOLE_PATTERNS = [
  /^WARNING: Too many active WebGL contexts\. Oldest context will be lost\.$/,
  /^\[\.WebGL-0x[0-9a-f]+\]GL Driver Message \(OpenGL, Performance, GL_CLOSE_PATH_NV, High\): GPU stall due to ReadPixels/,
  /^WebGL: CONTEXT_LOST_WEBGL: loseContext: context lost$/
];

/**
 * @typedef {{ port: number, filter: string, label: string, canvasWaitMs?: number }} AppTarget
 */

/**
 * @param {AppTarget} target
 * @returns {Promise<{ url: string, child: import("node:child_process").ChildProcess }>}
 */
async function startVite(target) {
  const child = spawn(
    "pnpm",
    [
      "--filter",
      target.filter,
      "exec",
      "vite",
      "--host",
      "127.0.0.1",
      "--port",
      String(target.port)
    ],
    {
      env: { ...process.env, CI: "1" },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  let output = "";
  child.stdout?.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr?.on("data", (chunk) => {
    output += chunk.toString();
  });

  const stripAnsi = (value) => value.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");

  const url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for Vite server (${target.label}).\n${output}`));
    }, 60_000);

    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Vite exited before ready with code ${code} (${target.label}).\n${output}`));
    });

    const interval = setInterval(() => {
      const plain = stripAnsi(output);
      const match = plain.match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+\/)/);
      if (match?.[1]) {
        clearInterval(interval);
        clearTimeout(timeout);
        resolve(match[1]);
      }
    }, 200);
  });

  return { url, child };
}

/**
 * Decodes an 8-bit PNG screenshot buffer into RGBA pixels. Mirrors the helper
 * in verify-browser-rendering.mjs — duplicated here to keep this script
 * self-contained.
 *
 * @param {Buffer} buffer
 * @returns {{ width: number, height: number, pixels: Uint8Array }}
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
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    const type = buffer.subarray(offset, offset + 4).toString("ascii");
    offset += 4;
    const data = buffer.subarray(offset, offset + length);
    offset += length;
    offset += 4;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
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
  const bytesPerPixel = channelCount;
  const rowBytes = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const pixels = new Uint8Array(width * height * 4);
  let inputOffset = 0;
  let previousRow = new Uint8Array(rowBytes);

  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;
    const rawRow = inflated.subarray(inputOffset, inputOffset + rowBytes);
    inputOffset += rowBytes;
    const row = unfilterRow(filter, rawRow, previousRow, bytesPerPixel);

    for (let column = 0; column < width; column += 1) {
      const sourceOffset = column * bytesPerPixel;
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

function unfilterRow(filter, rawRow, previousRow, bytesPerPixel) {
  const row = new Uint8Array(rawRow.length);

  for (let index = 0; index < rawRow.length; index += 1) {
    const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
    const up = previousRow[index] ?? 0;
    const upperLeft =
      index >= bytesPerPixel ? previousRow[index - bytesPerPixel] : 0;

    switch (filter) {
      case 0:
        row[index] = rawRow[index];
        break;
      case 1:
        row[index] = (rawRow[index] + left) & 0xff;
        break;
      case 2:
        row[index] = (rawRow[index] + up) & 0xff;
        break;
      case 3:
        row[index] = (rawRow[index] + ((left + up) >> 1)) & 0xff;
        break;
      case 4:
        row[index] = (rawRow[index] + paeth(left, up, upperLeft)) & 0xff;
        break;
      default:
        throw new Error(`Unsupported PNG filter: ${filter}`);
    }
  }

  return row;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);

  if (pa <= pb && pa <= pc) {
    return a;
  }
  if (pb <= pc) {
    return b;
  }
  return c;
}

/**
 * Counts distinct quantized colors in a Playwright canvas screenshot. Using
 * the element screenshot (rather than canvas.toDataURL) avoids the WebGL
 * preserveDrawingBuffer pitfall that yields blank readbacks on demand-rendered
 * scenes.
 *
 * @param {import("playwright").Locator} canvas
 * @returns {Promise<number>}
 */
async function countCanvasColors(canvas) {
  const screenshot = await canvas.screenshot();
  const { width, height, pixels } = decodePng(screenshot);

  if (width === 0 || height === 0) {
    return 0;
  }

  const colors = new Set();
  // Sample every Nth pixel to bound cost.
  const step = 4;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const offset = (y * width + x) * 4;
      // Quantize to drop near-identical pixels from anti-aliasing.
      const key = `${pixels[offset] >> 4}-${pixels[offset + 1] >> 4}-${pixels[offset + 2] >> 4}`;
      colors.add(key);
    }
  }
  return colors.size;
}

/**
 * @param {import("playwright").Page} page
 * @param {string} label
 */
function attachErrorCapture(page, label) {
  /** @type {string[]} */
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (!ALLOWED_CONSOLE_PATTERNS.some((pattern) => pattern.test(text))) {
        errors.push(`console.error: ${text}`);
      }
    }
  });
  page.on("pageerror", (error) => {
    errors.push(`pageerror: ${error.message}`);
  });
  return () => errors.map((error) => `[${label}] ${error}`);
}

/**
 * @param {import("playwright").Browser} browser
 * @param {AppTarget} target
 * @param {{ url: string }} server
 */
async function verifyAdapter(browser, target, server) {
  const context = await browser.newContext({
    viewport: { width: VIEWPORTS[0].width, height: VIEWPORTS[0].height }
  });
  const page = await context.newPage();
  const getErrors = attachErrorCapture(page, target.label);

  try {
    await page.goto(server.url, { waitUntil: "networkidle" });

    // Wait for the adapter to mount a canvas. The timeout is generous because
    // Vite's first per-app dependency pre-bundle can take a while when several
    // adapter dev servers run in parallel.
    try {
      await page.waitForSelector("canvas", { timeout: target.canvasWaitMs ?? 45_000 });
    } catch (error) {
      const url = page.url();
      const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 300) ?? "(no body)");
      const bodyHtml = await page.evaluate(() => document.body?.innerHTML?.slice(0, 500) ?? "(no body)");
      const consoleErrors = getErrors();
      throw new Error(
        `${target.label}: canvas never mounted.\n` +
          `  url: ${url}\n` +
          `  bodyText: ${bodyText}\n` +
          `  bodyHtml: ${bodyHtml}\n` +
          `  consoleErrors: ${consoleErrors.join(" | ") || "(none)"}\n` +
          `  cause: ${error.message}`
      );
    }

    const canvas = page.locator("canvas").first();

    // Initial render: give demand-rendered scenes a moment to paint.
    await page.waitForTimeout(1000);
    let colors = await countCanvasColors(canvas);
    assert.ok(
      colors > 1,
      `${target.label}: canvas is blank after initial render (${colors} colors)`
    );

    const initialColors = colors;

    // Resize the viewport and confirm the canvas keeps painting.
    await page.setViewportSize({ width: 900, height: 600 });
    await page.waitForTimeout(800);
    colors = await countCanvasColors(canvas);
    assert.ok(
      colors > 1,
      `${target.label}: canvas is blank after resize (${colors} colors)`
    );

    // Swap scene (3d -> 2d) and confirm the new scene paints.
    const swapButton = page.locator('[data-denovo-control="swap"]');
    if (await swapButton.count()) {
      await swapButton.click();
      await page.waitForTimeout(1000);
      const modeReadout = await page.locator("#mode-readout").textContent();
      assert.ok(
        modeReadout === "2d",
        `${target.label}: scene swap did not switch to 2d mode (got ${modeReadout})`
      );
      colors = await countCanvasColors(canvas);
      assert.ok(
        colors > 1,
        `${target.label}: canvas is blank after scene swap (${colors} colors)`
      );
    }

    // The diagram app exposes its runtime, so selection emphasis can be checked
    // in pixels rather than assumed.
    if (target.label === "Diagram") {
      await assertEdgeEmphasis(page, target.label);
    }

    const errors = getErrors();
    assert.deepEqual(
      errors,
      [],
      `${target.label}: unexpected browser errors\n${errors.join("\n")}`
    );

    console.log(
      `  ✅ ${target.label}: rendered ${initialColors} colors initially, survived resize + scene swap, no errors`
    );
  } finally {
    await context.close();
  }
}

/**
 * Selection must recolour an edge and thicken it; hover must thicken only.
 * Sampled from real pixels because this is exactly the kind of wiring that
 * type-checks while drawing nothing.
 */
async function assertEdgeEmphasis(page, label) {
  await page.waitForFunction(() => Boolean(window.__denovoRuntime), null, {
    timeout: 10_000
  });

  await page.evaluate(() => {
    const runtime = window.__denovoRuntime;
    const scene = runtime.getScene();
    runtime.update({
      ...scene,
      nodes: [
        ...scene.nodes,
        {
          id: "emphasis-probe-edge",
          layerId: "main",
          type: "edge",
          sourceId: "node-a",
          targetId: "node-b",
          stroke: "#ff0000",
          strokeWidth: 2,
          targetArrow: false
        }
      ]
    });
  });
  await page.waitForTimeout(250);

  const sample = () =>
    page.evaluate(() => {
      const runtime = window.__denovoRuntime;
      const canvas = document.querySelector("canvas");
      const context = canvas.getContext("2d");
      const bounds = runtime.resolveNodeBounds(["node-a", "node-b"]);
      const centre = (rect) => [
        (rect.minX + rect.maxX) / 2,
        (rect.minY + rect.maxY) / 2
      ];
      const [ax, ay] = centre(bounds.get("node-a"));
      const [bx, by] = centre(bounds.get("node-b"));
      const screen = runtime.sceneToCanvas([(ax + bx) / 2, (ay + by) / 2]);
      const ratio = canvas.width / canvas.getBoundingClientRect().width;
      const strip = context.getImageData(
        Math.round(screen[0] * ratio),
        Math.round(screen[1] * ratio) - 20,
        1,
        40
      ).data;

      // The canvas background is opaque, so "drawn" means "not background".
      const counts = new Map();
      let covered = 0;
      for (let index = 0; index < strip.length; index += 4) {
        const colour = `${strip[index]},${strip[index + 1]},${strip[index + 2]}`;
        if (colour === "17,24,39") continue;
        covered += 1;
        counts.set(colour, (counts.get(colour) ?? 0) + 1);
      }
      let dominant = null;
      for (const [colour, n] of counts) {
        if (!dominant || n > counts.get(dominant)) dominant = colour;
      }
      return { covered, dominant };
    });

  const idle = await sample();
  assert.ok(idle.covered > 0, `${label}: probe edge was not drawn`);
  assert.equal(
    idle.dominant,
    "255,0,0",
    `${label}: idle edge should keep its own stroke colour, got ${idle.dominant}`
  );

  await page.evaluate(() =>
    window.__denovoRuntime.setSelection(
      ["emphasis-probe-edge"],
      "emphasis-probe-edge"
    )
  );
  await page.waitForTimeout(250);
  const selected = await sample();
  assert.notEqual(
    selected.dominant,
    idle.dominant,
    `${label}: selected edge must change colour`
  );
  assert.ok(
    selected.covered > idle.covered,
    `${label}: selected edge must be thicker (${idle.covered} -> ${selected.covered})`
  );

  await page.evaluate(() => {
    window.__denovoRuntime.setSelection([], null);
    window.__denovoRuntime.setHoveredNode("emphasis-probe-edge");
  });
  await page.waitForTimeout(250);
  const hovered = await sample();
  assert.equal(
    hovered.dominant,
    idle.dominant,
    `${label}: hover must not recolour the edge`
  );
  assert.ok(
    hovered.covered > idle.covered && hovered.covered < selected.covered,
    `${label}: hover must sit between idle and selected (${idle.covered}/${hovered.covered}/${selected.covered})`
  );

  // Leave the scene as found so later assertions see the original canvas.
  await page.evaluate(() => window.__denovoRuntime.setHoveredNode(null));
  console.log(
    `  ↳ edge emphasis: idle ${idle.covered}px, selected ${selected.covered}px (${selected.dominant}), hover ${hovered.covered}px`
  );
}

async function main() {
  /** @type {AppTarget[]} */
  const allTargets = [
    { label: "React", filter: "@denovo/canvas-react-example", port: 5174 },
    { label: "Vue", filter: "@denovo/canvas-vue-example", port: 5175 },
    { label: "Svelte", filter: "@denovo/canvas-svelte-example", port: 5176 },
    { label: "Solid", filter: "@denovo/canvas-solid-example", port: 5177 },
    { label: "Bim", filter: "@denovo/canvas-bim-example", port: 5178, canvasWaitMs: 90_000 },
    { label: "Diagram", filter: "@denovo/canvas-diagram-example", port: 5179, canvasWaitMs: 30_000 }
  ];
  const onlyEnv = process.env.ADAPTER_ONLY;
  const targets = onlyEnv
    ? allTargets.filter((target) => target.label === onlyEnv)
    : allTargets;

  const servers = await Promise.all(
    targets.map(async (target) => ({
      target,
      server: await startVite(target)
    }))
  );

  const browser = await chromium.launch();
  let failed = false;

  try {
    for (const { target, server } of servers) {
      await verifyAdapter(browser, target, server);
    }
    console.log(`\n${"=".repeat(60)}`);
    console.log("All adapter smoke checks passed.");
    console.log(`${"=".repeat(60)}`);
  } catch (error) {
    failed = true;
    console.error(`\n❌ Adapter smoke check failed:\n${error.message}`);
  } finally {
    await browser.close();
    for (const { server } of servers) {
      server.child.kill("SIGTERM");
    }
  }

  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
