# Editor Modularization

Date: 2026-07-17.

## Context

The `@de-novo/canvas-editor` package was a single 6,673-line `index.ts` file
containing 142 functions and 67 type definitions. This made the codebase hard
to navigate, difficult to unit test, and created a barrier for open-source
contributors. The goal is to decompose the monolith into cohesive modules
while preserving 100% public API compatibility.

## Scope

Full decomposition of the editor monolith into nineteen focused modules
organized under `packages/editor/src/`, grouped by responsibility: pure
helpers, the type/error foundation, the math/grid layer, the command system,
the authoring subsystem (split per tool), and the editor factory.

## Changes

New modules created under `packages/editor/src/`:

- `utils.ts` — `freezeValue`, `isPlainObject`, `jsonEqual`, `uniqueIds`.
- `errors.ts` — `CanvasEditorError`, `CanvasEditorErrorCode`,
  `PluginPayloadValidationFailure`.
- `internal-types.ts` — `EditorEffect`, `RegisteredPluginCommand`,
  `EditorSnapshot`, `ApplyCommandResult`.
- `math/transform.ts` — 2D/3D transform math: `transformPoint2/3`,
  `compose2D/3DTransforms`, `vectorLength3`, `TRANSFORM_EPSILON`.
- `grid.ts` — `snapPointToGrid`, `validateGridWorkPlaneCompatibility`,
  grid/work-plane parsers, `dotVector3`.
- `node-state.ts` — `getEffectiveNodeState`, `isNodeEffectivelyLocked`,
  `isNodeEffectivelyVisible`, `resolveEffectiveNodeState`.
- `parsers.ts` — Zod-based parser effects: `parseDocumentEffect`,
  `parseSelectionForDocumentEffect`, `parseHitResultEffect`, selection helpers.
- `commands/handlers.ts` — command dispatcher (`applyCommandEffect`) plus the
  eleven command effect handlers (node/layer/selection/transaction/plugin).
- `commands/builders.ts` — `createNodeUpdateCommand`, node-identity helpers,
  and command type aliases.
- `runtime.ts` — `runEditorEffect`, `cloneCommand`, plugin-command
  registration validation, and tool-definition validation.
- `authoring/coordinator.ts` — authoring preview lease lifecycle, capability
  guards, point resolvers, and the WeakMap-based session coordinator.
- `authoring/tool-options.ts` — all authoring tool option types.
- `authoring/tools.ts` — thin re-export hub for the per-tool modules.
- `authoring/tools/shape-2d.ts` — `create2DShapeTool`.
- `authoring/tools/primitive-3d.ts` — `create3DPrimitiveTool`.
- `authoring/tools/surface-placement.ts` — `create3DSurfacePlacementTool`
  plus surface-placement helpers.
- `authoring/tools/distance-measurement.ts` — `createDistanceMeasurementTool`.
- `authoring/tools/annotation.ts` — `createAnnotationTool`.
- `editor.ts` — `createEditor`, `connectEditorToRuntime`, `toPublicHistoryEntry`,
  and the editor public state types.

`index.ts` is now a thin public-API barrel that re-exports the modules.
Public exports remain identical; no consumer-facing type or function changed.

## Result

- `index.ts`: 6,673 → 1,087 lines (**83.7% reduction**, 5,586 lines extracted).
- Nineteen cohesive modules; the largest single tool module is 663 lines
  (`surface-placement.ts`) and the largest core module is 1,285 lines
  (`commands/handlers.ts`).
- Zero public API changes.

## Verification

All baselines pass on 2026-07-17:

- `pnpm typecheck` (all tasks).
- `pnpm --filter @de-novo/canvas-editor build`.
- `pnpm verify:public-api`.
- `pnpm verify:editor-core`.
- `pnpm verify:document-schema`.
- `pnpm verify:hit-testing`.

## Next

- Clean up unused re-imports flagged by the linter across modules.
- Consider splitting `commands/handlers.ts` (1,285 lines) per command type.
