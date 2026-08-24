import {
  BoxNodeSchema,
  Canvas2DAnnotationNodeSchema,
  Canvas2DMeasurementNodeSchema,
  Canvas2DNodeSchema,
  Canvas3DAnnotationNodeSchema,
  Canvas3DMeasurementNodeSchema,
  Canvas3DNodeSchema,
  Canvas3DSurfacePointResultSchema,
  CanvasAuthoringPreviewSchema,
  CanvasCommandSchema,
  CanvasDocumentSchema,
  CanvasHitResultSchema,
  CanvasLayerIdSchema,
  CanvasLayerPatchSchema,
  CanvasMeasurementUnitSchema,
  CanvasNodeSchema,
  CanvasNodeTransformHandleIdSchema,
  CanvasNodeRotationHandleIdSchema,
  CanvasNodeScaleHandleIdSchema,
  CanvasNodeTransformKindSchema,
  CanvasNodeTransformPreviewSchema,
  CanvasNodeTranslationHandleIdSchema,
  CanvasSelectionModeSchema,
  CanvasScenePointResultSchema,
  CanvasToolInputSchema,
  CircleNodeSchema,
  NodeIdSchema,
  RectNodeSchema,
  SelectionStateSchema,
  SphereNodeSchema,
  type Canvas2DGrid,
  type Canvas2DNode,
  type Canvas3DGrid,
  type Canvas3DNode,
  type Canvas3DSurfacePointResult,
  type CanvasAuthoringPreview,
  type CanvasAuthoringPreviewForMode,
  type CanvasCommand,
  type CanvasCommandResult,
  type CanvasCoordinateForMode,
  type CanvasDocument,
  type CanvasDocumentInput,
  type CanvasCreateId,
  type CanvasGridForMode,
  type CanvasHitResult,
  type CanvasLayer,
  type CanvasLayerId,
  type CanvasLayerPatch,
  type CanvasMeasurementUnit,
  type CanvasMode,
  type CanvasNode,
  type CanvasNodeByType,
  type CanvasNodeIdentity,
  type CanvasNodeIdentityFor,
  type CanvasNodePatch,
  type CanvasNodePatchFor,
  type CanvasNodeRotationAxis,
  type CanvasNodeRotationHandleId,
  type CanvasNodeScaleConstraint,
  type CanvasNodeScaleHandleId,
  type CanvasNodeTransformInput,
  type CanvasNodeTransformKind,
  type CanvasNodeTransformPreview,
  type CanvasNodeTranslationConstraint,
  type CanvasNodeTranslationHandleId,
  type CanvasPluginCommand,
  type CanvasPluginCommandDescriptor,
  type CanvasPluginCommandFor,
  type CanvasPluginCommandHandler,
  type CanvasPluginCommandType,
  type CanvasSelectionMode,
  type CanvasScenePointResult,
  type CanvasScenePointResultFor,
  type CanvasToolContext,
  type CanvasToolDefinition,
  type CanvasToolInput,
  type CanvasWorkPlane,
  type JsonValue,
  type NodeId,
  type Point2,
  type SelectionState,
  type SelectionStateInput,
  type Vector3
} from "@denovo/canvas-core";
import { Cause, Effect, Either, Option } from "effect";
import {
  freezeValue,
  isPlainObject,
  jsonEqual,
  uniqueIds
} from "./utils.js";
import {
  CanvasEditorError,
  PluginPayloadValidationFailure
} from "./errors.js";
import type { CanvasEditorErrorCode } from "./errors.js";
import {
  transformPoint2,
  compose2DTransforms,
  transformPoint3,
  compose3DTransforms,
  vectorLength3
} from "./math/transform.js";
import {
  dotVector3,
  parse2DGrid,
  parse3DGrid,
  parseWorkPlane,
  snapPointToGrid,
  validateGridWorkPlaneCompatibility
} from "./grid.js";
import {
  getEffectiveNodeState,
  isNodeEffectivelyLocked,
  isNodeEffectivelyVisible,
  resolveEffectiveNodeState,
  type ResolvedEffectiveNodeState
} from "./node-state.js";
import type { EditorEffect } from "./internal-types.js";
import type {
  ApplyCommandResult,
  EditorSnapshot,
  RegisteredPluginCommand
} from "./internal-types.js";
import {
  applyCommandEffect,
  applySelectionEffect,
  createInitialSnapshot,
  getCommandTimestampEffect,
  getCommandTypeEffect
} from "./commands/handlers.js";
import {
  createValidatedNodeUpdateCommand,
  type CanvasTransactionCommand
} from "./commands/builders.js";
import {
  assertPluginCommandRegistration,
  assertToolDefinition,
  cloneCommand,
  createRegisteredPluginCommand,
  runEditorEffect
} from "./runtime.js";
import {
  acquireAuthoringPreviewLease,
  assertSessionDocument,
  clearAuthoringSession,
  clearAuthoringSessionOnDeactivate,
  create2DPreviewEntries,
  create3DPreviewEntries,
  createAuthoringNodeId,
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
} from "./authoring/coordinator.js";
import {
  getHitNodeId,
  getSelectionFromHit,
  parseDocumentEffect,
  parseHitResultEffect,
  parseSelectionForDocumentEffect,
  parseSelectionModeEffect,
  readonlyStringsEqual,
  sanitizeSelectionForDocument,
  selectionsEqual
} from "./parsers.js";

