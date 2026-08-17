"use client";

import {
  defineScene,
  type Canvas3DNode,
  type Canvas3DScene,
  type Canvas3DSceneInput,
  type CanvasSceneInput
} from "@denovo/canvas-core";
import {
  createCanvas,
  type CreateCanvasOptions,
  type DynamicCanvasRuntime
} from "@denovo/canvas-web";
import { Html, Line, OrbitControls } from "@react-three/drei";
import {
  Canvas,
  useThree,
  type CanvasProps
} from "@react-three/fiber";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode
} from "react";
import {
  Color,
  Euler,
  Matrix4,
  Object3D,
  Quaternion,
  Vector3,
  type InstancedMesh,
  type PerspectiveCamera
} from "three";

export type CanvasViewProps = {
  className?: string;
  options?: CreateCanvasOptions;
  scene: CanvasSceneInput;
  style?: CSSProperties;
  onRuntime?: (runtime: DynamicCanvasRuntime | null) => void;
};

export type CanvasStage3DProps = {
  cameraControls?: boolean;
  className?: string;
  scene: Canvas3DSceneInput;
  style?: CSSProperties;
  onCreated?: CanvasProps["onCreated"];
};

export function CanvasView({
  className,
  options,
  scene,
  style,
  onRuntime
}: CanvasViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<DynamicCanvasRuntime | null>(null);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const runtime = createCanvas(hostRef.current, scene, options);
    runtimeRef.current = runtime;
    onRuntime?.(runtime);

    return () => {
      runtime.destroy();
      runtimeRef.current = null;
      onRuntime?.(null);
    };
  }, []);

  useEffect(() => {
    runtimeRef.current?.update(scene);
  }, [scene]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        minHeight: 320,
        ...style
      }}
    />
  );
}

export function CanvasStage3D({
  cameraControls = true,
  className,
  scene,
  style,
  onCreated
}: CanvasStage3DProps) {
  const resolvedScene = useMemo(() => defineScene(scene), [scene]);

  if (resolvedScene.mode !== "3d") {
    throw new Error("CanvasStage3D requires a scene with mode: '3d'.");
  }

  const canvasProps: CanvasProps = {
    frameloop: resolvedScene.render.loop,
    dpr: resolvedScene.render.dpr,
    ...(onCreated !== undefined ? { onCreated } : {})
  };

  return (
    <div
      className={className}
      style={{
        minHeight: 320,
        ...style
      }}
    >
      <Canvas {...canvasProps}>
        <color attach="background" args={[resolvedScene.background]} />
        <ambientLight intensity={0.65} />
        <directionalLight position={[4, 6, 8]} intensity={1.8} />
        <SceneCamera scene={resolvedScene} />
        <SceneObjects scene={resolvedScene} />
        {cameraControls ? <OrbitControls makeDefault enableDamping /> : null}
      </Canvas>
    </div>
  );
}

function SceneCamera({ scene }: { scene: Canvas3DScene }) {
  const { camera, invalidate } = useThree();

  useLayoutEffect(() => {
    camera.position.set(
      scene.camera.position[0],
      scene.camera.position[1],
      scene.camera.position[2]
    );
    camera.lookAt(
      scene.camera.target[0],
      scene.camera.target[1],
      scene.camera.target[2]
    );

    const perspective = camera as PerspectiveCamera;
    perspective.fov = scene.camera.fov;
    perspective.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate, scene]);

  return null;
}

function SceneObjects({ scene }: { scene: Canvas3DScene }) {
  const nodes = scene.nodes;
  const childrenByParent = new Map<string | null, Canvas3DNode[]>();

  for (const node of nodes) {
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  }

  return (
    <>
      {scene.layers.flatMap((layer) =>
        layer.visible
          ? (childrenByParent.get(null) ?? [])
              .filter((node) => node.layerId === layer.id)
              .map((node) =>
                renderSceneNode(
                  node,
                  childrenByParent,
                  scene.render.frustumCulling,
                  new Matrix4()
                )
              )
          : []
      )}
    </>
  );
}

