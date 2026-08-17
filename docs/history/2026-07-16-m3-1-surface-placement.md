# M3.1 Surface Placement and Stacking Verification

Date: 2026-07-16

## Scope

Record the implementation and final acceptance evidence for the bounded
[M3.1 Surface Placement and Stacking](../m3-1-surface-placement-contract.md)
slice. Current milestone status remains owned by
[Project Status](../project-status.md); this entry is chronological evidence,
not a second status index.

## Changes

- Added strict, renderer-independent `Canvas3DSurfacePointRequest` and
  `Canvas3DSurfacePointResult` schemas. Requests target the explicit 3D box
  node class; hits correlate a node ID, `box` type, finite world point, unit
  world normal, and local `box.face` axis/side. `miss` is a terminal typed
  result, not a request for another placement strategy.
- Added a transient `primitive.ghost` box preview whose schema is derived from
  the canonical box node without persistent identity, layer, hierarchy, or
  metadata fields. Hover and touch previews therefore do not allocate IDs or
  enter the document or history.
- Added the separate `create3DSurfacePlacementTool`. Editor core validates the
  destination layer, current root world-aligned target box, face point,
  feature, normal, and positive source scale; computes the exact box support
  offset; invalidates stale asynchronous work; and allocates one ID only after
  the pointer-up requery succeeds before dispatching one `node.add` command.
- Added canonical unit-box analytic ray intersection in
  `@denovo/canvas-three`. It reports a local box face with an inverse-transpose
  world unit normal and rejects non-finite or singular transforms. The helper
  remains renderer support code and does not own placement or persistence.
- Added the built-in Three/web surface-point capability and ghost rendering.
  The frontmost mapped node decides the result: unsupported geometry returns
  `miss` instead of being skipped for an unrelated box behind it, and a failed
  query never becomes work-plane placement.
- Kept scene-point resolution, preview output, and surface-point resolution as
  independent optional facade capabilities. Custom renderers can implement the
  exact responsibilities they own; malformed capabilities fail validation.
- Added `Stack Box` to the vanilla example. The first accepted product slice is
  box-on-box placement for root, world-aligned targets and world-aligned box
  sources while preserving canonical document schema `0.2.0`.
- Recorded professional CAD/DCC authoring quality as the product north star for
  precision, feedback, predictability, visual clarity, and reliability without
  claiming complete desktop-application feature parity.

## Verification

The complete repository baseline passed:

```sh
pnpm typecheck
pnpm build
pnpm verify:public-api
pnpm verify:document-schema
pnpm verify:editor-core
pnpm verify:hit-testing
pnpm verify:browser-rendering
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-conflicts.py --root .
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-audit.py --root .
```

`pnpm typecheck` passed all 17 tasks and `pnpm build` passed all 11
packages/apps. The vanilla production build retained only its existing
non-blocking large-chunk advisory. Public API and schema verification covered
literal tool-ID inference, negative option fixtures, strict request/result
narrowing, X/Y/Z face hits, unit normals, excess-field rejection, independent
facade capabilities, and zero explicit `any` occurrences across 17 generated
declaration files.

Editor verification covered hover without ID allocation, touch contact,
pointer-up final requery, exact X/Y/Z support offsets, one-command commit,
typed miss with no fallback, invalid normal and rotated-target rejection,
missing capability, runtime replacement, and stale async cleanup. Hit-testing
verification covered analytic unit-box surfaces, parent transforms,
non-uniform and negative scale, and singular or non-finite rejection.

The browser suite passed in fresh desktop mouse and real mobile touch contexts.
Both contexts placed three boxes successively by using each newly committed top
face as the next target, placed a fourth box on the static target's +X face,
rendered the transient ghost before release, and cleared the ghost on empty
space without changing document JSON, node count, or history. The existing
rendering, authoring, runtime-replacement, non-blank-output, and bounded-demand
regression checks also passed.

Documentation governance found no conflict files, symlinks, duplicate phase
claims, schema violations, missing expected paths, or broken local links.

## Residual Risk

- This slice intentionally supports only world-aligned box sources on root,
  world-aligned box targets. Arbitrary meshes, spheres, rotated-source
  alignment, edge/vertex snaps, collision or occupancy solving, automatic
  parenting, and attachment relationships require separate contracts.
- The analytic Three helper can describe more transforms than the first editor
  policy accepts. That extra renderer capability does not silently broaden the
  verified authoring contract.
- Professional CAD/DCC quality is a continuing quality bar. A B-rep/NURBS
  kernel, parametric solver, editable-mesh engine, sculpting, modifiers,
  animation, and compositing remain optional future extensions rather than
  partial base-SDK features.
- The vanilla bundle-size advisory remains M4 performance work, not an M3.1
  correctness failure.

## Next Action

Define M4 performance workloads and measurable acceptance thresholds before
adding batching, culling, LOD, workers, or spatial-query acceleration. Preserve
the verified renderer-independent surface contract while evaluating those
optimizations.
