# Changelog

All notable changes to Denovo Canvas are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and published packages follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-23

Initial public open-source release of Denovo Canvas (`@denovo/canvas` and its
11 modular ecosystem packages).

### Added

- **Lightweight Three.js-free 2D entrypoints across all 4 frameworks**:
  `@denovo/canvas/2d`, `@denovo/canvas/react/2d`, `@denovo/react-canvas/2d`,
  `@denovo/vue-canvas/2d`, `@denovo/svelte-canvas/2d`, and
  `@denovo/solid-canvas/2d`, cutting 2D production bundles by ~81% (`0 B` Three.js).
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
  multi-model IFC BIM federation (`@denovo/canvas-bim`).
- **Open-source CI, benchmarks, demo hub & packaging gates**: GitHub Actions CI
  (`.github/workflows/ci.yml`), external tarball smoke verification
  (`pnpm verify:pack-smoke`), Apache-2.0 `LICENSE` & `NOTICE` in all 12 tarballs,
  reproducible Naive-vs-Denovo comparison benchmarks (`pnpm bench:compare`),
  multilingual EN/KO/ZH-CN docs, interactive demo hub (`bench-2d`, `warehouse`,
  `flow`, `network`, `field` via `pnpm build:pages` / `pnpm verify:pages`),
  GitHub issue templates, and npm provenance release workflow
  (`.github/workflows/release.yml`).
