import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";

import { devices } from "playwright";
import { launchPixelChromium } from "./lib/chromium.mjs";
import { expect } from "playwright/test";

import { createCheckRunner } from "./lib/checks.mjs";

const { check, report } = createCheckRunner();

const viewportChecks = [
  {
    name: "desktop",
    resizeTo: {
      height: 720,
      width: 940
    },
    viewport: {
      height: 800,
      width: 1280
    }
  },
  {
    name: "mobile",
    resizeTo: {
      height: 780,
      width: 390
    },
    ...devices["iPhone 14"]
  }
];

const allowedConsoleWarningPatterns = [
  /^No available adapters\.$/,
  /^WARNING: Too many active WebGL contexts\. Oldest context will be lost\.$/,
  /^\[\.WebGL-0x[0-9a-f]+\]GL Driver Message \(OpenGL, Performance, GL_CLOSE_PATH_NV, High\): GPU stall due to ReadPixels$/,
  /^\[\.WebGL-0x[0-9a-f]+\]GL Driver Message \(OpenGL, Performance, GL_CLOSE_PATH_NV, High\): GPU stall due to ReadPixels \(this message will no longer repeat\)$/,
  /^WebGL: CONTEXT_LOST_WEBGL: loseContext: context lost$/
];

const authoringToolIds = {
  annotation2d: "plugin.vanilla.tool.authoring.annotate.2d",
  annotation3d: "plugin.vanilla.tool.authoring.annotate.3d",
  box3d: "plugin.vanilla.tool.authoring.create.box.3d",
  circle2d: "plugin.vanilla.tool.authoring.create.circle.2d",
  distance2d: "plugin.vanilla.tool.authoring.measure.distance.2d",
  distance3d: "plugin.vanilla.tool.authoring.measure.distance.3d",
  inspect: "plugin.vanilla.tool.inspect",
  panOrbit: "plugin.vanilla.tool.pan-orbit",
  rect2d: "plugin.vanilla.tool.authoring.create.rect.2d",
  rotate: "plugin.vanilla.tool.transform.rotate",
  scale: "plugin.vanilla.tool.transform.scale",
  select: "plugin.vanilla.tool.select",
  sphere3d: "plugin.vanilla.tool.authoring.create.sphere.3d",
  stackBox3d: "plugin.vanilla.tool.authoring.stack.box.3d",
  transform: "plugin.vanilla.tool.transform"
};

const demandThreeDimensionalCamera = {
  fov: 42,
  position: [4.6, 3.4, 6.8],
  target: [0, -0.18, 0]
};
const surfacePlacementCoordinateTolerance = 1e-6;
const surfacePlacementTangentialTolerance = 1e-3;

const server = await startViteServer();
const checks = [];
const screenshotArtifacts = [];

try {
  for (const viewportCheck of viewportChecks) {
    const result = await withFreshBrowser((browser) =>
      verifyViewport(browser, server.url, viewportCheck)
    );
    const twoDimensionalAuthoring = await withFreshBrowser((browser) =>
      verifyTwoDimensionalAuthoring(browser, server.url, viewportCheck)
    );
    const threeDimensionalAuthoring = await withFreshBrowser((browser) =>
      verifyThreeDimensionalAuthoring(browser, server.url, viewportCheck)
    );
    checks.push({
      ...result,
      authoring: {
        threeDimensional: threeDimensionalAuthoring,
        twoDimensional: twoDimensionalAuthoring
      }
    });
  }
} finally {
  await stopServer(server.process);
  await unlink(server.configPath);
}

await mkdir("artifacts", { recursive: true });
await Promise.all(
  screenshotArtifacts.map((artifact) =>
    writeFile(artifact.path, artifact.content)
  )
);

// `checks` holds one entry per viewport that rendered successfully; the runner
// contributes the completion marker and derives `ok` from execution.
check("browser-rendering-suite", () => {});

report({ viewports: checks });

async function startViteServer() {
  const configPath = `/tmp/denovo-browser-verifier-vite-${process.pid}.mjs`;
  await writeFile(
    configPath,
    [
      "export default {",
      "  clearScreen: false,",
      "  server: {",
      "    hmr: false,",
      "    watch: { ignored: [\"**/*\"] }",
      "  }",
      "};",
      ""
    ].join("\n")
  );
  const child = spawn(
    "pnpm",
    [
      "--filter",
      "@denovo/canvas-vanilla-example",
      "exec",
      "vite",
      "--config",
      configPath,
      "--force",
      "--host",
      "127.0.0.1",
      "--port",
      "5173"
    ],
    {
      env: {
        ...process.env,
        CI: "1"
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  let output = "";

  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  const url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for Vite server.\n${output}`));
    }, 30_000);

    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Vite exited before ready with code ${code}.\n${output}`));
    });

    // Vite colourises its banner, so the ANSI codes have to come out before the
    // URL can be matched.
    const stripAnsi = (value) => value.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");

    const interval = setInterval(() => {
      const match = stripAnsi(output).match(
        /Local:\s+(http:\/\/127\.0\.0\.1:\d+\/)/
      );

      if (match?.[1]) {
        clearInterval(interval);
        clearTimeout(timeout);
        resolve(match[1]);
      }
    }, 50);
  });

  return {
    configPath,
    process: child,
    url
  };
}

async function withFreshBrowser(run) {
  const browser = await launchPixelChromium({ headless: true });

  try {
    return await run(browser);
  } finally {
    await browser.close();
  }
}

