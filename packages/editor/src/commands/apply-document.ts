import {
  CanvasDocumentSchema,
  type CanvasCommand,
  type CanvasDocument,
  type CanvasSaveResult,
  type NodeId
} from "@denovo/canvas-core";
import { applyCommandEffect, createInitialSnapshot } from "./handlers.js";
import { cloneCommand, runEditorEffect } from "../runtime.js";

/**
 * Applies a sequence of validated commands to a document without creating an
 * editor session or history. Storage adapters use this to replay `applyCommands`
 * onto a stored snapshot.
 */
export async function applyCommandsToDocument(
  document: CanvasDocument,
  commands: readonly CanvasCommand[]
): Promise<CanvasDocument> {
  if (commands.length === 0) {
    return document;
  }

  let snapshot = createInitialSnapshot(document, {});
  const timestamp = new Date().toISOString();

  for (const command of commands) {
    const stableCommand = cloneCommand(command);
    const applied = await runEditorEffect(
      applyCommandEffect(stableCommand, snapshot, timestamp, new Map())
    );
    snapshot = applied.snapshot;
  }

  return snapshot.document;
}

/**
 * Stored snapshot plus the adapter-owned revision used for optimistic
 * concurrency. Adapters may keep `revision` beside the document; do not assume
 * `document.revision` is the stored value.
 */
export type CanvasStoredDocument = {
  readonly document: CanvasDocument;
  readonly revision: number;
};

export type ApplyStoredCommandsOptions = {
  readonly baseRevision?: number;
  readonly now?: () => string;
};

/**
 * Applies commands to a stored snapshot with the same OCC and revision rules
 * used by memory, filesystem, and IndexedDB `applyCommands` implementations.
 */
export async function applyCommandsToStoredDocument(
  existing: CanvasStoredDocument | null,
  documentId: NodeId,
  commands: readonly CanvasCommand[],
  options: ApplyStoredCommandsOptions = {}
): Promise<CanvasSaveResult> {
  if (existing === null) {
    return {
      ok: false,
      reason: "unknown",
      message: `Document not found: ${documentId}`
    };
  }

  const baseRevision = options.baseRevision;
  if (baseRevision !== undefined && baseRevision !== existing.revision) {
    return {
      ok: false,
      reason: "conflict",
      serverRevision: existing.revision,
      document: existing.document
    };
  }

  const now = options.now?.() ?? new Date().toISOString();

  try {
    const appliedDocument = await applyCommandsToDocument(
      existing.document,
      commands
    );
    const nextRevision = existing.revision + 1;
    const parsed = CanvasDocumentSchema.parse({
      ...appliedDocument,
      revision: nextRevision,
      updatedAt: now
    });

    return {
      ok: true,
      document: parsed,
      revision: nextRevision
    };
  } catch (cause) {
    return {
      ok: false,
      reason: "validation",
      message:
        cause instanceof Error ? cause.message : "Command application failed."
    };
  }
}
