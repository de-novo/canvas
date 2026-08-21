# M3 suite re-run and authoring ghost material isolation

**Date:** 2026-08-21
**Status:** verified (vanilla browser suite + performance re-measure)

## Context

The 2026-08-17 persistence and geometry slices landed without re-running
`verify:browser-rendering` or `verify:performance`. Those suites were the
remaining M8 residual and the stale M4 evidence dates.

## Changes

- 3D authoring previews clone cached `MeshStandardMaterial` instances
  before setting ghost opacity. Mutating the shared cache made the
  committed box match the 0.62 ghost, so stacked-box preview cleanup
  compared identical pixel hashes.

## Verification

Ran after the material fix on 2026-08-21:

- `pnpm typecheck` — 30/30
- `pnpm build` — 20/20
- `pnpm verify:public-api`
- `pnpm verify:document-schema` — 39 named checks
- `pnpm verify:editor-core`
- `pnpm verify:server` — 30 assertions
- `pnpm verify:browser-rendering` — desktop mouse and iPhone 14 touch,
  including 2D/3D authoring and four stacked surface-placement boxes
- `pnpm verify:performance` — 100 / 1k / 10k boxes, `drawCalls=1`,
  p50 8.80 / 50.00 / 116.60 ms

`verify:hit-testing` and `verify:diagram-rendering` were not re-run.

## Residual risk

- M4–M8 remain landed-but-unverified as milestones. This pass re-ran the
  vanilla M3 suite and a performance baseline, not M4–M8 acceptance.
- 10k-box p50 is slower than the 2026-07-17 batched 91.70 ms reading.
  Headless Chromium variance is expected; draw-call count is unchanged.
- Framework adapters still mount `@denovo/canvas-web`, not the facade.

## Next action

Mount framework adapters on the facade, or run the remaining M4–M8
acceptance suites (`verify:hit-testing`, `verify:diagram-rendering`,
adapter/BIM browser checks).
