/**
 * Host-owned region/mask rasterizer. Canvas ships the 2D document of
 * `rect` / `circle` nodes plus `metadata.role`; the consuming product
 * turns that JSON into a mask buffer in its own pipeline.
 *
 * Unknown mask kinds are reported, not invented. A polygon kind is not
 * implied here.
 */

/**
 * @typedef {{
 *   data: Uint8ClampedArray,
 *   height: number,
 *   kinds: string[],
 *   origin: readonly [number, number],
 *   pixelCount: number,
 *   unsupportedKinds: string[],
 *   width: number
 * }} RegionMaskRaster
 */

/**
 * Rasterize visible `metadata.role === "mask"` nodes into a white-on-black
 * buffer covering `origin` + `width` × `height` in scene units (1:1 pixels).
 *
 * @param {{
 *   scene?: {
 *     layers?: readonly { id?: string, visible?: boolean }[],
 *     mode?: string,
 *     nodes?: readonly Record<string, unknown>[]
 *   }
 * }} document
 * @param {{
 *   height: number,
 *   origin?: readonly [number, number],
 *   width: number
 * }} options
 * @returns {RegionMaskRaster}
 */
export function rasterizeRegionMask(document, options) {
  const width = Math.max(1, Math.floor(options.width));
  const height = Math.max(1, Math.floor(options.height));
  const origin = options.origin ?? [0, 0];
  const data = new Uint8ClampedArray(width * height * 4);
  const kinds = [];
  const unsupportedKinds = [];

  const scene = document?.scene;
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

  const layersById = new Map();
  for (const layer of scene.layers ?? []) {
    if (layer && typeof layer.id === "string") {
      layersById.set(layer.id, layer);
    }
  }

  const nodesById = new Map();
  for (const node of scene.nodes) {
    if (node && typeof node.id === "string") {
      nodesById.set(node.id, node);
    }
  }

  for (const node of scene.nodes) {
    if (!isMaskNode(node)) {
      continue;
    }
    if (!isEffectivelyVisible(node, layersById, nodesById)) {
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

/**
 * @param {RegionMaskRaster} mask
 * @param {number} x
 * @param {number} y
 */
export function sampleRegionMask(mask, x, y) {
  const column = Math.floor(x);
  const row = Math.floor(y);
  if (column < 0 || row < 0 || column >= mask.width || row >= mask.height) {
    return 0;
  }
  return mask.data[(row * mask.width + column) * 4] ?? 0;
}

/**
 * Apply a host image color through the mask. White mask pixels keep the
 * image; everything else stays transparent.
 *
 * @param {RegionMaskRaster} mask
 * @param {readonly [number, number, number]} color
 * @returns {Uint8ClampedArray}
 */
export function applyRegionMask(mask, color) {
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

function isMaskNode(node) {
  return Boolean(
    node &&
      typeof node === "object" &&
      node.metadata &&
      typeof node.metadata === "object" &&
      node.metadata.role === "mask"
  );
}

function isEffectivelyVisible(node, layersById, nodesById) {
  if (node.visible === false) {
    return false;
  }
  const layer = layersById.get(node.layerId);
  if (layer && layer.visible === false) {
    return false;
  }
  let parentId = node.parentId;
  const seen = new Set();
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

function fillRect(data, width, height, origin, node) {
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

function fillCircle(data, width, height, origin, node) {
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

function stamp(data, width, x, y) {
  const offset = (y * width + x) * 4;
  data[offset] = 255;
  data[offset + 1] = 255;
  data[offset + 2] = 255;
  data[offset + 3] = 255;
}

function countOpaque(data) {
  let count = 0;
  for (let index = 3; index < data.length; index += 4) {
    if ((data[index] ?? 0) > 127) {
      count += 1;
    }
  }
  return count;
}

function asPoint(value) {
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
