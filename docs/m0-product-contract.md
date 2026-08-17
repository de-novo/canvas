# M0 Product Contract

M0 fixes the first public contract for Denovo Canvas. It does not try to ship a
full editor. It defines the document model, mutation language, renderer
boundary, storage boundary, extension boundary, and default developer entrypoint
that later milestones must keep compatible.

## Product Contract

Denovo Canvas is a web ecosystem SDK, not a React-only renderer. The default
install target is:

```sh
pnpm add @denovo/canvas
```

The default code path is:

```ts
import { createCanvas } from "@denovo/canvas";
import "@denovo/canvas/styles.css";

const runtime = createCanvas("#stage", {
  scene: {
    id: "demo",
    layers: [{ id: "default", name: "Default" }],
    nodes: [
      {
        id: "box",
        layerId: "default",
        type: "box",
        color: "#22c55e"
      }
    ]
  }
});
```

The facade owns first-run ergonomics. Lower-level packages remain available for
advanced users and adapters.

The current facade package name is `@denovo/canvas`, but the name may change
before release. The stable M0 contract is the facade API shape, subpaths, schema
contracts, and runtime behavior, not the exact package name. See
[Public API Contract](./public-api-contract.md).

## Package Boundary

- `@denovo/canvas`: default facade, theme/CSS contract, plugin registration
  surface, and framework-agnostic runtime setup.
- `@denovo/canvas-core`: Zod schemas, document model, command contracts,
  selection/hit contracts, storage contracts, and extension contracts.
- `@denovo/canvas-editor`: framework-independent command application,
  selection, transactions, history, and tool/command registries.
- `@denovo/canvas-web`: browser runtime for native Canvas2D and Three.js.
- `@denovo/canvas-three`: Three.js performance primitives and optimization
  helpers.
- `@denovo/react-canvas`: optional React/R3F adapter, exported through
  `@denovo/canvas/react` for convenience.
- `@denovo/canvas-server`: server-side validation and repository utilities.
- `@denovo/canvas-worker`: worker and OffscreenCanvas helpers.
- `@denovo/canvas-bim`: optional BIM adapter contracts.

The core package must not import React, Next.js, R3F, xeokit, web-ifc, DOM
runtime objects, or app-specific storage clients.

## Renderer Backend Contract

The product should be WebGPU-first, not WebGPU-only.

M0 separates document `mode` from runtime `backend`:

- `mode`: persistent scene intent, currently `2d` or `3d`.
- `backend`: runtime implementation, such as `webgpu`, `webgl2`, `canvas2d`, or
  `custom`.

The target default is:

```ts
createCanvas("#stage", {
  renderer: {
    backend: "auto"
  },
  scene
});
```

`backend: "auto"` resolves only to a genuinely implemented backend compatible
with the scene mode and current runtime capabilities. The current built-ins
resolve 3D to WebGL2 and 2D to Canvas2D. WebGPU may become the preferred `auto`
result only after a compatible runtime exists. An explicitly requested backend
is never silently replaced: unimplemented, unavailable, or mode-incompatible
choices fail with a backend-resolution error. Backend choice remains a runtime
concern and is not embedded into saved documents.

Detailed policy lives in
[Rendering Backend Strategy](./rendering-backend-strategy.md).

## Document Model

The persistent unit is a `CanvasDocument`:

- `id`: stable document id.
- `schemaVersion`: migration boundary, currently canonical `0.2.0`.
- `scene`: renderer-independent scene graph.
- `assets`: external binary or media references.
- `metadata`: application/domain data.
- `pluginState`: namespaced plugin data.

Document, scene, node, layer, asset, render option, camera, and selection
objects are strict at public parse boundaries. Unknown top-level or node-level
fields fail validation instead of being silently stripped. App-specific data
belongs in `metadata` or a namespaced `pluginState` entry, and those values must
remain JSON-serializable.

`0.1.0` is a supported legacy input version, not a second current output
shape. `parseDocument()` accepts an untrusted legacy object, while
`parseDocumentJson()` and facade JSON loading accept its serialized form. Both
run the pure deterministic `0.1.0` to `0.2.0` migration and then validate the
canonical result. Typed facade object inputs use the current schema. The SDK
exposes and saves only `0.2.0`. Unknown past or future versions fail with a
version-specific document error rather than being interpreted as current.

M0 established this initial built-in scene vocabulary:

- 2D nodes: `rect`, `circle`.
- 3D nodes: `box`, `sphere`, `instances`.
- shared guarantees: stable id, transform data, serializable JSON shape.

The canonical `0.2.0` schema extends both mode-specific unions with `group`,
`measurement`, and `annotation`. Every scene has at least one ordered layer,
and every node has one `layerId` plus explicit `visible`, `locked`, `metadata`,
and nullable `parentId` fields. These additions remain renderer-independent.

Scene dimension is strict at public parse boundaries:

- a scene with `mode: "2d"` accepts only built-in 2D nodes;
- a scene with `mode: "3d"` accepts only built-in 3D nodes;
- omitting `mode` continues to select the default `3d` scene contract;
- renderers must not silently drop built-in nodes from the other dimension.

Mixed-dimensional composition is not represented by placing 2D and 3D nodes in
one M0 scene. A future overlay, composite scene, or plugin contract must define
its persistence and renderer semantics explicitly before mixed-dimensional
documents are accepted.

Future nodes must be added by schema migration or plugin-defined node
definitions. They must not require React or a specific renderer to exist in the
stored document.

## Node ID Policy

Node ids are application-visible stable identifiers.

- Ids must be unique inside a scene.
- Ids should be generated by the host app or importer when domain identity
  matters.
- Runtime-generated ids are allowed only for transient authoring flows and must
  be persisted before save.
