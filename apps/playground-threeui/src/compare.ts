import { CATALOG, isDenovoPort, type CatalogItem } from "./catalog";
import { createWarpFieldDocument, type WarpFieldVariant } from "./denovo/warp-field-document";
import communityCss from "./vendor/threeui/community.css?raw";
import warpFieldDocumentSource from "./denovo/warp-field-document.ts?raw";
import warpFieldCanvasSource from "./denovo/WarpFieldCanvas.tsx?raw";
import warpFieldHost from "./vendor/threeui/warp-field/WarpFieldBackground.tsx?raw";
import warpFieldRenderer from "./vendor/threeui/warp-field/warpFieldRenderer.ts?raw";
import three128Source from "../node_modules/three128/build/three.module.js?raw";
import three149Source from "../node_modules/three/build/three.module.js?raw";
import three165Source from "../node_modules/three165/build/three.module.js?raw";
import canvasCoreSource from "../../../packages/core/src/index.ts?raw";
import sylvaThree from "./vendor/threeui/sylva-living-world/sources/inner-green-assets/three.min.js?raw";
import bookshelfOrbit from "./vendor/threeui/bookshelf/three165/OrbitControls.js?raw";
import bookshelfRoom from "./vendor/threeui/bookshelf/three165/RoomEnvironment.js?raw";
import bookshelfRounded from "./vendor/threeui/bookshelf/three165/RoundedBoxGeometry.js?raw";
import bookshelfRect from "./vendor/threeui/bookshelf/three165/RectAreaLightUniformsLib.js?raw";
import structureFlowRenderer from "./vendor/threeui/structure-flow/structureFlowRenderer.ts?raw";
import structureFlowHost from "./vendor/threeui/structure-flow/StructureFlowBackground.tsx?raw";
import structureFlowCollection from "./vendor/threeui/structure-flow/StructureFlowCollection.tsx?raw";
import emeraldHost from "./vendor/threeui/emerald-horizon/EmeraldHorizonBackground.tsx?raw";
import emeraldShaders from "./vendor/threeui/emerald-horizon/emeraldHorizonShaders.ts?raw";
import orbitalHost from "./vendor/threeui/orbital-sphere/OrbitalSphereBackground.tsx?raw";
import orbitalRenderer from "./vendor/threeui/orbital-sphere/orbitalSphereRenderer.ts?raw";
import dotMatrixHost from "./vendor/threeui/dot-matrix/DotMatrixBackground.tsx?raw";
import dotMatrixShaders from "./vendor/threeui/dot-matrix/dotMatrixShaders.ts?raw";
import templeHost from "./vendor/threeui/temple-night/TempleNightScene.tsx?raw";
import templeRenderer from "./vendor/threeui/temple-night/templeNightRenderer.js?raw";
import bookshelfHost from "./vendor/threeui/bookshelf/BookshelfScene.tsx?raw";
import bookshelfRenderer from "./vendor/threeui/bookshelf/bookshelfRenderer.js?raw";
import craftHost from "./vendor/threeui/neuform-isolated/NeuformCraftEffects.tsx?raw";
import weaveHtml from "./vendor/threeui/neuform-isolated/sources/lumina-weavers-cloth.html?raw";
import nebulaHtml from "./vendor/threeui/neuform-isolated/sources/julian-vance-nebula.html?raw";
import fluidHtml from "./vendor/threeui/neuform-isolated/sources/aura-ui-fluid.html?raw";
import emberHtml from "./vendor/threeui/neuform-isolated/sources/aeonix-ember-storm.html?raw";
import isolatedHost from "./vendor/threeui/neuform-isolated/NeuformIsolatedEffects.tsx?raw";
import expanseHtml from "./vendor/threeui/neuform-isolated/sources/digital-expanse.html?raw";
import logicCoreHtml from "./vendor/threeui/neuform-isolated/sources/platform-core.html?raw";
import dimensionalHtml from "./vendor/threeui/neuform-isolated/sources/vanguard-dimensional.html?raw";
import dataFieldHtml from "./vendor/threeui/neuform-isolated/sources/vertex-9.html?raw";
import topologyHtml from "./vendor/threeui/neuform-isolated/sources/nexus-topology.html?raw";
import batchHost from "./vendor/threeui/neuform-isolated/NeuformBatchEffects.tsx?raw";
import fluxHtml from "./vendor/threeui/neuform-isolated/sources/flux-vortex.html?raw";
import sylvaHost from "./vendor/threeui/sylva-living-world/SylvaLivingWorldScene.tsx?raw";
import sylvaHtml from "./vendor/threeui/sylva-living-world/sources/inner-green-3d.html?raw";
import landscapeHost from "./vendor/threeui/landscape/LandscapeScene.tsx?raw";
import landscapeHtml from "../public/landscape.html?raw";
import towersHost from "./vendor/threeui/japanese-tower/JapaneseTowerLandscape.tsx?raw";
import towersHtml from "../public/japanese-tower.html?raw";

