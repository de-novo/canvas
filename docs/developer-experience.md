# Developer Experience

## Goal

Denovo Canvas exists to reduce the friction of building web 2D/3D viewers and
editors.

The SDK should let application developers express intent with document,
selection, editing, persistence, and extension APIs instead of forcing them to
manually wire low-level rendering details for every project.

## Problem Statement

Existing 3D and rendering libraries are powerful but difficult to productize.

Common pain points:

- too much boilerplate for scene, camera, renderer, resize, and animation loops;
- unclear split between app state, renderer state, and persisted document state;
- hard picking/selection APIs;
- hard transform editing and undo/redo;
- manual disposal of GPU resources;
- fragile resize behavior;
- difficult asset loading and progress handling;
- poor defaults for large scenes;
- framework-specific examples that do not translate to other stacks;
- BIM dependencies that are large, license-sensitive, and hard to isolate;
- no standard way to save editable scenes and patches.

Denovo Canvas should wrap these concerns behind stable, composable SDK layers.

## DX Promise

A developer should be able to:

- render a scene in one call;
- turn a viewer into an editor without rewriting the scene model;
- select and transform objects without writing raycasting or pointer plumbing;
- save and restore documents without inventing a schema;
- add custom node types without forking the runtime;
- use React, Vue, Svelte, Solid, Astro, or vanilla web with the same core model;
- scale to larger scenes through documented performance primitives.

## API Design Rules

### Progressive Disclosure

Simple things should be simple:

```ts
const canvas = createCanvas(container, { scene });
```

Editing should add one layer:

```ts
const editor = createEditor({ document });
const disconnect = connectEditorToCanvas(editor, canvas);
```

Advanced users should still be able to reach lower-level hooks:

```ts
const canvas = createCanvas(container, {
  document,
  plugins: [domainPlugin],
  renderer: domainRendererAdapter
});

if ("objects" in canvas.current) {
  canvas.current.render();
}
```

### Sensible Defaults

The SDK should choose good defaults for:

- renderer creation;
- resize handling;
- device pixel ratio;
- demand-based render loop;
- resource disposal;
- selection state;
- undo/redo;
- schema validation;
- asset references;
- worker capability checks.

Users should configure these only when their product needs it.

### One Mental Model

Developers should not need separate mental models for each framework.

The core model is:

```text
Document -> Editor commands -> Runtime invalidation -> Renderer output
```

Framework adapters should only change how developers subscribe and render UI.

### Escape Hatches

Convenience must not block advanced work.

Required escape hatches:

- access underlying Three.js scene/camera/renderer in 3D runtime;
- register custom renderers;
- register custom commands;
- override picking;
- provide custom asset loaders;
- provide custom persistence;
- opt into direct `BufferGeometry`, instancing, or BVH.

Escape hatches must be explicit and documented, not accidental internal access.

## Target Quick Starts

### Vanilla Viewer

```ts
import { createCanvas } from "@denovo/canvas";
import "@denovo/canvas/styles.css";

createCanvas("#stage", {
  scene: {
    id: "demo",
    layers: [{ id: "default", name: "Default" }],
    mode: "3d",
    nodes: [
      {
        color: "#22c55e",
        id: "box",
        layerId: "default",
        position: [0, 0, 0],
        type: "box"
      }
    ]
  }
});
```

### Vanilla Editor

```ts
import {
  connectEditorToCanvas,
  createCanvas,
  createEditor,
  createSelectTool,
  createTransformTool
} from "@denovo/canvas";

const tools = [
  createSelectTool(),
  createTransformTool({ operation: "translate" }),
  createTransformTool({ operation: "rotate" }),
  createTransformTool({ operation: "scale" })
];
const canvas = createCanvas(stage, { document });
const editor = createEditor({ activeToolId: "select", document, tools });

const disconnect = connectEditorToCanvas(editor, canvas);
```

### React View

```tsx
import { CanvasView } from "@denovo/canvas/react";

export function App() {
  return <CanvasView scene={document.scene} />;
}
```

These examples use current public entrypoints. React remains a view/lifecycle
adapter; applications that need editing use the same framework-independent
editor and facade connectors rather than a second React-owned document model.

## What Denovo Should Hide

The base SDK should hide:

- WebGL renderer setup;
- animation loop wiring;
- resize observer details;
- camera defaults;
- Canvas2D pixel ratio setup;
- simple shape rendering;
- basic Three.js primitives;
- object picking;
- selected object state;
- history stack mechanics;
- command inverse and snapshot-history mechanics;
- asset reference validation;
- plugin registration order.

## What Denovo Should Expose

The SDK should expose:

- document schema;
- editor commands;
- runtime lifecycle;
- selection state;
- active tool state;
- persistence events;
- hit test results;
- invalidation controls;
- renderer escape hatches;
- plugin capabilities;
- asset loading hooks.

## Comparison to Low-Level Libraries

Denovo Canvas does not replace Three.js, React Three Fiber, Canvas2D, or BIM
engines. It sits above them and intentionally depends on strong libraries when
they are the right engine.

The goal is not "no dependencies." The goal is "fewer decisions and less
integration work for product developers."

| Need | Low-level library responsibility | Denovo responsibility |
| --- | --- | --- |
| GPU rendering | Three.js, Canvas2D, xeokit | runtime defaults and lifecycle |
| React scene rendering | React Three Fiber | optional adapter |
| Useful R3F helpers | Drei | limited adapter convenience |
| Raycast acceleration | three-mesh-bvh | opt-in picking helper |
| IFC parsing | web-ifc | optional worker/import adapter |
| BIM viewer | xeokit | optional bridge |
| Document schema | application developer | core schema |
| Editing commands | application developer | editor core |
| Save/load contract | application developer | persistence interface |

## Dependency Philosophy

Denovo should use existing libraries when they solve hard, general problems:

- Three.js for 3D rendering;
- React Three Fiber for React composition;
- Drei for selected high-value controls/helpers;
- Zustand for local state;
- TanStack Query for app-level server state examples;
- Zod for schemas;
- three-mesh-bvh for accelerated raycasting;
- web-ifc and xeokit for optional BIM workflows.

Denovo's value is the integration layer:

- documented defaults;
- consistent scene/document model;
- common edit commands;
- undo/redo;
- persistence;
- plugin capability discovery;
- style and theme hooks;
- escape hatches into the underlying engines.

## DX Acceptance Criteria

For each milestone, ask:

- Can a developer complete the common workflow without reading Three.js docs?
- Can they inspect and override the lower-level runtime when needed?
- Can the same document be used from vanilla and React examples?
- Can edits be saved and restored without custom schema work?
- Can a custom node/tool be added without changing core source?
- Does the default path avoid memory leaks and resize bugs?

If the answer is no, the API is not convenient enough yet.
