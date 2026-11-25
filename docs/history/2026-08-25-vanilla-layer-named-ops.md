# 2026-08-25 Vanilla layer toggles use named operations

## Date

2026-08-25

## Scope

Plant the leftover vanilla host buttons on the same helpers BIM and
the catalogs already call. No new playground and no new named
operation.

## Changes

- Vanilla Toggle Layer Visibility calls `setLayerVisible`.
- Vanilla Toggle Layer Lock calls `setLayerLocked`.
- `verify:named-operations` clicks both after Stack +Y and reads
  `window.__vanillaNamedOps` plus `data-denovo-authoring-*`.

## Verification

Ran 2026-08-25:

- `pnpm --filter @de-novo/canvas-vanilla-example typecheck` — ok
- `pnpm verify:named-operations` — 3/3, including vanilla hide then
  lock after Stack +Y
- `pnpm verify:docs` — 152 Markdown files, 489/489 local targets

## Residual risk

- Edit Last, group, and ungroup stay on existing command helpers.
  Those changes are not sayable one-field wraps.

## Next action

Do not add host buttons for leftover knobs. Wait for a host that is
blocked.
