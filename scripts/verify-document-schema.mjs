import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createCheckRunner } from "./lib/checks.mjs";

import {
  CANVAS_DEFAULT_LAYER_ID,
  CANVAS_DEFAULT_LAYER_NAME,
  CANVAS_DOCUMENT_SCHEMA_VERSION,
  CANVAS_LEGACY_DOCUMENT_SCHEMA_VERSION,
  CanvasAuthoringPreviewSchema,
  Canvas3DSurfacePointRequestSchema,
  Canvas3DSurfacePointResultSchema,
  CanvasDocumentParseError,
  CanvasDocumentVersionError,
  CanvasGridSnapRequestSchema,
  CanvasGridSnapResultSchema,
  CanvasGridSchema,
  CanvasLayerPatchSchema,
  Canvas2DNodeTypeSchema,
  Canvas3DNodeTypeSchema,
  CanvasNodeIdentitySchema,
  CanvasNodeTransformHandleIdSchema,
  CanvasNodeTransformHandleTargetSchema,
  CanvasNodeTransformInputSchema,
  CanvasNodeTransformPreviewSchema,
  CanvasScenePointRequestSchema,
  CanvasScenePointResultSchema,
  CanvasWorkPlaneSchema,
  Canvas2DEdgeNodeSchema,
  createMemoryGeometryStore,
  createMeshGeometryAssetRef,
  define2DEdge,
  defineMeshGeometry,
  resolveCanvasMeshGeometry,
  defineCommand,
  defineDocument,
  defineHitResult,
  defineHitTestInput,
  defineToolInput,
  defineScene,
  defineSelection,
  parseDocument,
  parseDocumentJson,
  safeDefineDocument,
  safeDefineCommand,
  safeDefineHitResult,
  safeDefineHitTestInput,
  safeDefineToolInput,
  safeDefineScene
} from "../packages/core/dist/index.js";

const rootDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const tempDir = join(rootDir, ".tmp", "document-schema");
const { check, report } = createCheckRunner();

function assertParseFails(result, expectedMessage) {
  assert.equal(result.success, false);

  const issueText = JSON.stringify(result.error.issues);
  assert.match(issueText, expectedMessage);
}

const scene2dInput = {
  id: "scene-2d",
  layers: [
    {
      id: "layer-2d",
      name: "2D Layer"
    }
  ],
  mode: "2d",
  nodes: [
    {
      fill: "#22c55e",
      id: "rect-1",
      layerId: "layer-2d",
      position: [12, 24],
      size: [120, 80],
      type: "rect"
    },
    {
      fill: "#38bdf8",
      id: "circle-1",
      layerId: "layer-2d",
      position: [220, 120],
      radius: 32,
      type: "circle"
    },
    {
      id: "edge-1",
      layerId: "layer-2d",
      sourceId: "rect-1",
      targetId: "circle-1",
      sourcePort: "right",
      targetPort: "left",
      routing: "orthogonal",
      stroke: "#94a3b8",
      strokeWidth: 2,
      type: "edge"
    },
    {
      fill: "#f8fafc",
      id: "text-1",
      layerId: "layer-2d",
      position: [40, 200],
      text: "Hello",
      type: "text"
    },
    {
      id: "html-1",
      layerId: "layer-2d",
      position: [300, 60],
      html: "<div>Card</div>",
      width: 80,
      height: 40,
      type: "html"
    }
  ]
};

const scene3dInput = {
  id: "scene-3d",
  layers: [
    {
      id: "layer-3d",
      name: "3D Layer"
    }
  ],
  mode: "3d",
  nodes: [
    {
      color: "#3b82f6",
      id: "box-1",
      layerId: "layer-3d",
      position: [0, 0, 0],
      type: "box"
    },
    {
      color: "#f97316",
      id: "sphere-1",
      layerId: "layer-3d",
      position: [2, 0, 0],
      radius: 0.75,
      type: "sphere"
    },
    {
      geometry: "box",
      id: "instances-1",
      layerId: "layer-3d",
      instances: [
        {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        }
      ],
      type: "instances"
    },
    {
      color: "#9ca3af",
      id: "mesh-1",
      indices: [0, 1, 2],
      layerId: "layer-3d",
      position: [-2, 0, 0],
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      type: "mesh"
    }
  ]
};

const meterUnit = {
  metersPerUnit: 1,
  name: "meter",
  symbol: "m"
};

check("defineScene-validates-2d-scene", () => {
  const scene = defineScene(scene2dInput);

  assert.equal(scene.id, "scene-2d");
  assert.equal(scene.mode, "2d");
  assert.equal(scene.render.loop, "demand");
  assert.equal(scene.render.frustumCulling, true);
  assert.equal(scene.nodes.length, 5);
});

check("defineScene-validates-3d-scene", () => {
  const scene = defineScene(scene3dInput);

  assert.equal(scene.id, "scene-3d");
  assert.equal(scene.mode, "3d");
  assert.equal(scene.camera.fov, 50);
  assert.deepEqual(scene.nodes.map((node) => node.type), [
    "box",
    "sphere",
    "instances",
    "mesh"
  ]);
});

check("mesh-nodes-accept-inline-or-geometry-asset", () => {
  const inline = defineScene({
    id: "inline-mesh-scene",
    layers: [{ id: "layer-main", name: "Main" }],
    mode: "3d",
    nodes: [
      {
        id: "inline-mesh",
        indices: [0, 1, 2],
        layerId: "layer-main",
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        type: "mesh"
      }
    ]
  });
  assert.equal(inline.nodes[0]?.type, "mesh");
  assert.deepEqual(inline.nodes[0]?.positions?.slice(0, 3), [0, 0, 0]);

  const assetScene = defineScene({
    id: "asset-mesh-scene",
    layers: [{ id: "layer-main", name: "Main" }],
    mode: "3d",
    nodes: [
      {
        geometryAssetId: "mesh-geo-1",
        id: "asset-mesh",
        layerId: "layer-main",
        type: "mesh"
      }
    ]
  });
  assert.equal(assetScene.nodes[0]?.geometryAssetId, "mesh-geo-1");
  assert.equal(assetScene.nodes[0]?.positions, undefined);

  assertParseFails(
    safeDefineScene({
      id: "mesh-neither-scene",
      layers: [{ id: "layer-main", name: "Main" }],
      mode: "3d",
      nodes: [
        {
          id: "empty-mesh",
          layerId: "layer-main",
          type: "mesh"
        }
      ]
    }),
    /inline positions and indices, or geometryAssetId/
  );

  assertParseFails(
    safeDefineScene({
      id: "mesh-both-scene",
      layers: [{ id: "layer-main", name: "Main" }],
      mode: "3d",
      nodes: [
        {
          geometryAssetId: "mesh-geo-1",
          id: "both-mesh",
          indices: [0, 1, 2],
          layerId: "layer-main",
          positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
          type: "mesh"
        }
      ]
    }),
    /cannot combine geometryAssetId/
  );

  const geometry = defineMeshGeometry({
    schema: "denovo.mesh-geometry.v1",
    positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    indices: [0, 1, 2]
  });
  const asset = createMeshGeometryAssetRef("mesh-geo-1", geometry);
  const document = defineDocument({
    id: "asset-mesh-document",
    assets: [asset],
    scene: assetScene
  });
  assert.equal(document.assets[0]?.type, "geometry");
  assert.equal(document.assets[0]?.id, "mesh-geo-1");

  assertParseFails(
    safeDefineDocument({
      id: "missing-geo-document",
      scene: assetScene
    }),
    /Missing geometry asset/
  );

  assertParseFails(
    safeDefineDocument({
      assets: [{ id: "mesh-geo-1", type: "binary" }],
      id: "wrong-kind-document",
      scene: assetScene
    }),
    /Geometry asset must have type/
  );

  const store = createMemoryGeometryStore();
  store.set("mesh-geo-1", geometry);
  const resolved = resolveCanvasMeshGeometry(assetScene.nodes[0], store);
  assert.deepEqual(resolved?.indices, [0, 1, 2]);
  assert.equal(resolveCanvasMeshGeometry(assetScene.nodes[0]), null);
});

check("defineScene-rejects-duplicate-node-ids", () => {
  const result = safeDefineScene({
    id: "duplicate-node-scene",
    layers: [{ id: "layer-main", name: "Main" }],
    nodes: [
      {
        id: "duplicate",
        layerId: "layer-main",
        type: "box"
      },
      {
        id: "duplicate",
        layerId: "layer-main",
        type: "sphere"
      }
    ]
  });

  assertParseFails(result, /Duplicate node id: duplicate/);
});

check("defineScene-rejects-3d-nodes-in-2d-scenes", () => {
  const result = safeDefineScene({
    id: "invalid-2d-scene",
    layers: [{ id: "layer-main", name: "Main" }],
    mode: "2d",
    nodes: [
      {
        id: "box-in-2d",
        layerId: "layer-main",
        type: "box"
      }
    ]
  });

  assertParseFails(result, /Invalid input/);
});

check("defineScene-rejects-2d-nodes-in-3d-scenes", () => {
  const result = safeDefineScene({
    id: "invalid-3d-scene",
    layers: [{ id: "layer-main", name: "Main" }],
    mode: "3d",
    nodes: [
      {
        id: "rect-in-3d",
        layerId: "layer-main",
        type: "rect"
      }
    ]
  });

  assertParseFails(result, /Invalid input/);
});

