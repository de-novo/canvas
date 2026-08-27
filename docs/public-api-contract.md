# Public API Contract

M0 public API validation starts from the user-facing facade package.

The current package name is `@denovo/canvas`, but the product should treat the
package name as a distribution detail that may change before release. The stable
contract is the facade shape, export names, subpath roles, document model, and
runtime behavior.

## Rename Policy

The library name can change.

When it does, the expected migration is:

- rename the facade package in `packages/canvas/package.json`;
- update app imports to the new package name;
- keep the same facade exports unless a deliberate breaking change is recorded;
- keep `./styles.css` and adapter subpaths stable where possible;
- run `pnpm build` and `pnpm verify:public-api`.

Validation must read the current facade package name from package metadata
instead of hardcoding a permanent brand name.

## Stable Facade Shape

The default package must expose:

- `createCanvas`
- `detectCanvasBackendCapabilities`
- `defineCanvasConfig`
- `defineCanvasPlugin`
- `definePluginCommand`
- `definePluginNodeKind`
- `registerPluginNodeKind`
- `getPluginNodeKind`
- `parsePluginNodeProps`
- `pluginNodeKindSupportsMode`
- `isPluginNodeType`
- `defineScene`
- `defineDocument`
- `define2DEdge`
- `defineCommand`
- `parseDocument`
- `parseDocumentJson`
- `createCanvas2D`
- `createCanvas3D`
- `createEditor`
- `createRelationGraphLayoutAdapter`
- `createTimeGraphLayoutAdapter`
- `applyCommandsToDocument`
- `applyCommandsToStoredDocument`
- `applyNamedOperations`
- `setLayerVisible`
- `setLayerLocked`
- `setLayerName`
- `setNodeLayer`
- `setText`
- `setAnnotationText`
- `stackBox`
- `listNodes`
- `listLayers`
- `listLabels`
- `setFieldPattern`
- `setNodeVisible`
- `setNodeLocked`
- `removeNode`
- `removeEdge`
- `removeLayer`
- `addLayer`
- `reorderLayer`
- `DENOVO_FIELD_NODE_TYPE`
- `denovoFieldInstanceCount`
- `isDenovoFieldNode`
- `isDenovoFieldType`
- `parseDenovoFieldProps`
- `DENOVO_SPARKLINE_NODE_TYPE`
- `denovoSparklinePoints`
- `denovoSparklineSize`
- `isDenovoSparklineNode`
- `isDenovoSparklineType`
- `parseDenovoSparklineProps`
- `setSparklineStyle`
- `defineMeshGeometry`
- `createMemoryGeometryStore`
- `createMeshGeometryAssetRef`
- `resolveCanvasMeshGeometry`
- `encodeMeshGeometry`
- `decodeMeshGeometry`
- `persistCanvasGeometryStore`
- `hydrateCanvasGeometryStore`
- `connectEditorToRuntime`
- `connectEditorToCanvas`
- `connectCanvasSelection`
- `connectCanvasToolInput`
- `createPanOrbitTool`
- `createSelectTool`
- `createTransformTool`
- `create2DShapeTool`
- `create3DPrimitiveTool`
- `createDistanceMeasurementTool`
- `createAnnotationTool`
- `createConnectorTool`
- `fitCanvas2DView`
- `flyCanvas2DViewTo`
- `getCanvas2DVisibleBounds`
- `createNodeUpdateCommand`
- `createGroupNodesCommand`
- `createUngroupNodesCommand`
- `snapPointToGrid`
- `validateGridWorkPlaneCompatibility`
- `getEffectiveNodeState`
- `isNodeEffectivelyLocked`
- `isNodeEffectivelyVisible`
- `defineToolInput`
- `defineHitTestInput`
- `defineHitResult`
- `CanvasBackend`
- `CanvasImplementedBackend`
- `CanvasUnimplementedBackend`
- `CanvasResolvedBackend`
- `CanvasEditorError`
- `CanvasBackendResolutionError`
- `CanvasDocumentParseError`
- `CanvasDocumentVersionError`
- `CanvasHitTestUnsupportedError`
- `CanvasPluginError`
- core document, command, storage, renderer, plugin, and selection types

The package must also expose:

- `./styles.css` for the styling contract;
- `./react` for optional React adapter exports.

