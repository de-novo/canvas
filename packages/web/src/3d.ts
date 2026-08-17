import {
  CanvasAuthoringPreviewSchema,
  Canvas3DSurfacePointRequestSchema,
  Canvas3DSurfacePointResultSchema,
  CanvasNodeTransformHandleIdSchema,
  CanvasNodeTransformHandleTargetSchema,
  CanvasNodeTransformInputSchema,
  CanvasNodeTransformPreviewSchema,
  CanvasScenePointRequestSchema,
  CanvasScenePointResultSchema,
  createCanvasStore,
  defineScene,
  type CanvasAuthoringPreviewForMode,
  type Canvas3DNode,
  type Canvas3DScene,
  type Canvas3DSceneInput,
  type Canvas3DSurfacePointRequest,
  type Canvas3DSurfacePointResult,
  type Canvas3DSurfacePointRuntime,
  type CanvasHitResult,
  type CanvasHitTestInput,
  type CanvasNodeTransformHandleId,
  type CanvasNodeTransformHandleTarget,
  type CanvasNodeTransformInput,
  type CanvasNodeTransformKind,
  type CanvasNodeTransformPreviewForMode,
  type CanvasNodeRotationAxis,
  type CanvasNodeScaleConstraint,
  type CanvasNodeTranslationConstraint,
  type CanvasScenePointRequestFor,
  type CanvasScenePointResultFor,
  type NodeId
} from "@denovo/canvas-core";
import {
  INSTANCE_NODE_IDS_USER_DATA_KEY,
  createInstancedMeshBatch,
  createThreeHitTester,
  intersectThreeUnitBoxSurface,
  installMeshBvhRaycast
} from "@denovo/canvas-three";
import {
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DynamicDrawUsage,
  Euler,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Plane,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  createResizeScheduler,
  getRenderRect,
  resolveCanvas,
  resolveCanvasCssColor
} from "./dom";
import type {
  CanvasAuthoringRuntime,
  CanvasCameraControlsInput,
  CanvasHitTestRuntime,
  CanvasNavigationInputRuntime,
  CanvasNodeTransformHandleRuntime,
  CanvasNodeTransformRuntime,
  CanvasRenderStats,
  CanvasTarget,
  CreateCanvasOptions
} from "./types";

const NODE_ID_USER_DATA_KEY = "denovoNodeId";
const TRANSFORM_HANDLE_ID_USER_DATA_KEY = "denovoTransformHandleId";
const CANVAS_3D_NODE_TRANSFORM_KINDS = [
  "translate",
  "rotate",
  "scale"
] as const satisfies readonly CanvasNodeTransformKind[];
const PROJECTED_BASIS_DETERMINANT_EPSILON = 1e-8;
const SCALE_ORIGIN_EPSILON = 1e-6;
const LABEL_FONT = "600 32px ui-sans-serif, system-ui, sans-serif";
const LABEL_HEIGHT = 56;
const LABEL_HORIZONTAL_PADDING = 20;
const MAX_LABEL_TEXTURE_WIDTH = 8192;
const MEASUREMENT_MARKER_RADIUS = 0.045;
const MEASUREMENT_SEGMENT_RADIUS = 0.018;
const ANNOTATION_ANCHOR_RADIUS = 0.06;
const LABEL_WORLD_HEIGHT = 0.28;
const NODE_SUB_TARGET_USER_DATA_KEY = "denovoNodeSubTarget";
const SCENE_POINT_PLANE_EPSILON = 1e-10;
const AUTHORING_NODE_OPACITY = 0.62;
const AUTHORING_MEASUREMENT_OPACITY = 0.78;
const AUTHORING_GRID_HALF_EXTENT = 50;
const AUTHORING_GRID_LINE_LIMIT = 2_000;
const AUTHORING_SNAP_MARKER_RADIUS = 0.1;

function parseCanvas3DTransformPreview(
  input: unknown
): CanvasNodeTransformPreviewForMode<"3d"> {
  const preview = CanvasNodeTransformPreviewSchema.parse(input);

  if (preview.mode !== "3d") {
    throw new Error("Canvas3D transform preview validation returned 2D data.");
  }

  return preview;
}

type Canvas3DTransformNode = Extract<
  Canvas3DNode,
  { type: "box" | "group" | "instances" | "sphere" | "mesh" }
>;
type Canvas3DDrawableNode = Exclude<Canvas3DNode, { type: "group" }>;
type Canvas3DMeasurementNode = Extract<
  Canvas3DNode,
  { type: "measurement" }
>;
type Canvas3DAnnotationNode = Extract<Canvas3DNode, { type: "annotation" }>;

type Canvas3DNodeState = {
  readonly locked: boolean;
  readonly visible: boolean;
};

type Canvas3DContentColors = {
  readonly accent: string;
  readonly foreground: string;
};

export type ThreeCanvasRuntime = Omit<CanvasHitTestRuntime<"3d">, "mode"> &
  CanvasAuthoringRuntime<"3d"> &
  Canvas3DSurfacePointRuntime &
  CanvasNavigationInputRuntime &
  CanvasNodeTransformHandleRuntime &
  CanvasNodeTransformRuntime<"3d"> & {
  readonly mode: "3d";
  readonly camera: PerspectiveCamera;
  readonly controls: OrbitControls | null;
  readonly objects: ReadonlyMap<string, Object3D>;
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
};