check("m3-node-variants-normalize-common-fields-by-mode", () => {
  const scene2d = defineScene({
    id: "m3-2d-scene",
    layers: [{ id: "layer-main", name: "Main" }],
    mode: "2d",
    nodes: [
      {
        id: "group-2d",
        layerId: "layer-main",
        type: "group"
      },
      {
        id: "rect-child",
        layerId: "layer-main",
        parentId: "group-2d",
        type: "rect"
      },
      {
        end: [3, 4],
        id: "measurement-2d",
        layerId: "layer-main",
        measurement: "distance",
        precision: 2,
        start: [0, 0],
        type: "measurement",
        unit: meterUnit
      },
      {
        anchor: [10, 20],
        id: "annotation-2d",
        layerId: "layer-main",
        targetId: "rect-child",
        text: "Origin",
        type: "annotation"
      }
    ]
  });
  const group2d = scene2d.nodes[0];
  const annotation2d = scene2d.nodes[3];

  assert.deepEqual(scene2d.layers[0], {
    id: "layer-main",
    locked: false,
    metadata: {},
    name: "Main",
    visible: true
  });
  assert.equal(group2d?.type, "group");
  assert.deepEqual(group2d?.position, [0, 0]);
  assert.equal(group2d?.rotation, 0);
  assert.equal(group2d?.visible, true);
  assert.equal(group2d?.locked, false);
  assert.deepEqual(group2d?.metadata, {});
  assert.equal(group2d?.parentId, null);
  assert.equal(annotation2d?.type, "annotation");
  assert.equal(annotation2d?.targetId, "rect-child");

  const scene3d = defineScene({
    id: "m3-3d-scene",
    layers: [{ id: "layer-main", name: "Main" }],
    mode: "3d",
    nodes: [
      {
        id: "group-3d",
        layerId: "layer-main",
        type: "group"
      },
      {
        end: [1, 2, 3],
        id: "measurement-3d",
        layerId: "layer-main",
        measurement: "distance",
        precision: 3,
        start: [0, 0, 0],
        type: "measurement",
        unit: meterUnit
      },
      {
        anchor: [1, 2, 3],
        id: "annotation-3d",
        layerId: "layer-main",
        text: "Point",
        type: "annotation"
      }
    ]
  });

  assert.deepEqual(scene3d.nodes[0]?.rotation, [0, 0, 0]);
  assert.deepEqual(scene3d.nodes[1]?.end, [1, 2, 3]);
  assert.equal(scene3d.nodes[2]?.type, "annotation");
  assert.equal(scene3d.nodes[2]?.targetId, null);
});

check("scene-schema-enforces-layer-relationships-and-strict-shapes", () => {
  assert.equal(
    safeDefineScene({ id: "no-layers", layers: [], nodes: [] }).success,
    false
  );
  assertParseFails(
    safeDefineScene({
      id: "duplicate-layers",
      layers: [
        { id: "layer-main", name: "Main" },
        { id: "layer-main", name: "Duplicate" }
      ],
      nodes: []
    }),
    /Duplicate layer id: layer-main/
  );
  assertParseFails(
    safeDefineScene({
      id: "missing-layer",
      layers: [{ id: "layer-main", name: "Main" }],
      nodes: [{ id: "box-1", layerId: "layer-missing", type: "box" }]
    }),
    /Missing layer: layer-missing/
  );
  assertParseFails(
    safeDefineScene({
      id: "strict-layer",
      layers: [{ id: "layer-main", name: "Main", rendererIndex: 1 }],
      nodes: []
    }),
    /Unrecognized key/
  );
  assert.equal(
    safeDefineScene({
      id: "strict-measurement",
      layers: [{ id: "layer-main", name: "Main" }],
      mode: "2d",
      nodes: [
        {
          end: [1, 1],
          id: "measurement-1",
          layerId: "layer-main",
          measurement: "distance",
          precision: 2,
          start: [0, 0],
          type: "measurement",
          unit: { ...meterUnit, abbreviation: "meter" },
          value: 1.414
        }
      ]
    }).success,
    false
  );
});

check("scene-schema-validates-parent-relations-and-cycles", () => {
  const invalidScenes = [
    {
      expected: /Missing parent node: missing-group/,
      scene: {
        id: "missing-parent",
        layers: [{ id: "layer-main", name: "Main" }],
        nodes: [
          {
            id: "box-child",
            layerId: "layer-main",
            parentId: "missing-group",
            type: "box"
          }
        ]
      }
    },
    {
      expected: /Parent node must be a group: box-parent/,
      scene: {
        id: "non-group-parent",
        layers: [{ id: "layer-main", name: "Main" }],
        nodes: [
          { id: "box-parent", layerId: "layer-main", type: "box" },
          {
            id: "sphere-child",
            layerId: "layer-main",
            parentId: "box-parent",
            type: "sphere"
          }
        ]
      }
    },
    {
      expected: /Parent node must be in layer layer-child: group-parent/,
      scene: {
        id: "cross-layer-parent",
        layers: [
          { id: "layer-parent", name: "Parent" },
          { id: "layer-child", name: "Child" }
        ],
        nodes: [
          { id: "group-parent", layerId: "layer-parent", type: "group" },
          {
            id: "box-child",
            layerId: "layer-child",
            parentId: "group-parent",
            type: "box"
          }
        ]
      }
    },
    {
      expected: /Node cannot parent itself: group-self/,
      scene: {
        id: "self-parent",
        layers: [{ id: "layer-main", name: "Main" }],
        nodes: [
          {
            id: "group-self",
            layerId: "layer-main",
            parentId: "group-self",
            type: "group"
          }
        ]
      }
    },
    {
      expected: /Parent cycle detected/,
      scene: {
        id: "parent-cycle",
        layers: [{ id: "layer-main", name: "Main" }],
        nodes: [
          {
            id: "group-a",
            layerId: "layer-main",
            parentId: "group-b",
            type: "group"
          },
          {
            id: "group-b",
            layerId: "layer-main",
            parentId: "group-a",
            type: "group"
          }
        ]
      }
    }
  ];

  for (const { expected, scene } of invalidScenes) {
    assertParseFails(safeDefineScene(scene), expected);
  }
});

check("scene-schema-validates-annotation-targets", () => {
  assertParseFails(
    safeDefineScene({
      id: "missing-annotation-target",
      layers: [{ id: "layer-main", name: "Main" }],
      mode: "2d",
      nodes: [
        {
          anchor: [0, 0],
          id: "annotation-1",
          layerId: "layer-main",
          targetId: "missing-node",
          text: "Missing",
          type: "annotation"
        }
      ]
    }),
    /Missing annotation target: missing-node/
  );
});

check("scene-schema-validates-edge-endpoints", () => {
  assertParseFails(
    safeDefineScene({
      id: "missing-edge-source",
      layers: [{ id: "layer-main", name: "Main" }],
      mode: "2d",
      nodes: [
        { id: "edge-1", layerId: "layer-main", sourceId: "missing-node", targetId: "rect-1", type: "edge" },
        { id: "rect-1", layerId: "layer-main", type: "rect", size: [10, 10] }
      ]
    }),
    /Missing edge source: missing-node/
  );
  assertParseFails(
    safeDefineScene({
      id: "cross-layer-edge",
      layers: [
        { id: "layer-main", name: "Main" },
        { id: "layer-other", name: "Other" }
      ],
      mode: "2d",
      nodes: [
        { id: "edge-1", layerId: "layer-main", sourceId: "rect-1", targetId: "rect-2", type: "edge" },
        { id: "rect-1", layerId: "layer-main", type: "rect", size: [10, 10] },
        { id: "rect-2", layerId: "layer-other", type: "rect", size: [10, 10] }
      ]
    }),
    /Edge target must be in the same layer as the edge: rect-2/
  );
});

check("scene-schema-validates-edge-ports", () => {
  // Ports name a side of the node's bounds, not an arbitrary string.
  assertParseFails(
    safeDefineScene({
      id: "bad-edge-port",
      layers: [{ id: "layer-main", name: "Main" }],
      mode: "2d",
      nodes: [
        {
          id: "edge-1",
          layerId: "layer-main",
          sourceId: "rect-1",
          targetId: "rect-2",
          sourcePort: "middle",
          type: "edge"
        },
        { id: "rect-1", layerId: "layer-main", type: "rect", size: [10, 10] },
        { id: "rect-2", layerId: "layer-main", type: "rect", size: [10, 10] }
      ]
    }),
    /sourcePort/
  );

  // Omitting a port keeps the pre-port behaviour: attach to the node centre.
  const centred = safeDefineScene({
    id: "default-edge-ports",
    layers: [{ id: "layer-main", name: "Main" }],
    mode: "2d",
    nodes: [
      {
        id: "edge-1",
        layerId: "layer-main",
        sourceId: "rect-1",
        targetId: "rect-2",
        type: "edge"
      },
      { id: "rect-1", layerId: "layer-main", type: "rect", size: [10, 10] },
      { id: "rect-2", layerId: "layer-main", type: "rect", size: [10, 10] }
    ]
  });
  assert.equal(centred.success, true);
  const edge = centred.data.nodes.find((node) => node.id === "edge-1");
  assert.equal(edge.sourcePort, null);
  assert.equal(edge.targetPort, null);
});

check("define2DEdge-writes-straight-or-orthogonal-and-parses-legacy-curved", () => {
  const written = define2DEdge({
    id: "edge-write",
    layerId: "layer-2d",
    sourceId: "rect-1",
    targetId: "circle-1",
    routing: "orthogonal",
    type: "edge"
  });
  assert.equal(written.routing, "orthogonal");
  assert.equal(written.curve, "straight");

  const quadratic = define2DEdge({
    id: "edge-quadratic",
    layerId: "layer-2d",
    sourceId: "rect-1",
    targetId: "circle-1",
    curve: "curved",
    curveOffset: 24,
    routing: "straight",
    type: "edge"
  });
  assert.equal(quadratic.routing, "straight");
  assert.equal(quadratic.curve, "curved");
  assert.equal(quadratic.curveOffset, 24);

  const legacy = Canvas2DEdgeNodeSchema.parse({
    id: "edge-legacy-curved",
    layerId: "layer-2d",
    sourceId: "rect-1",
    targetId: "circle-1",
    routing: "curved",
    type: "edge"
  });
  assert.equal(legacy.routing, "curved");

  const missingEndpoint = safeDefineScene({
    id: "missing-edge-target",
    layers: [{ id: "layer-main", name: "Main" }],
    mode: "2d",
    nodes: [
      { id: "edge-1", layerId: "layer-main", sourceId: "rect-1", targetId: "gone", type: "edge" },
      { id: "rect-1", layerId: "layer-main", type: "rect", size: [10, 10] }
    ]
  });
  assertParseFails(missingEndpoint, /Missing edge target: gone/);
});

check("m8-node-update-roundtrips-edge-text-html", () => {
  const edgeUpdate = defineCommand({
    nodeId: "edge-1",
    nodeMode: "2d",
    nodeType: "edge",
    patch: { stroke: "#ef4444", sourcePort: "right" },
    type: "node.update"
  });
  assert.equal(edgeUpdate.nodeType, "edge");
  assert.equal(edgeUpdate.patch.stroke, "#ef4444");

  const textUpdate = defineCommand({
    nodeId: "text-1",
    nodeMode: "2d",
    nodeType: "text",
    patch: { text: "updated" },
    type: "node.update"
  });
  assert.equal(textUpdate.patch.text, "updated");

  const htmlUpdate = defineCommand({
    nodeId: "html-1",
    nodeMode: "2d",
    nodeType: "html",
    patch: { html: "plain" },
    type: "node.update"
  });
  assert.equal(htmlUpdate.patch.html, "plain");
});

