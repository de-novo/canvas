# 2026-08-22 Graph field: host owns presentation

## Date

2026-08-22

## Scope

Decision on package responsibility for large 2D point graphs, plus the
first throughput primitive in `@denovo/canvas-web`.

## Changes

- Canvas does **not** ship a nebula / Galaxy Nodes / cluster-label UI.
  Those belong to the host. Canvas owns layout adapters, screen-size
  clamp, culling, and a counted draw of packed points.
- `renderCanvas2DPointField` draws points in screen pixels. Size is
  clamped to 4–14 CSS pixels. Colour and stroke are caller-supplied.
- `apps/playground-graph?points=10000` is a throughput bench, not a
  product look. The default 10-node page stays a layout proof.

10k is a working-set target, not a demo: a team using agents at ~300
tickets per person per sprint reaches that count in a quarter.

## Verification

- `pnpm --filter @denovo/canvas-web build`: passed
- `pnpm --filter @denovo/canvas-graph-example typecheck`: passed
- `pnpm verify:point-field`: **5/5** passed (2026-08-22)
  - screen size clamp 4 / 8 / 14
  - on-screen draw, off-screen cull, edge count
  - browser 10k: `draw min 1.30ms`, `drawn 10000/10000` (Playwright,
    this machine; baseline, not a frame-budget gate)

## Residual risk

- The 10k path is a host overlay, not 10k document `circle` nodes. A
  later persistence story still needs a plugin field or a host-owned
  buffer.
- No frame-budget gate yet. First number is a baseline, like M4.

## Next action

Keep measuring 1k / 10k draw cost. Do not add glow, dust, or cluster
labels in this repository.
