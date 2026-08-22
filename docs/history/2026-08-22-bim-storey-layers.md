# 2026-08-22 BIM storey layers (spatial hierarchy)

## Date

2026-08-22

## Scope

B-item ① of the recorded residual risks: the web-ifc importer flattened
`IfcSite` / `IfcBuilding` / `IfcBuildingStorey` into peer category layers,
so level navigation and isolation could not be expressed.

## Design decision

The document schema enforces same-layer parenting ("Parent node must be in
layer …"), so structure groups on a separate layer are impossible without a
contract change. Instead the importer now maps **layers to building
storeys** — the BIM-conventional organisation:

- one layer per `IfcBuildingStorey`, id `ifc-storey-{expressID}`, display
  name from the entity `Name` (e.g. `"Level 1"`), falling back to
  `Storey N`;
- contained elements (`IfcRelContainedInSpatialStructure`) get that
  storey's layer instead of their category layer;
- categories remain on `metadata.__bim.ifcType` and node colours, so
  nothing is lost;
- elements without spatial containment keep their category layer;
- site/building aggregates are not modelled (no geometry, no per-level
  behaviour) — revisit only if a host needs them.

Layer visibility is the editor's native isolation vocabulary, so storey
isolation works through ordinary `layer.update` commands with no new API.

## Changes

- `packages/bim/src/web-ifc-parse.ts`: `buildSpatialHierarchy()` walks
  storeys + containment; `assembleBimDocument()` registers storey layers.
- Playground BIM: "Measure surface" flow unchanged; verification/demo
  handle `window.__bimEditor` exposed for tooling.

## Verification

- `pnpm verify:bim-worker`: sample.ifc yields **2 storey layers ("Level 1",
  "Level 2")** and **115/115** mesh nodes placed on storey layers; property
  sets and maxElements checks unchanged.
- Browser proof via ego-browser on playground-bim:
  `artifacts/verification/bim-storey-isolation.png` — after
  `layer.update { visible: false }` on Level 2, only ground-floor slab,
  wall framing, and posts render; roof trusses and upper floor disappear.
- `pnpm verify:bim-rendering`, typecheck: green.

## Residual risk

- Category filtering is metadata-based for imported models (no category
  layers when storeys exist); hosts filter by `__bim.ifcType` until a
  filter UI contract exists.
- Site/building aggregation is not represented; multi-storey ordering uses
  document order, not elevation.

## Next action

Remaining B items in order: instanced-node surface points, then BIM
multi-model federation.
