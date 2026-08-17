# Extensibility

## Goal

Denovo Canvas should be extensible without making the core package depend on
every renderer, framework, asset format, or domain. Extension points must be
explicit contracts, not hidden monkey patches.

The reference model is Better Auth: a small core facade, official adapters,
official plugins, community plugins, generated boilerplate, and explicit
extension contracts.

## Extension Principles

- Core stays framework-agnostic.
- Renderers are replaceable.
- Framework adapters are thin.
- Plugin schemas are declared and validated.
- Plugin state is namespaced.
- Heavy dependencies are optional.
- License-sensitive packages stay out of the base runtime.
- Unknown plugin nodes survive load/save when possible.

## Plugin Types

Denovo Canvas should support these plugin categories:

- node plugins;
- renderer plugins;
- editor tool plugins;
- command plugins;
- asset loader plugins;
- importer/exporter plugins;
- persistence plugins;
- worker task plugins;
- framework adapter packages;
- BIM/domain plugins.

## Node Plugins

Node plugins define new document node types.

```ts
type NodePlugin<TNode> = {
  id: string;
  nodeType: string;
  schema: unknown;
  migrate?: PluginMigration[];
  defaults?: () => TNode;
};
```

Rules:

- `nodeType` must be globally namespaced when external, for example
  `acme.floor-plan.room`;
- plugin nodes must validate through their plugin schema;
- plugin nodes must keep stable IDs;
- plugin nodes should remain serializable.

## Renderer Plugins

Renderer plugins convert nodes into runtime resources.

```ts
type RendererPlugin = {
  id: string;
  supports: (node: CanvasNode) => boolean;
  create: (node: CanvasNode, context: RendererContext) => RuntimeObject;
  update?: (object: RuntimeObject, node: CanvasNode) => void;
  dispose?: (object: RuntimeObject) => void;
  hitTest?: (node: CanvasNode, context: HitTestContext) => HitResult[];
};
```

Renderer plugins must not own document mutation. They render the document and
report hits.

## Tool Plugins

Tool plugins handle input and emit commands.

Examples:

- select;
- transform;
- draw polygon;
- place marker;
- measure distance;
- section plane;
- BIM isolate/hide/show.

Tool plugins receive context:

- editor state;
- current document;
- hit testing API;
- command dispatcher;
- transient overlay API;
- snap/grid API.

They should not mutate documents directly.

## Command Plugins

Command plugins add domain-specific commands.

```ts
type CommandHandler<TCommand> = {
  type: string;
  validate: (command: unknown) => TCommand;
  apply: (document: CanvasDocument, command: TCommand) => CommandResult;
};
```

Command handlers must produce inverse patches for undo/redo unless explicitly
marked as non-undoable.

## Asset Loader Plugins

Asset loader plugins load external assets into runtime resources.

Examples:

- image loader;
- glTF loader;
- texture loader;
- IFC parser;
- XKT loader;
- point cloud loader.

Asset loaders should support:

- lazy loading;
- cancellation;
- progress;
- cache keys;
- worker execution where useful.

## Importer and Exporter Plugins

Importers turn external files into documents, assets, or patches.

Exporters turn documents into external formats.

```ts
type ImporterPlugin = {
  id: string;
  accepts: string[];
  import: (input: ImportInput, context: ImportContext) => Promise<ImportResult>;
};

type ExporterPlugin = {
  id: string;
  format: string;
  export: (document: CanvasDocument, context: ExportContext) => Promise<Blob>;
};
```

Importers should be allowed to run in workers.

## Worker Plugins

Worker plugins register heavy tasks.

Examples:

- IFC parsing;
- geometry simplification;
- BVH building;
- mesh merging;
- chunk indexing;
- thumbnail rendering;
- format conversion.

Worker tasks should have:

- serializable input;
- transfer list support;
- progress events;
- cancellation;
- deterministic output.

## Framework Adapters

Adapters should be thin wrappers over core/editor/runtime APIs.

Adapter responsibilities:

- bind lifecycle;
- expose idiomatic hooks/components/stores;
- connect framework reactivity to editor subscriptions;
- provide examples.

Adapter non-responsibilities:

- defining document semantics;
- owning command behavior;
- owning persistence;
- requiring a specific renderer for all use cases.