export function createCanvas3D(
  target: CanvasTarget,
  sceneInput: Canvas3DSceneInput,
  options: CreateCanvasOptions = {}
): ThreeCanvasRuntime {
  const initialScene = defineScene(sceneInput);

  if (initialScene.mode !== "3d") {
    throw new Error("createCanvas3D requires a scene with mode: '3d'.");
  }

  if (typeof ResizeObserver === "undefined") {
    throw new Error(
      "Canvas3D runtime requires ResizeObserver for deterministic resize handling."
    );
  }

  installMeshBvhRaycast();

  const store = createCanvasStore<"3d">(initialScene);
  const resolved = resolveCanvas(target);
  const renderer = new WebGLRenderer({
    antialias: options.antialias ?? true,
    canvas: resolved.canvas
  });
  const scene = new Scene();
  const camera = new PerspectiveCamera(initialScene.camera.fov, 1, 0.1, 1000);
  const controls = createCameraControls(
    camera,
    resolved.canvas,
    initialScene,
    options.controls
  );
  const controlsEnabledByConfig = controls?.enabled ?? false;
  const content = new Group();
  const authoringPreviewRoot = new Group();
  const objects = new Map<string, Object3D>();
  const hitTestObjects: Object3D[] = [];
  const nodeStates = new Map<NodeId, Canvas3DNodeState>();
  /**
   * Previous scene nodes keyed by id, used by `applyScene` to reuse existing
   * Object3Ds when a node has not changed value across an update.
   */
  const prevNodesById = new Map<string, Canvas3DNode>();
  const contentColors = resolveCanvas3DContentColors(resolved.canvas);
  let hitSubTarget: string | undefined;
  const hitTester = createThreeHitTester({
    camera,
    getObjects: () => hitTestObjects,
    resolveNodeId(object) {
      const subTarget = getObjectNodeSubTarget(object);

      if (subTarget !== undefined) {
        hitSubTarget = subTarget;
      }

      return getObjectNodeId(object);
    }
  });
  const transformRaycaster = new Raycaster();
  const transformPointer = new Vector2();
  const transformPlane = new Plane();
  const transformPlaneNormal = new Vector3();
  const transformPlanePoint = new Vector3();
  const transformOriginIntersection = new Vector3();
  const transformPointIntersection = new Vector3();
  const transformAxis = new Vector3();
  const transformScreenOrigin = new Vector3();
  const transformScreenEnd = new Vector3();
  const transformProjectedCenter = new Vector2();
  const transformProjectedAxisA = new Vector2();
  const transformProjectedAxisB = new Vector2();
  const transformOriginOffset = new Vector2();
  const transformPointOffset = new Vector2();
  const transformOriginDirection = new Vector3();
  const transformPointDirection = new Vector3();
  const transformCrossDirection = new Vector3();
  const transformInitialEuler = new Euler(0, 0, 0, "XYZ");
  const transformResultEuler = new Euler(0, 0, 0, "XYZ");
  const transformInitialQuaternion = new Quaternion();
  const transformDeltaQuaternion = new Quaternion();
  const transformResultQuaternion = new Quaternion();
  const transformScaleBasisQuaternion = new Quaternion();
  const transformParentWorldQuaternion = new Quaternion();
  const transformLocalResult = new Vector3();
  const transformHandles = createTransformHandleGroup();
  const scenePointRaycaster = new Raycaster();
  const scenePointPointer = new Vector2();
  const scenePointPlane = new Plane();
  const scenePointIntersection = new Vector3();
  const surfacePointRaycaster = new Raycaster();
  const surfacePointPointer = new Vector2();

  let currentScene: Canvas3DScene = initialScene;
  let transformHandleTarget: CanvasNodeTransformHandleTarget | null = null;
  let transformPreview: CanvasNodeTransformPreviewForMode<"3d"> | null = null;
  let frameId: number | null = null;
  let previousTime = 0;
  let runtime: ThreeCanvasRuntime;
  let resizeState = {
    height: 0,
    pixelRatio: 0,
    width: 0
  };

  scene.add(new AmbientLight(0xffffff, 0.32));

  const keyLight = new DirectionalLight(0xffffff, 2.1);
  keyLight.position.set(5, 7, 6);
  scene.add(keyLight);

  const fillLight = new DirectionalLight(0x93c5fd, 0.35);
  fillLight.position.set(-4, 2, -5);
  scene.add(fillLight);
  scene.add(content);
  authoringPreviewRoot.name = "denovo-authoring-previews";
  scene.add(authoringPreviewRoot);
  scene.add(transformHandles);

  const resizeScheduler = createResizeScheduler(() => runtime.resize());
  const resizeObserver = new ResizeObserver(() => resizeScheduler.schedule());

  function update(sceneValue: Canvas3DSceneInput): Canvas3DScene {
    const nextScene = defineScene(sceneValue);

    if (nextScene.mode !== "3d") {
      throw new Error("createCanvas3D cannot switch to a non-3D scene.");
    }

    const wasRunning = store.getState().status === "running";
    clearAuthoringPreviews();
    clearNodeTransformPreview();

    if (transformHandleTarget) {
      const targetNodeId = transformHandleTarget.nodeId;

      const targetNode = nextScene.nodes.find(
        (node) => node.id === targetNodeId
      );

      if (!targetNode || !isCanvas3DTransformNode(targetNode)) {
        transformHandleTarget = null;
      }
    }

    applyScene(
      nextScene,
      scene,
      camera,
      content,
      objects,
      hitTestObjects,
      nodeStates,
      contentColors,
      prevNodesById
    );
    store.getState().setScene(nextScene);
    currentScene = nextScene;

    if (wasRunning && currentScene.render.loop === "demand" && frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    } else if (
      wasRunning &&
      currentScene.render.loop === "always" &&
      frameId === null
    ) {
      frameId = requestAnimationFrame(loop);
    }

    syncCameraControls(controls, currentScene);
    runtime.resize();
    runtime.render();
    return currentScene;
  }

  function render() {
    syncTransformHandles();
    renderer.render(scene, camera);
  }

  function captureRenderStats(): CanvasRenderStats {
    const info = renderer.info;
    const programs = info.programs?.length;
    return {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      ...(programs === undefined ? {} : { programs })
    };
  }

  function hitTest(input: CanvasHitTestInput): CanvasHitResult {
    const rect = resolved.canvas.getBoundingClientRect();
    syncTransformHandles();
    scene.updateMatrixWorld(true);

    const handleHit = hitTestTransformHandle(input);

    if (handleHit) {
      return handleHit;
    }

    hitSubTarget = undefined;
    const hit = hitTester.hitTest(input, {
      height: rect.height || resizeState.height,
      width: rect.width || resizeState.width
    });

    if (hit.kind !== "node") {
      return hit;
    }

    const nodeState = nodeStates.get(hit.nodeId);

    if (!nodeState) {
      throw new Error(`Canvas3D hit state was not found: ${hit.nodeId}`);
    }

    if (nodeState.locked) {
      return {
        ...hit,
        subTarget: "locked"
      };
    }

    return hitSubTarget === undefined
      ? hit
      : {
          ...hit,
          subTarget: hitSubTarget
        };
  }

  function resolveNodeTransform(
    inputValue: CanvasNodeTransformInput
  ): CanvasNodeTransformPreviewForMode<"3d"> {
    const input = CanvasNodeTransformInputSchema.parse(inputValue);
    const node = currentScene.nodes.find(
      (candidate) => candidate.id === input.nodeId
    );

    if (!node) {
      throw new Error(`Canvas3D transform node was not found: ${input.nodeId}`);
    }

    assertCanvas3DTransformNode(node);
    assertCanvas3DNodeTransformable(node, nodeStates);

    const object = objects.get(node.id);

    if (!object || !object.parent) {
      throw new Error(`Canvas3D transform object was not found: ${node.id}`);
    }

    scene.updateMatrixWorld(true);
    transformPlanePoint.set(...node.position);
    object.parent.localToWorld(transformPlanePoint);

    switch (input.kind) {
      case "translate":
        resolveTranslationPosition(
          input.constraint,
          input.origin,
          input.point,
          node.id
        );
        transformLocalResult.copy(transformPointIntersection);
        object.parent.worldToLocal(transformLocalResult);
        return parseCanvas3DTransformPreview({
          kind: "translate",
          mode: "3d",
          nodeId: node.id,
          position: [
            transformLocalResult.x,
            transformLocalResult.y,
            transformLocalResult.z
          ]
        });
      case "rotate":
        return parseCanvas3DTransformPreview({
          kind: "rotate",
          mode: "3d",
          nodeId: node.id,
          rotation: resolveRotation(
            node,
            object,
            input.axis,
            input.origin,
            input.point
          )
        });
      case "scale":
        return parseCanvas3DTransformPreview({
          kind: "scale",
          mode: "3d",
          nodeId: node.id,
          scale: resolveScale(
            node,
            object,
            input.constraint,
            input.origin,
            input.point
          )
        });
      default: {
        const exhaustive: never = input;
        throw new Error(
          `Unsupported Canvas3D transform input: ${JSON.stringify(exhaustive)}`
        );
      }
    }
  }

  function resolveTranslationPosition(
    constraint: CanvasNodeTranslationConstraint,
    origin: readonly [number, number],
    point: readonly [number, number],
    nodeId: string
  ) {
    switch (constraint) {
      case "x":
        transformAxis.set(1, 0, 0);
        return resolveAxisTranslation(origin, point, nodeId);
      case "y":
        transformAxis.set(0, 1, 0);
        return resolveAxisTranslation(origin, point, nodeId);
      case "z":
        transformAxis.set(0, 0, 1);
        return resolveAxisTranslation(origin, point, nodeId);
      case "free":
        camera.getWorldDirection(transformPlaneNormal);
        break;
      case "xy":
        transformPlaneNormal.set(0, 0, 1);
        break;
      case "xz":
        transformPlaneNormal.set(0, 1, 0);
        break;
      case "yz":
        transformPlaneNormal.set(1, 0, 0);
        break;
      default: {
        const exhaustive: never = constraint;
        throw new Error(
          `Unsupported Canvas3D transform constraint: ${exhaustive}`
        );
      }
    }

    transformPlane.setFromNormalAndCoplanarPoint(
      transformPlaneNormal,
      transformPlanePoint
    );

    if (
      !intersectTransformPlane(origin, transformOriginIntersection) ||
      !intersectTransformPlane(point, transformPointIntersection)
    ) {
      throw new Error(
        `Canvas3D transform plane could not be resolved: ${nodeId}`
      );
    }

    transformPointIntersection
      .sub(transformOriginIntersection)
      .add(transformPlanePoint);
  }

  function resolveAxisTranslation(
    origin: readonly [number, number],
    point: readonly [number, number],
    nodeId: string
  ) {
    const { height, width } = getCanvasViewport();

    if (width <= 0 || height <= 0) {
      throw new Error(`Canvas3D transform viewport is unavailable: ${nodeId}`);
    }

    transformScreenOrigin.copy(transformPlanePoint).project(camera);
    transformScreenEnd
      .copy(transformPlanePoint)
      .add(transformAxis)
      .project(camera);

    const axisX = ((transformScreenEnd.x - transformScreenOrigin.x) * width) / 2;
    const axisY = -((transformScreenEnd.y - transformScreenOrigin.y) * height) / 2;
    const squaredLength = axisX * axisX + axisY * axisY;

    if (squaredLength <= Number.EPSILON) {
      throw new Error(`Canvas3D transform axis could not be projected: ${nodeId}`);
    }

    const pointerX = point[0] - origin[0];
    const pointerY = point[1] - origin[1];
    const distance = (pointerX * axisX + pointerY * axisY) / squaredLength;
    transformPointIntersection
      .copy(transformPlanePoint)
      .addScaledVector(transformAxis, distance);
  }

  function resolveRotation(
    node: Canvas3DTransformNode,
    object: Object3D,
    axis: CanvasNodeRotationAxis,
    origin: readonly [number, number],
    point: readonly [number, number]
  ): readonly [number, number, number] {
    const parent = object.parent;

    if (!parent) {
      throw new Error(`Canvas3D transform parent was not found: ${node.id}`);
    }

    setTransformAxis(axis);
    transformPlane.setFromNormalAndCoplanarPoint(
      transformAxis,
      transformPlanePoint
    );

    if (
      !intersectTransformPlane(origin, transformOriginIntersection) ||
      !intersectTransformPlane(point, transformPointIntersection)
    ) {
      throw new Error(
        `Canvas3D ${axis}-axis rotation plane could not be resolved: ${node.id}`
      );
    }

    transformOriginDirection
      .copy(transformOriginIntersection)
      .sub(transformPlanePoint);
    transformPointDirection
      .copy(transformPointIntersection)
      .sub(transformPlanePoint);

    if (
      transformOriginDirection.lengthSq() <= Number.EPSILON ||
      transformPointDirection.lengthSq() <= Number.EPSILON
    ) {
      throw new Error(
        `Canvas3D ${axis}-axis rotation pointer is degenerate: ${node.id}`
      );
    }

    transformOriginDirection.normalize();
    transformPointDirection.normalize();
    transformCrossDirection.crossVectors(
      transformOriginDirection,
      transformPointDirection
    );
    const angle = Math.atan2(
      transformAxis.dot(transformCrossDirection),
      transformOriginDirection.dot(transformPointDirection)
    );

    transformInitialEuler.set(
      node.rotation[0],
      node.rotation[1],
      node.rotation[2],
      "XYZ"
    );
    transformInitialQuaternion.setFromEuler(transformInitialEuler);
    parent.getWorldQuaternion(transformParentWorldQuaternion);
    transformInitialQuaternion.premultiply(transformParentWorldQuaternion);
    transformDeltaQuaternion.setFromAxisAngle(transformAxis, angle);
    transformResultQuaternion.multiplyQuaternions(
      transformDeltaQuaternion,
      transformInitialQuaternion
    );
    transformParentWorldQuaternion.invert();
    transformResultQuaternion.premultiply(transformParentWorldQuaternion);
    transformResultEuler.setFromQuaternion(
      transformResultQuaternion.normalize(),
      "XYZ"
    );

    return [
      transformResultEuler.x,
      transformResultEuler.y,
      transformResultEuler.z
    ];
  }

  function resolveScale(
    node: Canvas3DTransformNode,
    object: Object3D,
    constraint: CanvasNodeScaleConstraint,
    origin: readonly [number, number],
    point: readonly [number, number]
  ): readonly [number, number, number] {
    const parent = object.parent;

    if (!parent) {
      throw new Error(`Canvas3D transform parent was not found: ${node.id}`);
    }

    const nextScale: [number, number, number] = [
      node.scale[0],
      node.scale[1],
      node.scale[2]
    ];
    transformInitialEuler.set(
      node.rotation[0],
      node.rotation[1],
      node.rotation[2],
      "XYZ"
    );
    transformScaleBasisQuaternion.setFromEuler(transformInitialEuler);
    parent.getWorldQuaternion(transformParentWorldQuaternion);
    transformScaleBasisQuaternion.premultiply(transformParentWorldQuaternion);

    switch (constraint) {
      case "x":
        nextScale[0] *= resolveAxisScaleFactor("x", origin, point, node.id);
        break;
      case "y":
        nextScale[1] *= resolveAxisScaleFactor("y", origin, point, node.id);
        break;
      case "z":
        nextScale[2] *= resolveAxisScaleFactor("z", origin, point, node.id);
        break;
      case "xy": {
        const [xFactor, yFactor] = resolvePlaneScaleFactors(
          "x",
          "y",
          origin,
          point,
          node.id
        );
        nextScale[0] *= xFactor;
        nextScale[1] *= yFactor;
        break;
      }
      case "xz": {
        const [xFactor, zFactor] = resolvePlaneScaleFactors(
          "x",
          "z",
          origin,
          point,
          node.id
        );
        nextScale[0] *= xFactor;
        nextScale[2] *= zFactor;
        break;
      }
      case "yz": {
        const [yFactor, zFactor] = resolvePlaneScaleFactors(
          "y",
          "z",
          origin,
          point,
          node.id
        );
        nextScale[1] *= yFactor;
        nextScale[2] *= zFactor;
        break;
      }
      case "uniform": {
        const factor = resolveUniformScaleFactor(origin, point, node.id);
        nextScale[0] *= factor;
        nextScale[1] *= factor;
        nextScale[2] *= factor;
        break;
      }
      default: {
        const exhaustive: never = constraint;
        throw new Error(
          `Unsupported Canvas3D scale constraint: ${exhaustive}`
        );
      }
    }

    if (!nextScale.every(Number.isFinite)) {
      throw new Error(`Canvas3D scale result is not finite: ${node.id}`);
    }

    return nextScale;
  }

  function resolveAxisScaleFactor(
    axis: CanvasNodeRotationAxis,
    origin: readonly [number, number],
    point: readonly [number, number],
    nodeId: NodeId
  ): number {
    resolveScalePointerOffsets(origin, point, nodeId);
    projectScaleAxis(axis, transformProjectedAxisA, nodeId);
    const squaredAxisLength = transformProjectedAxisA.lengthSq();

    if (squaredAxisLength <= Number.EPSILON) {
      throw new Error(
        `Canvas3D ${axis}-axis scale projection is degenerate: ${nodeId}`
      );
    }

    const originCoordinate =
      transformOriginOffset.dot(transformProjectedAxisA) / squaredAxisLength;
    const pointCoordinate =
      transformPointOffset.dot(transformProjectedAxisA) / squaredAxisLength;

    return resolveScaleFactor(
      originCoordinate,
      pointCoordinate,
      `${axis}-axis`,
      nodeId
    );
  }

  function resolvePlaneScaleFactors(
    firstAxis: CanvasNodeRotationAxis,
    secondAxis: CanvasNodeRotationAxis,
    origin: readonly [number, number],
    point: readonly [number, number],
    nodeId: NodeId
  ): readonly [number, number] {
    resolveScalePointerOffsets(origin, point, nodeId);
    projectScaleAxis(firstAxis, transformProjectedAxisA, nodeId);
    projectScaleAxis(secondAxis, transformProjectedAxisB, nodeId);

    const firstSquaredLength = transformProjectedAxisA.lengthSq();
    const secondSquaredLength = transformProjectedAxisB.lengthSq();
    const crossTerm = transformProjectedAxisA.dot(transformProjectedAxisB);
    const determinant =
      firstSquaredLength * secondSquaredLength - crossTerm * crossTerm;
    const determinantScale = firstSquaredLength * secondSquaredLength;

    if (
      determinantScale <= Number.EPSILON ||
      Math.abs(determinant) <=
        determinantScale * PROJECTED_BASIS_DETERMINANT_EPSILON
    ) {
      throw new Error(
        `Canvas3D ${firstAxis}${secondAxis} scale basis is degenerate: ${nodeId}`
      );
    }

    const originCoordinates = resolveProjectedCoordinates(
      transformOriginOffset,
      transformProjectedAxisA,
      transformProjectedAxisB,
      firstSquaredLength,
      secondSquaredLength,
      crossTerm,
      determinant
    );
    const pointCoordinates = resolveProjectedCoordinates(
      transformPointOffset,
      transformProjectedAxisA,
      transformProjectedAxisB,
      firstSquaredLength,
      secondSquaredLength,
      crossTerm,
      determinant
    );

    return [
      resolveScaleFactor(
        originCoordinates[0],
        pointCoordinates[0],
        `${firstAxis}${secondAxis}:${firstAxis}`,
        nodeId
      ),
      resolveScaleFactor(
        originCoordinates[1],
        pointCoordinates[1],
        `${firstAxis}${secondAxis}:${secondAxis}`,
        nodeId
      )
    ];
  }

  function resolveUniformScaleFactor(
    origin: readonly [number, number],
    point: readonly [number, number],
    nodeId: NodeId
  ): number {
    resolveScalePointerOffsets(origin, point, nodeId);
    const originDistance = transformOriginOffset.length();

    if (originDistance <= SCALE_ORIGIN_EPSILON) {
      throw new Error(
        `Canvas3D uniform scale origin is degenerate: ${nodeId}`
      );
    }

    const factor = transformPointOffset.length() / originDistance;

    if (!Number.isFinite(factor)) {
      throw new Error(`Canvas3D uniform scale is not finite: ${nodeId}`);
    }

    return factor;
  }

  function resolveScalePointerOffsets(
    origin: readonly [number, number],
    point: readonly [number, number],
    nodeId: NodeId
  ) {
    const { height, width } = getCanvasViewport();

    if (width <= 0 || height <= 0) {
      throw new Error(`Canvas3D scale viewport is unavailable: ${nodeId}`);
    }

    transformScreenOrigin.copy(transformPlanePoint).project(camera);

    if (
      !Number.isFinite(transformScreenOrigin.x) ||
      !Number.isFinite(transformScreenOrigin.y)
    ) {
      throw new Error(`Canvas3D scale center cannot be projected: ${nodeId}`);
    }

    transformProjectedCenter.set(
      ((transformScreenOrigin.x + 1) * width) / 2,
      ((1 - transformScreenOrigin.y) * height) / 2
    );
    transformOriginOffset.set(
      origin[0] - transformProjectedCenter.x,
      origin[1] - transformProjectedCenter.y
    );
    transformPointOffset.set(
      point[0] - transformProjectedCenter.x,
      point[1] - transformProjectedCenter.y
    );
  }

  function projectScaleAxis(
    axis: CanvasNodeRotationAxis,
    targetVector: Vector2,
    nodeId: NodeId
  ) {
    const { height, width } = getCanvasViewport();
    setTransformAxis(axis);
    transformAxis.applyQuaternion(transformScaleBasisQuaternion).normalize();
    transformScreenOrigin.copy(transformPlanePoint).project(camera);
    transformScreenEnd
      .copy(transformPlanePoint)
      .add(transformAxis)
      .project(camera);
    targetVector.set(
      ((transformScreenEnd.x - transformScreenOrigin.x) * width) / 2,
      (-transformScreenEnd.y + transformScreenOrigin.y) * (height / 2)
    );

    if (!Number.isFinite(targetVector.x) || !Number.isFinite(targetVector.y)) {
      throw new Error(
        `Canvas3D ${axis}-axis scale cannot be projected: ${nodeId}`
      );
    }
  }

  function setTransformAxis(axis: CanvasNodeRotationAxis) {
    switch (axis) {
      case "x":
        transformAxis.set(1, 0, 0);
        break;
      case "y":
        transformAxis.set(0, 1, 0);
        break;
      case "z":
        transformAxis.set(0, 0, 1);
        break;
      default: {
        const exhaustive: never = axis;
        throw new Error(`Unsupported Canvas3D transform axis: ${exhaustive}`);
      }
    }
  }

  function getCanvasViewport() {
    const rect = resolved.canvas.getBoundingClientRect();
    return {
      height: rect.height || resizeState.height,
      width: rect.width || resizeState.width
    };
  }

  function intersectTransformPlane(
    point: readonly [number, number],
    targetVector: Vector3
  ): Vector3 | null {
    const { height, width } = getCanvasViewport();

    if (width <= 0 || height <= 0) {
      return null;
    }

    transformPointer.set(
      (point[0] / width) * 2 - 1,
      -(point[1] / height) * 2 + 1
    );
    transformRaycaster.setFromCamera(transformPointer, camera);
    return transformRaycaster.ray.intersectPlane(transformPlane, targetVector);
  }

  function hitTestTransformHandle(
    input: CanvasHitTestInput
  ): CanvasHitResult | null {
    if (!transformHandles.visible || !transformHandleTarget) {
      return null;
    }

    const { height, width } = getCanvasViewport();

    if (width <= 0 || height <= 0) {
      return null;
    }

    transformPointer.set(
      (input.point[0] / width) * 2 - 1,
      -(input.point[1] / height) * 2 + 1
    );
    transformRaycaster.setFromCamera(transformPointer, camera);

    for (const intersection of transformRaycaster.intersectObjects(
      transformHandles.children,
      true
    )) {
      if (!intersection.object.visible) {
        continue;
      }

      const handleId = CanvasNodeTransformHandleIdSchema.parse(
        intersection.object.userData[TRANSFORM_HANDLE_ID_USER_DATA_KEY]
      );

      if (
        getTransformKindForHandle(handleId) === transformHandleTarget.kind
      ) {
        return {
          kind: "handle",
          nodeId: transformHandleTarget.nodeId,
          point: input.point,
          renderer: "three",
          subTarget: handleId
        };
      }
    }

    return null;
  }

  function syncTransformHandles() {
    if (!transformHandleTarget) {
      transformHandles.visible = false;
      return;
    }

    const node = currentScene.nodes.find(
      (candidate) => candidate.id === transformHandleTarget?.nodeId
    );

    if (!node) {
      throw new Error(
        `Canvas3D transform handle node was not found: ${transformHandleTarget.nodeId}`
      );
    }

    assertCanvas3DTransformNode(node);
    const nodeState = nodeStates.get(node.id);

    if (!nodeState) {
      throw new Error(`Canvas3D transform state was not found: ${node.id}`);
    }

    if (!nodeState.visible || nodeState.locked) {
      transformHandles.visible = false;
      return;
    }

    const object = objects.get(node.id);

    if (!object) {
      throw new Error(
        `Canvas3D transform handle object was not found: ${node.id}`
      );
    }

    scene.updateMatrixWorld(true);
    object.getWorldPosition(transformHandles.position);

    if (transformHandleTarget.kind === "scale") {
      object.getWorldQuaternion(transformHandles.quaternion);
    } else {
      transformHandles.quaternion.identity();
    }

    camera.updateMatrixWorld(true);
    const { height } = getCanvasViewport();

    if (height <= 0) {
      throw new Error(
        `Canvas3D transform viewport is unavailable: ${transformHandleTarget.nodeId}`
      );
    }

    const worldViewportHeight =
      2 *
      camera.position.distanceTo(transformHandles.position) *
      Math.tan((camera.fov * Math.PI) / 360);
    const scale = (worldViewportHeight * 72) / height;

    if (!Number.isFinite(scale) || scale <= 0) {
      throw new Error(
        `Canvas3D transform handle scale is invalid: ${transformHandleTarget.nodeId}`
      );
    }

    transformHandles.scale.setScalar(scale);
    syncTransformHandleVisibility(
      transformHandles,
      transformHandleTarget.kind
    );
    transformHandles.visible = true;
  }

  function setNodeTransformHandleTarget(
    targetValue: CanvasNodeTransformHandleTarget | null
  ) {
    const nextTarget =
      targetValue === null
        ? null
        : CanvasNodeTransformHandleTargetSchema.parse(targetValue);

    if (nextTarget) {
      const node = currentScene.nodes.find(
        (candidate) => candidate.id === nextTarget.nodeId
      );

      if (!node) {
        throw new Error(
          `Canvas3D transform handle node was not found: ${nextTarget.nodeId}`
        );
      }

      assertCanvas3DTransformNode(node);
      assertCanvas3DNodeTransformable(node, nodeStates);

      syncTransformHandleColors(transformHandles, resolved.canvas);
    }

    transformHandleTarget = nextTarget;
    render();
  }

  function clearNodeTransformPreview() {
    if (!transformPreview) {
      return;
    }

    const node = currentScene.nodes.find(
      (candidate) => candidate.id === transformPreview?.nodeId
    );
    const object = objects.get(transformPreview.nodeId);

    if (node && isCanvas3DTransformNode(node) && object) {
      setVector(object.position, node.position);
      setEuler(object.rotation, node.rotation);
      setVector(object.scale, node.scale);
    }

    transformPreview = null;
    syncTransformHandles();
  }

  function setNodeTransformPreview(
    previewValue: CanvasNodeTransformPreviewForMode<"3d"> | null
  ) {
    if (previewValue === null) {
      clearNodeTransformPreview();
      render();
      return;
    }

    const preview = CanvasNodeTransformPreviewSchema.parse(previewValue);
    const node = currentScene.nodes.find(
      (candidate) => candidate.id === preview.nodeId
    );
    const object = objects.get(preview.nodeId);

    if (preview.mode !== "3d" || !node || !object) {
      throw new Error(`Canvas3D transform preview is invalid: ${preview.nodeId}`);
    }

    assertCanvas3DTransformNode(node);
    assertCanvas3DNodeTransformable(node, nodeStates);

    clearNodeTransformPreview();

    switch (preview.kind) {
      case "translate":
        setVector(object.position, preview.position);
        break;
      case "rotate":
        setEuler(object.rotation, preview.rotation);
        break;
      case "scale":
        setVector(object.scale, preview.scale);
        break;
      default: {
        const exhaustive: never = preview;
        throw new Error(
          `Unsupported Canvas3D transform preview: ${JSON.stringify(exhaustive)}`
        );
      }
    }

    transformPreview = preview;
    render();
  }

  function resolveScenePoint(
    requestValue: CanvasScenePointRequestFor<"3d">
  ): CanvasScenePointResultFor<"3d"> {
    const request = CanvasScenePointRequestSchema.parse(requestValue);

    if (request.mode !== "3d") {
      throw new Error(
        "Canvas3D cannot resolve a 2D scene point or omit a work plane."
      );
    }

    const { height, width } = getCanvasViewport();

    if (width <= 0 || height <= 0) {
      throw new Error("Canvas3D scene-point viewport is unavailable.");
    }

    scenePointPointer.set(
      (request.viewportPoint[0] / width) * 2 - 1,
      1 - (request.viewportPoint[1] / height) * 2
    );
    camera.updateMatrixWorld(true);
    scenePointRaycaster.setFromCamera(scenePointPointer, camera);
    setCanvas3DWorkPlane(
      scenePointPlane,
      request.workPlane.normal,
      request.workPlane.constant
    );

    const directionDotNormal = scenePointPlane.normal.dot(
      scenePointRaycaster.ray.direction
    );

    if (Math.abs(directionDotNormal) <= SCENE_POINT_PLANE_EPSILON) {
      throw new Error(
        "Canvas3D scene-point ray is parallel to the requested work plane."
      );
    }

    const intersection = scenePointRaycaster.ray.intersectPlane(
      scenePointPlane,
      scenePointIntersection
    );

    if (!intersection) {
      throw new Error(
        "Canvas3D scene-point ray does not intersect the requested work plane."
      );
    }

    const result = CanvasScenePointResultSchema.parse({
      mode: "3d",
      position: [intersection.x, intersection.y, intersection.z]
    });

    if (result.mode !== "3d") {
      throw new Error("Canvas3D scene-point validation returned the wrong mode.");
    }

    return result;
  }

  function resolveSurfacePoint(
    requestValue: Canvas3DSurfacePointRequest
  ): Canvas3DSurfacePointResult {
    const request = Canvas3DSurfacePointRequestSchema.parse(requestValue);
    const { height, width } = getCanvasViewport();

    if (width <= 0 || height <= 0) {
      throw new Error("Canvas3D surface-point viewport is unavailable.");
    }

    if (
      request.viewportPoint[0] < 0 ||
      request.viewportPoint[1] < 0 ||
      request.viewportPoint[0] > width ||
      request.viewportPoint[1] > height
    ) {
      return Canvas3DSurfacePointResultSchema.parse({
        kind: "miss",
        mode: "3d"
      });
    }

    surfacePointPointer.set(
      (request.viewportPoint[0] / width) * 2 - 1,
      1 - (request.viewportPoint[1] / height) * 2
    );
    camera.updateMatrixWorld(true);
    scene.updateMatrixWorld(true);
    surfacePointRaycaster.setFromCamera(surfacePointPointer, camera);

    for (const intersection of surfacePointRaycaster.intersectObjects(
      hitTestObjects,
      true
    )) {
      const nodeId = findCanvas3DNodeId(intersection.object);

      if (!nodeId) {
        continue;
      }

      const node = currentScene.nodes.find((candidate) => candidate.id === nodeId);

      if (!node) {
        throw new Error(`Canvas3D surface-point node was not found: ${nodeId}`);
      }

      if (node.type !== request.target.nodeType) {
        return Canvas3DSurfacePointResultSchema.parse({
          kind: "miss",
          mode: "3d"
        });
      }

      const object = objects.get(node.id);

      if (!object) {
        throw new Error(
          `Canvas3D surface-point object was not found: ${node.id}`
        );
      }

      const surface = intersectThreeUnitBoxSurface(
        surfacePointRaycaster.ray,
        object.matrixWorld
      );

      if (!surface) {
        throw new Error(
          `Canvas3D box raycast and analytic surface disagree: ${node.id}`
        );
      }

      return Canvas3DSurfacePointResultSchema.parse({
        ...surface,
        kind: "hit",
        mode: "3d",
        nodeId: node.id,
        nodeType: "box"
      });
    }

    return Canvas3DSurfacePointResultSchema.parse({
      kind: "miss",
      mode: "3d"
    });
  }

  function setAuthoringPreviews(
    previewsValue: readonly CanvasAuthoringPreviewForMode<"3d">[]
  ): void {
    const nextPreviews = previewsValue.map((previewValue) => {
      const preview = CanvasAuthoringPreviewSchema.parse(previewValue);

      if (preview.mode !== "3d") {
        throw new Error(
          `Canvas3D cannot render a ${preview.mode} authoring preview: ${preview.kind}`
        );
      }

      validateCanvas3DAuthoringPreview(preview, currentScene);
      return preview;
    });

    scene.updateMatrixWorld(true);
    const nextRoot = createCanvas3DAuthoringPreviewGroup(
      nextPreviews,
      currentScene,
      objects,
      contentColors
    );
    disposeGroup(authoringPreviewRoot);

    for (const child of [...nextRoot.children]) {
      authoringPreviewRoot.add(child);
    }

    render();
  }

  function clearAuthoringPreviews() {
    disposeGroup(authoringPreviewRoot);
  }

  function setNavigationInputEnabled(enabled: boolean) {
    if (controls) {
      controls.enabled = controlsEnabledByConfig && enabled;
    }
  }

  function loop(time: number) {
    const delta = previousTime === 0 ? 0 : time - previousTime;
    previousTime = time;

    runtime.render();
    options.onFrame?.(
      {
        delta,
        elapsed: time,
        scene: currentScene,
        render: captureRenderStats()
      },
      runtime
    );

    if (
      currentScene.render.loop === "always" &&
      store.getState().status === "running"
    ) {
      frameId = requestAnimationFrame(loop);
    } else {
      frameId = null;
    }
  }

  function start() {
    if (store.getState().status === "running") {
      return;
    }

    store.getState().setStatus("running");
    previousTime = 0;

    if (currentScene.render.loop === "always") {
      frameId = requestAnimationFrame(loop);
      return;
    }

    runtime.render();
  }

  function stop() {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }

    if (store.getState().status !== "destroyed") {
      store.getState().setStatus("idle");
    }
  }

  function resize() {
    const rect = getRenderRect(resolved.canvas, resolved.host);
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const pixelRatio = options.devicePixelRatio ?? currentScene.render.dpr;

    if (
      resizeState.width !== width ||
      resizeState.height !== height ||
      resizeState.pixelRatio !== pixelRatio
    ) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      resizeState = {
        height,
        pixelRatio,
        width
      };
    }

    render();
  }

  function destroy() {
    runtime.stop();
    store.getState().setStatus("destroyed");
    resizeScheduler.cancel();
    resizeObserver.disconnect();
    controls?.removeEventListener("change", render);
    controls?.dispose();
    clearAuthoringPreviews();
    transformPreview = null;
    transformHandleTarget = null;
    disposeGroup(content);
    disposeGroup(transformHandles);
    objects.clear();
    hitTestObjects.length = 0;
    nodeStates.clear();
    scene.remove(authoringPreviewRoot);
    scene.remove(transformHandles);
    renderer.dispose();

    if (resolved.removeOnDestroy) {
      resolved.canvas.remove();
    }
  }

  runtime = {
    get canvas() {
      return resolved.canvas;
    },
    get mode() {
      return "3d" as const;
    },
    get navigationInputEnabled() {
      return controls?.enabled ?? false;
    },
    navigationInputSupported: true,
    nodeTransformKinds: CANVAS_3D_NODE_TRANSFORM_KINDS,
    camera,
    controls,
    objects,
    ready: Promise.resolve(),
    renderer,
    scene,
    store,
    destroy,
    getScene: () => currentScene,
    getRenderStats: (): CanvasRenderStats | undefined => captureRenderStats(),
    hitTest,
    render,
    resolveNodeTransform,
    resolveScenePoint,
    resolveSurfacePoint,
    resize,
    setNavigationInputEnabled,
    setAuthoringPreviews,
    setNodeTransformHandleTarget,
    setNodeTransformPreview,
    start,
    stop,
    update
  };

  resizeObserver.observe(resolved.host);
  controls?.addEventListener("change", render);
  applyScene(
    currentScene,
    scene,
    camera,
    content,
    objects,
    hitTestObjects,
    nodeStates,
    contentColors,
    prevNodesById
  );
  syncCameraControls(controls, currentScene);
  runtime.resize();
  runtime.render();

  if (options.autoStart ?? true) {
    runtime.start();
  }

  return runtime;
}

