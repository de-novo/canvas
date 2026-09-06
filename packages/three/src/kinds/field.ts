import {
  denovoFieldInstanceCount,
  type DenovoFieldPattern,
  type DenovoFieldProps
} from "@denovo/canvas-core";
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  RGBAFormat,
  UnsignedByteType,
  Vector3
} from "three";

import {
  createDenovoFieldStreakCompute,
  type DenovoFieldStreakCompute
} from "./field-compute.js";

export const DENOVO_FIELD_USER_DATA_KEY = "denovoField";
const DENOVO_FIELD_COMPUTE_KEY = "denovoFieldCompute";
const DENOVO_FIELD_COMPUTE_HOST_KEY = "denovoFieldComputeHost";

type DenovoFieldSeed = {
  readonly glyph: number;
  readonly length: number;
  readonly phase: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

type DenovoFieldUserData = {
  readonly count: number;
  readonly pattern: DenovoFieldPattern;
  readonly positions: Float32Array | null;
  readonly props: DenovoFieldProps;
  readonly seeds: readonly DenovoFieldSeed[];
  readonly visuals: readonly Object3D[];
};

const CORRIDOR_NEAR = 12;
const CORRIDOR_FAR = -36;
const CORRIDOR_SPAN = CORRIDOR_NEAR - CORRIDOR_FAR;
const LETTER_GLYPHS = ["D", "E", "N", "O", "V"] as const;
const GLYPH_BITS: Record<(typeof LETTER_GLYPHS)[number], readonly number[]> = {
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b01010, 0b00100]
};

const matrix = new Matrix4();
const position = new Vector3();
const identityRotation = new Quaternion();
const letterScale = new Vector3(0.55, 0.7, 1);

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let result = Math.imul(t ^ (t >>> 15), 1 | t);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function wrapCorridor(value: number): number {
  let wrapped = ((value - CORRIDOR_FAR) % CORRIDOR_SPAN) + CORRIDOR_FAR;
  if (wrapped < CORRIDOR_FAR) {
    wrapped += CORRIDOR_SPAN;
  }
  return wrapped;
}

function createSeeds(count: number): DenovoFieldSeed[] {
  const random = mulberry32(0x77617270);
  const seeds: DenovoFieldSeed[] = [];

  for (let index = 0; index < count; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 1.2 + random() * 7.5;
    seeds.push({
      glyph: index % LETTER_GLYPHS.length,
      length: 0.8 + random() * 2.4,
      phase: random(),
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * 0.62,
      z: CORRIDOR_FAR + random() * CORRIDOR_SPAN
    });
  }

  return seeds;
}

function fieldColor(props: DenovoFieldProps, shift = 0): Color {
  const lightness = Math.min(0.78, 0.22 + props.brightness * 0.28);
  return new Color().setHSL(((props.hue + shift + 360) % 360) / 360, 0.72, lightness);
}

function createGlyphTexture(glyph: (typeof LETTER_GLYPHS)[number], color: Color): DataTexture {
  const width = 16;
  const height = 16;
  const data = new Uint8Array(width * height * 4);
  const bits = GLYPH_BITS[glyph];
  const red = Math.round(color.r * 255);
  const green = Math.round(color.g * 255);
  const blue = Math.round(color.b * 255);

  for (let row = 0; row < 7; row += 1) {
    const line = bits[row] ?? 0;
    for (let column = 0; column < 5; column += 1) {
      if (((line >> (4 - column)) & 1) === 0) {
        continue;
      }
      const originX = 5 + column * 1;
      const originY = 4 + row * 1;
      const pixel = (originY * width + originX) * 4;
      data[pixel] = red;
      data[pixel + 1] = green;
      data[pixel + 2] = blue;
      data[pixel + 3] = 255;
    }
  }

  const texture = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType);
  texture.needsUpdate = true;
  return texture;
}

function createPickVolume(): Mesh {
  const mesh = new Mesh(
    new BoxGeometry(18, 12, 48),
    new MeshBasicMaterial({
      depthWrite: false,
      opacity: 0,
      transparent: true
    })
  );
  mesh.name = "denovo-field-pick";
  return mesh;
}