React, Next.js, React Three Fiber, and Drei must not be required by the default
facade import.

## Default Usage

The target first-run API is:

```ts
import { createCanvas } from "@denovo/canvas";
import "@denovo/canvas/styles.css";

const canvas = createCanvas("#stage", {
  scene: {
    id: "demo",
    layers: [{ id: "default", name: "Default" }],
    nodes: [
      {
        id: "box",
        layerId: "default",
        type: "box"
      }
    ]
  }
});
```

If the package name changes, the import path changes, but the API shape should
remain the same.

## Styling Contract

`@denovo/canvas/styles.css` is prebuilt static CSS. It does not require a
Tailwind or shadcn runtime import. Consumers can change SDK presentation without
rebuilding the package by setting public `--dc-*` variables. When a Denovo
override is absent, the stylesheet consumes Tailwind v4 `--color-*` variables,
then shadcn semantic variables such as `--background`, `--foreground`,
`--primary`, `--border`, `--ring`, and `--radius`, before using hard fallbacks.

The stable public inputs are:

- `--dc-background` and `--dc-foreground`;
- `--dc-selection-color`, `--dc-grid-color`, and `--dc-handle-color`;
- `--dc-handle-x-color`, `--dc-handle-y-color`, and
  `--dc-handle-z-color`;
- `--dc-handle-xy-color`, `--dc-handle-xz-color`, and
  `--dc-handle-yz-color`;
- `--dc-overlay-color`, `--dc-border-color`, and `--dc-focus-ring-color`;
- `--dc-font-family`, `--dc-radius`, and `--dc-grid-size`.

Preset themes set `data-denovo-theme` but do not inject public token values as
inline styles. Explicit custom theme-object values may be inline because the
consumer supplied them directly. The Next playground is an actual shadcn and
Tailwind v4 consumer, while the facade, core, and editor remain framework
independent.

## Backend Contract

Public config should separate document mode from renderer backend:

```ts
createCanvas("#stage", {
  renderer: {
    backend: "auto"
  },
  scene
});
```

- `mode` describes what the document is: `2d` or `3d`.
- `backend` describes how the runtime renders it: `auto`, `webgpu`, `webgl2`,
  `canvas2d`, `offscreen-canvas2d`, or `custom`.

`detectCanvasBackendCapabilities()` reports `{ canvas2d, webgl2, webgpu,
offscreenCanvas2d }` before `createCanvas`. A true `webgpu` flag does
not create a device. 3D `auto` that selected WebGPU may still fall
back to WebGL2 if `runtime.ready` cannot create a device. Explicit
`backend: "webgpu"` still fails with `capability-unavailable`.

The facade reports resolved backend information through
`canvas.config.renderer`. `auto` selects an implemented backend compatible
with the document mode and detected runtime capabilities. The current
built-ins resolve 2D to Canvas2D and 3D to WebGPU when
`capabilities.webgpu` is true, otherwise WebGL2. `resolved` is
`CanvasResolvedBackend` (`canvas2d` | `webgl2` | `webgpu` | `custom`).
`CanvasImplementedBackend` includes `webgpu`. `offscreen-canvas2d` stays
reserved (`CanvasUnimplementedBackend`).

All explicit backend choices are strict. `offscreen-canvas2d` throws
`CanvasBackendResolutionError` with `backend-unimplemented`. Unavailable
Canvas2D, WebGL2, or WebGPU throws `capability-unavailable`. `custom`
without an adapter throws `adapter-required`. No explicit request
silently selects a different backend. Three.js must not substitute
WebGL2 when `webgpu` was requested. Explicit `webgpu` is valid for 2D
and 3D. 2D `auto` stays Canvas2D.

## Camera Controls Contract

The facade exposes renderer-independent 3D camera control options:

```ts
const canvas = createCanvas("#stage", {
  controls: {
    enablePan: true,
    enableRotate: true,
    enableZoom: true,
    minDistance: 1,
    maxDistance: 20
  },
  scene
});
```

Built-in 3D camera controls are enabled by default. `controls: false` disables
their creation; an options object can independently enable or disable pan,
rotate, and zoom and constrain camera distance. Canvas2D ignores these 3D
camera options.

