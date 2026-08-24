import {
  CanvasCommandSchema,
  CanvasDocumentSchema,
  CanvasLayerIdSchema,
  type CanvasCommand,
  type CanvasDocument,
  type CanvasLayerId
} from "@denovo/canvas-core";
import { CanvasEditorError } from "../errors.js";
import { freezeValue, isPlainObject } from "../utils.js";

export type NamedOperationResult = {
  readonly document: CanvasDocument;
  readonly changed: boolean;
  readonly commands: readonly CanvasCommand[];
};

export type NamedOperation = (
  document: CanvasDocument
) => NamedOperationResult;

export type SetLayerVisibleInput = {
  readonly layerId: CanvasLayerId;
  readonly visible: boolean;
};

const SET_LAYER_VISIBLE_KEYS = new Set(["layerId", "visible"]);

export function setLayerVisible(input: SetLayerVisibleInput): NamedOperation {
  const parsed = parseSetLayerVisibleInput(input);

  return (document) => {
    const layer = document.scene.layers.find(
      (candidate) => candidate.id === parsed.layerId
    );

    if (!layer) {
      throw new CanvasEditorError(
        "layer-not-found",
        `Layer was not found: ${parsed.layerId}`
      );
    }

    if (layer.locked) {
      throw new CanvasEditorError(
        "locked-target",
        `Layer is locked: ${layer.id}`
      );
    }

    if (layer.visible === parsed.visible) {
      return {
        changed: false,
        commands: [],
        document
      };
    }

    const command = parseLayerUpdateCommand(parsed.layerId, parsed.visible);
    const nextLayers = document.scene.layers.map((candidate) =>
      candidate.id === parsed.layerId
        ? { ...candidate, visible: parsed.visible }
        : candidate
    );

    return {
      changed: true,
      commands: [command],
      document: parseNamedOperationDocument({
        ...document,
        scene: {
          ...document.scene,
          layers: nextLayers
        }
      })
    };
  };
}

export function applyNamedOperations(
  document: CanvasDocument,
  operations: readonly NamedOperation[]
): NamedOperationResult {
  const list = parseNamedOperationList(operations, "applyNamedOperations");
  let current = document;
  const commands: CanvasCommand[] = [];

  for (const operation of list) {
    const step = operation(current);
    current = step.document;
    commands.push(...step.commands);
  }

  return {
    changed: commands.length > 0,
    commands,
    document: current
  };
}

export function parseNamedOperationList(
  operations: readonly NamedOperation[],
  caller: "apply" | "applyNamedOperations"
): readonly NamedOperation[] {
  if (!Array.isArray(operations)) {
    throw new CanvasEditorError(
      "invalid-command",
      caller === "apply"
        ? "apply expects a list. Wrap helpers: editor.apply([setLayerVisible(...)])"
        : "applyNamedOperations expects a list as the second argument. Wrap helpers: applyNamedOperations(document, [setLayerVisible(...)])"
    );
  }

  for (const operation of operations) {
    if (typeof operation !== "function") {
      throw new CanvasEditorError(
        "invalid-command",
        `${caller} items must be named operations: (document) => result.`
      );
    }
  }

  return operations;
}

function parseSetLayerVisibleInput(
  input: SetLayerVisibleInput
): SetLayerVisibleInput {
  if (!isPlainObject(input)) {
    throw new CanvasEditorError(
      "invalid-command",
      "setLayerVisible input must be an object."
    );
  }

  for (const key of Object.keys(input)) {
    if (!SET_LAYER_VISIBLE_KEYS.has(key)) {
      throw new CanvasEditorError(
        "invalid-command",
        `setLayerVisible does not accept field: ${key}`
      );
    }
  }

  if (!("layerId" in input) || !("visible" in input)) {
    throw new CanvasEditorError(
      "invalid-command",
      "setLayerVisible requires layerId and visible."
    );
  }

  if (typeof input.visible !== "boolean") {
    throw new CanvasEditorError(
      "invalid-command",
      "setLayerVisible visible must be a boolean."
    );
  }

  let layerId: CanvasLayerId;

  try {
    layerId = CanvasLayerIdSchema.parse(input.layerId);
  } catch (cause) {
    throw new CanvasEditorError("invalid-id", "Layer ID must be non-empty.", {
      cause
    });
  }

  return { layerId, visible: input.visible };
}

function parseLayerUpdateCommand(
  layerId: CanvasLayerId,
  visible: boolean
): CanvasCommand {
  try {
    return freezeValue(
      CanvasCommandSchema.parse({
        layerId,
        patch: { visible },
        type: "layer.update"
      })
    );
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-command",
      "setLayerVisible could not compile to layer.update.",
      { cause, commandType: "layer.update" }
    );
  }
}

function parseNamedOperationDocument(document: CanvasDocument): CanvasDocument {
  try {
    return freezeValue(CanvasDocumentSchema.parse(document));
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-document",
      "Named operation document validation failed.",
      { cause }
    );
  }
}
