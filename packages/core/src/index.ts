import { z } from "zod";
import { createStore, type StoreApi } from "zustand/vanilla";
import {
  createMemoryGeometryStore,
  decodeMeshGeometry,
  encodeMeshGeometry,
  type CanvasGeometryStore
} from "./geometry.js";

export const CANVAS_DOCUMENT_SCHEMA_VERSION = "0.2.0";
export const CANVAS_LEGACY_DOCUMENT_SCHEMA_VERSION = "0.1.0";
export const CANVAS_DEFAULT_LAYER_ID = "default";
export const CANVAS_DEFAULT_LAYER_NAME = "Default";

export const CanvasModeSchema = z.enum(["2d", "3d"]);
export const RenderLoopSchema = z.enum(["demand", "always"]);
export const GeometryKindSchema = z.enum(["box", "sphere"]);
export const NodeIdSchema = z.string().min(1);
export const CanvasLayerIdSchema = z.string().min(1);
export const Point2Schema = z.tuple([z.number(), z.number()]);
export const Vector3Schema = z.tuple([z.number(), z.number(), z.number()]);
export const CanvasKnownDocumentSchemaVersionSchema = z.enum([
  CANVAS_LEGACY_DOCUMENT_SCHEMA_VERSION,
  CANVAS_DOCUMENT_SCHEMA_VERSION
]);
const CanvasHitCoordinateSchema = z.number().finite();
const CanvasHitPoint2Schema = z.tuple([
  CanvasHitCoordinateSchema,
  CanvasHitCoordinateSchema
]);
const CanvasHitPoint3Schema = z.tuple([
  CanvasHitCoordinateSchema,
  CanvasHitCoordinateSchema,
  CanvasHitCoordinateSchema
]);
export const JsonPrimitiveSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null()
]);
export type JsonPrimitive = z.output<typeof JsonPrimitiveSchema>;
export type JsonValue =
  | JsonPrimitive
  | {
      [key: string]: JsonValue;
    }
  | JsonValue[];
export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([JsonPrimitiveSchema, z.array(JsonValueSchema), z.record(z.string(), JsonValueSchema)])
);
const CanvasMetadataValueSchema = z.record(z.string(), JsonValueSchema);
export const CanvasMetadataSchema = CanvasMetadataValueSchema.default({});
const CanvasLayerNameSchema = z.string().min(1);
const CanvasLayerVisibilitySchema = z.boolean();
const CanvasLayerLockSchema = z.boolean();

export const CanvasLayerSchema = z
  .object({
    id: CanvasLayerIdSchema,
    name: CanvasLayerNameSchema,
    visible: CanvasLayerVisibilitySchema.default(true),
    locked: CanvasLayerLockSchema.default(false),
    metadata: CanvasMetadataSchema
  })
  .strict();

export const CameraSchema = z.object({
  position: Vector3Schema.default([3, 2, 6]),
  target: Vector3Schema.default([0, 0, 0]),
  fov: z.number().positive().default(50)
}).strict();

export const NodeTransformSchema = z.object({
  position: Vector3Schema.default([0, 0, 0]),
  rotation: Vector3Schema.default([0, 0, 0]),
  scale: Vector3Schema.default([1, 1, 1])
}).strict();

export const Node2DTransformSchema = z.object({
  position: Point2Schema.default([0, 0]),
  rotation: z.number().default(0),
  scale: Point2Schema.default([1, 1])
}).strict();

const CanvasNodeCommonSchemaShape = {
  id: NodeIdSchema,
  layerId: CanvasLayerIdSchema,
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  metadata: CanvasMetadataSchema,
  parentId: NodeIdSchema.nullable().default(null)
};

export const RectNodeSchema = Node2DTransformSchema.extend({
  ...CanvasNodeCommonSchemaShape,
  type: z.literal("rect"),
  fill: z.string().min(1).default("#22c55e"),
  size: Point2Schema.default([120, 80])
}).strict();

export const CircleNodeSchema = Node2DTransformSchema.extend({
  ...CanvasNodeCommonSchemaShape,
  type: z.literal("circle"),
  fill: z.string().min(1).default("#38bdf8"),
  radius: z.number().positive().default(48)
}).strict();

export const BoxNodeSchema = NodeTransformSchema.extend({
  ...CanvasNodeCommonSchemaShape,
  type: z.literal("box"),
  color: z.string().min(1).default("#3b82f6")
}).strict();

export const SphereNodeSchema = NodeTransformSchema.extend({
  ...CanvasNodeCommonSchemaShape,
  type: z.literal("sphere"),
  color: z.string().min(1).default("#f97316"),
  radius: z.number().positive().default(0.75)
}).strict();

const MeshNodeObjectSchema = NodeTransformSchema.extend({
  ...CanvasNodeCommonSchemaShape,
  type: z.literal("mesh"),
  color: z.string().min(1).default("#9ca3af"),
  geometryAssetId: NodeIdSchema.optional(),
  positions: z
    .array(z.number().finite())
    .min(6)
    .refine((values) => values.length % 3 === 0, {
      message: "mesh positions length must be a multiple of 3"
    })
    .optional(),
  indices: z.array(z.number().int().nonnegative()).min(3).optional(),
  normals: z.array(z.number().finite()).optional(),
  uvs: z.array(z.number().finite()).optional(),
  wireframe: z.boolean().default(false)
}).strict();

function addMeshGeometrySourceIssues(
  node: {
    geometryAssetId?: string | undefined;
    indices?: number[] | undefined;
    normals?: number[] | undefined;
    positions?: number[] | undefined;
    uvs?: number[] | undefined;
  },
  context: z.RefinementCtx
) {
  const hasAsset = node.geometryAssetId !== undefined;
  const hasInline =
    node.positions !== undefined ||
    node.indices !== undefined ||
    node.normals !== undefined ||
    node.uvs !== undefined;

  if (hasAsset && hasInline) {
    context.addIssue({
      code: "custom",
      message:
        "mesh nodes cannot combine geometryAssetId with inline positions, indices, normals, or uvs",
      path: ["geometryAssetId"]
    });
    return;
  }

  if (!hasAsset && (node.positions === undefined || node.indices === undefined)) {
    context.addIssue({
      code: "custom",
      message:
        "mesh nodes require inline positions and indices, or geometryAssetId",
      path: node.positions === undefined ? ["positions"] : ["indices"]
    });
  }
}

export const MeshNodeSchema = MeshNodeObjectSchema.superRefine(
  addMeshGeometrySourceIssues
);

export const InstanceTransformSchema = NodeTransformSchema.extend({
  color: z.string().min(1).optional()
}).strict();

export const InstancesNodeSchema = NodeTransformSchema.extend({
  ...CanvasNodeCommonSchemaShape,
  type: z.literal("instances"),
  geometry: GeometryKindSchema.default("box"),
  color: z.string().min(1).default("#3b82f6"),
  instances: z.array(InstanceTransformSchema).min(1)
}).strict();

export const Canvas2DGroupNodeSchema = Node2DTransformSchema.extend({
  ...CanvasNodeCommonSchemaShape,
  type: z.literal("group")
}).strict();

export const Canvas3DGroupNodeSchema = NodeTransformSchema.extend({
  ...CanvasNodeCommonSchemaShape,
  type: z.literal("group")
}).strict();

export const CanvasMeasurementUnitSchema = z
  .object({
    name: z.string().min(1),
    symbol: z.string().min(1),
    metersPerUnit: z.number().finite().positive()
  })
  .strict();

export const Canvas2DMeasurementNodeSchema = z
  .object({
    ...CanvasNodeCommonSchemaShape,
    type: z.literal("measurement"),
    measurement: z.literal("distance"),
    start: Point2Schema,
    end: Point2Schema,
    unit: CanvasMeasurementUnitSchema,
    precision: z.number().int().nonnegative()
  })
  .strict();

export const Canvas3DMeasurementNodeSchema = z
  .object({
    ...CanvasNodeCommonSchemaShape,
    type: z.literal("measurement"),
    measurement: z.literal("distance"),
    start: Vector3Schema,
    end: Vector3Schema,
    unit: CanvasMeasurementUnitSchema,
    precision: z.number().int().nonnegative()
  })
  .strict();

export const Canvas2DAnnotationNodeSchema = z
  .object({
    ...CanvasNodeCommonSchemaShape,
    type: z.literal("annotation"),
    anchor: Point2Schema,
    text: z.string().min(1),
    targetId: NodeIdSchema.nullable().default(null)
  })
  .strict();

/**
 * Sides of a node's bounding box that an edge can attach to. These double as
 * the implicit connection handles the 2D renderer draws, so the renderer, the
 * connector tool, and the edge schema all share this one list.
 */
export const CANVAS_NODE_PORT_SIDES = [
  "top",
  "right",
  "bottom",
  "left"
] as const;

export const CanvasNodePortSideSchema = z.enum(CANVAS_NODE_PORT_SIDES);

export type CanvasNodePortSide = z.infer<typeof CanvasNodePortSideSchema>;

export const Canvas2DEdgeNodeSchema = z
  .object({
    ...CanvasNodeCommonSchemaShape,
    type: z.literal("edge"),
    sourceId: NodeIdSchema,
    targetId: NodeIdSchema,
    /**
     * Side of the source node this edge leaves from. `null` attaches to the
     * node centre, preserving the pre-port behaviour.
     */
    sourcePort: CanvasNodePortSideSchema.nullable().default(null),
    targetPort: CanvasNodePortSideSchema.nullable().default(null),
    sourceAnchor: Point2Schema.default([0, 0]),
    targetAnchor: Point2Schema.default([0, 0]),
    curve: z.enum(["straight", "curved"]).default("straight"),
    routing: z.enum(["straight", "curved", "orthogonal"]).default("straight"),
    curveOffset: z.number().default(0),
    lineStyle: z.enum(["solid", "dashed", "dotted"]).default("solid"),
    stroke: z.string().min(1).default("#94a3b8"),
    strokeWidth: z.number().positive().default(2),
    sourceArrow: z.boolean().default(false),
    targetArrow: z.boolean().default(true)
  })
  .strict();

/**
 * Write-side routing. `routing: "curved"` remains readable on stored `0.2.0`
 * documents but is not a third path algorithm; new edges must not write it.
 */
export const Canvas2DEdgeRoutingWriteSchema = z.enum([
  "straight",
  "orthogonal"
]);
export type Canvas2DEdgeRoutingWrite = z.infer<
  typeof Canvas2DEdgeRoutingWriteSchema
>;

export type Canvas2DEdgeWriteInput = Omit<
  z.input<typeof Canvas2DEdgeNodeSchema>,
  "routing"
> & {
  routing?: Canvas2DEdgeRoutingWrite;
};

export const Canvas2DTextNodeSchema = Node2DTransformSchema.extend({
  ...CanvasNodeCommonSchemaShape,
  type: z.literal("text"),
  text: z.string().default(""),
  fill: z.string().min(1).default("#f8fafc"),
  fontSize: z.number().positive().default(14),
  fontFamily: z.string().min(1).default("sans-serif"),
  fontWeight: z.union([z.literal("normal"), z.literal("bold")]).default("normal"),
  align: z.enum(["left", "center", "right"]).default("left"),
  width: z.number().positive().nullable().default(null)
}).strict();

