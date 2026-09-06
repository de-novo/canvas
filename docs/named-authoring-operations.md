# Named Authoring Operations

This contract defines the first UX layer above verified M3 / M3.1 commands
and tools: operations a human can say aloud and an agent can call, that
compile to the existing command language.

It is a target contract, not a status table. Current evidence stays in
[Project Status](./project-status.md). Gesture tools stay in the
[M3 Authoring Contract](./m3-authoring-contract.md) and
[M3.1 Surface Placement Contract](./m3-1-surface-placement-contract.md).

## Decision

The **rule** is a pure function: document in, `{ document, changed, commands }`
out. Effect may run inside that function. Effect types MUST NOT appear on
the public boundary.

The **reading shape** is a list, like Flutter `children`:

```ts
applyNamedOperations(document, [
  setLayerVisible({ layerId: "ifc-storey-12", visible: false }),
  stackBox({ on: "box-1", face: "+y", createId })
]);
```

The **editor** only applies that result (one transaction when any command
exists). It is not the owner of the operations.

```ts
editor.apply([
  setLayerVisible({ layerId: "ifc-storey-12", visible: false }),
  stackBox({ on: "box-1", face: "+y", createId })
]);
```

`editor.setLayerVisible().stackBox()` is out of contract. It makes the
editor the subject, hides `{ changed, commands }`, and cannot run on a
bare document.

There is no parallel agent API. A playground button and a model prompt
call the same `setLayerVisible` / `applyNamedOperations` functions.

## Non-Goals

- A new document schema or `0.3.0` bump.
- A chat panel, prompt protocol, or `@denovo/canvas-agent` package.
- A fluent `editor.foo().bar()` surface.
- Public `Effect`, `pipe` from Effect, or a new FP runtime.
- New gesture tools. Pointer sessions already exist.
- WebGPU, xeokit, or a second renderer.
- Dumping mesh `positions` into a helper return value.

## Invariants

- Named operations MUST compile to existing validated commands. They MUST
  NOT write renderer objects or bypass command validation.
- Inputs MUST be concrete (schema-derived ids, closed unions).
- Unknown ids and illegal relationships MUST fail with a typed domain
  error. Already-in-state returns `{ changed: false, commands: [] }` and
  MUST NOT grow history. That is an explicit result.
- One named operation produces at most one command (slice 1–2). A list
  apply folds them into one transaction.
- `stackBox` is document-only and synchronous. Box-on-box offset is
  M3.1 analytic math, not a live `resolveSurfacePoint` call.
- Host UI and agent callers MUST share the same functions.

## Types

```ts
type NamedOperationResult = {
  document: CanvasDocument;
  changed: boolean;
  commands: readonly CanvasCommand[];
};

type NamedOperation = (document: CanvasDocument) => NamedOperationResult;
```

`setLayerVisible(input)` and `stackBox(input)` return a `NamedOperation`.
Calling that function with a document is the pure path. Passing the
function to `applyNamedOperations` / `editor.apply` is the list path.

## Placement

| Symbol | Lives in | Facade export |
|---|---|---|
| `setLayerVisible` | `@denovo/canvas-editor` | `@denovo/canvas` |
| `setLayerLocked` | `@denovo/canvas-editor` | `@denovo/canvas` |
| `setLayerName` | `@denovo/canvas-editor` | `@denovo/canvas` |
| `stackBox` | `@denovo/canvas-editor` | `@denovo/canvas` |
| `listNodes` | `@denovo/canvas-editor` | `@denovo/canvas` |
| `listLayers` | `@denovo/canvas-editor` | `@denovo/canvas` |
| `listLabels` | `@denovo/canvas-editor` | `@denovo/canvas` |
| `removeNode` | `@denovo/canvas-editor` | `@denovo/canvas` |
| `removeEdge` | `@denovo/canvas-editor` | `@denovo/canvas` |
| `removeLayer` | `@denovo/canvas-editor` | `@denovo/canvas` |
| `addLayer` | `@denovo/canvas-editor` | `@denovo/canvas` |
| `reorderLayer` | `@denovo/canvas-editor` | `@denovo/canvas` |
| `setFieldPattern` | `@denovo/canvas-editor` | `@denovo/canvas` |
| `setSparklineStyle` | `@denovo/canvas-editor` | `@denovo/canvas` |
| `setShadePattern` | `@denovo/canvas-editor` | `@denovo/canvas` |
| `setNodeVisible` | `@denovo/canvas-editor` | `@denovo/canvas` |
| `setNodeLocked` | `@denovo/canvas-editor` | `@denovo/canvas` |
| `setNodeLayer` | `@denovo/canvas-editor` | `@denovo/canvas` |
| `setText` | `@denovo/canvas-editor` | `@denovo/canvas` |
| `setAnnotationText` | `@denovo/canvas-editor` | `@denovo/canvas` |
| `applyNamedOperations` | `@denovo/canvas-editor` | `@denovo/canvas` |
| `CanvasEditor.apply` | `@denovo/canvas-editor` | through the editor instance |

BIM `listBimElements({ modelId })` stays in `@denovo/canvas-bim`.
Core/editor MUST NOT import `__bim`.

