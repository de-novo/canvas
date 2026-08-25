import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createCheckRunner } from "./lib/checks.mjs";

/**
 * Assertions here run sequentially against shared build output, so the report
 * records that the suite completed rather than pretending the checks were
 * independent — but `ok` now comes from execution instead of a literal.
 */
const { check, report } = createCheckRunner();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = path.join(root, "packages");
const facadeDir = path.join(root, "packages", "canvas");
const coreDir = path.join(root, "packages", "core");
const editorDir = path.join(root, "packages", "editor");
const bimDir = path.join(root, "packages", "bim");
const corePackagePath = path.join(coreDir, "package.json");
const editorPackagePath = path.join(editorDir, "package.json");
const editorSourcePath = path.join(editorDir, "src", "index.ts");
const editorDistPath = path.join(editorDir, "dist", "index.js");
const editorCommonJsPath = path.join(editorDir, "dist", "index.cjs");
const editorDeclarationPath = path.join(editorDir, "dist", "index.d.ts");
const bimPackagePath = path.join(bimDir, "package.json");
const bimContractsDistPath = path.join(bimDir, "dist", "index.js");
const bimAdapterDistPath = path.join(bimDir, "dist", "web-ifc-adapter.js");
const facadePackagePath = path.join(facadeDir, "package.json");
const facadeSourcePath = path.join(facadeDir, "src", "index.ts");
const facadeStylePath = path.join(facadeDir, "src", "styles.css");
const facadeDistPath = path.join(facadeDir, "dist", "index.js");
const facadeDeclarationPath = path.join(facadeDir, "dist", "index.d.ts");
const coreDeclarationPath = path.join(root, "packages", "core", "dist", "index.d.ts");
const vanillaPackagePath = path.join(root, "apps", "vanilla", "package.json");
const vanillaMainPath = path.join(root, "apps", "vanilla", "src", "main.ts");
const playgroundDir = path.join(root, "apps", "playground");
const playgroundPackagePath = path.join(playgroundDir, "package.json");
const playgroundRegistryPath = path.join(playgroundDir, "components.json");
const playgroundDemoPath = path.join(playgroundDir, "app", "canvas-demo.tsx");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function assertIncludes(source, expected, label) {
  assert.ok(
    source.includes(expected),
    `${label} must include: ${expected}`
  );
}

const facadePackage = readJson(facadePackagePath);
const corePackage = readJson(corePackagePath);
const editorPackage = readJson(editorPackagePath);
const bimPackage = readJson(bimPackagePath);
const facadeName = facadePackage.name;

assert.equal(typeof facadeName, "string", "facade package must have a name");
assert.ok(facadeName.length > 0, "facade package name must not be empty");
assert.ok(facadePackage.exports?.["."], "facade must export the package root");
assert.ok(
  facadePackage.exports?.["./styles.css"],
  "facade must export ./styles.css"
);
assert.ok(
  facadePackage.exports?.["./react"],
  "facade must export ./react as an optional adapter path"
);
assert.equal(
  facadePackage.dependencies?.["@denovo/react-canvas"],
  undefined,
  "React adapter must not be a default dependency of the facade package"
);
assert.equal(
  facadePackage.dependencies?.[editorPackage.name],
  "workspace:*",
  "facade must depend on the framework-agnostic editor package"
);
assert.ok(editorPackage.exports?.["."], "editor must export the package root");
assert.equal(
  editorPackage.dependencies?.["@denovo/canvas-core"],
  "workspace:*",
  "editor must depend on the framework-agnostic core contract"
);
assert.equal(
  facadePackage.peerDependenciesMeta?.["@denovo/react-canvas"]?.optional,
  true,
  "React adapter peer dependency must remain optional"
);
assert.ok(
  corePackage.exports?.["./effect"],
  "core must expose ./effect as the optional Effect-powered entrypoint"
);
assert.ok(
  facadePackage.exports?.["./worker"],
  "facade must expose ./worker as the opt-in performance/worker entrypoint"
);

// BIM package: contracts entry stays free of web-ifc; the parser is opt-in.
assert.ok(bimPackage.exports?.["."], "bim must export the contract root");
assert.ok(
  bimPackage.exports?.["./web-ifc"],
  "bim must expose ./web-ifc as the opt-in parser entrypoint"
);
assert.equal(
  bimPackage.peerDependenciesMeta?.["web-ifc"]?.optional,
  true,
  "web-ifc peer dependency must remain optional"
);
const bimContractsDist = readFileSync(bimContractsDistPath, "utf8");
assert.ok(
  !bimContractsDist.includes("web-ifc"),
  "bim contract entry must not import web-ifc (consumers without IFC never pull the WASM dep)"
);
assert.ok(
  readFileSync(bimAdapterDistPath, "utf8").includes("web-ifc"),
  "bim ./web-ifc entry must reference web-ifc"
);

