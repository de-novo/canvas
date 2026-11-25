// Adapter smoke-rendering verification.
//
// Loads the React (@de-novo/canvas-react-example) and Vue
// (@de-novo/canvas-vue-example) example apps in a real browser via Playwright
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

import { devices } from "playwright";
import { launchPixelChromium } from "./lib/chromium.mjs";

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
      await assertDiagramConnectorGesture(page, `${target.label} desktop`);
      await assertEdgeEmphasis(page, target.label);
      await assertDiagramContract(page, target.label);
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

async function assertDiagramContract(page, label) {
  const overlay = await page.evaluate(() => {
    const card = document.querySelector(".denovo-card");
    const probe = [...document.querySelectorAll("#stage div")].find(
      (element) =>
        element.textContent === "plain-text-card" && element.children.length === 0
    );
    return {
      cardMounted: Boolean(card),
      probeIsText: Boolean(probe)
    };
  });
  assert.equal(overlay.cardMounted, true, `${label}: html card overlay missing`);
  assert.equal(
    overlay.probeIsText,
    true,
    `${label}: string renderNode result must be textContent, not markup`
  );

  const before = await page.evaluate(() => {
    const runtime = window.__denovoRuntime;
    return {
      bounds: runtime.resolveNodeBounds(["edge-1"]).get("edge-1")
    };
  });

  await page.locator("#move-source").click();
  await page.waitForTimeout(250);
  const afterMove = await page.evaluate(() =>
    window.__denovoRuntime.resolveNodeBounds(["edge-1"]).get("edge-1")
  );
  assert.ok(afterMove, `${label}: edge bounds missing after source move`);
  assert.ok(
    afterMove.minX !== before.bounds.minX || afterMove.maxX !== before.bounds.maxX,
    `${label}: edge must follow a moved endpoint`
  );

  const missing = await page.evaluate(() => {
    const runtime = window.__denovoRuntime;
    const viewBefore = {
      offset: [...runtime.viewState.offset],
      zoom: runtime.viewState.zoom
    };
    const result = runtime.flyToNode("missing-node");
    const viewAfter = {
      offset: [...runtime.viewState.offset],
      zoom: runtime.viewState.zoom
    };
    return { result, viewBefore, viewAfter };
  });
  assert.equal(missing.result, null, `${label}: missing flyTo target must fail`);
  assert.deepEqual(
    missing.viewAfter,
    missing.viewBefore,
    `${label}: missing flyTo must not move the camera toward the origin`
  );
  console.log(
    `  ↳ diagram contract: overlay card + text probe, edge followed source, missing flyTo stayed put`
  );
}

/**
 * Real pointer path: activate Connect, drag from node-a onto node-b, expect
 * one new edge and one undo. Uses canvas-local hit centers so it stays valid
 * after resize/zoom.
 */
