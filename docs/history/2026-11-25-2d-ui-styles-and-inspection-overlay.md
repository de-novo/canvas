# 2D UI Style Primitives and Box-Model / Distance Redline Inspection Overlays

Date: 2026-11-25

## Scope

First `v0.2` slice: backwards-compatible `0.2.0` 2D UI styling primitives
(`cornerRadius`, `stroke`, `strokeWidth`, `opacity`, and `group.clip`) across
Canvas2D and single-drawCall 2D WebGPU SDF rendering, paired with ephemeral
DevTools-style box-model and spacing redline inspection overlays.

## Changes

- **Core schema (`packages/core/src/index.ts`)**:
  - Added strict schemas and derived types `Canvas2DCornerRadiusSchema`
    (non-negative finite scalar or 4-tuple `[tl, tr, br, bl]`),
    `Canvas2DOpacitySchema` (`[0, 1]`), and `Canvas2DClipRectSchema`
    (`{ x?, y?, width, height, cornerRadius? }`).
  - Extended `RectNodeSchema` with defaulted `cornerRadius: 0`, `stroke: null`,
    `strokeWidth: 1`, and `opacity: 1`; extended `CircleNodeSchema` with
    defaulted `stroke: null`, `strokeWidth: 1`, and `opacity: 1`; extended
    `Canvas2DGroupNodeSchema` with defaulted `clip: null` and `opacity: 1`.
  - Canonical schema version stays `0.2.0`; all legacy `0.1.0` and existing
    `0.2.0` inputs remain valid without migration changes.
- **Editor authoring (`packages/editor/src/authoring/`)**:
  - Derived optional `cornerRadius`, `stroke`, `strokeWidth`, and `opacity`
    fields on `Canvas2DShapeToolOptions` and forwarded them in
    `create2DShapeTool`.
- **2D geometry, spatial index, hit-testing, and Canvas2D renderer (`packages/web/src/2d/`)**:
  - Shared CSS border-radius clamping (`resolveClampedCornerRadii`), rounded-box
    SDF (`signedDistanceRoundedRect`), and clip inclusion (`isPointInsideClipRect`)
    between rendering and hit-testing so cut-off corners and clipped group
    overflows neither draw nor pick.
  - Updated `Canvas2DSpatialIndex` with `hasStyledAncestor`, half-stroke
    conservative bounds expansion, and style-field equality checks so
    incremental O(k) sync tracks style and clip updates while flat scenes retain
    their zero-overhead fast path.
  - Added pure inspection geometry module (`packages/web/src/2d/inspection.ts`):
    `computeCanvas2DRedlines`, `resolveCanvas2DBoxModelRegions`,
    `formatCanvas2DRedlineDistance`, `DEFAULT_BOX_MODEL_COLORS`, and
    `DEFAULT_REDLINE_COLOR`, plus `renderCanvas2DInspectionOverlay` and
    ephemeral `runtime.current.setInspectionOverlay(overlay | null)`.
- **2D WebGPU SDF Uber-Quad presenter (`packages/web/src/2d/webgpu.ts`)**:
  - Upgraded the 2D WebGPU vertex/fragment pipeline to a single-drawCall SDF
    Uber-Quad supporting anti-aliased per-corner rounded rectangles, centered
    strokes, node/group opacity, per-quad rounded group clipping (preserving
    parent group transforms across all drawable kinds), snap guides, and
    zoom-invariant screen-space box-model and redline overlays.
- **Facade re-exports (`packages/canvas/src/index.ts`, `packages/canvas/src/2d.ts`)**:
  - Re-exported all new core schemas/types and inspection helpers/types from
    both `@de-novo/canvas` and `@de-novo/canvas/2d`.

## Verification

- `pnpm typecheck` — passed across workspace.
- `pnpm build` — passed across workspace; zero explicit `any` in generated `.d.ts`.
- `pnpm verify:document-schema` — 46/46 checks passed (including
  `2d-ui-styles-normalize-and-validate-strictly` and positive/negative TS
  fixtures).
- `pnpm verify:public-api` — passed (including positive and `@ts-expect-error`
  fixtures across `@de-novo/canvas` and `@de-novo/canvas/2d`).
- `pnpm verify:editor-core` — passed (including `node.update` + undo/redo
  roundtrips for `rect`, `circle`, and `group.clip` / `opacity`).
- `pnpm verify:hit-testing` — 10/10 checks passed (including rounded-corner and
  stroke picking, clipped-group picking/bounds, box-model region strips,
  redline geometry, and Canvas2D recording draw checks).
- `pnpm verify:webgpu` — 13/13 checks passed, including pixel-verified
  `webgpu-2d-ui-styles-clip-and-inspection` (`drawCalls=1`, GPU `readPixels()`)
  and `canvas2d-ui-styles-clip-and-inspection`, with visual screenshots at
  `artifacts/verification/2d-ui-styles-canvas2d.png` and
  `artifacts/verification/2d-ui-styles-webgpu.png`.
- `pnpm verify:2d-performance` — all gates passed (`10k-2d-rects` p50 `0.00ms`,
  `10k-2d-webgpu` p50 `0.00ms` / `drawCalls=1` / `210` triangles, ephemeral
  `setInspectionOverlay` repaint + clear).
- `pnpm verify:pack-smoke` — 12/12 packages + external unpacked ESM smoke passed.
- `pnpm verify:selectors` — 4/4 passed.
- `pnpm verify:flow-showcase` — 2/2 passed (desktop + mobile).
- `pnpm verify:network-showcase` — 2/2 passed (desktop + mobile).
- `pnpm verify:browser-rendering` — desktop + mobile passed.
- `pnpm verify:docs` — passed (`203` Markdown files, `743/743` local targets, 0 symlinks, 0 conflict markers).

## Compatibility And Migration

- Purely additive defaults inside canonical schema `0.2.0`; no breaking
  persistence changes and no schema version bump.
- TypeScript consumers constructing raw `CanvasNodeByType<"2d", "rect" | "circle" | "group">`
  output literals (rather than `defineScene` / `defineDocument` inputs) now see
  the new defaulted output properties (`cornerRadius`, `stroke`, `strokeWidth`,
  `opacity`, `clip`).

## Residual Risk

- Nested non-axis-aligned (rotated) clipping groups in 2D WebGPU apply the
  innermost group clip rather than intersecting multiple rotated SDF clip masks;
  Canvas2D intersects arbitrarily nested rotated clips natively.
- Linux and Windows GPU environments remain unmeasured locally.

## Next Action

- Proceed to the second `v0.2` slice: obstacle-avoiding gutter routing for 2D
  orthogonal edges and a native 2D `image` asset rendering primitive for large
  screenshot canvases (e.g. `de-novo/dui`).
