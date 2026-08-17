/**
 * web-ifc-based {@link BimAdapter}. Parses an IFC `ArrayBuffer` into a Denovo
 * `CanvasScene` of `mesh` nodes (one per IFC element), grouped into layers by
 * IFC type category, with element provenance stored on `node.metadata`.
 *
 * Importable from `@denovo/canvas-bim/web-ifc` only — the contract entry
 * (`@denovo/canvas-bim`) stays free of the `web-ifc` dependency.
 *
 * @module @denovo/canvas-bim/web-ifc
 */

import type {
  Canvas3DNode,
  CanvasLayer,
  CanvasScene,
  JsonValue
} from "@denovo/canvas-core";
import { IfcAPI } from "web-ifc";

import {
  BIM_METADATA_KEY,
  type BimAdapter,
  type BimModelMetadata,
  type BimModelSource,
  type WebIfcWasmConfig
} from "./index.js";
import { resolveIfcCategory } from "./ifc-categories.js";

export type WebIfcAdapterOptions = {
  /** How the adapter resolves the `web-ifc.wasm` binary. */
  wasm: WebIfcWasmConfig;
  /**
   * Hard cap on the number of elements converted to mesh nodes. Excess
   * elements are skipped. Default 5000.
   */
  maxElements?: number;
};

const DEFAULT_MAX_ELEMENTS = 5000;

type StagedModel = {
  modelID: number;
  source: BimModelSource;
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
  private staged: StagedModel | null = null;
  private skippedElementCount = 0;

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
    const modelID = api.OpenModel(new Uint8Array(source.data), {
      COORDINATE_TO_ORIGIN: true
    });
    api.StreamAllMeshes(modelID, () => {
      // Stream to force geometry build; counting happens via LoadAllGeometry below.
    });

    const meshes = api.LoadAllGeometry(modelID);
    const elementCount = meshes.size();

    this.staged = { modelID, source };

    const metadata: BimModelMetadata = {
      id: source.name ?? `ifc-model-${modelID}`,
      sourceType: source.type,
      ...(elementCount === undefined ? {} : { elementCount })
    };
    return metadata;
  }

  async toScene(): Promise<CanvasScene> {
    if (!this.staged) {
      throw new Error(
        "WebIfcBimAdapter.toScene called before loadModel resolved."
      );
    }

    const api = await getIfcApi(this.wasm);
    const { modelID, source } = this.staged;
    const meshes = api.LoadAllGeometry(modelID);

    const layers = new Map<string, CanvasLayer>();
    const nodes: Canvas3DNode[] = [];
    const total = meshes.size();
    const limit = Math.min(total, this.maxElements);
    this.skippedElementCount = Math.max(0, total - limit);

    for (let index = 0; index < limit; index += 1) {
      const flatMesh = meshes.get(index);
      const node = this.buildElementNode(api, modelID, flatMesh);
      if (node) {
        ensureLayer(layers, node.layerId);
        nodes.push(node);
      }
    }

    if (layers.size === 0) {
      layers.set("default", {
        id: "default",
        name: "Default",
        visible: true,
        locked: false,
        metadata: {}
      });
    }

    const scene = {
      id: source.name ?? "ifc-scene",
      mode: "3d" as const,
      background: "#0f172a",
      layers: Array.from(layers.values()),
      nodes,
      render: {
        loop: "demand" as const,
        dpr: 1.5,
        frustumCulling: true,
        batch: false
      },
      camera: {
        position: [0, 0, 0] as [number, number, number],
        target: [0, 0, 0] as [number, number, number],
        fov: 50
      }
    };

    return scene as unknown as CanvasScene;
  }

  async dispose(): Promise<void> {
    if (!this.staged) {
      return;
    }
    const api = await getIfcApi(this.wasm);
    api.CloseModel(this.staged.modelID);
    this.staged = null;
  }

  /** Number of elements skipped past `maxElements` on the last `toScene()`. */
  getSkippedElementCount(): number {
    return this.skippedElementCount;
  }

  private buildElementNode(
    api: IfcAPI,
    modelID: number,
    flatMesh: { expressID: number; geometries: { size(): number; get(i: number): { flatTransformation: number[]; geometryExpressID: number } } }
  ): Canvas3DNode | null {
    const expressID = flatMesh.expressID;
    const partCount = flatMesh.geometries.size();

    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    let hasNormals = false;

    for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
      const placed = flatMesh.geometries.get(partIndex);
      const geometry = api.GetGeometry(modelID, placed.geometryExpressID);
      const vertexData = api.GetVertexArray(
        geometry.GetVertexData(),
        geometry.GetVertexDataSize()
      );
      const indexData = api.GetIndexArray(
        geometry.GetIndexData(),
        geometry.GetIndexDataSize()
      );
      const transform = placed.flatTransformation;

      const vertexBaseOffset = positions.length / 3;

      // web-ifc interleaves [x, y, z, nx, ny, nz] per vertex.
      for (let v = 0; v < vertexData.length; v += 6) {
        const px = vertexData[v] ?? 0;
        const py = vertexData[v + 1] ?? 0;
        const pz = vertexData[v + 2] ?? 0;
        const [wx, wy, wz] = transformPoint(transform, px, py, pz);
        positions.push(wx, wy, wz);

        const nx = vertexData[v + 3];
        const ny = vertexData[v + 4];
        const nz = vertexData[v + 5];
        if (nx !== undefined && ny !== undefined && nz !== undefined) {
          const [wnx, wny, wnz] = transformNormal(transform, nx, ny, nz);
          normals.push(wnx, wny, wnz);
          hasNormals = true;
        }
      }

      for (let i = 0; i < indexData.length; i += 1) {
        indices.push((indexData[i] ?? 0) + vertexBaseOffset);
      }
    }

    if (positions.length < 9 || indices.length < 3) {
      return null;
    }

    const { ifcType, ifcGuid, ifcName } = readElementIdentity(api, modelID, expressID);
    const category = resolveIfcCategory(ifcType);

    const nodeMetadata: Record<string, JsonValue> = {
      [BIM_METADATA_KEY]: {
        ifcGuid,
        ifcType,
        ...(ifcName === undefined ? {} : { ifcName }),
        expressID
      }
    };

    return {
      type: "mesh",
      id: `ifc-element-${expressID}`,
      layerId: category.layerId,
      visible: true,
      locked: false,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: category.color ?? "#9ca3af",
      positions,
      indices,
      ...(hasNormals ? { normals } : {}),
      wireframe: false,
      parentId: null,
      metadata: nodeMetadata
    } as Canvas3DNode;
  }
}

