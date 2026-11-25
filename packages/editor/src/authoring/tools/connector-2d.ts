import {
  CANVAS_NODE_PORT_SIDES,
  define2DEdge,
  type CanvasAuthoringPreviewForMode,
  type CanvasCreateId,
  type CanvasDocument,
  type CanvasLayerId,
  type CanvasNodePortSide,
  type CanvasToolContext,
  type CanvasToolDefinition,
  type NodeId
} from "@de-novo/canvas-core";
import { CanvasEditorError } from "../../errors.js";
import {
  acquireAuthoringPreviewLease,
  assertSessionDocument,
  clearAuthoringSession,
  clearAuthoringSessionOnDeactivate,
  createAuthoringNodeId,
  publishOwnedAuthoringPreviews,
  requireAuthoringCapabilities
} from "../coordinator.js";
import type { CanvasConnectorToolOptions } from "../tool-options.js";
import { requireToolHitTest } from "../../index.js";

type ConnectorSession = {
  readonly document: CanvasDocument;
  readonly layerId: CanvasLayerId;
  readonly sourceId: NodeId;
  readonly sourceHandle: CanvasNodePortSide | null;
  readonly pointerId: number;
  readonly previewLease: ReturnType<typeof acquireAuthoringPreviewLease>;
  readonly createId: CanvasCreateId;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly lineStyle: "solid" | "dashed" | "dotted";
  readonly targetArrow: boolean;
  readonly curve: "straight" | "curved";
  readonly curveOffset: number;
};

export function createConnectorTool<const TId extends string>(
  options: CanvasConnectorToolOptions<TId> & { readonly id: TId }
): CanvasToolDefinition<TId>;
export function createConnectorTool(
  options: CanvasConnectorToolOptions
): CanvasToolDefinition;
export function createConnectorTool(
  options: CanvasConnectorToolOptions
): CanvasToolDefinition {
  if (typeof options.createId !== "function") {
    throw new CanvasEditorError(
      "invalid-id",
      "A createId function is required for a connector tool."
    );
  }

  const sessions = new WeakMap<CanvasToolContext, ConnectorSession>();
  const label = options.label ?? "Connect";

  const stroke = options.stroke ?? "#94a3b8";
  const strokeWidth = options.strokeWidth ?? 2;
  const lineStyle = options.lineStyle ?? "solid";
  const targetArrow = options.targetArrow ?? true;
  const curve = options.curve ?? "straight";
  const curveOffset = options.curveOffset ?? 0;

  return {
    connectionHandles: true,
    cursor: options.cursor ?? "crosshair",
    id: options.id ?? "connect",
    label,
    // Panning stays live mid-connection (spacebar drag / trackpad) so a distant
    // target node is reachable; zoom is suppressed to keep the drag stable.
    navigation: "allow-pan",
    onDeactivate(context) {
      clearAuthoringSessionOnDeactivate(sessions, context);
    },
    async onInput(input, context) {
      if (input.type === "key.down") {
        if (input.key === "Escape") {
          await clearAuthoringSession(sessions, context);
        }
        return;
      }

      if (input.type === "key.up" || !("pointerId" in input)) {
        return;
      }

      if (input.type === "pointer.cancel" || input.type === "pointer.leave") {
        await clearAuthoringSession(sessions, context);
        return;
      }

      if (input.type === "pointer.down") {
        if (!input.isPrimary || input.button !== 0) {
          return;
        }

        const document = context.getDocument();
        const hitTest = requireToolHitTest(context);
        const hit = await hitTest({ point: input.point });

        if (hit.kind !== "node") {
          return;
        }

        const layerId = options.layerId;
        const capabilities = requireAuthoringCapabilities(context);
        const previewLease = acquireAuthoringPreviewLease(
          context,
          capabilities.setPreviews
        );

        sessions.set(context, {
          document,
          layerId,
          sourceId: hit.nodeId,
          sourceHandle: parseConnectorHandleSide(hit.subTarget),
          pointerId: input.pointerId,
          previewLease,
          createId: options.createId,
          stroke,
          strokeWidth,
          lineStyle,
          targetArrow,
          curve,
          curveOffset
        });
        return;
      }

      const session = sessions.get(context);

      if (!session || session.pointerId !== input.pointerId) {
        return;
      }

      if (input.type !== "pointer.move" && input.type !== "pointer.up") {
        return;
      }

      try {
        assertSessionDocument(context, session);

        const draft = createEdgeDraftPreview(
          session.sourceId,
          session.sourceHandle,
          input.point,
          session.stroke,
          session.strokeWidth,
          session.lineStyle,
          session.targetArrow
        );

        const published = await publishOwnedAuthoringPreviews(
          sessions,
          context,
          session,
          [draft]
        );

        if (input.type === "pointer.up" && published) {
          const targetHitTest = requireToolHitTest(context);
          const targetHit = await targetHitTest({ point: input.point });

          if (targetHit.kind === "node" && targetHit.nodeId !== session.sourceId) {
            const targetHandle = parseConnectorHandleSide(targetHit.subTarget);
            // The grabbed sides become the edge's ports, so the committed edge
            // attaches exactly where the user picked it up and dropped it.
            const edge = define2DEdge({
              id: createAuthoringNodeId(
                session.createId,
                session.document,
                "2d",
                "edge"
              ),
              type: "edge",
              layerId: session.layerId,
              sourceId: session.sourceId,
              targetId: targetHit.nodeId,
              sourcePort: session.sourceHandle,
              targetPort: targetHandle,
              routing: "straight",
              curve: session.curve,
              curveOffset: session.curveOffset,
              stroke: session.stroke,
              strokeWidth: session.strokeWidth,
              lineStyle: session.lineStyle,
              targetArrow: session.targetArrow
            });

            await context.dispatch({
              label,
              node: edge,
              type: "node.add"
            });
          }
        }
      } finally {
        if (input.type === "pointer.up") {
          await clearAuthoringSession(sessions, context);
        }
      }
    }
  };
}

/**
 * Reads a `handle.<side>` hit subTarget produced by the 2D renderer. Anything
 * else — including a plain node-body hit — means "no port", which attaches the
 * edge to the node centre.
 */
function parseConnectorHandleSide(
  subTarget: string | undefined
): CanvasNodePortSide | null {
  const side = subTarget?.startsWith("handle.")
    ? subTarget.slice("handle.".length)
    : null;

  return side !== null &&
    (CANVAS_NODE_PORT_SIDES as readonly string[]).includes(side)
    ? (side as CanvasNodePortSide)
    : null;
}

function createEdgeDraftPreview(
  sourceId: NodeId,
  sourcePort: CanvasNodePortSide | null,
  targetPoint: readonly [number, number],
  stroke: string,
  strokeWidth: number,
  lineStyle: "solid" | "dashed" | "dotted",
  targetArrow: boolean
): CanvasAuthoringPreviewForMode<"2d"> {
  return {
    kind: "edge.draft",
    mode: "2d",
    sourceId,
    sourcePort,
    targetPoint,
    stroke,
    strokeWidth,
    lineStyle,
    targetArrow
  } as unknown as CanvasAuthoringPreviewForMode<"2d">;
}
