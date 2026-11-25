# GitHub Actions CI workflow

Issue: [#10](https://github.com/de-novo/canvas/issues/10).

## Summary

- Added `.github/workflows/ci.yml` running two parallel jobs on `push` to
  `main` and on `pull_request` (with concurrency cancellation):
  - `static-and-unit`: clean checkout bootstrap for the optional
    `@de-novo/react-canvas` peer declaration cycle, `pnpm build`,
    `pnpm typecheck`, `pnpm verify:docs`, `pnpm verify:public-api`,
    `pnpm verify:document-schema`, `pnpm verify:editor-core`,
    `pnpm verify:hit-testing`, `pnpm verify:server`, `pnpm verify:worker-tasks`,
    and `pnpm verify:m4-performance`.
  - `browser-gates`: Playwright Chromium installation plus
    `pnpm verify:selectors`,
    `node scripts/verify-2d-performance.mjs --canvas2d-only`,
    `pnpm verify:flow-showcase`, `pnpm verify:network-showcase`,
    `pnpm verify:diagram-rendering`, and `pnpm verify:region-mask`.
- Added `--canvas2d-only` to `scripts/verify-2d-performance.mjs` so headless
  Linux CI runners without hardware WebGPU adapters still enforce 10k 2D
  spatial culling, pan/hit-test/marquee budgets, HTML overlay diffing, and rAF
  burst coalescing gates.

## Verification

- Local `node scripts/verify-2d-performance.mjs --canvas2d-only`: passed (3/3
  Canvas2D workloads + HTML overlay diff + rAF burst coalescing)
- Local `pnpm verify:2d-performance`: passed (4/4 workloads including WebGPU)
- Local static/unit suite (`verify:document-schema`, `verify:server`,
  `verify:worker-tasks`, `verify:m4-performance`, `verify:docs`): passed
- Workflow YAML parsed cleanly with Ruby `YAML.safe_load`.

## Unmeasured Scope

- First live execution on GitHub-hosted `ubuntu-latest` runners occurs once the
  commit is pushed to `origin/main`. Hardware GPU WebGPU / 16 ms 3D frame
  budget gates (`verify:performance`, `verify:webgpu`) remain outside
  CPU-only `ubuntu-latest` runners.
