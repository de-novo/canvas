# 2026-08-26 Named operations `setAnnotationText`

## Date

2026-08-26

## Scope

Named authoring slice 18. Document-only helper that compiles to one
`node.update` of `text` on a 2D or 3D `annotation` node. Completes
`listLabels` so a host or agent can change callout copy with the same
spoken line. No new playground.

## Changes

- `@denovo/canvas-editor` and `@denovo/canvas` export
  `setAnnotationText` and `SetAnnotationTextInput`.
- Extra fields, a non-string `text`, and an empty string fail at the
  helper. The annotation schema requires `min(1)`.
- A non-annotation node is `invalid-command`.
- An effectively locked node is `locked-target`.
- Already the same text does not grow history.
- `setText` still writes only 2D `text` nodes.

## Verification

Ran 2026-08-26:

- `pnpm typecheck` — pending this run
- `pnpm build` — pending this run
- `pnpm verify:public-api` — pending this run
- `pnpm verify:editor-core` — pending this run
- `pnpm verify:named-operations` — pending this run
- `pnpm verify:docs` — pending this run

## Residual risk

- Annotation `targetId` / `anchor` stay on raw `node.update`.
- HTML copy stays off both `setText` and this helper.

## Next action

Do not invent another official kind without a sayable property set.
Do not wrap ThreeUI. Do not add a playground for this helper.
Do not flip `auto` to WebGPU.
