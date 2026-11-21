# 2D high-frequency input rAF render coalescing

Issue: [#5](https://github.com/de-novo/canvas/issues/5).

## Summary

Added a `scheduleRender()` / `cancelScheduledRender()` animation-frame coalescer
in `packages/web/src/2d.ts` so high-frequency interactive updates
(`handleNavigationPointerMove`, `handleNavigationWheel`, `setHoveredNode`,
`setSelection`, `setNodeTransformHandleTarget`, `setNodeTransformPreview`, and
`setAuthoringPreviews`) collapse into at most one render per display refresh
frame.

Explicit imperative calls (`runtime.render()`, `runtime.update()`,
`runtime.resize()`, `runtime.readPixels()`, and `setViewState()`) remain
synchronous and cancel any pending scheduled frame so no duplicate render runs.
`destroy()` marks the runtime destroyed and cancels any queued rAF.

No public API types or document schemas changed.

## Verification

- `pnpm verify:2d-performance`: passed (4/4 workloads + rAF burst coalescing
  gate: **20 synchronous wheel events → 1 Canvas2D render** with exact `+240`
  accumulated pan delta)
- `pnpm verify:webgpu`: passed (11/11)
- `pnpm verify:flow-showcase`: passed (2/2)
- `pnpm verify:network-showcase`: passed (2/2)
- `pnpm verify:diagram-rendering`: passed (desktop + mobile)
- `pnpm verify:hit-testing`: passed (7/7)
- `pnpm typecheck`: passed (25 packages)
- `pnpm build`: passed (25/25)
- `pnpm verify:docs`: passed

## Unmeasured Scope

- Physical 120–240 Hz trackpad/touch hardware frame pacing and Linux/Windows
  timings remain unmeasured beyond Chromium headless burst verification.
