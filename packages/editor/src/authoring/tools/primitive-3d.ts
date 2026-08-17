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
  Canvas3DPrimitiveToolOptions
} from "../tool-options.js";

export function create3DPrimitiveTool<const TId extends string>(
  options: Canvas3DPrimitiveToolOptions<TId> & { readonly id: TId }
): CanvasToolDefinition<TId>;
export function create3DPrimitiveTool(
  options: Canvas3DPrimitiveToolOptions
): CanvasToolDefinition;
export function create3DPrimitiveTool(
  options: Canvas3DPrimitiveToolOptions
): CanvasToolDefinition {
  if (options.mode !== "3d") {
    throw new CanvasEditorError("mode-mismatch", "A 3D primitive tool requires mode 3d.");
  }

  if (typeof options.createId !== "function") {
    throw new CanvasEditorError("invalid-id", "A createId function is required.");
  }

  const workPlane = parseWorkPlane(options.workPlane);
  const grid = options.grid ? parse3DGrid(options.grid) : undefined;

  if (grid) {
    validateGridWorkPlaneCompatibility(grid, workPlane);
  }

  const sessions = new WeakMap<CanvasToolContext, Primitive3DSession>();
  const pendingStarts = new WeakMap<CanvasToolContext, PendingAuthoringStart>();
  const label = options.label ?? (options.type === "box" ? "Box" : "Sphere");

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
        const layerId = requireAuthoringTarget(document, "3d", options.layerId);
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

          const position = await resolve3DAuthoringPoint(
            capabilities.resolveScenePoint,
            input.point,
            workPlane,
            grid
          );

          if (pendingStarts.get(context) !== pendingStart) {
            return;
          }

          const nodeId = createAuthoringNodeId(
            options.createId,
            document,
            "3d",
            options.type
          );
          const node = create3DPrimitiveNode(options, layerId, nodeId, position);
          const published = await publishOwnedAuthoringPreviews(
            pendingStarts,
            context,
            pendingStart,
            create3DPreviewEntries(grid, position, node)
          );

          if (!published) {
            return;
          }

          sessions.set(context, {
            document,
            nodeId,
            pointerId: input.pointerId,
            previewLease: pendingStart.previewLease,
            resolveScenePoint: capabilities.resolveScenePoint
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
        const position = await resolve3DAuthoringPoint(
          session.resolveScenePoint,
          input.point,
          workPlane,
          grid
        );
        const node = create3DPrimitiveNode(
          options,
          options.layerId,
          session.nodeId,
          position
        );
        const published = await publishOwnedAuthoringPreviews(
          sessions,
          context,
          session,
          create3DPreviewEntries(grid, position, node)
        );

        if (!published) {
          return;
        }

        if (input.type === "pointer.up") {
          await context.dispatch({
            label: `Create ${label}`,
            node,
            type: "node.add"
          });
        }
      } finally {
        if (input.type === "pointer.up") {
          await clearAuthoringSession(sessions, context);
        }
      }
    }
  };
}

function create3DPrimitiveNode(
  options: Canvas3DPrimitiveToolOptions,
  layerId: CanvasLayerId,
  nodeId: NodeId,
  position: Vector3
): CanvasNodeByType<"3d", "box" | "sphere"> {
  if (options.type === "box") {
    return BoxNodeSchema.parse({
      ...(options.color === undefined ? {} : { color: options.color }),
      ...(options.rotation === undefined ? {} : { rotation: options.rotation }),
      ...(options.scale === undefined ? {} : { scale: options.scale }),
      id: nodeId,
      layerId,
      position,
      type: "box"
    });
  }

  return SphereNodeSchema.parse({
    ...(options.color === undefined ? {} : { color: options.color }),
    ...(options.radius === undefined ? {} : { radius: options.radius }),
    ...(options.rotation === undefined ? {} : { rotation: options.rotation }),
    ...(options.scale === undefined ? {} : { scale: options.scale }),
    id: nodeId,
    layerId,
    position,
    type: "sphere"
  });
}

const SURFACE_PLACEMENT_TOLERANCE = 1e-6;

