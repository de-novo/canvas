/**
 * web-ifc-based {@link BimAdapter}. Parses an IFC `ArrayBuffer` into a Denovo
 * `CanvasScene` of `mesh` nodes (one per IFC element), grouped into layers by
 * building storey, with element provenance stored on `node.metadata`.
 *
 * Tessellation runs on the importing thread here; for large models prefer
 * `createWorkerBimAdapter` from `@de-novo/canvas-bim/web-ifc-worker`, which
 * runs the same parse core inside a worker.
 *
 * Importable from `@de-novo/canvas-bim/web-ifc` only — the contract entry
 * (`@de-novo/canvas-bim`) stays free of the `web-ifc` dependency.
 *
 * @module @de-novo/canvas-bim/web-ifc
 */

import {
  createMemoryGeometryStore,
  type CanvasGeometryStore,
  type CanvasScene
} from "@de-novo/canvas-core";
import { IfcAPI } from "web-ifc";

import type { BimImportResult } from "./index.js";
import {
  BIM_METADATA_KEY,
  type BimAdapter,
  type BimElementProperties,
  type BimElementRef,
  type BimModelMetadata,
  type BimModelOrigin,
  type BimModelSource,
  type WebIfcWasmConfig
} from "./index.js";
import {
  DEFAULT_MAX_ELEMENTS,
  allocateModelId,
  assembleBimDocument,
  parseIfcModel,
  readIfcPropertySets,
  resolveModelOrigin,
  type BimParsedElement,
  type BimSpatialHierarchy
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

type StagedModel = {
  elementCount: number;
  elements: BimParsedElement[];
  hierarchy?: BimSpatialHierarchy | undefined;
  modelId: string;
  origin?: BimModelOrigin | undefined;
  skippedElementCount: number;
  source: BimModelSource;
  wasmModelID: number;
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
  private readonly staged = new Map<string, StagedModel>();
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

    const origin = resolveModelOrigin(source.origin);
    const api = await getIfcApi(this.wasm);
    const modelId = allocateModelId(source.name, this.staged.keys());
    const wasmModelID = api.OpenModel(new Uint8Array(source.data), {
      COORDINATE_TO_ORIGIN: true
    });
    api.StreamAllMeshes(wasmModelID, () => {
      // Stream to force geometry build.
    });

    const output = parseIfcModel(api, wasmModelID, this.maxElements);
    this.staged.set(modelId, {
      elementCount: output.elements.length,
      elements: output.elements,
      hierarchy: output.hierarchy,
      modelId,
      origin,
      skippedElementCount: output.skippedElementCount,
      source,
      wasmModelID
    });

    return toModelMetadata(this.staged.get(modelId)!);
  }

  async unloadModel(modelId: string): Promise<void> {
    const staged = this.staged.get(modelId);

    if (!staged) {
      throw new Error(
        `WebIfcBimAdapter.unloadModel called with unknown model id "${modelId}".`
      );
    }

    const api = await getIfcApi(this.wasm);
    try {
      api.CloseModel(staged.wasmModelID);
    } catch {
      // Best-effort: a failed close must not leave the registry inconsistent.
    }
    this.staged.delete(modelId);
  }

  listModels(): readonly BimModelMetadata[] {
    return [...this.staged.values()].map(toModelMetadata);
  }

  getGeometryStore(): CanvasGeometryStore {
    return this.geometryStore;
  }

  async toDocument(): Promise<BimImportResult> {
    if (this.staged.size === 0) {
      throw new Error(
        "WebIfcBimAdapter.toDocument called before loadModel resolved."
      );
    }

    const models = [...this.staged.values()].map((staged) => ({
      elements: staged.elements,
      hierarchy: staged.hierarchy,
      modelId: staged.modelId,
      modelName: staged.source.name,
      origin: staged.origin
    }));
    const sceneId =
      models.length === 1
        ? (models[0]?.modelName ?? "ifc-scene")
        : "federated-ifc";
    const assembled = assembleBimDocument(models, this.geometryStore, sceneId);

    return { document: assembled.document, geometryStore: this.geometryStore };
  }

  async toScene(): Promise<CanvasScene> {
    const imported = await this.toDocument();
    return imported.document.scene;
  }

  async dispose(): Promise<void> {
    if (this.staged.size === 0) {
      this.geometryStore.clear();
      return;
    }

    const api = await getIfcApi(this.wasm);

    for (const staged of this.staged.values()) {
      try {
        api.CloseModel(staged.wasmModelID);
      } catch {
        // Best-effort close of each WASM model.
      }
    }

    this.staged.clear();
    this.geometryStore.clear();
  }

  /** Sum of elements skipped past `maxElements` across staged models. */
  getSkippedElementCount(): number {
    let skipped = 0;

    for (const staged of this.staged.values()) {
      skipped += staged.skippedElementCount;
    }

    return skipped;
  }

  /**
   * Reads IFC property sets for staged elements. Best-effort by contract:
   * elements without psets map to empty arrays. Each ref must name its
   * `modelId` — express ids are model-scoped.
   */
  async getElementProperties(
    refs: readonly BimElementRef[]
  ): Promise<readonly BimElementProperties[]> {
    const api = await getIfcApi(this.wasm);
    const grouped = groupRefsByModel(refs);
    const results: BimElementProperties[] = [];

    for (const [modelId, expressIDs] of grouped) {
      const staged = this.staged.get(modelId);

      if (!staged) {
        throw new Error(
          `WebIfcBimAdapter.getElementProperties referenced unknown model "${modelId}".`
        );
      }

      const mapped = readIfcPropertySets(api, staged.wasmModelID, expressIDs);

      for (const expressID of expressIDs) {
        results.push({
          expressID,
          modelId,
          psets: mapped.get(expressID) ?? []
        });
      }
    }

    return results;
  }
}

export { BIM_METADATA_KEY };

function toModelMetadata(staged: StagedModel): BimModelMetadata {
  return {
    elementCount: staged.elementCount,
    id: staged.modelId,
    ...(staged.source.name === undefined ? {} : { name: staged.source.name }),
    ...(staged.origin === undefined ? {} : { origin: staged.origin }),
    sourceType: staged.source.type
  };
}

function groupRefsByModel(
  refs: readonly BimElementRef[]
): Map<string, number[]> {
  const grouped = new Map<string, number[]>();

  for (const ref of refs) {
    const existing = grouped.get(ref.modelId) ?? [];
    existing.push(ref.expressID);
    grouped.set(ref.modelId, existing);
  }

  return grouped;
}
