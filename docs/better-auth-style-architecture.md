# Better Auth Style Architecture

## Decision Status

The `plugins:` lists, `@denovo/canvas/plugins/*` subpaths, `storage:` config
field, and CLI commands in this document are target sketches from before the
[Extension Surface Decision](./extension-surface-decision.md) (2026-09-04).
None of them exist, and that decision does not schedule them. What stands
from this document is the facade-first setup function and the adapter idea
for renderers, storage, and frameworks. Plugins as product vocabulary do not.

## Why This Model

Better Auth is a useful reference because it does not try to own every database,
ORM, runtime, and application framework. It provides one cohesive product API and
then integrates with the ecosystem through adapters, plugins, schema generation,
and client helpers.

Denovo Canvas should follow the same pattern for 2D/3D canvas work.

The goal is not to replace Three.js, Canvas2D, React Three Fiber, Drei, xeokit,
web-ifc, storage layers, or app frameworks. The goal is to make those choices
easy to combine behind one coherent SDK.

## Mapping

| Better Auth Concept | Denovo Canvas Equivalent |
| --- | --- |
| `betterAuth()` | `canvas()` / `createCanvas()` |
| database adapter | renderer adapter / storage adapter |
| Prisma adapter | specific storage or schema adapter |
| Drizzle adapter | typed storage or schema adapter |
| plugin | tool, node, renderer, importer, exporter, BIM feature |
| CLI generate | document schema, theme, plugin scaffold generation |
| CLI migrate | document/plugin schema migrations |
| client plugin | React/Vue/Svelte/Solid adapter |
| server handler | scene repository/API handler |
| schema generation | document/storage/plugin schema generation |

## Package Shape

The public shape should feel like one product with many optional integrations.

```text
@denovo/canvas
  main facade package

@denovo/canvas/adapters/three
@denovo/canvas/adapters/canvas2d
@denovo/canvas/adapters/r3f
@denovo/canvas/adapters/xeokit

@denovo/canvas/storage/indexeddb
@denovo/canvas/storage/http
@denovo/canvas/storage/postgres
@denovo/canvas/storage/s3

@denovo/canvas/plugins/selection
@denovo/canvas/plugins/transform
@denovo/canvas/plugins/measurement
@denovo/canvas/plugins/annotation
@denovo/canvas/plugins/gltf
@denovo/canvas/plugins/bim

@denovo/canvas/react
@denovo/canvas/vue
@denovo/canvas/svelte
@denovo/canvas/solid
```

Internal workspace packages may stay split for maintainability, but the user
should see a stable facade.

## Facade API

The high-level API should optimize for the default case:

```ts
import { createCanvas } from "@denovo/canvas";

const canvas = createCanvas("#stage", {
  mode: "3d",
  scene
});
```

Editable mode should be one option away:

```ts
const canvas = createCanvas("#stage", {
  mode: "3d",
  editable: true,
  scene
});
```

Advanced use should be explicit:

```ts
import { createCanvas } from "@denovo/canvas";
import { threeAdapter } from "@denovo/canvas/adapters/three";
import { indexedDbStorage } from "@denovo/canvas/storage/indexeddb";
import { transformPlugin } from "@denovo/canvas/plugins/transform";
import { measurementPlugin } from "@denovo/canvas/plugins/measurement";

const canvas = createCanvas("#stage", {
  renderer: threeAdapter({
    bvh: true,
    instancing: true,
    renderLoop: "demand"
  }),
  storage: indexedDbStorage({
    databaseName: "app-scenes"
  }),
  plugins: [
    transformPlugin(),
    measurementPlugin()
  ],
  scene
});
```

## Configuration Model

The primary config object should be serializable where possible and explicit
where dependency instances are required.

```ts
type DenovoCanvasConfig = {
  mode?: "2d" | "3d";
  scene?: CanvasSceneInput;
  document?: CanvasDocumentInput;
  editable?: boolean | EditorConfig;
  renderer?: RendererAdapter | RendererPreset;
  storage?: StorageAdapter | StoragePreset;
  plugins?: CanvasPlugin[];
  theme?: CanvasThemeInput;
  className?: string;
  controls?: boolean | ControlConfig;
};
```

Rules:

- simple presets should work without imports;
- adapters should be importable for advanced configuration;
- plugin order should be deterministic;
- missing required plugin capabilities should fail clearly;
- framework adapters should accept the same config shape where practical.

## Adapter Types

### Renderer Adapter

