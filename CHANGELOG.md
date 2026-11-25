# Changelog

All notable changes to Denovo Canvas are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and published packages follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-11-25

npm scope rename to `@de-novo/*` (GitHub org-aligned; `@denovo` is owned by a
third party on npm) plus the three landed `v0.2` 2D product slices.

### Changed

- **Published package scope**: all 12 packages move from provisional
  `@denovo/*` names to `@de-novo/*`
  (`@de-novo/canvas`, `@de-novo/canvas-core`, `@de-novo/canvas-editor`,
  `@de-novo/canvas-web`, `@de-novo/canvas-three`, `@de-novo/react-canvas`,
  `@de-novo/vue-canvas`, `@de-novo/svelte-canvas`, `@de-novo/solid-canvas`,
  `@de-novo/canvas-server`, `@de-novo/canvas-worker`, `@de-novo/canvas-bim`).
  Official kind IDs (`plugin.denovo.*`) are unchanged.
- Consumer migration: replace `@denovo/` with `@de-novo/` in imports and
  dependency declarations. Facade exports, document schema `0.2.0`, and
  Named Operation names stay compatible.

### Added

- **2D UI style primitives** (backwards-compatible schema defaults):
  `cornerRadius`, `stroke`, `strokeWidth`, `opacity` on `rect`/`circle`;
  `clip`, `opacity` on 2D `group`. Single-drawCall 2D WebGPU SDF rendering.
- **DevTools-style inspection overlays**: `computeCanvas2DRedlines`,
  `resolveCanvas2DBoxModelRegions`, `runtime.current.setInspectionOverlay`.
- **Obstacle-free gutter orthogonal edge routing**: `edge.avoidObstacles`,
  `edge.obstaclePadding`, pure
  `resolveCanvas2DObstacleFreeOrthogonalWaypoints`.
- **Official 2D image kind** `plugin.denovo.image` with `AssetRef`
  `type: "image"` validation, `createImageAssetRef`, `createMemoryImageStore`,
  and `setImageFit` Named Operation (23 total).
- **Multi-page 2D WebGPU atlas + zoom LOD**: `texture_2d_array` (up to 8
  `2048×2048` pages) with octave-quantized image LOD while keeping
  `drawCalls=1`.
- **Agent inspect/snapshot utilities**: `inspectCanvas2DRuntime`,
  `captureCanvas2DSnapshot`, `summarizeCanvasImageData`.
- **UI Screen Map Pages demo** (`apps/playground-flow/ui-map.html`) on the
  GitHub Pages hub.

## [0.1.0] - 2026-11-23

Initial open-source cut of Denovo Canvas (provisional `@denovo/*` package
names in-repo; never published under that npm scope). Superseded for npm by
`0.2.0` under `@de-novo/*`.

### Added

- **Lightweight Three.js-free 2D entrypoints across all 4 frameworks**:
  `@de-novo/canvas/2d`, `@de-novo/canvas/react/2d`, `@de-novo/react-canvas/2d`,
  `@de-novo/vue-canvas/2d`, `@de-novo/svelte-canvas/2d`, and
  `@de-novo/solid-canvas/2d`, cutting 2D production bundles by ~81% (`0 B` Three.js).
- **One-line `editor` mounting DX**: `createCanvas(target, { editor })` plus
  `editor` prop parity across React (`CanvasView`, `Canvas2DView`), Vue
  (`DenovoCanvas`, `DenovoCanvas2D`), Svelte (`DenovoCanvas`, `DenovoCanvas2D`),
  and Solid (`DenovoCanvas`, `DenovoCanvas2D`) with automatic `ready` wiring
  and unmount/destroy cleanup.
- **2D scale optimizations**: uniform-grid `Canvas2DSpatialIndex` with O(k)
  incremental edit sync, viewport culling for rendering, hit-testing, and
  marquee queries, O(visible) smart snap guides (`computeCanvas2DSnapGuides` /
  `runtime.current.computeSnapGuides` / `runtime.current.setSnapGuides`),
  multi-node 2D layout Named Operations (`alignNodes`, `distributeNodes` — 22
  total Named Operations), O(visible) HTML overlay virtualization with diffed
  `renderNode`, O(1) cached minimap rendering, rAF input burst coalescing, and
  2D WebGPU GPU-resident vertex / atlas / bind-group caching with spatial culling.
- **Incremental validation & O(k) edit pipeline**: `WeakSet` frozen-validated
  scene/document/node fast paths and incremental per-node validation in
  `defineScene` / `defineDocument`, indexed `freezeValue`, `WeakMap` node-state
  caches, and incremental 2D `rebuildObjects` (10k `editor.apply` `79.3 ms` →
  `4.05 ms`, 10k `runtime.update()` `51.8 ms` → `5.6–7.9 ms`).
- **TanStack-style fine-grained selectors**: headless `subscribeCanvasSelector`
  and `shallowEqual`, plus React `useCanvasSelector`, Vue `useCanvasSelector`,
  Svelte `createCanvasSelectorStore`, and Solid `useCanvasSelector` (0 spurious
  re-renders across 100 hover transitions).
- **3D multi-color single-drawCall instancing & digital-twin performance**:
  opt-in `render.batch: true` collapsing all top-level visible `box` / `sphere`
  nodes across all colors into single `InstancedMesh` batches (`instanceColor`
  + in-place `setColorAt` / `setMatrixAt` updates), BVH raycast picking,
  distance-based sphere LOD, per-runtime GPU resource cache, WebGPU/WebGL2
  `auto` backend resolution, Web Worker conversion, chunk streaming, and
  multi-model IFC BIM federation (`@de-novo/canvas-bim`).
- **Open-source CI, benchmarks, demo hub & packaging gates**: GitHub Actions CI
  (`.github/workflows/ci.yml`), external tarball smoke verification
  (`pnpm verify:pack-smoke`), Apache-2.0 `LICENSE` & `NOTICE` in all 12 tarballs,
  reproducible Naive-vs-Denovo comparison benchmarks (`pnpm bench:compare`),
  multilingual EN/KO/ZH-CN docs, interactive demo hub (`bench-2d`, `warehouse`,
  `flow`, `network`, `field` via `pnpm build:pages` / `pnpm verify:pages`),
  GitHub issue templates, and npm provenance release workflow
  (`.github/workflows/release.yml`).

[Unreleased]: https://github.com/de-novo/canvas/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/de-novo/canvas/releases/tag/v0.2.0
[0.1.0]: https://github.com/de-novo/canvas/releases/tag/v0.1.0