export { CanvasEditorError } from "./errors.js";
export type { CanvasEditorErrorCode } from "./errors.js";
export {
  transformPoint2,
  compose2DTransforms,
  transformPoint3,
  compose3DTransforms
} from "./math/transform.js";
export { snapPointToGrid, validateGridWorkPlaneCompatibility } from "./grid.js";
export {
  getEffectiveNodeState,
  isNodeEffectivelyLocked,
  isNodeEffectivelyVisible
} from "./node-state.js";
export { createNodeUpdateCommand } from "./commands/builders.js";
export {
  buildPatchRecord,
  serializeCommandToPatch,
  serializeCommandsToPatch,
  serializeInverseCommandToPatch,
  getCommandAffectedNodeIds,
  type BuildPatchRecordOptions
} from "./commands/serialize.js";
export {
  create2DShapeTool,
  create3DPrimitiveTool,
  create3DSurfacePlacementTool,
  createConnectorTool,
  createDistanceMeasurementTool,
  createAnnotationTool
} from "./authoring/tools.js";
export type {
  Canvas2DShapeToolOptions,
  Canvas3DPrimitiveToolOptions,
  Canvas3DSurfacePlacementToolOptions,
  CanvasDistanceMeasurementToolOptions,
  CanvasAnnotationToolOptions,
  CanvasAnnotationDraft,
  CanvasAnnotationDraftResult,
  CanvasAnnotationDraftContext,
  CanvasAnnotationDraftProvider,
  CanvasConnectorToolOptions
} from "./authoring/tools.js";
export type { CanvasEffectiveNodeState } from "./node-state.js";
export {
  createAlignAdapter,
  createBuiltInLayoutAdapters,
  createDistributeAdapter,
  createGridLayoutAdapter
} from "./layout/adapters.js";
export {
  canvasScreenPointRadius,
  createRelationGraphLayoutAdapter,
  createTimeGraphLayoutAdapter
} from "./layout/graph-adapters.js";
export type {
  CanvasAlignAxis,
  CanvasDistributeAxis,
  CanvasGridLayoutOptions,
  CanvasLayoutAdapter,
  CanvasLayoutInput,
  CanvasLayoutResult
} from "./layout/adapters.js";
export type {
  RelationGraphLayoutOptions,
  TimeGraphLayoutOptions
} from "./layout/graph-adapters.js";
export {
  applyNamedOperations,
  setLayerVisible
} from "./authoring/named-operations.js";
export type {
  NamedOperation,
  NamedOperationResult,
  SetLayerVisibleInput
} from "./authoring/named-operations.js";
export {
  applyCommandsToDocument,
  applyCommandsToStoredDocument
} from "./commands/apply-document.js";
export type {
  ApplyStoredCommandsOptions,
  CanvasStoredDocument
} from "./commands/apply-document.js";
export {
  createEditor,
  connectEditorToRuntime,
  connectEditorToStorage
} from "./editor.js";
export type {
  CanvasEditor,
  CanvasEditorState,
  CanvasEditorHistoryState,
  CanvasEditorHistoryEntry,
  CanvasEditorDispatchResult,
  CanvasEditorChange,
  CanvasEditorListener,
  CanvasPersistenceEvent,
  CanvasPersistenceListener,
  ConnectEditorToStorageOptions,
  CanvasEditorToolRuntimeContext,
  CanvasEditorRuntimeTarget,
  CanvasApplyLayoutOptions,
  CanvasApplyLayoutResult,
  CreateCanvasEditorOptions
} from "./editor.js";

