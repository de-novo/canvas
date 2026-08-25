import {
  createRelationGraphLayoutAdapter,
  createTimeGraphLayoutAdapter,
  type CanvasEditor
} from "@denovo/canvas";

import { NETWORK_DEPLOYED_AT, NETWORK_SERVICE_NODE_IDS } from "./document";

export type NetworkLayoutName =
  | "layout.relation-graph"
  | "layout.time-graph";

export function registerNetworkLayouts(editor: CanvasEditor): void {
  editor.registerLayoutAdapter(createRelationGraphLayoutAdapter());
  editor.registerLayoutAdapter(createTimeGraphLayoutAdapter());
}

export function applyNetworkLayout(
  editor: CanvasEditor,
  name: NetworkLayoutName,
  resolveNodeBounds: (
    ids: readonly string[]
  ) => ReadonlyMap<string, { minX: number; minY: number; maxX: number; maxY: number }>
) {
  return editor.applyLayout(name, {
    nodeIds: [...NETWORK_SERVICE_NODE_IDS],
    options:
      name === "layout.time-graph"
        ? {
            at: NETWORK_DEPLOYED_AT,
            columnGap: 248,
            laneGap: 132,
            origin: [48, 140]
          }
        : {
            componentGap: 220,
            laneGap: 132,
            layerGap: 248,
            origin: [48, 140]
          },
    resolveNodeBounds
  });
}
