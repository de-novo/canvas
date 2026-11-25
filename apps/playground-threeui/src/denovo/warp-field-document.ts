import { defineDocument, type CanvasDocument, type JsonValue } from "@de-novo/canvas-core";

export const WARP_FIELD_PLUGIN_KEY = "threeui.warp-field";
export const WARP_FIELD_VARIANTS = ["streaks", "letters", "keycaps", "hyperspace"] as const;
export type WarpFieldVariant = (typeof WARP_FIELD_VARIANTS)[number];

export type WarpFieldPluginState = {
  readonly variant: WarpFieldVariant;
  readonly speed: number;
  readonly streakOpacity: number;
  readonly tileOpacity: number;
  readonly fov: number;
  readonly brightness: number;
  readonly hue: number;
  readonly saturation: number;
};

export const WARP_FIELD_DEFAULTS: WarpFieldPluginState = {
  variant: "streaks",
  speed: 15,
  streakOpacity: 0.6,
  tileOpacity: 0.9,
  fov: 75,
  brightness: 1,
  hue: 0,
  saturation: 1
};

export function readWarpFieldState(document: CanvasDocument): WarpFieldPluginState {
  const value = document.pluginState[WARP_FIELD_PLUGIN_KEY];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return WARP_FIELD_DEFAULTS;
  }
  const record = value as { readonly [key: string]: JsonValue };
  const variant = WARP_FIELD_VARIANTS.find((item) => item === record.variant);
  const num = (key: "speed" | "streakOpacity" | "tileOpacity" | "fov" | "brightness" | "hue" | "saturation", fallback: number) => {
    const value = record[key];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  };
  return {
    variant: variant ?? WARP_FIELD_DEFAULTS.variant,
    speed: num("speed", WARP_FIELD_DEFAULTS.speed),
    streakOpacity: num("streakOpacity", WARP_FIELD_DEFAULTS.streakOpacity),
    tileOpacity: num("tileOpacity", WARP_FIELD_DEFAULTS.tileOpacity),
    fov: num("fov", WARP_FIELD_DEFAULTS.fov),
    brightness: num("brightness", WARP_FIELD_DEFAULTS.brightness),
    hue: num("hue", WARP_FIELD_DEFAULTS.hue),
    saturation: num("saturation", WARP_FIELD_DEFAULTS.saturation)
  };
}

export function createWarpFieldDocument(
  variant: WarpFieldVariant = "streaks"
): CanvasDocument {
  const state = { ...WARP_FIELD_DEFAULTS, variant };
  return defineDocument({
    id: `warp-field-${variant}`,
    title: `Warp Field ${variant}`,
    scene: {
      id: `warp-field-${variant}-scene`,
      mode: "3d",
      background: "#02040a",
      layers: [{ id: "main", name: "Main" }],
      render: { loop: "always", dpr: 1.5, frustumCulling: true },
      camera: { position: [0, 0, 0], target: [0, 0, -1], fov: state.fov },
      nodes: []
    },
    pluginState: { [WARP_FIELD_PLUGIN_KEY]: state }
  });
}
