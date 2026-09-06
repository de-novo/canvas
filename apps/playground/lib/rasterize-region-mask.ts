/**
 * Next playground host pipeline. Canvas does not own this rasterizer.
 * Unknown mask kinds are reported, not invented.
 */

export type RegionMaskRaster = {
  data: Uint8ClampedArray;
  height: number;
  kinds: string[];
  origin: readonly [number, number];
  pixelCount: number;
  unsupportedKinds: string[];
  width: number;
};

type MaskDocument = {
  scene?: {
    layers?: readonly { id?: string; visible?: boolean }[];
    mode?: string;
    nodes?: readonly Record<string, unknown>[];
  };
};

export function rasterizeRegionMask(
  document: MaskDocument,
  options: {
    height: number;
    origin?: readonly [number, number];
    width: number;
  }
): RegionMaskRaster {
  const width = Math.max(1, Math.floor(options.width));
  const height = Math.max(1, Math.floor(options.height));
  const origin = options.origin ?? [0, 0];
  const data = new Uint8ClampedArray(width * height * 4);
  const kinds: string[] = [];
  const unsupportedKinds: string[] = [];
  const scene = document.scene;

  if (!scene || scene.mode !== "2d" || !Array.isArray(scene.nodes)) {
    return {
      data,
      height,
      kinds,
      origin: [origin[0], origin[1]],
      pixelCount: 0,
      unsupportedKinds,
      width
    };
  }

  const layersById = new Map<string, { id?: string; visible?: boolean }>();
  for (const layer of scene.layers ?? []) {
    if (layer && typeof layer.id === "string") {
      layersById.set(layer.id, layer);
    }
  }

  const nodesById = new Map<string, Record<string, unknown>>();
  for (const node of scene.nodes) {
    if (node && typeof node.id === "string") {
      nodesById.set(node.id, node);
    }
  }

  for (const node of scene.nodes) {
    if (!isMaskNode(node) || !isEffectivelyVisible(node, layersById, nodesById)) {
      continue;
    }
    if (node.type === "rect") {
      kinds.push("rect");
      fillRect(data, width, height, origin, node);
      continue;
    }
    if (node.type === "circle") {
      kinds.push("circle");
      fillCircle(data, width, height, origin, node);
      continue;
    }
    if (typeof node.type === "string") {
      unsupportedKinds.push(node.type);
    }
  }

  return {
    data,
    height,
    kinds,
    origin: [origin[0], origin[1]],
    pixelCount: countOpaque(data),
    unsupportedKinds,
    width
  };
}

export function sampleRegionMask(
  mask: RegionMaskRaster,
  x: number,
  y: number
): number {
  const column = Math.floor(x);
  const row = Math.floor(y);
  if (column < 0 || row < 0 || column >= mask.width || row >= mask.height) {
    return 0;
  }
  return mask.data[(row * mask.width + column) * 4] ?? 0;
}

export function applyRegionMask(
  mask: RegionMaskRaster,
  color: readonly [number, number, number]
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(mask.data.length);
  for (let index = 0; index < mask.data.length; index += 4) {
    if ((mask.data[index + 3] ?? 0) < 128) {
      continue;
    }
    out[index] = color[0];
    out[index + 1] = color[1];
    out[index + 2] = color[2];
    out[index + 3] = 255;
  }
  return out;
}

function isMaskNode(node: Record<string, unknown>): boolean {
  const metadata = node.metadata;
  return Boolean(
    metadata &&
      typeof metadata === "object" &&
      (metadata as { role?: unknown }).role === "mask"
  );
}

function isEffectivelyVisible(
  node: Record<string, unknown>,
  layersById: Map<string, { visible?: boolean }>,
  nodesById: Map<string, Record<string, unknown>>
): boolean {
  if (node.visible === false) {
    return false;
  }
  const layerId = node.layerId;
  if (typeof layerId === "string") {
    const layer = layersById.get(layerId);
    if (layer && layer.visible === false) {
      return false;
    }
  }
  let parentId = node.parentId;
  const seen = new Set<string>();
  while (typeof parentId === "string" && parentId.length > 0) {
    if (seen.has(parentId)) {
      break;
    }
    seen.add(parentId);
    const parent = nodesById.get(parentId);
    if (!parent) {
      break;
    }
    if (parent.visible === false) {
      return false;
    }
    parentId = parent.parentId;
  }
  return true;
}

function fillRect(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  origin: readonly [number, number],
  node: Record<string, unknown>
) {
  const position = asPoint(node.position);
  const size = asPoint(node.size);
  if (!position || !size) {
    return;
  }
  const minX = Math.max(0, Math.floor(position[0] - origin[0]));
  const minY = Math.max(0, Math.floor(position[1] - origin[1]));
  const maxX = Math.min(width, Math.ceil(position[0] + size[0] - origin[0]));
  const maxY = Math.min(height, Math.ceil(position[1] + size[1] - origin[1]));
  for (let row = minY; row < maxY; row += 1) {
    for (let column = minX; column < maxX; column += 1) {
      stamp(data, width, column, row);
    }
  }
}

function fillCircle(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  origin: readonly [number, number],
  node: Record<string, unknown>
) {
  const position = asPoint(node.position);
  const radius = typeof node.radius === "number" ? node.radius : Number.NaN;
  if (!position || !Number.isFinite(radius) || radius <= 0) {
    return;
  }
  const centerX = position[0] - origin[0];
  const centerY = position[1] - origin[1];
  const radiusSquared = radius * radius;
  const minX = Math.max(0, Math.floor(centerX - radius));
  const minY = Math.max(0, Math.floor(centerY - radius));
  const maxX = Math.min(width, Math.ceil(centerX + radius));
  const maxY = Math.min(height, Math.ceil(centerY + radius));
  for (let row = minY; row < maxY; row += 1) {
    for (let column = minX; column < maxX; column += 1) {
      const dx = column + 0.5 - centerX;
      const dy = row + 0.5 - centerY;
      if (dx * dx + dy * dy <= radiusSquared) {
        stamp(data, width, column, row);
      }
    }
  }
}

function stamp(data: Uint8ClampedArray, width: number, x: number, y: number) {
  const offset = (y * width + x) * 4;
  data[offset] = 255;
  data[offset + 1] = 255;
  data[offset + 2] = 255;
  data[offset + 3] = 255;
}

function countOpaque(data: Uint8ClampedArray) {
  let count = 0;
  for (let index = 3; index < data.length; index += 4) {
    if ((data[index] ?? 0) > 127) {
      count += 1;
    }
  }
  return count;
}

function asPoint(value: unknown): readonly [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }
  const x = value[0];
  const y = value[1];
  if (typeof x !== "number" || typeof y !== "number") {
    return null;
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return [x, y];
}
