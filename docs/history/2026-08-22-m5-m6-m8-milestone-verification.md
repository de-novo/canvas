# 2026-08-22 M5, M6, and M8 milestone verification

## Date

2026-08-22

## Scope

Milestone verification for the landed-but-unverified slices of M5 (framework
adapters), M6 (persistence), and M8 (diagram layer). M4 and M7 remain
landed-but-unverified with explicit gaps (see Residual risk).

## Changes

- `scripts/verify-editor-core.mjs`: added the missing M8 contract fixture —
  ungroup of a grouped `html` child bakes the group's 2D transform into the
  child, mirroring the existing `text` fixture.
- `scripts/verify-server.mjs`: added an IndexedDB adapter section running on
  `fake-indexeddb` (new root devDependency), because the browser adapter was
  the one M6 storage surface without automated coverage. It now proves:
  missing-document load returns `null`, save bumps revision, stale
  `baseRevision` conflicts, `applyCommands` parity + stale detection,
  list/delete round-trip, and geometry blob upload/hydrate through the
  IndexedDB asset store.

No runtime package code changed in this pass; the changes are verification
coverage plus the earlier same-day adapter facade mount
([2026-08-22 adapter facade mount](./2026-08-22-adapter-facade-mount.md)).

## Verification

M8 acceptance gate (per [M8 Diagram Contract](../m8-diagram-contract.md)):

- `pnpm verify:document-schema`: passed — 39 checks including edge
  endpoint/same-layer/port validation and
  `m8-node-update-roundtrips-edge-text-html`.
- `pnpm verify:editor-core`: passed — connector gesture commits one
  `node.add`/one history entry, incident-edge delete undoes once, paste
  remaps parent + edge ids and undoes once, ungroup bakes `text` **and**
  `html` transforms.
- `pnpm verify:diagram-rendering`: passed — desktop and mobile live
  connector gestures (one undo each), overlay card + textContent probe
  (string `renderNode` never parsed as markup), edge follows dragged
  source, missing `flyToNode` stays put.

M6 acceptance gate:

- `pnpm verify:server`: passed — now 36 assertions including the six new
  IndexedDB checks; memory/filesystem/server OCC, undo/redo persistence,
  and geometry blob persistence re-confirmed.
- Deterministic migration: `parseDocument-migrates-0.1.0-deterministically-
  to-canonical-0.2.0` in the schema suite.

M5 acceptance gate:

- `pnpm verify:browser-rendering-adapters`: passed for React, Vue, Svelte,
  Solid (render, resize, 3d→2d swap, no console/page errors) after the
  facade mount; adapters are independently versioned workspace packages and
  own no document semantics.

Also re-ran: `pnpm verify:hit-testing` (passed; previously last run
2026-08-17).

## Result

- **M5 verified**, **M6 verified**, **M8 verified** (contract-accepted on
  2026-08-17; acceptance suites re-run green on 2026-08-22).
- **M4 not verified**: batching/BVH/diff-apply are landed and measured, but
  LOD controls, chunk loading, worker task queue, OffscreenCanvas capability
  check, and a 16 ms budget decision remain open deliverables.
- **M7 not verified**: worker-based parsing flow, section plane, BIM
  measurement tools, and IFC metadata/property tree contract remain open;
  current importer is a view-scale sample.

## Residual risk

- The IndexedDB suite runs against `fake-indexeddb`, not a real browser
  engine; the vanilla demo exercises the real path manually.
- Diagram browser checks cover the contract's listed behaviors, not an
  exhaustive UI matrix.
- M4/M7 gaps are product-scope decisions, not test failures.

## Next action

Decide M4 scope: either implement the remaining performance deliverables
(workers, LOD/chunks, 16 ms budget) or record a formal descope. Same for M7
(section plane, measurements, worker parsing) before either milestone can be
verified.
