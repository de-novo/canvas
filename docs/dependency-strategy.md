# Dependency Strategy

## Position

Denovo Canvas is not trying to avoid dependencies for their own sake.

The product goal is to make proven 2D/3D/web libraries easier to use together.
Dependencies are acceptable when they provide strong engines, ecosystem
compatibility, or performance primitives that would be expensive and risky to
rebuild.

Denovo should be a facade and orchestration SDK over good libraries, not a
from-scratch replacement for them. Absorbing an upstream look means restating
it as our document. Shipping their component, HTML, or iframe is hosting.
See [Product Identity](./product-identity.md).

Do not add `vgpu` or Canvas UI (`@canvas-ui/*`) as dependencies. vgpu is
a shader/GPU library. Canvas UI is a component registry that uses vgpu
for its WebGPU build. Neither is a document facade. Same-props
WebGL/WebGPU builds and a no-throw GPU-missing fallback are patterns to
copy, not packages to import. See
[2026-09-02 Canvas UI reference](./history/2026-09-02-canvas-ui-reference.md).

The closest product reference is Better Auth: one cohesive high-level API with
adapters, plugins, generated schema/migrations, and framework-specific helpers.
Denovo should apply that pattern to rendering, editing, persistence, assets, and
domain extensions.

## What We Depend On

### Rendering Engines

- Three.js for general 3D rendering (WebGL2 today).
- WebGL2 as the implemented 3D backend.
- Native Canvas2D as the implemented 2D backend.
- WebGPU as an explicit 3D built-in through Three.js, never a current
  `auto` result or a document field.
- React Three Fiber for React-specific 3D composition.
- Limited Drei helpers for common React 3D controls and convenience.
- xeokit and web-ifc as optional BIM engines.

### State and Data

- Zustand for small, framework-agnostic local state.
- TanStack Query for app-level server state examples and adapters.
- Zod for schema validation and public document contracts.
- Effect for optional internal functional core workflows where structured
  composition, resource safety, and typed failure handling help without leaking
  into the default facade.

### Performance

- `three-mesh-bvh` for accelerated picking and spatial queries.
- Web Workers for parsing, indexing, and heavy geometry work.
- OffscreenCanvas when the runtime supports it.

## What Denovo Adds

Denovo should make these libraries easier by providing:

- one clear document model;
- simple setup APIs;
- lifecycle management;
- resize-safe rendering;
- good render-loop defaults;
- selection and hit-test normalization;
- command-based editing;
- undo/redo;
- save/load contracts;
- asset references;
- plugin registration;
- framework adapters;
- clear escape hatches.

The user should not need to manually connect renderer setup, editor state,
commands, persistence, and worker pipelines for every project.

## Dependency Rules

### Use Dependencies When They Are Engines

Use dependencies for:

- rendering;
- raycasting acceleration;
- framework integration;
- BIM parsing/viewing;
- query/cache management;
- validation;
- storage adapters.

Avoid dependencies for:

- small utilities that are trivial to maintain;
- APIs that would leak one framework into core;
- libraries with large bundle cost in the default path;
- license-sensitive packages in base packages.

### Keep Base Packages General

Base packages may depend on widely useful libraries:

- `@denovo/canvas-core`: Zod, Zustand vanilla, and Effect for internal
  functional workflows.
- `@denovo/canvas-editor`: Effect for serialized command, transaction, history,
  and typed failure workflows.
- `@denovo/canvas`: Effect for staged plugin setup, atomic editor registry
  installation, rollback, and lifecycle failure translation.
- `@denovo/canvas-web`: DOM, Canvas2D, Three.js runtime. IndexedDB
  `applyCommands` uses `@denovo/canvas-editor`.
- `@denovo/canvas-three`: Three.js and performance primitives.
- `@denovo/canvas-server`: memory and filesystem adapters depend on
  `@denovo/canvas-editor` for `applyCommandsToStoredDocument`. The package
  stays framework-neutral; it does not depend on DOM or renderer packages.

Specialized packages should be optional:

- React/R3F in `@denovo/react-canvas`;
- BIM engines in `@denovo/canvas-bim`;
- server framework adapters in separate packages;
- Vue/Svelte/Solid adapters in separate packages.

### Prefer Progressive, Explicit Backends

Rendering backend choice should use progressive enhancement without silent
substitution:

