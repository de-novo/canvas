# Denovo Canvas

Framework-agnostic canvas libraries for the web, covering 2D drawing,
high-performance 3D, optional framework adapters, and future BIM extensions.

The goal is to make common 2D/3D view and edit workflows easier than wiring
Three.js, React Three Fiber, Canvas2D, xeokit, or web-ifc directly.

Denovo can depend on those libraries. Its job is to make them easier to install,
configure, style, edit with, save from, and extend.

The product shape is inspired by Better Auth: one high-level setup API with
adapters, plugins, storage integrations, framework helpers, and eventually CLI
generation/migration support.

## Package Shape

- `@denovo/canvas`: default user-facing facade for quick setup, CSS/theme
  contract, plugin registration surface, and framework-agnostic web runtime.
- `@denovo/canvas-core`: headless scene schema, Zustand vanilla store, shared
  types, validation, document contracts, editing command contracts, storage
  contracts, and plugin contracts.
- `@denovo/canvas-editor`: framework-independent command dispatcher, selection,
  history, tools, transactions, and the persistence event bus.
- `@denovo/canvas-web`: framework-agnostic browser runtime for native 2D Canvas
  and Three.js 3D.
- `@denovo/canvas-three`: Three.js optimization primitives such as demand render
  loops, InstancedMesh helpers, and BVH raycasting setup.
- `@denovo/react-canvas`: optional React adapter with React Three Fiber support
  and explicit delegation to `@denovo/canvas-web` for dynamic 2D/3D scenes.
- `@denovo/vue-canvas`: optional Vue 3 adapter that mounts the same
  `@denovo/canvas-web` runtime behind a reactive `DenovoCanvas` component.
- `@denovo/svelte-canvas`: optional Svelte adapter for the same web runtime.
- `@denovo/solid-canvas`: optional Solid adapter for the same web runtime.
- `@denovo/canvas-server`: server-side scene storage and validation utilities.
- `@denovo/canvas-worker`: Web Worker and OffscreenCanvas helpers.
- `@denovo/canvas-bim`: optional BIM adapter contracts and `./web-ifc` importer.

This follows the TanStack-style split: keep the core portable, keep the web
runtime framework-agnostic, then publish small adapters for each ecosystem.

## Quick Start

```ts
import { createCanvas } from "@denovo/canvas";
import "@denovo/canvas/styles.css";

const runtime = createCanvas("#stage", {
  scene: {
    id: "demo",
    layers: [
      {
        id: "default",
        name: "Default"
      }
    ],
    nodes: [
      {
        id: "box",
        layerId: "default",
        type: "box",
        color: "#22c55e",
        position: [0, 0, 0]
      }
    ]
  }
});

runtime.start();
```

## License And Governance

Denovo Canvas is licensed under the [Apache License 2.0](./LICENSE).
See [NOTICE](./NOTICE) for copyright and third-party notes.

- [Contributing](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security policy](./SECURITY.md)

## Development

```sh
pnpm install
pnpm build
pnpm dev --filter @denovo/canvas-vanilla-example
pnpm dev --filter @denovo/canvas-next-playground
```

## Design Documents

- [Agent Operating Policy](./docs/agent-operating-policy.md)
- [Project Status](./docs/project-status.md)
- [M4 Performance Thresholds](./docs/m4-performance-thresholds.md)
- [M0 Product Contract](./docs/m0-product-contract.md)
- [M3 Authoring Contract](./docs/m3-authoring-contract.md)
- [Public API Contract](./docs/public-api-contract.md)
- [Architecture](./docs/architecture.md)
- [Rendering Backend Strategy](./docs/rendering-backend-strategy.md)
- [Vision and Milestones](./docs/vision-and-milestones.md)
- [Editing Model](./docs/editing-model.md)
- [Persistence and Sync](./docs/persistence-and-sync.md)
- [Extensibility](./docs/extensibility.md)
- [Developer Experience](./docs/developer-experience.md)
- [Dependency Strategy](./docs/dependency-strategy.md)
- [Better Auth Style Architecture](./docs/better-auth-style-architecture.md)
