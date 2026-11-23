import {
  CanvasDocumentSchema,
  CanvasHitResultSchema,
  defineDocument,
  CanvasSelectionModeSchema,
  SelectionStateSchema,
  type CanvasDocument,
  type CanvasHitResult,
  type CanvasSelectionMode,
  type NodeId,
  type SelectionState
} from "@denovo/canvas-core";
import { Effect } from "effect";
import { CanvasEditorError } from "./errors.js";
import type { EditorEffect } from "./internal-types.js";
import { freezeValue, uniqueIds } from "./utils.js";
import { resolveEffectiveNodeState } from "./node-state.js";

export function sanitizeSelectionForDocument(
  selection: SelectionState,
  document: CanvasDocument
): SelectionState {
  const ids = selection.ids.filter((id) => {
    const state = resolveEffectiveNodeState(document, id);
    return state.visible && !state.locked;
  });
  const hoveredId =
    selection.hoveredId === null ||
    resolveEffectiveNodeState(document, selection.hoveredId).visible
      ? selection.hoveredId
      : null;
  const primaryId =
    selection.primaryId !== null && ids.includes(selection.primaryId)
      ? selection.primaryId
      : (ids[ids.length - 1] ?? null);
  return freezeValue({ hoveredId, ids, primaryId });
}

export function parseHitResultEffect(input: unknown): EditorEffect<CanvasHitResult> {
  return Effect.try({
    try: () => CanvasHitResultSchema.parse(input),
    catch: (cause) =>
      new CanvasEditorError("invalid-hit-result", "Hit result validation failed.", {
        cause
      })
  });
}

export function parseSelectionModeEffect(
  input: unknown
): EditorEffect<CanvasSelectionMode> {
  return Effect.try({
    try: () => CanvasSelectionModeSchema.parse(input),
    catch: (cause) =>
      new CanvasEditorError("invalid-selection", "Selection mode validation failed.", {
        cause
      })
  });
}

export function getHitNodeId(hit: CanvasHitResult): NodeId | null {
  switch (hit.kind) {
    case "node":
      return hit.nodeId;
    case "handle":
    case "gizmo":
      return hit.nodeId ?? null;
    case "empty":
    case "scene":
      return null;
    default: {
      const exhaustive: never = hit;
      return exhaustive;
    }
  }
}

export function getSelectionFromHit(
  hit: CanvasHitResult,
  current: SelectionState,
  mode: CanvasSelectionMode
): SelectionState | null {
  const nodeId = getHitNodeId(hit);

  if (!nodeId) {
    if ((hit.kind === "empty" || hit.kind === "scene") && mode === "replace") {
      return {
        hoveredId: current.hoveredId,
        ids: [],
        primaryId: null
      };
    }

    return null;
  }

  if (mode === "replace") {
    return {
      hoveredId: current.hoveredId,
      ids: [nodeId],
      primaryId: nodeId
    };
  }

  if (mode === "add") {
    return {
      hoveredId: current.hoveredId,
      ids: current.ids.includes(nodeId) ? [...current.ids] : [...current.ids, nodeId],
      primaryId: nodeId
    };
  }

  if (!current.ids.includes(nodeId)) {
    return {
      hoveredId: current.hoveredId,
      ids: [...current.ids, nodeId],
      primaryId: nodeId
    };
  }

  const ids = current.ids.filter((id) => id !== nodeId);
  return {
    hoveredId: current.hoveredId,
    ids,
    primaryId:
      current.primaryId === nodeId ? (ids[ids.length - 1] ?? null) : current.primaryId
  };
}

export function selectionsEqual(left: SelectionState, right: SelectionState): boolean {
  return (
    left.primaryId === right.primaryId &&
    left.hoveredId === right.hoveredId &&
    left.ids.length === right.ids.length &&
    left.ids.every((id, index) => id === right.ids[index])
  );
}

export function readonlyStringsEqual(
  left: readonly string[] | undefined,
  right: readonly string[] | undefined
): boolean {
  return (
    left === right ||
    (left !== undefined &&
      right !== undefined &&
      left.length === right.length &&
      left.every((value, index) => value === right[index]))
  );
}

export function parseDocumentEffect(
  input: unknown,
  code: "invalid-command" | "invalid-document" | "invalid-handler-result",
  commandType?: string
): EditorEffect<CanvasDocument> {
  return Effect.try({
    try: () => freezeValue(defineDocument(input as Parameters<typeof defineDocument>[0])),
    catch: (cause) =>
      new CanvasEditorError(code, "Canvas document validation failed.", {
        cause,
        ...(commandType === undefined ? {} : { commandType })
      })
  });
}

export function parseSelectionForDocumentEffect(
  input: unknown,
  document: CanvasDocument,
  commandType?: string,
  code: "invalid-handler-result" | "invalid-selection" = "invalid-selection"
): EditorEffect<SelectionState> {
  return Effect.gen(function* () {
    const selection = yield* Effect.try({
      try: () => SelectionStateSchema.parse(input),
      catch: (cause) =>
        new CanvasEditorError(code, "Selection validation failed.", {
          cause,
          ...(commandType === undefined ? {} : { commandType })
        })
    });
    const nodeIds = new Set(document.scene.nodes.map((node) => node.id));

    if (new Set(selection.ids).size !== selection.ids.length) {
      return yield* Effect.fail(
        new CanvasEditorError(code, "Selection ids must be unique.", {
          ...(commandType === undefined ? {} : { commandType })
        })
      );
    }

    const referencedIds = uniqueIds([
      ...selection.ids,
      ...(selection.hoveredId ? [selection.hoveredId] : [])
    ]);

    for (const id of referencedIds) {
      if (!nodeIds.has(id)) {
        return yield* Effect.fail(
          new CanvasEditorError(code, `Selection references missing node: ${id}`, {
            ...(commandType === undefined ? {} : { commandType })
          })
        );
      }
    }

    for (const id of selection.ids) {
      const state = resolveEffectiveNodeState(document, id);

      if (state.locked) {
        return yield* Effect.fail(
          new CanvasEditorError(
            "locked-target",
            `Selection includes an effectively locked node: ${id}`,
            { ...(commandType === undefined ? {} : { commandType }) }
          )
        );
      }

      if (!state.visible) {
        return yield* Effect.fail(
          new CanvasEditorError(code, `Selection includes a hidden node: ${id}`, {
            ...(commandType === undefined ? {} : { commandType })
          })
        );
      }
    }

    if (selection.hoveredId) {
      const hoveredState = resolveEffectiveNodeState(
        document,
        selection.hoveredId
      );

      if (!hoveredState.visible) {
        return yield* Effect.fail(
          new CanvasEditorError(
            code,
            `Selection hover references a hidden node: ${selection.hoveredId}`,
            { ...(commandType === undefined ? {} : { commandType }) }
          )
        );
      }
    }

    return freezeValue(selection);
  });
}