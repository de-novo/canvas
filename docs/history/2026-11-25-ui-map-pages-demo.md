# Interactive v0.2 UI Screen Map & Box-Model Inspector Demo on GitHub Pages Hub

Date: 2026-11-25

## Scope

Added an interactive Three.js-free `@de-novo/canvas/2d` demo showcasing the
`v0.2` feature set (`plugin.denovo.image`, obstacle-free gutter orthogonal
routing, 2D UI styles and clipped groups, DevTools box-model and spacing
redline inspection overlays, `setImageFit` + Undo, Canvas2D ↔ 2D WebGPU
switching, 6 / 60 / 200 screen scale presets, and `captureCanvas2DSnapshot()`)
to the GitHub Pages hub (`dist-pages/ui-map/`).

## Changes

- Added [apps/playground-flow/ui-map.html](../../apps/playground-flow/ui-map.html)
  and [apps/playground-flow/src/ui-map.ts](../../apps/playground-flow/src/ui-map.ts).
- Updated [scripts/build-pages-site.mjs](../../scripts/build-pages-site.mjs) to
  build `dist-pages/ui-map/` and feature the demo card across English, Korean,
  and Simplified Chinese hub copy.
- Updated [scripts/verify-pages-site.mjs](../../scripts/verify-pages-site.mjs)
  to gate zero Three.js (`WebGLRenderer`) in `dist-pages/ui-map/assets/*.js`,
  verify gutter toggle + Undo, `setImageFit` Named Operation, `captureCanvas2DSnapshot()`
  PNG output, 60-screen preset switch, and both desktop (`1280×800`) and mobile
  (`390×844`) viewports with zero console/page errors.

## Verification

- `pnpm typecheck` — passed (`36/36` tasks).
- `pnpm verify:pages` — passed (`7/7` checks, desktop + mobile non-blank
  verified, screenshot at `artifacts/verification/pages-ui-map-desktop.png`).
- `pnpm verify:docs` — passed (`206` Markdown files, `753/753` local targets, 0 symlinks, 0 conflict markers).

## Compatibility And Migration

- Demo-only addition in `apps/playground-flow` and Pages build/verifier
  scripts; no package API or schema changes.

## Residual Risk

- WebGPU backend switch inside the demo requires a browser with `navigator.gpu`
  (gracefully disabled when unavailable); headless Chromium CI exercises the
  Canvas2D path in `verify:pages` while GPU WebGPU is covered by `verify:webgpu`.

## Next Action

- Ready to commit and push `v0.2` changes (and cut `v0.2.0` npm release once
  `NPM_TOKEN` is configured) so `de-novo/dui#259` can consume `@de-novo/canvas@^0.2.0`.
