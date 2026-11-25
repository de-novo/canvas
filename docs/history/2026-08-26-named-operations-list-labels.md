# 2026-08-26 Named operations `listLabels`

## Date

2026-08-26

## Scope

Named authoring slice 17. Read-only summary of `text` and
`annotation` copy. Completes `setText` so a host or agent can see
what the document says. No new playground.

## Changes

- `@de-novo/canvas-editor` and `@de-novo/canvas` export `listLabels`,
  `ListedLabel`, `ListedLabelType`, and `ListLabelsOptions`.
- Returns `{ id, type, layerId, text }` in document order.
- Optional `layerId` matches `listNodes`. Unknown layer is
  `layer-not-found`. Extra fields fail.
- HTML and geometry stay off this helper.

## Verification

Ran 2026-08-26:

- `pnpm typecheck` — 36/36
- `pnpm build` — 25/25
- `pnpm verify:public-api` — `public-api-suite` ok, including
  `ListedLabel` and `@ts-expect-error` on geometry and extra fields
- `pnpm verify:editor-core` — ok, including text + annotation,
  layer filter, missing layer, and extra fields
- `pnpm verify:named-operations` — 3/3, including `listLabels` after
  `setText` to `Done`
- `pnpm verify:docs` — 153 Markdown files, 491/491 local targets

## Residual risk

- `setText` still writes only `text` nodes. Annotation write is
  `setAnnotationText`.

## Next action

Do not invent another official kind without a sayable property set.
Do not wrap ThreeUI. Do not add a playground for this helper.
