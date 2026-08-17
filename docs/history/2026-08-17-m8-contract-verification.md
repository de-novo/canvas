# M8 contract wiring and verification

**Date:** 2026-08-17
**Status:** landed (contract checks ran; milestone not yet accepted)

## Context

The [M8 Diagram Contract](../m8-diagram-contract.md) froze `0.2.0`
`edge`/`text`/`html` and forbade new writes of `routing: "curved"`. This
change implements the write helper and the named verification.

## Changes

- `define2DEdge()` accepts `routing: "straight" | "orthogonal"` only.
  Stored documents may still parse `routing: "curved"`; geometry treats
  that value as a straight segment.
- `createConnectorTool` commits through `define2DEdge` with
  `routing: "straight"`. Quadratic style is `curve` + `curveOffset`.
- Diagram playground mounts a host HTML card and a string-rendered
  `text-probe` so overlay markup vs `textContent` can be distinguished.
- Verification: schema write/legacy/update, connector one-commit/undo,
  orthogonal vs quadratic vs ignored `routing: "curved"` geometry,
  `define2DEdge` negative fixture, diagram browser overlay + edge-follow
  + missing `flyToNode`.

## Verification

- `pnpm typecheck` — 30/30
- `pnpm verify:document-schema` — ok, including
  `define2DEdge-writes-straight-or-orthogonal-and-parses-legacy-curved`
  and `m8-node-update-roundtrips-edge-text-html`
- `pnpm verify:editor-core` — ok, including connector commit
- `pnpm verify:hit-testing` — ok, including edge path resolution
- `pnpm verify:public-api` — ok
- `pnpm verify:diagram-rendering` — ok (desktop + iPhone 14 viewports)

## Residual risk

M8 is not a verified milestone. Connector authoring is proven in
editor-core, not as a real pointer gesture in the playground. `routing:
"curved"` remains readable.

## Next action

Stop adding 2D node kinds. Optional: an in-browser connector gesture if
we want to accept M8. LICENSE remains deferred to release.
