// @ts-check
/**
 * Absorption proof for the release-board showcase.
 * The board is a Denovo document: no iframe, pickable cards, named-op
 * label hide, and undo.
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
  "artifacts/verification/flow-release-board.png"
);
const mobileShot = path.resolve(
  root,
  "artifacts/verification/flow-release-board-mobile.png"
);

const server = await startApp("@denovo/canvas-flow-example", 5181);

try {
  await check("flow-showcase-desktop-absorbs-and-edits", async () => {
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
          document.querySelector("#stage")?.getAttribute("data-denovo-flow-ready") ===
          "true",
        undefined,
        { timeout: 30_000 }
      );

      const iframeCount = await page.locator("iframe").count();
      assert.equal(iframeCount, 0);

      const cards = page.locator("[data-flow-card]");
      await cards.first().waitFor({ timeout: 10_000 });
      assert.equal(await cards.count(), 5);

      const canvas = page.locator("#stage canvas:not(.denovo-canvas-minimap)").first();
      const box = await canvas.boundingBox();
      assert.ok(box && box.width > 200 && box.height > 200);

      const colors = await countCanvasColors(page);
      assert.ok(colors >= 2, `expected a painted canvas, got ${colors} colors`);

      const hitPoint = await page.evaluate(() => {
        const runtime = window.__denovoRuntime;
        if (!runtime) {
          return null;
        }
        for (let y = 20; y < 760; y += 16) {
          for (let x = 20; x < 880; x += 16) {
            const hit = runtime.hitTest({ point: [x, y] });
            if (hit.kind === "node" && hit.nodeId === "build") {
              return { x, y };
            }
          }
        }
        return null;
      });
      assert.ok(hitPoint, "build card should hit-test on the canvas");
      await page.locator("#stage canvas[data-denovo-canvas]").click({
        position: hitPoint
      });
      await page.waitForFunction(
        () => window.__flowShowcase?.selectedId === "build",
        undefined,
        { timeout: 10_000 }
      );

      await page.locator('[data-denovo-control="hide-labels"]').click();
      await page.waitForFunction(
        () => window.__flowShowcase?.labelVisible === false,
        undefined,
        { timeout: 10_000 }
      );
      const hidden = await page.evaluate(() => window.__flowShowcase);
      assert.equal(hidden?.labelVisible, false);
      assert.equal(hidden?.undoDepth, 1);
      assert.equal(
        hidden?.listed.find((node) => node.id === "title")?.visible,
        false
      );

      mkdirSync(path.dirname(desktopShot), { recursive: true });
      await page.screenshot({ path: desktopShot, fullPage: true });

      await page.locator('[data-denovo-control="undo"]').click();
      await page.waitForFunction(
        () => window.__flowShowcase?.labelVisible === true,
        undefined,
        { timeout: 10_000 }
      );
      const restored = await page.evaluate(() => window.__flowShowcase);
      assert.equal(restored?.labelVisible, true);
      assert.equal(restored?.undoDepth, 0);

      await page.getByLabel("Card title").fill("Prepare release");
      await page.getByLabel("Owner").fill("Core");
      await page.locator("#card-status").selectOption("review");
      await page.getByRole("button", { name: "Apply changes" }).click();
      const card = page.locator('[data-flow-card="build"]');
      await card.locator(".flow-card-title", { hasText: "Prepare release" }).waitFor();
      await card.locator(".flow-card-owner", { hasText: "Core" }).waitFor();
      assert.equal(await card.getAttribute("data-flow-status"), "review");
      assert.equal(await page.evaluate(() => window.__flowShowcase.undoDepth), 1);
      await page.getByRole("button", { name: "Undo" }).click();
      await card.locator(".flow-card-title", { hasText: "Build" }).waitFor();
      await card.locator(".flow-card-owner", { hasText: "Engineering" }).waitFor();
      assert.equal(await card.getAttribute("data-flow-status"), "progress");
      assert.equal(await page.getByLabel("Card title").inputValue(), "Build");
      assert.equal(await page.getByLabel("Owner").inputValue(), "Engineering");

      await verifySavedEdits(page, false);
      assert.deepEqual(consoleErrors, []);
    } finally {
      await browser.close();
    }
  });

  await check("flow-showcase-mobile-touch-edits-and-restores", async () => {
    const browser = await launchPixelChromium();
    try {
      const page = await browser.newPage({
        ...devices["iPhone 14"]
      });
      await page.goto(server.url, { waitUntil: "networkidle" });
      await page.waitForFunction(
        () =>
          document.querySelector("#stage")?.getAttribute("data-denovo-flow-ready") ===
          "true",
        undefined,
        { timeout: 30_000 }
      );
      assert.equal(await page.locator("iframe").count(), 0);
      assert.equal(await page.locator("[data-flow-card]").count(), 5);
      const point = await pickCard(page, "build");
      await page.touchscreen.tap(point.x, point.y);
      await verifySavedEdits(page, true, async () => {
        mkdirSync(path.dirname(mobileShot), { recursive: true });
        await page.screenshot({ path: mobileShot, fullPage: true });
      });
    } finally {
      await browser.close();
    }
  });
} finally {
  server.process.kill("SIGTERM");
}

report();

async function pickCard(page, id) {
  await page.locator("#stage").scrollIntoViewIfNeeded();
  return page.evaluate(id => {
    const runtime = window.__denovoRuntime;
    const rect = runtime.canvas.getBoundingClientRect();
    const bounds = runtime.current.resolveNodeBounds([id]).get(id);
    for (const fraction of [0.25, 0.4, 0.65]) {
      const point = runtime.current.sceneToCanvas([
        bounds.minX + fraction * (bounds.maxX - bounds.minX),
        bounds.minY + fraction * (bounds.maxY - bounds.minY)
      ]);
      const hit = runtime.hitTest({ point });
      if (hit.kind === "node" && hit.nodeId === id) {
        return { x: rect.left + point[0], y: rect.top + point[1] };
      }
    }
    throw new Error("Could not pick " + id);
  }, id);
}

async function pickEdge(page, id) {
  await page.locator("#stage").scrollIntoViewIfNeeded();
  return page.evaluate(edgeId => {
    const runtime = window.__denovoRuntime;
    const editor = window.__denovoEditor;
    const rect = runtime.canvas.getBoundingClientRect();
    const edge = editor.getState().document.scene.nodes.find(node => node.id === edgeId);
    if (!edge || edge.type !== "edge") {
      throw new Error("Missing edge " + edgeId);
    }
    const bounds = runtime.current.resolveNodeBounds([edge.sourceId, edge.targetId]);
    const source = bounds.get(edge.sourceId);
    const target = bounds.get(edge.targetId);
    const minX = Math.min(source.minX, target.minX);
    const maxX = Math.max(source.maxX, target.maxX);
    const minY = Math.min(source.minY, target.minY);
    const maxY = Math.max(source.maxY, target.maxY);
    const topLeft = runtime.current.sceneToCanvas([minX, minY]);
    const bottomRight = runtime.current.sceneToCanvas([maxX, maxY]);
    for (let y = Math.floor(topLeft[1]); y <= Math.ceil(bottomRight[1]); y += 2) {
      for (let x = Math.floor(topLeft[0]); x <= Math.ceil(bottomRight[0]); x += 2) {
        const hit = runtime.hitTest({ point: [x, y] });
        if (hit.kind === "node" && hit.nodeId === edgeId) {
          return { x: rect.left + x, y: rect.top + y };
        }
      }
    }
    throw new Error("Could not pick edge " + edgeId);
  }, id);
}

async function verifySavedEdits(page, touch, onRestored) {
  const card = page.locator('[data-flow-card="build"]');
  const press = async name => {
    const button = page.getByRole("button", { name, exact: true });
    if (touch) {
      await button.scrollIntoViewIfNeeded();
      await page.evaluate(
        () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      );
      await button.tap();
      return;
    }
    await button.click();
  };
  const waitForAddedCard = async step => {
    try {
      await addedCard.waitFor({ timeout: 10_000 });
    } catch (error) {
      const diag = await page.evaluate(() => {
        const el = document.querySelector('[data-flow-card="card-1"]');
        return {
          cardCount: document.querySelectorAll("[data-flow-card]").length,
          card1Present: Boolean(el),
          card1Display: el instanceof HTMLElement ? el.style.display : null,
          probe: window.__flowShowcase,
          status: document.querySelector("#status")?.textContent ?? null
        };
      });
      throw new Error(`${step}: ${error}\ndiag=${JSON.stringify(diag)}`);
    }
  };
  const selectPoint = point =>
    touch ? page.touchscreen.tap(point.x, point.y) : page.mouse.click(point.x, point.y);
  const snapshot = () => page.evaluate(() => window.__denovoEditor.getState().document);

  await page.getByLabel("Card title").fill("Release candidate");
  await page.getByLabel("Owner").fill("Platform");
  await page.locator("#card-status").selectOption("review");
  await press("Apply changes");
  await card.getByText("Release candidate").waitFor();
  await card.locator(".flow-card-owner", { hasText: "Platform" }).waitFor();

  async function cardOffsetY(id) {
    await page.locator("#stage").scrollIntoViewIfNeeded();
    const bounds = await page.locator(`[data-flow-card="${id}"]`).boundingBox();
    assert.ok(bounds);
    const stage = await page.locator("#stage").boundingBox();
    assert.ok(stage);
    return bounds.y - stage.y;
  }
  async function drag(from, to) {
    if (touch) {
      const session = await page.context().newCDPSession(page);
      try {
        await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
        for (let step = 1; step <= 10; step++) {
          const x = from.x + (to.x - from.x) * step / 10;
          const y = from.y + (to.y - from.y) * step / 10;
          await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
        }
        await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      } finally {
        await session.detach();
      }
      return;
    }
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
  }
  const original = await cardOffsetY("build");
  await press("Move");
  const grip = await pickCard(page, "build");
  await drag(grip, { x: grip.x, y: grip.y + 65 });
  await page.waitForFunction(() => window.__flowShowcase.undoDepth === 2, undefined, { timeout: 10_000 }).catch(() => { throw new Error("Card move did not commit"); });
  const moved = await cardOffsetY("build");
  assert.ok(moved > original + 20);
  await press("Connect");
  await drag(await pickCard(page, "intake"), await pickCard(page, "build"));
  await page.waitForFunction(() => window.__flowShowcase.undoDepth === 3, undefined, { timeout: 10_000 }).catch(() => { throw new Error("Connector did not commit"); });

  // Add a new card, edit it, and verify undo/redo.
  await press("Add card");
  const addedCard = page.locator('[data-flow-card="card-1"]');
  await waitForAddedCard("after Add card");
  assert.equal(await page.locator("[data-flow-card]").count(), 6);
  assert.equal(await page.evaluate(() => window.__flowShowcase.selectedId), "card-1");
  assert.equal(await page.evaluate(() => window.__flowShowcase.undoDepth), 4);
  await page.getByLabel("Card title").fill("Verify rollout");
  await page.getByLabel("Owner").fill("Ops");
  await page.locator("#card-status").selectOption("progress");
  await press("Apply changes");
  await addedCard.locator(".flow-card-title", { hasText: "Verify rollout" }).waitFor();
  await addedCard.locator(".flow-card-owner", { hasText: "Ops" }).waitFor();
  assert.equal(await page.evaluate(() => window.__flowShowcase.undoDepth), 5);
  await press("Undo");
  await addedCard.locator(".flow-card-title", { hasText: "Task 1" }).waitFor();
  assert.equal(await page.evaluate(() => window.__flowShowcase.redoDepth), 1);
  await press("Redo");
  await addedCard.locator(".flow-card-title", { hasText: "Verify rollout" }).waitFor();
  assert.equal(await page.evaluate(() => window.__flowShowcase.redoDepth), 0);

  // Connect build -> card-1, delete card-1 with its incident edge in one undo step, then restore both.
  await press("Connect");
  await drag(await pickCard(page, "build"), await pickCard(page, "card-1"));
  await page.waitForFunction(() => window.__flowShowcase.undoDepth === 6, undefined, { timeout: 10_000 }).catch(() => { throw new Error("Second connector did not commit"); });
  const hasNewCardEdge = async () =>
    (await snapshot()).scene.nodes.some(
      node => node.type === "edge" && node.sourceId === "build" && node.targetId === "card-1"
    );
  assert.equal(await hasNewCardEdge(), true);
  await press("Select");
  await selectPoint(await pickCard(page, "card-1"));
  await page.waitForFunction(() => window.__flowShowcase.selectedId === "card-1", undefined, { timeout: 10_000 });
  await press("Delete selected");
  await page.waitForFunction(() => window.__flowShowcase.undoDepth === 7, undefined, { timeout: 10_000 });
  assert.equal(await page.locator('[data-flow-card="card-1"]').count(), 0);
  assert.equal(await hasNewCardEdge(), false);
  await press("Undo");
  await waitForAddedCard("after Undo delete card-1");
  assert.equal(await hasNewCardEdge(), true);
  assert.equal(await page.evaluate(() => window.__flowShowcase.undoDepth), 6);

  // Select and delete an existing edge, verify undo restores it, then redo to keep it deleted for save/reload.
  await selectPoint(await pickEdge(page, "edge-qa-ship"));
  await page.waitForFunction(() => window.__flowShowcase.selectedId === "edge-qa-ship", undefined, { timeout: 10_000 });
  await press("Delete selected");
  await page.waitForFunction(() => window.__flowShowcase.undoDepth === 7, undefined, { timeout: 10_000 });
  const hasQaShipEdge = async () =>
    (await snapshot()).scene.nodes.some(node => node.id === "edge-qa-ship");
  assert.equal(await hasQaShipEdge(), false);
  await press("Undo");
  await page.waitForFunction(() => window.__flowShowcase.undoDepth === 6, undefined, { timeout: 10_000 });
  assert.equal(await hasQaShipEdge(), true);
  await press("Redo");
  await page.waitForFunction(() => window.__flowShowcase.undoDepth === 7, undefined, { timeout: 10_000 });
  assert.equal(await hasQaShipEdge(), false);

  const saved = await snapshot();
  assert.ok(saved.scene.nodes.some(node => node.type === "edge" &&
    node.sourceId === "intake" && node.targetId === "build"));
  await press("Save board");
  await page.getByText("Saved in this browser.").waitFor();
  await page.reload();
  await page.getByText("Opened saved board.").waitFor();
  await card.getByText("Release candidate").waitFor();
  await card.locator(".flow-card-owner", { hasText: "Platform" }).waitFor();
  await addedCard.getByText("Verify rollout").waitFor();
  assert.equal(await card.getAttribute("data-flow-status"), "review");
  assert.deepEqual(await snapshot(), saved);
  assert.ok(Math.abs((await cardOffsetY("build")) - moved) < 1);
  if (onRestored) {
    await onRestored();
  }

  // Reset board clears saved state and restores the default 5-card example.
  await press("Reset board");
  await page.getByText("Reset to example board.").waitFor();
  assert.equal(await page.locator("[data-flow-card]").count(), 5);
  await card.locator(".flow-card-title", { hasText: "Build" }).waitFor();
  assert.equal(await page.evaluate(() => window.__flowShowcase.undoDepth), 0);
  assert.equal(await hasQaShipEdge(), true);
  await page.reload();
  await page.waitForFunction(
    () =>
      document.querySelector("#stage")?.getAttribute("data-denovo-flow-ready") ===
      "true",
    undefined,
    { timeout: 30_000 }
  );
  assert.equal(await page.locator("#storage-notice").textContent(), "");
  assert.equal(await page.locator("[data-flow-card]").count(), 5);
  await card.locator(".flow-card-title", { hasText: "Build" }).waitFor();
}

/**
 * @param {import("playwright").Page} page
 */
async function countCanvasColors(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("#stage canvas:not(.denovo-canvas-minimap)");
    if (!(canvas instanceof HTMLCanvasElement)) {
      return 0;
    }
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return 0;
    }
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const seen = new Set();
    const stride = 16 * 4;
    for (let index = 0; index < data.length; index += stride) {
      seen.add(`${data[index]},${data[index + 1]},${data[index + 2]}`);
    }
    return seen.size;
  });
}

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
