/**
 * web-ifc-based {@link BimAdapter}. Parses an IFC `ArrayBuffer` into a Denovo
 * `CanvasScene` of `mesh` nodes (one per IFC element), grouped into layers by
 * IFC type category, with element provenance stored on `node.metadata`.
 *
 * Tessellation runs on the importing thread here; for large models prefer
 * `createWorkerBimAdapter` from `@denovo/canvas-bim/web-ifc-worker`, which
 * runs the same parse core inside a worker.
 *
 * Importable from `@denovo/canvas-bim/web-ifc` only — the contract entry
 * (`@denovo/canvas-bim`) stays free of the `web-ifc` dependency.
 *
 * @module @denovo/canvas-bim/web-ifc
 */

import {
  createMemoryGeometryStore,
  type CanvasGeometryStore,
  type CanvasScene
} from "@denovo/canvas-core";
import { IfcAPI } from "web-ifc";

import type { BimImportResult } from "./index.js";
import {
  BIM_METADATA_KEY,
  type BimAdapter,
  type BimModelMetadata,
  type BimModelSource,
  type BimPropertySet,
  type WebIfcWasmConfig
} from "./index.js";
import {
  DEFAULT_MAX_ELEMENTS,
  assembleBimDocument,
  parseIfcModel,
  readIfcPropertySets
} from "./web-ifc-parse.js";

export { DEFAULT_MAX_ELEMENTS };

export type WebIfcAdapterOptions = {
  /** How the adapter resolves the `web-ifc.wasm` binary. */
  wasm: WebIfcWasmConfig;
  /**
   * Hard cap on the number of elements converted to mesh nodes. Excess
   * elements are skipped. Default 5000.
   */
  maxElements?: number;
};

/**
 * Lazily-initialized singleton `IfcAPI`. `Init()` is idempotent and shared
 * across adapter instances so the WASM module loads once per page.
 */
let apiPromise: Promise<IfcAPI> | null = null;

async function getIfcApi(wasm: WebIfcWasmConfig): Promise<IfcAPI> {
  if (!apiPromise) {
    apiPromise = (async () => {
      const api = new IfcAPI();
      const locateFile = resolveLocateFile(wasm);
      await api.Init(locateFile ?? undefined);
      return api;
    })();
  }
  return apiPromise;
}

function resolveLocateFile(
  wasm: WebIfcWasmConfig
): ((path: string, prefix: string) => string) | null {
  if ("locateFile" in wasm) {
    return (path: string) => wasm.locateFile(path);
  }
  if ("wasmBaseUrl" in wasm) {
    const base = wasm.wasmBaseUrl;
    return (path: string) => `${base}${path}`;
  }
  // wasmModule — locateFile is irrelevant once the module is precompiled; web-ifc
  // resolves the cached module internally. We still return null and rely on the
  // caller having pre-warmed the API.
  return null;
}

export class WebIfcBimAdapter implements BimAdapter {
  private readonly wasm: WebIfcWasmConfig;
  private readonly maxElements: number;
  private staged:
    | { modelID: number; source: BimModelSource; skippedElementCount: number }
    | null = null;
  private readonly geometryStore: CanvasGeometryStore =
    createMemoryGeometryStore();

  constructor(options: WebIfcAdapterOptions) {
    this.wasm = options.wasm;
    this.maxElements = options.maxElements ?? DEFAULT_MAX_ELEMENTS;
  }

  async loadModel(source: BimModelSource): Promise<BimModelMetadata> {
    if (source.type !== "ifc") {
      throw new Error(
        "WebIfcBimAdapter only supports IFC sources; xkt requires the xeokit adapter."
      );
    }

    const api = await getIfcApi(this.wasm);
    if (this.staged) {
      try {
        api.CloseModel(this.staged.modelID);
      } catch {
        // Best-effort: a failed close must not block loading the next model.
      }
      this.staged = null;
    }
    const modelID = api.OpenModel(new Uint8Array(source.data), {
      COORDINATE_TO_ORIGIN: true
    });
    api.StreamAllMeshes(modelID, () => {
      // Stream to force geometry build.
    });

    // Parse eagerly so loadModel's metadata reflects real element counts and
    // toDocument() stays a pure assembly step.
    const output = parseIfcModel(api, modelID, this.maxElements);
    this.staged = {
      modelID,
      skippedElementCount: output.skippedElementCount,
      source
    };

    const metadata: BimModelMetadata = {
      id: source.name ?? `ifc-model-${modelID}`,
      sourceType: source.type,
      elementCount: output.elements.length
    };
    return metadata;
  }

  getGeometryStore(): CanvasGeometryStore {
    return this.geometryStore;
  }

  async toDocument(): Promise<BimImportResult> {
    if (!this.staged) {
      throw new Error(
        "WebIfcBimAdapter.toDocument called before loadModel resolved."
      );
    }

    const api = await getIfcApi(this.wasm);
    const { modelID, source } = this.staged;
    const output = parseIfcModel(api, modelID, this.maxElements);
    this.staged = { ...this.staged, skippedElementCount: output.skippedElementCount };

    const assembled = assembleBimDocument(
      output.elements,
      this.geometryStore,
      source.name ?? "ifc-scene",
      output.hierarchy
    );

    return { document: assembled.document, geometryStore: this.geometryStore };
  }

  async toScene(): Promise<CanvasScene> {
    const imported = await this.toDocument();
    return imported.document.scene;
  }

  async dispose(): Promise<void> {
    if (!this.staged) {
      return;
    }
    const api = await getIfcApi(this.wasm);
    api.CloseModel(this.staged.modelID);
    this.staged = null;
    this.geometryStore.clear();
  }

  /** Number of elements skipped past `maxElements` on the last parse. */
  getSkippedElementCount(): number {
    return this.staged?.skippedElementCount ?? 0;
  }

  /**
   * Reads IFC property sets for staged elements. Best-effort by contract:
   * elements without psets map to empty arrays.
   */
  async getElementProperties(
    expressIDs: readonly number[]
  ): Promise<Map<number, BimPropertySet[]>> {
    if (!this.staged) {
      throw new Error(
        "WebIfcBimAdapter.getElementProperties called before loadModel resolved."
      );
    }

    const api = await getIfcApi(this.wasm);
    return readIfcPropertySets(api, this.staged.modelID, expressIDs);
  }
}

export { BIM_METADATA_KEY };
