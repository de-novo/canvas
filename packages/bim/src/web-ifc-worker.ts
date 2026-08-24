/**
 * Worker-side handler for the BIM parsing tasks. Bundle this inside a module
 * worker and pair it with `createWorkerBimAdapter` on the main side:
 *
 * ```ts
 * // bim-worker.ts (consumer bundles)
 * import { createBimWorkerHandler } from "@denovo/canvas-bim/web-ifc-worker";
 * self.addEventListener("message", createBimWorkerHandler({ wasmBaseUrl: "/wasm/" }));
 * ```
 *
 * The WASM binary is fetched inside the worker, so tessellation — OpenModel,
 * LoadAllGeometry, vertex baking — never touches the main thread.
 *
 * @module @denovo/canvas-bim/web-ifc-worker
 */

import {
  createWorkerHandler,
  type WorkerHandler,
  type WorkerTaskDefinition
} from "@denovo/canvas-worker";
import { IfcAPI } from "web-ifc";

import type { BimPropertySet } from "./index.js";
import {
  DEFAULT_MAX_ELEMENTS,
  allocateModelId,
  parseIfcModel,
  readIfcPropertySets,
  type BimParseOutput
} from "./web-ifc-parse.js";
import type { WebIfcWasmConfig } from "./index.js";

export type BimIfcParseRequest = {
  /** Raw IFC bytes. Transferred in; neutered on the caller's side. */
  data: ArrayBuffer;
  maxElements?: number;
  /** Caller-assigned model id. Replaces a previously staged model of the same id. */
  modelId?: string;
};

export type BimIfcParseResult = BimParseOutput & {
  modelId: string;
};

export type BimIfcReadPropertiesRequest = {
  expressIDs: number[];
  modelId: string;
};

export type BimIfcReadPropertiesResult = {
  entries: readonly {
    expressID: number;
    psets: readonly BimPropertySet[];
  }[];
};

export type BimIfcCloseModelRequest = {
  modelId: string;
};

export type BimIfcCloseModelResult = {
  closed: boolean;
};

export type DenovoBimWorkerTaskMap = {
  "denovo.bim.parseIfc": WorkerTaskDefinition<
    BimIfcParseRequest,
    BimIfcParseResult
  >;
  "denovo.bim.readPropertySets": WorkerTaskDefinition<
    BimIfcReadPropertiesRequest,
    BimIfcReadPropertiesResult
  >;
  "denovo.bim.closeModel": WorkerTaskDefinition<
    BimIfcCloseModelRequest,
    BimIfcCloseModelResult
  >;
};

let apiPromise: Promise<IfcAPI> | null = null;
const stagedModels = new Map<string, number>();

/** Structural view of the WASM config so omission stays type-safe. */
type WasmResolution = {
  locateFile?: (file: string) => string;
  wasmBaseUrl?: string;
};

async function getIfcApi(wasm: WasmResolution): Promise<IfcAPI> {
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
  wasm: WasmResolution
): ((path: string) => string) | null {
  const { locateFile, wasmBaseUrl } = wasm;

  if (typeof locateFile === "function") {
    return (path: string) => locateFile(path);
  }

  if (typeof wasmBaseUrl === "string") {
    return (path: string) => `${wasmBaseUrl}${path}`;
  }

  return null;
}

async function closeStagedModel(
  api: IfcAPI,
  modelId: string
): Promise<boolean> {
  const wasmModelID = stagedModels.get(modelId);

  if (wasmModelID === undefined) {
    return false;
  }

  try {
    api.CloseModel(wasmModelID);
  } catch {
    // Best-effort close.
  }

  stagedModels.delete(modelId);
  return true;
}

/**
 * Ready-to-install handler for {@link DenovoBimWorkerTaskMap}. Parsed models
 * stay staged by `modelId` so property-set reads reuse the open WASM models.
 * A parse with an already-staged `modelId` replaces that slot only.
 *
 * `wasm` may be omitted in runtimes where web-ifc resolves its own binary
 * (Node); browsers should point `wasmBaseUrl` at the copied WASM assets.
 */
export function createBimWorkerHandler(
  options: { wasm?: WebIfcWasmConfig } = {}
): WorkerHandler<DenovoBimWorkerTaskMap> {
  return createWorkerHandler<DenovoBimWorkerTaskMap>({
    "denovo.bim.parseIfc": async ({ data, maxElements, modelId: requested }) => {
      const api = await getIfcApi((options.wasm ?? {}) as WasmResolution);
      const modelId =
        requested === undefined
          ? allocateModelId(undefined, stagedModels.keys())
          : requested;

      if (stagedModels.has(modelId)) {
        await closeStagedModel(api, modelId);
      }

      const wasmModelID = api.OpenModel(new Uint8Array(data), {
        COORDINATE_TO_ORIGIN: true
      });
      api.StreamAllMeshes(wasmModelID, () => {
        // Stream to force geometry build.
      });
      stagedModels.set(modelId, wasmModelID);

      const output = parseIfcModel(
        api,
        wasmModelID,
        maxElements ?? DEFAULT_MAX_ELEMENTS
      );

      return { ...output, modelId };
    },
    "denovo.bim.readPropertySets": async ({ expressIDs, modelId }) => {
      const wasmModelID = stagedModels.get(modelId);

      if (wasmModelID === undefined) {
        throw new Error(
          `denovo.bim.readPropertySets requires staged model "${modelId}"; run denovo.bim.parseIfc first.`
        );
      }

      const api = await getIfcApi((options.wasm ?? {}) as WasmResolution);
      const mapped = readIfcPropertySets(api, wasmModelID, expressIDs);

      return {
        entries: expressIDs.map((expressID) => ({
          expressID,
          psets: mapped.get(expressID) ?? []
        }))
      };
    },
    "denovo.bim.closeModel": async ({ modelId }) => {
      const api = await getIfcApi((options.wasm ?? {}) as WasmResolution);
      const closed = await closeStagedModel(api, modelId);
      return { closed };
    }
  });
}
