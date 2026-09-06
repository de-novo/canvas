import type {
  Canvas3DNode,
  Canvas3DSurfacePointResult,
  CanvasHitResult,
  CanvasHitTestInput,
  NodeId
} from "@denovo/canvas-core";
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree
} from "three-mesh-bvh";
import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  type Camera,
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix3,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  type Ray,
  Raycaster,
  SphereGeometry,
  Vector2,
  Vector3,
  type Material
} from "three";

/**
 * userData key under which a batched InstancedMesh stores the NodeId for each
 * instance, indexed by instance id. Used by createThreeHitTester to resolve a
 * hit on a batched mesh back to the originating document node.
 */
export const INSTANCE_NODE_IDS_USER_DATA_KEY = "denovoInstanceNodeIds";

export type DemandRenderLoop = {
  dispose: () => void;
  invalidate: () => void;
  start: () => void;
  stop: () => void;
};

export type InstancedMeshBatchOptions = {
  node: Extract<Canvas3DNode, { type: "instances" }>;
  material?: Material;
};

export type ThreeHitTestViewport = {
  height: number;
  width: number;
};

export type ThreeHitTesterOptions = {
  camera: Camera;
  getObjects: () => Object3D[];
  renderer?: string;
  resolveNodeId: (object: Object3D) => NodeId | undefined;
};

export type ThreeHitTester = {
  hitTest: (
    input: CanvasHitTestInput,
    viewport: ThreeHitTestViewport
  ) => CanvasHitResult;
};

type Canvas3DBoxSurfaceHit = Extract<
  Canvas3DSurfacePointResult,
  { kind: "hit"; nodeType: "box" }
>;

export type ThreeUnitBoxSurfaceIntersection = Pick<
  Canvas3DBoxSurfaceHit,
  "feature" | "normal" | "point"
>;

const THREE_UNIT_BOX = new Box3(
  new Vector3(-0.5, -0.5, -0.5),
  new Vector3(0.5, 0.5, 0.5)
);
const THREE_UNIT_BOX_FACE_EPSILON = 1e-8;
const THREE_UNIT_BOX_AXES = [
  ["x", 0],
  ["y", 1],
  ["z", 2]
] as const;

let meshBvhInstalled = false;

export function installMeshBvhRaycast() {
  if (meshBvhInstalled) {
    return;
  }

  Mesh.prototype.raycast =
    acceleratedRaycast as unknown as typeof Mesh.prototype.raycast;
  const geometryPrototype = BufferGeometry.prototype as BufferGeometry & {
    computeBoundsTree: typeof computeBoundsTree;
    disposeBoundsTree: typeof disposeBoundsTree;
  };
  geometryPrototype.computeBoundsTree = computeBoundsTree;
  geometryPrototype.disposeBoundsTree = disposeBoundsTree;
  meshBvhInstalled = true;
}

export function createDemandRenderLoop(render: () => void): DemandRenderLoop {
  let active = false;
  let frameId: number | null = null;

  function flush() {
    frameId = null;

    if (!active) {
      return;
    }

    render();
  }

  function invalidate() {
    if (!active || frameId !== null) {
      return;
    }

    frameId = requestAnimationFrame(flush);
  }

  function start() {
    active = true;
    invalidate();
  }

  function stop() {
    active = false;

    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  }

  return {
    dispose: stop,
    invalidate,
    start,
    stop
  };
}

