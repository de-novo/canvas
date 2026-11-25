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
  CanvasAnnotationDraft,
  CanvasAnnotationDraftProvider,
  CanvasAnnotationDraftResult,
  CanvasAnnotationToolOptions
} from "../tool-options.js";

type AnnotationSession<TMode extends CanvasMode> = AuthoringSessionBase & {
  anchor: CanvasCoordinateForMode<TMode>;
  readonly nodeId: NodeId;
  readonly pointerId: number;
};

type AnnotationToolAdapter<TMode extends CanvasMode> = {
  readonly anchorPreviews: (
    anchor: CanvasCoordinateForMode<TMode>
  ) => readonly CanvasAuthoringPreviewForMode<TMode>[];
  readonly createId: CanvasCreateId;
  readonly createNode: (
    nodeId: NodeId,
    anchor: CanvasCoordinateForMode<TMode>,
    draft: CanvasAnnotationDraft<TMode>
  ) => CanvasNodeByType<TMode, "annotation">;
  readonly cursor?: string;
  readonly draftPreviews: (
    anchor: CanvasCoordinateForMode<TMode>,
    draft: CanvasAnnotationDraft<TMode>
  ) => readonly CanvasAuthoringPreviewForMode<TMode>[];
  readonly id?: string;
  readonly label: string;
  readonly layerId: CanvasLayerId;
  readonly mode: TMode;
  readonly provideDraft: CanvasAnnotationDraftProvider<TMode>;
  readonly resolve: (
    resolver: ScenePointResolver,
    viewportPoint: Point2
  ) => Promise<CanvasCoordinateForMode<TMode>>;
};

export function createAnnotationTool<const TId extends string>(
  options: CanvasAnnotationToolOptions<TId> & { readonly id: TId }
): CanvasToolDefinition<TId>;
export function createAnnotationTool(
  options: CanvasAnnotationToolOptions
): CanvasToolDefinition;
export function createAnnotationTool(
  options: CanvasAnnotationToolOptions
): CanvasToolDefinition {
  if (typeof options.createId !== "function") {
    throw new CanvasEditorError("invalid-id", "A createId function is required.");
  }

  if (typeof options.provideDraft !== "function") {
    throw new CanvasEditorError(
      "invalid-command",
      "An annotation draft provider is required."
    );
  }

  const label = options.label ?? "Annotation";

  if (options.mode === "2d") {
    const grid = options.grid ? parse2DGrid(options.grid) : undefined;
    return createAnnotationToolDefinition({
      anchorPreviews: (anchor) =>
        create2DAnnotationAnchorPreviews(grid, anchor),
      createId: options.createId,
      createNode(nodeId, anchor, draft) {
        return Canvas2DAnnotationNodeSchema.parse({
          anchor,
          id: nodeId,
          layerId: options.layerId,
          targetId: draft.targetId,
          text: draft.text,
          type: "annotation"
        });
      },
      ...(options.cursor === undefined ? {} : { cursor: options.cursor }),
      draftPreviews: (anchor, draft) =>
        create2DAnnotationDraftPreviews(grid, anchor, draft),
      ...(options.id === undefined ? {} : { id: options.id }),
      label,
      layerId: options.layerId,
      mode: "2d",
      provideDraft: options.provideDraft,
      resolve: (resolver, viewportPoint) =>
        resolve2DAuthoringPoint(resolver, viewportPoint, grid)
    });
  }

  if (options.mode !== "3d") {
    throw new CanvasEditorError(
      "mode-mismatch",
      "An annotation tool requires mode 2d or 3d."
    );
  }

  const workPlane = parseWorkPlane(options.workPlane);
  const grid = options.grid ? parse3DGrid(options.grid) : undefined;

  if (grid) {
    validateGridWorkPlaneCompatibility(grid, workPlane);
  }

  return createAnnotationToolDefinition({
    anchorPreviews: (anchor) =>
      create3DAnnotationAnchorPreviews(grid, anchor),
    createId: options.createId,
    createNode(nodeId, anchor, draft) {
      return Canvas3DAnnotationNodeSchema.parse({
        anchor,
        id: nodeId,
        layerId: options.layerId,
        targetId: draft.targetId,
        text: draft.text,
        type: "annotation"
      });
    },
    ...(options.cursor === undefined ? {} : { cursor: options.cursor }),
    draftPreviews: (anchor, draft) =>
      create3DAnnotationDraftPreviews(grid, anchor, draft),
    ...(options.id === undefined ? {} : { id: options.id }),
    label,
    layerId: options.layerId,
    mode: "3d",
    provideDraft: options.provideDraft,
    resolve: (resolver, viewportPoint) =>
      resolve3DAuthoringPoint(resolver, viewportPoint, workPlane, grid)
  });
}