export const Canvas2DHtmlNodeSchema = Node2DTransformSchema.extend({
  ...CanvasNodeCommonSchemaShape,
  type: z.literal("html"),
  html: z.string().default(""),
  width: z.number().positive().nullable().default(null),
  height: z.number().positive().nullable().default(null)
}).strict();

export const Canvas3DAnnotationNodeSchema = z
  .object({
    ...CanvasNodeCommonSchemaShape,
    type: z.literal("annotation"),
    anchor: Vector3Schema,
    text: z.string().min(1),
    targetId: NodeIdSchema.nullable().default(null)
  })
  .strict();

export const Canvas2DNodeSchema = z.discriminatedUnion("type", [
  RectNodeSchema,
  CircleNodeSchema,
  Canvas2DGroupNodeSchema,
  Canvas2DMeasurementNodeSchema,
  Canvas2DAnnotationNodeSchema,
  Canvas2DEdgeNodeSchema,
  Canvas2DTextNodeSchema,
  Canvas2DHtmlNodeSchema
]);

export const Canvas3DNodeSchema = z
  .discriminatedUnion("type", [
    BoxNodeSchema,
    SphereNodeSchema,
    MeshNodeObjectSchema,
    InstancesNodeSchema,
    Canvas3DGroupNodeSchema,
    Canvas3DMeasurementNodeSchema,
    Canvas3DAnnotationNodeSchema
  ])
  .superRefine((node, context) => {
    if (node.type === "mesh") {
      addMeshGeometrySourceIssues(node, context);
    }
  });

export const Canvas2DNodeTypeSchema = z.union([
  RectNodeSchema.shape.type,
  CircleNodeSchema.shape.type,
  Canvas2DGroupNodeSchema.shape.type,
  Canvas2DMeasurementNodeSchema.shape.type,
  Canvas2DAnnotationNodeSchema.shape.type,
  Canvas2DEdgeNodeSchema.shape.type,
  Canvas2DTextNodeSchema.shape.type,
  Canvas2DHtmlNodeSchema.shape.type
]);

export const Canvas3DNodeTypeSchema = z.union([
  BoxNodeSchema.shape.type,
  SphereNodeSchema.shape.type,
  MeshNodeObjectSchema.shape.type,
  InstancesNodeSchema.shape.type,
  Canvas3DGroupNodeSchema.shape.type,
  Canvas3DMeasurementNodeSchema.shape.type,
  Canvas3DAnnotationNodeSchema.shape.type
]);

const Canvas2DNodeIdentitySchemaShape = {
  nodeMode: CanvasModeSchema.extract(["2d"]),
  nodeType: Canvas2DNodeTypeSchema
};

const Canvas3DNodeIdentitySchemaShape = {
  nodeMode: CanvasModeSchema.extract(["3d"]),
  nodeType: Canvas3DNodeTypeSchema
};

export const CanvasNodeIdentitySchema = z.discriminatedUnion("nodeMode", [
  z.object(Canvas2DNodeIdentitySchemaShape).strict(),
  z.object(Canvas3DNodeIdentitySchemaShape).strict()
]);

export const CanvasNodeSchema = z.union([
  Canvas2DNodeSchema,
  Canvas3DNodeSchema
]);

export const RenderLodOptionsSchema = z
  .object({
    enabled: z.boolean().default(false),
    distances: z.array(z.number().positive()).max(2).default([24, 60])
  })
  .strict();

export const RenderOptionsSchema = z.object({
  loop: RenderLoopSchema.default("demand"),
  dpr: z.number().positive().max(4).default(1.5),
  frustumCulling: z.boolean().default(true),
  batch: z.boolean().default(false),
  lod: RenderLodOptionsSchema.default({ enabled: false, distances: [24, 60] })
}).strict();

const CanvasSceneBaseSchema = z
  .object({
    id: NodeIdSchema,
    layers: z.array(CanvasLayerSchema).min(1),
    background: z.string().min(1).default("#111827"),
    render: RenderOptionsSchema.default({
      loop: "demand",
      dpr: 1.5,
      frustumCulling: true,
      batch: false,
      lod: { enabled: false, distances: [24, 60] }
    }),
    camera: CameraSchema.default({
      position: [3, 2, 6],
      target: [0, 0, 0],
      fov: 50
    })
  })
  .strict();

export const Canvas2DSceneSchema = CanvasSceneBaseSchema.extend({
  mode: z.literal("2d"),
  nodes: z.array(Canvas2DNodeSchema).default([])
}).strict();

export const Canvas3DSceneSchema = CanvasSceneBaseSchema.extend({
  mode: z.literal("3d").default("3d"),
  nodes: z.array(Canvas3DNodeSchema).default([])
}).strict();

export const CanvasSceneSchema = z
  .union([Canvas2DSceneSchema, Canvas3DSceneSchema])
  .superRefine((scene, context) => {
    const seenLayerIds = new Set<string>();
    const seenNodeIds = new Set<string>();

    for (const [layerIndex, layer] of scene.layers.entries()) {
      if (seenLayerIds.has(layer.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate layer id: ${layer.id}`,
          path: ["layers", layerIndex, "id"]
        });
      }

      seenLayerIds.add(layer.id);
    }

    for (const [nodeIndex, node] of scene.nodes.entries()) {
      if (seenNodeIds.has(node.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate node id: ${node.id}`,
          path: ["nodes", nodeIndex, "id"]
        });
      }

      seenNodeIds.add(node.id);

      if (!seenLayerIds.has(node.layerId)) {
        context.addIssue({
          code: "custom",
          message: `Missing layer: ${node.layerId}`,
          path: ["nodes", nodeIndex, "layerId"]
        });
      }
    }

    const nodesById = new Map(scene.nodes.map((node) => [node.id, node] as const));

    for (const [nodeIndex, node] of scene.nodes.entries()) {
      if (node.parentId !== null) {
        if (node.parentId === node.id) {
          context.addIssue({
            code: "custom",
            message: `Node cannot parent itself: ${node.id}`,
            path: ["nodes", nodeIndex, "parentId"]
          });
        } else {
          const parent = nodesById.get(node.parentId);

          if (parent === undefined) {
            context.addIssue({
              code: "custom",
              message: `Missing parent node: ${node.parentId}`,
              path: ["nodes", nodeIndex, "parentId"]
            });
          } else {
            if (parent.type !== "group") {
              context.addIssue({
                code: "custom",
                message: `Parent node must be a group: ${node.parentId}`,
                path: ["nodes", nodeIndex, "parentId"]
              });
            }

            if (parent.layerId !== node.layerId) {
              context.addIssue({
                code: "custom",
                message: `Parent node must be in layer ${node.layerId}: ${node.parentId}`,
                path: ["nodes", nodeIndex, "parentId"]
              });
            }
          }
        }
      }

      if (node.type === "annotation" && node.targetId !== null) {
        if (!nodesById.has(node.targetId)) {
          context.addIssue({
            code: "custom",
            message: `Missing annotation target: ${node.targetId}`,
            path: ["nodes", nodeIndex, "targetId"]
          });
        }
      }

      if (node.type === "edge") {
        const sourceNode = nodesById.get(node.sourceId);
        const targetNode = nodesById.get(node.targetId);

        if (sourceNode === undefined) {
          context.addIssue({
            code: "custom",
            message: `Missing edge source: ${node.sourceId}`,
            path: ["nodes", nodeIndex, "sourceId"]
          });
        } else if (sourceNode.layerId !== node.layerId) {
          context.addIssue({
            code: "custom",
            message: `Edge source must be in the same layer as the edge: ${node.sourceId}`,
            path: ["nodes", nodeIndex, "sourceId"]
          });
        }

        if (targetNode === undefined) {
          context.addIssue({
            code: "custom",
            message: `Missing edge target: ${node.targetId}`,
            path: ["nodes", nodeIndex, "targetId"]
          });
        } else if (targetNode.layerId !== node.layerId) {
          context.addIssue({
            code: "custom",
            message: `Edge target must be in the same layer as the edge: ${node.targetId}`,
            path: ["nodes", nodeIndex, "targetId"]
          });
        }
      }

      const ancestorIds = new Set<string>([node.id]);
      let ancestorId = node.parentId;

      while (ancestorId !== null) {
        if (ancestorIds.has(ancestorId)) {
          context.addIssue({
            code: "custom",
            message: `Parent cycle detected for node: ${node.id}`,
            path: ["nodes", nodeIndex, "parentId"]
          });
          break;
        }

        ancestorIds.add(ancestorId);
        const ancestor = nodesById.get(ancestorId);

        if (ancestor === undefined) {
          break;
        }

        ancestorId = ancestor.parentId;
      }
    }
  });

export const AssetKindSchema = z.enum([
  "image",
  "gltf",
  "glb",
  "ifc",
  "xkt",
  "geometry",
  "binary",
  "json",
  "other"
]);

export const AssetRefSchema = z.object({
  id: NodeIdSchema,
  type: AssetKindSchema.default("binary"),
  uri: z.string().min(1).optional(),
  mimeType: z.string().min(1).optional(),
  byteLength: z.number().int().nonnegative().optional(),
  checksum: z.string().min(1).optional(),
  metadata: CanvasMetadataSchema
}).strict();

