# 2026-08-22 Next contract decision: mesh-surface measurements

## Date

2026-08-22

## Scope

Post-milestone planning. With M0–M8 verified, pick the next contract
before new surface work. Decision recorded here; status `Next` points at
it.

## Candidates considered

1. **WebGPU adapter milestone** — deferred. The backend vocabulary is
   reserved and `auto` correctly never selects it, but a full second
   renderer is months of work and its verification story in headless CI
   is unsolved. No consumer driver yet.
2. **Pinned-environment frame budget gate** — deferred. Closes the M4
   recorded descope cheaply, but a gate only protects when the reference
   environment is genuinely pinned (hardware + browser build + flags).
   This repository currently measures on one developer machine; today's
   point-field sweep showed environment swings of 4× (GPU canvas 9–11 ms
   vs headless software GL 44 ms for 100k points). Gate first, budget
   later once such an environment exists.
3. **Mesh-surface-picked measurement endpoints (M3.1 extension)** —
   **selected**.

## Why mesh-surface picking

- Highest product value per effort: it upgrades BIM/CAD-adjacent
  measuring from work-plane approximation to real surface endpoints,
  directly serving the v1 north star (embedded editing engine quality).
- It is an additive extension of the verified M3.1 vocabulary:
  `Canvas3DSurfacePointRequestSchema` gains a correlated `mesh` variant
  beside `box` (raycast against stored geometry → world point + unit
  normal), so no verified behaviour reopens.
- It builds on what landed today: worker-tessellated BIM meshes already
  live in `CanvasGeometryStore`, and the placement/measurement tooling is
  capability-driven.

## Scope sketch (for the implementing slice)

- Core: schema variant + correlated patch/update identity for `mesh`
  targets.
- Web/Three: analytic-free raycast resolution against the resolved mesh
  geometry with unit-normal output; reuse BVH preparation.
- Editor: extend `create3DSurfacePlacementTool`-style support to
  measurement endpoint capture on meshes.
- Verification: editor-core fixtures plus desktop/mobile browser proof on
  an imported IFC model; generated-declaration audit for the new variant.

## Next action

Implement the mesh variant as the next contract slice under an
M3.1-extension label, with its own acceptance criteria before any
milestone-style verification claim.
