# M3 Transform Axis And Plane Handles

Date: 2026-07-14

## Scope

Add renderer-independent transform handle identity and constrained translation
without changing the verified transient-preview and single-transaction contract
of the Transform tool.

## Changes

- Added strict `CanvasNodeTransformHandleId`,
  `CanvasNodeTranslationConstraint`, and `CanvasNodeTransformHandleTarget`
  schemas/types. Stable translation IDs cover X/Y/Z axes and XY/XZ/YZ planes.
- Marked the built-in Transform tool with `transform: "translate"`. Normalized
  `handle` and `gizmo` hits map to constraints in editor core without importing
  DOM, Canvas2D, or Three.js types.
- Kept free node dragging compatible. Handle drags use the same pointer session,
  renderer-only preview, cancellation cleanup, release-time `transaction`, and
  one `node.update` position patch.
- Added `CanvasNodeTransformHandleRuntime` as an optional structural capability
  separate from transform preview math. The facade derives its target from the
  active tool and primary selection; the dynamic runtime preserves it across
  2D/3D replacement.
- Added Canvas2D X/Y/XY rendering, top-priority handle hit testing, and
  constrained CSS-pixel translation.
- Added Three.js X/Y/Z axis and XY/XZ/YZ plane meshes, handle-first raycasting,
  constant-screen-size scaling, world-axis projection, and world-plane ray
  intersection.
- Added granular static CSS tokens for every axis/plane. Generic
  `--dc-handle-color` still overrides the complete gizmo; individual tokens
  fall back through Tailwind v4 and shadcn semantic variables. CSS colors are
  converted through the browser's sRGB canvas path before use by Three.js, so
  shadcn `oklch(...)` values do not leak unsupported color syntax into Three.js.

Effect remains the internal foundation for editor workflow composition. The
renderer hot path, ray/plane math, and synchronous color conversion remain
plain allocation-aware TypeScript, as allowed by the repository policy. Public
declarations stay Effect-free under TypeScript 7.

## Verification

Passed:

```sh
pnpm typecheck
pnpm build
pnpm verify:document-schema
pnpm verify:editor-core
pnpm verify:hit-testing
pnpm verify:public-api
pnpm verify:browser-rendering
```

The editor verifier exercises normalized X-handle routing, transient preview,
release-time commit, one history entry, and undo. The browser verifier performs
real desktop mouse and iPhone touch X-handle drags in Canvas2D and Three.js. In
both renderers, Y/Z remain unchanged during an X drag, the document stays stable
until release, and each release adds exactly one history entry. It also verifies
a consumer axis-token override and rejects browser console/page errors.

Visual evidence:

- [2D desktop handles](../../artifacts/m3-transform-handles-desktop-2d.png)
- [3D desktop handles](../../artifacts/m3-transform-handles-desktop-3d.png)
- [2D mobile handles](../../artifacts/m3-transform-handles-mobile-2d.png)
- [3D mobile handles](../../artifacts/m3-transform-handles-mobile-3d.png)

The configured external `doc-governance` skill directory is unavailable in this
environment. The repository-local Markdown link audit is used as the explicit
fallback and the unavailable command is not reported as passing.

## Residual Risk

- Translation constraints currently use world axes. Local-axis orientation,
  surface constraints, and snapping require later contracts.
- Canvas2D intentionally supports X/Y/XY only; Z/XZ/YZ are 3D-only.
- Rotation and scale handles are not implemented yet.
- Custom renderers must opt into `CanvasNodeTransformHandleRuntime` to render
  facade-managed handles, while free translation remains independently
  available through `CanvasNodeTransformRuntime`.

## Next Action

Extend the handle identity and transient-preview/single-transaction lifecycle to
rotation, then scale.
