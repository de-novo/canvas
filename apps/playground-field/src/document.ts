import { defineDocument, type CanvasDocument } from "@denovo/canvas";

export const FIELD_NODE_ID = "field";
export const FIELD_LAYER_ID = "hero";

export function createWarpFieldDocument(): CanvasDocument {
  return defineDocument({
    id: "warp-field",
    title: "Warp field",
    scene: {
      background: "#02040a",
      camera: {
        fov: 60,
        position: [0, 1.1, 14],
        target: [0, 0, -6]
      },
      id: "warp-field-scene",
      layers: [{ id: FIELD_LAYER_ID, name: "Hero" }],
      mode: "3d",
      nodes: [
        {
          id: FIELD_NODE_ID,
          layerId: FIELD_LAYER_ID,
          props: {
            brightness: 1,
            density: 0.6,
            hue: 210,
            pattern: "streaks",
            speed: 15
          },
          type: "plugin.denovo.field"
        }
      ],
      render: {
        dpr: 1.5,
        frustumCulling: false,
        loop: "always"
      }
    }
  });
}
