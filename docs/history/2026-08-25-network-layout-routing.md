# 2026-08-25 Network layout routing

## Date

2026-08-25

## Scope

Relation layout on the service-map catalog hid cards, moved title text,
and left orthogonal arrows pointing at empty space. Isolated to overlay
framing, layout candidates, relation lane alignment, and orthogonal
port resolution.

## Changes

- Relation lanes stack down from the origin instead of centering, so a
  tall layer does not climb over on-canvas titles.
- Orthogonal edges keep named ports only when they still aim at the
  neighbor. Otherwise they pick a facing pair from the current boxes.
- The service-map catalog lays out `html` cards only, then fits the
  camera to cards plus labels. Undo refits the designed view.

## Verification

- `pnpm --filter @de-novo/canvas-web build`: passed
- `pnpm --filter @de-novo/canvas-editor build`: passed
- `pnpm verify:hit-testing`: ok, including stale top/bottom ports
  retargeting to a facing right/left pair
- `pnpm verify:editor-core`: ok
- `pnpm verify:network-showcase`: 2/2, title stays at `[80, 44]` after
  Relation
- `pnpm verify:docs`: 135 Markdown files, 446/446 local targets

## Residual risk

A host that wants a centered relation stack must offset `origin` itself.
Port retargeting is render-time only; persisted `sourcePort` /
`targetPort` values do not change.

## Next action

Keep catalog layout on service cards. Do not send title text through
graph layout.
