# M7 BIM Extension — web-ifc-first slice

**Date:** 2026-07-22  
**Status:** ✅ web-ifc-first slice complete; worker/section-plane deferred

## Overview

The first real BIM support in Denovo Canvas. IFC elements become first-class
`mesh` nodes in the serializable `CanvasScene` document (not an opaque blob),
parsed by a new `WebIfcBimAdapter`. web-ifc (MPL-2.0) is the parser; xeokit
(AGPL) is deliberately excluded. Scope is bounded to ≤5000 elements,
main-thread parsing for the first cut.

## The architectural decision

A `CanvasScene` is a strict zod-validated JSON document. IFC files are tens of
thousands of triangle-mesh elements. Rather than introduce a parallel "bim
model" node type that would bypass selection, layering, isolation, and
measurement, **IFC elements are emitted as ordinary `mesh` nodes** — one per
element, grouped by IFC-type layer, with provenance on `node.metadata`. This
inherits every editor primitive for free at the cost of a per-scene element
cap (5000 by default) that bounds JSON size.

## What landed

### Phase 1 — `mesh` node foundation (core + renderers)

- **`MeshNodeSchema`** in `@denovo/canvas-core` (flat `positions`/`indices` +
  optional `normals`/`uvs` + `wireframe`), registered in `Canvas3DNodeSchema`,
  `Canvas3DNodeTypeSchema`, and the legacy migration union. `Canvas3DNode` /
  `Canvas3DNodeType` widen automatically.
- Every compile-forced `node.type` switch closed: `createObject`
  (`packages/web/src/3d.ts` — builds a `BufferGeometry`, `computeVertexNormals`
  when normals absent, `prepareGeometryBounds` for BVH picking, cached material,
  optional wireframe clone), `renderSceneNode` (`packages/react/src/index.tsx` —
  a new `MeshNode` component with `useMemo`-cached typed arrays), plus the
  `isCanvas*Node` guards, `Canvas3DTransformNode` Extract widening,
  `isCanvas3DTransformNode`, and `create3DUngroupPatch` in the editor. The
  vanilla example's demo switch gained a `mesh` case too.
- `verify:document-schema` extended with a mesh-node fixture round-trip.

### Phase 2 — `WebIfcBimAdapter` (`@denovo/canvas-bim/web-ifc`)

- New opt-in **`./web-ifc`** subpath. The `.` contract entry (`BimAdapter`,
  `BimModelSource`, `BimModelMetadata`, plus new `WebIfcWasmConfig`,
  `BimElementMetadata`, `BIM_METADATA_KEY`) stays **free of any `web-ifc`
  import** — verified by `verify:public-api` (greps the built `dist/index.js`).
- `WebIfcBimAdapter` (`packages/bim/src/web-ifc-adapter.ts`):
  - lazy idempotent `IfcAPI.Init()` (shared across instances, WASM resolved via
    `WebIfcWasmConfig` — base URL, precompiled module, or `locateFile`),
  - `loadModel` opens with `COORDINATE_TO_ORIGIN: true` and counts elements,
  - `toScene` streams `LoadAllGeometry`, merges each element's placed geometry
    parts (baking the web-ifc 4×4 `flatTransformation` into vertices), maps IFC
    type → layer via `resolveIfcCategory` (`ifc-categories.ts`, data-only so the
    contract entry stays dep-free), and stores `{ ifcGuid, ifcType, ifcName,
    expressID }` under `node.metadata.__bim`.
- web-ifc is an **optional peer dep** (`peerDependenciesMeta`) + a devDep for
  typecheck + `--external web-ifc` in tsup — mirroring the `@denovo/canvas`
  optional-peer precedent.

### Phase 4 — example app + smoke verification

- `apps/playground-bim` loads `public/sample.ifc` (engine_web-ifc's
  `example.ifc`, MPL-2.0) through the adapter and renders it with the editor
  (select + pan-orbit tools). `copy:wasm` copies `node_modules/web-ifc/*.wasm`
  into `public/wasm/` on dev/build.
- `verify:bim-rendering` (and the `Bim` target in
  `verify-browser-rendering-adapters.mjs`) confirms a **non-blank canvas** (37
  distinct colors) after WASM init + IFC parse, survives resize, and emits no
  console/page errors. Generous 90s canvas-wait for the WASM/parse cost.

## Verification

```
✅ Bim: rendered 37 colors initially, survived resize + scene swap, no errors
All adapter smoke checks passed.
```

- `pnpm typecheck` — **29/29** packages (incl. `@denovo/canvas-bim`,
  `@denovo/canvas-bim-example`).
- `pnpm build` — **19/19**.
- `pnpm verify:document-schema` — mesh node round-trips through the schema and
  the legacy migration union.
- `pnpm verify:public-api` — `ok: true`; asserts the bim `.` entry never
  imports web-ifc and `./web-ifc` does.
- `pnpm verify:bim-rendering` — IFC parses and paints in a real browser.

## Acceptance criteria (M7)

| Deliverable | Status | Notes |
|---|---|---|
| web-ifc parser adapter | ✅ | `WebIfcBimAdapter` |
| IFC metadata contract | ✅ (psets deferred) | `BimElementMetadata` on `node.metadata.__bim`; lazy psets later |
| object isolation/hide/show | ✅ (no new code) | `mesh` nodes inherit `node.update{visible}` / `layer.update{visible}` + the `getEffectiveNodeState` cascade |
| measurement tools | ✅ (reused) | `createDistanceMeasurementTool` picks on mesh BVH |
| section plane | ⏸ deferred | needs `clipPlanes` on `RenderOptionsSchema` + renderer wiring |
| worker-based parsing | ⏸ deferred | worker package is RPC-shell-only; promote after real-IFC validation |

## Out of scope (follow-ups)

Worker parsing (Phase 3 sketch in the plan), section planes, eager
property-set loading, geometry merge-by-material / LOD, lifting the 5000-element
cap, and any xeokit/AGPL path.

## Files added/changed

- `packages/core/src/index.ts` — `MeshNodeSchema`, `LegacyMeshNodeSchema`, union
  registration, `isCanvas{2D,3D}Node` mesh cases.
- `packages/web/src/3d.ts` — `BufferAttribute` import, `Canvas3DTransformNode`
  widening, `isCanvas3DTransformNode` + `createObject` mesh branches.
- `packages/react/src/index.tsx` — `renderSceneNode` mesh case + `MeshNode`.
- `packages/editor/src/index.ts` — `create3DUngroupPatch` mesh case.
- `packages/bim/{package.json, src/index.ts, src/web-ifc-adapter.ts (new), src/ifc-categories.ts (new)}`.
- `apps/playground-bim/**` (new) + `apps/vanilla/src/main.ts` (mesh demo case).
- `scripts/verify-browser-rendering-adapters.mjs` (Bim target, `canvasWaitMs`,
  `ADAPTER_ONLY`), `scripts/verify-document-schema.mjs` (mesh fixture),
- `scripts/verify-public-api.mjs` (bim separation assertions).
