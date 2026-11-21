// @ts-check
/**
 * Fine-grained selector subscription verification across the headless core,
 * Vue adapter, and real React 19 DOM rendering in Chromium.
 *
 * Proves TanStack-style render isolation: 100 high-frequency hover updates
 * trigger 0 spurious notifications or React re-renders on components observing
 * unrelated document/history slices.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createCheckRunner } from "./lib/checks.mjs";
import { launchPixelChromium } from "./lib/chromium.mjs";

const { check, report } = createCheckRunner();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const facadeUrl = pathToFileURL(path.join(root, "packages/canvas/dist/index.js")).href;
const vueAdapterUrl = pathToFileURL(path.join(root, "packages/vue-canvas/dist/index.js")).href;
const vueRequire = createRequire(path.join(root, "packages/vue-canvas/package.json"));

const {
  createEditor,
  defineDocument,
  setNodeVisible,
  shallowEqual,
  subscribeCanvasSelector
} = await import(facadeUrl);

function createFixtureEditor() {
  return createEditor({
    document: defineDocument({
      id: "selector-fixture",
      scene: {
        id: "selector-fixture-scene",
        mode: "2d",
        layers: [{ id: "default", name: "Default" }],
        nodes: [
          {
            id: "node-a",
            type: "rect",
            layerId: "default",
            position: [0, 0],
            size: [80, 60],
            fill: "#22c55e"
          },
          {
            id: "node-b",
            type: "rect",
            layerId: "default",
            position: [120, 0],
            size: [80, 60],
            fill: "#38bdf8"
          }
        ]
      }
    })
  });
}

async function runHoverStorm(editor, count) {
  for (let i = 0; i < count; i += 1) {
    const target = i % 2 === 0 ? "node-a" : "node-b";
    await editor.hoverFromHit({
      kind: "node",
      nodeId: target,
      point: [10, 10],
      renderer: "canvas2d"
    });
  }
}

await check("shallow-equal-semantics", () => {
  assert.equal(shallowEqual(1, 1), true);
  assert.equal(shallowEqual(Number.NaN, Number.NaN), true);
  assert.equal(shallowEqual({ a: 1, b: true }, { a: 1, b: true }), true);
  assert.equal(shallowEqual({ a: 1, b: true }, { a: 1, b: false }), false);
  assert.equal(shallowEqual({ a: 1 }, { a: 1, b: 2 }), false);
  assert.equal(shallowEqual([1, "x"], [1, "x"]), true);
  assert.equal(shallowEqual([1, "x"], [1, "y"]), false);
  assert.equal(shallowEqual(new Set(["a", "b"]), new Set(["a", "b"])), true);
  assert.equal(shallowEqual(new Set(["a"]), new Set(["b"])), false);
  assert.equal(
    shallowEqual(new Map([["k", 1]]), new Map([["k", 1]])),
    true
  );
  assert.equal(
    shallowEqual(new Map([["k", 1]]), new Map([["k", 2]])),
    false
  );
  assert.equal(shallowEqual({}, []), false);
});

await check("headless-subscribe-isolates-hover-storm", async () => {
  const editor = createFixtureEditor();
  const historyEvents = [];
  const hoverEvents = [];

  const unsubHistory = subscribeCanvasSelector(
    editor,
    (state) => ({
      canRedo: state.history.canRedo,
      canUndo: state.history.canUndo
    }),
    (next, prev) => {
      historyEvents.push({ next, prev });
    },
    { equals: shallowEqual }
  );

  const unsubHover = subscribeCanvasSelector(
    editor,
    (state) => state.selection.hoveredId,
    (next) => {
      hoverEvents.push(next);
    },
    { fireImmediately: true }
  );

  assert.deepEqual(hoverEvents, [null]);
  await runHoverStorm(editor, 100);
  assert.equal(hoverEvents.length, 101);
  assert.equal(historyEvents.length, 0);

  await editor.apply([setNodeVisible({ nodeId: "node-a", visible: false })]);
  assert.equal(historyEvents.length, 1);
  assert.deepEqual(historyEvents[0].next, { canRedo: false, canUndo: true });

  await editor.undo();
  assert.equal(historyEvents.length, 2);
  assert.deepEqual(historyEvents[1].next, { canRedo: true, canUndo: false });

  unsubHistory();
  unsubHover();

  await editor.redo();
  await runHoverStorm(editor, 4);
  assert.equal(historyEvents.length, 2);
  assert.equal(hoverEvents.length, 101);
});

await check("vue-useCanvasSelector-isolates-and-disposes", async () => {
  const vue = vueRequire("vue");
  const { useCanvasSelector } = await import(vueAdapterUrl);
  const editor = createFixtureEditor();

  const scope = vue.effectScope();
  let historyTriggers = 0;
  let hoverTriggers = 0;
  /** @type {any} */
  let historyRef;

  scope.run(() => {
    historyRef = useCanvasSelector(
      editor,
      (state) => ({
        canRedo: state.history.canRedo,
        canUndo: state.history.canUndo
      }),
      shallowEqual
    );
    const hoverRef = useCanvasSelector(
      editor,
      (state) => state.selection.hoveredId
    );
    vue.watchSyncEffect(() => {
      void historyRef.value;
      historyTriggers += 1;
    });
    vue.watchSyncEffect(() => {
      void hoverRef.value;
      hoverTriggers += 1;
    });
  });

  assert.equal(historyTriggers, 1);
  assert.equal(hoverTriggers, 1);
  assert.deepEqual(historyRef.value, { canRedo: false, canUndo: false });

  await runHoverStorm(editor, 100);
  assert.equal(hoverTriggers, 101);
  assert.equal(historyTriggers, 1);

  await editor.apply([setNodeVisible({ nodeId: "node-a", visible: false })]);
  assert.equal(historyTriggers, 2);
  assert.deepEqual(historyRef.value, { canRedo: false, canUndo: true });

  scope.stop();
  await editor.undo();
  assert.equal(historyTriggers, 2);
});