function resolveProjectedCoordinates(
  offset: Vector2,
  firstAxis: Vector2,
  secondAxis: Vector2,
  firstSquaredLength: number,
  secondSquaredLength: number,
  crossTerm: number,
  determinant: number
): readonly [number, number] {
  const firstProjection = offset.dot(firstAxis);
  const secondProjection = offset.dot(secondAxis);
  return [
    (secondSquaredLength * firstProjection -
      crossTerm * secondProjection) /
      determinant,
    (firstSquaredLength * secondProjection - crossTerm * firstProjection) /
      determinant
  ];
}

function resolveScaleFactor(
  originCoordinate: number,
  pointCoordinate: number,
  label: string,
  nodeId: NodeId
): number {
  if (Math.abs(originCoordinate) <= SCALE_ORIGIN_EPSILON) {
    throw new Error(
      `Canvas3D ${label} scale origin is degenerate: ${nodeId}`
    );
  }

  const factor = pointCoordinate / originCoordinate;

  if (!Number.isFinite(factor)) {
    throw new Error(`Canvas3D ${label} scale is not finite: ${nodeId}`);
  }

  return factor;
}

function createCameraControls(
  camera: PerspectiveCamera,
  canvas: HTMLCanvasElement,
  scene: Canvas3DScene,
  input: CanvasCameraControlsInput | undefined
): OrbitControls | null {
  if (input === false) {
    return null;
  }

  const options = typeof input === "object" ? input : {};
  const controls = new OrbitControls(camera, canvas);
  controls.enabled = options.enabled ?? true;
  controls.enablePan = options.enablePan ?? true;
  controls.enableRotate = options.enableRotate ?? true;
  controls.enableZoom = options.enableZoom ?? true;
  controls.maxDistance = options.maxDistance ?? Infinity;
  controls.minDistance = options.minDistance ?? 0;
  controls.target.set(...scene.camera.target);
  controls.update();
  return controls;
}

