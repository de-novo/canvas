import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

import { z } from "../packages/core/node_modules/zod/index.js";

import { createCheckRunner } from "./lib/checks.mjs";

/**
 * Assertions run sequentially against a shared camera and scene, so the report
 * records suite completion rather than pretending they are independent — but
 * `ok` now comes from execution instead of a literal.
 */
const { check, report } = createCheckRunner();

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(path.join(root, "packages/three/package.json"));
const {
  BoxGeometry,
  Euler,
  Matrix3,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Quaternion,
  Ray,
  Scene,
  Vector3
} = require("three");
const core = await import(
  pathToFileURL(path.join(root, "packages/core/dist/index.js")).href
);
const canvasThree = await import(
  pathToFileURL(path.join(root, "packages/three/dist/index.js")).href
);

const viewport = {
  height: 200,
  width: 200
};
const camera = new PerspectiveCamera(50, 1, 0.1, 100);
const scene = new Scene();
const near = createBox("near", [0, 0, 0]);
const far = createBox("far", [0, 0, -3]);
const side = createBox("side", [2, 0, 0]);
scene.add(far, side, near);

const tester = canvasThree.createThreeHitTester({
  camera,
  getObjects: () => scene.children,
  resolveNodeId: (object) => object.userData.nodeId
});

lookAt(camera, [0, 0, 5], [0, 0, 0]);
scene.updateMatrixWorld(true);
const nearestHit = tester.hitTest({ point: [100, 100] }, viewport);
assert.equal(nearestHit.kind, "node");
assert.equal(nearestHit.nodeId, "near");
assert.equal(nearestHit.renderer, "three");
assert.equal(nearestHit.point?.length, 3);

const miss = tester.hitTest({ point: [2, 2] }, viewport);
assert.equal(miss.kind, "empty");

lookAt(camera, [2, 0, 5], [2, 0, 0]);
scene.updateMatrixWorld(true);
const cameraAdjustedHit = tester.hitTest({ point: [100, 100] }, viewport);
assert.equal(cameraAdjustedHit.kind, "node");
assert.equal(cameraAdjustedHit.nodeId, "side");

assert.throws(
  () => tester.hitTest({ point: [Number.POSITIVE_INFINITY, 0] }, viewport),
  /finite numbers/
);
assert.throws(
  () => tester.hitTest({ point: [0, 0] }, { height: 0, width: 200 }),
  /finite positive size/
);

const instanceSceneDefinition = core.defineScene({
  id: "instance-hit-scene",
  layers: [{ id: "main", name: "Main" }],
  mode: "3d",
  nodes: [
    {
      geometry: "box",
      id: "instance-batch",
      layerId: "main",
      instances: [
        {
          position: [-1, 0, 0],
          rotation: [0, 0, 0],
          scale: [0.8, 0.8, 0.8]
        },
        {
          position: [1, 0, 0],
          rotation: [0, 0, 0],
          scale: [0.8, 0.8, 0.8]
        }
      ],
      type: "instances"
    }
  ]
});
const instanceNode = instanceSceneDefinition.nodes[0];
assert.equal(instanceNode.type, "instances");
const instanceMesh = canvasThree.createInstancedMeshBatch({
  node: instanceNode
});
instanceMesh.userData.nodeId = instanceNode.id;
const instanceScene = new Scene();
instanceScene.add(instanceMesh);
lookAt(camera, [0, 0, 5], [0, 0, 0]);
instanceScene.updateMatrixWorld(true);

const instanceTester = canvasThree.createThreeHitTester({
  camera,
  getObjects: () => instanceScene.children,
  resolveNodeId: (object) => object.userData.nodeId
});

for (const [instanceIndex, worldX] of [-1, 1].entries()) {
  const projected = new Vector3(worldX, 0, 0).project(camera);
  const point = [
    ((projected.x + 1) / 2) * viewport.width,
    ((1 - projected.y) / 2) * viewport.height
  ];
  const hit = instanceTester.hitTest({ point }, viewport);
  assert.equal(hit.kind, "node");
  assert.equal(hit.nodeId, "instance-batch");
  assert.equal(hit.instanceIndex, instanceIndex);
}

const parentMatrix = new Matrix4().compose(
  new Vector3(2, -1, 3),
  new Quaternion().setFromEuler(new Euler(0.2, -0.35, 0.15)),
  new Vector3(1.4, 0.8, -1.1)
);
const boxLocalMatrix = new Matrix4().compose(
  new Vector3(0.5, 0.2, -0.3),
  new Quaternion().setFromEuler(new Euler(-0.25, 0.4, 0.1)),
  new Vector3(1.5, 0.6, 2)
);
const transformedBoxMatrix = new Matrix4().multiplyMatrices(
  parentMatrix,
  boxLocalMatrix
);
const expectedLocalPoint = new Vector3(0.1, 0.5, -0.2);
const transformedRayOrigin = new Vector3(0.1, 4, -0.2).applyMatrix4(
  transformedBoxMatrix
);
const expectedWorldPoint = expectedLocalPoint
  .clone()
  .applyMatrix4(transformedBoxMatrix);
