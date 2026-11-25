/**
 * Serializes `CanvasCommand` values into `DocumentPatch` (JSON-Patch-style)
 * operation arrays, and composes `DocumentPatchRecord` entries for the
 * storage audit log.
 *
 * The patch representation is a *description* of what a command does against
 * the document shape (`scene.nodes`, `scene.layers`, `selection`), not a diff
 * of two full document snapshots. This keeps the serialized form stable
 * across unrelated document state and lets a server (or offline-replay layer)
 * reason about rejected patches via `inversePatch`.
 *
 * @module @de-novo/canvas-core
 */

import {
  type CanvasCommand,
  type DocumentPatch,
  type DocumentPatchOp,
  type DocumentPatchRecord,
  type JsonValue,
  type NodeId
} from "@de-novo/canvas-core";

/**
 * Path segments used when describing where a command touches the document.
 * Kept as string literals so the serialized patch is readable and stable.
 */
const PATH_NODES = ["scene", "nodes"] as const;
const PATH_LAYERS = ["scene", "layers"] as const;
const PATH_SELECTION = ["selection"] as const;

/**
 * Narrows a command payload value to the `JsonValue` slot of a patch op.
 * Commands are structurally JSON-compatible (they round-trip through the
 * document schema), so this cast is safe at runtime.
 */
function asPatchValue<T>(value: T): DocumentPatchOp["value"] {
  return value as unknown as DocumentPatchOp["value"];
}

/**
 * Serializes a single `CanvasCommand` into a `DocumentPatch`.
 *
 * Unknown / plugin command types serialize to a single `replace` op carrying
 * the raw command under a `command` path, so the audit log still records *that*
 * a command ran even when we cannot describe its structural effect.
 *
 * @param command - The command to serialize.
 * @returns A JSON-Patch-style operation array describing the command.
 */
export function serializeCommandToPatch(command: CanvasCommand): DocumentPatch {
  switch (command.type) {
    case "node.add": {
      const ops: DocumentPatchOp[] = [
        {
          op: "add",
          path: [...PATH_NODES, command.node.id],
          value: asPatchValue(command.node)
        }
      ];

      if (command.index !== undefined) {
        ops.push({
          op: "move",
          from: [...PATH_NODES, command.node.id],
          path: [...PATH_NODES, command.index]
        });
      }

      return ops;
    }

    case "node.remove": {
      return [
        {
          op: "remove",
          path: [...PATH_NODES, command.nodeId]
        }
      ];
    }

    case "node.update": {
      return [
        {
          op: "replace",
          path: [...PATH_NODES, command.nodeId],
          value: asPatchValue(command.patch)
        }
      ];
    }

    case "layer.add": {
      return [
        {
          op: "add",
          path: [...PATH_LAYERS, command.index],
          value: asPatchValue(command.layer)
        }
      ];
    }

    case "layer.remove": {
      return [
        {
          op: "remove",
          path: [...PATH_LAYERS, command.layerId]
        }
      ];
    }

    case "layer.update": {
      return [
        {
          op: "replace",
          path: [...PATH_LAYERS, command.layerId],
          value: asPatchValue(command.patch)
        }
      ];
    }

    case "layer.reorder": {
      return [
        {
          op: "move",
          from: [...PATH_LAYERS, command.layerId],
          path: [...PATH_LAYERS, command.index]
        }
      ];
    }

    case "selection.set": {
      return [
        {
          op: "replace",
          path: [...PATH_SELECTION],
          value: asPatchValue(command.selection)
        }
      ];
    }

    case "transaction": {
      return command.commands.flatMap(serializeCommandToPatch);
    }

    default: {
      // Plugin and any future command types: record a descriptive op so the
      // audit log still captures that *something* happened.
      return [
        {
          op: "replace",
          path: ["command", (command as { type: string }).type],
          value: asPatchValue(command)
        }
      ];
    }
  }
}

