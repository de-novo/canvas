import type { ComponentType } from "react";

export type CatalogItem = {
  id: string;
  label: string;
  group: string;
  engine: string;
  load: () => Promise<{ default: ComponentType<Record<string, never> | Record<string, string>> }>;
  denovoLoad?: () => Promise<{ default: ComponentType<Record<string, never> | Record<string, string>> }>;
  props?: Record<string, string>;
};

export function isDenovoPort(item: CatalogItem): boolean {
  return item.denovoLoad !== undefined;
}

function host<T extends Record<string, unknown>>(
  loadModule: () => Promise<T>,
  exportName: keyof T
): CatalogItem["load"] {
  return () =>
    loadModule().then((module) => ({
      default: module[exportName] as ComponentType<Record<string, string>>
    }));
}

const structureFlow = host(
  () => import("./vendor/threeui/structure-flow/StructureFlowCollection"),
  "StructureFlowCollection"
);
const warpField = host(
  () => import("./vendor/threeui/warp-field/WarpFieldBackground"),
  "WarpFieldBackground"
);
const warpFieldDenovo = host(
  () => import("./denovo/WarpFieldCanvas"),
  "WarpFieldCanvas"
);
const landscape = host(
  () => import("./vendor/threeui/landscape/LandscapeScene"),
  "LandscapeScene"
);
const towers = host(
  () => import("./vendor/threeui/japanese-tower/JapaneseTowerLandscape"),
  "JapaneseTowerLandscape"
);