const transformedRay = new Ray(
  transformedRayOrigin,
  expectedWorldPoint.clone().sub(transformedRayOrigin).normalize()
);
const transformedSurface = canvasThree.intersectThreeUnitBoxSurface(
  transformedRay,
  transformedBoxMatrix
);
assert.ok(transformedSurface);
assert.deepEqual(transformedSurface.feature, {
  axis: "y",
  kind: "box.face",
  side: 1
});
assertVectorClose(transformedSurface.point, expectedWorldPoint.toArray());
const expectedWorldNormal = new Vector3(0, 1, 0)
  .applyMatrix3(new Matrix3().getNormalMatrix(transformedBoxMatrix))
  .normalize();
assertVectorClose(transformedSurface.normal, expectedWorldNormal.toArray());
assert.ok(
  Math.abs(Math.hypot(...transformedSurface.normal) - 1) <= 1e-12,
  "Transformed box surface normal must remain unit length."
);

const negativeXSurface = canvasThree.intersectThreeUnitBoxSurface(
  new Ray(new Vector3(-3, 0, 0), new Vector3(1, 0, 0)),
  new Matrix4()
);
assert.ok(negativeXSurface);
assert.deepEqual(negativeXSurface.feature, {
  axis: "x",
  kind: "box.face",
  side: -1
});
assert.deepEqual(negativeXSurface.point, [-0.5, 0, 0]);
assert.deepEqual(negativeXSurface.normal, [-1, 0, 0]);

assert.equal(
  canvasThree.intersectThreeUnitBoxSurface(
    new Ray(new Vector3(3, 3, 3), new Vector3(1, 0, 0)),
    new Matrix4()
  ),
  null
);
assert.throws(
  () =>
    canvasThree.intersectThreeUnitBoxSurface(
      new Ray(new Vector3(0, 0, 3), new Vector3(0, 0, -1)),
      new Matrix4().makeScale(1, 0, 1)
    ),
  /finite and invertible/
);
const nonFiniteMatrix = new Matrix4();
nonFiniteMatrix.elements[0] = Number.POSITIVE_INFINITY;
assert.throws(
  () =>
    canvasThree.intersectThreeUnitBoxSurface(
      new Ray(new Vector3(0, 0, 3), new Vector3(0, 0, -1)),
      nonFiniteMatrix
    ),
  /must be finite/
);

for (const object of [near, far, side, instanceMesh]) {
  object.geometry.dispose();

  if (Array.isArray(object.material)) {
    for (const material of object.material) {
      material.dispose();
    }
  } else {
    object.material.dispose();
  }
}

// Reaching here means every assertion above held; a failure throws and the
// non-zero exit code reports it.
const web = await import(
  pathToFileURL(path.join(root, "packages/web/dist/index.js")).href
);

{
  const scene = core.defineScene({
    id: "edge-path-scene",
    layers: [{ id: "main", name: "Main" }],
    mode: "2d",
    nodes: [
      { id: "a", layerId: "main", position: [0, 0], size: [40, 40], type: "rect" },
      { id: "b", layerId: "main", position: [120, 0], size: [40, 40], type: "rect" },
      {
        id: "orthogonal",
        layerId: "main",
        routing: "orthogonal",
        sourceId: "a",
        sourcePort: "right",
        targetId: "b",
        targetPort: "left",
        type: "edge"
      },
      {
        id: "quadratic",
        curve: "curved",
        curveOffset: 20,
        layerId: "main",
        routing: "straight",
        sourceId: "a",
        targetId: "b",
        type: "edge"
      },
      {
        id: "legacy-curved-routing",
        layerId: "main",
        routing: "curved",
        sourceId: "a",
        targetId: "b",
        type: "edge"
      }
    ]
  });
  const graph = web.createCanvas2DSceneGraph(scene);
  const orthogonal = web.resolveCanvas2DEdgeGeometry(
    scene.nodes.find((node) => node.id === "orthogonal"),
    graph
  );
  assert.ok(orthogonal.waypoints.length > 0, "orthogonal routing must emit waypoints");
  const quadratic = web.resolveCanvas2DEdgeGeometry(
    scene.nodes.find((node) => node.id === "quadratic"),
    graph
  );
  assert.ok(quadratic.control, "curve + curveOffset must produce a quadratic control");
  const ignored = web.resolveCanvas2DEdgeGeometry(
    scene.nodes.find((node) => node.id === "legacy-curved-routing"),
    graph
  );
  assert.equal(ignored.control, null);
  assert.deepEqual(ignored.waypoints, []);
}

