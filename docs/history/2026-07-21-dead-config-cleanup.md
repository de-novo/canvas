# Dead Render-Config Cleanup

Date: 2026-07-21.

## Context

A comprehensive review flagged that `RenderOptionsSchema` shipped three
public config fields that no renderer consumed: `lod`, `chunkSize`, and `dpr`
(3D used `devicePixelRatio` instead). For a project whose core value promise
is strict, no-fallback contracts, shipping dead public config is
self-contradictory and becomes a breaking change to remove after 1.0. This
entry removes the two unused fields before the 1.0 contract locks.

## Scope

Remove `lod` and `chunkSize` from `RenderOptionsSchema` and every caller.
`dpr` is retained (it is a real, documented option) — wiring it uniformly
into both renderers is tracked as follow-up, not part of this cleanup.

## Changes

- `packages/core/src/index.ts`: dropped `lod` and `chunkSize` from
  `RenderOptionsSchema` and the scene default object. `RenderOptions` now has
  only `loop`, `dpr`, `frustumCulling`, `batch`.
- `apps/playground/app/canvas-demo.tsx`: removed `lod`/`chunkSize` from the
  two scene fixtures.
- `apps/vanilla/src/main.ts`: removed `lod`/`chunkSize` from the three scene
  fixtures.

## Result

- The public render-config surface is now exactly what the renderers
  implement: `loop`, `dpr`, `frustumCulling`, `batch`. No dead fields.
- `strict()` schema validation will reject any document that still carries
  `lod`/`chunkSize`, surfacing the migration to consumers explicitly.

## Verification

Passed on 2026-07-21:

- `pnpm typecheck` (all tasks — the removal surfaced three stale references in
  the vanilla example, all fixed).
- `pnpm build`.
- `pnpm verify:public-api`, `verify:document-schema`, `verify:editor-core`.

## Next

- Wire `dpr` uniformly into both the 2D and 3D renderers (currently 3D uses
  `devicePixelRatio`), or document the `dpr` vs `devicePixelRatio` split
  explicitly.
- Lock the render-config contract before 1.0.
