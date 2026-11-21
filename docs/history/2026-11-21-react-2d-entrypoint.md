# Three.js-free @denovo/react-canvas/2d and @denovo/canvas/react/2d entrypoints

Issue: [#9](https://github.com/de-novo/canvas/issues/9).

## Summary

- Added `@denovo/react-canvas/2d` (`packages/react/src/2d.tsx`, shared
  `packages/react/src/selector.ts`) exporting `<Canvas2DView>`,
  `useCanvasSelector`, and `shallowEqual` backed exclusively by
  `@denovo/canvas/2d` with zero `three`, `@react-three/fiber`,
  `@react-three/drei`, or `@denovo/canvas-three` imports.
- Re-exported `@denovo/react-canvas/2d` as `@denovo/canvas/react/2d`
  (`packages/canvas/src/react-2d.ts`, `packages/canvas/package.json`).
- Migrated `apps/playground/app/mask-host.tsx` (Next.js `/mask` consumer) to
  `@denovo/canvas/2d` + `@denovo/react-canvas/2d` (`Canvas2DView`,
  `useCanvasSelector`, `shallowEqual`).
- Migrated `apps/playground-network` and `apps/playground-diagram` to
  `@denovo/canvas/2d`, removing the unused Three.js / `three.webgpu` stack
  from all 2D showcases (`apps/playground-network` Vite JS bundle dropped from
  1,869.85 kB to 351.96 kB, **-81.2%**; `apps/playground-diagram` stays
  Three.js-free at 340.42 kB).

## Compatibility And Declarations

Purely additive subpaths (`@denovo/react-canvas/2d`, `@denovo/canvas/react/2d`).
No existing exports changed and no migration is required.
`packages/react/dist/2d.d.ts` and `packages/react/dist/selector.d.ts` contain
zero explicit `any`. Positive and `@ts-expect-error` negative consumer fixtures
plus static zero-Three.js / zero-R3F / zero-Drei bundle assertions run in
`pnpm verify:public-api`.

## Verification

- `pnpm typecheck`: passed (25 packages)
- `pnpm build`: passed (25/25)
- `pnpm verify:public-api`: passed (including `facade-2d-smoke.ts` React 2D
  positive & negative fixtures and zero-Three/R3F/Drei static bundle checks on
  `packages/react/dist/2d.js`, `playground-flow`, `playground-network`, and
  `playground-diagram`)
- `pnpm verify:region-mask`: passed (6/6, Next `/mask` desktop & iPhone 14
  touch running on `Canvas2DView` + `useCanvasSelector`)
- `pnpm verify:network-showcase`: passed (2/2)
- `pnpm verify:diagram-rendering`: passed (desktop & mobile)
- `pnpm verify:selectors`: passed (4/4)
- `pnpm verify:docs`: passed

## Unmeasured Scope

- Clean-room `pnpm clean && pnpm build` ordering for the optional
  `@denovo/canvas/react` / `@denovo/canvas/react/2d` peer re-exports remains a
  shared monorepo build-order characteristic because `@denovo/react-canvas` is
  declared as an optional peer of `@denovo/canvas`.
