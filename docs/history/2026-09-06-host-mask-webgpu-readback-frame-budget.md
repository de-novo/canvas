# 2026-09-06 Host mask rasterization, 2D WebGPU readback, frame budget

## Date

2026-09-06

## Scope

A consuming host rasterizes region/mask documents from JSON. 2D WebGPU
exposes `readPixels()` so host-drawer color can be gated on the GPU
canvas. `pnpm verify:performance` labels the GL environment and gates
16 ms on 1k-boxes only when that renderer is a GPU.

## Changes

- Vanilla host rasterizer `apps/vanilla/src/rasterize-region-mask.mjs`
  fills `rect` / `circle` nodes tagged `metadata.role === "mask"` and
  reports unknown kinds instead of inventing a polygon. The bench
  composites the image stand-in through that mask.
- `readPixels(): Promise<ImageData>` on 2D runtimes. 2D WebGPU copies
  the swapchain with `copyTextureToBuffer`. 3D rejects with
  `CanvasReadPixelsUnsupportedError`.
- `pnpm verify:webgpu` requires host-drawer `#e11d48` from
  `readPixels` on WebGPU, not from a Playwright screenshot.
- `scripts/lib/frame-budget.mjs` classifies unmasked GL renderers.
  Software GL is recorded and not gated. GPU 1k-boxes p50 over 16 ms
  fails.

## Verification

Recorded in [Project Status](../project-status.md) Evidence for this
date.

## Residual risk

- A named CI machine is still not pinned. Software-GL hosts skip the
  16 ms ceiling on purpose.
- Polygon `plugin.<org>.region` is still not a kind. The host reports
  unsupported kinds; this slice does not show rect/circle is
  insufficient.

## Next action

Do not wrap ThreeUI or Canvas UI. Do not add `vgpu` as a dependency.
Do not grow `CanvasPluginContext` or a photo-editor vocabulary.
Schedule `plugin.<org>.region` only if a consuming product shows
rect/circle is not enough.
