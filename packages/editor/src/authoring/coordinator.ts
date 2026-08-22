import {
  CanvasAuthoringPreviewSchema,
  CanvasLayerIdSchema,
  CanvasScenePointResultSchema,
  NodeIdSchema,
  type Canvas2DGrid,
  type Canvas2DNode,
  type Canvas3DGrid,
  type Canvas3DNode,
  type CanvasAuthoringPreview,
  type CanvasAuthoringPreviewForMode,
  type CanvasCreateId,
  type CanvasDocument,
  type CanvasLayerId,
  type CanvasMode,
  type CanvasScenePointResult,
  type CanvasToolContext,
  type CanvasWorkPlane,
  type NodeId,
  type Point2,
  type Vector3
} from "@denovo/canvas-core";
import { CanvasEditorError } from "../errors.js";
import { dotVector3, snapPointToGrid } from "../grid.js";
import { vectorLength3 } from "../math/transform.js";

export function parseNodeId(input: NodeId): NodeId {
  try {
    return NodeIdSchema.parse(input);
  } catch (cause) {
    throw new CanvasEditorError("invalid-id", "Node ID must be non-empty.", {
      cause
    });
  }
}

export type AuthoringPreviewSetter = NonNullable<
  CanvasToolContext["setAuthoringPreviews"]
>;

export type ScenePointResolver = NonNullable<CanvasToolContext["resolveScenePoint"]>;

export type SurfacePointResolver = NonNullable<
  CanvasToolContext["resolveSurfacePoint"]
>;

export type AuthoringPreviewCleanupState =
  | { readonly status: "ready" }
  | { readonly error: CanvasEditorError; readonly status: "failed" };

export type AuthoringPreviewCoordinator = {
  activeLease: AuthoringPreviewLease | null;
  cleanupState: Promise<AuthoringPreviewCleanupState>;
  nextGeneration: number;
};

export type AuthoringPreviewLease = {
  cleanup: Promise<void> | null;
  readonly coordinator: AuthoringPreviewCoordinator;
  readonly generation: number;
  readonly pendingWrites: Set<Promise<void>>;
  readonly ready: Promise<AuthoringPreviewCleanupState>;
  readonly setPreviews: AuthoringPreviewSetter;
};

export type AuthoringSessionBase = {
  readonly document: CanvasDocument;
  readonly previewLease: AuthoringPreviewLease;
  readonly resolveScenePoint: ScenePointResolver;
};

export type PendingAuthoringStart = Pick<AuthoringSessionBase, "previewLease">;

export const authoringPreviewCoordinators = new WeakMap<
  CanvasToolContext,
  AuthoringPreviewCoordinator
>();
export const authoringDeactivationCleanups = new WeakMap<
  CanvasToolContext,
  Set<Promise<void>>
>();

export type Shape2DSession = AuthoringSessionBase & {
  readonly nodeId: NodeId;
  readonly pointerId: number;
  readonly start: Point2;
};

export type Primitive3DSession = AuthoringSessionBase & {
  readonly nodeId: NodeId;
  readonly pointerId: number;
};

export type SurfacePlacementSession = {
  readonly document: CanvasDocument;
  pointerId: number | null;
  readonly previewLease: AuthoringPreviewLease;
  readonly resolveSurfacePoint: SurfacePointResolver;
};

export type SurfacePlacementGhostPreview = Extract<
  CanvasAuthoringPreviewForMode<"3d">,
  { readonly kind: "primitive.ghost" }
>;

export type SurfacePlacementGhost = SurfacePlacementGhostPreview["primitive"];

export type SurfacePlacementCandidate = {
  readonly kind: "hit";
  readonly layerId: CanvasLayerId;
  readonly position: Vector3;
};

export type SurfacePlacementUpdate =
  | SurfacePlacementCandidate
  | { readonly kind: "miss" }
  | { readonly kind: "stale" };

export function requireAuthoringCapabilities(context: CanvasToolContext): {
  readonly resolveScenePoint: ScenePointResolver;
  readonly setPreviews: AuthoringPreviewSetter;
} {
  if (!context.resolveScenePoint || !context.setAuthoringPreviews) {
    throw new CanvasEditorError(
      "tool-capability-missing",
      "The active authoring tool requires scene-point resolution and preview capabilities."
    );
  }

  return {
    resolveScenePoint: context.resolveScenePoint,
    setPreviews: context.setAuthoringPreviews
  };
}