- WebGL2 for implemented 3D compatibility;
- Canvas2D for implemented 2D `auto`;
- WebGPU as an explicit 2D and 3D built-in, and the 3D `auto` preference
  when `navigator.gpu` is present;
- custom adapters for BIM and domain renderers.

An explicit `webgpu`, `webgl2`, `canvas2d`, `offscreen-canvas2d`, or `custom`
request either creates that backend or fails with a backend-resolution error.
It must not select a different implementation. `auto` is the only selector
that may choose among backends, and it may choose only an implemented,
mode-compatible backend whose required capability is available. The current
built-ins therefore resolve 2D to Canvas2D and 3D to WebGPU when the
probe is true, otherwise WebGL2. OffscreenCanvas2D requests fail as
unimplemented.

See [Rendering Backend Strategy](./rendering-backend-strategy.md).

### TypeScript 7 And Effect Policy

TypeScript 7 is the required repository development, typecheck, and build
toolchain. It is not the minimum consumer requirement: published declarations
must remain conservative until compatibility is verified across supported
framework adapters, editors, and downstream TypeScript versions.

Effect is the preferred internal composition model whenever a workflow benefits
from typed failure channels, dependency injection, resource safety,
interruption, concurrency, retries, scheduling, or deterministic pipelines.
This includes command processing, undo/redo internals, migrations,
import/export, worker orchestration, server adapters, persistence workflows, and
plugin lifecycle management.

Effect may be used behind ordinary public functions and package entrypoints as
an implementation detail. Public boundaries must translate Effect programs,
services, scopes, causes, and errors into ordinary TypeScript values, promises,
and documented domain errors. Explicit Effect-native entrypoints such as
`@denovo/canvas-core/effect` may additionally expose Effect for advanced
consumers, but the default facade must never require consumers to understand or
provide Effect values.

Small synchronous transforms, schema declarations, and performance-sensitive
imperative code may remain plain TypeScript when Effect adds no lifecycle,
failure, or composition value.

Effect must not:

- appear in public facade types;
- be required to call `createCanvas`;
- leak into document JSON;
- leak runtime values into plugin state or persisted command payloads;
- wrap renderer hot paths such as frame loops, WebGL/WebGPU command submission,
  instance matrix updates, or pointer event loops;
- become a prerequisite for simple consumers.

The preferred architecture is functional core, imperative renderer shell.

### Hide Complexity, Not Capability

Denovo should hide common boilerplate:

- renderer creation;
- resize observer wiring;
- render loop setup;
- resource disposal;
- basic picking;
- selection state;
- command dispatch;
- undo/redo;
- persistence events.

Denovo should expose advanced access:

- underlying Three.js scene/camera/renderer;
- custom geometry/materials;
- custom R3F composition;
- custom asset loaders;
- custom command handlers;
- custom persistence;
- worker task registration.

## API Implication

The ideal default API is high-level:

```ts
import { createCanvas } from "@denovo/canvas";

const canvas = createCanvas("#stage", {
  scene
});
```

Advanced users can drop down:

```ts
if ("objects" in canvas.current) {
  canvas.current.scene.add(customMesh);
  canvas.current.render();
}
```

React users get an idiomatic adapter:

```tsx
import { CanvasView } from "@denovo/canvas/react";

<CanvasView
  scene={scene}
  options={{
    controls: { enablePan: true, enableRotate: true, enableZoom: true }
  }}
/>;
```

But React is not the source of truth. It is one adapter over the same document
and runtime concepts.

## Better Auth Style Facade

The user-facing package should feel like one product. The adapter, storage, and
plugin subpaths in this example are a target distribution shape, not a claim
that each package is already published:

```ts
import { createCanvas } from "@denovo/canvas";
import { threeAdapter } from "@denovo/canvas/adapters/three";
import { indexedDbStorage } from "@denovo/canvas/storage/indexeddb";
import { transformPlugin } from "@denovo/canvas/plugins/transform";

createCanvas("#stage", {
  renderer: threeAdapter(),
  storage: indexedDbStorage(),
  plugins: [transformPlugin()],
  scene
});
```

Internal packages can remain split, but most users should start from
`@denovo/canvas`.

## Success Criteria

Denovo succeeds if:

- a simple 2D/3D scene takes minutes, not hours;
- users can start without reading multiple engine docs;
- advanced users can still access the underlying engines;
- the same document works in vanilla, React, and future adapters;
- dependencies remain replaceable at package boundaries;
- heavy dependencies do not enter the default install path unnecessarily.
