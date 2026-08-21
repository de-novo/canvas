import { z } from "zod";

type GeometryAssetId = string;

export const CANVAS_MESH_GEOMETRY_SCHEMA = "denovo.mesh-geometry.v1" as const;

const FiniteNumberArraySchema = z.array(z.number().finite());

export const CanvasMeshGeometryPayloadSchema = z
  .object({
    schema: z.literal(CANVAS_MESH_GEOMETRY_SCHEMA),
    positions: FiniteNumberArraySchema.min(6).refine(
      (values) => values.length % 3 === 0,
      { message: "mesh geometry positions length must be a multiple of 3" }
    ),
    indices: z.array(z.number().int().nonnegative()).min(3),
    normals: FiniteNumberArraySchema.optional(),
    uvs: FiniteNumberArraySchema.optional()
  })
  .strict();

export type CanvasMeshGeometry = {
  readonly positions: readonly number[];
  readonly indices: readonly number[];
  readonly normals?: readonly number[];
  readonly uvs?: readonly number[];
};

export type CanvasMeshGeometryInput = z.input<
  typeof CanvasMeshGeometryPayloadSchema
>;

export type CanvasMeshGeometrySource = {
  readonly geometryAssetId?: GeometryAssetId | undefined;
  readonly indices?: readonly number[] | undefined;
  readonly normals?: readonly number[] | undefined;
  readonly positions?: readonly number[] | undefined;
  readonly uvs?: readonly number[] | undefined;
};

export type CanvasMeshBounds = {
  readonly min: [number, number, number];
  readonly max: [number, number, number];
};

export type CanvasMeshGeometryAssetMetadata = {
  readonly bounds: CanvasMeshBounds;
  readonly hasNormals: boolean;
  readonly hasUvs: boolean;
  readonly indexCount: number;
  readonly kind: "mesh-geometry";
  readonly positionCount: number;
  readonly schema: typeof CANVAS_MESH_GEOMETRY_SCHEMA;
};

export type CanvasGeometryStore = {
  readonly size: number;
  clear: () => void;
  delete: (assetId: GeometryAssetId) => boolean;
  get: (assetId: GeometryAssetId) => CanvasMeshGeometry | undefined;
  has: (assetId: GeometryAssetId) => boolean;
  set: (assetId: GeometryAssetId, geometry: CanvasMeshGeometry) => void;
};

export function defineMeshGeometry(
  input: CanvasMeshGeometryInput
): CanvasMeshGeometry {
  const parsed = CanvasMeshGeometryPayloadSchema.parse(input);
  return {
    positions: parsed.positions,
    indices: parsed.indices,
    ...(parsed.normals === undefined ? {} : { normals: parsed.normals }),
    ...(parsed.uvs === undefined ? {} : { uvs: parsed.uvs })
  };
}

export function parseMeshGeometry(input: unknown): CanvasMeshGeometry {
  return defineMeshGeometry(CanvasMeshGeometryPayloadSchema.parse(input));
}

export function encodeMeshGeometry(geometry: CanvasMeshGeometry): ArrayBuffer {
  const payload = CanvasMeshGeometryPayloadSchema.parse({
    schema: CANVAS_MESH_GEOMETRY_SCHEMA,
    positions: [...geometry.positions],
    indices: [...geometry.indices],
    ...(geometry.normals === undefined ? {} : { normals: [...geometry.normals] }),
    ...(geometry.uvs === undefined ? {} : { uvs: [...geometry.uvs] })
  });
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export function decodeMeshGeometry(data: ArrayBuffer): CanvasMeshGeometry {
  const text = new TextDecoder().decode(data);
  return parseMeshGeometry(JSON.parse(text) as unknown);
}

export function safeParseMeshGeometry(input: unknown) {
  return CanvasMeshGeometryPayloadSchema.safeParse(input);
}

export function computeMeshGeometryBounds(
  positions: readonly number[]
): CanvasMeshBounds {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let index = 0; index + 2 < positions.length; index += 3) {
    const x = positions[index] ?? 0;
    const y = positions[index + 1] ?? 0;
    const z = positions[index + 2] ?? 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }

  if (!Number.isFinite(minX)) {
    return {
      min: [0, 0, 0],
      max: [0, 0, 0]
    };
  }

  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ]
  };
}

export function createMeshGeometryAssetRef(
  id: GeometryAssetId,
  geometry: CanvasMeshGeometry,
  options: { readonly uri?: string } = {}
): {
  id: GeometryAssetId;
  type: "geometry";
  uri?: string;
  mimeType: "application/vnd.denovo.mesh-geometry+json";
  metadata: CanvasMeshGeometryAssetMetadata;
} {
  const bounds = computeMeshGeometryBounds(geometry.positions);
  const metadata: CanvasMeshGeometryAssetMetadata = {
    kind: "mesh-geometry",
    schema: CANVAS_MESH_GEOMETRY_SCHEMA,
    positionCount: Math.floor(geometry.positions.length / 3),
    indexCount: geometry.indices.length,
    hasNormals: geometry.normals !== undefined,
    hasUvs: geometry.uvs !== undefined,
    bounds: {
      min: [bounds.min[0], bounds.min[1], bounds.min[2]],
      max: [bounds.max[0], bounds.max[1], bounds.max[2]]
    }
  };
  return {
    id,
    type: "geometry",
    ...(options.uri === undefined ? {} : { uri: options.uri }),
    mimeType: "application/vnd.denovo.mesh-geometry+json",
    metadata
  };
}

export function resolveCanvasMeshGeometry(
  source: CanvasMeshGeometrySource,
  store?: CanvasGeometryStore
): CanvasMeshGeometry | null {
  if (source.geometryAssetId !== undefined) {
    return store?.get(source.geometryAssetId) ?? null;
  }

  if (source.positions === undefined || source.indices === undefined) {
    return null;
  }

  return {
    positions: source.positions,
    indices: source.indices,
    ...(source.normals === undefined ? {} : { normals: source.normals }),
    ...(source.uvs === undefined ? {} : { uvs: source.uvs })
  };
}

export function createMemoryGeometryStore(
  initial: readonly (readonly [GeometryAssetId, CanvasMeshGeometry])[] = []
): CanvasGeometryStore {
  const geometries = new Map<GeometryAssetId, CanvasMeshGeometry>(initial);

  return {
    get size() {
      return geometries.size;
    },
    clear() {
      geometries.clear();
    },
    delete(assetId) {
      return geometries.delete(assetId);
    },
    get(assetId) {
      return geometries.get(assetId);
    },
    has(assetId) {
      return geometries.has(assetId);
    },
    set(assetId, geometry) {
      geometries.set(assetId, defineMeshGeometry({
        schema: CANVAS_MESH_GEOMETRY_SCHEMA,
        positions: [...geometry.positions],
        indices: [...geometry.indices],
        ...(geometry.normals === undefined
          ? {}
          : { normals: [...geometry.normals] }),
        ...(geometry.uvs === undefined ? {} : { uvs: [...geometry.uvs] })
      }));
    }
  };
}
