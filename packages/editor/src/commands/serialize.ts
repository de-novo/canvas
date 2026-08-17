/**
 * Re-export of the command serialization utilities from `@denovo/canvas-core`.
 *
 * The implementation lives in core so that storage adapters in lower-level
 * packages (e.g. `@denovo/canvas-web/indexed-db`) can build `DocumentPatchRecord`
 * audit-log entries without depending on the editor package. The editor
 * re-exports them here for consumers that import from `@denovo/canvas-editor`.
 *
 * @module @denovo/canvas-editor
 */

export {
  buildPatchRecord,
  serializeCommandToPatch,
  serializeCommandsToPatch,
  serializeInverseCommandToPatch,
  getCommandAffectedNodeIds,
  type BuildPatchRecordOptions
} from "@denovo/canvas-core";
