# 2026-08-24 Named operations slice 1 (`setLayerVisible`)

## Date

2026-08-24

## Scope

First shipped named authoring helper. Humans and agents share
`setLayerVisible` + `applyNamedOperations` / `editor.apply`. No
`stackBox`, no `listNodes`, no fluent editor chain.

## Changes

- `@de-novo/canvas-editor` exports `setLayerVisible`,
  `applyNamedOperations`, and `CanvasEditor.apply`.
- `@de-novo/canvas` re-exports the helpers and types
  (`NamedOperation`, `NamedOperationResult`, `SetLayerVisibleInput`).
- Compiles to one `layer.update` when the layer exists and `visible`
  differs. Unknown `layerId` is `layer-not-found`. Extra fields and a
  non-boolean `visible` fail at the helper. Already-in-state returns
  `{ changed: false, commands: [] }` and does not grow history.
- A non-list apply fails with a message that shows the list wrap.
- Playground BIM Hide / Show Level 2 call `editor.apply([setLayerVisible…])`
  for every layer named `Level 2` (including federated `model / Level 2`).

## Verification

- `pnpm typecheck`
- `pnpm build`
- `pnpm verify:public-api`
- `pnpm verify:editor-core`
- `pnpm verify:named-operations`

## Residual risk

- Callers still look up `layerId` themselves. `listNodes` is slice 3.
- `stackBox` is not implemented. Do not start it until this slice stays
  green.

## Next action

Done for slice 1. Slice 2 evidence is in
[2026-08-24 named operations stackBox](./2026-08-24-named-operations-stack-box.md).
