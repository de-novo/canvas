# 2026-08-24 Named operations slice 3 (`listNodes`)

## Date

2026-08-24

## Scope

Third named authoring helper, and the last of the locked first three.
`listNodes` is a read-only summary so a host button and an agent can
see what is in the document before they call `setLayerVisible` or
`stackBox`.

## Changes

- `@denovo/canvas-editor` and `@denovo/canvas` export `listNodes`,
  `ListedNode`, and `ListNodesOptions`.
- `listNodes(document)` lists every node. `listNodes(document, {
  layerId })` filters. Unknown `layerId` is `layer-not-found`. An empty
  layer returns `[]`.
- `visible` and `locked` use effective state. Geometry arrays stay off
  the return value.
- Playground Level 2 status reads node count and visibility through
  `listNodes`, not by inspecting mesh positions.

## Verification

- `pnpm typecheck`
- `pnpm build`
- `pnpm verify:public-api`
- `pnpm verify:editor-core`
- `pnpm verify:named-operations`

## Residual risk

- Layers themselves are still found by name on `document.scene.layers`.
  This helper lists nodes, not layers.
- Animation stays an explicit later extension. This slice does not add
  time to the document.

## Next action

The first three named operations are closed. Browser proof for
`stackBox` is the vanilla Stack +Y control on `vanilla-3d-demand`.
