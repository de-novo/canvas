# 2D alignNodes & distributeNodes Named Operations and snap guide overlay rendering

Issue: [#16](https://github.com/de-novo/canvas/issues/16).

## Summary

- Added `alignNodes` (`left` | `center` | `right` | `top` | `middle` | `bottom`)
  and `distributeNodes` (`horizontal` | `vertical`) 2D multi-node layout Named
  Operations to `@denovo/canvas-editor`, registered them in
  `NAMED_OPERATION_NAMES` / `listNamedOperations()`, and re-exported them from
  `@denovo/canvas/2d` and `@denovo/canvas`.
- Both operations compile into canonical `node.update` commands (atomic
  single-step undo/redo via `editor.apply([...])`), return `{ changed: false,
  commands: [] }` when already aligned/distributed or given `< 2` / `< 3`
  nodes, and fail closed with typed `CanvasEditorError` (`locked-target`,
  `node-not-found`, `invalid-command`).
- Added ephemeral visual snap guide rendering via
  `runtime.current.setSnapGuides(guides)` (`packages/web/src/2d.ts` +
  `renderCanvas2DSnapGuides` in `packages/web/src/2d/render.ts`) using
  rAF-coalesced repainting with zero document mutation.
- Added runtime verification in `scripts/verify-editor-core.mjs` and
  `scripts/verify-2d-performance.mjs`, plus positive and `@ts-expect-error`
  negative consumer fixtures in `scripts/verify-public-api.mjs`.

## Verification

- `pnpm build`
- `pnpm typecheck`
- `pnpm verify:public-api`
- `pnpm verify:editor-core`
- `pnpm verify:2d-performance`
- `pnpm verify:pack-smoke`
- `pnpm verify:docs`
- `git diff --check`

## Compatibility And Migration

- Purely additive Named Operations (`alignNodes`, `distributeNodes`) and
  runtime overlay method (`setSnapGuides`); no breaking changes.
