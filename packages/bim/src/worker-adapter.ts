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
  BimImportResult,
  BimModelMetadata,
  BimModelSource,
  BimPropertySet
} from "./index.js";
import {
  assembleBimDocument,
  DEFAULT_MAX_ELEMENTS
} from "./web-ifc-parse.js";
import type { BimParsedElement } from "./web-ifc-parse.js";
import type { DenovoBimWorkerTaskMap } from "./web-ifc-worker.js";

export { DEFAULT_MAX_ELEMENTS };

export type WorkerBimAdapterOptions = {
  /**
   * Queue whose workers run `createBimWorkerHandler`. Only the two
   * `denovo.bim.*` task types are requested.
   */
  queue: WorkerTaskQueue<DenovoBimWorkerTaskMap>;
  /** Hard cap forwarded to the worker. Default 5000. */
  maxElements?: number;
};

type StagedParse = {
  elements: BimParsedElement[];
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
    expressIDs: readonly number[]
  ) => Promise<Map<number, BimPropertySet[]>>;
  getSkippedElementCount: () => number;
} {
  const maxElements = options.maxElements ?? DEFAULT_MAX_ELEMENTS;
  const queue = options.queue;
  const geometryStore: CanvasGeometryStore = createMemoryGeometryStore();
  let staged: StagedParse | null = null;

  async function toDocument(): Promise<BimImportResult> {
    if (!staged) {
      throw new Error(
        "createWorkerBimAdapter.toDocument called before loadModel resolved."
      );
    }

    const assembled = assembleBimDocument(
      staged.elements,
      geometryStore,
      staged.source.name ?? "ifc-scene"
    );

    return { document: assembled.document, geometryStore };
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

      const result = await queue.request("denovo.bim.parseIfc", {
        data: source.data,
        maxElements
      }, [source.data]);

      staged = {
        elements: result.elements,
        skippedElementCount: result.skippedElementCount,
        source
      };

      return {
        id: staged.source.name ?? "ifc-model",
        sourceType: staged.source.type,
        elementCount: staged.elements.length
      };
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
      staged = null;
      geometryStore.clear();
    },

    getSkippedElementCount(): number {
      return staged?.skippedElementCount ?? 0;
    },

    async getElementProperties(
      expressIDs: readonly number[]
    ): Promise<Map<number, BimPropertySet[]>> {
      const record = await queue.request("denovo.bim.readPropertySets", {
        expressIDs: [...expressIDs]
      });

      const mapped = new Map<number, BimPropertySet[]>();

      for (const expressID of expressIDs) {
        mapped.set(expressID, record[String(expressID)] ?? []);
      }

      return mapped;
    }
  };
}