function createStreakVisual(
  props: DenovoFieldProps,
  seeds: readonly DenovoFieldSeed[]
): { positions: Float32Array; visual: LineSegments } {
  const geometry = new BufferGeometry();
  const positions = new Float32Array(seeds.length * 6);
  const colors = new Float32Array(seeds.length * 6);
  const head = fieldColor(props, 18);
  const tail = fieldColor(props, -12);

  for (let index = 0; index < seeds.length; index += 1) {
    const seed = seeds[index]!;
    const offset = index * 6;
    positions[offset] = seed.x;
    positions[offset + 1] = seed.y;
    positions[offset + 2] = seed.z;
    positions[offset + 3] = seed.x;
    positions[offset + 4] = seed.y;
    positions[offset + 5] = seed.z + seed.length;
    colors[offset] = tail.r;
    colors[offset + 1] = tail.g;
    colors[offset + 2] = tail.b;
    colors[offset + 3] = head.r;
    colors[offset + 4] = head.g;
    colors[offset + 5] = head.b;
  }

  const positionAttribute = new BufferAttribute(positions, 3).setUsage(
    DynamicDrawUsage
  );
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("color", new BufferAttribute(colors, 3));

  const visual = new LineSegments(
    geometry,
    new LineBasicMaterial({
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: Math.min(1, 0.35 + props.brightness * 0.35),
      vertexColors: true
    })
  );
  visual.frustumCulled = false;
  visual.name = "denovo-field-streaks";
  return { positions, visual };
}

function createLetterVisuals(
  props: DenovoFieldProps,
  seeds: readonly DenovoFieldSeed[]
): InstancedMesh[] {
  const geometry = new PlaneGeometry(1, 1);
  const color = fieldColor(props);
  const meshes: InstancedMesh[] = [];

  for (const [glyphIndex, glyph] of LETTER_GLYPHS.entries()) {
    const glyphSeeds = seeds.filter((seed) => seed.glyph === glyphIndex);
    if (glyphSeeds.length === 0) {
      continue;
    }

    const material = new MeshBasicMaterial({
      blending: AdditiveBlending,
      depthWrite: false,
      map: createGlyphTexture(glyph, color),
      side: DoubleSide,
      transparent: true
    });
    const mesh = new InstancedMesh(geometry, material, glyphSeeds.length);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.name = `denovo-field-letter-${glyph}`;
    mesh.userData.glyphSeeds = glyphSeeds;
    meshes.push(mesh);
  }

  return meshes;
}

function writeLetterMatrices(
  mesh: InstancedMesh,
  seeds: readonly DenovoFieldSeed[],
  elapsedMs: number,
  speed: number
) {
  const travel = (elapsedMs / 1000) * (speed / 40) * 14;

  for (let index = 0; index < seeds.length; index += 1) {
    const seed = seeds[index]!;
    position.set(seed.x, seed.y, wrapCorridor(seed.z + travel + seed.phase * CORRIDOR_SPAN));
    matrix.compose(position, identityRotation, letterScale);
    mesh.setMatrixAt(index, matrix);
  }

  mesh.instanceMatrix.needsUpdate = true;
}

function writeStreakPositions(
  positions: Float32Array,
  seeds: readonly DenovoFieldSeed[],
  elapsedMs: number,
  speed: number
) {
  const travel = (elapsedMs / 1000) * (speed / 40) * 22;

  for (let index = 0; index < seeds.length; index += 1) {
    const seed = seeds[index]!;
    const z = wrapCorridor(seed.z + travel + seed.phase * CORRIDOR_SPAN);
    const offset = index * 6;
    positions[offset] = seed.x;
    positions[offset + 1] = seed.y;
    positions[offset + 2] = z;
    positions[offset + 3] = seed.x;
    positions[offset + 4] = seed.y;
    positions[offset + 5] = z + seed.length;
  }
}

export function createDenovoFieldObject(props: DenovoFieldProps): Group {
  const count = denovoFieldInstanceCount(props.density);
  const seeds = createSeeds(count);
  const group = new Group();
  const pick = createPickVolume();
  const visuals: Object3D[] = [];
  let positions: Float32Array | null = null;

  group.add(pick);

  if (props.pattern === "streaks") {
    const streak = createStreakVisual(props, seeds);
    positions = streak.positions;
    visuals.push(streak.visual);
    group.add(streak.visual);
    writeStreakPositions(positions, seeds, 0, props.speed);
    const positionAttribute = streak.visual.geometry.getAttribute("position");
    if (positionAttribute) {
      positionAttribute.needsUpdate = true;
    }
  } else {
    const letters = createLetterVisuals(props, seeds);
    for (const mesh of letters) {
      visuals.push(mesh);
      group.add(mesh);
      writeLetterMatrices(
        mesh,
        mesh.userData.glyphSeeds as DenovoFieldSeed[],
        0,
        props.speed
      );
    }
  }

  group.frustumCulled = false;
  group.name = "denovo-field";
  group.userData[DENOVO_FIELD_USER_DATA_KEY] = {
    count,
    pattern: props.pattern,
    positions,
    props,
    seeds,
    visuals
  } satisfies DenovoFieldUserData;

  return group;
}

