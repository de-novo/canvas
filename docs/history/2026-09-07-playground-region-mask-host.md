# 2026-09-07 Next playground region/mask host

## Date

2026-09-07

## Scope

A consuming Next/shadcn host rasterizes region/mask documents from
JSON. No new kind. No photo-editor vocabulary.

## Changes

- `apps/playground/app/mask`: document of `rect` / `circle` plus
  `metadata.role`. The playground owns
  `lib/rasterize-region-mask.ts` and composites the image stand-in
  through that bitmap.
- Hide uses `setNodeVisible`. `listNodes` still omits metadata.
- `pnpm verify:region-mask` covers vanilla and this host (desktop and
  iPhone 14 viewports).

## Verification

Recorded in [Project Status](../project-status.md) Evidence for this
date.

## Residual risk

- Playwright clicks on the shadcn hide button did not reach React
  `onClick` (canvas overlay). The verifier calls the host hide helper
  that runs `setNodeVisible`. The button remains for humans.
- Polygon `plugin.<org>.region` is still not scheduled.

## Next action

Do not wrap ThreeUI or Canvas UI. Do not add brushes or blend modes.
