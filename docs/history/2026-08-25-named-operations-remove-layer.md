# 2026-08-25 Named operations `removeLayer`

## Date

2026-08-25

## Scope

Named authoring slice 10. Document-only helper that compiles to one
`layer.remove`. No new playground.

## Changes

- `@de-novo/canvas-editor` and `@de-novo/canvas` export `removeLayer`
  and `RemoveLayerInput`.
- Empty layer requires `targetLayerId: null`. Non-empty layer requires
  an explicit other layer; nodes move there.
- Last layer cannot be removed. Self-target fails. Missing source or
  target is `layer-not-found`. Locked source, locked nodes on it, or a
  locked target is `locked-target`. Extra fields fail.

## Verification

Ran 2026-08-25:

- `pnpm typecheck` — 36/36
- `pnpm build` — 25/25
- `pnpm verify:public-api` — `public-api-suite` ok, including
  `RemoveLayerInput` and `@ts-expect-error` on extra fields and a
  missing or illegal `targetLayerId`
- `pnpm verify:editor-core` — ok, including empty-layer drop, node
  remapping, last-layer reject, and locked source/node/target
- `pnpm verify:named-operations` — 3/3, including document-only
  removal of an extra empty layer
- `pnpm verify:docs` — 143 Markdown files, 468/468 local targets

## Residual risk

- Callers still choose the destination layer. There is no implicit
  "move to the previous layer" helper.
- No playground control. Proof is editor-core and the existing
  named-operations document check.

## Next action

Add another named operation only when the change is sayable. Do not
wrap ThreeUI. Do not add a playground for this helper.
