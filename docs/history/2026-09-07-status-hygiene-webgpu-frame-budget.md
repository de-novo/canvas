# 2026-09-07 Status hygiene and 3D WebGPU 16 ms

## Date

2026-09-07

## Scope

Stop current documents from claiming the 16 ms gate is still waiting
on a pin, and from treating 2D WebGPU host-drawer pixels as
unsampled. Gate explicit 3D WebGPU 1k-boxes frame time on the same
Metal GPU already used for WebGL2.

## Changes

- [Project Status](../project-status.md) Current Phase: the 2026-08-22
  descope is historical; WebGL2 Metal 16 ms landed 2026-09-06 and 3D
  WebGPU 1k-boxes joins it here. Linux and Windows stay unmeasured.
- [Kind Drawer Seam](../kind-drawer-seam.md) acceptance 6: 2D WebGPU
  host color is gated through `readPixels()`. The old non-goal that
  Playwright cannot sample those pixels is removed.
- `pnpm verify:performance` measures 1k-boxes with
  `backend: "webgpu"` on hardware GPU Chromium. The 16 ms p50 gate
  applies. WebGPU `drawCalls` is recorded and is not required to be 1.

## Verification

Recorded in [Project Status](../project-status.md) Evidence for this
date.

## Residual risk

- Linux and Windows ANGLE backends remain unmeasured.
- WebGPU `drawCalls=24` on this 1k-boxes run is not a batching
  regression of the WebGL2 InstancedMesh=1 proof.

## Next action

Do not wrap ThreeUI or Canvas UI. Polygon `plugin.<org>.region` still
waits on a consuming product.