function syncCameraControls(
  controls: OrbitControls | null,
  scene: Canvas3DScene
) {
  if (!controls) {
    return;
  }

  controls.target.set(...scene.camera.target);
  controls.update();
}

function applyScene(
  sceneData: Canvas3DScene,
  scene: Scene,
  camera: PerspectiveCamera,
  content: Group,
  objects: Map<string, Object3D>,
  hitTestObjects: Object3D[],
  nodeStates: Map<NodeId, Canvas3DNodeState>,
  colors: Canvas3DContentColors,
  prevNodesById: Map<string, Canvas3DNode>
) {
  const nextContent = new Group();
  const nextObjects = new Map<string, Object3D>();
  const nextHitTestObjects: Object3D[] = [];
  const nextNodeStates = new Map<NodeId, Canvas3DNodeState>();
  resolveCanvas3DNodeStates(sceneData, nextNodeStates);

  const batchedNodeIds = new Set<string>();

  // Optional draw-call batching: collapse same-color top-level box nodes into
  // one InstancedMesh per color. Only top-level (parentId === null) boxes are
  // batched so hierarchy and per-node transforms on nested nodes are
  // unaffected. Hit testing resolves back to nodes via INSTANCE_NODE_IDS.
  if (sceneData.render.batch) {
    const boxesByColor = new Map<string, BatchedBoxEntry[]>();

    for (const node of sceneData.nodes) {
      if (node.parentId !== null || node.type !== "box") {
        continue;
      }

      const entry = boxEntryFromNode(node);
      const entries = boxesByColor.get(entry.color);

      if (entries) {
        entries.push(entry);
      } else {
        boxesByColor.set(entry.color, [entry]);
      }
    }

    for (const entries of boxesByColor.values()) {
      if (entries.length < 2) {
        continue;
      }

      const mesh = createBatchedBoxMesh(entries);
      mesh.name = `denovo-batch:${entries[0]!.color}`;
      mesh.visible = true;
      nextContent.add(mesh);
      nextHitTestObjects.push(mesh);

      for (const entry of entries) {
        batchedNodeIds.add(entry.id);
      }
    }
  }

  try {
    for (const node of sceneData.nodes) {
      if (batchedNodeIds.has(node.id)) {
        continue;
      }

      const nodeState = nextNodeStates.get(node.id);

      if (!nodeState) {
        throw new Error(`Canvas3D node state was not resolved: ${node.id}`);
      }

      const prevNode = prevNodesById.get(node.id);
      const reusedObject =
        prevNode && canvas3DNodeEqual(prevNode, node)
          ? objects.get(node.id)
          : undefined;
      const object = reusedObject ?? createObject(node, colors);

      if (reusedObject) {
        // Mark as reused so it is not disposed with removed nodes below.
        objects.delete(node.id);
      }

      object.userData[NODE_ID_USER_DATA_KEY] = node.id;
      object.name = `denovo-node:${node.id}`;
      object.visible = nodeState.visible;

      if (isCanvas3DTransformNode(node)) {
        applyCanvas3DNodeTransform(object, node);
      }

      nextContent.add(object);
      nextObjects.set(node.id, object);

      if (isCanvas3DDrawableNode(node) && nodeState.visible) {
        nextHitTestObjects.push(object);
      }
    }

    for (const node of sceneData.nodes) {
      if (node.parentId === null) {
        continue;
      }

      const object = nextObjects.get(node.id);
      const parentObject = nextObjects.get(node.parentId);

      if (!object) {
        throw new Error(`Canvas3D node object was not created: ${node.id}`);
      }

      if (!parentObject) {
        throw new Error(
          `Canvas3D parent object was not created: ${node.parentId}`
        );
      }

      parentObject.add(object);
    }

    nextContent.updateMatrixWorld(true);

    for (const node of sceneData.nodes) {
      if (node.type !== "measurement") {
        continue;
      }

      const object = nextObjects.get(node.id);

      if (!(object instanceof Group)) {
        throw new Error(`Canvas3D measurement object is invalid: ${node.id}`);
      }

      addMeasurementLabel(object, node, colors);
    }

    nextContent.traverse((descendant) => {
      descendant.frustumCulled = sceneData.render.frustumCulling;
    });
  } catch (cause) {
    disposeGroup(nextContent);
    throw cause;
  }

  disposeGroup(content);

  for (const child of [...nextContent.children]) {
    content.add(child);
  }

  objects.clear();

  for (const [nodeId, object] of nextObjects) {
    objects.set(nodeId, object);
  }

  hitTestObjects.splice(0, hitTestObjects.length, ...nextHitTestObjects);
  nodeStates.clear();

  for (const [nodeId, state] of nextNodeStates) {
    nodeStates.set(nodeId, state);
  }

  prevNodesById.clear();

  for (const node of sceneData.nodes) {
    prevNodesById.set(node.id, node);
  }

  scene.background = new Color(sceneData.background);
  setVector(camera.position, sceneData.camera.position);
  camera.fov = sceneData.camera.fov;
  camera.lookAt(new Vector3(...sceneData.camera.target));
  camera.updateProjectionMatrix();
}

