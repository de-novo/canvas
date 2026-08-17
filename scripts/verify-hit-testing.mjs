import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

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
check("hit-testing-suite", () => {});

report();

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