export type CanvasSelectToolOptions<TId extends string = string> = {
  readonly cursor?: string;
  readonly hover?: boolean;
  readonly id?: TId;
  readonly label?: string;
  /** Drag on empty space to rubber-band select. Defaults to `true`. */
  readonly marquee?: boolean;
};

export type CanvasPanOrbitToolOptions<TId extends string = string> = {
  readonly cursor?: string;
  readonly id?: TId;
  readonly label?: string;
};

export type CanvasTransformToolOptions<TId extends string = string> = {
  readonly cursor?: string;
  readonly id?: TId;
  readonly label?: string;
  readonly operation?: CanvasNodeTransformKind;
};

type CanvasGroupNodeIdentity =
  | {
      readonly createId: CanvasCreateId;
      readonly groupId?: never;
    }
  | {
      readonly createId?: never;
      readonly groupId: NodeId;
    };

export type CanvasGroupNodesOptions = CanvasGroupNodeIdentity & {
  readonly document: CanvasDocument;
  readonly nodeIds: readonly NodeId[];
};

type TransformSession = {
  readonly target: NodeTransformTarget;
  readonly origin: [number, number];
  readonly pointerId: number;
  readonly resolveNodeTransform: NonNullable<
    CanvasToolContext["resolveNodeTransform"]
  >;
  readonly setNodeTransformPreview: NonNullable<
    CanvasToolContext["setNodeTransformPreview"]
  >;
  preview: CanvasNodeTransformPreview | null;
};

type NodeTransformTarget =
  | {
      readonly constraint: CanvasNodeTranslationConstraint;
      readonly kind: "translate";
      readonly nodeId: NodeId;
    }
  | {
      readonly axis: CanvasNodeRotationAxis;
      readonly kind: "rotate";
      readonly nodeId: NodeId;
    }
  | {
      readonly constraint: CanvasNodeScaleConstraint;
      readonly kind: "scale";
      readonly nodeId: NodeId;
    };

const TRANSLATION_CONSTRAINT_BY_HANDLE = {
  "translate.x": "x",
  "translate.xy": "xy",
  "translate.xz": "xz",
  "translate.y": "y",
  "translate.yz": "yz",
  "translate.z": "z"
} as const satisfies Record<
  CanvasNodeTranslationHandleId,
  CanvasNodeTranslationConstraint
>;

const ROTATION_AXIS_BY_HANDLE = {
  "rotate.x": "x",
  "rotate.y": "y",
  "rotate.z": "z"
} as const satisfies Record<
  CanvasNodeRotationHandleId,
  CanvasNodeRotationAxis
>;

const SCALE_CONSTRAINT_BY_HANDLE = {
  "scale.uniform": "uniform",
  "scale.x": "x",
  "scale.xy": "xy",
  "scale.xz": "xz",
  "scale.y": "y",
  "scale.yz": "yz",
  "scale.z": "z"
} as const satisfies Record<CanvasNodeScaleHandleId, CanvasNodeScaleConstraint>;

export function createPanOrbitTool<const TId extends string>(
  options: CanvasPanOrbitToolOptions<TId> & { readonly id: TId }
): CanvasToolDefinition<TId>;
export function createPanOrbitTool(
  options?: CanvasPanOrbitToolOptions
): CanvasToolDefinition;
export function createPanOrbitTool(
  options: CanvasPanOrbitToolOptions = {}
): CanvasToolDefinition {
  return {
    cursor: options.cursor ?? "grab",
    id: options.id ?? "pan-orbit",
    label: options.label ?? "Pan / Orbit",
    navigation: "allow",
    onInput() {
      // The renderer owns camera math; the tool owns input routing and selection isolation.
    }
  };
}

