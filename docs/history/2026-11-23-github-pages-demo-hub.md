# GitHub Pages open-source demo hub and 10k 2D live benchmark

Issue: [#17](https://github.com/de-novo/canvas/issues/17).

## Summary

- Added a Three.js-free interactive 10k 2D live benchmark & smart-snap/layout
  demo (`apps/playground-flow/bench-2d.html`, `apps/playground-flow/src/bench-2d.ts`)
  built on `@de-novo/canvas/2d` with live `drawCalls`, O(k) incremental move
  telemetry, O(visible) `computeSnapGuides` + `setSnapGuides` overlay painting,
  and `alignNodes` / `distributeNodes` + `undo` controls.
- Added `scripts/build-pages-site.mjs` (`pnpm build:pages`) generating a
  self-contained `dist-pages/` static bundle with a multilingual (EN / KO /
  ZH-CN) landing hub (`index.html`), `.nojekyll`, and relative-base sub-apps
  (`bench-2d/`, `flow/`, `network/`, `field/`).
- Added `.github/workflows/pages.yml` to build and deploy `dist-pages/` to
  GitHub Pages on `main` pushes and `workflow_dispatch`.
- Added `scripts/verify-pages-site.mjs` (`pnpm verify:pages`) to build
  `dist-pages/` and verify the multilingual hub, 10k live benchmark
  interactions, Three.js-free bundle purity, and `flow/` + `network/` sub-apps
  in headless Chromium over local HTTP.

## Verification

- `pnpm --filter @de-novo/canvas-flow-example typecheck`: passed
- `pnpm verify:pages`: passed (4/4 checks: static build & Three.js-free check,
  EN/KO/ZH hub switcher, 10k live benchmark incremental move + smart snap +
  align/distribute, flow & network sub-apps)
- `pnpm verify:docs`: passed
- Ruby `YAML.safe_load` on all `.github/**/*.yml`: passed
- `git diff --check`: passed

## Unmeasured Scope

- Live GitHub Pages deployment requires GitHub Pages to be enabled (Source:
  GitHub Actions) in repository settings.
