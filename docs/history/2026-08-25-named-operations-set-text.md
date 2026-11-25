# 2026-08-25 Named operations `setText`

## Date

2026-08-25

## Scope

Named authoring slice 16. Document-only helper that compiles to one
`node.update` of `text` on a 2D `text` node. No new playground.

## Changes

- `@de-novo/canvas-editor` and `@de-novo/canvas` export `setText` and
  `SetTextInput`.
- Extra fields and a non-string `text` fail at the helper.
- A non-text node is `invalid-command`.
- An effectively locked node is `locked-target`.
- Already the same text does not grow history.
- Empty string is allowed. Annotation and HTML stay off this helper.

## Verification

Ran 2026-08-25:

- `pnpm typecheck` — 36/36
- `pnpm build` — 25/25
- `pnpm verify:public-api` — `public-api-suite` ok, including
  `SetTextInput` and `@ts-expect-error` on extra fields and a
  non-string `text`
- `pnpm verify:editor-core` — ok, including rename, already-in-state,
  locked text, non-text node, extra fields, and missing id
- `pnpm verify:named-operations` — 3/3, including document-only rename
  of `label` to `Done`
- `pnpm verify:docs` — 151 Markdown files, 487/487 local targets

## Residual risk

- `fontSize` / `align` / `fill` stay on raw `node.update`.
- Annotation `text` is a different kind and is not this helper.

## Next action

Do not invent another official kind without a sayable property set.
Do not wrap ThreeUI. Do not add a playground for this helper.