export function isDenovoFieldObject(object: Object3D): boolean {
  return object.userData[DENOVO_FIELD_USER_DATA_KEY] !== undefined;
}

export function readDenovoFieldObjectState(object: Object3D): {
  readonly count: number;
  readonly pattern: DenovoFieldPattern;
} | null {
  const field = object.userData[DENOVO_FIELD_USER_DATA_KEY] as
    | DenovoFieldUserData
    | undefined;

  if (!field) {
    return null;
  }

  return {
    count: field.count,
    pattern: field.pattern
  };
}

export type DenovoFieldComputeHost = {
  readonly device: GPUDevice;
  readVertexBuffer(attribute: BufferAttribute): GPUBuffer | null;
};

export function attachDenovoFieldGpuCompute(
  object: Object3D,
  host: DenovoFieldComputeHost
): void {
  const field = object.userData[DENOVO_FIELD_USER_DATA_KEY] as
    | DenovoFieldUserData
    | undefined;

  if (!field || field.pattern !== "streaks" || !field.positions) {
    return;
  }

  const existing = object.userData[DENOVO_FIELD_COMPUTE_KEY] as
    | DenovoFieldStreakCompute
    | undefined;

  if (existing?.device === host.device) {
    object.userData[DENOVO_FIELD_COMPUTE_HOST_KEY] = host;
    return;
  }

  existing?.destroy();
  object.userData[DENOVO_FIELD_COMPUTE_KEY] = createDenovoFieldStreakCompute(
    host.device,
    field.seeds
  );
  object.userData[DENOVO_FIELD_COMPUTE_HOST_KEY] = host;
}

export function detachDenovoFieldGpuCompute(object: Object3D): void {
  const compute = object.userData[DENOVO_FIELD_COMPUTE_KEY] as
    | DenovoFieldStreakCompute
    | undefined;
  compute?.destroy();
  delete object.userData[DENOVO_FIELD_COMPUTE_KEY];
  delete object.userData[DENOVO_FIELD_COMPUTE_HOST_KEY];
}

export function readDenovoFieldComputeDispatches(object: Object3D): number {
  const compute = object.userData[DENOVO_FIELD_COMPUTE_KEY] as
    | DenovoFieldStreakCompute
    | undefined;
  return compute?.dispatches ?? 0;
}

export function readDenovoFieldComputeResidentCopies(object: Object3D): number {
  const compute = object.userData[DENOVO_FIELD_COMPUTE_KEY] as
    | DenovoFieldStreakCompute
    | undefined;
  return compute?.residentCopies ?? 0;
}

export function tickDenovoFieldObject(
  object: Object3D,
  elapsedMs: number
): void {
  const field = object.userData[DENOVO_FIELD_USER_DATA_KEY] as
    | DenovoFieldUserData
    | undefined;

  if (!field) {
    return;
  }

  if (field.pattern === "streaks" && field.positions) {
    const visual = field.visuals[0];
    if (!(visual instanceof LineSegments)) {
      return;
    }
    const positionAttribute = visual.geometry.getAttribute("position");
    const compute = object.userData[DENOVO_FIELD_COMPUTE_KEY] as
      | DenovoFieldStreakCompute
      | undefined;
    const host = object.userData[DENOVO_FIELD_COMPUTE_HOST_KEY] as
      | DenovoFieldComputeHost
      | undefined;
    const destination =
      compute && host && positionAttribute instanceof BufferAttribute
        ? host.readVertexBuffer(positionAttribute)
        : null;
    const applied =
      compute && destination
        ? compute.tick(
            elapsedMs,
            field.props.speed,
            CORRIDOR_FAR,
            CORRIDOR_SPAN,
            destination
          )
        : false;
    if (applied) {
      return;
    }
    writeStreakPositions(field.positions, field.seeds, elapsedMs, field.props.speed);
    if (positionAttribute) {
      positionAttribute.needsUpdate = true;
    }
    return;
  }

  for (const visual of field.visuals) {
    if (!(visual instanceof InstancedMesh)) {
      continue;
    }
    writeLetterMatrices(
      visual,
      visual.userData.glyphSeeds as DenovoFieldSeed[],
      elapsedMs,
      field.props.speed
    );
  }
}
