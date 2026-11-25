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
} from "@de-novo/canvas-core";
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
  requireDistanceSurfaceCapabilities,
  requireSurfacePlacementCapabilities,
  resolve2DAuthoringPoint,
  resolve3DAuthoringPoint,
  takeAuthoringDeactivationCleanups,
  type AuthoringPreviewSetter,
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

/**
 * A measurement endpoint resolver returns `null` for an explicit miss.
 * Only surface capture can miss; work-plane resolution always yields a
 * point or throws.
 */
type MeasurementEndpointResolver<TMode extends CanvasMode> = (
  point: Point2
) => Promise<CanvasCoordinateForMode<TMode> | null>;

type MeasurementSession<TMode extends CanvasMode> = Pick<
  AuthoringSessionBase,
  "document" | "previewLease"
> & {
  readonly nodeId: NodeId;
  phase: "first" | "second";
  pointerId: number | null;
  readonly resolveEndpoint: MeasurementEndpointResolver<TMode>;
  readonly start: CanvasCoordinateForMode<TMode>;
};

/**
 * Capability set required by surface capture: hit testing for target
 * discovery plus the M3.1 surface-point resolver.
 */
type DistanceSurfaceCapabilities = {
  readonly hitTest: NonNullable<CanvasToolContext["hitTest"]>;
  readonly resolveSurfacePoint: SurfacePointResolver;
};

type DistanceToolAdapter<TMode extends CanvasMode> = {
  readonly capture: "work-plane" | "surface";
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
  ) => Promise<CanvasCoordinateForMode<TMode>> | CanvasCoordinateForMode<TMode>;
  /**
   * Surface-capture endpoint resolution. Returns `null` for an explicit
   * miss. Supplied only by the `"surface"` adapter; work-plane adapters
   * never consult it.
   */
  readonly resolveSurfaceEndpoint?: (
    context: CanvasToolContext,
    capabilities: DistanceSurfaceCapabilities,
    point: Point2
  ) => Promise<CanvasCoordinateForMode<TMode> | null>;
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
      capture: "work-plane",
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

  if (options.capture === "surface") {
    if (options.grid) {
      throw new CanvasEditorError(
        "invalid-command",
        "Grid snapping is a work-plane vocabulary; surface-capture measurements do not support a grid."
      );
    }

    return createDistanceToolDefinition({
      capture: "surface",
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
        return create3DMeasurementPreviewEntries(undefined, start, end);
      },
      resolve() {
        // Surface capture never consults scene-point resolution.
        throw new CanvasEditorError(
          "internal-error",
          "Surface-capture measurements do not use scene-point resolution."
        );
      },
      async resolveSurfaceEndpoint(context, capabilities, point) {
        const hit = await capabilities.hitTest({ point });

        if (!hit || hit.kind !== "node") {
          return null;
        }

        const node = context
          .getDocument()
          .scene.nodes.find((candidate) => candidate.id === hit.nodeId);

        if (
          !node ||
          (node.type !== "box" &&
            node.type !== "mesh" &&
            node.type !== "instances")
        ) {
          return null;
        }

        const result = await capabilities.resolveSurfacePoint({
          mode: "3d",
          target: { kind: "node", nodeType: node.type },
          viewportPoint: point
        });

        return result.kind === "hit" ? result.point : null;
      }
    });
  }

  const workPlane = parseWorkPlane(options.workPlane);
  const grid = options.grid ? parse3DGrid(options.grid) : undefined;

  if (grid) {
    validateGridWorkPlaneCompatibility(grid, workPlane);
  }

  return createDistanceToolDefinition({
    capture: "work-plane",
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

          let endpointResolver: MeasurementEndpointResolver<TMode>;
          let setPreviews: AuthoringPreviewSetter;

          if (adapter.capture === "surface") {
            const surfaceCapabilities =
              requireDistanceSurfaceCapabilities(context);
            const hook = adapter.resolveSurfaceEndpoint;

            if (!hook) {
              throw new CanvasEditorError(
                "internal-error",
                "A surface-capture measurement tool is missing its endpoint resolver."
              );
            }

            endpointResolver = async (point) =>
              hook(context, surfaceCapabilities, point);
            setPreviews = surfaceCapabilities.setPreviews;
          } else {
            const capabilities = requireAuthoringCapabilities(context);
            endpointResolver = async (point) =>
              adapter.resolve(capabilities.resolveScenePoint, point);
            setPreviews = capabilities.setPreviews;
          }

          const pendingStart: PendingAuthoringStart = {
            previewLease: acquireAuthoringPreviewLease(
              context,
              setPreviews
            )
          };
          clearAuthoringSessionOnDeactivate(pendingStarts, context);
          pendingStarts.set(context, pendingStart);

          try {
            const start = await endpointResolver(input.point);

            if (pendingStarts.get(context) !== pendingStart) {
              return;
            }

            // A surface miss on the first tap starts nothing: no draft, no
            // session, nothing to undo. The next tap may try again.
            if (start === null) {
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
              resolveEndpoint: endpointResolver,
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
          const end = await session.resolveEndpoint(input.point);

          // Surface miss while re-aiming the second tap keeps the session in
          // its waiting state; the preview stays where it was.
          if (end === null) {
            return;
          }

          session.pointerId = input.pointerId;
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
        const end = await session.resolveEndpoint(input.point);

        if (end === null) {
          // Off-geometry during surface capture hides the draft instead of
          // guessing an endpoint.
          await publishOwnedAuthoringPreviews(
            sessions,
            context,
            session,
            []
          );
          return;
        }

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

      const end = await session.resolveEndpoint(input.point);

      if (end === null) {
        // A missed release tap never commits and never falls back. The
        // session stays armed so the user can aim again.
        await publishOwnedAuthoringPreviews(sessions, context, session, []);
        return;
      }

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
