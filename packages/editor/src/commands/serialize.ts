/**
 * Re-export of the command serialization utilities from `@de-novo/canvas-core`.
 *
 * The implementation lives in core so that storage adapters in lower-level
 * packages (e.g. `@de-novo/canvas-web/indexed-db`) can build `DocumentPatchRecord`
 * audit-log entries without depending on the editor package. The editor
 * re-exports them here for consumers that import from `@de-novo/canvas-editor`.
 *
 * @module @de-novo/canvas-editor
 */

export {
  buildPatchRecord,
  serializeCommandToPatch,
  serializeCommandsToPatch,
  serializeInverseCommandToPatch,
  getCommandAffectedNodeIds,
  type BuildPatchRecordOptions
} from "@de-novo/canvas-core";