function resolveCanvas3DNodeStates(
  scene: Canvas3DScene,
  nodeStates: Map<NodeId, Canvas3DNodeState>
) {
  const layersById = new Map(scene.layers.map((layer) => [layer.id, layer]));
  const nodesById = new Map(scene.nodes.map((node) => [node.id, node]));
  const resolving = new Set<NodeId>();

  function resolveNodeState(node: Canvas3DNode): Canvas3DNodeState {
    const existing = nodeStates.get(node.id);

    if (existing) {
      return existing;
    }

    if (resolving.has(node.id)) {
      throw new Error(`Canvas3D parent cycle reached the renderer: ${node.id}`);
    }

    const layer = layersById.get(node.layerId);

    if (!layer) {
      throw new Error(`Canvas3D layer was not found: ${node.layerId}`);
    }

    resolving.add(node.id);
    let ancestorLocked = false;
    let ancestorVisible = true;

    if (node.parentId !== null) {
      const parent = nodesById.get(node.parentId);

      if (!parent || parent.type !== "group") {
        throw new Error(`Canvas3D group parent was not found: ${node.parentId}`);
      }

      const parentState = resolveNodeState(parent);
      ancestorLocked = parentState.locked;
      ancestorVisible = parentState.visible;
    }

    const state = {
      locked: layer.locked || ancestorLocked || node.locked,
      visible: layer.visible && ancestorVisible && node.visible
    } satisfies Canvas3DNodeState;
    resolving.delete(node.id);
    nodeStates.set(node.id, state);
    return state;
  }

  for (const node of scene.nodes) {
    resolveNodeState(node);
  }
}

function resolveCanvas3DContentColors(
  canvas: HTMLCanvasElement
): Canvas3DContentColors {
  return {
    accent: resolveCanvasCssColor(canvas, "--_dc-selection", "#38bdf8"),
    foreground: resolveCanvasCssColor(canvas, "--_dc-foreground", "#f8fafc")
  };
}

function validateCanvas3DAuthoringPreview(
  preview: CanvasAuthoringPreviewForMode<"3d">,
  scene: Canvas3DScene
) {
  const nodesById = new Map(scene.nodes.map((node) => [node.id, node]));

  if (preview.kind === "node") {
    const layer = scene.layers.find(
      (candidate) => candidate.id === preview.node.layerId
    );

    if (!layer) {
      throw new Error(
        `Canvas3D authoring preview layer was not found: ${preview.node.layerId}`
      );
    }

    if (preview.node.parentId !== null) {
      if (preview.node.parentId === preview.node.id) {
        throw new Error(
          `Canvas3D authoring preview cannot parent itself: ${preview.node.id}`
        );
      }

      const parent = nodesById.get(preview.node.parentId);

      if (!parent || parent.type !== "group") {
        throw new Error(
          `Canvas3D authoring preview requires group parent: ${preview.node.parentId}`
        );
      }

      if (parent.layerId !== preview.node.layerId) {
        throw new Error(
          `Canvas3D authoring preview cannot cross layers: ${preview.node.id}`
        );
      }
    }

    if (
      preview.node.type === "annotation" &&
      preview.node.targetId !== null &&
      !nodesById.has(preview.node.targetId)
    ) {
      throw new Error(
        `Canvas3D annotation preview target was not found: ${preview.node.targetId}`
      );
    }

    return;
  }

  if (
    preview.kind === "annotation.draft" &&
    preview.targetId !== null &&
    !nodesById.has(preview.targetId)
  ) {
    throw new Error(
      `Canvas3D annotation preview target was not found: ${preview.targetId}`
    );
  }
}