function createAnnotationToolDefinition<TMode extends CanvasMode>(
  adapter: AnnotationToolAdapter<TMode>
): CanvasToolDefinition {
  const sessions = new WeakMap<CanvasToolContext, AnnotationSession<TMode>>();
  const pendingStarts = new WeakMap<CanvasToolContext, PendingAuthoringStart>();

  return {
    cursor: adapter.cursor ?? "crosshair",
    id: adapter.id ?? `annotate.${adapter.mode}`,
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

      if (input.type === "pointer.down") {
        if (!input.isPrimary || input.button !== 0) {
          return;
        }

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
          await clearAuthoringSession(sessions, context);

          if (pendingStarts.get(context) !== pendingStart) {
            return;
          }

          const anchor = await adapter.resolve(
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
            "annotation"
          );
          const published = await publishOwnedAuthoringPreviews(
            pendingStarts,
            context,
            pendingStart,
            adapter.anchorPreviews(anchor)
          );

          if (!published) {
            return;
          }

          sessions.set(context, {
            anchor,
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

      assertSessionDocument(context, session);

      if (input.type === "pointer.move") {
        const anchor = await adapter.resolve(
          session.resolveScenePoint,
          input.point
        );
        const published = await publishOwnedAuthoringPreviews(
          sessions,
          context,
          session,
          adapter.anchorPreviews(anchor)
        );

        if (published) {
          session.anchor = anchor;
        }
        return;
      }

      if (input.type !== "pointer.up") {
        return;
      }

      try {
        const anchor = await adapter.resolve(
          session.resolveScenePoint,
          input.point
        );
        const anchorPublished = await publishOwnedAuthoringPreviews(
          sessions,
          context,
          session,
          adapter.anchorPreviews(anchor)
        );

        if (!anchorPublished) {
          return;
        }

        session.anchor = anchor;
        let draftResultInput: CanvasAnnotationDraftResult<TMode>;

        try {
          draftResultInput = await adapter.provideDraft({
            anchor: session.anchor,
            document: session.document,
            mode: adapter.mode
          });
        } catch (cause) {
          throw new CanvasEditorError(
            "tool-handler-failed",
            "Annotation draft provider failed.",
            { cause }
          );
        }

        if (sessions.get(context) !== session) {
          return;
        }

        const result = parseAnnotationDraftResult<TMode>(draftResultInput);

        if (result.kind === "cancel") {
          return;
        }

        if (
          result.draft.targetId !== null &&
          !session.document.scene.nodes.some(
            (node) => node.id === result.draft.targetId
          )
        ) {
          throw new CanvasEditorError(
            "node-not-found",
            `Annotation target was not found: ${result.draft.targetId}`
          );
        }

        const node = adapter.createNode(
          session.nodeId,
          session.anchor,
          result.draft
        );
        const draftPublished = await publishOwnedAuthoringPreviews(
          sessions,
          context,
          session,
          adapter.draftPreviews(session.anchor, result.draft)
        );

        if (!draftPublished) {
          return;
        }

        await context.dispatch({
          label: `Create ${adapter.label}`,
          node,
          type: "node.add"
        });
      } finally {
        await clearAuthoringSession(sessions, context);
      }
    }
  };
}

function parseAnnotationDraftResult<TMode extends CanvasMode>(
  input: CanvasAnnotationDraftResult<TMode>
): CanvasAnnotationDraftResult<TMode> {
  if (!isPlainObject(input) || typeof input.kind !== "string") {
    throw new CanvasEditorError(
      "invalid-command",
      "Annotation provider returned an invalid result."
    );
  }

  if (input.kind === "cancel") {
    if (Object.keys(input).length !== 1) {
      throw new CanvasEditorError(
        "invalid-command",
        "Annotation cancellation must contain only kind."
      );
    }

    return { kind: "cancel" };
  }

  if (
    input.kind !== "commit" ||
    Object.keys(input).length !== 2 ||
    !isPlainObject(input.draft) ||
    Object.keys(input.draft).length !== 2 ||
    typeof input.draft.text !== "string" ||
    input.draft.text.length === 0 ||
    !(
      input.draft.targetId === null ||
      typeof input.draft.targetId === "string"
    )
  ) {
    throw new CanvasEditorError(
      "invalid-command",
      "Annotation provider returned an invalid commit draft."
    );
  }

  const targetId =
    input.draft.targetId === null
      ? null
      : parseNodeId(input.draft.targetId);
  return {
    draft: {
      targetId,
      text: input.draft.text
    } as CanvasAnnotationDraft<TMode>,
    kind: "commit"
  };
}

function create2DAnnotationAnchorPreviews(
  grid: Canvas2DGrid | undefined,
  anchor: Point2
): readonly CanvasAuthoringPreviewForMode<"2d">[] {
  return [
    ...(grid
      ? ([
          { grid, kind: "grid", mode: "2d" },
          { kind: "grid.snap", mode: "2d", position: anchor }
        ] as const)
      : []),
    { anchor, kind: "annotation.anchor", mode: "2d" }
  ];
}

function create3DAnnotationAnchorPreviews(
  grid: Canvas3DGrid | undefined,
  anchor: Vector3
): readonly CanvasAuthoringPreviewForMode<"3d">[] {
  return [
    ...(grid
      ? ([
          { grid, kind: "grid", mode: "3d" },
          { kind: "grid.snap", mode: "3d", position: anchor }
        ] as const)
      : []),
    { anchor, kind: "annotation.anchor", mode: "3d" }
  ];
}

function create2DAnnotationDraftPreviews(
  grid: Canvas2DGrid | undefined,
  anchor: Point2,
  draft: CanvasAnnotationDraft<"2d">
): readonly CanvasAuthoringPreviewForMode<"2d">[] {
  return [
    ...create2DAnnotationAnchorPreviews(grid, anchor),
    {
      anchor,
      kind: "annotation.draft",
      mode: "2d",
      targetId: draft.targetId,
      text: draft.text
    }
  ];
}

function create3DAnnotationDraftPreviews(
  grid: Canvas3DGrid | undefined,
  anchor: Vector3,
  draft: CanvasAnnotationDraft<"3d">
): readonly CanvasAuthoringPreviewForMode<"3d">[] {
  return [
    ...create3DAnnotationAnchorPreviews(grid, anchor),
    {
      anchor,
      kind: "annotation.draft",
      mode: "3d",
      targetId: draft.targetId,
      text: draft.text
    }
  ];
}
