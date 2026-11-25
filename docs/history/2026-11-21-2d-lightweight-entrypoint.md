# Lightweight @de-novo/canvas/2d entrypoint (zero Three.js bundle)

Issue: [#8](https://github.com/de-novo/canvas/issues/8).

## Summary

Added a dedicated 2D-only facade subpath `@de-novo/canvas/2d` backed exclusively
by `@de-novo/canvas-web/2d`, `@de-novo/canvas-core`, and `@de-novo/canvas-editor`
so pure 2D applications never bundle Three.js, `three/webgpu`, `three-mesh-bvh`,
or `@de-novo/canvas-three`:

- `@de-novo/canvas-web/2d` (`packages/web/src/2d.ts`): re-exports 2D-safe
  `connectCanvasSelection`, `connectCanvasToolInput`, `view2d` camera helpers,
  `createSceneChunkLoader`, and `CanvasReadPixelsUnsupportedError` without
  pulling `./3d`.
- `@de-novo/canvas/2d` (`packages/canvas/src/2d.ts`, `packages/canvas/package.json`):
  exposes strict 2D-only `createCanvas`, `connectEditorToCanvas`,
  `connectEditorToRuntime`, `createEditor`, `subscribeCanvasSelector`,
  `shallowEqual`, 2D tools, named operations, core schemas, and 2D camera
  helpers. 3D scenes and WebGL2/Three backends are rejected at both TypeScript
  compile time and runtime.
- Adopted `@de-novo/canvas/2d` in `apps/playground-flow`.

## Before / After Bundle Size (`apps/playground-flow` Vite production build)

| Metric | Before (`@de-novo/canvas`) | After (`@de-novo/canvas/2d`) | Reduction |
| --- | --- | --- | --- |
| `three.webgpu` chunk | 664.84 kB (187.32 kB gzip) | 0.00 kB | -100% |
| Main JS chunk | 1,200.24 kB (325.79 kB gzip) | 361.07 kB (106.43 kB gzip) | -70.0% |
| Total JS | 1,865.08 kB (513.11 kB gzip) | 361.07 kB (106.43 kB gzip) | -80.6% raw / -79.3% gzip |

## Compatibility And Declarations

Purely additive subpath (`@de-novo/canvas/2d`). The default `@de-novo/canvas`
root entrypoint and all existing subpaths remain unchanged; no migration is
required. `packages/canvas/dist/2d.d.ts` contains zero explicit `any` and zero
`three` references. Positive and `@ts-expect-error` negative consumer fixtures
plus static Three.js-free bundle assertions run in `pnpm verify:public-api`.

## Verification

- `pnpm typecheck`: passed (25 packages)
- `pnpm build`: passed (25/25)
- `pnpm verify:public-api`: passed (including `facade-2d-smoke.ts` positive &
  negative fixtures and zero-Three.js checks on `packages/canvas/dist/2d.js`
  and `apps/playground-flow/dist/assets/*.js`)
- `pnpm verify:flow-showcase`: passed (2/2, desktop & iPhone 14 touch)
- `pnpm verify:2d-performance`: passed (4/4 workloads)
- `pnpm verify:docs`: passed

## Unmeasured Scope

- Other 2D-only showcase apps (`apps/playground-network`,
  `apps/playground-diagram`) were left on the root facade for this slice and
  can migrate to `@de-novo/canvas/2d` in follow-up work if desired.
