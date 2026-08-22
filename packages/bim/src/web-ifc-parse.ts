/**
 * Shared web-ifc tessellation core. Runs identically on the main thread
 * (`WebIfcBimAdapter`) and inside a dedicated worker
 * (`createBimWorkerHandler`); both produce transferable typed arrays so the
 * worker path never copies geometry across the boundary.
 *
 * @module @denovo/canvas-bim/web-ifc
 */

import {
  createMeshGeometryAssetRef,
  defineDocument,
  defineMeshGeometry,
  defineScene,
  type AssetRef,
  type Canvas3DNode,
  type CanvasDocument,
  type CanvasGeometryStore,
  type CanvasLayer,
  type CanvasMeshGeometry,
  type JsonValue
} from "@denovo/canvas-core";
import {
  IFCBUILDINGSTOREY,
  IFCPROPERTYSET,
  IFCRELCONTAINEDINSPATIALSTRUCTURE,
  IFCRELDEFINESBYPROPERTIES,
  IfcAPI
} from "web-ifc";

import {
  BIM_METADATA_KEY,
  type BimPropertySet
} from "./index.js";
import { resolveIfcCategory } from "./ifc-categories.js";

export const DEFAULT_MAX_ELEMENTS = 5000;

export type BimParsedElement = {
  color: string;
  ifcGuid: string;
  ifcName?: string;
  ifcType: string;
  indices: Uint32Array;
  layerId: string;
  nodeId: string;
  normals?: Float32Array;
  positions: Float32Array;
};

/**
 * Storey layers resolved from the IFC spatial structure. Layers are the
 * document's isolation vocabulary, so one layer per building storey gives
 * level navigation and hide/show for free; categories stay on
 * `metadata.__bim.ifcType` and node colours.
 */
export type BimSpatialHierarchy = {
  /** Element expressID → owning storey layer id. */
  readonly elementLayerById: ReadonlyMap<number, string>;
  /** Storey layers in document order. */
  readonly storeyLayers: readonly {
    readonly id: string;
    readonly name: string;
  }[];
};

export type BimParseOutput = {
  elements: BimParsedElement[];
  hierarchy?: BimSpatialHierarchy | undefined;
  skippedElementCount: number;
};

type FlatMesh = {
  expressID: number;
  geometries: {
    size(): number;
    get(i: number): { flatTransformation: number[]; geometryExpressID: number };
  };
};

export function parseIfcModel(
  api: IfcAPI,
  modelID: number,
  maxElements: number = DEFAULT_MAX_ELEMENTS
): BimParseOutput {
  const meshes = api.LoadAllGeometry(modelID);
  const total = meshes.size();
  const limit = Math.min(total, Math.max(1, maxElements));
  const elements: BimParsedElement[] = [];
  const hierarchy = buildSpatialHierarchy(api, modelID);

  for (let index = 0; index < limit; index += 1) {
    const flatMesh = meshes.get(index) as FlatMesh | undefined;

    if (!flatMesh) {
      continue;
    }

    const element = buildElement(api, modelID, flatMesh);

    if (element) {
      // Storey containment overrides the category layer: layers are the
      // document's isolation vocabulary, so one layer per storey gives
      // level navigation and hide/show for free.
      const storeyLayerId = hierarchy.elementLayerById.get(flatMesh.expressID);

      if (storeyLayerId !== undefined) {
        element.layerId = storeyLayerId;
      }

      elements.push(element);
    }
  }

  return {
    elements,
    hierarchy,
    skippedElementCount: Math.max(0, total - limit)
  };
}

/**
 * Walks the IFC spatial structure — building storeys via
 * `IfcBuildingStorey`, elements → storeys via
 * `IfcRelContainedInSpatialStructure` — and returns one storey layer per
 * storey plus the element→layer mapping. Best-effort: a model without
 * spatial structure yields no layers and every element keeps its category
 * layer.
 */
