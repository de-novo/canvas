# M8 Diagram Contract

## Purpose

This document is the durable product and implementation contract for
[M8 Diagram Layer](./vision-and-milestones.md#m8-diagram-layer). It freezes
the 2D relational-diagram vocabulary that already lives in canonical schema
`0.2.0`, names package responsibilities, and states what M8 is **not**.

This is a target contract, not a status table. Current completion evidence
stays in [Project Status](./project-status.md).

M8 reuses the M0–M3.1 spine. It does not introduce a second document model,
a second editor, or a Figma-equivalent vector editor.

The following invariants apply throughout M8:

- diagrams are `mode: "2d"` documents;
- persistent edits use validated commands or transactions;
- edge geometry is derived at render/hit time from endpoints and is not
  stored as a path;
- tool drafts, ghosts, and camera animation remain transient;
- saved documents stay renderer-independent JSON;
- missing capabilities and invalid graph relationships fail explicitly;
- authoring code does not substitute a work plane, world origin, previous
  hit, or another node after a failed query.

## Why This Contract Exists

M8 shipped as history slices before this document. The slices added `edge`,
`text`, `html`, ports, a connector tool, camera helpers, and layout
adapters to the same core union as M3 shapes. Without a contract those
slices have no rule for which bar wins: CAD-quality editor, React Flow
parity, or “not Figma.”

This contract is written after the first slices on purpose. It freezes the
shape that `0.2.0` already persists. It does not bump the schema version.
New diagram node kinds after this document require a schema migration or a
namespaced plugin node. They must not be appended silently to `0.2.0`.

## Built-In Diagram Vocabulary

M8 adds three 2D node kinds to the canonical `0.2.0` union:

| Kind | Persist | Transform | Role |
| --- | --- | --- | --- |
| `edge` | yes | none (no own `position`/`rotation`/`scale`) | directed connection between two nodes in the same layer |
| `text` | yes | 2D transform | body copy, distinct from `annotation` |
| `html` | yes | 2D transform | host-mounted overlay card; not a bitmap glyph |

M8 also names these already-shipped editor/runtime surfaces:

- `define2DEdge()` — write helper that accepts `routing: "straight" | "orthogonal"`
  only. Quadratic bends use `curve` + `curveOffset`;
- `createConnectorTool()` — drag from a node port or body to create one `edge`;
- 2D camera helpers — `fitCanvas2DView`, `flyCanvas2DViewTo`,
  `getCanvas2DVisibleBounds`;
- layout adapters — `registerLayoutAdapter` / `applyLayout` with injected
  bounds.

`rect`, `circle`, `group`, `measurement`, and `annotation` remain M3
vocabulary. M8 may connect them with edges. It does not reopen their
creation contracts.

The following are **not** implicit M8 fallbacks and MUST NOT be advertised
as working diagram API until they have their own contract:

- `line` / `polyline` / `path` as first-class vector objects;
- ports as document nodes;
- HTML via SVG `foreignObject`;
- 3D edges or mixed-dimension graphs;
- constraint solvers, auto-layout as a default save, or CRDT sync;
- a Figma-equivalent frame/component/auto-layout system.

## Edge Semantics

An `edge` is a same-layer relationship, not a drawable with its own
transform.

Required identity:

- `sourceId` and `targetId` MUST resolve to existing nodes in the **same
  layer**;
- an edge MAY target another edge, measurement, or annotation (the schema
  only requires existence + same layer);
- `node.remove` of a node that is still referenced by an edge MUST fail
  unless the remove is part of a transaction that also removes those
  edges first.

Attachment:

- `sourcePort` / `targetPort` are `top | right | bottom | left | null`;
- `null` attaches to the node centre;
- `sourceAnchor` / `targetAnchor` are extra world-space offsets from that
  attachment point, default `[0, 0]`;
- ports are renderer-derived handles. They are not persisted as nodes.

Path style — two fields exist in `0.2.0` and both stay, but they are not
equal. Implementations MUST resolve geometry in this order:

1. `routing === "orthogonal"` → orthogonal waypoints from the two ports.
   Named ports that no longer aim at the other node MUST be replaced at
   render time with a facing pair from the current boxes. Facing port
   stubs MUST NOT overshoot the gap between the endpoints;
2. else `curve === "curved"` and `curveOffset !== 0` → one quadratic
   control offset from the chord;
3. else a straight segment.

`routing: "curved"` is stored and ignored. New writes MUST NOT use
`routing: "curved"` as a third algorithm. New writes that want a
quadratic set `curve: "curved"` and a non-zero `curveOffset`, and leave
`routing` as `"straight"`. New orthogonal writes set `routing:
"orthogonal"`.

Stroke: `lineStyle` is `solid | dashed | dotted`. `sourceArrow` defaults
false; `targetArrow` defaults true.

Edge geometry is computed lazily from the current endpoint transforms.
Moving an endpoint MUST NOT require a follow-up `node.update` on the
edge.

## Text Semantics

`text` is 2D body copy with `Node2DTransformSchema`.

- `text` is the string;
- `fill`, `fontSize`, `fontFamily`, `fontWeight`, `align` style the run;
- `width: null` means no wrap.

`annotation` remains a callout with an optional `targetId`. Hosts MUST
NOT use `annotation` as the diagram label node.

Ungroup of a `text` child MUST bake the group's 2D transform into the
child, the same way `rect` / `circle` do.

## HTML Overlay Semantics

`html` is a 2D transformed overlay host, not a canvas bitmap and not
SVG `foreignObject`.

Persisted fields:

- `html: string` — host-owned payload. The runtime MUST NOT interpret it
  as markup;
- `width` / `height` — optional layout hint, nullable.

Rendering:

- the 2D runtime calls the host `renderNode` callback when present;
- if the callback returns an `HTMLElement`, the runtime mounts that
  element in the overlay and positions it in canvas CSS pixels;
- on every view change the runtime sets the element's CSS `width` /
  `height` to world size × zoom and `--dc-html-zoom` to the current
  zoom. Hosts MUST NOT snapshot zoom at mount time. Card chrome SHOULD
  read `--dc-html-zoom` for type and padding;
- if the callback returns a `string`, the runtime sets `textContent`
  (not `innerHTML`);
- if `renderNode` is absent, the node still participates in
  hit-test/bounds using `width`/`height` but paints nothing in the
  overlay.

Hosts that want rich cards (shadcn, framework components) create the
DOM themselves and return the element. XSS is a host concern for that
element, not a core `innerHTML` path.

Off-screen `html` nodes MAY be hidden (`display: none`) without being
destroyed. That is overlay culling, not list virtualization. Culling
MUST use world-bounds intersection with the visible rect. It MUST NOT
test only the node's transform origin. `html` origin is top-left; a
point test at that origin hides a card whose body is still on screen
while canvas edges keep drawing to the card's ports.

Ungroup of an `html` child MUST bake the group's 2D transform.

## Graph Operations

Paste, delete, and ungroup are graph operations, not per-node loops.

- **Paste** allocates new ids, remaps `parentId`, edge `sourceId` /
  `targetId`, and annotation `targetId` when the referent is also on the
  clipboard, offsets drawable positions, and commits **one** transaction
  (adds + selection). One undo restores the pre-paste document.
- **Delete** of a selection MUST also remove incident edges (edges whose
  `sourceId` or `targetId` is selected), edges first, then the selected
  nodes, in **one** transaction. A lone `node.remove` of a still-referenced
  node continues to fail.
- **Ungroup** bakes world transforms for `rect`, `circle`, `group`,
  `text`, and `html`. Edges only retarget `parentId`; their geometry
  follows remapped endpoints.

Layout adapters remain pure functions. They receive measured bounds from
the renderer (`resolveNodeBounds`). `measured: false` means
corner/center adapters MUST move nothing. `applyLayout` commits one
transaction. Nodes without `position` (`edge`, `measurement`,
`annotation`) are not layout targets.

## Camera Helpers

`fitCanvas2DView`, `flyCanvas2DViewTo`, and `getCanvas2DVisibleBounds`
mutate **view state**, not the document. They MUST NOT write camera
fields onto a 2D scene as a persistent edit unless a later contract
defines saved views.

A missing node id to fly to is an explicit failure, not a no-op toward
the origin.

## Connector Tool

```ts
createConnectorTool({ createId, layerId, ...style })
```

The tool requires a concrete `createId`, the same rule as M3 creation
tools. A completed gesture commits one `node.add` of an `edge` (or one
transaction if the implementation batches). Cancel, miss, Escape,
disconnect, and runtime replacement commit nothing.

Draft geometry is an authoring preview (`edge.draft`). It MUST NOT enter
the document or history.

## Package Responsibilities

| Package | M8 responsibility | Must not own |
| --- | --- | --- |
| `@denovo/canvas-core` | `edge` / `text` / `html` schemas, port side enum, edge integrity (same-layer endpoints), correlated `node.update` patches | DOM overlay, path tessellation as persisted data, React cards |
| `@denovo/canvas-editor` | connector tool, graph paste/delete/ungroup, layout registry, `applyCommandsToDocument` | Canvas drawing, HTML mounting, camera animation |
| `@denovo/canvas-web` | edge routing/hit-test, port handles, overlay mount/`textContent`, 2D camera helpers | Document mutation, interpreting `node.html` as markup |
| `@denovo/canvas` | re-exports (`createConnectorTool`, camera helpers, `applyCommandsToDocument`) | A second diagram facade |
| Framework adapters and examples | host `renderNode` cards, playground proofs | New node kinds or private mutation paths |

Core and editor remain usable without DOM. Overlay rendering is a web
capability, not a document requirement.

## Failure And No-Fallback Policy

Forbidden:

- treating CSS pixels as document coordinates for edge endpoints;
- storing derived edge paths in the document;
- executing `node.html` as markup inside the runtime;
- deleting a connected node without its incident edges and calling that
  a successful graph delete;
- remapping a pasted child's `parentId` to the **old** group id;
- treating `routing: "curved"` as orthogonal or quadratic;
- falling back to world origin or the last valid node when a fly-to or
  connector query misses;
- adding another built-in diagram node kind to `0.2.0` without a
  migration.

Capability failure occurs before persistent dispatch whenever possible.
Transactions stay atomic.

## Acceptance Criteria

M8 is accepted only when all of the following are true:

- a vanilla host can build a ticket-map / dependency-graph UI with
  `html` cards or `rect`/`text` nodes, typed edges, connector creation,
  and fly-to-node without forking the editor or renderer;
- edges stay attached when endpoints move, with no extra command;
- paste, delete, and ungroup satisfy the graph rules above and undo in
  one step for the multi-node case;
- `renderNode` strings never become markup;
- saved `0.2.0` documents that contain `edge` / `text` / `html` round-trip
  as renderer-independent JSON;
- the M0–M3.1 2D baseline does not regress;
- generated declarations keep `edge` / `text` / `html` correlated with
  their patches and contain no convenience `any` / unconstrained
  `string` leakage for port sides.

M8 is **not** accepted by playground screenshots alone.

## Verification

Schema fixtures MUST prove:

- valid 2D documents with `edge` / `text` / `html`;
- same-layer endpoint rejection and missing-endpoint rejection;
- `node.update` for `edge`, `text`, `html`, and `mesh` (mesh is 3D, but
  lives in the same `0.2.0` union);
- JSON round-trip of port sides and the documented path-style fields.

Editor fixtures MUST prove:

- connector commit is one `node.add` / one history entry;
- delete of a node removes incident edges in one undo;
- paste remaps parent and edge ids and undoes in one step;
- ungroup bakes `text` / `html` transforms.

Browser verification MUST prove:

- non-blank diagram playground;
- an edge follows a dragged endpoint;
- a host-returned `HTMLElement` overlays at the node;
- a string `renderNode` result is visible as text, not parsed as HTML;
- a connector gesture in the live playground (real 2D hit tester + editor)
  adds one `edge` and one undo removes it, on desktop and a mobile viewport.

`pnpm verify:diagram-rendering` is the diagram browser suite. Combined with
the schema and editor-core fixtures above, it is the M8 acceptance gate.
