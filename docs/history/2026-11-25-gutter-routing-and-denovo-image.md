# Obstacle-Free Gutter Orthogonal Edge Routing and Official 2D Image Kind (`plugin.denovo.image`)

Date: 2026-11-25

## Scope

Second `v0.2` slice: obstacle-free gutter routing for 2D orthogonal edges and
the official 2D image kind (`plugin.denovo.image`) with `AssetRef` (`type: "image"`)
validation, session `CanvasImageStore`, async URI decoding, `setImageFit` Named
Operation, and Canvas2D + single-drawCall 2D WebGPU rendering.

## Changes

- **Core official kind & schema (`packages/core/src/kinds/image.ts`, `packages/core/src/index.ts`)**:
  - Preserved the `0.2.0` built-in kind freeze per `docs/extension-surface-decision.md`
    and `docs/framework-surface.md` by adding `plugin.denovo.image` as an
    official pre-registered 2D kind under `packages/core/src/kinds/image.ts`.
  - Closed `DenovoImagePropsSchema` (`assetId?`, `src?`, `width`, `height`,
    `fit?`, `cornerRadius?`, `opacity?`, `stroke?`, `strokeWidth?`,
    `placeholder?`, `alt?`; requires at least one of `assetId` or `src`), pure
    aspect framing helper `resolveDenovoImageDrawRect` (`contain` | `cover` |
    `fill`), `resolveDenovoImageStyle`, and `createImageAssetRef`.
  - Validated `plugin.denovo.image` `props.assetId` references against
    `document.assets` (`type: "image"`) in both `CanvasDocumentSchema` and the
    incremental validation fast path (mirroring `mesh.geometryAssetId`).
  - Added backwards-compatible defaulted fields `avoidObstacles: false` and
    `obstaclePadding: 16` to `Canvas2DEdgeNodeSchema`.
- **Editor Named Operation (`packages/editor/src/authoring/`)**:
  - Added `setImageFit` (`{ nodeId, fit: "contain" | "cover" | "fill" }`)
    compiling to canonical `node.update` and registered it in
    `NAMED_OPERATION_MANIFEST` / `listNamedOperations()` (23 total operations).
- **Obstacle-free gutter orthogonal router (`packages/web/src/2d/routing.ts`, `geometry.ts`, `spatial-index.ts`)**:
  - Added pure solver `resolveCanvas2DObstacleFreeOrthogonalWaypoints` and
    `orthogonalSegmentIntersectsBoxInterior`: clamps port stubs against nearby
    neighbors, checks fast-path L/Z candidates first, and otherwise builds a
    corridor-scoped gutter visibility grid (padded edges + centered midlines of
    open gaps + outer escape rails) solved with bend-penalized A\*.
  - Cached per-layer obstacle bounds lazily per `Canvas2DSceneGraph` via a
    `WeakMap` and updated `Canvas2DSpatialIndex.syncIncremental` to refresh
    same-layer obstacle-avoiding edges when obstacles move.
- **2D Image runtime cache & Canvas2D / 2D WebGPU drawers (`packages/web/src/2d/image-cache.ts`, `render.ts`, `webgpu.ts`, `2d.ts`)**:
  - Added `CanvasImageStore`, `createMemoryImageStore`, and `Canvas2DImageCache`
    supporting synchronous pre-decoded bitmaps (`HTMLCanvasElement`,
    `ImageBitmap`, `OffscreenCanvas`, `HTMLImageElement`) alongside deduplicated
    async URI decoding (`assetId -> AssetRef.uri` or `props.src`) that triggers
    rAF-coalesced repaint and bumps WebGPU `imageCacheVersion`.
  - Implemented Canvas2D and 2D WebGPU (`drawCalls=1`, atlas stamping + SDF
    rounded stroke + ancestor clip/opacity) rendering for `plugin.denovo.image`.
  - Forwarded `imageStore` and automatic `document.assets` URI extraction in
    `@de-novo/canvas` and `@de-novo/canvas/2d` (`createCanvas` and `loadDocument`).

## Verification

- `pnpm typecheck` — passed (`36/36` tasks).
- `pnpm build` — passed across workspace; zero explicit `any` in generated `.d.ts`.
- `pnpm verify:document-schema` — 48/48 checks passed (including
  `official-denovo-image-parses-without-host-register` and
  `edge-avoid-obstacles-schema-defaults-and-validation`).
- `pnpm verify:public-api` — passed (including `plugin.denovo.image` in
  `listPluginNodeKinds()`, `setImageFit` in `listNamedOperations()`, and
  positive / `@ts-expect-error` consumer fixtures).
- `pnpm verify:editor-core` — passed (including `setImageFit` no-op/update/undo/redo
  and typed error boundaries, plus `edge.avoidObstacles` `node.update` undo/redo).
- `pnpm verify:hit-testing` — 12/12 checks passed (including direct-blocker,
  2×3 screen grid, and narrow-gutter zero-crossing assertions, plus
  `plugin.denovo.image` bounds, picking, and placeholder draw).
- `pnpm verify:webgpu` — 15/15 checks passed, including pixel-verified
  `webgpu-2d-image-and-obstacle-routing` (`drawCalls=1` GPU `readPixels()`) and
  `canvas2d-image-and-obstacle-routing`, with screenshots at
  `artifacts/verification/2d-image-routing-canvas2d.png` and
  `artifacts/verification/2d-image-routing-webgpu.png`.
- `pnpm verify:2d-performance` — all gates passed (`10k-2d-rects` p50 `0.00ms`,
  `10k-2d-webgpu` p50 `0.00ms` / `drawCalls=1` / `210` triangles).
- `pnpm verify:pack-smoke` — 12/12 packages + external unpacked ESM smoke passed.
- `pnpm verify:flow-showcase` — 2/2 passed (desktop + mobile).
- `pnpm verify:network-showcase` — 2/2 passed (desktop + mobile).
- `pnpm verify:docs` — passed (`204` Markdown files, `745/745` local targets, 0 symlinks, 0 conflict markers).

## Compatibility And Migration

- Purely additive official 2D kind (`plugin.denovo.image`) and defaulted edge
  fields (`avoidObstacles: false`, `obstaclePadding: 16`) inside canonical
  schema `0.2.0`; no breaking changes and no schema version bump.

## Residual Risk

- 2D WebGPU currently packs rasterized `plugin.denovo.image` stamps into its
  single `2048 × 2048` atlas (capped to 512px max side per stamp); scenes with
  dozens of simultaneous on-screen high-res screenshots on WebGPU may overflow
  the single atlas and fall back to styled placeholders until multi-page texture
  arrays or per-image bind groups are added. Canvas2D draws unlimited images
  directly with no atlas size cap.
- Linux and Windows GPU environments remain unmeasured locally.

## Next Action

- Consider either: (a) official AI-agent headless inspect/snapshot helper,
  (b) WebGPU multi-page image texture array / zoom-LOD for 1,000-screenshot
  `de-novo/dui` maps, or (c) committing and tagging `v0.1.0` / `v0.2.0`.