export function buildSpatialHierarchy(
  api: IfcAPI,
  modelID: number
): BimSpatialHierarchy {
  const elementLayerById = new Map<number, string>();
  const storeyLayers: { id: string; name: string }[] = [];
  const layerIdByStoreyId = new Map<number, string>();

  try {
    const storeyIds = api.GetLineIDsWithType(modelID, IFCBUILDINGSTOREY);

    for (let index = 0; index < storeyIds.size(); index += 1) {
      const expressID = storeyIds.get(index);
      let identity: ReturnType<typeof readElementIdentity>;

      try {
        identity = readElementIdentity(api, modelID, expressID);
      } catch {
        identity = {
          ifcGuid: `express-${expressID}`,
          ifcType: "IfcBuildingStorey"
        };
      }

      const id = `ifc-storey-${expressID}`;
      layerIdByStoreyId.set(expressID, id);
      storeyLayers.push({
        id,
        name:
          identity.ifcName === undefined
            ? `Storey ${storeyLayers.length + 1}`
            : identity.ifcName
      });
    }
  } catch {
    // Structure walking is best-effort.
  }

  try {
    const containedIds = api.GetLineIDsWithType(
      modelID,
      IFCRELCONTAINEDINSPATIALSTRUCTURE
    );

    for (let index = 0; index < containedIds.size(); index += 1) {
      const relation = api.GetLine(modelID, containedIds.get(index)) as
        | {
            RelatingStructure?: { value?: number };
            RelatedElements?: Array<{ value?: number }>;
          }
        | undefined;
      const structureLayerId =
        typeof relation?.RelatingStructure?.value === "number"
          ? layerIdByStoreyId.get(relation.RelatingStructure.value)
          : undefined;

      if (!structureLayerId) {
        continue;
      }

      for (const related of relation?.RelatedElements ?? []) {
        const elementId = related?.value;

        if (
          typeof elementId === "number" &&
          !elementLayerById.has(elementId)
        ) {
          elementLayerById.set(elementId, structureLayerId);
        }
      }
    }
  } catch {
    // Containment walking is best-effort.
  }

  return { elementLayerById, storeyLayers };
}

function buildElement(
  api: IfcAPI,
  modelID: number,
  flatMesh: FlatMesh
): BimParsedElement | null {
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

  const { ifcType, ifcGuid, ifcName } = readElementIdentity(
    api,
    modelID,
    expressID
  );
  const category = resolveIfcCategory(ifcType);

  return {
    color: category.color ?? "#9ca3af",
    ifcGuid,
    ifcType,
    ...(ifcName === undefined ? {} : { ifcName }),
    indices: Uint32Array.from(indices),
    layerId: category.layerId,
    nodeId: `ifc-element-${expressID}`,
    ...(hasNormals ? { normals: Float32Array.from(normals) } : {}),
    positions: Float32Array.from(positions)
  };
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
    at(flat, 0) * x + at(flat, 4) * y + at(flat, 8) * z + at(flat, 12),
    at(flat, 1) * x + at(flat, 5) * y + at(flat, 9) * z + at(flat, 13),
    at(flat, 2) * x + at(flat, 6) * y + at(flat, 10) * z + at(flat, 14)
  ];
}

function transformNormal(
  flat: number[],
  x: number,
  y: number,
  z: number
): [number, number, number] {
  // Approximate: apply the linear 3x3, then normalize. Good enough for
  // shading without computing the inverse-transpose.
  const nx = at(flat, 0) * x + at(flat, 4) * y + at(flat, 8) * z;
  const ny = at(flat, 1) * x + at(flat, 5) * y + at(flat, 9) * z;
  const nz = at(flat, 2) * x + at(flat, 6) * y + at(flat, 10) * z;
  const length = Math.hypot(nx, ny, nz) || 1;
  return [nx / length, ny / length, nz / length];
}

