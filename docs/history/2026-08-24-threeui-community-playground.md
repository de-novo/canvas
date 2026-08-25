# 2026-08-24 ThreeUI Community playground

## Date

2026-08-24

## Scope

Isolated example app that hosts the public ThreeUI Community **Three.js**
catalog rooms. Not a facade, schema, or named-operation change.

## Changes

- Added `apps/playground-threeui`.
- Vendored MIT Community sources under `src/vendor/threeui`.
- Copied self-contained `landscape.html` and `japanese-tower.html` into the
  app public folder.
- Catalog lists 34 public rooms (worlds, landscape variants, towers,
  Structure Flow, Warp Field). Pro variants stay out.

## Verification

- `pnpm --filter @denovo/canvas-threeui-example typecheck` passed.
- `pnpm --filter @denovo/canvas-threeui-example build` passed (102 modules).
- Browser on `127.0.0.1:5179`: Warp Field live canvas; Structure Flow canvas
  1408×951; Temple Night `data-state=ready`; Country Towers Japan iframe
  `japanese-tower.html?country=japan` ready.

## Residual risk

- Vendored renderers pin Three r128 / r149 / r165 and include iframe HTML
  worlds. They are not document nodes.
- Community buttons, CSS, landing pages, and text-animation items were not
  copied. Those are a different host class, not Three.js catalog rooms.
- Large HTML/JS blobs sit in the example app; they are not part of the SDK
  package surface.

## Next action

Warp Field now uses a Denovo document host. Keep remaining rooms as
vendor references until they get the same treatment, one renderer at a
time. Do not export ThreeUI types from `@denovo/canvas`.
