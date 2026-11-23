# Getting Started & Optimization Guide

**English** | [한국어](./getting-started.ko.md) | [简体中文](./getting-started.zh-CN.md)

This guide explains how to pick the right Denovo Canvas entrypoint, wire the
headless editor to your framework without unnecessary re-renders, and get the
most out of the built-in 2D and 3D optimizations.

## 1. Choose Your Entrypoint

| App type | Recommended imports | Three.js bundled? |
| --- | --- | --- |
| 2D Vanilla / TypeScript | `@denovo/canvas/2d` + `@denovo/canvas/styles.css` | No (`0 B`) |
| 2D React / Next.js | `@denovo/canvas/2d` + `@denovo/canvas/react/2d` (or `@denovo/react-canvas/2d`) | No (`0 B`) |
| 2D Vue 3 | `@denovo/canvas/2d` + `@denovo/vue-canvas/2d` | No (`0 B`) |
| 2D Svelte | `@denovo/canvas/2d` + `@denovo/svelte-canvas/2d` | No (`0 B`) |
| 2D Solid | `@denovo/canvas/2d` + `@denovo/solid-canvas/2d` | No (`0 B`) |
| 3D or dynamic 2D/3D | `@denovo/canvas` + optional `@denovo/react-canvas` / `vue` / `svelte` / `solid` | Yes |

## 2. Core Mental Model

1. **Document (`0.2.0` JSON)** — renderer-independent data (`layers`, `nodes`,
   `mode: "2d" | "3d"`, optional `render` / `assets` / `metadata`). Parse and
   validate with `defineDocument` or `parseDocument`.
2. **Headless Editor (`createEditor`)** — owns transactions, selection, hover,
   tools, and bounded undo/redo history. Apply changes using **Named Operations**
   (`setNodeVisible`, `setLayerVisible`, `removeNode`, `removeEdge`, `stackBox`,
   etc.) or canonical commands.
3. **Runtime (`createCanvas` / framework view)** — renders the document on
   Canvas2D, 2D WebGPU, WebGL2, or 3D WebGPU and reports pointer/touch hits back
   via `connectEditorToCanvas(editor, canvas)`.

## 3. Avoid UI Churn With Fine-Grained Selectors

Pointer movement updates `state.selection.hoveredId` on every hovered node
transition. Instead of subscribing a toolbar or inspector to the entire editor
state, select only the slice each component needs and pass `shallowEqual` when
returning derived objects or arrays:

```ts
import { shallowEqual, subscribeCanvasSelector } from "@denovo/canvas/2d";

const stop = subscribeCanvasSelector(
  editor,
  (state) => ({
    canUndo: state.history.canUndo,
    canRedo: state.history.canRedo,
    selectedCount: state.selection.ids.length
  }),
  (slice) => renderToolbar(slice),
  { equals: shallowEqual }
);
```

Framework equivalents:
- React: `useCanvasSelector(editor, selector, shallowEqual)`
- Vue: `useCanvasSelector(editor, selector, shallowEqual)`
- Svelte: `createCanvasSelectorStore(editor, selector, shallowEqual)`
- Solid: `useCanvasSelector(editor, selector, shallowEqual)`

## 4. Built-In 2D Optimizations

Most 2D optimizations are active automatically:

- **Viewport culling & O(k) incremental spatial indexing**: only visible nodes
  are drawn, hit-tested, or scanned during marquee selection. Moving or editing
  a few nodes updates only those nodes (and dependent edges) inside the grid
  instead of rebuilding a 10k-node index.
- **O(visible) smart snap guides**: call `runtime.current.computeSnapGuides(targetBounds, { excludeNodeIds, threshold: 6 })`
  during live drags to snap against visible neighbors without scanning off-screen
  nodes, or use pure `computeCanvas2DSnapGuides(bounds, candidates)` headlessly.
- **Virtual HTML overlay cards**: `html` nodes mount DOM elements only when
  inside the visible viewport and call `renderNode` only for cards whose node
  payload actually changed.
- **rAF input burst coalescing**: rapid pointer, wheel, hover, and preview
  events within one frame coalesce into a single repaint while preserving exact
  accumulated pan/zoom deltas.
- **Explicit 2D WebGPU**: pass `renderer: { backend: "webgpu" }` for large
  2D scenes where GPU-resident vertex/atlas caching is desired.

## 5. Built-In 3D & BIM Optimizations

- Set `render: { batch: true }` on a 3D scene to merge top-level `box` and
  `sphere` nodes into `InstancedMesh` batches with BVH raycast picking.
- Keep `renderer: "auto"` to prefer 3D WebGPU where supported and fall back to
  WebGL2 cleanly, or request `"webgpu"` / `"webgl2"` explicitly for strict
  fail-closed behavior.
- Offload heavy mesh parsing with `@denovo/canvas/worker`, stream large scenes
  with `createSceneChunkLoader`, and federate multi-model IFC files with
  `@denovo/canvas-bim`.

## 6. Styling And Custom Kinds

- Override public `--dc-*` CSS custom properties after importing
  `@denovo/canvas/styles.css` (falls back cleanly to Tailwind v4 `--color-*`
  and shadcn semantic tokens).
- Register custom visual kinds (`plugin.<org>.<kind>`) via
  `registerPluginNodeDrawer` from `@denovo/canvas/web`. See
  [Kind Drawer Seam](./kind-drawer-seam.md) and
  [Public API Contract](./public-api-contract.md).

## Next Reading

- [Documentation Index](./README.md)
- [Public API Contract](./public-api-contract.md)
- [Named Authoring Operations](./named-authoring-operations.md)
- [Contributing](../CONTRIBUTING.md)
