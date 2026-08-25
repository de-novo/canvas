# 2026-08-25 Named operations `setLayerName`

## Date

2026-08-25

## Scope

Named authoring slice 14. Document-only helper that compiles to one
`layer.update` of `name`. No new playground.

## Changes

- `@denovo/canvas-editor` and `@denovo/canvas` export `setLayerName`
  and `SetLayerNameInput`.
- Empty name and extra fields fail at the helper.
- A locked layer is `locked-target`, matching `layer.update`.
- Already the same name does not grow history.

## Verification

Ran 2026-08-25:

- `pnpm typecheck` — 36/36
- `pnpm build` — 25/25
- `pnpm verify:public-api` — `public-api-suite` ok, including
  `SetLayerNameInput` and `@ts-expect-error` on extra fields and a
  non-string `name`
- `pnpm verify:editor-core` — ok, including rename, already-in-state,
  locked layer, empty name, and missing id
- `pnpm verify:named-operations` — 3/3, including document-only
  rename of `extra` to `Notes`
- `pnpm verify:docs` — 149 Markdown files, 483/483 local targets

## Residual risk

- Metadata stays off this helper.
- Layer commands that are sayable are now wrapped.

## Next action

Do not invent another official kind without a sayable property set.
Do not wrap ThreeUI. Do not add a playground for this helper.
