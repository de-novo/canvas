# 2026-08-25 Named operations `setLayerLocked`

## Date

2026-08-25

## Scope

Named authoring slice 6. Completes the layer/node visible·locked
square. Host UI and agents lock or unlock a layer with the same
list-apply helper. No new playground.

## Changes

- `@denovo/canvas-editor` and `@denovo/canvas` export
  `setLayerLocked` and `SetLayerLockedInput`.
- Compiles to one `layer.update` of `locked`. Unknown `layerId` is
  `layer-not-found`. Extra fields and a non-boolean flag fail at the
  helper. Already-in-state does not grow history.
- Unlocking the layer itself is allowed. A locked layer still rejects
  `setLayerVisible`.

## Verification

Ran 2026-08-25:

- `pnpm typecheck` — 36/36
- `pnpm build` — 25/25
- `pnpm verify:public-api` — `public-api-suite` ok, including
  `SetLayerLockedInput` and `@ts-expect-error` on extra fields
- `pnpm verify:editor-core` — ok, including lock/unlock, already
  locked, unknown id, and `setLayerVisible` on a locked layer
- `pnpm verify:named-operations` — 3/3, including document lock
- `pnpm verify:docs` — 139 Markdown files, 458/458 local targets

## Residual risk

- `listLayers` landed later the same day. See
  [2026-08-25 named operations listLayers](./2026-08-25-named-operations-list-layers.md).
- No playground control. Proof is editor-core and the existing
  named-operations document check.

## Next action

Add another named operation only when the change is sayable. Do not
wrap ThreeUI. Do not add a playground for this helper.
