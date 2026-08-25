# 2026-08-25 Named operations `reorderLayer`

## Date

2026-08-25

## Scope

Named authoring slice 12. Document-only helper that compiles to one
`layer.reorder`. No new playground. No official 2D kind.

## Changes

- `@denovo/canvas-editor` and `@denovo/canvas` export `reorderLayer`
  and `ReorderLayerInput`.
- Input is `{ layerId, index }`. `index` is required.
- Already at that index returns `{ changed: false, commands: [] }`.
- Unknown `layerId` is `layer-not-found`. Extra fields and a
  non-integer or out-of-range index fail.
- Vanilla Reorder Layer uses the helper instead of a raw
  `layer.reorder`.

## Verification

Ran 2026-08-25:

- `pnpm typecheck` — 36/36
- `pnpm build` — 25/25
- `pnpm verify:public-api` — `public-api-suite` ok, including
  `ReorderLayerInput` and `@ts-expect-error` on extra fields, a
  missing `index`, and a string `index`
- `pnpm verify:editor-core` — ok, including move to index `0`,
  already-in-state, out-of-range index, extra fields, and missing id
- `pnpm verify:named-operations` — 3/3, including document-only
  move of `extra` to index `0`
- `pnpm verify:docs` — 147 Markdown files, 478/478 local targets

## Residual risk

- Layer lock does not block reorder. That matches `layer.reorder`.
- No official 2D kind. That remains a missing drawer.

## Next action

An official 2D kind only when there is a sayable property set. Layer
commands are now wrapped. Do not wrap ThreeUI. Do not add a
playground for this helper.
