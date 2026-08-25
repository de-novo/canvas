# 2026-08-25 Absorbed network showcase

## Date

2026-08-25

## Scope

Graph catalog case. A service dependency map is restated as one Denovo
document of `html` cards, `edge`s, and `text` labels. Isolated to
`apps/playground-network`. No schema version change.

## Changes

- Added `@denovo/canvas-network-example` (`apps/playground-network`).
- The document is `createCanvas` + `defineDocument` with nine services,
  seven edges, and a labels layer. Host chrome builds cards with
  `createElement`. It does not assign `innerHTML`.
- Relation / Time call `editor.applyLayout` with the facade-exported
  graph adapters. Hide labels uses `setLayerVisible`. Undo uses editor
  history.
- `createRelationGraphLayoutAdapter` and
  `createTimeGraphLayoutAdapter` are facade exports so the catalog stays
  on `@denovo/canvas`.
- `pnpm verify:network-showcase` is the browser gate.

This does not wrap ThreeUI. `apps/playground-graph` stays the throughput
bench: empty `nodes` plus a point-field overlay. That bench is not this
catalog.

## Verification

- `pnpm typecheck`: 36/36
- `pnpm build`: 25/25
- `pnpm --filter @denovo/canvas-network-example typecheck`: passed
- `pnpm --filter @denovo/canvas-network-example build`: passed
- `pnpm verify:public-api`: ok
- `pnpm verify:network-showcase`: passed 2/2
  - desktop: no iframe, no point-field overlay, nine cards,
    `listed.type === html` for `api`, hub hit-tests, relation layout
    moves `[80, 168]`, undo restores it
  - mobile (iPhone 14): no iframe, nine cards
- Screenshots:
  `artifacts/verification/network-service-map.png`,
  `network-service-map-mobile.png`
- `pnpm verify:docs`: 132 Markdown files, 437/437 local targets

## Residual risk

- Layout options such as `at` are apply-time input, not node properties.
  After layout, positions live in the document.
- HTML overlay size now follows zoom in the runtime. See
  [2026-08-25 HTML overlay follows zoom](./2026-08-25-html-overlay-zoom.md).
- Warehouse is an isolated component on purpose, so relation layout
  keeps two clusters.

## Next action

Do not wrap ThreeUI rooms. Further catalog cases stay on existing kinds
or a new official plugin kind with our drawer.