## Slice 1 — `setLayerVisible`

```ts
setLayerVisible({ layerId: CanvasLayerId, visible: boolean }): NamedOperation
```

Compiles to one `layer.update` when the layer exists and `visible`
differs. Playground storey isolation should use this instead of a raw
command.

Negative fixtures: unknown `layerId`; extra fields; `visible` not
boolean.

## Slice 2 — `stackBox`

```ts
stackBox({
  on: NodeId,
  face: "+x" | "-x" | "+y" | "-y" | "+z" | "-z",
  createId: CanvasCreateId,
  layerId?: CanvasLayerId
}): NamedOperation
```

Document-only. Source MUST be a `box`. One `node.add`. `layerId`
defaults to the source layer. No runtime argument.

## Slice 3 — `listNodes`

```ts
listNodes(
  document: CanvasDocument,
  options?: { layerId?: CanvasLayerId }
): readonly ListedNode[]

type ListedNode = {
  id: NodeId;
  type: CanvasNode["type"];
  layerId: CanvasLayerId;
  visible: boolean;
  locked: boolean;
};
```

Read-only. `visible` and `locked` are effective state. No geometry
arrays. Unknown `layerId` fails; an empty layer returns `[]`. Omit
`layerId` to list the whole document.

## Slice 4 — `setFieldPattern`

```ts
setFieldPattern({
  nodeId: NodeId,
  pattern: "streaks" | "letters"
}): NamedOperation
```

Document-only. Source MUST be `plugin.denovo.field`. Compiles to one
`node.update` that replaces `props` with the same knobs and the new
pattern. Already-in-state does not grow history.

## Slice 5 — `setNodeVisible` / `setNodeLocked`

```ts
setNodeVisible({ nodeId: NodeId, visible: boolean }): NamedOperation
setNodeLocked({ nodeId: NodeId, locked: boolean }): NamedOperation
```

Document-only. Each compiles to one `node.update` of that field.
Unknown `nodeId` is `node-not-found`. Extra fields and a non-boolean
flag fail at the helper. Already-in-state does not grow history.

`setNodeVisible` fails with `locked-target` when the node is
effectively locked. `setNodeLocked({ locked: false })` may unlock the
node itself when the lock is not from a parent or layer. A hierarchy
or layer lock still fails.

Works in 2D and 3D. The compiled command keeps the node's
`nodeMode` / `nodeType`.

## Slice 6 — `setLayerLocked`

```ts
setLayerLocked({ layerId: CanvasLayerId, locked: boolean }): NamedOperation
```

Compiles to one `layer.update` when the layer exists and `locked`
differs. Unknown `layerId` is `layer-not-found`. Extra fields and a
non-boolean `locked` fail at the helper. Already-in-state does not
grow history. Unlocking the layer itself is allowed. A locked layer
still rejects `setLayerVisible`.

## Slice 7 — `listLayers`

```ts
listLayers(document: CanvasDocument): readonly ListedLayer[]

type ListedLayer = {
  id: CanvasLayerId;
  name: string;
  visible: boolean;
  locked: boolean;
};
```

Read-only. Layers stay in document order. Own flags, not effective
node state. No metadata. Extra arguments fail.

## Slice 8 — `removeNode`

```ts
removeNode({ nodeId: NodeId }): NamedOperation
```

Document-only. Compiles to one `node.remove`. Unknown `nodeId` is
`node-not-found`. An effectively locked node is `locked-target`. A
node still referenced by an edge fails. A non-empty group fails;
ungroup first. Extra fields fail. This helper does not also remove
incident edges.

## Slice 9 — `removeEdge`

```ts
removeEdge({ nodeId: NodeId }): NamedOperation
```

Document-only. Source MUST be an `edge`. Compiles to one
`node.remove`. Unknown `nodeId` is `node-not-found`. An effectively
locked edge is `locked-target`. Another edge still targeting this
edge fails. Extra fields fail. Pair with `removeNode` in one list
when a connected node must go.

## Slice 10 — `removeLayer`

```ts
removeLayer({
  layerId: CanvasLayerId,
  targetLayerId: CanvasLayerId | null
}): NamedOperation
```

Compiles to one `layer.remove`. The last layer cannot be removed.
An empty layer requires `targetLayerId: null`. A non-empty layer
requires an explicit other layer; nodes move there. Locked source,
locked nodes on it, or a locked target fail. Extra fields fail.

## Slice 11 — `addLayer`

```ts
addLayer({
  layerId: CanvasLayerId,
  name: string,
  index?: number
}): NamedOperation
```

Compiles to one `layer.add`. Omit `index` to append. An explicit
index must be an integer from `0` to the current layer count.
A duplicate `layerId` is `layer-already-exists`. Empty name, extra
fields, and a non-integer index fail at the helper. Visibility and
lock stay on `setLayerVisible` / `setLayerLocked`.

## Slice 12 — `reorderLayer`

```ts
reorderLayer({
  layerId: CanvasLayerId,
  index: number
}): NamedOperation
```