export function requireSurfacePlacementCapabilities(context: CanvasToolContext): {
  readonly resolveSurfacePoint: SurfacePointResolver;
  readonly setPreviews: AuthoringPreviewSetter;
} {
  if (!context.resolveSurfacePoint || !context.setAuthoringPreviews) {
    throw new CanvasEditorError(
      "tool-capability-missing",
      "The active surface-placement tool requires surface-point resolution and preview capabilities."
    );
  }

  return {
    resolveSurfacePoint: context.resolveSurfacePoint,
    setPreviews: context.setAuthoringPreviews
  };
}

export function requireDistanceSurfaceCapabilities(context: CanvasToolContext): {
  readonly hitTest: NonNullable<CanvasToolContext["hitTest"]>;
  readonly resolveSurfacePoint: SurfacePointResolver;
  readonly setPreviews: AuthoringPreviewSetter;
} {
  if (
    !context.hitTest ||
    !context.resolveSurfacePoint ||
    !context.setAuthoringPreviews
  ) {
    throw new CanvasEditorError(
      "tool-capability-missing",
      "A surface-capture measurement tool requires hit testing, surface-point resolution, and preview capabilities."
    );
  }

  return {
    hitTest: context.hitTest,
    resolveSurfacePoint: context.resolveSurfacePoint,
    setPreviews: context.setAuthoringPreviews
  };
}

export function requireAuthoringTarget(
  document: CanvasDocument,
  mode: CanvasMode,
  layerIdInput: CanvasLayerId
): CanvasLayerId {
  let layerId: CanvasLayerId;

  try {
    layerId = CanvasLayerIdSchema.parse(layerIdInput);
  } catch (cause) {
    throw new CanvasEditorError("layer-not-found", "Target layer ID is invalid.", {
      cause
    });
  }

  if (document.scene.mode !== mode) {
    throw new CanvasEditorError(
      "mode-mismatch",
      `The ${mode} authoring tool cannot edit a ${document.scene.mode} document.`
    );
  }

  const layer = document.scene.layers.find((candidate) => candidate.id === layerId);

  if (!layer) {
    throw new CanvasEditorError(
      "layer-not-found",
      `Layer was not found: ${layerId}`
    );
  }

  if (layer.locked) {
    throw new CanvasEditorError(
      "locked-target",
      `Target layer is locked: ${layer.id}`
    );
  }

  return layer.id;
}

export function createAuthoringNodeId<TMode extends CanvasMode>(
  createId: CanvasCreateId,
  document: CanvasDocument,
  mode: TMode,
  type: CanvasNodeForAuthoringMode<TMode>
): NodeId {
  let input: NodeId;

  try {
    input = createId({ document, mode, type });
  } catch (cause) {
    throw new CanvasEditorError("invalid-id", "Node ID creation failed.", {
      cause
    });
  }

  const nodeId = parseNodeId(input);

  if (document.scene.nodes.some((node) => node.id === nodeId)) {
    throw new CanvasEditorError(
      "node-already-exists",
      `Node already exists: ${nodeId}`
    );
  }

  return nodeId;
}

export type CanvasNodeForAuthoringMode<TMode extends CanvasMode> =
  TMode extends "2d" ? Canvas2DNode["type"] : Canvas3DNode["type"];

export async function resolve2DAuthoringPoint(
  resolveScenePoint: ScenePointResolver,
  viewportPoint: Point2,
  grid?: Canvas2DGrid
): Promise<Point2> {
  let result: CanvasScenePointResult;

  try {
    result = CanvasScenePointResultSchema.parse(
      await resolveScenePoint({ mode: "2d", viewportPoint })
    );
  } catch (cause) {
    throw new CanvasEditorError(
      "tool-handler-failed",
      "The renderer returned an invalid 2D scene point.",
      { cause }
    );
  }

  if (result.mode !== "2d") {
    throw new CanvasEditorError(
      "mode-mismatch",
      "The renderer returned a 3D point for a 2D request."
    );
  }

  return grid
    ? snapPointToGrid({
        grid,
        kind: "grid",
        mode: "2d",
        position: result.position
      }).position
    : result.position;
}

