import type { Effect } from "effect";
import type {
  CanvasCommand,
  CanvasDocument,
  CanvasPluginCommandHandler,
  NodeId,
  SelectionState
} from "@denovo/canvas-core";
import type { CanvasEditorError } from "./errors.js";

/**
 * Internal Effect type used across editor command handlers and parsers.
 * Wraps a value or a CanvasEditorError.
 */
export type EditorEffect<Value> = Effect.Effect<Value, CanvasEditorError>;

export type RegisteredPluginCommand = {
  readonly execute: CanvasPluginCommandHandler;
};

export type EditorSnapshot = {
  readonly document: CanvasDocument;
  readonly selection: SelectionState;
};

export type ApplyCommandResult = {
  readonly affectedNodeIds: readonly NodeId[];
  readonly inverse?: CanvasCommand;
  readonly persistent: boolean;
  readonly snapshot: EditorSnapshot;
};