async function stopServer(child) {
  if (child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");

  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 2_000);
    child.on("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });

  if (child.exitCode === null) {
    child.kill("SIGKILL");
  }
}

async function verifyViewport(browser, url, viewportCheck) {
  const context = await browser.newContext(viewportCheck);
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];

  page.on("console", (message) => {
    consoleMessages.push({
      text: message.text(),
      type: message.type()
    });
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  try {
    await page.goto(url, {
      waitUntil: "networkidle"
    });
    await page.locator("canvas").waitFor({
      state: "visible"
    });
    const stage = page.locator("#stage");
    const selectionStatus = page.getByRole("status", {
      name: "Selected canvas node"
    });
    const toolStatus = page.getByRole("status", {
      name: "Active canvas tool"
    });
    await expect(stage).toHaveAttribute("data-denovo-editor-ready", "true");
    await expect(stage).toHaveAttribute("data-denovo-scene-id", "vanilla-3d");
    await expect(stage).toHaveAttribute("data-denovo-selection-primary", "none");
    await expect(stage).toHaveAttribute("data-denovo-input-error", "none");
    await expect(stage).toHaveAttribute(
      "data-denovo-active-tool",
      authoringToolIds.select
    );
    await expect(stage).toHaveAttribute("data-denovo-navigation-input", "true");
    await expect(stage).toHaveAttribute("data-denovo-theme", "dark");
    await expect(toolStatus).toHaveText(authoringToolIds.select);
    await expect(page.locator("canvas")).toHaveCSS("cursor", "default");
    await expect(page.locator("canvas")).toHaveCount(1);
    assert.equal(
      await stage.evaluate((element) =>
        element.style.getPropertyValue("--dc-background")
      ),
      "",
      `${viewportCheck.name}: preset themes must not block consumer CSS with inline tokens.`
    );
    await expect(stage).toHaveCSS("border-radius", "10px");
    await stage.evaluate((element) => {
      element.style.setProperty("--dc-radius", "20px");
    });
    await expect(stage).toHaveCSS("border-radius", "20px");
    await stage.evaluate((element) => {
      element.style.removeProperty("--dc-radius");
    });
    await expect(stage).toHaveCSS("border-radius", "10px");
    await stage.evaluate((element) => {
      element.style.setProperty("--dc-handle-x-color", "#fb7185");
    });
    assert.match(
      await stage.evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--_dc-handle-x").trim()
      ),
      /#fb7185|rgb\(251[ ,]+113[ ,]+133\)/,
      `${viewportCheck.name}: transform handle axis token did not accept a consumer override.`
    );
    await stage.evaluate((element) => {
      element.style.removeProperty("--dc-handle-x-color");
    });
    await expect
      .poll(() => getFrameCount(page), {
        message: `${viewportCheck.name}: waiting for the continuous scene frame loop.`
      })
      .toBeGreaterThan(0);

    const initial3d = await analyzeCanvasScreenshot(page);
    assertCanvasIsRendered(`${viewportCheck.name}:initial-3d`, initial3d);
    const continuousFrameCount = await getFrameCount(page);
    assert.ok(
      continuousFrameCount > 0,
      `${viewportCheck.name}: initial continuous 3D scene did not render frames.`
    );

    await page.getByRole("button", { name: "Swap Scene" }).click();
    await expect(stage).toHaveAttribute("data-denovo-scene-id", "vanilla-2d");
    await expect(page.locator("canvas")).toHaveCount(1);

    const swapped2d = await analyzeCanvasScreenshot(page);
    assertCanvasIsRendered(`${viewportCheck.name}:swapped-2d`, swapped2d);

    const canvasBoxBeforeResize = await requireCanvasBox(page);
    await page.setViewportSize(viewportCheck.resizeTo);
    await expect
      .poll(async () => {
        const box = await requireCanvasBox(page);
        return [Math.round(box.width), Math.round(box.height)];
      }, {
        message: `${viewportCheck.name}: waiting for the canvas resize.`
      })
      .not.toEqual([
        Math.round(canvasBoxBeforeResize.width),
        Math.round(canvasBoxBeforeResize.height)
      ]);

    const resized = await analyzeCanvasScreenshot(page);
    assertCanvasIsRendered(`${viewportCheck.name}:resized`, resized);

    const twoDimensionalHistoryDepth = await getNumericAttribute(
      stage,
      "data-denovo-history-undo-depth"
    );
    let selectionRevision = await getNumericAttribute(
      stage,
      "data-denovo-selection-revision"
    );
    const overlayPoint = { x: 170, y: 160 };
    await selectCanvasPoint(page, viewportCheck, overlayPoint);
    selectionRevision += 1;
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-primary",
      "overlay"
    );
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-revision",
      String(selectionRevision)
    );
    await expect(selectionStatus).toHaveText("overlay");

    const panelPoint = {
      x: 96 + Math.cos(0.08) * 130 - Math.sin(0.08) * 90,
      y: 96 + Math.sin(0.08) * 130 + Math.cos(0.08) * 90
    };
    await selectCanvasPoint(page, viewportCheck, panelPoint);
    selectionRevision += 1;
    await expect(stage).toHaveAttribute("data-denovo-selection-primary", "panel");
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-revision",
      String(selectionRevision)
    );
    await expect(selectionStatus).toHaveText("panel");

    const toolInputCountBeforeInspect = await getNumericAttribute(
      stage,
      "data-denovo-tool-input-count"
    );
    await page.getByRole("button", { name: "Inspect" }).click();
    await expect(stage).toHaveAttribute(
      "data-denovo-active-tool",
      authoringToolIds.inspect
    );
    await expect(stage).toHaveAttribute("data-denovo-navigation-input", "false");
    await expect(toolStatus).toHaveText(authoringToolIds.inspect);
    await expect(page.getByRole("button", { name: "Inspect" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.locator("canvas")).toHaveCSS("cursor", "help");
    await selectCanvasPoint(page, viewportCheck, overlayPoint);
    await expect(stage).toHaveAttribute(
      "data-denovo-tool-input-count",
      String(toolInputCountBeforeInspect + 1)
    );
    await expect(stage).toHaveAttribute(
      "data-denovo-tool-pointer-type",
      viewportCheck.hasTouch ? "touch" : "mouse"
    );
    await expect(stage).toHaveAttribute("data-denovo-selection-primary", "panel");
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-revision",
      String(selectionRevision)
    );
    await page.getByRole("button", { name: "Select" }).click();
    await expect(stage).toHaveAttribute(
      "data-denovo-active-tool",
      authoringToolIds.select
    );
    await expect(stage).toHaveAttribute("data-denovo-navigation-input", "true");
    await expect(toolStatus).toHaveText(authoringToolIds.select);
    await expect(page.locator("canvas")).toHaveCSS("cursor", "default");

    if (!viewportCheck.hasTouch) {
      await selectCanvasPoint(page, viewportCheck, overlayPoint, ["Shift"]);
      selectionRevision += 1;
      await expect(stage).toHaveAttribute(
        "data-denovo-selection-ids",
        "panel,overlay"
      );
      await expect(stage).toHaveAttribute(
        "data-denovo-selection-primary",
        "overlay"
      );
      await expect(stage).toHaveAttribute(
        "data-denovo-selection-revision",
        String(selectionRevision)
      );
    }

    await stage.focus();
    await page.keyboard.press("Escape");
    selectionRevision += 1;
    await expect(stage).toHaveAttribute("data-denovo-selection-primary", "none");
    await expect(stage).toHaveAttribute("data-denovo-selection-ids", "");
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-revision",
      String(selectionRevision)
    );

    await selectCanvasPoint(page, viewportCheck, panelPoint);
    selectionRevision += 1;
    await expect(stage).toHaveAttribute("data-denovo-selection-primary", "panel");

    await selectCanvasPoint(page, viewportCheck, { x: 24, y: 24 });
    selectionRevision += 1;
    await expect(stage).toHaveAttribute("data-denovo-selection-primary", "none");
    await expect(stage).toHaveAttribute("data-denovo-selection-ids", "");
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-revision",
      String(selectionRevision)
    );
    await expect(selectionStatus).toHaveText("none");
    await expect(stage).toHaveAttribute(
      "data-denovo-history-undo-depth",
      String(twoDimensionalHistoryDepth)
    );

    const panelPositionBeforeTransform = await getPositionAttribute(
      stage,
      "data-denovo-panel-position"
    );
    const twoDimensionalTransformBefore = await getCanvasHash(page);
    await page.getByRole("button", { name: "Move" }).click();
    await expect(stage).toHaveAttribute(
      "data-denovo-active-tool",
      authoringToolIds.transform
    );
    await expect(stage).toHaveAttribute("data-denovo-navigation-input", "false");
    await expect(page.locator("canvas")).toHaveCSS("cursor", "move");
    const releaseTwoDimensionalTransform = await beginCanvasDragForViewport(
      page,
      viewportCheck,
      panelPoint,
      64,
      36
    );
    await expect
      .poll(() => getCanvasHash(page), {
        message: `${viewportCheck.name}: waiting for the 2D transform preview.`
      })
      .not.toBe(twoDimensionalTransformBefore);
    await expect(stage).toHaveAttribute("data-denovo-input-error", "none");
    selectionRevision += 1;
    await expect(stage).toHaveAttribute("data-denovo-selection-primary", "panel");
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-revision",
      String(selectionRevision)
    );
    const twoDimensionalTransformPreview = await getCanvasHash(page);
    assert.notEqual(
      twoDimensionalTransformPreview,
      twoDimensionalTransformBefore,
      `${viewportCheck.name}: 2D transform preview did not change the rendered node.`
    );
    assert.deepEqual(
      await getPositionAttribute(stage, "data-denovo-panel-position"),
      panelPositionBeforeTransform,
      `${viewportCheck.name}: 2D transform preview mutated the document before release.`
    );
    await expect(stage).toHaveAttribute(
      "data-denovo-history-undo-depth",
      String(twoDimensionalHistoryDepth)
    );
    await releaseTwoDimensionalTransform();
    await expect(stage).toHaveAttribute(
      "data-denovo-history-undo-depth",
      String(twoDimensionalHistoryDepth + 1)
    );
    const panelPositionAfterTransform = await getPositionAttribute(
      stage,
      "data-denovo-panel-position"
    );
    assert.notDeepEqual(
      panelPositionAfterTransform,
      panelPositionBeforeTransform,
      `${viewportCheck.name}: 2D transform was not committed on release.`
    );
    screenshotArtifacts.push({
      content: await page.locator("canvas").screenshot(),
      path: `artifacts/m3-transform-handles-${viewportCheck.name}-2d.png`
    });
    const constrainedTwoDimensionalHistoryDepth = twoDimensionalHistoryDepth + 1;
    const xHandlePoint = {
      x: panelPositionAfterTransform[0] + 40,
      y: panelPositionAfterTransform[1]
    };
    const releaseConstrainedTwoDimensionalTransform =
      await beginCanvasDragForViewport(
        page,
        viewportCheck,
        xHandlePoint,
        48,
        32
      );
    await waitForAnimationFrames(page, 2);
    assert.deepEqual(
      await getPositionAttribute(stage, "data-denovo-panel-position"),
      panelPositionAfterTransform,
      `${viewportCheck.name}: constrained 2D preview mutated the document before release.`
    );
    await releaseConstrainedTwoDimensionalTransform();
    await expect(stage).toHaveAttribute(
      "data-denovo-history-undo-depth",
      String(constrainedTwoDimensionalHistoryDepth + 1)
    );
    const panelPositionAfterXTransform = await getPositionAttribute(
      stage,
      "data-denovo-panel-position"
    );
    assert.notEqual(
      panelPositionAfterXTransform[0],
      panelPositionAfterTransform[0],
      `${viewportCheck.name}: 2D X handle did not move the node.`
    );
    assert.equal(
      panelPositionAfterXTransform[1],
      panelPositionAfterTransform[1],
      `${viewportCheck.name}: 2D X handle changed the Y position.`
    );
    await page.getByRole("button", { name: "Select" }).click();
    await stage.focus();
    await page.keyboard.press("Escape");
    selectionRevision += 1;
    await expect(stage).toHaveAttribute("data-denovo-selection-primary", "none");

    const identityTwoDimensionalView = await getCanvas2DViewState(stage);
    assertCanvas2DViewClose(
      identityTwoDimensionalView,
      { offset: [0, 0], zoom: 1 },
      `${viewportCheck.name}: Canvas2D must start with the identity view.`
    );
    const navigationInvariantBefore = await getNavigationInvariantState(stage);
    const demandTwoDimensionalFrameCount = await getFrameCount(page);
    const panDelta = [48, 32];
    const panPixelsBefore = await getCanvasHash(page);
    await page.getByRole("button", { name: "Navigate" }).click();
    await expect(stage).toHaveAttribute(
      "data-denovo-active-tool",
      authoringToolIds.panOrbit
    );
    await expect(stage).toHaveAttribute("data-denovo-navigation-input", "true");
    await dragCanvasForViewport(
      page,
      viewportCheck,
      panDelta[0],
      panDelta[1]
    );
    await expect
      .poll(async () => (await getCanvas2DViewState(stage)).offset[0], {
        message: `${viewportCheck.name}: waiting for Canvas2D pan state.`
      })
      .toBeCloseTo(panDelta[0], 5);
    const viewAfterPan = await getCanvas2DViewState(stage);
    assertCanvas2DViewClose(
      viewAfterPan,
      { offset: panDelta, zoom: 1 },
      `${viewportCheck.name}: Canvas2D pan must update only the transient view.`
    );
    await expect
      .poll(() => getCanvasHash(page), {
        message: `${viewportCheck.name}: waiting for Canvas2D pan pixels.`
      })
      .not.toBe(panPixelsBefore);
    assert.deepEqual(
      await getNavigationInvariantState(stage),
      navigationInvariantBefore,
      `${viewportCheck.name}: Canvas2D pan mutated document, history, or selection state.`
    );

    const canvasBoxForZoom = await requireCanvasBox(page);
    const zoomAnchor = [
      Math.min(220, canvasBoxForZoom.width * 0.62),
      Math.min(180, canvasBoxForZoom.height * 0.45)
    ];
    const anchorSceneBeforeZoom = canvasToScenePoint(
      viewAfterPan,
      zoomAnchor
    );
    const zoomPixelsBefore = await getCanvasHash(page);
    await zoomCanvasAtForViewport(
      page,
      viewportCheck,
      zoomAnchor
    );
    await expect
      .poll(async () => (await getCanvas2DViewState(stage)).zoom, {
        message: `${viewportCheck.name}: waiting for Canvas2D zoom state.`
      })
      .toBeGreaterThan(1);
    const viewAfterZoom = await getCanvas2DViewState(stage);
    const anchorSceneAfterZoom = canvasToScenePoint(
      viewAfterZoom,
      zoomAnchor
    );
    assertPointClose(
      anchorSceneAfterZoom,
      anchorSceneBeforeZoom,
      1e-5,
      `${viewportCheck.name}: Canvas2D zoom did not preserve its anchor.`
    );
    await expect
      .poll(() => getCanvasHash(page), {
        message: `${viewportCheck.name}: waiting for Canvas2D zoom pixels.`
      })
      .not.toBe(zoomPixelsBefore);
    assert.deepEqual(
      await getNavigationInvariantState(stage),
      navigationInvariantBefore,
      `${viewportCheck.name}: Canvas2D zoom mutated document, history, or selection state.`
    );

    await page.getByRole("button", { name: "Select" }).click();
    await expect(stage).toHaveAttribute("data-denovo-navigation-input", "true");
    const transformedOverlayPoint = sceneToCanvasPoint(viewAfterZoom, [170, 160]);
    await selectCanvasPoint(page, viewportCheck, {
      x: transformedOverlayPoint[0],
      y: transformedOverlayPoint[1]
    });
    selectionRevision += 1;
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-primary",
      "overlay"
    );
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-revision",
      String(selectionRevision)
    );

    const transformedPanelPositionBefore = await getPositionAttribute(
      stage,
      "data-denovo-panel-position"
    );
    const transformedPanelInteriorScenePoint = [
      transformedPanelPositionBefore[0] +
        Math.cos(0.08) * 24 -
        Math.sin(0.08) * 24,
      transformedPanelPositionBefore[1] +
        Math.sin(0.08) * 24 +
        Math.cos(0.08) * 24
    ];
    const transformedPanelPoint = sceneToCanvasPoint(
      viewAfterZoom,
      transformedPanelInteriorScenePoint
    );
    const transformedDragDelta = [42, 30];
    const navigationTransformHistoryDepth =
      constrainedTwoDimensionalHistoryDepth + 1;
    await page.getByRole("button", { name: "Move" }).click();
    const transformedPreviewPixelsBefore = await getCanvasHash(page);
    const releaseTransformedTwoDimensionalTransform =
      await beginCanvasDragForViewport(
        page,
        viewportCheck,
        { x: transformedPanelPoint[0], y: transformedPanelPoint[1] },
        transformedDragDelta[0],
        transformedDragDelta[1]
      );
    await expect
      .poll(() => getCanvasHash(page), {
        message: `${viewportCheck.name}: waiting for transformed Canvas2D preview pixels.`
      })
      .not.toBe(transformedPreviewPixelsBefore);
    selectionRevision += 1;
    await expect(stage).toHaveAttribute("data-denovo-selection-primary", "panel");
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-revision",
      String(selectionRevision)
    );
    assert.deepEqual(
      await getPositionAttribute(stage, "data-denovo-panel-position"),
      transformedPanelPositionBefore,
      `${viewportCheck.name}: transformed Canvas2D preview mutated the document.`
    );
    await expect(stage).toHaveAttribute(
      "data-denovo-history-undo-depth",
      String(navigationTransformHistoryDepth)
    );
    await releaseTransformedTwoDimensionalTransform();
    await expect(stage).toHaveAttribute(
      "data-denovo-history-undo-depth",
      String(navigationTransformHistoryDepth + 1)
    );
    const transformedPanelPositionAfter = await getPositionAttribute(
      stage,
      "data-denovo-panel-position"
    );
    assertPointClose(
      [
        transformedPanelPositionAfter[0] - transformedPanelPositionBefore[0],
        transformedPanelPositionAfter[1] - transformedPanelPositionBefore[1]
      ],
      [
        transformedDragDelta[0] / viewAfterZoom.zoom,
        transformedDragDelta[1] / viewAfterZoom.zoom
      ],
      0.5,
      `${viewportCheck.name}: transformed Canvas2D translation used viewport pixels as scene units.`
    );

    await page.getByRole("button", { name: "Inspect" }).click();
    await expect(stage).toHaveAttribute("data-denovo-navigation-input", "false");
    const blockedTwoDimensionalView = await getCanvas2DViewState(stage);
    await waitForCanvasHashToStabilize(
      page,
      `${viewportCheck.name}: Canvas2D transform preview did not settle after changing tools.`
    );
    const blockedTwoDimensionalPixels = await getCanvasBitmapHash(page);
    const blockedNavigationInvariant = await getNavigationInvariantState(stage);
    await dragCanvasForViewport(page, viewportCheck, 36, -24);
    await zoomCanvasAtForViewport(
      page,
      viewportCheck,
      zoomAnchor
    );
    await waitForAnimationFrames(page, 3);
    assertCanvas2DViewClose(
      await getCanvas2DViewState(stage),
      blockedTwoDimensionalView,
      `${viewportCheck.name}: blocked tool changed the Canvas2D view.`
    );
    assert.equal(
      await getCanvasBitmapHash(page),
      blockedTwoDimensionalPixels,
      `${viewportCheck.name}: blocked Canvas2D gestures changed rendered pixels.`
    );
    assert.deepEqual(
      await getNavigationInvariantState(stage),
      blockedNavigationInvariant,
      `${viewportCheck.name}: blocked Canvas2D gestures mutated editor state.`
    );
    await waitForAnimationFrames(page, 6);
    assert.equal(
      await getFrameCount(page),
      demandTwoDimensionalFrameCount,
      `${viewportCheck.name}: Canvas2D navigation restarted demand frame scheduling.`
    );

    const resetViewButton = page.getByRole("button", { name: "Reset View" });
    await expect(resetViewButton).toBeEnabled();
    const resetPixelsBefore = await getCanvasHash(page);
    const resetNavigationInvariant = await getNavigationInvariantState(stage);
    await resetViewButton.click();
    await expect
      .poll(async () => (await getCanvas2DViewState(stage)).zoom, {
        message: `${viewportCheck.name}: waiting for Canvas2D reset.`
      })
      .toBeCloseTo(1, 5);
    const restoredTwoDimensionalView = await getCanvas2DViewState(stage);
    assertCanvas2DViewClose(
      restoredTwoDimensionalView,
      { offset: [0, 0], zoom: 1 },
      `${viewportCheck.name}: resetViewState did not restore identity.`
    );
    await expect
      .poll(() => getCanvasHash(page), {
        message: `${viewportCheck.name}: waiting for reset Canvas2D pixels.`
      })
      .not.toBe(resetPixelsBefore);
    assert.deepEqual(
      await getNavigationInvariantState(stage),
      resetNavigationInvariant,
      `${viewportCheck.name}: resetViewState mutated editor state.`
    );
    await page.getByRole("button", { name: "Select" }).click();
    await stage.focus();
    await page.keyboard.press("Escape");
    selectionRevision += 1;
    await expect(stage).toHaveAttribute("data-denovo-selection-primary", "none");

    await page.getByRole("button", { name: "Inspect" }).click();
    await expect(stage).toHaveAttribute("data-denovo-navigation-input", "false");
    await page.getByRole("button", { name: "Swap Scene" }).click();
    await expect(stage).toHaveAttribute(
      "data-denovo-scene-id",
      "vanilla-3d-demand"
    );
    await expect(stage).toHaveAttribute(
      "data-denovo-active-tool",
      authoringToolIds.inspect
    );
    await expect(stage).toHaveAttribute("data-denovo-navigation-input", "false");
    await expect(page.locator("canvas")).toHaveCSS("cursor", "help");
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(resetViewButton).toBeDisabled();
    await expect(stage).toHaveAttribute(
      "data-denovo-view-offset",
      "unavailable"
    );
    await expect(stage).toHaveAttribute(
      "data-denovo-view-zoom",
      "unavailable"
    );

    const demand3d = await analyzeCanvasScreenshot(page);
    assertCanvasIsRendered(`${viewportCheck.name}:demand-3d`, demand3d);
    const demandFrameCountBefore = await getFrameCount(page);
    await waitForAnimationFrames(page, 6);
    const demandFrameCountAfter = await getFrameCount(page);
    assert.equal(
      demandFrameCountAfter,
      demandFrameCountBefore,
      `${viewportCheck.name}: demand 3D scene continued scheduling frames.`
    );

    const blockedCameraBefore = await getCanvasHash(page);
    const selectionRevisionBeforeBlockedCamera = selectionRevision;
    await dragCanvasForViewport(page, viewportCheck, 72, -36);
    await waitForAnimationFrames(page, 2);
    const blockedCameraAfter = await getCanvasHash(page);
    assert.equal(
      blockedCameraAfter,
      blockedCameraBefore,
      `${viewportCheck.name}: inspect tool did not block camera input after renderer replacement.`
    );
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-revision",
      String(selectionRevisionBeforeBlockedCamera)
    );

    await page.getByRole("button", { name: "Select" }).click();
    await expect(stage).toHaveAttribute(
      "data-denovo-active-tool",
      authoringToolIds.select
    );
    await expect(stage).toHaveAttribute("data-denovo-navigation-input", "true");
    await expect(page.locator("canvas")).toHaveCSS("cursor", "default");

    const threeDimensionalHistoryDepth = await getNumericAttribute(
      stage,
      "data-denovo-history-undo-depth"
    );
    await selectCanvasPoint(page, viewportCheck);
    selectionRevision += 1;
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-primary",
      "static-box"
    );
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-revision",
      String(selectionRevision)
    );
    await expect(selectionStatus).toHaveText("static-box");

    await selectCanvasRatio(page, viewportCheck, { x: 0.5, y: 0.68 });
    selectionRevision += 1;
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-primary",
      "static-pedestal"
    );
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-revision",
      String(selectionRevision)
    );
    await expect(selectionStatus).toHaveText("static-pedestal");

    await selectCanvasPoint(page, viewportCheck, { x: 24, y: 24 });
    selectionRevision += 1;
    await expect(stage).toHaveAttribute("data-denovo-selection-primary", "none");
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-revision",
      String(selectionRevision)
    );
    await expect(stage).toHaveAttribute(
      "data-denovo-history-undo-depth",
      String(threeDimensionalHistoryDepth)
    );

    const staticBoxPositionBeforeTransform = await getPositionAttribute(
      stage,
      "data-denovo-static-box-position"
    );
    const threeDimensionalTransformBefore = await getCanvasHash(page);
    await page.getByRole("button", { name: "Move" }).click();
    await expect(stage).toHaveAttribute(
      "data-denovo-active-tool",
      authoringToolIds.transform
    );
    await expect(stage).toHaveAttribute("data-denovo-navigation-input", "false");
    await expect(page.locator("canvas")).toHaveCSS("cursor", "move");
    const releaseThreeDimensionalTransform = await beginCanvasDragForViewport(
      page,
      viewportCheck,
      undefined,
      52,
      -28
    );
    await expect
      .poll(() => getCanvasHash(page), {
        message: `${viewportCheck.name}: waiting for the 3D transform preview.`
      })
      .not.toBe(threeDimensionalTransformBefore);
    selectionRevision += 1;
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-primary",
      "static-box"
    );
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-revision",
      String(selectionRevision)
    );
    const threeDimensionalTransformPreview = await getCanvasHash(page);
    assert.notEqual(
      threeDimensionalTransformPreview,
      threeDimensionalTransformBefore,
      `${viewportCheck.name}: 3D transform preview did not change the rendered node.`
    );
    assert.deepEqual(
      await getPositionAttribute(stage, "data-denovo-static-box-position"),
      staticBoxPositionBeforeTransform,
      `${viewportCheck.name}: 3D transform preview mutated the document before release.`
    );
    await expect(stage).toHaveAttribute(
      "data-denovo-history-undo-depth",
      String(threeDimensionalHistoryDepth)
    );
    await releaseThreeDimensionalTransform();
    await expect(stage).toHaveAttribute(
      "data-denovo-history-undo-depth",
      String(threeDimensionalHistoryDepth + 1)
    );
    const staticBoxPositionAfterTransform = await getPositionAttribute(
      stage,
      "data-denovo-static-box-position"
    );
    assert.notDeepEqual(
      staticBoxPositionAfterTransform,
      staticBoxPositionBeforeTransform,
      `${viewportCheck.name}: 3D transform was not committed on release.`
    );
    screenshotArtifacts.push({
      content: await page.locator("canvas").screenshot(),
      path: `artifacts/m3-transform-handles-${viewportCheck.name}-3d.png`
    });
    const threeDimensionalXHandlePoint = await findRedHandlePoint(page);
    const releaseConstrainedThreeDimensionalTransform =
      await beginCanvasDragForViewport(
        page,
        viewportCheck,
        threeDimensionalXHandlePoint,
        48,
        24
      );
    await waitForAnimationFrames(page, 2);
    assert.deepEqual(
      await getPositionAttribute(stage, "data-denovo-static-box-position"),
      staticBoxPositionAfterTransform,
      `${viewportCheck.name}: constrained 3D preview mutated the document before release.`
    );
    await releaseConstrainedThreeDimensionalTransform();
    await expect(stage).toHaveAttribute(
      "data-denovo-history-undo-depth",
      String(threeDimensionalHistoryDepth + 2)
    );
    const staticBoxPositionAfterXTransform = await getPositionAttribute(
      stage,
      "data-denovo-static-box-position"
    );
    assert.notEqual(
      staticBoxPositionAfterXTransform[0],
      staticBoxPositionAfterTransform[0],
      `${viewportCheck.name}: 3D X handle did not move the node.`
    );
    assert.equal(
      staticBoxPositionAfterXTransform[1],
      staticBoxPositionAfterTransform[1],
      `${viewportCheck.name}: 3D X handle changed the Y position.`
    );
    assert.equal(
      staticBoxPositionAfterXTransform[2],
      staticBoxPositionAfterTransform[2],
      `${viewportCheck.name}: 3D X handle changed the Z position.`
    );
    await page.getByRole("button", { name: "Select" }).click();
    await stage.focus();
    await page.keyboard.press("Escape");
    selectionRevision += 1;
    await expect(stage).toHaveAttribute("data-denovo-selection-primary", "none");

    await page.getByRole("button", { name: "Navigate" }).click();
    await expect(stage).toHaveAttribute(
      "data-denovo-active-tool",
      authoringToolIds.panOrbit
    );
    await expect(stage).toHaveAttribute("data-denovo-navigation-input", "true");
    await expect(toolStatus).toHaveText(authoringToolIds.panOrbit);
    await expect(page.getByRole("button", { name: "Navigate" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.locator("canvas")).toHaveCSS("cursor", "grab");

    const orbitBefore = await getCanvasHash(page);
    const selectionRevisionBeforeOrbit = selectionRevision;
    await dragCanvasForViewport(page, viewportCheck, 72, -36);
    await expect
      .poll(() => getCanvasHash(page), {
        message: `${viewportCheck.name}: waiting for orbit rendering.`
      })
      .not.toBe(orbitBefore);
    const orbitAfter = await getCanvasHash(page);
    assert.notEqual(
      orbitAfter,
      orbitBefore,
      `${viewportCheck.name}: orbit input did not change the rendered camera.`
    );
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-revision",
      String(selectionRevisionBeforeOrbit)
    );
    await expect(stage).toHaveAttribute("data-denovo-selection-primary", "none");

    const canvas = page.locator("canvas");
    const threeDimensionalCanvasBox = await requireCanvasBox(page);
    await zoomCanvasAtForViewport(page, viewportCheck, [
      threeDimensionalCanvasBox.width / 2,
      threeDimensionalCanvasBox.height / 2
    ]);
    await expect
      .poll(() => getCanvasHash(page), {
        message: `${viewportCheck.name}: waiting for zoom rendering.`
      })
      .not.toBe(orbitAfter);
    const zoomAfter = await getCanvasHash(page);
    assert.notEqual(
      zoomAfter,
      orbitAfter,
      `${viewportCheck.name}: zoom input did not change the rendered camera.`
    );

    await panThreeDimensionalForViewport(page, viewportCheck, 48, 32);
    await expect
      .poll(() => getCanvasHash(page), {
        message: `${viewportCheck.name}: waiting for pan rendering.`
      })
      .not.toBe(zoomAfter);
    const panAfter = await getCanvasHash(page);
    assert.notEqual(
      panAfter,
      zoomAfter,
      `${viewportCheck.name}: pan input did not change the rendered camera.`
    );
    assert.equal(
      await getFrameCount(page),
      demandFrameCountAfter,
      `${viewportCheck.name}: camera controls restarted demand-mode frame scheduling.`
    );
    await expect(stage).toHaveAttribute("data-denovo-input-error", "none");

    await page.getByRole("button", { name: "Select" }).click();
    await expect(stage).toHaveAttribute(
      "data-denovo-active-tool",
      authoringToolIds.select
    );
    await expect(page.locator("canvas")).toHaveCSS("cursor", "default");

    const blockingConsoleMessages = consoleMessages.filter((message) =>
      isBlockingConsoleMessage(message)
    );
    const resizeObserverErrors = [
      ...consoleMessages.map((message) => message.text),
      ...pageErrors
    ].filter((message) => /ResizeObserver loop/i.test(message));

    assert.deepEqual(resizeObserverErrors, []);
    assert.deepEqual(blockingConsoleMessages, []);
    assert.deepEqual(pageErrors, []);

    return {
      canvas: {
        demand3d,
        initial3d,
        resized,
        swapped2d
      },
      consoleMessageCount: consoleMessages.length,
      cameraControls: {
        blockedByInspect: blockedCameraAfter === blockedCameraBefore,
        orbit: orbitAfter !== orbitBefore,
        pan: panAfter !== zoomAfter,
        zoom: zoomAfter !== orbitAfter
      },
      canvas2dNavigation: {
        anchorPreserved: true,
        blockedByInspect: true,
        demandFrameCount: demandTwoDimensionalFrameCount,
        pan: viewAfterPan,
        reset: restoredTwoDimensionalView,
        transformedTranslation: transformedPanelPositionAfter,
        zoom: viewAfterZoom
      },
      demandFrameCount: demandFrameCountAfter,
      hitSelection: {
        dragDidNotSelect: true,
        modeSwitchRebound: true,
        threeDimensional: ["static-box", "static-pedestal"],
        twoDimensional: ["overlay", "panel"]
      },
      transformTool: {
        threeDimensional: {
          committed: staticBoxPositionAfterTransform,
          constrainedX: staticBoxPositionAfterXTransform,
          previewWasTransient: true,
          singleHistoryEntry: true
        },
        twoDimensional: {
          committed: panelPositionAfterTransform,
          constrainedX: panelPositionAfterXTransform,
          previewWasTransient: true,
          singleHistoryEntry: true
        }
      },
      toolRouting: {
        escapeClearedSelection: true,
        navigationPolicySurvivedModeSwitch: true,
        pointerType: viewportCheck.hasTouch ? "touch" : "mouse",
        switchedTools: true
      },
      name: viewportCheck.name
    };
  } finally {
    await context.close();
  }
}