export async function resolve3DAuthoringPoint(
  resolveScenePoint: ScenePointResolver,
  viewportPoint: Point2,
  workPlane: CanvasWorkPlane,
  grid?: Canvas3DGrid
): Promise<Vector3> {
  let result: CanvasScenePointResult;

  try {
    result = CanvasScenePointResultSchema.parse(
      await resolveScenePoint({ mode: "3d", viewportPoint, workPlane })
    );
  } catch (cause) {
    throw new CanvasEditorError(
      "tool-handler-failed",
      "The renderer returned an invalid 3D scene point.",
      { cause }
    );
  }

  if (result.mode !== "3d") {
    throw new CanvasEditorError(
      "mode-mismatch",
      "The renderer returned a 2D point for a 3D request."
    );
  }

  const planeResidual =
    dotVector3(workPlane.normal, result.position) + workPlane.constant;
  const tolerance =
    1e-8 *
    vectorLength3(workPlane.normal) *
    Math.max(1, vectorLength3(result.position));

  if (Math.abs(planeResidual) > tolerance) {
    throw new CanvasEditorError(
      "tool-handler-failed",
      "The renderer result does not lie on the requested work plane."
    );
  }

  return grid
    ? snapPointToGrid({
        grid,
        kind: "grid",
        mode: "3d",
        position: result.position
      }).position
    : result.position;
}

export async function publishAuthoringPreviews(
  setPreviews: AuthoringPreviewSetter,
  previews: readonly CanvasAuthoringPreview[]
): Promise<void> {
  let parsed: CanvasAuthoringPreview[];

  try {
    parsed = previews.map((preview) => CanvasAuthoringPreviewSchema.parse(preview));
    await setPreviews(parsed);
  } catch (cause) {
    throw new CanvasEditorError(
      "tool-handler-failed",
      "Authoring preview update failed.",
      { cause }
    );
  }
}

export function getAuthoringPreviewCoordinator(
  context: CanvasToolContext
): AuthoringPreviewCoordinator {
  const existing = authoringPreviewCoordinators.get(context);

  if (existing) {
    return existing;
  }

  const coordinator: AuthoringPreviewCoordinator = {
    activeLease: null,
    cleanupState: Promise.resolve({ status: "ready" }),
    nextGeneration: 1
  };
  authoringPreviewCoordinators.set(context, coordinator);
  return coordinator;
}

export function acquireAuthoringPreviewLease(
  context: CanvasToolContext,
  setPreviews: AuthoringPreviewSetter
): AuthoringPreviewLease {
  const coordinator = getAuthoringPreviewCoordinator(context);

  if (coordinator.activeLease) {
    releaseAuthoringPreviewLease(coordinator.activeLease);
  }

  const lease: AuthoringPreviewLease = {
    cleanup: null,
    coordinator,
    generation: coordinator.nextGeneration,
    pendingWrites: new Set(),
    ready: coordinator.cleanupState,
    setPreviews
  };
  coordinator.nextGeneration += 1;
  coordinator.activeLease = lease;
  return lease;
}

export async function publishAuthoringPreviewLease(
  lease: AuthoringPreviewLease,
  previews: readonly CanvasAuthoringPreview[]
): Promise<boolean> {
  if (lease.coordinator.activeLease !== lease) {
    return false;
  }

  const readiness = await lease.ready;

  if (readiness.status === "failed") {
    throw readiness.error;
  }

  if (lease.coordinator.activeLease !== lease) {
    return false;
  }

  const write = publishAuthoringPreviews(lease.setPreviews, previews);
  lease.pendingWrites.add(write);

  try {
    await write;
  } finally {
    lease.pendingWrites.delete(write);
  }

  const active = lease.coordinator.activeLease === lease;

  if (!active && lease.cleanup) {
    await lease.cleanup;
  }

  return active;
}

