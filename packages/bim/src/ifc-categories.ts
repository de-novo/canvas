/**
 * Maps an IFC entity type string (e.g. `"IfcWallStandardCase"`) to a Denovo
 * layer/category. Implemented over type *names* rather than web-ifc's numeric
 * enum constants so this module stays free of a `web-ifc` import — the contract
 * entry (`@de-novo/canvas-bim`) must remain importable without the parser dep.
 *
 * @module @de-novo/canvas-bim/web-ifc
 */

export type IfcCategoryEntry = {
  /** Layer id this IFC type maps to. */
  layerId: string;
  /** Human-readable layer name. */
  layerName: string;
  /** Optional default color for elements of this category. */
  color?: string;
};

const DEFAULT_CATEGORY: IfcCategoryEntry = {
  color: "#9ca3af",
  layerId: "default",
  layerName: "Default"
};

/**
 * Ordered prefix rules. The first matching prefix wins. Order matters: more
 * specific types (e.g. `IfcWallStandardCase`) are matched by their `IfcWall`
 * prefix before the generic fallback.
 */
const CATEGORY_RULES: ReadonlyArray<{
  prefix: string;
  entry: IfcCategoryEntry;
}> = [
  { prefix: "IfcWall", entry: { color: "#cdb892", layerId: "walls", layerName: "Walls" } },
  { prefix: "IfcSlab", entry: { color: "#bdbdbd", layerId: "slabs", layerName: "Slabs" } },
  { prefix: "IfcColumn", entry: { color: "#d4a373", layerId: "columns", layerName: "Columns" } },
  { prefix: "IfcBeam", entry: { color: "#e9c46a", layerId: "beams", layerName: "Beams" } },
  { prefix: "IfcFooting", entry: { color: "#a8a29e", layerId: "foundations", layerName: "Foundations" } },
  { prefix: "IfcRoof", entry: { color: "#9ca3af", layerId: "roofs", layerName: "Roofs" } },
  { prefix: "IfcCurtainWall", entry: { color: "#cbd5e1", layerId: "curtain-walls", layerName: "Curtain Walls" } },
  { prefix: "IfcDoor", entry: { color: "#8d6e63", layerId: "doors", layerName: "Doors" } },
  { prefix: "IfcWindow", entry: { color: "#90caf9", layerId: "windows", layerName: "Windows" } },
  { prefix: "IfcSpace", entry: { color: "#e5e7eb", layerId: "spaces", layerName: "Spaces" } },
  { prefix: "IfcBuildingStorey", entry: { color: "#6b7280", layerId: "storeys", layerName: "Storeys" } },
  { prefix: "IfcFurnishingElement", entry: { color: "#b08968", layerId: "furniture", layerName: "Furniture" } },
  { prefix: "IfcFlowSegment", entry: { color: "#78909c", layerId: "mep-flow", layerName: "MEP Flow" } },
  { prefix: "IfcFlowFitting", entry: { color: "#78909c", layerId: "mep-fittings", layerName: "MEP Fittings" } },
  { prefix: "IfcFlowTerminal", entry: { color: "#90a4ae", layerId: "mep-terminals", layerName: "MEP Terminals" } },
  { prefix: "IfcRailing", entry: { color: "#9e9e9e", layerId: "railings", layerName: "Railings" } },
  { prefix: "IfcStair", entry: { color: "#9e9e9e", layerId: "stairs", layerName: "Stairs" } },
  { prefix: "IfcSite", entry: { color: "#7cb342", layerId: "site", layerName: "Site" } }
];

/**
 * Resolves an IFC entity type string to a layer category. Falls back to the
 * default category for unknown types.
 *
 * @param ifcType - e.g. `"IfcWallStandardCase"`, `"IfcSlab"`.
 */
export function resolveIfcCategory(ifcType: string): IfcCategoryEntry {
  for (const rule of CATEGORY_RULES) {
    if (ifcType.startsWith(rule.prefix)) {
      return rule.entry;
    }
  }
  return DEFAULT_CATEGORY;
}
