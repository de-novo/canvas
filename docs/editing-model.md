# Editing Model

## Goal

Denovo Canvas must support view and edit workflows without tying editing
semantics to React, Next.js, Three.js, or any single renderer.

The editor is a document mutation engine. Renderers visualize state. Framework
adapters expose that engine ergonomically to each ecosystem.

## Principles

- The document is the source of truth.
- Persistent edits go through commands, not direct object mutation.
- Tool state is transient and should not be stored in the document.
- Renderers can cache aggressively, but caches are derived state.
- Undo/redo restores validated snapshots; future patch persistence remains a
  separate optimization.
- Selection and hit testing are normalized across 2D and 3D.
- Plugins may add nodes and tools, but they must declare schemas and handlers.

## Implementation Status

M2 Editor Core is verified, and final M3 Authoring Tools verification is
active. `@denovo/canvas-editor` provides strict recursive command validation,
framework-free editor creation, node and layer command application, transient
selection and tool sessions, atomic transactions, snapshot-backed undo/redo,
registries, subscriptions, and hit-to-selection transitions.

The implemented M3 surface includes select and navigation tools; transient
translate, rotate, and scale workflows; 2D rect/circle and 3D box/sphere
creation; node-specific property helpers; group/ungroup and layer commands;
2D/3D grid snapping; and distance-measurement and annotation tools. The
web/facade bridge owns DOM input, runtime capability wiring, preview rendering,
renderer replacement, and lifecycle cleanup. Core and editor remain independent
of DOM, Canvas2D, Three.js, and framework types. Completion evidence remains in
[Project Status](./project-status.md); implementation presence alone does not
mark M3 verified.

Persistence patch emission belongs to the M6 storage and synchronization
milestone; editor history continues to use verified immutable snapshots.

## Core Concepts

### Document

A document is the persisted object graph.

It contains:

- document ID;
- schema version;
- scene settings;
- ordered layers;
- nodes;
- assets;
- metadata;
- optional saved views/cameras;
- optional plugin state.

The document should be serializable to JSON. Large binary payloads are stored as
assets and referenced by ID or URL.

### Node

A node is an editable object.

Every node must have:

- stable `id`;
- `type`;
- transform or layout state;
- one existing `layerId`;
- nullable `parentId` hierarchy ownership;
- visibility/lock flags;
- JSON metadata;
- optional asset references.

Renderer-specific resources such as Three.js `Mesh`, Canvas paths, GPU buffers,
or BVH indexes are not nodes. They are derived runtime resources.

### Editor State

Editor state is runtime state that may change frequently.

It includes:

- selected IDs;
- hovered ID;
- active tool;
- drag session;
- snap candidates;
- gizmo state;
- viewport state;
- transient measurement preview.

Editor state may be saved as a workspace preference, but it is separate from the
document by default.

### Command

A command is the only way to make persistent edits.

Commands should be serializable when practical:

```ts
type EditorCommand =
  | { type: "node.add"; node: CanvasNodeInput }
  | { type: "node.remove"; nodeId: string }
  | (CanvasNodeIdentity & {
      type: "node.update";
      nodeId: string;
      patch: CanvasNodePatch;
    })
  | { type: "layer.add"; layer: CanvasLayerInput; index: number }
  | { type: "layer.update"; layerId: CanvasLayerId; patch: CanvasLayerPatch }
  | {
      type: "layer.remove";
      layerId: CanvasLayerId;
      targetLayerId: CanvasLayerId | null;
    }
  | { type: "layer.reorder"; layerId: CanvasLayerId; index: number }
  | { type: "selection.set"; selection: SelectionState }
  | { type: "transaction"; commands: EditorCommand[] };
```

The snippet is conceptual; the exported `CanvasCommand` derives the exact
mode/type correlation from canonical schemas. A raw `node.update` must include
correlated `nodeMode` and `nodeType`. Prefer
`createNodeUpdateCommand(node, patch)`, which derives that source identity and
restricts the patch to mutable fields of the concrete node type.