The default web runtime currently implements the contract with Three.js
`OrbitControls`, but the facade options do not expose that engine type. Advanced
consumers can inspect `canvas.current.controls` only after narrowing to the
built-in Three.js runtime.

Control input changes the runtime camera as transient view state and does not
rewrite the persisted document camera. A later scene update reapplies the
scene's camera position, target, and field of view. In `render.loop: "demand"`
mode, each control change renders directly without starting a continuous
animation-frame loop.

Tools declare camera-input ownership with the renderer-independent
`navigation?: "allow" | "block"` policy. `createPanOrbitTool()` uses `allow`
and consumes editor tool input without implementing camera math; the existing
renderer controls continue to own DOM camera gestures. Inspect and authoring
tools use `block` while they own a pointer session.

Built-in Canvas2D, Three.js, and dynamic web runtimes expose the structural
`CanvasNavigationInputRuntime` capability:

```ts
canvas.setNavigationInputEnabled(false);
const enabled = canvas.navigationInputEnabled;
```

The facade synchronizes that capability with the active tool and restores the
previous value on disconnect. Dynamic runtimes preserve the requested policy
when a 2D/3D update replaces the underlying canvas. Canvas2D maps allowed input
to transient viewport pan and zoom; Three.js maps it to camera controls. Neither
view state is persisted into document coordinates.

## Custom Renderer Runtime Contract

The facade accepts a `CanvasFacadeRendererAdapter` directly or through
`renderer.adapter`. When the renderer resolves to `custom`, the adapter creates
the runtime used by `createCanvas` instead of the built-in web runtime.

```ts
const adapter: CanvasFacadeRendererAdapter = {
  name: "domain-renderer",
  modes: ["3d"],
  createRuntime(target, scene, options) {
    return createDomainRuntime(target, scene, options);
  }
};

const canvas = createCanvas("#stage", {
  renderer: adapter,
  scene
});
```

Facade renderer runtimes must provide the standard canvas lifecycle:

- `canvas`, `mode`, `store`, and `ready`;
- `getScene()` and `update(scene)`;
- `start()`, `stop()`, `render()`, `resize()`, and `destroy()`.

`createRuntime` returns this lifecycle object synchronously so facade getters
remain available immediately. Asynchronous device, asset, or resource setup is
represented by the runtime's `ready` promise. Adapter `modes` are enforced both
at creation and before scene updates.

`canvas.current` can be a built-in Canvas2D/Three.js runtime or a custom facade
runtime. Consumers using engine-specific escape hatches must check for the
corresponding capability, such as `"objects" in canvas.current`, rather than
assuming every 3D runtime is Three.js.

Built-in runtimes expose `hitTest({ point: [x, y] })`, where the point is in
canvas-local CSS pixels. A custom renderer may implement the same method as an
optional capability. The facade retains the existing custom lifecycle contract;
calling `canvas.hitTest()` or `connectEditorToCanvas()` without that capability
throws `CanvasHitTestUnsupportedError` instead of silently returning an empty
hit.

## Document JSON Runtime Contract

The facade accepts either a validated document object or a JSON string:

```ts
const canvas = createCanvas("#stage", {
  document: documentJson
});

const loaded = canvas.loadDocument(nextDocumentJson);
console.log(canvas.getDocument()?.assets);
```

`parseDocument(input)` accepts untrusted object input, and
`parseDocumentJson(json)` performs JSON decoding before the same strict version,
migration, and document validation. They throw the ordinary
`CanvasDocumentParseError` domain boundary with `stage: "json" | "version" |
"migration" | "document"`. Facade loading may compose these functions through
an internal Effect workflow, but no Effect type crosses the public boundary.

The canonical document output is schema `0.2.0`. `parseDocument()` accepts a
strict legacy `0.1.0` object; `parseDocumentJson()` and facade JSON loading
accept its serialized form. Migration is deterministic and precedes `0.2.0`
validation. Typed facade object inputs use the current document schema. Unknown
past and future versions fail explicitly; they are not parsed as current.

When a runtime owns a document, later scene updates replace only the document's
scene. Asset references, metadata, plugin state, identity, and schema version are
preserved. `loadDocument` updates the active renderer scene and returns the
validated document now owned by the runtime.