function ensureLayer(layers: Map<string, CanvasLayer>, layerId: string): void {
  if (layers.has(layerId)) {
    return;
  }
  // Derive a readable name from the layer id for the common categories.
  const entry = [...CATEGORY_NAME_FALLBACKS].find(([id]) => id === layerId);
  const name = entry ? entry[1] : layerId;
  layers.set(layerId, {
    id: layerId,
    name,
    visible: true,
    locked: false,
    metadata: {}
  });
}

const CATEGORY_NAME_FALLBACKS: ReadonlyArray<readonly [string, string]> = [
  ["walls", "Walls"],
  ["slabs", "Slabs"],
  ["columns", "Columns"],
  ["beams", "Beams"],
  ["foundations", "Foundations"],
  ["roofs", "Roofs"],
  ["curtain-walls", "Curtain Walls"],
  ["doors", "Doors"],
  ["windows", "Windows"],
  ["spaces", "Spaces"],
  ["storeys", "Storeys"],
  ["furniture", "Furniture"],
  ["mep-flow", "MEP Flow"],
  ["mep-fittings", "MEP Fittings"],
  ["mep-terminals", "MEP Terminals"],
  ["railings", "Railings"],
  ["stairs", "Stairs"],
  ["site", "Site"],
  ["default", "Default"]
];

function readElementIdentity(
  api: IfcAPI,
  modelID: number,
  expressID: number
): { ifcType: string; ifcGuid: string; ifcName?: string } {
  let ifcType = "IfcRoot";
  let ifcName: string | undefined;
  try {
    const entity = api.GetLine(modelID, expressID, false);
    ifcType =
      (entity?.constructor?.name as string | undefined) ?? ifcType;
    const nameAttr = entity?.Name?.value;
    if (typeof nameAttr === "string" && nameAttr.length > 0) {
      ifcName = nameAttr;
    }
  } catch {
    // Identity is best-effort; geometry still renders if the line read fails.
  }

  let ifcGuid = `express-${expressID}`;
  try {
    const guid = api.GetGuidFromExpressId(modelID, expressID);
    if (typeof guid === "string" && guid.length > 0) {
      ifcGuid = guid;
    }
  } catch {
    // fall back to express id
  }

  return { ifcType, ifcGuid, ...(ifcName === undefined ? {} : { ifcName }) };
}

function at(flat: number[], index: number): number {
  return flat[index] ?? 0;
}

/**
 * Transforms a point by a column-major 4x4 matrix (16 floats, web-ifc's
 * `flatTransformation`). Column-major means translation lives in elements
 * 12/13/14.
 */
function transformPoint(
  flat: number[],
  x: number,
  y: number,
  z: number
): [number, number, number] {
  return [
    at(flat, 0) * x + at(flat, 1) * y + at(flat, 2) * z + at(flat, 3),
    at(flat, 4) * x + at(flat, 5) * y + at(flat, 6) * z + at(flat, 7),
    at(flat, 8) * x + at(flat, 9) * y + at(flat, 10) * z + at(flat, 11)
  ];
}

function transformNormal(
  flat: number[],
  x: number,
  y: number,
  z: number
): [number, number, number] {
  // Approximate: apply rotation columns, then normalize. Good enough for
  // shading without computing the inverse-transpose.
  const nx = at(flat, 0) * x + at(flat, 1) * y + at(flat, 2) * z;
  const ny = at(flat, 4) * x + at(flat, 5) * y + at(flat, 6) * z;
  const nz = at(flat, 8) * x + at(flat, 9) * y + at(flat, 10) * z;
  const length = Math.hypot(nx, ny, nz) || 1;
  return [nx / length, ny / length, nz / length];
}
