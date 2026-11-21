import { defineDocument, type CanvasDocument } from "@denovo/canvas/2d";

import { encodeNetworkService, type NetworkService } from "./cards";

const GRAPH_LAYER = "graph";
const LABELS_LAYER = "labels";

export const NETWORK_HUB_ID = "api";
export const NETWORK_LABEL_LAYER_ID = LABELS_LAYER;
export const NETWORK_HUB_POSITION = [80, 168] as const;
export const NETWORK_LABEL_NODE_IDS = ["title", "subtitle"] as const;
export const NETWORK_SERVICE_NODE_IDS = [
  "api",
  "gateway",
  "postgres",
  "auth",
  "billing",
  "redis",
  "queue",
  "worker",
  "warehouse"
] as const;

export const CARD_WIDTH = 200;
export const CARD_HEIGHT = 96;

const COLUMN = 248;
const ROW = 132;
const ORIGIN_X = 80;
const ORIGIN_Y = 168;

const day = 24 * 60 * 60 * 1000;
const week0 = Date.UTC(2026, 7, 3);

export const NETWORK_DEPLOYED_AT: Readonly<Record<string, number>> = {
  gateway: week0,
  api: week0,
  auth: week0 + 7 * day,
  billing: week0 + 7 * day,
  worker: week0 + 14 * day,
  queue: week0 + 14 * day,
  postgres: week0,
  redis: week0 + 7 * day
};

function cell(column: number, row: number): readonly [number, number] {
  return [ORIGIN_X + column * COLUMN, ORIGIN_Y + row * ROW];
}

function serviceNode(
  id: string,
  position: readonly [number, number],
  service: NetworkService
) {
  return {
    height: CARD_HEIGHT,
    html: encodeNetworkService(service),
    id,
    layerId: GRAPH_LAYER,
    position: [position[0], position[1]] as [number, number],
    type: "html" as const,
    width: CARD_WIDTH
  };
}

function edge(
  id: string,
  sourceId: string,
  targetId: string,
  sourcePort: "top" | "right" | "bottom" | "left",
  targetPort: "top" | "right" | "bottom" | "left"
) {
  return {
    id,
    layerId: GRAPH_LAYER,
    routing: "orthogonal" as const,
    sourceId,
    sourcePort,
    stroke: "#64748b",
    strokeWidth: 1.5,
    targetArrow: true,
    targetId,
    targetPort,
    type: "edge" as const
  };
}

export function createServiceMapDocument(): CanvasDocument {
  return defineDocument({
    id: "service-map",
    title: "Service map",
    scene: {
      background: "#060910",
      id: "service-map-scene",
      layers: [
        { id: GRAPH_LAYER, name: "Graph" },
        { id: LABELS_LAYER, name: "Labels" }
      ],
      mode: "2d",
      nodes: [
        {
          fill: "#f8fafc",
          fontSize: 28,
          fontWeight: "bold",
          id: "title",
          layerId: LABELS_LAYER,
          position: [80, 44],
          text: "Service map",
          type: "text"
        },
        {
          fill: "#94a3b8",
          fontSize: 14,
          id: "subtitle",
          layerId: LABELS_LAYER,
          position: [80, 80],
          text: "Gateway blast radius",
          type: "text"
        },
        serviceNode("api", cell(0, 0), {
          owner: "Platform",
          role: "api",
          title: "API"
        }),
        serviceNode("gateway", cell(0, 1), {
          owner: "Edge",
          role: "edge",
          title: "Gateway"
        }),
        serviceNode("postgres", cell(0, 2), {
          owner: "Data",
          role: "data",
          title: "Postgres"
        }),
        serviceNode("auth", cell(1, 0), {
          owner: "Identity",
          role: "auth",
          title: "Auth"
        }),
        serviceNode("billing", cell(1, 1), {
          owner: "Payments",
          role: "api",
          title: "Billing"
        }),
        serviceNode("redis", cell(1, 2), {
          owner: "Data",
          role: "data",
          title: "Redis"
        }),
        serviceNode("queue", cell(2, 0), {
          owner: "Jobs",
          role: "worker",
          title: "Queue"
        }),
        serviceNode("worker", cell(2, 1), {
          owner: "Jobs",
          role: "worker",
          title: "Worker"
        }),
        serviceNode("warehouse", [ORIGIN_X + COLUMN * 3 + 24, ORIGIN_Y], {
          owner: "Analytics",
          role: "external",
          title: "Warehouse"
        }),
        edge("edge-gateway-api", "gateway", "api", "top", "bottom"),
        edge("edge-api-auth", "api", "auth", "right", "left"),
        edge("edge-api-billing", "api", "billing", "right", "left"),
        edge("edge-api-worker", "api", "worker", "right", "left"),
        edge("edge-worker-queue", "worker", "queue", "top", "bottom"),
        edge("edge-queue-postgres", "queue", "postgres", "left", "right"),
        edge("edge-api-redis", "api", "redis", "right", "left")
      ]
    }
  });
}
