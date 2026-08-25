# 2026-08-25 WebGPU section plane

## Date

2026-08-25

## Scope

Same `setSectionPlane` on explicit 3D `backend: "webgpu"`. WebGL2 keeps
renderer clipping planes. `auto` is unchanged. No playground.

## Changes

- WebGPU reparents content, authoring previews, and transform handles
  into a Three.js `ClippingGroup`.
- `setSectionPlane({ normal, constant })` writes that group's planes.
  `null` clears them. Invalid normals still fail immediately, including
  before `runtime.ready`.
- `apps/vanilla/section-bench.html?backend=webgpu` reports clip-group
  attach/clear. Playwright cannot sample WebGPU pixels.

## Verification

Ran 2026-08-25:

- `pnpm typecheck` — 36/36
- `pnpm build` — 25/25
- `pnpm verify:webgpu` — 4/4, including
  `webgpu-section-plane-uses-clipping-group`
- `pnpm verify:docs` — 145 Markdown files, 474/474 local targets

## Residual risk

- Clip proof on WebGPU is the clipping-group plane count, not a pixel
  ratio. WebGL2 section-bench still uses the pixel halves.
- `auto` still never selects WebGPU.

## Next action

Add another WebGPU slice only when the change is sayable. Do not make
`auto` choose WebGPU.
