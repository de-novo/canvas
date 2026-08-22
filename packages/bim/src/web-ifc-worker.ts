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
  parseIfcModel,
  readIfcPropertySets,
  type BimParseOutput
} from "./web-ifc-parse.js";
import type { WebIfcWasmConfig } from "./index.js";

export type BimIfcParseRequest = {
  /** Raw IFC bytes. Transferred in; neutered on the caller's side. */
  data: ArrayBuffer;
  maxElements?: number;
};

export type BimIfcReadPropertiesRequest = {
  expressIDs: number[];
};

export type DenovoBimWorkerTaskMap = {
  "denovo.bim.parseIfc": WorkerTaskDefinition<
    BimIfcParseRequest,
    BimParseOutput
  >;
  "denovo.bim.readPropertySets": WorkerTaskDefinition<
    BimIfcReadPropertiesRequest,
    Record<string, BimPropertySet[]>
  >;
};

let apiPromise: Promise<IfcAPI> | null = null;
let stagedModelID: number | null = null;

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

/**
 * Ready-to-install handler for {@link DenovoBimWorkerTaskMap}. The parsed
 * model stays staged inside the worker so property-set reads reuse the open
 * model; a new parse closes the previous one.
 *
 * `wasm` may be omitted in runtimes where web-ifc resolves its own binary
 * (Node); browsers should point `wasmBaseUrl` at the copied WASM assets.
 */
export function createBimWorkerHandler(
  options: { wasm?: WebIfcWasmConfig } = {}
): WorkerHandler<DenovoBimWorkerTaskMap> {
  return createWorkerHandler<DenovoBimWorkerTaskMap>({
    "denovo.bim.parseIfc": async ({ data, maxElements }) => {
      const api = await getIfcApi((options.wasm ?? {}) as WasmResolution);

      if (stagedModelID !== null) {
        try {
          api.CloseModel(stagedModelID);
        } catch {
          // Best-effort close.
        }
        stagedModelID = null;
      }

      const modelID = api.OpenModel(new Uint8Array(data), {
        COORDINATE_TO_ORIGIN: true
      });
      api.StreamAllMeshes(modelID, () => {
        // Stream to force geometry build.
      });
      stagedModelID = modelID;

      return parseIfcModel(api, modelID, maxElements ?? DEFAULT_MAX_ELEMENTS);
    },
    "denovo.bim.readPropertySets": async ({ expressIDs }) => {
      if (stagedModelID === null) {
        throw new Error(
          "denovo.bim.readPropertySets requires a staged model; run denovo.bim.parseIfc first."
        );
      }

      const api = await getIfcApi((options.wasm ?? {}) as WasmResolution);
      const mapped = readIfcPropertySets(api, stagedModelID, expressIDs);
      const record: Record<string, BimPropertySet[]> = {};

      for (const [expressID, psets] of mapped) {
        record[String(expressID)] = psets;
      }

      return record;
    }
  });
}