Compiles to one `layer.reorder`. `index` must be an integer from `0`
to the last layer. Already at that index does not grow history.
Unknown `layerId` is `layer-not-found`. Extra fields and a
non-integer index fail at the helper.

## Slice 13 — `setSparklineStyle`

```ts
setSparklineStyle({
  nodeId: NodeId,
  style: "linear" | "step"
}): NamedOperation
```

Document-only. Source MUST be `plugin.denovo.sparkline`. Compiles to
one `node.update` that replaces `props` with the same knobs and the
new style. Already-in-state does not grow history. Requires a 2D
document.

## Slice 19 — `setShadePattern`

```ts
setShadePattern({
  nodeId: NodeId,
  pattern: "gradient" | "wave"
}): NamedOperation
```

Document-only. Source MUST be `plugin.denovo.shade`. Compiles to one
`node.update` that replaces `props` with the same knobs and the new
pattern. Already-in-state does not grow history. Requires a 2D
document.

## Slice 14 — `setLayerName`

```ts
setLayerName({ layerId: CanvasLayerId, name: string }): NamedOperation
```

Compiles to one `layer.update` of `name`. Empty name and extra fields
fail at the helper. A locked layer is `locked-target`. Already the
same name does not grow history. Unknown `layerId` is
`layer-not-found`.

## Slice 15 — `setNodeLayer`

```ts
setNodeLayer({ nodeId: NodeId, layerId: CanvasLayerId }): NamedOperation
```

Document-only. Compiles to one `node.update` of `layerId`. Unknown
`nodeId` is `node-not-found`. Unknown `layerId` is `layer-not-found`.
An effectively locked node or a locked target layer is
`locked-target`. Already on that layer does not grow history. Extra
fields fail. This helper does not also change `parentId`.

## Slice 16 — `setText`

```ts
setText({ nodeId: NodeId, text: string }): NamedOperation
```

Document-only. Source MUST be a 2D `text` node. Compiles to one
`node.update` of `text`. Empty string is allowed. A non-text node is
`invalid-command`. An effectively locked node is `locked-target`.
Already the same text does not grow history. Extra fields fail.
Annotation and HTML stay off this helper.

## Slice 17 — `listLabels`

```ts
listLabels(
  document: CanvasDocument,
  options?: { layerId?: CanvasLayerId }
): readonly ListedLabel[]

type ListedLabel = {
  id: NodeId;
  type: "text" | "annotation";
  layerId: CanvasLayerId;
  text: string;
};
```

Read-only. Document order. Only `text` and `annotation` nodes. No
geometry, fill, or HTML. Unknown `layerId` fails; an empty match
returns `[]`. Extra fields fail.

## Slice 18 — `setAnnotationText`

```ts
setAnnotationText({ nodeId: NodeId, text: string }): NamedOperation
```

Document-only. Source MUST be an `annotation` node in 2D or 3D.
Compiles to one `node.update` of `text`. Empty string is
`invalid-command` because the schema requires `min(1)`. A non-annotation
node is `invalid-command`. An effectively locked node is
`locked-target`. Already the same text does not grow history. Extra
fields fail. `setText` still writes only 2D `text` nodes.

## Verification (when a slice ships)

- editor-core: pure path and `editor.apply` leave the same document;
  already-in-state does not grow history; unknown id fails;
- public-api: `setLayerVisible`, `setLayerLocked`, `stackBox`,
  `setNodeVisible`, `setNodeLocked`, `setNodeLayer`, `setText`, `setAnnotationText`, `removeNode`, `removeEdge`,
  `removeLayer`, `addLayer`, `reorderLayer`, `setSparklineStyle`, and
  `setLayerName` are `NamedOperation`s; `listNodes` returns `ListedNode[]` without
  geometry; `listLayers` returns `ListedLayer[]` without metadata;
  `listLabels` returns `ListedLabel[]` without geometry;
  extra fields and illegal unions are `@ts-expect-error`;
- playground storey isolation calls `setLayerVisible` and reads Level 2
  through `listNodes`, not a hand-built `layer.update`. Vanilla layer
  toggles call `setLayerVisible` / `setLayerLocked`, not a hand-built
  `layer.update`.

`pnpm typecheck`, `pnpm build`, `pnpm verify:public-api`,
`pnpm verify:editor-core`.

## Order

1. `setLayerVisible` + `applyNamedOperations` + `editor.apply`.
2. `stackBox` (document-only).
3. `listNodes`.
4. `setFieldPattern`.
5. `setNodeVisible` / `setNodeLocked`.
6. `setLayerLocked`.
7. `listLayers`.
8. `removeNode`.
9. `removeEdge`.
10. `removeLayer`.
11. `addLayer`.
12. `reorderLayer`.
13. `setSparklineStyle`.
14. `setLayerName`.
15. `setNodeLayer`.
16. `setText`.
17. `listLabels`.
18. `setAnnotationText`.
19. `setShadePattern`.

Do not start a later slice until the previous slice has types and
editor-core evidence.

## WebGPU

Unchanged. These calls are backend-agnostic. Explicit
`backend: "webgpu"` MUST accept the same document and the same
operations. 3D `auto` prefers WebGPU when the capability probe is
true, otherwise WebGL2.
