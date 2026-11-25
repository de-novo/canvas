import type { CanvasPluginCommandType } from "@de-novo/canvas-core";

export type CanvasEditorErrorCode =
  | "command-handler-failed"
  | "immutable-node-field"
  | "internal-error"
  | "invalid-command"
  | "invalid-document"
  | "invalid-handler-result"
  | "invalid-hit-result"
  | "invalid-id"
  | "invalid-selection"
  | "invalid-tool-input"
  | "layer-already-exists"
  | "layer-not-found"
  | "locked-target"
  | "mode-mismatch"
  | "node-already-exists"
  | "node-not-found"
  | "subscriber-failed"
  | "tool-capability-missing"
  | "tool-handler-failed"
  | "tool-not-found"
  | "unsupported-command";

export class CanvasEditorError extends Error {
  readonly code: CanvasEditorErrorCode;
  readonly commandType: string | undefined;
  override readonly cause: unknown;

  constructor(
    code: CanvasEditorErrorCode,
    message: string,
    options: {
      cause?: unknown;
      commandType?: string;
    } = {}
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "CanvasEditorError";
    this.code = code;
    this.commandType = options.commandType;
    this.cause = options.cause;
  }
}

export class PluginPayloadValidationFailure extends Error {
  readonly cause: unknown;

  constructor(type: CanvasPluginCommandType, cause: unknown) {
    super(`Plugin command payload validation failed: ${type}`, { cause });
    this.name = "PluginPayloadValidationFailure";
    this.cause = cause;
  }
}