`CanvasCommandSchema`, `defineCommand()`, and `safeDefineCommand()` validate
commands, including recursively nested transactions, before application. The
editor result extends the shared command result with affected IDs and history
information:

```ts
type CanvasEditorDispatchResult = {
  document: CanvasDocument;
  selection: SelectionState;
  inverse?: CanvasCommand;
  affectedNodeIds: readonly string[];
  historyChanged: boolean;
};
```

The editor stores validated before/after document snapshots internally so
plugin commands can be undone even when they do not provide an inverse command.
Forward/inverse patches remain a later history-memory and persistence
optimization.

Plugin commands use a typed descriptor:

```ts
const renameDocument = definePluginCommand({
  type: "plugin.example.rename-document",
  parsePayload(payload) {
    if (typeof payload !== "string") {
      throw new TypeError("rename payload must be a string");
    }

    return payload;
  }
});

editor.registerCommand(renameDocument, (command, context) => ({
  document: { ...context.document, title: command.payload }
}));
```

The parser consumes the command schema's JSON payload and returns the concrete
handler payload. A parse failure is an `invalid-command` editor error; a handler
failure remains `command-handler-failed`.

### Transaction

A transaction groups multiple commands into one undoable operation.

Use transactions for:

- drag transforms;
- multi-select updates;
- paste/import;
- group/ungroup;
- asset import plus node creation.

During a drag, the editor may render transient previews. It should commit one
transaction at pointer release unless the host explicitly asks for live commits.

## Editing Flow

The intended edit pipeline is:

1. User input arrives from DOM, React, Vue, Svelte, or another host.
2. Active tool receives normalized pointer/keyboard input.
3. Tool asks runtime for hit test or spatial query.
4. Editor updates transient state such as hover, drag, or snap preview.
5. Tool emits a command or transaction.
6. Editor validates command against schemas and document rules.
7. Editor applies the command to produce a newly validated immutable document.
8. History stores exact before/after snapshots and an inverse command when one
   is available.
9. Runtime receives an invalidation event.
10. Renderer updates only affected objects where possible.
11. A persistence integration may queue a snapshot or future patch save.

This keeps editing deterministic and lets hosts choose their own UI framework.

## Selection

Selection must be renderer-independent.

The editor stores only selected node IDs:

```ts
type SelectionState = {
  ids: string[];
  primaryId: string | null;
  hoveredId: string | null;
};
```

Renderers may draw outlines, bounding boxes, transform handles, or ghost objects,
but those are visualizations of the selection state.

## Hit Testing

2D and 3D hit tests accept the same renderer-independent input. The point is in
canvas-local CSS pixels and is not multiplied by device pixel ratio:

```ts
type CanvasHitTestInput = {
  point: [number, number];
};
```

They return the same discriminated result shape:

```ts
type CanvasHitResult =
  | { kind: "empty" | "scene"; nodeId?: never }
  | {
      kind: "node";
      nodeId: string;
      instanceIndex?: number;
      distance?: number;
      point?: [number, number] | [number, number, number];
      renderer?: string;
      subTarget?: string;
    }
  | {
      kind: "handle" | "gizmo";
      nodeId?: string;
      subTarget: string;
    };
```

`CanvasHitTestInputSchema`, `CanvasHitResultSchema`, `defineHitTestInput()`, and
`defineHitResult()` enforce the boundary. Canvas2D selects the topmost node in
reverse draw order after inverse translation, rotation, and scale. Three.js
selects the nearest ray intersection, follows child objects back to the stable
document node ID, and maps `Intersection.instanceId` to `instanceIndex`.

Built-in runtimes expose `hitTest(input)`. `connectCanvasSelection()` owns the
DOM pointer session, while `CanvasEditor.selectFromHit()` and
`CanvasEditor.hoverFromHit()` own renderer-independent selection semantics.
`connectEditorToCanvas()` combines document synchronization and selection input
without introducing DOM or Three.js types into editor core. Custom renderer hit
testing remains an optional capability so the existing lifecycle contract is
not broken; connecting an unsupported runtime raises the ordinary
`CanvasHitTestUnsupportedError` domain error.

