# 2026-08-22 mesh surface points (M3.1 extension)

## Date

2026-08-22

## Scope

The next-contract slice chosen after M0–M8 verification
([2026-08-22 next contract decision](./2026-08-22-next-contract-decision.md)):
`resolveSurfacePoint` now supports `mesh` targets beside `box`, so BIM/CAD
workflows can pick real tessellated surfaces instead of work planes.

## Changes

### Core

- `Canvas3DSurfacePointRequestSchema.target.nodeType` widens from the
  `"box"` literal to `"box" | "mesh"`.
- New correlated result arm: a `mesh` hit carries
  `{ kind: "mesh.triangle", triangleIndex }` — integer, geometry-triangle
  scoped — plus world point and unit normal. The result schema moved from
  `discriminatedUnion("kind")` to a plain union of three strict shapes
  (`miss`, box hit, mesh hit); TS narrowing behaviour for consumers is
  unchanged.
- Requesting one node type never returns a hit for another; unsupported
  frontmost nodes still yield `miss`.

### Web/Three

- The Three.js resolver's mesh branch consumes the raycast intersection
  directly: world point from `intersection.point`, normal transformed by
  the object's normal matrix and normalized (schema re-enforces unit
  length), triangle index from `faceIndex` with explicit failure when no
  triangle resolves. Box requests keep the analytic path unchanged;
  preallocated scratch objects avoid per-call allocation.
- `intersectThreeUnitBoxSurface`'s return type now narrows to the box hit
  arm.

### Editor

- The surface-placement tool narrows runtime hits to the box arm before
  use with an explicit typed rejection (it only ever requests box
  targets). No verified placement behaviour changed.

## Verification

- New check `surface-point-protocol-accepts-correlated-mesh-hits` in
  `verify:document-schema`: valid mesh request/hit round-trips including a
  non-axis-aligned unit normal; rejects cross-nodeType features, negative,
  fractional, NaN triangle indices, non-unit normals.
- Contract-smoke TS fixtures updated: request `nodeType` is the widened
  union, runtime mock returns per-target arms, result narrowing handles
  both arms via `nodeType`.
- Public-api typed fixtures extended with mesh narrowing
  (`feature.triangleIndex`) and the widened request target type.
- New `pnpm verify:mesh-surface`
  (`scripts/verify-mesh-surface.mjs` + `apps/vanilla/mesh-surface-bench.html`):
  browser proof through the facade — centre ray on an imported quad mesh
  yields a correlated `mesh.triangle` hit whose normal is unit and
  camera-facing, the point lies on the quad, and a corner ray misses.
- Full regression: typecheck, build, editor-core, hit-testing,
  document-schema, public-api all green.

## Residual risk

- Editor measurement/placement tools do not yet *capture* endpoints on
  meshes — hosts can resolve mesh surface points today, but tool-level
  endpoint capture (measurement on real BIM surfaces) is the follow-up
  slice inside this contract.
- Instanced nodes are not mesh targets (different node type) and return
  `miss` by the correlation rule; instanced-surface support would be its
  own extension.
- `triangleIndex` is scoped to the geometry's triangle order; geometry
  edits reorder indices by design.

## Next action

Tool-level measurement endpoint capture on mesh surfaces (the original
motivating workflow), then fold this slice into the next milestone-style
verification pass.
