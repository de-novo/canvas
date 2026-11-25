import type {
  CanvasDocument,
  CanvasGeometryStore,
  CanvasScene
} from "@de-novo/canvas-core";

export type BimModelOrigin = readonly [number, number, number];

export type BimModelSource =
  | {
      type: "ifc";
      data: ArrayBuffer;
      name?: string;
      /**
       * World-space translation applied at assemble time as each mesh
       * node's `position`. Omitted origin stays at `[0, 0, 0]`.
       */
      origin?: BimModelOrigin;
    }
  | {
      type: "xkt";
      data: ArrayBuffer | string;
      name?: string;
      origin?: BimModelOrigin;
    };

export type BimModelMetadata = {
  id: string;
  name?: string;
  elementCount?: number;
  origin?: BimModelOrigin;
  sourceType: BimModelSource["type"];
};

export type BimImportResult = {
  document: CanvasDocument;
  geometryStore: CanvasGeometryStore;
};

export type BimPropertySet = {
  name: string;
  properties: Record<string, string | number | boolean | null>;
};

export type BimElementRef = {
  modelId: string;
  expressID: number;
};

export type BimElementProperties = BimElementRef & {
  psets: readonly BimPropertySet[];
};

export type BimAdapter = {
  dispose: () => void | Promise<void>;
  /**
   * Stages a model alongside already-open models. Does not close a
   * previous model — use {@link BimAdapter.unloadModel} or
   * {@link BimAdapter.dispose} to release one.
   */
  loadModel: (source: BimModelSource) => Promise<BimModelMetadata>;
  /** Drops one staged model. Unknown ids fail explicitly. */
  unloadModel?: (modelId: string) => void | Promise<void>;
  /** Currently staged models, in load order. */
  listModels?: () => readonly BimModelMetadata[];
  /**
   * Scene-only import. Mesh nodes may reference `geometryAssetId`; the
   * corresponding buffers live on {@link BimAdapter.getGeometryStore} or
   * {@link BimImportResult.geometryStore}.
   */
  toScene?: () => Promise<CanvasScene>;
  /**
   * Canonical import of every staged model into one document. Single-model
   * node/layer ids stay unprefixed; two or more models qualify ids with
   * `modelId` so express ids cannot collide.
   */
  toDocument?: () => Promise<BimImportResult>;
  getGeometryStore?: () => CanvasGeometryStore;
  /**
   * Lazy property-set reads. `expressID` is model-scoped, so every ref
   * carries `modelId`.
   */
  getElementProperties?: (
    refs: readonly BimElementRef[]
  ) => Promise<readonly BimElementProperties[]>;
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
  /** Adapter-assigned model id; pairs with `expressID` as the public key. */
  modelId: string;
  /** Optional pointer to lazy property sets (resolved by the adapter). */
  psets?: BimPropertySet[];
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
      "web-ifc (MPL-2.0) is the first-class IFC parser; import it from @de-novo/canvas-bim/web-ifc.",
      "@xeokit/xeokit-sdk is AGPL-3.0 — a separate viewer adapter may follow; core stays license-clean.",
      "Large parsing work should eventually run in @de-novo/canvas-worker."
    ]
  };
}