async function verifyTwoDimensionalAuthoring(browser, url, viewportCheck) {
  const context = await browser.newContext(viewportCheck);
  const page = await context.newPage();
  const diagnostics = collectPageDiagnostics(page);

  try {
    await openAuthoringScene(page, url, "vanilla-2d", 1);
    const stage = page.locator("#stage");
    const initialAnalysis = await analyzeCanvasScreenshot(page);
    assertCanvasIsRendered(
      `${viewportCheck.name}:2d-authoring-initial`,
      initialAnalysis
    );
    await assertDemandRenderingSettles(
      page,
      `${viewportCheck.name}: 2D authoring scene did not settle in demand mode.`
    );

    const rectangleResult = await createNodeWithPreview({
      end: [140, 100],
      label: `${viewportCheck.name}: 2D rectangle`,
      page,
      stage,
      start: [40, 40],
      toolId: authoringToolIds.rect2d,
      toolName: "2D Rect",
      type: "rect",
      viewportCheck
    });
    assert.deepEqual(rectangleResult.node.position, [40, 40]);
    assert.deepEqual(rectangleResult.node.size, [100, 60]);
    assertGridAligned2D(rectangleResult.node.position);
    assertGridAligned2D(rectangleResult.node.size);

    const rectangleBeforeEdit = rectangleResult.node;
    const rectangleEditState = await clickDocumentAction(
      page,
      stage,
      "Edit Last",
      `${viewportCheck.name}: rectangle property edit did not commit.`
    );
    const rectangleAfterEdit = requireDocumentNode(
      rectangleEditState.document,
      rectangleResult.node.id,
      "rect"
    );
    assert.notEqual(rectangleAfterEdit.fill, rectangleBeforeEdit.fill);

    const circleResult = await createNodeWithPreview({
      end: [260, 100],
      label: `${viewportCheck.name}: 2D circle`,
      page,
      stage,
      start: [220, 60],
      toolId: authoringToolIds.circle2d,
      toolName: "2D Circle",
      type: "circle",
      viewportCheck
    });
    assert.deepEqual(circleResult.node.position, [220, 60]);
    assert.ok(
      Math.abs(circleResult.node.radius - Math.hypot(40, 40)) <= 1e-9,
      `${viewportCheck.name}: circle radius did not use the snapped endpoint.`
    );
    assertGridAligned2D(circleResult.node.position);

    const circleEditState = await clickDocumentAction(
      page,
      stage,
      "Edit Last",
      `${viewportCheck.name}: circle property edit did not commit.`
    );
    const circleAfterEdit = requireDocumentNode(
      circleEditState.document,
      circleResult.node.id,
      "circle"
    );
    assert.equal(circleAfterEdit.radius, circleResult.node.radius + 8);

    await activateAuthoringTool(
      page,
      stage,
      "Select",
      authoringToolIds.select
    );
    await tapCanvasLocal(page, viewportCheck, [80, 70]);
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-primary",
      rectangleResult.node.id
    );

    const rectangleBeforeRotate = requireDocumentNode(
      (await getAuthoringState(stage)).document,
      rectangleResult.node.id,
      "rect"
    );
    await verifyTransformPreviewAndCommit({
      delta: [22, 30],
      handlePoint: [92, 40],
      label: `${viewportCheck.name}: 2D rotate`,
      nodeId: rectangleResult.node.id,
      page,
      stage,
      toolId: authoringToolIds.rotate,
      toolName: "Rotate",
      viewportCheck
    });
    const rectangleAfterRotate = requireDocumentNode(
      (await getAuthoringState(stage)).document,
      rectangleResult.node.id,
      "rect"
    );
    assert.notEqual(
      rectangleAfterRotate.rotation,
      rectangleBeforeRotate.rotation,
      `${viewportCheck.name}: 2D rotation was not committed.`
    );

    const rectangleBeforeScale = rectangleAfterRotate;
    await verifyTransformPreviewAndCommit({
      delta: [30, 30],
      handlePoint: rectangleAfterRotate.position,
      label: `${viewportCheck.name}: 2D scale`,
      nodeId: rectangleResult.node.id,
      page,
      stage,
      toolId: authoringToolIds.scale,
      toolName: "Scale",
      viewportCheck
    });
    const rectangleAfterScale = requireDocumentNode(
      (await getAuthoringState(stage)).document,
      rectangleResult.node.id,
      "rect"
    );
    assert.notDeepEqual(
      rectangleAfterScale.scale,
      rectangleBeforeScale.scale,
      `${viewportCheck.name}: 2D scale was not committed.`
    );

    const groupedState = await clickDocumentAction(
      page,
      stage,
      "Group Last Two",
      `${viewportCheck.name}: 2D grouping did not commit.`
    );
    const groupId = groupedState.groupId;
    assert.notEqual(groupId, "none");
    requireDocumentNode(groupedState.document, groupId, "group");
    assert.equal(
      requireDocumentNode(
        groupedState.document,
        rectangleResult.node.id,
        "rect"
      ).parentId,
      groupId
    );
    assert.equal(
      requireDocumentNode(
        groupedState.document,
        circleResult.node.id,
        "circle"
      ).parentId,
      groupId
    );

    const ungroupedState = await clickDocumentAction(
      page,
      stage,
      "Ungroup",
      `${viewportCheck.name}: 2D ungrouping did not commit.`
    );
    assert.equal(
      ungroupedState.document.scene.nodes.some((node) => node.id === groupId),
      false
    );
    assert.equal(
      requireDocumentNode(
        ungroupedState.document,
        rectangleResult.node.id,
        "rect"
      ).parentId,
      null
    );
    await clickDocumentAction(
      page,
      stage,
      "Undo",
      `${viewportCheck.name}: 2D ungroup undo did not commit.`
    );
    assert.equal(
      (await getAuthoringState(stage)).document.scene.nodes.some(
        (node) => node.id === groupId
      ),
      true
    );
    await clickDocumentAction(
      page,
      stage,
      "Redo",
      `${viewportCheck.name}: 2D ungroup redo did not commit.`
    );

    const layerAddedState = await clickDocumentAction(
      page,
      stage,
      "Add Layer",
      `${viewportCheck.name}: 2D layer add did not commit.`
    );
    assert.deepEqual(
      layerAddedState.document.scene.layers.map((layer) => layer.id),
      ["main", "authoring", "authoring-extra"]
    );
    const layerReorderedState = await clickDocumentAction(
      page,
      stage,
      "Reorder Layer",
      `${viewportCheck.name}: 2D layer reorder did not commit.`
    );
    assert.equal(layerReorderedState.document.scene.layers[0]?.id, "authoring");
    const layerRestoredState = await clickDocumentAction(
      page,
      stage,
      "Reorder Layer",
      `${viewportCheck.name}: 2D layer reorder restoration did not commit.`
    );
    assert.equal(layerRestoredState.document.scene.layers.at(-1)?.id, "authoring");

    await activateAuthoringTool(
      page,
      stage,
      "Select",
      authoringToolIds.select
    );
    await clearSelection(page, stage);
    const visibleLayerPixels = await waitForCanvasHashToStabilize(
      page,
      `${viewportCheck.name}: 2D visible layer pixels did not settle.`
    );
    const hiddenLayerState = await clickDocumentAction(
      page,
      stage,
      "Toggle Layer Visibility",
      `${viewportCheck.name}: 2D layer hide did not commit.`
    );
    assert.equal(requireLayer(hiddenLayerState.document, "authoring").visible, false);
    await expect
      .poll(() => getCanvasHash(page), {
        message: `${viewportCheck.name}: 2D hidden layer did not change pixels.`
      })
      .not.toBe(visibleLayerPixels);
    await tapCanvasLocal(page, viewportCheck, circleAfterEdit.position);
    await waitForAnimationFrames(page, 2);
    assert.notEqual(
      (await getAuthoringState(stage)).selectionPrimary,
      circleResult.node.id,
      `${viewportCheck.name}: hidden 2D node remained hit-testable.`
    );
    const shownLayerState = await clickDocumentAction(
      page,
      stage,
      "Toggle Layer Visibility",
      `${viewportCheck.name}: 2D layer show did not commit.`
    );
    assert.equal(requireLayer(shownLayerState.document, "authoring").visible, true);

    const lockedLayerState = await clickDocumentAction(
      page,
      stage,
      "Toggle Layer Lock",
      `${viewportCheck.name}: 2D layer lock did not commit.`
    );
    assert.equal(requireLayer(lockedLayerState.document, "authoring").locked, true);
    const lockedBefore = await getAuthoringState(stage);
    const lockedPixelsBefore = await getCanvasBitmapHash(page);
    await activateAuthoringTool(
      page,
      stage,
      "2D Rect",
      authoringToolIds.rect2d
    );
    const lockedGesture = await beginAuthoringGesture(
      page,
      viewportCheck,
      [40, 260],
      [100, 300]
    );
    try {
      await expect(stage).toHaveAttribute("data-denovo-input-error", /locked/i);
      await lockedGesture.release();
    } finally {
      await lockedGesture.cancel();
    }
    const lockedAfter = await getAuthoringState(stage);
    assert.equal(lockedAfter.documentJson, lockedBefore.documentJson);
    assert.equal(lockedAfter.historyUndo, lockedBefore.historyUndo);
    assert.equal(await getCanvasBitmapHash(page), lockedPixelsBefore);
    const unlockedLayerState = await clickDocumentAction(
      page,
      stage,
      "Toggle Layer Lock",
      `${viewportCheck.name}: 2D layer unlock did not commit.`
    );
    assert.equal(requireLayer(unlockedLayerState.document, "authoring").locked, false);

    await activateAuthoringTool(
      page,
      stage,
      "Select",
      authoringToolIds.select
    );
    await clearSelection(page, stage);
    await waitForCanvasHashToStabilize(
      page,
      `${viewportCheck.name}: 2D measurement cleanup baseline did not settle.`
    );
    const measurementCleanupBaseline = await getCanvasBitmapHash(page);
    const measurementBefore = await getAuthoringState(stage);
    await activateAuthoringTool(
      page,
      stage,
      "2D Distance",
      authoringToolIds.distance2d
    );
    const measurementPreviewGesture = await beginAuthoringGesture(
      page,
      viewportCheck,
      [40, 200],
      [100, 160]
    );
    try {
      await expect
        .poll(() => getCanvasBitmapHash(page), {
          message: `${viewportCheck.name}: 2D measurement draft preview was not rendered.`
        })
        .not.toBe(measurementCleanupBaseline);
      const measurementPreviewState = await getAuthoringState(stage);
      assert.equal(
        measurementPreviewState.documentJson,
        measurementBefore.documentJson
      );
      assert.equal(measurementPreviewState.historyUndo, measurementBefore.historyUndo);
      await activateAuthoringToolProgrammatically(
        page,
        stage,
        "Select",
        authoringToolIds.select
      );
    } finally {
      await measurementPreviewGesture.cancel();
    }
    await expect
      .poll(() => getCanvasBitmapHash(page), {
        message: `${viewportCheck.name}: 2D measurement preview was not cleaned on tool change.`
      })
      .toBe(measurementCleanupBaseline);

    await activateAuthoringTool(
      page,
      stage,
      "2D Distance",
      authoringToolIds.distance2d
    );
    await tapCanvasSequence(page, viewportCheck, [
      [40, 200],
      [140, 200]
    ]);
    await expect(stage).toHaveAttribute(
      "data-denovo-history-undo-depth",
      String(measurementBefore.historyUndo + 1)
    );
    const measurementState = await getAuthoringState(stage);
    const measurementId = measurementState.lastCommittedId;
    const measurementNode = requireDocumentNode(
      measurementState.document,
      measurementId,
      "measurement"
    );
    assert.deepEqual(measurementNode.start, [40, 200]);
    assert.deepEqual(measurementNode.end, [140, 200]);
    assertGridAligned2D(measurementNode.start);
    assertGridAligned2D(measurementNode.end);
    await activateAuthoringTool(
      page,
      stage,
      "Select",
      authoringToolIds.select
    );
    await tapCanvasLocal(page, viewportCheck, [70, 200]);
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-primary",
      measurementId
    );
    const measurementEditedState = await clickDocumentAction(
      page,
      stage,
      "Edit Last",
      `${viewportCheck.name}: 2D measurement edit did not commit.`
    );
    assert.equal(
      requireDocumentNode(
        measurementEditedState.document,
        measurementId,
        "measurement"
      ).precision,
      measurementNode.precision + 1
    );
    await clickDocumentAction(
      page,
      stage,
      "Undo",
      `${viewportCheck.name}: 2D measurement edit undo did not commit.`
    );
    assert.equal(
      requireDocumentNode(
        (await getAuthoringState(stage)).document,
        measurementId,
        "measurement"
      ).precision,
      measurementNode.precision
    );
    await clickDocumentAction(
      page,
      stage,
      "Redo",
      `${viewportCheck.name}: 2D measurement edit redo did not commit.`
    );

    await activateAuthoringTool(
      page,
      stage,
      "Select",
      authoringToolIds.select
    );
    await clearSelection(page, stage);
    await waitForCanvasHashToStabilize(
      page,
      `${viewportCheck.name}: 2D annotation cancellation baseline did not settle.`
    );
    const annotationCancelBaseline = await getCanvasBitmapHash(page);
    const annotationCancelBefore = await getAuthoringState(stage);
    await page.getByLabel("Annotation text").fill("");
    await activateAuthoringTool(
      page,
      stage,
      "2D Annotation",
      authoringToolIds.annotation2d
    );
    const cancelledAnnotationGesture = await beginAuthoringGesture(
      page,
      viewportCheck,
      [60, 300],
      [80, 320]
    );
    try {
      await expect
        .poll(() => getCanvasBitmapHash(page), {
          message: `${viewportCheck.name}: 2D annotation anchor preview was not rendered.`
        })
        .not.toBe(annotationCancelBaseline);
      await cancelledAnnotationGesture.release();
    } finally {
      await cancelledAnnotationGesture.cancel();
    }
    await expect
      .poll(() => getCanvasBitmapHash(page), {
        message: `${viewportCheck.name}: cancelled 2D annotation preview was not cleaned.`
      })
      .toBe(annotationCancelBaseline);
    const annotationCancelAfter = await getAuthoringState(stage);
    assert.equal(annotationCancelAfter.documentJson, annotationCancelBefore.documentJson);
    assert.equal(annotationCancelAfter.historyUndo, annotationCancelBefore.historyUndo);

    await page.getByLabel("Annotation text").fill("M3 2D note");
    const annotationResult = await createNodeWithPreview({
      end: [220, 320],
      label: `${viewportCheck.name}: 2D annotation`,
      page,
      stage,
      start: [200, 300],
      toolId: authoringToolIds.annotation2d,
      toolName: "2D Annotation",
      type: "annotation",
      viewportCheck
    });
    assert.deepEqual(annotationResult.node.anchor, [220, 320]);
    assert.equal(annotationResult.node.text, "M3 2D note");
    assertGridAligned2D(annotationResult.node.anchor);
    await activateAuthoringTool(
      page,
      stage,
      "Select",
      authoringToolIds.select
    );
    await tapCanvasLocal(page, viewportCheck, annotationResult.node.anchor);
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-primary",
      annotationResult.node.id
    );
    const annotationEditedState = await clickDocumentAction(
      page,
      stage,
      "Edit Last",
      `${viewportCheck.name}: 2D annotation edit did not commit.`
    );
    assert.equal(
      requireDocumentNode(
        annotationEditedState.document,
        annotationResult.node.id,
        "annotation"
      ).text,
      "M3 2D note · edited"
    );
    await clickDocumentAction(
      page,
      stage,
      "Undo",
      `${viewportCheck.name}: 2D annotation edit undo did not commit.`
    );
    assert.equal(
      requireDocumentNode(
        (await getAuthoringState(stage)).document,
        annotationResult.node.id,
        "annotation"
      ).text,
      "M3 2D note"
    );
    await clickDocumentAction(
      page,
      stage,
      "Redo",
      `${viewportCheck.name}: 2D annotation edit redo did not commit.`
    );

    const beforeReload = await getAuthoringState(stage);
    const reloadRevisionBefore = beforeReload.reloadRevision;
    await page.getByRole("button", { name: "Reload Document JSON" }).click();
    await expect(stage).toHaveAttribute("data-denovo-pending-count", "0");
    await expect(stage).toHaveAttribute("data-denovo-reload-result", "success");
    await expect(stage).toHaveAttribute(
      "data-denovo-reload-revision",
      String(reloadRevisionBefore + 1)
    );
    const afterReload = await getAuthoringState(stage);
    assert.deepEqual(afterReload.document, beforeReload.document);
    requireDocumentNode(afterReload.document, measurementId, "measurement");
    requireDocumentNode(
      afterReload.document,
      annotationResult.node.id,
      "annotation"
    );
    const reloadAnalysis = await analyzeCanvasScreenshot(page);
    assertCanvasIsRendered(
      `${viewportCheck.name}:2d-authoring-reload`,
      reloadAnalysis
    );
    await assertDemandRenderingSettles(
      page,
      `${viewportCheck.name}: reloaded 2D document did not settle in demand mode.`
    );

    await page.getByLabel("Annotation text").fill("replacement draft");
    await activateAuthoringTool(
      page,
      stage,
      "2D Annotation",
      authoringToolIds.annotation2d
    );
    const replacementBaseline = await getCanvasHash(page);
    const replacementGesture = await beginAuthoringGesture(
      page,
      viewportCheck,
      [280, 300],
      [300, 320]
    );
    try {
      await expect
        .poll(() => getCanvasHash(page), {
          message: `${viewportCheck.name}: replacement 2D draft was not rendered.`
        })
        .not.toBe(replacementBaseline);
      await page
        .getByRole("button", { name: "Swap Scene" })
        .evaluate((button) => button.click());
      await expect(stage).toHaveAttribute(
        "data-denovo-scene-id",
        "vanilla-3d-demand"
      );
      await expect(stage).toHaveAttribute("data-denovo-pending-count", "0");
    } finally {
      await replacementGesture.cancel();
    }
    const replacementState = await getAuthoringState(stage);
    assert.equal(replacementState.document.scene.mode, "3d");
    assert.equal(
      replacementState.document.scene.nodes.some((node) =>
        node.id.startsWith("authoring-")
      ),
      false
    );
    const replacementAnalysis = await analyzeCanvasScreenshot(page);
    assertCanvasIsRendered(
      `${viewportCheck.name}:2d-authoring-replacement`,
      replacementAnalysis
    );
    await assertDemandRenderingSettles(
      page,
      `${viewportCheck.name}: replacement after 2D draft did not settle.`
    );

    assertPageDiagnosticsClean(diagnostics, `${viewportCheck.name}:2d-authoring`);
    return {
      annotationId: annotationResult.node.id,
      creationTypes: ["rect", "circle"],
      groupRoundTrip: true,
      gridPlacement: true,
      layerLifecycle: true,
      measurementId,
      nonblank: true,
      pointerType: viewportCheck.hasTouch ? "touch" : "mouse",
      replacementCleanup: true,
      transforms: ["rotate", "scale"]
    };
  } finally {
    await context.close();
  }
}

