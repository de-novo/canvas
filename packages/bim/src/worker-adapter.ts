/**
 * Main-side {@link BimAdapter} that delegates tessellation to a
 * `@denovo/canvas-worker` queue running `createBimWorkerHandler`. Parsing
 * (OpenModel + LoadAllGeometry + vertex baking) runs off the main thread;
 * this adapter only assembles the document from transferable results.
 *
 * @module @denovo/canvas-bim/web-ifc-worker
 */

import {
  createMemoryGeometryStore,
  type CanvasGeometryStore,
  type CanvasScene
} from "@denovo/canvas-core";
import type { WorkerTaskQueue } from "@denovo/canvas-worker";

import type {
  BimAdapter,
  BimElementProperties,
  BimElementRef,
  BimImportResult,
  BimModelMetadata,
  BimModelOrigin,
  BimModelSource
} from "./index.js";
import {
  allocateModelId,
  assembleBimDocument,
  DEFAULT_MAX_ELEMENTS,
  resolveModelOrigin
} from "./web-ifc-parse.js";
import type { BimParsedElement, BimSpatialHierarchy } from "./web-ifc-parse.js";
import type { DenovoBimWorkerTaskMap } from "./web-ifc-worker.js";

export { DEFAULT_MAX_ELEMENTS };

export type WorkerBimAdapterOptions = {
  /**
   * Queue whose workers run `createBimWorkerHandler`. Only the
   * `denovo.bim.*` task types are requested.
   */
  queue: WorkerTaskQueue<DenovoBimWorkerTaskMap>;
  /** Hard cap forwarded to the worker. Default 5000. */
  maxElements?: number;
};

type StagedParse = {
  elementCount: number;
  elements: BimParsedElement[];
  hierarchy?: BimSpatialHierarchy | undefined;
  modelId: string;
  origin?: BimModelOrigin | undefined;
  skippedElementCount: number;
  source: BimModelSource;
};

/**
 * Worker-backed BIM adapter. The returned object satisfies the same
 * {@link BimAdapter} contract as `WebIfcBimAdapter` and adds
 * `getElementProperties` plus the skipped-element accessor.
 */
export function createWorkerBimAdapter(
  options: WorkerBimAdapterOptions
): BimAdapter & {
  getElementProperties: (
    refs: readonly BimElementRef[]
  ) => Promise<readonly BimElementProperties[]>;
  getSkippedElementCount: () => number;
  listModels: () => readonly BimModelMetadata[];
  unloadModel: (modelId: string) => Promise<void>;
} {
  const maxElements = options.maxElements ?? DEFAULT_MAX_ELEMENTS;
  const queue = options.queue;
  const geometryStore: CanvasGeometryStore = createMemoryGeometryStore();
  const staged = new Map<string, StagedParse>();

  function listModels(): readonly BimModelMetadata[] {
    return [...staged.values()].map(toModelMetadata);
  }

  async function toDocument(): Promise<BimImportResult> {
    if (staged.size === 0) {
      throw new Error(
        "createWorkerBimAdapter.toDocument called before loadModel resolved."
      );
    }

    const models = [...staged.values()].map((entry) => ({
      elements: entry.elements,
      hierarchy: entry.hierarchy,
      modelId: entry.modelId,
      modelName: entry.source.name,
      origin: entry.origin
    }));
    const sceneId =
      models.length === 1
        ? (models[0]?.modelName ?? "ifc-scene")
        : "federated-ifc";
    const assembled = assembleBimDocument(models, geometryStore, sceneId);

    return { document: assembled.document, geometryStore };
  }

  async function unloadModel(modelId: string): Promise<void> {
    if (!staged.has(modelId)) {
      throw new Error(
        `createWorkerBimAdapter.unloadModel called with unknown model id "${modelId}".`
      );
    }

    await queue.request("denovo.bim.closeModel", { modelId });
    staged.delete(modelId);
  }

  return {
    async loadModel(source: BimModelSource): Promise<BimModelMetadata> {
      if (source.type !== "ifc") {
        throw new Error(
          "The worker BIM adapter only supports IFC sources; xkt requires the xeokit adapter."
        );
      }

      if (!(source.data instanceof ArrayBuffer)) {
        throw new Error(
          "IFC worker parsing requires ArrayBuffer source data."
        );
      }

      const origin = resolveModelOrigin(source.origin);
      const modelId = allocateModelId(source.name, staged.keys());
      const result = await queue.request(
        "denovo.bim.parseIfc",
        {
          data: source.data,
          maxElements,
          modelId
        },
        [source.data]
      );

      staged.set(modelId, {
        elementCount: result.elements.length,
        elements: result.elements,
        hierarchy: result.hierarchy,
        modelId,
        origin,
        skippedElementCount: result.skippedElementCount,
        source
      });

      return toModelMetadata(staged.get(modelId)!);
    },

    getGeometryStore(): CanvasGeometryStore {
      return geometryStore;
    },

    toDocument,

    async toScene(): Promise<CanvasScene> {
      const imported = await toDocument();
      return imported.document.scene;
    },

    async dispose(): Promise<void> {
      const modelIds = [...staged.keys()];
      staged.clear();
      geometryStore.clear();

      for (const modelId of modelIds) {
        try {
          await queue.request("denovo.bim.closeModel", { modelId });
        } catch {
          // Best-effort close of each worker-side WASM model.
        }
      }
    },

    unloadModel,

    listModels,

    getSkippedElementCount(): number {
      let skipped = 0;

      for (const entry of staged.values()) {
        skipped += entry.skippedElementCount;
      }

      return skipped;
    },

    async getElementProperties(
      refs: readonly BimElementRef[]
    ): Promise<readonly BimElementProperties[]> {
      const grouped = new Map<string, number[]>();

      for (const ref of refs) {
        const existing = grouped.get(ref.modelId) ?? [];
        existing.push(ref.expressID);
        grouped.set(ref.modelId, existing);
      }

      const results: BimElementProperties[] = [];

      for (const [modelId, expressIDs] of grouped) {
        if (!staged.has(modelId)) {
          throw new Error(
            `createWorkerBimAdapter.getElementProperties referenced unknown model "${modelId}".`
          );
        }

        const record = await queue.request("denovo.bim.readPropertySets", {
          expressIDs,
          modelId
        });
        const psetsById = new Map(
          record.entries.map((entry) => [entry.expressID, entry.psets])
        );

        for (const expressID of expressIDs) {
          results.push({
            expressID,
            modelId,
            psets: psetsById.get(expressID) ?? []
          });
        }
      }

      return results;
    }
  };
}

function toModelMetadata(entry: StagedParse): BimModelMetadata {
  return {
    elementCount: entry.elementCount,
    id: entry.modelId,
    ...(entry.source.name === undefined ? {} : { name: entry.source.name }),
    ...(entry.origin === undefined ? {} : { origin: entry.origin }),
    sourceType: entry.source.type
  };
}
