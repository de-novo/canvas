import type { Object3D } from "three";
import {
  isPluginNodeType,
  pluginNodeKindSupportsMode,
  type Canvas2DPluginNode,
  type Canvas3DPluginNode,
  type CanvasNodeTransformPreview,
  type PluginNodeKindMode,
  type PluginNodeType
} from "@denovo/canvas-core";

export const PLUGIN_NODE_MARKER_FILL = "#64748b";

export type CanvasPluginNodeDrawer = {
  readonly type: PluginNodeType;
  readonly mode: PluginNodeKindMode;
  readonly create3d?: (node: Canvas3DPluginNode) => Object3D;
  readonly draw2d?: (
    context: CanvasRenderingContext2D,
    node: Canvas2DPluginNode,
    preview: CanvasNodeTransformPreview | null
  ) => void;
  readonly localSize2d?: (
    node: Canvas2DPluginNode
  ) => readonly [number, number];
};

const pluginNodeDrawers = new Map<PluginNodeType, CanvasPluginNodeDrawer>();
let pluginNodeDrawerRegistryVersion = 0;

export function getPluginNodeDrawerRegistryVersion(): number {
  return pluginNodeDrawerRegistryVersion;
}

export function registerPluginNodeDrawer(
  drawer: CanvasPluginNodeDrawer
): () => void {
  if (!isPluginNodeType(drawer.type)) {
    throw new TypeError(
      `Plugin node drawer type must use plugin.<owner>.<kind>: ${String(drawer.type)}`
    );
  }

  if (
    drawer.mode !== "2d" &&
    drawer.mode !== "3d" &&
    drawer.mode !== "both"
  ) {
    throw new TypeError("Plugin node drawers support mode 2d, 3d, or both.");
  }

  if (pluginNodeDrawers.has(drawer.type)) {
    throw new TypeError(`Plugin node drawer is already registered: ${drawer.type}`);
  }

  pluginNodeDrawers.set(drawer.type, drawer);
  pluginNodeDrawerRegistryVersion += 1;
  return () => {
    if (pluginNodeDrawers.delete(drawer.type)) {
      pluginNodeDrawerRegistryVersion += 1;
    }
  };
}

export function getPluginNodeDrawer(
  type: PluginNodeType
): CanvasPluginNodeDrawer | undefined {
  return pluginNodeDrawers.get(type);
}

export function resolveHostPluginNodeLocalSize2d(
  node: Canvas2DPluginNode
): readonly [number, number] | undefined {
  const drawer = pluginNodeDrawers.get(node.type);
  if (
    !drawer ||
    !pluginNodeKindSupportsMode(drawer.mode, "2d") ||
    !drawer.localSize2d
  ) {
    return undefined;
  }

  return drawer.localSize2d(node);
}

export function resolveHostPluginNodeDraw2d(
  node: Canvas2DPluginNode
): CanvasPluginNodeDrawer["draw2d"] | undefined {
  const drawer = pluginNodeDrawers.get(node.type);
  if (
    !drawer ||
    !pluginNodeKindSupportsMode(drawer.mode, "2d") ||
    !drawer.draw2d
  ) {
    return undefined;
  }

  return drawer.draw2d;
}

export function resolveHostPluginNodeCreate3d(
  node: Canvas3DPluginNode
): CanvasPluginNodeDrawer["create3d"] | undefined {
  const drawer = pluginNodeDrawers.get(node.type);
  if (
    !drawer ||
    !pluginNodeKindSupportsMode(drawer.mode, "3d") ||
    !drawer.create3d
  ) {
    return undefined;
  }

  return drawer.create3d;
}
