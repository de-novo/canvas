# Three.js-free ./2d entrypoints for Vue, Svelte, and Solid adapters + Release workflow clean-checkout fix

Issue: [#13](https://github.com/de-novo/canvas/issues/13).

## Summary

- Added Three.js-free `./2d` subpaths across the remaining three framework
  adapters, achieving full 4-framework parity with `@denovo/react-canvas/2d`:
  - `@denovo/vue-canvas/2d` (`DenovoCanvas2D`, `useCanvasSelector`, `shallowEqual`)
  - `@denovo/svelte-canvas/2d` (`DenovoCanvas2D`, `createCanvasSelectorStore`, `shallowEqual`)
  - `@denovo/solid-canvas/2d` (`DenovoCanvas2D`, `useCanvasSelector`, `shallowEqual`)
- Added bundle/source purity checks (zero `three`, `three/webgpu`,
  `three-mesh-bvh`, `@denovo/canvas-three`, `@denovo/canvas-web`, or root
  `@denovo/canvas` imports) plus positive and `@ts-expect-error` negative
  consumer fixtures for all three `./2d` entrypoints in
  `scripts/verify-public-api.mjs`.
- Fixed `.github/workflows/release.yml` clean-checkout bootstrap order to match
  `.github/workflows/ci.yml` (discovered via Release dry-run `#45103300788`).
- Updated `docs/public-api-contract.md`, `README.md`, `CHANGELOG.md`, and
  `docs/project-status.md`.

## Verification

- `pnpm build`
- `pnpm typecheck`
- `pnpm verify:public-api`
- `pnpm verify:pack-smoke`
- `pnpm verify:selectors`
- `pnpm verify:docs`
- `git diff --check`

## Compatibility And Migration

- Purely additive subpath exports (`./2d`) on `@denovo/vue-canvas`,
  `@denovo/svelte-canvas`, and `@denovo/solid-canvas`; existing root exports
  are unchanged.