async function verifyThreeDimensionalAuthoring(browser, url, viewportCheck) {
  const context = await browser.newContext(viewportCheck);
  const page = await context.newPage();
  const diagnostics = collectPageDiagnostics(page);

  try {
    await installWebGlRenderProbe(page);
    await openAuthoringScene(page, url, "vanilla-3d-demand", 2);
    const stage = page.locator("#stage");
    const canvasBox = await requireCanvasBox(page);
    const initialAnalysis = await analyzeCanvasScreenshot(page);
    assertCanvasIsRendered(
      `${viewportCheck.name}:3d-authoring-initial`,
      initialAnalysis
    );
    await assertDemandRenderingSettles(
      page,
      `${viewportCheck.name}: 3D authoring scene did not settle in demand mode.`
    );

    const surfaceBoxScale = [0.65, 0.65, 0.65];
    const surfaceBoxHalfExtent = surfaceBoxScale[1] / 2;
    const stackedBoxIds = [];
    let topSurfaceY = 0.6;

    for (let index = 0; index < 3; index += 1) {
      const targetPoint = [0, topSurfaceY, 0];
      const expectedPosition = [0, topSurfaceY + surfaceBoxHalfExtent, 0];
      const projectedTarget = worldPointToThreeDimensionalCanvas(
        canvasBox,
        targetPoint
      );
      const result = await createNodeWithPreview({
        end: projectedTarget,
        label: `${viewportCheck.name}: stacked 3D box ${index + 1}`,
        page,
        stage,
        start: projectedTarget,
        toolId: authoringToolIds.stackBox3d,
        toolName: "Stack Box",
        type: "box",
        viewportCheck
      });
      assertPointClose(
        result.node.position,
        expectedPosition,
        surfacePlacementCoordinateTolerance,
        `${viewportCheck.name}: stacked box ${index + 1} did not use the exact top-face offset.`
      );
      assert.deepEqual(
        result.node.rotation,
        [0, 0, 0],
        `${viewportCheck.name}: stacked box ${index + 1} was not world-aligned.`
      );
      assert.deepEqual(
        result.node.scale,
        surfaceBoxScale,
        `${viewportCheck.name}: stacked box ${index + 1} changed the requested box scale.`
      );
      stackedBoxIds.push(result.node.id);
      topSurfaceY = expectedPosition[1] + surfaceBoxHalfExtent;
    }

    const sideTargetPoint = [0.6, 0, 0];
    const sideProjectedTarget = worldPointToThreeDimensionalCanvas(
      canvasBox,
      sideTargetPoint
    );
    const sidePlacementResult = await createNodeWithPreview({
      end: sideProjectedTarget,
      label: `${viewportCheck.name}: side-face 3D box`,
      page,
      stage,
      start: sideProjectedTarget,
      toolId: authoringToolIds.stackBox3d,
      toolName: "Stack Box",
      type: "box",
      viewportCheck
    });
    assertPointClose(
      [sidePlacementResult.node.position[0]],
      [sideTargetPoint[0] + surfaceBoxScale[0] / 2],
      surfacePlacementCoordinateTolerance,
      `${viewportCheck.name}: side-face box did not use the exact +X normal offset.`
    );
    assertPointClose(
      sidePlacementResult.node.position.slice(1),
      [0, 0],
      surfacePlacementTangentialTolerance,
      `${viewportCheck.name}: side-face box drifted from the projected tangential target.`
    );
    assert.deepEqual(
      sidePlacementResult.node.rotation,
      [0, 0, 0],
      `${viewportCheck.name}: side-face box was not world-aligned.`
    );
    assert.deepEqual(
      sidePlacementResult.node.scale,
      surfaceBoxScale,
      `${viewportCheck.name}: side-face placement changed the requested box scale.`
    );

    await verifySurfaceMissClearsPreview({
      hitPoint: worldPointToThreeDimensionalCanvas(
        canvasBox,
        [0, topSurfaceY, 0]
      ),
      label: `${viewportCheck.name}: surface placement miss`,
      missPoint: [canvasBox.width * 0.05, canvasBox.height * 0.05],
      page,
      stage,
      toolId: authoringToolIds.stackBox3d,
      toolName: "Stack Box",
      viewportCheck
    });

    const boxStart = [canvasBox.width * 0.22, canvasBox.height * 0.72];
    const boxEnd = [canvasBox.width * 0.32, canvasBox.height * 0.7];
    const expectedBoxPosition = snapThreeDimensionalWorkPlanePoint(
      screenPointToThreeDimensionalWorkPlane(canvasBox, boxEnd)
    );
    const boxResult = await createNodeWithPreview({
      end: boxEnd,
      label: `${viewportCheck.name}: 3D box`,
      page,
      stage,
      start: boxStart,
      toolId: authoringToolIds.box3d,
      toolName: "3D Box",
      type: "box",
      viewportCheck
    });
    assertPointClose(
      boxResult.node.position,
      expectedBoxPosition,
      1e-9,
      `${viewportCheck.name}: 3D box did not use the exact snapped work-plane point.`
    );
    assertGridAligned3D(boxResult.node.position);

    const boxEditState = await clickDocumentAction(
      page,
      stage,
      "Edit Last",
      `${viewportCheck.name}: box property edit did not commit.`
    );
    const boxAfterEdit = requireDocumentNode(
      boxEditState.document,
      boxResult.node.id,
      "box"
    );
    assert.notEqual(boxAfterEdit.color, boxResult.node.color);

    const sphereStart = [canvasBox.width * 0.8, canvasBox.height * 0.7];
    const sphereEnd = [canvasBox.width * 0.7, canvasBox.height * 0.72];
    const expectedSpherePosition = snapThreeDimensionalWorkPlanePoint(
      screenPointToThreeDimensionalWorkPlane(canvasBox, sphereEnd)
    );
    const sphereResult = await createNodeWithPreview({
      end: sphereEnd,
      label: `${viewportCheck.name}: 3D sphere`,
      page,
      stage,
      start: sphereStart,
      toolId: authoringToolIds.sphere3d,
      toolName: "3D Sphere",
      type: "sphere",
      viewportCheck
    });
    assertPointClose(
      sphereResult.node.position,
      expectedSpherePosition,
      1e-9,
      `${viewportCheck.name}: 3D sphere did not use the exact snapped work-plane point.`
    );
    assertGridAligned3D(sphereResult.node.position);

    const sphereEditState = await clickDocumentAction(
      page,
      stage,
      "Edit Last",
      `${viewportCheck.name}: sphere property edit did not commit.`
    );
    const sphereAfterEdit = requireDocumentNode(
      sphereEditState.document,
      sphereResult.node.id,
      "sphere"
    );
    assert.equal(sphereAfterEdit.radius, sphereResult.node.radius + 0.1);

    await activateAuthoringTool(
      page,
      stage,
      "Select",
      authoringToolIds.select
    );
    const boxSelectionPoint = worldPointToThreeDimensionalCanvas(
      canvasBox,
      boxAfterEdit.position
    );
    await tapCanvasLocal(page, viewportCheck, boxSelectionPoint);
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-primary",
      boxResult.node.id
    );

    const boxBeforeRotate = requireDocumentNode(
      (await getAuthoringState(stage)).document,
      boxResult.node.id,
      "box"
    );
    await activateAuthoringTool(
      page,
      stage,
      "Rotate",
      authoringToolIds.rotate
    );
    const rotateHandle = await findRedTransformHandlePoint(page, "farthest");
    await verifyTransformPreviewAndCommit({
      delta: [26, -18],
      handlePoint: rotateHandle,
      label: `${viewportCheck.name}: 3D rotate`,
      nodeId: boxResult.node.id,
      page,
      stage,
      toolId: authoringToolIds.rotate,
      toolName: "Rotate",
      viewportCheck
    });
    const boxAfterRotate = requireDocumentNode(
      (await getAuthoringState(stage)).document,
      boxResult.node.id,
      "box"
    );
    assert.notDeepEqual(
      boxAfterRotate.rotation,
      boxBeforeRotate.rotation,
      `${viewportCheck.name}: 3D rotation was not committed.`
    );

    await activateAuthoringTool(
      page,
      stage,
      "Scale",
      authoringToolIds.scale
    );
    const scaleHandle = await findRedTransformHandlePoint(page, "centroid");
    await verifyTransformPreviewAndCommit({
      delta: [30, 14],
      handlePoint: scaleHandle,
      label: `${viewportCheck.name}: 3D scale`,
      nodeId: boxResult.node.id,
      page,
      stage,
      toolId: authoringToolIds.scale,
      toolName: "Scale",
      viewportCheck
    });
    const boxAfterScale = requireDocumentNode(
      (await getAuthoringState(stage)).document,
      boxResult.node.id,
      "box"
    );
    assert.notDeepEqual(
      boxAfterScale.scale,
      boxAfterRotate.scale,
      `${viewportCheck.name}: 3D scale was not committed.`
    );

    const groupedState = await clickDocumentAction(
      page,
      stage,
      "Group Last Two",
      `${viewportCheck.name}: 3D grouping did not commit.`
    );
    const groupId = groupedState.groupId;
    assert.notEqual(groupId, "none");
    requireDocumentNode(groupedState.document, groupId, "group");
    assert.equal(
      requireDocumentNode(groupedState.document, boxResult.node.id, "box")
        .parentId,
      groupId
    );
    assert.equal(
      requireDocumentNode(
        groupedState.document,
        sphereResult.node.id,
        "sphere"
      ).parentId,
      groupId
    );
    const ungroupedState = await clickDocumentAction(
      page,
      stage,
      "Ungroup",
      `${viewportCheck.name}: 3D ungrouping did not commit.`
    );
    assert.equal(
      ungroupedState.document.scene.nodes.some((node) => node.id === groupId),
      false
    );
    await clickDocumentAction(
      page,
      stage,
      "Undo",
      `${viewportCheck.name}: 3D ungroup undo did not commit.`
    );
    assert.equal(
      (await getAuthoringState(stage)).document.scene.nodes.some(
        (node) => node.id === groupId
      ),
      true
    );
    await clickDocumentAction(
      page,
      stage,
      "Redo",
      `${viewportCheck.name}: 3D ungroup redo did not commit.`
    );

    const layerAddedState = await clickDocumentAction(
      page,
      stage,
      "Add Layer",
      `${viewportCheck.name}: 3D layer add did not commit.`
    );
    assert.deepEqual(
      layerAddedState.document.scene.layers.map((layer) => layer.id),
      ["main", "authoring", "authoring-extra"]
    );
    const layerReorderedState = await clickDocumentAction(
      page,
      stage,
      "Reorder Layer",
      `${viewportCheck.name}: 3D layer reorder did not commit.`
    );
    assert.equal(layerReorderedState.document.scene.layers[0]?.id, "authoring");
    const layerRestoredState = await clickDocumentAction(
      page,
      stage,
      "Reorder Layer",
      `${viewportCheck.name}: 3D layer reorder restoration did not commit.`
    );
    assert.equal(layerRestoredState.document.scene.layers.at(-1)?.id, "authoring");

    await activateAuthoringTool(
      page,
      stage,
      "Select",
      authoringToolIds.select
    );
    await clearSelection(page, stage);
    const visibleLayerPixels = await waitForCanvasHashToStabilize(
      page,
      `${viewportCheck.name}: 3D visible layer pixels did not settle.`
    );
    const hiddenLayerState = await clickDocumentAction(
      page,
      stage,
      "Toggle Layer Visibility",
      `${viewportCheck.name}: 3D layer hide did not commit.`
    );
    assert.equal(requireLayer(hiddenLayerState.document, "authoring").visible, false);
    await expect
      .poll(() => getCanvasHash(page), {
        message: `${viewportCheck.name}: 3D hidden layer did not change pixels.`
      })
      .not.toBe(visibleLayerPixels);
    await tapCanvasLocal(page, viewportCheck, [
      canvasBox.width * 0.5,
      canvasBox.height * 0.5
    ]);
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-primary",
      "static-box"
    );
    const currentHiddenBox = requireDocumentNode(
      hiddenLayerState.document,
      boxResult.node.id,
      "box"
    );
    const hiddenSelectionRevision = (await getAuthoringState(stage))
      .selectionRevision;
    await tapCanvasLocal(
      page,
      viewportCheck,
      worldPointToThreeDimensionalCanvas(canvasBox, currentHiddenBox.position)
    );
    await expect
      .poll(
        () => getNumericAttribute(stage, "data-denovo-selection-revision"),
        { message: `${viewportCheck.name}: hidden 3D hit test did not resolve.` }
      )
      .toBeGreaterThan(hiddenSelectionRevision);
    assert.notEqual(
      (await getAuthoringState(stage)).selectionPrimary,
      boxResult.node.id,
      `${viewportCheck.name}: hidden 3D node remained hit-testable.`
    );
    const shownLayerState = await clickDocumentAction(
      page,
      stage,
      "Toggle Layer Visibility",
      `${viewportCheck.name}: 3D layer show did not commit.`
    );
    assert.equal(requireLayer(shownLayerState.document, "authoring").visible, true);

    const lockedLayerState = await clickDocumentAction(
      page,
      stage,
      "Toggle Layer Lock",
      `${viewportCheck.name}: 3D layer lock did not commit.`
    );
    assert.equal(requireLayer(lockedLayerState.document, "authoring").locked, true);
    const lockedBefore = await getAuthoringState(stage);
    await activateAuthoringTool(
      page,
      stage,
      "3D Box",
      authoringToolIds.box3d
    );
    const lockedPixelsBefore = await getCanvasHash(page);
    const lockedGesture = await beginAuthoringGesture(
      page,
      viewportCheck,
      [canvasBox.width * 0.5, canvasBox.height * 0.7],
      [canvasBox.width * 0.55, canvasBox.height * 0.7]
    );
    try {
      await expect(stage).toHaveAttribute("data-denovo-input-error", /locked/i);
      await lockedGesture.release();
    } finally {
      await lockedGesture.cancel();
    }
    const lockedAfter = await getAuthoringState(stage);
    assert.equal(lockedAfter.documentJson, lockedBefore.documentJson);
    assert.equal(lockedAfter.historyUndo, lockedBefore.historyUndo);
    assert.equal(await getCanvasHash(page), lockedPixelsBefore);
    const unlockedLayerState = await clickDocumentAction(
      page,
      stage,
      "Toggle Layer Lock",
      `${viewportCheck.name}: 3D layer unlock did not commit.`
    );
    assert.equal(requireLayer(unlockedLayerState.document, "authoring").locked, false);

    await activateAuthoringTool(
      page,
      stage,
      "Select",
      authoringToolIds.select
    );
    await clearSelection(page, stage);
    const measurementBefore = await getAuthoringState(stage);
    const measurementStartPoint = [
      canvasBox.width * 0.18,
      canvasBox.height * 0.58
    ];
    const measurementEndPoint = [
      canvasBox.width * 0.42,
      canvasBox.height * 0.58
    ];
    const measurementPreviewPoint = [
      canvasBox.width * 0.3,
      canvasBox.height * 0.5
    ];
    await activateAuthoringTool(
      page,
      stage,
      "3D Distance",
      authoringToolIds.distance3d
    );
    const measurementRenderBaseline = await getWebGlRenderProbe(page);
    assert.ok(
      measurementRenderBaseline.drawCalls > 0,
      `${viewportCheck.name}: 3D measurement baseline did not contain rendered geometry.`
    );
    const measurementPreviewGesture = await beginAuthoringGesture(
      page,
      viewportCheck,
      measurementStartPoint,
      measurementPreviewPoint
    );
    let measurementPreviewRender;
    try {
      measurementPreviewRender = await waitForWebGlPreviewRender(
        page,
        measurementRenderBaseline,
        `${viewportCheck.name}: 3D measurement draft preview was not rendered.`
      );
      const measurementPreviewState = await getAuthoringState(stage);
      assert.equal(
        measurementPreviewState.documentJson,
        measurementBefore.documentJson
      );
      assert.equal(
        measurementPreviewState.historyUndo,
        measurementBefore.historyUndo
      );
      await activateAuthoringToolProgrammatically(
        page,
        stage,
        "Select",
        authoringToolIds.select
      );
    } finally {
      await measurementPreviewGesture.cancel();
    }
    await waitForWebGlPreviewCleanup(
      page,
      measurementRenderBaseline,
      measurementPreviewRender,
      `${viewportCheck.name}: 3D measurement preview was not cleaned on tool change.`
    );
    await assertDemandRenderingSettles(
      page,
      `${viewportCheck.name}: cleaned 3D measurement preview restarted demand scheduling.`
    );

    await activateAuthoringTool(
      page,
      stage,
      "3D Distance",
      authoringToolIds.distance3d
    );
    await tapCanvasSequence(page, viewportCheck, [
      measurementStartPoint,
      measurementEndPoint
    ]);
    await expect(stage).toHaveAttribute(
      "data-denovo-history-undo-depth",
      String(measurementBefore.historyUndo + 1)
    );
    const measurementState = await getAuthoringState(stage);
    const measurementId = measurementState.lastCommittedId;
    const measurementNode = requireDocumentNode(
      measurementState.document,
      measurementId,
      "measurement"
    );
    const expectedMeasurementStart = snapThreeDimensionalWorkPlanePoint(
      screenPointToThreeDimensionalWorkPlane(canvasBox, measurementStartPoint)
    );
    const expectedMeasurementEnd = snapThreeDimensionalWorkPlanePoint(
      screenPointToThreeDimensionalWorkPlane(canvasBox, measurementEndPoint)
    );
    assertPointClose(
      measurementNode.start,
      expectedMeasurementStart,
      1e-9,
      `${viewportCheck.name}: 3D measurement start was not snapped exactly.`
    );
    assertPointClose(
      measurementNode.end,
      expectedMeasurementEnd,
      1e-9,
      `${viewportCheck.name}: 3D measurement end was not snapped exactly.`
    );
    assertGridAligned3D(measurementNode.start);
    assertGridAligned3D(measurementNode.end);
    await activateAuthoringTool(
      page,
      stage,
      "Select",
      authoringToolIds.select
    );
    const measurementMidpoint = measurementNode.start.map(
      (coordinate, index) =>
        (coordinate + measurementNode.end[index]) / 2
    );
    await tapCanvasLocal(
      page,
      viewportCheck,
      worldPointToThreeDimensionalCanvas(canvasBox, measurementMidpoint)
    );
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-primary",
      measurementId
    );
    const measurementEditedState = await clickDocumentAction(
      page,
      stage,
      "Edit Last",
      `${viewportCheck.name}: 3D measurement edit did not commit.`
    );
    assert.equal(
      requireDocumentNode(
        measurementEditedState.document,
        measurementId,
        "measurement"
      ).precision,
      measurementNode.precision + 1
    );
    await clickDocumentAction(
      page,
      stage,
      "Undo",
      `${viewportCheck.name}: 3D measurement edit undo did not commit.`
    );
    assert.equal(
      requireDocumentNode(
        (await getAuthoringState(stage)).document,
        measurementId,
        "measurement"
      ).precision,
      measurementNode.precision
    );
    await clickDocumentAction(
      page,
      stage,
      "Redo",
      `${viewportCheck.name}: 3D measurement edit redo did not commit.`
    );

    await activateAuthoringTool(
      page,
      stage,
      "Select",
      authoringToolIds.select
    );
    await clearSelection(page, stage);
    const annotationCancelBefore = await getAuthoringState(stage);
    await page.getByLabel("Annotation text").fill("");
    await activateAuthoringTool(
      page,
      stage,
      "3D Annotation",
      authoringToolIds.annotation3d
    );
    const annotationRenderBaseline = await getWebGlRenderProbe(page);
    assert.ok(
      annotationRenderBaseline.drawCalls > 0,
      `${viewportCheck.name}: 3D annotation baseline did not contain rendered geometry.`
    );
    const cancelledAnnotationGesture = await beginAuthoringGesture(
      page,
      viewportCheck,
      [canvasBox.width * 0.55, canvasBox.height * 0.62],
      [canvasBox.width * 0.6, canvasBox.height * 0.62]
    );
    try {
      const annotationPreviewRender = await waitForWebGlPreviewRender(
        page,
        annotationRenderBaseline,
        `${viewportCheck.name}: 3D annotation anchor preview was not rendered.`
      );
      await cancelledAnnotationGesture.release();
      await waitForWebGlPreviewCleanup(
        page,
        annotationRenderBaseline,
        annotationPreviewRender,
        `${viewportCheck.name}: cancelled 3D annotation preview was not cleaned.`
      );
    } finally {
      await cancelledAnnotationGesture.cancel();
    }
    await assertDemandRenderingSettles(
      page,
      `${viewportCheck.name}: cancelled 3D annotation restarted demand scheduling.`
    );
    const annotationCancelAfter = await getAuthoringState(stage);
    assert.equal(annotationCancelAfter.documentJson, annotationCancelBefore.documentJson);
    assert.equal(annotationCancelAfter.historyUndo, annotationCancelBefore.historyUndo);

    await page.getByLabel("Annotation text").fill("M3 3D note");
    const annotationStart = [canvasBox.width * 0.72, canvasBox.height * 0.6];
    const annotationEnd = [canvasBox.width * 0.76, canvasBox.height * 0.58];
    const annotationResult = await createNodeWithPreview({
      end: annotationEnd,
      label: `${viewportCheck.name}: 3D annotation`,
      page,
      stage,
      start: annotationStart,
      toolId: authoringToolIds.annotation3d,
      toolName: "3D Annotation",
      type: "annotation",
      viewportCheck
    });
    const expectedAnnotationAnchor = snapThreeDimensionalWorkPlanePoint(
      screenPointToThreeDimensionalWorkPlane(canvasBox, annotationEnd)
    );
    assertPointClose(
      annotationResult.node.anchor,
      expectedAnnotationAnchor,
      1e-9,
      `${viewportCheck.name}: 3D annotation anchor was not snapped exactly.`
    );
    assert.equal(annotationResult.node.text, "M3 3D note");
    assertGridAligned3D(annotationResult.node.anchor);
    await activateAuthoringTool(
      page,
      stage,
      "Select",
      authoringToolIds.select
    );
    await tapCanvasLocal(
      page,
      viewportCheck,
      worldPointToThreeDimensionalCanvas(canvasBox, annotationResult.node.anchor)
    );
    await expect(stage).toHaveAttribute(
      "data-denovo-selection-primary",
      annotationResult.node.id
    );
    const annotationEditedState = await clickDocumentAction(
      page,
      stage,
      "Edit Last",
      `${viewportCheck.name}: 3D annotation edit did not commit.`
    );
    assert.equal(
      requireDocumentNode(
        annotationEditedState.document,
        annotationResult.node.id,
        "annotation"
      ).text,
      "M3 3D note · edited"
    );
    await clickDocumentAction(
      page,
      stage,
      "Undo",
      `${viewportCheck.name}: 3D annotation edit undo did not commit.`
    );
    assert.equal(
      requireDocumentNode(
        (await getAuthoringState(stage)).document,
        annotationResult.node.id,
        "annotation"
      ).text,
      "M3 3D note"
    );
    await clickDocumentAction(
      page,
      stage,
      "Redo",
      `${viewportCheck.name}: 3D annotation edit redo did not commit.`
    );

    const beforeReload = await getAuthoringState(stage);
    await page.getByRole("button", { name: "Reload Document JSON" }).click();
    await expect(stage).toHaveAttribute("data-denovo-pending-count", "0");
    await expect(stage).toHaveAttribute("data-denovo-reload-result", "success");
    await expect(stage).toHaveAttribute(
      "data-denovo-reload-revision",
      String(beforeReload.reloadRevision + 1)
    );
    const afterReload = await getAuthoringState(stage);
    assert.deepEqual(afterReload.document, beforeReload.document);
    requireDocumentNode(afterReload.document, measurementId, "measurement");
    requireDocumentNode(
      afterReload.document,
      annotationResult.node.id,
      "annotation"
    );
    const reloadAnalysis = await analyzeCanvasScreenshot(page);
    assertCanvasIsRendered(
      `${viewportCheck.name}:3d-authoring-reload`,
      reloadAnalysis
    );
    await assertDemandRenderingSettles(
      page,
      `${viewportCheck.name}: reloaded 3D document did not settle in demand mode.`
    );

    await page.getByLabel("Annotation text").fill("replacement draft");
    await activateAuthoringTool(
      page,
      stage,
      "3D Annotation",
      authoringToolIds.annotation3d
    );
    const replacementBaseline = await getCanvasHash(page);
    const replacementGesture = await beginAuthoringGesture(
      page,
      viewportCheck,
      [canvasBox.width * 0.62, canvasBox.height * 0.66],
      [canvasBox.width * 0.66, canvasBox.height * 0.64]
    );
    try {
      await expect
        .poll(() => getCanvasHash(page), {
          message: `${viewportCheck.name}: replacement 3D draft was not rendered.`
        })
        .not.toBe(replacementBaseline);
      await page
        .getByRole("button", { name: "Swap Scene" })
        .evaluate((button) => button.click());
      await expect(stage).toHaveAttribute("data-denovo-scene-id", "vanilla-3d");
      await expect(stage).toHaveAttribute("data-denovo-pending-count", "0");
    } finally {
      await replacementGesture.cancel();
    }
    const replacementState = await getAuthoringState(stage);
    assert.equal(replacementState.document.scene.mode, "3d");
    assert.equal(
      replacementState.document.scene.nodes.some((node) =>
        node.id.startsWith("authoring-")
      ),
      false
    );
    const replacementAnalysis = await analyzeCanvasScreenshot(page);
    assertCanvasIsRendered(
      `${viewportCheck.name}:3d-authoring-replacement`,
      replacementAnalysis
    );

    assertPageDiagnosticsClean(diagnostics, `${viewportCheck.name}:3d-authoring`);
    return {
      annotationId: annotationResult.node.id,
      creationTypes: ["box", "sphere"],
      groupRoundTrip: true,
      gridPlacement: true,
      layerLifecycle: true,
      measurementId,
      nonblank: true,
      pointerType: viewportCheck.hasTouch ? "touch" : "mouse",
      replacementCleanup: true,
      surfaceMissClearsPreview: true,
      surfacePlacementIds: [...stackedBoxIds, sidePlacementResult.node.id],
      surfaceSidePlacement: true,
      surfaceStacking: true,
      transforms: ["rotate", "scale"]
    };
  } finally {
    await context.close();
  }
}

