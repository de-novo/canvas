# 2026-08-25 Named operations `listLayers`

## Date

2026-08-25

## Scope

Named authoring slice 7. A host button and an agent can read layers
without walking `document.scene.layers` for metadata. No new
playground.

## Changes

- `@de-novo/canvas-editor` and `@de-novo/canvas` export `listLayers`
  and `ListedLayer`.
- `listLayers(document)` returns `{ id, name, visible, locked }` in
  document order. Own flags, not effective node state. No metadata.
- Extra arguments fail. There is no layer filter.

## Verification

Ran 2026-08-25:

- `pnpm typecheck` — 36/36
- `pnpm build` — 25/25
- `pnpm verify:public-api` — `public-api-suite` ok, including
  `ListedLayer` and `@ts-expect-error` on metadata / extra arguments
- `pnpm verify:editor-core` — ok, including document order and hide
  reflected on the layer list
- `pnpm verify:named-operations` — 3/3, including Level 2 visibility
  through `listLayers`
- `pnpm verify:docs` — 140 Markdown files, 461/461 local targets

## Residual risk

- Callers who need metadata still read the document layer. This helper
  is the short list, not a dump.
- No playground control. Proof is editor-core and the existing
  named-operations document check.

## Next action

Add another named operation only when the change is sayable. Do not
wrap ThreeUI. Do not add a playground for this helper.