function renderSceneNode(
  node: Canvas3DNode,
  childrenByParent: ReadonlyMap<string | null, readonly Canvas3DNode[]>,
  frustumCulled: boolean,
  parentWorldTransform: Matrix4
): ReactNode {
  if (!node.visible) {
    return null;
  }

  switch (node.type) {
    case "box":
      return (
        <mesh
          key={node.id}
          position={node.position}
          rotation={node.rotation}
          scale={node.scale}
          frustumCulled={frustumCulled}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={node.color} />
        </mesh>
      );
    case "sphere":
      return (
        <mesh
          key={node.id}
          position={node.position}
          rotation={node.rotation}
          scale={node.scale}
          frustumCulled={frustumCulled}
        >
          <sphereGeometry args={[node.radius, 48, 24]} />
          <meshStandardMaterial color={node.color} />
        </mesh>
      );
    case "mesh":
      return (
        <MeshNode
          key={node.id}
          node={node}
          frustumCulled={frustumCulled}
        />
      );
    case "instances":
      return (
        <InstancesNode
          key={node.id}
          color={node.color}
          frustumCulled={frustumCulled}
          geometry={node.geometry}
          instances={node.instances}
          position={node.position}
          rotation={node.rotation}
          scale={node.scale}
        />
      );
    case "group": {
      const worldTransform = parentWorldTransform
        .clone()
        .multiply(createCanvas3DNodeMatrix(node));
      return (
        <group
          key={node.id}
          position={node.position}
          rotation={node.rotation}
          scale={node.scale}
        >
          {(childrenByParent.get(node.id) ?? []).map((child) =>
            renderSceneNode(
              child,
              childrenByParent,
              frustumCulled,
              worldTransform
            )
          )}
        </group>
      );
    }
    case "measurement": {
      const worldStart = new Vector3(...node.start).applyMatrix4(
        parentWorldTransform
      );
      const worldEnd = new Vector3(...node.end).applyMatrix4(
        parentWorldTransform
      );
      const distance =
        worldStart.distanceTo(worldEnd) / node.unit.metersPerUnit;
      return (
        <group key={node.id}>
          <Line points={[node.start, node.end]} color="#f8fafc" lineWidth={2} />
          <Html position={node.end} center>
            <span>
              {formatMeasurementValue(distance, node.precision)} {node.unit.symbol}
            </span>
          </Html>
        </group>
      );
    }
    case "annotation":
      return (
        <Html key={node.id} position={node.anchor} center>
          <span>{node.text}</span>
        </Html>
      );
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
}

function formatMeasurementValue(value: number, precision: number): string {
  if (precision <= 100) {
    return value.toFixed(precision);
  }

  return `${value.toFixed(100)}${"0".repeat(precision - 100)}`;
}

function createCanvas3DNodeMatrix(
  node: Extract<Canvas3DNode, { type: "group" }>
): Matrix4 {
  return new Matrix4().compose(
    new Vector3(...node.position),
    new Quaternion().setFromEuler(new Euler(...node.rotation)),
    new Vector3(...node.scale)
  );
}

type InstancesNodeProps = {
  color: string;
  frustumCulled: boolean;
  geometry: "box" | "sphere";
  instances: Extract<
    Canvas3DNode,
    { type: "instances" }
  >["instances"];
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
};

function InstancesNode({
  color,
  frustumCulled,
  geometry,
  instances,
  position,
  rotation,
  scale
}: InstancesNodeProps) {
  const ref = useRef<InstancedMesh>(null);
  const transform = useMemo(() => new Object3D(), []);
  const { invalidate } = useThree();

  useLayoutEffect(() => {
    const mesh = ref.current;

    if (!mesh) {
      return;
    }

    instances.forEach((instance, index) => {
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
      mesh.setMatrixAt(index, transform.matrix);
      mesh.setColorAt(index, new Color(instance.color ?? color));
    });

    mesh.instanceMatrix.needsUpdate = true;

    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }

    invalidate();
  }, [color, instances, invalidate, transform]);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, instances.length]}
      frustumCulled={frustumCulled}
      position={position}
      rotation={rotation}
      scale={scale}
    >
      {geometry === "sphere" ? (
        <sphereGeometry args={[0.5, 32, 16]} />
      ) : (
        <boxGeometry args={[1, 1, 1]} />
      )}
      <meshStandardMaterial color={color} roughness={0.58} metalness={0.06} />
    </instancedMesh>
  );
}

type Canvas3DMeshNode = Extract<Canvas3DNode, { type: "mesh" }>;

type MeshNodeProps = {
  node: Canvas3DMeshNode;
  frustumCulled: boolean;
};

function MeshNode({ node, frustumCulled }: MeshNodeProps) {
  const positions = useMemo(() => new Float32Array(node.positions), [node.positions]);
  const indices = useMemo(
    () => new Uint32Array(node.indices),
    [node.indices]
  );
  const normals = useMemo(
    () => (node.normals ? new Float32Array(node.normals) : null),
    [node.normals]
  );
  const uvs = useMemo(
    () => (node.uvs ? new Float32Array(node.uvs) : null),
    [node.uvs]
  );

  return (
    <mesh
      position={node.position}
      rotation={node.rotation}
      scale={node.scale}
      frustumCulled={frustumCulled}
    >
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        {normals ? (
          <bufferAttribute attach="attributes-normal" args={[normals, 3]} />
        ) : null}
        {uvs ? <bufferAttribute attach="attributes-uv" args={[uvs, 2]} /> : null}
        <bufferAttribute attach="index" args={[indices, 1]} />
      </bufferGeometry>
      <meshStandardMaterial color={node.color} wireframe={node.wireframe} />
    </mesh>
  );
}

export type { CreateCanvasOptions, DynamicCanvasRuntime };
