# M8 in-browser connector gesture

**Date:** 2026-08-17
**Status:** landed

## Context

M8 contract acceptance still needed a connector gesture in the live
diagram playground, not only `verify:editor-core` with a fake hit tester.

## Changes

`verify:diagram-rendering` now:

- resolves interior hit points on `node-a` / `node-b` (centers can land
  on `edge-2`);
- drives `createConnectorTool` through the live 2D `hitTest` and editor
  in the page;
- asserts one new `edge` (`node-a` → `node-b`, not `routing: "curved"`)
  and one undo;
- repeats that on an iPhone 14 Playwright context.

Trusted `page.mouse` events were not used as the commit path: the host
overlay stack and async tool queue made a raw pointer drag fail to
session. The accepted path is the same `handleToolInput` contract the
DOM bridge uses, against the real runtime.

## Verification

`pnpm verify:diagram-rendering` passed: desktop connector + undo, edge
emphasis, overlay/text probe, edge-follows-source, missing flyTo, then
mobile connector + undo.

## Residual risk

The full vanilla `verify:browser-rendering` M3 suite was not re-run.
M8 is contract-accepted as a diagram layer, not a new v1 identity.

## Next action

Persistence completeness (memory/FS `applyCommands`, undo visibility).
Do not add 2D node kinds to `0.2.0`.
