import {
  CanvasCommandSchema,
  CanvasNodeTransformKindSchema,
  type CanvasCommand,
  type CanvasPluginCommandDescriptor,
  type CanvasPluginCommandFor,
  type CanvasPluginCommandHandler,
  type CanvasPluginCommandType,
  type CanvasToolDefinition
} from "@de-novo/canvas-core";
import { Cause, Effect, Either, Option } from "effect";
import { CanvasEditorError, PluginPayloadValidationFailure } from "./errors.js";
import type {
  EditorEffect,
  RegisteredPluginCommand
} from "./internal-types.js";
import { freezeValue, isPlainObject } from "./utils.js";

export async function runEditorEffect<Value>(
  effect: EditorEffect<Value>
): Promise<Value> {
  const guarded = Effect.catchAllCause(effect, (cause) => {
    const failure = Cause.failureOption(cause);

    if (Option.isSome(failure) && failure.value instanceof CanvasEditorError) {
      return Effect.fail(failure.value);
    }

    return Effect.fail(
      new CanvasEditorError("internal-error", "Editor operation failed.", {
        cause: new Error(Cause.pretty(cause))
      })
    );
  });
  const result = await Effect.runPromise(Effect.either(guarded));

  if (Either.isLeft(result)) {
    throw result.left;
  }

  return result.right;
}

export function cloneCommand(command: CanvasCommand): CanvasCommand {
  if (
    isPlainObject(command) &&
    command.type === "node.update" &&
    isPlainObject(command.patch) &&
    ("id" in command.patch || "type" in command.patch)
  ) {
    throw new CanvasEditorError(
      "immutable-node-field",
      "node.update cannot change node id or type.",
      { commandType: command.type }
    );
  }

  let normalized: CanvasCommand;

  try {
    normalized = CanvasCommandSchema.parse(command);
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-command",
      "Command schema validation failed.",
      { cause }
    );
  }

  const serialized = JSON.stringify(normalized);

  if (serialized === undefined) {
    throw new CanvasEditorError(
      "invalid-command",
      "Command must be JSON-serializable."
    );
  }

  try {
    return freezeValue(CanvasCommandSchema.parse(JSON.parse(serialized)));
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-command",
      "Serialized command schema validation failed.",
      { cause }
    );
  }
}

export function assertPluginCommandRegistration<
  TType extends CanvasPluginCommandType,
  TPayload
>(
  descriptor: CanvasPluginCommandDescriptor<TType, TPayload>,
  handler: unknown
): void {
  const { type } = descriptor;

  if (!type.startsWith("plugin.") || type.length === "plugin.".length) {
    throw new CanvasEditorError(
      "unsupported-command",
      "Custom command handlers must use a non-empty plugin.* command type.",
      { commandType: type }
    );
  }

  if (typeof descriptor.parsePayload !== "function") {
    throw new CanvasEditorError(
      "invalid-command",
      `Plugin command payload parser must be a function: ${type}`,
      { commandType: type }
    );
  }

  if (typeof handler !== "function") {
    throw new CanvasEditorError(
      "invalid-command",
      `Command handler must be a function: ${type}`,
      { commandType: type }
    );
  }
}

export function createRegisteredPluginCommand<
  TType extends CanvasPluginCommandType,
  TPayload
>(
  descriptor: CanvasPluginCommandDescriptor<TType, TPayload>,
  handler: CanvasPluginCommandHandler<TType, TPayload>
): RegisteredPluginCommand {
  return {
    execute(command, context) {
      let payload: TPayload;

      try {
        payload = descriptor.parsePayload(command.payload);
      } catch (cause) {
        throw new PluginPayloadValidationFailure(descriptor.type, cause);
      }

      const typedCommand: CanvasPluginCommandFor<TType, TPayload> = {
        ...command,
        payload,
        type: descriptor.type
      };
      return handler(typedCommand, context);
    }
  };
}

export function assertToolDefinition(definition: CanvasToolDefinition) {
  if (
    typeof definition.id !== "string" ||
    definition.id.length === 0 ||
    typeof definition.label !== "string" ||
    definition.label.length === 0
  ) {
    throw new CanvasEditorError(
      "invalid-command",
      "Tool id and label must be non-empty strings."
    );
  }

  if (definition.onInput !== undefined && typeof definition.onInput !== "function") {
    throw new CanvasEditorError(
      "invalid-command",
      `Tool input handler must be a function: ${definition.id}`
    );
  }

  if (
    definition.onDeactivate !== undefined &&
    typeof definition.onDeactivate !== "function"
  ) {
    throw new CanvasEditorError(
      "invalid-command",
      `Tool deactivation handler must be a function: ${definition.id}`
    );
  }

  if (
    definition.navigation !== undefined &&
    definition.navigation !== "allow" &&
    definition.navigation !== "block" &&
    definition.navigation !== "allow-pan"
  ) {
    throw new CanvasEditorError(
      "invalid-command",
      `Tool navigation policy must be allow, block, or allow-pan: ${definition.id}`
    );
  }

  if (
    definition.transform !== undefined &&
    !CanvasNodeTransformKindSchema.safeParse(definition.transform).success
  ) {
    throw new CanvasEditorError(
      "invalid-command",
      `Tool transform kind must be translate, rotate, or scale: ${definition.id}`
    );
  }
}