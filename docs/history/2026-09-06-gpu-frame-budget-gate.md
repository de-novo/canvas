# 2026-09-06 GPU 16 ms frame budget

## Date

2026-09-06

## Scope

Make the 16 ms 1k-boxes budget actually bite. The previous labeled
gate skipped SwiftShader. This slice launches hardware GPU Chromium,
forces WebGL2, and fails software GL.

## Changes

- `launchGpuChromium()` requests ANGLE Metal on macOS (D3D11/Vulkan
  elsewhere) instead of SwiftShader.
- The perf bench sets `renderer: { backend: "webgl2" }` so 3D `auto`
  cannot pick WebGPU and inflate `drawCalls`.
- `evaluateFrameBudget({ requireGpu: true })` fails software/unknown
  renderers. A 0 ms ceiling is asserted against the live 1k-boxes p50
  before the 16 ms check.

## Verification

Recorded in [Project Status](../project-status.md) Evidence for this
date.

## Residual risk

- The pin is this developer machine's Apple M5 Pro via Playwright
  Chromium 149, not a named CI fleet. Linux/Windows ANGLE backends
  are selected but unmeasured here.
- 3D WebGPU frame time is not this gate.

## Next action

Do not wrap ThreeUI or Canvas UI. Do not treat a SwiftShader 100 ms
sample as the 16 ms result.