const facadeSource = readFileSync(facadeSourcePath, "utf8");
assertIncludes(facadeSource, "export type CanvasBackend", "facade source");
assertIncludes(
  facadeSource,
  "export type CanvasResolvedBackend",
  "facade source"
);
assertIncludes(
  facadeSource,
  "export type CanvasImplementedBackend",
  "facade source"
);
assertIncludes(facadeSource, "export type CanvasRendererConfig", "facade source");
assertIncludes(facadeSource, "export type ResolvedCanvasRenderer", "facade source");
assertIncludes(facadeSource, "export function createCanvas", "facade source");
assertIncludes(facadeSource, "export function defineCanvasPlugin", "facade source");
assertIncludes(facadeSource, "renderer?: CanvasRendererInput", "facade source");
assert.doesNotMatch(
  facadeSource,
  /fallbackReason/,
  "strict backend resolution must not expose fallback metadata"
);
assertIncludes(
  facadeSource,
  'from "@denovo/canvas-editor"',
  "facade source"
);
assert.doesNotMatch(
  facadeSource,
  /from ["'](?:react|next|@react-three\/fiber|@react-three\/drei)["']/,
  "default facade source must not import framework adapters"
);

const facadeStyles = readFileSync(facadeStylePath, "utf8");
for (const token of [
  "--dc-background",
  "--dc-foreground",
  "--dc-selection-color",
  "--dc-handle-x-color",
  "--dc-handle-y-color",
  "--dc-handle-z-color",
  "--dc-handle-xy-color",
  "--dc-handle-xz-color",
  "--dc-handle-yz-color",
  "--dc-border-color",
  "--dc-focus-ring-color",
  "--dc-font-family",
  "--dc-radius"
]) {
  assertIncludes(facadeStyles, token, "facade styles");
}
assertIncludes(
  facadeStyles,
  "var(--color-background",
  "facade Tailwind token fallback"
);
assertIncludes(
  facadeStyles,
  "var(--background",
  "facade shadcn token fallback"
);
assert.doesNotMatch(
  facadeStyles,
  /@import\s+["'](?:tailwindcss|shadcn)/,
  "facade styles must remain static CSS without a Tailwind or shadcn runtime import"
);

const editorSource = readFileSync(editorSourcePath, "utf8");
assert.doesNotMatch(
  editorSource,
  /from ["'](?:react|next|three|@react-three\/fiber|@react-three\/drei)["']|\bwindow\b|\bglobalThis\.document\b|\bHTMLElement\b|\bHTMLCanvasElement\b/,
  "editor source must remain framework, renderer, and DOM independent"
);

const vanillaPackage = readJson(vanillaPackagePath);
assert.equal(
  vanillaPackage.dependencies?.[facadeName],
  "workspace:*",
  "vanilla example must depend on the current facade package name"
);
assert.equal(
  vanillaPackage.dependencies?.["@denovo/canvas-web"],
  undefined,
  "vanilla example must not depend directly on the web runtime"
);
assert.equal(
  vanillaPackage.dependencies?.["@denovo/canvas-core"],
  undefined,
  "vanilla example must not depend directly on core"
);

const vanillaMain = readFileSync(vanillaMainPath, "utf8");
assertIncludes(vanillaMain, `from "${facadeName}"`, "vanilla main");
assertIncludes(
  vanillaMain,
  `import "${facadeName}/styles.css"`,
  "vanilla main"
);

const playgroundPackage = readJson(playgroundPackagePath);
const playgroundRegistry = readJson(playgroundRegistryPath);
const playgroundDemo = readFileSync(playgroundDemoPath, "utf8");
assert.equal(
  playgroundRegistry.$schema,
  "https://ui.shadcn.com/schema.json",
  "Next playground must use an actual shadcn registry"
);
assert.equal(
  playgroundRegistry.tailwind?.css,
  "app/globals.css",
  "shadcn registry must target the playground Tailwind stylesheet"
);
assert.ok(
  playgroundPackage.dependencies?.["@base-ui/react"],
  "shadcn Base UI runtime dependency must be installed in the playground"
);
assert.ok(
  playgroundPackage.dependencies?.shadcn,
  "shadcn package must be installed in the playground"
);
assert.ok(
  playgroundPackage.devDependencies?.tailwindcss,
  "Tailwind v4 must be installed in the playground"
);
for (const componentPath of [
  path.join(playgroundDir, "components", "ui", "button.tsx"),
  path.join(playgroundDir, "components", "ui", "toggle-group.tsx")
]) {
  assert.ok(existsSync(componentPath), `missing generated shadcn component: ${componentPath}`);
}
assertIncludes(
  playgroundDemo,
  'from "@/components/ui/button"',
  "Next playground"
);
assertIncludes(
  playgroundDemo,
  'from "@/components/ui/toggle-group"',
  "Next playground"
);

assert.ok(
  existsSync(facadeDistPath),
  "facade dist/index.js is missing. Run pnpm build before verify:public-api."
);
assert.ok(
  existsSync(facadeDeclarationPath),
  "facade dist/index.d.ts is missing. Run pnpm build before verify:public-api."
);
assert.ok(
  existsSync(coreDeclarationPath),
  "core dist/index.d.ts is missing. Run pnpm build before verify:public-api."
);
assert.ok(
  existsSync(editorDeclarationPath),
  "editor dist/index.d.ts is missing. Run pnpm build before verify:public-api."
);
assert.ok(existsSync(editorDistPath), "editor ESM build is missing");
assert.ok(existsSync(editorCommonJsPath), "editor CommonJS build is missing");

for (const [label, declarationPath] of [
  ["facade declaration", facadeDeclarationPath],
  ["core declaration", coreDeclarationPath],
  ["editor declaration", editorDeclarationPath]
]) {
  const declaration = readFileSync(declarationPath, "utf8");

  assert.doesNotMatch(
    declaration,
    /from ["']effect["']|import\(["']effect["']\)|\beffect\//,
    `${label} must not expose Effect types`
  );
  assert.doesNotMatch(
    declaration,
    /\b(?:Cause|Effect|Either|Exit|Fiber|Layer|Scope)\b/,
    `${label} must not expose Effect vocabulary`
  );
}

const publicDeclarationPaths = readdirSync(packagesDir, {
  withFileTypes: true
}).flatMap((packageEntry) => {
  if (!packageEntry.isDirectory()) {
    return [];
  }

  const distDir = path.join(packagesDir, packageEntry.name, "dist");

  if (!existsSync(distDir)) {
    return [];
  }

  return readdirSync(distDir)
    .filter((fileName) => fileName.endsWith(".d.ts"))
    .map((fileName) => path.join(distDir, fileName));
});

assert.ok(
  publicDeclarationPaths.length > 0,
  "public package declarations are missing. Run pnpm build before verify:public-api."
);

for (const declarationPath of publicDeclarationPaths) {
  // Vue's DefineComponent type exposes `any` in its generated declaration
  // (e.g. `ComponentProvideOptions, true, {}, any>`). This is a limitation of
  // Vue's own type definitions, not a leak in Denovo's public API. The Vue
  // adapter is therefore exempt from the explicit-any declaration check.
  if (declarationPath.includes(`${path.sep}vue-canvas${path.sep}`)) {
    continue;
  }

  assert.doesNotMatch(
    readFileSync(declarationPath, "utf8"),
    /\bany\b/,
    `${path.relative(root, declarationPath)} must not expose explicit any`
  );
}

const editorDeclaration = readFileSync(editorDeclarationPath, "utf8");
const facadeDeclaration = readFileSync(facadeDeclarationPath, "utf8");
const coreDeclaration = readFileSync(coreDeclarationPath, "utf8");
assert.doesNotMatch(
  editorDeclaration,
  /\b(?:Effect|Either|Exit|Cause|HTMLElement|HTMLCanvasElement|WebGLRenderer|Object3D)\b|from ["'](?:react|three)["']/,
  "editor declaration must expose only ordinary framework-free TypeScript contracts"
);
assert.doesNotMatch(
  facadeDeclaration,
  /CanvasFacadeRegistry|readonly registry:|StoragePreset|storage:/,
  "facade declaration must not expose private registries or unconnected storage config"
);
assert.doesNotMatch(
  coreDeclaration,
  /CanvasNodeDefinition|registerNode|registerRenderer/,
  "core plugin declarations must not advertise unimplemented registrations"
);

const facadeModule = await import(pathToFileURL(facadeDistPath).href);
const editorModule = await import(pathToFileURL(editorDistPath).href);

function pluginCommand(type, parsePayload = (payload) => payload) {
  return facadeModule.definePluginCommand({ parsePayload, type });
}
assert.equal(typeof editorModule.createEditor, "function");
assert.equal(typeof editorModule.connectEditorToRuntime, "function");

for (const exportName of [
  "connectCanvasSelection",
  "connectCanvasToolInput",
  "connectEditorToCanvas",
  "connectEditorToRuntime",
  "applyCommandsToDocument",
  "applyCommandsToStoredDocument",
  "applyNamedOperations",
  "addLayer",
  "reorderLayer",
  "listNodes",
  "listLayers",
  "setFieldPattern",
  "setSparklineStyle",
  "setLayerLocked",
  "setLayerName",
  "setLayerVisible",
  "setNodeLayer",
  "setNodeLocked",
  "setNodeVisible",
  "setText",
  "removeNode",
  "removeEdge",
  "removeLayer",
  "stackBox",
  "denovoFieldInstanceCount",
  "isDenovoFieldNode",
  "isDenovoFieldType",
  "parseDenovoFieldProps",
  "denovoSparklinePoints",
  "denovoSparklineSize",
  "isDenovoSparklineNode",
  "isDenovoSparklineType",
  "parseDenovoSparklineProps",
  "createMemoryGeometryStore",
  "createMeshGeometryAssetRef",
  "decodeMeshGeometry",
  "defineMeshGeometry",
  "encodeMeshGeometry",
  "hydrateCanvasGeometryStore",
  "persistCanvasGeometryStore",
  "resolveCanvasMeshGeometry",
  "create2DShapeTool",
  "create3DPrimitiveTool",
  "create3DSurfacePlacementTool",
  "createAnnotationTool",
  "createConnectorTool",
  "createCanvas",
  "createCanvas2D",
  "createCanvas3D",
  "createDistanceMeasurementTool",
  "createEditor",
  "createRelationGraphLayoutAdapter",
  "createTimeGraphLayoutAdapter",
  "createGroupNodesCommand",
  "createNodeUpdateCommand",
  "createPanOrbitTool",
  "createSelectTool",
  "createTransformTool",
  "createUngroupNodesCommand",
  "defineCanvasConfig",
  "defineCanvasPlugin",
  "definePluginCommand",
  "definePluginNodeKind",
  "getPluginNodeKind",
  "isCanvas2DPluginNode",
  "isPluginNodeType",
  "parsePluginNodeProps",
  "pluginNodeKindSupportsMode",
  "registerPluginNodeKind",
  "define2DEdge",
  "defineDocument",
  "defineHitResult",
  "defineHitTestInput",
  "defineScene",
  "defineToolInput",
  "getEffectiveNodeState",
  "snapPointToGrid",
  "validateGridWorkPlaneCompatibility"
]) {
  assert.equal(
    typeof facadeModule[exportName],
    "function",
    `facade runtime export must be a function: ${exportName}`
  );
}

assert.equal(
  typeof facadeModule.CanvasEditorError,
  "function",
  "facade must export the ordinary CanvasEditorError domain class"
);
assert.equal(
  typeof facadeModule.CanvasHitTestUnsupportedError,
  "function",
  "facade must export the ordinary hit-test capability error"
);
assert.equal(
  typeof facadeModule.CanvasPluginError,
  "function",
  "facade must export the ordinary plugin lifecycle error"
);
const require = createRequire(import.meta.url);
const facadeCommonJs = require(path.join(facadeDir, "dist", "index.cjs"));
const editorCommonJs = require(editorCommonJsPath);
assert.equal(
  typeof facadeCommonJs.createEditor,
  "function",
  "CommonJS facade must expose createEditor"
);
assert.equal(
  typeof facadeCommonJs.connectEditorToCanvas,
  "function",
  "CommonJS facade must expose connectEditorToCanvas"
);
assert.equal(
  typeof facadeCommonJs.connectCanvasToolInput,
  "function",
  "CommonJS facade must expose connectCanvasToolInput"
);
assert.equal(
  typeof facadeCommonJs.createPanOrbitTool,
  "function",
  "CommonJS facade must expose createPanOrbitTool"
);
assert.equal(
  typeof facadeCommonJs.createSelectTool,
  "function",
  "CommonJS facade must expose createSelectTool"
);
assert.equal(
  typeof facadeCommonJs.createTransformTool,
  "function",
  "CommonJS facade must expose createTransformTool"
);
assert.equal(
  typeof facadeCommonJs.create3DSurfacePlacementTool,
  "function",
  "CommonJS facade must expose create3DSurfacePlacementTool"
);
assert.equal(
  typeof facadeCommonJs.CanvasPluginError,
  "function",
  "CommonJS facade must expose CanvasPluginError"
);
assert.equal(
  typeof editorCommonJs.createEditor,
  "function",
  "CommonJS editor package must expose createEditor"
);
assert.equal(
  typeof editorCommonJs.create3DSurfacePlacementTool,
  "function",
  "CommonJS editor package must expose create3DSurfacePlacementTool"
);

const customRuntimeEvents = [];
const customTarget = {
  classList: {
    add(...classNames) {
      customRuntimeEvents.push(`class:${classNames.join(",")}`);
    }
  },
  dataset: {},
  removeAttribute(name) {
    customRuntimeEvents.push(`remove:${name}`);
  },
  style: {
    setProperty(name, value) {
      customRuntimeEvents.push(`style:${name}:${value}`);
    }
  }
};
const strictBackendScene = facadeModule.defineScene({
  id: "strict-backend-scene",
  layers: [{ id: "main", name: "Main" }],
  mode: "2d",
  nodes: []
});
const strictBackend3dScene = facadeModule.defineScene({
  id: "strict-backend-3d-scene",
  layers: [{ id: "main", name: "Main" }],
  mode: "3d",
  nodes: []
});
assert.throws(
  () =>
    facadeModule.createCanvas(customTarget, {
      renderer: "custom",
      scene: strictBackendScene
    }),
  (error) =>
    error instanceof TypeError &&
    error.message.includes("requires an explicit renderer adapter")
);
for (const [renderer, scene, code] of [
  ["webgpu", strictBackendScene, "mode-mismatch"],
  ["offscreen-canvas2d", strictBackendScene, "backend-unimplemented"],
  ["webgpu", strictBackend3dScene, "capability-unavailable"]
]) {
  assert.throws(
    () =>
      facadeModule.createCanvas(customTarget, {
        renderer,
        scene
      }),
    (error) =>
      error instanceof facadeModule.CanvasBackendResolutionError &&
      error.code === code,
    `${renderer} must fail explicitly instead of selecting a fallback backend.`
  );
}
assert.throws(
  () =>
    facadeModule.createCanvas(customTarget, {
      renderer: "canvas2d",
      scene: {
        id: "canvas2d-mode-mismatch",
        layers: [{ id: "main", name: "Main" }],
        mode: "3d",
        nodes: []
      }
    }),
  (error) =>
    error instanceof facadeModule.CanvasBackendResolutionError &&
    error.code === "mode-mismatch"
);
assert.throws(
  () =>
    facadeModule.createCanvas(customTarget, {
      mode: "2d",
      scene: strictBackendScene
    }),
  (error) =>
    error instanceof TypeError &&
    error.message.includes("cannot be combined with inline scene fields")
);
const customCanvasElement = {};
const customStore = {};
let customNavigationInputEnabled = true;
let customScene = facadeModule.defineScene({
  id: "custom-runtime-scene",
  layers: [{ id: "main", name: "Main" }],
  mode: "2d",
  nodes: []
});
const customRendererRuntime = {
  canvas: customCanvasElement,
  destroy() {
    customRuntimeEvents.push("destroy");
  },
  get mode() {
    return customScene.mode;
  },
  get navigationInputEnabled() {
    return customNavigationInputEnabled;
  },
  navigationInputSupported: true,
  getScene() {
    return customScene;
  },
  ready: Promise.resolve(),
  render() {
    customRuntimeEvents.push("render");
  },
  resolveScenePoint(request) {
    assert.equal(this, customRendererRuntime);
    return {
      mode: "2d",
      position: request.viewportPoint
    };
  },
  resize() {
    customRuntimeEvents.push("resize");
  },
  setNavigationInputEnabled(enabled) {
    customNavigationInputEnabled = enabled;
    customRuntimeEvents.push(`navigation:${enabled}`);
  },
  setAuthoringPreviews(previews) {
    assert.equal(this, customRendererRuntime);
    customRuntimeEvents.push(`previews:${previews.length}`);
  },
  start() {
    customRuntimeEvents.push("start");
  },
  stop() {
    customRuntimeEvents.push("stop");
  },
  store: customStore,
  update(sceneInput) {
    customScene = facadeModule.defineScene(sceneInput);
    customRuntimeEvents.push(`update:${customScene.id}`);
    return customScene;
  }
};
const customRendererAdapter = {
  createRuntime(target, scene, options) {
    assert.equal(target, customTarget);
    assert.equal(scene.id, customScene.id);
    assert.equal(typeof options, "object");
    customRuntimeEvents.push("create");
    return customRendererRuntime;
  },
  modes: ["2d"],
  name: "public-api-custom-renderer"
};
assert.throws(
  () =>
    facadeModule.createCanvas(customTarget, {
      renderer: { adapter: customRendererAdapter, backend: "webgl2" },
      scene: customScene
    }),
  (error) =>
    error instanceof TypeError &&
    error.message.includes("cannot be combined with a renderer adapter")
);
const scenePointOnlyRuntime = {
  ...customRendererRuntime,
  destroy() {}
};
delete scenePointOnlyRuntime.setAuthoringPreviews;
const scenePointOnlyCanvas = facadeModule.createCanvas(customTarget, {
  renderer: {
    createRuntime() {
      return scenePointOnlyRuntime;
    },
    modes: ["2d"],
    name: "scene-point-only-runtime"
  },
  scene: customScene
});
assert.equal(typeof scenePointOnlyCanvas.resolveScenePoint, "function");
assert.equal(scenePointOnlyCanvas.setAuthoringPreviews, undefined);
scenePointOnlyCanvas.destroy();

const malformedAuthoringPreviewRuntime = {
  ...customRendererRuntime,
  setAuthoringPreviews: true
};
assert.throws(
  () =>
    facadeModule.createCanvas(customTarget, {
      renderer: {
        createRuntime() {
          return malformedAuthoringPreviewRuntime;
        },
        modes: ["2d"],
        name: "malformed-authoring-preview-runtime"
      },
      scene: customScene
    }),
  (error) =>
    error instanceof TypeError &&
    error.message.includes("authoring previews capability fields")
);

const surfacePointRuntime = {
  ...customRendererRuntime,
  destroy() {},
  resolveSurfacePoint(request) {
    assert.equal(this, surfacePointRuntime);
    assert.equal(request.mode, "3d");
    assert.equal(request.target.kind, "node");
    assert.equal(request.target.nodeType, "box");
    return { kind: "miss", mode: "3d" };
  }
};
delete surfacePointRuntime.resolveScenePoint;
delete surfacePointRuntime.setAuthoringPreviews;
const surfacePointCanvas = facadeModule.createCanvas(customTarget, {
  renderer: {
    createRuntime() {
      return surfacePointRuntime;
    },
    modes: ["2d"],
    name: "surface-point-runtime"
  },
  scene: customScene
});
assert.equal(surfacePointCanvas.resolveScenePoint, undefined);
assert.equal(surfacePointCanvas.setAuthoringPreviews, undefined);
assert.deepEqual(
  await surfacePointCanvas.resolveSurfacePoint?.({
    mode: "3d",
    target: { kind: "node", nodeType: "box" },
    viewportPoint: [12, 24]
  }),
  { kind: "miss", mode: "3d" }
);
surfacePointCanvas.destroy();

assert.throws(
  () =>
    facadeModule.createCanvas(customTarget, {
      renderer: {
        createRuntime() {
          return { ...customRendererRuntime, resolveSurfacePoint: "invalid" };
        },
        modes: ["2d"],
        name: "malformed-surface-point-runtime"
      },
      scene: customScene
    }),
  (error) =>
    error instanceof TypeError &&
    error.message.includes("3D surface-point resolution capability fields")
);
const customCanvas = facadeModule.createCanvas(customTarget, {
  renderer: customRendererAdapter,
  scene: customScene
});

assert.equal(customCanvas.config.renderer.resolved, "custom");
assert.equal(customCanvas.config.renderer.adapterName, customRendererAdapter.name);
assert.equal(customCanvas.current, customRendererRuntime);
assert.equal(customCanvas.canvas, customCanvasElement);
assert.equal(customCanvas.store, customStore);
assert.equal(customCanvas.navigationInputEnabled, true);
customCanvas.setNavigationInputEnabled(false);
assert.equal(customCanvas.navigationInputEnabled, false);
customCanvas.setNavigationInputEnabled(true);
assert.equal(customCanvas.navigationInputEnabled, true);
assert.deepEqual(
  await customCanvas.resolveScenePoint?.({
    mode: "2d",
    viewportPoint: [12, 24]
  }),
  { mode: "2d", position: [12, 24] }
);
await customCanvas.setAuthoringPreviews?.([]);
assert.ok(customRuntimeEvents.includes("previews:0"));

class PublicApiFakeCanvas extends EventTarget {
  constructor() {
    super();
    this.captures = new Set();
    this.parentElement = null;
    this.style = { touchAction: "manipulation" };
  }

  getBoundingClientRect() {
    return { height: 200, left: 0, top: 0, width: 320 };
  }

  hasPointerCapture(pointerId) {
    return this.captures.has(pointerId);
  }

  releasePointerCapture(pointerId) {
    this.captures.delete(pointerId);
  }

  setPointerCapture(pointerId) {
    this.captures.add(pointerId);
  }
}

function dispatchPublicApiPointer(
  eventTarget,
  canvas,
  type,
  pointerId,
  overrides = {}
) {
  const event = new Event(type);
  const fields = {
    altKey: false,
    button: 0,
    buttons: type === "pointerdown" ? 1 : 0,
    clientX: 12,
    clientY: 24,
    ctrlKey: false,
    isPrimary: true,
    metaKey: false,
    pointerId,
    pointerType: "mouse",
    pressure: type === "pointerdown" ? 0.5 : 0,
    shiftKey: false,
    ...overrides
  };

  for (const [name, value] of Object.entries(fields)) {
    Object.defineProperty(event, name, { value });
  }

  Object.defineProperty(event, "composedPath", {
    value: () => [canvas, eventTarget]
  });
  eventTarget.dispatchEvent(event);
}

const directToolInputs = [];
const directToolRuntimes = [];
const directPreviewLengths = [];
const firstDirectCanvas = new PublicApiFakeCanvas();
const secondDirectCanvas = new PublicApiFakeCanvas();
const directEventTarget = new PublicApiFakeCanvas();
let activeDirectCanvas = firstDirectCanvas;
let directRuntimeGeneration = 0;
const directRuntimeChangeListeners = new Set();
const directAuthoringRuntime = {
  get canvas() {
    return activeDirectCanvas;
  },
  hitTest() {
    return { kind: "empty", renderer: "direct-authoring-runtime" };
  },
  resolveScenePoint(request) {
    assert.equal(this, directAuthoringRuntime);
    return { mode: "2d", position: request.viewportPoint };
  },
  setAuthoringPreviews(previews) {
    assert.equal(this, directAuthoringRuntime);
    directPreviewLengths.push(previews.length);
  },
  subscribeRuntimeChange(listener) {
    directRuntimeChangeListeners.add(listener);
    return () => directRuntimeChangeListeners.delete(listener);
  }
};
function replaceDirectCanvas(nextCanvas) {
  directRuntimeGeneration += 1;

  for (const listener of [...directRuntimeChangeListeners]) {
    listener({
      generation: directRuntimeGeneration,
      nextMode: "2d",
      previousMode: "2d",
      type: "replace"
    });
  }

  activeDirectCanvas = nextCanvas;
}
let directToolCancellationCount = 0;
const directToolTarget = {
  cancelActiveToolSession() {
    directToolCancellationCount += 1;
    directToolRuntimes.at(-1)?.setAuthoringPreviews?.([]);
    return Promise.resolve();
  },
  getActiveTool() {
    return { id: "direct-authoring-tool" };
  },
  handleToolInput(input, runtime) {
    directToolInputs.push(input.type);
    directToolRuntimes.push(runtime);

    if (input.type === "pointer.down") {
      assert.deepEqual(
        runtime.resolveScenePoint?.({ mode: "2d", viewportPoint: input.point }),
        { mode: "2d", position: input.point }
      );
      runtime.setAuthoringPreviews?.([
        { kind: "grid.snap", mode: "2d", position: input.point }
      ]);
    } else if (input.type === "pointer.cancel") {
      runtime.setAuthoringPreviews?.([]);
    }
  },
  selectFromHit() {
    return null;
  }
};
const disconnectDirectToolInput = facadeModule.connectCanvasToolInput(
  directAuthoringRuntime,
  directToolTarget,
  { eventTarget: directEventTarget }
);
dispatchPublicApiPointer(directEventTarget, firstDirectCanvas, "pointerdown", 1);
replaceDirectCanvas(secondDirectCanvas);
dispatchPublicApiPointer(directEventTarget, secondDirectCanvas, "pointerdown", 2);
disconnectDirectToolInput();
assert.deepEqual(directToolInputs, [
  "pointer.down",
  "pointer.down"
]);
assert.deepEqual(directPreviewLengths, [1, 0, 1, 0]);
assert.equal(directToolCancellationCount, 2);
assert.equal(directRuntimeChangeListeners.size, 0);
assert.equal(
  directToolRuntimes.every(
    (runtime) => runtime === directToolRuntimes[0]
  ),
  true,
  "A DOM connection must preserve one stable editor tool runtime context."
);
assert.equal(firstDirectCanvas.captures.size, 0);
assert.equal(secondDirectCanvas.captures.size, 0);
assert.equal(firstDirectCanvas.style.touchAction, "manipulation");
assert.equal(secondDirectCanvas.style.touchAction, "manipulation");
assert.equal(directEventTarget.style.touchAction, "manipulation");

function createSubscribedToolRuntime({ canvas, resolveScenePoint, setPreviews }) {
  let generation = 0;
  const listeners = new Set();

  return {
    canvas,
    emitReplacement(nextMode = "2d") {
      generation += 1;

      for (const listener of [...listeners]) {
        listener({
          generation,
          nextMode,
          previousMode: "2d",
          type: "replace"
        });
      }
    },
    hitTest() {
      return { kind: "empty", renderer: "subscribed-tool-runtime" };
    },
    resolveScenePoint,
    setAuthoringPreviews: setPreviews,
    subscribeRuntimeChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

const flushPublicApiTasks = () =>
  new Promise((resolve) => setImmediate(resolve));

let resolveDisconnectedScenePoint;
let markDisconnectedResolverStarted;
const disconnectedResolverStarted = new Promise((resolve) => {
  markDisconnectedResolverStarted = resolve;
});
const disconnectedScenePoint = new Promise((resolve) => {
  resolveDisconnectedScenePoint = resolve;
});
const disconnectAuthoringTool = facadeModule.create2DShapeTool({
  createId: () => "disconnect-authoring-node",
  grid: { mode: "2d", origin: [0, 0], spacing: [1, 1] },
  id: "disconnect-authoring-tool",
  layerId: "main",
  mode: "2d",
  type: "rect"
});
const disconnectAuthoringEditor = facadeModule.createEditor({
  activeToolId: disconnectAuthoringTool.id,
  document: {
    id: "disconnect-authoring-document",
    scene: {
      id: "disconnect-authoring-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: []
    }
  },
  tools: [disconnectAuthoringTool]
});
const disconnectAuthoringCanvas = new PublicApiFakeCanvas();
const disconnectAuthoringTarget = new PublicApiFakeCanvas();
const disconnectAuthoringPreviews = [];
const disconnectAuthoringRuntime = createSubscribedToolRuntime({
  canvas: disconnectAuthoringCanvas,
  resolveScenePoint() {
    markDisconnectedResolverStarted();
    return disconnectedScenePoint;
  },
  setPreviews(previews) {
    disconnectAuthoringPreviews.push(previews);
  }
});
const disconnectPendingAuthoring = facadeModule.connectCanvasToolInput(
  disconnectAuthoringRuntime,
  disconnectAuthoringEditor,
  { eventTarget: disconnectAuthoringTarget }
);
dispatchPublicApiPointer(
  disconnectAuthoringTarget,
  disconnectAuthoringCanvas,
  "pointerdown",
  11
);
await disconnectedResolverStarted;
disconnectPendingAuthoring();
assert.deepEqual(disconnectAuthoringPreviews.at(-1), []);
resolveDisconnectedScenePoint({ mode: "2d", position: [12, 24] });
await flushPublicApiTasks();
assert.equal(
  disconnectAuthoringEditor.getState().document.scene.nodes.length,
  0
);
assert.equal(disconnectAuthoringEditor.getState().history.undoDepth, 0);
assert.deepEqual(disconnectAuthoringPreviews.at(-1), []);

let resolveReplacementDraft;
let markReplacementDraftStarted;
const replacementDraftStarted = new Promise((resolve) => {
  markReplacementDraftStarted = resolve;
});
const replacementDraft = new Promise((resolve) => {
  resolveReplacementDraft = resolve;
});
const replacementAnnotationTool = facadeModule.createAnnotationTool({
  createId: () => "replacement-annotation-node",
  id: "replacement-annotation-tool",
  layerId: "main",
  mode: "2d",
  provideDraft() {
    markReplacementDraftStarted();
    return replacementDraft;
  },
  type: "annotation"
});
const replacementAnnotationEditor = facadeModule.createEditor({
  activeToolId: replacementAnnotationTool.id,
  document: {
    id: "replacement-annotation-document",
    scene: {
      id: "replacement-annotation-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: []
    }
  },
  tools: [replacementAnnotationTool]
});
const replacementAnnotationCanvas = new PublicApiFakeCanvas();
const replacementAnnotationTarget = new PublicApiFakeCanvas();
const replacementAnnotationPreviews = [];
const replacementAnnotationRuntime = createSubscribedToolRuntime({
  canvas: replacementAnnotationCanvas,
  resolveScenePoint(request) {
    return { mode: "2d", position: request.viewportPoint };
  },
  setPreviews(previews) {
    replacementAnnotationPreviews.push(previews);
  }
});
const disconnectReplacementAnnotation = facadeModule.connectCanvasToolInput(
  replacementAnnotationRuntime,
  replacementAnnotationEditor,
  { eventTarget: replacementAnnotationTarget }
);
dispatchPublicApiPointer(
  replacementAnnotationTarget,
  replacementAnnotationCanvas,
  "pointerdown",
  12
);
await flushPublicApiTasks();
dispatchPublicApiPointer(
  replacementAnnotationTarget,
  replacementAnnotationCanvas,
  "pointerup",
  12
);
await replacementDraftStarted;
replacementAnnotationRuntime.emitReplacement();
resolveReplacementDraft({
  draft: { targetId: null, text: "must not commit" },
  kind: "commit"
});
await flushPublicApiTasks();
assert.equal(
  replacementAnnotationEditor.getState().document.scene.nodes.length,
  0
);
assert.equal(replacementAnnotationEditor.getState().history.undoDepth, 0);
assert.deepEqual(replacementAnnotationPreviews.at(-1), []);
disconnectReplacementAnnotation();

let releaseReplacementPreview;
let markReplacementPreviewStarted;
let markReplacementPreviewCleared;
const replacementPreviewStarted = new Promise((resolve) => {
  markReplacementPreviewStarted = resolve;
});
const replacementPreviewCleared = new Promise((resolve) => {
  markReplacementPreviewCleared = resolve;
});
const replacementPreviewTool = facadeModule.create2DShapeTool({
  createId: () => "replacement-preview-node",
  grid: { mode: "2d", origin: [0, 0], spacing: [1, 1] },
  id: "replacement-preview-tool",
  layerId: "main",
  mode: "2d",
  type: "rect"
});
const replacementPreviewEditor = facadeModule.createEditor({
  activeToolId: replacementPreviewTool.id,
  document: {
    id: "replacement-preview-document",
    scene: {
      id: "replacement-preview-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: []
    }
  },
  tools: [replacementPreviewTool]
});
const replacementPreviewCanvas = new PublicApiFakeCanvas();
const replacementPreviewTarget = new PublicApiFakeCanvas();
const replacementPreviewWrites = [];
let replacementPreviewClearCount = 0;
const replacementPreviewRuntime = createSubscribedToolRuntime({
  canvas: replacementPreviewCanvas,
  resolveScenePoint(request) {
    return { mode: "2d", position: request.viewportPoint };
  },
  setPreviews(previews) {
    const hasNode = previews.some((preview) => preview.kind === "node");

    if (hasNode && !releaseReplacementPreview) {
      markReplacementPreviewStarted();
      return new Promise((resolve) => {
        releaseReplacementPreview = () => {
          replacementPreviewWrites.push(previews);
          resolve();
        };
      });
    }

    replacementPreviewWrites.push(previews);

    if (previews.length === 0) {
      replacementPreviewClearCount += 1;

      if (replacementPreviewClearCount === 2) {
        markReplacementPreviewCleared();
      }
    }
  }
});
const disconnectReplacementPreview = facadeModule.connectCanvasToolInput(
  replacementPreviewRuntime,
  replacementPreviewEditor,
  { eventTarget: replacementPreviewTarget }
);
dispatchPublicApiPointer(
  replacementPreviewTarget,
  replacementPreviewCanvas,
  "pointerdown",
  13
);
await flushPublicApiTasks();
dispatchPublicApiPointer(
  replacementPreviewTarget,
  replacementPreviewCanvas,
  "pointermove",
  13,
  { buttons: 1, clientX: 40, clientY: 55, pressure: 0.5 }
);
await replacementPreviewStarted;
replacementPreviewRuntime.emitReplacement();
releaseReplacementPreview();
await replacementPreviewCleared;
assert.deepEqual(replacementPreviewWrites.at(-1), []);
assert.equal(replacementPreviewEditor.getState().document.scene.nodes.length, 0);
assert.equal(replacementPreviewEditor.getState().history.undoDepth, 0);
disconnectReplacementPreview();

assert.equal(
  customRuntimeEvents.some((event) => event.startsWith("style:--dc-")),
  false,
  "preset themes must not inject inline public style tokens"
);
await customCanvas.ready;
customCanvas.start();
customCanvas.render();
customCanvas.resize();
customCanvas.stop();
customCanvas.update({
  id: "custom-runtime-updated",
  layers: [{ id: "main", name: "Main" }],
  mode: "2d",
  nodes: []
});
assert.equal(customCanvas.getScene().id, "custom-runtime-updated");
const loadedDocument = customCanvas.loadDocument(
  JSON.stringify({
    assets: [
      {
        id: "custom-runtime-asset",
        type: "image",
        uri: "/assets/custom-runtime.png"
      }
    ],
    id: "custom-runtime-document",
    schemaVersion: "0.2.0",
    scene: {
      id: "custom-runtime-loaded-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: []
    }
  })
);
assert.equal(customCanvas.getDocument(), loadedDocument);
assert.equal(loadedDocument.assets[0]?.id, "custom-runtime-asset");
customCanvas.update({
  id: "custom-runtime-loaded-scene-updated",
  layers: [{ id: "main", name: "Main" }],
  mode: "2d",
  nodes: []
});
assert.equal(customCanvas.getDocument()?.scene.id, "custom-runtime-loaded-scene-updated");
assert.equal(customCanvas.getDocument()?.assets[0]?.id, "custom-runtime-asset");
assert.throws(
  () =>
    customCanvas.update({
      id: "unsupported-custom-runtime-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "3d",
      nodes: []
    }),
  /does not support scene mode: 3d/
);
assert.throws(
  () => customCanvas.hitTest({ point: [0, 0] }),
  (error) =>
    error instanceof facadeModule.CanvasHitTestUnsupportedError &&
    error.renderer === customRendererAdapter.name
);
const customEditor = facadeModule.createEditor({
  document: {
    id: "custom-editor-document",
    scene: customCanvas.getScene()
  }
});
assert.throws(
  () => facadeModule.connectEditorToCanvas(customEditor, customCanvas),
  (error) => error instanceof facadeModule.CanvasHitTestUnsupportedError
);
customCanvas.destroy();
assert.deepEqual(
  customRuntimeEvents.filter((event) =>
    ["create", "start", "render", "resize", "stop", "destroy"].includes(event)
  ),
  ["create", "start", "render", "resize", "stop", "destroy"]
);

function createLifecycleRendererAdapter(name, events = []) {
  return {
    createRuntime(_target, initialScene) {
      let activeScene = initialScene;

      return {
        canvas: {},
        navigationInputSupported: false,
        destroy() {
          events.push(`${name}:destroy`);
        },
        get mode() {
          return activeScene.mode;
        },
        getScene() {
          return activeScene;
        },
        ready: Promise.resolve(),
        render() {},
        resize() {},
        start() {},
        stop() {},
        store: {},
        update(sceneInput) {
          activeScene = facadeModule.defineScene(sceneInput);
          events.push(`${name}:update:${activeScene.id}`);
          return activeScene;
        }
      };
    },
    modes: ["2d"],
    name
  };
}

const lifecycleScene = facadeModule.defineScene({
  id: "plugin-lifecycle-scene",
  layers: [{ id: "main", name: "Main" }],
  mode: "2d",
  nodes: []
});
const lifecycleDocument = facadeModule.defineDocument({
  id: "plugin-lifecycle-document",
  scene: lifecycleScene
});
const lifecycleEvents = [];
let releaseLifecycleSetup;
const lifecycleSetupGate = new Promise((resolve) => {
  releaseLifecycleSetup = resolve;
});
const lifecyclePlugin = facadeModule.defineCanvasPlugin({
  name: "plugin-lifecycle",
  tools: [
    {
      cursor: "help",
      id: "plugin.lifecycle.tool.inspect",
      label: "Plugin Inspect"
    }
  ],
  async setup(context) {
    lifecycleEvents.push("setup:start");
    await lifecycleSetupGate;
    context.registerCommand(
      pluginCommand("plugin.lifecycle.rename", (payload) => {
        if (typeof payload !== "string") {
          throw new TypeError("rename payload must be a string");
        }

        return payload;
      }),
      (command, commandContext) => ({
        document: {
          ...commandContext.document,
          title: command.payload
        }
      })
    );
    context.registerTool({
      cursor: "crosshair",
      id: "plugin.lifecycle.tool.measure",
      label: "Plugin Measure"
    });
    lifecycleEvents.push("setup:end");
  }
});
const lifecycleCanvas = facadeModule.createCanvas(customTarget, {
  document: lifecycleDocument,
  plugins: [lifecyclePlugin],
  renderer: createLifecycleRendererAdapter("plugin-lifecycle", lifecycleEvents)
});
const lifecycleEditor = facadeModule.createEditor({
  document: lifecycleDocument,
  tools: [
    {
      id: "host-tool",
      label: "Host Tool"
    }
  ]
});
const disconnectLifecycleEditor = facadeModule.connectEditorToRuntime(
  lifecycleEditor,
  lifecycleCanvas
);
assert.deepEqual(
  lifecycleEditor.getTools().map((tool) => tool.id),
  ["host-tool"]
);
let lifecycleReadySettled = false;
const lifecycleReady = lifecycleCanvas.ready.then(() => {
  lifecycleReadySettled = true;
});
await Promise.resolve();
assert.equal(lifecycleReadySettled, false);
releaseLifecycleSetup();
await lifecycleReady;
assert.deepEqual(
  lifecycleEvents.filter((event) => event.startsWith("setup:")),
  ["setup:start", "setup:end"]
);
assert.deepEqual(
  lifecycleEditor.getTools().map((tool) => tool.id),
  [
    "host-tool",
    "plugin.lifecycle.tool.inspect",
    "plugin.lifecycle.tool.measure"
  ]
);
const lifecycleUpdateCount = lifecycleEvents.filter((event) =>
  event.startsWith("plugin-lifecycle:update:")
).length;
await lifecycleEditor.dispatch({
  payload: "Renamed through facade plugin",
  type: "plugin.lifecycle.rename"
});
assert.equal(
  lifecycleEditor.getState().document.title,
  "Renamed through facade plugin"
);
assert.equal(
  lifecycleEvents.filter((event) =>
    event.startsWith("plugin-lifecycle:update:")
  ).length,
  lifecycleUpdateCount + 1
);
await lifecycleEditor.undo();
assert.equal(lifecycleEditor.getState().document.title, undefined);
await lifecycleEditor.redo();
assert.equal(
  lifecycleEditor.getState().document.title,
  "Renamed through facade plugin"
);

const commandConflictEditor = facadeModule.createEditor({
  document: lifecycleDocument
});
commandConflictEditor.registerCommand(
  pluginCommand("plugin.lifecycle.rename"),
  (_command, context) => ({
    document: {
      ...context.document,
      title: "host-command"
    }
  })
);
assert.throws(
  () => facadeModule.connectEditorToRuntime(commandConflictEditor, lifecycleCanvas),
  (error) =>
    error instanceof facadeModule.CanvasEditorError &&
    error.code === "invalid-command"
);
await commandConflictEditor.dispatch({
  payload: null,
  type: "plugin.lifecycle.rename"
});
assert.equal(commandConflictEditor.getState().document.title, "host-command");

const toolConflictEditor = facadeModule.createEditor({
  document: lifecycleDocument,
  tools: [
    {
      id: "plugin.lifecycle.tool.inspect",
      label: "Host Inspect"
    }
  ]
});
assert.throws(
  () => facadeModule.connectEditorToRuntime(toolConflictEditor, lifecycleCanvas),
  (error) =>
    error instanceof facadeModule.CanvasEditorError &&
    error.code === "invalid-command"
);
assert.deepEqual(
  toolConflictEditor.getTools().map((tool) => tool.label),
  ["Host Inspect"]
);
await assert.rejects(
  toolConflictEditor.dispatch({
    payload: "partial registration must be gone",
    type: "plugin.lifecycle.rename"
  }),
  (error) =>
    error instanceof facadeModule.CanvasEditorError &&
    error.code === "unsupported-command"
);

disconnectLifecycleEditor();
disconnectLifecycleEditor();
assert.deepEqual(
  lifecycleEditor.getTools().map((tool) => tool.id),
  ["host-tool"]
);
await assert.rejects(
  lifecycleEditor.dispatch({
    payload: "after cleanup",
    type: "plugin.lifecycle.rename"
  }),
  (error) =>
    error instanceof facadeModule.CanvasEditorError &&
    error.code === "unsupported-command"
);

const destroyCleanupEditor = facadeModule.createEditor({
  document: lifecycleDocument
});
const disconnectDestroyCleanup = facadeModule.connectEditorToRuntime(
  destroyCleanupEditor,
  lifecycleCanvas
);
assert.deepEqual(
  destroyCleanupEditor.getTools().map((tool) => tool.id),
  ["plugin.lifecycle.tool.inspect", "plugin.lifecycle.tool.measure"]
);
lifecycleCanvas.destroy();
assert.deepEqual(destroyCleanupEditor.getTools(), []);
await assert.rejects(
  destroyCleanupEditor.dispatch({
    payload: null,
    type: "plugin.lifecycle.rename"
  }),
  (error) =>
    error instanceof facadeModule.CanvasEditorError &&
    error.code === "unsupported-command"
);
disconnectDestroyCleanup();
assert.throws(
  () =>
    facadeModule.connectEditorToRuntime(
      facadeModule.createEditor({ document: lifecycleDocument }),
      lifecycleCanvas
    ),
  (error) =>
    error instanceof facadeModule.CanvasPluginError &&
    error.code === "runtime-destroyed"
);

const invalidCommandCanvas = facadeModule.createCanvas(customTarget, {
  document: lifecycleDocument,
  plugins: [
    facadeModule.defineCanvasPlugin({
      name: "invalid-command-type",
      setup(context) {
        context.registerCommand(
          {
            parsePayload: (payload) => payload,
            type: "node.update"
          },
          (_command, commandContext) => ({
            document: commandContext.document
          })
        );
      }
    })
  ],
  renderer: createLifecycleRendererAdapter("invalid-command-type")
});
await assert.rejects(
  invalidCommandCanvas.ready,
  (error) =>
    error instanceof facadeModule.CanvasPluginError &&
    error.code === "invalid-command" &&
    error.pluginName === "invalid-command-type"
);
invalidCommandCanvas.destroy();

const invalidCommandParserCanvas = facadeModule.createCanvas(customTarget, {
  document: lifecycleDocument,
  plugins: [
    facadeModule.defineCanvasPlugin({
      name: "invalid-command-parser",
      setup(context) {
        context.registerCommand(
          { parsePayload: null, type: "plugin.invalid.command" },
          (_command, commandContext) => ({
            document: commandContext.document
          })
        );
      }
    })
  ],
  renderer: createLifecycleRendererAdapter("invalid-command-parser")
});
await assert.rejects(
  invalidCommandParserCanvas.ready,
  (error) =>
    error instanceof facadeModule.CanvasPluginError &&
    error.code === "invalid-command" &&
    error.pluginName === "invalid-command-parser"
);
invalidCommandParserCanvas.destroy();

const mutableFacadeCommandDescriptor = pluginCommand(
  "plugin.mutable.command.rename",
  (payload) => payload
);
const mutableCommandCanvas = facadeModule.createCanvas(customTarget, {
  document: lifecycleDocument,
  plugins: [
    facadeModule.defineCanvasPlugin({
      name: "mutable-command",
      setup(context) {
        context.registerCommand(
          mutableFacadeCommandDescriptor,
          (command, commandContext) => ({
            document: { ...commandContext.document, title: command.payload }
          })
        );
      }
    })
  ],
  renderer: createLifecycleRendererAdapter("mutable-command")
});
await mutableCommandCanvas.ready;
mutableFacadeCommandDescriptor.type = "node.update";
mutableFacadeCommandDescriptor.parsePayload = () => {
  throw new Error("mutated parser must not replace the registered snapshot");
};
const mutableCommandEditor = facadeModule.createEditor({
  document: lifecycleDocument
});
const disconnectMutableCommand = facadeModule.connectEditorToRuntime(
  mutableCommandEditor,
  mutableCommandCanvas
);
await mutableCommandEditor.dispatch({
  payload: "snapshot-title",
  type: "plugin.mutable.command.rename"
});
assert.equal(mutableCommandEditor.getState().document.title, "snapshot-title");
disconnectMutableCommand();
await assert.rejects(
  mutableCommandEditor.dispatch({
    payload: "detached",
    type: "plugin.mutable.command.rename"
  }),
  (error) =>
    error instanceof facadeModule.CanvasEditorError &&
    error.code === "unsupported-command"
);
mutableCommandCanvas.destroy();

const mutableDirectCommandDescriptor = pluginCommand(
  "plugin.mutable.direct",
  (payload) => payload
);
const mutableDirectCommandEditor = facadeModule.createEditor({
  document: lifecycleDocument
});
const unregisterMutableDirectCommand = mutableDirectCommandEditor.registerCommand(
  mutableDirectCommandDescriptor,
  (command, commandContext) => ({
    document: { ...commandContext.document, title: command.payload }
  })
);
mutableDirectCommandDescriptor.type = "plugin.mutable.changed";
mutableDirectCommandDescriptor.parsePayload = () => {
  throw new Error("direct parser mutation must not affect registration");
};
await mutableDirectCommandEditor.dispatch({
  payload: "direct-snapshot",
  type: "plugin.mutable.direct"
});
assert.equal(
  mutableDirectCommandEditor.getState().document.title,
  "direct-snapshot"
);
unregisterMutableDirectCommand();
await assert.rejects(
  mutableDirectCommandEditor.dispatch({
    payload: "removed",
    type: "plugin.mutable.direct"
  }),
  (error) =>
    error instanceof facadeModule.CanvasEditorError &&
    error.code === "unsupported-command"
);

const duplicateCommandCanvas = facadeModule.createCanvas(customTarget, {
  document: lifecycleDocument,
  plugins: [
    facadeModule.defineCanvasPlugin({
      name: "duplicate-command-a",
      setup(context) {
        context.registerCommand(
          pluginCommand("plugin.duplicate"),
          (_command, commandContext) => ({
            document: commandContext.document
          })
        );
      }
    }),
    facadeModule.defineCanvasPlugin({
      name: "duplicate-command-b",
      setup(context) {
        context.registerCommand(
          pluginCommand("plugin.duplicate"),
          (_command, commandContext) => ({
            document: commandContext.document
          })
        );
      }
    })
  ],
  renderer: createLifecycleRendererAdapter("duplicate-command")
});
await assert.rejects(
  duplicateCommandCanvas.ready,
  (error) =>
    error instanceof facadeModule.CanvasPluginError &&
    error.code === "duplicate-command" &&
    error.pluginName === "duplicate-command-b"
);
duplicateCommandCanvas.destroy();

const duplicateToolCanvas = facadeModule.createCanvas(customTarget, {
  document: lifecycleDocument,
  plugins: [
    facadeModule.defineCanvasPlugin({
      name: "duplicate-tool-a",
      tools: [
        { id: "plugin.duplicate.tool.shared", label: "Duplicate A" }
      ]
    }),
    facadeModule.defineCanvasPlugin({
      name: "duplicate-tool-b",
      tools: [
        { id: "plugin.duplicate.tool.shared", label: "Duplicate B" }
      ]
    })
  ],
  renderer: createLifecycleRendererAdapter("duplicate-tool")
});
await assert.rejects(
  duplicateToolCanvas.ready,
  (error) =>
    error instanceof facadeModule.CanvasPluginError &&
    error.code === "duplicate-tool" &&
    error.pluginName === "duplicate-tool-b"
);
duplicateToolCanvas.destroy();

const invalidToolCanvas = facadeModule.createCanvas(customTarget, {
  document: lifecycleDocument,
  plugins: [
    facadeModule.defineCanvasPlugin({
      name: "invalid-tool-id",
      tools: [{ id: "unscoped-tool", label: "Invalid Tool" }]
    })
  ],
  renderer: createLifecycleRendererAdapter("invalid-tool-id")
});
await assert.rejects(
  invalidToolCanvas.ready,
  (error) =>
    error instanceof facadeModule.CanvasPluginError &&
    error.code === "invalid-tool" &&
    error.pluginName === "invalid-tool-id"
);
invalidToolCanvas.destroy();

const invalidToolContractCanvas = facadeModule.createCanvas(customTarget, {
  document: lifecycleDocument,
  plugins: [
    facadeModule.defineCanvasPlugin({
      name: "invalid-tool-contract",
      tools: [
        {
          id: "plugin.invalid.tool.navigation",
          label: "Invalid Navigation",
          navigation: "sometimes"
        }
      ]
    })
  ],
  renderer: createLifecycleRendererAdapter("invalid-tool-contract")
});
await assert.rejects(
  invalidToolContractCanvas.ready,
  (error) =>
    error instanceof facadeModule.CanvasPluginError &&
    error.code === "invalid-tool" &&
    error.pluginName === "invalid-tool-contract"
);
invalidToolContractCanvas.destroy();

const mutablePluginTool = {
  id: "plugin.mutable.tool.inspect",
  label: "Mutable Plugin Tool"
};
const mutableToolCanvas = facadeModule.createCanvas(customTarget, {
  document: lifecycleDocument,
  plugins: [
    facadeModule.defineCanvasPlugin({
      name: "mutable-tool",
      tools: [mutablePluginTool]
    })
  ],
  renderer: createLifecycleRendererAdapter("mutable-tool")
});
await mutableToolCanvas.ready;
mutablePluginTool.id = "plugin.mutable.tool.changed-before-connect";
const mutableToolEditor = facadeModule.createEditor({ document: lifecycleDocument });
const disconnectMutableTool = facadeModule.connectEditorToRuntime(
  mutableToolEditor,
  mutableToolCanvas
);
assert.deepEqual(
  mutableToolEditor.getTools().map((tool) => tool.id),
  ["plugin.mutable.tool.inspect"]
);
mutablePluginTool.id = "plugin.mutable.tool.changed-after-connect";
disconnectMutableTool();
assert.deepEqual(mutableToolEditor.getTools(), []);
mutableToolCanvas.destroy();

const mutableHostTool = { id: "mutable-host-tool", label: "Mutable Host Tool" };
const mutableHostEditor = facadeModule.createEditor({ document: lifecycleDocument });
const unregisterMutableHostTool = mutableHostEditor.registerTool(mutableHostTool);
mutableHostTool.id = "mutated-host-tool";
unregisterMutableHostTool();
assert.deepEqual(mutableHostEditor.getTools(), []);

const setupOrderEvents = [];
const setupOrderCanvas = facadeModule.createCanvas(customTarget, {
  document: lifecycleDocument,
  plugins: [
    facadeModule.defineCanvasPlugin({
      name: "setup-order-a",
      async setup() {
        setupOrderEvents.push("a:start");
        await Promise.resolve();
        setupOrderEvents.push("a:end");
      }
    }),
    facadeModule.defineCanvasPlugin({
      name: "setup-order-b",
      setup() {
        setupOrderEvents.push("b:start");
        setupOrderEvents.push("b:end");
      }
    })
  ],
  renderer: createLifecycleRendererAdapter("setup-order")
});
await setupOrderCanvas.ready;
assert.deepEqual(setupOrderEvents, ["a:start", "a:end", "b:start", "b:end"]);
setupOrderCanvas.destroy();

const setupFailureCanvas = facadeModule.createCanvas(customTarget, {
  document: lifecycleDocument,
  plugins: [
    facadeModule.defineCanvasPlugin({
      name: "setup-failure",
      setup(context) {
        context.registerCommand(
          pluginCommand("plugin.setup-failure"),
          (_command, commandContext) => ({
            document: commandContext.document
          })
        );
        context.registerTool({
          id: "plugin.setup-failure.tool.failure",
          label: "Failure Tool"
        });
        throw new Error("setup exploded");
      }
    })
  ],
  renderer: createLifecycleRendererAdapter("setup-failure")
});
const setupFailureEditor = facadeModule.createEditor({
  document: lifecycleDocument,
  tools: [{ id: "setup-failure-host", label: "Failure Host" }]
});
setupFailureEditor.registerCommand(
  pluginCommand("plugin.host-stays"),
  (_command, context) => ({
    document: {
      ...context.document,
      title: "host-stayed"
    }
  })
);
const setupFailureHistory = setupFailureEditor.getState().history;
const disconnectSetupFailure = facadeModule.connectEditorToRuntime(
  setupFailureEditor,
  setupFailureCanvas
);
await assert.rejects(
  setupFailureCanvas.ready,
  (error) =>
    error instanceof facadeModule.CanvasPluginError &&
    error.code === "setup-failed" &&
    error.pluginName === "setup-failure" &&
    error.cause instanceof Error
);
assert.deepEqual(
  setupFailureEditor.getTools().map((tool) => tool.id),
  ["setup-failure-host"]
);
assert.deepEqual(setupFailureEditor.getState().history, setupFailureHistory);
await assert.rejects(
  setupFailureEditor.dispatch({
    payload: null,
    type: "plugin.setup-failure"
  }),
  (error) =>
    error instanceof facadeModule.CanvasEditorError &&
    error.code === "unsupported-command"
);
await setupFailureEditor.dispatch({
  payload: null,
  type: "plugin.host-stays"
});
assert.equal(setupFailureEditor.getState().document.title, "host-stayed");
disconnectSetupFailure();
setupFailureCanvas.destroy();

let releaseLateSetup;
const lateSetupGate = new Promise((resolve) => {
  releaseLateSetup = resolve;
});
const lateSetupCanvas = facadeModule.createCanvas(customTarget, {
  document: lifecycleDocument,
  plugins: [
    facadeModule.defineCanvasPlugin({
      name: "late-setup",
      async setup(context) {
        await lateSetupGate;
        context.registerCommand(
          pluginCommand("plugin.late"),
          (_command, commandContext) => ({
            document: commandContext.document
          })
        );
        context.registerTool({
          id: "plugin.late-setup.tool.late",
          label: "Late Tool"
        });
      }
    })
  ],
  renderer: createLifecycleRendererAdapter("late-setup")
});
const lateSetupEditor = facadeModule.createEditor({ document: lifecycleDocument });
const disconnectLateSetup = facadeModule.connectEditorToRuntime(
  lateSetupEditor,
  lateSetupCanvas
);
lateSetupCanvas.destroy();
releaseLateSetup();
await lateSetupCanvas.ready;
assert.deepEqual(lateSetupEditor.getTools(), []);
await assert.rejects(
  lateSetupEditor.dispatch({ payload: null, type: "plugin.late" }),
  (error) =>
    error instanceof facadeModule.CanvasEditorError &&
    error.code === "unsupported-command"
);
disconnectLateSetup();

const tmpDir = path.join(root, ".tmp", "public-api-contract");
rmSync(tmpDir, {
  force: true,
  recursive: true
});
mkdirSync(tmpDir, {
  recursive: true
});

writeFileSync(
  path.join(tmpDir, "smoke.ts"),
  `import {
  createCanvas,
  createCanvas2D,
  createCanvas3D,
  create2DShapeTool,
  create3DPrimitiveTool,
  create3DSurfacePlacementTool,
  createAnnotationTool,
  createConnectorTool,
  createDistanceMeasurementTool,
  createEditor,
  createRelationGraphLayoutAdapter,
  createTimeGraphLayoutAdapter,
  applyCommandsToDocument,
  applyCommandsToStoredDocument,
  addLayer,
  applyNamedOperations,
  listLayers,
  listNodes,
  reorderLayer,
  setFieldPattern,
  setSparklineStyle,
  setLayerLocked,
  setLayerName,
  setLayerVisible,
  setNodeLayer,
  setNodeLocked,
  setNodeVisible,
  setText,
  removeNode,
  removeEdge,
  removeLayer,
  stackBox,
  denovoFieldInstanceCount,
  isDenovoFieldNode,
  isDenovoFieldType,
  parseDenovoFieldProps,
  denovoSparklinePoints,
  denovoSparklineSize,
  isDenovoSparklineNode,
  isDenovoSparklineType,
  parseDenovoSparklineProps,
  DENOVO_SPARKLINE_NODE_TYPE,
  createGroupNodesCommand,
  createNodeUpdateCommand,
  CanvasPluginError,
  connectCanvasToolInput,
  connectEditorToCanvas,
  connectEditorToRuntime,
  defineCanvasConfig,
  defineCanvasPlugin,
  definePluginCommand,
  definePluginNodeKind,
  getPluginNodeKind,
  isCanvas2DPluginNode,
  isPluginNodeType,
  parsePluginNodeProps,
  pluginNodeKindSupportsMode,
  registerPluginNodeKind,
  define2DEdge,
  DENOVO_FIELD_NODE_TYPE,
  defineDocument,
  defineMeshGeometry,
  decodeMeshGeometry,
  encodeMeshGeometry,
  hydrateCanvasGeometryStore,
  persistCanvasGeometryStore,
  createMemoryGeometryStore,
  createMeshGeometryAssetRef,
  resolveCanvasMeshGeometry,
  defineHitResult,
  defineHitTestInput,
  defineScene,
  defineToolInput,
  createPanOrbitTool,
  createSelectTool,
  createTransformTool,
  defineCanvas2DViewState,
  type AssetRecord,
  type CanvasStorageAdapter,
  type CanvasBackend,
  type CanvasImplementedBackend,
  type CanvasResolvedBackend,
  type CanvasUnimplementedBackend,
  type Canvas2DSceneInput,
  type Canvas3DSceneInput,
  type Canvas3DSurfacePointRequest,
  type Canvas3DSurfacePointRuntime,
  type Canvas2DOptions,
  type Canvas2DViewState,
  type CanvasCameraControlsOptions,
  type CanvasCommand,
  type CanvasCreateId,
  type CanvasFacadeRendererAdapter,
  type CanvasFacadeRendererRuntime,
  type CanvasEditor,
  type CanvasPersistenceEvent,
  type ListedLayer,
  type ListedNode,
  type ListNodesOptions,
  type AddLayerInput,
  type ReorderLayerInput,
  type NamedOperation,
  type NamedOperationResult,
  type RelationGraphLayoutOptions,
  type TimeGraphLayoutOptions,
  type DenovoFieldPattern,
  type DenovoFieldProps,
  type DenovoSparklineProps,
  type DenovoSparklineStyle,
  type SetFieldPatternInput,
  type SetSparklineStyleInput,
  type SetLayerLockedInput,
  type SetLayerNameInput,
  type SetLayerVisibleInput,
  type SetNodeLayerInput,
  type SetTextInput,
  type RemoveEdgeInput,
  type RemoveLayerInput,
  type RemoveNodeInput,
  type SetNodeLockedInput,
  type SetNodeVisibleInput,
  type StackBoxFace,
  type StackBoxInput,
  type CanvasStoredDocument,
  type CanvasHitResult,
  type CanvasHitTestInput,
  type CanvasNavigationInputRuntime,
  type CanvasNodeByType,
  type CanvasNodeIdentity,
  type CanvasNodePatch,
  type Canvas2DPluginNode,
  type Canvas3DPluginNode,
  type PluginNodeKindMode,
  type PluginNodeType,
  type PluginSceneMode,
  type CanvasPluginToolId,
  type SelectionStateInput,
  type CanvasTarget,
  type CanvasToolNavigationPolicy,
  type CanvasToolInput,
  type DenovoCanvasConfig,
  type DynamicCanvasRuntime,
  type WebCanvasRuntime
} from "${facadeName}";
import { CanvasView, type CanvasStage3DProps } from "${facadeName}/react";
import { parseSceneEffect } from "@denovo/canvas-core/effect";

const backend: CanvasBackend = "auto";
const implementedBackend: CanvasImplementedBackend = "webgl2";
const reservedBackend: CanvasUnimplementedBackend = "offscreen-canvas2d";
const resolvedBackend: CanvasResolvedBackend = "canvas2d";
const resolvedWebgpu: CanvasResolvedBackend = "webgpu";
// @ts-expect-error auto still does not resolve to WebGPU
const invalidImplementedWebgpu: CanvasImplementedBackend = "webgpu";
// @ts-expect-error auto is a selector, not a resolved backend.
const invalidResolvedAuto: CanvasResolvedBackend = "auto";
void implementedBackend;
void reservedBackend;
void resolvedBackend;
void resolvedWebgpu;
void invalidImplementedWebgpu;
void invalidResolvedAuto;
const controls: CanvasCameraControlsOptions = {
  enablePan: true,
  enableRotate: true,
  enableZoom: true,
  maxDistance: 20,
  minDistance: 1
};
const scene = defineScene({
  id: "public-api-scene",
  layers: [{ id: "main", name: "Main" }],
  mode: "3d",
  nodes: []
});
const document = defineDocument({
  id: "public-api-document",
  scene
});
const editor: CanvasEditor = createEditor({ document });
const hideLayerInput: SetLayerVisibleInput = {
  layerId: "main",
  visible: false
};
const hideLayer: NamedOperation = setLayerVisible(hideLayerInput);
const namedPreview: NamedOperationResult = applyNamedOperations(document, [
  hideLayer
]);
const namedChanged: boolean = namedPreview.changed;
const namedCommand = namedPreview.commands[0];
if (!namedCommand || namedCommand.type !== "layer.update") {
  throw new Error("setLayerVisible must compile to layer.update");
}
const namedCommandType: "layer.update" = namedCommand.type;
void namedChanged;
void namedCommandType;
const namedApply = editor.apply([hideLayer]);
void namedApply;
// @ts-expect-error extra fields are rejected
setLayerVisible({ layerId: "main", visible: false, extra: true });
// @ts-expect-error visible must be boolean
setLayerVisible({ layerId: "main", visible: "false" });
const lockLayerInput: SetLayerLockedInput = {
  layerId: "main",
  locked: true
};
const lockLayer: NamedOperation = setLayerLocked(lockLayerInput);
void lockLayer;
// @ts-expect-error extra fields are rejected
setLayerLocked({ extra: true, layerId: "main", locked: true });
// @ts-expect-error locked must be boolean
setLayerLocked({ layerId: "main", locked: "true" });
const renameLayerInput: SetLayerNameInput = {
  layerId: "main",
  name: "Notes"
};
const renameLayer: NamedOperation = setLayerName(renameLayerInput);
void renameLayer;
// @ts-expect-error extra fields are rejected
setLayerName({ extra: true, layerId: "main", name: "Notes" });
// @ts-expect-error name must be a string
setLayerName({ layerId: "main", name: 1 });
const moveNodeInput: SetNodeLayerInput = {
  layerId: "main",
  nodeId: "box-1"
};
const moveNode: NamedOperation = setNodeLayer(moveNodeInput);
void moveNode;
// @ts-expect-error extra fields are rejected
setNodeLayer({ extra: true, layerId: "main", nodeId: "box-1" });
// @ts-expect-error layerId must be a string
setNodeLayer({ layerId: 1, nodeId: "box-1" });
const renameTextInput: SetTextInput = {
  nodeId: "label",
  text: "Done"
};
const renameText: NamedOperation = setText(renameTextInput);
void renameText;
// @ts-expect-error extra fields are rejected
setText({ extra: true, nodeId: "label", text: "Done" });
// @ts-expect-error text must be a string
setText({ nodeId: "label", text: 1 });
const hideNodeInput: SetNodeVisibleInput = {
  nodeId: "box-1",
  visible: false
};
const hideNode: NamedOperation = setNodeVisible(hideNodeInput);
void hideNode;
const lockNodeInput: SetNodeLockedInput = {
  locked: true,
  nodeId: "box-1"
};
const lockNode: NamedOperation = setNodeLocked(lockNodeInput);
void lockNode;
// @ts-expect-error extra fields are rejected
setNodeVisible({ extra: true, nodeId: "box-1", visible: false });
// @ts-expect-error visible must be boolean
setNodeVisible({ nodeId: "box-1", visible: "false" });
// @ts-expect-error extra fields are rejected
setNodeLocked({ extra: true, locked: true, nodeId: "box-1" });
// @ts-expect-error locked must be boolean
setNodeLocked({ locked: "true", nodeId: "box-1" });
const removeNodeInput: RemoveNodeInput = { nodeId: "box-1" };
const dropNode: NamedOperation = removeNode(removeNodeInput);
void dropNode;
// @ts-expect-error extra fields are rejected
removeNode({ extra: true, nodeId: "box-1" });
// @ts-expect-error nodeId must be a string
removeNode({ nodeId: 1 });
const removeEdgeInput: RemoveEdgeInput = { nodeId: "edge-1" };
const dropEdge: NamedOperation = removeEdge(removeEdgeInput);
void dropEdge;
// @ts-expect-error extra fields are rejected
removeEdge({ extra: true, nodeId: "edge-1" });
// @ts-expect-error nodeId must be a string
removeEdge({ nodeId: 1 });
const removeLayerInput: RemoveLayerInput = {
  layerId: "extra",
  targetLayerId: null
};
const dropLayer: NamedOperation = removeLayer(removeLayerInput);
void dropLayer;
// @ts-expect-error extra fields are rejected
removeLayer({ extra: true, layerId: "extra", targetLayerId: null });
// @ts-expect-error targetLayerId is required
removeLayer({ layerId: "extra" });
// @ts-expect-error targetLayerId must be a layer id or null
removeLayer({ layerId: "extra", targetLayerId: 1 });
const addLayerInput: AddLayerInput = {
  layerId: "notes",
  name: "Notes"
};
const insertLayer: NamedOperation = addLayer(addLayerInput);
void insertLayer;
// @ts-expect-error extra fields are rejected
addLayer({ extra: true, layerId: "notes", name: "Notes" });
// @ts-expect-error name is required
addLayer({ layerId: "notes" });
// @ts-expect-error index must be a number
addLayer({ index: "0", layerId: "notes", name: "Notes" });
const reorderLayerInput: ReorderLayerInput = {
  index: 0,
  layerId: "extra"
};
const moveLayer: NamedOperation = reorderLayer(reorderLayerInput);
void moveLayer;
// @ts-expect-error extra fields are rejected
reorderLayer({ extra: true, index: 0, layerId: "extra" });
// @ts-expect-error index is required
reorderLayer({ layerId: "extra" });
// @ts-expect-error index must be a number
reorderLayer({ index: "0", layerId: "extra" });
const stackInput: StackBoxInput = {
  createId: () => "stacked-box",
  face: "+y",
  on: "box-1"
};
const stackFace: StackBoxFace = stackInput.face;
const stackOp: NamedOperation = stackBox(stackInput);
void stackFace;
void stackOp;
// @ts-expect-error extra fields are rejected
stackBox({ createId: () => "stacked-box", extra: true, face: "+y", on: "box-1" });
// @ts-expect-error face is a closed axis union
stackBox({ createId: () => "stacked-box", face: "+w", on: "box-1" });
const listed: readonly ListedNode[] = listNodes(document);
const listedOptions: ListNodesOptions = { layerId: "main" };
void listed;
void listNodes(document, listedOptions);
declare const listedNode: ListedNode;
const listedVisible: boolean = listedNode.visible;
const listedLocked: boolean = listedNode.locked;
void listedVisible;
void listedLocked;
// @ts-expect-error listed nodes omit geometry arrays
listedNode.positions;
// @ts-expect-error extra fields are rejected
listNodes(document, { extra: true, layerId: "main" });
const listedLayers: readonly ListedLayer[] = listLayers(document);
declare const listedLayer: ListedLayer;
const listedLayerName: string = listedLayer.name;
void listedLayers;
void listedLayerName;
// @ts-expect-error listed layers omit metadata
listedLayer.metadata;
// @ts-expect-error listLayers does not take a filter
listLayers(document, { extra: true });
const timeLayoutOptions: TimeGraphLayoutOptions = {
  columnGap: 88,
  origin: [80, 160]
};
const relationLayoutOptions: RelationGraphLayoutOptions = {
  layerGap: 220,
  laneGap: 110
};
const timeLayout = createTimeGraphLayoutAdapter(timeLayoutOptions);
const relationLayout = createRelationGraphLayoutAdapter(relationLayoutOptions);
void timeLayout.name;
void relationLayout.name;
// @ts-expect-error columnGap is a finite number
createTimeGraphLayoutAdapter({ columnGap: "wide" });
// @ts-expect-error extra fields are rejected
createRelationGraphLayoutAdapter({ extra: true, layerGap: 80 });
const selectTool = createSelectTool();
const navigationTool = createPanOrbitTool();
const transformTool = createTransformTool();
const navigationPolicy: CanvasToolNavigationPolicy = navigationTool.navigation ?? "allow";
const toolEditor: CanvasEditor = createEditor({
  activeToolId: selectTool.id,
  document,
  tools: [selectTool, transformTool]
});
const toolInput: CanvasToolInput = defineToolInput({
  altKey: false,
  code: "Escape",
  ctrlKey: false,
  key: "Escape",
  metaKey: false,
  repeat: false,
  shiftKey: false,
  type: "key.down"
});
const toolHandled = toolEditor.handleToolInput(toolInput);
const cancelledToolSession = toolEditor.cancelActiveToolSession();
const activeTool = toolEditor.activateTool("select");
const hitInput: CanvasHitTestInput = defineHitTestInput({ point: [12, 24] });
const hit: CanvasHitResult = defineHitResult({
  kind: "node",
  nodeId: "typed-box",
  renderer: "three"
});
const disconnectEditor = connectEditorToRuntime(editor, {
  update(nextScene) {
    void nextScene;
  }
});
const editorUpdate = editor.dispatch({
  nodeMode: "3d",
  nodeId: "typed-box",
  nodeType: "box",
  patch: {
    position: [1, 2, 3]
  },
  type: "node.update"
});
// @ts-expect-error serialized node updates require source mode and node type.
editor.dispatch({ nodeId: "typed-box", patch: { color: "#ffffff" }, type: "node.update" });
const invalidRawRectUpdate: CanvasCommand = {
  nodeId: "typed-rect",
  nodeMode: "2d",
  nodeType: "rect",
  // @ts-expect-error Raw rect commands reject circle-only radius patches.
  patch: { radius: 4 },
  type: "node.update"
};
const invalidRawEmptyUpdate: CanvasCommand = {
  nodeId: "typed-rect",
  nodeMode: "2d",
  nodeType: "rect",
  // @ts-expect-error Raw node updates require a non-empty patch.
  patch: {},
  type: "node.update"
};
const typedPatch: CanvasNodePatch = {
  color: "#ffffff",
  position: [1, 2, 3]
};
const initialSelection: SelectionStateInput = {
  ids: ["typed-box"],
  primaryId: "typed-box"
};
// @ts-expect-error built-in node patches reject unknown fields.
const invalidPatch: CanvasNodePatch = { arbitraryField: true };
// @ts-expect-error built-in node patch values retain their field types.
const invalidPositionPatch: CanvasNodePatch = { position: "1,2,3" };
// @ts-expect-error selection inputs expose their actual field types.
const invalidSelection: SelectionStateInput = { primaryId: 42 };

const pluginType: PluginNodeType = "plugin.denovo.field";
const pluginIsKind: boolean = isPluginNodeType(pluginType);
void pluginIsKind;
// @ts-expect-error plugin type needs owner.kind
const invalidPluginType: PluginNodeType = "plugin.field";
void invalidPluginType;
const pluginNode: Canvas3DPluginNode = {
  id: "field",
  layerId: "main",
  locked: false,
  metadata: {},
  parentId: null,
  position: [0, 0, 0],
  props: { pattern: "streaks", speed: 15 },
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  type: "plugin.denovo.field",
  visible: true
};
const pluginNodeType: PluginNodeType = pluginNode.type;
void pluginNodeType;
const pluginNode2d: Canvas2DPluginNode = {
  id: "card",
  layerId: "main",
  locked: false,
  metadata: {},
  parentId: null,
  position: [0, 0],
  props: { label: "hero" },
  rotation: 0,
  scale: [1, 1],
  type: "plugin.test.card",
  visible: true
};
const pluginNode2dType: PluginNodeType = pluginNode2d.type;
void pluginNode2dType;
const invalidPlugin2dRotation: Canvas2DPluginNode = {
  ...pluginNode2d,
  // @ts-expect-error 2D plugin nodes use a number rotation, not a 3D vector.
  rotation: [0, 0, 0]
};
void invalidPlugin2dRotation;
const fieldProps: DenovoFieldProps = {
  brightness: 1,
  density: 0.6,
  hue: 0,
  pattern: "streaks",
  speed: 15
};
const fieldPattern: DenovoFieldPattern = fieldProps.pattern;
void fieldPattern;
void denovoFieldInstanceCount(fieldProps.density);
void isDenovoFieldType(DENOVO_FIELD_NODE_TYPE);
void isDenovoFieldNode({ props: fieldProps, type: "plugin.denovo.field" });
void parseDenovoFieldProps(fieldProps);
// @ts-expect-error field pattern is a closed union
const invalidFieldPattern: DenovoFieldProps = { ...fieldProps, pattern: "wave" };
void invalidFieldPattern;
const fieldPatternInput: SetFieldPatternInput = {
  nodeId: "field",
  pattern: "letters"
};
const changePattern: NamedOperation = setFieldPattern(fieldPatternInput);
void changePattern;
// @ts-expect-error extra fields are rejected
setFieldPattern({ nodeId: "field", pattern: "letters", extra: true });
// @ts-expect-error pattern is a closed union
setFieldPattern({ nodeId: "field", pattern: "wave" });
const sparklineProps: DenovoSparklineProps = {
  fill: "none",
  height: 80,
  stroke: "#22c55e",
  style: "linear",
  values: [2, 8, 3, 12],
  width: 240
};
const sparklineStyle: DenovoSparklineStyle = sparklineProps.style;
void sparklineStyle;
void denovoSparklineSize(sparklineProps);
void denovoSparklinePoints(sparklineProps);
void isDenovoSparklineType(DENOVO_SPARKLINE_NODE_TYPE);
void isDenovoSparklineNode({
  props: sparklineProps,
  type: "plugin.denovo.sparkline"
});
void parseDenovoSparklineProps(sparklineProps);
// @ts-expect-error sparkline style is a closed union
const invalidSparklineStyle: DenovoSparklineProps = { ...sparklineProps, style: "spline" };
void invalidSparklineStyle;
const sparklineStyleInput: SetSparklineStyleInput = {
  nodeId: "spark",
  style: "step"
};
const changeSparkline: NamedOperation = setSparklineStyle(sparklineStyleInput);
void changeSparkline;
// @ts-expect-error extra fields are rejected
setSparklineStyle({ extra: true, nodeId: "spark", style: "step" });
// @ts-expect-error style is a closed union
setSparklineStyle({ nodeId: "spark", style: "spline" });
const pluginKindBoth: PluginNodeKindMode = "both";
const pluginScene3d: PluginSceneMode = "3d";
void pluginNodeKindSupportsMode(pluginKindBoth, pluginScene3d);
// @ts-expect-error plugin kind mode is 2d, 3d, or both
const invalidPluginKindMode: PluginNodeKindMode = "4d";
void invalidPluginKindMode;
void definePluginNodeKind;
void getPluginNodeKind;
void isCanvas2DPluginNode;
void parsePluginNodeProps;
void registerPluginNodeKind;
const typedRect: CanvasNodeByType<"2d", "rect"> = {
  fill: "#22c55e",
  id: "typed-rect",
  layerId: "main",
  locked: false,
  metadata: {},
  parentId: null,
  position: [0, 0],
  rotation: 0,
  scale: [1, 1],
  size: [40, 20],
  type: "rect",
  visible: true
};
const preciseRectUpdate = createNodeUpdateCommand(typedRect, {
  fill: "#ffffff",
  size: [80, 40]
});
const preciseRectIdentity: CanvasNodeIdentity = preciseRectUpdate;
const preciseRectMode: "2d" = preciseRectUpdate.nodeMode;
const preciseRectType: "rect" = preciseRectUpdate.nodeType;
// @ts-expect-error rect updates cannot use circle-only properties.
createNodeUpdateCommand(typedRect, { radius: 10 });
const typedMesh: CanvasNodeByType<"3d", "mesh"> = {
  color: "#9ca3af",
  id: "typed-mesh",
  indices: [0, 1, 2],
  layerId: "main",
  locked: false,
  metadata: {},
  parentId: null,
  position: [0, 0, 0],
  positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  type: "mesh",
  visible: true,
  wireframe: false
};
const preciseMeshUpdate = createNodeUpdateCommand(typedMesh, {
  position: [2, 3, 4]
});
const preciseMeshType: "mesh" = preciseMeshUpdate.nodeType;
const typedAssetMesh: CanvasNodeByType<"3d", "mesh"> = {
  color: "#9ca3af",
  geometryAssetId: "typed-mesh-geo",
  id: "typed-asset-mesh",
  layerId: "main",
  locked: false,
  metadata: {},
  parentId: null,
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  type: "mesh",
  visible: true,
  wireframe: false
};
const meshGeometry = defineMeshGeometry({
  schema: "denovo.mesh-geometry.v1",
  positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
  indices: [0, 1, 2]
});
const meshAsset = createMeshGeometryAssetRef("typed-mesh-geo", meshGeometry);
const geometryStore = createMemoryGeometryStore();
geometryStore.set(meshAsset.id, meshGeometry);
const resolvedMesh = resolveCanvasMeshGeometry(typedAssetMesh, geometryStore);
const geometryBytes = encodeMeshGeometry(meshGeometry);
const decodedGeometry = decodeMeshGeometry(geometryBytes);
void persistCanvasGeometryStore;
void hydrateCanvasGeometryStore;
declare const storageAdapter: CanvasStorageAdapter;
const loadedAsset: Promise<AssetRecord | null> | undefined =
  storageAdapter.loadAsset?.("typed-mesh-geo");
// @ts-expect-error asset ids are strings
void storageAdapter.loadAsset?.(12);
void applyCommandsToDocument;
void applyCommandsToStoredDocument;
void typedAssetMesh;
void meshAsset;
void resolvedMesh;
void decodedGeometry;
void loadedAsset;
const storedRevision: CanvasStoredDocument = {
  document,
  revision: 0
};
const persistedHistory: CanvasPersistenceEvent = {
  action: "redo",
  documentId: "public-api-document",
  revision: 2,
  type: "history.changed"
};
const persistedAction: "undo" | "redo" =
  persistedHistory.type === "history.changed"
    ? persistedHistory.action
    : "undo";
void storedRevision;
void persistedAction;
const invalidPersistedHistory: CanvasPersistenceEvent = {
  // @ts-expect-error history.changed actions are undo or redo only.
  action: "reset",
  documentId: "public-api-document",
  revision: 2,
  type: "history.changed"
};
void invalidPersistedHistory;
void preciseMeshType;
// @ts-expect-error mesh updates cannot use 2D-only size patches.
createNodeUpdateCommand(typedMesh, { size: [10, 10] });
const writtenEdge = define2DEdge({
  id: "typed-edge",
  layerId: "main",
  sourceId: "typed-rect",
  targetId: "typed-rect",
  routing: "orthogonal",
  type: "edge"
});
const writtenRouting: "straight" | "orthogonal" = writtenEdge.routing === "curved"
  ? "straight"
  : writtenEdge.routing;
void writtenRouting;
define2DEdge({
  id: "bad-edge",
  layerId: "main",
  // @ts-expect-error new edge writes cannot use routing curved.
  routing: "curved",
  sourceId: "typed-rect",
  targetId: "typed-rect",
  type: "edge"
});
// @ts-expect-error update identities correlate node mode and type.
const invalidNodeIdentity: CanvasNodeIdentity = { nodeMode: "2d", nodeType: "box" };

const createId: CanvasCreateId = ({ mode, type }) =>
  "typed-" + mode + "-" + type;
const rectAuthoringTool = create2DShapeTool({
  createId,
  grid: { mode: "2d", origin: [0, 0], spacing: [10, 10] },
  id: "plugin.public-api.tool.rect",
  layerId: "main",
  mode: "2d",
  type: "rect"
});
const sphereAuthoringTool = create3DPrimitiveTool({
  createId,
  grid: {
    axisU: [1, 0, 0],
    axisV: [0, 0, 1],
    mode: "3d",
    origin: [0, 0, 0],
    spacing: [1, 1]
  },
  id: "plugin.public-api.tool.sphere",
  layerId: "main",
  mode: "3d",
  radius: 2,
  type: "sphere",
  workPlane: { constant: 0, normal: [0, 1, 0] }
});
const surfacePlacementTool = create3DSurfacePlacementTool({
  color: "#60a5fa",
  createId,
  id: "plugin.public-api.tool.surface-box",
  layerId: "main",
  mode: "3d",
  placement: { kind: "box-face", orientation: "world-aligned" },
  scale: [0.65, 0.65, 0.65],
  type: "box"
});
const surfacePlacementToolId: "plugin.public-api.tool.surface-box" =
  surfacePlacementTool.id;
const surfacePointRequest: Canvas3DSurfacePointRequest = {
  mode: "3d",
  target: { kind: "node", nodeType: "box" },
  viewportPoint: [12, 24]
};
const typedSurfacePointRuntime: Canvas3DSurfacePointRuntime = {
  resolveSurfacePoint(request) {
    const point: readonly [number, number] = request.viewportPoint;
    void point;
    return { kind: "miss", mode: "3d" };
  }
};
async function inspectSurfacePoint(): Promise<void> {
  const result = await typedSurfacePointRuntime.resolveSurfacePoint(
    surfacePointRequest
  );

  if (result.kind === "hit") {
    if (result.nodeType === "mesh") {
      // Mesh hits correlate a triangle index instead of a box face.
      const triangleIndex: number = result.feature.triangleIndex;
      void triangleIndex;
      return;
    }

    if (result.nodeType === "instances") {
      // Instance hits correlate which copy was hit.
      const instanceIndex: number = result.feature.instanceIndex;
      void instanceIndex;
      return;
    }

    const axis: "x" | "y" | "z" = result.feature.axis;
    const side: -1 | 1 = result.feature.side;
    const normal: readonly [number, number, number] = result.normal;
    void axis;
    void side;
    void normal;
  } else {
    const missMode: "3d" = result.mode;
    void missMode;
  }
}
void surfacePlacementToolId;
void inspectSurfacePoint;
const meshSurfaceRequest: Canvas3DSurfacePointRequest = {
  mode: "3d",
  target: { kind: "node", nodeType: "mesh" },
  viewportPoint: [320, 240]
};
const meshSurfaceNode: Canvas3DSurfacePointRequest["target"]["nodeType"] =
  meshSurfaceRequest.target.nodeType;
void meshSurfaceNode;
const measurementAuthoringTool = createDistanceMeasurementTool({
  createId,
  id: "plugin.public-api.tool.measurement",
  layerId: "main",
  mode: "2d",
  precision: 2,
  type: "measurement",
  unit: { metersPerUnit: 1, name: "pixel", symbol: "px" }
});
const annotationAuthoringTool = createAnnotationTool({
  createId,
  id: "plugin.public-api.tool.annotation",
  layerId: "main",
  mode: "2d",
  provideDraft: ({ anchor }) => {
    const point: readonly [number, number] = anchor;
    void point;
    return { draft: { targetId: null, text: "Review" }, kind: "commit" };
  },
  type: "annotation"
});
const groupCommand = createGroupNodesCommand({
  document: defineDocument({
    id: "group-document",
    scene: {
      id: "group-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: [typedRect]
    }
  }),
  groupId: "typed-group",
  nodeIds: [typedRect.id]
});
// @ts-expect-error 2D tools reject 3D grids.
create2DShapeTool({ createId, grid: { axisU: [1, 0, 0], axisV: [0, 1, 0], mode: "3d", origin: [0, 0, 0], spacing: [1, 1] }, layerId: "main", mode: "2d", type: "rect" });
// @ts-expect-error box authoring options reject sphere-only radius.
create3DPrimitiveTool({ createId, layerId: "main", mode: "3d", radius: 2, type: "box", workPlane: { constant: 0, normal: [0, 1, 0] } });
// @ts-expect-error surface placement supports box sources only.
create3DSurfacePlacementTool({ createId, layerId: "main", mode: "3d", placement: { kind: "box-face", orientation: "world-aligned" }, type: "sphere" });
// @ts-expect-error surface placement has one explicit orientation policy.
create3DSurfacePlacementTool({ createId, layerId: "main", mode: "3d", placement: { kind: "box-face", orientation: "surface-normal" }, type: "box" });
// @ts-expect-error surface placement does not silently fall back to a work plane.
create3DSurfacePlacementTool({ createId, layerId: "main", mode: "3d", placement: { kind: "box-face", orientation: "world-aligned" }, type: "box", workPlane: { constant: 0, normal: [0, 1, 0] } });
// @ts-expect-error surface placement does not accept implicit source rotation.
create3DSurfacePlacementTool({ createId, layerId: "main", mode: "3d", placement: { kind: "box-face", orientation: "world-aligned" }, rotation: [0, 0, 0], type: "box" });

const publicApiPluginCommand = definePluginCommand({
  type: "plugin.public-api",
  parsePayload(payload) {
    if (typeof payload !== "string") {
      throw new TypeError("public-api payload must be a string");
    }

    return payload;
  }
});

const publicApiPluginToolId =
  "plugin.public-api.tool.inspect" as const satisfies CanvasPluginToolId;
const typedPluginTool = createSelectTool({ id: publicApiPluginToolId });
const typedPluginNavigationTool = createPanOrbitTool({
  id: "plugin.public-api.tool.navigation"
});
const typedPluginTransformTool = createTransformTool({
  id: "plugin.public-api.tool.transform"
});
const inferredPluginToolId: "plugin.public-api.tool.inspect" =
  typedPluginTool.id;
const inferredPluginNavigationToolId: "plugin.public-api.tool.navigation" =
  typedPluginNavigationTool.id;
const inferredPluginTransformToolId: "plugin.public-api.tool.transform" =
  typedPluginTransformTool.id;
const inferredPluginRectToolId: "plugin.public-api.tool.rect" =
  rectAuthoringTool.id;
const inferredPluginSphereToolId: "plugin.public-api.tool.sphere" =
  sphereAuthoringTool.id;
const inferredPluginMeasurementToolId: "plugin.public-api.tool.measurement" =
  measurementAuthoringTool.id;
const inferredPluginAnnotationToolId: "plugin.public-api.tool.annotation" =
  annotationAuthoringTool.id;
// @ts-expect-error Plugin-owned tool ids require plugin.<owner>.tool.<name>.
const unscopedPluginToolId: CanvasPluginToolId = "inspect";
void inferredPluginToolId;
void inferredPluginNavigationToolId;
void inferredPluginTransformToolId;
void inferredPluginRectToolId;
void inferredPluginSphereToolId;
void inferredPluginMeasurementToolId;
void inferredPluginAnnotationToolId;
void publicApiPluginToolId;
void typedPluginTool;
void typedPluginNavigationTool;
void typedPluginTransformTool;
void unscopedPluginToolId;

const config: DenovoCanvasConfig = defineCanvasConfig({
  controls,
  document,
  renderer: {
    backend
  },
  plugins: [
    defineCanvasPlugin({
      name: "public-api-plugin",
      async setup(context) {
        context.registerCommand(
          publicApiPluginCommand,
          (command, commandContext) => {
            const payload: string = command.payload;
            // @ts-expect-error The descriptor parser makes payload a string.
            const invalidPayload: number = command.payload;
            void payload;
            void invalidPayload;
            return {
            document: commandContext.document
            };
          }
        );
        context.registerTool({
          id: "plugin.public-api.tool.inspect",
          label: "Public API Tool"
        });
        // @ts-expect-error Plugin-owned tool ids cannot use editor-global strings.
        context.registerTool({ id: "public-api-tool", label: "Invalid Tool" });
      }
    })
  ],
  theme: {
    background: "#000000"
  }
});

declare const customTarget: CanvasTarget;
declare const customRuntime: CanvasFacadeRendererRuntime;
declare const runtimeWithoutNavigation: WebCanvasRuntime;
const scene2DInput: Canvas2DSceneInput = {
  id: "typed-2d-scene",
  layers: [{ id: "main", name: "Main" }],
  mode: "2d",
  nodes: []
};
const scene3DInput: Canvas3DSceneInput = {
  id: "typed-3d-scene",
  layers: [{ id: "main", name: "Main" }],
  mode: "3d",
  nodes: []
};
const runtime2D = createCanvas2D(customTarget, scene2DInput);
createCanvas3D(customTarget, scene3DInput);
// @ts-expect-error Canvas2D creation rejects a 3D scene.
createCanvas2D(customTarget, scene3DInput);
// @ts-expect-error Canvas3D creation rejects a 2D scene.
createCanvas3D(customTarget, scene2DInput);
runtime2D.setAuthoringPreviews([
  {
    kind: "grid.snap",
    // @ts-expect-error Canvas2D authoring previews reject 3D modes.
    mode: "3d",
    // @ts-expect-error Canvas2D authoring previews reject 3D coordinates.
    position: [0, 0, 0]
  }
]);
runtime2D.setNodeTransformPreview({
  kind: "translate",
  // @ts-expect-error Canvas2D transform previews reject 3D modes.
  mode: "3d",
  nodeId: "typed-node",
  // @ts-expect-error Canvas2D transform previews reject 3D coordinates.
  position: [0, 0, 0]
});
const invalidStage3DProps: CanvasStage3DProps = {
  // @ts-expect-error CanvasStage3D accepts only 3D scenes.
  scene: scene2DInput
};
// @ts-expect-error custom facade runtimes must declare navigation support.
const invalidCustomRuntime: CanvasFacadeRendererRuntime = runtimeWithoutNavigation;
const customAdapter: CanvasFacadeRendererAdapter = {
  createRuntime(target, nextScene, options) {
    void target;
    void nextScene;
    void options;
    void options?.controls;
    return customRuntime;
  },
  modes: ["2d"],
  name: "typed-custom-renderer"
};
const customConfig = defineCanvasConfig({
  document: JSON.stringify({
    id: "typed-custom-document",
    schemaVersion: "0.2.0",
    scene: {
      id: "typed-custom-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: []
    }
  }),
  renderer: customAdapter,
});
const customCanvas = createCanvas(customTarget, customConfig);
// @ts-expect-error strict backend resolution does not expose fallback metadata.
customCanvas.config.renderer.fallbackReason;
// @ts-expect-error A built-in backend cannot silently ignore an adapter.
defineCanvasConfig({ renderer: { adapter: customAdapter, backend: "webgl2" } });
// @ts-expect-error The custom backend requires an adapter.
defineCanvasConfig({ renderer: { backend: "custom" } });
// @ts-expect-error Document and scene are mutually exclusive sources.
defineCanvasConfig({ document, scene });
// @ts-expect-error Inline 2D config rejects 3D-only node kinds.
defineCanvasConfig({
  mode: "2d",
  nodes: [{ id: "wrong-mode-box", layerId: "main", type: "box" }]
});
if (!customCanvas.navigationInputSupported) {
  throw new Error("Typed custom runtime must declare navigation support.");
}
const navigationRuntime: CanvasNavigationInputRuntime = customCanvas;
navigationRuntime.setNavigationInputEnabled(false);
declare const dynamicRuntime: DynamicCanvasRuntime;
const disconnectRuntimeChanges = dynamicRuntime.subscribeRuntimeChange((change) => {
  const generation: number = change.generation;
  const previousMode: "2d" | "3d" = change.previousMode;
  void generation;
  void previousMode;
});
const customHit = customCanvas.hitTest(hitInput);
const disconnectCanvasEditor = connectEditorToCanvas(editor, customCanvas, {
  hover: true,
  mouseMovementThreshold: 4,
  touchMovementThreshold: 8
});
const disconnectToolInput = connectCanvasToolInput(customCanvas, toolEditor);
const loadedDocument = customCanvas.loadDocument(
  JSON.stringify({
    id: "typed-loaded-document",
    schemaVersion: "0.2.0",
    scene: {
      id: "typed-loaded-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: []
    }
  })
);
const viewState: Canvas2DViewState = defineCanvas2DViewState({
  offset: [12, 24],
  zoom: 2
});
const canvas2dOptions: Canvas2DOptions = {
  initialView: viewState,
  navigation: { enablePan: true, minZoom: 0.5, maxZoom: 8 }
};
// @ts-expect-error Canvas2D zoom must be numeric.
const invalidViewZoom: Canvas2DViewState = { offset: [0, 0], zoom: "2" };
// @ts-expect-error Canvas2D view state requires a two-item offset.
const invalidViewOffset: Canvas2DViewState = { offset: [0], zoom: 1 };
// @ts-expect-error Canvas2D view state is immutable.
viewState.zoom = 3;

type ReactAdapterExport = typeof CanvasView;
const reactAdapterExport: ReactAdapterExport | null = null;
const sceneEffect = parseSceneEffect(scene);
const pluginError: CanvasPluginError | null = null;

void config;
void controls;
void navigationPolicy;
void navigationRuntime;
void customCanvas;
void customHit;
void hit;
void loadedDocument;
void canvas2dOptions;
void invalidViewZoom;
void invalidViewOffset;
void invalidCustomRuntime;
void reactAdapterExport;
void sceneEffect;
void pluginError;
void editorUpdate;
void invalidRawRectUpdate;
void invalidRawEmptyUpdate;
void typedPatch;
void initialSelection;
void invalidPatch;
void invalidPositionPatch;
void invalidSelection;
void preciseRectIdentity;
void preciseRectMode;
void preciseRectType;
void invalidNodeIdentity;
void rectAuthoringTool;
void sphereAuthoringTool;
void measurementAuthoringTool;
void annotationAuthoringTool;
void groupCommand;
void activeTool;
void toolHandled;
void cancelledToolSession;
void runtime2D;
void invalidStage3DProps;
void disconnectRuntimeChanges;
disconnectEditor();
disconnectCanvasEditor();
disconnectToolInput();
`
);

writeFileSync(
  path.join(tmpDir, "editor-smoke.ts"),
  `import {
  CanvasEditorError,
  addLayer,
  applyCommandsToStoredDocument,
  applyNamedOperations,
  reorderLayer,
  connectEditorToRuntime,
  createEditor,
  createPanOrbitTool,
  createSelectTool,
  createTransformTool,
  listLayers,
  listNodes,
  setFieldPattern,
  setSparklineStyle,
  setLayerLocked,
  setLayerName,
  setLayerVisible,
  setNodeLayer,
  setNodeLocked,
  setNodeVisible,
  setText,
  removeNode,
  removeEdge,
  removeLayer,
  stackBox,
  type AddLayerInput,
  type ReorderLayerInput,
  type CanvasEditor,
  type CanvasPersistenceEvent,
  type ListedLayer,
  type ListedNode,
  type NamedOperation,
  type NamedOperationResult,
  type SetFieldPatternInput,
  type SetSparklineStyleInput,
  type RemoveEdgeInput,
  type RemoveLayerInput,
  type RemoveNodeInput,
  type SetLayerLockedInput,
  type SetLayerNameInput,
  type SetNodeLayerInput,
  type SetNodeLockedInput,
  type SetNodeVisibleInput,
  type SetTextInput,
  type StackBoxInput
} from "@denovo/canvas-editor";

const editor: CanvasEditor = createEditor({
  activeToolId: "select",
  document: {
    id: "headless-document",
    scene: {
      id: "headless-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "3d",
      nodes: []
    }
  },
  tools: [createPanOrbitTool(), createSelectTool(), createTransformTool()]
});
const hideMain: NamedOperation = setLayerVisible({
  layerId: "main",
  visible: false
});
const preview: NamedOperationResult = applyNamedOperations(
  editor.getState().document,
  [hideMain]
);
void preview;
void editor.apply([hideMain]);
const lockLayerInput: SetLayerLockedInput = {
  layerId: "main",
  locked: true
};
const lockLayer: NamedOperation = setLayerLocked(lockLayerInput);
void lockLayer;
// @ts-expect-error extra fields are rejected
setLayerLocked({ extra: true, layerId: "main", locked: true });
// @ts-expect-error locked must be boolean
setLayerLocked({ layerId: "main", locked: "true" });
const renameLayerInput: SetLayerNameInput = {
  layerId: "main",
  name: "Notes"
};
const renameLayer: NamedOperation = setLayerName(renameLayerInput);
void renameLayer;
// @ts-expect-error extra fields are rejected
setLayerName({ extra: true, layerId: "main", name: "Notes" });
// @ts-expect-error name must be a string
setLayerName({ layerId: "main", name: 1 });
const moveNodeInput: SetNodeLayerInput = {
  layerId: "main",
  nodeId: "box-1"
};
const moveNode: NamedOperation = setNodeLayer(moveNodeInput);
void moveNode;
// @ts-expect-error extra fields are rejected
setNodeLayer({ extra: true, layerId: "main", nodeId: "box-1" });
// @ts-expect-error layerId must be a string
setNodeLayer({ layerId: 1, nodeId: "box-1" });
const renameTextInput: SetTextInput = {
  nodeId: "label",
  text: "Done"
};
const renameText: NamedOperation = setText(renameTextInput);
void renameText;
// @ts-expect-error extra fields are rejected
setText({ extra: true, nodeId: "label", text: "Done" });
// @ts-expect-error text must be a string
setText({ nodeId: "label", text: 1 });
const stackInput: StackBoxInput = {
  createId: () => "stacked-box",
  face: "+y",
  on: "box-1"
};
const stackOp: NamedOperation = stackBox(stackInput);
void stackOp;
const fieldPatternInput: SetFieldPatternInput = {
  nodeId: "field",
  pattern: "letters"
};
const changePattern: NamedOperation = setFieldPattern(fieldPatternInput);
void changePattern;
const hideNode: NamedOperation = setNodeVisible({
  nodeId: "box-1",
  visible: false
});
void hideNode;
const lockNodeInput: SetNodeLockedInput = {
  locked: true,
  nodeId: "box-1"
};
const lockNode: NamedOperation = setNodeLocked(lockNodeInput);
void lockNode;
const hideNodeInput: SetNodeVisibleInput = {
  nodeId: "box-1",
  visible: false
};
void hideNodeInput;
// @ts-expect-error extra fields are rejected
setNodeVisible({ extra: true, nodeId: "box-1", visible: false });
// @ts-expect-error visible must be boolean
setNodeVisible({ nodeId: "box-1", visible: "false" });
// @ts-expect-error extra fields are rejected
setNodeLocked({ extra: true, locked: true, nodeId: "box-1" });
// @ts-expect-error locked must be boolean
setNodeLocked({ locked: "true", nodeId: "box-1" });
const dropNode: NamedOperation = removeNode({ nodeId: "box-1" });
void dropNode;
const removeNodeInput: RemoveNodeInput = { nodeId: "box-1" };
void removeNodeInput;
// @ts-expect-error extra fields are rejected
removeNode({ extra: true, nodeId: "box-1" });
// @ts-expect-error nodeId must be a string
removeNode({ nodeId: 1 });
const dropEdge: NamedOperation = removeEdge({ nodeId: "edge-1" });
void dropEdge;
const removeEdgeInput: RemoveEdgeInput = { nodeId: "edge-1" };
void removeEdgeInput;
// @ts-expect-error extra fields are rejected
removeEdge({ extra: true, nodeId: "edge-1" });
// @ts-expect-error nodeId must be a string
removeEdge({ nodeId: 1 });
const dropLayer: NamedOperation = removeLayer({
  layerId: "extra",
  targetLayerId: null
});
void dropLayer;
const removeLayerInput: RemoveLayerInput = {
  layerId: "extra",
  targetLayerId: null
};
void removeLayerInput;
// @ts-expect-error extra fields are rejected
removeLayer({ extra: true, layerId: "extra", targetLayerId: null });
// @ts-expect-error targetLayerId is required
removeLayer({ layerId: "extra" });
// @ts-expect-error targetLayerId must be a layer id or null
removeLayer({ layerId: "extra", targetLayerId: 1 });
const insertLayer: NamedOperation = addLayer({
  layerId: "notes",
  name: "Notes"
});
void insertLayer;
const addLayerInput: AddLayerInput = {
  layerId: "notes",
  name: "Notes"
};
void addLayerInput;
// @ts-expect-error extra fields are rejected
addLayer({ extra: true, layerId: "notes", name: "Notes" });
// @ts-expect-error name is required
addLayer({ layerId: "notes" });
// @ts-expect-error index must be a number
addLayer({ index: "0", layerId: "notes", name: "Notes" });
const moveLayer: NamedOperation = reorderLayer({
  index: 0,
  layerId: "extra"
});
void moveLayer;
const reorderLayerInput: ReorderLayerInput = {
  index: 0,
  layerId: "extra"
};
void reorderLayerInput;
// @ts-expect-error extra fields are rejected
reorderLayer({ extra: true, index: 0, layerId: "extra" });
// @ts-expect-error index is required
reorderLayer({ layerId: "extra" });
// @ts-expect-error index must be a number
reorderLayer({ index: "0", layerId: "extra" });
// @ts-expect-error extra fields are rejected
setFieldPattern({ nodeId: "field", pattern: "letters", extra: true });
// @ts-expect-error pattern is a closed union
setFieldPattern({ nodeId: "field", pattern: "wave" });
const sparkStyle: NamedOperation = setSparklineStyle({
  nodeId: "spark",
  style: "step"
});
void sparkStyle;
const sparklineStyleInput: SetSparklineStyleInput = {
  nodeId: "spark",
  style: "step"
};
void sparklineStyleInput;
// @ts-expect-error extra fields are rejected
setSparklineStyle({ extra: true, nodeId: "spark", style: "step" });
// @ts-expect-error style is a closed union
setSparklineStyle({ nodeId: "spark", style: "spline" });
// @ts-expect-error extra fields are rejected
setLayerVisible({ layerId: "main", visible: false, extra: true });
// @ts-expect-error visible must be boolean
setLayerVisible({ layerId: "main", visible: "false" });
// @ts-expect-error extra fields are rejected
stackBox({ createId: () => "stacked-box", extra: true, face: "+y", on: "box-1" });
// @ts-expect-error face is a closed axis union
stackBox({ createId: () => "stacked-box", face: "+w", on: "box-1" });
const listed: readonly ListedNode[] = listNodes(editor.getState().document);
void listed;
declare const listedNode: ListedNode;
// @ts-expect-error listed nodes omit geometry arrays
listedNode.positions;
// @ts-expect-error extra fields are rejected
listNodes(editor.getState().document, { extra: true });
const listedLayers: readonly ListedLayer[] = listLayers(
  editor.getState().document
);
void listedLayers;
declare const listedLayer: ListedLayer;
// @ts-expect-error listed layers omit metadata
listedLayer.metadata;
// @ts-expect-error listLayers does not take a filter
listLayers(editor.getState().document, { extra: true });
const disconnect = connectEditorToRuntime(editor, {
  update(scene) {
    void scene;
  }
});
const error: CanvasEditorError | null = null;
const selected = editor.selectFromHit({
  kind: "node",
  nodeId: "headless-node"
});
const hovered = editor.hoverFromHit({ kind: "empty" });
const handled = editor.handleToolInput({
  altKey: false,
  code: "Escape",
  ctrlKey: false,
  key: "Escape",
  metaKey: false,
  repeat: false,
  shiftKey: false,
  type: "key.down"
});
editor.registerCommand({
  parsePayload: (payload) => payload,
  // @ts-expect-error Editor command handlers are reserved for plugin.* commands.
  type: "node.update"
}, () => ({
  document: editor.getState().document
}));

const historyChanged: CanvasPersistenceEvent = {
  action: "undo",
  documentId: "headless-document",
  revision: 1,
  type: "history.changed"
};
const historyAction: "undo" | "redo" =
  historyChanged.type === "history.changed" ? historyChanged.action : "undo";
const invalidHistory: CanvasPersistenceEvent = {
  // @ts-expect-error history.changed actions are undo or redo only.
  action: "reset",
  documentId: "headless-document",
  revision: 1,
  type: "history.changed"
};
void applyCommandsToStoredDocument;
void historyAction;
void invalidHistory;
void error;
void hovered;
void selected;
void handled;
disconnect();
`
);

writeFileSync(
  path.join(tmpDir, "worker-smoke.ts"),
  `import {
  createWorkerClient,
  type WorkerTaskDefinition
} from "@denovo/canvas-worker";

type GeometryWorkerTasks = {
  "geometry.bounds": WorkerTaskDefinition<
    { positions: Float32Array },
    { max: [number, number, number]; min: [number, number, number] }
  >;
};

declare const worker: Worker;
const client = createWorkerClient<GeometryWorkerTasks>(worker);
const bounds = client.request("geometry.bounds", {
  positions: new Float32Array([0, 1, 2])
});
bounds.then((result) => result.min[0]);
// @ts-expect-error task names are restricted to the declared protocol.
client.request("geometry.missing", { positions: new Float32Array() });
// @ts-expect-error payloads are correlated with their task names.
client.request("geometry.bounds", { positions: [0, 1, 2] });
`
);

writeFileSync(
  path.join(tmpDir, "bim-smoke.ts"),
  `import type {
  BimAdapter,
  BimElementMetadata,
  BimElementProperties,
  BimElementRef,
  BimModelMetadata
} from "@denovo/canvas-bim";

declare const adapter: BimAdapter;
const metadata: BimModelMetadata = await adapter.loadModel({
  data: new ArrayBuffer(0),
  name: "alpha",
  origin: [40, 0, 0],
  type: "ifc"
});
const modelId: string = metadata.id;
const placedOrigin: readonly [number, number, number] = metadata.origin ?? [0, 0, 0];
void placedOrigin;

await adapter.loadModel({
  data: new ArrayBuffer(0),
  // @ts-expect-error origin is a 3-tuple, not a 2-tuple.
  origin: [40, 0],
  type: "ifc"
});
const listed: readonly BimModelMetadata[] = adapter.listModels?.() ?? [];
void listed;
await adapter.unloadModel?.(modelId);

const element: BimElementMetadata = {
  expressID: 12,
  ifcGuid: "guid",
  ifcType: "IfcWall",
  modelId
};
const ref: BimElementRef = {
  expressID: element.expressID,
  modelId: element.modelId
};
const properties: BimElementProperties = {
  expressID: ref.expressID,
  modelId: ref.modelId,
  psets: []
};
void properties;
const fetched = await adapter.getElementProperties?.([ref]);
fetched?.[0]?.psets.length;

// @ts-expect-error modelId is required provenance.
const missingModel: BimElementMetadata = {
  expressID: 12,
  ifcGuid: "guid",
  ifcType: "IfcWall"
};
// @ts-expect-error BimElementRef requires modelId next to expressID.
const missingRef: BimElementRef = { expressID: 12 };
const numericModel: BimElementMetadata = {
  expressID: 12,
  ifcGuid: "guid",
  ifcType: "IfcWall",
  // @ts-expect-error modelId is a string identifier, not a number.
  modelId: 1
};
void missingModel;
void missingRef;
void numericModel;
`
);

writeFileSync(
  path.join(tmpDir, "tsconfig.json"),
  JSON.stringify(
    {
      extends: "../../tsconfig.base.json",
      compilerOptions: {
        paths: {
          "@denovo/canvas-core/effect": ["../../packages/core/dist/effect.d.ts"],
          "@denovo/canvas-editor": ["../../packages/editor/dist/index.d.ts"],
          [facadeName]: ["../../packages/canvas/dist/index.d.ts"],
          [`${facadeName}/react`]: ["../../packages/canvas/dist/react.d.ts"]
        },
        noEmit: true
      },
      include: ["smoke.ts"]
    },
    null,
    2
  )
);

writeFileSync(
  path.join(tmpDir, "editor-tsconfig.json"),
  JSON.stringify(
    {
      extends: "../../tsconfig.base.json",
      compilerOptions: {
        lib: ["ES2022"],
        noEmit: true,
        paths: {
          "@denovo/canvas-core": ["../../packages/core/dist/index.d.ts"],
          "@denovo/canvas-editor": ["../../packages/editor/dist/index.d.ts"]
        },
        types: ["node"]
      },
      include: ["editor-smoke.ts"]
    },
    null,
    2
  )
);

writeFileSync(
  path.join(tmpDir, "worker-tsconfig.json"),
  JSON.stringify(
    {
      extends: "../../tsconfig.base.json",
      compilerOptions: {
        noEmit: true,
        paths: {
          "@denovo/canvas-worker": ["../../packages/worker/dist/index.d.ts"]
        }
      },
      include: ["worker-smoke.ts"]
    },
    null,
    2
  )
);

writeFileSync(
  path.join(tmpDir, "bim-tsconfig.json"),
  JSON.stringify(
    {
      extends: "../../tsconfig.base.json",
      compilerOptions: {
        lib: ["ES2022"],
        noEmit: true,
        paths: {
          "@denovo/canvas-bim": ["../../packages/bim/dist/index.d.ts"],
          "@denovo/canvas-core": ["../../packages/core/dist/index.d.ts"]
        }
      },
      include: ["bim-smoke.ts"]
    },
    null,
    2
  )
);

try {
  execFileSync("pnpm", ["exec", "tsc", "-p", path.join(tmpDir, "tsconfig.json")], {
    cwd: root,
    stdio: "pipe"
  });
  execFileSync(
    "pnpm",
    ["exec", "tsc", "-p", path.join(tmpDir, "editor-tsconfig.json")],
    {
      cwd: root,
      stdio: "pipe"
    }
  );
  execFileSync(
    "pnpm",
    ["exec", "tsc", "-p", path.join(tmpDir, "worker-tsconfig.json")],
    {
      cwd: root,
      stdio: "pipe"
    }
  );
  execFileSync(
    "pnpm",
    ["exec", "tsc", "-p", path.join(tmpDir, "bim-tsconfig.json")],
    {
      cwd: root,
      stdio: "pipe"
    }
  );
} catch (error) {
  process.stderr.write(error.stdout?.toString() ?? "");
  process.stderr.write(error.stderr?.toString() ?? "");
  throw error;
}

rmSync(tmpDir, {
  force: true,
  recursive: true
});

// Reaching here means every assertion above held; a failure throws and the
// non-zero exit code reports it.
check("public-api-suite", () => {});

report({ facadeName });