/**
 * Serializes a sequence of commands into a single merged `DocumentPatch`.
 *
 * @param commands - The commands to serialize.
 * @returns A JSON-Patch-style operation array describing all commands.
 */
export function serializeCommandsToPatch(
  commands: readonly CanvasCommand[]
): DocumentPatch {
  return commands.flatMap(serializeCommandToPatch);
}

/**
 * Serializes an optional `inverseCommand` into an `inversePatch`.
 *
 * Returns `undefined` when there is no inverse command, which keeps the
 * `DocumentPatchRecord.inversePatch` field absent rather than `undefined`
 * (important under `exactOptionalPropertyTypes`).
 *
 * @param inverseCommand - The optional inverse command to serialize.
 * @returns A JSON-Patch-style operation array, or `undefined`.
 */
export function serializeInverseCommandToPatch(
  inverseCommand: CanvasCommand | undefined
): DocumentPatch | undefined {
  if (!inverseCommand) {
    return undefined;
  }

  return serializeCommandToPatch(inverseCommand);
}

/**
 * Options for building a `DocumentPatchRecord`.
 */
export type BuildPatchRecordOptions = {
  /** Stable unique id for the patch record. */
  id: NodeId;
  /** The document the patch applies to. */
  documentId: NodeId;
  /** Revision the patch was applied against. */
  baseRevision: number;
  /** Revision produced by applying the patch. */
  revision: number;
  /** The commands that produced the patch. */
  commands: readonly CanvasCommand[];
  /** The optional inverse command (for undoing the patch). */
  inverseCommand?: CanvasCommand;
  /** ISO timestamp the patch was recorded. */
  createdAt: string;
  /** Optional actor that produced the patch. */
  actorId?: string;
  /** Optional primary command type for quick filtering. */
  commandType?: string;
};

/**
 * Builds a complete `DocumentPatchRecord` from commands and their inverse.
 *
 * This is the canonical way to construct an audit-log entry that a storage
 * adapter persists alongside (or instead of) a full document snapshot.
 *
 * @param options - The patch record inputs.
 * @returns A fully populated `DocumentPatchRecord`.
 *
 * @example
 * ```ts
 * const record = buildPatchRecord({
 *   id: `patch-${Date.now()}`,
 *   documentId: "doc-1",
 *   baseRevision: 4,
 *   revision: 5,
 *   commands: [addNodeCommand],
 *   inverseCommand: removeNodeCommand,
 *   createdAt: new Date().toISOString()
 * });
 * ```
 */
export function buildPatchRecord(
  options: BuildPatchRecordOptions
): DocumentPatchRecord {
  const patch = serializeCommandsToPatch(options.commands);
  const inversePatch = serializeInverseCommandToPatch(options.inverseCommand);

  const record: DocumentPatchRecord = {
    id: options.id,
    documentId: options.documentId,
    baseRevision: options.baseRevision,
    revision: options.revision,
    patch,
    createdAt: options.createdAt,
    ...(inversePatch === undefined ? {} : { inversePatch }),
    ...(options.actorId === undefined ? {} : { actorId: options.actorId }),
    ...(options.commandType === undefined ? {} : { commandType: options.commandType })
  };

  return record;
}

/**
 * Extracts the node ids a command touches, useful for cache invalidation and
 * conflict detection when serializing patches.
 *
 * @param command - The command to inspect.
 * @returns The node ids the command reads or writes.
 */
export function getCommandAffectedNodeIds(
  command: CanvasCommand
): NodeId[] {
  switch (command.type) {
    case "node.add":
      return [command.node.id];
    case "node.remove":
      return [command.nodeId];
    case "node.update":
      return [command.nodeId];
    case "layer.add":
    case "layer.remove":
    case "layer.update":
    case "layer.reorder":
    case "selection.set":
      return [];
    case "transaction":
      return command.commands.flatMap(getCommandAffectedNodeIds);
    default:
      return [];
  }
}

export type { JsonValue };
