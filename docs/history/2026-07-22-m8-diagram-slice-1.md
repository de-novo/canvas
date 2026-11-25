# M8 Diagram Layer — Slice 1 (edge + text + camera)

**Date:** 2026-07-22  
**Status:** ✅ Slice 1 complete (edge node, text node, diagram camera)

## Context

The north-star is a single reusable infinite-canvas SDK across 2D / 3D / BIM / **diagrams**.
Slice 1 turns the 2D surface into a relational-diagram engine: a new `edge`/`connector
node (whose endpoints attach to other nodes and track them), a body `text` node, and
the diagram camera helpers (`fitView` / `flyToNode` / `getVisibleBounds`).

The HTML/DOM-overlay node (haru's DOM cards), the connector authoring tool, and a
smooth flyTo tween are **deferred** to a later slice — this slice delivers the
edge/text/camera primitives and wires them through the schema, renderer, and hit-test.

## What landed

### Phase 1 — `edge` node (relational primitive)
- **Schema** (`packages/core/src/index.ts`): `Canvas2DEdgeNodeSchema` (common-shape only,
  no own transform) with `sourceId`/`targetId`, `sourceAnchor`/`targetAnchor`,
  `curve` (straight|curved) + `curveOffset`, `lineStyle` (solid|dashed|dotted),
  `stroke`, `strokeWidth`, `sourceArrow`, `targetArrow`. Registered in
  `Canvas2DNodeSchema`, `Canvas2DNodeTypeSchema`, `CanonicalNodeSchema`, and the
  `node.update` patch union. A `LegacyCanvas2DEdgeNodeSchema` mirrors it.
- **Integrity** (`superRefine`, core ~L293-403): mirrors the existing annotation
  `targetId` rule — both endpoints must resolve to any node in the **same layer**.
  Editor validation is automatic via `parseDocumentEffect`.
- **Removal guard** (`packages/editor/src/commands/handlers.ts`):
  `node.remove` now fails when any edge still references the removed node.
- **World-center/bounds helper** (`packages/web/src/2d.ts`): new
  `resolveCanvas2DNodeWorldCenter` (per-type: rect→size/2, circle→origin, group→
  centroid of children, measurement→midpoint, annotation→anchor, edge→endpoint midpoint).
  Edge geometry is computed **lazily at render time** so endpoints auto-follow
  node moves (no derived-node machinery, no follow-up dispatch).
- **Rendering** (`renderCanvas2DEdgeNode`): resolves endpoint centers + anchors;
  straight = `lineTo`, curved = quadratic with a perpendicular control offset;
  `setLineDash` per `lineStyle`; arrowheads via the transform-handle triangle
  pattern. Edges draw in world coords (parent-group transform is skipped for them).
- **Hit-test** (`hitTestCanvas2DEdgeNode`): endpoint hit via anchor radius
  (`edge.source`/`edge.target` subTargets); body via `distanceFromPointToSegment`
  (curved sampled to ~16 segments; `edge.body` subTarget).
- Closed every compile-forced `node.type` switch: `renderCanvas2DDrawableNode`,
  `renderCanvas2DShapeNode`, `hitTestCanvas2DDrawableNode`, `isCanvas2DShapeNode`,
  `create2DUngroupPatch`.

### Phase 2 — `text` node
- **Schema**: `Canvas2DTextNodeSchema` extends `Node2DTransformSchema` + common
  shape: `text`, `fill`, `fontSize`/`fontFamily`/`fontWeight`, `align`,
  `width` (nullable → no wrap). Registered in the same 4 union sites.
- **Transform integration**: `isCanvas2DShapeNode` returns false for text; the
  `Canvas2DTransformNode` alias and `assertCanvas2DTransformNode` admit text so the
  editor's transform tools work.
- **Rendering** (`renderCanvas2DTextNode`): builds the font string, greedy
  word-wraps against `width` via `measureCanvas2DText`, multi-line via repeated
  `fillText`, honors `align`.
- **Hit-test** (`hitTestCanvas2DTextNode`): bounds from measured width/height,
  reused `isPointInsideRectangle`.

### Phase 3 — diagram camera helpers
- **Pure helpers** (`packages/web/src/view2d.ts`): `fitCanvas2DView`,
  `flyCanvas2DViewTo`, `getCanvas2DVisibleBounds`, plus `Canvas2DViewportSize` /
  `Canvas2DRectBounds` types. `fit` clamps zoom to [0.05, 8].
- **Runtime API** (`packages/web/src/2d.ts` + `types.ts`): `getViewportSize()`,
  `fitViewBounds(bounds, padding?=64)`, `flyToNode(nodeId, zoom?)→ViewState|null`
  (uses the Phase-1 world-center helper), `getVisibleBounds()`. All apply via the
  existing `setViewState`. Re-exported from `@de-novo/canvas-web` and the facade.
- **Animation**: instant snap only (single `setViewState`). Smooth rAF tween
  deferred.

## Verification
- `pnpm typecheck` → **30/30** packages.
- `pnpm build` → **20/20** packages.
- `pnpm verify:document-schema` → `ok: true` (edge/text fixtures;
  dangling-source and cross-layer edge rejections; node-count = 4).
- `pnpm verify:diagram-rendering` → `✅ Diagram: rendered 49 colors, survived resize + scene swap, no errors` — a new `apps/playground-diagram` example (rect + circle + curved edge + text) confirms the edge renders, auto-follows a moved node (via `runtime.update`), and the `fitViewBounds` camera helper works.

## Acceptance criteria (vision-and-milestones.md §M8)
- edge/connector (solid/dashed/dotted, straight/curved, arrowheads, endpoints track
  moves) → ✅ Phase 1
- text node → ✅ Phase 2
- `fitView` / `flyToNode` / `getVisibleBounds` → ✅ Phase 3 (instant)
- HTML/DOM-overlay node, connector authoring tool → ⏸ deferred

## Files changed
- `packages/core/src/index.ts`, `packages/editor/src/index.ts`,
  `packages/editor/src/commands/handlers.ts`, `packages/web/src/2d.ts`,
  `packages/web/src/view2d.ts`, `packages/web/src/types.ts`,
  `packages/web/src/index.ts`, `packages/canvas/src/index.ts`,
  `apps/vanilla/src/main.ts`, `scripts/verify-document-schema.mjs`.

## Deferred (follow-up slice)
- HTML/DOM-overlay node (foreignObject layer over the canvas; haru cards).
- Connector authoring tool (drag from a node to create an edge).
- Smooth flyTo tween (rAF loop independent of `scene.render.loop`).
- Edge-to-edge endpoints / named ports / multi-segment routing.

