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
  CanvasDistanceMeasurementToolOptions
} from "../tool-options.js";

type MeasurementSession<TMode extends CanvasMode> = AuthoringSessionBase & {
  readonly nodeId: NodeId;
  phase: "first" | "second";
  pointerId: number | null;
  readonly start: CanvasCoordinateForMode<TMode>;
};

type DistanceToolAdapter<TMode extends CanvasMode> = {
  readonly createId: CanvasCreateId;
  readonly createNode: (
    nodeId: NodeId,
    start: CanvasCoordinateForMode<TMode>,
    end: CanvasCoordinateForMode<TMode>
  ) => CanvasNodeByType<TMode, "measurement">;
  readonly cursor?: string;
  readonly id?: string;
  readonly label: string;
  readonly layerId: CanvasLayerId;
  readonly mode: TMode;
  readonly previews: (
    start: CanvasCoordinateForMode<TMode>,
    end: CanvasCoordinateForMode<TMode>
  ) => readonly CanvasAuthoringPreviewForMode<TMode>[];
  readonly resolve: (
    resolver: ScenePointResolver,
    viewportPoint: Point2
  ) => Promise<CanvasCoordinateForMode<TMode>>;
};

export function createDistanceMeasurementTool<const TId extends string>(
  options: CanvasDistanceMeasurementToolOptions<TId> & { readonly id: TId }
): CanvasToolDefinition<TId>;
export function createDistanceMeasurementTool(
  options: CanvasDistanceMeasurementToolOptions
): CanvasToolDefinition;
export function createDistanceMeasurementTool(
  options: CanvasDistanceMeasurementToolOptions
): CanvasToolDefinition {
  if (typeof options.createId !== "function") {
    throw new CanvasEditorError("invalid-id", "A createId function is required.");
  }

  const unit = parseMeasurementUnit(options.unit);
  const precision = parseMeasurementPrecision(options.precision);
  const label = options.label ?? "Distance";

  if (options.mode === "2d") {
    const grid = options.grid ? parse2DGrid(options.grid) : undefined;
    return createDistanceToolDefinition({
      createId: options.createId,
      createNode(nodeId, start, end) {
        return Canvas2DMeasurementNodeSchema.parse({
          end,
          id: nodeId,
          layerId: options.layerId,
          measurement: "distance",
          precision,
          start,
          type: "measurement",
          unit
        });
      },
      ...(options.cursor === undefined ? {} : { cursor: options.cursor }),
      ...(options.id === undefined ? {} : { id: options.id }),
      label,
      layerId: options.layerId,
      mode: "2d",
      previews(start, end) {
        return create2DMeasurementPreviewEntries(grid, start, end);
      },
      resolve: (resolver, viewportPoint) =>
        resolve2DAuthoringPoint(resolver, viewportPoint, grid)
    });
  }

  if (options.mode !== "3d") {
    throw new CanvasEditorError(
      "mode-mismatch",
      "A distance tool requires mode 2d or 3d."
    );
  }

  const workPlane = parseWorkPlane(options.workPlane);
  const grid = options.grid ? parse3DGrid(options.grid) : undefined;

  if (grid) {
    validateGridWorkPlaneCompatibility(grid, workPlane);
  }

  return createDistanceToolDefinition({
    createId: options.createId,
    createNode(nodeId, start, end) {
      return Canvas3DMeasurementNodeSchema.parse({
        end,
        id: nodeId,
        layerId: options.layerId,
        measurement: "distance",
        precision,
        start,
        type: "measurement",
        unit
      });
    },
    ...(options.cursor === undefined ? {} : { cursor: options.cursor }),
    ...(options.id === undefined ? {} : { id: options.id }),
    label,
    layerId: options.layerId,
    mode: "3d",
    previews(start, end) {
      return create3DMeasurementPreviewEntries(grid, start, end);
    },
    resolve: (resolver, viewportPoint) =>
      resolve3DAuthoringPoint(resolver, viewportPoint, workPlane, grid)
  });
}

