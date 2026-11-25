# 2026-08-25 Named operations `setNodeLayer`

## Date

2026-08-25

## Scope

Named authoring slice 15. Document-only helper that compiles to one
`node.update` of `layerId`. No new playground.

## Changes

- `@de-novo/canvas-editor` and `@de-novo/canvas` export `setNodeLayer`
  and `SetNodeLayerInput`.
- Extra fields fail at the helper.
- An effectively locked node or a locked target layer is
  `locked-target`, matching `node.update`.
- Already on that layer does not grow history.
- `parentId` stays off this helper.

## Verification

Ran 2026-08-25:

- `pnpm typecheck` — 36/36
- `pnpm build` — 25/25
- `pnpm verify:public-api` — `public-api-suite` ok, including
  `SetNodeLayerInput` and `@ts-expect-error` on extra fields and a
  non-string `layerId`
- `pnpm verify:editor-core` — ok, including move, already-in-state,
  locked node, locked target layer, extra fields, missing node, and
  missing layer
- `pnpm verify:named-operations` — 3/3, including document-only move
  of `rect-1` onto `notes`
- `pnpm verify:docs` — 150 Markdown files, 485/485 local targets

## Residual risk

- Group membership is not moved by this helper.
- Selection stays on `selection.set`.

## Next action

Do not invent another official kind without a sayable property set.
Do not wrap ThreeUI. Do not add a playground for this helper.