export const CATALOG: readonly CatalogItem[] = [
  {
    id: "sylva-living-world",
    label: "Sylva Living World — Living Green",
    group: "World",
    engine: "iframe HTML + Three r149",
    load: host(
      () => import("./vendor/threeui/sylva-living-world/SylvaLivingWorldScene"),
      "SylvaLivingWorldScene"
    )
  },
  {
    id: "temple-night",
    label: "Temple Night — Kage",
    group: "World",
    engine: "Three r149",
    load: host(
      () => import("./vendor/threeui/temple-night/TempleNightScene"),
      "TempleNightScene"
    )
  },
  {
    id: "bookshelf",
    label: "Bookshelf",
    group: "World",
    engine: "Three r165",
    load: host(
      () => import("./vendor/threeui/bookshelf/BookshelfScene"),
      "BookshelfScene"
    )
  },
  {
    id: "woven-cloth",
    label: "Woven Cloth",
    group: "World",
    engine: "Three r160 / HTML host",
    load: host(
      () => import("./vendor/threeui/neuform-isolated/NeuformCraftEffects"),
      "WovenCloth"
    )
  },
  {
    id: "landscape-sunrise",
    label: "Landscape — Sunrise",
    group: "Landscape",
    engine: "iframe HTML + Three r149",
    load: landscape,
    props: { variant: "sunrise" }
  },
  {
    id: "landscape-noon",
    label: "Landscape — Noon",
    group: "Landscape",
    engine: "iframe HTML + Three r149",
    load: landscape,
    props: { variant: "noon" }
  },
  {
    id: "landscape-sunset",
    label: "Landscape — Sunset",
    group: "Landscape",
    engine: "iframe HTML + Three r149",
    load: landscape,
    props: { variant: "sunset" }
  },
  {
    id: "landscape-night",
    label: "Landscape — Night",
    group: "Landscape",
    engine: "iframe HTML + Three r149",
    load: landscape,
    props: { variant: "night" }
  },
  {
    id: "landscape-rain",
    label: "Landscape — Rain",
    group: "Landscape",
    engine: "iframe HTML + Three r149",
    load: landscape,
    props: { variant: "rain" }
  },
  {
    id: "landscape-storm",
    label: "Landscape — Storm",
    group: "Landscape",
    engine: "iframe HTML + Three r149",
    load: landscape,
    props: { variant: "storm" }
  },
  {
    id: "landscape-snow",
    label: "Landscape — Snow",
    group: "Landscape",
    engine: "iframe HTML + Three r149",
    load: landscape,
    props: { variant: "snow" }
  },
  {
    id: "towers-japan",
    label: "Country Towers — Japan",
    group: "Towers",
    engine: "iframe HTML + Three r149",
    load: towers,
    props: { country: "japan" }
  },
  {
    id: "towers-china",
    label: "Country Towers — China",
    group: "Towers",
    engine: "iframe HTML + Three r149",
    load: towers,
    props: { country: "china" }
  },
  {
    id: "towers-vietnam",
    label: "Country Towers — Vietnam",
    group: "Towers",
    engine: "iframe HTML + Three r149",
    load: towers,
    props: { country: "vietnam" }
  },
  {
    id: "towers-thailand",
    label: "Country Towers — Thailand",
    group: "Towers",
    engine: "iframe HTML + Three r149",
    load: towers,
    props: { country: "thailand" }
  },
  {
    id: "towers-cambodia",
    label: "Country Towers — Cambodia",
    group: "Towers",
    engine: "iframe HTML + Three r149",
    load: towers,
    props: { country: "cambodia" }
  },
  {
    id: "towers-turkey",
    label: "Country Towers — Turkey",
    group: "Towers",
    engine: "iframe HTML + Three r149",
    load: towers,
    props: { country: "turkey" }
  },
  {
    id: "structure-flow",
    label: "Structure Flow",
    group: "Structure Flow",
    engine: "Three r128",
    load: structureFlow,
    props: { variant: "structure-flow" }
  },
  {
    id: "emerald-horizon",
    label: "Emerald Horizon",
    group: "Structure Flow",
    engine: "Three r128",
    load: structureFlow,
    props: { variant: "emerald-horizon" }
  },
  {
    id: "orbital-sphere",
    label: "Orbital Sphere",
    group: "Structure Flow",
    engine: "Three r128",
    load: structureFlow,
    props: { variant: "orbital-sphere" }
  },
  {
    id: "dot-matrix",
    label: "Dot Matrix",
    group: "Structure Flow",
    engine: "Three r128",
    load: structureFlow,
    props: { variant: "dot-matrix" }
  },
  {
    id: "expanse-field",
    label: "Expanse Field",
    group: "Structure Flow",
    engine: "HTML host",
    load: structureFlow,
    props: { variant: "expanse-field" }
  },
  {
    id: "logic-core",
    label: "Logic Core",
    group: "Structure Flow",
    engine: "HTML host",
    load: structureFlow,
    props: { variant: "logic-core" }
  },
  {
    id: "dimensional-field",
    label: "Dimensional Field",
    group: "Structure Flow",
    engine: "HTML host",
    load: structureFlow,
    props: { variant: "dimensional-field" }
  },
  {
    id: "data-field",
    label: "Data Field",
    group: "Structure Flow",
    engine: "HTML host",
    load: structureFlow,
    props: { variant: "data-field" }
  },
  {
    id: "topology-field",
    label: "Topology Field",
    group: "Structure Flow",
    engine: "HTML host",
    load: structureFlow,
    props: { variant: "topology-field" }
  },
  {
    id: "nebula",
    label: "Nebula",
    group: "Structure Flow",
    engine: "HTML host",
    load: structureFlow,
    props: { variant: "nebula" }
  },
  {
    id: "fluid-field",
    label: "Fluid Field",
    group: "Structure Flow",
    engine: "HTML host",
    load: structureFlow,
    props: { variant: "fluid-field" }
  },
  {
    id: "ember-storm",
    label: "Ember Storm",
    group: "Structure Flow",
    engine: "HTML host",
    load: structureFlow,
    props: { variant: "ember-storm" }
  },
  {
    id: "flux-vortex",
    label: "Flux Vortex",
    group: "Structure Flow",
    engine: "HTML host",
    load: structureFlow,
    props: { variant: "flux-vortex" }
  },
  {
    id: "warp-field",
    label: "Warp Field",
    group: "Warp Field",
    engine: "Three r128 · Denovo document",
    load: warpField,
    denovoLoad: warpFieldDenovo,
    props: { variant: "streaks" }
  },
  {
    id: "warp-letters",
    label: "Warp Field — Letter Storm",
    group: "Warp Field",
    engine: "Three r128 · Denovo document",
    load: warpField,
    denovoLoad: warpFieldDenovo,
    props: { variant: "letters" }
  },
  {
    id: "warp-keycaps",
    label: "Warp Field — Keycap Drift",
    group: "Warp Field",
    engine: "Three r128 · Denovo document",
    load: warpField,
    denovoLoad: warpFieldDenovo,
    props: { variant: "keycaps" }
  },
  {
    id: "warp-hyperspace",
    label: "Warp Field — Hyperspace",
    group: "Warp Field",
    engine: "Three r128 · Denovo document",
    load: warpField,
    denovoLoad: warpFieldDenovo,
    props: { variant: "hyperspace" }
  }
] as const;

export const CATALOG_GROUPS = [...new Set(CATALOG.map((item) => item.group))];
