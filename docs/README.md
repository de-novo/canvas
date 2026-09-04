# Documentation Index

This directory is the product and architecture source of truth for Denovo
Canvas.

Repository governance files live at the repo root:
[LICENSE](../LICENSE), [NOTICE](../NOTICE),
[CONTRIBUTING](../CONTRIBUTING.md),
[CODE_OF_CONDUCT](../CODE_OF_CONDUCT.md), and
[SECURITY](../SECURITY.md). The Work is Apache-2.0.

## Core Documents

- [Contributor Operating Policy](./contributor-operating-policy.md): how human
  and automated contributors manage scope, project status, documentation,
  verification, decisions, history, review, and handoff.
- [Contributor Rules](./contributor-rules.md): enforceable repository rules for
  code, public contracts, rendering, persistence, dependencies, verification,
  documentation, and review.
- [Contributor Automation](./contributor-automation.md): ownership and discovery
  rules for `AGENTS.md`, repository skills, deterministic verifiers, status,
  and history evidence.
- [Project Status](./project-status.md): the canonical status index for current
  phase, completed work, active work, blockers, and evidence.
- [Product Identity](./product-identity.md): the facade we are — open-source
  impressiveness restated as our documents, not hosted upstream rooms.
- [Framework Surface](./framework-surface.md): kinds, properties, and
  operations humans and agents write; engines and backends stay off that
  path.
- [Extension Surface Decision](./extension-surface-decision.md): the kind is
  the only product-level extension seam; `CanvasPlugin` is a host bundle;
  `pluginState` is bookkeeping; the plugin taxonomy is superseded.
- [M0 Product Contract](./m0-product-contract.md): the first stable public
  contract for packages, documents, commands, storage, extension, styling, and
  the default facade.
- [M3 Authoring Contract](./m3-authoring-contract.md): the transform, creation,
  property, group/layer, grid snapping, measurement, annotation, persistence,
  capability, failure, and verification contract for authoring tools.
- [M3.1 Surface Placement and Stacking Contract](./m3-1-surface-placement-contract.md):
  exact world-aligned box-on-box surface placement, transient ghost, strict
  surface-query capability, lifecycle, no-fallback, and verification contract.
- [Named Authoring Operations](./named-authoring-operations.md): sayable
  helpers (`setLayerVisible`, `setLayerLocked`, `stackBox`, `listNodes`,
  `listLayers`, `listLabels`, `setNodeVisible`, `setNodeLocked`, `removeNode`,
  `removeEdge`, `removeLayer`, `addLayer`, `reorderLayer`,
  `setSparklineStyle`, `setLayerName`, `setNodeLayer`, `setText`,
  `setAnnotationText`) that compile to
  existing commands so host UI and agents share one function.
- [M8 Diagram Contract](./m8-diagram-contract.md): 2D `edge` / `text` / `html`
  vocabulary frozen in `0.2.0`, port and path-style rules, graph paste/delete,
  overlay HTML (not `innerHTML`), connector tool, and explicit non-goals.
- [Public API Contract](./public-api-contract.md): facade exports, rename
  policy, default import shape, backend config, and smoke verification.
- [Architecture](./architecture.md): package layers and runtime boundaries.
- [Rendering Backend Strategy](./rendering-backend-strategy.md): implemented
  Canvas2D and 3D WebGPU/WebGL2 `auto` backends, explicit 3D WebGPU, strict explicit
  selection, and capability detection.
- [Vision and Milestones](./vision-and-milestones.md): what the SDK should be
  able to express and the staged roadmap.
- [Editing Model](./editing-model.md): how view-only scenes become editable
  documents.
- [Persistence and Sync](./persistence-and-sync.md): how scenes, assets,
  command history, and future collaboration are stored.
- [Extensibility](./extensibility.md): how plugins, renderers, tools, importers,
  and framework adapters are added without coupling the core to one ecosystem.
- [Developer Experience](./developer-experience.md): how the SDK reduces the
  practical difficulty of using low-level 2D/3D libraries directly.
- [Dependency Strategy](./dependency-strategy.md): how the SDK intentionally
  uses proven libraries while making them easier to apply.
- [Better Auth Style Architecture](./better-auth-style-architecture.md): how the
  SDK should use a facade, adapters, plugins, and CLI generation like Better
  Auth does for auth/database ecosystems.
- [History](./history/README.md): chronological evidence for durable project
  changes, including the M3 authoring implementation, earlier verified M3
  slices, public type-contract hardening, and contributor-rule enforcement.

## Product Rule

The core product is not a React or Next.js library. It is a web ecosystem SDK.
React, Next.js, Vue, Svelte, Solid, Astro, server utilities, workers, and BIM
support are adapters or extensions around a framework-agnostic document model.

The product should make common 2D/3D view/edit workflows easier than using
Three.js, React Three Fiber, Canvas2D, xeokit, web-ifc, and related libraries
directly. Depending on those libraries is acceptable; exposing their complexity
to every app developer is the problem.

Who we are, the absorption test, and the first showcases live in
[Product Identity](./product-identity.md). Engines may stay. Their catalogs
must not become ours.
