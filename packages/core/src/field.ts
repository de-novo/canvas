import { z } from "zod";
import {
  definePluginNodeKind,
  registerPluginNodeKind,
  type PluginNodeType
} from "./plugin-nodes.js";

export const DENOVO_FIELD_NODE_TYPE = "plugin.denovo.field" satisfies PluginNodeType;

export const DenovoFieldPatternSchema = z.enum(["streaks", "letters"]);

export const DenovoFieldPropsSchema = z
  .object({
    brightness: z.number().finite().min(0).max(2),
    density: z.number().finite().min(0).max(1),
    hue: z.number().finite().min(0).max(360),
    pattern: DenovoFieldPatternSchema,
    speed: z.number().finite().min(0).max(40)
  })
  .strict();

export type DenovoFieldPattern = z.output<typeof DenovoFieldPatternSchema>;
export type DenovoFieldProps = z.output<typeof DenovoFieldPropsSchema>;

export const denovoFieldKind = definePluginNodeKind({
  mode: "3d",
  props: DenovoFieldPropsSchema,
  type: DENOVO_FIELD_NODE_TYPE
});

registerPluginNodeKind(denovoFieldKind);

export function isDenovoFieldType(
  value: string
): value is typeof DENOVO_FIELD_NODE_TYPE {
  return value === DENOVO_FIELD_NODE_TYPE;
}

export function isDenovoFieldNode<
  T extends { readonly props?: unknown; readonly type: string }
>(
  node: T
): node is T & {
  readonly props: DenovoFieldProps;
  readonly type: typeof DENOVO_FIELD_NODE_TYPE;
} {
  return (
    node.type === DENOVO_FIELD_NODE_TYPE &&
    DenovoFieldPropsSchema.safeParse(node.props).success
  );
}

export function parseDenovoFieldProps(props: unknown): DenovoFieldProps {
  return DenovoFieldPropsSchema.parse(props);
}

export function denovoFieldInstanceCount(density: number): number {
  const clamped = Math.min(1, Math.max(0, density));
  return Math.round(64 + clamped * 1984);
}
