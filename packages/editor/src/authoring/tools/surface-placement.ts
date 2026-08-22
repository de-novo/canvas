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
  Canvas3DSurfacePlacementToolOptions
} from "../tool-options.js";

const SURFACE_PLACEMENT_TOLERANCE = 1e-6;

type SurfacePlacementHit = Extract<
  Canvas3DSurfacePointResult,
  { readonly kind: "hit"; readonly nodeType: "box" }
>;

type SurfacePlacementAxis = SurfacePlacementHit["feature"]["axis"];

function parseSurfacePlacementScale(
  scaleInput: CanvasNodeByType<"3d", "box">["scale"]
): Vector3 {
  if (
    !Array.isArray(scaleInput) ||
    scaleInput.length !== 3 ||
    !scaleInput.every(
      (component) => Number.isFinite(component) && component > 0
    )
  ) {
    throw new CanvasEditorError(
      "invalid-command",
      "Surface-placement scale must contain three finite positive numbers."
    );
  }

  return [scaleInput[0], scaleInput[1], scaleInput[2]];
}

function parseSurfacePlacementGhostTemplate(
  options: Canvas3DSurfacePlacementToolOptions
): SurfacePlacementGhost {
  let preview: CanvasAuthoringPreview;

  try {
    preview = CanvasAuthoringPreviewSchema.parse({
      kind: "primitive.ghost",
      mode: "3d",
      primitive: {
        ...(options.color === undefined ? {} : { color: options.color }),
        ...(options.scale === undefined ? {} : { scale: options.scale }),
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        type: "box"
      }
    });
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-command",
      "Surface-placement primitive validation failed.",
      { cause }
    );
  }

  if (preview.mode !== "3d" || preview.kind !== "primitive.ghost") {
    throw new CanvasEditorError(
      "internal-error",
      "Surface-placement primitive validation returned the wrong preview kind."
    );
  }

  return preview.primitive;
}

function validateSurfacePlacementOptions(
  options: Canvas3DSurfacePlacementToolOptions
): void {
  if (options.mode !== "3d") {
    throw new CanvasEditorError(
      "mode-mismatch",
      "A 3D surface-placement tool requires mode 3d."
    );
  }

  if (options.type !== "box") {
    throw new CanvasEditorError(
      "invalid-command",
      "The first surface-placement slice supports box sources only."
    );
  }

  if (typeof options.createId !== "function") {
    throw new CanvasEditorError("invalid-id", "A createId function is required.");
  }

  if (
    !options.placement ||
    options.placement.kind !== "box-face" ||
    options.placement.orientation !== "world-aligned" ||
    Object.keys(options.placement).some(
      (key) => key !== "kind" && key !== "orientation"
    )
  ) {
    throw new CanvasEditorError(
      "invalid-command",
      "Surface placement requires the exact world-aligned box-face policy."
    );
  }

  if (
    "grid" in options ||
    "workPlane" in options ||
    "rotation" in options
  ) {
    throw new CanvasEditorError(
      "invalid-command",
      "Surface placement does not accept grid, workPlane, or rotation options."
    );
  }
}

async function resolve3DSurfacePlacementPoint(
  resolveSurfacePoint: SurfacePointResolver,
  viewportPoint: Point2
): Promise<Canvas3DSurfacePointResult> {
  let resultInput: Canvas3DSurfacePointResult;

  try {
    resultInput = await resolveSurfacePoint({
      mode: "3d",
      target: { kind: "node", nodeType: "box" },
      viewportPoint
    });
  } catch (cause) {
    throw new CanvasEditorError(
      "tool-handler-failed",
      "Surface-point resolution failed.",
      { cause }
    );
  }

  try {
    return Canvas3DSurfacePointResultSchema.parse(resultInput);
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-hit-result",
      "The renderer returned an invalid 3D surface point.",
      { cause }
    );
  }
}

function surfacePlacementAxisIndex(axis: SurfacePlacementAxis): 0 | 1 | 2 {
  switch (axis) {
    case "x":
      return 0;
    case "y":
      return 1;
    case "z":
      return 2;
    default: {
      const exhaustive: never = axis;
      throw new CanvasEditorError(
        "internal-error",
        `Unsupported surface-placement axis: ${exhaustive}`
      );
    }
  }
}