function collectPageDiagnostics(page) {
  const consoleMessages = [];
  const pageErrors = [];

  page.on("console", (message) => {
    consoleMessages.push({
      text: message.text(),
      type: message.type()
    });
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  return { consoleMessages, pageErrors };
}

function assertPageDiagnosticsClean(diagnostics, label) {
  const blockingConsoleMessages = diagnostics.consoleMessages.filter((message) =>
    isBlockingConsoleMessage(message)
  );
  const resizeObserverErrors = [
    ...diagnostics.consoleMessages.map((message) => message.text),
    ...diagnostics.pageErrors
  ].filter((message) => /ResizeObserver loop/i.test(message));

  assert.deepEqual(resizeObserverErrors, [], `${label}: ResizeObserver failed.`);
  assert.deepEqual(
    blockingConsoleMessages,
    [],
    `${label}: blocking browser console messages were reported.`
  );
  assert.deepEqual(
    diagnostics.pageErrors,
    [],
    `${label}: uncaught page errors were reported.`
  );
}

async function installWebGlRenderProbe(page) {
  await page.addInitScript(() => {
    const probe = {
      drawCalls: 0,
      renderCount: 0
    };
    Object.defineProperty(window, "__denovoWebGlRenderProbe", {
      configurable: false,
      enumerable: false,
      value: probe,
      writable: false
    });

    const patchMethod = (prototype, methodName, beforeCall) => {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);

      if (!descriptor || typeof descriptor.value !== "function") {
        return;
      }

      const original = descriptor.value;
      Object.defineProperty(prototype, methodName, {
        ...descriptor,
        value(...args) {
          beforeCall();
          return Reflect.apply(original, this, args);
        }
      });
    };
    const patchContext = (prototype) => {
      patchMethod(prototype, "clear", () => {
        probe.drawCalls = 0;
        probe.renderCount += 1;
      });

      for (const methodName of [
        "drawArrays",
        "drawArraysInstanced",
        "drawElements",
        "drawElementsInstanced"
      ]) {
        patchMethod(prototype, methodName, () => {
          probe.drawCalls += 1;
        });
      }
    };

    patchContext(WebGLRenderingContext.prototype);

    if (typeof WebGL2RenderingContext !== "undefined") {
      patchContext(WebGL2RenderingContext.prototype);
    }
  });
}

async function getWebGlRenderProbe(page) {
  return page.evaluate(() => {
    const probe = window.__denovoWebGlRenderProbe;

    if (
      !probe ||
      typeof probe.drawCalls !== "number" ||
      typeof probe.renderCount !== "number"
    ) {
      throw new Error("The WebGL render probe was not installed.");
    }

    return {
      drawCalls: probe.drawCalls,
      renderCount: probe.renderCount
    };
  });
}

async function waitForWebGlPreviewRender(page, baseline, message) {
  let preview = baseline;

  await expect
    .poll(
      async () => {
        preview = await getWebGlRenderProbe(page);
        return (
          preview.renderCount > baseline.renderCount &&
          preview.drawCalls > baseline.drawCalls
        );
      },
      { message }
    )
    .toBe(true);

  return preview;
}

async function waitForWebGlPreviewCleanup(page, baseline, preview, message) {
  await expect
    .poll(
      async () => {
        const current = await getWebGlRenderProbe(page);
        return current.renderCount > preview.renderCount
          ? current.drawCalls
          : null;
      },
      { message }
    )
    .toBe(baseline.drawCalls);
}

async function openAuthoringScene(page, url, sceneId, swapCount) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator("canvas").waitFor({ state: "visible" });
  const stage = page.locator("#stage");
  await expect(stage).toHaveAttribute("data-denovo-editor-ready", "true");

  for (let index = 0; index < swapCount; index += 1) {
    const revisionBefore = await getNumericAttribute(
      stage,
      "data-denovo-document-revision"
    );
    await page.getByRole("button", { name: "Swap Scene" }).click();
    await expect
      .poll(
        () => getNumericAttribute(stage, "data-denovo-document-revision"),
        { message: `Scene replacement ${index + 1} did not commit.` }
      )
      .toBeGreaterThan(revisionBefore);
    await expect(stage).toHaveAttribute("data-denovo-pending-count", "0");
  }

  await expect(stage).toHaveAttribute("data-denovo-scene-id", sceneId);
  await expect(stage).toHaveAttribute("data-denovo-input-error", "none");
  await expect(stage).toHaveAttribute("data-denovo-pending-error", "none");
  await expect(page.locator("canvas")).toHaveCount(1);
}

