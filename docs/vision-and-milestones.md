# Vision and Milestones

## Product Vision

Identity — the facade, the absorption test, and the first showcases — is
defined in [Product Identity](./product-identity.md). The user-facing
kind and property layer is [Framework Surface](./framework-surface.md).
This file keeps expression targets and the staged roadmap.

Denovo Canvas is a framework-agnostic web SDK for viewing, editing, storing, and
extending 2D/3D canvas documents.

The target product is closer to a reusable editing engine than a single viewer.
Applications should be able to embed it as:

- a lightweight 2D drawing surface,
- a high-performance 3D scene viewer,
- an object/metadata editor,
- a custom domain authoring tool,
- a BIM-capable viewer/editor through optional extensions,
- an infinite-canvas diagram/whiteboard surface (node-and-edge graphs,
  fly-to-node cameras, HTML overlay nodes) for ticket maps, mind maps, flow
  diagrams, and similar relational UIs.

The north-star goal is a single infinite-canvas SDK reusable across as many of
these surfaces as possible — 2D, 3D, BIM, and relational diagrams sharing one
document model, editor, and persistence layer rather than four parallel stacks.

v1 ships that shared engine, not four products. The first supported surface is
the embedded 2D/3D editor. BIM and diagram vocabularies are optional packages
on the same document/editor/persistence spine. They must not redefine the
public identity or grow core without an M3-style contract.

The product should also make the existing web 3D ecosystem easier to use. A
developer should not need to solve renderer setup, resize, picking, selection,
editing commands, undo/redo, storage, and worker plumbing from scratch for every
project.

This does not mean avoiding dependencies. Denovo should depend on strong
libraries where appropriate and turn them into a simpler product-facing SDK.

Implemented `auto` backends are Canvas2D, WebGPU, and WebGL2. 3D
`auto` prefers WebGPU when the capability probe is true. Explicit
`backend: "webgpu"` is valid for 2D and 3D and never falls back to
WebGL2 or Canvas2D.
The document model should describe what a scene is, while runtime adapters
decide how it is rendered on the current device. Explicit backend requests are
strict; only `auto` may choose among genuinely implemented, compatible
backends, and it fails when none is usable.

Better Auth is the reference product shape: a clear setup function, adapters for
ecosystem choices, plugins for capabilities, and CLI support for generated
boilerplate.

## Professional Authoring Quality

The product north star is professional embedded-editor quality comparable to
mature CAD and DCC applications in precision, feedback, predictability, visual
clarity, and reliability. This is a quality bar, not a promise to reproduce the
complete feature set of a specific desktop application.

Professional quality means:

- precise, schema-derived coordinates, transforms, units, and operation results;
- deterministic selection, placement, snapping, cancellation, undo, and redo;
- immediate transient feedback without committing draft state to the document;
- explicit capability and domain errors instead of hidden approximations or
  fallback behavior;
- renderer-independent saved documents with renderer and domain engines behind
  replaceable package boundaries;
- desktop and mobile interaction verification, measurable performance budgets,
  and visual output appropriate for production authoring tools.

CAD kernels, mesh-editing engines, and other specialized systems may raise this
quality bar through optional extensions. They do not move renderer objects,
engine handles, or framework state into the base document model.

## Expression Goals

### 2D

Denovo Canvas should express:

- shapes: `rect`, `circle`, `line`, `polyline`, `path`;
- text labels and rich annotations;
- images and externally stored bitmap assets;
- groups, layers, order, lock/hidden state;
- fill, stroke, opacity, blend mode;
- guides, grids, snapping metadata;
- measurements and callouts;
- plugin-defined custom 2D nodes.

### 3D

Denovo Canvas should express:

- primitives: `box`, `sphere`, `plane`, `line`, `points`;
- directly supplied `BufferGeometry`;
- instanced geometry through `InstancedMesh`;
- glTF/GLB asset references;
- materials, color, opacity, wireframe and display modes;
- camera, lights, environment, clipping/section planes;
- annotations, markers, measurements;
- object hierarchy, grouping, metadata;
- plugin-defined custom 3D nodes.

### Cross-Dimensional Model

2D and 3D should share:

- stable object IDs;
- metadata and domain properties;
- selection state;
- transform state;
- locked/hidden state;
- asset references;
- command-based mutations;
- undo/redo;
- JSON serialization;
- patch-based persistence;
- plugin extension points.

## Non-Goals

Professional CAD/DCC interaction quality is a goal. Complete AutoCAD-,
SolidWorks-, or Blender-equivalent feature parity in the base SDK is not.
Initial versions should not make the base packages own:

- a full B-rep/NURBS CAD kernel, parametric constraint solver, or feature-history
  engine;
- a Blender-like editable-mesh, sculpting, modifier, animation, or compositing
  system;
- a Figma-equivalent vector editor;
- a physics simulation engine;
- a timeline/video editor;
- a BIM platform tightly coupled to one BIM renderer.

