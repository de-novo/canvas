# 2026-08-25 Absorbed field showcase

## Date

2026-08-25

## Scope

Hero catalog case. ThreeUI Warp Field is restated as one official
`plugin.denovo.field` node. Isolated to `apps/playground-field`.

## Changes

- Official drawer now draws a corridor field: additive streaks or
  D/E/N/O/V letter planes. It reads only `DenovoFieldProps`. No vendor
  file.
- Added `@denovo/canvas-field-example` (`apps/playground-field`).
- The document is `createCanvas` + `defineDocument` with one field
  node. The catalog board shows the actual ThreeUI host + engine
  source next to our document, `setFieldPattern` apply path, and
  official drawer. ThreeUI files are `?raw` text only; they are not
  imported as a runtime.
- Letters / Streaks call `setFieldPattern`. Undo uses editor history.
- `pnpm verify:field-showcase` is the browser gate.

This does not absorb `keycaps` or `hyperspace`. It is not a pixel copy
of ThreeUI. `apps/playground-threeui` still vendors the original room
as a reference.

## Verification

- `pnpm typecheck`: 35/35
- `pnpm build`: 24/24
- `pnpm --filter @denovo/canvas-field-example typecheck`: passed
- `pnpm --filter @denovo/canvas-field-example build`: passed
- `pnpm verify:denovo-field`: 2/2
- `pnpm verify:field-showcase`: passed 2/2
  - desktop: no iframe, `listed.type === plugin.denovo.field`, field
    hit-tests, letters changes pattern and undoDepth 1, undo restores
    streaks, compare board contains `createWarpFieldRenderer` as
    text and live `"pattern": "letters"`
  - mobile (iPhone 14): no iframe, pattern streaks
- Screenshots:
  `artifacts/verification/field-warp-field.png`,
  `artifacts/verification/field-warp-field-mobile.png`

## Residual risk

- Letters are a 5-glyph bitmap, not ThreeUI's atlas.
- The comparison board quotes real ThreeUI files (`WarpFieldBackground`
  + `createWarpFieldRenderer`) as text. That is not a loaded function.
  Line counts are honest: the official drawer is not claimed to be
  shorter shaders.
- Pick uses an invisible volume around the corridor.

## Next action

Do not wrap more ThreeUI rooms. Further hero kinds follow the same
path: schema, our drawer, then a catalog document.
