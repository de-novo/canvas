# 2026-08-26 WebGPU mesh and instance surface points

## Date

2026-08-26

## Scope

Same 3D document contract on explicit `backend: "webgpu"` for `mesh`
and `instances` surface points. A host asked for 3D WebGPU; boxes and
section planes were already on that path. `auto` still never selects
WebGPU. No 2D WebGPU, no compute, no document `backend` field.

## Changes

- `apps/vanilla/mesh-surface-bench.html?backend=webgpu` and
  `instances-surface-bench.html?backend=webgpu` request the explicit
  backend. Without the query they stay on `auto` / WebGL2.
- `apps/playground-bim` honors `?backend=webgpu` so a BIM host can
  load the same IFC document on that runtime.
- `pnpm verify:webgpu` asserts centre-viewport hit, unit camera-facing
  normal, miss outside geometry, mesh triangle correlation, and centre
  instance index on WebGPU.

## Verification

Ran 2026-08-26:

- `pnpm typecheck` — 36/36
- `pnpm build` — 25/25
- `pnpm verify:webgpu` — 6/6, desktop and mobile `drawn`, including
  `webgpu-mesh-surface-point` and `webgpu-instances-surface-point`
- `pnpm verify:docs` — 156 Markdown files, 498/498 local targets

## Residual risk

- Playwright still cannot sample WebGPU canvas pixels. This gate uses
  the same `__meshSurfaceResult` / `__instancesSurfaceResult` objects
  as the WebGL2 benches.
- `auto` still never selects WebGPU. Hosts that want this path pass
  `renderer: { backend: "webgpu" }` after
  `detectCanvasBackendCapabilities()`.

## Next action

3D `auto` prefers WebGPU in
[2026-08-26 WebGPU auto 3D](./2026-08-26-webgpu-auto-3d.md).
2D WebGPU and measured budgets wait for a host that cannot run on
Canvas2D / WebGL2.
