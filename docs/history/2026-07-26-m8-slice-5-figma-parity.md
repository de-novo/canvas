# M8 Diagram Layer — Slice 5: Figma / React-Flow Parity

**Date:** 2026-07-26
**Status:** ✅ Complete (browser-verified)

## Context

A parity review found the 2D runtime had clean architecture but was missing most
of the daily-driver UX that React Flow ships with and Figma users expect. This
slice closes those gaps.

## What landed

### Phase 1 — Navigation parity
- **Trackpad gestures** (`packages/web/src/2d.ts`, `handleNavigationWheel`):
  `deltaMode` is normalised to pixels (line/page wheels no longer zoom wildly
  faster than trackpads); `|deltaX| > 0` or `shift` pans, `ctrl/meta` pinch and
  plain wheel zoom around the cursor. The gate now checks `enablePan` on the pan
  branch instead of always checking `enableZoom`.
- **Spacebar-drag pan**: `spacePanActive` / `spacePanPointerId` state, canvas
  `keydown`/`keyup` handlers, `tabIndex = 0` so the canvas can receive keys, and
  a pan path in pointer down/move/end that works regardless of `enablePan`.
  Cleared by `setNavigationInputEnabled(false)`.

### Phase 2 — Selection / edit parity
- **Marquee selection**: new `select.marquee` authoring preview
  (`packages/core/src/index.ts`) rendered by
  `renderCanvas2DAuthoringOverlayPreviews`; `createSelectTool` gained a
  `WeakMap`-keyed marquee session that starts only on empty space, publishes a
  live rectangle on move, and on release selects intersecting nodes
  (shift/ctrl/meta unions with the existing selection).
- **Area queries**: `resolveCanvas2DNodeWorldBounds` (per node type, groups
  recurse, rotated rects use transformed corners) + `rectsIntersect`, exposed as
  `runtime.getNodesInBounds` and threaded to tools via `CanvasToolContext`.
- **Delete / Undo / Redo**: `Delete`/`Backspace` in the select tool dispatches
  `node.remove` per selected id (the existing edge-reference guard still
  applies); the input bridge intercepts Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z / Ctrl+Y
  before the tool sees them.

### Phase 3 — Authoring parity
- **Connection handles**: implicit top/right/bottom/left handles derived from
  node world bounds — no node schema change. `renderCanvas2DConnectionHandles`
  draws them and `hitTestCanvas2DConnectionHandle` returns
  `subTarget: "handle.<side>"`, hit-tested above the node body. Visible only
  while a tool sets `connectionHandles: true`.
- **Connector tool** consumes the handle subTarget on both ends and records the
  grabbed sides in edge metadata.
- **Pan during connect**: `CanvasToolNavigationPolicy` gained `allow-pan`
  (validated in editor + plugin paths); the runtime's new
  `setNavigationZoomEnabled` suppresses wheel/pinch zoom while pan stays live.
  The connector tool now uses it instead of `block`.

### Phase 4 — Polish
- **Minimap**: opt-in `Canvas2DOptions.minimap` creates its own canvas beside
  the overlay, drawing node boxes plus the viewport frame scaled to the union of
  content and viewport. Clicking flies the main view (reuses the tween).
- **Clipboard**: `editor.copySelection()` / `editor.pasteClipboard(createId)`
  with an in-memory buffer; paste offsets copies, drops dangling parent links,
  and selects the result. Bound to Ctrl/Cmd+C / Ctrl/Cmd+V by the input bridge
  when `createId` is supplied.

## Verification
- `pnpm typecheck` → **30/30**.
- `pnpm build` → 19/19 (Next playground excluded; it fails only on a
  `next/font` Google Fonts fetch in this environment).
- `pnpm verify:document-schema` → `ok: true`.
- `pnpm verify:public-api` → `ok: true`.
- `pnpm verify:browser-rendering-adapters` (Diagram) → `✅ rendered 62 colors,
  survived resize + scene swap, no errors` (was 56 before the minimap landed).

## Files
- `packages/core/src/index.ts`, `packages/editor/src/{index.ts, editor.ts,
  runtime.ts, authoring/tools/connector-2d.ts}`,
  `packages/web/src/{2d.ts, types.ts, selection.ts}`,
  `packages/canvas/src/index.ts`, `apps/playground-diagram/**`.

## Deferred
- Named source/target ports (full React-Flow Handle API) — the grabbed side is
  recorded in metadata but routing still uses node centres.
- OS clipboard (cross-document paste needs id remapping for group/edge refs).
- Auto-layout routing; edge hover state distinct from selection.
