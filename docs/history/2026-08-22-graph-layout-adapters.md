# 2026-08-22 Graph layout adapters

## Date

2026-08-22

## Scope

`@de-novo/canvas-editor` layout adapters and a playground that switches them.
No schema bump. No new built-in node kind.

## Changes

- `createTimeGraphLayoutAdapter` (`layout.time-graph`) places nodes left to
  right from `options.at`. Nodes without a finite time sit in a trailing
  column.
- `createRelationGraphLayoutAdapter` (`layout.relation-graph`) groups
  connected components and walks BFS layers from the highest-degree node.
  There is no global centre force.
- `canvasScreenPointRadius` converts a world radius into the world radius
  that paints as a clamped screen size. The 2D renderer does not use it yet.
- `apps/playground-graph` (port 5180) switches the same `circle` nodes
  between the two layouts.

This is the first cut of the far-map field that a host such as haru can
adopt later. It does not replace React Flow, and it does not add 3D.

## Verification

- `pnpm --filter @de-novo/canvas-editor build`: passed
- `pnpm verify:editor-core`: passed (`ok: true`, 1/1 reported check;
  time/relation order-independence, axis/BFS coordinates, screen-radius
  clamp, and one-undo restore are sequential assertions inside that
  suite)

## Residual risk

- Screen-space glow is not drawn. Circles still scale with camera zoom.
- Time comes from adapter options, not persisted node fields. A later
  host must keep that map, or a namespaced plugin field must be added.
- Playground-graph is not in the existing browser rendering suite.

## Next action

Superseded: canvas does not own graph presentation. See
[2026-08-22 graph field host presentation](./2026-08-22-graph-field-host-presentation.md).
