import {
  BoxNodeSchema,
  Canvas2DAnnotationNodeSchema,
  Canvas2DMeasurementNodeSchema,
  Canvas3DAnnotationNodeSchema,
  Canvas3DMeasurementNodeSchema,
  Canvas3DSurfacePointResultSchema,
  CanvasAuthoringPreviewSchema,
  CanvasMeasurementUnitSchema,
  CircleNodeSchema,
  RectNodeSchema,
  SphereNodeSchema,
  type Canvas2DGrid,
  type Canvas3DGrid,
  type Canvas3DSurfacePointResult,
  type CanvasAuthoringPreview,
  type CanvasAuthoringPreviewForMode,
  type CanvasCoordinateForMode,
  type CanvasCreateId,
  type CanvasDocument,
  type CanvasGridForMode,
  type CanvasLayerId,
  type CanvasMeasurementUnit,
  type CanvasMode,
  type CanvasNodeByType,
  type CanvasToolContext,
  type CanvasToolDefinition,
  type CanvasWorkPlane,
  type NodeId,
  type Point2,
  type Vector3
} from "@denovo/canvas-core";
import { CanvasEditorError } from "../../errors.js";
import {
  parse2DGrid,
  parse3DGrid,
  parseWorkPlane,
  snapPointToGrid,
  validateGridWorkPlaneCompatibility
} from "../../grid.js";
import { getEffectiveNodeState } from "../../node-state.js";
import { isPlainObject } from "../../utils.js";
import { vectorLength3 } from "../../math/transform.js";
import {
  acquireAuthoringPreviewLease,
  assertSessionDocument,
  clearAuthoringSession,
  clearAuthoringSessionOnDeactivate,
  create2DPreviewEntries,
  create3DPreviewEntries,
  createAuthoringNodeId,
  parseNodeId,
  publishOwnedAuthoringPreviews,
  requireAuthoringCapabilities,
  requireAuthoringTarget,
  requireSurfacePlacementCapabilities,
  resolve2DAuthoringPoint,
  resolve3DAuthoringPoint,
  takeAuthoringDeactivationCleanups,
  type AuthoringSessionBase,
  type PendingAuthoringStart,
  type Primitive3DSession,
  type ScenePointResolver,
  type Shape2DSession,
  type SurfacePlacementGhost,
  type SurfacePlacementGhostPreview,
  type SurfacePlacementSession,
  type SurfacePlacementUpdate,
  type SurfacePointResolver
} from "../coordinator.js";
import type {
  Canvas2DShapeToolOptions
} from "../tool-options.js";