export type CompareFileRole = "host" | "engine" | "document" | "package" | "chrome" | "note";

export type CompareFile = {
  path: string;
  body: string;
  lineCount: number;
  role: CompareFileRole;
};

export type ComparePane = {
  title: string;
  files: CompareFile[];
};

export type LineTally = {
  originalHost: number;
  originalEngine: number;
  originalTotal: number;
  ourHost: number;
  ourDocument: number;
  ourPackage: number;
  ourTotal: number;
  engineStillRequired: number;
  runTotal: number;
  ported: boolean;
};

function file(path: string, body: string, role: CompareFileRole = "host"): CompareFile {
  return { path, body, lineCount: body.split("\n").length, role };
}

function engineNote(path: string, note: string): CompareFile {
  return { path, body: note, lineCount: 1, role: "note" };
}

function linesFor(files: CompareFile[], role: CompareFileRole): number {
  return files.filter((item) => item.role === role).reduce((sum, item) => sum + item.lineCount, 0);
}

const SHARED = [file("src/vendor/threeui/community.css", communityCss, "chrome")];
const COLLECTION = [
  file("src/vendor/threeui/structure-flow/StructureFlowCollection.tsx", structureFlowCollection)
];

const FILES: Record<string, CompareFile[]> = {
  "warp-field": [
    file("src/vendor/threeui/warp-field/WarpFieldBackground.tsx", warpFieldHost, "host"),
    file("src/vendor/threeui/warp-field/warpFieldRenderer.ts", warpFieldRenderer, "engine")
  ],
  "structure-flow": [
    ...COLLECTION,
    file("src/vendor/threeui/structure-flow/StructureFlowBackground.tsx", structureFlowHost),
    file("src/vendor/threeui/structure-flow/structureFlowRenderer.ts", structureFlowRenderer)
  ],
  "emerald-horizon": [
    ...COLLECTION,
    file("src/vendor/threeui/emerald-horizon/EmeraldHorizonBackground.tsx", emeraldHost),
    file("src/vendor/threeui/emerald-horizon/emeraldHorizonShaders.ts", emeraldShaders)
  ],
  "orbital-sphere": [
    ...COLLECTION,
    file("src/vendor/threeui/orbital-sphere/OrbitalSphereBackground.tsx", orbitalHost),
    file("src/vendor/threeui/orbital-sphere/orbitalSphereRenderer.ts", orbitalRenderer)
  ],
  "dot-matrix": [
    ...COLLECTION,
    file("src/vendor/threeui/dot-matrix/DotMatrixBackground.tsx", dotMatrixHost),
    file("src/vendor/threeui/dot-matrix/dotMatrixShaders.ts", dotMatrixShaders)
  ],
  "expanse-field": [
    ...COLLECTION,
    file("src/vendor/threeui/neuform-isolated/NeuformIsolatedEffects.tsx", isolatedHost),
    file("src/vendor/threeui/neuform-isolated/sources/digital-expanse.html", expanseHtml)
  ],
  "logic-core": [
    ...COLLECTION,
    file("src/vendor/threeui/neuform-isolated/NeuformIsolatedEffects.tsx", isolatedHost),
    file("src/vendor/threeui/neuform-isolated/sources/platform-core.html", logicCoreHtml)
  ],
  "dimensional-field": [
    ...COLLECTION,
    file("src/vendor/threeui/neuform-isolated/NeuformIsolatedEffects.tsx", isolatedHost),
    file("src/vendor/threeui/neuform-isolated/sources/vanguard-dimensional.html", dimensionalHtml)
  ],
  "data-field": [
    ...COLLECTION,
    file("src/vendor/threeui/neuform-isolated/NeuformIsolatedEffects.tsx", isolatedHost),
    file("src/vendor/threeui/neuform-isolated/sources/vertex-9.html", dataFieldHtml)
  ],
  "topology-field": [
    ...COLLECTION,
    file("src/vendor/threeui/neuform-isolated/NeuformIsolatedEffects.tsx", isolatedHost),
    file("src/vendor/threeui/neuform-isolated/sources/nexus-topology.html", topologyHtml)
  ],
  nebula: [
    ...COLLECTION,
    file("src/vendor/threeui/neuform-isolated/NeuformCraftEffects.tsx", craftHost),
    file("src/vendor/threeui/neuform-isolated/sources/julian-vance-nebula.html", nebulaHtml)
  ],
  "fluid-field": [
    ...COLLECTION,
    file("src/vendor/threeui/neuform-isolated/NeuformCraftEffects.tsx", craftHost),
    file("src/vendor/threeui/neuform-isolated/sources/aura-ui-fluid.html", fluidHtml)
  ],
  "ember-storm": [
    ...COLLECTION,
    file("src/vendor/threeui/neuform-isolated/NeuformCraftEffects.tsx", craftHost),
    file("src/vendor/threeui/neuform-isolated/sources/aeonix-ember-storm.html", emberHtml)
  ],
  "flux-vortex": [
    ...COLLECTION,
    file("src/vendor/threeui/neuform-isolated/NeuformBatchEffects.tsx", batchHost),
    file("src/vendor/threeui/neuform-isolated/sources/flux-vortex.html", fluxHtml)
  ],
  "temple-night": [
    file("src/vendor/threeui/temple-night/TempleNightScene.tsx", templeHost),
    file("src/vendor/threeui/temple-night/templeNightRenderer.js", templeRenderer)
  ],
  bookshelf: [
    file("src/vendor/threeui/bookshelf/BookshelfScene.tsx", bookshelfHost),
    file("src/vendor/threeui/bookshelf/bookshelfRenderer.js", bookshelfRenderer)
  ],
  "woven-cloth": [
    file("src/vendor/threeui/neuform-isolated/NeuformCraftEffects.tsx", craftHost),
    file("src/vendor/threeui/neuform-isolated/sources/lumina-weavers-cloth.html", weaveHtml)
  ],
  "sylva-living-world": [
    file("src/vendor/threeui/sylva-living-world/SylvaLivingWorldScene.tsx", sylvaHost),
    file("src/vendor/threeui/sylva-living-world/sources/inner-green-3d.html", sylvaHtml)
  ],
  landscape: [
    file("src/vendor/threeui/landscape/LandscapeScene.tsx", landscapeHost),
    file("apps/playground-threeui/public/landscape.html", landscapeHtml)
  ],
  towers: [
    file("src/vendor/threeui/japanese-tower/JapaneseTowerLandscape.tsx", towersHost),
    file("apps/playground-threeui/public/japanese-tower.html", towersHtml)
  ]
};