{
  const scene = core.defineScene({
    id: "orthogonal-stub-gap-scene",
    layers: [{ id: "main", name: "Main" }],
    mode: "2d",
    nodes: [
      { id: "a", layerId: "main", position: [0, 0], size: [40, 40], type: "rect" },
      { id: "b", layerId: "main", position: [0, 76], size: [40, 40], type: "rect" },
      {
        id: "stacked",
        layerId: "main",
        routing: "orthogonal",
        sourceId: "b",
        sourcePort: "top",
        targetId: "a",
        targetPort: "bottom",
        type: "edge"
      }
    ]
  });
  const graph = web.createCanvas2DSceneGraph(scene);
  const stacked = web.resolveCanvas2DEdgeGeometry(
    scene.nodes.find((node) => node.id === "stacked"),
    graph
  );
  const points = [stacked.start, ...stacked.waypoints, stacked.end];
  for (const [, y] of points) {
    assert.ok(
      y >= 40 - 1e-6 && y <= 76 + 1e-6,
      `orthogonal stub must stay inside the 36-unit port gap, got y=${y}`
    );
  }
}

{
  const scene = core.defineScene({
    id: "orthogonal-facing-ports-scene",
    layers: [{ id: "main", name: "Main" }],
    mode: "2d",
    nodes: [
      { id: "a", layerId: "main", position: [0, 0], size: [40, 40], type: "rect" },
      { id: "b", layerId: "main", position: [120, 0], size: [40, 40], type: "rect" },
      {
        id: "stale-ports",
        layerId: "main",
        routing: "orthogonal",
        sourceId: "a",
        sourcePort: "top",
        targetId: "b",
        targetPort: "bottom",
        type: "edge"
      }
    ]
  });
  const graph = web.createCanvas2DSceneGraph(scene);
  const stale = web.resolveCanvas2DEdgeGeometry(
    scene.nodes.find((node) => node.id === "stale-ports"),
    graph
  );
  assert.ok(
    Math.abs(stale.start[0] - 40) < 1e-6 && Math.abs(stale.start[1] - 20) < 1e-6,
    "stale top port must retarget to the facing right side"
  );
  assert.ok(
    Math.abs(stale.end[0] - 120) < 1e-6 && Math.abs(stale.end[1] - 20) < 1e-6,
    "stale bottom port must retarget to the facing left side"
  );
}

{
  const kind = core.definePluginNodeKind({
    mode: "2d",
    props: z.object({ label: z.string() }).strict(),
    type: "plugin.test.card"
  });
  const unregister = core.registerPluginNodeKind(kind);
  try {
    const scene = core.defineScene({
      id: "plugin-2d-marker-scene",
      layers: [{ id: "main", name: "Main" }],
      mode: "2d",
      nodes: [
        {
          id: "card",
          layerId: "main",
          position: [10, 20],
          props: { label: "hero" },
          type: "plugin.test.card"
        }
      ]
    });
    const graph = web.createCanvas2DSceneGraph(scene);
    const card = scene.nodes.find((node) => node.id === "card");
    assert.deepEqual(web.resolveCanvas2DNodeWorldCenter(card, graph), [10, 20]);
    assert.deepEqual(web.resolveCanvas2DNodeWorldBounds(card, graph), {
      maxX: 58,
      maxY: 68,
      minX: 10,
      minY: 20
    });
  } finally {
    unregister();
  }
}

