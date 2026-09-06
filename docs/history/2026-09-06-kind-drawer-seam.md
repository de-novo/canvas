# 2026-09-06 Kind drawer seam and kind enumeration

## Date

2026-09-06

## Scope

Host plugin kinds can register a Canvas2D drawer and a WebGL2 object on
`@denovo/canvas-web`. Registered kinds are enumerable as readonly
`{ type, mode }` snapshots. The default facade does not export the
drawer registration or engine types for it.

## Changes

- Contract: [Kind Drawer Seam](../kind-drawer-seam.md).
- `@denovo/canvas-web`: `registerPluginNodeDrawer`, local-size and
  paint/object lookup used by Canvas2D render/hit bounds and the 3D
  object factory. Missing drawers stay the gray marker (`#64748b`).
  Unregister restores the marker. Official field/sparkline/shade
  drawers stay hard-coded.
- `@denovo/canvas-core`: `listPluginNodeKinds()`. Unregistered types
  stay fail-closed at parse.
- Facade re-exports the enumeration, not the drawer seam.

## Verification

Recorded in [Project Status](../project-status.md) Evidence for this
date.

## Residual risk

- 2D WebGPU still paints host kinds as the marker. GPU drawer parity
  is unmeasured.
- Vanilla cannot depend on `@denovo/canvas-web`, so there is no
  facade-example page for a host drawer. Canvas2D fill capture and
  WebGL2 object/hit tests in `pnpm verify:hit-testing` are the proof.
- Playwright is present but was not used to sample a host-kind page
  for that package-boundary reason.

## Next action

Do not wrap ThreeUI or Canvas UI rooms. Region/mask stays `rect` /
`circle` plus host metadata until a later polygon kind is justified.
Kind-file colocation and a generated named-operations manifest remain
later, not this contract.
