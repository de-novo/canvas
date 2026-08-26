# 2026-08-26 WebGPU capability detect

## Date

2026-08-26

## Scope

Public, detection-only capability probe so a host can ask for WebGPU
before `createCanvas`. `auto` still never selects WebGPU. No 2D
WebGPU, no compute, no document `backend` field.

## Changes

- `@denovo/canvas` exports `detectCanvasBackendCapabilities()`.
- Returns `{ canvas2d, webgl2, webgpu, offscreenCanvas2d }`.
- Vanilla writes `data-denovo-capability-webgpu` from that probe.
- A true `webgpu` flag is not a device. `runtime.ready` can still
  fail with `capability-unavailable`.

## Verification

Ran 2026-08-26:

- `pnpm typecheck` — 36/36
- `pnpm build` — 25/25
- `pnpm verify:public-api` — `public-api-suite` ok, including
  `detectCanvasBackendCapabilities` and `@ts-expect-error` on
  `capabilities.metal`
- `pnpm verify:webgpu` — 4/4. Node reports `webgpu: false`. Desktop
  and mobile `drawn`, with `data-denovo-capability-webgpu=true`
- `pnpm verify:docs` — 154 Markdown files, 493/493 local targets

## Residual risk

- Node and headless CI report `webgpu: false`.
- Playwright still cannot sample WebGPU canvas pixels.

## Next action

Mesh and instance surface points on explicit `webgpu` landed in
[2026-08-26 WebGPU mesh and instance surface points](./2026-08-26-webgpu-mesh-instances-surface.md).
Do not make `auto` choose WebGPU.