{
  const HOST_FILL = "#e11d48";
  const kind = core.definePluginNodeKind({
    mode: "both",
    props: z.object({ label: z.string() }).strict(),
    type: "plugin.test.host"
  });
  const unregisterKind = core.registerPluginNodeKind(kind);
  try {
  const node2d = {
    id: "host-card",
    layerId: "main",
    position: [10, 20],
    props: { label: "hero" },
    type: "plugin.test.host"
  };
  const scene2d = core.defineScene({
    id: "plugin-host-drawer-2d",
    layers: [{ id: "main", name: "Main" }],
    mode: "2d",
    nodes: [node2d]
  });
  const graph2d = web.createCanvas2DSceneGraph(scene2d);
  const node3d = {
    id: "host-badge",
    layerId: "main",
    position: [0, 0, 0],
    props: { label: "hero" },
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    type: "plugin.test.host"
  };

  check("host-kind-without-drawer-paints-marker", () => {
    const context = createRecordingContext();
    web.renderCanvas2DScene(context, scene2d, graph2d, null, {
      accent: "#000000",
      foreground: "#000000"
    });
    assert.ok(
      context.fills.some((fill) => fill.fillStyle === web.PLUGIN_NODE_MARKER_FILL),
      "registered kind without a drawer must paint the gray marker"
    );
    assert.equal(
      context.fills.some((fill) => fill.fillStyle === HOST_FILL),
      false
    );
    const hit = web.hitTestSceneGraph(
      context,
      scene2d,
      graph2d,
      [34, 44],
      null
    );
    assert.equal(hit?.node.id, "host-card");
    const object = web.createCanvas3DPluginNodeObject(node3d);
    assert.equal(object.material.color.getHexString(), "64748b");
    object.geometry.dispose();
    object.material.dispose();
  });

  const unregisterDrawer = web.registerPluginNodeDrawer({
    type: "plugin.test.host",
    mode: "both",
    draw2d(context) {
      context.fillStyle = HOST_FILL;
      context.fillRect(0, 0, 48, 48);
    },
    create3d() {
      return new Mesh(
        new BoxGeometry(1, 1, 1),
        new MeshStandardMaterial({ color: HOST_FILL })
      );
    }
  });

  check("host-drawer-2d-paints-not-marker", () => {
    const context = createRecordingContext();
    web.renderCanvas2DScene(context, scene2d, graph2d, null, {
      accent: "#000000",
      foreground: "#000000"
    });
    assert.ok(
      context.fills.some((fill) => fill.fillStyle === HOST_FILL),
      "host draw2d must paint non-marker pixels"
    );
    assert.equal(
      context.fills.some((fill) => fill.fillStyle === web.PLUGIN_NODE_MARKER_FILL),
      false
    );
    const hit = web.hitTestSceneGraph(
      context,
      scene2d,
      graph2d,
      [34, 44],
      null
    );
    assert.equal(hit?.node.id, "host-card");
  });

  check("host-drawer-3d-is-not-marker-and-hits", () => {
    const object = web.createCanvas3DPluginNodeObject(node3d);
    assert.notEqual(object.material.color.getHexString(), "64748b");
    assert.equal(object.material.color.getHexString(), "e11d48");
    object.userData.nodeId = node3d.id;
    const hostScene = new Scene();
    hostScene.add(object);
    lookAt(camera, [0, 0, 5], [0, 0, 0]);
    hostScene.updateMatrixWorld(true);
    const tester = canvasThree.createThreeHitTester({
      camera,
      getObjects: () => hostScene.children,
      resolveNodeId: (item) => item.userData.nodeId
    });
    const hit = tester.hitTest({ point: [100, 100] }, viewport);
    assert.equal(hit.kind, "node");
    assert.equal(hit.nodeId, "host-badge");
    object.geometry.dispose();
    object.material.dispose();
  });

  unregisterDrawer();

  check("host-drawer-unregister-restores-marker", () => {
    const context = createRecordingContext();
    web.renderCanvas2DScene(context, scene2d, graph2d, null, {
      accent: "#000000",
      foreground: "#000000"
    });
    assert.ok(
      context.fills.some((fill) => fill.fillStyle === web.PLUGIN_NODE_MARKER_FILL),
      "removing the host drawer must restore the marker"
    );
    assert.equal(
      context.fills.some((fill) => fill.fillStyle === HOST_FILL),
      false
    );
    const object = web.createCanvas3DPluginNodeObject(node3d);
    assert.equal(object.material.color.getHexString(), "64748b");
    object.geometry.dispose();
    object.material.dispose();
  });

  check("host-drawer-double-register-throws", () => {
    const first = web.registerPluginNodeDrawer({
      type: "plugin.test.host",
      mode: "2d",
      draw2d() {}
    });
    assert.throws(
      () =>
        web.registerPluginNodeDrawer({
          type: "plugin.test.host",
          mode: "2d",
          draw2d() {}
        }),
      /already registered/
    );
    first();
  });

  } finally {
    unregisterKind();
  }
}

{
  const scene = core.defineScene({
    id: "sparkline-bounds-scene",
    layers: [{ id: "main", name: "Main" }],
    mode: "2d",
    nodes: [
      {
        id: "spark",
        layerId: "main",
        position: [10, 20],
        props: {
          fill: "none",
          height: 80,
          stroke: "#22c55e",
          style: "linear",
          values: [2, 8, 3, 12],
          width: 240
        },
        type: "plugin.denovo.sparkline"
      }
    ]
  });
  const graph = web.createCanvas2DSceneGraph(scene);
  const spark = scene.nodes.find((node) => node.id === "spark");
  assert.deepEqual(web.resolveCanvas2DNodeWorldCenter(spark, graph), [10, 20]);
  assert.deepEqual(web.resolveCanvas2DNodeWorldBounds(spark, graph), {
    maxX: 250,
    maxY: 100,
    minX: 10,
    minY: 20
  });
}

{
  const scene = core.defineScene({
    id: "html-transform-scene",
    layers: [{ id: "main", name: "Main" }],
    mode: "2d",
    nodes: [
      {
        height: 48,
        html: "card",
        id: "card",
        layerId: "main",
        position: [200, 260],
        type: "html",
        width: 120
      }
    ]
  });
  const graph = web.createCanvas2DSceneGraph(scene);
  const card = scene.nodes.find((node) => node.id === "card");
  const center = web.resolveCanvas2DNodeWorldCenter(card, graph);
  assert.deepEqual(center, [200, 260]);
  assert.deepEqual(web.resolveCanvas2DNodeWorldBounds(card, graph), {
    maxX: 320,
    maxY: 308,
    minX: 200,
    minY: 260
  });
}

