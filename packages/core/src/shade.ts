import { z } from "zod";
import {
  definePluginNodeKind,
  registerPluginNodeKind,
  type PluginNodeType
} from "./plugin-nodes.js";

export const DENOVO_SHADE_NODE_TYPE = "plugin.denovo.shade" satisfies PluginNodeType;

export const DenovoShadePatternSchema = z.enum(["gradient", "wave"]);

export const DenovoShadePropsSchema = z
  .object({
    height: z.number().finite().min(16).max(2048),
    hue: z.number().finite().min(0).max(360),
    pattern: DenovoShadePatternSchema,
    speed: z.number().finite().min(0).max(40),
    width: z.number().finite().min(16).max(2048)
  })
  .strict();

export type DenovoShadePattern = z.output<typeof DenovoShadePatternSchema>;
export type DenovoShadeProps = z.output<typeof DenovoShadePropsSchema>;

export const denovoShadeKind = definePluginNodeKind({
  mode: "2d",
  props: DenovoShadePropsSchema,
  type: DENOVO_SHADE_NODE_TYPE
});

registerPluginNodeKind(denovoShadeKind);

export function isDenovoShadeType(
  value: string
): value is typeof DENOVO_SHADE_NODE_TYPE {
  return value === DENOVO_SHADE_NODE_TYPE;
}

export function isDenovoShadeNode<
  T extends { readonly props?: unknown; readonly type: string }
>(
  node: T
): node is T & {
  readonly props: DenovoShadeProps;
  readonly type: typeof DENOVO_SHADE_NODE_TYPE;
} {
  return (
    node.type === DENOVO_SHADE_NODE_TYPE &&
    DenovoShadePropsSchema.safeParse(node.props).success
  );
}

export function parseDenovoShadeProps(props: unknown): DenovoShadeProps {
  return DenovoShadePropsSchema.parse(props);
}

export function denovoShadeSize(
  props: DenovoShadeProps
): readonly [number, number] {
  return [props.width, props.height];
}

export function denovoShadeHex(
  hue: number,
  lightness: number
): `#${string}` {
  const h = ((hue % 360) + 360) % 360;
  const s = 0.72;
  const l = Math.min(0.78, Math.max(0.18, lightness));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) {
    r = c;
    g = x;
  } else if (hp < 2) {
    r = x;
    g = c;
  } else if (hp < 3) {
    g = c;
    b = x;
  } else if (hp < 4) {
    g = x;
    b = c;
  } else if (hp < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const m = l - c / 2;
  const toHex = (channel: number): string =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function denovoShadeGradientStops(
  props: DenovoShadeProps
): readonly [`#${string}`, `#${string}`] {
  return [
    denovoShadeHex(props.hue, 0.56),
    denovoShadeHex(props.hue + 80, 0.32)
  ];
}

export function denovoShadeStripCount(props: DenovoShadeProps): number {
  return props.pattern === "gradient" ? 1 : 48;
}

export function denovoShadeStripColor(
  props: DenovoShadeProps,
  stripIndex: number,
  stripCount: number,
  elapsedMs: number
): `#${string}` {
  if (props.pattern === "gradient") {
    const t = stripCount <= 1 ? 0 : stripIndex / (stripCount - 1);
    return denovoShadeHex(props.hue + t * 80, 0.56 - t * 0.24);
  }
  const travel = (elapsedMs / 1000) * (props.speed / 40) * 2.2;
  const t = stripCount <= 1 ? 0 : stripIndex / (stripCount - 1);
  const wave = 0.5 + 0.5 * Math.sin((t * Math.PI * 2 + travel) * 1.6);
  return denovoShadeHex(props.hue + wave * 70, 0.28 + wave * 0.32);
}
