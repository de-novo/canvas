# Adapter Runtime Verification (React + Vue Smoke)

**Date:** 2026-07-21  
**Status:** ✅ Complete

## Overview

Added browser-rendering smoke coverage for the React and Vue framework
adapters so the project-status claim that they are "verified" is accurate.
Previously only the vanilla facade example had a browser-rendering suite
(`verify:browser-rendering`, ~4200 lines covering authoring/transform flows).

## What landed

### New example apps

Two minimal Vite apps that render a 2D and 3D scene through each adapter and
expose a scene-swap control:

- `apps/playground-react` (`@denovo/canvas-react-example`) — React 19 +
  `@vitejs/plugin-react`, renders via `@denovo/react-canvas` `CanvasView`.
- `apps/playground-vue` (`@denovo/canvas-vue-example`) — Vue 3 +
  `@vitejs/plugin-vue`, renders via `@denovo/vue-canvas` `DenovoCanvas`.

Both apps share the same scene data (a 3D sphere scene and a 2D rect/circle
scene) and expose:

- `<canvas>` mounted by the adapter,
- a `[data-denovo-control="swap"]` button to toggle 2D/3D,
- a `#mode-readout` element reporting the active mode.

### Smoke verification script

`scripts/verify-browser-rendering-adapters.mjs`, wired as
`pnpm verify:browser-rendering-adapters`. It:

1. Starts each example app's Vite dev server on a fixed port
   (React 5174, Vue 5175).
2. Loads each in headless Chromium via Playwright.
3. For each adapter asserts:
   - no uncaught page errors and no unexpected `console.error`s (benign
     headless-WebGL driver messages are allow-listed),
   - a `<canvas>` is mounted with non-zero size,
   - the canvas is **non-blank** after initial render (sampled pixel grid
     yields >1 distinct quantized color),
   - the canvas is still non-blank after a viewport resize,
   - swapping to the 2D scene still produces a non-blank canvas and flips
     `#mode-readout` to `2d`.

This is deliberately a *smoke* check — it confirms the adapter mounts and
paints, not the full authoring/transform coverage the vanilla suite has. The
non-blank heuristic (`toDataURL` → downsampled pixel-grid color count) works
for both 2D and WebGL canvases and is cheap to run.

## Decisions

### Why a separate script, not extending the vanilla one

The vanilla `verify-browser-rendering.mjs` is tightly coupled to the vanilla
example's DOM and authoring tool surface (15+ tools, transform handles,
measurement drafts). Reusing it for framework adapters would mean reproducing
that whole UI in React and Vue. The goal here was to verify *the adapter
mounts and renders*, which only needs a canvas + scene swap — hence a small,
focused script.

### Why Vue typecheck uses `tsc`, not `vue-tsc`

`vue-tsc` (both 2.x and 3.x) crashes against TypeScript 7 with
`ERR_PACKAGE_PATH_NOT_EXPORTED` on `typescript/lib/tsc` — TS 7 changed its
`exports` map and `vue-tsc` hasn't caught up. The Vue example's `typecheck`
script is therefore `tsc --noEmit` with `.vue` files excluded from the tsconfig
`include` and an `env.d.ts` shim declaring the `*.vue` module. The `.vue`
SFC's internal TypeScript is still checked at build time by `@vitejs/plugin-vue`.
When `vue-tsc` gains TS 7 support, swap the script back.

## Verification

- `pnpm --filter @denovo/canvas-react-example typecheck` — pass
- `pnpm --filter @denovo/canvas-react-example build` — pass
- `pnpm --filter @denovo/canvas-vue-example typecheck` — pass
- `pnpm --filter @denovo/canvas-vue-example build` — pass
- `pnpm verify:browser-rendering-adapters` — **both adapters pass**: React and
  Vue each render a non-blank canvas (35 distinct quantized colors on initial
  3D render), survive a viewport resize, repaint a non-blank 2D canvas after
  the scene swap, and emit no page/console errors.

Result output:

```
✅ React: rendered 35 colors initially, survived resize + scene swap, no errors
✅ Vue: rendered 35 colors initially, survived resize + scene swap, no errors
All adapter smoke checks passed.
```

## What this unblocks

`docs/project-status.md` can now honestly call the React and Vue adapters
runtime-verified (browser-rendering coverage exists), not just type/build
verified. The remaining M5 work (Svelte, Solid) can follow this same smoke
pattern: a tiny example app + a non-blank canvas assertion.

## Files added

- `apps/playground-react/{package.json, vite.config.ts, tsconfig.json, index.html, src/{main.tsx, App.tsx, styles.css}}`
- `apps/playground-vue/{package.json, vite.config.ts, tsconfig.json, index.html, src/{main.ts, App.vue, styles.css, env.d.ts}}`
- `scripts/verify-browser-rendering-adapters.mjs`
- root `package.json` — `verify:browser-rendering-adapters` script
