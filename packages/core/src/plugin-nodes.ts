import { z } from "zod";

export type PluginSceneMode = "2d" | "3d";
export type PluginNodeKindMode = PluginSceneMode | "both";

export type PluginNodeType = `plugin.${string}.${string}`;

export function pluginNodeKindSupportsMode(
  kindMode: PluginNodeKindMode,
  sceneMode: PluginSceneMode
): boolean {
  return kindMode === "both" || kindMode === sceneMode;
}

const PLUGIN_NODE_TYPE_PATTERN = /^plugin\.[a-z][a-z0-9]*\.[a-z][a-z0-9-]*$/u;

export function isPluginNodeType(value: string): value is PluginNodeType {
  return PLUGIN_NODE_TYPE_PATTERN.test(value);
}

export function isCanvas2DPluginNode<
  TNode extends { readonly type: string }
>(node: TNode): node is TNode & { readonly type: PluginNodeType } {
  return isPluginNodeType(node.type);
}

export const PluginNodeTypeSchema = z.custom<PluginNodeType>(
  (value) => typeof value === "string" && isPluginNodeType(value),
  "Plugin node type must use plugin.<owner>.<kind> in lower-case."
);

export type CanvasPluginNodeKind<
  TType extends PluginNodeType = PluginNodeType,
  TProps = unknown,
  TMode extends PluginNodeKindMode = PluginNodeKindMode
> = {
  readonly mode: TMode;
  readonly props: z.ZodType<TProps>;
  readonly type: TType;
};

const pluginNodeKinds = new Map<PluginNodeType, CanvasPluginNodeKind>();

export function definePluginNodeKind<
  const TType extends PluginNodeType,
  TProps,
  const TMode extends PluginNodeKindMode
>(definition: {
  readonly mode: TMode;
  readonly props: z.ZodType<TProps>;
  readonly type: TType;
}): CanvasPluginNodeKind<TType, TProps, TMode> {
  if (
    definition.mode !== "2d" &&
    definition.mode !== "3d" &&
    definition.mode !== "both"
  ) {
    throw new TypeError("Plugin node kinds support mode 2d, 3d, or both.");
  }

  PluginNodeTypeSchema.parse(definition.type);
  return {
    mode: definition.mode,
    props: definition.props,
    type: definition.type
  };
}

export function registerPluginNodeKind<
  TType extends PluginNodeType,
  TProps
>(kind: CanvasPluginNodeKind<TType, TProps>): () => void {
  if (pluginNodeKinds.has(kind.type)) {
    throw new TypeError(`Plugin node kind is already registered: ${kind.type}`);
  }

  pluginNodeKinds.set(kind.type, kind);
  return () => {
    pluginNodeKinds.delete(kind.type);
  };
}

export function getPluginNodeKind(
  type: PluginNodeType
): CanvasPluginNodeKind | undefined {
  return pluginNodeKinds.get(type);
}

export type ListedPluginNodeKind = {
  readonly mode: PluginNodeKindMode;
  readonly type: PluginNodeType;
};

export function listPluginNodeKinds(): readonly ListedPluginNodeKind[] {
  return Array.from(pluginNodeKinds.values(), (kind) => ({
    mode: kind.mode,
    type: kind.type
  }));
}

export function parsePluginNodeProps(
  type: PluginNodeType,
  props: unknown,
  mode: PluginSceneMode
): unknown {
  const kind = pluginNodeKinds.get(type);

  if (!kind) {
    throw new TypeError(`Plugin node kind is not registered: ${type}`);
  }

  if (!pluginNodeKindSupportsMode(kind.mode, mode)) {
    throw new TypeError(
      `Plugin node kind ${type} does not support scene mode ${mode}.`
    );
  }

  return kind.props.parse(props);
}
