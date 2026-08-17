# Documentation Index

This directory is the product and architecture source of truth for Denovo
Canvas.

## Core Documents

- [Agent Operating Policy](./agent-operating-policy.md): how agents manage
  goals, project status, documentation, verification, decisions, and history.
- [Agent Rules](./agent-rules.md): enforceable repository rules for agents
  changing code, public contracts, rendering, persistence, dependencies, and
  documentation.
- [Project Status](./project-status.md): the canonical status index for current
  phase, completed work, active work, blockers, and evidence.
- [M0 Product Contract](./m0-product-contract.md): the first stable public
  contract for packages, documents, commands, storage, extension, styling, and
  the default facade.
- [M3 Authoring Contract](./m3-authoring-contract.md): the transform, creation,
  property, group/layer, grid snapping, measurement, annotation, persistence,
  capability, failure, and verification contract for authoring tools.
- [M3.1 Surface Placement and Stacking Contract](./m3-1-surface-placement-contract.md):
  exact world-aligned box-on-box surface placement, transient ghost, strict
  surface-query capability, lifecycle, no-fallback, and verification contract.
- [Public API Contract](./public-api-contract.md): facade exports, rename
  policy, default import shape, backend config, and smoke verification.
- [Architecture](./architecture.md): package layers and runtime boundaries.
- [Rendering Backend Strategy](./rendering-backend-strategy.md): WebGPU-first
  direction, implemented compatibility backends, strict explicit selection,
  capability detection, and backend vocabulary.
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
  slices, public type-contract hardening, and agent-rule enforcement.

## Product Rule

The core product is not a React or Next.js library. It is a web ecosystem SDK.
React, Next.js, Vue, Svelte, Solid, Astro, server utilities, workers, and BIM
support are adapters or extensions around a framework-agnostic document model.

The product should make common 2D/3D view/edit workflows easier than using
Three.js, React Three Fiber, Canvas2D, xeokit, web-ifc, and related libraries
directly. Depending on those libraries is acceptable; exposing their complexity
to every app developer is the problem.
