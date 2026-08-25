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
const stackScreenshotPath = path.resolve(
  root,
  "artifacts/verification/named-ops-stack-box.png"
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
  assert.deepEqual(
    facade.listLayers(editor.getState().document).map((layer) => ({
      id: layer.id,
      visible: layer.visible
    })),
    [
      { id: "storey-1", visible: true },
      { id: "storey-2", visible: false }
    ]
  );
  assert.equal(editor.getState().history.undoDepth, 1);

  const again = await editor.apply([hideLevel2]);
  assert.equal(again.changed, false);
  assert.equal(editor.getState().history.undoDepth, 1);

  const boxed = facade.defineDocument({
    id: "named-ops-stack",
    scene: {
      id: "named-ops-stack-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "3d",
      nodes: [
        {
          id: "box-1",
          layerId: "main",
          position: [2, 3, 4],
          rotation: [0, 0, 0],
          scale: [4, 2, 6],
          type: "box"
        }
      ]
    }
  });
  const boxes = facade.listNodes(boxed, { layerId: "main" }).filter(
    (node) => node.type === "box"
  );
  assert.equal(boxes.length, 1);
  assert.equal(boxes[0]?.id, "box-1");
  assert.equal("position" in (boxes[0] ?? {}), false);

  const stacked = await facade.createEditor({ document: boxed }).apply([
    facade.stackBox({
      createId: () => "box-1-plus-y",
      face: "+y",
      on: boxes[0].id
    })
  ]);
  assert.equal(stacked.changed, true);
  assert.deepEqual(
    stacked.document.scene.nodes.find((node) => node.id === "box-1-plus-y")
      ?.position,
    [2, 5, 4]
  );
  assert.deepEqual(
    facade.listNodes(stacked.document).map((node) => node.id),
    ["box-1", "box-1-plus-y"]
  );

  const hideBox = facade.setNodeVisible({
    nodeId: "box-1",
    visible: false
  });
  const hidden = facade.applyNamedOperations(boxed, [hideBox]);
  assert.equal(hidden.changed, true);
  assert.equal(hidden.commands[0]?.type, "node.update");
  assert.equal(
    hidden.document.scene.nodes.find((node) => node.id === "box-1")?.visible,
    false
  );
  const alreadyHidden = facade.applyNamedOperations(hidden.document, [hideBox]);
  assert.equal(alreadyHidden.changed, false);
  const lockBox = facade.setNodeLocked({ locked: true, nodeId: "box-1" });
  const locked = facade.applyNamedOperations(boxed, [lockBox]);
  assert.equal(
    locked.document.scene.nodes.find((node) => node.id === "box-1")?.locked,
    true
  );
  const lockMain = facade.setLayerLocked({
    layerId: "main",
    locked: true
  });
  const lockedLayer = facade.applyNamedOperations(boxed, [lockMain]);
  assert.equal(
    lockedLayer.document.scene.layers.find((layer) => layer.id === "main")
      ?.locked,
    true
  );
  const alreadyLockedLayer = facade.applyNamedOperations(lockedLayer.document, [
    lockMain
  ]);
  assert.equal(alreadyLockedLayer.changed, false);
  const dropStacked = facade.removeNode({ nodeId: "box-1-plus-y" });
  const removed = facade.applyNamedOperations(stacked.document, [dropStacked]);
  assert.equal(removed.changed, true);
  assert.equal(removed.commands[0]?.type, "node.remove");
  assert.deepEqual(
    facade.listNodes(removed.document).map((node) => node.id),
    ["box-1"]
  );

  const diagram = facade.defineDocument({
    id: "named-ops-remove-edge",
    scene: {
      id: "named-ops-remove-edge-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: [
        {
          id: "a",
          layerId: "main",
          position: [0, 0],
          size: [40, 24],
          type: "rect"
        },
        {
          id: "b",
          layerId: "main",
          position: [80, 0],
          size: [40, 24],
          type: "rect"
        },
        {
          id: "edge",
          layerId: "main",
          sourceId: "a",
          targetId: "b",
          type: "edge"
        }
      ]
    }
  });
  const dropConnected = facade.applyNamedOperations(diagram, [
    facade.removeEdge({ nodeId: "edge" }),
    facade.removeNode({ nodeId: "a" })
  ]);
  assert.deepEqual(
    facade.listNodes(dropConnected.document).map((node) => node.id),
    ["b"]
  );

  const layered = facade.defineDocument({
    id: "named-ops-remove-layer",
    scene: {
      id: "named-ops-remove-layer-scene",
      layers: [
        { id: "main", name: "Main" },
        { id: "extra", name: "Extra" }
      ],
      mode: "2d",
      nodes: []
    }
  });
  const droppedLayer = facade.applyNamedOperations(layered, [
    facade.removeLayer({
      layerId: "extra",
      targetLayerId: null
    })
  ]);
  assert.equal(droppedLayer.changed, true);
  assert.equal(droppedLayer.commands[0]?.type, "layer.remove");
  assert.deepEqual(
    facade.listLayers(droppedLayer.document).map((layer) => layer.id),
    ["main"]
  );

  const addedLayer = facade.applyNamedOperations(layered, [
    facade.addLayer({
      index: 0,
      layerId: "notes",
      name: "Notes"
    })
  ]);
  assert.equal(addedLayer.changed, true);
  assert.equal(addedLayer.commands[0]?.type, "layer.add");
  assert.deepEqual(
    facade.listLayers(addedLayer.document).map((layer) => layer.id),
    ["notes", "main", "extra"]
  );

  const reorderedLayer = facade.applyNamedOperations(layered, [
    facade.reorderLayer({
      index: 0,
      layerId: "extra"
    })
  ]);
  assert.equal(reorderedLayer.changed, true);
  assert.equal(reorderedLayer.commands[0]?.type, "layer.reorder");
  assert.deepEqual(
    facade.listLayers(reorderedLayer.document).map((layer) => layer.id),
    ["extra", "main"]
  );

  const renamedLayer = facade.applyNamedOperations(layered, [
    facade.setLayerName({
      layerId: "extra",
      name: "Notes"
    })
  ]);
  assert.equal(renamedLayer.changed, true);
  assert.equal(renamedLayer.commands[0]?.type, "layer.update");
  assert.equal(
    facade.listLayers(renamedLayer.document).find((layer) => layer.id === "extra")
      ?.name,
    "Notes"
  );

  const movable = facade.defineDocument({
    id: "named-ops-set-node-layer",
    scene: {
      id: "named-ops-set-node-layer-scene",
      layers: [
        { id: "main", name: "Main" },
        { id: "notes", name: "Notes" }
      ],
      mode: "2d",
      nodes: [
        {
          id: "rect-1",
          layerId: "main",
          position: [0, 0],
          size: [80, 40],
          type: "rect"
        }
      ]
    }
  });
  const movedNode = facade.applyNamedOperations(movable, [
    facade.setNodeLayer({
      layerId: "notes",
      nodeId: "rect-1"
    })
  ]);
  assert.equal(movedNode.changed, true);
  assert.equal(movedNode.commands[0]?.type, "node.update");
  assert.equal(
    facade.listNodes(movedNode.document).find((node) => node.id === "rect-1")
      ?.layerId,
    "notes"
  );

  const labeled = facade.defineDocument({
    id: "named-ops-set-text",
    scene: {
      id: "named-ops-set-text-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: [
        {
          id: "label",
          layerId: "main",
          position: [0, 0],
          text: "Draft",
          type: "text"
        }
      ]
    }
  });
  const renamedText = facade.applyNamedOperations(labeled, [
    facade.setText({
      nodeId: "label",
      text: "Done"
    })
  ]);
  assert.equal(renamedText.changed, true);
  assert.equal(renamedText.commands[0]?.type, "node.update");
  assert.equal(
    renamedText.document.scene.nodes.find((node) => node.id === "label")?.text,
    "Done"
  );
});

