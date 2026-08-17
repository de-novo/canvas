import type { CanvasCommand, CanvasDocument } from "@denovo/canvas-core";
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