async function getAuthoringState(stage) {
  const values = await stage.evaluate((element) => ({
    documentJson: element.dataset.denovoDocumentJson,
    documentRevision: element.dataset.denovoDocumentRevision,
    groupId: element.dataset.denovoGroupId,
    historyRedo: element.dataset.denovoHistoryRedoDepth,
    historyUndo: element.dataset.denovoHistoryUndoDepth,
    inputError: element.dataset.denovoInputError,
    lastCommittedId: element.dataset.denovoLastCommittedId,
    lastCommittedType: element.dataset.denovoLastCommittedType,
    nodeCount: element.dataset.denovoNodeCount,
    pendingCount: element.dataset.denovoPendingCount,
    pendingError: element.dataset.denovoPendingError,
    reloadRevision: element.dataset.denovoReloadRevision,
    reloadResult: element.dataset.denovoReloadResult,
    selectionPrimary: element.dataset.denovoSelectionPrimary,
    selectionRevision: element.dataset.denovoSelectionRevision
  }));

  assert.ok(values.documentJson, "Authoring document diagnostics are missing.");
  return {
    document: JSON.parse(values.documentJson),
    documentJson: values.documentJson,
    documentRevision: Number(values.documentRevision ?? "-1"),
    groupId: values.groupId ?? "none",
    historyRedo: Number(values.historyRedo ?? "-1"),
    historyUndo: Number(values.historyUndo ?? "-1"),
    inputError: values.inputError ?? "missing",
    lastCommittedId: values.lastCommittedId ?? "none",
    lastCommittedType: values.lastCommittedType ?? "none",
    nodeCount: Number(values.nodeCount ?? "-1"),
    pendingCount: Number(values.pendingCount ?? "-1"),
    pendingError: values.pendingError ?? "missing",
    reloadRevision: Number(values.reloadRevision ?? "-1"),
    reloadResult: values.reloadResult ?? "missing",
    selectionPrimary: values.selectionPrimary ?? "none",
    selectionRevision: Number(values.selectionRevision ?? "-1")
  };
}

function requireDocumentNode(document, nodeId, type) {
  const node = document.scene.nodes.find((candidate) => candidate.id === nodeId);
  assert.ok(node, `Document node was not found: ${nodeId}.`);
  if (type !== undefined) {
    assert.equal(node.type, type, `Document node ${nodeId} has the wrong type.`);
  }
  return node;
}

function requireLayer(document, layerId) {
  const layer = document.scene.layers.find(
    (candidate) => candidate.id === layerId
  );
  assert.ok(layer, `Document layer was not found: ${layerId}.`);
  return layer;
}

function assertGridAligned2D(point) {
  assert.equal(point.length, 2, "A 2D grid point must contain two coordinates.");
  for (const coordinate of point) {
    assert.equal(
      Math.abs(coordinate / 20 - Math.round(coordinate / 20)) <= 1e-9,
      true,
      `2D coordinate is not aligned to the 20-unit grid: ${coordinate}.`
    );
  }
}

function assertGridAligned3D(point) {
  assert.equal(point.length, 3, "A 3D grid point must contain three coordinates.");
  assert.ok(Math.abs(point[1]) <= 1e-9, "A 3D authoring point left the Y=0 work plane.");

  for (const coordinate of [point[0], point[2]]) {
    assert.equal(
      Math.abs(coordinate / 0.5 - Math.round(coordinate / 0.5)) <= 1e-9,
      true,
      `3D coordinate is not aligned to the 0.5-unit grid: ${coordinate}.`
    );
  }
}

function screenPointToThreeDimensionalWorkPlane(canvasBox, point) {
  const basis = getThreeDimensionalCameraBasis();
  const aspect = canvasBox.width / canvasBox.height;
  const tangent = Math.tan(
    (demandThreeDimensionalCamera.fov * Math.PI) / 360
  );
  const normalizedX = (point[0] / canvasBox.width) * 2 - 1;
  const normalizedY = 1 - (point[1] / canvasBox.height) * 2;
  const direction = normalizeVector3(
    addVector3(
      basis.forward,
      scaleVector3(basis.right, normalizedX * tangent * aspect),
      scaleVector3(basis.up, normalizedY * tangent)
    )
  );
  assert.notEqual(
    direction[1],
    0,
    "The 3D authoring ray is parallel to the Y=0 work plane."
  );
  const distance = -demandThreeDimensionalCamera.position[1] / direction[1];
  assert.ok(distance > 0, "The 3D authoring ray points away from the work plane.");
  return demandThreeDimensionalCamera.position.map(
    (coordinate, index) => coordinate + direction[index] * distance
  );
}

function worldPointToThreeDimensionalCanvas(canvasBox, point) {
  const basis = getThreeDimensionalCameraBasis();
  const relative = point.map(
    (coordinate, index) =>
      coordinate - demandThreeDimensionalCamera.position[index]
  );
  const depth = dotVector3(relative, basis.forward);
  assert.ok(depth > 0, "A projected 3D point must be in front of the camera.");
  const tangent = Math.tan(
    (demandThreeDimensionalCamera.fov * Math.PI) / 360
  );
  const normalizedX =
    dotVector3(relative, basis.right) /
    (depth * tangent * (canvasBox.width / canvasBox.height));
  const normalizedY = dotVector3(relative, basis.up) / (depth * tangent);
  return [
    ((normalizedX + 1) / 2) * canvasBox.width,
    ((1 - normalizedY) / 2) * canvasBox.height
  ];
}

