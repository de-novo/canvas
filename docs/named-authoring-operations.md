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
| `stackBox` | `@denovo/canvas-editor` | `@denovo/canvas` |
| `listNodes` | `@denovo/canvas-editor` | `@denovo/canvas` |
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

Read-only. Returns `{ id, type, layerId, visible, locked }[]` using
effective state. No geometry arrays. Unknown `layerId` fails; an empty
layer returns `[]`.

## Verification (when a slice ships)

- editor-core: pure path and `editor.apply` leave the same document;
  already-in-state does not grow history; unknown id fails;
- public-api: `setLayerVisible` is a `NamedOperation`; extra fields and
  illegal unions are `@ts-expect-error`;
- playground slice 1 calls the named operation, not a hand-built
  `layer.update`.

`pnpm typecheck`, `pnpm build`, `pnpm verify:public-api`,
`pnpm verify:editor-core`.

## Order

1. `setLayerVisible` + `applyNamedOperations` + `editor.apply`.
2. `stackBox` (document-only).
3. `listNodes`.

Do not start slice 2 until slice 1 has types and editor-core evidence.

## WebGPU

Unchanged. These calls are backend-agnostic. A future WebGPU runtime
MUST accept the same document and the same operations.