check("defineDocument-validates-document-shape", () => {
  const document = defineDocument({
    assets: [
      {
        byteLength: 128,
        id: "asset-1",
        metadata: {
          source: "test"
        },
        mimeType: "model/gltf-binary",
        type: "glb",
        uri: "asset.glb"
      }
    ],
    id: "document-1",
    metadata: {
      owner: "m0"
    },
    pluginState: {
      "demo.plugin": {
        enabled: true
      }
    },
    scene: scene3dInput,
    title: "M0 Document"
  });

  assert.equal(document.schemaVersion, CANVAS_DOCUMENT_SCHEMA_VERSION);
  assert.equal(document.assets.length, 1);
  assert.equal(document.scene.nodes.length, 4);
  assert.deepEqual(document.pluginState["demo.plugin"], {
    enabled: true
  });
});

check("defineDocument-rejects-duplicate-asset-ids", () => {
  const result = safeDefineDocument({
    assets: [
      {
        id: "asset-1"
      },
      {
        id: "asset-1"
      }
    ],
    id: "document-with-duplicates",
    scene: scene3dInput
  });

  assertParseFails(result, /Duplicate asset id: asset-1/);
});

check("document-json-roundtrip-is-stable", () => {
  const document = defineDocument({
    id: "roundtrip-document",
    metadata: {
      tags: ["json", "stable"],
      revision: 1
    },
    pluginState: {
      "roundtrip.plugin": {
        values: [1, 2, 3]
      }
    },
    scene: scene2dInput
  });
  const roundTripped = defineDocument(JSON.parse(JSON.stringify(document)));

  assert.deepEqual(roundTripped, document);
});

check("parseDocument-migrates-0.1.0-deterministically-to-canonical-0.2.0", () => {
  const legacyDocument = {
    assets: [{ id: "legacy-asset", type: "binary" }],
    id: "legacy-document",
    metadata: { source: "0.1.0" },
    pluginState: { "legacy.plugin": { enabled: true } },
    schemaVersion: CANVAS_LEGACY_DOCUMENT_SCHEMA_VERSION,
    scene: {
      id: "legacy-scene",
      mode: "2d",
      nodes: [
        { id: "legacy-rect", type: "rect" },
        { id: "legacy-circle", radius: 12, type: "circle" }
      ]
    }
  };
  const originalJson = JSON.stringify(legacyDocument);
  const migrated = parseDocument(legacyDocument);
  const migratedAgain = parseDocument(legacyDocument);

  assert.equal(JSON.stringify(legacyDocument), originalJson);
  assert.deepEqual(migratedAgain, migrated);
  assert.equal(migrated.schemaVersion, CANVAS_DOCUMENT_SCHEMA_VERSION);
  assert.deepEqual(migrated.scene.layers, [
    {
      id: CANVAS_DEFAULT_LAYER_ID,
      locked: false,
      metadata: {},
      name: CANVAS_DEFAULT_LAYER_NAME,
      visible: true
    }
  ]);

  for (const node of migrated.scene.nodes) {
    assert.equal(node.layerId, CANVAS_DEFAULT_LAYER_ID);
    assert.equal(node.visible, true);
    assert.equal(node.locked, false);
    assert.deepEqual(node.metadata, {});
    assert.equal(node.parentId, null);
  }

  assert.deepEqual(
    parseDocument(JSON.parse(JSON.stringify(migrated))),
    migrated
  );
  assert.deepEqual(parseDocumentJson(originalJson), migrated);
});

check("parseDocument-migrates-every-legacy-3d-node-kind", () => {
  const migrated = parseDocument({
    id: "legacy-3d-document",
    schemaVersion: CANVAS_LEGACY_DOCUMENT_SCHEMA_VERSION,
    scene: {
      id: "legacy-3d-scene",
      mode: "3d",
      nodes: [
        { id: "legacy-box", type: "box" },
        { id: "legacy-sphere", type: "sphere" },
        {
          id: "legacy-instances",
          instances: [{ position: [0, 0, 0] }],
          type: "instances"
        }
      ]
    }
  });

  assert.deepEqual(
    migrated.scene.nodes.map((node) => node.type),
    ["box", "sphere", "instances"]
  );
  assert.equal(
    migrated.scene.nodes.every(
      (node) => node.layerId === CANVAS_DEFAULT_LAYER_ID
    ),
    true
  );
});

check("document-version-boundary-rejects-missing-and-unsupported-versions", () => {
  for (const [input, expectedVersion] of [
    [{ id: "missing-version", scene: scene2dInput }, null],
    [
      {
        id: "future-version",
        schemaVersion: "9.0.0",
        scene: scene2dInput
      },
      "9.0.0"
    ],
    [
      {
        id: "past-version",
        schemaVersion: "0.0.1",
        scene: scene2dInput
      },
      "0.0.1"
    ]
  ]) {
    assert.throws(
      () => parseDocument(input),
      (error) =>
        error instanceof CanvasDocumentVersionError &&
        error.stage === "version" &&
        error.schemaVersion === expectedVersion &&
        error.supportedVersions[0] ===
          CANVAS_LEGACY_DOCUMENT_SCHEMA_VERSION &&
        error.supportedVersions[1] === CANVAS_DOCUMENT_SCHEMA_VERSION
    );
  }

  assert.equal(
    safeDefineDocument({
      id: "legacy-through-authoring-api",
      schemaVersion: CANVAS_LEGACY_DOCUMENT_SCHEMA_VERSION,
      scene: scene2dInput
    }).success,
    false
  );
});

check("parseDocument-distinguishes-migration-and-current-validation-errors", () => {
  assert.throws(
    () =>
      parseDocument({
        id: "invalid-legacy",
        schemaVersion: CANVAS_LEGACY_DOCUMENT_SCHEMA_VERSION,
        scene: {
          id: "invalid-legacy-scene",
          nodes: [{ id: "legacy-box", layerId: "not-legacy", type: "box" }]
        }
      }),
    (error) =>
      error instanceof CanvasDocumentParseError &&
      error.stage === "migration" &&
      /migration from 0\.1\.0 failed/.test(error.message)
  );
  assert.throws(
    () =>
      parseDocument({
        id: "invalid-current",
        schemaVersion: CANVAS_DOCUMENT_SCHEMA_VERSION,
        scene: { id: "invalid-current-scene", layers: [], nodes: [] }
      }),
    (error) =>
      error instanceof CanvasDocumentParseError &&
      error.stage === "document" &&
      /validation failed/.test(error.message)
  );
});

check("parseDocumentJson-validates-and-preserves-assets", () => {
  const document = parseDocumentJson(
    JSON.stringify({
      assets: [
        {
          id: "json-asset",
          metadata: {
            role: "preview"
          },
          type: "image",
          uri: "/assets/preview.png"
        }
      ],
      id: "json-document",
      schemaVersion: CANVAS_DOCUMENT_SCHEMA_VERSION,
      scene: scene2dInput
    })
  );

  assert.equal(document.id, "json-document");
  assert.equal(document.assets[0]?.id, "json-asset");
  assert.equal(document.assets[0]?.uri, "/assets/preview.png");
});

check("parseDocumentJson-maps-json-and-document-errors", () => {
  assert.throws(
    () => parseDocumentJson("{"),
    (error) =>
      error instanceof CanvasDocumentParseError &&
      error.stage === "json" &&
      /JSON parsing failed/.test(error.message)
  );
  assert.throws(
    () =>
      parseDocumentJson(
        JSON.stringify({
          id: "invalid-json-document",
          schemaVersion: CANVAS_DOCUMENT_SCHEMA_VERSION,
          scene: {
            id: "invalid-json-scene",
            layers: [{ id: "layer-main", name: "Main" }],
            mode: "2d",
            nodes: [
              {
                id: "invalid-box",
                layerId: "layer-main",
                type: "box"
              }
            ]
          }
        })
      ),
    (error) =>
      error instanceof CanvasDocumentParseError &&
      error.stage === "document" &&
      /validation failed/.test(error.message)
  );
});

check("scene-schema-rejects-renderer-runtime-fields", () => {
  assertParseFails(
    safeDefineScene({
      ...scene3dInput,
      renderer: "webgl2"
    }),
    /Unrecognized key/
  );

  assertParseFails(
    safeDefineScene({
      id: "node-runtime-field",
      layers: [{ id: "layer-main", name: "Main" }],
      nodes: [
        {
          id: "box-runtime",
          layerId: "layer-main",
          mesh: {
            uuid: "three-object"
          },
          type: "box"
        }
      ]
    }),
    /Unrecognized key/
  );
});

check("document-schema-rejects-non-json-extension-state", () => {
  assertParseFails(
    safeDefineDocument({
      id: "non-json-document",
      metadata: {
        callback() {
          return null;
        }
      },
      scene: scene2dInput
    }),
    /Invalid input/
  );
});

check("selection-schema-validates-primary-id", () => {
  assert.deepEqual(defineSelection({ ids: ["box-1"], primaryId: "box-1" }), {
    hoveredId: null,
    ids: ["box-1"],
    primaryId: "box-1"
  });

  assert.throws(() => {
    defineSelection({
      ids: ["box-1"],
      primaryId: "missing"
    });
  }, /primaryId must be included/);

  assert.throws(() => {
    defineSelection({
      ids: ["box-1", "box-1"],
      primaryId: "box-1"
    });
  }, /selected ids must be unique/);
});

check("hit-schema-normalizes-css-input-and-result-invariants", () => {
  assert.deepEqual(defineHitTestInput({ point: [218.392, 196.101] }), {
    point: [218.392, 196.101]
  });
  assert.equal(safeDefineHitTestInput({ point: [Infinity, 0] }).success, false);
  assert.equal(
    safeDefineHitTestInput({ point: [0, 0], devicePixelRatio: 2 }).success,
    false
  );

  assert.deepEqual(
    defineHitResult({
      distance: 1.25,
      instanceIndex: 7,
      kind: "node",
      nodeId: "instances-1",
      point: [0.1, 0.2, 0.3],
      renderer: "three"
    }),
    {
      distance: 1.25,
      instanceIndex: 7,
      kind: "node",
      nodeId: "instances-1",
      point: [0.1, 0.2, 0.3],
      renderer: "three"
    }
  );

  for (const invalidHit of [
    { kind: "node", renderer: "three" },
    { kind: "empty", nodeId: "box-1" },
    { instanceIndex: -1, kind: "node", nodeId: "instances-1" },
    { instanceIndex: 1.5, kind: "node", nodeId: "instances-1" },
    { kind: "handle", nodeId: "box-1" },
    { kind: "gizmo", subTarget: "" }
  ]) {
    assert.equal(safeDefineHitResult(invalidHit).success, false);
  }
});

