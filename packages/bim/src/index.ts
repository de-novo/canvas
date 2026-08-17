import type { CanvasScene } from "@denovo/canvas-core";

export type BimModelSource =
  | {
      type: "ifc";
      data: ArrayBuffer;
      name?: string;
    }
  | {
      type: "xkt";
      data: ArrayBuffer | string;
      name?: string;
    };

export type BimModelMetadata = {
  id: string;
  name?: string;
  elementCount?: number;
  sourceType: BimModelSource["type"];
};

export type BimAdapter = {
  dispose: () => void | Promise<void>;
  loadModel: (source: BimModelSource) => Promise<BimModelMetadata>;
  toScene?: () => Promise<CanvasScene>;
};

/**
 * Reserved `node.metadata` / `layer.metadata` key under which BIM adapters
 * store element provenance (see {@link BimElementMetadata}). UI layers can read
 * this without importing the adapter implementation.
 */
export const BIM_METADATA_KEY = "__bim" as const;

/**
 * Provenance for a single BIM element, stored at
 * `node.metadata[BIM_METADATA_KEY]`. Property sets are loaded lazily by the
 * adapter (not eagerly into the scene) to keep the document small.
 */
export type BimElementMetadata = {
  /** IFC `GlobalId` — stable across reloads. */
  ifcGuid: string;
  /** IFC entity type, e.g. `"IfcWall"`, `"IfcSlab"`. */
  ifcType: string;
  /** IFC `Name` attribute, if present. */
  ifcName?: string;
  /** web-ifc internal express id (model-scoped). */
  expressID: number;
  /** Optional pointer to lazy property sets (resolved by the adapter). */
  psets?: BimPropertySet[];
};

export type BimPropertySet = {
  name: string;
  properties: Record<string, string | number | boolean | null>;
};

/**
 * How a `web-ifc` adapter resolves its WASM binary. web-ifc fetches
 * `web-ifc.wasm` at runtime; the consumer's bundler determines where that
 * asset lives, so the adapter defers to one of these strategies.
 */
export type WebIfcWasmConfig =
  | { wasmBaseUrl: string }
  | { wasmModule: WebAssembly.Module }
  | { locateFile: (file: string) => string };

export type BimExtensionManifest = {
  recommendedAdapters: readonly ["web-ifc", "xeokit"];
  notes: readonly string[];
};

export function defineBimAdapter(adapter: BimAdapter): BimAdapter {
  return adapter;
}

export function getBimExtensionManifest(): BimExtensionManifest {
  return {
    recommendedAdapters: ["web-ifc", "xeokit"],
    notes: [
      "web-ifc (MPL-2.0) is the first-class IFC parser; import it from @denovo/canvas-bim/web-ifc.",
      "@xeokit/xeokit-sdk is AGPL-3.0 — a separate viewer adapter may follow; core stays license-clean.",
      "Large parsing work should eventually run in @denovo/canvas-worker."
    ]
  };
}
