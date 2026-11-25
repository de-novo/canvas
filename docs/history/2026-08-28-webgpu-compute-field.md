# 2026-08-28 WebGPU field compute

## Date

2026-08-28

## Scope

When the 3D canvas is on WebGPU, `plugin.denovo.field` streak travel
runs in a compute shader. The document and `setFieldPattern` stay the
same. WebGL2 and letter patterns stay on the CPU tick. No 16 ms
frame-budget gate, no new kind, no ThreeUI wrap, no new playground.

## Changes

- `@de-novo/canvas-three` uploads field seeds to a storage buffer and
  dispatches a workgroup-64 compute shader that writes streak
  endpoints. Results come back one frame later; the first frames still
  use the CPU writer so the corridor moves immediately.
- `@de-novo/canvas-web` attaches that compute to field objects when
  Three's WebGPU backend exposes a device. Fallback and dispose stay
  on the CPU path.
- `CanvasRenderStats.computeDispatches` reports how many dispatches
  ran. `pnpm verify:webgpu` adds `field-compute-bench.html`.

## Verification

Ran 2026-08-28:

- `pnpm typecheck` — 36/36
- `pnpm build` — 25/25
- `pnpm verify:public-api` — `public-api-suite` ok, including
  `CanvasFrame.render.computeDispatches`
- `pnpm verify:webgpu` — 9/9, including
  `webgpu-field-streaks-use-compute`
- `pnpm verify:docs` — 159 Markdown files, 505/505 local targets

## Residual risk

- Letter-pattern fields still tick on the CPU.
- Compute uses Three's WebGPU device. If that handle is missing, the
  field stays on the CPU writer.
- Readback is one frame late. That is enough for travel, not for a
  measured 16 ms budget.
- Playwright still cannot sample WebGPU pixels.

## Next action

Do not invent a kind or wrap ThreeUI. A pinned 16 ms frame-budget gate
is the next sayable slice if a measurement environment exists.