Expected adapter packages:

- `@denovo/react-canvas`;
- `@denovo/vue-canvas`;
- `@denovo/svelte-canvas`;
- `@denovo/solid-canvas`;
- app examples for Next.js, Astro, and vanilla web.

## BIM Extension Strategy

BIM support must remain optional.

Reasons:

- large dependencies;
- WASM loading;
- domain-specific UI;
- license differences;
- different performance constraints.

Policy:

- keep `@xeokit/xeokit-sdk` optional because it is AGPL-3.0;
- keep `web-ifc` optional and worker-loaded;
- use `@denovo/canvas-bim` for contracts;
- do not make base packages import BIM dependencies;
- map BIM element IDs into the common selection/metadata model.

## Compatibility Strategy

To preserve extensibility:

- keep public schemas versioned;
- add migrations before breaking schema changes;
- keep unknown plugin state namespaced;
- avoid renderer-specific fields in core nodes;
- prefer feature detection over environment assumptions;
- make optional dependencies peer dependencies in extension packages;
- keep examples separate from SDK packages.

## Extension Registration

Future target API for direct editor-owned plugin resolution:

```ts
const editor = createEditor({
  document,
  plugins: [
    shapesPlugin(),
    threeRendererPlugin(),
    transformToolPlugin(),
    measurementPlugin(),
    bimPlugin()
  ]
});
```

Registration should produce a resolved capability graph:

- supported node types;
- available tools;
- available commands;
- available import/export formats;
- renderer handlers;
- worker tasks.

If a document requires a missing plugin, the editor should expose a recoverable
missing capability error instead of dropping data.

## Facade Registration

The product-facing API should also support Better Auth-style registration:

```ts
const canvas = createCanvas("#stage", {
  renderer: threeAdapter(),
  storage: httpStorage({ endpoint: "/api/scenes" }),
  plugins: [
    selectionPlugin(),
    transformPlugin(),
    measurementPlugin()
  ],
  document
});

const editor = createEditor({ document });
const disconnect = connectEditorToRuntime(editor, canvas);

await canvas.ready;
```

This is a target capability-graph example. The current facade accepts the
direct renderer adapter and command/tool plugins, but it intentionally does not
accept the illustrated `storage` field until M6 connects adapter I/O end to
end. Node and renderer discovery likewise remain future contracts.

The verified M2 facade path stages static declarations and `CanvasPlugin.setup`
registrations in config order. It commits them only after every setup succeeds,
then installs command handlers and tools atomically into editors connected with
the facade `connectEditorToRuntime()` or `connectEditorToCanvas()` helper.
Disconnect and canvas destruction remove those facade-owned registrations in
reverse order without removing host-owned editor registrations.

Plugin-owned tool IDs use `plugin.<owner>.tool.<name>` and are distinct from
application-defined IDs registered directly on a headless editor. Factory
helpers preserve explicit literal IDs so this namespace remains visible to the
type checker. The facade validates the same structure for untyped callers.

Duplicate plugin command types or tool IDs reject `canvas.ready` with the
ordinary `CanvasPluginError`. A conflict with an editor's existing registry
throws the existing `CanvasEditorError`, and any partial editor installation is
rolled back. Plugin setup still returns only `void | Promise<void>`; M2 cleanup
owns editor registry handles rather than introducing an asynchronous plugin
disposer contract.

Command setup receives required `registerCommand` and `registerTool` methods.
`registerCommand` takes a `CanvasPluginCommandDescriptor` whose payload parser
determines the handler's concrete payload type; there is no optional no-op
registration path. Descriptors, handlers, and complete tool definitions are
validated before registry commit and stored as canonical snapshots. Mutating a
caller-owned descriptor or tool object after registration cannot change its
registered key, parser, or cleanup ownership. The facade registry remains
private lifecycle state.

This config is the first verified capability-graph slice. Future work can use
the same graph to detect missing node renderers, missing storage capabilities,
unsupported assets, and plugin migrations.

A renderer adapter supplied directly through `renderer` participates in runtime
creation and owns the standard facade lifecycle. Plugin-discovered renderer
selection remains later capability-graph work; the current plugin context does
not collect renderer registrations that it cannot select as the active runtime.