M1 basic asset support means validating, retaining, and exposing `AssetRef`
records through the loaded document. Fetching, decoding, caching, and rendering
image, glTF/GLB, IFC, or binary assets require later node/loader adapters.

## Editor Core Contract

The facade explicitly re-exports the framework-independent editor API
from `@denovo/canvas-editor`:

```ts
const editor = createEditor({ document });
const disconnect = connectEditorToCanvas(editor, canvas);

await editor.dispatch({
  type: "transaction",
  label: "Move and recolor",
  commands: [
    {
      type: "node.update",
      nodeId: "box-1",
      nodeMode: "3d",
      nodeType: "box",
      patch: { position: [1, 0, 0] }
    },
    {
      type: "node.update",
      nodeId: "box-1",
      nodeMode: "3d",
      nodeType: "box",
      patch: { color: "#22c55e" }
    }
  ]
});

await editor.undo();
await editor.redo();
disconnect();
```

`CanvasCommandSchema` validates built-in, plugin, and recursively nested
transaction commands. Persistent commands always produce a newly validated,
deeply frozen document; direct mutation of returned state is rejected at
runtime. Transactions are atomic and create one history entry. Selection and
hover are transient, create no document history on their own, and are cleaned
when a referenced node is removed.

Operations are serialized and return ordinary promises so asynchronous plugin
command handlers can participate without races. Undo and redo restore validated
snapshots without rerunning handlers, and a new persistent command after undo
truncates the redo branch. `connectEditorToRuntime()` depends only on an
`update(scene)` structural contract and ignores selection-only changes.
`selectFromHit()` and `hoverFromHit()` validate normalized hit results and apply
transient renderer-independent selection transitions. `connectEditorToCanvas()`
combines that editor behavior with the web pointer bridge; the lower-level
runtime and input connectors remain available separately.

When the runtime comes from the facade, both facade connectors also install the
runtime's resolved plugin command handlers and tools into the editor. Plugin
setup runs in config order and commits atomically only after asynchronous setup
has completed. Disconnect or runtime destruction removes facade-owned editor
registrations in reverse order while preserving host-owned registrations.

Duplicate plugin command types or tool IDs reject `canvas.ready` with
`CanvasPluginError`. A collision with a command or tool already owned by an
editor throws `CanvasEditorError`; partial installation is rolled back. The
headless editor package connector retains its structural document-sync-only
behavior.

Plugin commands are registered with a descriptor, not a bare type string. The
descriptor's required `parsePayload(JsonValue)` function is the runtime
validation boundary and determines the handler's payload type. The
`plugin.${string}` key, parsed payload, and ordinary `CanvasCommandResult` stay
correlated without exposing the facade's heterogeneous registry. The registry
is private lifecycle state; consumers cannot mutate it around duplicate checks
or cleanup ownership. Facade setup validates command descriptors, parsers,
handlers, and complete tool definitions before committing, then stores frozen
canonical snapshots. Invalid plugin registrations reject `canvas.ready` with
`CanvasPluginError`; they are not deferred until an editor connects. Direct
editor registrations likewise capture their validated command type, parser,
and tool ID so later mutation of the caller's object cannot alter dispatch or
defeat cleanup.

The implemented plugin surface is command handlers and tools. Placeholder
custom-node and plugin-discovered-renderer registration is not public: custom
nodes require a canonical schema/migration/renderer contract, and custom
renderers are supplied directly through the explicit `renderer` adapter input.
Plugin-owned tool IDs use `plugin.<owner>.tool.<name>` through the
`CanvasPluginToolId` template-literal type. Built-in tool factories preserve an
explicit literal ID in their return type, so a factory-created tool can enter a
plugin without widening back to an editor-global `string`. The facade validates
the non-empty owner and name segments for untyped callers before committing the
plugin registry. Direct editor-owned tools retain application-defined string
IDs because they do not claim a plugin namespace.

Effect implements internal failure, transaction, plugin setup, and registry
rollback composition. The public declarations expose only ordinary TypeScript
values, promises, cleanup functions, `CanvasEditorError`, and
`CanvasPluginError`; Effect programs, errors, causes, and services do not cross
the package or facade boundary.

## Public Type Precision Contract

