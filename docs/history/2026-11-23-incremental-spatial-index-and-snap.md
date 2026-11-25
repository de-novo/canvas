# Incremental 2D spatial-index updates and O(visible) smart snap guides

Issue: [#14](https://github.com/de-novo/canvas/issues/14).

## Summary

- Added incremental O(k) `syncIncremental` / `syncCanvas2DSpatialIndex` in
  `packages/web/src/2d/spatial-index.ts`, tracking per-entry cell memberships
  and value-comparing 2D nodes so single-node or small-batch live edits on
  10k-node scenes re-index only the changed nodes (and dependent edges/groups)
  instead of rebuilding all 10k entries.
- Added `packages/web/src/2d/snap.ts` providing pure `computeCanvas2DSnapGuides`
  and spatial-index-backed `computeCanvas2DSnapGuidesFromIndex` (exposed as
  `runtime.current.computeSnapGuides(targetBounds, options?)` and re-exported
  from `@de-novo/canvas-web/2d`, `@de-novo/canvas-web`, `@de-novo/canvas/2d`, and
  `@de-novo/canvas`), plus `runtime.current.getSpatialIndexStats()`.
- Added deterministic 10k incremental sync and O(visible) snap gates to
  `scripts/verify-2d-performance.mjs` and positive/negative consumer fixtures
  to `scripts/verify-public-api.mjs`.

## Verification

- `pnpm build`
- `pnpm typecheck`
- `pnpm verify:public-api`
- `pnpm verify:2d-performance`
- `pnpm verify:hit-testing`
- `pnpm verify:pack-smoke`
- `pnpm verify:docs`
- `git diff --check`

## Compatibility And Migration

- Purely additive runtime methods (`computeSnapGuides`, `getSpatialIndexStats`)
  and pure helper export (`computeCanvas2DSnapGuides`); no breaking changes.
