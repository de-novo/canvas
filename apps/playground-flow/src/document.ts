import { defineDocument, type CanvasDocument } from "@denovo/canvas";

import { encodeFlowCard } from "./cards";

const BOARD_LAYER = "board";
const LABELS_LAYER = "labels";

const CARD_WIDTH = 200;
const CARD_HEIGHT = 88;
const CARD_Y = 168;
const CARD_GAP = 36;
const CARD_X = [48, 284, 520, 756, 992] as const;

function cardNode(
  id: "intake" | "spec" | "build" | "qa" | "ship",
  index: 0 | 1 | 2 | 3 | 4,
  card: Parameters<typeof encodeFlowCard>[0]
) {
  return {
    height: CARD_HEIGHT,
    html: encodeFlowCard(card),
    id,
    layerId: BOARD_LAYER,
    position: [CARD_X[index], CARD_Y] as [number, number],
    type: "html" as const,
    width: CARD_WIDTH
  };
}

function edge(id: string, sourceId: string, targetId: string, dashed = false) {
  return {
    id,
    layerId: BOARD_LAYER,
    type: "edge" as const,
    routing: "orthogonal" as const,
    sourceId,
    sourcePort: "right" as const,
    stroke: dashed ? "#f59e0b" : "#64748b",
    strokeWidth: 2,
    targetArrow: true,
    targetId,
    targetPort: "left" as const,
    ...(dashed ? { lineStyle: "dashed" as const } : {})
  };
}

export function createReleaseBoardDocument(): CanvasDocument {
  return defineDocument({
    id: "flow-release-board",
    title: "Release board",
    scene: {
      background: "#0b1220",
      id: "flow-release-board-scene",
      layers: [
        { id: BOARD_LAYER, name: "Board" },
        { id: LABELS_LAYER, name: "Labels" }
      ],
      mode: "2d",
      nodes: [
        {
          fill: "#f8fafc",
          fontSize: 22,
          fontWeight: "bold",
          id: "title",
          layerId: LABELS_LAYER,
          position: [48, 48],
          text: "Release 0.3",
          type: "text"
        },
        {
          fill: "#94a3b8",
          fontSize: 13,
          id: "subtitle",
          layerId: LABELS_LAYER,
          position: [48, 80],
          text: "Intake → spec → build → QA → ship",
          type: "text"
        },
        cardNode("intake", 0, {
          owner: "Product",
          status: "ready",
          title: "Intake"
        }),
        cardNode("spec", 1, {
          owner: "Design",
          status: "review",
          title: "Spec"
        }),
        cardNode("build", 2, {
          owner: "Engineering",
          status: "progress",
          title: "Build"
        }),
        cardNode("qa", 3, {
          owner: "QA",
          status: "blocked",
          title: "QA"
        }),
        cardNode("ship", 4, {
          owner: "Release",
          status: "done",
          title: "Ship"
        }),
        edge("edge-intake-spec", "intake", "spec"),
        edge("edge-spec-build", "spec", "build"),
        edge("edge-build-qa", "build", "qa", true),
        edge("edge-qa-ship", "qa", "ship")
      ]
    }
  });
}

export const FLOW_LABEL_LAYER_ID = LABELS_LAYER;