export function createThreeHitTester({
  camera,
  getObjects,
  renderer = "three",
  resolveNodeId
}: ThreeHitTesterOptions): ThreeHitTester {
  const pointer = new Vector2();
  const raycaster = new Raycaster();

  return {
    hitTest(input, viewport) {
      const [x, y] = input.point;

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new TypeError("Three hit-test coordinates must be finite numbers.");
      }

      if (
        !Number.isFinite(viewport.width) ||
        !Number.isFinite(viewport.height) ||
        viewport.width <= 0 ||
        viewport.height <= 0
      ) {
        throw new TypeError("Three hit-test viewport must have a finite positive size.");
      }

      if (x < 0 || y < 0 || x > viewport.width || y > viewport.height) {
        return {
          kind: "empty",
          renderer
        };
      }

      pointer.set(
        (x / viewport.width) * 2 - 1,
        1 - (y / viewport.height) * 2
      );
      camera.updateMatrixWorld();
      raycaster.setFromCamera(pointer, camera);

      const intersections = raycaster.intersectObjects(getObjects(), true);

      for (const intersection of intersections) {
        let nodeId = findIntersectionNodeId(intersection.object, resolveNodeId);

        if (!nodeId && intersection.instanceId !== undefined) {
          const instanceNodeIds = intersection.object.userData?.[
            INSTANCE_NODE_IDS_USER_DATA_KEY
          ] as readonly NodeId[] | undefined;

          if (instanceNodeIds) {
            nodeId = instanceNodeIds[intersection.instanceId];
          }
        }

        if (!nodeId) {
          continue;
        }

        return {
          distance: intersection.distance,
          ...(intersection.instanceId === undefined
            ? {}
            : { instanceIndex: intersection.instanceId }),
          kind: "node",
          nodeId,
          point: [
            intersection.point.x,
            intersection.point.y,
            intersection.point.z
          ],
          renderer
        };
      }

      return {
        kind: "empty",
        renderer
      };
    }
  };
}

/**
 * Intersects a world-space ray with the canonical unit box transformed by
 * `matrixWorld`. The returned face is expressed in canonical box-local space,
 * while its point and unit normal are expressed in world space.
 */
export function intersectThreeUnitBoxSurface(
  ray: Ray,
  matrixWorld: Matrix4
): ThreeUnitBoxSurfaceIntersection | null {
  assertFiniteThreeRay(ray);
  assertFiniteInvertibleMatrix(matrixWorld);

  const inverseWorld = matrixWorld.clone().invert();
  const localRay = ray.clone().applyMatrix4(inverseWorld);
  assertFiniteThreeRay(localRay);

  const localPoint = localRay.intersectBox(THREE_UNIT_BOX, new Vector3());

  if (!localPoint) {
    return null;
  }

  const feature = resolveThreeUnitBoxFace(localPoint, localRay);
  const localNormal = new Vector3();
  localNormal.setComponent(
    feature.axis === "x" ? 0 : feature.axis === "y" ? 1 : 2,
    feature.side
  );

  const worldPoint = localPoint.clone().applyMatrix4(matrixWorld);
  const worldNormal = localNormal.applyMatrix3(
    new Matrix3().getNormalMatrix(matrixWorld)
  );
  const worldNormalLength = worldNormal.length();

  if (!isFiniteThreeVector(worldPoint)) {
    throw new TypeError("Three unit-box surface point must be finite.");
  }

  if (
    !isFiniteThreeVector(worldNormal) ||
    !Number.isFinite(worldNormalLength) ||
    worldNormalLength === 0
  ) {
    throw new TypeError(
      "Three unit-box surface transform produced an invalid world normal."
    );
  }

  worldNormal.divideScalar(worldNormalLength);

  return {
    feature,
    normal: [worldNormal.x, worldNormal.y, worldNormal.z],
    point: [worldPoint.x, worldPoint.y, worldPoint.z]
  };
}

export function createInstancedMeshBatch({
  node,
  material
}: InstancedMeshBatchOptions) {
  const geometry =
    node.geometry === "sphere"
      ? new SphereGeometry(0.5, 32, 16)
      : new BoxGeometry(1, 1, 1);
  const resolvedMaterial =
    material ??
    new MeshStandardMaterial({
      color: new Color(node.color),
      roughness: 0.58,
      metalness: 0.06
    });
  const mesh = new InstancedMesh(geometry, resolvedMaterial, node.instances.length);
  const transform = new Object3D();
  const matrix = new Matrix4();

  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = true;

  node.instances.forEach((instance, index) => {
    transform.position.set(
      instance.position[0],
      instance.position[1],
      instance.position[2]
    );
    transform.rotation.set(
      instance.rotation[0],
      instance.rotation[1],
      instance.rotation[2]
    );
    transform.scale.set(instance.scale[0], instance.scale[1], instance.scale[2]);
    transform.updateMatrix();
    matrix.copy(transform.matrix);
    mesh.setMatrixAt(index, matrix);

    if (instance.color) {
      mesh.setColorAt(index, new Color(instance.color));
    }
  });

  mesh.instanceMatrix.needsUpdate = true;

  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  geometry.computeBoundingSphere();
  return mesh;
}

