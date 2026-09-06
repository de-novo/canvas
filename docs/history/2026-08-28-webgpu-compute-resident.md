# 2026-08-28 WebGPU field compute stays resident

## Date

2026-08-28

## Scope

Field streak compute keeps positions on the GPU and copies them into
Three's vertex buffer. The hot path no longer `MAP_READ`s. The
document is unchanged.

## Changes

- Compute writes storage, then `copyBufferToBuffer` into the Three
  attribute buffer (`VERTEX | COPY_DST`). First frames still use the
  CPU writer until that buffer exists.
- `CanvasRenderStats.computeResidentCopies` reports GPU-to-GPU copies.
- `pnpm verify:webgpu` requires both dispatches and resident copies.

## Verification

Ran 2026-08-28:

- `pnpm typecheck` — 36/36
- `pnpm build` — 25/25
- `pnpm verify:public-api` — `public-api-suite` ok, including
  `CanvasFrame.render.computeResidentCopies`
- `pnpm verify:webgpu` — 9/9, including
  `webgpu-field-streaks-use-compute` requiring resident copies
- `pnpm verify:docs` — 161 Markdown files, 509/509 local targets

## Residual risk

- Letter patterns still tick on the CPU.
- If Three has not created the vertex buffer yet, the tick stays on
  the CPU writer.
- Playwright still cannot sample WebGPU pixels.

## Next action

A pinned 16 ms frame-budget gate still needs a measurement
environment. Do not add a playground.
