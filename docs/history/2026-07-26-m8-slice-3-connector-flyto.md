# M8 Diagram Layer — Slice 3: Connector Tool + Smooth FlyTo

**Date:** 2026-07-26  
**Status:** ✅ Complete (browser-verified)

## Context

M8 Slice 1+2 delivered the `edge`/`text`/`html` nodes, the DOM-overlay manager,
and the instant camera helpers. This slice adds the two highest-value UX pieces:

1. **Connector authoring tool** — drag from one node to another to create an edge
   (live `edge.draft` preview follows the cursor until drop).
2. **Smooth flyTo tween** — animate `flyToNode`/`fitViewBounds` across a few
   frames (rAF-based, ease-in-out, cancelable on user input).

The "node under pointer" / port-routing / virtualization pieces remain deferred.

## What landed

### Phase 1 — Connector tool
- **`Canvas2DEdgeDraftPreview`** + `edge.draft` preview kind (`packages/core/src/index.ts`)
  carrying `{ sourceId, targetPoint, stroke, strokeWidth, lineStyle, targetArrow }`.
- **`createConnectorTool(options)`** (`packages/editor/src/authoring/tools/connector-2d.ts`)
  mirrors `create2DShapeTool`'s session/lease pattern. On `pointer.down`, hit-tests
  to find the source node; on `pointer.move`, publishes an `edge.draft` preview with
  the source id + cursor point; on `pointer.up`, hit-tests for the target and
  commits a real `edge` node via `node.add`. `navigation: "block"`.
- **`CanvasConnectorToolOptions`** (`packages/editor/src/authoring/tool-options.ts`)
  extends `Canvas2DAuthoringToolOptionsBase` with `stroke`/`strokeWidth`/
  `lineStyle`/`targetArrow`/`curve`/`curveOffset`.
- **Renderer** (`packages/web/src/2d.ts`): added `case "edge.draft"` to
  `renderCanvas2DAuthoringOverlayPreviews` — draws a line (dashed/dotted/solid) +
  arrowhead from the source world center to the cursor.
- Exported `requireToolHitTest` and `createConnectorTool` from the editor package.
- `Canvas2DViewportRuntime` (types.ts) gained `renderOverlayNode?` (already), and
  `requireToolHitTest` is now reachable for tools that need hit-testing.

### Phase 2 — Smooth flyTo tween
- **`tweenCanvas2DView`** (`packages/web/src/view2d.ts`) — self-scheduled rAF
  chain, ease-in-out cubic, lerps `offset` and `zoom` over `durationMs` (default
  350), returns a `cancel` function.
- **`animate?` flag** on `fitViewBounds` and `flyToNode` (`packages/web/src/2d.ts`):
  when true, the transition is animated (cancels any in-flight animation); otherwise
  snaps instantly (preserving `setViewState`'s synchronous behavior).
- **`activeAnimation`** closure on the runtime is cleared on user navigation
  (`handleNavigationPointerDown`) and on `destroy()`.

### Phase 3 — Verification
- `apps/playground-diagram`: registers a `createConnectorTool` and `flyToNode` (animate),
  plus Fit/Fly/Connect buttons.
- `pnpm typecheck` → **30/30**; `pnpm build` → **20/20**.
- `pnpm verify:diagram-rendering` → `✅ Diagram: rendered 56 colors, no errors`.

## Files
- `packages/core/src/index.ts` (edge.draft preview + connector tool options)
- `packages/editor/src/{index.ts, authoring/tool-options.ts, authoring/tools/connector-2d.ts}`
- `packages/web/src/{2d.ts, view2d.ts, types.ts}`
- `apps/playground-diagram/**`, `scripts/verify-browser-rendering-adapters.mjs`

## Deferred (next slice)
- Per-port anchors (named ports on nodes).
- Edge-to-edge endpoints / multi-segment routing.
- Virtualization for large DOM-card counts.
- `selection.set` integration with the connector tool (currently the tool only
  creates the edge; selecting/dropping is hit-based).