- Renderer object ids, Three.js UUIDs, DOM ids, and database primary keys must
  not be silently substituted for document node ids.

This lets selection, commands, storage patches, metadata, and renderer hit tests
refer to the same object without coupling to one runtime.

## Command Mutation Contract

Persistent editing uses commands. Directly mutating a rendered object can be an
escape hatch, but saved document changes must be represented as commands.

M0 command types:

- `node.add`
- `node.remove`
- `node.update`
- `layer.add`
- `layer.update`
- `layer.remove`
- `layer.reorder`
- `selection.set`
- `transaction`
- `plugin.*`

Commands are serializable and renderer-independent. M0 defined the shared
shape; the first M2 slice now supplies strict recursive command schemas, the
dispatcher, snapshot-backed history, undo/redo, atomic transactions, and
command application helpers in `@denovo/canvas-editor`.

Every raw `node.update` carries the source node's correlated `nodeMode` and
`nodeType` in addition to `nodeId` and `patch`. Application verifies that this
identity still matches the current node before merging the patch. Authoring
code should use `createNodeUpdateCommand(node, patch)` so the identity and
node-specific patch type are derived from the validated source node.

## Hit And Selection Contract

Renderers normalize picking into `CanvasHitResult`:

- `kind`: `empty`, `node`, `handle`, `gizmo`, or `scene`.
- `nodeId`: required document id for a persistent `node` hit; absent for
  `empty` and `scene` hits.
- `point`: 2D or 3D point in renderer coordinates.
- `distance`: renderer-provided sorting distance when available.
- `instanceIndex`: non-negative instance index for an instanced 3D hit.
- `renderer`: optional renderer name for debugging and adapter routing.

`CanvasHitTestInput.point` is expressed in canvas-local CSS pixels and is
independent of backing-buffer device pixel ratio. Strict schemas validate both
the input and result contracts.

Selection is stored as `SelectionState`:

- `ids`: selected node ids.
- `primaryId`: active node id, if any.
- `hoveredId`: hover node id, if any.

The selection model is not tied to DOM events, Three.js raycasters, or React
state. Those are adapter responsibilities.

## Storage Contract

Storage adapters implement `CanvasStorageAdapter`:

- `loadDocument(id)`
- `saveDocument(document, options?)`
- optional `applyCommands(documentId, commands, options?)`
- optional `listDocuments()`
- optional `deleteDocument(id)`
- optional `uploadAsset(upload)`

The default document JSON should remain small and deterministic. Large binary
data belongs in assets and is referenced by `AssetRef`. Server packages can
provide memory, database, object storage, or application-specific adapters
without changing document semantics.

The facade can initialize from or replace its current document with a validated
object or JSON string. The runtime retains the complete document while passing
only its scene to renderers, so subsequent scene updates do not discard asset
references, metadata, plugin state, or document identity.

## Extension Contract

Plugins use `CanvasPlugin`:

- register tools whose IDs use `plugin.<owner>.tool.<name>`;
- register descriptor-validated `plugin.${string}` command handlers;
- keep plugin state under a namespaced `pluginState` key.

Plugins can depend on heavy libraries. The base facade should only load those
libraries when the plugin or adapter is installed by the host app.

Custom node registration and plugin-discovered renderer selection are future
contracts, not placeholder M0 APIs. A custom node needs a versioned schema,
migration, renderer, hit-test, and editor contract. A custom renderer is passed
directly through the facade `renderer` adapter input until a complete discovery
contract exists.

## Styling Contract

The default CSS entry is:

```ts
import "@denovo/canvas/styles.css";
```

Stable CSS variables:

- `--dc-background`
- `--dc-foreground`
- `--dc-selection-color`
- `--dc-grid-color`
- `--dc-handle-color`
- `--dc-handle-x-color`, `--dc-handle-y-color`, `--dc-handle-z-color`
- `--dc-handle-xy-color`, `--dc-handle-xz-color`, `--dc-handle-yz-color`
- `--dc-overlay-color`
- `--dc-border-color`
- `--dc-focus-ring-color`
- `--dc-font-family`
- `--dc-radius`
- `--dc-grid-size`

The facade applies `.denovo-canvas`, `data-denovo-mode`, and
`data-denovo-editable` and `data-denovo-theme` to the host element so apps can
style the canvas without forking runtime code. The distributed stylesheet is
static CSS: public Denovo variables take precedence, followed by Tailwind v4
and shadcn semantic variables, then built-in fallbacks.

## M0 Acceptance

M0 is accepted when:

- `@denovo/canvas` exists as the default entrypoint.
- public API verification can read the current facade package name from package
  metadata and validate imports against it.
- A vanilla app can render and switch 2D/3D scenes through the facade.
- Browser smoke verification checks desktop and mobile canvas screenshots,
  scene switching, viewport resizing, and ResizeObserver/page errors.
- Core exports document, command, selection, storage, renderer, and plugin
  contracts.
- Node id uniqueness is validated at scene parse time.
- Scene and document schemas validate 2D/3D examples, reject duplicate IDs,
  reject renderer runtime fields, and round-trip through JSON.
- Core command, storage, plugin, and renderer contracts remain independent of
  renderer implementation packages.
- React remains optional and adapter-level.
- Rendering backend vocabulary is documented separately from document mode.
- Documentation names the product contract before the editor is implemented.

## Deliberate Non-Goals

M0 does not include:

- complete editor runtime;
- undo/redo implementation;
- pointer tool implementation;
- real database adapters;
- BIM parsing;
- collaborative editing;
- renderer-specific plugin loading.

Those are later milestones. M0 exists so those milestones build on the same
public language instead of inventing separate contracts.
