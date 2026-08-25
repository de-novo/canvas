# 2026-08-25 Official denovo sparkline

## Date

2026-08-25

## Scope

Official 2D kind `plugin.denovo.sparkline`: closed props, our drawer,
and `setSparklineStyle`. No new playground.

## Changes

- The kind is pre-registered in `0.2.0` as `mode: "2d"`. Hosts do not
  register it. A 3D scene rejects it.
- `props` are closed: `style` is `linear` | `step`; `values` is 2–64
  finite numbers; `width` 16–1024; `height` 8–512; `stroke` is
  lowercase `#rrggbb`; `fill` is that hex or `none`.
- `denovoSparklinePoints` is the single polyline. The 2D drawer
  strokes that path. Bounds use `width` / `height`, not the 48×48
  marker.
- `setSparklineStyle({ nodeId, style })` compiles to `node.update`.
- Vanilla `sparkline-bench.html` is a verify host, not a catalog.

## Verification

Ran 2026-08-25:

- `pnpm typecheck` — 36/36
- `pnpm build` — 25/25
- `pnpm verify:public-api` — `public-api-suite` ok, including
  `DenovoSparklineProps` and `@ts-expect-error` on `"spline"`
- `pnpm verify:document-schema` — 44 checks, including
  `official-denovo-sparkline-parses-without-host-register`
- `pnpm verify:hit-testing` — ok, including sparkline bounds
  `[10, 20]–[250, 100]`
- `pnpm verify:editor-core` — ok, including `setSparklineStyle`
  already-in-state and unknown id
- `pnpm verify:denovo-sparkline` — 2/2: points follow style; bench
  paints stroke pixels, not the marker; `setSparklineStyle` + undo
- `pnpm verify:docs` — 148 Markdown files, 481/481 local targets

## Residual risk

- No catalog app. Proof is the bench and contract gates.
- Other 2D plugin kinds still draw as the marker.

## Next action

Do not invent another official kind without a sayable property set.
Do not wrap ThreeUI. Do not add a playground for this kind.
