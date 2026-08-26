# 2026-08-26 WebGPU auto 3D

## Date

2026-08-26

## Scope

3D `auto` prefers WebGPU when `capabilities.webgpu` is true. This is
the same `createCanvas` call a host already writes. Explicit
`backend: "webgpu"` stays strict and never falls back to WebGL2. 2D
`auto` stays Canvas2D. No 2D WebGPU, no compute, no document
`backend` field.

## Changes

- `resolveBackend("auto", "3d")` returns `webgpu` when the probe is
  true, otherwise WebGL2.
- Before creating Three `WebGPURenderer`, 3D `auto` asks
  `navigator.gpu.requestAdapter()`. No adapter means WebGL2 on a
  clean canvas. Init failure after an adapter still falls back to
  WebGL2. Explicit `backend: "webgpu"` still fails.
- `CanvasImplementedBackend` includes `webgpu`.
- Pixel-sampling Playwright gates launch with
  `--disable-features=WebGPU` so they stay on WebGL2.
- `pnpm verify:webgpu` asserts vanilla `/` (no query) draws on
  `webgpu` when the GPU flags are on.
- Vanilla and BIM still honor `?backend=webgpu` and
  `?backend=webgl2`.

## Verification

Ran 2026-08-26:

- `pnpm typecheck` — 36/36
- `pnpm build` — 25/25
- `pnpm verify:public-api` — `public-api-suite` ok, including
  `CanvasImplementedBackend = "webgpu"`
- `pnpm verify:webgpu` — 7/7, desktop and mobile `drawn`, including
  `webgpu-vanilla-auto-selects-3d`
- `pnpm verify:browser-rendering` — desktop and mobile ok; 3D `auto`
  without a GPU adapter falls back to WebGL2
- `pnpm verify:docs` — 157 Markdown files, 501/501 local targets

## Residual risk

- `navigator.gpu` is not a device. `runtime.ready` can still fail
  after `auto` resolves to `webgpu`.
- Playwright cannot sample WebGPU canvas pixels. Pixel gates must
  keep WebGPU disabled.
- 2D WebGPU and GPU compute stay later work.

## Next action

Do not start 2D WebGPU or a measured frame-budget gate until a host
cannot run on Canvas2D / WebGL2, or a pinned GPU environment exists.
Force WebGL2 with `renderer: { backend: "webgl2" }`.