export function releaseAuthoringPreviewLease(
  lease: AuthoringPreviewLease
): Promise<void> {
  if (lease.cleanup) {
    return lease.cleanup;
  }

  const { coordinator } = lease;

  if (coordinator.activeLease === lease) {
    coordinator.activeLease = null;
  }

  const pendingWrites = [...lease.pendingWrites];
  const immediateClear = publishAuthoringPreviews(lease.setPreviews, []);
  const cleanup = (async () => {
    let cleanupError: CanvasEditorError | null = null;
    const priorCleanupState = await lease.ready;

    if (priorCleanupState.status === "failed") {
      cleanupError = priorCleanupState.error;
    }

    try {
      await immediateClear;
    } catch (cause) {
      cleanupError =
        cause instanceof CanvasEditorError
          ? cause
          : new CanvasEditorError(
              "tool-handler-failed",
              "Authoring preview cleanup failed.",
              { cause }
            );
    }

    await Promise.allSettled(pendingWrites);

    try {
      await publishAuthoringPreviews(lease.setPreviews, []);
    } catch (cause) {
      cleanupError ??=
        cause instanceof CanvasEditorError
          ? cause
          : new CanvasEditorError(
              "tool-handler-failed",
              "Authoring preview cleanup failed.",
              { cause }
            );
    }

    if (cleanupError) {
      throw cleanupError;
    }
  })();
  lease.cleanup = cleanup;
  coordinator.cleanupState = cleanup.then<
    AuthoringPreviewCleanupState,
    AuthoringPreviewCleanupState
  >(
    () => ({ status: "ready" }),
    (cause: unknown) => ({
      error:
        cause instanceof CanvasEditorError
          ? cause
          : new CanvasEditorError(
              "tool-handler-failed",
              "Authoring preview cleanup failed.",
              { cause }
            ),
      status: "failed"
    })
  );
  return cleanup;
}

export function registerAuthoringDeactivationCleanup(
  context: CanvasToolContext,
  cleanup: Promise<void>
): void {
  const cleanups =
    authoringDeactivationCleanups.get(context) ?? new Set<Promise<void>>();
  cleanups.add(cleanup);
  authoringDeactivationCleanups.set(context, cleanups);
}

export function takeAuthoringDeactivationCleanups(
  context: CanvasToolContext
): readonly Promise<void>[] {
  const cleanups = authoringDeactivationCleanups.get(context);
  authoringDeactivationCleanups.delete(context);
  return cleanups ? [...cleanups] : [];
}

export async function publishOwnedAuthoringPreviews<
  Owner extends Pick<AuthoringSessionBase, "previewLease">
>(
  owners: WeakMap<CanvasToolContext, Owner>,
  context: CanvasToolContext,
  owner: Owner,
  previews: readonly CanvasAuthoringPreview[]
): Promise<boolean> {
  if (owners.get(context) !== owner) {
    return false;
  }

  const published = await publishAuthoringPreviewLease(
    owner.previewLease,
    previews
  );
  return published && owners.get(context) === owner;
}

export function create2DPreviewEntries(
  grid: Canvas2DGrid | undefined,
  position: Point2,
  node?: Canvas2DNode
): readonly CanvasAuthoringPreviewForMode<"2d">[] {
  return [
    ...(grid
      ? ([
          { grid, kind: "grid", mode: "2d" },
          { kind: "grid.snap", mode: "2d", position }
        ] as const)
      : []),
    ...(node ? ([{ kind: "node", mode: "2d", node }] as const) : [])
  ];
}

export function create3DPreviewEntries(
  grid: Canvas3DGrid | undefined,
  position: Vector3,
  node?: Canvas3DNode
): readonly CanvasAuthoringPreviewForMode<"3d">[] {
  return [
    ...(grid
      ? ([
          { grid, kind: "grid", mode: "3d" },
          { kind: "grid.snap", mode: "3d", position }
        ] as const)
      : []),
    ...(node ? ([{ kind: "node", mode: "3d", node }] as const) : [])
  ];
}

export async function clearAuthoringSession<
  Session extends Pick<AuthoringSessionBase, "previewLease">
>(
  sessions: WeakMap<CanvasToolContext, Session>,
  context: CanvasToolContext
): Promise<void> {
  const session = sessions.get(context);
  sessions.delete(context);

  if (session) {
    await releaseAuthoringPreviewLease(session.previewLease);
  }
}

export function clearAuthoringSessionOnDeactivate<
  Session extends Pick<AuthoringSessionBase, "previewLease">
>(
  sessions: WeakMap<CanvasToolContext, Session>,
  context: CanvasToolContext
): void {
  const session = sessions.get(context);
  sessions.delete(context);

  if (session) {
    registerAuthoringDeactivationCleanup(
      context,
      releaseAuthoringPreviewLease(session.previewLease)
    );
  }
}

export function assertSessionDocument(
  context: CanvasToolContext,
  session: Pick<AuthoringSessionBase, "document">
): void {
  if (context.getDocument() !== session.document) {
    throw new CanvasEditorError(
      "invalid-document",
      "The document changed while an authoring gesture was active."
    );
  }
}
