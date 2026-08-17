import { Effect } from "effect";
import type { z } from "zod";
import {
  CanvasDocumentSchema,
  CanvasSceneSchema,
  SelectionStateSchema,
  type CanvasDocument,
  type CanvasScene,
  type SelectionState
} from "./index";

export type CanvasCoreValidationTarget = "document" | "scene" | "selection";

export class CanvasCoreValidationError extends Error {
  readonly cause: unknown;
  readonly target: CanvasCoreValidationTarget;

  constructor(target: CanvasCoreValidationTarget, cause: unknown) {
    super(`${target} validation failed.`);
    this.name = "CanvasCoreValidationError";
    this.cause = cause;
    this.target = target;
  }
}

export type CanvasCoreEffect<T> = Effect.Effect<T, CanvasCoreValidationError>;

export function parseSceneEffect(input: unknown): CanvasCoreEffect<CanvasScene> {
  return parseWithSchemaEffect("scene", CanvasSceneSchema, input);
}

export function parseDocumentEffect(
  input: unknown
): CanvasCoreEffect<CanvasDocument> {
  return parseWithSchemaEffect("document", CanvasDocumentSchema, input);
}

export function parseSelectionEffect(
  input: unknown
): CanvasCoreEffect<SelectionState> {
  return parseWithSchemaEffect("selection", SelectionStateSchema, input);
}

function parseWithSchemaEffect<TSchema extends z.ZodType>(
  target: CanvasCoreValidationTarget,
  schema: TSchema,
  input: unknown
): CanvasCoreEffect<z.output<TSchema>> {
  return Effect.try({
    try: () => schema.parse(input),
    catch: (cause) => new CanvasCoreValidationError(target, cause)
  });
}