## Transform Editing

Transforms are command-based. Translate, rotate, and scale tools keep renderer
previews transient and commit at most one transaction on pointer release.

For 2D:

- position `[x, y]`;
- rotation in radians;
- scale `[x, y]`.

For 3D:

- position `[x, y, z]`;
- rotation `[x, y, z]` in radians;
- scale `[x, y, z]`.

Stable handle IDs express constraints without renderer types:

- translation: `translate.x`, `translate.y`, `translate.z`, `translate.xy`,
  `translate.xz`, and `translate.yz`;
- rotation: `rotate.x`, `rotate.y`, and `rotate.z`;
- scale: `scale.x`, `scale.y`, `scale.z`, `scale.xy`, `scale.xz`, `scale.yz`,
  and `scale.uniform`.

Authoring code should derive each update from the current concrete node:

```ts
const node = editor
  .getState()
  .document.scene.nodes.find((candidate) => candidate.id === "box-1");

if (!node) {
  throw new Error("box-1 is missing");
}

await editor.dispatch({
  type: "transaction",
  label: "Move selection",
  commands: [createNodeUpdateCommand(node, { position: [1, 0, 0] })]
});
```

Raw `node.update` values remain supported for serialized protocols but require
the source node's correlated `nodeMode` and `nodeType`. Application rejects a
command when that identity no longer matches the current node. This prevents a
broad patch from being reinterpreted after a node or scene contract changes.

## Authoring Domains

`create2DShapeTool()` creates rects and circles from a non-degenerate pointer
gesture. `create3DPrimitiveTool()` creates boxes and spheres at a resolved point
on an explicit work plane. Both publish renderer-independent previews and
commit one `node.add`; cancellation commits nothing.

`createGroupNodesCommand()` and `createUngroupNodesCommand()` return atomic
transactions. Grouped nodes must be unlocked siblings in one layer, hierarchy
cycles are invalid, and local transforms are recalculated to preserve world
transforms. Layer add/update/remove/reorder are canonical commands. Removing a
non-empty layer requires an explicit target layer; members are never silently
moved.

When hierarchy composition would require an unrepresentable shear or
degenerate transform, ungrouping fails atomically instead of approximating
coordinates.

`snapPointToGrid()` is pure deterministic math over strict 2D or 3D grid
definitions. The M3 snap union contains grid snapping only. Active grids, snap
markers, and work planes are transient authoring state rather than persisted
document settings.

Distance measurements and annotations are persisted, mode-specific built-in
nodes. Measurement values are derived from their endpoints and unit; they are
not duplicated in JSON. Annotation text and optional target ID are document
data, while annotation dialogs remain host UI. Both tools require explicit
scene-point and preview capabilities and clean drafts on cancel, leave, Escape,
tool change, disconnect, runtime replacement, scene replacement, and destroy.

## Undo and Redo

Undo/redo belongs in editor core, not in a framework adapter.

Public history entries report:

- command label;
- affected node IDs;
- timestamp;
- original command.

The first implementation stores immutable before/after snapshots internally.
This guarantees exact rollback now; forward/inverse patches can replace the
snapshots after their schema and persistence contract are verified.

The minimum behavior:

- undo restores the validated before snapshot;
- redo restores the validated after snapshot without rerunning handlers;
- new command after undo truncates the redo stack;
- transactions create one history entry.

## Tool Model

Tools are plugins over editor input.

```ts
type CanvasToolDefinition = {
  id: string;
  label: string;
  cursor?: string;
  navigation?: "allow" | "block";
  transform?: "translate" | "rotate" | "scale";
  onDeactivate?: (context: CanvasToolContext) => void;
  onInput?: (
    input: CanvasToolInput,
    context: CanvasToolContext
  ) => void | Promise<void>;
};

type CanvasToolInput = CanvasToolPointerInput | CanvasToolKeyInput;
```