function snapThreeDimensionalWorkPlanePoint(point) {
  return [
    Math.round(point[0] / 0.5) * 0.5,
    0,
    Math.round(point[2] / 0.5) * 0.5
  ];
}

function getThreeDimensionalCameraBasis() {
  const forward = normalizeVector3(
    demandThreeDimensionalCamera.target.map(
      (coordinate, index) =>
        coordinate - demandThreeDimensionalCamera.position[index]
    )
  );
  const right = normalizeVector3(crossVector3(forward, [0, 1, 0]));
  return {
    forward,
    right,
    up: normalizeVector3(crossVector3(right, forward))
  };
}

function addVector3(...vectors) {
  return [0, 1, 2].map((index) =>
    vectors.reduce((total, vector) => total + vector[index], 0)
  );
}

function scaleVector3(vector, scalar) {
  return vector.map((coordinate) => coordinate * scalar);
}

function normalizeVector3(vector) {
  const length = Math.hypot(...vector);
  assert.ok(length > 0, "A camera basis vector must be non-zero.");
  return vector.map((coordinate) => coordinate / length);
}

function dotVector3(left, right) {
  return left.reduce(
    (total, coordinate, index) => total + coordinate * right[index],
    0
  );
}

function crossVector3(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0]
  ];
}

async function findRedTransformHandlePoint(page, strategy) {
  const canvas = page.locator("canvas");
  const box = await requireCanvasBox(page);
  const screenshot = await canvas.screenshot();
  const png = decodePng(screenshot);
  const redPixels = [];

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const offset = (y * png.width + x) * 4;
      const red = png.pixels[offset] ?? 0;
      const green = png.pixels[offset + 1] ?? 0;
      const blue = png.pixels[offset + 2] ?? 0;
      const alpha = png.pixels[offset + 3] ?? 255;

      if (alpha > 0 && red >= 170 && green <= 95 && blue <= 105) {
        redPixels.push([x, y]);
      }
    }
  }

  assert.ok(redPixels.length >= 8, "Rendered red 3D transform handle was not detected.");
  const centroid = [
    redPixels.reduce((total, pixel) => total + pixel[0], 0) /
      redPixels.length,
    redPixels.reduce((total, pixel) => total + pixel[1], 0) /
      redPixels.length
  ];
  const selected = (() => {
    if (strategy !== "farthest") {
      return centroid;
    }

    const distances = redPixels.map((pixel) =>
      Math.hypot(pixel[0] - centroid[0], pixel[1] - centroid[1])
    );
    const minimumRingDistance = Math.max(...distances) * 0.55;
    const redPixelKeys = new Set(
      redPixels.map((pixel) => `${pixel[0]},${pixel[1]}`)
    );
    let densestRingPixel = redPixels[0];
    let densestRingPixelScore = -1;

    for (let index = 0; index < redPixels.length; index += 1) {
      if (distances[index] < minimumRingDistance) {
        continue;
      }

      const pixel = redPixels[index];
      let localDensity = 0;

      for (let offsetY = -4; offsetY <= 4; offsetY += 1) {
        for (let offsetX = -4; offsetX <= 4; offsetX += 1) {
          if (
            redPixelKeys.has(
              `${pixel[0] + offsetX},${pixel[1] + offsetY}`
            )
          ) {
            localDensity += 1;
          }
        }
      }

      if (localDensity > densestRingPixelScore) {
        densestRingPixel = pixel;
        densestRingPixelScore = localDensity;
      }
    }

    return densestRingPixel;
  })();

  return [
    (selected[0] / png.width) * box.width,
    (selected[1] / png.height) * box.height
  ];
}

async function activateAuthoringTool(page, stage, toolName, toolId) {
  await page.getByRole("button", { name: toolName, exact: true }).click();
  await expect(stage).toHaveAttribute("data-denovo-active-tool", toolId);
  await expect(stage).toHaveAttribute("data-denovo-input-error", "none");
  await expect(stage).toHaveAttribute("data-denovo-pending-error", "none");
}

async function activateAuthoringToolProgrammatically(
  page,
  stage,
  toolName,
  toolId
) {
  await page
    .getByRole("button", { name: toolName, exact: true })
    .evaluate((button) => button.click());
  await expect(stage).toHaveAttribute("data-denovo-active-tool", toolId);
  await expect(stage).toHaveAttribute("data-denovo-input-error", "none");
  await expect(stage).toHaveAttribute("data-denovo-pending-error", "none");
}

async function clickDocumentAction(page, stage, actionName, message) {
  const before = await getAuthoringState(stage);
  await page.getByRole("button", { name: actionName, exact: true }).click();
  await expect
    .poll(
      () => getNumericAttribute(stage, "data-denovo-document-revision"),
      { message }
    )
    .toBeGreaterThan(before.documentRevision);
  await expect(stage).toHaveAttribute("data-denovo-pending-count", "0");
  await expect(stage).toHaveAttribute("data-denovo-input-error", "none");
  await expect(stage).toHaveAttribute("data-denovo-pending-error", "none");
  return getAuthoringState(stage);
}

async function createNodeWithPreview(options) {
  const before = await getAuthoringState(options.stage);
  const pixelsBefore = await getCanvasHash(options.page);
  await activateAuthoringTool(
    options.page,
    options.stage,
    options.toolName,
    options.toolId
  );
  const gesture = await beginAuthoringGesture(
    options.page,
    options.viewportCheck,
    options.start,
    options.end
  );
  let previewPixels;

  try {
    await expect
      .poll(() => getCanvasHash(options.page), {
        message: `${options.label} preview was not rendered.`
      })
      .not.toBe(pixelsBefore);
    previewPixels = await getCanvasHash(options.page);
    const previewState = await getAuthoringState(options.stage);
    assert.equal(
      previewState.documentJson,
      before.documentJson,
      `${options.label} preview mutated the document.`
    );
    assert.equal(
      previewState.historyUndo,
      before.historyUndo,
      `${options.label} preview mutated history.`
    );
    assert.equal(
      previewState.nodeCount,
      before.nodeCount,
      `${options.label} preview inserted a persistent node.`
    );
    await gesture.release();
  } finally {
    await gesture.cancel();
  }

  await expect(options.stage).toHaveAttribute(
    "data-denovo-node-count",
    String(before.nodeCount + 1)
  );
  await expect(options.stage).toHaveAttribute(
    "data-denovo-history-undo-depth",
    String(before.historyUndo + 1)
  );
  await expect(options.stage).toHaveAttribute(
    "data-denovo-last-committed-type",
    options.type
  );
  await expect(options.stage).toHaveAttribute("data-denovo-input-error", "none");
  const after = await getAuthoringState(options.stage);
  const node = requireDocumentNode(
    after.document,
    after.lastCommittedId,
    options.type
  );
  assert.equal(node.layerId, "authoring");
  const committedPixels = await waitForCanvasHashToStabilize(
    options.page,
    `${options.label} committed pixels did not settle.`
  );
  assert.notEqual(
    committedPixels,
    previewPixels,
    `${options.label} transient grid or draft preview was not cleaned after commit.`
  );
  await assertDemandRenderingSettles(
    options.page,
    `${options.label} restarted demand scheduling.`
  );
  return { after, node, previewPixels };
}

async function verifySurfaceMissClearsPreview(options) {
  await activateAuthoringTool(
    options.page,
    options.stage,
    options.toolName,
    options.toolId
  );
  const before = await getAuthoringState(options.stage);
  const baselinePixels = await waitForCanvasHashToStabilize(
    options.page,
    `${options.label} baseline pixels did not settle.`
  );
  const canvas = options.page.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const canvasBox = await requireCanvasBox(options.page);
  const hitPoint = {
    x: canvasBox.x + options.hitPoint[0],
    y: canvasBox.y + options.hitPoint[1]
  };
  const missPoint = {
    x: canvasBox.x + options.missPoint[0],
    y: canvasBox.y + options.missPoint[1]
  };

  const assertTransientPreview = async () => {
    await expect
      .poll(() => getCanvasHash(options.page), {
        message: `${options.label} hit did not render a ghost preview.`
      })
      .not.toBe(baselinePixels);
    const previewState = await getAuthoringState(options.stage);
    assert.equal(
      previewState.documentJson,
      before.documentJson,
      `${options.label} ghost preview mutated the document.`
    );
    assert.equal(
      previewState.historyUndo,
      before.historyUndo,
      `${options.label} ghost preview mutated history.`
    );
    assert.equal(
      previewState.nodeCount,
      before.nodeCount,
      `${options.label} ghost preview inserted a persistent node.`
    );
  };
  const assertPreviewCleared = async () => {
    await expect
      .poll(() => getCanvasHash(options.page), {
        message: `${options.label} did not clear the ghost preview on miss.`
      })
      .toBe(baselinePixels);
    const missState = await getAuthoringState(options.stage);
    assert.equal(
      missState.documentJson,
      before.documentJson,
      `${options.label} empty-space miss mutated the document.`
    );
    assert.equal(
      missState.historyUndo,
      before.historyUndo,
      `${options.label} empty-space miss mutated history.`
    );
    assert.equal(
      missState.nodeCount,
      before.nodeCount,
      `${options.label} empty-space miss inserted a persistent node.`
    );
  };

  if (!options.viewportCheck.hasTouch) {
    await options.page.mouse.move(hitPoint.x, hitPoint.y);
    await assertTransientPreview();
    await options.page.mouse.move(missPoint.x, missPoint.y, { steps: 8 });
    await assertPreviewCleared();
    await options.page.mouse.down({ button: "left" });
    await options.page.mouse.up({ button: "left" });
  } else {
    const session = await options.page.context().newCDPSession(options.page);
    const pointerId = 61;
    let touchActive = false;

    try {
      await session.send("Input.dispatchTouchEvent", {
        touchPoints: [{ id: pointerId, x: hitPoint.x, y: hitPoint.y }],
        type: "touchStart"
      });
      touchActive = true;
      await assertTransientPreview();
      await session.send("Input.dispatchTouchEvent", {
        touchPoints: [{ id: pointerId, x: missPoint.x, y: missPoint.y }],
        type: "touchMove"
      });
      await assertPreviewCleared();
      await session.send("Input.dispatchTouchEvent", {
        touchPoints: [],
        type: "touchEnd"
      });
      touchActive = false;
    } finally {
      if (touchActive) {
        await session.send("Input.dispatchTouchEvent", {
          touchPoints: [],
          type: "touchCancel"
        });
      }
      await session.detach();
    }
  }

  await expect(options.stage).toHaveAttribute(
    "data-denovo-node-count",
    String(before.nodeCount)
  );
  await expect(options.stage).toHaveAttribute(
    "data-denovo-history-undo-depth",
    String(before.historyUndo)
  );
  await expect(options.stage).toHaveAttribute("data-denovo-input-error", "none");
  await expect(options.stage).toHaveAttribute(
    "data-denovo-pending-error",
    "none"
  );
  const after = await getAuthoringState(options.stage);
  assert.equal(
    after.documentJson,
    before.documentJson,
    `${options.label} release on empty space mutated the document.`
  );
  assert.equal(
    after.historyUndo,
    before.historyUndo,
    `${options.label} release on empty space mutated history.`
  );
  await assertDemandRenderingSettles(
    options.page,
    `${options.label} restarted demand scheduling.`
  );
}

async function verifyTransformPreviewAndCommit(options) {
  await activateAuthoringTool(
    options.page,
    options.stage,
    options.toolName,
    options.toolId
  );
  const before = await getAuthoringState(options.stage);
  const pixelsBefore = await waitForCanvasHashToStabilize(
    options.page,
    `${options.label} handle rendering did not settle.`
  );
  const gesture = await beginAuthoringGesture(
    options.page,
    options.viewportCheck,
    options.handlePoint,
    [
      options.handlePoint[0] + options.delta[0],
      options.handlePoint[1] + options.delta[1]
    ]
  );

  try {
    await expect
      .poll(() => getCanvasHash(options.page), {
        message: `${options.label} preview was not rendered.`
      })
      .not.toBe(pixelsBefore);
    const previewState = await getAuthoringState(options.stage);
    assert.equal(
      previewState.documentJson,
      before.documentJson,
      `${options.label} preview mutated the document.`
    );
    assert.equal(
      previewState.historyUndo,
      before.historyUndo,
      `${options.label} preview mutated history.`
    );
    await gesture.release();
  } finally {
    await gesture.cancel();
  }

  await expect(options.stage).toHaveAttribute(
    "data-denovo-history-undo-depth",
    String(before.historyUndo + 1)
  );
  const after = await getAuthoringState(options.stage);
  assert.notEqual(
    after.documentJson,
    before.documentJson,
    `${options.label} did not commit a document change.`
  );
  requireDocumentNode(
    after.document,
    options.nodeId,
    requireDocumentNode(before.document, options.nodeId, undefined).type
  );
  await assertDemandRenderingSettles(
    options.page,
    `${options.label} restarted demand scheduling.`
  );
}

async function clearSelection(page, stage) {
  await stage.focus();
  await page.keyboard.press("Escape");
  await expect(stage).toHaveAttribute("data-denovo-selection-primary", "none");
}

async function tapCanvasLocal(page, viewportCheck, point) {
  const gesture = await beginAuthoringGesture(
    page,
    viewportCheck,
    point,
    point
  );

  try {
    await gesture.release();
  } finally {
    await gesture.cancel();
  }
}

async function tapCanvasSequence(page, viewportCheck, points) {
  if (!viewportCheck.hasTouch) {
    for (const point of points) {
      await tapCanvasLocal(page, viewportCheck, point);
    }
    return;
  }

  const canvas = page.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = await requireCanvasBox(page);
  await canvas.evaluate(
    (element, input) => {
      for (let index = 0; index < input.points.length; index += 1) {
        const point = input.points[index];
        const common = {
          bubbles: true,
          button: 0,
          clientX: input.box.x + point[0],
          clientY: input.box.y + point[1],
          composed: true,
          height: 1,
          isPrimary: true,
          pointerId: 51 + index,
          pointerType: "touch",
          width: 1
        };
        element.dispatchEvent(
          new PointerEvent("pointerdown", { ...common, buttons: 1 })
        );
        element.dispatchEvent(
          new PointerEvent("pointerup", { ...common, buttons: 0 })
        );
      }
    },
    { box: { x: box.x, y: box.y }, points }
  );
}

async function beginAuthoringGesture(
  page,
  viewportCheck,
  startPoint,
  endPoint
) {
  const canvas = page.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = await requireCanvasBox(page);
  const start = {
    x: box.x + startPoint[0],
    y: box.y + startPoint[1]
  };
  const end = {
    x: box.x + endPoint[0],
    y: box.y + endPoint[1]
  };

  if (!viewportCheck.hasTouch) {
    let active = true;
    await page.mouse.move(start.x, start.y);
    await page.mouse.down({ button: "left" });
    await page.mouse.move(end.x, end.y, { steps: 8 });

    return {
      async cancel() {
        if (!active) {
          return;
        }

        active = false;
        await canvas.evaluate(
          (element, point) => {
            element.dispatchEvent(
              new PointerEvent("pointercancel", {
                bubbles: true,
                button: 0,
                buttons: 0,
                clientX: point.x,
                clientY: point.y,
                isPrimary: true,
                pointerId: 1,
                pointerType: "mouse"
              })
            );
          },
          end
        );
        await page.mouse.up({ button: "left" });
      },
      async release() {
        if (!active) {
          return;
        }

        active = false;
        await page.mouse.up({ button: "left" });
      }
    };
  }

  const session = await page.context().newCDPSession(page);
  const pointerId = 41;
  let active = true;
  await session.send("Input.dispatchTouchEvent", {
    touchPoints: [{ id: pointerId, x: start.x, y: start.y }],
    type: "touchStart"
  });

  for (let step = 1; step <= 8; step += 1) {
    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [
        {
          id: pointerId,
          x: start.x + ((end.x - start.x) * step) / 8,
          y: start.y + ((end.y - start.y) * step) / 8
        }
      ],
      type: "touchMove"
    });
  }

  async function finish(type) {
    if (!active) {
      return;
    }

    active = false;
    try {
      await session.send("Input.dispatchTouchEvent", {
        touchPoints: [],
        type
      });
    } finally {
      await session.detach();
    }
  }

  return {
    cancel: () => finish("touchCancel"),
    release: () => finish("touchEnd")
  };
}