function createCanvas3DAuthoringPreviewGroup(
  previews: readonly CanvasAuthoringPreviewForMode<"3d">[],
  scene: Canvas3DScene,
  objects: ReadonlyMap<string, Object3D>,
  colors: Canvas3DContentColors
): Group {
  const root = new Group();
  root.name = "denovo-next-authoring-previews";

  try {
    for (const preview of previews) {
      switch (preview.kind) {
        case "node":
          root.add(
            createCanvas3DNodeAuthoringPreview(
              preview.node,
              scene,
              objects,
              colors
            )
          );
          break;
        case "measurement": {
          const measurement = createMeasurementSegmentObject(
            preview.start,
            preview.end,
            colors.accent
          );
          setAuthoringPreviewOpacity(
            measurement,
            AUTHORING_MEASUREMENT_OPACITY
          );
          root.add(measurement);
          break;
        }
        case "annotation.anchor":
          root.add(createAuthoringAnchorMarker(preview.anchor, colors.accent));
          break;
        case "annotation.draft":
          root.add(
            createAnnotationDraftPreview(
              preview.anchor,
              preview.text,
              colors
            )
          );
          break;
        case "grid":
          root.add(createAuthoringGridPreview(preview.grid, colors.accent));
          break;
        case "grid.snap":
          root.add(createAuthoringSnapMarker(preview.position, colors.accent));
          break;
        case "primitive.ghost":
          root.add(createCanvas3DPrimitiveGhost(preview.primitive));
          break;
        default: {
          const exhaustive: never = preview;
          return exhaustive;
        }
      }
    }
  } catch (cause) {
    disposeGroup(root);
    throw cause;
  }

  return root;
}

function createCanvas3DPrimitiveGhost(
  primitive: Extract<
    CanvasAuthoringPreviewForMode<"3d">,
    { kind: "primitive.ghost" }
  >["primitive"]
): Mesh {
  const object = new Mesh(
    new BoxGeometry(1, 1, 1),
    createCanvas3DSurfaceMaterial(primitive.color)
  );
  setVector(object.position, primitive.position);
  setEuler(object.rotation, primitive.rotation);
  setVector(object.scale, primitive.scale);
  setAuthoringPreviewOpacity(object, AUTHORING_NODE_OPACITY);
  return object;
}

function createCanvas3DNodeAuthoringPreview(
  node: Canvas3DNode,
  scene: Canvas3DScene,
  objects: ReadonlyMap<string, Object3D>,
  colors: Canvas3DContentColors
): Group {
  const container = new Group();
  const object = createObject(node, colors);

  try {
    object.name = `denovo-node-preview:${node.id}`;
    object.visible = node.visible;

    if (isCanvas3DTransformNode(node)) {
      applyCanvas3DNodeTransform(object, node);
    }

    if (node.parentId === null) {
      container.add(object);
    } else {
      const parentObject = objects.get(node.parentId);

      if (!parentObject) {
        throw new Error(
          `Canvas3D authoring preview parent object was not found: ${node.parentId}`
        );
      }

      const parentTransform = new Group();
      parentTransform.matrixAutoUpdate = false;
      parentTransform.matrix.copy(parentObject.matrixWorld);
      parentTransform.matrixWorldNeedsUpdate = true;
      parentTransform.add(object);
      container.add(parentTransform);
    }

    container.updateMatrixWorld(true);

    if (node.type === "measurement") {
      if (!(object instanceof Group)) {
        throw new Error(`Canvas3D measurement preview is invalid: ${node.id}`);
      }

      addMeasurementLabel(object, node, colors);
    }

    container.traverse((descendant) => {
      descendant.frustumCulled = scene.render.frustumCulling;
    });
    setAuthoringPreviewOpacity(container, AUTHORING_NODE_OPACITY);
    return container;
  } catch (cause) {
    if (!object.parent) {
      container.add(object);
    }

    disposeGroup(container);
    throw cause;
  }
}

function createAuthoringAnchorMarker(
  anchor: readonly [number, number, number],
  color: string
): Mesh {
  const marker = new Mesh(
    new SphereGeometry(ANNOTATION_ANCHOR_RADIUS, 20, 12),
    new MeshBasicMaterial({
      color,
      depthWrite: false,
      opacity: AUTHORING_MEASUREMENT_OPACITY,
      transparent: true
    })
  );
  marker.position.set(...anchor);
  return marker;
}

function createAnnotationDraftPreview(
  anchor: readonly [number, number, number],
  text: string,
  colors: Canvas3DContentColors
): Group {
  const object = new Group();
  object.add(createAuthoringAnchorMarker(anchor, colors.accent));

  try {
    const label = createTextSprite(
      text,
      colors.foreground,
      colors.accent,
      "annotation.text"
    );
    label.position.set(anchor[0] + 0.24, anchor[1] + 0.18, anchor[2]);
    label.material.depthWrite = false;
    label.material.opacity = AUTHORING_MEASUREMENT_OPACITY;
    object.add(label);
    return object;
  } catch (cause) {
    disposeGroup(object);
    throw cause;
  }
}

function createAuthoringGridPreview(
  grid: Extract<
    CanvasAuthoringPreviewForMode<"3d">,
    { kind: "grid" }
  >["grid"],
  color: string
): LineSegments {
  const uSteps = Math.floor(AUTHORING_GRID_HALF_EXTENT / grid.spacing[0]);
  const vSteps = Math.floor(AUTHORING_GRID_HALF_EXTENT / grid.spacing[1]);

  if (!Number.isSafeInteger(uSteps) || !Number.isSafeInteger(vSteps)) {
    throw new Error(
      `Canvas3D grid preview exceeds the explicit ${AUTHORING_GRID_LINE_LIMIT}-line limit.`
    );
  }

  const lineCount = uSteps * 2 + 1 + (vSteps * 2 + 1);

  if (lineCount > AUTHORING_GRID_LINE_LIMIT) {
    throw new Error(
      `Canvas3D grid preview exceeds the explicit ${AUTHORING_GRID_LINE_LIMIT}-line limit.`
    );
  }

  const origin = new Vector3(...grid.origin);
  const axisU = normalizeCanvas3DDirection(grid.axisU, "grid axisU");
  const axisV = normalizeCanvas3DDirection(grid.axisV, "grid axisV");
  const points: Vector3[] = [];

  for (let index = -uSteps; index <= uSteps; index += 1) {
    const offset = axisU.clone().multiplyScalar(index * grid.spacing[0]);
    appendFiniteGridLine(
      points,
      origin
        .clone()
        .add(offset)
        .addScaledVector(axisV, -AUTHORING_GRID_HALF_EXTENT),
      origin
        .clone()
        .add(offset)
        .addScaledVector(axisV, AUTHORING_GRID_HALF_EXTENT)
    );
  }

  for (let index = -vSteps; index <= vSteps; index += 1) {
    const offset = axisV.clone().multiplyScalar(index * grid.spacing[1]);
    appendFiniteGridLine(
      points,
      origin
        .clone()
        .add(offset)
        .addScaledVector(axisU, -AUTHORING_GRID_HALF_EXTENT),
      origin
        .clone()
        .add(offset)
        .addScaledVector(axisU, AUTHORING_GRID_HALF_EXTENT)
    );
  }

  return new LineSegments(
    new BufferGeometry().setFromPoints(points),
    new LineBasicMaterial({
      color,
      depthTest: true,
      depthWrite: false,
      opacity: 0.28,
      transparent: true
    })
  );
}

function appendFiniteGridLine(
  points: Vector3[],
  start: Vector3,
  end: Vector3
) {
  if (
    ![start.x, start.y, start.z, end.x, end.y, end.z].every(Number.isFinite)
  ) {
    throw new Error("Canvas3D grid preview produced non-finite geometry.");
  }

  points.push(start, end);
}

function normalizeCanvas3DDirection(
  direction: readonly [number, number, number],
  label: string
): Vector3 {
  const maximumComponent = Math.max(
    Math.abs(direction[0]),
    Math.abs(direction[1]),
    Math.abs(direction[2])
  );

  if (!Number.isFinite(maximumComponent) || maximumComponent === 0) {
    throw new Error(`Canvas3D ${label} is not a finite non-zero direction.`);
  }

  const normalized = new Vector3(
    direction[0] / maximumComponent,
    direction[1] / maximumComponent,
    direction[2] / maximumComponent
  );
  const length = normalized.length();

  if (!Number.isFinite(length) || length === 0) {
    throw new Error(`Canvas3D ${label} cannot be normalized.`);
  }

  return normalized.divideScalar(length);
}

function setCanvas3DWorkPlane(
  target: Plane,
  normal: readonly [number, number, number],
  constant: number
) {
  const maximumComponent = Math.max(
    Math.abs(normal[0]),
    Math.abs(normal[1]),
    Math.abs(normal[2])
  );

  if (!Number.isFinite(maximumComponent) || maximumComponent === 0) {
    throw new Error("Canvas3D work-plane normal is not finite and non-zero.");
  }

  target.normal.set(
    normal[0] / maximumComponent,
    normal[1] / maximumComponent,
    normal[2] / maximumComponent
  );
  const scaledLength = target.normal.length();

  if (!Number.isFinite(scaledLength) || scaledLength === 0) {
    throw new Error("Canvas3D work-plane normal cannot be normalized.");
  }

  const normalizedConstant = constant / maximumComponent / scaledLength;

  if (!Number.isFinite(normalizedConstant)) {
    throw new Error("Canvas3D work plane lies outside renderer capacity.");
  }

  target.normal.divideScalar(scaledLength);
  target.constant = normalizedConstant;
}

function createAuthoringSnapMarker(
  position: readonly [number, number, number],
  color: string
): Mesh {
  const marker = new Mesh(
    new SphereGeometry(AUTHORING_SNAP_MARKER_RADIUS, 16, 10),
    new MeshBasicMaterial({
      color,
      depthWrite: false,
      wireframe: true
    })
  );
  marker.position.set(...position);
  return marker;
}

function setAuthoringPreviewOpacity(object: Object3D, opacity: number) {
  object.traverse((descendant) => {
    if (descendant instanceof Mesh) {
      const materials = Array.isArray(descendant.material)
        ? descendant.material
        : [descendant.material];

      for (const material of materials) {
        material.depthWrite = false;
        material.opacity = opacity;
        material.transparent = true;
      }
    } else if (descendant instanceof Sprite) {
      descendant.material.depthWrite = false;
      descendant.material.opacity = opacity;
      descendant.material.transparent = true;
    }
  });
}