check("tool-input-schema-normalizes-pointer-and-keyboard-events", () => {
  assert.deepEqual(
    defineToolInput({
      altKey: false,
      button: 0,
      buttons: 0,
      ctrlKey: false,
      delta: [4, -2],
      dragging: false,
      isPrimary: true,
      metaKey: false,
      origin: [12, 24],
      point: [16, 22],
      pointerId: 1,
      pointerType: "mouse",
      pressure: 0.5,
      shiftKey: true,
      type: "pointer.up"
    }),
    {
      altKey: false,
      button: 0,
      buttons: 0,
      ctrlKey: false,
      delta: [4, -2],
      dragging: false,
      isPrimary: true,
      metaKey: false,
      origin: [12, 24],
      point: [16, 22],
      pointerId: 1,
      pointerType: "mouse",
      pressure: 0.5,
      shiftKey: true,
      type: "pointer.up"
    }
  );
  assert.deepEqual(
    defineToolInput({
      altKey: false,
      code: "Escape",
      ctrlKey: false,
      key: "Escape",
      metaKey: false,
      repeat: false,
      shiftKey: false,
      type: "key.down"
    }).type,
    "key.down"
  );

  for (const invalidInput of [
    {
      altKey: false,
      button: 0,
      buttons: 0,
      ctrlKey: false,
      delta: [0, 0],
      dragging: false,
      isPrimary: true,
      metaKey: false,
      origin: [0, 0],
      point: [Infinity, 0],
      pointerId: 1,
      pointerType: "mouse",
      pressure: 0,
      shiftKey: false,
      type: "pointer.move"
    },
    {
      altKey: false,
      button: 0,
      buttons: 0,
      ctrlKey: false,
      delta: [0, 0],
      dragging: false,
      isPrimary: true,
      metaKey: false,
      origin: [0, 0],
      point: [0, 0],
      pointerId: 1,
      pointerType: "trackpad",
      pressure: 2,
      shiftKey: false,
      type: "pointer.move"
    },
    {
      altKey: false,
      code: "Escape",
      ctrlKey: false,
      extra: true,
      key: "Escape",
      metaKey: false,
      repeat: false,
      shiftKey: false,
      type: "key.down"
    }
  ]) {
    assert.equal(safeDefineToolInput(invalidInput).success, false);
  }
});

check("transform-schema-correlates-operation-dimension-and-values", () => {
  for (const handleId of [
    "translate.x",
    "translate.y",
    "translate.z",
    "translate.xy",
    "translate.xz",
    "translate.yz",
    "rotate.x",
    "rotate.y",
    "rotate.z",
    "scale.x",
    "scale.y",
    "scale.z",
    "scale.xy",
    "scale.xz",
    "scale.yz",
    "scale.uniform"
  ]) {
    assert.equal(CanvasNodeTransformHandleIdSchema.parse(handleId), handleId);
  }

  assert.deepEqual(
    CanvasNodeTransformHandleTargetSchema.parse({
      kind: "rotate",
      nodeId: "box-1"
    }),
    { kind: "rotate", nodeId: "box-1" }
  );

  for (const input of [
    {
      constraint: "free",
      kind: "translate",
      nodeId: "box-1",
      origin: [10, 20],
      point: [30, 40]
    },
    {
      axis: "z",
      kind: "rotate",
      nodeId: "box-1",
      origin: [10, 20],
      point: [30, 40]
    },
    {
      constraint: "uniform",
      kind: "scale",
      nodeId: "box-1",
      origin: [10, 20],
      point: [30, 40]
    }
  ]) {
    assert.equal(CanvasNodeTransformInputSchema.safeParse(input).success, true);
  }

  for (const preview of [
    {
      kind: "translate",
      mode: "2d",
      nodeId: "rect-1",
      position: [10, 20]
    },
    {
      kind: "translate",
      mode: "3d",
      nodeId: "box-1",
      position: [10, 20, 30]
    },
    { kind: "rotate", mode: "2d", nodeId: "rect-1", rotation: 0.5 },
    {
      kind: "rotate",
      mode: "3d",
      nodeId: "box-1",
      rotation: [0.1, 0.2, 0.3]
    },
    { kind: "scale", mode: "2d", nodeId: "rect-1", scale: [2, 3] },
    { kind: "scale", mode: "3d", nodeId: "box-1", scale: [2, 3, 4] }
  ]) {
    assert.equal(CanvasNodeTransformPreviewSchema.safeParse(preview).success, true);
  }

  for (const invalid of [
    { kind: "translate", nodeId: "box-1" },
    { kind: "rotate", nodeId: "box-1", extra: true },
    {
      axis: "xy",
      kind: "rotate",
      nodeId: "box-1",
      origin: [0, 0],
      point: [1, 1]
    },
    {
      constraint: "free",
      kind: "scale",
      nodeId: "box-1",
      origin: [0, 0],
      point: [1, 1]
    },
    {
      kind: "rotate",
      mode: "2d",
      nodeId: "rect-1",
      rotation: [0, 0, 1]
    },
    {
      kind: "scale",
      mode: "3d",
      nodeId: "box-1",
      rotation: [1, 1, 1]
    },
    {
      kind: "translate",
      mode: "3d",
      nodeId: "box-1",
      position: [1, 2]
    }
  ]) {
    const schema =
      "origin" in invalid ||
      ("kind" in invalid && !("mode" in invalid) && "nodeId" in invalid)
        ? CanvasNodeTransformInputSchema
        : CanvasNodeTransformPreviewSchema;
    assert.equal(schema.safeParse(invalid).success, false);
  }

  assert.equal(
    CanvasNodeTransformHandleTargetSchema.safeParse({ nodeId: "box-1" })
      .success,
    false
  );
  assert.equal(
    CanvasNodeTransformHandleIdSchema.safeParse("rotate.free").success,
    false
  );
});

check("scene-point-protocol-correlates-mode-and-finite-coordinates", () => {
  assert.deepEqual(
    CanvasScenePointRequestSchema.parse({
      mode: "2d",
      viewportPoint: [12, 24]
    }),
    {
      mode: "2d",
      viewportPoint: [12, 24]
    }
  );
  assert.deepEqual(
    CanvasScenePointRequestSchema.parse({
      mode: "3d",
      viewportPoint: [12, 24],
      workPlane: {
        constant: 0,
        normal: [0, 1, 0]
      }
    }).workPlane,
    {
      constant: 0,
      normal: [0, 1, 0]
    }
  );
  assert.deepEqual(
    CanvasScenePointResultSchema.parse({
      mode: "3d",
      position: [1, 2, 3]
    }),
    {
      mode: "3d",
      position: [1, 2, 3]
    }
  );

  for (const invalidWorkPlane of [
    { constant: 0, normal: [0, 0, 0] },
    { constant: Infinity, normal: [0, 1, 0] },
    { constant: 0, normal: [0, 1, Infinity] },
    { constant: 0, normal: [0, 1, 0], rendererPlane: true }
  ]) {
    assert.equal(CanvasWorkPlaneSchema.safeParse(invalidWorkPlane).success, false);
  }

  for (const invalidRequest of [
    { mode: "3d", viewportPoint: [12, 24] },
    { mode: "2d", viewportPoint: [12, 24], workPlane: { constant: 0, normal: [0, 1, 0] } },
    { mode: "2d", viewportPoint: [Infinity, 24] },
    {
      mode: "3d",
      viewportPoint: [12, 24, 36],
      workPlane: { constant: 0, normal: [0, 1, 0] }
    }
  ]) {
    assert.equal(
      CanvasScenePointRequestSchema.safeParse(invalidRequest).success,
      false
    );
  }

  for (const invalidResult of [
    { mode: "2d", position: [1, 2, 3] },
    { mode: "3d", position: [1, 2] },
    { mode: "3d", position: [1, NaN, 3] }
  ]) {
    assert.equal(
      CanvasScenePointResultSchema.safeParse(invalidResult).success,
      false
    );
  }
});

check("surface-point-protocol-is-strict-box-correlated-and-unit-normal", () => {
  const request = {
    mode: "3d",
    target: {
      kind: "node",
      nodeType: "box"
    },
    viewportPoint: [12, 24]
  };
  const validHits = [
    {
      feature: { axis: "x", kind: "box.face", side: 1 },
      kind: "hit",
      mode: "3d",
      nodeId: "box-x",
      nodeType: "box",
      normal: [1, 0, 0],
      point: [1, 2, 3]
    },
    {
      feature: { axis: "y", kind: "box.face", side: -1 },
      kind: "hit",
      mode: "3d",
      nodeId: "box-y",
      nodeType: "box",
      normal: [0, -1, 0],
      point: [4, 5, 6]
    },
    {
      feature: { axis: "z", kind: "box.face", side: 1 },
      kind: "hit",
      mode: "3d",
      nodeId: "box-z",
      nodeType: "box",
      normal: [0, 0, 1],
      point: [7, 8, 9]
    }
  ];
  const miss = { kind: "miss", mode: "3d" };

  assert.deepEqual(Canvas3DSurfacePointRequestSchema.parse(request), request);

  for (const hit of validHits) {
    assert.deepEqual(Canvas3DSurfacePointResultSchema.parse(hit), hit);
  }

  assert.deepEqual(Canvas3DSurfacePointResultSchema.parse(miss), miss);

  for (const invalidRequest of [
    { ...request, mode: "2d" },
    { ...request, target: { kind: "node", nodeType: "sphere" } },
    { ...request, target: { kind: "scene", nodeType: "box" } },
    { ...request, viewportPoint: [12, Infinity] },
    { ...request, viewportPoint: [12, 24, 36] },
    { ...request, renderer: "three" }
  ]) {
    assert.equal(
      Canvas3DSurfacePointRequestSchema.safeParse(invalidRequest).success,
      false
    );
  }

  const validHit = validHits[0];

  for (const invalidResult of [
    { ...miss, mode: "2d" },
    { ...miss, point: [0, 0, 0] },
    { ...validHit, mode: "2d" },
    { ...validHit, nodeType: "sphere" },
    {
      ...validHit,
      feature: { axis: "x", kind: "box.edge", side: 1 }
    },
    {
      ...validHit,
      feature: { axis: "w", kind: "box.face", side: 1 }
    },
    {
      ...validHit,
      feature: { axis: "x", kind: "box.face", side: 0 }
    },
    { ...validHit, point: [0, Number.NaN, 0] },
    { ...validHit, point: [0, 0, Infinity] },
    { ...validHit, normal: [0, 2, 0] },
    { ...validHit, normal: [0, 0, 0] },
    { ...validHit, rendererIntersection: {} }
  ]) {
    assert.equal(
      Canvas3DSurfacePointResultSchema.safeParse(invalidResult).success,
      false
    );
  }
});