{
  const classify = web.classifyCanvas2DWheelIntent;
  const limits = {
    enablePan: true,
    enableZoom: true,
    maxZoom: 16,
    minZoom: 0.1,
    wheelZoomSensitivity: 0.0015
  };
  const view = { offset: [0, 0], zoom: 1 };

  assert.equal(
    classify({
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      deltaX: 12,
      deltaY: -40,
      deltaMode: 0
    }),
    "zoom",
    "pinch (ctrl+wheel) must zoom even when deltaX is non-zero"
  );
  assert.equal(
    classify({
      ctrlKey: false,
      metaKey: true,
      shiftKey: false,
      deltaX: 0,
      deltaY: 20,
      deltaMode: 0
    }),
    "zoom",
    "meta+wheel must zoom"
  );
  assert.equal(
    classify({
      ctrlKey: false,
      metaKey: false,
      shiftKey: true,
      deltaX: 0,
      deltaY: 30,
      deltaMode: 0
    }),
    "pan",
    "shift+wheel must pan"
  );
  assert.equal(
    classify({
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      deltaX: 0,
      deltaY: 3,
      deltaMode: 1
    }),
    "zoom",
    "line-mode mouse wheel must zoom"
  );
  assert.equal(
    classify({
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      deltaX: 4,
      deltaY: 18,
      deltaMode: 0
    }),
    "pan",
    "pixel-mode event with X is a trackpad pan"
  );
  assert.equal(
    classify({
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      deltaX: 0,
      deltaY: 12,
      deltaMode: 0
    }),
    "pan",
    "small vertical pixel ticks are a trackpad pan, not zoom"
  );
  assert.equal(
    classify({
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      deltaX: 0,
      deltaY: 120,
      deltaMode: 0
    }),
    "zoom",
    "large discrete vertical pixel jumps are a mouse-wheel zoom"
  );

  const gesture = new web.Canvas2DWheelGesture();
  assert.equal(
    gesture.classify({
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      deltaX: 0,
      deltaY: 8,
      deltaMode: 0,
      timeStamp: 1000
    }),
    "pan"
  );
  assert.equal(
    gesture.classify({
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      deltaX: 0,
      deltaY: 80,
      deltaMode: 0,
      timeStamp: 1040
    }),
    "pan",
    "a trackpad flick must stay pan once the burst started as pan"
  );
  assert.equal(
    gesture.classify({
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      deltaX: 6,
      deltaY: -30,
      deltaMode: 0,
      timeStamp: 1050
    }),
    "zoom",
    "pinch must break a pan lock"
  );

  const pinched = web.applyCanvas2DWheelNavigation(
    view,
    {
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      deltaX: 8,
      deltaY: -40,
      deltaMode: 0
    },
    "zoom",
    limits,
    [100, 80]
  );
  assert.equal(pinched.consumed, true);
  assert.ok(pinched.view.zoom > view.zoom, "ctrl+wheel must change zoom");

  const panned = web.applyCanvas2DWheelNavigation(
    view,
    {
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      deltaX: 10,
      deltaY: 4,
      deltaMode: 0
    },
    "pan",
    limits,
    [0, 0]
  );
  assert.equal(panned.consumed, true);
  assert.deepEqual(panned.view.zoom, 1);
  assert.ok(panned.view.offset[0] !== 0 || panned.view.offset[1] !== 0);

  const blocked = web.applyCanvas2DWheelNavigation(
    view,
    {
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      deltaX: 10,
      deltaY: 0,
      deltaMode: 0
    },
    "pan",
    { ...limits, enablePan: false },
    [0, 0]
  );
  assert.equal(blocked.consumed, false);
  assert.deepEqual(blocked.view, view);
}

check("webgpu-2d-host-drawer-is-wired", () => {
  const webDist = path.join(root, "packages/web/dist");
  const bundled = readdirSync(webDist).some((name) => {
    if (!name.endsWith(".js")) {
      return false;
    }
    const source = readFileSync(path.join(webDist, name), "utf8");
    return source.includes("resolveHostPluginNodeDraw2d");
  });
  assert.ok(
    bundled,
    "2D WebGPU bundle must rasterize host draw2d instead of only the marker"
  );
});

check("rounded-rect-and-stroke-hit-testing", () => {
  const scene = core.defineScene({
    id: "rounded-hit-scene",
    layers: [{ id: "main", name: "Main" }],
    mode: "2d",
    nodes: [
      {
        id: "rounded-rect",
        layerId: "main",
        type: "rect",
        position: [0, 0],
        size: [100, 100],
        cornerRadius: 40,
        fill: "#22c55e"
      },
      {
        id: "stroked-rect",
        layerId: "main",
        type: "rect",
        position: [150, 0],
        size: [100, 100],
        fill: "#1e293b",
        stroke: "#38bdf8",
        strokeWidth: 10
      },
      {
        id: "stroked-circle",
        layerId: "main",
        type: "circle",
        position: [350, 50],
        radius: 30,
        fill: "#1e293b",
        stroke: "#f59e0b",
        strokeWidth: 10
      }
    ]
  });
  const graph = web.createCanvas2DSceneGraph(scene);
  const ctx = createRecordingContext();

  // Center of rounded rect hits; cut-off corner outside 40px radius misses.
  assert.equal(web.hitTestSceneGraph(ctx, scene, graph, [50, 50], null)?.node.id, "rounded-rect");
  assert.equal(web.hitTestSceneGraph(ctx, scene, graph, [3, 3], null), null);
  // Outer half of 10px stroke (5px outward) hits; outside 5px misses.
  assert.equal(web.hitTestSceneGraph(ctx, scene, graph, [146, 50], null)?.node.id, "stroked-rect");
  assert.equal(web.hitTestSceneGraph(ctx, scene, graph, [143, 50], null), null);
  // Stroked circle outer stroke half (radius 30 + 5 = 35) hits at +34, misses at +37.
  assert.equal(web.hitTestSceneGraph(ctx, scene, graph, [384, 50], null)?.node.id, "stroked-circle");
  assert.equal(web.hitTestSceneGraph(ctx, scene, graph, [387, 50], null), null);
});