Pointer inputs use `pointer.down`, `pointer.move`, `pointer.up`,
`pointer.cancel`, or `pointer.leave`. Their point, origin, and delta fields are
canvas-local CSS pixels. Key inputs use `key.down` or `key.up`. Neither union
contains a DOM event or renderer object.

`CanvasToolContext` exposes structural editor capabilities such as document and
selection reads, tool activation, command dispatch, hit testing,
hit-to-selection transitions, scene-point resolution, node-transform
resolution, and preview publication. Optional runtime capabilities are checked
before a tool session mutates the document. The editor serializes asynchronous
tool handlers on a queue separate from command operations, so handlers may
safely await persistent commands.

Built-in tools:

- select;
- pan/orbit;
- translate, rotate, and scale transforms;
- 2D rect/circle creation;
- 3D box/sphere creation on an explicit work plane;
- 2D/3D distance measurement;
- 2D/3D annotation with a host-supplied draft provider.

Creation, measurement, annotation, and grouping require an explicit ID or ID
factory. Authoring tools also require a concrete target layer. They never
invent IDs, choose a default layer, substitute CSS pixels for document
coordinates, or commit when required scene-point or preview capabilities are
missing.

## API Shape

Current facade-first API:

```ts
const editor = createEditor({
  activeToolId: "select",
  document,
  tools: [
    createSelectTool(),
    createPanOrbitTool(),
    createTransformTool({ operation: "translate" }),
    createTransformTool({ operation: "rotate" }),
    createTransformTool({ operation: "scale" })
  ]
});

const disconnectInput = connectCanvasToolInput(canvas, editor);

await editor.handleToolInput(defineToolInput({
  altKey: false,
  code: "Escape",
  ctrlKey: false,
  key: "Escape",
  metaKey: false,
  repeat: false,
  shiftKey: false,
  type: "key.down"
}));

const box = editor
  .getState()
  .document.scene.nodes.find((node) => node.id === "box-1");

if (box?.type === "box") {
  await editor.dispatch(createNodeUpdateCommand(box, { color: "#22c55e" }));
}

await editor.undo();
await editor.redo();

const disconnect = connectEditorToRuntime(editor, runtime);
const unsubscribe = editor.subscribe((state, change) => {
  console.log(state.history, change.type);
});
```

`dispatch()`, `undo()`, and `redo()` return ordinary promises because registered
plugin command handlers may be asynchronous. Operations are serialized, and a
transaction commits only after every child command and resulting document have
passed validation. Internal Effect programs are translated to promises and the
ordinary `CanvasEditorError` domain class at this public boundary.

When a facade runtime owns plugins, use the facade connector and await runtime
readiness before dispatching plugin commands:

```ts
const canvas = createCanvas(stage, { document, plugins });
const editor = createEditor({ document });
const disconnect = connectEditorToRuntime(editor, canvas);

await canvas.ready;
```

The facade connector preserves the headless editor API, installs plugin command
and tool registrations atomically, and removes them through its idempotent
disconnect handle. Effect composes the internal setup and rollback workflow;
public failures remain `CanvasPluginError` or `CanvasEditorError`.

## Package Ownership

- `@denovo/canvas-core`: versioned document/node/layer schemas, migration,
  identity, authoring capability values, IDs, and validation.
- `@denovo/canvas-editor`: commands, history, selection, tools, transactions,
  grid math, hierarchy rules, and effective lock/visibility semantics.
- `@denovo/canvas-web`: DOM input bridge, scene-point math, transient previews,
  built-in authoring rendering/hit testing, and runtime cleanup.
- `@denovo/canvas-three`: 3D picking, BVH, instancing, geometry helpers.
- `@denovo/react-canvas`: React bindings only.

`@denovo/canvas` explicitly re-exports the public authoring surface and wires
structural capabilities across runtime replacement. It does not duplicate core
schemas or editor state machines. Framework adapters own property and draft UI,
not private mutation paths.