check("surface-point-protocol-accepts-correlated-mesh-hits", () => {
  const meshRequest = {
    mode: "3d",
    target: {
      kind: "node",
      nodeType: "mesh"
    },
    viewportPoint: [320, 240]
  };
  assert.deepEqual(
    Canvas3DSurfacePointRequestSchema.parse(meshRequest),
    meshRequest
  );

  const meshHit = {
    feature: { kind: "mesh.triangle", triangleIndex: 17 },
    kind: "hit",
    mode: "3d",
    nodeId: "ifc-element-42",
    nodeType: "mesh",
    // A non-axis-aligned unit normal — meshes are not axis constrained.
    normal: [0.5773502691896258, 0.5773502691896258, 0.5773502691896258],
    point: [1.5, 2.5, 3.5]
  };
  assert.deepEqual(Canvas3DSurfacePointResultSchema.parse(meshHit), meshHit);

  for (const invalidMeshResult of [
    { ...meshHit, nodeType: "box" },
    {
      ...meshHit,
      feature: { axis: "y", kind: "box.face", side: 1 }
    },
    {
      ...meshHit,
      feature: { kind: "mesh.triangle", triangleIndex: -1 }
    },
    {
      ...meshHit,
      feature: { kind: "mesh.triangle", triangleIndex: 2.5 }
    },
    {
      ...meshHit,
      feature: { kind: "mesh.quad", triangleIndex: 0 }
    },
    {
      ...meshHit,
      feature: { kind: "mesh.triangle", triangleIndex: Number.NaN }
    },
    { ...meshHit, normal: [0.1, 0.1, 0.1] }
  ]) {
    assert.equal(
      Canvas3DSurfacePointResultSchema.safeParse(invalidMeshResult).success,
      false
    );
  }
});

check("grid-protocol-is-strict-mode-correlated-and-grid-only", () => {
  const grid2d = {
    mode: "2d",
    origin: [0, 0],
    spacing: [10, 20]
  };
  const grid3d = {
    axisU: [1, 0, 0],
    axisV: [0, 0, 1],
    mode: "3d",
    origin: [0, 0, 0],
    spacing: [1, 2]
  };

  assert.deepEqual(CanvasGridSchema.parse(grid2d), grid2d);
  assert.deepEqual(CanvasGridSchema.parse(grid3d), grid3d);
  assert.deepEqual(
    CanvasGridSnapRequestSchema.parse({
      grid: grid3d,
      kind: "grid",
      mode: "3d",
      position: [3, 4, 5]
    }).position,
    [3, 4, 5]
  );
  assert.deepEqual(
    CanvasGridSnapResultSchema.parse({
      kind: "grid",
      mode: "2d",
      position: [10, 20]
    }).position,
    [10, 20]
  );

  for (const invalidGrid of [
    { ...grid2d, spacing: [0, 1] },
    { ...grid2d, spacing: [1, -1] },
    { ...grid2d, origin: [0, Infinity] },
    { ...grid3d, axisV: [2, 0, 0] },
    { ...grid3d, axisU: [0, 0, 0] },
    { ...grid3d, spacing: [1, Infinity] },
    { ...grid3d, renderer: "three" }
  ]) {
    assert.equal(CanvasGridSchema.safeParse(invalidGrid).success, false);
  }

  for (const invalidSnap of [
    { grid: grid2d, kind: "guide", mode: "2d", position: [0, 0] },
    { grid: grid2d, kind: "node", mode: "2d", position: [0, 0] },
    { grid: grid3d, kind: "grid", mode: "2d", position: [0, 0] },
    { grid: grid2d, kind: "grid", mode: "3d", position: [0, 0, 0] },
    { kind: "guide", mode: "2d", position: [0, 0] }
  ]) {
    const schema = "grid" in invalidSnap
      ? CanvasGridSnapRequestSchema
      : CanvasGridSnapResultSchema;
    assert.equal(schema.safeParse(invalidSnap).success, false);
  }
});

check("authoring-preview-protocol-is-strict-and-mode-correlated", () => {
  const grid3d = {
    axisU: [1, 0, 0],
    axisV: [0, 0, 1],
    mode: "3d",
    origin: [0, 0, 0],
    spacing: [1, 1]
  };
  const validPreviews = [
    {
      kind: "node",
      mode: "2d",
      node: { id: "draft-rect", layerId: "layer-main", type: "rect" }
    },
    {
      end: [10, 20],
      kind: "measurement",
      measurement: "distance",
      mode: "2d",
      start: [0, 0]
    },
    {
      anchor: [1, 2, 3],
      kind: "annotation.anchor",
      mode: "3d"
    },
    {
      anchor: [10, 20],
      kind: "annotation.draft",
      mode: "2d",
      targetId: null,
      text: "Draft"
    },
    {
      grid: grid3d,
      kind: "grid",
      mode: "3d"
    },
    {
      kind: "grid.snap",
      mode: "2d",
      position: [10, 20]
    },
    {
      kind: "primitive.ghost",
      mode: "3d",
      primitive: {
        color: "#3b82f6",
        position: [1, 1.5, 2],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        type: "box"
      }
    }
  ];

  for (const preview of validPreviews) {
    assert.equal(CanvasAuthoringPreviewSchema.safeParse(preview).success, true);
  }

  for (const invalidPreview of [
    {
      kind: "node",
      mode: "2d",
      node: { id: "draft-box", layerId: "layer-main", type: "box" }
    },
    {
      end: [1, 2, 3],
      kind: "measurement",
      measurement: "distance",
      mode: "2d",
      start: [0, 0]
    },
    {
      end: [1, 2],
      kind: "measurement",
      measurement: "angle",
      mode: "2d",
      start: [0, 0]
    },
    {
      anchor: [0, 0],
      kind: "annotation.draft",
      mode: "2d",
      targetId: null,
      text: ""
    },
    {
      grid: grid3d,
      kind: "grid",
      mode: "2d"
    },
    { kind: "grid.snap", mode: "3d", position: [1, 2] },
    { kind: "guide", mode: "2d", position: [1, 2] },
    {
      kind: "grid.snap",
      mode: "2d",
      position: [1, 2],
      rendererHandle: "canvas-object"
    },
    {
      kind: "primitive.ghost",
      mode: "2d",
      primitive: {
        color: "#3b82f6",
        position: [1, 2, 3],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        type: "box"
      }
    },
    {
      kind: "primitive.ghost",
      mode: "3d",
      primitive: {
        color: "#f97316",
        position: [1, 2, 3],
        radius: 0.75,
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        type: "sphere"
      }
    },
    {
      kind: "primitive.ghost",
      mode: "3d",
      primitive: {
        color: "#3b82f6",
        id: "persisted-ghost",
        position: [1, 2, 3],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        type: "box"
      }
    },
    {
      kind: "primitive.ghost",
      mode: "3d",
      primitive: {
        color: "#3b82f6",
        position: [1, 2],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        type: "box"
      }
    }
  ]) {
    assert.equal(
      CanvasAuthoringPreviewSchema.safeParse(invalidPreview).success,
      false
    );
  }
});

check("node-update-identity-schema-is-correlated-strict-and-roundtrips", () => {
  assert.equal(Canvas2DNodeTypeSchema.safeParse("rect").success, true);
  assert.equal(Canvas2DNodeTypeSchema.safeParse("box").success, false);
  assert.equal(Canvas3DNodeTypeSchema.safeParse("box").success, true);
  assert.equal(Canvas3DNodeTypeSchema.safeParse("rect").success, false);

  for (const identity of [
    { nodeMode: "2d", nodeType: "rect" },
    { nodeMode: "2d", nodeType: "group" },
    { nodeMode: "2d", nodeType: "measurement" },
    { nodeMode: "2d", nodeType: "annotation" },
    { nodeMode: "3d", nodeType: "box" },
    { nodeMode: "3d", nodeType: "mesh" },
    { nodeMode: "3d", nodeType: "group" },
    { nodeMode: "3d", nodeType: "measurement" },
    { nodeMode: "3d", nodeType: "annotation" }
  ]) {
    assert.equal(CanvasNodeIdentitySchema.safeParse(identity).success, true);
  }

  for (const identity of [
    { nodeType: "rect" },
    { nodeMode: "2d" },
    { nodeMode: "2d", nodeType: "box" },
    { nodeMode: "3d", nodeType: "rect" },
    { nodeMode: "2d", nodeType: "rect", rendererType: "shape" }
  ]) {
    assert.equal(CanvasNodeIdentitySchema.safeParse(identity).success, false);
  }

  const command = defineCommand({
    nodeId: "box-1",
    nodeMode: "3d",
    nodeType: "box",
    patch: { position: [1, 2, 3] },
    type: "node.update"
  });
  const roundtrip = defineCommand(JSON.parse(JSON.stringify(command)));

  assert.deepEqual(roundtrip, command);
  assert.equal(roundtrip.nodeMode, "3d");
  assert.equal(roundtrip.nodeType, "box");

  const meshUpdate = defineCommand({
    nodeId: "mesh-1",
    nodeMode: "3d",
    nodeType: "mesh",
    patch: { position: [1, 2, 3] },
    type: "node.update"
  });
  assert.equal(meshUpdate.nodeType, "mesh");
  assert.deepEqual(meshUpdate.patch, { position: [1, 2, 3] });
});

check("layer-command-schema-is-explicit-strict-and-invertible", () => {
  const add = defineCommand({
    index: 1,
    layer: { id: "layer-new", name: "New" },
    type: "layer.add"
  });
  const update = defineCommand({
    layerId: "layer-new",
    patch: { visible: false },
    type: "layer.update"
  });
  const removeEmpty = defineCommand({
    layerId: "layer-new",
    targetLayerId: null,
    type: "layer.remove"
  });
  const removeWithNodes = defineCommand({
    layerId: "layer-new",
    targetLayerId: "layer-main",
    type: "layer.remove"
  });
  const reorder = defineCommand({
    index: 0,
    layerId: "layer-new",
    type: "layer.reorder"
  });

  assert.deepEqual(add.layer, {
    id: "layer-new",
    locked: false,
    metadata: {},
    name: "New",
    visible: true
  });
  assert.deepEqual(update.patch, { visible: false });
  assert.equal(removeEmpty.targetLayerId, null);
  assert.equal(removeWithNodes.targetLayerId, "layer-main");
  assert.equal(reorder.index, 0);
  assert.equal(CanvasLayerPatchSchema.safeParse({ name: "Renamed" }).success, true);

  for (const invalidCommand of [
    { layerId: "layer-main", patch: {}, type: "layer.update" },
    {
      layerId: "layer-main",
      patch: { id: "renamed-layer" },
      type: "layer.update"
    },
    {
      layerId: "layer-main",
      patch: { visible: undefined },
      type: "layer.update"
    },
    { layer: { id: "layer-new", name: "New" }, type: "layer.add" },
    {
      index: -1,
      layer: { id: "layer-new", name: "New" },
      type: "layer.add"
    },
    { layerId: "layer-main", type: "layer.remove" },
    {
      layerId: "layer-main",
      targetLayerId: "layer-main",
      type: "layer.remove"
    },
    { index: -1, layerId: "layer-main", type: "layer.reorder" },
    {
      index: 0,
      layerId: "layer-main",
      rendererOrder: 3,
      type: "layer.reorder"
    }
  ]) {
    assert.equal(safeDefineCommand(invalidCommand).success, false);
  }
});

