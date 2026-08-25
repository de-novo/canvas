# Architecture

## Documentation Map

- [M0 Product Contract](./m0-product-contract.md) defines the first stable
  facade, document, command, storage, extension, and styling contract.
- [Public API Contract](./public-api-contract.md) defines the facade exports,
  rename policy, default import shape, backend config, and smoke verification.
- [M3 Authoring Contract](./m3-authoring-contract.md) defines authoring schema,
  tool, capability, package-responsibility, and no-fallback boundaries.
- [Rendering Backend Strategy](./rendering-backend-strategy.md) defines
  implemented Canvas2D/WebGL2 `auto` backends, explicit 3D WebGPU, and
  strict backend selection.
- [Vision and Milestones](./vision-and-milestones.md) defines what Denovo
  Canvas should be able to express.
- [Editing Model](./editing-model.md) defines how documents are changed.
- [Persistence and Sync](./persistence-and-sync.md) defines how documents,
  assets, and patches are stored.
- [Extensibility](./extensibility.md) defines how renderers, tools, formats, and
  frameworks are added.
- [Developer Experience](./developer-experience.md) defines how the SDK hides
  low-level rendering/editor complexity while preserving escape hatches.
- [Dependency Strategy](./dependency-strategy.md) defines how proven libraries
  are used as engines behind simpler Denovo APIs.
- [Better Auth Style Architecture](./better-auth-style-architecture.md) defines
  the facade, adapter, plugin, storage, and CLI pattern.

## Package Layers

- Facade package: `@denovo/canvas` is the default user-facing package. It owns
  quick setup, CSS variables, theme hooks, plugin registration, and re-exported
  adapter entrypoints.
- Core runtime: TypeScript, Zod, and Zustand vanilla store. No framework
  dependency.
- Editor core: command dispatcher, selection, history, tools, transactions.
  This is owned by the framework-free `@denovo/canvas-editor` package and is
  re-exported explicitly through the facade.
- Web runtime: DOM, native 2D Canvas, and Three.js. Usable from plain HTML,
  Astro, Vue, Svelte, Solid, React, or any web framework. The IndexedDB
  adapter applies stored commands through `@denovo/canvas-editor`.
- 3D primitives: Three.js plus `three-mesh-bvh` acceleration helpers.
- Framework adapters: React/R3F first, then Vue/Svelte/Solid adapters can be
  added without changing core contracts.
- App examples: Vanilla web first, Next.js App Router as one integration
  example.
- Server state: TanStack Query belongs in app/adapters, not in core.

## Ownership Rules

- Core owns schemas and document contracts.
- Editor owns persistent mutations.
- Renderers own derived runtime resources.
- Adapters own framework lifecycle and ergonomics.
- Server packages own repository interfaces and storage adapters.
- Extension packages own heavy or domain-specific dependencies.
- Developer-facing APIs must prefer progressive disclosure: one-call viewer,
  one-layer editor, explicit escape hatches for advanced rendering.
- Dependencies are allowed when they act as engines or ecosystem bridges. The
  architecture should isolate their complexity behind stable package boundaries.
- The user-facing product should start from a facade package, similar to Better
  Auth's high-level setup function, with adapters and plugins beneath it.

## Rendering Strategy

- Implemented `auto` backends are Canvas2D (2D) and WebGL2 (3D). Explicit
  `backend: "webgpu"` is a 3D built-in and is not a current `auto` result.
- Runtime backend selection should default to `auto`. It may select only a
  genuinely implemented, mode-compatible backend with the required runtime
  capability.
- An explicitly requested backend is strict: unsupported, unavailable, or
  mode-incompatible requests fail instead of silently selecting another
  backend. Custom rendering requires an explicit adapter.
- Document `mode` is not the same as renderer `backend`. Stored documents should
  say what they represent, not which GPU API must render them.
- Default render loop is `demand`; use `always` only for continuous animation.
- Repeated 3D entities should use `InstancedMesh`.
- Large generated geometry should use `BufferGeometry`, not object-per-face
  scene graphs.
- Batching belongs in renderer packages, while scene definitions stay serializable.
- LOD, frustum culling, and chunk loading are scene/runtime options, not React-only
  features.

## Dependency Strategy

Denovo should not reimplement Three.js, React Three Fiber, Drei, web-ifc,
xeokit, TanStack Query, or Zustand. It should make them easier to apply by
providing:

- simpler setup;
- shared document schemas;
- editor commands;
- lifecycle management;
- persistence contracts;
- framework adapters;
- escape hatches for direct engine access.

Heavy or domain-specific dependencies must remain in optional packages so the
default path stays general.

## Heavy Processing

- IFC parsing, geometry conversion, and chunk indexing should run in Web Workers.
- OffscreenCanvas is supported through a capability check and should be used only
  when the browser/runtime supports transfer from `HTMLCanvasElement`.
- WASM parsers should be lazy-loaded from extension packages.

## BIM Extension Policy

- `@xeokit/xeokit-sdk` is AGPL-3.0, so it must remain optional.
- `web-ifc` is MPL-2.0 and should only be loaded for IFC workflows.
- BIM-specific packages should depend on adapter contracts from
  `@denovo/canvas-bim` rather than coupling the base runtime to BIM engines.