Those capabilities can be integrated later through explicit extensions with
their own schemas, persistence contracts, dependencies, and verification. They
must not shape the base document model prematurely or be advertised through a
partial fallback implementation.

## Milestones

### M0: Product Contract

Goal: define the stable SDK contract.

Deliverables:

- package boundaries;
- document and scene schemas;
- node ID policy;
- command mutation contract;
- renderer-independent hit/selection model;
- storage contract;
- extension contract;
- vanilla example as the primary proof.
- developer experience baseline: the simplest viewer and editor APIs must be
  documented before implementation.
- dependency strategy: identify which libraries are engines, which are optional
  extensions, and which are adapter-level dependencies.
- facade strategy: define `@denovo/canvas` as the default user-facing entrypoint
  with adapters and plugins underneath.

Acceptance criteria:

- a scene can be validated, rendered, serialized, and loaded without React;
- public APIs have stable names and responsibility boundaries;
- React/Next examples depend on the framework-agnostic packages, not the other
  way around.
- the target quick start is shorter and easier than setting up Three.js or R3F
  directly for the same basic scene.

### M1: View Runtime

Goal: reliably view 2D/3D documents.

Deliverables:

- `createCanvas(container, { scene })`;
- native Canvas2D renderer;
- Three.js renderer;
- renderer backend contract aligned to `auto`, `webgpu`, `webgl2`, `canvas2d`,
  and `custom`;
- WebGPU capability detection, even if the first stable runtime still uses
  WebGL2 for broad compatibility;
- resize-safe demand rendering;
- camera/orbit/pan/zoom foundations;
- JSON load;
- basic asset reference support.

Acceptance criteria:

- vanilla web example renders 2D and 3D scenes;
- runtime survives resize and scene mode changes;
- renderer packages do not depend on framework adapters.

### M2: Editor Core

Goal: make documents editable through commands.

Deliverables:

- `createEditor({ document })`;
- selection and hover state;
- normalized hit testing;
- command dispatcher;
- undo/redo history;
- add/update/remove node commands;
- transform commands;
- transaction batching;
- plugin tool registry.
- helper API to connect editor state to a runtime without framework code.

Acceptance criteria:

- users can select, move, update, add, remove, undo, and redo nodes;
- all persistent edits go through commands;
- editor core can run without DOM, React, or Three.js.
- basic editing does not require consumers to write raycasting, pointer capture,
  or history stack code.

### M3: Authoring Tools

Goal: ship expected editing workflows.

Deliverables:

- select tool;
- pan/orbit tool;
- transform gizmo adapter;
- 2D shape creation tools;
- 3D primitive creation tools;
- property editing helpers;
- layer/group commands;
- snapping/grid guide primitives;
- measurement and annotation tools.
- deterministic `0.1.0` to canonical `0.2.0` document migration for the
  authoring persistence fields.

Acceptance criteria:

- a host app can build a basic scene editor with SDK primitives;
- tool state is transient and does not pollute persisted documents;
- saved documents remain renderer-independent.

### M3.1: Surface Placement and Stacking

Goal: add the first precise object-on-object placement workflow without
reopening or weakening the verified M3 grid-only contract.

Deliverables:

- a strict 3D surface-query capability for an existing box that returns a world
  point, unit normal, and correlated box-face feature;
- world-aligned box placement using the exact source support offset from the
  resolved face;
- transient desktop hover and touch-contact ghost previews;
- one validated `node.add` commit per successful placement;
- repeated box stacking through the same public tool and runtime capability;
- explicit miss, unsupported-target, stale-result, invalid-normal, and
  missing-capability failures with no work-plane fallback;
- preservation of the canonical `0.2.0` document shape because placement state
  and surface-query data remain transient.

Acceptance criteria:

- a vanilla host can place and repeatedly stack world-aligned boxes on supported
  box faces without renderer-specific application code;
- preview state never enters the document or history, and a successful commit
  creates exactly one history entry;
- miss, unsupported geometry or transform, cancellation, disconnect, and
  runtime replacement leave the document unchanged and clear the ghost;
- surface placement never substitutes a work plane, world origin, previous hit,
  or another target after a failed query;
- public types correlate 3D requests, box targets, box-face features, world
  points, and unit normals without broad convenience types;
- desktop mouse and mobile touch browser verification proves visible preview,
  exact support contact, repeated stacking, cleanup, and non-blank output.

The detailed scope and responsibility boundaries are defined in
[M3.1 Surface Placement and Stacking Contract](./m3-1-surface-placement-contract.md).

### M4: Performance Layer

Goal: scale to larger documents.

Deliverables:

- instancing helpers;
- direct `BufferGeometry` builders;
- geometry/material batching;
- frustum culling controls;
- LOD controls;
- chunk loading APIs;
- worker task queue;
- OffscreenCanvas capability check;
- BVH picking and spatial queries.

Acceptance criteria:

