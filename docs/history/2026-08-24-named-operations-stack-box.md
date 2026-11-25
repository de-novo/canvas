# 2026-08-24 Named operations slice 2 (`stackBox`)

## Date

2026-08-24

## Scope

Second named authoring helper. `stackBox` places a same-scale box on a
named face of an existing world-aligned root box. Document-only. No live
surface query. No `listNodes`.

## Changes

- `@de-novo/canvas-editor` and `@de-novo/canvas` export `stackBox`,
  `StackBoxInput`, and `StackBoxFace`.
- Compiles to one `node.add`. `layerId` defaults to the source layer.
  New box copies source `scale` and `color`.
- Face offset uses the M3.1 analytic formula (face center plus half the
  new scale along the face normal).
- Unknown `on` is `node-not-found`. Non-box, rotated, or parented
  sources are `invalid-command`. A 2D document is `mode-mismatch`.
- A stable `createId` that already names a box at that stacked pose
  returns `{ changed: false, commands: [] }` and does not grow history.

## Verification

- `pnpm typecheck`
- `pnpm build`
- `pnpm verify:public-api`
- `pnpm verify:editor-core`
- `pnpm verify:named-operations`

## Residual risk

- Same-scale copy is the only document-only size. A later input for
  explicit scale would be additive.
- Browser proof stacks on vanilla `static-box`, not IFC meshes.

## Next action

Done for slice 2. Slice 3 evidence is in
[2026-08-24 named operations listNodes](./2026-08-24-named-operations-list-nodes.md).
