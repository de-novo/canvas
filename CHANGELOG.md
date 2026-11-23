# Changelog

All notable changes to Denovo Canvas are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and published packages follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Lightweight Three.js-free 2D entrypoints across all frameworks**:
  `@denovo/canvas/2d`, `@denovo/canvas/react/2d`, `@denovo/react-canvas/2d`,
  `@denovo/vue-canvas/2d`, `@denovo/svelte-canvas/2d`, and
  `@denovo/solid-canvas/2d`, cutting 2D application bundles by ~81%.
- **2D scale optimizations**: uniform-grid `Canvas2DSpatialIndex` with viewport
  culling for rendering, hit-testing, and marquee queries; O(visible) HTML
  overlay virtualization with diffed `renderNode` updates; O(1) cached minimap
  rendering; rAF input burst coalescing; and 2D WebGPU GPU-resident vertex /
  atlas / bind-group caching with spatial culling.
- **TanStack-style fine-grained selectors**: headless `subscribeCanvasSelector`
  and `shallowEqual`, plus React `useCanvasSelector`, Vue `useCanvasSelector`,
  Svelte `createCanvasSelectorStore`, and Solid `useCanvasSelector`.
- **3D performance & stability**: opt-in box and sphere instancing batching
  (`render.batch: true`), BVH raycasting, distance-based sphere LOD, and
  per-runtime Three.js GPU resource caching with safe context disposal.
- **Open-source CI & packaging gates**: GitHub Actions CI
  (`.github/workflows/ci.yml`), external tarball smoke verification
  (`pnpm verify:pack-smoke`), Apache-2.0 `LICENSE` & `NOTICE` distribution in
  every package tarball, GitHub issue templates, and npm provenance release
  workflow (`.github/workflows/release.yml`).