const server = await startApp("@denovo/canvas-bim-example", 5189);
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
      assert.ok((before?.nodeCount ?? 0) > 0);
      assert.equal(
        await page.locator("#level-2-visible").getAttribute("data-level-2-visible"),
        "true"
      );
      assert.equal(
        await page.locator("#level-2-visible").getAttribute("data-level-2-nodes"),
        String(before.nodeCount)
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
      assert.equal(hidden?.nodeCount, before.nodeCount);
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

const vanilla = await startApp("@denovo/canvas-vanilla-example", 5190);
try {
  await check("named-ops-vanilla-stack-and-layer-toggles-use-the-helpers", async () => {
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

      await page.goto(vanilla.url, { waitUntil: "networkidle" });
      await page.waitForFunction(
        () =>
          document.querySelector("#stage")?.getAttribute("data-denovo-editor-ready") ===
          "true",
        undefined,
        { timeout: 30_000 }
      );

      for (let index = 0; index < 2; index += 1) {
        const revision = await page
          .locator("#stage")
          .getAttribute("data-denovo-document-revision");
        await page.getByRole("button", { name: "Swap Scene" }).click();
        await page.waitForFunction(
          (previous) => {
            const next = document
              .querySelector("#stage")
              ?.getAttribute("data-denovo-document-revision");
            return (
              next !== previous &&
              document.querySelector("#stage")?.getAttribute("data-denovo-pending-count") ===
                "0"
            );
          },
          revision,
          { timeout: 15_000 }
        );
      }

      await page.waitForFunction(
        () =>
          document.querySelector("#stage")?.getAttribute("data-denovo-scene-id") ===
          "vanilla-3d-demand",
        undefined,
        { timeout: 10_000 }
      );

      const undoBefore = Number(
        await page.locator("#stage").getAttribute("data-denovo-history-undo-depth")
      );
      await page.locator('[data-denovo-control="stack-box-plus-y"]').click();
      await page.waitForFunction(
        () => window.__vanillaNamedOps?.position?.[1] === 1.2,
        undefined,
        { timeout: 15_000 }
      );

      const stacked = await page.evaluate(() => window.__vanillaNamedOps);
      assert.equal(stacked?.changed, true);
      assert.equal(stacked?.on, "static-box");
      assert.equal(stacked?.stackedId, "named-stack-plus-y");
      assert.deepEqual(stacked?.position, [0, 1.2, 0]);
      assert.equal(stacked?.undoDepth, undoBefore + 1);
      assert.equal(
        await page.locator("#stage").getAttribute("data-denovo-named-stack-id"),
        "named-stack-plus-y"
      );
      assert.equal(
        await page.locator("#stage").getAttribute("data-denovo-named-stack-position"),
        "0,1.2,0"
      );

      mkdirSync(path.dirname(stackScreenshotPath), { recursive: true });
      await page.screenshot({ path: stackScreenshotPath, fullPage: true });

      await page.locator('[data-denovo-control="stack-box-plus-y"]').click();
      await page.waitForFunction(
        () => window.__vanillaNamedOps?.changed === false,
        undefined,
        { timeout: 10_000 }
      );
      const again = await page.evaluate(() => window.__vanillaNamedOps);
      assert.equal(again?.changed, false);
      assert.equal(again?.undoDepth, stacked.undoDepth);
      assert.deepEqual(again?.position, [0, 1.2, 0]);

      await page.locator('[data-denovo-control="toggle-layer-visible"]').click();
      await page.waitForFunction(
        () => window.__vanillaNamedOps?.layerVisible === false,
        undefined,
        { timeout: 10_000 }
      );
      const hidden = await page.evaluate(() => window.__vanillaNamedOps);
      assert.equal(hidden?.changed, true);
      assert.equal(hidden?.layerId, "authoring");
      assert.equal(hidden?.layerVisible, false);
      assert.equal(hidden?.layerLocked, false);
      assert.equal(hidden?.undoDepth, again.undoDepth + 1);
      assert.equal(
        await page.locator("#stage").getAttribute("data-denovo-authoring-visible"),
        "false"
      );

      await page.locator('[data-denovo-control="toggle-layer-locked"]').click();
      await page.waitForFunction(
        () => window.__vanillaNamedOps?.layerLocked === true,
        undefined,
        { timeout: 10_000 }
      );
      const locked = await page.evaluate(() => window.__vanillaNamedOps);
      assert.equal(locked?.changed, true);
      assert.equal(locked?.layerVisible, false);
      assert.equal(locked?.layerLocked, true);
      assert.equal(locked?.undoDepth, hidden.undoDepth + 1);
      assert.equal(
        await page.locator("#stage").getAttribute("data-denovo-authoring-locked"),
        "true"
      );

      assert.deepEqual(consoleErrors, []);
    } finally {
      await browser.close();
    }
  });
} finally {
  vanilla.process.kill("SIGTERM");
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
    child.on("exit", (code) => {
      if (code && code !== 0) {
        clearTimeout(timer);
        reject(new Error(`${filter} exited ${code}:\n${stdout}`));
      }
    });
  });
}