function createDistanceToolDefinition<TMode extends CanvasMode>(
  adapter: DistanceToolAdapter<TMode>
): CanvasToolDefinition {
  const sessions = new WeakMap<CanvasToolContext, MeasurementSession<TMode>>();
  const pendingStarts = new WeakMap<CanvasToolContext, PendingAuthoringStart>();

  return {
    cursor: adapter.cursor ?? "crosshair",
    id: adapter.id ?? `measure.distance.${adapter.mode}`,
    label: adapter.label,
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

      if (input.type === "key.up" || !("pointerId" in input)) {
        return;
      }

      if (input.type === "pointer.cancel" || input.type === "pointer.leave") {
        clearAuthoringSessionOnDeactivate(pendingStarts, context);
        await clearAuthoringSession(sessions, context);
        return;
      }

      let session = sessions.get(context);

      if (input.type === "pointer.down") {
        if (!input.isPrimary || input.button !== 0) {
          return;
        }

        if (!session) {
          const document = context.getDocument();
          requireAuthoringTarget(document, adapter.mode, adapter.layerId);
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
            const start = await adapter.resolve(
              capabilities.resolveScenePoint,
              input.point
            );

            if (pendingStarts.get(context) !== pendingStart) {
              return;
            }

            const nodeId = createAuthoringNodeId(
              adapter.createId,
              document,
              adapter.mode,
              "measurement"
            );
            const published = await publishOwnedAuthoringPreviews(
              pendingStarts,
              context,
              pendingStart,
              adapter.previews(start, start)
            );

            if (!published) {
              return;
            }

            session = {
              document,
              nodeId,
              phase: "first",
              pointerId: input.pointerId,
              previewLease: pendingStart.previewLease,
              resolveScenePoint: capabilities.resolveScenePoint,
              start
            };
            sessions.set(context, session);
          } finally {
            if (pendingStarts.get(context) === pendingStart) {
              pendingStarts.delete(context);
            }
          }
          return;
        }

        if (session.phase === "second" && session.pointerId === null) {
          assertSessionDocument(context, session);
          session.pointerId = input.pointerId;
          const end = await adapter.resolve(session.resolveScenePoint, input.point);
          await publishOwnedAuthoringPreviews(
            sessions,
            context,
            session,
            adapter.previews(session.start, end)
          );
        }

        return;
      }

      if (!session) {
        return;
      }

      assertSessionDocument(context, session);

      if (input.type === "pointer.move") {
        const end = await adapter.resolve(session.resolveScenePoint, input.point);
        await publishOwnedAuthoringPreviews(
          sessions,
          context,
          session,
          adapter.previews(session.start, end)
        );
        return;
      }

      if (input.type !== "pointer.up" || session.pointerId !== input.pointerId) {
        return;
      }

      const end = await adapter.resolve(session.resolveScenePoint, input.point);
      const published = await publishOwnedAuthoringPreviews(
        sessions,
        context,
        session,
        adapter.previews(session.start, end)
      );

      if (!published) {
        return;
      }

      if (session.phase === "first") {
        session.phase = "second";
        session.pointerId = null;
        return;
      }

      try {
        if (!coordinatesEqual(session.start, end)) {
          const node = adapter.createNode(session.nodeId, session.start, end);
          await context.dispatch({
            label: `Create ${adapter.label}`,
            node,
            type: "node.add"
          });
        }
      } finally {
        await clearAuthoringSession(sessions, context);
      }
    }
  };
}

function create2DMeasurementPreviewEntries(
  grid: Canvas2DGrid | undefined,
  start: Point2,
  end: Point2
): readonly CanvasAuthoringPreviewForMode<"2d">[] {
  return [
    ...(grid
      ? ([
          { grid, kind: "grid", mode: "2d" },
          { kind: "grid.snap", mode: "2d", position: end }
        ] as const)
      : []),
    { end, kind: "measurement", measurement: "distance", mode: "2d", start }
  ];
}

function create3DMeasurementPreviewEntries(
  grid: Canvas3DGrid | undefined,
  start: Vector3,
  end: Vector3
): readonly CanvasAuthoringPreviewForMode<"3d">[] {
  return [
    ...(grid
      ? ([
          { grid, kind: "grid", mode: "3d" },
          { kind: "grid.snap", mode: "3d", position: end }
        ] as const)
      : []),
    { end, kind: "measurement", measurement: "distance", mode: "3d", start }
  ];
}

function parseMeasurementUnit(input: CanvasMeasurementUnit): CanvasMeasurementUnit {
  try {
    return CanvasMeasurementUnitSchema.parse(input);
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-command",
      "Measurement unit validation failed.",
      { cause }
    );
  }
}

function parseMeasurementPrecision(input: number): number {
  if (!Number.isInteger(input) || input < 0) {
    throw new CanvasEditorError(
      "invalid-command",
      "Measurement precision must be a non-negative integer."
    );
  }

  return input;
}

function coordinatesEqual(
  left: Point2 | Vector3,
  right: Point2 | Vector3
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