export function createTransformTool<const TId extends string>(
  options: CanvasTransformToolOptions<TId> & { readonly id: TId }
): CanvasToolDefinition<TId>;
export function createTransformTool(
  options?: CanvasTransformToolOptions
): CanvasToolDefinition;
export function createTransformTool(
  options: CanvasTransformToolOptions = {}
): CanvasToolDefinition {
  const operation = options.operation ?? "translate";
  const defaults = getTransformToolDefaults(operation);
  const sessions = new WeakMap<CanvasToolContext, TransformSession>();

  function clearSession(context: CanvasToolContext): void {
    const session = sessions.get(context);
    sessions.delete(context);

    if (session) {
      session.setNodeTransformPreview(null);
    }
  }

  return {
    cursor: options.cursor ?? defaults.cursor,
    id: options.id ?? defaults.id,
    label: options.label ?? defaults.label,
    navigation: "block",
    onDeactivate: clearSession,
    transform: operation,
    async onInput(input, context) {
      if (input.type === "key.down") {
        if (input.key === "Escape") {
          clearSession(context);
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
        clearSession(context);
        return;
      }

      if (
        input.type === "pointer.down" &&
        input.isPrimary &&
        input.button === 0
      ) {
        clearSession(context);

        const hit = await requireToolHitTest(context)({ point: input.point });
        const target = getNodeTransformTarget(hit, operation);

        if (!target) {
          return;
        }

        const { resolveNodeTransform, setNodeTransformPreview } =
          requireTransformCapabilities(context, operation);
        const state = resolveEffectiveNodeState(
          context.getDocument(),
          target.nodeId
        );

        if (state.locked) {
          throw new CanvasEditorError(
            "locked-target",
            `Node is effectively locked: ${target.nodeId}`
          );
        }

        if (!state.visible) {
          throw new CanvasEditorError(
            "invalid-selection",
            `Hidden node cannot be transformed: ${target.nodeId}`
          );
        }

        await context.selectFromHit(hit, "replace");
        sessions.set(context, {
          origin: [input.origin[0], input.origin[1]],
          pointerId: input.pointerId,
          preview: null,
          resolveNodeTransform,
          setNodeTransformPreview,
          target
        });
        return;
      }

      const session = sessions.get(context);

      if (!session || session.pointerId !== input.pointerId) {
        return;
      }

      if (input.type === "pointer.move") {
        if (!input.dragging) {
          return;
        }

        const preview = CanvasNodeTransformPreviewSchema.parse(
          await session.resolveNodeTransform(
            createNodeTransformInput(session, input.point)
          )
        );

        if (sessions.get(context) !== session) {
          return;
        }

        if (
          preview.nodeId !== session.target.nodeId ||
          preview.kind !== session.target.kind ||
          preview.mode !== context.getDocument().scene.mode
        ) {
          throw new CanvasEditorError(
            "tool-handler-failed",
            "The renderer returned a transform preview that does not match " +
              "the active node, operation, and scene mode."
          );
        }

        session.setNodeTransformPreview(preview);
        session.preview = preview;
        return;
      }

      if (input.type === "pointer.up") {
        sessions.delete(context);

        try {
          if (input.dragging && session.preview) {
            const node = context
              .getDocument()
              .scene.nodes.find(
                (candidate) => candidate.id === session.target.nodeId
              );

            if (!node) {
              throw new CanvasEditorError(
                "node-not-found",
                `Node was not found: ${session.target.nodeId}`
              );
            }

            await context.dispatch({
              commands: [
                createValidatedNodeUpdateCommand(
                  node,
                  getNodeTransformPatch(session.preview)
                )
              ],
              label: `${options.label ?? defaults.label} node`,
              type: "transaction"
            });
          }
        } finally {
          session.setNodeTransformPreview(null);
        }
      }
    }
  };
}

function getTransformToolDefaults(operation: CanvasNodeTransformKind): {
  readonly cursor: string;
  readonly id: string;
  readonly label: string;
} {
  switch (operation) {
    case "translate":
      return { cursor: "move", id: "transform", label: "Move" };
    case "rotate":
      return { cursor: "crosshair", id: "transform.rotate", label: "Rotate" };
    case "scale":
      return { cursor: "nwse-resize", id: "transform.scale", label: "Scale" };
    default: {
      const exhaustive: never = operation;
      return exhaustive;
    }
  }
}

function getNodeTransformTarget(
  hit: CanvasHitResult,
  operation: CanvasNodeTransformKind
): NodeTransformTarget | null {
  if (hit.kind === "node") {
    return operation === "translate"
      ? { constraint: "free", kind: "translate", nodeId: hit.nodeId }
      : null;
  }

  if ((hit.kind !== "handle" && hit.kind !== "gizmo") || !hit.nodeId) {
    return null;
  }

  const transformHandle = CanvasNodeTransformHandleIdSchema.safeParse(
    hit.subTarget
  );

  if (!transformHandle.success) {
    return null;
  }

  switch (operation) {
    case "translate": {
      const handle = CanvasNodeTranslationHandleIdSchema.safeParse(
        transformHandle.data
      );

      if (handle.success) {
        return {
          constraint: TRANSLATION_CONSTRAINT_BY_HANDLE[handle.data],
          kind: "translate",
          nodeId: hit.nodeId
        };
      }

      break;
    }
    case "rotate": {
      const handle = CanvasNodeRotationHandleIdSchema.safeParse(
        transformHandle.data
      );

      if (handle.success) {
        return {
          axis: ROTATION_AXIS_BY_HANDLE[handle.data],
          kind: "rotate",
          nodeId: hit.nodeId
        };
      }

      break;
    }
    case "scale": {
      const handle = CanvasNodeScaleHandleIdSchema.safeParse(
        transformHandle.data
      );

      if (handle.success) {
        return {
          constraint: SCALE_CONSTRAINT_BY_HANDLE[handle.data],
          kind: "scale",
          nodeId: hit.nodeId
        };
      }

      break;
    }
    default: {
      const exhaustive: never = operation;
      return exhaustive;
    }
  }

  throw new CanvasEditorError(
    "tool-handler-failed",
    `Renderer returned ${transformHandle.data} for the active ${operation} tool.`
  );
}

function createNodeTransformInput(
  session: TransformSession,
  point: readonly [number, number]
): CanvasNodeTransformInput {
  const base = {
    nodeId: session.target.nodeId,
    origin: session.origin,
    point: [point[0], point[1]] as [number, number]
  };

  switch (session.target.kind) {
    case "translate":
      return {
        ...base,
        constraint: session.target.constraint,
        kind: "translate"
      };
    case "rotate":
      return {
        ...base,
        axis: session.target.axis,
        kind: "rotate"
      };
    case "scale":
      return {
        ...base,
        constraint: session.target.constraint,
        kind: "scale"
      };
    default: {
      const exhaustive: never = session.target;
      return exhaustive;
    }
  }
}

function getNodeTransformPatch(
  preview: CanvasNodeTransformPreview
): CanvasNodePatch {
  switch (preview.kind) {
    case "translate":
      return preview.mode === "2d"
        ? { position: preview.position }
        : { position: preview.position };
    case "rotate":
      return preview.mode === "2d"
        ? { rotation: preview.rotation }
        : { rotation: preview.rotation };
    case "scale":
      return preview.mode === "2d"
        ? { scale: preview.scale }
        : { scale: preview.scale };
    default: {
      const exhaustive: never = preview;
      return exhaustive;
    }
  }
}

export function createSelectTool<const TId extends string>(
  options: CanvasSelectToolOptions<TId> & { readonly id: TId }
): CanvasToolDefinition<TId>;
export function createSelectTool(
  options?: CanvasSelectToolOptions
): CanvasToolDefinition;
export function createSelectTool(
  options: CanvasSelectToolOptions = {}
): CanvasToolDefinition {
  const hover = options.hover ?? true;
  const marqueeEnabled = options.marquee ?? true;
  const marqueeSessions = new WeakMap<CanvasToolContext, MarqueeSession>();

  return {
    cursor: options.cursor ?? "default",
    id: options.id ?? "select",
    label: options.label ?? "Select",
    navigation: "allow",
    onDeactivate(context) {
      marqueeSessions.delete(context);
    },
    async onInput(input, context) {
      if (input.type === "key.down") {
        if (input.key === "Escape") {
          marqueeSessions.delete(context);
          await context.selectFromHit(
            { kind: "empty", renderer: "select-tool" },
            "replace"
          );
          return;
        }

        if (input.key === "Delete" || input.key === "Backspace") {
          await deleteSelectedNodes(context);
        }

        return;
      }

      if (input.type === "key.up") {
        return;
      }

      if (input.type === "pointer.down") {
        if (
          !marqueeEnabled ||
          !input.isPrimary ||
          input.button !== 0 ||
          context.setAuthoringPreviews === undefined ||
          context.resolveScenePoint === undefined
        ) {
          return;
        }

        // Only empty space starts a marquee — dragging a node stays a no-op so
        // the navigation layer keeps its existing pan behaviour.
        const hitTest = requireToolHitTest(context);
        const hit = await hitTest({ point: input.point });

        if (hit.kind !== "empty") {
          return;
        }

        const start = await resolve2DAuthoringPoint(
          context.resolveScenePoint,
          input.point
        );
        marqueeSessions.set(context, { pointerId: input.pointerId, start });
        return;
      }

      if (input.type === "pointer.cancel" || input.type === "pointer.leave") {
        await clearMarquee(marqueeSessions, context);

        if (hover) {
          await context.hoverFromHit({
            kind: "empty",
            renderer: "select-tool"
          });
        }

        return;
      }

      if (!("pointerId" in input)) {
        return;
      }

      const marquee = marqueeSessions.get(context);

      if (marquee && marquee.pointerId === input.pointerId) {
        const resolveScenePoint = context.resolveScenePoint;
        const setPreviews = context.setAuthoringPreviews;

        if (resolveScenePoint === undefined || setPreviews === undefined) {
          marqueeSessions.delete(context);
          return;
        }

        const current = await resolve2DAuthoringPoint(
          resolveScenePoint,
          input.point
        );

        if (input.type === "pointer.move") {
          await setPreviews([
            {
              kind: "select.marquee",
              mode: "2d",
              start: marquee.start,
              end: current
            }
          ]);
          return;
        }

        if (input.type === "pointer.up") {
          try {
            if (input.dragging) {
              const bounds = {
                minX: Math.min(marquee.start[0], current[0]),
                minY: Math.min(marquee.start[1], current[1]),
                maxX: Math.max(marquee.start[0], current[0]),
                maxY: Math.max(marquee.start[1], current[1])
              };
              const additive =
                input.shiftKey || input.ctrlKey || input.metaKey;
              await selectNodesInBounds(context, bounds, additive);
              return;
            }
          } finally {
            marqueeSessions.delete(context);
            await setPreviews([]);
          }
        }
      }

      if (
        input.type === "pointer.move" &&
        hover &&
        input.buttons === 0 &&
        !input.dragging
      ) {
        const hitTest = requireToolHitTest(context);
        const hit = await hitTest({ point: input.point });
        await context.hoverFromHit(hit);
        return;
      }

      if (
        input.type === "pointer.up" &&
        input.isPrimary &&
        input.button === 0 &&
        !input.dragging
      ) {
        const hitTest = requireToolHitTest(context);
        const hit = await hitTest({ point: input.point });
        const mode: CanvasSelectionMode =
          input.shiftKey || input.ctrlKey || input.metaKey
            ? "toggle"
            : "replace";
        await context.selectFromHit(hit, mode);
      }
    }
  };
}

type MarqueeSession = {
  readonly pointerId: number;
  readonly start: Point2;
};

async function clearMarquee(
  sessions: WeakMap<CanvasToolContext, MarqueeSession>,
  context: CanvasToolContext
): Promise<void> {
  if (!sessions.has(context)) {
    return;
  }

  sessions.delete(context);
  await context.setAuthoringPreviews?.([]);
}

/**
 * Selects every visible node whose world bounds intersect `bounds`. Requires the
 * renderer to expose `getNodesInBounds` (the 2D runtime does); without it the
 * marquee silently selects nothing rather than throwing mid-gesture.
 */
async function selectNodesInBounds(
  context: CanvasToolContext,
  bounds: {
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
  },
  additive: boolean
): Promise<void> {
  const ids = context.getNodesInBounds?.(bounds) ?? [];
  const selection = context.getSelection();
  const existing = additive ? selection.ids : [];
  const merged = [...new Set([...existing, ...ids])];

  await context.dispatch({
    label: "Marquee select",
    selection: {
      ids: merged,
      primaryId: merged.length > 0 ? merged[merged.length - 1]! : null,
      hoveredId: selection.hoveredId
    },
    type: "selection.set"
  });
}

async function deleteSelectedNodes(context: CanvasToolContext): Promise<void> {
  const selected = new Set(context.getSelection().ids);

  if (selected.size === 0) {
    return;
  }

  const nodes = context.getDocument().scene.nodes;
  const removeIds = new Set(selected);

  for (const node of nodes) {
    if (
      node.type === "edge" &&
      (selected.has(node.sourceId) || selected.has(node.targetId))
    ) {
      removeIds.add(node.id);
    }
  }

  const ordered = [
    ...nodes.filter((node) => removeIds.has(node.id) && node.type === "edge"),
    ...nodes.filter((node) => removeIds.has(node.id) && node.type !== "edge")
  ];

  if (ordered.length === 0) {
    return;
  }

  const commands = ordered.map((node) => ({
    label: "Delete node",
    nodeId: node.id,
    type: "node.remove" as const
  }));

  const onlyCommand = commands[0];
  if (commands.length === 1 && onlyCommand) {
    await context.dispatch(onlyCommand);
    return;
  }

  await context.dispatch({
    commands,
    label: "Delete",
    type: "transaction"
  });
}

function requireToolHitTest(
  context: CanvasToolContext
): NonNullable<CanvasToolContext["hitTest"]> {
  if (!context.hitTest) {
    throw new CanvasEditorError(
      "tool-capability-missing",
      "The active tool requires a renderer hitTest capability."
    );
  }

  return context.hitTest;
}

export { requireToolHitTest };

function requireTransformCapabilities(
  context: CanvasToolContext,
  operation: CanvasNodeTransformKind
): {
  resolveNodeTransform: NonNullable<
    CanvasToolContext["resolveNodeTransform"]
  >;
  setNodeTransformPreview: NonNullable<
    CanvasToolContext["setNodeTransformPreview"]
  >;
} {
  if (
    !context.nodeTransformKinds?.includes(operation) ||
    !context.resolveNodeTransform ||
    !context.setNodeTransformPreview
  ) {
    throw new CanvasEditorError(
      "tool-capability-missing",
      `The active tool requires renderer ${operation} preview capabilities.`
    );
  }

  return {
    resolveNodeTransform: context.resolveNodeTransform,
    setNodeTransformPreview: context.setNodeTransformPreview
  };
}

export function createGroupNodesCommand(
  options: CanvasGroupNodesOptions
): CanvasTransactionCommand {
  const document = parseAuthoringDocument(options.document);

  if (!Array.isArray(options.nodeIds) || options.nodeIds.length === 0) {
    throw new CanvasEditorError(
      "invalid-command",
      "Grouping requires at least one node."
    );
  }

  const nodeIds = options.nodeIds.map((nodeId) => parseNodeId(nodeId));

  if (new Set(nodeIds).size !== nodeIds.length) {
    throw new CanvasEditorError(
      "invalid-command",
      "Grouping node IDs must be unique."
    );
  }

  const nodes = nodeIds.map((nodeId) => {
    const node = document.scene.nodes.find((candidate) => candidate.id === nodeId);

    if (!node) {
      throw new CanvasEditorError(
        "node-not-found",
        `Node was not found: ${nodeId}`
      );
    }

    if (resolveEffectiveNodeState(document, node.id).locked) {
      throw new CanvasEditorError(
        "locked-target",
        `Node is effectively locked: ${node.id}`
      );
    }

    return node;
  });
  const firstNode = nodes[0];

  if (!firstNode) {
    throw new CanvasEditorError("internal-error", "Grouping lost its first node.");
  }

  if (
    nodes.some(
      (node) =>
        node.layerId !== firstNode.layerId || node.parentId !== firstNode.parentId
    )
  ) {
    throw new CanvasEditorError(
      "invalid-command",
      "Grouped nodes must be siblings in the same layer."
    );
  }

  const hasGroupId = "groupId" in options && options.groupId !== undefined;
  const hasCreateId =
    "createId" in options && typeof options.createId === "function";

  if (hasGroupId === hasCreateId) {
    throw new CanvasEditorError(
      "invalid-command",
      "Grouping requires exactly one of groupId or createId."
    );
  }

  const groupId = parseNodeId(
    hasGroupId
      ? options.groupId
      : createGroupId(options.createId as CanvasCreateId, document)
  );

  if (document.scene.nodes.some((node) => node.id === groupId)) {
    throw new CanvasEditorError(
      "node-already-exists",
      `Node already exists: ${groupId}`
    );
  }

  const group = CanvasNodeSchema.parse(
    document.scene.mode === "2d"
      ? {
          id: groupId,
          layerId: firstNode.layerId,
          parentId: firstNode.parentId,
          position: [0, 0],
          rotation: 0,
          scale: [1, 1],
          type: "group"
        }
      : {
          id: groupId,
          layerId: firstNode.layerId,
          parentId: firstNode.parentId,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          type: "group"
        }
  );
  const selectedIndices = nodeIds.map((nodeId) =>
    document.scene.nodes.findIndex((node) => node.id === nodeId)
  );
  const insertionIndex = Math.min(...selectedIndices);
  const commands: CanvasCommand[] = [
    {
      index: insertionIndex,
      node: group,
      type: "node.add"
    },
    ...nodes.map((node) =>
      createValidatedNodeUpdateCommand(node, { parentId: group.id })
    )
  ];

  return parseTransactionCommand({
    commands,
    label: "Group nodes",
    type: "transaction"
  });
}

export function createUngroupNodesCommand(
  documentInput: CanvasDocument,
  groupIdInput: NodeId
): CanvasTransactionCommand {
  const document = parseAuthoringDocument(documentInput);
  const groupId = parseNodeId(groupIdInput);
  const group = document.scene.nodes.find((node) => node.id === groupId);

  if (!group) {
    throw new CanvasEditorError("node-not-found", `Node was not found: ${groupId}`);
  }

  if (group.type !== "group") {
    throw new CanvasEditorError(
      "invalid-command",
      `Node is not a group: ${groupId}`
    );
  }

  if (resolveEffectiveNodeState(document, group.id).locked) {
    throw new CanvasEditorError(
      "locked-target",
      `Group is effectively locked: ${group.id}`
    );
  }

  const children = document.scene.nodes.filter(
    (node) => node.parentId === group.id
  );
  const commands: CanvasCommand[] = children.map((child) => {
    if (resolveEffectiveNodeState(document, child.id).locked) {
      throw new CanvasEditorError(
        "locked-target",
        `Node is effectively locked: ${child.id}`
      );
    }

    return createValidatedNodeUpdateCommand(
      child,
      document.scene.mode === "2d"
        ? create2DUngroupPatch(
            child as Canvas2DNode,
            group as CanvasNodeByType<"2d", "group">
          )
        : create3DUngroupPatch(
            child as Canvas3DNode,
            group as CanvasNodeByType<"3d", "group">
          )
    );
  });
  commands.push({ nodeId: group.id, type: "node.remove" });

  return parseTransactionCommand({
    commands,
    label: "Ungroup nodes",
    type: "transaction"
  });
}

function createGroupId(
  createId: CanvasCreateId,
  document: CanvasDocument
): NodeId {
  try {
    return document.scene.mode === "2d"
      ? createId({ document, mode: "2d", type: "group" })
      : createId({ document, mode: "3d", type: "group" });
  } catch (cause) {
    throw new CanvasEditorError("invalid-id", "Group ID creation failed.", {
      cause
    });
  }
}

function parseNodeId(input: NodeId): NodeId {
  try {
    return NodeIdSchema.parse(input);
  } catch (cause) {
    throw new CanvasEditorError("invalid-id", "Node ID must be non-empty.", {
      cause
    });
  }
}

function parseAuthoringDocument(document: CanvasDocument): CanvasDocument {
  try {
    return CanvasDocumentSchema.parse(document);
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-document",
      "Authoring document validation failed.",
      { cause }
    );
  }
}

