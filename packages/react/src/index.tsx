"use client";

import {
  defineScene,
  isDenovoFieldNode,
  resolveCanvasMeshGeometry,
  type Canvas3DDenovoFieldNode,
  type Canvas3DNode,
  type Canvas3DScene,
  type Canvas3DSceneInput,
  type CanvasGeometryStore,
  type CanvasSceneInput
} from "@de-novo/canvas-core";
import {
  createDenovoFieldObject,
  tickDenovoFieldObject
} from "@de-novo/canvas-three";
import {
  createCanvas,
  shallowEqual,
  type CanvasEditor,
  type CanvasEditorState,
  type CanvasSelector,
  type CanvasSelectorEquality,
  type DenovoCanvasCommonConfig,
  type DenovoCanvasRuntime
} from "@de-novo/canvas";
import { Html, Line, OrbitControls } from "@react-three/drei";
import {
  Canvas,
  useFrame,
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
import { useCanvasSelector } from "./selector";
import {
  Color,
  Euler,
  LineSegments,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  Vector3,
  type InstancedMesh,
  type PerspectiveCamera
} from "three";

type CanvasViewBaseProps = {
  className?: string;
  options?: DenovoCanvasCommonConfig;
  style?: CSSProperties;
  onRuntime?: (runtime: DenovoCanvasRuntime | null) => void;
};

export type CanvasViewProps = CanvasViewBaseProps &
  (
    | { editor?: never; scene: CanvasSceneInput }
    | { editor: CanvasEditor; scene?: never }
  );

export type CanvasStage3DProps = {
  cameraControls?: boolean;
  className?: string;
  geometryStore?: CanvasGeometryStore | undefined;
  scene: Canvas3DSceneInput;
  style?: CSSProperties;
  onCreated?: CanvasProps["onCreated"];
};

export function CanvasView({
  className,
  editor,
  options,
  scene,
  style,
  onRuntime
}: CanvasViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<DenovoCanvasRuntime | null>(null);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const runtime =
      editor !== undefined
        ? createCanvas(hostRef.current, {
            editor,
            ...(options ?? {})
          })
        : createCanvas(hostRef.current, {
            scene: scene!,
            ...(options ?? {})
          });
    runtimeRef.current = runtime;
    onRuntime?.(runtime);

    return () => {
      runtime.destroy();
      runtimeRef.current = null;
      onRuntime?.(null);
    };
  }, [editor]);

  useEffect(() => {
    if (editor !== undefined || scene === undefined) {
      return;
    }
    runtimeRef.current?.update(scene);
  }, [editor, scene]);

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
  geometryStore,
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
        <SceneObjects geometryStore={geometryStore} scene={resolvedScene} />
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

    const perspective = camera as unknown as PerspectiveCamera;
    perspective.fov = scene.camera.fov;
    perspective.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate, scene]);

  return null;
}

function SceneObjects({
  geometryStore,
  scene
}: {
  geometryStore?: CanvasGeometryStore | undefined;
  scene: Canvas3DScene;
}) {
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
                  new Matrix4(),
                  geometryStore
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
  parentWorldTransform: Matrix4,
  geometryStore?: CanvasGeometryStore
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
          frustumCulled={frustumCulled}
          geometryStore={geometryStore}
          node={node}
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
              worldTransform,
              geometryStore
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
    default:
      if (isDenovoFieldNode(node)) {
        return (
          <DenovoFieldView
            key={node.id}
            frustumCulled={frustumCulled}
            node={node}
          />
        );
      }
      return (
        <mesh
          key={node.id}
          position={node.position}
          rotation={node.rotation}
          scale={node.scale}
          frustumCulled={frustumCulled}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
      );
  }
}

function DenovoFieldView({
  frustumCulled,
  node
}: {
  frustumCulled: boolean;
  node: Canvas3DDenovoFieldNode;
}) {
  const object = useMemo(
    () => createDenovoFieldObject(node.props),
    [
      node.props.brightness,
      node.props.density,
      node.props.hue,
      node.props.pattern,
      node.props.speed
    ]
  );

  useEffect(() => {
    return () => {
      object.traverse((child) => {
        if (child instanceof Mesh || child instanceof LineSegments) {
          child.geometry.dispose();
          const material = child.material;
          const materials = Array.isArray(material) ? material : [material];
          for (const entry of materials) {
            if ("map" in entry && entry.map) {
              entry.map.dispose();
            }
            entry.dispose();
          }
        }
      });
    };
  }, [object]);

  useFrame((state) => {
    tickDenovoFieldObject(object, state.clock.elapsedTime * 1000);
  });

  return (
    <primitive
      object={object}
      frustumCulled={frustumCulled}
      position={node.position}
      rotation={node.rotation}
      scale={node.scale}
    />
  );
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
  frustumCulled: boolean;
  geometryStore?: CanvasGeometryStore | undefined;
  node: Canvas3DMeshNode;
};

function MeshNode({ frustumCulled, geometryStore, node }: MeshNodeProps) {
  const resolved = resolveCanvasMeshGeometry(node, geometryStore);
  const positions = useMemo(
    () => (resolved ? new Float32Array(resolved.positions) : null),
    [resolved]
  );
  const indices = useMemo(
    () => (resolved ? new Uint32Array(resolved.indices) : null),
    [resolved]
  );
  const normals = useMemo(
    () => (resolved?.normals ? new Float32Array(resolved.normals) : null),
    [resolved]
  );
  const uvs = useMemo(
    () => (resolved?.uvs ? new Float32Array(resolved.uvs) : null),
    [resolved]
  );

  if (!resolved || !positions || !indices) {
    return null;
  }

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

export { shallowEqual, useCanvasSelector };
export type {
  CanvasEditor,
  CanvasEditorState,
  CanvasSelector,
  CanvasSelectorEquality,
  DenovoCanvasCommonConfig,
  DenovoCanvasRuntime
};