Authoring APIs expose concrete input and result types. `defineCommand()`,
`defineHitTestInput()`, `defineHitResult()`, `defineToolInput()`, and
`defineSelection()` accept their corresponding authored input types, while
`safeDefine*()` and parser functions intentionally accept `unknown` because
they are validation boundaries for untrusted external data.

`CanvasNodePatchFor<TNode>` is derived from mutable fields of the concrete
built-in node schema. It provides field autocomplete and value types, and makes
`id`, `type`, empty patches, and unrelated node fields compile-time errors.
`createNodeUpdateCommand(node, patch)` derives the command's correlated
`nodeMode` and `nodeType` from that source node. Raw `node.update` commands must
provide the same identity. Runtime application verifies that the current node
still matches it before validating the merged node through its concrete schema.

Plugin node types use `plugin.<owner>.<kind>` (`PluginNodeType`). Kind
schemas are registered with `definePluginNodeKind` / `registerPluginNodeKind`
and declare `mode: "2d" | "3d" | "both"`. Unregistered types fail closed
at parse. A single-mode kind is rejected in the other scene. `both` uses
the 2D shell in a 2D scene and the 3D shell in a 3D scene.
`props` is a JSON object at the document union; the registered kind
schema is the concrete contract. `Canvas2DPluginNode` is the 2D shell
(2D transform). `Canvas3DPluginNode` is the 3D shell. A plugin without
an official drawer paints a selectable marker in that scene.

The official kind `plugin.denovo.field` is pre-registered. Its `props` are
`DenovoFieldProps`: `pattern` is `"streaks" | "letters"`, and `brightness`,
`density`, `hue`, and `speed` are finite ranges. `setFieldPattern` compiles
to `node.update`. The official drawer reads only those properties.

The official 2D kind `plugin.denovo.sparkline` is pre-registered. Its
`props` are `DenovoSparklineProps`: `style` is `"linear" | "step"`,
`values` is 2–64 finite numbers, `width` / `height` are ranges, and
`stroke` / `fill` are lowercase `#rrggbb` (`fill` may be `"none"`).
`setSparklineStyle` compiles to `node.update`. The official 2D drawer
reads only those properties. Other 2D plugin kinds still draw as the
48×48 marker.

`createRelationGraphLayoutAdapter` and `createTimeGraphLayoutAdapter`
register with `editor.registerLayoutAdapter`. `editor.applyLayout` commits
placements as one undoable transaction of `node.update` commands.

Plugin command identifiers use the `plugin.${string}` namespace. A
`CanvasPluginCommandDescriptor` correlates each identifier with the concrete
output of its payload parser and the matching handler argument. Custom facade
renderer adapters receive `CreateCanvasOptions` rather than an untyped options
value. Hit-selection callbacks return `CanvasCommandResult | null`, tool-input
targets return `boolean`, and both contracts retain their asynchronous
variants.

Facade scene inputs are mutually exclusive: a config owns a `document`, a
complete `scene`, or inline scene fields. Inline nodes require an explicit mode
and are dimension-correlated. Built-in renderer configs cannot carry an
adapter; `backend: "custom"` requires one. The same conflicts are rejected for
untyped JavaScript input before runtime creation, so no source or adapter is
silently ignored. Storage adapters remain a core/M6 contract and are not a
nonfunctional facade config field.

Worker clients may declare a task map with `WorkerTaskDefinition<payload,
result>`. The task name then determines both the accepted payload and the
inferred promise result. Omitting a task map retains the deliberately erased
`unknown` fallback for dynamic protocols.

Public declarations must not expose explicit `any`. The remaining `unknown`
positions are intentional validation or error boundaries: untrusted parser
inputs, validator inputs, error causes/callbacks, and unspecified worker
protocols. `pnpm verify:public-api` compiles
positive and negative consumer fixtures and scans generated declaration files
to preserve these guarantees.

## Authoring Tool Contract

Tool activation and input routing remain independent of DOM and renderer
implementations:

```ts
const tools = [
  createSelectTool(),
  createPanOrbitTool(),
  createTransformTool({ operation: "translate" }),
  createTransformTool({ operation: "rotate" }),
  createTransformTool({ operation: "scale" })
];
const editor = createEditor({ activeToolId: "select", document, tools });
const disconnect = connectCanvasToolInput(canvas, editor);
```