function parseTransactionCommand(input: CanvasTransactionCommand): CanvasTransactionCommand {
  try {
    return freezeValue(
      CanvasCommandSchema.parse(input) as CanvasTransactionCommand
    );
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-command",
      "Transaction validation failed.",
      { cause, commandType: "transaction" }
    );
  }
}

function create2DUngroupPatch(
  child: Canvas2DNode,
  group: CanvasNodeByType<"2d", "group">
): CanvasNodePatch {
  switch (child.type) {
    case "rect":
    case "circle":
    case "group": {
      const transform = compose2DTransforms(group, child);
      return { ...transform, parentId: group.parentId };
    }
    case "measurement":
      return {
        end: transformPoint2(group, child.end),
        parentId: group.parentId,
        start: transformPoint2(group, child.start)
      };
    case "annotation":
      return {
        anchor: transformPoint2(group, child.anchor),
        parentId: group.parentId
      };
    case "text":
    case "html": {
      const transform = compose2DTransforms(group, child);
      return { ...transform, parentId: group.parentId };
    }
    case "edge":
      return {
        parentId: group.parentId
      };
    default: {
      const exhaustive: never = child;
      return exhaustive;
    }
  }
}

function create3DUngroupPatch(
  child: Canvas3DNode,
  group: CanvasNodeByType<"3d", "group">
): CanvasNodePatch {
  switch (child.type) {
    case "box":
    case "sphere":
    case "mesh":
    case "instances":
    case "group": {
      const transform = compose3DTransforms(group, child);
      return { ...transform, parentId: group.parentId };
    }
    case "measurement":
      return {
        end: transformPoint3(group, child.end),
        parentId: group.parentId,
        start: transformPoint3(group, child.start)
      };
    case "annotation":
      return {
        anchor: transformPoint3(group, child.anchor),
        parentId: group.parentId
      };
    default: {
      const exhaustive: never = child;
      return exhaustive;
    }
  }
}