function assertSurfacePlacementTarget(
  document: CanvasDocument,
  hit: SurfacePlacementHit
): void {
  if (document.scene.mode !== "3d") {
    throw new CanvasEditorError(
      "mode-mismatch",
      "A 3D surface hit cannot target a 2D document."
    );
  }

  const target = document.scene.nodes.find((node) => node.id === hit.nodeId);

  if (!target || target.type !== "box" || hit.nodeType !== "box") {
    throw new CanvasEditorError(
      "invalid-hit-result",
      `The surface target is not a current box node: ${hit.nodeId}`
    );
  }

  if (target.parentId !== null) {
    throw new CanvasEditorError(
      "invalid-hit-result",
      `The first surface-placement slice requires a root target: ${target.id}`
    );
  }

  if (target.rotation.some((component) => component !== 0)) {
    throw new CanvasEditorError(
      "invalid-hit-result",
      `The first surface-placement slice requires a world-aligned target: ${target.id}`
    );
  }

  if (
    !target.scale.every(
      (component) => Number.isFinite(component) && component > 0
    )
  ) {
    throw new CanvasEditorError(
      "invalid-hit-result",
      `The surface target scale must be finite and strictly positive: ${target.id}`
    );
  }

  if (!getEffectiveNodeState(document, target.id).visible) {
    throw new CanvasEditorError(
      "invalid-hit-result",
      `The surface target is not effectively visible: ${target.id}`
    );
  }

  const axisIndex = surfacePlacementAxisIndex(hit.feature.axis);

  for (const index of [0, 1, 2] as const) {
    const expected = index === axisIndex ? hit.feature.side : 0;

    if (Math.abs(hit.normal[index] - expected) > SURFACE_PLACEMENT_TOLERANCE) {
      throw new CanvasEditorError(
        "invalid-hit-result",
        `The surface normal does not match ${hit.feature.axis}${hit.feature.side > 0 ? "+" : "-"} for ${target.id}.`
      );
    }
  }

  const targetMagnitude = Math.max(
    1,
    ...target.position.map((component) => Math.abs(component)),
    ...target.scale
  );
  const pointTolerance = SURFACE_PLACEMENT_TOLERANCE * targetMagnitude;
  const expectedFaceCoordinate =
    target.position[axisIndex] +
    hit.feature.side * target.scale[axisIndex] * 0.5;

  if (Math.abs(hit.point[axisIndex] - expectedFaceCoordinate) > pointTolerance) {
    throw new CanvasEditorError(
      "invalid-hit-result",
      `The surface point does not lie on the reported face of ${target.id}.`
    );
  }

  for (const index of [0, 1, 2] as const) {
    if (index === axisIndex) {
      continue;
    }

    const halfExtent = target.scale[index] * 0.5;

    if (
      hit.point[index] < target.position[index] - halfExtent - pointTolerance ||
      hit.point[index] > target.position[index] + halfExtent + pointTolerance
    ) {
      throw new CanvasEditorError(
        "invalid-hit-result",
        `The surface point lies outside the reported face of ${target.id}.`
      );
    }
  }
}

function resolveSurfacePlacementCenter(
  hit: SurfacePlacementHit,
  scale: Vector3
): Vector3 {
  const support =
    0.5 *
    (Math.abs(hit.normal[0] * scale[0]) +
      Math.abs(hit.normal[1] * scale[1]) +
      Math.abs(hit.normal[2] * scale[2]));
  const axisIndex = surfacePlacementAxisIndex(hit.feature.axis);
  const axisSupport = scale[axisIndex] * 0.5;
  const tolerance =
    SURFACE_PLACEMENT_TOLERANCE * Math.max(1, support, axisSupport);

  if (
    !Number.isFinite(support) ||
    support <= 0 ||
    Math.abs(support - axisSupport) > tolerance
  ) {
    throw new CanvasEditorError(
      "invalid-hit-result",
      "The surface normal does not produce the reported box-face support."
    );
  }

  const position: Vector3 = [
    hit.point[0] + hit.normal[0] * support,
    hit.point[1] + hit.normal[1] * support,
    hit.point[2] + hit.normal[2] * support
  ];

  if (!position.every(Number.isFinite)) {
    throw new CanvasEditorError(
      "invalid-hit-result",
      "Surface placement produced a non-finite box center."
    );
  }

  return position;
}

function createSurfacePlacementGhostPreview(
  template: SurfacePlacementGhost,
  position: Vector3
): SurfacePlacementGhostPreview {
  return {
    kind: "primitive.ghost",
    mode: "3d",
    primitive: {
      ...template,
      position
    }
  };
}

function createSurfacePlacementNode(
  template: SurfacePlacementGhost,
  layerId: CanvasLayerId,
  nodeId: NodeId,
  position: Vector3
): CanvasNodeByType<"3d", "box"> {
  return BoxNodeSchema.parse({
    ...template,
    id: nodeId,
    layerId,
    position
  });
}

async function getOrCreateSurfacePlacementSession(
  sessions: WeakMap<CanvasToolContext, SurfacePlacementSession>,
  context: CanvasToolContext,
  layerId: CanvasLayerId
): Promise<SurfacePlacementSession> {
  const document = context.getDocument();
  requireAuthoringTarget(document, "3d", layerId);
  const capabilities = requireSurfacePlacementCapabilities(context);
  const existing = sessions.get(context);

  if (existing?.document === document) {
    return existing;
  }

  if (existing) {
    await clearAuthoringSession(sessions, context);
  }

  const session: SurfacePlacementSession = {
    document,
    pointerId: null,
    previewLease: acquireAuthoringPreviewLease(
      context,
      capabilities.setPreviews
    ),
    resolveSurfacePoint: capabilities.resolveSurfacePoint
  };
  sessions.set(context, session);
  return session;
}