function readElementIdentity(
  api: IfcAPI,
  modelID: number,
  expressID: number
): { ifcType: string; ifcGuid: string; ifcName?: string } {  let ifcType = "IfcRoot";
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

/**
 * Reads IFC property sets (`IfcPropertySet` → `IfcPropertySingleValue`) for
 * the given elements through their `IfcRelDefinesByProperties` relations.
 * Best-effort by contract: unreadable models resolve to empty arrays, and
 * geometry always wins over metadata.
 */
export function readIfcPropertySets(
  api: IfcAPI,
  modelID: number,
  expressIDs: readonly number[]
): Map<number, BimPropertySet[]> {
  const result = new Map<number, BimPropertySet[]>();

  for (const expressID of expressIDs) {
    result.set(expressID, []);
  }

  try {
    const psetIds = api.GetLineIDsWithType(modelID, IFCPROPERTYSET);

    for (let index = 0; index < psetIds.size(); index += 1) {
      const psetId = psetIds.get(index);
      const pset = api.GetLine(modelID, psetId) as
        | {
            Name?: { value?: string };
          }
        | undefined;

      const name = pset?.Name?.value;
      if (typeof name !== "string" || name.length === 0) {
        continue;
      }

      const properties = readPsetProperties(api, modelID, psetId);

      attachPsetToElements(api, modelID, psetId, { name, properties }, result);
    }
  } catch {
    // Property reading is best-effort; geometry wins over metadata.
  }

  return result;
}

function readPsetProperties(
  api: IfcAPI,
  modelID: number,
  psetId: number
): BimPropertySet["properties"] {
  const properties: BimPropertySet["properties"] = {};

  try {
    const pset = api.GetLine(modelID, psetId, true) as
      | {
          HasProperties?: Array<{
            Name?: { value?: string };
            NominalValue?: { value?: string | number | boolean | null };
          }>;
        }
      | undefined;

    for (const property of pset?.HasProperties ?? []) {
      const key = property?.Name?.value;
      if (typeof key !== "string" || key.length === 0) {
        continue;
      }

      const value = property?.NominalValue?.value;
      properties[key] =
        value === undefined ? null : (value as string | number | boolean | null);
    }
  } catch {
    // Keep whatever was collected before the failure.
  }

  return properties;
}

function attachPsetToElements(
  api: IfcAPI,
  modelID: number,
  psetId: number,
  pset: BimPropertySet,
  result: Map<number, BimPropertySet[]>
): void {
  try {
    const relations = api.GetLineIDsWithType(
      modelID,
      IFCRELDEFINESBYPROPERTIES
    );

    for (let index = 0; index < relations.size(); index += 1) {
      const relation = api.GetLine(modelID, relations.get(index)) as
        | {
            RelatingPropertyDefinition?: { value?: number };
            RelatedObjects?: Array<{ value?: number }>;
          }
        | undefined;

      if (relation?.RelatingPropertyDefinition?.value !== psetId) {
        continue;
      }

      for (const related of relation.RelatedObjects ?? []) {
        const expressID = related?.value;
        if (typeof expressID !== "number" || !result.has(expressID)) {
          continue;
        }

        const existing = result.get(expressID) ?? [];
        existing.push(pset);
        result.set(expressID, existing);
      }
    }
  } catch {
    // Relation walking is best-effort.
  }
}

/** Builds the canonical `node.metadata[BIM_METADATA_KEY]` payload. */
export function buildBimMetadata(element: {
  ifcGuid: string;
  ifcType: string;
  ifcName?: string;
  expressID: number;
}): Record<string, JsonValue> {
  return {
    [BIM_METADATA_KEY]: {
      ifcGuid: element.ifcGuid,
      ifcType: element.ifcType,
      ...(element.ifcName === undefined ? {} : { ifcName: element.ifcName }),
      expressID: element.expressID
    }
  };
}

/** Converts parsed typed arrays into a store-ready mesh geometry. */
export function toMeshGeometry(element: {
  indices: Uint32Array;
  normals?: Float32Array;
  positions: Float32Array;
}): CanvasMeshGeometry {
  return defineMeshGeometry({
    schema: "denovo.mesh-geometry.v1",
    indices: Array.from(element.indices),
    ...(element.normals ? { normals: Array.from(element.normals) } : {}),
    positions: Array.from(element.positions)
  });
}

const CATEGORY_LAYER_NAMES: ReadonlyArray<readonly [string, string]> = [
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

function layerNameForId(layerId: string): string {
  const entry = CATEGORY_LAYER_NAMES.find(([id]) => id === layerId);
  return entry ? entry[1] : layerId;
}

/**
 * Assembles parsed elements into the canonical document + geometry store:
 * one `mesh` node per element, category layers (overridden by storey
 * layers when a spatial hierarchy is supplied), `AssetRef` geometry
 * references, and a camera framed on the imported bounds.
 */
export function assembleBimDocument(
  elements: readonly BimParsedElement[],
  geometryStore: CanvasGeometryStore,
  sceneId: string,
  hierarchy?: BimSpatialHierarchy | undefined
): { document: CanvasDocument; nodes: Canvas3DNode[] } {
  geometryStore.clear();

  const layers = new Map<string, CanvasLayer>();
  const nodes: Canvas3DNode[] = [];
  const assets: AssetRef[] = [];

  if (hierarchy) {
    for (const storey of hierarchy.storeyLayers) {
      layers.set(storey.id, {
        id: storey.id,
        name: storey.name,
        visible: true,
        locked: false,
        metadata: {}
      });
    }
  }

  for (const element of elements) {
    if (!layers.has(element.layerId)) {
      layers.set(element.layerId, {
        id: element.layerId,
        name: layerNameForId(element.layerId),
        visible: true,
        locked: false,
        metadata: {}
      });
    }

    const geometry = toMeshGeometry(element);
    const assetId = `ifc-geometry-${element.nodeId}`;

    nodes.push({
      color: element.color,
      geometryAssetId: assetId,
      id: element.nodeId,
      layerId: element.layerId,
      locked: false,
      metadata: buildBimMetadata({
        expressID: expressIdFromNodeId(element.nodeId),
        ifcGuid: element.ifcGuid,
        ifcType: element.ifcType,
        ...(element.ifcName === undefined ? {} : { ifcName: element.ifcName })
      }),
      parentId: null,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      visible: true,
      wireframe: false,
      type: "mesh"
    } as Canvas3DNode);
    assets.push(
      createMeshGeometryAssetRef(assetId, geometry, {
        uri: `ifc://element/${expressIdFromNodeId(element.nodeId)}`
      }) as AssetRef
    );
    geometryStore.set(assetId, geometry);
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

  const scene = defineScene({
    background: "#0f172a",
    camera: frameCameraForMeshes(nodes, geometryStore),
    id: sceneId,
    layers: Array.from(layers.values()),
    mode: "3d",
    nodes,
    render: {
      batch: false,
      dpr: 1.5,
      frustumCulling: true,
      loop: "demand"
    }
  });

  return {
    document: defineDocument({
      assets,
      id: `${sceneId}-document`,
      scene
    }),
    nodes
  };
}

function expressIdFromNodeId(nodeId: string): number {
  const prefix = "ifc-element-";
  const value = Number(nodeId.slice(prefix.length));
  return Number.isFinite(value) ? value : -1;
}

function frameCameraForMeshes(
  nodes: readonly Canvas3DNode[],
  geometryStore: CanvasGeometryStore
): {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let found = false;

  for (const node of nodes) {
    if (node.type !== "mesh") {
      continue;
    }

    const geometry = geometryStore.get(node.geometryAssetId ?? "");
    if (!geometry) {
      continue;
    }

    for (let index = 0; index + 2 < geometry.positions.length; index += 3) {
      const x = geometry.positions[index] ?? 0;
      const y = geometry.positions[index + 1] ?? 0;
      const z = geometry.positions[index + 2] ?? 0;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
      found = true;
    }
  }

  if (!found) {
    return { position: [3, 2, 6], target: [0, 0, 0], fov: 50 };
  }

  const target: [number, number, number] = [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2
  ];
  const radius = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1) / 2;
  const distance = (radius / Math.tan(((50 * Math.PI) / 180) / 2)) * 1.25;

  return {
    position: [
      target[0] + distance * 0.6,
      target[1] + distance * 0.45,
      target[2] + distance
    ],
    target,
    fov: 50
  };
}