check("command-schema-validates-recursive-transactions", () => {
  const command = defineCommand({
    label: "Move and select",
    type: "transaction",
    commands: [
      {
        nodeId: "box-1",
        nodeMode: "3d",
        nodeType: "box",
        patch: {
          position: [1, 2, 3]
        },
        type: "node.update"
      },
      {
        selection: {
          ids: ["box-1"],
          primaryId: "box-1"
        },
        type: "selection.set"
      }
    ]
  });

  assert.equal(command.type, "transaction");
  assert.equal(command.commands.length, 2);
  assert.equal(command.commands[1].type, "selection.set");
  assert.equal(command.commands[1].selection.hoveredId, null);
});

check("command-schema-rejects-invalid-runtime-input", () => {
  for (const input of [
    {
      nodeId: 42,
      nodeMode: "3d",
      nodeType: "box",
      patch: { position: [1, 2, 3] },
      type: "node.update"
    },
    {
      nodeId: "box-1",
      nodeMode: "3d",
      nodeType: "box",
      patch: {},
      type: "node.update"
    },
    {
      nodeId: "box-1",
      nodeMode: "3d",
      nodeType: "box",
      patch: { type: "sphere" },
      type: "node.update"
    },
    {
      nodeId: "box-1",
      nodeMode: "3d",
      nodeType: "box",
      patch: { color: "#fff" },
      type: "node.update",
      unexpected: true
    },
    {
      nodeId: "box-1",
      nodeType: "box",
      patch: { color: "#fff" },
      type: "node.update"
    },
    {
      nodeId: "box-1",
      nodeMode: "3d",
      patch: { color: "#fff" },
      type: "node.update"
    },
    {
      nodeId: "box-1",
      nodeMode: "2d",
      nodeType: "box",
      patch: { color: "#fff" },
      type: "node.update"
    },
    {
      nodeId: "rect-1",
      nodeMode: "3d",
      nodeType: "rect",
      patch: { fill: "#fff" },
      type: "node.update"
    },
    {
      nodeId: "rect-1",
      nodeMode: "2d",
      nodeType: "rect",
      patch: { radius: 2 },
      type: "node.update"
    },
    {
      nodeId: "box-1",
      nodeMode: "3d",
      nodeType: "box",
      patch: { radius: 2 },
      type: "node.update"
    },
    {
      node: {
        id: "box-with-command-parent",
        layerId: "layer-main",
        type: "box"
      },
      parentId: "group-1",
      type: "node.add"
    },
    {
      type: "transaction",
      commands: []
    },
    {
      type: "plugin.missing-payload"
    },
    {
      type: "plugin.date-payload",
      payload: new Date()
    }
  ]) {
    assert.equal(safeDefineCommand(input).success, false);
  }
});

