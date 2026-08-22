# 2026-08-22 Adapter facade mount

## Date

2026-08-22

## Scope

Framework adapters (`@denovo/react-canvas`, `@denovo/vue-canvas`,
`@denovo/svelte-canvas`, `@denovo/solid-canvas`) and the
`@denovo/canvas` facade package.

## Changes

- All four framework view wrappers now mount the facade
  `createCanvas(target, config)` instead of
  `@denovo/canvas-web`'s three-argument `createCanvas`. Consumers get the
  full facade host contract (`data-denovo-*` attributes, theme variables),
  renderer resolution, plugin setup, and typed backend errors through every
  framework wrapper.
- Adapter `options` props changed from `CreateCanvasOptions` to the new
  exported `DenovoCanvasCommonConfig` (facade common config without the
  scene/document discriminants), and runtime callbacks/emits now expose
  `DenovoCanvasRuntime`.
- The facade now exports `DenovoCanvasCommonConfig` and forwards the
  previously dropped `renderNode` option to the underlying runtime, so
  Canvas2D custom node rendering works through the facade.
- Dependency direction fixed to adapters → facade:
  - react/vue/svelte/solid packages declare `@denovo/canvas` as peer
    (+ devDependency for build ordering; svelte/solid ship source).
  - `@denovo/canvas` keeps `@denovo/react-canvas` as an optional peer only
    (devDependency removed). pnpm still links it for the facade's `./react`
    re-export entry, and Turborepo no longer sees a build cycle because it
    ignores peer-only edges.

## Verification

- `pnpm typecheck`: passed (30/30 tasks).
- `pnpm build --force`: passed (20/20 packages and apps, uncached).
- `pnpm verify:public-api`: passed, including the generated-declaration
  `any` audit; adapter `.d.ts` files reference facade types with no broad
  leakage.
- `pnpm verify:browser-rendering-adapters`: passed for React, Vue, Svelte,
  Solid (render + resize + 3d→2d scene swap, no console/page errors), plus
  Bim and Diagram suites including desktop/mobile connector gestures.

## Residual risk

- Adapter consumers passing `options` see a type change
  (`CreateCanvasOptions` → `DenovoCanvasCommonConfig`); fields are
  compatible, but the re-exported `createCanvas` signature is now the
  two-argument facade form.
- The facade stamps its host contract onto the wrapper-provided host
  element; consumer CSS targeting bare hosts may need review.
- Turborepo treats the canvas ↔ react-canvas relationship as acyclic only
  because one direction is peer-only; reintroducing a devDependency in both
  directions will fail `pnpm typecheck`/`pnpm build` with a cycle error.

## Next action

Run the remaining M4–M8 acceptance suites so landed milestones become
verified; M5's "adapters wrap the same core" criterion is now satisfied at
the view-runtime level.