check("clipped-group-hit-testing-and-bounds", () => {
  const scene = core.defineScene({
    id: "clipped-group-scene",
    layers: [{ id: "main", name: "Main" }],
    mode: "2d",
    nodes: [
      {
        id: "frame",
        layerId: "main",
        type: "group",
        position: [100, 100],
        clip: { x: 0, y: 0, width: 80, height: 80, cornerRadius: 24 },
        opacity: 0.9
      },
      {
        id: "overflow-child",
        layerId: "main",
        parentId: "frame",
        type: "rect",
        position: [0, 0],
        size: [200, 200],
        fill: "#3b82f6"
      }
    ]
  });
  const graph = web.createCanvas2DSceneGraph(scene);
  const ctx = createRecordingContext();
  const frame = scene.nodes.find((n) => n.id === "frame");

  assert.deepEqual(web.resolveCanvas2DNodeWorldBounds(frame, graph), {
    minX: 100,
    minY: 100,
    maxX: 180,
    maxY: 180
  });

  // Inside clip hits child; overflow outside clip and cut-off rounded corner miss.
  assert.equal(web.hitTestSceneGraph(ctx, scene, graph, [140, 140], null)?.node.id, "overflow-child");
  assert.equal(web.hitTestSceneGraph(ctx, scene, graph, [220, 140], null), null);
  assert.equal(web.hitTestSceneGraph(ctx, scene, graph, [101, 101], null), null);

  // Canvas2D render invokes clip() and respects group opacity.
  web.renderCanvas2DScene(ctx, scene, graph, null, {
    accent: "#38bdf8",
    foreground: "#f8fafc"
  });
  assert.equal(ctx.clipCount, 1, "clipped group must call context.clip()");
});

check("box-model-and-redline-geometry-and-render", () => {
  const regions = web.resolveCanvas2DBoxModelRegions({
    bounds: { minX: 100, minY: 100, maxX: 220, maxY: 180 },
    margin: { top: 10, right: 12, bottom: 14, left: 16 },
    border: { top: 2, right: 2, bottom: 2, left: 2 },
    padding: { top: 8, right: 10, bottom: 8, left: 10 }
  });
  assert.deepEqual(regions.marginBox, { minX: 84, minY: 90, maxX: 232, maxY: 194 });
  assert.deepEqual(regions.paddingBox, { minX: 102, minY: 102, maxX: 218, maxY: 178 });
  assert.deepEqual(regions.contentBox, { minX: 112, minY: 110, maxX: 208, maxY: 170 });
  assert.equal(regions.marginStrips.length, 4);
  assert.equal(regions.borderStrips.length, 4);
  assert.equal(regions.paddingStrips.length, 4);
  assert.deepEqual(regions.contentRect, { x: 112, y: 110, width: 96, height: 60 });

  // Disjoint horizontal pair -> 1 redline, no extensions.
  const horizontal = web.computeCanvas2DRedlines(
    { minX: 0, minY: 0, maxX: 100, maxY: 80 },
    { minX: 140, minY: 10, maxX: 220, maxY: 90 },
    { unit: "px" }
  );
  assert.equal(horizontal.length, 1);
  assert.equal(horizontal[0].label, "40px");
  assert.equal(horizontal[0].extensions, undefined);

  // Diagonally separated pair -> 2 redlines, each with a perpendicular extension.
  const diagonal = web.computeCanvas2DRedlines(
    { minX: 0, minY: 0, maxX: 50, maxY: 50 },
    { minX: 90, minY: 80, maxX: 140, maxY: 130 }
  );
  assert.equal(diagonal.length, 2);
  assert.equal(diagonal[0].label, "40");
  assert.equal(diagonal[0].extensions?.length, 1);
  assert.equal(diagonal[1].label, "30");
  assert.equal(diagonal[1].extensions?.length, 1);

  // Contained box -> 4 inset redlines.
  const inset = web.computeCanvas2DRedlines(
    { minX: 20, minY: 10, maxX: 80, maxY: 60 },
    { minX: 0, minY: 0, maxX: 120, maxY: 100 }
  );
  assert.equal(inset.length, 4);
  assert.deepEqual(
    inset.map((r) => r.label),
    ["10", "40", "40", "20"]
  );

  // Render inspection overlay onto recording context without throwing.
  const ctx = createRecordingContext();
  web.renderCanvas2DInspectionOverlay(
    ctx,
    {
      boxModels: [
        {
          bounds: { minX: 100, minY: 100, maxX: 220, maxY: 180 },
          margin: { top: 8, right: 8, bottom: 8, left: 8 },
          border: { top: 2, right: 2, bottom: 2, left: 2 },
          padding: { top: 12, right: 12, bottom: 12, left: 12 },
          label: "card · 120 × 80"
        }
      ],
      redlines: diagonal
    },
    1,
    { accent: "#38bdf8", foreground: "#f8fafc" }
  );
  assert.ok(ctx.fills.length >= 13, "box model must draw margin/border/padding/content bands");
  assert.ok(ctx.strokeCount >= 4, "inspection overlay must stroke border outline and redlines");
});