`CanvasToolInput` is a strict discriminated union for pointer and keyboard
events. Pointer coordinates, origins, and deltas are canvas-local CSS pixels;
keyboard input is normalized as `key.down` or `key.up`. No DOM event enters
editor core. Active-tool state and sessions are transient, and asynchronous
tool handlers run on a queue separate from command dispatch.

`createSelectTool()` owns renderer-independent hover and selection.
`createPanOrbitTool()` delegates camera math to the renderer while declaring
navigation ownership. `createTransformTool()` supports `translate`, `rotate`,
and `scale`, uses stable renderer-independent handle IDs, publishes transient
previews, and commits at most one identity-bearing `node.update` transaction on
release. Missing hit-test, transform, or preview capabilities fail before
mutation.

`create2DShapeTool()` is discriminated between rect and circle options.
`create3DPrimitiveTool()` is discriminated between box and sphere options and
requires an explicit work plane. Both require `createId` and `layerId`, resolve
viewport input through `CanvasScenePointRuntime`, publish
`CanvasAuthoringPreview` values, and commit one `node.add`. Invalid IDs,
degenerate gestures, unavailable placement, or missing preview capability do
not produce default or invisible nodes.

`createNodeUpdateCommand(node, patch)` owns precise property authoring.
`createGroupNodesCommand()` and `createUngroupNodesCommand()` own atomic
hierarchy changes. Layer add/update/remove/reorder remain canonical serializable
commands; non-empty layer removal requires an explicit target. Effective
visibility and lock helpers include the node, ancestors, and layer, and batch
operations fail atomically when a target is effectively locked.

`setLayerVisible({ layerId, visible })` is a named operation: a pure function
that compiles to one `layer.update` when the layer exists and the flag
differs. A locked layer rejects visibility changes.
`setLayerLocked({ layerId, locked })` compiles to one `layer.update` of
that field. Unlocking the layer itself is allowed.
`setLayerName({ layerId, name })` compiles to one `layer.update` of
`name`. A locked layer rejects the rename.
`setNodeLayer({ nodeId, layerId })` compiles to one `node.update` of
`layerId`. A locked node or locked target layer is rejected.
`setText({ nodeId, text })` compiles to one `node.update` of `text` on
a 2D `text` node. Empty string is allowed. A non-text node is rejected.
`setAnnotationText({ nodeId, text })` compiles to one `node.update` of
`text` on a 2D or 3D `annotation` node. Empty string is rejected.
`setNodeVisible({ nodeId, visible })` and
`setNodeLocked({ nodeId, locked })` compile to one `node.update`. A locked
node rejects visibility changes. Unlocking the node itself is allowed when
the lock is not from a parent or layer. `stackBox({ on, face, createId })`
compiles to one `node.add` using
M3.1 analytic box-face offset; the source must be a world-aligned root
`box`. `listNodes(document, { layerId? })` is a read-only summary of
`{ id, type, layerId, visible, locked }` using effective state; it does
not return geometry arrays. `listLayers(document)` is a read-only
summary of `{ id, name, visible, locked }` in document order; it does
not return metadata. `listLabels(document, { layerId? })` is a
read-only summary of `{ id, type, layerId, text }` for `text` and
`annotation` nodes. `removeNode({ nodeId })` compiles to one
`node.remove`. It fails on a missing, locked, edge-referenced, or
non-empty group node. `removeEdge({ nodeId })` compiles to one
`node.remove` of an `edge`. It fails when the node is not an edge.
`removeLayer({ layerId, targetLayerId })` compiles to one
`layer.remove`. An empty layer requires `targetLayerId: null`; a
non-empty layer requires an explicit other layer.
`addLayer({ layerId, name, index? })` compiles to one `layer.add`.
Omit `index` to append. A duplicate id is `layer-already-exists`.
`reorderLayer({ layerId, index })` compiles to one `layer.reorder`.
Already at that index does not grow history.
`applyNamedOperations(document, […])` folds a
list. `editor.apply([…])` applies that result as one transaction.
Already-in-state returns `{ changed: false, commands: [] }` and does not
grow history. Unknown ids fail with a typed domain error. See
[Named Authoring Operations](./named-authoring-operations.md).