export function create2DShapeTool<const TId extends string>(
  options: Canvas2DShapeToolOptions<TId> & { readonly id: TId }
): CanvasToolDefinition<TId>;
export function create2DShapeTool(
  options: Canvas2DShapeToolOptions
): CanvasToolDefinition;
export function create2DShapeTool(
  options: Canvas2DShapeToolOptions
): CanvasToolDefinition {
  if (options.mode !== "2d") {
    throw new CanvasEditorError("mode-mismatch", "A 2D shape tool requires mode 2d.");
  }

  if (typeof options.createId !== "function") {
    throw new CanvasEditorError("invalid-id", "A createId function is required.");
  }

  const grid = options.grid ? parse2DGrid(options.grid) : undefined;
  const sessions = new WeakMap<CanvasToolContext, Shape2DSession>();
  const pendingStarts = new WeakMap<CanvasToolContext, PendingAuthoringStart>();
  const label = options.label ?? (options.type === "rect" ? "Rectangle" : "Circle");

  return {
    cursor: options.cursor ?? "crosshair",
    id: options.id ?? `create.${options.type}`,
    label,
    navigation: "block",
    onDeactivate(context) {
      clearAuthoringSessionOnDeactivate(pendingStarts, context);
      clearAuthoringSessionOnDeactivate(sessions, context);
    },
    async onInput(input, context) {
      if (input.type === "key.down") {
        if (input.key === "Escape") {
          clearAuthoringSessionOnDeactivate(pendingStarts, context);
          await clearAuthoringSession(sessions, context);
        }

        return;
      }

      if (input.type === "key.up") {
        return;
      }

      if (!("pointerId" in input)) {
        return;
      }

      if (input.type === "pointer.cancel" || input.type === "pointer.leave") {
        clearAuthoringSessionOnDeactivate(pendingStarts, context);
        await clearAuthoringSession(sessions, context);
        return;
      }

      if (input.type === "pointer.down") {
        if (!input.isPrimary || input.button !== 0) {
          return;
        }

        const document = context.getDocument();
        const layerId = requireAuthoringTarget(document, "2d", options.layerId);
        const capabilities = requireAuthoringCapabilities(context);
        const pendingStart: PendingAuthoringStart = {
          previewLease: acquireAuthoringPreviewLease(
            context,
            capabilities.setPreviews
          )
        };
        clearAuthoringSessionOnDeactivate(pendingStarts, context);
        pendingStarts.set(context, pendingStart);

        try {
          await clearAuthoringSession(sessions, context);

          if (pendingStarts.get(context) !== pendingStart) {
            return;
          }

          const start = await resolve2DAuthoringPoint(
            capabilities.resolveScenePoint,
            input.point,
            grid
          );

          if (pendingStarts.get(context) !== pendingStart) {
            return;
          }

          const nodeId = createAuthoringNodeId(
            options.createId,
            document,
            "2d",
            options.type
          );
          const node = create2DShapeNode(options, layerId, nodeId, start, start);
          const published = await publishOwnedAuthoringPreviews(
            pendingStarts,
            context,
            pendingStart,
            create2DPreviewEntries(grid, start, node ?? undefined)
          );

          if (!published) {
            return;
          }

          sessions.set(context, {
            document,
            nodeId,
            pointerId: input.pointerId,
            previewLease: pendingStart.previewLease,
            resolveScenePoint: capabilities.resolveScenePoint,
            start
          });
        } finally {
          if (pendingStarts.get(context) === pendingStart) {
            pendingStarts.delete(context);
          }
        }
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
        const end = await resolve2DAuthoringPoint(
          session.resolveScenePoint,
          input.point,
          grid
        );
        const node = create2DShapeNode(
          options,
          options.layerId,
          session.nodeId,
          session.start,
          end
        );
        const published = await publishOwnedAuthoringPreviews(
          sessions,
          context,
          session,
          create2DPreviewEntries(grid, end, node ?? undefined)
        );

        if (!published) {
          return;
        }

        if (input.type === "pointer.up") {
          if (node) {
            await context.dispatch({
              label: `Create ${label}`,
              node,
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

function create2DShapeNode(
  options: Canvas2DShapeToolOptions,
  layerId: CanvasLayerId,
  nodeId: NodeId,
  start: Point2,
  end: Point2
): CanvasNodeByType<"2d", "rect" | "circle"> | null {
  if (options.type === "rect") {
    const width = Math.abs(end[0] - start[0]);
    const height = Math.abs(end[1] - start[1]);

    if (width === 0 || height === 0) {
      return null;
    }

    return RectNodeSchema.parse({
      ...(options.fill === undefined ? {} : { fill: options.fill }),
      id: nodeId,
      layerId,
      position: [Math.min(start[0], end[0]), Math.min(start[1], end[1])],
      size: [width, height],
      type: "rect"
    });
  }

  const radius = Math.hypot(end[0] - start[0], end[1] - start[1]);

  if (radius === 0) {
    return null;
  }

  return CircleNodeSchema.parse({
    ...(options.fill === undefined ? {} : { fill: options.fill }),
    id: nodeId,
    layerId,
    position: start,
    radius,
    type: "circle"
  });
}