check("obstacle-free-gutter-orthogonal-routing", () => {
  const assertNoInteriorCrossings = (points, boxes, label) => {
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const isOrtho =
        Math.abs(a[0] - b[0]) <= 1e-3 || Math.abs(a[1] - b[1]) <= 1e-3;
      assert.equal(
        isOrtho,
        true,
        `${label}: segment ${i} must be axis-aligned: ${JSON.stringify([a, b])}`
      );
      for (const box of boxes) {
        assert.equal(
          web.orthogonalSegmentIntersectsBoxInterior(a, b, box),
          false,
          `${label}: segment ${JSON.stringify([a, b])} crossed obstacle ${JSON.stringify(box)}`
        );
      }
    }
  };

  // 1. Direct blocker between A and C
  const scene1 = core.defineScene({
    id: "gutter-direct-blocker",
    layers: [{ id: "main", name: "Main" }],
    mode: "2d",
    nodes: [
      { id: "a", layerId: "main", type: "rect", position: [0, 0], size: [100, 80] },
      { id: "blocker", layerId: "main", type: "rect", position: [180, 0], size: [100, 80] },
      { id: "c", layerId: "main", type: "rect", position: [360, 0], size: [100, 80] },
      {
        id: "naive-edge",
        layerId: "main",
        type: "edge",
        sourceId: "a",
        targetId: "c",
        sourcePort: "right",
        targetPort: "left",
        routing: "orthogonal",
        avoidObstacles: false
      },
      {
        id: "gutter-edge",
        layerId: "main",
        type: "edge",
        sourceId: "a",
        targetId: "c",
        sourcePort: "right",
        targetPort: "left",
        routing: "orthogonal",
        avoidObstacles: true,
        obstaclePadding: 16
      }
    ]
  });
  const graph1 = web.createCanvas2DSceneGraph(scene1);
  const blockerBox = { minX: 180, minY: 0, maxX: 280, maxY: 80 };
  const naive = web.resolveCanvas2DEdgeGeometry(
    scene1.nodes.find((n) => n.id === "naive-edge"),
    graph1
  );
  assert.equal(
    web.orthogonalSegmentIntersectsBoxInterior(naive.start, naive.end, blockerBox),
    true,
    "control check: naive edge must cross blocker"
  );

  const routed = web.resolveCanvas2DEdgeGeometry(
    scene1.nodes.find((n) => n.id === "gutter-edge"),
    graph1
  );
  const routedPoints = [routed.start, ...routed.waypoints];
  assert.deepEqual(routed.start, [100, 40]);
  assert.deepEqual(routed.end, [360, 40]);
  assert.ok(routed.waypoints.length >= 4, "gutter route must detour around blocker");
  assertNoInteriorCrossings(
    routedPoints,
    [
      { minX: 0, minY: 0, maxX: 100, maxY: 80 },
      blockerBox,
      { minX: 360, minY: 0, maxX: 460, maxY: 80 }
    ],
    "direct-blocker"
  );

  // 2. Multi-row 2x3 screen grid (dui-style map) with 40px gutters
  const gridNodes = [];
  const gridBoxes = [];
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const x = col * 180;
      const y = row * 140;
      gridNodes.push({
        id: `screen-${row}-${col}`,
        layerId: "main",
        type: "rect",
        position: [x, y],
        size: [140, 100]
      });
      gridBoxes.push({ minX: x, minY: y, maxX: x + 140, maxY: y + 100 });
    }
  }
  gridNodes.push({
    id: "diag-transition",
    layerId: "main",
    type: "edge",
    sourceId: "screen-0-0",
    targetId: "screen-1-2",
    sourcePort: "right",
    targetPort: "left",
    routing: "orthogonal",
    avoidObstacles: true,
    obstaclePadding: 16
  });
  const gridScene = core.defineScene({
    id: "gutter-grid",
    layers: [{ id: "main", name: "Main" }],
    mode: "2d",
    nodes: gridNodes
  });
  const gridGraph = web.createCanvas2DSceneGraph(gridScene);
  const diag = web.resolveCanvas2DEdgeGeometry(
    gridScene.nodes.find((n) => n.id === "diag-transition"),
    gridGraph
  );
  assertNoInteriorCrossings(
    [diag.start, ...diag.waypoints],
    gridBoxes,
    "2x3-screen-grid"
  );

  // 3. Narrow 16px gutter when padding is 16 -> threads cleanly down the 8px center.
  const narrowPts = web.resolveCanvas2DObstacleFreeOrthogonalWaypoints(
    [50, 0],
    [50, 220],
    "bottom",
    "top",
    [
      { minX: 0, minY: 60, maxX: 42, maxY: 160 },
      { minX: 58, minY: 60, maxX: 100, maxY: 160 }
    ],
    { padding: 16 }
  );
  assertNoInteriorCrossings(
    [[50, 0], ...narrowPts],
    [
      { minX: 0, minY: 60, maxX: 42, maxY: 160 },
      { minX: 58, minY: 60, maxX: 100, maxY: 160 }
    ],
    "narrow-gutter"
  );
});