check("core-types-remain-renderer-independent", () => {
  const declaration = readFileSync(
    join(rootDir, "packages/core/dist/index.d.ts"),
    "utf8"
  );
  const forbiddenPatterns = [
    /from ["']react["']/,
    /from ["']three["']/,
    /@react-three\//,
    /\bHTMLElement\b/,
    /\bHTMLCanvasElement\b/,
    /\bCanvasRenderingContext2D\b/,
    /\bWebGLRenderer\b/,
    /\bObject3D\b/
  ];

  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(declaration, pattern);
  }

  assert.doesNotMatch(declaration, /\bany\b/);
  assert.doesNotMatch(
    declaration,
    /CanvasNodeDefinition|registerNode|registerRenderer/
  );

  for (const requiredPattern of [
    /export type CanvasNodePatchFor<TNode extends CanvasNode>/,
    /export type CanvasNodeIdentity = z.output<typeof CanvasNodeIdentitySchema>/,
    /export type CanvasLayerPatch = AtLeastOne<CanvasLayerMutableFields>/,
    /export type CanvasPluginCommandDescriptor</,
    /export type CanvasRendererAdapter</,
    /export type CanvasCreateId = </,
    /export type CanvasScenePointResolver = \{/,
    /export type Canvas3DSurfacePointRequest = z.output</,
    /export type Canvas3DSurfacePointResult = z.output</,
    /export type Canvas3DSurfacePointRuntime = \{/,
    /export type CanvasAuthoringPreviewRuntime<TMode extends CanvasMode = CanvasMode> = \{/,
    /primitive\.ghost/,
    /resolveScenePoint\?: CanvasScenePointRuntime\["resolveScenePoint"\]/,
    /resolveSurfacePoint\?: Canvas3DSurfacePointRuntime\["resolveSurfacePoint"\]/,
    /setAuthoringPreviews\?: CanvasAuthoringPreviewRuntime\["setAuthoringPreviews"\]/
  ]) {
    assert.match(declaration, requiredPattern);
  }

  const protocolTypeStart = declaration.indexOf(
    "export type CanvasCreateIdContext"
  );
  const protocolTypeEnd = declaration.indexOf("export type CanvasScene =");
  const protocolTypeBlock = declaration.slice(
    protocolTypeStart,
    protocolTypeEnd
  );

  assert.notEqual(protocolTypeStart, -1);
  assert.notEqual(protocolTypeEnd, -1);
  assert.doesNotMatch(protocolTypeBlock, /\bunknown\b|Record<string/);
});

check("command-storage-plugin-renderer-type-contracts-compile", () => {
  rmSync(tempDir, {
    force: true,
    recursive: true
  });
  mkdirSync(tempDir, {
    recursive: true
  });

  writeFileSync(
    join(tempDir, "document-contract-smoke.ts"),
    `
import {
  CANVAS_DOCUMENT_SCHEMA_VERSION,
  defineDocument,
  defineCommand,
  definePluginCommand,
  defineHitResult,
  defineHitTestInput,
  defineToolInput,
  defineScene,
  type CanvasAuthoringPreview,
  type CanvasAuthoringPreviewForMode,
  type CanvasAuthoringPreviewRuntime,
  type Canvas3DSurfacePointRequest,
  type Canvas3DSurfacePointResult,
  type Canvas3DSurfacePointRuntime,
  type CanvasCommand,
  type CanvasCoordinateForMode,
  type CanvasCreateId,
  type CanvasCreateIdContext,
  type CanvasDocument,
  type CanvasGridForMode,
  type CanvasGridSnapRequest,
  type CanvasGridSnapResultFor,
  type CanvasHitResult,
  type CanvasHitTestInput,
  type CanvasNodeTransformHandleId,
  type CanvasNodeTransformHandleTarget,
  type CanvasNodeTransformInput,
  type CanvasNodeTransformPreview,
  type CanvasToolInput,
  type Canvas2DNodeType,
  type Canvas3DNodeType,
  type CanvasNodeIdentity,
  type CanvasNodePatch,
  type CanvasNodePatchFor,
  type CanvasNodeByType,
  type CanvasNodeForMode,
  type CanvasLayerPatch,
  type CanvasPlugin,
  type CanvasRendererAdapter,
  type CanvasStorageAdapter,
  type CanvasScenePointRequest,
  type CanvasScenePointRequestFor,
  type CanvasScenePointResult,
  type CanvasScenePointResultFor,
  type CanvasScenePointRuntime,
  type CanvasToolContext,
  type JsonValue
} from "@denovo/canvas-core";

const scene = defineScene({
  id: "typed-scene",
  layers: [{ id: "layer-main", name: "Main" }],
  nodes: [
    {
      id: "box-1",
      layerId: "layer-main",
      type: "box"
    }
  ]
});

const document = defineDocument({
  id: "typed-document",
  scene
});
const currentSchemaVersion: "0.2.0" = document.schemaVersion;
const point2: CanvasCoordinateForMode<"2d"> = [12, 24];
const group3d: CanvasNodeByType<"3d", "group"> = {
  id: "group-3d",
  layerId: "layer-main",
  locked: false,
  metadata: {},
  parentId: null,
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  type: "group",
  visible: true
};
const measurement2d: CanvasNodeForMode<"2d"> = {
  end: [3, 4],
  id: "measurement-2d",
  layerId: "layer-main",
  locked: false,
  measurement: "distance",
  metadata: {},
  parentId: null,
  precision: 2,
  start: [0, 0],
  type: "measurement",
  unit: {
    metersPerUnit: 1,
    name: "meter",
    symbol: "m"
  },
  visible: true
};
type Rect2D = CanvasNodeByType<"2d", "rect">;
const rect2d: Rect2D = {
  fill: "#22c55e",
  id: "rect-typed",
  layerId: "layer-main",
  locked: false,
  metadata: {},
  parentId: null,
  position: [0, 0],
  rotation: 0,
  scale: [1, 1],
  size: [120, 80],
  type: "rect",
  visible: true
};
const rectPatch: CanvasNodePatchFor<Rect2D> = {
  fill: "#ffffff",
  parentId: null
};
const rectType: Canvas2DNodeType = "rect";
const boxType: Canvas3DNodeType = "box";
const rectIdentity: CanvasNodeIdentity = {
  nodeMode: "2d",
  nodeType: rectType
};
const group3dIdentity: CanvasNodeIdentity = {
  nodeMode: "3d",
  nodeType: "group"
};
// @ts-expect-error A 2D identity cannot use a 3D-only node type.
const invalidNodeIdentity: CanvasNodeIdentity = {
  nodeMode: "2d",
  nodeType: boxType
};
const layerPatch: CanvasLayerPatch = {
  locked: true
};
const createId: CanvasCreateId = (context) =>
  context.document.id + ":" + context.mode + ":" + context.type;
const createRectIdContext: CanvasCreateIdContext<"2d", "rect"> = {
  document,
  mode: "2d",
  type: "rect"
};
const createdRectId = createId(createRectIdContext);

const grid2d: CanvasGridForMode<"2d"> = {
  mode: "2d",
  origin: [0, 0],
  spacing: [10, 10]
};
const gridSnapRequest: CanvasGridSnapRequest = {
  grid: grid2d,
  kind: "grid",
  mode: "2d",
  position: [14, 16]
};
const gridSnapResult2d: CanvasGridSnapResultFor<"2d"> = {
  kind: "grid",
  mode: "2d",
  position: [10, 20]
};

function resolveScenePoint(
  request: CanvasScenePointRequestFor<"2d">
): CanvasScenePointResultFor<"2d">;
function resolveScenePoint(
  request: CanvasScenePointRequestFor<"3d">
): CanvasScenePointResultFor<"3d">;
function resolveScenePoint(
  request: CanvasScenePointRequest
): CanvasScenePointResult {
  return request.mode === "2d"
    ? { mode: "2d", position: request.viewportPoint }
    : { mode: "3d", position: [0, 0, -request.workPlane.constant] };
}

const scenePointRuntime: CanvasScenePointRuntime = { resolveScenePoint };
const surfacePointRequest: Canvas3DSurfacePointRequest = {
  mode: "3d",
  target: {
    kind: "node",
    nodeType: "box"
  },
  viewportPoint: [12, 24]
};
const surfacePointRuntime: Canvas3DSurfacePointRuntime = {
  resolveSurfacePoint(request) {
    const mode: "3d" = request.mode;
    const nodeType: "box" | "mesh" = request.target.nodeType;

    void mode;
    void nodeType;

    if (request.target.nodeType === "mesh") {
      return {
        feature: { kind: "mesh.triangle", triangleIndex: 4 },
        kind: "hit",
        mode: "3d",
        nodeId: "mesh-1",
        nodeType: "mesh",
        normal: [
          0.5773502691896258,
          0.5773502691896258,
          0.5773502691896258
        ],
        point: [request.viewportPoint[0], 0.5, request.viewportPoint[1]]
      };
    }

    return {
      feature: { axis: "y", kind: "box.face", side: 1 },
      kind: "hit",
      mode: "3d",
      nodeId: "box-1",
      nodeType: "box",
      normal: [0, 1, 0],
      point: [request.viewportPoint[0], 0.5, request.viewportPoint[1]]
    };
  }
};
const previews: CanvasAuthoringPreview[] = [
  {
    kind: "node",
    mode: "2d",
    node: rect2d
  },
  {
    kind: "grid",
    mode: "2d",
    grid: grid2d
  },
  {
    kind: "primitive.ghost",
    mode: "3d",
    primitive: {
      color: "#3b82f6",
      position: [1, 1.5, 2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      type: "box"
    }
  }
];
const preview3d: CanvasAuthoringPreviewForMode<"3d"> = {
  kind: "grid.snap",
  mode: "3d",
  position: [1, 2, 3]
};
const authoringPreviewRuntime: CanvasAuthoringPreviewRuntime = {
  setAuthoringPreviews(nextPreviews) {
    void nextPreviews;
  }
};
const authoringToolCapabilities: Pick<
  CanvasToolContext,
  "resolveScenePoint" | "resolveSurfacePoint" | "setAuthoringPreviews"
> = {
  resolveScenePoint,
  resolveSurfacePoint: surfacePointRuntime.resolveSurfacePoint,
  setAuthoringPreviews: authoringPreviewRuntime.setAuthoringPreviews
};

async function verifyScenePointInference() {
  const result2d = await scenePointRuntime.resolveScenePoint({
    mode: "2d",
    viewportPoint: [12, 24]
  });
  const mode2d: "2d" = result2d.mode;
  const position2d: [number, number] = result2d.position;

  void mode2d;
  void position2d;
}

async function verifySurfacePointNarrowing() {
  const result = await surfacePointRuntime.resolveSurfacePoint(
    surfacePointRequest
  );

  if (result.kind === "miss") {
    const missKind: "miss" = result.kind;
    const missMode: "3d" = result.mode;

    void missKind;
    void missMode;
    return;
  }

  const hitKind: "hit" = result.kind;
  const hitMode: "3d" = result.mode;

  void hitKind;
  void hitMode;

  if (result.nodeType === "mesh") {
    // Mesh hits correlate a triangle index instead of a box face.
    const triangleIndex: number = result.feature.triangleIndex;
    void triangleIndex;
    return;
  }

  const nodeType: "box" = result.nodeType;
  const axis: "x" | "y" | "z" = result.feature.axis;
  const side: -1 | 1 = result.feature.side;
  const point: [number, number, number] = result.point;
  const normal: [number, number, number] = result.normal;

  void nodeType;
  void axis;
  void side;
  void point;
  void normal;
}

// @ts-expect-error A concrete node patch must change at least one field.
const invalidEmptyRectPatch: CanvasNodePatchFor<Rect2D> = {};
const invalidRectPatchField: CanvasNodePatchFor<Rect2D> = {
  // @ts-expect-error Rect patches cannot contain circle-only fields.
  radius: 10
};
const invalidRectPatchId: CanvasNodePatchFor<Rect2D> = {
  // @ts-expect-error Node identity is immutable.
  id: "renamed-rect"
};
const invalidRectPatchType: CanvasNodePatchFor<Rect2D> = {
  // @ts-expect-error Node type is immutable.
  type: "circle"
};
const invalidRectPatchPosition: CanvasNodePatchFor<Rect2D> = {
  // @ts-expect-error A 2D node patch cannot use a Vector3 position.
  position: [1, 2, 3]
};
// @ts-expect-error Layer patches must contain at least one mutable field.
const invalidLayerPatch: CanvasLayerPatch = {};
const invalidLayerPatchId: CanvasLayerPatch = {
  // @ts-expect-error Layer identity is immutable.
  id: "renamed-layer"
};
// @ts-expect-error A 2D create-id context cannot request a 3D-only node kind.
type InvalidCreateIdContext = CanvasCreateIdContext<"2d", "box">;
const invalidGridSnapKind: CanvasGridSnapRequest = {
  grid: grid2d,
  // @ts-expect-error Grid is the only supported snap kind in M3.
  kind: "guide",
  mode: "2d",
  position: [0, 0]
};
const invalidPreview: CanvasAuthoringPreview = {
  // @ts-expect-error A 2D measurement preview uses Point2 endpoints.
  end: [1, 2, 3],
  kind: "measurement",
  measurement: "distance",
  mode: "2d",
  start: [0, 0]
};
const invalidScenePointRuntime: CanvasScenePointRuntime = {
  // @ts-expect-error A resolver must return the result mode correlated to its request.
  resolveScenePoint(_request: CanvasScenePointRequest) {
    return { mode: "3d", position: [0, 0, 0] };
  }
};
// @ts-expect-error A 3D scene-point request requires an explicit work plane.
const invalid3DScenePointRequest: CanvasScenePointRequest = {
  mode: "3d",
  viewportPoint: [0, 0]
};
const invalidSurfacePointRequestMode: Canvas3DSurfacePointRequest = {
  // @ts-expect-error Surface-point requests are 3D-only.
  mode: "2d",
  target: { kind: "node", nodeType: "box" },
  viewportPoint: [0, 0]
};
const invalidSurfacePointRequestTarget: Canvas3DSurfacePointRequest = {
  mode: "3d",
  target: {
    kind: "node",
    // @ts-expect-error The first surface-placement slice targets boxes only.
    nodeType: "sphere"
  },
  viewportPoint: [0, 0]
};
const invalidSurfacePointHitType: Canvas3DSurfacePointResult = {
  feature: { axis: "x", kind: "box.face", side: 1 },
  kind: "hit",
  mode: "3d",
  nodeId: "sphere-1",
  // @ts-expect-error Surface hits are correlated to box targets.
  nodeType: "sphere",
  normal: [1, 0, 0],
  point: [0, 0, 0]
};
const invalidSurfacePointFeature: Canvas3DSurfacePointResult = {
  feature: {
    // @ts-expect-error Box-face axes are a closed x/y/z union.
    axis: "w",
    kind: "box.face",
    side: 1
  },
  kind: "hit",
  mode: "3d",
  nodeId: "box-1",
  nodeType: "box",
  normal: [1, 0, 0],
  point: [0, 0, 0]
};
const invalidSurfacePointMiss: Canvas3DSurfacePointResult = {
  kind: "miss",
  mode: "3d",
  // @ts-expect-error Miss results cannot carry a stale surface point.
  point: [0, 0, 0]
};
const invalidSurfacePointRuntime: Canvas3DSurfacePointRuntime = {
  // @ts-expect-error A surface resolver must return the 3D hit-or-miss union.
  resolveSurfacePoint() {
    return { kind: "miss", mode: "2d" };
  }
};
const invalidPrimitiveGhostType: CanvasAuthoringPreviewForMode<"3d"> = {
  kind: "primitive.ghost",
  mode: "3d",
  primitive: {
    color: "#f97316",
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    // @ts-expect-error The first primitive ghost is a box-only preview.
    type: "sphere"
  }
};
const invalidPrimitiveGhostMode: CanvasAuthoringPreviewForMode<"2d"> = {
  // @ts-expect-error Primitive ghosts are not part of the 2D preview union.
  kind: "primitive.ghost",
  mode: "2d",
  primitive: {
    color: "#3b82f6",
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    type: "box"
  }
};
// @ts-expect-error A 2D coordinate has exactly two components.
const invalidPoint2: CanvasCoordinateForMode<"2d"> = [0, 0, 0];
// @ts-expect-error A 2D mode cannot select the 3D-only box node type.
type Invalid2DBox = CanvasNodeByType<"2d", "box">;
const invalidGroup3d: CanvasNodeByType<"3d", "group"> = {
  id: "invalid-group-3d",
  layerId: "layer-main",
  locked: false,
  metadata: {},
  parentId: null,
  position: [0, 0, 0],
  // @ts-expect-error A 3D group rotation is a Vector3.
  rotation: 0,
  scale: [1, 1, 1],
  type: "group",
  visible: true
};
const invalidMeasurement2d: CanvasNodeByType<"2d", "measurement"> = {
  // @ts-expect-error A 2D measurement endpoint is a Point2.
  end: [1, 2, 3],
  id: "invalid-measurement-2d",
  layerId: "layer-main",
  locked: false,
  measurement: "distance",
  metadata: {},
  parentId: null,
  precision: 2,
  start: [0, 0],
  type: "measurement",
  unit: {
    metersPerUnit: 1,
    name: "meter",
    symbol: "m"
  },
  visible: true
};
// @ts-expect-error Public document outputs use only the canonical schema version.
const legacySchemaVersion: CanvasDocument["schemaVersion"] = "0.1.0";
const canonicalVersionConstant: CanvasDocument["schemaVersion"] =
  CANVAS_DOCUMENT_SCHEMA_VERSION;

const command: CanvasCommand = {
  nodeId: "box-1",
  nodeMode: "3d",
  nodeType: "box",
  patch: {
    position: [1, 2, 3]
  },
  type: "node.update"
};
// @ts-expect-error node.update requires its source mode and type identity.
const missingNodeUpdateIdentity: CanvasCommand = {
  nodeId: "box-1",
  patch: { color: "#fff" },
  type: "node.update"
};
const wrongNodeUpdateIdentity: CanvasCommand = {
  nodeId: "box-1",
  nodeMode: "2d",
  // @ts-expect-error A 2D identity cannot use a 3D-only node type.
  nodeType: "box",
  // @ts-expect-error A 2D node update cannot use a 3D-only color patch.
  patch: { color: "#fff" },
  type: "node.update"
};
const wrongRectUpdatePatch: CanvasCommand = {
  nodeId: "rect-1",
  nodeMode: "2d",
  nodeType: "rect",
  // @ts-expect-error Rect updates cannot carry circle-only radius fields.
  patch: { radius: 4 },
  type: "node.update"
};
const emptyNodeUpdatePatch: CanvasCommand = {
  nodeId: "rect-1",
  nodeMode: "2d",
  nodeType: "rect",
  // @ts-expect-error Node update patches must change at least one mutable field.
  patch: {},
  type: "node.update"
};
const layerCommands: CanvasCommand[] = [
  {
    index: 1,
    layer: { id: "layer-secondary", name: "Secondary" },
    type: "layer.add"
  },
  {
    layerId: "layer-secondary",
    patch: { name: "Renamed" },
    type: "layer.update"
  },
  {
    layerId: "layer-secondary",
    targetLayerId: "layer-main",
    type: "layer.remove"
  },
  {
    index: 0,
    layerId: "layer-main",
    type: "layer.reorder"
  }
];
const invalidEmptyLayerUpdate: CanvasCommand = {
  layerId: "layer-main",
  // @ts-expect-error Layer update patches must not be empty.
  patch: {},
  type: "layer.update"
};
// @ts-expect-error Layer removal requires an explicit target or explicit null.
const invalidLayerRemoval: CanvasCommand = {
  layerId: "layer-main",
  type: "layer.remove"
};
const validatedCommand = defineCommand(command);
const hitInput: CanvasHitTestInput = defineHitTestInput({ point: [12, 24] });
const hit: CanvasHitResult = defineHitResult({
  instanceIndex: 3,
  kind: "node",
  nodeId: "box-1",
  renderer: "three"
});
const toolInput: CanvasToolInput = defineToolInput({
  altKey: false,
  code: "Escape",
  ctrlKey: false,
  key: "Escape",
  metaKey: false,
  repeat: false,
  shiftKey: false,
  type: "key.down"
});
const transformHandle: CanvasNodeTransformHandleId = "scale.uniform";
const transformTarget: CanvasNodeTransformHandleTarget = {
  kind: "scale",
  nodeId: "box-1"
};
const transformInput: CanvasNodeTransformInput = {
  axis: "z",
  kind: "rotate",
  nodeId: "box-1",
  origin: [12, 24],
  point: [20, 32]
};
const transformPreview: CanvasNodeTransformPreview = {
  kind: "rotate",
  mode: "3d",
  nodeId: "box-1",
  rotation: [0, 0, 0.5]
};
const invalidRotationInput: CanvasNodeTransformInput = {
  // @ts-expect-error Rotation inputs accept an axis, not a plane constraint.
  constraint: "xy",
  kind: "rotate",
  nodeId: "box-1",
  origin: [12, 24],
  point: [20, 32]
};
const invalidRotationPreview: CanvasNodeTransformPreview = {
  kind: "rotate",
  mode: "2d",
  nodeId: "box-1",
  // @ts-expect-error A 2D rotation preview carries one scalar angle.
  rotation: [0, 0, 0.5]
};
// @ts-expect-error Transform handle targets must name their operation.
const invalidTransformTarget: CanvasNodeTransformHandleTarget = {
  nodeId: "box-1"
};
// @ts-expect-error Built-in transform handle IDs are a closed union.
const invalidTransformHandle: CanvasNodeTransformHandleId = "rotate.free";
// @ts-expect-error A node hit must carry the stable document node id.
const invalidNodeHit: CanvasHitResult = { kind: "node" };
// @ts-expect-error Empty hits cannot masquerade as persistent node hits.
const invalidEmptyHit: CanvasHitResult = { kind: "empty", nodeId: "box-1" };
const invalidIdentityPatch: CanvasNodePatch = {
  // @ts-expect-error Node identity cannot be changed through a patch.
  id: "renamed-node"
};
// @ts-expect-error Patch values must remain JSON-serializable.
const invalidUndefinedPatch: CanvasNodePatch = {
  color: undefined
};
const invalidCommandParent: CanvasCommand = {
  node: {
    id: "box-with-command-parent",
    layerId: "layer-main",
    type: "box"
  },
  // @ts-expect-error node.parentId is the only persisted parent source.
  parentId: "group-1",
  type: "node.add"
};
const invalidMissingLayer: CanvasCommand = {
  // @ts-expect-error Every canonical node input requires an explicit layerId.
  node: {
    id: "box-without-layer",
    type: "box"
  },
  type: "node.add"
};

const renderer: CanvasRendererAdapter<unknown, { dispose: () => void }> = {
  createRuntime(_target, _scene) {
    return {
      dispose() {}
    };
  },
  modes: ["2d", "3d"],
  name: "custom-renderer"
};
const renderer3d: CanvasRendererAdapter<
  unknown,
  { dispose: () => void },
  undefined,
  "3d"
> = {
  createRuntime(_target, rendererScene) {
    const rendererMode: "3d" = rendererScene.mode;
    void rendererMode;
    return { dispose() {} };
  },
  modes: ["3d"],
  name: "custom-renderer-3d"
};
const invalidRenderer3d: CanvasRendererAdapter<
  unknown,
  { dispose: () => void },
  undefined,
  "3d"
> = {
  createRuntime() {
    return { dispose() {} };
  },
  // @ts-expect-error A 3D-only adapter cannot advertise a 2D mode.
  modes: ["2d"],
  name: "invalid-renderer-3d"
};

const storage: CanvasStorageAdapter = {
  async applyCommands(documentId, commands) {
    return {
      ok: true as const,
      document,
      revision: commands.length
    };
  },
  async loadDocument(_id) {
    return document;
  },
  name: "memory",
  async saveDocument(nextDocument: CanvasDocument) {
    return {
      ok: true as const,
      document: nextDocument,
      revision: (nextDocument.revision ?? 0) + 1
    };
  }
};

const setTitleCommand = definePluginCommand({
  type: "plugin.set-title",
  parsePayload(payload) {
    if (typeof payload !== "string") {
      throw new TypeError("set-title payload must be a string");
    }

    return payload;
  }
});

const plugin: CanvasPlugin = {
  name: "demo-plugin",
  tools: [
    {
      id: "plugin.demo.tool.inspect",
      label: "Demo Tool",
      async onInput(input, context) {
        void input;
        void context.getDocument();
      }
    }
  ],
  setup(context) {
    context.registerCommand(
      setTitleCommand,
      (pluginCommand, commandContext) => {
        const commandType: "plugin.set-title" = pluginCommand.type;
        const title: string = pluginCommand.payload;
        // @ts-expect-error Descriptor parsing correlates this payload to string.
        const invalidTitle: number = pluginCommand.payload;
        void commandType;
        void title;
        void invalidTitle;
        return {
          document: commandContext.document,
          inverse: pluginCommand
        };
      }
    );
  }
};

const json: JsonValue = {
  enabled: true,
  values: ["a", 1, null]
};

void command;
void renderer3d;
void invalidRenderer3d;
void wrongRectUpdatePatch;
void emptyNodeUpdatePatch;
void currentSchemaVersion;
void point2;
void group3d;
void measurement2d;
void rect2d;
void rectPatch;
void layerPatch;
void createId;
void createRectIdContext;
void createdRectId;
void grid2d;
void gridSnapRequest;
void gridSnapResult2d;
void scenePointRuntime;
void surfacePointRequest;
void surfacePointRuntime;
void previews;
void preview3d;
void authoringPreviewRuntime;
void authoringToolCapabilities;
void verifyScenePointInference;
void verifySurfacePointNarrowing;
void invalidEmptyRectPatch;
void invalidRectPatchField;
void invalidRectPatchId;
void invalidRectPatchType;
void invalidRectPatchPosition;
void invalidLayerPatch;
void invalidLayerPatchId;
void invalidGridSnapKind;
void invalidPreview;
void invalidScenePointRuntime;
void invalid3DScenePointRequest;
void invalidSurfacePointRequestMode;
void invalidSurfacePointRequestTarget;
void invalidSurfacePointHitType;
void invalidSurfacePointFeature;
void invalidSurfacePointMiss;
void invalidSurfacePointRuntime;
void invalidPrimitiveGhostType;
void invalidPrimitiveGhostMode;
void invalidPoint2;
void invalidGroup3d;
void invalidMeasurement2d;
void legacySchemaVersion;
void canonicalVersionConstant;
void layerCommands;
void invalidEmptyLayerUpdate;
void invalidLayerRemoval;
void validatedCommand;
void hitInput;
void hit;
void toolInput;
void transformHandle;
void transformTarget;
void transformInput;
void transformPreview;
void invalidRotationInput;
void invalidRotationPreview;
void invalidTransformTarget;
void invalidTransformHandle;
void invalidNodeHit;
void invalidEmptyHit;
void invalidIdentityPatch;
void invalidUndefinedPatch;
void invalidCommandParent;
void invalidMissingLayer;
void storage;
void plugin;
void json;
`
  );

  writeFileSync(
    join(tempDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          exactOptionalPropertyTypes: true,
          module: "NodeNext",
          moduleResolution: "NodeNext",
          noEmit: true,
          paths: {
            "@denovo/canvas-core": ["../../packages/core/dist/index.d.ts"]
          },
          strict: true,
          target: "ES2022",
          types: ["node"]
        },
        include: ["document-contract-smoke.ts"]
      },
      null,
      2
    )
  );

  const result = spawnSync(
    "pnpm",
    ["exec", "tsc", "-p", join(tempDir, "tsconfig.json"), "--pretty", "false"],
    {
      cwd: rootDir,
      encoding: "utf8"
    }
  );

  assert.equal(
    result.status,
    0,
    [result.stdout, result.stderr].filter(Boolean).join("\n")
  );

  rmSync(tempDir, {
    force: true,
    recursive: true
  });
});

report();
