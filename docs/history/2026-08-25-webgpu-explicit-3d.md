# 2026-08-25 Explicit WebGPU 3D

## Date

2026-08-25

## Scope

First WebGPU runtime slice. Explicit 3D `backend: "webgpu"` only.
`auto` stays Canvas2D / WebGL2. No 2D WebGPU, no compute, no document
field, no ThreeUI wrap.

## Changes

- Facade `resolveBackend` accepts `webgpu` for 3D when
  `capabilities.webgpu` is true. 2D is `mode-mismatch`. Missing GPU is
  `capability-unavailable`.
- `CanvasResolvedBackend` includes `webgpu`. `CanvasImplementedBackend`
  stays the `auto` pair (`canvas2d` | `webgl2`).
  `CanvasUnimplementedBackend` is only `offscreen-canvas2d`.
- `@de-novo/canvas-web` `createCanvas3D` uses Three.js `WebGPURenderer`
  when `gpuBackend: "webgpu"`. Init is async on `runtime.ready`. A
  WebGL fallback from Three.js is rejected.
- Vanilla honors `?backend=webgpu`. Host reports `data-denovo-ready`.

## Verification

Ran 2026-08-25:

- `pnpm typecheck` — 36/36
- `pnpm build` — 25/25
- `pnpm verify:public-api` — `public-api-suite` ok, including 2D
  `mode-mismatch`, Node `capability-unavailable`, and
  `CanvasResolvedBackend = "webgpu"`
- `pnpm verify:webgpu` — 3/3, desktop and mobile `drawn` with
  `data-denovo-backend=webgpu` and triangle/draw-call counts
- `pnpm verify:docs` — 144 Markdown files, 471/471 local targets

## Residual risk

- Section-plane clipping on WebGPU landed in
  [2026-08-25 WebGPU section plane](./2026-08-25-webgpu-section-plane.md).
- Playwright cannot reliably read WebGPU canvas pixels. The gate uses
  renderer stats, not a canvas PNG sample.
- Headless CI without a GPU will not paint. Desktop Chromium in this
  run did. Mobile still allows an explicit `unavailable` outcome.
- `auto` still never selects WebGPU.

## Next action

Do not make `auto` choose WebGPU. Add another slice only when the
change is sayable: 2D WebGPU, compute, or measured WebGPU budgets.