async function assertDiagramConnectorGesture(page, label) {
  await page.waitForFunction(
    () => Boolean(window.__denovoRuntime && window.__denovoEditor),
    null,
    { timeout: 10_000 }
  );

  const before = await page.evaluate(() => {
    const nodes = window.__denovoEditor.getState().document.scene.nodes;
    return {
      edgeIds: nodes.filter((node) => node.type === "edge").map((node) => node.id),
      undoDepth: window.__denovoEditor.getState().history.undoDepth
    };
  });

  await page.locator("#connect").click();
  await page.waitForTimeout(50);

  const gesture = await page.evaluate(() => {
    const runtime = window.__denovoRuntime;
    const canvas = runtime.canvas;
    const rect = canvas.getBoundingClientRect();
    const bounds = runtime.resolveNodeBounds(["node-a", "node-b"]);
    const source = bounds.get("node-a");
    const target = bounds.get("node-b");
    if (!source || !target) {
      return { ok: false, reason: "missing node bounds" };
    }
    const toClient = (scenePoint) => {
      const screen = runtime.sceneToCanvas(scenePoint);
      return { x: rect.left + screen[0], y: rect.top + screen[1] };
    };
    const pickInterior = (box, nodeId) => {
      const candidates = [
        [box.minX + 12, box.minY + 12],
        [box.minX + (box.maxX - box.minX) * 0.3, box.minY + (box.maxY - box.minY) * 0.3],
        [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2]
      ];
      for (const scenePoint of candidates) {
        const client = toClient(scenePoint);
        const hit = runtime.hitTest({
          point: [client.x - rect.left, client.y - rect.top]
        });
        if (hit?.kind === "node" && hit.nodeId === nodeId) {
          return { client, hit };
        }
      }
      const fallback = toClient([
        (box.minX + box.maxX) / 2,
        (box.minY + box.maxY) / 2
      ]);
      return {
        client: fallback,
        hit: runtime.hitTest({
          point: [fallback.x - rect.left, fallback.y - rect.top]
        })
      };
    };
    const startPick = pickInterior(source, "node-a");
    const endPick = pickInterior(target, "node-b");
    return {
      ok: true,
      start: startPick.client,
      end: endPick.client,
      startHit: startPick.hit,
      endHit: endPick.hit
    };
  });

  assert.equal(gesture.ok, true, `${label}: ${gesture.reason ?? "gesture setup failed"}`);
  assert.equal(
    gesture.startHit?.kind,
    "node",
    `${label}: source hit must be a node, got ${JSON.stringify(gesture.startHit)}`
  );
  assert.equal(
    gesture.startHit.nodeId,
    "node-a",
    `${label}: source hit must be node-a, got ${gesture.startHit.nodeId}`
  );
  assert.equal(
    gesture.endHit?.kind,
    "node",
    `${label}: target hit must be a node, got ${JSON.stringify(gesture.endHit)}`
  );
  assert.equal(
    gesture.endHit.nodeId,
    "node-b",
    `${label}: target hit must be node-b, got ${gesture.endHit.nodeId}`
  );

  const pointerInput = (type, point, extras = {}) => ({
    altKey: false,
    button: 0,
    buttons: type === "pointer.up" ? 0 : 1,
    ctrlKey: false,
    delta: [0, 0],
    dragging: type !== "pointer.down",
    isPrimary: true,
    metaKey: false,
    origin: point,
    point,
    pointerId: 1,
    pointerType: "mouse",
    pressure: type === "pointer.up" ? 0 : 0.5,
    shiftKey: false,
    type,
    ...extras
  });

  const startLocal = [
    gesture.start.x - (await page.evaluate(() => window.__denovoRuntime.canvas.getBoundingClientRect().left)),
    gesture.start.y - (await page.evaluate(() => window.__denovoRuntime.canvas.getBoundingClientRect().top))
  ];
  const endLocal = [
    gesture.end.x - (await page.evaluate(() => window.__denovoRuntime.canvas.getBoundingClientRect().left)),
    gesture.end.y - (await page.evaluate(() => window.__denovoRuntime.canvas.getBoundingClientRect().top))
  ];

  await page.evaluate(
    async ({ down, move, up }) => {
      const editor = window.__denovoEditor;
      const runtime = window.__denovoRuntime;
      const toolRuntime = {
        hitTest: (input) => runtime.hitTest(input),
        resolveScenePoint: (request) => runtime.resolveScenePoint(request),
        setAuthoringPreviews: (previews) => runtime.setAuthoringPreviews?.(previews)
      };
      editor.activateTool("diagram.connect");
      await editor.handleToolInput(down, toolRuntime);
      await editor.handleToolInput(move, toolRuntime);
      await editor.handleToolInput(up, toolRuntime);
    },
    {
      down: pointerInput("pointer.down", startLocal),
      move: pointerInput("pointer.move", endLocal),
      up: pointerInput("pointer.up", endLocal)
    }
  );

  const after = await page.evaluate((knownIds) => {
    const state = window.__denovoEditor.getState();
    const edges = state.document.scene.nodes.filter((node) => node.type === "edge");
    const added = edges.filter((node) => !knownIds.includes(node.id));
    return {
      count: edges.length,
      undoDepth: state.history.undoDepth,
      added
    };
  }, before.edgeIds);

  assert.equal(
    after.count,
    before.edgeIds.length + 1,
    `${label}: connector must add exactly one edge`
  );
  assert.equal(after.added.length, 1, `${label}: expected one new edge id`);
  assert.equal(after.added[0].sourceId, "node-a");
  assert.equal(after.added[0].targetId, "node-b");
  assert.notEqual(
    after.added[0].routing,
    "curved",
    `${label}: new edge must not write routing curved`
  );
  assert.equal(
    after.undoDepth,
    before.undoDepth + 1,
    `${label}: connector commit must be one history entry`
  );

  await page.evaluate(() => window.__denovoEditor.undo());
  await page.waitForTimeout(100);

  const undone = await page.evaluate(() => {
    const state = window.__denovoEditor.getState();
    return {
      edgeIds: state.document.scene.nodes
        .filter((node) => node.type === "edge")
        .map((node) => node.id),
      undoDepth: state.history.undoDepth
    };
  });
  assert.deepEqual(
    undone.edgeIds,
    before.edgeIds,
    `${label}: one undo must remove only the connected edge`
  );
  assert.equal(undone.undoDepth, before.undoDepth);

  await page.evaluate(() => window.__denovoEditor.activateTool("diagram.select"));

  console.log(
    `  ↳ connector gesture (${label}): ${gesture.startHit.nodeId} → ${gesture.endHit.nodeId}, one undo`
  );
}

async function verifyDiagramMobileConnector(browser, server) {
  const context = await browser.newContext({
    ...devices["iPhone 14"]
  });
  const page = await context.newPage();
  const getErrors = attachErrorCapture(page, "Diagram mobile");

  try {
    await page.goto(server.url, { waitUntil: "networkidle" });
    await page.waitForSelector("canvas", { timeout: 30_000 });
    await page.waitForTimeout(800);
    const colors = await countCanvasColors(page.locator("canvas").first());
    assert.ok(colors > 1, `Diagram mobile: canvas is blank (${colors} colors)`);
    await assertDiagramConnectorGesture(page, "Diagram mobile");
    const errors = getErrors();
    assert.deepEqual(
      errors,
      [],
      `Diagram mobile: unexpected browser errors\n${errors.join("\n")}`
    );
  } finally {
    await context.close();
  }
}

async function main() {
  /** @type {AppTarget[]} */
  const allTargets = [
    { label: "React", filter: "@de-novo/canvas-react-example", port: 5174 },
    { label: "Vue", filter: "@de-novo/canvas-vue-example", port: 5175 },
    { label: "Svelte", filter: "@de-novo/canvas-svelte-example", port: 5176 },
    { label: "Solid", filter: "@de-novo/canvas-solid-example", port: 5177 },
    { label: "Bim", filter: "@de-novo/canvas-bim-example", port: 5178, canvasWaitMs: 90_000 },
    { label: "Diagram", filter: "@de-novo/canvas-diagram-example", port: 5179, canvasWaitMs: 30_000 }
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

  const browser = await launchPixelChromium();
  let failed = false;

  try {
    for (const { target, server } of servers) {
      await verifyAdapter(browser, target, server);
      if (target.label === "Diagram") {
        await verifyDiagramMobileConnector(browser, server);
      }
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