const ALIASES: Record<string, string> = {
  "warp-letters": "warp-field",
  "warp-keycaps": "warp-field",
  "warp-hyperspace": "warp-field",
  "landscape-sunrise": "landscape",
  "landscape-noon": "landscape",
  "landscape-sunset": "landscape",
  "landscape-night": "landscape",
  "landscape-rain": "landscape",
  "landscape-storm": "landscape",
  "landscape-snow": "landscape",
  "towers-japan": "towers",
  "towers-china": "towers",
  "towers-vietnam": "towers",
  "towers-thailand": "towers",
  "towers-cambodia": "towers",
  "towers-turkey": "towers"
};

function originalFiles(item: CatalogItem): CompareFile[] {
  const key = ALIASES[item.id] ?? item.id;
  const refs = FILES[key];
  if (!refs || refs.length === 0) {
    throw new Error(`No ThreeUI source mapping for ${item.id}`);
  }

  const files = [...refs, ...SHARED];

  if (
    key === "warp-field" ||
    key === "structure-flow" ||
    key === "emerald-horizon" ||
    key === "orbital-sphere" ||
    key === "dot-matrix"
  ) {
    files.push(
      file("node_modules/three128/build/three.module.js", three128Source, "engine")
    );
  }
  if (key === "temple-night") {
    files.push(file("node_modules/three/build/three.module.js", three149Source, "engine"));
  }
  if (key === "bookshelf") {
    files.push(file("node_modules/three165/build/three.module.js", three165Source, "engine"));
  }
  if (item.id === "sylva-living-world") {
    files.push(
      file(
        "src/vendor/threeui/sylva-living-world/sources/inner-green-assets/three.min.js",
        sylvaThree,
        "engine"
      )
    );
  }
  if (item.id === "bookshelf") {
    files.push(
      file("src/vendor/threeui/bookshelf/three165/OrbitControls.js", bookshelfOrbit, "engine"),
      file("src/vendor/threeui/bookshelf/three165/RoomEnvironment.js", bookshelfRoom, "engine"),
      file(
        "src/vendor/threeui/bookshelf/three165/RoundedBoxGeometry.js",
        bookshelfRounded,
        "engine"
      ),
      file(
        "src/vendor/threeui/bookshelf/three165/RectAreaLightUniformsLib.js",
        bookshelfRect,
        "engine"
      )
    );
  }

  return files;
}