function findIntersectionNodeId(
  object: Object3D,
  resolveNodeId: (object: Object3D) => NodeId | undefined
): NodeId | undefined {
  let current: Object3D | null = object;

  while (current) {
    const nodeId = resolveNodeId(current);

    if (nodeId) {
      return nodeId;
    }

    current = current.parent;
  }

  return undefined;
}

function assertFiniteThreeRay(ray: Ray): void {
  if (
    !isFiniteThreeVector(ray.origin) ||
    !isFiniteThreeVector(ray.direction) ||
    ray.direction.lengthSq() === 0
  ) {
    throw new TypeError(
      "Three unit-box surface ray must have a finite origin and non-zero finite direction."
    );
  }
}

function assertFiniteInvertibleMatrix(matrix: Matrix4): void {
  if (!matrix.elements.every(Number.isFinite)) {
    throw new TypeError("Three unit-box surface transform must be finite.");
  }

  const determinant = matrix.determinant();

  if (!Number.isFinite(determinant) || determinant === 0) {
    throw new TypeError(
      "Three unit-box surface transform must be finite and invertible."
    );
  }
}

function resolveThreeUnitBoxFace(
  localPoint: Vector3,
  localRay: Ray
): Canvas3DBoxSurfaceHit["feature"] {
  const coordinates = [localPoint.x, localPoint.y, localPoint.z] as const;
  const direction = [
    localRay.direction.x,
    localRay.direction.y,
    localRay.direction.z
  ] as const;
  const candidates = THREE_UNIT_BOX_AXES.map(([axis, index]) => {
    const side = coordinates[index] < 0 ? -1 : 1;
    return {
      axis,
      boundaryError: Math.abs(Math.abs(coordinates[index]) - 0.5),
      incidence: direction[index] * side,
      side
    } as const;
  });
  const minimumBoundaryError = Math.min(
    ...candidates.map((candidate) => candidate.boundaryError)
  );

  if (
    !Number.isFinite(minimumBoundaryError) ||
    minimumBoundaryError > THREE_UNIT_BOX_FACE_EPSILON
  ) {
    throw new TypeError(
      "Three unit-box intersection did not resolve to a canonical box face."
    );
  }

  const rayStartsInside = THREE_UNIT_BOX.containsPoint(localRay.origin);
  let selected: (typeof candidates)[number] | null = null;
  let selectedIncidence = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    if (
      candidate.boundaryError >
      minimumBoundaryError + THREE_UNIT_BOX_FACE_EPSILON
    ) {
      continue;
    }

    const facingIncidence = rayStartsInside
      ? candidate.incidence
      : -candidate.incidence;

    if (selected === null || facingIncidence > selectedIncidence) {
      selected = candidate;
      selectedIncidence = facingIncidence;
    }
  }

  if (!selected) {
    throw new TypeError("Three unit-box face resolution failed.");
  }

  return {
    axis: selected.axis,
    kind: "box.face",
    side: selected.side
  };
}

function isFiniteThreeVector(vector: Vector3): boolean {
  return [vector.x, vector.y, vector.z].every(Number.isFinite);
}

export {
  DENOVO_FIELD_USER_DATA_KEY,
  attachDenovoFieldGpuCompute,
  createDenovoFieldObject,
  detachDenovoFieldGpuCompute,
  isDenovoFieldObject,
  readDenovoFieldComputeDispatches,
  readDenovoFieldComputeResidentCopies,
  readDenovoFieldObjectState,
  tickDenovoFieldObject
} from "./field.js";
export type { DenovoFieldComputeHost } from "./field.js";