async function assertDemandRenderingSettles(page, message) {
  let previousFrameCount = await getFrameCount(page);
  let consecutiveStableChecks = 0;

  await expect
    .poll(
      async () => {
        await waitForAnimationFrames(page, 3);
        const currentFrameCount = await getFrameCount(page);

        if (currentFrameCount === previousFrameCount) {
          consecutiveStableChecks += 1;
        } else {
          consecutiveStableChecks = 0;
          previousFrameCount = currentFrameCount;
        }

        return consecutiveStableChecks;
      },
      { message }
    )
    .toBeGreaterThanOrEqual(2);
}

async function selectCanvasRatio(page, viewportCheck, ratio) {
  const box = await page.locator("canvas").boundingBox();
  assert.ok(box, "Canvas must have a bounding box before ratio selection.");
  await selectCanvasPoint(page, viewportCheck, {
    x: box.width * ratio.x,
    y: box.height * ratio.y
  });
}

async function selectCanvasPoint(page, viewportCheck, position, modifiers = []) {
  const canvas = page.locator("canvas");
  const options = position === undefined ? {} : { position };

  if (viewportCheck.hasTouch) {
    await canvas.tap(options);
    return;
  }

  await canvas.click({
    ...options,
    ...(modifiers.length === 0 ? {} : { modifiers })
  });
}

async function requireCanvasBox(page) {
  const box = await page.locator("canvas").boundingBox();
  assert.ok(box, "Canvas must have a bounding box.");
  return box;
}

async function getCanvas2DViewState(stage) {
  const offsetValue = await stage.getAttribute("data-denovo-view-offset");
  const zoomValue = await stage.getAttribute("data-denovo-view-zoom");
  assert.notEqual(
    offsetValue,
    null,
    "Missing Canvas2D diagnostic view offset."
  );
  assert.notEqual(
    offsetValue,
    "unavailable",
    "Canvas2D diagnostic view offset is unavailable."
  );
  assert.notEqual(zoomValue, null, "Missing Canvas2D diagnostic view zoom.");
  assert.notEqual(
    zoomValue,
    "unavailable",
    "Canvas2D diagnostic view zoom is unavailable."
  );
  const offset = offsetValue.split(",").map(Number);
  const zoom = Number(zoomValue);
  assert.equal(offset.length, 2, "Canvas2D diagnostic offset must have two values.");
  assert.equal(
    offset.every(Number.isFinite),
    true,
    "Canvas2D diagnostic offset must be finite."
  );
  assert.equal(
    Number.isFinite(zoom) && zoom > 0,
    true,
    "Canvas2D diagnostic zoom must be finite and positive."
  );
  return {
    offset,
    zoom
  };
}

async function getNavigationInvariantState(stage) {
  const [
    historyUndoDepth,
    panelPosition,
    sceneId,
    selectionIds,
    selectionPrimary,
    selectionRevision
  ] = await Promise.all([
    stage.getAttribute("data-denovo-history-undo-depth"),
    stage.getAttribute("data-denovo-panel-position"),
    stage.getAttribute("data-denovo-scene-id"),
    stage.getAttribute("data-denovo-selection-ids"),
    stage.getAttribute("data-denovo-selection-primary"),
    stage.getAttribute("data-denovo-selection-revision")
  ]);
  return {
    historyUndoDepth,
    panelPosition,
    sceneId,
    selectionIds,
    selectionPrimary,
    selectionRevision
  };
}

function canvasToScenePoint(view, point) {
  return [
    (point[0] - view.offset[0]) / view.zoom,
    (point[1] - view.offset[1]) / view.zoom
  ];
}

function sceneToCanvasPoint(view, point) {
  return [
    point[0] * view.zoom + view.offset[0],
    point[1] * view.zoom + view.offset[1]
  ];
}

function assertPointClose(actual, expected, tolerance, message) {
  assert.equal(actual.length, expected.length, message);

  for (let index = 0; index < expected.length; index += 1) {
    assert.ok(
      Math.abs(actual[index] - expected[index]) <= tolerance,
      `${message} axis ${index}: expected ${expected[index]}, received ${actual[index]}.`
    );
  }
}

function assertCanvas2DViewClose(actual, expected, message) {
  assertPointClose(actual.offset, expected.offset, 1e-5, message);
  assert.ok(
    Math.abs(actual.zoom - expected.zoom) <= 1e-5,
    `${message} expected zoom ${expected.zoom}, received ${actual.zoom}.`
  );
}

async function waitForAnimationFrames(page, frameCount) {
  await page.evaluate(
    (count) =>
      new Promise((resolve) => {
        let remaining = count;

        function nextFrame() {
          remaining -= 1;

          if (remaining <= 0) {
            resolve();
            return;
          }

          requestAnimationFrame(nextFrame);
        }

        requestAnimationFrame(nextFrame);
      }),
    frameCount
  );
}

async function zoomCanvasAtForViewport(
  page,
  viewportCheck,
  anchor
) {
  const canvas = page.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = await requireCanvasBox(page);
  const centerX = box.x + anchor[0];
  const centerY = box.y + anchor[1];

  if (!viewportCheck.hasTouch) {
    await page.mouse.move(centerX, centerY);
    await page.mouse.wheel(0, -320);
    return;
  }

  const session = await page.context().newCDPSession(page);
  const startHalfDistance = 24;
  const endHalfDistance = 40;

  try {
    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [
        { id: 21, x: centerX - startHalfDistance, y: centerY },
        { id: 22, x: centerX + startHalfDistance, y: centerY }
      ],
      type: "touchStart"
    });

    for (let step = 1; step <= 8; step += 1) {
      const halfDistance =
        startHalfDistance +
        ((endHalfDistance - startHalfDistance) * step) / 8;
      await session.send("Input.dispatchTouchEvent", {
        touchPoints: [
          { id: 21, x: centerX - halfDistance, y: centerY },
          { id: 22, x: centerX + halfDistance, y: centerY }
        ],
        type: "touchMove"
      });
    }

    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [],
      type: "touchEnd"
    });
  } finally {
    await session.detach();
  }
}

async function getNumericAttribute(locator, name) {
  const value = await locator.getAttribute(name);
  assert.notEqual(value, null, `Missing numeric DOM attribute: ${name}`);
  const parsed = Number(value);
  assert.equal(Number.isFinite(parsed), true, `Invalid numeric DOM attribute: ${name}`);
  return parsed;
}

async function getPositionAttribute(locator, name) {
  const value = await locator.getAttribute(name);
  assert.notEqual(value, null, `Missing position DOM attribute: ${name}`);
  assert.notEqual(value, "none", `Unavailable position DOM attribute: ${name}`);
  const position = value.split(",").map(Number);
  assert.equal(
    position.every(Number.isFinite),
    true,
    `Invalid position DOM attribute: ${name}`
  );
  return position;
}

async function beginCanvasDragForViewport(
  page,
  viewportCheck,
  position,
  deltaX,
  deltaY
) {
  const canvas = page.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  assert.ok(box, "Canvas must have a bounding box before transform input.");
  const startX = box.x + (position?.x ?? box.width / 2);
  const startY = box.y + (position?.y ?? box.height / 2);

  if (!viewportCheck.hasTouch) {
    await page.mouse.move(startX, startY);
    await page.mouse.down({ button: "left" });
    await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 8 });
    return async () => {
      await page.mouse.up({ button: "left" });
    };
  }

  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    touchPoints: [{ id: 1, x: startX, y: startY }],
    type: "touchStart"
  });

  for (let step = 1; step <= 8; step += 1) {
    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [
        {
          id: 1,
          x: startX + (deltaX * step) / 8,
          y: startY + (deltaY * step) / 8
        }
      ],
      type: "touchMove"
    });
  }

  return async () => {
    try {
      await session.send("Input.dispatchTouchEvent", {
        touchPoints: [],
        type: "touchEnd"
      });
    } finally {
      await session.detach();
    }
  };
}

async function dragCanvasForViewport(page, viewportCheck, deltaX, deltaY) {
  if (!viewportCheck.hasTouch) {
    await dragCanvas(page, "left", deltaX, deltaY);
    return;
  }

  const canvas = page.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  assert.ok(box, "Canvas must have a bounding box before touch camera input.");
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  const session = await page.context().newCDPSession(page);

  try {
    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [{ id: 1, x: startX, y: startY }],
      type: "touchStart"
    });

    for (let step = 1; step <= 8; step += 1) {
      await session.send("Input.dispatchTouchEvent", {
        touchPoints: [
          {
            id: 1,
            x: startX + (deltaX * step) / 8,
            y: startY + (deltaY * step) / 8
          }
        ],
        type: "touchMove"
      });
    }

    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [],
      type: "touchEnd"
    });
  } finally {
    await session.detach();
  }
}

async function panThreeDimensionalForViewport(
  page,
  viewportCheck,
  deltaX,
  deltaY
) {
  if (!viewportCheck.hasTouch) {
    await dragCanvas(page, "right", deltaX, deltaY);
    return;
  }

  const canvas = page.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = await requireCanvasBox(page);
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const halfDistance = 28;
  const session = await page.context().newCDPSession(page);

  try {
    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [
        { id: 31, x: centerX - halfDistance, y: centerY },
        { id: 32, x: centerX + halfDistance, y: centerY }
      ],
      type: "touchStart"
    });

    for (let step = 1; step <= 8; step += 1) {
      const offsetX = (deltaX * step) / 8;
      const offsetY = (deltaY * step) / 8;
      await session.send("Input.dispatchTouchEvent", {
        touchPoints: [
          {
            id: 31,
            x: centerX - halfDistance + offsetX,
            y: centerY + offsetY
          },
          {
            id: 32,
            x: centerX + halfDistance + offsetX,
            y: centerY + offsetY
          }
        ],
        type: "touchMove"
      });
    }

    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [],
      type: "touchEnd"
    });
  } finally {
    await session.detach();
  }
}

async function dragCanvas(page, button, deltaX, deltaY) {
  const canvas = page.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  assert.ok(box, "Canvas must have a bounding box before camera input.");
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down({ button });
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 8 });
  await page.mouse.up({ button });
}

async function getCanvasHash(page) {
  const screenshot = await page.locator("canvas").screenshot();
  const png = decodePng(screenshot);
  return createHash("sha256")
    .update(`${png.width}x${png.height}:`)
    .update(png.pixels)
    .digest("hex");
}

async function getCanvasBitmapHash(page) {
  const dataUrl = await page
    .locator("canvas")
    .evaluate((canvas) => canvas.toDataURL("image/png"));
  return createHash("sha256").update(dataUrl).digest("hex");
}

async function waitForCanvasHashToStabilize(page, message) {
  let previousHash = await getCanvasHash(page);
  let consecutiveMatches = 0;

  await expect
    .poll(
      async () => {
        await waitForAnimationFrames(page, 2);
        const currentHash = await getCanvasHash(page);

        if (currentHash === previousHash) {
          consecutiveMatches += 1;
        } else {
          consecutiveMatches = 0;
          previousHash = currentHash;
        }

        return consecutiveMatches;
      },
      { message }
    )
    .toBeGreaterThanOrEqual(2);

  return previousHash;
}

async function findRedHandlePoint(page) {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  assert.ok(box, "Canvas must have a bounding box before handle detection.");
  const screenshot = await canvas.screenshot();
  const png = decodePng(screenshot);
  let count = 0;
  let totalX = 0;
  let totalY = 0;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const offset = (y * png.width + x) * 4;
      const red = png.pixels[offset] ?? 0;
      const green = png.pixels[offset + 1] ?? 0;
      const blue = png.pixels[offset + 2] ?? 0;
      const alpha = png.pixels[offset + 3] ?? 255;

      if (alpha > 0 && red >= 180 && green <= 115 && blue <= 115) {
        count += 1;
        totalX += x;
        totalY += y;
      }
    }
  }

  assert.ok(count >= 8, "Rendered 3D X transform handle was not detected.");
  return {
    x: (totalX / count / png.width) * box.width,
    y: (totalY / count / png.height) * box.height
  };
}

async function getFrameCount(page) {
  const value = await page.locator("#stage").getAttribute("data-denovo-frame-count");
  return Number(value ?? "0");
}

async function analyzeCanvasScreenshot(page) {
  const canvas = page.locator("canvas");
  const screenshot = await canvas.screenshot();
  const png = decodePng(screenshot);
  const colorCounts = new Map();
  let alphaPixels = 0;
  let coloredPixels = 0;
  const stride = Math.max(1, Math.floor(png.width * png.height / 10_000));

  for (let pixelIndex = 0; pixelIndex < png.width * png.height; pixelIndex += stride) {
    const offset = pixelIndex * 4;
    const red = png.pixels[offset] ?? 0;
    const green = png.pixels[offset + 1] ?? 0;
    const blue = png.pixels[offset + 2] ?? 0;
    const alpha = png.pixels[offset + 3] ?? 255;

    if (alpha > 0) {
      alphaPixels += 1;
    }

    if (alpha > 0 && (red !== 0 || green !== 0 || blue !== 0)) {
      coloredPixels += 1;
    }

    const key = `${red},${green},${blue},${alpha}`;
    colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1);
  }

  return {
    coloredPixels,
    height: png.height,
    sampledPixels: Math.ceil((png.width * png.height) / stride),
    uniqueColors: colorCounts.size,
    visiblePixels: alphaPixels,
    width: png.width
  };
}

function assertCanvasIsRendered(label, analysis) {
  assert.ok(analysis.width >= 300, `${label} canvas width is too small.`);
  assert.ok(analysis.height >= 300, `${label} canvas height is too small.`);
  assert.ok(analysis.visiblePixels > 0, `${label} canvas has no visible pixels.`);
  assert.ok(analysis.coloredPixels > 0, `${label} canvas has no colored pixels.`);
  assert.ok(
    analysis.uniqueColors >= 3,
    `${label} canvas appears blank or single-color.`
  );
}

function isBlockingConsoleMessage(message) {
  if (message.type !== "error" && message.type !== "warning") {
    return false;
  }

  return !allowedConsoleWarningPatterns.some((pattern) =>
    pattern.test(message.text)
  );
}

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

  return {
    height,
    pixels,
    width
  };
}

function unfilterRow(filter, rawRow, previousRow, bytesPerPixel) {
  const row = new Uint8Array(rawRow.length);

  for (let index = 0; index < rawRow.length; index += 1) {
    const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
    const up = previousRow[index] ?? 0;
    const upperLeft = index >= bytesPerPixel ? previousRow[index - bytesPerPixel] : 0;

    switch (filter) {
      case 0:
        row[index] = rawRow[index] ?? 0;
        break;
      case 1:
        row[index] = ((rawRow[index] ?? 0) + left) & 0xff;
        break;
      case 2:
        row[index] = ((rawRow[index] ?? 0) + up) & 0xff;
        break;
      case 3:
        row[index] = ((rawRow[index] ?? 0) + Math.floor((left + up) / 2)) & 0xff;
        break;
      case 4:
        row[index] = ((rawRow[index] ?? 0) + paeth(left, up, upperLeft)) & 0xff;
        break;
      default:
        throw new Error(`Unsupported PNG filter: ${filter}.`);
    }
  }

  return row;
}

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