Renderer adapters own view/runtime integration.

```ts
type RendererAdapter = {
  id: string;
  modes: Array<"2d" | "3d">;
  createRuntime: (options: RendererCreateOptions) => CanvasRuntime;
};
```

Examples:

- Canvas2D adapter;
- Three.js adapter;
- React Three Fiber adapter;
- xeokit adapter;
- headless adapter for testing.

### Storage Adapter

Storage adapters own persistence.

```ts
type StorageAdapter = {
  id: string;
  load: (id: string) => Promise<CanvasDocument | null>;
  save: (document: CanvasDocument) => Promise<SaveResult>;
  savePatch?: (patch: DocumentPatchRecord) => Promise<SaveResult>;
  putAsset?: (asset: AssetUpload) => Promise<AssetRef>;
};
```

Examples:

- memory;
- localStorage for demos;
- IndexedDB;
- HTTP API;
- S3/object storage;
- Postgres-backed repository;
- app-specific custom adapter.

### Framework Adapter

Framework adapters own lifecycle and reactivity.

Examples:

```tsx
import { CanvasView } from "@denovo/canvas/react";

<CanvasView
  scene={scene}
  editable
  plugins={[transformPlugin()]}
/>;
```

Framework adapters should not redefine document semantics or command behavior.

## Plugin Model

Plugins add capabilities to the facade.

```ts
type CanvasPlugin = {
  id: string;
  name?: string;
  nodes?: NodePlugin[];
  commands?: CommandPlugin[];
  tools?: ToolPlugin[];
  renderers?: RendererPlugin[];
  importers?: ImporterPlugin[];
  exporters?: ExporterPlugin[];
  workers?: WorkerPlugin[];
  storage?: StoragePlugin[];
  setup?: (context: PluginSetupContext) => void | Promise<void>;
};
```

Better Auth-like rules:

- plugins declare their required schemas;
- plugins declare server/client/runtime capabilities;
- plugins can add generated schema or migration requirements;
- plugins should be composable;
- plugin conflicts should be detected during config resolution.

## CLI Direction

Denovo should eventually have a CLI similar in spirit to Better Auth's schema
and migration commands.

Target commands:

```sh
denovo init
denovo generate
denovo migrate
denovo add plugin transform
denovo add adapter three
denovo inspect scene ./scene.json
denovo validate ./scene.json
```

### `denovo generate`

Generates:

- document schema artifacts;
- plugin schema registrations;
- TypeScript types;
- storage schema where a storage adapter supports it;
- migration stubs.

### `denovo migrate`

Runs:

- document schema migrations;
- plugin migrations;
- storage migrations where supported.

### `denovo validate`

Validates:

- document shape;
- plugin requirements;
- missing assets;
- unknown node types;
- unsupported schema versions.

## Storage and ORM Analogy

Better Auth supports ORMs because apps already have database choices.

Denovo should support storage backends because apps already have persistence
choices.

Initial storage targets:

- memory;
- localStorage;
- IndexedDB;
- HTTP API;
- filesystem/server;
- object storage for assets;
- SQL-backed repository.

Potential ORM/database integrations should sit behind repository adapters, not
inside core:

```ts
import { postgresStorage } from "@denovo/canvas/storage/postgres";
import { drizzleSceneTables } from "@denovo/canvas/storage/drizzle";

const storage = postgresStorage({
  db,
  schema: drizzleSceneTables
});
```

This keeps the same product philosophy as Better Auth: bring your stack, use an
adapter, keep the product API stable.

## Better Auth Lessons to Copy

Copy:

- one obvious setup function;
- adapters for ecosystem choices;
- plugins for capabilities;
- CLI for generated boilerplate;
- clear server/client split;
- strong TypeScript inference;
- documented extension contracts.

Avoid:

- making every integration part of the default bundle;
- hiding too much from advanced users;
- letting plugins mutate global behavior without declarations;
- coupling core to one framework or one persistence backend.

## Implementation Order

1. Add `@denovo/canvas` facade package.
2. Re-export current web runtime through the facade.
3. Add config resolver for presets, adapters, plugins, and theme.
4. Add CSS variable theme contract.
5. Add `@denovo/canvas-editor` and connect editable mode.
6. Add storage adapter interface and memory/IndexedDB adapters.
7. Add plugin capability registry.
8. Add CLI skeleton.
9. Add framework facade subpaths.

The first milestone is not more rendering features. It is making the installation
and setup path feel like a product.

