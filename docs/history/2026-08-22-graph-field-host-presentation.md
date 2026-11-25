# 2026-08-22 Graph field: host owns presentation

## Date

2026-08-22

## Scope

Decision on package responsibility for large 2D point graphs, plus the
first throughput primitive in `@de-novo/canvas-web`.

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

- `pnpm --filter @de-novo/canvas-web build`: passed
- `pnpm --filter @de-novo/canvas-graph-example typecheck`: passed
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

## Throughput follow-up (2026-08-22, same day)

Scale sweep of the shipped per-point renderer in Chromium via
ego-browser (`?points=N`, fit view, GPU-accelerated canvas):

| Points | draw min |
| --- | --- |
| 1k | 0.20 ms |
| 10k | 1.20–1.90 ms |
| 50k | 5.00–7.70 ms |
| 100k | 9.10–11.40 ms |

A colour-batched union-fill variant (one path + one `fill()` per opaque
hex colour) was implemented and measured **~25 % slower** across every
scale (10k 1.90 ms, 50k 7.70 ms, 100k 11.40 ms on the same session):
Skia's per-circle path+fill cycle beats building one giant multi-subpath
path plus `moveTo` separators. The optimization was reverted; per-point
fill stays the shipped strategy and is now pinned by a
`hex-points-draw-per-point` check so it cannot silently change.

Headless Playwright (software GL) is a different environment: 10k
1.10 ms, but 100k at 44.10 ms with 82,800 points on-screen after culling.
Environment-dependent times stay recorded baselines, never gates;
`verify:point-field` now asserts counts at both scales.

Sprite stamping (`drawImage` blits instead of arcs) was considered and
deferred — it changes anti-aliasing fidelity and adds API surface for a
scale the current curve already covers inside one frame budget.

### 100 M-point feasibility probe (2026-08-22, same day)

Question: can the field scale to 100 million points? A standalone WebGL2
probe (`apps/vanilla/webgl-points-ceiling.html`, one `gl.POINTS` draw of
`count` vertices from typed arrays, no culling) measured in
ego-browser/Chromium:

- **Data layer: feasible.** 100M points as `Float32Array` positions +
  `Uint8Array` colours ≈ 0.9–1.1 GB; one-time generation ≈ 1.7 s. No
  GL errors at 100M vertices per draw call.
- **Render ceiling: unresolvable in this environment.** Presented frame
  deltas pinned at ~33 ms (2× vsync) for *every* count including 1M — the
  compositor throttles drawn canvases to 30 fps here, so vertex
  throughput cannot be isolated. Real-GPU Chrome numbers are needed
  before any claim.
- **Canvas2D path: hard no.** Object-array representation dies around
  tens of millions (GC), and linear extrapolation puts 100M draws at
  seconds per frame.

Consequence for the roadmap: "1억 건 보유" is an architecture question,
not a tuning question — it needs a typed-array GPU point-field layer with
viewport culling (draw only what is visible), which is a new contract on
the scale of the deferred WebGPU milestone, not an incremental tweak.

## Next action

Keep measuring 1k / 10k draw cost. Do not add glow, dust, or cluster
labels in this repository.
