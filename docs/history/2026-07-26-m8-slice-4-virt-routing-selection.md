# M8 Diagram Layer — Slice 4: DOM Virtualization + Port Routing + Selection

**Date:** 2026-07-26  
**Status:** ✅ Code complete (browser smoke blocked by env)

## Context

Closes out the remaining M8 gaps: viewport-culled DOM-overlay rendering, named-port +
orthogonal edge routing, and selection-aware rendering (editor → runtime channel).

## What landed

### Phase 1 — DOM-overlay virtualization
- `syncOverlayElements` (`packages/web/src/2d.ts:~602`) now culls `html` nodes against
  `getCanvas2DVisibleBounds` + `isPointInsideRectangle`: off-screen nodes get
  `display: none`; on-screen nodes are repositioned via `sceneToCanvasPoint`.
  `renderNode` is now only invoked on the "became visible" path (in `rebuildObjects`
  / `syncOverlayElements`), not on every update.
- `Canvas2DRenderNodeContext` (`types.ts:86`) gained an optional `selected?`.

### Phase 2 — Named-port + orthogonal routing
- `Canvas2DEdgeNodeSchema` (`packages/core/src/index.ts:~191`) gained
  `sourcePort?`/`targetPort?: NodeIdSchema` and
  `routing: "straight"|"curved"|"orthogonal"`. `LegacyCanvas2DEdgeNodeSchema`
  mirrors it.
- `renderCanvas2DEdgeNode` (`2d.ts:~1796`) resolves endpoints via a new
  `resolveCanvas2DEdgeEndpoint` (which honors `sourcePort`/`targetPort` if set).
  `routing: "orthogonal"` produces a single-bend path; arrowheads derive from the
  final segment. `hitTestCanvas2DEdgeNode` tests per segment.

### Phase 3 — Selection-aware rendering
- Editor's `connectEditorToRuntime` (`packages/editor/src/editor.ts:~941`) now
  subscribes to selection changes and pushes them via a new
  `Canvas2DViewportRuntime.setSelection`.
- Runtime stores `selectionIds` and re-renders. `renderCanvas2DEdgeNode` accepts a
  `selected` flag (accent stroke reserved for future).

## Verification
- `pnpm typecheck` → **30/30**.
- `pnpm build` → playground only failed on `next/font` Google Fonts fetch
  (environment); all other packages build.
- `pnpm verify:public-api` → `ok: true`.
- `pnpm verify:document-schema` → `ok: true`.
- `pnpm verify:diagram-rendering` → blocked by Chromium launch failure
  (`MachPortRendezvous ... unknown error code (141)`) in this environment — not a
  code defect; re-run in a fresh shell to confirm.

## Files
- `packages/core/src/index.ts`, `packages/editor/src/{editor.ts, index.ts}`,
  `packages/web/src/{2d.ts, types.ts}`, `apps/playground-diagram/**`.

## Deferred
- SVG/image export, edge hover, auto-layout routing, per-port anchors (already
  modeled but no UX).
