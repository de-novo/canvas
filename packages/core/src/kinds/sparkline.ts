import { z } from "zod";
import {
  definePluginNodeKind,
  registerPluginNodeKind,
  type PluginNodeType
} from "../plugin-nodes.js";

export const DENOVO_SPARKLINE_NODE_TYPE =
  "plugin.denovo.sparkline" satisfies PluginNodeType;

export const DenovoSparklineStyleSchema = z.enum(["linear", "step"]);

const DenovoSparklineHexSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/u, "Sparkline colors must be lowercase #rrggbb.");

export const DenovoSparklinePropsSchema = z
  .object({
    fill: z.union([DenovoSparklineHexSchema, z.literal("none")]),
    height: z.number().finite().min(8).max(512),
    stroke: DenovoSparklineHexSchema,
    style: DenovoSparklineStyleSchema,
    values: z.array(z.number().finite()).min(2).max(64),
    width: z.number().finite().min(16).max(1024)
  })
  .strict();

export type DenovoSparklineStyle = z.output<typeof DenovoSparklineStyleSchema>;
export type DenovoSparklineProps = z.output<typeof DenovoSparklinePropsSchema>;
export type DenovoSparklinePoint = readonly [number, number];

export const denovoSparklineKind = definePluginNodeKind({
  mode: "2d",
  props: DenovoSparklinePropsSchema,
  type: DENOVO_SPARKLINE_NODE_TYPE
});

registerPluginNodeKind(denovoSparklineKind);

export function isDenovoSparklineType(
  value: string
): value is typeof DENOVO_SPARKLINE_NODE_TYPE {
  return value === DENOVO_SPARKLINE_NODE_TYPE;
}

export function isDenovoSparklineNode<
  T extends { readonly props?: unknown; readonly type: string }
>(
  node: T
): node is T & {
  readonly props: DenovoSparklineProps;
  readonly type: typeof DENOVO_SPARKLINE_NODE_TYPE;
} {
  return (
    node.type === DENOVO_SPARKLINE_NODE_TYPE &&
    DenovoSparklinePropsSchema.safeParse(node.props).success
  );
}

export function parseDenovoSparklineProps(props: unknown): DenovoSparklineProps {
  return DenovoSparklinePropsSchema.parse(props);
}

export function denovoSparklineSize(
  props: DenovoSparklineProps
): readonly [number, number] {
  return [props.width, props.height];
}

export function denovoSparklinePoints(
  props: DenovoSparklineProps
): readonly DenovoSparklinePoint[] {
  const parsed = DenovoSparklinePropsSchema.parse(props);
  const last = parsed.values.length - 1;
  const min = Math.min(...parsed.values);
  const max = Math.max(...parsed.values);
  const span = max - min || 1;
  const yAt = (value: number): number =>
    parsed.height - ((value - min) / span) * parsed.height;

  if (parsed.style === "linear") {
    return parsed.values.map((value, index) => [
      (index / last) * parsed.width,
      yAt(value)
    ]);
  }

  const points: DenovoSparklinePoint[] = [];

  for (const [index, value] of parsed.values.entries()) {
    const x = (index / last) * parsed.width;
    const y = yAt(value);

    if (index === 0) {
      points.push([x, y]);
      continue;
    }

    const previous = points[points.length - 1];

    if (!previous) {
      points.push([x, y]);
      continue;
    }

    points.push([x, previous[1]], [x, y]);
  }

  return points;
}