- large repeated objects render through batches, not object-per-node meshes;
- heavy parsing/conversion can run outside the main thread;
- performance features are opt-in and do not leak framework assumptions.

### M5: Framework Adapters

Goal: support the web ecosystem through thin adapters.

Deliverables:

- React/R3F adapter;
- Vue adapter;
- Svelte adapter;
- Solid adapter;
- Astro/vanilla usage guides;
- Next.js example.

Acceptance criteria:

- adapters wrap the same editor/runtime core;
- no adapter owns document semantics;
- each adapter can be versioned independently.

### M6: Persistence and Server

Goal: connect editing to real applications.

Deliverables:

- snapshot save/load;
- patch save/load;
- asset storage contract;
- scene repository interface;
- optimistic save flow;
- conflict detection;
- migration registry;
- TanStack Query-friendly examples.

Acceptance criteria:

- apps can save scenes locally or remotely;
- large assets are stored outside JSON documents;
- document migrations are deterministic and testable.

### M7: BIM Extension

Goal: support BIM without coupling core to BIM.

Deliverables:

- optional `@denovo/canvas-bim`;
- `web-ifc` parser adapter;
- `xeokit` bridge or separate viewer adapter;
- IFC metadata/property tree contract;
- object isolation/hide/show;
- section plane;
- measurement tools;
- worker-based parsing flow.

Acceptance criteria:

- BIM packages are optional;
- core remains license-clean from AGPL dependencies;
- IFC/XKT workflows use the same selection and metadata concepts where possible.

### M8: Diagram Layer

Goal: turn the 2D surface into an infinite-canvas relational-diagram engine
(node-and-edge graphs), reusing the existing document/editor/persistence stack
rather than a parallel one. The same extension pattern as the M7 `mesh` node
(new node types → discriminated union → renderer switch sites).

Deliverables:

- `edge`/`connector` node (solid / dashed / dotted, straight / curved / routed,
  arrowheads, stroke style + width vocabulary), with endpoints that track
  other nodes when they move;
- HTML/DOM overlay node (foreignObject-backed) so consumers can mount rich
  cards (typography, hover, framework components like shadcn) instead of bitmap
  glyphs;
- text node (body copy, distinct from the label-style `annotation`);
- diagram camera helpers: `fitView(bounds)`, `flyToNode(id)` / `flyTo(point)`,
  `getVisibleBounds()`;
- connector authoring tool (drag from a node port to create an edge).

Acceptance criteria:

- a ticket-map / dependency-graph UI (DOM cards + typed edges + fly-to-node)
  can be built on the SDK without forking the editor or renderer;
- edges re-route / stay attached when endpoints are dragged;
- the layer is opt-in and does not regress the M0–M3.1 verified 2D baseline.

## Future Roadmap (Post-v0.1 Optional Extensions)

The verified `M0–M8` core stays lean and focused on framework-agnostic 2D/3D
rendering, editing, persistence, and TanStack-style performance primitives.
Longer-term 3D asset and Blender-inspired mesh-authoring ambitions live strictly
behind opt-in extension packages so 2D and standard scene consumers pay `0 B`
extra bundle cost:

### Near-Term Optional Extensions

- **glTF / GLB Asset Importer (`@denovo/canvas-gltf`, optional)**: parse
  Blender-exported `.glb`/`.gltf` assets off the main thread via
  `@denovo/canvas/worker` into canonical `mesh` + `geometryAssetId` + PBR
  material/texture references, enabling instanced rendering and BVH picking of
  rich industrial and organic models (e.g., custom racks, forklifts, botanical
  or product models).
- **3D WebGPU Draw-Call Batching**: bring explicit 3D WebGPU `render.batch`
  instancing to `drawCalls = 1` parity with the verified WebGL2 `InstancedMesh`
  path.
- **Richer PBR Materials & Lighting Presets**: optional albedo/normal/roughness
  texture references, environment lighting, and shadows behind explicit
  renderer-independent schema contracts.

### Long-Term Horizon: Optional Mesh-Editing / DCC Layer (Blender-Inspired)

- **Separate Opt-In Package (`@denovo/canvas-mesh-edit`)**: layered strictly on
  top of `CanvasGeometryStore`, canonical undoable commands, and the tool
  registry without expanding `@denovo/canvas-core` or `@denovo/canvas/2d`:
  - **Sub-object editing**: BVH-accelerated `vertex`, `edge`, and `face`
    selection and transient gizmo previews.
  - **Direct mesh operations**: `extrude`, `bevel`, `inset`, `loop-cut`, and
    organic sculpting strokes compiled into atomic, undoable geometry-asset
    commands.
  - **Parametric / procedural modifiers**: non-destructive modifier stacks
    (subdivision surface, mirror, array, lathe/loft/organic surface generators)
    that bake deterministically to `mesh` geometry buffers.
- **Guardrail**: none of these features may enter `packages/core` or bloat the
  default/2D entrypoints; each requires its own contract, schema migration
  decision (if persisted), consumer type fixtures, and browser verification.