function denovoFiles(item: CatalogItem): CompareFile[] {
  if (!isDenovoPort(item)) {
    return [
      engineNote(
        "아직 없음",
        "이 방은 아직 Denovo 문서와 커스텀 렌더러로 옮기지 않았습니다."
      )
    ];
  }

  const variant = (item.props?.variant ?? "streaks") as WarpFieldVariant;
  const document = createWarpFieldDocument(variant);
  return [
    file("src/denovo/WarpFieldCanvas.tsx", warpFieldCanvasSource, "host"),
    file("src/denovo/warp-field-document.ts", warpFieldDocumentSource, "document"),
    file(
      `document warp-field-${variant}.json`,
      `${JSON.stringify(document, null, 2)}\n`,
      "document"
    ),
    file("src/vendor/threeui/warp-field/warpFieldRenderer.ts", warpFieldRenderer, "engine"),
    file("node_modules/three128/build/three.module.js", three128Source, "engine"),
    file("packages/core/src/index.ts", canvasCoreSource, "package")
  ];
}

function countedLines(files: CompareFile[]): number {
  return files.filter((item) => item.role !== "note").reduce((sum, item) => sum + item.lineCount, 0);
}

function buildTally(original: CompareFile[], ours: CompareFile[], ported: boolean): LineTally {
  const originalHost = linesFor(original, "host") + linesFor(original, "chrome");
  const originalEngine = linesFor(original, "engine");
  const ourHost = linesFor(ours, "host") + linesFor(ours, "chrome");
  const ourDocument = linesFor(ours, "document");
  const ourPackage = linesFor(ours, "package");
  const engineStillRequired = linesFor(ours, "engine");
  const originalTotal = countedLines(original);
  const ourTotal = countedLines(ours);
  return {
    originalHost,
    originalEngine,
    originalTotal,
    ourHost,
    ourDocument,
    ourPackage,
    ourTotal,
    engineStillRequired,
    runTotal: ourTotal,
    ported
  };
}

export async function loadComparePanes(item: CatalogItem): Promise<{
  original: ComparePane;
  ours: ComparePane;
  tally: LineTally;
}> {
  const original = originalFiles(item);
  const ours = denovoFiles(item);
  return {
    original: { title: "ThreeUI 원본", files: original },
    ours: { title: "Denovo", files: ours },
    tally: buildTally(original, ours, isDenovoPort(item))
  };
}

const mapped = new Set([...Object.keys(FILES), ...Object.keys(ALIASES)]);
for (const item of CATALOG) {
  if (!mapped.has(item.id)) {
    throw new Error(`Catalog item ${item.id} has no source mapping`);
  }
}
