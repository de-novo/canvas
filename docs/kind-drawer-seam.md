# Kind Drawer Seam

This contract is the implementation of the next slice in
[Extension Surface Decision](./extension-surface-decision.md): a host
`plugin.<org>.<kind>` can paint and pick without replacing the whole
renderer. Identity stays in [Product Identity](./product-identity.md).
Kind grammar stays in [Framework Surface](./framework-surface.md).
Enumeration of registered kinds stays a core read
(`listPluginNodeKinds`). Current evidence stays in
[Project Status](./project-status.md).

It is a target contract. Status is not claimed here.

## Decision

Registration lives in `@denovo/canvas-web`. For kind `T` in mode `M`,
the host supplies a drawer. The 2D path paints through Canvas2D. The 3D
path creates the object the WebGL2 runtime already raycasts. Hit-testing
uses the same structural bounds as the drawer’s local size.

The default facade (`@denovo/canvas`) MUST NOT export this registration
and MUST NOT expose `CanvasRenderingContext2D` or Three.js types for it.
Hosts that need a custom kind visual import `@denovo/canvas/web` or
`@denovo/canvas-web`.

Official kinds (`plugin.denovo.field`, `plugin.denovo.sparkline`,
`plugin.denovo.shade`) keep their hard-coded drawers. A host
registration for those types is ignored. Unofficial registered kinds
without a drawer still paint the existing gray marker (`#64748b`) and
MUST NOT throw.

## Registration

```ts
import { registerPluginNodeDrawer } from "@denovo/canvas/web";

const unregister = registerPluginNodeDrawer({
  type: "plugin.test.card",
  mode: "both",
  draw2d(context, node) { /* Canvas2D paint */ },
  localSize2d(node) { return [80, 48]; },
  create3d(node) { /* Object3D */ }
});
```

- `type` is `plugin.<owner>.<kind>`.
- `mode` is `2d`, `3d`, or `both`. A 2D-only drawer is ignored in 3D
  and the reverse.
- `draw2d` is optional. Missing means the 2D marker. The seam applies
  the node transform first; the callback paints in local space.
- `localSize2d` is optional. Missing means the 48×48 marker size.
  Hit-testing uses that size through the existing world-bounds path.
- `create3d` is optional. Missing means the unit-box marker.
- The function returns an unregister callback. Calling it restores the
  marker for that type. Double-register of the same type is a
  `TypeError`. Unregister of an already-removed drawer is a no-op.
- A missing or throwing drawer MUST NOT replace the scene with a
  different backend. A host `draw2d` / `create3d` exception is the
  host’s; the built-in marker path itself MUST NOT throw when no
  drawer is registered.

2D WebGPU rasterizes `draw2d` into the existing text atlas when the
local size fits. If the stamp does not fit, the gray marker is used
and the presenter does not throw. GPU canvas pixels are not visible to
`drawImage` or Playwright screenshots; `readPixels()` copies the
swapchain with `copyTextureToBuffer` so host-drawer color can be gated
on WebGPU. 3D runtimes reject with `CanvasReadPixelsUnsupportedError`.

## Acceptance

1. **Non-marker with a host drawer (Canvas2D).** A `plugin.test.*` kind
   registered by the host, with `draw2d` filling a color other than
   `#64748b`, paints that color. A hit at the node bounds returns that
   node’s id.
2. **Non-marker with a host drawer (WebGL2).** The same kind with
   `create3d` producing a non-marker object is pickable through the
   Three.js hit tester. The object is not the gray unit-box marker
   material `#64748b`.
3. **Marker fallback.** The same registered kind with no drawer paints
   `#64748b` in Canvas2D and the gray unit box in WebGL2, and does not
   throw.
4. **Unregister restores the marker.** After the host drawer is
   removed, the same node paints as the marker again.
5. **No engine types on the facade.** Generated `@denovo/canvas`
   declarations do not mention `registerPluginNodeDrawer`,
   `CanvasRenderingContext2D`, or `Object3D` as part of this seam.
   Consumer fixtures import the facade for kind enumeration, not for
   drawers.

## Non-Goals

- Wrapping ThreeUI or Canvas UI rooms.
- Growing `CanvasPluginContext` with drawer, node, renderer, storage,
  importer, or worker registration.
- A photo-editor or region/mask kind. Polygons wait on this seam and a
  later closed points schema.
- Sampling WebGPU host-drawer pixels in headless Playwright. The
  presenter rasterizes `draw2d` into the atlas; pixel sampling of that
  path stays a browser GPU observation.
- Moving official kinds into the host registry.

## Verification

`pnpm verify:hit-testing` drives the Canvas2D paint/hit path and the
WebGL2 object/hit path through the shipped web/three factories.
`pnpm verify:public-api` proves the facade does not export the drawer
registration and that `listPluginNodeKinds` is a readonly snapshot of
`type` and `mode`.