export const CanvasDocumentSchema = z
  .object({
    id: NodeIdSchema,
    schemaVersion: z
      .literal(CANVAS_DOCUMENT_SCHEMA_VERSION)
      .default(CANVAS_DOCUMENT_SCHEMA_VERSION),
    revision: z.number().int().nonnegative().default(0),
    title: z.string().min(1).optional(),
    createdAt: z.string().min(1).optional(),
    updatedAt: z.string().min(1).optional(),
    scene: CanvasSceneSchema,
    assets: z.array(AssetRefSchema).default([]),
    metadata: CanvasMetadataSchema,
    pluginState: z.record(z.string(), JsonValueSchema).default({})
  })
  .strict()
  .superRefine((document, context) => {
    const seenAssetIds = new Set<string>();

    for (const asset of document.assets) {
      if (seenAssetIds.has(asset.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate asset id: ${asset.id}`,
          path: ["assets"]
        });
      }

      seenAssetIds.add(asset.id);
    }

    if (document.scene.mode === "3d") {
      for (const [nodeIndex, node] of document.scene.nodes.entries()) {
        if (node.type !== "mesh" || node.geometryAssetId === undefined) {
          continue;
        }

        const asset = document.assets.find(
          (candidate) => candidate.id === node.geometryAssetId
        );

        if (asset === undefined) {
          context.addIssue({
            code: "custom",
            message: `Missing geometry asset: ${node.geometryAssetId}`,
            path: ["scene", "nodes", nodeIndex, "geometryAssetId"]
          });
          continue;
        }

        if (asset.type !== "geometry") {
          context.addIssue({
            code: "custom",
            message: `Geometry asset must have type "geometry": ${node.geometryAssetId}`,
            path: ["scene", "nodes", nodeIndex, "geometryAssetId"]
          });
        }
      }
    }
  });

const LegacyRectNodeSchema = Node2DTransformSchema.extend({
  id: NodeIdSchema,
  type: z.literal("rect"),
  fill: z.string().min(1).default("#22c55e"),
  size: Point2Schema.default([120, 80])
}).strict();

const LegacyCircleNodeSchema = Node2DTransformSchema.extend({
  id: NodeIdSchema,
  type: z.literal("circle"),
  fill: z.string().min(1).default("#38bdf8"),
  radius: z.number().positive().default(48)
}).strict();

const LegacyBoxNodeSchema = NodeTransformSchema.extend({
  id: NodeIdSchema,
  type: z.literal("box"),
  color: z.string().min(1).default("#3b82f6")
}).strict();

const LegacySphereNodeSchema = NodeTransformSchema.extend({
  id: NodeIdSchema,
  type: z.literal("sphere"),
  color: z.string().min(1).default("#f97316"),
  radius: z.number().positive().default(0.75)
}).strict();

const LegacyMeshNodeSchema = NodeTransformSchema.extend({
  id: NodeIdSchema,
  type: z.literal("mesh"),
  color: z.string().min(1).default("#9ca3af"),
  positions: z.array(z.number()).min(6),
  indices: z.array(z.number().int().nonnegative()).min(3),
  normals: z.array(z.number()).optional(),
  uvs: z.array(z.number()).optional(),
  wireframe: z.boolean().default(false)
}).strict();

const LegacyInstancesNodeSchema = NodeTransformSchema.extend({
  id: NodeIdSchema,
  type: z.literal("instances"),
  geometry: GeometryKindSchema.default("box"),
  color: z.string().min(1).default("#3b82f6"),
  instances: z.array(InstanceTransformSchema).min(1)
}).strict();

const LegacyCanvas2DEdgeNodeSchema = Node2DTransformSchema.extend({
  id: NodeIdSchema,
  type: z.literal("edge"),
  sourceId: NodeIdSchema,
  targetId: NodeIdSchema,
  sourcePort: CanvasNodePortSideSchema.nullable().default(null),
  targetPort: CanvasNodePortSideSchema.nullable().default(null),
  routing: z.enum(["straight", "curved", "orthogonal"]).default("straight"),
  stroke: z.string().min(1).default("#94a3b8"),
  strokeWidth: z.number().positive().default(2)
}).strict();

const LegacyCanvas2DTextNodeSchema = Node2DTransformSchema.extend({
  id: NodeIdSchema,
  type: z.literal("text"),
  text: z.string().default(""),
  fill: z.string().min(1).default("#f8fafc"),
  fontSize: z.number().positive().default(14)
}).strict();

const LegacyCanvas2DHtmlNodeSchema = Node2DTransformSchema.extend({
  id: NodeIdSchema,
  type: z.literal("html"),
  html: z.string().default("")
}).strict();

const LegacyCanvas2DNodeSchema = z.discriminatedUnion("type", [
  LegacyRectNodeSchema,
  LegacyCircleNodeSchema,
  LegacyCanvas2DEdgeNodeSchema,
  LegacyCanvas2DTextNodeSchema,
  LegacyCanvas2DHtmlNodeSchema
]);

const LegacyCanvas3DNodeSchema = z.discriminatedUnion("type", [
  LegacyBoxNodeSchema,
  LegacySphereNodeSchema,
  LegacyMeshNodeSchema,
  LegacyInstancesNodeSchema
]);

const LegacyCanvasSceneBaseSchema = CanvasSceneBaseSchema.omit({
  layers: true
});

const LegacyCanvas2DSceneSchema = LegacyCanvasSceneBaseSchema.extend({
  mode: z.literal("2d"),
  nodes: z.array(LegacyCanvas2DNodeSchema).default([])
}).strict();

const LegacyCanvas3DSceneSchema = LegacyCanvasSceneBaseSchema.extend({
  mode: z.literal("3d").default("3d"),
  nodes: z.array(LegacyCanvas3DNodeSchema).default([])
}).strict();

const LegacyCanvasDocumentSchema = z
  .object({
    id: NodeIdSchema,
    schemaVersion: z.literal(CANVAS_LEGACY_DOCUMENT_SCHEMA_VERSION),
    title: z.string().min(1).optional(),
    createdAt: z.string().min(1).optional(),
    updatedAt: z.string().min(1).optional(),
    scene: z.union([LegacyCanvas2DSceneSchema, LegacyCanvas3DSceneSchema]),
    assets: z.array(AssetRefSchema).default([]),
    metadata: CanvasMetadataSchema,
    pluginState: z.record(z.string(), JsonValueSchema).default({})
  })
  .strict();

export const SelectionStateSchema = z
  .object({
    ids: z.array(NodeIdSchema).default([]),
    primaryId: NodeIdSchema.nullable().default(null),
    hoveredId: NodeIdSchema.nullable().default(null)
  })
  .strict()
  .superRefine((selection, context) => {
    if (new Set(selection.ids).size !== selection.ids.length) {
      context.addIssue({
        code: "custom",
        message: "selected ids must be unique.",
        path: ["ids"]
      });
    }

    if (selection.primaryId && !selection.ids.includes(selection.primaryId)) {
      context.addIssue({
        code: "custom",
        message: "primaryId must be included in selected ids.",
        path: ["primaryId"]
      });
    }
  });

export const HitTargetKindSchema = z.enum([
  "empty",
  "node",
  "handle",
  "gizmo",
  "scene"
]);
export const CanvasSelectionModeSchema = z.enum(["replace", "add", "toggle"]);

export const CanvasHitTestInputSchema = z
  .object({
    point: CanvasHitPoint2Schema
  })
  .strict();

const CanvasHitResultBaseSchemaShape = {
  distance: z.number().finite().nonnegative().optional(),
  point: z.union([CanvasHitPoint2Schema, CanvasHitPoint3Schema]).optional(),
  renderer: z.string().min(1).optional()
};

const EmptyCanvasHitResultSchema = z
  .object({
    ...CanvasHitResultBaseSchemaShape,
    kind: z.literal("empty")
  })
  .strict();

const SceneCanvasHitResultSchema = z
  .object({
    ...CanvasHitResultBaseSchemaShape,
    kind: z.literal("scene"),
    subTarget: z.string().min(1).optional()
  })
  .strict();

const NodeCanvasHitResultSchema = z
  .object({
    ...CanvasHitResultBaseSchemaShape,
    instanceIndex: z.number().int().nonnegative().optional(),
    kind: z.literal("node"),
    nodeId: NodeIdSchema,
    subTarget: z.string().min(1).optional()
  })
  .strict();

const HandleCanvasHitResultSchema = z
  .object({
    ...CanvasHitResultBaseSchemaShape,
    kind: z.literal("handle"),
    nodeId: NodeIdSchema.optional(),
    subTarget: z.string().min(1)
  })
  .strict();

const GizmoCanvasHitResultSchema = z
  .object({
    ...CanvasHitResultBaseSchemaShape,
    kind: z.literal("gizmo"),
    nodeId: NodeIdSchema.optional(),
    subTarget: z.string().min(1)
  })
  .strict();

export const CanvasHitResultSchema = z.discriminatedUnion("kind", [
  EmptyCanvasHitResultSchema,
  NodeCanvasHitResultSchema,
  HandleCanvasHitResultSchema,
  GizmoCanvasHitResultSchema,
  SceneCanvasHitResultSchema
]);

export const CanvasToolPointerTypeSchema = z.enum([
  "mouse",
  "pen",
  "touch",
  "unknown"
]);

const CanvasToolModifierSchemaShape = {
  altKey: z.boolean(),
  ctrlKey: z.boolean(),
  metaKey: z.boolean(),
  shiftKey: z.boolean()
};

export const CanvasToolPointerInputSchema = z
  .object({
    ...CanvasToolModifierSchemaShape,
    button: z.number().int(),
    buttons: z.number().int().nonnegative(),
    delta: CanvasHitPoint2Schema,
    dragging: z.boolean(),
    isPrimary: z.boolean(),
    origin: CanvasHitPoint2Schema,
    point: CanvasHitPoint2Schema,
    pointerId: z.number().int().nonnegative(),
    pointerType: CanvasToolPointerTypeSchema,
    pressure: z.number().finite().min(0).max(1),
    type: z.enum([
      "pointer.cancel",
      "pointer.down",
      "pointer.leave",
      "pointer.move",
      "pointer.up"
    ])
  })
  .strict();

export const CanvasToolKeyInputSchema = z
  .object({
    ...CanvasToolModifierSchemaShape,
    code: z.string(),
    key: z.string(),
    repeat: z.boolean(),
    type: z.enum(["key.down", "key.up"])
  })
  .strict();

export const CanvasToolInputSchema = z.union([
  CanvasToolPointerInputSchema,
  CanvasToolKeyInputSchema
]);

export const CanvasNodeTranslationConstraintSchema = z.enum([
  "free",
  "x",
  "y",
  "z",
  "xy",
  "xz",
  "yz"
]);

export const CanvasNodeRotationAxisSchema = z.enum(["x", "y", "z"]);

export const CanvasNodeScaleConstraintSchema = z.enum([
  "x",
  "y",
  "z",
  "xy",
  "xz",
  "yz",
  "uniform"
]);

export const CanvasNodeTransformKindSchema = z.enum([
  "translate",
  "rotate",
  "scale"
]);

export const CanvasNodeTranslationHandleIdSchema = z.enum([
  "translate.x",
  "translate.y",
  "translate.z",
  "translate.xy",
  "translate.xz",
  "translate.yz"
]);

export const CanvasNodeRotationHandleIdSchema = z.enum([
  "rotate.x",
  "rotate.y",
  "rotate.z"
]);

export const CanvasNodeScaleHandleIdSchema = z.enum([
  "scale.x",
  "scale.y",
  "scale.z",
  "scale.xy",
  "scale.xz",
  "scale.yz",
  "scale.uniform"
]);

export const CanvasNodeTransformHandleIdSchema = z.union([
  CanvasNodeTranslationHandleIdSchema,
  CanvasNodeRotationHandleIdSchema,
  CanvasNodeScaleHandleIdSchema
]);

export const CanvasNodeTransformHandleTargetSchema = z
  .object({
    kind: CanvasNodeTransformKindSchema,
    nodeId: NodeIdSchema
  })
  .strict();

const CanvasNodeTransformInputBaseSchemaShape = {
  nodeId: NodeIdSchema,
  origin: CanvasHitPoint2Schema,
  point: CanvasHitPoint2Schema
};

export const CanvasNodeTransformInputSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...CanvasNodeTransformInputBaseSchemaShape,
      constraint: CanvasNodeTranslationConstraintSchema.default("free"),
      kind: z.literal("translate")
    })
    .strict(),
  z
    .object({
      ...CanvasNodeTransformInputBaseSchemaShape,
      axis: CanvasNodeRotationAxisSchema,
      kind: z.literal("rotate")
    })
    .strict(),
  z
    .object({
      ...CanvasNodeTransformInputBaseSchemaShape,
      constraint: CanvasNodeScaleConstraintSchema,
      kind: z.literal("scale")
    })
    .strict()
]);

export const CanvasNodeTransformPreviewSchema = z.union([
  z
    .object({
      kind: z.literal("translate"),
      mode: z.literal("2d"),
      nodeId: NodeIdSchema,
      position: Point2Schema
    })
    .strict(),
  z
    .object({
      kind: z.literal("translate"),
      mode: z.literal("3d"),
      nodeId: NodeIdSchema,
      position: Vector3Schema
    })
    .strict(),
  z
    .object({
      kind: z.literal("rotate"),
      mode: z.literal("2d"),
      nodeId: NodeIdSchema,
      rotation: z.number().finite()
    })
    .strict(),
  z
    .object({
      kind: z.literal("rotate"),
      mode: z.literal("3d"),
      nodeId: NodeIdSchema,
      rotation: Vector3Schema
    })
    .strict(),
  z
    .object({
      kind: z.literal("scale"),
      mode: z.literal("2d"),
      nodeId: NodeIdSchema,
      scale: Point2Schema
    })
    .strict(),
  z
    .object({
      kind: z.literal("scale"),
      mode: z.literal("3d"),
      nodeId: NodeIdSchema,
      scale: Vector3Schema
    })
    .strict()
]);

const CanvasFinitePoint2Schema = z.tuple([
  CanvasHitCoordinateSchema,
  CanvasHitCoordinateSchema
]);
const CanvasFiniteVector3Schema = z.tuple([
  CanvasHitCoordinateSchema,
  CanvasHitCoordinateSchema,
  CanvasHitCoordinateSchema
]);
const CanvasPositiveSpacingSchema = z.tuple([
  z.number().finite().positive(),
  z.number().finite().positive()
]);

export const CanvasWorkPlaneSchema = z
  .object({
    normal: CanvasFiniteVector3Schema,
    constant: z.number().finite()
  })
  .strict()
  .superRefine((workPlane, context) => {
    if (workPlane.normal.every((component) => component === 0)) {
      context.addIssue({
        code: "custom",
        message: "Work-plane normal must be non-zero.",
        path: ["normal"]
      });
    }
  });

export const CanvasScenePointRequestSchema = z.union([
  z
    .object({
      mode: z.literal("2d"),
      viewportPoint: CanvasFinitePoint2Schema
    })
    .strict(),
  z
    .object({
      mode: z.literal("3d"),
      viewportPoint: CanvasFinitePoint2Schema,
      workPlane: CanvasWorkPlaneSchema
    })
    .strict()
]);

export const CanvasScenePointResultSchema = z.union([
  z
    .object({
      mode: z.literal("2d"),
      position: CanvasFinitePoint2Schema
    })
    .strict(),
  z
    .object({
      mode: z.literal("3d"),
      position: CanvasFiniteVector3Schema
    })
    .strict()
]);

const CanvasUnitVector3Schema = CanvasFiniteVector3Schema.superRefine(
  (vector, context) => {
    const length = Math.hypot(vector[0], vector[1], vector[2]);

    if (Math.abs(length - 1) > 1e-6) {
      context.addIssue({
        code: "custom",
        message: "Surface normals must be unit vectors."
      });
    }
  }
);

export const Canvas3DSurfacePointRequestSchema = z
  .object({
    mode: z.literal("3d"),
    target: z
      .object({
        kind: z.literal("node"),
        nodeType: z.literal("box")
      })
      .strict(),
    viewportPoint: CanvasFinitePoint2Schema
  })
  .strict();

const Canvas3DBoxFaceFeatureSchema = z
  .object({
    axis: z.enum(["x", "y", "z"]),
    kind: z.literal("box.face"),
    side: z.union([z.literal(-1), z.literal(1)])
  })
  .strict();

export const Canvas3DSurfacePointResultSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("miss"),
      mode: z.literal("3d")
    })
    .strict(),
  z
    .object({
      feature: Canvas3DBoxFaceFeatureSchema,
      kind: z.literal("hit"),
      mode: z.literal("3d"),
      nodeId: NodeIdSchema,
      nodeType: z.literal("box"),
      normal: CanvasUnitVector3Schema,
      point: CanvasFiniteVector3Schema
    })
    .strict()
]);

export const Canvas2DGridSchema = z
  .object({
    mode: z.literal("2d"),
    origin: CanvasFinitePoint2Schema,
    spacing: CanvasPositiveSpacingSchema
  })
  .strict();

export const Canvas3DGridSchema = z
  .object({
    mode: z.literal("3d"),
    origin: CanvasFiniteVector3Schema,
    axisU: CanvasFiniteVector3Schema,
    axisV: CanvasFiniteVector3Schema,
    spacing: CanvasPositiveSpacingSchema
  })
  .strict()
  .superRefine((grid, context) => {
    const [ux, uy, uz] = grid.axisU;
    const [vx, vy, vz] = grid.axisV;
    const crossProduct = [
      uy * vz - uz * vy,
      uz * vx - ux * vz,
      ux * vy - uy * vx
    ];

    if (crossProduct.every((component) => component === 0)) {
      context.addIssue({
        code: "custom",
        message: "3D grid axes must be non-parallel.",
        path: ["axisV"]
      });
    }
  });

export const CanvasGridSchema = z.union([
  Canvas2DGridSchema,
  Canvas3DGridSchema
]);

export const CanvasGridSnapRequestSchema = z.union([
  z
    .object({
      grid: Canvas2DGridSchema,
      kind: z.literal("grid"),
      mode: z.literal("2d"),
      position: CanvasFinitePoint2Schema
    })
    .strict(),
  z
    .object({
      grid: Canvas3DGridSchema,
      kind: z.literal("grid"),
      mode: z.literal("3d"),
      position: CanvasFiniteVector3Schema
    })
    .strict()
]);

export const CanvasGridSnapResultSchema = z.union([
  z
    .object({
      kind: z.literal("grid"),
      mode: z.literal("2d"),
      position: CanvasFinitePoint2Schema
    })
    .strict(),
  z
    .object({
      kind: z.literal("grid"),
      mode: z.literal("3d"),
      position: CanvasFiniteVector3Schema
    })
    .strict()
]);

const Canvas2DAuthoringPreviewSchemas = [
  z
    .object({
      kind: z.literal("node"),
      mode: z.literal("2d"),
      node: Canvas2DNodeSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal("measurement"),
      measurement: z.literal("distance"),
      mode: z.literal("2d"),
      start: CanvasFinitePoint2Schema,
      end: CanvasFinitePoint2Schema
    })
    .strict(),
  z
    .object({
      kind: z.literal("annotation.anchor"),
      mode: z.literal("2d"),
      anchor: CanvasFinitePoint2Schema
    })
    .strict(),
  z
    .object({
      kind: z.literal("annotation.draft"),
      mode: z.literal("2d"),
      anchor: CanvasFinitePoint2Schema,
      text: z.string().min(1),
      targetId: NodeIdSchema.nullable()
    })
    .strict(),
  z
    .object({
      kind: z.literal("grid"),
      mode: z.literal("2d"),
      grid: Canvas2DGridSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal("grid.snap"),
      mode: z.literal("2d"),
      position: CanvasFinitePoint2Schema
    })
    .strict(),
  z
    .object({
      kind: z.literal("edge.draft"),
      mode: z.literal("2d"),
      sourceId: NodeIdSchema,
      /** Side the drag started from, so the preview leaves the same handle. */
      sourcePort: CanvasNodePortSideSchema.nullable().default(null),
      targetPoint: CanvasFinitePoint2Schema,
      stroke: z.string().min(1).default("#94a3b8"),
      strokeWidth: z.number().positive().default(2),
      lineStyle: z.enum(["solid", "dashed", "dotted"]).default("solid"),
      targetArrow: z.boolean().default(true)
    })
    .strict(),
  z
    .object({
      kind: z.literal("select.marquee"),
      mode: z.literal("2d"),
      start: CanvasFinitePoint2Schema,
      end: CanvasFinitePoint2Schema
    })
    .strict()
] as const;

const Canvas3DPrimitiveGhostSchema = z.discriminatedUnion("type", [
  BoxNodeSchema.pick({
    color: true,
    position: true,
    rotation: true,
    scale: true,
    type: true
  }).strict()
]);

const Canvas3DAuthoringPreviewSchemas = [
  z
    .object({
      kind: z.literal("node"),
      mode: z.literal("3d"),
      node: Canvas3DNodeSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal("measurement"),
      measurement: z.literal("distance"),
      mode: z.literal("3d"),
      start: CanvasFiniteVector3Schema,
      end: CanvasFiniteVector3Schema
    })
    .strict(),
  z
    .object({
      kind: z.literal("annotation.anchor"),
      mode: z.literal("3d"),
      anchor: CanvasFiniteVector3Schema
    })
    .strict(),
  z
    .object({
      kind: z.literal("annotation.draft"),
      mode: z.literal("3d"),
      anchor: CanvasFiniteVector3Schema,
      text: z.string().min(1),
      targetId: NodeIdSchema.nullable()
    })
    .strict(),
  z
    .object({
      kind: z.literal("grid"),
      mode: z.literal("3d"),
      grid: Canvas3DGridSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal("grid.snap"),
      mode: z.literal("3d"),
      position: CanvasFiniteVector3Schema
    })
    .strict(),
  z
    .object({
      kind: z.literal("primitive.ghost"),
      mode: z.literal("3d"),
      primitive: Canvas3DPrimitiveGhostSchema
    })
    .strict()
] as const;

export const CanvasAuthoringPreviewSchema = z.union([
  ...Canvas2DAuthoringPreviewSchemas,
  ...Canvas3DAuthoringPreviewSchemas
]);

export type CanvasMode = z.output<typeof CanvasModeSchema>;
export type RenderLoop = z.output<typeof RenderLoopSchema>;
export type GeometryKind = z.output<typeof GeometryKindSchema>;
export type NodeId = z.output<typeof NodeIdSchema>;
export type CanvasLayerId = z.output<typeof CanvasLayerIdSchema>;
export type Point2 = z.output<typeof Point2Schema>;
export type Vector3 = z.output<typeof Vector3Schema>;
export type CanvasKnownDocumentSchemaVersion = z.output<
  typeof CanvasKnownDocumentSchemaVersionSchema
>;
export type CanvasDocumentSchemaVersion = typeof CANVAS_DOCUMENT_SCHEMA_VERSION;
export type CanvasLayer = z.output<typeof CanvasLayerSchema>;
export type CanvasLayerInput = z.input<typeof CanvasLayerSchema>;
export type CanvasMeasurementUnit = z.output<
  typeof CanvasMeasurementUnitSchema
>;
export type Camera = z.output<typeof CameraSchema>;
export type RenderOptions = z.output<typeof RenderOptionsSchema>;
export type RenderLodOptions = z.output<typeof RenderLodOptionsSchema>;
export type Canvas2DGroupNode = z.output<typeof Canvas2DGroupNodeSchema>;
export type Canvas3DGroupNode = z.output<typeof Canvas3DGroupNodeSchema>;
export type Canvas2DMeasurementNode = z.output<
  typeof Canvas2DMeasurementNodeSchema
>;
export type Canvas3DMeasurementNode = z.output<
  typeof Canvas3DMeasurementNodeSchema
>;
export type Canvas2DAnnotationNode = z.output<
  typeof Canvas2DAnnotationNodeSchema
>;
export type Canvas3DAnnotationNode = z.output<
  typeof Canvas3DAnnotationNodeSchema
>;
export type Canvas2DEdgeNode = z.output<typeof Canvas2DEdgeNodeSchema>;
export type Canvas2DTextNode = z.output<typeof Canvas2DTextNodeSchema>;
export type Canvas2DHtmlNode = z.output<typeof Canvas2DHtmlNodeSchema>;
export type Canvas2DNode = z.output<typeof Canvas2DNodeSchema>;
export type Canvas3DNode = z.output<typeof Canvas3DNodeSchema>;
export type CanvasNode = z.output<typeof CanvasNodeSchema>;
export type CanvasNodeInput = z.input<typeof CanvasNodeSchema>;
export type Canvas2DNodeType = z.output<typeof Canvas2DNodeTypeSchema>;
export type Canvas3DNodeType = z.output<typeof Canvas3DNodeTypeSchema>;
export type CanvasNodeIdentity = z.output<typeof CanvasNodeIdentitySchema>;
export type CanvasNodeIdentityForMode<TMode extends CanvasMode> = Extract<
  CanvasNodeIdentity,
  { nodeMode: TMode }
>;
export type CanvasNodeIdentityFor<TNode extends CanvasNode> =
  TNode extends Canvas2DNode
    ? Omit<CanvasNodeIdentityForMode<"2d">, "nodeType"> & {
        readonly nodeType: TNode["type"];
      }
    : TNode extends Canvas3DNode
      ? Omit<CanvasNodeIdentityForMode<"3d">, "nodeType"> & {
          readonly nodeType: TNode["type"];
        }
      : never;
export type CanvasCoordinateForMode<TMode extends CanvasMode> =
  TMode extends "2d" ? Point2 : Vector3;
export type CanvasNodeForMode<TMode extends CanvasMode> = TMode extends "2d"
  ? Canvas2DNode
  : Canvas3DNode;
export type CanvasNodeByType<
  TMode extends CanvasMode,
  TType extends CanvasNodeForMode<TMode>["type"]
> = Extract<CanvasNodeForMode<TMode>, { type: TType }>;
export type CanvasCreateIdContext<
  TMode extends CanvasMode,
  TType extends CanvasNodeForMode<TMode>["type"]
> = {
  readonly document: CanvasDocument;
  readonly mode: TMode;
  readonly type: TType;
};
export type CanvasCreateId = <
  TMode extends CanvasMode,
  TType extends CanvasNodeForMode<TMode>["type"]
>(context: CanvasCreateIdContext<TMode, TType>) => NodeId;
export type CanvasWorkPlane = z.output<typeof CanvasWorkPlaneSchema>;
export type CanvasScenePointRequest = z.output<
  typeof CanvasScenePointRequestSchema
>;
export type CanvasScenePointResult = z.output<
  typeof CanvasScenePointResultSchema
>;
export type CanvasScenePointRequestFor<TMode extends CanvasMode> = Extract<
  CanvasScenePointRequest,
  { mode: TMode }
>;
export type CanvasScenePointResultFor<TMode extends CanvasMode> = Extract<
  CanvasScenePointResult,
  { mode: TMode }
>;
export type CanvasScenePointResolver = {
  (
    request: CanvasScenePointRequestFor<"2d">
  ):
    | CanvasScenePointResultFor<"2d">
    | Promise<CanvasScenePointResultFor<"2d">>;
  (
    request: CanvasScenePointRequestFor<"3d">
  ):
    | CanvasScenePointResultFor<"3d">
    | Promise<CanvasScenePointResultFor<"3d">>;
};
export type CanvasScenePointRuntime = {
  resolveScenePoint: CanvasScenePointResolver;
};
export type CanvasScenePointRuntimeForMode<TMode extends CanvasMode> = {
  resolveScenePoint: (
    request: CanvasScenePointRequestFor<TMode>
  ) =>
    | CanvasScenePointResultFor<TMode>
      | Promise<CanvasScenePointResultFor<TMode>>;
};
export type Canvas3DSurfacePointRequest = z.output<
  typeof Canvas3DSurfacePointRequestSchema
>;
export type Canvas3DSurfacePointResult = z.output<
  typeof Canvas3DSurfacePointResultSchema
>;
export type Canvas3DSurfacePointResolver = (
  request: Canvas3DSurfacePointRequest
) => Canvas3DSurfacePointResult | Promise<Canvas3DSurfacePointResult>;
export type Canvas3DSurfacePointRuntime = {
  resolveSurfacePoint: Canvas3DSurfacePointResolver;
};
export type Canvas2DGrid = z.output<typeof Canvas2DGridSchema>;
export type Canvas3DGrid = z.output<typeof Canvas3DGridSchema>;
export type CanvasGrid = z.output<typeof CanvasGridSchema>;
export type CanvasGridForMode<TMode extends CanvasMode> = Extract<
  CanvasGrid,
  { mode: TMode }
>;
export type CanvasGridSnapRequest = z.output<
  typeof CanvasGridSnapRequestSchema
>;
export type CanvasGridSnapResult = z.output<
  typeof CanvasGridSnapResultSchema
>;
export type CanvasGridSnapRequestFor<TMode extends CanvasMode> = Extract<
  CanvasGridSnapRequest,
  { mode: TMode }
>;
export type CanvasGridSnapResultFor<TMode extends CanvasMode> = Extract<
  CanvasGridSnapResult,
  { mode: TMode }
>;
export type CanvasAuthoringPreview = z.output<
  typeof CanvasAuthoringPreviewSchema
>;
export type CanvasAuthoringPreviewForMode<TMode extends CanvasMode> = Extract<
  CanvasAuthoringPreview,
  { mode: TMode }
>;
export type CanvasAuthoringPreviewRuntime<
  TMode extends CanvasMode = CanvasMode
> = {
  setAuthoringPreviews: (
    previews: readonly CanvasAuthoringPreviewForMode<TMode>[]
  ) => void | Promise<void>;
};
export type Canvas2DScene = z.output<typeof Canvas2DSceneSchema>;
export type Canvas2DSceneInput = z.input<typeof Canvas2DSceneSchema>;
export type Canvas3DScene = z.output<typeof Canvas3DSceneSchema>;
export type Canvas3DSceneInput = z.input<typeof Canvas3DSceneSchema>;
export type CanvasScene = z.output<typeof CanvasSceneSchema>;
export type CanvasSceneInput = z.input<typeof CanvasSceneSchema>;
export type CanvasSceneForMode<TMode extends CanvasMode> = TMode extends "2d"
  ? Canvas2DScene
  : Canvas3DScene;
export type CanvasSceneInputForMode<TMode extends CanvasMode> =
  TMode extends "2d" ? Canvas2DSceneInput : Canvas3DSceneInput;
export type AssetKind = z.output<typeof AssetKindSchema>;
export type AssetRef = z.output<typeof AssetRefSchema>;
export type AssetRefInput = z.input<typeof AssetRefSchema>;
export type CanvasDocument = z.output<typeof CanvasDocumentSchema>;
export type CanvasDocumentInput = z.input<typeof CanvasDocumentSchema>;
export type CanvasDocumentParseStage =
  | "json"
  | "version"
  | "migration"
  | "document";
export type SelectionState = z.output<typeof SelectionStateSchema>;
export type SelectionStateInput = z.input<typeof SelectionStateSchema>;
export type HitTargetKind = z.output<typeof HitTargetKindSchema>;
export type CanvasSelectionMode = z.output<typeof CanvasSelectionModeSchema>;
export type CanvasHitTestInput = z.output<typeof CanvasHitTestInputSchema>;
export type CanvasHitResult = z.output<typeof CanvasHitResultSchema>;
export type CanvasToolPointerType = z.output<
  typeof CanvasToolPointerTypeSchema
>;
export type CanvasToolPointerInput = z.output<
  typeof CanvasToolPointerInputSchema
>;
export type CanvasToolKeyInput = z.output<typeof CanvasToolKeyInputSchema>;
export type CanvasToolInput = z.output<typeof CanvasToolInputSchema>;
export type CanvasNodeTranslationConstraint = z.output<
  typeof CanvasNodeTranslationConstraintSchema
>;
export type CanvasNodeRotationAxis = z.output<
  typeof CanvasNodeRotationAxisSchema
>;
export type CanvasNodeScaleConstraint = z.output<
  typeof CanvasNodeScaleConstraintSchema
>;
export type CanvasNodeTransformKind = z.output<
  typeof CanvasNodeTransformKindSchema
>;
export type CanvasNodeTranslationHandleId = z.output<
  typeof CanvasNodeTranslationHandleIdSchema
>;
export type CanvasNodeRotationHandleId = z.output<
  typeof CanvasNodeRotationHandleIdSchema
>;
export type CanvasNodeScaleHandleId = z.output<
  typeof CanvasNodeScaleHandleIdSchema
>;
export type CanvasNodeTransformHandleId = z.output<
  typeof CanvasNodeTransformHandleIdSchema
>;
export type CanvasNodeTransformHandleTarget = z.output<
  typeof CanvasNodeTransformHandleTargetSchema
>;
export type CanvasNodeTransformInput = z.output<
  typeof CanvasNodeTransformInputSchema
>;
export type CanvasNodeTransformPreview = z.output<
  typeof CanvasNodeTransformPreviewSchema
>;
export type CanvasNodeTransformPreviewForMode<TMode extends CanvasMode> =
  Extract<CanvasNodeTransformPreview, { mode: TMode }>;
export type CanvasRuntimeStatus = "idle" | "running" | "destroyed";
export type CanvasStoreState<TMode extends CanvasMode = CanvasMode> = {
  scene: CanvasSceneForMode<TMode>;
  status: CanvasRuntimeStatus;
  setScene: (
    scene: CanvasSceneInputForMode<TMode>
  ) => CanvasSceneForMode<TMode>;
  setStatus: (status: CanvasRuntimeStatus) => void;
};
export type CanvasStore<TMode extends CanvasMode = CanvasMode> =
  TMode extends CanvasMode ? StoreApi<CanvasStoreState<TMode>> : never;

export type CanvasCommandMeta = {
  id?: string | undefined;
  label?: string | undefined;
  timestamp?: string | undefined;
  userId?: string | undefined;
};

type AtLeastOne<Value> = {
  [Key in keyof Value]-?: Required<Pick<Value, Key>> &
    Partial<Omit<Value, Key>>;
}[keyof Value];
type CanvasNodeMutableFieldsFor<TNode extends CanvasNode> = {
  readonly [Key in Exclude<keyof TNode, "id" | "type">]: TNode[Key];
};

export type CanvasNodePatchFor<TNode extends CanvasNode> =
  TNode extends CanvasNode
    ? AtLeastOne<CanvasNodeMutableFieldsFor<TNode>> & {
        readonly id?: never;
        readonly type?: never;
      }
    : never;

export type CanvasNodePatch = CanvasNodePatchFor<CanvasNode>;

type CanvasLayerMutableFields = {
  readonly [Key in Exclude<keyof CanvasLayer, "id">]: CanvasLayer[Key];
};

export type CanvasLayerPatch = AtLeastOne<CanvasLayerMutableFields> & {
  readonly id?: never;
};

export type CanvasPluginCommandType = `plugin.${string}`;

export type CanvasPluginCommandFor<
  TType extends CanvasPluginCommandType = CanvasPluginCommandType,
  TPayload = JsonValue
> = CanvasCommandMeta & {
  readonly payload: TPayload;
  readonly type: TType;
};

export type CanvasNodeUpdateCommandFor<
  TMode extends CanvasMode,
  TType extends CanvasNodeForMode<TMode>["type"]
> = CanvasCommandMeta & {
  readonly nodeMode: TMode;
  readonly nodeType: TType;
  readonly type: "node.update";
  readonly nodeId: NodeId;
  readonly patch: CanvasNodePatchFor<CanvasNodeByType<TMode, TType>>;
};

type CanvasNodeUpdateCommandForMode<TMode extends CanvasMode> = {
  [TType in CanvasNodeForMode<TMode>["type"]]: CanvasNodeUpdateCommandFor<
    TMode,
    TType
  >;
}[CanvasNodeForMode<TMode>["type"]];

export type CanvasNodeUpdateCommand =
  | CanvasNodeUpdateCommandForMode<"2d">
  | CanvasNodeUpdateCommandForMode<"3d">;

export type CanvasCommand =
  | (CanvasCommandMeta & {
      type: "node.add";
      node: CanvasNodeInput;
      index?: number | undefined;
    })
  | (CanvasCommandMeta & {
      type: "node.remove";
      nodeId: NodeId;
    })
  | CanvasNodeUpdateCommand
  | (CanvasCommandMeta & {
      type: "layer.add";
      layer: CanvasLayerInput;
      index: number;
    })
  | (CanvasCommandMeta & {
      type: "layer.update";
      layerId: CanvasLayerId;
      patch: CanvasLayerPatch;
    })
  | (CanvasCommandMeta & {
      type: "layer.remove";
      layerId: CanvasLayerId;
      targetLayerId: CanvasLayerId | null;
    })
  | (CanvasCommandMeta & {
      type: "layer.reorder";
      layerId: CanvasLayerId;
      index: number;
    })
  | (CanvasCommandMeta & {
      type: "selection.set";
      selection: SelectionState;
    })
  | (CanvasCommandMeta & {
      type: "transaction";
      commands: CanvasCommand[];
    })
  | CanvasPluginCommandFor;

export type CanvasPluginCommand = CanvasPluginCommandFor;

const CanvasCommandMetaSchemaShape = {
  id: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  timestamp: z.string().min(1).optional(),
  userId: z.string().min(1).optional()
};

type CanonicalNodeSchema =
  | typeof RectNodeSchema
  | typeof CircleNodeSchema
  | typeof BoxNodeSchema
  | typeof SphereNodeSchema
  | typeof InstancesNodeSchema
  | typeof MeshNodeObjectSchema
  | typeof Canvas2DGroupNodeSchema
  | typeof Canvas3DGroupNodeSchema
  | typeof Canvas2DMeasurementNodeSchema
  | typeof Canvas3DMeasurementNodeSchema
  | typeof Canvas2DAnnotationNodeSchema
  | typeof Canvas3DAnnotationNodeSchema
  | typeof Canvas2DEdgeNodeSchema
  | typeof Canvas2DTextNodeSchema
  | typeof Canvas2DHtmlNodeSchema;

function withoutSchemaDefault(schema: z.ZodType): z.ZodType {
  if (schema instanceof z.ZodDefault) {
    return schema.removeDefault() as unknown as z.ZodType;
  }

  return schema;
}

function createCanonicalNodePatchSchema<TSchema extends CanonicalNodeSchema>(
  nodeSchema: TSchema
): z.ZodType<CanvasNodePatchFor<z.output<TSchema>>> {
  const mutableShape: { [key: string]: z.ZodType } = {};
  const nodeShape = nodeSchema.shape as {
    readonly [key: string]: z.ZodType;
  };

  for (const [key, fieldSchema] of Object.entries(nodeShape)) {
    if (key !== "id" && key !== "type") {
      mutableShape[key] = withoutSchemaDefault(fieldSchema).optional();
    }
  }

  return z
    .object(mutableShape)
    .strict()
    .superRefine((patch, context) => {
      const entries = Object.entries(patch);

      if (entries.length === 0) {
        context.addIssue({
          code: "custom",
          message: "Node patch must not be empty."
        });
      }

      for (const [field, value] of entries) {
        if (value === undefined) {
          context.addIssue({
            code: "custom",
            message: `Node patch field must be explicitly defined: ${field}.`,
            path: [field]
          });
        }
      }
    }) as unknown as z.ZodType<CanvasNodePatchFor<z.output<TSchema>>>;
}

const RectNodePatchSchema = createCanonicalNodePatchSchema(RectNodeSchema);
const CircleNodePatchSchema = createCanonicalNodePatchSchema(CircleNodeSchema);
const BoxNodePatchSchema = createCanonicalNodePatchSchema(BoxNodeSchema);
const SphereNodePatchSchema = createCanonicalNodePatchSchema(SphereNodeSchema);
const InstancesNodePatchSchema =
  createCanonicalNodePatchSchema(InstancesNodeSchema);
const MeshNodePatchSchema = createCanonicalNodePatchSchema(MeshNodeObjectSchema);
const Canvas2DGroupNodePatchSchema = createCanonicalNodePatchSchema(
  Canvas2DGroupNodeSchema
);
const Canvas3DGroupNodePatchSchema = createCanonicalNodePatchSchema(
  Canvas3DGroupNodeSchema
);
const Canvas2DMeasurementNodePatchSchema = createCanonicalNodePatchSchema(
  Canvas2DMeasurementNodeSchema
);
const Canvas3DMeasurementNodePatchSchema = createCanonicalNodePatchSchema(
  Canvas3DMeasurementNodeSchema
);
const Canvas2DAnnotationNodePatchSchema = createCanonicalNodePatchSchema(
  Canvas2DAnnotationNodeSchema
);
const Canvas3DAnnotationNodePatchSchema = createCanonicalNodePatchSchema(
  Canvas3DAnnotationNodeSchema
);
const Canvas2DEdgeNodePatchSchema = createCanonicalNodePatchSchema(
  Canvas2DEdgeNodeSchema
);
const Canvas2DTextNodePatchSchema = createCanonicalNodePatchSchema(
  Canvas2DTextNodeSchema
);
const Canvas2DHtmlNodePatchSchema = createCanonicalNodePatchSchema(
  Canvas2DHtmlNodeSchema
);

export const CanvasNodePatchSchema: z.ZodType<CanvasNodePatch> = z.union([
  RectNodePatchSchema,
  CircleNodePatchSchema,
  BoxNodePatchSchema,
  SphereNodePatchSchema,
  InstancesNodePatchSchema,
  MeshNodePatchSchema,
  Canvas2DGroupNodePatchSchema,
  Canvas3DGroupNodePatchSchema,
  Canvas2DMeasurementNodePatchSchema,
  Canvas3DMeasurementNodePatchSchema,
  Canvas2DAnnotationNodePatchSchema,
  Canvas3DAnnotationNodePatchSchema,
  Canvas2DEdgeNodePatchSchema,
  Canvas2DTextNodePatchSchema,
  Canvas2DHtmlNodePatchSchema
]);

export const CanvasLayerPatchSchema = z
  .object({
    name: CanvasLayerNameSchema.optional(),
    visible: CanvasLayerVisibilitySchema.optional(),
    locked: CanvasLayerLockSchema.optional(),
    metadata: CanvasMetadataValueSchema.optional()
  })
  .strict()
  .superRefine((patch, context) => {
    const patchEntries = Object.entries(patch);

    if (patchEntries.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Layer patch must not be empty."
      });
    }

    for (const [field, value] of patchEntries) {
      if (value === undefined) {
        context.addIssue({
          code: "custom",
          message: `Layer patch field must be explicitly defined: ${field}.`,
          path: [field]
        });
      }
    }
  })
  .transform((patch): CanvasLayerPatch => patch as CanvasLayerPatch);

const PluginCommandTypeSchema = z.custom<CanvasPluginCommandType>(
  (value) =>
    typeof value === "string" &&
    value.startsWith("plugin.") &&
    value.length > "plugin.".length,
  "Plugin command type must use a non-empty plugin.* namespace."
);

function createNodeUpdateCommandSchema<
  TMode extends CanvasMode,
  TType extends CanvasNodeForMode<TMode>["type"]
>(
  nodeMode: TMode,
  nodeType: TType,
  patchSchema: z.ZodType<
    CanvasNodePatchFor<CanvasNodeByType<TMode, TType>>
  >
): z.ZodType<CanvasNodeUpdateCommandFor<TMode, TType>> {
  return z
    .object({
      ...CanvasCommandMetaSchemaShape,
      nodeMode: z.literal(nodeMode),
      nodeType: z.literal(nodeType),
      type: z.literal("node.update"),
      nodeId: NodeIdSchema,
      patch: patchSchema
    })
    .strict() as z.ZodType<CanvasNodeUpdateCommandFor<TMode, TType>>;
}

const CanvasNodeUpdateCommandSchema: z.ZodType<CanvasNodeUpdateCommand> =
  z.union([
    createNodeUpdateCommandSchema("2d", "rect", RectNodePatchSchema),
    createNodeUpdateCommandSchema("2d", "circle", CircleNodePatchSchema),
    createNodeUpdateCommandSchema(
      "2d",
      "group",
      Canvas2DGroupNodePatchSchema
    ),
    createNodeUpdateCommandSchema(
      "2d",
      "measurement",
      Canvas2DMeasurementNodePatchSchema
    ),
    createNodeUpdateCommandSchema(
      "2d",
      "annotation",
      Canvas2DAnnotationNodePatchSchema
    ),
    createNodeUpdateCommandSchema("2d", "edge", Canvas2DEdgeNodePatchSchema),
    createNodeUpdateCommandSchema("2d", "text", Canvas2DTextNodePatchSchema),
    createNodeUpdateCommandSchema("2d", "html", Canvas2DHtmlNodePatchSchema),
    createNodeUpdateCommandSchema("3d", "box", BoxNodePatchSchema),
    createNodeUpdateCommandSchema("3d", "sphere", SphereNodePatchSchema),
    createNodeUpdateCommandSchema(
      "3d",
      "instances",
      InstancesNodePatchSchema
    ),
    createNodeUpdateCommandSchema("3d", "mesh", MeshNodePatchSchema),
    createNodeUpdateCommandSchema(
      "3d",
      "group",
      Canvas3DGroupNodePatchSchema
    ),
    createNodeUpdateCommandSchema(
      "3d",
      "measurement",
      Canvas3DMeasurementNodePatchSchema
    ),
    createNodeUpdateCommandSchema(
      "3d",
      "annotation",
      Canvas3DAnnotationNodePatchSchema
    )
  ]);

export const CanvasCommandSchema: z.ZodType<CanvasCommand> = z.lazy(() =>
  z.union([
    z
      .object({
        ...CanvasCommandMetaSchemaShape,
        type: z.literal("node.add"),
        node: CanvasNodeSchema,
        index: z.number().int().nonnegative().optional()
      })
      .strict(),
    z
      .object({
        ...CanvasCommandMetaSchemaShape,
        type: z.literal("node.remove"),
        nodeId: NodeIdSchema
      })
      .strict(),
    CanvasNodeUpdateCommandSchema,
    z
      .object({
        ...CanvasCommandMetaSchemaShape,
        type: z.literal("layer.add"),
        layer: CanvasLayerSchema,
        index: z.number().int().nonnegative()
      })
      .strict(),
    z
      .object({
        ...CanvasCommandMetaSchemaShape,
        type: z.literal("layer.update"),
        layerId: CanvasLayerIdSchema,
        patch: CanvasLayerPatchSchema
      })
      .strict(),
    z
      .object({
        ...CanvasCommandMetaSchemaShape,
        type: z.literal("layer.remove"),
        layerId: CanvasLayerIdSchema,
        targetLayerId: CanvasLayerIdSchema.nullable()
      })
      .strict()
      .superRefine((command, context) => {
        if (command.targetLayerId === command.layerId) {
          context.addIssue({
            code: "custom",
            message: "Layer removal target must differ from the removed layer.",
            path: ["targetLayerId"]
          });
        }
      }),
    z
      .object({
        ...CanvasCommandMetaSchemaShape,
        type: z.literal("layer.reorder"),
        layerId: CanvasLayerIdSchema,
        index: z.number().int().nonnegative()
      })
      .strict(),
    z
      .object({
        ...CanvasCommandMetaSchemaShape,
        type: z.literal("selection.set"),
        selection: SelectionStateSchema
      })
      .strict(),
    z
      .object({
        ...CanvasCommandMetaSchemaShape,
        type: z.literal("transaction"),
        commands: z.array(CanvasCommandSchema).min(1)
      })
      .strict(),
    z
      .object({
        ...CanvasCommandMetaSchemaShape,
        payload: JsonValueSchema,
        type: PluginCommandTypeSchema
      })
      .strict()
  ])
);

export type CanvasCommandResult = {
  document: CanvasDocument;
  inverse?: CanvasCommand;
  selection?: SelectionState;
};

export type CanvasCommandContext = {
  document: CanvasDocument;
  selection: SelectionState;
};

export type CanvasCommandHandler<TCommand extends CanvasCommand = CanvasCommand> = (
  command: TCommand,
  context: CanvasCommandContext
) => CanvasCommandResult | Promise<CanvasCommandResult>;

export type CanvasPluginCommandDescriptor<
  TType extends CanvasPluginCommandType = CanvasPluginCommandType,
  TPayload = JsonValue
> = {
  readonly parsePayload: (payload: JsonValue) => TPayload;
  readonly type: TType;
};

export type CanvasPluginCommandHandler<
  TType extends CanvasPluginCommandType = CanvasPluginCommandType,
  TPayload = JsonValue
> = (
  command: CanvasPluginCommandFor<TType, TPayload>,
  context: CanvasCommandContext
) => CanvasCommandResult | Promise<CanvasCommandResult>;

export type CanvasDocumentSummary = {
  id: NodeId;
  schemaVersion: CanvasDocumentSchemaVersion;
  title?: string;
  updatedAt?: string;
};

export type CanvasSaveResult =
  | { ok: true; document: CanvasDocument; revision: number }
  | {
      ok: false;
      reason: "conflict";
      serverRevision: number;
      document?: CanvasDocument;
    }
  | {
      ok: false;
      reason: "validation" | "permission" | "unknown";
      message: string;
    };

/**
 * A single JSON-Patch-style operation scoped to a document path. Kept
 * serializable so patch logs can be stored, replayed, and migrated.
 */
export const DocumentPatchOpSchema = z.object({
  op: z.enum(["add", "remove", "replace", "move"]),
  path: z.array(z.union([z.string(), z.number().int().nonnegative()])),
  from: z
    .array(z.union([z.string(), z.number().int().nonnegative()]))
    .optional(),
  value: JsonValueSchema.optional()
});

export const DocumentPatchSchema = z.array(DocumentPatchOpSchema);

export type DocumentPatchOp = z.infer<typeof DocumentPatchOpSchema>;

export type DocumentPatch = z.infer<typeof DocumentPatchSchema>;

/**
 * A serializable record of one applied patch between two document revisions.
 * Adapters that support `applyCommands` can persist these as an audit log;
 * `inversePatch` (when present) lets a server undo a rejected patch.
 */
export const DocumentPatchRecordSchema = z.object({
  id: NodeIdSchema,
  documentId: NodeIdSchema,
  baseRevision: z.number().int().nonnegative(),
  revision: z.number().int().nonnegative(),
  patch: DocumentPatchSchema,
  inversePatch: DocumentPatchSchema.optional(),
  commandType: z.string().optional(),
  actorId: z.string().optional(),
  createdAt: z.string().min(1)
});

export type DocumentPatchRecord = z.infer<typeof DocumentPatchRecordSchema>;

export type AssetUpload = {
  asset: AssetRefInput;
  data: ArrayBuffer | Blob;
};

/** Bytes plus the stored `AssetRef` returned by `loadAsset`. */
export type AssetRecord = {
  readonly asset: AssetRef;
  readonly data: ArrayBuffer;
};

export async function readAssetUploadData(
  data: ArrayBuffer | Blob
): Promise<ArrayBuffer> {
  if (data instanceof ArrayBuffer) {
    return data;
  }

  if (typeof data.arrayBuffer === "function") {
    return data.arrayBuffer();
  }

  throw new TypeError("Asset upload data must be an ArrayBuffer or Blob.");
}

export function defineUploadedAsset(
  upload: AssetUpload,
  data: ArrayBuffer,
  defaultUri: string
): AssetRef {
  const id =
    typeof upload.asset.id === "string" && upload.asset.id.length > 0
      ? upload.asset.id
      : `asset-${Date.now().toString(36)}`;

  return AssetRefSchema.parse({
    ...upload.asset,
    id,
    type: upload.asset.type ?? "binary",
    uri: upload.asset.uri ?? defaultUri,
    byteLength: data.byteLength,
    metadata: upload.asset.metadata ?? {}
  });
}

export type CanvasStorageAdapter = {
  name: string;
  applyCommands?: (
    documentId: NodeId,
    commands: readonly CanvasCommand[],
    options?: {
      baseRevision?: number;
    }
  ) => Promise<CanvasSaveResult>;
  deleteDocument?: (id: NodeId) => Promise<boolean>;
  listDocuments?: () => Promise<CanvasDocumentSummary[]>;
  loadAsset?: (id: NodeId) => Promise<AssetRecord | null>;
  loadDocument: (id: NodeId) => Promise<CanvasDocument | null>;
  saveDocument: (
    document: CanvasDocument,
    options?: {
      baseRevision?: number;
    }
  ) => Promise<CanvasSaveResult>;
  uploadAsset?: (upload: AssetUpload) => Promise<AssetRef>;
};

/**
 * Writes every `geometry` asset in `document.assets` from `store` through
 * `adapter.uploadAsset`. Other asset kinds are left unchanged. Returns a
 * document whose geometry refs carry the uploaded `uri` and `byteLength`.
 */
export async function persistCanvasGeometryStore(
  document: CanvasDocument,
  store: CanvasGeometryStore,
  adapter: Pick<CanvasStorageAdapter, "uploadAsset">
): Promise<CanvasDocument> {
  const upload = adapter.uploadAsset;
  if (upload === undefined) {
    return document;
  }

  const assets: AssetRef[] = [];
  for (const asset of document.assets) {
    if (asset.type !== "geometry") {
      assets.push(asset);
      continue;
    }

    const geometry = store.get(asset.id);
    if (geometry === undefined) {
      assets.push(asset);
      continue;
    }

    const data = encodeMeshGeometry(geometry);
    assets.push(
      await upload({
        asset: {
          ...asset,
          byteLength: data.byteLength
        },
        data
      })
    );
  }

  return {
    ...document,
    assets
  };
}

/**
 * Fills `store` from `geometry` assets by calling `adapter.loadAsset` and
 * decoding `denovo.mesh-geometry.v1` payloads.
 */
export async function hydrateCanvasGeometryStore(
  document: CanvasDocument,
  adapter: Pick<CanvasStorageAdapter, "loadAsset">,
  store: CanvasGeometryStore = createMemoryGeometryStore()
): Promise<CanvasGeometryStore> {
  const load = adapter.loadAsset;
  if (load === undefined) {
    return store;
  }

  for (const asset of document.assets) {
    if (asset.type !== "geometry") {
      continue;
    }

    const record = await load(asset.id);
    if (record === null) {
      continue;
    }

    store.set(asset.id, decodeMeshGeometry(record.data));
  }

  return store;
}

/** Axis-aligned rectangle in scene space. */
export type CanvasRectBounds = {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
};

/** One node handed to a layout adapter. */
export type CanvasLayoutNode = {
  readonly id: NodeId;
  readonly type: string;
  readonly position: Point2;
  /**
   * World bounds as measured by the renderer. When the caller has no renderer
   * geometry available this degrades to a zero-size box at `position`, which
   * `CanvasLayoutInput.measured` reports so adapters can react.
   */
  readonly bounds: CanvasRectBounds;
};

/** A connection between two layout nodes, for graph-aware adapters. */
export type CanvasLayoutEdge = {
  readonly id: NodeId;
  readonly sourceId: NodeId;
  readonly targetId: NodeId;
};

export type CanvasLayoutInput = {
  readonly nodes: readonly CanvasLayoutNode[];
  readonly edges: readonly CanvasLayoutEdge[];
  /**
   * `false` when node bounds could not be measured (no renderer geometry), so
   * every box is a degenerate point. Adapters that need real sizes — anything
   * aligning by edge or centre — should account for this rather than silently
   * producing wrong positions.
   */
  readonly measured: boolean;
  readonly options?: JsonValue | undefined;
};

export type CanvasLayoutPlacement = {
  readonly id: NodeId;
  readonly position: Point2;
};

/**
 * Adapters return positions only. Turning them into commands, grouping them
 * into a single undo step, and validating the result stays with the editor, so
 * an adapter can be a pure function.
 */
export type CanvasLayoutResult = {
  readonly positions: readonly CanvasLayoutPlacement[];
};

/**
 * Pluggable node placement. `arrange` adapters reposition an explicit selection
 * (align, distribute); `layout` adapters lay out a whole graph (grid, and
 * whatever hierarchical engine a consumer wires in).
 */
export type CanvasLayoutAdapter = {
  readonly name: string;
  readonly kind: "arrange" | "layout";
  readonly label?: string | undefined;
  apply: (input: CanvasLayoutInput) => CanvasLayoutResult;
};

export type CanvasRendererAdapter<
  TTarget,
  TRuntime,
  TOptions = undefined,
  TMode extends CanvasMode = CanvasMode
> = {
  modes: readonly TMode[];
  name: string;
  createRuntime: (
    target: TTarget,
    scene: CanvasSceneForMode<TMode>,
    options?: TOptions
  ) => TRuntime;
};

export type CanvasToolContext = {
  activateTool: (toolId: string | null) => void;
  dispatch: (command: CanvasCommand) => Promise<CanvasCommandResult>;
  getDocument: () => CanvasDocument;
  /**
   * Ids of visible nodes whose world bounds intersect the given scene-space
   * rectangle. Supplied by renderers that can answer area queries (the 2D
   * runtime does); marquee selection degrades to a no-op without it.
   */
  getNodesInBounds?:
    | ((bounds: CanvasRectBounds) => readonly NodeId[])
    | undefined;
  /**
   * World bounds for the given nodes, keyed by id. Supplied by renderers that
   * can measure geometry; layout falls back to point-sized boxes without it.
   */
  resolveNodeBounds?:
    | ((ids: readonly NodeId[]) => ReadonlyMap<NodeId, CanvasRectBounds>)
    | undefined;
  getSelection: () => SelectionState;
  hitTest?:
    | ((input: CanvasHitTestInput) =>
        CanvasHitResult | Promise<CanvasHitResult>)
    | undefined;
  hoverFromHit: (hit: CanvasHitResult) => Promise<CanvasCommandResult | null>;
  nodeTransformKinds?: readonly CanvasNodeTransformKind[] | undefined;
  resolveNodeTransform?:
    | ((input: CanvasNodeTransformInput) =>
        CanvasNodeTransformPreview | Promise<CanvasNodeTransformPreview>)
    | undefined;
  resolveScenePoint?:
    | CanvasScenePointRuntime["resolveScenePoint"]
    | undefined;
  resolveSurfacePoint?:
    | Canvas3DSurfacePointRuntime["resolveSurfacePoint"]
    | undefined;
  selectFromHit: (
    hit: CanvasHitResult,
    mode?: CanvasSelectionMode
  ) => Promise<CanvasCommandResult | null>;
  setNodeTransformPreview?:
    | ((preview: CanvasNodeTransformPreview | null) => void)
    | undefined;
  setAuthoringPreviews?:
    | CanvasAuthoringPreviewRuntime["setAuthoringPreviews"]
    | undefined;
};

/**
 * `allow` keeps full pan/zoom, `block` disables navigation for the tool's whole
 * session, and `allow-pan` keeps panning (spacebar drag, trackpad, one-finger
 * touch) while suppressing zoom — so a drag-to-create gesture can still reach an
 * off-screen target without the viewport scaling mid-gesture.
 */
export type CanvasToolNavigationPolicy = "allow" | "block" | "allow-pan";
export type CanvasToolTransformKind = CanvasNodeTransformKind;

export type CanvasToolDefinition<TId extends string = string> = {
  /**
   * Asks the renderer to surface per-node connection handles while this tool is
   * active. Renderers without handle support ignore it.
   */
  connectionHandles?: boolean;
  cursor?: string;
  id: TId;
  label: string;
  navigation?: CanvasToolNavigationPolicy;
  onDeactivate?: (context: CanvasToolContext) => void;
  transform?: CanvasToolTransformKind;
  onInput?: (
    input: CanvasToolInput,
    context: CanvasToolContext
  ) => void | Promise<void>;
};

/**
 * Plugin-owned tools live in an explicit owner/tool namespace. The facade
 * validates both non-empty segments before a plugin registry is committed.
 */
export type CanvasPluginToolId = `plugin.${string}.tool.${string}`;

export type CanvasPluginToolDefinition<
  TId extends CanvasPluginToolId = CanvasPluginToolId
> = CanvasToolDefinition<TId>;

export type CanvasPluginContext = {
  coreVersion: typeof CANVAS_DOCUMENT_SCHEMA_VERSION;
  registerCommand: <
    TType extends CanvasPluginCommandType,
    TPayload
  >(
    descriptor: CanvasPluginCommandDescriptor<TType, TPayload>,
    handler: CanvasPluginCommandHandler<TType, TPayload>
  ) => void;
  registerTool: (definition: CanvasPluginToolDefinition) => void;
};

export type CanvasPlugin = {
  name: string;
  setup?: (context: CanvasPluginContext) => void | Promise<void>;
  tools?: readonly CanvasPluginToolDefinition[];
};

export function defineScene(scene: CanvasSceneInput): CanvasScene {
  return CanvasSceneSchema.parse(scene);
}

/**
 * Constructs a canonical `edge` for new writes. Accepts `routing: "straight" |
 * "orthogonal"` only. Quadratic bends use `curve: "curved"` and `curveOffset`.
 */
export function define2DEdge(input: Canvas2DEdgeWriteInput): Canvas2DEdgeNode {
  return Canvas2DEdgeNodeSchema.parse(input);
}

export function defineCommand(command: CanvasCommand): CanvasCommand {
  return CanvasCommandSchema.parse(command);
}

export function definePluginCommand<
  const TType extends CanvasPluginCommandType,
  TPayload
>(
  descriptor: CanvasPluginCommandDescriptor<TType, TPayload>
): CanvasPluginCommandDescriptor<TType, TPayload> {
  if (!PluginCommandTypeSchema.safeParse(descriptor.type).success) {
    throw new Error(
      "Plugin command types must use a non-empty plugin.* namespace."
    );
  }

  if (typeof descriptor.parsePayload !== "function") {
    throw new Error("Plugin command descriptors require a payload parser.");
  }

  return descriptor;
}

export function defineHitTestInput(input: CanvasHitTestInput): CanvasHitTestInput {
  return CanvasHitTestInputSchema.parse(input);
}

export function defineHitResult(result: CanvasHitResult): CanvasHitResult {
  return CanvasHitResultSchema.parse(result);
}

export function defineToolInput(input: CanvasToolInput): CanvasToolInput {
  return CanvasToolInputSchema.parse(input);
}

export function safeDefineCommand(command: unknown) {
  return CanvasCommandSchema.safeParse(command);
}

export function safeDefineHitTestInput(input: unknown) {
  return CanvasHitTestInputSchema.safeParse(input);
}

export function safeDefineHitResult(result: unknown) {
  return CanvasHitResultSchema.safeParse(result);
}

export function safeDefineToolInput(input: unknown) {
  return CanvasToolInputSchema.safeParse(input);
}

export function safeDefineScene(scene: unknown) {
  return CanvasSceneSchema.safeParse(scene);
}

export function defineDocument(document: CanvasDocumentInput): CanvasDocument {
  return CanvasDocumentSchema.parse(document);
}

export class CanvasDocumentParseError extends Error {
  readonly cause: unknown;
  readonly stage: CanvasDocumentParseStage;

  constructor(stage: CanvasDocumentParseStage, cause: unknown) {
    let message: string;

    switch (stage) {
      case "json":
        message = "Canvas document JSON parsing failed.";
        break;
      case "version":
        message = "Canvas document schema version inspection failed.";
        break;
      case "migration":
        message = "Canvas document migration from 0.1.0 failed.";
        break;
      case "document":
        message = "Canvas document validation failed.";
        break;
    }

    super(message);
    this.name = "CanvasDocumentParseError";
    this.cause = cause;
    this.stage = stage;
  }
}

export class CanvasDocumentVersionError extends CanvasDocumentParseError {
  readonly schemaVersion: string | null;
  readonly supportedVersions = [
    CANVAS_LEGACY_DOCUMENT_SCHEMA_VERSION,
    CANVAS_DOCUMENT_SCHEMA_VERSION
  ] as const;

  constructor(schemaVersion: string | null) {
    super("version", schemaVersion);
    this.name = "CanvasDocumentVersionError";
    this.schemaVersion = schemaVersion;
    this.message =
      schemaVersion === null
        ? "Canvas document schemaVersion is missing or is not a string."
        : `Unsupported canvas document schemaVersion: ${schemaVersion}. Supported versions: ${CANVAS_LEGACY_DOCUMENT_SCHEMA_VERSION}, ${CANVAS_DOCUMENT_SCHEMA_VERSION}.`;
  }
}

function inspectDocumentSchemaVersion(input: unknown): string {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new CanvasDocumentVersionError(null);
  }

  const schemaVersion = Reflect.get(input, "schemaVersion");

  if (typeof schemaVersion !== "string") {
    throw new CanvasDocumentVersionError(null);
  }

  return schemaVersion;
}

function validateCurrentDocument(input: unknown): CanvasDocument {
  try {
    return CanvasDocumentSchema.parse(input);
  } catch (cause) {
    throw new CanvasDocumentParseError("document", cause);
  }
}

function migrateLegacyDocument(input: unknown): CanvasDocument {
  let legacyDocument: z.output<typeof LegacyCanvasDocumentSchema>;

  try {
    legacyDocument = LegacyCanvasDocumentSchema.parse(input);
  } catch (cause) {
    throw new CanvasDocumentParseError("migration", cause);
  }

  const defaultLayer = {
    id: CANVAS_DEFAULT_LAYER_ID,
    locked: false,
    metadata: {},
    name: CANVAS_DEFAULT_LAYER_NAME,
    visible: true
  } as const;
  const scene = {
    ...legacyDocument.scene,
    layers: [defaultLayer],
    nodes: legacyDocument.scene.nodes.map((node) => ({
      ...node,
      layerId: CANVAS_DEFAULT_LAYER_ID,
      locked: false,
      metadata: {},
      parentId: null,
      visible: true
    }))
  };

  return validateCurrentDocument({
    ...legacyDocument,
    scene,
    schemaVersion: CANVAS_DOCUMENT_SCHEMA_VERSION
  });
}

export function parseDocument(input: unknown): CanvasDocument {
  const schemaVersion = inspectDocumentSchemaVersion(input);

  switch (schemaVersion) {
    case CANVAS_LEGACY_DOCUMENT_SCHEMA_VERSION:
      return migrateLegacyDocument(input);
    case CANVAS_DOCUMENT_SCHEMA_VERSION:
      return validateCurrentDocument(input);
    default:
      throw new CanvasDocumentVersionError(schemaVersion);
  }
}

export function parseDocumentJson(json: string): CanvasDocument {
  let input: unknown;

  try {
    input = JSON.parse(json) as unknown;
  } catch (cause) {
    throw new CanvasDocumentParseError("json", cause);
  }

  return parseDocument(input);
}

export function safeDefineDocument(document: unknown) {
  return CanvasDocumentSchema.safeParse(document);
}

export function createDocument(document: CanvasDocumentInput): CanvasDocument {
  const timestamp = new Date().toISOString();

  return defineDocument({
    createdAt: timestamp,
    updatedAt: timestamp,
    ...document,
    schemaVersion: CANVAS_DOCUMENT_SCHEMA_VERSION
  });
}

export function defineSelection(selection: SelectionStateInput): SelectionState {
  return SelectionStateSchema.parse(selection);
}

export function createEmptySelection(): SelectionState {
  return defineSelection({
    hoveredId: null,
    ids: [],
    primaryId: null
  });
}

export function isCanvas2DNode(node: CanvasNode): node is Canvas2DNode {
  switch (node.type) {
    case "rect":
    case "circle":
    case "edge":
    case "text":
    case "html":
      return true;
    case "box":
    case "sphere":
    case "mesh":
    case "instances":
      return false;
    case "group":
      return typeof node.rotation === "number";
    case "measurement":
      return node.start.length === 2;
    case "annotation":
      return node.anchor.length === 2;
  }
}

export function isCanvas3DNode(node: CanvasNode): node is Canvas3DNode {
  switch (node.type) {
    case "rect":
    case "circle":
    case "edge":
    case "text":
    case "html":
      return false;
    case "box":
    case "sphere":
    case "mesh":
    case "instances":
      return true;
    case "group":
      return Array.isArray(node.rotation);
    case "measurement":
      return node.start.length === 3;
    case "annotation":
      return node.anchor.length === 3;
  }
}

export {
  CANVAS_MESH_GEOMETRY_SCHEMA,
  computeMeshGeometryBounds,
  createMemoryGeometryStore,
  createMeshGeometryAssetRef,
  decodeMeshGeometry,
  defineMeshGeometry,
  encodeMeshGeometry,
  parseMeshGeometry,
  resolveCanvasMeshGeometry,
  safeParseMeshGeometry
} from "./geometry.js";
export type {
  CanvasGeometryStore,
  CanvasMeshBounds,
  CanvasMeshGeometry,
  CanvasMeshGeometryAssetMetadata,
  CanvasMeshGeometryInput,
  CanvasMeshGeometrySource
} from "./geometry.js";

export function createCanvasStore<TMode extends CanvasMode = CanvasMode>(
  initialScene: CanvasSceneInputForMode<TMode>
): CanvasStore<TMode> {
  return createStore<CanvasStoreState<TMode>>()((set) => ({
    scene: defineScene(initialScene) as CanvasSceneForMode<TMode>,
    status: "idle",
    setScene(sceneInput) {
      const scene = defineScene(sceneInput) as CanvasSceneForMode<TMode>;
      set({ scene });
      return scene;
    },
    setStatus(status) {
      set({ status });
    }
  })) as CanvasStore<TMode>;
}

export * from "./serialize.js";