function isCanvas3DTransformNode(
  node: Canvas3DNode
): node is Canvas3DTransformNode {
  switch (node.type) {
    case "box":
    case "sphere":
    case "mesh":
    case "instances":
    case "group":
      return true;
    case "measurement":
    case "annotation":
      return false;
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
}

function isCanvas3DDrawableNode(
  node: Canvas3DNode
): node is Canvas3DDrawableNode {
  return node.type !== "group";
}

function assertCanvas3DTransformNode(
  node: Canvas3DNode
): asserts node is Canvas3DTransformNode {
  if (!isCanvas3DTransformNode(node)) {
    throw new Error(
      `Canvas3D transforms do not support ${node.type} nodes: ${node.id}`
    );
  }
}

function assertCanvas3DNodeTransformable(
  node: Canvas3DTransformNode,
  nodeStates: ReadonlyMap<NodeId, Canvas3DNodeState>
) {
  const nodeState = nodeStates.get(node.id);

  if (!nodeState) {
    throw new Error(`Canvas3D transform state was not found: ${node.id}`);
  }

  if (!nodeState.visible) {
    throw new Error(`Canvas3D cannot transform a hidden node: ${node.id}`);
  }

  if (nodeState.locked) {
    throw new Error(`Canvas3D cannot transform a locked node: ${node.id}`);
  }
}

function applyCanvas3DNodeTransform(
  object: Object3D,
  node: Canvas3DTransformNode
) {
  setVector(object.position, node.position);
  setEuler(object.rotation, node.rotation);
  setVector(object.scale, node.scale);
}

function getObjectNodeId(object: Object3D): NodeId | undefined {
  const nodeId = object.userData[NODE_ID_USER_DATA_KEY];
  return typeof nodeId === "string" && nodeId.length > 0 ? nodeId : undefined;
}

function findCanvas3DNodeId(object: Object3D): NodeId | undefined {
  let current: Object3D | null = object;

  while (current) {
    const nodeId = getObjectNodeId(current);

    if (nodeId) {
      return nodeId;
    }

    current = current.parent;
  }

  return undefined;
}

function getObjectNodeSubTarget(object: Object3D): string | undefined {
  const subTarget = object.userData[NODE_SUB_TARGET_USER_DATA_KEY];
  return typeof subTarget === "string" && subTarget.length > 0
    ? subTarget
    : undefined;
}

function createTransformHandleGroup(): Group {
  const handles = new Group();
  handles.name = "denovo-transform-handles";
  handles.visible = false;

  addTransformHandle(
    handles,
    new BoxGeometry(0.9, 0.07, 0.07),
    "#ef4444",
    [0.45, 0, 0],
    "translate.x"
  );
  addTransformHandle(
    handles,
    new BoxGeometry(0.07, 0.9, 0.07),
    "#22c55e",
    [0, 0.45, 0],
    "translate.y"
  );
  addTransformHandle(
    handles,
    new BoxGeometry(0.07, 0.07, 0.9),
    "#3b82f6",
    [0, 0, 0.45],
    "translate.z"
  );
  addTransformHandle(
    handles,
    new BoxGeometry(0.22, 0.22, 0.035),
    "#facc15",
    [0.2, 0.2, 0],
    "translate.xy",
    0.45
  );
  addTransformHandle(
    handles,
    new BoxGeometry(0.22, 0.035, 0.22),
    "#f472b6",
    [0.2, 0, 0.2],
    "translate.xz",
    0.45
  );
  addTransformHandle(
    handles,
    new BoxGeometry(0.035, 0.22, 0.22),
    "#22d3ee",
    [0, 0.2, 0.2],
    "translate.yz",
    0.45
  );
  addTransformHandle(
    handles,
    new TorusGeometry(0.66, 0.035, 8, 64),
    "#ef4444",
    [0, 0, 0],
    "rotate.x",
    1,
    [0, Math.PI / 2, 0]
  );
  addTransformHandle(
    handles,
    new TorusGeometry(0.66, 0.035, 8, 64),
    "#22c55e",
    [0, 0, 0],
    "rotate.y",
    1,
    [Math.PI / 2, 0, 0]
  );
  addTransformHandle(
    handles,
    new TorusGeometry(0.66, 0.035, 8, 64),
    "#3b82f6",
    [0, 0, 0],
    "rotate.z"
  );
  addTransformHandle(
    handles,
    new BoxGeometry(0.16, 0.16, 0.16),
    "#ef4444",
    [0.65, 0, 0],
    "scale.x"
  );
  addTransformHandle(
    handles,
    new BoxGeometry(0.16, 0.16, 0.16),
    "#22c55e",
    [0, 0.65, 0],
    "scale.y"
  );
  addTransformHandle(
    handles,
    new BoxGeometry(0.16, 0.16, 0.16),
    "#3b82f6",
    [0, 0, 0.65],
    "scale.z"
  );
  addTransformHandle(
    handles,
    new BoxGeometry(0.2, 0.2, 0.045),
    "#facc15",
    [0.3, 0.3, 0],
    "scale.xy",
    0.8
  );
  addTransformHandle(
    handles,
    new BoxGeometry(0.2, 0.045, 0.2),
    "#f472b6",
    [0.3, 0, 0.3],
    "scale.xz",
    0.8
  );
  addTransformHandle(
    handles,
    new BoxGeometry(0.045, 0.2, 0.2),
    "#22d3ee",
    [0, 0.3, 0.3],
    "scale.yz",
    0.8
  );
  addTransformHandle(
    handles,
    new BoxGeometry(0.16, 0.16, 0.16),
    "#f8fafc",
    [0.42, 0.42, 0.42],
    "scale.uniform"
  );

  return handles;
}

function addTransformHandle(
  group: Group,
  geometry: BufferGeometry,
  color: string,
  position: readonly [number, number, number],
  handleId: CanvasNodeTransformHandleId,
  opacity = 1,
  rotation: readonly [number, number, number] = [0, 0, 0]
) {
  const handle = new Mesh(
    geometry,
    new MeshBasicMaterial({
      color,
      depthTest: false,
      opacity,
      transparent: opacity < 1
    })
  );
  handle.position.set(...position);
  handle.rotation.set(...rotation);
  handle.renderOrder = 10_000;
  handle.userData[TRANSFORM_HANDLE_ID_USER_DATA_KEY] = handleId;
  group.add(handle);
}

function syncTransformHandleVisibility(
  handles: Group,
  kind: CanvasNodeTransformKind
) {
  for (const child of handles.children) {
    const handleId = getTransformHandleId(child);
    child.visible = getTransformKindForHandle(handleId) === kind;
  }
}

function syncTransformHandleColors(
  handles: Group,
  canvas: HTMLCanvasElement
) {
  for (const child of handles.children) {
    if (
      !(child instanceof Mesh) ||
      Array.isArray(child.material) ||
      !(child.material instanceof MeshBasicMaterial)
    ) {
      throw new Error("Canvas3D transform handle material is invalid.");
    }

    const handleId = getTransformHandleId(child);
    const [property, fallback] = getTransformHandleColorToken(handleId);
    child.material.color.set(
      resolveCanvasCssColor(canvas, property, fallback)
    );
  }
}

function getTransformHandleId(object: Object3D): CanvasNodeTransformHandleId {
  return CanvasNodeTransformHandleIdSchema.parse(
    object.userData[TRANSFORM_HANDLE_ID_USER_DATA_KEY]
  );
}

function getTransformKindForHandle(
  handleId: CanvasNodeTransformHandleId
): CanvasNodeTransformKind {
  switch (handleId) {
    case "translate.x":
    case "translate.y":
    case "translate.z":
    case "translate.xy":
    case "translate.xz":
    case "translate.yz":
      return "translate";
    case "rotate.x":
    case "rotate.y":
    case "rotate.z":
      return "rotate";
    case "scale.x":
    case "scale.y":
    case "scale.z":
    case "scale.xy":
    case "scale.xz":
    case "scale.yz":
    case "scale.uniform":
      return "scale";
    default: {
      const exhaustive: never = handleId;
      throw new Error(`Unsupported transform handle: ${exhaustive}`);
    }
  }
}

function getTransformHandleColorToken(
  handleId: CanvasNodeTransformHandleId
): readonly [property: string, fallback: string] {
  switch (handleId) {
    case "translate.x":
    case "rotate.x":
    case "scale.x":
      return ["--_dc-handle-x", "#ef4444"];
    case "translate.y":
    case "rotate.y":
    case "scale.y":
      return ["--_dc-handle-y", "#22c55e"];
    case "translate.z":
    case "rotate.z":
    case "scale.z":
      return ["--_dc-handle-z", "#3b82f6"];
    case "translate.xy":
    case "scale.xy":
      return ["--_dc-handle-xy", "#facc15"];
    case "translate.xz":
    case "scale.xz":
      return ["--_dc-handle-xz", "#f472b6"];
    case "translate.yz":
    case "scale.yz":
      return ["--_dc-handle-yz", "#22d3ee"];
    case "scale.uniform":
      return ["--_dc-handle-uniform", "#f8fafc"];
    default: {
      const exhaustive: never = handleId;
      throw new Error(`Unsupported transform handle color token: ${exhaustive}`);
    }
  }
}

interface BatchedBoxEntry {
  readonly id: string;
  readonly color: string;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly scale: readonly [number, number, number];
}

function boxEntryFromNode(node: Canvas3DNode): BatchedBoxEntry {
  if (node.type !== "box") {
    throw new Error(`Expected box node: ${node.id}`);
  }

  return {
    id: node.id,
    color: node.color,
    position: node.position,
    rotation: node.rotation,
    scale: node.scale
  };
}

/**
 * Builds a single InstancedMesh that batches many same-color unit-box nodes.
 * Each instance carries its own transform; the node id per instance is stored
 * under userData[INSTANCE_NODE_IDS_USER_DATA_KEY] so createThreeHitTester can
 * resolve hits back to document nodes. Enabled only when render.batch is on.
 */
function createBatchedBoxMesh(boxes: readonly BatchedBoxEntry[]): InstancedMesh {
  const geometry = getUnitBoxGeometry();
  const material = createCanvas3DSurfaceMaterial(boxes[0]!.color);
  const mesh = new InstancedMesh(geometry, material, boxes.length);
  const transform = new Object3D();
  const matrix = new Matrix4();
  const nodeIds: string[] = [];

  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  boxes.forEach((box, index) => {
    transform.position.set(box.position[0], box.position[1], box.position[2]);
    transform.rotation.set(box.rotation[0], box.rotation[1], box.rotation[2]);
    transform.scale.set(box.scale[0], box.scale[1], box.scale[2]);
    transform.updateMatrix();
    matrix.copy(transform.matrix);
    mesh.setMatrixAt(index, matrix);
    nodeIds.push(box.id);
  });

  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.userData[INSTANCE_NODE_IDS_USER_DATA_KEY] = nodeIds;

  return mesh;
}

function createObject(
  node: Canvas3DNode,
  colors: Canvas3DContentColors
): Object3D {
  switch (node.type) {
    case "box":
      return new Mesh(
        getUnitBoxGeometry(),
        createCanvas3DSurfaceMaterial(node.color)
      );
    case "sphere": {
      const sphereGeometry = new SphereGeometry(node.radius, 48, 24);
      prepareGeometryBounds(sphereGeometry);
      return new Mesh(sphereGeometry, createCanvas3DSurfaceMaterial(node.color));
    }
    case "mesh": {
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        "position",
        new BufferAttribute(new Float32Array(node.positions), 3)
      );
      if (node.normals) {
        geometry.setAttribute(
          "normal",
          new BufferAttribute(new Float32Array(node.normals), 3)
        );
      } else {
        geometry.computeVertexNormals();
      }
      if (node.uvs) {
        geometry.setAttribute(
          "uv",
          new BufferAttribute(new Float32Array(node.uvs), 2)
        );
      }
      geometry.setIndex(Array.from(node.indices));
      prepareGeometryBounds(geometry);
      let material = createCanvas3DSurfaceMaterial(node.color);
      if (node.wireframe) {
        material = material.clone();
        material.wireframe = true;
      }
      return new Mesh(geometry, material);
    }
    case "instances":
      return createInstancedMeshBatch({ node });
    case "group":
      return new Group();
    case "measurement":
      return createMeasurementObject(node, colors);
    case "annotation":
      return createAnnotationObject(node, colors);
    default: {
      const exhaustive: never = node;
      throw new Error(`Unsupported 3D canvas node: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * Cached resources shared across nodes. Tracked in `cachedResources` so that
 * `disposeGroup` does not dispose a geometry/material still in use by another
 * node or a future scene. This is the M4 Phase B foundation; it reduces GPU
 * upload and allocation churn but does not yet collapse draw calls (that needs
 * InstancedMesh/BatchedMesh batching).
 */
const cachedResources = new WeakSet<object>();
const cachedSurfaceMaterials = new Map<string, MeshStandardMaterial>();
let unitBoxGeometry: BoxGeometry | null = null;

/**
 * Builds a BVH bounds tree on a geometry when three-mesh-bvh has been installed
 * via `installMeshBvhRaycast()`. The prototype method is added at runtime, so
 * the call is optional-chained. This accelerates raycast picking on complex
 * geometry; simple unit primitives benefit less but pay essentially nothing.
 */
function prepareGeometryBounds(geometry: BufferGeometry): void {
  const withBvh = geometry as BufferGeometry & {
    computeBoundsTree?: () => void;
  };
  withBvh.computeBoundsTree?.();
}

function getUnitBoxGeometry(): BoxGeometry {
  if (!unitBoxGeometry) {
    unitBoxGeometry = new BoxGeometry(1, 1, 1);
    prepareGeometryBounds(unitBoxGeometry);
    cachedResources.add(unitBoxGeometry);
  }
  return unitBoxGeometry;
}

function createCanvas3DSurfaceMaterial(color: string): MeshStandardMaterial {
  let material = cachedSurfaceMaterials.get(color);

  if (!material) {
    material = new MeshStandardMaterial({
      color: new Color(color),
      roughness: 0.68,
      metalness: 0.02
    });
    cachedResources.add(material);
    cachedSurfaceMaterials.set(color, material);
  }

  return material;
}

function createMeasurementObject(
  node: Canvas3DMeasurementNode,
  colors: Canvas3DContentColors
): Group {
  return createMeasurementSegmentObject(node.start, node.end, colors.accent);
}

function createMeasurementSegmentObject(
  startValue: readonly [number, number, number],
  endValue: readonly [number, number, number],
  color: string
): Group {
  const object = new Group();
  const start = new Vector3(...startValue);
  const end = new Vector3(...endValue);
  const direction = end.clone().sub(start);
  const length = direction.length();
  const markerGeometry = new SphereGeometry(
    MEASUREMENT_MARKER_RADIUS,
    20,
    12
  );
  const material = new MeshBasicMaterial({ color });
  const startMarker = new Mesh(markerGeometry, material);
  startMarker.position.copy(start);
  startMarker.userData[NODE_SUB_TARGET_USER_DATA_KEY] = "measurement.segment";
  object.add(startMarker);

  if (length > Number.EPSILON) {
    const endMarker = new Mesh(markerGeometry, material);
    endMarker.position.copy(end);
    endMarker.userData[NODE_SUB_TARGET_USER_DATA_KEY] = "measurement.segment";
    object.add(endMarker);

    const segment = new Mesh(
      new CylinderGeometry(
        MEASUREMENT_SEGMENT_RADIUS,
        MEASUREMENT_SEGMENT_RADIUS,
        length,
        12
      ),
      material
    );
    segment.position.copy(start).add(end).multiplyScalar(0.5);
    segment.quaternion.setFromUnitVectors(
      new Vector3(0, 1, 0),
      direction.normalize()
    );
    segment.userData[NODE_SUB_TARGET_USER_DATA_KEY] = "measurement.segment";
    object.add(segment);
  }

  return object;
}

function addMeasurementLabel(
  object: Group,
  node: Canvas3DMeasurementNode,
  colors: Canvas3DContentColors
) {
  const worldStart = object.localToWorld(new Vector3(...node.start));
  const worldEnd = object.localToWorld(new Vector3(...node.end));
  const distanceInMeters = worldStart.distanceTo(worldEnd);
  const value = distanceInMeters / node.unit.metersPerUnit;
  const label = `${formatMeasurementValue(value, node.precision, node.id)} ${node.unit.symbol}`;
  const sprite = createTextSprite(
    label,
    colors.foreground,
    colors.accent,
    "measurement.label"
  );
  sprite.position
    .set(...node.start)
    .add(new Vector3(...node.end))
    .multiplyScalar(0.5);
  sprite.position.y += 0.18;
  object.add(sprite);
}

function createAnnotationObject(
  node: Canvas3DAnnotationNode,
  colors: Canvas3DContentColors
): Group {
  const object = new Group();
  const marker = new Mesh(
    new SphereGeometry(ANNOTATION_ANCHOR_RADIUS, 20, 12),
    new MeshBasicMaterial({ color: colors.accent })
  );
  marker.position.set(...node.anchor);
  marker.userData[NODE_SUB_TARGET_USER_DATA_KEY] = "annotation.anchor";
  object.add(marker);

  try {
    const label = createTextSprite(
      node.text,
      colors.foreground,
      colors.accent,
      "annotation.text"
    );
    label.position.set(
      node.anchor[0] + 0.24,
      node.anchor[1] + 0.18,
      node.anchor[2]
    );
    object.add(label);
    return object;
  } catch (cause) {
    disposeGroup(object);
    throw cause;
  }
}

function createTextSprite(
  text: string,
  foreground: string,
  outline: string,
  subTarget: "annotation.text" | "measurement.label"
): Sprite {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error(`Canvas3D text rendering is unavailable: ${subTarget}`);
  }

  context.font = LABEL_FONT;
  const measuredWidth = context.measureText(text).width;

  if (!Number.isFinite(measuredWidth)) {
    throw new Error(`Canvas3D text width is invalid: ${subTarget}`);
  }

  const width = Math.max(
    LABEL_HEIGHT,
    Math.ceil(measuredWidth + LABEL_HORIZONTAL_PADDING * 2)
  );

  if (width > MAX_LABEL_TEXTURE_WIDTH) {
    throw new Error(
      `Canvas3D text exceeds the ${MAX_LABEL_TEXTURE_WIDTH}px label limit: ${subTarget}`
    );
  }

  canvas.width = width;
  canvas.height = LABEL_HEIGHT;
  context.font = LABEL_FONT;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.lineWidth = 6;
  context.strokeStyle = outline;
  context.fillStyle = foreground;
  context.strokeText(text, width / 2, LABEL_HEIGHT / 2);
  context.fillText(text, width / 2, LABEL_HEIGHT / 2);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const material = new SpriteMaterial({
    depthTest: true,
    depthWrite: false,
    map: texture,
    transparent: true
  });
  const sprite = new Sprite(material);
  sprite.scale.set(
    (LABEL_WORLD_HEIGHT * width) / LABEL_HEIGHT,
    LABEL_WORLD_HEIGHT,
    1
  );
  sprite.userData[NODE_SUB_TARGET_USER_DATA_KEY] = subTarget;
  return sprite;
}

function formatMeasurementValue(
  value: number,
  precision: number,
  nodeId: NodeId
): string {
  if (precision > MAX_LABEL_TEXTURE_WIDTH) {
    throw new Error(
      `Canvas3D measurement precision exceeds renderer capacity: ${nodeId}`
    );
  }

  return precision <= 100
    ? value.toFixed(precision)
    : `${value.toFixed(100)}${"0".repeat(precision - 100)}`;
}

function disposeGroup(group: Group) {
  for (const child of [...group.children]) {
    group.remove(child);
    disposeObject3D(child);
  }
}

/**
 * Collects and disposes the geometries/materials reachable from an object,
 * skipping cached shared resources. Used both by `disposeGroup` (whole-scene
 * rebuild path) and by the diff-based `applyScene` (per-removed-node path).
 */
function disposeObject3D(object: Object3D) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();

  object.traverse((descendant) => {
    if (descendant instanceof Mesh) {
      geometries.add(descendant.geometry);

      if (Array.isArray(descendant.material)) {
        for (const material of descendant.material) {
          materials.add(material);
        }
      } else {
        materials.add(descendant.material);
      }
    } else if (descendant instanceof Sprite) {
      materials.add(descendant.material);
    } else if (descendant instanceof LineSegments) {
      geometries.add(descendant.geometry);
      materials.add(descendant.material);
    }
  });

  for (const geometry of geometries) {
    if (cachedResources.has(geometry)) {
      continue;
    }

    geometry.dispose();
  }

  for (const material of materials) {
    if (cachedResources.has(material)) {
      continue;
    }

    if (material instanceof SpriteMaterial) {
      material.map?.dispose();
    }

    material.dispose();
  }
}

/**
 * Structural equality for diff-based `applyScene`. Node identity is by value,
 * not reference, because scene updates may rebuild node objects. Falls back to
 * JSON serialization for correctness across all node variants.
 */
function canvas3DNodeEqual(a: Canvas3DNode, b: Canvas3DNode): boolean {
  if (a === b) {
    return true;
  }

  if (a.type !== b.type) {
    return false;
  }

  return JSON.stringify(a) === JSON.stringify(b);
}

function setVector(target: Vector3, source: readonly [number, number, number]) {
  target.set(source[0], source[1], source[2]);
}

function setEuler(
  target: Object3D["rotation"],
  source: readonly [number, number, number]
) {
  target.set(source[0], source[1], source[2]);
}