await check("react-useCanvasSelector-zero-spurious-rerenders-in-browser", async () => {
  const htmlPath = path.join(root, "apps/playground-react/selector-bench.html");
  const entryPath = path.join(root, "apps/playground-react/src/selector-bench.tsx");
  const port = 5190;

  await writeFile(
    htmlPath,
    `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>selector-bench</title></head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/selector-bench.tsx"></script>
</body>
</html>`
  );
  await writeFile(
    entryPath,
    `import React from "react";
import { createRoot } from "react-dom/client";
import {
  createEditor,
  defineDocument,
  setNodeVisible,
  shallowEqual
} from "../../../packages/canvas/dist/index.js";
import { useCanvasSelector } from "@denovo/react-canvas";

const editor = createEditor({
  document: defineDocument({
    id: "react-selector-bench",
    scene: {
      id: "react-selector-scene",
      mode: "2d",
      layers: [{ id: "default", name: "Default" }],
      nodes: [
        { id: "node-a", type: "rect", layerId: "default", position: [0, 0], size: [80, 60], fill: "#22c55e" },
        { id: "node-b", type: "rect", layerId: "default", position: [120, 0], size: [80, 60], fill: "#38bdf8" }
      ]
    }
  })
});

let historyRenders = 0;
let hoverRenders = 0;

function HistoryBar() {
  historyRenders += 1;
  const { canUndo, canRedo } = useCanvasSelector(
    editor,
    (state) => ({
      canRedo: state.history.canRedo,
      canUndo: state.history.canUndo
    }),
    shallowEqual
  );
  return React.createElement(
    "div",
    { "data-testid": "history" },
    \`\${String(canUndo)}:\${String(canRedo)}\`
  );
}

function HoverBadge() {
  hoverRenders += 1;
  const hoveredId = useCanvasSelector(
    editor,
    (state) => state.selection.hoveredId
  );
  return React.createElement("div", { "data-testid": "hover" }, hoveredId ?? "none");
}

function App() {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(HistoryBar),
    React.createElement(HoverBadge)
  );
}

const rootEl = document.getElementById("root")!;
const root = createRoot(rootEl);
root.render(React.createElement(App));

const flush = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

(async () => {
  await flush();
  const initialHistoryRenders = historyRenders;
  const initialHoverRenders = hoverRenders;

  for (let i = 0; i < 100; i += 1) {
    await editor.hoverFromHit({
      kind: "node",
      nodeId: i % 2 === 0 ? "node-a" : "node-b",
      point: [10, 10],
      renderer: "canvas2d"
    });
  }
  await flush();
  const afterHoverHistoryRenders = historyRenders;
  const afterHoverHoverRenders = hoverRenders;
  const hoverText = document.querySelector('[data-testid="hover"]')?.textContent ?? "";

  await editor.apply([setNodeVisible({ nodeId: "node-a", visible: false })]);
  await flush();
  const afterApplyHistoryRenders = historyRenders;
  const afterApplyText = document.querySelector('[data-testid="history"]')?.textContent ?? "";

  await editor.undo();
  await flush();
  const afterUndoHistoryRenders = historyRenders;
  const afterUndoText = document.querySelector('[data-testid="history"]')?.textContent ?? "";

  root.unmount();
  await flush();
  await editor.redo();
  await flush();
  const afterUnmountHistoryRenders = historyRenders;

  (window as unknown as { __selectorResult?: unknown }).__selectorResult = {
    afterApplyHistoryRenders,
    afterApplyText,
    afterHoverHistoryRenders,
    afterHoverHoverRenders,
    afterUndoHistoryRenders,
    afterUndoText,
    afterUnmountHistoryRenders,
    hoverText,
    initialHistoryRenders,
    initialHoverRenders
  };
})();
`
  );

  const server = await startViteServer("@denovo/canvas-react-example", port);
  const browser = await launchPixelChromium();
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto(`${server.url}selector-bench.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(
      // @ts-ignore
      () => Boolean(window.__selectorResult),
      undefined,
      { timeout: 30_000 }
    );
    const result = await page.evaluate(
      // @ts-ignore
      () => window.__selectorResult
    );
    assert.deepEqual(errors, [], `React browser errors: ${errors.join("; ")}`);
    assert.equal(result.initialHistoryRenders, 1);
    assert.equal(
      result.afterHoverHistoryRenders,
      1,
      `HistoryBar must not re-render during 100 hover updates, got ${result.afterHoverHistoryRenders}`
    );
    assert.ok(
      result.afterHoverHoverRenders > result.initialHoverRenders,
      "HoverBadge must re-render when hoveredId changes"
    );
    assert.equal(result.hoverText, "node-b");
    assert.equal(result.afterApplyHistoryRenders, 2);
    assert.equal(result.afterApplyText, "true:false");
    assert.equal(result.afterUndoHistoryRenders, 3);
    assert.equal(result.afterUndoText, "false:true");
    assert.equal(result.afterUnmountHistoryRenders, 3);
  } finally {
    await browser.close();
    server.process.kill("SIGTERM");
    await rm(htmlPath, { force: true });
    await rm(entryPath, { force: true });
  }
});

report();

function startViteServer(filter, port) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      ["--filter", filter, "exec", "vite", "--host", "127.0.0.1", "--port", String(port)],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"] }
    );
    let output = "";
    const url = `http://127.0.0.1:${port}/`;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${filter} did not start:\n${output}`));
    }, 30_000);
    const poll = setInterval(async () => {
      try {
        const res = await fetch(url);
        if (res.ok) {
          clearInterval(poll);
          clearTimeout(timer);
          resolve({ process: child, url });
        }
      } catch {
        // keep polling
      }
    }, 200);
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("exit", (code) => {
      clearInterval(poll);
      clearTimeout(timer);
      reject(new Error(`${filter} exited ${code}:\n${output}`));
    });
  });
}