async function updateSurfacePlacementPreview(
  sessions: WeakMap<CanvasToolContext, SurfacePlacementSession>,
  context: CanvasToolContext,
  session: SurfacePlacementSession,
  viewportPoint: Point2,
  layerIdInput: CanvasLayerId,
  scale: Vector3,
  template: SurfacePlacementGhost
): Promise<SurfacePlacementUpdate> {
  if (sessions.get(context) !== session) {
    return { kind: "stale" };
  }

  assertSessionDocument(context, session);
  const layerId = requireAuthoringTarget(
    session.document,
    "3d",
    layerIdInput
  );
  let result: Canvas3DSurfacePointResult;

  try {
    result = await resolve3DSurfacePlacementPoint(
      session.resolveSurfacePoint,
      viewportPoint
    );
  } catch (cause) {
    if (sessions.get(context) !== session) {
      return { kind: "stale" };
    }

    throw cause;
  }

  if (sessions.get(context) !== session) {
    return { kind: "stale" };
  }

  assertSessionDocument(context, session);

  if (result.kind === "miss") {
    const published = await publishOwnedAuthoringPreviews(
      sessions,
      context,
      session,
      []
    );
    return published ? { kind: "miss" } : { kind: "stale" };
  }

  if (result.nodeType !== "box") {
    // The tool only requests box targets; a mesh hit here means the runtime
    // violated the request contract.
    throw new CanvasEditorError(
      "invalid-hit-result",
      `The surface target is not a current box node: ${result.nodeId}`
    );
  }

  assertSurfacePlacementTarget(session.document, result);
  const position = resolveSurfacePlacementCenter(result, scale);
  const published = await publishOwnedAuthoringPreviews(
    sessions,
    context,
    session,
    [createSurfacePlacementGhostPreview(template, position)]
  );

  return published
    ? { kind: "hit", layerId, position }
    : { kind: "stale" };
}

export function create3DSurfacePlacementTool<const TId extends string>(
  options: Canvas3DSurfacePlacementToolOptions<TId> & { readonly id: TId }
): CanvasToolDefinition<TId>;
export function create3DSurfacePlacementTool(
  options: Canvas3DSurfacePlacementToolOptions
): CanvasToolDefinition;
export function create3DSurfacePlacementTool(
  options: Canvas3DSurfacePlacementToolOptions
): CanvasToolDefinition {
  validateSurfacePlacementOptions(options);
  const template = parseSurfacePlacementGhostTemplate(options);
  const scale = parseSurfacePlacementScale(template.scale);
  const sessions = new WeakMap<CanvasToolContext, SurfacePlacementSession>();
  const label = options.label ?? "Surface Box";

  return {
    cursor: options.cursor ?? "crosshair",
    id: options.id ?? "create.surface.box",
    label,
    navigation: "block",
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

        const existing = sessions.get(context);

        if (existing && existing.pointerId !== null) {
          return;
        }

        const session = await getOrCreateSurfacePlacementSession(
          sessions,
          context,
          options.layerId
        );
        session.pointerId = input.pointerId;

        try {
          await updateSurfacePlacementPreview(
            sessions,
            context,
            session,
            input.point,
            options.layerId,
            scale,
            template
          );
        } catch (cause) {
          await clearAuthoringSession(sessions, context);
          throw cause;
        }
        return;
      }

      if (input.type === "pointer.move") {
        let session = sessions.get(context);

        if (session && session.pointerId !== null) {
          if (session.pointerId !== input.pointerId) {
            return;
          }
        } else {
          if (
            input.buttons !== 0 ||
            (input.pointerType !== "mouse" && input.pointerType !== "pen")
          ) {
            return;
          }

          session = await getOrCreateSurfacePlacementSession(
            sessions,
            context,
            options.layerId
          );
        }

        try {
          await updateSurfacePlacementPreview(
            sessions,
            context,
            session,
            input.point,
            options.layerId,
            scale,
            template
          );
        } catch (cause) {
          await clearAuthoringSession(sessions, context);
          throw cause;
        }
        return;
      }

      if (input.type !== "pointer.up") {
        return;
      }

      const session = sessions.get(context);

      if (!session || session.pointerId !== input.pointerId) {
        return;
      }

      try {
        const placement = await updateSurfacePlacementPreview(
          sessions,
          context,
          session,
          input.point,
          options.layerId,
          scale,
          template
        );

        if (placement.kind !== "hit") {
          return;
        }

        assertSessionDocument(context, session);
        const nodeId = createAuthoringNodeId(
          options.createId,
          session.document,
          "3d",
          "box"
        );
        const node = createSurfacePlacementNode(
          template,
          placement.layerId,
          nodeId,
          placement.position
        );
        await context.dispatch({
          label: `Create ${label}`,
          node,
          type: "node.add"
        });
      } finally {
        await clearAuthoringSession(sessions, context);
      }
    }
  };
}

