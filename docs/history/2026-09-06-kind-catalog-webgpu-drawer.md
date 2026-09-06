# 2026-09-06 Kind colocation, named-operation catalog, and 2D WebGPU host drawers

## Date

2026-09-06

## Scope

Three follow-ups after the drawer seam and kind enumeration:

- official kind modules live under `kinds/`;
- agents can enumerate named operations without a second protocol;
- 2D WebGPU rasterizes a host `draw2d` instead of only the gray marker.

## Changes

- Core: `field`, `sparkline`, and `shade` moved to `packages/core/src/kinds/`.
  Three: field object + compute moved to `packages/three/src/kinds/`.
  Facade export names are unchanged.
- Editor: `listNamedOperations()` and `NAMED_OPERATION_NAMES` list the
  twenty named operations with `read` / `write` role and closed field
  kinds. Re-exported by `@denovo/canvas`.
- 2D WebGPU: host `draw2d` stamps into the text atlas when the local
  size fits; otherwise the marker. The presenter does not throw.

## Verification

Recorded in [Project Status](../project-status.md) Evidence for this
date.

## Residual risk

- WebGPU host-drawer *pixels* are not sampled in Playwright. Wiring is
  proven by the shipped 2D WebGPU bundle calling
  `resolveHostPluginNodeDraw2d`, plus Canvas2D fill/hit tests.
- Atlas stamps larger than 2048 px fall back to the marker.

## Next action

Region/mask stays `rect` / `circle` plus host metadata until a consuming
product shows polygons are required. Do not wrap ThreeUI or Canvas UI
rooms. A pinned 16 ms frame-budget gate still needs a measurement
environment.