check("denovo-image-bounds-hit-testing-and-placeholder-draw", () => {
  const scene = core.defineScene({
    id: "image-node-scene",
    layers: [{ id: "main", name: "Main" }],
    mode: "2d",
    nodes: [
      {
        id: "screen-1",
        layerId: "main",
        type: "plugin.denovo.image",
        position: [30, 40],
        props: {
          src: "/screen.png",
          width: 240,
          height: 160,
          cornerRadius: 12,
          stroke: "#38bdf8",
          strokeWidth: 2,
          placeholder: "#1e293b"
        }
      }
    ]
  });
  const graph = web.createCanvas2DSceneGraph(scene);
  const node = scene.nodes[0];
  assert.deepEqual(web.resolveCanvas2DNodeWorldBounds(node, graph), {
    minX: 30,
    minY: 40,
    maxX: 270,
    maxY: 200
  });
  const ctx = createRecordingContext();
  assert.equal(web.hitTestSceneGraph(ctx, scene, graph, [150, 120], null)?.node.id, "screen-1");
  assert.equal(web.hitTestSceneGraph(ctx, scene, graph, [10, 10], null), null);

  web.renderCanvas2DScene(ctx, scene, graph, null, {
    accent: "#38bdf8",
    foreground: "#f8fafc"
  });
  assert.ok(
    ctx.fills.some((f) => f.fillStyle === "#1e293b"),
    "unloaded image node must render its placeholder fill"
  );
  assert.ok(ctx.strokeCount >= 1, "stroked image node must draw its stroke");
});

check("summarize-canvas-image-data-semantics", () => {
  const empty = web.summarizeCanvasImageData({ data: [], width: 0, height: 0 });
  assert.equal(empty.nonBlank, false);
  assert.equal(empty.uniqueColors, 0);

  const blank = web.summarizeCanvasImageData({
    data: new Uint8ClampedArray([15, 23, 42, 255, 15, 23, 42, 255]),
    width: 2,
    height: 1
  });
  assert.equal(blank.nonBlank, false);
  assert.equal(blank.uniqueColors, 1);
  assert.deepEqual(blank.averageRgba, [15, 23, 42, 255]);

  const drawn = web.summarizeCanvasImageData({
    data: new Uint8ClampedArray([0, 0, 0, 255, 200, 100, 50, 255]),
    width: 2,
    height: 1
  });
  assert.equal(drawn.nonBlank, true);
  assert.equal(drawn.uniqueColors, 2);
  assert.deepEqual(drawn.averageRgba, [100, 50, 25, 255]);
});

check("hit-testing-suite", () => {});

report();

function createRecordingContext() {
  return {
    clipCount: 0,
    fills: [],
    fillStyle: "#000000",
    font: "",
    globalAlpha: 1,
    lineJoin: "miter",
    lineWidth: 1,
    strokeCount: 0,
    strokeStyle: "#000000",
    textAlign: "left",
    textBaseline: "alphabetic",
    save() {},
    restore() {},
    transform() {},
    translate() {},
    scale() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    arcTo() {},
    rect() {},
    clip() {
      this.clipCount += 1;
    },
    setLineDash() {},
    measureText(text) {
      return { width: String(text).length * 7 };
    },
    fill() {
      this.fills.push({ fillStyle: String(this.fillStyle), alpha: this.globalAlpha });
    },
    stroke() {
      this.strokeCount += 1;
    },
    strokeRect() {
      this.strokeCount += 1;
    },
    fillText() {},
    fillRect(x, y, w, h) {
      this.fills.push({ fillStyle: String(this.fillStyle), alpha: this.globalAlpha, x, y, w, h });
    }
  };
}

function createBox(nodeId, position) {
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  mesh.position.set(...position);
  mesh.userData.nodeId = nodeId;
  return mesh;
}

function lookAt(targetCamera, position, target) {
  targetCamera.position.set(...position);
  targetCamera.lookAt(...target);
  targetCamera.updateProjectionMatrix();
  targetCamera.updateMatrixWorld();
}

function assertVectorClose(actual, expected, epsilon = 1e-10) {
  assert.equal(actual.length, expected.length);

  for (let index = 0; index < actual.length; index += 1) {
    assert.ok(
      Math.abs(actual[index] - expected[index]) <= epsilon,
      `Expected vector component ${index} to be ${expected[index]}, received ${actual[index]}.`
    );
  }
}
