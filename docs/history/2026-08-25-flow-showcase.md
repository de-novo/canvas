# 2026-08-25 Absorbed flow showcase

## Date

2026-08-25

## Scope

First catalog case that passes the
[Product Identity](../product-identity.md) absorption test. Isolated to
`apps/playground-flow`. No schema or facade export change.

## Changes

- Added `@denovo/canvas-flow-example` (`apps/playground-flow`).
- The release board is a `defineDocument` scene: five `html` cards, four
  `edge`s, two `text` labels, `board` and `labels` layers.
- Host `renderNode` builds cards with `createElement`. It does not assign
  `innerHTML`.
- The facade path is `createCanvas` + `createEditor` +
  `connectEditorToCanvas`. Hide/show labels uses `setLayerVisible`.
  `listNodes` fills the panel.
- `pnpm verify:flow-showcase` is the browser gate.

This does not absorb a hero graphic and does not wrap ThreeUI.

## Verification

- `pnpm --filter @denovo/canvas-flow-example typecheck`: passed
- `pnpm --filter @denovo/canvas-flow-example build`: passed
- `pnpm verify:flow-showcase`: passed 2/2
  - desktop: no iframe, five cards, Build hit-tests, hide labels
    (`title.visible === false`, undoDepth 1), undo restores
  - mobile (iPhone 14): no iframe, five cards
- Screenshots:
  `artifacts/verification/flow-release-board.png`,
  `artifacts/verification/flow-release-board-mobile.png`

## Residual risk

- HTML overlay size now follows zoom in the runtime. See
  [2026-08-25 HTML overlay follows zoom](./2026-08-25-html-overlay-zoom.md).
- Overlay cards use `pointer-events: none`. Picking is canvas hit-test,
  not a DOM click on the article.
- Hero showcase landed separately as
  [2026-08-25 absorbed field showcase](./2026-08-25-field-showcase.md).

## Next action

Keep this board as the diagram catalog case. Do not wrap more upstream
rooms. Graph catalog landed separately as
[2026-08-25 absorbed network showcase](./2026-08-25-network-showcase.md).