`snapPointToGrid()` accepts only strict mode-correlated 2D or 3D grids. Active
grids and snap markers are transient previews; only the snapped document
coordinate is persisted. Unsupported guide, edge, node, or surface snap kinds
are not reinterpreted as grid or free placement.

`createDistanceMeasurementTool()` persists mode-specific distance endpoints,
unit, and precision while deriving the measured value. `createAnnotationTool()`
persists a mode-specific anchor, non-empty text, and optional target ID, and
requires a host-supplied typed draft provider. The editor never opens framework
UI, invents text, or persists renderer labels.

The facade binds structural scene-point, authoring-preview, transform, handle,
hit-test, and navigation capabilities to each active runtime. Dynamic 2D/3D
replacement preserves those bindings. Pointer cancel/leave, Escape, tool
change, disconnect, scene/runtime replacement, and runtime destruction clear
owned previews and sessions. The web connector restores the host's prior
`touch-action` value when disconnected.

## Verification

The public API contract is checked by:

```sh
pnpm typecheck
pnpm build
pnpm verify:public-api
pnpm verify:document-schema
pnpm verify:editor-core
pnpm verify:hit-testing
pnpm verify:browser-rendering
```

The verifier checks:

- facade export map;
- `./styles.css` and `./react` subpaths;
- React adapter remains optional;
- default facade source has no framework imports;
- vanilla example depends on the current facade package name;
- runtime exports exist in built output;
- editor ESM/CommonJS exports and a no-DOM headless TypeScript consumer compile;
- custom renderer creation, lifecycle forwarding, and unsupported-mode rejection
  work through the facade;
- `auto` resolves only implemented mode-compatible backends, while every
  explicit unsupported, unavailable, or mismatched backend fails without
  substitution;
- custom renderers keep hit testing optional and unsupported use produces the
  ordinary capability error;
- document JSON parsing, strict `0.1.0` to `0.2.0` migration, unknown-version
  rejection, runtime loading, domain-error mapping, and asset reference
  preservation work without exposing Effect types;
- camera control config is accepted by the generated TypeScript smoke fixture;
- desktop and mobile browser checks verify orbit, pan, and zoom pixel changes
  without restarting demand-mode frame scheduling;
- desktop and mobile checks verify Inspect blocks camera pixels, Navigate
  enables them, selection remains unchanged, and policy survives renderer
  replacement;
- static style verification checks public Denovo tokens and Tailwind/shadcn
  fallbacks without framework runtime imports;
- actual desktop pointer and mobile touch input select rotated/scaled topmost 2D
  nodes and 3D nodes after canvas-replacing mode switches, clear on misses, and
  do not interpret orbit drags as selection;
- strict normalized pointer/key tool inputs compile through the facade, route
  only to the active tool, preserve selection under the inspect tool, and drive
  the select tool with desktop mouse, mobile touch, and Escape input;
- desktop mouse and mobile touch drags verify translate, rotate, and scale
  previews in 2D/3D while documents and history remain stable, then commit one
  identity-bearing update transaction on release;
- desktop and mobile authoring checks cover 2D/3D creation, grid-snapped
  placement, property updates, groups/layers, measurements, annotations,
  undo/redo, JSON reload, cleanup, and renderer replacement;
- Three.js Raycaster checks verify nearest hits, misses, camera changes, and
  instanced-hit `instanceIndex` mapping;
- strict command schema, atomic transactions, add/update/remove, 2D/3D
  transforms, source identity, creation, property updates, groups/layers, grid
  snapping, measurement/annotation, selection, plugin handlers, tool registry,
  serialized dispatch, history branching/limits, undo/redo, and runtime
  connection work through the facade without exposing Effect types;
- asynchronous facade plugin setup, deterministic order, command/tool bridge,
  duplicate rejection, atomic setup/editor rollback, disconnect/destroy
  cleanup, and destroy-before-setup completion work through ordinary public
  errors and cleanup handles;
- generated TypeScript fixtures preserve mode, node-type, identity, patch,
  coordinate, layer/group, measurement/annotation, and callback correlations
  while rejecting invalid combinations;
- generated TypeScript smoke fixture accepts `renderer: { backend: "auto" }`.

This is intentionally package-name-aware without assuming the package name is
permanent.
