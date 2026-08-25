# 2026-08-25 Named operations `addLayer`

## Date

2026-08-25

## Scope

Named authoring slice 11. Document-only helper that compiles to one
`layer.add`. No new playground. No official 2D kind.

## Changes

- `@denovo/canvas-editor` and `@denovo/canvas` export `addLayer` and
  `AddLayerInput`.
- Input is `{ layerId, name, index? }`. Omit `index` to append.
- Duplicate `layerId` is `layer-already-exists`. Empty name, extra
  fields, and a non-integer or out-of-range index fail.
- Visibility and lock stay on `setLayerVisible` / `setLayerLocked`.
- Vanilla Add Layer uses the helper instead of a raw `layer.add`.

## Verification

Ran 2026-08-25:

- `pnpm typecheck` — 36/36
- `pnpm build` — 25/25
- `pnpm verify:public-api` — `public-api-suite` ok, including
  `AddLayerInput` and `@ts-expect-error` on extra fields, a missing
  `name`, and a string `index`
- `pnpm verify:editor-core` — ok, including append, insert at `0`,
  duplicate id, out-of-range index, empty name, and extra fields
- `pnpm verify:named-operations` — 3/3, including document-only
  insert of `notes` at index `0`
- `pnpm verify:docs` — 146 Markdown files, 476/476 local targets

## Residual risk

- Callers still choose `index`. There is no "insert after layer X"
  helper.
- No official 2D kind. That remains a missing drawer.

## Next action

An official 2D kind only when there is a sayable property set. The
remaining layer command is `layer.reorder`. Do not wrap ThreeUI.
Do not add a playground for this helper.
